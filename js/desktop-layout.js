window.NovaDesktopLayout=(()=>{
  const KEY='desktop-layout-v2';
  const CELL_W=104,CELL_H=104,PAD=8,HOLD_MS=180,MOVE_PX=7;
  let positions={},initialized=false,dragging=false;
  const account=()=>window.NovaAuthMode==='account';
  const box=()=>document.getElementById('desktop-icons');
  function load(){
    if(!account()){positions={};return}
    const saved=Store.load(KEY,{});
    positions=saved&&typeof saved==='object'?saved:{};
  }
  function save(){if(account())Store.save(KEY,positions)}
  function metrics(){
    const b=box();if(!b)return{cols:8,rows:6};
    const r=b.getBoundingClientRect();
    return{cols:Math.max(1,Math.floor(Math.max(1,r.width-PAD*2)/CELL_W)),rows:Math.max(1,Math.floor(Math.max(1,r.height-PAD*2)/CELL_H))};
  }
  const slotKey=(c,r)=>`${c}:${r}`;
  function occupied(excludeId=''){
    const used=new Set();
    Object.entries(positions).forEach(([id,p])=>{
      if(id===excludeId||!p)return;
      const c=Number(p.col),r=Number(p.row);
      if(Number.isInteger(c)&&Number.isInteger(r))used.add(slotKey(c,r));
    });
    return used;
  }
  function clampSlot(c,r){const m=metrics();return{col:Math.max(0,Math.min(c,m.cols-1)),row:Math.max(0,Math.min(r,m.rows-1))}}
  function nearestFree(c,r,excludeId=''){
    const m=metrics(),used=occupied(excludeId),start=clampSlot(c,r);
    if(!used.has(slotKey(start.col,start.row)))return start;
    let best=null,bestDist=Infinity;
    for(let row=0;row<m.rows;row++)for(let col=0;col<m.cols;col++){
      if(used.has(slotKey(col,row)))continue;
      const dist=Math.abs(col-start.col)+Math.abs(row-start.row);
      if(dist<bestDist){best={col,row};bestDist=dist}
    }
    return best||start;
  }
  function slotFromPointer(ev){
    const b=box();if(!b)return{col:0,row:0};
    const br=b.getBoundingClientRect();
    return clampSlot(Math.round((ev.clientX-br.left-PAD-CELL_W/2)/CELL_W),Math.round((ev.clientY-br.top-PAD-CELL_H/2)/CELL_H));
  }
  function place(el,slot){
    el.style.left=(PAD+slot.col*CELL_W)+'px';el.style.top=(PAD+slot.row*CELL_H)+'px';
    el.dataset.col=slot.col;el.dataset.row=slot.row;
  }
  function apply(){
    const b=box();if(!b)return;
    const els=[...b.querySelectorAll('.desktop-icon')],m=metrics();
    els.forEach((el,i)=>{
      const id=el.dataset.appId,p=positions[id];
      const slot=p&&Number.isInteger(p.col)&&Number.isInteger(p.row)?clampSlot(p.col,p.row):clampSlot(i%m.cols,Math.floor(i/m.cols));
      place(el,slot);
    });
  }
  function clearSelection(){box()?.querySelectorAll('.desktop-icon').forEach(x=>x.classList.remove('selected'))}
  function showSnapGrid(){
    const b=box();if(!b||b.querySelector('.desktop-snap-overlay'))return;
    const m=metrics(),o=document.createElement('div');o.className='desktop-snap-overlay';
    for(let r=0;r<m.rows;r++)for(let c=0;c<m.cols;c++){
      const s=document.createElement('span');s.style.left=(PAD+c*CELL_W)+'px';s.style.top=(PAD+r*CELL_H)+'px';s.dataset.slot=slotKey(c,r);o.appendChild(s);
    }
    b.appendChild(o);b.classList.add('is-dragging');
  }
  function highlight(slot){
    const b=box();if(!b)return;
    b.querySelectorAll('.desktop-snap-overlay span').forEach(x=>x.classList.toggle('active',x.dataset.slot===slotKey(slot.col,slot.row)));
  }
  function hideSnapGrid(){const b=box();b?.querySelector('.desktop-snap-overlay')?.remove();b?.classList.remove('is-dragging')}

  function bind(){
    const b=box();if(!b)return;
    b.querySelectorAll('.desktop-icon').forEach(el=>{
      if(el.dataset.novaDragBound==='1')return;
      el.dataset.novaDragBound='1';
      let holdTimer=null,pressed=false,draggingThis=false,pointerId=null,lastSlot=null;
      let startX=0,startY=0;
      const clearHold=()=>{if(holdTimer!==null){clearTimeout(holdTimer);holdTimer=null}};
      const cleanup=()=>{
        clearHold();
        el.removeEventListener('pointermove',onMove);
        el.removeEventListener('pointerup',onUp);
        el.removeEventListener('pointercancel',onCancel);
        pressed=false;pointerId=null;
      };
      const finishDrag=(ev)=>{
        const id=el.dataset.appId;
        const slot=nearestFree(lastSlot?.col??0,lastSlot?.row??0,id);
        place(el,slot);positions[id]={col:slot.col,row:slot.row};save();
        el.dataset.dragged='1';el.dataset.suppressClickUntil=String(Date.now()+450);
        el.classList.remove('dragging');el.classList.add('saved-pulse');
        setTimeout(()=>el.classList.remove('saved-pulse'),220);
        hideSnapGrid();dragging=false;draggingThis=false;
        ev?.preventDefault?.();ev?.stopPropagation?.();
      };
      const onMove=(ev)=>{
        if(!pressed||ev.pointerId!==pointerId)return;
        const dx=ev.clientX-startX,dy=ev.clientY-startY;
        if(!draggingThis){
          // A small accidental movement while clicking does not start a drag.
          if(Math.hypot(dx,dy)<MOVE_PX)return;
          // If the user moved before the hold threshold, treat it as a normal click attempt.
          // The hold timer remains authoritative for entering move mode.
          return;
        }
        lastSlot=slotFromPointer(ev);highlight(lastSlot);
        const br=box().getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight;
        el.style.left=Math.max(PAD,ev.clientX-br.left-w/2)+'px';
        el.style.top=Math.max(PAD,ev.clientY-br.top-h/2)+'px';
        ev.preventDefault();ev.stopPropagation();
      };
      const onUp=(ev)=>{
        if(ev.pointerId!==pointerId)return;
        clearHold();
        if(draggingThis)finishDrag(ev);
        cleanup();
      };
      const onCancel=(ev)=>{
        if(ev.pointerId!==pointerId)return;
        clearHold();
        if(draggingThis){
          const id=el.dataset.appId,p=positions[id];
          if(p)place(el,p);else apply();
          el.classList.remove('dragging');hideSnapGrid();dragging=false;draggingThis=false;
        }
        cleanup();
      };
      el.addEventListener('pointerdown',e=>{
        if(e.button!==0||dragging)return;
        pressed=true;draggingThis=false;pointerId=e.pointerId;startX=e.clientX;startY=e.clientY;lastSlot=null;
        el.dataset.dragged='0';
        clearHold();
        // Capture immediately so leaving the icon while holding cannot break the drag lifecycle.
        try{el.setPointerCapture(e.pointerId)}catch{}
        holdTimer=setTimeout(()=>{
          if(!pressed||pointerId!==e.pointerId)return;
          draggingThis=true;dragging=true;el.classList.add('dragging');showSnapGrid();
          lastSlot=slotFromPointer(e);highlight(lastSlot);
        },HOLD_MS);
        el.addEventListener('pointermove',onMove);
        el.addEventListener('pointerup',onUp);
        el.addEventListener('pointercancel',onCancel);
      });
      el.addEventListener('click',e=>{
        const until=Number(el.dataset.suppressClickUntil||0);
        if(until>Date.now()){e.preventDefault();e.stopPropagation();el.dataset.suppressClickUntil='0';return}
        clearSelection();el.classList.add('selected');
      });
      el.addEventListener('dblclick',e=>{
        if(Number(el.dataset.suppressClickUntil||0)>Date.now()){e.preventDefault();e.stopPropagation();return}
        if(el.dataset.dragged==='1'){el.dataset.dragged='0';e.preventDefault();e.stopPropagation();return}
        window.OS?.launch(el.dataset.appId);
      });
    });
  }
  function decorate(){load();apply();bind()}
  function reset(){positions={};save();decorate()}
  function arrange(){
    const b=box();if(!b)return;const m=metrics();positions={};
    [...b.querySelectorAll('.desktop-icon')].forEach((el,i)=>{const col=i%m.cols,row=Math.floor(i/m.cols);positions[el.dataset.appId]={col,row}});
    save();apply();
  }
  function init(){if(initialized){decorate();return}initialized=true;decorate();window.addEventListener('resize',()=>{if(!dragging)apply()})}
  return{init,decorate,apply,save,reset,arrange,positions:()=>({...positions})};
})();
