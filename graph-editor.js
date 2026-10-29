'use strict';
const mobileEditor=matchMedia('(max-width: 720px)');
let dockPreference=false,connectionSource=null,connectionPointer=null,connectionFrame=0;
let lastDisconnected=null;
let lastDeletedScene=null,sceneDragId=null;
const undoScene=el('button','quiet','↶ Вернуть сцену');undoScene.hidden=true;
document.querySelector('.canvas-footer').append(undoScene);
function deleteScene(id){
  const removed=project.scenes.find(s=>s.id===id);if(!removed)return;
  const playableLeft=QuestService.playable(project).filter(s=>s.id!==id);
  if(!QuestService.isService(removed)&&!playableLeft.length)return;
  lastDeletedScene={project,scene:removed,index:project.scenes.indexOf(removed),start:project.start,paths:[],dialogues:[],notes:[]};
  for(const s of project.scenes)for(const p of s.actors||[])if(p.dialogue===id){lastDeletedScene.dialogues.push(p);delete p.dialogue;}
  for(const s of project.scenes){s.choices.forEach((c,i)=>{if(c.target===id||(c.check&&[...c.check.targets,c.check.failureTarget].includes(id)))lastDeletedScene.paths.push({source:s,choice:c,index:i});});s.choices=s.choices.filter(c=>c.target!==id&&!(c.check&&[...c.check.targets,c.check.failureTarget].includes(id)));}
  for(const note of project.scenes)if(QuestService.isNote(note)&&note.target===id){lastDeletedScene.notes.push({note,target:note.target});note.target='';}
  project.scenes=project.scenes.filter(s=>s!==removed);
  if(project.start===id)project.start=playableLeft[0].id;
  if(selected===id)selected=project.start;
  QuestService.syncNoteChapters(project);
  save();render();undoScene.hidden=false;$('graph-status').textContent=(QuestService.isNote(removed)?'Заметка удалена':'Сцена удалена')+'. Её можно вернуть кнопкой рядом.';
}
undoScene.onclick=()=>{
  const last=lastDeletedScene;if(!last||last.project!==project)return;
  project.scenes.splice(Math.min(last.index,project.scenes.length),0,last.scene);
  for(const p of last.dialogues||[])if(!p.dialogue&&project.scenes.some(s=>s.actors?.includes(p)))p.dialogue=last.scene.id;
  for(const p of last.paths)if(project.scenes.includes(p.source)&&project.scenes.some(s=>s.id===p.choice.target)&&(!p.choice.check||[...p.choice.check.targets,p.choice.check.failureTarget].every(t=>!t||project.scenes.some(s=>s.id===t)))){
    try{QuestRules.validateChoice(p.choice,project.variables||[]);p.source.choices.splice(Math.min(p.index,p.source.choices.length),0,p.choice);}catch(e){}
  }
  for(const entry of last.notes||[])if(project.scenes.includes(entry.note)&&project.scenes.some(s=>s.id===entry.target&&!QuestService.isService(s)))entry.note.target=entry.target;
  QuestService.syncNoteChapters(project);
  project.start=last.start;selected=last.scene.id;lastDeletedScene=null;save();render();
};
function moveScene(id,before,after=false){
  if(id===before)return;const from=project.scenes.findIndex(s=>s.id===id);if(from<0)return;
  const [s]=project.scenes.splice(from,1),to=project.scenes.findIndex(s=>s.id===before);
  project.scenes.splice(to<0?project.scenes.length:to+(after?1:0),0,s);save();renderGraph();
}
const undoDisconnect=el('button','quiet','↶ Вернуть путь');
undoDisconnect.id='undo-disconnect';undoDisconnect.hidden=true;
document.querySelector('.canvas-footer').append(undoDisconnect);
function pathTargets(choice){return choice.check?[...new Set([...choice.check.targets,choice.check.failureTarget].filter(Boolean))]:[choice.target];}
function dialogueLinks(source){return (source.actors||[]).filter(actor=>actor.dialogue&&project.scenes.some(s=>s.id===actor.dialogue)).map(actor=>({source,choice:actor,actor,target:actor.dialogue,name:project.characters?.find(c=>c.id===actor.character)?.name||'Персонаж'}));}
function noteLinks(target){return project.scenes.filter(s=>QuestService.isNote(s)&&s.target===target).map(note=>({source:note,choice:note,note:true,target}));}
function incomingPaths(target){return project.scenes.flatMap(source=>[...source.choices.filter(choice=>pathTargets(choice).includes(target)).map(choice=>({source,choice})),...dialogueLinks(source).filter(link=>link.target===target),...noteLinks(target)]);}
function disconnectDialogue(source,actor){
  if(!source.actors?.includes(actor)||!actor.dialogue)return;
  lastDisconnected={project,source,actor,target:actor.dialogue};delete actor.dialogue;
  save();renderGraph();renderInspector();$('graph-status').textContent='Связь с диалогом отключена. Персонаж остаётся на сцене.';
}
function nodeHeight(s){return Math.max(typeof editorNodeHeight==='function'?editorNodeHeight():154,96+(incomingPaths(s.id).length-1)*28);}
function disconnectPath(source,choice){
  if(QuestService.isNote(source)&&choice===source){lastDisconnected={project,source,note:true,target:source.target||''};source.target='';QuestService.syncNoteChapters(project);save();renderGraph();renderInspector();$('graph-status').textContent='Заметка отключена от сцены.';return;}
  const index=source.choices.indexOf(choice);if(index<0)return;
  lastDisconnected={project,source,choice,index};source.choices.splice(index,1);
  save();renderGraph();renderInspector();
  $('graph-status').textContent=`Путь «${choice.text}» отключён.`;
}
undoDisconnect.onclick=()=>{
  const last=lastDisconnected;lastDisconnected=null;
  if(!last||last.project!==project||!project.scenes.includes(last.source))return;
  if(last.note){if(last.target&&project.scenes.some(s=>s.id===last.target&&!QuestService.isService(s))){last.source.target=last.target;QuestService.syncNoteChapters(project);save();renderGraph();renderInspector();}return;}
  if(last.actor){if(last.source.actors?.includes(last.actor)&&!last.actor.dialogue&&project.scenes.some(s=>s.id===last.target&&s.dialogue)){last.actor.dialogue=last.target;save();renderGraph();renderInspector();}return;}
  if(!project.scenes.some(s=>s.id===last.choice.target))return;
  try{QuestRules.validateChoice(last.choice,project.variables||[]);}catch(e){renderGraph();$('graph-status').textContent='Путь нельзя вернуть: один из его параметров удалён.';return;}
  last.source.choices.splice(Math.min(last.index,last.source.choices.length),0,last.choice);
  save();renderGraph();renderInspector();setConnectionStatus();
};
try{dockPreference=localStorage.getItem('macroquest.dock-editor')==='true';}catch(e){}
const isEditorDocked=()=>mobileEditor.matches||dockPreference;
function updateEditorPlacement(){
  const docked=isEditorDocked(),wasOpen=$('scene-dialog').open;
  if(wasOpen)$('scene-dialog').close();
  (docked?$('editor-dock'):$('scene-dialog')).append($('scene-editor'));
  $('editor-dock').hidden=!docked;$('dock-editor').checked=docked;$('dock-editor').disabled=mobileEditor.matches;
  $('dock-editor').title=mobileEditor.matches?'На мобильном экране редактор находится под графом':'';
  $('close-scene-editor').hidden=docked;$('collapse-editor').hidden=!docked;
  document.body.classList.toggle('editor-docked',docked);
}
function setSceneTab(name){
  for(const panel of document.querySelectorAll('[data-editor-panel]'))panel.hidden=!!scene().dialogue&&panel.dataset.editorPanel!=='image';
  if(name==='image'){paintZones();document.querySelector('[data-editor-panel="image"]').scrollIntoView({block:'nearest',behavior:'smooth'});}
}
function openSceneEditor(){
  if(isEditorDocked())$('scene-editor').scrollIntoView({behavior:'smooth',block:'start'});
  else if(!$('scene-dialog').open)$('scene-dialog').showModal();
}
$('dock-editor').onchange=e=>{dockPreference=e.target.checked;try{localStorage.setItem('macroquest.dock-editor',String(dockPreference));}catch(e){}updateEditorPlacement();};
$('close-scene-editor').onclick=()=>$('scene-dialog').close();
$('graph-add-scene').onclick=()=>$('add-scene').click();
$('graph-add-note').onclick=()=>$('add-note').click();
mobileEditor.addEventListener('change',updateEditorPlacement);
updateEditorPlacement();

function resizeGraph(){
  const {width:w,height:h}=QuestGraphArea.bounds(project,nodeHeight);
  $('graph').style.width=w+'px';$('graph').style.height=h+'px';
  $('graph-space').style.width=w*zoom+'px';$('graph-space').style.height=h*zoom+'px';if(typeof requestMinimap==='function')requestMinimap();
}
function renderGraph(){
  undoScene.hidden=!lastDeletedScene||lastDeletedScene.project!==project;
  const undoTarget=lastDisconnected&&(lastDisconnected.actor||lastDisconnected.note?lastDisconnected.target:lastDisconnected.choice?.target);
  undoDisconnect.hidden=!lastDisconnected||lastDisconnected.project!==project||!project.scenes.includes(lastDisconnected.source)||!(lastDisconnected.note?!lastDisconnected.target||project.scenes.some(s=>s.id===lastDisconnected.target):project.scenes.some(s=>s.id===undoTarget));
  $('scene-count').textContent=QuestService.playable(project).length;$('scene-list').replaceChildren();$('nodes').replaceChildren();resizeGraph();
  project.scenes.forEach((s,i)=>{
    if(!QuestService.isService(s)){
      const item=el('button','scene-item'+(s.id===selected?' active':''));item.append(el('span','number',String(i+1).padStart(2,'0')));
      const label=el('span','',s.title||'Без названия');label.append(el('small','',s.dialogue?'Диалог':s.id===project.start?'Начальная сцена':(s.choices.length||dialogueLinks(s).length)?'Сцена':'Финал'));item.append(label);item.onclick=()=>select(s.id);$('scene-list').append(item);
      item.dataset.sceneId=s.id;item.draggable=true;item.title='Перетащите для изменения порядка. Alt + ↑/↓ — переместить с клавиатуры.';
      item.ondragstart=e=>{sceneDragId=s.id;e.dataTransfer.setData('text/plain',s.id);e.dataTransfer.effectAllowed='move';};
      item.ondragover=e=>{if(sceneDragId){e.preventDefault();e.dataTransfer.dropEffect='move';}};
      item.ondrop=e=>{e.preventDefault();const r=item.getBoundingClientRect();if(sceneDragId)moveScene(sceneDragId,s.id,e.clientY>r.top+r.height/2);sceneDragId=null;};item.ondragend=()=>{sceneDragId=null;};
      item.onkeydown=e=>{if(!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const index=project.scenes.indexOf(s),other=index+(e.key==='ArrowUp'?-1:1);if(other<0||other>=project.scenes.length)return;[project.scenes[index],project.scenes[other]]=[project.scenes[other],project.scenes[index]];save();renderGraph();[...document.querySelectorAll('.scene-item')].find(n=>n.dataset.sceneId===s.id)?.focus();};
    }
    const note=QuestService.isNote(s);
    const node=el('div','node'+(note?' note-node':'')+(s.id===selected?' selected':''));node.style.left=s.x+'px';node.style.top=s.y+'px';node.dataset.sceneId=s.id;
    node.style.minHeight=(note?120:nodeHeight(s))+'px';
    const card=el('button','node-card');card.setAttribute('aria-label',(note?'Заметка: ':'Редактировать: ')+(s.title||''));
    const top=el('div','node-top',note?'✎ ЗАМЕТКА':s.dialogue?'☏ ДИАЛОГ':s.id===project.start?'⚑ НАЧАЛО':(s.choices.length||dialogueLinks(s).length)?'◇ СЦЕНА':'✦ ФИНАЛ');
    if(!note)top.append(el('span','',String(i+1).padStart(2,'0')));
    const body=el('div','node-body');
    if(note)body.append(el('h3','',s.title||'Заметка'),el('p','',QuestService.preview(s)),el('div','node-count',s.target?'→ '+(project.scenes.find(n=>n.id===s.target)?.title||'сцена'):'Не подключена'));
    else{const noteCount=QuestService.notesFor(project,s.id).length;const musicMark=s.music?.stop?' · ♪ стоп':s.music?.track?' · ♪':'';body.append(el('h3','',s.title||'Без названия'),el('p','',s.text||'Здесь начинается история…'),el('div','node-count',`${s.choices.length} переходов${dialogueLinks(s).length?' · ☏ '+dialogueLinks(s).length+' диалогов':''}${noteCount?' · ✎ '+noteCount:''}${s.image?' · ▧ картинка':''}${musicMark}`));}
    card.append(top,body);
    card.onclick=()=>{if(performance.now()<Number(node.dataset.suppressUntil||0))return;if(connectionSource)completeConnection(s.id);else if(note){selected=s.id;renderGraph();openNoteEditor(s.id);}else select(s.id);};
    card.ondblclick=e=>{if(note){e.preventDefault();e.stopPropagation();openNoteEditor(s.id);}};
    card.onpointerdown=e=>{if(!connectionSource)dragScene(e,s,node,card);};
    node.append(card);
    const removeScene=el('button','node-delete','×');removeScene.setAttribute('aria-label',(note?'Удалить заметку: ':'Удалить сцену: ')+s.title);
    removeScene.disabled=!note&&QuestService.playable(project).length===1;removeScene.onclick=e=>{e.stopPropagation();deleteScene(s.id);};node.append(removeScene);
    if(!note){
      const incoming=incomingPaths(s.id);
      (incoming.length?incoming:[null]).forEach((path,index)=>{
        const input=el('button','node-port port-in'+(path?' connected-port':'')+(path?.note?' note-port':''));input.style.top=(76+index*28)+'px';
        const label=path?.note?`Отключить заметку: ${path.source.title} → ${s.title}`:path?.actor?`Отключить разговор: ${path.source.title} → ${s.title}. ${path.name}`:path?`Отключить путь: ${path.source.title} → ${s.title}. ${path.choice.text}`:'Вход: '+s.title;
        input.dataset.restLabel=label;input.setAttribute('aria-label',label);input.title=path?label:'Завершить путь здесь';
        if(path)input.append(el('span','port-mark','×'));
        input.onclick=e=>{e.stopPropagation();if(connectionSource)completeConnection(s.id);else if(path?.actor)disconnectDialogue(path.source,path.actor);else if(path)disconnectPath(path.source,path.choice);};
        node.append(input);
      });
    }
    const output=el('button','node-port port-out',note?'→':'+');output.setAttribute('aria-label',note?'Прикрепить заметку к сцене: '+s.title:'Проложить путь из: '+s.title);
    output.title=note?'Перетащите к сцене, к которой относится заметка':'Перетащите к другой сцене или нажмите и выберите сцену';
    output.onpointerdown=e=>beginConnection(e,s,output);output.onclick=e=>{e.stopPropagation();if(e.detail===0){connectionSource=s;setConnectionStatus();}};
    node.append(output);$('nodes').append(node);
  });if(typeof renderChapterGroups==='function')renderChapterGroups();drawEdges();setConnectionStatus();
}
function svgEl(name,attributes){const n=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v] of Object.entries(attributes))n.setAttribute(k,v);return n;}
function edgeGeometry(s,t,lane,choice){
  const outY=QuestService.isNote(s)?60:76;
  if(typeof QuestChapters!=='undefined'){s=QuestChapters.proxy(project,s);t=QuestChapters.proxy(project,t);}
  const inputIndex=incomingPaths(t.id).findIndex(p=>p.choice===choice);
  const x=s.x+220,y=s.y+outY,tx=t.x,ty=t.y+76+Math.max(0,inputIndex)*28,offset=lane*30;
  if(s.id===t.id){const top=Math.max(8,s.y-48-offset);return {d:`M ${x} ${y} C ${x+100} ${y}, ${x+95} ${top}, ${s.x+110} ${top} C ${s.x-85} ${top}, ${s.x-85} ${ty}, ${tx} ${ty}`,lx:s.x+110,ly:top};}
  if(tx<x){const bottom=Math.max(s.y+nodeHeight(s),t.y+nodeHeight(t))+51+offset;return {d:`M ${x} ${y} C ${x+95} ${y}, ${x+95} ${bottom}, ${x} ${bottom} L ${tx} ${bottom} C ${tx-65} ${bottom}, ${tx-65} ${ty}, ${tx} ${ty}`,lx:(x+tx)/2,ly:bottom};}
  const bend=Math.max(55,(tx-x)*.5),cy=y+offset,cty=ty+offset;
  return {d:`M ${x} ${y} C ${x+bend} ${cy}, ${tx-bend} ${cty}, ${tx} ${ty}`,lx:(x+tx)/2,ly:(y+ty)/2+.75*offset};
}
function drawEdges(){
  const svg=$('edges');svg.replaceChildren();$('edge-labels').replaceChildren();
  const defs=svgEl('defs',{}),marker=svgEl('marker',{id:'path-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});marker.append(svgEl('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#aabc7d'}));defs.append(marker);svg.append(defs);
  for(const s of project.scenes){
    const lanes=new Map();
    if(QuestService.isNote(s)){
      const t=project.scenes.find(n=>n.id===s.target&&!QuestService.isService(n));if(!t)continue;
      if(typeof QuestChapters!=='undefined'&&QuestChapters.internal(project,s,t))continue;
      const lane=lanes.get(t.id)||0;lanes.set(t.id,lane+1);const g=edgeGeometry(s,t,lane,s);
      svg.append(svgEl('path',{d:g.d,fill:'none',stroke:'#d4b56a','stroke-width':2,'stroke-dasharray':'5 4','marker-end':'url(#path-arrow)'}));
      const open=e=>{e.stopPropagation();if(!connectionSource)openNoteEditor(s.id);};
      const hit=svgEl('path',{d:g.d,fill:'none',stroke:'transparent','stroke-width':18,class:'edge-hit'});hit.onclick=open;svg.append(hit);
      const label=el('button','edge-label note-edge','✎ '+(s.title||'Заметка'));label.style.left=g.lx+'px';label.style.top=g.ly+'px';
      label.title='Заметка · нажмите, чтобы открыть';label.onclick=open;$('edge-labels').append(label);
      continue;
    }
    for(const c of s.choices){for(const target of pathTargets(c)){const t=project.scenes.find(n=>n.id===target);if(!t||QuestService.isService(t))continue;if(typeof QuestChapters!=='undefined'&&QuestChapters.internal(project,s,t))continue;
      const lane=lanes.get(t.id)||0;lanes.set(t.id,lane+1);const g=edgeGeometry(s,t,lane,c);
      const path=svgEl('path',{d:g.d,fill:'none',stroke:s.id===selected?'#aabc7d':'#647953','stroke-width':2,'marker-end':'url(#path-arrow)'});svg.append(path);
      const hit=svgEl('path',{d:g.d,fill:'none',stroke:'transparent','stroke-width':18,class:'edge-hit'});hit.onclick=e=>{e.stopPropagation();if(!connectionSource)openPathEditor(s,c);};svg.append(hit);
      const label=el('button','edge-label'+(c.conditions?.length?' has-conditions':''),`${c.conditions?.length?'◆ ':''}${c.text||'Переход'}`);label.style.left=g.lx+'px';label.style.top=g.ly+'px';label.title=QuestRules.summary(c,project.variables||[]);label.setAttribute('aria-label',`Путь: ${s.title} → ${t.title}. ${c.text}. ${label.title}`);label.onclick=e=>{e.stopPropagation();if(!connectionSource)openPathEditor(s,c);};$('edge-labels').append(label);
      if(c.effects?.length){label.classList.add('has-effects');label.prepend('↯ ');label.title+=' · При переходе: '+QuestRules.effectsSummary(c,project.variables||[]);label.setAttribute('aria-label',`Путь: ${s.title} → ${t.title}. ${c.text}. ${label.title}`);}
      if(c.check){const bands=[...c.check.targets.flatMap((id,i)=>id===target?[QuestRules.rollBands[i]]:[]),...(c.check.failureTarget===target?['Провал']:[])].join(', ');label.prepend('🎲 ');label.append(el('small','',bands));label.title+=' · D20: '+bands;}
    }
    }
    for(const link of dialogueLinks(s)){
      const t=project.scenes.find(n=>n.id===link.target),lane=lanes.get(t.id)||0;lanes.set(t.id,lane+1);
      if(typeof QuestChapters!=='undefined'&&QuestChapters.internal(project,s,t))continue;const g=edgeGeometry(s,t,lane,link.actor);
      svg.append(svgEl('path',{d:g.d,fill:'none',stroke:'#8ecbd8','stroke-width':2,'stroke-dasharray':'7 5','marker-end':'url(#path-arrow)'}));
      const open=e=>{e.stopPropagation();if(!connectionSource)select(t.id);};
      const hit=svgEl('path',{d:g.d,fill:'none',stroke:'transparent','stroke-width':18,class:'edge-hit'});hit.onclick=open;svg.append(hit);
      const label=el('button','edge-label dialogue-edge','☏ '+link.name);
      label.style.left=g.lx+'px';label.style.top=g.ly+'px';
      label.title='Разговор с персонажем: '+link.name+' · '+t.title+' · Нажмите, чтобы открыть редактор диалога';
      label.setAttribute('aria-label','Открыть диалог: '+s.title+' → '+t.title+'. '+link.name);
      label.onclick=open;$('edge-labels').append(label);
    }
  }
}
function dragScene(e,s,node,card){
  if(e.button!==0)return;const startX=e.clientX,startY=e.clientY,x=s.x,y=s.y,size=QuestGraphArea.bounds(project,nodeHeight),height=nodeHeight(s);let moved=false;
  card.setPointerCapture(e.pointerId);
  card.onpointermove=ev=>{if(Math.hypot(ev.clientX-startX,ev.clientY-startY)>5)moved=true;if(!moved)return;Object.assign(s,QuestGraphArea.position(size,x+(ev.clientX-startX)/zoom,y+(ev.clientY-startY)/zoom,height));node.style.left=s.x+'px';node.style.top=s.y+'px';drawEdges();requestMinimap();if(typeof renderChapterFrames==='function')renderChapterFrames();};
  const end=ev=>{card.onpointermove=card.onpointerup=card.onpointercancel=null;if(card.hasPointerCapture(e.pointerId))card.releasePointerCapture(e.pointerId);if(moved){node.dataset.suppressUntil=performance.now()+350;if(ev.type==='pointercancel'){s.x=x;s.y=y;node.style.left=x+'px';node.style.top=y+'px';drawEdges();requestMinimap();if(typeof renderChapterFrames==='function')renderChapterFrames();}else save();}};
  card.onpointerup=end;card.onpointercancel=end;
}
function setConnectionStatus(){
  document.body.classList.toggle('connecting',!!connectionSource);
  for(const input of document.querySelectorAll('.port-in')){
    const target=project.scenes.find(s=>s.id===input.closest('[data-scene-id]').dataset.sceneId);
    const label=connectionSource?(QuestService.isNote(connectionSource)?'Прикрепить заметку к: ':'Подключить к сцене: ')+target.title:input.dataset.restLabel;
    input.setAttribute('aria-label',label);input.title=label;
  }
  $('graph-status').textContent=connectionSource
    ?(QuestService.isNote(connectionSource)?`Заметка «${connectionSource.title}»: выберите сцену для привязки. Esc — отмена.`:`Из «${connectionSource.title}»: выберите сцену или отпустите путь на пустом поле для создания новой. Esc — отмена.`)
    :'Крестик у входа — отключить путь · Двойной клик по заметке — текст · Клик по пути — условия';
}
function cancelConnection(){connectionSource=null;connectionPointer=null;cancelAnimationFrame(connectionFrame);connectionFrame=0;$('connection-preview').replaceChildren();setConnectionStatus();}
function completeConnection(target){
  const source=connectionSource;cancelConnection();
  if(!source||!project.scenes.includes(source))return;
  const dest=project.scenes.find(s=>s.id===target);if(!dest)return;
  if(QuestService.isNote(source)){
    if(QuestService.isService(dest)){$('graph-status').textContent='Заметку можно прикрепить только к обычной сцене.';return;}
    source.target=dest.id;QuestService.syncNoteChapters(project);save();renderGraph();renderInspector();$('graph-status').textContent='Заметка прикреплена к «'+dest.title+'».';return;
  }
  if(QuestService.isService(dest)){$('graph-status').textContent='Игровой путь нельзя вести на служебную ноду.';return;}
  openPathEditor(source,null,target);
}
function createConnectedScene(clientX,clientY){
  const source=connectionSource;cancelConnection();
  if(!source||!project.scenes.includes(source)||QuestService.isService(source))return;
  if(project.scenes.length>=500){$('graph-status').textContent='Максимум 500 узлов. Новая сцена не создана.';return;}
  const rect=$('graph').getBoundingClientRect();
  const position=QuestGraphArea.position(QuestGraphArea.bounds(project,nodeHeight),(clientX-rect.left)/zoom-110,(clientY-rect.top)/zoom-76);
  const next={id:'s'+crypto.randomUUID(),title:source.dialogue?'Следующая реплика':'Новая сцена',text:'',...position,choices:[]};
  if(typeof assignChapterAt==='function')assignChapterAt(next,clientX,clientY);
  if(source.dialogue){next.dialogue=true;next.speaker=source.speaker||'';QuestLayers.inheritArtwork(source,next);}
  const choice={text:source.dialogue?'Продолжить разговор':'Перейти в новую сцену',target:next.id,zone:[]};
  project.scenes.push(next);source.choices.push(choice);activeChoice=source.choices.length-1;
  save();renderGraph();renderInspector();openPathEditor(source,choice,next.id,true);
}
function connectionLine(x,y){
  if(!connectionSource)return;const r=$('graph').getBoundingClientRect(),tx=(x-r.left)/zoom,ty=(y-r.top)/zoom,s=connectionSource,sy=s.y+(QuestService.isNote(s)?60:76);
  const stroke=QuestService.isNote(s)?'#d4b56a':'#d7e8a6';
  $('connection-preview').replaceChildren(svgEl('path',{d:`M ${s.x+220} ${sy} C ${s.x+290} ${sy}, ${tx-70} ${ty}, ${tx} ${ty}`,fill:'none',stroke,'stroke-width':2,'stroke-dasharray':'6 4'}));
  $('connection-preview').append(svgEl('circle',{cx:tx,cy:ty,r:8,fill:'#28371f',stroke,'stroke-width':2}));
}
function autoPanConnection(){
  if(!connectionPointer||!connectionSource)return;
  const viewport=$('graph-viewport'),r=viewport.getBoundingClientRect(),{x,y}=connectionPointer,margin=40;
  if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom){viewport.scrollLeft+=x>r.right-margin?12:x<r.left+margin?-12:0;viewport.scrollTop+=y>r.bottom-margin?12:y<r.top+margin?-12:0;}
  connectionLine(x,y);connectionFrame=requestAnimationFrame(autoPanConnection);
}
function beginConnection(e,s,port){
  if(e.button!==0)return;e.stopPropagation();e.preventDefault();cancelConnection();connectionSource=s;setConnectionStatus();
  const x=e.clientX,y=e.clientY;let moved=false;port.setPointerCapture(e.pointerId);connectionLine(x,y);
  port.onpointermove=ev=>{moved ||= Math.hypot(ev.clientX-x,ev.clientY-y)>5;if(moved){connectionPointer={x:ev.clientX,y:ev.clientY};if(!connectionFrame)autoPanConnection();}};
  const end=ev=>{port.onpointermove=port.onpointerup=port.onpointercancel=null;connectionPointer=null;cancelAnimationFrame(connectionFrame);connectionFrame=0;
    if(port.hasPointerCapture(e.pointerId))port.releasePointerCapture(e.pointerId);
    if(ev.type==='pointercancel'){cancelConnection();return;}
    if(moved){
      const hit=document.elementFromPoint(ev.clientX,ev.clientY),target=hit?.closest('[data-scene-id]');
      if(target)completeConnection(target.dataset.sceneId);
      else if(hit&&['graph','graph-space','nodes','edges'].includes(hit.id))createConnectedScene(ev.clientX,ev.clientY);
      else cancelConnection();
    }
  };
  port.onpointerup=end;port.onpointercancel=end;
}
$('graph-viewport').addEventListener('pointermove',e=>{if(connectionSource&&!connectionPointer)connectionLine(e.clientX,e.clientY);});
$('graph-viewport').addEventListener('click',e=>{if(connectionSource&&!e.target.closest('.node'))cancelConnection();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&connectionSource){e.preventDefault();cancelConnection();}});
