import Anthropic from '@anthropic-ai/sdk';

let client;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Pergunta ao Claude Haiku se duas respostas do bot são semanticamente equivalentes.
 * Retorna { score: 1-5, reasoning: string, equivalent: boolean }.
 *
 * Haiku custa ~0.001 por call.
 */
export async function judgeEquivalence({
  userMessage,
  expectedResponse,
  actualResponse,
  rubric = 'Ambas devem transmitir a mesma informação essencial ao cliente, no mesmo tom. Variações de palavras, ordem ou emojis são aceitáveis.',
}) {
  const res = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `Você é um juiz de regressão semântica pra respostas de um chatbot de agendamento. Sua tarefa: comparar duas respostas e dizer se são equivalentes.

Critério (rubric): ${rubric}

Responda APENAS com JSON válido no formato:
{"score": 1-5, "reasoning": "motivo curto", "equivalent": boolean}

Score:
- 5: idênticas em informação e tom
- 4: pequenas variações aceitáveis (wording, emojis, ordem de info)
- 3: conteúdo equivalente mas com perdas menores
- 2: informação faltando ou errada
- 1: resposta totalmente divergente ou com alucinação

equivalent = true se score >= 4.`,
    messages: [
      {
        role: 'user',
        content: `Pergunta do cliente: "${userMessage}"

RESPOSTA ESPERADA (snapshot aceito):
---
${expectedResponse}
---

RESPOSTA ATUAL (a avaliar):
---
${actualResponse}
---

Avalie.`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === 'text')?.text || '{}';
  // Extrai só o primeiro bloco JSON
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { score: 1, reasoning: 'no-json', equivalent: false };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { score: 1, reasoning: 'parse-error', equivalent: false };
  }
}
