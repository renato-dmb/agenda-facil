import { describe, it, expect } from 'vitest';
import { requireFromSrc } from '../../helpers/cjs-loader.mjs';

const promptRequire = requireFromSrc('ai/prompt-builder.js');
const { buildGuestSystemPrompt } = promptRequire('./prompt-builder');

const baseInput = {
  tenant: {
    name: 'Segundo Barbeiro',
    profession_type: 'barbearia',
    timezone: 'America/Sao_Paulo',
  },
  knowledge: '### tone\n\nSimpático e direto.',
  services: [{ id: 'svc-1', name: 'Corte', duration_minutes: 30, price_cents: 5000 }],
  businessHours: [{ weekday: 2, start_time: '09:00:00', end_time: '19:00:00' }],
};

describe('buildGuestSystemPrompt — formatação WhatsApp', () => {
  it('não usa markdown de asterisco duplo em nenhum ponto do prompt', () => {
    // O WhatsApp só entende *negrito* com um asterisco de cada lado.
    // Qualquer ** no system prompt vira exemplo que o modelo copia,
    // e o cliente lê os asteriscos literais na mensagem.
    const prompt = buildGuestSystemPrompt(baseInput);
    expect(prompt).not.toContain('**');
  });

  it('interpola o nome do tenant com negrito de asterisco simples', () => {
    const prompt = buildGuestSystemPrompt(baseInput);
    expect(prompt).toContain('*Segundo Barbeiro*');
  });

  it('mantém a regra de estilo explícita sobre a sintaxe do WhatsApp', () => {
    const prompt = buildGuestSystemPrompt(baseInput);
    expect(prompt).toMatch(/um asterisco de cada lado/i);
  });
});
