'use strict';
function ensureSoundtrack(){if(!Array.isArray(project.soundtrack))project.soundtrack=[];return project.soundtrack;}
function musicRefs(trackId){return project.scenes.filter(s=>!QuestService.isService(s)&&s.music&&s.music.track===trackId);}
function nextMusicId(){
  const used=new Set(ensureSoundtrack().map(t=>t.id));
  let n=1;while(used.has('m'+n))n++;return 'm'+n;
}
function readAudioFile(file){
  return new Promise((resolve,reject)=>{
    if(!file)return reject(Error('Файл не выбран.'));
    const ok=['audio/mpeg','audio/ogg','audio/wav','audio/mp4'].includes(file.type)||/\.(mp3|ogg|wav|m4a)$/i.test(file.name||'');
    if(!ok)return reject(Error('Выберите MP3, OGG, WAV или M4A.'));
    if(file.size>QuestMusic.MAX_BYTES)return reject(Error('Максимальный размер трека — 8 МБ.'));
    const reader=new FileReader();
    reader.onload=()=>{
      const audio=String(reader.result||'');
      if(!QuestMusic.AUDIO_RE.test(audio))return reject(Error('Не удалось прочитать аудиофайл.'));
      if(QuestMusic.audioBytes(audio)>QuestMusic.MAX_BYTES)return reject(Error('Максимальный размер трека — 8 МБ.'));
      resolve(audio);
    };
    reader.onerror=()=>reject(Error('Не удалось прочитать аудиофайл.'));
    reader.readAsDataURL(file);
  });
}
function renderMusicEditor(){
  const s=scene();if(!s||QuestService.isNote(s))return;
  const mode=$('music-mode'),track=$('music-track'),row=$('music-track-row'),status=$('music-status');
  const action=QuestMusic.normalizeAction(s.music);
  mode.value=action?.stop?'stop':action?.track?'track':'inherit';
  row.hidden=mode.value!=='track';
  const list=ensureSoundtrack();
  track.replaceChildren();
  if(!list.length){const o=el('option','','Сначала загрузите трек');o.value='';track.append(o);}
  else list.forEach(t=>{const o=el('option','',t.title);o.value=t.id;track.append(o);});
  if(action?.track&&list.some(t=>t.id===action.track))track.value=action.track;
  else if(list.length)track.value=list[0].id;
  status.textContent=mode.value==='inherit'?'Музыка предыдущей сцены продолжается.':mode.value==='stop'?'Текущий трек затихнет с затуханием (~1.5 с).':list.length?`Библиотека: ${list.length} трек(ов).`:'Загрузите аудиофайл в библиотеку квеста.';
}
function applyMusicMode(){
  const s=scene(),mode=$('music-mode').value;
  if(mode==='inherit'){delete s.music;}
  else if(mode==='stop'){s.music={stop:true};}
  else{
    const id=$('music-track').value||ensureSoundtrack()[0]?.id;
    if(!id){delete s.music;$('music-mode').value='inherit';alert('Сначала загрузите трек.');renderMusicEditor();return;}
    s.music={track:id};
  }
  save();renderMusicEditor();renderGraph();
}
$('music-mode').onchange=applyMusicMode;
$('music-track').onchange=()=>{if($('music-mode').value!=='track')return;scene().music={track:$('music-track').value};save();renderGraph();};
$('upload-music').onclick=()=>$('music-file').click();
$('music-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const audio=await readAudioFile(file);
    const title=(file.name||'Трек').replace(/\.[^.]+$/,'').trim().slice(0,100)||'Трек';
    const track={id:nextMusicId(),title,audio};
    ensureSoundtrack().push(track);
    scene().music={track:track.id};$('music-mode').value='track';
    save();renderMusicEditor();renderGraph();
  }catch(err){alert(err.message);}
  finally{e.target.value='';}
};
$('manage-soundtrack').onclick=()=>{
  const list=ensureSoundtrack();
  if(!list.length){alert('Библиотека пуста. Загрузите трек кнопкой «↑ Загрузить».');return;}
  const lines=list.map((t,i)=>`${i+1}. ${t.title} (${t.id})`).join('\n');
  const pick=prompt(`Библиотека саундтрека:\n${lines}\n\nВведите номер трека для переименования или удаления:`,'1');
  if(pick===null)return;
  const index=Number(pick)-1;const track=list[index];
  if(!track){alert('Нет такого номера.');return;}
  const action=prompt(`Трек «${track.title}»\nВведите новое название или напишите УДАЛИТЬ:`,track.title);
  if(action===null)return;
  if(action.trim().toUpperCase()==='УДАЛИТЬ'){
    const refs=musicRefs(track.id);
    if(refs.length&&!confirm(`Трек используется в ${refs.length} сцен(ах). Удалить и сбросить музыку этих сцен?`))return;
    refs.forEach(s=>delete s.music);
    list.splice(index,1);
    if(!list.length)delete project.soundtrack;
  }else{
    const title=action.trim().slice(0,100);
    if(!title){alert('Название не может быть пустым.');return;}
    track.title=title;
  }
  save();renderMusicEditor();renderGraph();
};
