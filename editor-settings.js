'use strict';
const settingsDefaults={base:14,step:3,medium:true,large:true,theme:'forest'};
function normalizeEditorSettings(raw={}){
  const number=(value,fallback,min,max)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,Math.round(value))):fallback;
  return {base:number(raw.base,14,10,24),step:number(raw.step,3,0,8),medium:typeof raw.medium==='boolean'?raw.medium:true,large:typeof raw.large==='boolean'?raw.large:true,theme:['forest','night','plum'].includes(raw.theme)?raw.theme:'forest'};
}
function editorFontSizes(s){const medium=s.base+(s.medium?s.step:0);return {base:s.base,medium,large:medium+(s.large?s.step:0)};}
function editorNodeHeight(){const sizes=editorFontSizes(editorSettings);return Math.ceil(70+sizes.base*4.5+sizes.medium*2.4);}
let editorSettings={...settingsDefaults};
try{editorSettings=normalizeEditorSettings(JSON.parse(localStorage.getItem('macroquest.editor-settings')||'{}')||{});}catch(e){}
const settingsTab=button('Настройки',()=>showWorkspace('settings'));tabs.append(settingsTab);settingsTab.setAttribute('aria-pressed','false');
const settingsPanel=el('section','settings-workspace');settingsPanel.hidden=true;
settingsPanel.innerHTML=`<h1>Настройки редактора</h1><p>Общие для всех квестов на этом устройстве.</p><form id="settings-form"><fieldset><legend>Размеры шрифта</legend><label class="field">Базовый размер, px<input id="font-base" type="number" min="10" max="24" step="1" required></label><label class="field">Шаг, px<input id="font-step" type="number" min="0" max="8" step="1" required></label><label class="toggle"><input id="font-medium" type="checkbox"> Средний — базовый + шаг</label><label class="toggle"><input id="font-large" type="checkbox"> Большой — средний + шаг</label><p class="hint">Без отметки используется размер предыдущего уровня. Базовый — текст и поля; средний — подзаголовки; большой — заголовки разделов.</p><div class="font-preview"><p id="font-preview-base"></p><h3 id="font-preview-medium"></h3><h1 id="font-preview-large"></h1></div></fieldset><fieldset><legend>Цветовая схема</legend><label class="field">Тема<select id="editor-theme"><option value="forest">Лесная</option><option value="night">Ночная синяя</option><option value="plum">Сливовая</option></select></label></fieldset><button type="submit" class="primary">Применить</button> <button type="button" id="settings-reset">По умолчанию</button><p id="settings-status" role="status"></p></form>`;
atlasPanel.after(settingsPanel);
function fillEditorSettings(){for(const key of ['base','step'])$('font-'+key).value=editorSettings[key];for(const key of ['medium','large'])$('font-'+key).checked=editorSettings[key];$('editor-theme').value=editorSettings.theme;}
function applyEditorSettings(){const sizes=editorFontSizes(editorSettings),root=document.documentElement;root.dataset.editorTheme=editorSettings.theme;
  for(const key of ['base','medium','large']){root.style.setProperty('--font-'+key,sizes[key]+'px');$('font-preview-'+key).textContent=({base:'Основной текст',medium:'Подзаголовок',large:'Заголовок'})[key]+' · '+sizes[key]+' px';}
}
function storeEditorSettings(){applyEditorSettings();try{localStorage.setItem('macroquest.editor-settings',JSON.stringify(editorSettings));$('settings-status').textContent='Настройки сохранены.';}catch(e){$('settings-status').textContent='Настройки применены, но сохранить их на устройстве не удалось.';}}
$('settings-form').onsubmit=e=>{e.preventDefault();if(!$('settings-form').reportValidity())return;editorSettings=normalizeEditorSettings({base:Number($('font-base').value),step:Number($('font-step').value),medium:$('font-medium').checked,large:$('font-large').checked,theme:$('editor-theme').value});storeEditorSettings();};
$('settings-reset').onclick=()=>{editorSettings={...settingsDefaults};fillEditorSettings();storeEditorSettings();};
fillEditorSettings();applyEditorSettings();
