'use strict';

const SUPABASE_URL='https://oplujvnyutmxfpdewezb.supabase.co';
const SUPABASE_KEY='sb_publishable_dd1dOvBAwPgA1AeqNOQHDg_Wdjvf-ze';
const token=new URLSearchParams(window.location.search).get('token')||'';

const byId=id=>document.getElementById(id);
const show=(id,visible=true)=>byId(id)?.classList.toggle('hidden',!visible);

async function rpc(name,payload){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
    method:'POST',
    mode:'cors',
    credentials:'omit',
    cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${SUPABASE_KEY}`,
      'Content-Type':'application/json',
      Accept:'application/json'
    },
    body:JSON.stringify(payload)
  });

  let data=null;
  const text=await response.text();
  if(text){
    try{data=JSON.parse(text);}
    catch(error){data=text;}
  }

  if(!response.ok){
    const message=data?.message||data?.hint||'De melding kon niet worden verwerkt.';
    throw new Error(message);
  }
  return data;
}

async function loadPortal(){
  if(!token||token.length>80){
    show('reportLoading',false);
    show('reportInvalid',true);
    return;
  }

  try{
    const rows=await rpc('get_property_issue_portal',{p_token:token});
    const portal=Array.isArray(rows)?rows[0]:rows;
    if(!portal){
      show('reportLoading',false);
      show('reportInvalid',true);
      return;
    }

    const address=[portal.address_line,portal.postal_city].filter(Boolean).join(' · ');
    byId('reportProperty').textContent=[portal.object_name,address].filter(Boolean).join(' — ');
    show('reportLoading',false);
    show('issueReportForm',true);
  }catch(error){
    console.error(error);
    show('reportLoading',false);
    show('reportInvalid',true);
  }
}

async function submitIssue(event){
  event.preventDefault();
  const button=byId('issueSubmitBtn');
  const message=byId('issueFormMessage');
  message.textContent='';

  const description=byId('issueDescription').value.trim();
  if(description.length<10){
    message.textContent='Beschrijf de melding in minimaal 10 tekens.';
    byId('issueDescription').focus();
    return;
  }
  if(!byId('issuePrivacy').checked){
    message.textContent='Bevestig dat de contactgegevens voor de afhandeling gebruikt mogen worden.';
    return;
  }

  button.disabled=true;
  button.textContent='Melding wordt verstuurd…';

  try{
    const reportId=await rpc('submit_property_issue',{
      p_token:token,
      p_category:byId('issueCategory').value,
      p_description:description,
      p_urgency:byId('issueUrgency').value,
      p_reporter_name:byId('issueReporterName').value.trim()||null,
      p_email:byId('issueEmail').value.trim()||null,
      p_phone:byId('issuePhone').value.trim()||null,
      p_availability:byId('issueAvailability').value.trim()||null,
      p_privacy_accepted:true,
      p_honeypot:byId('issueWebsite').value
    });

    const value=Array.isArray(reportId)?reportId[0]:reportId;
    byId('reportReference').textContent=String(value||'').replaceAll('"','').slice(0,8).toUpperCase()||'AANGEMAAKT';
    show('issueReportForm',false);
    show('reportSuccess',true);
  }catch(error){
    console.error(error);
    message.textContent=error.message||'De melding kon niet worden verstuurd. Probeer het later opnieuw.';
  }finally{
    button.disabled=false;
    button.textContent='Melding versturen';
  }
}

byId('issueReportForm')?.addEventListener('submit',submitIssue);
loadPortal();
