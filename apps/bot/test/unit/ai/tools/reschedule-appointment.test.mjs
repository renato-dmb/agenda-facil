import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../../../helpers/cjs-loader.mjs';

const toolRequire = requireFromSrc('ai/tools/reschedule-appointment.js');
const gcal = toolRequire('../../integrations/calendar');
const reminders = toolRequire('../../scheduler/appointment-reminders');
const reschedule = toolRequire('./reschedule-appointment');

let pool;
let tenant;
let appt;
let testHelpers;

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool);
  const c = await testHelpers.seedCustomer(pool, tenant.id, { name: 'João' });
  const r = await pool.query(
    `INSERT INTO appointments (tenant_id, customer_id, starts_at, ends_at, google_event_id, status)
     VALUES ($1, $2, '2026-04-25T13:00:00Z', '2026-04-25T13:30:00Z', 'gcal-evt-1', 'confirmed')
     RETURNING *`,
    [tenant.id, c.id],
  );
  appt = r.rows[0];
  gcal.updateEvent = vi.fn().mockResolvedValue({ id: 'gcal-evt-1' });
  reminders.syncForAppointment = vi.fn().mockResolvedValue({ ok: true });
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('tools/reschedule-appointment', () => {
  it('retorna erro quando appointment_id inválido', async () => {
    const r = await reschedule.execute(
      {
        appointment_id: '00000000-0000-0000-0000-000000000000',
        new_start_time: '2026-04-26T14:00:00Z',
      },
      { tenant },
    );
    expect(r.error).toMatch(/appointment_id não encontrado/);
  });

  it('preserva a duração original ao reagendar', async () => {
    const r = await reschedule.execute(
      {
        appointment_id: appt.id,
        new_start_time: '2026-04-26T14:00:00Z',
      },
      { tenant },
    );
    expect(r.new_starts_at).toBe('2026-04-26T14:00:00Z');
    expect(r.new_ends_at).toBe('2026-04-26T14:30:00.000Z');
  });

  it('atualiza evento no Google e DB', async () => {
    await reschedule.execute(
      {
        appointment_id: appt.id,
        new_start_time: '2026-04-26T14:00:00Z',
      },
      { tenant },
    );
    expect(gcal.updateEvent).toHaveBeenCalledWith(
      tenant.id,
      'gcal-evt-1',
      expect.objectContaining({
        start: expect.objectContaining({ dateTime: '2026-04-26T14:00:00Z' }),
        end: expect.objectContaining({ dateTime: '2026-04-26T14:30:00.000Z' }),
      }),
    );

    const r = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [appt.id]);
    expect(r.rows[0].starts_at.toISOString()).toBe('2026-04-26T14:00:00.000Z');
    expect(r.rows[0].ends_at.toISOString()).toBe('2026-04-26T14:30:00.000Z');
  });

  it('pula Google update quando não há google_event_id', async () => {
    await pool.query(`UPDATE appointments SET google_event_id = NULL WHERE id = $1`, [
      appt.id,
    ]);
    const r = await reschedule.execute(
      {
        appointment_id: appt.id,
        new_start_time: '2026-04-26T14:00:00Z',
      },
      { tenant },
    );
    expect(r.new_starts_at).toBe('2026-04-26T14:00:00Z');
    expect(gcal.updateEvent).not.toHaveBeenCalled();
  });
});
