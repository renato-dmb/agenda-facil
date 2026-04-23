import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import pkg from '../../index.js';
const { testHelpers, appointments, customers } = pkg;

let pool;
let tenantId;
let customer;

beforeAll(async () => {
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  const t = await testHelpers.seedTenant(pool);
  tenantId = t.id;
  customer = await customers.upsertByPhone(tenantId, '5511987654321', { name: 'Cliente' });
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('queries/appointments', () => {
  it('create insere com defaults', async () => {
    const a = await appointments.create({
      tenantId,
      customerId: customer.id,
      startsAt: '2026-04-25T13:00:00Z',
      endsAt: '2026-04-25T13:30:00Z',
    });
    expect(a.status).toBe('confirmed');
    expect(a.tenant_id).toBe(tenantId);
    expect(a.customer_id).toBe(customer.id);
    expect(a.google_event_id).toBeNull();
  });

  it('getById retorna appointment apenas se tenant bate (isolamento multi-tenant)', async () => {
    const a = await appointments.create({
      tenantId,
      customerId: customer.id,
      startsAt: '2026-04-25T13:00:00Z',
      endsAt: '2026-04-25T13:30:00Z',
    });
    const found = await appointments.getById(tenantId, a.id);
    expect(found.id).toBe(a.id);

    const outro = await testHelpers.seedTenant(pool, { slug: 'outro' });
    expect(await appointments.getById(outro.id, a.id)).toBe(null);
  });

  it('updateTimes atualiza starts_at e ends_at', async () => {
    const a = await appointments.create({
      tenantId,
      customerId: customer.id,
      startsAt: '2026-04-25T13:00:00Z',
      endsAt: '2026-04-25T13:30:00Z',
    });
    await appointments.updateTimes(a.id, '2026-04-26T14:00:00Z', '2026-04-26T14:30:00Z');
    const r = await appointments.getById(tenantId, a.id);
    expect(r.starts_at.toISOString()).toBe('2026-04-26T14:00:00.000Z');
    expect(r.ends_at.toISOString()).toBe('2026-04-26T14:30:00.000Z');
  });

  it('setStatus muda status', async () => {
    const a = await appointments.create({
      tenantId,
      customerId: customer.id,
      startsAt: '2026-04-25T13:00:00Z',
      endsAt: '2026-04-25T13:30:00Z',
    });
    await appointments.setStatus(a.id, 'cancelled');
    const r = await appointments.getById(tenantId, a.id);
    expect(r.status).toBe('cancelled');
  });

  it('listUpcomingBetween filtra por janela e status confirmed', async () => {
    await appointments.create({
      tenantId,
      customerId: customer.id,
      startsAt: '2026-04-25T13:00:00Z',
      endsAt: '2026-04-25T13:30:00Z',
    });
    const cancelled = await appointments.create({
      tenantId,
      customerId: customer.id,
      startsAt: '2026-04-25T14:00:00Z',
      endsAt: '2026-04-25T14:30:00Z',
    });
    await appointments.setStatus(cancelled.id, 'cancelled');
    await appointments.create({
      tenantId,
      customerId: customer.id,
      startsAt: '2026-05-01T13:00:00Z',
      endsAt: '2026-05-01T13:30:00Z',
    });

    const r = await appointments.listUpcomingBetween(
      tenantId,
      '2026-04-25T00:00:00Z',
      '2026-04-26T00:00:00Z',
    );
    expect(r.length).toBe(1);
    expect(r[0].status).toBe('confirmed');
  });

  it('listByCustomer ordena por starts_at DESC', async () => {
    await appointments.create({
      tenantId,
      customerId: customer.id,
      startsAt: '2026-04-25T13:00:00Z',
      endsAt: '2026-04-25T13:30:00Z',
    });
    await appointments.create({
      tenantId,
      customerId: customer.id,
      startsAt: '2026-05-01T13:00:00Z',
      endsAt: '2026-05-01T13:30:00Z',
    });
    const r = await appointments.listByCustomer(tenantId, customer.id);
    expect(r[0].starts_at.toISOString()).toBe('2026-05-01T13:00:00.000Z');
    expect(r[1].starts_at.toISOString()).toBe('2026-04-25T13:00:00.000Z');
  });

  it('getDetailed traz customer_name e customer_phone', async () => {
    const a = await appointments.create({
      tenantId,
      customerId: customer.id,
      startsAt: '2026-04-25T13:00:00Z',
      endsAt: '2026-04-25T13:30:00Z',
    });
    const r = await appointments.getDetailed(tenantId, a.id);
    expect(r.customer_name).toBe('Cliente');
    expect(r.customer_phone).toBe('5511987654321');
  });
});
