/**
 * Roteador universal de provedores de agenda.
 *
 * Interface esperada de cada driver:
 *
 *   freeBusy(tenantId, { timeMin, timeMax }) -> Array<{ start: iso, end: iso }>
 *   listEvents(tenantId, { timeMin, timeMax, maxResults }) -> Array<event>
 *   createEvent(tenantId, { summary, description, startIso, endIso, timezone, attendees })
 *       -> { id, ... }
 *   updateEvent(tenantId, eventId, patch) -> event
 *   deleteEvent(tenantId, eventId) -> void
 *
 * Tools do Claude e endpoints do dashboard chamam via este router; o
 * provedor concreto é decidido pelo tenant.calendar_provider.
 */

const { tenants } = require('@agenda-facil/db');

const DRIVERS = {
  google: () => require('../google-calendar/events'),
  avec: () => require('./avec/events'),
};

async function resolveDriver(tenantId) {
  const t = await tenants.getById(tenantId);
  const providerId = t?.calendar_provider || 'google';
  const factory = DRIVERS[providerId];
  if (!factory) {
    throw new Error(`calendar_provider desconhecido: ${providerId}`);
  }
  return { provider: providerId, driver: factory() };
}

async function freeBusy(tenantId, opts) {
  const { driver } = await resolveDriver(tenantId);
  return driver.freeBusy(tenantId, opts);
}

async function listEvents(tenantId, opts) {
  const { driver } = await resolveDriver(tenantId);
  return driver.listEvents(tenantId, opts);
}

async function createEvent(tenantId, opts) {
  const { driver } = await resolveDriver(tenantId);
  return driver.createEvent(tenantId, opts);
}

async function updateEvent(tenantId, eventId, patch) {
  const { driver } = await resolveDriver(tenantId);
  return driver.updateEvent(tenantId, eventId, patch);
}

async function deleteEvent(tenantId, eventId) {
  const { driver } = await resolveDriver(tenantId);
  return driver.deleteEvent(tenantId, eventId);
}

async function providerOf(tenantId) {
  const { provider } = await resolveDriver(tenantId);
  return provider;
}

module.exports = {
  freeBusy,
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  providerOf,
};
