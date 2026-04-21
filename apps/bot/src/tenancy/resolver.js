const { tenants } = require('@agenda-facil/db');

const byId = new Map();
const byWhatsApp = new Map();

async function loadAllActive() {
  const rows = await tenants.listActive();
  byId.clear();
  byWhatsApp.clear();
  for (const row of rows) {
    byId.set(row.id, row);
    if (row.whatsapp_number) byWhatsApp.set(row.whatsapp_number, row);
  }
  return rows;
}

function cachedById(tenantId) {
  return byId.get(tenantId) || null;
}

function cachedByWhatsApp(number) {
  return byWhatsApp.get(number) || null;
}

async function refreshTenant(tenantId) {
  const row = await tenants.getById(tenantId);
  if (row) {
    byId.set(row.id, row);
    if (row.whatsapp_number) byWhatsApp.set(row.whatsapp_number, row);
  }
  return row;
}

module.exports = { loadAllActive, cachedById, cachedByWhatsApp, refreshTenant };
