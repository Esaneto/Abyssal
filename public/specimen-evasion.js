(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalSpecimenEvasion=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 function risk(x,y,enemies,radius,clearance=28){
  let score=0;
  for(const enemy of enemies||[]){
   if(!enemy||Number(enemy.hp)<=0)continue;
   const safe=Math.max(3,Number(enemy.r)||8)+radius+clearance;
   const distance=Math.hypot(x-enemy.x,y-enemy.y);
   if(distance<safe)score+=260+(safe-distance)*15;
   else if(distance<safe*2.25)score+=((safe*2.25-distance)/safe)**2*55;
  }
  return score;
 }
 function threatsNear(x,y,enemies,range=235,maxCount=16){
  const nearest=[];
  for(const enemy of enemies||[]){
   if(!enemy||Number(enemy.hp)<=0)continue;
   const d=Math.hypot((Number(enemy.x)||0)-x,(Number(enemy.y)||0)-y);
   if(d>range+Math.max(10,Number(enemy.r)||10))continue;
   nearest.push({enemy,d});
  }
  nearest.sort((a,b)=>a.d-b.d);
  return nearest.slice(0,maxCount).map(entry=>entry.enemy);
 }
 function bestOrb(position,orbs,player,acquisitionRange,enemies,radius,clearance=28){
  let best=null,bestScore=Infinity;
  for(const orb of orbs||[]){
   if(!orb)continue;
   if(Math.hypot(orb.x-player.x,orb.y-player.y)>acquisitionRange)continue;
   const d=Math.hypot(orb.x-position.x,orb.y-position.y);
   const close=threatsNear(orb.x,orb.y,enemies,radius+clearance+80,10);
   const danger=risk(orb.x,orb.y,close,radius,clearance);
   // A dangerous orb waits until the player clears its guardians.
   if(danger>180)continue;
   const score=d+danger*.6;
   if(score<bestScore){bestScore=score;best=orb;}
  }
  return best;
 }
 function steer({position,target,enemies=[],speed=100,dt=.05,radius=10,clearance=28,heading=0,resolve=null}){
  const x=Number(position?.x)||0,y=Number(position?.y)||0;
  const gx=Number(target?.x)||x,gy=Number(target?.y)||y;
  const distance=Math.hypot(gx-x,gy-y);
  const step=Math.min(Math.max(0,speed*dt),distance||Math.max(0,speed*dt));
  if(step<=0)return {x,y,angle:heading,evading:false};
  const threats=threatsNear(x,y,enemies,Math.max(150,step*3+radius+clearance),14);
  if(!threats.length){
   const a=Math.atan2(gy-y,gx-x);
   const nx=x+Math.cos(a)*Math.min(distance,step),ny=y+Math.sin(a)*Math.min(distance,step);
   const moved=resolve?resolve(nx,ny):{x:nx,y:ny};
   return {x:moved.x,y:moved.y,angle:a,evading:false};
  }
  const direct=Math.atan2(gy-y,gx-x);
  const angles=[0,-.3,.3,-.65,.65,-1.05,1.05,-1.57,1.57,-2.25,2.25,Math.PI];
  let best=null,bestScore=-Infinity;
  for(const offset of angles){
   const angle=direct+offset;
   const rawX=x+Math.cos(angle)*Math.max(step,Math.min(speed*dt,6));
   const rawY=y+Math.sin(angle)*Math.max(step,Math.min(speed*dt,6));
   const moved=resolve?resolve(rawX,rawY):{x:rawX,y:rawY};
   if(!moved||!Number.isFinite(moved.x)||!Number.isFinite(moved.y))continue;
   const nx=moved.x,ny=moved.y,travel=Math.hypot(nx-x,ny-y);
   if(travel<step*.15)continue;
   // Score two steps ahead. Crossing a hostile hitbox costs far more than losing an orb.
   const projectedX=x+(nx-x)*Math.max(1,.55/Math.max(dt,.016));
   const projectedY=y+(ny-y)*Math.max(1,.55/Math.max(dt,.016));
   let danger=risk(nx,ny,threats,radius,clearance);
   danger+=risk(projectedX,projectedY,threats,radius,clearance)*.65;
   const goalProgress=distance-Math.hypot(gx-nx,gy-ny);
   const momentum=Math.cos(angle-heading)*.35;
   const score=goalProgress*2.3-danger+momentum;
   if(score>bestScore){bestScore=score;best={x:nx,y:ny,angle,evading:Math.abs(offset)>.35||danger>40};}
  }
  return best||{x,y,angle:heading,evading:true};
 }
 return Object.freeze({risk,threatsNear,bestOrb,steer});
});
