process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum-ok';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgres://test:test@localhost:5433/agenda_facil_test';
process.env.BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001';
