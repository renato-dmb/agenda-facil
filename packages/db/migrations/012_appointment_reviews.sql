-- CSAT pós-atendimento.
-- 1 review por appointment (unique).
-- score: 1-5 (escala CSAT clássica — 1 muito ruim, 5 excelente).
-- comment: livre, opcional.
-- wants_return + return_interval_days: opt-in do cliente pra recorrência
-- específica declarada no momento da pesquisa.
CREATE TABLE IF NOT EXISTS appointment_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  wants_return BOOLEAN,
  return_interval_days INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_tenant_created ON appointment_reviews(tenant_id, created_at DESC);
