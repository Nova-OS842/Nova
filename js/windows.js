(function(){
  const windows=new Map();let z=20,seq=0;
  function clamp(w){
    const tb=70, maxW=Math.max(280,innerWidth-24),maxH=Math.max(180,innerHeight-tb);
    w.el.style.width=Math.min(parseInt(w.el.style.width)||w.width,maxW)+"px";
    w.el.style.height=Math.min(parseInt(w.el.style.height)||w.height,maxH)+"px";
    const rect=w.el.getBoundingClientRect();
    w.el.style.left=Math.max(8,Math.min(rect.left,innerWidth-rect.width-8))+"px";
    w.el.style.top=Math.max(8,Math.min(rect.top,innerHeight-rect.height-tb))+"px";
  }
  function drag(w,e){
    if(w.maximized||e.target.closest(".window-controls"))return;
    const startX=e.clientX,startY=e.clientY,r=w.el.getBoundingClientRect(),sx=r.left,sy=r.top;
    const move=ev=>{w.el.style.left=(sx+ev.clientX-startX)+"px";w.el.style.top=(sy+ev.clientY-startY)+"px";clamp(w)};
    const up=()=>{removeEventListener("pointermove",move);removeEventListener("pointerup",up);snapFromEdge(w);remember(w)};
    addEventListener("pointermove",move);addEventListener("pointerup",up);
  }
  function resize(w,e,type){
    if(w.maximized)return;
    e.preventDefault();
    e.stopPropagation();
    const el=w.el;
    const r=el.getBoundingClientRect();
    const sx=e.clientX,sy=e.clientY,sw=r.width,sh=r.height,sl=r.left,st=r.top;
    const minW=320,minH=190;
    el.classList.add("resizing");
    const move=ev=>{
      let dx=ev.clientX-sx,dy=ev.clientY-sy;
      let left=sl,top=st,width=sw,height=sh;
      if(type.includes("e")) width=Math.max(minW,sw+dx);
      if(type.includes("s")) height=Math.max(minH,sh+dy);
      if(type.includes("w")){ width=Math.max(minW,sw-dx); left=sl+(sw-width); }
      if(type.includes("n")){ height=Math.max(minH,sh-dy); top=st+(sh-height); }
      el.style.left=left+"px";
      el.style.top=top+"px";
      el.style.width=width+"px";
      el.style.height=height+"px";
      // Keep the window usable without fighting the user's drag.
      const rr=el.getBoundingClientRect();
      if(rr.right>innerWidth-8 && type.includes("w")) el.style.left=Math.max(8,innerWidth-width-8)+"px";
      if(rr.bottom>innerHeight-78 && type.includes("n")) el.style.top=Math.max(8,innerHeight-height-78)+"px";
    };
    const stop=()=>{
      el.classList.remove("resizing");
      el.releasePointerCapture?.(e.pointerId);
      removeEventListener("pointermove",move);
      removeEventListener("pointerup",stop);
      removeEventListener("pointercancel",stop);
      remember(w);
      el.dataset.resizeEdge="";
    };
    el.setPointerCapture?.(e.pointerId);
    addEventListener("pointermove",move);
    addEventListener("pointerup",stop,{once:true});
    addEventListener("pointercancel",stop,{once:true});
  }
  function resizeEdge(el,x,y){
    const r=el.getBoundingClientRect(),m=9;
    if(x<r.left-m||x>r.right+m||y<r.top-m||y>r.bottom+m)return '';
    let edge='';
    if(y-r.top<=m)edge+='n';
    else if(r.bottom-y<=m)edge+='s';
    if(x-r.left<=m)edge+='w';
    else if(r.right-x<=m)edge+='e';
    return edge;
  }
  function open(appId,app){
    const id=appId+'#'+(++seq);const remembered=Store.load('window-state',{})[appId]||{};
    
    const el=document.createElement("article");el.className="window";el.dataset.appId=appId;el.dataset.desktop=String(window.NovaShell?.currentDesktop?.()??0);
    el.style.width=(app.width||720)+"px";el.style.height=(app.height||480)+"px";
    el.style.left=(remembered.left??(90+(seq%5)*35))+"px";el.style.top=(remembered.top??(45+(seq%5)*30))+"px";if(remembered.width)el.style.width=remembered.width+'px';if(remembered.height)el.style.height=remembered.height+'px';
    el.innerHTML=`<header class="window-header"><div class="window-title"><img src="${app.icon}" alt=""><strong></strong></div><div class="window-controls"><button data-action="min" title="Minimize">—</button><button data-action="max" title="Maximize">□</button><button data-action="close" class="close" title="Close">×</button></div></header><div class="window-body"></div>`;
    el.querySelector("strong").textContent=app.name;document.getElementById("window-layer").appendChild(el);
    const w={id,el,maximized:false,minimized:false,app,cleanup:null};
    windows.set(id,w);focus(id);
    el.addEventListener("pointerdown",()=>focus(id));
    el.querySelector(".window-header").addEventListener("pointerdown",e=>drag(w,e));
    // Edge/corner hit testing is handled globally so every app window gets identical Windows-style resizing.
    el.addEventListener("pointermove",e=>{
      if(w.maximized||el.classList.contains("resizing"))return;
      const edge=resizeEdge(el,e.clientX,e.clientY);
      el.dataset.resizeEdge=edge;
    });
    el.querySelector('[data-action="min"]').onclick=()=>minimize(id);
    el.querySelector('[data-action="max"]').onclick=()=>toggleMax(id);
    el.querySelector('[data-action="close"]').onclick=()=>close(id);

    if(typeof app.mount==="function")w.cleanup=app.mount(el.querySelector(".window-body"),w);
    clamp(w);window.Taskbar?.refresh();return w;
  }
  function remember(w){if(!w||w.maximized)return;const all=Store.load('window-state',{});const r=w.el.getBoundingClientRect();all[w.el.dataset.appId]={left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)};Store.save('window-state',all)}
  function focus(id){const w=windows.get(id);if(!w)return;w.minimized=false;w.el.classList.remove("minimized");w.el.style.zIndex=++z;Taskbar?.refresh()}
  function minimize(id){const w=windows.get(id);if(!w)return;w.minimized=true;w.el.classList.add("minimized");Taskbar?.refresh()}
  function snapFromEdge(w){if(!w||w.maximized)return;const r=w.el.getBoundingClientRect(),edge=18;if(r.left<=edge){snap(w,"ArrowLeft");return}if(r.right>=innerWidth-edge){snap(w,"ArrowRight");return}if(r.top<=edge){snap(w,"ArrowUp")}}
  function snap(w,key){if(!w)return;w.maximized=false;w.el.classList.remove("maximized");const gap=8,tb=70;
    if(key==="ArrowLeft"){w.el.style.left=gap+"px";w.el.style.top=gap+"px";w.el.style.width=Math.max(320,Math.floor(innerWidth/2-gap*1.5))+"px";w.el.style.height=Math.max(190,innerHeight-tb-gap)+"px"}
    else if(key==="ArrowRight"){w.el.style.left=(Math.floor(innerWidth/2)+2)+"px";w.el.style.top=gap+"px";w.el.style.width=Math.max(320,Math.floor(innerWidth/2-gap*1.5))+"px";w.el.style.height=Math.max(190,innerHeight-tb-gap)+"px"}
    else if(key==="ArrowUp"){w.el.style.left=gap+"px";w.el.style.top=gap+"px";w.el.style.width=Math.max(320,innerWidth-gap*2)+"px";w.el.style.height=Math.max(190,Math.floor(innerHeight/2)-gap)+"px"}
    else if(key==="ArrowDown"){w.el.style.left=gap+"px";w.el.style.top=Math.floor(innerHeight/2)+"px";w.el.style.width=Math.max(320,innerWidth-gap*2)+"px";w.el.style.height=Math.max(190,Math.floor(innerHeight/2)-tb-gap)+"px"}
    focus(w.id);remember(w)
  }
  function toggleMax(id){const w=windows.get(id);if(!w)return;if(w.maximized){w.maximized=false;w.el.classList.remove("maximized")}else{w.maximized=true;w.el.classList.add("maximized")}focus(id)}
  function restore(id){const w=windows.get(id);if(!w)return;w.minimized=false;w.el.classList.remove("minimized");focus(id)}
  function close(id){const w=windows.get(id);if(!w)return;if(w.cleanup)try{w.cleanup()}catch(e){};w.el.classList.add("closing");setTimeout(()=>{w.el.remove();windows.delete(id);Taskbar?.refresh()},150)}
  // Capture resize starts before an app's buttons/content/header can consume the pointer event.
  document.addEventListener("pointerdown",e=>{
    const el=e.target.closest?.(".window");
    if(!el)return;
    const w=[...windows.values()].find(x=>x.el===el);
    if(!w||w.maximized||e.target.closest(".window-controls"))return;
    const edge=resizeEdge(el,e.clientX,e.clientY);
    if(!edge)return;
    e.preventDefault();
    e.stopPropagation();
    el.dataset.resizeEdge=edge;
    resize(w,e,edge);
  },true);
  document.addEventListener("pointermove",e=>{
    if(e.buttons)return;
    const el=e.target.closest?.(".window");
    document.querySelectorAll(".window[data-resize-edge]").forEach(x=>{if(x!==el)x.dataset.resizeEdge=""});
    if(!el)return;
    const w=[...windows.values()].find(x=>x.el===el);
    if(!w||w.maximized||el.classList.contains("resizing"))return;
    el.dataset.resizeEdge=resizeEdge(el,e.clientX,e.clientY);
  });
  addEventListener("resize",()=>windows.forEach(clamp));
  window.WindowManager={open,focus,minimize,restore,close,toggleMax,snap:(id,key)=>{const w=windows.get(id);if(w)snap(w,key)},all:()=>[...windows.values()],get:id=>windows.get(id)||[...windows.values()].find(w=>w.el.dataset.appId===id)};
})();