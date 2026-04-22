const wa = require('./whatsapp/baileys-manager');
const { messages, conversations, contacts } = require('@agenda-facil/db');
const { isGroupJid, jidToPhone, normalizePhone, brMobileVariants } = require('./utils/phone');
const { resolveLidToPhone } = require('./utils/lid');

function phoneMatchesOwner(phone, ownerPhone) {
  if (!phone || !ownerPhone) return false;
  const variants = new Set(brMobileVariants(phone));
  for (const v of brMobileVariants(ownerPhone)) {
    if (variants.has(v)) return true;
  }
  return false;
}

function isAdminCommand(text) {
  return typeof text === 'string' && text.trim().startsWith('/');
}

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
  let phone = normalizePhone(raw);
  if (!phone) {
    // Se for LID (@lid), tenta resolver pro número real via mappings do auth_state
    const resolved = resolveLidToPhone(tenant.slug, raw);
    phone = normalizePhone(resolved) || resolved || raw;
  }
  if (!phone) return { mode: 'ignore' };

  // Comando administrativo do próprio profissional (dono do tenant).
  // Tem prioridade mesmo com ai_active=false — é assim que ele destraba o bot.
  const isOwner = phoneMatchesOwner(phone, tenant.owner_phone);
  if (isOwner && isAdminCommand(text)) {
    return { mode: 'admin', phone, text, msg, messageId, chatJid, tenantId, tenant };
  }

  if (tenant.ai_active === false) {
    return { mode: 'paused', phone };
  }

  // Escopo de atendimento (audience_mode):
  //   public  → ignora quem está na contact_list (blocklist)
  //   private → ignora quem NÃO está na contact_list (allowlist)
  // O dono nunca é filtrado aqui (comandos admin já capturados acima; msg comum
  // do owner cai no fluxo guest e pode testar o bot normalmente).
  if (!isOwner) {
    const mode = tenant.audience_mode || 'public';
    const variants = brMobileVariants(phone);
    const inList = await contacts.isInList(tenantId, variants);
    if (mode === 'public' && inList) {
      return { mode: 'bypass', phone };
    }
    if (mode === 'private' && !inList) {
      return { mode: 'bypass', phone };
    }
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
