window.NovaScreensaver=(()=>{
  let overlay, timer, active=false, last=Date.now();
  const defaults={enabled:true,delay:180};
  function settings(){return Store.load('screensaver',defaults)}
  function ensure(){if(overlay)return;overlay=document.createElement('div');overlay.id='nova-screensaver';overlay.innerHTML=`<div class="ss-stars"></div><div class="ss-orbit o1"></div><div class="ss-orbit o2"></div><div class="ss-orbit o3"></div><div class="ss-core"><div class="ss-logo">✦</div><div class="ss-word">NOVA</div><div class="ss-sub">SECURE • IDLE MODE</div></div><div class="ss-clock" id="ss-clock"></div><div class="ss-hint">Move your mouse or press any key to return</div>`;document.body.appendChild(overlay);overlay.addEventListener('pointerdown',wake);document.addEventListener('keydown',wake);}
  function clock(){const s=Store.getSettings(),n=new Date();const t=n.toLocaleTimeString([],s.clock24?{hour:'2-digit',minute:'2-digit',second:'2-digit'}:{hour:'numeric',minute:'2-digit',second:'2-digit'});const d=n.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});const el=document.getElementById('ss-clock');if(el)el.innerHTML=`<strong>${t}</strong><span>${d}</span>`}
  function show(){if(active||!settings().enabled||document.getElementById('auth-screen')?.classList.contains('hidden')===false)return;ensure();active=true;overlay.classList.add('visible');clock();timer=setInterval(clock,1000)}
  function wake(){last=Date.now();if(!active)return;active=false;overlay.classList.remove('visible');clearInterval(timer);timer=null}
  function activity(){last=Date.now();if(active)wake()}
  function arm(){clearTimeout(timer);const s=settings();if(!s.enabled)return;timer=setTimeout(show,(Number(s.delay)||180)*1000)}
  function init(){['pointermove','pointerdown','mousemove','wheel','touchstart','keydown'].forEach(e=>addEventListener(e,activity,{passive:true}));setInterval(()=>{if(!active)arm()},15000);arm()}
  return{init,show,wake,settings}
})();
