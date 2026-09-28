/* ======================================================================
   DATABASE LOADING
   The real database is PostgreSQL, reached through the API server
   (see the separate dental-clinic-server project). This file's job is
   just to pull the current data into the browser's in-memory `dentists`
   / `state` arrays so the existing render functions can use them
   exactly as before. Individual add/edit/delete actions save themselves
   straight to the API at the moment they happen (see each module's
   openXForm / delete handlers) — there is no separate "save everything"
   step anymore.
====================================================================== */

async function loadDB(user){
  const transactionRequest = user.role === 'Dentist' ? Promise.resolve([]) : apiGet('/transactions');
  const [dentistList, patientList, appointmentList, recordList, prescriptionList, transactionList, serviceList, clinicList, followUpList, notificationList] = await Promise.all([
    apiGet('/dentists'),
    apiGet('/patients'),
    apiGet('/appointments'),
    apiGet('/records'),
    apiGet('/prescriptions'),
    transactionRequest,
    apiGet('/services'),
    apiGet('/clinics'),
    apiGet('/follow-ups'),
    apiGet('/notifications'),
  ]);

  dentists.length = 0;
  dentistList.forEach(d => dentists.push(d));

  state.patients = patientList;
  state.appointments = appointmentList;
  state.dentalRecords = recordList;
  state.prescriptions = prescriptionList;
  state.transactions = transactionList;
  state.services = serviceList;
  state.clinics = clinicList;
  state.followUps = followUpList;
  state.notifications = notificationList;
}

// Used on the login/signup screen, before anyone is signed in: just the
// dentist list, needed for the "Preferred Dentist" field on the Patient
// sign-up form. The full loadDB() above runs again right after login.
async function loadDentists(){
  const list = await apiGet('/dentists');
  dentists.length = 0;
  list.forEach(d => dentists.push(d));
}

async function checkHasAccounts(){
  const result = await apiGet('/auth/status');
  return !!(result && result.hasAccounts);
}
