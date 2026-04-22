-- Contatos sincronizados do WhatsApp pareado. Não confundir com customers (que
-- são criados quando o cliente conversa com o bot) nem com contact_list (bypass).
-- Usado pro autocomplete ao criar agendamento manual no dashboard.
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  jid VARCHAR(120) NOT NULL,
  phone VARCHAR(20),
  push_name VARCHAR(200),
  verified_name VARCHAR(200),
  notify_name VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, jid)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_name ON whatsapp_contacts(tenant_id, push_name);
