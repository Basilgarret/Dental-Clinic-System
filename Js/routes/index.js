const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth, requireRole } = require('../auth-middleware');
const { pool } = require('../database');
const clinicWorkflowRoutes = require('./clinic-workflows');
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

function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.user = user;
      req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

async function notifyAdministrators(type, title, message, entityType, entityId) {
  const result = await pool.query("SELECT id FROM users WHERE role = 'Administrator' AND disabled_at IS NULL");
  await Promise.all(result.rows.map((admin) => createNotification(admin.id, type, title, message, entityType, entityId)));
}

function clinicOut(row) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    registrationNumber: row.registration_number || '',
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    region: row.region,
    latitude: row.latitude,
    longitude: row.longitude,
    specializations: row.specializations || [],
    status: row.status,
    rejectionReason: row.rejection_reason || '',
    createdAt: row.created_at,
  };
}

function handle(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch((err) => {
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
  if (!['Dentist', 'Patient', 'Clinic Owner'].includes(role)) {
    return res.status(403).json({ error: 'This role can only be created by an administrator.' });
  }
  if (password.length < 10) {
    return res.status(400).json({ error: 'Password must be at least 10 characters.' });
  }
  if (role === 'Dentist' && !extra.specialty) {
    return res.status(400).json({ error: 'Specialty is required for a Dentist account.' });
  }
  if (role === 'Patient' && ['dob', 'gender', 'phone', 'email'].some((key) => !extra[key])) {
    return res.status(400).json({ error: 'Date of birth, gender, phone and email are required for a Patient account.' });
  }
  if (role === 'Clinic Owner' && ['clinicName', 'phone', 'email', 'address', 'city'].some((key) => !extra[key])) {
    return res.status(400).json({ error: 'Clinic name, phone, email, address and city are required.' });
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
    let clinic = null;
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
      const sequence = role === 'Administrator' ? 'admins_id_seq' : role === 'Clinic Owner' ? 'clinic_owners_id_seq' : 'staff_id_seq';
      const prefix = role === 'Administrator' ? 'A' : role === 'Clinic Owner' ? 'C' : 'S';
      const result = await client.query('SELECT $1 || nextval($2)::text AS id', [prefix, sequence]);
      id = result.rows[0].id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      'INSERT INTO users (id, username, password_hash, role, name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, username, passwordHash, role, name]
    );
    if (dentist) {
      const linked = await client.query('UPDATE dentists SET user_id = $1 WHERE id = $2 RETURNING *', [id, dentist.id]);
      dentist = linked.rows[0];
    }
    if (role === 'Clinic Owner') {
      const result = await client.query(
        `INSERT INTO clinics
          (owner_user_id, name, registration_number, phone, email, address, city, region, latitude, longitude, specializations)
         VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [id, extra.clinicName, extra.registrationNumber || '', extra.phone, extra.email, extra.address, extra.city,
          extra.region || '', extra.latitude || null, extra.longitude || null,
          Array.isArray(extra.specializations) ? extra.specializations : []]
      );
      clinic = result.rows[0];
      await client.query('UPDATE users SET clinic_id = $1 WHERE id = $2', [clinic.id, id]);
      userResult.rows[0].clinic_id = clinic.id;
    }
    await client.query('COMMIT');
    transactionOpen = false;
    if (clinic) await notifyAdministrators('clinic_registered', 'Clinic application received', `${clinic.name} submitted a clinic application.`, 'clinic', clinic.id);
    if (patient) await notifyAdministrators('patient_registered', 'Patient registered', `${name} created a patient account.`, 'patient', patient.id);
    const user = userOut(userResult.rows[0]);
    await startSession(req, user);
    res.status(201).json({
      user,
      dentist: dentist ? dentistOut(dentist) : null,
      patient: patient ? patientOut(patient) : null,
      clinic: clinic ? clinicOut(clinic) : null,
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
  if (!user || user.disabled_at || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  const publicUser = userOut(user);
  await startSession(req, publicUser);
  res.json({ user: publicUser });
}));

router.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.session.user }));
router.post('/auth/logout', requireAuth, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('wellstone.sid', { httpOnly: true, sameSite: 'lax' });
    res.json({ success: true });
  });
});

const clinicDirectorySelect = `
  SELECT c.*,
    COALESCE((SELECT json_agg(json_build_object('id', d.id, 'name', d.name, 'specialty', d.specialty, 'phone', d.phone, 'email', d.email))
      FROM dentists d WHERE d.clinic_id = c.id AND d.active), '[]'::json) AS dentists,
    COALESCE((SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'description', s.description, 'price', s.price, 'durationMinutes', s.duration_minutes))
      FROM services s WHERE s.clinic_id = c.id AND s.active), '[]'::json) AS services
  FROM clinics c`;

function clinicPublicOut(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    region: row.region || '',
    latitude: row.latitude,
    longitude: row.longitude,
    specializations: row.specializations || [],
    dentists: row.dentists || [],
    services: row.services || [],
  };
}

router.get('/maps/embed', (req, res) => {
  const query = String(req.query.query || '').trim().slice(0, 300);
  if (!query) return res.status(400).send('Map location is required.');
  if (process.env.GOOGLE_MAPS_API_KEY) {
    const params = new URLSearchParams({ key: process.env.GOOGLE_MAPS_API_KEY, q: query, zoom: '15' });
    return res.redirect(302, `https://www.google.com/maps/embed/v1/place?${params.toString()}`);
  }
  return res.redirect(302, `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`);
});

router.get('/clinics', handle(async (req, res) => {
  const city = String(req.query.city || '').trim();
  const region = String(req.query.region || '').trim();
  const specialization = String(req.query.specialization || '').trim();
  const service = String(req.query.service || '').trim();
  const result = await pool.query(
    `${clinicDirectorySelect}
     WHERE c.status = 'Approved'
       AND ($1 = '' OR lower(c.city) LIKE '%' || lower($1) || '%')
       AND ($2 = '' OR lower(c.region) LIKE '%' || lower($2) || '%')
       AND ($3 = '' OR EXISTS (SELECT 1 FROM unnest(c.specializations) item WHERE lower(item) = lower($3)))
       AND ($4 = '' OR EXISTS (SELECT 1 FROM services s WHERE s.clinic_id = c.id AND s.active AND lower(s.name) = lower($4)))
     ORDER BY c.name`,
    [city, region, specialization, service]
  );
  res.json(result.rows.map(clinicPublicOut));
}));

router.get('/clinics/:clinicId', handle(async (req, res, next) => {
  const clinicId = Number(req.params.clinicId);
  if (!Number.isSafeInteger(clinicId) || clinicId < 1) return next();
  const result = await pool.query(`${clinicDirectorySelect} WHERE c.id = $1 AND c.status = 'Approved'`, [clinicId]);
  if (!result.rowCount) return res.status(404).json({ error: 'Clinic not found.' });
  res.json(clinicPublicOut(result.rows[0]));
}));

router.get('/dentists', handle(async (req, res) => {
  const result = await pool.query(
    `SELECT d.* FROM dentists d
     LEFT JOIN clinics c ON c.id = d.clinic_id
     WHERE d.active AND (d.clinic_id IS NULL OR c.status = 'Approved')
     ORDER BY d.name`
  );
  res.json(result.rows.map((row) => ({ id: row.id, name: row.name, specialty: row.specialty })));
}));

router.get('/services', handle(async (req, res) => {
  const result = await pool.query(
    `SELECT s.* FROM services s
     LEFT JOIN clinics c ON c.id = s.clinic_id
     WHERE s.active AND (s.clinic_id IS NULL OR c.status = 'Approved')
     ORDER BY s.name`
  );
  res.json(result.rows.map(serviceOut));
}));

router.use(requireAuth);
router.use(clinicWorkflowRoutes);

function resourceScope(table, user, parameter = 1) {
  if (user.role === 'Administrator') return { sql: '', params: [] };
  const actor = `$${parameter}`;
  if (user.role === 'Patient') {
    const ownPatient = { patients: `id = ${actor}`, appointments: `patient_id = ${actor}`, dental_records: `patient_id = ${actor}`, prescriptions: `patient_id = ${actor}`, transactions: `patient_id = ${actor}` };
    return { sql: ownPatient[table] || 'FALSE', params: [user.id] };
  }
  if (user.role === 'Dentist') {
    const dentistPatientIds = `SELECT patient_id FROM appointments WHERE dentist_id = ${actor}`;
    const ownDentist = { dentists: `id = ${actor}`, patients: `(dentist_id = ${actor} OR id IN (${dentistPatientIds}))`, appointments: `dentist_id = ${actor}`, dental_records: `dentist_id = ${actor}`, prescriptions: `dentist_id = ${actor}`, follow_ups: `dentist_id = ${actor}` };
    return { sql: ownDentist[table] || 'FALSE', params: [user.id] };
  }
  if (user.role === 'Clinic Owner' || user.role === 'Clinic Staff') {
    const clinic = user.role === 'Clinic Owner'
      ? `(SELECT id FROM clinics WHERE owner_user_id = ${actor})`
      : `(SELECT clinic_id FROM users WHERE id = ${actor})`;
    const clinicDentists = `dentist_id IN (SELECT id FROM dentists WHERE clinic_id = ${clinic})`;
    const clinicPatientIds = `SELECT a.patient_id FROM appointments a WHERE a.clinic_id = ${clinic} OR a.dentist_id IN (SELECT id FROM dentists WHERE clinic_id = ${clinic})`;
    const owned = {
      clinics: `owner_user_id = ${actor}`,
      clinic_documents: `clinic_id = ${clinic}`,
      dentists: `clinic_id = ${clinic}`,
      services: `clinic_id = ${clinic}`,
      patients: `(dentist_id IN (SELECT id FROM dentists WHERE clinic_id = ${clinic}) OR id IN (${clinicPatientIds}))`,
      appointments: `(clinic_id = ${clinic} OR ${clinicDentists})`,
      dental_records: clinicDentists,
      prescriptions: clinicDentists,
      follow_ups: clinicDentists,
      transactions: `patient_id IN (SELECT p.id FROM patients p WHERE p.dentist_id IN (SELECT id FROM dentists WHERE clinic_id = ${clinic}) OR p.id IN (${clinicPatientIds}))`,
    };
    return { sql: owned[table] || 'FALSE', params: [user.id] };
  }
  return { sql: 'FALSE', params: [] };
}

async function findAppointmentConflict(dentistId, date, time, excludeId = null) {
  if (!dentistId || !date || !time) return false;
  const result = await pool.query(
    `SELECT 1 FROM appointments
     WHERE dentist_id = $1 AND date = $2 AND time = $3
       AND status NOT IN ('Cancelled', 'Rejected')
       AND ($4::text IS NULL OR id <> $4)
     LIMIT 1`,
    [dentistId, date, time, excludeId]
  );
  return result.rowCount > 0;
}

const resourcePermissions = {
  dentists: { read: ['Administrator', 'Dentist', 'Clinic Owner', 'Clinic Staff'], create: ['Administrator', 'Clinic Owner'], update: ['Administrator', 'Dentist', 'Clinic Owner'], delete: ['Administrator', 'Clinic Owner'] },
  patients: { read: ['Administrator', 'Clinic Staff', 'Dentist', 'Patient', 'Clinic Owner'], create: ['Administrator', 'Clinic Staff'], update: ['Administrator', 'Clinic Staff'], delete: ['Administrator', 'Clinic Staff'] },
  appointments: { read: ['Administrator', 'Clinic Staff', 'Dentist', 'Patient', 'Clinic Owner'], create: ['Administrator', 'Clinic Staff', 'Patient', 'Clinic Owner'], update: ['Administrator', 'Clinic Staff', 'Clinic Owner'], delete: ['Administrator', 'Clinic Staff', 'Clinic Owner'] },
  dental_records: { read: ['Administrator', 'Clinic Staff', 'Dentist', 'Patient', 'Clinic Owner'], create: ['Administrator', 'Dentist'], update: ['Administrator', 'Dentist'], delete: ['Administrator', 'Dentist'] },
  prescriptions: { read: ['Administrator', 'Dentist', 'Patient', 'Clinic Owner'], create: ['Administrator', 'Dentist'], update: ['Administrator', 'Dentist'], delete: ['Administrator', 'Dentist'] },
  transactions: { read: ['Administrator', 'Clinic Staff', 'Patient', 'Clinic Owner'], create: ['Administrator', 'Clinic Staff', 'Clinic Owner'], update: ['Administrator', 'Clinic Staff', 'Clinic Owner'], delete: ['Administrator', 'Clinic Staff', 'Clinic Owner'] },
  services: { read: ['Administrator', 'Clinic Owner', 'Clinic Staff'], create: ['Administrator', 'Clinic Owner'], update: ['Administrator', 'Clinic Owner'], delete: ['Administrator', 'Clinic Owner'] },
};

function registerResource(route, { table, fields, map, orderBy }) {
  const permissions = resourcePermissions[table];
  router.get(route, requireRole(...permissions.read), handle(async (req, res) => {
    const scope = resourceScope(table, req.session.user);
    const where = scope.sql ? `WHERE ${scope.sql}` : '';
    const result = await pool.query(`SELECT * FROM ${table} ${where} ORDER BY ${orderBy}`, scope.params);
    res.json(result.rows.map(map));
  }));

  router.post(route, requireRole(...permissions.create), handle(async (req, res) => {
    const body = { ...(req.body || {}) };
    const user = req.session.user;
    if (table === 'appointments' && user.role === 'Patient') {
      body.patientId = user.id;
      body.status = 'Requested';
      const booking = await pool.query(
        `SELECT d.clinic_id FROM dentists d JOIN clinics c ON c.id = d.clinic_id
         WHERE d.id = $1 AND d.active AND c.status = 'Approved' AND c.id = $2`,
        [body.dentistId, body.clinicId]
      );
      if (!booking.rowCount) return res.status(400).json({ error: 'Choose an active dentist at an approved clinic.' });
      if (body.serviceId) {
        const service = await pool.query('SELECT 1 FROM services WHERE id = $1 AND clinic_id = $2 AND active', [body.serviceId, body.clinicId]);
        if (!service.rowCount) return res.status(400).json({ error: 'Choose an active service offered by this clinic.' });
      }
    }
    if (table === 'appointments' && (user.role === 'Clinic Owner' || user.role === 'Clinic Staff')) {
      const clinicResult = await pool.query(
        user.role === 'Clinic Owner'
          ? "SELECT id FROM clinics WHERE owner_user_id = $1 AND status = 'Approved'"
          : "SELECT clinic_id AS id FROM users WHERE id = $1 AND clinic_id IS NOT NULL",
        [user.id]
      );
      if (!clinicResult.rowCount || !clinicResult.rows[0].id) return res.status(403).json({ error: 'Your account is not assigned to a clinic.' });
      body.clinicId = clinicResult.rows[0].id;
      body.status = 'Scheduled';
      const dentist = await pool.query('SELECT 1 FROM dentists WHERE id = $1 AND clinic_id = $2 AND active', [body.dentistId, body.clinicId]);
      if (!dentist.rowCount) return res.status(400).json({ error: 'Choose an active dentist from your clinic.' });
    }
    if (table === 'appointments' && await findAppointmentConflict(body.dentistId, body.date, body.time)) {
      return res.status(409).json({ error: 'This dentist already has an appointment at that time.' });
    }
    if ((table === 'dental_records' || table === 'prescriptions') && user.role === 'Dentist') {
      body.dentistId = user.id;
      const assigned = await pool.query('SELECT 1 FROM patients WHERE id = $1 AND dentist_id = $2', [body.patientId, user.id]);
      if (!assigned.rowCount) return res.status(403).json({ error: 'This patient is not assigned to you.' });
    }
    if ((table === 'dentists' || table === 'services') && user.role === 'Clinic Owner') {
      const clinic = await pool.query('SELECT id FROM clinics WHERE owner_user_id = $1', [user.id]);
      if (!clinic.rowCount) return res.status(403).json({ error: 'Clinic profile was not found.' });
      body.clinicId = clinic.rows[0].id;
    }
    const values = Object.keys(fields).filter((key) => body[key] !== undefined);
    if (!values.length) return res.status(400).json({ error: 'No fields were provided.' });
    const columns = values.map((key) => fields[key]);
    const params = values.map((key) => key === 'meds' ? JSON.stringify(body[key]) : body[key]);
    const placeholders = params.map((value, index) => `$${index + 1}`);
    const result = await pool.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      params
    );
    const created = result.rows[0];
    if (table === 'patients') {
      await notifyAdministrators('patient_registered', 'Patient registered', `${created.name} was added to the clinic.`, 'patient', created.id);
    }
    if (table === 'appointments') {
      const contacts = await pool.query(
        `SELECT d.user_id, c.owner_user_id FROM dentists d LEFT JOIN clinics c ON c.id = COALESCE($2, d.clinic_id) WHERE d.id = $1`,
        [created.dentist_id, created.clinic_id]
      );
      const patient = await pool.query('SELECT name FROM patients WHERE id = $1', [created.patient_id]);
      if (user.role === 'Patient') {
        const recipient = contacts.rows[0]?.owner_user_id;
        if (recipient) await createNotification(recipient, 'appointment_request', 'New appointment request', `${patient.rows[0]?.name || 'A patient'} requested ${created.type}.`, 'appointment', created.id);
        if (contacts.rows[0]?.user_id) await createNotification(contacts.rows[0].user_id, 'appointment_request', 'New appointment request', `${patient.rows[0]?.name || 'A patient'} requested ${created.type}.`, 'appointment', created.id);
      } else {
        await createNotification(created.patient_id, 'appointment_status', 'Appointment scheduled', `Your ${created.type} appointment is scheduled for ${created.date}.`, 'appointment', created.id);
      }
    }
    res.status(201).json(map(created));
  }));

  router.put(`${route}/:id`, requireRole(...permissions.update), handle(async (req, res) => {
    const values = Object.keys(fields).filter((key) => req.body && req.body[key] !== undefined);
    if (!values.length) return res.status(400).json({ error: 'No fields were provided.' });
    const assignments = values.map((key, index) => `${fields[key]} = $${index + 1}`);
    const params = values.map((key) => key === 'meds' ? JSON.stringify(req.body[key]) : req.body[key]);
    const idParameter = params.length + 1;
    if (table === 'appointments') {
      const existingScope = resourceScope(table, req.session.user, 2);
      const existing = await pool.query(
        `SELECT * FROM appointments WHERE id = $1${existingScope.sql ? ` AND (${existingScope.sql})` : ''}`,
        [req.params.id, ...existingScope.params]
      );
      if (!existing.rowCount) return res.status(404).json({ error: 'Record not found.' });
      const appointment = existing.rows[0];
      const dentistId = req.body.dentistId ?? appointment.dentist_id;
      const date = req.body.date ?? appointment.date;
      const time = req.body.time ?? appointment.time;
      if (await findAppointmentConflict(dentistId, date, time, appointment.id)) {
        return res.status(409).json({ error: 'This dentist already has an appointment at that time.' });
      }
    }
    params.push(req.params.id);
    const scope = resourceScope(table, req.session.user, idParameter + 1);
    const where = `id = $${idParameter}${scope.sql ? ` AND (${scope.sql})` : ''}`;
    params.push(...scope.params);
    const result = await pool.query(
      `UPDATE ${table} SET ${assignments.join(', ')} WHERE ${where} RETURNING *`,
      params
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Record not found.' });
    res.json(map(result.rows[0]));
  }));

  router.delete(`${route}/:id`, requireRole(...permissions.delete), handle(async (req, res) => {
    const scope = resourceScope(table, req.session.user, 2);
    const where = `id = $1${scope.sql ? ` AND (${scope.sql})` : ''}`;
    const result = await pool.query(`DELETE FROM ${table} WHERE ${where}`, [req.params.id, ...scope.params]);
    if (!result.rowCount) return res.status(404).json({ error: 'Record not found.' });
    res.json({ success: true });
  }));
}

registerResource('/dentists', {
  table: 'dentists', fields: { name: 'name', specialty: 'specialty', clinicId: 'clinic_id', phone: 'phone', email: 'email', active: 'active' }, map: dentistOut, orderBy: 'name',
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
    type: 'type', status: 'status', notes: 'notes', clinicId: 'clinic_id', serviceId: 'service_id',
    rejectionReason: 'rejection_reason', rescheduleDate: 'reschedule_date', rescheduleTime: 'reschedule_time',
    rescheduleReason: 'reschedule_reason',
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
  fields: { name: 'name', description: 'description', price: 'price', durationMinutes: 'duration_minutes', active: 'active', clinicId: 'clinic_id' },
  map: serviceOut,
  orderBy: 'name',
});

async function createNotification(userId, type, title, message, entityType, entityId) {
  if (!userId) return;
  await pool.query(
    'INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, type, title, message, entityType, String(entityId)]
  );
}

router.patch('/appointments/:id/status', requireRole('Administrator', 'Clinic Staff', 'Clinic Owner', 'Dentist', 'Patient'), handle(async (req, res) => {
  const { status, reason = '' } = req.body || {};
  const user = req.session.user;
  const permissions = {
    Administrator: ['Scheduled', 'Rejected', 'Cancelled', 'Completed'],
    'Clinic Staff': ['Scheduled', 'Rejected', 'Cancelled'],
    'Clinic Owner': ['Scheduled', 'Rejected', 'Cancelled'],
    Dentist: ['Completed'],
    Patient: ['Cancelled'],
  };
  if (!permissions[user.role].includes(status)) return res.status(403).json({ error: 'You cannot set that appointment status.' });
  if (status === 'Rejected' && !String(reason).trim()) return res.status(400).json({ error: 'A reason is required when rejecting an appointment.' });
  const scope = resourceScope('appointments', user, 2);
  const target = await pool.query(`SELECT * FROM appointments WHERE id = $1${scope.sql ? ` AND (${scope.sql})` : ''}`, [req.params.id, ...scope.params]);
  if (!target.rowCount) return res.status(404).json({ error: 'Appointment not found.' });
  const appointment = target.rows[0];
  const validTransitions = {
    Requested: ['Scheduled', 'Rejected', 'Cancelled'],
    Scheduled: ['Cancelled', 'Completed'],
    'Reschedule Requested': ['Scheduled', 'Rejected', 'Cancelled'],
    Rejected: [],
    Cancelled: [],
    Completed: [],
  };
  if (!validTransitions[appointment.status]?.includes(status)) {
    return res.status(409).json({ error: `Cannot change an appointment from ${appointment.status} to ${status}.` });
  }
  const date = status === 'Scheduled' && appointment.status === 'Reschedule Requested' ? appointment.reschedule_date : appointment.date;
  const time = status === 'Scheduled' && appointment.status === 'Reschedule Requested' ? appointment.reschedule_time : appointment.time;
  if (status === 'Scheduled' && await findAppointmentConflict(appointment.dentist_id, date, time, appointment.id)) {
    return res.status(409).json({ error: 'This dentist already has an appointment at that time.' });
  }
  const result = await pool.query(
    `UPDATE appointments SET status = $1, rejection_reason = $2, date = $3, time = $4,
       reschedule_date = NULL, reschedule_time = NULL, reschedule_reason = ''
     WHERE id = $5 RETURNING *`,
    [status, status === 'Rejected' ? String(reason).trim().slice(0, 1000) : '', date, time, appointment.id]
  );
  const clinicOwner = await pool.query(
    `SELECT c.owner_user_id FROM clinics c WHERE c.id = COALESCE($1, (SELECT clinic_id FROM dentists WHERE id = $2))`,
    [appointment.clinic_id, appointment.dentist_id]
  );
  await createNotification(appointment.patient_id, 'appointment_status', `Appointment ${status.toLowerCase()}`, status === 'Rejected' ? String(reason).trim() : `Your appointment is now ${status.toLowerCase()}.`, 'appointment', appointment.id);
  if (clinicOwner.rows[0]) await createNotification(clinicOwner.rows[0].owner_user_id, 'appointment_status', `Appointment ${status.toLowerCase()}`, `Appointment ${appointment.id} is now ${status.toLowerCase()}.`, 'appointment', appointment.id);
  res.json(appointmentOut(result.rows[0]));
}));

router.post('/appointments/:id/reschedule', requireRole('Patient'), handle(async (req, res) => {
  const { date, time, reason = '' } = req.body || {};
  if (!date || !time || !String(reason).trim()) return res.status(400).json({ error: 'Choose a new date and time and provide a reason.' });
  if (date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: 'The new date cannot be in the past.' });
  const result = await pool.query(
    `UPDATE appointments SET status = 'Reschedule Requested', reschedule_date = $1, reschedule_time = $2, reschedule_reason = $3
     WHERE id = $4 AND patient_id = $5 AND status IN ('Requested', 'Scheduled') RETURNING *`,
    [date, time, String(reason).trim().slice(0, 1000), req.params.id, req.session.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'A reschedulable appointment was not found.' });
  const appointment = result.rows[0];
  const clinicOwner = await pool.query(
    'SELECT owner_user_id FROM clinics WHERE id = COALESCE($1, (SELECT clinic_id FROM dentists WHERE id = $2))',
    [appointment.clinic_id, appointment.dentist_id]
  );
  if (clinicOwner.rows[0]) await createNotification(clinicOwner.rows[0].owner_user_id, 'appointment_reschedule', 'Appointment reschedule requested', `The patient requested ${date} at ${time}.`, 'appointment', appointment.id);
  res.json(appointmentOut(appointment));
}));

router.patch('/transactions/:id/status', requireRole('Administrator', 'Clinic Staff', 'Clinic Owner'), handle(async (req, res) => {
  const { status } = req.body || {};
  if (!['Paid', 'Pending', 'Overdue'].includes(status)) return res.status(400).json({ error: 'Invalid payment status.' });
  const scope = resourceScope('transactions', req.session.user, 3);
  const where = `id = $1${scope.sql ? ` AND (${scope.sql})` : ''}`;
  const result = await pool.query(`UPDATE transactions SET status = $2 WHERE ${where} RETURNING *`, [req.params.id, status, ...scope.params]);
  if (!result.rowCount) return res.status(404).json({ error: 'Transaction not found.' });
  await createNotification(result.rows[0].patient_id, 'payment', 'Payment status updated', `Your transaction ${result.rows[0].description} is now ${status.toLowerCase()}.`, 'transaction', result.rows[0].id);
  res.json(transactionOut(result.rows[0]));
}));

module.exports = router;
