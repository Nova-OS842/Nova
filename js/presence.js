window.NovaPresence=(()=>{
  let timer=null; const guestKey='nova-presence-id';
  function id(){let x=localStorage.getItem(guestKey);if(!x){x=crypto.randomUUID?.()||('g-'+Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem(guestKey,x)}return x}
  async function beat(){if(location.protocol==='file:'||!navigator.onLine)return;try{const r=await fetch('/api/presence',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({guestId:window.NovaAuthMode==='account'?'':id()})});if(r.ok){const d=await r.json();const el=document.getElementById('active-players');if(el){const n=Number(d.count)||0;el.textContent=`● ${n} ${n===1?'player':'players'} online`;el.classList.add('online');el.classList.remove('offline')}}}catch{const el=document.getElementById('active-players');if(el){el.textContent='● Server offline';el.classList.add('offline');el.classList.remove('online')}}}
  function start(){clearInterval(timer);beat();timer=setInterval(beat,15000);window.addEventListener('online',beat)}
  return{start,beat};
})();