import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireFromSrc } from '../helpers/cjs-loader.mjs';
import { runChat } from './helpers/chat-runner.mjs';
import { judgeEquivalence } from './helpers/llm-judge.mjs';
import fixture from './fixtures/tenant-barbearia.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_PATH = path.join(__dirname, '__snapshots__/canonical-responses.json');
const snapshots = JSON.parse(fs.readFileSync(SNAPSHOTS_PATH, 'utf8'));

const toolRequire = requireFromSrc('ai/tools/create-appointment.js');
const gcal = toolRequire('../../integrations/calendar');

let pool;
let tenant;
let services;
let businessHours;
let testHelpers;

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
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

  gcal.freeBusy = vi.fn().mockResolvedValue([]);
  gcal.createEvent = vi.fn().mockResolvedValue({ id: 'new-evt' });
}, 60000);

afterAll(async () => {
  if (pool) await pool.end();
});

describe('regressão IA — respostas canônicas', () => {
  for (const snap of snapshots) {
    it(
      `snapshot "${snap.id}" mantém equivalência semântica`,
      async () => {
        const r = await runChat({
          tenant,
          knowledge: fixture.knowledge,
          services,
          businessHours,
          userMessage: snap.userMessage,
        });
        const verdict = await judgeEquivalence({
          userMessage: snap.userMessage,
          expectedResponse: snap.expected,
          actualResponse: r.text,
        });
        console.log(`[judge:${snap.id}] score=${verdict.score} reasoning=${verdict.reasoning}`);
        expect(verdict.score).toBeGreaterThanOrEqual(3);
        expect(verdict.equivalent || verdict.score >= 4).toBe(true);
      },
      120000,
    );
  }
});
