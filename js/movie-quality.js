
window.NovaMovieQuality={
  levels:["Auto","720p","1080p"],
  apply(frame,level){
    if(!frame)return;
    frame.classList.remove("q720","q1080");
    frame.dataset.quality=level;
    if(level==="720p")frame.classList.add("q720");
    if(level==="1080p")frame.classList.add("q1080");
  },
  note(level){
    return level==="Auto" ? "Original / automatic" :
           level==="1080p" ? "1080p display scaling" : "720p display scaling";
  }
};
