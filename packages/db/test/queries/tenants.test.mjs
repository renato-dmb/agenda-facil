import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import pkg from '../../index.js';
const { testHelpers, tenants } = pkg;

let pool;

beforeAll(async () => {
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('queries/tenants', () => {
  it('upsertTenant cria um tenant novo com defaults', async () => {
    const t = await tenants.upsertTenant({
      slug: 'teste-slug',
      name: 'Teste',
      profession_type: 'barbearia',
      timezone: null,
      whatsapp_number: '5511987654321',
      status: null,
    });
    expect(t.slug).toBe('teste-slug');
    expect(t.timezone).toBe('America/Sao_Paulo');
    expect(t.status).toBe('pending');
  });

  it('upsertTenant atualiza tenant existente pelo slug', async () => {
    await tenants.upsertTenant({
      slug: 'teste-slug',
      name: 'Original',
      profession_type: 'barbearia',
      whatsapp_number: '5511987654321',
    });
    const updated = await tenants.upsertTenant({
      slug: 'teste-slug',
      name: 'Atualizado',
      profession_type: 'odonto',
      whatsapp_number: '5511987654321',
    });
    expect(updated.name).toBe('Atualizado');
    expect(updated.profession_type).toBe('odonto');
  });

  it('getBySlug retorna tenant com settings via LEFT JOIN', async () => {
    await testHelpers.seedTenant(pool, { slug: 'join-test' });
    const t = await tenants.getBySlug('join-test');
    expect(t).not.toBeNull();
    expect(t.slug).toBe('join-test');
    expect(t.ai_active).toBe(true); // default
  });

  it('getBySlug retorna null se inexistente', async () => {
    expect(await tenants.getBySlug('nao-existe')).toBe(null);
  });

  it('getByWhatsAppNumber encontra tenant pelo número', async () => {
    const seeded = await testHelpers.seedTenant(pool, {
      whatsapp_number: '5511999998888',
    });
    const t = await tenants.getByWhatsAppNumber('5511999998888');
    expect(t.id).toBe(seeded.id);
  });

  it('listActive retorna só tenants com status active/pending', async () => {
    await testHelpers.seedTenant(pool, { slug: 't-active', status: 'active' });
    await testHelpers.seedTenant(pool, { slug: 't-pending', status: 'pending' });
    await testHelpers.seedTenant(pool, { slug: 't-disabled', status: 'disabled' });
    const r = await tenants.listActive();
    const slugs = r.map((t) => t.slug);
    expect(slugs).toContain('t-active');
    expect(slugs).toContain('t-pending');
    expect(slugs).not.toContain('t-disabled');
  });

  it('setAiActive toggle preserva outras settings', async () => {
    const t = await testHelpers.seedTenant(pool);
    await tenants.setAiActive(t.id, false);
    const fetched = await tenants.getById(t.id);
    expect(fetched.ai_active).toBe(false);
  });

  it('setAudienceMode rejeita valor inválido', async () => {
    const t = await testHelpers.seedTenant(pool);
    await expect(tenants.setAudienceMode(t.id, 'invalido')).rejects.toThrow();
  });

  it('setStatus atualiza o status', async () => {
    const t = await testHelpers.seedTenant(pool, { status: 'pending' });
    await tenants.setStatus(t.id, 'paused');
    const r = await tenants.getById(t.id);
    expect(r.status).toBe('paused');
  });
});
