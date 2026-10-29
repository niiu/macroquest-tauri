'use strict';
function hotkeyPointer(){
  return (typeof graphPointerOver!=='undefined'&&graphPointerOver&&typeof lastGraphPointer!=='undefined'&&lastGraphPointer)
    ?lastGraphPointer:graphViewportCenterClient();
}
function clickIfReady(id){
  const node=$(id);if(!node||node.disabled||node.hidden)return false;node.click();return true;
}
function runEditorHotkey(id){
  const point=hotkeyPointer(),s=typeof scene==='function'?scene():null;
  switch(id){
    case 'addNode':openAddNodeMenu(point.x,point.y);return true;
    case 'addScene':createSceneAt(point.x,point.y);return true;
    case 'addNote':createNoteAt(point.x,point.y);return true;
    case 'deleteNode':
      if(!selected||!project.scenes.some(n=>n.id===selected))return false;
      if(typeof deleteScene==='function'){deleteScene(selected);return true;}
      return clickIfReady('delete-scene');
    case 'undoDelete':
      if(typeof undoScene==='undefined'||undoScene.hidden)return false;
      undoScene.click();return true;
    case 'undoPath':
      if(typeof undoDisconnect==='undefined'||undoDisconnect.hidden)return false;
      undoDisconnect.click();return true;
    case 'chapters':
      if(typeof openChapters==='function'){openChapters(project.chapters?.[0]?.id);return true;}
      return clickIfReady('manage-chapters');
    case 'groupToChapter':
      if(typeof groupSelection==='undefined'||groupSelection.disabled)return false;
      groupSelection.click();return true;
    case 'parameters':return clickIfReady('quest-parameters');
    case 'zoomIn':setZoom(zoom+.1);return true;
    case 'zoomOut':setZoom(zoom-.1);return true;
    case 'zoomReset':setZoom(1);return true;
    case 'addChoice':
      if(!s||QuestService.isService(s))return false;
      return clickIfReady('add-choice');
    case 'setStart':
      if(!s||QuestService.isService(s)||$('set-start').disabled)return false;
      return clickIfReady('set-start');
    case 'closeEditor':
      if($('scene-dialog')?.open)$('scene-dialog').close();
      else if(typeof closeSceneEditor==='function')closeSceneEditor();
      else clickIfReady('close-scene-editor');
      return true;
    case 'toggleDock':
      if($('dock-editor').disabled)return false;
      $('dock-editor').checked=!$('dock-editor').checked;
      $('dock-editor').dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    case 'play':return clickIfReady('play');
    case 'exportHtml':return clickIfReady('export-html');
    case 'exportJson':return clickIfReady('export');
    case 'importJson':return clickIfReady('import');
    case 'tabEditor':showWorkspace('editor');return true;
    case 'tabAtlas':showWorkspace('atlas');return true;
    case 'tabSettings':showWorkspace('settings');return true;
    default:return false;
  }
}
function hotkeyAllowedEverywhere(id){return id==='tabEditor'||id==='tabAtlas'||id==='tabSettings';}
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.repeat)return;
  if(typeof captureHotkeyAction!=='undefined'&&captureHotkeyAction)return;
  if(e.target?.closest?.('input,textarea,select,[contenteditable=true]'))return;
  const bindings=editorSettings?.hotkeys||QuestHotkeys.HOTKEY_DEFAULTS;
  for(const action of QuestHotkeys.HOTKEY_ACTIONS){
    const binding=bindings[action.id];
    if(!binding||!QuestHotkeys.matchHotkey(e,binding))continue;
    if(!hotkeyAllowedEverywhere(action.id)){
      if(document.querySelector('.workspace')?.hidden)return;
      if(document.querySelector('dialog[open]'))return;
    }
    e.preventDefault();
    runEditorHotkey(action.id);
    return;
  }
});
