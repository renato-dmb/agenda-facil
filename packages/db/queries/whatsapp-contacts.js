const { getPool } = require('../pool');

function pickDisplayName(row) {
  return row.push_name || row.verified_name || row.notify_name || null;
}

async function upsertMany(tenantId, contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return 0;
  const pool = getPool();
  const client = await pool.connect();
  let n = 0;
  try {
    await client.query('BEGIN');
    for (const c of contacts) {
      if (!c?.jid) continue;
      await client.query(
        `INSERT INTO whatsapp_contacts
           (tenant_id, jid, phone, push_name, verified_name, notify_name, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (tenant_id, jid) DO UPDATE SET
           phone = COALESCE(EXCLUDED.phone, whatsapp_contacts.phone),
           push_name = COALESCE(EXCLUDED.push_name, whatsapp_contacts.push_name),
           verified_name = COALESCE(EXCLUDED.verified_name, whatsapp_contacts.verified_name),
           notify_name = COALESCE(EXCLUDED.notify_name, whatsapp_contacts.notify_name),
           updated_at = NOW()`,
        [
          tenantId,
          c.jid,
          c.phone || null,
          c.push_name || null,
          c.verified_name || null,
          c.notify_name || null,
        ],
      );
      n += 1;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return n;
}

async function listByTenant(tenantId, { limit = 500, search } = {}) {
  const params = [tenantId];
  let where = 'WHERE tenant_id = $1';
  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (
      push_name ILIKE $${params.length}
      OR verified_name ILIKE $${params.length}
      OR notify_name ILIKE $${params.length}
      OR phone ILIKE $${params.length}
    )`;
  }
  params.push(limit);
  const { rows } = await getPool().query(
    `SELECT * FROM whatsapp_contacts ${where}
     ORDER BY COALESCE(push_name, verified_name, notify_name, phone)
     LIMIT $${params.length}`,
    params,
  );
  return rows.map((r) => ({ ...r, display_name: pickDisplayName(r) }));
}

async function countByTenant(tenantId) {
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS n FROM whatsapp_contacts WHERE tenant_id = $1`,
    [tenantId],
  );
  return rows[0]?.n || 0;
}

module.exports = { upsertMany, listByTenant, countByTenant, pickDisplayName };
