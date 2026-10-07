(function(){
  const updates=[
    ['Nova OS 12.5','Self-hosted CORS proxy integrated for safer external requests.'],
    ['Nova Watch','Movies and shows now persist through the Nova server catalog.'],
    ['Wallpapers','Live MP4 wallpapers are stored server-side and can be reused by Nova users.'],
    ['Desktop','The desktop HUD was removed from the workspace and status information moved into the taskbar.'],
    ['Taskbar','Added server status, active-player presence, clock, quick controls, and cleaner glass styling.'],
    ['Visuals','Upgraded windows, app icons, panels, buttons, spacing, lighting, and desktop depth.'],
    ['Developer tools','Developer-only wallpaper publishing and existing developer features remain intact.'],
    ['Accounts','Account persistence and Developer Bypass remain supported.'],
    ['Nova OS','Existing apps, games, Notes, Bible, Files, Music, Movies, Shows, Settings, and other features were preserved.']
  ];
  function render(){
    const panel=document.getElementById('nova-update-log');if(!panel)return;
    panel.innerHTML='<div class="nova-update-head"><div><span class="nova-update-kicker">NOVA OS</span><h2>Update Log</h2><p>What has been added and improved.</p></div><button id="nova-update-close" class="icon-button" aria-label="Close">×</button></div><div class="nova-update-list">'+updates.map((u,i)=>`<article class="nova-update-item"><span class="nova-update-index">${String(updates.length-i).padStart(2,'0')}</span><div><strong>${u[0]}</strong><p>${u[1]}</p></div></article>`).join('')+'</div><div class="nova-update-footer">Nova OS • Built for the Nova experience</div>';
    document.getElementById('nova-update-close').onclick=()=>panel.classList.add('hidden');
  }
  function init(){
    const button=document.getElementById('update-log-button'),panel=document.getElementById('nova-update-log');
    if(!button||!panel)return;
    button.addEventListener('click',()=>{panel.classList.toggle('hidden');if(!panel.classList.contains('hidden'))render();});
    panel.addEventListener('click',e=>{if(e.target===panel)panel.classList.add('hidden')});
  }
  document.addEventListener('DOMContentLoaded',init);
  window.NovaUpdateLog={open(){const p=document.getElementById('nova-update-log');if(p){p.classList.remove('hidden');render()}},render};
})();
