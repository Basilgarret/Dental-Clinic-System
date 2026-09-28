/* ======================================================================
   APPOINTMENTS MODULE
====================================================================== */
let apptFilter = 'All';
let apptViewMode = 'list';
let apptFocusDate = todayISO();
let apptDentistFilter = 'All';
let apptTypeFilter = 'All';
function renderAppointments(){
  const role = state.currentUser.role;
  const root = document.getElementById('view-content');
  let list = state.appointments.slice();
  if(role==='Dentist') list = list.filter(a=>a.dentistId===state.currentUser.id);
  if(role==='Patient') list = list.filter(a=>a.patientId===state.currentUser.id);
  if(apptFilter!=='All') list = list.filter(a=>a.status===apptFilter);
  if(apptDentistFilter!=='All') list = list.filter(a=>a.dentistId===apptDentistFilter);
  if(apptTypeFilter!=='All') list = list.filter(a=>a.type===apptTypeFilter);
  if(apptViewMode==='day') list = list.filter(a=>a.date===apptFocusDate);
  if(apptViewMode==='week'){
    const [weekStart, weekEnd] = appointmentWeekRange(apptFocusDate);
    list = list.filter(a=>a.date>=weekStart && a.date<=weekEnd);
  }
  list = list.sort((a,b)=> a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const canManage = role==='Administrator' || role==='Clinic Staff' || role==='Clinic Owner';
  const canAdd = role!=='Dentist';
  const addLabel = role==='Patient' ? 'Find a clinic' : 'Schedule appointment';

  root.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="toolbar">
          <select class="filter-select" id="appt-filter">
            ${['All','Requested','Reschedule Requested','Scheduled','Completed','Rejected','Cancelled'].map(s=>`<option value="${s}" ${apptFilter===s?'selected':''}>${s==='All'?'All statuses':s}</option>`).join('')}
          </select>
          ${role==='Administrator'||role==='Clinic Staff' ? `<select class="filter-select" id="appt-dentist-filter"><option value="All">All dentists</option>${dentists.map(d=>`<option value="${escapeHtml(d.id)}" ${apptDentistFilter===d.id?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}</select>` : ''}
          <select class="filter-select" id="appt-type-filter"><option value="All">All services</option>${APPT_TYPES.map(type=>`<option value="${escapeHtml(type)}" ${apptTypeFilter===type?'selected':''}>${escapeHtml(type)}</option>`).join('')}</select>
          <div class="segmented-control" role="group" aria-label="Appointment view">${[['list','List'],['day','Day'],['week','Week']].map(([mode,label])=>`<button type="button" data-appt-view="${mode}" aria-pressed="${apptViewMode===mode}">${label}</button>`).join('')}</div>
          ${apptViewMode!=='list' ? `<label class="appointment-date-label"><span>${apptViewMode==='day'?'Day':'Week of'}</span><input type="date" id="appt-focus-date" value="${apptFocusDate}" aria-label="Choose appointment date"></label>` : ''}
        </div>
        ${canAdd ? `<button class="btn btn-primary" id="add-appt-btn">${ICONS.plus} ${addLabel}</button>` : ''}
      </div>
      <div class="panel-body">
        ${list.length ? buildApptTable(list, role, canManage) : emptyState('No appointments found', 'Adjust the filter, or schedule a new appointment.')}
      </div>
    </div>`;

  document.getElementById('appt-filter').addEventListener('change', (e)=>{ apptFilter = e.target.value; renderAppointments(); });
  document.getElementById('appt-type-filter').addEventListener('change', (e)=>{ apptTypeFilter = e.target.value; renderAppointments(); });
  document.getElementById('appt-dentist-filter')?.addEventListener('change', (e)=>{ apptDentistFilter = e.target.value; renderAppointments(); });
  document.querySelectorAll('[data-appt-view]').forEach(button=>button.addEventListener('click', ()=>{ apptViewMode = button.dataset.apptView; renderAppointments(); }));
  document.getElementById('appt-focus-date')?.addEventListener('change', (e)=>{ apptFocusDate = e.target.value || todayISO(); renderAppointments(); });
  if(canAdd) document.getElementById('add-appt-btn').addEventListener('click', ()=> role==='Patient' ? navigateTo('clinics') : openAppointmentForm('add'));

  root.querySelectorAll('[data-confirm-appt]').forEach(el=> el.addEventListener('click', ()=> setApptStatus(el.dataset.confirmAppt, 'Scheduled', 'Appointment confirmed.')));
  root.querySelectorAll('[data-reject-appt]').forEach(el=> el.addEventListener('click', ()=> openRejectAppointment(el.dataset.rejectAppt)));
  root.querySelectorAll('[data-complete-appt]').forEach(el=> el.addEventListener('click', ()=> setApptStatus(el.dataset.completeAppt, 'Completed', 'Appointment marked as completed.')));
  root.querySelectorAll('[data-reschedule-appt]').forEach(el=> el.addEventListener('click', ()=> openRescheduleForm(el.dataset.rescheduleAppt)));
  root.querySelectorAll('[data-cancel-appt]').forEach(el=> el.addEventListener('click', ()=>{
    openConfirm('The patient and clinic team will need to reschedule if care is still needed.', 'Cancel this appointment?', ()=>{
      setApptStatus(el.dataset.cancelAppt, 'Cancelled', 'Appointment cancelled.');
    });
  }));
  root.querySelectorAll('[data-edit-appt]').forEach(el=> el.addEventListener('click', ()=> openAppointmentForm('edit', el.dataset.editAppt)));
  root.querySelectorAll('[data-delete-appt]').forEach(el=> el.addEventListener('click', ()=>{
    openConfirm('This will permanently remove this appointment from the schedule.', 'Delete this appointment?', async ()=>{
      try{
        await apiDelete('/appointments/' + el.dataset.deleteAppt);
        state.appointments = state.appointments.filter(a=>a.id!==el.dataset.deleteAppt);
        showToast('Appointment deleted.', 'success');
        renderSidebarNav(); renderAppointments();
      }catch(err){
        showToast(err.message, 'error');
      }
    });
  }));
}

function appointmentWeekRange(value){
  const [year, month, day] = value.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const toISO = date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  return [toISO(start), toISO(end)];
}

async function setApptStatus(id, status, msg){
  try{
    const updated = await apiPatch('/appointments/' + id + '/status', { status });
    const a = state.appointments.find(x=>x.id===id);
    Object.assign(a, updated);
    showToast(msg, 'success');
    renderSidebarNav();
    renderAppointments();
  }catch(err){
    showToast(err.message, 'error');
  }
}

async function openRejectAppointment(id){
  const reason=await promptForReason('Reject appointment','Explain why the clinic cannot accept this visit.');
  if(reason===null)return;
  try{
    const updated=await apiPatch(`/appointments/${id}/status`,{status:'Rejected',reason});
    const appointment=state.appointments.find(item=>String(item.id)===String(id));
    if(appointment)Object.assign(appointment,updated);
    state.notifications=await apiGet('/notifications');
    renderSidebarNav();renderNotifications();renderAppointments();
    showToast('Appointment rejected with a reason.','success');
  }catch(error){showToast(error.message,'error');}
}

function openRescheduleForm(id){
  const appointment=state.appointments.find(item=>String(item.id)===String(id));
  if(!appointment)return;
  const fields=[
    {key:'date',label:'New date',type:'date',required:true,notPast:true},
    {key:'time',label:'New time',type:'select',required:true,options:TIME_SLOTS},
    {key:'reason',label:'Reason for rescheduling',type:'textarea',required:true},
  ];
  openModal(`<div class="modal-header"><h3>Request a new appointment time</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div><form id="reschedule-form"><div class="modal-body">${fieldHtml(fields[0],'')}${fieldHtml(fields[1],'')}${fieldHtml(fields[2],'')}<p class="field-hint">Your current appointment remains until the clinic approves this request.</p></div><div class="modal-footer"><button type="button" class="btn btn-outline" data-close-modal>Cancel</button><button type="submit" class="btn btn-primary">Send request</button></div></form>`);
  bindModalClose();
  document.getElementById('reschedule-form').addEventListener('submit',async event=>{
    event.preventDefault();const {valid,values}=validateFields(fields);if(!valid)return;
    const button=event.target.querySelector('[type="submit"]');button.disabled=true;
    try{
      const updated=await apiPost(`/appointments/${id}/reschedule`,values);
      Object.assign(appointment,updated);
      state.notifications=await apiGet('/notifications');
      closeModal();renderSidebarNav();renderNotifications();renderAppointments();
      showToast('Reschedule request sent to the clinic.','success');
    }catch(error){button.disabled=false;showToast(error.message,'error');}
  });
}

function buildApptTable(list, role, canManage){
  return `<table><thead><tr>
    <th>Patient</th><th>Dentist</th><th>Date &amp; Time</th><th>Type</th><th>Status</th><th></th>
  </tr></thead><tbody>
  ${list.map(a=>{
    const actions = [];
    if(canManage && (a.status==='Requested'||a.status==='Reschedule Requested')) actions.push(`<button class="icon-btn" data-confirm-appt="${a.id}" title="${a.status==='Requested'?'Confirm appointment':'Approve new time'}">${ICONS.check}</button>`);
    if(canManage && (a.status==='Requested'||a.status==='Reschedule Requested')) actions.push(`<button class="btn btn-outline btn-sm" data-reject-appt="${a.id}">Reject</button>`);
    if(role==='Dentist' && a.status==='Scheduled') actions.push(`<button class="icon-btn" data-complete-appt="${a.id}" title="Mark completed">${ICONS.check}</button>`);
    if((canManage) && (a.status==='Scheduled'||a.status==='Requested')) actions.push(`<button class="icon-btn" data-edit-appt="${a.id}" title="Edit">${ICONS.edit}</button>`);
    if(role==='Patient' && (a.status==='Scheduled'||a.status==='Requested')) actions.push(`<button class="btn btn-outline btn-sm" data-reschedule-appt="${a.id}">Reschedule</button><button class="icon-btn danger" data-cancel-appt="${a.id}" title="Cancel">${ICONS.close}</button>`);
    if(canManage && (a.status==='Scheduled'||a.status==='Requested'||a.status==='Reschedule Requested')) actions.push(`<button class="icon-btn danger" data-cancel-appt="${a.id}" title="Cancel">${ICONS.close}</button>`);
    if(canManage) actions.push(`<button class="icon-btn danger" data-delete-appt="${a.id}" title="Delete">${ICONS.trash}</button>`);
    return `<tr data-appointment-id="${a.id}" data-dentist-appointment="${a.dentistId}">
      <td><div class="cell-name">${escapeHtml(patientName(a.patientId))}</div></td>
      <td>${escapeHtml(dentistName(a.dentistId))}</td>
      <td>${formatDate(a.date)}<div class="cell-sub">${a.time}</div>${a.status==='Reschedule Requested'?`<div class="cell-sub">Requested: ${formatDate(a.rescheduleDate)} · ${escapeHtml(a.rescheduleTime)}</div><div class="cell-sub">${escapeHtml(a.rescheduleReason)}</div>`:''}${a.status==='Rejected'&&a.rejectionReason?`<div class="cell-sub">Reason: ${escapeHtml(a.rejectionReason)}</div>`:''}</td>
      <td>${escapeHtml(a.type)}</td>
      <td>${statusBadge(a.status)}</td>
      <td><div class="row-actions">${actions.join('')}</div></td>
    </tr>`;
  }).join('')}
  </tbody></table>`;
}

function openAppointmentForm(mode, id){
  const role = state.currentUser.role;
  const editing = mode==='edit' ? state.appointments.find(a=>a.id===id) : null;
  const isPatientBooking = role==='Patient';

  const fields = [
    {key:'patientId', label:'Patient', type:'select', required:true, options:()=>state.patients.map(p=>({value:p.id,label:p.name}))},
    {key:'dentistId', label:'Dentist', type:'select', required:true, options:()=>dentists.map(d=>({value:d.id,label:d.name}))},
    {key:'date', label:'Date', type:'date', required:true, notPast: !editing},
    {key:'time', label:'Time', type:'select', required:true, options:TIME_SLOTS},
    {key:'type', label:'Appointment Type', type:'select', required:true, options:()=>[...new Set([...APPT_TYPES, ...state.services.filter(service=>service.active).map(service=>service.name)])]},
    {key:'notes', label:'Notes', type:'textarea', required:false, placeholder:'Reason for visit, symptoms, etc.'},
  ];

  const vals = editing || { patientId: isPatientBooking ? state.currentUser.id : '', dentistId:'', date:'', time:'', type:'', notes:'' };

  const html = `
    <div class="modal-header"><h3>${editing? 'Edit Appointment' : (isPatientBooking?'Request an Appointment':'Schedule Appointment')}</h3>
      <button class="modal-close" data-close-modal>${ICONS.close}</button></div>
    <form id="appt-form">
      <div class="modal-body">
        ${isPatientBooking ? `<div class="field"><label>Patient</label><input type="text" value="${escapeHtml(state.currentUser.name)}" disabled></div>` : fieldHtml(fields[0], vals.patientId)}
        ${fieldHtml(fields[1], vals.dentistId)}
        <div class="form-row">
          ${fieldHtml(fields[2], vals.date)}
          ${fieldHtml(fields[3], vals.time)}
        </div>
        ${fieldHtml(fields[4], vals.type)}
        ${fieldHtml(fields[5], vals.notes)}
        ${isPatientBooking && !editing ? `<div class="field-hint" style="margin-top:-6px;">Requests are confirmed by our front-desk team before they're finalized.</div>` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">${editing? 'Save changes' : (isPatientBooking?'Submit request':'Schedule appointment')}</button>
      </div>
    </form>`;
  openModal(html);
  bindModalClose();

  document.getElementById('appt-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const activeFields = isPatientBooking ? fields.filter(f=>f.key!=='patientId') : fields;
    const { valid, values } = validateFields(activeFields);
    if(!valid) return;
    if(isPatientBooking) values.patientId = state.currentUser.id;

    // Quick client-side double-booking check for instant feedback; the
    // server checks again too (source of truth, and covers race conditions).
    const conflict = state.appointments.find(a =>
      a.dentistId===values.dentistId && a.date===values.date && a.time===values.time &&
      a.status!=='Cancelled' && (!editing || a.id!==editing.id));
    if(conflict){
      const wrap = document.getElementById('field-time');
      wrap.classList.add('error');
      wrap.querySelector('.field-error').textContent = `${dentistName(values.dentistId)} already has an appointment at this time. Please choose another slot.`;
      return;
    }

    const submitBtn = e.target.querySelector('button[type=submit]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving\u2026';

    try{
      if(editing){
        const updated = await apiPut('/appointments/' + editing.id, values);
        Object.assign(editing, updated);
        showToast('Appointment updated successfully.', 'success');
      } else {
        const status = isPatientBooking ? 'Requested' : 'Scheduled';
        const newAppt = await apiPost('/appointments', Object.assign({ status }, values));
        state.appointments.push(newAppt);
        showToast(isPatientBooking ? 'Appointment request submitted.' : 'Appointment scheduled successfully.', 'success');
      }
      closeModal();
      renderSidebarNav();
      renderAppointments();
    }catch(err){
      // The server's own conflict check (409) lands here too, in case two
      // people booked the same slot at almost the same moment.
      if(/already has an appointment/i.test(err.message)){
        const wrap = document.getElementById('field-time');
        wrap.classList.add('error');
        wrap.querySelector('.field-error').textContent = err.message;
      } else {
        showToast(err.message, 'error');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}
