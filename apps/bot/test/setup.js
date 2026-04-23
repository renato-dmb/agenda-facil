// Global test setup — roda antes de cada arquivo de teste.
// Carrega .env do bot pra E2E ter acesso à ANTHROPIC_API_KEY real.
try {
  require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
} catch {
  // ignore — sem .env, usa defaults abaixo
}
process.env.NODE_ENV = 'test';
process.env.DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'America/Sao_Paulo';
// Em teste, DATABASE_URL aponta sempre pro banco de teste (override do .env).
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5433/agenda_facil_test';

// Chaves dummy pra código que inicializa clientes no require.
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-openai-test';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-secret';
process.env.GOOGLE_OAUTH_REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3001/oauth/google/callback';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum-ok';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
