// Converts PostgreSQL rows (snake_case columns) into the exact
// camelCase shapes the frontend already works with, so the frontend
// code barely has to change to move from localStorage to this API.

function dateOut(value) {
  if (!value) return value;
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dentistOut(row) {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    clinicId: row.clinic_id || null,
    userId: row.user_id || null,
    phone: row.phone || '',
    email: row.email || '',
    active: row.active !== false,
  };
}

function userOut(row) {
  return { id: row.id, username: row.username, role: row.role, name: row.name, clinicId: row.clinic_id || null };
}

function patientOut(row) {
  return {
    id: row.id,
    name: row.name,
    dob: dateOut(row.dob),
    gender: row.gender,
    phone: row.phone,
    email: row.email,
    address: row.address || '',
    allergies: row.allergies || '',
    dentistId: row.dentist_id || '',
    registered: dateOut(row.registered),
  };
}

function appointmentOut(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    dentistId: row.dentist_id,
    date: dateOut(row.date),
    time: row.time,
    type: row.type,
    status: row.status,
    notes: row.notes || '',
    clinicId: row.clinic_id || null,
    serviceId: row.service_id || null,
    rejectionReason: row.rejection_reason || '',
    rescheduleDate: dateOut(row.reschedule_date) || null,
    rescheduleTime: row.reschedule_time || '',
    rescheduleReason: row.reschedule_reason || '',
  };
}

function recordOut(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    dentistId: row.dentist_id,
    date: dateOut(row.date),
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
    date: dateOut(row.date),
    status: row.status,
    notes: row.notes || '',
    meds: row.meds || [],
  };
}

function transactionOut(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: dateOut(row.date),
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
    clinicId: row.clinic_id || null,
  };
}

module.exports = {
  dateOut, dentistOut, userOut, patientOut, appointmentOut, recordOut, prescriptionOut, transactionOut, serviceOut,
};
