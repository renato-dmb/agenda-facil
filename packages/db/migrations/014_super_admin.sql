-- Super-admin flag pra acesso ao painel /admin que lista todos os tenants.
-- Primeiro tenant criado pode ser promovido manualmente via UPDATE.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Cliente pode ter data de aniversário (opcional, pra campanhas) — feature U
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS birthday DATE;

CREATE INDEX IF NOT EXISTS idx_customers_birthday_md ON customers((EXTRACT(MONTH FROM birthday)), (EXTRACT(DAY FROM birthday)));
