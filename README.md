# agenda-facil

SaaS multi-tenant de agente de IA no WhatsApp para profissionais liberais (barbeiros, dentistas, psicólogos, personal trainers, etc.).

## O que faz

1. **Responde dúvidas** baseado numa base de conhecimento personalizada (markdown por tenant)
2. **Agenda / reagenda / cancela** compromissos no Google Calendar do profissional
3. **Reativa clientes inativos** automaticamente (recorrência após 14 dias sem retorno)

## Arquitetura

- **Bot server** — `apps/bot` — Node.js + Express + Baileys (WhatsApp) + Claude Sonnet 4.6
- **Dashboard** — `apps/dashboard` — Next.js (Fase 2, stub por enquanto)
- **DB** — `packages/db` — Postgres, schema multi-tenant (todas as tabelas com `tenant_id`)
- **Shared** — `packages/shared` — utils e config

Um único processo Node mantém múltiplas sessões Baileys simultaneamente (uma por profissional/tenant). Auth state segregado em `apps/bot/auth_state/{tenant_slug}/`.

## Stack

| Camada | Escolha |
|---|---|
| Runtime | Node.js 20+ |
| Gerenciador | pnpm workspaces |
| WhatsApp | `@whiskeysockets/baileys` |
| LLM | `claude-sonnet-4-6` (Anthropic SDK) |
| DB | Postgres |
| Cron | node-cron |
| Agenda | Google Calendar API (OAuth 2.0 por tenant) |
| Deploy bot | Railway |
| Deploy dashboard | Vercel |

## Setup local

Ver [`docs/onboarding-guide.md`](docs/onboarding-guide.md) para o passo-a-passo completo, incluindo como criar credenciais no Google Cloud Console e parear um novo profissional.

Resumo rápido:

```bash
pnpm install
cp apps/bot/.env.example apps/bot/.env   # preencha as variáveis
pnpm db:migrate
pnpm bot:seed
pnpm bot:oauth jeff-barbearia            # abre o navegador p/ OAuth do Google Calendar
pnpm bot:pair jeff-barbearia             # mostra QR code do WhatsApp
pnpm bot:dev
```

## Roadmap

Ver [`docs/roadmap.md`](docs/roadmap.md).

## Referência arquitetural

Adaptado do projeto `bot-lia` (pasta irmã, não modificar). Tudo que é multi-tenant foi adaptado aqui; partes não portadas (Instagram DM, transcrição de áudio Whisper, Notion como KB, escalação humana, tests de segurança) estão listadas no roadmap.
