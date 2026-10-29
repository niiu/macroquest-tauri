(function(root){
  'use strict';
  function validate(project){
    if(project.chapters!==undefined&&(!Array.isArray(project.chapters)||project.chapters.length>500))throw Error('Допускается до 500 глав.');
    const ids=new Set();
    for(const c of project.chapters||[]){
      if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.title!=='string'||!c.title.trim()||c.title.length>100||typeof c.collapsed!=='boolean')throw Error('Некорректная глава.');
      ids.add(c.id);
    }
    for(const s of project.scenes)if(s.chapter!==undefined&&!ids.has(s.chapter))throw Error('Сцена ссылается на отсутствующую главу.');
  }
  const members=(p,c)=>p.scenes.filter(s=>s.chapter===c.id);
  function bounds(p,c,height=()=>154){
    const list=members(p,c);if(!list.length)return null;
    const x=Math.min(...list.map(s=>s.x)),y=Math.min(...list.map(s=>s.y));
    return {x,y,width:Math.max(...list.map(s=>s.x+220))-x,height:Math.max(...list.map(s=>s.y+height(s)))-y};
  }
  function frameRect(p,c,height=()=>154){
    const box=bounds(p,c,height);if(!box)return null;
    if(c.collapsed){
      const list=members(p,c);
      return {x:box.x,y:box.y,width:220,height:Math.max(154,...list.map(s=>height(s)))};
    }
    return {x:Math.max(0,box.x-14),y:Math.max(0,box.y-42),width:box.width+28,height:box.height+56};
  }
  function atPoint(p,x,y,height=()=>154){
    let hit=null;
    for(const c of p.chapters||[]){
      if(c.collapsed)continue;
      const f=frameRect(p,c,height);if(!f)continue;
      if(x>=f.x&&x<=f.x+f.width&&y>=f.y&&y<=f.y+f.height)hit=c;
    }
    return hit;
  }
  function move(p,c,dx,dy){
    if(!dx&&!dy)return;
    for(const s of members(p,c)){s.x+=dx;s.y+=dy;}
  }
  function proxy(p,s){
    const chapter=p.chapters?.find(c=>c.id===s.chapter&&c.collapsed);if(!chapter)return s;
    const box=bounds(p,chapter);return {...s,id:'chapter:'+chapter.id,x:box.x,y:box.y};
  }
  function internal(p,s,t){const a=proxy(p,s),b=proxy(p,t);return a.id===b.id&&a.id!==s.id;}
  function remove(p,id){p.chapters=(p.chapters||[]).filter(c=>c.id!==id);for(const s of p.scenes)if(s.chapter===id)delete s.chapter;}
  const api={validate,members,bounds,frameRect,atPoint,move,proxy,internal,remove};root.QuestChapters=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
