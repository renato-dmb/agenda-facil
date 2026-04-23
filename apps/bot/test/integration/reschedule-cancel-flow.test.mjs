import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../helpers/cjs-loader.mjs';

const r1 = requireFromSrc('ai/tools/create-appointment.js');
const r2 = requireFromSrc('ai/tools/reschedule-appointment.js');
const r3 = requireFromSrc('ai/tools/cancel-appointment.js');
const gcal = r1('../../integrations/calendar');
const createAppointment = r1('./create-appointment');
const reschedule = r2('./reschedule-appointment');
const cancel = r3('./cancel-appointment');

let pool;
let tenant;
let service;
let testHelpers;

async function seedSchedMessages() {
  await pool.query(
    `INSERT INTO scheduled_messages
       (tenant_id, name, trigger_type, offset_minutes, send_hour, content_type, content, active)
     VALUES
       ($1, 'pre-24h', 'pre_appointment', -1440, '09:00', 'template', 'amanhã 10h', true),
       ($1, 'csat', 'post_appointment', 120, '09:00', 'template', 'como foi?', true)`,
    [tenant.id],
  );
}

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool);
  const svc = await pool.query(
    `INSERT INTO services (tenant_id, name, duration_minutes) VALUES ($1, 'Corte', 30) RETURNING *`,
    [tenant.id],
  );
  service = svc.rows[0];
  await seedSchedMessages();
  gcal.createEvent = vi.fn().mockResolvedValue({ id: 'evt-1' });
  gcal.updateEvent = vi.fn().mockResolvedValue({ id: 'evt-1' });
  gcal.deleteEvent = vi.fn().mockResolvedValue(undefined);
});

afterAll(async () => {
  if (pool) await pool.end();
});

async function createFutureAppointment(daysAhead = 10) {
  const start = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
  const r = await createAppointment.execute(
    { customer_name: 'Cliente', service_id: service.id, start_time: start },
    { tenant, customerPhone: '5511900000123' },
  );
  // Espera fire-and-forget do syncForAppointment
  await vi.waitFor(async () => {
    const q = await pool.query(
      `SELECT COUNT(*) FROM scheduled_message_queue WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(Number(q.rows[0].count)).toBeGreaterThanOrEqual(2);
  });
  return { appointmentId: r.appointment_id, startIso: start };
}

describe('integração: reagendar fluxo', () => {
  it('ao reagendar, Google e DB refletem o novo horário e lembretes são reenfileirados', async () => {
    const { appointmentId } = await createFutureAppointment(10);
    const originalQueue = await pool.query(
      `SELECT id, send_at FROM scheduled_message_queue WHERE tenant_id = $1 ORDER BY send_at`,
      [tenant.id],
    );

    const newStart = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString();
    await reschedule.execute(
      { appointment_id: appointmentId, new_start_time: newStart },
      { tenant },
    );

    expect(gcal.updateEvent).toHaveBeenCalledTimes(1);

    const appt = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [appointmentId]);
    expect(appt.rows[0].starts_at.toISOString()).toBe(new Date(newStart).toISOString());

    // Reminders devem ter sido atualizados (mesmo id, novo send_at) — fire-and-forget.
    await vi.waitFor(async () => {
      const updated = await pool.query(
        `SELECT id, send_at FROM scheduled_message_queue WHERE tenant_id = $1 ORDER BY send_at`,
        [tenant.id],
      );
      expect(updated.rowCount).toBe(2);
      for (let i = 0; i < updated.rows.length; i += 1) {
        expect(updated.rows[i].send_at.getTime()).not.toBe(
          originalQueue.rows[i].send_at.getTime(),
        );
      }
    });
  });
});

describe('integração: cancelar fluxo', () => {
  it('ao cancelar, status=cancelled no DB, Google chamado, lembretes removidos', async () => {
    const { appointmentId } = await createFutureAppointment(10);
    // garante queue populada antes do cancel
    const before = await pool.query(
      `SELECT COUNT(*) FROM scheduled_message_queue WHERE tenant_id = $1 AND sent = false`,
      [tenant.id],
    );
    expect(Number(before.rows[0].count)).toBe(2);

    await cancel.execute({ appointment_id: appointmentId, reason: 'teste' }, { tenant });

    expect(gcal.deleteEvent).toHaveBeenCalledTimes(1);

    const appt = await pool.query(`SELECT status FROM appointments WHERE id = $1`, [
      appointmentId,
    ]);
    expect(appt.rows[0].status).toBe('cancelled');

    await vi.waitFor(async () => {
      const after = await pool.query(
        `SELECT COUNT(*) FROM scheduled_message_queue WHERE tenant_id = $1 AND sent = false`,
        [tenant.id],
      );
      expect(Number(after.rows[0].count)).toBe(0);
    });
  });
});
