import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../../helpers/cjs-loader.mjs';

const adminRequire = requireFromSrc('handlers/admin-handler.js');
const wa = adminRequire('../whatsapp/baileys-manager');
const resolver = adminRequire('../tenancy/resolver');
const adminHandler = adminRequire('./admin-handler');

let pool;
let tenant;
let testHelpers;
let sentMessages;

async function freshTenant() {
  const dbPkg = await import('@agenda-facil/db');
  return dbPkg.default.tenants.getById(tenant.id);
}

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool);
  await pool.query(`UPDATE tenants SET owner_phone = $1 WHERE id = $2`, [
    '5511987654321',
    tenant.id,
  ]);

  sentMessages = [];
  wa.sendText = vi.fn(async (_tenantId, _jid, text) => {
    sentMessages.push(text);
    return { ok: true };
  });
  wa.markRead = vi.fn().mockResolvedValue(undefined);

  // resolver.refreshTenant precisa retornar o tenant atualizado (lê do DB direto aqui).
  resolver.refreshTenant = vi.fn(async () => await freshTenant());
});

afterAll(async () => {
  if (pool) await pool.end();
});

async function invoke(text) {
  const t = await freshTenant();
  return adminHandler.handle({
    tenantId: tenant.id,
    tenant: t,
    phone: '5511987654321',
    text,
    messageId: `m-${Date.now()}-${Math.random()}`,
    msg: {},
    chatJid: '5511987654321@s.whatsapp.net',
  });
}

describe('admin-handler', () => {
  it('/pausar seta ai_active=false e envia confirmação', async () => {
    await invoke('/pausar');
    const t = await freshTenant();
    expect(t.ai_active).toBe(false);
    expect(sentMessages[0]).toMatch(/pausado/i);
  });

  it('/retomar seta ai_active=true', async () => {
    await pool.query(`UPDATE tenant_settings SET ai_active = false WHERE tenant_id = $1`, [
      tenant.id,
    ]);
    await invoke('/retomar');
    const t = await freshTenant();
    expect(t.ai_active).toBe(true);
    expect(sentMessages[0]).toMatch(/volta|respondendo/i);
  });

  it('/status mostra estado atual', async () => {
    await invoke('/status');
    expect(sentMessages[0]).toMatch(/Bot:/);
    expect(sentMessages[0]).toMatch(/Atendimento:/);
  });

  it('/ajuda lista comandos disponíveis', async () => {
    await invoke('/ajuda');
    expect(sentMessages[0]).toMatch(/pausar/);
    expect(sentMessages[0]).toMatch(/retomar/);
    expect(sentMessages[0]).toMatch(/modo/);
    expect(sentMessages[0]).toMatch(/lista/);
  });

  it('/modo sem arg mostra modo atual', async () => {
    await invoke('/modo');
    expect(sentMessages[0]).toMatch(/[Mm]odo/);
    expect(sentMessages[0]).toMatch(/público|privado/);
  });

  it('/modo privado altera audience_mode', async () => {
    await invoke('/modo privado');
    const t = await freshTenant();
    expect(t.audience_mode).toBe('private');
    expect(sentMessages[0]).toMatch(/privado/i);
  });

  it('/modo publico altera audience_mode', async () => {
    await pool.query(`UPDATE tenants SET audience_mode = 'private' WHERE id = $1`, [tenant.id]);
    await invoke('/modo publico');
    const t = await freshTenant();
    expect(t.audience_mode).toBe('public');
  });

  it('/modo com valor inválido retorna erro + help', async () => {
    await invoke('/modo aleatorio');
    expect(sentMessages[0]).toMatch(/[Mm]odo desconhecido|aleatorio/i);
    const t = await freshTenant();
    expect(t.audience_mode).not.toBe('aleatorio'); // não alterou
  });

  it('/lista sem arg mostra lista (vazia)', async () => {
    await invoke('/lista');
    expect(sentMessages[0]).toMatch(/vazia/i);
  });

  it('/lista add com número válido adiciona', async () => {
    await invoke('/lista add 11999887766 João Silva');
    const rows = await pool.query(
      `SELECT * FROM contact_list WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].phone).toBe('5511999887766');
    expect(rows.rows[0].name).toBe('João Silva');
    expect(sentMessages[0]).toMatch(/Adicionado/i);
  });

  it('/lista add com número inválido não adiciona', async () => {
    await invoke('/lista add xyz');
    const rows = await pool.query(
      `SELECT COUNT(*) FROM contact_list WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(Number(rows.rows[0].count)).toBe(0);
    expect(sentMessages[0]).toMatch(/inválido/i);
  });

  it('/lista remove apaga da lista', async () => {
    await pool.query(
      `INSERT INTO contact_list (tenant_id, phone, name) VALUES ($1, '5511999887766', 'X')`,
      [tenant.id],
    );
    await invoke('/lista remove 11999887766');
    const rows = await pool.query(
      `SELECT COUNT(*) FROM contact_list WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(Number(rows.rows[0].count)).toBe(0);
    expect(sentMessages[0]).toMatch(/Removido/i);
  });

  it('/lista limpar SEM "confirmar" não apaga nada', async () => {
    await pool.query(
      `INSERT INTO contact_list (tenant_id, phone) VALUES ($1, '5511111111111'), ($1, '5511222222222')`,
      [tenant.id],
    );
    await invoke('/lista limpar');
    const rows = await pool.query(
      `SELECT COUNT(*) FROM contact_list WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(Number(rows.rows[0].count)).toBe(2);
    expect(sentMessages[0]).toMatch(/confirmar/i);
  });

  it('/lista limpar confirmar apaga tudo', async () => {
    await pool.query(
      `INSERT INTO contact_list (tenant_id, phone) VALUES ($1, '5511111111111'), ($1, '5511222222222')`,
      [tenant.id],
    );
    await invoke('/lista limpar confirmar');
    const rows = await pool.query(
      `SELECT COUNT(*) FROM contact_list WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(Number(rows.rows[0].count)).toBe(0);
    expect(sentMessages[0]).toMatch(/removido|vazia/i);
  });

  it('comando desconhecido mostra help', async () => {
    await invoke('/xyz123');
    expect(sentMessages[0]).toMatch(/não reconhecido|disponíveis/i);
  });
});
