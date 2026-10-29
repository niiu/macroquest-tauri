const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const QuestHotkeys=require('./graph-hotkeys.js');
function load(saved){
  const ids={},vars={},root={dataset:{},style:{setProperty:(k,v)=>vars[k]=v}};
  const node=()=>({setAttribute(){},reportValidity:()=>true,replaceChildren(){},append(){},querySelector(){return null},onclick:null,onsubmit:null,hidden:false,textContent:'',value:'',checked:false,type:'button'});
  let stored=saved;
  const context={
    localStorage:{getItem:()=>stored,setItem:(k,v)=>stored=v},
    button:node,el:node,tabs:{append(){}},atlasPanel:{after(){}},
    document:{documentElement:root,addEventListener(){},removeEventListener(){}},
    $:id=>ids[id]??=node(),showWorkspace(){},QuestHotkeys,captureHotkeyAction:null,refreshAddNodeHint(){}
  };
  vm.createContext(context);vm.runInContext(fs.readFileSync('editor-settings.js','utf8'),context);
  return {context,ids,vars,root,stored:()=>stored};
}
test('font levels follow both checkbox states and persist across restarts',()=>{
  const h=load();
  h.ids['font-base'].value='16';h.ids['font-step'].value='4';h.ids['font-medium'].checked=false;h.ids['font-large'].checked=true;h.ids['editor-theme'].value='night';
  h.ids['settings-form'].onsubmit({preventDefault(){}});
  assert.equal(h.vars['--font-medium'],'16px');assert.equal(h.vars['--font-large'],'20px');
  const next=load(h.stored());
  assert.equal(next.vars['--font-large'],'20px');assert.equal(next.root.dataset.editorTheme,'night');
  next.ids['settings-reset'].onclick();
  assert.equal(next.vars['--font-base'],'14px');assert.equal(next.root.dataset.editorTheme,'forest');
  assert.equal(JSON.parse(next.stored()).hotkeys.addNode,'Shift+KeyA');
});
test('corrupt and out-of-range preferences recover without breaking editor',()=>{
  assert.equal(load('{bad').vars['--font-base'],'14px');
  const h=load(JSON.stringify({base:100,step:-3,medium:false,large:false,theme:'unknown',hotkeys:{addNode:'???'}}));
  assert.equal(h.vars['--font-base'],'24px');assert.equal(h.vars['--font-large'],'24px');
  assert.equal(h.root.dataset.editorTheme,'forest');
  assert.equal(h.context.editorSettings.hotkeys.addNode,'Shift+KeyA');
});
test('hotkeys persist multiple bindings clear and reset',()=>{
  const h=load();
  h.context.editorSettings.hotkeys={...h.context.editorSettings.hotkeys,addNode:'Ctrl+KeyN',play:''};
  h.ids['font-base'].value='14';h.ids['font-step'].value='3';h.ids['font-medium'].checked=true;h.ids['font-large'].checked=true;h.ids['editor-theme'].value='forest';
  h.ids['settings-form'].onsubmit({preventDefault(){}});
  const saved=JSON.parse(h.stored());
  assert.equal(saved.hotkeys.addNode,'Ctrl+KeyN');
  assert.equal(saved.hotkeys.play,'');
  assert.equal(saved.hotkeys.exportHtml,'Ctrl+KeyE');
  const next=load(h.stored());
  assert.equal(next.context.editorSettings.hotkeys.addNode,'Ctrl+KeyN');
  assert.equal(next.context.editorSettings.hotkeys.play,'');
  next.ids['settings-reset'].onclick();
  assert.equal(next.context.editorSettings.hotkeys.addNode,'Shift+KeyA');
  assert.equal(next.context.editorSettings.hotkeys.play,'Space');
});
