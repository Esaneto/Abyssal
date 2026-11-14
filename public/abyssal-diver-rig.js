/* Shared canonical pose geometry, independent of the renderer and network.
 * No physics forces, gameplay acceleration or additional packet fields. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AbyssalDiverRig=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const finite=(v,f=0)=>Number.isFinite(v)?v:f;
 const facing=angle=>Math.cos(finite(angle))< -1e-9?-1:1;
 const viewFor=(yaw=.65,heading=0)=>{yaw=clamp(finite(yaw,.65),0,1);const profile=clamp((yaw-.65)/.35,0,1),side=profile>.5?facing(heading):1;return {yaw,profile,facing:side,width:(1-.22*yaw-.10*profile)*side,shear:.055*yaw*(1-profile)*side,headTilt:-.72*profile};};
 const headPoint=(p,view)=>{const a=view?.headTilt||0,x=p[0]-22,y=p[1];return [22+x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];};
 const GAMEPLAY_YAW=1;
 const project=(p,view)=>view?[p[0],p[1]*view.width+p[0]*view.shear]:[...p];
 function advance(previous,speed,dt,powered=false,sample=null){
  dt=clamp(finite(dt),0,.10);speed=clamp(finite(speed),0,4);
  const target=speed<.045?0:clamp(speed,0,1),old=previous||{phase:0,weight:0};
  const weight=clamp(finite(old.weight)+(target-finite(old.weight))*(1-Math.exp(-dt*(target>old.weight?12:7))),0,1);
  const cadence=powered?2.8:4.1+Math.min(1.8,speed)*1.6;
  const phase=(finite(old.phase)+dt*cadence*(.25+.75*weight))%TAU;
  const hairFlow=clamp(finite(old.hairFlow)+(Number(Boolean(powered))-finite(old.hairFlow))*(1-Math.exp(-dt*3.8)),0,1);
  const heading=finite(sample?.heading,finite(old.heading));let vx=0,vy=0;if(Number.isFinite(sample?.vx)&&Number.isFinite(sample?.vy)){vx=sample.vx;vy=sample.vy;}else if(Number.isFinite(sample?.x)&&Number.isFinite(old.x)&&Number.isFinite(sample?.y)&&Number.isFinite(old.y)&&dt>0){const unit=Math.max(.01,finite(sample.unit,1));vx=(sample.x-old.x)/dt/unit;vy=(sample.y-old.y)/dt/unit;}else{vx=Math.cos(heading)*speed;vy=Math.sin(heading)*speed;}
  const magnitude=Math.hypot(vx,vy);if(magnitude>4){vx*=4/magnitude;vy*=4/magnitude;}const blend=1-Math.exp(-dt*7);const flowX=finite(old.flowX)+(vx-finite(old.flowX))*blend,flowY=finite(old.flowY)+(vy-finite(old.flowY))*blend;
  const accel=dt>0?clamp((Math.hypot(vx,vy)-finite(old.speedSample))/dt,-5,5):0,drive=finite(old.drive)+(accel-finite(old.drive))*(1-Math.exp(-dt*5));
  const delta=Math.atan2(Math.sin(heading-finite(old.heading,heading)),Math.cos(heading-finite(old.heading,heading))),turn=finite(old.turn)+(clamp(delta/Math.max(.016,dt),-3,3)-finite(old.turn))*(1-Math.exp(-dt*6));
  return {phase,weight,powered:Boolean(powered),hairFlow,flowX,flowY,heading,x:sample?.x,y:sample?.y,hairState:old.hairState,speedSample:Math.hypot(vx,vy),drive,turn};
 }
 function leg(side,phase,weight=1,powered=false,motion=null,view=null){
  const a=clamp(finite(weight),0,1)*(powered?.23:1);
  const wave=Math.sin(finite(phase)+(side>0?0:Math.PI));
  const delay=Math.sin(finite(phase)-.72+(side>0?0:Math.PI));
  const brake=clamp(-finite(motion?.drive)/5,0,1),turn=clamp(finite(motion?.turn)/3,-1,1),thigh=side*(.055+.09*brake)+wave*.16*a+turn*.05,hip=[-19,side*7.3];
  const calf=side*(.075+.18*brake)+delay*.27*a+turn*.075;
  if(view?.profile>.5){
   // Technical-diver trim: hips remain stable; the knees bend toward the
   // dorsal side, calves alternate, and the blade lags the ankle.
   const w=clamp(finite(weight),0,1),motor=powered?1:0,braking=clamp(-finite(motion?.drive)/5,0,1);
   const p=finite(phase)+(side<0?Math.PI:0),hip=[-19,side*3.2],hipAngle=-.035+(1-motor)*(.045*Math.sin(p)*w-.07*braking);
   const flex=(1-motor)*(.32+.37*(1-w)+.22*braking+.20*Math.sin(p-.55)*w)+motor*.08;
   const calfAngle=hipAngle-Math.max(.035,flex),knee=[hip[0]-24*Math.cos(hipAngle),hip[1]+24*Math.sin(hipAngle)],ankle=[knee[0]-24*Math.cos(calfAngle),knee[1]+24*Math.sin(calfAngle)];
   const finAngle=motor?calfAngle:calfAngle*w-.10*(1-w)+.13*Math.sin(p-1.1)*w+.08*w;
   return {hip,knee,ankle,finAngle,finFlex:(1-motor)*2.2*Math.sin(p-1.4)*w};
  }
  const knee=[hip[0]-24*Math.cos(thigh),hip[1]+24*Math.sin(thigh)];
  const ankle=[knee[0]-24*Math.cos(calf),knee[1]+24*Math.sin(calf)];
  return {hip,knee,ankle,finAngle:calf+delay*.055*a};
 }
 // Convert actual shoulder into the weapon-local space, then solve a bent
 // two-link arm toward the fixed grip. The barrel and tool anchors never move.
 function armCandidates(side,relativeAim,offset,grip,profile='standard',view=null,projectedTotal=null){
  const a=finite(relativeAim),ca=Math.cos(a),sa=Math.sin(a),torch=profile==='welder',[sx,sy]=project([13,side*13],view);
  const shoulder=[sx*ca+sy*sa,-sx*sa+sy*ca-offset],dx=grip[0]-shoulder[0],dy=grip[1]-shoulder[1];
  const d=Math.max(.001,Math.hypot(dx,dy)),ux=dx/d,uy=dy/d,min=torch?31:36,total=clamp(Math.max(projectedTotal??min,d+1.8),min,56),upper=total*.53,lower=total*.47,reach=clamp(d,Math.abs(upper-lower)+.01,upper+lower-.01);
  const along=(upper*upper-lower*lower+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  return [-1,1].map(sign=>{const elbow=[shoulder[0]+ux*along-uy*height*sign,shoulder[1]+uy*along+ux*height*sign],ex=elbow[0]*ca-(elbow[1]+offset)*sa,ey=elbow[0]*sa+(elbow[1]+offset)*ca;
   // The elbow hint belongs to the BODY, not to the rotating weapon.
   // Prefer an ipsilateral, low elbow and penalize bending into the head.
   const pole=project([3,side*24],view),score=Math.hypot(ex-pole[0],ey-pole[1])+.85*Math.max(0,ex-21)+1.7*Math.max(0,5-side*ey*(view?.facing||1));
   return {shoulder,elbow,hand:[...grip],score,side,depth:side,projectedTotal:total};
  });
 }
 function arm(side,relativeAim,offset,grip,profile='standard',view=null){return armCandidates(side,relativeAim,offset,grip,profile,view).sort((a,b)=>a.score-b.score)[0];}
 function segmentsCross(a,b,c,d){
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  return cross(a,b,c)*cross(a,b,d)<-1e-7&&cross(c,d,a)*cross(c,d,b)<-1e-7;
 }
 function armCrossings(a,b){let n=0;for(const [p,q] of [[a.shoulder,a.elbow],[a.elbow,a.hand]])for(const [r,s] of [[b.shoulder,b.elbow],[b.elbow,b.hand]])if(segmentsCross(p,q,r,s))n++;return n;}
 function visibleCrossings(a,b,angle,offset,view){
  const co=Math.cos(angle),si=Math.sin(angle);let count=0;
  for(const [p,q] of [[a.shoulder,a.elbow],[a.elbow,a.hand]])for(const [r,s] of [[b.shoulder,b.elbow],[b.elbow,b.hand]]){
   if(!segmentsCross(p,q,r,s))continue;
   const dx=q[0]-p[0],dy=q[1]-p[1],ex=s[0]-r[0],ey=s[1]-r[1],u=((r[0]-p[0])*ey-(r[1]-p[1])*ex)/(dx*ey-dy*ex),wx=p[0]+dx*u,wy=p[1]+dy*u;
   const x=wx*co-(wy+offset)*si,py=wx*si+(wy+offset)*co,y=view?(py-x*view.shear)/view.width:py;
   const covered=((x+2)/23)**2+(y/13.4)**2<1||((x-31)/9)**2+(y/8)**2<1;
   const wyModel=wy*(offset<0?-1:1),coveredByItem=Math.abs(offset)===12?wx>=17&&wx<=48&&wyModel>=-4&&wyModel<=7:wx>=22&&wx<=81&&Math.abs(wy)<=9;
   if(!covered&&!coveredByItem)count++;
  }return count;
 }
 function armPair(relativeAim,offset,grips,profile='standard',view=null){
  const evaluate=(left,right)=>{let best=null,cost=Infinity;for(const a of left)for(const b of right){const cross=armCrossings(a,b),visible=cross?visibleCrossings(a,b,relativeAim,offset,view):0,score=a.score+b.score+cross*65+visible*240+Math.abs(a.projectedTotal-36)*.12+Math.abs(b.projectedTotal-36)*.12;if(score<cost){best=[a,b];cost=score;}}return best;};
  const initial=evaluate(armCandidates(-1,relativeAim,offset,grips[0],profile,view),armCandidates(1,relativeAim,offset,grips[1],profile,view));
  if(!armCrossings(...initial))return initial;
  const totals=[36,40,45,50,56],left=totals.flatMap(n=>armCandidates(-1,relativeAim,offset,grips[0],profile,view,n)),right=totals.flatMap(n=>armCandidates(1,relativeAim,offset,grips[1],profile,view,n));
  return evaluate(left,right);
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
  else if(held!=='none'){include(powered?-116:-6,-19,68,25,aim);if(held==='abyssPropulsor'||held==='abyssPropulsorIdle')include(powered?-116:-6,-23,88,28,heading);}
  const scale=Math.min(width*.85/(maxX-minX),height*.84/(maxY-minY));
  return {x:width/2-(minX+maxX)*scale/2,y:height/2-(minY+maxY)*scale/2,r:scale*14/.60};
 }
 // Portrait frame keeps the crown and every animated tip inside its tile.
 function hairPortraitFrame(width,height,style='all'){width=Math.max(1,finite(width,1));height=Math.max(1,finite(height,1));if(style==='animated'){const scale=Math.min(width/160,height/158);return {x:width/2,y:height*.55,r:scale*14/.60};}const small=['classic','short','shaved','topKnot','mohawk','tealSpikes'].includes(style);const scale=Math.min(width/(small?70:106),height/(small?91:126));return {x:width/2,y:height*(small?.72:.56),r:scale*14/.60};}
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
 function propulsorOffset(held,view){return (held==='abyssPropulsor'||held==='abyssPropulsorIdle')?20*(view?.profile||0):0;}
 function gripsFor(held,view=null){const g=gripSets[held]||gripSets.generic,shift=propulsorOffset(held,view);return shift?g.map(([x,y])=>[x+shift,y]):g;}
 // Rotate pickaxe/cylinder geometry around its own pivot before solving arms.
 function toolPose(held,swing=0,view=null){
  const swingAngle=held==='abyssPickaxe'?finite(swing)*.17:0;
  const objectAngle=held==='abyssPickaxe'?-.35+finite(swing)*.45:['emptyCylinder','gasCylinder','oilCylinder'].includes(held)?.08:0;
  const co=Math.cos(objectAngle),si=Math.sin(objectAngle);
  const grips=gripsFor(held,view).map(([x,y])=>[27+(x-27)*co-y*si,(x-27)*si+y*co]);
  return {swingAngle,objectAngle,grips,pivot:27+propulsorOffset(held,view)};
 }
 function idleArm(side,phase=0,weight=0,motion=null,view=null,mode='free'){
  const sway=Math.sin(finite(phase)*.5)*clamp(finite(weight),0,1)*1.5;
  const brake=clamp(-finite(motion?.drive)/5,0,1);if(view?.profile>.5){const tucked=mode==='tool';return {shoulder:project([13,side*13],view),elbow:project([tucked?-5:0,side<0?2:19+brake*2],view),hand:project([tucked?-26:18-brake*3,side<0?8:16+sway*.35+brake*2],view)};}return {shoulder:project([13,side*13],view),elbow:project([-8+brake*3,side*(16+sway+brake*2)],view),hand:project([-30+brake*6,side*(13.4+sway*.5+brake*3)],view)};
 }
 return Object.freeze({GAMEPLAY_YAW,facing,headPoint,viewFor,project,advance,leg,arm,armPair,armCrossings,visibleCrossings,idleArm,gripsFor,toolPose,previewFrame,hairPortraitFrame,rifleGrips,toolGrips});
});