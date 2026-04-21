const fs = require('fs');
const path = require('path');
const { AUTH_ROOT } = require('../whatsapp/session-store');

// Cache por tenant — Baileys cria arquivos lid-mapping-*_reverse.json
// no auth_state do tenant quando encontra uma nova LID.
const caches = new Map();

function getCache(slug) {
  let cache = caches.get(slug);
  if (!cache) {
    cache = new Map();
    caches.set(slug, cache);
  }
  return cache;
}

function resolveLidToPhone(slug, lid) {
  if (!slug || !lid) return null;
  const cache = getCache(slug);
  if (cache.has(lid)) return cache.get(lid);
  const file = path.join(AUTH_ROOT, slug, `lid-mapping-${lid}_reverse.json`);
  try {
    const phone = JSON.parse(fs.readFileSync(file, 'utf8'));
    cache.set(lid, phone);
    return phone;
  } catch {
    return null;
  }
}

function invalidate(slug) {
  if (slug) caches.delete(slug);
  else caches.clear();
}

module.exports = { resolveLidToPhone, invalidate };
