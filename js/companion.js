window.NovaCompanion=(function(){
  const KEY='nova-os:companion';
  const defaults={enabled:true,personality:'chill',size:1,position:'right',messages:true,appearance:'classic'};
  let state=Object.assign({},defaults,Store?.load?.('companion',{})||{}), root, bubble, panel, timer;
  const q=s=>root?.querySelector(s);
  const save=()=>{try{Store.save('companion',state)}catch(e){}};
  const messages={
    welcome:['Welcome back!','Good to see you again.','Nova is ready.'],
    games:['Game time? 🎮','I found something you might like.','Ready to play?'],
    movies:['Movie night? 🍿','Nova Watch has something for you.','Popcorn acquired.'],
    music:['Music time. 🎧','Let’s put something on.','I like this one.'],
    beatlab:['Making a beat? 🎹','Let’s make some noise.','That rhythm is coming together.'],
    discovery:['You have not explored this part of Nova yet.','There is still more to discover.','Want to see something new?'],
    idle:['You have been quiet for a while.','Still here? I am just hanging out.','Nova is taking a tiny break.'],
    achievement:['Nice! You unlocked something. ✨','That deserves a celebration!','Achievement detected!'],
    install:['New app unlocked!','Your Nova collection just grew.','Fresh app installed.']
  };
  function pick(list){return list[Math.floor(Math.random()*list.length)]}
  function say(text,kind='general',action){
    if(!state.enabled||!state.messages)return;
    if(!bubble)return;
    bubble.classList.remove('show');
    setTimeout(()=>{bubble.textContent=text;bubble.classList.add('show');root.classList.remove('react-happy','react-excited','react-curious','react-surprised','react-sleepy');root.classList.add(kind==='achievement'?'react-excited':kind==='discovery'?'react-curious':'react-happy');if(action)bubble.dataset.action=action;else delete bubble.dataset.action;clearTimeout(timer);timer=setTimeout(()=>bubble.classList.remove('show'),6200)},40);
  }
  function react(type='happy'){if(!root)return;root.classList.remove('react-happy','react-excited','react-curious','react-surprised','react-sleepy');root.classList.add('react-'+type);clearTimeout(root._reactTimer);root._reactTimer=setTimeout(()=>root.classList.remove('react-'+type),2200)}
  function onAppLaunch(id){const map={games:'games',movies:'movies',music:'music',beatlab:'beatlab'};if(map[id]){react(id==='beatlab'?'excited':'happy');setTimeout(()=>say(pick(messages[map[id]]),id==='beatlab'?'achievement':'general'),350)}else if(['settings','appstore'].includes(id)){react('curious')}}
  function onInstall(id){react('excited');setTimeout(()=>say(pick(messages.install),'achievement'),300)}
  function openPanel(){panel?.classList.toggle('show');if(panel?.classList.contains('show'))renderPanel()}
  function renderPanel(){if(!panel)return;panel.innerHTML=`<div class="companion-panel-head"><div><strong>Nova Companion</strong><small>Your little Nova sidekick</small></div><button type="button" class="companion-x">×</button></div><div class="companion-preview"><img src="assets/companion/nova.svg" alt="Nova companion"><div><strong>${state.appearance==='classic'?'Classic Nova':state.appearance}</strong><small>Always here when you need it.</small></div></div><label class="companion-option">Personality<select id="comp-personality"><option value="chill">Chill</option><option value="energetic">Energetic</option><option value="curious">Curious</option><option value="quiet">Quiet</option></select></label><label class="companion-option">Size<input id="comp-size" type="range" min=".75" max="1.35" step=".05" value="${state.size}"></label><label class="companion-toggle"><input id="comp-messages" type="checkbox" ${state.messages?'checked':''}> <span>Companion messages</span></label><button type="button" class="companion-panel-btn" id="comp-test">Test Nova reaction</button><button type="button" class="companion-panel-btn ghost" id="comp-hide">Hide Companion</button>`;
    panel.querySelector('#comp-personality').value=state.personality;
    panel.querySelector('#comp-personality').onchange=e=>{state.personality=e.target.value;save();react(e.target.value==='energetic'?'excited':'happy')};
    panel.querySelector('#comp-size').oninput=e=>{state.size=Number(e.target.value);save();apply()};
    panel.querySelector('#comp-messages').onchange=e=>{state.messages=e.target.checked;save()};
    panel.querySelector('#comp-test').onclick=()=>{react('excited');say('Hey! I’m Nova. 👋','achievement')};
    panel.querySelector('#comp-hide').onclick=()=>{state.enabled=false;save();apply();panel.classList.remove('show')};
    panel.querySelector('.companion-x').onclick=()=>panel.classList.remove('show');
  }
  function apply(){if(!root)return;root.classList.toggle('hidden',!state.enabled);root.style.setProperty('--nova-size',state.size);root.classList.toggle('left',state.position==='left')}
  function init(){
    if(document.getElementById('nova-companion'))return;
    root=document.createElement('aside');root.id='nova-companion';root.setAttribute('aria-label','Nova Companion');root.innerHTML=`<div class="companion-bubble" role="status"></div><button type="button" class="companion-body" aria-label="Open Nova Companion"><span class="companion-aura"></span><img src="assets/companion/nova.svg" alt="Nova"></button><div class="companion-panel"></div>`;document.getElementById('desktop')?.append(root);bubble=root.querySelector('.companion-bubble');panel=root.querySelector('.companion-panel');root.querySelector('.companion-body').onclick=openPanel;apply();
    const seen=Store.load('companion-seen',false);if(!seen){Store.save('companion-seen',true);setTimeout(()=>say(pick(messages.welcome),'achievement'),1200)}
    let last=Date.now();document.addEventListener('pointerdown',()=>last=Date.now());setInterval(()=>{if(Date.now()-last>8*60*1000&&state.enabled){react('sleepy');say(pick(messages.idle),'idle');last=Date.now()}},60000);
  }
  return {init,say,react,onAppLaunch,onInstall,openPanel,apply};
})();
