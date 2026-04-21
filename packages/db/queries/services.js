const { getPool } = require('../pool');

async function listActive(tenantId) {
  const { rows } = await getPool().query(
    `SELECT * FROM services WHERE tenant_id = $1 AND active = true ORDER BY display_order, name`,
    [tenantId],
  );
  return rows;
}

async function getById(tenantId, id) {
  const { rows } = await getPool().query(
    `SELECT * FROM services WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );
  return rows[0] || null;
}

async function upsertByName(tenantId, { name, duration_minutes, price_cents, display_order, active }) {
  const existing = await getPool().query(
    `SELECT id FROM services WHERE tenant_id = $1 AND name = $2`,
    [tenantId, name],
  );
  if (existing.rows[0]) {
    const { rows } = await getPool().query(
      `UPDATE services
       SET duration_minutes = $3, price_cents = $4, display_order = COALESCE($5, display_order), active = COALESCE($6, active)
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [existing.rows[0].id, tenantId, duration_minutes, price_cents || null, display_order, active],
    );
    return rows[0];
  }
  const { rows } = await getPool().query(
    `INSERT INTO services (tenant_id, name, duration_minutes, price_cents, display_order, active)
     VALUES ($1, $2, $3, $4, COALESCE($5, 0), COALESCE($6, true))
     RETURNING *`,
    [tenantId, name, duration_minutes, price_cents || null, display_order, active],
  );
  return rows[0];
}

async function replaceBusinessHours(tenantId, hours) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM business_hours WHERE tenant_id = $1`, [tenantId]);
    for (const h of hours) {
      await client.query(
        `INSERT INTO business_hours (tenant_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4)`,
        [tenantId, h.weekday, h.start_time, h.end_time],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listBusinessHours(tenantId) {
  const { rows } = await getPool().query(
    `SELECT * FROM business_hours WHERE tenant_id = $1 ORDER BY weekday, start_time`,
    [tenantId],
  );
  return rows;
}

module.exports = { listActive, getById, upsertByName, replaceBusinessHours, listBusinessHours };
