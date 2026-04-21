-- owner_phone: número E.164 do profissional dono do tenant.
-- Usado para autorizar comandos administrativos (/pausar, /retomar, /status)
-- recebidos via WhatsApp a partir do próprio número.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_tenants_owner_phone ON tenants(owner_phone);
