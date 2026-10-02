window.NovaWidgets=(()=>{
  const widgets={
    clock:{name:'Clock Widget',icon:'◷',requires:'clock'},
    music:{name:'Nova Music Widget',icon:'♫',requires:'music'}
  };
  const key='desktop-widgets';
  const load=()=>Store.load(key,[]);
  const save=v=>Store.save(key,v);
  function panel(){
    if(Store.getSettings().experimental?.widgets===false){OS.toast('Widgets are disabled in Settings → Experimental');return}
    let p=document.getElementById('widgets-panel'); if(p){p.remove();return}
    p=document.createElement('aside');p.id='widgets-panel';p.className='widgets-panel';
    p.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><div><h3>Widgets</h3><p>Only installed apps can add widgets.</p></div><button class="icon-button" id="widget-panel-close">×</button></div><div class="widget-list">'+Object.entries(widgets).map(([id,w])=>`<button class="widget-add" data-widget="${id}"><span>${w.icon} <strong>${w.name}</strong><small>Requires ${OS.apps[w.requires]?.name||w.requires}</small></span><span>${load().includes(id)?'Added':'Add'}</span></button>`).join('')+'</div>';
    document.body.appendChild(p);p.querySelector('#widget-panel-close').onclick=()=>p.remove();
    p.querySelectorAll('[data-widget]').forEach(b=>b.onclick=()=>{const id=b.dataset.widget;if(!OS.isInstalled(widgets[id].requires)){OS.toast('Install '+OS.apps[widgets[id].requires].name+' first');return}const a=load();if(!a.includes(id))a.push(id);save(a);p.remove();render();OS.toast(widgets[id].name+' added')});
  }
  function remove(id){save(load().filter(x=>x!==id));render()}
  function clockWidget(){const el=document.createElement('section');el.className='desktop-widget';el.dataset.widget='clock';el.style.right='24px';el.style.top='24px';el.innerHTML='<div class="desktop-widget-head"><span>◷ CLOCK</span><button class="desktop-widget-close">×</button></div><div class="clock-widget-time">--:--</div><div class="clock-widget-date">---</div>';el.querySelector('button').onclick=()=>remove('clock');const tick=()=>{if(!el.isConnected)return;const s=Store.getSettings(),n=new Date();el.querySelector('.clock-widget-time').textContent=n.toLocaleTimeString([],s.clock24?{hour:'2-digit',minute:'2-digit'}:{hour:'numeric',minute:'2-digit'});el.querySelector('.clock-widget-date').textContent=n.toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'});};tick();const timer=setInterval(tick,1000);el._cleanup=()=>clearInterval(timer);return el}
  function musicWidget(){const el=document.createElement('section');el.className='desktop-widget music-widget';el.dataset.widget='music';el.style.left='24px';el.style.top='24px';el.innerHTML='<div class="desktop-widget-head"><span>♫ NOVA MUSIC</span><button class="desktop-widget-close">×</button></div><div class="music-widget-track"><div class="music-widget-cover">♫</div><div><strong id="mw-title">Nothing playing</strong><small id="mw-artist">Open Nova Music to start</small></div></div><div class="music-widget-controls"><button data-act="prev">‹‹</button><button class="main" data-act="play">▶</button><button data-act="next">››</button></div>';
    el.querySelector('.desktop-widget-close').onclick=()=>remove('music');
    const update=()=>{const st=window.NovaMusicEngine?.state?.()||{};el.querySelector('#mw-title').textContent=st.title||'Nothing playing';el.querySelector('#mw-artist').textContent=st.artist||'Open Nova Music to start';el.querySelector('[data-act="play"]').textContent=st.playing?'Ⅱ':'▶';};
    el.querySelector('[data-act="play"]').onclick=()=>{window.NovaMusicEngine?.toggle();setTimeout(update,30)};el.querySelector('[data-act="prev"]').onclick=()=>window.NovaMusicEngine?.prev();el.querySelector('[data-act="next"]').onclick=()=>window.NovaMusicEngine?.next();document.addEventListener('nova-music-change',update);el._cleanup=()=>document.removeEventListener('nova-music-change',update);update();return el}
  function render(){if(Store.getSettings().experimental?.widgets===false){document.querySelectorAll('.desktop-widget').forEach(e=>{e._cleanup?.();e.remove()});return}document.querySelectorAll('.desktop-widget').forEach(e=>{e._cleanup?.();e.remove()});load().forEach(id=>{if(!widgets[id]||!OS.isInstalled(widgets[id].requires))return;const el=id==='clock'?clockWidget():musicWidget();document.getElementById('desktop').appendChild(el)})}
  function init(){const btn=document.getElementById('widgets-button');if(btn&&!btn.dataset.widgetBound){btn.dataset.widgetBound='1';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();panel()})}const bored=document.getElementById('bored-button');if(bored&&!bored.dataset.boredBound){bored.dataset.boredBound='1';bored.addEventListener('click',()=>window.NovaRecommendations?.open())}render()}
  return {init,render,panel,remove};
})();
