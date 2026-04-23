import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  nowIso,
  todayIsoInTz,
  humanDateTimeInTz,
  zonedStartOfDayIso,
  zonedEndOfDayIso,
  zonedDateTimeToIso,
  addMinutesIso,
  weekdayInTz,
} from '../../../src/utils/dates.js';

describe('utils/dates', () => {
  describe('nowIso', () => {
    it('retorna ISO 8601 válido', () => {
      const iso = nowIso();
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(iso).toString()).not.toBe('Invalid Date');
    });
  });

  describe('todayIsoInTz', () => {
    it('retorna YYYY-MM-DD no fuso de São Paulo', () => {
      const d = todayIsoInTz('America/Sao_Paulo');
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('01/01/2024 00:30 UTC ainda é 31/12/2023 em São Paulo (UTC-3)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:30:00Z'));
      try {
        expect(todayIsoInTz('America/Sao_Paulo')).toBe('2023-12-31');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('humanDateTimeInTz', () => {
    it('formata dd/MM/yyyy "às" HH:mm em pt-BR', () => {
      const r = humanDateTimeInTz('2026-04-22T13:30:00Z', 'America/Sao_Paulo');
      expect(r).toBe('22/04/2026 às 10:30');
    });
  });

  describe('zonedStartOfDayIso', () => {
    it('meia-noite em SP equivale a 03:00Z', () => {
      expect(zonedStartOfDayIso('2026-04-22', 'America/Sao_Paulo')).toBe(
        '2026-04-22T03:00:00.000Z',
      );
    });
  });

  describe('zonedEndOfDayIso', () => {
    it('23:59:59 em SP equivale a 02:59:59Z do dia seguinte', () => {
      expect(zonedEndOfDayIso('2026-04-22', 'America/Sao_Paulo')).toBe(
        '2026-04-23T02:59:59.000Z',
      );
    });
  });

  describe('zonedDateTimeToIso', () => {
    it('10:00 em SP equivale a 13:00Z', () => {
      expect(zonedDateTimeToIso('2026-04-22', '10:00', 'America/Sao_Paulo')).toBe(
        '2026-04-22T13:00:00.000Z',
      );
    });
  });

  describe('addMinutesIso', () => {
    it('soma 30 minutos', () => {
      expect(addMinutesIso('2026-04-22T10:00:00.000Z', 30)).toBe(
        '2026-04-22T10:30:00.000Z',
      );
    });

    it('soma valor negativo subtrai', () => {
      expect(addMinutesIso('2026-04-22T10:00:00.000Z', -15)).toBe(
        '2026-04-22T09:45:00.000Z',
      );
    });

    it('atravessa meia-noite', () => {
      expect(addMinutesIso('2026-04-22T23:45:00.000Z', 30)).toBe(
        '2026-04-23T00:15:00.000Z',
      );
    });
  });

  describe('weekdayInTz', () => {
    it('2026-04-22 é quarta-feira em SP (weekday=3)', () => {
      expect(weekdayInTz('2026-04-22T15:00:00Z', 'America/Sao_Paulo')).toBe(3);
    });

    it('domingo retorna 0', () => {
      expect(weekdayInTz('2026-04-26T15:00:00Z', 'America/Sao_Paulo')).toBe(0);
    });
  });
});
