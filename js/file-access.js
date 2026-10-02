window.NovaFileAccess=(function(){
  const DB='nova-file-access',STORE='handles';let rootHandle=null,files=[];
  function openDB(){return new Promise((resolve,reject)=>{if(!indexedDB)return reject(new Error('IndexedDB unavailable'));const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  async function saveHandle(handle){try{const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(handle,'root');tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close()}catch(e){}}
  async function loadHandle(){try{const db=await openDB();const h=await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly');const r=tx.objectStore(STORE).get('root');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});db.close();return h}catch(e){return null}}
  async function permission(handle,write=false){if(!handle)return false;const opts={mode:write?'readwrite':'read'};if(handle.queryPermission&&await handle.queryPermission(opts)==='granted')return true;if(handle.requestPermission&&await handle.requestPermission(opts)==='granted')return true;return false}
  async function scan(handle,parent=''){const out=[];for await(const [name,entry] of handle.entries()){const path=parent?parent+'/'+name:name;if(entry.kind==='directory'){out.push({id:'ext-folder:'+path,name,type:'folder',path,external:true});out.push(...await scan(entry,path))}else{let size=0,lastModified=0;try{const f=await entry.getFile();size=f.size;lastModified=f.lastModified}catch(e){}out.push({id:'ext-file:'+path,name,type:'file',path,external:true,handle:entry,size,lastModified})}}return out}
  async function connect(){
    if(!window.showDirectoryPicker){return fallback()}
    try{rootHandle=await showDirectoryPicker({mode:'read'});if(!(await permission(rootHandle)))throw new Error('Permission was not granted');await saveHandle(rootHandle);files=await scan(rootHandle);return {ok:true,count:files.filter(f=>f.type==='file').length,name:rootHandle.name}}
    catch(e){if(e.name==='AbortError')return {ok:false,cancelled:true};return {ok:false,error:e.message||'Unable to access that folder'}}
  }
  function fallback(){return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.multiple=true;input.setAttribute('webkitdirectory','');input.setAttribute('directory','');input.onchange=()=>{files=[...input.files].map(f=>({id:'fallback:'+f.webkitRelativePath,name:f.name,type:'file',path:f.webkitRelativePath,external:true,file:f,size:f.size,lastModified:f.lastModified}));resolve({ok:true,count:files.length,name:(input.files[0]?.webkitRelativePath||'').split('/')[0]||'Selected files',fallback:true})};input.click()})}
  async function restore(){const h=await loadHandle();if(!h)return {ok:false};if(!(await permission(h)))return {ok:false,needsPermission:true};rootHandle=h;files=await scan(h);return {ok:true,count:files.filter(f=>f.type==='file').length,name:h.name}}
  async function readFile(entry){if(entry.file)return entry.file;if(entry.handle)return entry.handle.getFile();throw new Error('File is unavailable')}
  function list(){return files.slice()}
  function disconnect(){rootHandle=null;files=[]}
  async function removeSaved(){try{const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete('root');tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close()}catch(e){}disconnect()}
  return{connect,restore,readFile,list,disconnect,removeSaved,hasAccess:()=>!!rootHandle}
})();
