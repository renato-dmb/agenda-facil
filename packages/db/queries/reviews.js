const { getPool } = require('../pool');

async function upsert({
  tenantId,
  appointmentId,
  customerId,
  score,
  comment,
  wantsReturn,
  returnIntervalDays,
}) {
  const { rows } = await getPool().query(
    `INSERT INTO appointment_reviews
       (tenant_id, appointment_id, customer_id, score, comment, wants_return, return_interval_days)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (appointment_id) DO UPDATE SET
       score = EXCLUDED.score,
       comment = COALESCE(EXCLUDED.comment, appointment_reviews.comment),
       wants_return = EXCLUDED.wants_return,
       return_interval_days = EXCLUDED.return_interval_days
     RETURNING *`,
    [
      tenantId,
      appointmentId,
      customerId,
      score,
      comment || null,
      typeof wantsReturn === 'boolean' ? wantsReturn : null,
      typeof returnIntervalDays === 'number' ? returnIntervalDays : null,
    ],
  );
  return rows[0];
}

async function getByAppointment(appointmentId) {
  const { rows } = await getPool().query(
    `SELECT * FROM appointment_reviews WHERE appointment_id = $1`,
    [appointmentId],
  );
  return rows[0] || null;
}

async function listByTenant(tenantId, { limit = 100 } = {}) {
  const { rows } = await getPool().query(
    `SELECT r.*, c.name AS customer_name
     FROM appointment_reviews r
     LEFT JOIN customers c ON c.id = r.customer_id
     WHERE r.tenant_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [tenantId, limit],
  );
  return rows;
}

async function aggregates(tenantId, { sinceDays = 90 } = {}) {
  const { rows } = await getPool().query(
    `SELECT
       COUNT(*)::int AS total,
       ROUND(AVG(score)::numeric, 2) AS avg_score,
       COUNT(*) FILTER (WHERE score >= 4)::int AS positives,
       COUNT(*) FILTER (WHERE wants_return = true)::int AS wants_return_count
     FROM appointment_reviews
     WHERE tenant_id = $1 AND created_at > NOW() - ($2 || ' days')::interval`,
    [tenantId, String(sinceDays)],
  );
  return rows[0];
}

module.exports = { upsert, getByAppointment, listByTenant, aggregates };
