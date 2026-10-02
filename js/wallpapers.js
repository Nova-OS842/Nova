
(function(){
  const PRESETS=[
    ["Midnight","linear-gradient(135deg,#070b16,#151a33,#24154a)"],
    ["Ocean","linear-gradient(135deg,#06131f,#083b5c,#123c70)"],
    ["Aurora","linear-gradient(135deg,#08131b,#173c48,#35235d)"],
    ["Sunset","linear-gradient(135deg,#26101b,#63332a,#271b4b)"],
    ["Forest","linear-gradient(135deg,#071610,#103a2c,#173d3c)"],
    ["Neon","linear-gradient(135deg,#090817,#201047,#401c5d)"],
    ["Soft","linear-gradient(135deg,#1b1d29,#31384d,#443b56)"],
    ["Minimal","linear-gradient(135deg,#111318,#22252d)"]
  ];
  window.NovaWallpapers={presets:PRESETS,
    setPreset(name){
      const p=PRESETS.find(x=>x[0]===name); if(!p)return;
      localStorage.setItem("novaWallpaperPreset",name);
      localStorage.removeItem("novaWallpaperImage");
      document.documentElement.style.setProperty("--nova-wallpaper",p[1]);
      const d=document.querySelector("#desktop,.desktop,#os-desktop");
      if(d){d.style.backgroundImage=p[1];d.style.backgroundSize="cover";d.style.backgroundPosition="center";}
    },
    setImage(data){
      localStorage.setItem("novaWallpaperImage",data);
      localStorage.removeItem("novaWallpaperPreset");
      const d=document.querySelector("#desktop,.desktop,#os-desktop");
      if(d){d.style.backgroundImage=`url("${data}")`;d.style.backgroundSize="cover";d.style.backgroundPosition="center";}
    },
    load(){
      const settings=window.Store?.getSettings?.();
      if(settings?.wallpaper && settings.wallpaper!=="default" && settings.wallpaper!=="custom") return;
      const img=localStorage.getItem("novaWallpaperImage"), name=localStorage.getItem("novaWallpaperPreset");
      if(img)this.setImage(img); else if(name)this.setPreset(name); else this.setPreset("Midnight");
    },
    handleFile(file){
      if(!file || !file.type.startsWith("image/"))return;
      const r=new FileReader(); r.onload=()=>this.setImage(r.result); r.readAsDataURL(file);
    }
  };
  document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>NovaWallpapers.load(),50));
})();
