(function(root){
  'use strict';
  const HOTKEY_GROUPS=[
    {id:'graph',label:'Граф'},
    {id:'scene',label:'Сцена'},
    {id:'files',label:'Просмотр и файлы'},
    {id:'tabs',label:'Разделы'}
  ];
  const HOTKEY_ACTIONS=[
    {id:'addNode',label:'Создать узел (меню)',group:'graph'},
    {id:'addScene',label:'Новая сцена',group:'graph'},
    {id:'addNote',label:'Новая заметка',group:'graph'},
    {id:'deleteNode',label:'Удалить выбранный узел',group:'graph'},
    {id:'undoDelete',label:'Вернуть удалённую сцену',group:'graph'},
    {id:'undoPath',label:'Вернуть отключённый путь',group:'graph'},
    {id:'chapters',label:'Главы',group:'graph'},
    {id:'groupToChapter',label:'Выделение в главу',group:'graph'},
    {id:'parameters',label:'Параметры квеста',group:'graph'},
    {id:'zoomIn',label:'Увеличить масштаб',group:'graph'},
    {id:'zoomOut',label:'Уменьшить масштаб',group:'graph'},
    {id:'zoomReset',label:'Масштаб 100%',group:'graph'},
    {id:'addChoice',label:'Добавить действие',group:'scene'},
    {id:'setStart',label:'Сделать начальной сценой',group:'scene'},
    {id:'closeEditor',label:'Закрыть редактор сцены',group:'scene'},
    {id:'toggleDock',label:'Редактор под графом',group:'scene'},
    {id:'play',label:'Пройти квест',group:'files'},
    {id:'exportHtml',label:'Экспорт HTML',group:'files'},
    {id:'exportJson',label:'Экспорт JSON',group:'files'},
    {id:'importJson',label:'Открыть JSON',group:'files'},
    {id:'tabEditor',label:'Вкладка: редактор',group:'tabs'},
    {id:'tabAtlas',label:'Вкладка: атлас',group:'tabs'},
    {id:'tabSettings',label:'Вкладка: настройки',group:'tabs'}
  ];
  const HOTKEY_DEFAULTS={
    addNode:'Shift+KeyA',
    addScene:'KeyA',
    addNote:'Shift+KeyN',
    deleteNode:'Delete',
    undoDelete:'Ctrl+KeyZ',
    undoPath:'Ctrl+Shift+KeyZ',
    chapters:'Ctrl+KeyG',
    groupToChapter:'Ctrl+Shift+KeyG',
    parameters:'Ctrl+Shift+KeyP',
    zoomIn:'Ctrl+Equal',
    zoomOut:'Ctrl+Minus',
    zoomReset:'Ctrl+Digit0',
    addChoice:'Ctrl+Enter',
    setStart:'Ctrl+Shift+KeyS',
    closeEditor:'Ctrl+KeyW',
    toggleDock:'Ctrl+Alt+KeyD',
    play:'Space',
    exportHtml:'Ctrl+KeyE',
    exportJson:'Ctrl+Shift+KeyE',
    importJson:'Ctrl+KeyO',
    tabEditor:'Ctrl+Digit1',
    tabAtlas:'Ctrl+Digit2',
    tabSettings:'Ctrl+Digit3'
  };
  const CODE_RE=/^Key[A-Z]$|^Digit[0-9]$|^Numpad[0-9]$|^F([1-9]|1[0-2])$|^Escape$|^Delete$|^Backspace$|^Space$|^Enter$|^Tab$|^Equal$|^Minus$|^NumpadAdd$|^NumpadSubtract$|^Arrow(Up|Down|Left|Right)$/;
  const KEY_LABELS={Equal:'=',Minus:'-',Space:'Space',Enter:'Enter',Delete:'Delete',Backspace:'Backspace',Tab:'Tab',Escape:'Esc',NumpadAdd:'Num+',NumpadSubtract:'Num-'};
  function parseHotkey(value){
    if(value===''||value===null)return {empty:true};
    if(typeof value!=='string'||!value.trim())return null;
    const parts=value.split('+').map(p=>p.trim()).filter(Boolean);
    if(!parts.length)return null;
    const code=parts[parts.length-1];
    if(!CODE_RE.test(code))return null;
    const mods=new Set(parts.slice(0,-1).map(m=>({Control:'Ctrl',Ctrl:'Ctrl',Alt:'Alt',Shift:'Shift',Meta:'Meta',Cmd:'Meta',Command:'Meta'})[m]).filter(Boolean));
    return {ctrl:mods.has('Ctrl'),alt:mods.has('Alt'),shift:mods.has('Shift'),meta:mods.has('Meta'),code};
  }
  function formatHotkey(binding){
    if(binding===''||binding===null)return '—';
    const parsed=typeof binding==='string'?parseHotkey(binding):binding;
    if(!parsed||parsed.empty)return '—';
    const parts=[];
    if(parsed.ctrl)parts.push('Ctrl');
    if(parsed.alt)parts.push('Alt');
    if(parsed.shift)parts.push('Shift');
    if(parsed.meta)parts.push('Meta');
    const code=parsed.code;
    const key=KEY_LABELS[code]||(code.startsWith('Key')?code.slice(3):code.startsWith('Digit')?code.slice(5):code.startsWith('Numpad')&&/^\d$/.test(code.slice(6))?code.slice(6):code);
    parts.push(key);
    return parts.join('+');
  }
  function serializeHotkey(parsed){
    if(!parsed||parsed.empty)return '';
    const parts=[];
    if(parsed.ctrl)parts.push('Ctrl');
    if(parsed.alt)parts.push('Alt');
    if(parsed.shift)parts.push('Shift');
    if(parsed.meta)parts.push('Meta');
    parts.push(parsed.code);
    return parts.join('+');
  }
  function fromEvent(e){
    if(!e||typeof e.code!=='string')return null;
    if(['ControlLeft','ControlRight','ShiftLeft','ShiftRight','AltLeft','AltRight','MetaLeft','MetaRight'].includes(e.code))return null;
    let code=e.code;
    if(code==='NumpadAdd')code='NumpadAdd';
    if(code==='NumpadSubtract')code='NumpadSubtract';
    if(!CODE_RE.test(code))return null;
    return {ctrl:!!e.ctrlKey,alt:!!e.altKey,shift:!!e.shiftKey,meta:!!e.metaKey,code};
  }
  function matchHotkey(e,binding){
    if(!binding)return false;
    const want=typeof binding==='string'?parseHotkey(binding):binding;
    const got=fromEvent(e);
    if(!want||want.empty||!got)return false;
    return got.code===want.code&&got.ctrl===want.ctrl&&got.alt===want.alt&&got.shift===want.shift&&got.meta===want.meta;
  }
  function normalizeHotkeys(raw={}){
    const out={};
    for(const action of HOTKEY_ACTIONS){
      if(raw&&Object.prototype.hasOwnProperty.call(raw,action.id)&&raw[action.id]===''){out[action.id]='';continue;}
      const parsed=parseHotkey(raw&&raw[action.id]);
      if(parsed&&!parsed.empty)out[action.id]=serializeHotkey(parsed);
      else out[action.id]=HOTKEY_DEFAULTS[action.id]||'';
    }
    return out;
  }
  function findConflict(hotkeys,actionId,binding){
    const serialized=typeof binding==='string'?serializeHotkey(parseHotkey(binding)):serializeHotkey(binding);
    if(!serialized)return null;
    for(const action of HOTKEY_ACTIONS){
      if(action.id===actionId)continue;
      if(hotkeys[action.id]===serialized)return action.id;
    }
    return null;
  }
  const api={HOTKEY_GROUPS,HOTKEY_ACTIONS,HOTKEY_DEFAULTS,parseHotkey,formatHotkey,serializeHotkey,fromEvent,matchHotkey,normalizeHotkeys,findConflict};
  if(typeof module!=='undefined')module.exports=api;else root.QuestHotkeys=api;
})(globalThis);
