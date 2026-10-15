/* Portable atlas model and glossary renderer; also embedded in exported games. */
(function installAtlas(root){
  'use strict';
  const imageValid=s=>typeof s==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s);
  const empty=()=>({version:1,categories:[],articles:[]});
  function migrate(data){
    validate(data);const next=structuredClone(data);if(next.taxonomyVersion===1)return next;
    const ids=new Set([...next.categories,...next.articles].map(c=>c.id));
    const unique=base=>{let id=base;while(ids.has(id))id+='-1';ids.add(id);return id;};
    let world=next.categories.find(c=>c.title==='Мир'&&c.indexOnly&&!c.parent);
    if(!world){world={id:unique('world'),title:'Мир',parent:'',indexOnly:true};next.categories.unshift(world);}
    for(const c of next.categories)if(c.id!==world.id&&!c.parent)c.parent=world.id;
    for(const [kind,title] of [['lore','Лор'],['location','Локации'],['character','Персонажи'],['item','Предметы']]){
      let category=next.categories.find(c=>c.parent===world.id&&c.title===title&&!c.indexOnly);
      if(!category){category={id:unique('world-'+kind),title,parent:world.id,indexOnly:false};next.categories.push(category);}
      for(const a of next.articles)if(!a.category&&a.kind===kind)a.category=category.id;
    }
    next.worldId=world.id;next.taxonomyVersion=1;return validate(next);
  }
  function validate(data){
    if(!data||data.version!==1||!Array.isArray(data.categories)||!Array.isArray(data.articles)||data.categories.length>2000||data.articles.length>10000)throw Error('Неверный формат атласа.');
    const ids=new Set();
    for(const c of [...data.categories,...data.articles]){
      if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.title!=='string'||!c.title.trim()||c.title.length>100)throw Error('Некорректное название или идентификатор атласа.');ids.add(c.id);
    }
    const cats=new Map(data.categories.map(c=>[c.id,c]));
    if(data.taxonomyVersion!==undefined){
      const world=cats.get(data.worldId);
      if(data.taxonomyVersion!==1||!world||!world.indexOnly||world.parent||data.categories.some(c=>c.id!==world.id&&!c.parent))throw Error('Атлас должен иметь один индексный корень «Мир».');
    }
    for(const c of data.categories){
      if(c.indexOnly!==undefined&&typeof c.indexOnly!=='boolean')throw Error('Некорректный тип категории.');
      const seen=new Set([c.id]);let parent=c.parent;
      while(parent){if(!cats.has(parent)||seen.has(parent))throw Error('Категории образуют цикл или ссылаются на отсутствующего родителя.');seen.add(parent);parent=cats.get(parent).parent;}
    }
    for(const a of data.articles){
      if(data.taxonomyVersion===1&&!a.category)throw Error('Выберите обычную категорию для статьи.');
      if(a.category&&!cats.has(a.category))throw Error('Категория статьи не найдена.');
      if(cats.get(a.category)?.indexOnly)throw Error('Индексная категория содержит только подкатегории. Перенесите статьи в обычную категорию.');
      if(!['lore','character','location','item'].includes(a.kind)||typeof a.markdown!=='string'||a.markdown.length>1000000||typeof a.summary!=='string'||a.summary.length>2000||!Array.isArray(a.aliases)||a.aliases.length>30||a.aliases.some(s=>typeof s!=='string'||!s.trim()||s.length>100))throw Error('Некорректная статья.');
      if(!Array.isArray(a.images)||a.images.length>30||a.images.some(p=>!p||typeof p.id!=='string'||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!imageValid(p.image))||new Set(a.images.map(p=>p.id)).size!==a.images.length)throw Error('Некорректные изображения статьи.');
    }
    return data;
  }
  function categoryPath(data,id){const parts=[];let c=data.categories.find(c=>c.id===id);while(c){parts.unshift(c.title);c=data.categories.find(p=>p.id===c.parent);}return parts.join(' / ');}
  const newId=()=>(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():'id'+Math.random().toString(36).slice(2)+Date.now().toString(36);
  const kindTitles={character:'Персонажи',location:'Локации',item:'Предметы',lore:'Лор'};
  // Keep export format stable for round-trip with workspace Markdown buttons.
  function articleMarkdown(a){
    const images=(a.images||[]).map(p=>'!['+String(p.name||'').replace(/[\[\]]/g,'')+']('+p.image+')').join('\n\n');
    return '# '+a.title+'\n\n> '+String(a.summary||'').replace(/\n/g,'\n> ')+'\n\n'+(a.markdown||'')+(images?'\n\n'+images:'');
  }
  function toMarkdown(data){
    validate(data);
    return data.articles.map(a=>'<!-- Категория: '+categoryPath(data,a.category).replace(/--/g,'—')+' -->\n\n'+articleMarkdown(a)).join('\n\n---\n\n');
  }
  function kindFromPath(parts){
    for(let i=parts.length-1;i>=0;i--){
      const title=parts[i];
      for(const [kind,label] of Object.entries(kindTitles))if(title===label)return kind;
    }
    return 'lore';
  }
  function ensureCategoryPath(data,parts){
    if(!parts.length)throw Error('Укажите путь категории в комментарии <!-- Категория: … -->.');
    const world=data.categories.find(c=>c.id===data.worldId);
    let parent=world.id,start=0;
    if(parts[0]===world.title)start=1;
    if(start>=parts.length)throw Error('Индексная категория содержит только подкатегории. Перенесите статьи в обычную категорию.');
    for(let i=start;i<parts.length;i++){
      const title=parts[i].trim();
      if(!title||title.length>100)throw Error('Некорректное название категории в Markdown.');
      let child=data.categories.find(c=>(c.parent||'')===parent&&c.title===title);
      if(!child){child={id:newId(),title,parent,indexOnly:false};data.categories.push(child);}
      parent=child.id;
    }
    if(data.categories.find(c=>c.id===parent)?.indexOnly)throw Error('Индексная категория содержит только подкатегории. Перенесите статьи в обычную категорию.');
    return parent;
  }
  function parseArticleBlock(block){
    const text=block.trim();if(!text)return null;
    const cat=text.match(/<!--\s*Категория:\s*([\s\S]*?)\s*-->/);
    const path=cat?cat[1].replace(/\u2014/g,'--').split('/').map(s=>s.trim()).filter(Boolean):['Мир','Лор'];
    let rest=text.replace(/<!--\s*Категория:[\s\S]*?-->\s*/,'').trim();
    const titleMatch=rest.match(/^#\s+(.+?)(?:\r?\n|$)/);if(!titleMatch)throw Error('В статье Markdown нужен заголовок # Название.');
    const title=titleMatch[1].trim();if(!title||title.length>100)throw Error('Некорректное название статьи в Markdown.');
    rest=rest.slice(titleMatch[0].length).replace(/^(?:\r?\n)+/,'');
    const summaryLines=[];
    while(true){
      const line=rest.match(/^[ \t]*>[ \t]?(.*?)(?:\r?\n|$)/);if(!line)break;
      summaryLines.push(line[1]);rest=rest.slice(line[0].length);
    }
    const summary=summaryLines.join('\n');if(summary.length>2000)throw Error('Краткое описание в Markdown слишком длинное.');
    rest=rest.replace(/^(?:\r?\n)+/,'');
    const images=[];const imageRe=/!\[([^\]]*)\]\((data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})\)/g;
    let match;while((match=imageRe.exec(rest))){const name=(match[1]||'image').trim().slice(0,100)||'image';images.push({id:newId(),name,image:match[2]});if(images.length>30)throw Error('Не более 30 изображений на статью.');}
    const markdown=rest.replace(/\n?!\[[^\]]*\]\(data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}\)/g,'').trim();
    if(markdown.length>1000000)throw Error('Текст статьи в Markdown слишком длинный.');
    return {title,summary,markdown,images,path,kind:kindFromPath(path)};
  }
  function fromMarkdown(text){
    if(typeof text!=='string'||!text.trim())throw Error('Пустой Markdown атласа.');
    const data=migrate(empty());
    const blocks=text.split(/\r?\n[ \t]*---[ \t]*\r?\n/);
    for(const block of blocks){
      const parsed=parseArticleBlock(block);if(!parsed)continue;
      const category=ensureCategoryPath(data,parsed.path);
      data.articles.push({id:newId(),title:parsed.title,kind:parsed.kind,category,summary:parsed.summary,aliases:[],markdown:parsed.markdown,images:parsed.images});
      if(data.articles.length>10000)throw Error('Неверный формат атласа.');
    }
    if(!data.articles.length)throw Error('В Markdown нет статей с заголовком # Название.');
    return validate(data);
  }
  function entries(quest){return quest.atlasEntries||[];}
  function segments(text,articles){
    const names=new Map();
    for(const a of articles)for(const name of [a.title,...(a.aliases||[])])if(name.trim()&&!names.has(name.toLocaleLowerCase()))names.set(name.toLocaleLowerCase(),a);
    if(!names.size)return [{text}];
    const escaped=[...names.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const re=new RegExp('(?<![\\p{L}\\p{N}_])('+escaped.join('|')+')(?![\\p{L}\\p{N}_])','giu');
    const result=[];let index=0;
    for(const match of text.matchAll(re)){if(match.index>index)result.push({text:text.slice(index,match.index)});result.push({text:match[0],article:names.get(match[0].toLocaleLowerCase())});index=match.index+match[0].length;}
    if(index<text.length)result.push({text:text.slice(index)});return result;
  }
  function renderText(host,text,quest){
    host.textContent=text;
    if(!quest.atlasLinks||!entries(quest).length)return;
    host.replaceChildren();
    for(const part of segments(text,entries(quest))){
      if(!part.article){host.append(document.createTextNode(part.text));continue;}
      const b=document.createElement('button');b.className='atlas-link';b.type='button';b.textContent=part.text;b.title=part.article.summary;
      b.onclick=()=>{
        const dialog=document.createElement('dialog');dialog.className='atlas-description';const title=document.createElement('h2'),body=document.createElement('p'),close=document.createElement('button');
        title.textContent=part.article.title;body.textContent=part.article.summary||'Краткое описание пока не добавлено.';close.textContent='Закрыть';close.onclick=()=>dialog.close();dialog.append(title,body,close);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
      };host.append(b);
    }
  }
  function attach(quest,article){
    quest.atlasEntries??=[];const copy=structuredClone(article),i=quest.atlasEntries.findIndex(a=>a.id===article.id);
    // Only short descriptions are shipped to players. World articles may contain spoilers.
    delete copy.images;delete copy.markdown;delete copy.category;
    if(i<0)quest.atlasEntries.push(copy);else quest.atlasEntries[i]=copy;
  }
  function importCharacter(quest,article){
    if(article.kind!=='character'||!article.images.length)throw Error('Добавьте хотя бы один спрайт персонажа в атласе.');
    const characters=quest.characters||[],existing=characters.find(c=>c.atlasId===article.id);
    if(!existing&&characters.length>=200)throw Error('Максимум 200 персонажей в квесте.');
    let id='c'+article.id;while(!existing&&characters.some(c=>c.id===id))id+='-copy';
    const c=existing?structuredClone(existing):{id,atlasId:article.id,image:article.images[0].image,atlasImageId:article.images[0].id,images:[]};
    c.images??=[];
    // Upgrade old copies by matching actual pixels, not the position in the atlas array.
    if(!c.atlasImageId)c.atlasImageId=article.images.find(p=>p.image===c.image)?.id;
    for(const p of c.images)if(!p.atlasImageId)p.atlasImageId=article.images.find(a=>a.image===p.image&&a.id!==c.atlasImageId)?.id;
    c.name=article.title;c.description=article.summary;
    for(const p of article.images){
      if(p.id===c.atlasImageId){c.image=p.image;c.imageName=p.name;continue;}
      let target=c.images.find(i=>i.atlasImageId===p.id);
      if(!target){let imageId='atlas:'+p.id;while(c.images.some(i=>i.id===imageId))imageId+='-copy';target={id:imageId,atlasImageId:p.id};c.images.push(target);}
      target.name=p.name;target.image=p.image;
    }
    const used=new Set((quest.scenes||[]).flatMap(s=>(s.actors||[]).filter(p=>p.character===c.id).map(p=>p.imageId||'default')));
    c.images=c.images.filter(p=>!p.atlasImageId||article.images.some(a=>a.id===p.atlasImageId)||used.has(p.id));
    if(c.images.length>29)throw Error('Обновление превысит 30 спрайтов. Уберите со сцен старые варианты перед обновлением.');
    if(existing)Object.assign(existing,c);else{quest.characters??=[];quest.characters.push(c);}
    attach(quest,article);return existing||c;
  }
  const css='.atlas-link{display:inline;padding:0;border:0;border-bottom:1px dotted currentColor;border-radius:0;background:none;color:#c5da98;font:inherit;cursor:pointer}.atlas-description{max-width:560px;width:85vw;background:#1d251b;color:#e5e8dc;border:1px solid #718653;border-radius:12px;padding:24px}.atlas-description p{white-space:pre-wrap}.atlas-description::backdrop{background:#0009}';
  const api={empty,migrate,validate,categoryPath,articleMarkdown,toMarkdown,fromMarkdown,segments,renderText,attach,importCharacter,css};api.standaloneSource=()=>`(${installAtlas.toString()})(globalThis);`;
  if(typeof module!=='undefined')module.exports=api;else root.QuestAtlas=api;
})(globalThis);
