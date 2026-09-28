/* ======================================================================
   TRANSACTIONS MODULE
====================================================================== */
let txFilter = 'All';
function renderTransactions(){
  const role = state.currentUser.role;
  const canEdit = role==='Administrator' || role==='Clinic Staff';
  const root = document.getElementById('view-content');
  let list = state.transactions.slice();
  if(role==='Patient') list = list.filter(t=>t.patientId===state.currentUser.id);
  if(txFilter!=='All') list = list.filter(t=>t.status===txFilter);
  list = list.sort((a,b)=> b.date.localeCompare(a.date));

  const totalDue = list.filter(t=>t.status!=='Paid').reduce((s,t)=>s+t.amount,0);

  root.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr); margin-bottom:20px;">
      <div class="stat-card"><div class="label">${role==='Patient'?'Your balance due':'Total outstanding'}</div><div class="value">${formatMoney(totalDue)}</div><div class="hint">Pending + overdue</div></div>
      <div class="stat-card"><div class="label">Paid invoices</div><div class="value">${state.transactions.filter(t=> (role==='Patient'?t.patientId===state.currentUser.id:true) && t.status==='Paid').length}</div><div class="hint">Settled in full</div></div>
      <div class="stat-card"><div class="label">Overdue invoices</div><div class="value">${state.transactions.filter(t=> (role==='Patient'?t.patientId===state.currentUser.id:true) && t.status==='Overdue').length}</div><div class="hint">Needs follow-up</div></div>
    </div>
    <div class="panel">
      <div class="panel-header">
        <div class="toolbar">
          <select class="filter-select" id="tx-filter">
            ${['All','Paid','Pending','Overdue'].map(s=>`<option value="${s}" ${txFilter===s?'selected':''}>${s==='All'?'All statuses':s}</option>`).join('')}
          </select>
        </div>
        ${canEdit ? `<button class="btn btn-primary" id="add-tx-btn">${ICONS.plus} Record transaction</button>` : ''}
      </div>
      <div class="panel-body">
        ${list.length ? buildTxTable(list, role, canEdit) : emptyState('No transactions found', 'Billing records will appear here.')}
      </div>
    </div>`;

  document.getElementById('tx-filter').addEventListener('change', (e)=>{ txFilter = e.target.value; renderTransactions(); });
  if(canEdit) document.getElementById('add-tx-btn').addEventListener('click', ()=> openTransactionForm('add'));

  root.querySelectorAll('[data-edit-tx]').forEach(el=> el.addEventListener('click', ()=> openTransactionForm('edit', el.dataset.editTx)));
  root.querySelectorAll('[data-delete-tx]').forEach(el=> el.addEventListener('click', ()=>{
    openConfirm('This will permanently remove this transaction record.', 'Delete this transaction?', async ()=>{
      try{
        await apiDelete('/transactions/' + el.dataset.deleteTx);
        state.transactions = state.transactions.filter(t=>t.id!==el.dataset.deleteTx);
        showToast('Transaction deleted.', 'success');
        renderNotifications();
        renderTransactions();
      }catch(err){
        showToast(err.message, 'error');
      }
    });
  }));
  root.querySelectorAll('[data-pay-tx]').forEach(el=> el.addEventListener('click', ()=>{
    const t = state.transactions.find(x=>x.id===el.dataset.payTx);
    openConfirm(`Confirm payment of ${formatMoney(t.amount)} for "${t.description}".`, 'Pay this invoice?', async ()=>{
      try{
        const updated = await apiPatch('/transactions/' + t.id + '/status', { status: 'Paid' });
        Object.assign(t, updated);
        showToast('Payment recorded. Thank you!', 'success');
        renderNotifications();
        renderTransactions();
      }catch(err){
        showToast(err.message, 'error');
      }
    }, 'neutral');
  }));
}

function buildTxTable(list, role, canEdit){
  return `<table><thead><tr>
    ${role!=='Patient' ? '<th>Patient</th>' : ''}<th>Date</th><th>Description</th><th>Amount</th><th>Method</th><th>Status</th><th></th>
  </tr></thead><tbody>
  ${list.map(t=>`
    <tr data-transaction-id="${t.id}">
      ${role!=='Patient' ? `<td><div class="cell-name">${escapeHtml(patientName(t.patientId))}</div></td>` : ''}
      <td>${formatDate(t.date)}</td>
      <td>${escapeHtml(t.description)}</td>
      <td>${formatMoney(t.amount)}</td>
      <td>${escapeHtml(t.method)}</td>
      <td>${statusBadge(t.status)}</td>
      <td><div class="row-actions">
        ${role==='Patient' && t.status!=='Paid' ? '<span class="cell-sub">Contact clinic to arrange payment</span>' : ''}
        ${canEdit ? `<button class="icon-btn" data-edit-tx="${t.id}" title="Edit">${ICONS.edit}</button>` : ''}
        ${canEdit ? `<button class="icon-btn danger" data-delete-tx="${t.id}" title="Delete">${ICONS.trash}</button>` : ''}
      </div></td>
    </tr>`).join('')}
  </tbody></table>`;
}

const txFields = [
  {key:'patientId', label:'Patient', type:'select', required:true, options:()=>state.patients.map(p=>({value:p.id,label:p.name}))},
  {key:'date', label:'Date', type:'date', required:true},
  {key:'description', label:'Description', type:'text', required:true, placeholder:'e.g. Composite Filling'},
  {key:'amount', label:'Amount (\u20b1)', type:'number', required:true, min:1, step:'0.01'},
  {key:'method', label:'Payment Method', type:'select', required:true, options:['Cash','Card','Insurance','Online']},
  {key:'status', label:'Status', type:'select', required:true, options:['Paid','Pending','Overdue']},
];

function openTransactionForm(mode, id){
  const editing = mode==='edit' ? state.transactions.find(t=>t.id===id) : null;
  const vals = editing || { patientId:'', date: todayISO(), description:'', amount:'', method:'', status:'Pending' };
  const html = `
    <div class="modal-header"><h3>${editing?'Edit Transaction':'Record Transaction'}</h3><button class="modal-close" data-close-modal>${ICONS.close}</button></div>
    <form id="tx-form">
      <div class="modal-body">
        ${fieldHtml(txFields[0], vals.patientId)}
        <div class="form-row">
          ${fieldHtml(txFields[1], vals.date)}
          ${fieldHtml(txFields[3], vals.amount)}
        </div>
        ${fieldHtml(txFields[2], vals.description)}
        <div class="form-row">
          ${fieldHtml(txFields[4], vals.method)}
          ${fieldHtml(txFields[5], vals.status)}
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">${editing?'Save changes':'Save transaction'}</button>
      </div>
    </form>`;
  openModal(html);
  bindModalClose();
  document.getElementById('tx-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const { valid, values } = validateFields(txFields);
    if(!valid) return;
    values.amount = Number(values.amount);

    const submitBtn = e.target.querySelector('button[type=submit]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving\u2026';

    try{
      if(editing){
        const updated = await apiPut('/transactions/' + editing.id, values);
        Object.assign(editing, updated);
        showToast('Transaction updated.', 'success');
      } else {
        const newTx = await apiPost('/transactions', values);
        state.transactions.push(newTx);
        showToast('Transaction recorded.', 'success');
      }
      closeModal();
      renderNotifications();
      renderTransactions();
    }catch(err){
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}
