/* Tactical priorities for the local Solo companion.
 * Pure deterministic selection, independently testable without the browser.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalPetTactics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MODES=Object.freeze(['passive','aggressive','guardian']);
 const normalize=mode=>MODES.includes(mode)?mode:'passive';
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const live=e=>e&&Number(e.hp)>0&&Number.isFinite(e.x)&&Number.isFinite(e.y);
 function orbRisk(orb,origin,enemies){
  let cost=0;
  for(const e of enemies){
   if(!live(e))continue;
   const near=Math.min(distance(orb,e),distance({x:(orb.x+origin.x)/2,y:(orb.y+origin.y)/2},e));
   const danger=Math.max(35,Number(e.r)||12)+45;
   if(near<danger*2.5)cost+=Math.max(0,(danger*2.5-near))*2.8;
  }
  return cost;
 }
 function choose({mode,pet,player,enemies=[],orbs=[],collectionRange=300,attackRange=350,guardRange=255,routeCost=null,preferredOrbId=null}){
  mode=normalize(mode);
  if(!pet||!player)return {type:'follow',target:player||pet||{x:0,y:0}};
  const threats=enemies.filter(live);
  let orb=null,orbScore=Infinity,orbDistance=Infinity;
  for(const o of orbs){
   if(!o||!Number.isFinite(o.x)||!Number.isFinite(o.y))continue;
   if(distance(o,player)>collectionRange)continue;
   const d=distance(o,pet),cost=routeCost?routeCost(o):d;if(!Number.isFinite(cost))continue;
   // A nearby enemy may make a close orb less attractive than a safe one.
   const score=cost+orbRisk(o,pet,threats)*(mode==='passive'?3.4:1.25)-(o.id===preferredOrbId?35:0);
   if(score<orbScore){orbScore=score;orbDistance=d;orb=o;}
  }
  let enemy=null,enemyDistance=Infinity;
  if(mode==='aggressive'){
   for(const e of threats){
    const d=distance(e,pet);
    if(d<attackRange&&d<enemyDistance){enemy=e;enemyDistance=d;}
   }
  }else if(mode==='guardian'){
   for(const e of threats){
    const distanceToPlayer=distance(e,player);
    if(distanceToPlayer<guardRange&&distanceToPlayer<enemyDistance){
     enemy=e;enemyDistance=distanceToPlayer;
    }
   }
  }
  if(enemy){
   // Aggressive pet makes a proximity choice between a threat and reachable XP.
   // Guardian treats the protected area as the highest priority.
   if(mode==='guardian'||!orb||enemyDistance<=orbDistance*1.15)
    return {type:'enemy',target:enemy,enemy,mode};
  }
  if(orb)return {type:'orb',target:orb,orb,mode};
  return {type:'follow',target:{x:player.x,y:player.y-35},mode};
 }
 // Attack geometry uses the same visual radius as the equipped specimen.
 function attackProfile(id,family,r){
  r=Math.max(1,Number(r)||1);
  const body=['octopus','squid','jelly','ray','crustacean','benthic'].includes(family);
  const kraken=id==='kraken';
  const reach=kraken?3.1*r:body?(['octopus','squid','jelly'].includes(family)?1.8:1.25)*r:(family==='eel'?1.65:family==='reptile'?1.55:1.15)*r;
  return {body,kraken,r,reach,core:Math.max(1,r*.65),slack:Math.max(3,r*.13)};
 }
 function attackGoal(pet,enemy,profile,approachAngle=null){
  const dx=enemy.x-pet.x,dy=enemy.y-pet.y,d=Math.hypot(dx,dy);
  const directAngle=d>1e-6?Math.atan2(dy,dx):Number(pet.facingAngle)||0;
  const travelAngle=Number.isFinite(approachAngle)?approachAngle:directAngle;
  const er=Math.max(1,Number(enemy.r)||1);
  const stop=er+profile.reach+profile.slack*.35;
  return {x:enemy.x-Math.cos(travelAngle)*stop,y:enemy.y-Math.sin(travelAngle)*stop,angle:directAngle,approachAngle:travelAngle,stop,distance:d};
 }
 function attackContact(pet,enemy,p,angle,phase,krakenTouch){
  const er=Math.max(1,Number(enemy.r)||1),dx=enemy.x-pet.x,dy=enemy.y-pet.y,d=Math.hypot(dx,dy);
  if(p.kraken){
   if(d>p.r*5.2+er)return false;
   // Use actual animated arm paths, plus mantle/core.
   const localX=dx*Math.cos(angle)+dy*Math.sin(angle),localY=-dx*Math.sin(angle)+dy*Math.cos(angle);
   const mantle=(localX/(p.r*.82+er))**2+((localY+p.r*.55)/(p.r*1.18+er))**2<=1;
   return mantle||Boolean(krakenTouch?.({kind:'kraken',x:pet.x,y:pet.y,r:p.r,angle,phase},enemy,1));
  }
  if(p.body){
   const x=dx*Math.cos(angle)+dy*Math.sin(angle),y=-dx*Math.sin(angle)+dy*Math.cos(angle);
   const rx=p.reach+er,ry=p.reach*.78+er;
   return (x/rx)**2+(y/ry)**2<=1;
  }
  const mouthX=pet.x+Math.cos(angle)*p.reach,mouthY=pet.y+Math.sin(angle)*p.reach;
  return Math.hypot(enemy.x-mouthX,enemy.y-mouthY)<=er+p.slack;
 }
 return Object.freeze({MODES,normalize,choose,orbRisk,attackProfile,attackGoal,attackContact});
});
