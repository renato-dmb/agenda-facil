const { scheduled, messages: messageQueries, customers } = require('@agenda-facil/db');
const wa = require('../whatsapp/baileys-manager');
const { phoneToJid } = require('../utils/phone');

function renderTemplate(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`));
}

async function sendDue(limit = 20) {
  const pending = await scheduled.listPending(limit);
  let sent = 0;

  for (const item of pending) {
    try {
      const customer = await customers.getByPhone(item.tenant_id, item.phone);
      const body = renderTemplate(item.content, {
        nome: customer?.name || '',
        first_name: customer?.name?.split(' ')[0] || '',
      });

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
