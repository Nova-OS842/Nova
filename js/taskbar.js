window.Taskbar={refresh(){
  const box=document.getElementById('task-apps');if(!box)return;
  box.textContent='';
  const windows=WindowManager.all();
  windows.forEach(w=>{
    const b=document.createElement('button');
    b.className='task-app'+(w.minimized?'':' active');
    b.type='button';
    b.title=w.app.name;
    b.setAttribute('aria-label',w.app.name);
    const img=document.createElement('img');
    img.src=w.app.icon; img.alt=''; img.draggable=false;
    b.appendChild(img);
    const dot=document.createElement('span'); dot.className='task-app-dot'; dot.setAttribute('aria-hidden','true'); b.appendChild(dot);
    b.onclick=()=>w.minimized?WindowManager.restore(w.id):WindowManager.focus(w.id);
    box.appendChild(b);
  });
}}
