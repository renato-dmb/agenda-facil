const { services } = require('@agenda-facil/db');

const definition = {
  name: 'list_services',
  description:
    'Lista os serviços oferecidos pelo profissional com ID, nome, duração e preço. Use no início da conversa quando o cliente perguntar "o que vocês fazem?" ou antes de agendar para saber os IDs corretos.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

async function execute(_input, context) {
  const { tenant } = context;
  const rows = await services.listActive(tenant.id);
  return {
    services: rows.map((s) => ({
      id: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      price_reais: s.price_cents ? (s.price_cents / 100).toFixed(2) : null,
    })),
  };
}

module.exports = { definition, execute };
