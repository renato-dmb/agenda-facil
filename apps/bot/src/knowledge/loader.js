const fs = require('fs');
const path = require('path');
const { knowledge, tenants } = require('@agenda-facil/db');

const TENANTS_ROOT = path.join(__dirname, '..', '..', 'tenants');
const cache = new Map();

// Lê dos arquivos locais (fallback usado quando o tenant ainda não editou a KB
// pelo dashboard — o conteúdo bundled em tenants/{slug}/*.md serve como seed).
function loadFromFilesystem(slug) {
  const dir = path.join(TENANTS_ROOT, slug);
  if (!fs.existsSync(dir)) return '';
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort();
  const blocks = [];
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8').trim();
    if (!content) continue;
    blocks.push(`### ${f.replace(/\.md$/, '')}\n\n${content}`);
  }
  return blocks.join('\n\n---\n\n');
}

// Compila as seções editadas no DB em um único bloco markdown.
function sectionsToMarkdown(rows) {
  const ordered = ['services', 'hours', 'policies', 'faq', 'tone'];
  const map = new Map(rows.map((r) => [r.section, r.content]));
  const blocks = [];
  for (const s of ordered) {
    const content = (map.get(s) || '').trim();
    if (!content) continue;
    blocks.push(`### ${s}\n\n${content}`);
  }
  return blocks.join('\n\n---\n\n');
}

async function loadKnowledge(slug) {
  if (cache.has(slug)) return cache.get(slug);

  let content = '';
  try {
    const tenant = await tenants.getBySlug(slug);
    if (tenant) {
      const rows = await knowledge.listByTenant(tenant.id);
      if (rows.length > 0) {
        content = sectionsToMarkdown(rows);
      }
    }
  } catch (err) {
    console.error(`[knowledge:${slug}] DB read failed, falling back to filesystem:`, err.message);
  }

  if (!content) {
    content = loadFromFilesystem(slug);
  }
  cache.set(slug, content);
  return content;
}

function invalidate(slug) {
  if (slug) cache.delete(slug);
  else cache.clear();
}

module.exports = { loadKnowledge, invalidate, TENANTS_ROOT };
