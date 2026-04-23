import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requireFromSrc } from '../../helpers/cjs-loader.mjs';

const handlerRequire = requireFromSrc('handlers/guest-handler.js');
const { safeTrim, checkRateLimit, _rateLimitBuckets } = handlerRequire('./guest-handler');

beforeEach(() => {
  // reset singleton entre casos
  _rateLimitBuckets.clear();
});

describe('guest-handler: safeTrim', () => {
  it('retorna history intacto se length <= keep', () => {
    const h = [{ role: 'user', content: 'oi' }];
    expect(safeTrim(h, 40)).toEqual(h);
  });

  it('corta preservando ponto seguro (user com string simples)', () => {
    const h = [];
    for (let i = 0; i < 50; i += 1) {
      h.push({ role: 'user', content: `msg ${i}` });
      h.push({ role: 'assistant', content: `resp ${i}` });
    }
    const trimmed = safeTrim(h, 40);
    expect(trimmed.length).toBeLessThanOrEqual(40);
    expect(trimmed[0].role).toBe('user');
    expect(typeof trimmed[0].content).toBe('string');
  });

  it('NUNCA começa com user contendo tool_result (regra da API Anthropic)', () => {
    // Construção: tool_use do assistant → tool_result do user → texto
    const h = [];
    for (let i = 0; i < 30; i += 1) {
      h.push({ role: 'user', content: `msg ${i}` });
      h.push({
        role: 'assistant',
        content: [{ type: 'tool_use', id: `t${i}`, name: 'check_availability', input: {} }],
      });
      h.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: `t${i}`, content: 'ok' }],
      });
      h.push({ role: 'assistant', content: 'resp' });
    }
    const trimmed = safeTrim(h, 40);
    // Primeiro item deve ser user com string (não tool_result)
    expect(trimmed[0].role).toBe('user');
    const firstContent = trimmed[0].content;
    if (Array.isArray(firstContent)) {
      const hasToolResult = firstContent.some((b) => b.type === 'tool_result');
      expect(hasToolResult).toBe(false);
    } else {
      expect(typeof firstContent).toBe('string');
    }
  });

  it('avança até encontrar ponto seguro (skipa user+tool_result)', () => {
    const h = [
      { role: 'assistant', content: 'velho' },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }],
      },
      { role: 'assistant', content: 'velho2' },
      { role: 'user', content: 'texto simples' },
      { role: 'assistant', content: 'resp' },
    ];
    const trimmed = safeTrim(h, 3);
    expect(trimmed[0].role).toBe('user');
    expect(trimmed[0].content).toBe('texto simples');
  });
});

describe('guest-handler: checkRateLimit', () => {
  it('permite primeira mensagem', () => {
    const r = checkRateLimit('t1', '5511900000001');
    expect(r.allowed).toBe(true);
  });

  it('bloqueia após atingir limite', () => {
    // config.RATE_LIMIT_MAX_PER_HOUR — valor do projeto
    const max = (require('@agenda-facil/shared').config || {}).RATE_LIMIT_MAX_PER_HOUR || 30;
    let lastAllowed;
    for (let i = 0; i < max + 1; i += 1) {
      lastAllowed = checkRateLimit('t1', '5511900000001').allowed;
    }
    expect(lastAllowed).toBe(false);
  });

  it('isola por tenant+phone — tenant diferente não é bloqueado', () => {
    const max = (require('@agenda-facil/shared').config || {}).RATE_LIMIT_MAX_PER_HOUR || 30;
    for (let i = 0; i < max; i += 1) {
      checkRateLimit('t1', '5511900000001');
    }
    // Mesmo phone, outro tenant — bucket separado
    expect(checkRateLimit('t2', '5511900000001').allowed).toBe(true);
    // Outro phone no mesmo tenant — bucket separado
    expect(checkRateLimit('t1', '5511900000002').allowed).toBe(true);
  });

  it('janela reseta após expirar', () => {
    // Primeira msg cria bucket
    checkRateLimit('t1', '5511900000001');
    // Forçamos expiração manipulando bucket interno
    const key = `t1:5511900000001`;
    const bucket = _rateLimitBuckets.get(key);
    bucket.resetAt = Date.now() - 1000;
    // Nova chamada renova bucket
    const r = checkRateLimit('t1', '5511900000001');
    expect(r.allowed).toBe(true);
    const fresh = _rateLimitBuckets.get(key);
    expect(fresh.count).toBe(1);
  });
});
