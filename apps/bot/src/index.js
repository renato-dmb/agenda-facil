require('dotenv/config');
const fs = require('fs');
const path = require('path');
const express = require('express');
const QRCode = require('qrcode');
const wa = require('./whatsapp/baileys-manager');
const { route } = require('./router');
const guestHandler = require('./handlers/guest-handler');
const adminHandler = require('./handlers/admin-handler');
const { loadAllActive } = require('./tenancy/resolver');
const cronScheduler = require('./scheduler/cron');
const { exchangeCodeForTokens } = require('./integrations/google-calendar/oauth');
const { googleOAuth, tenants } = require('@agenda-facil/db');
const { AUTH_ROOT } = require('./whatsapp/session-store');
const { google } = require('googleapis');

const PORT = Number(process.env.PORT) || 3001;

async function handleMessage(msg, { tenantId, tenant }) {
  try {
    const routed = await route(msg, { tenantId, tenant });
    switch (routed.mode) {
      case 'guest':
        await guestHandler.handle(routed);
        return;
      case 'admin':
        await adminHandler.handle(routed);
        return;
      case 'duplicate':
      case 'ignore':
      case 'silenced':
      case 'paused':
      case 'bypass':
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
    const credsPath = path.join(AUTH_ROOT, tenant.slug, 'creds.json');
    if (!fs.existsSync(credsPath)) {
      console.log(
        `[boot:${tenant.slug}] sem credentials pareadas — acesse /pair/${tenant.slug} no navegador para parear.`,
      );
      continue;
    }
    try {
      await wa.connectTenant(tenant);
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

  // Pareamento remoto do WhatsApp — QR no navegador. Essencial em produção,
  // onde não há terminal do container.
  app.get('/pair/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const tenant = await tenants.getBySlug(slug);
      if (!tenant) return res.status(404).send('tenant not found');

      const authDir = path.join(AUTH_ROOT, slug);
      const credsPath = path.join(authDir, 'creds.json');
      const reset = req.query.reset === '1';

      // Reset: desconecta socket atual e apaga auth_state — força novo QR.
      // Usado quando trocando de número/WhatsApp.
      if (reset) {
        try {
          await wa.disconnectTenant(tenant.id);
        } catch (e) {
          // best-effort
        }
        if (fs.existsSync(authDir)) {
          fs.rmSync(authDir, { recursive: true, force: true });
        }
        console.log(`[pair:${slug}] reset — auth_state apagado`);
      }

      const connected = wa.listConnected().some((c) => c.tenantId === tenant.id);

      if (!reset && fs.existsSync(credsPath) && connected) {
        return res.status(200).send(
          `<html><body style="font-family:sans-serif;padding:40px;">
            <h2>✓ ${slug} já está pareado</h2>
            <p>Pra trocar de número/WhatsApp, acesse <code>?reset=1</code> nesta URL.</p>
          </body></html>`,
        );
      }

      if (!connected || reset) {
        wa.connectTenant(tenant).catch((err) =>
          console.error(`[pair:${slug}] connect error:`, err.message),
        );
      }

      let qr = wa.getLastQr(tenant.id);
      const deadline = Date.now() + 15000;
      while (!qr && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500));
        qr = wa.getLastQr(tenant.id);
      }

      if (!qr) {
        return res.status(202).send(
          `<html><body style="font-family:sans-serif;padding:40px;">
            <h3>Aguardando QR do tenant ${slug}...</h3>
            <p>Ainda não gerado — recarregue em alguns segundos.</p>
            <script>setTimeout(() => location.reload(), 3000);</script>
          </body></html>`,
        );
      }

      const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 360 });
      return res.status(200).send(
        `<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
          <h2>Parear WhatsApp — ${slug}</h2>
          <p>WhatsApp → Configurações → Aparelhos Conectados → Conectar um aparelho</p>
          <img src="${dataUrl}" alt="QR Code" />
          <p style="color:#888;font-size:13px;">Recarrega a cada 20s enquanto não for pareado.</p>
          <script>setTimeout(() => location.reload(), 20000);</script>
        </body></html>`,
      );
    } catch (err) {
      console.error('[pair] error:', err);
      return res.status(500).send('error: ' + err.message);
    }
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
