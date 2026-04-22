-- Modo de atendimento do tenant:
--   'public'  = bot responde todos os contatos, exceto os listados em contact_list (bloqueados)
--   'private' = bot responde apenas os contatos listados em contact_list (liberados)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS audience_mode VARCHAR(10) NOT NULL DEFAULT 'public';

-- Lista de contatos do tenant. Significado depende do audience_mode:
--   public  → lista de quem o bot IGNORA
--   private → lista de quem o bot ATENDE
CREATE TABLE IF NOT EXISTS contact_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_contact_list_tenant_phone ON contact_list(tenant_id, phone);
