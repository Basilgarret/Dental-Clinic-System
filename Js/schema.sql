CREATE SEQUENCE IF NOT EXISTS dentists_id_seq;
CREATE SEQUENCE IF NOT EXISTS patients_id_seq;
CREATE SEQUENCE IF NOT EXISTS appointments_id_seq;
CREATE SEQUENCE IF NOT EXISTS dental_records_id_seq;
CREATE SEQUENCE IF NOT EXISTS prescriptions_id_seq;
CREATE SEQUENCE IF NOT EXISTS transactions_id_seq;
CREATE SEQUENCE IF NOT EXISTS admins_id_seq;
CREATE SEQUENCE IF NOT EXISTS staff_id_seq;

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
