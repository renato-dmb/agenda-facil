import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { requireFromSrc } from '../helpers/cjs-loader.mjs';

const apiRequire = requireFromSrc('api/dashboard-routes.js');
const wa = apiRequire('../whatsapp/baileys-manager');
const magicCode = apiRequire('../auth/magic-code');
const dashRoutes = apiRequire('./dashboard-routes');
const gcal = apiRequire('../integrations/calendar');
const resolver = apiRequire('../tenancy/resolver');

let app;
let request;
let pool;
let tenant;
let testHelpers;
let validToken;

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();

  app = express();
  app.use(express.json());
  dashRoutes.register(app);
  request = supertest(app);
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool);
  await pool.query(`UPDATE tenants SET owner_phone = $1 WHERE id = $2`, [
    '5511987654321',
    tenant.id,
  ]);

  // Gera token JWT válido via magic-code (mockando wa.sendText pra capturar código)
  wa.sendText = vi.fn().mockResolvedValue({ ok: true });
  wa.markRead = vi.fn().mockResolvedValue(undefined);
  resolver.refreshTenant = vi.fn(async (tenantId) => {
    const dbPkg = await import('@agenda-facil/db');
    return dbPkg.default.tenants.getById(tenantId);
  });

  await magicCode.requestCode({ rawPhone: '5511987654321' });
  const sent = wa.sendText.mock.calls[0][2];
  const code = sent.match(/\*(\d{6})\*/)[1];
  const r = await magicCode.verifyCode({ rawPhone: '5511987654321', code });
  validToken = r.token;
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('dashboard-routes: auth', () => {
  it('GET /api/bot/tenant sem Bearer retorna 401', async () => {
    const r = await request.get('/api/bot/tenant');
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('missing_token');
  });

  it('GET /api/bot/tenant com token inválido retorna 401', async () => {
    const r = await request
      .get('/api/bot/tenant')
      .set('authorization', 'Bearer not-a-real-token');
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('invalid_token');
  });

  it('GET /api/bot/tenant com token válido retorna tenant', async () => {
    const r = await request
      .get('/api/bot/tenant')
      .set('authorization', `Bearer ${validToken}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.tenant.id).toBe(tenant.id);
  });
});

describe('dashboard-routes: POST /api/bot/ai-active', () => {
  it('sem auth = 401', async () => {
    const r = await request.post('/api/bot/ai-active').send({ active: true });
    expect(r.status).toBe(401);
  });

  it('altera ai_active e retorna o novo valor', async () => {
    const r = await request
      .post('/api/bot/ai-active')
      .set('authorization', `Bearer ${validToken}`)
      .send({ active: false });
    expect(r.status).toBe(200);
    expect(r.body.ai_active).toBe(false);

    const dbPkg = await import('@agenda-facil/db');
    const t = await dbPkg.default.tenants.getById(tenant.id);
    expect(t.ai_active).toBe(false);
  });
});

describe('dashboard-routes: POST /api/bot/audience-mode', () => {
  it('rejeita mode inválido', async () => {
    const r = await request
      .post('/api/bot/audience-mode')
      .set('authorization', `Bearer ${validToken}`)
      .send({ mode: 'invalid' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_mode');
  });

  it('aceita private/public e persiste', async () => {
    const r = await request
      .post('/api/bot/audience-mode')
      .set('authorization', `Bearer ${validToken}`)
      .send({ mode: 'private' });
    expect(r.status).toBe(200);
    expect(r.body.audience_mode).toBe('private');
  });
});

describe('dashboard-routes: POST /api/bot/appointments (criar manual)', () => {
  it('sem auth = 401', async () => {
    const r = await request.post('/api/bot/appointments').send({});
    expect(r.status).toBe(401);
  });

  it('cria appointment manual e chama gcal.createEvent', async () => {
    gcal.createEvent = vi.fn().mockResolvedValue({ id: 'evt-manual' });
    const svc = await pool.query(
      `INSERT INTO services (tenant_id, name, duration_minutes) VALUES ($1, 'Corte', 30) RETURNING *`,
      [tenant.id],
    );
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const r = await request
      .post('/api/bot/appointments')
      .set('authorization', `Bearer ${validToken}`)
      .send({
        customer_name: 'Pedro',
        customer_phone: '5511900000001',
        service_id: svc.rows[0].id,
        start_time: future,
      });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    const rows = await pool.query(
      `SELECT * FROM appointments WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(rows.rowCount).toBe(1);
    expect(gcal.createEvent).toHaveBeenCalled();
  });
});

describe('dashboard-routes: POST /api/bot/broadcast', () => {
  it('rejeita texto vazio', async () => {
    const r = await request
      .post('/api/bot/broadcast')
      .set('authorization', `Bearer ${validToken}`)
      .send({ text: '   ' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('empty_text');
  });

  it('com recipients manuais envia e retorna contagem', async () => {
    wa.sendText.mockClear();
    wa.sendText.mockResolvedValue({ ok: true });

    const r = await request
      .post('/api/bot/broadcast')
      .set('authorization', `Bearer ${validToken}`)
      .send({
        text: 'Oferta de teste',
        phones: ['5511900000001', '5511900000002'],
      });
    // O endpoint faz setTimeout 2500ms entre envios — o primeiro retorna,
    // mas o supertest espera a resposta inteira. Timeout default é maior que
    // 2*2500 = 5s, ok.
    expect(r.status).toBe(200);
    expect(r.body.sent + r.body.failed).toBe(2);
  }, 15000);
});

describe('dashboard-routes: GET /api/bot/admin/tenants (requireSuperAdmin)', () => {
  it('rejeita com 403 se não é super_admin', async () => {
    const r = await request
      .get('/api/bot/admin/tenants')
      .set('authorization', `Bearer ${validToken}`);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('forbidden');
  });

  it('aceita se tenant.is_super_admin=true', async () => {
    await pool.query(`UPDATE tenants SET is_super_admin = true WHERE id = $1`, [tenant.id]);
    const r = await request
      .get('/api/bot/admin/tenants')
      .set('authorization', `Bearer ${validToken}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(Array.isArray(r.body.tenants)).toBe(true);
  });
});
