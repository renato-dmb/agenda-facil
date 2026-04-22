const { getPool } = require('../pool');

async function create({
  tenantId,
  customerId,
  serviceId,
  startsAt,
  endsAt,
  googleEventId,
  notes,
}) {
  const { rows } = await getPool().query(
    `INSERT INTO appointments
       (tenant_id, customer_id, service_id, starts_at, ends_at, google_event_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tenantId, customerId, serviceId || null, startsAt, endsAt, googleEventId || null, notes || null],
  );
  return rows[0];
}

async function getById(tenantId, id) {
  const { rows } = await getPool().query(
    `SELECT * FROM appointments WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );
  return rows[0] || null;
}

async function updateTimes(id, startsAt, endsAt) {
  await getPool().query(
    `UPDATE appointments SET starts_at = $2, ends_at = $3, updated_at = NOW() WHERE id = $1`,
    [id, startsAt, endsAt],
  );
}

async function setStatus(id, status) {
  await getPool().query(
    `UPDATE appointments SET status = $2, updated_at = NOW() WHERE id = $1`,
    [id, status],
  );
}

async function listByCustomer(tenantId, customerId) {
  const { rows } = await getPool().query(
    `SELECT * FROM appointments
     WHERE tenant_id = $1 AND customer_id = $2
     ORDER BY starts_at DESC`,
    [tenantId, customerId],
  );
  return rows;
}

async function listUpcomingBetween(tenantId, fromIso, toIso) {
  const { rows } = await getPool().query(
    `SELECT * FROM appointments
     WHERE tenant_id = $1 AND status = 'confirmed'
       AND starts_at >= $2 AND starts_at < $3
     ORDER BY starts_at`,
    [tenantId, fromIso, toIso],
  );
  return rows;
}

async function listByTenant(tenantId, { limit = 200, status } = {}) {
  const params = [tenantId];
  let where = 'WHERE a.tenant_id = $1';
  if (status) {
    params.push(status);
    where += ` AND a.status = $${params.length}`;
  }
  params.push(limit);
  const { rows } = await getPool().query(
    `SELECT a.*, c.name AS customer_name, c.phone AS customer_phone, s.name AS service_name
     FROM appointments a
     LEFT JOIN customers c ON c.id = a.customer_id
     LEFT JOIN services s ON s.id = a.service_id
     ${where}
     ORDER BY a.starts_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

async function getDetailed(tenantId, id) {
  const { rows } = await getPool().query(
    `SELECT a.*, c.name AS customer_name, c.phone AS customer_phone, s.name AS service_name
     FROM appointments a
     LEFT JOIN customers c ON c.id = a.customer_id
     LEFT JOIN services s ON s.id = a.service_id
     WHERE a.tenant_id = $1 AND a.id = $2`,
    [tenantId, id],
  );
  return rows[0] || null;
}

module.exports = {
  create,
  getById,
  updateTimes,
  setStatus,
  listByCustomer,
  listUpcomingBetween,
  listByTenant,
  getDetailed,
};
