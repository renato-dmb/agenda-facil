const wa = require('../whatsapp/baileys-manager');
const { tenants, messages, appointments } = require('@agenda-facil/db');
const resolver = require('../tenancy/resolver');
const { humanDateTimeInTz, zonedStartOfDayIso, zonedEndOfDayIso, todayIsoInTz } = require('../utils/dates');

const HELP = [
  '*Comandos disponíveis:*',
  '',
  '/pausar — desliga o bot (clientes não recebem resposta)',
  '/retomar — liga o bot de volta',
  '/status — visão geral (estado + agendamentos de hoje)',
  '/ajuda — esta lista',
].join('\n');

async function handle({ tenantId, tenant, phone, text, messageId, msg, chatJid }) {
  await messages.log({ tenantId, waMessageId: messageId, phone, direction: 'in', body: text });

  const trimmed = text.trim();
  const withoutSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const [rawCmd] = withoutSlash.split(/\s+/);
  const cmd = (rawCmd || '').toLowerCase();

  let reply = '';
  try {
    switch (cmd) {
      case 'pausar':
      case 'pause':
      case 'off': {
        await tenants.setAiActive(tenantId, false);
        await resolver.refreshTenant(tenantId);
        reply = '⏸️ Bot pausado. Os clientes não receberão resposta automática — você responde manualmente. Mande */retomar* quando quiser voltar.';
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
        const state = refreshed.ai_active === false ? '⏸️ pausado' : '▶️ ativo';
        const lines = [`*Status do bot:* ${state}`, '', `*Hoje (${today}):* ${appts.length} agendamento(s)`];
        for (const a of appts.slice(0, 10)) {
          lines.push(`• ${humanDateTimeInTz(a.starts_at, tz)} — ${a.status}`);
        }
        reply = lines.join('\n');
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
