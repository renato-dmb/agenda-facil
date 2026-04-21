const { formatInTimeZone, fromZonedTime, toZonedTime } = require('date-fns-tz');
const { format } = require('date-fns');

function nowIso() {
  return new Date().toISOString();
}

function todayIsoInTz(timezone) {
  return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
}

function humanDateTimeInTz(iso, timezone) {
  return formatInTimeZone(new Date(iso), timezone, "dd/MM/yyyy 'às' HH:mm");
}

function zonedStartOfDayIso(dateYmd, timezone) {
  return fromZonedTime(`${dateYmd}T00:00:00`, timezone).toISOString();
}

function zonedEndOfDayIso(dateYmd, timezone) {
  return fromZonedTime(`${dateYmd}T23:59:59`, timezone).toISOString();
}

function zonedDateTimeToIso(dateYmd, hhmm, timezone) {
  return fromZonedTime(`${dateYmd}T${hhmm}:00`, timezone).toISOString();
}

function addMinutesIso(iso, minutes) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function weekdayInTz(iso, timezone) {
  const zoned = toZonedTime(new Date(iso), timezone);
  return zoned.getDay();
}

module.exports = {
  nowIso,
  todayIsoInTz,
  humanDateTimeInTz,
  zonedStartOfDayIso,
  zonedEndOfDayIso,
  zonedDateTimeToIso,
  addMinutesIso,
  weekdayInTz,
  format,
};
