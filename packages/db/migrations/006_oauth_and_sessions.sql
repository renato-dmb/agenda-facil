-- Tokens OAuth do Google por tenant (refresh token de longa duração)
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  google_account_email VARCHAR(200),
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  calendar_id VARCHAR(200) NOT NULL DEFAULT 'primary',
  scopes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Status da sessão Baileys por tenant (metadata; auth state fica em disco)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  auth_state_path VARCHAR(255),
  phone_number VARCHAR(20),
  connected_at TIMESTAMPTZ,
  last_disconnect_at TIMESTAMPTZ,
  last_disconnect_reason VARCHAR(255)
);
