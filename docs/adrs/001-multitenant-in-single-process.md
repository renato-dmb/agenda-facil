# ADR 001 — Multi-tenant em processo único

**Status:** aceito — 2026-04-21

## Contexto

O agenda-facil serve múltiplos profissionais liberais. Cada profissional tem seu próprio número de WhatsApp, agenda Google, base de conhecimento. Precisamos decidir se o bot roda como:

- **(a)** Um processo Node por profissional (N processos)
- **(b)** Um processo Node que mantém N sessões Baileys simultâneas em memória

## Decisão

Escolhido **(b)**: processo único com `Map<tenantId, BaileysSocket>`.

## Por quê

- **Menor complexidade operacional** no MVP — 1 deploy no Railway, não N.
- Baileys 7.x aguenta múltiplas sessões simultâneas sem conflito (cada uma tem seu WebSocket e auth_state separados).
- Memória por sessão é baixa (~50–100 MB) — cabem ~20–30 sessões em um dyno pequeno do Railway.
- Auth state é segregado por diretório (`auth_state/{slug}/`) — zero risco de cross-tenant.

## Trade-offs aceitos

- **Crash de uma sessão pode derrubar todas**: mitigado com try/catch em callbacks e reconexão automática. Se virar problema, adicionamos supervision via PM2.
- **Rate limit WhatsApp compartilhado**: todas as sessões vêm do mesmo IP público. Mitigamos com `sendText` tendo jitter (1.5–2.5s entre mensagens).

## Quando revisar

Trocar para **(a)** (ou ir direto para WhatsApp Cloud API) quando:
- Atingirmos ~50–100 tenants ativos.
- Ou quando uma sessão crashar e causar incidente com outras.
- Ou quando o Google verificar nosso app e pudermos sair do modo test OAuth.
