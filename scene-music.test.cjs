const assert=require('node:assert/strict');
const music=require('./scene-music.js');
const exporter=require('./html-export.js');

const tiny='data:audio/mpeg;base64,/+MYxAAAAANIAAAAAExBTUUzLjk4LjIAAAAAAAAAAAAA';
const project={version:1,title:'Музыка',start:'a',soundtrack:[{id:'m1',title:'Лес',audio:tiny}],scenes:[
  {id:'a',title:'Старт',text:'Текст',x:0,y:0,music:{track:'m1'},choices:[{text:'Дальше',target:'b'}]},
  {id:'b',title:'Наследование',text:'Тише',x:10,y:0,choices:[{text:'Стоп',target:'c'}]},
  {id:'c',title:'Стоп',text:'Конец',x:20,y:0,music:{stop:true},choices:[]}
]};

music.validate(project);
assert.equal(music.normalizeAction(undefined),null);
assert.equal(music.normalizeAction(null),null);
assert.deepEqual(music.normalizeAction({track:'m1'}),{track:'m1'});
assert.deepEqual(music.normalizeAction({stop:true}),{stop:true});
assert.equal(music.normalizeAction({track:''}),false);
assert.equal(music.normalizeAction({}),false);

const bad=structuredClone(project);bad.scenes[0].music={track:'missing'};
assert.throws(()=>music.validate(bad),/отсутствующий трек/);
const huge=structuredClone(project);huge.soundtrack[0].audio='data:audio/mpeg;base64,'+'A'.repeat(12*1024*1024);
assert.throws(()=>music.validate(huge),/трек/);
const badFmt=structuredClone(project);badFmt.soundtrack[0].audio='data:audio/flac;base64,AAAA';
assert.throws(()=>music.validate(badFmt),/трек/);

class FakeAudio{
  constructor(src){this.src=src;this.volume=1;this.loop=false;this.paused=true;FakeAudio.created.push(this);}
  play(){this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
}
FakeAudio.created=[];

const ctrl=music.createController({Audio:FakeAudio,fadeMs:0});
assert.equal(ctrl.trackId,null);
let result=ctrl.apply(project,{track:'m1'});
assert.equal(result.changed,true);assert.equal(ctrl.trackId,'m1');assert.equal(FakeAudio.created.length,1);
assert.equal(FakeAudio.created[0].loop,true);
result=ctrl.apply(project,{track:'m1'});
assert.equal(result.changed,false,'same track does not restart');
assert.equal(FakeAudio.created.length,1);
project.soundtrack.push({id:'m2',title:'Река',audio:tiny});
result=ctrl.apply(project,{track:'m2'});
assert.equal(result.changed,true);assert.equal(ctrl.trackId,'m2');
result=ctrl.apply(project,{stop:true});
assert.equal(result.changed,true);assert.equal(ctrl.trackId,null);
result=ctrl.apply(project,undefined);
assert.equal(result.changed,false,'inherit keeps silence');
ctrl.dispose();

const html=exporter.build(project);
assert.ok(html.includes('data:audio/mpeg;base64'),'export embeds soundtrack audio');
assert.ok(html.includes('QuestMusic')||html.includes('installQuestMusic'),'export bundles music controller');
const data=JSON.parse(html.match(/<script id="quest-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.equal(data.soundtrack.length,2);
assert.deepEqual(data.scenes[0].music,{track:'m1'});
assert.equal(data.scenes[1].music,undefined);
assert.deepEqual(data.scenes[2].music,{stop:true});
const plain=structuredClone(project);delete plain.soundtrack;plain.scenes.forEach(s=>delete s.music);
assert.doesNotThrow(()=>exporter.build(plain),'scenes without music still export');

console.log('PASS: scene music validate, same-track keep, stop, HTML soundtrack embed');
