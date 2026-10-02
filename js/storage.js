(function(){
  const PREFIX="nova-os:";
  const defaults={
    osName:"Nova OS",theme:"midnight",accent:"#7c5cff",taskbarAlpha:.78,animations:true,
    clock24:true,wallpaper:"default",experimental:{widgets:true,glass:true,glow:false},
    history:[],bookmarks:[],
    files:[
      {id:"docs",name:"Documents",type:"folder",parent:"root"},
      {id:"downloads",name:"Downloads",type:"folder",parent:"root"},
      {id:"music",name:"Music",type:"folder",parent:"root"},
      {id:"pictures",name:"Pictures",type:"folder",parent:"root"},
      {id:"videos",name:"Videos",type:"folder",parent:"root"},
      {id:"readme",name:"Welcome.txt",type:"text",parent:"root",content:"Welcome to Nova OS!\\n\\nUse the Files app to browse your virtual workspace.\\nUse Music to play MP3 files added by the developer."}
    ]
  };
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function load(key,fallback){
    try{const raw=localStorage.getItem(PREFIX+key);return raw===null?clone(fallback):JSON.parse(raw)}
    catch(e){console.warn("Storage read failed",key,e);return clone(fallback)}
  }
  function save(key,value){try{localStorage.setItem(PREFIX+key,JSON.stringify(value));window.NovaCloud?.schedule();return true}catch(e){console.warn("Storage write failed",key,e);return false}}
  function remove(key){try{localStorage.removeItem(PREFIX+key);window.NovaCloud?.schedule()}catch(e){}}
  function getSettings(){
    const s=load("settings",defaults);if(s.theme==="dark")s.theme="midnight";if(s.theme==="light")s.theme="soft";
    return Object.assign(clone(defaults),s);
  }
  function setSettings(s){return save("settings",s)}
  function getFiles(){return load("files",defaults.files)}
  function setFiles(files){return save("files",files)}
  window.Store={defaults,load,save,remove,getSettings,setSettings,getFiles,setFiles,reset(){remove("settings")}};
})();