require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/,'');
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const APPLICATION_FROM_EMAIL = process.env.APPLICATION_FROM_EMAIL || '';

function escHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
async function sendApplicationConfirmation(d,result){
  if(!RESEND_API_KEY || !APPLICATION_FROM_EMAIL || !d.email) return {sent:false,reason:'email_not_configured'};
  const rows=[
    ['Name',d.name],['Email',d.email],['Phone',d.phone],['ZIP code',d.zip],['Age',d.age],
    ['Years licensed',d.yearsLicensed],['Valid driver license',d.licenseValid],['Recent license suspension',d.suspended],
    ['Recent DUI/reckless driving',d.dui],['Recent at-fault accidents',d.accidents],['Gig platform',d.platform],
    ['Platform approval status',d.platformApproved],['Weekly vehicle budget',d.budget?('

const AT = {
  base: process.env.AIRTABLE_BASE_ID,
  applicants: process.env.AIRTABLE_APPLICANTS_TABLE,
  vehicles: process.env.AIRTABLE_VEHICLES_TABLE,
  rentals: process.env.AIRTABLE_RENTALS_TABLE,
  token: process.env.AIRTABLE_TOKEN,
};
const AUTO_SEED_FLEET = (process.env.AUTO_SEED_FLEET || 'true').toLowerCase() !== 'false';

async function atFetch(table, suffix='', opts={}) {
  if (!AT.token || !AT.base || !table) throw new Error('Airtable is not configured');
  const url = `https://api.airtable.com/v0/${AT.base}/${table}${suffix}`;
  const r = await fetch(url, {
    ...opts,
    headers: {Authorization:`Bearer ${AT.token}`,'Content-Type':'application/json',...(opts.headers||{})}
  });
  const body = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(body?.error?.message || body?.error?.type || `Airtable ${r.status}`);
  return body;
}
async function createRecord(table, fields){
  const b=await atFetch(table,'',{method:'POST',body:JSON.stringify({records:[{fields}],typecast:true})});
  return b.records[0];
}
async function patchRecord(table,id,fields){
  return atFetch(table,`/${id}`,{method:'PATCH',body:JSON.stringify({fields,typecast:true})});
}
async function getRecord(table,id){ return atFetch(table,`/${id}`); }

async function listVehicles(){
  const b = await atFetch(AT.vehicles,'?pageSize=100');
  return b.records || [];
}
async function seedFleetIfEmpty(records){
  if(records.length || !AUTO_SEED_FLEET) return records;
  const starters=[
    {Vehicle:'2017 Ford Fusion',Year:2017,Make:'Ford',Model:'Fusion','Vehicle Class':'Standard','Weekly Rate':329,Deposit:500,Status:'Available',Notes:'Starter inventory record. Replace with exact VIN, mileage, insurance and real photos before production handoff.'},
    {Vehicle:'2018 Ford Fusion',Year:2018,Make:'Ford',Model:'Fusion','Vehicle Class':'Standard','Weekly Rate':329,Deposit:500,Status:'Available',Notes:'Starter inventory record. Replace with exact VIN, mileage, insurance and real photos before production handoff.'},
    {Vehicle:'2017 Honda Accord',Year:2017,Make:'Honda',Model:'Accord','Vehicle Class':'Standard+','Weekly Rate':349,Deposit:500,Status:'Available',Notes:'Starter inventory record. Replace with exact VIN, mileage, insurance and real photos before production handoff.'},
  ];
  const made=[];
  for(const fields of starters) made.push(await createRecord(AT.vehicles,fields));
  return made;
}
function releaseExpiredHold(v){
  const until=v.fields['Hold Until'];
  return v.fields.Status==='Reserved' && until && new Date(until).getTime() < Date.now();
}
async function normalizeExpiredHolds(records){
  for(const v of records){
    if(releaseExpiredHold(v)){
      await patchRecord(AT.vehicles,v.id,{'Status':'Available','Hold Applicant':'','Hold Until':null});
      v.fields.Status='Available'; v.fields['Hold Applicant']=''; v.fields['Hold Until']=null;
    }
  }
}
function safeVehicle(v){
  const f=v.fields;
  const fallback={
    '2017 Ford Fusion':'/ford-fusion-2017.png',
    '2018 Ford Fusion':'/ford-fusion-2018.png',
    '2017 Honda Accord':'/honda-accord-2017.png'
  };
  const name=f.Vehicle||`${f.Year||''} ${f.Make||''} ${f.Model||''}`.trim();
  return {
    id:v.id,name,year:f.Year,make:f.Make,model:f.Model,class:f['Vehicle Class']||'Standard',
    rate:Number(f['Weekly Rate']||0),deposit:Number(f.Deposit||500),status:f.Status,
    photo:f['Vehicle Photos']?.[0]?.url || fallback[name] || null
  };
}
function assess(d){
  let score=0, reasons=[];
  const age=Number(d.age||0), years=Number(d.yearsLicensed||0), budget=Number(d.budget||0);
  if(d.licenseValid===true || d.licenseValid==='yes') score+=3; else reasons.push('Valid license required');
  if(age>=21) score+=2; else reasons.push('Applicant is under 21');
  if(years>=2) score+=2; else if(years>=1) score+=1; else reasons.push('Limited licensing history');
  if(d.suspended===true || d.suspended==='yes') {score-=6; reasons.push('License suspension requires review');}
  if(d.dui===true || d.dui==='yes') {score-=5; reasons.push('DUI/reckless history requires review');}
  if(Number(d.accidents||0)>=3){score-=3; reasons.push('Multiple recent accidents require review');}
  if(budget>=329) score+=2; else if(budget>=279) score+=1; else reasons.push('Weekly budget is below current rates');
  if(d.platformApproved===true || d.platformApproved==='yes') score+=1;
  let status='Conditional Review', tier='Manual Review';
  if(score>=8 && !reasons.some(x=>x.includes('required'))) {
    status='Prequalified';
    if(budget>=425) tier='Comfort / XL';
    else if(budget>=349) tier='Hybrid';
    else if(budget>=299) tier='Standard';
    else tier='Economy';
  }
  if(score<=2 || !(d.licenseValid===true || d.licenseValid==='yes')) {status='Not Eligible';tier='Manual Review';}
  return {score,status,tier,reasons};
}
async function authenticateApplicant(applicantId, token){
  if(!applicantId || !token) throw Object.assign(new Error('Applicant session is missing. Please complete eligibility again.'),{status:401});
  const applicant=await getRecord(AT.applicants,applicantId);
  if(token!==applicant.fields['Portal Token']) throw Object.assign(new Error('Invalid applicant session.'),{status:403});
  return applicant;
}
async function verifyRentalOwnership(rentalId, applicantId){
  const rental=await getRecord(AT.rentals,rentalId);
  if(rental.fields['Applicant Record ID']!==applicantId) throw Object.assign(new Error('Rental does not match applicant.'),{status:403});
  return rental;
}
function sendError(res,e){
  console.error(e);
  res.status(e.status||500).json({error:e.message||'Unexpected server error'});
}

// Stripe webhook must be before express.json
app.post('/api/stripe/webhook', express.raw({type:'application/json'}), async (req,res)=>{
  if(!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Webhook not configured');
  let event;
  try{ event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET); }
  catch(e){ return res.status(400).send(`Webhook error: ${e.message}`); }

  try{
    if(event.type==='identity.verification_session.verified'){
      const s=event.data.object;
      if(s.metadata.applicantId) await patchRecord(AT.applicants,s.metadata.applicantId,{'Stripe Identity Session ID':s.id,'Prequal Status':'Documents Required'});
      if(s.metadata.rentalId) await patchRecord(AT.rentals,s.metadata.rentalId,{'Status':'Agreement Pending'});
    }
    if(event.type==='checkout.session.completed'){
      const s=event.data.object;
      if(s.metadata.rentalId) await patchRecord(AT.rentals,s.metadata.rentalId,{'Status':'Pickup Pending','Stripe Checkout Session ID':s.id,'Stripe Subscription ID':String(s.subscription||'')});
      if(s.metadata.applicantId) await patchRecord(AT.applicants,s.metadata.applicantId,{'Prequal Status':'Approved','Stripe Customer ID':String(s.customer||''),'Stripe Subscription ID':String(s.subscription||'')});
      if(s.metadata.vehicleId) await patchRecord(AT.vehicles,s.metadata.vehicleId,{'Status':'Reserved','Current Driver':s.metadata.applicantName||'','Hold Until':null});
    }
    if(event.type==='invoice.payment_failed' || event.type==='invoice.paid'){
      const inv=event.data.object;
      const sub=String(inv.subscription||'');
      if(sub){
        const b=await atFetch(AT.rentals,`?filterByFormula=${encodeURIComponent(`{Stripe Subscription ID}="${sub}"`)}`);
        if(b.records?.[0]){
          if(event.type==='invoice.payment_failed') await patchRecord(AT.rentals,b.records[0].id,{'Status':'Past Due'});
          if(event.type==='invoice.paid' && b.records[0].fields.Status==='Past Due') await patchRecord(AT.rentals,b.records[0].id,{'Status':'Active'});
        }
      }
    }
  }catch(e){ console.error('Webhook handling:',e); }
  res.json({received:true});
});

app.use(express.json({limit:'1mb'}));
app.use((req,res,next)=>{
  if(req.path.endsWith('.html') || req.path.startsWith('/api/') || req.path==='/health'){
    res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma','no-cache');
    res.set('Expires','0');
  }
  next();
});
app.use(express.static(__dirname,{etag:true,maxAge:'1h'}));

app.post('/api/prequal',async(req,res)=>{
  try{
    const d=req.body||{};
    const clean=v=>typeof v==='string'?v.trim():v;
    const yes=v=>v===true || String(v).toLowerCase()==='yes';
    const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
    const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(clean(v)||'')?clean(v):null;
    const name=clean(d.name),email=clean(d.email),phone=clean(d.phone);
    if(!name||!email||!phone) return res.status(400).json({error:'Please enter your name, email and phone number.'});
    const result=assess(d),token=crypto.randomBytes(24).toString('hex');
    const fields={'Applicant Name':name,'Email':email,'Phone':phone,'License Valid':yes(d.licenseValid),'Already Platform Approved':yes(d.platformApproved),'Prequal Status':result.status,'Qualified Tier':result.tier,'Risk Notes':`Score ${result.score}. ${result.reasons.join('; ')}`,'Lead Source':'Website','Portal Token':token};
    const optional={'ZIP Code':clean(d.zip),'Age':num(d.age),'Years Licensed':num(d.yearsLicensed),'Gig Platforms':clean(d.platform) ? [clean(d.platform)] : [],'Weekly Budget':num(d.budget),'Deposit Available':num(d.deposit),'Desired Start Date':validDate(d.startDate),'Hours Planned Per Week':num(d.hours)};
    for(const [k,v] of Object.entries(optional)) if(v!==null&&v!==undefined&&v!=='') fields[k]=v;
    let rec;
    try{rec=await createRecord(AT.applicants,fields)}
    catch(err){console.error('Airtable applicant validation:',err);return res.status(422).json({error:'We could not save your eligibility application. Please check the information entered and try again.',code:'AIRTABLE_VALIDATION'});}
    let confirmationEmailSent=false; try{const mail=await sendApplicationConfirmation({...d,name,email,phone},result);confirmationEmailSent=mail.sent;}catch(mailErr){console.error('Application confirmation email:',mailErr.message)}
    res.json({ok:true,applicantId:rec.id,portalToken:token,name,email,phone,status:result.status,eligibilityStatus:result.status,score:result.score,tier:result.tier,reasons:result.reasons,confirmationEmailSent});
  }catch(e){sendError(res,e)}
});

app.post('/api/waitlist',async(req,res)=>{
 try{
  const {applicantId,portalToken}=req.body||{};
  const a=await authenticateApplicant(applicantId,portalToken);
  const currentStatus=a.fields['Prequal Status'];
  if(!['Not Eligible','Conditional Review','Documents Required','New Lead','Waitlist','Prequalified'].includes(currentStatus)) return res.status(409).json({error:'This application is already progressing.'});
  const due=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  // Preserve Prequalified so a qualified driver can still reserve an Available vehicle.
  const applicantUpdate={'Next Follow-Up':due};
  if(currentStatus!=='Prequalified') applicantUpdate['Prequal Status']='Waitlist';
  await patchRecord(AT.applicants,applicantId,applicantUpdate);
  if(process.env.AIRTABLE_FOLLOWUPS_TABLE) try{
   await createRecord(process.env.AIRTABLE_FOLLOWUPS_TABLE,{'Follow-Up':`Waitlist re-screen - ${a.fields['Applicant Name']||'Applicant'}`,'Applicant':a.fields['Applicant Name']||'','Phone / Email':[a.fields.Phone,a.fields.Email].filter(Boolean).join(' / '),'Due Date':due,'Type':'Call','Status':'Open','Notes':`Re-screen eligibility. ${a.fields['Risk Notes']||''}`});
  }catch(x){console.error('Follow-up record:',x.message)}
  res.json({ok:true,status:currentStatus==='Prequalified'?'Prequalified':'Waitlist',inventoryWaitlist:true,followUp:due});
 }catch(e){sendError(res,e)}
});

app.get('/api/vehicles',async(req,res)=>{
  try{
    let records=await listVehicles();
    records=await seedFleetIfEmpty(records);
    await normalizeExpiredHolds(records);
    const visible=records.filter(v=>['Available','Coming Soon'].includes(v.fields.Status)).map(safeVehicle);
    res.json({vehicles:visible});
  }catch(e){sendError(res,e)}
});

app.post('/api/vehicle-hold',async(req,res)=>{
  try{
    const {applicantId,portalToken,vehicleId}=req.body||{};
    const applicant=await authenticateApplicant(applicantId,portalToken);
    if(applicant.fields['Prequal Status']!=='Prequalified') return res.status(403).json({error:'Applicant must be prequalified before reserving a vehicle.'});
    if(!vehicleId) return res.status(400).json({error:'Vehicle is required.'});
    const vehicle=await getRecord(AT.vehicles,vehicleId);
    if(releaseExpiredHold(vehicle)) await patchRecord(AT.vehicles,vehicleId,{'Status':'Available','Hold Applicant':'','Hold Until':null});
    const fresh=await getRecord(AT.vehicles,vehicleId);
    if(fresh.fields.Status!=='Available') return res.status(409).json({error:'This vehicle is no longer available. Please choose another.'});

    const holdUntil=new Date(Date.now()+30*60*1000).toISOString();
    await patchRecord(AT.vehicles,vehicleId,{'Status':'Reserved','Hold Applicant':applicantId,'Hold Until':holdUntil});
    const rental=await createRecord(AT.rentals,{
      'Rental':`${applicant.fields['Applicant Name']} - ${fresh.fields.Vehicle}`,
      'Applicant Record ID':applicantId,'Vehicle Record ID':vehicleId,'Applicant Name':applicant.fields['Applicant Name'],
      'Vehicle':fresh.fields.Vehicle,'Weekly Rate':Number(fresh.fields['Weekly Rate']||0),'Status':'KYC Pending','Hold Until':holdUntil
    });
    await patchRecord(AT.applicants,applicantId,{'Prequal Status':'Vehicle Offered','Assigned Vehicle':fresh.fields.Vehicle});
    res.json({ok:true,rentalId:rental.id,holdUntil,vehicle:safeVehicle(fresh)});
  }catch(e){sendError(res,e)}
});

app.post('/api/stripe/identity-session',async(req,res)=>{
  try{
    if(!stripe) return res.status(503).json({error:'Stripe is not configured. Add STRIPE_SECRET_KEY in Render.'});
    const {applicantId,portalToken,rentalId}=req.body||{};
    const applicant=await authenticateApplicant(applicantId,portalToken);
    const rental=await verifyRentalOwnership(rentalId,applicantId);
    if(!['KYC Pending','Agreement Pending'].includes(rental.fields.Status)) return res.status(409).json({error:`Identity verification cannot start from rental status ${rental.fields.Status}.`});
    const session=await stripe.identity.verificationSessions.create({
      type:'document',
      options:{document:{require_matching_selfie:true}},
      metadata:{applicantId,rentalId},
      return_url:`${BASE_URL}/agreement.html?applicantId=${encodeURIComponent(applicantId)}&rentalId=${encodeURIComponent(rentalId)}&token=${encodeURIComponent(portalToken)}`
    });
    await patchRecord(AT.applicants,applicantId,{'Stripe Identity Session ID':session.id,'Prequal Status':'Documents Required'});
    res.json({url:session.url,id:session.id});
  }catch(e){sendError(res,e)}
});

app.get('/api/stripe/identity-status',async(req,res)=>{
  try{
    if(!stripe) return res.status(503).json({error:'Stripe not configured'});
    const {applicantId,token}=req.query;
    const applicant=await authenticateApplicant(applicantId,token);
    const id=applicant.fields['Stripe Identity Session ID'];
    if(!id) return res.json({status:'requires_input'});
    const s=await stripe.identity.verificationSessions.retrieve(id);
    res.json({status:s.status});
  }catch(e){sendError(res,e)}
});

app.post('/api/agreement',async(req,res)=>{
  try{
    const {applicantId,portalToken,rentalId,typedName,accepted}=req.body||{};
    await authenticateApplicant(applicantId,portalToken);
    const rental=await verifyRentalOwnership(rentalId,applicantId);
    if(!accepted || !typedName?.trim()) return res.status(400).json({error:'Agreement acceptance and typed name are required.'});
    if(!stripe) return res.status(503).json({error:'Stripe is not configured.'});
    const applicant=await getRecord(AT.applicants,applicantId);
    const identityId=applicant.fields['Stripe Identity Session ID'];
    if(!identityId) return res.status(403).json({error:'Identity verification is required.'});
    const identity=await stripe.identity.verificationSessions.retrieve(identityId);
    if(identity.status!=='verified') return res.status(403).json({error:'Identity verification is not complete.'});
    const now=new Date().toISOString();
    await patchRecord(AT.rentals,rentalId,{
      'Agreement Accepted':true,'Agreement Accepted At':now,'Status':'Payment Pending',
      'Notes':`Electronic acceptance by ${typedName.trim()}; applicant record ${applicantId}; accepted ${now}.`
    });
    res.json({ok:true});
  }catch(e){sendError(res,e)}
});

app.post('/api/stripe/checkout-session',async(req,res)=>{
  try{
    if(!stripe) return res.status(503).json({error:'Stripe is not configured.'});
    const {applicantId,portalToken,rentalId}=req.body||{};
    const applicant=await authenticateApplicant(applicantId,portalToken);
    const rental=await verifyRentalOwnership(rentalId,applicantId);
    if(!rental.fields['Agreement Accepted']) return res.status(403).json({error:'Rental agreement must be accepted first.'});
    const vehicle=await getRecord(AT.vehicles,rental.fields['Vehicle Record ID']);
    const identityId=applicant.fields['Stripe Identity Session ID'];
    if(!identityId) return res.status(403).json({error:'Identity verification is required.'});
    const identity=await stripe.identity.verificationSessions.retrieve(identityId);
    if(identity.status!=='verified') return res.status(403).json({error:'Identity verification is not complete.'});
    const rate=Number(vehicle.fields['Weekly Rate']||0);
    const deposit=Number(vehicle.fields.Deposit||0);
    if(rate<=0) return res.status(400).json({error:'Vehicle weekly rate is not configured.'});

    const line_items=[{
      price_data:{currency:'usd',product_data:{name:`${vehicle.fields.Vehicle} Weekly Rental`},unit_amount:Math.round(rate*100),recurring:{interval:'week'}},
      quantity:1
    }];
    // Deposit is intentionally not charged automatically here. Add it as a separate
    // one-time Checkout line only after confirming the final rental/deposit policy.

    const session=await stripe.checkout.sessions.create({
      mode:'subscription',
      customer_email:applicant.fields.Email||undefined,
      billing_address_collection:'required',
      phone_number_collection:{enabled:true},
      line_items,
      metadata:{applicantId,rentalId,vehicleId:vehicle.id,applicantName:applicant.fields['Applicant Name']||''},
      subscription_data:{metadata:{applicantId,rentalId,vehicleId:vehicle.id}},
      success_url:`${BASE_URL}/schedule.html?session_id={CHECKOUT_SESSION_ID}&applicantId=${encodeURIComponent(applicantId)}&rentalId=${encodeURIComponent(rentalId)}&token=${encodeURIComponent(portalToken)}`,
      cancel_url:`${BASE_URL}/agreement.html?applicantId=${encodeURIComponent(applicantId)}&rentalId=${encodeURIComponent(rentalId)}&token=${encodeURIComponent(portalToken)}&payment=cancelled`
    });
    await patchRecord(AT.rentals,rentalId,{'Stripe Checkout Session ID':session.id});
    res.json({url:session.url});
  }catch(e){sendError(res,e)}
});

async function reconcileCheckout(sessionId, applicantId, rentalId){
  if(!stripe || !sessionId) return null;
  const s=await stripe.checkout.sessions.retrieve(sessionId);
  if(s.metadata?.applicantId!==applicantId || s.metadata?.rentalId!==rentalId) throw Object.assign(new Error('Checkout session does not match this rental.'),{status:403});
  if(s.status==='complete'){
    await patchRecord(AT.rentals,rentalId,{'Status':'Pickup Pending','Stripe Checkout Session ID':s.id,'Stripe Subscription ID':String(s.subscription||'')});
    await patchRecord(AT.applicants,applicantId,{'Prequal Status':'Approved','Stripe Customer ID':String(s.customer||''),'Stripe Subscription ID':String(s.subscription||'')});
    const rental=await getRecord(AT.rentals,rentalId);
    if(rental.fields['Vehicle Record ID']) await patchRecord(AT.vehicles,rental.fields['Vehicle Record ID'],{'Status':'Reserved','Current Driver':(await getRecord(AT.applicants,applicantId)).fields['Applicant Name']||'','Hold Until':null});
  }
  return s;
}
app.get('/api/checkout-status',async(req,res)=>{
  try{
    const {applicantId,token,rentalId,session_id}=req.query;
    await authenticateApplicant(applicantId,token);
    await verifyRentalOwnership(rentalId,applicantId);
    const s=await reconcileCheckout(session_id,applicantId,rentalId);
    const rental=await getRecord(AT.rentals,rentalId);
    res.json({checkoutStatus:s?.status||null,paymentStatus:s?.payment_status||null,rentalStatus:rental.fields.Status});
  }catch(e){sendError(res,e)}
});

app.post('/api/schedule-pickup',async(req,res)=>{
  try{
    const {applicantId,portalToken,rentalId,date,window,sessionId}=req.body||{};
    await authenticateApplicant(applicantId,portalToken);
    let rental=await verifyRentalOwnership(rentalId,applicantId);
    if(sessionId && !['Pickup Pending','Active'].includes(rental.fields.Status)){
      await reconcileCheckout(sessionId,applicantId,rentalId);
      rental=await getRecord(AT.rentals,rentalId);
    }
    if(!date||!window) return res.status(400).json({error:'Pickup date and window are required.'});
    if(!['Pickup Pending','Active'].includes(rental.fields.Status)) return res.status(403).json({error:'Payment confirmation is required before scheduling pickup.'});
    await patchRecord(AT.rentals,rentalId,{'Pickup Date':date,'Pickup Window':window,'Status':'Pickup Pending'});
    res.json({ok:true});
  }catch(e){sendError(res,e)}
});

app.get('/api/dashboard',async(req,res)=>{
  try{
    const {applicantId,token}=req.query;
    const applicant=await authenticateApplicant(applicantId,token);
    const b=await atFetch(AT.rentals,`?filterByFormula=${encodeURIComponent(`{Applicant Record ID}="${applicantId}"`)}`);
    res.json({
      applicant:{name:applicant.fields['Applicant Name'],status:applicant.fields['Prequal Status'],tier:applicant.fields['Qualified Tier'],hasStripeCustomer:!!applicant.fields['Stripe Customer ID']},
      rentals:(b.records||[]).map(r=>({id:r.id,...r.fields}))
    });
  }catch(e){sendError(res,e)}
});

app.post('/api/stripe/billing-portal',async(req,res)=>{
  try{
    if(!stripe) return res.status(503).json({error:'Stripe is not configured.'});
    const {applicantId,portalToken}=req.body||{};
    const applicant=await authenticateApplicant(applicantId,portalToken);
    const customer=applicant.fields['Stripe Customer ID'];
    if(!customer) return res.status(400).json({error:'No Stripe customer is connected to this driver yet.'});
    const session=await stripe.billingPortal.sessions.create({customer,return_url:`${BASE_URL}/dashboard.html?applicantId=${encodeURIComponent(applicantId)}&token=${encodeURIComponent(portalToken)}`});
    res.json({url:session.url});
  }catch(e){sendError(res,e)}
});


// TEMPORARY SAFE AIRTABLE DIAGNOSTIC — no token or applicant data is returned.
app.get('/api/airtable-diagnostic', async (req,res)=>{
  const out={configured:{token:!!AT.token,base:!!AT.base,applicants:!!AT.applicants},tests:{}};
  async function probe(url,opts={}){
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const r=await fetch(url,{...opts,signal:controller.signal,headers:{Authorization:`Bearer ${AT.token}`,'Content-Type':'application/json',...(opts.headers||{})}});
      const b=await r.json().catch(()=>({}));
      return {ok:r.ok,http:r.status,code:b?.error?.type||null,message:b?.error?.message||null};
    }catch(e){return {ok:false,http:null,code:e.name==='AbortError'?'TIMEOUT':'NETWORK_ERROR',message:e.name==='AbortError'?'Timed out':e.message}}
    finally{clearTimeout(timeout)}
  }
  out.tests.baseMetadata=await probe(`https://api.airtable.com/v0/meta/bases/${AT.base}/tables`);
  out.tests.applicantsRead=await probe(`https://api.airtable.com/v0/${AT.base}/${AT.applicants}?maxRecords=1`);
  out.tests.applicantsWriteAuthorization=await probe(`https://api.airtable.com/v0/${AT.base}/${AT.applicants}`,{
    method:'POST',body:JSON.stringify({records:[{fields:{"__GigReady_Diagnostic_Nonexistent_Field__":"x"}}]})
  });
  console.log('[AIRTABLE DIAGNOSTIC]',JSON.stringify(out));
  res.set('Cache-Control','no-store'); res.json(out);
});

app.get('/health',(req,res)=>res.json({
  ok:true,
  stripe:!!stripe,
  airtable:!!(AT.token&&AT.base&&AT.applicants&&AT.vehicles&&AT.rentals),
  autoSeedFleet:AUTO_SEED_FLEET
}));

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`GigReady listening on ${PORT}`));
