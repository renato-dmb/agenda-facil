import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../helpers/cjs-loader.mjs';

const dispatcherRequire = requireFromSrc('scheduler/dispatcher.js');
const wa = dispatcherRequire('../whatsapp/baileys-manager');
const dispatcher = dispatcherRequire('./dispatcher');

let pool;
let tenant;
let customer;
let testHelpers;

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool, { slug: 'disp' });
  customer = await testHelpers.seedCustomer(pool, tenant.id, {
    phone: '5511999887766',
    name: 'Carlos Silva',
  });
  wa.sendText = vi.fn().mockResolvedValue({ ok: true });
});

afterAll(async () => {
  if (pool) await pool.end();
});

async function insertScheduledMsg(overrides = {}) {
  const d = {
    name: 'msg',
    trigger_type: 'pre_appointment',
    offset_minutes: -1440,
    send_hour: '09:00',
    content_type: 'template',
    content: 'Oi {first_name}, lembrete do seu {service}.',
    active: true,
  };
  const m = { ...d, ...overrides };
  const r = await pool.query(
    `INSERT INTO scheduled_messages
       (tenant_id, name, trigger_type, offset_minutes, send_hour, content_type, content, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      tenant.id,
      m.name,
      m.trigger_type,
      m.offset_minutes,
      m.send_hour,
      m.content_type,
      m.content,
      m.active,
    ],
  );
  return r.rows[0];
}

async function insertAppointment(overrides = {}) {
  const d = {
    starts_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    status: 'confirmed',
    google_event_id: 'evt-x',
  };
  const a = { ...d, ...overrides };
  // service opcional
  let serviceId = a.service_id;
  if (!serviceId && !('service_id' in overrides)) {
    const svc = await pool.query(
      `INSERT INTO services (tenant_id, name, duration_minutes) VALUES ($1, 'Corte', 30) RETURNING *`,
      [tenant.id],
    );
    serviceId = svc.rows[0].id;
  }
  const r = await pool.query(
    `INSERT INTO appointments (tenant_id, customer_id, service_id, starts_at, ends_at, google_event_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [tenant.id, customer.id, serviceId || null, a.starts_at, a.ends_at, a.google_event_id, a.status],
  );
  return r.rows[0];
}

async function enqueue({ scheduledMessageId, appointmentId = null, sendAtIso = null }) {
  const sendAt = sendAtIso || new Date(Date.now() - 60_000).toISOString(); // já venceu
  const cycleDay = sendAt.slice(0, 10);
  const { rows } = await pool.query(
    `INSERT INTO scheduled_message_queue
       (tenant_id, scheduled_message_id, customer_id, phone, send_at, cycle_day, appointment_id)
     VALUES ($1, $2, $3, $4, $5::timestamptz, $6::date, $7) RETURNING *`,
    [tenant.id, scheduledMessageId, customer.id, customer.phone, sendAt, cycleDay, appointmentId],
  );
  return rows[0];
}

describe('integração: scheduler/dispatcher.sendDue', () => {
  it('renderiza template com {first_name} + {service} + {date}', async () => {
    const msg = await insertScheduledMsg({
      content: 'Oi {first_name}! Amanhã ({date}) tem seu {service}.',
    });
    const appt = await insertAppointment();
    await enqueue({ scheduledMessageId: msg.id, appointmentId: appt.id });

    const sent = await dispatcher.sendDue();
    expect(sent).toBe(1);
    expect(wa.sendText).toHaveBeenCalledTimes(1);
    const body = wa.sendText.mock.calls[0][2];
    expect(body).toMatch(/Oi Carlos!/);
    expect(body).toMatch(/Corte/);
    expect(body).toMatch(/\d{2}\/\d{2}/); // data no formato dd/mm
  });

  it('skip quando appointment foi cancelado — marca sent sem enviar', async () => {
    const msg = await insertScheduledMsg();
    const appt = await insertAppointment({ status: 'cancelled' });
    const q = await enqueue({ scheduledMessageId: msg.id, appointmentId: appt.id });

    const sent = await dispatcher.sendDue();
    expect(sent).toBe(0);
    expect(wa.sendText).not.toHaveBeenCalled();

    const row = await pool.query(
      `SELECT sent FROM scheduled_message_queue WHERE id = $1`,
      [q.id],
    );
    expect(row.rows[0].sent).toBe(true);
  });

  it('falha ao enviar NÃO marca sent (permite retry no próximo tick)', async () => {
    wa.sendText.mockRejectedValueOnce(new Error('network down'));
    const msg = await insertScheduledMsg();
    const appt = await insertAppointment();
    const q = await enqueue({ scheduledMessageId: msg.id, appointmentId: appt.id });

    const sent = await dispatcher.sendDue();
    expect(sent).toBe(0);

    const row = await pool.query(
      `SELECT sent FROM scheduled_message_queue WHERE id = $1`,
      [q.id],
    );
    expect(row.rows[0].sent).toBe(false);
  });

  it('post_appointment injeta marker CSAT no histórico da conversation', async () => {
    const msg = await insertScheduledMsg({
      trigger_type: 'post_appointment',
      offset_minutes: 120,
      content: 'Como foi seu {service}? Dá nota de 1 a 5.',
    });
    const appt = await insertAppointment();
    await enqueue({ scheduledMessageId: msg.id, appointmentId: appt.id });

    await dispatcher.sendDue();

    const conv = await pool.query(
      `SELECT history FROM conversations WHERE tenant_id = $1 AND phone = $2`,
      [tenant.id, customer.phone],
    );
    expect(conv.rowCount).toBe(1);
    const history = conv.rows[0].history;
    const markerEntry = history.find(
      (h) => typeof h.content === 'string' && h.content.includes('[SISTEMA: pós-atendimento'),
    );
    expect(markerEntry).toBeDefined();
    expect(markerEntry.content).toContain(`appointment_id=${appt.id}`);
  });

  it('pre_appointment NÃO injeta marker CSAT', async () => {
    const msg = await insertScheduledMsg({ trigger_type: 'pre_appointment' });
    const appt = await insertAppointment();
    await enqueue({ scheduledMessageId: msg.id, appointmentId: appt.id });

    await dispatcher.sendDue();

    const conv = await pool.query(
      `SELECT history FROM conversations WHERE tenant_id = $1 AND phone = $2`,
      [tenant.id, customer.phone],
    );
    // Pode não existir linha, ou existir sem marker
    if (conv.rowCount > 0) {
      const marker = conv.rows[0].history.find(
        (h) => typeof h.content === 'string' && h.content.includes('[SISTEMA:'),
      );
      expect(marker).toBeUndefined();
    }
  });

  it('envio bem-sucedido grava em message_log direction=out', async () => {
    const msg = await insertScheduledMsg();
    const appt = await insertAppointment();
    await enqueue({ scheduledMessageId: msg.id, appointmentId: appt.id });

    await dispatcher.sendDue();

    const log = await pool.query(
      `SELECT * FROM message_log WHERE tenant_id = $1 AND phone = $2`,
      [tenant.id, customer.phone],
    );
    expect(log.rowCount).toBe(1);
    expect(log.rows[0].direction).toBe('out');
  });
});
