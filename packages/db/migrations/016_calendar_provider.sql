-- Suporte a múltiplos provedores de agenda (Google Calendar, Avec, etc).
-- Cada tenant escolhe qual usar. Default mantém 'google' pra não quebrar
-- os tenants existentes que já têm OAuth Google ativo.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS calendar_provider VARCHAR(20) NOT NULL DEFAULT 'google';

-- Tabela genérica de credenciais externas por tenant — serve pra qualquer
-- provedor não-OAuth (ex: Avec usa token estático). Key/Value em JSONB.
CREATE TABLE IF NOT EXISTS external_credentials (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, provider)
);
