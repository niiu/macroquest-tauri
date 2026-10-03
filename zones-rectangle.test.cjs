const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),zones=require('./zones.js');
test('rectangle works in either direction, after resizing, with erasing and repainting',()=>{
  const rect={mode:'paint',shape:'rect',radius:.01,points:[[.8,.9],[.2,.1]]},hole={mode:'erase',radius:.1,points:[[.5,.5]]};
  assert.ok(zones.validStrokes([rect,hole]));assert.equal(zones.hit([{zone:[rect]}],.3,.4,1600,900),0);
  assert.equal(zones.hit([{zone:[rect]}],.1,.4,400,800),-1);
  assert.equal(zones.hit([{zone:[rect,hole]}],.5,.5,400,800),-1);
  assert.equal(zones.hit([{zone:[rect,hole,rect]}],.5,.5,400,800),0);
  assert.equal(zones.validStrokes([{...rect,points:[[.1,.1]]}]),false);
  assert.equal(zones.validStrokes([{...rect,shape:'unknown'}]),false);
  const context={};vm.runInNewContext(zones.standaloneSource(),context);assert.equal(context.QuestZones.hit([{zone:[rect]}],.3,.4,400,300),0);
});
test('rectangle pointer gesture commits endpoint, cancellation and zero-size discard it',()=>{
  const controls={},choice={zone:[]};let saves=0;
  const element=()=>({after(){},setAttribute(){},style:{},classList:{toggle(){}},getBoundingClientRect:()=>({left:100,top:50,width:400,height:200}),setPointerCapture(){},hasPointerCapture:()=>false});
  const $=id=>controls[id]??=(id==='brush-size'?{value:48}:element());
  const context={$,el:element,document:{addEventListener(){}},scene:()=>({choices:[choice]}),activeChoice:0,paintTool:'rect',QuestZones:zones,save:()=>saves++,requestAnimationFrame:()=>1,alert(){}};
  vm.createContext(context);const src=fs.readFileSync('image-editor.js','utf8').split('function decodeImage')[0];vm.runInContext(src,context);vm.runInContext('imageReady=true;paintZones=()=>{};syncZoneTools=()=>{};',context);
  const canvas=$('zone-canvas'),event=(x,y)=>({button:0,pointerId:1,currentTarget:canvas,clientX:x,clientY:y,preventDefault(){}});
  canvas.onpointerdown(event(180,90));canvas.onpointermove(event(300,130));canvas.onpointerup(event(420,210));assert.deepEqual(JSON.parse(JSON.stringify(choice.zone[0].points)),[[.2,.2],[.8,.8]]);assert.equal(saves,1);
  canvas.onpointerdown(event(180,90));canvas.onpointercancel();assert.equal(choice.zone.length,1);
  canvas.onpointerdown(event(180,90));canvas.onpointerup(event(180,90));assert.equal(choice.zone.length,1);assert.equal(saves,1);
});
