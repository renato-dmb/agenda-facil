import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../../helpers/cjs-loader.mjs';

const calRequire = requireFromSrc('integrations/calendar/index.js');
const googleDriver = calRequire('../google-calendar/events');
const avecDriver = calRequire('./avec/events');
const router = calRequire('./index');

let pool;
let tenantGoogle;
let tenantAvec;
let testHelpers;

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenantGoogle = await testHelpers.seedTenant(pool, {
    slug: 'g',
    calendar_provider: 'google',
  });
  tenantAvec = await testHelpers.seedTenant(pool, {
    slug: 'a',
    calendar_provider: 'avec',
  });

  googleDriver.freeBusy = vi.fn().mockResolvedValue([{ start: 'a', end: 'b' }]);
  googleDriver.createEvent = vi.fn().mockResolvedValue({ id: 'google-evt' });
  googleDriver.updateEvent = vi.fn().mockResolvedValue({ id: 'google-evt' });
  googleDriver.deleteEvent = vi.fn().mockResolvedValue(undefined);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('integrations/calendar router', () => {
  it('tenant com calendar_provider=google delega pro driver google', async () => {
    const r = await router.freeBusy(tenantGoogle.id, {
      timeMin: '2026-04-22T00:00:00Z',
      timeMax: '2026-04-23T00:00:00Z',
    });
    expect(googleDriver.freeBusy).toHaveBeenCalledTimes(1);
    expect(r).toEqual([{ start: 'a', end: 'b' }]);
  });

  it('createEvent delega pro driver google com opts', async () => {
    const opts = {
      summary: 'teste',
      description: 'd',
      startIso: '2026-04-22T13:00:00Z',
      endIso: '2026-04-22T13:30:00Z',
      timezone: 'America/Sao_Paulo',
    };
    const r = await router.createEvent(tenantGoogle.id, opts);
    expect(r.id).toBe('google-evt');
    expect(googleDriver.createEvent).toHaveBeenCalledWith(tenantGoogle.id, opts);
  });

  it('providerOf retorna o provedor corrente', async () => {
    expect(await router.providerOf(tenantGoogle.id)).toBe('google');
    expect(await router.providerOf(tenantAvec.id)).toBe('avec');
  });

  it('tenant com calendar_provider=avec: driver levanta not_implemented', async () => {
    await expect(
      router.freeBusy(tenantAvec.id, {
        timeMin: '2026-04-22T00:00:00Z',
        timeMax: '2026-04-23T00:00:00Z',
      }),
    ).rejects.toThrow();
  });

  it('calendar_provider inexistente/inválido lança erro explícito', async () => {
    await pool.query(`UPDATE tenants SET calendar_provider = 'xyz' WHERE id = $1`, [
      tenantGoogle.id,
    ]);
    await expect(router.providerOf(tenantGoogle.id)).rejects.toThrow(
      /calendar_provider desconhecido: xyz/,
    );
  });
});
