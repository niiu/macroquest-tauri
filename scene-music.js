(function installQuestMusic(root){
  'use strict';
  const FADE_MS=1500,MAX_BYTES=8*1024*1024;
  const AUDIO_RE=/^data:audio\/(mpeg|ogg|wav|mp4);base64,[A-Za-z0-9+/]+={0,2}$/;
  function audioBytes(dataUrl){
    const comma=dataUrl.indexOf(',');
    if(comma<0)return Infinity;
    return Math.ceil((dataUrl.length-comma-1)*3/4);
  }
  function normalizeAction(music){
    if(music===undefined||music===null)return null;
    if(typeof music!=='object'||Array.isArray(music))return false;
    if(music.stop===true)return {stop:true};
    if(typeof music.track==='string'&&music.track)return {track:music.track};
    return false;
  }
  function validate(project){
    if(project.soundtrack!==undefined){
      if(!Array.isArray(project.soundtrack)||project.soundtrack.length>200)throw Error('Некорректная библиотека музыки.');
      const ids=new Set();
      for(const track of project.soundtrack){
        if(!track||typeof track.id!=='string'||!track.id||ids.has(track.id)||typeof track.title!=='string'||!track.title.trim()||track.title.length>100||typeof track.audio!=='string'||!AUDIO_RE.test(track.audio)||audioBytes(track.audio)>MAX_BYTES)throw Error('Некорректный музыкальный трек.');
        ids.add(track.id);
      }
    }
    const tracks=new Set((project.soundtrack||[]).map(t=>t.id));
    for(const s of project.scenes||[]){
      if(s.music===undefined)continue;
      const action=normalizeAction(s.music);
      if(action===false)throw Error('Некорректная настройка музыки сцены.');
      if(action&&action.track&&!tracks.has(action.track))throw Error('Сцена ссылается на отсутствующий трек.');
      if(typeof QuestService!=='undefined'&&QuestService.isService(s)&&s.music!==undefined)throw Error('Служебная нода не может задавать музыку.');
    }
  }
  function trackById(project,id){return (project.soundtrack||[]).find(t=>t.id===id)||null;}
  function createController(options={}){
    const AudioCtor=options.Audio||(typeof root.Audio!=='undefined'?root.Audio:typeof Audio!=='undefined'?Audio:null);
    const fadeMs=options.fadeMs??FADE_MS;
    const now=options.now||(()=>Date.now());
    let current=null,currentId=null,token=0,raf=0;
    function clearFade(){if(raf&&typeof root.cancelAnimationFrame==='function')root.cancelAnimationFrame(raf);raf=0;}
    function stopImmediate(){
      clearFade();token++;
      if(current){try{current.pause();current.src='';}catch(e){}current=null;}
      currentId=null;
    }
    function fadeTo(audio,from,to,done){
      clearFade();
      const start=now(),span=Math.max(1,fadeMs);
      audio.volume=from;
      const step=()=>{
        const t=Math.min(1,(now()-start)/span);
        audio.volume=from+(to-from)*t;
        if(t<1){
          raf=typeof root.requestAnimationFrame==='function'?root.requestAnimationFrame(step):0;
          if(!raf){audio.volume=to;done?.();}
        }else{raf=0;done?.();}
      };
      step();
    }
    function playTrack(project,trackId){
      const track=trackById(project,trackId);if(!track||!AudioCtor)return false;
      if(currentId===trackId&&current)return true;
      const nextToken=++token;
      const startNew=()=>{
        if(nextToken!==token)return;
        const audio=new AudioCtor(track.audio);
        audio.loop=true;audio.volume=0;
        current=audio;currentId=trackId;
        const play=audio.play?.();
        if(play&&typeof play.then==='function')play.catch(()=>{});
        fadeTo(audio,0,1);
      };
      if(current){
        const prev=current;
        fadeTo(prev,prev.volume,0,()=>{
          try{prev.pause();prev.src='';}catch(e){}
          if(current===prev)current=null;
          startNew();
        });
      }else startNew();
      return true;
    }
    function stop(fade=true){
      if(!current){currentId=null;return;}
      if(!fade){stopImmediate();return;}
      const prev=current,nextToken=++token;
      fadeTo(prev,prev.volume,0,()=>{
        if(nextToken!==token)return;
        try{prev.pause();prev.src='';}catch(e){}
        if(current===prev){current=null;currentId=null;}
      });
    }
    function apply(project,music){
      const action=normalizeAction(music);
      if(action===false||action===null)return {changed:false,action:null,trackId:currentId};
      if(action.stop){stop(true);return {changed:true,action,trackId:null};}
      if(action.track===currentId)return {changed:false,action,trackId:currentId};
      playTrack(project,action.track);
      return {changed:true,action,trackId:action.track};
    }
    return {
      FADE_MS:fadeMs,
      get trackId(){return currentId;},
      apply,
      stop,
      dispose:stopImmediate
    };
  }
  const api={FADE_MS,MAX_BYTES,AUDIO_RE,audioBytes,normalizeAction,validate,trackById,createController};
  api.standaloneSource=()=>`(${installQuestMusic.toString()})(globalThis);`;
  if(typeof module!=='undefined')module.exports=api;else root.QuestMusic=api;
})(globalThis);
