const fs = require('fs');
const path = require('path');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');

const AUTH_ROOT = path.join(process.cwd(), 'auth_state');

function authDirForTenant(slug) {
  return path.join(AUTH_ROOT, slug);
}

async function loadTenantAuth(slug) {
  const dir = authDirForTenant(slug);
  fs.mkdirSync(dir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const hasCredentials = fs.existsSync(path.join(dir, 'creds.json'));
  return { state, saveCreds, authDir: dir, hasCredentials };
}

module.exports = { authDirForTenant, loadTenantAuth, AUTH_ROOT };
