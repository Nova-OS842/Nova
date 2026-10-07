window.NovaCloud=(()=>{
  const PREFIX='nova-os:'; const MAX=4*1024*1024; let timer=null; let syncing=false;
  const ignored=new Set(['nova-device-id']);
  function snapshot(){
    const data={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i); if(!key||!key.startsWith(PREFIX)||ignored.has(key.slice(PREFIX.length)))continue;
      const raw=localStorage.getItem(key); if(raw==null)continue;
      try{data[key]=JSON.parse(raw)}catch{data[key]=raw}
    }
    return data;
  }
  function restore(data){
    if(!data||typeof data!=='object')return;
    syncing=true;
    try{Object.entries(data).forEach(([key,value])=>{if(!key.startsWith(PREFIX)||ignored.has(key.slice(PREFIX.length)))return;localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value))})}finally{syncing=false}
  }
  async function request(path,opts={}){const r=await fetch(path,{credentials:'include',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||'Cloud sync failed');return d}
  async function sync(){
    if(syncing||window.NovaAuthMode!=='account')return false;
    syncing=true;
    try{
      const local=snapshot();
      const remote=await request('/api/sync');
      if(remote.cloud&&remote.updatedAt){restore(remote.cloud)}
      const payload=snapshot();
      const size=JSON.stringify(payload).length;
      if(size>MAX)throw new Error('Nova Cloud data is too large.');
      await request('/api/sync',{method:'PUT',body:JSON.stringify({data:payload,clientUpdatedAt:Date.now()})});
      return true;
    }catch(e){console.warn('Nova Cloud:',e.message);return false}
    finally{syncing=false}
  }
  function schedule(){if(syncing||window.NovaAuthMode!=='account')return;clearTimeout(timer);timer=setTimeout(()=>sync(),2500)}
  return{sync,schedule,snapshot};
})();