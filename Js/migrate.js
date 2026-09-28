// Applies schema.sql to the database configured in .env.
// Run with: npm run migrate
const fs = require('fs');
const path = require('path');
const rootEnvPath = path.resolve(__dirname, '..', '.env');
const envPath = fs.existsSync(rootEnvPath) ? rootEnvPath : path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

async function migrate() {
  const missingEnv = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']
    .filter((name) => !process.env[name]);
  if (missingEnv.length) {
    throw new Error(`Missing PostgreSQL settings: ${missingEnv.join(', ')}. Copy .env.example to .env, set your PostgreSQL password, then run npm run migrate again.`);
  }

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log(`Connecting to database "${process.env.PGDATABASE}" on ${process.env.PGHOST}:${process.env.PGPORT || 5432}...`);
  const client = await pool.connect();
  try {
    console.log('Running schema.sql ...');
    await client.query(sql);
    console.log('Done. Tables created: dentists, users, patients, appointments, dental_records, prescriptions, transactions, services.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
});
