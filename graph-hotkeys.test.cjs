const {test}=require('node:test'),assert=require('node:assert/strict'),Hotkeys=require('./graph-hotkeys.js');
test('default addNode is Shift+A and matches keyboard event by code',()=>{
  const binding=Hotkeys.HOTKEY_DEFAULTS.addNode;
  assert.equal(binding,'Shift+KeyA');
  assert.equal(Hotkeys.formatHotkey(binding),'Shift+A');
  assert.equal(Hotkeys.matchHotkey({code:'KeyA',shiftKey:true,ctrlKey:false,altKey:false,metaKey:false},binding),true);
  assert.equal(Hotkeys.matchHotkey({code:'KeyA',shiftKey:false,ctrlKey:false,altKey:false,metaKey:false},binding),false);
});
test('catalog covers graph scene files and tabs groups',()=>{
  assert.ok(Hotkeys.HOTKEY_ACTIONS.length>=20);
  assert.deepEqual(Hotkeys.HOTKEY_GROUPS.map(g=>g.id),['graph','scene','files','tabs']);
  assert.equal(Hotkeys.HOTKEY_DEFAULTS.play,'Space');
  assert.equal(Hotkeys.formatHotkey('Ctrl+Equal'),'Ctrl+=');
  assert.equal(Hotkeys.formatHotkey(''),'—');
});
test('normalize recovers corrupt keys keeps empty and findConflict skips blanks',()=>{
  const normalized=Hotkeys.normalizeHotkeys({addNode:'not-a-key',play:''});
  assert.equal(normalized.addNode,'Shift+KeyA');
  assert.equal(normalized.play,'');
  assert.equal(Hotkeys.findConflict({addNode:'Ctrl+KeyS',play:''},'play','Ctrl+KeyS'),'addNode');
  assert.equal(Hotkeys.findConflict({addNode:'',play:'Space'},'addNode','Space'),'play');
  assert.equal(Hotkeys.matchHotkey({code:'Space',shiftKey:false,ctrlKey:false,altKey:false,metaKey:false},''),false);
});
test('fromEvent ignores bare modifiers and accepts Equal',()=>{
  assert.equal(Hotkeys.fromEvent({code:'ShiftLeft',shiftKey:true}),null);
  assert.deepEqual(Hotkeys.fromEvent({code:'Equal',ctrlKey:true,shiftKey:false,altKey:false,metaKey:false}),{ctrl:true,alt:false,shift:false,meta:false,code:'Equal'});
});
