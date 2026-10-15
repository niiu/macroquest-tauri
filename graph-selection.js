'use strict';
const graphSelection=new Set();let selectionProject=null,selectionDrag=null,suppressSelectionClick=false;
const groupSelection=el('button','','В главу (0)');groupSelection.id='group-selection';groupSelection.disabled=true;chaptersButton.after(groupSelection);
const selectionHint=el('span','hint','Рамка на пустом поле · Shift + клик / рамка — добавить · Esc — снять');document.querySelector('.canvas-footer').append(selectionHint);
function renderGraphSelection(){
  if(selectionProject!==project){selectionProject=project;graphSelection.clear();}
  for(const id of graphSelection)if(!project.scenes.some(s=>s.id===id))graphSelection.delete(id);
  document.querySelectorAll('#nodes .node').forEach(n=>n.classList.toggle('multi-selected',graphSelection.has(n.dataset.sceneId)));
  groupSelection.disabled=!graphSelection.size;groupSelection.textContent=`В главу (${graphSelection.size})`;
}
groupSelection.onclick=()=>{openChapters();for(const box of $('chapter-members').querySelectorAll('input'))box.checked=graphSelection.has(box.value);$('chapter-title').focus();};
const selectionGraph=$('graph');
function selectionPoint(e){const r=selectionGraph.getBoundingClientRect();return {x:(e.clientX-r.left)/zoom,y:(e.clientY-r.top)/zoom};}
function finishGraphSelection(cancel=false){
  const drag=selectionDrag;if(!drag)return;selectionDrag=null;
  if(cancel){graphSelection.clear();for(const id of drag.before)graphSelection.add(id);}
  drag.box.remove();if(selectionGraph.hasPointerCapture(drag.pointer))selectionGraph.releasePointerCapture(drag.pointer);
  suppressSelectionClick=true;setTimeout(()=>{suppressSelectionClick=false;},0);renderGraphSelection();
}
selectionGraph.addEventListener('pointerdown',e=>{
  if(e.button!==0||connectionSource)return;
  const node=e.target.closest('.node');
  if(node&&e.shiftKey){e.preventDefault();e.stopImmediatePropagation();const id=node.dataset.sceneId;const scene=project.scenes.find(s=>s.id===id);if(QuestService.isService(scene))return;if(graphSelection.has(id))graphSelection.delete(id);else graphSelection.add(id);renderGraphSelection();return;}
  if(e.target.closest('button,.node,.chapter-card,.edge-label,.edge-hit'))return;
  e.preventDefault();e.stopImmediatePropagation();renderGraphSelection();
  const before=new Set(graphSelection);if(!e.shiftKey)graphSelection.clear();
  const box=el('div','selection-marquee');selectionGraph.append(box);
  selectionDrag={start:selectionPoint(e),before,base:new Set(graphSelection),box,pointer:e.pointerId,project};selectionGraph.setPointerCapture(e.pointerId);renderGraphSelection();
},true);
selectionGraph.addEventListener('pointermove',e=>{
  const drag=selectionDrag;if(!drag||drag.pointer!==e.pointerId)return;if(drag.project!==project){finishGraphSelection(true);return;}
  const p=selectionPoint(e),x=Math.min(p.x,drag.start.x),y=Math.min(p.y,drag.start.y),right=Math.max(p.x,drag.start.x),bottom=Math.max(p.y,drag.start.y);
  Object.assign(drag.box.style,{left:x+'px',top:y+'px',width:(right-x)+'px',height:(bottom-y)+'px'});
  graphSelection.clear();for(const id of drag.base)graphSelection.add(id);
  for(const n of document.querySelectorAll('#nodes .node')){if(n.hidden)continue;const s=project.scenes.find(s=>s.id===n.dataset.sceneId);if(s&&!QuestService.isService(s)&&s.x<right&&s.x+220>x&&s.y<bottom&&s.y+nodeHeight(s)>y)graphSelection.add(s.id);}
  renderGraphSelection();
});
selectionGraph.addEventListener('pointerup',e=>{if(selectionDrag?.pointer===e.pointerId)finishGraphSelection();});
selectionGraph.addEventListener('pointercancel',e=>{if(selectionDrag?.pointer===e.pointerId)finishGraphSelection(true);});
selectionGraph.addEventListener('lostpointercapture',()=>finishGraphSelection(true));
selectionGraph.addEventListener('click',e=>{if(suppressSelectionClick||e.shiftKey){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||document.querySelector('dialog[open]'))return;if(selectionDrag)finishGraphSelection(true);else graphSelection.clear();renderGraphSelection();});
