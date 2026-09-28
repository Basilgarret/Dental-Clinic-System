const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../database');
const {
  dentistOut,
  userOut,
  patientOut,
  appointmentOut,
  recordOut,
  prescriptionOut,
  transactionOut,
  serviceOut,
} = require('../mappers');

const router = express.Router();

function handle(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch((err) => {
    console.error('API request failed:', err);
    res.status(500).json({ error: 'The request could not be completed.' });
  });
}

router.get('/auth/status', handle(async (req, res) => {
  const result = await pool.query('SELECT EXISTS(SELECT 1 FROM users) AS has_accounts');
  res.json({ hasAccounts: result.rows[0].has_accounts });
}));

router.post('/auth/signup', handle(async (req, res) => {
  const { name, username, password, role, extra = {} } = req.body || {};
  if (!name || !username || !password || !role) {
    return res.status(400).json({ error: 'name, username, password and role are all required.' });
  }
  if (!['Administrator', 'Dentist', 'Clinic Staff', 'Patient'].includes(role)) {
    return res.status(400).json({ error: 'Invalid account role.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (role === 'Dentist' && !extra.specialty) {
    return res.status(400).json({ error: 'Specialty is required for a Dentist account.' });
  }
  if (role === 'Patient' && ['dob', 'gender', 'phone', 'email'].some((key) => !extra[key])) {
    return res.status(400).json({ error: 'Date of birth, gender, phone and email are required for a Patient account.' });
  }

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const existing = await client.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username]);
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    let id;
    let dentist = null;
    let patient = null;
    if (role === 'Dentist') {
      const result = await client.query(
        'INSERT INTO dentists (name, specialty) VALUES ($1, $2) RETURNING *',
        [name, extra.specialty]
      );
      dentist = result.rows[0];
      id = dentist.id;
    } else if (role === 'Patient') {
      const result = await client.query(
        `INSERT INTO patients (name, dob, gender, phone, email, dentist_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, extra.dob, extra.gender, extra.phone, extra.email, extra.dentistId || null]
      );
      patient = result.rows[0];
      id = patient.id;
    } else {
      const sequence = role === 'Administrator' ? 'admins_id_seq' : 'staff_id_seq';
      const prefix = role === 'Administrator' ? 'A' : 'S';
      const result = await client.query('SELECT $1 || nextval($2)::text AS id', [prefix, sequence]);
      id = result.rows[0].id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      'INSERT INTO users (id, username, password_hash, role, name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, username, passwordHash, role, name]
    );
    await client.query('COMMIT');
    transactionOpen = false;
    res.status(201).json({
      user: userOut(userResult.rows[0]),
      dentist: dentist ? dentistOut(dentist) : null,
      patient: patient ? patientOut(patient) : null,
    });
  } catch (err) {
    if (transactionOpen) await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    console.error('Signup failed:', err);
    res.status(500).json({ error: 'Could not create the account. Please try again.' });
  } finally {
    client.release();
  }
}));

router.post('/auth/login', handle(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const result = await pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  res.json({ user: userOut(user) });
}));

function registerResource(route, { table, fields, map, orderBy }) {
  router.get(route, handle(async (req, res) => {
    const result = await pool.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
    res.json(result.rows.map(map));
  }));

  router.post(route, handle(async (req, res) => {
    const values = Object.keys(fields).filter((key) => req.body && req.body[key] !== undefined);
    if (!values.length) return res.status(400).json({ error: 'No fields were provided.' });
    const columns = values.map((key) => fields[key]);
    const params = values.map((key) => req.body[key]);
    const placeholders = params.map((value, index) => `$${index + 1}`);
    const result = await pool.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      params
    );
    res.status(201).json(map(result.rows[0]));
  }));

  router.put(`${route}/:id`, handle(async (req, res) => {
    const values = Object.keys(fields).filter((key) => req.body && req.body[key] !== undefined);
    if (!values.length) return res.status(400).json({ error: 'No fields were provided.' });
    const assignments = values.map((key, index) => `${fields[key]} = $${index + 1}`);
    const params = values.map((key) => req.body[key]);
    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE ${table} SET ${assignments.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Record not found.' });
    res.json(map(result.rows[0]));
  }));

  router.delete(`${route}/:id`, handle(async (req, res) => {
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Record not found.' });
    res.json({ success: true });
  }));
}

registerResource('/dentists', {
  table: 'dentists', fields: { name: 'name', specialty: 'specialty' }, map: dentistOut, orderBy: 'name',
});
registerResource('/patients', {
  table: 'patients',
  fields: {
    name: 'name', dob: 'dob', gender: 'gender', phone: 'phone', email: 'email',
    address: 'address', allergies: 'allergies', dentistId: 'dentist_id',
  },
  map: patientOut,
  orderBy: 'name',
});
registerResource('/appointments', {
  table: 'appointments',
  fields: {
    patientId: 'patient_id', dentistId: 'dentist_id', date: 'date', time: 'time',
    type: 'type', status: 'status', notes: 'notes',
  },
  map: appointmentOut,
  orderBy: 'date, time',
});
registerResource('/records', {
  table: 'dental_records',
  fields: {
    patientId: 'patient_id', dentistId: 'dentist_id', date: 'date', tooth: 'tooth',
    procedure: 'procedure_name', diagnosis: 'diagnosis', notes: 'notes',
  },
  map: recordOut,
  orderBy: 'date DESC',
});
registerResource('/prescriptions', {
  table: 'prescriptions',
  fields: {
    patientId: 'patient_id', dentistId: 'dentist_id', date: 'date',
    status: 'status', notes: 'notes', meds: 'meds',
  },
  map: prescriptionOut,
  orderBy: 'date DESC',
});
registerResource('/transactions', {
  table: 'transactions',
  fields: {
    patientId: 'patient_id', date: 'date', description: 'description',
    amount: 'amount', method: 'method', status: 'status',
  },
  map: transactionOut,
  orderBy: 'date DESC',
});
registerResource('/services', {
  table: 'services',
  fields: { name: 'name', description: 'description', price: 'price', durationMinutes: 'duration_minutes', active: 'active' },
  map: serviceOut,
  orderBy: 'name',
});

router.patch('/appointments/:id/status', handle(async (req, res) => {
  const result = await pool.query(
    'UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *',
    [req.body.status, req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Appointment not found.' });
  res.json(appointmentOut(result.rows[0]));
}));

router.patch('/transactions/:id/status', handle(async (req, res) => {
  const result = await pool.query(
    'UPDATE transactions SET status = $1 WHERE id = $2 RETURNING *',
    [req.body.status, req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Transaction not found.' });
  res.json(transactionOut(result.rows[0]));
}));

module.exports = router;
