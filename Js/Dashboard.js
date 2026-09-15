/* ======================================================================
   DASHBOARD
====================================================================== */
function renderDashboard(){
  const role = state.currentUser.role;
  const root = document.getElementById('view-content');
  const todayStr = todayISO();

  if(role === 'Patient'){
    const pid = state.currentUser.id;
    const myAppts = state.appointments.filter(a=>a.patientId===pid);
    const upcoming = myAppts.filter(a=> a.date>=todayStr && (a.status==='Scheduled'||a.status==='Requested')).sort((a,b)=>a.date.localeCompare(b.date))[0];
    const balance = state.transactions.filter(t=>t.patientId===pid && t.status!=='Paid').reduce((s,t)=>s+t.amount,0);
    const activeRx = state.prescriptions.filter(r=>r.patientId===pid && r.status==='Active').length;

    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card accent">
          <div class="label">Next appointment</div>
          <div class="value" style="font-size:19px;">${upcoming ? formatDate(upcoming.date)+' \u00b7 '+upcoming.time : 'None scheduled'}</div>
          <div class="hint">${upcoming ? (upcoming.type+' with '+dentistName(upcoming.dentistId)) : 'Book a visit when you\'re ready'}</div>
        </div>
        <div class="stat-card">
          <div class="label">Outstanding balance</div>
          <div class="value">${formatMoney(balance)}</div>
          <div class="hint">${balance>0 ? 'Across pending invoices' : 'You\'re all settled up'}</div>
        </div>
        <div class="stat-card">
          <div class="label">Active prescriptions</div>
          <div class="value">${activeRx}</div>
          <div class="hint">Currently being taken</div>
        </div>
        <div class="stat-card">
          <div class="label">Total visits on file</div>
          <div class="value">${myAppts.filter(a=>a.status==='Completed').length}</div>
          <div class="hint">Completed appointments</div>
        </div>
      </div>
      <div class="dash-grid">
        <div class="panel">
          <div class="panel-header"><h3>Upcoming &amp; recent visits</h3></div>
          <div class="panel-body">${apptTimeline(myAppts)}</div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Quick actions</h3></div>
          <div class="panel-body pad quick-actions">
            <button class="btn btn-primary" id="qa-book">${ICONS.cal_plus} Request an appointment</button>
            <button class="btn btn-outline" id="qa-records">${ICONS.records} View my dental records</button>
            <button class="btn btn-outline" id="qa-billing">${ICONS.cash} View billing</button>
          </div>
        </div>
      </div>`;
    document.getElementById('qa-book').addEventListener('click', ()=> openAppointmentForm('add'));
    document.getElementById('qa-records').addEventListener('click', ()=> navigateTo('records'));
    document.getElementById('qa-billing').addEventListener('click', ()=> navigateTo('transactions'));
    return;
  }

  if(role === 'Dentist'){
    const did = state.currentUser.id;
    const myAppts = state.appointments.filter(a=>a.dentistId===did);
    const todays = myAppts.filter(a=>a.date===todayStr && a.status!=='Cancelled');
    const myPatients = state.patients.filter(p=>p.dentistId===did);
    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card accent"><div class="label">Today's appointments</div><div class="value">${todays.length}</div><div class="hint">${todayStr===todayStr?'Scheduled for today':''}</div></div>
        <div class="stat-card"><div class="label">My patients</div><div class="value">${myPatients.length}</div><div class="hint">Assigned to you</div></div>
        <div class="stat-card"><div class="label">Pending requests</div><div class="value">${myAppts.filter(a=>a.status==='Requested').length}</div><div class="hint">Awaiting front-desk confirmation</div></div>
        <div class="stat-card"><div class="label">Active prescriptions</div><div class="value">${state.prescriptions.filter(r=>r.dentistId===did && r.status==='Active').length}</div><div class="hint">Currently in progress</div></div>
      </div>
      <div class="dash-grid">
        <div class="panel">
          <div class="panel-header"><h3>Today's schedule</h3></div>
          <div class="panel-body">${apptTimeline(todays.length?todays:myAppts.filter(a=>a.date>=todayStr && a.status==='Scheduled').slice(0,5), true)}</div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Quick actions</h3></div>
          <div class="panel-body pad quick-actions">
            <button class="btn btn-primary" id="qa-record">${ICONS.records} Add dental record</button>
            <button class="btn btn-outline" id="qa-rx">${ICONS.prescriptions} Write prescription</button>
            <button class="btn btn-outline" id="qa-sched">${ICONS.appointments} View full schedule</button>
          </div>
        </div>
      </div>`;
    document.getElementById('qa-record').addEventListener('click', ()=> openRecordForm('add'));
    document.getElementById('qa-rx').addEventListener('click', ()=> openPrescriptionForm('add'));
    document.getElementById('qa-sched').addEventListener('click', ()=> navigateTo('appointments'));
    return;
  }

  if(role === 'Clinic Staff'){
    const todays = state.appointments.filter(a=>a.date===todayStr && a.status!=='Cancelled');
    const pendingPay = state.transactions.filter(t=>t.status!=='Paid').length;
    const requests = state.appointments.filter(a=>a.status==='Requested');
    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card accent"><div class="label">Today's appointments</div><div class="value">${todays.length}</div><div class="hint">Across all dentists</div></div>
        <div class="stat-card"><div class="label">Pending payments</div><div class="value">${pendingPay}</div><div class="hint">Invoices awaiting settlement</div></div>
        <div class="stat-card"><div class="label">Appointment requests</div><div class="value">${requests.length}</div><div class="hint">Waiting to be confirmed</div></div>
        <div class="stat-card"><div class="label">Total patients</div><div class="value">${state.patients.length}</div><div class="hint">Registered on file</div></div>
      </div>
      <div class="dash-grid">
        <div class="panel">
          <div class="panel-header"><h3>Requests to confirm</h3></div>
          <div class="panel-body">${requests.length ? apptTimeline(requests) : emptyState('No pending requests', 'New patient-submitted requests will appear here for confirmation.')}</div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Quick actions</h3></div>
          <div class="panel-body pad quick-actions">
            <button class="btn btn-primary" id="qa-newpatient">${ICONS.plus} Register new patient</button>
            <button class="btn btn-outline" id="qa-newappt">${ICONS.cal_plus} Schedule appointment</button>
            <button class="btn btn-outline" id="qa-invoice">${ICONS.cash} Record a payment</button>
          </div>
        </div>
      </div>`;
    document.getElementById('qa-newpatient').addEventListener('click', ()=> openPatientForm('add'));
    document.getElementById('qa-newappt').addEventListener('click', ()=> openAppointmentForm('add'));
    document.getElementById('qa-invoice').addEventListener('click', ()=> openTransactionForm('add'));
    return;
  }

  // Administrator
  const pendingAmount = state.transactions.filter(t=>t.status!=='Paid').reduce((s,t)=>s+t.amount,0);
  root.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card accent"><div class="label">Total patients</div><div class="value">${state.patients.length}</div><div class="hint">Active charts on file</div></div>
      <div class="stat-card"><div class="label">Today's appointments</div><div class="value">${state.appointments.filter(a=>a.date===todayStr && a.status!=='Cancelled').length}</div><div class="hint">Across both dentists</div></div>
      <div class="stat-card"><div class="label">Outstanding balance</div><div class="value">${formatMoney(pendingAmount)}</div><div class="hint">Pending + overdue invoices</div></div>
      <div class="stat-card"><div class="label">Active prescriptions</div><div class="value">${state.prescriptions.filter(r=>r.status==='Active').length}</div><div class="hint">Currently in progress</div></div>
    </div>
    <div class="dash-grid">
      <div class="panel">
        <div class="panel-header"><h3>Upcoming appointments</h3></div>
        <div class="panel-body">${apptTimeline(state.appointments.filter(a=>a.date>=todayStr && a.status!=='Cancelled').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6))}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Quick actions</h3></div>
        <div class="panel-body pad quick-actions">
          <button class="btn btn-primary" id="qa-newpatient">${ICONS.plus} Register new patient</button>
          <button class="btn btn-outline" id="qa-newappt">${ICONS.cal_plus} Schedule appointment</button>
          <button class="btn btn-outline" id="qa-invoice">${ICONS.cash} Record a payment</button>
        </div>
      </div>
    </div>`;
  document.getElementById('qa-newpatient').addEventListener('click', ()=> openPatientForm('add'));
  document.getElementById('qa-newappt').addEventListener('click', ()=> openAppointmentForm('add'));
  document.getElementById('qa-invoice').addEventListener('click', ()=> openTransactionForm('add'));
}

function apptTimeline(list, showPatientOnly){
  if(!list || !list.length) return emptyState('Nothing here yet', 'Appointments will show up in this list once scheduled.');
  return `<div style="padding:6px 20px 16px;">` + list.map(a=>`
    <div class="timeline-item">
      <div class="timeline-dot">${ICONS.clock}</div>
      <div class="timeline-body">
        <div class="t1">${escapeHtml(patientName(a.patientId))} &mdash; ${escapeHtml(a.type)}</div>
        <div class="t2">${formatDate(a.date)} \u00b7 ${a.time} \u00b7 ${escapeHtml(dentistName(a.dentistId))} \u00b7 ${statusBadge(a.status)}</div>
      </div>
    </div>`).join('') + `</div>`;
}

function emptyState(title, body){
  return `<div class="empty-state">${ICONS.info}<h4>${escapeHtml(title)}</h4><p>${escapeHtml(body)}</p></div>`;
}