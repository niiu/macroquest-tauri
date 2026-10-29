'use strict';
// Move the existing editor nodes, preserving input values, listeners and canvas state.
const graphicToggle=el('input');graphicToggle.type='checkbox';graphicToggle.id='graphic-mode';
const graphicLabel=el('label','toggle graphic-mode-toggle','Графический режим');graphicLabel.prepend(graphicToggle);
document.querySelector('.scene-actions').after(graphicLabel);
const graphicNodes={image:document.querySelector('[data-editor-panel="image"]'),text:document.querySelector('[data-editor-panel="text"]'),dialogue:$('dialogue-editor'),choices:document.querySelector('[data-editor-panel="choices"]'),answers:$('dialogue-choice-editor')};
const graphicAnchors={};for(const [key,node] of Object.entries(graphicNodes)){const anchor=document.createComment('editor-'+key);node.before(anchor);graphicAnchors[key]=anchor;}
const graphicLayout=el('section','graphic-layout');graphicLayout.hidden=true;$('editor-body').append(graphicLayout);
function graphicFold(id,title){
  const fold=el('details','graphic-fold');fold.id=id;const summary=el('summary','','Развернуть · '+title);fold.append(summary);
  fold.ontoggle=()=>{summary.textContent=(fold.open?'Свернуть':'Развернуть')+' · '+title;};return fold;
}
const graphicText=graphicFold('graphic-text','Текст сцены / реплика'),graphicChoices=graphicFold('graphic-choices','Варианты действий / ответы');
let graphicApplied=false,graphicOwner=null,graphicScene=null;
function updateGraphicMode(){
  const enabled=project.graphicMode===true;graphicToggle.checked=enabled;
  if(graphicOwner!==project||graphicScene!==selected||enabled!==graphicApplied){graphicText.open=false;graphicChoices.open=false;}
  if(enabled&&!graphicApplied){
    graphicText.append(graphicNodes.dialogue,graphicNodes.text);graphicChoices.append(graphicNodes.answers,graphicNodes.choices);
    graphicLayout.append(graphicNodes.image,graphicText,graphicChoices);
  }else if(!enabled&&graphicApplied){for(const [key,node] of Object.entries(graphicNodes))graphicAnchors[key].after(node);}
  graphicLayout.hidden=!enabled;graphicApplied=enabled;graphicOwner=project;graphicScene=selected;
  const dialogue=typeof scene==='function'&&!!scene()?.dialogue;
  const panels=typeof document.querySelectorAll==='function'?document.querySelectorAll('[data-editor-panel]'):[];
  for(const panel of panels){
    if(!panel.dataset)continue;
    if(panel.dataset.editorPanel==='image'){panel.hidden=!enabled;continue;}
    panel.hidden=dialogue;
  }
  if(graphicNodes.image)graphicNodes.image.hidden=!enabled;
}
graphicToggle.onchange=()=>{project.graphicMode=graphicToggle.checked;updateGraphicMode();if(typeof renderActorLayers==='function')renderActorLayers();save();};
