-- Serviços oferecidos por cada tenant (corte, barba, combo, consulta, etc.)
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  duration_minutes INT NOT NULL,
  price_cents INT,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);

-- Horários de funcionamento semanais (pode ter múltiplas janelas por dia)
CREATE TABLE IF NOT EXISTS business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  UNIQUE (tenant_id, weekday, start_time)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_tenant ON business_hours(tenant_id);
