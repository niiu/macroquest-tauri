const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
  const listeners={},graph={addEventListener:(t,f)=>listeners[t]=f,getBoundingClientRect:()=>({left:100,top:50}),append(){},setPointerCapture(id){this.pointer=id;},hasPointerCapture(id){return this.pointer===id;},releasePointerCapture(){this.pointer=null;}};
  const nodes=[{id:'a',x:10,y:10},{id:'b',x:300,y:10},{id:'hidden',x:10,y:10}].map(s=>({dataset:{sceneId:s.id},hidden:s.id==='hidden',classList:{toggle(){}},scene:s}));
  const buttons=[],boxes=nodes.map(n=>({value:n.dataset.sceneId,checked:false}));let opened=0;
  const context={Set,setTimeout:()=>{},QuestService:require('./service-nodes.js'),project:{scenes:nodes.map(n=>n.scene)},zoom:.5,connectionSource:null,chaptersButton:{after(){}},nodeHeight:()=>154,
    el:()=>{const e={style:{},remove(){}};buttons.push(e);return e;},
    $:id=>id==='graph'?graph:id==='chapter-members'?{querySelectorAll:()=>boxes}:{focus(){}},openChapters:()=>opened++,
    document:{querySelector:s=>s==='dialog[open]'?null:{append(){}},querySelectorAll:()=>nodes,addEventListener:(t,f)=>listeners['document:'+t]=f}};
  vm.createContext(context);vm.runInContext(fs.readFileSync('graph-selection.js','utf8'),context);
  const blank={closest:()=>null};
  function event(type,x=0,y=0,extra={}){listeners[type]({button:0,pointerId:1,clientX:100+x*.5,clientY:50+y*.5,target:blank,preventDefault(){},stopImmediatePropagation(){},...extra});}
  const selected=()=>Array.from(vm.runInContext('graphSelection',context));
  return {event,selected,context,buttons,boxes,nodes,opened:()=>opened};
}
test('marquee handles zoom, excludes hidden nodes and preselects chapter members',()=>{
  const h=harness();h.event('pointerdown');h.event('pointermove',250,180);h.event('pointerup');assert.deepEqual(h.selected(),['a']);h.buttons[0].onclick();assert.equal(h.opened(),1);assert.deepEqual(h.boxes.map(b=>b.checked),[true,false,false]);
});
test('Shift extends marquee and toggles scenes; cancellation restores previous selection',()=>{
  const h=harness();h.event('pointerdown');h.event('pointermove',240,180);h.event('pointerup');
  h.event('pointerdown',550,180,{shiftKey:true});h.event('pointermove',290,0);h.event('pointerup');assert.deepEqual(h.selected(),['a','b']);
  const target={closest:s=>s==='.node'?h.nodes[0]:null};h.event('pointerdown',0,0,{shiftKey:true,target});assert.deepEqual(h.selected(),['b']);
  h.event('pointerdown');h.event('pointermove',240,180);h.event('pointercancel');assert.deepEqual(h.selected(),['b']);
  h.event('document:keydown',0,0,{key:'Escape'});assert.deepEqual(h.selected(),[]);
});
test('switching quests clears selection and another pointer cannot finish marquee',()=>{
  const h=harness();h.event('pointerdown');h.event('pointermove',240,180);h.event('pointerup',0,0,{pointerId:2});assert.ok(vm.runInContext('selectionDrag',h.context));h.event('pointerup');h.context.project={scenes:[]};vm.runInContext('renderGraphSelection()',h.context);assert.deepEqual(h.selected(),[]);
});
