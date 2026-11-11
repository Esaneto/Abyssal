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
 function choose({mode,pet,player,enemies=[],orbs=[],collectionRange=300,attackRange=350,guardRange=255}){
  mode=normalize(mode);
  if(!pet||!player)return {type:'follow',target:player||pet||{x:0,y:0}};
  const threats=enemies.filter(live);
  let orb=null,orbScore=Infinity,orbDistance=Infinity;
  for(const o of orbs){
   if(!o||!Number.isFinite(o.x)||!Number.isFinite(o.y))continue;
   if(distance(o,player)>collectionRange)continue;
   const d=distance(o,pet);
   // A nearby enemy may make a close orb less attractive than a safe one.
   const score=d+orbRisk(o,pet,threats)*(mode==='passive'?3.4:1.25);
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
 return Object.freeze({MODES,normalize,choose,orbRisk});
});
