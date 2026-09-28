/* ======================================================================
   SIGN UP (account registration)
   Since the system ships with an empty database, this is how the very
   first Administrator, Dentist, Clinic Staff member, or Patient gets
   an account. New Dentist accounts also create a dentist entry; new
   Patient accounts also create a patient chart.
====================================================================== */
const SIGNUP_BASE_FIELDS = [
  {key:'name', label:'Full Name', type:'text', required:true},
  {key:'username', label:'Username', type:'text', required:true, hint:'This is what you\u2019ll use to sign in.'},
  {key:'password', label:'Password', type:'password', required:true, hint:'At least 10 characters.'},
  {key:'confirmPassword', label:'Confirm Password', type:'password', required:true},
  {key:'role', label:'I am creating an account as a\u2026', type:'select', required:true, options:['Patient','Dentist','Clinic Owner']},
];

const SIGNUP_DENTIST_FIELDS = [
  {key:'specialty', label:'Specialty', type:'text', required:true, placeholder:'e.g. General & Cosmetic Dentistry'},
];

const SIGNUP_CLINIC_FIELDS = [
  {key:'clinicName', label:'Clinic name', type:'text', required:true},
  {key:'registrationNumber', label:'Business registration number', type:'text', required:false},
  {key:'phone', label:'Clinic phone', type:'tel', required:true, pattern:PHONE_RE, patternMsg:'Enter a valid phone number.'},
  {key:'email', label:'Clinic email', type:'email', required:true, pattern:EMAIL_RE, patternMsg:'Enter a valid email address.'},
  {key:'address', label:'Street address', type:'text', required:true},
  {key:'city', label:'City', type:'text', required:true},
  {key:'region', label:'Region / province', type:'text', required:false},
  {key:'specializations', label:'Specializations', type:'text', required:true, placeholder:'General dentistry, Orthodontics'},
  {key:'latitude', label:'Map latitude (optional)', type:'number', required:false, placeholder:'e.g. 10.3157', step:'any'},
  {key:'longitude', label:'Map longitude (optional)', type:'number', required:false, placeholder:'e.g. 123.8854', step:'any'},
];

const SIGNUP_PATIENT_FIELDS = [
  {key:'dob', label:'Date of Birth', type:'date', required:true, notFuture:true},
  {key:'gender', label:'Gender', type:'select', required:true, options:['Male','Female','Other']},
  {key:'phone', label:'Phone Number', type:'tel', required:true, pattern:PHONE_RE, patternMsg:'Enter a valid phone number.'},
  {key:'email', label:'Email Address', type:'email', required:true, pattern:EMAIL_RE, patternMsg:'Enter a valid email address.'},
  {key:'dentistId', label:'Preferred Dentist (optional)', type:'select', required:false, options:()=>dentists.map(d=>({value:d.id,label:d.name}))},
];

function switchToSignup(){
  document.getElementById('login-screen').classList.add('signup-mode');
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('signup-view').classList.remove('hidden');
  document.getElementById('signup-error').classList.remove('show');
  renderSignupBaseFields();
}

function switchToLogin(){
  document.getElementById('login-screen').classList.remove('signup-mode');
  document.getElementById('signup-view').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('login-error').classList.remove('show');
  // Clear out any dynamically-added signup fields (e.g. the Patient/Dentist
  // extra fields) so their ids can't collide with same-named fields in
  // modals opened later while logged in (both use ids like "f-dentistId").
  document.getElementById('signup-fields').innerHTML = '';
}

function renderSignupBaseFields(){
  const root = document.getElementById('signup-fields');
  root.innerHTML = `<div class="signup-base-fields">${SIGNUP_BASE_FIELDS.map(f => fieldHtml(f, '')).join('')}</div><div id="signup-extra-fields" class="signup-extra-fields"></div>`;
  document.getElementById('f-role').addEventListener('change', (e)=>{
    renderSignupExtraFields(e.target.value);
  });
}

function renderSignupExtraFields(role){
  const extraRoot = document.getElementById('signup-extra-fields');
  if(role === 'Dentist'){
    extraRoot.innerHTML = SIGNUP_DENTIST_FIELDS.map(f => fieldHtml(f, '')).join('');
  } else if(role === 'Patient'){
    extraRoot.innerHTML = SIGNUP_PATIENT_FIELDS.map(f => fieldHtml(f, '')).join('');
  } else if(role === 'Clinic Owner'){
    extraRoot.innerHTML = SIGNUP_CLINIC_FIELDS.map(f => fieldHtml(f, '')).join('') + '<p class="field-hint">Your clinic will be reviewed before it appears in patient search.</p>';
  } else {
    extraRoot.innerHTML = '';
  }
}

function initSignup(){
  document.getElementById('show-signup-link').addEventListener('click', (e)=>{
    e.preventDefault();
    switchToSignup();
  });
  document.getElementById('show-login-link').addEventListener('click', (e)=>{
    e.preventDefault();
    switchToLogin();
  });

  document.getElementById('signup-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const errBox = document.getElementById('signup-error');
    errBox.classList.remove('show');

    const { valid: baseValid, values: base } = validateFields(SIGNUP_BASE_FIELDS);

    let extraValid = true;
    let extra = {};
    if(base.role === 'Dentist'){
      ({ valid: extraValid, values: extra } = validateFields(SIGNUP_DENTIST_FIELDS));
    } else if(base.role === 'Patient'){
      ({ valid: extraValid, values: extra } = validateFields(SIGNUP_PATIENT_FIELDS));
    } else if(base.role === 'Clinic Owner'){
      ({ valid: extraValid, values: extra } = validateFields(SIGNUP_CLINIC_FIELDS));
      extra.specializations = (extra.specializations || '').split(',').map(value=>value.trim()).filter(Boolean);
    }

    if(!baseValid || !extraValid) return;

    // Checks the generic validator doesn't cover (uniqueness is verified
    // by the server, since only it can see every existing account).
    let customOk = true;
    const passwordWrap = document.getElementById('field-password');
    const confirmWrap = document.getElementById('field-confirmPassword');

    if(base.password.length < 10){
      passwordWrap.classList.add('error');
      passwordWrap.querySelector('.field-error').textContent = 'Password must be at least 10 characters.';
      customOk = false;
    }
    if(base.confirmPassword !== base.password){
      confirmWrap.classList.add('error');
      confirmWrap.querySelector('.field-error').textContent = 'Passwords do not match.';
      customOk = false;
    }
    if(!customOk) return;

    const submitBtn = e.target.querySelector('button[type=submit]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account\u2026';

    try{
      const payload = { name: base.name, username: base.username, password: base.password, role: base.role, extra };
      const result = await apiPost('/auth/signup', payload);

      showToast('Account created \u2014 welcome to Wellstone Dental!', 'success');
      document.getElementById('signup-form').reset();
      document.getElementById('signup-fields').innerHTML = '';
      await logIn(result.user);
    }catch(err){
      // The server reports a taken username as a 409 conflict — point
      // the error at the username field specifically when that's the case.
      if(/username/i.test(err.message)){
        const usernameWrap = document.getElementById('field-username');
        usernameWrap.classList.add('error');
        usernameWrap.querySelector('.field-error').textContent = err.message;
      } else {
        errBox.textContent = err.message;
        errBox.classList.add('show');
      }
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}
