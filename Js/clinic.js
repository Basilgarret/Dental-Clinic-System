let clinicDirectoryFilters = { city: '', specialization: '', service: '' };

function clinicMapHtml(clinic){
  const place = clinic.latitude != null && clinic.longitude != null
    ? `${Number(clinic.latitude)},${Number(clinic.longitude)}`
    : `${clinic.name}, ${clinic.address}, ${clinic.city}, ${clinic.region || ''}`;
  const query = encodeURIComponent(place);
  const mapUrl = `${API_BASE}/maps/embed?query=${query}`;
  const largerMap = `https://www.google.com/maps/search/?api=1&query=${query}`;
  return `<iframe class="clinic-map" title="Google Map for ${escapeHtml(clinic.name)}" loading="eager" referrerpolicy="no-referrer-when-downgrade" src="${mapUrl}"></iframe><a class="map-link" href="${largerMap}" target="_blank" rel="noreferrer">Open in Google Maps</a>`;
}

function renderClinicDirectory(){
  const root=document.getElementById('view-content');
  const clinics=state.clinics||[];
  const specializations=[...new Set(clinics.flatMap(clinic=>clinic.specializations||[]))].sort();
  const services=[...new Set(clinics.flatMap(clinic=>(clinic.services||[]).map(service=>service.name)))].sort();
  const filtered=clinics.filter(clinic=>{
    const cityMatch=!clinicDirectoryFilters.city || `${clinic.city} ${clinic.region}`.toLowerCase().includes(clinicDirectoryFilters.city.toLowerCase());
    const specialtyMatch=!clinicDirectoryFilters.specialization || (clinic.specializations||[]).some(value=>value.toLowerCase()===clinicDirectoryFilters.specialization.toLowerCase());
    const serviceMatch=!clinicDirectoryFilters.service || (clinic.services||[]).some(service=>service.name.toLowerCase()===clinicDirectoryFilters.service.toLowerCase());
    return cityMatch&&specialtyMatch&&serviceMatch;
  });
  root.innerHTML=`
    <div class="directory-heading"><div><span class="section-eyebrow">APPROVED PROVIDERS</span><h1>Find a clinic</h1><p>Compare approved clinics, clinicians, and available services.</p></div><span class="directory-count"><strong>${filtered.length}</strong><span>clinics</span></span></div>
    <section class="panel clinic-search-panel"><div class="panel-header clinic-filterbar">
      <label class="clinic-search-field"><span>City or region</span><input id="clinic-city-filter" type="search" placeholder="Search location" value="${escapeHtml(clinicDirectoryFilters.city)}"></label>
      <label class="clinic-search-field"><span>Specialization</span><select id="clinic-specialty-filter"><option value="">All specializations</option>${specializations.map(value=>`<option ${clinicDirectoryFilters.specialization===value?'selected':''}>${escapeHtml(value)}</option>`).join('')}</select></label>
      <label class="clinic-search-field"><span>Service</span><select id="clinic-service-filter"><option value="">All services</option>${services.map(value=>`<option ${clinicDirectoryFilters.service===value?'selected':''}>${escapeHtml(value)}</option>`).join('')}</select></label>
    </div></section>
    <div class="clinic-directory-grid">${filtered.length?filtered.map(clinic=>`<article class="clinic-directory-card"><div class="clinic-directory-title"><div><span class="section-eyebrow">VERIFIED CLINIC</span><h2>${escapeHtml(clinic.name)}</h2></div><span class="badge badge-success">Approved</span></div><p class="clinic-location">${escapeHtml(clinic.city)}${clinic.region?`, ${escapeHtml(clinic.region)}`:''}</p><p class="clinic-address">${escapeHtml(clinic.address)}</p><div class="clinic-specialty-list">${(clinic.specializations||[]).map(value=>`<span>${escapeHtml(value)}</span>`).join('')}</div><div class="clinic-card-services">${(clinic.services||[]).slice(0,3).map(service=>`<span>${escapeHtml(service.name)} · ${formatMoney(service.price)}</span>`).join('')||'<span>Contact clinic for services</span>'}</div><div class="clinic-card-actions"><button type="button" class="btn btn-outline" data-clinic-detail="${clinic.id}">Clinic details</button><button type="button" class="btn btn-primary" data-clinic-book="${clinic.id}">Book appointment</button></div></article>`).join(''):emptyState('No clinics match these filters','Try a different city, specialization, or service.')}</div>`;

  document.getElementById('clinic-city-filter').addEventListener('input',event=>{clinicDirectoryFilters.city=event.target.value;renderClinicDirectory();document.getElementById('clinic-city-filter').focus();document.getElementById('clinic-city-filter').setSelectionRange(event.target.value.length,event.target.value.length);});
  document.getElementById('clinic-specialty-filter').addEventListener('change',event=>{clinicDirectoryFilters.specialization=event.target.value;renderClinicDirectory();});
  document.getElementById('clinic-service-filter').addEventListener('change',event=>{clinicDirectoryFilters.service=event.target.value;renderClinicDirectory();});
  root.querySelectorAll('[data-clinic-detail]').forEach(button=>button.addEventListener('click',()=>openClinicDetails(clinics.find(clinic=>String(clinic.id)===button.dataset.clinicDetail))));
  root.querySelectorAll('[data-clinic-book]').forEach(button=>button.addEventListener('click',()=>openClinicAppointmentForm(clinics.find(clinic=>String(clinic.id)===button.dataset.clinicBook))));
}

function openClinicDetails(clinic){
  if(!clinic)return;
  const html=`<div class="modal-header"><div><span class="section-eyebrow">APPROVED CLINIC</span><h3>${escapeHtml(clinic.name)}</h3></div><button class="modal-close" data-close-modal aria-label="Close clinic details">${ICONS.close}</button></div><div class="modal-body clinic-detail-body"><div class="clinic-detail-summary"><div><span>Address</span><strong>${escapeHtml(clinic.address)}, ${escapeHtml(clinic.city)}${clinic.region?`, ${escapeHtml(clinic.region)}`:''}</strong></div><div><span>Phone</span><strong>${escapeHtml(clinic.phone)}</strong></div><div><span>Email</span><strong>${escapeHtml(clinic.email)}</strong></div><div><span>Specializations</span><strong>${escapeHtml((clinic.specializations||[]).join(', '))}</strong></div></div><div class="clinic-detail-columns"><section><h4>Dentists</h4>${(clinic.dentists||[]).map(dentist=>`<div class="clinic-detail-row"><strong>${escapeHtml(dentist.name)}</strong><span>${escapeHtml(dentist.specialty)}</span></div>`).join('')||'<p>No dentists listed yet.</p>'}</section><section><h4>Services</h4>${(clinic.services||[]).map(service=>`<div class="clinic-detail-row"><strong>${escapeHtml(service.name)}</strong><span>${formatMoney(service.price)} · ${service.durationMinutes} min</span></div>`).join('')||'<p>Contact clinic for current services.</p>'}</section></div><section class="clinic-map-section"><h4>Location</h4>${clinicMapHtml(clinic)}</section></div><div class="modal-footer"><button class="btn btn-outline" data-close-modal>Close</button><button class="btn btn-primary" id="clinic-details-book">Book appointment</button></div>`;
  openModal(html);bindModalClose();document.getElementById('clinic-details-book').addEventListener('click',()=>{closeModal();openClinicAppointmentForm(clinic);});
}

function openClinicAppointmentForm(clinic){
  if(!clinic)return;
  const dentistFields={key:'dentistId',label:'Dentist',type:'select',required:true,options:(clinic.dentists||[]).map(dentist=>({value:dentist.id,label:`${dentist.name} · ${dentist.specialty}`}))};
  const serviceFields=(clinic.services||[]).length
    ? {key:'serviceId',label:'Service',type:'select',required:true,options:clinic.services.map(service=>({value:service.id,label:`${service.name} · ${formatMoney(service.price)}`}))}
    : {key:'type',label:'Appointment type',type:'select',required:true,options:APPT_TYPES};
  const fields=[dentistFields,serviceFields,{key:'date',label:'Date',type:'date',required:true,notPast:true},{key:'time',label:'Time',type:'select',required:true,options:TIME_SLOTS},{key:'notes',label:'Reason for visit',type:'textarea',required:false,placeholder:'Symptoms or booking notes'}];
  const html=`<div class="modal-header"><h3>Book at ${escapeHtml(clinic.name)}</h3><button class="modal-close" data-close-modal aria-label="Close booking">${ICONS.close}</button></div><form id="clinic-booking-form"><div class="modal-body">${fieldHtml(dentistFields,'')}${fieldHtml(serviceFields,'')}<div class="form-row">${fieldHtml(fields[2],'')}${fieldHtml(fields[3],'')}</div>${fieldHtml(fields[4],'')}<p class="field-hint">Your request will be sent to the clinic for approval.</p></div><div class="modal-footer"><button type="button" class="btn btn-outline" data-close-modal>Cancel</button><button type="submit" class="btn btn-primary">Request appointment</button></div></form>`;
  openModal(html);bindModalClose();
  document.getElementById('clinic-booking-form').addEventListener('submit',async event=>{
    event.preventDefault();const {valid,values}=validateFields(fields);if(!valid)return;
    const service=clinic.services?.find(item=>String(item.id)===String(values.serviceId));
    const payload={clinicId:clinic.id,patientId:state.currentUser.id,dentistId:values.dentistId,serviceId:service?.id||null,type:service?.name||values.type,date:values.date,time:values.time,notes:values.notes,status:'Requested'};
    const button=event.target.querySelector('[type="submit"]');button.disabled=true;
    try{const appointment=await apiPost('/appointments',payload);state.appointments.push(appointment);state.notifications=await apiGet('/notifications');closeModal();showToast('Appointment request sent to the clinic.','success');renderNotifications();}
    catch(error){button.disabled=false;showToast(error.message,'error');}
  });
}

function renderClinicProfile(){
  const root=document.getElementById('view-content');root.innerHTML='<div class="panel"><div class="panel-body pad">Loading clinic profile…</div></div>';
  apiGet('/clinics/mine').then(result=>{
    state.clinic=result;const clinic=result.clinic;
    root.innerHTML=`<div class="view-header"><div><h1>Clinic profile &amp; documents</h1><p>Complete verification before appearing in patient search.</p></div><span class="badge ${clinic.status==='Approved'?'badge-success':clinic.status==='Rejected'?'badge-danger':'badge-warning'}">${escapeHtml(clinic.status)}</span></div>${clinic.rejectionReason?`<div class="clinic-rejection-note"><strong>Review note</strong><span>${escapeHtml(clinic.rejectionReason)}</span></div>`:''}<div class="clinic-owner-grid"><section class="panel"><div class="panel-header"><h3>Business profile</h3></div><form id="clinic-profile-form"><div class="panel-body pad">${fieldHtml({key:'name',label:'Clinic name',type:'text',required:true},clinic.name)}${fieldHtml({key:'registrationNumber',label:'Registration number',type:'text',required:false},clinic.registrationNumber)}<div class="form-row">${fieldHtml({key:'phone',label:'Phone',type:'tel',required:true},clinic.phone)}${fieldHtml({key:'email',label:'Email',type:'email',required:true},clinic.email)}</div>${fieldHtml({key:'address',label:'Street address',type:'text',required:true},clinic.address)}<div class="form-row">${fieldHtml({key:'city',label:'City',type:'text',required:true},clinic.city)}${fieldHtml({key:'region',label:'Region',type:'text',required:false},clinic.region)}</div>${fieldHtml({key:'specializations',label:'Specializations',type:'text',required:true,value:undefined,placeholder:'Comma-separated specialties'},(clinic.specializations||[]).join(', '))}<div class="form-row">${fieldHtml({key:'latitude',label:'Latitude',type:'number',required:false,step:'any'},clinic.latitude||'')}${fieldHtml({key:'longitude',label:'Longitude',type:'number',required:false,step:'any'},clinic.longitude||'')}</div><button class="btn btn-primary" type="submit">Save clinic profile</button></div></form></section><section class="panel"><div class="panel-header"><h3>Verification documents</h3><span>${result.documents.length} uploaded</span></div><div class="panel-body pad"><form id="clinic-document-form"><label class="field"><span class="field-label">Document type</span><select id="document-type" required><option value="">Choose document type</option><option>Business Permit</option><option>Professional License</option><option>Government ID</option><option>Proof of Address</option></select></label><label class="field"><span class="field-label">File (PDF, JPG, PNG; max 10 MB)</span><input id="clinic-document-file" type="file" accept="application/pdf,image/jpeg,image/png" required></label><button type="submit" class="btn btn-primary">Upload document</button></form><div class="clinic-document-list">${result.documents.length?result.documents.map(document=>`<div class="clinic-document-row"><div><strong>${escapeHtml(document.document_type)}</strong><span>${escapeHtml(document.file_name)} · ${Math.ceil(document.file_size/1024)} KB</span><span class="badge ${document.status==='Approved'?'badge-success':document.status==='Rejected'?'badge-danger':'badge-warning'}">${escapeHtml(document.status)}</span>${document.rejection_reason?`<small>${escapeHtml(document.rejection_reason)}</small>`:''}</div><a class="btn btn-outline btn-sm" href="/api/clinics/mine/documents/${document.id}/download">Download</a></div>`).join(''):'<p class="clinic-muted">No documents uploaded yet.</p>'}</div></div></section></div><section class="panel clinic-map-owner"><div class="panel-header"><h3>Clinic location</h3></div><div class="panel-body pad">${clinicMapHtml(clinic)}</div></section>`;
    document.getElementById('clinic-profile-form').addEventListener('submit',async event=>{
      event.preventDefault();const fields=[{key:'name',label:'Clinic name',required:true},{key:'registrationNumber',label:'Registration number',required:false},{key:'phone',label:'Phone',required:true},{key:'email',label:'Email',required:true},{key:'address',label:'Address',required:true},{key:'city',label:'City',required:true},{key:'region',label:'Region',required:false},{key:'specializations',label:'Specializations',required:true},{key:'latitude',label:'Latitude',required:false},{key:'longitude',label:'Longitude',required:false}];
      const {valid,values}=validateFields(fields);if(!valid)return;values.specializations=values.specializations.split(',').map(value=>value.trim()).filter(Boolean);values.latitude=values.latitude===''?null:Number(values.latitude);values.longitude=values.longitude===''?null:Number(values.longitude);
      try{await apiPatch('/clinics/mine',values);showToast('Clinic profile saved.','success');renderClinicProfile();}catch(error){showToast(error.message,'error');}
    });
    document.getElementById('clinic-document-form').addEventListener('submit',async event=>{
      event.preventDefault();const file=document.getElementById('clinic-document-file').files[0];if(!file)return;const body=new FormData();body.append('documentType',document.getElementById('document-type').value);body.append('document',file);
      try{await apiPost('/clinics/mine/documents',body);showToast('Document uploaded for review.','success');renderClinicProfile();}catch(error){showToast(error.message,'error');}
    });
  }).catch(error=>{root.innerHTML=`<div class="panel"><div class="panel-body">${emptyState('Could not load clinic profile',error.message)}</div></div>`;});
}

function renderClinicTeam(){
  const root=document.getElementById('view-content');root.innerHTML='<div class="panel"><div class="panel-body pad">Loading dentists…</div></div>';
  Promise.all([apiGet('/clinics/mine/dentists'),apiGet('/clinics/mine/available-dentists')]).then(([list,available])=>{
    const dentistCard=dentist=>`<article class="dentist-card"><div class="dentist-card-top"><div class="dentist-avatar">${escapeHtml(initials(dentist.name))}</div><span class="dentist-status ${dentist.active?'available':'busy'}">${dentist.active?'Active':'Inactive'}</span></div><h2>${escapeHtml(dentist.name)}</h2><p class="dentist-specialty">${escapeHtml(dentist.specialty)}</p><div class="dentist-card-meta"><span>${escapeHtml(dentist.email||'No email')}</span><span>${escapeHtml(dentist.phone||'No phone')}</span></div><button class="btn btn-outline btn-sm" data-toggle-dentist="${dentist.id}">${dentist.active?'Deactivate':'Reactivate'}</button></article>`;
    const availableCard=dentist=>`<article class="dentist-card"><div class="dentist-card-top"><div class="dentist-avatar">${escapeHtml(initials(dentist.name))}</div><span class="dentist-status ${dentist.accountEnabled&&dentist.active?'available':'busy'}">${!dentist.accountEnabled?'Account disabled':dentist.active?'Unassigned':'Inactive'}</span></div><h2>${escapeHtml(dentist.name)}</h2><p class="dentist-specialty">${escapeHtml(dentist.specialty)}</p><div class="dentist-card-meta"><span>${escapeHtml(dentist.email||'No email')}</span><span>${escapeHtml(dentist.phone||'No phone')}</span></div>${dentist.accountEnabled&&dentist.active?`<button class="btn btn-outline btn-sm" data-assign-dentist="${dentist.id}">Add to clinic</button>`:''}</article>`;
    root.innerHTML=`<div class="view-header"><div><h1>Clinic dentists</h1><p>Manage clinicians attached to your clinic.</p></div><button class="btn btn-primary" id="add-clinic-dentist">${ICONS.plus} Add dentist</button></div><div class="view-header"><div><h2>Your clinic team</h2><p>Dentists already assigned to this clinic.</p></div></div><div class="dentist-grid">${list.length?list.map(dentistCard).join(''):emptyState('No dentists assigned yet','Add a new dentist or choose an existing dentist account below.')}</div><div class="view-header clinic-available-heading"><div><h2>Existing dentist accounts</h2><p>View unassigned dentist accounts and add an active account to your clinic.</p></div></div><div class="dentist-grid">${available.length?available.map(availableCard).join(''):emptyState('No unassigned dentist accounts','New dentist accounts that are not assigned to another clinic will appear here.')}</div>`;
    document.getElementById('add-clinic-dentist').addEventListener('click',()=>openClinicDentistForm());
    root.querySelectorAll('[data-toggle-dentist]').forEach(button=>button.addEventListener('click',async()=>{const dentist=list.find(item=>String(item.id)===button.dataset.toggleDentist);try{await apiPut(`/clinics/mine/dentists/${dentist.id}`,{active:!dentist.active});renderClinicTeam();}catch(error){showToast(error.message,'error');}}));
    root.querySelectorAll('[data-assign-dentist]').forEach(button=>button.addEventListener('click',async()=>{try{await apiPost(`/clinics/mine/dentists/${button.dataset.assignDentist}/assign`,{});showToast('Dentist added to your clinic.','success');renderClinicTeam();}catch(error){showToast(error.message,'error');}}));
  }).catch(error=>{root.innerHTML=`<div class="panel"><div class="panel-body">${emptyState('Could not load dentists',error.message)}</div></div>`;});
}

function openClinicDentistForm(){
  const fields=[{key:'name',label:'Dentist name',type:'text',required:true},{key:'specialty',label:'Specialization',type:'text',required:true},{key:'phone',label:'Phone',type:'tel',required:false},{key:'email',label:'Email',type:'email',required:false}];
  openModal(`<div class="modal-header"><h3>Add a dentist</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div><form id="clinic-dentist-form"><div class="modal-body">${fields.map(field=>fieldHtml(field,'')).join('')}</div><div class="modal-footer"><button type="button" class="btn btn-outline" data-close-modal>Cancel</button><button type="submit" class="btn btn-primary">Add dentist</button></div></form>`);bindModalClose();
  document.getElementById('clinic-dentist-form').addEventListener('submit',async event=>{event.preventDefault();const {valid,values}=validateFields(fields);if(!valid)return;try{await apiPost('/clinics/mine/dentists',values);closeModal();showToast('Dentist added to clinic.','success');renderClinicTeam();}catch(error){showToast(error.message,'error');}});
}

function renderClinicServices(){
  const root=document.getElementById('view-content');root.innerHTML='<div class="panel"><div class="panel-body pad">Loading clinic services…</div></div>';
  apiGet('/clinics/mine/services').then(list=>{
    root.innerHTML=`<div class="view-header"><div><h1>Clinic services</h1><p>Set services, prices, and appointment durations.</p></div><button class="btn btn-primary" id="add-clinic-service">${ICONS.plus} Add service</button></div><div class="panel"><div class="panel-body"><table><thead><tr><th>Service</th><th>Description</th><th>Duration</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>${list.map(service=>`<tr><td>${escapeHtml(service.name)}</td><td>${escapeHtml(service.description)}</td><td>${service.durationMinutes} min</td><td>${formatMoney(service.price)}</td><td>${statusBadge(service.active?'Active':'Completed')}</td><td><button class="btn btn-outline btn-sm" data-toggle-clinic-service="${service.id}">${service.active?'Deactivate':'Activate'}</button></td></tr>`).join('')}</tbody></table></div></div>`;
    document.getElementById('add-clinic-service').addEventListener('click',()=>openClinicServiceForm());
    root.querySelectorAll('[data-toggle-clinic-service]').forEach(button=>button.addEventListener('click',async()=>{const service=list.find(item=>String(item.id)===button.dataset.toggleClinicService);try{await apiPut(`/clinics/mine/services/${service.id}`,{active:!service.active});renderClinicServices();}catch(error){showToast(error.message,'error');}}));
  }).catch(error=>{root.innerHTML=`<div class="panel"><div class="panel-body">${emptyState('Could not load services',error.message)}</div></div>`;});
}

function openClinicServiceForm(){
  const fields=[{key:'name',label:'Service name',type:'text',required:true},{key:'description',label:'Description',type:'textarea',required:false},{key:'price',label:'Price',type:'number',required:true,min:0,step:'0.01'},{key:'durationMinutes',label:'Duration in minutes',type:'number',required:true,min:5}];
  openModal(`<div class="modal-header"><h3>Add clinic service</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div><form id="clinic-service-form"><div class="modal-body">${fields.map(field=>fieldHtml(field,'')).join('')}</div><div class="modal-footer"><button type="button" class="btn btn-outline" data-close-modal>Cancel</button><button type="submit" class="btn btn-primary">Save service</button></div></form>`);bindModalClose();
  document.getElementById('clinic-service-form').addEventListener('submit',async event=>{event.preventDefault();const {valid,values}=validateFields(fields);if(!valid)return;values.price=Number(values.price);values.durationMinutes=Number(values.durationMinutes);try{await apiPost('/clinics/mine/services',values);closeModal();showToast('Service added.','success');renderClinicServices();}catch(error){showToast(error.message,'error');}});
}

function renderClinicApprovals(){
  const root=document.getElementById('view-content');
  const status=document.getElementById('clinic-approval-filter')?.value||'Pending Review';
  root.innerHTML='<div class="panel"><div class="panel-body pad">Loading clinic applications…</div></div>';
  apiGet(`/admin/clinics?status=${encodeURIComponent(status)}`).then(async clinics=>{
    const details=await Promise.all(clinics.map(async clinic=>({clinic,documents:await apiGet(`/admin/clinics/${clinic.id}/documents`)})));
    root.innerHTML=`<div class="view-header"><div><h1>Clinic verification</h1><p>Review business profiles and submitted documents.</p></div><select id="clinic-approval-filter" class="filter-select"><option ${status==='Pending Review'?'selected':''}>Pending Review</option><option ${status==='Approved'?'selected':''}>Approved</option><option ${status==='Rejected'?'selected':''}>Rejected</option></select></div><div class="clinic-review-list">${details.length?details.map(({clinic,documents})=>`<article class="panel clinic-review-card"><div class="panel-header"><div><span class="section-eyebrow">APPLICATION #${clinic.id}</span><h3>${escapeHtml(clinic.name)}</h3><p>${escapeHtml(clinic.ownerName)} · ${escapeHtml(clinic.ownerUsername)} · ${escapeHtml(clinic.city)}</p></div><span class="badge ${clinic.status==='Approved'?'badge-success':clinic.status==='Rejected'?'badge-danger':'badge-warning'}">${escapeHtml(clinic.status)}</span></div><div class="panel-body pad"><p><strong>Registration:</strong> ${escapeHtml(clinic.registrationNumber||'Not provided')}</p><p><strong>Address:</strong> ${escapeHtml(clinic.address)}, ${escapeHtml(clinic.city)} ${escapeHtml(clinic.region)}</p><p><strong>Specializations:</strong> ${escapeHtml((clinic.specializations||[]).join(', '))}</p><div class="admin-document-list">${documents.length?documents.map(document=>`<div class="clinic-document-row"><div><strong>${escapeHtml(document.document_type)}</strong><span>${escapeHtml(document.file_name)} · ${Math.ceil(document.file_size/1024)} KB</span><span class="badge ${document.status==='Approved'?'badge-success':document.status==='Rejected'?'badge-danger':'badge-warning'}">${escapeHtml(document.status)}</span>${document.rejection_reason?`<small>${escapeHtml(document.rejection_reason)}</small>`:''}</div><div class="admin-document-actions"><a class="btn btn-outline btn-sm" href="/api/admin/clinic-documents/${document.id}/download">Open</a>${document.status==='Pending Review'?`<button class="btn btn-outline btn-sm" data-document-review="Approved" data-document-id="${document.id}">Verify</button><button class="btn btn-outline btn-sm" data-document-review="Rejected" data-document-id="${document.id}">Reject</button>`:''}</div></div>`).join(''):'<p>No documents uploaded.</p>'}</div>${clinic.rejectionReason?`<p class="clinic-rejection-note">${escapeHtml(clinic.rejectionReason)}</p>`:''}<div class="clinic-review-actions">${clinic.status!=='Approved'?`<button class="btn btn-primary" data-clinic-review="Approved" data-clinic-id="${clinic.id}">Approve clinic</button>`:''}${clinic.status!=='Rejected'?`<button class="btn btn-outline" data-clinic-review="Rejected" data-clinic-id="${clinic.id}">Reject with reason</button>`:''}</div></div></article>`).join(''):emptyState('No applications in this queue','New clinic registrations appear here.')}</div>`;
    document.getElementById('clinic-approval-filter').addEventListener('change',renderClinicApprovals);
    root.querySelectorAll('[data-document-review]').forEach(button=>button.addEventListener('click',async()=>{let reason='';if(button.dataset.documentReview==='Rejected'){reason=await promptForReason('Reject document','Explain what the clinic needs to correct.');if(reason===null)return;}try{await apiPatch(`/admin/clinic-documents/${button.dataset.documentId}/review`,{decision:button.dataset.documentReview,reason});showToast('Document review saved.','success');renderClinicApprovals();}catch(error){showToast(error.message,'error');}}));
    root.querySelectorAll('[data-clinic-review]').forEach(button=>button.addEventListener('click',async()=>{let reason='';if(button.dataset.clinicReview==='Rejected'){reason=await promptForReason('Reject clinic application','Provide a reason for rejection.');if(reason===null)return;}try{await apiPatch(`/admin/clinics/${button.dataset.clinicId}/review`,{decision:button.dataset.clinicReview,reason});showToast(`Clinic ${button.dataset.clinicReview.toLowerCase()}.`,'success');renderClinicApprovals();}catch(error){showToast(error.message,'error');}}));
  }).catch(error=>{root.innerHTML=`<div class="panel"><div class="panel-body">${emptyState('Could not load clinic applications',error.message)}</div></div>`;});
}

function promptForReason(title, hint){
  return new Promise(resolve=>{
    let settled=false;const finish=value=>{if(settled)return;settled=true;resolve(value);};
    openModal(`<div class="modal-header"><h3>${escapeHtml(title)}</h3><button class="modal-close" data-reason-cancel>${ICONS.close}</button></div><form id="reason-form"><div class="modal-body"><label class="field"><span class="field-label">Reason</span><textarea id="reason-input" required rows="4" placeholder="${escapeHtml(hint)}"></textarea></label></div><div class="modal-footer"><button type="button" class="btn btn-outline" data-reason-cancel>Cancel</button><button type="submit" class="btn btn-danger">Confirm rejection</button></div></form>`);
    document.querySelectorAll('[data-reason-cancel]').forEach(button=>button.addEventListener('click',()=>{closeModal();finish(null);}));
    document.getElementById('reason-form').addEventListener('submit',event=>{event.preventDefault();const value=document.getElementById('reason-input').value.trim();if(!value)return;closeModal();finish(value);});
  });
}

function renderAdminUsers(){
  const root=document.getElementById('view-content');root.innerHTML='<div class="panel"><div class="panel-body pad">Loading accounts…</div></div>';
  Promise.all([apiGet('/admin/users'),apiGet('/admin/clinics?status=Approved')]).then(([users,clinics])=>{
    root.innerHTML=`<div class="view-header"><div><h1>User management</h1><p>Manage clinic staff access and account status.</p></div><button class="btn btn-primary" id="admin-add-user">${ICONS.plus} Add account</button></div><div class="panel"><div class="panel-body"><table><thead><tr><th>Account</th><th>Role</th><th>Clinic</th><th>Status</th><th></th></tr></thead><tbody>${users.map(user=>`<tr><td><strong>${escapeHtml(user.name)}</strong><div class="cell-sub">${escapeHtml(user.username)}</div></td><td>${escapeHtml(user.role)}</td><td>${escapeHtml(user.clinic_name||'—')}</td><td>${user.disabled_at?'Disabled':'Active'}</td><td>${user.id===state.currentUser.id?'Current account':`<div class="row-actions"><button class="btn btn-outline btn-sm" data-toggle-user="${escapeHtml(user.id)}" data-disabled="${user.disabled_at?'true':'false'}">${user.disabled_at?'Enable':'Disable'}</button><button class="btn btn-danger btn-sm" data-delete-user="${escapeHtml(user.id)}">Delete</button></div>`}</td></tr>`).join('')}</tbody></table></div></div>`;
    document.getElementById('admin-add-user').addEventListener('click',()=>openAdminUserForm(clinics));
    root.querySelectorAll('[data-toggle-user]').forEach(button=>button.addEventListener('click',async()=>{try{await apiPatch(`/admin/users/${button.dataset.toggleUser}`,{disabled:button.dataset.disabled!=='true'});renderAdminUsers();}catch(error){showToast(error.message,'error');}}));
    root.querySelectorAll('[data-delete-user]').forEach(button=>button.addEventListener('click',()=>{
      const user=users.find(item=>String(item.id)===button.dataset.deleteUser);
      if(!user)return;
      openConfirm(`This permanently deletes ${user.name}'s login account. The last administrator and accounts with owned clinics or follow-up history are protected.`, `Delete ${user.name}'s account?`, async()=>{
        try{await apiDelete(`/admin/users/${encodeURIComponent(user.id)}`);showToast('Account deleted.','success');renderAdminUsers();}
        catch(error){showToast(error.message,'error');}
      });
    }));
  }).catch(error=>{root.innerHTML=`<div class="panel"><div class="panel-body">${emptyState('Could not load accounts',error.message)}</div></div>`;});
}

function openAdminUserForm(clinics){
  const fields=[{key:'name',label:'Full name',type:'text',required:true},{key:'username',label:'Username',type:'text',required:true},{key:'password',label:'Temporary password',type:'password',required:true,hint:'At least 10 characters.'},{key:'role',label:'Role',type:'select',required:true,options:['Clinic Staff','Dentist','Administrator']},{key:'clinicId',label:'Clinic assignment',type:'select',required:false,options:[{value:'',label:'No clinic'}].concat(clinics.map(clinic=>({value:clinic.id,label:clinic.name})))}];
  openModal(`<div class="modal-header"><h3>Create staff account</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div><form id="admin-user-form"><div class="modal-body">${fields.map(field=>fieldHtml(field,'')).join('')}</div><div class="modal-footer"><button type="button" class="btn btn-outline" data-close-modal>Cancel</button><button type="submit" class="btn btn-primary">Create account</button></div></form>`);bindModalClose();
  document.getElementById('admin-user-form').addEventListener('submit',async event=>{event.preventDefault();const {valid,values}=validateFields(fields);if(!valid)return;values.clinicId=values.clinicId||null;try{await apiPost('/admin/users',values);closeModal();showToast('Account created.','success');renderAdminUsers();}catch(error){showToast(error.message,'error');}});
}

function renderFollowUps(){
  const root=document.getElementById('view-content');
  const role=state.currentUser.role;
  const canCreate=['Administrator','Dentist','Clinic Owner'].includes(role);
  const list=(state.followUps||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  root.innerHTML=`<div class="view-header"><div><h1>Follow-ups</h1><p>Track planned care after a visit.</p></div>${canCreate?`<button class="btn btn-primary" id="add-follow-up">${ICONS.plus} Create follow-up</button>`:''}</div>${list.length?`<div class="panel"><div class="panel-body"><table><thead><tr><th>Patient</th><th>Date</th><th>Reason</th><th>Dentist</th><th>Status</th><th></th></tr></thead><tbody>${list.map(item=>`<tr><td>${escapeHtml(item.patientName||patientName(item.patientId))}</td><td>${formatDate(item.date)}</td><td>${escapeHtml(item.reason)}</td><td>${escapeHtml(item.dentistName||dentistName(item.dentistId))}</td><td>${statusBadge(item.status)}</td><td>${canCreate&&item.status==='Scheduled'?`<button class="btn btn-outline btn-sm" data-complete-follow-up="${item.id}">Complete</button>`:''}</td></tr>`).join('')}</tbody></table></div></div>`:emptyState('No follow-ups yet','Follow-up plans created by the care team will appear here.')}`;
  document.getElementById('add-follow-up')?.addEventListener('click',openFollowUpForm);
  root.querySelectorAll('[data-complete-follow-up]').forEach(button=>button.addEventListener('click',async()=>{try{const updated=await apiPatch(`/follow-ups/${button.dataset.completeFollowUp}/status`,{status:'Completed'});const item=state.followUps.find(value=>String(value.id)===String(updated.id));if(item)item.status=updated.status;renderFollowUps();}catch(error){showToast(error.message,'error');}}));
}

async function openFollowUpForm(){
  const role=state.currentUser.role;
  let followUpDentists=dentists;
  if(role==='Clinic Owner'){
    try{followUpDentists=(await apiGet('/clinics/mine/dentists')).filter(dentist=>dentist.active);}
    catch(error){showToast(error.message,'error');return;}
  }
  const dentistField={key:'dentistId',label:'Dentist',type:'select',required:true,options:role==='Dentist'?[{value:state.currentUser.id,label:state.currentUser.name}]:followUpDentists.map(dentist=>({value:dentist.id,label:dentist.name}))};
  const fields=[{key:'patientId',label:'Patient',type:'select',required:true,options:()=>state.patients.map(patient=>({value:patient.id,label:patient.name}))},dentistField,{key:'date',label:'Follow-up date',type:'date',required:true,notPast:true},{key:'reason',label:'Reason',type:'text',required:true},{key:'notes',label:'Notes for patient',type:'textarea',required:false}];
  openModal(`<div class="modal-header"><h3>Create follow-up</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div><form id="follow-up-form"><div class="modal-body">${fields.map(field=>fieldHtml(field,'')).join('')}</div><div class="modal-footer"><button type="button" class="btn btn-outline" data-close-modal>Cancel</button><button type="submit" class="btn btn-primary">Save follow-up</button></div></form>`);bindModalClose();
  document.getElementById('follow-up-form').addEventListener('submit',async event=>{event.preventDefault();const {valid,values}=validateFields(fields);if(!valid)return;try{const followUp=await apiPost('/follow-ups',values);state.followUps.push(followUp);closeModal();showToast('Follow-up scheduled.','success');renderFollowUps();}catch(error){showToast(error.message,'error');}});
}
