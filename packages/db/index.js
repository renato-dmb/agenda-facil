module.exports = {
  pool: require('./pool'),
  tenants: require('./queries/tenants'),
  googleOAuth: require('./queries/google-oauth'),
  customers: require('./queries/customers'),
  appointments: require('./queries/appointments'),
  conversations: require('./queries/conversations'),
  messages: require('./queries/messages'),
  scheduled: require('./queries/scheduled'),
  services: require('./queries/services'),
  contacts: require('./queries/contacts'),
};
