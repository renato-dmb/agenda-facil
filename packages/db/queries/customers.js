const { getPool } = require('../pool');

async function getByPhone(tenantId, phone) {
  const { rows } = await getPool().query(
    `SELECT * FROM customers WHERE tenant_id = $1 AND phone = $2`,
    [tenantId, phone],
  );
  return rows[0] || null;
}

async function upsertByPhone(tenantId, phone, fields = {}) {
  const { rows } = await getPool().query(
    `INSERT INTO customers (tenant_id, phone, name, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, phone) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, customers.name),
       email = COALESCE(EXCLUDED.email, customers.email)
     RETURNING *`,
    [tenantId, phone, fields.name || null, fields.email || null],
  );
  return rows[0];
}

async function updateLastAppointmentAt(customerId, timestamp) {
  await getPool().query(`UPDATE customers SET last_appointment_at = $2 WHERE id = $1`, [
    customerId,
    timestamp,
  ]);
}

async function listByTenant(tenantId, { limit = 500, search } = {}) {
  const params = [tenantId];
  let where = 'WHERE tenant_id = $1';
  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
  }
  params.push(limit);
  const { rows } = await getPool().query(
    `SELECT * FROM customers ${where}
     ORDER BY last_appointment_at DESC NULLS LAST, created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

async function getById(tenantId, id) {
  const { rows } = await getPool().query(
    `SELECT * FROM customers WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );
  return rows[0] || null;
}

async function listEligibleForRecurrence(tenantId, triggerDays) {
  const { rows } = await getPool().query(
    `SELECT c.* FROM customers c
     WHERE c.tenant_id = $1
       AND c.last_appointment_at IS NOT NULL
       AND c.last_appointment_at <= NOW() - ($2 || ' days')::interval
       AND NOT EXISTS (
         SELECT 1 FROM appointments a
         WHERE a.customer_id = c.id AND a.status = 'confirmed' AND a.starts_at > NOW()
       )`,
    [tenantId, String(triggerDays)],
  );
  return rows;
}

module.exports = {
  getByPhone,
  upsertByPhone,
  updateLastAppointmentAt,
  listEligibleForRecurrence,
  listByTenant,
  getById,
};
