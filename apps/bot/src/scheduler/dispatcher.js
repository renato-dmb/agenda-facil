const { scheduled, messages: messageQueries, customers } = require('@agenda-facil/db');
const wa = require('../whatsapp/baileys-manager');
const { phoneToJid } = require('../utils/phone');

function renderTemplate(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`));
}

function formatDatePtBr(iso, tz) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: tz || 'America/Sao_Paulo',
  });
}

function formatTimePtBr(iso, tz) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz || 'America/Sao_Paulo',
  });
}

function weekdayPtBr(iso, tz) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    timeZone: tz || 'America/Sao_Paulo',
  });
}

async function sendDue(limit = 20) {
  const pending = await scheduled.listPending(limit);
  let sent = 0;

  for (const item of pending) {
    try {
      // Se é lembrete atrelado a appointment e o appointment foi cancelado,
      // não envia e remove da fila (defesa em profundidade).
      if (item.appointment_id && item.appt_status === 'cancelled') {
        await scheduled.markSent(item.id);
        console.log(`[dispatcher] skipped queue ${item.id} — appointment cancelled`);
        continue;
      }

      const customer = await customers.getByPhone(item.tenant_id, item.phone);
      const tz = item.tenant_tz || 'America/Sao_Paulo';
      const vars = {
        nome: customer?.name || '',
        first_name: customer?.name?.split(' ')[0] || '',
        service: item.appt_service_name || '',
        date: formatDatePtBr(item.appt_starts_at, tz),
        time: formatTimePtBr(item.appt_starts_at, tz),
        weekday: weekdayPtBr(item.appt_starts_at, tz),
      };
      const body = renderTemplate(item.content, vars);

      const jid = phoneToJid(item.phone);
      if (!jid) {
        console.warn(`[dispatcher] invalid phone ${item.phone} for queue ${item.id}`);
        await scheduled.markSent(item.id);
        continue;
      }

      try {
        await wa.sendText(item.tenant_id, jid, body);
      } catch (err) {
        console.error(
          `[dispatcher:${item.tenant_slug}] send failed for ${item.phone}:`,
          err.message,
        );
        continue;
      }

      await scheduled.markSent(item.id);
      await messageQueries.log({
        tenantId: item.tenant_id,
        waMessageId: null,
        phone: item.phone,
        direction: 'out',
        body,
      });
      sent += 1;
    } catch (err) {
      console.error(`[dispatcher] unexpected error on queue ${item.id}:`, err);
    }
  }

  return sent;
}

module.exports = { sendDue };
