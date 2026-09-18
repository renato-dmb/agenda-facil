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

describe('queries/tenants — createNew semeia o catálogo da profissão', () => {
  it('cria tenant de estética já com serviços de estética e horários', async () => {
    const t = await tenants.createNew({
      slug: 'clinica-estetica-teste',
      name: 'Clínica Estética Teste',
      profession_type: 'estetica',
      owner_phone: '5511900000001',
    });

    const { rows: svc } = await pool.query(
      'SELECT name FROM services WHERE tenant_id = $1 ORDER BY display_order',
      [t.id],
    );
    const nomes = svc.map((s) => s.name.toLowerCase()).join(' | ');
    expect(svc.length).toBeGreaterThan(0);
    expect(nomes).toMatch(/limpeza de pele/);
    // A regressão que motivou isto: estética nascendo com catálogo de barbearia.
    expect(nomes).not.toMatch(/\bbarba\b/);

    const { rows: hours } = await pool.query(
      'SELECT weekday FROM business_hours WHERE tenant_id = $1',
      [t.id],
    );
    expect(hours.length).toBeGreaterThan(0);
  });

  it('cria tenant de barbearia com o catálogo de barbearia', async () => {
    const t = await tenants.createNew({
      slug: 'barbearia-teste',
      name: 'Barbearia Teste',
      profession_type: 'barbearia',
      owner_phone: '5511900000002',
    });
    const { rows } = await pool.query('SELECT name FROM services WHERE tenant_id = $1', [t.id]);
    const nomes = rows.map((s) => s.name.toLowerCase()).join(' | ');
    expect(nomes).toMatch(/corte/);
    expect(nomes).toMatch(/barba/);
  });

  it('profissão desconhecida não quebra a criação — cai no catálogo genérico', async () => {
    const t = await tenants.createNew({
      slug: 'profissao-exotica-teste',
      name: 'Profissão Exótica',
      profession_type: 'taxidermia-quantica',
      owner_phone: '5511900000003',
    });
    const { rows } = await pool.query('SELECT name FROM services WHERE tenant_id = $1', [t.id]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('seedCatalog:false cria o tenant sem nenhum serviço', async () => {
    const t = await tenants.createNew({
      slug: 'sem-catalogo-teste',
      name: 'Sem Catálogo',
      profession_type: 'estetica',
      owner_phone: '5511900000004',
      seedCatalog: false,
    });
    const { rows } = await pool.query('SELECT name FROM services WHERE tenant_id = $1', [t.id]);
    expect(rows).toHaveLength(0);
  });
});
