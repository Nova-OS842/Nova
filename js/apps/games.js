/* NOVA ARCADE — local-first HTML game library */
window.NovaGameMeta = window.NovaGameMeta || {};
window.GamesApp = {
  id:"games", name:"Games", description:"Play your installed HTML games", icon:"assets/icons/neon/games.png", width:1180, height:760,
  mount(body){
    body.innerHTML = `
      <div class="nova-arcade">
        <header class="arcade-header">
          <div class="arcade-brand"><div class="arcade-logo">N</div><div><strong>NOVA</strong><span>GAMING</span></div></div>
          <nav class="arcade-tabs">
            <button class="arcade-tab active" data-view="home">Home</button>
            <button class="arcade-tab" data-view="all">Games</button>
            <button class="arcade-tab" data-view="recent">Recently Played</button>
          </nav>
          <div class="arcade-header-actions">
            <label class="arcade-search"><span>⌕</span><input id="games-search" placeholder="Search games" autocomplete="off"></label>
            <button id="games-refresh" class="arcade-round-btn" title="Refresh games">↻</button>
          </div>
        </header>
        <main class="arcade-main">
          <section id="arcade-home-hero" class="arcade-home-hero">
            <div class="hero-copy"><span class="hero-eyebrow">NOVA GAMING</span><h1>What do you want to play?</h1><p>Jump into your library. Everything here runs inside Nova.</p><button id="hero-random" class="hero-btn">🎲 Surprise me</button></div>
            <div class="hero-orbit"><div class="hero-orbit-ring"></div><div class="hero-controller">🎮</div><i>✦</i><b>+</b></div>
          </section>
          <section class="arcade-toolbar"><div><h2 id="arcade-section-title">All Games</h2><span id="games-count">0 games</span></div><div class="arcade-filters"><button class="arcade-filter active" data-filter="all">All</button><button class="arcade-filter" data-filter="recent">Recent</button></div></section>
          <section id="games-grid" class="arcade-grid"></section>
        </main>
        <section id="arcade-player" class="arcade-player-page" hidden>
          <header class="player-page-header">
            <button id="player-back" class="player-back">← <span>Back to games</span></button>
            <div class="player-page-title"><span id="player-icon">🎮</span><div><strong id="player-name">Game</strong><small>Playing in Nova Gaming</small></div></div>
            <div class="player-page-actions"><button id="player-refresh" title="Restart game">↻</button><button id="player-full" title="Fullscreen">⛶</button></div>
          </header>
          <div class="player-page-stage"><iframe id="game-frame" title="Nova game" allow="fullscreen; autoplay; gamepad; pointer-lock" allowfullscreen></iframe><div class="player-loading"><div class="arcade-spinner"></div><span>Loading game…</span></div></div>
        </section>
      </div>`;

    const grid=body.querySelector('#games-grid'), search=body.querySelector('#games-search'), count=body.querySelector('#games-count');
    const title=body.querySelector('#arcade-section-title'), homeHero=body.querySelector('#arcade-home-hero'), player=body.querySelector('#arcade-player'), frame=body.querySelector('#game-frame');
    const meta=window.NovaGameMeta||{}; let games=[]; let view='home'; let activeGame=null;
    const localFiles=Object.keys(meta).filter(file=>/\.html?$/i.test(file));
    const linkedGames=Array.isArray(window.NovaGameLinks)?window.NovaGameLinks:[];
    const icons={balatro:'🃏',cookie_clicker:'🍪',google_feud:'🔎',rocket_league:'🚗',paper_io_2:'🟦',plague_inc:'🦠',plants_vs_zombies_2:'🌻',little_alchemy_2:'⚗️',lobotomy_corporation:'🧠',cloverpit:'🍀',idle_mining_empire:'⛏️',peaks_of_yore:'🧗',scribblenauts:'✏️',grand_theft_auto_3:'🏙️',side_effects:'🌀',totally_accurate_battle_simulator:'⚔️',peggle:'🟠',shift_at_midnight:'🌙',peak:'⛰️',tiny_fishing:'🎣',fruit_ninja:'🍉',side_effects:'🌀',johnny_trigger:'🎯',people_playground:'🧍',escape_road_3:'🚗',karlson:'🔫',whos_your_daddy:'👶',hypper_sandbox:'🧪',kick_the_buddy:'🥊',la_madriguera:'🏠'};
    function safeName(n){return n.replace(/\.html?$/i,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g,x=>x.toUpperCase())||'Game'}
    function slug(n){return n.replace(/\.html?$/i,'').toLowerCase()}
    function recent(){return Store.load('played-games',[])}
    function filtered(){
      const q=search.value.trim().toLowerCase(); let list=games.filter(g=>(g.title+' '+g.file).toLowerCase().includes(q));
      if(view==='recent'){const r=recent(); const rank=new Map(r.map((x,i)=>[x.file,i])); list=list.filter(g=>rank.has(g.file)).sort((a,b)=>rank.get(a.file)-rank.get(b.file));}
      return list;
    }
    function card(g){
      const m=meta[g.file]||{}, key=slug(g.file), poster=g.poster||m.poster||`assets/posters/${encodeURIComponent(g.file.replace(/\.html?$/i,''))}.jpg`, c=document.createElement('article'); c.className='arcade-game-card';
      c.innerHTML=`<div class="game-art" role="button" tabindex="0">${poster?`<img class="game-poster-img" src="${String(poster).replace(/"/g,'&quot;')}" alt="" loading="lazy" onerror="this.remove()">`:''}<span>${m.emoji||icons[key]||'🎮'}</span><div class="game-art-shine"></div><b>PLAY</b>${window.NovaAuthMode==='dev'?`<button class="media-dev-menu game-dev-menu" data-dev-game="${String(g.file).replace(/"/g,'&quot;')}" aria-label="Game options">⋯</button>`:''}</div><div class="game-card-body"><div class="game-card-title"><h3></h3><span>HTML</span></div><p>${g.description||m.description||'Ready to play in Nova.'}</p><button class="game-play" type="button">Play game <span>→</span></button></div>`;
      c.querySelector('h3').textContent=g.title||m.title||safeName(g.file); c.querySelector('.game-art').onclick=()=>openGame(g);c.querySelector('.game-art').onkeydown=e=>{if(e.key==='Enter'||e.key===' ')openGame(g)}; c.querySelector('.game-play').onclick=()=>openGame(g);if(window.NovaAuthMode==='dev'){const btn=c.querySelector('[data-dev-game]');if(btn)btn.onclick=e=>{e.stopPropagation();const menu=document.createElement('div');menu.className='media-dev-popover';menu.innerHTML='<button data-edit>✎ Edit</button><button data-delete>⌫ Delete</button>';c.querySelector('.game-art').appendChild(menu);menu.querySelector('[data-edit]').onclick=()=>{menu.remove();editGame(g)};menu.querySelector('[data-delete]').onclick=()=>{menu.remove();deleteGame(g)};setTimeout(()=>document.addEventListener('click',()=>menu.remove(),{once:true}),0)}} return c;
    }
    function editGame(g){if(window.NovaAuthMode!=='dev')return;const overlay=document.createElement('div');overlay.className='dev-edit-overlay';const linked=g.source==='link';overlay.innerHTML=`<div class="dev-edit-card"><div class="dev-edit-head"><div><span class="media-eyebrow">DEVELOPER EDITOR</span><h2>Edit game</h2></div><button class="movie-details-close" id="ged-close">×</button></div><div class="dev-edit-grid"><label>Game name<input id="eg-title" value="${String(g.title||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></label>${linked?'<label>Game link<input id="eg-url" value="'+String(g.url||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"></label>':''}<label>Poster link<input id="eg-poster" value="${String(g.poster||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></label><label class="dev-edit-wide">Description<textarea id="eg-desc" rows=5>${String(g.description||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea></label></div><div class="dev-edit-actions"><button class="movie-secondary" id="ged-cancel">Cancel</button><button class="hero-button" id="ged-save">Save changes</button></div></div>`;document.body.appendChild(overlay);const close=()=>overlay.remove();overlay.querySelector('#ged-close').onclick=close;overlay.querySelector('#ged-cancel').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close()};overlay.querySelector('#ged-save').onclick=async()=>{try{const b={file:g.file,id:g.id,title:overlay.querySelector('#eg-title').value.trim(),poster:overlay.querySelector('#eg-poster').value.trim(),description:overlay.querySelector('#eg-desc').value.trim()};if(linked)b.url=overlay.querySelector('#eg-url').value.trim();await fetch('/api/dev/update-game',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Update failed');return d});OS.toast('Game updated for everyone');close();load()}catch(e){OS.toast(e.message)}}}
function deleteGame(g){if(window.NovaAuthMode!=='dev')return;if(!confirm(`Delete “${g.title}” from Nova Gaming for everyone?`))return;fetch('/api/dev/delete-game',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:g.file,id:g.id})}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Delete failed');return d}).then(()=>{OS.toast('Game deleted for everyone');load()}).catch(e=>OS.toast(e.message))}
function render(){
      const list=filtered(); count.textContent=`${list.length} ${list.length===1?'game':'games'}`;
      title.textContent=view==='recent'?'Recently Played':search.value.trim()?'Search Results':'All Games';
      homeHero.hidden=!(view==='home'&&!search.value.trim()); grid.innerHTML='';
      if(!list.length){grid.innerHTML=`<div class="arcade-empty"><div>🎮</div><h3>${view==='recent'?'Nothing played yet':search.value.trim()?'No games found':'No games installed'}</h3><p>${view==='recent'?'Play a game and it will appear here.':'Add HTML files to the games folder and refresh Nova Gaming.'}</p></div>`;return;}
      list.forEach(g=>grid.appendChild(card(g)));
    }
    function openGame(g){
      activeGame=g; const played=recent(); Store.save('played-games',[{file:g.file,title:g.title,at:Date.now()},...played.filter(x=>x.file!==g.file)].slice(0,50));
      body.querySelector('#player-name').textContent=g.title; body.querySelector('#player-icon').textContent=(meta[g.file]?.emoji||icons[slug(g.file)]||'🎮');
      player.hidden=false; body.querySelector('.nova-arcade').classList.add('playing'); frame.src=g.url; body.querySelector('.player-loading').classList.remove('done');
      frame.onload=()=>body.querySelector('.player-loading').classList.add('done');
    }
    function closeGame(){frame.src='about:blank'; player.hidden=true; body.querySelector('.nova-arcade').classList.remove('playing'); activeGame=null;}
    async function load(){
      grid.innerHTML='<div class="arcade-loading"><div class="arcade-spinner"></div><strong>Loading your games…</strong></div>';
      let raw=[]; try{const r=await fetch('/api/content/games',{cache:'no-store'});if(r.ok)raw=await r.json()}catch(e){}
      const byFile=new Map(raw.map(x=>[x.file,x]));
      games=localFiles.map(file=>{const x=byFile.get(file);return {file,title:x?.title||meta[file]?.title||safeName(file),url:x?.url||`games/${encodeURIComponent(file)}`,poster:x?.poster||meta[file]?.poster||'',description:x?.description||meta[file]?.description||'Ready to play in Nova.',source:'local',emoji:x?.emoji||meta[file]?.emoji||''}});
      const rawLinked=raw.filter(x=>x.source==='link');
      const links=rawLinked.length?rawLinked:linkedGames.map((x,i)=>({file:'link:'+i+':'+String(x.title||x.name||('Linked Game '+(i+1))),title:String(x.title||x.name||('Linked Game '+(i+1))),url:String(x.url||x.link||x.href||''),poster:String(x.poster||''),description:String(x.description||'Ready to play in Nova.'),source:'link'})).filter(x=>/^https?:\/\//i.test(x.url));
      links.forEach(x=>{if(!games.some(g=>g.file===x.file))games.push(x)});
      raw.forEach(x=>{if(x.source!=='link'&&!games.some(g=>g.file===x.file))games.push({file:x.file,title:meta[x.file]?.title||x.title||safeName(x.file),url:x.url||`games/${encodeURIComponent(x.file)}`,poster:meta[x.file]?.poster||'',description:meta[x.file]?.description||'Ready to play in Nova.',source:'local'})}); render();
    }
    body.querySelectorAll('.arcade-tab').forEach(btn=>btn.onclick=()=>{view=btn.dataset.view;body.querySelectorAll('.arcade-tab').forEach(x=>x.classList.toggle('active',x===btn));render()});
    body.querySelectorAll('.arcade-filter').forEach(btn=>btn.onclick=()=>{if(btn.dataset.filter==='recent')view='recent';else view='home';body.querySelectorAll('.arcade-filter').forEach(x=>x.classList.toggle('active',x===btn));render()});
    search.oninput=render; body.querySelector('#games-refresh').onclick=load; body.querySelector('#player-back').onclick=closeGame;
    body.querySelector('#player-refresh').onclick=()=>{if(activeGame){frame.src='about:blank';setTimeout(()=>{frame.src=activeGame.url},30)}};
    body.querySelector('#player-full').onclick=()=>body.querySelector('.player-page-stage').requestFullscreen?.();
    body.querySelector('#hero-random').onclick=()=>{const list=games.length?games:[ ];if(list.length)openGame(list[Math.floor(Math.random()*list.length)])};
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeGame)closeGame()},{once:false});
    load();
  }
};
