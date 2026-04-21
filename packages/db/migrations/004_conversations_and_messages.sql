-- Conversas ativas por (tenant, telefone)
CREATE TABLE IF NOT EXISTS conversations (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'ai_active',
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  state_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, phone)
);

-- Audit log de mensagens (dedup + histórico)
CREATE TABLE IF NOT EXISTS message_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wa_message_id VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  direction VARCHAR(3) NOT NULL CHECK (direction IN ('in', 'out')),
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, wa_message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_log_tenant_phone ON message_log(tenant_id, phone, created_at DESC);
