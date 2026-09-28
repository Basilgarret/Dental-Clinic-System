/* ======================================================================
   API CLIENT
   Every network call to the backend goes through here, so error
   handling and JSON parsing only has to be written once.
====================================================================== */
const API_BASE = 'http://localhost:4000/api';

async function apiRequest(path, options){
  const opts = Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {});
  if(opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);

  let res;
  try{
    res = await fetch(API_BASE + path, opts);
  }catch(networkErr){
    throw new Error('Could not reach the server. Make sure the backend is running at ' + API_BASE + '.');
  }

  let data = null;
  const text = await res.text();
  if(text){
    try{ data = JSON.parse(text); }catch(parseErr){ data = null; }
  }

  if(!res.ok){
    const message = (data && data.error) ? data.error : ('Request failed (status ' + res.status + ').');
    throw new Error(message);
  }
  return data;
}

function apiGet(path){ return apiRequest(path, { method: 'GET' }); }
function apiPost(path, body){ return apiRequest(path, { method: 'POST', body }); }
function apiPut(path, body){ return apiRequest(path, { method: 'PUT', body }); }
function apiPatch(path, body){ return apiRequest(path, { method: 'PATCH', body }); }
function apiDelete(path){ return apiRequest(path, { method: 'DELETE' }); }
