/* Service graph nodes (notes first). Shared validation helpers for editor and tests. */
(function installServiceNodes(root){
  'use strict';
  const SERVICES={note:'note'};
  function isNote(s){return !!s&&s.service===SERVICES.note;}
  function isService(s){return !!s&&typeof s.service==='string'&&!!s.service;}
  function playable(project){return (project.scenes||[]).filter(s=>!isService(s));}
  function notesFor(project,sceneId){return (project.scenes||[]).filter(s=>isNote(s)&&s.target===sceneId);}
  function preview(s){
    const raw=String(s.markdown||s.text||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/[#>*_`~\-\[\]()]/g,' ').replace(/\s+/g,' ').trim();
    return raw||'Пустая заметка';
  }
  function createNote(position={}){
    return {id:'n'+((typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():Date.now().toString(36)),service:SERVICES.note,title:'Заметка',text:'',markdown:'',target:'',choices:[],x:position.x||70,y:position.y||75};
  }
  function validate(project){
    const scenes=project.scenes||[],ids=new Set(scenes.map(s=>s.id));
    const playableScenes=playable(project);
    if(!playableScenes.length)throw Error('В квесте нужна хотя бы одна обычная сцена.');
    if(isService(scenes.find(s=>s.id===project.start)))throw Error('Начальной сценой не может быть служебная нода.');
    for(const s of scenes){
      if(!isService(s)){
        if(s.choices.some(c=>isService(scenes.find(n=>n.id===c.target))))throw Error('Переход не может вести на служебную ноду.');
        if(s.choices.some(c=>c.check&&[...c.check.targets,c.check.failureTarget].some(t=>t&&isService(scenes.find(n=>n.id===t)))))throw Error('Выход D20 не может вести на служебную ноду.');
        continue;
      }
      if(!isNote(s))throw Error('Неизвестный тип служебной ноды.');
      if(typeof s.markdown!=='string'||s.markdown.length>1000000)throw Error('Некорректный текст заметки.');
      if(s.target!==''&&s.target!==undefined&&(typeof s.target!=='string'||!ids.has(s.target)||isService(scenes.find(n=>n.id===s.target))))throw Error('Заметка должна ссылаться на обычную сцену.');
      if(!Array.isArray(s.choices)||s.choices.length)throw Error('У заметки не бывает игровых переходов.');
      if(s.dialogue||s.image||(s.actors&&s.actors.length)||s.chapter)throw Error('Заметка не может быть диалогом, картинкой или частью главы.');
    }
  }
  function forExport(project){
    const copy=structuredClone(project);
    copy.scenes=copy.scenes.filter(s=>!isService(s));
    return copy;
  }
  const api={SERVICES,isNote,isService,playable,notesFor,preview,createNote,validate,forExport};
  if(typeof module!=='undefined')module.exports=api;else root.QuestService=api;
})(globalThis);
