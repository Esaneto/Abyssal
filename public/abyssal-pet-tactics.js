/* Tactical priorities for the local Solo companion.
 * Pure deterministic selection, independently testable without the browser.
 */
(function(root,factory){
 const scale=typeof module==='object'&&module.exports?require('./creature-scale.js'):root.AbyssalCreatureScale;
 const api=factory(scale);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalPetTactics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(scale){
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
 function choose({mode,pet,player,enemies=[],orbs=[],collectionRange=300,attackRange=350,guardRange=255,routeCost=null,preferredOrbId=null,preferredEnemyId=null,preferredType=null}){
  mode=normalize(mode);
  if(!pet||!player)return {type:'follow',target:player||pet||{x:0,y:0}};
  const threats=enemies.filter(live);
  let orb=null,orbScore=Infinity,orbDistance=Infinity;
  for(const o of orbs){
   if(!o||!Number.isFinite(o.x)||!Number.isFinite(o.y))continue;
   if(distance(o,player)>collectionRange)continue;
   const d=distance(o,pet),cost=routeCost?routeCost(o):d;if(!Number.isFinite(cost))continue;
   // A nearby enemy may make a close orb less attractive than a safe one.
   const score=cost+orbRisk(o,pet,threats)*(mode==='passive'?3.4:1.25)-(o.id===preferredOrbId?(preferredType==='orb'?70:35):0);
   if(score<orbScore){orbScore=score;orbDistance=d;orb=o;}
  }
  let enemy=null,enemyDistance=Infinity;
  const preferred=preferredEnemyId==null?null:threats.find(e=>String(e.id)===String(preferredEnemyId));
  if(mode==='aggressive'){
   if(preferred){
    const d=distance(preferred,pet);
    if(d<attackRange*1.12){enemy=preferred;enemyDistance=d;}
   }
   for(const e of threats){
    const d=distance(e,pet);
    // Keep the current target unless a different threat is meaningfully closer.
    if(d<attackRange&&(!enemy||d<enemyDistance-Math.max(10,(Number(e.r)||10)*.55))){
     enemy=e;enemyDistance=d;
    }
   }
  }else if(mode==='guardian'){
   if(preferred){
    const d=distance(preferred,player);
    if(d<guardRange*1.10){enemy=preferred;enemyDistance=d;}
   }
   for(const e of threats){
    const distanceToPlayer=distance(e,player);
    if(distanceToPlayer<guardRange&&(!enemy||distanceToPlayer<enemyDistance-Math.max(10,(Number(e.r)||10)*.55))){
     enemy=e;enemyDistance=distanceToPlayer;
    }
   }
  }
  if(enemy){
   // Guardian always defends its radius. Aggressive keeps a committed fight stable
   // but may still collect a clearly safer/closer orb when not yet engaged.
   const committed=preferredType==='enemy'&&preferredEnemyId!=null&&String(enemy.id)===String(preferredEnemyId);
   const immediate=mode==='aggressive'&&distance(enemy,pet)<=Math.min(attackRange,130);
   if(mode==='guardian'||committed||immediate||!orb||enemyDistance<=orbDistance*(preferredType==='orb'?.90:1.10)){
    const front=frontlineTarget(pet,enemy,threats,mode,player,attackRange,guardRange);
    return {type:'enemy',target:front,enemy:front,mode};
   }
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
 function attackTargetRadius(enemy){
  const core=Math.max(1,Number(enemy.r)||1);
  const visual=scale?.monsterVisualRadius?.(enemy.kind,core,enemy.specimenSkinId)||core;
  return Math.max(core,visual*(enemy.kind==='whiteShark'||enemy.kind==='whiteSharkBoss'?1.32:0.9));
 }
 function limitApproach(from,to,enemy,min){
  const old=distance(from,enemy),next=distance(to,enemy);
  if(next>=min||next>=old)return to;
  if(old<=min)return {x:from.x,y:from.y};
  // Clip the segment at the first circle intersection, preserving its terrain-resolved path.
  const dx=to.x-from.x,dy=to.y-from.y,fx=from.x-enemy.x,fy=from.y-enemy.y,a=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-min*min;
  const t=a>0?Math.max(0,Math.min(1,(-b-Math.sqrt(Math.max(0,b*b-4*a*c)))/(2*a))):0;
  return {x:from.x+dx*t,y:from.y+dy*t};
 }
 function attackGoal(pet,enemy,profile,approachAngle=null){
  const dx=enemy.x-pet.x,dy=enemy.y-pet.y,d=Math.hypot(dx,dy);
  const directAngle=d>1e-6?Math.atan2(dy,dx):Number(pet.facingAngle)||0;
  const travelAngle=Number.isFinite(approachAngle)?approachAngle:directAngle;
  const er=attackTargetRadius(enemy);
  // Body contact is an ellipse, not a bite with extra slack. Stay inside its actual reach.
  // The previous goal sat on the outermost contact pixel. Tiny heading and
  // animation changes could make an Eco stop *outside* its actual hitbox.
  // The Kraken's animation is shorter than its theoretical maximum reach.
  const reliableReach=profile.kraken?Math.min(profile.reach,profile.r*1.95):profile.reach;
  const stop=Math.max(er+profile.core*.40,er+reliableReach-Math.max(3,profile.slack*(profile.body?.90:.75)));
  return {x:enemy.x-Math.cos(travelAngle)*stop,y:enemy.y-Math.sin(travelAngle)*stop,angle:directAngle,approachAngle:travelAngle,stop,distance:d};
 }
 // A creature in a valid strike envelope must hold its position while aiming
 // or waiting for cadence. Local avoidance must not push it away between bites.
 function attackStance(pet,enemy,profile){
  if(!pet||!enemy||!profile)return false;
  const d=distance(pet,enemy),ideal=attackGoal(pet,enemy,profile).stop;
  const inner=attackTargetRadius(enemy)+Math.max(1,profile.core*.35);
  const outer=ideal+Math.max(4,profile.slack*1.5);
  return d>=inner&&d<=outer;
 }
 // If a selected enemy is behind other valid enemies, engage the frontline
 // blocker instead of trying to steer through the whole crowd.
 function frontlineTarget(pet,enemy,enemies,mode='aggressive',player=null,attackRange=350,guardRange=255){
  if(!pet||!enemy||mode==='passive')return enemy;
  const dx=enemy.x-pet.x,dy=enemy.y-pet.y,d=Math.hypot(dx,dy);
  if(d<Math.max(65,(Number(enemy.r)||12)*2.2))return enemy;
  const ux=dx/d,uy=dy/d;
  let blocker=null,bestAlong=Infinity;
  for(const e of enemies||[]){
   if(!live(e)||e===enemy||String(e.id)===String(enemy.id))continue;
   const ex=e.x-pet.x,ey=e.y-pet.y,along=ex*ux+ey*uy,lateral=Math.abs(ex*uy-ey*ux);
   const er=Math.max(4,Number(e.r)||12);
   if(along<=0||along>=d-er*.55||lateral>er+12)continue;
   if(mode==='guardian'&&(!player||distance(e,player)>guardRange))continue;
   if(mode==='aggressive'&&Math.hypot(ex,ey)>attackRange)continue;
   if(along<bestAlong){bestAlong=along;blocker=e;}
  }
  return blocker||enemy;
 }
 function attackContact(pet,enemy,p,angle,phase,krakenTouch){
  const er=attackTargetRadius(enemy),dx=enemy.x-pet.x,dy=enemy.y-pet.y,d=Math.hypot(dx,dy);
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
  const jawContact=Math.hypot(enemy.x-mouthX,enemy.y-mouthY)<=er+p.slack;
  // A target overlapping the Eco's FRONT body is already inside biting range.
  // Do not let a long visual jaw offset make close face-to-face hits impossible.
  const facing=dx*Math.cos(angle)+dy*Math.sin(angle);
  const bodyContact=d<=er+p.core*.85&&facing>=-p.core*.12;
  return jawContact||bodyContact;
 }
 return Object.freeze({MODES,normalize,choose,orbRisk,attackProfile,attackTargetRadius,limitApproach,attackGoal,attackStance,frontlineTarget,attackContact});
});
