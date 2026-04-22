const { getPool } = require('../pool');

async function get(tenantId, phone) {
  const { rows } = await getPool().query(
    `SELECT * FROM conversations WHERE tenant_id = $1 AND phone = $2`,
    [tenantId, phone],
  );
  return rows[0] || null;
}

const ALLOWED_COLUMNS = new Set(['state', 'history']);

async function upsert(tenantId, phone, updates = {}) {
  const existing = await get(tenantId, phone);
  if (existing) {
    const sets = [];
    const values = [tenantId, phone];
    let i = 3;
    for (const [key, val] of Object.entries(updates)) {
      if (!ALLOWED_COLUMNS.has(key)) continue;
      sets.push(`${key} = $${i}`);
      values.push(key === 'history' ? JSON.stringify(val) : val);
      i += 1;
    }
    if (sets.length > 0) {
      sets.push('updated_at = NOW()');
      await getPool().query(
        `UPDATE conversations SET ${sets.join(', ')} WHERE tenant_id = $1 AND phone = $2`,
        values,
      );
    }
  } else {
    await getPool().query(
      `INSERT INTO conversations (tenant_id, phone, state, history)
       VALUES ($1, $2, $3, $4)`,
      [
        tenantId,
        phone,
        updates.state || 'ai_active',
        JSON.stringify(updates.history || []),
      ],
    );
  }
  return get(tenantId, phone);
}

async function setState(tenantId, phone, state) {
  await getPool().query(
    `UPDATE conversations SET state = $3, state_changed_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND phone = $2`,
    [tenantId, phone, state],
  );
}

async function listByTenant(tenantId, { limit = 100 } = {}) {
  const { rows } = await getPool().query(
    `SELECT c.*, cust.name AS customer_name
     FROM conversations c
     LEFT JOIN customers cust
       ON cust.tenant_id = c.tenant_id AND cust.phone = c.phone
     WHERE c.tenant_id = $1
     ORDER BY c.updated_at DESC
     LIMIT $2`,
    [tenantId, limit],
  );
  return rows;
}

module.exports = { get, upsert, setState, listByTenant };
