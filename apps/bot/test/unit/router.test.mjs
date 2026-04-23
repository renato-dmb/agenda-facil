import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../helpers/cjs-loader.mjs';

const routerRequire = requireFromSrc('router.js');
const wa = routerRequire('./whatsapp/baileys-manager');
const lidModule = routerRequire('./utils/lid');
const router = routerRequire('./router');

let pool;
let tenant;
let testHelpers;

// Helper pra montar msg falsa no formato Baileys
function fakeMsg({ chatJid, text, audio = false, id = null }) {
  // os módulos wa.getChatJid/getMessageText/isAudioMessage/getMessageId são mockados
  // logo abaixo, não precisa estrutura real.
  return { __chatJid: chatJid, __text: text, __audio: audio, __id: id };
}

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool, { slug: 'rt' });
  await pool.query(`UPDATE tenants SET owner_phone = $1 WHERE id = $2`, [
    '5511987654321',
    tenant.id,
  ]);

  wa.getChatJid = vi.fn((m) => m.__chatJid);
  wa.getMessageText = vi.fn((m) => m.__text);
  wa.isAudioMessage = vi.fn((m) => m.__audio);
  wa.getMessageId = vi.fn((m) => m.__id);
  lidModule.resolveLidToPhone = vi.fn().mockReturnValue(null);
});

afterAll(async () => {
  if (pool) await pool.end();
});

async function reloadTenantWithSettings() {
  const dbPkg = await import('@agenda-facil/db');
  return dbPkg.default.tenants.getById(tenant.id);
}

describe('router.route', () => {
  it('ignora mensagem sem texto e sem áudio', async () => {
    const msg = fakeMsg({ chatJid: '5511900000001@s.whatsapp.net', text: null });
    const r = await router.route(msg, { tenantId: tenant.id, tenant });
    expect(r.mode).toBe('ignore');
  });

  it('ignora mensagem de grupo', async () => {
    const msg = fakeMsg({ chatJid: '120363123@g.us', text: 'oi', id: 'm1' });
    const r = await router.route(msg, { tenantId: tenant.id, tenant });
    expect(r.mode).toBe('ignore');
  });

  it('deduplica mensagem já vista', async () => {
    const msg = fakeMsg({ chatJid: '5511900000001@s.whatsapp.net', text: 'oi', id: 'dup' });
    await pool.query(
      `INSERT INTO message_log (tenant_id, wa_message_id, phone, direction, body)
       VALUES ($1, 'dup', '5511900000001', 'in', 'oi')`,
      [tenant.id],
    );
    const r = await router.route(msg, { tenantId: tenant.id, tenant });
    expect(r.mode).toBe('duplicate');
  });

  it('owner com /comando vira admin mesmo com ai_active=false', async () => {
    await pool.query(
      `UPDATE tenant_settings SET ai_active = false WHERE tenant_id = $1`,
      [tenant.id],
    );
    const t = await reloadTenantWithSettings();
    const msg = fakeMsg({
      chatJid: '5511987654321@s.whatsapp.net',
      text: '/status',
      id: 'm-admin',
    });
    const r = await router.route(msg, { tenantId: tenant.id, tenant: t });
    expect(r.mode).toBe('admin');
    expect(r.phone).toBe('5511987654321');
    expect(r.text).toBe('/status');
  });

  it('owner com msg normal NÃO vira admin (mesmo sendo owner)', async () => {
    const msg = fakeMsg({
      chatJid: '5511987654321@s.whatsapp.net',
      text: 'oi tudo bem?',
      id: 'm-owner',
    });
    const t = await reloadTenantWithSettings();
    const r = await router.route(msg, { tenantId: tenant.id, tenant: t });
    expect(r.mode).toBe('guest'); // owner que manda mensagem comum cai como guest (pode testar bot)
  });

  it('não-owner com /comando vira guest normal (comando ignorado)', async () => {
    const msg = fakeMsg({
      chatJid: '5511900000099@s.whatsapp.net',
      text: '/pausar',
      id: 'm-impersonate',
    });
    const t = await reloadTenantWithSettings();
    const r = await router.route(msg, { tenantId: tenant.id, tenant: t });
    expect(r.mode).not.toBe('admin');
  });

  it('ai_active=false retorna paused pra guest', async () => {
    await pool.query(
      `UPDATE tenant_settings SET ai_active = false WHERE tenant_id = $1`,
      [tenant.id],
    );
    const t = await reloadTenantWithSettings();
    const msg = fakeMsg({
      chatJid: '5511900000001@s.whatsapp.net',
      text: 'oi',
      id: 'm-paused',
    });
    const r = await router.route(msg, { tenantId: tenant.id, tenant: t });
    expect(r.mode).toBe('paused');
    expect(r.phone).toBe('5511900000001');
  });

  it('audience_mode=public + número NA contact_list = bypass', async () => {
    await pool.query(`UPDATE tenants SET audience_mode = 'public' WHERE id = $1`, [tenant.id]);
    await pool.query(
      `INSERT INTO contact_list (tenant_id, phone) VALUES ($1, '5511900000001')`,
      [tenant.id],
    );
    const t = await reloadTenantWithSettings();
    const msg = fakeMsg({
      chatJid: '5511900000001@s.whatsapp.net',
      text: 'oi',
      id: 'm-pub-bl',
    });
    const r = await router.route(msg, { tenantId: tenant.id, tenant: t });
    expect(r.mode).toBe('bypass');
  });

  it('audience_mode=public + número NÃO na lista = guest', async () => {
    await pool.query(`UPDATE tenants SET audience_mode = 'public' WHERE id = $1`, [tenant.id]);
    const t = await reloadTenantWithSettings();
    const msg = fakeMsg({
      chatJid: '5511900000001@s.whatsapp.net',
      text: 'oi',
      id: 'm-pub-free',
    });
    const r = await router.route(msg, { tenantId: tenant.id, tenant: t });
    expect(r.mode).toBe('guest');
  });

  it('audience_mode=private + número NÃO na lista = bypass', async () => {
    await pool.query(`UPDATE tenants SET audience_mode = 'private' WHERE id = $1`, [tenant.id]);
    const t = await reloadTenantWithSettings();
    const msg = fakeMsg({
      chatJid: '5511900000001@s.whatsapp.net',
      text: 'oi',
      id: 'm-priv-out',
    });
    const r = await router.route(msg, { tenantId: tenant.id, tenant: t });
    expect(r.mode).toBe('bypass');
  });

  it('audience_mode=private + número NA lista = guest', async () => {
    await pool.query(`UPDATE tenants SET audience_mode = 'private' WHERE id = $1`, [tenant.id]);
    await pool.query(
      `INSERT INTO contact_list (tenant_id, phone) VALUES ($1, '5511900000001')`,
      [tenant.id],
    );
    const t = await reloadTenantWithSettings();
    const msg = fakeMsg({
      chatJid: '5511900000001@s.whatsapp.net',
      text: 'oi',
      id: 'm-priv-in',
    });
    const r = await router.route(msg, { tenantId: tenant.id, tenant: t });
    expect(r.mode).toBe('guest');
  });

  it('conversation escalated = silenced + loga msg', async () => {
    const t = await reloadTenantWithSettings();
    await pool.query(
      `INSERT INTO conversations (tenant_id, phone, state) VALUES ($1, '5511900000001', 'escalated')`,
      [tenant.id],
    );
    const msg = fakeMsg({
      chatJid: '5511900000001@s.whatsapp.net',
      text: 'oi escalated',
      id: 'm-escalated',
    });
    const r = await router.route(msg, { tenantId: tenant.id, tenant: t });
    expect(r.mode).toBe('silenced');
    expect(r.state).toBe('escalated');

    const log = await pool.query(
      `SELECT * FROM message_log WHERE tenant_id = $1 AND wa_message_id = 'm-escalated'`,
      [tenant.id],
    );
    expect(log.rowCount).toBe(1);
    expect(log.rows[0].direction).toBe('in');
  });

  it('conversation paused = silenced', async () => {
    const t = await reloadTenantWithSettings();
    await pool.query(
      `INSERT INTO conversations (tenant_id, phone, state) VALUES ($1, '5511900000001', 'paused')`,
      [tenant.id],
    );
    const msg = fakeMsg({
      chatJid: '5511900000001@s.whatsapp.net',
      text: 'msg qualquer',
      id: 'm-convpaused',
    });
    const r = await router.route(msg, { tenantId: tenant.id, tenant: t });
    expect(r.mode).toBe('silenced');
    expect(r.state).toBe('paused');
  });
});
