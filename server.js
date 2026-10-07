const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),dns=require('dns').promises,net=require('net');
const ROOT=__dirname;
const DEFAULT_DATA_DIR=path.join(ROOT,'data');
const ENV_DATA_DIR=String(process.env.NOVA_PERSISTENT_DATA_DIR||'').trim();
const DATA_DIR=DEFAULT_DATA_DIR;
const CATALOG_DIR=ENV_DATA_DIR?path.resolve(ENV_DATA_DIR):DATA_DIR;
const DB=path.join(DATA_DIR,'data.json'),ACCOUNTS_FILE=path.join(DATA_DIR,'accounts.json'),MOVIES_FILE=path.join(CATALOG_DIR,'movies.json'),SHOWS_JSON_FILE=path.join(CATALOG_DIR,'shows.json'),PORT=Number(process.env.PORT||8080),HOST=String(process.env.HOST||'0.0.0.0');
let DEV_PASSWORD_CONFIG={passwords:[]};
try{DEV_PASSWORD_CONFIG=require(path.join(ROOT,'config','developer-config.js'))||DEV_PASSWORD_CONFIG}catch{}
const MAX_BODY=4*1024*1024, MAX_GAME_UPLOAD=20*1024*1024, LIVE_WALLPAPER_UPLOAD_MAX=1024*1024*1024, SESSION_MAX_AGE=2592000, STATIC_MAX_AGE=86400, PRESENCE_TTL=35000, DB_BACKUP=DB+'.bak';
fs.mkdirSync(DATA_DIR,{recursive:true});
if(CATALOG_DIR!==DATA_DIR){
  fs.mkdirSync(CATALOG_DIR,{recursive:true});
  for(const name of ['movies.json','movies.js','shows.json','shows.js']){
    const source=path.join(DATA_DIR,name),target=path.join(CATALOG_DIR,name);
    try{if(fs.existsSync(source)&&!fs.existsSync(target))fs.copyFileSync(source,target)}catch(e){console.warn('Catalog migration failed for '+name+':',e.message)}
  }
}
let db={users:{},sessions:{}};
try{db=JSON.parse(fs.readFileSync(DB,'utf8'))}catch{try{db=JSON.parse(fs.readFileSync(DB_BACKUP,'utf8'));console.warn('Nova database restored from backup.')}catch{}}
// Player accounts live in their own portable file so OS/server updates never replace them.
let accountStore={version:1,users:{}};
try{accountStore=JSON.parse(fs.readFileSync(ACCOUNTS_FILE,'utf8'))||accountStore}catch{}
accountStore.users??={};
if(!Object.keys(accountStore.users).length && Object.keys(db.users||{}).length){accountStore.users=db.users;try{fs.writeFileSync(ACCOUNTS_FILE,JSON.stringify(accountStore,null,2)+'\n')}catch{}}
db.users=accountStore.users;
db.sessions??={};db.presence??={};db.banned??={};db.tiktok??={posts:[],follows:{},profiles:{}};db.system??={online:true};
let saveTimer=null,saveRunning=false,saveQueued=false;
function saveSync(){clearTimeout(saveTimer);saveTimer=null;const snapshot=JSON.stringify(db);const tmp=DB+'.tmp',accountSnapshot=JSON.stringify({version:1,users:db.users},null,2),accountTmp=ACCOUNTS_FILE+'.tmp';try{fs.mkdirSync(DATA_DIR,{recursive:true});if(fs.existsSync(DB))try{fs.copyFileSync(DB,DB_BACKUP)}catch{};fs.writeFileSync(tmp,snapshot);fs.renameSync(tmp,DB);fs.writeFileSync(accountTmp,accountSnapshot+'\n');fs.renameSync(accountTmp,ACCOUNTS_FILE)}catch(e){console.error('Database save failed:',e.message)}}
async function flushSave(){if(saveRunning)return;saveRunning=true;try{while(saveQueued){saveQueued=false;const snapshot=JSON.stringify(db),tmp=DB+'.tmp';try{await fs.promises.mkdir(DATA_DIR,{recursive:true});await fs.promises.writeFile(tmp,snapshot);await fs.promises.rename(tmp,DB)}catch(e){console.error('Database async save failed:',e.message)}}}finally{saveRunning=false}}
function queueSave(){clearTimeout(saveTimer);saveQueued=true;saveTimer=setTimeout(()=>{saveTimer=null;flushSave()},120)}
const clients=new Map(),rooms=new Map(),rateBuckets=new Map(),devSessions=new Map();
const DEV_PASSWORDS=[...(Array.isArray(DEV_PASSWORD_CONFIG.passwords)?DEV_PASSWORD_CONFIG.passwords:[]),...String(process.env.NOVA_DEV_PASSWORDS||process.env.NOVA_DEV_PASSWORD||'').split(',')].map(x=>String(x||'').trim()).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i);
const DEV_SESSION_MAX_AGE=12*60*60*1000;
const catalogCache={games:{at:0,data:[]},music:{at:0,data:[]},movies:{at:0,data:[]},downloads:{at:0,data:[]}};
const CATALOG_TTL=3000;
const GAMES_META_FILE=path.join(DATA_DIR,'games.js'),SHOWS_FILE=path.join(DATA_DIR,'shows.js');
const TIKTOK_UPLOAD_MAX=30*1024*1024;
const LIVE_WALLPAPER_DIR=path.join(DATA_DIR,'live-wallpapers'),LIVE_WALLPAPER_META=path.join(DATA_DIR,'live-wallpapers.json'),LIVE_WALLPAPER_TMP=path.join(DATA_DIR,'live-wallpaper-uploads');
fs.mkdirSync(LIVE_WALLPAPER_DIR,{recursive:true});fs.mkdirSync(LIVE_WALLPAPER_TMP,{recursive:true});
let liveWallpapers=[];
try{liveWallpapers=JSON.parse(fs.readFileSync(LIVE_WALLPAPER_META,'utf8'))||[]}catch{}
if(!Array.isArray(liveWallpapers))liveWallpapers=[];
function saveLiveWallpapers(){const tmp=LIVE_WALLPAPER_META+'.tmp';fs.writeFileSync(tmp,JSON.stringify(liveWallpapers,null,2)+'\n');fs.renameSync(tmp,LIVE_WALLPAPER_META)}
function safeWallpaperName(name){return safeFileName(path.basename(String(name||'wallpaper.mp4'))).replace(/\s+/g,'-').slice(0,100)||'wallpaper.mp4'}
function publicWallpapers(){return liveWallpapers.map(x=>({id:x.id,name:x.name,size:x.size,createdAt:x.createdAt,url:'/api/live-wallpapers/file/'+encodeURIComponent(x.id)})).filter(x=>fs.existsSync(path.join(LIVE_WALLPAPER_DIR,liveWallpapers.find(y=>y.id===x.id)?.file||'')))}

function devToken(){return crypto.randomBytes(32).toString('hex')}
function devAuth(req){const m=(req.headers.cookie||'').match(/(?:^|;\s*)nova_dev_session=([a-f0-9]{64})(?:;|$)/);const t=m&&m[1],entry=t&&devSessions.get(t);if(!entry)return null;if(entry.expires<Date.now()){devSessions.delete(t);return null}return t}
function purgeExpiredBans(){let changed=false;const now=Date.now();for(const [key,ban] of Object.entries(db.banned||{})){if(Number(ban.expiresAt||0)>0&&Number(ban.expiresAt)<=now){delete db.banned[key];changed=true}}if(changed)queueSave()}
function getBanByKey(key){purgeExpiredBans();return key&&db.banned&&db.banned[key]||null}
function isBannedKey(key){return !!getBanByKey(key)}
function requestIp(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()}
function isDeviceBanned(){return null}
function invalidateUserSessions(key){for(const [sid,k] of Object.entries(db.sessions))if(k===key)delete db.sessions[sid]}
function requireDev(req,res){if(!DEV_PASSWORDS.length){json(res,503,{error:'Developer access is not configured on this server. Set NOVA_DEV_PASSWORDS.'});return false}if(!devAuth(req)){json(res,403,{error:'Developer authorization required.'});return false}return true}
function invalidateCatalogs(){catalogCache.games.at=0;catalogCache.movies.at=0}
function readJsonArray(file){
  try{const parsed=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(parsed)?parsed:null}catch{return null}
}
function readMoviesSource(){
  const json=readJsonArray(MOVIES_FILE);
  if(json)return json;
  const file=path.join(CATALOG_DIR,'movies.js');
  let source='';try{source=fs.readFileSync(file,'utf8')}catch{}
  const match=source.match(/window\.NOVA_MOVIES\s*=\s*(\[[\s\S]*?\])\s*;/);
  if(match){try{const parsed=JSON.parse(match[1]);if(Array.isArray(parsed))return parsed}catch(e){console.warn('Movie catalog parse failed:',e.message)}}
  return [];
}
function writeMoviesSource(items){
  const clean=Array.isArray(items)?items:[];
  const jsonText=JSON.stringify(clean,null,2)+'\n';
  const jsonTmp=MOVIES_FILE+'.tmp';fs.mkdirSync(CATALOG_DIR,{recursive:true});fs.writeFileSync(jsonTmp,jsonText);fs.renameSync(jsonTmp,MOVIES_FILE);
  const header='// NOVA WATCH MOVIE CATALOG — developer-managed persistent catalog.\n// The JSON catalog is the server source of truth; this JS file is the browser-compatible mirror.\n';
  const jsText=header+'window.NOVA_MOVIES = '+jsonText+';\n';
  const jsFile=path.join(CATALOG_DIR,'movies.js'),jsTmp=jsFile+'.tmp';fs.writeFileSync(jsTmp,jsText);fs.renameSync(jsTmp,jsFile);
  invalidateCatalogs();
}
function readGameLinksSource(){
  let source='';try{source=fs.readFileSync(GAMES_META_FILE,'utf8')}catch{}
  const match=source.match(/window\.NovaGameLinks\s*=\s*(\[[\s\S]*?\])\s*;/);
  if(!match)return [];try{const parsed=JSON.parse(match[1]);return Array.isArray(parsed)?parsed:[]}catch{return []}
}
function writeGameLinksSource(links){
  let source='';try{source=fs.readFileSync(GAMES_META_FILE,'utf8')}catch{source='window.NovaGameMeta = {};\n'}
  const line=/window\.NovaGameLinks\s*=\s*(\[[\s\S]*?\])\s*;/.test(source)?source.replace(/window\.NovaGameLinks\s*=\s*(\[[\s\S]*?\])\s*;/,'window.NovaGameLinks = '+JSON.stringify(links,null,2)+';') : source+'\nwindow.NovaGameLinks = '+JSON.stringify(links,null,2)+';\n';
  const tmp=GAMES_META_FILE+'.tmp';fs.writeFileSync(tmp,line);fs.renameSync(tmp,GAMES_META_FILE);invalidateCatalogs();
}
function addGameMeta(file,meta){
  let source='';try{source=fs.readFileSync(GAMES_META_FILE,'utf8')}catch{}
  const close=source.indexOf('};',source.indexOf('window.NovaGameMeta'));
  if(close<0)throw new Error('Game catalog format is invalid.');
  const entry='  '+JSON.stringify(file)+': '+JSON.stringify({title:meta.title||titleFromGameFile(file),description:meta.description||'Ready to play in Nova.',poster:meta.poster||'',emoji:meta.emoji||''})+',\n';
  const updated=source.slice(0,close)+entry+source.slice(close);const tmp=GAMES_META_FILE+'.tmp';fs.writeFileSync(tmp,updated);fs.renameSync(tmp,GAMES_META_FILE);invalidateCatalogs();
}
function safeUploadName(name){return safeFileName(path.basename(String(name||'game.html'))).replace(/\s+/g,'-').slice(0,100)}
function parseMultipart(buffer,boundary){
  const delim=Buffer.from('--'+boundary),out=[];let pos=0;
  while(true){const start=buffer.indexOf(delim,pos);if(start<0)break;const next=buffer.indexOf(delim,start+delim.length);if(next<0)break;let part=buffer.slice(start+delim.length,next);pos=next;part=part.slice(0,part.length-2);if(part.length<2)continue;const sep=part.indexOf(Buffer.from('\r\n\r\n'));if(sep<0)continue;const headers=part.slice(0,sep).toString('utf8');const content=part.slice(sep+4);const disp=headers.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);if(!disp)continue;out.push({name:disp[1],filename:disp[2]||'',content});}
  return out;
}

function titleFromGameFile(file){
  const raw=path.parse(file).name.replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
  return raw.replace(/\b\w/g,c=>c.toUpperCase())||'Game';
}
function syncGamesMeta(){
  const dir=path.join(ROOT,'games');
  fs.mkdirSync(dir,{recursive:true});
  const files=fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()&&/\.html?$/i.test(x.name)).map(x=>x.name).sort((a,b)=>a.localeCompare(b));
  let source='';
  try{source=fs.readFileSync(GAMES_META_FILE,'utf8')}catch{}
  if(!source){
    source='/* NOVA GAME CATALOG — developer-controlled metadata. */\nwindow.NovaGameMeta = {\n};\n\nwindow.NovaGameLinks = window.NovaGameLinks || [];\n';
  }
  const entryRe=/^\s*"([^"]+\.html?)"\s*:/gm;
  const existing=new Set(); let m;
  while((m=entryRe.exec(source)))existing.add(m[1]);
  const missing=files.filter(file=>!existing.has(file));
  if(!missing.length)return files;
  const entries=missing.map(file=>`  ${JSON.stringify(file)}: { title: ${JSON.stringify(titleFromGameFile(file))}, description: "Ready to play in Nova.", poster: "" },`);
  const close=source.lastIndexOf('};');
  if(close<0){console.warn('Could not find the end of data/games.js; preserving the existing file.');return files;}
  const updated=source.slice(0,close)+entries.join('\n')+'\n'+source.slice(close);
  try{const tmp=GAMES_META_FILE+'.tmp';fs.writeFileSync(tmp,updated);fs.renameSync(tmp,GAMES_META_FILE);console.log(`Game catalog synced: ${files.length} HTML games (${missing.length} added).`)}catch(e){console.warn('Game catalog could not be written:',e.message)}
  return files;
}
const token=()=>crypto.randomBytes(32).toString('hex');
const norm=s=>String(s||'').trim().toLowerCase();
const publicUser=u=>({username:u.username,createdAt:u.createdAt,deviceId:u.deviceId||null});
function normalizeMovie(movie){
  const item=movie&&typeof movie==='object'?movie:{};
  const rawEmbed=String(item.embed||item.iframe||item.embedUrl||item.driveUrl||item.url||'').trim();
  const iframe=rawEmbed.match(/<iframe\b[^>]*\bsrc=[\"']([^\"']+)[\"'][^>]*>/i);
  const source=iframe?iframe[1]:rawEmbed;
  const id=String(item.id||item.title||source||Math.random().toString(36).slice(2));
  return {id:String(id),title:String(item.title||'Untitled Movie'),driveUrl:source,embedUrl:source,poster:String(item.poster||''),year:Number(item.year)||0,genre:String(item.genre||''),description:String(item.description||''),maturityRating:String(item.maturityRating||'NR'),categories:Array.isArray(item.categories)?item.categories.map(String):[]};
}
function moviesList(){
  const now=Date.now();if(now-catalogCache.movies.at<CATALOG_TTL)return catalogCache.movies.data;
  try{
    const parsed=readMoviesSource();
    const data=Array.isArray(parsed)?parsed.map(normalizeMovie).filter(m=>m.title&&(m.embedUrl||m.driveUrl||m.poster||m.description)):[];
    catalogCache.movies={at:now,data};return data;
  }catch(e){console.error('Movies data load failed:',e.message);return catalogCache.movies.data||[]}
}
function json(res,status,obj){const data=Buffer.from(JSON.stringify(obj));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':data.length,'X-Content-Type-Options':'nosniff'});res.end(data)}
function body(req){return new Promise((resolve,reject)=>{let b='';let size=0;req.on('data',c=>{size+=c.length;if(size>MAX_BODY){req.destroy();return reject(new Error('Request body too large'))}b+=c});req.on('end',()=>{try{resolve(JSON.parse(b||'{}'))}catch{reject(new Error('Invalid JSON'))}});req.on('error',reject)})}
function rawBody(req,limit=MAX_BODY){return new Promise((resolve,reject)=>{let chunks=[];let size=0;req.on('data',c=>{size+=c.length;if(size>limit){req.destroy();return reject(new Error('Request body too large'))}chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c))});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)})}
const hashPassword=p=>new Promise((res,rej)=>{const salt=crypto.randomBytes(16);crypto.scrypt(p,salt,64,(e,k)=>e?rej(e):res(salt.toString('hex')+'$'+k.toString('hex')))})
const verify=(p,stored)=>new Promise(r=>{try{const [salt,hash]=stored.split('$');crypto.scrypt(p,Buffer.from(salt,'hex'),64,(e,k)=>r(!e&&crypto.timingSafeEqual(k,Buffer.from(hash,'hex'))))}catch{r(false)}})
function auth(req){const m=(req.headers.cookie||'').match(/(?:^|;\s*)nova_session=([a-f0-9]{64})(?:;|$)/);const key=m&&db.sessions[m[1]];return key&&db.users[key]?key:null}
function emit(user,msg){const set=clients.get(user);if(!set)return;const data='data: '+JSON.stringify(msg)+'\n\n';for(const res of set){try{res.write(data)}catch{set.delete(res)}}}

function readShowsSource(){
  const json=readJsonArray(SHOWS_JSON_FILE);
  if(json)return json;
  try{
    const source=fs.readFileSync(path.join(CATALOG_DIR,'shows.js'),'utf8');
    const match=source.match(/window\.NOVA_SHOWS\s*=\s*(\[[\s\S]*?\])\s*;/);
    if(!match)return [];
    const parsed=JSON.parse(match[1]);
    return Array.isArray(parsed)?parsed:[];
  }catch(e){console.warn('Show catalog load failed:',e.message);return []}
}
function writeShowsSource(items){
  const clean=Array.isArray(items)?items:[];
  const jsonText=JSON.stringify(clean,null,2)+'\n';
  const jsonTmp=SHOWS_JSON_FILE+'.tmp';fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(jsonTmp,jsonText);fs.renameSync(jsonTmp,SHOWS_JSON_FILE);
  const header='// NOVA WATCH SHOW CATALOG — developer-managed persistent catalog.\n// The JSON catalog is the server source of truth; this JS file is the browser-compatible mirror.\n';
  const text=header+'window.NOVA_SHOWS = '+jsonText+';\n';
  const catalogShowsFile=path.join(CATALOG_DIR,'shows.js');fs.mkdirSync(CATALOG_DIR,{recursive:true});const tmp=catalogShowsFile+'.tmp';fs.writeFileSync(tmp,text);fs.renameSync(tmp,catalogShowsFile);
}
function normalizeShow(x,i){
  const item=x&&typeof x==='object'?x:{};
  const tmdbId=String(item.tmdbId||'').trim();
  const seasons=Array.isArray(item.seasons)?item.seasons.map((s,n)=>({number:Number(s?.number||n+1),episodes:Math.max(0,Number(s?.episodes||s?.episodeCount||0))})).filter(s=>s.number>0&&s.episodes>0):[];
  return {id:String(item.id||tmdbId||'show-'+(i+1)),title:String(item.title||'Show '+(i+1)),tmdbId,poster:String(item.poster||''),year:Number(item.year)||0,genre:String(item.genre||''),maturityRating:String(item.maturityRating||'NR'),description:String(item.description||''),categories:Array.isArray(item.categories)?item.categories.map(String):[],seasons};
}
function showsList(){return readShowsSource().map(normalizeShow).filter(x=>x.tmdbId&&x.title&&x.seasons.length)}
function ensureTikTokProfile(key){
  if(!key||!db.users[key])return null;
  db.tiktok??={posts:[],follows:{},profiles:{}};
  db.tiktok.profiles??={};
  const u=db.users[key],p=db.tiktok.profiles[key]??={username:u.username,displayName:u.username,bio:'',avatar:'',createdAt:Date.now()};
  p.username=u.username;p.displayName=String(p.displayName||u.username);p.bio=String(p.bio||'');p.avatar=String(p.avatar||'');
  return p;
}
function tiktokPostView(post,viewer){
  const follows=Array.isArray(db.tiktok.follows?.[viewer])?db.tiktok.follows[viewer]:[];
  return {...post,likesCount:Array.isArray(post.likes)?post.likes.length:0,liked:Array.isArray(post.likes)&&post.likes.includes(viewer),following:follows.includes(post.user),commentsCount:Array.isArray(post.comments)?post.comments.length:0};
}

function readGameLinks(){
  try{
    const source=fs.readFileSync(GAMES_META_FILE,'utf8');
    const match=source.match(/window\.NovaGameLinks\s*=\s*(\[[\s\S]*?\])\s*;/);
    if(!match)return [];
    const links=JSON.parse(match[1]);
    if(!Array.isArray(links))return [];
    return links.map((x,i)=>{
      const item=x&&typeof x==='object'?x:{};
      const url=String(item.url||item.link||item.href||'').trim();
      if(!/^https?:\/\//i.test(url))return null;
      const title=String(item.title||item.name||'Linked Game '+(i+1)).trim()||('Linked Game '+(i+1));
      return {file:'link:'+i+':'+title,url,title,source:'link',poster:String(item.poster||''),description:String(item.description||'Ready to play in Nova.'),id:String(item.id||'link-'+i)};
    }).filter(Boolean);
  }catch(e){console.warn('Game link catalog load failed:',e.message);return []}
}
function parseGameMetaSource(source){
  const start=source.indexOf('window.NovaGameMeta');if(start<0)return {};
  const open=source.indexOf('{',start), endMarker=source.indexOf('window.NovaGameLinks',open);if(open<0||endMarker<0)return {};
  const raw=source.slice(open,endMarker).replace(/;\s*$/,'').trim();let out={};
  try{const text=raw.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$-]*)\s*:/g,'$1\"$2\":').replace(/,\s*}/g,'}').replace(/,\s*$/,'');out=JSON.parse(text)}catch(e){console.warn('Game metadata parse failed:',e.message)}
  return out&&typeof out==='object'?out:{};
}
function replaceGameMetaSource(source,parsed){
  const start=source.indexOf('window.NovaGameMeta'),open=source.indexOf('{',start),endMarker=source.indexOf('window.NovaGameLinks',open);if(start<0||open<0||endMarker<0)throw new Error('Game catalog format is invalid.');
  return source.slice(0,start)+'window.NovaGameMeta = '+JSON.stringify(parsed,null,2)+';\n\n'+source.slice(endMarker);
}
function readGameMeta(){let source='';try{source=fs.readFileSync(GAMES_META_FILE,'utf8')}catch{return {}};return parseGameMetaSource(source)}
function writeGameMeta(file,meta){let source='';try{source=fs.readFileSync(GAMES_META_FILE,'utf8')}catch{throw new Error('Game catalog is unavailable.')};const parsed=parseGameMetaSource(source);parsed[file]={title:String(meta.title||titleFromGameFile(file)),description:String(meta.description||'Ready to play in Nova.'),poster:String(meta.poster||''),emoji:String(meta.emoji||'')};const updated=replaceGameMetaSource(source,parsed),tmp=GAMES_META_FILE+'.tmp';fs.writeFileSync(tmp,updated);fs.renameSync(tmp,GAMES_META_FILE);invalidateCatalogs()}
function removeGameMeta(file){let source='';try{source=fs.readFileSync(GAMES_META_FILE,'utf8')}catch{return};const parsed=parseGameMetaSource(source);delete parsed[file];const updated=replaceGameMetaSource(source,parsed),tmp=GAMES_META_FILE+'.tmp';fs.writeFileSync(tmp,updated);fs.renameSync(tmp,GAMES_META_FILE);invalidateCatalogs()}
function gamesList(){const now=Date.now();if(now-catalogCache.games.at<CATALOG_TTL)return catalogCache.games.data;const files=syncGamesMeta(),meta=readGameMeta();const local=files.map(file=>({file,url:'/games/'+encodeURIComponent(file),title:meta[file]?.title||titleFromGameFile(file),description:meta[file]?.description||'Ready to play in Nova.',poster:meta[file]?.poster||'',emoji:meta[file]?.emoji||'',source:'local'}));const links=readGameLinks();const data=[...local,...links];catalogCache.games={at:now,data};return data}

function musicList(){
  const now=Date.now();if(now-catalogCache.music.at<CATALOG_TTL)return catalogCache.music.data;
  const dir=path.join(ROOT,'assets','music');fs.mkdirSync(dir,{recursive:true});
  const files=fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()&&/\.(mp3|wav|ogg|m4a)$/i.test(x.name));
  const data=files.map((x,i)=>{const raw=path.parse(x.name).name.trim();const parts=raw.split(/\s+-\s+/);const artist=parts.length>1?parts.shift().replace(/[_]+/g,' ').trim():'Local Artist';const title=(parts.join(' - ')||raw||'Untitled').replace(/[_]+/g,' ').trim();return{id:'music-'+i+'-'+encodeURIComponent(x.name),title,artist,album:'Nova Local',src:'/assets/music/'+encodeURIComponent(x.name),file:x.name}});
  catalogCache.music={at:now,data};return data;
}

function safeFileName(name){return String(name||'download').replace(/[^A-Za-z0-9._ -]/g,'_').replace(/\s+/g,' ').trim().slice(0,120)||'download'}
function downloadsList(){const now=Date.now();if(now-catalogCache.downloads.at<CATALOG_TTL)return catalogCache.downloads.data;const dir=path.join(ROOT,'downloads');fs.mkdirSync(dir,{recursive:true});const data=fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()).map(x=>{const f=fs.statSync(path.join(dir,x.name));return{id:'download:'+x.name,name:x.name,type:'file',size:f.size,lastModified:f.mtimeMs,url:'/downloads/'+encodeURIComponent(x.name),server:true}});catalogCache.downloads={at:now,data};return data}

async function saveRemoteDownload(target){if(!isAllowedProxyTarget(target))throw new Error('Invalid download URL');const u=new URL(target);const remote=await fetchRemote(u.toString(),'GET',null,{});if(remote.status<200||remote.status>=400)throw new Error('Download failed');let name=safeFileName(path.basename(u.pathname));if(!/\.[A-Za-z0-9]{1,8}$/.test(name)){const ct=remote.contentType.split(';')[0];const ext=ct==='audio/mpeg'?'.mp3':ct==='text/html'?'.html':ct==='text/plain'?'.txt':'';name+=ext}const dir=path.join(ROOT,'downloads');fs.mkdirSync(dir,{recursive:true});let final=name,i=2;while(fs.existsSync(path.join(dir,final))){const dot=name.lastIndexOf('.');final=(dot>0?name.slice(0,dot)+' ('+i+')'+name.slice(dot):name+' ('+i+')');i++}fs.writeFileSync(path.join(dir,final),remote.body);return {name:final,size:remote.body.length,url:'/downloads/'+encodeURIComponent(final)}}

async function fetchRemote(targetUrl,method='GET',body=null,headers={}){const init={method:String(method||'GET').toUpperCase(),headers:{'User-Agent':'Mozilla/5.0 (compatible; NovaOS Proxy/1.0)','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','Accept-Language':'en-US,en;q=0.9','Upgrade-Insecure-Requests':'1',...headers}};const h=Object.fromEntries(Object.entries(headers||{}).map(([k,v])=>[k.toLowerCase(),String(v)]));if(h['accept'])init.headers.Accept=h['accept'];if(h['accept-language'])init.headers['Accept-Language']=h['accept-language'];if(h['referer'])init.headers.Referer=h['referer'];if(h['cookie'])init.headers.Cookie=h['cookie'];if(body && !['GET','HEAD'].includes(init.method)){init.body=body;if(h['content-type'])init.headers['Content-Type']=h['content-type'];}const result=await fetch(targetUrl,init);const raw=Buffer.from(await result.arrayBuffer());return {status:result.status,headers:Object.fromEntries(result.headers.entries()),body:raw,contentType:result.headers.get('content-type')||'application/octet-stream'}}
function isAllowedProxyTarget(raw){try{const value=String(raw||'').trim();if(!value)return false;const parsed=new URL(value.startsWith('http://')||value.startsWith('https://')?value:`https://${value}`);return ['http:','https:'].includes(parsed.protocol)}catch{return false}}
async function serveProxy(req,res){const url=new URL(req.url,'http://localhost');const q=url.searchParams.get('q');const target=url.searchParams.get('url')||q&&`https://duckduckgo.com/?q=${encodeURIComponent(q)}`;if(!target||!isAllowedProxyTarget(target))return json(res,400,{error:'Missing or invalid URL.'});const targetUrl=new URL(target.startsWith('http://')||target.startsWith('https://')?target:`https://${target}`).toString();try{let body=null;if(!['GET','HEAD'].includes((req.method||'GET').toUpperCase()))body=await rawBody(req);const remote=await fetchRemote(targetUrl,req.method,body,req.headers);if(/text\/html|application\/xhtml\+xml/i.test(remote.contentType)){const html=remote.body.toString('utf8');const rewritten=proxyifyHtml(html,targetUrl);res.writeHead(remote.status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Proxy-Target':targetUrl,'Vary':'Accept-Encoding'});res.end(rewritten);return}const type=remote.contentType.includes(';')?remote.contentType.split(';')[0]:remote.contentType;res.writeHead(remote.status,{'Content-Type':type,'Cache-Control':'no-store','X-Proxy-Target':targetUrl,'Access-Control-Allow-Origin':'*'});res.end(remote.body)}catch(e){console.error('Proxy fetch failed:',e.message);return json(res,502,{error:'Proxy request failed.'})}}

function rateLimit(req,key,limit=90,windowMs=60000){const now=Date.now(),ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim(),k=key+':'+ip;let b=rateBuckets.get(k);if(!b||now-b.started>windowMs)b={started:now,count:0};b.count++;rateBuckets.set(k,b);return b.count<=limit}
function prunePresence(){const now=Date.now();for(const [k,v] of Object.entries(db.presence||{}))if(!v||now-Number(v.lastSeen||0)>PRESENCE_TTL)delete db.presence[k]}
function activeCount(){prunePresence();return Object.keys(db.presence||{}).length}
function cloudSize(data){return Buffer.byteLength(JSON.stringify(data||{}),'utf8')}

async function api(req,res){const url=new URL(req.url,'http://localhost'),me=auth(req);
 try{if(!rateLimit(req,url.pathname,120))return json(res,429,{error:'Too many requests. Please slow down.'});
  if(req.method==='GET'&&url.pathname==='/api/status'){prunePresence();purgeExpiredBans();return json(res,200,{online:db.system.online!==false,count:activeCount(),time:Date.now()})}
  if(req.method==='GET'&&url.pathname==='/api/version'){const commit=String(process.env.RAILWAY_GIT_COMMIT_SHA||process.env.RAILWAY_GIT_COMMIT||'').trim();let stamp='';try{stamp=String(Math.floor(fs.statSync(path.join(ROOT,'index.html')).mtimeMs))}catch{}return json(res,200,{version:commit||stamp||'nova-12.3',time:Date.now()})}
  if(req.method==='POST'&&url.pathname==='/api/guest/access'){if(db.system.online!==false)return json(res,403,{error:'Guest mode is only available while the Nova server is offline.'});return json(res,200,{ok:true})}
  if(req.method==='POST'&&url.pathname==='/api/dev/login'){
    const b=await body(req),password=String(b.password||'');
    if(!DEV_PASSWORDS.length)return json(res,503,{error:'Developer access is not configured on this server.'});
    if(!DEV_PASSWORDS.includes(password))return json(res,401,{error:'Incorrect developer password.'});
    const t=devToken();devSessions.set(t,{expires:Date.now()+DEV_SESSION_MAX_AGE});res.setHeader('Set-Cookie',`nova_dev_session=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${DEV_SESSION_MAX_AGE/1000}`);return json(res,200,{ok:true});
  }
  if(req.method==='POST'&&url.pathname==='/api/dev/logout'){const t=devAuth(req);if(t)devSessions.delete(t);res.setHeader('Set-Cookie','nova_dev_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return json(res,200,{ok:true})}
  if(req.method==='GET'&&url.pathname==='/api/dev/status'){return json(res,200,{authorized:!!devAuth(req),configured:DEV_PASSWORDS.length>0,serverOnline:db.system.online!==false})}
  if(req.method==='GET'&&url.pathname==='/api/live-wallpapers'){return json(res,200,{wallpapers:publicWallpapers()})}
  if(req.method==='GET'&&url.pathname.startsWith('/api/live-wallpapers/file/')){
    const id=decodeURIComponent(url.pathname.slice('/api/live-wallpapers/file/'.length));const item=liveWallpapers.find(x=>x.id===id);
    if(!item)return json(res,404,{error:'Wallpaper not found.'});
    const file=path.join(LIVE_WALLPAPER_DIR,item.file);if(!fs.existsSync(file))return json(res,404,{error:'Wallpaper file not found.'});
    return sendFile(req,res,file);
  }
  if((req.method==='POST'||req.method==='GET')&&url.pathname.startsWith('/api/dev/')){
    if(!requireDev(req,res))return;
    if(url.pathname==='/api/dev/server-state'){const b=await body(req);db.system.online=b.online!==false;saveSync();return json(res,200,{ok:true,online:db.system.online})}
    if(url.pathname==='/api/dev/live-wallpapers/upload'){
      const type=String(req.headers['content-type']||'');
      if(!/^multipart\/form-data/i.test(type))return json(res,400,{error:'Use a multipart MP4 upload.'});
      const match=type.match(/boundary=(?:"([^"]+)"|([^;]+))/i);if(!match)return json(res,400,{error:'Missing upload boundary.'});
      const raw=await rawBody(req,LIVE_WALLPAPER_UPLOAD_MAX);const parts=parseMultipart(raw,match[1]||match[2]);const file=parts.find(x=>x.name==='video'&&x.filename);
      if(!file)return json(res,400,{error:'Choose an MP4 video.'});
      if(!/\.mp4$/i.test(file.filename))return json(res,400,{error:'Only MP4 wallpapers are allowed.'});
      if(file.content.length<1)return json(res,400,{error:'The uploaded video is empty.'});
      const id='lw-'+Date.now()+'-'+crypto.randomBytes(5).toString('hex'),stored=id+'-'+safeWallpaperName(file.filename);fs.writeFileSync(path.join(LIVE_WALLPAPER_DIR,stored),file.content);
      const item={id,name:safeWallpaperName(file.filename),file:stored,size:file.content.length,createdAt:Date.now()};liveWallpapers.unshift(item);saveLiveWallpapers();return json(res,201,{ok:true,wallpaper:{id:item.id,name:item.name,size:item.size,createdAt:item.createdAt,url:'/api/live-wallpapers/file/'+encodeURIComponent(item.id)}});
    }
    if(url.pathname==='/api/dev/live-wallpapers/upload/init'){
      const b=await body(req),name=safeWallpaperName(b.name||'wallpaper.mp4'),size=Number(b.size||0);
      if(!/\.mp4$/i.test(name))return json(res,400,{error:'Only MP4 wallpapers are allowed.'});
      if(!Number.isSafeInteger(size)||size<1||size>LIVE_WALLPAPER_UPLOAD_MAX)return json(res,400,{error:'Wallpaper must be between 1 byte and 1 GB.'});
      const uploadId='lwu-'+Date.now()+'-'+crypto.randomBytes(8).toString('hex');
      const metaPath=path.join(LIVE_WALLPAPER_TMP,uploadId+'.json'),partPath=path.join(LIVE_WALLPAPER_TMP,uploadId+'.part');
      fs.writeFileSync(metaPath,JSON.stringify({uploadId,name,size,received:0,createdAt:Date.now()}));fs.writeFileSync(partPath,Buffer.alloc(0));
      return json(res,201,{ok:true,uploadId,chunkSize:8*1024*1024});
    }
    if(url.pathname==='/api/dev/live-wallpapers/upload/chunk'){
      const uploadId=String(req.headers['x-nova-upload-id']||'').trim(),index=Number(req.headers['x-nova-chunk-index']);
      if(!/^lwu-[a-f0-9-]+$/.test(uploadId)||!Number.isInteger(index)||index<0)return json(res,400,{error:'Invalid upload chunk.'});
      const metaPath=path.join(LIVE_WALLPAPER_TMP,uploadId+'.json'),partPath=path.join(LIVE_WALLPAPER_TMP,uploadId+'.part');
      if(!fs.existsSync(metaPath))return json(res,404,{error:'Upload session not found.'});
      const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));if(meta.received!==index*8*1024*1024)return json(res,409,{error:'Upload chunks arrived out of order. Please retry this chunk.'});
      const raw=await rawBody(req,8*1024*1024+1024);if(!raw.length)return json(res,400,{error:'Empty upload chunk.'});
      if(meta.received+raw.length>meta.size)return json(res,400,{error:'Upload exceeds the declared file size.'});
      fs.appendFileSync(partPath,raw);meta.received+=raw.length;meta.lastChunk=index;fs.writeFileSync(metaPath,JSON.stringify(meta));return json(res,200,{ok:true,received:meta.received,size:meta.size});
    }
    if(url.pathname==='/api/dev/live-wallpapers/upload/complete'){
      const b=await body(req),uploadId=String(b.uploadId||'').trim();
      if(!/^lwu-[a-f0-9-]+$/.test(uploadId))return json(res,400,{error:'Invalid upload session.'});
      const metaPath=path.join(LIVE_WALLPAPER_TMP,uploadId+'.json'),partPath=path.join(LIVE_WALLPAPER_TMP,uploadId+'.part');
      if(!fs.existsSync(metaPath)||!fs.existsSync(partPath))return json(res,404,{error:'Upload session not found.'});
      const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));if(meta.received!==meta.size)return json(res,409,{error:`Upload is incomplete (${meta.received}/${meta.size} bytes).`});
      const id='lw-'+Date.now()+'-'+crypto.randomBytes(5).toString('hex'),stored=id+'-'+meta.name,finalPath=path.join(LIVE_WALLPAPER_DIR,stored);fs.renameSync(partPath,finalPath);
      const item={id,name:meta.name,file:stored,size:meta.size,createdAt:Date.now()};liveWallpapers.unshift(item);saveLiveWallpapers();try{fs.rmSync(metaPath,{force:true})}catch{}
      return json(res,201,{ok:true,wallpaper:{id:item.id,name:item.name,size:item.size,createdAt:item.createdAt,url:'/api/live-wallpapers/file/'+encodeURIComponent(item.id)}});
    }
    if(url.pathname==='/api/dev/live-wallpapers/delete'){
      const b=await body(req),id=String(b.id||'').trim(),idx=liveWallpapers.findIndex(x=>x.id===id);if(idx<0)return json(res,404,{error:'Wallpaper not found.'});const [item]=liveWallpapers.splice(idx,1);try{fs.rmSync(path.join(LIVE_WALLPAPER_DIR,item.file),{force:true})}catch{}saveLiveWallpapers();return json(res,200,{ok:true});
    }
    if(url.pathname==='/api/dev/add-movie'){const b=await body(req),tmdbId=String(b.tmdbId||b.id||'').trim(),movie={id:tmdbId||String(b.title||'movie-'+Date.now()).trim(),title:String(b.title||'Untitled Movie').trim(),poster:String(b.poster||'').trim(),tmdbId,embedUrl:tmdbId?`https://cinesrc.st/embed/movie/${encodeURIComponent(tmdbId)}`:'',year:Number(b.year)||0,genre:String(b.genre||'').trim(),description:String(b.description||'').trim(),maturityRating:String(b.maturityRating||'NR').trim(),categories:Array.isArray(b.categories)?b.categories.map(String):String(b.categories||'').split(',').map(x=>x.trim()).filter(Boolean)};if(!movie.title||!tmdbId)return json(res,400,{error:'Movie title and TMDB ID are required.'});const items=readMoviesSource();if(items.some(x=>String(x.id||x.title).toLowerCase()===movie.id.toLowerCase()))return json(res,409,{error:'A movie with that ID already exists.'});items.push(movie);writeMoviesSource(items);return json(res,201,{ok:true,movie})}
    if(url.pathname==='/api/dev/users'){const users=Object.values(db.users||{}).map(u=>({username:u.username,createdAt:u.createdAt,deviceId:u.deviceId||null,banned:!!getBanByKey(norm(u.username))})).sort((a,b)=>String(a.username).localeCompare(String(b.username)));return json(res,200,{users})}
    if(url.pathname==='/api/dev/update-movie'){const b=await body(req),id=String(b.id||'').trim();if(!id)return json(res,400,{error:'Movie ID is required.'});const items=readMoviesSource(),idx=items.findIndex(x=>String(x.id||x.title).toLowerCase()===id.toLowerCase());if(idx<0)return json(res,404,{error:'Movie not found.'});const old=items[idx],tmdbId=String(b.tmdbId??old.tmdbId??old.id??'').trim(),updated={...old,id:String(b.id??old.id).trim()||old.id,title:String((b.title??old.title)||'Untitled Movie').trim(),poster:String((b.poster??old.poster)||'').trim(),tmdbId,embedUrl:tmdbId?`https://cinesrc.st/embed/movie/${encodeURIComponent(tmdbId)}`:String(b.embedUrl??old.embedUrl??'').trim(),year:Number(b.year??old.year)||0,genre:String((b.genre??old.genre)||'').trim(),description:String((b.description??old.description)||'').trim(),maturityRating:String((b.maturityRating??old.maturityRating)||'NR').trim(),categories:Array.isArray(b.categories)?b.categories.map(String):String((b.categories??old.categories??'')).split(',').map(x=>x.trim()).filter(Boolean)};if(!updated.title||!tmdbId)return json(res,400,{error:'Movie title and TMDB ID are required.'});if(items.some((x,i)=>i!==idx&&String(x.id||x.title).toLowerCase()===updated.id.toLowerCase()))return json(res,409,{error:'Another movie already uses that ID.'});items[idx]=updated;writeMoviesSource(items);return json(res,200,{ok:true,movie:updated})}
    if(url.pathname==='/api/dev/delete-movie'){const b=await body(req),id=String(b.id||'').trim(),items=readMoviesSource(),idx=items.findIndex(x=>String(x.id||x.title).toLowerCase()===id.toLowerCase());if(idx<0)return json(res,404,{error:'Movie not found.'});const [removed]=items.splice(idx,1);writeMoviesSource(items);return json(res,200,{ok:true,movie:removed})}

    if(url.pathname==='/api/dev/add-show'){
      const b=await body(req),tmdbId=String(b.tmdbId||'').trim(),title=String(b.title||'').trim(),seasons=Array.isArray(b.seasons)?b.seasons.map((x,i)=>({number:Number(x.number||i+1),episodes:Math.max(0,Number(x.episodes||x.episodeCount||0))})).filter(x=>x.number>0&&x.episodes>0):[];
      if(!title||!tmdbId||!seasons.length)return json(res,400,{error:'Show title, TMDB ID, and at least one season are required.'});
      const items=readShowsSource();if(items.some(x=>String(x.id||x.tmdbId).toLowerCase()===String(b.id||tmdbId).toLowerCase()||String(x.tmdbId)===tmdbId))return json(res,409,{error:'A show with that TMDB ID already exists.'});
      const show=normalizeShow({id:String(b.id||tmdbId).trim(),title,tmdbId,poster:String(b.poster||'').trim(),year:Number(b.year)||0,genre:String(b.genre||'').trim(),maturityRating:String(b.maturityRating||'TV-14').trim(),description:String(b.description||'').trim(),categories:Array.isArray(b.categories)?b.categories:String(b.categories||'').split(',').map(x=>x.trim()).filter(Boolean),seasons});items.push(show);writeShowsSource(items);return json(res,201,{ok:true,show});
    }
    if(url.pathname==='/api/dev/update-show'){
      const b=await body(req),id=String(b.id||'').trim(),items=readShowsSource(),idx=items.findIndex(x=>String(x.id||x.tmdbId).toLowerCase()===id.toLowerCase());if(idx<0)return json(res,404,{error:'Show not found.'});
      const old=items[idx],tmdbId=String(b.tmdbId??old.tmdbId??'').trim(),seasons=Array.isArray(b.seasons)?b.seasons.map((x,i)=>({number:Number(x.number||i+1),episodes:Math.max(0,Number(x.episodes||x.episodeCount||0))})).filter(x=>x.number>0&&x.episodes>0):(old.seasons||[]);const updated=normalizeShow({...old,id:String(b.id??old.id).trim()||old.id,title:String((b.title??old.title)||'Untitled Show').trim(),tmdbId,poster:String((b.poster??old.poster)||'').trim(),year:Number(b.year??old.year)||0,genre:String((b.genre??old.genre)||'').trim(),maturityRating:String((b.maturityRating??old.maturityRating)||'TV-14').trim(),description:String((b.description??old.description)||'').trim(),categories:Array.isArray(b.categories)?b.categories:String((b.categories??old.categories??'')).split(',').map(x=>x.trim()).filter(Boolean),seasons});if(!updated.title||!updated.tmdbId||!updated.seasons.length)return json(res,400,{error:'Show title, TMDB ID, and at least one season are required.'});if(items.some((x,i)=>i!==idx&&String(x.id||x.tmdbId).toLowerCase()===updated.id.toLowerCase()))return json(res,409,{error:'Another show already uses that ID.'});items[idx]=updated;writeShowsSource(items);return json(res,200,{ok:true,show:updated});
    }
    if(url.pathname==='/api/dev/delete-show'){const b=await body(req),id=String(b.id||'').trim(),items=readShowsSource(),idx=items.findIndex(x=>String(x.id||x.tmdbId).toLowerCase()===id.toLowerCase());if(idx<0)return json(res,404,{error:'Show not found.'});const [removed]=items.splice(idx,1);writeShowsSource(items);return json(res,200,{ok:true,show:removed})}
    if(url.pathname==='/api/dev/update-game'){const b=await body(req),file=String(b.file||'').trim();if(!file)return json(res,400,{error:'Game file is required.'});if(file.startsWith('link:')){const id=String(b.id||'').trim(),links=readGameLinksSource(),idx=links.findIndex(x=>String(x.id||'').trim()===id);if(idx<0)return json(res,404,{error:'Linked game not found.'});const old=links[idx],urlValue=String((b.url??old.url)||'').trim();if(!/^https?:\/\//i.test(urlValue))return json(res,400,{error:'Enter a valid http or https game link.'});links[idx]={...old,id:String(b.id||old.id),title:String((b.title??old.title)||'Linked Game').trim(),url:urlValue,poster:String((b.poster??old.poster)||'').trim(),description:String((b.description??old.description)||'Ready to play in Nova.').trim()};writeGameLinksSource(links);return json(res,200,{ok:true,game:links[idx]})}if(!fs.existsSync(path.join(ROOT,'games',file)))return json(res,404,{error:'Game file not found.'});const old=readGameMeta()[file]||{};writeGameMeta(file,{title:String((b.title??old.title)||titleFromGameFile(file)).trim(),poster:String((b.poster??old.poster)||'').trim(),description:String((b.description??old.description)||'Ready to play in Nova.').trim(),emoji:String((b.emoji??old.emoji)||'')});return json(res,200,{ok:true,game:{file,title:String((b.title??old.title)||titleFromGameFile(file)),poster:String((b.poster??old.poster)||'').trim(),description:String((b.description??old.description)||'Ready to play in Nova.').trim(),source:'local'}})}
    if(url.pathname==='/api/dev/delete-game'){const b=await body(req),file=String(b.file||'').trim();if(!file)return json(res,400,{error:'Game file is required.'});if(file.startsWith('link:')){const id=String(b.id||'').trim(),links=readGameLinksSource(),idx=links.findIndex(x=>String(x.id||'').trim()===id);if(idx<0)return json(res,404,{error:'Linked game not found.'});const [removed]=links.splice(idx,1);writeGameLinksSource(links);return json(res,200,{ok:true,game:removed})}const target=path.join(ROOT,'games',file);if(!fs.existsSync(target))return json(res,404,{error:'Game file not found.'});fs.unlinkSync(target);removeGameMeta(file);return json(res,200,{ok:true,game:{file}})}
    if(url.pathname==='/api/dev/add-game-link'){const b=await body(req);const link={id:String(b.id||'link-'+Date.now()),title:String(b.title||'Linked Game').trim(),url:String(b.url||'').trim(),poster:String(b.poster||'').trim(),description:String(b.description||'Ready to play in Nova.').trim()};if(!/^https?:\/\//i.test(link.url))return json(res,400,{error:'Enter a valid http or https game link.'});const links=readGameLinksSource();links.push(link);writeGameLinksSource(links);return json(res,201,{ok:true,game:link})}
    if(url.pathname==='/api/dev/ban'){const b=await body(req),username=String(b.username||'').trim(),key=norm(username),reason=String(b.reason||'').trim()||'Violation of Nova rules.',duration=Math.min(7,Math.max(1,Number(b.durationDays)||1)),now=Date.now(),user=db.users[key];if(!user)return json(res,404,{error:'Account not found.'});db.banned[key]={username:user.username,reason,at:now,expiresAt:now+duration*86400000,durationDays:duration};invalidateUserSessions(key);saveSync();return json(res,200,{ok:true,ban:db.banned[key]})}
    if(url.pathname==='/api/dev/unban'){const b=await body(req),key=norm(b.username);if(!db.banned[key])return json(res,404,{error:'User is not banned.'});delete db.banned[key];saveSync();return json(res,200,{ok:true})}
    if(url.pathname==='/api/dev/blacklist'){purgeExpiredBans();return json(res,200,{banned:db.banned})}
    if(url.pathname==='/api/dev/add-game'){
      const type=String(req.headers['content-type']||'');if(!/^multipart\/form-data/i.test(type))return json(res,400,{error:'Game upload must use multipart/form-data.'});const match=type.match(/boundary=(?:"([^"]+)"|([^;]+))/i);if(!match)return json(res,400,{error:'Missing upload boundary.'});const raw=await rawBody(req);if(raw.length>MAX_GAME_UPLOAD)return json(res,413,{error:'Game file is too large. Maximum 20 MB.'});const parts=parseMultipart(raw,match[1]||match[2]);const file=parts.find(x=>x.name==='file'&&x.filename);if(!file)return json(res,400,{error:'Choose an HTML game file.'});if(!/\.html?$/i.test(file.filename))return json(res,400,{error:'Only .html or .htm game files are allowed.'});const name=safeUploadName(file.filename),dir=path.join(ROOT,'games');fs.mkdirSync(dir,{recursive:true});let final=name,base=path.basename(name,path.extname(name)),ext=path.extname(name);let n=2;while(fs.existsSync(path.join(dir,final))){final=base+'-'+n+ext;n++;}fs.writeFileSync(path.join(dir,final),file.content);const fields=Object.fromEntries(parts.filter(x=>!x.filename).map(x=>[x.name,x.content.toString('utf8')]));addGameMeta(final,{title:fields.title||titleFromGameFile(final),description:fields.description,poster:fields.poster,emoji:fields.emoji});return json(res,201,{ok:true,game:{file:final,title:fields.title||titleFromGameFile(final)}});
    }
    return json(res,404,{error:'Developer endpoint not found.'});
  }
  if(db.system.online===false){return json(res,503,{error:'Nova servers are currently offline.'})}
  if(req.method==='POST'&&url.pathname==='/api/register'){const b=await body(req),username=String(b.username||'').trim(),key=norm(username),password=String(b.password||'');if(!/^[A-Za-z0-9_]{3,20}$/.test(username))return json(res,400,{error:'Username must be 3–20 letters, numbers, or underscores.'});if(password.length<6)return json(res,400,{error:'Password must be at least 6 characters.'});if(db.users[key])return json(res,409,{error:'That username is already taken.'});db.users[key]={username,password:await hashPassword(password),createdAt:Date.now(),deviceId:String(b.deviceId||''),requests:[],contacts:[],messages:{}};const s=token();db.sessions[s]=key;saveSync();res.setHeader('Set-Cookie',`nova_session=${s}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`);return json(res,201,{user:publicUser(db.users[key])})}
  if(req.method==='POST'&&url.pathname==='/api/login'){const b=await body(req),key=norm(b.username),u=db.users[key],ban=getBanByKey(key);if(ban)return json(res,403,{error:`You are banned from the site because of: ${ban.reason}`,expiresAt:ban.expiresAt||0,ban});if(!u)return json(res,401,{error:'Incorrect username or password.'});if(!(await verify(String(b.password||''),u.password)))return json(res,401,{error:'Incorrect username or password.'});u.deviceId=String(b.deviceId||u.deviceId||'');const s=token();db.sessions[s]=key;saveSync();res.setHeader('Set-Cookie',`nova_session=${s}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`);return json(res,200,{user:publicUser(u)})}
  if(req.method==='GET'&&url.pathname==='/api/me'){if(!me)return json(res,401,{error:'Not signed in'});const currentBan=getBanByKey(me);if(currentBan){invalidateUserSessions(me);return json(res,403,{error:`You are banned from the site because of: ${currentBan.reason}`,expiresAt:currentBan.expiresAt,ban:currentBan})}return json(res,200,{user:publicUser(db.users[me])})}
  if(req.method==='GET'&&url.pathname==='/api/content/games')return json(res,200,gamesList())
  if(req.method==='GET'&&url.pathname==='/api/content/music')return json(res,200,musicList())
  if(req.method==='GET'&&url.pathname==='/api/files/downloads')return json(res,200,downloadsList())
  if(req.method==='POST'&&url.pathname==='/api/download'){if(!rateLimit(req,'download',20))return json(res,429,{error:'Too many downloads. Try again later.'});const b=await body(req);try{return json(res,200,{ok:true,file:await saveRemoteDownload(String(b.url||''))})}catch(e){return json(res,400,{error:e.message||'Download failed.'})}}
  if(req.method==='GET'&&url.pathname==='/api/content/movies')return json(res,200,moviesList())
  if(req.method==='GET'&&url.pathname==='/api/content/shows')return json(res,200,showsList())
  if(req.method==='GET'&&url.pathname==='/api/presence'){return json(res,200,{count:activeCount()})}
  if(req.method==='POST'&&url.pathname==='/api/presence'){
    const b=await body(req), key=me?'u:'+me:(String(b.guestId||'').trim()?'g:'+String(b.guestId).slice(0,120):null);
    if(!key)return json(res,400,{error:'Missing presence identity.'});
    db.presence[key]={lastSeen:Date.now(),username:me?db.users[me]?.username:'Guest'};return json(res,200,{count:activeCount()});
  }
  if(req.method==='POST'&&url.pathname==='/api/logout'){const m=(req.headers.cookie||'').match(/(?:^|;\s*)nova_session=([a-f0-9]{64})(?:;|$)/);if(m){delete db.sessions[m[1]];queueSave()}res.setHeader('Set-Cookie','nova_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return json(res,200,{ok:true})}
  if(!me)return json(res,401,{error:'Sign in required.'});if(isBannedKey(me))return json(res,403,{error:`You are banned from the site because of: ${db.banned[me].reason}`});const u=db.users[me];
  if(req.method==='GET'&&url.pathname==='/api/sync'){
    const cloud=u.cloud&&typeof u.cloud==='object'?u.cloud:null;return json(res,200,{cloud:cloud?.data||null,updatedAt:cloud?.updatedAt||0});
  }
  if(req.method==='PUT'&&url.pathname==='/api/sync'){
    const b=await body(req),data=b.data&&typeof b.data==='object'?b.data:{};
    if(cloudSize(data)>MAX_BODY)return json(res,413,{error:'Nova Cloud data is too large.'});
    u.cloud={data,updatedAt:Date.now()};saveSync();return json(res,200,{ok:true,updatedAt:u.cloud.updatedAt});
  }
  if(req.method==='GET'&&url.pathname==='/api/events'){
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');
    let set=clients.get(me);if(!set){set=new Set();clients.set(me,set)}set.add(res);
    const ping=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},30000);
    req.on('close',()=>{clearInterval(ping);set.delete(res);if(!set.size)clients.delete(me)});return;
  }
  if(req.method==='GET'&&url.pathname==='/api/user/check'){const name=norm(url.searchParams.get('username'));return json(res,200,{exists:!!db.users[name]&&name!==me,username:db.users[name]?.username||null})}

  if(req.method==='GET'&&url.pathname==='/api/tiktok/feed'){
    if(!me)return json(res,401,{error:'Sign in to use Nova TikTok.'});ensureTikTokProfile(me);db.tiktok.posts??=[];const follows=Array.isArray(db.tiktok.follows?.[me])?db.tiktok.follows[me]:[];
    const all=db.tiktok.posts.filter(p=>p&&p.videoUrl&&db.users[p.user]);const following=all.filter(p=>follows.includes(p.user));const rest=all.filter(p=>!follows.includes(p.user));
    const sorted=[...following.sort((a,b)=>b.createdAt-a.createdAt),...rest.sort((a,b)=>(Number(b.likes?.length||0)+Number(b.views||0)*.08)-(Number(a.likes?.length||0)+Number(a.views||0)*.08))].slice(0,80).map(p=>tiktokPostView(p,me));
    return json(res,200,{profile:ensureTikTokProfile(me),following:follows,posts:sorted});
  }
  if(req.method==='GET'&&url.pathname==='/api/tiktok/profile'){
    if(!me)return json(res,401,{error:'Sign in to use Nova TikTok.'});const username=norm(url.searchParams.get('username')||'');if(!db.users[username])return json(res,404,{error:'User not found.'});const p=ensureTikTokProfile(username),followers=Object.values(db.tiktok.follows||{}).filter(a=>Array.isArray(a)&&a.includes(username)).length,following=Array.isArray(db.tiktok.follows?.[username])?db.tiktok.follows[username].length:0;return json(res,200,{...p,followers,following,isFollowing:Array.isArray(db.tiktok.follows?.[me])&&db.tiktok.follows[me].includes(username)});
  }
  if(req.method==='POST'&&url.pathname==='/api/tiktok/profile'){if(!me)return json(res,401,{error:'Sign in required.'});const b=await body(req),p=ensureTikTokProfile(me);p.displayName=String(b.displayName||p.displayName).slice(0,40);p.bio=String(b.bio||'').slice(0,160);saveSync();return json(res,200,{profile:p})}
  if(req.method==='POST'&&url.pathname==='/api/tiktok/follow'){if(!me)return json(res,401,{error:'Sign in required.'});const b=await body(req),target=norm(b.username);if(!db.users[target]||target===me)return json(res,400,{error:'Choose another Nova user.'});db.tiktok.follows??={};db.tiktok.follows[me]??=[];const i=db.tiktok.follows[me].indexOf(target);if(i>=0)db.tiktok.follows[me].splice(i,1);else db.tiktok.follows[me].push(target);saveSync();return json(res,200,{following:db.tiktok.follows[me].includes(target)});}
  if(req.method==='POST'&&url.pathname==='/api/tiktok/like'){if(!me)return json(res,401,{error:'Sign in required.'});const b=await body(req),post=db.tiktok.posts.find(p=>p.id===String(b.id||''));if(!post)return json(res,404,{error:'Video not found.'});post.likes??=[];const i=post.likes.indexOf(me);if(i>=0)post.likes.splice(i,1);else post.likes.push(me);saveSync();return json(res,200,{liked:post.likes.includes(me),likesCount:post.likes.length});}
  if(req.method==='POST'&&url.pathname==='/api/tiktok/view'){if(!me)return json(res,401,{error:'Sign in required.'});const b=await body(req),post=db.tiktok.posts.find(p=>p.id===String(b.id||''));if(!post)return json(res,404,{error:'Video not found.'});post.views=Math.min(100000000,Number(post.views||0)+1);saveSync();return json(res,200,{views:post.views});}
  if(req.method==='POST'&&url.pathname==='/api/tiktok/post'){
    if(!me)return json(res,401,{error:'Sign in required to post videos.'});ensureTikTokProfile(me);let videoUrl='',caption='',file=null;
    const type=String(req.headers['content-type']||'');
    if(/^multipart\/form-data/i.test(type)){const match=type.match(/boundary=(?:"([^"]+)"|([^;]+))/i);if(!match)return json(res,400,{error:'Missing upload boundary.'});const raw=await rawBody(req,TIKTOK_UPLOAD_MAX);const parts=parseMultipart(raw,match[1]||match[2]);file=parts.find(x=>x.name==='video'&&x.filename);caption=String(parts.find(x=>x.name==='caption')?.content?.toString('utf8')||'').slice(0,220);if(!file)return json(res,400,{error:'Choose a video file.'});if(!/\.(mp4|webm|mov)$/i.test(file.filename))return json(res,400,{error:'Use an MP4, WebM, or MOV video.'});const dir=path.join(ROOT,'assets','tiktok');fs.mkdirSync(dir,{recursive:true});const ext=path.extname(file.filename).toLowerCase(),name='video-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex')+ext;fs.writeFileSync(path.join(dir,name),file.content);videoUrl='/assets/tiktok/'+encodeURIComponent(name);
    }else{const b=await body(req);videoUrl=String(b.videoUrl||'').trim();caption=String(b.caption||'').slice(0,220);if(!/^https?:\/\//i.test(videoUrl))return json(res,400,{error:'Add a valid video URL or upload a video file.'});}
    db.tiktok.posts??=[];const post={id:crypto.randomBytes(9).toString('hex'),user:me,username:db.users[me].username,caption,videoUrl,createdAt:Date.now(),likes:[],views:0,comments:[]};db.tiktok.posts.unshift(post);if(db.tiktok.posts.length>500)db.tiktok.posts=db.tiktok.posts.slice(0,500);saveSync();return json(res,201,{post:tiktokPostView(post,me)});
  }

  if(req.method==='GET'&&url.pathname==='/api/social')return json(res,200,{requests:u.requests||[],contacts:u.contacts||[]})
  if(req.method==='POST'&&url.pathname==='/api/request'){const b=await body(req),target=norm(b.username);if(!db.users[target])return json(res,404,{error:'User not found.'});if(target===me)return json(res,400,{error:'You cannot add yourself.'});const tu=db.users[target];tu.requests??=[];if(!tu.requests.some(x=>norm(x.username)===me))tu.requests.push({username:u.username,createdAt:Date.now()});saveSync();emit(target,{type:'request',from:u.username});return json(res,200,{ok:true})}
  if(req.method==='POST'&&url.pathname==='/api/request/respond'){const b=await body(req),from=norm(b.username),accept=!!b.accept,idx=(u.requests||[]).findIndex(x=>norm(x.username)===from);if(idx<0)return json(res,404,{error:'Request not found.'});u.requests.splice(idx,1);if(accept){const fu=db.users[from];u.contacts??=[];fu.contacts??=[];if(!u.contacts.includes(from))u.contacts.push(from);if(!fu.contacts.includes(me))fu.contacts.push(me);emit(from,{type:'accepted',username:u.username})}saveSync();return json(res,200,{ok:true})}
  if(req.method==='GET'&&url.pathname==='/api/messages'){const withUser=norm(url.searchParams.get('with'));if(!u.contacts?.includes(withUser))return json(res,403,{error:'Not a contact.'});return json(res,200,{messages:u.messages?.[withUser]||[]})}
  if(req.method==='POST'&&url.pathname==='/api/chat/send'){const b=await body(req),target=norm(b.to),tu=db.users[target];if(!tu||!u.contacts?.includes(target))return json(res,403,{error:'You are not contacts.'});const item={id:token().slice(0,12),from:me,to:target,text:String(b.text||'').slice(0,4000),at:Date.now()};u.messages??={};tu.messages??={};u.messages[target]??=[];tu.messages[me]??=[];u.messages[target].push(item);tu.messages[me].push(item);saveSync();emit(target,{type:'chat',message:item});return json(res,200,{message:item})}
  if(req.method==='POST'&&url.pathname==='/api/meet/create'){let code;do{code=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(code));rooms.set(code,{host:me,guest:null,created:Date.now()});return json(res,200,{code})}
  if(req.method==='POST'&&url.pathname==='/api/meet/join'){const b=await body(req),code=String(b.code||'').toUpperCase(),room=rooms.get(code);if(!room)return json(res,404,{error:'Call not found or it has ended.'});if(room.guest)return json(res,409,{error:'That call already has a guest.'});if(room.host===me)return json(res,400,{error:'You are already hosting this call.'});room.guest=me;emit(room.host,{type:'meet:peer-joined'});return json(res,200,{ok:true})}
  if(req.method==='POST'&&url.pathname==='/api/meet/signal'){const b=await body(req),room=rooms.get(String(b.code||'').toUpperCase());if(!room)return json(res,404,{error:'Call ended.'});const target=room.host===me?room.guest:room.host;if(!target)return json(res,409,{error:'No other participant yet.'});emit(target,{type:'meet:signal',data:b.data});return json(res,200,{ok:true})}
  if(req.method==='POST'&&url.pathname==='/api/meet/leave'){const b=await body(req),code=String(b.code||'').toUpperCase(),room=rooms.get(code);if(room){const target=room.host===me?room.guest:room.host;if(target)emit(target,{type:'meet:left'});rooms.delete(code)}return json(res,200,{ok:true})}
  return json(res,404,{error:'Not found'});
 }catch(e){console.error('API error:',e.message);return json(res,400,{error:e.message||'Bad request'})}
}

// Nova self-hosted CORS proxy. This is intentionally separate from the existing OS API.
const CORS_PROXY_TIMEOUT=Math.min(60000,Math.max(3000,Number(process.env.NOVA_CORS_PROXY_TIMEOUT_MS||15000)));
const CORS_PROXY_MAX_REDIRECTS=Math.min(5,Math.max(0,Number(process.env.NOVA_CORS_PROXY_MAX_REDIRECTS||3)));
const corsProxyBuckets=new Map();

function proxyClientKey(req){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  return forwarded||req.socket.remoteAddress||'unknown';
}
function proxyRateLimited(req){
  const now=Date.now(), key=proxyClientKey(req), item=corsProxyBuckets.get(key);
  if(!item||now-item.started>=60000){corsProxyBuckets.set(key,{started:now,count:1});return false}
  item.count++;
  return item.count>120;
}
function isPrivateIPv4(ip){
  const p=ip.split('.').map(Number);
  if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return true;
  const n=((p[0]*256+p[1])*256+p[2])*256+p[3];
  return (n>=0x00000000&&n<=0x00ffffff)||
    (n>=0x0a000000&&n<=0x0affffff)||
    (n>=0x64400000&&n<=0x647fffff)||
    (n>=0x7f000000&&n<=0x7fffffff)||
    (n>=0xa9fe0000&&n<=0xa9feffff)||
    (n>=0xac100000&&n<=0xac1fffff)||
    (n>=0xc0000000&&n<=0xc00000ff)||
    (n>=0xc0000200&&n<=0xc00002ff)||
    (n>=0xc0001000&&n<=0xc00010ff)||
    (n>=0xc0002000&&n<=0xc0002fff)||
    (n>=0xc6120000&&n<=0xc613ffff)||
    (n>=0xc6336400&&n<=0xc63364ff)||
    (n>=0xcb007100&&n<=0xcb0071ff)||
    (n>=0xe0000000&&n<=0xffffffff);
}
function isPrivateIPv6(ip){
  const x=ip.toLowerCase().split('%')[0];
  if(x==='::'||x==='::1'||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('fe8')||x.startsWith('fe9')||x.startsWith('fea')||x.startsWith('feb')||x.startsWith('ff'))return true;
  return false;
}
async function validateProxyTarget(raw){
  let u;
  try{u=new URL(String(raw||''))}catch{throw new Error('Invalid target URL.')}
  if(!['http:','https:'].includes(u.protocol))throw new Error('Only HTTP and HTTPS targets are allowed.');
  if(u.username||u.password)throw new Error('Target credentials are not allowed.');
  if(u.port&&u.port!=='80'&&u.port!=='443')throw new Error('Target port is not allowed.');
  const host=u.hostname.toLowerCase().replace(/\.$/,'');
  if(!host||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host==='metadata.google.internal'||host==='metadata.google.com')throw new Error('Target host is not allowed.');
  const addresses=await dns.lookup(host,{all:true,verbatim:false});
  if(!addresses.length)throw new Error('Target host could not be resolved.');
  for(const a of addresses){
    if((net.isIP(a.address)===4&&isPrivateIPv4(a.address))||(net.isIP(a.address)===6&&isPrivateIPv6(a.address)))throw new Error('Target host resolves to a private or reserved address.');
  }
  return u;
}
async function fetchCorsProxy(target,method,redirects=0){
  const u=await validateProxyTarget(target);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),CORS_PROXY_TIMEOUT);
  try{
    const r=await fetch(u,{method,redirect:'manual',signal:controller.signal,headers:{
      'User-Agent':'NovaOS-CORS-Proxy/1.0',
      'Accept':'*/*'
    }});
    if([301,302,303,307,308].includes(r.status)){
      if(redirects>=CORS_PROXY_MAX_REDIRECTS)throw new Error('Too many redirects.');
      const location=r.headers.get('location');
      if(!location)throw new Error('Redirect has no destination.');
      return fetchCorsProxy(new URL(location,u).toString(),method,redirects+1);
    }
    return {url:u,response:r};
  }finally{clearTimeout(timer)}
}
async function serveCorsProxy(req,res){
  const cors={
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type, Accept, Range, Authorization',
    'Access-Control-Expose-Headers':'Content-Type, Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified, Cache-Control',
    'Vary':'Origin',
    'X-Nova-CORS-Proxy':'1',
    'X-Content-Type-Options':'nosniff'
  };
  if(req.method==='OPTIONS'){res.writeHead(204,cors);return res.end()}
  if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Proxy supports GET and HEAD only.'},cors);
  if(proxyRateLimited(req))return json(res,429,{error:'Proxy rate limit exceeded. Try again later.'},cors);
  const incoming=new URL(req.url,'http://nova.local');
  const target=incoming.searchParams.get('url')||incoming.searchParams.get('q');
  if(!target)return json(res,400,{error:'Missing url query parameter.'},cors);
  try{
    const {response}=await fetchCorsProxy(target,req.method);
    const headers={...cors};
    for(const name of ['content-type','content-length','content-range','accept-ranges','etag','last-modified','cache-control']){
      const value=response.headers.get(name);if(value)headers[name.replace(/(^|-)([a-z])/g,(_,a,b)=>a+b.toUpperCase())]=value;
    }
    res.writeHead(response.status,headers);
    if(req.method==='HEAD'||!response.body)return res.end();
    for await(const chunk of response.body){if(!res.write(Buffer.from(chunk)))await new Promise(resolve=>res.once('drain',resolve))}
    res.end();
  }catch(e){
    const message=e.name==='AbortError'?'Target request timed out.':(e.message||'Proxy request failed.');
    if(!res.headersSent)json(res,502,{error:message},cors);else res.end();
  }
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.ico':'image/x-icon'};
const compressible=new Set(['.html','.js','.css','.svg','.txt','.json']);
function sendFile(req,res,file){fs.stat(file,(err,st)=>{if(err||!st.isFile())return json(res,404,{error:'Not found'});const ext=path.extname(file).toLowerCase(),etag='W/"'+st.size+'-'+Math.floor(st.mtimeMs)+'"';if(req.headers['if-none-match']===etag){res.writeHead(304,{'ETag':etag,'X-Content-Type-Options':'nosniff'});return res.end()}const noCacheExts=new Set(['.html','.js','.css','.json','.svg','.txt']);const mediaExts=new Set(['.mp4','.webm','.mov','.mp3','.wav','.ogg','.m4a']);const headers={'Content-Type':mime[ext]||'application/octet-stream','ETag':etag,'Cache-Control':noCacheExts.has(ext)?'no-cache':'public, max-age='+STATIC_MAX_AGE,'Last-Modified':st.mtime.toUTCString(),'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};const range=req.headers.range;if(range&&mediaExts.has(ext)){const match=/bytes=(\d*)-(\d*)/.exec(range);if(match){let start=match[1]?Number(match[1]):Math.max(0,st.size-(Number(match[2]||0)));let end=match[2]?Number(match[2]):st.size-1;if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||start>=st.size){res.writeHead(416,{'Content-Range':'bytes */'+st.size});return res.end()}end=Math.min(end,st.size-1);headers['Content-Range']=`bytes ${start}-${end}/${st.size}`;headers['Content-Length']=end-start+1;res.writeHead(206,headers);return req.method==='HEAD'?res.end():fs.createReadStream(file,{start,end}).pipe(res)}}if(req.method==='HEAD'){headers['Content-Length']=st.size;res.writeHead(200,headers);return res.end()}const accept=req.headers['accept-encoding']||'';if(compressible.has(ext)&&/\bgzip\b/.test(accept)){headers['Content-Encoding']='gzip';headers['Vary']='Accept-Encoding';res.writeHead(200,headers);fs.createReadStream(file).pipe(zlib.createGzip({level:4})).pipe(res)}else{headers['Content-Length']=st.size;res.writeHead(200,headers);fs.createReadStream(file).pipe(res)}})}
const server=http.createServer({keepAliveTimeout:65000,headersTimeout:66000,requestTimeout:120000},async(req,res)=>{try{if(req.url.startsWith('/proxy'))return await serveCorsProxy(req,res);if(req.url.startsWith('/api/'))return await api(req,res);const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const relative=pathname==='/'?'/index.html':pathname;const file=path.resolve(ROOT,'.'+relative);if(!file.startsWith(ROOT+path.sep))return json(res,403,{error:'Forbidden'});sendFile(req,res,file)}catch(e){console.error(e);if(!res.headersSent)json(res,500,{error:'Server error'})}});
setInterval(()=>{const now=Date.now();for(const [c,r] of rooms)if(now-r.created>2*60*60*1000)rooms.delete(c);for(const [sid,key] of Object.entries(db.sessions))if(!db.users[key])delete db.sessions[sid];prunePresence();for(const [k,v] of rateBuckets)if(now-v.started>120000)rateBuckets.delete(k)},30000).unref();
function listenOnPort(port){server.removeAllListeners('error');server.on('error',e=>{if(e.code==='EADDRINUSE'&&port<65535){console.warn(`Port ${port} is busy. Trying ${port+1}...`);listenOnPort(port+1)}else{if(e.code==='EADDRINUSE')console.error(`No free ports available. Please close an app using the port range around ${PORT}.`);else console.error(e.message);process.exit(1)}});server.listen(port,HOST,()=>console.log(`Nova OS ${require('./package.json').version} running on ${HOST}:${port}`));}
process.on('SIGINT',()=>{saveSync();server.close(()=>process.exit(0))});process.on('SIGTERM',()=>{saveSync();server.close(()=>process.exit(0))});
syncGamesMeta();
listenOnPort(PORT);
