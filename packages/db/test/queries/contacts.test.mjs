import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import pkg from '../../index.js';
const { testHelpers, contacts } = pkg;

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

describe('queries/contacts', () => {
  it('isInList retorna false em lista vazia', async () => {
    expect(await contacts.isInList(tenant.id, ['5511900000001'])).toBe(false);
  });

  it('isInList retorna true se qualquer variante está na lista (9-dígitos)', async () => {
    await contacts.add(tenant.id, '5511987654321', 'João');
    // cliente manda do mesmo número (com 9)
    expect(await contacts.isInList(tenant.id, ['5511987654321'])).toBe(true);
    // cliente manda sem o 9 — variante deve bater
    expect(await contacts.isInList(tenant.id, ['551187654321', '5511987654321'])).toBe(true);
  });

  it('isInList é isolado por tenant (multi-tenant safety)', async () => {
    const t2 = await testHelpers.seedTenant(pool, { slug: 'outro' });
    await contacts.add(tenant.id, '5511900000001', 'T1');

    expect(await contacts.isInList(tenant.id, ['5511900000001'])).toBe(true);
    expect(await contacts.isInList(t2.id, ['5511900000001'])).toBe(false);
  });

  it('add com conflito preserva name existente quando novo é null', async () => {
    await contacts.add(tenant.id, '5511987654321', 'Original');
    await contacts.add(tenant.id, '5511987654321', null);
    const rows = await contacts.listByTenant(tenant.id);
    expect(rows[0].name).toBe('Original');
  });

  it('remove aceita array de variantes', async () => {
    await contacts.add(tenant.id, '5511987654321', 'João');
    const count = await contacts.remove(tenant.id, ['5511987654321', '551187654321']);
    expect(count).toBe(1);
    expect(await contacts.listByTenant(tenant.id)).toEqual([]);
  });

  it('clear remove todos do tenant mas preserva outros tenants', async () => {
    const t2 = await testHelpers.seedTenant(pool, { slug: 'clr' });
    await contacts.add(tenant.id, '5511900000001', 'A');
    await contacts.add(tenant.id, '5511900000002', 'B');
    await contacts.add(t2.id, '5511900000003', 'C');

    const removed = await contacts.clear(tenant.id);
    expect(removed).toBe(2);
    expect(await contacts.listByTenant(tenant.id)).toEqual([]);
    const t2List = await contacts.listByTenant(t2.id);
    expect(t2List.length).toBe(1);
  });
});
