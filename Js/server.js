const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { rateLimit } = require('express-rate-limit');
const { pool } = require('./database');

const apiRoutes = require('./routes');

const app = express();
const PORT = Number(process.env.PORT) || 4000;
function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be set in production.');

  const secretPath = path.join(__dirname, '.dev-session-secret');
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const secret = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(secretPath, secret, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return secret;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return fs.readFileSync(secretPath, 'utf8').trim();
  }
}

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production.');
}
const allowedOrigins = new Set([
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  ...(process.env.CLIENT_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
]);
function isDevelopmentOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' || ![String(PORT), '5500'].includes(parsed.port)) return false;

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname === '::1') return true;
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
}
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || isDevelopmentOrigin(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed.'));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
}));
app.use('/api/auth/signup', rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
  message: { error: 'Too many accounts were created from this address. Try again later.' },
}));
app.use(session({
  name: 'wellstone.sid',
  store: new PgSession({ pool, tableName: 'app_sessions', createTableIfMissing: true }),
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

// Simple health check — visit http://localhost:4000/api/health in a
// browser to confirm the server AND the database connection are both up.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'not connected', detail: err.message });
  }
});

const workspaceRoot = path.resolve(__dirname, '..');
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/Css', express.static(path.join(workspaceRoot, 'Css')));
app.use('/Js', express.static(__dirname));
app.use('/api', apiRoutes);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.message === 'Origin is not allowed.' ? 403 : 400;
  res.status(status).json({ error: status === 413 ? 'Document exceeds the 10 MB upload limit.' : error.message || 'The request could not be completed.' });
});

app.listen(PORT, () => {
  console.log(`Wellstone Dental API running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
