# Arquitetura — agenda-facil

Visão técnica do produto. Para escopo de produto, ver o [README.md](../README.md) raiz.

## Diagrama de componentes

```
┌────────────────────────────────┐         ┌────────────────────────────┐
│        Clientes (WhatsApp)     │         │     Dashboard (Vercel)     │
│    — 1 para cada profissional  │         │     Next.js — Fase 2       │
└──────────────┬─────────────────┘         └────────────┬───────────────┘
               │ Baileys WS                             │ HTTPS
               ▼                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Bot server (Railway)                            │
│                                                                        │
│   ┌─────────────┐   ┌──────────────┐   ┌──────────────────────────┐    │
│   │ baileys-    │   │   router +   │   │  Claude (tool use loop)  │    │
│   │ manager     │──▶│ guest-handler│──▶│  + KB (markdown/tenant)  │    │
│   │ Map<tId,sck>│   │              │   │  + tools (GCal/DB)       │    │
│   └─────────────┘   └──────────────┘   └──────────────────────────┘    │
│          │                                          │                  │
│          │                                          │                  │
│   ┌──────▼───────┐                            ┌─────▼─────────┐        │
│   │ auth_state/  │                            │ Google        │        │
│   │ {slug}/      │                            │ Calendar API  │        │
│   └──────────────┘                            └───────────────┘        │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ Scheduler (node-cron)                                        │     │
│   │  • minutely  → dispatcher (envia fila)                       │     │
│   │  • daily 8h  → recurrence-engine (enfileira clientes         │     │
│   │                 inativos 14+ dias)                           │     │
│   └──────────────────────────────────────────────────────────────┘     │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │ Postgres       │
                        │ (Railway)      │
                        │ multi-tenant   │
                        └────────────────┘
```

## Multi-tenancy

Modelo: **1 processo Node mantém múltiplas sessões Baileys simultâneas**. Um `Map<tenantId, BaileysSocket>` em memória.

- **Identificação do tenant** em mensagens entrantes: via closure — cada `connectTenant(tenant, ...)` registra handlers que já conhecem o `tenantId`.
- **Auth state**: `apps/bot/auth_state/{slug}/` — segregado, gitignored.
- **Escalonamento**: até ~50–100 sessões/processo. Além disso, migrar para WhatsApp Cloud API (oficial) ou dividir em múltiplos processos.

Toda query SQL escopa por `tenant_id`. Nenhum dado vaza entre tenants.

## Fluxo de mensagem entrante

1. `messages.upsert` do socket de um tenant chega em `baileys-manager.js`.
2. `messageHandler(msg, { tenantId, tenant })` chamado em `apps/bot/src/index.js`.
3. `router.js` faz dedup (`message_log`), ignora grupos/status, retorna `{ mode: 'guest', phone, text, ...}`.
4. `guest-handler.js` aplica rate limit, carrega KB + services + horários + histórico da conversa, monta system prompt dinâmico, chama `claude.js`.
5. `claude.js` entra no loop de tool use (até 8 iterações) com as tools registradas em `ai/tools/index.js`.
6. Cada tool recebe `context = { tenant, customerPhone }` e acessa Google Calendar (`integrations/google-calendar/`) e o banco.
7. Resposta final do Claude vai pro WhatsApp via `baileys-manager.sendText(tenantId, jid, text)` e é logada no `message_log`.

## Scheduler & recorrência

Dois cron jobs (node-cron):

- **`* * * * *` — dispatcher**: pega `scheduled_message_queue WHERE sent=false AND send_at<=NOW() LIMIT 20`. Renderiza template (`{first_name}`) e envia.
- **`0 8 * * *` (BRT) — recurrence-engine**: para cada tenant ativo com `recurrence_enabled=true`, identifica clientes cujo `last_appointment_at <= NOW() - trigger_days` (14 por default) e que não têm appointment futuro, enfileira a mensagem `recurrence_since_last_appointment` (quando configurada). Idempotente via UNIQUE `(customer_id, scheduled_message_id, dia)`.

Retry a cada `retry_days` (7 por default) é controlado pelo filtro `hasInboundSince` — se cliente não respondeu, enfileira novamente.

## Integração Google Calendar

OAuth 2.0 com refresh token **por tenant**, armazenado em `google_oauth_tokens`. O token de acesso é renovado sob demanda (ver `oauth.js:getAuthenticatedClient`).

**Escopos:** `calendar.events` + `calendar.readonly`.

**Operações usadas:**
- `freeBusy.query` — disponibilidade em um intervalo
- `events.insert` — criar agendamento
- `events.patch` — reagendar
- `events.delete` — cancelar
- `events.list` — backup quando precisar enumerar

O `calendar_id` default é `primary`, mas é por-tenant — um profissional pode optar por um calendário dedicado.

## Dashboards observacionais

Fora de escopo na Fase 1. Visibilidade atual: logs estruturados (`pino`) + rota `/health` listando sessões conectadas.

## Tabelas principais

Ver `packages/db/migrations/` para DDL completa. Todas as tabelas principais têm `tenant_id`.

| Tabela | Propósito |
|---|---|
| `tenants` + `tenant_settings` | Profissional + preferências (recorrência, timezone) |
| `services` + `business_hours` | Catálogo e horários do tenant |
| `customers` + `appointments` | Clientes e agendamentos (espelho do GCal) |
| `conversations` + `message_log` | Estado de conversa + audit |
| `scheduled_messages` + `scheduled_message_queue` | Motor de mensagens agendadas |
| `google_oauth_tokens` + `whatsapp_sessions` | Auth por tenant |

## Decisões registradas

- [ADR 001 — Multi-tenant em processo único](adrs/001-multitenant-in-single-process.md)
- [ADR 002 — Google Calendar (API) em vez de iCal](adrs/002-google-calendar-over-ical.md)
