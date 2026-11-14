(function(root,factory){
 const rig=typeof module==='object'&&module.exports?require('./abyssal-diver-rig.js'):root.AbyssalDiverRig;
 const api=factory(rig);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalDiverHitbox=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(rig){
 'use strict';
 // The visible diver uses the same canonical local coordinates. Every limb has
 // a separate capsule, so hits on legs and arms no longer miss a small center circle.
 const DRAW_SCALE=.60;
 function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
 function canonicalRadius(player){return Math.max(.1,(Number(player?.r)||13)*DRAW_SCALE/14);}
 function zones(player,t=0){
  const x=Number(player?.x)||0,y=Number(player?.y)||0,angle=Number(player?.bodyAngle)||0;
  const aim=Number(player?.weaponAngle??player?.angle??angle)||0;
  const scale=canonicalRadius(player),cos=Math.cos(angle),sin=Math.sin(angle);
  const aimCos=Math.cos(aim),aimSin=Math.sin(aim);
  // Collision uses the same neutral rig, conservatively covering the small kick envelope.
  // Cosmetic client phases are not trusted for authoritative hit detection.
  const left=rig.leg(-1,0,0),right=rig.leg(1,0,0);
  const held=player?.propulsorEquipped?'abyssPropulsor':'abyssWeapon',offset=held==='abyssPropulsor'?5:12,grips=rig.gripsFor(held);
  const arms=[rig.arm(-1,aim-angle,offset,grips[0]),rig.arm(1,aim-angle,offset,grips[1])];
  const point=(px,py,weapon=false)=>{
   const ca=weapon?aimCos:cos,sa=weapon?aimSin:sin;
   return {x:x+(px*ca-py*sa)*scale,y:y+(px*sa+py*ca)*scale};
  };
  const limb=(name,ax,ay,bx,by,r,weapon=false)=>{
   const a=point(ax,ay,weapon),b=point(bx,by,weapon);
   return {name,ax:a.x,ay:a.y,bx:b.x,by:b.y,r:r*scale};
  };
  return [
   limb('torso',-16,0,17,0,13),
   limb('head',25,-1,29,-1,13),
   ...arms.flatMap((arm,i)=>{const name=i?'right':'left';return [limb(name+'-arm',arm.shoulder[0],arm.shoulder[1]+offset,arm.elbow[0],arm.elbow[1]+offset,6,true),limb(name+'-forearm',arm.elbow[0],arm.elbow[1]+offset,arm.hand[0],arm.hand[1]+offset,5.3,true)];}),
   limb('left-thigh',...left.hip,...left.knee,8.6),
   limb('left-leg',...left.knee,...left.ankle,8.5),
   limb('right-thigh',...right.hip,...right.knee,8.6),
   limb('right-leg',...right.knee,...right.ankle,8.5)
  ];
 }
 function pointSegmentDistance(x,y,ax,ay,bx,by){
  const vx=bx-ax,vy=by-ay,m=vx*vx+vy*vy;
  const s=m<1e-8?0:clamp(((x-ax)*vx+(y-ay)*vy)/m,0,1);
  return Math.hypot(x-(ax+s*vx),y-(ay+s*vy));
 }
 function segmentSegmentDistance(ax,ay,bx,by,cx,cy,dx,dy){
  const d=(ax,ay,bx,by,cx,cy)=>((bx-ax)*(cy-ay)-(by-ay)*(cx-ax));
  const a=d(ax,ay,bx,by,cx,cy),b=d(ax,ay,bx,by,dx,dy);
  const c=d(cx,cy,dx,dy,ax,ay),e=d(cx,cy,dx,dy,bx,by);
  // Collinear separated capsules are NOT intersecting. Bounding overlap
  // must also hold before accepting zero-distance segment intersection.
  const boundsOverlap=Math.max(Math.min(ax,bx),Math.min(cx,dx))<=Math.min(Math.max(ax,bx),Math.max(cx,dx))+1e-8
    &&Math.max(Math.min(ay,by),Math.min(cy,dy))<=Math.min(Math.max(ay,by),Math.max(cy,dy))+1e-8;
  if(boundsOverlap&&a*b<=0&&c*e<=0)return 0;
  return Math.min(pointSegmentDistance(ax,ay,cx,cy,dx,dy),pointSegmentDistance(bx,by,cx,cy,dx,dy),pointSegmentDistance(cx,cy,ax,ay,bx,by),pointSegmentDistance(dx,dy,ax,ay,bx,by));
 }
 function circleHit(player,x,y,r=0,t=0){
  for(const zone of zones(player,t)){
   if(pointSegmentDistance(Number(x),Number(y),zone.ax,zone.ay,zone.bx,zone.by)<=zone.r+Math.max(0,Number(r)||0))return zone.name;
  }
  return null;
 }
 function segmentHit(player,ax,ay,bx,by,thickness=0,t=0){
  for(const zone of zones(player,t)){
   if(segmentSegmentDistance(Number(ax),Number(ay),Number(bx),Number(by),zone.ax,zone.ay,zone.bx,zone.by)<=zone.r+Math.max(0,Number(thickness)||0))return zone.name;
  }
  return null;
 }
 return Object.freeze({DRAW_SCALE,zones,circleHit,segmentHit,pointSegmentDistance,segmentSegmentDistance});
});