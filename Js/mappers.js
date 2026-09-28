// Converts PostgreSQL rows (snake_case columns) into the exact
// camelCase shapes the frontend already works with, so the frontend
// code barely has to change to move from localStorage to this API.

function dentistOut(row) {
  return { id: row.id, name: row.name, specialty: row.specialty };
}

function userOut(row) {
  // Never send password_hash to the client.
  return { id: row.id, username: row.username, role: row.role, name: row.name };
}

function patientOut(row) {
  return {
    id: row.id,
    name: row.name,
    dob: row.dob,
    gender: row.gender,
    phone: row.phone,
    email: row.email,
    address: row.address || '',
    allergies: row.allergies || '',
    dentistId: row.dentist_id || '',
    registered: row.registered,
  };
}

function appointmentOut(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    dentistId: row.dentist_id,
    date: row.date,
    time: row.time,
    type: row.type,
    status: row.status,
    notes: row.notes || '',
  };
}

function recordOut(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    dentistId: row.dentist_id,
    date: row.date,
    tooth: row.tooth || '',
    procedure: row.procedure_name,
    diagnosis: row.diagnosis || '',
    notes: row.notes || '',
  };
}

function prescriptionOut(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    dentistId: row.dentist_id,
    date: row.date,
    status: row.status,
    notes: row.notes || '',
    meds: row.meds || [],
  };
}

function transactionOut(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    description: row.description,
    amount: row.amount,
    method: row.method,
    status: row.status,
  };
}

function serviceOut(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    durationMinutes: row.duration_minutes,
    active: row.active,
  };
}

module.exports = {
  dentistOut, userOut, patientOut, appointmentOut, recordOut, prescriptionOut, transactionOut, serviceOut,
};
