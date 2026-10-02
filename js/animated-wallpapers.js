window.NovaAnimatedWallpapers=(()=>{
  let canvas,ctx,raf=0,last=0,resizeHandler=null;
  const names=new Set(['animated-aurora','animated-neon','animated-stars','animated-plasma','animated-ocean']);
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;if(resizeHandler)window.removeEventListener('resize',resizeHandler);resizeHandler=null;canvas?.remove();canvas=null;ctx=null}
  function setup(){stop();canvas=document.createElement('canvas');canvas.className='nova-animated-wallpaper';canvas.setAttribute('aria-hidden','true');document.querySelector('.desktop')?.prepend(canvas);ctx=canvas.getContext('2d',{alpha:false});resizeHandler=resize;resize();last=performance.now();raf=requestAnimationFrame(draw)}
  function resize(){if(!canvas)return;const d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.floor(innerWidth*d);canvas.height=Math.floor(innerHeight*d);canvas.style.width='100%';canvas.style.height='100%';ctx.setTransform(d,0,0,d,0,0)}
  function blob(x,y,r,color,a){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=a;ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}
  function draw(t){const w=innerWidth,h=innerHeight,dt=Math.min(40,t-last);last=t;ctx.clearRect(0,0,w,h);ctx.fillStyle='#060912';ctx.fillRect(0,0,w,h);const mode=window.NovaAnimatedWallpapers.current||'animated-aurora';
    if(mode==='animated-aurora'){
      blob(w*.18+Math.sin(t*.00018)*w*.12,h*.28+Math.cos(t*.00021)*h*.12,w*.42,'#7c5cff',.55);blob(w*.78+Math.cos(t*.00016)*w*.13,h*.24+Math.sin(t*.00019)*h*.14,w*.38,'#25c7e8',.48);blob(w*.55+Math.sin(t*.00011)*w*.16,h*.82+Math.cos(t*.00015)*h*.08,w*.42,'#45d47a',.28);
    } else if(mode==='animated-neon'){
      ctx.strokeStyle='rgba(77,163,255,.22)';ctx.lineWidth=1;const horizon=h*.58;for(let i=-20;i<=20;i++){const x=w/2+i*55;ctx.beginPath();ctx.moveTo(w/2+(x-w/2)*.12,horizon);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<14;y++){const p=y/14;const yy=horizon+Math.pow(p,1.8)*(h-horizon);ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(w,yy);ctx.stroke()}blob(w*.28,h*.25,220,'#ff3fd2',.28);blob(w*.72,h*.28,250,'#54f5ff',.25);
    } else if(mode==='animated-stars'){
      for(let i=0;i<90;i++){const x=(i*137.5)%w,y=(i*79.3)%h,s=.6+((i*17)%10)/10;ctx.fillStyle=`rgba(255,255,255,${.25+.45*Math.abs(Math.sin(t*.001+i))})`;ctx.fillRect(x,y,s,s)}blob(w*.35,h*.35,330,'#5d45c7',.28);blob(w*.7,h*.65,300,'#1b7890',.2);
    } else if(mode==='animated-plasma'){
      for(let y=0;y<h;y+=8){const wave=Math.sin(y*.018+t*.0014)*.5+.5;const grad=ctx.createLinearGradient(0,0,w,0);grad.addColorStop(0,`rgba(124,92,255,${.10+wave*.16})`);grad.addColorStop(.5,`rgba(255,63,210,${.08+wave*.14})`);grad.addColorStop(1,`rgba(84,245,255,${.10+wave*.16})`);ctx.fillStyle=grad;ctx.fillRect(0,y,w,9)}
    } else if(mode==='animated-ocean'){
      ctx.fillStyle='#06131f';ctx.fillRect(0,0,w,h);for(let j=0;j<7;j++){ctx.beginPath();ctx.moveTo(0,h*.45+j*55);for(let x=0;x<=w;x+=16){const y=h*.45+j*55+Math.sin(x*.012+t*.0012+j)*14+Math.sin(x*.004-t*.0008)*9;ctx.lineTo(x,y)}ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fillStyle=`rgba(20,${95+j*12},${145+j*10},${.12+j*.018})`;ctx.fill()}}
    raf=requestAnimationFrame(draw)
  }
  function apply(name){window.NovaAnimatedWallpapers.current=name||'';if(names.has(name)){setup()}else stop()}
  return{apply,names,current:''};
})();