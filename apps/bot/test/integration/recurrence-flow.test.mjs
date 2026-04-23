import { describe, it, expect, beforeAll, beforeEach, afterAll
} from 'vitest';
import { requireFromSrc } from '../helpers/cjs-loader.mjs';

const engineRequire = requireFromSrc('scheduler/recurrence-engine.js');
const engine = engineRequire('./recurrence-engine');

let pool;
let tenant;
let testHelpers;

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool, { status: 'active' });
  // recurrence message
  await pool.query(
    `INSERT INTO scheduled_messages
       (tenant_id, name, trigger_type, offset_days, send_hour, content_type, content, active)
     VALUES ($1, 'recurrence', 'recurrence_since_last_appointment', 0, '09:00',
             'template', 'Saudade!', true)`,
    [tenant.id],
  );
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('integração: recorrência engine', () => {
  it('enfileira clientes inativos há mais de 14 dias sem appt futuro', async () => {
    // Cliente inativo (eligible)
    const elig = await testHelpers.seedCustomer(pool, tenant.id, {
      phone: '5511900000001',
      name: 'Inativo',
    });
    await pool.query(
      `UPDATE customers SET last_appointment_at = NOW() - INTERVAL '20 days' WHERE id = $1`,
      [elig.id],
    );

    // Cliente ativo recente (não eligible)
    const recent = await testHelpers.seedCustomer(pool, tenant.id, {
      phone: '5511900000002',
      name: 'Recente',
    });
    await pool.query(
      `UPDATE customers SET last_appointment_at = NOW() - INTERVAL '5 days' WHERE id = $1`,
      [recent.id],
    );

    // Cliente inativo mas com appt futuro (não eligible)
    const withFuture = await testHelpers.seedCustomer(pool, tenant.id, {
      phone: '5511900000003',
      name: 'ComFuturo',
    });
    await pool.query(
      `UPDATE customers SET last_appointment_at = NOW() - INTERVAL '20 days' WHERE id = $1`,
      [withFuture.id],
    );
    await pool.query(
      `INSERT INTO appointments (tenant_id, customer_id, starts_at, ends_at, status)
       VALUES ($1, $2, NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '30 minutes', 'confirmed')`,
      [tenant.id, withFuture.id],
    );

    // Busca tenant com settings
    const dbPkg = await import('@agenda-facil/db');
    const { tenants } = dbPkg.default;
    const t = await tenants.getById(tenant.id);

    const r = await engine.enqueueEligibleForTenant(t);
    expect(r.enqueued).toBe(1);
    expect(r.eligible_count).toBe(1);

    const queue = await pool.query(
      `SELECT q.*, c.phone FROM scheduled_message_queue q
       JOIN customers c ON c.id = q.customer_id
       WHERE q.tenant_id = $1`,
      [tenant.id],
    );
    expect(queue.rowCount).toBe(1);
    expect(queue.rows[0].phone).toBe('5511900000001');
  });

  it('não enfileira se tenant tem recurrence_enabled = false', async () => {
    await pool.query(
      `UPDATE tenant_settings SET recurrence_enabled = false WHERE tenant_id = $1`,
      [tenant.id],
    );
    const elig = await testHelpers.seedCustomer(pool, tenant.id, {
      phone: '5511900000001',
      name: 'Elig',
    });
    await pool.query(
      `UPDATE customers SET last_appointment_at = NOW() - INTERVAL '20 days' WHERE id = $1`,
      [elig.id],
    );

    const dbPkg = await import('@agenda-facil/db');
    const t = await dbPkg.default.tenants.getById(tenant.id);
    const r = await engine.enqueueEligibleForTenant(t);
    expect(r.reason).toBe('disabled');
  });

  it('não duplica entrada se cliente já foi enfileirado hoje (UNIQUE cycle_day)', async () => {
    const elig = await testHelpers.seedCustomer(pool, tenant.id, {
      phone: '5511900000001',
      name: 'Elig',
    });
    await pool.query(
      `UPDATE customers SET last_appointment_at = NOW() - INTERVAL '20 days' WHERE id = $1`,
      [elig.id],
    );
    const dbPkg = await import('@agenda-facil/db');
    const t = await dbPkg.default.tenants.getById(tenant.id);

    const r1 = await engine.enqueueEligibleForTenant(t);
    const r2 = await engine.enqueueEligibleForTenant(t);
    expect(r1.enqueued).toBe(1);
    expect(r2.enqueued).toBe(0); // conflict no UNIQUE composite

    const queue = await pool.query(
      `SELECT COUNT(*) FROM scheduled_message_queue WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(Number(queue.rows[0].count)).toBe(1);
  });
});
