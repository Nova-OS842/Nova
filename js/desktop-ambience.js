/* Nova Desktop 7.0 — lightweight ambient depth layer. Never changes desktop layout. */
(function(){
  const boot=()=>{
    const desktop=document.getElementById('desktop');
    if(!desktop||desktop.dataset.novaAmbience==='1')return;
    desktop.dataset.novaAmbience='1';
    const field=document.createElement('div');
    field.className='nova-ambient-field';
    field.setAttribute('aria-hidden','true');
    const points=[
      [8,16,1.2,0],[18,30,.8,1.4],[29,12,1,2.1],[41,23,.7,.7],[53,10,1.1,1.8],[65,31,.8,1.1],[77,14,1.2,.3],[89,38,.7,2.6],
      [12,58,.7,1.7],[25,72,1.1,.5],[38,61,.8,2.4],[49,81,1.2,1.2],[61,67,.7,.2],[73,86,1,2.2],[86,63,.8,1.5],[94,78,1.1,.8]
    ];
    points.forEach(([x,y,s,d])=>{
      const star=document.createElement('i');
      star.style.left=x+'%';star.style.top=y+'%';star.style.setProperty('--s',s);star.style.animationDelay=(-d)+'s';
      field.appendChild(star);
    });
    desktop.prepend(field);
    const move=(e)=>{
      if(document.body.classList.contains('no-animations'))return;
      const r=desktop.getBoundingClientRect();
      const x=((e.clientX-r.left)/Math.max(1,r.width)-.5)*2;
      const y=((e.clientY-r.top)/Math.max(1,r.height)-.5)*2;
      desktop.style.setProperty('--nova-mx',(x*10).toFixed(2)+'px');
      desktop.style.setProperty('--nova-my',(y*7).toFixed(2)+'px');
    };
    desktop.addEventListener('pointermove',move,{passive:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
