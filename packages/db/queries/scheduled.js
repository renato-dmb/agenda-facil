const { getPool } = require('../pool');

async function upsertScheduledMessage(tenantId, params) {
  const {
    name,
    trigger_type,
    offset_days,
    offset_minutes,
    send_hour,
    content_type,
    content,
    active,
  } = params;
  const { rows } = await getPool().query(
    `INSERT INTO scheduled_messages
       (tenant_id, name, trigger_type, offset_days, offset_minutes, send_hour, content_type, content, active)
     VALUES ($1, $2, $3, COALESCE($4, 0), $5, $6, COALESCE($7, 'template'), $8, COALESCE($9, true))
     ON CONFLICT (tenant_id, name) DO UPDATE SET
       trigger_type = EXCLUDED.trigger_type,
       offset_days = EXCLUDED.offset_days,
       offset_minutes = EXCLUDED.offset_minutes,
       send_hour = EXCLUDED.send_hour,
       content_type = EXCLUDED.content_type,
       content = EXCLUDED.content,
       active = EXCLUDED.active
     RETURNING *`,
    [
      tenantId,
      name,
      trigger_type,
      offset_days,
      offset_minutes ?? null,
      send_hour || '09:00',
      content_type,
      content,
      active,
    ],
  );
  return rows[0];
}

async function getActiveByTriggerType(tenantId, triggerType) {
  const { rows } = await getPool().query(
    `SELECT * FROM scheduled_messages
     WHERE tenant_id = $1 AND trigger_type = $2 AND active = true`,
    [tenantId, triggerType],
  );
  return rows;
}

async function listByTriggerType(tenantId, triggerType) {
  const { rows } = await getPool().query(
    `SELECT * FROM scheduled_messages WHERE tenant_id = $1 AND trigger_type = $2 ORDER BY name`,
    [tenantId, triggerType],
  );
  return rows;
}

async function listAllMessages(tenantId) {
  const { rows } = await getPool().query(
    `SELECT * FROM scheduled_messages WHERE tenant_id = $1 ORDER BY trigger_type, name`,
    [tenantId],
  );
  return rows;
}

async function enqueueForCustomer({ tenantId, scheduledMessageId, customerId, phone, sendAt, cycleDay }) {
  const cycle = cycleDay || String(sendAt).slice(0, 10);
  try {
    const { rows } = await getPool().query(
      `INSERT INTO scheduled_message_queue
         (tenant_id, scheduled_message_id, customer_id, phone, send_at, cycle_day)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, scheduledMessageId, customerId, phone, sendAt, cycle],
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      return null;
    }
    throw err;
  }
}

async function upsertAppointmentReminder({
  tenantId,
  scheduledMessageId,
  appointmentId,
  customerId,
  phone,
  sendAt,
  cycleDay,
}) {
  const cycle = cycleDay || String(sendAt).slice(0, 10);
  // Primeiro tenta atualizar se já existir entry para este (appointment, message)
  const existing = await getPool().query(
    `SELECT id, sent FROM scheduled_message_queue
     WHERE appointment_id = $1 AND scheduled_message_id = $2`,
    [appointmentId, scheduledMessageId],
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    if (row.sent) {
      // Já enviado — não mexe (evita reenviar)
      return null;
    }
    await getPool().query(
      `UPDATE scheduled_message_queue SET send_at = $1, cycle_day = $2 WHERE id = $3`,
      [sendAt, cycle, row.id],
    );
    return { id: row.id, updated: true };
  }
  const { rows } = await getPool().query(
    `INSERT INTO scheduled_message_queue
       (tenant_id, scheduled_message_id, customer_id, phone, send_at, cycle_day, appointment_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tenantId, scheduledMessageId, customerId, phone, sendAt, cycle, appointmentId],
  );
  return rows[0];
}

async function removeByAppointment(appointmentId) {
  const { rowCount } = await getPool().query(
    `DELETE FROM scheduled_message_queue
     WHERE appointment_id = $1 AND sent = false`,
    [appointmentId],
  );
  return rowCount;
}

async function listPending(limit = 20) {
  const { rows } = await getPool().query(
    `SELECT q.*, m.name AS message_name, m.content, m.content_type, m.trigger_type,
            t.slug AS tenant_slug, t.timezone AS tenant_tz,
            a.starts_at AS appt_starts_at, a.ends_at AS appt_ends_at, a.status AS appt_status,
            s.name AS appt_service_name
     FROM scheduled_message_queue q
     JOIN scheduled_messages m ON m.id = q.scheduled_message_id
     JOIN tenants t ON t.id = q.tenant_id
     LEFT JOIN appointments a ON a.id = q.appointment_id
     LEFT JOIN services s ON s.id = a.service_id
     WHERE q.sent = false AND q.send_at <= NOW()
     ORDER BY q.send_at
     LIMIT $1`,
    [limit],
  );
  return rows;
}

async function markSent(id) {
  await getPool().query(
    `UPDATE scheduled_message_queue SET sent = true, sent_at = NOW() WHERE id = $1`,
    [id],
  );
}

async function markRetry(id) {
  await getPool().query(
    `UPDATE scheduled_message_queue
     SET retry_count = retry_count + 1, last_retry_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

module.exports = {
  upsertScheduledMessage,
  getActiveByTriggerType,
  listByTriggerType,
  listAllMessages,
  enqueueForCustomer,
  upsertAppointmentReminder,
  removeByAppointment,
  listPending,
  markSent,
  markRetry,
};
