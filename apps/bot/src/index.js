require('dotenv/config');
const express = require('express');
const wa = require('./whatsapp/baileys-manager');
const { route } = require('./router');
const guestHandler = require('./handlers/guest-handler');
const { loadAllActive } = require('./tenancy/resolver');
const cronScheduler = require('./scheduler/cron');
const { exchangeCodeForTokens } = require('./integrations/google-calendar/oauth');
const { googleOAuth, tenants } = require('@agenda-facil/db');
const { google } = require('googleapis');

const PORT = Number(process.env.PORT) || 3001;

async function handleMessage(msg, { tenantId, tenant }) {
  try {
    const routed = await route(msg, { tenantId, tenant });
    switch (routed.mode) {
      case 'guest':
        await guestHandler.handle(routed);
        return;
      case 'duplicate':
      case 'ignore':
      case 'silenced':
      case 'paused':
        return;
      default:
        console.warn(`[router:${tenant.slug}] unhandled mode: ${routed.mode}`);
    }
  } catch (err) {
    console.error(`[dispatch:${tenant?.slug || tenantId}] error:`, err);
  }
}

async function bootstrap() {
  console.log('[boot] loading tenants...');
  const activeTenants = await loadAllActive();
  console.log(`[boot] ${activeTenants.length} tenant(s) loaded`);

  wa.setMessageHandler(handleMessage);

  for (const tenant of activeTenants) {
    try {
      await wa.connectTenant(tenant, {
        onQr(qr) {
          console.log(
            `[whatsapp:${tenant.slug}] QR code available (run "pnpm bot:pair ${tenant.slug}" to pair via terminal)`,
          );
        },
      });
    } catch (err) {
      console.error(`[whatsapp:${tenant.slug}] connect failed:`, err.message);
    }
  }

  cronScheduler.start();

  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      tenants: wa.listConnected(),
      time: new Date().toISOString(),
    });
  });

  app.get('/oauth/google/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code) return res.status(400).send('missing code');
      if (!state) return res.status(400).send('missing state');

      const tenant = await tenants.getBySlug(String(state));
      if (!tenant) return res.status(404).send('tenant not found');

      const tokenSet = await exchangeCodeForTokens(String(code));
      let googleEmail = null;
      try {
        const oauth2 = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_OAUTH_REDIRECT_URI,
        );
        oauth2.setCredentials(tokenSet);
        const api = google.oauth2({ version: 'v2', auth: oauth2 });
        const { data } = await api.userinfo.get();
        googleEmail = data.email || null;
      } catch {
        // non-fatal
      }

      await googleOAuth.upsert(tenant.id, {
        google_account_email: googleEmail,
        access_token: tokenSet.access_token || null,
        refresh_token: tokenSet.refresh_token || null,
        expires_at: tokenSet.expiry_date ? new Date(tokenSet.expiry_date) : null,
        calendar_id: 'primary',
        scopes: (tokenSet.scope || '').trim(),
      });

      res
        .status(200)
        .send(
          `<html><body style="font-family: sans-serif; padding: 40px;"><h2>Conectado com sucesso</h2><p>Tenant: ${tenant.slug}</p><p>Conta: ${googleEmail || 'desconhecida'}</p></body></html>`,
        );
    } catch (err) {
      console.error('[oauth-callback] error:', err);
      res.status(500).send('error: ' + err.message);
    }
  });

  app.listen(PORT, () => console.log(`[http] listening on :${PORT}`));
}

bootstrap().catch((err) => {
  console.error('[boot] fatal:', err);
  process.exit(1);
});
