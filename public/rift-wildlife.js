/* Rift ecology: deterministic awareness and patrol decisions, shared by browser and server.
 * Geometry uses the existing map's line-of-sight and collision resolution.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalRiftWildlife=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PREDATORS=new Set(['whiteShark','whiteSharkBoss','boss','angler','maw','leviathan','kraken','devourer','riftSmile']);
 const PREDATOR_SKINS=new Set(['kraken','angler','maw','leviathan','devourer','reefshark','hammerhead','goblin','frilled','greenland','gharial','saltcroc','blackcaiman','abysscroc','armoredgator','viperfish','blackdragon','dogtootheel','ribbonmoray','zebramoray','sawtootheel']);
 const DEFENSIVE_FAMILIES=new Set(['ray','jelly','mollusc','benthic','crustacean']);
 const SMART_SKINS=new Set(['dumbo','mimic','glassoctopus','blanket','phantomjelly','bigfin','jewelsquid','whiplash','eagleray','butterflyray','stingray','spidercrab']);
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function disposition(kind,skinId,family){
  if(PREDATORS.has(String(kind))||PREDATOR_SKINS.has(String(skinId))||['shark','reptile'].includes(family))return 'aggressive';
  if(SMART_SKINS.has(String(skinId))||['octopus','squid','eel'].includes(family))return 'smart';
  return DEFENSIVE_FAMILIES.has(family)||family==='fish'?'passive':'smart';
 }
 function health(kind,skinId,family){
  if(PREDATORS.has(String(kind))||PREDATOR_SKINS.has(String(skinId))||['shark','reptile'].includes(family))return 2100;
  return ['crustacean','mollusc','benthic'].includes(family)||kind==='brute'||kind==='lurker'?1200:600;
 }
 function canSee(entity,target,map,layout,range=530,halfAngle=Math.PI*.38){
  if(!entity||!target)return false;
  const dx=target.x-entity.x,dy=target.y-entity.y,d2=dx*dx+dy*dy;
  if(d2>range*range)return false;
  if(layout&&map?.segmentWalkable&&!map.segmentWalkable(layout,entity.x,entity.y,target.x,target.y,3))return false;
  if(d2<32*32)return true;
  const angle=Number(entity.angle)||0,delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-angle),Math.cos(Math.atan2(dy,dx)-angle));
  if(Math.abs(delta)>halfAngle)return false;
  return true;
 }
 function patrolGoal(enemy,room,seconds=0){
  if(!room)return {x:enemy.x,y:enemy.y};
  const seed=(Number(enemy.id)||1)*1.319+Number(room.depth||0)*.49;
  const t=seconds*.14+seed;
  const rx=Math.max(20,Number(room.rx)*.46),ry=Math.max(20,Number(room.ry)*.45);
  return {x:room.x+Math.cos(t)*rx,y:room.y+Math.sin(t*.82+seed*.1)*ry};
 }
 function decide(enemy,players,{map=null,layout=null,room=null,now=0,seconds=0,family='fish'}={}){
  const mode=disposition(enemy.kind,enemy.specimenSkinId,family);
  let visible=null,nearest=Infinity;
  for(const p of players||[]){
   if(!p||p.alive===false)continue;
   const dx=p.x-enemy.x,dy=p.y-enemy.y,d= Math.hypot(dx,dy);
   if(d<nearest&&canSee(enemy,p,map,layout)){visible=p;nearest=d;}
  }
  if(visible){enemy.lastSeenX=visible.x;enemy.lastSeenY=visible.y;enemy.lastSeenAt=now;}
  const provoked=(Number(enemy.provokedUntil)||0)>now;
  // Retaliation may turn around to face an aggressor, but cannot see through walls.
  if(provoked&&!visible){
    for(const p of players||[]){
      if(!p||p.alive===false)continue;
      const d=Math.hypot(p.x-enemy.x,p.y-enemy.y);
      if(d<620&&d<nearest&&(!layout||!map?.segmentWalkable||map.segmentWalkable(layout,enemy.x,enemy.y,p.x,p.y,3))){
        visible=p;nearest=d;
      }
    }
  }
  const endangered=(Number(enemy.hp)||0)<Math.max(1,Number(enemy.maxHp)||1)*.45;
  const flee=mode==='smart'&&visible&&(endangered||nearest<125||Number(enemy.hp)<Number(visible.hp||100)*.6);
  const chase=visible&&(mode==='aggressive'||provoked||mode==='smart'&&!flee);
  if(chase)return {mode:'attack',target:visible,alert:true};
  if(flee){
    const dx=enemy.x-visible.x,dy=enemy.y-visible.y,n=Math.hypot(dx,dy)||1;
    return {mode:'flee',target:{x:enemy.x+dx/n*250,y:enemy.y+dy/n*250,alive:true,moveSpeed:150},alert:true};
  }
  if(visible)return {mode:'alert',target:patrolGoal(enemy,room,seconds),alert:true};
  if(provoked&&now-Number(enemy.lastSeenAt||0)<2400&&Number.isFinite(enemy.lastSeenX))
   return {mode:'search',target:{x:enemy.lastSeenX,y:enemy.lastSeenY,alive:true,moveSpeed:150},alert:true};
  return {mode:'patrol',target:patrolGoal(enemy,room,seconds),alert:false};
 }
 return Object.freeze({disposition,health,canSee,patrolGoal,decide});
});
