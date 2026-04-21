const { getPool } = require('../pool');

async function getByTenantId(tenantId) {
  const { rows } = await getPool().query(
    `SELECT * FROM google_oauth_tokens WHERE tenant_id = $1`,
    [tenantId],
  );
  return rows[0] || null;
}

async function upsert(tenantId, tokens) {
  const { rows } = await getPool().query(
    `INSERT INTO google_oauth_tokens
       (tenant_id, google_account_email, access_token, refresh_token, expires_at, calendar_id, scopes)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'primary'), $7)
     ON CONFLICT (tenant_id) DO UPDATE SET
       google_account_email = COALESCE(EXCLUDED.google_account_email, google_oauth_tokens.google_account_email),
       access_token = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, google_oauth_tokens.refresh_token),
       expires_at = EXCLUDED.expires_at,
       calendar_id = EXCLUDED.calendar_id,
       scopes = EXCLUDED.scopes,
       updated_at = NOW()
     RETURNING *`,
    [
      tenantId,
      tokens.google_account_email || null,
      tokens.access_token || null,
      tokens.refresh_token,
      tokens.expires_at || null,
      tokens.calendar_id,
      tokens.scopes || null,
    ],
  );
  return rows[0];
}

async function updateAccessToken(tenantId, access_token, expires_at) {
  await getPool().query(
    `UPDATE google_oauth_tokens
     SET access_token = $2, expires_at = $3, updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenantId, access_token, expires_at],
  );
}

module.exports = { getByTenantId, upsert, updateAccessToken };
