const {test}=require('node:test');
const assert=require('node:assert/strict');
const Atlas=require('./atlas.js');
const HTML=require('./html-export.js');
const Layers=require('./scene-layers.js');
const img='data:image/png;base64,aGVsbG8=';
const article=()=>({id:'a1',title:'Страж',kind:'character',category:'location',summary:'Хранитель ворот',markdown:'Секреты мира',aliases:['Смотритель'],images:[{id:'p1',name:'Обычный',image:img},{id:'p2',name:'Гнев',image:img}]});
const data=()=>({version:1,categories:[{id:'world',title:'Мир',parent:''},{id:'location',title:'Башня',parent:'world'}],articles:[article()]});
test('atlas hierarchy, round trip and cycle/dangling validation',()=>{
  assert.deepEqual(Atlas.validate(JSON.parse(JSON.stringify(data()))),data());assert.equal(Atlas.categoryPath(data(),'location'),'Мир / Башня');
  const cycle=data();cycle.categories[0].parent='location';assert.throws(()=>Atlas.validate(cycle));
  const dangling=data();dangling.articles[0].category='missing';assert.throws(()=>Atlas.validate(dangling));
  const bad=data();bad.articles[0].images[0].image='javascript:alert(1)';assert.throws(()=>Atlas.validate(bad));
});
test('index categories reject articles and malformed index flags but allow child categories',()=>{
  const a=data();a.categories[0].indexOnly=true;Atlas.validate(a);
  a.articles[0].category='world';assert.throws(()=>Atlas.validate(a),/Индексная/);
  a.articles[0].category='location';a.categories[1].indexOnly='yes';assert.throws(()=>Atlas.validate(a),/тип категории/);
});
test('world migration preserves IDs, nested categories and articles; is idempotent',()=>{
  const old=data();old.articles.push({...article(),id:'orphan',category:''});const snapshot=structuredClone(old),next=Atlas.migrate(old);
  assert.deepEqual(old,snapshot);assert.equal(next.categories.find(c=>c.id===next.worldId).indexOnly,true);
  assert.equal(next.categories.find(c=>c.id==='location').parent,'world');assert.equal(next.articles[0].category,'location');
  assert.equal(next.categories.find(c=>c.id===next.articles[1].category).title,'Персонажи');assert.deepEqual(Atlas.migrate(next),next);
  next.categories.find(c=>c.id===next.worldId).indexOnly=false;assert.throws(()=>Atlas.validate(next));
});
test('Cyrillic aliases, case, word boundaries, longest match, regex escaping',()=>{
  const articles=[article(),{...article(),id:'a2',title:'Страж башни',aliases:[]},{...article(),id:'a3',title:'A+B',aliases:[]}];
  const parts=Atlas.segments('СТРАЖ башни, страж и Смотритель. Стражник A+B!',articles);
  assert.deepEqual(parts.filter(p=>p.article).map(p=>[p.text,p.article.id]),[['СТРАЖ башни','a2'],['страж','a1'],['Смотритель','a1'],['A+B','a3']]);
  assert.equal(parts.map(p=>p.text).join(''),'СТРАЖ башни, страж и Смотритель. Стражник A+B!');
});
test('NPC copies preserve all sprites without sharing or duplicate insertion',()=>{
  const quest={characters:[],scenes:[]},a=article(),c=Atlas.importCharacter(quest,a);
  assert.equal(c.name,'Страж');assert.equal(c.description,a.summary);assert.equal(Layers.pictures(c).length,2);Layers.validate(quest);
  a.images[1].name='Changed';assert.equal(c.images[0].name,'Гнев');Atlas.importCharacter(quest,a);assert.equal(quest.characters.length,1);
  assert.equal(quest.atlasEntries[0].markdown,undefined);assert.equal(quest.atlasEntries[0].images,undefined);
});
test('HTML contains standalone glossary and escaped short descriptions, no full article',()=>{
  const q={version:1,title:'Test',start:'s1',scenes:[{id:'s1',title:'Start',text:'Страж',x:0,y:0,choices:[]}],atlasLinks:true};
  Atlas.attach(q,{...article(),summary:'</script><script>alert(1)</script>'});const html=HTML.build(q);
  assert.ok(html.includes('function installAtlas'));assert.ok(html.includes('QuestAtlas.renderText'));assert.ok(!html.includes('Секреты мира'));assert.ok(!html.includes('</script><script>alert(1)'));
  const exported=JSON.parse(html.match(/<script id="quest-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(exported.atlasLinks,true);assert.equal(exported.atlasEntries[0].title,'Страж');assert.equal(exported.atlasEntries[0].summary,'</script><script>alert(1)</script>');
  q.atlasLinks=false;const disabled=JSON.parse(HTML.build(q).match(/<script id="quest-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);assert.equal(disabled.atlasEntries,undefined);
});
test('optional glossary renders plain text when disabled and safe buttons when enabled',()=>{
  const previous=global.document;const nodes=[];global.document={createTextNode:text=>({text}),createElement:tag=>({tag})};
  try{const host={textContent:'',replaceChildren(){nodes.length=0;},append(n){nodes.push(n);}},quest={atlasEntries:[article()]};
    Atlas.renderText(host,'Страж',quest);assert.equal(nodes.length,0);assert.equal(host.textContent,'Страж');
    quest.atlasLinks=true;Atlas.renderText(host,'Страж ждёт',quest);assert.equal(nodes[0].tag,'button');assert.equal(nodes[0].textContent,'Страж');assert.equal(nodes[1].text,' ждёт');
  }finally{global.document=previous;}
});
test('atlas sprite updates keep placement and dialogue references across reorder/removal',()=>{
  const q={scenes:[{id:'s',actors:[]}]},a=article(),c=Atlas.importCharacter(q,a),sprite=c.images[0].id;
  q.scenes[0].actors.push({character:c.id,imageId:sprite,x:.5,y:.8,width:.2});
  a.images.reverse();a.title='Новый страж';a.images[0].name='Изменённый';Atlas.importCharacter(q,a);
  assert.equal(c.name,'Новый страж');assert.equal(Layers.picture(c,sprite).name,'Изменённый');assert.equal(q.characters.length,1);
  a.images=a.images.filter(p=>p.id!=='p2');Atlas.importCharacter(q,a);assert.ok(Layers.picture(c,sprite));Layers.validate(q);
});
