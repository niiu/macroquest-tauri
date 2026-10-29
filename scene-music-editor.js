'use strict';
function ensureSoundtrack(){if(!Array.isArray(project.soundtrack))project.soundtrack=[];return project.soundtrack;}
function musicRefs(trackId){return project.scenes.filter(s=>!QuestService.isService(s)&&s.music&&s.music.track===trackId);}
function nextMusicId(){
  const used=new Set(ensureSoundtrack().map(t=>t.id));
  let n=1;while(used.has('m'+n))n++;return 'm'+n;
}
function fadeLabel(){
  const ms=QuestMusic.fadeMs(project);
  return ms?`${(ms/1000).toFixed(ms%1000?1:0)} с`:'мгновенно';
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
async function addMusicTrack(file,{select=true}={}){
  const audio=await readAudioFile(file);
  const title=(file.name||'Трек').replace(/\.[^.]+$/,'').trim().slice(0,100)||'Трек';
  const track={id:nextMusicId(),title,audio};
  ensureSoundtrack().push(track);
  if(select){scene().music={track:track.id};$('music-mode').value='track';}
  save();renderMusicEditor();renderGraph();renderSoundtrackDialog();
  return track;
}
function renderMusicEditor(){
  const s=scene();if(!s||QuestService.isNote(s))return;
  const mode=$('music-mode'),track=$('music-track'),row=$('music-track-row'),status=$('music-status'),fade=$('music-fade-ms'),summary=$('music-summary');
  const action=QuestMusic.normalizeAction(s.music);
  mode.value=action?.stop?'stop':action?.track?'track':'inherit';
  row.hidden=mode.value!=='track';
  fade.value=String(QuestMusic.fadeMs(project));
  const list=ensureSoundtrack();
  track.replaceChildren();
  if(!list.length){const o=el('option','','Сначала загрузите трек');o.value='';track.append(o);}
  else list.forEach(t=>{const o=el('option','',t.title);o.value=t.id;track.append(o);});
  if(action?.track&&list.some(t=>t.id===action.track))track.value=action.track;
  else if(list.length)track.value=list[0].id;
  if(summary)summary.textContent=list.length?`Музыка · ${list.length}`:'Музыка';
  status.textContent=mode.value==='inherit'?'Музыка предыдущей сцены продолжается.':mode.value==='stop'?`Текущий трек затихнет с затуханием (${fadeLabel()}).`:list.length?`Библиотека: ${list.length} · затухание ${fadeLabel()}.`:'Нажмите «↑ Загрузить», чтобы добавить трек в библиотеку квеста.';
}
function applyMusicMode(){
  const s=scene(),mode=$('music-mode').value;
  if(mode==='inherit'){delete s.music;}
  else if(mode==='stop'){s.music={stop:true};}
  else{
    const id=$('music-track').value||ensureSoundtrack()[0]?.id;
    if(!id){delete s.music;$('music-mode').value='inherit';alert('Сначала загрузите трек кнопкой «↑ Загрузить».');renderMusicEditor();return;}
    s.music={track:id};
  }
  save();renderMusicEditor();renderGraph();
}
$('music-mode').onchange=applyMusicMode;
$('music-track').onchange=()=>{if($('music-mode').value!=='track')return;scene().music={track:$('music-track').value};save();renderGraph();};
$('music-fade-ms').onchange=()=>{
  let value=Number($('music-fade-ms').value);
  if(!Number.isFinite(value))value=QuestMusic.FADE_MS;
  value=Math.max(QuestMusic.FADE_MIN,Math.min(QuestMusic.FADE_MAX,Math.round(value)));
  $('music-fade-ms').value=String(value);
  if(value===QuestMusic.FADE_MS)delete project.musicFadeMs;else project.musicFadeMs=value;
  previewMusic?.setFadeMs?.(QuestMusic.fadeMs(project));
  save();renderMusicEditor();
};
$('upload-music').onclick=()=>$('music-file').click();
$('music-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{await addMusicTrack(file,{select:true});}
  catch(err){alert(err.message);}
  finally{e.target.value='';}
};

const soundtrackDialog=el('dialog','chapter-dialog');soundtrackDialog.id='soundtrack-dialog';soundtrackDialog.setAttribute('aria-label','Библиотека музыки');
soundtrackDialog.innerHTML='<div class="dialog-heading"><div><div class="eyebrow">САУНДТРЕК КВЕСТА</div><h2>Библиотека музыки</h2></div><button type="button" id="close-soundtrack" class="icon" aria-label="Закрыть библиотеку">×</button></div><p class="hint">MP3, OGG, WAV или M4A · до 8 МБ. Треки хранятся в JSON квеста и попадают в HTML-экспорт.</p><div class="music-actions" style="margin:12px 0"><button type="button" id="soundtrack-upload">↑ Загрузить трек</button></div><div id="soundtrack-list"></div><p id="soundtrack-empty" class="hint" hidden>Библиотека пуста — загрузите первый трек.</p>';
document.body.append(soundtrackDialog);
function renderSoundtrackDialog(){
  if(!soundtrackDialog.open)return;
  const list=ensureSoundtrack(),host=$('soundtrack-list');host.replaceChildren();
  $('soundtrack-empty').hidden=!!list.length;
  list.forEach(track=>{
    const row=el('div','chapter-member');
    const title=el('input');title.type='text';title.maxLength=100;title.value=track.title;title.setAttribute('aria-label','Название трека');
    title.onchange=()=>{const next=title.value.trim().slice(0,100);if(!next){title.value=track.title;return;}track.title=next;save();renderMusicEditor();renderGraph();};
    const refs=musicRefs(track.id);
    const meta=el('small','hint',refs.length?`${refs.length} сцен`:'не используется');
    const remove=el('button','danger quiet','Удалить');remove.onclick=()=>{
      if(refs.length&&!confirm(`Трек «${track.title}» используется в ${refs.length} сцен(ах). Удалить и сбросить музыку этих сцен?`))return;
      refs.forEach(s=>delete s.music);
      const i=ensureSoundtrack().indexOf(track);if(i>=0)ensureSoundtrack().splice(i,1);
      if(!ensureSoundtrack().length)delete project.soundtrack;
      save();renderMusicEditor();renderGraph();renderSoundtrackDialog();
    };
    row.append(title,meta,remove);host.append(row);
  });
}
$('manage-soundtrack').onclick=()=>{renderSoundtrackDialog();soundtrackDialog.showModal();renderSoundtrackDialog();};
$('close-soundtrack').onclick=()=>soundtrackDialog.close();
$('soundtrack-upload').onclick=()=>$('music-file').click();
