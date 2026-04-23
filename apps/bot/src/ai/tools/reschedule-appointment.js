const gcal = require('../../integrations/calendar');
const { appointments } = require('@agenda-facil/db');
const { addMinutesIso, humanDateTimeInTz } = require('../../utils/dates');
const { syncForAppointment } = require('../../scheduler/appointment-reminders');

const definition = {
  name: 'reschedule_appointment',
  description:
    'Reagenda um compromisso existente para um novo horário. Use quando o cliente pedir para mudar o horário de um agendamento.',
  input_schema: {
    type: 'object',
    properties: {
      appointment_id: {
        type: 'string',
        description: 'ID (UUID) do agendamento existente. Use get_customer_history para descobrir.',
      },
      new_start_time: {
        type: 'string',
        description: 'Novo horário de início em ISO 8601.',
      },
    },
    required: ['appointment_id', 'new_start_time'],
  },
};

async function execute(input, context) {
  const { tenant } = context;
  const appt = await appointments.getById(tenant.id, input.appointment_id);
  if (!appt) return { error: 'appointment_id não encontrado' };

  const durationMs = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
  const durationMin = Math.round(durationMs / 60000);
  const newEndIso = addMinutesIso(input.new_start_time, durationMin);
  const tz = tenant.timezone || 'America/Sao_Paulo';

  if (appt.google_event_id) {
    await gcal.updateEvent(tenant.id, appt.google_event_id, {
      start: { dateTime: input.new_start_time, timeZone: tz },
      end: { dateTime: newEndIso, timeZone: tz },
    });
  }

  await appointments.updateTimes(appt.id, input.new_start_time, newEndIso);

  // Atualiza horários dos lembretes para o novo starts_at/ends_at
  syncForAppointment(appt.id).catch((err) =>
    console.error(`[reschedule_appointment:${tenant.slug}] reminder sync failed:`, err.message),
  );

  return {
    appointment_id: appt.id,
    new_starts_at: input.new_start_time,
    new_ends_at: newEndIso,
    human_readable: humanDateTimeInTz(input.new_start_time, tz),
  };
}

module.exports = { definition, execute };
