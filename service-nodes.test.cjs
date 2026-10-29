const {test}=require('node:test');
const assert=require('node:assert/strict');
const Service=require('./service-nodes.js');
const HTML=require('./html-export.js');
const Chapters=require('./chapters.js');

const base=()=>({version:1,title:'Test',start:'s1',chapters:[{id:'c1',title:'Глава',collapsed:false}],scenes:[
  {id:'s1',title:'Start',text:'Hi',chapter:'c1',x:0,y:0,choices:[{text:'Go',target:'s2'}]},
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

test('notes cannot be start or path targets but may join chapters',()=>{
  const project=base();
  const note=Service.createNote();note.target='s1';project.scenes.push(note);
  project.start=note.id;assert.throws(()=>Service.validate(project),/Начальной/);
  project.start='s1';project.scenes[0].choices[0].target=note.id;assert.throws(()=>Service.validate(project),/служебную/);
  project.scenes[0].choices[0].target='s2';note.chapter='c1';Service.validate(project);Chapters.validate(project);
});

test('note attached to chapter scene inherits that chapter',()=>{
  const project=base();
  const note=Service.createNote();note.target='s1';project.scenes.push(note);
  Service.syncNoteChapters(project);
  assert.equal(note.chapter,'c1');
  assert.equal(Chapters.members(project,project.chapters[0]).some(s=>s.id===note.id),true);
  note.target='s2';Service.syncNoteChapters(project);
  assert.equal(note.chapter,undefined);
  note.target='';note.chapter='c1';Service.syncNoteChapters(project);
  assert.equal(note.chapter,'c1');
});

test('html export strips service notes',()=>{
  const project=base();
  const note=Service.createNote();note.target='s1';note.markdown='Secret author note';note.chapter='c1';project.scenes.push(note);
  const html=HTML.build(project);
  assert.ok(!html.includes('Secret author note'));
  const data=JSON.parse(html.match(/<script id="quest-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.scenes.length,2);assert.ok(!data.scenes.some(s=>s.service));
});
