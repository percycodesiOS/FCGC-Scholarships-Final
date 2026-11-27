'use strict';
async function startApplication(config){
window.applicationConfig=config;
const year=config.year,academicYear=`${year}-${Number(year)+1}`;
let coverAcknowledged=false;
const coverVersion=config.coverLetterVersion||`${year}:f470917571b9a467`;
const coverCheck=document.getElementById('coverLetterAcknowledgment'),eligCheck=document.getElementById('eligibilityAcknowledgment'),beginButton=document.getElementById('beginApplication');
const coverScrollbox=document.getElementById('coverScrollbox'),coverReaderShell=document.getElementById('coverReaderShell'),coverReadProgress=document.getElementById('coverReadProgress'),coverScrollWarning=document.getElementById('coverScrollWarning'),ackBlock=document.getElementById('acknowledgmentsBlock'),coverPrintBar=document.getElementById('coverPrintBar');
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(Array.isArray(config.eligibility)&&config.eligibility.length){
 const eligList=document.getElementById('coverEligibilityList');
 if(eligList)eligList.innerHTML=config.eligibility.map(item=>`<li>${escapeHtml(String(item).replaceAll('{year}',year))}</li>`).join('');
}
let letterScrolledToEnd=!coverScrollbox;
function unlockAcknowledgments(){
 if(letterScrolledToEnd)return;
 letterScrolledToEnd=true;
 coverCheck.disabled=false;
 if(eligCheck)eligCheck.disabled=false;
 if(ackBlock)ackBlock.classList.remove('ack-locked');
 if(coverScrollWarning)coverScrollWarning.hidden=true;
 if(coverReaderShell)coverReaderShell.classList.remove('needs-scroll');
 if(coverReadProgress){
  coverReadProgress.textContent='✓ Both pages reviewed. Check both boxes below to continue.';
  coverReadProgress.parentElement?.classList.add('read-complete');
 }
 if(coverPrintBar)coverPrintBar.hidden=false;
 updateBeginEnabled();
}
function checkCoverScroll(){
 if(!coverScrollbox||letterScrolledToEnd)return;
 const maxScroll=coverScrollbox.scrollHeight-coverScrollbox.clientHeight;
 if(maxScroll>80&&coverScrollbox.scrollTop>=maxScroll-48)unlockAcknowledgments();
}
function warnMustScroll(){
 if(letterScrolledToEnd)return;
 if(coverScrollWarning)coverScrollWarning.hidden=false;
 if(coverReaderShell){
  coverReaderShell.classList.add('needs-scroll');
  coverReaderShell.scrollIntoView({behavior:'smooth',block:'center'});
 }
}
if(coverScrollbox){
 coverScrollbox.addEventListener('scroll',checkCoverScroll,{passive:true});
 const endSentinel=document.getElementById('coverScrollEnd');
 if(endSentinel&&'IntersectionObserver'in window){
  const obs=new IntersectionObserver(entries=>{
   if(entries.some(e=>e.isIntersecting)&&coverScrollbox.scrollTop>40)unlockAcknowledgments();
  },{root:coverScrollbox,threshold:0.5});
  obs.observe(endSentinel);
 }
}
if(ackBlock){
 ackBlock.addEventListener('click',e=>{
  if(!letterScrolledToEnd){e.preventDefault();warnMustScroll();}
 });
}
function updateBeginEnabled(){
 const ready=letterScrolledToEnd&&coverCheck.checked&&(!eligCheck||eligCheck.checked);
 beginButton.disabled=!ready;
 const ackHint=document.getElementById('ackHint');
 if(ackHint){
  if(!letterScrolledToEnd)ackHint.textContent='Scroll to the bottom of the cover letter above to unlock the acknowledgment checkboxes.';
  else if(!ready)ackHint.textContent='Check both boxes above to unlock the application.';
  else ackHint.textContent='Ready. Click Continue to the application above.';
 }
}
function requireCover(){if(!letterScrolledToEnd||!coverAcknowledged||!coverCheck.checked||(eligCheck&&!eligCheck.checked))throw new Error('Read and scroll through the cover letter, then acknowledge both boxes before continuing.');}
coverCheck.onchange=updateBeginEnabled;
if(eligCheck)eligCheck.onchange=updateBeginEnabled;
beginButton.onclick=()=>{if(!letterScrolledToEnd){warnMustScroll();return;}if(!coverCheck.checked||(eligCheck&&!eligCheck.checked))return;coverAcknowledged=true;document.getElementById('coverLetterGate').hidden=true;document.getElementById('applicationWorkflow').hidden=false;window.scrollTo({top:0,behavior:'auto'});const startHeading=document.getElementById('workflowStartHeading');if(startHeading){startHeading.focus({preventScroll:true});startHeading.scrollIntoView({block:'start',behavior:'auto'});}};
const reviewCoverBtn=document.getElementById('reviewCover');if(reviewCoverBtn)reviewCoverBtn.onclick=()=>{coverAcknowledged=false;coverCheck.checked=false;if(eligCheck)eligCheck.checked=false;if(coverScrollbox){letterScrolledToEnd=false;coverCheck.disabled=true;if(eligCheck)eligCheck.disabled=true;if(ackBlock)ackBlock.classList.add('ack-locked');if(coverScrollWarning)coverScrollWarning.hidden=true;if(coverReadProgress){coverReadProgress.textContent="Please carefully read pages one and two of the Foundation's cover letter. Once you reach the end of page two, the acknowledgment box will unlock to allow you to continue with the application.";coverReadProgress.parentElement?.classList.remove('read-complete');}if(coverPrintBar)coverPrintBar.hidden=true;coverScrollbox.scrollTop=0;}updateBeginEnabled();document.getElementById('applicationWorkflow').hidden=true;document.getElementById('coverLetterGate').hidden=false;document.getElementById('coverLetterTitle').scrollIntoView({block:'start'});};

const F=(name,label,type='text',full=false,hint='')=>({name,label,type,full,hint});
const groups=[
 {id:'applicant',title:'Applicant information',number:'1',note:'I hereby apply for a Fox Chapel Golf Club Scholarship Foundation scholarship.',fields:[F('applicant_name','Name'),F('application_date','Date','text',false,'MM/DD/YYYY'),F('home_address','Home address','text',true),{type:'address_row',prefix:'home'},F('email','Email','email'),F('phone_number','Phone number (including area code)','tel',false,'(412) 555-1234'),F('age','Age'),F('birth_date','Birth date','text',false,'MM/DD/YYYY'),F('relationship','Relationship to the Fox Chapel Golf Club','relationship',true),F('club_position','Position held at Fox Chapel Golf Club'),F('employment_start_date','Start date of employment at Fox Chapel Golf Club','text',false,'MM/DD/YYYY')]},
 {id:'family',title:'Family information',number:'2',fields:[F('parent_guardian_names','Name of parent(s) / guardian(s)','text',true),F('parent_guardian_street','Street address','text',true),{type:'address_row',prefix:'parent_guardian'},{type:'parent_row',role:'mother',label:'Mother'},{type:'parent_row',role:'father',label:'Father'},F('siblings_names_and_ages','Names and ages of brothers and sisters','textarea',true)]},
 {id:'education',title:'Education',number:'3',fields:[F('high_school','High school','text',true),F('high_school_gpa','GPA'),F('high_school_graduation','Graduation date'),F('high_school_activities','High school activities (athletics, clubs, music, arts, etc.)','long',true),F('honors_awards','Honors / awards','long',true),F('test_scores','Test and score (ACT, SAT, other)','long',true),F('interests_hobbies','Interests / hobbies','long',true),F('work_jobs','Work / jobs','long',true),F('volunteer_activities','Volunteer activities / community involvement','long',true),F('fall_2027_school',`Qualified school / college for Fall ${year} you plan to attend`,'text',true),F('course_of_study','Course of study / program you wish to pursue','text',true),F('terms','Post High School Education','terms',true),F('post_school_clubs','Post high school: clubs, activities, music, arts, etc.','long',true),F('other_community_involvement','Post high school: other community / school involvement','long',true),F('post_school_work_jobs','Post high school: work / jobs','long',true)]}
];
const labels={};
function input(f){
 if(f.type==='address_row'){
  const p=f.prefix;
  labels[`${p}_city`]='City';labels[`${p}_state`]='State';labels[`${p}_zip`]='ZIP code';
  return `<div class="address-row"><div class="field"><label for="${p}_city">City</label><input id="${p}_city" name="${p}_city" type="text" maxlength="240" autocomplete="address-level2"></div><div class="field"><label for="${p}_state">State</label><input id="${p}_state" name="${p}_state" type="text" maxlength="2" autocomplete="address-level1" autocapitalize="characters"></div><div class="field"><label for="${p}_zip">ZIP code</label><input id="${p}_zip" name="${p}_zip" type="text" inputmode="numeric" maxlength="10" autocomplete="postal-code"></div></div>`;
 }
 if(f.type==='parent_row'){
  const r=f.role,lbl=f.label;
  labels[`${r}_employer`]=`${lbl}: employer`;labels[`${r}_occupation`]=`${lbl}: occupation`;
  return `<div class="parent-row"><div class="parent-row-label">${escapeHtml(lbl)}</div><div class="field"><label for="${r}_employer">Employer</label><input id="${r}_employer" name="${r}_employer" type="text" maxlength="240"></div><div class="field"><label for="${r}_occupation">Occupation</label><input id="${r}_occupation" name="${r}_occupation" type="text" maxlength="240"></div></div>`;
 }
 labels[f.name]=f.label;
 if(f.type==='relationship')return `<fieldset class="full"><legend>${f.label}</legend><div class="choices">${[['employee','Employee'],['child_of_employee','Child of employee'],['caddie','Caddie']].map(([v,l])=>`<label><input type="checkbox" name="relationship_${v}">${l}</label>`).join('')}</div></fieldset>`;
 if(f.type==='terms')return `<div class="full"><h3>Post High School Education</h3><div class="terms"><div class="term-row term-head" aria-hidden="true"><span>Education</span><span>School</span><span>GPA (by semester or term)</span><span>Major / interest</span></div>${Array.from({length:6},(_,i)=>`<div class="term-row"><strong>${i+1}</strong>${[['school','School'],['gpa','GPA (by semester or term)'],['major','Major / interest']].map(([key,label])=>`<label><span class="sr-only">Education ${i+1}: ${label}</span><input name="term_${i+1}_${key}" id="term_${i+1}_${key}" maxlength="240" aria-label="Education ${i+1}: ${label}"></label>`).join('')}</div>`).join('')}</div></div>`;
 const long=['long','textarea'].includes(f.type);
 const limit=({applicant_name:160,phone_number:40,application_date:20,birth_date:20,employment_start_date:20,home_state:2,parent_guardian_state:2,home_zip:10,parent_guardian_zip:10,age:3})[f.name]||240;
 const isDateField=['application_date','birth_date','employment_start_date'].includes(f.name);
 const extraAttrs=f.name==='email'?' autocomplete="email" autocorrect="off" autocapitalize="none" spellcheck="false"':f.name==='phone_number'?' autocomplete="tel" inputmode="tel" placeholder="(412) 555-1234" data-format="phone"':f.name==='applicant_name'?' autocomplete="name"':f.name==='age'?' inputmode="numeric"':isDateField?' inputmode="numeric" placeholder="MM/DD/YYYY" data-format="date"':'';
 return `<div class="field ${f.full?'full':''}"><label for="${f.name}">${escapeHtml(f.label)}</label>${long?`<textarea id="${f.name}" name="${f.name}" rows="3" maxlength="8000"></textarea>`:`<input id="${f.name}" name="${f.name}" type="${f.type}" maxlength="${limit}"${extraAttrs}>`}${f.hint?`<p class="hint">${f.hint}</p>`:''}</div>`;
}
function yesNo(name,label){return `<fieldset class="full"><legend>${label}</legend><div class="choices"><label><input type="radio" name="${name}" value="Yes">Yes</label><label><input type="radio" name="${name}" value="No">No</label></div></fieldset>`;}
const moneyNames=['annual_tuition','annual_room_board','annual_miscellaneous',...Array.from({length:5},(_,i)=>`aid_${i+1}_amount`)];
const costItems=[
 {name:'annual_tuition',label:'Tuition and Mandatory Fees',sub:'Billable institutional tuition and required fees'},
 {name:'annual_room_board',label:'Food and Housing',sub:'On-campus housing and meal plan, or off-campus living allowance'},
 {name:'annual_miscellaneous',label:'Books, Course Materials, Supplies & Transportation',sub:'Non-billable academic materials, technology, and personal allowances'}
];
const costLabels=costItems.map(c=>c.label);
const moneyInput=(n,label)=>`<input id="${n}" name="${n}" type="text" inputmode="decimal" maxlength="17" placeholder="0.00" aria-label="${escapeHtml(label)} in dollars" data-money>`;
const form=document.getElementById('application');
form.innerHTML=groups.map(g=>`<section id="${g.id}"><h2>Section ${g.number}: ${g.title}</h2>${g.note?`<p>${g.note}</p>`:''}<div class="grid">${g.fields.map(input).join('')}</div>${g.id==='applicant'?`<p class="document-note">Before submitting your application, upload a digital photo of yourself in the <a class="upload-link" href="#uploadPhoto">Upload applicant photo</a> section of this online form.</p>`:''}</section>`).join('')+`
<section id="financial"><h2>Section 4: Financial Information</h2>
<p class="fin-intro">Provide your institution's estimated <strong>Cost of Attendance</strong> and confirmed gift aid for one full academic year (<strong>${academicYear}</strong>).</p>
<div class="fin-doc-callout"><strong>Required document:</strong> Attach your official Financial Aid Offer or Cost of Attendance estimate from your school. <a class="upload-link" href="#uploadDocuments">Upload documents below</a></div>

<div class="fin-card">
<div class="fin-card-head"><span class="fin-step">Part A</span><h3>Estimated Cost of Attendance (${academicYear})</h3><p class="hint">Enter your school's full-year estimate for billable and non-billable expenses. Enter 0 if an item does not apply.</p></div>
<div class="money-table"><div class="money-grid table-head"><strong>Expense Category</strong><strong>Full Academic Year ($)</strong></div>${costItems.map(c=>`<div class="money-grid"><div class="cost-label-wrap"><label for="${c.name}">${c.label}</label><span class="cost-sub">${c.sub}</span></div>${moneyInput(c.name,c.label)}</div>`).join('')}<div class="total"><span>A. Total Estimated Cost of Attendance (${academicYear})</span><output id="annual_estimated_cost" aria-live="polite">$0.00</output></div></div>
<p id="costHint" class="hint">Totals update automatically as you type. Enter 0 if a cost does not apply.</p>
</div>

<div class="fin-card">
<div class="fin-card-head"><span class="fin-step">Part B</span><h3>Federal &amp; Institutional Financial Aid (${academicYear})</h3><p class="hint">Indicate whether you have completed federal or school-based financial aid applications for the upcoming academic year.</p></div>
<div class="grid">${yesNo('fafsa_submitted',`Have you submitted the FAFSA for ${academicYear}?`)}${input(F('student_aid_index','Student Aid Index (SAI)','text',false,'Shown on your FAFSA Submission Summary, if submitted.'))}<div class="full fin-doc-callout"><strong>Required document (if FAFSA submitted):</strong> Attach the first two pages of your FAFSA Submission Summary showing your Student Aid Index. <a class="upload-link" href="#uploadDocuments">Upload documents below</a></div>${input(F('no_fafsa_explanation','If you did not submit the FAFSA, please explain','textarea',true))}${yesNo('school_aid_applied','Have you applied for institutional financial aid through your school?')}${input(F('school_aid_explanation','If you did not apply for institutional financial aid, please explain','textarea',true))}</div>
</div>

<div class="fin-card">
<div class="fin-card-head"><span class="fin-step">Part C</span><h3>Confirmed Grants &amp; Scholarships (Gift Aid, ${academicYear})</h3><p class="hint">List institutional, federal, state, or outside grants and scholarships already confirmed for ${academicYear} (gift aid that does not need to be repaid). Do not include student loans or work-study.</p></div>
<div class="money-table awards-table"><div class="awards-grid table-head"><strong>Name</strong><strong>Institution</strong><strong>Amount ($)</strong></div>${Array.from({length:5},(_,i)=>{const n=i+1;labels[`aid_${n}_name`]=`Scholarship or grant ${n} name`;labels[`aid_${n}_institution`]=`Scholarship or grant ${n} institution`;return `<div class="awards-grid"><label class="sr-only" for="aid_${n}_name">Scholarship or grant ${n} name</label><input id="aid_${n}_name" name="aid_${n}_name" aria-label="Scholarship or grant ${n} name" placeholder="Grant or scholarship name" maxlength="240"><label class="sr-only" for="aid_${n}_institution">Scholarship or grant ${n} institution</label><input id="aid_${n}_institution" name="aid_${n}_institution" aria-label="Scholarship or grant ${n} institution" placeholder="School or organization" maxlength="240">${moneyInput(`aid_${n}_amount`,`Scholarship or grant ${n} amount`)}</div>`;}).join('')}<div class="total"><span>B. Total Confirmed Grants &amp; Scholarships (Gift Aid)</span><output id="total_financial_aid" aria-live="polite">$0.00</output></div></div>
</div>

<div class="total unfunded fin-net-cost"><div><span class="net-cost-title">Estimated Remaining Net Cost</span><span class="net-cost-sub">Estimated Cost of Attendance minus Confirmed Gift Aid (A minus B)</span></div><output id="total_not_funded" aria-live="polite">$0.00</output></div>
<p class="hint">Calculated automatically from the figures entered above. Remaining net cost will not display below $0.00.</p>
<div class="fin-context-wrap">${input(F('financial_explanation','Additional Financial Context, Pending Aid, or Unavailable Documents','textarea',true,'Use this space to note a pending financial aid offer, institutional aid review (such as CSS Profile), pending outside scholarships, or special family financial circumstances.'))}</div></section>
<section id="reference"><h2>Section 5: Reference</h2><p>Please provide the name and relationship of your reference below, and include one letter of recommendation from a person outside Fox Chapel Golf Club. Letters from FCGC personnel do not qualify.</p><div class="fin-doc-callout"><strong>Required document:</strong> Upload your letter of recommendation in <a class="upload-link" href="#uploadDocuments">Step 2 (Supporting Documents) below</a>.</div>${input(F('reference_name_relationship','Name and relationship','text',true))}</section>
<section id="essay"><h2>Section 6: Personal Essay &amp; Signatures</h2><p>Prepare a brief personal essay (1 to 2 pages) in your own words detailing your educational and career goals and how this scholarship would help you achieve them. You may include your reasons for seeking this scholarship, the anticipated benefits of attending your school, contributions you hope to make to the campus community, your most significant academic or personal achievement, and any additional context for the committee.</p>
<div class="fin-doc-callout"><strong>Required document:</strong> Upload your 1 to 2 page personal essay (PDF) in <a class="upload-link" href="#uploadDocuments">Step 2 (Supporting Documents) below</a>.</div>
<p class="accuracy-note">Review every answer for accuracy. Your essay must reflect your own experience.</p><div class="signature-grid"><div><h3>Student Signature</h3><div id="studentSignaturePreview" class="signature-preview">Not signed yet</div><button type="button" data-sign="student">Sign application</button><button type="button" class="text-button" data-remove-sign="student" hidden>Remove signature</button></div><div><h3>Parent or Guardian Signature</h3><div id="parentSignaturePreview" class="signature-preview">Not signed yet</div><button type="button" data-sign="parent">Sign application</button><button type="button" class="text-button" data-remove-sign="parent" hidden>Remove signature</button><p class="hint">If the student is under the age of 18.</p></div></div>
<div class="submission-notice"><p class="delivery">Complete and submit your application on this website. Keep the completed PDF for your records.</p><p><strong>Deadline: ${escapeHtml(config.deadline)}</strong></p><p>Disclaimer: This scholarship is not an employee bonus. Applying does not guarantee an interview or a scholarship.</p></div>
${input(F('additional_information','Additional Information','textarea',true,'Identify the section you are explaining. Long answers continue on an extra page.'))}</section>`;

let signatures={};
const confirmEmailInput=document.getElementById('confirmationEmail');
let confirmEmailCustomized=false;
if(confirmEmailInput){
 confirmEmailInput.addEventListener('input',()=>{
  const val=confirmEmailInput.value.trim();
  confirmEmailCustomized=val.length>0&&val!==(form.elements.email?.value||'').trim();
  update();
  remember();
 });
}
function values(){const data={};for(const el of form.elements){if(!el.name)continue;if(el.type==='checkbox')data[el.name]=el.checked;else if(el.type==='radio'){if(el.checked)data[el.name]=el.value;}else data[el.name]=el.value;}if(confirmEmailInput)data.confirmation_email=confirmEmailInput.value.trim();data.signatures=signatures;data.testApplication=false;return data;}
function cents(value){const s=String(value??'').trim().replace(/^\$/,'');if(!s)return 0;if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/.test(s)&&!/^\.\d{1,2}$/.test(s))return NaN;const [a,b='']=s.replaceAll(',','').split('.');const n=Number(a||0)*100+Number((b+'00').slice(0,2));return Number.isSafeInteger(n)&&n<=999999999999? n:NaN;}
function totals(data){const parsed=moneyNames.map(n=>cents(data[n]));if(parsed.some(n=>!Number.isFinite(n)))return null;const a=parsed.slice(0,3).reduce((a,b)=>a+b,0);const b=parsed.slice(3).reduce((a,b)=>a+b,0);return {annual_estimated_cost:a,total_financial_aid:b,total_not_funded:Math.max(0,a-b)};}
const usd=n=>(n/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
function update(){const data=values();if(confirmEmailInput&&!confirmEmailCustomized){confirmEmailInput.value=data.email||'';data.confirmation_email=(data.email||'').trim();}const confirmDisplay=data.confirmation_email||data.email||'not entered';document.getElementById('reviewIdentity').textContent=`Check before sending: Applicant: ${data.applicant_name||'not entered'} · Confirmation email: ${confirmDisplay} · Academic year: ${academicYear}`;const t=totals(data);for(const n of moneyNames){const el=form.elements[n];el.setCustomValidity(Number.isFinite(cents(data[n]))?'':'Enter a dollar amount of 0 or more, with up to two decimal places.');el.setAttribute('aria-invalid',String(!Number.isFinite(cents(data[n]))));}for(const n of ['annual_estimated_cost','total_financial_aid','total_not_funded'])document.getElementById(n).textContent=t?usd(t[n]):'Check amount';document.getElementById('costHint').textContent=moneyNames.slice(0,3).every(n=>String(data[n]).trim())?'All three cost rows have an amount.':'Running total of amounts entered. Fill all three cost rows (use 0 if none) before downloading.';}

let dirty=false,prepared=null,currentUrl=null,submitted=false,submitting=false,answerRevision=0;
function updateSubmitState(){document.getElementById('submitApplication').disabled=submitted||submitting||!config.canSubmit||!document.getElementById('submissionConsent').checked;}
document.getElementById('submissionConsent').addEventListener('change',updateSubmitState);
function lockSubmitted(){submitted=true;try{localStorage.removeItem(draftKey);}catch{}form.querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=true);for(const id of ['confirmationEmail','applicantPhoto','clearPhoto','supportingFiles','clearAttachments','saveDraft','loadDraft','restoreProgress','rememberProgress','forgetProgress','submissionConsent','reviewCover','reviewApplication']){const el=document.getElementById(id);if(el)el.disabled=true;}const rb=document.getElementById('restoreBanner');if(rb)rb.hidden=true;document.getElementById('submitApplication').disabled=true;document.getElementById('submitApplication').textContent='Submitted';}
const draftKey=`fcgc-progress-${year}`,status=document.getElementById('draftStatus'),restoreBanner=document.getElementById('restoreBanner'),restoreSummary=document.getElementById('restoreSummary');
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function draft(){return {schema:'fcgc-application-v2',year,answers:values(),savedAt:new Date().toISOString()};}
function remember(){if(document.getElementById('rememberProgress').checked)try{localStorage.setItem(draftKey,JSON.stringify(draft()));status.textContent='✓ Progress saved automatically in this browser (stays on this device until submitted or cleared).';if(restoreBanner)restoreBanner.hidden=true;}catch{status.textContent='This browser blocked automatic saving (for example, Private/Incognito mode). Open "Switching computers" below to download a backup file instead.';}}
function changed(){if(submitted)return;answerRevision++;dirty=true;prepared=null;document.getElementById('reviewStatus').textContent='';document.getElementById('submissionConsent').checked=false;updateSubmitState();document.getElementById('downloadReady').hidden=true;document.getElementById('downloadStatus').textContent='';document.getElementById('submitStatus').textContent='';remember();}
function renderSignatures(){for(const role of ['student','parent']){const box=document.getElementById(role+'SignaturePreview'),sig=signatures[role];box.replaceChildren();if(sig?.image){const image=document.createElement('img');image.src=sig.image;image.alt=`Signature of ${sig.name}`;box.append(image);}const text=document.createElement('span');text.textContent=sig?`${sig.name} · signed`:'Not signed yet';box.append(text);document.querySelector(`[data-remove-sign="${role}"]`).hidden=!sig;}}
function formatDateTyping(raw){
 const s=String(raw||'').trim();if(!s)return '';
 const iso=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
 if(iso)return `${iso[2].padStart(2,'0')}/${iso[3].padStart(2,'0')}/${iso[1]}`;
 if(/[/.-]/.test(s)){
  const parts=s.split(/[/.-]/).map(p=>p.replace(/\D/g,''));
  const m=parts[0].slice(0,2);
  if(parts.length===1)return m;
  const mp=m.length===1?`0${m}`:m;
  if(parts.length===2){
   const rawDay=parts[1]||'';
   if(!rawDay)return mp?`${mp}/`:'';
   if(rawDay.length<=2)return `${mp}/${rawDay}`;
   return `${mp}/${rawDay.slice(0,2)}/${rawDay.slice(2,6)}`;
  }
  const d=(parts[1]||'').slice(0,2);
  const dp=d.length===1?`0${d}`:d;
  const y=parts.slice(2).join('').slice(0,4);
  if(!y)return dp?`${mp}/${dp}/`:(mp?`${mp}/`:'');
  return `${mp}/${dp}/${y}`;
 }
 const d=s.replace(/\D/g,'').slice(0,8);
 if(d.length<=2)return d;
 if(d.length<=4)return `${d.slice(0,2)}/${d.slice(2)}`;
 return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}
function normalizeDateBlur(raw){
 const s=String(raw||'').trim();if(!s)return '';
 const iso=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
 if(iso)return `${iso[2].padStart(2,'0')}/${iso[3].padStart(2,'0')}/${iso[1]}`;
 const m=s.match(/^(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})$/);
 if(m){
  const cutoff=(new Date().getFullYear()%100)+2;
  const yy=m[3].length===2?(Number(m[3])>cutoff?`19${m[3]}`:`20${m[3]}`):m[3].slice(0,4);
  return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${yy}`;
 }
 return formatDateTyping(s).replace(/\/+$/,'');
}
function formatPhoneTyping(raw){let d=String(raw||'').replace(/\D/g,'');if(d.length===11&&d.startsWith('1'))d=d.slice(1);d=d.slice(0,10);if(!d)return '';if(d.length<=3)return d;if(d.length<=6)return `(${d.slice(0,3)}) ${d.slice(3)}`;return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;}
function todayEasternFormatted(){try{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',year:'numeric'}).formatToParts(new Date());const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${map.month}/${map.day}/${map.year}`;}catch{const n=new Date();return `${String(n.getMonth()+1).padStart(2,'0')}/${String(n.getDate()).padStart(2,'0')}/${n.getFullYear()}`;}}
if(form.elements.application_date&&!form.elements.application_date.value){form.elements.application_date.value=todayEasternFormatted();}
form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',e=>{const el=e.target;if(el?.dataset?.format==='date'){const f=formatDateTyping(el.value);if(el.value!==f)el.value=f;}else if(el?.dataset?.format==='phone'){const f=formatPhoneTyping(el.value);if(el.value!==f)el.value=f;}if(Object.keys(signatures).length){signatures={};renderSignatures();document.getElementById('signatureStatus').textContent='Your answers changed. Please sign again after reviewing them.';}update();changed();});
form.addEventListener('blur',e=>{const el=e.target;if(el?.dataset?.format==='date'){const f=normalizeDateBlur(el.value);if(el.value!==f){el.value=f;update();}}else if(el?.dataset?.format==='phone'){const f=formatPhoneTyping(el.value);if(el.value!==f){el.value=f;update();}}},true);
window.addEventListener('beforeunload',e=>{if(dirty&&!document.getElementById('rememberProgress').checked){e.preventDefault();e.returnValue='';}});
document.getElementById('saveDraft').onclick=()=>{requireCover();const fname=`Fox-Chapel-${year}-Saved-Application.json`;downloadBlob(new Blob([JSON.stringify(draft(),null,2)],{type:'application/json'}),fname);dirty=false;status.textContent=`Saved "${fname}" to your Downloads folder. Do not open it on your computer: when returning on another device, click "Open backup file" and choose "${fname}" from Downloads.`;};
function restore(data){const savedYear=data.year||(data.schema==='fcgc-2027-v1'?'2027':null);if(!['fcgc-application-v2','fcgc-2027-v1'].includes(data.schema)||!data.answers||typeof data.answers!=='object')throw new Error('Choose a backup file saved by this application.');if(savedYear!==year)throw new Error(`This backup is for ${savedYear}. The current application is for ${year}. Keep the older file for your records.`);const answers=FCGCAnswers.normalize(data.answers);for(const el of form.elements){if(!el.name)continue;const v=answers[el.name];if(el.type==='checkbox')el.checked=v===true;else if(el.type==='radio')el.checked=el.value===v;else el.value=typeof v==='string'?v.slice(0,el.maxLength>0?el.maxLength:8000):'';if(el.dataset?.format==='date'&&el.value)el.value=normalizeDateBlur(el.value);else if(el.dataset?.format==='phone'&&el.value)el.value=formatPhoneTyping(el.value);}if(form.elements.application_date&&!form.elements.application_date.value){form.elements.application_date.value=todayEasternFormatted();}if(confirmEmailInput){const ce=typeof answers.confirmation_email==='string'?answers.confirmation_email.trim():'';confirmEmailInput.value=ce||form.elements.email?.value||'';confirmEmailCustomized=Boolean(ce&&ce!==(form.elements.email?.value||'').trim());}signatures={};for(const role of ['student','parent']){const sig=answers.signatures?.[role];if(sig&&typeof sig.name==='string'&&sig.name.length<=160&&typeof sig.at==='string'&&Number.isFinite(Date.parse(sig.at))&&(!sig.image||/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig.image)&&sig.image.length<250000))signatures[role]=sig;}document.getElementById('clearAttachments').click();renderSignatures();update();changed();status.textContent='Saved progress restored. Review your answers and re-select your photo and supporting documents before submitting.';}
document.getElementById('loadDraft').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>800000)throw new Error('This backup file is too large.');restore(JSON.parse(await file.text()));}catch(err){status.textContent=err.message;}e.target.value='';};
document.getElementById('rememberProgress').onchange=e=>{if(e.target.checked)remember();else{try{localStorage.removeItem(draftKey);}catch{}if(restoreBanner)restoreBanner.hidden=true;status.textContent='Browser auto-save is off and cleared. Open "Switching computers" below if you want to download a backup file.';}};
document.getElementById('forgetProgress').onclick=()=>{try{localStorage.removeItem(draftKey);}catch{}if(restoreBanner)restoreBanner.hidden=true;status.textContent='Saved progress cleared from this browser. Your currently open answers remain on screen until you close this tab.';};
try{const saved=localStorage.getItem(draftKey);if(saved){const parsed=JSON.parse(saved);const when=parsed?.savedAt&&Number.isFinite(Date.parse(parsed.savedAt))?new Date(parsed.savedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'earlier';if(restoreSummary)restoreSummary.textContent=`Saved progress from ${when} was found in this browser.`;if(restoreBanner)restoreBanner.hidden=false;document.getElementById('restoreProgress').onclick=()=>{try{restore(parsed);document.getElementById('rememberProgress').checked=true;if(restoreBanner)restoreBanner.hidden=true;}catch(e){status.textContent=e.message;}};}}catch{}
const dialog=document.getElementById('signatureDialog'),canvas=document.getElementById('signatureCanvas'),ctx=canvas.getContext('2d');let signingRole='student',drawing=false,drawn=false,lastPoint=null,signatureMode='draw';
function clearPad(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#172938';drawn=false;}
function point(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];}
canvas.addEventListener('pointerdown',e=>{if(signatureMode!=='draw')return;drawing=true;canvas.setPointerCapture(e.pointerId);ctx.beginPath();lastPoint=point(e);ctx.moveTo(...lastPoint);e.preventDefault();});
canvas.addEventListener('pointermove',e=>{if(!drawing)return;const next=point(e);if(!lastPoint||Math.hypot(next[0]-lastPoint[0],next[1]-lastPoint[1])<.5)return;drawn=true;ctx.lineTo(...next);ctx.stroke();lastPoint=next;});
canvas.addEventListener('pointerup',()=>{drawing=false;});canvas.addEventListener('pointercancel',()=>{drawing=false;});
for(const button of document.querySelectorAll('[data-sign]'))button.onclick=()=>{signingRole=button.dataset.sign;document.getElementById('signatureTitle').textContent=signingRole==='student'?'Student Signature':'Parent or Guardian Signature';document.getElementById('signerName').value=signatures[signingRole]?.name||(signingRole==='student'?form.elements.applicant_name.value:'');document.getElementById('signatureConsent').checked=false;document.getElementById('signatureError').textContent='';clearPad();dialog.showModal();document.getElementById('signerName').focus();};
for(const button of document.querySelectorAll('[data-remove-sign]'))button.onclick=()=>{delete signatures[button.dataset.removeSign];renderSignatures();changed();};
document.getElementById('clearSignature').onclick=clearPad;
document.getElementById('cancelSignature').onclick=()=>dialog.close();
for(const input of document.querySelectorAll('[name="signatureMode"]'))input.onchange=()=>{signatureMode=input.value;document.getElementById('drawSignature').hidden=signatureMode!=='draw';document.getElementById('typedSignature').hidden=signatureMode!=='type';document.getElementById('typedSignature').textContent=document.getElementById('signerName').value;};
document.getElementById('signerName').oninput=e=>{document.getElementById('typedSignature').textContent=e.target.value;};
document.getElementById('useSignature').onclick=()=>{const name=document.getElementById('signerName').value.trim();if(!name||!document.getElementById('signatureConsent').checked||signatureMode==='draw'&&!drawn){document.getElementById('signatureError').textContent='Enter your full name, add your signature, and check the consent box.';return;}if(signingRole==='student'&&name.toLocaleLowerCase().replace(/\s+/g,' ')!==form.elements.applicant_name.value.trim().toLocaleLowerCase().replace(/\s+/g,' ')){document.getElementById('signatureError').textContent='Your signature name must match the applicant name in Section 1. Check both before signing.';return;}signatures[signingRole]={name,at:new Date().toISOString(),method:signatureMode,image:signatureMode==='draw'?canvas.toDataURL('image/png'):null};renderSignatures();changed();document.getElementById('signatureStatus').textContent='Signature added. Changes to your answers will require a new signature.';dialog.close();};
window.scholarship={values,cents,totals,moneyNames,makePdf:data=>FCGCPdf.create(data,config,{labels,applicantPhoto:window.FCGCPhoto?.getPreparedPhoto()||null})};
function checkCosts(){if(!form.checkValidity()){form.reportValidity();throw new Error('Check the highlighted field.');}const data=values(),missing=moneyNames.slice(0,3).find(n=>!String(data[n]).trim());if(missing){form.elements[missing].focus();throw new Error('Enter all three full-year costs. Use 0 for a cost that does not apply.');}return data;}
async function prepare(){if(submitted&&prepared)return prepared;requireCover();const data=checkCosts();if(!data.applicant_name.trim())throw new Error('Enter your full name for the personalized cover letter.');if(prepared)return prepared;const revision=answerRevision,files=Array.from(document.getElementById('supportingFiles').files),applicantPhoto=window.FCGCPhoto?.getPreparedPhoto()||null;validateAttachments(files);const bytes=await appendAttachments(await FCGCPdf.create(data,config,{labels,applicantPhoto}),files);if(revision!==answerRevision)throw new Error('Your answers or documents changed while the packet was preparing. Review the updated application again.');prepared={file:new File([bytes],`${year}-Fox-Chapel-Scholarship-Application.pdf`,{type:'application/pdf'}),photoFile:applicantPhoto?.file||null,id:crypto.randomUUID()};return prepared;}
function showDownload(file){if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=URL.createObjectURL(file);const link=document.getElementById('openPdf');link.href=currentUrl;link.download=file.name;document.getElementById('downloadReady').hidden=false;document.getElementById('sharePdf').hidden=!(navigator.canShare&&navigator.canShare({files:[file]}));return link;}
const reviewDialog=document.getElementById('applicationReviewDialog'),reviewFrame=document.getElementById('applicationReviewFrame');
let reviewUrl=null,reviewRequest=0;
function clearReviewPreview(){reviewFrame.removeAttribute('src');document.getElementById('reviewPdfLink').removeAttribute('href');if(reviewUrl){URL.revokeObjectURL(reviewUrl);reviewUrl=null;}}
reviewDialog.addEventListener('close',()=>{reviewRequest++;clearReviewPreview();});
document.getElementById('backToApplication').onclick=()=>{reviewDialog.close();document.getElementById('applicant_name').focus();};
document.getElementById('continueReview').onclick=()=>{reviewDialog.close();document.getElementById('submissionConsent').focus();};
document.getElementById('reviewApplication').onclick=async()=>{const button=document.getElementById('reviewApplication'),message=document.getElementById('reviewStatus'),request=++reviewRequest;button.disabled=true;message.textContent='Preparing your application for review…';try{if(submitted||submitting)throw new Error('This application is already being submitted or has been submitted.');document.getElementById('submissionConsent').checked=false;updateSubmitState();const packet=await prepare();if(request!==reviewRequest)return;clearReviewPreview();reviewUrl=URL.createObjectURL(packet.file);document.getElementById('reviewPdfLink').href=reviewUrl;reviewFrame.src=reviewUrl+'#view=FitH';reviewDialog.showModal();document.getElementById('backToApplication').focus();message.textContent='Review the packet, then return to make changes or continue to final confirmation.';}catch(e){message.textContent=e.message;}finally{button.disabled=submitted||submitting;}};

document.getElementById('supportingFiles').addEventListener('change',changed);
document.getElementById('clearAttachments').addEventListener('click',changed);
window.addEventListener('fcgc-photo-changed',changed);
document.getElementById('download').onclick=async()=>{const button=document.getElementById('download'),message=document.getElementById('downloadStatus');button.disabled=true;try{message.textContent='Preparing your completed PDF…';const p=await prepare();showDownload(p.file).click();dirty=false;message.textContent='Your completed PDF is ready. Downloading does not submit it.';}catch(e){message.textContent=e.message;}finally{button.disabled=false;}};
document.getElementById('sharePdf').onclick=async()=>{if(prepared)try{await navigator.share({files:[prepared.file],title:`${year} Scholarship Application`});}catch(e){if(e.name!=='AbortError')document.getElementById('downloadStatus').textContent='Use the Open / save link to save your PDF.';}};
document.getElementById('submitApplication').onclick=async()=>{const button=document.getElementById('submitApplication'),message=document.getElementById('submitStatus');message.textContent='';if(submitting)return;try{if(submitted)throw new Error('This application has already been submitted and cannot be changed.');const data=checkCosts();if(!data.applicant_name.trim()||!data.email.trim()){form.elements[!data.applicant_name.trim()?'applicant_name':'email'].focus();throw new Error('Enter your name and email address before submitting.');}const confirmEmail=(data.confirmation_email||data.email||'').trim();if(confirmEmailInput&&confirmEmail&&!confirmEmailInput.checkValidity()){confirmEmailInput.focus();throw new Error('Enter a valid confirmation email address.');}if(!/^\d{1,3}$/.test(data.age)||Number(data.age)<1||Number(data.age)>120){form.elements.age.focus();throw new Error('Enter your age so we can check the parent or guardian signature requirement.');}const chosenFiles=Array.from(document.getElementById('supportingFiles').files);if(!chosenFiles.length&&!data.financial_explanation.trim()&&!data.additional_information.trim())throw new Error('Upload your required documents below, or explain unavailable documents in Additional Information before submitting.');if(!signatures.student)throw new Error('Please sign the application in Section 6.');if(Number(data.age)<18&&!signatures.parent)throw new Error('A parent or guardian must sign in Section 6 because the applicant is under 18.');if(!document.getElementById('submissionConsent').checked)throw new Error('Confirm that you reviewed the application and want to send it to the listed recipients.');requireCover();if(!config.canSubmit)throw new Error('Online submission is temporarily unavailable. Save your progress and contact the Foundation.');submitting=true;updateSubmitState();message.textContent='Preparing and sending your signed application…';const p=await prepare(),body=new FormData();body.append('pdf',p.file);if(p.photoFile)body.append('photo',p.photoFile);body.append('submissionId',p.id);body.append('year',year);body.append('revision',config.revision);body.append('name',data.applicant_name);body.append('email',data.email);body.append('confirmationEmail',confirmEmail);body.append('age',data.age);body.append('studentSigned',String(!!signatures.student));body.append('parentSigned',String(!!signatures.parent));body.append('consent','true');body.append('coverLetterAcknowledged','true');body.append('coverLetterVersion',coverVersion);body.append('testApplication',String(!!data.testApplication));body.append('website',document.getElementById('website').value);body.append('token',config.submissionToken||'');const response=await fetch('/api/applications',{method:'POST',body});const result=await response.json();if(!response.ok)throw new Error(result.error||'Submission did not complete. Your answers are still here.');showDownload(p.file);dirty=false;message.textContent=`Application submitted. Reference: ${result.reference}. ${result.confirmationAccepted?`A confirmation email has been sent to ${confirmEmail}.`:'The confirmation email could not be sent; keep this reference and your PDF.'} This does not indicate a scholarship decision.`;lockSubmitted();message.textContent+=' This submitted application is final and cannot be edited.';}catch(e){message.textContent=e.message;}finally{submitting=false;updateSubmitState();}};
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=year);document.querySelectorAll('[data-deadline]').forEach(el=>el.textContent=config.deadline);
if(config.customCoverLetter){for(const id of ['coverLetterPdfLink','reviewCoverLink']){const link=document.getElementById(id);if(link)link.href='/api/cover-letter';}}
document.getElementById('recipients').textContent=config.submissionRecipients.join(', ');
updateSubmitState();
const noticeEl=document.getElementById('emailSetupNotice');
if(config.canSubmit){
  noticeEl.hidden=true;
}else{
  noticeEl.hidden=false;
  if(config.closedReason==='deadline-passed'){
    noticeEl.textContent=config.closedNotice||`The ${year} scholarship application deadline (${config.deadline}) has passed. Online submission is closed.`;
  }else if(config.closedReason==='manually-closed'){
    noticeEl.textContent=config.closedNotice||'Online submissions are currently closed by the Scholarship Foundation. Save your progress and contact the Foundation if you have questions.';
  }
}
// Synchronize ARIA aria-invalid with native :user-invalid only after user interaction.
const touchedFields=new WeakSet();
form.querySelectorAll('input,textarea').forEach(el=>{if(!el.hasAttribute('aria-invalid'))el.setAttribute('aria-invalid','false');});
form.addEventListener('blur',e=>{const el=e.target;if(!el.matches?.('input,textarea')||el.hasAttribute('data-money'))return;touchedFields.add(el);el.setAttribute('aria-invalid',el.matches(':user-invalid')?'true':'false');},true);
form.addEventListener('input',e=>{const el=e.target;if(!el.matches?.('input,textarea')||el.hasAttribute('data-money')||!touchedFields.has(el))return;el.setAttribute('aria-invalid',el.matches(':user-invalid')?'true':'false');});
document.getElementById('loading').hidden=true;document.getElementById('applicationContent').hidden=false;document.title=`${year} Fox Chapel Scholarship Application`;update();renderSignatures();
}
fetch('/api/application',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('The current application settings could not load. Please refresh this page.');return r.json();}).then(startApplication).catch(error=>{document.getElementById('loading').textContent=error.message;});
