const { Pool } = require('pg');

let pool;

function needsSsl(url) {
  if (!url) return false;
  if (/sslmode=disable/.test(url)) return false;
  if (/localhost|127\.0\.0\.1/.test(url)) return false;
  return true;
}

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    pool = new Pool({
      connectionString: url,
      ssl: needsSsl(url) ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

module.exports = { getPool };
