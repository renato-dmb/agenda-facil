const { tenants, pool } = require('@agenda-facil/db');
const wa = require('../whatsapp/baileys-manager');
const { phoneToJid } = require('../utils/phone');
const { messages: messageQueries } = require('@agenda-facil/db');

async function runDaily() {
  const all = await tenants.listActive();
  let totalSent = 0;
  for (const t of all) {
    if (t.status !== 'active') continue;
    try {
      const r = await pool.getPool().query(
        `SELECT id, phone, name FROM customers
         WHERE tenant_id = $1
           AND birthday IS NOT NULL
           AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM NOW() AT TIME ZONE COALESCE($2, 'America/Sao_Paulo'))
           AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM NOW() AT TIME ZONE COALESCE($2, 'America/Sao_Paulo'))
           AND phone NOT LIKE '5500%'`,
        [t.id, t.timezone || 'America/Sao_Paulo'],
      );
      for (const cust of r.rows) {
        const firstName = (cust.name || '').split(' ')[0] || 'Amigo';
        const text = `Feliz aniversário, ${firstName}! 🎉\n\nDesejamos um dia incrível pra você. Que tal garantir aquele corte/barba pra ficar ainda mais afiado hoje? Se quiser, é só me chamar que agendo pra um horário que caiba no seu dia. 💈`;
        const jid = phoneToJid(cust.phone);
        if (!jid) continue;
        try {
          await wa.sendText(t.id, jid, text);
          await messageQueries.log({
            tenantId: t.id,
            waMessageId: null,
            phone: cust.phone,
            direction: 'out',
            body: text,
          });
          totalSent += 1;
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err) {
          console.error(`[birthday:${t.slug}] send failed ${cust.phone}:`, err.message);
        }
      }
    } catch (err) {
      console.error(`[birthday:${t.slug}] tenant failed:`, err.message);
    }
  }
  return totalSent;
}

module.exports = { runDaily };
