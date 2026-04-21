module.exports = {
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'America/Sao_Paulo',
  MAX_TOOL_ITERATIONS: 8,
  RATE_LIMIT_MAX_PER_HOUR: 50,
  CLAUDE_MODEL: 'claude-sonnet-4-6',
  GOOGLE_CALENDAR_SCOPES: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
  ],
};
