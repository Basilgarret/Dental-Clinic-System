function renderServices(){
  const root = document.getElementById('view-content');
  const canEdit = state.currentUser.role === 'Administrator' || state.currentUser.role === 'Clinic Staff';
  const services = state.services.slice().sort((a,b)=>Number(b.active)-Number(a.active) || a.name.localeCompare(b.name));
  const activeCount = services.filter(service=>service.active).length;

  root.innerHTML = `
    <div class="directory-heading">
      <div><span class="section-eyebrow">CLINIC CATALOG</span><h1>Treatments &amp; services</h1><p>Manage appointment offerings, standard prices, and visit durations.</p></div>
      ${canEdit ? `<button class="btn btn-primary" id="add-service-btn">${ICONS.plus} Add service</button>` : ''}
    </div>
    <div class="stat-grid service-summary">
      <div class="stat-card"><div class="label">Active services</div><div class="value">${activeCount}</div><div class="hint">Available for scheduling</div></div>
      <div class="stat-card"><div class="label">Inactive services</div><div class="value">${services.length-activeCount}</div><div class="hint">Saved but hidden from new bookings</div></div>
      <div class="stat-card"><div class="label">Average duration</div><div class="value">${activeCount ? Math.round(services.filter(service=>service.active).reduce((sum,service)=>sum+service.durationMinutes,0)/activeCount) : 0}<span class="service-unit">min</span></div><div class="hint">Across active services</div></div>
      <div class="stat-card"><div class="label">Catalog status</div><div class="value service-status-value">${activeCount ? 'Ready' : 'Empty'}</div><div class="hint">${activeCount ? 'Active services can be booked' : 'Existing appointment types remain available'}</div></div>
    </div>
    ${services.length ? `<div class="panel"><div class="panel-body"><table><thead><tr><th>Service</th><th>Description</th><th>Duration</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>${services.map(service=>`<tr><td><div class="cell-name">${escapeHtml(service.name)}</div><div class="cell-sub">Service #${service.id}</div></td><td>${escapeHtml(service.description||'—')}</td><td>${service.durationMinutes} min</td><td>${formatMoney(service.price)}</td><td><span class="badge ${service.active?'badge-success':'badge-muted'}">${service.active?'Active':'Inactive'}</span></td><td><div class="row-actions">${canEdit?`<button type="button" class="icon-btn" data-edit-service="${service.id}" aria-label="Edit ${escapeHtml(service.name)}" title="Edit">${ICONS.edit}</button><button type="button" class="btn btn-outline btn-sm" data-toggle-service="${service.id}">${service.active?'Deactivate':'Activate'}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div></div>` : `<div class="panel"><div class="panel-body">${emptyState('No services configured yet', canEdit ? 'Add your clinic’s first service. Existing appointment types remain available until then.' : 'The clinic service catalog has not been configured yet.')}</div></div>`}`;

  document.getElementById('add-service-btn')?.addEventListener('click',()=>openServiceForm());
  root.querySelectorAll('[data-edit-service]').forEach(button=>button.addEventListener('click',()=>openServiceForm(button.dataset.editService)));
  root.querySelectorAll('[data-toggle-service]').forEach(button=>button.addEventListener('click',async()=>{
    const service = state.services.find(item=>String(item.id)===button.dataset.toggleService);
    if(!service) return;
    try{
      const updated = await apiPut('/services/'+service.id,{...service,active:!service.active});
      Object.assign(service,updated);
      showToast(`Service ${service.active?'activated':'deactivated'}.`,'success');
      renderServices();
    }catch(error){ showToast(error.message,'error'); }
  }));
}

const serviceFields = [
  {key:'name',label:'Service name',type:'text',required:true,placeholder:'e.g. Dental cleaning'},
  {key:'description',label:'Description',type:'textarea',required:false,placeholder:'A short description for clinic staff'},
  {key:'price',label:'Standard price',type:'number',required:true,placeholder:'0.00'},
  {key:'durationMinutes',label:'Duration (minutes)',type:'number',required:true,placeholder:'30'},
];

function openServiceForm(id){
  const editing = id ? state.services.find(service=>String(service.id)===String(id)) : null;
  const values = editing || {name:'',description:'',price:'',durationMinutes:30};
  const html = `
    <div class="modal-header"><h3>${editing?'Edit service':'Add a service'}</h3><button class="modal-close" data-close-modal aria-label="Close service form">${ICONS.close}</button></div>
    <form id="service-form"><div class="modal-body">${fieldHtml(serviceFields[0],values.name)}${fieldHtml(serviceFields[1],values.description)}<div class="form-row">${fieldHtml(serviceFields[2],values.price)}${fieldHtml(serviceFields[3],values.durationMinutes)}</div><p class="field-hint">Prices are stored as the clinic’s standard charge; discounts and payments remain in Transactions.</p></div><div class="modal-footer"><button type="button" class="btn btn-outline" data-close-modal>Cancel</button><button type="submit" class="btn btn-primary">${editing?'Save changes':'Add service'}</button></div></form>`;
  openModal(html);
  bindModalClose();
  document.getElementById('service-form').addEventListener('submit',async(event)=>{
    event.preventDefault();
    const {valid,values:formValues}=validateFields(serviceFields);
    if(!valid) return;
    formValues.price=Number(formValues.price);
    formValues.durationMinutes=Number(formValues.durationMinutes);
    if(formValues.price<0 || formValues.durationMinutes<5){
      showToast('Price must be zero or more and duration must be at least 5 minutes.','error');
      return;
    }
    const submit=event.target.querySelector('[type="submit"]');
    submit.disabled=true;
    try{
      if(editing){
        Object.assign(editing,await apiPut('/services/'+editing.id,{...formValues,active:editing.active}));
        showToast('Service updated.','success');
      }else{
        state.services.push(await apiPost('/services',{...formValues,active:true}));
        showToast('Service added.','success');
      }
      closeModal();
      renderServices();
    }catch(error){
      submit.disabled=false;
      showToast(error.message,'error');
    }
  });
}
