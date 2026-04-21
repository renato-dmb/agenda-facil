const { getCalendarClient } = require('./client');

async function freeBusy(tenantId, { timeMin, timeMax }) {
  const { calendar, calendarId } = await getCalendarClient(tenantId);
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: calendarId }],
    },
  });
  const busy = res.data.calendars?.[calendarId]?.busy || [];
  return busy.map((b) => ({ start: b.start, end: b.end }));
}

async function listEvents(tenantId, { timeMin, timeMax, maxResults = 50 }) {
  const { calendar, calendarId } = await getCalendarClient(tenantId);
  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults,
  });
  return res.data.items || [];
}

async function createEvent(tenantId, { summary, description, startIso, endIso, timezone, attendees }) {
  const { calendar, calendarId } = await getCalendarClient(tenantId);
  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,
      description,
      start: { dateTime: startIso, timeZone: timezone },
      end: { dateTime: endIso, timeZone: timezone },
      attendees,
    },
  });
  return res.data;
}

async function updateEvent(tenantId, eventId, patch) {
  const { calendar, calendarId } = await getCalendarClient(tenantId);
  const res = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: patch,
  });
  return res.data;
}

async function deleteEvent(tenantId, eventId) {
  const { calendar, calendarId } = await getCalendarClient(tenantId);
  await calendar.events.delete({ calendarId, eventId });
}

module.exports = { freeBusy, listEvents, createEvent, updateEvent, deleteEvent };
