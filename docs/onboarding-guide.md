# Onboarding — como adicionar um profissional novo (Fase 1, manual)

Este guia é o passo-a-passo para trazer um novo profissional liberal para o agenda-facil **enquanto não existe dashboard web**. Na Fase 2 esse fluxo vira um formulário; por enquanto, é CLI + edição de arquivos.

## Pré-requisitos (1× por máquina)

1. **Postgres rodando** localmente (Docker, Homebrew, ou um banco Railway).
2. **Credenciais OAuth do Google Cloud**:
   - Criar projeto em <https://console.cloud.google.com/>
   - Habilitar **Google Calendar API**
   - Criar **OAuth 2.0 Client ID** tipo "Web application"
   - Redirect URI: `http://localhost:3001/oauth/google/callback`
   - Em "OAuth consent screen" → adicionar cada profissional como **test user** enquanto o app não estiver verificado pelo Google
   - Copiar Client ID e Client Secret para `apps/bot/.env`
3. **`ANTHROPIC_API_KEY`** em `apps/bot/.env`
4. Rodar `pnpm install` e `pnpm db:migrate`

## Onboarding de um novo profissional

### 1. Definir o slug e dados básicos

Edite `apps/bot/scripts/seed-tenants.js` adicionando uma entrada no array `SEEDS`:

```js
{
  slug: 'joao-barber-shop',                 // kebab-case, único, URL-safe
  name: 'Barbearia do João',
  profession_type: 'barbearia',             // barbearia | odonto | psicologia | ...
  timezone: 'America/Sao_Paulo',
  whatsapp_number: null,                    // preenche depois do pairing
  status: 'pending',
  services: [
    { name: 'Corte', duration_minutes: 30, price_cents: 5000, display_order: 1 },
    // ...
  ],
  business_hours: [
    { weekday: 2, start_time: '09:00', end_time: '19:00' },
    // 0=dom, 6=sáb
  ],
  scheduled_messages: [
    {
      name: 'recorrencia_14_dias',
      trigger_type: 'recurrence_since_last_appointment',
      offset_days: 14,
      send_hour: '09:00',
      content_type: 'template',
      content: 'Oi {first_name}! Já faz um tempo — bora agendar?',
      active: true,
    },
  ],
},
```

Rode `pnpm bot:seed` (é idempotente).

### 2. Criar a base de conhecimento do profissional

Copie o template e customize:

```bash
cp -R apps/bot/tenants/_templates/barbearia apps/bot/tenants/joao-barber-shop
# edite: services.md, hours.md, policies.md, faq.md, tone.md
```

### 3. Conectar o Google Calendar do profissional

Com o bot rodando (`pnpm bot:dev`) OU rodando o CLI isoladamente:

```bash
pnpm bot:oauth joao-barber-shop
```

O script abre o navegador. O profissional loga na conta Google dele e autoriza. Token é salvo no banco.

### 4. Parear o WhatsApp do profissional

```bash
pnpm bot:pair joao-barber-shop
```

QR code aparece no terminal. O profissional abre WhatsApp no celular → Configurações → Aparelhos conectados → Conectar um aparelho → escaneia. `auth_state/joao-barber-shop/` é salvo. Após o primeiro pareamento, a sessão persiste entre restarts (não precisa parear de novo).

### 5. Atualizar status para `active`

No Postgres:

```sql
UPDATE tenants SET status = 'active',
                   whatsapp_number = '5511999999999'
 WHERE slug = 'joao-barber-shop';
```

(O `whatsapp_number` é útil para identificar tenant em cenários futuros; a sessão Baileys por si só já mantém o vínculo em memória.)

### 6. Reiniciar o bot

`pnpm bot:dev` — no boot, todos os tenants com `status IN ('active', 'pending')` têm suas sessões Baileys iniciadas.

### 7. Testar

Mande uma mensagem pro número pareado. Bot deve:
- Se apresentar como assistente da "Barbearia do João" (pelo nome do tenant).
- Consultar KB ao responder dúvidas.
- Usar `check_availability` ao perguntar por horários.
- Criar evento no Google Calendar do João ao confirmar agendamento.
- Registrar em `appointments`, `customers`, `message_log` com o `tenant_id` correto.

## Solução de problemas

- **OAuth não salva refresh_token**: isso acontece se o profissional já autorizou o app antes. Peça que ele revogue acesso em <https://myaccount.google.com/permissions> e refaça o OAuth.
- **QR code some rápido**: gere de novo rodando `pnpm bot:pair` novamente. O auth_state só é salvo após pareamento bem-sucedido.
- **Bot não responde**: cheque `/health` (`curl http://localhost:3001/health`) pra confirmar que a sessão daquele tenant está conectada.
