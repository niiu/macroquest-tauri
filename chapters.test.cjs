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
