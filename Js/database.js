const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootEnvPath = path.resolve(__dirname, '..', '.env');
const envPath = fs.existsSync(rootEnvPath) ? rootEnvPath : path.join(__dirname, '.env');
dotenv.config({ path: envPath });

const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

module.exports = { pool };
