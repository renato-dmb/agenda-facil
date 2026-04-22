-- Base de conhecimento editável por tenant — substitui (com fallback) os
-- arquivos markdown de apps/bot/tenants/{slug}/*.md. Cada tenant tem 5 seções:
--   services, hours, policies, faq, tone
CREATE TABLE IF NOT EXISTS knowledge_sections (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  section VARCHAR(40) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, section)
);
