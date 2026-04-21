const fs = require('fs');
const path = require('path');

const TENANTS_ROOT = path.join(__dirname, '..', '..', 'tenants');
const cache = new Map();

function loadKnowledgeSync(slug) {
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

async function loadKnowledge(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const content = loadKnowledgeSync(slug);
  cache.set(slug, content);
  return content;
}

function invalidate(slug) {
  if (slug) cache.delete(slug);
  else cache.clear();
}

module.exports = { loadKnowledge, invalidate, TENANTS_ROOT };
