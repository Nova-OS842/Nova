
window.NovaGameLinks = window.NovaGameLinks || [];
window.novaNormalizeGameEmbed = function(value){
  const raw=String(value||"").trim();
  const m=raw.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : raw;
};
window.novaGetDeveloperUrlGames = function(){
  return window.NovaGameLinks.map((g,i)=>({...g,id:g.id||"url-game-"+i,url:window.novaNormalizeGameEmbed(g.url||g.embed||g.src)})).filter(g=>g.url);
};
