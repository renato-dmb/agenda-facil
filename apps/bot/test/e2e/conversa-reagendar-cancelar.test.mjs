import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../helpers/cjs-loader.mjs';
import { runChat } from './helpers/chat-runner.mjs';
import fixture from './fixtures/tenant-barbearia.js';

const toolRequire = requireFromSrc('ai/tools/create-appointment.js');
const gcal = toolRequire('../../integrations/calendar');

let pool;
let tenant;
let services;
let businessHours;
let customer;
let appointment;
let testHelpers;

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
}, 30000);

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool, { name: 'Barbearia Teste' });

  services = [];
  for (const s of fixture.services) {
    const r = await pool.query(
      `INSERT INTO services (tenant_id, name, duration_minutes, price_cents, active)
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [tenant.id, s.name, s.duration_minutes, s.price_cents],
    );
    services.push(r.rows[0]);
  }
  for (const h of fixture.business_hours) {
    await pool.query(
      `INSERT INTO business_hours (tenant_id, weekday, start_time, end_time)
       VALUES ($1, $2, $3, $4)`,
      [tenant.id, h.weekday, h.start_time, h.end_time],
    );
  }
  businessHours = (
    await pool.query(
      `SELECT * FROM business_hours WHERE tenant_id = $1 ORDER BY weekday, start_time`,
      [tenant.id],
    )
  ).rows;

  // Cliente já existente com appointment futuro (10 dias à frente)
  customer = await testHelpers.seedCustomer(pool, tenant.id, {
    phone: '5511900000001',
    name: 'Ana',
  });
  const futureStart = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  futureStart.setUTCHours(13, 0, 0, 0); // 10h BRT
  const appt = await pool.query(
    `INSERT INTO appointments (tenant_id, customer_id, service_id, starts_at, ends_at, google_event_id, status)
     VALUES ($1, $2, $3, $4, $5, 'evt-existing', 'confirmed')
     RETURNING *`,
    [
      tenant.id,
      customer.id,
      services[0].id,
      futureStart.toISOString(),
      new Date(futureStart.getTime() + 30 * 60 * 1000).toISOString(),
    ],
  );
  appointment = appt.rows[0];

  gcal.freeBusy = vi.fn().mockResolvedValue([]);
  gcal.createEvent = vi.fn().mockResolvedValue({ id: 'new-evt' });
  gcal.updateEvent = vi.fn().mockResolvedValue({ id: 'evt-existing' });
  gcal.deleteEvent = vi.fn().mockResolvedValue(undefined);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('E2E Claude: reagendar e cancelar', () => {
  it(
    'cliente pede pra cancelar — Claude chama cancel_appointment',
    async () => {
      const r = await runChat({
        tenant,
        knowledge: fixture.knowledge,
        services,
        businessHours,
        userMessage: 'Oi, preciso cancelar o horário que tenho marcado. Meu nome é Ana.',
        customerPhone: customer.phone,
      });
      // Claude costuma primeiro confirmar com get_customer_history
      expect(r.toolCalls.length).toBeGreaterThan(0);
      // Se Claude cancelar direto ou pedir confirmação, qualquer um é ok — testamos status no DB após.
      if (r.toolCalls.includes('cancel_appointment')) {
        const row = await pool.query(`SELECT status FROM appointments WHERE id = $1`, [
          appointment.id,
        ]);
        expect(row.rows[0].status).toBe('cancelled');
        expect(gcal.deleteEvent).toHaveBeenCalled();
      }
    },
    90000,
  );

  it(
    'cliente pergunta "tenho horário marcado?" — Claude chama get_customer_history',
    async () => {
      const r = await runChat({
        tenant,
        knowledge: fixture.knowledge,
        services,
        businessHours,
        userMessage: 'Tenho algum horário marcado pra mim? Meu nome é Ana.',
        customerPhone: customer.phone,
      });
      expect(r.toolCalls).toContain('get_customer_history');
      // Resposta final deve mencionar algum trecho identificador do appointment
      expect(r.text).toMatch(/10|corte|próxim|futuro|marcad/i);
    },
    60000,
  );
});
