/* Single source of truth for the Photon Ray's shared presentation and pulse cadence. */
(function(root,factory){
 const config=factory();
 if(typeof module==='object'&&module.exports)module.exports=config;
 if(root)root.AbyssalPhotonRay=config;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 return Object.freeze({
  color:'#ff8df4',
  duration:.09,
  pulseInterval:.25,
  remoteHold:.32,
  widths:Object.freeze([0,2.4,4,6]),
  maxLevel:3,
  // World-space segment vs circular hitbox, shared by browser and authoritative server.
  segmentCircleHit(x1,y1,x2,y2,cx,cy,r){
   const dx=x2-x1,dy=y2-y1,lengthSquared=dx*dx+dy*dy;
   const t=lengthSquared>0?Math.max(0,Math.min(1,((cx-x1)*dx+(cy-y1)*dy)/lengthSquared)):0;
   const ox=x1+dx*t-cx,oy=y1+dy*t-cy;
   return ox*ox+oy*oy<=r*r;
  }
 });
});
