#!/usr/bin/env node
/**
 * CLI local para iniciar o fluxo OAuth 2.0 do Google para um tenant.
 * Uso: node scripts/oauth-setup.js <tenant_slug>
 *
 * O que faz:
 *  1. Carrega o tenant do banco pelo slug.
 *  2. Sobe um servidor HTTP efêmero na URI de redirect configurada.
 *  3. Abre o navegador na URL de autorização do Google.
 *  4. Ao receber o callback, troca o code por tokens e persiste em google_oauth_tokens.
 *  5. Encerra.
 */
require('dotenv/config');
const http = require('http');
const { URL } = require('url');
const { tenants, googleOAuth, pool } = require('@agenda-facil/db');
const { google } = require('googleapis');
const { config: sharedConfig } = require('@agenda-facil/shared');

async function openInBrowser(url) {
  try {
    const { default: open } = await import('open');
    return open(url);
  } catch (err) {
    console.warn('Could not open browser automatically:', err.message);
  }
}

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: oauth-setup.js <tenant_slug>');
  process.exit(1);
}

function requireEnv(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

async function main() {
  const tenant = await tenants.getBySlug(slug);
  if (!tenant) {
    console.error(`Tenant ${slug} not found. Run seed first.`);
    process.exit(1);
  }

  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = requireEnv('GOOGLE_OAUTH_REDIRECT_URI');

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: sharedConfig.GOOGLE_CALENDAR_SCOPES,
    state: slug,
  });

  const redirect = new URL(redirectUri);
  const port = Number(redirect.port) || 3001;
  const callbackPath = redirect.pathname;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname !== callbackPath) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code) {
        res.writeHead(400);
        res.end('missing code');
        return;
      }
      if (state !== slug) {
        res.writeHead(400);
        res.end('state mismatch');
        return;
      }

      const { tokens } = await oauth2.getToken(code);
      oauth2.setCredentials(tokens);

      let googleEmail = null;
      try {
        const oauth2api = google.oauth2({ version: 'v2', auth: oauth2 });
        const { data } = await oauth2api.userinfo.get();
        googleEmail = data.email || null;
      } catch (err) {
        console.warn('Could not fetch Google user email:', err.message);
      }

      if (!tokens.refresh_token) {
        console.warn('No refresh_token returned. If this tenant has authorized before, revoke access at myaccount.google.com and try again.');
      }

      await googleOAuth.upsert(tenant.id, {
        google_account_email: googleEmail,
        access_token: tokens.access_token || null,
        refresh_token: tokens.refresh_token || null,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        calendar_id: 'primary',
        scopes: sharedConfig.GOOGLE_CALENDAR_SCOPES.join(' '),
      });

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        `<html><body style="font-family: sans-serif; padding: 40px;">
          <h2>Conta conectada com sucesso</h2>
          <p>Tenant: <strong>${slug}</strong></p>
          <p>Conta Google: <strong>${googleEmail || 'desconhecida'}</strong></p>
          <p>Já pode fechar esta aba.</p>
        </body></html>`,
      );

      console.log(`\n✓ Google Calendar conectado para "${slug}" (${googleEmail || 'email desconhecido'})`);
      setTimeout(() => {
        server.close();
        pool.getPool().end().finally(() => process.exit(0));
      }, 500);
    } catch (err) {
      console.error('Callback error:', err);
      res.writeHead(500);
      res.end('error: ' + err.message);
      setTimeout(() => {
        server.close();
        pool.getPool().end().finally(() => process.exit(1));
      }, 500);
    }
  });

  server.listen(port, () => {
    console.log(`Listening on ${redirectUri}`);
    console.log(`Opening browser to authorize tenant "${slug}"...`);
    console.log(`If the browser does not open, paste this URL:\n${authUrl}\n`);
    openInBrowser(authUrl);
  });
}

main().catch((err) => {
  console.error('OAuth setup failed:', err);
  process.exit(1);
});
