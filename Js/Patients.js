/* ======================================================================
   PATIENTS MODULE
====================================================================== */
let patientSearch = '';
function renderPatients(){
  const role = state.currentUser.role;
  const canEdit = role==='Administrator' || role==='Clinic Staff';
  const root = document.getElementById('view-content');
  let list = state.patients.slice();
  if(role==='Dentist') list = list.filter(p=>p.dentistId===state.currentUser.id);
  if(patientSearch) list = list.filter(p => (p.name+p.phone+p.email).toLowerCase().includes(patientSearch.toLowerCase()));

  root.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="toolbar">
          <div class="search-box">${ICONS.search}<input type="text" id="patient-search" placeholder="Search patients\u2026" value="${escapeHtml(patientSearch)}"></div>
        </div>
        ${canEdit ? `<button class="btn btn-primary" id="add-patient-btn">${ICONS.plus} Register patient</button>` : ''}
      </div>
      <div class="panel-body">
        ${list.length ? buildPatientTable(list, canEdit) : emptyState('No patients found', 'Try a different search, or register a new patient.')}
      </div>
    </div>`;

  document.getElementById('patient-search').addEventListener('input', (e)=>{ patientSearch = e.target.value; renderPatients(); document.getElementById('patient-search').focus(); document.getElementById('patient-search').selectionStart = document.getElementById('patient-search').value.length; });
  if(canEdit) document.getElementById('add-patient-btn').addEventListener('click', ()=> openPatientForm('add'));

  root.querySelectorAll('[data-view-patient]').forEach(el=> el.addEventListener('click', ()=> openPatientDetail(el.dataset.viewPatient)));
  root.querySelectorAll('[data-edit-patient]').forEach(el=> el.addEventListener('click', ()=> openPatientForm('edit', el.dataset.editPatient)));
  root.querySelectorAll('[data-delete-patient]').forEach(el=> el.addEventListener('click', ()=> {
    const p = findPatient(el.dataset.deletePatient);
    openConfirm(`This will permanently remove ${p.name}'s chart, along with related history references. This cannot be undone.`, 'Delete this patient record?', async ()=>{
      try{
        await apiDelete('/patients/' + p.id);
        state.patients = state.patients.filter(x=>x.id!==p.id);
        showToast('Patient record deleted.', 'success');
        renderPatients();
      }catch(err){
        showToast(err.message, 'error');
      }
    });
  }));
}

function buildPatientTable(list, canEdit){
  return `<table><thead><tr>
    <th>Patient</th><th>Contact</th><th>Gender / DOB</th><th>Dentist</th><th>Registered</th><th></th>
  </tr></thead><tbody>
  ${list.map(p=>`
    <tr>
      <td><div class="cell-name">${escapeHtml(p.name)}</div><div class="cell-sub">${p.id}</div></td>
      <td>${escapeHtml(p.phone)}<div class="cell-sub">${escapeHtml(p.email)}</div></td>
      <td>${escapeHtml(p.gender)}<div class="cell-sub">${formatDate(p.dob)}</div></td>
      <td>${escapeHtml(dentistName(p.dentistId))}</td>
      <td>${formatDate(p.registered)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" data-view-patient="${p.id}" title="View">${ICONS.eye}</button>
        ${canEdit ? `<button class="icon-btn" data-edit-patient="${p.id}" title="Edit">${ICONS.edit}</button>` : ''}
        ${canEdit ? `<button class="icon-btn danger" data-delete-patient="${p.id}" title="Delete">${ICONS.trash}</button>` : ''}
      </div></td>
    </tr>`).join('')}
  </tbody></table>`;
}

const patientFields = [
  {key:'name', label:'Full Name', type:'text', required:true},
  {key:'dob', label:'Date of Birth', type:'date', required:true, notFuture:true},
  {key:'gender', label:'Gender', type:'select', required:true, options:['Male','Female','Other']},
  {key:'phone', label:'Phone Number', type:'tel', required:true, pattern:PHONE_RE, patternMsg:'Enter a valid phone number (7\u201315 digits).', placeholder:'0917-555-1234'},
  {key:'email', label:'Email Address', type:'email', required:true, pattern:EMAIL_RE, patternMsg:'Enter a valid email address.', placeholder:'name@example.com'},
  {key:'dentistId', label:'Assigned Dentist', type:'select', required:true, options:()=>dentists.map(d=>({value:d.id,label:d.name}))},
  {key:'address', label:'Address', type:'text', required:false},
  {key:'allergies', label:'Allergies / Medical Notes', type:'textarea', required:false, placeholder:'e.g. Penicillin allergy, on blood thinners\u2026'},
];

function openPatientForm(mode, id){
  const editing = mode==='edit' ? findPatient(id) : null;
  const html = `
    <div class="modal-header"><h3>${editing? 'Edit Patient' : 'Register New Patient'}</h3>
      <button class="modal-close" data-close-modal>${ICONS.close}</button></div>
    <form id="patient-form">
      <div class="modal-body">
        ${fieldHtml(patientFields[0], editing?editing.name:'')}
        <div class="form-row">
          ${fieldHtml(patientFields[1], editing?editing.dob:'')}
          ${fieldHtml(patientFields[2], editing?editing.gender:'')}
        </div>
        <div class="form-row">
          ${fieldHtml(patientFields[3], editing?editing.phone:'')}
          ${fieldHtml(patientFields[4], editing?editing.email:'')}
        </div>
        ${fieldHtml(patientFields[5], editing?editing.dentistId:'')}
        ${fieldHtml(patientFields[6], editing?editing.address:'')}
        ${fieldHtml(patientFields[7], editing?editing.allergies:'')}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">${editing? 'Save changes' : 'Register patient'}</button>
      </div>
    </form>`;
  openModal(html);
  bindModalClose();
  document.getElementById('patient-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const { valid, values } = validateFields(patientFields);
    if(!valid) return;
    const submitBtn = e.target.querySelector('button[type=submit]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving\u2026';
    try{
      if(editing){
        const updated = await apiPut('/patients/' + editing.id, values);
        Object.assign(editing, updated);
        showToast('Patient details updated successfully.', 'success');
      } else {
        const newP = await apiPost('/patients', values);
        state.patients.push(newP);
        showToast('Patient registered successfully.', 'success');
      }
      closeModal();
      renderPatients();
    }catch(err){
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

function openPatientDetail(id){
  const p = findPatient(id);
  const role = state.currentUser.role;
  const canViewBilling = role==='Administrator' || role==='Clinic Staff' || role==='Patient';
  const html = `
    <div class="modal-header patient-profile-header"><div><span class="section-eyebrow">PATIENT CHART · ${escapeHtml(p.id)}</span><h3>${escapeHtml(p.name)}</h3><span class="patient-contact-line">${escapeHtml(p.phone)} · ${escapeHtml(p.email)}</span></div><button class="modal-close" data-close-modal aria-label="Close patient profile">${ICONS.close}</button></div>
    <div class="patient-profile-tabs" role="tablist" aria-label="Patient chart sections">
      <button type="button" role="tab" aria-selected="true" data-profile-tab="overview">Overview</button>
      <button type="button" role="tab" aria-selected="false" data-profile-tab="history">Dental history</button>
      <button type="button" role="tab" aria-selected="false" data-profile-tab="appointments">Appointments</button>
      ${canViewBilling ? '<button type="button" role="tab" aria-selected="false" data-profile-tab="billing">Billing</button>' : ''}
    </div>
    <div class="modal-body patient-profile-body" id="patient-profile-content" role="tabpanel"></div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline" data-close-modal>Close</button>
    </div>`;
  openModal(html);
  bindModalClose();
  renderPatientProfileTab(id, 'overview');
  document.querySelectorAll('[data-profile-tab]').forEach(tab=>tab.addEventListener('click', ()=>{
    document.querySelectorAll('[data-profile-tab]').forEach(item=>item.setAttribute('aria-selected',String(item===tab)));
    renderPatientProfileTab(id, tab.dataset.profileTab);
  }));
}

function renderPatientProfileTab(id, tab){
  const p = findPatient(id);
  const root = document.getElementById('patient-profile-content');
  const appointments = state.appointments.filter(item=>item.patientId===id).sort((a,b)=>b.date.localeCompare(a.date));
  const records = state.dentalRecords.filter(item=>item.patientId===id).sort((a,b)=>b.date.localeCompare(a.date));
  const transactions = state.transactions.filter(item=>item.patientId===id).sort((a,b)=>b.date.localeCompare(a.date));
  const latestVisit = records[0] || appointments.find(item=>item.status==='Completed');

  if(tab==='overview'){
    const nextAppointment = appointments.find(item=>item.date>=todayISO() && item.status!=='Cancelled' && item.status!=='Completed');
    root.innerHTML = `
      <div class="profile-stat-row"><div><span>Last visit</span><strong>${latestVisit ? formatDate(latestVisit.date) : 'No visits recorded'}</strong></div><div><span>Upcoming visit</span><strong>${nextAppointment ? formatDate(nextAppointment.date) : 'None scheduled'}</strong></div><div><span>Assigned dentist</span><strong>${escapeHtml(dentistName(p.dentistId))}</strong></div></div>
      <div class="detail-grid">
        <div class="detail-item"><div class="label">Gender</div><div class="value">${escapeHtml(p.gender)}</div></div>
        <div class="detail-item"><div class="label">Date of birth</div><div class="value">${formatDate(p.dob)}</div></div>
        <div class="detail-item"><div class="label">Phone</div><div class="value">${escapeHtml(p.phone)}</div></div>
        <div class="detail-item"><div class="label">Email</div><div class="value">${escapeHtml(p.email)}</div></div>
        <div class="detail-item profile-full-row"><div class="label">Address</div><div class="value">${escapeHtml(p.address||'\u2014')}</div></div>
        <div class="detail-item profile-full-row"><div class="label">Allergies / medical notes</div><div class="value">${escapeHtml(p.allergies||'None recorded')}</div></div>
      </div>`;
  }else if(tab==='history'){
    root.innerHTML = records.length ? `<div class="profile-timeline">${records.map(record=>`<article class="profile-timeline-item"><time>${formatDate(record.date)}</time><div class="profile-timeline-mark">${ICONS.records}</div><div><strong>${escapeHtml(record.procedure)}</strong><span>${escapeHtml(record.diagnosis||'No diagnosis recorded')}</span><small>${escapeHtml(dentistName(record.dentistId))} · ${escapeHtml(record.tooth||'No tooth specified')}</small>${record.notes?`<p>${escapeHtml(record.notes)}</p>`:''}</div></article>`).join('')}</div>` : emptyState('No dental history yet', 'Clinical records will appear here after a visit is documented.');
  }else if(tab==='appointments'){
    root.innerHTML = appointments.length ? `<div class="profile-appointment-list">${appointments.map(item=>`<div class="profile-list-row"><div><strong>${escapeHtml(item.type)}</strong><span>${formatDate(item.date)} · ${escapeHtml(item.time)} · ${escapeHtml(dentistName(item.dentistId))}</span></div>${statusBadge(item.status)}</div>`).join('')}</div>` : emptyState('No appointments yet', 'Scheduled and completed visits will appear here.');
  }else{
    root.innerHTML = transactions.length ? `<div class="profile-appointment-list">${transactions.map(item=>`<div class="profile-list-row"><div><strong>${escapeHtml(item.description)}</strong><span>${formatDate(item.date)} · ${escapeHtml(item.method)}</span></div><div class="profile-billing-total"><strong>${formatMoney(item.amount)}</strong>${statusBadge(item.status)}</div></div>`).join('')}</div>` : emptyState('No billing records yet', 'Transactions for this patient will appear here.');
  }
}
