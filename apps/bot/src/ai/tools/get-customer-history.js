const { customers, appointments } = require('@agenda-facil/db');
const { humanDateTimeInTz } = require('../../utils/dates');

const definition = {
  name: 'get_customer_history',
  description:
    'Retorna o histórico deste cliente: agendamentos passados e futuros. Use para personalizar a conversa, descobrir appointment_id para reagendamento/cancelamento, ou saber se é um cliente recorrente.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

async function execute(_input, context) {
  const { tenant, customerPhone } = context;
  const customer = await customers.getByPhone(tenant.id, customerPhone);
  if (!customer) return { found: false, past: [], upcoming: [] };

  const all = await appointments.listByCustomer(tenant.id, customer.id);
  const tz = tenant.timezone || 'America/Sao_Paulo';
  const now = Date.now();
  const past = [];
  const upcoming = [];

  for (const a of all) {
    const item = {
      appointment_id: a.id,
      service_id: a.service_id,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      status: a.status,
      human_readable: humanDateTimeInTz(a.starts_at, tz),
    };
    if (new Date(a.starts_at).getTime() > now && a.status === 'confirmed') {
      upcoming.push(item);
    } else {
      past.push(item);
    }
  }

  return {
    found: true,
    customer: { name: customer.name, phone: customer.phone },
    past: past.slice(0, 10),
    upcoming,
  };
}

module.exports = { definition, execute };
