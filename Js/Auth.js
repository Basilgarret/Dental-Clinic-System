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
const AUTH_VIEWS = ['login-view', 'signup-view', 'verification-pending-view', 'forgot-password-view', 'resend-verification-view', 'reset-password-view'];

function showAuthView(viewId){
  AUTH_VIEWS.forEach(id=>document.getElementById(id).classList.toggle('hidden', id!==viewId));
}

function showAuthFeedback(id, message, type='error'){
  const element=document.getElementById(id);
  element.textContent=message;
  element.classList.toggle('success', type==='success');
  element.classList.toggle('warning', type==='warning');
  element.classList.add('show');
}

function clearAuthFeedback(id){
  const element=document.getElementById(id);
  element.textContent='';
  element.classList.remove('show','success','warning');
}

async function initLogin(){
  document.getElementById('show-forgot-password-link').addEventListener('click', event=>{
    event.preventDefault();
    showAuthView('forgot-password-view');
    clearAuthFeedback('forgot-password-feedback');
  });
  document.getElementById('show-resend-verification-link').addEventListener('click', event=>{
    event.preventDefault();
    showAuthView('resend-verification-view');
    clearAuthFeedback('resend-verification-feedback');
  });
  document.querySelectorAll('[data-show-login]').forEach(link=>link.addEventListener('click', event=>{
    event.preventDefault();
    switchToLogin();
  }));

  document.getElementById('forgot-password-form').addEventListener('submit', async event=>{
    event.preventDefault();
    clearAuthFeedback('forgot-password-feedback');
    try{
      const email=document.getElementById('forgot-password-email').value.trim();
      const result=await apiPost('/auth/forgot-password',{email});
      showAuthFeedback('forgot-password-feedback',result.message,'success');
    }catch(error){
      showAuthFeedback('forgot-password-feedback',error.message);
    }
  });

  document.getElementById('resend-verification-form').addEventListener('submit', async event=>{
    event.preventDefault();
    clearAuthFeedback('resend-verification-feedback');
    try{
      const email=document.getElementById('resend-verification-email').value.trim();
      const result=await apiPost('/auth/resend-verification',{email});
      showAuthFeedback('resend-verification-feedback',result.message,'success');
    }catch(error){
      showAuthFeedback('resend-verification-feedback',error.message);
    }
  });

  document.getElementById('verification-resend-button').addEventListener('click', async event=>{
    const button=event.currentTarget;
    if(!pendingVerificationEmail) return;
    clearAuthFeedback('verification-pending-feedback');
    const originalLabel=button.textContent;
    button.disabled=true;
    button.textContent='Sending\u2026';
    try{
      const result=await apiPost('/auth/resend-verification',{email:pendingVerificationEmail});
      showAuthFeedback('verification-pending-feedback',result.message,'success');
    }catch(error){
      showAuthFeedback('verification-pending-feedback',error.message);
    }finally{
      button.disabled=false;
      button.textContent=originalLabel;
    }
  });

  document.getElementById('reset-password-form').addEventListener('submit', async event=>{
    event.preventDefault();
    clearAuthFeedback('reset-password-feedback');
    const token=new URLSearchParams(window.location.search).get('resetPassword');
    if(!token){
      showAuthFeedback('reset-password-feedback','This password reset link is invalid or expired.');
      return;
    }
    try{
      const password=document.getElementById('reset-password-value').value;
      const result=await apiPost('/auth/reset-password',{token,password});
      document.getElementById('reset-password-form').reset();
      window.history.replaceState(null,'',window.location.pathname);
      switchToLogin();
      showAuthFeedback('login-feedback',result.message,result.notificationSent?'success':'warning');
    }catch(error){
      showAuthFeedback('reset-password-feedback',error.message);
    }
  });

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

  const authAction=await handleAuthLink();
  if(authAction==='reset'||authAction==='verified') return;

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

async function handleAuthLink(){
  const params=new URLSearchParams(window.location.search);
  const resetToken=params.get('resetPassword');
  if(resetToken){
    showAuthView('reset-password-view');
    return 'reset';
  }
  const verifyToken=params.get('verifyEmail');
  if(!verifyToken) return null;
  showAuthView('login-view');
  try{
    const result=await apiPost('/auth/verify-email',{token:verifyToken});
    window.history.replaceState(null,'',window.location.pathname);
    if(!result.user) throw new Error('Email verified, but your session could not be started. Please sign in.');
    await logIn(result.user);
    if(!result.notificationSent) showToast(result.message,'info');
    return 'verified';
  }catch(error){
    showAuthFeedback('login-feedback',error.message);
    return 'verification-error';
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
  openConfirm('You will need to sign in again to access the workspace.', 'Log out of Clearview Family Dental?', logOut, 'neutral');
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
  dashboard: ['Dashboard', 'A snapshot of today at Clearview Family Dental.'],
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
