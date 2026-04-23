import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import pkg from '../../index.js';
const { testHelpers, reviews } = pkg;

let pool;
let tenant;
let customer;
let apptId;

beforeAll(async () => {
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool);
  customer = await testHelpers.seedCustomer(pool, tenant.id, {
    phone: '5511900000001',
    name: 'Cliente',
  });
  const appt = await pool.query(
    `INSERT INTO appointments (tenant_id, customer_id, starts_at, ends_at, status)
     VALUES ($1, $2, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '30 min', 'completed')
     RETURNING id`,
    [tenant.id, customer.id],
  );
  apptId = appt.rows[0].id;
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('queries/reviews', () => {
  it('upsert insere novo review', async () => {
    const r = await reviews.upsert({
      tenantId: tenant.id,
      appointmentId: apptId,
      customerId: customer.id,
      score: 5,
      comment: 'Adorei!',
      wantsReturn: true,
      returnIntervalDays: 14,
    });
    expect(r.score).toBe(5);
    expect(r.comment).toBe('Adorei!');
    expect(r.wants_return).toBe(true);
    expect(r.return_interval_days).toBe(14);
  });

  it('upsert atualiza review existente pelo appointment_id', async () => {
    await reviews.upsert({
      tenantId: tenant.id,
      appointmentId: apptId,
      customerId: customer.id,
      score: 3,
    });
    const r = await reviews.upsert({
      tenantId: tenant.id,
      appointmentId: apptId,
      customerId: customer.id,
      score: 5,
      comment: 'Melhorou',
    });
    expect(r.score).toBe(5);
    expect(r.comment).toBe('Melhorou');

    const count = await pool.query(
      `SELECT COUNT(*) FROM appointment_reviews WHERE appointment_id = $1`,
      [apptId],
    );
    expect(Number(count.rows[0].count)).toBe(1);
  });

  it('getByAppointment retorna o review', async () => {
    await reviews.upsert({
      tenantId: tenant.id,
      appointmentId: apptId,
      customerId: customer.id,
      score: 4,
    });
    const r = await reviews.getByAppointment(apptId);
    expect(r.score).toBe(4);
  });

  it('aggregates calcula média, positivos e retornos desejados', async () => {
    // Cria mais 2 appointments + reviews
    const c2 = await testHelpers.seedCustomer(pool, tenant.id, { phone: '5511900000002' });
    const c3 = await testHelpers.seedCustomer(pool, tenant.id, { phone: '5511900000003' });
    const a2 = await pool.query(
      `INSERT INTO appointments (tenant_id, customer_id, starts_at, ends_at, status)
       VALUES ($1, $2, NOW(), NOW(), 'completed') RETURNING id`,
      [tenant.id, c2.id],
    );
    const a3 = await pool.query(
      `INSERT INTO appointments (tenant_id, customer_id, starts_at, ends_at, status)
       VALUES ($1, $2, NOW(), NOW(), 'completed') RETURNING id`,
      [tenant.id, c3.id],
    );
    await reviews.upsert({
      tenantId: tenant.id,
      appointmentId: apptId,
      customerId: customer.id,
      score: 5,
      wantsReturn: true,
    });
    await reviews.upsert({
      tenantId: tenant.id,
      appointmentId: a2.rows[0].id,
      customerId: c2.id,
      score: 4,
      wantsReturn: false,
    });
    await reviews.upsert({
      tenantId: tenant.id,
      appointmentId: a3.rows[0].id,
      customerId: c3.id,
      score: 2,
      wantsReturn: true,
    });

    const agg = await reviews.aggregates(tenant.id, { sinceDays: 30 });
    expect(agg.total).toBe(3);
    expect(Number(agg.avg_score)).toBeCloseTo((5 + 4 + 2) / 3, 2);
    expect(agg.positives).toBe(2); // score >= 4
    expect(agg.wants_return_count).toBe(2);
  });

  it('aggregates respeita sinceDays (janela)', async () => {
    await reviews.upsert({
      tenantId: tenant.id,
      appointmentId: apptId,
      customerId: customer.id,
      score: 5,
    });
    // Puxa o created_at pra 60 dias atrás
    await pool.query(
      `UPDATE appointment_reviews SET created_at = NOW() - INTERVAL '60 days' WHERE appointment_id = $1`,
      [apptId],
    );
    const agg30 = await reviews.aggregates(tenant.id, { sinceDays: 30 });
    expect(agg30.total).toBe(0);
    const agg90 = await reviews.aggregates(tenant.id, { sinceDays: 90 });
    expect(agg90.total).toBe(1);
  });

  it('aggregates é isolado por tenant', async () => {
    const t2 = await testHelpers.seedTenant(pool, { slug: 't2' });
    await reviews.upsert({
      tenantId: tenant.id,
      appointmentId: apptId,
      customerId: customer.id,
      score: 5,
    });
    const agg = await reviews.aggregates(t2.id, { sinceDays: 30 });
    expect(agg.total).toBe(0);
  });
});
