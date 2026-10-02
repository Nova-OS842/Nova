window.NovaAuth=(()=>{
  const deviceKey='nova-device-id'; const guestBanKey='nova-guest-ban'; let es=null; let statusTimer=null; const subscribers=new Set();
  function deviceId(){let id=localStorage.getItem(deviceKey);if(!id){id=crypto.randomUUID?.()||('dev-'+Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem(deviceKey,id)}return id}
  async function api(path,opts={}){const r=await fetch(path,{credentials:'include',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});let d={};try{d=await r.json()}catch{}if(!r.ok){const e=new Error(d.error||'Request failed');Object.assign(e,d);throw e}return d}
  function online(){return location.protocol!=='file:' && navigator.onLine}
  function setServerStatus(state){const el=document.getElementById('server-status');if(!el)return;el.classList.remove('online','offline','checking');el.classList.add(state);const label=el.querySelector('strong');if(label)label.textContent=state==='online'?'Online':state==='offline'?'Offline':'Checking server...'}
  async function checkServerStatus(){if(!online()){setServerStatus('offline');return false}try{const r=await fetch('/api/status',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error();const d=await r.json();setServerStatus(d.online?'online':'offline');return !!d.online}catch{setServerStatus('offline');return false}}
  function startStatusMonitor(){clearInterval(statusTimer);checkServerStatus();statusTimer=setInterval(checkServerStatus,5000);window.addEventListener('online',checkServerStatus);window.addEventListener('offline',()=>setServerStatus('offline'))}
  function updateLoginClock(){const el=document.getElementById('login-time');if(el)el.textContent=new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}
  function render(){document.getElementById('auth-screen').classList.remove('hidden');document.getElementById('desktop').classList.add('hidden')}
  async function showOS(user,mode='account'){
    window.NovaUser=user; window.NovaAuthMode=mode; window.dispatchEvent(new CustomEvent('nova-auth-mode',{detail:mode}));
    document.getElementById('auth-screen').classList.add('hidden');document.getElementById('desktop').classList.remove('hidden');
    document.getElementById('profile-name').textContent=user.username;
    if(mode==='account') await window.NovaCloud?.sync();
    OS.init(); setTimeout(()=>window.NovaUpdates?.checkAndShow(),650);
    const p=document.querySelector('#profile-chip') || document.querySelector('.profile-chip'); if(p&&!p.dataset.bound){p.dataset.bound='1';p.title='Open your Nova profile';p.onclick=()=>window.NovaDesktop?.toggleProfile()}
  }
  function cachedGuestBan(){try{const raw=localStorage.getItem(guestBanKey);if(!raw)return null;const ban=JSON.parse(raw);if(Number(ban.expiresAt||0)>0&&Number(ban.expiresAt)<=Date.now()){localStorage.removeItem(guestBanKey);return null}return ban}catch{return null}}
  function cacheGuestBan(ban){try{if(ban)localStorage.setItem(guestBanKey,JSON.stringify(ban));else localStorage.removeItem(guestBanKey)}catch{}}
  function localGuest(){const ban=cachedGuestBan();if(ban){const e=document.getElementById('auth-error');if(e)e.textContent=`You are banned from the site because of: ${ban.reason||'Violation of Nova rules.'}`;return false}showOS({username:'Guest',createdAt:Date.now(),deviceId:deviceId()},'guest');return true}
  async function boot(){
    render();
    updateLoginClock(); setInterval(updateLoginClock,30000);
    startStatusMonitor();
    const form=document.getElementById('auth-form');
    const err=document.getElementById('auth-error');
    const guest=document.getElementById('guest-button');
    const dev=document.getElementById('dev-bypass');
    const sw=document.getElementById('auth-switch');
    const submit=document.getElementById('auth-submit');
    const modeEl=document.getElementById('auth-mode');
    const userEl=document.getElementById('auth-user');
    const passEl=document.getElementById('auth-pass');

    const setError=(message,ban=null)=>{if(err){err.textContent='';err.classList.toggle('ban-error',!!ban);if(ban){err.innerHTML=`<div class="ban-alert"><strong>🚫 Access blocked</strong><span>${String(message||'You are banned from the site.').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span>${ban.expiresAt?`<small>Ban expires ${new Date(ban.expiresAt).toLocaleString()}</small>`:''}</div>`}else err.textContent=message||''}};
    const enterGuest=async()=>{setError('');const id=deviceId();try{const d=await api('/api/guest/access',{method:'POST',body:JSON.stringify({deviceId:id})});cacheGuestBan(null);if(!d.ok){setError('Guest mode is unavailable.');return}showOS({username:'Guest',createdAt:Date.now(),deviceId:id},'guest')}catch(x){const ban=cachedGuestBan();if(ban){setError(`You are banned from the site because of: ${ban.reason||'Violation of Nova rules.'}`);return}if(x&&x.message&&/banned from the site/i.test(x.message)){cacheGuestBan({reason:x.message.replace(/^You are banned from the site because of:\s*/i,''),expiresAt:0});setError(x.message);return}if(!online()||/Failed to fetch|NetworkError|fetch/i.test(String(x&&x.message||''))){localGuest();return}setError(x.message||'Guest mode is unavailable.')} };
    const enterDev=async()=>{setError('');const password=prompt('Developer password');if(password===null)return;try{await api('/api/dev/login',{method:'POST',body:JSON.stringify({password})});showOS({username:'Developer',createdAt:Date.now(),deviceId:deviceId()},'dev')}catch(x){setError(x.message||'Developer authorization failed.')}};

    guest?.addEventListener('click',(e)=>{e.preventDefault();enterGuest()});
    dev?.addEventListener('click',(e)=>{e.preventDefault();enterDev()});

    form?.addEventListener('submit',async e=>{
      e.preventDefault();
      if(!userEl||!passEl)return;
      const mode=modeEl?.value==='register'?'register':'login';
      const u=userEl.value.trim(), p=passEl.value;
      setError('');
      if(!u||!p){setError('Enter your username and password.');return}
      if(!online()){setError('The server is offline. Browse as guest is available, but account sign-in requires the Nova server.');return}
      if(submit){submit.disabled=true;submit.classList.add('loading');submit.dataset.originalText=submit.textContent;submit.innerHTML=mode==='login'?'Signing in…':'Creating account…'}
      try{
        const d=await api(mode==='login'?'/api/login':'/api/register',{method:'POST',body:JSON.stringify({username:u,password:p,deviceId:deviceId()})});
        await showOS(d.user,'account');
      }catch(x){
        const msg=x.message||'Unable to reach the Nova server.';
        if(/^You are banned from the site because of:/i.test(msg))setError(msg,{expiresAt:Number(x.expiresAt||0)});else setError(msg);
      }finally{
        if(submit){submit.disabled=false;submit.classList.remove('loading');submit.innerHTML=mode==='login'?'Sign in <span>→</span>':'Create account <span>→</span>'}
      }
    });

    sw?.addEventListener('click',(e)=>{
      e.preventDefault();
      const register=modeEl?.value!=='register';
      if(modeEl)modeEl.value=register?'register':'login';
      const title=document.getElementById('auth-title'), subtitle=document.getElementById('auth-subtitle');
      if(title)title.textContent=register?'Create your Nova account':'Welcome back';
      if(submit)submit.innerHTML=register?'Create account <span>→</span>':'Sign in <span>→</span>';
      if(sw)sw.textContent=register?'I already have an account':'Create a new account';
      if(subtitle)subtitle.textContent=register?'Create an account when the Nova server is available.':'Sign in to sync account features.';
      setError('');
    });

    if(online()){
      try{
        const d=await api('/api/me');
        await showOS(d.user,'account');
        return;
      }catch{}
    }
    const note=document.getElementById('offline-note');
    if(note)note.textContent='Guest mode is available only when the Nova server is offline.';
  }
  function ensureEvents(){
    if(es || !online() || window.NovaAuthMode!=='account') return es;
    es=new EventSource('/api/events');
    es.onmessage=e=>{try{const msg=JSON.parse(e.data);subscribers.forEach(fn=>{try{fn(msg)}catch(err){console.warn('Nova event handler failed',err)}})}catch{}};
    es.onerror=()=>{};
    return es;
  }
  function events(onMessage){
    if(typeof onMessage!=='function' || !online() || window.NovaAuthMode!=='account') return null;
    subscribers.add(onMessage); ensureEvents();
    return {close(){subscribers.delete(onMessage);if(!subscribers.size&&es){es.close();es=null}}};
  }
  return{boot,api,deviceId,events,showOS};
})();

// Keep the taskbar presence badge synchronized with the same server health check.
(function(){
  const oldSet=window.NovaAuth&&window.NovaAuth.__setServerStatus;
})();
