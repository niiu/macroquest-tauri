'use strict';
const settingsDefaults={base:14,step:3,medium:true,large:true,theme:'forest',hotkeys:QuestHotkeys.normalizeHotkeys()};
function normalizeEditorSettings(raw={}){
  const number=(value,fallback,min,max)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,Math.round(value))):fallback;
  return {
    base:number(raw.base,14,10,24),
    step:number(raw.step,3,0,8),
    medium:typeof raw.medium==='boolean'?raw.medium:true,
    large:typeof raw.large==='boolean'?raw.large:true,
    theme:['forest','night','plum'].includes(raw.theme)?raw.theme:'forest',
    hotkeys:QuestHotkeys.normalizeHotkeys(raw.hotkeys||{})
  };
}
function editorFontSizes(s){const medium=s.base+(s.medium?s.step:0);return {base:s.base,medium,large:medium+(s.large?s.step:0)};}
function editorNodeHeight(){const sizes=editorFontSizes(editorSettings);return Math.ceil(70+sizes.base*4.5+sizes.medium*2.4);}
var editorSettings={...settingsDefaults,hotkeys:{...settingsDefaults.hotkeys}};
try{editorSettings=normalizeEditorSettings(JSON.parse(localStorage.getItem('macroquest.editor-settings')||'{}')||{});}catch(e){}
var captureHotkeyAction=null,settingsTabName='look';
const settingsTab=button('Настройки',()=>showWorkspace('settings'));tabs.append(settingsTab);settingsTab.setAttribute('aria-pressed','false');
const settingsPanel=el('section','settings-workspace');settingsPanel.hidden=true;
settingsPanel.innerHTML=`<h1>Настройки редактора</h1><p>Общие для всех квестов на этом устройстве.</p>
<nav class="settings-tabs" aria-label="Разделы настроек">
  <button type="button" id="settings-tab-look" aria-pressed="true">Внешний вид</button>
  <button type="button" id="settings-tab-hotkeys" aria-pressed="false">Горячие клавиши</button>
</nav>
<form id="settings-form">
  <div id="settings-look">
    <fieldset><legend>Размеры шрифта</legend>
      <label class="field">Базовый размер, px<input id="font-base" type="number" min="10" max="24" step="1" required></label>
      <label class="field">Шаг, px<input id="font-step" type="number" min="0" max="8" step="1" required></label>
      <label class="toggle"><input id="font-medium" type="checkbox"> Средний — базовый + шаг</label>
      <label class="toggle"><input id="font-large" type="checkbox"> Большой — средний + шаг</label>
      <p class="hint">Без отметки используется размер предыдущего уровня. Базовый — текст и поля; средний — подзаголовки; большой — заголовки разделов.</p>
      <div class="font-preview"><p id="font-preview-base"></p><h3 id="font-preview-medium"></h3><h1 id="font-preview-large"></h1></div>
    </fieldset>
    <fieldset><legend>Цветовая схема</legend>
      <label class="field">Тема<select id="editor-theme"><option value="forest">Лесная</option><option value="night">Ночная синяя</option><option value="plum">Сливовая</option></select></label>
    </fieldset>
  </div>
  <div id="settings-hotkeys" hidden>
    <p class="hint">Нажмите «Назначить» и затем нужную комбинацию. Escape отменяет запись. «Очистить» снимает клавишу с действия. Не работают в полях ввода и при открытых диалогах.</p>
    <div id="hotkeys-list" class="hotkeys-list"></div>
  </div>
  <button type="submit" class="primary">Применить</button>
  <button type="button" id="settings-reset">По умолчанию</button>
  <p id="settings-status" role="status"></p>
</form>`;
atlasPanel.after(settingsPanel);
function showSettingsTab(name){
  settingsTabName=name==='hotkeys'?'hotkeys':'look';
  $('settings-look').hidden=settingsTabName!=='look';
  $('settings-hotkeys').hidden=settingsTabName!=='hotkeys';
  $('settings-tab-look').setAttribute('aria-pressed',String(settingsTabName==='look'));
  $('settings-tab-hotkeys').setAttribute('aria-pressed',String(settingsTabName==='hotkeys'));
  if(settingsTabName!=='hotkeys')cancelHotkeyCapture();
}
$('settings-tab-look').onclick=()=>showSettingsTab('look');
$('settings-tab-hotkeys').onclick=()=>showSettingsTab('hotkeys');
function cancelHotkeyCapture(){
  if(!captureHotkeyAction)return;
  captureHotkeyAction=null;
  document.removeEventListener('keydown',onHotkeyCapture,true);
  renderHotkeysList();
}
function onHotkeyCapture(e){
  if(!captureHotkeyAction)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(e.key==='Escape'){$('settings-status').textContent='Назначение отменено.';cancelHotkeyCapture();return;}
  const parsed=QuestHotkeys.fromEvent(e);
  if(!parsed)return;
  const serialized=QuestHotkeys.serializeHotkey(parsed);
  const conflict=QuestHotkeys.findConflict(editorSettings.hotkeys,captureHotkeyAction,serialized);
  if(conflict){
    const label=QuestHotkeys.HOTKEY_ACTIONS.find(a=>a.id===conflict)?.label||conflict;
    $('settings-status').textContent='Комбинация уже занята: '+label+'.';
    return;
  }
  editorSettings.hotkeys={...editorSettings.hotkeys,[captureHotkeyAction]:serialized};
  $('settings-status').textContent='Назначено: '+QuestHotkeys.formatHotkey(serialized)+'.';
  cancelHotkeyCapture();
  storeEditorSettings(false);
  if(typeof refreshAddNodeHint==='function')refreshAddNodeHint();
}
function renderHotkeysList(){
  const host=$('hotkeys-list');host.replaceChildren();
  for(const group of QuestHotkeys.HOTKEY_GROUPS){
    const box=el('fieldset','hotkey-group');box.append(el('legend','',group.label));
    for(const action of QuestHotkeys.HOTKEY_ACTIONS.filter(a=>a.group===group.id)){
      const row=el('div','hotkey-row');
      row.append(el('span','hotkey-label',action.label));
      const value=el('span','hotkey-value mono',captureHotkeyAction===action.id?'Нажмите клавиши…':QuestHotkeys.formatHotkey(editorSettings.hotkeys[action.id]));
      const assign=el('button','','Назначить');assign.type='button';
      assign.onclick=()=>{
        cancelHotkeyCapture();
        captureHotkeyAction=action.id;
        $('settings-status').textContent='Ожидание сочетания для «'+action.label+'»…';
        document.addEventListener('keydown',onHotkeyCapture,true);
        renderHotkeysList();
      };
      const reset=el('button','quiet','Сбросить');reset.type='button';
      reset.onclick=()=>{
        cancelHotkeyCapture();
        editorSettings.hotkeys={...editorSettings.hotkeys,[action.id]:QuestHotkeys.HOTKEY_DEFAULTS[action.id]};
        storeEditorSettings(false);
        if(typeof refreshAddNodeHint==='function')refreshAddNodeHint();
        $('settings-status').textContent='Сочетание сброшено.';
        renderHotkeysList();
      };
      const clear=el('button','quiet','Очистить');clear.type='button';
      clear.onclick=()=>{
        cancelHotkeyCapture();
        editorSettings.hotkeys={...editorSettings.hotkeys,[action.id]:''};
        storeEditorSettings(false);
        if(typeof refreshAddNodeHint==='function')refreshAddNodeHint();
        $('settings-status').textContent='Сочетание очищено.';
        renderHotkeysList();
      };
      row.append(value,assign,reset,clear);box.append(row);
    }
    host.append(box);
  }
}
function fillEditorSettings(){
  for(const key of ['base','step'])$('font-'+key).value=editorSettings[key];
  for(const key of ['medium','large'])$('font-'+key).checked=editorSettings[key];
  $('editor-theme').value=editorSettings.theme;
  renderHotkeysList();
}
function applyEditorSettings(){
  const sizes=editorFontSizes(editorSettings),root=document.documentElement;root.dataset.editorTheme=editorSettings.theme;
  for(const key of ['base','medium','large']){root.style.setProperty('--font-'+key,sizes[key]+'px');$('font-preview-'+key).textContent=({base:'Основной текст',medium:'Подзаголовок',large:'Заголовок'})[key]+' · '+sizes[key]+' px';}
  if(typeof refreshAddNodeHint==='function')refreshAddNodeHint();
}
function storeEditorSettings(announce=true){
  applyEditorSettings();
  try{
    localStorage.setItem('macroquest.editor-settings',JSON.stringify(editorSettings));
    if(announce)$('settings-status').textContent='Настройки сохранены.';
  }catch(e){
    if(announce)$('settings-status').textContent='Настройки применены, но сохранить их на устройстве не удалось.';
  }
}
$('settings-form').onsubmit=e=>{
  e.preventDefault();
  if(!$('settings-form').reportValidity())return;
  cancelHotkeyCapture();
  editorSettings=normalizeEditorSettings({
    base:Number($('font-base').value),
    step:Number($('font-step').value),
    medium:$('font-medium').checked,
    large:$('font-large').checked,
    theme:$('editor-theme').value,
    hotkeys:editorSettings.hotkeys
  });
  storeEditorSettings(true);
};
$('settings-reset').onclick=()=>{
  cancelHotkeyCapture();
  editorSettings=normalizeEditorSettings({...settingsDefaults,hotkeys:QuestHotkeys.normalizeHotkeys()});
  fillEditorSettings();
  storeEditorSettings(true);
};
fillEditorSettings();applyEditorSettings();
