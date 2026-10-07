window.NovaDesktopContext=(()=>{
  let menu=null;
  function close(){menu?.remove();menu=null}
  function item(label,action,icon=''){const b=document.createElement('button');b.className='nova-context-item';b.innerHTML=`<span class="context-icon">${icon}</span><span>${label}</span>`;b.onclick=()=>{close();action()};return b}
  function open(x,y){close();menu=document.createElement('div');menu.className='nova-context-menu';menu.setAttribute('role','menu');menu.append(
    item('Refresh',()=>{OS.renderDesktop();OS.toast('Desktop refreshed')},'↻'),
    item('Arrange icons',()=>{NovaDesktopLayout.arrange();OS.toast('Icons arranged')},'▦'),
    item('Personalize',()=>OS.launch('settings'),'✦'),
    item('Open App Store',()=>OS.launch('appstore'),'▣'),
    item('Open Nova AI',()=>{if(OS.isInstalled('nova-ai'))OS.launch('nova-ai');else OS.install('nova-ai')},'✧')
  );document.body.appendChild(menu);const r=menu.getBoundingClientRect();menu.style.left=Math.min(x,innerWidth-r.width-10)+'px';menu.style.top=Math.min(y,innerHeight-r.height-10)+'px'}
  function init(){const d=document.getElementById('desktop');if(!d)return;d.addEventListener('contextmenu',e=>{if(e.target.closest('#taskbar,#window-layer,.start-menu,.notification-center,.profile-panel'))return;e.preventDefault();open(e.clientX,e.clientY)});document.addEventListener('pointerdown',e=>{if(menu&&!e.target.closest('.nova-context-menu'))close()});window.addEventListener('blur',close)}
  return{init,close,open}
})();
