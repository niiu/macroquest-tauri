(function(root){
  'use strict';
  function resolve(quest,owner,placement,create=false){
    if(!quest.scenes.includes(owner)||!owner.actors?.includes(placement))return null;
    if(owner.dialogue)return owner;
    const linked=quest.scenes.find(s=>s.id===placement.dialogue&&s.dialogue);
    if(linked||!create)return linked||null;
    if(quest.scenes.length>=500)throw Error('Максимум 500 сцен в одном квесте.');
    const npc=quest.characters?.find(c=>c.id===placement.character);
    const reply={id:'s'+crypto.randomUUID(),title:'Диалог: '+(npc?.name||'Персонаж'),speaker:npc?.name||'',text:'',dialogue:true,x:owner.x+280,y:owner.y,choices:[]};
    quest.scenes.push(reply);placement.dialogue=reply.id;return reply;
  }
  root.QuestActorDialogue={resolve};
  if(typeof module!=='undefined')module.exports=root.QuestActorDialogue;
})(typeof globalThis!=='undefined'?globalThis:this);
