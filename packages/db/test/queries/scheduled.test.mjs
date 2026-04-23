import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import pkg from '../../index.js';
const { testHelpers, scheduled } = pkg;

let pool;
let tenant;
let customer;
let serviceId;
let apptId;
let msgId;

beforeAll(async () => {
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool);
  customer = await testHelpers.seedCustomer(pool, tenant.id, {
    phone: '5511900000001',
    name: 'Cliente',
  });

  const svc = await pool.query(
    `INSERT INTO services (tenant_id, name, duration_minutes) VALUES ($1, 'Corte', 30) RETURNING *`,
    [tenant.id],
  );
  serviceId = svc.rows[0].id;

  const appt = await pool.query(
    `INSERT INTO appointments (tenant_id, customer_id, service_id, starts_at, ends_at, status)
     VALUES ($1, $2, $3, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '30 min', 'confirmed')
     RETURNING id`,
    [tenant.id, customer.id, serviceId],
  );
  apptId = appt.rows[0].id;

  const msg = await pool.query(
    `INSERT INTO scheduled_messages
       (tenant_id, name, trigger_type, offset_minutes, send_hour, content_type, content, active)
     VALUES ($1, 'pre', 'pre_appointment', -1440, '09:00', 'template', 'oi', true)
     RETURNING id`,
    [tenant.id],
  );
  msgId = msg.rows[0].id;
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('queries/scheduled', () => {
  describe('enqueueForCustomer — recurrence (sem appointment_id)', () => {
    it('insere novo job', async () => {
      const sendAt = new Date(Date.now() + 60000).toISOString();
      const r = await scheduled.enqueueForCustomer({
        tenantId: tenant.id,
        scheduledMessageId: msgId,
        customerId: customer.id,
        phone: customer.phone,
        sendAt,
      });
      expect(r).toBeTruthy();
      expect(r.sent).toBe(false);
    });

    it('UNIQUE por cycle_day — segundo insert no mesmo dia retorna null', async () => {
      const sendAt = new Date(Date.now() + 60000).toISOString();
      const r1 = await scheduled.enqueueForCustomer({
        tenantId: tenant.id,
        scheduledMessageId: msgId,
        customerId: customer.id,
        phone: customer.phone,
        sendAt,
      });
      const r2 = await scheduled.enqueueForCustomer({
        tenantId: tenant.id,
        scheduledMessageId: msgId,
        customerId: customer.id,
        phone: customer.phone,
        sendAt,
      });
      expect(r1).toBeTruthy();
      expect(r2).toBeNull();
    });
  });

  describe('upsertAppointmentReminder', () => {
    it('insere primeira vez', async () => {
      const sendAt = new Date(Date.now() + 60_000).toISOString();
      const r = await scheduled.upsertAppointmentReminder({
        tenantId: tenant.id,
        scheduledMessageId: msgId,
        appointmentId: apptId,
        customerId: customer.id,
        phone: customer.phone,
        sendAt,
      });
      expect(r).toBeTruthy();
      expect(r.sent).toBe(false);
    });

    it('atualiza send_at quando já existe e sent=false', async () => {
      const t0 = new Date(Date.now() + 60_000).toISOString();
      await scheduled.upsertAppointmentReminder({
        tenantId: tenant.id,
        scheduledMessageId: msgId,
        appointmentId: apptId,
        customerId: customer.id,
        phone: customer.phone,
        sendAt: t0,
      });
      const t1 = new Date(Date.now() + 120_000).toISOString();
      const r = await scheduled.upsertAppointmentReminder({
        tenantId: tenant.id,
        scheduledMessageId: msgId,
        appointmentId: apptId,
        customerId: customer.id,
        phone: customer.phone,
        sendAt: t1,
      });
      expect(r.updated).toBe(true);

      const row = await pool.query(
        `SELECT send_at FROM scheduled_message_queue WHERE appointment_id = $1`,
        [apptId],
      );
      expect(row.rows[0].send_at.toISOString()).toBe(new Date(t1).toISOString());
    });

    it('INVARIANTE: NÃO mexe quando sent=true (não re-envia lembrete)', async () => {
      const t0 = new Date(Date.now() - 120_000).toISOString();
      const first = await scheduled.upsertAppointmentReminder({
        tenantId: tenant.id,
        scheduledMessageId: msgId,
        appointmentId: apptId,
        customerId: customer.id,
        phone: customer.phone,
        sendAt: t0,
      });
      await pool.query(
        `UPDATE scheduled_message_queue SET sent = true, sent_at = NOW() WHERE id = $1`,
        [first.id],
      );

      const t1 = new Date(Date.now() + 60_000).toISOString();
      const r = await scheduled.upsertAppointmentReminder({
        tenantId: tenant.id,
        scheduledMessageId: msgId,
        appointmentId: apptId,
        customerId: customer.id,
        phone: customer.phone,
        sendAt: t1,
      });
      expect(r).toBeNull();

      const row = await pool.query(
        `SELECT send_at, sent FROM scheduled_message_queue WHERE id = $1`,
        [first.id],
      );
      expect(row.rows[0].sent).toBe(true);
      expect(row.rows[0].send_at.toISOString()).toBe(new Date(t0).toISOString());
    });
  });

  describe('removeByAppointment', () => {
    it('apaga apenas sent=false (preserva já enviados pra histórico)', async () => {
      // lembrete pre (sent=false)
      const t0 = new Date(Date.now() + 60_000).toISOString();
      const pre = await scheduled.upsertAppointmentReminder({
        tenantId: tenant.id,
        scheduledMessageId: msgId,
        appointmentId: apptId,
        customerId: customer.id,
        phone: customer.phone,
        sendAt: t0,
      });

      // outro lembrete já enviado
      const postMsg = await pool.query(
        `INSERT INTO scheduled_messages
           (tenant_id, name, trigger_type, offset_minutes, send_hour, content_type, content, active)
         VALUES ($1, 'post', 'post_appointment', 120, '09:00', 'template', 'ok', true)
         RETURNING id`,
        [tenant.id],
      );
      const post = await scheduled.upsertAppointmentReminder({
        tenantId: tenant.id,
        scheduledMessageId: postMsg.rows[0].id,
        appointmentId: apptId,
        customerId: customer.id,
        phone: customer.phone,
        sendAt: new Date(Date.now() - 60_000).toISOString(),
      });
      await pool.query(
        `UPDATE scheduled_message_queue SET sent = true, sent_at = NOW() WHERE id = $1`,
        [post.id],
      );

      const removed = await scheduled.removeByAppointment(apptId);
      expect(removed).toBe(1);

      const remaining = await pool.query(
        `SELECT id, sent FROM scheduled_message_queue WHERE appointment_id = $1`,
        [apptId],
      );
      expect(remaining.rowCount).toBe(1); // só o post (sent=true) sobreviveu
      expect(remaining.rows[0].id).toBe(post.id);
    });
  });

  describe('listPending', () => {
    it('retorna só itens com sent=false e send_at <= NOW', async () => {
      // Pronto pra enviar
      const dueAt = new Date(Date.now() - 60_000).toISOString();
      await scheduled.upsertAppointmentReminder({
        tenantId: tenant.id,
        scheduledMessageId: msgId,
        appointmentId: apptId,
        customerId: customer.id,
        phone: customer.phone,
        sendAt: dueAt,
      });
      // Futuro — não deve aparecer
      const futureMsg = await pool.query(
        `INSERT INTO scheduled_messages
           (tenant_id, name, trigger_type, offset_minutes, send_hour, content_type, content, active)
         VALUES ($1, 'future', 'pre_appointment', -720, '09:00', 'template', 'f', true)
         RETURNING id`,
        [tenant.id],
      );
      await scheduled.enqueueForCustomer({
        tenantId: tenant.id,
        scheduledMessageId: futureMsg.rows[0].id,
        customerId: customer.id,
        phone: customer.phone,
        sendAt: new Date(Date.now() + 3600_000).toISOString(),
      });

      const pending = await scheduled.listPending(20);
      expect(pending.length).toBe(1);
      expect(pending[0].message_name).toBe('pre');
      // Verifica JOINs básicos
      expect(pending[0].tenant_slug).toBe(tenant.slug);
      expect(pending[0].appt_status).toBe('confirmed');
      expect(pending[0].appt_service_name).toBe('Corte');
    });

    it('respeita limit', async () => {
      for (let i = 0; i < 3; i += 1) {
        const m = await pool.query(
          `INSERT INTO scheduled_messages
             (tenant_id, name, trigger_type, offset_days, send_hour, content_type, content, active)
           VALUES ($1, $2, 'recurrence_since_last_appointment', 0, '09:00', 'template', 'X', true)
           RETURNING id`,
          [tenant.id, `r${i}`],
        );
        await scheduled.enqueueForCustomer({
          tenantId: tenant.id,
          scheduledMessageId: m.rows[0].id,
          customerId: customer.id,
          phone: customer.phone,
          sendAt: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
        });
      }
      const pending = await scheduled.listPending(2);
      expect(pending.length).toBe(2);
    });
  });
});
