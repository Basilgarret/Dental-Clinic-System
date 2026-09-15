/* ======================================================================
   AUTH / MENUS
====================================================================== */
const MENUS = {
  'Administrator': [
    {key:'dashboard', label:'Dashboard', icon:ICONS.dashboard},
    {key:'patients', label:'Patients', icon:ICONS.patients},
    {key:'appointments', label:'Appointments', icon:ICONS.appointments},
    {key:'records', label:'Dental Records', icon:ICONS.records},
    {key:'prescriptions', label:'Prescriptions', icon:ICONS.prescriptions},
    {key:'transactions', label:'Transactions', icon:ICONS.transactions},
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
    {key:'transactions', label:'Transactions', icon:ICONS.transactions},
  ],
  'Patient': [
    {key:'dashboard', label:'Overview', icon:ICONS.dashboard},
    {key:'appointments', label:'My Appointments', icon:ICONS.appointments},
    {key:'records', label:'My Dental Records', icon:ICONS.records},
    {key:'prescriptions', label:'My Prescriptions', icon:ICONS.prescriptions},
    {key:'transactions', label:'Billing', icon:ICONS.transactions},
    {key:'profile', label:'My Profile', icon:ICONS.profile},
  ],
};

const DEMO_ACCOUNTS = [
  {role:'Administrator', username:'admin1', password:'admin123'},
  {role:'Dentist', username:'dentist1', password:'dentist123'},
  {role:'Dentist', username:'dentist2', password:'dentist123'},
  {role:'Clinic Staff', username:'staff1', password:'staff123'},
  {role:'Patient', username:'patient1', password:'patient123'},
  {role:'Patient', username:'patient2', password:'patient123'},
];

let selectedLoginRole = 'Administrator';

function initLogin(){
  document.querySelectorAll('.role-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.role-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      selectedLoginRole = tab.dataset.role;
      document.getElementById('login-error').classList.remove('show');
    });
  });

  const chipsRoot = document.getElementById('demo-chips');
  chipsRoot.innerHTML = DEMO_ACCOUNTS.map(a=>
    `<span class="demo-chip" data-u="${a.username}" data-p="${a.password}" data-r="${escapeHtml(a.role)}">${escapeHtml(a.role)}: ${a.username}</span>`
  ).join('');
  chipsRoot.querySelectorAll('.demo-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      document.getElementById('login-username').value = chip.dataset.u;
      document.getElementById('login-password').value = chip.dataset.p;
      document.querySelectorAll('.role-tab').forEach(t=>t.classList.toggle('active', t.dataset.role===chip.dataset.r));
      selectedLoginRole = chip.dataset.r;
      document.getElementById('login-error').classList.remove('show');
    });
  });

  document.getElementById('login-form').addEventListener('submit', (e)=>{
    e.preventDefault();
    const uField = document.getElementById('field-username');
    const pField = document.getElementById('field-password');
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    let valid = true;
    if(!u){ uField.classList.add('error'); valid = false; } else uField.classList.remove('error');
    if(!p){ pField.classList.add('error'); valid = false; } else pField.classList.remove('error');
    if(!valid) return;

    const match = users.find(x=>x.username===u && x.password===p);
    const errBox = document.getElementById('login-error');
    if(!match){
      errBox.classList.add('show');
      return;
    }
    errBox.classList.remove('show');
    // Keep the role tabs in sync with whichever account actually signed in.
    document.querySelectorAll('.role-tab').forEach(t=>t.classList.toggle('active', t.dataset.role===match.role));
    selectedLoginRole = match.role;
    logIn(match);
  });
}

function logIn(user){
  state.currentUser = user;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  document.getElementById('sidebar-avatar').textContent = initials(user.name);
  document.getElementById('sidebar-name').textContent = user.name;
  document.getElementById('sidebar-role-sub').textContent = user.role;
  document.getElementById('sidebar-role-label').textContent = user.role.toUpperCase() + ' WORKSPACE';
  renderSidebarNav();
  navigateTo('dashboard');
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric', year:'numeric'});
}

function logOut(){
  state.currentUser = null;
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-form').reset();
  document.getElementById('login-error').classList.remove('show');
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
    return `<div class="nav-item" data-view="${item.key}">${item.icon}<span>${item.label}</span>${badge}</div>`;
  }).join('');
  nav.querySelectorAll('.nav-item').forEach(el=>{
    el.addEventListener('click', ()=> navigateTo(el.dataset.view));
  });
}

const VIEW_TITLES = {
  dashboard: ['Dashboard', 'A snapshot of today at Wellstone Dental.'],
  patients: ['Patients', 'View and manage patient charts.'],
  appointments: ['Appointments', 'Book, confirm and track visits.'],
  records: ['Dental Records', 'Clinical history and treatment notes.'],
  prescriptions: ['Prescriptions', 'Medications prescribed to patients.'],
  transactions: ['Transactions', 'Invoices and payments.'],
  profile: ['My Profile', 'Your personal and contact information.'],
};

function navigateTo(view){
  state.currentView = view;
  document.querySelectorAll('.nav-item').forEach(el=> el.classList.toggle('active', el.dataset.view===view));
  const [title, sub] = VIEW_TITLES[view] || ['', ''];
  document.getElementById('topbar-title').textContent = title;
  document.getElementById('topbar-sub').textContent = sub;
  const renderers = {
    dashboard: renderDashboard, patients: renderPatients, appointments: renderAppointments,
    records: renderRecords, prescriptions: renderPrescriptions, transactions: renderTransactions,
    profile: renderProfile,
  };
  (renderers[view] || function(){ document.getElementById('view-content').innerHTML=''; })();
  document.getElementById('view-content').scrollTop = 0;
  window.scrollTo(0,0);
}