const { getPool } = require('../pool');

async function getBySlug(slug) {
  const { rows } = await getPool().query(
    `SELECT t.*, s.recurrence_enabled, s.recurrence_trigger_days,
            s.recurrence_retry_days, s.recurrence_send_hour, s.ai_active
     FROM tenants t
     LEFT JOIN tenant_settings s ON s.tenant_id = t.id
     WHERE t.slug = $1`,
    [slug],
  );
  return rows[0] || null;
}

async function getById(id) {
  const { rows } = await getPool().query(
    `SELECT t.*, s.recurrence_enabled, s.recurrence_trigger_days,
            s.recurrence_retry_days, s.recurrence_send_hour, s.ai_active
     FROM tenants t
     LEFT JOIN tenant_settings s ON s.tenant_id = t.id
     WHERE t.id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function getByWhatsAppNumber(number) {
  const { rows } = await getPool().query(
    `SELECT t.*, s.recurrence_enabled, s.recurrence_trigger_days,
            s.recurrence_retry_days, s.recurrence_send_hour, s.ai_active
     FROM tenants t
     LEFT JOIN tenant_settings s ON s.tenant_id = t.id
     WHERE t.whatsapp_number = $1`,
    [number],
  );
  return rows[0] || null;
}

async function listActive() {
  const { rows } = await getPool().query(
    `SELECT t.*, s.recurrence_enabled, s.recurrence_trigger_days,
            s.recurrence_retry_days, s.recurrence_send_hour, s.ai_active
     FROM tenants t
     LEFT JOIN tenant_settings s ON s.tenant_id = t.id
     WHERE t.status IN ('active', 'pending')
     ORDER BY t.created_at`,
  );
  return rows;
}

async function upsertTenant({ slug, name, profession_type, timezone, whatsapp_number, status }) {
  const { rows } = await getPool().query(
    `INSERT INTO tenants (slug, name, profession_type, timezone, whatsapp_number, status)
     VALUES ($1, $2, $3, COALESCE($4, 'America/Sao_Paulo'), $5, COALESCE($6, 'pending'))
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       profession_type = EXCLUDED.profession_type,
       timezone = EXCLUDED.timezone,
       whatsapp_number = EXCLUDED.whatsapp_number,
       status = EXCLUDED.status,
       updated_at = NOW()
     RETURNING *`,
    [slug, name, profession_type, timezone, whatsapp_number, status],
  );
  return rows[0];
}

async function upsertSettings(tenantId, settings) {
  const { rows } = await getPool().query(
    `INSERT INTO tenant_settings
       (tenant_id, recurrence_enabled, recurrence_trigger_days, recurrence_retry_days, recurrence_send_hour, ai_active)
     VALUES ($1, COALESCE($2, true), COALESCE($3, 14), COALESCE($4, 7), COALESCE($5, '09:00'), COALESCE($6, true))
     ON CONFLICT (tenant_id) DO UPDATE SET
       recurrence_enabled = EXCLUDED.recurrence_enabled,
       recurrence_trigger_days = EXCLUDED.recurrence_trigger_days,
       recurrence_retry_days = EXCLUDED.recurrence_retry_days,
       recurrence_send_hour = EXCLUDED.recurrence_send_hour,
       ai_active = EXCLUDED.ai_active,
       updated_at = NOW()
     RETURNING *`,
    [
      tenantId,
      settings?.recurrence_enabled,
      settings?.recurrence_trigger_days,
      settings?.recurrence_retry_days,
      settings?.recurrence_send_hour,
      settings?.ai_active,
    ],
  );
  return rows[0];
}

async function setWhatsAppNumber(tenantId, number) {
  await getPool().query(
    `UPDATE tenants SET whatsapp_number = $1, updated_at = NOW() WHERE id = $2`,
    [number, tenantId],
  );
}

async function setStatus(tenantId, status) {
  await getPool().query(`UPDATE tenants SET status = $1, updated_at = NOW() WHERE id = $2`, [
    status,
    tenantId,
  ]);
}

module.exports = {
  getBySlug,
  getById,
  getByWhatsAppNumber,
  listActive,
  upsertTenant,
  upsertSettings,
  setWhatsAppNumber,
  setStatus,
};
