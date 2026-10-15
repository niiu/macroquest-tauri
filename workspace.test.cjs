const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Atlas=require('./atlas.js');
function setup(records={}){
  const data=new Map(Object.entries(records)),calls=[],destroyed=[],context={QuestAtlas:Atlas,crypto:require('node:crypto').webcrypto,structuredClone,localStorage:{getItem:()=>null},STORAGE_KEY:'legacy',project:{version:1,title:'First',start:'s1',scenes:[{id:'s1'}]},validate:p=>{if(!p||!p.scenes)throw Error('Invalid quest');return p;},QuestStorage:{read:async k=>structuredClone(data.get(k||'current')),write:async(v,k)=>{data.set(k,structuredClone(v));},writeMany:async entries=>{calls.push(entries);for(const [k,v] of entries)data.set(k,structuredClone(v));}},flushProject:async()=>{},saveFailed:false,$:()=>null,el:(tag)=>document.createElement(tag),document:{body:{append(){}},createElement:tag=>({tag,append(){},addEventListener(){},showModal(){},close(){},hidden:false})}};
  context.selected='s1';vm.createContext(context);
  const source=fs.readFileSync('workspace.js','utf8').split('const tabs=')[0];
  vm.runInContext(source+`;renderQuestPicker=()=>{};renderAtlasTree=()=>{};renderAtlasOptions=()=>{};lockLibrary=v=>{libraryBusy=v;};activateQuest=p=>{project=p;};report=e=>{throw e;};globalThis.api={initialize:()=>initializeLibrary(project),save:p=>persistQuest(p),add:p=>addQuest(p),switch:id=>switchQuest(id),current:()=>structuredClone(project),catalog:()=>structuredClone(questCatalog),atlas:()=>structuredClone(atlasData),restore:b=>restoreTaxonomyBackup(b),close:opts=>closeApplication(opts),setDirty:v=>{atlasDirty=v;},setSaveFailed:v=>{saveFailed=v;}};`,context);
  return {data,calls,destroyed,context,api:context.api};
}
test('legacy migration creates independent record and retains original',async()=>{
  const old={version:1,title:'Legacy',start:'s1',scenes:[{id:'s1'}]},s=setup({current:old});await s.api.initialize();
  assert.equal(s.api.current().title,'Legacy');assert.deepEqual(s.data.get('current'),old);assert.equal(s.calls[0].length,2);
});
test('multiple quests survive switching, editing and restarting',async()=>{
  const s=setup();await s.api.initialize();const first=s.api.current();await s.api.add({version:1,title:'Second',start:'s2',scenes:[{id:'s2'}]});const second=s.api.current();
  assert.notEqual(first.workspaceId,second.workspaceId);assert.equal(s.api.catalog().quests.length,2);
  await s.api.switch(first.workspaceId);const edited=s.api.current();edited.title='Renamed';await s.api.save(edited);
  assert.equal(s.data.get('quest:'+second.workspaceId).title,'Second');assert.equal(s.api.catalog().quests[0].title,'Renamed');
  const restarted=setup(Object.fromEntries(s.data));await restarted.api.initialize();assert.equal(restarted.api.current().title,'Renamed');
});
test('failed write does not add catalog entry or change current quest',async()=>{
  const s=setup();await s.api.initialize();const before=s.api.current();s.context.QuestStorage.writeMany=async()=>{throw Error('disk full');};
  await assert.rejects(s.api.add({title:'Bad',scenes:[]}),/disk full/);assert.equal(s.api.catalog().quests.length,1);assert.deepEqual(s.api.current(),before);
});
test('v2 loads even if legacy record is corrupt',async()=>{
  const s=setup();await s.api.initialize();s.data.set('current',{broken:true});const restarted=setup(Object.fromEntries(s.data));await restarted.api.initialize();assert.equal(restarted.api.current().title,'First');
});
test('taxonomy backup restore migrates and replaces atlas without touching quests',async()=>{
  const s=setup();await s.api.initialize();
  const questTitle=s.api.current().title;
  const backup={version:1,categories:[{id:'old',title:'Старое',parent:''}],articles:[{id:'a1',title:'Герой',kind:'character',category:'',summary:'Кратко',markdown:'Полный',aliases:[],images:[]}]};
  s.data.set('atlas-before-taxonomy-v1',backup);
  s.data.set('atlas-v1',Atlas.migrate(Atlas.empty()));
  await s.api.restore(backup);
  const atlas=s.api.atlas();
  assert.equal(atlas.taxonomyVersion,1);assert.equal(atlas.articles[0].title,'Герой');
  assert.equal(atlas.categories.find(c=>c.id===atlas.articles[0].category).title,'Персонажи');
  assert.equal(s.api.current().title,questTitle);
  await assert.rejects(s.api.restore(null),/Резервной копии/);
});
test('close saves dirty atlas, discard skips save, cancel keeps window',async()=>{
  const s=setup();await s.api.initialize();
  let saved=0,destroyed=0;
  const base=Atlas.migrate(Atlas.empty()),lore=base.categories.find(c=>c.title==='Лор').id;
  const save=async()=>{saved++;await s.context.storeAtlas({...structuredClone(base),articles:[{id:'x',title:'Черновик',kind:'lore',category:lore,summary:'',markdown:'text',aliases:[],images:[]}]});};
  const destroy=async()=>{destroyed++;};
  assert.equal(await s.api.close({dirty:true,save,destroy,ask:async()=>'cancel'}),false);assert.equal(destroyed,0);assert.equal(saved,0);
  assert.equal(await s.api.close({dirty:true,save,destroy,ask:async()=>'discard'}),true);assert.equal(destroyed,1);assert.equal(saved,0);
  destroyed=0;
  assert.equal(await s.api.close({dirty:true,save,destroy,ask:async()=>'save'}),true);assert.equal(destroyed,1);assert.equal(saved,1);
  assert.ok(s.data.get('atlas-v1').articles.some(a=>a.title==='Черновик'));
  s.api.setSaveFailed(true);
  await assert.rejects(s.api.close({dirty:false,destroy,ask:async()=>'discard'}),/Не удалось сохранить квест/);
});
