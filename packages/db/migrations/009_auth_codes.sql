-- Códigos de 6 dígitos enviados via WhatsApp para login no dashboard.
-- Hash em SHA-256 (não armazenamos o código em plaintext).
CREATE TABLE IF NOT EXISTS auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_phone_active
  ON auth_codes(phone, expires_at)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_codes_phone_created
  ON auth_codes(phone, created_at DESC);
