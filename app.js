const SUPABASE_URL = 'https://oplujvnyutmxfpdewezb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dd1dOvBAwPgA1AeqNOQHDg_Wdjvf-ze';

let sb, query = '', notificationTypeFilter = '', taskStatusFilter = 'open', taskPriorityFilter = '', taskObjectFilter = '', taskDateFilter = '', tenantReportStatusFilter = 'open', tenantReportUrgencyFilter = '', tenantReportObjectFilter = '', dataCheckStatusFilter = 'incomplete', dataCheckGroupFilter = '', objectCityFilter = '', objectTypeFilter = '', objectStatusFilter = '', objectOccupancyFilter = '', contractStateFilter = '', contractDurationFilter = '', contractNoticeFilter = '', contractCityFilter = '', maintenanceTypeFilter = '', maintenanceStatusFilter = '', maintenanceObjectFilter = '', inspectionTypeFilter = '', inspectionStatusFilter = '', inspectionObjectFilter = '', vastgoedData = [], rawProperties = [], rawContracts = [], rawTenants = [], rawMaintenance = [], rawDocuments = [], rawMaintenanceHistory = [], rawInspections = [], rawTasks = [], tasksReady = true, rawIssuePortals = [], issuePortalsReady = true, rawTenantIssueReports = [], tenantIssueReportsReady = true, activeIssueQrPropertyId = null, rawDataCheckOverrides = [], dataCheckOverridesReady = true, selectedPropertyId = null;
let activeTenantReportId=null;
let rawDashboardNotificationStates=[];
let dashboardNotificationStateReady=true;
let notificationCenterAutoHandled=false;
let notificationCenterScope='all';
let notificationCenterFilter='all';
let notificationCenterAutoKeys=new Set();
let updateContractStickyHeader = () => {};
const euro = n => new Intl.NumberFormat('nl-NL', {style:'currency', currency:'EUR', maximumFractionDigits:0}).format(Number(n || 0));
const dateFmt = s => {
  if(!s) return '-';
  const match=String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(match) return `${Number(match[3])}-${Number(match[2])}-${match[1]}`;
  const date=new Date(s);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('nl-NL');
};
const maintenanceDateFmt = s => {
  if(!s) return '-';
  const match=String(s).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  let date;
  if(match){
    date=new Date(Date.UTC(Number(match[1]), Number(match[2])-1, 1));
  } else {
    date=new Date(s);
  }
  if(Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('nl-NL', {
    month:'long',
    year:'numeric',
    timeZone:'UTC'
  }).format(date);
};
const statusBadge = st => `<span class="badge ${st[1]}">${st[0]}</span>`;
const pct = n => Number.isFinite(Number(n)) ? `${Number(n).toFixed(1).replace('.', ',')}%` : '-';
const clean = s => String(s || '').trim();
const norm = s => String(s || '').toLowerCase().replace(/\s+/g,' ').trim();
function compareObjectAddress(a,b){
  const streetCompare=String(a.straatnaam||a.address||'').localeCompare(
    String(b.straatnaam||b.address||''),
    'nl',
    {sensitivity:'base', numeric:true}
  );
  if(streetCompare!==0) return streetCompare;

  return String(a.huisnummer||a.house_number||'').localeCompare(
    String(b.huisnummer||b.house_number||''),
    'nl',
    {sensitivity:'base', numeric:true}
  );
}
const el = id => document.getElementById(id);
const signedPhotoCache = {};
const safeFileName = name => String(name || 'bestand').replace(/[^a-zA-Z0-9._-]/g, '_');
const isExternalUrl = value => /^https?:\/\//i.test(String(value || ''));
const escAttr = value => String(value || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escHtml = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');


/* v39: strengere sessiebeveiliging */
const REMEMBER_LOGIN_KEY='vastgoedRememberLogin';
const SESSION_STARTED_KEY='vastgoedSessionStartedAt';
const SESSION_LAST_ACTIVITY_KEY='vastgoedSessionLastActivityAt';
const SESSION_HIDDEN_AT_KEY='vastgoedSessionHiddenAt';
const INACTIVITY_TIMEOUT_MS=30*60*1000;
const MAX_SESSION_DURATION_MS=8*60*60*1000;
const BACKGROUND_TIMEOUT_MS=15*60*1000;
let sessionSecurityTimer=null;
let sessionSecurityActive=false;
let sessionLogoutInProgress=false;
let lastActivityWrite=0;

function rememberLoginEnabled(){
  try{return localStorage.getItem(REMEMBER_LOGIN_KEY)==='true';}
  catch(error){return false;}
}
function sessionMetaStorage(){return rememberLoginEnabled()?localStorage:sessionStorage;}
function setSessionMeta(key,value){
  try{
    const target=sessionMetaStorage();
    const other=target===localStorage?sessionStorage:localStorage;
    target.setItem(key,String(value));
    other.removeItem(key);
  }catch(error){console.warn('Sessiebeveiliging kon niet worden opgeslagen:',error.message);}
}
function getSessionMeta(key){
  try{return sessionMetaStorage().getItem(key);}
  catch(error){return null;}
}
function clearSessionMeta(){
  [localStorage,sessionStorage].forEach(storage=>{
    try{
      storage.removeItem(SESSION_STARTED_KEY);
      storage.removeItem(SESSION_LAST_ACTIVITY_KEY);
      storage.removeItem(SESSION_HIDDEN_AT_KEY);
    }catch(error){}
  });
}
function clearPersistedSupabaseSession(){
  try{
    Object.keys(localStorage).forEach(key=>{
      if((key.startsWith('sb-')&&key.includes('auth-token'))||key.includes('code-verifier')) localStorage.removeItem(key);
    });
  }catch(error){console.warn('Oude login kon niet lokaal worden opgeschoond:',error.message);}
}
const secureAuthStorage={
  getItem(key){
    try{return (rememberLoginEnabled()?localStorage:sessionStorage).getItem(key);}
    catch(error){return null;}
  },
  setItem(key,value){
    try{
      const target=rememberLoginEnabled()?localStorage:sessionStorage;
      const other=target===localStorage?sessionStorage:localStorage;
      target.setItem(key,value);
      other.removeItem(key);
    }catch(error){console.warn('Login kon niet veilig worden opgeslagen:',error.message);}
  },
  removeItem(key){
    try{localStorage.removeItem(key);}catch(error){}
    try{sessionStorage.removeItem(key);}catch(error){}
  }
};
function recordUserActivity(force=false){
  if(!sessionSecurityActive||document.hidden) return;
  const now=Date.now();
  if(!force&&now-lastActivityWrite<30_000) return;
  lastActivityWrite=now;
  setSessionMeta(SESSION_LAST_ACTIVITY_KEY,now);
}
function initializeSessionSecurity(session,{freshLogin=false}={}){
  if(!session) return;
  const now=Date.now();
  let started=Number(getSessionMeta(SESSION_STARTED_KEY));
  if(freshLogin||!Number.isFinite(started)||started<=0){
    const fallback=Date.parse(session.user?.last_sign_in_at||'');
    started=Number.isFinite(fallback)?fallback:now;
    setSessionMeta(SESSION_STARTED_KEY,started);
  }
  if(!Number(getSessionMeta(SESSION_LAST_ACTIVITY_KEY))) setSessionMeta(SESSION_LAST_ACTIVITY_KEY,now);
  sessionSecurityActive=true;
  recordUserActivity(true);
  if(sessionSecurityTimer) clearInterval(sessionSecurityTimer);
  sessionSecurityTimer=setInterval(checkSessionSecurity,60_000);
}
function stopSessionSecurity(){
  sessionSecurityActive=false;
  if(sessionSecurityTimer){clearInterval(sessionSecurityTimer);sessionSecurityTimer=null;}
}
async function secureLogout(reason='Je bent uitgelogd.'){
  if(sessionLogoutInProgress) return;
  sessionLogoutInProgress=true;
  stopSessionSecurity();
  try{await sb?.auth.signOut({scope:'local'});}catch(error){console.warn('Uitloggen gaf een melding:',error.message);}
  clearSessionMeta();
  vastgoedData=[];
  await applyBranding(DEFAULT_BRANDING);
  showLogin(reason);
  sessionLogoutInProgress=false;
}
async function checkSessionSecurity(){
  if(!sessionSecurityActive||document.hidden) return;
  const now=Date.now();
  const started=Number(getSessionMeta(SESSION_STARTED_KEY));
  const lastActivity=Number(getSessionMeta(SESSION_LAST_ACTIVITY_KEY));
  if(Number.isFinite(started)&&now-started>=MAX_SESSION_DURATION_MS){
    await secureLogout('Je sessie van 8 uur is verlopen. Log opnieuw in.');
    return;
  }
  if(Number.isFinite(lastActivity)&&now-lastActivity>=INACTIVITY_TIMEOUT_MS){
    await secureLogout('Je bent na 30 minuten inactiviteit automatisch uitgelogd.');
  }
}
function handleVisibilitySecurity(){
  if(!sessionSecurityActive) return;
  if(document.hidden){
    setSessionMeta(SESSION_HIDDEN_AT_KEY,Date.now());
    return;
  }
  const hiddenAt=Number(getSessionMeta(SESSION_HIDDEN_AT_KEY));
  setSessionMeta(SESSION_HIDDEN_AT_KEY,'');
  if(Number.isFinite(hiddenAt)&&hiddenAt>0&&Date.now()-hiddenAt>=BACKGROUND_TIMEOUT_MS){
    secureLogout('De app was langer dan 15 minuten op de achtergrond. Log opnieuw in.');
    return;
  }
  checkSessionSecurity();
  recordUserActivity(true);
}
function bindSessionSecurityEvents(){
  ['pointerdown','keydown','touchstart','scroll'].forEach(type=>window.addEventListener(type,()=>recordUserActivity(false),{passive:true}));
  document.addEventListener('visibilitychange',handleVisibilitySecurity);
}


/* v38.4: robuuste PWA-installatie voor telefoon en desktop */
let deferredInstallPrompt=null;
let pwaRegistration=null;
let pwaRefreshing=false;
let pwaPromptTimer=null;

function isPwaStandalone(){
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;
}
function isIosDevice(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent||'');
}
function isSafariBrowser(){
  const ua=navigator.userAgent||'';
  return /safari/i.test(ua) && !/chrome|crios|android|edg|opr|fxios/i.test(ua);
}
function isChromiumBrowser(){
  return /chrome|crios|edg|opr/i.test(navigator.userAgent||'') && !/firefox|fxios/i.test(navigator.userAgent||'');
}
function setPwaHelp(html=''){
  const help=el('pwaInstallHelp');
  if(!help) return;
  help.innerHTML=html;
  help.classList.toggle('hidden',!html);
}
function setPwaStatus(label,style,title,text,{canInstall=false}={}){
  const badge=el('pwaStatusBadge');
  if(badge){
    badge.textContent=label;
    badge.className=`badge ${style}`;
  }
  if(el('pwaStatusTitle')) el('pwaStatusTitle').textContent=title;
  if(el('pwaStatusText')) el('pwaStatusText').textContent=text;

  const headerButton=el('installAppBtn');
  const settingsButton=el('settingsInstallAppBtn');
  headerButton?.classList.toggle('hidden',!canInstall);

  if(settingsButton){
    const standalone=isPwaStandalone();
    settingsButton.classList.toggle('hidden',standalone);
    settingsButton.disabled=false;
    settingsButton.textContent=canInstall ? 'App installeren' : 'Installatiehulp';
  }
}
function updatePwaInstallUi(){
  if(isPwaStandalone()){
    setPwaHelp('');
    setPwaStatus('Geïnstalleerd','ok','De app is geïnstalleerd','Je gebruikt het dashboard als zelfstandige app. Updates worden automatisch klaargezet.');
    return;
  }
  if(deferredInstallPrompt){
    setPwaHelp('');
    setPwaStatus('Klaar','ok','De app kan worden geïnstalleerd','Klik op “App installeren” om het installatievenster te openen.',{canInstall:true});
    return;
  }
  if(isIosDevice()){
    setPwaStatus('Handmatig','warning','Installeren via het deelmenu','Open deze pagina in Safari en gebruik het deelmenu om de app op het beginscherm te zetten.',{canInstall:true});
    return;
  }

  const waitingText=isChromiumBrowser()
    ? 'Klik één keer op de pagina en laat het dashboard ongeveer 30 seconden open. Zodra de browser de app vrijgeeft, verandert de knop automatisch in “App installeren”.'
    : 'Gebruik het installatiesymbool in de adresbalk of kies “App installeren” in het browsermenu.';
  setPwaStatus('Controleren','warning','De browser controleert de installatie',waitingText);
}
function capturePwaInstallPrompt(event){
  event.preventDefault();
  deferredInstallPrompt=event;
  if(pwaPromptTimer){
    clearTimeout(pwaPromptTimer);
    pwaPromptTimer=null;
  }
  updatePwaInstallUi();
}
function handlePwaInstalled(){
  deferredInstallPrompt=null;
  setPwaHelp('');
  updatePwaInstallUi();
}

/*
 * Deze listeners worden direct tijdens het laden van app.js geregistreerd.
 * Daardoor missen we beforeinstallprompt niet wanneer er al een actieve
 * service worker aanwezig is en de browser vroeg beslist dat de app
 * installeerbaar is.
 */
window.addEventListener('beforeinstallprompt',capturePwaInstallPrompt);
window.addEventListener('appinstalled',handlePwaInstalled);

async function requestPwaInstall(){
  if(isPwaStandalone()){
    updatePwaInstallUi();
    return;
  }
  if(deferredInstallPrompt){
    const promptEvent=deferredInstallPrompt;
    deferredInstallPrompt=null;
    try{
      await promptEvent.prompt();
      const choice=await promptEvent.userChoice;
      if(choice?.outcome==='dismissed'){
        setPwaHelp('<strong>Installatie geannuleerd</strong><p>Je kunt het later opnieuw proberen via het installatiesymbool in de adresbalk of het browsermenu.</p>');
      }
    }catch(error){
      console.warn('Installatievenster kon niet worden geopend:',error);
      setPwaHelp(`<strong>Installatievenster kon niet worden geopend</strong><p>${escHtml(error.message||'Probeer het via het browsermenu.')}</p>`);
    }
    updatePwaInstallUi();
    return;
  }
  if(isIosDevice()){
    const safariNote=isSafariBrowser()?'':'Open het dashboard eerst in Safari. ';
    setPwaHelp(`<strong>Installeren op iPhone of iPad</strong><ol><li>${safariNote}Tik onderin op het deel-symbool.</li><li>Kies <strong>Zet op beginscherm</strong>.</li><li>Bevestig met <strong>Voeg toe</strong>.</li></ol>`);
    return;
  }

  setPwaHelp(
    '<strong>Installatie nog niet vrijgegeven</strong>'+
    '<ol><li>Klik één keer ergens in het dashboard.</li>'+
    '<li>Laat deze pagina minimaal 30 seconden open.</li>'+
    '<li>Ververs daarna één keer met <strong>Ctrl + F5</strong>.</li>'+
    '<li>Klik opnieuw op deze knop of gebruik het installatiesymbool in de adresbalk.</li></ol>'
  );
}
function showPwaUpdate(){
  el('pwaReloadBtn')?.classList.remove('hidden');
  el('pwaUpdateToast')?.classList.remove('hidden');
}
function activatePwaUpdate(){
  const waiting=pwaRegistration?.waiting;
  if(waiting){
    waiting.postMessage({type:'SKIP_WAITING'});
  }else{
    window.location.reload();
  }
}
async function initPwa(){
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',updatePwaInstallUi);
  updatePwaInstallUi();

  if(!('serviceWorker' in navigator)){
    setPwaStatus('Niet ondersteund','danger','Deze browser ondersteunt geen app-installatie','Open het dashboard in een recente versie van Edge, Chrome of Safari.');
    return;
  }
  if(location.protocol!=='https:' && location.hostname!=='localhost'){
    setPwaStatus('HTTPS nodig','danger','Beveiligde verbinding vereist','De app kan alleen via HTTPS worden geïnstalleerd.');
    return;
  }
  try{
    const serviceWorkerUrl=new URL('/service-worker.js?v=40.42.3',window.location.origin).href;
    pwaRegistration=await navigator.serviceWorker.register(serviceWorkerUrl,{scope:'/',updateViaCache:'none'});
    await pwaRegistration.update();

    if(pwaRegistration.waiting) showPwaUpdate();
    pwaRegistration.addEventListener('updatefound',()=>{
      const worker=pwaRegistration.installing;
      if(!worker) return;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed' && navigator.serviceWorker.controller) showPwaUpdate();
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(pwaRefreshing) return;
      pwaRefreshing=true;
      window.location.reload();
    });

    if(!deferredInstallPrompt && !isPwaStandalone()){
      pwaPromptTimer=setTimeout(updatePwaInstallUi,31_000);
    }
  }catch(error){
    console.error('PWA-serviceworker kon niet worden geregistreerd:',error);
    setPwaStatus('Niet actief','danger','App-installatie is nog niet actief',`Controleer de deployment van service-worker.js: ${error.message}`);
  }
}

const CBS_CPI_BASE='https://datasets.cbs.nl/odata/v1/CBS/86141NED';
const CBS_TABLE_ID='86141NED';
const RENT_REFERENCE_OFFSET_MONTHS=4;
const RENT_OLD_REFERENCE_OFFSET_MONTHS=16;
let rawRentIncreaseProposals=[];
let rentIncreaseSetupReady=true;
let rawServiceCostSettlements=[];
let serviceCostSetupReady=true;
let inspectionsSetupReady=true;
let activeInspectionId=null;
let activeFinancialTab='rent';
let activeRentPropertyGroup='residential';
let activeMaintenanceTab='maintenance';
let serviceCostYear=new Date().getFullYear()-1;
let activeServiceCostContext=null;
const DEFAULT_NOTIFICATION_RULES={
  notice_date:{enabled:true,days:[90,30,14,7,1,0]},
  contract_end:{enabled:true,days:[90,30,7]},
  maintenance:{enabled:true,days:[30,7,1,0]},
  scope_inspection:{enabled:true,days:[90,30,7]},
  energy_label:{enabled:true,days:[180,90,30,7]},
  rent_increase:{enabled:true,days:[60,30,7]},
  vacancy:{enabled:true,days:[]},
  task:{enabled:true,days:[]},
  tenant_report:{enabled:true,days:[]}
};
const DEFAULT_NOTIFICATION_SETTINGS={
  id:1,
  email_enabled:false,
  test_mode:true,
  recipients:[],
  send_time:'07:30',
  send_days:'weekdays',
  timezone:'Europe/Amsterdam',
  only_when_events:true,
  rules:DEFAULT_NOTIFICATION_RULES
};
let notificationSettings=JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS));
let notificationSettingsReady=true;
let rawEmailNotificationLogs=[];
let notificationFunctionStatus={reachable:false,outlookConfigured:false,sender:'',schedulerKeyConfigured:false,error:''};
let cbsIndexCache={loaded:false,loading:null,loadedAt:null,measureCode:'',categoryCode:'',values:new Map(),error:''};
let activeRentContext=null;
let agendaCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let agendaTypeFilter='all';
const euro2=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));

async function fetchODataAll(url){
  const rows=[];
  let nextUrl=url;
  let requests=0;
  while(nextUrl){
    if(++requests>50) throw new Error('De CBS-respons bevatte te veel pagina’s.');
    const response=await fetch(nextUrl,{headers:{Accept:'application/json'}});
    if(!response.ok) throw new Error(`CBS gaf foutcode ${response.status}.`);
    const json=await response.json();
    rows.push(...(json.value||[]));
    nextUrl=json['@odata.nextLink']||null;
    if(nextUrl && !/^https?:/i.test(nextUrl)) nextUrl=new URL(nextUrl,CBS_CPI_BASE).href;
  }
  return rows;
}

function normalizeCbsTitle(value){
  return clean(value)
    .replace(/\*/g,'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/\s+/g,' ')
    .trim();
}

function cbsNumber(value){
  if(value===null||value===undefined||value==='') return null;
  const number=Number(String(value).replace(',','.'));
  return Number.isFinite(number)?number:null;
}

async function loadCbsIndexData(force=false){
  if(cbsIndexCache.loading) return cbsIndexCache.loading;
  if(cbsIndexCache.loaded&&!force) return cbsIndexCache;
  const message=el('financialMessage');
  if(message) message.textContent='Openbare CBS CPI-cijfers worden opgehaald...';

  cbsIndexCache.loading=(async()=>{
    try{
      const [measureCodes,categoryCodes,periodCodes]=await Promise.all([
        fetchODataAll(`${CBS_CPI_BASE}/MeasureCodes`),
        fetchODataAll(`${CBS_CPI_BASE}/BestedingscategorieenCodes`),
        fetchODataAll(`${CBS_CPI_BASE}/PeriodenCodes`)
      ]);
      const measure=measureCodes.find(item=>{
        const title=normalizeCbsTitle(item.Title);
        return title==='cpi'||(title.startsWith('cpi ')&&!title.includes('afgeleid')&&!title.includes('jaarmutatie'));
      });
      const category=categoryCodes.find(item=>clean(item.Identifier)==='000000')
        || categoryCodes.find(item=>normalizeCbsTitle(item.Title).includes('alle bestedingen'));
      if(!measure) throw new Error('De meetwaarde “CPI” is niet gevonden in CBS-tabel 86141NED.');
      if(!category) throw new Error('De categorie “000000 Alle bestedingen” is niet gevonden.');

      const filter=`Bestedingscategorieen eq '${String(category.Identifier).replace(/'/g,"''")}' and Measure eq '${String(measure.Identifier).replace(/'/g,"''")}'`;
      const observations=await fetchODataAll(`${CBS_CPI_BASE}/Observations?$filter=${encodeURIComponent(filter)}`);
      const periods=Object.fromEntries(periodCodes.map(item=>[item.Identifier,item.Title]));
      const values=new Map();
      observations.forEach(item=>{
        const title=periods[item.Perioden]||item.Perioden||'';
        const normalized=normalizeCbsTitle(title);
        const value=cbsNumber(item.Value??item.ValueNumeric??item.NumericValue);
        const match=normalized.match(/^(\d{4})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)$/);
        if(!match||value===null) return;
        const month=monthMap[match[2]]+1;
        const key=`${match[1]}-${String(month).padStart(2,'0')}`;
        values.set(key,{
          key,
          title:title.replace(/\*/g,'').trim(),
          value,
          provisional:String(title).includes('*')||String(item.ValueAttribute||'').toLowerCase().includes('voorlopig'),
          periodCode:item.Perioden
        });
      });
      if(!values.size) throw new Error('Er zijn geen maandelijkse CPI-indexcijfers gevonden.');
      cbsIndexCache={loaded:true,loading:null,loadedAt:new Date(),measureCode:measure.Identifier,categoryCode:category.Identifier,values,error:''};
      if(message) message.textContent='';
      renderFinancialOverview(filtered());
      return cbsIndexCache;
    }catch(error){
      console.error('CBS ophalen mislukt',error);
      cbsIndexCache={...cbsIndexCache,loaded:false,loading:null,error:error.message};
      if(message) message.textContent=`CBS-cijfers konden niet automatisch worden geladen: ${error.message} Je kunt de CPI-cijfers bij een voorstel handmatig invullen.`;
      renderFinancialOverview(filtered());
      return cbsIndexCache;
    }
  })();
  return cbsIndexCache.loading;
}

function monthKeyFromIso(value){
  const parts=isoParts(value);
  return parts?`${parts.year}-${String(parts.month).padStart(2,'0')}`:'';
}

function longMonthYear(value){
  const parts=isoParts(value);
  if(!parts) return '-';
  return new Intl.DateTimeFormat('nl-NL',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(parts.year,parts.month-1,1)));
}

function rentIncreaseEffectiveDate(r){
  const monthIndex=monthMap[norm(r.maand_huurverhoging)];
  if(monthIndex===undefined) return null;
  const today=new Date();
  let year=today.getFullYear();
  if(monthIndex<today.getMonth()) year++;
  let target=`${year}-${String(monthIndex+1).padStart(2,'0')}-01`;
  const processed=rawRentIncreaseProposals.some(p=>
    p.contract_id===r.contract?.id &&
    p.effective_date===target &&
    (p.status==='Verwerkt'||p.status==='Niet verhoogd'||p.skip_increase===true)
  );
  if(processed) target=`${year+1}-${String(monthIndex+1).padStart(2,'0')}-01`;
  return target;
}

function rentIncreaseAppliesDuringContract(r,effectiveDate=rentIncreaseEffectiveDate(r)){
  if(!r?.contract?.id||!effectiveDate) return false;
  if(!r.contract_opgezegd) return true;

  // Een opgezegd contract loopt door tot de einddatum. Een huurverhoging
  // vóór of op die einddatum blijft daarom van toepassing.
  const contractEnd=r.einddatum_contract||r.oorspronkelijke_einddatum_contract||r.contract?.end_date||null;
  if(!contractEnd) return false;
  return String(effectiveDate).slice(0,10)<=String(contractEnd).slice(0,10);
}

function rentReferencePeriods(effectiveDate){
  return {
    newDate:shiftIsoMonths(effectiveDate,-RENT_REFERENCE_OFFSET_MONTHS),
    oldDate:shiftIsoMonths(effectiveDate,-RENT_OLD_REFERENCE_OFFSET_MONTHS)
  };
}

function proposalFor(contractId,effectiveDate){
  return rawRentIncreaseProposals.find(p=>p.contract_id===contractId&&p.effective_date===effectiveDate)||null;
}

function calculateIndexedAmount(amount,oldIndex,newIndex){
  const base=Number(amount),oldValue=Number(oldIndex),newValue=Number(newIndex);
  if(!Number.isFinite(base)||base<0||!Number.isFinite(oldValue)||oldValue<=0||!Number.isFinite(newValue)||newValue<=0) return null;
  return Math.round((base*(newValue/oldValue))*100)/100;
}

function calculateRentValues(currentRent,oldIndex,newIndex){
  const current=Number(currentRent),oldValue=Number(oldIndex),newValue=Number(newIndex);
  if(!Number.isFinite(current)||current<=0||!Number.isFinite(oldValue)||oldValue<=0||!Number.isFinite(newValue)||newValue<=0){
    return {percentage:null,rent:null,serviceCosts:null,total:null};
  }
  const percentage=((newValue/oldValue)-1)*100;
  const rent=calculateIndexedAmount(current,oldValue,newValue);
  return {percentage,rent,serviceCosts:null,total:rent};
}

function isResidentialProperty(r){
  const type=norm(r?.type||r?.property?.property_type||'');
  const residentialTerms=[
    'woning','woonhuis','appartement','studio','kamer','maisonnette',
    'eengezins','bovenwoning','benedenwoning','portiekwoning'
  ];
  return residentialTerms.some(term=>type.includes(term));
}

function setRentPropertyGroup(group){
  activeRentPropertyGroup=group==='other'?'other':'residential';
  document.querySelectorAll('.rentPropertyTab').forEach(button=>{
    const active=button.dataset.rentPropertyGroup===activeRentPropertyGroup;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
  });
  renderFinancialOverview(filtered());
}

function rentRowContext(r){
  const effectiveDate=rentIncreaseEffectiveDate(r);
  const periods=effectiveDate?rentReferencePeriods(effectiveDate):{newDate:null,oldDate:null};
  const newCpi=periods.newDate?cbsIndexCache.values.get(monthKeyFromIso(periods.newDate)):null;
  const oldCpi=periods.oldDate?cbsIndexCache.values.get(monthKeyFromIso(periods.oldDate)):null;
  const proposal=effectiveDate?proposalFor(r.contract?.id,effectiveDate):null;
  const calculated=calculateRentValues(r.huur_pm,proposal?.old_index??oldCpi?.value,proposal?.new_index??newCpi?.value);
  const indexedServiceCosts=calculateIndexedAmount(r.servicekosten,proposal?.old_index??oldCpi?.value,proposal?.new_index??newCpi?.value);
  calculated.serviceCosts=indexedServiceCosts;
  calculated.total=calculated.rent===null?null:Math.round(((calculated.rent||0)+(indexedServiceCosts||0))*100)/100;
  return {r,effectiveDate,periods,newCpi,oldCpi,proposal,calculated};
}

function rentContextStatus(context){
  const {r,effectiveDate,newCpi,oldCpi,proposal}=context;
  if(!r.contract?.id) return ['Geen contract','danger'];
  if(!r.maand_huurverhoging) return ['Maand ontbreekt','warning'];
  if(r.contract_opgezegd&&!rentIncreaseAppliesDuringContract(r,effectiveDate)) return ['Eindigt vóór verhoging','warning'];
  if(!Number(r.huur_pm)) return ['Huur ontbreekt','danger'];
  if(proposal?.status==='Verwerkt') return ['Verwerkt','ok'];
  if(proposal?.status==='Niet verhoogd'||proposal?.skip_increase===true) return ['Niet verhoogd','ok'];
  if(proposal?.status==='Goedgekeurd') return ['Goedgekeurd','ok'];
  if(proposal) return ['Concept','warning'];
  if(!effectiveDate) return ['Controle nodig','warning'];
  if(!newCpi||!oldCpi) return ['CBS-cijfer ontbreekt','warning'];
  if(newCpi.provisional||oldCpi.provisional) return ['Voorlopig CBS-cijfer','warning'];
  if(r.contract_opgezegd) return ['Opgezegd, loopt door','warning'];
  return ['Klaar voor concept','ok'];
}

function renderFinancialOverview(data){
  const overview=el('financialOverview');
  const table=el('rentIncreaseTable');
  if(!overview||!table) return;

  const allEligible=data.filter(r=>r.contract?.id&&rentIncreaseAppliesDuringContract(r));
  const residentialCount=allEligible.filter(isResidentialProperty).length;
  const otherCount=allEligible.length-residentialCount;

  if(el('rentResidentialCount')) el('rentResidentialCount').textContent=residentialCount;
  if(el('rentOtherCount')) el('rentOtherCount').textContent=otherCount;

  document.querySelectorAll('.rentPropertyTab').forEach(button=>{
    const active=button.dataset.rentPropertyGroup===activeRentPropertyGroup;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
  });

  const notice=el('rentPropertyGroupNotice');
  if(notice){
    notice.innerHTML=activeRentPropertyGroup==='residential'
      ? '<strong>Woningen</strong><span>Woningen staan apart zodat de huurverhoging afzonderlijk kan worden beoordeeld en uitgewerkt. Controleer het definitieve bedrag altijd handmatig.</span>'
      : '<strong>Bedrijfsmatig vastgoed</strong><span>Hier staan winkels, kantoren, bedrijfsruimten en alle overige typen vastgoed.</span>';
  }

  const hasPropertyGroupTabs=document.querySelectorAll('.rentPropertyTab').length>=2;
  const eligible=hasPropertyGroupTabs
    ? allEligible.filter(r=>
        activeRentPropertyGroup==='residential' ? isResidentialProperty(r) : !isResidentialProperty(r)
      )
    : allEligible;
  const contexts=eligible.map(rentRowContext);
  const soon=contexts.filter(c=>{const d=daysUntil(c.effectiveDate);return d!==null&&d>=0&&d<=90;}).length;
  const concepts=contexts.filter(c=>c.proposal?.status==='Concept').length;
  const approved=contexts.filter(c=>c.proposal?.status==='Goedgekeurd').length;

  const propertyIds=new Set(eligible.map(r=>r.id));
  const processed=rawRentIncreaseProposals.filter(p=>p.status==='Verwerkt'&&propertyIds.has(p.property_id)).length;
  const skipped=rawRentIncreaseProposals.filter(p=>
    (p.status==='Niet verhoogd'||p.skip_increase===true)&&propertyIds.has(p.property_id)
  ).length;
  const needsCheck=contexts.filter(c=>
    ['danger','warning'].includes(rentContextStatus(c)[1]) &&
    !['Concept','Goedgekeurd','Verwerkt','Niet verhoogd'].includes(rentContextStatus(c)[0])
  ).length;

  const cbsText=cbsIndexCache.loadedAt
    ? `Laatst opgehaald: ${cbsIndexCache.loadedAt.toLocaleString('nl-NL')}`
    : (cbsIndexCache.error?'CBS-koppeling niet beschikbaar; handmatige invoer blijft mogelijk.':'CBS-cijfers worden automatisch geladen.');

  overview.innerHTML=`<div class="financialSource"><span><strong>Bron:</strong> CBS 86141NED · CPI 2025=100 · 000000 Alle bestedingen</span><span>${cbsText}</span></div>
  <div class="cards financialSummaryCards">
    <div class="card"><span>Binnen 90 dagen</span><strong>${soon}</strong></div>
    <div class="card"><span>Concepten</span><strong>${concepts}</strong></div>
    <div class="card"><span>Controle nodig</span><strong>${needsCheck}</strong></div>
    <div class="card"><span>Goedgekeurd</span><strong>${approved}</strong></div>
    <div class="card"><span>Niet verhoogd</span><strong>${skipped}</strong></div>
    <div class="card"><span>Verwerkt</span><strong>${processed}</strong></div>
  </div>`;

  const rows=contexts.sort((a,b)=>
    String(a.effectiveDate||'9999').localeCompare(String(b.effectiveDate||'9999')) ||
    compareObjectAddress(a.r,b.r)
  );

  table.innerHTML=`<tr><th>Object</th><th>Huurder</th><th>Ingangsdatum</th><th>Referentiemaanden</th><th>Huidige huur</th><th>Voorstel</th><th>Status</th><th>Acties</th></tr>`+
    rows.map(context=>{
      const {r,effectiveDate,periods,newCpi,oldCpi,proposal,calculated}=context;
      const status=rentContextStatus(context);
      const finalRent=proposal?.final_rent??calculated.rent;
      const cpiText=periods.newDate&&periods.oldDate
        ? `${longMonthYear(periods.newDate)} / ${longMonthYear(periods.oldDate)}<span class="rentStatusText">${newCpi?String(newCpi.value).replace('.',','):'-'} / ${oldCpi?String(oldCpi.value).replace('.',','):'-'}</span>`
        : '-';
      const actionLabel=proposal?'Bekijken':'Berekenen';
      return `<tr>
        <td><strong>${escHtml(r.object)}</strong><span class="subtle">${escHtml([r.straatnaam,r.huisnummer,r.postcode].filter(Boolean).join(' '))}</span><span class="rentStatusText">${isResidentialProperty(r)?'Woning':'Bedrijfsmatig vastgoed'}</span></td>
        <td>${escHtml(r.huurder)}</td>
        <td>${dateFmt(effectiveDate)}</td>
        <td>${cpiText}</td>
        <td>${euro2(r.huur_pm)}</td>
        <td>${finalRent?euro2(finalRent):'-'}${calculated.percentage!==null?`<span class="rentStatusText">${calculated.percentage.toFixed(2).replace('.',',')}%</span>`:''}</td>
        <td>${statusBadge(status)}</td>
        <td><div class="financialActionGroup">
          <button class="miniLink rentEditBtn" data-id="${r.id}" data-date="${effectiveDate||''}">${actionLabel}</button>
          ${proposal?`<button class="miniLink rentQuickLetterBtn" data-id="${r.id}" data-date="${effectiveDate}">Conceptbrief</button>`:''}
          <button class="miniLink rentSkipBtn" data-id="${r.id}" data-date="${effectiveDate||''}">Niet verhogen dit jaar</button>
        </div></td>
      </tr>`;
    }).join('') || '<tr><td colspan="8">Geen contracten in deze vastgoedgroep gevonden.</td></tr>';

  if(!rentIncreaseSetupReady){
    overview.insertAdjacentHTML('afterbegin','<div class="importNotice warning"><strong>Eenmalige Supabase-instelling nodig</strong><span>Voer eerst het meegeleverde SQL-bestand uit. Daarna kunnen concepten, huurhistorie en jaren zonder verhoging veilig worden opgeslagen.</span></div>');
  }
}


function openRentIncreaseModal(propertyId,effectiveDate){
  const r=getPropertyById(propertyId);
  if(!r) return;
  const targetDate=effectiveDate||rentIncreaseEffectiveDate(r);
  const periods=targetDate?rentReferencePeriods(targetDate):{newDate:null,oldDate:null};
  const proposal=targetDate?proposalFor(r.contract?.id,targetDate):null;
  const oldCpi=proposal?.old_index??cbsIndexCache.values.get(monthKeyFromIso(periods.oldDate))?.value??'';
  const newCpi=proposal?.new_index??cbsIndexCache.values.get(monthKeyFromIso(periods.newDate))?.value??'';
  activeRentContext={r,effectiveDate:targetDate,periods,proposal};

  el('rentProposalId').value=proposal?.id||'';
  el('rentPropertyId').value=r.id;
  el('rentContractId').value=r.contract?.id||'';
  el('rentIncreaseModalTitle').textContent=`Huurverhoging · ${r.object}`;
  el('rentIncreaseModalMeta').textContent=`${isResidentialProperty(r)?'Woning':'Bedrijfsmatig vastgoed'} · ${r.huurder} · ${[r.straatnaam,r.huisnummer,r.postcode,r.stad].filter(Boolean).join(' ')}`;
  el('rentCurrentRent').textContent=euro2(r.huur_pm);
  el('rentServiceCosts').textContent=euro2(r.servicekosten);
  el('rentCalculatedServiceCosts').textContent='-';
  el('rentCalculatedTotal').textContent='-';
  el('rentEffectiveDate').value=targetDate||'';
  el('rentProposalStatus').value=proposal?.status==='Goedgekeurd'?'Goedgekeurd':'Concept';
  el('rentOldPeriod').value=longMonthYear(periods.oldDate);
  el('rentNewPeriod').value=longMonthYear(periods.newDate);
  el('rentOldIndex').value=oldCpi;
  el('rentNewIndex').value=newCpi;
  el('rentFinalRent').value=proposal?.final_rent??'';
  el('rentFinalRent').dataset.autoCalculated=proposal?'false':'true';
  el('rentOverrideReason').value=proposal?.override_reason||'';
  el('rentNotes').value=proposal?.notes||'';
  el('rentIncreaseMessage').textContent='';
  updateRentModalCalculation();
  updateRentApplyButton();

  const cbsWarning=el('rentCbsWarning');
  const newEntry=cbsIndexCache.values.get(monthKeyFromIso(periods.newDate));
  const oldEntry=cbsIndexCache.values.get(monthKeyFromIso(periods.oldDate));
  const warnings=[];
  if(!newEntry||!oldEntry) warnings.push('Een of beide CBS-indexcijfers zijn nog niet beschikbaar. Vul ze alleen handmatig in nadat je ze in StatLine hebt gecontroleerd.');
  if(newEntry?.provisional||oldEntry?.provisional) warnings.push('Minimaal één gebruikt CBS-cijfer is voorlopig. Controleer dit vóór goedkeuring.');
  cbsWarning.textContent=warnings.join(' ');
  cbsWarning.classList.toggle('hidden',!warnings.length);
  el('rentIncreaseModal').classList.remove('hidden');
}

function closeRentIncreaseModal(){
  el('rentIncreaseModal').classList.add('hidden');
  activeRentContext=null;
}

function updateRentModalCalculation(){
  if(!activeRentContext) return;
  const oldIndex=Number(el('rentOldIndex').value);
  const newIndex=Number(el('rentNewIndex').value);
  const calculated=calculateRentValues(activeRentContext.r.huur_pm,oldIndex,newIndex);
  const indexedServiceCosts=calculateIndexedAmount(activeRentContext.r.servicekosten,oldIndex,newIndex);
  const total=calculated.rent===null?null:Math.round(((calculated.rent||0)+(indexedServiceCosts||0))*100)/100;
  el('rentCalculatedPercentage').textContent=calculated.percentage===null?'-':`${calculated.percentage.toFixed(2).replace('.',',')}%`;
  el('rentCalculatedRent').textContent=calculated.rent===null?'-':euro2(calculated.rent);
  el('rentCalculatedRent').dataset.value=calculated.rent??'';
  el('rentCalculatedServiceCosts').textContent=indexedServiceCosts===null?'-':euro2(indexedServiceCosts);
  el('rentCalculatedTotal').textContent=total===null?'-':euro2(total);
  if(calculated.rent!==null&&(!el('rentFinalRent').value||el('rentFinalRent').dataset.autoCalculated==='true')){
    el('rentFinalRent').value=calculated.rent.toFixed(2);
    el('rentFinalRent').dataset.autoCalculated='true';
  }
}

function updateRentApplyButton(){
  const button=el('applyRentIncreaseBtn');
  const skipButton=el('skipRentIncreaseBtn');
  const proposalId=el('rentProposalId').value;
  const approved=el('rentProposalStatus').value==='Goedgekeurd';
  const finalStatus=activeRentContext?.proposal?.status;
  const processed=finalStatus==='Verwerkt';
  const skipped=finalStatus==='Niet verhoogd'||activeRentContext?.proposal?.skip_increase===true;

  button.classList.toggle('hidden',!proposalId||processed||skipped);
  button.disabled=!approved;
  button.title=approved?'':'Zet de status eerst op Goedgekeurd.';

  if(skipButton){
    skipButton.classList.toggle('hidden',processed||skipped);
    skipButton.disabled=processed||skipped;
  }
}

function rentProposalPayload(){
  if(!activeRentContext) throw new Error('Geen huurverhoging geselecteerd.');
  const oldIndex=Number(el('rentOldIndex').value);
  const newIndex=Number(el('rentNewIndex').value);
  const finalRent=Number(el('rentFinalRent').value);
  if(!Number.isFinite(oldIndex)||oldIndex<=0||!Number.isFinite(newIndex)||newIndex<=0) throw new Error('Vul geldige oude en nieuwe CPI-indexcijfers in.');
  if(!Number.isFinite(finalRent)||finalRent<0) throw new Error('Vul een geldige definitieve maandhuur in.');
  const calculated=calculateRentValues(activeRentContext.r.huur_pm,oldIndex,newIndex);
  const reason=clean(el('rentOverrideReason').value);
  if(calculated.rent!==null&&Math.abs(finalRent-calculated.rent)>0.01&&!reason){
    throw new Error('Vul een reden in wanneer de definitieve huur afwijkt van de automatische berekening.');
  }
  const effectiveDate=el('rentEffectiveDate').value;
  const periods=rentReferencePeriods(effectiveDate);
  const oldEntry=cbsIndexCache.values.get(monthKeyFromIso(periods.oldDate));
  const newEntry=cbsIndexCache.values.get(monthKeyFromIso(periods.newDate));
  return {
    id:el('rentProposalId').value||undefined,
    property_id:activeRentContext.r.id,
    contract_id:activeRentContext.r.contract.id,
    effective_date:effectiveDate,
    current_rent:Number(activeRentContext.r.huur_pm||0),
    service_costs:Number(activeRentContext.r.servicekosten||0),
    old_period:monthKeyFromIso(periods.oldDate),
    new_period:monthKeyFromIso(periods.newDate),
    old_index:oldIndex,
    new_index:newIndex,
    calculated_percentage:calculated.percentage,
    calculated_rent:calculated.rent,
    final_rent:finalRent,
    override_reason:reason||null,
    notes:clean(el('rentNotes').value)||null,
    status:el('rentProposalStatus').value,
    skip_increase:false,
    cbs_table:CBS_TABLE_ID,
    cbs_measure:'CPI',
    cbs_category:'000000 Alle bestedingen',
    cbs_is_provisional:Boolean(oldEntry?.provisional||newEntry?.provisional),
    updated_at:new Date().toISOString()
  };
}

async function persistRentProposal(){
  if(!rentIncreaseSetupReady) throw new Error('Voer eerst het meegeleverde Supabase SQL-bestand uit.');
  const payload=rentProposalPayload();
  delete payload.id;
  const result=await sb.from('rent_increase_proposals').upsert(payload,{onConflict:'contract_id,effective_date'}).select().single();
  if(result.error) throw result.error;
  const index=rawRentIncreaseProposals.findIndex(item=>item.id===result.data.id||(
    item.contract_id===result.data.contract_id&&item.effective_date===result.data.effective_date
  ));
  if(index>=0) rawRentIncreaseProposals[index]=result.data; else rawRentIncreaseProposals.push(result.data);
  activeRentContext.proposal=result.data;
  el('rentProposalId').value=result.data.id;
  updateRentApplyButton();
  return result.data;
}

async function saveRentProposal(e){
  e?.preventDefault();
  const message=el('rentIncreaseMessage');
  message.textContent='Concept wordt opgeslagen...';
  try{
    await persistRentProposal();
    message.textContent='Concept opgeslagen. Verzenden gebeurt niet automatisch.';
    renderFinancialOverview(filtered());
  }catch(error){
    console.error(error);
    message.textContent='Opslaan mislukt: '+error.message;
  }
}

function proposalLetterData(){
  const payload=rentProposalPayload();
  return {...payload,r:activeRentContext.r};
}

function rentLetterAddressData(r){
  const recipientName=clean(r.factuur_naam)||clean(r.huurder)||'-';
  const recipientStreet=clean(r.factuur_adres)||clean(r.straatnaam);
  const recipientNumber=clean(r.factuur_huisnummer)||clean(r.huisnummer);
  const recipientPostalCode=clean(r.factuur_postcode)||clean(r.postcode);
  const recipientCity=clean(r.factuur_stad)||clean(r.stad);
  const recipientAddress=[recipientStreet,recipientNumber].filter(Boolean).join(' ');
  const recipientPostalCity=[recipientPostalCode,recipientCity].filter(Boolean).join(' ');

  const rentedAddress=[clean(r.straatnaam),clean(r.huisnummer)].filter(Boolean).join(' ');
  const rentedObjectLine=[rentedAddress,clean(r.stad)].filter(Boolean).join(' te ');
  const letterDate=new Intl.DateTimeFormat('nl-NL',{
    day:'numeric',month:'long',year:'numeric'
  }).format(new Date());
  const senderCity=clean(branding.letter_city);
  const senderDateLine=senderCity?`${senderCity}, ${letterDate}`:letterDate;

  return {
    recipientName,
    recipientAddress,
    recipientPostalCity,
    rentedObjectLine,
    senderDateLine
  };
}

function createRentLetterHtml(data){
  const r=data.r;
  const effectiveLong=new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${data.effective_date}T00:00:00Z`));
  const currentRent=Number(data.current_rent||0);
  const serviceCosts=Number(data.service_costs||0);
  const finalRent=Number(data.final_rent||0);
  const oldIndex=Number(data.old_index||0);
  const newIndex=Number(data.new_index||0);
  const ratio=oldIndex>0&&newIndex>0?newIndex/oldIndex:1;
  const indexedServiceCosts=Math.round(serviceCosts*ratio*100)/100;
  const currentTotal=Math.round((currentRent+serviceCosts)*100)/100;
  const rentIncrease=Math.round((finalRent-currentRent)*100)/100;
  const finalTotal=Math.round((finalRent+indexedServiceCosts)*100)/100;
  const amount=n=>new Intl.NumberFormat('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));
  const indexNumber=n=>new Intl.NumberFormat('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));
  const oldPeriod=longMonthYear(`${data.old_period}-01`);
  const newPeriod=longMonthYear(`${data.new_period}-01`);
  const letterAddress=rentLetterAddressData(r);
  const manualOverride=Number.isFinite(Number(data.calculated_rent))&&Math.abs(finalRent-Number(data.calculated_rent))>0.01;
  const overrideNote=manualOverride
    ? `<div class="overrideNote"><strong>Handmatige aanpassing:</strong> de definitieve kale huur is vastgesteld op € ${amount(finalRent)}.${data.override_reason?` Reden: ${escHtml(data.override_reason)}.`:''}</div>`
    : '';

  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><title>Concept huuraanpassing ${escHtml(r.object)}</title><style>
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{background:#eef2f7;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.28}
    .toolbar{width:210mm;margin:18px auto 0;display:flex;align-items:center;gap:12px;padding:0 2mm}
    .printButton{padding:10px 14px;border:0;border-radius:8px;background:#172033;color:#fff;font:700 14px Arial,sans-serif;cursor:pointer}
    .conceptNotice{font:13px Arial,sans-serif;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:9px 12px}
    .sheet{width:210mm;min-height:297mm;margin:12px auto 28px;background:#fff;padding:30mm 19.05mm 20mm;box-shadow:0 18px 55px rgba(15,23,42,.16)}
    .recipient{min-height:15.1mm;line-height:5.05mm}
    .senderDate{margin-top:12mm;line-height:5.05mm}
    .subject{display:grid;grid-template-columns:25mm 1fr;column-gap:3mm;margin-top:10mm;line-height:5.05mm}
    .subjectObject{grid-column:2;min-height:5.05mm}
    .greeting{margin:15.1mm 0 0}
    p{margin:0}
    .bodyText{margin-top:5.05mm}
    .calculationIntro{margin-top:5.05mm}
    .calculation{margin-top:5.05mm;display:grid;grid-template-columns:minmax(0,1fr) 27mm 7mm 31mm;align-items:baseline}
    .calculation .cell{min-height:5.05mm;line-height:5.05mm;white-space:nowrap}
    .calculation .description{grid-column:1}
    .calculation .descriptionWide{grid-column:1 / 3}
    .calculation .indexValue{grid-column:2;text-align:left}
    .calculation .currency{grid-column:3;text-align:right;padding-right:1.5mm}
    .calculation .number{grid-column:4;text-align:right;font-variant-numeric:tabular-nums}
    .calculation .heading{font-weight:700;font-style:italic}
    .calculation .underline{border-bottom:1px solid #000}
    .calculation .finalCurrency,.calculation .finalNumber{border-top:1px solid #000;border-bottom:3px double #000;font-weight:700;font-style:italic}
    .calculation .finalDescription{font-weight:700;font-style:italic}
    .blankRow{grid-column:1 / 5;min-height:5.05mm}
    .overrideNote{margin-top:6mm;padding:3mm;border:1px solid #aaa;font-size:9.5pt;line-height:1.35}
    @page{size:A4 portrait;margin:0}
    @media print{
      html,body{width:210mm;min-height:297mm;background:#fff}
      body{background:#fff}
      .toolbar{display:none!important}
      .sheet{width:210mm;min-height:297mm;margin:0;padding:45mm 19.05mm 20mm;box-shadow:none}
    }
  </style></head><body>
    <div class="toolbar"><button class="printButton" onclick="window.print()">Afdrukken / opslaan als PDF</button><div class="conceptNotice"><strong>Concept:</strong> controleer de brief. Er wordt niets automatisch verzonden.</div></div>
    <main class="sheet">
      <div class="recipient">
        <div>${escHtml(letterAddress.recipientName)}</div>
        <div>${escHtml(letterAddress.recipientAddress||'-')}</div>
        <div>${escHtml(letterAddress.recipientPostalCity||'-')}</div>
      </div>

      <div class="senderDate">${escHtml(letterAddress.senderDateLine)}</div>

      <div class="subject">
        <div>Betreft :</div><div>Huuraanpassing per ${escHtml(effectiveLong)}</div>
        <div class="subjectObject">${escHtml(letterAddress.rentedObjectLine||r.object||'-')}</div>
      </div>

      <p class="greeting">Geachte mevrouw / heer,</p>

      <div class="bodyText">
        <p>Hierbij delen wij u mede, dat de huur van het in hoofde genoemde object ingaande</p>
        <p>${escHtml(effectiveLong)} zal worden verhoogd overeenkomstig artikel 4 van de met u gesloten</p>
        <p>overeenkomst.</p>
      </div>

      <p class="calculationIntro">De berekening van de ingaande ${escHtml(effectiveLong)} verschuldigde huurprijs is als volgt:</p>

      <div class="calculation">
        <div class="cell descriptionWide">De thans verschuldigde huurprijs bedraagt excl. BTW</div><div class="cell currency">€</div><div class="cell number">${amount(currentTotal)}</div>
        <div class="blankRow"></div>
        <div class="cell descriptionWide">Af : voorschot servicekosten</div><div class="cell currency">€</div><div class="cell number underline">${amount(serviceCosts)}</div>
        <div class="cell descriptionWide"></div><div class="cell currency">€</div><div class="cell number">${amount(currentRent)}</div>
        <div class="blankRow"></div>
        <div class="cell description">Prijsindexcijfer ${escHtml(newPeriod)}</div><div class="cell indexValue">${indexNumber(newIndex)}</div><div class="cell currency"></div><div class="cell number"></div>
        <div class="cell description">Prijsindexcijfer ${escHtml(oldPeriod)}</div><div class="cell indexValue">${indexNumber(oldIndex)}</div><div class="cell currency"></div><div class="cell number"></div>
        <div class="blankRow"></div>
        <div class="cell descriptionWide heading">Huurverhoging</div><div class="cell currency"></div><div class="cell number"></div>
        <div class="cell descriptionWide">(=${indexNumber(newIndex)} / ${indexNumber(oldIndex)} x ${amount(currentRent)}) - ${amount(currentRent)} =</div><div class="cell currency">€</div><div class="cell number underline">${amount(rentIncrease)}</div>
        <div class="cell descriptionWide"></div><div class="cell currency">€</div><div class="cell number">${amount(finalRent)}</div>
        <div class="blankRow"></div>
        <div class="cell descriptionWide">Bij: voor de kosten van bijkomende leveringen en diensten</div><div class="cell currency"></div><div class="cell number"></div>
        <div class="cell descriptionWide heading">Verhoging</div><div class="cell currency"></div><div class="cell number"></div>
        <div class="cell descriptionWide">(=${indexNumber(newIndex)} / ${indexNumber(oldIndex)} x ${amount(serviceCosts)}) =</div><div class="cell currency">€</div><div class="cell number">${amount(indexedServiceCosts)}</div>
        <div class="cell descriptionWide"></div><div class="cell currency"></div><div class="cell number underline"></div>
        <div class="cell descriptionWide finalDescription">De per ${escHtml(effectiveLong)} verschuldigde huurprijs bedraagt excl. BTW</div><div class="cell currency finalCurrency">€</div><div class="cell number finalNumber">${amount(finalTotal)}</div>
      </div>
      ${overrideNote}
    </main>
  </body></html>`;
}
function openRentConceptLetter(){
  try{
    const data=proposalLetterData();
    const html=createRentLetterHtml(data);
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const blobUrl=URL.createObjectURL(blob);

    // Open eerst een leeg venster vanuit de gebruikersactie en verbreek daarna
    // direct de koppeling met het dashboard. De brief wordt vervolgens als
    // lokaal Blob-document geladen en maakt geen externe netwerkverbindingen.
    const popup=window.open('about:blank','_blank');
    if(!popup){
      URL.revokeObjectURL(blobUrl);
      throw new Error('De browser blokkeert het nieuwe venster. Sta pop-ups toe voor dit dashboard.');
    }
    popup.opener=null;
    popup.location.replace(blobUrl);
    window.setTimeout(()=>URL.revokeObjectURL(blobUrl),60_000);
  }catch(error){
    el('rentIncreaseMessage').textContent='Conceptbrief kan niet worden gemaakt: '+error.message;
  }
}


function rentLetterExcelCell(value,{type='String',style='',mergeAcross=0,index=null}={}){
  const attrs=[];
  if(style) attrs.push(`ss:StyleID="${style}"`);
  if(mergeAcross) attrs.push(`ss:MergeAcross="${mergeAcross}"`);
  if(index!==null) attrs.push(`ss:Index="${index}"`);
  const safeType=type==='Number'?'Number':'String';
  const content=safeType==='Number'&&Number.isFinite(Number(value))
    ? Number(value)
    : excelXmlEscape(value??'');
  return `<Cell${attrs.length?' '+attrs.join(' '):''}><Data ss:Type="${safeType}">${content}</Data></Cell>`;
}

function rentLetterExcelRow(cells,{height=null}={}){
  return `<Row${height?` ss:Height="${height}"`:''}>${cells.join('')}</Row>`;
}

function rentLetterDownloadName(data){
  const objectName=clean(data?.r?.object)||'object';
  const safeObject=objectName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9_-]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,60)||'object';
  return `conceptbrief-huuraanpassing-${safeObject}-${data.effective_date||'datum'}.xls`;
}

function createRentLetterExcelXml(data){
  const r=data.r;
  const effectiveLong=new Intl.DateTimeFormat('nl-NL',{
    day:'numeric',month:'long',year:'numeric',timeZone:'UTC'
  }).format(new Date(`${data.effective_date}T00:00:00Z`));

  const currentRent=Number(data.current_rent||0);
  const serviceCosts=Number(data.service_costs||0);
  const finalRent=Number(data.final_rent||0);
  const oldIndex=Number(data.old_index||0);
  const newIndex=Number(data.new_index||0);
  const ratio=oldIndex>0&&newIndex>0?newIndex/oldIndex:1;
  const indexedServiceCosts=Math.round(serviceCosts*ratio*100)/100;
  const currentTotal=Math.round((currentRent+serviceCosts)*100)/100;
  const rentIncrease=Math.round((finalRent-currentRent)*100)/100;
  const finalTotal=Math.round((finalRent+indexedServiceCosts)*100)/100;
  const oldPeriod=longMonthYear(`${data.old_period}-01`);
  const newPeriod=longMonthYear(`${data.new_period}-01`);
  const letterAddress=rentLetterAddressData(r);
  const manualOverride=Number.isFinite(Number(data.calculated_rent))&&
    Math.abs(finalRent-Number(data.calculated_rent))>0.01;

  const rows=[
    rentLetterExcelRow([
      rentLetterExcelCell('CONCEPT – controleer en pas de brief waar nodig handmatig aan.',{
        style:'ConceptNotice',mergeAcross:3
      })
    ],{height:30}),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:18}),
    rentLetterExcelRow([rentLetterExcelCell(letterAddress.recipientName,{mergeAcross:3})]),
    rentLetterExcelRow([rentLetterExcelCell(letterAddress.recipientAddress||'-',{mergeAcross:3})]),
    rentLetterExcelRow([rentLetterExcelCell(letterAddress.recipientPostalCity||'-',{mergeAcross:3})]),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:32}),
    rentLetterExcelRow([rentLetterExcelCell(letterAddress.senderDateLine,{mergeAcross:3})]),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:24}),
    rentLetterExcelRow([
      rentLetterExcelCell('Betreft :',{style:'SubjectLabel'}),
      rentLetterExcelCell(`Huuraanpassing per ${effectiveLong}`,{style:'Subject',mergeAcross:2})
    ]),
    rentLetterExcelRow([
      rentLetterExcelCell(''),
      rentLetterExcelCell(letterAddress.rentedObjectLine||r.object||'-',{style:'Subject',mergeAcross:2})
    ]),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:28}),
    rentLetterExcelRow([rentLetterExcelCell('Geachte mevrouw / heer,',{mergeAcross:3})]),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:18}),
    rentLetterExcelRow([
      rentLetterExcelCell('Hierbij delen wij u mede, dat de huur van het in hoofde genoemde object ingaande',{
        style:'WrapText',mergeAcross:3
      })
    ]),
    rentLetterExcelRow([
      rentLetterExcelCell(`${effectiveLong} zal worden verhoogd overeenkomstig artikel 4 van de met u gesloten`,{
        style:'WrapText',mergeAcross:3
      })
    ]),
    rentLetterExcelRow([
      rentLetterExcelCell('overeenkomst.',{style:'WrapText',mergeAcross:3})
    ]),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:18}),
    rentLetterExcelRow([
      rentLetterExcelCell(`De berekening van de ingaande ${effectiveLong} verschuldigde huurprijs is als volgt:`,{
        style:'WrapText',mergeAcross:3
      })
    ]),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:18}),

    rentLetterExcelRow([
      rentLetterExcelCell('De thans verschuldigde huurprijs bedraagt excl. BTW',{mergeAcross:1}),
      rentLetterExcelCell('€',{style:'CurrencySymbol'}),
      rentLetterExcelCell(currentTotal,{type:'Number',style:'Money'})
    ]),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:10}),
    rentLetterExcelRow([
      rentLetterExcelCell('Af : voorschot servicekosten',{mergeAcross:1}),
      rentLetterExcelCell('€',{style:'CurrencySymbol'}),
      rentLetterExcelCell(serviceCosts,{type:'Number',style:'MoneyUnderline'})
    ]),
    rentLetterExcelRow([
      rentLetterExcelCell('',{mergeAcross:1}),
      rentLetterExcelCell('€',{style:'CurrencySymbol'}),
      rentLetterExcelCell(currentRent,{type:'Number',style:'Money'})
    ]),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:14}),
    rentLetterExcelRow([
      rentLetterExcelCell(`Prijsindexcijfer ${newPeriod}`),
      rentLetterExcelCell(newIndex,{type:'Number',style:'IndexNumber'}),
      rentLetterExcelCell('',{mergeAcross:1})
    ]),
    rentLetterExcelRow([
      rentLetterExcelCell(`Prijsindexcijfer ${oldPeriod}`),
      rentLetterExcelCell(oldIndex,{type:'Number',style:'IndexNumber'}),
      rentLetterExcelCell('',{mergeAcross:1})
    ]),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:14}),
    rentLetterExcelRow([
      rentLetterExcelCell('Huurverhoging',{style:'CalculationHeading',mergeAcross:3})
    ]),
    rentLetterExcelRow([
      rentLetterExcelCell(`(=${newIndex.toFixed(2)} / ${oldIndex.toFixed(2)} x ${currentRent.toFixed(2)}) - ${currentRent.toFixed(2)} =`,{
        mergeAcross:1
      }),
      rentLetterExcelCell('€',{style:'CurrencySymbol'}),
      rentLetterExcelCell(rentIncrease,{type:'Number',style:'MoneyUnderline'})
    ]),
    rentLetterExcelRow([
      rentLetterExcelCell('',{mergeAcross:1}),
      rentLetterExcelCell('€',{style:'CurrencySymbol'}),
      rentLetterExcelCell(finalRent,{type:'Number',style:'Money'})
    ]),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:14}),
    rentLetterExcelRow([
      rentLetterExcelCell('Bij: voor de kosten van bijkomende leveringen en diensten',{mergeAcross:3})
    ]),
    rentLetterExcelRow([
      rentLetterExcelCell('Verhoging',{style:'CalculationHeading',mergeAcross:3})
    ]),
    rentLetterExcelRow([
      rentLetterExcelCell(`(=${newIndex.toFixed(2)} / ${oldIndex.toFixed(2)} x ${serviceCosts.toFixed(2)}) =`,{
        mergeAcross:1
      }),
      rentLetterExcelCell('€',{style:'CurrencySymbol'}),
      rentLetterExcelCell(indexedServiceCosts,{type:'Number',style:'Money'})
    ]),
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:10}),
    rentLetterExcelRow([
      rentLetterExcelCell(`De per ${effectiveLong} verschuldigde huurprijs bedraagt excl. BTW`,{
        style:'FinalLabel',mergeAcross:1
      }),
      rentLetterExcelCell('€',{style:'FinalCurrency'}),
      rentLetterExcelCell(finalTotal,{type:'Number',style:'FinalMoney'})
    ])
  ];

  if(manualOverride){
    rows.push(
      rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:16}),
      rentLetterExcelRow([
        rentLetterExcelCell(
          `Handmatige aanpassing: de definitieve kale huur is vastgesteld op € ${finalRent.toFixed(2)}.`+
          (data.override_reason?` Reden: ${data.override_reason}.`:''),
          {style:'OverrideNote',mergeAcross:3}
        )
      ],{height:36})
    );
  }

  rows.push(
    rentLetterExcelRow([rentLetterExcelCell('',{mergeAcross:3})],{height:24}),
    rentLetterExcelRow([
      rentLetterExcelCell(
        'Dit Excel-bestand is een bewerkbaar concept. Er wordt niets automatisch verzonden of opgeslagen.',
        {style:'FooterNote',mergeAcross:3}
      )
    ])
  );

  const generatedAt=new Date();

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Vastgoed-dashboard</Author>
  <Created>${generatedAt.toISOString()}</Created>
  <Title>Concept huuraanpassing ${excelXmlEscape(r.object||'')}</Title>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Arial" ss:Size="11"/>
  </Style>
  <Style ss:ID="ConceptNotice">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:Bold="1" ss:Color="#9A3412"/>
   <Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
   </Borders>
  </Style>
  <Style ss:ID="SubjectLabel"><Font ss:Bold="1"/></Style>
  <Style ss:ID="Subject"><Font ss:Bold="1"/></Style>
  <Style ss:ID="WrapText"><Alignment ss:WrapText="1" ss:Vertical="Top"/></Style>
  <Style ss:ID="CurrencySymbol"><Alignment ss:Horizontal="Right"/></Style>
  <Style ss:ID="Money"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="MoneyUnderline">
   <Alignment ss:Horizontal="Right"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders>
  </Style>
  <Style ss:ID="IndexNumber"><NumberFormat ss:Format="0.000"/></Style>
  <Style ss:ID="CalculationHeading"><Font ss:Bold="1" ss:Italic="1"/></Style>
  <Style ss:ID="FinalLabel"><Font ss:Bold="1" ss:Italic="1"/></Style>
  <Style ss:ID="FinalCurrency">
   <Alignment ss:Horizontal="Right"/>
   <Font ss:Bold="1" ss:Italic="1"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3"/>
   </Borders>
  </Style>
  <Style ss:ID="FinalMoney">
   <Alignment ss:Horizontal="Right"/>
   <Font ss:Bold="1" ss:Italic="1"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3"/>
   </Borders>
  </Style>
  <Style ss:ID="OverrideNote">
   <Alignment ss:WrapText="1" ss:Vertical="Center"/>
   <Font ss:Size="10"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
   </Borders>
  </Style>
  <Style ss:ID="FooterNote">
   <Alignment ss:WrapText="1"/>
   <Font ss:Italic="1" ss:Size="9" ss:Color="#64748B"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Conceptbrief">
  <Table ss:ExpandedColumnCount="4" ss:ExpandedRowCount="${rows.length}" x:FullColumns="1" x:FullRows="1">
   <Column ss:Width="250"/>
   <Column ss:Width="105"/>
   <Column ss:Width="28"/>
   <Column ss:Width="92"/>
   ${rows.join('\n   ')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <PageSetup>
    <Layout x:Orientation="Portrait"/>
    <PageMargins x:Bottom="0.75" x:Left="0.75" x:Right="0.75" x:Top="0.75"/>
   </PageSetup>
   <Print>
    <ValidPrinterInfo/>
    <PaperSizeIndex>9</PaperSizeIndex>
    <HorizontalResolution>600</HorizontalResolution>
    <VerticalResolution>600</VerticalResolution>
   </Print>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

function downloadRentConceptExcel(){
  const message=el('rentIncreaseMessage');
  const button=el('rentLetterExcelBtn');

  try{
    if(button) button.disabled=true;
    if(message) message.textContent='Bewerkbare Excel-conceptbrief wordt gemaakt...';

    const data=proposalLetterData();
    const xml=createRentLetterExcelXml(data);
    const blob=new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');

    link.href=url;
    link.download=rentLetterDownloadName(data);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);

    if(message){
      message.textContent='Excel-conceptbrief gedownload. Het bestand is lokaal en volledig bewerkbaar.';
    }
  }catch(error){
    console.error(error);
    if(message) message.textContent='Excel-conceptbrief kan niet worden gemaakt: '+error.message;
  }finally{
    if(button) button.disabled=false;
  }
}

async function markRentNotIncreased(propertyId,effectiveDate){
  const r=getPropertyById(propertyId);
  if(!r||!r.contract?.id) return;

  const targetDate=effectiveDate||rentIncreaseEffectiveDate(r);
  if(!targetDate){
    alert('De ingangsmaand van de huurverhoging ontbreekt bij dit object.');
    return;
  }

  if(!rentIncreaseSetupReady){
    alert('Voer eerst het meegeleverde Supabase SQL-bestand uit.');
    return;
  }

  const year=targetDate.slice(0,4);
  if(!confirm(`Wil je voor ${r.object} in ${year} geen huurverhoging toepassen? De maandhuur en servicekosten blijven ongewijzigd.`)) return;

  const periods=rentReferencePeriods(targetDate);
  const oldEntry=cbsIndexCache.values.get(monthKeyFromIso(periods.oldDate));
  const newEntry=cbsIndexCache.values.get(monthKeyFromIso(periods.newDate));
  const oldIndex=Number(oldEntry?.value)||1;
  const newIndex=Number(newEntry?.value)||oldIndex;

  const payload={
    property_id:r.id,
    contract_id:r.contract.id,
    effective_date:targetDate,
    current_rent:Number(r.huur_pm||0),
    service_costs:Number(r.servicekosten||0),
    old_period:monthKeyFromIso(periods.oldDate),
    new_period:monthKeyFromIso(periods.newDate),
    old_index:oldIndex,
    new_index:newIndex,
    calculated_percentage:0,
    calculated_rent:Number(r.huur_pm||0),
    final_rent:Number(r.huur_pm||0),
    override_reason:'Bewust geen huurverhoging toegepast',
    notes:`De bestaande huur is in ${year} ongewijzigd voortgezet.`,
    status:'Concept',
    skip_increase:true,
    cbs_table:CBS_TABLE_ID,
    cbs_measure:'CPI',
    cbs_category:'000000 Alle bestedingen',
    cbs_is_provisional:Boolean(oldEntry?.provisional||newEntry?.provisional),
    updated_at:new Date().toISOString()
  };

  const result=await sb
    .from('rent_increase_proposals')
    .upsert(payload,{onConflict:'contract_id,effective_date'})
    .select()
    .single();

  if(result.error) throw result.error;

  const index=rawRentIncreaseProposals.findIndex(item=>
    item.id===result.data.id ||
    (item.contract_id===result.data.contract_id&&item.effective_date===result.data.effective_date)
  );
  if(index>=0) rawRentIncreaseProposals[index]=result.data;
  else rawRentIncreaseProposals.push(result.data);

  if(activeRentContext?.r?.id===r.id){
    activeRentContext.proposal=result.data;
    closeRentIncreaseModal();
  }

  await loadData();
  renderFinancialOverview(filtered());
}

async function skipActiveRentIncrease(){
  const message=el('rentIncreaseMessage');
  try{
    if(!activeRentContext) return;
    message.textContent='Keuze wordt opgeslagen...';
    await markRentNotIncreased(activeRentContext.r.id,el('rentEffectiveDate').value||activeRentContext.effectiveDate);
  }catch(error){
    console.error(error);
    message.textContent='Opslaan mislukt: '+error.message;
  }
}

async function applyRentIncrease(){
  const message=el('rentIncreaseMessage');
  if(el('rentProposalStatus').value!=='Goedgekeurd'){
    message.textContent='Zet de status eerst op Goedgekeurd.';
    return;
  }
  if(!confirm('Is de brief gecontroleerd en handmatig verzonden? Daarna wordt de nieuwe huur in het dashboard verwerkt.')) return;
  message.textContent='Huurverhoging wordt verwerkt...';
  try{
    const proposal=await persistRentProposal();
    const result=await sb.rpc('apply_rent_increase',{p_proposal_id:proposal.id});
    if(result.error) throw result.error;
    message.textContent='Huurverhoging verwerkt: maandhuur en servicekosten zijn apart bijgewerkt en opgenomen in de huurhistorie.';
    await loadData();
    closeRentIncreaseModal();
    setPage('financieel','Financieel');
  }catch(error){
    console.error(error);
    message.textContent='Verwerken mislukt: '+error.message;
  }
}


function setFinancialTab(tab){
  activeFinancialTab=tab==='service'?'service':'rent';
  document.querySelectorAll('.financialTab').forEach(button=>{
    const active=button.dataset.financialTab===activeFinancialTab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
  });
  el('financialRentPanel')?.classList.toggle('active',activeFinancialTab==='rent');
  el('financialServicePanel')?.classList.toggle('active',activeFinancialTab==='service');
  if(activeFinancialTab==='rent') loadCbsIndexData(false);
  renderFinancialPage(filtered());
}

function renderFinancialPage(data){
  renderFinancialOverview(data);
  renderServiceCostOverview(data);
}

function serviceCostRowYear(row){
  const explicit=Number(row.settlement_year);
  if(Number.isInteger(explicit)&&explicit>=2000&&explicit<=2200) return explicit;
  const value=row.done_date||row.planned_date||'';
  const parts=isoParts(value);
  return parts?.year||null;
}

function serviceCostRowsFor(propertyId,year){
  return maintenanceSourceRows(vastgoedData)
    .filter(row=>row.objectId===propertyId&&row.is_service_cost&&serviceCostRowYear(row)===Number(year))
    .sort((a,b)=>String(a.done_date||a.planned_date||'9999').localeCompare(String(b.done_date||b.planned_date||'9999'))||compareMaintenanceType(a,b));
}

function allocatedServiceCost(row){
  const cost=Number(row.cost||0);
  const percentage=Number.isFinite(Number(row.allocation_percentage))?Number(row.allocation_percentage):100;
  return Math.round((cost*Math.max(0,Math.min(100,percentage))/100)*100)/100;
}

function contractMonthsInYear(r,year){
  const y=Number(year);
  const yearStart=y*12;
  const yearEnd=yearStart+11;
  const start=isoParts(r.startdatum_contract);
  const end=isoParts(r.einddatum_contract||r.oorspronkelijke_einddatum_contract);
  const first=start?start.year*12+(start.month-1):yearStart;
  const last=end?end.year*12+(end.month-1):yearEnd;
  const overlapStart=Math.max(yearStart,first);
  const overlapEnd=Math.min(yearEnd,last);
  return Math.max(0,overlapEnd-overlapStart+1);
}

function serviceCostSettlementFor(contractId,year){
  return rawServiceCostSettlements.find(item=>item.contract_id===contractId&&Number(item.settlement_year)===Number(year))||null;
}

function serviceCostContext(r,year=serviceCostYear){
  const rows=serviceCostRowsFor(r.id,year);
  const proposal=serviceCostSettlementFor(r.contract?.id,year);
  const months=proposal?.months_charged??contractMonthsInYear(r,year);
  const calculatedAdvance=Math.round(Number(r.servicekosten||0)*Number(months||0)*100)/100;
  const calculatedActual=Math.round(rows.reduce((sum,row)=>sum+allocatedServiceCost(row),0)*100)/100;
  const advancePaid=proposal?.advance_paid??calculatedAdvance;
  const actualCosts=proposal?.actual_costs??calculatedActual;
  const balance=proposal?.final_balance??Math.round((Number(actualCosts)-Number(advancePaid))*100)/100;
  const unchecked=rows.filter(row=>!row.service_cost_approved).length;
  return {r,year:Number(year),rows,proposal,months:Number(months||0),calculatedAdvance,calculatedActual,advancePaid:Number(advancePaid||0),actualCosts:Number(actualCosts||0),balance:Number(balance||0),unchecked};
}

function serviceCostContextStatus(context){
  if(!context.r.contract?.id) return ['Geen contract','danger'];
  if(context.proposal?.status==='Verwerkt') return ['Verwerkt','ok'];
  if(context.proposal?.status==='Goedgekeurd') return ['Goedgekeurd','ok'];
  if(context.proposal) return ['Concept','warning'];
  if(!Number(context.r.servicekosten)&&!context.rows.length) return ['Geen gegevens','warning'];
  if(!Number(context.r.servicekosten)) return ['Voorschot ontbreekt','warning'];
  if(!context.rows.length) return ['Geen kosten gekoppeld','warning'];
  if(context.unchecked) return ['Controle nodig','warning'];
  return ['Klaar voor concept','ok'];
}

function fillServiceCostYearOptions(){
  const select=el('serviceCostYear');
  if(!select) return;
  const current=new Date().getFullYear();
  const years=[];
  for(let year=current+1;year>=current-6;year--) years.push(year);
  if(!years.includes(Number(serviceCostYear))) years.push(Number(serviceCostYear));
  years.sort((a,b)=>b-a);
  select.innerHTML=years.map(year=>`<option value="${year}" ${Number(serviceCostYear)===year?'selected':''}>${year}</option>`).join('');
}

function renderServiceCostOverview(data){
  const overview=el('serviceCostOverview');
  const table=el('serviceCostTable');
  if(!overview||!table) return;
  fillServiceCostYearOptions();
  const contexts=data
    .filter(r=>r.contract?.id)
    .map(r=>serviceCostContext(r,serviceCostYear))
    .filter(context=>context.months>0||context.rows.length||context.proposal)
    .sort((a,b)=>compareObjectAddress(a.r,b.r));
  const totalAdvance=contexts.reduce((sum,c)=>sum+Number(c.advancePaid||0),0);
  const totalActual=contexts.reduce((sum,c)=>sum+Number(c.actualCosts||0),0);
  const toCollect=contexts.reduce((sum,c)=>sum+Math.max(0,Number(c.balance||0)),0);
  const toRefund=contexts.reduce((sum,c)=>sum+Math.max(0,-Number(c.balance||0)),0);
  const needsCheck=contexts.filter(c=>serviceCostContextStatus(c)[1]!=='ok').length;
  overview.innerHTML=`<div class="financialSource"><span><strong>Berekening:</strong> gemarkeerde onderhoudskosten minus betaalde voorschotten</span><span>Alleen regels met “Doorbelasten via servicekosten: Ja” worden meegenomen.</span></div>
  <div class="cards financialSummaryCards">
    <div class="card"><span>Betaalde voorschotten</span><strong>${euro2(totalAdvance)}</strong></div>
    <div class="card"><span>Werkelijke kosten</span><strong>${euro2(totalActual)}</strong></div>
    <div class="card"><span>Nog te ontvangen</span><strong>${euro2(toCollect)}</strong></div>
    <div class="card"><span>Terug te betalen</span><strong>${euro2(toRefund)}</strong></div>
    <div class="card"><span>Controle nodig</span><strong>${needsCheck}</strong></div>
  </div>`;

  table.innerHTML=`<tr><th>Object</th><th>Huurder</th><th>Periode</th><th>Voorschot</th><th>Werkelijke kosten</th><th>Saldo</th><th>Status</th><th>Acties</th></tr>`+
    contexts.map(context=>{
      const status=serviceCostContextStatus(context);
      const balanceLabel=context.balance>0?'Bijbetalen':context.balance<0?'Terugbetalen':'In evenwicht';
      const balanceClass=context.balance>0?'pay':context.balance<0?'refund':'';
      return `<tr>
        <td><strong>${escHtml(context.r.object)}</strong><span class="subtle">${escHtml([context.r.straatnaam,context.r.huisnummer].filter(Boolean).join(' '))}</span></td>
        <td>${escHtml(context.r.huurder)}</td>
        <td>${context.year}<span class="rentStatusText">${context.months} ${context.months===1?'maand':'maanden'}</span></td>
        <td>${euro2(context.advancePaid)}<span class="rentStatusText">${euro2(context.r.servicekosten)} per maand</span></td>
        <td>${euro2(context.actualCosts)}<span class="rentStatusText">${context.rows.length} kostenregels${context.unchecked?` · ${context.unchecked} niet gecontroleerd`:''}</span></td>
        <td>${euro2(Math.abs(context.balance))}<span class="serviceCostBalance ${balanceClass}">${balanceLabel}</span></td>
        <td>${statusBadge(status)}</td>
        <td><div class="financialActionGroup"><button class="miniLink serviceCostEditBtn" data-id="${context.r.id}" data-year="${context.year}">${context.proposal?'Bekijken':'Berekenen'}</button>${context.proposal?`<button class="miniLink serviceCostQuickLetterBtn" data-id="${context.r.id}" data-year="${context.year}">Conceptafrekening</button>`:''}</div></td>
      </tr>`;
    }).join('')||'<tr><td colspan="8">Geen contracten of servicekostengegevens voor dit jaar gevonden.</td></tr>';

  if(!serviceCostSetupReady){
    overview.insertAdjacentHTML('afterbegin','<div class="importNotice warning"><strong>Eenmalige Supabase-instelling nodig</strong><span>Voer het nieuwe SQL-bestand uit voordat je onderhoud als servicekosten markeert of afrekeningen opslaat.</span></div>');
  }
}

function openServiceCostModal(propertyId,year=serviceCostYear){
  const r=getPropertyById(propertyId);
  if(!r) return;
  const context=serviceCostContext(r,Number(year));
  activeServiceCostContext=context;
  const proposal=context.proposal;
  el('serviceCostSettlementId').value=proposal?.id||'';
  el('serviceCostPropertyId').value=r.id;
  el('serviceCostContractId').value=r.contract?.id||'';
  el('serviceCostModalTitle').textContent=`Servicekostenafrekening · ${r.object}`;
  el('serviceCostModalMeta').textContent=`${r.huurder} · afrekenjaar ${context.year}`;
  el('serviceMonthlyAdvance').textContent=euro2(r.servicekosten);
  el('serviceSettlementYear').value=context.year;
  el('serviceSettlementStatus').value=proposal?.status||'Concept';
  el('serviceMonthsCharged').value=context.months;
  el('serviceFinalAdvance').value=Number(context.advancePaid).toFixed(2);
  el('serviceFinalActual').value=Number(context.actualCosts).toFixed(2);
  el('serviceCorrectionReason').value=proposal?.correction_reason||'';
  el('serviceSettlementNotes').value=proposal?.notes||'';
  el('serviceCostModalMessage').textContent='';
  renderServiceCostLines(context.rows);
  updateServiceCostModalCalculation();
  const warnings=[];
  if(!context.rows.length) warnings.push('Er zijn nog geen onderhoudsregels als servicekosten gemarkeerd voor dit afrekenjaar.');
  if(context.unchecked) warnings.push(`${context.unchecked} kostenregel(s) zijn nog niet als gecontroleerd gemarkeerd.`);
  if(!Number(r.servicekosten)) warnings.push('Het maandelijkse voorschot servicekosten ontbreekt bij het object.');
  el('serviceCostWarning').textContent=warnings.join(' ');
  el('serviceCostWarning').classList.toggle('hidden',!warnings.length);
  el('serviceCostModal').classList.remove('hidden');
}

function closeServiceCostModal(){
  el('serviceCostModal').classList.add('hidden');
  activeServiceCostContext=null;
}

function renderServiceCostLines(rows){
  const target=el('serviceCostLines');
  if(!target) return;
  target.innerHTML=`<tr><th>Categorie</th><th>Onderhoud</th><th>Datum</th><th>Factuurbedrag</th><th>Aandeel</th><th>Meegenomen</th><th>Controle</th></tr>`+
    rows.map(row=>`<tr><td>${escHtml(row.service_cost_category||'Overig')}</td><td>${escHtml(row.type)}</td><td>${maintenanceDateFmt(row.done_date||row.planned_date)}</td><td>${euro2(row.cost)}</td><td>${Number(row.allocation_percentage??100).toFixed(2).replace('.',',')}%</td><td>${euro2(allocatedServiceCost(row))}</td><td><span class="serviceCostTag ${row.service_cost_approved?'':'unchecked'}">${row.service_cost_approved?'Gecontroleerd':'Nog controleren'}</span></td></tr>`).join('')||'<tr><td colspan="7">Geen kostenregels gekoppeld.</td></tr>';
}

function updateServiceCostModalCalculation(){
  if(!activeServiceCostContext) return;
  const months=Math.max(0,Math.min(12,Number(el('serviceMonthsCharged').value)||0));
  const calculatedAdvance=Math.round(Number(activeServiceCostContext.r.servicekosten||0)*months*100)/100;
  const advance=Number(el('serviceFinalAdvance').value)||0;
  const actual=Number(el('serviceFinalActual').value)||0;
  const balance=Math.round((actual-advance)*100)/100;
  el('serviceCalculatedAdvance').textContent=euro2(calculatedAdvance);
  el('serviceCalculatedAdvance').dataset.value=calculatedAdvance;
  el('serviceCalculatedActual').textContent=euro2(activeServiceCostContext.calculatedActual);
  el('serviceCalculatedBalance').textContent=balance>0?`${euro2(balance)} bijbetalen`:balance<0?`${euro2(Math.abs(balance))} terugbetalen`:'€ 0,00';
}

function serviceCostPayload(){
  if(!activeServiceCostContext) throw new Error('Geen servicekostenafrekening geselecteerd.');
  const months=Math.max(0,Math.min(12,Math.round(Number(el('serviceMonthsCharged').value)||0)));
  const advance=Number(el('serviceFinalAdvance').value);
  const actual=Number(el('serviceFinalActual').value);
  if(!Number.isFinite(advance)||advance<0||!Number.isFinite(actual)||actual<0) throw new Error('Vul geldige bedragen in.');
  const calculatedAdvance=Math.round(Number(activeServiceCostContext.r.servicekosten||0)*months*100)/100;
  const calculatedActual=activeServiceCostContext.calculatedActual;
  const reason=clean(el('serviceCorrectionReason').value);
  if((Math.abs(advance-calculatedAdvance)>0.01||Math.abs(actual-calculatedActual)>0.01)&&!reason){
    throw new Error('Vul een reden in wanneer het voorschot of de werkelijke kosten afwijken van de automatische berekening.');
  }
  return {
    property_id:activeServiceCostContext.r.id,
    contract_id:activeServiceCostContext.r.contract.id,
    tenant_id:activeServiceCostContext.r.tenant?.id||null,
    settlement_year:Number(el('serviceSettlementYear').value),
    period_start:`${el('serviceSettlementYear').value}-01-01`,
    period_end:`${el('serviceSettlementYear').value}-12-31`,
    monthly_advance:Number(activeServiceCostContext.r.servicekosten||0),
    months_charged:months,
    calculated_advance:calculatedAdvance,
    advance_paid:advance,
    calculated_actual_costs:calculatedActual,
    actual_costs:actual,
    calculated_balance:Math.round((calculatedActual-calculatedAdvance)*100)/100,
    final_balance:Math.round((actual-advance)*100)/100,
    correction_reason:reason||null,
    notes:clean(el('serviceSettlementNotes').value)||null,
    status:el('serviceSettlementStatus').value,
    updated_at:new Date().toISOString()
  };
}

async function persistServiceCostSettlement(){
  if(!serviceCostSetupReady) throw new Error('Voer eerst het meegeleverde Supabase SQL-bestand uit.');
  const payload=serviceCostPayload();
  const result=await sb.from('service_cost_settlements').upsert(payload,{onConflict:'contract_id,settlement_year'}).select().single();
  if(result.error) throw result.error;
  const index=rawServiceCostSettlements.findIndex(item=>item.id===result.data.id||(item.contract_id===result.data.contract_id&&Number(item.settlement_year)===Number(result.data.settlement_year)));
  if(index>=0) rawServiceCostSettlements[index]=result.data; else rawServiceCostSettlements.push(result.data);
  activeServiceCostContext.proposal=result.data;
  el('serviceCostSettlementId').value=result.data.id;
  return result.data;
}

async function saveServiceCostSettlement(e){
  e?.preventDefault();
  const message=el('serviceCostModalMessage');
  message.textContent='Concept wordt opgeslagen...';
  try{
    await persistServiceCostSettlement();
    message.textContent='Servicekostenafrekening opgeslagen. Er wordt niets automatisch verzonden of financieel geboekt.';
    renderServiceCostOverview(filtered());
  }catch(error){
    console.error(error);
    message.textContent='Opslaan mislukt: '+error.message;
  }
}

function createServiceCostLetterHtml(data,context){
  const r=context.r;
  const amount=value=>new Intl.NumberFormat('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0));
  const balance=Number(data.final_balance||0);
  const resultText=balance>0
    ? `Nog door u te betalen: € ${amount(balance)}`
    : balance<0
      ? `Aan u terug te betalen: € ${amount(Math.abs(balance))}`
      : 'De betaalde voorschotten en werkelijke kosten zijn gelijk.';
  const lines=context.rows.map(row=>`<tr><td>${escHtml(row.service_cost_category||'Overig')}</td><td>${escHtml(row.type)}</td><td>${maintenanceDateFmt(row.done_date||row.planned_date)}</td><td>€ ${amount(allocatedServiceCost(row))}</td></tr>`).join('');
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><title>Concept servicekostenafrekening ${escHtml(r.object)}</title><style>
    *{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#eef2f7;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.45}.toolbar{width:210mm;margin:18px auto 0;display:flex;gap:12px;align-items:center}.toolbar button{padding:10px 14px;border:0;border-radius:8px;background:#172033;color:#fff;font-weight:700}.notice{color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:9px 12px;font-size:13px}.sheet{width:210mm;min-height:297mm;margin:12px auto 28px;background:#fff;padding:25mm 20mm;box-shadow:0 18px 55px rgba(15,23,42,.16)}h1{font-size:18pt;margin:30mm 0 8mm}p{margin:0 0 5mm}table{width:100%;border-collapse:collapse;margin:8mm 0}th,td{text-align:left;padding:3mm 2mm;border-bottom:1px solid #ccc}th:last-child,td:last-child{text-align:right}.totals{width:85mm;margin-left:auto}.totals div{display:flex;justify-content:space-between;padding:2mm 0;border-bottom:1px solid #ccc}.result{margin-top:8mm;padding:4mm;border:2px solid #111;font-weight:700}.note{margin-top:8mm;font-size:9.5pt;color:#444}@page{size:A4 portrait;margin:25mm 20mm}@media print{body{background:#fff}.toolbar{display:none}.sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Afdrukken / opslaan als PDF</button><div class="notice"><strong>Concept:</strong> controleer de afrekening. Er wordt niets automatisch verzonden.</div></div><main class="sheet">
    <div>${escHtml(r.huurder)}</div><div>${escHtml(r.object)}</div><div>${escHtml([r.straatnaam,r.huisnummer,r.postcode,r.stad].filter(Boolean).join(' '))}</div>
    <h1>Servicekostenafrekening ${data.settlement_year}</h1>
    <p>Hierbij ontvangt u de conceptafrekening van de servicekosten over de periode 1 januari tot en met 31 december ${data.settlement_year}.</p>
    <table><tr><th>Categorie</th><th>Omschrijving</th><th>Datum</th><th>Bedrag</th></tr>${lines||'<tr><td colspan="4">Geen kostenregels opgenomen.</td></tr>'}</table>
    <div class="totals"><div><span>Werkelijke servicekosten</span><strong>€ ${amount(data.actual_costs)}</strong></div><div><span>Betaalde voorschotten</span><strong>€ ${amount(data.advance_paid)}</strong></div></div>
    <div class="result">${escHtml(resultText)}</div>
    ${data.correction_reason?`<p class="note"><strong>Toelichting correctie:</strong> ${escHtml(data.correction_reason)}</p>`:''}
  </main></body></html>`;
}

function openServiceCostLetter(){
  try{
    if(!activeServiceCostContext) throw new Error('Geen afrekening geselecteerd.');
    const data=serviceCostPayload();
    const html=createServiceCostLetterHtml(data,activeServiceCostContext);
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const blobUrl=URL.createObjectURL(blob);
    const popup=window.open('about:blank','_blank');
    if(!popup){URL.revokeObjectURL(blobUrl);throw new Error('De browser blokkeert het nieuwe venster. Sta pop-ups toe voor dit dashboard.');}
    popup.opener=null;
    popup.location.replace(blobUrl);
    window.setTimeout(()=>URL.revokeObjectURL(blobUrl),60_000);
  }catch(error){
    el('serviceCostModalMessage').textContent='Conceptafrekening kan niet worden gemaakt: '+error.message;
  }
}


function cloneNotificationDefaults(){
  return JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS));
}

function normalizeNotificationSettings(row){
  const defaults=cloneNotificationDefaults();
  if(!row) return defaults;
  const rawRules=row.rules&&typeof row.rules==='object'?row.rules:{};
  const rules={};
  Object.entries(DEFAULT_NOTIFICATION_RULES).forEach(([key,defaultRule])=>{
    const source=rawRules[key]&&typeof rawRules[key]==='object'?rawRules[key]:{};
    const sourceDays=Array.isArray(source.days)?source.days:defaultRule.days;
    rules[key]={
      enabled:source.enabled===undefined?defaultRule.enabled:Boolean(source.enabled),
      days:[...new Set(sourceDays.map(Number).filter(value=>Number.isInteger(value)&&value>=0&&value<=365))].sort((a,b)=>b-a)
    };
  });
  return {
    ...defaults,
    ...row,
    id:1,
    recipients:Array.isArray(row.recipients)?row.recipients.filter(Boolean):[],
    send_time:String(row.send_time||defaults.send_time).slice(0,5),
    send_days:row.send_days==='daily'?'daily':'weekdays',
    timezone:'Europe/Amsterdam',
    rules
  };
}

function parseNotificationRecipients(value){
  const recipients=[...new Set(String(value||'').split(/[;,\n]+/).map(item=>item.trim().toLowerCase()).filter(Boolean))];
  if(recipients.length>10) throw new Error('Vul maximaal 10 ontvangers in.');
  const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalid=recipients.filter(email=>!emailPattern.test(email));
  if(invalid.length) throw new Error(`Ongeldig e-mailadres: ${invalid[0]}`);
  return recipients;
}

function fillNotificationSettingsForm(){
  if(!el('notificationSettingsForm')) return;
  const settings=normalizeNotificationSettings(notificationSettings);
  el('notificationEmailEnabled').checked=Boolean(settings.email_enabled);
  el('notificationTestMode').checked=settings.test_mode!==false;
  el('notificationRecipients').value=(settings.recipients||[]).join('\n');
  el('notificationSendTime').value=settings.send_time||'07:30';
  el('notificationSendDays').value=settings.send_days||'weekdays';
  el('notificationTimezone').value='Europe/Amsterdam';
  el('notificationOnlyWhenEvents').checked=settings.only_when_events!==false;

  document.querySelectorAll('[data-notification-rule]').forEach(container=>{
    const key=container.dataset.notificationRule;
    const rule=settings.rules?.[key]||DEFAULT_NOTIFICATION_RULES[key]||{enabled:false,days:[]};
    const enabled=container.querySelector('.notificationRuleEnabled');
    if(enabled) enabled.checked=Boolean(rule.enabled);
    container.querySelectorAll('[data-day]').forEach(input=>{
      input.checked=(rule.days||[]).includes(Number(input.dataset.day));
    });
  });
}

function collectNotificationSettingsForm(){
  const rules={};
  Object.entries(DEFAULT_NOTIFICATION_RULES).forEach(([key,rule])=>{
    rules[key]={enabled:Boolean(rule.enabled),days:[...(rule.days||[])]};
  });
  document.querySelectorAll('[data-notification-rule]').forEach(container=>{
    const key=container.dataset.notificationRule;
    const enabled=Boolean(container.querySelector('.notificationRuleEnabled')?.checked);
    const days=[...container.querySelectorAll('[data-day]:checked')]
      .map(input=>Number(input.dataset.day))
      .filter(value=>Number.isInteger(value)&&value>=0&&value<=365)
      .sort((a,b)=>b-a);
    rules[key]={enabled,days:[...new Set(days)]};
  });
  const sendTime=el('notificationSendTime').value;
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) throw new Error('Vul een geldige verzendtijd in.');
  const recipients=parseNotificationRecipients(el('notificationRecipients').value);
  if(el('notificationEmailEnabled').checked&&!recipients.length) throw new Error('Vul minimaal één ontvanger in voordat je e-mailmeldingen activeert.');
  return {
    id:1,
    email_enabled:el('notificationEmailEnabled').checked,
    test_mode:el('notificationTestMode').checked,
    recipients,
    send_time:sendTime,
    send_days:el('notificationSendDays').value==='daily'?'daily':'weekdays',
    timezone:'Europe/Amsterdam',
    only_when_events:el('notificationOnlyWhenEvents').checked,
    rules,
    updated_at:new Date().toISOString()
  };
}

function notificationDaysBetween(referenceIso,targetIso){
  const reference=isoParts(referenceIso);
  const target=isoParts(targetIso);
  if(!reference||!target) return null;
  const from=Date.UTC(reference.year,reference.month-1,reference.day);
  const to=Date.UTC(target.year,target.month-1,target.day);
  return Math.round((to-from)/86400000);
}

function notificationEmailRule(type){
  if(type==='Opzegdatum') return 'notice_date';
  if(['Contract','Opzegging','Contractcontrole','Contractverlenging'].includes(type)) return 'contract_end';
  if(type==='Onderhoud') return 'maintenance';
  if(type==='Keuring') return 'scope_inspection';
  if(type==='Energielabel') return 'energy_label';
  if(type==='Huurverhoging') return 'rent_increase';
  if(type==='Leegstand') return 'vacancy';
  if(type==='Taak') return 'task';
  if(type==='Huurdersmelding') return 'tenant_report';
  return 'contract_end';
}

function buildEmailNotificationEvents(data,settings){
  const seen=new Set();
  const score={danger:0,warning:1,ok:2};
  return notificationItems(data)
    .filter(item=>{
      const ruleKey=notificationEmailRule(item.type);
      return settings.rules?.[ruleKey]?.enabled!==false;
    })
    .filter(item=>{
      const key=[item.type,item.title,item.objectId||'',item.taskId||'',item.reportId||''].join('|');
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(item=>({
      rule:notificationEmailRule(item.type),
      sev:item.sev||'warning',
      type:item.type||'Melding',
      title:item.title||'Melding',
      detail:item.text||'',
      objectId:item.objectId||null,
      taskId:item.taskId||null,
      reportId:item.reportId||null
    }))
    .sort((a,b)=>(score[a.sev]??9)-(score[b.sev]??9)||a.type.localeCompare(b.type,'nl',{sensitivity:'base'})||a.title.localeCompare(b.title,'nl',{sensitivity:'base'}));
}

function notificationDayLabel(days){
  if(days===0) return 'Vandaag';
  if(days===1) return 'Morgen';
  return `Over ${days} dagen`;
}

function notificationNextRunDate(settings){
  if(!settings.email_enabled) return null;
  const [hours,minutes]=String(settings.send_time||'07:30').split(':').map(Number);
  const now=new Date();
  for(let offset=0;offset<=10;offset++){
    const candidate=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset,hours,minutes,0,0);
    if(settings.send_days==='weekdays'&&[0,6].includes(candidate.getDay())) continue;
    if(candidate>now) return candidate;
  }
  return null;
}

function renderNotificationPreview(settingsOverride=null){
  const target=el('notificationPreview');
  if(!target) return;
  let settings;
  try{
    settings=settingsOverride||collectNotificationSettingsForm();
  }catch(error){
    target.innerHTML=`<div class="notificationEmptyPreview">${escHtml(error.message)}</div>`;
    return;
  }
  const events=buildEmailNotificationEvents(vastgoedData,settings);
  const recipients=settings.recipients.length?settings.recipients.join(', '):'Nog geen ontvanger ingesteld';
  const subject=`Dagelijks vastgoedoverzicht – ${new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'long',year:'numeric'}).format(new Date())} – ${events.length} melding${events.length===1?'':'en'}`;
  const sections=[
    {severity:'danger',title:'Urgent / direct actie nodig'},
    {severity:'warning',title:'Aandacht nodig'},
    {severity:'ok',title:'Openstaande huurdersmeldingen'}
  ];
  const body=events.length
    ? sections.map(section=>{
        const rows=events.filter(event=>event.sev===section.severity);
        if(!rows.length) return '';
        return `<div class="notificationEmailGroup"><h5>${escHtml(section.title)} (${rows.length})</h5>${rows.map(event=>`<div class="notificationEmailEvent"><strong><span class="typeTag">${escHtml(event.type)}</span> ${escHtml(event.title)}</strong><span>${escHtml(event.detail||'')}</span></div>`).join('')}</div>`;
      }).join('')
    : `<div class="notificationEmptyPreview">${settings.only_when_events?'Er zijn geen openstaande meldingen. Er zou geen e-mail worden verstuurd.':'Er zijn geen openstaande meldingen; de overzichtsmail zou leeg zijn.'}</div>`;
  const connectionText=notificationFunctionStatus.outlookConfigured
    ? (settings.test_mode?'Testmodus actief':'Productiemodus')
    : 'Outlook-koppeling nog niet compleet';
  target.innerHTML=`<div class="notificationEmailHeader"><div><strong>Aan:</strong> ${escHtml(recipients)}</div><div><strong>Onderwerp:</strong> ${escHtml(subject)}</div><div><strong>Modus:</strong> ${escHtml(connectionText)}</div></div><div class="notificationEmailBody"><h4>Dagelijks vastgoedoverzicht</h4><p>Dit overzicht bevat alle meldingen die op dit moment in het dashboard om aandacht vragen.</p>${body}</div>`;

  const next=notificationNextRunDate(settings);
  if(el('notificationNextRun')){
    el('notificationNextRun').textContent=!settings.email_enabled
      ? 'Uitgeschakeld'
      : next
        ? `${new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(next)}`
        : 'Nog niet berekend';
  }
}

function renderNotificationLog(){
  const target=el('notificationLog');
  if(!target) return;
  if(!rawEmailNotificationLogs.length){
    target.innerHTML='<p class="empty">Nog geen verzendingen geregistreerd.</p>';
    if(el('notificationLastRun')) el('notificationLastRun').textContent='Nog geen verzending';
    return;
  }
  const statusLabels={processing:'Bezig',sent:'Verzonden',failed:'Mislukt',skipped:'Overgeslagen',test:'Test'};
  target.innerHTML=`<div class="notificationLogWrap"><table class="notificationLogTable"><tr><th>Datum</th><th>Ontvanger</th><th>Gebeurtenissen</th><th>Status</th><th>Toelichting</th></tr>${rawEmailNotificationLogs.map(item=>`<tr><td>${escHtml(new Date(item.created_at||item.run_date).toLocaleString('nl-NL'))}</td><td>${escHtml(item.recipient||'-')}</td><td>${Number(item.event_count||0)}</td><td><span class="notificationLogStatus ${escAttr(item.status||'')}">${escHtml(statusLabels[item.status]||item.status||'-')}</span></td><td>${escHtml(item.error_message||item.subject||'-')}</td></tr>`).join('')}</table></div>`;
  const latest=rawEmailNotificationLogs[0];
  if(el('notificationLastRun')) el('notificationLastRun').textContent=`${new Date(latest.created_at||latest.run_date).toLocaleString('nl-NL')} · ${statusLabels[latest.status]||latest.status}`;
}

function renderNotificationConnectionStatus(){
  const wrapper=el('notificationConnectionStatus');
  const badge=el('notificationConnectionBadge');
  const title=el('notificationConnectionTitle');
  const text=el('notificationConnectionText');
  const sender=el('notificationSenderAddress');
  if(!wrapper||!badge||!title||!text) return;

  badge.classList.remove('ok','warning','danger');
  if(notificationFunctionStatus.outlookConfigured&&notificationFunctionStatus.schedulerKeyConfigured){
    badge.classList.add('ok');
    badge.textContent='Gekoppeld';
    title.textContent='Outlook en veilige planner zijn ingesteld';
    text.textContent='Testmails kunnen worden verstuurd. Automatische verzending start zodra testmodus uitstaat en e-mailmeldingen actief zijn.';
  }else if(notificationFunctionStatus.outlookConfigured){
    badge.classList.add('warning');
    badge.textContent='Deels gereed';
    title.textContent='Outlook is gekoppeld, planner nog niet';
    text.textContent='Testmails werken. Voer daarna het cron-SQL-bestand uit voor automatische verzending.';
  }else if(notificationFunctionStatus.reachable){
    badge.classList.add('warning');
    badge.textContent='Configuratie nodig';
    title.textContent='Edge Function actief, Outlook nog niet compleet';
    text.textContent='Voeg de vier Microsoft-gegevens toe aan Edge Function Secrets.';
  }else{
    badge.classList.add('danger');
    badge.textContent='Niet gekoppeld';
    title.textContent='E-mailfunctie niet bereikbaar';
    text.textContent=notificationFunctionStatus.error||'Deploy eerst de meegeleverde Edge Function.';
  }
  if(sender) sender.textContent=notificationFunctionStatus.sender||'Nog niet gekoppeld';
}

async function loadNotificationFunctionStatus(){
  if(!sb||!el('notificationConnectionStatus')) return;
  try{
    const {data,error}=await sb.functions.invoke('send-property-notifications',{body:{mode:'status'}});
    if(error) throw error;
    notificationFunctionStatus={
      reachable:true,
      outlookConfigured:Boolean(data?.outlookConfigured),
      sender:data?.sender||'',
      schedulerKeyConfigured:Boolean(data?.schedulerKeyConfigured),
      error:''
    };
  }catch(error){
    console.warn('E-mailfunctie status niet beschikbaar:',error.message);
    notificationFunctionStatus={reachable:false,outlookConfigured:false,sender:'',schedulerKeyConfigured:false,error:'De e-mailfunctie is nog niet gedeployed of niet bereikbaar.'};
  }
  renderNotificationConnectionStatus();
  renderNotificationPreview(notificationSettings);
}

async function reloadNotificationLogs(){
  const result=await sb.from('email_notification_log').select('*').order('created_at',{ascending:false}).limit(20);
  if(result.error) throw result.error;
  rawEmailNotificationLogs=result.data||[];
  renderNotificationLog();
}

async function persistNotificationSettings(payload){
  if(!notificationSettingsReady) throw new Error('Voer eerst het meegeleverde Supabase SQL-bestand uit.');
  const {data:sessionData}=await sb.auth.getSession();
  payload.updated_by=sessionData.session?.user?.id||null;
  const result=await sb.from('notification_settings').upsert(payload,{onConflict:'id'}).select().single();
  if(result.error) throw result.error;
  notificationSettings=normalizeNotificationSettings(result.data);
  return notificationSettings;
}

function renderNotificationSettings(){
  if(!el('notificationSettingsForm')) return;
  fillNotificationSettingsForm();
  el('notificationSetupWarning')?.classList.toggle('hidden',notificationSettingsReady);
  renderNotificationConnectionStatus();
  renderNotificationPreview(notificationSettings);
  renderNotificationLog();
}

async function saveNotificationSettings(event){
  event.preventDefault();
  const message=el('notificationSettingsMessage');
  message.textContent='Instellingen worden opgeslagen...';
  try{
    await persistNotificationSettings(collectNotificationSettingsForm());
    message.textContent='Instellingen opgeslagen.';
    renderNotificationSettings();
  }catch(error){
    console.error(error);
    message.textContent='Opslaan mislukt: '+error.message;
  }
}

async function sendNotificationTestMail(){
  const message=el('notificationSettingsMessage');
  const button=el('testNotificationBtn');
  message.textContent='Instellingen worden opgeslagen en de testmail wordt voorbereid...';
  if(button){button.disabled=true;button.textContent='Testmail wordt verstuurd...';}
  try{
    const settings=collectNotificationSettingsForm();
    if(!settings.recipients.length) throw new Error('Vul eerst minimaal één ontvanger in.');
    await persistNotificationSettings(settings);
    renderNotificationPreview(notificationSettings);
    const {data,error}=await sb.functions.invoke('send-property-notifications',{body:{mode:'test'}});
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.error||'De testmail kon niet worden verstuurd.');
    await reloadNotificationLogs();
    message.textContent=`Testmail verzonden naar ${data.recipient}. Er zijn ${Number(data.eventCount||0)} gebeurtenis(sen) opgenomen.`;
    await loadNotificationFunctionStatus();
  }catch(error){
    console.error(error);
    let detail=error.message||String(error);
    if(error?.context){
      try{
        const payload=await error.context.json();
        if(payload?.error) detail=payload.error;
      }catch(_ignored){}
    }
    message.textContent='Testmail mislukt: '+detail;
    try{await reloadNotificationLogs();}catch(_ignored){}
  }finally{
    if(button){button.disabled=false;button.textContent='Testmail versturen';}
  }
}

const DEFAULT_BRANDING={
  company_name:'Vastgoed',
  dashboard_name:'Dashboard',
  letter_city:'',
  public_issue_page_url:'',
  login_subtitle:'Log in om je vastgoeddata te bekijken.',
  browser_title:'Vastgoed Dashboard',
  primary_color:'#101827',
  accent_color:'#94a3b8',
  logo_url:'',
  favicon_url:''
};
let branding={...DEFAULT_BRANDING};
const brandingSignedUrlCache={};
function validHex(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||''))?value:fallback;}

const transparentLogoCache={};

function colorDistance(a,b){
  const dr=a[0]-b[0], dg=a[1]-b[1], db=a[2]-b[2];
  return Math.sqrt(dr*dr+dg*dg+db*db);
}

async function removeUniformLogoBackground(url){
  if(!url) return '';
  if(transparentLogoCache[url]) return transparentLogoCache[url];

  try{
    const response=await fetch(url,{mode:'cors',credentials:'omit'});
    if(!response.ok) throw new Error(`Logo ophalen mislukt (${response.status})`);
    const blob=await response.blob();
    const bitmap=await createImageBitmap(blob);

    const maxSide=1600;
    const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
    const width=Math.max(1,Math.round(bitmap.width*scale));
    const height=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0,width,height);
    if(bitmap.close) bitmap.close();

    const image=ctx.getImageData(0,0,width,height);
    const data=image.data;
    const pixel=(x,y)=>{
      const i=(y*width+x)*4;
      return [data[i],data[i+1],data[i+2],data[i+3]];
    };
    const corners=[
      pixel(0,0),pixel(width-1,0),pixel(0,height-1),pixel(width-1,height-1),
      pixel(Math.min(2,width-1),Math.min(2,height-1)),
      pixel(Math.max(0,width-3),Math.min(2,height-1)),
      pixel(Math.min(2,width-1),Math.max(0,height-3)),
      pixel(Math.max(0,width-3),Math.max(0,height-3))
    ];

    // Een echt transparante PNG hoeft niet bewerkt te worden.
    if(corners.filter(c=>c[3]<32).length>=4){
      transparentLogoCache[url]=url;
      return url;
    }

    const opaque=corners.filter(c=>c[3]>220);
    if(opaque.length<4){
      transparentLogoCache[url]=url;
      return url;
    }

    const base=[0,0,0,255];
    for(let c=0;c<3;c++) base[c]=Math.round(opaque.reduce((sum,p)=>sum+p[c],0)/opaque.length);

    // Alleen een vrijwel egale achtergrond wordt weggehaald.
    const cornerSpread=Math.max(...opaque.map(c=>colorDistance(c,base)));
    if(cornerSpread>45){
      transparentLogoCache[url]=url;
      return url;
    }

    const distanceAt=idx=>{
      const i=idx*4;
      return colorDistance([data[i],data[i+1],data[i+2],data[i+3]],base);
    };

    // Verwijdert ook de witte waas langs letters, zodat er geen lichte rand achterblijft.
    const clearPixel=(idx,inner=false)=>{
      const i=idx*4;
      const distance=distanceAt(idx);
      const fullyTransparent=inner?34:40;
      const softLimit=inner?105:88;
      if(distance<=fullyTransparent){
        data[i+3]=0;
        return;
      }
      if(distance>=softLimit) return;

      const alpha=Math.max(0.03,Math.min(1,(distance-fullyTransparent)/(softLimit-fullyTransparent)));
      const originalAlpha=data[i+3]/255;

      // Haal de gemengde achtergrondkleur uit anti-aliased randpixels.
      for(let channel=0;channel<3;channel++){
        const foreground=(data[i+channel]-(1-alpha)*base[channel])/alpha;
        data[i+channel]=Math.max(0,Math.min(255,Math.round(foreground)));
      }
      data[i+3]=Math.round(originalAlpha*alpha*255);
    };

    // Stap 1: verwijder de egale achtergrond die met de buitenrand verbonden is.
    const visited=new Uint8Array(width*height);
    const queue=new Int32Array(width*height);
    let head=0,tail=0;
    const addOuter=(x,y)=>{
      if(x<0||y<0||x>=width||y>=height) return;
      const idx=y*width+x;
      if(visited[idx]) return;
      const i=idx*4;
      if(data[i+3]===0 || distanceAt(idx)<=88){
        visited[idx]=1;
        queue[tail++]=idx;
      }
    };

    for(let x=0;x<width;x++){addOuter(x,0);addOuter(x,height-1);}
    for(let y=0;y<height;y++){addOuter(0,y);addOuter(width-1,y);}

    while(head<tail){
      const idx=queue[head++];
      const x=idx%width;
      const y=(idx/width)|0;
      clearPixel(idx,false);
      addOuter(x-1,y);addOuter(x+1,y);addOuter(x,y-1);addOuter(x,y+1);
    }

    // Stap 2: verwijder kleine, ingesloten achtergrondvlakjes in letters zoals O, P, R en B.
    // Deze vlakjes raken de buitenrand niet en bleven daardoor in de vorige versie wit.
    const componentSeen=new Uint8Array(width*height);
    const componentQueue=new Int32Array(width*height);
    const componentPixels=[];
    const maxEnclosedArea=Math.max(64,Math.round(width*height*0.12));

    for(let startIdx=0;startIdx<width*height;startIdx++){
      if(visited[startIdx]||componentSeen[startIdx]) continue;
      const i=startIdx*4;
      if(data[i+3]===0||distanceAt(startIdx)>105) continue;

      let cHead=0,cTail=0;
      componentPixels.length=0;
      componentSeen[startIdx]=1;
      componentQueue[cTail++]=startIdx;
      let touchesBorder=false;

      while(cHead<cTail){
        const idx=componentQueue[cHead++];
        componentPixels.push(idx);
        const x=idx%width;
        const y=(idx/width)|0;
        if(x===0||y===0||x===width-1||y===height-1) touchesBorder=true;

        const neighbours=[idx-1,idx+1,idx-width,idx+width];
        for(const next of neighbours){
          if(next<0||next>=width*height||componentSeen[next]||visited[next]) continue;
          const nx=next%width;
          const ny=(next/width)|0;
          if(Math.abs(nx-x)+Math.abs(ny-y)!==1) continue;
          const ni=next*4;
          if(data[ni+3]===0||distanceAt(next)>105) continue;
          componentSeen[next]=1;
          componentQueue[cTail++]=next;
        }
      }

      if(!touchesBorder&&componentPixels.length<=maxEnclosedArea){
        componentPixels.forEach(idx=>clearPixel(idx,true));
      }
    }

    ctx.putImageData(image,0,0);
    const result=canvas.toDataURL('image/png');
    transparentLogoCache[url]=result;
    return result;
  }catch(error){
    console.warn('Logo-achtergrond kon niet automatisch worden verwijderd:',error.message);
    transparentLogoCache[url]=url;
    return url;
  }
}

async function setImage(id,url,{cleanBackground=false}={}){
  const node=el(id);
  if(!node) return;
  const area=id==='sidebarLogo' ? el('sidebarLogoArea') : null;
  const hideImage=()=>{
    node.classList.add('hidden');
    node.removeAttribute('src');
    if(area) area.classList.add('hidden');
  };
  node.onerror=hideImage;
  if(!url){
    hideImage();
    return;
  }

  const finalUrl=cleanBackground ? await removeUniformLogoBackground(url) : url;
  node.src=finalUrl;
  node.classList.remove('hidden');
  if(area) area.classList.remove('hidden');
}

function brandingStoragePath(value){
  const raw=String(value||'').trim();
  if(!raw) return '';
  if(!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, '');

  try{
    const url=new URL(raw);
    const markers=[
      '/storage/v1/object/public/branding/',
      '/storage/v1/object/sign/branding/',
      '/storage/v1/object/authenticated/branding/'
    ];
    for(const marker of markers){
      const index=url.pathname.indexOf(marker);
      if(index!==-1) return decodeURIComponent(url.pathname.slice(index+marker.length));
    }
  }catch(error){
    console.warn('Ongeldige branding-URL:', error.message);
  }
  return '';
}

async function resolveBrandingUrl(value){
  const raw=String(value||'').trim();
  if(!raw) return '';
  const path=brandingStoragePath(raw);

  // Een externe URL buiten de branding-bucket mag rechtstreeks worden gebruikt.
  if(/^https?:\/\//i.test(raw) && !path) return raw;
  if(!path) return '';
  if(brandingSignedUrlCache[path]) return brandingSignedUrlCache[path];

  const {data,error}=await sb.storage.from('branding').createSignedUrl(path,60*60);
  if(error){
    console.warn('Brandingbestand kan niet geladen worden:',error.message);
    return '';
  }
  brandingSignedUrlCache[path]=data.signedUrl;
  return data.signedUrl;
}

async function applyBranding(next={}){
  branding={...DEFAULT_BRANDING,...next};
  branding.primary_color=validHex(branding.primary_color,DEFAULT_BRANDING.primary_color);
  branding.accent_color=validHex(branding.accent_color,DEFAULT_BRANDING.accent_color);
  document.documentElement.style.setProperty('--brand-primary',branding.primary_color);
  document.documentElement.style.setProperty('--brand-accent',branding.accent_color);
  const themeMeta=el('themeColorMeta');
  if(themeMeta) themeMeta.setAttribute('content',branding.primary_color);
  if(el('sidebarCompanyName')) el('sidebarCompanyName').textContent=branding.company_name;
  if(el('sidebarDashboardName')) el('sidebarDashboardName').textContent=branding.dashboard_name;
  if(el('loginCompanyName')) el('loginCompanyName').textContent=`${branding.company_name} ${branding.dashboard_name}`.trim();
  if(el('loginSubtitle')) el('loginSubtitle').textContent=branding.login_subtitle;
  document.title=branding.browser_title||`${branding.company_name} | ${branding.dashboard_name}`;

  const [logoUrl,faviconUrl]=await Promise.all([
    resolveBrandingUrl(branding.logo_url),
    resolveBrandingUrl(branding.favicon_url)
  ]);

  // Het logo wordt bewust alleen in het ingelogde dashboard getoond.
  await Promise.all([
    setImage('sidebarLogo',logoUrl,{cleanBackground:true}),
    setImage('previewLogo',logoUrl,{cleanBackground:true})
  ]);
  // Het app-icoon en favicon blijven bewust vast.
  // iPadOS kan anders tijdens 'Zet op beginscherm' overschakelen naar een branding-afbeelding.
  const fav=el('faviconLink');
  if(fav) fav.href='/favicon-32x32.png?v=40-22';

  if(el('previewCompanyName')) el('previewCompanyName').textContent=branding.company_name;
  if(el('previewDashboardName')) el('previewDashboardName').textContent=branding.dashboard_name;
  fillBrandingForm();
}

function fillBrandingForm(){
  if(!el('brandingCompanyName')) return;
  el('brandingCompanyName').value=branding.company_name||'';
  el('brandingDashboardName').value=branding.dashboard_name||'';
  if(el('brandingLetterCity')) el('brandingLetterCity').value=branding.letter_city||'';
  if(el('brandingPublicIssuePageUrl')) el('brandingPublicIssuePageUrl').value=branding.public_issue_page_url||'';
  el('brandingLoginSubtitle').value=branding.login_subtitle||'';
  el('brandingBrowserTitle').value=branding.browser_title||'';
  el('brandingPrimaryColor').value=validHex(branding.primary_color,DEFAULT_BRANDING.primary_color);
  el('brandingAccentColor').value=validHex(branding.accent_color,DEFAULT_BRANDING.accent_color);
  el('currentLogoText').textContent=branding.logo_url?'Logo ingesteld':'Nog geen logo ingesteld';
  el('currentFaviconText').textContent=branding.favicon_url?'Favicon ingesteld':'Nog geen favicon ingesteld';
}

async function loadBranding(){
  await applyBranding(DEFAULT_BRANDING);
  try{
    const {data,error}=await sb.from('app_settings').select('*').eq('id',1).maybeSingle();
    if(error) throw error;
    if(data) await applyBranding(data);
  }catch(error){
    console.warn('Branding kon niet geladen worden:',error.message);
  }
}

async function uploadBrandingFile(file,folder){
  if(!file) return null;
  if(!file.type || !file.type.startsWith('image/')) throw new Error('Upload alleen een afbeelding.');
  const path=`${folder}/${Date.now()}-${safeFileName(file.name)}`;
  const up=await sb.storage.from('branding').upload(path,file,{upsert:false,cacheControl:'3600'});
  if(up.error) throw up.error;
  return path; // Bewaar het opslagpad, niet een publieke URL.
}

async function removeOldBrandingFile(oldValue,newValue){
  const oldPath=brandingStoragePath(oldValue);
  const newPath=brandingStoragePath(newValue);
  if(!oldPath || oldPath===newPath) return;
  const {error}=await sb.storage.from('branding').remove([oldPath]);
  if(error) console.warn('Oud brandingbestand kon niet worden verwijderd:',error.message);
  delete brandingSignedUrlCache[oldPath];
}

function normalizePublicIssuePageUrl(value){
  let raw=clean(value);
  if(!raw) return null;
  if(!/^https?:\/\//i.test(raw)) raw=`https://${raw}`;

  let url;
  try{
    url=new URL(raw);
  }catch(error){
    throw new Error('Vul een geldige URL voor de openbare meldingspagina in.');
  }

  const local=['localhost','127.0.0.1','::1'].includes(url.hostname);
  if(url.protocol!=='https:'&&!local){
    throw new Error('De openbare meldingspagina moet een veilige https-URL gebruiken.');
  }

  url.hash='';
  url.search='';
  if(!/\.html$/i.test(url.pathname)&&!url.pathname.endsWith('/')){
    url.pathname=`${url.pathname}/`;
  }
  return url.toString();
}

function configuredPublicIssuePageUrl(){
  const configured=clean(branding.public_issue_page_url);
  if(!configured){
    throw new Error('Vul eerst bij Instellingen → Huisstijl de openbare meldingspagina URL in.');
  }
  return new URL(normalizePublicIssuePageUrl(configured));
}

async function saveBranding(e){
  e.preventDefault();
  const msg=el('brandingMessage');
  msg.textContent='Bezig met opslaan...';
  try{
    const previousLogo=branding.logo_url;
    const previousFavicon=branding.favicon_url;
    const logoFile=el('brandingLogoFile').files?.[0];
    const faviconFile=el('brandingFaviconFile').files?.[0];
    const logoPath=await uploadBrandingFile(logoFile,'logos')||branding.logo_url||null;
    const faviconPath=await uploadBrandingFile(faviconFile,'favicons')||branding.favicon_url||null;
    const payload={
      id:1,
      company_name:clean(el('brandingCompanyName').value)||DEFAULT_BRANDING.company_name,
      dashboard_name:clean(el('brandingDashboardName').value)||DEFAULT_BRANDING.dashboard_name,
      letter_city:clean(el('brandingLetterCity')?.value)||null,
      public_issue_page_url:normalizePublicIssuePageUrl(el('brandingPublicIssuePageUrl')?.value),
      login_subtitle:clean(el('brandingLoginSubtitle').value)||DEFAULT_BRANDING.login_subtitle,
      browser_title:clean(el('brandingBrowserTitle').value)||null,
      primary_color:validHex(el('brandingPrimaryColor').value,DEFAULT_BRANDING.primary_color),
      accent_color:validHex(el('brandingAccentColor').value,DEFAULT_BRANDING.accent_color),
      logo_url:logoPath,
      favicon_url:faviconPath,
      updated_at:new Date().toISOString()
    };
    const res=await sb.from('app_settings').upsert(payload,{onConflict:'id'}).select().single();
    if(res.error) throw res.error;

    if(logoFile) await removeOldBrandingFile(previousLogo,logoPath);
    if(faviconFile) await removeOldBrandingFile(previousFavicon,faviconPath);

    el('brandingLogoFile').value='';
    el('brandingFaviconFile').value='';
    await applyBranding(res.data);
    msg.textContent='Instellingen opgeslagen.';
  }catch(error){
    console.error(error);
    msg.textContent='Opslaan mislukt: '+error.message;
  }
}

async function resetBranding(){
  if(!confirm('Standaard huisstijl herstellen? Het huidige logo en favicon worden losgekoppeld.')) return;
  const oldLogo=branding.logo_url;
  const oldFavicon=branding.favicon_url;
  const payload={id:1,...DEFAULT_BRANDING,logo_url:null,favicon_url:null,updated_at:new Date().toISOString()};
  const res=await sb.from('app_settings').upsert(payload,{onConflict:'id'}).select().single();
  if(res.error){el('brandingMessage').textContent=res.error.message;return;}
  await Promise.all([
    removeOldBrandingFile(oldLogo,null),
    removeOldBrandingFile(oldFavicon,null)
  ]);
  await applyBranding(res.data);
  el('brandingMessage').textContent='Standaard huisstijl hersteld.';
}

function previewBrandingForm(){
  if(!el('brandingCompanyName')) return;
  document.documentElement.style.setProperty('--brand-primary',validHex(el('brandingPrimaryColor').value,branding.primary_color));
  document.documentElement.style.setProperty('--brand-accent',validHex(el('brandingAccentColor').value,branding.accent_color));
  el('previewCompanyName').textContent=el('brandingCompanyName').value||DEFAULT_BRANDING.company_name;
  el('previewDashboardName').textContent=el('brandingDashboardName').value||DEFAULT_BRANDING.dashboard_name;
}

async function resolvePhotoUrl(value){
  if(!value) return '';
  if(isExternalUrl(value)) return value;
  if(signedPhotoCache[value]) return signedPhotoCache[value];
  const res = await sb.storage.from('property-documents').createSignedUrl(value, 60 * 60);
  if(res.error){ console.warn('Foto kan niet geladen worden', res.error); return ''; }
  signedPhotoCache[value] = res.data.signedUrl;
  return signedPhotoCache[value];
}

async function refreshPhotos(){
  const nodes = [...document.querySelectorAll('[data-photo-path]')];
  await Promise.all(nodes.map(async node => {
    const path = node.dataset.photoPath;
    const url = await resolvePhotoUrl(path);
    if(!url) return;
    if(node.tagName === 'IMG') node.src = url;
    else node.style.backgroundImage = `url('${url}')`;
  }));
}

function photoBox(path, cls, label='Foto pand'){
  if(!path) return `<div class="${cls} photoPlaceholder"><span>Geen foto</span></div>`;
  return `<div class="${cls}" data-photo-path="${escAttr(path)}" aria-label="${escAttr(label)}"></div>`;
}

function daysUntil(dateString){ if(!dateString) return null; const d=new Date(`${String(dateString).slice(0,10)}T00:00:00`); if(Number.isNaN(d.getTime())) return null; const t=new Date(); t.setHours(0,0,0,0); d.setHours(0,0,0,0); return Math.ceil((d-t)/(1000*60*60*24)); }
function getDateStatus(dateString, warningDays=365, dangerDays=90){ const days=daysUntil(dateString); if(days===null) return ['Controle nodig','warning']; if(days<0) return ['Verlopen','danger']; if(days<=dangerDays) return [`Binnen ${dangerDays} dagen`,'danger']; if(days<=warningDays) return [`Binnen ${warningDays} dagen`,'warning']; return ['Op orde','ok']; }

function isoToday(){
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function isoParts(value){
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!match) return null;
  return {year:Number(match[1]),month:Number(match[2]),day:Number(match[3])};
}
function isoFromParts(year,month,day){
  const maxDay=new Date(Date.UTC(year,month,0)).getUTCDate();
  const safeDay=Math.min(Math.max(1,day),maxDay);
  return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(safeDay).padStart(2,'0')}`;
}
function shiftIsoMonths(value,months){
  const parts=isoParts(value);
  if(!parts) return null;
  const zeroBased=(parts.year*12)+(parts.month-1)+Number(months||0);
  const year=Math.floor(zeroBased/12);
  const month=((zeroBased%12)+12)%12+1;
  return isoFromParts(year,month,parts.day);
}
function shiftIsoYears(value,years){
  const parts=isoParts(value);
  if(!parts) return null;
  return isoFromParts(parts.year+Number(years||0),parts.month,parts.day);
}
function integerOrNull(value){
  if(value==='' || value===null || value===undefined) return null;
  const number=Number(value);
  return Number.isFinite(number) && number>=0 ? Math.round(number) : null;
}
function monthsBetweenIso(startValue,endValue){
  const start=isoParts(startValue), end=isoParts(endValue);
  if(!start || !end) return null;
  let months=(end.year-start.year)*12+(end.month-start.month);
  if(end.day<start.day) months--;
  return months>=0?months:null;
}
function canonicalContractStatus(value){
  const status=norm(value);
  return status.includes('opgezegd') || status.includes('beeindigd') || status.includes('beëindigd')
    ? 'Opgezegd'
    : 'Actief';
}
function contractTimeline(contract={}){
  const originalEnd=contract.end_date||null;
  const storedStatus=canonicalContractStatus(contract.status);
  const terminated=storedStatus==='Opgezegd';
  const hasContractData=Boolean(
    contract.id || contract.start_date || contract.notice_date || contract.tenant_id ||
    contract.notice_period_months !== null && contract.notice_period_months !== undefined && contract.notice_period_months !== '' ||
    clean(contract.status)
  );
  // Een bestaand contract zonder einddatum geldt als een contract voor onbepaalde tijd.
  // De opzegtermijn blijft daarbij gewoon van toepassing en wordt apart getoond.
  const indefinite=!originalEnd && hasContractData;
  const storedNoticeMonths=integerOrNull(contract.notice_period_months);
  const inferredNoticeMonths=contract.notice_date && originalEnd ? monthsBetweenIso(contract.notice_date,originalEnd) : null;
  const noticeMonths=storedNoticeMonths!==null ? storedNoticeMonths : inferredNoticeMonths;
  const renewalYears=integerOrNull(contract.renewal_period_years)||0;
  const calculatedInitialNotice=originalEnd && noticeMonths ? shiftIsoMonths(originalEnd,-noticeMonths) : null;
  const explicitNotice=contract.notice_date||null;
  const initialNotice=explicitNotice||calculatedInitialNotice;
  const noticeMismatch=Boolean(explicitNotice && calculatedInitialNotice && explicitNotice!==calculatedInitialNotice);

  let effectiveEnd=originalEnd;
  let effectiveNotice=initialNotice;
  let renewalCount=0;
  const today=isoToday();

  // Bereken altijd eerst welke automatische verlengingen al daadwerkelijk zijn ingegaan.
  // Ook bij een contract dat inmiddels als 'Opgezegd' staat, moet de historische verlenging
  // behouden blijven. De status 'Opgezegd' voorkomt dus niet dat een reeds verstreken
  // opzegmoment de effectieve einddatum naar de juiste verlengde periode verschuift.
  if(!indefinite && originalEnd && initialNotice && renewalYears>0){
    while(effectiveNotice && today>effectiveNotice && renewalCount<100){
      effectiveEnd=shiftIsoYears(effectiveEnd,renewalYears);
      effectiveNotice=noticeMonths
        ? shiftIsoMonths(effectiveEnd,-noticeMonths)
        : shiftIsoYears(effectiveNotice,renewalYears);
      renewalCount++;
    }
  }

  const noticeDays=daysUntil(effectiveNotice);
  const endDays=daysUntil(effectiveEnd);
  let noticeStatus;
  if(terminated) noticeStatus=['Opgezegd','warning'];
  else if(indefinite){
    noticeStatus=noticeMonths===null
      ? ['Opzegtermijn ontbreekt','warning']
      : [`${noticeMonths} mnd opzegtermijn`,'ok'];
  }
  else if(!effectiveNotice) noticeStatus=['Opzegdatum ontbreekt','warning'];
  else if(renewalCount>0) noticeStatus=['Automatisch verlengd','warning'];
  else if(noticeDays<0) noticeStatus=['Opzegmoment verlopen','danger'];
  else if(noticeDays<=90) noticeStatus=[`Binnen ${noticeDays} dagen`,'danger'];
  else if(noticeDays<=365) noticeStatus=['Binnen 12 maanden','warning'];
  else noticeStatus=['Op orde','ok'];

  let contractStatus;
  if(terminated) contractStatus=['Opgezegd','warning'];
  else if(indefinite) contractStatus=['Onbepaalde tijd','ok'];
  else if(!effectiveEnd) contractStatus=['Einddatum ontbreekt','warning'];
  else if(renewalCount>0) contractStatus=['Verlengd','warning'];
  else contractStatus=getDateStatus(effectiveEnd,365,90);

  return {
    indefinite,originalEnd,effectiveEnd,explicitNotice,calculatedInitialNotice,initialNotice,effectiveNotice,
    noticeMonths,renewalYears,renewalCount,noticeMismatch,noticeDays,endDays,noticeStatus,contractStatus,
    storedStatus,terminated
  };
}
const monthMap={januari:0,februari:1,maart:2,april:3,mei:4,juni:5,juli:6,augustus:7,september:8,oktober:9,november:10,december:11};
function daysUntilRentIncrease(monthName){ if(!monthName) return null; const key=String(monthName).trim().toLowerCase(); if(!(key in monthMap)) return null; const today=new Date(); today.setHours(0,0,0,0); let target=new Date(today.getFullYear(), monthMap[key], 1); if(target<today) target=new Date(today.getFullYear()+1, monthMap[key], 1); return Math.ceil((target-today)/(1000*60*60*24)); }
function rentIncreaseStatus(monthName){ const days=daysUntilRentIncrease(monthName); if(days===null) return ['Niet ingesteld','warning']; if(days<=30) return ['Deze maand/komende 30 dagen','danger']; if(days<=60) return ['Binnen 60 dagen','warning']; return ['Op orde','ok']; }
function actionItem(sev,type,title,text,objectId,taskId,reportId,sourceId){ return {sev,type,title,text,objectId,taskId,reportId,sourceId}; }
const SIDEBAR_STORAGE_KEY='vastgoedSidebarCollapsed';
function setSidebarCollapsed(collapsed,{persist=true}={}){
  const sidebar=document.querySelector('.sidebar');
  const button=el('sidebarToggleBtn');
  if(!sidebar || !button) return;

  const next=Boolean(collapsed);
  sidebar.classList.toggle('collapsed',next);
  button.setAttribute('aria-expanded',String(!next));
  const label=next?'Zijbalk uitklappen':'Zijbalk inklappen';
  button.setAttribute('aria-label',label);
  button.title=label;

  if(persist){
    try{ localStorage.setItem(SIDEBAR_STORAGE_KEY,String(next)); }
    catch(error){ console.warn('Zijbalkvoorkeur kon niet worden opgeslagen:',error.message); }
  }
}
function initSidebar(){
  let collapsed=false;
  try{ collapsed=localStorage.getItem(SIDEBAR_STORAGE_KEY)==='true'; }
  catch(error){ console.warn('Zijbalkvoorkeur kon niet worden gelezen:',error.message); }

  setSidebarCollapsed(collapsed,{persist:false});
  document.querySelectorAll('.nav').forEach(button=>{
    button.title=button.dataset.title || button.textContent.trim();
  });
  el('sidebarToggleBtn')?.addEventListener('click',()=>{
    const sidebar=document.querySelector('.sidebar');
    setSidebarCollapsed(!sidebar?.classList.contains('collapsed'));
  });
}

function setMaintenanceTab(tab){
  activeMaintenanceTab=['inspections','reports'].includes(tab)?tab:'maintenance';

  document.querySelectorAll('.maintenanceTab').forEach(button=>{
    const active=button.dataset.maintenanceTab===activeMaintenanceTab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
  });

  el('maintenanceMainPanel')?.classList.toggle('active',activeMaintenanceTab==='maintenance');
  el('maintenanceInspectionPanel')?.classList.toggle('active',activeMaintenanceTab==='inspections');
  el('maintenanceReportPanel')?.classList.toggle('active',activeMaintenanceTab==='reports');

  const maintenanceCsvButton=el('chooseMaintenanceCsvBtn');
  if(maintenanceCsvButton){
    const maintenancePageActive=el('onderhoud')?.classList.contains('active');
    maintenanceCsvButton.classList.toggle('hidden',!maintenancePageActive||activeMaintenanceTab!=='maintenance');
  }

  if(activeMaintenanceTab==='inspections') renderInspections(filtered());
  else if(activeMaintenanceTab==='reports') renderTenantIssueReports();
  else renderMaintenanceOverview(filtered());
}

function setPage(pageId, title){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  el(pageId).classList.add('active');
  document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active', n.dataset.page===pageId));
  el('pageTitle').textContent=title || pageId;
  syncProfessionalNavigation(pageId);

  const maintenanceCsvButton=el('chooseMaintenanceCsvBtn');
  if(maintenanceCsvButton) maintenanceCsvButton.classList.toggle('hidden', pageId!=='onderhoud'||activeMaintenanceTab!=='maintenance');

  const objectCsvButton=el('chooseObjectCsvBtn');
  if(objectCsvButton) objectCsvButton.classList.toggle('hidden', pageId!=='objecten');

  if(pageId==='onderhoud'){
    setMaintenanceTab(activeMaintenanceTab);
  }

  if(pageId==='financieel'){
    renderFinancialPage(filtered());
    setFinancialTab(activeFinancialTab);
  }

  requestAnimationFrame(()=>updateContractStickyHeader());
}

function normalize(properties, contracts, tenants, maintenance, documents=[], history=[]){
  const tenantById=Object.fromEntries(tenants.map(t=>[t.id,t]));
  const contractsByProperty={}; contracts.forEach(c=>{(contractsByProperty[c.property_id] ||= []).push(c)});
  const maintenanceByProperty={}; maintenance.forEach(m=>{(maintenanceByProperty[m.property_id] ||= []).push(m)});
  const documentsByProperty={}; documents.forEach(d=>{(documentsByProperty[d.property_id] ||= []).push(d)});
  const historyByProperty={};
  const historyByObjectKey={};
  history.forEach(h=>{
    const key = h.property_id || '';
    if(key) (historyByProperty[key] ||= []).push(h);
    const nameKey = norm(h.property_name);
    const addressKey = norm([h.property_address, h.house_number].filter(Boolean).join(' '));
    if(nameKey) (historyByObjectKey[nameKey] ||= []).push(h);
    if(addressKey) (historyByObjectKey[addressKey] ||= []).push(h);
  });
  return properties.map(p=>{
    const contract=(contractsByProperty[p.id]||[])[0]||{};
    const tenant=tenantById[contract.tenant_id]||{};
    const propertyMaintenance=(maintenanceByProperty[p.id]||[]).slice().sort((a,b)=>String(a.planned_date||'9999-12-31').localeCompare(String(b.planned_date||'9999-12-31')));
    const plannedMaintenance=propertyMaintenance[0]||{};
    const objectName=p.name || [p.address,p.house_number].filter(Boolean).join(' ') || 'Onbekend object';
    const rentPm=p.monthly_rent ?? contract.monthly_rent ?? 0;
    const rentPj=p.yearly_rent ?? (Number(rentPm||0)*12);
    const contractData={...contract};
    if(!contractData.end_date && p.end_date) contractData.end_date=p.end_date;
    if(!contractData.notice_date && p.notice_date) contractData.notice_date=p.notice_date;
    const timeline=contractTimeline(contractData);
    const contractEnd=timeline.effectiveEnd;
    const indefiniteContract=timeline.indefinite;
    const noticeDate=timeline.effectiveNotice;
    const scopeDate=p.scope_valid_until || plannedMaintenance.planned_date;
    const purchaseValue = Number(p.purchase_value || 0);
    const grossYield = purchaseValue > 0 ? (Number(rentPj || 0) / purchaseValue) * 100 : null;
    const objectKey = norm(objectName);
    const addressKey = norm([p.address, p.house_number].filter(Boolean).join(' '));
    const matchedHistory = historyByProperty[p.id] || historyByObjectKey[objectKey] || historyByObjectKey[addressKey] || [];
    const maintenanceHistory = [...propertyMaintenance, ...matchedHistory].sort((a,b)=>String(b.planned_date||b.completed_date||b.done_date||'').localeCompare(String(a.planned_date||a.completed_date||a.done_date||'')));
    const documentsList = (documentsByProperty[p.id] || []).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    return {id:p.id, property:p, contract, contract_timeline:timeline, tenant, maintenance:plannedMaintenance, maintenance_history:maintenanceHistory, documenten:documentsList, object:objectName, straatnaam:p.address||'', huisnummer:p.house_number||'', postcode:p.postal_code||'', stad:p.city||'', type:p.property_type||'-', status:p.status||'-', huurder:tenant.name||p.tenant_name||'-', email:tenant.email||p.email||'', telefoon:tenant.phone||p.phone||'', factuur_naam:p.billing_name||'', factuur_adres:p.billing_address||'', factuur_huisnummer:p.billing_house_number||'', factuur_postcode:p.billing_postal_code||'', factuur_stad:p.billing_city||'', huur_pm:rentPm, huur_pj:rentPj, servicekosten:p.service_costs||0, energiekosten:p.energy_costs||0, waarborgsom:p.deposit||0, concerngarantie:p.corporate_guarantee||0, bankgarantie:p.bank_guarantee||0, aankoopwaarde:p.purchase_value||0, woz_waarde:p.woz_value||0, hypotheek:p.mortgage_value||0, hypotheekrente:p.mortgage_interest||0, aankoopdatum:p.purchase_date||'', foto_url:p.photo_url||'', bruto_rendement:grossYield, overwaarde:(Number(p.woz_value||0)-Number(p.mortgage_value||0)), energielabel:p.energy_label||'-', energielabel_geldig_tot:p.energy_label_valid_until||'', energielabel_verplicht:p.energy_label_required!==false, maand_huurverhoging:p.rent_increase_month||'', oorspronkelijke_einddatum_contract:timeline.originalEnd, einddatum_contract:contractEnd, contract_onbepaalde:indefiniteContract, contract_status:timeline.storedStatus, contract_opgezegd:timeline.terminated, startdatum_contract:contract.start_date||'', oorspronkelijke_opzegdatum:timeline.initialNotice, opzegdatum:noticeDate, opzegtermijn_maanden:timeline.noticeMonths, verlenging_jaren:timeline.renewalYears, aantal_verlengingen:timeline.renewalCount, opzegdatum_afwijking:timeline.noticeMismatch, scope_inspectie_geldig_tot:scopeDate, onderhoud_titel:plannedMaintenance.title||'Scope-inspectie', onderhoud_status:plannedMaintenance.status||'-', onderhoud_kosten:plannedMaintenance.cost||0, onderhoud_prioriteit:plannedMaintenance.priority||'-', onderhoud_omschrijving:plannedMaintenance.description||'', status_contract:timeline.contractStatus, status_opzeg:timeline.noticeStatus, status_scope:getDateStatus(scopeDate,365,90), status_energy:p.energy_label_required===false?['Niet verplicht','ok']:getDateStatus(p.energy_label_valid_until,180,60), status_rent_increase:rentIncreaseStatus(p.rent_increase_month)};
  });
}
function showLogin(message=''){ el('loginView').classList.remove('hidden'); el('appView').classList.add('hidden'); if(el('dashboardNotificationBell')) el('dashboardNotificationBell').hidden=true; closeNotificationCenter(); if(el('loginError')) el('loginError').textContent=message; if(el('password')) el('password').value=''; }
function showApp(){ el('loginView').classList.add('hidden'); el('appView').classList.remove('hidden'); if(el('dashboardNotificationBell')) el('dashboardNotificationBell').hidden=false; }
async function checkSession(){
  const {data,error}=await sb.auth.getSession();
  if(error){
    console.warn('Sessiecontrole mislukt:',error.message);
    await secureLogout('Je sessie kon niet veilig worden gecontroleerd. Log opnieuw in.');
    return;
  }
  if(data.session){
    initializeSessionSecurity(data.session);
    await checkSessionSecurity();
    if(!sessionSecurityActive) return;
    showApp();
    await loadBranding();
    await loadData();
  }else{
    stopSessionSecurity();
    clearSessionMeta();
    await applyBranding(DEFAULT_BRANDING);
    showLogin();
  }
}
async function loadData(){
  try{
    const [pr,cr,tr,mr,dr,hr,rr,sr,ns,nl,ir,dcr,tsk,ipr,tir,dns]=await Promise.all([
      sb.from('properties').select('*').order('created_at',{ascending:false}),
      sb.from('contracts').select('*'),
      sb.from('tenants').select('*'),
      sb.from('maintenance').select('*'),
      sb.from('property_documents').select('*'),
      sb.from('property_maintenance_history').select('*'),
      sb.from('rent_increase_proposals').select('*').order('effective_date',{ascending:true}),
      sb.from('service_cost_settlements').select('*').order('settlement_year',{ascending:false}),
      sb.from('notification_settings').select('*').eq('id',1).maybeSingle(),
      sb.from('email_notification_log').select('*').order('created_at',{ascending:false}).limit(20),
      sb.from('property_inspections').select('*').order('valid_until',{ascending:true}),
      sb.from('property_data_check_overrides').select('*').order('updated_at',{ascending:false}),
      sb.from('property_tasks').select('*').order('created_at',{ascending:false}),
      sb.from('property_issue_portals').select('*').order('created_at',{ascending:false}),
      sb.from('tenant_issue_reports').select('*').order('submitted_at',{ascending:false}),
      sb.from('dashboard_notification_state').select('*').order('updated_at',{ascending:false})
    ]);
    [pr,cr,tr,mr,dr,hr].forEach(r=>{if(r.error) throw r.error});
    rawProperties=pr.data||[]; rawContracts=cr.data||[]; rawTenants=tr.data||[]; rawMaintenance=mr.data||[]; rawDocuments=dr.data||[]; rawMaintenanceHistory=hr.data||[];
    if(rr.error){
      console.warn('Huurverhogingstabellen nog niet beschikbaar:',rr.error.message);
      rawRentIncreaseProposals=[];
      rentIncreaseSetupReady=false;
    }else{
      rawRentIncreaseProposals=rr.data||[];
      rentIncreaseSetupReady=true;
    }
    if(sr.error){
      console.warn('Servicekostentabellen nog niet beschikbaar:',sr.error.message);
      rawServiceCostSettlements=[];
      serviceCostSetupReady=false;
    }else{
      rawServiceCostSettlements=sr.data||[];
      serviceCostSetupReady=true;
    }
    if(ns.error){
      console.warn('E-mailinstellingen nog niet beschikbaar:',ns.error.message);
      notificationSettings=cloneNotificationDefaults();
      notificationSettingsReady=false;
    }else{
      notificationSettings=normalizeNotificationSettings(ns.data);
      notificationSettingsReady=true;
    }
    if(nl.error){
      console.warn('E-maillogboek nog niet beschikbaar:',nl.error.message);
      rawEmailNotificationLogs=[];
    }else{
      rawEmailNotificationLogs=nl.data||[];
    }
    if(ir.error){
      console.warn('Keuringentabel nog niet beschikbaar:',ir.error.message);
      rawInspections=[];
      inspectionsSetupReady=false;
    }else{
      rawInspections=ir.data||[];
      inspectionsSetupReady=true;
    }
    if(dcr.error){
      console.warn('Datacontrole-afhandeling nog niet beschikbaar:',dcr.error.message);
      rawDataCheckOverrides=[];
      dataCheckOverridesReady=false;
    }else{
      rawDataCheckOverrides=dcr.data||[];
      dataCheckOverridesReady=true;
    }
    if(tsk.error){
      console.warn('Takentabel nog niet beschikbaar:',tsk.error.message);
      rawTasks=[];
      tasksReady=false;
    }else{
      rawTasks=tsk.data||[];
      tasksReady=true;
    }
    if(ipr.error){
      console.warn('QR-portalen nog niet beschikbaar:',ipr.error.message);
      rawIssuePortals=[];
      issuePortalsReady=false;
    }else{
      rawIssuePortals=ipr.data||[];
      issuePortalsReady=true;
    }
    if(tir.error){
      console.warn('Huurdersmeldingen nog niet beschikbaar:',tir.error.message);
      rawTenantIssueReports=[];
      tenantIssueReportsReady=false;
    }else{
      rawTenantIssueReports=tir.data||[];
      tenantIssueReportsReady=true;
    }
    if(dns.error){
      console.warn('Dashboardmeldingsstatus nog niet beschikbaar:',dns.error.message);
      rawDashboardNotificationStates=[];
      dashboardNotificationStateReady=false;
    }else{
      rawDashboardNotificationStates=dns.data||[];
      dashboardNotificationStateReady=true;
    }
    vastgoedData=normalize(rawProperties, rawContracts, rawTenants, rawMaintenance, rawDocuments, rawMaintenanceHistory);
    el('statusText').textContent=`Live data uit Supabase. Laatst geladen: ${new Date().toLocaleTimeString('nl-NL')}`;
    render();
    maybeOpenDashboardNotificationOverview();
    renderNotificationSettings();
    loadNotificationFunctionStatus();
    if(selectedPropertyId) renderDetail(selectedPropertyId);
    loadCbsIndexData(false);
  }catch(error){ console.error(error); el('statusText').textContent='Kan data niet laden.'; el('attentionList').innerHTML=`<div class="alert danger"><strong>Fout bij laden</strong>${error.message}</div>`; }
}
function filtered(){
  return vastgoedData
    .filter(r=>JSON.stringify(r).toLowerCase().includes(query.toLowerCase()))
    .sort(compareObjectAddress);
}
function notificationItems(data){
  const items=[];
  data.forEach(r=>{
    const timeline=r.contract_timeline||contractTimeline(r.contract||{});
    const noticeDays=timeline.noticeDays;
    const contractDays=timeline.endDays;
    const maintenanceDays=daysUntil(r.scope_inspectie_geldig_tot);
    const energyDays=daysUntil(r.energielabel_geldig_tot);
    const rentIncreaseDays=daysUntilRentIncrease(r.maand_huurverhoging);
    const isVacant=String(r.status||'').toLowerCase().includes('leeg') || String(r.huurder||'').trim()==='-';

    if(isVacant) items.push(actionItem('danger','Leegstand',`Geen huurder: ${r.object}`,'Controleer of dit object leegstaat of koppel een huurder.',r.id));
    if(!r.contract || !r.contract.id){
      items.push(actionItem('warning','Contract',`Geen contract gekoppeld: ${r.object}`,'Voeg een contract toe zodat einddatum, opzegtermijn en verlenging bewaakt worden.',r.id));
    } else if(timeline.terminated){
      const endText=timeline.originalEnd
        ? `Het contract is opgezegd en eindigt op ${dateFmt(timeline.originalEnd)}.`
        : 'Het contract is opgezegd. Vul eventueel een einddatum in om de afloop te bewaken.';
      items.push(actionItem('warning','Opzegging',`Contract opgezegd: ${r.object}`,endText,r.id));
    } else if(timeline.indefinite){
      // Geen vaste eind- of uiterste opzegdatum, maar de contractuele opzegtermijn blijft relevant.
      if(timeline.noticeMonths===null){
        items.push(actionItem('warning','Contractcontrole',`Opzegtermijn ontbreekt: ${r.object}`,'Vul de opzegtermijn in voor dit contract voor onbepaalde tijd.',r.id));
      }
    } else {
      if(timeline.noticeMismatch){
        items.push(actionItem('warning','Contractcontrole',`Opzegdatum wijkt af: ${r.object}`,`De ingevoerde opzegdatum ${dateFmt(timeline.explicitNotice)} wijkt af van ${timeline.noticeMonths} maanden vóór de einddatum (${dateFmt(timeline.calculatedInitialNotice)}).`,r.id));
      }

      if(timeline.renewalCount>0){
        items.push(actionItem('warning','Contractverlenging',`Contract automatisch verlengd: ${r.object}`,`Het oorspronkelijke opzegmoment is gemist. Het contract is ${timeline.renewalCount}× met ${timeline.renewalYears} jaar verlengd tot ${dateFmt(timeline.effectiveEnd)}. Nieuwe uiterste opzegdatum: ${dateFmt(timeline.effectiveNotice)}.`,r.id));
      } else if(noticeDays!==null){
        if(noticeDays<0){
          items.push(actionItem('danger','Opzegdatum',`Opzegmoment verlopen: ${r.object}`,`De uiterste opzegdatum was ${dateFmt(timeline.effectiveNotice)}. Er is geen verlengtermijn ingevuld.`,r.id));
        } else if(noticeDays<=90){
          items.push(actionItem('danger','Opzegdatum',`Opzegdatum binnen ${noticeDays} dagen`,`${r.object}: uiterlijk opzeggen op ${dateFmt(timeline.effectiveNotice)} voor einde op ${dateFmt(timeline.effectiveEnd)}.`,r.id));
        } else if(noticeDays<=365){
          items.push(actionItem('warning','Opzegdatum',`Opzegdatum binnen 12 maanden`,`${r.object}: uiterlijk opzeggen op ${dateFmt(timeline.effectiveNotice)} voor einde op ${dateFmt(timeline.effectiveEnd)}.`,r.id));
        }
      } else if(timeline.originalEnd){
        items.push(actionItem('warning','Contractcontrole',`Opzegtermijn ontbreekt: ${r.object}`,`Vul de opzegtermijn of uiterste opzegdatum in voor het contract dat eindigt op ${dateFmt(timeline.originalEnd)}.`,r.id));
      }

      if(contractDays!==null && contractDays<=365 && (noticeDays===null || noticeDays>365)){
        const severity=contractDays<=90?'danger':'warning';
        items.push(actionItem(severity,'Contract',`Contracteinde nadert: ${r.object}`,`De huidige einddatum is ${dateFmt(timeline.effectiveEnd)}. Controleer de contractafspraken.`,r.id));
      }
    }

    if(maintenanceDays!==null){
      if(maintenanceDays<0) items.push(actionItem('danger','Onderhoud',`Onderhoud/inspectie verlopen: ${r.object}`,`Datum was ${dateFmt(r.scope_inspectie_geldig_tot)}.`,r.id));
      else if(maintenanceDays<=30) items.push(actionItem('danger','Onderhoud',`Onderhoud binnen ${maintenanceDays} dagen`,`${r.object}: ${r.onderhoud_titel} op ${dateFmt(r.scope_inspectie_geldig_tot)}.`,r.id));
      else if(maintenanceDays<=90) items.push(actionItem('warning','Onderhoud',`Onderhoud binnen 90 dagen`,`${r.object}: ${r.onderhoud_titel} op ${dateFmt(r.scope_inspectie_geldig_tot)}.`,r.id));
    }

    if(r.energielabel_verplicht&&energyDays!==null){
      if(energyDays<0) items.push(actionItem('danger','Energielabel',`Energielabel verlopen: ${r.object}`,`Geldig tot ${dateFmt(r.energielabel_geldig_tot)}.`,r.id));
      else if(energyDays<=60) items.push(actionItem('danger','Energielabel',`Energielabel binnen ${energyDays} dagen`,`${r.object}: geldig tot ${dateFmt(r.energielabel_geldig_tot)}.`,r.id));
      else if(energyDays<=180) items.push(actionItem('warning','Energielabel',`Energielabel binnen 180 dagen`,`${r.object}: geldig tot ${dateFmt(r.energielabel_geldig_tot)}.`,r.id));
    }

    if(rentIncreaseDays!==null){
      if(rentIncreaseDays<=30) items.push(actionItem('danger','Huurverhoging',`Huurverhoging deze maand: ${r.object}`,`Maand huurverhoging: ${r.maand_huurverhoging}.`,r.id));
      else if(rentIncreaseDays<=60) items.push(actionItem('warning','Huurverhoging',`Huurverhoging binnen 60 dagen`,`${r.object}: maand ${r.maand_huurverhoging}.`,r.id));
    }
  });
  const allowedIds=new Set(data.map(item=>item.id));
  rawInspections.filter(row=>allowedIds.has(row.property_id)).forEach(row=>{
    const property=inspectionProperty(row);
    if(isEnergyLabelInspection(row)&&property?.energielabel_verplicht===false) return;
    const status=inspectionDisplayStatus(row);
    const date=inspectionDeadline(row);
    const days=daysUntil(date);
    if(status==='Afgekeurd'){
      items.push(actionItem('danger','Keuring',`${row.inspection_type} afgekeurd: ${property?.object||'Onbekend object'}`,'Plan herstel en een eventuele herkeuring.',row.property_id,null,null,row.id));
    }else if(status==='Verlopen'){
      items.push(actionItem('danger','Keuring',`${row.inspection_type} verlopen: ${property?.object||'Onbekend object'}`,`Vervaldatum: ${dateFmt(date)}.`,row.property_id,null,null,row.id));
    }else if(status==='Verloopt binnenkort'&&days!==null){
      items.push(actionItem(days<=30?'danger':'warning','Keuring',`${row.inspection_type} verloopt binnen ${days} dagen`,`${property?.object||'Onbekend object'}: ${dateFmt(date)}.`,row.property_id,null,null,row.id));
    }else if(status==='Nog te plannen'){
      items.push(actionItem('warning','Keuring',`${row.inspection_type} nog te plannen: ${property?.object||'Onbekend object'}`,'Vul een keuringsdatum of volgende keuringsdatum in.',row.property_id,null,null,row.id));
    }
  });
  rawTasks
    .filter(task=>task.status!=='Afgerond'&&task.due_date)
    .forEach(task=>{
      const days=daysUntil(task.due_date);
      if(days===null||days>7) return;
      const property=task.property_id?getPropertyById(task.property_id):null;
      const objectText=property?` · ${property.object}`:'';
      if(days<0){
        items.push(actionItem('danger','Taak',`Taak te laat: ${task.title}`,`Deadline ${dateFmt(task.due_date)}${objectText}.`,null,task.id));
      }else if(days===0){
        items.push(actionItem('danger','Taak',`Taak vandaag: ${task.title}`,`Deadline vandaag${objectText}.`,null,task.id));
      }else{
        items.push(actionItem('warning','Taak',`Taak binnen ${days} dagen: ${task.title}`,`Deadline ${dateFmt(task.due_date)}${objectText}.`,null,task.id));
      }
    });

  rawTenantIssueReports
    .filter(report=>tenantReportIsOpen(report))
    .forEach(report=>{
      const property=tenantReportProperty(report);
      const objectText=property?` · ${property.object}`:'';
      items.push(actionItem(
        report.urgency==='Spoed'?'danger':report.urgency==='Hoog'?'warning':'ok',
        'Huurdersmelding',
        `${report.category}${objectText}`,
        `${report.status} · ${report.description.slice(0,180)}${report.description.length>180?'…':''}`,
        property?.id||null,
        null,
        report.id
      ));
    });

  const score={danger:0,warning:1,ok:2};
  return items.sort((a,b)=>(score[a.sev]??9)-(score[b.sev]??9));
}
const TASK_STATUSES=['Open','In behandeling','Wachten op huurder','Wachten op leverancier','Afgerond'];
const TASK_PRIORITIES=['Laag','Normaal','Hoog','Urgent'];

function taskProperty(task){
  return task?.property_id?getPropertyById(task.property_id):null;
}

function taskPriorityTone(priority){
  if(priority==='Urgent') return 'danger';
  if(priority==='Hoog') return 'warning';
  if(priority==='Laag') return 'ok';
  return 'neutral';
}

function taskStatusTone(task){
  if(task.status==='Afgerond') return 'ok';
  const days=daysUntil(task.due_date);
  if(days!==null&&days<0) return 'danger';
  if(days!==null&&days<=7) return 'warning';
  if(String(task.status||'').startsWith('Wachten op')) return 'warning';
  return 'neutral';
}

function taskDueInfo(task){
  if(task.status==='Afgerond') return ['Afgerond','ok'];
  if(!task.due_date) return ['Geen deadline','neutral'];
  const days=daysUntil(task.due_date);
  if(days===null) return [dateFmt(task.due_date),'neutral'];
  if(days<0) return [`${Math.abs(days)} dagen te laat`,'danger'];
  if(days===0) return ['Vandaag','warning'];
  if(days===1) return ['Morgen','warning'];
  if(days<=7) return [`Binnen ${days} dagen`,'warning'];
  return [dateFmt(task.due_date),'ok'];
}

function taskMatchesSearch(task){
  if(!query) return true;
  const property=taskProperty(task);
  const haystack=[
    task.title,task.description,task.status,task.priority,task.due_date,
    property?.object,property?.straatnaam,property?.huisnummer,property?.stad
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function filteredTasks(){
  const today=isoToday();
  return rawTasks
    .filter(task=>taskMatchesSearch(task))
    .filter(task=>{
      if(taskStatusFilter==='open') return task.status!=='Afgerond';
      if(taskStatusFilter) return task.status===taskStatusFilter;
      return true;
    })
    .filter(task=>!taskPriorityFilter||task.priority===taskPriorityFilter)
    .filter(task=>!taskObjectFilter||task.property_id===taskObjectFilter)
    .filter(task=>{
      if(!taskDateFilter) return true;
      const days=daysUntil(task.due_date);
      if(taskDateFilter==='overdue') return task.status!=='Afgerond'&&days!==null&&days<0;
      if(taskDateFilter==='today') return task.status!=='Afgerond'&&task.due_date===today;
      if(taskDateFilter==='week') return task.status!=='Afgerond'&&days!==null&&days>=0&&days<=7;
      if(taskDateFilter==='none') return !task.due_date;
      return true;
    })
    .sort((a,b)=>{
      const aDone=a.status==='Afgerond'?1:0;
      const bDone=b.status==='Afgerond'?1:0;
      if(aDone!==bDone) return aDone-bDone;
      const aDate=a.due_date||'9999-12-31';
      const bDate=b.due_date||'9999-12-31';
      if(aDate!==bDate) return aDate.localeCompare(bDate);
      const priorityOrder={Urgent:0,Hoog:1,Normaal:2,Laag:3};
      const priorityCompare=(priorityOrder[a.priority]??9)-(priorityOrder[b.priority]??9);
      if(priorityCompare!==0) return priorityCompare;
      return String(a.title||'').localeCompare(String(b.title||''),'nl',{sensitivity:'base'});
    });
}

function taskPropertyOptions(selected=''){
  return `<option value="">Geen object gekoppeld</option>`+
    vastgoedData
      .slice()
      .sort(compareObjectAddress)
      .map(property=>`<option value="${escAttr(property.id)}" ${selected===property.id?'selected':''}>${escHtml(property.object)} · ${escHtml([property.straatnaam,property.huisnummer,property.stad].filter(Boolean).join(' '))}</option>`)
      .join('');
}

function renderTasks(){
  const summary=el('taskSummary');
  const filters=el('taskFilters');
  const table=el('taskTable');
  if(!summary||!filters||!table) return;

  el('taskSetupWarning')?.classList.toggle('hidden',tasksReady);
  if(el('newTaskBtn')) el('newTaskBtn').disabled=!tasksReady;

  const today=isoToday();
  const openTasks=rawTasks.filter(task=>task.status!=='Afgerond');
  const overdue=openTasks.filter(task=>{const days=daysUntil(task.due_date);return days!==null&&days<0;}).length;
  const todayCount=openTasks.filter(task=>task.due_date===today).length;
  const weekCount=openTasks.filter(task=>{const days=daysUntil(task.due_date);return days!==null&&days>=0&&days<=7;}).length;
  const waiting=openTasks.filter(task=>String(task.status||'').startsWith('Wachten op')).length;
  const completed=rawTasks.filter(task=>task.status==='Afgerond').length;

  summary.innerHTML=`
    <div class="card"><span>Openstaand</span><strong>${openTasks.length}</strong></div>
    <div class="card"><span>Te laat</span><strong>${overdue}</strong></div>
    <div class="card"><span>Vandaag</span><strong>${todayCount}</strong></div>
    <div class="card"><span>Komende 7 dagen</span><strong>${weekCount}</strong></div>
    <div class="card"><span>Wachten op reactie</span><strong>${waiting}</strong></div>
    <div class="card"><span>Afgerond</span><strong>${completed}</strong></div>
  `;

  const objectOptions=vastgoedData
    .slice()
    .sort(compareObjectAddress)
    .map(property=>`<option value="${escAttr(property.id)}" ${taskObjectFilter===property.id?'selected':''}>${escHtml(property.object)}</option>`)
    .join('');

  filters.innerHTML=`<div class="maintenanceFilters taskFilterBar">
    <label>Status
      <select id="taskStatusFilter">
        <option value="open" ${taskStatusFilter==='open'?'selected':''}>Alle openstaande taken</option>
        <option value="" ${taskStatusFilter===''?'selected':''}>Alle statussen</option>
        ${TASK_STATUSES.map(status=>`<option value="${escAttr(status)}" ${taskStatusFilter===status?'selected':''}>${escHtml(status)}</option>`).join('')}
      </select>
    </label>
    <label>Prioriteit
      <select id="taskPriorityFilter">
        <option value="">Alle prioriteiten</option>
        ${TASK_PRIORITIES.map(priority=>`<option value="${escAttr(priority)}" ${taskPriorityFilter===priority?'selected':''}>${escHtml(priority)}</option>`).join('')}
      </select>
    </label>
    <label>Object
      <select id="taskObjectFilter">
        <option value="">Alle objecten</option>
        ${objectOptions}
      </select>
    </label>
    <label>Deadline
      <select id="taskDateFilter">
        <option value="">Alle deadlines</option>
        <option value="overdue" ${taskDateFilter==='overdue'?'selected':''}>Te laat</option>
        <option value="today" ${taskDateFilter==='today'?'selected':''}>Vandaag</option>
        <option value="week" ${taskDateFilter==='week'?'selected':''}>Komende 7 dagen</option>
        <option value="none" ${taskDateFilter==='none'?'selected':''}>Geen deadline</option>
      </select>
    </label>
  </div>`;

  const rows=filteredTasks();
  table.innerHTML=`<tr>
    <th>Onderwerp</th>
    <th>Object</th>
    <th>Deadline</th>
    <th>Prioriteit</th>
    <th>Status</th>
    <th>Actie</th>
  </tr>`+rows.map(task=>{
    const property=taskProperty(task);
    const due=taskDueInfo(task);
    return `<tr class="${task.status==='Afgerond'?'taskCompletedRow':''}">
      <td>
        <strong>${escHtml(task.title)}</strong>
        ${task.description?`<span class="subtle taskDescriptionPreview">${escHtml(task.description)}</span>`:''}
      </td>
      <td>${property?`<button class="miniLink detailBtn" data-id="${property.id}">${escHtml(property.object)}</button><span class="subtle">${escHtml([property.straatnaam,property.huisnummer,property.stad].filter(Boolean).join(' '))}</span>`:'<span class="subtle">Niet gekoppeld</span>'}</td>
      <td>${statusBadge(due)}${task.due_date?`<span class="subtle">${dateFmt(task.due_date)}</span>`:''}</td>
      <td><span class="taskPriority ${taskPriorityTone(task.priority)}">${escHtml(task.priority||'Normaal')}</span></td>
      <td>
        <select class="taskQuickStatus" data-id="${task.id}" ${tasksReady?'':'disabled'}>
          ${TASK_STATUSES.map(status=>`<option ${task.status===status?'selected':''}>${escHtml(status)}</option>`).join('')}
        </select>
      </td>
      <td><button class="miniLink taskEditBtn" data-task-id="${task.id}">Bewerken</button></td>
    </tr>`;
  }).join('')||'<tr><td colspan="6">Geen taken gevonden binnen dit filter.</td></tr>';
}

function openTaskModal(taskId='',propertyId=''){
  if(!tasksReady){
    alert('Voer eerst het meegeleverde Supabase SQL-bestand uit.');
    return;
  }

  const task=taskId?rawTasks.find(item=>item.id===taskId):null;
  el('taskForm').reset();
  el('taskId').value=task?.id||'';
  el('taskModalTitle').textContent=task?'Taak bewerken':'Taak toevoegen';
  el('taskTitle').value=task?.title||'';
  el('taskPropertyId').innerHTML=taskPropertyOptions(task?.property_id||propertyId||'');
  el('taskDueDate').value=task?.due_date||'';
  el('taskPriority').value=task?.priority||'Normaal';
  el('taskStatus').value=task?.status||'Open';
  el('taskDescription').value=task?.description||'';
  el('deleteTaskBtn').classList.toggle('hidden',!task);
  el('taskMessage').textContent='';
  el('taskModal').classList.remove('hidden');
  window.setTimeout(()=>el('taskTitle')?.focus(),50);
}

function closeTaskModal(){
  el('taskModal')?.classList.add('hidden');
}

async function saveTask(event){
  event.preventDefault();
  if(!tasksReady) return;

  const id=el('taskId').value;
  const status=el('taskStatus').value;
  const payload={
    property_id:el('taskPropertyId').value||null,
    title:clean(el('taskTitle').value),
    description:clean(el('taskDescription').value)||null,
    due_date:el('taskDueDate').value||null,
    priority:el('taskPriority').value,
    status,
    completed_at:status==='Afgerond'?new Date().toISOString():null,
    updated_at:new Date().toISOString()
  };

  if(!payload.title){
    el('taskMessage').textContent='Vul een onderwerp in.';
    return;
  }

  el('taskMessage').textContent='Taak wordt opgeslagen...';
  const result=id
    ? await sb.from('property_tasks').update(payload).eq('id',id).select('*').single()
    : await sb.from('property_tasks').insert(payload).select('*').single();

  if(result.error){
    el('taskMessage').textContent='Opslaan mislukt: '+result.error.message;
    return;
  }

  await loadData();
  closeTaskModal();
  setPage('taken','Taken');
}

async function updateTaskStatusQuick(select){
  const task=rawTasks.find(item=>item.id===select.dataset.id);
  if(!task) return;
  const previous=task.status;
  const status=select.value;
  select.disabled=true;

  const result=await sb
    .from('property_tasks')
    .update({
      status,
      completed_at:status==='Afgerond'?new Date().toISOString():null,
      updated_at:new Date().toISOString()
    })
    .eq('id',task.id)
    .select('*')
    .single();

  select.disabled=false;
  if(result.error){
    select.value=previous;
    alert('Status bijwerken mislukt: '+result.error.message);
    return;
  }

  const index=rawTasks.findIndex(item=>item.id===task.id);
  if(index>=0) rawTasks[index]=result.data;
  render();
}

async function deleteTask(){
  const id=el('taskId').value;
  if(!id||!confirm('Deze taak definitief verwijderen?')) return;

  el('taskMessage').textContent='Taak wordt verwijderd...';
  const result=await sb.from('property_tasks').delete().eq('id',id);
  if(result.error){
    el('taskMessage').textContent='Verwijderen mislukt: '+result.error.message;
    return;
  }

  rawTasks=rawTasks.filter(task=>task.id!==id);
  closeTaskModal();
  render();
}

function taskListForPropertyHtml(propertyId){
  if(!tasksReady){
    return '<p class="empty">Voer eerst de taken-SQL uit om taken te kunnen gebruiken.</p>';
  }

  const tasks=rawTasks
    .filter(task=>task.property_id===propertyId)
    .sort((a,b)=>{
      const aDone=a.status==='Afgerond'?1:0;
      const bDone=b.status==='Afgerond'?1:0;
      if(aDone!==bDone) return aDone-bDone;
      return String(a.due_date||'9999-12-31').localeCompare(String(b.due_date||'9999-12-31'));
    });

  const rows=tasks.slice(0,10).map(task=>{
    const due=taskDueInfo(task);
    return `<div class="taskDetailItem">
      <div>
        <strong>${escHtml(task.title)}</strong>
        <span>${statusBadge(due)} ${escHtml(task.status)}${task.due_date?` · ${dateFmt(task.due_date)}`:''}</span>
      </div>
      <button class="miniLink taskEditBtn" data-task-id="${task.id}">Bewerken</button>
    </div>`;
  }).join('');

  return `<div class="taskDetailHeader">
    <span>${tasks.length?`${tasks.length} gekoppelde ${tasks.length===1?'taak':'taken'}`:'Nog geen taken gekoppeld.'}</span>
    <button class="smallBtn newTaskForObjectBtn" data-id="${propertyId}">+ Taak</button>
  </div>
  <div class="taskDetailList">${rows||'<p class="empty">Nog geen taken toegevoegd.</p>'}</div>`;
}

function usefulDataValue(value){
  const text=clean(value);
  return Boolean(text&&text!=='-'&&text.toLowerCase()!=='onbekend');
}

function hasPropertyDocumentType(r,terms){
  return (r.documenten||[]).some(document=>{
    const haystack=norm(`${document.document_type||''} ${document.name||''}`);
    return terms.some(term=>haystack.includes(norm(term)));
  });
}

function dataCheckOverride(propertyId,checkKey){
  return rawDataCheckOverrides.find(item=>
    item.property_id===propertyId&&item.check_key===checkKey
  )||null;
}

function dataCheckResolutionLabel(resolution){
  return resolution==='niet_van_toepassing'?'Niet van toepassing':'Bewust leeg';
}

function dataCheckFieldId(checkKey){
  const fields={
    name:'propertyName',
    address:'propertyAddress',
    house_number:'propertyHouseNumber',
    postal_code:'propertyPostalCode',
    city:'propertyCity',
    property_type:'propertyType',
    status:'propertyStatus',
    contract:'contractStartDate',
    tenant:'tenantName',
    tenant_contact:'tenantEmail',
    billing_name:'propertyBillingName',
    billing_address:'propertyBillingAddress',
    billing_city:'propertyBillingPostalCode',
    contract_start:'contractStartDate',
    notice_period:'contractNoticePeriodMonths',
    monthly_rent:'propertyMonthlyRent',
    yearly_rent:'propertyYearlyRent',
    yearly_rent_match:'propertyYearlyRent',
    rent_increase_month:'propertyRentIncreaseMonth',
    energy_label:'propertyEnergyLabel',
    energy_label_date:'propertyEnergyValidUntil',
    woz_value:'propertyWozValue'
  };
  return fields[checkKey]||'propertyName';
}

function openDataCheckField(propertyId,checkKey){
  openEditProperty(propertyId);
  window.setTimeout(()=>{
    const field=el(dataCheckFieldId(checkKey));
    if(!field) return;
    field.scrollIntoView({behavior:'smooth',block:'center'});
    field.classList.add('dataCheckFieldHighlight');
    try{field.focus({preventScroll:true});}catch(error){field.focus();}
    window.setTimeout(()=>field.classList.remove('dataCheckFieldHighlight'),2600);
  },80);
}

async function saveDataCheckOverride(propertyId,checkKey,resolution){
  if(!dataCheckOverridesReady){
    alert('Voer eerst het meegeleverde Supabase SQL-bestand uit.');
    return;
  }

  const report=propertyDataCheck(vastgoedData.find(item=>item.id===propertyId));
  const check=report?.checks.find(item=>item.key===checkKey);
  if(!check) return;

  const resolutionLabel=dataCheckResolutionLabel(resolution);
  const current=dataCheckOverride(propertyId,checkKey);
  const note=window.prompt(
    `${check.label} markeren als "${resolutionLabel}".\n\nVoeg eventueel een korte toelichting toe:`,
    current?.note||''
  );
  if(note===null) return;

  const payload={
    property_id:propertyId,
    check_key:checkKey,
    resolution,
    note:clean(note)||null,
    updated_at:new Date().toISOString()
  };

  const result=await sb
    .from('property_data_check_overrides')
    .upsert(payload,{onConflict:'property_id,check_key'})
    .select('*')
    .single();

  if(result.error) throw result.error;

  rawDataCheckOverrides=rawDataCheckOverrides.filter(item=>
    !(item.property_id===propertyId&&item.check_key===checkKey)
  );
  rawDataCheckOverrides.unshift(result.data);
  render();
}

async function deleteDataCheckOverride(id){
  const current=rawDataCheckOverrides.find(item=>item.id===id);
  if(!current) return;
  if(!confirm('Deze afhandeling herstellen en het punt opnieuw als ontbrekend tonen?')) return;

  const result=await sb
    .from('property_data_check_overrides')
    .delete()
    .eq('id',id);

  if(result.error) throw result.error;
  rawDataCheckOverrides=rawDataCheckOverrides.filter(item=>item.id!==id);
  render();
}

function propertyDataCheck(r){
  if(!r) return null;

  const checks=[];
  const add=(key,label,ok,{weight=2,severity='danger',group='Objectgegevens',detail=''}={})=>{
    const valid=Boolean(ok);
    const override=valid?null:dataCheckOverride(r.id,key);
    checks.push({
      key,
      label,
      ok:valid,
      effectiveOk:valid||Boolean(override),
      override,
      weight,
      severity,
      level:severity==='danger'?'Verplicht':'Aanbevolen',
      group,
      detail
    });
  };

  const property=r.property||{};
  const contract=r.contract||{};
  const timeline=r.contract_timeline||contractTimeline(contract);
  const statusText=norm(r.status);
  const exemptFromTenancy=['leeg','inactief','verkocht','ontwikkeling'].some(term=>statusText.includes(term));
  const hasContract=Boolean(contract.id);
  const hasTenant=usefulDataValue(r.huurder);
  const tenancyExpected=hasContract||!exemptFromTenancy;
  const activeContract=hasContract&&!timeline.terminated;

  add('name','Objectnaam',usefulDataValue(property.name),{group:'Objectgegevens'});
  add('address','Straatnaam',usefulDataValue(r.straatnaam),{group:'Objectgegevens'});
  add('house_number','Huisnummer',usefulDataValue(r.huisnummer),{group:'Objectgegevens'});
  add('postal_code','Postcode',usefulDataValue(r.postcode),{group:'Objectgegevens'});
  add('city','Plaats',usefulDataValue(r.stad),{group:'Objectgegevens'});
  add('property_type','Type pand',usefulDataValue(r.type),{group:'Objectgegevens'});
  add('status','Objectstatus',usefulDataValue(r.status),{group:'Objectgegevens'});

  if(tenancyExpected){
    add('contract','Actief contract gekoppeld',hasContract,{
      group:'Contract',
      detail:'Zet het object op Leegstand of Inactief wanneer er bewust geen contract is.'
    });
    add('tenant','Huurder gekoppeld',hasTenant,{group:'Huurder'});

    if(hasTenant){
      add('tenant_contact','E-mail of telefoon huurder',usefulDataValue(r.email)||usefulDataValue(r.telefoon),{
        weight:1,
        severity:'warning',
        group:'Huurder'
      });
    }
  }

  const customBillingValues=[
    r.factuur_naam,r.factuur_adres,r.factuur_huisnummer,r.factuur_postcode,r.factuur_stad
  ];
  if(customBillingValues.some(usefulDataValue)){
    add('billing_name','Naam ontvanger factuuradres',usefulDataValue(r.factuur_naam),{
      weight:1,severity:'warning',group:'Correspondentie'
    });
    add('billing_address','Volledig factuuradres',usefulDataValue(r.factuur_adres)&&usefulDataValue(r.factuur_huisnummer),{
      weight:1,severity:'warning',group:'Correspondentie'
    });
    add('billing_city','Postcode en plaats factuuradres',usefulDataValue(r.factuur_postcode)&&usefulDataValue(r.factuur_stad),{
      weight:1,severity:'warning',group:'Correspondentie'
    });
  }

  if(hasContract){
    add('contract_start','Startdatum contract',usefulDataValue(r.startdatum_contract),{group:'Contract'});
    add('notice_period','Opzegtermijn contract',Number(timeline.noticeMonths)>0,{
      group:'Contract',
      detail:'Vul de contractuele opzegtermijn in maanden in.'
    });
  }

  if(activeContract){
    add('monthly_rent','Maandhuur',Number(r.huur_pm)>0,{group:'Financieel'});
    add('yearly_rent','Jaarhuur',Number(r.huur_pj)>0,{group:'Financieel'});
    add('rent_increase_month','Maand huurverhoging',usefulDataValue(r.maand_huurverhoging),{
      weight:1,
      severity:'warning',
      group:'Financieel'
    });

    if(Number(r.huur_pm)>0&&Number(r.huur_pj)>0){
      const expected=Number(r.huur_pm)*12;
      add('yearly_rent_match','Jaarhuur sluit aan op maandhuur',Math.abs(Number(r.huur_pj)-expected)<0.02,{
        weight:1,
        severity:'warning',
        group:'Financieel',
        detail:`Verwachte jaarhuur: ${euro2(expected)}.`
      });
    }
  }

  if(r.energielabel_verplicht){
    add('energy_label','Energielabel',usefulDataValue(r.energielabel),{
      group:'Energie',
      detail:'Dit object staat ingesteld als energielabelplichtig.'
    });
    add('energy_label_date','Geldigheidsdatum energielabel',usefulDataValue(r.energielabel_geldig_tot),{
      group:'Energie',
      detail:'Dit object staat ingesteld als energielabelplichtig.'
    });
  }

  add('woz_value','WOZ-waarde',Number(r.woz_waarde)>0,{
    weight:1,
    severity:'warning',
    group:'Aanbevolen'
  });

  const totalWeight=checks.reduce((sum,check)=>sum+check.weight,0);
  const passedWeight=checks.filter(check=>check.effectiveOk).reduce((sum,check)=>sum+check.weight,0);
  const score=totalWeight?Math.round((passedWeight/totalWeight)*100):100;
  const issues=checks.filter(check=>!check.effectiveOk);
  const resolved=checks.filter(check=>!check.ok&&Boolean(check.override));
  const criticalCount=issues.filter(issue=>issue.severity==='danger').length;

  let status=resolved.length?'Afgehandeld':'Compleet';
  let tone='ok';
  if(criticalCount>0||score<80){
    status='Onvoldoende';
    tone='danger';
  }else if(issues.length){
    status='Aandacht';
    tone='warning';
  }

  return {r,checks,issues,resolved,score,status,tone,criticalCount};
}

function dataCheckReports(data){
  return data
    .map(propertyDataCheck)
    .filter(Boolean)
    .sort((a,b)=>
      a.score-b.score ||
      b.criticalCount-a.criticalCount ||
      compareObjectAddress(a.r,b.r)
    );
}

function renderDataCheck(data){
  const summary=el('dataCheckSummary');
  const filters=el('dataCheckFilters');
  const table=el('dataCheckTable');
  if(!summary||!filters||!table) return;

  const reports=dataCheckReports(data);
  const complete=reports.filter(report=>report.status==='Compleet').length;
  const handled=reports.filter(report=>report.status==='Afgehandeld').length;
  const attention=reports.filter(report=>report.status==='Aandacht').length;
  const insufficient=reports.filter(report=>report.status==='Onvoldoende').length;
  const totalIssues=reports.reduce((sum,report)=>sum+report.issues.length,0);
  const totalResolved=reports.reduce((sum,report)=>sum+report.resolved.length,0);
  const groups=[...new Set(reports.flatMap(report=>report.checks.map(check=>check.group)))]
    .sort((a,b)=>a.localeCompare(b,'nl',{sensitivity:'base'}));

  summary.innerHTML=`
    <div class="card"><span>Gecontroleerde objecten</span><strong>${reports.length}</strong></div>
    <div class="card"><span>Compleet</span><strong>${complete}</strong></div>
    <div class="card"><span>Bewust afgehandeld</span><strong>${handled}</strong></div>
    <div class="card"><span>Aandacht</span><strong>${attention}</strong></div>
    <div class="card"><span>Onvoldoende</span><strong>${insufficient}</strong></div>
    <div class="card"><span>Open datapunten</span><strong>${totalIssues}</strong></div>
  `;

  filters.innerHTML=`
    ${!dataCheckOverridesReady?'<div class="importNotice warning"><strong>Eenmalige Supabase-instelling nodig</strong><span>Voer het meegeleverde SQL-bestand uit om Bewust leeg en Niet van toepassing per object te kunnen bewaren.</span></div>':''}
    <div class="maintenanceFilters dataCheckFilterBar">
      <label>Status
        <select id="dataCheckStatusFilter">
          <option value="incomplete" ${dataCheckStatusFilter==='incomplete'?'selected':''}>Niet compleet (${attention+insufficient})</option>
          <option value="" ${dataCheckStatusFilter===''?'selected':''}>Alle objecten (${reports.length})</option>
          <option value="danger" ${dataCheckStatusFilter==='danger'?'selected':''}>Onvoldoende (${insufficient})</option>
          <option value="warning" ${dataCheckStatusFilter==='warning'?'selected':''}>Aandacht (${attention})</option>
          <option value="resolved" ${dataCheckStatusFilter==='resolved'?'selected':''}>Bewust afgehandeld (${handled})</option>
          <option value="ok" ${dataCheckStatusFilter==='ok'?'selected':''}>Compleet / afgehandeld (${complete+handled})</option>
        </select>
      </label>
      <label>Onderdeel
        <select id="dataCheckGroupFilter">
          <option value="">Alle onderdelen</option>
          ${groups.map(group=>`<option value="${escAttr(group)}" ${dataCheckGroupFilter===group?'selected':''}>${escHtml(group)}</option>`).join('')}
        </select>
      </label>
    </div>`;

  const visible=reports.filter(report=>{
    let statusMatch=true;
    if(dataCheckStatusFilter==='incomplete') statusMatch=report.tone!=='ok';
    else if(dataCheckStatusFilter==='resolved') statusMatch=report.resolved.length>0;
    else if(dataCheckStatusFilter) statusMatch=report.tone===dataCheckStatusFilter;

    const groupMatch=!dataCheckGroupFilter||
      report.issues.some(issue=>issue.group===dataCheckGroupFilter)||
      report.resolved.some(item=>item.group===dataCheckGroupFilter);

    return statusMatch&&groupMatch;
  });

  table.innerHTML=`<tr>
    <th>Object</th>
    <th>Volledigheid</th>
    <th>Status</th>
    <th>Ontbrekend / afgehandeld</th>
    <th>Actie</th>
  </tr>`+visible.map(report=>{
    const visibleIssues=dataCheckGroupFilter
      ? report.issues.filter(issue=>issue.group===dataCheckGroupFilter)
      : report.issues;
    const visibleResolved=dataCheckGroupFilter
      ? report.resolved.filter(item=>item.group===dataCheckGroupFilter)
      : report.resolved;

    const issueHtml=visibleIssues.map(issue=>`
      <div class="dataCheckIssueCard ${issue.severity}">
        <div class="dataCheckIssueMain">
          <div class="dataCheckIssueHeading">
            <span class="dataCheckLevel ${issue.severity}">${escHtml(issue.level)}</span>
            <strong>${escHtml(issue.label)}</strong>
          </div>
          <small>${escHtml(issue.detail||issue.group)}</small>
        </div>
        <div class="dataCheckIssueActions">
          <button class="miniLink dataCheckEditBtn" data-id="${report.r.id}" data-check-key="${escAttr(issue.key)}">Aanvullen</button>
          <button class="miniLink dataCheckResolveBtn" data-id="${report.r.id}" data-check-key="${escAttr(issue.key)}" data-resolution="bewust_leeg" ${dataCheckOverridesReady?'':'disabled'}>Bewust leeg</button>
          <button class="miniLink dataCheckResolveBtn" data-id="${report.r.id}" data-check-key="${escAttr(issue.key)}" data-resolution="niet_van_toepassing" ${dataCheckOverridesReady?'':'disabled'}>N.v.t.</button>
        </div>
      </div>
    `).join('');

    const resolvedHtml=visibleResolved.map(item=>`
      <div class="dataCheckResolvedCard">
        <div>
          <span class="dataCheckResolvedBadge">${escHtml(dataCheckResolutionLabel(item.override.resolution))}</span>
          <strong>${escHtml(item.label)}</strong>
          ${item.override.note?`<small>${escHtml(item.override.note)}</small>`:''}
        </div>
        <button class="miniLink dataCheckResetBtn" data-override-id="${item.override.id}">Herstellen</button>
      </div>
    `).join('');

    const checksHtml=issueHtml+resolvedHtml||
      '<span class="dataCheckCompleteText">Alle gecontroleerde gegevens zijn aanwezig.</span>';

    return `<tr>
      <td>
        <strong>${escHtml(report.r.object)}</strong>
        <span class="subtle">${escHtml([report.r.straatnaam,report.r.huisnummer,report.r.postcode,report.r.stad].filter(Boolean).join(' '))}</span>
      </td>
      <td>
        <div class="dataCheckProgress" aria-label="${report.score}% compleet">
          <span style="width:${report.score}%"></span>
        </div>
        <strong class="dataCheckScore">${report.score}%</strong>
      </td>
      <td>${statusBadge([report.status,report.tone])}</td>
      <td><div class="dataCheckIssueStack">${checksHtml}</div></td>
      <td>
        <div class="dataCheckActions">
          <button class="miniLink detailBtn" data-id="${report.r.id}">Open object</button>
          <button class="miniLink editBtn" data-id="${report.r.id}">Bewerken</button>
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="5">Geen objecten gevonden binnen dit filter.</td></tr>';
}

function renderNotificationFilters(items){
  const target=el('notificationFilters');
  if(!target) return;

  const counts={};
  items.forEach(item=>{
    const type=clean(item.type)||'Overig';
    counts[type]=(counts[type]||0)+1;
  });

  const types=Object.keys(counts).sort((a,b)=>
    a.localeCompare(b,'nl',{sensitivity:'base',numeric:true})
  );

  if(notificationTypeFilter&&!types.includes(notificationTypeFilter)){
    notificationTypeFilter='';
  }

  target.innerHTML=`<div class="maintenanceFilters">
    <label>Onderwerp
      <select id="notificationTypeFilter">
        <option value="">Alle onderwerpen (${items.length})</option>
        ${types.map(type=>`<option value="${escAttr(type)}" ${notificationTypeFilter===type?'selected':''}>${escHtml(type)} (${counts[type]})</option>`).join('')}
      </select>
    </label>
  </div>`;
}

function filteredNotificationItems(items){
  if(!notificationTypeFilter) return items;
  return items.filter(item=>item.type===notificationTypeFilter);
}


const DASHBOARD_NOTIFICATION_LOCAL_KEY='vastgoedDashboardNotificationStateV1';

function notificationKeyPart(value){
  return norm(value)
    .replace(/\b\d+\b/g,'#')
    .replace(/[^a-z0-9_-]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,100)||'melding';
}

function dashboardNotificationKey(item){
  if(item.reportId) return `tenant-report:${item.reportId}`;
  if(item.taskId) return `task:${item.taskId}`;
  if(item.sourceId) return `${notificationKeyPart(item.type)}:${item.sourceId}`;
  return [notificationKeyPart(item.type),item.objectId||'algemeen',notificationKeyPart(item.title)].join(':');
}

function readLocalDashboardNotificationStates(){
  try{
    const value=JSON.parse(localStorage.getItem(DASHBOARD_NOTIFICATION_LOCAL_KEY)||'{}');
    return value&&typeof value==='object'?value:{};
  }catch(error){
    return {};
  }
}

function writeLocalDashboardNotificationStates(states){
  try{ localStorage.setItem(DASHBOARD_NOTIFICATION_LOCAL_KEY,JSON.stringify(states)); }
  catch(error){ console.warn('Lokale meldingsstatus kon niet worden opgeslagen:',error.message); }
}

function dashboardNotificationState(item){
  const key=dashboardNotificationKey(item);
  const remote=rawDashboardNotificationStates.find(row=>row.notification_key===key);
  if(remote) return remote;
  const local=readLocalDashboardNotificationStates()[key];
  return local?{notification_key:key,...local}:null;
}

function notificationDateIsToday(value){
  if(!value) return false;
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return false;
  const today=new Date();
  return date.getFullYear()===today.getFullYear()&&date.getMonth()===today.getMonth()&&date.getDate()===today.getDate();
}

function notificationIsSnoozed(item){
  const state=dashboardNotificationState(item);
  if(!state?.snoozed_until) return false;
  const until=new Date(state.snoozed_until);
  return !Number.isNaN(until.getTime())&&until.getTime()>Date.now();
}

function notificationNeedsAutoPopup(item){
  if(notificationIsSnoozed(item)) return false;
  const state=dashboardNotificationState(item);
  return !notificationDateIsToday(state?.seen_at);
}

function tomorrowReminderIso(){
  const date=new Date();
  date.setDate(date.getDate()+1);
  date.setHours(8,0,0,0);
  return date.toISOString();
}

async function saveDashboardNotificationState(item,patch){
  const key=dashboardNotificationKey(item);
  const localStates=readLocalDashboardNotificationStates();
  const existing=dashboardNotificationState(item)||{};
  const next={
    seen_at:patch.seen_at!==undefined?patch.seen_at:(existing.seen_at||null),
    snoozed_until:patch.snoozed_until!==undefined?patch.snoozed_until:(existing.snoozed_until||null),
    updated_at:new Date().toISOString()
  };
  localStates[key]=next;
  writeLocalDashboardNotificationStates(localStates);

  const localIndex=rawDashboardNotificationStates.findIndex(row=>row.notification_key===key);
  const optimistic={...existing,notification_key:key,...next};
  if(localIndex>=0) rawDashboardNotificationStates[localIndex]=optimistic;
  else rawDashboardNotificationStates.push(optimistic);

  if(!dashboardNotificationStateReady||!sb) return optimistic;
  const result=await sb.from('dashboard_notification_state').upsert({
    notification_key:key,
    seen_at:next.seen_at,
    snoozed_until:next.snoozed_until,
    updated_at:next.updated_at
  },{onConflict:'user_id,notification_key'}).select('*').single();
  if(result.error){
    dashboardNotificationStateReady=false;
    console.warn('Meldingsstatus kon niet in Supabase worden opgeslagen:',result.error.message);
    return optimistic;
  }
  const index=rawDashboardNotificationStates.findIndex(row=>row.notification_key===key);
  if(index>=0) rawDashboardNotificationStates[index]=result.data;
  else rawDashboardNotificationStates.push(result.data);
  return result.data;
}

function markDashboardNotificationsSeen(items){
  const seenAt=new Date().toISOString();
  items.forEach(item=>{
    saveDashboardNotificationState(item,{seen_at:seenAt}).catch(error=>console.warn('Melding kon niet als gezien worden opgeslagen:',error.message));
  });
}

function notificationCenterAllItems(){
  return notificationItems(vastgoedData);
}

function notificationCenterVisibleItems(){
  const all=notificationCenterAllItems();
  let items=notificationCenterScope==='auto'
    ? all.filter(item=>notificationCenterAutoKeys.has(dashboardNotificationKey(item)))
    : all;
  if(notificationCenterFilter==='urgent') items=items.filter(item=>item.sev==='danger');
  if(notificationCenterFilter==='tenant') items=items.filter(item=>Boolean(item.reportId));
  if(notificationCenterFilter==='automatic') items=items.filter(item=>!item.reportId);
  return items;
}

function notificationButtonLabel(text){
  return `<span class="notificationButtonLabel">${escHtml(text)}</span>`;
}

function notificationCenterActionHtml(item){
  const actions=[];
  const report=item.reportId?rawTenantIssueReports.find(row=>row.id===item.reportId):null;
  if(item.reportId){
    actions.push(`<button type="button" class="notificationCenterAction primary tenantReportOpenBtn" data-report-id="${escAttr(item.reportId)}">${notificationButtonLabel('Bekijken')}</button>`);
    if(report&&tenantReportIsOpen(report)&&report.status!=='In behandeling') actions.push(`<button type="button" class="notificationCenterAction tenantReportStartBtn" data-report-id="${escAttr(item.reportId)}">${notificationButtonLabel('In behandeling')}</button>`);
    if(report&&tenantReportIsOpen(report)) actions.push(`<button type="button" class="notificationCenterAction complete tenantReportCompleteBtn" data-report-id="${escAttr(item.reportId)}">${notificationButtonLabel('Afronden')}</button>`);
  }else if(item.type==='Huurverhoging'&&item.objectId){
    actions.push(`<button type="button" class="notificationCenterAction primary rentEditBtn" data-id="${escAttr(item.objectId)}">${notificationButtonLabel('Huurverhoging openen')}</button>`);
  }else if(item.taskId){
    actions.push(`<button type="button" class="notificationCenterAction primary taskEditBtn" data-task-id="${escAttr(item.taskId)}">${notificationButtonLabel('Taak openen')}</button>`);
  }else if(item.objectId){
    actions.push(`<button type="button" class="notificationCenterAction primary detailBtn" data-id="${escAttr(item.objectId)}">${notificationButtonLabel('Object bekijken')}</button>`);
  }
  if(!notificationIsSnoozed(item)){
    actions.push(`<button type="button" class="notificationCenterAction notificationSnoozeBtn" data-notification-key="${escAttr(dashboardNotificationKey(item))}">${notificationButtonLabel('Herinner morgen')}</button>`);
  }
  return actions.join('');
}

function notificationCenterCardHtml(item){
  const visual=notificationVisual(item);
  const snoozed=notificationIsSnoozed(item);
  const urgency=item.sev==='danger'?'Urgent':item.sev==='warning'?'Aandacht':'Nieuw';
  return `<article class="notificationCenterCard notificationCenterCard--${visual.kind} ${snoozed?'is-snoozed':''}" data-notification-key="${escAttr(dashboardNotificationKey(item))}">
    <div class="notificationCenterCardTop">
      <span class="notificationCenterCardIcon" aria-hidden="true">${visual.icon}</span>
      <div><span class="notificationCenterSource">${escHtml(visual.label)}</span><strong>${escHtml(item.title)}</strong></div>
      <span class="notificationCenterUrgency notificationCenterUrgency--${escAttr(item.sev)}">${urgency}</span>
    </div>
    <p>${escHtml(item.text)}</p>
    ${snoozed?'<div class="notificationCenterSnoozed">Herinnering staat gepland voor morgen om 08:00.</div>':''}
    <div class="notificationCenterCardActions">${notificationCenterActionHtml(item)}</div>
  </article>`;
}

function ensureNotificationCenterUi(){
  if(!document.getElementById('dashboardNotificationCenterStyles')){
    const style=document.createElement('style');
    style.id='dashboardNotificationCenterStyles';
    style.textContent=`
      .dashboardNotificationBell{position:fixed;right:22px;top:18px;z-index:9000;width:48px;height:48px;border:1px solid #cbd5e1;border-radius:999px;background:#fff!important;color:#0f172a!important;-webkit-text-fill-color:currentColor!important;box-shadow:0 10px 30px rgba(15,23,42,.18);cursor:pointer;display:grid;place-items:center;padding:0!important;appearance:none;-webkit-appearance:none}.dashboardNotificationBellIcon{display:grid;place-items:center;width:24px;height:24px}.dashboardNotificationBellIcon svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
      .dashboardNotificationBell:hover{background:#f8fafc}.dashboardNotificationBell[hidden]{display:none}
      .dashboardNotificationBellBadge{position:absolute;right:-4px;top:-5px;min-width:23px;height:23px;padding:0 6px;border-radius:999px;background:#dc2626;color:#fff;border:2px solid #fff;font-size:11px;font-weight:900;display:grid;place-items:center}
      .dashboardNotificationBellBadge.is-zero{background:#64748b}
      .notificationCenterLayer{position:fixed;inset:0;z-index:10020;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.62)}
      .notificationCenterLayer.hidden{display:none}.notificationCenterCardShell{width:min(900px,100%);max-height:92vh;display:flex;flex-direction:column;background:#fff;border-radius:18px;box-shadow:0 28px 90px rgba(15,23,42,.4);overflow:hidden}
      .notificationCenterHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 24px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
      .notificationCenterEyebrow{margin:0 0 4px;color:#475569;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.notificationCenterHeader h2{margin:0;font-size:24px}.notificationCenterHeader p{margin:6px 0 0;color:#64748b}
      .notificationCenterClose{border:1px solid #0f172a!important;background:#0f172a!important;color:#fff!important;-webkit-text-fill-color:currentColor!important;width:40px;height:40px;min-width:40px;border-radius:999px;cursor:pointer;box-shadow:0 2px 8px rgba(15,23,42,.18);display:inline-flex!important;align-items:center;justify-content:center;padding:0!important;appearance:none;-webkit-appearance:none}.notificationCenterClose span{display:grid;place-items:center}.notificationCenterClose svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round}
      .notificationCenterSummary{display:flex;gap:9px;flex-wrap:wrap;padding:14px 24px;border-bottom:1px solid #e2e8f0;background:#fff}
      .notificationCenterFilter{border:1px solid #94a3b8!important;background:#fff!important;color:#0f172a!important;-webkit-text-fill-color:currentColor!important;border-radius:999px;padding:8px 12px;font:inherit!important;font-size:13px!important;line-height:1.25!important;font-weight:800!important;cursor:pointer;min-height:38px;appearance:none;-webkit-appearance:none;text-indent:0!important;opacity:1!important}.notificationCenterFilter.active{background:#0f172a!important;color:#fff!important;border-color:#0f172a!important;-webkit-text-fill-color:#fff!important}
      .notificationCenterBody{overflow:auto;padding:18px 24px 24px;display:grid;gap:12px;background:#f8fafc}
      .notificationCenterCard{border:1px solid #e2e8f0;border-left:7px solid #64748b;border-radius:12px;background:#fff;padding:14px 16px;box-shadow:0 3px 12px rgba(15,23,42,.05)}
      .notificationCenterCard--tenant{border-left-color:#2563eb;background:linear-gradient(90deg,#eff6ff 0,#fff 35%)}.notificationCenterCard--rent{border-left-color:#ea580c;background:linear-gradient(90deg,#fff7ed 0,#fff 35%)}
      .notificationCenterCard--maintenance{border-left-color:#dc2626;background:linear-gradient(90deg,#fef2f2 0,#fff 35%)}.notificationCenterCard--task{border-left-color:#7c3aed;background:linear-gradient(90deg,#f5f3ff 0,#fff 35%)}
      .notificationCenterCard.is-snoozed{opacity:.72}.notificationCenterCardTop{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px}.notificationCenterCardTop strong{display:block;margin-top:2px}
      .notificationCenterCardIcon{width:36px;height:36px;border-radius:999px;background:#e2e8f0;color:#334155;display:grid;place-items:center}.notificationCenterCardIcon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.notificationCenterCardIcon .notificationIconDot{fill:currentColor;stroke:none}.notificationCenterCard--tenant .notificationCenterCardIcon{background:#dbeafe;color:#1d4ed8}.notificationCenterCard--rent .notificationCenterCardIcon{background:#ffedd5;color:#c2410c}.notificationCenterCard--maintenance .notificationCenterCardIcon{background:#fee2e2;color:#b91c1c}.notificationCenterCard--task .notificationCenterCardIcon{background:#ede9fe;color:#6d28d9}.notificationCenterSource{display:block;color:#475569;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
      .notificationCenterUrgency{border-radius:999px;padding:5px 8px;font-size:11px;font-weight:900}.notificationCenterUrgency--danger{background:#fee2e2;color:#b91c1c}.notificationCenterUrgency--warning{background:#ffedd5;color:#c2410c}.notificationCenterUrgency--ok{background:#dcfce7;color:#166534}
      .notificationCenterCard p{margin:11px 0;color:#334155;line-height:1.5}.notificationCenterCardActions{display:flex;gap:8px;flex-wrap:wrap}.notificationCenterAction{border:1px solid #94a3b8!important;background:#fff!important;color:#0f172a!important;-webkit-text-fill-color:currentColor!important;border-radius:8px;padding:9px 12px;font:inherit!important;font-size:13px!important;line-height:1.25!important;font-weight:800!important;cursor:pointer;min-height:40px;display:inline-flex!important;align-items:center;justify-content:center;appearance:none;-webkit-appearance:none;text-indent:0!important;opacity:1!important;white-space:normal!important}.notificationButtonLabel{display:inline-block!important;color:inherit!important;-webkit-text-fill-color:inherit!important;opacity:1!important;visibility:visible!important;font-size:inherit!important;line-height:inherit!important;text-indent:0!important}
      .notificationCenterAction.primary{background:#0f172a!important;color:#fff!important;border-color:#0f172a!important;-webkit-text-fill-color:#fff!important}.notificationCenterCard--tenant .notificationCenterAction.primary{background:#2563eb!important;border-color:#2563eb!important}.notificationCenterCard--rent .notificationCenterAction.primary{background:#ea580c!important;border-color:#ea580c!important}.notificationCenterAction.complete{background:#15803d!important;color:#fff!important;border-color:#15803d!important;-webkit-text-fill-color:#fff!important}.notificationCenterAction:hover,.notificationCenterFilter:hover,.notificationCenterFooter button:hover{filter:brightness(.96)}.notificationCenterAction:focus-visible,.notificationCenterFilter:focus-visible,.notificationCenterClose:focus-visible,.notificationCenterFooter button:focus-visible,.dashboardNotificationBell:focus-visible{outline:3px solid #38bdf8!important;outline-offset:2px}
      .notificationCenterSnoozed{margin:8px 0;padding:8px 10px;border-radius:8px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:700}.notificationCenterEmpty{padding:34px;text-align:center;color:#64748b;background:#fff;border:1px dashed #cbd5e1;border-radius:12px}
      .notificationCenterFooter{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:15px 24px;border-top:1px solid #e2e8f0;background:#fff}.notificationCenterFooter button{border:1px solid #94a3b8!important;background:#fff!important;color:#0f172a!important;-webkit-text-fill-color:currentColor!important;border-radius:9px;padding:10px 13px;font:inherit!important;font-size:13px!important;line-height:1.25!important;font-weight:800!important;cursor:pointer;min-height:41px;display:inline-flex!important;align-items:center;justify-content:center;appearance:none;-webkit-appearance:none;text-indent:0!important;opacity:1!important}.notificationCenterFooter .primary{background:#0f172a!important;color:#fff!important;border-color:#0f172a!important;-webkit-text-fill-color:#fff!important}
      @media(max-width:720px){.dashboardNotificationBell{right:12px;top:12px}.notificationCenterLayer{padding:6px}.notificationCenterCardShell{max-height:97vh;border-radius:12px}.notificationCenterHeader,.notificationCenterSummary,.notificationCenterBody,.notificationCenterFooter{padding-left:14px;padding-right:14px}.notificationCenterCardTop{grid-template-columns:auto 1fr}.notificationCenterUrgency{grid-column:2;justify-self:start}.notificationCenterFooter{flex-direction:column}.notificationCenterFooter button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  if(!document.getElementById('dashboardNotificationBell')){
    const bell=document.createElement('button');
    bell.id='dashboardNotificationBell';
    bell.type='button';
    bell.className='dashboardNotificationBell';
    bell.setAttribute('aria-label','Dashboardmeldingen openen');
    bell.innerHTML=`<span class="dashboardNotificationBellIcon" aria-hidden="true">${notificationIconSvg('bell')}</span><span id="dashboardNotificationBellBadge" class="dashboardNotificationBellBadge is-zero">0</span>`;
    bell.hidden=true;
    document.body.appendChild(bell);
  }

  if(document.getElementById('notificationCenterModal')) return;
  const modal=document.createElement('div');
  modal.id='notificationCenterModal';
  modal.className='notificationCenterLayer hidden';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-labelledby','notificationCenterTitle');
  modal.innerHTML=`<section class="notificationCenterCardShell">
    <header class="notificationCenterHeader"><div><p class="notificationCenterEyebrow">Dashboardmeldingen</p><h2 id="notificationCenterTitle">Aandacht nodig</h2><p id="notificationCenterSubtitle">Alle openstaande aandachtspunten op één plek.</p></div><button type="button" class="notificationCenterClose" aria-label="Sluiten"><span aria-hidden="true">${notificationIconSvg('close')}</span></button></header>
    <div id="notificationCenterSummary" class="notificationCenterSummary"></div>
    <div id="notificationCenterBody" class="notificationCenterBody"></div>
    <footer class="notificationCenterFooter"><button type="button" id="notificationCenterPageBtn" class="primary"><span class="notificationButtonLabel">Open volledige meldingenpagina</span></button><button type="button" class="notificationCenterFooterClose"><span class="notificationButtonLabel">Sluiten</span></button></footer>
  </section>`;
  document.body.appendChild(modal);

  el('dashboardNotificationBell').addEventListener('click',()=>openNotificationCenter({scope:'all'}));
  modal.addEventListener('click',event=>{
    if(event.target===modal||event.target.closest('.notificationCenterClose,.notificationCenterFooterClose')){
      closeNotificationCenter();
      return;
    }
    const filter=event.target.closest('.notificationCenterFilter');
    if(filter){ notificationCenterFilter=filter.dataset.centerFilter||'all'; renderNotificationCenter(); return; }
    const snooze=event.target.closest('.notificationSnoozeBtn');
    if(snooze){ snoozeDashboardNotification(snooze.dataset.notificationKey); return; }
    if(event.target.closest('#notificationCenterPageBtn')){
      closeNotificationCenter();
      const nav=[...document.querySelectorAll('.nav')].find(button=>norm(button.dataset.title||button.textContent).includes('melding'));
      if(nav) nav.click();
      return;
    }
    if(event.target.closest('.detailBtn,.rentEditBtn,.taskEditBtn,.tenantReportOpenBtn')) closeNotificationCenter();
  });
}

function updateNotificationCenterBell(items=notificationCenterAllItems()){
  ensureNotificationCenterUi();
  const bell=el('dashboardNotificationBell');
  const badge=el('dashboardNotificationBellBadge');
  if(!bell||!badge) return;
  const appVisible=el('appView')&&!el('appView').classList.contains('hidden');
  bell.hidden=!appVisible;
  const count=items.length;
  badge.textContent=count>99?'99+':String(count);
  badge.classList.toggle('is-zero',count===0);
  const urgent=items.filter(item=>item.sev==='danger').length;
  bell.title=count?`${count} openstaande meldingen, waarvan ${urgent} urgent`:'Geen openstaande meldingen';
  bell.setAttribute('aria-label',bell.title);
}

function renderNotificationCenter(){
  ensureNotificationCenterUi();
  const all=notificationCenterAllItems();
  const items=notificationCenterVisibleItems();
  const urgent=all.filter(item=>item.sev==='danger').length;
  const tenants=all.filter(item=>item.reportId).length;
  const automatic=all.length-tenants;
  el('notificationCenterTitle').textContent=notificationCenterScope==='auto'?'Nieuwe en actuele meldingen':'Alle openstaande meldingen';
  el('notificationCenterSubtitle').textContent=notificationCenterScope==='auto'
    ? 'Dit overzicht verschijnt maximaal één keer per dag. Sluiten rondt niets af.'
    : 'Sluiten verbergt alleen deze pop-up; de onderliggende melding blijft openstaan.';
  el('notificationCenterSummary').innerHTML=`
    <button type="button" class="notificationCenterFilter ${notificationCenterFilter==='all'?'active':''}" data-center-filter="all">Alle (${notificationCenterScope==='auto'?notificationCenterAutoKeys.size:all.length})</button>
    <button type="button" class="notificationCenterFilter ${notificationCenterFilter==='urgent'?'active':''}" data-center-filter="urgent">Urgent (${urgent})</button>
    <button type="button" class="notificationCenterFilter ${notificationCenterFilter==='tenant'?'active':''}" data-center-filter="tenant">Huurders (${tenants})</button>
    <button type="button" class="notificationCenterFilter ${notificationCenterFilter==='automatic'?'active':''}" data-center-filter="automatic">Dashboard (${automatic})</button>`;
  el('notificationCenterBody').innerHTML=items.map(notificationCenterCardHtml).join('')||'<div class="notificationCenterEmpty"><strong>Geen meldingen binnen dit filter.</strong><br>Afgeronde of opgeloste onderwerpen verdwijnen automatisch uit dit overzicht.</div>';
}

function openNotificationCenter({scope='all',items=null}={}){
  ensureNotificationCenterUi();
  notificationCenterScope=scope;
  notificationCenterFilter='all';
  if(scope==='auto'){
    const popupItems=items||notificationCenterAllItems().filter(notificationNeedsAutoPopup);
    notificationCenterAutoKeys=new Set(popupItems.map(dashboardNotificationKey));
    markDashboardNotificationsSeen(popupItems);
  }else{
    notificationCenterAutoKeys=new Set();
  }
  renderNotificationCenter();
  el('notificationCenterModal').classList.remove('hidden');
}

function closeNotificationCenter(){
  el('notificationCenterModal')?.classList.add('hidden');
}

async function snoozeDashboardNotification(key){
  const item=notificationCenterAllItems().find(row=>dashboardNotificationKey(row)===key);
  if(!item) return;
  try{
    await saveDashboardNotificationState(item,{seen_at:new Date().toISOString(),snoozed_until:tomorrowReminderIso()});
    renderNotificationCenter();
  }catch(error){
    console.error(error);
    alert('Herinnering opslaan mislukt: '+error.message);
  }
}

function maybeOpenDashboardNotificationOverview(){
  ensureNotificationCenterUi();
  updateNotificationCenterBell();
  if(notificationCenterAutoHandled) return;
  notificationCenterAutoHandled=true;
  const items=notificationCenterAllItems().filter(notificationNeedsAutoPopup);
  if(!items.length) return;
  window.setTimeout(()=>{
    if(el('appView')&&!el('appView').classList.contains('hidden')) openNotificationCenter({scope:'auto',items});
  },450);
}

function notificationIconSvg(name){
  const icons={
    tenant:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="3.25"></circle><path d="M5.5 19c.7-3.7 3-5.5 6.5-5.5s5.8 1.8 6.5 5.5"></path></svg>',
    rent:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17 6.5h-5a5.5 5.5 0 0 0 0 11h5"></path><path d="M7.5 10h7M7.5 14h6"></path></svg>',
    task:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"></circle><path d="m8.2 12.2 2.4 2.4 5.4-5.5"></path></svg>',
    maintenance:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.5 6.1a4.1 4.1 0 0 0-5.2 5.2L4.7 16a2.1 2.1 0 0 0 3 3l4.6-4.6a4.1 4.1 0 0 0 5.2-5.2l-2.6 2.6-2.7-2.7 2.3-3z"></path></svg>',
    automatic:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4 3.8 19h16.4L12 4z"></path><path d="M12 9v4.5"></path><circle cx="12" cy="16.5" r=".7" class="notificationIconDot"></circle></svg>',
    bell:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 5 2 5.6 2 7H4.5c0-1.4 2-2 2-7z"></path><path d="M9.5 19a2.8 2.8 0 0 0 5 0"></path></svg>',
    close:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m7 7 10 10M17 7 7 17"></path></svg>'
  };
  return icons[name]||icons.automatic;
}

function notificationVisual(n){
  if(n.reportId) return {kind:'tenant',label:'Huurdersmelding',icon:notificationIconSvg('tenant')};
  if(n.type==='Huurverhoging') return {kind:'rent',label:'Automatische huurmelding',icon:notificationIconSvg('rent')};
  if(n.type==='Taak') return {kind:'task',label:'Taakmelding',icon:notificationIconSvg('task')};
  if(n.type==='Onderhoud'||n.type==='Keuring'||n.type==='Energielabel') return {kind:'maintenance',label:'Automatische beheermelding',icon:notificationIconSvg('maintenance')};
  return {kind:'automatic',label:'Automatische melding',icon:notificationIconSvg('automatic')};
}
function actionHtml(n){
  const visual=notificationVisual(n);
  const report=n.reportId?rawTenantIssueReports.find(item=>item.id===n.reportId):null;
  const tenantOpen=report&&tenantReportIsOpen(report);
  const actions=[];
  if(n.reportId){
    actions.push(`<button class="notificationAction notificationPrimary tenantReportOpenBtn" data-report-id="${escAttr(n.reportId)}">Melding bekijken</button>`);
    if(tenantOpen) actions.push(`<button class="notificationAction tenantReportCompleteBtn" data-report-id="${escAttr(n.reportId)}">Afronden</button>`);
  }else if(n.type==='Huurverhoging'&&n.objectId){
    actions.push(`<button class="notificationAction notificationPrimary rentEditBtn" data-id="${escAttr(n.objectId)}">Huurverhoging openen</button>`);
  }else if(n.objectId){
    actions.push(`<button class="notificationAction detailBtn" data-id="${escAttr(n.objectId)}">Bekijk object</button>`);
  }
  if(n.taskId) actions.push(`<button class="notificationAction taskEditBtn" data-task-id="${escAttr(n.taskId)}">Bekijk taak</button>`);
  return `<div class="alert ${n.sev} notificationCard notificationCard--${visual.kind}">
    <div class="notificationCardHeader"><span class="notificationIcon" aria-hidden="true">${visual.icon}</span><span class="notificationSource">${visual.label}</span><span class="typeTag">${escHtml(n.type)}</span></div>
    <strong class="notificationTitle">${escHtml(n.title)}</strong>
    <span class="notificationText">${escHtml(n.text)}</span>
    ${actions.length?`<div class="notificationActions">${actions.join('')}</div>`:''}
  </div>`;
}
function isVacant(r){ return String(r.status||'').toLowerCase().includes('leeg') || r.huurder==='-'; }
function contractBucket(r){ if(r.contract_opgezegd) return 'Opgezegd'; if(r.contract_onbepaalde) return 'Onbepaalde tijd'; if(r.aantal_verlengingen>0) return 'Verlengd'; const d=daysUntil(r.opzegdatum); if(d===null) return 'Geen opzegdatum'; if(d<0) return 'Opzegmoment verlopen'; if(d<=90) return '0-3 mnd'; if(d<=180) return '3-6 mnd'; if(d<=365) return '6-12 mnd'; return '>12 mnd'; }
function chartBar(label,value,total){ const width=total>0 ? Math.round((value/total)*100) : 0; return `<div class="chartRow"><div class="chartLabel"><span>${label}</span><strong>${value}</strong></div><div class="bar"><span style="width:${width}%"></span></div></div>`; }
function renderCharts(data){
  const rented=data.filter(r=>!isVacant(r)).length, vacant=data.length-rented;
  if(el('occupancyChart')) el('occupancyChart').innerHTML = chartBar('Verhuurd',rented,data.length)+chartBar('Leegstaand/geen huurder',vacant,data.length);
  const buckets=['Opgezegd','Opzegmoment verlopen','0-3 mnd','3-6 mnd','6-12 mnd','>12 mnd','Verlengd','Onbepaalde tijd','Geen opzegdatum'];
  if(el('contractChart')) el('contractChart').innerHTML = buckets.map(b=>chartBar(b,data.filter(r=>contractBucket(r)===b).length,data.length)).join('');
  const yieldValues=data.map(r=>Number(r.bruto_rendement)).filter(Number.isFinite);
  if(el('avgYield')) el('avgYield').textContent = yieldValues.length ? pct(yieldValues.reduce((a,b)=>a+b,0)/yieldValues.length) : '-';
}

const TENANT_REPORT_STATUSES=['Nieuw','In behandeling','Omgezet naar onderhoud','Afgerond','Afgewezen'];
const TENANT_REPORT_URGENCIES=['Normaal','Hoog','Spoed'];

function issuePortalForProperty(propertyId){
  return rawIssuePortals.find(portal=>portal.property_id===propertyId)||null;
}

async function ensureIssuePortal(propertyId){
  const existing=issuePortalForProperty(propertyId);
  if(existing) return existing;
  if(!issuePortalsReady) throw new Error('Voer eerst het meegeleverde Supabase SQL-bestand uit.');

  const result=await sb
    .from('property_issue_portals')
    .insert({property_id:propertyId})
    .select('*')
    .single();

  if(result.error){
    const retry=await sb
      .from('property_issue_portals')
      .select('*')
      .eq('property_id',propertyId)
      .maybeSingle();
    if(retry.error||!retry.data) throw result.error;
    rawIssuePortals.push(retry.data);
    return retry.data;
  }

  rawIssuePortals.push(result.data);
  return result.data;
}

function issuePortalUrl(portal){
  const url=configuredPublicIssuePageUrl();
  url.searchParams.set('token',portal.token);
  return url.toString();
}

function renderActiveIssueQr(portal,property){
  const url=issuePortalUrl(portal);
  el('issueQrUrl').value=url;
  el('issueQrStatus').textContent=portal.is_active?'Actief':'Uitgeschakeld';
  el('issueQrStatus').className=portal.is_active?'issueQrStatusActive':'issueQrStatusInactive';
  el('toggleIssueQrBtn').textContent=portal.is_active?'Uitschakelen':'Inschakelen';
  el('issueQrMessage').textContent='';
  el('issueQrMeta').textContent=`${property.object} · ${[property.straatnaam,property.huisnummer,property.postcode,property.stad].filter(Boolean).join(' ')}`;

  if(window.ObjectIssueQr){
    window.ObjectIssueQr.render(el('issueQrCanvas'),url,{size:300,margin:4});
  }else{
    el('issueQrCanvas').textContent='QR-codegenerator kon niet worden geladen.';
  }
}

async function openIssueQrModal(propertyId){
  activeIssueQrPropertyId=propertyId;
  const property=getPropertyById(propertyId);
  if(!property) return;

  el('issueQrModal').classList.remove('hidden');
  el('issueQrMeta').textContent=property.object;
  el('issueQrMessage').textContent='QR-code wordt geladen…';
  el('issueQrSetupWarning').classList.toggle('hidden',issuePortalsReady);

  if(!issuePortalsReady){
    el('issueQrContent').classList.add('hidden');
    el('issueQrUrl').value='';
    return;
  }

  try{
    configuredPublicIssuePageUrl();
    const portal=await ensureIssuePortal(propertyId);
    el('issueQrContent').classList.remove('hidden');
    renderActiveIssueQr(portal,property);
  }catch(error){
    console.error(error);
    el('issueQrContent').classList.add('hidden');
    el('issueQrUrl').value='';
    el('issueQrMessage').textContent='QR-code kon niet worden geladen: '+error.message;
  }
}

function closeIssueQrModal(){
  el('issueQrModal')?.classList.add('hidden');
  activeIssueQrPropertyId=null;
}

async function copyIssueQrLink(){
  const url=el('issueQrUrl').value;
  if(!url) return;
  try{
    await navigator.clipboard.writeText(url);
    el('issueQrMessage').textContent='Meldingslink gekopieerd.';
  }catch(error){
    el('issueQrUrl').select();
    document.execCommand('copy');
    el('issueQrMessage').textContent='Meldingslink gekopieerd.';
  }
}

function downloadIssueQr(){
  const url=el('issueQrUrl').value;
  const property=getPropertyById(activeIssueQrPropertyId);
  if(!url||!property||!window.ObjectIssueQr) return;

  const link=document.createElement('a');
  link.href=window.ObjectIssueQr.toDataUrl(url,{size:1200,margin:5});
  link.download=`qr-melding-${safeFileName(property.object||'object').replace(/\.[^.]+$/,'')}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  el('issueQrMessage').textContent='QR-code gedownload.';
}

function printIssueQr(){
  const url=el('issueQrUrl').value;
  const property=getPropertyById(activeIssueQrPropertyId);
  const canvas=el('issueQrCanvas')?.querySelector('canvas');
  if(!url||!property||!canvas) return;

  const popup=window.open('','_blank','noopener,noreferrer');
  if(!popup){
    el('issueQrMessage').textContent='Sta pop-ups toe om de QR-code te printen.';
    return;
  }

  const address=[property.straatnaam,property.huisnummer,property.postcode,property.stad].filter(Boolean).join(' ');
  popup.document.write(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>QR-code ${escHtml(property.object)}</title><style>
    body{font-family:Arial,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;color:#111827}
    .sheet{width:170mm;min-height:220mm;border:2px solid #111827;border-radius:8mm;padding:18mm;text-align:center;box-sizing:border-box}
    img{width:95mm;height:95mm;image-rendering:pixelated}
    h1{font-size:26pt;margin:0 0 8mm}.address{font-size:14pt;margin:0 0 10mm;color:#475569}
    .instruction{font-size:17pt;font-weight:700;line-height:1.4;margin:8mm 0}
    .small{font-size:10pt;color:#64748b;word-break:break-all}
    @media print{body{min-height:auto}.sheet{border-color:#111827}}
  </style></head><body><div class="sheet">
    <h1>${escHtml(branding.company_name||'Vastgoedbeheer')}</h1>
    <p class="address">${escHtml(property.object)}<br>${escHtml(address)}</p>
    <img src="${canvas.toDataURL('image/png')}" alt="QR-code">
    <p class="instruction">Scan deze QR-code om een storing, defect of onderhoudsmelding door te geven.</p>
    <p class="small">${escHtml(url)}</p>
  </div><script>window.onload=()=>window.print()<\/script></body></html>`);
  popup.document.close();
}

async function toggleIssueQr(){
  const portal=issuePortalForProperty(activeIssueQrPropertyId);
  const property=getPropertyById(activeIssueQrPropertyId);
  if(!portal||!property) return;

  const next=!portal.is_active;
  const result=await sb
    .from('property_issue_portals')
    .update({is_active:next,updated_at:new Date().toISOString()})
    .eq('property_id',portal.property_id)
    .select('*')
    .single();

  if(result.error){
    el('issueQrMessage').textContent='Status wijzigen mislukt: '+result.error.message;
    return;
  }

  const index=rawIssuePortals.findIndex(item=>item.property_id===portal.property_id);
  rawIssuePortals[index]=result.data;
  renderActiveIssueQr(result.data,property);
  el('issueQrMessage').textContent=next?'Meldingslink ingeschakeld.':'Meldingslink uitgeschakeld.';
}

async function regenerateIssueQr(){
  const portal=issuePortalForProperty(activeIssueQrPropertyId);
  const property=getPropertyById(activeIssueQrPropertyId);
  if(!portal||!property) return;
  if(!confirm('Een nieuwe QR-code maken? De oude QR-code en link werken daarna direct niet meer.')) return;

  const token=crypto.randomUUID();
  const result=await sb
    .from('property_issue_portals')
    .update({token,is_active:true,updated_at:new Date().toISOString()})
    .eq('property_id',portal.property_id)
    .select('*')
    .single();

  if(result.error){
    el('issueQrMessage').textContent='Nieuwe QR-code maken mislukt: '+result.error.message;
    return;
  }

  const index=rawIssuePortals.findIndex(item=>item.property_id===portal.property_id);
  rawIssuePortals[index]=result.data;
  renderActiveIssueQr(result.data,property);
  el('issueQrMessage').textContent='Nieuwe QR-code gemaakt. De oude code is ongeldig.';
}

function tenantReportProperty(report){
  return report.property_id?getPropertyById(report.property_id):null;
}

function tenantReportIsOpen(report){
  return !['Afgerond','Afgewezen','Omgezet naar onderhoud'].includes(report.status);
}

function tenantReportTone(report){
  if(report.status==='Afgerond'||report.status==='Omgezet naar onderhoud') return 'ok';
  if(report.status==='Afgewezen') return 'neutral';
  if(report.urgency==='Spoed') return 'danger';
  if(report.urgency==='Hoog') return 'warning';
  return report.status==='Nieuw'?'warning':'neutral';
}

async function openTenantReportPhoto(path){
  const cleanPath=clean(path);
  if(!cleanPath){
    alert('Bij deze melding is geen foto opgeslagen.');
    return;
  }

  const result=await sb
    .storage
    .from('tenant-issue-photos')
    .createSignedUrl(cleanPath,300);

  if(result.error||!result.data?.signedUrl){
    alert('De foto kon niet worden geopend: '+(result.error?.message||'onbekende fout'));
    return;
  }

  window.open(result.data.signedUrl,'_blank','noopener,noreferrer');
}

function tenantReportContact(report){
  return [
    report.reporter_name,
    report.phone,
    report.email,
    report.availability?`Bereikbaar: ${report.availability}`:''
  ].filter(Boolean).join(' · ')||'Geen contactgegevens opgegeven';
}


function ensureTenantReportUi(){
  if(!document.getElementById('tenantReportUiStyles')){
    const style=document.createElement('style');
    style.id='tenantReportUiStyles';
    style.textContent=`
      .notificationCard{display:flex;flex-direction:column;gap:8px;border-left:6px solid #64748b;background:#fff}
      .alert.notificationCard--tenant{border-left-color:#2563eb!important;background:linear-gradient(90deg,#eff6ff 0,#fff 44%)!important}
      .alert.notificationCard--rent{border-left-color:#ea580c!important;background:linear-gradient(90deg,#fff7ed 0,#fff 44%)!important}
      .alert.notificationCard--maintenance{border-left-color:#dc2626!important;background:linear-gradient(90deg,#fef2f2 0,#fff 44%)!important}
      .alert.notificationCard--task{border-left-color:#7c3aed!important;background:linear-gradient(90deg,#f5f3ff 0,#fff 44%)!important}
      .notificationCardHeader{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .notificationIcon{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:999px;background:#e2e8f0;color:#334155;font-weight:800}.notificationIcon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.notificationIcon .notificationIconDot{fill:currentColor;stroke:none}
      .notificationCard--tenant .notificationIcon{background:#dbeafe;color:#1d4ed8}
      .notificationCard--rent .notificationIcon{background:#ffedd5;color:#c2410c}
      .notificationSource{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#334155}
      .notificationTitle{font-size:15px}
      .notificationText{line-height:1.45}
      .notificationActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}
      .notificationAction{border:1px solid #94a3b8!important;background:#fff!important;color:#0f172a!important;-webkit-text-fill-color:currentColor!important;border-radius:8px;padding:8px 11px;font:inherit!important;font-size:13px!important;line-height:1.25!important;font-weight:700!important;cursor:pointer;min-height:38px;display:inline-flex!important;align-items:center;justify-content:center;appearance:none;-webkit-appearance:none;text-indent:0!important;opacity:1!important}
      .notificationAction:hover{background:#f8fafc}
      .notificationPrimary{background:#0f172a!important;color:#fff!important;border-color:#0f172a!important;-webkit-text-fill-color:#fff!important}
      .notificationCard--tenant .notificationPrimary{background:#2563eb!important;border-color:#2563eb!important}
      .notificationCard--rent .notificationPrimary{background:#ea580c!important;border-color:#ea580c!important}
      #rentIncreaseModal>div,#rentIncreaseModal .modalCard,#rentIncreaseModal .modalContent{border-top:8px solid #ea580c!important}
      #rentIncreaseModal h2,#rentIncreaseModal h3{color:#c2410c}
      .tenantReportModalLayer{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.58)}
      .tenantReportModalLayer.hidden{display:none}
      .tenantReportModalCard{width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.32);border-top:8px solid #2563eb}
      .tenantReportModalHeader{display:flex;justify-content:space-between;gap:16px;padding:20px 22px 16px;background:#eff6ff;border-bottom:1px solid #bfdbfe}
      .tenantReportModalHeader h2{margin:4px 0 0;font-size:22px}
      .tenantReportModalEyebrow{margin:0;color:#1d4ed8;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .tenantReportModalClose{border:0;background:#fff;width:36px;height:36px;border-radius:999px;font-size:22px;cursor:pointer}
      .tenantReportModalBody{padding:20px 22px;display:grid;gap:16px}
      .tenantReportSummary{display:flex;gap:8px;flex-wrap:wrap}
      .tenantReportChip{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:800;background:#e2e8f0;color:#334155}
      .tenantReportChip--urgent{background:#fee2e2;color:#b91c1c}.tenantReportChip--high{background:#ffedd5;color:#c2410c}.tenantReportChip--normal{background:#dcfce7;color:#166534}
      .tenantReportInfoGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .tenantReportInfo{padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}.tenantReportInfo span{display:block;font-size:12px;color:#64748b;margin-bottom:4px}.tenantReportInfo strong{display:block;word-break:break-word}
      .tenantReportDescriptionBox{white-space:pre-wrap;line-height:1.55;padding:14px;border-left:4px solid #2563eb;background:#f8fafc;border-radius:8px}
      .tenantReportModalActions{display:flex;gap:10px;flex-wrap:wrap;padding:16px 22px 22px;border-top:1px solid #e2e8f0}
      .tenantReportModalActions button{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:9px 12px;font:inherit;font-weight:800;cursor:pointer}
      .tenantReportModalActions .primary{background:#2563eb;color:#fff;border-color:#2563eb}.tenantReportModalActions .complete{background:#15803d;color:#fff;border-color:#15803d}
      .tenantReportRowActions{display:flex;gap:6px;flex-wrap:wrap}.tenantReportRowActions .miniLink{white-space:nowrap}
      .tenantReportDetailActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      @media(max-width:620px){.tenantReportInfoGrid{grid-template-columns:1fr}.tenantReportModalLayer{padding:8px}.tenantReportModalCard{max-height:96vh;border-radius:12px}}
    `;
    document.head.appendChild(style);
  }

  if(document.getElementById('tenantReportModal')) return;
  const modal=document.createElement('div');
  modal.id='tenantReportModal';
  modal.className='tenantReportModalLayer hidden';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-labelledby','tenantReportModalTitle');
  modal.innerHTML=`<section class="tenantReportModalCard">
    <header class="tenantReportModalHeader"><div><p class="tenantReportModalEyebrow">Huurdersmelding</p><h2 id="tenantReportModalTitle">Melding bekijken</h2></div><button type="button" class="tenantReportModalClose" aria-label="Sluiten"><span aria-hidden="true">${notificationIconSvg('close')}</span></button></header>
    <div id="tenantReportModalBody" class="tenantReportModalBody"></div>
    <footer id="tenantReportModalActions" class="tenantReportModalActions"></footer>
  </section>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',event=>{
    if(event.target===modal||event.target.closest('.tenantReportModalClose')) closeTenantReportModal();
  });
}

function tenantReportUrgencyClass(urgency){
  if(urgency==='Spoed') return 'tenantReportChip--urgent';
  if(urgency==='Hoog') return 'tenantReportChip--high';
  return 'tenantReportChip--normal';
}

function openTenantReportModal(reportId){
  ensureTenantReportUi();
  const report=rawTenantIssueReports.find(item=>item.id===reportId);
  if(!report){ alert('Deze huurdersmelding is niet meer beschikbaar.'); return; }
  activeTenantReportId=report.id;
  const property=tenantReportProperty(report);
  const received=report.submitted_at?new Date(report.submitted_at).toLocaleString('nl-NL'):'-';
  const reference=String(report.id).slice(0,8).toUpperCase();
  const body=el('tenantReportModalBody');
  body.innerHTML=`
    <div class="tenantReportSummary"><span class="tenantReportChip ${tenantReportUrgencyClass(report.urgency)}">${escHtml(report.urgency||'Normaal')}</span><span class="tenantReportChip">Status: ${escHtml(report.status||'Nieuw')}</span><span class="tenantReportChip">Ref. ${escHtml(reference)}</span></div>
    <div class="tenantReportInfoGrid">
      <div class="tenantReportInfo"><span>Object</span><strong>${escHtml(property?.object||'Object verwijderd')}</strong></div>
      <div class="tenantReportInfo"><span>Ontvangen</span><strong>${escHtml(received)}</strong></div>
      <div class="tenantReportInfo"><span>Melder</span><strong>${escHtml(report.reporter_name||'-')}</strong></div>
      <div class="tenantReportInfo"><span>Bereikbaar</span><strong>${escHtml(report.availability||'-')}</strong></div>
      <div class="tenantReportInfo"><span>Telefoon</span><strong>${escHtml(report.phone||'-')}</strong></div>
      <div class="tenantReportInfo"><span>E-mail</span><strong>${escHtml(report.email||'-')}</strong></div>
    </div>
    <div><strong>${escHtml(report.category||'Melding')}</strong><div class="tenantReportDescriptionBox">${escHtml(report.description||'-')}</div></div>
    ${report.photo_path?`<button type="button" class="notificationAction notificationPrimary tenantReportPhotoBtn" data-photo-path="${escAttr(report.photo_path)}">Foto bekijken</button>`:'<span class="subtle">Geen foto opgeslagen.</span>'}
  `;
  const actions=el('tenantReportModalActions');
  const buttons=[];
  if(property) buttons.push(`<button type="button" class="detailBtn" data-id="${escAttr(property.id)}">Object bekijken</button>`);
  if(tenantReportIsOpen(report)&&report.status!=='In behandeling') buttons.push(`<button type="button" class="primary tenantReportStartBtn" data-report-id="${escAttr(report.id)}">In behandeling nemen</button>`);
  if(tenantReportIsOpen(report)) buttons.push(`<button type="button" class="complete tenantReportCompleteBtn" data-report-id="${escAttr(report.id)}">Melding afronden</button>`);
  if(report.status!=='Omgezet naar onderhoud'&&property) buttons.push(`<button type="button" class="convertTenantReportBtn" data-report-id="${escAttr(report.id)}">Naar onderhoud</button>`);
  actions.innerHTML=buttons.join('')||'<span class="subtle">Deze melding is afgesloten.</span>';
  el('tenantReportModalTitle').textContent=report.category||'Huurdersmelding';
  el('tenantReportModal').classList.remove('hidden');
}

function closeTenantReportModal(){
  el('tenantReportModal')?.classList.add('hidden');
  activeTenantReportId=null;
}

async function setTenantReportStatus(reportId,status,{askConfirmation=false,closeAfter=false}={}){
  const report=rawTenantIssueReports.find(item=>item.id===reportId);
  if(!report) throw new Error('De huurdersmelding is niet meer beschikbaar.');
  if(askConfirmation&&status==='Afgerond'&&!confirm(`Melding "${report.category}" afronden?`)) return false;
  const result=await sb.from('tenant_issue_reports').update({status,updated_at:new Date().toISOString()}).eq('id',report.id).select('*').single();
  if(result.error) throw result.error;
  const index=rawTenantIssueReports.findIndex(item=>item.id===report.id);
  rawTenantIssueReports[index]=result.data;
  if(closeAfter) closeTenantReportModal();
  render();
  if(selectedPropertyId) renderDetail(selectedPropertyId);
  if(activeTenantReportId===report.id&&!closeAfter) openTenantReportModal(report.id);
  return true;
}

async function completeTenantReport(reportId){
  try{ await setTenantReportStatus(reportId,'Afgerond',{askConfirmation:true,closeAfter:true}); }
  catch(error){ console.error(error); alert('Melding afronden mislukt: '+error.message); }
}

async function startTenantReport(reportId){
  try{ await setTenantReportStatus(reportId,'In behandeling'); }
  catch(error){ console.error(error); alert('Status bijwerken mislukt: '+error.message); }
}

function filteredTenantReports(){
  return rawTenantIssueReports
    .filter(report=>{
      if(query){
        const property=tenantReportProperty(report);
        const haystack=[
          report.category,report.description,report.urgency,report.status,
          report.reporter_name,report.email,report.phone,report.availability,
          property?.object,property?.straatnaam,property?.huisnummer,property?.stad
        ].filter(Boolean).join(' ').toLowerCase();
        if(!haystack.includes(query.toLowerCase())) return false;
      }
      if(tenantReportStatusFilter==='open'&&!tenantReportIsOpen(report)) return false;
      if(tenantReportStatusFilter&&tenantReportStatusFilter!=='open'&&report.status!==tenantReportStatusFilter) return false;
      if(tenantReportUrgencyFilter&&report.urgency!==tenantReportUrgencyFilter) return false;
      if(tenantReportObjectFilter&&report.property_id!==tenantReportObjectFilter) return false;
      return true;
    })
    .sort((a,b)=>String(b.submitted_at||'').localeCompare(String(a.submitted_at||'')));
}

function renderTenantIssueReports(){
  const target=el('tenantReportOverview');
  if(!target) return;

  const open=rawTenantIssueReports.filter(tenantReportIsOpen);
  const newCount=rawTenantIssueReports.filter(report=>report.status==='Nieuw').length;
  const urgent=open.filter(report=>report.urgency==='Spoed').length;
  const converted=rawTenantIssueReports.filter(report=>report.status==='Omgezet naar onderhoud').length;
  const completed=rawTenantIssueReports.filter(report=>report.status==='Afgerond').length;
  if(el('tenantReportTabCount')) el('tenantReportTabCount').textContent=newCount;

  if(!tenantIssueReportsReady){
    target.innerHTML='<div class="importNotice warning"><strong>Eenmalige Supabase-instelling nodig</strong><span>Voer eerst het meegeleverde SQL-bestand uit om QR-codes en huurdersmeldingen te gebruiken.</span></div>';
    return;
  }

  const objectOptions=vastgoedData
    .slice()
    .sort(compareObjectAddress)
    .map(property=>`<option value="${escAttr(property.id)}" ${tenantReportObjectFilter===property.id?'selected':''}>${escHtml(property.object)}</option>`)
    .join('');

  const rows=filteredTenantReports();
  target.innerHTML=`
    <div class="cards tenantReportCards">
      <div class="card"><span>Nieuw</span><strong>${newCount}</strong></div>
      <div class="card"><span>Openstaand</span><strong>${open.length}</strong></div>
      <div class="card"><span>Spoed</span><strong>${urgent}</strong></div>
      <div class="card"><span>Omgezet naar onderhoud</span><strong>${converted}</strong></div>
      <div class="card"><span>Afgerond</span><strong>${completed}</strong></div>
    </div>

    <div class="maintenanceFilters tenantReportFilters">
      <label>Status
        <select id="tenantReportStatusFilter">
          <option value="open" ${tenantReportStatusFilter==='open'?'selected':''}>Alle openstaande meldingen</option>
          <option value="" ${tenantReportStatusFilter===''?'selected':''}>Alle statussen</option>
          ${TENANT_REPORT_STATUSES.map(status=>`<option value="${escAttr(status)}" ${tenantReportStatusFilter===status?'selected':''}>${escHtml(status)}</option>`).join('')}
        </select>
      </label>
      <label>Urgentie
        <select id="tenantReportUrgencyFilter">
          <option value="">Alle urgenties</option>
          ${TENANT_REPORT_URGENCIES.map(urgency=>`<option value="${escAttr(urgency)}" ${tenantReportUrgencyFilter===urgency?'selected':''}>${escHtml(urgency)}</option>`).join('')}
        </select>
      </label>
      <label>Object
        <select id="tenantReportObjectFilter">
          <option value="">Alle objecten</option>
          ${objectOptions}
        </select>
      </label>
    </div>

    <div class="panel tenantReportTablePanel">
      <div class="tenantReportTableWrap">
        <table id="tenantReportTable">
          <tr><th>Ontvangen</th><th>Object</th><th>Melding</th><th>Foto</th><th>Melder</th><th>Urgentie</th><th>Status</th><th>Acties</th></tr>
          ${rows.map(report=>{
            const property=tenantReportProperty(report);
            const received=report.submitted_at?new Date(report.submitted_at).toLocaleString('nl-NL'):'-';
            return `<tr>
              <td>${escHtml(received)}<span class="subtle">Ref. ${escHtml(String(report.id).slice(0,8).toUpperCase())}</span></td>
              <td>${property?`<button class="miniLink detailBtn" data-id="${property.id}">${escHtml(property.object)}</button><span class="subtle">${escHtml([property.straatnaam,property.huisnummer,property.stad].filter(Boolean).join(' '))}</span>`:'<span class="subtle">Object verwijderd</span>'}</td>
              <td><strong>${escHtml(report.category)}</strong><span class="tenantReportDescription">${escHtml(report.description)}</span></td>
              <td>${report.photo_path?`<button class="miniLink tenantReportPhotoBtn" data-photo-path="${escAttr(report.photo_path)}">Foto bekijken</button>`:'<span class="subtle">Geen foto</span>'}</td>
              <td><span class="tenantReportContact">${escHtml(tenantReportContact(report))}</span></td>
              <td>${statusBadge([report.urgency,report.urgency==='Spoed'?'danger':report.urgency==='Hoog'?'warning':'ok'])}</td>
              <td>
                <select class="tenantReportQuickStatus" data-report-id="${report.id}">
                  ${TENANT_REPORT_STATUSES.map(status=>`<option ${report.status===status?'selected':''}>${escHtml(status)}</option>`).join('')}
                </select>
              </td>
              <td>
                <div class="tenantReportRowActions">
                  <button class="miniLink tenantReportOpenBtn" data-report-id="${report.id}">Bekijken</button>
                  ${tenantReportIsOpen(report)?`<button class="miniLink tenantReportCompleteBtn" data-report-id="${report.id}">Afronden</button>`:''}
                  ${report.status!=='Omgezet naar onderhoud'&&property?`<button class="miniLink convertTenantReportBtn" data-report-id="${report.id}">Naar onderhoud</button>`:''}
                  ${report.converted_maintenance_id?`<span class="subtle">Onderhoud gekoppeld</span>`:''}
                </div>
              </td>
            </tr>`;
          }).join('')||'<tr><td colspan="8">Geen huurdersmeldingen binnen dit filter.</td></tr>'}
        </table>
      </div>
    </div>`;
}

async function updateTenantReportStatus(select){
  const report=rawTenantIssueReports.find(item=>item.id===select.dataset.reportId);
  if(!report) return;
  const previous=report.status;
  select.disabled=true;
  try{
    const changed=await setTenantReportStatus(report.id,select.value,{askConfirmation:select.value==='Afgerond'});
    if(changed===false) select.value=previous;
  }catch(error){
    select.value=previous;
    alert('Status bijwerken mislukt: '+error.message);
  }finally{
    select.disabled=false;
  }
}

async function convertTenantReportToMaintenance(reportId){
  const report=rawTenantIssueReports.find(item=>item.id===reportId);
  const property=report?tenantReportProperty(report):null;
  if(!report||!property) return;
  if(!confirm(`Deze melding omzetten naar een onderhoudsregel voor ${property.object}?`)) return;

  const contact=tenantReportContact(report);
  const description=[
    report.description,
    '',
    `Huurdersmelding ontvangen: ${report.submitted_at?new Date(report.submitted_at).toLocaleString('nl-NL'):'-'}`,
    `Melder: ${contact}`,
    `Referentie: ${String(report.id).slice(0,8).toUpperCase()}`,
    report.photo_path?'Foto beschikbaar in de oorspronkelijke huurdersmelding.':''
  ].filter(Boolean).join('\n');

  const maintenanceResult=await sb
    .from('maintenance')
    .insert({
      property_id:property.id,
      title:`Huurdersmelding: ${report.category}`,
      description,
      planned_date:null,
      cost:null,
      status:'Open',
      priority:report.urgency==='Spoed'?'Urgent':report.urgency==='Hoog'?'Hoog':'Normaal'
    })
    .select('*')
    .single();

  if(maintenanceResult.error){
    alert('Onderhoudsregel maken mislukt: '+maintenanceResult.error.message);
    return;
  }

  const reportResult=await sb
    .from('tenant_issue_reports')
    .update({
      status:'Omgezet naar onderhoud',
      converted_maintenance_id:maintenanceResult.data.id,
      updated_at:new Date().toISOString()
    })
    .eq('id',report.id);

  if(reportResult.error){
    alert('De onderhoudsregel is gemaakt, maar de melding kon niet worden bijgewerkt: '+reportResult.error.message);
  }

  await loadData();
  setMaintenanceTab('maintenance');
}

function tenantReportsForPropertyHtml(propertyId){
  const reports=rawTenantIssueReports
    .filter(report=>report.property_id===propertyId)
    .sort((a,b)=>String(b.submitted_at||'').localeCompare(String(a.submitted_at||'')));

  const items=reports.slice(0,8).map(report=>`
    <div class="tenantReportDetailItem">
      <div>
        <strong>${escHtml(report.category)}</strong>
        <span>${statusBadge([report.status,tenantReportTone(report)])} ${report.submitted_at?new Date(report.submitted_at).toLocaleDateString('nl-NL'):'-'}</span>
        <small>${escHtml(report.description)}</small>
        <div class="tenantReportDetailActions">
          <button class="miniLink tenantReportOpenBtn" data-report-id="${escAttr(report.id)}">Bekijken</button>
          ${report.photo_path?`<button class="miniLink tenantReportPhotoBtn" data-photo-path="${escAttr(report.photo_path)}">Foto bekijken</button>`:''}
          ${tenantReportIsOpen(report)?`<button class="miniLink tenantReportCompleteBtn" data-report-id="${escAttr(report.id)}">Afronden</button>`:''}
        </div>
      </div>
    </div>
  `).join('');

  return `<div class="taskDetailHeader">
    <span>${reports.length?`${reports.length} ${reports.length===1?'melding':'meldingen'} ontvangen`:'Nog geen huurdersmeldingen ontvangen.'}</span>
    <button class="smallBtn issueQrBtn" data-id="${propertyId}">QR-code melding</button>
  </div>
  <div class="tenantReportDetailList">${items||'<p class="empty">Nog geen meldingen voor dit object.</p>'}</div>`;
}

const MAINTENANCE_STATUSES=['Te plannen','Gepland','Afgerond'];
function maintenanceStatusLabel(status){
  const st=norm(status);
  if(st.includes('afgerond') || st.includes('gereed')) return 'Afgerond';
  if(st.includes('gepland') || st.includes('planning')) return 'Gepland';
  return 'Te plannen';
}
function maintStatusClass(status, plannedDate){
  const label=maintenanceStatusLabel(status);
  const days=daysUntil(plannedDate);
  if(label==='Afgerond') return 'ok';
  if(days!==null && days<0) return 'danger';
  return 'warning';
}
function maintenanceSourceRows(data){
  const rows=[];
  const linkedHistoryIds=new Set();
  data.forEach(r=>{
    (r.maintenance_history||[]).forEach(m=>{
      const isHistory = rawMaintenanceHistory.some(h=>h.id===m.id);
      if(isHistory && m.id) linkedHistoryIds.add(m.id);
      rows.push({
        key:`${isHistory?'history':'maintenance'}:${m.id||r.id}`,
        source:isHistory?'history':'maintenance',
        id:m.id||'',
        objectId:r.id,
        object:r.object,
        address:[r.straatnaam,r.huisnummer,r.postcode].filter(Boolean).join(' '),
        type:m.maintenance_type||m.title||'-',
        build_year:m.build_year||'',
        done_date:m.completed_date||m.done_date||'',
        planned_date:m.planned_date||'',
        supplier:m.contractor||m.supplier||'-',
        cost:Number(m.cost||0),
        status:maintenanceStatusLabel(m.status),
        description:m.description||'',
        is_service_cost:Boolean(m.is_service_cost),
        service_cost_category:m.service_cost_category||'',
        settlement_year:m.settlement_year||null,
        allocation_percentage:m.allocation_percentage??100,
        service_cost_approved:Boolean(m.service_cost_approved),
        raw:m
      });
    });
  });
  rawMaintenanceHistory.forEach(m=>{
    if(m.id && linkedHistoryIds.has(m.id)) return;
    rows.push({
      key:`history:${m.id}`,
      source:'history',
      id:m.id||'',
      objectId:m.property_id||'',
      object:m.property_name||[m.property_address,m.house_number].filter(Boolean).join(' ')||'Onbekend object',
      address:[m.property_address,m.house_number].filter(Boolean).join(' '),
      type:m.maintenance_type||'-',
      build_year:m.build_year||'',
      done_date:m.done_date||'',
      planned_date:m.planned_date||'',
      supplier:m.contractor||m.supplier||'-',
      cost:Number(m.cost||0),
      status:maintenanceStatusLabel(m.status),
      description:m.description||'',
      is_service_cost:Boolean(m.is_service_cost),
      service_cost_category:m.service_cost_category||'',
      settlement_year:m.settlement_year||null,
      allocation_percentage:m.allocation_percentage??100,
      service_cost_approved:Boolean(m.service_cost_approved),
      raw:m
    });
  });
  return rows;
}
function getPropertyById(id){ return vastgoedData.find(r=>r.id===id); }
function propertyOptions(selectedId=''){
  return `<option value="">Niet gekoppeld</option>` + [...vastgoedData]
    .sort(compareObjectAddress)
    .map(r=>`<option value="${r.id}" ${r.id===selectedId?'selected':''}>${r.object} ${r.straatnaam?`- ${r.straatnaam} ${r.huisnummer}`:''}</option>`)
    .join('');
}
function compareMaintenanceType(a,b){
  const aType=typeof a==='string' ? a : (a?.type || a?.maintenance_type || a?.title || '');
  const bType=typeof b==='string' ? b : (b?.type || b?.maintenance_type || b?.title || '');
  return String(aType).localeCompare(String(bType),'nl',{sensitivity:'base',numeric:true});
}
function maintenanceStatusSelect(row){
  return `<select class="maintenanceQuickStatus" data-key="${escAttr(row.key)}" aria-label="Status van ${escAttr(row.type||'onderhoud')} aanpassen">
    ${MAINTENANCE_STATUSES.map(status=>`<option value="${escAttr(status)}" ${maintenanceStatusLabel(row.status)===status?'selected':''}>${escHtml(status)}</option>`).join('')}
  </select>`;
}
async function updateMaintenanceStatusFromOverview(select){
  const key=select?.dataset?.key;
  const row=findMaintenanceRowByKey(key);
  if(!row) return;

  const previous=maintenanceStatusLabel(row.status);
  const next=maintenanceStatusLabel(select.value);
  if(previous===next) return;

  select.disabled=true;
  select.classList.add('saving');

  let res;
  if(row.source==='maintenance'){
    const payload={status:next};
    if(next==='Afgerond'&&!row.done_date) payload.completed_date=new Date().toISOString().slice(0,10);
    res=await sb.from('maintenance').update(payload).eq('id',row.id);
  }else{
    const payload={status:next};
    if(next==='Afgerond'&&!row.done_date) payload.done_date=new Date().toISOString().slice(0,10);
    res=await sb.from('property_maintenance_history').update(payload).eq('id',row.id);
  }

  if(res.error){
    select.value=previous;
    select.disabled=false;
    select.classList.remove('saving');
    alert(`Status kon niet worden opgeslagen: ${res.error.message}`);
    return;
  }

  await loadData();
}

function maintenanceRowTable(rows){
  const sortedRows=[...rows].sort((a,b)=>{
    const typeCompare=compareMaintenanceType(a,b);
    if(typeCompare!==0) return typeCompare;
    return String(a.planned_date||a.done_date||'9999').localeCompare(String(b.planned_date||b.done_date||'9999'));
  });
  return `<table class="maintenanceObjectTable"><tr><th>Type</th><th>Bouwjaar</th><th>Gedaan</th><th>Planning</th><th>Partij</th><th>Kosten</th><th>Status</th><th>Acties</th></tr>`+
    sortedRows.map(r=>`<tr><td>${r.type}</td><td>${r.build_year||'-'}</td><td>${maintenanceDateFmt(r.done_date)}</td><td>${maintenanceDateFmt(r.planned_date)}</td><td>${r.supplier||'-'}</td><td>${euro(r.cost||0)}</td><td>${maintenanceStatusSelect(r)}</td><td><button class="miniLink editMaintBtn" data-key="${escAttr(r.key)}">Bewerk</button>${r.objectId?` <button class="miniLink detailBtn" data-id="${r.objectId}">Open object</button>`:''}</td></tr>`).join('') + `</table>`;
}
function renderMaintenanceOverview(data){
  const allRows=maintenanceSourceRows(data);
  const rowsAll=allRows.filter(r=>{
    const hay=JSON.stringify(r).toLowerCase();
    if(query && !hay.includes(query.toLowerCase())) return false;
    if(maintenanceObjectFilter){
      const objectKey = r.objectId || r.object;
      if(objectKey !== maintenanceObjectFilter) return false;
    }
    if(maintenanceTypeFilter && r.type!==maintenanceTypeFilter) return false;
    if(maintenanceStatusFilter && maintenanceStatusLabel(r.status)!==maintenanceStatusFilter) return false;
    return true;
  }).sort((a,b)=>{
    const addressCompare=compareObjectAddress(
      {straatnaam:a.raw?.property_address||a.address||a.object, huisnummer:a.raw?.house_number||''},
      {straatnaam:b.raw?.property_address||b.address||b.object, huisnummer:b.raw?.house_number||''}
    );
    if(addressCompare!==0) return addressCompare;

    const typeCompare=compareMaintenanceType(a,b);
    if(typeCompare!==0) return typeCompare;

    return String(a.planned_date||a.done_date||'9999').localeCompare(
      String(b.planned_date||b.done_date||'9999')
    );
  });
  const overdue=rowsAll.filter(r=>{const d=daysUntil(r.planned_date); return d!==null && d<0 && maintStatusClass(r.status,r.planned_date)!=='ok';}).length;
  const upcoming90=rowsAll.filter(r=>{const d=daysUntil(r.planned_date); return d!==null && d>=0 && d<=90;}).length;
  const open=rowsAll.filter(r=>!['afgerond','gereed'].some(x=>norm(r.status).includes(x))).length;
  const totalCost=rowsAll.reduce((a,b)=>a+Number(b.cost||0),0);
  const objectOptionsMap={};
  allRows.forEach(r=>{ const key=r.objectId || r.object; if(key) objectOptionsMap[key]=r.object; });
  const objects=Object.entries(objectOptionsMap).sort((a,b)=>{
    const aProperty=vastgoedData.find(r=>(r.id||r.object)===a[0] || r.object===a[1]);
    const bProperty=vastgoedData.find(r=>(r.id||r.object)===b[0] || r.object===b[1]);

    if(aProperty && bProperty) return compareObjectAddress(aProperty,bProperty);
    return String(a[1]).localeCompare(String(b[1]),'nl',{sensitivity:'base',numeric:true});
  });
  const types=[...new Set(allRows.map(r=>r.type).filter(Boolean))].sort(compareMaintenanceType);
  const statuses=MAINTENANCE_STATUSES;
  const filterHtml=`<div class="maintenanceFilters maintenanceFiltersWide"><label>Object<select id="maintenanceObjectFilter"><option value="">Alle objecten</option>${objects.map(([key,name])=>`<option value="${escAttr(key)}" ${maintenanceObjectFilter===key?'selected':''}>${name}</option>`).join('')}</select></label><label>Type<select id="maintenanceTypeFilter"><option value="">Alle types</option>${types.map(t=>`<option ${maintenanceTypeFilter===t?'selected':''}>${t}</option>`).join('')}</select></label><label>Status<select id="maintenanceStatusFilter"><option value="">Alle statussen</option>${statuses.map(st=>`<option ${maintenanceStatusFilter===st?'selected':''}>${st}</option>`).join('')}</select></label></div>`;
  const summaryHtml=`<div class="cards maintenanceCards"><div class="card"><span>Totaal regels</span><strong>${rowsAll.length}</strong></div><div class="card"><span>Komende 90 dagen</span><strong>${upcoming90}</strong></div><div class="card"><span>Verlopen</span><strong>${overdue}</strong></div><div class="card"><span>Niet afgerond</span><strong>${open}</strong></div><div class="card"><span>Totale kosten</span><strong>${euro(totalCost)}</strong></div></div>`;
  const grouped={};
  rowsAll.forEach(r=>{ const key=r.objectId || r.object; (grouped[key] ||= {objectId:r.objectId, object:r.object, address:r.address, rows:[]}).rows.push(r); });
  const groupHtml=Object.values(grouped).map(g=>{
    const next=g.rows.map(r=>r.planned_date).filter(Boolean).sort()[0];
    const costs=g.rows.reduce((a,b)=>a+Number(b.cost||0),0);
    return `<article class="maintenanceObjectCard"><div class="maintenanceObjectHeader"><div><h3>${g.object}</h3><p class="meta">${g.address||'Geen adres bekend'} • ${g.rows.length} onderhoudsregels • eerstvolgende: ${maintenanceDateFmt(next)}</p></div><div class="detailActions">${g.objectId?`<button class="secondaryBtn detailBtn" data-id="${g.objectId}">Open object</button>`:''}<button class="smallBtn newMaintBtn" data-id="${g.objectId||''}" data-name="${escAttr(g.object)}">+ Regel</button></div></div><div class="row"><span>Totale onderhoudskosten</span><strong>${euro(costs)}</strong></div>${maintenanceRowTable(g.rows)}</article>`;
  }).join('');
  const overviewTarget = el('maintenanceOverview') || el('maintenanceTable') || document.querySelector('#onderhoud .panel') || document.getElementById('onderhoud');
  if (!overviewTarget) return;
  overviewTarget.innerHTML=summaryHtml+filterHtml+(groupHtml || '<div class="panel"><p>Geen onderhoudshistorie gevonden.</p></div>');
}
function openMaintenanceModal(mode, row=null, objectId=''){
  el('maintenanceEditMessage').textContent='';
  el('maintenanceEditTitle').textContent = mode==='new' ? 'Onderhoudsregel toevoegen' : 'Onderhoudsregel bewerken';
  el('mEditId').value = row?.id || '';
  el('mEditSource').value = mode==='new' ? 'new' : (row?.source || 'history');
  el('mEditPropertyId').innerHTML = propertyOptions(row?.objectId || objectId || '');
  el('mEditType').value = row?.type && row.type!=='-' ? row.type : 'Airco';
  el('mEditBuildYear').value = row?.build_year || '';
  el('mEditDoneDate').value = row?.done_date || '';
  el('mEditPlannedDate').value = row?.planned_date || '';
  el('mEditSupplier').value = row?.supplier && row.supplier!=='-' ? row.supplier : '';
  el('mEditStatus').value = maintenanceStatusLabel(row?.status);
  el('mEditCost').value = row?.cost || '';
  el('mEditIsServiceCost').value = row?.is_service_cost ? 'Ja' : 'Nee';
  el('mEditServiceCostCategory').value = row?.service_cost_category || '';
  el('mEditSettlementYear').value = row?.settlement_year || '';
  el('mEditAllocationPercentage').value = row?.allocation_percentage ?? 100;
  el('mEditServiceCostApproved').value = row?.service_cost_approved ? 'Ja' : 'Nee';
  el('mEditDescription').value = row?.description || '';
  el('deleteMaintenanceRowBtn').classList.toggle('hidden', mode==='new');
  el('maintenanceEditModal').classList.remove('hidden');
}
function closeMaintenanceModal(){ el('maintenanceEditModal').classList.add('hidden'); }
function findMaintenanceRowByKey(key){ return maintenanceSourceRows(vastgoedData).find(r=>r.key===key); }
function selectedMaintenancePropertyPayload(){
  const id=el('mEditPropertyId').value;
  const r=getPropertyById(id);
  return {property_id:id||null, property_name:r?.object||null, property_address:r?.straatnaam||null, house_number:r?.huisnummer||null, tenant_name:r?.huurder||null};
}
async function saveMaintenanceEdit(e){
  e.preventDefault();
  el('maintenanceEditMessage').textContent='Bezig met opslaan...';
  const source=el('mEditSource').value;
  const id=el('mEditId').value;
  const base={
    ...selectedMaintenancePropertyPayload(),
    maintenance_type:el('mEditType').value,
    build_year:numOrNull(el('mEditBuildYear').value),
    done_date:el('mEditDoneDate').value||null,
    planned_date:el('mEditPlannedDate').value||null,
    supplier:el('mEditSupplier').value||null,
    status:el('mEditStatus').value||'Te plannen',
    cost:numOrNull(el('mEditCost').value),
    is_service_cost:el('mEditIsServiceCost').value==='Ja',
    service_cost_category:el('mEditServiceCostCategory').value||null,
    settlement_year:numOrNull(el('mEditSettlementYear').value),
    allocation_percentage:numOrNull(el('mEditAllocationPercentage').value)??100,
    service_cost_approved:el('mEditServiceCostApproved').value==='Ja',
    description:el('mEditDescription').value||null
  };
  let res;
  if(source==='maintenance'){
    const pId=el('mEditPropertyId').value || null;
    const payload={property_id:pId,title:base.maintenance_type,build_year:base.build_year,completed_date:base.done_date,planned_date:base.planned_date,contractor:base.supplier,cost:base.cost,status:base.status,description:base.description,priority:'Normaal',is_service_cost:base.is_service_cost,service_cost_category:base.service_cost_category,settlement_year:base.settlement_year,allocation_percentage:base.allocation_percentage,service_cost_approved:base.service_cost_approved};
    res=await sb.from('maintenance').update(payload).eq('id',id);
  } else if(source==='new') {
    res=await sb.from('property_maintenance_history').insert(base);
  } else {
    res=await sb.from('property_maintenance_history').update(base).eq('id',id);
  }
  if(res.error){ el('maintenanceEditMessage').textContent=res.error.message; return; }
  closeMaintenanceModal(); await loadData();
}
async function deleteMaintenanceEdit(){
  const source=el('mEditSource').value;
  const id=el('mEditId').value;
  if(!id || !confirm('Onderhoudsregel verwijderen?')) return;
  const res = source==='maintenance' ? await sb.from('maintenance').delete().eq('id',id) : await sb.from('property_maintenance_history').delete().eq('id',id);
  if(res.error){ el('maintenanceEditMessage').textContent=res.error.message; return; }
  closeMaintenanceModal(); await loadData();
}


function parseDelimitedCsv(text, delimiter){
  const rows=[];
  let row=[], cell='', inQuotes=false;
  const input=String(text||'').replace(/^\uFEFF/, '');
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(ch==='"'){
      if(inQuotes && input[i+1]==='"'){ cell+='"'; i++; }
      else inQuotes=!inQuotes;
    } else if(ch===delimiter && !inQuotes){
      row.push(cell); cell='';
    } else if((ch==='\n' || ch==='\r') && !inQuotes){
      if(ch==='\r' && input[i+1]==='\n') i++;
      row.push(cell); cell='';
      if(row.some(v=>String(v).trim()!=='')) rows.push(row);
      row=[];
    } else {
      cell+=ch;
    }
  }
  row.push(cell);
  if(row.some(v=>String(v).trim()!=='')) rows.push(row);
  return rows;
}

function countDelimiterOutsideQuotes(line, delimiter){
  let count=0, inQuotes=false;
  for(let i=0;i<line.length;i++){
    if(line[i]==='"'){
      if(inQuotes && line[i+1]==='"') i++;
      else inQuotes=!inQuotes;
    } else if(line[i]===delimiter && !inQuotes) count++;
  }
  return count;
}

function parseCsvAuto(text){
  const firstLine=String(text||'').replace(/^\uFEFF/, '').split(/\r?\n/).find(line=>line.trim()) || '';
  const semicolons=countDelimiterOutsideQuotes(firstLine,';');
  const commas=countDelimiterOutsideQuotes(firstLine,',');
  return parseDelimitedCsv(text, semicolons>commas ? ';' : ',');
}

function csvHeaderKey(value){
  return clean(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/&/g,' en ')
    .replace(/[_/\\.-]+/g,' ')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

const OBJECT_CSV_ALIASES={
  object_id:['object id','object-id','object_id','id object'],
  name:['object','objectnaam','naam object','pand','pandnaam','name'],
  address:['straatnaam','straat','adres','address'],
  house_number:['huisnummer','huis nr','nummer','nr','house number','house_number'],
  postal_code:['postcode','post code','postal code','zip code','zipcode','postal_code'],
  city:['stad','plaats','woonplaats','city'],
  billing_name:['factuurnaam','naam factuurontvanger','naam ontvanger','billing name','billing_name'],
  billing_address:['factuuradres','correspondentieadres','billing address','billing_address'],
  billing_house_number:['factuur huisnummer','factuurhuisnummer','billing house number','billing_house_number'],
  billing_postal_code:['factuur postcode','factuurpostcode','billing postal code','billing_postal_code'],
  billing_city:['factuur plaats','factuurstad','correspondentieplaats','billing city','billing_city'],
  property_type:['type pand','pandtype','objecttype','property type','property_type'],
  status:['objectstatus','status pand','property status','status'],
  monthly_rent:['huurprijs excl p m','huurprijs p m','huur per maand','huur pm','maandhuur','monthly rent','monthly_rent'],
  yearly_rent:['huurprijs excl p j','huurprijs p j','huur per jaar','huur pj','jaarhuur','yearly rent','yearly_rent'],
  service_costs:['servicekosten excl','servicekosten','service costs','service_costs'],
  energy_costs:['energiekosten','energie kosten','energy costs','energy_costs'],
  deposit:['waarborgsom','borg','deposit'],
  corporate_guarantee:['concerngarantie','concern garantie','corporate guarantee','corporate_guarantee'],
  bank_guarantee:['bankgarantie','bank garantie','bank guarantee','bank_guarantee'],
  energy_label:['energielabel','energy label','energy_label'],
  energy_label_required:['energielabel verplicht','label verplicht','energy label required','energy_label_required'],
  energy_label_valid_until:['energielabel geldig tot','energy label valid until','energy_label_valid_until'],
  rent_increase_month:['maand huurverhogingen','maand huurverhoging','huurverhogingsmaand','rent increase month','rent_increase_month'],
  scope_valid_until:['scope 10 geldig tot','scope10 geldig tot','scope 10 geldig volgende','scope inspectie geldig tot','scope-inspectie geldig tot','scope geldig tot','scope_valid_until'],
  scope12_valid_until:['scope 12 geldig tot','scope12 geldig tot','scope 12 geldig volgende','scope12_valid_until'],
  purchase_value:['aankoopwaarde','purchase value','purchase_value'],
  woz_value:['woz waarde','woz-waarde','woz','woz_value'],
  mortgage_value:['hypotheekschuld','hypotheek','mortgage value','mortgage_value'],
  mortgage_interest:['hypotheekrente','hypotheekrente percentage','mortgage interest','mortgage_interest'],
  purchase_date:['aankoopdatum','purchase date','purchase_date'],
  tenant_name:['huurder','naam huurder','huurder naam','tenant','tenant name'],
  tenant_email:['e mail','email','e-mail','email huurder','tenant email'],
  tenant_phone:['telefoonnummer','telefoon','mobiel','phone','tenant phone'],
  contract_start_date:['startdatum contract','contract startdatum','startdatum','contract start date','start_date'],
  contract_end_date:['einddatum contract','contract einddatum','einddatum','contract end date','end_date'],
  contract_notice_date:['opzegdatum','uiterste opzegdatum','notice date','notice_date'],
  notice_period_months:['opzegtermijn','opzegtermijn maanden','notice period','notice period months','notice_period_months'],
  renewal_period_years:['verlenging jaren','verlengtermijn','verlengtermijn jaren','na einde contract','renewal period','renewal period years','renewal_period_years'],
  contract_term:['contractduur','looptijd contract','term'],
  contract_status:['contractstatus','status contract','contract status']
};

const OBJECT_CSV_ALIAS_LOOKUP=(()=>{
  const result={};
  Object.entries(OBJECT_CSV_ALIASES).forEach(([field,aliases])=>aliases.forEach(alias=>{result[csvHeaderKey(alias)]=field;}));
  return result;
})();

function mapObjectCsvHeaders(headers){
  const map={};
  headers.forEach((header,index)=>{
    const field=OBJECT_CSV_ALIAS_LOOKUP[csvHeaderKey(header)];
    if(field && map[field]===undefined) map[field]=index;
  });
  return map;
}

function csvCell(row,map,field){
  const index=map[field];
  return index===undefined ? '' : clean(row[index]);
}

function normalizedImportMarker(value){
  return clean(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[._/\\-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function isMissingImportValue(value){
  const marker=normalizedImportMarker(value);
  if(!marker) return true;
  return [
    'nvt','n v t','niet van toepassing','geen','geen waarde','niet aanwezig',
    'onbekend','null','nihil','leeg','geen gegevens','geen data'
  ].includes(marker);
}

function normalizeDepositInput(value){
  return clean(value)
    .normalize('NFKC')
    .replace(/[\u00A0\u202F]/g,' ')
    .replace(/[‐‑‒–—―−]/g,'-')
    .trim();
}

function isNoDepositValue(value){
  const raw=normalizeDepositInput(value).toLowerCase();
  const marker=normalizedImportMarker(raw);

  if(!raw || isMissingImportValue(raw)) return true;

  // Alleen een streepje, eventueel met valuta of leestekens, betekent geen waarborgsom.
  const withoutCurrency=raw.replace(/[€eur\s'"`]/gi,'');
  if(/^[-.,;:()\/\\]+$/.test(withoutCurrency)) return true;

  // Accepteer nulnotaties uit Excel: 0, 0,00, 0.00, € 0, 0,-, € -, enzovoort.
  const compact=withoutCurrency.replace(/[^0-9,.-]/g,'');
  if(/^0+(?:[.,]0*)?(?:,-)?$/.test(compact)) return true;
  if(/^0+,-$/.test(compact)) return true;

  return [
    'geen waarborgsom','geen borg','geen deposito','zonder waarborgsom',
    'zonder borg','zonder deposito','niet van toepassing waarborgsom',
    'niet verschuldigd','nihil','nul','zero'
  ].includes(marker);
}

function parseDepositImportValue(value){
  if(isNoDepositValue(value)) return 0;
  const parsed=parseImportNumber(normalizeDepositInput(value),'waarborgsom');
  return parsed===null ? 0 : parsed;
}

function isIndefiniteContractValue(value){
  const marker=normalizedImportMarker(value);
  if(!marker) return false;
  return marker.includes('onbepaalde')
    || marker.includes('onbepaald')
    || marker.includes('zonder einddatum')
    || marker.includes('geen einddatum')
    || marker.includes('doorlopend')
    || marker.includes('indefinite');
}

function parseImportNumber(value, label='getal'){
  const raw=clean(value);
  if(isMissingImportValue(raw)) return null;
  let normalized=raw.replace(/[€%\s]/g,'');
  if(normalized.includes(',') && normalized.includes('.')){
    normalized=normalized.lastIndexOf(',')>normalized.lastIndexOf('.')
      ? normalized.replace(/\./g,'').replace(',','.')
      : normalized.replace(/,/g,'');
  } else if(normalized.includes(',')){
    normalized=normalized.replace(/\./g,'').replace(',','.');
  } else if((normalized.match(/\./g)||[]).length>1){
    normalized=normalized.replace(/\./g,'');
  }
  const number=Number(normalized);
  if(!Number.isFinite(number)) throw new Error(`Ongeldig ${label}: ${value}`);
  return number;
}

function parseContractPeriodNumber(value,label){
  const raw=clean(value);
  if(!raw) return null;
  const match=raw.match(/\d+(?:[.,]\d+)?/);
  if(!match) throw new Error(`Ongeldige ${label}: ${value}`);
  const number=Number(match[0].replace(',','.'));
  if(!Number.isFinite(number) || number<0) throw new Error(`Ongeldige ${label}: ${value}`);
  return Math.round(number);
}

function parseImportBoolean(value,label='keuze'){
  const raw=norm(value);
  if(!raw) return null;
  if(['ja','yes','true','1','verplicht'].includes(raw)) return true;
  if(['nee','no','false','0','niet verplicht','nvt','n.v.t.'].includes(raw)) return false;
  throw new Error(`Ongeldige ${label}: ${value}`);
}

function parseObjectImportDate(value){
  const raw=clean(value);
  if(isMissingImportValue(raw) || isIndefiniteContractValue(raw)) return null;
  if(/^\d+(?:[.,]\d+)?$/.test(raw)){
    const serial=Number(raw.replace(',','.'));
    if(serial>=20000 && serial<=80000){
      const date=new Date(Date.UTC(1899,11,30)+Math.round(serial)*86400000);
      return date.toISOString().slice(0,10);
    }
  }
  return parseMaintenanceDate(raw);
}

function objectCsvRecords(rows){
  if(rows.length<2) throw new Error('Het CSV-bestand bevat geen gegevensregels.');
  const map=mapObjectCsvHeaders(rows[0]);
  if(map.name===undefined && map.address===undefined){
    throw new Error('Geen kolom “Objectnaam”, “Straatnaam” of “Adres” gevonden. Gebruik het objecten-importsjabloon.');
  }
  const records=[];
  rows.slice(1).forEach((row,index)=>{
    if(!row.some(value=>clean(value))) return;
    const present=new Set(Object.keys(map));
    const address=csvCell(row,map,'address');
    const houseNumber=csvCell(row,map,'house_number');
    const name=csvCell(row,map,'name') || [address,houseNumber].filter(Boolean).join(' ');
    records.push({
      rowNumber:index+2,
      present,
      object_id:csvCell(row,map,'object_id'),
      name,
      address,
      house_number:houseNumber,
      postal_code:csvCell(row,map,'postal_code'),
      city:csvCell(row,map,'city'),
      billing_name:csvCell(row,map,'billing_name'),
      billing_address:csvCell(row,map,'billing_address'),
      billing_house_number:csvCell(row,map,'billing_house_number'),
      billing_postal_code:csvCell(row,map,'billing_postal_code'),
      billing_city:csvCell(row,map,'billing_city'),
      property_type:csvCell(row,map,'property_type'),
      status:csvCell(row,map,'status'),
      monthly_rent:csvCell(row,map,'monthly_rent'),
      yearly_rent:csvCell(row,map,'yearly_rent'),
      service_costs:csvCell(row,map,'service_costs'),
      energy_costs:csvCell(row,map,'energy_costs'),
      deposit:csvCell(row,map,'deposit'),
      corporate_guarantee:csvCell(row,map,'corporate_guarantee'),
      bank_guarantee:csvCell(row,map,'bank_guarantee'),
      energy_label:csvCell(row,map,'energy_label'),
      energy_label_required:csvCell(row,map,'energy_label_required'),
      energy_label_valid_until:csvCell(row,map,'energy_label_valid_until'),
      rent_increase_month:csvCell(row,map,'rent_increase_month'),
      scope_valid_until:csvCell(row,map,'scope_valid_until'),
      scope12_valid_until:csvCell(row,map,'scope12_valid_until'),
      purchase_value:csvCell(row,map,'purchase_value'),
      woz_value:csvCell(row,map,'woz_value'),
      mortgage_value:csvCell(row,map,'mortgage_value'),
      mortgage_interest:csvCell(row,map,'mortgage_interest'),
      purchase_date:csvCell(row,map,'purchase_date'),
      tenant_name:csvCell(row,map,'tenant_name'),
      tenant_email:csvCell(row,map,'tenant_email'),
      tenant_phone:csvCell(row,map,'tenant_phone'),
      contract_start_date:csvCell(row,map,'contract_start_date'),
      contract_end_date:csvCell(row,map,'contract_end_date'),
      contract_notice_date:csvCell(row,map,'contract_notice_date'),
      notice_period_months:csvCell(row,map,'notice_period_months'),
      renewal_period_years:csvCell(row,map,'renewal_period_years'),
      contract_term:csvCell(row,map,'contract_term'),
      contract_status:csvCell(row,map,'contract_status')
    });
  });
  if(!records.length) throw new Error('Er zijn geen gevulde objectregels gevonden.');
  return records;
}

function findPropertyForObjectImport(record){
  const objectId=clean(record.object_id);
  if(objectId){
    const exact=rawProperties.find(property=>property.id===objectId);
    if(exact) return exact;
  }

  const addressKey=norm(record.address);
  const houseKey=norm(record.house_number);
  const fullKey=norm([record.address,record.house_number].filter(Boolean).join(' '));
  const nameKey=norm(record.name);
  return rawProperties.find(property=>{
    const propertyAddress=norm(property.address);
    const propertyHouse=norm(property.house_number);
    const propertyName=norm(property.name);
    return (addressKey && propertyAddress===addressKey && propertyHouse===houseKey)
      || (fullKey && propertyAddress===fullKey)
      || (nameKey && propertyName===nameKey);
  }) || null;
}

function propertyPayloadFromCsv(record, isNew){
  const payload={};
  const textFields=['name','address','house_number','postal_code','city','billing_name','billing_address','billing_house_number','billing_postal_code','billing_city','property_type','status','energy_label','rent_increase_month'];
  textFields.forEach(field=>{
    if(record.present.has(field)) payload[field]=record[field]||null;
  });
  const numberFields=['monthly_rent','yearly_rent','service_costs','energy_costs','deposit','corporate_guarantee','bank_guarantee','purchase_value','woz_value','mortgage_value','mortgage_interest'];
  numberFields.forEach(field=>{
    if(!record.present.has(field)) return;
    if(field==='deposit'){
      // Leeg, n.v.t., 0, een liggend streepje of “geen waarborgsom” wordt als € 0 opgeslagen.
      payload[field]=parseDepositImportValue(record[field]);
      return;
    }
    payload[field]=parseImportNumber(record[field],field);
  });
  if(record.present.has('energy_label_required')){
    const required=parseImportBoolean(record.energy_label_required,'waarde bij Energielabel verplicht');
    if(required!==null) payload.energy_label_required=required;
  }
  const dateFields=['energy_label_valid_until','scope_valid_until','purchase_date'];
  dateFields.forEach(field=>{
    if(record.present.has(field)) payload[field]=parseObjectImportDate(record[field]);
  });

  // Jaarhuur blijft altijd gelijk aan maandhuur × 12 wanneer maandhuur is aangeleverd.
  if(record.present.has('monthly_rent')&&payload.monthly_rent!==null&&payload.monthly_rent!==undefined){
    payload.yearly_rent=Math.round(payload.monthly_rent*12*100)/100;
  }

  if(isNew){
    payload.name=payload.name || record.name || [record.address,record.house_number].filter(Boolean).join(' ') || 'Nieuw object';
    payload.address=payload.address ?? (record.address || null);
    payload.house_number=payload.house_number ?? (record.house_number || null);
    payload.property_type=payload.property_type || 'Vastgoedobject';
    payload.status=payload.status || 'Actief';
    if(payload.deposit===undefined) payload.deposit=0;
    if(payload.energy_label_required===undefined) payload.energy_label_required=true;
  }
  return payload;
}

async function importObjectCsv(){
  const input=el('objectCsvFile');
  const button=el('chooseObjectCsvBtn');
  const message=el('objectImportMessage');
  const results=el('objectImportResults');
  const file=input?.files?.[0];
  if(!file){ if(message) message.textContent='Kies eerst een objecten-CSV.'; return; }

  button?.classList.add('importing');
  button?.setAttribute('aria-disabled','true');
  if(message) message.textContent='Objecten-CSV wordt gelezen en verwerkt...';
  if(results) results.innerHTML='';

  try{
    const records=objectCsvRecords(parseCsvAuto(await file.text()));
    let propertiesAdded=0, propertiesUpdated=0, tenantsAdded=0, tenantsUpdated=0, contractsAdded=0, contractsUpdated=0;
    const errors=[], warnings=[];

    for(const record of records){
      try{
        if(!record.name && !record.address) throw new Error('Objectnaam of adres ontbreekt.');
        let property=findPropertyForObjectImport(record);
        const propertyWasExisting=Boolean(property);
        const propertyPayload=propertyPayloadFromCsv(record,!property);
        const propertyResult=property
          ? await sb.from('properties').update(propertyPayload).eq('id',property.id).select().single()
          : await sb.from('properties').insert(propertyPayload).select().single();
        if(propertyResult.error) throw propertyResult.error;
        property=propertyResult.data;
        if(propertyWasExisting) propertiesUpdated++;
        else { propertiesAdded++; rawProperties.push(property); }

        if(record.present.has('scope_valid_until')){
          await syncPropertyInspection(property.id,'SCOPE 10',parseObjectImportDate(record.scope_valid_until));
        }
        if(record.present.has('scope12_valid_until')){
          await syncPropertyInspection(property.id,'SCOPE 12',parseObjectImportDate(record.scope12_valid_until));
        }

        const existingContract=rawContracts.find(contract=>contract.property_id===property.id) || null;
        let tenant=existingContract ? rawTenants.find(item=>item.id===existingContract.tenant_id) || null : null;
        if(!tenant && record.tenant_email) tenant=rawTenants.find(item=>norm(item.email)===norm(record.tenant_email)) || null;
        if(!tenant && record.tenant_name) tenant=rawTenants.find(item=>norm(item.name)===norm(record.tenant_name)) || null;

        const hasTenantData=['tenant_name','tenant_email','tenant_phone'].some(field=>record.present.has(field) && record[field]);
        if(hasTenantData){
          if(!tenant && !record.tenant_name){
            warnings.push(`Rij ${record.rowNumber}: huurder overgeslagen omdat de naam ontbreekt.`);
          } else {
            const tenantPayload={};
            if(record.present.has('tenant_name')) tenantPayload.name=record.tenant_name||tenant?.name||null;
            if(record.present.has('tenant_email')) tenantPayload.email=record.tenant_email||null;
            if(record.present.has('tenant_phone')) tenantPayload.phone=record.tenant_phone||null;
            const tenantResult=tenant
              ? await sb.from('tenants').update(tenantPayload).eq('id',tenant.id).select().single()
              : await sb.from('tenants').insert({...tenantPayload,name:tenantPayload.name||record.tenant_name}).select().single();
            if(tenantResult.error) throw tenantResult.error;
            const tenantWasExisting=Boolean(tenant);
            tenant=tenantResult.data;
            if(tenantWasExisting || rawTenants.some(item=>item.id===tenant.id)) tenantsUpdated++;
            else { tenantsAdded++; rawTenants.push(tenant); }
          }
        }

        const indefinite=isIndefiniteContractValue(record.contract_term)
          || isIndefiniteContractValue(record.contract_end_date)
          || isIndefiniteContractValue(record.renewal_period_years)
          || isIndefiniteContractValue(record.contract_status);
        const hasContractData=tenant || ['contract_start_date','contract_end_date','contract_notice_date','notice_period_months','renewal_period_years','contract_term','contract_status'].some(field=>record.present.has(field) && record[field]);
        if(hasContractData){
          const contractPayload={property_id:property.id};
          if(tenant) contractPayload.tenant_id=tenant.id;
          if(record.present.has('contract_start_date')) contractPayload.start_date=parseObjectImportDate(record.contract_start_date);
          if(record.present.has('contract_end_date') || indefinite) contractPayload.end_date=indefinite ? null : parseObjectImportDate(record.contract_end_date);
          if(record.present.has('notice_period_months')) contractPayload.notice_period_months=isMissingImportValue(record.notice_period_months) ? null : parseContractPeriodNumber(record.notice_period_months,'opzegtermijn');
          if(record.present.has('renewal_period_years')) contractPayload.renewal_period_years=(indefinite || isMissingImportValue(record.renewal_period_years)) ? null : parseContractPeriodNumber(record.renewal_period_years,'verlengtermijn');
          if(record.present.has('contract_notice_date')) contractPayload.notice_date=parseObjectImportDate(record.contract_notice_date);
          else if(contractPayload.end_date && contractPayload.notice_period_months) contractPayload.notice_date=shiftIsoMonths(contractPayload.end_date,-contractPayload.notice_period_months);
          if(record.present.has('monthly_rent')) contractPayload.monthly_rent=parseImportNumber(record.monthly_rent,'maandhuur');
          if(record.present.has('contract_status')) contractPayload.status=canonicalContractStatus(record.contract_status);
          else if(!existingContract) contractPayload.status='Actief';
          const contractResult=existingContract
            ? await sb.from('contracts').update(contractPayload).eq('id',existingContract.id).select().single()
            : await sb.from('contracts').insert(contractPayload).select().single();
          if(contractResult.error) throw contractResult.error;
          if(existingContract) contractsUpdated++;
          else { contractsAdded++; rawContracts.push(contractResult.data); }
        }
      } catch(error){
        errors.push(`Rij ${record.rowNumber} · ${escHtml(record.name || [record.address,record.house_number].filter(Boolean).join(' ') || 'Onbekend object')}: ${escHtml(error.message)}`);
      }
    }

    await loadData();
    if(message) message.textContent=`Import klaar: ${propertiesAdded} objecten toegevoegd, ${propertiesUpdated} bijgewerkt, ${errors.length} fouten.`;
    const summary=`<div class="importSummary"><span>CSV-regels: <strong>${records.length}</strong></span><span>Objecten toegevoegd: <strong>${propertiesAdded}</strong></span><span>Objecten bijgewerkt: <strong>${propertiesUpdated}</strong></span><span>Huurders toegevoegd/bijgewerkt: <strong>${tenantsAdded + tenantsUpdated}</strong></span><span>Contracten toegevoegd/bijgewerkt: <strong>${contractsAdded + contractsUpdated}</strong></span></div>`;
    const warningHtml=warnings.length ? `<div class="importNotice warning"><strong>Waarschuwingen (${warnings.length})</strong>${warnings.map(item=>`<span>${escHtml(item)}</span>`).join('')}</div>` : '';
    const errorHtml=errors.length ? `<div class="importNotice danger"><strong>Fouten (${errors.length})</strong>${errors.map(item=>`<span>${item}</span>`).join('')}</div>` : '';
    if(results) results.innerHTML=summary+warningHtml+errorHtml;
  } catch(error){
    console.error(error);
    if(message) message.textContent='Importeren mislukt: '+error.message;
  } finally {
    button?.classList.remove('importing');
    button?.removeAttribute('aria-disabled');
  }
}


function parseSemicolonCsv(text){
  const rows=[];
  let row=[], cell='', inQuotes=false;
  const input=String(text||'').replace(/^\uFEFF/, '');
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(ch==='"'){
      if(inQuotes && input[i+1]==='"'){ cell+='"'; i++; }
      else inQuotes=!inQuotes;
    } else if(ch===';' && !inQuotes){
      row.push(cell); cell='';
    } else if((ch==='\n' || ch==='\r') && !inQuotes){
      if(ch==='\r' && input[i+1]==='\n') i++;
      row.push(cell); cell='';
      if(row.some(v=>String(v).trim()!=='')) rows.push(row);
      row=[];
    } else {
      cell+=ch;
    }
  }
  row.push(cell);
  if(row.some(v=>String(v).trim()!=='')) rows.push(row);
  return rows;
}

function canonicalMaintenanceType(value){
  const key=norm(value).replace(/\s+/g,' ');
  const aliases={
    'airco':'Airco',
    'cv-installatie':'CV-Installatie',
    'cv installatie':'CV-Installatie',
    'brandbeveiliging':'Brandbeveiliging',
    'alarm installatie':'Alarm installatie',
    'alarminstallatie':'Alarm installatie',
    'overheaddeur':'Overheaddeur',
    'schilderwerk':'Schilderwerk',
    'gevelreiniging':'Gevelreiniging',
    'onkruid':'Onkruid'
  };
  return aliases[key] || clean(value);
}

function parseBuildYear(value){
  const raw=clean(value);
  if(!raw) return null;
  if(!/^\d{4}$/.test(raw)) throw new Error(`Ongeldig bouwjaar: ${raw}`);
  const year=Number(raw);
  if(year<1800 || year>2200) throw new Error(`Ongeldig bouwjaar: ${raw}`);
  return year;
}

function lastDayIso(year, monthIndex){
  const day=new Date(Date.UTC(year, monthIndex+1, 0)).getUTCDate();
  return `${year}-${String(monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function parseMaintenanceDate(value){
  const raw=clean(value).toLowerCase().replace(/\./g,'');
  if(!raw) return null;

  let match=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(match){
    const year=Number(match[1]), month=Number(match[2]), day=Number(match[3]);
    const date=new Date(Date.UTC(year,month-1,day));
    if(date.getUTCFullYear()!==year || date.getUTCMonth()!==month-1 || date.getUTCDate()!==day) throw new Error(`Ongeldige datum: ${value}`);
    return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  match=raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if(match){
    const day=Number(match[1]), month=Number(match[2]), year=Number(match[3]);
    const date=new Date(Date.UTC(year,month-1,day));
    if(date.getUTCFullYear()!==year || date.getUTCMonth()!==month-1 || date.getUTCDate()!==day) throw new Error(`Ongeldige datum: ${value}`);
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  match=raw.match(/^([a-zé]+)[\s-]+(\d{2}|\d{4})$/i);
  if(match){
    const months={jan:0,januari:0,feb:1,februari:1,mrt:2,maart:2,maa:2,apr:3,april:3,mei:4,jun:5,juni:5,jul:6,juli:6,aug:7,augustus:7,sep:8,sept:8,september:8,okt:9,oktober:9,nov:10,november:10,dec:11,december:11};
    const month=months[match[1]];
    if(month===undefined) throw new Error(`Onbekende maand: ${value}`);
    let year=Number(match[2]);
    if(match[2].length===2) year=2000+year;
    return lastDayIso(year,month);
  }

  throw new Error(`Ongeldige datum: ${value}`);
}

function maintenanceCsvRecords(rows){
  if(rows.length<3) throw new Error('Het CSV-bestand bevat geen gegevens of mist de twee kopregels.');
  const first=rows[0], second=rows[1];
  const columns=[];
  let currentType='';
  for(let i=3;i<Math.max(first.length,second.length);i++){
    if(clean(first[i])) currentType=canonicalMaintenanceType(first[i]);
    const field=norm(second[i]);
    if(currentType && field) columns.push({index:i,type:currentType,field});
  }
  if(!columns.length) throw new Error('De onderhoudskolommen konden niet uit de twee kopregels worden gelezen.');

  const records=[];
  rows.slice(2).forEach((row,rowOffset)=>{
    const street=clean(row[0]), house=clean(row[1]), tenant=clean(row[2]);
    if(!street && !house && !tenant) return;
    const groups={};
    columns.forEach(col=>{
      const target=(groups[col.type] ||= {type:col.type,street,house,tenant,rowNumber:rowOffset+3});
      const value=clean(row[col.index]);
      if(col.field==='bouwjaar') target.buildYearRaw=value;
      else if(col.field==='gedaan') target.completedRaw=value;
      else if(col.field==='planning') target.plannedRaw=value;
      else if(col.field==='partij') target.contractor=value;
    });
    Object.values(groups).forEach(item=>{
      if(item.buildYearRaw || item.completedRaw || item.plannedRaw || item.contractor) records.push(item);
    });
  });
  return records;
}

function findImportedProperty(street,house){
  const streetKey=norm(street), houseKey=norm(house);
  return rawProperties.find(p=>norm(p.address)===streetKey && norm(p.house_number)===houseKey) || null;
}

function currentTenantForProperty(propertyId){
  const contract=rawContracts.find(c=>c.property_id===propertyId);
  return contract ? rawTenants.find(t=>t.id===contract.tenant_id) || null : null;
}

async function importMaintenanceCsv(){
  const input=el('maintenanceCsvFile');
  const button=el('chooseMaintenanceCsvBtn');
  const message=el('maintenanceImportMessage');
  const results=el('maintenanceImportResults');
  const file=input?.files?.[0];
  if(!file){ message.textContent='Kies eerst de onderhouds-CSV.'; return; }

  if(button){
    button.classList.add('importing');
    button.setAttribute('aria-disabled','true');
  }
  message.textContent='CSV wordt gelezen en gekoppeld...';
  results.innerHTML='';

  try{
    const rows=parseSemicolonCsv(await file.text());
    const records=maintenanceCsvRecords(rows);
    const existingMap=new Map(rawMaintenance.map(m=>[`${m.property_id}|${norm(m.title)}`,m]));
    let added=0, updated=0, skipped=0;
    const errors=[], warnings=[];

    for(const record of records){
      try{
        if(!record.street || !record.house) throw new Error('Straatnaam of huisnummer ontbreekt.');
        const property=findImportedProperty(record.street,record.house);
        if(!property) throw new Error(`Object niet gevonden: ${record.street} ${record.house}`);

        const tenant=currentTenantForProperty(property.id);
        if(record.tenant && tenant?.name && norm(record.tenant)!==norm(tenant.name)){
          warnings.push(`Rij ${record.rowNumber}: huurder “${record.tenant}” wijkt af van “${tenant.name}” bij ${record.street} ${record.house}. Onderhoud is wel aan het object gekoppeld.`);
        }

        const buildYear=parseBuildYear(record.buildYearRaw);
        const completedDate=parseMaintenanceDate(record.completedRaw);
        const plannedDate=parseMaintenanceDate(record.plannedRaw);
        const key=`${property.id}|${norm(record.type)}`;
        const existing=existingMap.get(key);
        const calculatedStatus=completedDate ? 'Afgerond' : (plannedDate ? 'Gepland' : 'Te plannen');

        if(existing){
          const payload={
            title:record.type,
            build_year:buildYear,
            completed_date:completedDate,
            planned_date:plannedDate,
            contractor:record.contractor||null,
            status:calculatedStatus
          };
          const res=await sb.from('maintenance').update(payload).eq('id',existing.id).select().single();
          if(res.error) throw res.error;
          existingMap.set(key,res.data);
          updated++;
        } else {
          const payload={
            property_id:property.id,
            title:record.type,
            build_year:buildYear,
            completed_date:completedDate,
            planned_date:plannedDate,
            contractor:record.contractor||null,
            status:calculatedStatus,
            priority:'Normaal',
            description:'Geïmporteerd uit onderhouds-CSV'
          };
          const res=await sb.from('maintenance').insert(payload).select().single();
          if(res.error) throw res.error;
          existingMap.set(key,res.data);
          added++;
        }
      } catch(error){
        errors.push(`Rij ${record.rowNumber} · ${record.street || '-'} ${record.house || '-'} · ${record.type}: ${error.message}`);
      }
    }

    skipped=Math.max(0,records.length-added-updated-errors.length);
    await loadData();
    message.textContent=`Import klaar: ${added} toegevoegd, ${updated} bijgewerkt, ${errors.length} fouten.`;
    const warningHtml=warnings.length ? `<div class="importNotice warning"><strong>Waarschuwingen (${warnings.length})</strong>${warnings.map(x=>`<span>${escHtml(x)}</span>`).join('')}</div>` : '';
    const errorHtml=errors.length ? `<div class="importNotice danger"><strong>Fouten (${errors.length})</strong>${errors.map(x=>`<span>${escHtml(x)}</span>`).join('')}</div>` : '';
    results.innerHTML=`<div class="importSummary"><span>Gelezen onderhoudsregels: <strong>${records.length}</strong></span><span>Toegevoegd: <strong>${added}</strong></span><span>Bijgewerkt: <strong>${updated}</strong></span>${skipped?`<span>Overgeslagen: <strong>${skipped}</strong></span>`:''}</div>${warningHtml}${errorHtml}`;
  } catch(error){
    console.error(error);
    message.textContent='Importeren mislukt: '+error.message;
  } finally {
    if(button){
      button.classList.remove('importing');
      button.removeAttribute('aria-disabled');
    }
  }
}

function contractEndDisplay(r){ return r.contract_onbepaalde ? 'Onbepaalde tijd' : dateFmt(r.einddatum_contract); }
function contractPeriodText(r){
  if(r.opzegtermijn_maanden===null || r.opzegtermijn_maanden===undefined || r.opzegtermijn_maanden==='') return 'Niet ingesteld';
  return `${r.opzegtermijn_maanden} ${r.opzegtermijn_maanden===1?'maand':'maanden'}`;
}
function renewalText(r){
  if(r.contract_onbepaalde) return '-';
  if(!r.verlenging_jaren) return 'Geen automatische verlenging';
  return `${r.verlenging_jaren} ${r.verlenging_jaren===1?'jaar':'jaar'}`;
}

const INSPECTION_TYPES=['SCOPE 10','SCOPE 12','Energielabel','NEN 3140','Brandveiligheidskeuring','Liftkeuring','Legionellacontrole','Overig'];
const INSPECTION_STATUSES=['Nog te plannen','Ingepland','In behandeling','Geldig','Afgekeurd','Niet van toepassing'];

function inspectionProperty(row){
  return vastgoedData.find(item=>item.id===row.property_id)||null;
}
function inspectionDeadline(row){
  if(!row) return null;
  return row.next_inspection_date||row.valid_until||null;
}
function inspectionDisplayStatus(row){
  if(isEnergyLabelInspection(row)&&inspectionProperty(row)?.energielabel_verplicht===false){
    return 'Niet van toepassing';
  }
  const stored=clean(row.status)||'Nog te plannen';
  if(['Afgekeurd','Niet van toepassing','Ingepland','In behandeling','Nog te plannen'].includes(stored)) return stored;
  const days=daysUntil(inspectionDeadline(row));
  if(days===null) return stored==='Geldig'?'Geldig':'Nog te plannen';
  if(days<0) return 'Verlopen';
  if(days<=90) return 'Verloopt binnenkort';
  return 'Geldig';
}
function inspectionStatusClass(status){
  if(status==='Geldig'||status==='Niet van toepassing') return 'ok';
  if(status==='Verlopen'||status==='Afgekeurd') return 'danger';
  return 'warning';
}
function inspectionStatusBadge(row){
  const status=inspectionDisplayStatus(row);
  return statusBadge([status,inspectionStatusClass(status)]);
}
function isEnergyLabelInspection(row){
  return norm(row?.inspection_type).replace(/\s+/g,'')==='energielabel';
}
function propertyEnergyLabelInspectionRows(data){
  const manualPropertyIds=new Set(
    rawInspections
      .filter(isEnergyLabelInspection)
      .map(row=>row.property_id)
      .filter(Boolean)
  );

  return data
    .filter(property=>{
      const label=clean(property.energielabel);
      const hasLabel=label&&label!=='-';
      return !manualPropertyIds.has(property.id)&&(!property.energielabel_verplicht||hasLabel||property.energielabel_geldig_tot);
    })
    .map(property=>({
      id:`property-energy-label:${property.id}`,
      property_id:property.id,
      inspection_type:'Energielabel',
      inspection_date:null,
      valid_until:property.energielabel_geldig_tot||null,
      next_inspection_date:null,
      status:property.energielabel_verplicht===false?'Niet van toepassing':(property.energielabel_geldig_tot?'Geldig':'Nog te plannen'),
      inspection_company:null,
      certificate_number:property.energielabel_verplicht===false?'Niet verplicht':(clean(property.energielabel)&&property.energielabel!=='-'?`Label ${property.energielabel}`:null),
      cost:0,
      notes:null,
      document_path:null,
      document_name:null,
      derived_from_property:true
    }));
}
function allInspectionRows(data){
  const allowedIds=new Set(data.map(item=>item.id));
  const stored=rawInspections.filter(row=>!row.property_id||allowedIds.has(row.property_id));
  return [...stored,...propertyEnergyLabelInspectionRows(data)];
}
function filteredInspections(data){
  return allInspectionRows(data).filter(row=>{
    const property=inspectionProperty(row);
    const hay=JSON.stringify({...row,object:property?.object,address:property?.straatnaam,house_number:property?.huisnummer}).toLowerCase();
    if(query&&!hay.includes(query.toLowerCase())) return false;
    if(inspectionObjectFilter&&row.property_id!==inspectionObjectFilter) return false;
    if(inspectionTypeFilter&&row.inspection_type!==inspectionTypeFilter) return false;
    if(inspectionStatusFilter&&inspectionDisplayStatus(row)!==inspectionStatusFilter) return false;
    return true;
  }).sort((a,b)=>{
    const ap=inspectionProperty(a)||{};
    const bp=inspectionProperty(b)||{};
    const addressCompare=compareObjectAddress(ap,bp);
    if(addressCompare!==0) return addressCompare;
    return String(inspectionDeadline(a)||'9999-12-31').localeCompare(String(inspectionDeadline(b)||'9999-12-31'));
  });
}
function inspectionRowTable(rows){
  const sortedRows=[...rows].sort((a,b)=>{
    const typeCompare=String(a.inspection_type||'').localeCompare(String(b.inspection_type||''),'nl',{sensitivity:'base',numeric:true});
    if(typeCompare!==0) return typeCompare;
    return String(inspectionDeadline(a)||'9999-12-31').localeCompare(String(inspectionDeadline(b)||'9999-12-31'));
  });

  return `<table class="maintenanceObjectTable inspectionObjectTable">
    <tr><th>Keuring</th><th>Laatste keuring</th><th>Geldig / volgende</th><th>Keuringsbedrijf</th><th>Certificaat</th><th>Kosten</th><th>Status</th><th>Acties</th></tr>
    ${sortedRows.map(row=>{
      const docButton=row.document_path
        ? `<button class="miniLink openInspectionDocBtn" data-path="${escAttr(row.document_path)}">Open document</button>`
        : '-';
      const sourceTag='';
      const actions=row.derived_from_property
        ? `<button class="miniLink detailBtn" data-id="${escAttr(row.property_id)}">Open object</button>`
        : `<button class="miniLink editInspectionBtn" data-id="${escAttr(row.id)}">Bewerken</button><button class="miniLink dangerTextBtn deleteInspectionBtn" data-id="${escAttr(row.id)}">Verwijderen</button>`;

      return `<tr>
        <td><strong>${escHtml(row.inspection_type||'-')}</strong>${sourceTag}${row.notes?`<span class="subtle">${escHtml(row.notes)}</span>`:''}</td>
        <td>${dateFmt(row.inspection_date)}</td>
        <td>${dateFmt(inspectionDeadline(row))}${row.valid_until&&row.next_inspection_date?`<span class="subtle">Geldig tot ${dateFmt(row.valid_until)}</span>`:''}</td>
        <td>${escHtml(row.inspection_company||'-')}</td>
        <td>${row.certificate_number?`<span>${escHtml(row.certificate_number)}</span>`:''}${docButton}</td>
        <td>${row.derived_from_property?'-':euro2(row.cost)}</td>
        <td>${inspectionStatusBadge(row)}</td>
        <td><div class="financialActionGroup">${actions}</div></td>
      </tr>`;
    }).join('')||'<tr><td colspan="8">Nog geen keuringen gevonden.</td></tr>'}
  </table>`;
}

function renderInspections(data){
  const target=el('inspectionOverview');
  if(!target) return;
  if(!inspectionsSetupReady){
    target.innerHTML='<div class="importNotice warning"><strong>Eenmalige Supabase-instelling nodig</strong><span>Voer eerst het meegeleverde SQL-bestand voor Keuringen uit.</span></div>';
    return;
  }

  const rows=filteredInspections(data);
  const all=allInspectionRows(data);
  const valid=all.filter(row=>inspectionDisplayStatus(row)==='Geldig').length;
  const soon=all.filter(row=>inspectionDisplayStatus(row)==='Verloopt binnenkort').length;
  const expired=all.filter(row=>inspectionDisplayStatus(row)==='Verlopen').length;
  const actionNeeded=all.filter(row=>['Nog te plannen','Afgekeurd'].includes(inspectionDisplayStatus(row))).length;
  const totalCost=all.reduce((sum,row)=>sum+Number(row.derived_from_property?0:row.cost||0),0);

  const properties=[...data].sort(compareObjectAddress);
  const types=[...new Set([...INSPECTION_TYPES,...all.map(row=>row.inspection_type).filter(Boolean)])]
    .sort((a,b)=>a.localeCompare(b,'nl',{sensitivity:'base'}));
  const statuses=['Geldig','Verloopt binnenkort','Verlopen','Nog te plannen','Ingepland','In behandeling','Afgekeurd','Niet van toepassing'];

  const filterHtml=`<div class="maintenanceFilters maintenanceFiltersWide">
    <label>Object<select id="inspectionObjectFilter"><option value="">Alle objecten</option>${properties.map(r=>`<option value="${escAttr(r.id)}" ${inspectionObjectFilter===r.id?'selected':''}>${escHtml(r.object)} · ${escHtml([r.straatnaam,r.huisnummer,r.postcode].filter(Boolean).join(' '))}</option>`).join('')}</select></label>
    <label>Type<select id="inspectionTypeFilter"><option value="">Alle typen</option>${types.map(type=>`<option value="${escAttr(type)}" ${inspectionTypeFilter===type?'selected':''}>${escHtml(type)}</option>`).join('')}</select></label>
    <label>Status<select id="inspectionStatusFilter"><option value="">Alle statussen</option>${statuses.map(status=>`<option value="${escAttr(status)}" ${inspectionStatusFilter===status?'selected':''}>${escHtml(status)}</option>`).join('')}</select></label>
  </div>`;

  const summaryHtml=`<div class="cards maintenanceCards">
    <div class="card"><span>Totaal keuringen</span><strong>${all.length}</strong></div>
    <div class="card"><span>Geldig</span><strong>${valid}</strong></div>
    <div class="card"><span>Verloopt binnen 90 dagen</span><strong>${soon}</strong></div>
    <div class="card"><span>Verlopen</span><strong>${expired}</strong></div>
    <div class="card"><span>Actie nodig</span><strong>${actionNeeded}</strong></div>
    <div class="card"><span>Totale kosten</span><strong>${euro(totalCost)}</strong></div>
  </div>`;

  const grouped={};
  rows.forEach(row=>{
    const property=inspectionProperty(row);
    const key=row.property_id||`unknown:${row.id}`;
    if(!grouped[key]){
      grouped[key]={
        objectId:row.property_id||'',
        object:property?.object||'Onbekend object',
        address:property?[property.straatnaam,property.huisnummer].filter(Boolean).join(' '):'Geen adres bekend',
        rows:[]
      };
    }
    grouped[key].rows.push(row);
  });

  const groupHtml=Object.values(grouped)
    .sort((a,b)=>{
      const ap=getPropertyById(a.objectId)||{straatnaam:a.address,huisnummer:''};
      const bp=getPropertyById(b.objectId)||{straatnaam:b.address,huisnummer:''};
      return compareObjectAddress(ap,bp);
    })
    .map(group=>{
      const next=group.rows.map(inspectionDeadline).filter(Boolean).sort()[0];
      const costs=group.rows.reduce((sum,row)=>sum+Number(row.derived_from_property?0:row.cost||0),0);
      return `<article class="maintenanceObjectCard inspectionObjectCard">
        <div class="maintenanceObjectHeader">
          <div>
            <h3>${escHtml(group.object)}</h3>
            <p class="meta">${escHtml(group.address||'Geen adres bekend')} • ${group.rows.length} ${group.rows.length===1?'keuring':'keuringen'} • eerstvolgende: ${dateFmt(next)}</p>
          </div>
          <div class="detailActions">
            ${group.objectId?`<button class="secondaryBtn detailBtn" data-id="${escAttr(group.objectId)}">Open object</button>`:''}
            <button class="smallBtn newInspectionForObjectBtn" data-id="${escAttr(group.objectId)}">+ Keuring</button>
          </div>
        </div>
        <div class="row"><span>Totale keuringskosten</span><strong>${euro(costs)}</strong></div>
        ${inspectionRowTable(group.rows)}
      </article>`;
    }).join('');

  const emptyHtml=`<div class="panel inspectionEmptyPanel">
    <p>Geen keuringen gevonden met de huidige filters.</p>
    <button id="newInspectionBtn" type="button">+ Keuring toevoegen</button>
  </div>`;

  target.innerHTML=summaryHtml+filterHtml+(groupHtml||emptyHtml);
}
function openInspectionModal(id='',propertyId=''){
  activeInspectionId=id||null;
  const row=id?rawInspections.find(item=>item.id===id):null;
  el('inspectionModalTitle').textContent=row?'Keuring bewerken':'Keuring toevoegen';
  el('inspectionId').value=row?.id||'';
  const selectedPropertyId=row?.property_id||propertyId||'';
  el('inspectionPropertyId').innerHTML=propertyOptions(selectedPropertyId).replace('Niet gekoppeld','Kies een object');
  el('inspectionPropertyId').value=selectedPropertyId;
  el('inspectionType').value=row?.inspection_type||'SCOPE 10';
  el('inspectionDate').value=row?.inspection_date||'';
  el('inspectionValidUntil').value=row?.valid_until||'';
  el('inspectionNextDate').value=row?.next_inspection_date||'';
  el('inspectionStatus').value=INSPECTION_STATUSES.includes(row?.status)?row.status:'Geldig';
  el('inspectionCompany').value=row?.inspection_company||'';
  el('inspectionCertificate').value=row?.certificate_number||'';
  el('inspectionCost').value=row?.cost??'';
  el('inspectionNotes').value=row?.notes||'';
  el('inspectionDocument').value='';
  el('inspectionCurrentDocument').textContent=row?.document_name?`Huidig document: ${row.document_name}`:'Nog geen document gekoppeld';
  el('inspectionMessage').textContent='';
  el('inspectionModal').classList.remove('hidden');
}
function closeInspectionModal(){
  el('inspectionModal').classList.add('hidden');
  activeInspectionId=null;
}
async function uploadInspectionDocument(file,propertyId){
  if(!file) return null;
  if(file.size>15*1024*1024) throw new Error('Het document is groter dan 15 MB.');
  const allowed=['application/pdf','image/png','image/jpeg','image/webp'];
  if(file.type&&!allowed.includes(file.type)) throw new Error('Upload een PDF, PNG, JPG of WebP-bestand.');
  const path=`inspections/${propertyId}/${Date.now()}-${safeFileName(file.name)}`;
  const result=await sb.storage.from('property-documents').upload(path,file,{upsert:false,cacheControl:'3600'});
  if(result.error) throw result.error;
  return {path,name:file.name};
}
async function saveInspection(event){
  event.preventDefault();
  const message=el('inspectionMessage');
  message.textContent='Bezig met opslaan...';
  let uploaded=null;
  try{
    if(!inspectionsSetupReady) throw new Error('Voer eerst het SQL-bestand voor Keuringen uit.');
    const propertyId=el('inspectionPropertyId').value;
    if(!propertyId) throw new Error('Kies een object.');
    const existing=activeInspectionId?rawInspections.find(item=>item.id===activeInspectionId):null;
    uploaded=await uploadInspectionDocument(el('inspectionDocument').files?.[0],propertyId);
    const payload={
      property_id:propertyId,
      inspection_type:clean(el('inspectionType').value),
      inspection_date:el('inspectionDate').value||null,
      valid_until:el('inspectionValidUntil').value||null,
      next_inspection_date:el('inspectionNextDate').value||null,
      status:el('inspectionStatus').value,
      inspection_company:clean(el('inspectionCompany').value)||null,
      certificate_number:clean(el('inspectionCertificate').value)||null,
      cost:numOrNull(el('inspectionCost').value),
      notes:clean(el('inspectionNotes').value)||null,
      document_path:uploaded?.path||existing?.document_path||null,
      document_name:uploaded?.name||existing?.document_name||null,
      updated_at:new Date().toISOString()
    };
    if(!payload.inspection_type) throw new Error('Kies een type keuring.');
    const result=activeInspectionId
      ? await sb.from('property_inspections').update(payload).eq('id',activeInspectionId)
      : await sb.from('property_inspections').insert(payload);
    if(result.error) throw result.error;
    if(uploaded&&existing?.document_path&&existing.document_path!==uploaded.path){
      const removal=await sb.storage.from('property-documents').remove([existing.document_path]);
      if(removal.error) console.warn('Oud keuringsdocument kon niet worden verwijderd:',removal.error.message);
    }
    closeInspectionModal();
    await loadData();
    setPage('onderhoud','Onderhoud');
    setMaintenanceTab('inspections');
  }catch(error){
    console.error(error);
    if(uploaded?.path) await sb.storage.from('property-documents').remove([uploaded.path]);
    message.textContent='Opslaan mislukt: '+error.message;
  }
}
async function deleteInspection(id){
  const row=rawInspections.find(item=>item.id===id);
  if(!row||!confirm(`Keuring “${row.inspection_type}” verwijderen?`)) return;
  const result=await sb.from('property_inspections').delete().eq('id',id);
  if(result.error){alert('Verwijderen mislukt: '+result.error.message);return;}
  if(row.document_path){
    const removal=await sb.storage.from('property-documents').remove([row.document_path]);
    if(removal.error) console.warn('Keuringsdocument kon niet worden verwijderd:',removal.error.message);
  }
  await loadData();
  setPage('onderhoud','Onderhoud');
    setMaintenanceTab('inspections');
}


function excelXmlEscape(value){
  return String(value??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}
function excelCell(value,type='String',style=''){
  const styleAttr=style?` ss:StyleID="${style}"`:'';
  if(value===null||value===undefined||value==='') return `<Cell${styleAttr}><Data ss:Type="String"></Data></Cell>`;
  if(type==='Number'){
    const number=Number(value);
    if(Number.isFinite(number)) return `<Cell${styleAttr}><Data ss:Type="Number">${number}</Data></Cell>`;
  }
  return `<Cell${styleAttr}><Data ss:Type="String">${excelXmlEscape(value)}</Data></Cell>`;
}
function rawInspectionDateForBackup(propertyId,type,legacyDate=''){
  const row=inspectionsForProperty(propertyId,type)[0];
  return inspectionDeadline(row)||legacyDate||'';
}

function objectImportBackupRows(){
  return [...vastgoedData].sort(compareObjectAddress).map(r=>[
    r.id,
    r.object,
    r.straatnaam,
    r.huisnummer,
    r.postcode,
    r.stad,
    r.type,
    r.status,
    r.huurder==='-'?'':r.huurder,
    r.email,
    r.telefoon,
    r.huur_pm,
    r.huur_pj,
    r.servicekosten,
    r.energiekosten,
    r.waarborgsom,
    r.concerngarantie,
    r.bankgarantie,
    r.aankoopwaarde,
    r.woz_waarde,
    r.hypotheek,
    r.hypotheekrente,
    r.aankoopdatum,
    r.energielabel==='-'?'':r.energielabel,
    r.energielabel_verplicht?'Ja':'Nee',
    r.energielabel_geldig_tot,
    r.maand_huurverhoging,
    rawInspectionDateForBackup(r.id,'SCOPE 10',r.property?.scope_valid_until),
    rawInspectionDateForBackup(r.id,'SCOPE 12'),
    r.startdatum_contract,
    r.contract_onbepaalde?'':r.einddatum_contract,
    r.contract_onbepaalde?'Onbepaalde tijd':'Bepaalde tijd',
    r.opzegtermijn_maanden,
    r.opzegdatum,
    r.verlenging_jaren,
    r.contract_status,
    r.factuur_naam,
    r.factuur_adres,
    r.factuur_huisnummer,
    r.factuur_postcode,
    r.factuur_stad
  ]);
}

function objectFullBackupRows(){
  return [...vastgoedData].sort(compareObjectAddress).map(r=>{
    const scope10=objectInspectionSummary(r.id,'SCOPE 10');
    const scope12=objectInspectionSummary(r.id,'SCOPE 12');
    return [
      r.id,r.object,r.straatnaam,r.huisnummer,r.postcode,r.stad,r.type,r.status,
      r.huurder==='-'?'':r.huurder,r.email,r.telefoon,r.huur_pm,r.huur_pj,r.servicekosten,
      r.energiekosten,r.waarborgsom,r.concerngarantie,r.bankgarantie,r.aankoopwaarde,r.woz_waarde,r.hypotheek,
      r.hypotheekrente,r.aankoopdatum,r.bruto_rendement===null?'':r.bruto_rendement,
      r.energielabel==='-'?'':r.energielabel,r.energielabel_verplicht?'Ja':'Nee',r.energielabel_geldig_tot,
      rawInspectionDateForBackup(r.id,'SCOPE 10',r.property?.scope_valid_until),scope10.status?.[0]||'',
      rawInspectionDateForBackup(r.id,'SCOPE 12'),scope12.status?.[0]||'',
      r.startdatum_contract,r.contract_onbepaalde?'Onbepaalde tijd':r.oorspronkelijke_einddatum_contract,
      r.einddatum_contract,r.opzegtermijn_maanden,r.opzegdatum,r.verlenging_jaren,
      r.aantal_verlengingen,r.contract_status,r.maand_huurverhoging,
      r.onderhoud_titel,r.scope_inspectie_geldig_tot,r.onderhoud_status,r.onderhoud_kosten,
      r.onderhoud_prioriteit,
      r.factuur_naam,r.factuur_adres,r.factuur_huisnummer,r.factuur_postcode,r.factuur_stad
    ];
  });
}

function excelWorksheetXml(name,headers,rows,numericColumns=new Set(),moneyColumns=new Set(),percentColumns=new Set(),selected=false){
  const headerXml=headers.map(value=>excelCell(value,'String','Header')).join('');
  const rowsXml=rows.map(row=>`<Row>${row.map((value,index)=>{
    const style=moneyColumns.has(index)?'Money':percentColumns.has(index)?'Percent':'';
    return excelCell(value,numericColumns.has(index)?'Number':'String',style);
  }).join('')}</Row>`).join('');

  return `<Worksheet ss:Name="${excelXmlEscape(name)}">
  <Table>
   <Column ss:Width="145"/><Column ss:Width="145"/><Column ss:Width="120"/><Column ss:Width="75"/><Column ss:Width="85"/><Column ss:Width="100"/>
   <Row ss:Height="28">${headerXml}</Row>
   ${rowsXml}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane>
   ${selected?'<Selected/>':''}
  </WorksheetOptions>
  <AutoFilter x:Range="R1C1:R${rows.length+1}C${headers.length}" xmlns="urn:schemas-microsoft-com:office:excel"/>
 </Worksheet>`;
}

function downloadObjectBackup(){
  const message=el('objectBackupMessage');
  const button=el('downloadObjectBackupBtn');
  if(!vastgoedData.length){
    if(message) message.textContent='Er zijn geen objecten om te exporteren.';
    return;
  }

  if(button) button.disabled=true;
  if(message) message.textContent='Excel-back-up wordt gemaakt...';

  try{
    const importHeaders=[
      'Object-ID','Objectnaam','Straatnaam','Huisnummer','Postcode','Stad','Type pand','Objectstatus',
      'Huurder','E-mail huurder','Telefoon huurder','Maandhuur','Jaarhuur','Servicekosten',
      'Energiekosten','Waarborgsom','Concerngarantie','Bankgarantie','Aankoopwaarde','WOZ-waarde','Hypotheekschuld',
      'Hypotheekrente','Aankoopdatum','Energielabel','Energielabel verplicht','Energielabel geldig tot','Maand huurverhoging',
      'SCOPE 10 geldig tot','SCOPE 12 geldig tot','Startdatum contract','Einddatum contract',
      'Contractduur','Opzegtermijn maanden','Uiterste opzegdatum','Verlenging jaren','Contractstatus',
      'Naam factuurontvanger','Factuuradres','Factuur huisnummer','Factuur postcode','Factuur plaats'
    ];
    const importRows=objectImportBackupRows();
    const importNumeric=new Set([11,12,13,14,15,16,17,18,19,20,21,32,34]);
    const importMoney=new Set([11,12,13,14,15,16,17,18,19,20]);
    const importPercent=new Set([21]);

    const fullHeaders=[
      'Object-ID','Objectnaam','Straatnaam','Huisnummer','Postcode','Stad','Type object','Objectstatus',
      'Huurder','E-mail huurder','Telefoon huurder','Huur per maand','Huur per jaar','Servicekosten',
      'Energiekosten','Waarborgsom','Concerngarantie','Bankgarantie','Aankoopwaarde','WOZ-waarde','Hypotheekschuld',
      'Hypotheekrente (%)','Aankoopdatum','Bruto rendement (%)','Energielabel','Energielabel verplicht','Energielabel geldig tot',
      'SCOPE 10 geldig tot','Status SCOPE 10','SCOPE 12 geldig tot','Status SCOPE 12',
      'Startdatum contract','Oorspronkelijke einddatum','Huidige einddatum','Opzegtermijn (maanden)',
      'Uiterste opzegdatum','Verlenging (jaren)','Aantal verlengingen','Contractstatus',
      'Maand huurverhoging','Onderhoudstype','Onderhoudsdatum','Onderhoudsstatus','Onderhoudskosten',
      'Onderhoudsprioriteit',
      'Naam factuurontvanger','Factuuradres','Factuur huisnummer','Factuur postcode','Factuur plaats'
    ];
    const fullRows=objectFullBackupRows();
    const fullNumeric=new Set([11,12,13,14,15,16,17,18,19,20,21,23,34,36,37,43]);
    const fullMoney=new Set([11,12,13,14,15,16,17,18,19,20,43]);
    const fullPercent=new Set([21,23]);

    const generatedAt=new Date();
    const generatedText=generatedAt.toLocaleString('nl-NL');
    const xml=`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Vastgoed-dashboard</Author>
  <Created>${generatedAt.toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
  <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="15"/><Interior ss:Color="#E8EEF7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#172033" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="Money"><NumberFormat ss:Format="€ #,##0.00"/></Style>
  <Style ss:ID="Percent"><NumberFormat ss:Format="0.00"/></Style>
 </Styles>
 ${excelWorksheetXml('Objecten import',importHeaders,importRows,importNumeric,importMoney,importPercent,true)}
 ${excelWorksheetXml('Volledige back-up',fullHeaders,fullRows,fullNumeric,fullMoney,fullPercent,false)}
 <Worksheet ss:Name="Back-upinformatie">
  <Table>
   <Column ss:Width="190"/><Column ss:Width="430"/>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">Back-upinformatie</Data></Cell><Cell ss:StyleID="Title"><Data ss:Type="String"></Data></Cell></Row>
   <Row>${excelCell('Gemaakt op')}${excelCell(generatedText)}</Row>
   <Row>${excelCell('Aantal objecten')}${excelCell(importRows.length,'Number')}</Row>
   <Row>${excelCell('Nieuwe objecten toevoegen')}${excelCell('Voeg nieuwe regels toe in het tabblad Objecten import en laat Object-ID leeg.')}</Row>
   <Row>${excelCell('Opnieuw importeren')}${excelCell('Sla alleen het tabblad Objecten import op als CSV UTF-8 en upload dit via de bestaande CSV-uploadknop bij Objecten.')}</Row>
   <Row>${excelCell('Bestaande objecten')}${excelCell('Object-ID wordt als eerste gebruikt om bestaande objecten veilig terug te vinden. Verwijder of verander deze ID niet bij bestaande regels.')}</Row>
   <Row>${excelCell('Volledige back-up')}${excelCell('Het tabblad Volledige back-up bevat ook berekende statussen en onderhoudsoverzicht. Gebruik voor CSV-import altijd Objecten import.')}</Row>
  </Table>
 </Worksheet>
</Workbook>`;

    const blob=new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    const date=generatedAt.toISOString().slice(0,10);
    link.href=url;
    link.download=`vastgoed-objecten-backup-${date}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    if(message) message.textContent=`Back-up gedownload: ${importRows.length} objecten. Het eerste tabblad is geschikt voor CSV-import.`;
  }catch(error){
    console.error(error);
    if(message) message.textContent=`Back-up maken mislukt: ${error.message}`;
  }finally{
    if(button) button.disabled=false;
  }
}

function sortedUnique(values){
  return [...new Set(values.map(value=>clean(value)).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'nl',{sensitivity:'base',numeric:true}));
}
function objectIsVacant(row){
  return String(row.status||'').toLowerCase().includes('leeg')||
    !clean(row.huurder)||
    clean(row.huurder)==='-';
}
function filteredObjectsForPage(data){
  return data.filter(row=>{
    if(objectCityFilter&&clean(row.stad)!==objectCityFilter) return false;
    if(objectTypeFilter&&clean(row.type)!==objectTypeFilter) return false;
    if(objectStatusFilter&&clean(row.status)!==objectStatusFilter) return false;
    if(objectOccupancyFilter==='rented'&&objectIsVacant(row)) return false;
    if(objectOccupancyFilter==='vacant'&&!objectIsVacant(row)) return false;
    return true;
  });
}
function contractNoticeCategory(row){
  if(!row.contract?.id) return 'none';
  if(row.contract_opgezegd) return 'terminated';
  if(row.contract_onbepaalde) return 'indefinite';
  const days=row.contract_timeline?.noticeDays;
  if(days===null||days===undefined) return 'missing';
  if(days<0) return 'passed';
  if(days<=90) return '90';
  if(days<=365) return '365';
  return 'later';
}
function filteredContractsForPage(data){
  return data.filter(row=>{
    if(contractCityFilter&&clean(row.stad)!==contractCityFilter) return false;
    if(contractStateFilter==='active'&&(!row.contract?.id||row.contract_opgezegd)) return false;
    if(contractStateFilter==='terminated'&&!row.contract_opgezegd) return false;
    if(contractStateFilter==='none'&&row.contract?.id) return false;
    if(contractDurationFilter==='fixed'&&(!row.contract?.id||row.contract_onbepaalde)) return false;
    if(contractDurationFilter==='indefinite'&&(!row.contract?.id||!row.contract_onbepaalde)) return false;
    if(contractNoticeFilter&&contractNoticeCategory(row)!==contractNoticeFilter) return false;
    return true;
  });
}
function renderObjectFilters(data){
  const target=el('objectFilters');
  if(!target) return;
  const cities=sortedUnique(data.map(row=>row.stad));
  const types=sortedUnique(data.map(row=>row.type));
  const statuses=sortedUnique(data.map(row=>row.status));
  target.innerHTML=`<div class="pageFilters">
    <label>Stad<select id="objectCityFilter"><option value="">Alle steden</option>${cities.map(value=>`<option value="${escAttr(value)}" ${objectCityFilter===value?'selected':''}>${escHtml(value)}</option>`).join('')}</select></label>
    <label>Type object<select id="objectTypeFilter"><option value="">Alle typen</option>${types.map(value=>`<option value="${escAttr(value)}" ${objectTypeFilter===value?'selected':''}>${escHtml(value)}</option>`).join('')}</select></label>
    <label>Status<select id="objectStatusFilter"><option value="">Alle statussen</option>${statuses.map(value=>`<option value="${escAttr(value)}" ${objectStatusFilter===value?'selected':''}>${escHtml(value)}</option>`).join('')}</select></label>
    <label>Bezetting<select id="objectOccupancyFilter">
      <option value="">Verhuurd en leegstaand</option>
      <option value="rented" ${objectOccupancyFilter==='rented'?'selected':''}>Alleen verhuurd</option>
      <option value="vacant" ${objectOccupancyFilter==='vacant'?'selected':''}>Alleen leegstaand</option>
    </select></label>
    <button class="secondaryBtn clearPageFiltersBtn" type="button" data-filter-page="objects">Filters wissen</button>
  </div>`;
}
function renderContractFilters(data){
  const target=el('contractFilters');
  if(!target) return;
  const cities=sortedUnique(data.map(row=>row.stad));
  target.innerHTML=`<div class="pageFilters">
    <label>Stad<select id="contractCityFilter"><option value="">Alle steden</option>${cities.map(value=>`<option value="${escAttr(value)}" ${contractCityFilter===value?'selected':''}>${escHtml(value)}</option>`).join('')}</select></label>
    <label>Contractstatus<select id="contractStateFilter">
      <option value="">Alle contractstatussen</option>
      <option value="active" ${contractStateFilter==='active'?'selected':''}>Actief</option>
      <option value="terminated" ${contractStateFilter==='terminated'?'selected':''}>Opgezegd</option>
      <option value="none" ${contractStateFilter==='none'?'selected':''}>Geen contract</option>
    </select></label>
    <label>Looptijd<select id="contractDurationFilter">
      <option value="">Bepaalde en onbepaalde tijd</option>
      <option value="fixed" ${contractDurationFilter==='fixed'?'selected':''}>Bepaalde tijd</option>
      <option value="indefinite" ${contractDurationFilter==='indefinite'?'selected':''}>Onbepaalde tijd</option>
    </select></label>
    <label>Opzegmoment<select id="contractNoticeFilter">
      <option value="">Alle opzegmomenten</option>
      <option value="90" ${contractNoticeFilter==='90'?'selected':''}>Binnen 90 dagen</option>
      <option value="365" ${contractNoticeFilter==='365'?'selected':''}>Binnen 12 maanden</option>
      <option value="later" ${contractNoticeFilter==='later'?'selected':''}>Later dan 12 maanden</option>
      <option value="passed" ${contractNoticeFilter==='passed'?'selected':''}>Opzegmoment verstreken</option>
      <option value="indefinite" ${contractNoticeFilter==='indefinite'?'selected':''}>Onbepaalde tijd</option>
      <option value="terminated" ${contractNoticeFilter==='terminated'?'selected':''}>Contract opgezegd</option>
      <option value="missing" ${contractNoticeFilter==='missing'?'selected':''}>Datum ontbreekt</option>
      <option value="none" ${contractNoticeFilter==='none'?'selected':''}>Geen contract</option>
    </select></label>
    <button class="secondaryBtn clearPageFiltersBtn" type="button" data-filter-page="contracts">Filters wissen</button>
  </div>`;
}
function clearPageFilters(page){
  if(page==='objects'){
    objectCityFilter='';
    objectTypeFilter='';
    objectStatusFilter='';
    objectOccupancyFilter='';
  }
  if(page==='contracts'){
    contractStateFilter='';
    contractDurationFilter='';
    contractNoticeFilter='';
    contractCityFilter='';
  }
  render();
}

function renderContractOverview(data){
  const contracts=data.filter(r=>r.contract?.id);
  const activeContracts=contracts.filter(r=>!r.contract_opgezegd);
  const terminatedContracts=contracts.filter(r=>r.contract_opgezegd);
  const noticeWithin365=activeContracts.filter(r=>!r.contract_onbepaalde && r.contract_timeline?.noticeDays!==null && r.contract_timeline.noticeDays>=0 && r.contract_timeline.noticeDays<=365).length;
  const noticeWithin90=activeContracts.filter(r=>!r.contract_onbepaalde && r.contract_timeline?.noticeDays!==null && r.contract_timeline.noticeDays>=0 && r.contract_timeline.noticeDays<=90).length;
  const renewed=activeContracts.filter(r=>r.aantal_verlengingen>0).length;
  const indefinite=activeContracts.filter(r=>r.contract_onbepaalde).length;
  const missingContract=data.filter(r=>!r.contract?.id).length;
  const needsCheck=data.filter(r=>{
    if(!r.contract?.id) return true;
    if(r.contract_opgezegd) return false;
    if(r.contract_onbepaalde) return r.opzegtermijn_maanden===null || r.opzegtermijn_maanden===undefined;
    return !r.opzegdatum || r.opzegdatum_afwijking || (r.contract_timeline?.noticeDays<0 && !r.verlenging_jaren);
  }).length;
  const target=el('contractOverview');
  if(!target) return;
  target.innerHTML=`<div class="cards contractSummaryCards">
    <div class="card"><span>Totaal contracten</span><strong>${contracts.length}</strong></div>
    <div class="card"><span>Actieve contracten</span><strong>${activeContracts.length}</strong></div>
    <div class="card"><span>Opgezegde contracten</span><strong>${terminatedContracts.length}</strong></div>
    <div class="card"><span>Geen contract gekoppeld</span><strong>${missingContract}</strong></div>
    <div class="card"><span>Opzegmoment &lt; 12 mnd</span><strong>${noticeWithin365}</strong></div>
    <div class="card"><span>Opzegmoment &lt; 90 dagen</span><strong>${noticeWithin90}</strong></div>
    <div class="card"><span>Automatisch verlengd</span><strong>${renewed}</strong></div>
    <div class="card"><span>Onbepaalde tijd</span><strong>${indefinite}</strong></div>
    <div class="card"><span>Controle nodig</span><strong>${needsCheck}</strong></div>
  </div>`;
}

function agendaIsoFromDate(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function agendaDateFromIso(value){
  const parts=isoParts(value);
  if(!parts) return null;
  const date=new Date(parts.year,parts.month-1,parts.day);
  return Number.isNaN(date.getTime())?null:date;
}
function agendaDayDifference(value){
  const date=agendaDateFromIso(value);
  if(!date) return null;
  const today=agendaDateFromIso(isoToday());
  return Math.round((date-today)/86400000);
}
function agendaWhenText(value){
  const days=agendaDayDifference(value);
  if(days===null) return '';
  if(days===0) return 'Vandaag';
  if(days===1) return 'Morgen';
  if(days===-1) return 'Gisteren';
  if(days>0) return `Over ${days} dagen`;
  return `${Math.abs(days)} dagen geleden`;
}
function agendaCategoryLabel(type){
  return ({contract:'Contract',maintenance:'Onderhoud',finance:'Financieel',inspection:'Inspectie',energy:'Energielabel',task:'Taak'})[type]||'Overig';
}
function addAgendaEvent(target,event,seen){
  if(!event?.date||!isoParts(event.date)) return;
  const key=[event.date,event.type,event.title,event.objectId||'',event.subtitle||''].join('|');
  if(seen.has(key)) return;
  seen.add(key);
  target.push(event);
}
function buildAgendaEvents(data){
  const events=[];
  const seen=new Set();
  const currentYear=new Date().getFullYear();
  const years=new Set([
    currentYear-1,currentYear,currentYear+1,currentYear+2,
    agendaCursor.getFullYear()-1,agendaCursor.getFullYear(),agendaCursor.getFullYear()+1
  ]);

  data.forEach(r=>{
    const address=[r.straatnaam,r.huisnummer,r.postcode].filter(Boolean).join(' ');
    const objectLine=[r.object,address].filter(Boolean).join(' · ');
    if(r.startdatum_contract){
      addAgendaEvent(events,{date:r.startdatum_contract,type:'contract',title:'Contract gestart',subtitle:objectLine,objectId:r.id},seen);
    }
    if(!r.contract_onbepaalde&&r.opzegdatum){
      addAgendaEvent(events,{date:r.opzegdatum,type:'contract',title:'Uiterste opzegdatum',subtitle:objectLine,objectId:r.id},seen);
    }
    if(!r.contract_onbepaalde&&r.einddatum_contract){
      addAgendaEvent(events,{date:r.einddatum_contract,type:'contract',title:r.contract_opgezegd?'Opgezegd contract eindigt':'Contract eindigt',subtitle:objectLine,objectId:r.id},seen);
    }
    if(r.energielabel_verplicht&&r.energielabel_geldig_tot){
      addAgendaEvent(events,{date:r.energielabel_geldig_tot,type:'energy',title:'Energielabel verloopt',subtitle:objectLine,objectId:r.id},seen);
    }
    if(r.scope_inspectie_geldig_tot){
      addAgendaEvent(events,{date:r.scope_inspectie_geldig_tot,type:'inspection',title:'Scope/inspectie',subtitle:objectLine,objectId:r.id},seen);
    }
    const monthIndex=monthMap[norm(r.maand_huurverhoging)];
    if(monthIndex!==undefined){
      years.forEach(year=>{
        addAgendaEvent(events,{
          date:agendaIsoFromDate(new Date(year,monthIndex,1)),
          type:'finance',
          title:'Huurverhoging',
          subtitle:objectLine,
          objectId:r.id
        },seen);
      });
    }
  });

  maintenanceSourceRows(data).forEach(row=>{
    const objectLine=[row.object,row.address].filter(Boolean).join(' · ');
    if(row.done_date){
      addAgendaEvent(events,{
        date:row.done_date,
        type:'maintenance',
        title:`${row.type||'Onderhoud'} uitgevoerd`,
        subtitle:objectLine,
        objectId:row.objectId
      },seen);
    }
    if(row.planned_date&&row.planned_date!==row.done_date&&maintenanceStatusLabel(row.status)!=='Afgerond'){
      addAgendaEvent(events,{
        date:row.planned_date,
        type:'maintenance',
        title:`${row.type||'Onderhoud'} gepland`,
        subtitle:objectLine,
        objectId:row.objectId
      },seen);
    }
  });

  const allowedIds=new Set(data.map(item=>item.id));
  rawInspections.filter(row=>allowedIds.has(row.property_id)).forEach(row=>{
    const property=inspectionProperty(row);
    const objectLine=[property?.object,[property?.straatnaam,property?.huisnummer].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    if(row.inspection_date){
      addAgendaEvent(events,{date:row.inspection_date,type:'inspection',title:`${row.inspection_type} uitgevoerd`,subtitle:objectLine,objectId:row.property_id},seen);
    }
    const deadline=inspectionDeadline(row);
    if(deadline){
      addAgendaEvent(events,{date:deadline,type:'inspection',title:`${row.inspection_type} verloopt / opnieuw keuren`,subtitle:objectLine,objectId:row.property_id},seen);
    }
  });

  const allowedTaskPropertyIds=new Set(data.map(item=>item.id));
  rawTasks
    .filter(task=>task.due_date&&taskMatchesSearch(task)&&(!task.property_id||allowedTaskPropertyIds.has(task.property_id)))
    .forEach(task=>{
      const property=taskProperty(task);
      const subtitle=[
        property?.object,
        task.status,
        task.priority?`Prioriteit ${task.priority.toLowerCase()}`:''
      ].filter(Boolean).join(' · ');
      addAgendaEvent(events,{
        date:task.due_date,
        type:'task',
        title:task.status==='Afgerond'?`Taak afgerond: ${task.title}`:`Taak: ${task.title}`,
        subtitle,
        objectId:task.property_id||null,
        taskId:task.id
      },seen);
    });

  return events.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'nl',{sensitivity:'base'}));
}
function agendaFilteredEvents(data){
  const all=buildAgendaEvents(data);
  return agendaTypeFilter==='all'?all:all.filter(event=>event.type===agendaTypeFilter);
}
function agendaListHtml(events,emptyText){
  if(!events.length) return `<p class="agendaEmpty">${emptyText}</p>`;
  return events.slice(0,30).map(event=>{
    const date=agendaDateFromIso(event.date);
    const dateText=date?new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',year:'numeric'}).format(date):dateFmt(event.date);
    const actionClass=event.taskId?'taskEditBtn':(event.objectId?'detailBtn':'');
    const actionData=event.taskId?`data-task-id="${escAttr(event.taskId)}"`:(event.objectId?`data-id="${escAttr(event.objectId)}"`:'');
    return `<button class="agendaListItem ${event.type} ${actionClass}" type="button" ${actionData}>
      <span class="agendaListDate">${escHtml(dateText)}</span>
      <span class="agendaListMain"><strong>${escHtml(event.title)}</strong><span>${escHtml(event.subtitle||agendaCategoryLabel(event.type))}</span></span>
      <span class="agendaListWhen">${escHtml(agendaWhenText(event.date))}</span>
    </button>`;
  }).join('');
}
function renderAgenda(data){
  const calendar=el('agendaCalendar');
  if(!calendar) return;
  const events=agendaFilteredEvents(data);
  const year=agendaCursor.getFullYear();
  const month=agendaCursor.getMonth();
  const todayIso=isoToday();
  const firstDay=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0);
  const gridStart=new Date(year,month,1-((firstDay.getDay()+6)%7));
  const monthLabel=new Intl.DateTimeFormat('nl-NL',{month:'long',year:'numeric'}).format(firstDay);
  if(el('agendaMonthLabel')) el('agendaMonthLabel').textContent=monthLabel;
  if(el('agendaTypeFilter')) el('agendaTypeFilter').value=agendaTypeFilter;

  const monthStart=agendaIsoFromDate(firstDay);
  const monthEnd=agendaIsoFromDate(lastDay);
  const monthEvents=events.filter(event=>event.date>=monthStart&&event.date<=monthEnd);
  const upcoming30=events.filter(event=>{const d=agendaDayDifference(event.date);return d!==null&&d>=0&&d<=30;});
  const upcoming90=events.filter(event=>{const d=agendaDayDifference(event.date);return d!==null&&d>=0&&d<=90;});
  const recent90=events.filter(event=>{const d=agendaDayDifference(event.date);return d!==null&&d<0&&d>=-90;}).sort((a,b)=>b.date.localeCompare(a.date));

  if(el('agendaSummary')){
    el('agendaSummary').innerHTML=`
      <div class="card"><span>Deze maand</span><strong>${monthEvents.length}</strong></div>
      <div class="card"><span>Komende 30 dagen</span><strong>${upcoming30.length}</strong></div>
      <div class="card"><span>Komende 90 dagen</span><strong>${upcoming90.length}</strong></div>
      <div class="card"><span>Afgelopen 90 dagen</span><strong>${recent90.length}</strong></div>`;
  }

  const byDate={};
  events.forEach(event=>(byDate[event.date]||=[]).push(event));
  const weekdays=['Ma','Di','Wo','Do','Vr','Za','Zo'];
  let inner=weekdays.map(day=>`<div class="agendaWeekday">${day}</div>`).join('');
  for(let index=0;index<42;index++){
    const date=new Date(gridStart);
    date.setDate(gridStart.getDate()+index);
    const iso=agendaIsoFromDate(date);
    const dayEvents=byDate[iso]||[];
    const classes=['agendaDay'];
    if(date.getMonth()!==month) classes.push('outsideMonth');
    if(iso===todayIso) classes.push('today');
    const visible=dayEvents.slice(0,3).map(event=>{
      const actionClass=event.taskId?'taskEditBtn':(event.objectId?'detailBtn':'');
      const actionData=event.taskId?`data-task-id="${escAttr(event.taskId)}"`:(event.objectId?`data-id="${escAttr(event.objectId)}"`:'');
      return `<button class="agendaEvent ${event.type} ${actionClass}" type="button" title="${escAttr(`${event.title} · ${event.subtitle||''}`)}" ${actionData}>${escHtml(event.title)}</button>`;
    }).join('');
    const more=dayEvents.length>3?`<span class="agendaMore">+${dayEvents.length-3} meer</span>`:'';
    inner+=`<div class="${classes.join(' ')}"><div class="agendaDayHeader"><span class="agendaDayNumber">${date.getDate()}</span></div><div class="agendaDayEvents">${visible}${more}</div></div>`;
  }
  calendar.innerHTML=`<div class="agendaCalendarInner">${inner}</div>`;
  if(el('agendaUpcomingList')) el('agendaUpcomingList').innerHTML=agendaListHtml(upcoming90,'Geen gebeurtenissen in de komende 90 dagen.');
  if(el('agendaRecentList')) el('agendaRecentList').innerHTML=agendaListHtml(recent90,'Geen gebeurtenissen in de afgelopen 90 dagen.');
}
function shiftAgendaMonth(months){
  agendaCursor=new Date(agendaCursor.getFullYear(),agendaCursor.getMonth()+months,1);
  renderAgenda(filtered());
}
function agendaToday(){
  const now=new Date();
  agendaCursor=new Date(now.getFullYear(),now.getMonth(),1);
  renderAgenda(filtered());
}

function setupContractStickyHeader(){
  const table=el('contractTable');
  const wrap=table?.closest('.contractTableWrap');
  const contractsPage=el('contracten');

  document.querySelector('.contractFloatingHeader')?.remove();
  updateContractStickyHeader=()=>{};

  if(!table||!wrap||!contractsPage) return;

  const sourceHeader=table.querySelector('tr');
  if(!sourceHeader) return;

  const floating=document.createElement('div');
  floating.className='contractFloatingHeader';
  floating.setAttribute('aria-hidden','true');

  const viewport=document.createElement('div');
  viewport.className='contractFloatingHeaderViewport';

  const floatingTable=document.createElement('table');
  floatingTable.className='contractFloatingTable';

  const floatingRow=sourceHeader.cloneNode(true);
  const floatingBody=document.createElement('tbody');
  floatingBody.appendChild(floatingRow);
  floatingTable.appendChild(floatingBody);
  viewport.appendChild(floatingTable);
  floating.appendChild(viewport);
  document.body.appendChild(floating);

  const syncColumnWidths=()=>{
    const sourceCells=[...sourceHeader.children];
    const floatingCells=[...floatingRow.children];
    const tableWidth=Math.max(table.scrollWidth,wrap.clientWidth);

    floatingTable.style.width=`${tableWidth}px`;
    floatingTable.style.minWidth=`${tableWidth}px`;

    sourceCells.forEach((cell,index)=>{
      const width=cell.getBoundingClientRect().width;
      if(floatingCells[index]){
        floatingCells[index].style.width=`${width}px`;
        floatingCells[index].style.minWidth=`${width}px`;
        floatingCells[index].style.maxWidth=`${width}px`;
      }
    });
  };

  const update=()=>{
    if(!document.body.contains(table)){
      floating.remove();
      return;
    }

    const pageActive=contractsPage.classList.contains('active');
    const sourceRect=sourceHeader.getBoundingClientRect();
    const wrapRect=wrap.getBoundingClientRect();
    const pageRect=contractsPage.getBoundingClientRect();
    const headerHeight=Math.max(sourceRect.height,48);
    const shouldShow=
      pageActive &&
      sourceRect.bottom<=0 &&
      pageRect.bottom>headerHeight &&
      wrapRect.right>0 &&
      wrapRect.left<window.innerWidth;

    floating.classList.toggle('visible',shouldShow);

    if(!shouldShow) return;

    syncColumnWidths();
    floating.style.left=`${Math.max(0,wrapRect.left)}px`;
    floating.style.width=`${Math.min(wrapRect.width,window.innerWidth-Math.max(0,wrapRect.left))}px`;
    floating.style.top='0px';
    floatingTable.style.transform=`translateX(${-wrap.scrollLeft}px)`;
  };

  updateContractStickyHeader=update;
  wrap.onscroll=update;

  if(window.__contractStickyScrollHandler){
    window.removeEventListener('scroll',window.__contractStickyScrollHandler);
    window.removeEventListener('resize',window.__contractStickyScrollHandler);
  }
  window.__contractStickyScrollHandler=update;
  window.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',update,{passive:true});

  requestAnimationFrame(()=>{
    syncColumnWidths();
    update();
  });
}

function render(){
  const data=filtered(), notes=notificationItems(data);
  renderDataCheck(data);
  renderTasks();
  renderTenantIssueReports();
  renderNotificationFilters(notes);
  const visibleNotifications=filteredNotificationItems(notes);
  const objectPageData=filteredObjectsForPage(data);
  const contractPageData=filteredContractsForPage(data);
  renderObjectFilters(data);
  renderContractFilters(data);
  renderCharts(data);
  el('totalObjects').textContent=data.length;
  el('urgentCount').textContent=notes.filter(n=>n.sev==='danger').length;
  el('contractSoon').textContent=data.filter(r=>{const d=r.contract_timeline?.noticeDays; return !r.contract_opgezegd && !r.contract_onbepaalde && d!==null && d>=0 && d<=365;}).length;
  if(el('maintenanceSoon')) el('maintenanceSoon').textContent=data.filter(r=>{const d=daysUntil(r.scope_inspectie_geldig_tot); return d!==null && d<=90;}).length;
  if(el('energySoon')) el('energySoon').textContent=data.filter(r=>{const d=daysUntil(r.energielabel_geldig_tot); return r.energielabel_verplicht&&d!==null&&d<=180;}).length;
  if(el('vacancyCount')) el('vacancyCount').textContent=data.filter(r=>String(r.status||'').toLowerCase().includes('leeg') || r.huurder==='-').length;
  if(el('dataCheckIssuesCount')) el('dataCheckIssuesCount').textContent=dataCheckReports(data).filter(report=>report.tone!=='ok').length;
  if(el('openTaskCount')) el('openTaskCount').textContent=rawTasks.filter(task=>task.status!=='Afgerond').length;
  if(el('tenantIssueCount')) el('tenantIssueCount').textContent=rawTenantIssueReports.filter(report=>report.status==='Nieuw').length;
  if(el('tenantReportTabCount')) el('tenantReportTabCount').textContent=rawTenantIssueReports.filter(report=>report.status==='Nieuw').length;
  const dashboardAttentionLimit=6;
  const dashboardAttentionHtml=notes.slice(0,dashboardAttentionLimit).map(actionHtml).join('');
  const dashboardAttentionMore=notes.length>dashboardAttentionLimit
    ? `<div class="dashboardAttentionFooter"><span>${notes.length-dashboardAttentionLimit} extra openstaande melding${notes.length-dashboardAttentionLimit===1?'':'en'}</span><button type="button" class="dashboardAttentionAllBtn">Bekijk alle ${notes.length}</button></div>`
    : '';
  el('attentionList').innerHTML=dashboardAttentionHtml
    ? dashboardAttentionHtml+dashboardAttentionMore
    : '<div class="professionalEmptyState"><strong>Alles is bijgewerkt</strong><span>Er zijn op dit moment geen openstaande aandachtspunten.</span></div>';
  updateProfessionalDashboardSummary(notes);
  updateSimpleSmartDashboard(notes);
  el('notificationList').innerHTML=visibleNotifications.map(actionHtml).join('') || '<p>Geen meldingen gevonden voor dit onderwerp.</p>';
  updateNotificationCenterBell(notes);
  if(el('notificationCenterModal')&&!el('notificationCenterModal').classList.contains('hidden')) renderNotificationCenter();
  el('objectGrid').innerHTML=objectPageData.map(r=>`<article class="objectCard premiumObjectCard"><div class="objectCardHeader"><div class="objectCardTitleWrap"><h3>${escHtml(r.object)}</h3><div class="meta">${escHtml([r.straatnaam,r.huisnummer,r.stad].filter(Boolean).join(' '))}</div></div><span class="objectTypePill">${escHtml(r.type||'Object')}</span></div><div class="objectCardFacts"><div class="row"><span>Huurder</span><strong>${escHtml(r.huurder)}</strong></div><div class="row"><span>Huur p/m</span><strong>${euro(r.huur_pm)}</strong></div><div class="row"><span>Jaarhuur</span><strong>${euro(r.huur_pj)}</strong></div><div class="row"><span>Bruto rendement</span><strong>${r.bruto_rendement===null?'-':pct(r.bruto_rendement)}</strong></div><div class="row"><span>Contract</span>${statusBadge(r.status_contract)}</div><div class="row"><span>Onderhoud</span>${statusBadge(r.status_scope)}</div></div><div class="objectCardActions"><button class="smallBtn detailBtn primaryObjectAction" data-id="${r.id}">Open object</button><button class="smallBtn issueQrBtn secondaryObjectAction" data-id="${r.id}">QR-code</button><button class="smallBtn editBtn secondaryObjectAction" data-id="${r.id}">Bewerken</button></div></article>`).join('') || '<p class="premiumEmptyState">Geen objecten gevonden.</p>';
  refreshPhotos();
  renderContractOverview(contractPageData);
  renderFinancialPage(data);
  renderAgenda(data);
  el('contractTable').innerHTML=`<tr><th>Object</th><th>Huurder</th><th>Contractstatus</th><th>Startdatum</th><th>Oorspr. einddatum</th><th>Huidige einddatum</th><th>Opzegtermijn</th><th>Uiterste opzegdatum</th><th>Verlenging</th><th>Status opzegmoment</th><th></th></tr>`+contractPageData.map(r=>{
    const originalEnd=r.contract_onbepaalde?'Onbepaalde tijd':dateFmt(r.oorspronkelijke_einddatum_contract);
    const renewalCount=r.aantal_verlengingen?`<span class="subtle">${r.aantal_verlengingen}× toegepast</span>`:'';
    const mismatch=r.opzegdatum_afwijking?`<span class="contractWarning">Wijkt af van berekende datum</span>`:'';
    const hasContract=Boolean(r.contract?.id);
    return `<tr><td><strong>${r.object}</strong><span class="subtle">${r.straatnaam} ${r.huisnummer}</span></td><td>${r.huurder}</td><td>${statusBadge(hasContract?[r.contract_status,r.contract_opgezegd?'warning':'ok']:['Geen contract','danger'])}</td><td>${hasContract?dateFmt(r.startdatum_contract):'-'}</td><td>${hasContract?originalEnd:'-'}</td><td>${hasContract?contractEndDisplay(r):'-'}${hasContract?renewalCount:''}</td><td>${hasContract?contractPeriodText(r):'-'}</td><td>${hasContract?(r.contract_onbepaalde?'Niet van toepassing':dateFmt(r.opzegdatum))+mismatch:'-'}</td><td>${hasContract?renewalText(r):'-'}</td><td>${statusBadge(hasContract?r.status_opzeg:['Geen contract','danger'])}</td><td><button class="miniLink detailBtn" data-id="${r.id}">Open object</button></td></tr>`;
  }).join('');
  setupContractStickyHeader();
  if(el('maintenanceOverview')) renderMaintenanceOverview(data);
  renderInspections(data);
}
function maintenanceHistoryHtml(r){
  const rows=(r.maintenance_history||[]).map(m=>`<tr><td>${m.maintenance_type||m.title||'-'}</td><td>${m.build_year||'-'}</td><td>${maintenanceDateFmt(m.done_date||m.planned_date)}</td><td>${maintenanceDateFmt(m.planned_date)}</td><td>${m.supplier||'-'}</td><td>${maintenanceStatusLabel(m.status)}</td><td>${euro(m.cost||0)}</td><td><button class="miniLink editMaintBtn" data-key="${rawMaintenanceHistory.some(h=>h.id===m.id)?'history':'maintenance'}:${m.id}">Bewerk</button> <button class="miniLink deleteHistBtn" data-id="${m.id}">Verwijder</button></td></tr>`).join('');
  const table = rows ? `<table><tr><th>Type</th><th>Bouwjaar</th><th>Gedaan</th><th>Planning</th><th>Partij</th><th>Status</th><th>Kosten</th><th></th></tr>${rows}</table>` : '<p class="empty">Nog geen onderhoudshistorie.</p>';
  const form = `<div class="historyForm"><h4>Onderhoudsregel toevoegen</h4><div class="formGrid"><label>Type<select id="histType"><option>Airco</option><option>CV-Installatie</option><option>Brandbeveiliging</option><option>Alarm installatie</option><option>Overheaddeur</option><option>Schilderwerk</option><option>Gevelreiniging</option><option>Onkruid</option><option>Scope-inspectie</option><option>Overig</option></select></label><label>Bouwjaar<input id="histBuildYear" type="number"></label><label>Gedaan<input id="histDoneDate" type="date"></label><label>Planning<input id="histPlannedDate" type="date"></label><label>Partij<input id="histSupplier"></label><label>Status<select id="histStatus"><option>Te plannen</option><option>Gepland</option><option>Afgerond</option></select></label><label>Kosten<input id="histCost" type="number" step="0.01"></label></div><label>Beschrijving<textarea id="histDescription" rows="2"></textarea></label><button class="smallBtn addHistBtn" data-id="${r.id}">Onderhoudsregel toevoegen</button><p id="historyMessage" class="formMessage"></p></div>`;
  return form + table;
}
async function addMaintenanceHistory(propertyId){
  const msg=el('historyMessage'); if(msg) msg.textContent='Bezig met opslaan...';
  const r=vastgoedData.find(x=>x.id===propertyId);
  const payload={property_id:propertyId, property_name:r?.object||null, property_address:r?.straatnaam||null, house_number:r?.huisnummer||null, tenant_name:r?.huurder||null, maintenance_type:el('histType').value, build_year:numOrNull(el('histBuildYear').value), done_date:el('histDoneDate').value||null, planned_date:el('histPlannedDate').value||null, supplier:el('histSupplier').value||null, status:el('histStatus').value||'Te plannen', cost:numOrNull(el('histCost').value), description:el('histDescription').value||null};
  const res=await sb.from('property_maintenance_history').insert(payload);
  if(res.error){ if(msg) msg.textContent=res.error.message; return; }
  await loadData(); renderDetail(propertyId);
}
async function deleteMaintenanceHistory(id){
  if(!confirm('Onderhoudsregel verwijderen?')) return;
  const res=await sb.from('property_maintenance_history').delete().eq('id',id);
  if(res.error){ alert(res.error.message); return; }
  await loadData(); if(selectedPropertyId) renderDetail(selectedPropertyId);
}

function documentListHtml(r){
  const docs = r.documenten || [];
  const rows = docs.map(d=>`<div class="docItem"><div><strong>${d.name || 'Document'}</strong><span>${d.document_type || 'Overig'} · ${dateFmt(d.created_at)}</span></div><div class="docActions"><button class="miniLink openDocBtn" data-path="${d.storage_path}">Open</button><button class="miniLink deleteDocBtn" data-id="${d.id}" data-path="${d.storage_path}">Verwijder</button></div></div>`).join('');
  return `<div class="docUpload"><div class="formGrid"><label>Type document<select id="documentType"><option>Huurcontract</option><option>Energielabel</option><option>Inspectierapport</option><option>Factuur</option><option>Foto</option><option>Vergunning</option><option>Overig</option></select></label><label>Bestand<input id="documentFile" type="file"></label></div><button class="smallBtn uploadDocBtn" data-id="${r.id}">Document uploaden</button><p id="documentMessage" class="formMessage"></p></div><div class="docList">${rows || '<p class="empty">Nog geen documenten toegevoegd.</p>'}</div>`;
}
async function uploadDocument(propertyId){
  const fileInput=el('documentFile');
  const msg=el('documentMessage');
  const file=fileInput?.files?.[0];
  if(!file){ msg.textContent='Kies eerst een bestand.'; return; }
  msg.textContent='Bezig met uploaden...';
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=`${propertyId}/${Date.now()}-${safeName}`;
  const up=await sb.storage.from('property-documents').upload(path,file,{upsert:false});
  if(up.error){ msg.textContent=up.error.message; return; }
  const ins=await sb.from('property_documents').insert({property_id:propertyId,name:file.name,document_type:el('documentType').value,storage_path:path,file_size:file.size,mime_type:file.type}).select().single();
  if(ins.error){ msg.textContent=ins.error.message; return; }
  await loadData();
  renderDetail(propertyId);
}
async function openDocument(path){
  const res=await sb.storage.from('property-documents').createSignedUrl(path,60*10);
  if(res.error){ alert(res.error.message); return; }
  window.open(res.data.signedUrl,'_blank');
}
async function deleteDocument(id,path){
  if(!confirm('Document verwijderen?')) return;
  await sb.storage.from('property-documents').remove([path]);
  const res=await sb.from('property_documents').delete().eq('id',id);
  if(res.error){ alert(res.error.message); return; }
  await loadData();
  if(selectedPropertyId) renderDetail(selectedPropertyId);
}

function normalizedInspectionType(value){
  return norm(value).replace(/[^a-z0-9]+/g,'');
}
function inspectionsForProperty(propertyId,type){
  const wanted=normalizedInspectionType(type);
  return rawInspections
    .filter(row=>row.property_id===propertyId&&normalizedInspectionType(row.inspection_type)===wanted)
    .sort((a,b)=>{
      const aDate=inspectionDeadline(a)||a.inspection_date||'';
      const bDate=inspectionDeadline(b)||b.inspection_date||'';
      return String(bDate).localeCompare(String(aDate));
    });
}
function objectInspectionSummary(propertyId,type){
  const row=inspectionsForProperty(propertyId,type)[0];
  if(row){
    const status=inspectionDisplayStatus(row);
    return {
      date:dateFmt(inspectionDeadline(row)||row.inspection_date),
      status:[status,inspectionStatusClass(status)]
    };
  }

  // Bestaande SCOPE 10-datum uit de objectentabel blijft zichtbaar
  // totdat deze als keuring is gesynchroniseerd.
  if(normalizedInspectionType(type)===normalizedInspectionType('SCOPE 10')){
    const property=getPropertyById(propertyId);
    const legacyDate=property?.scope_valid_until||property?.property?.scope_valid_until||null;
    if(legacyDate){
      const days=daysUntil(legacyDate);
      const status=days<0?'Verlopen':days<=90?'Verloopt binnenkort':'Geldig';
      return {date:dateFmt(legacyDate),status:[status,inspectionStatusClass(status)]};
    }
  }

  return {date:'-',status:['Niet geregistreerd','warning']};
}

function renderDetail(id){
  selectedPropertyId=id; const r=vastgoedData.find(x=>x.id===id); if(!r){ el('detailContent').innerHTML='<p>Object niet gevonden.</p>'; return; }
  const scope10=objectInspectionSummary(r.id,'SCOPE 10');
  const scope12=objectInspectionSummary(r.id,'SCOPE 12');
  el('detailContent').innerHTML=`<div class="detailHero"><div class="detailHeroTop"><div><h2>${r.object}</h2><p class="meta">${[r.straatnaam,r.huisnummer,r.postcode,r.stad].filter(Boolean).join(' ')} • ${r.type} • ${r.status}</p></div><div class="detailActions"><button class="secondaryBtn issueQrBtn" data-id="${r.id}">QR-code melding</button><button class="secondaryBtn editBtn" data-id="${r.id}">Bewerken</button></div></div></div><div class="detailGrid"><section class="detailSection"><h3>Algemeen</h3>${kv('Adres',`${r.straatnaam} ${r.huisnummer}`)}${kv('Postcode',r.postcode||'-')}${kv('Stad',r.stad)}${kv('Type',r.type)}${kv('Status',r.status)}${kv('Energielabel verplicht',r.energielabel_verplicht?'Ja':'Nee')}${kv('Energielabel',r.energielabel_verplicht?r.energielabel:'Niet verplicht')}${kv('Energielabel geldig tot',r.energielabel_verplicht?dateFmt(r.energielabel_geldig_tot):'-')}${kv('Status energielabel',statusBadge(r.status_energy))}${kv('SCOPE 10 geldig / volgende',scope10.date)}${kv('Status SCOPE 10',statusBadge(scope10.status))}${kv('SCOPE 12 geldig / volgende',scope12.date)}${kv('Status SCOPE 12',statusBadge(scope12.status))}</section><section class="detailSection"><h3>Financieel</h3>${kv('Maandhuur',euro(r.huur_pm))}${kv('Jaarhuur',euro(r.huur_pj))}${kv('Servicekosten',euro(r.servicekosten))}${kv('Energiekosten',euro(r.energiekosten))}${kv('Waarborgsom',euro(r.waarborgsom))}${kv('Concerngarantie',euro(r.concerngarantie))}${kv('Bankgarantie',euro(r.bankgarantie))}${kv('Aankoopwaarde',euro(r.aankoopwaarde))}${kv('WOZ-waarde',euro(r.woz_waarde))}${kv('Hypotheekschuld',euro(r.hypotheek))}${kv('Overwaarde',euro(r.overwaarde))}${kv('Hypotheekrente',r.hypotheekrente?`${String(r.hypotheekrente).replace('.', ',')}%`:'-')}${kv('Aankoopdatum',dateFmt(r.aankoopdatum))}${kv('Bruto rendement',r.bruto_rendement===null?'-':pct(r.bruto_rendement))}${kv('Huurverhoging',r.maand_huurverhoging||'-')}</section><section class="detailSection"><h3>Huurder</h3>${r.huurder==='-'?'<p class="empty">Geen huurder gekoppeld.</p>':`${kv('Naam',r.huurder)}${kv('E-mail',r.email||'-')}${kv('Telefoon',r.telefoon||'-')}`}</section><section class="detailSection"><h3>Correspondentie / factuur</h3>${(r.factuur_naam||r.factuur_adres||r.factuur_huisnummer||r.factuur_postcode||r.factuur_stad)?`${kv('Ontvanger',r.factuur_naam||r.huurder||'-')}${kv('Adres',[r.factuur_adres||r.straatnaam,r.factuur_huisnummer||r.huisnummer].filter(Boolean).join(' ')||'-')}${kv('Postcode en plaats',[r.factuur_postcode||r.postcode,r.factuur_stad||r.stad].filter(Boolean).join(' ')||'-')}`:'<p class="empty">De huurder en het adres van het gehuurde object worden gebruikt.</p>'}</section><section class="detailSection"><h3>Contract</h3>${kv('Contractstatus',statusBadge([r.contract_status,r.contract_opgezegd?'warning':'ok']))}${kv('Startdatum',dateFmt(r.startdatum_contract))}${kv('Oorspronkelijke einddatum',r.contract_onbepaalde?'Onbepaalde tijd':dateFmt(r.oorspronkelijke_einddatum_contract))}${r.aantal_verlengingen?kv('Huidige einddatum',dateFmt(r.einddatum_contract)):''}${kv('Opzegtermijn',contractPeriodText(r))}${kv('Uiterste opzegdatum',r.contract_onbepaalde?'Niet van toepassing':dateFmt(r.opzegdatum))}${kv('Verlenging bij niet-opzeggen',renewalText(r))}${r.aantal_verlengingen?kv('Verlengingen toegepast',`${r.aantal_verlengingen}×`):''}${kv('Status contract',statusBadge(r.status_contract))}${kv('Status opzegmoment',statusBadge(r.status_opzeg))}${r.opzegdatum_afwijking?`<div class="contractDetailNotice"><strong>Controle nodig</strong>De ingevoerde opzegdatum wijkt af van ${r.opzegtermijn_maanden} maanden vóór de oorspronkelijke einddatum. Berekende datum: ${dateFmt(r.contract_timeline.calculatedInitialNotice)}.</div>`:''}${r.aantal_verlengingen?`<div class="contractDetailNotice warning"><strong>Automatische verlenging</strong>Het oorspronkelijke opzegmoment is verstreken. Het contract is ${r.aantal_verlengingen}× met ${r.verlenging_jaren} jaar verlengd. De huidige einddatum is ${dateFmt(r.einddatum_contract)}${r.contract_opgezegd?'. Het contract is binnen deze verlengde periode opgezegd.':` en de volgende uiterste opzegdatum is ${dateFmt(r.opzegdatum)}.`}</div>`:''}</section><section class="detailSection fullSpan"><h3>Huurdersmeldingen</h3>${tenantReportsForPropertyHtml(r.id)}</section><section class="detailSection fullSpan"><h3>Taken</h3>${taskListForPropertyHtml(r.id)}</section><section class="detailSection fullSpan"><h3>Documenten</h3>${documentListHtml(r)}</section><section class="detailSection fullSpan"><h3>Onderhoudshistorie</h3>${maintenanceHistoryHtml(r)}</section></div>`;
  setPage('detail', r.object);
  refreshPhotos();
}
function kv(label,value){return `<div class="kv"><span>${label}</span><strong>${value}</strong></div>`}
function openNewProperty(){ selectedPropertyId=null; el('modalTitle').textContent='Nieuw object'; el('propertyForm').reset(); ['propertyId','tenantId','contractId','maintenanceId'].forEach(id=>el(id).value=''); el('propertyStatus').value='Actief'; el('contractStatus').value='Actief'; if(el('contractNoticePeriodMonths')) el('contractNoticePeriodMonths').value='12'; if(el('contractNoticeDate')) el('contractNoticeDate').dataset.autoCalculated='true'; if(el('contractRenewalPeriodYears')) el('contractRenewalPeriodYears').value=''; el('maintenanceStatus').value='Te plannen'; el('maintenancePriority').value='Normaal'; el('deletePropertyBtn').classList.add('hidden'); el('formMessage').textContent=''; el('propertyModal').classList.remove('hidden'); }
function updateEnergyLabelRequirementFields(){
  const required=el('propertyEnergyLabelRequired')?.value!=='Nee';
  const labelInput=el('propertyEnergyLabel');
  const dateInput=el('propertyEnergyValidUntil');
  if(labelInput) labelInput.disabled=!required;
  if(dateInput) dateInput.disabled=!required;
}

function openEditProperty(id){ const r=vastgoedData.find(x=>x.id===id); if(!r)return; const p=r.property,c=r.contract||{},t=r.tenant||{},m=r.maintenance||{}; el('modalTitle').textContent='Object bewerken'; el('propertyId').value=p.id||''; el('tenantId').value=t.id||''; el('contractId').value=c.id||''; el('maintenanceId').value=m.id||''; el('propertyName').value=p.name||''; el('propertyAddress').value=p.address||''; el('propertyHouseNumber').value=p.house_number||''; el('propertyPostalCode').value=p.postal_code||''; el('propertyCity').value=p.city||''; el('propertyBillingName').value=p.billing_name||''; el('propertyBillingAddress').value=p.billing_address||''; el('propertyBillingHouseNumber').value=p.billing_house_number||''; el('propertyBillingPostalCode').value=p.billing_postal_code||''; el('propertyBillingCity').value=p.billing_city||''; el('propertyType').value=p.property_type||''; el('propertyStatus').value=p.status||'Actief'; el('propertyMonthlyRent').value=p.monthly_rent||''; el('propertyYearlyRent').value=p.yearly_rent||''; el('propertyServiceCosts').value=p.service_costs||''; el('propertyEnergyCosts').value=p.energy_costs||''; el('propertyDeposit').value=p.deposit||''; el('propertyCorporateGuarantee').value=p.corporate_guarantee||''; el('propertyBankGuarantee').value=p.bank_guarantee||''; el('propertyEnergyLabelRequired').value=p.energy_label_required===false?'Nee':'Ja'; el('propertyEnergyLabel').value=p.energy_label||''; el('propertyEnergyValidUntil').value=p.energy_label_valid_until||''; updateEnergyLabelRequirementFields(); el('propertyRentIncreaseMonth').value=p.rent_increase_month||'';
  const scope10Inspection=inspectionsForProperty(r.id,'SCOPE 10')[0];
  el('propertyScopeValidUntil').value=inspectionDeadline(scope10Inspection)||p.scope_valid_until||''; if(el('propertyPurchaseValue')) el('propertyPurchaseValue').value=p.purchase_value||''; if(el('propertyWozValue')) el('propertyWozValue').value=p.woz_value||''; if(el('propertyMortgageValue')) el('propertyMortgageValue').value=p.mortgage_value||''; if(el('propertyMortgageInterest')) el('propertyMortgageInterest').value=p.mortgage_interest||''; if(el('propertyPurchaseDate')) el('propertyPurchaseDate').value=p.purchase_date||''; el('tenantName').value=t.name||''; el('tenantEmail').value=t.email||''; el('tenantPhone').value=t.phone||''; el('contractStartDate').value=c.start_date||''; el('contractEndDate').value=c.end_date||''; if(el('contractNoticePeriodMonths')) el('contractNoticePeriodMonths').value=c.notice_period_months??''; el('contractNoticeDate').value=c.notice_date||r.contract_timeline?.calculatedInitialNotice||''; el('contractNoticeDate').dataset.autoCalculated=c.notice_date?'false':'true'; if(el('contractRenewalPeriodYears')) el('contractRenewalPeriodYears').value=c.renewal_period_years??''; el('contractStatus').value=canonicalContractStatus(c.status); el('maintenanceTitle').value=m.title||''; el('maintenancePlannedDate').value=m.planned_date||''; el('maintenanceCost').value=m.cost||''; el('maintenancePriority').value=m.priority||'Normaal'; el('maintenanceStatus').value=maintenanceStatusLabel(m.status); el('maintenanceDescription').value=m.description||''; el('deletePropertyBtn').classList.remove('hidden'); el('formMessage').textContent=''; el('propertyModal').classList.remove('hidden'); }
window.openEditProperty=openEditProperty;
function closeModal(){ el('propertyModal').classList.add('hidden'); }
const numOrNull=v=>v===''||v===null?null:Number(v);
async function upsertEntity(table,id,payload){ if(id) return sb.from(table).update(payload).eq('id',id).select().single(); return sb.from(table).insert(payload).select().single(); }

async function syncPropertyInspection(propertyId,inspectionType,validUntil){
  const normalizedDate=validUntil||null;
  const normalizedType=normalizedInspectionType(inspectionType);

  const lookup=await sb
    .from('property_inspections')
    .select('*')
    .eq('property_id',propertyId);

  if(lookup.error) throw lookup.error;

  const matchingRows=(lookup.data||[])
    .filter(row=>normalizedInspectionType(row.inspection_type)===normalizedType)
    .sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));

  const primary=matchingRows[0]||null;
  const duplicates=matchingRows.slice(1);
  const payload={
    property_id:propertyId,
    inspection_type:inspectionType,
    valid_until:normalizedDate,
    next_inspection_date:null,
    status:normalizedDate?'Geldig':'Nog te plannen',
    updated_at:new Date().toISOString()
  };

  let savedRow=null;

  if(primary){
    const updated=await sb
      .from('property_inspections')
      .update(payload)
      .eq('id',primary.id)
      .select('*')
      .single();

    if(updated.error) throw updated.error;
    savedRow=updated.data;
  }else if(normalizedDate){
    const inserted=await sb
      .from('property_inspections')
      .insert(payload)
      .select('*')
      .single();

    if(inserted.error) throw inserted.error;
    savedRow=inserted.data;
  }

  if(duplicates.length){
    const duplicateIds=duplicates.map(row=>row.id).filter(Boolean);
    const removed=await sb
      .from('property_inspections')
      .delete()
      .in('id',duplicateIds);

    if(removed.error) throw removed.error;
  }

  rawInspections=rawInspections.filter(row=>
    !(row.property_id===propertyId&&normalizedInspectionType(row.inspection_type)===normalizedType)
  );
  if(savedRow) rawInspections.push(savedRow);

  return savedRow;
}

async function syncScope10InspectionFromProperty(propertyId,validUntil){
  return syncPropertyInspection(propertyId,'SCOPE 10',validUntil);
}

function syncYearlyRentFromMonthly(){
  const monthlyInput=el('propertyMonthlyRent');
  const yearlyInput=el('propertyYearlyRent');
  if(!monthlyInput||!yearlyInput) return;

  const monthly=Number(String(monthlyInput.value).replace(',','.'));
  if(!Number.isFinite(monthly)){
    yearlyInput.value='';
    return;
  }

  yearlyInput.value=(monthly*12).toFixed(2).replace(/\.00$/,'');
}

async function saveProperty(e){
  e.preventDefault();
  syncYearlyRentFromMonthly(); el('formMessage').textContent='Bezig met opslaan...';
  const propertyId=el('propertyId').value, tenantId=el('tenantId').value, contractId=el('contractId').value, maintenanceId=el('maintenanceId').value;
  const propertyPayload={name:el('propertyName').value,address:el('propertyAddress').value||null,house_number:el('propertyHouseNumber').value||null,postal_code:clean(el('propertyPostalCode').value).toUpperCase()||null,city:el('propertyCity').value||null,billing_name:el('propertyBillingName').value||null,billing_address:el('propertyBillingAddress').value||null,billing_house_number:el('propertyBillingHouseNumber').value||null,billing_postal_code:clean(el('propertyBillingPostalCode').value).toUpperCase()||null,billing_city:el('propertyBillingCity').value||null,property_type:el('propertyType').value||null,status:el('propertyStatus').value||'Actief',monthly_rent:numOrNull(el('propertyMonthlyRent').value),yearly_rent:numOrNull(el('propertyYearlyRent').value),service_costs:numOrNull(el('propertyServiceCosts').value),energy_costs:numOrNull(el('propertyEnergyCosts').value),deposit:numOrNull(el('propertyDeposit').value),corporate_guarantee:numOrNull(el('propertyCorporateGuarantee').value),bank_guarantee:numOrNull(el('propertyBankGuarantee').value),energy_label_required:el('propertyEnergyLabelRequired').value!=='Nee',energy_label:el('propertyEnergyLabel').value||null,energy_label_valid_until:el('propertyEnergyValidUntil').value||null,rent_increase_month:el('propertyRentIncreaseMonth').value||null,scope_valid_until:el('propertyScopeValidUntil').value||null,purchase_value:numOrNull(el('propertyPurchaseValue')?.value||''),woz_value:numOrNull(el('propertyWozValue')?.value||''),mortgage_value:numOrNull(el('propertyMortgageValue')?.value||''),mortgage_interest:numOrNull(el('propertyMortgageInterest')?.value||''),purchase_date:el('propertyPurchaseDate')?.value||null};
  const propRes=await upsertEntity('properties',propertyId,propertyPayload); if(propRes.error){el('formMessage').textContent=propRes.error.message;return;} const savedProperty=propRes.data;
  try{
    await syncScope10InspectionFromProperty(savedProperty.id,el('propertyScopeValidUntil').value||null);
  }catch(error){
    el('formMessage').textContent='Object is opgeslagen, maar SCOPE 10 kon niet worden bijgewerkt: '+error.message;
    return;
  }
  let savedTenant=null; if(el('tenantName').value.trim()){ const tenantPayload={name:el('tenantName').value.trim(),email:el('tenantEmail').value||null,phone:el('tenantPhone').value||null}; const tenRes=await upsertEntity('tenants',tenantId,tenantPayload); if(tenRes.error){el('formMessage').textContent=tenRes.error.message;return;} savedTenant=tenRes.data; }
  if(el('contractStartDate').value || el('contractEndDate').value || el('contractNoticeDate').value || savedTenant){
    const endDate=el('contractEndDate').value||null;
    const noticeMonths=numOrNull(el('contractNoticePeriodMonths')?.value||'');
    const noticeDate=el('contractNoticeDate').value || (endDate && noticeMonths ? shiftIsoMonths(endDate,-noticeMonths) : null);
    const contractPayload={property_id:savedProperty.id,tenant_id:savedTenant?.id || null,start_date:el('contractStartDate').value||null,end_date:endDate,notice_period_months:noticeMonths,notice_date:noticeDate,renewal_period_years:numOrNull(el('contractRenewalPeriodYears')?.value||''),monthly_rent:numOrNull(el('propertyMonthlyRent').value),status:canonicalContractStatus(el('contractStatus').value)};
    const conRes=await upsertEntity('contracts',contractId,contractPayload);
    if(conRes.error){el('formMessage').textContent=conRes.error.message;return;}
  }
  if(el('maintenanceTitle').value.trim() || el('maintenancePlannedDate').value){ const maintenancePayload={property_id:savedProperty.id,title:el('maintenanceTitle').value.trim()||'Onderhoud',description:el('maintenanceDescription').value||null,planned_date:el('maintenancePlannedDate').value||el('propertyScopeValidUntil').value||null,cost:numOrNull(el('maintenanceCost').value),priority:el('maintenancePriority').value||'Normaal',status:el('maintenanceStatus').value||'Te plannen'}; const mainRes=await upsertEntity('maintenance',maintenanceId,maintenancePayload); if(mainRes.error){el('formMessage').textContent=mainRes.error.message;return;} }
  closeModal();
  selectedPropertyId=savedProperty.id;
  await loadData();
  renderDetail(savedProperty.id);
  if(activeMaintenanceTab==='inspections') renderInspections(filtered());
}
async function deleteProperty(){ const id=el('propertyId').value; if(!id || !confirm('Weet je zeker dat je dit object wilt verwijderen?')) return; const {error}=await sb.from('properties').delete().eq('id',id); if(error){el('formMessage').textContent=error.message;return;} closeModal(); selectedPropertyId=null; await loadData(); setPage('objecten','Objecten'); }
function updateCalculatedNoticeDate(){
  const endInput=el('contractEndDate');
  const periodInput=el('contractNoticePeriodMonths');
  const noticeInput=el('contractNoticeDate');
  if(!endInput || !periodInput || !noticeInput) return;
  const months=numOrNull(periodInput.value);
  const calculated=endInput.value && months ? shiftIsoMonths(endInput.value,-months) : '';
  const mayOverwrite=!noticeInput.value || noticeInput.dataset.autoCalculated==='true';
  if(mayOverwrite){
    noticeInput.value=calculated||'';
    noticeInput.dataset.autoCalculated='true';
  }
}

function ensurePremiumDashboardUi(){
  if(document.getElementById('premiumDashboardStyles')) return;
  const style=document.createElement('style');
  style.id='premiumDashboardStyles';
  style.textContent=`
    :root{
      --ui-bg:#f6f8fb;
      --ui-surface:#ffffff;
      --ui-surface-soft:#f8fafc;
      --ui-border:#e2e8f0;
      --ui-border-strong:#cbd5e1;
      --ui-text:#172033;
      --ui-muted:#64748b;
      --ui-radius:16px;
      --ui-radius-sm:10px;
      --ui-shadow:0 1px 2px rgba(15,23,42,.04),0 10px 28px rgba(15,23,42,.045);
      --ui-shadow-raised:0 18px 50px rgba(15,23,42,.13);
      --ui-focus:#38bdf8;
    }
    html{background:var(--ui-bg)}
    body{background:var(--ui-bg)!important;color:var(--ui-text);line-height:1.45;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
    .main{padding:30px clamp(20px,2.7vw,42px) 42px!important;background:var(--ui-bg);min-height:100vh}
    .main>header{margin-bottom:24px!important;padding-bottom:18px;border-bottom:1px solid var(--ui-border);align-items:flex-end!important}
    #pageTitle{font-size:clamp(27px,2.2vw,36px);line-height:1.08;letter-spacing:-.035em;font-weight:800}
    .main>header p{max-width:720px;line-height:1.5}
    .headerActions{gap:9px!important;align-items:center!important}
    #search{min-height:44px!important;border-color:var(--ui-border-strong)!important;border-radius:11px!important;background:#fff!important;box-shadow:0 1px 2px rgba(15,23,42,.03);transition:border-color .16s ease,box-shadow .16s ease}
    #search:focus{outline:0;border-color:#94a3b8!important;box-shadow:0 0 0 3px rgba(56,189,248,.17)}

    .sidebar{box-shadow:8px 0 28px rgba(15,23,42,.07)}
    .nav,.logoutBtn{transition:background .16s ease,color .16s ease,transform .16s ease!important}
    .nav:hover{transform:translateX(2px)}
    .nav.active{background:rgba(255,255,255,.12)!important;box-shadow:inset 3px 0 0 var(--brand-accent)}
    .sidebar.collapsed .nav:hover{transform:none}

    .page.active{animation:premiumPageIn .16s ease-out}
    @keyframes premiumPageIn{from{opacity:.65;transform:translateY(3px)}to{opacity:1;transform:none}}
    @media(prefers-reduced-motion:reduce){.page.active{animation:none}.nav,button,input,select,textarea{transition:none!important}}

    .card,.panel,.objectCard,.detailHero,.detailSection,.maintenanceObjectCard{
      border:1px solid var(--ui-border)!important;
      border-radius:var(--ui-radius)!important;
      background:var(--ui-surface)!important;
      box-shadow:var(--ui-shadow)!important;
    }
    .panel{padding:20px!important;margin-bottom:18px!important}
    .panel>h2,.dashboardInsights .panel h2{margin:0 0 14px;font-size:17px;line-height:1.25;letter-spacing:-.015em}
    #dashboard>.cards,.contractSummaryCards,.financialSummaryCards,.maintenanceCards{gap:12px!important}
    #dashboard>.cards>.card,.contractSummaryCards>.card,.financialSummaryCards>.card,.maintenanceCards>.card{
      position:relative;padding:19px 20px!important;overflow:hidden;min-height:104px;
    }
    #dashboard>.cards>.card::before,.contractSummaryCards>.card::before,.financialSummaryCards>.card::before,.maintenanceCards>.card::before{
      content:'';position:absolute;left:0;top:17px;bottom:17px;width:3px;border-radius:999px;background:var(--brand-primary);opacity:.75
    }
    .card span{font-size:12px!important;font-weight:700;letter-spacing:.015em;color:var(--ui-muted)!important;margin-bottom:7px!important}
    .card strong{font-size:clamp(25px,2.1vw,31px)!important;line-height:1.08;letter-spacing:-.035em;color:var(--ui-text)}
    .dashboardInsights{gap:12px!important}
    .dashboardInsights .panel{min-height:180px}
    .bigMetric{font-size:38px!important;letter-spacing:-.04em}
    .chartRow{margin:12px 0!important}.bar{height:8px!important;background:#e8edf3!important}.bar span{background:var(--brand-primary)!important}

    .alertList{display:grid;gap:10px}
    .alertList>.alert{margin:0!important}
    .alertList>p,.premiumEmptyState,#objectGrid>p,.empty{
      border:1px dashed var(--ui-border-strong);border-radius:12px;background:var(--ui-surface-soft);color:var(--ui-muted);padding:16px 18px;font-style:normal;line-height:1.5
    }
    .notificationCard{box-shadow:none!important;border-radius:13px!important;padding:15px 16px!important;transition:transform .15s ease,box-shadow .15s ease}
    .notificationCard:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(15,23,42,.07)!important}
    .notificationTitle{font-size:15px!important;line-height:1.35}.notificationText{color:#475569;line-height:1.5}

    button,.headerCsvButton,.financialTab,.maintenanceTab,.rentPropertyTab{
      font-family:inherit;letter-spacing:0;transition:background .15s ease,border-color .15s ease,color .15s ease,box-shadow .15s ease,transform .12s ease
    }
    button:not(:disabled):active,.headerCsvButton:active{transform:translateY(1px)}
    button:focus-visible,.headerCsvButton:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{
      outline:3px solid rgba(56,189,248,.34)!important;outline-offset:2px
    }
    .smallBtn,.secondaryBtn,.backBtn,.miniLink,.notificationAction,.headerCsvButton{
      min-height:39px;border-radius:10px!important;font-size:13px!important;font-weight:750!important
    }
    .smallBtn,.secondaryBtn,.backBtn{
      background:#fff!important;color:var(--ui-text)!important;border:1px solid var(--ui-border-strong)!important;box-shadow:0 1px 1px rgba(15,23,42,.025)
    }
    .smallBtn:hover,.secondaryBtn:hover,.backBtn:hover,.miniLink:hover{background:#f8fafc!important;border-color:#94a3b8!important}
    .miniLink{margin-top:0!important;background:#fff!important;color:var(--ui-text)!important;border:1px solid var(--ui-border-strong)!important;padding:7px 10px!important}
    .dangerBtn{background:#b42318!important;color:#fff!important;border-color:#b42318!important}
    .formActions button[type='submit'],#newPropertyBtn,#newTaskBtn,.primaryObjectAction{
      background:var(--brand-primary)!important;color:#fff!important;border:1px solid var(--brand-primary)!important;box-shadow:0 4px 12px rgba(15,23,42,.12)
    }
    .formActions button[type='submit']:hover,#newPropertyBtn:hover,#newTaskBtn:hover,.primaryObjectAction:hover{filter:brightness(1.08)}
    .headerCsvButton{background:var(--brand-primary)!important;color:#fff!important;border:1px solid var(--brand-primary)!important;box-shadow:0 4px 12px rgba(15,23,42,.1)}
    .headerCsvButton:hover{filter:brightness(1.08)}

    .pageFilters,.maintenanceFilters,.taskFilterBar{
      padding:13px!important;margin:0 0 16px!important;border:1px solid var(--ui-border)!important;border-radius:14px!important;background:#fff!important;box-shadow:0 1px 2px rgba(15,23,42,.025)
    }
    .pageFilters label,.maintenanceFilters label,.taskFilterBar label{font-size:12px!important;color:#475569!important}
    .pageFilters select,.pageFilters input,.maintenanceFilters select,.maintenanceFilters input,.taskFilterBar select,.taskFilterBar input{
      min-height:41px!important;margin-top:5px!important;border:1px solid var(--ui-border-strong)!important;border-radius:9px!important;background:#fff!important;color:var(--ui-text)!important;padding:9px 11px!important
    }
    form input,form textarea,form select{border-color:var(--ui-border-strong)!important;border-radius:10px!important;box-shadow:0 1px 1px rgba(15,23,42,.02)}
    form input:focus,form textarea:focus,form select:focus{border-color:#94a3b8!important;box-shadow:0 0 0 3px rgba(56,189,248,.13);outline:0}
    form h3{font-size:15px!important;letter-spacing:-.01em;color:var(--ui-text);border-top-color:var(--ui-border)!important}

    .contractTablePanel,.financialTablePanel{padding:0!important}
    .contractTableWrap,.financialTableWrap,.notificationLogWrap{border-radius:var(--ui-radius);overflow:auto;background:#fff}
    table{font-variant-numeric:tabular-nums}
    th{padding:13px 14px!important;background:#f8fafc;color:#526174!important;font-size:11px!important;font-weight:800!important;letter-spacing:.045em;text-transform:uppercase;border-bottom:1px solid var(--ui-border)!important;white-space:nowrap}
    td{padding:14px!important;border-bottom:1px solid #edf1f5!important;vertical-align:middle}
    table tr:last-child td{border-bottom:0!important}
    #contractTable tr:not(:first-child):hover td,#rentIncreaseTable tr:not(:first-child):hover td,#serviceCostTable tr:not(:first-child):hover td,.maintenanceObjectTable tr:not(:first-child):hover td,#taskTable tr:not(:first-child):hover td,#dataCheckTable tr:not(:first-child):hover td,#tenantReportTable tr:not(:first-child):hover td{background:#fafbfd}
    #contractTable td:first-child strong{font-size:14px}.subtle{color:var(--ui-muted)!important;line-height:1.35}
    .badge{padding:5px 9px!important;font-size:11px!important;line-height:1.2;white-space:nowrap}

    #objectGrid.grid{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))!important;gap:14px!important}
    .premiumObjectCard{display:flex;flex-direction:column;padding:0!important;overflow:hidden;min-height:390px;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
    .premiumObjectCard:hover{transform:translateY(-2px);border-color:#d2dae5!important;box-shadow:0 2px 4px rgba(15,23,42,.04),0 16px 34px rgba(15,23,42,.07)!important}
    .objectCardHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:19px 19px 15px;border-bottom:1px solid #eef2f6}
    .objectCardTitleWrap{min-width:0}.premiumObjectCard h3{margin:0 0 5px!important;font-size:18px;line-height:1.25;letter-spacing:-.025em}.premiumObjectCard .meta{margin:0!important;font-size:12px;line-height:1.45}
    .objectTypePill{flex:0 0 auto;max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px;border:1px solid #dbe3ec;border-radius:999px;background:#f8fafc;color:#526174;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.045em}
    .objectCardFacts{padding:3px 19px 8px;flex:1}.premiumObjectCard .row{padding:10px 0!important;border-top:1px solid #f0f3f6!important;align-items:center}.premiumObjectCard .row:first-child{border-top:0!important}.premiumObjectCard .row>span:first-child{color:var(--ui-muted);font-size:12px}.premiumObjectCard .row>strong{font-size:13px;text-align:right;overflow-wrap:anywhere}
    .objectCardActions{display:grid;grid-template-columns:minmax(0,1.15fr) auto auto;gap:8px;padding:13px 19px 17px;border-top:1px solid #eef2f6;background:#fbfcfd}
    .objectCardActions .smallBtn{margin:0!important;min-height:40px!important;padding:9px 11px!important}
    .secondaryObjectAction{background:#fff!important}

    .detailHero{padding:23px 24px!important;margin-bottom:14px!important}.detailHeroTop{align-items:center!important}.detailHero h2{font-size:clamp(23px,2vw,30px);letter-spacing:-.035em}.detailHero .meta{margin-bottom:0!important;line-height:1.55}
    .detailGrid{gap:14px!important}.detailSection{padding:20px!important}.detailSection h3{display:flex;align-items:center;gap:8px;margin:0 0 13px!important;padding-bottom:11px;border-bottom:1px solid var(--ui-border);font-size:15px;letter-spacing:-.012em}
    .kv{padding:10px 0!important;border-top:1px solid #f0f3f6!important;align-items:flex-start}.kv:first-of-type{border-top:0!important}.kv span:first-child{font-size:12px;line-height:1.4}.kv strong{text-align:right;font-size:13px;line-height:1.45;overflow-wrap:anywhere}
    .detailSection.fullSpan{overflow-x:auto}
    .contractDetailNotice{border-radius:10px!important}

    .modal{backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
    .modalCard,.tenantReportModalCard,.notificationCenterCardShell{border:1px solid rgba(226,232,240,.9)!important;border-radius:18px!important;box-shadow:var(--ui-shadow-raised)!important}
    .modalHeader{padding-bottom:13px;border-bottom:1px solid var(--ui-border)}
    .modalHeader h2,.tenantReportModalHeader h2{letter-spacing:-.025em}
    .iconBtn,.tenantReportModalClose{display:inline-grid!important;place-items:center!important;width:38px!important;height:38px!important;min-width:38px!important;padding:0!important;border:1px solid var(--ui-border-strong)!important;background:#fff!important;color:var(--ui-text)!important;border-radius:999px!important;box-shadow:0 1px 2px rgba(15,23,42,.05)}
    .tenantReportModalClose span{display:grid;place-items:center}.tenantReportModalClose svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round}
    .tenantReportModalHeader{padding:20px 22px!important}.tenantReportModalBody{padding:20px 22px!important}

    .importSummary span{border:1px solid #e2e8f0;background:#fff!important}
    .docItem{border-radius:11px!important;box-shadow:0 1px 2px rgba(15,23,42,.025)}
    .historyForm,.docUpload{border-style:solid!important;border-color:var(--ui-border)!important;background:#fafbfd!important}

    @media(max-width:1100px){#objectGrid.grid{grid-template-columns:repeat(auto-fill,minmax(280px,1fr))!important}.objectCardActions{grid-template-columns:1fr 1fr}.objectCardActions .primaryObjectAction{grid-column:1/-1}}
    @media(max-width:900px){
      .main{padding:20px 16px 32px!important}.main>header{align-items:stretch!important}.headerActions{display:flex!important;flex-wrap:wrap!important}.headerActions #search{order:10;flex:1 1 100%;margin:6px 0 0!important}
      .sidebar{box-shadow:0 8px 24px rgba(15,23,42,.09)}
      #dashboard>.cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .panel{padding:17px!important}.detailHero{padding:19px!important}.detailSection{padding:17px!important}
      .detailHeroTop{align-items:flex-start!important}
      .pageFilters,.maintenanceFilters,.taskFilterBar{padding:11px!important}
    }
    @media(max-width:620px){
      #dashboard>.cards{grid-template-columns:1fr 1fr!important}.card strong{font-size:25px!important}
      #objectGrid.grid{grid-template-columns:1fr!important}.premiumObjectCard{min-height:0}.objectCardHeader{padding:17px 16px 13px}.objectCardFacts{padding:2px 16px 7px}.objectCardActions{padding:12px 16px 15px}
      .detailActions{display:grid!important;grid-template-columns:1fr 1fr;width:100%}.detailActions button{margin:0!important;width:100%}
      .kv{display:grid!important;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:10px!important}.kv strong{text-align:right}
      th,td{padding:11px!important}
    }
    @media(max-width:430px){#dashboard>.cards{grid-template-columns:1fr!important}.objectCardActions{grid-template-columns:1fr 1fr}.objectCardActions .primaryObjectAction{grid-column:1/-1}.objectTypePill{max-width:38%}.main{padding-left:12px!important;padding-right:12px!important}}
  `;
  document.head.appendChild(style);

  const attentionPanel=el('attentionList')?.closest('.panel');
  if(attentionPanel){
    const heading=attentionPanel.querySelector('h2');
    if(heading&&norm(heading.textContent)==='aandachtspunten') heading.textContent='Actie vereist';
    if(!attentionPanel.querySelector('.premiumPanelIntro')){
      const intro=document.createElement('p');
      intro.className='premiumPanelIntro';
      intro.textContent='Openstaande acties en belangrijke deadlines die nu aandacht vragen.';
      intro.style.cssText='margin:-7px 0 14px;color:#64748b;font-size:13px;line-height:1.5';
      heading?.insertAdjacentElement('afterend',intro);
    }
    el('attentionList')?.setAttribute('aria-live','polite');
  }
}


const PROFESSIONAL_UX_NAV_ITEMS=[
  {key:'dashboard',labels:['dashboard'],icon:'home'},
  {key:'objecten',labels:['object'],icon:'building'},
  {key:'onderhoud',labels:['onderhoud'],icon:'tool'},
  {key:'meldingen',labels:['melding'],icon:'bell'}
];

function professionalUxIcon(name){
  const icons={
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"></path></svg>',
    building:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V5l10-2v18M5 9h10M5 13h10M5 17h10M15 9h4v12H3"></path></svg>',
    tool:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4.3 4.3 0 0 0-5.6 5.6L4.8 16.2a2.1 2.1 0 1 0 3 3l4.3-4.3a4.3 4.3 0 0 0 5.6-5.6l-2.8 2.8-3-3 2.8-2.8z"></path></svg>',
    bell:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 5 2 5.6 2 7h-15c0-1.4 2-2 2-7z"></path><path d="M9.5 19a2.8 2.8 0 0 0 5 0"></path></svg>',
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5"></path></svg>',
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>'
  };
  return icons[name]||icons.home;
}

function findProfessionalNav(labels){
  return [...document.querySelectorAll('.nav')].find(button=>{
    const text=norm(`${button.dataset.title||''} ${button.textContent||''}`);
    return labels.some(label=>text.includes(norm(label)));
  })||null;
}

function setupProfessionalMobileNav(){
  if(document.getElementById('professionalMobileNav')) return;
  const found=PROFESSIONAL_UX_NAV_ITEMS.map(item=>({...item,source:findProfessionalNav(item.labels)})).filter(item=>item.source);
  if(found.length<3) return;
  const bar=document.createElement('nav');
  bar.id='professionalMobileNav';
  bar.className='professionalMobileNav';
  bar.setAttribute('aria-label','Snelle navigatie');
  bar.innerHTML=found.map(item=>`<button type="button" class="professionalMobileNavBtn" data-mobile-page="${escAttr(item.source.dataset.page||'')}" data-source-page="${escAttr(item.source.dataset.page||'')}"><span class="professionalMobileNavIcon">${professionalUxIcon(item.icon)}</span><span>${escHtml(item.source.dataset.title||item.source.textContent.trim())}</span></button>`).join('');
  document.body.appendChild(bar);
  bar.addEventListener('click',event=>{
    const button=event.target.closest('.professionalMobileNavBtn');
    if(!button) return;
    const source=[...document.querySelectorAll('.nav')].find(nav=>nav.dataset.page===button.dataset.sourcePage);
    source?.click();
  });
}

function syncProfessionalNavigation(pageId){
  document.querySelectorAll('.professionalMobileNavBtn').forEach(button=>{
    const active=button.dataset.mobilePage===pageId;
    button.classList.toggle('active',active);
    button.setAttribute('aria-current',active?'page':'false');
  });
}

function setupProfessionalHeader(){
  const headerActions=document.querySelector('.headerActions');
  const bell=el('dashboardNotificationBell');
  if(headerActions&&bell&&!headerActions.contains(bell)){
    bell.classList.add('dashboardNotificationBell--inline');
    headerActions.prepend(bell);
  }
  const search=el('search');
  if(search){
    if(!search.placeholder||norm(search.placeholder).includes('zoek')) search.placeholder='Zoek object, huurder, adres of plaats…';
    search.setAttribute('aria-label','Zoeken in het dashboard');
    search.title='Zoeken in het dashboard · sneltoets /';
  }
}

function setupProfessionalDashboardCommandBar(){
  const dashboard=el('dashboard');
  if(!dashboard||document.getElementById('professionalDashboardCommandBar')) return;
  const cards=dashboard.querySelector('.cards');
  const bar=document.createElement('section');
  bar.id='professionalDashboardCommandBar';
  bar.className='professionalDashboardCommandBar';
  const now=new Date();
  const dateLabel=new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long'}).format(now);
  bar.innerHTML=`
    <div class="professionalTodayCopy"><span class="professionalEyebrow">Vandaag</span><strong>${escHtml(dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1))}</strong><span id="professionalTodaySummary">Dashboard wordt bijgewerkt…</span></div>
    <div class="professionalQuickActions" aria-label="Snelle acties">
      <button type="button" class="professionalQuickBtn professionalQuickBtn--primary" data-professional-action="new-object"><span>${professionalUxIcon('plus')}</span>Nieuw object</button>
      <button type="button" class="professionalQuickBtn" data-professional-action="new-task"><span>${professionalUxIcon('check')}</span>Nieuwe taak</button>
      <button type="button" class="professionalQuickBtn" data-professional-action="notifications"><span>${professionalUxIcon('bell')}</span>Meldingen</button>
    </div>`;
  if(cards) cards.insertAdjacentElement('afterend',bar);
  else dashboard.prepend(bar);
  bar.addEventListener('click',event=>{
    const button=event.target.closest('[data-professional-action]');
    if(!button) return;
    const action=button.dataset.professionalAction;
    if(action==='new-object') el('newPropertyBtn')?.click();
    if(action==='new-task') el('newTaskBtn')?.click();
    if(action==='notifications') openNotificationCenter({scope:'all'});
  });
}

function updateProfessionalDashboardSummary(notes=[]){
  const summary=el('professionalTodaySummary');
  if(!summary) return;
  const urgent=notes.filter(item=>item.sev==='danger').length;
  const tenants=notes.filter(item=>item.reportId).length;
  if(!notes.length){
    summary.textContent='Geen openstaande acties. Alles staat op orde.';
    summary.className='is-clear';
    return;
  }
  const parts=[];
  if(urgent) parts.push(`${urgent} urgent${urgent===1?'':'e'} actie${urgent===1?'':'s'}`);
  if(tenants) parts.push(`${tenants} huurdersmelding${tenants===1?'':'en'}`);
  const remaining=Math.max(0,notes.length-urgent-tenants);
  if(remaining) parts.push(`${remaining} overige melding${remaining===1?'':'en'}`);
  summary.textContent=parts.join(' · ');
  summary.className=urgent?'has-urgent':'';
}

function setupInteractiveMetricCard(valueId,handler,label){
  const value=el(valueId);
  const card=value?.closest('.card');
  if(!card||card.dataset.professionalInteractive==='true') return;
  card.dataset.professionalInteractive='true';
  card.classList.add('professionalMetricCard');
  card.tabIndex=0;
  card.setAttribute('role','button');
  card.setAttribute('aria-label',label);
  card.addEventListener('click',handler);
  card.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();handler();}
  });
}

function setupProfessionalMetricCards(){
  setupInteractiveMetricCard('urgentCount',()=>openNotificationCenter({scope:'all'}),'Open urgente meldingen');
  setupInteractiveMetricCard('contractSoon',()=>findProfessionalNav(['contract'])?.click(),'Open contracten');
  setupInteractiveMetricCard('maintenanceSoon',()=>findProfessionalNav(['onderhoud'])?.click(),'Open onderhoud');
  setupInteractiveMetricCard('tenantIssueCount',()=>findProfessionalNav(['melding'])?.click(),'Open huurdersmeldingen');
}

function setupProfessionalKeyboardShortcuts(){
  if(window.__professionalKeyboardShortcutsBound) return;
  window.__professionalKeyboardShortcutsBound=true;
  document.addEventListener('keydown',event=>{
    const target=event.target;
    const typing=target&&(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable);
    if(event.key==='/'&&!typing&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
      event.preventDefault();
      el('search')?.focus();
      return;
    }
    if(event.key==='Escape'){
      if(el('notificationCenterModal')&&!el('notificationCenterModal').classList.contains('hidden')){closeNotificationCenter();return;}
      if(document.activeElement===el('search')&&el('search').value){
        el('search').value='';query='';render();
      }
    }
  });
}

function bindProfessionalDelegatedActions(){
  if(window.__professionalDelegatedActionsBound) return;
  window.__professionalDelegatedActionsBound=true;
  document.body.addEventListener('click',event=>{
    if(event.target.closest('.dashboardAttentionAllBtn')) openNotificationCenter({scope:'all'});
  });
}

function ensureProfessionalUx(){
  if(!document.getElementById('professionalUxStyles')){
    const style=document.createElement('style');
    style.id='professionalUxStyles';
    style.textContent=`
      :root{--pro-control-height:44px;--pro-bottom-nav-height:72px}
      button{font-family:inherit}
      button:not(:disabled){cursor:pointer}
      input:not([type=checkbox]):not([type=radio]),select,textarea{border-radius:10px!important;border-color:#cbd5e1!important;background:#fff!important;color:#172033!important;transition:border-color .14s ease,box-shadow .14s ease!important}
      input:not([type=checkbox]):not([type=radio]),select{min-height:var(--pro-control-height)}
      textarea{min-height:104px;line-height:1.5}
      input:focus,select:focus,textarea:focus{outline:0!important;border-color:#94a3b8!important;box-shadow:0 0 0 3px rgba(56,189,248,.16)!important}
      label{color:#334155;font-weight:700}
      .formActions{gap:9px!important}
      .modalCard .formActions{position:sticky;bottom:0;z-index:4;margin-left:-20px!important;margin-right:-20px!important;margin-bottom:-20px!important;padding:14px 20px 18px!important;border-top:1px solid #e2e8f0;background:rgba(255,255,255,.96);backdrop-filter:blur(8px)}
      .dashboardNotificationBell.dashboardNotificationBell--inline{position:relative!important;right:auto!important;top:auto!important;z-index:auto!important;width:44px!important;height:44px!important;min-width:44px!important;box-shadow:0 1px 2px rgba(15,23,42,.05)!important;order:-2}
      .dashboardNotificationBell--inline .dashboardNotificationBellBadge{right:-5px;top:-6px}
      .professionalDashboardCommandBar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:14px 0 18px;padding:16px 18px;border:1px solid #dce4ed;border-radius:14px;background:linear-gradient(135deg,#fff,#f8fafc);box-shadow:0 1px 2px rgba(15,23,42,.03)}
      .professionalTodayCopy{display:grid;gap:2px;min-width:0}.professionalEyebrow{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#64748b}.professionalTodayCopy>strong{font-size:16px;color:#172033}.professionalTodayCopy>span:last-child{font-size:12px;color:#64748b;line-height:1.4}.professionalTodayCopy>span.has-urgent{color:#b91c1c;font-weight:800}.professionalTodayCopy>span.is-clear{color:#15803d;font-weight:800}
      .professionalQuickActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.professionalQuickBtn{min-height:40px!important;padding:8px 12px!important;display:inline-flex!important;align-items:center;justify-content:center;gap:7px;border:1px solid #cbd5e1!important;border-radius:9px!important;background:#fff!important;color:#172033!important;font-size:12px!important;font-weight:800!important;box-shadow:0 1px 2px rgba(15,23,42,.03)}.professionalQuickBtn>span{display:grid;place-items:center}.professionalQuickBtn svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.professionalQuickBtn--primary{background:var(--brand-primary)!important;border-color:var(--brand-primary)!important;color:#fff!important}.professionalQuickBtn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(15,23,42,.08)}
      .professionalMetricCard{transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease!important}.professionalMetricCard:hover{transform:translateY(-2px);border-color:#cbd5e1!important;box-shadow:0 8px 24px rgba(15,23,42,.075)!important}.professionalMetricCard:focus-visible{outline:3px solid rgba(56,189,248,.45);outline-offset:2px}
      .dashboardAttentionFooter{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;color:#64748b;font-size:12px;font-weight:700}.dashboardAttentionAllBtn{min-height:36px!important;padding:7px 11px!important;border:1px solid #cbd5e1!important;border-radius:8px!important;background:#fff!important;color:#172033!important;font-size:12px!important;font-weight:800!important;white-space:nowrap}
      .professionalEmptyState{display:grid;gap:4px;padding:24px 18px;border:1px dashed #cbd5e1;border-radius:12px;background:#fbfcfd;text-align:center}.professionalEmptyState strong{color:#166534;font-size:14px}.professionalEmptyState span{color:#64748b;font-size:12px}
      .pageFilters,.maintenanceFilters,.taskFilterBar{align-items:flex-end!important}.pageFilters label,.maintenanceFilters label,.taskFilterBar label{font-size:11px!important;color:#526174!important}.clearPageFiltersBtn{min-height:40px!important}
      .objectCardActions .primaryObjectAction{font-weight:850!important}
      .contractTableWrap,.financialTableWrap,.notificationLogWrap,.maintenanceObjectTableWrap{scrollbar-gutter:stable}
      .contractTableWrap::-webkit-scrollbar,.financialTableWrap::-webkit-scrollbar,.notificationLogWrap::-webkit-scrollbar,.maintenanceObjectTableWrap::-webkit-scrollbar{height:10px}.contractTableWrap::-webkit-scrollbar-thumb,.financialTableWrap::-webkit-scrollbar-thumb,.notificationLogWrap::-webkit-scrollbar-thumb,.maintenanceObjectTableWrap::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px;border:2px solid #fff}
      .professionalMobileNav{display:none}
      @media(max-width:900px){
        body{padding-bottom:calc(var(--pro-bottom-nav-height) + env(safe-area-inset-bottom,0px))!important}
        .professionalMobileNav{position:fixed;left:8px;right:8px;bottom:8px;z-index:9990;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;min-height:64px;padding:6px;border:1px solid rgba(203,213,225,.9);border-radius:18px;background:rgba(255,255,255,.96);box-shadow:0 14px 45px rgba(15,23,42,.2);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
        .professionalMobileNavBtn{position:relative;min-width:0!important;min-height:52px!important;padding:5px 4px!important;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0!important;border-radius:13px!important;background:transparent!important;color:#64748b!important;font-size:10px!important;font-weight:800!important;overflow:hidden}.professionalMobileNavBtn.active{background:#f1f5f9!important;color:var(--brand-primary)!important}.professionalMobileNavIcon{display:grid;place-items:center}.professionalMobileNavIcon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.85;stroke-linecap:round;stroke-linejoin:round}
        .professionalDashboardCommandBar{align-items:flex-start;flex-direction:column}.professionalQuickActions{width:100%;display:grid;grid-template-columns:1fr 1fr}.professionalQuickBtn:first-child{grid-column:1/-1}.professionalQuickBtn{width:100%}
        .dashboardAttentionFooter{align-items:flex-start;flex-direction:column}.dashboardAttentionAllBtn{width:100%}
        .modalCard .formActions{padding-bottom:calc(18px + env(safe-area-inset-bottom,0px))!important}
        .dashboardNotificationBell.dashboardNotificationBell--inline{width:42px!important;height:42px!important;min-width:42px!important}
      }
      @media(max-width:520px){
        .professionalDashboardCommandBar{padding:14px}.professionalQuickActions{grid-template-columns:1fr}.professionalQuickBtn:first-child{grid-column:auto}.main>header{gap:12px}.headerActions{width:100%}.headerActions>button:not(.dashboardNotificationBell){flex:1 1 auto}
      }
      @media(prefers-reduced-motion:reduce){.professionalQuickBtn,.professionalMetricCard{transition:none!important}.professionalQuickBtn:hover,.professionalMetricCard:hover{transform:none!important}}
    `;
    document.head.appendChild(style);
  }
  setupProfessionalHeader();
  setupProfessionalDashboardCommandBar();
  setupProfessionalMetricCards();
  setupProfessionalMobileNav();
  setupProfessionalKeyboardShortcuts();
  bindProfessionalDelegatedActions();
  const active=document.querySelector('.page.active');
  if(active?.id) syncProfessionalNavigation(active.id);
}



/* v40.42.8 — Eenvoudige, esthetische en slimme werklaag */
function simpleSmartIcon(name){
  const icons={
    spark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.3 4.2L17.5 9l-4.2 1.3L12 14.5l-1.3-4.2L6.5 9l4.2-1.8L12 3z"></path><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"></path></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19.2 6.8"></path></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3.2 2"></path></svg>',
    tenant:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"></circle><path d="M5.5 19c.8-3.5 3-5.2 6.5-5.2s5.7 1.7 6.5 5.2"></path></svg>',
    contract:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l3 3V20H7z"></path><path d="M14 3.5V7h3M9.5 11h5M9.5 14.5h5"></path></svg>',
    money:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M15.5 8.5h-3.2a3.5 3.5 0 0 0 0 7h3.2M8.5 11h5M8.5 14h4.5"></path></svg>',
    tool:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6.1a4.1 4.1 0 0 0-5.2 5.2L4.7 16a2.1 2.1 0 0 0 3 3l4.6-4.6a4.1 4.1 0 0 0 5.2-5.2l-2.6 2.6-2.7-2.7 2.3-3z"></path></svg>',
    bell:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 5 2 5.6 2 7h-15c0-1.4 2-2 2-7z"></path><path d="M9.5 19a2.8 2.8 0 0 0 5 0"></path></svg>',
    task:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2"></rect><path d="m8.5 11 2 2 4-4M8.5 16h6"></path></svg>',
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 8l4 4-4 4"></path></svg>'
  };
  return icons[name]||icons.spark;
}

function simpleSmartItemIcon(item){
  if(item.reportId) return 'tenant';
  if(item.taskId||item.type==='Taak') return 'task';
  if(item.type==='Huurverhoging') return 'money';
  if(['Onderhoud','Keuring','Energielabel'].includes(item.type)) return 'tool';
  if(['Contract','Contractcontrole','Contractverlenging','Opzegdatum','Opzegging'].includes(item.type)) return 'contract';
  return 'bell';
}

function simpleSmartRank(item){
  let rank=item.sev==='danger'?0:item.sev==='warning'?100:200;
  const title=norm(`${item.title||''} ${item.text||''}`);
  if(item.reportId){
    const report=rawTenantIssueReports.find(row=>row.id===item.reportId);
    if(report?.urgency==='Spoed') rank-=45;
    else if(report?.urgency==='Hoog') rank-=20;
    else rank-=5;
  }
  if(title.includes('vandaag')||title.includes('verlopen')||title.includes('te laat')) rank-=35;
  if(title.includes('binnen 30 dagen')||title.includes('deze maand')) rank-=20;
  if(item.type==='Opzegdatum') rank-=12;
  if(item.type==='Huurverhoging') rank-=8;
  return rank;
}

function simpleSmartLevel(item){
  const text=norm(`${item.title||''} ${item.text||''}`);
  if(item.sev==='danger'||text.includes('vandaag')||text.includes('verlopen')||text.includes('te laat')) return {label:'Nu doen',tone:'danger'};
  if(item.reportId) return {label:'Nieuw',tone:'info'};
  if(item.sev==='warning') return {label:'Binnenkort',tone:'warning'};
  return {label:'Controleren',tone:'neutral'};
}

function simpleSmartObject(item){
  const property=item.objectId?getPropertyById(item.objectId):null;
  return property?.object||'';
}

function simpleSmartPlainTitle(item){
  const object=simpleSmartObject(item);
  const suffix=object?` · ${object}`:'';
  if(item.reportId) return `Bekijk de melding van de huurder${suffix}`;
  if(item.type==='Huurverhoging') return `Bereid de huurverhoging voor${suffix}`;
  if(item.type==='Opzegdatum') return `Controleer of het contract moet worden opgezegd${suffix}`;
  if(item.type==='Opzegging') return `Controleer het opgezegde contract${suffix}`;
  if(item.type==='Contractverlenging') return `Controleer het automatisch verlengde contract${suffix}`;
  if(item.type==='Contract'||item.type==='Contractcontrole') return `Controleer het contract${suffix}`;
  if(item.type==='Onderhoud') return `Plan of controleer het onderhoud${suffix}`;
  if(item.type==='Keuring') return `Plan of controleer de keuring${suffix}`;
  if(item.type==='Energielabel') return `Controleer het energielabel${suffix}`;
  if(item.type==='Leegstand') return `Controleer de leegstand${suffix}`;
  if(item.taskId){
    const task=rawTasks.find(row=>row.id===item.taskId);
    return task?.title?`Doe taak: ${task.title}`:`Open de taak`;
  }
  return item.title||'Controleer deze melding';
}

function simpleSmartPrimaryAction(item){
  if(item.reportId) return `<button type="button" class="simpleSmartPrimary tenantReportOpenBtn" data-report-id="${escAttr(item.reportId)}">Bekijk melding ${simpleSmartIcon('arrow')}</button>`;
  if(item.type==='Huurverhoging'&&item.objectId) return `<button type="button" class="simpleSmartPrimary rentEditBtn" data-id="${escAttr(item.objectId)}">Start huurverhoging ${simpleSmartIcon('arrow')}</button>`;
  if(item.taskId) return `<button type="button" class="simpleSmartPrimary taskEditBtn" data-task-id="${escAttr(item.taskId)}">Open taak ${simpleSmartIcon('arrow')}</button>`;
  if(item.objectId) return `<button type="button" class="simpleSmartPrimary detailBtn" data-id="${escAttr(item.objectId)}">Open object ${simpleSmartIcon('arrow')}</button>`;
  return `<button type="button" class="simpleSmartPrimary" data-simple-smart-all="true">Bekijk meldingen ${simpleSmartIcon('arrow')}</button>`;
}

function simpleSmartSecondaryAction(item){
  if(item.reportId){
    const report=rawTenantIssueReports.find(row=>row.id===item.reportId);
    if(report&&tenantReportIsOpen(report)&&report.status!=='In behandeling') return `<button type="button" class="simpleSmartSecondary tenantReportStartBtn" data-report-id="${escAttr(item.reportId)}">Zet in behandeling</button>`;
    return '';
  }
  if(item.taskId) return '';
  const key=dashboardNotificationKey(item);
  return `<button type="button" class="simpleSmartSecondary simpleSmartTaskBtn" data-notification-key="${escAttr(key)}">Maak taak</button>`;
}

function simpleSmartActionCard(item,index){
  const level=simpleSmartLevel(item);
  const icon=simpleSmartItemIcon(item);
  return `<article class="simpleSmartActionCard simpleSmartActionCard--${level.tone}">
    <div class="simpleSmartStep" aria-hidden="true">${index+1}</div>
    <div class="simpleSmartActionIcon" aria-hidden="true">${simpleSmartIcon(icon)}</div>
    <div class="simpleSmartActionBody">
      <div class="simpleSmartActionMeta"><span class="simpleSmartLevel simpleSmartLevel--${level.tone}">${escHtml(level.label)}</span><span>${escHtml(item.type||'Melding')}</span></div>
      <h3>${escHtml(simpleSmartPlainTitle(item))}</h3>
      <p><strong>Waarom?</strong> ${escHtml(item.text||item.title||'Dit onderdeel vraagt aandacht.')}</p>
      <div class="simpleSmartActionButtons">${simpleSmartPrimaryAction(item)}${simpleSmartSecondaryAction(item)}</div>
    </div>
  </article>`;
}

function simpleSmartDueDate(item){
  const base=new Date(`${isoToday()}T12:00:00`);
  const add=item.sev==='danger'?0:7;
  base.setDate(base.getDate()+add);
  return `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`;
}

function openSimpleSmartTask(notificationKey){
  const item=notificationItems(filtered()).find(row=>dashboardNotificationKey(row)===notificationKey);
  if(!item) return;
  openTaskModal('',item.objectId||'');
  const title=el('taskTitle');
  const priority=el('taskPriority');
  const due=el('taskDueDate');
  const description=el('taskDescription');
  if(title) title.value=simpleSmartPlainTitle(item).replace(/^Doe taak:\s*/,'').slice(0,140);
  if(priority) priority.value=item.sev==='danger'?'Urgent':'Hoog';
  if(due) due.value=simpleSmartDueDate(item);
  if(description) description.value=`Automatisch voorbereid vanuit het dashboard.\n\n${item.title||''}\n${item.text||''}`.trim();
}

function ensureSimpleSmartDashboardUi(){
  if(!document.getElementById('simpleSmartUxStyles')){
    const style=document.createElement('style');
    style.id='simpleSmartUxStyles';
    style.textContent=`
      :root{--simple-bg:#f5f7fa;--simple-card:#fff;--simple-text:#172033;--simple-muted:#667085;--simple-line:#e4e9ef}
      .main{background:var(--simple-bg)!important}
      .page>h1,.main>header h1{letter-spacing:-.035em!important;color:var(--simple-text)!important}
      .panel,.card,.objectCard{border-color:var(--simple-line)!important}
      .panel{box-shadow:0 1px 2px rgba(16,24,40,.025)!important}
      .simpleSmartPanel{margin:0 0 20px;border:1px solid #dce4ed;border-radius:18px;background:#fff;box-shadow:0 8px 28px rgba(16,24,40,.055);overflow:hidden}
      .simpleSmartPanelHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 24px 18px;background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);border-bottom:1px solid #edf1f5}
      .simpleSmartHeading{display:flex;align-items:flex-start;gap:13px}.simpleSmartHeadingIcon{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border-radius:12px;background:#eef6ff;color:#175cd3}.simpleSmartHeadingIcon svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .simpleSmartEyebrow{display:block;margin:0 0 3px;font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:#175cd3}.simpleSmartPanel h2{margin:0;font-size:20px;line-height:1.25;letter-spacing:-.025em;color:#172033}.simpleSmartPanelHeader p{margin:5px 0 0;max-width:680px;color:#667085;font-size:13px;line-height:1.5}
      .simpleSmartAutoBadge{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;padding:8px 10px;border:1px solid #bbdfc7;border-radius:999px;background:#f1fbf4;color:#15703d;font-size:11px;font-weight:850;white-space:nowrap}.simpleSmartAutoBadge svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .simpleSmartActionList{display:grid;gap:10px;padding:16px 18px 18px}.simpleSmartActionCard{display:grid;grid-template-columns:34px 44px minmax(0,1fr);gap:12px;align-items:start;padding:14px;border:1px solid #e4e9ef;border-radius:14px;background:#fff;transition:box-shadow .15s ease,border-color .15s ease,transform .15s ease}.simpleSmartActionCard:hover{border-color:#cfd8e3;box-shadow:0 6px 18px rgba(16,24,40,.06);transform:translateY(-1px)}
      .simpleSmartActionCard--danger{border-left:4px solid #d92d20}.simpleSmartActionCard--warning{border-left:4px solid #f79009}.simpleSmartActionCard--info{border-left:4px solid #2e90fa}.simpleSmartActionCard--neutral{border-left:4px solid #98a2b3}
      .simpleSmartStep{display:grid;place-items:center;width:30px;height:30px;border-radius:999px;background:#172033;color:#fff;font-size:12px;font-weight:900}.simpleSmartActionIcon{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;background:#f2f4f7;color:#344054}.simpleSmartActionIcon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .simpleSmartActionBody{min-width:0}.simpleSmartActionMeta{display:flex;align-items:center;gap:8px;margin-bottom:4px;color:#98a2b3;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.simpleSmartLevel{padding:3px 7px;border-radius:999px;letter-spacing:0;text-transform:none}.simpleSmartLevel--danger{background:#fff1f0;color:#b42318}.simpleSmartLevel--warning{background:#fffaeb;color:#b54708}.simpleSmartLevel--info{background:#eff8ff;color:#175cd3}.simpleSmartLevel--neutral{background:#f2f4f7;color:#475467}
      .simpleSmartActionBody h3{margin:0;color:#172033;font-size:15px;line-height:1.35;letter-spacing:-.012em}.simpleSmartActionBody p{margin:5px 0 0;color:#667085;font-size:12px;line-height:1.5}.simpleSmartActionBody p strong{color:#475467}.simpleSmartActionButtons{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}.simpleSmartPrimary,.simpleSmartSecondary{min-height:38px!important;padding:8px 11px!important;border-radius:9px!important;font-size:11px!important;font-weight:850!important}.simpleSmartPrimary{display:inline-flex!important;align-items:center;gap:7px;border:1px solid var(--brand-primary)!important;background:var(--brand-primary)!important;color:#fff!important}.simpleSmartPrimary svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.simpleSmartSecondary{border:1px solid #d0d5dd!important;background:#fff!important;color:#344054!important}
      .simpleSmartClear{display:grid;place-items:center;gap:8px;padding:28px 18px;text-align:center}.simpleSmartClearIcon{display:grid;place-items:center;width:48px;height:48px;border-radius:999px;background:#ecfdf3;color:#067647}.simpleSmartClearIcon svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}.simpleSmartClear strong{color:#05603a;font-size:16px}.simpleSmartClear span{color:#667085;font-size:12px}
      .simpleSmartAutomation{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;padding:15px 20px;border-top:1px solid #edf1f5;background:#fafbfc}.simpleSmartAutomationTitle{display:flex;align-items:center;gap:8px;color:#344054;font-size:11px;font-weight:900;white-space:nowrap}.simpleSmartAutomationTitle svg{width:17px;height:17px;fill:none;stroke:#175cd3;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.simpleSmartAutomationPills{display:flex;gap:7px;flex-wrap:wrap}.simpleSmartAutomationPill{padding:5px 8px;border:1px solid #e4e7ec;border-radius:999px;background:#fff;color:#667085;font-size:10px;font-weight:750}
      #dashboard>.cards{gap:10px!important}#dashboard>.cards .card{min-height:94px!important;padding:15px!important;border-radius:13px!important;background:#fff!important}#dashboard>.cards .card span{font-size:11px!important;color:#667085!important}#dashboard>.cards .card strong{margin-top:5px!important;font-size:27px!important;letter-spacing:-.04em!important;color:#101828!important}
      .sidebar{box-shadow:1px 0 0 rgba(16,24,40,.06)!important}.nav{border-radius:9px!important;margin:2px 8px!important}.nav.active{box-shadow:inset 3px 0 0 var(--brand-accent)!important}
      .objectCardActions{gap:7px!important}.smallBtn,.miniLink{font-weight:800!important}
      @media(max-width:900px){.simpleSmartPanelHeader{padding:18px;flex-direction:column}.simpleSmartAutoBadge{align-self:flex-start}.simpleSmartActionList{padding:12px}.simpleSmartActionCard{grid-template-columns:30px 38px minmax(0,1fr);padding:12px;gap:9px}.simpleSmartActionIcon{width:38px;height:38px}.simpleSmartAutomation{grid-template-columns:1fr}.simpleSmartAutomationTitle{white-space:normal}.simpleSmartActionButtons{display:grid;grid-template-columns:1fr}.simpleSmartPrimary,.simpleSmartSecondary{width:100%;justify-content:center}.professionalDashboardCommandBar{border-radius:16px!important}}
      @media(max-width:520px){.simpleSmartStep{width:27px;height:27px}.simpleSmartActionCard{grid-template-columns:27px minmax(0,1fr)}.simpleSmartActionIcon{display:none}.simpleSmartPanel h2{font-size:18px}.simpleSmartPanelHeader p{font-size:12px}#dashboard>.cards .card{min-height:82px!important}.simpleSmartAutomationPills{display:grid;grid-template-columns:1fr 1fr}.simpleSmartAutomationPill{text-align:center}}
      @media(prefers-reduced-motion:reduce){.simpleSmartActionCard{transition:none}.simpleSmartActionCard:hover{transform:none}}
    `;
    document.head.appendChild(style);
  }

  const dashboard=el('dashboard');
  if(dashboard&&!document.getElementById('simpleSmartPanel')){
    const panel=document.createElement('section');
    panel.id='simpleSmartPanel';
    panel.className='simpleSmartPanel';
    panel.innerHTML=`
      <header class="simpleSmartPanelHeader">
        <div class="simpleSmartHeading"><span class="simpleSmartHeadingIcon">${simpleSmartIcon('spark')}</span><div><span class="simpleSmartEyebrow">Slim actieplan</span><h2>Wat moet ik nu doen?</h2><p>Het dashboard zet automatisch de belangrijkste acties bovenaan. Je hoeft dus niet zelf alle pagina's te controleren.</p></div></div>
        <span class="simpleSmartAutoBadge">${simpleSmartIcon('check')} Automatisch bijgewerkt</span>
      </header>
      <div id="simpleSmartActionList" class="simpleSmartActionList"></div>
      <div class="simpleSmartAutomation"><div class="simpleSmartAutomationTitle">${simpleSmartIcon('spark')} Automatisch bewaakt</div><div class="simpleSmartAutomationPills"><span class="simpleSmartAutomationPill">Contractdeadlines</span><span class="simpleSmartAutomationPill">Automatische verlengingen</span><span class="simpleSmartAutomationPill">Huurverhogingen</span><span class="simpleSmartAutomationPill">Onderhoud & keuringen</span><span class="simpleSmartAutomationPill">Energielabels</span><span class="simpleSmartAutomationPill">Huurdersmeldingen</span></div></div>`;
    const command=el('professionalDashboardCommandBar');
    if(command) command.insertAdjacentElement('afterend',panel);
    else dashboard.prepend(panel);
  }

  if(!window.__simpleSmartActionsBound){
    window.__simpleSmartActionsBound=true;
    document.body.addEventListener('click',event=>{
      const taskBtn=event.target.closest('.simpleSmartTaskBtn');
      if(taskBtn){event.preventDefault();openSimpleSmartTask(taskBtn.dataset.notificationKey);return;}
      if(event.target.closest('[data-simple-smart-all]')){event.preventDefault();openNotificationCenter({scope:'all'});}
    });
  }

  const attentionPanel=el('attentionList')?.closest('.panel');
  if(attentionPanel){
    const heading=attentionPanel.querySelector('h2');
    if(heading) heading.textContent='Alle aandachtspunten';
    const intro=attentionPanel.querySelector('.premiumPanelIntro');
    if(intro) intro.textContent='Hier vind je de volledige lijst. Bovenaan staat al wat als eerste moet gebeuren.';
  }
}

function updateSimpleSmartDashboard(notes=[]){
  ensureSimpleSmartDashboardUi();
  const target=el('simpleSmartActionList');
  if(!target) return;
  const sorted=[...notes].sort((a,b)=>simpleSmartRank(a)-simpleSmartRank(b));
  const top=sorted.slice(0,3);
  if(!top.length){
    target.innerHTML=`<div class="simpleSmartClear"><span class="simpleSmartClearIcon">${simpleSmartIcon('check')}</span><strong>Je hoeft nu niets te doen</strong><span>Het dashboard blijft deadlines, meldingen en onderhoud automatisch controleren.</span></div>`;
    return;
  }
  target.innerHTML=top.map(simpleSmartActionCard).join('');
}

function init(){
  if(!window.supabase){ el('loginError').textContent='Supabase library niet geladen. Ververs de pagina.'; return; }
  if(!rememberLoginEnabled()) clearPersistedSupabaseSession();
  sb=window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:secureAuthStorage}});
  bindSessionSecurityEvents();
  if(el('rememberLogin')) el('rememberLogin').checked=rememberLoginEnabled();
  initSidebar();
  ensureTenantReportUi();
  ensureNotificationCenterUi();
  ensurePremiumDashboardUi();
  ensureProfessionalUx();
  ensureSimpleSmartDashboardUi();
  document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click',()=>{
    selectedPropertyId=null;
    setPage(btn.dataset.page,btn.dataset.title||btn.textContent.trim());
    if(window.matchMedia('(max-width: 900px)').matches){
      setSidebarCollapsed(true,{persist:false});
    }
  }));
  document.body.addEventListener('click', e=>{
    const detail=e.target.closest('.detailBtn');
    const edit=e.target.closest('.editBtn');
    const upload=e.target.closest('.uploadDocBtn');
    const openDoc=e.target.closest('.openDocBtn');
    const deleteDoc=e.target.closest('.deleteDocBtn');
    const addHist=e.target.closest('.addHistBtn');
    const deleteHist=e.target.closest('.deleteHistBtn');
    const editMaint=e.target.closest('.editMaintBtn');
    const newMaint=e.target.closest('.newMaintBtn');
    const rentEdit=e.target.closest('.rentEditBtn');
    const rentSkip=e.target.closest('.rentSkipBtn');
    const quickLetter=e.target.closest('.rentQuickLetterBtn');
    const serviceEdit=e.target.closest('.serviceCostEditBtn');
    const serviceQuickLetter=e.target.closest('.serviceCostQuickLetterBtn');
    const editInspection=e.target.closest('.editInspectionBtn');
    const deleteInspectionButton=e.target.closest('.deleteInspectionBtn');
    const openInspectionDoc=e.target.closest('.openInspectionDocBtn');
    const dataCheckEdit=e.target.closest('.dataCheckEditBtn');
    const dataCheckResolve=e.target.closest('.dataCheckResolveBtn');
    const dataCheckReset=e.target.closest('.dataCheckResetBtn');
    const taskEdit=e.target.closest('.taskEditBtn');
    const newTaskForObject=e.target.closest('.newTaskForObjectBtn');
    const issueQr=e.target.closest('.issueQrBtn');
    const convertTenantReport=e.target.closest('.convertTenantReportBtn');
    const tenantReportPhoto=e.target.closest('.tenantReportPhotoBtn');
    const tenantReportOpen=e.target.closest('.tenantReportOpenBtn');
    const tenantReportComplete=e.target.closest('.tenantReportCompleteBtn');
    const tenantReportStart=e.target.closest('.tenantReportStartBtn');
    if(taskEdit) openTaskModal(taskEdit.dataset.taskId);
    if(newTaskForObject) openTaskModal('',newTaskForObject.dataset.id||'');
    if(issueQr) openIssueQrModal(issueQr.dataset.id);
    if(convertTenantReport) convertTenantReportToMaintenance(convertTenantReport.dataset.reportId);
    if(tenantReportPhoto) openTenantReportPhoto(tenantReportPhoto.dataset.photoPath);
    if(tenantReportOpen) openTenantReportModal(tenantReportOpen.dataset.reportId);
    if(tenantReportComplete) completeTenantReport(tenantReportComplete.dataset.reportId);
    if(tenantReportStart) startTenantReport(tenantReportStart.dataset.reportId);
    if(detail&&!taskEdit) renderDetail(detail.dataset.id);
    if(edit) openEditProperty(edit.dataset.id);
    if(upload) uploadDocument(upload.dataset.id);
    if(openDoc) openDocument(openDoc.dataset.path);
    if(deleteDoc) deleteDocument(deleteDoc.dataset.id, deleteDoc.dataset.path);
    if(addHist) addMaintenanceHistory(addHist.dataset.id);
    if(deleteHist) deleteMaintenanceHistory(deleteHist.dataset.id);
    if(editMaint){ const row=findMaintenanceRowByKey(editMaint.dataset.key); if(row) openMaintenanceModal('edit', row); }
    if(newMaint) openMaintenanceModal('new', null, newMaint.dataset.id || '');
    if(rentEdit) openRentIncreaseModal(rentEdit.dataset.id,rentEdit.dataset.date);
    if(rentSkip){
      markRentNotIncreased(rentSkip.dataset.id,rentSkip.dataset.date).catch(error=>{
        console.error(error);
        el('financialMessage').textContent='Niet verhogen kon niet worden opgeslagen: '+error.message;
      });
    }
    if(quickLetter){ openRentIncreaseModal(quickLetter.dataset.id,quickLetter.dataset.date); setTimeout(openRentConceptLetter,0); }
    if(serviceEdit) openServiceCostModal(serviceEdit.dataset.id,serviceEdit.dataset.year);
    if(serviceQuickLetter){ openServiceCostModal(serviceQuickLetter.dataset.id,serviceQuickLetter.dataset.year); setTimeout(openServiceCostLetter,0); }
    if(editInspection) openInspectionModal(editInspection.dataset.id);
    if(deleteInspectionButton) deleteInspection(deleteInspectionButton.dataset.id);
    if(openInspectionDoc) openDocument(openInspectionDoc.dataset.path);
    if(dataCheckEdit) openDataCheckField(dataCheckEdit.dataset.id,dataCheckEdit.dataset.checkKey);
    if(dataCheckResolve){
      saveDataCheckOverride(
        dataCheckResolve.dataset.id,
        dataCheckResolve.dataset.checkKey,
        dataCheckResolve.dataset.resolution
      ).catch(error=>{
        console.error(error);
        alert('De keuze kon niet worden opgeslagen: '+error.message);
      });
    }
    if(dataCheckReset){
      deleteDataCheckOverride(dataCheckReset.dataset.overrideId).catch(error=>{
        console.error(error);
        alert('De afhandeling kon niet worden hersteld: '+error.message);
      });
    }
    const newInspectionForObject=e.target.closest('.newInspectionForObjectBtn');
    if(newInspectionForObject) openInspectionModal('',newInspectionForObject.dataset.id||'');
    if(e.target.closest('#newInspectionBtn')) openInspectionModal();
  });
  document.body.addEventListener('click',e=>{
    const clearButton=e.target.closest('.clearPageFiltersBtn');
    if(clearButton) clearPageFilters(clearButton.dataset.filterPage);
  });
  el('loginBtn').addEventListener('click', async()=>{ el('loginError').textContent='Bezig met inloggen...'; const email=el('email').value.trim(); const password=el('password').value; const remember=Boolean(el('rememberLogin')?.checked); try{localStorage.setItem(REMEMBER_LOGIN_KEY,String(remember));}catch(error){} if(!remember) clearPersistedSupabaseSession(); const {data,error}=await sb.auth.signInWithPassword({email,password}); if(error){ el('loginError').textContent='Inloggen mislukt: '+error.message; return;} initializeSessionSecurity(data.session,{freshLogin:true}); el('loginError').textContent=''; showApp(); await loadBranding(); await loadData(); });
  el('password').addEventListener('keydown', e=>{ if(e.key==='Enter') el('loginBtn').click(); });
  el('logoutBtn').addEventListener('click',()=>secureLogout('Je bent veilig uitgelogd.'));
  el('search').addEventListener('input', e=>{ query=e.target.value; render(); });
  document.body.addEventListener('change', e=>{
    if(e.target.id==='notificationTypeFilter'){ notificationTypeFilter=e.target.value; render(); }
    if(e.target.id==='taskStatusFilter'){ taskStatusFilter=e.target.value; render(); }
    if(e.target.id==='taskPriorityFilter'){ taskPriorityFilter=e.target.value; render(); }
    if(e.target.id==='taskObjectFilter'){ taskObjectFilter=e.target.value; render(); }
    if(e.target.id==='taskDateFilter'){ taskDateFilter=e.target.value; render(); }
    if(e.target.classList.contains('taskQuickStatus')) updateTaskStatusQuick(e.target);
    if(e.target.id==='tenantReportStatusFilter'){ tenantReportStatusFilter=e.target.value; render(); }
    if(e.target.id==='tenantReportUrgencyFilter'){ tenantReportUrgencyFilter=e.target.value; render(); }
    if(e.target.id==='tenantReportObjectFilter'){ tenantReportObjectFilter=e.target.value; render(); }
    if(e.target.classList.contains('tenantReportQuickStatus')) updateTenantReportStatus(e.target);
    if(e.target.id==='dataCheckStatusFilter'){ dataCheckStatusFilter=e.target.value; render(); }
    if(e.target.id==='dataCheckGroupFilter'){ dataCheckGroupFilter=e.target.value; render(); }
    if(e.target.id==='objectCityFilter'){ objectCityFilter=e.target.value; render(); }
    if(e.target.id==='objectTypeFilter'){ objectTypeFilter=e.target.value; render(); }
    if(e.target.id==='objectStatusFilter'){ objectStatusFilter=e.target.value; render(); }
    if(e.target.id==='objectOccupancyFilter'){ objectOccupancyFilter=e.target.value; render(); }
    if(e.target.id==='contractCityFilter'){ contractCityFilter=e.target.value; render(); }
    if(e.target.id==='contractStateFilter'){ contractStateFilter=e.target.value; render(); }
    if(e.target.id==='contractDurationFilter'){ contractDurationFilter=e.target.value; render(); }
    if(e.target.id==='contractNoticeFilter'){ contractNoticeFilter=e.target.value; render(); }
    if(e.target.id==='maintenanceObjectFilter'){ maintenanceObjectFilter=e.target.value; render(); }
    if(e.target.id==='maintenanceTypeFilter'){ maintenanceTypeFilter=e.target.value; render(); }
    if(e.target.id==='maintenanceStatusFilter'){ maintenanceStatusFilter=e.target.value; render(); }
    if(e.target.classList.contains('maintenanceQuickStatus')) updateMaintenanceStatusFromOverview(e.target);
    if(e.target.id==='inspectionObjectFilter'){ inspectionObjectFilter=e.target.value; renderInspections(filtered()); }
    if(e.target.id==='inspectionTypeFilter'){ inspectionTypeFilter=e.target.value; renderInspections(filtered()); }
    if(e.target.id==='inspectionStatusFilter'){ inspectionStatusFilter=e.target.value; renderInspections(filtered()); }
    if(e.target.id==='serviceCostYear'){ serviceCostYear=Number(e.target.value); renderServiceCostOverview(filtered()); }
  });
  el('newPropertyBtn').addEventListener('click', openNewProperty);
  el('newTaskBtn')?.addEventListener('click',()=>openTaskModal());
  el('closeIssueQrModalBtn')?.addEventListener('click',closeIssueQrModal);
  el('copyIssueQrBtn')?.addEventListener('click',copyIssueQrLink);
  el('downloadIssueQrBtn')?.addEventListener('click',downloadIssueQr);
  el('printIssueQrBtn')?.addEventListener('click',printIssueQr);
  el('toggleIssueQrBtn')?.addEventListener('click',toggleIssueQr);
  el('regenerateIssueQrBtn')?.addEventListener('click',regenerateIssueQr);
  el('closeTaskModalBtn')?.addEventListener('click',closeTaskModal);
  el('taskForm')?.addEventListener('submit',saveTask);
  el('deleteTaskBtn')?.addEventListener('click',deleteTask);
  const objectCsvInput=el('objectCsvFile');
  if(objectCsvInput){
    objectCsvInput.addEventListener('change', async e=>{
      const file=e.target.files?.[0];
      if(file) await importObjectCsv();
      e.target.value='';
    });
  }
  const maintenanceCsvInput=el('maintenanceCsvFile');
  if(maintenanceCsvInput){
    maintenanceCsvInput.addEventListener('change', async e=>{
      const file=e.target.files?.[0];
      if(file) await importMaintenanceCsv();
      e.target.value='';
    });
  }
  el('contractEndDate')?.addEventListener('change',updateCalculatedNoticeDate);
  el('contractNoticePeriodMonths')?.addEventListener('input',updateCalculatedNoticeDate);
  el('contractNoticeDate')?.addEventListener('input',()=>{ el('contractNoticeDate').dataset.autoCalculated='false'; });
  el('refreshCbsBtn')?.addEventListener('click',()=>loadCbsIndexData(true));
  el('closeRentIncreaseModalBtn')?.addEventListener('click',closeRentIncreaseModal);
  el('rentIncreaseForm')?.addEventListener('submit',saveRentProposal);
  el('rentOldIndex')?.addEventListener('input',updateRentModalCalculation);
  el('rentNewIndex')?.addEventListener('input',updateRentModalCalculation);
  el('rentFinalRent')?.addEventListener('input',()=>{el('rentFinalRent').dataset.autoCalculated='false';});
  el('rentProposalStatus')?.addEventListener('change',updateRentApplyButton);
  el('rentLetterBtn')?.addEventListener('click',openRentConceptLetter);
  el('rentLetterExcelBtn')?.addEventListener('click',downloadRentConceptExcel);
  el('skipRentIncreaseBtn')?.addEventListener('click',skipActiveRentIncrease);
  el('applyRentIncreaseBtn')?.addEventListener('click',applyRentIncrease);
  document.querySelectorAll('.rentPropertyTab').forEach(button=>button.addEventListener('click',()=>setRentPropertyGroup(button.dataset.rentPropertyGroup)));
  document.querySelectorAll('.maintenanceTab').forEach(button=>button.addEventListener('click',()=>setMaintenanceTab(button.dataset.maintenanceTab)));
  document.querySelectorAll('.financialTab').forEach(button=>button.addEventListener('click',()=>setFinancialTab(button.dataset.financialTab)));
  el('agendaPrevBtn')?.addEventListener('click',()=>shiftAgendaMonth(-1));
  el('agendaTodayBtn')?.addEventListener('click',agendaToday);
  el('agendaNextBtn')?.addEventListener('click',()=>shiftAgendaMonth(1));
  el('agendaTypeFilter')?.addEventListener('change',event=>{agendaTypeFilter=event.target.value||'all';renderAgenda(filtered());});
  el('closeServiceCostModalBtn')?.addEventListener('click',closeServiceCostModal);
  el('serviceCostForm')?.addEventListener('submit',saveServiceCostSettlement);
  el('serviceMonthsCharged')?.addEventListener('input',updateServiceCostModalCalculation);
  el('serviceFinalAdvance')?.addEventListener('input',updateServiceCostModalCalculation);
  el('serviceFinalActual')?.addEventListener('input',updateServiceCostModalCalculation);
  el('serviceCostLetterBtn')?.addEventListener('click',openServiceCostLetter);
  el('propertyEnergyLabelRequired')?.addEventListener('change',updateEnergyLabelRequirementFields);
  el('propertyMonthlyRent')?.addEventListener('input',syncYearlyRentFromMonthly);
  el('downloadObjectBackupBtn')?.addEventListener('click',downloadObjectBackup);
  el('backToObjectsBtn').addEventListener('click',()=>{ selectedPropertyId=null; setPage('objecten','Objecten'); });
  el('brandingForm').addEventListener('submit',saveBranding);
  el('resetBrandingBtn').addEventListener('click',resetBranding);
  ['brandingCompanyName','brandingDashboardName','brandingPrimaryColor','brandingAccentColor'].forEach(id=>el(id).addEventListener('input',previewBrandingForm));
  el('notificationSettingsForm')?.addEventListener('submit',saveNotificationSettings);
  el('previewNotificationBtn')?.addEventListener('click',()=>renderNotificationPreview());
  el('testNotificationBtn')?.addEventListener('click',sendNotificationTestMail);
  el('installAppBtn')?.addEventListener('click',requestPwaInstall);
  el('settingsInstallAppBtn')?.addEventListener('click',requestPwaInstall);
  el('pwaReloadBtn')?.addEventListener('click',activatePwaUpdate);
  el('pwaUpdateToastBtn')?.addEventListener('click',activatePwaUpdate);
  el('closeModalBtn').addEventListener('click', closeModal); el('propertyForm').addEventListener('submit', saveProperty); el('deletePropertyBtn').addEventListener('click', deleteProperty); el('closeMaintenanceModalBtn').addEventListener('click', closeMaintenanceModal); el('maintenanceEditForm').addEventListener('submit', saveMaintenanceEdit); el('deleteMaintenanceRowBtn').addEventListener('click', deleteMaintenanceEdit);
  el('closeInspectionModalBtn')?.addEventListener('click',closeInspectionModal);
  el('closeInspectionFormBtn')?.addEventListener('click',closeInspectionModal);
  el('inspectionForm')?.addEventListener('submit',saveInspection);
  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'&&!sessionLogoutInProgress){stopSessionSecurity();clearSessionMeta();showLogin('Je sessie is beëindigd. Log opnieuw in.');}
    if(event==='TOKEN_REFRESHED'&&session) checkSessionSecurity();
  });
  initPwa();
  checkSession();
}
document.addEventListener('DOMContentLoaded', init);
