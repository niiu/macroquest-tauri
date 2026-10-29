const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Node{
  constructor(){this.children=[];this.open=false;}
  append(...nodes){for(const n of nodes){if(n.parent)n.parent.children.splice(n.parent.children.indexOf(n),1);this.children.push(n);n.parent=this;}}
  prepend(n){this.append(n);this.children.unshift(this.children.pop());}
  before(n){this.parent.append(n);const p=this.parent;p.children.splice(p.children.indexOf(n),1);p.children.splice(p.children.indexOf(this),0,n);}
  after(n){this.parent.append(n);const p=this.parent;p.children.splice(p.children.indexOf(n),1);p.children.splice(p.children.indexOf(this)+1,0,n);}
}
test('graphic mode moves original fields, folds them, restores order and isolates quest settings',()=>{
  const body=new Node(),ids={},selectors={};for(const key of ['actions','dialogue','text','image','answers','choices']){const n=new Node();n.value=key;body.append(n);selectors[key]=n;}
  Object.assign(ids,{'editor-body':body,'dialogue-editor':selectors.dialogue,'dialogue-choice-editor':selectors.answers});
  const panels=Object.values(selectors).filter(n=>['text','image','choices'].includes(n.value)).map(n=>{n.dataset={editorPanel:n.value};n.hidden=false;return n;});
  const doc={createComment:()=>new Node(),querySelector:s=>s==='.scene-actions'?selectors.actions:selectors[s.match(/"(.*?)"/)[1]],querySelectorAll:()=>panels};
  const first={graphicMode:true},second={graphicMode:false},context={document:doc,$:id=>ids[id],el:()=>new Node(),project:first,selected:'s1',save:()=>{}};
  vm.createContext(context);vm.runInContext(fs.readFileSync('graphic-mode.js','utf8')+';globalThis.api={update:updateGraphicMode,layout:graphicLayout,text:graphicText,choices:graphicChoices};',context);
  context.api.update();assert.deepEqual(context.api.layout.children,[selectors.image,context.api.text,context.api.choices]);assert.equal(context.api.text.open,false);
  context.api.text.open=true;context.api.update();assert.equal(context.api.text.open,true);
  context.project=second;context.api.update();assert.equal(context.api.layout.hidden,true);assert.deepEqual(body.children.filter(n=>n.value).map(n=>n.value),['actions','dialogue','text','image','answers','choices']);
  assert.equal(first.graphicMode,true);assert.equal(second.graphicMode,false);context.project=first;context.api.update();assert.equal(context.api.text.open,false);assert.equal(selectors.text.value,'text');
});
