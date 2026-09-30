const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('actor dialogue resolves linked reply, creates once and edits current reply for inherited actors',()=>{
  const {resolve}=require('./actor-dialogue.js'),placement={character:'npc'},owner={id:'scene',x:10,y:20,actors:[placement]},quest={scenes:[owner],characters:[{id:'npc',name:'Страж'}]};
  assert.equal(resolve(quest,owner,placement),null);
  const reply=resolve(quest,owner,placement,true);assert.equal(reply.speaker,'Страж');assert.equal(placement.dialogue,reply.id);assert.equal(resolve(quest,owner,placement,true),reply);assert.equal(quest.scenes.length,2);
  const inherited={...placement};reply.actors=[inherited];assert.equal(resolve(quest,reply,inherited),reply);
  assert.equal(resolve(quest,owner,{}),null);
});
test('removing scene artwork clears placements and zones, preserves transitions and library',()=>{
  const actor={character:'npc',dialogue:'reply',x:.5,y:.8,width:.2},node={image:'image',actors:[actor],choices:[{text:'Go',target:'next',zone:[{}]}]};
  const library=[{id:'npc'}],calls=[];
  const body=fs.readFileSync('image-editor.js','utf8').split("$('remove-image').onclick=()=>{")[1].split('\n};')[0];
  vm.runInNewContext('(()=>{'+body+'})();',{scene:()=>node,confirm:()=>true,finishStroke:()=>{},save:()=>{},renderImageEditor:()=>{},renderCharacters:()=>calls.push('characters'),renderChoices:()=>{},renderGraph:()=>{}});
  assert.equal(node.image,undefined);assert.equal(node.actors.length,0);assert.equal(node.choices[0].zone.length,0);assert.equal(node.choices[0].target,'next');assert.equal(library.length,1);assert.deepEqual(calls,['characters']);
});
function pointerHarness(){
  class Target extends EventTarget{
    setPointerCapture(id){this.id=id;} hasPointerCapture(id){return this.id===id;}
    releasePointerCapture(){this.id=null;this.send('lostpointercapture');}
    send(type,props={}){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,button:0,isPrimary:true,clientX:0,clientY:0},props);this.dispatchEvent(e);return e;}
  }
  const window=new Target(),target=new Target(),calls=[];
  const context={window};vm.runInNewContext(fs.readFileSync('pointer-drag.js','utf8'),context);
  const cancel=context.QuestPointerDrag.bind(target,{canStart:e=>!e.blocked,start:()=>calls.push('start'),move:()=>calls.push('move'),end:()=>calls.push('drop'),cancel:()=>calls.push('cancel')});
  return {window,target,calls,cancel};
}
test('pointer transfer captures source and commits once even when release loses capture',()=>{
  const {target,calls}=pointerHarness();target.send('pointerdown');assert.equal(target.id,1);
  target.send('pointermove',{clientX:30});target.send('pointerup',{clientX:30});target.send('pointerup');
  assert.deepEqual(calls,['start','move','drop']);assert.equal(target.id,null);
});
test('clicks, form controls and another pointer do not create placements',()=>{
  const {target,calls}=pointerHarness();target.send('pointerdown',{blocked:true});target.send('pointermove',{clientX:50});target.send('pointerup');
  target.send('pointerdown');target.send('pointermove',{pointerId:2,clientX:50});target.send('pointermove',{clientX:3});target.send('pointerup');assert.deepEqual(calls,[]);
});
test('Escape, capture loss, blur, pointer cancellation and rerender cancel without dropping',()=>{
  for(const reason of ['Escape','lostpointercapture','blur','pointercancel','rerender']){
    const {target,window,calls,cancel}=pointerHarness();target.send('pointerdown');target.send('pointermove',{clientX:20});
    if(reason==='Escape')window.send('keydown',{key:'Escape'});else if(reason==='blur')window.send('blur');else if(reason==='rerender')cancel();else target.send(reason);
    target.send('pointerup');assert.deepEqual(calls,['start','move','cancel'],reason);
  }
});
test('selecting brush/eraser exits actor positioning and re-enables zone input',()=>{
  const controls={'move-actors':{checked:true},'show-zones':{checked:false}},calls=[];
  const source=fs.readFileSync('image-editor.js','utf8').split('function chooseTool(tool){')[1].split("$('brush-tool')")[0];
  const context={$:id=>controls[id],finishStroke:commit=>calls.push(commit),renderActorLayers:()=>calls.push(controls['move-actors'].checked),syncZoneTools:()=>{},paintZones:()=>{}};
  vm.runInNewContext('let paintTool;function chooseTool(tool){'+source+';chooseTool("erase");',context);
  assert.equal(controls['move-actors'].checked,false);assert.equal(controls['show-zones'].checked,true);assert.deepEqual(calls,[true,false]);
});
