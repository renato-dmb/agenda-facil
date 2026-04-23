import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../../../helpers/cjs-loader.mjs';

const toolRequire = requireFromSrc('ai/tools/check-availability.js');
const gcal = toolRequire('../../integrations/calendar');
const checkAvailability = toolRequire('./check-availability');

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
  tenant = await testHelpers.seedTenant(pool);
  await pool.query(
    `INSERT INTO business_hours (tenant_id, weekday, start_time, end_time) VALUES
     ($1, 3, '09:00', '12:00'), ($1, 3, '14:00', '18:00')`,
    [tenant.id],
  );
  gcal.freeBusy = vi.fn().mockResolvedValue([]);
  gcal.createEvent = vi.fn().mockResolvedValue({ id: 'evt-test' });
  gcal.updateEvent = vi.fn().mockResolvedValue({});
  gcal.deleteEvent = vi.fn().mockResolvedValue(undefined);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-21T12:00:00Z'));
});

afterAll(async () => {
  vi.useRealTimers();
  if (pool) await pool.end();
});

describe('tools/check-availability', () => {
  it('retorna erro quando date não é YYYY-MM-DD', async () => {
    const r = await checkAvailability.execute({ date: '22/04/2026' }, { tenant });
    expect(r.error).toBe('date must be YYYY-MM-DD');
  });

  it('retorna slots vazios se não há business_hours no weekday', async () => {
    const r = await checkAvailability.execute({ date: '2026-04-19' }, { tenant });
    expect(r.available_slots).toEqual([]);
    expect(r.reason).toBe('no_business_hours_that_day');
  });

  it('gera slots de 30min alinhados às janelas de funcionamento', async () => {
    const r = await checkAvailability.execute({ date: '2026-04-22' }, { tenant });
    expect(r.available_slots.length).toBeGreaterThan(0);
    expect(r.available_slots.length).toBeLessThanOrEqual(20);
    expect(r.duration_minutes).toBe(30);
  });

  it('remove slots que colidem com eventos busy', async () => {
    gcal.freeBusy.mockResolvedValueOnce([
      { start: '2026-04-22T13:00:00Z', end: '2026-04-22T14:00:00Z' },
    ]);
    const r = await checkAvailability.execute({ date: '2026-04-22' }, { tenant });
    const slotStarts = r.available_slots.map((s) => s.start);
    expect(slotStarts).not.toContain('2026-04-22T13:00:00.000Z');
    expect(slotStarts).not.toContain('2026-04-22T13:30:00.000Z');
  });

  it('usa duration do serviço se service_id fornecido', async () => {
    const svc = await pool.query(
      `INSERT INTO services (tenant_id, name, duration_minutes) VALUES ($1, 'Longo', 60) RETURNING *`,
      [tenant.id],
    );
    const r = await checkAvailability.execute(
      { date: '2026-04-22', service_id: svc.rows[0].id },
      { tenant },
    );
    expect(r.duration_minutes).toBe(60);
  });
});
