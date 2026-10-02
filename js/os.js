window.OS=(function(){
  const apps={
    calculator:window.CalculatorApp, settings:window.SettingsApp,
    files:window.FilesApp, notes:window.NotesApp, music:window.MusicApp, games:window.GamesApp,
    movies:window.MoviesApp, appstore:window.AppStoreApp, clock:window.ClockApp, timer:window.TimerApp,
    meet:window.MeetApp, chat:window.ChatApp, calendar:window.CalendarApp, terminal:window.TerminalApp,
    gallery:window.GalleryApp, cursor:window.CursorStudioApp, beatlab:window.BeatLabApp, 'nova-ai':window.NovaAIApp, 'google-classroom':window.GoogleClassroomApp, 'nova-cloud-gaming':window.NovaCloudGamingApp
  };
  const core=['calculator','files','notes','music','games','movies','settings','appstore','google-classroom'];
  function installed(){const saved=Store.load('installed-apps',core);return [...new Set(saved.filter(id=>apps[id]).concat(core))]}
  function isInstalled(id){return installed().includes(id)}
  function install(id){if(!apps[id])return false;const list=installed();if(!list.includes(id)){list.push(id);Store.save('installed-apps',list);renderDesktop();StartMenu.render();toast(apps[id].name+' installed on your desktop');window.NovaCompanion?.onInstall(id)}return true}
  function uninstall(id){if(core.includes(id))return false;const list=installed().filter(x=>x!==id);Store.save('installed-apps',list);const w=WindowManager.get(id);if(w)WindowManager.close(id);renderDesktop();StartMenu.render();return true}
  function canAccessApp(id){
    if(id==='movies') return true;
    if(id==='chat'||id==='meet') return window.NovaAuthMode==='account';
    return true;
  }
  function launch(id){
    const app=apps[id];
    if(!app||!isInstalled(id)){toast('Install this app from the App Store first');return}
    if(!canAccessApp(id)){
      if(id==='movies') toast('Nova Watch is unavailable right now.');
      else if(id==='chat'||id==='meet') toast('Sign in to your Nova account to use '+(id==='chat'?'Nova Chat':'Nova Meet')+'.');
      return;
    }
    WindowManager.open(id,app);StartMenu.close();window.NovaCompanion?.onAppLaunch(id)
  }
  function renderDesktop(){const box=document.getElementById('desktop-icons');box.textContent='';installed().filter(id=>canAccessApp(id)).forEach(id=>{const a=apps[id],b=document.createElement('button');b.className='desktop-icon';b.dataset.appId=id;const img=document.createElement('img');img.src=a.icon;img.alt='';const s=document.createElement('span');s.textContent=a.name;b.append(img,s);b.title=a.description;box.appendChild(b)});window.NovaDesktopLayout?.decorate()}
  function applySettings(){const s=Store.getSettings();document.body.classList.toggle('light',s.theme==='light');document.body.dataset.theme=s.theme||'midnight';document.body.classList.toggle('no-animations',!s.animations);document.documentElement.style.setProperty('--accent',s.accent);document.documentElement.style.setProperty('--taskbar-alpha',s.taskbarAlpha);document.body.classList.toggle('experimental-glow',s.experimental?.glow===true);document.body.classList.toggle('no-glass',s.experimental?.glass===false);document.title=s.osName;document.getElementById('start-os-name').textContent=s.osName;const d=document.getElementById('desktop');d.classList.remove('wall-aurora','wall-plain');if(s.wallpaper==='aurora')d.style.background='radial-gradient(circle at 20% 20%,#5c3dbb,#07111f 45%,#042c32)';else if(s.wallpaper==='plain')d.style.background='var(--bg)';else if(s.wallpaper==='custom'){const custom=Store.load('custom-wallpaper','');d.style.background=custom?`center/cover no-repeat url(${custom})`:''}else d.style.background='';renderClock();window.NovaCursorStudio?.refresh();window.NovaWidgets?.render();window.NovaAnimatedWallpapers?.apply(s.wallpaper)}
  function renderClock(){const s=Store.getSettings(),now=new Date(),time=now.toLocaleTimeString([],s.clock24?{hour:'2-digit',minute:'2-digit'}:{hour:'numeric',minute:'2-digit'}),date=now.toLocaleDateString([],{month:'short',day:'numeric'});document.getElementById('clock').innerHTML=time+'<small>'+date+'</small>'}
  function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}
  function init(){applySettings();renderDesktop();StartMenu.render();NovaDesktopLayout?.init();NovaDesktopContext?.init();NovaDesktop?.init();window.NovaWidgets?.init();window.NovaCompanion?.init();renderClock();window.NovaRecommendations?.show();window.NovaShell?.init();window.NovaDeveloperPanel?.init();const schedule=()=>{const delay=60000-(Date.now()%60000)+100;setTimeout(()=>{renderClock();schedule()},delay)};schedule()}
  return{apps,launch,canAccessApp,applySettings,toast,init,isInstalled,install,uninstall,installed,renderDesktop}
})();
