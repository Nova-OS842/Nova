/* Nova OS self-hosted CORS proxy helper. Same-origin requests stay direct. */
window.NovaCorsProxy={
  url:function(target){
    if(!target||typeof target!=='string')return target;
    try{
      const u=new URL(target,window.location.href);
      if(u.origin===window.location.origin)return target;
      const base=String(window.NOVA_CORS_PROXY_URL||'/proxy');
      return base+(base.includes('?')?'&':'?')+'url='+encodeURIComponent(u.href);
    }catch{return target}
  },
  fetch:function(target,options){
    const opts={...(options||{})};
    const method=String(opts.method||'GET').toUpperCase();
    if(method!=='GET'&&method!=='HEAD')return fetch(target,opts);
    return fetch(this.url(target),opts);
  }
};
