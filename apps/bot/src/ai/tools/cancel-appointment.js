const gcal = require('../../integrations/calendar');
const { appointments } = require('@agenda-facil/db');
const { removeForAppointment } = require('../../scheduler/appointment-reminders');

const definition = {
  name: 'cancel_appointment',
  description:
    'Cancela um agendamento existente. Use quando o cliente pedir para cancelar. Sempre confirme com o cliente antes.',
  input_schema: {
    type: 'object',
    properties: {
      appointment_id: {
        type: 'string',
        description: 'ID (UUID) do agendamento existente.',
      },
      reason: {
        type: 'string',
        description: 'Motivo do cancelamento (opcional).',
      },
    },
    required: ['appointment_id'],
  },
};

async function execute(input, context) {
  const { tenant } = context;
  const appt = await appointments.getById(tenant.id, input.appointment_id);
  if (!appt) return { error: 'appointment_id não encontrado' };

  if (appt.google_event_id) {
    try {
      await gcal.deleteEvent(tenant.id, appt.google_event_id);
    } catch (err) {
      if (err.code !== 404 && err.code !== 410) throw err;
    }
  }
  await appointments.setStatus(appt.id, 'cancelled');
  await removeForAppointment(appt.id).catch(() => {});

  return {
    appointment_id: appt.id,
    status: 'cancelled',
    reason: input.reason || null,
  };
}

module.exports = { definition, execute };
