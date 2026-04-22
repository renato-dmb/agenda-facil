const { reviews, appointments, customers } = require('@agenda-facil/db');

const definition = {
  name: 'submit_review',
  description: `Registra a avaliação CSAT do cliente sobre um atendimento.
Use EXCLUSIVAMENTE quando o histórico contiver um marker de SISTEMA iniciando pós-atendimento
(ex: "[SISTEMA: pós-atendimento iniciado para appointment_id=...]"). Você é responsável por
extrair os dados da conversa natural com o cliente e chamar esta tool.

Regras:
- score é obrigatório (1–5, escala CSAT). Se o cliente disser "ótimo / ótima / excelente /
  adorei", interprete como 5; "bom/boa" como 4; "ok/normal/mais ou menos" como 3; "ruim" 2;
  "péssimo/horrível" 1. Se o cliente mandou um número, use o número.
- comment: texto aberto, opcional. Inclua o que o cliente falou de comentário livre,
  mesmo que seja curto. Se não teve comentário, deixe vazio.
- wants_return: true se o cliente manifestou interesse em agendar um retorno futuro;
  false se descartou; omita se não falou.
- return_interval_days: dias até o retorno desejado, quando wants_return=true.
  Se o cliente disse "em 2 semanas" → 14, "1 mês" → 30, etc. Se wants_return=true mas
  ele não especificou tempo, omita.

Depois que chamar esta tool, SE wants_return=true: imediatamente proponha o agendamento
— chame check_availability com a data calculada a partir da data do atendimento +
return_interval_days. Apresente 2-3 horários disponíveis e pergunte qual prefere.`,
  input_schema: {
    type: 'object',
    properties: {
      appointment_id: {
        type: 'string',
        description: 'ID (UUID) do appointment que está sendo avaliado — vem do marker de SISTEMA.',
      },
      score: {
        type: 'integer',
        minimum: 1,
        maximum: 5,
        description: 'Nota CSAT de 1 (péssimo) a 5 (excelente).',
      },
      comment: {
        type: 'string',
        description: 'Comentário livre do cliente (opcional, pode ser vazio).',
      },
      wants_return: {
        type: 'boolean',
        description: 'Cliente manifestou interesse em retorno futuro?',
      },
      return_interval_days: {
        type: 'integer',
        minimum: 1,
        maximum: 365,
        description: 'Dias até o retorno desejado (só se wants_return=true e cliente informou).',
      },
    },
    required: ['appointment_id', 'score'],
  },
};

async function execute(input, context) {
  const { tenant, customerPhone } = context;
  const appt = await appointments.getById(tenant.id, input.appointment_id);
  if (!appt) return { error: 'appointment não encontrado' };
  const customer = await customers.getByPhone(tenant.id, customerPhone);
  if (!customer) return { error: 'cliente não encontrado' };
  if (appt.customer_id !== customer.id) {
    return { error: 'appointment não pertence ao cliente desta conversa' };
  }

  const record = await reviews.upsert({
    tenantId: tenant.id,
    appointmentId: appt.id,
    customerId: customer.id,
    score: input.score,
    comment: input.comment,
    wantsReturn: input.wants_return,
    returnIntervalDays: input.return_interval_days,
  });

  return {
    ok: true,
    review_id: record.id,
    score: record.score,
    wants_return: record.wants_return,
    return_interval_days: record.return_interval_days,
    next_step: record.wants_return
      ? 'Agora proponha horários para o retorno do cliente — chame check_availability.'
      : 'Agradeça e encerre cordialmente.',
  };
}

module.exports = { definition, execute };
