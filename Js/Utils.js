/* ======================================================================
   UTILITIES
====================================================================== */
function dentistName(id){ const d = dentists.find(x=>x.id===id); return d ? d.name : '\u2014'; }
function patientName(id){ const p = state.patients.find(x=>x.id===id); return p ? p.name : '\u2014'; }
function findPatient(id){ return state.patients.find(x=>x.id===id); }
function formatDate(iso){
  if(!iso) return '\u2014';
  const d = new Date(iso+'T00:00:00');
  if(isNaN(d)) return iso;
  return d.toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' });
}
function formatMoney(n){ return '\u20b1' + Number(n).toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function initials(name){ return name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase(); }

function statusBadge(status){
  const map = {
    'Scheduled':'badge-info', 'Requested':'badge-warning', 'Completed':'badge-success',
    'Cancelled':'badge-muted', 'No-show':'badge-danger',
    'Paid':'badge-success', 'Pending':'badge-warning', 'Overdue':'badge-danger',
    'Active':'badge-info',
  };
  return `<span class="badge ${map[status]||'badge-muted'}">${escapeHtml(status)}</span>`;
}

/* ---- Toasts ---- */
function showToast(message, type){
  type = type || 'success';
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icon = type==='success' ? ICONS.check : (type==='error' ? ICONS.close : ICONS.info);
  el.innerHTML = icon + `<span>${escapeHtml(message)}</span>`;
  root.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .25s ease'; el.style.opacity='0'; setTimeout(()=>el.remove(), 260); }, 3400);
}

/* ---- Modal ---- */
function openModal(html, opts){
  opts = opts || {};
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box ${opts.narrow?'narrow':''}">${html}</div></div>`;
  requestAnimationFrame(()=>{ document.getElementById('modal-overlay').classList.add('show'); });
  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('mousedown', (e)=>{ if(e.target === overlay) closeModal(); });
}
function closeModal(){
  const overlay = document.getElementById('modal-overlay');
  if(!overlay) return;
  overlay.classList.remove('show');
  setTimeout(()=>{ document.getElementById('modal-root').innerHTML=''; }, 150);
}
function openConfirm(message, title, onConfirm, tone){
  tone = tone || 'danger';
  const html = `
    <div class="modal-body" style="padding-top:24px;">
      <div class="confirm-icon ${tone==='neutral'?'neutral':''}">${tone==='neutral'?ICONS.info:ICONS.alert}</div>
      <h3 style="margin-bottom:8px;">${escapeHtml(title)}</h3>
      <p style="color:var(--text-muted); font-size:13.5px;">${escapeHtml(message)}</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" data-close-modal>Cancel</button>
      <button class="btn ${tone==='neutral'?'btn-primary':'btn-danger'}" id="confirm-ok-btn">Yes, continue</button>
    </div>`;
  openModal(html, {narrow:true});
  document.getElementById('confirm-ok-btn').addEventListener('click', ()=>{ closeModal(); onConfirm(); });
}