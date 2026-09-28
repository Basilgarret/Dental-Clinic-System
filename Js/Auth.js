/* ======================================================================
   AUTH / MENUS
====================================================================== */
const MENUS = {
  'Administrator': [
    {key:'dashboard', label:'Dashboard', icon:ICONS.dashboard},
    {key:'patients', label:'Patients', icon:ICONS.patients},
    {key:'appointments', label:'Appointments', icon:ICONS.appointments},
    {key:'clinicApprovals', label:'Clinic approvals', icon:ICONS.info},
    {key:'adminUsers', label:'User management', icon:ICONS.profile},
    {key:'dentists', label:'Dentists', icon:ICONS.profile},
    {key:'services', label:'Treatments & Services', icon:ICONS.tooth},
    {key:'records', label:'Dental Records', icon:ICONS.records},
    {key:'prescriptions', label:'Prescriptions', icon:ICONS.prescriptions},
    {key:'followUps', label:'Follow-ups', icon:ICONS.clock},
    {key:'transactions', label:'Transactions', icon:ICONS.transactions},
    {key:'reports', label:'Reports', icon:ICONS.dashboard},
  ],
  'Dentist': [
    {key:'dashboard', label:'Dashboard', icon:ICONS.dashboard},
    {key:'patients', label:'My Patients', icon:ICONS.patients},
    {key:'appointments', label:'My Schedule', icon:ICONS.appointments},
    {key:'records', label:'Dental Records', icon:ICONS.records},
    {key:'prescriptions', label:'Prescriptions', icon:ICONS.prescriptions},
  ],
  'Clinic Staff': [
    {key:'dashboard', label:'Dashboard', icon:ICONS.dashboard},
    {key:'patients', label:'Patients', icon:ICONS.patients},
    {key:'appointments', label:'Appointments', icon:ICONS.appointments},
    {key:'followUps', label:'Follow-ups', icon:ICONS.clock},
    {key:'dentists', label:'Dentists', icon:ICONS.profile},
    {key:'services', label:'Treatments & Services', icon:ICONS.tooth},
    {key:'transactions', label:'Transactions', icon:ICONS.transactions},
  ],
  'Patient': [
    {key:'dashboard', label:'Overview', icon:ICONS.dashboard},
    {key:'clinics', label:'Find a clinic', icon:ICONS.info},
    {key:'appointments', label:'My Appointments', icon:ICONS.appointments},
    {key:'records', label:'My Dental Records', icon:ICONS.records},
    {key:'prescriptions', label:'My Prescriptions', icon:ICONS.prescriptions},
    {key:'transactions', label:'Billing', icon:ICONS.transactions},
    {key:'profile', label:'My Profile', icon:ICONS.profile},
    {key:'followUps', label:'Follow-ups', icon:ICONS.clock},
  ],
  'Clinic Owner': [
    {key:'dashboard', label:'Clinic overview', icon:ICONS.dashboard},
    {key:'clinicProfile', label:'Clinic profile & documents', icon:ICONS.records},
    {key:'dentists', label:'Dentists', icon:ICONS.patients},
    {key:'services', label:'Treatments & Services', icon:ICONS.tooth},
    {key:'appointments', label:'Appointments', icon:ICONS.appointments},
    {key:'followUps', label:'Follow-ups', icon:ICONS.clock},
  ],
};

let selectedLoginRole = 'Administrator';

async function initLogin(){
  document.querySelectorAll('.role-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.role-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      selectedLoginRole = tab.dataset.role;
      document.getElementById('login-error').classList.remove('show');
    });
  });

  document.getElementById('login-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const uField = document.getElementById('field-username');
    const pField = document.getElementById('field-password');
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    let valid = true;
    if(!u){ uField.classList.add('error'); valid = false; } else uField.classList.remove('error');
    if(!p){ pField.classList.add('error'); valid = false; } else pField.classList.remove('error');
    if(!valid) return;

    const errBox = document.getElementById('login-error');
    errBox.classList.remove('show');
    const submitBtn = e.target.querySelector('button[type=submit]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in\u2026';

    try{
      const result = await apiPost('/auth/login', { username: u, password: p });
      // Keep the role tabs in sync with whichever account actually signed in.
      document.querySelectorAll('.role-tab').forEach(t=>t.classList.toggle('active', t.dataset.role===result.user.role));
      selectedLoginRole = result.user.role;
      await logIn(result.user);
    }catch(err){
      errBox.textContent = err.message;
      errBox.classList.add('show');
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

  initSignup();

  // Populate the dentist list up front so the Patient sign-up form's
  // "Preferred Dentist" dropdown has options even before anyone logs in.
  try{
    await loadDentists();
  }catch(err){
    console.warn('Could not load dentist list yet:', err.message);
  }

  try{
    const session = await apiGet('/auth/me');
    await logIn(session.user);
    return;
  }catch(err){
    if(err.message !== 'Sign in to continue.'){
      const errBox = document.getElementById('login-error');
      errBox.textContent = err.message;
      errBox.classList.add('show');
    }
  }

  // A brand-new, empty database has no accounts to sign in with yet —
  // send people straight to registration instead of a dead-end login form.
  try{
    const hasAccounts = await checkHasAccounts();
    if(!hasAccounts){
      switchToSignup();
    }
  }catch(err){
    // If the API can't be reached at all, surface that clearly rather
    // than silently showing an empty login form.
    const errBox = document.getElementById('login-error');
    errBox.textContent = err.message;
    errBox.classList.add('show');
  }
}

async function logIn(user){
  await loadDB(user);
  state.currentUser = user;
  state.clinic = user.role === 'Clinic Owner' ? await apiGet('/clinics/mine') : null;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  document.getElementById('sidebar-avatar').textContent = initials(user.name);
  document.getElementById('sidebar-name').textContent = user.name;
  document.getElementById('sidebar-role-sub').textContent = user.role;
  document.getElementById('sidebar-role-label').textContent = user.role.toUpperCase() + ' WORKSPACE';
  renderSidebarNav();
  initAppShell();
  renderNotifications();
  navigateTo('dashboard');
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric', year:'numeric'});
}

async function logOut(){
  try{ await apiPost('/auth/logout', {}); }catch(err){ console.warn('Server logout failed:', err.message); }
  state.currentUser = null;
  state.clinic = null;
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-form').reset();
  document.getElementById('login-error').classList.remove('show');
  switchToLogin();
  showToast('You have been logged out.', 'info');
}
document.getElementById('logout-btn').addEventListener('click', ()=>{
  openConfirm('You will need to sign in again to access the workspace.', 'Log out of Wellstone Dental?', logOut, 'neutral');
});

function renderSidebarNav(){
  const role = state.currentUser.role;
  const nav = document.getElementById('sidebar-nav');
  const requestedCount = state.appointments.filter(a=>a.status==='Requested').length;
  nav.innerHTML = MENUS[role].map(item=>{
    const badge = (item.key==='appointments' && (role==='Administrator'||role==='Clinic Staff') && requestedCount>0)
      ? `<span class="nav-badge">${requestedCount}</span>` : '';
    return `<button type="button" class="nav-item" data-view="${item.key}" aria-label="${item.label}">${item.icon}<span>${item.label}</span>${badge}</button>`;
  }).join('');
  nav.querySelectorAll('.nav-item').forEach(el=>{
    el.addEventListener('click', ()=> navigateTo(el.dataset.view));
  });
}

const VIEW_TITLES = {
  dashboard: ['Dashboard', 'A snapshot of today at Wellstone Dental.'],
  patients: ['Patients', 'View and manage patient charts.'],
  appointments: ['Appointments', 'Book, confirm and track visits.'],
  dentists: ['Dentists', 'The clinicians and specialties at your clinic.'],
  services: ['Treatments & Services', 'Manage the clinic service catalog.'],
  records: ['Dental Records', 'Clinical history and treatment notes.'],
  prescriptions: ['Prescriptions', 'Medications prescribed to patients.'],
  transactions: ['Transactions', 'Invoices and payments.'],
  reports: ['Reports', 'Clinic activity and payment summaries.'],
  profile: ['My Profile', 'Your personal and contact information.'],
  clinics: ['Clinics', 'Browse approved clinics and services.'],
  clinicProfile: ['Clinic profile & documents', 'Manage clinic details and verification documents.'],
  adminUsers: ['User management', 'Manage staff accounts and clinic access.'],
  followUps: ['Follow-ups', 'Upcoming care and follow-up visits.'],
  clinicApprovals: ['Clinic verification', 'Review clinic applications and documents.'],
};

function navigateTo(view){
  state.currentView = view;
  document.querySelectorAll('.nav-item').forEach(el=> el.classList.toggle('active', el.dataset.view===view));
  const [title, sub] = VIEW_TITLES[view] || ['', ''];
  document.getElementById('topbar-title').textContent = title;
  document.getElementById('topbar-sub').textContent = sub;
  const renderers = {
    dashboard: renderDashboard, patients: renderPatients, appointments: renderAppointments,
    dentists: state.currentUser.role === 'Clinic Owner' ? renderClinicTeam : renderDentists,
    services: state.currentUser.role === 'Clinic Owner' ? renderClinicServices : renderServices,
    reports: renderReports,
    clinicProfile: renderClinicProfile,
    clinicApprovals: renderClinicApprovals,
    adminUsers: renderAdminUsers,
    clinics: renderClinicDirectory,
    followUps: renderFollowUps,
    records: renderRecords, prescriptions: renderPrescriptions, transactions: renderTransactions,
    profile: renderProfile,
  };
  (renderers[view] || function(){ document.getElementById('view-content').innerHTML=''; })();
  document.getElementById('view-content').scrollTop = 0;
  window.scrollTo(0,0);
}
