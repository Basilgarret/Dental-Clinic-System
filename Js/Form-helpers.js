/* ======================================================================
   GENERIC FORM HELPERS
====================================================================== */
function fieldHtml(f, value){
  value = value==null ? '' : value;
  const reqMark = f.required ? '<span class="req">*</span>' : '';
  let input = '';
  if(f.type === 'select'){
    const opts = (typeof f.options === 'function' ? f.options() : f.options) || [];
    input = `<select id="f-${f.key}" data-key="${f.key}">
      <option value="">Select ${escapeHtml(f.label.toLowerCase())}\u2026</option>
      ${opts.map(o=>{
        const v = typeof o==='object' ? o.value : o;
        const l = typeof o==='object' ? o.label : o;
        return `<option value="${escapeHtml(v)}" ${String(v)===String(value)?'selected':''}>${escapeHtml(l)}</option>`;
      }).join('')}
    </select>`;
  } else if(f.type === 'textarea'){
    input = `<textarea id="f-${f.key}" data-key="${f.key}" placeholder="${escapeHtml(f.placeholder||'')}">${escapeHtml(value)}</textarea>`;
  } else {
    input = `<input type="${f.type}" id="f-${f.key}" data-key="${f.key}" value="${escapeHtml(value)}" placeholder="${escapeHtml(f.placeholder||'')}" ${f.step?`step="${f.step}"`:''}>`;
  }
  return `<div class="field" id="field-${f.key}">
    <label>${escapeHtml(f.label)} ${reqMark}</label>
    ${input}
    <div class="field-error">${escapeHtml(f.errorMsg || (f.label+' is required.'))}</div>
    ${f.hint?`<div class="field-hint">${escapeHtml(f.hint)}</div>`:''}
  </div>`;
}

function validateFields(fields){
  let valid = true;
  const values = {};
  fields.forEach(f=>{
    const el = document.getElementById('f-'+f.key);
    if(!el) return;
    const wrap = document.getElementById('field-'+f.key);
    const val = el.value.trim();
    let ok = true;
    let msg = f.label + ' is required.';
    if(f.required && !val){ ok = false; }
    else if(val && f.pattern && !f.pattern.test(val)){ ok = false; msg = f.patternMsg || 'Invalid format.'; }
    else if(val && f.notFuture && val > todayISO()){ ok = false; msg = f.label + ' cannot be in the future.'; }
    else if(val && f.notPast && val < todayISO()){ ok = false; msg = f.label + ' cannot be in the past.'; }
    else if(val && f.min != null && Number(val) < f.min){ ok = false; msg = f.label + ' must be at least ' + f.min + '.'; }
    if(!ok){ valid = false; wrap.classList.add('error'); wrap.querySelector('.field-error').textContent = msg; }
    else{ wrap.classList.remove('error'); }
    values[f.key] = val;
  });
  return { valid, values };
}