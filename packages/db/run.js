const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv/config');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations(pool) {
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Create an .env file with DATABASE_URL=postgres://...');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await ensureMigrationsTable(pool);
  const already = await appliedMigrations(pool);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let applied = 0;
  for (const file of files) {
    if (already.has(file)) {
      continue;
    }
    console.log(`Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✓ ${file}`);
      applied += 1;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ✗ ${file}:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log(applied === 0 ? 'No pending migrations.' : `Applied ${applied} migration(s).`);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
