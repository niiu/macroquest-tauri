'use strict';
if(globalThis.__TAURI__){
  const devButton=document.createElement('button');devButton.textContent='Консоль';devButton.id='developer-console';devButton.title='Консоль разработчика · F12 / Ctrl+Shift+I';
  const toggle=()=>__TAURI__.core.invoke('toggle_devtools').catch(error=>{console.error(error);alert('Консоль не открылась: '+error);});
  devButton.onclick=toggle;document.querySelector('.topbar').append(devButton);
  window.addEventListener('keydown',e=>{if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&e.code==='KeyI')){e.preventDefault();toggle();}});
}
window.addEventListener('unhandledrejection',e=>console.error('Ошибка операции:',e.reason));
