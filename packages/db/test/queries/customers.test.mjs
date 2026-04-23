import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import pkg from '../../index.js';
const { testHelpers, customers } = pkg;

let pool;
let tenantId;

beforeAll(async () => {
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  const t = await testHelpers.seedTenant(pool);
  tenantId = t.id;
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('queries/customers', () => {
  it('upsertByPhone cria cliente novo', async () => {
    const c = await customers.upsertByPhone(tenantId, '5511987654321', {
      name: 'João',
      email: 'joao@example.com',
    });
    expect(c.phone).toBe('5511987654321');
    expect(c.name).toBe('João');
    expect(c.email).toBe('joao@example.com');
  });

  it('upsertByPhone não sobrescreve name existente com null', async () => {
    await customers.upsertByPhone(tenantId, '5511987654321', { name: 'Original' });
    const r = await customers.upsertByPhone(tenantId, '5511987654321', { name: null });
    expect(r.name).toBe('Original');
  });

  it('upsertByPhone respeita UNIQUE (tenant_id, phone)', async () => {
    await customers.upsertByPhone(tenantId, '5511987654321', { name: 'A' });
    const second = await customers.upsertByPhone(tenantId, '5511987654321', { name: 'B' });
    const list = await pool.query('SELECT COUNT(*) FROM customers WHERE tenant_id = $1', [
      tenantId,
    ]);
    expect(Number(list.rows[0].count)).toBe(1);
    expect(second.name).toBe('B');
  });

  it('mesmo phone em tenants diferentes são clientes distintos', async () => {
    const t2 = await testHelpers.seedTenant(pool, { slug: 'outro' });
    await customers.upsertByPhone(tenantId, '5511987654321', { name: 'T1' });
    await customers.upsertByPhone(t2.id, '5511987654321', { name: 'T2' });
    const r1 = await customers.getByPhone(tenantId, '5511987654321');
    const r2 = await customers.getByPhone(t2.id, '5511987654321');
    expect(r1.name).toBe('T1');
    expect(r2.name).toBe('T2');
    expect(r1.id).not.toBe(r2.id);
  });

  it('updateLastAppointmentAt grava timestamp', async () => {
    const c = await customers.upsertByPhone(tenantId, '5511987654321', { name: 'João' });
    const ts = '2026-04-22T10:00:00Z';
    await customers.updateLastAppointmentAt(c.id, ts);
    const fetched = await customers.getById(tenantId, c.id);
    expect(fetched.last_appointment_at.toISOString()).toBe('2026-04-22T10:00:00.000Z');
  });

  it('listByTenant filtra por search (name ou phone)', async () => {
    await customers.upsertByPhone(tenantId, '5511987654321', { name: 'Jeferson' });
    await customers.upsertByPhone(tenantId, '5511988776655', { name: 'Maria' });
    const found = await customers.listByTenant(tenantId, { search: 'Jef' });
    expect(found.length).toBe(1);
    expect(found[0].name).toBe('Jeferson');
  });

  it('listEligibleForRecurrence respeita trigger_days + filtra quem tem appt futuro', async () => {
    const old = await customers.upsertByPhone(tenantId, '5511900000001', { name: 'Antigo' });
    const recent = await customers.upsertByPhone(tenantId, '5511900000002', { name: 'Recente' });
    const withFuture = await customers.upsertByPhone(tenantId, '5511900000003', {
      name: 'ComFuturo',
    });
    await pool.query(
      `UPDATE customers SET last_appointment_at = NOW() - INTERVAL '20 days' WHERE id = $1`,
      [old.id],
    );
    await pool.query(
      `UPDATE customers SET last_appointment_at = NOW() - INTERVAL '5 days' WHERE id = $1`,
      [recent.id],
    );
    await pool.query(
      `UPDATE customers SET last_appointment_at = NOW() - INTERVAL '20 days' WHERE id = $1`,
      [withFuture.id],
    );
    await pool.query(
      `INSERT INTO appointments (tenant_id, customer_id, starts_at, ends_at, status)
       VALUES ($1, $2, NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '30 minutes', 'confirmed')`,
      [tenantId, withFuture.id],
    );
    const r = await customers.listEligibleForRecurrence(tenantId, 14);
    const ids = r.map((c) => c.id);
    expect(ids).toContain(old.id);
    expect(ids).not.toContain(recent.id);
    expect(ids).not.toContain(withFuture.id);
  });
});
