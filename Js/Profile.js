/* ======================================================================
   PROFILE (Patient)
====================================================================== */
function renderProfile(){
  const p = findPatient(state.currentUser.id);
  const root = document.getElementById('view-content');
  if(!p){ root.innerHTML = emptyState('Profile not found','Please contact the front desk.'); return; }
  root.innerHTML = `
    <div class="panel" style="max-width:640px;">
      <div class="panel-header"><h3>Personal information</h3>
        <button class="btn btn-outline btn-sm" id="edit-profile-btn">${ICONS.edit} Edit</button>
      </div>
      <div class="panel-body pad">
        <div class="detail-grid">
          <div class="detail-item"><div class="label">Full Name</div><div class="value">${escapeHtml(p.name)}</div></div>
          <div class="detail-item"><div class="label">Patient ID</div><div class="value">${p.id}</div></div>
          <div class="detail-item"><div class="label">Date of Birth</div><div class="value">${formatDate(p.dob)}</div></div>
          <div class="detail-item"><div class="label">Gender</div><div class="value">${escapeHtml(p.gender)}</div></div>
          <div class="detail-item"><div class="label">Phone</div><div class="value">${escapeHtml(p.phone)}</div></div>
          <div class="detail-item"><div class="label">Email</div><div class="value">${escapeHtml(p.email)}</div></div>
          <div class="detail-item" style="grid-column:1/-1;"><div class="label">Address</div><div class="value">${escapeHtml(p.address||'\u2014')}</div></div>
          <div class="detail-item" style="grid-column:1/-1;"><div class="label">Allergies / Medical Notes</div><div class="value">${escapeHtml(p.allergies||'None recorded')}</div></div>
          <div class="detail-item"><div class="label">Assigned Dentist</div><div class="value">${escapeHtml(dentistName(p.dentistId))}</div></div>
          <div class="detail-item"><div class="label">Patient Since</div><div class="value">${formatDate(p.registered)}</div></div>
        </div>
      </div>
    </div>`;
  document.getElementById('edit-profile-btn').addEventListener('click', ()=> openProfileEditForm(p));
}

function openProfileEditForm(p){
  const fields = [
    {key:'phone', label:'Phone Number', type:'tel', required:true, pattern:PHONE_RE, patternMsg:'Enter a valid phone number.'},
    {key:'email', label:'Email Address', type:'email', required:true, pattern:EMAIL_RE, patternMsg:'Enter a valid email address.'},
    {key:'address', label:'Address', type:'text', required:false},
    {key:'allergies', label:'Allergies / Medical Notes', type:'textarea', required:false},
  ];
  const html = `
    <div class="modal-header"><h3>Edit Contact Information</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div>
    <form id="profile-form">
      <div class="modal-body">
        ${fieldHtml(fields[0], p.phone)}
        ${fieldHtml(fields[1], p.email)}
        ${fieldHtml(fields[2], p.address)}
        ${fieldHtml(fields[3], p.allergies)}
        <div class="field-hint">Your name, date of birth and assigned dentist can only be updated by clinic staff.</div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">Save changes</button>
      </div>
    </form>`;
  openModal(html);
  bindModalClose();
  document.getElementById('profile-form').addEventListener('submit', (e)=>{
    e.preventDefault();
    const { valid, values } = validateFields(fields);
    if(!valid) return;
    Object.assign(p, values);
    showToast('Your information has been updated.', 'success');
    closeModal();
    renderProfile();
  });
}