const { getPool } = require('../pool');

async function upsertScheduledMessage(tenantId, { name, trigger_type, offset_days, send_hour, content_type, content, active }) {
  const { rows } = await getPool().query(
    `INSERT INTO scheduled_messages (tenant_id, name, trigger_type, offset_days, send_hour, content_type, content, active)
     VALUES ($1, $2, $3, COALESCE($4, 0), $5, COALESCE($6, 'template'), $7, COALESCE($8, true))
     ON CONFLICT (tenant_id, name) DO UPDATE SET
       trigger_type = EXCLUDED.trigger_type,
       offset_days = EXCLUDED.offset_days,
       send_hour = EXCLUDED.send_hour,
       content_type = EXCLUDED.content_type,
       content = EXCLUDED.content,
       active = EXCLUDED.active
     RETURNING *`,
    [tenantId, name, trigger_type, offset_days, send_hour, content_type, content, active],
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

async function enqueueForCustomer({ tenantId, scheduledMessageId, customerId, phone, sendAt }) {
  try {
    const { rows } = await getPool().query(
      `INSERT INTO scheduled_message_queue
         (tenant_id, scheduled_message_id, customer_id, phone, send_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, scheduledMessageId, customerId, phone, sendAt],
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      return null;
    }
    throw err;
  }
}

async function listPending(limit = 20) {
  const { rows } = await getPool().query(
    `SELECT q.*, m.name AS message_name, m.content, m.content_type, m.trigger_type, t.slug AS tenant_slug, t.timezone AS tenant_tz
     FROM scheduled_message_queue q
     JOIN scheduled_messages m ON m.id = q.scheduled_message_id
     JOIN tenants t ON t.id = q.tenant_id
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
  enqueueForCustomer,
  listPending,
  markSent,
  markRetry,
};
