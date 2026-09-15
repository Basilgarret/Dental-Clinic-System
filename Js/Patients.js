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
    openConfirm(`This will permanently remove ${p.name}'s chart, along with related history references. This cannot be undone.`, 'Delete this patient record?', ()=>{
      state.patients = state.patients.filter(x=>x.id!==p.id);
      showToast('Patient record deleted.', 'success');
      renderPatients();
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
  document.getElementById('patient-form').addEventListener('submit', (e)=>{
    e.preventDefault();
    const { valid, values } = validateFields(patientFields);
    if(!valid) return;
    if(editing){
      Object.assign(editing, values);
      showToast('Patient details updated successfully.', 'success');
    } else {
      const newP = Object.assign({ id: genId('P'), registered: todayISO() }, values);
      state.patients.push(newP);
      showToast('Patient registered successfully.', 'success');
    }
    closeModal();
    renderPatients();
  });
}

function openPatientDetail(id){
  const p = findPatient(id);
  const role = state.currentUser.role;
  const apptCount = state.appointments.filter(a=>a.patientId===id).length;
  const recCount = state.dentalRecords.filter(a=>a.patientId===id).length;
  const html = `
    <div class="modal-header"><h3>${escapeHtml(p.name)}</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div>
    <div class="modal-body">
      <div class="detail-grid">
        <div class="detail-item"><div class="label">Patient ID</div><div class="value">${p.id}</div></div>
        <div class="detail-item"><div class="label">Gender</div><div class="value">${escapeHtml(p.gender)}</div></div>
        <div class="detail-item"><div class="label">Date of Birth</div><div class="value">${formatDate(p.dob)}</div></div>
        <div class="detail-item"><div class="label">Assigned Dentist</div><div class="value">${escapeHtml(dentistName(p.dentistId))}</div></div>
        <div class="detail-item"><div class="label">Phone</div><div class="value">${escapeHtml(p.phone)}</div></div>
        <div class="detail-item"><div class="label">Email</div><div class="value">${escapeHtml(p.email)}</div></div>
        <div class="detail-item" style="grid-column:1/-1;"><div class="label">Address</div><div class="value">${escapeHtml(p.address||'\u2014')}</div></div>
        <div class="detail-item" style="grid-column:1/-1;"><div class="label">Allergies / Medical Notes</div><div class="value">${escapeHtml(p.allergies||'None recorded')}</div></div>
      </div>
      <div class="divider"></div>
      <div class="detail-grid">
        <div class="detail-item"><div class="label">Appointments on file</div><div class="value">${apptCount}</div></div>
        <div class="detail-item"><div class="label">Dental records on file</div><div class="value">${recCount}</div></div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline" data-close-modal>Close</button>
    </div>`;
  openModal(html);
  bindModalClose();
}