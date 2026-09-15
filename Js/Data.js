/* ======================================================================
   SEED DATA
====================================================================== */
const dentists = [
  { id:'D1', name:'Dr. Marcus Reyes', specialty:'Orthodontics' },
  { id:'D2', name:'Dr. Elena Cho', specialty:'General & Cosmetic Dentistry' },
];

const users = [
  { id:'A1', username:'admin1', password:'admin123', role:'Administrator', name:'Grace Alvarez' },
  { id:'D1', username:'dentist1', password:'dentist123', role:'Dentist', name:'Dr. Marcus Reyes' },
  { id:'D2', username:'dentist2', password:'dentist123', role:'Dentist', name:'Dr. Elena Cho' },
  { id:'S1', username:'staff1', password:'staff123', role:'Clinic Staff', name:'Noel Ibarra' },
  { id:'P1', username:'patient1', password:'patient123', role:'Patient', name:'Liam Santos' },
  { id:'P2', username:'patient2', password:'patient123', role:'Patient', name:'Ana Dela Cruz' },
];

let seq = { P:6, AP:9, R:6, RX:4, T:6 };
function genId(prefix){ seq[prefix] = (seq[prefix]||0)+1; return prefix + seq[prefix]; }

const state = {
  currentUser: null,
  currentView: null,
  patients: [
    { id:'P1', name:'Liam Santos', dob:'1990-05-12', gender:'Male', phone:'0917-555-2231', email:'liam.santos@mail.com', address:'12 Rizal St, Cebu City', allergies:'Penicillin', dentistId:'D1', registered:'2025-01-10' },
    { id:'P2', name:'Ana Dela Cruz', dob:'1985-11-02', gender:'Female', phone:'0917-555-8842', email:'ana.delacruz@mail.com', address:'88 Mabini Ave, Cebu City', allergies:'None known', dentistId:'D2', registered:'2025-02-18' },
    { id:'P3', name:'Mikhail Tan', dob:'2001-03-22', gender:'Male', phone:'0918-224-1190', email:'mikhail.tan@mail.com', address:'45 Colon St, Cebu City', allergies:'Latex', dentistId:'D1', registered:'2025-04-03' },
    { id:'P4', name:'Bea Fernandez', dob:'1978-07-30', gender:'Female', phone:'0920-334-7765', email:'bea.fernandez@mail.com', address:'21 Osmena Blvd, Cebu City', allergies:'None known', dentistId:'D2', registered:'2025-05-27' },
    { id:'P5', name:'Carlos Villanueva', dob:'1995-09-14', gender:'Male', phone:'0928-771-4420', email:'carlos.v@mail.com', address:'9 Salinas Dr, Cebu City', allergies:'Ibuprofen', dentistId:'D1', registered:'2025-06-11' },
    { id:'P6', name:'Ruth Ocampo', dob:'1966-12-05', gender:'Female', phone:'0917-002-6631', email:'ruth.ocampo@mail.com', address:'3 Lahug Rd, Cebu City', allergies:'None known', dentistId:'D2', registered:'2025-08-01' },
  ],
  appointments: [
    { id:'AP1', patientId:'P1', dentistId:'D1', date:'2026-09-15', time:'09:00 AM', type:'Cleaning', status:'Scheduled', notes:'Routine 6-month cleaning.' },
    { id:'AP2', patientId:'P2', dentistId:'D2', date:'2026-09-15', time:'10:30 AM', type:'Consultation', status:'Scheduled', notes:'Whitening consultation.' },
    { id:'AP3', patientId:'P3', dentistId:'D1', date:'2026-09-16', time:'02:00 PM', type:'Filling', status:'Scheduled', notes:'Upper left molar.' },
    { id:'AP4', patientId:'P4', dentistId:'D2', date:'2026-09-10', time:'11:00 AM', type:'Root Canal', status:'Completed', notes:'Session 1 of 2.' },
    { id:'AP5', patientId:'P5', dentistId:'D1', date:'2026-09-08', time:'03:30 PM', type:'Checkup', status:'Completed', notes:'' },
    { id:'AP6', patientId:'P6', dentistId:'D2', date:'2026-09-05', time:'01:00 PM', type:'Extraction', status:'Cancelled', notes:'Patient rescheduled.' },
    { id:'AP7', patientId:'P1', dentistId:'D1', date:'2026-09-22', time:'04:00 PM', type:'Checkup', status:'Requested', notes:'Sensitivity on lower right side.' },
    { id:'AP8', patientId:'P2', dentistId:'D2', date:'2026-09-19', time:'09:30 AM', type:'Cleaning', status:'Scheduled', notes:'' },
  ],
  dentalRecords: [
    { id:'R1', patientId:'P1', date:'2026-03-11', dentistId:'D1', tooth:'#14, #15', procedure:'Composite Filling', diagnosis:'Moderate caries on upper left molars.', notes:'Local anesthesia used, no complications.' },
    { id:'R2', patientId:'P1', date:'2025-09-02', dentistId:'D1', tooth:'Full mouth', procedure:'Scaling & Polishing', diagnosis:'Mild gingivitis.', notes:'Advised improved flossing routine.' },
    { id:'R3', patientId:'P2', date:'2026-06-20', dentistId:'D2', tooth:'#8, #9', procedure:'Teeth Whitening', diagnosis:'Extrinsic staining.', notes:'In-office whitening session, good result.' },
    { id:'R4', patientId:'P3', date:'2026-01-15', dentistId:'D1', tooth:'#19', procedure:'Root Canal Therapy', diagnosis:'Irreversible pulpitis.', notes:'Crown placement recommended next visit.' },
    { id:'R5', patientId:'P4', date:'2026-09-10', dentistId:'D2', tooth:'#3', procedure:'Root Canal Therapy (Session 1)', diagnosis:'Deep decay reaching pulp.', notes:'Temporary filling placed; session 2 pending.' },
  ],
  prescriptions: [
    { id:'RX1', patientId:'P1', dentistId:'D1', date:'2026-03-11', status:'Completed', notes:'Take with food.', meds:[
      { name:'Amoxicillin', dosage:'500mg', frequency:'3x daily', duration:'7 days' },
      { name:'Ibuprofen', dosage:'400mg', frequency:'As needed for pain', duration:'5 days' },
    ]},
    { id:'RX2', patientId:'P3', dentistId:'D1', date:'2026-01-15', status:'Completed', notes:'', meds:[
      { name:'Amoxicillin', dosage:'500mg', frequency:'3x daily', duration:'7 days' },
    ]},
    { id:'RX3', patientId:'P4', dentistId:'D2', date:'2026-09-10', status:'Active', notes:'Follow up in 2 weeks for session 2.', meds:[
      { name:'Clindamycin', dosage:'300mg', frequency:'4x daily', duration:'5 days' },
      { name:'Paracetamol', dosage:'500mg', frequency:'Every 6 hours as needed', duration:'5 days' },
    ]},
  ],
  transactions: [
    { id:'T1', patientId:'P1', date:'2026-03-11', description:'Composite Filling (x2 teeth)', amount:4200, method:'Cash', status:'Paid' },
    { id:'T2', patientId:'P2', date:'2026-06-20', description:'In-office Teeth Whitening', amount:6500, method:'Card', status:'Paid' },
    { id:'T3', patientId:'P3', date:'2026-01-15', description:'Root Canal Therapy', amount:9800, method:'Insurance', status:'Pending' },
    { id:'T4', patientId:'P4', date:'2026-09-10', description:'Root Canal Therapy (Session 1)', amount:5000, method:'Card', status:'Pending' },
    { id:'T5', patientId:'P6', date:'2026-08-01', description:'Initial Consultation & X-rays', amount:1500, method:'Cash', status:'Overdue' },
    { id:'T6', patientId:'P5', date:'2026-09-08', description:'Routine Checkup', amount:800, method:'Cash', status:'Paid' },
  ],
};

const TIME_SLOTS = ['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM'];
const APPT_TYPES = ['Checkup','Cleaning','Consultation','Filling','Extraction','Root Canal','Whitening','Orthodontic Adjustment','Other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-()\s]{7,15}$/;