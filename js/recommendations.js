window.NovaRecommendations=(()=>{
  let shown=false;
  const key='nova-recommendation-session';
  const get=(k,f)=>Store.load(k,f);
  const pick=a=>a.length?a[Math.floor(Math.random()*a.length)]:null;
  const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function games(){
    const local=Object.entries(window.NovaGameMeta||{}).map(([file,m])=>({file,title:m.title||file,url:`games/${encodeURIComponent(file)}`,poster:m.poster||''}));
    try{const r=await fetch('/api/content/games',{cache:'no-store'});if(!r.ok) return local;const remote=await r.json();
      const map=new Map(local.map(x=>[x.file,x]));
      (Array.isArray(remote)?remote:[]).forEach(x=>map.set(x.file,{...(map.get(x.file)||{}),...x}));
      return [...map.values()];
    }catch{return local}
  }
  function movieRecommendation(){
    const movies=Array.isArray(window.NOVA_MOVIES)?window.NOVA_MOVIES:[];
    if(!movies.length)return null;
    const watched=get('watched-movies',[]);
    const counts={}; watched.forEach(w=>{if(w.genre)counts[w.genre]=(counts[w.genre]||0)+1});
    const favoriteGenre=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
    const same=favoriteGenre?movies.filter(m=>m.genre&&String(m.genre).toLowerCase().includes(favoriteGenre.toLowerCase())):[];
    return {item:pick(same.length?same:movies),based:Boolean(favoriteGenre),genre:favoriteGenre};
  }
  function musicRecommendation(){
    const songs=window.NovaMusicLibrary||[]; if(!songs.length)return null;
    const played=get('played-music',[]); const artists={}; played.forEach(x=>{if(x.artist)artists[x.artist]=(artists[x.artist]||0)+1});
    const artist=Object.keys(artists).sort((a,b)=>artists[b]-artists[a])[0];
    const same=artist?songs.filter(s=>s.artist===artist):[];
    return {item:pick(same.length?same:songs),based:Boolean(artist),artist};
  }
  function open(){
    shown=false; sessionStorage.removeItem(key); show();
  }
  function show(){
    if(shown||sessionStorage.getItem(key)==='1')return;
    shown=true;sessionStorage.setItem(key,'1');
    setTimeout(async()=>{
      const gs=await games(), gr=pick(gs), mr=movieRecommendation(), ur=musicRecommendation();
      const modal=document.createElement('div');modal.className='nova-recommendation-modal';
      modal.innerHTML=`<div class="nova-recommendation-card"><button class="nova-rec-close" aria-label="Close">×</button><div class="nova-rec-kicker">✦ NOVA PICKS</div><h2>Not sure what to do?</h2><p class="nova-rec-sub">Nova picked something for you.</p><div class="nova-rec-grid">${gr?`<section class="nova-rec-choice game-choice"><div class="nova-rec-icon">🎮</div><div><span class="nova-rec-label">THIS IS THE GAME YOU SHOULD TRY</span><h3>${escape(gr.title||gr.file||'Game')}</h3><p>Give this one a shot.</p></div><button class="nova-rec-action" data-action="game">Play game</button></section>`:`<section class="nova-rec-choice empty-choice"><div class="nova-rec-icon">🎮</div><div><span class="nova-rec-label">GAMES</span><h3>No games found on Nova OS</h3><p>Add HTML games to the Nova games folder and they'll appear here.</p></div></section>`}${mr?`<section class="nova-rec-choice movie-choice"><div class="nova-rec-icon">🎬</div><div><span class="nova-rec-label">IF YOU DON'T FEEL LIKE PLAYING</span><h3>Try ${escape(mr.item.title||'a movie')}</h3><p>${mr.based?'Based on what you have watched before.':'A movie picked for you.'}</p></div><button class="nova-rec-action" data-action="movie">Watch movie</button></section>`:ur?`<section class="nova-rec-choice music-choice"><div class="nova-rec-icon">🎵</div><div><span class="nova-rec-label">OR LISTEN TO SOMETHING</span><h3>Try ${escape(ur.item.title||'some music')}</h3><p>${ur.based?'Based on music you have played before.':'A song picked for you.'}</p></div><button class="nova-rec-action" data-action="music">Listen</button></section>`:`<section class="nova-rec-choice empty-choice"><div class="nova-rec-icon">✨</div><div><span class="nova-rec-label">NOVA</span><h3>Add movies or music for more recommendations</h3><p>Nova will use your local activity to personalize future picks.</p></div></section>`}</div><small class="nova-rec-note">Your recommendations are based on activity stored in this browser.</small></div>`;
      document.body.appendChild(modal);
      modal.querySelector('.nova-rec-close').onclick=()=>modal.remove();
      modal.onclick=e=>{if(e.target===modal)modal.remove()};
      const action=modal.querySelector('.nova-rec-action'); if(action)action.onclick=()=>{const a=action.dataset.action;modal.remove();if(a==='game'&&gr){window.NovaRecommendationGame=gr;OS.launch('games')}else if(a==='movie'&&mr){OS.launch('movies');setTimeout(()=>window.NovaRecommendationMovie=mr.item,250)}else if(a==='music'&&ur){OS.launch('music');setTimeout(()=>window.NovaRecommendationMusic=ur.item,250)}};
    },450);
  }
  return {show,open};
})();
