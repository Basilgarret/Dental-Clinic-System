/* ======================================================================
   RUNTIME DATA
   Records are loaded from authenticated PostgreSQL API routes.
====================================================================== */
const dentists = [];
const state = {
  currentUser: null,
  currentView: null,
  clinic: null,
  clinics: [],
  followUps: [],
  notifications: [],
  patients: [],
  appointments: [],
  dentalRecords: [],
  prescriptions: [],
  services: [],
  transactions: [],
};

const TIME_SLOTS = ['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM'];
const APPT_TYPES = ['Checkup','Cleaning','Consultation','Filling','Extraction','Root Canal','Whitening','Orthodontic Adjustment','Other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-()\s]{7,15}$/;