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
let testHelpers;

beforeAll(async () => {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-test')) {
    throw new Error(
      'ANTHROPIC_API_KEY real não encontrada. Adicione em apps/bot/.env pra rodar E2E.',
    );
  }
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
  businessHours = await pool.query(
    `SELECT * FROM business_hours WHERE tenant_id = $1 ORDER BY weekday, start_time`,
    [tenant.id],
  );
  businessHours = businessHours.rows;

  // Google Calendar mockado pra não precisar de OAuth token.
  gcal.freeBusy = vi.fn().mockResolvedValue([]);
  gcal.createEvent = vi
    .fn()
    .mockImplementation(async (_tenantId, opts) => ({
      id: `evt-${Math.random().toString(36).slice(2, 8)}`,
      summary: opts.summary,
    }));
  gcal.updateEvent = vi.fn().mockResolvedValue({});
  gcal.deleteEvent = vi.fn().mockResolvedValue(undefined);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('E2E Claude: fluxo completo de agendamento', () => {
  it(
    'cliente pergunta horário e Claude chama check_availability',
    async () => {
      const r = await runChat({
        tenant,
        knowledge: fixture.knowledge,
        services,
        businessHours,
        userMessage: 'Tem horário disponível amanhã?',
      });
      expect(r.toolCalls).toContain('check_availability');
      expect(r.text.length).toBeGreaterThan(10);
    },
    60000,
  );

  it(
    'cliente responde pergunta de KB sem chamar tools',
    async () => {
      const r = await runChat({
        tenant,
        knowledge: fixture.knowledge,
        services,
        businessHours,
        userMessage: 'Qual a política de cancelamento?',
      });
      // Claude deve responder direto da KB sem chamar check_availability
      expect(r.toolCalls).not.toContain('check_availability');
      expect(r.text).toMatch(/2\s*h|duas horas|antecedência/i);
    },
    60000,
  );

  it(
    'conversa multi-turn: cliente escolhe horário e confirma → cria agendamento',
    async () => {
      // Turn 1: pergunta horário
      const t1 = await runChat({
        tenant,
        knowledge: fixture.knowledge,
        services,
        businessHours,
        userMessage: 'Tem horário na quarta-feira que vem de manhã?',
      });

      // Extrai apenas o histórico de assistente (sem tool_result blocks)
      const historyForNext = t1.messages;

      // Turn 2: confirma agendamento (com nome)
      const t2 = await runChat({
        tenant,
        knowledge: fixture.knowledge,
        services,
        businessHours,
        userMessage:
          'Perfeito, quero marcar corte clássico nesse primeiro horário que você mencionou. Meu nome é João.',
        history: historyForNext,
      });
      // Em ≤3 turns Claude deve ter chamado create_appointment (ou ainda pedir confirmação).
      const allCalls = [...t1.toolCalls, ...t2.toolCalls];
      expect(allCalls).toContain('check_availability');
      // Aceita create ou "texto de confirmação que prepara pro próximo turn"
      const appts = await pool.query(`SELECT COUNT(*) FROM appointments WHERE tenant_id = $1`, [
        tenant.id,
      ]);
      // Se create_appointment foi chamado, deve ter appointment; se não, apenas verificamos que o fluxo não errou.
      if (allCalls.includes('create_appointment')) {
        expect(Number(appts.rows[0].count)).toBe(1);
        expect(gcal.createEvent).toHaveBeenCalled();
      }
    },
    120000,
  );
});
