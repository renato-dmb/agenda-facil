const wa = require('../whatsapp/baileys-manager');
const { conversations, messages, services } = require('@agenda-facil/db');
const { chatGuest } = require('../ai/claude');
const { loadKnowledge } = require('../knowledge/loader');
const { config } = require('@agenda-facil/shared');

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

function historyToClaude(history) {
  return (history || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

async function handle({ tenantId, tenant, phone, text, messageId, msg, chatJid }) {
  const rl = checkRateLimit(tenantId, phone);
  if (!rl.allowed) {
    console.warn(`[rate-limit] Blocked ${tenant.slug}/${phone}`);
    return { mode: 'rate_limited' };
  }

  await messages.log({
    tenantId,
    waMessageId: messageId,
    phone,
    direction: 'in',
    body: text,
  });

  const conv = (await conversations.get(tenantId, phone)) || { history: [] };
  const priorHistory = conv.history || [];
  const isFirstContact = priorHistory.length === 0;

  const newHistory = [
    ...priorHistory,
    { role: 'user', content: text, at: new Date().toISOString() },
  ];
  await conversations.upsert(tenantId, phone, { history: newHistory });

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
  try {
    const { text: reply } = await chatGuest({
      history: historyToClaude(newHistory),
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

    const savedHistory = [
      ...newHistory,
      { role: 'assistant', content: replyText, at: new Date().toISOString() },
    ].slice(-40);

    await conversations.upsert(tenantId, phone, { history: savedHistory });
    await messages.log({ tenantId, waMessageId: null, phone, direction: 'out', body: replyText });
  }

  return { mode: 'replied', reply: replyText };
}

module.exports = { handle };
