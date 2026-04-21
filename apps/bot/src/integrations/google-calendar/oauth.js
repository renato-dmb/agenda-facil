const { google } = require('googleapis');
const { googleOAuth } = require('@agenda-facil/db');
const { config } = require('@agenda-facil/shared');

function requireEnv(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function createOAuth2Client() {
  return new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
    requireEnv('GOOGLE_OAUTH_REDIRECT_URI'),
  );
}

function generateAuthUrl(tenantSlug) {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: config.GOOGLE_CALENDAR_SCOPES,
    state: tenantSlug,
  });
}

async function exchangeCodeForTokens(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function getAuthenticatedClient(tenantId) {
  const record = await googleOAuth.getByTenantId(tenantId);
  if (!record) {
    throw new Error(`No Google OAuth tokens for tenant ${tenantId}. Run oauth-setup first.`);
  }
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: record.access_token,
    refresh_token: record.refresh_token,
    expiry_date: record.expires_at ? new Date(record.expires_at).getTime() : undefined,
  });

  client.on('tokens', async (tokens) => {
    try {
      if (tokens.access_token) {
        await googleOAuth.updateAccessToken(
          tenantId,
          tokens.access_token,
          tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        );
      }
    } catch (err) {
      console.error(`[google-oauth] Failed to persist refreshed token for ${tenantId}:`, err.message);
    }
  });

  if (!record.expires_at || new Date(record.expires_at).getTime() <= Date.now() + 60_000) {
    const { credentials } = await client.refreshAccessToken();
    await googleOAuth.updateAccessToken(
      tenantId,
      credentials.access_token,
      credentials.expiry_date ? new Date(credentials.expiry_date) : null,
    );
    client.setCredentials(credentials);
  }

  return { client, calendarId: record.calendar_id };
}

module.exports = {
  createOAuth2Client,
  generateAuthUrl,
  exchangeCodeForTokens,
  getAuthenticatedClient,
};
