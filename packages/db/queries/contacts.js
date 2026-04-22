const { getPool } = require('../pool');

async function listByTenant(tenantId) {
  const { rows } = await getPool().query(
    `SELECT * FROM contact_list WHERE tenant_id = $1 ORDER BY name NULLS LAST, phone`,
    [tenantId],
  );
  return rows;
}

async function isInList(tenantId, phoneVariants) {
  if (!phoneVariants || phoneVariants.length === 0) return false;
  const { rows } = await getPool().query(
    `SELECT 1 FROM contact_list WHERE tenant_id = $1 AND phone = ANY($2::text[]) LIMIT 1`,
    [tenantId, phoneVariants],
  );
  return rows.length > 0;
}

async function add(tenantId, phone, name) {
  const { rows } = await getPool().query(
    `INSERT INTO contact_list (tenant_id, phone, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, contact_list.name)
     RETURNING *`,
    [tenantId, phone, name || null],
  );
  return rows[0];
}

async function remove(tenantId, phoneVariants) {
  const { rowCount } = await getPool().query(
    `DELETE FROM contact_list WHERE tenant_id = $1 AND phone = ANY($2::text[])`,
    [tenantId, phoneVariants],
  );
  return rowCount;
}

async function clear(tenantId) {
  const { rowCount } = await getPool().query(
    `DELETE FROM contact_list WHERE tenant_id = $1`,
    [tenantId],
  );
  return rowCount;
}

module.exports = { listByTenant, isInList, add, remove, clear };
