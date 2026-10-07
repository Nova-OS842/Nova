window.NovaDesktop=(function(){
  const state={notifications:[],profile:{name:'Nova User',avatar:'✦'}};
  const q=id=>document.getElementById(id);
  function load(){
    try{state.notifications=JSON.parse(localStorage.getItem('nova-os:notifications')||'[]')}catch(e){state.notifications=[]}
    try{state.profile=Object.assign(state.profile,JSON.parse(localStorage.getItem('nova-os:profile')||'{}'))}catch(e){}
  }
  function save(){try{localStorage.setItem('nova-os:notifications',JSON.stringify(state.notifications.slice(-30)));localStorage.setItem('nova-os:profile',JSON.stringify(state.profile))}catch(e){}}
  function notify(title,message=''){state.notifications.push({id:Date.now()+Math.random(),title,message,time:Date.now(),read:false});save();renderNotifications();}
  function renderNotifications(){
    const panel=q('notification-center'),badge=q('notification-badge'); if(!panel)return;
    const unread=state.notifications.filter(n=>!n.read).length;
    badge.textContent=unread>9?'9+':unread; badge.classList.toggle('hidden',!unread);
    panel.innerHTML='';
    const head=document.createElement('div');head.className='panel-head';head.innerHTML='<div><strong>Notifications</strong><small>Nova activity</small></div><button class="icon-button" id="clear-notifications">Clear</button>';panel.append(head);
    const list=document.createElement('div');list.className='notification-list';
    if(!state.notifications.length){list.innerHTML='<div class="panel-empty">You\'re all caught up.</div>'}
    [...state.notifications].reverse().forEach(n=>{const item=document.createElement('button');item.className='notification-item'+(n.read?' read':'');const age=Math.max(0,Math.floor((Date.now()-n.time)/60000));item.innerHTML='<span class="notification-icon">✦</span><span><strong></strong><small></small></span>';item.querySelector('strong').textContent=n.title;item.querySelector('small').textContent=(n.message?n.message+' · ':'')+(age<1?'now':age+'m ago');item.onclick=()=>{n.read=true;save();renderNotifications()};list.append(item)});panel.append(list);
    q('clear-notifications').onclick=()=>{state.notifications=[];save();renderNotifications()};
  }
  function renderProfile(){const panel=q('profile-panel');if(!panel)return;panel.innerHTML='<div class="profile-hero"><div class="profile-avatar"></div><div><strong></strong><small>Nova profile</small></div></div><div class="profile-actions"><button class="app-button" id="edit-profile">Edit profile</button><button class="app-button" id="profile-settings">Settings</button><button class="app-button" id="profile-signout">Sign out</button></div>';panel.querySelector('.profile-avatar').textContent=state.profile.avatar;panel.querySelector('.profile-hero strong').textContent=state.profile.name;panel.querySelector('#edit-profile').onclick=()=>{const n=prompt('Profile name',state.profile.name);if(n&&n.trim()){state.profile.name=n.trim();save();renderProfile();q('profile-name').textContent=state.profile.name}};panel.querySelector('#profile-settings').onclick=()=>{panel.classList.add('hidden');OS.launch('settings')};panel.querySelector('#profile-signout').onclick=async()=>{if(window.NovaAuthMode==='guest'||window.NovaAuthMode==='dev'){location.reload();return}try{await NovaAuth.api('/api/logout',{method:'POST'})}catch(e){}location.reload()};}
  function togglePanel(id){const el=q(id);const other=id==='notification-center'?'profile-panel':'notification-center';q(other)?.classList.add('hidden');el.classList.toggle('hidden');if(id==='notification-center')renderNotifications();else renderProfile()}
  function fullscreen(){if(!document.fullscreenElement){document.documentElement.requestFullscreen?.().then(()=>document.body.classList.add('nova-browser-fullscreen')).catch(()=>{})}else{document.exitFullscreen?.().catch(()=>{})}}
  function focusSearch(){StartMenu.open();setTimeout(()=>q('app-search')?.focus(),0)}
  function shortcuts(e){
    if(e.key==='Escape'){q('notification-center')?.classList.add('hidden');q('profile-panel')?.classList.add('hidden');return}
    if((e.ctrlKey||e.metaKey)&&e.code==='Space'){e.preventDefault();focusSearch();return}if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='s'){e.preventDefault();StartMenu.open();return}
    if((e.altKey)&&e.key==='F4'){const active=WindowManager.all().filter(w=>!w.minimized).sort((a,b)=>Number(b.el.style.zIndex)-Number(a.el.style.zIndex))[0];if(active){e.preventDefault();WindowManager.close(active.id)}return}
    if(e.key==='F11'){e.preventDefault();fullscreen();return}
    if(e.altKey&&e.key==='Tab'){e.preventDefault();const list=WindowManager.all().filter(w=>!w.minimized);if(list.length>1){const idx=Math.max(0,list.findIndex(w=>w.el.style.zIndex===String(Math.max(...list.map(x=>Number(x.el.style.zIndex))))));WindowManager.focus(list[(idx+1)%list.length].id)}}
    if((e.metaKey||e.altKey)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const list=WindowManager.all().filter(w=>!w.minimized);const active=list.find(w=>w.el.style.zIndex===String(Math.max(...list.map(x=>Number(x.el.style.zIndex)))));if(active)WindowManager.snap(active.id,e.key)}
  }
  document.addEventListener('fullscreenchange',()=>document.body.classList.toggle('nova-browser-fullscreen',!!document.fullscreenElement));
  function init(){load();if(window.NovaUser?.username)state.profile.name=window.NovaUser.username;window.NovaPresence?.start();if(window.NovaAuthMode==='account'){window.NovaAuth.events(m=>{if(m.type==='chat'&&m.message?.from){notify(m.message.from+' Messaged you','New Nova Chat message');OS.toast(m.message.from+' Messaged you')}})}q('notification-button')?.addEventListener('click',()=>togglePanel('notification-center'));q('fullscreen-button')?.addEventListener('click',fullscreen);document.addEventListener('keydown',shortcuts);document.addEventListener('pointerdown',e=>{if(!e.target.closest('#notification-center')&&!e.target.closest('#notification-button'))q('notification-center')?.classList.add('hidden');if(!e.target.closest('#profile-panel')&&!e.target.closest('#profile-name')&&!e.target.closest('.profile-chip'))q('profile-panel')?.classList.add('hidden')});renderNotifications();renderProfile();q('profile-name').textContent=state.profile.name}
  return{init,notify,renderNotifications,renderProfile,fullscreen,toggleProfile:()=>togglePanel('profile-panel')}
})();

/* Nova taskbar server status + player presence */
(function(){
  async function tick(){
    const el=document.getElementById('taskbar-server-status');
    if(!el)return;
    if(location.protocol==='file:'||!navigator.onLine){
      el.className='tb-server-status offline';
      const label=el.querySelector('.tb-server-label'); if(label)label.textContent='Offline';
      return;
    }
    el.className='tb-server-status checking';
    const label=el.querySelector('.tb-server-label'); if(label)label.textContent='Checking';
    try{
      const r=await fetch('/api/status',{cache:'no-store',credentials:'same-origin'});
      if(!r.ok)throw new Error();
      const d=await r.json();
      const online=d.online!==false;
      el.className='tb-server-status '+(online?'online':'offline');
      if(label)label.textContent=online?'Online':'Offline';
    }catch(e){
      el.className='tb-server-status offline';
      if(label)label.textContent='Offline';
    }
  }
  window.addEventListener('online',tick);
  window.addEventListener('offline',tick);
  document.addEventListener('nova-presence-update',tick);
  setInterval(tick,5000);
  setTimeout(tick,300);
})();
