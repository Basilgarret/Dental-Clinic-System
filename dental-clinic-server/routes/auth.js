const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { userOut, dentistOut, patientOut } = require('../mappers');

const router = express.Router();

// GET /api/auth/status — tells the frontend whether any accounts exist
// yet, so it knows whether to show the sign-in form or send a brand
// new install straight to registration.
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT EXISTS(SELECT 1 FROM users) AS has_accounts');
    res.json({ hasAccounts: result.rows[0].has_accounts });
  } catch (err) {
    console.error('Checking account status failed:', err);
    res.status(500).json({ error: 'Could not check account status.' });
  }
});

const ROLE_ID_STRATEGY = {
  Administrator: 'sequence:admins_id_seq:A',
  'Clinic Staff': 'sequence:staff_id_seq:S',
  Dentist: 'from-dentist-row',
  Patient: 'from-patient-row',
};

// POST /api/auth/signup
// body: { name, username, password, role, extra: { ...role-specific fields } }
router.post('/signup', async (req, res) => {
  const { name, username, password, role, extra } = req.body || {};

  if (!name || !username || !password || !role) {
    return res.status(400).json({ error: 'name, username, password and role are all required.' });
  }
  if (!ROLE_ID_STRATEGY[role]) {
    return res.status(400).json({ error: 'role must be Administrator, Dentist, Clinic Staff, or Patient.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username]);
    if (existing.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    let id;
    let dentistRow = null;
    let patientRow = null;

    if (role === 'Dentist') {
      if (!extra || !extra.specialty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Specialty is required for a Dentist account.' });
      }
      const result = await client.query(
        'INSERT INTO dentists (name, specialty) VALUES ($1, $2) RETURNING *',
        [name, extra.specialty]
      );
      dentistRow = result.rows[0];
      id = dentistRow.id;
    } else if (role === 'Patient') {
      const required = ['dob', 'gender', 'phone', 'email'];
      const missing = required.filter((k) => !extra || !extra[k]);
      if (missing.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Missing required patient fields: ${missing.join(', ')}` });
      }
      const result = await client.query(
        `INSERT INTO patients (name, dob, gender, phone, email, dentist_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, extra.dob, extra.gender, extra.phone, extra.email, extra.dentistId || null]
      );
      patientRow = result.rows[0];
      id = patientRow.id;
    } else if (role === 'Administrator') {
      const seq = await client.query("SELECT 'A' || nextval('admins_id_seq') AS id");
      id = seq.rows[0].id;
    } else {
      const seq = await client.query("SELECT 'S' || nextval('staff_id_seq') AS id");
      id = seq.rows[0].id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (id, username, password_hash, role, name)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, username, passwordHash, role, name]
    );

    await client.query('COMMIT');

    res.status(201).json({
      user: userOut(userResult.rows[0]),
      dentist: dentistRow ? dentistOut(dentistRow) : null,
      patient: patientRow ? patientOut(patientRow) : null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Signup failed:', err);
    res.status(500).json({ error: 'Could not create the account. Please try again.' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
// body: { username, password }
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
    const row = result.rows[0];
    if (!row) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }
    res.json({ user: userOut(row) });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Something went wrong while signing in. Please try again.' });
  }
});

module.exports = router;
