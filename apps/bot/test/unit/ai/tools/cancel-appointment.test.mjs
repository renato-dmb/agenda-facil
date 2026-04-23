import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../../../helpers/cjs-loader.mjs';

const toolRequire = requireFromSrc('ai/tools/cancel-appointment.js');
const gcal = toolRequire('../../integrations/calendar');
const reminders = toolRequire('../../scheduler/appointment-reminders');
const cancel = toolRequire('./cancel-appointment');

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
  gcal.deleteEvent = vi.fn().mockResolvedValue(undefined);
  reminders.removeForAppointment = vi.fn().mockResolvedValue(undefined);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('tools/cancel-appointment', () => {
  it('retorna erro quando appointment_id inválido', async () => {
    const r = await cancel.execute(
      { appointment_id: '00000000-0000-0000-0000-000000000000' },
      { tenant },
    );
    expect(r.error).toMatch(/appointment_id não encontrado/);
  });

  it('marca status=cancelled e deleta evento Google', async () => {
    const r = await cancel.execute({ appointment_id: appt.id, reason: 'doente' }, { tenant });
    expect(r.status).toBe('cancelled');
    expect(r.reason).toBe('doente');

    expect(gcal.deleteEvent).toHaveBeenCalledWith(tenant.id, 'gcal-evt-1');

    const row = await pool.query(`SELECT status FROM appointments WHERE id = $1`, [appt.id]);
    expect(row.rows[0].status).toBe('cancelled');
  });

  it('tolera erro 404/410 do Google (evento já removido)', async () => {
    gcal.deleteEvent.mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 410 }));
    const r = await cancel.execute({ appointment_id: appt.id }, { tenant });
    expect(r.status).toBe('cancelled');
  });

  it('propaga erro Google quando não é 404/410', async () => {
    gcal.deleteEvent.mockRejectedValueOnce(Object.assign(new Error('500'), { code: 500 }));
    await expect(
      cancel.execute({ appointment_id: appt.id }, { tenant }),
    ).rejects.toThrow();
  });
});
