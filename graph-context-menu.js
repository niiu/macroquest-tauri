'use strict';
let addNodeMenu=null,lastGraphPointer=null,graphPointerOver=false;
const addNodeHint=el('span','hint','');
function refreshAddNodeHint(){
  const binding=typeof editorSettings!=='undefined'&&editorSettings.hotkeys?editorSettings.hotkeys.addNode:QuestHotkeys.HOTKEY_DEFAULTS.addNode;
  addNodeHint.textContent='ПКМ на пустом поле · '+QuestHotkeys.formatHotkey(binding)+' — создать узел';
}
document.querySelector('.canvas-footer').append(addNodeHint);
refreshAddNodeHint();
function closeAddNodeMenu(){
  if(!addNodeMenu)return;
  addNodeMenu.remove();addNodeMenu=null;
  document.removeEventListener('pointerdown',onMenuOutside,true);
  document.removeEventListener('keydown',onMenuEscape,true);
}
function onMenuOutside(e){if(addNodeMenu&&!addNodeMenu.contains(e.target))closeAddNodeMenu();}
function onMenuEscape(e){if(e.key==='Escape'){e.preventDefault();closeAddNodeMenu();}}
function openAddNodeMenu(clientX,clientY){
  if(document.querySelector('.workspace')?.hidden||document.querySelector('dialog[open]'))return;
  closeAddNodeMenu();
  const menu=el('div','graph-context-menu');menu.setAttribute('role','menu');menu.setAttribute('aria-label','Создать узел');
  const place={x:clientX,y:clientY};
  function item(label,action){
    const b=el('button','',label);b.setAttribute('role','menuitem');b.type='button';
    b.onclick=e=>{e.stopPropagation();closeAddNodeMenu();action(place.x,place.y);};
    menu.append(b);
  }
  item('Сцена',(x,y)=>createSceneAt(x,y));
  item('Заметка',(x,y)=>createNoteAt(x,y));
  document.body.append(menu);addNodeMenu=menu;
  const pad=8,w=menu.offsetWidth,h=menu.offsetHeight;
  menu.style.left=Math.min(window.innerWidth-w-pad,Math.max(pad,clientX))+'px';
  menu.style.top=Math.min(window.innerHeight-h-pad,Math.max(pad,clientY))+'px';
  document.addEventListener('pointerdown',onMenuOutside,true);
  document.addEventListener('keydown',onMenuEscape,true);
  menu.querySelector('button')?.focus();
}
function isEmptyGraphTarget(target){
  if(!target||target.closest('input,textarea,select,[contenteditable=true]'))return false;
  if(target.closest('.node,.node-port,.edge-label,.edge-hit,.chapter-card,.selection-marquee,.graph-context-menu,.expand-area,.graph-map-panel'))return false;
  return !!target.closest('#graph,#graph-space,#graph-viewport,#nodes,#edges,#edge-labels');
}
$('graph-viewport').addEventListener('pointermove',e=>{
  if(!e.target.closest('#graph-viewport'))return;
  lastGraphPointer={x:e.clientX,y:e.clientY};graphPointerOver=true;
});
$('graph-viewport').addEventListener('pointerleave',()=>{graphPointerOver=false;});
$('graph-viewport').addEventListener('contextmenu',e=>{
  if(!isEmptyGraphTarget(e.target)){closeAddNodeMenu();return;}
  e.preventDefault();e.stopPropagation();
  lastGraphPointer={x:e.clientX,y:e.clientY};
  openAddNodeMenu(e.clientX,e.clientY);
});
