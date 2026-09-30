'use strict';
const actorDialogueDialog=el('dialog','actor-dialogue-modal');actorDialogueDialog.id='actor-dialogue-modal';actorDialogueDialog.setAttribute('aria-labelledby','actor-dialogue-heading');
actorDialogueDialog.innerHTML='<div class="dialog-heading"><h2 id="actor-dialogue-heading">Диалог персонажа</h2><button type="button" id="close-actor-dialogue" aria-label="Закрыть диалог персонажа">×</button></div><div class="actor-dialogue-meta"><label class="field">Название сцены<input id="actor-dialogue-title" maxlength="100"></label><label class="field">Говорящий<input id="actor-dialogue-speaker" maxlength="100"></label></div><label class="field">Реплика<textarea id="actor-dialogue-text" rows="5"></textarea></label><div class="section-title"><h3>Ответы игрока</h3><button type="button" id="actor-dialogue-add">+ Ответ</button><button type="button" id="actor-dialogue-next">+ Следующая реплика</button></div><div id="actor-dialogue-answers"></div><p class="hint">Изменения сохраняются автоматически.</p>';
document.body.append(actorDialogueDialog);
let actorDialogueContext=null;
function openActorDialogue(owner,placement){
  try{
    const reply=QuestActorDialogue.resolve(project,owner,placement,true);if(!reply)return;
    actorDialogueContext={quest:project,owner,placement,reply};save();renderGraph();
    renderActorDialogue();actorDialogueDialog.showModal();$('actor-dialogue-text').focus();
  }catch(e){$('character-status').textContent=e.message;}
}
function renderActorDialogue(){
  const c=actorDialogueContext;if(!c||c.quest!==project||!project.scenes.includes(c.reply)){actorDialogueDialog.close();return;}
  const s=c.reply;$('actor-dialogue-title').value=s.title;$('actor-dialogue-speaker').value=s.speaker||'';$('actor-dialogue-text').value=s.text;
  const host=$('actor-dialogue-answers');host.replaceChildren();
  s.choices.forEach((choice,i)=>{
    const row=el('div','actor-answer-row');const edit=el('button','',`${i+1}. ${choice.text||'Без текста'}`);
    edit.onclick=()=>editActorAnswer(s,choice,renderActorDialogue);
    const target=project.scenes.find(n=>n.id===choice.target);row.append(edit,el('small','hint','→ '+(target?.title||'Сцена не найдена')));host.append(row);
  });
  if(!s.choices.length)host.append(el('p','hint','Пока нет ответов. Добавьте первый ответ.'));
}
function editActorAnswer(reply,choice,afterSave){
  openPathEditor(reply,choice,project.scenes.find(s=>s.id!==reply.id)?.id||reply.id,false,()=>{afterSave?.();});
}
for(const [id,key] of [['actor-dialogue-title','title'],['actor-dialogue-speaker','speaker'],['actor-dialogue-text','text']]){
  $(id).oninput=e=>{const c=actorDialogueContext;if(!c||c.quest!==project)return;c.reply[key]=e.target.value;save();renderGraph();};
}
$('actor-dialogue-add').onclick=()=>editActorAnswer(actorDialogueContext.reply,null,renderActorDialogue);
$('actor-dialogue-next').onclick=()=>{
  if(project.scenes.length>=500)return alert('Максимум 500 сцен.');
  const previous=actorDialogueContext.reply,next={id:'s'+crypto.randomUUID(),title:'Следующая реплика',speaker:previous.speaker||'',text:'',dialogue:true,x:previous.x+280,y:previous.y,choices:[]};
  QuestLayers.inheritArtwork(previous,next);project.scenes.push(next);previous.choices.push({text:'Продолжить разговор',target:next.id});actorDialogueContext.reply=next;save();renderGraph();renderActorDialogue();$('actor-dialogue-text').focus();
};
$('close-actor-dialogue').onclick=()=>actorDialogueDialog.close();
actorDialogueDialog.addEventListener('close',()=>{actorDialogueContext=null;renderInspector();renderGraph();});

const actorBadgePositions=new Map();
function positionActorBadges(){
  for(const [img,position] of actorBadgePositions){if(img.isConnected)position();else actorBadgePositions.delete(img);}
}
new ResizeObserver(positionActorBadges).observe($('image-surface'));
function renderActorAnswerBadges(img,owner,placement){
  for(const image of actorBadgePositions.keys())if(!image.isConnected)actorBadgePositions.delete(image);
  const reply=QuestActorDialogue.resolve(project,owner,placement);
  if(!reply?.choices.length)return ()=>{};
  const group=el('div','actor-answer-badges');group.setAttribute('aria-label','Ответы персонажа: '+img.alt);
  reply.choices.forEach((choice,i)=>{
    const button=el('button','actor-answer-badge',String(i+1));button.type='button';button.title=choice.text;
    button.setAttribute('aria-label',`Ответ ${i+1} · ${img.alt}: ${choice.text}`);
    button.onpointerdown=e=>e.stopPropagation();button.ondblclick=e=>e.stopPropagation();
    button.onclick=e=>{e.stopPropagation();editActorAnswer(reply,choice);};group.append(button);
  });
  $('editor-actors').append(group);
  const position=()=>{
    const surface=$('image-surface').getBoundingClientRect(),art=img.getBoundingClientRect();
    const left=Math.max(0,Math.min(surface.width-36,art.right-surface.left+6));
    const top=Math.max(0,Math.min(surface.height-36,art.top-surface.top));
    group.style.left=left+'px';group.style.top=top+'px';group.style.maxHeight=Math.max(36,surface.height-top)+'px';
  };
  actorBadgePositions.set(img,position);img.addEventListener('load',position);position();return position;
}
