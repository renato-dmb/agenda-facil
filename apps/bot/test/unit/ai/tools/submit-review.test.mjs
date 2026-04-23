import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { requireFromSrc } from '../../../helpers/cjs-loader.mjs';

const toolRequire = requireFromSrc('ai/tools/submit-review.js');
const submitReview = toolRequire('./submit-review');

let pool;
let tenant;
let customer;
let appointment;
let testHelpers;

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
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
  const a = await pool.query(
    `INSERT INTO appointments (tenant_id, customer_id, starts_at, ends_at, status)
     VALUES ($1, $2, '2026-04-20T13:00:00Z', '2026-04-20T13:30:00Z', 'completed') RETURNING *`,
    [tenant.id, customer.id],
  );
  appointment = a.rows[0];
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('tools/submit-review', () => {
  it('retorna erro quando appointment_id não existe', async () => {
    const r = await submitReview.execute(
      {
        appointment_id: '00000000-0000-0000-0000-000000000000',
        score: 5,
      },
      { tenant, customerPhone: customer.phone },
    );
    expect(r.error).toMatch(/appointment não encontrado/);
  });

  it('retorna erro quando customer da conversa não existe', async () => {
    const r = await submitReview.execute(
      { appointment_id: appointment.id, score: 5 },
      { tenant, customerPhone: '5511900999999' }, // phone inexistente
    );
    expect(r.error).toMatch(/cliente não encontrado/);
  });

  it('bloqueia review de appointment de OUTRO cliente (anti-fraude)', async () => {
    // Outro cliente que tenta dar review no appt do primeiro
    const outro = await testHelpers.seedCustomer(pool, tenant.id, {
      phone: '5511888888888',
      name: 'Outro',
    });

    const r = await submitReview.execute(
      { appointment_id: appointment.id, score: 1, comment: 'ataque' },
      { tenant, customerPhone: outro.phone },
    );
    expect(r.error).toMatch(/não pertence ao cliente/);

    const reviews = await pool.query(
      `SELECT COUNT(*) FROM appointment_reviews WHERE appointment_id = $1`,
      [appointment.id],
    );
    expect(Number(reviews.rows[0].count)).toBe(0);
  });

  it('grava review e retorna next_step de agradecimento se wants_return=false', async () => {
    const r = await submitReview.execute(
      {
        appointment_id: appointment.id,
        score: 5,
        comment: 'Gostei muito!',
        wants_return: false,
      },
      { tenant, customerPhone: customer.phone },
    );
    expect(r.ok).toBe(true);
    expect(r.score).toBe(5);
    expect(r.wants_return).toBe(false);
    expect(r.next_step).toMatch(/Agradeça/);
  });

  it('wants_return=true → next_step pede check_availability', async () => {
    const r = await submitReview.execute(
      {
        appointment_id: appointment.id,
        score: 4,
        wants_return: true,
        return_interval_days: 21,
      },
      { tenant, customerPhone: customer.phone },
    );
    expect(r.ok).toBe(true);
    expect(r.wants_return).toBe(true);
    expect(r.return_interval_days).toBe(21);
    expect(r.next_step).toMatch(/check_availability/);
  });
});
