const { google } = require('googleapis');
const { getAuthenticatedClient } = require('./oauth');

async function getCalendarClient(tenantId) {
  const { client, calendarId } = await getAuthenticatedClient(tenantId);
  const calendar = google.calendar({ version: 'v3', auth: client });
  return { calendar, calendarId };
}

module.exports = { getCalendarClient };
