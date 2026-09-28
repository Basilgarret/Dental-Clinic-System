CREATE SEQUENCE IF NOT EXISTS dentists_id_seq;
CREATE SEQUENCE IF NOT EXISTS patients_id_seq;
CREATE SEQUENCE IF NOT EXISTS appointments_id_seq;
CREATE SEQUENCE IF NOT EXISTS dental_records_id_seq;
CREATE SEQUENCE IF NOT EXISTS prescriptions_id_seq;
CREATE SEQUENCE IF NOT EXISTS transactions_id_seq;
CREATE SEQUENCE IF NOT EXISTS admins_id_seq;
CREATE SEQUENCE IF NOT EXISTS staff_id_seq;
CREATE SEQUENCE IF NOT EXISTS clinic_owners_id_seq;

CREATE TABLE IF NOT EXISTS dentists (
  id TEXT PRIMARY KEY DEFAULT ('D' || nextval('dentists_id_seq')::text),
  name TEXT NOT NULL,
  specialty TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Administrator', 'Dentist', 'Clinic Staff', 'Patient')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY DEFAULT ('P' || nextval('patients_id_seq')::text),
  name TEXT NOT NULL,
  dob DATE NOT NULL,
  gender TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  allergies TEXT NOT NULL DEFAULT '',
  dentist_id TEXT REFERENCES dentists(id) ON DELETE SET NULL,
  registered DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY DEFAULT ('AP' || nextval('appointments_id_seq')::text),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  dentist_id TEXT NOT NULL REFERENCES dentists(id),
  date DATE NOT NULL,
  time TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Requested', 'Scheduled', 'Completed', 'Cancelled')),
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS dental_records (
  id TEXT PRIMARY KEY DEFAULT ('R' || nextval('dental_records_id_seq')::text),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  dentist_id TEXT NOT NULL REFERENCES dentists(id),
  date DATE NOT NULL,
  tooth TEXT NOT NULL DEFAULT '',
  procedure_name TEXT NOT NULL,
  diagnosis TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY DEFAULT ('RX' || nextval('prescriptions_id_seq')::text),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  dentist_id TEXT NOT NULL REFERENCES dentists(id),
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Active', 'Completed')),
  notes TEXT NOT NULL DEFAULT '',
  meds JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT ('T' || nextval('transactions_id_seq')::text),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  method TEXT NOT NULL CHECK (method IN ('Cash', 'Card', 'Insurance', 'Online')),
  status TEXT NOT NULL CHECK (status IN ('Paid', 'Pending', 'Overdue'))
);

CREATE TABLE IF NOT EXISTS services (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS services_name_lower_idx ON services (lower(name));

ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Administrator', 'Dentist', 'Clinic Staff', 'Patient', 'Clinic Owner'));

CREATE TABLE IF NOT EXISTS clinics (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  name TEXT NOT NULL,
  registration_number TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  specializations TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Pending Review'
    CHECK (status IN ('Pending Review', 'Approved', 'Rejected')),
  rejection_reason TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_id BIGINT REFERENCES clinics(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clinics_registration_number_idx
  ON clinics (lower(registration_number)) WHERE registration_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS clinics_public_search_idx
  ON clinics (status, lower(city), lower(region));

CREATE TABLE IF NOT EXISTS clinic_documents (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  status TEXT NOT NULL DEFAULT 'Pending Review'
    CHECK (status IN ('Pending Review', 'Approved', 'Rejected')),
  rejection_reason TEXT NOT NULL DEFAULT '',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE dentists ADD COLUMN IF NOT EXISTS clinic_id BIGINT REFERENCES clinics(id) ON DELETE SET NULL;
ALTER TABLE dentists ADD COLUMN IF NOT EXISTS user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE dentists ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE dentists ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE dentists ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE services ADD COLUMN IF NOT EXISTS clinic_id BIGINT REFERENCES clinics(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS services_name_lower_idx;
CREATE UNIQUE INDEX IF NOT EXISTS services_global_name_lower_idx
  ON services (lower(name)) WHERE clinic_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS services_clinic_name_lower_idx
  ON services (clinic_id, lower(name)) WHERE clinic_id IS NOT NULL;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinic_id BIGINT REFERENCES clinics(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_id BIGINT REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_date DATE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_time TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('Requested', 'Scheduled', 'Reschedule Requested', 'Completed', 'Cancelled', 'Rejected'));

CREATE TABLE IF NOT EXISTS follow_ups (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  dentist_id TEXT NOT NULL REFERENCES dentists(id),
  clinic_id BIGINT REFERENCES clinics(id) ON DELETE SET NULL,
  appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  record_id TEXT REFERENCES dental_records(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Requested'
    CHECK (status IN ('Requested', 'Scheduled', 'Completed', 'Cancelled', 'Rejected')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rejection_reason TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS follow_ups_patient_date_idx ON follow_ups (patient_id, scheduled_date);
