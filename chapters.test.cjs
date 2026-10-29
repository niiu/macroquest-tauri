const {test}=require('node:test'),assert=require('node:assert/strict'),chapters=require('./chapters.js'),saves=require('./saves.js');
const sample=()=>({title:'Quest',start:'a',chapters:[{id:'one',title:'Начало',collapsed:false},{id:'two',title:'Финал',collapsed:true}],scenes:[{id:'a',title:'A',text:'',chapter:'one',x:50,y:60,choices:[{text:'Go',target:'b'}]},{id:'b',title:'B',text:'',chapter:'one',x:350,y:80,choices:[{text:'End',target:'c'}]},{id:'c',title:'C',text:'',chapter:'two',x:700,y:400,choices:[]}]});
test('chapters support legacy quests, round trip and reject dangling, duplicate and invalid data',()=>{
  chapters.validate({scenes:[{id:'a'}]});const p=sample();chapters.validate(p);chapters.validate(JSON.parse(JSON.stringify(p)));
  for(const change of [p=>p.scenes[0].chapter='missing',p=>p.chapters.push({...p.chapters[0]}),p=>p.chapters[0].collapsed='yes',p=>p.chapters[0].title='']){const invalid=sample();change(invalid);assert.throws(()=>chapters.validate(invalid));}
});
test('collapse redirects boundary edges, hides internal ones and preserves scenes and saves',()=>{
  const p=sample(),before=JSON.stringify(p.scenes),key=saves.questKey(p),[a,b,c]=p.scenes;
  assert.equal(chapters.proxy(p,a),a);p.chapters[0].collapsed=true;
  assert.equal(chapters.proxy(p,a).id,chapters.proxy(p,b).id);assert.equal(chapters.internal(p,a,b),true);assert.equal(chapters.internal(p,b,c),false);
  assert.equal(chapters.proxy(p,b).x,50);assert.equal(chapters.proxy(p,b).y,60);assert.equal(JSON.stringify(p.scenes),before);assert.equal(saves.questKey(p),key);
  p.chapters[0].collapsed=false;assert.equal(chapters.proxy(p,b),b);assert.equal(chapters.internal(p,a,b),false);
});
test('removing a chapter keeps scenes, NPC links and transitions',()=>{
  const p=sample();p.scenes[0].actors=[{dialogue:'b'}];chapters.remove(p,'one');chapters.validate(p);
  assert.equal(p.scenes.length,3);assert.equal(p.scenes[0].chapter,undefined);assert.equal(p.scenes[1].chapter,undefined);assert.equal(p.scenes[2].chapter,'two');assert.equal(p.scenes[0].choices[0].target,'b');assert.equal(p.scenes[0].actors[0].dialogue,'b');
});
test('chapter bounds and members include notes',()=>{
  const p=sample(),Service=require('./service-nodes.js');
  const note=Service.createNote({x:10,y:40});note.target='a';note.chapter='one';p.scenes.push(note);
  chapters.validate(p);Service.validate(p);
  assert.equal(chapters.members(p,p.chapters[0]).length,3);
  const box=chapters.bounds(p,p.chapters[0],()=>154);
  assert.equal(box.x,10);assert.equal(box.y,40);
});
test('move shifts all chapter members together',()=>{
  const p=sample();chapters.move(p,p.chapters[0],30,-10);
  assert.equal(p.scenes[0].x,80);assert.equal(p.scenes[0].y,50);
  assert.equal(p.scenes[1].x,380);assert.equal(p.scenes[1].y,70);
  assert.equal(p.scenes[2].x,700);
});
test('atPoint detects expanded chapter space and ignores collapsed',()=>{
  const p=sample(),h=()=>154;
  const hit=chapters.atPoint(p,60,70,h);
  assert.equal(hit?.id,'one');
  assert.equal(chapters.atPoint(p,710,410,h),null);
  p.chapters[1].collapsed=false;
  assert.equal(chapters.atPoint(p,710,410,h)?.id,'two');
});
