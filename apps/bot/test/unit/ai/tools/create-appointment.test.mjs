import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../../../helpers/cjs-loader.mjs';

const toolRequire = requireFromSrc('ai/tools/create-appointment.js');
const gcal = toolRequire('../../integrations/calendar');
const reminders = toolRequire('../../scheduler/appointment-reminders');
const createAppointment = toolRequire('./create-appointment');

let pool;
let tenant;
let service;
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
  const s = await pool.query(
    `INSERT INTO services (tenant_id, name, duration_minutes, active)
     VALUES ($1, 'Corte', 30, true) RETURNING *`,
    [tenant.id],
  );
  service = s.rows[0];
  gcal.createEvent = vi.fn().mockResolvedValue({ id: 'gcal-evt-123' });
  reminders.syncForAppointment = vi.fn().mockResolvedValue({ ok: true });
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('tools/create-appointment', () => {
  it('retorna erro quando service_id inválido', async () => {
    const r = await createAppointment.execute(
      {
        customer_name: 'João',
        service_id: '00000000-0000-0000-0000-000000000000',
        start_time: '2026-04-25T13:00:00Z',
      },
      { tenant, customerPhone: '5511987654321' },
    );
    expect(r.error).toMatch(/service_id não encontrado/);
  });

  it('cria appointment no DB e chama gcal.createEvent', async () => {
    const r = await createAppointment.execute(
      {
        customer_name: 'João',
        service_id: service.id,
        start_time: '2026-04-25T13:00:00Z',
      },
      { tenant, customerPhone: '5511987654321' },
    );
    expect(r.appointment_id).toBeDefined();
    expect(r.google_event_id).toBe('gcal-evt-123');
    expect(r.ends_at).toBe('2026-04-25T13:30:00.000Z');
    expect(gcal.createEvent).toHaveBeenCalledWith(
      tenant.id,
      expect.objectContaining({
        summary: expect.stringContaining('Corte'),
        startIso: '2026-04-25T13:00:00Z',
        endIso: '2026-04-25T13:30:00.000Z',
      }),
    );

    const appts = await pool.query(
      `SELECT * FROM appointments WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(appts.rowCount).toBe(1);
    expect(appts.rows[0].google_event_id).toBe('gcal-evt-123');
  });

  it('upserta customer pelo phone do context', async () => {
    await createAppointment.execute(
      {
        customer_name: 'Maria',
        service_id: service.id,
        start_time: '2026-04-25T13:00:00Z',
      },
      { tenant, customerPhone: '5511900000001' },
    );
    const c = await pool.query(
      `SELECT * FROM customers WHERE tenant_id = $1 AND phone = $2`,
      [tenant.id, '5511900000001'],
    );
    expect(c.rowCount).toBe(1);
    expect(c.rows[0].name).toBe('Maria');
    expect(c.rows[0].last_appointment_at).not.toBeNull();
  });
});
