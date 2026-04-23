const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const DEFAULT_TEST_URL = 'postgres://test:test@localhost:5433/agenda_facil_test';

function testDatabaseUrl() {
  return process.env.TEST_DATABASE_URL || DEFAULT_TEST_URL;
}

function makeTestPool() {
  return new Pool({
    connectionString: testDatabaseUrl(),
    ssl: false,
  });
}

async function applyMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const already = new Set(rows.map((r) => r.filename));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (already.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}

const USER_TABLES = [
  'scheduled_message_queue',
  'scheduled_messages',
  'appointment_reviews',
  'message_log',
  'conversations',
  'appointments',
  'customers',
  'whatsapp_contacts',
  'contact_list',
  'business_hours',
  'services',
  'knowledge_entries',
  'auth_codes',
  'external_credentials',
  'google_oauth_tokens',
  'whatsapp_sessions',
  'tenant_settings',
  'tenants',
];

async function truncateAll(pool) {
  const existing = [];
  for (const t of USER_TABLES) {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
      [t],
    );
    if (rowCount) existing.push(t);
  }
  if (!existing.length) return;
  await pool.query(`TRUNCATE ${existing.join(', ')} RESTART IDENTITY CASCADE`);
}

async function setupTestDb() {
  process.env.DATABASE_URL = testDatabaseUrl();
  const pool = makeTestPool();
  await applyMigrations(pool);
  await pool.end();
}

async function resetTestDb(sharedPool) {
  const pool = sharedPool || makeTestPool();
  await truncateAll(pool);
  if (!sharedPool) await pool.end();
}

async function seedTenant(pool, overrides = {}) {
  const defaults = {
    slug: `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: 'Tenant Teste',
    profession_type: 'barbearia',
    timezone: 'America/Sao_Paulo',
    whatsapp_number: `5511${Math.floor(900000000 + Math.random() * 99999999)}`,
    status: 'active',
    calendar_provider: 'google',
  };
  const merged = { ...defaults, ...overrides };
  const { rows } = await pool.query(
    `INSERT INTO tenants (slug, name, profession_type, timezone, whatsapp_number, status, calendar_provider)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      merged.slug,
      merged.name,
      merged.profession_type,
      merged.timezone,
      merged.whatsapp_number,
      merged.status,
      merged.calendar_provider,
    ],
  );
  await pool.query(`INSERT INTO tenant_settings (tenant_id) VALUES ($1)`, [rows[0].id]);
  return rows[0];
}

async function seedCustomer(pool, tenantId, overrides = {}) {
  const defaults = {
    phone: `5511${Math.floor(900000000 + Math.random() * 99999999)}`,
    name: 'Cliente Teste',
    email: null,
  };
  const merged = { ...defaults, ...overrides };
  const { rows } = await pool.query(
    `INSERT INTO customers (tenant_id, phone, name, email)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [tenantId, merged.phone, merged.name, merged.email],
  );
  return rows[0];
}

module.exports = {
  testDatabaseUrl,
  makeTestPool,
  applyMigrations,
  setupTestDb,
  resetTestDb,
  seedTenant,
  seedCustomer,
};
