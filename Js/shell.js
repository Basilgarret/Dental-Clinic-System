let appShellInitialized = false;
let reportDays = 30;

const savedTheme = localStorage.getItem('wellstone-theme');
if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';

function initAppShell() {
  if (appShellInitialized) return;
  appShellInitialized = true;

  const shell = document.getElementById('app-shell');
  const searchInput = document.getElementById('global-search-input');
  const searchResults = document.getElementById('global-search-results');
  const notificationToggle = document.getElementById('notification-toggle');
  const notificationPanel = document.getElementById('notification-panel');
  const themeToggle = document.getElementById('theme-toggle');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  sidebarToggle.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 780px)').matches) {
      const isOpen = shell.classList.toggle('mobile-nav-open');
      sidebarToggle.setAttribute('aria-expanded', String(isOpen));
    } else {
      const isCollapsed = shell.classList.toggle('sidebar-collapsed');
      sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
    }
  });
  sidebarOverlay.addEventListener('click', closeMobileNavigation);
  document.getElementById('sidebar-nav').addEventListener('click', closeMobileNavigation);

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('wellstone-theme', isDark ? 'dark' : 'light');
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  });
  themeToggle.setAttribute('aria-label', savedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');

  searchInput.addEventListener('input', () => renderGlobalSearch(searchInput.value));
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeGlobalSearch();
    if (event.key === 'Enter') searchResults.querySelector('[data-search-result]')?.click();
    if (event.key === 'ArrowDown') searchResults.querySelector('[data-search-result]')?.focus();
  });
  searchResults.addEventListener('click', (event) => {
    const result = event.target.closest('[data-search-result]');
    if (!result) return;
    const { type, id } = result.dataset;
    closeGlobalSearch();
    if (type === 'patient') {
      navigateTo('patients');
      openPatientDetail(id);
    } else if (type === 'appointment') {
      navigateTo('appointments');
      const row = document.querySelector(`[data-appointment-id="${CSS.escape(id)}"]`);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row?.classList.add('search-highlight');
      window.setTimeout(() => row?.classList.remove('search-highlight'), 1800);
    } else if (type === 'dentist') {
      navigateTo('dentists');
      document.querySelector(`[data-dentist-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (type === 'record') {
      navigateTo('records');
      document.querySelector(`[data-record-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (type === 'transaction') {
      navigateTo('transactions');
      document.querySelector(`[data-transaction-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });

  notificationToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const opening = notificationPanel.classList.contains('hidden');
    notificationPanel.classList.toggle('hidden', !opening);
    notificationToggle.setAttribute('aria-expanded', String(opening));
    closeGlobalSearch();
  });
  notificationPanel.addEventListener('click', (event) => {
    const action = event.target.closest('[data-notification-view]');
    if (!action) return;
    notificationPanel.classList.add('hidden');
    notificationToggle.setAttribute('aria-expanded', 'false');
    navigateTo(action.dataset.notificationView);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.global-search')) closeGlobalSearch();
    if (!event.target.closest('.notification-wrap')) {
      notificationPanel.classList.add('hidden');
      notificationToggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput.focus();
    }
  });
}

function closeMobileNavigation() {
  const shell = document.getElementById('app-shell');
  shell.classList.remove('mobile-nav-open');
  document.getElementById('sidebar-toggle').setAttribute('aria-expanded', 'false');
}

function closeGlobalSearch() {
  document.getElementById('global-search-results').classList.add('hidden');
}

function renderGlobalSearch(rawQuery) {
  const results = document.getElementById('global-search-results');
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) {
    results.classList.add('hidden');
    results.innerHTML = '';
    return;
  }

  const role = state.currentUser?.role;
  const matches = [];
  state.patients.filter((patient) => role === 'Patient'
    ? patient.id === state.currentUser.id
    : role === 'Dentist' ? patient.dentistId === state.currentUser.id : true).forEach((patient) => {
    const haystack = `${patient.name} ${patient.id} ${patient.phone} ${patient.email}`.toLowerCase();
    if (haystack.includes(query)) matches.push({ type: 'patient', id: patient.id, title: patient.name, detail: `Patient · ${patient.id}` });
  });
  state.appointments.filter((appointment) => role === 'Patient'
    ? appointment.patientId === state.currentUser.id
    : role === 'Dentist' ? appointment.dentistId === state.currentUser.id : true).forEach((appointment) => {
    const haystack = `${patientName(appointment.patientId)} ${dentistName(appointment.dentistId)} ${appointment.type} ${appointment.date} ${appointment.status}`.toLowerCase();
    if (haystack.includes(query)) {
      matches.push({
        type: 'appointment',
        id: appointment.id,
        title: `${patientName(appointment.patientId)} · ${appointment.type}`,
        detail: `${formatDate(appointment.date)} at ${appointment.time} · ${dentistName(appointment.dentistId)}`,
      });
    }
  });
  dentists.forEach((dentist) => {
    if (`${dentist.name} ${dentist.specialty}`.toLowerCase().includes(query)) {
      matches.push({ type: 'dentist', id: dentist.id, title: dentist.name, detail: `Dentist · ${dentist.specialty}` });
    }
  });
  state.dentalRecords.filter((record) => role === 'Patient'
    ? record.patientId === state.currentUser.id
    : role === 'Dentist' ? record.dentistId === state.currentUser.id : role === 'Administrator').forEach((record) => {
    const haystack = `${patientName(record.patientId)} ${record.procedure} ${record.diagnosis} ${record.tooth} ${record.date}`.toLowerCase();
    if (haystack.includes(query)) matches.push({ type: 'record', id: record.id, title: `${patientName(record.patientId)} · ${record.procedure}`, detail: `Dental record · ${formatDate(record.date)}` });
  });
  state.transactions.filter((transaction) => role === 'Patient'
    ? transaction.patientId === state.currentUser.id
    : role === 'Administrator' || role === 'Clinic Staff').forEach((transaction) => {
    const haystack = `${patientName(transaction.patientId)} ${transaction.description} ${transaction.amount} ${transaction.method} ${transaction.status} ${transaction.date}`.toLowerCase();
    if (haystack.includes(query)) matches.push({ type: 'transaction', id: transaction.id, title: `${patientName(transaction.patientId)} · ${transaction.description}`, detail: `${transaction.status} · ${formatMoney(transaction.amount)}` });
  });

  results.innerHTML = matches.length
    ? matches.slice(0, 8).map((item) => `<button type="button" role="option" data-search-result data-type="${item.type}" data-id="${escapeHtml(item.id)}"><span class="search-result-title">${escapeHtml(item.title)}</span><span class="search-result-detail">${escapeHtml(item.detail)}</span></button>`).join('')
    : '<div class="search-no-results">No matching records found.</div>';
  results.classList.remove('hidden');
}

function renderNotifications() {
  const role = state.currentUser?.role;
  const requested = state.appointments.filter((appointment) => appointment.status === 'Requested' && (
    role === 'Patient' ? appointment.patientId === state.currentUser.id
      : role === 'Dentist' ? appointment.dentistId === state.currentUser.id : true
  ));
  const unpaid = state.transactions.filter((transaction) => (transaction.status === 'Overdue' || transaction.status === 'Pending') && (
    role === 'Patient' ? transaction.patientId === state.currentUser.id
      : role === 'Administrator' || role === 'Clinic Staff'
  ));
  const count = requested.length + unpaid.length;
  const badge = document.getElementById('notification-count');
  const panel = document.getElementById('notification-panel');
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.classList.toggle('hidden', count === 0);

  const items = [];
  if (requested.length) items.push(`<button type="button" data-notification-view="appointments"><span class="notification-mark">${ICONS.appointments}</span><span><strong>${requested.length} appointment ${requested.length === 1 ? 'request' : 'requests'}</strong><small>Waiting for clinic confirmation</small></span></button>`);
  if (unpaid.length) items.push(`<button type="button" data-notification-view="transactions"><span class="notification-mark">${ICONS.transactions}</span><span><strong>${unpaid.length} outstanding ${unpaid.length === 1 ? 'payment' : 'payments'}</strong><small>Review pending and overdue balances</small></span></button>`);
  panel.innerHTML = `<div class="notification-heading"><strong>Notifications</strong><span>${count} open</span></div>${items.length ? items.join('') : '<p class="notification-empty">You are all caught up.</p>'}`;
}

function renderDentists() {
  const root = document.getElementById('view-content');
  root.innerHTML = `
    <section class="directory-heading">
      <div><span class="section-eyebrow">CARE TEAM</span><h1>Our dentists</h1><p>Specialties and scheduled visits for your clinic team.</p></div>
      <div class="directory-count"><strong>${dentists.length}</strong><span>dentists</span></div>
    </section>
    ${dentists.length ? `<div class="dentist-grid">${dentists.map((dentist) => {
      const appointments = state.appointments.filter((appointment) => appointment.dentistId === dentist.id);
      const today = appointments.filter((appointment) => appointment.date === todayISO() && appointment.status !== 'Cancelled');
      const next = appointments.filter((appointment) => appointment.date >= todayISO() && appointment.status !== 'Cancelled').sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0];
      const initialsText = dentist.name.replace(/^Dr\\.?\\s*/i, '').split(/\\s+/).slice(0, 2).map((part) => part[0]).join('');
      return `<article class="dentist-card" data-dentist-id="${escapeHtml(dentist.id)}"><div class="dentist-card-top"><div class="dentist-avatar">${escapeHtml(initialsText)}</div><span class="dentist-status ${today.length ? 'busy' : 'available'}">${today.length ? 'On schedule today' : 'No visits today'}</span></div><h2>${escapeHtml(dentist.name)}</h2><p class="dentist-specialty">${escapeHtml(dentist.specialty)}</p><div class="dentist-card-meta"><span>${appointments.length} appointments on file</span><span>${next ? `Next · ${formatDate(next.date)} at ${next.time}` : 'No upcoming visits'}</span></div><button type="button" class="btn btn-outline dentist-schedule" data-open-dentist-schedule="${escapeHtml(dentist.id)}">View appointments ${ICONS.appointments}</button></article>`;
    }).join('')}</div>` : emptyState('No dentists found', 'Dentists appear here after a dentist account has been registered.')}`;

  root.querySelectorAll('[data-open-dentist-schedule]').forEach((button) => button.addEventListener('click', () => {
    navigateTo('appointments');
    const row = document.querySelector(`[data-dentist-appointment="${CSS.escape(button.dataset.openDentistSchedule)}"]`);
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }));
}

function renderReports() {
  const root = document.getElementById('view-content');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - reportDays + 1);
  const startDate = cutoff.toISOString().slice(0, 10);
  const inRange = (value) => value >= startDate && value <= todayISO();
  const appointments = state.appointments.filter((appointment) => inRange(appointment.date));
  const transactions = state.transactions.filter((transaction) => inRange(transaction.date));
  const collected = transactions.filter((transaction) => transaction.status === 'Paid').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const outstanding = transactions.filter((transaction) => transaction.status !== 'Paid').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const serviceCounts = Object.entries(appointments.reduce((counts, appointment) => {
    counts[appointment.type] = (counts[appointment.type] || 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const dentistCounts = dentists.map((dentist) => ({
    dentist,
    count: appointments.filter((appointment) => appointment.dentistId === dentist.id).length,
  })).sort((a, b) => b.count - a.count);
  const peakServiceCount = Math.max(1, ...serviceCounts.map((item) => item[1]));

  root.innerHTML = `
    <div class="report-heading"><div><span class="section-eyebrow">CLINIC PERFORMANCE</span><h1>Reports</h1><p>Appointments and payments recorded in the selected period.</p></div><label class="report-period">Period<select id="report-period"><option value="30" ${reportDays===30?'selected':''}>Last 30 days</option><option value="90" ${reportDays===90?'selected':''}>Last 90 days</option><option value="365" ${reportDays===365?'selected':''}>Last 12 months</option></select></label></div>
    <div class="stat-grid report-stats">
      <div class="stat-card"><div class="label">Appointments</div><div class="value">${appointments.length}</div><div class="hint">${appointments.filter((appointment) => appointment.status === 'Completed').length} completed</div></div>
      <div class="stat-card"><div class="label">Collected revenue</div><div class="value">${formatMoney(collected)}</div><div class="hint">Payments marked paid</div></div>
      <div class="stat-card"><div class="label">Outstanding</div><div class="value">${formatMoney(outstanding)}</div><div class="hint">Pending and overdue</div></div>
      <div class="stat-card"><div class="label">Patients registered</div><div class="value">${state.patients.filter((patient) => inRange(patient.registered)).length}</div><div class="hint">Within this period</div></div>
    </div>
    <div class="report-grid">
      <section class="panel"><div class="panel-header"><div><h3>Appointment status</h3><p class="panel-subtitle">Distribution within the selected period</p></div></div><div class="panel-body report-status-list">${['Scheduled','Requested','Completed','Cancelled'].map((status) => { const value = appointments.filter((appointment) => appointment.status === status).length; const percent = appointments.length ? Math.round(value / appointments.length * 100) : 0; return `<div class="report-status-row"><span>${status}</span><div class="report-track"><i class="status-${status.toLowerCase()}" style="width:${percent}%"></i></div><strong>${value}</strong></div>`; }).join('') || '<p class="report-empty">No appointment data in this period.</p>'}</div></section>
      <section class="panel"><div class="panel-header"><div><h3>Most scheduled services</h3><p class="panel-subtitle">By appointment type</p></div></div><div class="panel-body report-service-list">${serviceCounts.length ? serviceCounts.map(([name, count]) => `<div class="report-service-row"><div><span>${escapeHtml(name)}</span><strong>${count}</strong></div><div class="report-track"><i style="width:${Math.round(count / peakServiceCount * 100)}%"></i></div></div>`).join('') : '<p class="report-empty">No appointments in this period.</p>'}</div></section>
      <section class="panel report-dentists"><div class="panel-header"><div><h3>Dentist appointments</h3><p class="panel-subtitle">Assigned in the selected period</p></div></div><div class="panel-body"><div class="report-dentist-list">${dentistCounts.length ? dentistCounts.map(({ dentist, count }) => `<div class="report-dentist-row"><span class="dentist-avatar">${escapeHtml(dentist.name.replace(/^Dr\\.?\\s*/i, '').split(/\\s+/).slice(0, 2).map((part) => part[0]).join(''))}</span><div><strong>${escapeHtml(dentist.name)}</strong><small>${escapeHtml(dentist.specialty)}</small></div><b>${count}</b></div>`).join('') : '<p class="report-empty">No dentist data available.</p>'}</div></div></section>
    </div>`;
  document.getElementById('report-period').addEventListener('change', (event) => {
    reportDays = Number(event.target.value);
    renderReports();
  });
}
