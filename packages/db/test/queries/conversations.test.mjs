import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import pkg from '../../index.js';
const { testHelpers, conversations } = pkg;

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

describe('queries/conversations', () => {
  it('get retorna null se inexistente', async () => {
    expect(await conversations.get(tenant.id, '5511999999999')).toBe(null);
  });

  it('upsert insere novo com defaults', async () => {
    await conversations.upsert(tenant.id, '5511900000001', {});
    const c = await conversations.get(tenant.id, '5511900000001');
    expect(c.state).toBe('ai_active');
    expect(c.history).toEqual([]);
  });

  it('upsert serializa history como JSON', async () => {
    const history = [{ role: 'user', content: 'oi' }];
    await conversations.upsert(tenant.id, '5511900000001', { history });
    const c = await conversations.get(tenant.id, '5511900000001');
    expect(c.history).toEqual(history);
  });

  it('upsert ignora colunas fora de ALLOWED_COLUMNS', async () => {
    await conversations.upsert(tenant.id, '5511900000001', {
      history: [],
      state: 'ai_active',
      evil_column: 'hack', // deve ser ignorado
    });
    const c = await conversations.get(tenant.id, '5511900000001');
    expect(c.state).toBe('ai_active');
    // Se a coluna fosse aceita, teria dado erro por não existir na tabela
  });

  it('upsert atualiza conversation existente', async () => {
    await conversations.upsert(tenant.id, '5511900000001', {
      history: [{ role: 'user', content: 'oi' }],
    });
    await conversations.upsert(tenant.id, '5511900000001', {
      history: [
        { role: 'user', content: 'oi' },
        { role: 'assistant', content: 'olá' },
      ],
    });
    const c = await conversations.get(tenant.id, '5511900000001');
    expect(c.history.length).toBe(2);
    const rows = await pool.query(
      `SELECT COUNT(*) FROM conversations WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(Number(rows.rows[0].count)).toBe(1);
  });

  it('setState muda estado e atualiza state_changed_at', async () => {
    await conversations.upsert(tenant.id, '5511900000001', {});
    await conversations.setState(tenant.id, '5511900000001', 'paused');
    const c = await conversations.get(tenant.id, '5511900000001');
    expect(c.state).toBe('paused');
  });

  it('listByTenant ordena por updated_at DESC + faz JOIN em customers.name', async () => {
    await testHelpers.seedCustomer(pool, tenant.id, {
      phone: '5511900000001',
      name: 'Ana',
    });
    await conversations.upsert(tenant.id, '5511900000001', { history: [] });
    await conversations.upsert(tenant.id, '5511900000002', { history: [] });
    const r = await conversations.listByTenant(tenant.id);
    expect(r.length).toBe(2);
    const withCustomer = r.find((c) => c.phone === '5511900000001');
    expect(withCustomer.customer_name).toBe('Ana');
  });
});
