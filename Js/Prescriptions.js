/* ======================================================================
   PRESCRIPTIONS MODULE
====================================================================== */
function renderPrescriptions(){
  const role = state.currentUser.role;
  const canEdit = role==='Administrator' || role==='Dentist';
  const root = document.getElementById('view-content');
  let list = state.prescriptions.slice();
  if(role==='Dentist') list = list.filter(r=>r.dentistId===state.currentUser.id);
  if(role==='Patient') list = list.filter(r=>r.patientId===state.currentUser.id);
  list = list.sort((a,b)=> b.date.localeCompare(a.date));

  root.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3>${role==='Patient' ? 'Your prescriptions' : 'All prescriptions'}</h3>
        ${canEdit ? `<button class="btn btn-primary" id="add-rx-btn">${ICONS.plus} Write prescription</button>` : ''}
      </div>
      <div class="panel-body">
        ${list.length ? buildRxTable(list, role, canEdit) : emptyState('No prescriptions yet', 'Prescriptions written by dentists will appear here.')}
      </div>
    </div>`;

  if(canEdit) document.getElementById('add-rx-btn').addEventListener('click', ()=> openPrescriptionForm('add'));
  root.querySelectorAll('[data-view-rx]').forEach(el=> el.addEventListener('click', ()=> openRxDetail(el.dataset.viewRx)));
  root.querySelectorAll('[data-edit-rx]').forEach(el=> el.addEventListener('click', ()=> openPrescriptionForm('edit', el.dataset.editRx)));
  root.querySelectorAll('[data-delete-rx]').forEach(el=> el.addEventListener('click', ()=>{
    openConfirm('This will permanently remove this prescription from the patient\'s record.', 'Delete this prescription?', async ()=>{
      try{
        await apiDelete('/prescriptions/' + el.dataset.deleteRx);
        state.prescriptions = state.prescriptions.filter(r=>r.id!==el.dataset.deleteRx);
        showToast('Prescription deleted.', 'success');
        renderPrescriptions();
      }catch(err){
        showToast(err.message, 'error');
      }
    });
  }));
}

function buildRxTable(list, role, canEdit){
  return `<table><thead><tr>
    ${role!=='Patient' ? '<th>Patient</th>' : ''}<th>Date</th><th>Medications</th><th>Dentist</th><th>Status</th><th></th>
  </tr></thead><tbody>
  ${list.map(r=>`
    <tr>
      ${role!=='Patient' ? `<td><div class="cell-name">${escapeHtml(patientName(r.patientId))}</div></td>` : ''}
      <td>${formatDate(r.date)}</td>
      <td>${escapeHtml(r.meds.map(m=>m.name).join(', '))}</td>
      <td>${escapeHtml(dentistName(r.dentistId))}</td>
      <td>${statusBadge(r.status)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" data-view-rx="${r.id}" title="View">${ICONS.eye}</button>
        ${canEdit ? `<button class="icon-btn" data-edit-rx="${r.id}" title="Edit">${ICONS.edit}</button>` : ''}
        ${canEdit ? `<button class="icon-btn danger" data-delete-rx="${r.id}" title="Delete">${ICONS.trash}</button>` : ''}
      </div></td>
    </tr>`).join('')}
  </tbody></table>`;
}

let rxMedRows = [];
function openPrescriptionForm(mode, id){
  const editing = mode==='edit' ? state.prescriptions.find(r=>r.id===id) : null;
  const currentUserIsDentist = state.currentUser.role === 'Dentist';
  rxMedRows = editing ? editing.meds.map(m=>Object.assign({}, m)) : [{name:'',dosage:'',frequency:'',duration:''}];
  const vals = editing || { patientId:'', dentistId: currentUserIsDentist ? state.currentUser.id : '', date: todayISO(), notes:'' };

  function medRowsHtml(){
    return rxMedRows.map((m,i)=>`
      <div class="med-row" data-idx="${i}">
        <input type="text" placeholder="Medication name" data-med="name" value="${escapeHtml(m.name)}">
        <input type="text" placeholder="Dosage" data-med="dosage" value="${escapeHtml(m.dosage)}">
        <input type="text" placeholder="Frequency" data-med="frequency" value="${escapeHtml(m.frequency)}">
        <input type="text" placeholder="Duration" data-med="duration" value="${escapeHtml(m.duration)}">
        <button type="button" class="icon-btn danger" data-remove-med="${i}" ${rxMedRows.length<=1?'disabled':''} title="Remove">${ICONS.trash}</button>
      </div>`).join('');
  }

  const html = `
    <div class="modal-header"><h3>${editing?'Edit Prescription':'Write Prescription'}</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div>
    <form id="rx-form">
      <div class="modal-body">
        <div class="form-row">
          ${fieldHtml({key:'patientId', label:'Patient', type:'select', required:true, options:()=>state.patients.map(p=>({value:p.id,label:p.name}))}, vals.patientId)}
          ${currentUserIsDentist ? '' : fieldHtml({key:'dentistId', label:'Dentist', type:'select', required:true, options:()=>dentists.map(d=>({value:d.id,label:d.name}))}, vals.dentistId)}
        </div>
        ${fieldHtml({key:'date', label:'Date', type:'date', required:true, notFuture:true}, vals.date)}
        <div class="field">
          <label>Medications <span class="req">*</span></label>
          <div id="med-rows">${medRowsHtml()}</div>
          <button type="button" class="btn btn-outline btn-sm add-med-btn" id="add-med-row">${ICONS.plus} Add medication</button>
          <div class="field-error" id="med-error">Add at least one medication with a name and dosage.</div>
        </div>
        ${fieldHtml({key:'notes', label:'Instructions / Notes', type:'textarea', required:false, placeholder:'e.g. Take with food'}, vals.notes)}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">${editing?'Save changes':'Save prescription'}</button>
      </div>
    </form>`;
  openModal(html);
  bindModalClose();

  function rebindMedRows(){
    document.getElementById('med-rows').innerHTML = medRowsHtml();
    document.querySelectorAll('[data-remove-med]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        rxMedRows.splice(Number(btn.dataset.removeMed),1);
        rebindMedRows();
      });
    });
    document.querySelectorAll('#med-rows input').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        const row = inp.closest('.med-row');
        rxMedRows[Number(row.dataset.idx)][inp.dataset.med] = inp.value;
      });
    });
  }
  rebindMedRows();
  document.getElementById('add-med-row').addEventListener('click', ()=>{
    rxMedRows.push({name:'',dosage:'',frequency:'',duration:''});
    rebindMedRows();
  });

  const formFields = [
    {key:'patientId', label:'Patient', required:true},
    {key:'dentistId', label:'Dentist', required: !currentUserIsDentist},
    {key:'date', label:'Date', required:true},
    {key:'notes', label:'Notes', required:false},
  ];

  document.getElementById('rx-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const activeFields = currentUserIsDentist ? formFields.filter(f=>f.key!=='dentistId') : formFields;
    const { valid, values } = validateFields(activeFields);
    if(currentUserIsDentist) values.dentistId = state.currentUser.id;
    const validMeds = rxMedRows.filter(m=>m.name.trim() && m.dosage.trim());
    const medErrEl = document.getElementById('med-error');
    let medsOk = true;
    if(!validMeds.length){ medErrEl.style.display='block'; medsOk = false; } else { medErrEl.style.display='none'; }
    if(!valid || !medsOk) return;

    const submitBtn = e.target.querySelector('button[type=submit]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving\u2026';

    try{
      const payload = Object.assign({ meds: validMeds, status: editing ? editing.status : 'Active' }, values);
      if(editing){
        const updated = await apiPut('/prescriptions/' + editing.id, payload);
        Object.assign(editing, updated);
        showToast('Prescription updated.', 'success');
      } else {
        const newRx = await apiPost('/prescriptions', payload);
        state.prescriptions.push(newRx);
        showToast('Prescription saved.', 'success');
      }
      closeModal();
      renderPrescriptions();
    }catch(err){
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

function openRxDetail(id){
  const r = state.prescriptions.find(x=>x.id===id);
  const html = `
    <div class="modal-header"><h3>Prescription</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div>
    <div class="modal-body">
      <div class="detail-grid">
        <div class="detail-item"><div class="label">Patient</div><div class="value">${escapeHtml(patientName(r.patientId))}</div></div>
        <div class="detail-item"><div class="label">Date</div><div class="value">${formatDate(r.date)}</div></div>
        <div class="detail-item"><div class="label">Dentist</div><div class="value">${escapeHtml(dentistName(r.dentistId))}</div></div>
        <div class="detail-item"><div class="label">Medication course status</div><div class="value">${statusBadge(r.status)}</div></div>
      </div>
      <div class="divider"></div>
      <table><thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
      <tbody>${r.meds.map(m=>`<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.dosage)}</td><td>${escapeHtml(m.frequency)}</td><td>${escapeHtml(m.duration)}</td></tr>`).join('')}</tbody></table>
      ${r.notes ? `<div class="divider"></div><div class="detail-item"><div class="label">Instructions</div><div class="value">${escapeHtml(r.notes)}</div></div>` : ''}
    </div>
    <div class="modal-footer"><button type="button" class="btn btn-outline" data-close-modal>Close</button></div>`;
  openModal(html);
  bindModalClose();
}
