/* ======================================================================
   APPOINTMENTS MODULE
====================================================================== */
let apptFilter = 'All';
function renderAppointments(){
  const role = state.currentUser.role;
  const root = document.getElementById('view-content');
  let list = state.appointments.slice();
  if(role==='Dentist') list = list.filter(a=>a.dentistId===state.currentUser.id);
  if(role==='Patient') list = list.filter(a=>a.patientId===state.currentUser.id);
  if(apptFilter!=='All') list = list.filter(a=>a.status===apptFilter);
  list = list.sort((a,b)=> b.date.localeCompare(a.date) || a.time.localeCompare(b.time));

  const canManage = role==='Administrator' || role==='Clinic Staff';
  const canAdd = role!=='Dentist';
  const addLabel = role==='Patient' ? 'Request appointment' : 'Schedule appointment';

  root.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="toolbar">
          <select class="filter-select" id="appt-filter">
            ${['All','Requested','Scheduled','Completed','Cancelled'].map(s=>`<option value="${s}" ${apptFilter===s?'selected':''}>${s==='All'?'All statuses':s}</option>`).join('')}
          </select>
        </div>
        ${canAdd ? `<button class="btn btn-primary" id="add-appt-btn">${ICONS.plus} ${addLabel}</button>` : ''}
      </div>
      <div class="panel-body">
        ${list.length ? buildApptTable(list, role, canManage) : emptyState('No appointments found', 'Adjust the filter, or schedule a new appointment.')}
      </div>
    </div>`;

  document.getElementById('appt-filter').addEventListener('change', (e)=>{ apptFilter = e.target.value; renderAppointments(); });
  if(canAdd) document.getElementById('add-appt-btn').addEventListener('click', ()=> openAppointmentForm('add'));

  root.querySelectorAll('[data-confirm-appt]').forEach(el=> el.addEventListener('click', ()=> setApptStatus(el.dataset.confirmAppt, 'Scheduled', 'Appointment confirmed.')));
  root.querySelectorAll('[data-complete-appt]').forEach(el=> el.addEventListener('click', ()=> setApptStatus(el.dataset.completeAppt, 'Completed', 'Appointment marked as completed.')));
  root.querySelectorAll('[data-cancel-appt]').forEach(el=> el.addEventListener('click', ()=>{
    openConfirm('The patient and clinic team will need to reschedule if care is still needed.', 'Cancel this appointment?', ()=>{
      setApptStatus(el.dataset.cancelAppt, 'Cancelled', 'Appointment cancelled.');
    });
  }));
  root.querySelectorAll('[data-edit-appt]').forEach(el=> el.addEventListener('click', ()=> openAppointmentForm('edit', el.dataset.editAppt)));
  root.querySelectorAll('[data-delete-appt]').forEach(el=> el.addEventListener('click', ()=>{
    openConfirm('This will permanently remove this appointment from the schedule.', 'Delete this appointment?', ()=>{
      state.appointments = state.appointments.filter(a=>a.id!==el.dataset.deleteAppt);
      showToast('Appointment deleted.', 'success');
      renderSidebarNav(); renderAppointments();
    });
  }));
}

function setApptStatus(id, status, msg){
  const a = state.appointments.find(x=>x.id===id);
  a.status = status;
  showToast(msg, 'success');
  renderSidebarNav();
  renderAppointments();
}

function buildApptTable(list, role, canManage){
  return `<table><thead><tr>
    <th>Patient</th><th>Dentist</th><th>Date &amp; Time</th><th>Type</th><th>Status</th><th></th>
  </tr></thead><tbody>
  ${list.map(a=>{
    const actions = [];
    if(canManage && a.status==='Requested') actions.push(`<button class="icon-btn" data-confirm-appt="${a.id}" title="Confirm">${ICONS.check}</button>`);
    if(role==='Dentist' && a.status==='Scheduled') actions.push(`<button class="icon-btn" data-complete-appt="${a.id}" title="Mark completed">${ICONS.check}</button>`);
    if((canManage) && (a.status==='Scheduled'||a.status==='Requested')) actions.push(`<button class="icon-btn" data-edit-appt="${a.id}" title="Edit">${ICONS.edit}</button>`);
    if(role==='Patient' && (a.status==='Scheduled'||a.status==='Requested')) actions.push(`<button class="icon-btn danger" data-cancel-appt="${a.id}" title="Cancel">${ICONS.close}</button>`);
    if(canManage && a.status!=='Requested') actions.push(`<button class="icon-btn danger" data-cancel-appt="${a.id}" title="Cancel">${ICONS.close}</button>`);
    if(canManage) actions.push(`<button class="icon-btn danger" data-delete-appt="${a.id}" title="Delete">${ICONS.trash}</button>`);
    return `<tr>
      <td><div class="cell-name">${escapeHtml(patientName(a.patientId))}</div></td>
      <td>${escapeHtml(dentistName(a.dentistId))}</td>
      <td>${formatDate(a.date)}<div class="cell-sub">${a.time}</div></td>
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
    {key:'type', label:'Appointment Type', type:'select', required:true, options:APPT_TYPES},
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

  document.getElementById('appt-form').addEventListener('submit', (e)=>{
    e.preventDefault();
    const activeFields = isPatientBooking ? fields.filter(f=>f.key!=='patientId') : fields;
    const { valid, values } = validateFields(activeFields);
    if(!valid) return;
    if(isPatientBooking) values.patientId = state.currentUser.id;

    // double-booking check
    const conflict = state.appointments.find(a =>
      a.dentistId===values.dentistId && a.date===values.date && a.time===values.time &&
      a.status!=='Cancelled' && (!editing || a.id!==editing.id));
    if(conflict){
      const wrap = document.getElementById('field-time');
      wrap.classList.add('error');
      wrap.querySelector('.field-error').textContent = `${dentistName(values.dentistId)} already has an appointment at this time. Please choose another slot.`;
      return;
    }

    if(editing){
      Object.assign(editing, values);
      showToast('Appointment updated successfully.', 'success');
    } else {
      const status = isPatientBooking ? 'Requested' : 'Scheduled';
      state.appointments.push(Object.assign({ id: genId('AP'), status }, values));
      showToast(isPatientBooking ? 'Appointment request submitted.' : 'Appointment scheduled successfully.', 'success');
    }
    closeModal();
    renderSidebarNav();
    renderAppointments();
  });
}