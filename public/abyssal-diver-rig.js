/* Shared canonical pose geometry, independent of the renderer and network.
 * No physics forces, gameplay acceleration or additional packet fields. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AbyssalDiverRig=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const finite=(v,f=0)=>Number.isFinite(v)?v:f;
 function advance(previous,speed,dt,powered=false,sample=null){
  dt=clamp(finite(dt),0,.10);speed=clamp(finite(speed),0,4);
  const target=speed<.045?0:clamp(speed,0,1),old=previous||{phase:0,weight:0};
  const weight=clamp(finite(old.weight)+(target-finite(old.weight))*(1-Math.exp(-dt*(target>old.weight?12:7))),0,1);
  const cadence=powered?2.8:4.1+Math.min(1.8,speed)*1.6;
  const phase=(finite(old.phase)+dt*cadence*(.25+.75*weight))%TAU;
  const hairFlow=clamp(finite(old.hairFlow)+(Number(Boolean(powered))-finite(old.hairFlow))*(1-Math.exp(-dt*3.8)),0,1);
  const heading=finite(sample?.heading,finite(old.heading));let vx=0,vy=0;if(Number.isFinite(sample?.vx)&&Number.isFinite(sample?.vy)){vx=sample.vx;vy=sample.vy;}else if(Number.isFinite(sample?.x)&&Number.isFinite(old.x)&&Number.isFinite(sample?.y)&&Number.isFinite(old.y)&&dt>0){const unit=Math.max(.01,finite(sample.unit,1));vx=(sample.x-old.x)/dt/unit;vy=(sample.y-old.y)/dt/unit;}else{vx=Math.cos(heading)*speed;vy=Math.sin(heading)*speed;}
  const magnitude=Math.hypot(vx,vy);if(magnitude>4){vx*=4/magnitude;vy*=4/magnitude;}const blend=1-Math.exp(-dt*7);const flowX=finite(old.flowX)+(vx-finite(old.flowX))*blend,flowY=finite(old.flowY)+(vy-finite(old.flowY))*blend;
  return {phase,weight,powered:Boolean(powered),hairFlow,flowX,flowY,heading,x:sample?.x,y:sample?.y,hairState:old.hairState};
 }
 function leg(side,phase,weight=1,powered=false){
  const a=clamp(finite(weight),0,1)*(powered?.23:1);
  const wave=Math.sin(finite(phase)+(side>0?0:Math.PI));
  const delay=Math.sin(finite(phase)-.72+(side>0?0:Math.PI));
  const hip=[-19,side*7.3],thigh=side*.055+wave*.16*a;
  const calf=side*.075+delay*.27*a;
  const knee=[hip[0]-24*Math.cos(thigh),hip[1]+24*Math.sin(thigh)];
  const ankle=[knee[0]-24*Math.cos(calf),knee[1]+24*Math.sin(calf)];
  return {hip,knee,ankle,finAngle:calf+delay*.055*a};
 }
 // Convert actual shoulder into the weapon-local space, then solve a bent
 // two-link arm toward the fixed grip. The barrel and tool anchors never move.
 function arm(side,relativeAim,offset,grip,profile='standard'){
  const a=finite(relativeAim),ca=Math.cos(a),sa=Math.sin(a),torch=profile==='welder',sx=13,sy=side*13;
  const shoulder=[sx*ca+sy*sa,-sx*sa+sy*ca-offset],dx=grip[0]-shoulder[0],dy=grip[1]-shoulder[1];
  const distance=Math.hypot(dx,dy),d=Math.max(.001,distance),ux=dx/d,uy=dy/d;
  // Shorter projected lengths in close poses represent out-of-plane flexion.
  // At extreme aim angles expand only enough to retain the fixed grip.
  const min=torch?31:36,total=clamp(Math.max(min,d+1.8),min,56),ratio=.53,upper=total*ratio,lower=total*(1-ratio),reach=clamp(d,Math.abs(upper-lower)+.01,upper+lower-.01);
  const along=(upper*upper-lower*lower+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const elbow=[shoulder[0]+ux*along-uy*height*side,shoulder[1]+uy*along+ux*height*side];
  return {shoulder,elbow,hand:[...grip]};
 }
 // Bounds in renderer coordinates; fit the same playable art, not a replacement sprite.
 function previewFrame(width,height,heading=0,aim=heading,held='none',powered=false,hairStyle='classic'){
  width=Math.max(1,finite(width,1));height=Math.max(1,finite(height,1));heading=finite(heading);aim=finite(aim,heading);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  function include(x0,y0,x1,y1,a){
   const co=Math.cos(a),si=Math.sin(a);
   for(const x of [x0,x1])for(const y of [y0,y1]){const px=x*co-y*si,py=x*si+y*co;minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}
  }
  include(-100,-37,46,37,heading);
  if(!['classic','short','shaved'].includes(hairStyle))include(-68,-72,78,72,heading);
  if(held==='abyssWeapon')include(-6,-6,73,34,aim);
  else if(held!=='none')include(powered?-116:-6,-19,68,25,aim);
  const scale=Math.min(width*.85/(maxX-minX),height*.84/(maxY-minY));
  return {x:width/2-(minX+maxX)*scale/2,y:height/2-(minY+maxY)*scale/2,r:scale*14/.60};
 }
 // Portrait frame keeps the crown and every animated tip inside its tile.
 function hairPortraitFrame(width,height,style='all'){width=Math.max(1,finite(width,1));height=Math.max(1,finite(height,1));const small=['classic','short','shaved','topKnot','mohawk','tealSpikes'].includes(style);const scale=Math.min(width/(small?70:106),height/(small?91:126));return {x:width/2,y:height*(small?.72:.56),r:scale*14/.60};}
 const pair=(a,b)=>Object.freeze([Object.freeze(a),Object.freeze(b)]);
 // Contacts lie on the actual receiver handle, pistol grip and tool handles.
 const rifleGrips=pair([34,2],[22,11]);
 const toolGrips=pair([24,-8],[34,9]);
 const gripSets=Object.freeze({
  abyssWeapon:rifleGrips,abyssPropulsor:toolGrips,abyssPropulsorIdle:toolGrips,
  abyssWelder:pair([31,-4],[25,5]),abyssPickaxe:pair([33,0],[23,0]),
  emptyCylinder:pair([31,-8],[31,8]),gasCylinder:pair([31,-8],[31,8]),oilCylinder:pair([31,-8],[31,8]),
  offshoreCable:pair([33,-9],[29,8]),generic:pair([29,-4],[26,5])
 });
 function gripsFor(held){return gripSets[held]||gripSets.generic;}
 // Rotate pickaxe/cylinder geometry around its own pivot before solving arms.
 function toolPose(held,swing=0){
  const swingAngle=held==='abyssPickaxe'?finite(swing)*.17:0;
  const objectAngle=held==='abyssPickaxe'?-.35+finite(swing)*.45:['emptyCylinder','gasCylinder','oilCylinder'].includes(held)?.08:0;
  const co=Math.cos(objectAngle),si=Math.sin(objectAngle);
  const grips=gripsFor(held).map(([x,y])=>[27+(x-27)*co-y*si,(x-27)*si+y*co]);
  return {swingAngle,objectAngle,grips};
 }
 function idleArm(side,phase=0,weight=0){
  const sway=Math.sin(finite(phase)*.5)*clamp(finite(weight),0,1)*1.5;
  return {shoulder:[13,side*13],elbow:[-8,side*(16+sway)],hand:[-30,side*(13.4+sway*.5)]};
 }
 return Object.freeze({advance,leg,arm,idleArm,gripsFor,toolPose,previewFrame,hairPortraitFrame,rifleGrips,toolGrips});
});