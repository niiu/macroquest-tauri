'use strict';
const chaptersButton=el('button','','Главы');chaptersButton.id='manage-chapters';$('graph-add-scene').after(chaptersButton);
const chapterField=el('label','field','Глава сцены'),chapterSelect=el('select');chapterSelect.id='scene-chapter';chapterField.append(chapterSelect);document.querySelector('.scene-actions').before(chapterField);
chapterSelect.onchange=()=>{if(chapterSelect.value)scene().chapter=chapterSelect.value;else delete scene().chapter;save();renderGraph();};
function renderChapterSelect(){
  chapterSelect.replaceChildren();const empty=el('option','','Без главы');empty.value='';chapterSelect.append(empty);
  for(const c of project.chapters||[]){const option=el('option','',c.title);option.value=c.id;chapterSelect.append(option);}chapterSelect.value=scene().chapter||'';
}
const chapterDialog=el('dialog','chapter-dialog');chapterDialog.id='chapter-dialog';chapterDialog.setAttribute('aria-label','Главы квеста');
chapterDialog.innerHTML='<div class="dialog-heading"><h2>Главы квеста</h2><button id="close-chapters" aria-label="Закрыть главы">×</button></div><label class="field">Глава<select id="chapter-picker"></select></label><form id="chapter-form"><label class="field">Название главы<input id="chapter-title" maxlength="100" required></label><p class="hint">Отметьте сцены главы. Сцены из других глав будут перенесены сюда. Снятие отметки оставит сцену без главы.</p><div id="chapter-members"></div><p id="chapter-error" role="alert"></p><div class="chapter-actions"><button type="button" id="chapter-new">+ Новая глава</button><button type="button" id="chapter-delete">Убрать главу</button><button class="primary" type="submit">Сохранить главу</button></div></form>';
document.body.append(chapterDialog);let editingChapter=null,chapterQuest=null;
function openChapters(id=null){chapterQuest=project;editingChapter=id;renderChapterForm();chapterDialog.showModal();}
function renderChapterForm(){
  const chapter=project.chapters?.find(c=>c.id===editingChapter);editingChapter=chapter?.id||null;
  $('chapter-picker').replaceChildren();const fresh=el('option','','Новая глава');fresh.value='';$('chapter-picker').append(fresh);
  for(const c of project.chapters||[]){const o=el('option','',c.title);o.value=c.id;$('chapter-picker').append(o);}$('chapter-picker').value=editingChapter||'';
  $('chapter-title').value=chapter?.title||'';$('chapter-delete').disabled=!chapter;$('chapter-delete').textContent='Убрать главу';$('chapter-error').textContent='';
  $('chapter-members').replaceChildren();
  for(const s of QuestService.playable(project)){const row=el('label','chapter-member'),box=el('input');box.type='checkbox';box.value=s.id;box.checked=!!chapter&&s.chapter===chapter.id;row.append(box,el('span','',s.title||'Без названия'));const current=project.chapters?.find(c=>c.id===s.chapter);if(current)row.append(el('small','hint',current.title));$('chapter-members').append(row);}
}
chaptersButton.onclick=()=>openChapters(project.chapters?.[0]?.id);$('close-chapters').onclick=()=>chapterDialog.close();
$('chapter-picker').onchange=e=>{editingChapter=e.target.value;renderChapterForm();};$('chapter-new').onclick=()=>{editingChapter=null;renderChapterForm();$('chapter-title').focus();};
$('chapter-form').onsubmit=e=>{
  e.preventDefault();if(chapterQuest!==project)return chapterDialog.close();const title=$('chapter-title').value.trim();if(!title){$('chapter-error').textContent='Укажите название главы.';return;}
  let c=project.chapters?.find(c=>c.id===editingChapter);
  if(!c){if((project.chapters||[]).length>=500){$('chapter-error').textContent='Максимум 500 глав.';return;}c={id:'chapter'+crypto.randomUUID(),title,collapsed:false};project.chapters??=[];project.chapters.push(c);}else c.title=title;
  const chosen=new Set([...$('chapter-members').querySelectorAll('input:checked')].map(n=>n.value));for(const s of project.scenes){if(chosen.has(s.id))s.chapter=c.id;else if(s.chapter===c.id)delete s.chapter;}
  save();chapterDialog.close();renderGraph();renderChapterSelect();
};
$('chapter-delete').onclick=()=>{if(chapterQuest!==project)return chapterDialog.close();QuestChapters.remove(project,editingChapter);save();chapterDialog.close();renderGraph();renderChapterSelect();};
function toggleChapter(c){cancelConnection();c.collapsed=!c.collapsed;save();renderGraph();}
function renderChapterFrames(){
  document.querySelectorAll('#nodes .chapter-frame,#nodes .chapter-card').forEach(n=>n.remove());
  for(const c of project.chapters||[]){
    const box=QuestChapters.bounds(project,c,nodeHeight);if(!box)continue;
    const count=QuestChapters.members(project,c).length,frame=el('div',c.collapsed?'chapter-card':'chapter-frame');frame.dataset.chapterId=c.id;
    frame.style.left=(c.collapsed?box.x:Math.max(0,box.x-14))+'px';frame.style.top=(c.collapsed?box.y:Math.max(0,box.y-42))+'px';
    if(!c.collapsed){frame.style.width=(box.width+28)+'px';frame.style.height=(box.height+56)+'px';}
    const toggle=el('button','chapter-toggle',`${c.collapsed?'▸':'▾'} ${c.title} · ${count}`);toggle.setAttribute('aria-label',(c.collapsed?'Развернуть главу: ':'Свернуть главу: ')+c.title);toggle.setAttribute('aria-expanded',String(!c.collapsed));toggle.onclick=()=>toggleChapter(c);
    const edit=el('button','chapter-settings','⋯');edit.setAttribute('aria-label','Настроить главу: '+c.title);edit.onclick=()=>openChapters(c.id);frame.append(toggle,edit);
    if(c.collapsed)frame.append(el('p','hint','Сцены скрыты · связи сохранены'));$('nodes').prepend(frame);
  }
}
function renderChapterGroups(){
  const host=$('scene-list'),items=[...host.children];
  for(const c of project.chapters||[]){
    const group=el('section','sidebar-chapter'),toggle=el('button','sidebar-chapter-toggle',`${c.collapsed?'▸':'▾'} ${c.title} · ${QuestChapters.members(project,c).length}`);
    toggle.setAttribute('aria-label','Глава в списке: '+c.title);toggle.setAttribute('aria-expanded',String(!c.collapsed));toggle.onclick=()=>toggleChapter(c);group.append(toggle);
    for(const item of items){const s=project.scenes.find(s=>s.id===item.dataset.sceneId);if(s?.chapter===c.id){item.hidden=c.collapsed;group.append(item);}}host.append(group);
  }
  const loose=items.filter(item=>!project.scenes.find(s=>s.id===item.dataset.sceneId)?.chapter);
  if(project.chapters?.length&&loose.length){host.append(el('div','ungrouped-heading','Без главы'));loose.forEach(item=>host.append(item));}
  for(const n of document.querySelectorAll('#nodes [data-scene-id]')){const s=project.scenes.find(s=>s.id===n.dataset.sceneId);n.hidden=!!project.chapters?.find(c=>c.id===s?.chapter&&c.collapsed);}
  renderChapterFrames();if(typeof renderGraphSelection==='function')renderGraphSelection();
}
