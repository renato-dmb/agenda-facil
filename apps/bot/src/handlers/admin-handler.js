const wa = require('../whatsapp/baileys-manager');
const { tenants, messages, appointments, contacts } = require('@agenda-facil/db');
const resolver = require('../tenancy/resolver');
const {
  humanDateTimeInTz,
  zonedStartOfDayIso,
  zonedEndOfDayIso,
  todayIsoInTz,
} = require('../utils/dates');
const { normalizePhone, brMobileVariants, formatPhone } = require('../utils/phone');

const HELP = [
  '*Comandos disponíveis:*',
  '',
  '/pausar — desliga o bot',
  '/retomar — liga o bot de volta',
  '/status — visão geral',
  '/modo — atendimento público/privado',
  '/lista — contatos ignorados/liberados',
  '/ajuda — esta lista',
].join('\n');

const HELP_MODO = [
  '*Modos de atendimento:*',
  '',
  '• *público* — bot responde todos, exceto os da /lista',
  '• *privado* — bot responde apenas os da /lista',
  '',
  'Comandos:',
  '/modo — mostra o modo atual',
  '/modo publico — muda para público',
  '/modo privado — muda para privado',
].join('\n');

const HELP_LISTA = [
  '*Lista de contatos:*',
  '',
  '/lista — mostra quem está na lista',
  '/lista add 5511999999999 Nome — adiciona',
  '/lista remove 5511999999999 — remove',
  '/lista limpar — apaga tudo (pede confirmação)',
].join('\n');

function parseArgs(text) {
  const trimmed = text.trim();
  const withoutSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return withoutSlash.split(/\s+/);
}

async function handleModo(tenantId, args) {
  const desired = (args[1] || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!desired) {
    const fresh = await resolver.refreshTenant(tenantId);
    const current = fresh.audience_mode || 'public';
    const list = await contacts.listByTenant(tenantId);
    if (current === 'public') {
      return `*Modo atual: público* 🌐\n\nBot responde todos os contatos, exceto *${list.length}* da lista.\n\nPara mudar: /modo privado\nPara ver a lista: /lista`;
    }
    return `*Modo atual: privado* 🔒\n\nBot responde *apenas* os *${list.length}* contatos da lista.\n\nPara mudar: /modo publico\nPara ver a lista: /lista`;
  }
  if (desired === 'publico' || desired === 'public') {
    await tenants.setAudienceMode(tenantId, 'public');
    await resolver.refreshTenant(tenantId);
    const list = await contacts.listByTenant(tenantId);
    return `✅ Modo: *público* 🌐\n\nBot responde todos os contatos, exceto *${list.length}* da lista.`;
  }
  if (desired === 'privado' || desired === 'private') {
    await tenants.setAudienceMode(tenantId, 'private');
    await resolver.refreshTenant(tenantId);
    const list = await contacts.listByTenant(tenantId);
    if (list.length === 0) {
      return `✅ Modo: *privado* 🔒\n\n⚠️ Sua lista está vazia — o bot não vai responder ninguém. Adicione contatos com /lista add.`;
    }
    return `✅ Modo: *privado* 🔒\n\nBot responde apenas os *${list.length}* contatos da lista.`;
  }
  return `Modo desconhecido: \`${desired}\`\n\n${HELP_MODO}`;
}

async function handleLista(tenantId, args) {
  const action = (args[1] || '').toLowerCase();
  if (!action) {
    const items = await contacts.listByTenant(tenantId);
    if (items.length === 0) {
      return 'Sua lista está vazia.\n\nAdicione com:\n/lista add 5511999999999 Nome';
    }
    const lines = items
      .slice(0, 50)
      .map((c, i) => `${i + 1}. ${c.name || '(sem nome)'} — ${formatPhone(c.phone)}`);
    const header = `*${items.length} contato(s) na lista:*`;
    const extra = items.length > 50 ? `\n\n...e mais ${items.length - 50} (só os 50 primeiros)` : '';
    return `${header}\n\n${lines.join('\n')}${extra}`;
  }

  if (action === 'add' || action === 'adicionar') {
    const phoneRaw = args[2];
    const nameRaw = args.slice(3).join(' ').trim();
    if (!phoneRaw) return `Uso: /lista add 5511999999999 Nome\n\n${HELP_LISTA}`;
    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      return `Número inválido: \`${phoneRaw}\`\n\nUse formato brasileiro com DDD (ex: 11999999999 ou +5511999999999).`;
    }
    await contacts.add(tenantId, phone, nameRaw || null);
    return `✅ Adicionado à lista:\n*${nameRaw || '(sem nome)'}*\n${formatPhone(phone)}`;
  }

  if (action === 'remove' || action === 'remover' || action === 'rm') {
    const phoneRaw = args[2];
    if (!phoneRaw) return `Uso: /lista remove 5511999999999\n\n${HELP_LISTA}`;
    const phone = normalizePhone(phoneRaw);
    if (!phone) return `Número inválido: \`${phoneRaw}\``;
    const variants = brMobileVariants(phone);
    const count = await contacts.remove(tenantId, variants);
    return count > 0
      ? `✅ Removido da lista: ${formatPhone(phone)}`
      : `Não estava na lista: ${formatPhone(phone)}`;
  }

  if (action === 'limpar' || action === 'clear') {
    const confirm = (args[2] || '').toLowerCase();
    if (confirm === 'confirmar' || confirm === 'confirm') {
      const count = await contacts.clear(tenantId);
      return `✅ ${count} contato(s) removido(s). Lista vazia.`;
    }
    return '⚠️ Isto apaga TODA a lista.\n\nPara confirmar, envie:\n/lista limpar confirmar';
  }

  if (action === 'ajuda' || action === 'help' || action === '?') {
    return HELP_LISTA;
  }

  return `Subcomando desconhecido: \`${action}\`\n\n${HELP_LISTA}`;
}

async function handle({ tenantId, tenant, phone, text, messageId, msg, chatJid }) {
  await messages.log({ tenantId, waMessageId: messageId, phone, direction: 'in', body: text });

  const args = parseArgs(text);
  const cmd = (args[0] || '').toLowerCase();

  let reply = '';
  try {
    switch (cmd) {
      case 'pausar':
      case 'pause':
      case 'off': {
        await tenants.setAiActive(tenantId, false);
        await resolver.refreshTenant(tenantId);
        reply =
          '⏸️ Bot pausado. Os clientes não recebem resposta automática — você responde manualmente. Mande */retomar* quando quiser voltar.';
        break;
      }

      case 'retomar':
      case 'resume':
      case 'on': {
        await tenants.setAiActive(tenantId, true);
        await resolver.refreshTenant(tenantId);
        reply = '▶️ Bot de volta! Já respondendo os clientes.';
        break;
      }

      case 'status': {
        const refreshed = await resolver.refreshTenant(tenantId);
        const tz = refreshed.timezone || 'America/Sao_Paulo';
        const today = todayIsoInTz(tz);
        const appts = await appointments.listUpcomingBetween(
          tenantId,
          zonedStartOfDayIso(today, tz),
          zonedEndOfDayIso(today, tz),
        );
        const botState = refreshed.ai_active === false ? '⏸️ pausado' : '▶️ ativo';
        const mode = refreshed.audience_mode || 'public';
        const modeLabel = mode === 'private' ? '🔒 privado' : '🌐 público';
        const lines = [
          `*Bot:* ${botState}`,
          `*Atendimento:* ${modeLabel}`,
          '',
          `*Hoje (${today}):* ${appts.length} agendamento(s)`,
        ];
        for (const a of appts.slice(0, 10)) {
          lines.push(`• ${humanDateTimeInTz(a.starts_at, tz)} — ${a.status}`);
        }
        reply = lines.join('\n');
        break;
      }

      case 'modo':
      case 'mode': {
        reply = await handleModo(tenantId, args);
        break;
      }

      case 'lista':
      case 'list': {
        reply = await handleLista(tenantId, args);
        break;
      }

      case 'ajuda':
      case 'help':
      case '?':
      case '': {
        reply = HELP;
        break;
      }

      default: {
        reply = `Comando não reconhecido: \`${cmd}\`\n\n${HELP}`;
      }
    }
  } catch (err) {
    console.error(`[admin-handler:${tenant.slug}] command "${cmd}" failed:`, err);
    reply = '⚠️ Algo deu errado ao executar o comando. Tenta de novo em instantes.';
  }

  try {
    await wa.sendText(tenantId, chatJid, reply);
    await wa.markRead(tenantId, msg);
  } catch (err) {
    console.error(`[admin-handler:${tenant.slug}] send failed:`, err.message);
  }
  await messages.log({ tenantId, waMessageId: null, phone, direction: 'out', body: reply });

  return { mode: 'admin_reply', cmd };
}

module.exports = { handle };
