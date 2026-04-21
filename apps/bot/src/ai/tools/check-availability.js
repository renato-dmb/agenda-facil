const gcal = require('../../integrations/google-calendar/events');
const { services } = require('@agenda-facil/db');
const {
  zonedStartOfDayIso,
  zonedEndOfDayIso,
  zonedDateTimeToIso,
  weekdayInTz,
  addMinutesIso,
} = require('../../utils/dates');

const definition = {
  name: 'check_availability',
  description:
    'Verifica horários disponíveis no dia solicitado, considerando a agenda do profissional (Google Calendar) e o horário de funcionamento. Use sempre que o cliente perguntar "que horas pode?", "tem horário amanhã?" ou similares. Retorna uma lista de horários livres em slots de 30 minutos (ajustados à duração do serviço, se fornecido).',
  input_schema: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Data no formato YYYY-MM-DD. Para "amanhã", converta usando a data de hoje no system prompt.',
      },
      service_id: {
        type: 'string',
        description: 'ID do serviço (UUID) para ajustar a duração. Opcional; se não informado, usa 30 minutos como default.',
      },
    },
    required: ['date'],
  },
};

function overlaps(slotStartIso, slotEndIso, busy) {
  const s = new Date(slotStartIso).getTime();
  const e = new Date(slotEndIso).getTime();
  return busy.some((b) => {
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return s < be && e > bs;
  });
}

async function execute(input, context) {
  const { tenant } = context;
  const { date } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: 'date must be YYYY-MM-DD' };
  }

  let durationMin = 30;
  if (input.service_id) {
    const svc = await services.getById(tenant.id, input.service_id);
    if (svc) durationMin = svc.duration_minutes;
  }

  const tz = tenant.timezone || 'America/Sao_Paulo';
  const dayStart = zonedStartOfDayIso(date, tz);
  const dayEnd = zonedEndOfDayIso(date, tz);

  const busy = await gcal.freeBusy(tenant.id, { timeMin: dayStart, timeMax: dayEnd });

  const hours = await services.listBusinessHours(tenant.id);
  const weekday = weekdayInTz(dayStart, tz);
  const windows = hours.filter((h) => h.weekday === weekday);
  if (windows.length === 0) {
    return { date, timezone: tz, available_slots: [], reason: 'no_business_hours_that_day' };
  }

  const slots = [];
  for (const w of windows) {
    let cursorIso = zonedDateTimeToIso(date, w.start_time.slice(0, 5), tz);
    const endIso = zonedDateTimeToIso(date, w.end_time.slice(0, 5), tz);
    while (new Date(cursorIso) < new Date(endIso)) {
      const slotEnd = addMinutesIso(cursorIso, durationMin);
      if (new Date(slotEnd) > new Date(endIso)) break;
      if (!overlaps(cursorIso, slotEnd, busy) && new Date(cursorIso) > new Date()) {
        slots.push({ start: cursorIso, end: slotEnd });
      }
      cursorIso = addMinutesIso(cursorIso, durationMin);
    }
  }

  return {
    date,
    timezone: tz,
    duration_minutes: durationMin,
    available_slots: slots.slice(0, 20),
    busy_count: busy.length,
  };
}

module.exports = { definition, execute };
