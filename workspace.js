'use strict';
// One metadata catalog, separate quest records and one shared atlas loaded into memory.
let questCatalog={version:2,active:'',quests:[]},atlasData=QuestAtlas.empty(),libraryReady=false;
let atlasEditor,atlasSelected=null,atlasDirty=false,atlasQueue=Promise.resolve();
let libraryBusy=false;
function lockLibrary(value){libraryBusy=value;document.querySelector('.workspace').inert=value;tabs.inert=value;$('play').disabled=value;}
const safeFilename=s=>(s.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').trim()||'macroquest');
function closeSceneEditor(){if($('scene-dialog').open)$('scene-dialog').close();}
function button(text,action){const b=el('button','',text);b.type='button';b.onclick=action;return b;}
function report(error){alert(error.message||String(error));}
async function persistQuest(snapshot){
  if(!libraryReady)throw Error('Библиотека ещё не загружена.');
  const catalog=structuredClone(questCatalog),entry=catalog.quests.find(q=>q.id===snapshot.workspaceId);
  if(!entry)throw Error('Квест отсутствует в библиотеке.');entry.title=snapshot.title;
  await QuestStorage.writeMany([['quest:'+snapshot.workspaceId,snapshot],['catalog-v2',catalog]]);
  questCatalog.quests.find(q=>q.id===snapshot.workspaceId).title=snapshot.title;renderQuestPicker();
}
async function initializeLibrary(legacy){
  const stored=await QuestStorage.read('catalog-v2');
  if(stored){
    if(stored.version!==2||!Array.isArray(stored.quests)||!stored.quests.length||!stored.quests.some(q=>q.id===stored.active))throw Error('Каталог квестов повреждён.');
    const current=await QuestStorage.read('quest:'+stored.active);project=validate(current);questCatalog=stored;
  }else{
    const saved=await QuestStorage.read();const raw=saved?null:localStorage.getItem(STORAGE_KEY);
    legacy=saved?validate(saved):raw?validate(JSON.parse(raw)):legacy;
    project=legacy;project.workspaceId=crypto.randomUUID();questCatalog.active=project.workspaceId;questCatalog.quests=[{id:project.workspaceId,title:project.title}];
    await QuestStorage.writeMany([['quest:'+project.workspaceId,project],['catalog-v2',questCatalog]]);
  }
  const previousAtlas=QuestAtlas.validate(await QuestStorage.read('atlas-v1')||QuestAtlas.empty());
  atlasData=QuestAtlas.migrate(previousAtlas);
  if(previousAtlas.taxonomyVersion!==1)await QuestStorage.writeMany([['atlas-before-taxonomy-v1',previousAtlas],['atlas-v1',atlasData]]);
  selected=project.start;libraryReady=true;renderQuestPicker();renderAtlasTree();renderAtlasOptions();
}
function renderQuestPicker(){
  const host=$('quest-picker');host.replaceChildren();
  for(const q of questCatalog.quests){const o=el('option','',q.title||'Без названия');o.value=q.id;host.append(o);}host.value=project.workspaceId;
  $('atlas-links').checked=!!project.atlasLinks;
}
async function switchQuest(id){
  if(id===project.workspaceId||libraryBusy)return;
  lockLibrary(true);
  try{
    await flushProject();if(saveFailed)throw Error('Текущий квест не сохранён. Повторите сохранение или экспортируйте JSON.');
    const next=validate(await QuestStorage.read('quest:'+id));const catalog={...questCatalog,active:id};
    await QuestStorage.write(catalog,'catalog-v2');questCatalog=catalog;activateQuest(next);
  }catch(e){renderQuestPicker();report(e);}finally{lockLibrary(false);}
}
function activateQuest(next){
  closeSceneEditor();project=next;selected=project.start;activeChoice=0;lastDeletedScene=lastDisconnected=null;characterPictures.clear();
  render();renderQuestPicker();renderAtlasOptions();
}
async function addQuest(next){
  if(libraryBusy)return;lockLibrary(true);
  try{
  await flushProject();if(saveFailed)throw Error('Сначала сохраните или экспортируйте текущий квест.');
  validate(next);next.workspaceId=crypto.randomUUID();
  const catalog=structuredClone(questCatalog);catalog.active=next.workspaceId;catalog.quests.push({id:next.workspaceId,title:next.title});
  await QuestStorage.writeMany([['quest:'+next.workspaceId,next],['catalog-v2',catalog]]);questCatalog=catalog;activateQuest(next);
  }finally{lockLibrary(false);}
}

const tabs=el('nav','workspace-tabs');tabs.setAttribute('aria-label','Разделы мастерской');
const editorTab=button('Редактор квестов',()=>showWorkspace('editor')),atlasTab=button('Атлас мира',()=>showWorkspace('atlas'));tabs.append(editorTab,atlasTab);document.querySelector('.topbar').after(tabs);
const pickerLabel=el('label','field','Квесты мастерской'),picker=el('select');picker.id='quest-picker';picker.onchange=()=>switchQuest(picker.value);pickerLabel.append(picker);document.querySelector('.sidebar').prepend(pickerLabel);
const atlasPanel=el('section','atlas-workspace');atlasPanel.id='atlas-workspace';atlasPanel.hidden=true;
atlasPanel.innerHTML=`<aside class="atlas-sidebar"><div class="eyebrow">БИБЛИОТЕКА МИРА</div><h1>Атлас</h1><input id="atlas-search" aria-label="Поиск по атласу" placeholder="Найти статью…"><div class="atlas-actions"><button id="atlas-category-new">+ Категория</button></div><div id="atlas-tree"></div><hr><button id="atlas-export">↓ Атлас JSON</button><button id="atlas-import">↑ Подключить атлас JSON</button><input id="atlas-import-file" type="file" accept=".json" hidden><button id="atlas-markdown">↓ Все статьи Markdown</button><p class="hint">Один общий атлас для всех квестов. Подключение заменяет библиотеку; копии внутри квестов сохраняются.</p></aside>
<section class="atlas-content"><div class="section-title"><h2 id="atlas-heading">Создайте первую статью</h2><button id="atlas-save" class="primary">Сохранить статью</button></div><p id="atlas-status" role="status"></p><div id="atlas-fields" hidden><div class="atlas-metadata"><label class="field">Название<input id="atlas-title" maxlength="100"></label><label class="field">Тип<select id="atlas-kind"><option value="lore">Лор</option><option value="character">Персонаж</option><option value="location">Локация</option><option value="item">Предмет</option></select></label><label class="field">Категория<select id="atlas-category"></select></label><label class="field">Другие имена (через запятую)<input id="atlas-aliases" maxlength="3000"></label></div><label class="field">Краткое описание для игроков<textarea id="atlas-summary" maxlength="2000" rows="3"></textarea></label><p class="hint">Полная статья остаётся в атласе. В квест попадают имя, иллюстрации и это краткое описание.</p><div id="atlas-editor"></div><div class="section-title"><h3>Спрайты / изображения</h3><button id="atlas-image-add">+ Изображения</button><input id="atlas-image-file" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></div><div id="atlas-images"></div><div class="atlas-actions"><button id="atlas-use">Добавить в текущий квест</button><button id="atlas-article-md">↓ Статья Markdown</button><button id="atlas-delete" class="danger">Удалить статью</button></div></div></section>`;
document.querySelector('.workspace').after(atlasPanel);
const integration=el('section','atlas-integration');integration.innerHTML=`<h3>Из атласа мира</h3><label class="field">Статья<select id="atlas-entity"></select></label><button id="atlas-insert">Добавить в квест / применить к сцене</button><label class="toggle"><input id="atlas-links" type="checkbox"> Кликабельные описания в тексте</label><p class="hint">Персонаж добавляется в библиотеку NPC; локация — в выбранную сцену. Описания доступны в просмотре и HTML.</p><div id="atlas-text-preview" class="atlas-text-preview"></div>`;
$('editor-body').prepend(integration);
function showWorkspace(tab){
  if(!libraryReady)return;
  if(tab!=='editor')closeSceneEditor();
  document.querySelector('.workspace').hidden=tab!=='editor';atlasPanel.hidden=tab!=='atlas';editorTab.setAttribute('aria-pressed',String(tab==='editor'));atlasTab.setAttribute('aria-pressed',String(tab==='atlas'));
  if(typeof settingsPanel!=='undefined'){settingsPanel.hidden=tab!=='settings';settingsTab.setAttribute('aria-pressed',String(tab==='settings'));}
  if(tab==='editor'){render();renderAtlasOptions();}else if(tab==='atlas')renderAtlasTree();
}
function ensureAtlasEditor(){
  if(atlasEditor)return;
  atlasEditor=new toastui.Editor({el:$('atlas-editor'),height:'440px',theme:'dark',language:'ru-RU',initialEditType:'wysiwyg',previewStyle:'vertical',usageStatistics:false,autofocus:false,events:{change:()=>{atlasDirty=true;$('atlas-status').textContent='Есть несохранённые изменения';}},hooks:{addImageBlobHook:()=>false}});
}
function categoryOptions(host,value,exclude){
  host.replaceChildren();const root=el('option','',host.id==='atlas-category'?'Выберите категорию':'Корень атласа');root.value='';root.disabled=exclude!==atlasData.worldId;host.append(root);
  for(const c of atlasData.categories){if(c.id===exclude)continue;const o=el('option','',QuestAtlas.categoryPath(atlasData,c.id)+(c.indexOnly?' · индекс':''));o.value=c.id;o.disabled=host.id==='atlas-category'&&!!c.indexOnly;host.append(o);}host.value=value||'';
}
function renderAtlasTree(){
  const host=$('atlas-tree'),query=$('atlas-search').value.trim().toLocaleLowerCase();host.replaceChildren();
  function branch(parent,container){
    for(const c of atlasData.categories.filter(c=>(c.parent||'')===parent)){
      const details=el('details','atlas-category');details.open=true;
      const summary=el('summary');summary.append(el('span','',c.title));if(c.indexOnly)summary.append(el('small','category-index','индекс'));
      const add=button('+',e=>{e.preventDefault();e.stopPropagation();editCategory(null,c.id);});add.setAttribute('aria-label','Добавить подкатегорию: '+c.title);summary.append(add);details.append(summary);
      if(!c.indexOnly){const create=button('Создать статью',()=>openArticle(undefined,c.id));create.className='category-create';create.setAttribute('aria-label','Создать статью: '+c.title);details.append(create);}
      details.append(button('Настроить категорию',()=>editCategory(c)));branch(c.id,details);container.append(details);
    }
    for(const a of atlasData.articles.filter(a=>(a.category||'')===parent&&(!query||(a.title+' '+a.summary+' '+a.markdown).toLocaleLowerCase().includes(query)))){
      const b=button(a.title,()=>openArticle(a.id));b.className='atlas-article'+(a.id===atlasSelected?.id?' selected':'');container.append(b);
    }
  }branch('',host);
}
function editCategory(category,parentId=atlasData.worldId){
  const indexLabel=el('label','toggle','Только подкатегории (индекс)'),index=el('input');index.type='checkbox';index.checked=!!category?.indexOnly;indexLabel.prepend(index);
  const dialog=el('dialog','atlas-description'),title=el('input'),parent=el('select');title.value=category?.title||'';title.maxLength=100;title.setAttribute('aria-label','Название категории');parent.setAttribute('aria-label','Родительская категория');categoryOptions(parent,category?category.parent:parentId,category?.id);
  if(category?.id===atlasData.worldId){parent.disabled=true;index.disabled=true;}
  dialog.append(el('h2','','Категория'),title,parent,indexLabel,button('Сохранить',async()=>{try{
    if(!title.value.trim())throw Error('Укажите название.');const next=structuredClone(atlasData),c=next.categories.find(c=>c.id===category?.id);
    if(c)Object.assign(c,{title:title.value.trim(),parent:parent.value,indexOnly:index.checked});else next.categories.push({id:crypto.randomUUID(),title:title.value.trim(),parent:parent.value,indexOnly:index.checked});
    QuestAtlas.validate(next);await storeAtlas(next);dialog.close();
  }catch(e){report(e);}}),button('Отмена',()=>dialog.close()));
  if(category)dialog.append(button('Удалить пустую категорию',async()=>{try{if(atlasData.categories.some(c=>c.parent===category.id)||atlasData.articles.some(a=>a.category===category.id))throw Error('Сначала перенесите вложенные категории и статьи.');const next=structuredClone(atlasData);next.categories=next.categories.filter(c=>c.id!==category.id);await storeAtlas(next);dialog.close();}catch(e){report(e);}}));
  dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
}
async function storeAtlas(next){
  const snapshot=structuredClone(QuestAtlas.validate(next));
  const operation=atlasQueue.then(()=>QuestStorage.write(snapshot,'atlas-v1'));atlasQueue=operation.catch(()=>{});await operation;
  atlasData=snapshot;renderAtlasTree();renderAtlasOptions();if(atlasSelected)categoryOptions($('atlas-category'),$('atlas-category').value);
}
function openArticle(id,category=''){
  if(!id&&(!category||atlasData.categories.find(c=>c.id===category)?.indexOnly))return report(Error('Создайте статью из обычной категории.'));
  if(atlasDirty&&!confirm('Отбросить несохранённые изменения статьи?'))return;
  $('atlas-fields').hidden=false;ensureAtlasEditor();atlasSelected=structuredClone(atlasData.articles.find(a=>a.id===id)||{id:crypto.randomUUID(),title:'Новая статья',kind:'lore',category,summary:'',aliases:[],markdown:'',images:[]});
  $('atlas-heading').textContent=atlasSelected.title;
  for(const key of ['title','kind','summary'])$('atlas-'+key).value=atlasSelected[key];$('atlas-aliases').value=atlasSelected.aliases.join(', ');categoryOptions($('atlas-category'),atlasSelected.category);
  atlasEditor.setMarkdown(atlasSelected.markdown);atlasDirty=false;$('atlas-status').textContent='';renderAtlasImages();renderAtlasTree();
}
async function saveArticle(){
  if(!atlasSelected)throw Error('Сначала создайте статью.');
  const a={...atlasSelected,title:$('atlas-title').value.trim(),kind:$('atlas-kind').value,summary:$('atlas-summary').value,category:$('atlas-category').value,aliases:$('atlas-aliases').value.split(',').map(s=>s.trim()).filter(Boolean),markdown:atlasEditor.getMarkdown()};
  const next=structuredClone(atlasData),i=next.articles.findIndex(p=>p.id===a.id);if(i<0)next.articles.push(a);else next.articles[i]=a;
  await storeAtlas(next);atlasSelected=a;atlasDirty=false;$('atlas-heading').textContent=a.title;$('atlas-status').textContent='Статья сохранена';return a;
}
function renderAtlasImages(){
  $('atlas-images').replaceChildren();
  atlasSelected.images.forEach((p,i)=>{const card=el('div','atlas-image'),img=el('img');img.src=p.image;img.alt=p.name;const name=el('input');name.value=p.name;name.maxLength=100;name.setAttribute('aria-label','Название изображения');name.oninput=()=>{p.name=name.value;atlasDirty=true;};card.append(img,name,button('Удалить',()=>{atlasSelected.images.splice(i,1);atlasDirty=true;renderAtlasImages();}));$('atlas-images').append(card);});
}
function renderAtlasOptions(){
  const host=$('atlas-entity'),value=host.value;host.replaceChildren();
  for(const a of atlasData.articles){const o=el('option','',a.title+' · '+({character:'персонаж',location:'локация',lore:'лор',item:'предмет'}[a.kind]));o.value=a.id;host.append(o);}if(atlasData.articles.some(a=>a.id===value))host.value=value;
  $('atlas-insert').disabled=!atlasData.articles.length;renderAtlasTextPreview();
}
function renderAtlasTextPreview(){if(libraryReady)QuestAtlas.renderText($('atlas-text-preview'),scene().text,project);}
function useArticle(a){
  if(!a)return;
  if(a.kind==='character')QuestAtlas.importCharacter(project,a);
  else if(a.kind==='location'){
    const s=scene();if(s.image&&!confirm('Заменить локацию выбранной сцены? Нарисованные зоны будут очищены.'))return;
    s.title=a.title;s.description=a.summary;s.atlasId=a.id;if(!s.text)s.text=a.summary;
    if(a.images.length)s.image=a.images[0].image;else delete s.image;
    for(const c of s.choices)delete c.zone;
    QuestAtlas.attach(project,a);
  }else QuestAtlas.attach(project,a);
  save();render();renderAtlasTextPreview();$('atlas-status').textContent='Добавлено в квест «'+project.title+'»';
}
$('atlas-insert').onclick=()=>{try{useArticle(atlasData.articles.find(a=>a.id===$('atlas-entity').value));}catch(e){report(e);}};
$('atlas-use').onclick=async()=>{try{useArticle(await saveArticle());}catch(e){report(e);}};
$('atlas-links').onchange=()=>{project.atlasLinks=$('atlas-links').checked;save();renderAtlasTextPreview();};
$('atlas-save').onclick=()=>saveArticle().catch(report);$('atlas-search').oninput=renderAtlasTree;$('atlas-category-new').onclick=()=>editCategory();
for(const key of ['title','kind','summary','aliases','category'])$('atlas-'+key).addEventListener('input',()=>{atlasDirty=true;});
$('atlas-image-add').onclick=()=>$('atlas-image-file').click();
$('atlas-image-file').onchange=async e=>{
  const owner=atlasSelected,files=[...e.target.files],images=[];
  try{
    if(!owner||owner.images.length+files.length>30)throw Error('Не более 30 изображений.');
    for(const file of files){
      if(file.size>15*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Нужен PNG, JPEG или WebP до 15 МБ.');
      const url=URL.createObjectURL(file);let decoded;try{decoded=await decodeImage(url);}finally{URL.revokeObjectURL(url);}
      const scale=Math.min(1,1600/Math.max(decoded.naturalWidth,decoded.naturalHeight)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(decoded.naturalWidth*scale));canvas.height=Math.max(1,Math.round(decoded.naturalHeight*scale));canvas.getContext('2d').drawImage(decoded,0,0,canvas.width,canvas.height);
      images.push({id:crypto.randomUUID(),name:file.name.slice(0,100),image:canvas.toDataURL('image/png')});
    }
    if(owner!==atlasSelected)return;owner.images.push(...images);atlasDirty=true;renderAtlasImages();
  }catch(error){report(error);}finally{e.target.value='';}
};
$('atlas-delete').onclick=async()=>{if(!atlasSelected||!confirm('Удалить статью из атласа? Копии в квестах сохранятся.'))return;try{const next=structuredClone(atlasData);next.articles=next.articles.filter(a=>a.id!==atlasSelected.id);await storeAtlas(next);atlasSelected=null;atlasDirty=false;$('atlas-fields').hidden=true;$('atlas-heading').textContent='Выберите статью';}catch(e){report(e);}};
$('atlas-export').onclick=async()=>{try{if(atlasDirty)await saveArticle();await QuestStorage.download('atlas.json',JSON.stringify(atlasData,null,2));}catch(e){report(e);}};
function markdownArticle(a){return '# '+a.title+'\n\n> '+a.summary.replace(/\n/g,'\n> ')+'\n\n'+a.markdown+'\n\n'+a.images.map(p=>'!['+p.name.replace(/[\[\]]/g,'')+']('+p.image+')').join('\n\n');}
$('atlas-article-md').onclick=async()=>{try{const a=await saveArticle();await QuestStorage.download(safeFilename(a.title)+'.md',markdownArticle(a),'text/markdown');}catch(e){report(e);}};
$('atlas-markdown').onclick=async()=>{try{if(atlasDirty)await saveArticle();const md=atlasData.articles.map(a=>'<!-- Категория: '+QuestAtlas.categoryPath(atlasData,a.category).replace(/--/g,'—')+' -->\n\n'+markdownArticle(a)).join('\n\n---\n\n');await QuestStorage.download('atlas.md',md,'text/markdown');}catch(e){report(e);}};
$('atlas-import').onclick=()=>$('atlas-import-file').click();
$('atlas-import-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100*1024*1024)throw Error('Атлас больше 100 МБ.');const next=QuestAtlas.migrate(JSON.parse(await file.text()));if(!confirm('Заменить общий атлас? Сначала экспортируйте его, если нужна копия.'))return;await storeAtlas(next);atlasSelected=null;atlasDirty=false;$('atlas-fields').hidden=true;$('atlas-heading').textContent='Выберите статью';}catch(e){report(e);}finally{e.target.value='';}};
window.addEventListener('beforeunload',e=>{if(atlasDirty){e.preventDefault();e.returnValue='';}});
if(globalThis.__TAURI__)__TAURI__.window.getCurrentWindow().onCloseRequested(async event=>{
  event.preventDefault();
  try{if(atlasDirty&&!confirm('Закрыть без сохранения изменений статьи?'))return;await flushProject();await atlasQueue;if(saveFailed)throw Error('Не удалось сохранить квест. Экспортируйте JSON перед закрытием.');await __TAURI__.window.getCurrentWindow().destroy();}catch(e){report(e);}
}).catch(report);

// Opening and demo import create separate quests instead of replacing existing work.
$('new-quest').onclick=()=>addQuest({version:1,title:'Новый квест',start:'s1',scenes:[{id:'s1',title:'Начало истории',text:'',x:70,y:75,choices:[]}]}).catch(report);
$('import-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100*1024*1024)throw Error('Максимум 100 МБ.');await addQuest(validate(JSON.parse(await file.text())));}catch(e){report(e);}finally{e.target.value='';}};
$('load-demo').onclick=async()=>{try{const r=await fetch('demo-quest.json');if(!r.ok)throw Error('Не удалось загрузить пример');await addQuest(await r.json());}catch(e){report(e);}};
$('restore-demo-backup').onclick=async()=>{try{const p=await QuestStorage.read('before-demo');if(!p)throw Error('Резервной копии нет. Теперь демо открывается отдельным квестом.');await addQuest(p);}catch(e){report(e);}};
$('export').onclick=()=>QuestStorage.download(safeFilename(project.title)+'.json',JSON.stringify(project,null,2)).catch(report);
$('export-html').onclick=async()=>{try{validate(project);const saved=await QuestStorage.download(safeFilename(project.title)+'.html',QuestHTML.build(project),'text/html');$('export-status').textContent=saved?'HTML сохранён. Квест работает без интернета.':'Сохранение отменено.';}catch(e){report(e);}};



