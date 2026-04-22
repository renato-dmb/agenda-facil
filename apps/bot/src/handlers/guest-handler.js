const wa = require('../whatsapp/baileys-manager');
const { conversations, messages, services } = require('@agenda-facil/db');
const { chatGuest } = require('../ai/claude');
const { loadKnowledge } = require('../knowledge/loader');
const { config } = require('@agenda-facil/shared');
const whisper = require('../audio/whisper');

const rateLimitBuckets = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function rateLimitKey(tenantId, phone) {
  return `${tenantId}:${phone}`;
}

function checkRateLimit(tenantId, phone) {
  const key = rateLimitKey(tenantId, phone);
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (bucket.count >= config.RATE_LIMIT_MAX_PER_HOUR) {
    return { allowed: false };
  }
  bucket.count += 1;
  return { allowed: true };
}

function firstToolResultIndex(blocks) {
  if (!Array.isArray(blocks)) return -1;
  return blocks.findIndex((b) => b && b.type === 'tool_result');
}

// Trim preservando integridade dos ciclos tool_use → tool_result.
// A API rejeita user com tool_result sem o assistant tool_use correspondente
// imediatamente antes, então ao cortar sempre entramos num ponto "seguro":
// role='user' cujo content é texto simples (sem tool_result).
function safeTrim(history, keep = 40) {
  if (history.length <= keep) return history;
  let start = history.length - keep;
  while (start < history.length) {
    const msg = history[start];
    if (msg.role === 'user') {
      const content = msg.content;
      if (typeof content === 'string') break;
      if (Array.isArray(content) && firstToolResultIndex(content) === -1) break;
    }
    start += 1;
  }
  return history.slice(start);
}

async function handle({ tenantId, tenant, phone, text, messageId, msg, chatJid }) {
  const rl = checkRateLimit(tenantId, phone);
  if (!rl.allowed) {
    console.warn(`[rate-limit] Blocked ${tenant.slug}/${phone}`);
    return { mode: 'rate_limited' };
  }

  let effectiveText = text;
  let transcribedFrom = null;

  // Transcrição de áudio via Whisper. Se desabilitado ou falhar, responde
  // placeholder pedindo pra escrever.
  if ((!effectiveText || !effectiveText.trim()) && wa.isAudioMessage(msg) && whisper.isEnabled()) {
    try {
      const transcript = await whisper.transcribe(msg);
      if (transcript && transcript.trim()) {
        effectiveText = `[áudio transcrito]: ${transcript.trim()}`;
        transcribedFrom = transcript.trim();
        console.log(`[whisper:${tenant.slug}] ${phone}: "${transcript.slice(0, 80)}"`);
      }
    } catch (err) {
      if (err.name === 'AudioTooLargeError') {
        try {
          await wa.sendText(tenantId, chatJid, err.userMessage);
        } catch {
          // best effort
        }
        await messages.log({
          tenantId,
          waMessageId: null,
          phone,
          direction: 'out',
          body: err.userMessage,
        });
        return { mode: 'audio_too_large' };
      }
      console.error(`[whisper:${tenant.slug}] transcription failed:`, err.message);
    }
  }

  await messages.log({
    tenantId,
    waMessageId: messageId,
    phone,
    direction: 'in',
    body: transcribedFrom || text || '',
  });

  if (!effectiveText || !effectiveText.trim()) {
    const polite =
      'Oi! Tive um problema pra ouvir seu áudio agora. Pode me mandar em texto, por favor? 😊';
    try {
      await wa.sendText(tenantId, chatJid, polite);
      await wa.markRead(tenantId, msg);
    } catch (err) {
      console.error(`[guest-handler:${tenant.slug}] send failed:`, err.message);
    }
    await messages.log({ tenantId, waMessageId: null, phone, direction: 'out', body: polite });
    return { mode: 'no_text' };
  }

  const conv = (await conversations.get(tenantId, phone)) || { history: [] };
  const priorHistory = Array.isArray(conv.history) ? conv.history : [];
  const isFirstContact = priorHistory.length === 0;

  const userMessage = { role: 'user', content: effectiveText };
  const historyWithUser = [...priorHistory, userMessage];

  await conversations.upsert(tenantId, phone, { history: historyWithUser });

  const [knowledge, activeServices, businessHours] = await Promise.all([
    loadKnowledge(tenant.slug),
    services.listActive(tenantId),
    services.listBusinessHours(tenantId),
  ]);

  const context = {
    tenant,
    customerPhone: phone,
  };

  let replyText = '';
  let finalHistory = historyWithUser;
  try {
    const { messages: claudeFinal, text: reply } = await chatGuest({
      history: historyWithUser,
      systemPromptInput: {
        tenant,
        knowledge,
        services: activeServices,
        businessHours,
        context: { isFirstContact },
      },
      context,
    });
    replyText = reply;
    finalHistory = claudeFinal;
  } catch (err) {
    console.error(`[guest-handler:${tenant.slug}] Claude failed:`, err);
    replyText =
      'Desculpa, tive um problema técnico agora. Pode tentar de novo em alguns instantes?';
  }

  if (replyText) {
    try {
      await wa.sendText(tenantId, chatJid, replyText);
    } catch (err) {
      console.error(`[guest-handler:${tenant.slug}] send failed:`, err.message);
    }
    try {
      await wa.markRead(tenantId, msg);
    } catch {
      // best-effort
    }

    const trimmed = safeTrim(finalHistory, 40);
    await conversations.upsert(tenantId, phone, { history: trimmed });
    await messages.log({ tenantId, waMessageId: null, phone, direction: 'out', body: replyText });
  }

  return { mode: 'replied', reply: replyText };
}

module.exports = { handle };
