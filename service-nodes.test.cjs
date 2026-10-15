const {test}=require('node:test');
const assert=require('node:assert/strict');
const Service=require('./service-nodes.js');
const HTML=require('./html-export.js');

const base=()=>({version:1,title:'Test',start:'s1',scenes:[
  {id:'s1',title:'Start',text:'Hi',x:0,y:0,choices:[{text:'Go',target:'s2'}]},
  {id:'s2',title:'End',text:'Bye',x:100,y:0,choices:[]}
]});

test('note creation, attachment validation and playable filter',()=>{
  const project=base();
  const note=Service.createNote({x:10,y:20});
  assert.equal(note.service,'note');assert.equal(note.target,'');assert.deepEqual(note.choices,[]);
  note.target='s1';note.markdown='# Hello';project.scenes.push(note);
  Service.validate(project);
  assert.equal(Service.playable(project).length,2);
  assert.equal(Service.notesFor(project,'s1').length,1);
  assert.equal(Service.preview(note).includes('Hello'),true);
});

test('notes cannot be start, path targets or chapter members',()=>{
  const project=base();
  const note=Service.createNote();note.target='s1';project.scenes.push(note);
  project.start=note.id;assert.throws(()=>Service.validate(project),/Начальной/);
  project.start='s1';project.scenes[0].choices[0].target=note.id;assert.throws(()=>Service.validate(project),/служебную/);
  project.scenes[0].choices[0].target='s2';note.chapter='c1';assert.throws(()=>Service.validate(project),/главы/);
});

test('html export strips service notes',()=>{
  const project=base();
  const note=Service.createNote();note.target='s1';note.markdown='Secret author note';project.scenes.push(note);
  const html=HTML.build(project);
  assert.ok(!html.includes('Secret author note'));
  const data=JSON.parse(html.match(/<script id="quest-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.scenes.length,2);assert.ok(!data.scenes.some(s=>s.service));
});
