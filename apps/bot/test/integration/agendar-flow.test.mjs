import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../helpers/cjs-loader.mjs';

const toolRequire = requireFromSrc('ai/tools/create-appointment.js');
const gcal = toolRequire('../../integrations/calendar');
const createAppointment = toolRequire('./create-appointment');

let pool;
let tenant;
let service;
let preMsg;
let postMsg;
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

  const svc = await pool.query(
    `INSERT INTO services (tenant_id, name, duration_minutes, active)
     VALUES ($1, 'Corte', 30, true) RETURNING *`,
    [tenant.id],
  );
  service = svc.rows[0];

  // Scheduled messages: pré (24h antes = -1440 min) e pós (2h depois = +120 min)
  const pre = await pool.query(
    `INSERT INTO scheduled_messages
       (tenant_id, name, trigger_type, offset_minutes, send_hour, content_type, content, active)
     VALUES ($1, 'lembrete-24h', 'pre_appointment', -1440, '09:00', 'template',
             'Oi! Amanhã tem horário.', true)
     RETURNING *`,
    [tenant.id],
  );
  preMsg = pre.rows[0];

  const post = await pool.query(
    `INSERT INTO scheduled_messages
       (tenant_id, name, trigger_type, offset_minutes, send_hour, content_type, content, active)
     VALUES ($1, 'csat', 'post_appointment', 120, '09:00', 'template',
             'Como foi o atendimento?', true)
     RETURNING *`,
    [tenant.id],
  );
  postMsg = post.rows[0];

  gcal.createEvent = vi.fn().mockResolvedValue({ id: 'gcal-evt-int' });
  gcal.updateEvent = vi.fn().mockResolvedValue({});
  gcal.deleteEvent = vi.fn().mockResolvedValue(undefined);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('integração: agendar fluxo completo', () => {
  it('cria appointment, customer, evento Google e enfileira pre+post reminders', async () => {
    // Agenda pra 10 dias no futuro (garantindo que pre-24h não está no passado)
    const startIso = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    const result = await createAppointment.execute(
      {
        customer_name: 'Carlos',
        service_id: service.id,
        start_time: startIso,
      },
      { tenant, customerPhone: '5511900000001' },
    );

    expect(result.appointment_id).toBeDefined();
    expect(result.google_event_id).toBe('gcal-evt-int');

    // DB appointments
    const appts = await pool.query(
      `SELECT * FROM appointments WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(appts.rowCount).toBe(1);
    expect(appts.rows[0].customer_id).toBeDefined();
    expect(appts.rows[0].google_event_id).toBe('gcal-evt-int');

    // Customer upsertado
    const customer = await pool.query(
      `SELECT * FROM customers WHERE tenant_id = $1 AND phone = $2`,
      [tenant.id, '5511900000001'],
    );
    expect(customer.rowCount).toBe(1);
    expect(customer.rows[0].name).toBe('Carlos');
    expect(customer.rows[0].last_appointment_at).not.toBeNull();

    // Google foi chamado
    expect(gcal.createEvent).toHaveBeenCalledTimes(1);

    // syncForAppointment roda async (fire-and-forget). Aguarda até 2s.
    await vi.waitFor(
      async () => {
        const q = await pool.query(
          `SELECT * FROM scheduled_message_queue WHERE tenant_id = $1 ORDER BY send_at`,
          [tenant.id],
        );
        expect(q.rowCount).toBe(2);
      },
      { timeout: 2000, interval: 100 },
    );

    // Verifica que pre é 24h antes e post é 2h depois
    const q = await pool.query(
      `SELECT q.send_at, m.trigger_type
       FROM scheduled_message_queue q
       JOIN scheduled_messages m ON m.id = q.scheduled_message_id
       WHERE q.tenant_id = $1
       ORDER BY q.send_at`,
      [tenant.id],
    );
    expect(q.rows.map((r) => r.trigger_type)).toEqual(['pre_appointment', 'post_appointment']);

    const apptStart = new Date(startIso).getTime();
    const apptEnd = apptStart + 30 * 60 * 1000;
    expect(Math.abs(q.rows[0].send_at.getTime() - (apptStart - 24 * 60 * 60 * 1000))).toBeLessThan(
      5000,
    );
    expect(Math.abs(q.rows[1].send_at.getTime() - (apptEnd + 2 * 60 * 60 * 1000))).toBeLessThan(
      5000,
    );
  });
});
