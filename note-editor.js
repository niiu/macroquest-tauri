'use strict';
let noteEditor=null,noteDraft=null;
function ensureNoteEditor(){
  if(noteEditor)return;
  noteEditor=new toastui.Editor({el:$('note-editor-host'),height:'360px',theme:'dark',language:'ru-RU',initialEditType:'wysiwyg',previewStyle:'vertical',usageStatistics:false,autofocus:false,hooks:{addImageBlobHook:()=>false}});
}
function openNoteEditor(noteId){
  const note=project.scenes.find(s=>s.id===noteId&&QuestService.isNote(s));
  if(!note)return;
  if($('scene-dialog').open)$('scene-dialog').close();
  noteDraft=note;ensureNoteEditor();
  $('note-title').value=note.title||'';
  noteEditor.setMarkdown(note.markdown||'');
  $('note-target-label').textContent=note.target?(project.scenes.find(s=>s.id===note.target)?.title||note.target):'Не подключена к сцене';
  $('note-dialog').showModal();
  $('note-title').focus({preventScroll:true});
}
function closeNoteEditor(){$('note-dialog').close();noteDraft=null;}
function saveNoteEditor(){
  if(!noteDraft||!project.scenes.includes(noteDraft))return closeNoteEditor();
  noteDraft.title=$('note-title').value.trim()||'Заметка';
  noteDraft.markdown=noteEditor.getMarkdown();
  noteDraft.text=QuestService.preview(noteDraft).slice(0,500);
  save();closeNoteEditor();renderGraph();if(scene()&&!QuestService.isNote(scene()))renderSceneNotes();
}
$('note-save').onclick=saveNoteEditor;
$('note-cancel').onclick=$('close-note').onclick=closeNoteEditor;
$('note-dialog').addEventListener('cancel',e=>{e.preventDefault();closeNoteEditor();});
function renderSceneNotes(){
  const host=$('scene-notes');if(!host)return;
  const s=scene();host.replaceChildren();
  if(!s||QuestService.isNote(s)){host.hidden=true;return;}
  host.hidden=false;
  const notes=QuestService.notesFor(project,s.id);
  host.append(el('h3','','Заметки сцены'));
  if(!notes.length)host.append(el('p','hint','Нет подключённых заметок. Создайте заметку на графе и протяните выход к этой сцене.'));
  for(const note of notes){
    const row=el('div','scene-note-row');
    row.append(el('strong','',note.title||'Заметка'),el('p','hint',QuestService.preview(note)));
    const open=el('button','','Открыть');open.type='button';open.onclick=()=>openNoteEditor(note.id);
    row.append(open);host.append(row);
  }
  const add=el('button','quiet','+ Заметка к этой сцене');add.type='button';
  add.onclick=()=>{
    if(project.scenes.length>=500)return alert('Максимум 500 узлов в одном квесте.');
    const viewport=$('graph-viewport'),position=QuestGraphArea.position(QuestGraphArea.bounds(project,nodeHeight),(viewport.scrollLeft+80)/zoom,(viewport.scrollTop+viewport.clientHeight/2)/zoom-60);
    const note=QuestService.createNote({x:Math.max(20,(s.x||70)-260),y:s.y||position.y||75});
    note.target=s.id;project.scenes.push(note);QuestService.syncNoteChapters(project);save();renderGraph();openNoteEditor(note.id);
  };
  host.append(add);
}
