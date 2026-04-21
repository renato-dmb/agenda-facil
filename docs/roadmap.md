# Roadmap

## Fase 1 — MVP (atual)

- [x] Monorepo com pnpm workspaces
- [x] Schema multi-tenant (6 migrations)
- [x] Baileys multi-tenant (1 processo, N sessões)
- [x] Integração Google Calendar (OAuth + tools)
- [x] Claude tool use loop com 6 tools de agendamento
- [x] Scheduler minutely + recorrência diária às 8h BRT (estrutural)
- [x] Dispatcher da fila de mensagens agendadas
- [x] KB em Markdown por tenant
- [x] Templates de KB por profissão (começamos por barbearia)
- [x] CLI de onboarding manual (seed, oauth-setup, pair-whatsapp)
- [x] Deploy local validado
- [ ] Deploy Railway (bot) + configuração de variáveis prod
- [ ] Tenant Jeff ativo em produção, conectado ao WhatsApp real

## Fase 2 — Onboarding self-service

- [ ] Dashboard Next.js (auth, tenant CRUD, services, horários)
- [ ] OAuth Google iniciado pelo dashboard (state = session + tenantId)
- [ ] QR pairing WhatsApp exibido no dashboard
- [ ] Editor de KB Markdown com preview
- [ ] Wizard de onboarding por profissão (templates auto-preenchidos)
- [ ] Dashboard de agendamentos (visão de calendário embutida)
- [ ] Relatórios: clientes recorrentes, taxa de conversão de mensagem de recorrência, receita estimada recuperada
- [ ] Admin de tenants (só você) pra visão geral

## Fase 3 — Escala e canais adicionais

- [ ] Migração Baileys → WhatsApp Cloud API (oficial)
- [ ] Instagram Direct (Meta Graph API) — adaptando `router.js` como o bot-lia já tem
- [ ] Transcrição de áudio via Whisper (mesmo padrão do bot-lia)
- [ ] Notion como fonte opcional da KB (sincroniza para Markdown do repo)
- [ ] Escalação humana: quando o bot não sabe, avisa o profissional no WhatsApp dele
- [ ] Integração com PMS específicos (Trinks, Booksy, Belliz)
- [ ] Billing (Stripe)
- [ ] Verificação do OAuth app no Google (sair de modo test)

## Features do bot-lia não portadas (documentadas aqui pra lembrar)

Tudo abaixo existe no `bot-lia` e pode ser adaptado quando for a hora:

| Feature | Arquivo no bot-lia | Quando portar |
|---|---|---|
| Transcrição de áudio (Whisper) | `src/audio.js` | Fase 3 |
| Instagram DM | `src/instagram.js`, `src/index.js` (webhook) | Fase 3 |
| Notion como KB | `src/notion-kb.js`, `scripts/sync-notion-kb.js` | Fase 3 |
| Escalação humana para admin group | `src/guest-handler.js` (bloco `escalated`) | Fase 3 |
| Suite de testes de segurança (23 checks) | `test/security.js` | Fase 2 |
| Pre-push hook rodando security suite | `scripts/install-hooks.sh` | Fase 2 |
| Pairing code WhatsApp (alternativa ao QR) | `src/whatsapp.js:28-42` | Se algum profissional não quiser QR |
| Detecção de idioma (PT/EN/ES) pré-Claude | `src/utils.js:detectLanguage` | Se ganharmos clientes gringos |
| `find_bookable_windows` (busca de janelas alternativas) | `src/lodgify.js:findBookableWindows` | Se fizermos feature de "sugestão automática" |
| Backup diário da KB via GitHub Actions | `.github/workflows/notion-kb-backup.yml` | Fase 3 (junto com Notion) |

## Princípio

Avançar com o MVP real testado em produção (Jeff + barbeiro 2) antes de construir dashboard. O maior valor do produto é a **recorrência** — validar antes de polir.
