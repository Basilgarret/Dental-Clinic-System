/* ======================================================================
   DENTAL RECORDS MODULE
====================================================================== */
function renderRecords(){
  const role = state.currentUser.role;
  const canEdit = role==='Administrator' || role==='Dentist';
  const root = document.getElementById('view-content');
  let list = state.dentalRecords.slice();
  if(role==='Dentist') list = list.filter(r=>r.dentistId===state.currentUser.id);
  if(role==='Patient') list = list.filter(r=>r.patientId===state.currentUser.id);
  list = list.sort((a,b)=> b.date.localeCompare(a.date));

  root.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3>${role==='Patient' ? 'Your treatment history' : 'All dental records'}</h3>
        ${canEdit ? `<button class="btn btn-primary" id="add-record-btn">${ICONS.plus} Add record</button>` : ''}
      </div>
      <div class="panel-body">
        ${list.length ? buildRecordTable(list, role, canEdit) : emptyState('No dental records yet', 'Treatment history will appear here once recorded by a dentist.')}
      </div>
    </div>`;

  if(canEdit) document.getElementById('add-record-btn').addEventListener('click', ()=> openRecordForm('add'));
  root.querySelectorAll('[data-view-record]').forEach(el=> el.addEventListener('click', ()=> openRecordDetail(el.dataset.viewRecord)));
  root.querySelectorAll('[data-edit-record]').forEach(el=> el.addEventListener('click', ()=> openRecordForm('edit', el.dataset.editRecord)));
  root.querySelectorAll('[data-delete-record]').forEach(el=> el.addEventListener('click', ()=>{
    openConfirm('This will permanently remove this entry from the patient\'s treatment history.', 'Delete this dental record?', ()=>{
      state.dentalRecords = state.dentalRecords.filter(r=>r.id!==el.dataset.deleteRecord);
      showToast('Dental record deleted.', 'success');
      renderRecords();
    });
  }));
}

function buildRecordTable(list, role, canEdit){
  return `<table><thead><tr>
    ${role!=='Patient' ? '<th>Patient</th>' : ''}<th>Date</th><th>Procedure</th><th>Tooth</th><th>Dentist</th><th></th>
  </tr></thead><tbody>
  ${list.map(r=>`
    <tr>
      ${role!=='Patient' ? `<td><div class="cell-name">${escapeHtml(patientName(r.patientId))}</div></td>` : ''}
      <td>${formatDate(r.date)}</td>
      <td>${escapeHtml(r.procedure)}</td>
      <td>${escapeHtml(r.tooth)}</td>
      <td>${escapeHtml(dentistName(r.dentistId))}</td>
      <td><div class="row-actions">
        <button class="icon-btn" data-view-record="${r.id}" title="View">${ICONS.eye}</button>
        ${canEdit ? `<button class="icon-btn" data-edit-record="${r.id}" title="Edit">${ICONS.edit}</button>` : ''}
        ${canEdit ? `<button class="icon-btn danger" data-delete-record="${r.id}" title="Delete">${ICONS.trash}</button>` : ''}
      </div></td>
    </tr>`).join('')}
  </tbody></table>`;
}

const recordFields = [
  {key:'patientId', label:'Patient', type:'select', required:true, options:()=>state.patients.map(p=>({value:p.id,label:p.name}))},
  {key:'date', label:'Date of Visit', type:'date', required:true, notFuture:true},
  {key:'tooth', label:'Tooth / Area', type:'text', required:true, placeholder:'e.g. #14, Full mouth'},
  {key:'procedure', label:'Procedure', type:'text', required:true, placeholder:'e.g. Composite Filling'},
  {key:'diagnosis', label:'Diagnosis', type:'textarea', required:true, placeholder:'Clinical findings'},
  {key:'notes', label:'Additional Notes', type:'textarea', required:false},
];

function openRecordForm(mode, id){
  const editing = mode==='edit' ? state.dentalRecords.find(r=>r.id===id) : null;
  const vals = editing || { patientId:'', date:'', tooth:'', procedure:'', diagnosis:'', notes:'' };
  const html = `
    <div class="modal-header"><h3>${editing?'Edit Dental Record':'Add Dental Record'}</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div>
    <form id="record-form">
      <div class="modal-body">
        ${fieldHtml(recordFields[0], vals.patientId)}
        <div class="form-row">
          ${fieldHtml(recordFields[1], vals.date)}
          ${fieldHtml(recordFields[2], vals.tooth)}
        </div>
        ${fieldHtml(recordFields[3], vals.procedure)}
        ${fieldHtml(recordFields[4], vals.diagnosis)}
        ${fieldHtml(recordFields[5], vals.notes)}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">${editing?'Save changes':'Save record'}</button>
      </div>
    </form>`;
  openModal(html);
  bindModalClose();
  document.getElementById('record-form').addEventListener('submit', (e)=>{
    e.preventDefault();
    const { valid, values } = validateFields(recordFields);
    if(!valid) return;
    if(editing){
      Object.assign(editing, values);
      showToast('Dental record updated.', 'success');
    } else {
      const dentistId = state.currentUser.role==='Dentist' ? state.currentUser.id : (dentists[0].id);
      state.dentalRecords.push(Object.assign({ id: genId('R'), dentistId }, values));
      showToast('Dental record saved.', 'success');
    }
    closeModal();
    renderRecords();
  });
}

function openRecordDetail(id){
  const r = state.dentalRecords.find(x=>x.id===id);
  const html = `
    <div class="modal-header"><h3>Dental Record</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div>
    <div class="modal-body">
      <div class="detail-grid">
        <div class="detail-item"><div class="label">Patient</div><div class="value">${escapeHtml(patientName(r.patientId))}</div></div>
        <div class="detail-item"><div class="label">Date</div><div class="value">${formatDate(r.date)}</div></div>
        <div class="detail-item"><div class="label">Dentist</div><div class="value">${escapeHtml(dentistName(r.dentistId))}</div></div>
        <div class="detail-item"><div class="label">Tooth / Area</div><div class="value">${escapeHtml(r.tooth)}</div></div>
        <div class="detail-item" style="grid-column:1/-1;"><div class="label">Procedure</div><div class="value">${escapeHtml(r.procedure)}</div></div>
        <div class="detail-item" style="grid-column:1/-1;"><div class="label">Diagnosis</div><div class="value">${escapeHtml(r.diagnosis)}</div></div>
        <div class="detail-item" style="grid-column:1/-1;"><div class="label">Notes</div><div class="value">${escapeHtml(r.notes||'\u2014')}</div></div>
      </div>
    </div>
    <div class="modal-footer"><button type="button" class="btn btn-outline" data-close-modal>Close</button></div>`;
  openModal(html);
  bindModalClose();
}