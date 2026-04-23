import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  brMobileVariants,
  formatPhone,
  jidToPhone,
  phoneToJid,
  isGroupJid,
  isIndividualJid,
} from '../../../src/utils/phone.js';

describe('utils/phone', () => {
  describe('normalizePhone', () => {
    it('retorna null pra entrada vazia', () => {
      expect(normalizePhone(null)).toBe(null);
      expect(normalizePhone('')).toBe(null);
      expect(normalizePhone(undefined)).toBe(null);
    });

    it('remove espaços, parênteses, hífens, pontos', () => {
      expect(normalizePhone('(11) 98765-4321')).toBe('5511987654321');
      expect(normalizePhone('11.98765.4321')).toBe('5511987654321');
      expect(normalizePhone('+55 11 98765-4321')).toBe('5511987654321');
    });

    it('adiciona 55 se só 10 ou 11 dígitos', () => {
      expect(normalizePhone('11987654321')).toBe('5511987654321');
      expect(normalizePhone('1198765432')).toBe('551198765432');
    });

    it('mantém 55 se já começa com 55', () => {
      expect(normalizePhone('5511987654321')).toBe('5511987654321');
    });

    it('retorna null pra formato inválido', () => {
      expect(normalizePhone('123')).toBe(null);
      expect(normalizePhone('abcdefghijk')).toBe(null);
      expect(normalizePhone('991198765432')).toBe(null); // não começa com 55
    });
  });

  describe('brMobileVariants', () => {
    it('celular 9-digits gera variante sem o 9', () => {
      const r = brMobileVariants('5511987654321');
      expect(r).toContain('5511987654321');
      expect(r).toContain('551187654321');
    });

    it('fixo 8-digits com [6-9] gera variante com 9', () => {
      const r = brMobileVariants('551187654321'); // 8 dígitos após DDD
      expect(r).toContain('551187654321');
      expect(r).toContain('5511987654321');
    });

    it('entrada não-br retorna só ela mesma', () => {
      expect(brMobileVariants('14155552671')).toEqual(['14155552671']);
    });

    it('null/vazio retorna array com entrada', () => {
      expect(brMobileVariants(null)).toEqual([null]);
    });
  });

  describe('formatPhone', () => {
    it('formata celular 9-digits', () => {
      expect(formatPhone('5511987654321')).toBe('+55 11 98765-4321');
    });

    it('formata fixo 8-digits', () => {
      expect(formatPhone('551187654321')).toBe('+55 11 8765-4321');
    });

    it('retorna entrada se curta demais', () => {
      expect(formatPhone('123')).toBe('123');
    });
  });

  describe('jidToPhone / phoneToJid', () => {
    it('extrai phone do JID', () => {
      expect(jidToPhone('5511987654321@s.whatsapp.net')).toBe('5511987654321');
      expect(jidToPhone('5511987654321@lid')).toBe('5511987654321');
    });

    it('retorna null pra JID malformado', () => {
      expect(jidToPhone(null)).toBe(null);
      expect(jidToPhone('invalid')).toBe(null);
    });

    it('phoneToJid adiciona sufixo whatsapp.net', () => {
      expect(phoneToJid('11987654321')).toBe('5511987654321@s.whatsapp.net');
    });

    it('phoneToJid retorna null pra entrada inválida', () => {
      expect(phoneToJid('')).toBe(null);
    });
  });

  describe('isGroupJid / isIndividualJid', () => {
    it('identifica grupo', () => {
      expect(isGroupJid('abc123@g.us')).toBe(true);
      expect(isGroupJid('5511987654321@s.whatsapp.net')).toBe(false);
    });

    it('identifica individual (s.whatsapp.net ou lid)', () => {
      expect(isIndividualJid('5511987654321@s.whatsapp.net')).toBe(true);
      expect(isIndividualJid('5511987654321@lid')).toBe(true);
      expect(isIndividualJid('abc@g.us')).toBe(false);
      expect(isIndividualJid(null)).toBe(false);
    });
  });
});
