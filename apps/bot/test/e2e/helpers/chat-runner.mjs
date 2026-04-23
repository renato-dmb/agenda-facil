import { requireFromSrc } from '../../helpers/cjs-loader.mjs';

const aiRequire = requireFromSrc('ai/claude.js');
const claude = aiRequire('./claude');

/**
 * Roda uma conversa simulada com Claude real.
 * Retorna { text, toolCalls, messages }.
 *
 * @param {object} opts
 * @param {object} opts.tenant
 * @param {Array<object>} opts.knowledge — lista de { name, content }
 * @param {Array<object>} opts.services
 * @param {Array<object>} opts.businessHours
 * @param {string} opts.userMessage — texto do cliente
 * @param {string} [opts.customerPhone]
 * @param {Array} [opts.history]
 */
export async function runChat({
  tenant,
  knowledge,
  services,
  businessHours,
  userMessage,
  customerPhone = '5511900000001',
  history = [],
}) {
  const toolCalls = [];
  const origConsole = console.log;
  console.log = (...args) => {
    const line = args.join(' ');
    // intercepta "tool call: X {...}" pra coletar nomes
    const match = line.match(/tool call: (\w+)/);
    if (match) toolCalls.push(match[1]);
    // silencia — só grava
  };

  try {
    const allHistory = [...history, { role: 'user', content: userMessage }];
    // Converte knowledge de array {name, content} pra string concatenada (formato esperado pelo prompt-builder).
    const knowledgeStr = Array.isArray(knowledge)
      ? knowledge.map((k) => `### ${k.name}\n${k.content}`).join('\n\n')
      : knowledge;

    const r = await claude.chatGuest({
      history: allHistory,
      systemPromptInput: {
        tenant,
        knowledge: knowledgeStr,
        services,
        businessHours,
        context: { isFirstContact: history.length === 0 },
      },
      context: { tenant, customerPhone },
    });
    return { text: r.text, toolCalls, messages: r.messages };
  } finally {
    console.log = origConsole;
  }
}
