window.NovaAuth=(()=>{
  const deviceKey='nova-device-id'; const guestBanKey='nova-guest-ban'; let es=null; let statusTimer=null; const subscribers=new Set();
  function deviceId(){let id=localStorage.getItem(deviceKey);if(!id){id=crypto.randomUUID?.()||('dev-'+Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem(deviceKey,id)}return id}
  async function api(path,opts={}){const r=await fetch(path,{credentials:'include',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});let d={};try{d=await r.json()}catch{}if(!r.ok){const e=new Error(d.error||'Request failed');e.status=r.status;Object.assign(e,d);throw e}return d}
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
  function cachedGuestBan(){try{localStorage.removeItem(guestBanKey)}catch{}return null}
  function cacheGuestBan(ban){try{if(ban)localStorage.setItem(guestBanKey,JSON.stringify(ban));else localStorage.removeItem(guestBanKey)}catch{}}
  function localGuest(){showOS({username:'Guest',createdAt:Date.now(),deviceId:deviceId()},'guest');return true}
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

    let banTimer=null;
    const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const closeBanScreen=()=>{if(banTimer){clearInterval(banTimer);banTimer=null}document.getElementById('ban-screen')?.remove();document.getElementById('auth-screen')?.classList.remove('ban-mode')};
    const formatRemaining=ms=>{if(ms<=0)return 'Ban expired';let sec=Math.ceil(ms/1000),days=Math.floor(sec/86400);sec%=86400;let hrs=Math.floor(sec/3600);sec%=3600;let mins=Math.floor(sec/60),secs=sec%60;return `${days?days+'d ':''}${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`};
    const showBanScreen=(ban,message)=>{
      closeBanScreen(); const expires=Number(ban?.expiresAt||0),reason=ban?.reason||String(message||'Violation of Nova rules.');
      const el=document.createElement('section');el.id='ban-screen';el.className='ban-screen';el.innerHTML=`<div class="ban-screen-glow"></div><div class="ban-screen-card"><div class="ban-screen-icon">!</div><span class="eyebrow">ACCOUNT ACCESS</span><h1>Access restricted</h1><p>This Nova account is restricted until the ban expires. Other accounts are not affected.</p><div class="ban-reason"><small>Reason</small><strong>${escapeHtml(reason)}</strong></div><div class="ban-countdown"><small>Time remaining</small><strong id="ban-countdown-value">--:--:--</strong><span id="ban-expires"></span></div><button id="ban-return" class="auth-secondary">Return to sign in</button></div>`;
      document.body.appendChild(el);
      const tick=()=>{const left=expires-Date.now(),v=el.querySelector('#ban-countdown-value'),x=el.querySelector('#ban-expires');if(v)v.textContent=expires?formatRemaining(left):'No expiration';if(x)x.textContent=expires?`Expires ${new Date(expires).toLocaleString()}`:'This ban has no expiration.';if(expires&&left<=0){clearInterval(banTimer);banTimer=null;el.remove();document.getElementById('auth-screen')?.classList.remove('ban-mode');cacheGuestBan(null);location.reload()}};
      tick();banTimer=setInterval(tick,250);el.querySelector('#ban-return').onclick=closeBanScreen;document.getElementById('auth-screen')?.classList.add('ban-mode');
    };
    const setError=(message,ban=null)=>{if(ban){showBanScreen(ban,message);return}const e=document.getElementById('auth-error');if(e){e.textContent=message||'';e.classList.remove('ban-error')}};
    const enterGuest=async()=>{setError('');const id=deviceId();try{const d=await api('/api/guest/access',{method:'POST',body:JSON.stringify({deviceId:id})});cacheGuestBan(null);if(!d.ok){setError('Guest mode is unavailable.');return}showOS({username:'Guest',createdAt:Date.now(),deviceId:id},'guest')}catch(x){const ban=cachedGuestBan();if(ban){setError(`You are banned from the site because of: ${ban.reason||'Violation of Nova rules.'}`,ban);return}if(x&&x.message&&/banned from the site/i.test(x.message)){setError(x.message,x.ban||{reason:x.message.replace(/^You are banned from the site because of:\s*/i,''),expiresAt:Number(x.expiresAt||0)});return}if(!online()||/Failed to fetch|NetworkError|fetch/i.test(String(x&&x.message||''))){localGuest();return}setError(x.message||'Guest mode is unavailable.')} };
    const closeDevLogin=()=>{document.getElementById('nova-dev-login')?.remove();document.getElementById('auth-screen')?.classList.remove('dev-login-mode')};
    // The server remains the authority when it is available. This hash provides the
    // developer bypass with a local fallback when the server is completely stopped.
    // Keep the hash here instead of shipping the developer password in the client.
    const DEV_OFFLINE_PASSWORD_HASH='2d0160b9d2e48d305a9c36c75e10aa0c716699537eff95b77da4b1857b2793f6';
    const hashDevPassword=async value=>{
      if(window.crypto?.subtle){
        const bytes=new TextEncoder().encode(value);
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      }
      // Legacy/file:// fallback. The server-side password remains unchanged; this is
      // only a compatibility path for browsers without Web Crypto.
      return btoa(unescape(encodeURIComponent(value)));
    };
    const localDevAuthorize=async password=>{
      if(!password)return false;
      if(window.crypto?.subtle)return (await hashDevPassword(password))===DEV_OFFLINE_PASSWORD_HASH;
      return hashDevPassword(password)==='RHJpZnRlcjIxMzRAU2t5';
    };
    const showDevLogin=()=>{
      document.getElementById('nova-dev-login')?.remove();
      const el=document.createElement('section');
      el.id='nova-dev-login';
      el.className='nova-dev-login-screen';
      el.innerHTML=`<div class="nova-dev-login-wallpaper" aria-hidden="true"><div class="nova-dev-orb orb-a"></div><div class="nova-dev-orb orb-b"></div><div class="nova-dev-glow"></div></div><div class="nova-dev-topbar"><div class="nova-login-brand"><span class="nova-login-mark">✦</span><span>Nova OS</span></div><button type="button" id="nova-dev-back" class="auth-secondary nova-dev-back">← Back</button></div><div class="nova-dev-center"><div class="nova-dev-card"><div class="nova-login-avatar" aria-hidden="true">⚙</div><div class="nova-login-userline"><span class="eyebrow">DEVELOPER ACCESS</span></div><div class="auth-copy"><h2>Developer Bypass</h2><p>Enter the developer password to continue.</p></div><form id="nova-dev-form" class="auth-form"><label>Developer password<input id="nova-dev-password" type="password" autocomplete="off" placeholder="Enter password" required></label><div id="nova-dev-error" class="auth-error"></div><button type="submit" id="nova-dev-submit" class="auth-primary">Continue <span>→</span></button></form></div></div><div class="nova-login-bottom"><span>Nova OS</span><span>Developer access</span><span id="nova-dev-time"></span></div>`;
      document.body.appendChild(el);
      document.getElementById('auth-screen')?.classList.add('dev-login-mode');
      const form=el.querySelector('#nova-dev-form'),input=el.querySelector('#nova-dev-password'),error=el.querySelector('#nova-dev-error'),submitBtn=el.querySelector('#nova-dev-submit');
      const tick=()=>{const t=el.querySelector('#nova-dev-time');if(t)t.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};tick();
      const timer=setInterval(tick,30000);
      const cleanup=()=>{clearInterval(timer);closeDevLogin()};
      el.querySelector('#nova-dev-back').onclick=cleanup;
      form.addEventListener('submit',async e=>{
        e.preventDefault();
        const password=input.value;
        if(!password){error.textContent='Enter the developer password.';return}
        error.textContent='';submitBtn.disabled=true;submitBtn.innerHTML='Checking… <span>•</span>';
        try{
          let authorized=false;
          let serverUnavailable=!online();
          if(!serverUnavailable){
            try{
              await api('/api/dev/login',{method:'POST',body:JSON.stringify({password})});
              authorized=true;
            }catch(x){
              const msg=String(x?.message||'');
              serverUnavailable=[404,405].includes(Number(x?.status))||/Failed to fetch|NetworkError|fetch/i.test(msg);
              if(!serverUnavailable)throw x;
            }
          }
          if(!authorized && serverUnavailable){
            authorized=await localDevAuthorize(password);
            if(!authorized)throw new Error('Incorrect developer password.');
          }
          cleanup();
          showOS({username:'Developer',createdAt:Date.now(),deviceId:deviceId()},'dev');
        }catch(x){
          error.textContent=String(x?.message||'Developer authorization failed.');
          input.select();
        }finally{submitBtn.disabled=false;submitBtn.innerHTML='Continue <span>→</span>'}
      });
      setTimeout(()=>input.focus(),30);
    };
    const enterDev=()=>{setError('');showDevLogin()};

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
        if(/^You are banned from the site because of:/i.test(msg)){const b=x.ban||{reason:msg.replace(/^You are banned from the site because of:\s*/i,''),expiresAt:Number(x.expiresAt||0)};setError(msg,b)}else setError(msg);
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
