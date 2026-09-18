import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  defaultsFor,
  PROFESSION_TYPES,
} = require('../seeds/profession-defaults');

// As profissões que o formulário de criação do painel /admin oferece.
// Se alguém adicionar uma opção lá, o catálogo padrão precisa acompanhar.
const PROFESSIONS_IN_ADMIN_FORM = [
  'barbearia',
  'salao',
  'odonto',
  'psicologia',
  'estetica',
  'personal',
  'outro',
];

describe('defaultsFor — catálogo padrão por profissão', () => {
  it('cobre todas as profissões oferecidas no formulário do painel', () => {
    expect([...PROFESSION_TYPES].sort()).toEqual([...PROFESSIONS_IN_ADMIN_FORM].sort());
  });

  it('entrega serviços de estética para estetica, não de barbearia', () => {
    const { services } = defaultsFor('estetica');
    expect(services.length).toBeGreaterThan(0);
    const nomes = services.map((s) => s.name.toLowerCase()).join(' | ');
    expect(nomes).toMatch(/limpeza de pele/);
    expect(nomes).not.toMatch(/\bbarba\b/);
  });

  it('entrega serviços de barbearia para barbearia', () => {
    const { services } = defaultsFor('barbearia');
    const nomes = services.map((s) => s.name.toLowerCase()).join(' | ');
    expect(nomes).toMatch(/corte/);
    expect(nomes).toMatch(/barba/);
  });

  it('cai num catálogo genérico para profissão desconhecida, sem lançar', () => {
    const { services, businessHours } = defaultsFor('nao-existe-essa-profissao');
    expect(services.length).toBeGreaterThan(0);
    expect(businessHours.length).toBeGreaterThan(0);
  });

  it('tolera profissão nula ou vazia', () => {
    for (const entrada of [null, undefined, '']) {
      expect(() => defaultsFor(entrada)).not.toThrow();
      expect(defaultsFor(entrada).services.length).toBeGreaterThan(0);
    }
  });

  it('normaliza maiúsculas e espaços', () => {
    expect(defaultsFor('  ESTETICA ').services).toEqual(defaultsFor('estetica').services);
  });

  describe.each(PROFESSIONS_IN_ADMIN_FORM)('invariantes de %s', (profissao) => {
    const { services, businessHours } = defaultsFor(profissao);

    it('serviços respeitam o schema (duração > 0, preço >= 0, ordem única)', () => {
      expect(services.length).toBeGreaterThan(0);
      for (const s of services) {
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.name.length).toBeLessThanOrEqual(120); // services.name VARCHAR(120)
        expect(s.duration_minutes).toBeGreaterThan(0);
        expect(s.price_cents).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(s.price_cents)).toBe(true);
      }
      const ordens = services.map((s) => s.display_order);
      expect(new Set(ordens).size).toBe(ordens.length);
    });

    it('horários respeitam o schema (weekday 0-6, início antes do fim, sem duplicar dia)', () => {
      expect(businessHours.length).toBeGreaterThan(0);
      for (const h of businessHours) {
        expect(h.weekday).toBeGreaterThanOrEqual(0);
        expect(h.weekday).toBeLessThanOrEqual(6);
        expect(h.start_time).toMatch(/^\d{2}:\d{2}$/);
        expect(h.end_time).toMatch(/^\d{2}:\d{2}$/);
        expect(h.start_time < h.end_time).toBe(true);
      }
      // UNIQUE (tenant_id, weekday, start_time) — nenhum par repetido
      const chaves = businessHours.map((h) => `${h.weekday}@${h.start_time}`);
      expect(new Set(chaves).size).toBe(chaves.length);
    });
  });

  it('devolve cópias — mutar o resultado não contamina a próxima chamada', () => {
    const primeira = defaultsFor('estetica');
    primeira.services[0].name = 'MUTADO';
    primeira.services.push({ name: 'INTRUSO', duration_minutes: 1, price_cents: 0, display_order: 99 });
    const segunda = defaultsFor('estetica');
    expect(segunda.services[0].name).not.toBe('MUTADO');
    expect(segunda.services.map((s) => s.name)).not.toContain('INTRUSO');
  });
});
