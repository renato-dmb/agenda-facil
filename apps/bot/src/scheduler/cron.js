const cron = require('node-cron');
const { sendDue } = require('./dispatcher');
const { enqueueEligibleForAllTenants } = require('./recurrence-engine');
const { config } = require('@agenda-facil/shared');

let started = false;

function start() {
  if (started) return;
  started = true;

  cron.schedule('* * * * *', async () => {
    try {
      const n = await sendDue();
      if (n > 0) console.log(`[cron:dispatcher] sent ${n} scheduled message(s)`);
    } catch (err) {
      console.error('[cron:dispatcher] error:', err.message);
    }
  });

  cron.schedule(
    '0 8 * * *',
    async () => {
      try {
        const results = await enqueueEligibleForAllTenants();
        console.log(
          `[cron:recurrence] ${results.length} tenants processed`,
          JSON.stringify(results),
        );
      } catch (err) {
        console.error('[cron:recurrence] error:', err.message);
      }
    },
    { timezone: config.DEFAULT_TIMEZONE },
  );

  console.log('[cron] scheduled jobs started (dispatcher minutely; recurrence 08:00 BRT)');
}

module.exports = { start };
