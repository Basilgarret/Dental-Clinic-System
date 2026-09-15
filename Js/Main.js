/* ======================================================================
   MODAL CLOSE BINDING (delegated per open)
====================================================================== */
function bindModalClose(){
  document.querySelectorAll('[data-close-modal]').forEach(el=> el.addEventListener('click', closeModal));
  document.addEventListener('keydown', escCloseOnce);
}
function escCloseOnce(e){
  if(e.key==='Escape'){ closeModal(); document.removeEventListener('keydown', escCloseOnce); }
}

/* ======================================================================
   INIT
====================================================================== */
initLogin();