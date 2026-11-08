/* Shared gravity cone geometry for solo renderer and authoritative rooms. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalGravityCone=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const HALF_ANGLE=Math.PI/4;
 function contains(x,y,heading,targetX,targetY,targetRadius,range,halfAngle=HALF_ANGLE){
  const dx=Number(targetX)-Number(x),dy=Number(targetY)-Number(y);
  const d=Math.hypot(dx,dy),radius=Math.max(0,Number(targetRadius)||0);
  if(!Number.isFinite(d)||!Number.isFinite(Number(heading))||d>Math.max(0,Number(range)||0)+radius)return false;
  if(d<=Math.max(radius,1e-6))return true;
  const bearing=Math.atan2(dy,dx);
  const difference=Math.atan2(Math.sin(bearing-heading),Math.cos(bearing-heading));
  const allowance=Math.asin(Math.min(1,radius/d));
  return Math.abs(difference)<=halfAngle+allowance;
 }
 return Object.freeze({HALF_ANGLE,contains});
});
