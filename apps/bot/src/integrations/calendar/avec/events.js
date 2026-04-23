/**
 * Driver Avec Beauty (placeholder).
 *
 * Implementação real espera: (1) credenciais reais do tenant obtidas em
 * external_credentials (key='avec', config={ token, base_url, store_id, staff_id });
 * (2) documentação completa dos endpoints de disponibilidade, criação, edição
 * e cancelamento de agendamento.
 *
 * Até lá, todos os métodos lançam exceção — configurar calendar_provider='avec'
 * num tenant sem que o driver esteja pronto vai quebrar visivelmente em vez
 * de falhar silenciosamente.
 */

const { externalCreds } = require('@agenda-facil/db');

async function loadConfig(tenantId) {
  const cfg = await externalCreds.get(tenantId, 'avec');
  if (!cfg?.token || !cfg?.base_url) {
    const err = new Error(
      'Avec não configurado para este tenant. Cadastre token e base_url em external_credentials.',
    );
    err.code = 'avec_not_configured';
    throw err;
  }
  return cfg;
}

function notImplemented(action) {
  const err = new Error(
    `Avec driver: ${action} não implementado. Documentação completa da API Avec ainda não fornecida.`,
  );
  err.code = 'avec_not_implemented';
  return err;
}

async function freeBusy(tenantId, _opts) {
  await loadConfig(tenantId);
  throw notImplemented('freeBusy');
}

async function listEvents(tenantId, _opts) {
  await loadConfig(tenantId);
  throw notImplemented('listEvents');
}

async function createEvent(tenantId, _opts) {
  await loadConfig(tenantId);
  throw notImplemented('createEvent');
}

async function updateEvent(tenantId, _id, _patch) {
  await loadConfig(tenantId);
  throw notImplemented('updateEvent');
}

async function deleteEvent(tenantId, _id) {
  await loadConfig(tenantId);
  throw notImplemented('deleteEvent');
}

module.exports = {
  freeBusy,
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
};
