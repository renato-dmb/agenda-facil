-- Catálogo de mensagens programadas por tenant (recorrência, lembrete pré-atendimento, pós-atendimento)
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  offset_days INT NOT NULL DEFAULT 0,
  send_hour VARCHAR(5) NOT NULL,
  content_type VARCHAR(20) NOT NULL DEFAULT 'template',
  content TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_tenant ON scheduled_messages(tenant_id) WHERE active = true;

-- Fila concreta: 1 row por (cliente, mensagem, ciclo)
CREATE TABLE IF NOT EXISTS scheduled_message_queue (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scheduled_message_id UUID NOT NULL REFERENCES scheduled_messages(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  retry_count INT NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_pending ON scheduled_message_queue(send_at) WHERE sent = false;
CREATE INDEX IF NOT EXISTS idx_queue_tenant ON scheduled_message_queue(tenant_id, sent, send_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_customer_message_day
  ON scheduled_message_queue(customer_id, scheduled_message_id, ((COALESCE(last_retry_at, created_at))::date));
