const { getPool } = require('../pool');

const SECTIONS = ['services', 'hours', 'policies', 'faq', 'tone'];

async function listByTenant(tenantId) {
  const { rows } = await getPool().query(
    `SELECT section, content, updated_at FROM knowledge_sections WHERE tenant_id = $1`,
    [tenantId],
  );
  return rows;
}

async function upsertSection(tenantId, section, content) {
  if (!SECTIONS.includes(section)) throw new Error(`invalid_section: ${section}`);
  await getPool().query(
    `INSERT INTO knowledge_sections (tenant_id, section, content, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (tenant_id, section) DO UPDATE SET
       content = EXCLUDED.content, updated_at = NOW()`,
    [tenantId, section, content || ''],
  );
}

module.exports = { listByTenant, upsertSection, SECTIONS };
