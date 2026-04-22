const { getPool } = require('../pool');

async function create({ tenantId, phone, codeHash, expiresAt }) {
  const { rows } = await getPool().query(
    `INSERT INTO auth_codes (tenant_id, phone, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tenantId, phone, codeHash, expiresAt],
  );
  return rows[0];
}

async function findActive(phoneVariants) {
  if (!phoneVariants || phoneVariants.length === 0) return null;
  const { rows } = await getPool().query(
    `SELECT * FROM auth_codes
     WHERE phone = ANY($1::text[])
       AND used_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [phoneVariants],
  );
  return rows[0] || null;
}

async function incrementAttempts(id) {
  await getPool().query(`UPDATE auth_codes SET attempts = attempts + 1 WHERE id = $1`, [id]);
}

async function markUsed(id) {
  await getPool().query(`UPDATE auth_codes SET used_at = NOW() WHERE id = $1`, [id]);
}

async function countRecentByPhone(phoneVariants, windowMinutes = 10) {
  if (!phoneVariants || phoneVariants.length === 0) return 0;
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS n FROM auth_codes
     WHERE phone = ANY($1::text[])
       AND created_at > NOW() - ($2 || ' minutes')::interval`,
    [phoneVariants, String(windowMinutes)],
  );
  return rows[0]?.n || 0;
}

async function cleanupExpired() {
  const { rowCount } = await getPool().query(
    `DELETE FROM auth_codes WHERE expires_at < NOW() - INTERVAL '1 hour'`,
  );
  return rowCount;
}

module.exports = {
  create,
  findActive,
  incrementAttempts,
  markUsed,
  countRecentByPhone,
  cleanupExpired,
};
