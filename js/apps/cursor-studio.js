(function(){
  const cursors={
    nova:{name:'Nova Arrow',emoji:'✦',svg:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M5 3l20 13-9 2 4 9-4 2-4-10-7 5z" fill="%ACCENT%" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>'},
    neon:{name:'Neon Pointer',emoji:'⚡',svg:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M7 3l17 12-8 2 4 10-4 2-5-10-6 5z" fill="none" stroke="%ACCENT%" stroke-width="3" stroke-linejoin="round"/><path d="M7 3l17 12" stroke="white" stroke-width="1.2"/></svg>'},
    pixel:{name:'Pixel Nova',emoji:'▟',svg:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M5 4h7v3h5v4h5v5h4v11H15v-4h-4v-5H7v-5H5z" fill="%ACCENT%"/><path d="M12 7h5v4h5v5h4v4H16v-4h-4z" fill="white"/></svg>'},
    comet:{name:'Comet',emoji:'☄',svg:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M4 25C10 19 12 10 24 7" fill="none" stroke="%ACCENT%" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="7" r="5" fill="%ACCENT%" stroke="white" stroke-width="1.5"/><circle cx="22" cy="5" r="1.5" fill="white"/></svg>'},
    orbit:{name:'Orbit Dot',emoji:'◉',svg:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="5" fill="%ACCENT%"/><ellipse cx="16" cy="16" rx="12" ry="6" fill="none" stroke="white" stroke-width="1.5" transform="rotate(-25 16 16)"/><circle cx="25" cy="11" r="2.5" fill="%ACCENT%"/></svg>'},
    spark:{name:'Spark',emoji:'✧',svg:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 2l2.8 10.2L29 16l-10.2 2.8L16 29l-2.8-10.2L3 16l10.2-3.8z" fill="%ACCENT%" stroke="white" stroke-width="1.3"/></svg>'}
  };
  function urlFor(id){const s=localStorage.getItem('nova-os:cursor')||'nova',c=cursors[s]||cursors.nova,accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#7c5cff';return 'url("data:image/svg+xml,'+encodeURIComponent(c.svg.replaceAll('%ACCENT%',accent))+'") 5 5, auto'}
  function apply(id){if(!cursors[id])id='nova';localStorage.setItem('nova-os:cursor',id);document.documentElement.style.setProperty('--nova-cursor',urlFor(id));document.body.classList.add('nova-custom-cursor');document.dispatchEvent(new CustomEvent('nova-cursor-change',{detail:id}))}
  function current(){return localStorage.getItem('nova-os:cursor')||'nova'}
  window.NovaCursorStudio={cursors,apply,current,refresh:()=>apply(current())};
  window.CursorStudioApp={id:'cursor',name:'Nova Cursor Studio',description:'Customize the pointer used across Nova OS.',icon:'assets/icons/cursor.svg',width:720,height:540,mount(body){
    body.innerHTML='<div class="cursor-studio"><div class="cursor-studio-head"><div><span class="eyebrow">NOVA LAB</span><h1>Nova Cursor Studio</h1><p>Give Nova your own pointer style.</p></div><div class="cursor-preview" id="cursor-preview">✦</div></div><div class="cursor-grid">'+Object.entries(cursors).map(([id,c])=>`<button class="cursor-card" data-cursor="${id}"><div class="cursor-art">${c.emoji}</div><strong>${c.name}</strong><small>Use this cursor</small></button>`).join('')+'</div><div class="cursor-studio-foot"><span>Current: <strong id="cursor-current"></strong></span><button class="app-button" id="cursor-reset">Reset to Nova Arrow</button></div></div>';
    const update=()=>{body.querySelector('#cursor-current').textContent=cursors[current()]?.name||'Nova Arrow';body.querySelectorAll('.cursor-card').forEach(x=>x.classList.toggle('active',x.dataset.cursor===current()));};
    body.querySelectorAll('[data-cursor]').forEach(b=>b.onclick=()=>{apply(b.dataset.cursor);update();OS.toast(cursors[b.dataset.cursor].name+' applied')});
    body.querySelector('#cursor-reset').onclick=()=>{apply('nova');update();OS.toast('Nova Arrow restored')};update();return()=>{};
  }};
  window.addEventListener('DOMContentLoaded',()=>apply(current()));
})();
