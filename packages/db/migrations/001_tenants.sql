-- tenants: um por profissional liberal atendido pelo produto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  profession_type VARCHAR(40) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
  whatsapp_number VARCHAR(20) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  recurrence_enabled BOOLEAN NOT NULL DEFAULT true,
  recurrence_trigger_days INT NOT NULL DEFAULT 14,
  recurrence_retry_days INT NOT NULL DEFAULT 7,
  recurrence_send_hour VARCHAR(5) NOT NULL DEFAULT '09:00',
  ai_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
