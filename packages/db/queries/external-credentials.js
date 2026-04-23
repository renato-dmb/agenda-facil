const { getPool } = require('../pool');

async function get(tenantId, provider) {
  const { rows } = await getPool().query(
    `SELECT config FROM external_credentials WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider],
  );
  return rows[0]?.config || null;
}

async function upsert(tenantId, provider, config) {
  await getPool().query(
    `INSERT INTO external_credentials (tenant_id, provider, config)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (tenant_id, provider) DO UPDATE SET
       config = $3::jsonb,
       updated_at = NOW()`,
    [tenantId, provider, JSON.stringify(config || {})],
  );
}

async function remove(tenantId, provider) {
  await getPool().query(
    `DELETE FROM external_credentials WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider],
  );
}

module.exports = { get, upsert, remove };
