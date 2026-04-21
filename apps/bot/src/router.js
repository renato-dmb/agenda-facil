const wa = require('./whatsapp/baileys-manager');
const { messages, conversations } = require('@agenda-facil/db');
const { isGroupJid, jidToPhone, normalizePhone } = require('./utils/phone');

async function route(msg, { tenantId, tenant }) {
  const chatJid = wa.getChatJid(msg);
  const text = wa.getMessageText(msg);
  const isAudio = wa.isAudioMessage(msg);
  const messageId = wa.getMessageId(msg);

  if (!text && !isAudio) return { mode: 'ignore' };

  if (messageId && (await messages.hasMessage(tenantId, messageId))) {
    return { mode: 'duplicate' };
  }

  if (isGroupJid(chatJid)) {
    return { mode: 'ignore' };
  }

  const raw = jidToPhone(chatJid);
  const phone = normalizePhone(raw) || raw;
  if (!phone) return { mode: 'ignore' };

  if (tenant.ai_active === false) {
    return { mode: 'paused', phone };
  }

  const conv = await conversations.get(tenantId, phone);
  if (conv && (conv.state === 'escalated' || conv.state === 'paused')) {
    await messages.log({ tenantId, waMessageId: messageId, phone, direction: 'in', body: text });
    return { mode: 'silenced', phone, state: conv.state };
  }

  return {
    mode: 'guest',
    phone,
    text,
    msg,
    messageId,
    chatJid,
    tenantId,
    tenant,
  };
}

module.exports = { route };
