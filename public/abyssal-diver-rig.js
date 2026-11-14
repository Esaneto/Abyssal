/* Shared canonical pose geometry, independent of the renderer and network.
 * No physics forces, gameplay acceleration or additional packet fields. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AbyssalDiverRig=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const finite=(v,f=0)=>Number.isFinite(v)?v:f;
 function advance(previous,speed,dt,powered=false){
  dt=clamp(finite(dt),0,.10);speed=clamp(finite(speed),0,4);
  const target=speed<.045?0:clamp(speed,0,1),old=previous||{phase:0,weight:0};
  const weight=clamp(finite(old.weight)+(target-finite(old.weight))*(1-Math.exp(-dt*(target>old.weight?12:7))),0,1);
  const cadence=powered?4.4:5.7+Math.min(1.8,speed)*2.1;
  const phase=(finite(old.phase)+dt*cadence*(.25+.75*weight))%TAU;
  return {phase,weight,powered:Boolean(powered)};
 }
 function leg(side,phase,weight=1,powered=false){
  const a=clamp(finite(weight),0,1)*(powered?.32:1);
  const wave=Math.sin(finite(phase)+(side>0?0:Math.PI));
  const delay=Math.sin(finite(phase)-.72+(side>0?0:Math.PI));
  const hip=[-16,side*5.5],thigh=side*.14+wave*.32*a;
  const calf=side*.095+delay*.42*a;
  const knee=[hip[0]-18*Math.cos(thigh),hip[1]+18*Math.sin(thigh)];
  const ankle=[knee[0]-19*Math.cos(calf),knee[1]+19*Math.sin(calf)];
  return {hip,knee,ankle,finAngle:calf+delay*.10*a};
 }
 // Convert actual shoulder into the weapon-local space, then solve a bent
 // two-link arm toward the fixed grip. The barrel and tool anchors never move.
 function arm(side,relativeAim,offset,grip){
  const a=finite(relativeAim),ca=Math.cos(a),sa=Math.sin(a),sx=11,sy=side*8;
  const shoulder=[sx*ca+sy*sa,-sx*sa+sy*ca-offset],dx=grip[0]-shoulder[0],dy=grip[1]-shoulder[1];
  const distance=Math.hypot(dx,dy),d=Math.max(.001,distance),ux=dx/d,uy=dy/d;
  const upper=19,lower=22,reach=clamp(d,3,upper+lower-.01);
  const along=(upper*upper-lower*lower+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const elbow=distance>upper+lower?[shoulder[0]+dx*.46,shoulder[1]+dy*.46]:[shoulder[0]+ux*along-uy*height*side,shoulder[1]+uy*along+ux*height*side];
  return {shoulder,elbow,hand:[...grip]};
 }
 // Bounds in renderer coordinates; fit the same playable art, not a replacement sprite.
 function previewFrame(width,height,heading=0,aim=heading,held='none',powered=false){
  width=Math.max(1,finite(width,1));height=Math.max(1,finite(height,1));heading=finite(heading);aim=finite(aim,heading);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  function include(x0,y0,x1,y1,a){
   const co=Math.cos(a),si=Math.sin(a);
   for(const x of [x0,x1])for(const y of [y0,y1]){const px=x*co-y*si,py=x*si+y*co;minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}
  }
  include(-86,-35,44,34,heading);
  if(held==='abyssWeapon')include(-6,-6,73,34,aim);
  else if(held!=='none')include(powered?-116:-6,-19,68,25,aim);
  const scale=Math.min(width*.85/(maxX-minX),height*.84/(maxY-minY));
  return {x:width/2-(minX+maxX)*scale/2,y:height/2-(minY+maxY)*scale/2,r:scale*14/.60};
 }
 const rifleGrips=Object.freeze([Object.freeze([31,-6]),Object.freeze([24,8])]);
 const toolGrips=Object.freeze([Object.freeze([27,-2]),Object.freeze([27,3])]);
 return Object.freeze({advance,leg,arm,previewFrame,rifleGrips,toolGrips});
});