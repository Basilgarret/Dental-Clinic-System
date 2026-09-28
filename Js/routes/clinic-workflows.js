const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { pool } = require('../database');
const { requireRole } = require('../auth-middleware');
const { dateOut, dentistOut, serviceOut, userOut } = require('../mappers');

const router = express.Router();
const uploadDirectory = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

function handle(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
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
    region: row.region || '',
    latitude: row.latitude,
    longitude: row.longitude,
    specializations: row.specializations || [],
    status: row.status,
    rejectionReason: row.rejection_reason || '',
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

async function clinicForOwner(userId) {
  const result = await pool.query('SELECT * FROM clinics WHERE owner_user_id = $1', [userId]);
  return result.rows[0] || null;
}

async function notify(userId, type, title, message, entityType, entityId) {
  if (!userId) return;
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, message, entityType || '', entityId == null ? '' : String(entityId)]
  );
}

async function notifyAdmins(type, title, message, entityType, entityId) {
  const admins = await pool.query("SELECT id FROM users WHERE role = 'Administrator' AND disabled_at IS NULL");
  await Promise.all(admins.rows.map((admin) => notify(admin.id, type, title, message, entityType, entityId)));
}

const acceptedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    callback(acceptedTypes.has(file.mimetype) ? null : new Error('Upload a PDF, JPG, or PNG document.'), acceptedTypes.has(file.mimetype));
  },
});

function detectedType(buffer) {
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  return null;
}

function safeFileName(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

router.get('/clinics/mine', requireRole('Clinic Owner'), handle(async (req, res) => {
  const clinic = await clinicForOwner(req.session.user.id);
  if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
  const [documents, dentists, services] = await Promise.all([
    pool.query('SELECT id, document_type, file_name, mime_type, file_size, status, rejection_reason, uploaded_at, reviewed_at FROM clinic_documents WHERE clinic_id = $1 ORDER BY uploaded_at DESC', [clinic.id]),
    pool.query('SELECT * FROM dentists WHERE clinic_id = $1 ORDER BY active DESC, name', [clinic.id]),
    pool.query('SELECT * FROM services WHERE clinic_id = $1 ORDER BY active DESC, name', [clinic.id]),
  ]);
  res.json({
    clinic: clinicOut(clinic),
    documents: documents.rows,
    dentists: dentists.rows.map(dentistOut),
    services: services.rows.map(serviceOut),
  });
}));

router.patch('/clinics/mine', requireRole('Clinic Owner'), handle(async (req, res) => {
  const clinic = await clinicForOwner(req.session.user.id);
  if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
  const allowed = ['name', 'registrationNumber', 'phone', 'email', 'address', 'city', 'region', 'latitude', 'longitude', 'specializations'];
  const columns = {
    name: 'name', registrationNumber: 'registration_number', phone: 'phone', email: 'email',
    address: 'address', city: 'city', region: 'region', latitude: 'latitude', longitude: 'longitude',
    specializations: 'specializations',
  };
  const fields = allowed.filter((key) => req.body && req.body[key] !== undefined);
  if (!fields.length) return res.status(400).json({ error: 'No clinic profile fields were provided.' });
  const values = fields.map((key) => req.body[key]);
  const updates = fields.map((key, index) => `${columns[key]} = $${index + 1}`);
  const critical = fields.some((key) => ['name', 'registrationNumber', 'address', 'city', 'region'].includes(key));
  if (critical) updates.push("status = 'Pending Review'");
  updates.push('updated_at = CURRENT_TIMESTAMP');
  const result = await pool.query(
    `UPDATE clinics SET ${updates.join(', ')} WHERE id = $${values.length + 1} RETURNING *`,
    [...values, clinic.id]
  );
  if (critical) await notifyAdmins('clinic_profile_updated', 'Clinic profile needs review', `${clinic.name} updated its business profile.`, 'clinic', clinic.id);
  res.json(clinicOut(result.rows[0]));
}));

router.post('/clinics/mine/documents', requireRole('Clinic Owner'), upload.single('document'), handle(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a document to upload.' });
  const clinic = await clinicForOwner(req.session.user.id);
  if (!clinic) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Clinic profile not found.' });
  }
  const signature = fs.readFileSync(req.file.path).subarray(0, 12);
  const actualType = detectedType(signature);
  if (!actualType || actualType !== req.file.mimetype) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'The document content does not match its file type.' });
  }
  const documentType = String(req.body.documentType || '').trim();
  if (!['Business Permit', 'Professional License', 'Government ID', 'Proof of Address'].includes(documentType)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Choose a valid document type.' });
  }
  const result = await pool.query(
    `INSERT INTO clinic_documents (clinic_id, document_type, file_name, storage_key, mime_type, file_size)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, document_type, file_name, mime_type, file_size, status, uploaded_at`,
    [clinic.id, documentType, safeFileName(req.file.originalname), req.file.filename, actualType, req.file.size]
  );
  await notifyAdmins('clinic_document_uploaded', 'Clinic document uploaded', `${clinic.name} uploaded ${documentType}.`, 'clinic', clinic.id);
  res.status(201).json(result.rows[0]);
}));

router.get('/clinics/mine/documents/:documentId/download', requireRole('Clinic Owner'), handle(async (req, res) => {
  const clinic = await clinicForOwner(req.session.user.id);
  const result = await pool.query('SELECT * FROM clinic_documents WHERE id = $1 AND clinic_id = $2', [req.params.documentId, clinic && clinic.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Document not found.' });
  res.download(path.join(uploadDirectory, path.basename(result.rows[0].storage_key)), result.rows[0].file_name);
}));

router.get('/admin/clinics', requireRole('Administrator'), handle(async (req, res) => {
  const status = String(req.query.status || 'Pending Review');
  if (!['Pending Review', 'Approved', 'Rejected'].includes(status)) return res.status(400).json({ error: 'Invalid clinic status filter.' });
  const result = await pool.query(
    `SELECT c.*, u.name AS owner_name, u.username AS owner_username,
       (SELECT count(*)::int FROM clinic_documents d WHERE d.clinic_id = c.id) AS document_count
     FROM clinics c JOIN users u ON u.id = c.owner_user_id
     WHERE c.status = $1 ORDER BY c.created_at`,
    [status]
  );
  res.json(result.rows.map((row) => ({ ...clinicOut(row), ownerName: row.owner_name, ownerUsername: row.owner_username, documentCount: row.document_count })));
}));

router.get('/admin/clinics/:clinicId/documents', requireRole('Administrator'), handle(async (req, res) => {
  const result = await pool.query(
    `SELECT id, clinic_id, document_type, file_name, mime_type, file_size, status, rejection_reason, uploaded_at, reviewed_at
     FROM clinic_documents WHERE clinic_id = $1 ORDER BY uploaded_at DESC`,
    [req.params.clinicId]
  );
  res.json(result.rows);
}));

router.get('/admin/clinic-documents/:documentId/download', requireRole('Administrator'), handle(async (req, res) => {
  const result = await pool.query('SELECT * FROM clinic_documents WHERE id = $1', [req.params.documentId]);
  if (!result.rowCount) return res.status(404).json({ error: 'Document not found.' });
  res.download(path.join(uploadDirectory, path.basename(result.rows[0].storage_key)), result.rows[0].file_name);
}));

router.patch('/admin/clinic-documents/:documentId/review', requireRole('Administrator'), handle(async (req, res) => {
  const { decision, reason = '' } = req.body || {};
  if (!['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ error: 'Document decision must be Approved or Rejected.' });
  if (decision === 'Rejected' && !String(reason).trim()) return res.status(400).json({ error: 'A rejection reason is required.' });
  const result = await pool.query(
    `UPDATE clinic_documents SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = $4 RETURNING *`,
    [decision, decision === 'Rejected' ? String(reason).trim().slice(0, 1000) : '', req.session.user.id, req.params.documentId]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Document not found.' });
  const clinic = await pool.query('SELECT owner_user_id, name FROM clinics WHERE id = $1', [result.rows[0].clinic_id]);
  await notify(clinic.rows[0].owner_user_id, 'clinic_document_reviewed', 'Clinic document reviewed', `${result.rows[0].document_type}: ${decision}${reason ? ` - ${reason}` : ''}`, 'clinic', result.rows[0].clinic_id);
  res.json({ id: result.rows[0].id, status: result.rows[0].status, rejectionReason: result.rows[0].rejection_reason });
}));

router.patch('/admin/clinics/:clinicId/review', requireRole('Administrator'), handle(async (req, res) => {
  const { decision, reason = '' } = req.body || {};
  if (!['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ error: 'Clinic decision must be Approved or Rejected.' });
  if (decision === 'Rejected' && !String(reason).trim()) return res.status(400).json({ error: 'A rejection reason is required.' });
  if (decision === 'Approved') {
    const documents = await pool.query('SELECT count(*)::int AS total, count(*) FILTER (WHERE status <> \'Approved\')::int AS pending FROM clinic_documents WHERE clinic_id = $1', [req.params.clinicId]);
    if (!documents.rows[0].total || documents.rows[0].pending) return res.status(409).json({ error: 'Review and approve all uploaded documents before approving this clinic.' });
  }
  const result = await pool.query(
    `UPDATE clinics SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 RETURNING *`,
    [decision, decision === 'Rejected' ? String(reason).trim().slice(0, 1000) : '', req.session.user.id, req.params.clinicId]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Clinic not found.' });
  await notify(result.rows[0].owner_user_id, `clinic_${decision.toLowerCase()}`, `Clinic ${decision.toLowerCase()}`, decision === 'Rejected' ? String(reason).trim() : 'Your clinic is approved and is now visible in clinic search.', 'clinic', result.rows[0].id);
  res.json(clinicOut(result.rows[0]));
}));

router.get('/clinics/mine/dentists', requireRole('Clinic Owner'), handle(async (req, res) => {
  const clinic = await clinicForOwner(req.session.user.id);
  if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
  const result = await pool.query('SELECT * FROM dentists WHERE clinic_id = $1 ORDER BY active DESC, name', [clinic.id]);
  res.json(result.rows.map(dentistOut));
}));

router.get('/clinics/mine/available-dentists', requireRole('Clinic Owner'), handle(async (req, res) => {
  const clinic = await clinicForOwner(req.session.user.id);
  if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
  const result = await pool.query(
    `SELECT d.*, u.disabled_at
     FROM dentists d JOIN users u ON u.id = d.user_id
     WHERE d.clinic_id IS NULL AND u.clinic_id IS NULL AND u.role = 'Dentist'
     ORDER BY u.disabled_at NULLS FIRST, d.active DESC, d.name`
  );
  res.json(result.rows.map((row) => ({ ...dentistOut(row), accountEnabled: !row.disabled_at })));
}));

router.post('/clinics/mine/dentists/:dentistId/assign', requireRole('Clinic Owner'), handle(async (req, res) => {
  const clinic = await clinicForOwner(req.session.user.id);
  if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const eligible = await client.query(
      `SELECT d.id, d.user_id FROM dentists d JOIN users u ON u.id = d.user_id
       WHERE d.id = $1 AND d.clinic_id IS NULL AND d.active AND u.clinic_id IS NULL
         AND u.role = 'Dentist' AND u.disabled_at IS NULL
       FOR UPDATE OF d, u`,
      [req.params.dentistId]
    );
    if (!eligible.rowCount) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'This dentist account is no longer available to assign.' });
    }
    const dentistId = eligible.rows[0].id;
    const userId = eligible.rows[0].user_id;
    const updatedDentist = await client.query(
      'UPDATE dentists SET clinic_id = $1 WHERE id = $2 AND clinic_id IS NULL RETURNING *',
      [clinic.id, dentistId]
    );
    const updatedUser = await client.query(
      "UPDATE users SET clinic_id = $1 WHERE id = $2 AND role = 'Dentist' AND disabled_at IS NULL AND clinic_id IS NULL RETURNING id",
      [clinic.id, userId]
    );
    if (updatedDentist.rowCount !== 1 || updatedUser.rowCount !== 1) throw new Error('The dentist account changed while it was being assigned.');
    await client.query('COMMIT');
    transactionOpen = false;
    res.json(dentistOut(updatedDentist.rows[0]));
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.post('/clinics/mine/dentists', requireRole('Clinic Owner'), handle(async (req, res) => {
  const { name, specialty, phone = '', email = '' } = req.body || {};
  if (!name || !specialty) return res.status(400).json({ error: 'Dentist name and specialization are required.' });
  const clinic = await clinicForOwner(req.session.user.id);
  if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
  const result = await pool.query(
    'INSERT INTO dentists (name, specialty, phone, email, clinic_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [String(name).trim(), String(specialty).trim(), String(phone).trim(), String(email).trim(), clinic.id]
  );
  res.status(201).json(dentistOut(result.rows[0]));
}));

router.put('/clinics/mine/dentists/:dentistId', requireRole('Clinic Owner'), handle(async (req, res) => {
  const fields = ['name', 'specialty', 'phone', 'email', 'active'];
  const columns = { name: 'name', specialty: 'specialty', phone: 'phone', email: 'email', active: 'active' };
  const keys = fields.filter((key) => req.body && req.body[key] !== undefined);
  if (!keys.length) return res.status(400).json({ error: 'No dentist fields were provided.' });
  const clinic = await clinicForOwner(req.session.user.id);
  const params = keys.map((key) => req.body[key]);
  params.push(req.params.dentistId, clinic && clinic.id);
  const result = await pool.query(
    `UPDATE dentists SET ${keys.map((key, index) => `${columns[key]} = $${index + 1}`).join(', ')}
     WHERE id = $${keys.length + 1} AND clinic_id = $${keys.length + 2} RETURNING *`, params
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Dentist not found in your clinic.' });
  res.json(dentistOut(result.rows[0]));
}));

router.get('/clinics/mine/services', requireRole('Clinic Owner'), handle(async (req, res) => {
  const clinic = await clinicForOwner(req.session.user.id);
  if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
  const result = await pool.query('SELECT * FROM services WHERE clinic_id = $1 ORDER BY active DESC, name', [clinic.id]);
  res.json(result.rows.map(serviceOut));
}));

router.post('/clinics/mine/services', requireRole('Clinic Owner'), handle(async (req, res) => {
  const { name, description = '', price, durationMinutes = 30 } = req.body || {};
  if (!name || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(durationMinutes)) || Number(durationMinutes) < 5) {
    return res.status(400).json({ error: 'Provide a service name, non-negative price and duration of at least 5 minutes.' });
  }
  const clinic = await clinicForOwner(req.session.user.id);
  if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
  const result = await pool.query(
    'INSERT INTO services (clinic_id, name, description, price, duration_minutes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [clinic.id, String(name).trim(), String(description).trim(), Number(price), Number(durationMinutes)]
  );
  res.status(201).json(serviceOut(result.rows[0]));
}));

router.put('/clinics/mine/services/:serviceId', requireRole('Clinic Owner'), handle(async (req, res) => {
  const allowed = { name: 'name', description: 'description', price: 'price', durationMinutes: 'duration_minutes', active: 'active' };
  const keys = Object.keys(allowed).filter((key) => req.body && req.body[key] !== undefined);
  if (!keys.length) return res.status(400).json({ error: 'No service fields were provided.' });
  const clinic = await clinicForOwner(req.session.user.id);
  const params = keys.map((key) => req.body[key]);
  params.push(req.params.serviceId, clinic && clinic.id);
  const result = await pool.query(
    `UPDATE services SET ${keys.map((key, index) => `${allowed[key]} = $${index + 1}`).join(', ')}
     WHERE id = $${keys.length + 1} AND clinic_id = $${keys.length + 2} RETURNING *`, params
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Service not found in your clinic.' });
  res.json(serviceOut(result.rows[0]));
}));

function followUpScope(user, parameter = 1) {
  const actor = `$${parameter}`;
  if (user.role === 'Administrator') return { sql: '', params: [] };
  if (user.role === 'Patient') return { sql: `f.patient_id = ${actor}`, params: [user.id] };
  if (user.role === 'Dentist') return { sql: `f.dentist_id = ${actor}`, params: [user.id] };
  if (user.role === 'Clinic Owner') {
    const clinic = `(SELECT id FROM clinics WHERE owner_user_id = ${actor})`;
    return { sql: `(f.clinic_id = ${clinic} OR f.dentist_id IN (SELECT id FROM dentists WHERE clinic_id = ${clinic}))`, params: [user.id] };
  }
  if (user.role === 'Clinic Staff') {
    const clinic = `(SELECT clinic_id FROM users WHERE id = ${actor})`;
    return { sql: `(f.clinic_id = ${clinic} OR f.dentist_id IN (SELECT id FROM dentists WHERE clinic_id = ${clinic}))`, params: [user.id] };
  }
  return { sql: 'FALSE', params: [] };
}

router.get('/follow-ups', requireRole('Administrator', 'Clinic Owner', 'Clinic Staff', 'Dentist', 'Patient'), handle(async (req, res) => {
  const scope = followUpScope(req.session.user);
  const result = await pool.query(
    `SELECT f.*, p.name AS patient_name, d.name AS dentist_name
     FROM follow_ups f JOIN patients p ON p.id = f.patient_id JOIN dentists d ON d.id = f.dentist_id
     ${scope.sql ? `WHERE ${scope.sql}` : ''} ORDER BY f.scheduled_date DESC, f.id DESC`,
    scope.params
  );
  res.json(result.rows.map((row) => ({
    id: row.id, patientId: row.patient_id, patientName: row.patient_name, dentistId: row.dentist_id,
    dentistName: row.dentist_name, clinicId: row.clinic_id, appointmentId: row.appointment_id,
    recordId: row.record_id, date: dateOut(row.scheduled_date), reason: row.reason, notes: row.notes,
    status: row.status, rejectionReason: row.rejection_reason, createdAt: row.created_at,
  })));
}));

router.post('/follow-ups', requireRole('Administrator', 'Dentist', 'Clinic Owner'), handle(async (req, res) => {
  const { patientId, dentistId: requestedDentistId, date, reason, notes = '', appointmentId = null, recordId = null } = req.body || {};
  if (!patientId || !date || !String(reason || '').trim()) return res.status(400).json({ error: 'Patient, follow-up date and reason are required.' });
  if (date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: 'The follow-up date cannot be in the past.' });
  const user = req.session.user;
  let dentistId = requestedDentistId;
  let clinicId = null;
  if (user.role === 'Dentist') dentistId = user.id;
  if (user.role === 'Clinic Owner') {
    const clinic = await clinicForOwner(user.id);
    if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
    clinicId = clinic.id;
    const dentist = await pool.query('SELECT 1 FROM dentists WHERE id = $1 AND clinic_id = $2 AND active', [dentistId, clinic.id]);
    if (!dentist.rowCount) return res.status(400).json({ error: 'Choose an active dentist from your clinic.' });
  }
  const assignment = await pool.query(
    'SELECT 1 FROM patients p WHERE p.id = $1 AND ($2::text IS NULL OR p.dentist_id = $2)',
    [patientId, user.role === 'Dentist' ? dentistId : null]
  );
  if (!assignment.rowCount) return res.status(403).json({ error: 'The patient is not available to this account.' });
  const result = await pool.query(
    `INSERT INTO follow_ups (patient_id, dentist_id, clinic_id, appointment_id, record_id, scheduled_date, reason, notes, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Scheduled', $9) RETURNING *`,
    [patientId, dentistId, clinicId, appointmentId, recordId, date, String(reason).trim(), String(notes).trim(), user.id]
  );
  await notify(patientId, 'follow_up_scheduled', 'Follow-up scheduled', `A follow-up is scheduled for ${date}: ${String(reason).trim()}.`, 'follow_up', result.rows[0].id);
  res.status(201).json({ id: result.rows[0].id, patientId, dentistId, clinicId, appointmentId, recordId, date, reason, notes, status: 'Scheduled' });
}));

router.patch('/follow-ups/:followUpId/status', requireRole('Administrator', 'Clinic Owner', 'Clinic Staff', 'Dentist'), handle(async (req, res) => {
  const { status, reason = '' } = req.body || {};
  if (!['Scheduled', 'Completed', 'Cancelled', 'Rejected'].includes(status)) return res.status(400).json({ error: 'Invalid follow-up status.' });
  if (status === 'Rejected' && !String(reason).trim()) return res.status(400).json({ error: 'A rejection reason is required.' });
  const scope = followUpScope(req.session.user, 4);
  const result = await pool.query(
    `UPDATE follow_ups f SET status = $1, rejection_reason = $2
     WHERE f.id = $3${scope.sql ? ` AND (${scope.sql})` : ''} RETURNING f.*`,
    [status, status === 'Rejected' ? String(reason).trim().slice(0, 1000) : '', req.params.followUpId, ...scope.params]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Follow-up not found.' });
  await notify(result.rows[0].patient_id, 'follow_up_status', `Follow-up ${status.toLowerCase()}`, status === 'Rejected' ? String(reason).trim() : `Your follow-up status is ${status.toLowerCase()}.`, 'follow_up', result.rows[0].id);
  res.json({ id: result.rows[0].id, status: result.rows[0].status, rejectionReason: result.rows[0].rejection_reason });
}));

router.get('/notifications', requireRole('Administrator', 'Clinic Owner', 'Clinic Staff', 'Dentist', 'Patient'), handle(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
    [req.session.user.id]
  );
  res.json(result.rows.map((row) => ({ id: row.id, type: row.type, title: row.title, message: row.message, entityType: row.entity_type, entityId: row.entity_id, createdAt: row.created_at, readAt: row.read_at })));
}));

router.patch('/notifications/:notificationId/read', handle(async (req, res) => {
  const result = await pool.query(
    'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING id, read_at',
    [req.params.notificationId, req.session.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Notification not found.' });
  res.json({ id: result.rows[0].id, readAt: result.rows[0].read_at });
}));

router.patch('/notifications/:notificationId/unread', handle(async (req, res) => {
  const result = await pool.query(
    'UPDATE notifications SET read_at = NULL WHERE id = $1 AND user_id = $2 RETURNING id, read_at',
    [req.params.notificationId, req.session.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Notification not found.' });
  res.json({ id: result.rows[0].id, readAt: result.rows[0].read_at });
}));

router.delete('/notifications/:notificationId', handle(async (req, res) => {
  const result = await pool.query(
    'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.notificationId, req.session.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Notification not found.' });
  res.json({ success: true, id: result.rows[0].id });
}));

router.patch('/notifications/read-all', handle(async (req, res) => {
  await pool.query('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND read_at IS NULL', [req.session.user.id]);
  res.json({ success: true });
}));

router.get('/admin/users', requireRole('Administrator'), handle(async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.username, u.name, u.role, u.clinic_id, u.disabled_at, u.created_at, c.name AS clinic_name
     FROM users u LEFT JOIN clinics c ON c.id = u.clinic_id ORDER BY u.created_at DESC`
  );
  res.json(result.rows);
}));

router.post('/admin/users', requireRole('Administrator'), handle(async (req, res) => {
  const { name, username, password, role, clinicId = null } = req.body || {};
  if (!name || !username || !password || password.length < 10 || !['Administrator', 'Clinic Staff', 'Dentist'].includes(role)) {
    return res.status(400).json({ error: 'Provide a name, username, password of at least 10 characters, and an allowed staff role.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let id;
    let dentist = null;
    if (role === 'Dentist') {
      const insertedDentist = await client.query('INSERT INTO dentists (name, specialty, clinic_id) VALUES ($1, $2, $3) RETURNING *', [name, req.body.specialty || 'General Dentistry', clinicId]);
      dentist = insertedDentist.rows[0];
      id = dentist.id;
    } else {
      const prefix = role === 'Administrator' ? 'A' : 'S';
      const sequence = role === 'Administrator' ? 'admins_id_seq' : 'staff_id_seq';
      const next = await client.query('SELECT $1 || nextval($2)::text AS id', [prefix, sequence]);
      id = next.rows[0].id;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await client.query(
      'INSERT INTO users (id, username, password_hash, role, name, clinic_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, username, passwordHash, role, name, clinicId]
    );
    if (dentist) await client.query('UPDATE dentists SET user_id = $1 WHERE id = $2', [id, dentist.id]);
    await client.query('COMMIT');
    res.status(201).json(userOut(result.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'That username already exists.' });
    throw error;
  } finally {
    client.release();
  }
}));

router.patch('/admin/users/:userId', requireRole('Administrator'), handle(async (req, res) => {
  const { disabled, clinicId } = req.body || {};
  if (req.params.userId === req.session.user.id && disabled === true) return res.status(400).json({ error: 'You cannot disable your own account.' });
  const current = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.userId]);
  if (!current.rowCount) return res.status(404).json({ error: 'User not found.' });
  if (disabled === true && current.rows[0].role === 'Administrator') {
    const activeAdmins = await pool.query("SELECT count(*)::int AS count FROM users WHERE role = 'Administrator' AND disabled_at IS NULL");
    if (activeAdmins.rows[0].count <= 1) return res.status(409).json({ error: 'The last active administrator cannot be disabled.' });
  }
  const result = await pool.query(
    `UPDATE users SET disabled_at = CASE WHEN $1::boolean IS NULL THEN disabled_at WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
       clinic_id = COALESCE($2, clinic_id) WHERE id = $3
     RETURNING id, username, name, role, clinic_id, disabled_at, created_at`,
    [typeof disabled === 'boolean' ? disabled : null, clinicId == null ? null : clinicId, req.params.userId]
  );
  res.json(result.rows[0]);
}));

router.delete('/admin/users/:userId', requireRole('Administrator'), handle(async (req, res) => {
  const userId = req.params.userId;
  if (userId === req.session.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const target = await client.query('SELECT id, role, disabled_at FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!target.rowCount) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ error: 'User not found.' });
    }
    if (target.rows[0].role === 'Administrator' && !target.rows[0].disabled_at) {
      const activeAdmins = await client.query("SELECT count(*)::int AS count FROM users WHERE role = 'Administrator' AND disabled_at IS NULL");
      if (activeAdmins.rows[0].count <= 1) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return res.status(409).json({ error: 'The last active administrator cannot be deleted.' });
      }
    }
    const ownedClinic = await client.query('SELECT 1 FROM clinics WHERE owner_user_id = $1 LIMIT 1', [userId]);
    if (ownedClinic.rowCount) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'This account owns a clinic. Transfer or remove the clinic before deleting the account.' });
    }
    const authoredFollowUp = await client.query('SELECT 1 FROM follow_ups WHERE created_by = $1 LIMIT 1', [userId]);
    if (authoredFollowUp.rowCount) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'This account created follow-ups. Disable it instead to preserve those records.' });
    }
    await client.query('UPDATE clinics SET reviewed_by = NULL WHERE reviewed_by = $1', [userId]);
    await client.query('UPDATE clinic_documents SET reviewed_by = NULL WHERE reviewed_by = $1', [userId]);
    await client.query("DELETE FROM app_sessions WHERE sess::jsonb->'user'->>'id' = $1", [userId]);
    const removed = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    if (removed.rowCount !== 1) throw new Error('The account could not be deleted.');
    await client.query('COMMIT');
    transactionOpen = false;
    res.json({ success: true, id: removed.rows[0].id });
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

module.exports = router;
