# ADR 002 — Google Calendar API (não iCal)

**Status:** aceito — 2026-04-21

## Contexto

O bot precisa ler e escrever na agenda do profissional. Opções consideradas:

- **(a)** Google Calendar API (OAuth 2.0 por tenant, refresh token) ✅
- **(b)** iCal read-only + escrita via email (Quick Add)
- **(c)** CalDAV

## Decisão

**(a)** Google Calendar API.

## Por quê

- **Duas vias completas** (leitura de disponibilidade + criação/edição/exclusão de eventos) — iCal só oferece leitura.
- **Refresh token de longa duração** — depois do primeiro consentimento, o bot age sozinho, sem intervenção.
- **SDK oficial maduro** (`googleapis`) com paginação, retry, suporte a freeBusy.
- Google Calendar é o calendário mais usado por profissionais liberais no Brasil; compatibilidade direta.

## Trade-offs aceitos

- **Requer Google Cloud project próprio e verificação do OAuth app** para sair do modo test (hoje só até 100 test users). Planejamos verificar quando passar de 20 tenants.
- **Cliente precisa ter/criar conta Google** — se um dia um profissional quiser usar Apple Calendar ou Outlook, precisamos de outro adapter. Registrado no roadmap Fase 3.
- **Rate limits da Google Calendar API** — 1M queries/dia, suficiente pro MVP. Pré-computamos `freeBusy` em vez de listar eventos para minimizar quota.

## Detalhes de implementação

- Escopos: `calendar.events` (criar/editar/deletar) + `calendar.readonly` (listar).
- `calendar_id` default: `primary` (agenda principal do Google do profissional). É por-tenant, então um profissional pode optar por um calendário dedicado dele.
- Tokens armazenados em `google_oauth_tokens` (1 row por tenant). `access_token` refrescado sob demanda via `oauth.js:getAuthenticatedClient`.
