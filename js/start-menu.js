window.StartMenu=(function(){
  const menu=()=>document.getElementById('start-menu');
  function render(filter=''){const box=document.getElementById('start-apps');box.textContent='';const q=filter.toLowerCase();Object.values(OS.apps).filter(a=>OS.isInstalled(a.id)).filter(a=>OS.canAccessApp(a.id)).filter(a=>(a.name+' '+a.description).toLowerCase().includes(q)).forEach(a=>{const b=document.createElement('button');b.className='start-app';const i=document.createElement('img');i.src=a.icon;i.alt='';const d=document.createElement('div');const s=document.createElement('strong');s.textContent=a.name;const sm=document.createElement('small');sm.textContent=a.description;d.append(s,sm);b.append(i,d);b.onclick=()=>{OS.launch(a.id);close()};box.appendChild(b)})}
  function open(){menu().classList.remove('hidden');document.getElementById('app-search').focus();render(document.getElementById('app-search').value)}
  function close(){menu().classList.add('hidden')}
  document.getElementById('start-button').onclick=()=>menu().classList.contains('hidden')?open():close();document.getElementById('search-button').onclick=open;document.getElementById('start-close').onclick=close;document.getElementById('app-search').addEventListener('input',e=>render(e.target.value));document.addEventListener('pointerdown',e=>{if(!e.target.closest('#start-menu')&&!e.target.closest('#start-button')&&!e.target.closest('#search-button'))close()});
  return{open,close,render}
})();
