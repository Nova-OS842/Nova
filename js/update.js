window.NovaUpdates=(()=>{
  const DISCORD_URL='https://discord.gg/kMhkfseva8';
  const SUPPORT_TEXT='Join the Discord for problems or requests.';
  const UPDATE_LOG={
    title:'Nova OS — Desktop & Media Update',
    text:'Nova Developer Panel adds server-persistent movies and games, developer-only server controls, account blacklist tools, offline-only guest access, and a cleaner desktop with Nova Browser removed.',
    version:'12.0.0'
  };
  const key='nova-update-seen-hash-v4';
  let serverBuild='';let polling=false;
  function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
  function checkAndShow(){const signature=hash(UPDATE_LOG.title+'|'+UPDATE_LOG.text+'|'+UPDATE_LOG.version);if(localStorage.getItem(key)===signature)return;localStorage.setItem(key,signature);show()}
  function show(){
    let old=document.getElementById('nova-update-modal');if(old)old.remove();
    const el=document.createElement('div');
    el.id='nova-update-modal';el.className='update-modal';
    el.innerHTML='<div class="update-card"><div class="update-icon">✦</div><span class="eyebrow">WHAT’S NEW</span><h2></h2><p></p><small></small><div class="update-support"><strong></strong><button type="button" class="discord-button">Join the Discord <span>↗</span></button></div><button class="app-button">Got it</button></div>';
    el.querySelector('h2').textContent=UPDATE_LOG.title;
    el.querySelector('p').textContent=UPDATE_LOG.text;
    el.querySelector('small').textContent='Update '+UPDATE_LOG.version;
    el.querySelector('.update-support strong').textContent=SUPPORT_TEXT;
    el.querySelector('.discord-button').onclick=()=>{window.open(DISCORD_URL,'_blank','noopener,noreferrer')};
    el.querySelector('.app-button').onclick=()=>el.remove();
    document.body.appendChild(el);
  }
  function forceRefreshOverlay(){let old=document.getElementById('nova-server-update-required');if(old)return;const el=document.createElement('div');el.id='nova-server-update-required';el.className='update-required-overlay';el.innerHTML='<div class="update-required-card"><div class="update-icon">↻</div><span class="eyebrow">NOVA OS UPDATED</span><h2>This site is out of date</h2><p>A newer Nova OS update is now live. Refresh this page to keep using the newest version.</p><button class="app-button">Refresh Nova OS</button></div>';el.querySelector('button').onclick=()=>location.reload();document.body.appendChild(el)}
  async function checkServerBuild(){if(polling||location.protocol==='file:')return;polling=true;try{const r=await fetch('/api/version',{cache:'no-store',credentials:'same-origin'});if(!r.ok)return;const d=await r.json();if(!serverBuild){serverBuild=String(d.version||'');return}if(d.version&&String(d.version)!==serverBuild)forceRefreshOverlay()}catch{}finally{polling=false}}
  function startServerUpdateWatcher(){serverBuild='';checkServerBuild();setInterval(checkServerBuild,15000)}
  return{checkAndShow,show,log:UPDATE_LOG,discordUrl:DISCORD_URL,supportText:SUPPORT_TEXT};
  startServerUpdateWatcher();
})();
