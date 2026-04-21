const Anthropic = require('@anthropic-ai/sdk');
const { config } = require('@agenda-facil/shared');
const { toolDefinitions, executeTool } = require('./tools');
const { buildGuestSystemPrompt } = require('./prompt-builder');

let anthropic = null;
function getAnthropic() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

async function chatGuest({ history, systemPromptInput, context }) {
  const systemPrompt = buildGuestSystemPrompt(systemPromptInput);
  const messages = [...history];
  let response;

  for (let iteration = 0; iteration < config.MAX_TOOL_ITERATIONS; iteration += 1) {
    response = await getAnthropic().messages.create({
      model: config.CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: toolDefinitions(),
    });

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0) {
      // Resposta final em texto — preserva no histórico pra próxima conversa
      messages.push({ role: 'assistant', content: response.content });
      break;
    }

    if (iteration === config.MAX_TOOL_ITERATIONS - 1) {
      console.warn(`[Claude] Tool iteration cap (${config.MAX_TOOL_ITERATIONS}) reached`);
    }

    messages.push({ role: 'assistant', content: response.content });

    for (const toolUse of toolUses) {
      console.log(`[Claude:${context.tenant.slug}] tool call: ${toolUse.name}`, JSON.stringify(toolUse.input));
      try {
        const result = await executeTool(toolUse.name, toolUse.input, context);
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            },
          ],
        });
      } catch (err) {
        console.error(`[Claude:${context.tenant.slug}] tool error ${toolUse.name}:`, err.message);
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({
                error:
                  'Tive um problema técnico ao executar essa ação. Responda ao cliente pedindo pra ele tentar novamente em alguns minutos.',
              }),
              is_error: true,
            },
          ],
        });
      }
    }
  }

  const textBlocks = response.content.filter((b) => b.type === 'text').map((b) => b.text);
  return { response, text: textBlocks.join('\n').trim(), messages };
}

module.exports = { chatGuest };
