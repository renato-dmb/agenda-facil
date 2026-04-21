const gcal = require('../../integrations/google-calendar/events');
const { services, customers, appointments } = require('@agenda-facil/db');
const { addMinutesIso, humanDateTimeInTz } = require('../../utils/dates');

const definition = {
  name: 'create_appointment',
  description:
    'Cria um agendamento no Google Calendar do profissional e registra no sistema. Use quando o cliente confirmar a data/hora e serviço. Antes de chamar, confirme com o cliente o nome dele, o serviço escolhido e o horário.',
  input_schema: {
    type: 'object',
    properties: {
      customer_name: {
        type: 'string',
        description: 'Nome do cliente (peça se ainda não souber).',
      },
      service_id: {
        type: 'string',
        description: 'ID do serviço (UUID).',
      },
      start_time: {
        type: 'string',
        description: 'Horário de início no formato ISO 8601 (ex: 2026-04-22T10:00:00-03:00).',
      },
      notes: {
        type: 'string',
        description: 'Observações adicionais (opcional).',
      },
    },
    required: ['customer_name', 'service_id', 'start_time'],
  },
};

async function execute(input, context) {
  const { tenant, customerPhone } = context;
  const service = await services.getById(tenant.id, input.service_id);
  if (!service) {
    return { error: `service_id não encontrado: ${input.service_id}` };
  }
  const endIso = addMinutesIso(input.start_time, service.duration_minutes);
  const tz = tenant.timezone || 'America/Sao_Paulo';

  const customer = await customers.upsertByPhone(tenant.id, customerPhone, {
    name: input.customer_name,
  });

  const summary = `${service.name} — ${input.customer_name}`;
  const description = [
    `Cliente: ${input.customer_name}`,
    `Telefone: ${customerPhone}`,
    `Serviço: ${service.name}`,
    input.notes ? `Notas: ${input.notes}` : null,
    '',
    'Agendado via agenda-facil.',
  ]
    .filter(Boolean)
    .join('\n');

  const event = await gcal.createEvent(tenant.id, {
    summary,
    description,
    startIso: input.start_time,
    endIso,
    timezone: tz,
  });

  const record = await appointments.create({
    tenantId: tenant.id,
    customerId: customer.id,
    serviceId: service.id,
    startsAt: input.start_time,
    endsAt: endIso,
    googleEventId: event.id,
    notes: input.notes || null,
  });

  await customers.updateLastAppointmentAt(customer.id, input.start_time);

  return {
    appointment_id: record.id,
    google_event_id: event.id,
    service: service.name,
    starts_at: input.start_time,
    ends_at: endIso,
    human_readable: humanDateTimeInTz(input.start_time, tz),
  };
}

module.exports = { definition, execute };
