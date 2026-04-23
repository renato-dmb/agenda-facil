import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import pkg from '../../index.js';
const { testHelpers, messages } = pkg;

let pool;
let tenant;

beforeAll(async () => {
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('queries/messages', () => {
  it('hasMessage retorna false pra id ausente', async () => {
    expect(await messages.hasMessage(tenant.id, null)).toBe(false);
    expect(await messages.hasMessage(tenant.id, 'nao-existe')).toBe(false);
  });

  it('log + hasMessage roundtrip', async () => {
    await messages.log({
      tenantId: tenant.id,
      waMessageId: 'm1',
      phone: '5511900000001',
      direction: 'in',
      body: 'oi',
    });
    expect(await messages.hasMessage(tenant.id, 'm1')).toBe(true);
  });

  it('log é idempotente no (tenant_id, wa_message_id)', async () => {
    await messages.log({
      tenantId: tenant.id,
      waMessageId: 'dup',
      phone: '5511900000001',
      direction: 'in',
      body: 'oi',
    });
    await messages.log({
      tenantId: tenant.id,
      waMessageId: 'dup',
      phone: '5511900000001',
      direction: 'in',
      body: 'oi',
    });
    const rows = await pool.query(
      `SELECT COUNT(*) FROM message_log WHERE tenant_id = $1 AND wa_message_id = $2`,
      [tenant.id, 'dup'],
    );
    expect(Number(rows.rows[0].count)).toBe(1);
  });

  it('log com waMessageId null funciona (mensagens out-bound não têm id)', async () => {
    await messages.log({
      tenantId: tenant.id,
      waMessageId: null,
      phone: '5511900000001',
      direction: 'out',
      body: 'resposta',
    });
    const rows = await pool.query(
      `SELECT COUNT(*) FROM message_log WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(Number(rows.rows[0].count)).toBe(1);
  });

  it('hasInboundSince filtra por direction=in + janela de tempo', async () => {
    // msg antiga
    await pool.query(
      `INSERT INTO message_log (tenant_id, wa_message_id, phone, direction, body, created_at)
       VALUES ($1, 'old', '5511900000001', 'in', 'velha', NOW() - INTERVAL '20 days')`,
      [tenant.id],
    );
    // msg recente out-bound
    await pool.query(
      `INSERT INTO message_log (tenant_id, wa_message_id, phone, direction, body, created_at)
       VALUES ($1, 'out1', '5511900000001', 'out', 'enviada', NOW() - INTERVAL '1 day')`,
      [tenant.id],
    );

    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(await messages.hasInboundSince(tenant.id, '5511900000001', sinceIso)).toBe(false);

    // adiciona inbound recente
    await pool.query(
      `INSERT INTO message_log (tenant_id, wa_message_id, phone, direction, body, created_at)
       VALUES ($1, 'new', '5511900000001', 'in', 'nova', NOW() - INTERVAL '1 day')`,
      [tenant.id],
    );
    expect(await messages.hasInboundSince(tenant.id, '5511900000001', sinceIso)).toBe(true);
  });

  it('listByPhone retorna em ordem cronológica ascendente', async () => {
    for (let i = 0; i < 3; i += 1) {
      await pool.query(
        `INSERT INTO message_log (tenant_id, wa_message_id, phone, direction, body, created_at)
         VALUES ($1, $2, '5511900000001', 'in', $3, NOW() - ($4 || ' minutes')::interval)`,
        [tenant.id, `m${i}`, `msg ${i}`, String(30 - i * 10)],
      );
    }
    const r = await messages.listByPhone(tenant.id, '5511900000001');
    expect(r.length).toBe(3);
    // mais antiga primeiro
    expect(r[0].body).toBe('msg 0');
    expect(r[2].body).toBe('msg 2');
  });
});
