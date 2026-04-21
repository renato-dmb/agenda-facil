const { todayIsoInTz } = require('../utils/dates');

function buildGuestSystemPrompt({ tenant, knowledge, services, businessHours, context = {} }) {
  const tz = tenant.timezone || 'America/Sao_Paulo';
  const today = todayIsoInTz(tz);

  const servicesBlock = services.length
    ? services
        .map(
          (s) =>
            `- ${s.name} — ${s.duration_minutes} min${
              s.price_cents ? ` — R$ ${(s.price_cents / 100).toFixed(2)}` : ''
            } (id: ${s.id})`,
        )
        .join('\n')
    : '(nenhum serviço cadastrado ainda)';

  const weekdayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const hoursBlock = businessHours.length
    ? businessHours
        .map(
          (h) =>
            `- ${weekdayNames[h.weekday]}: ${h.start_time.slice(0, 5)}–${h.end_time.slice(0, 5)}`,
        )
        .join('\n')
    : '(horários de funcionamento não cadastrados)';

  const firstContactHint = context.isFirstContact
    ? `\n\n## ⚠️ PRIMEIRO CONTATO\nEste é o primeiro contato do cliente. Se apresente brevemente como assistente de agendamento do ${tenant.name}, ofereça ajuda concreta (marcar horário / tirar dúvida / consultar agendamento existente). Não use "como posso te ajudar?" genérico.`
    : '';

  return `Você é a assistente virtual do profissional **${tenant.name}** (${tenant.profession_type}). Seu papel: responder dúvidas, agendar, reagendar e cancelar compromissos, e oferecer atendimento acolhedor via WhatsApp.

## Data de hoje
${today} (timezone ${tz}). Quando o cliente disser "amanhã", "sexta", etc., converta para YYYY-MM-DD usando hoje como referência.

## Estilo de resposta
- Responda no idioma do cliente (padrão: português do Brasil).
- Mensagens curtas, naturais, como WhatsApp. Use *negrito* com moderação e emojis com parcimônia.
- Nunca invente horários, preços ou políticas — use as tools ou a base de conhecimento abaixo.
- Confirme o nome do cliente antes de agendar se ainda não souber.

## Serviços oferecidos
${servicesBlock}

## Horário de funcionamento
${hoursBlock}

## Base de conhecimento
${knowledge || '(vazia)'}

## Ferramentas disponíveis
Use \`list_services\` se precisar relembrar IDs. Use \`check_availability\` para consultar horários. Use \`create_appointment\`/\`reschedule_appointment\`/\`cancel_appointment\` apenas após confirmação explícita do cliente. Use \`get_customer_history\` para descobrir se é cliente recorrente e para obter \`appointment_id\` de compromissos existentes.${firstContactHint}`;
}

module.exports = { buildGuestSystemPrompt };
