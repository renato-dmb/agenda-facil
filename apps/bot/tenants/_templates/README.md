# Templates de base de conhecimento por profissão

Cada subpasta aqui é um conjunto de arquivos Markdown que servem como ponto de partida para onboarding de um novo tenant desse tipo de profissão.

Como usar:

1. Copie a subpasta do template (ex: `barbearia/`) para `apps/bot/tenants/{slug-do-tenant}/`.
2. Edite os arquivos trocando os placeholders `{NOME_PROFISSIONAL}`, `{ENDERECO}`, `{HORARIOS}`, etc. pelos dados reais.
3. Rode `pnpm bot:seed` (ou edite o seed) para criar o tenant no banco + seus serviços + horários.

Na Fase 2, o dashboard web automatiza esse passo — o profissional preenche um formulário que gera esses arquivos + inserts no banco.
