/* Local pointer gesture: no native HTML/WebView drag-and-drop involved. */
(function(root){
  'use strict';
  function bind(element,handlers){
    let active=null;
    const end=(event,cancelled)=>{
      if(!active||event.pointerId!==undefined&&event.pointerId!==active.id)return;
      const gesture=active;active=null;
      window.removeEventListener('keydown',escape);
      window.removeEventListener('blur',blur);
      if(element.hasPointerCapture(gesture.id))element.releasePointerCapture(gesture.id);
      if(gesture.started)(cancelled?handlers.cancel:handlers.end)?.(event);
    };
    const escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();end(e,true);}};
    const blur=e=>end(e,true);
    element.addEventListener('pointerdown',e=>{
      if(active||e.button!==0||e.isPrimary===false||handlers.canStart?.(e)===false)return;
      e.preventDefault();e.stopPropagation();
      active={id:e.pointerId,x:e.clientX,y:e.clientY,started:false};
      element.setPointerCapture(e.pointerId);
      window.addEventListener('keydown',escape);
      window.addEventListener('blur',blur);
    });
    element.addEventListener('pointermove',e=>{
      if(!active||e.pointerId!==active.id)return;
      if(!active.started){
        if(Math.hypot(e.clientX-active.x,e.clientY-active.y)<5)return;
        active.started=true;handlers.start?.(e);
      }
      handlers.move?.(e);
    });
    element.addEventListener('pointerup',e=>end(e,false));
    element.addEventListener('pointercancel',e=>end(e,true));
    element.addEventListener('lostpointercapture',e=>end(e,true));
    element.addEventListener('dragstart',e=>e.preventDefault());
    return ()=>end({},true);
  }
  root.QuestPointerDrag={bind};
  if(typeof module!=='undefined')module.exports=root.QuestPointerDrag;
})(typeof globalThis!=='undefined'?globalThis:this);
