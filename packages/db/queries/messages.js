const { getPool } = require('../pool');

async function hasMessage(tenantId, waMessageId) {
  if (!waMessageId) return false;
  const { rows } = await getPool().query(
    `SELECT 1 FROM message_log WHERE tenant_id = $1 AND wa_message_id = $2`,
    [tenantId, waMessageId],
  );
  return rows.length > 0;
}

async function log({ tenantId, waMessageId, phone, direction, body }) {
  await getPool().query(
    `INSERT INTO message_log (tenant_id, wa_message_id, phone, direction, body)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, wa_message_id) DO NOTHING`,
    [tenantId, waMessageId || null, phone, direction, body || null],
  );
}

async function hasInboundSince(tenantId, phone, sinceIso) {
  const { rows } = await getPool().query(
    `SELECT 1 FROM message_log
     WHERE tenant_id = $1 AND phone = $2 AND direction = 'in' AND created_at > $3
     LIMIT 1`,
    [tenantId, phone, sinceIso],
  );
  return rows.length > 0;
}

module.exports = { hasMessage, log, hasInboundSince };
