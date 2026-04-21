#!/usr/bin/env node
/**
 * Pareia uma sessão WhatsApp para um tenant via QR code.
 * Uso: node scripts/pair-whatsapp.js <tenant_slug>
 *
 * Mostra QR no terminal; após o profissional escanear com o celular,
 * os credentials são persistidos em auth_state/{slug}/ e o script encerra.
 */
require('dotenv/config');
const qrcode = require('qrcode-terminal');
const { tenants, pool } = require('@agenda-facil/db');
const { connectTenant } = require('../src/whatsapp/baileys-manager');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: pair-whatsapp.js <tenant_slug>');
  process.exit(1);
}

async function main() {
  const tenant = await tenants.getBySlug(slug);
  if (!tenant) {
    console.error(`Tenant "${slug}" not found. Run seed first.`);
    process.exit(1);
  }

  console.log(`Starting pairing for "${slug}"...`);
  console.log('When QR appears: WhatsApp > Settings > Linked Devices > Link a Device');

  let paired = false;
  await connectTenant(tenant, {
    onQr(qr) {
      qrcode.generate(qr, { small: true });
      console.log('\nScan this QR with the professional\'s WhatsApp.');
    },
    onPaired() {
      paired = true;
      console.log(`\n✓ Paired! auth_state saved for "${slug}"`);
      setTimeout(() => pool.getPool().end().finally(() => process.exit(0)), 2000);
    },
  });

  setTimeout(() => {
    if (!paired) {
      console.error('\nTimed out waiting for pairing.');
      process.exit(1);
    }
  }, 300_000);
}

main().catch((err) => {
  console.error('Pair failed:', err);
  process.exit(1);
});
