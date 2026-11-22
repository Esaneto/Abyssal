(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalSpecimenEvasion=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 // The diver's unmodified, pre-upgrade swim speed in world units.
 // Both Solo and the authoritative Online server use the same zoom scale.
 const DIVER_BASE_SPEED=150;
 const playerBaseSpeed=zoom=>DIVER_BASE_SPEED/Math.max(.001,Number(zoom)||1);
 const speedMultiplierForIntent=intent=>intent==='combat'||intent==='collect'?2:.9;
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
  if(!Array.isArray(orbs)||!orbs.length)return null;
  let best=null,bestScore=Infinity;
  const localThreats=threatsNear(player.x,player.y,enemies,acquisitionRange+radius+clearance+80,48);
  for(const orb of orbs||[]){
   if(!orb)continue;
   if(Math.hypot(orb.x-player.x,orb.y-player.y)>acquisitionRange)continue;
   const d=Math.hypot(orb.x-position.x,orb.y-position.y);
   const danger=risk(orb.x,orb.y,localThreats,radius,clearance);
   // A dangerous orb waits until the player clears its guardians.
   if(danger>180)continue;
   const score=d+danger*.6;
   if(score<bestScore){bestScore=score;best=orb;}
  }
  return best;
 }
 function steer({position,target,enemies=[],speed=100,actionSpeedMultiplier=1,dt=.05,radius=10,clearance=28,heading=0,resolve=null,intent='travel',state=null}){
  const x=Number(position?.x)||0,y=Number(position?.y)||0;
  let gx=Number.isFinite(target?.x)?target.x:x,gy=Number.isFinite(target?.y)?target.y:y;
  const combat=intent==='combat',follow=intent==='follow',collect=intent==='collect';
  const baseSpeed=Math.max(0,Number(speed)||0);
  if(baseSpeed<=0||dt<=0)return {x,y,angle:heading,evading:false};
  // Follow a safe point on the near side of the blocking monster rather than
  // returning into an occupied player offset, retreating, and repeating.
  let blockedAnchor=false;
  if(follow){
   const goalThreats=threatsNear(gx,gy,enemies,Math.max(120,radius+clearance*3),12);
   let blocker=null,penetration=0;
   for(const e of goalThreats){
    const safe=Math.max(3,Number(e.r)||8)+radius+Math.max(6,clearance*.65);
    const inside=safe-Math.hypot(gx-e.x,gy-e.y);
    if(inside>penetration){penetration=inside;blocker=e;}
   }
   if(blocker){
    blockedAnchor=true;
    const safe=Math.max(3,Number(blocker.r)||8)+radius+Math.max(6,clearance*.65)+2;
    let ax=x-blocker.x,ay=y-blocker.y,mag=Math.hypot(ax,ay);
    // Keep the same safe side of an occupied follow anchor. Recomputing this
    // bearing from each new position used to drive Ecos around the blocker.
    if(state&&state.ecoBlockerId===blocker.id&&Number.isFinite(state.ecoBlockerX)&&Number.isFinite(state.ecoBlockerY)){
      ax=state.ecoBlockerX;ay=state.ecoBlockerY;mag=Math.hypot(ax,ay)||1;
    }else{
      if(mag<.01){ax=Math.cos(heading+Math.PI);ay=Math.sin(heading+Math.PI);mag=1;}
      if(state){state.ecoBlockerId=blocker.id;state.ecoBlockerX=ax/mag;state.ecoBlockerY=ay/mag;}
    }
    gx=blocker.x+ax/mag*safe;gy=blocker.y+ay/mag*safe;
   }else if(state)state.ecoBlockerId=null;
  }
  const distance=Math.hypot(gx-x,gy-y);
  // Follow is always 90% of the diver's pre-bonus base speed.
  // During an action (enemy or orb), the Eco reaches 200% of that base,
  // then receives only its own speed resonance bonus on top of the 200%.
  // Diver upgrades, propulsor and temporary boosts never scale this speed.
  const acting=combat||collect;
  const ownActionBonus=Math.max(.1,Math.min(3,Number(actionSpeedMultiplier)||1));
  const desiredSpeed=baseSpeed*speedMultiplierForIntent(intent)*(acting?ownActionBonus:1);
  let actualSpeed=desiredSpeed;
  if(state&&typeof state==='object'){
   const previous=Number.isFinite(state.ecoMotionSpeed)?state.ecoMotionSpeed:desiredSpeed;
   const blend=1-Math.exp(-Math.min(dt,.12)*(desiredSpeed>previous?8:10));
   actualSpeed=previous+(desiredSpeed-previous)*blend;
   state.ecoMotionSpeed=actualSpeed;
  }
  const maxStep=Math.max(0,actualSpeed*dt);
  const threats=threatsNear(x,y,enemies,Math.max(150,maxStep*3+radius+clearance),combat?8:14);
  const goalTolerance=follow?Math.max(5,Math.min(10,radius*.55)):Math.max(1,Math.min(3,radius*.15));
  let emergency=false,nearestEmergency=null,nearestEmergencyDistance=Infinity;
  for(const e of threats){
   const d=Math.hypot(x-e.x,y-e.y),physical=radius+Math.max(3,Number(e.r)||8)+Math.min(4,clearance*.15);
   if(d<physical){emergency=true;if(d<nearestEmergencyDistance){nearestEmergencyDistance=d;nearestEmergency=e;}}
  }
  let anchorDx=0,anchorDy=0,movingAnchor=false;
  if(state&&typeof state==='object'){
   if(follow){
    if(Number.isFinite(state.ecoFollowAnchorX)&&Number.isFinite(state.ecoFollowAnchorY)){
     anchorDx=gx-state.ecoFollowAnchorX;anchorDy=gy-state.ecoFollowAnchorY;
     movingAnchor=Math.hypot(anchorDx,anchorDy)>Math.max(.08,dt*.35);
    }
    state.ecoFollowAnchorX=gx;state.ecoFollowAnchorY=gy;
    state.ecoFollowing=distance>goalTolerance||movingAnchor;
   }else{
    state.ecoFollowing=false;state.ecoFollowAnchorX=NaN;state.ecoFollowAnchorY=NaN;state.ecoBlockerId=null;
   }
  }
  // Once close to a MOVING diver, match the anchor displacement through the
  // same collision resolver instead of stopping for several frames and chasing.
  if(follow&&movingAnchor&&!blockedAnchor&&!threats.length&&!emergency&&
     distance<=goalTolerance+maxStep&&Math.hypot(anchorDx,anchorDy)<=maxStep){
   const moved=resolve?resolve(x+anchorDx,y+anchorDy):{x:x+anchorDx,y:y+anchorDy};
   if(moved&&Number.isFinite(moved.x)&&Number.isFinite(moved.y))
    return {x:moved.x,y:moved.y,angle:Math.atan2(anchorDy,anchorDx),evading:false};
  }
  if(distance<=goalTolerance&&!emergency)return {x,y,angle:heading,evading:false};
  // Never overshoot a nearby destination just because an unrelated threat exists.
  // This was the main source of the visible follow-player trembling.
  const step=distance>goalTolerance?Math.min(maxStep,distance):maxStep;
  if(!threats.length){
   const a=Math.atan2(gy-y,gx-x);
   const nx=x+Math.cos(a)*Math.min(distance,step),ny=y+Math.sin(a)*Math.min(distance,step);
   const moved=resolve?resolve(nx,ny):{x:nx,y:ny};
   if(!resolve||Math.hypot(moved.x-x,moved.y-y)>=Math.min(distance,step)*.35||distance<.1)return {x:moved.x,y:moved.y,angle:a,evading:false};
   let best=null,bestScore=-Infinity;for(const off of [-.45,.45,-.9,.9,-1.57,1.57,Math.PI]){const q=a+off,p=resolve(x+Math.cos(q)*step,y+Math.sin(q)*step),travel=Math.hypot(p.x-x,p.y-y);if(travel<step*.25)continue;const value=travel+distance-Math.hypot(gx-p.x,gy-p.y)+Math.cos(q-heading)*step*.3;if(value>bestScore){bestScore=value;best={x:p.x,y:p.y,angle:q,evading:true};}}return best||{x:moved.x,y:moved.y,angle:a,evading:true};
  }
  const direct=emergency&&nearestEmergency?
   Math.atan2(y-nearestEmergency.y,x-nearestEmergency.x):Math.atan2(gy-y,gx-x);
  // In combat, local avoidance may bend the approach but cannot turn the Eco
  // around and make it flee from the selected target. Terrain routing already
  // handles large detours before this local steering pass.
  const fullAngles=[0,-.3,.3,-.65,.65,-1.05,1.05,-1.57,1.57,-2.25,2.25,Math.PI];
  const angles=emergency?fullAngles:combat?[0,-.22,.22,-.45,.45,-.72,.72,-1.02,1.02]:
   follow?[0,-.22,.22,-.48,.48,-.82,.82,-1.05,1.05]:fullAngles;
  let best=null,bestScore=-Infinity;
  const lookahead=combat?.22:.42;
  const advancing=threats.map(e=>({x:e.x+(Number(e.vx)||0)*lookahead,y:e.y+(Number(e.vy)||0)*lookahead,r:e.r,hp:e.hp}));
  const localClearance=combat?Math.max(4,clearance*.32):follow?Math.max(5,clearance*.55):clearance;
  for(const offset of angles){
   const angle=direct+offset;
   const localStep=step;
   const rawX=x+Math.cos(angle)*localStep;
   const rawY=y+Math.sin(angle)*localStep;
   const moved=resolve?resolve(rawX,rawY):{x:rawX,y:rawY};
   if(!moved||!Number.isFinite(moved.x)||!Number.isFinite(moved.y))continue;
   const nx=moved.x,ny=moved.y,travel=Math.hypot(nx-x,ny-y);
   if(travel<step*.15)continue;
   // Score two steps ahead. Crossing a hostile hitbox costs far more than losing an orb.
   const projectedX=x+(nx-x)*Math.max(1,.55/Math.max(dt,.016));
   const projectedY=y+(ny-y)*Math.max(1,.55/Math.max(dt,.016));
   let danger=risk(nx,ny,threats,radius,localClearance);
   danger+=risk(projectedX,projectedY,advancing,radius,localClearance)*(combat?.30:.65);
   // Hard physical overlap still matters in combat, but a dense group must not
   // create effectively infinite "fear" that prevents any forward progress.
   if(combat)danger=Math.min(danger,300);
   const goalProgress=distance-Math.hypot(gx-nx,gy-ny);
   const turn=Math.abs(Math.atan2(Math.sin(angle-heading),Math.cos(angle-heading)));
   const momentum=Math.cos(angle-heading)*Math.max(.35,step*.18);
   const progressWeight=combat?7.2:follow?3.6:2.3,dangerWeight=combat?.22:follow?.55:1,
    turnWeight=combat?Math.max(.35,step*.10):follow?Math.max(.9,step*.42):Math.max(.8,step*.32);
   const score=goalProgress*progressWeight-danger*dangerWeight+momentum-turn*turnWeight;
   if(score>bestScore){bestScore=score;best={x:nx,y:ny,angle,evading:Math.abs(offset)>.35||danger>(combat?120:40)};}
  }
  return best||{x,y,angle:heading,evading:true};
 }
 return Object.freeze({DIVER_BASE_SPEED,playerBaseSpeed,speedMultiplierForIntent,risk,threatsNear,bestOrb,steer});
});
