const checkAvailability = require('./check-availability');
const createAppointment = require('./create-appointment');
const rescheduleAppointment = require('./reschedule-appointment');
const cancelAppointment = require('./cancel-appointment');
const getCustomerHistory = require('./get-customer-history');
const listServices = require('./list-services');

const ALL_TOOLS = [
  listServices,
  checkAvailability,
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  getCustomerHistory,
];

function toolDefinitions() {
  return ALL_TOOLS.map((t) => t.definition);
}

async function executeTool(name, input, context) {
  const tool = ALL_TOOLS.find((t) => t.definition.name === name);
  if (!tool) return { error: `Unknown tool: ${name}` };
  return tool.execute(input, context);
}

module.exports = { toolDefinitions, executeTool };
