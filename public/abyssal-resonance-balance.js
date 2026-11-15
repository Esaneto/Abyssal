/* Shared per-run resonance tuning and deterministic orb collection. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.AbyssalResonanceBalance=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const rank=n=>Math.max(0,Math.min(3,Math.floor(Number(n)||0)));
const POWER=1.12,RATE=1.15;
const predator=(level,elite,ratio)=>1+rank(level)*(elite?.20:.04)+(ratio<=.30?rank(level)*.08:0);
const close=(level,distance,zoom=1)=>distance<=175/zoom?1+rank(level)*.25:1;
const petAttack=n=>1+.15*rank(n),petLife=n=>1+.20*rank(n),petSpeed=n=>1+.12*rank(n),petCadence=n=>1+.15*rank(n);
const petInterval=n=>1020/petCadence(n);
const fieldRadius=(n,zoom=1)=>[0,65,90,115][rank(n)]/zoom;
const fieldSpeed=(n,zoom=1)=>[0,100,140,180][rank(n)]/zoom;
function contactTime(orb,dx,dy,pet,padding){
 const x=orb.x-pet.x,y=orb.y-pet.y,r=Math.max(0,Number(pet.r)||0)+padding;
 const c=x*x+y*y-r*r;if(c<=0)return 0;
 const a=dx*dx+dy*dy;if(a<=1e-10)return Infinity;
 const b=2*(x*dx+y*dy),disc=b*b-4*a*c;if(disc<0)return Infinity;
 const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:Infinity;
}
function stepOrb(orb,pets,dt,zoom=1,clear=()=>true){
 const live=pets.filter(p=>p&&p.alive!==false&&Number.isFinite(p.x)&&Number.isFinite(p.y));
 const padding=12/zoom;
 function first(dx,dy){
  let winner=null,time=Infinity,distance=Infinity;
  for(const p of live){
   const t=contactTime(orb,dx,dy,p,padding);if(!Number.isFinite(t))continue;
   const x=orb.x+dx*t,y=orb.y+dy*t;if(!clear(p.x,p.y,x,y))continue;
   // Ties at the beginning of a server tick go to the closest actual specimen.
   const d=Math.hypot(p.x-x,p.y-y);
   if(t<time-1e-8||Math.abs(t-time)<=1e-8&&(d<distance-1e-8||Math.abs(d-distance)<=1e-8&&String(p.id)<String(winner?.id))){winner=p;time=t;distance=d;}
  }return winner?{winner,time}:null;
 }
 const touched=first(0,0);if(touched)return {winner:touched.winner,moved:false};
 let attractor=null,best=Infinity;
 for(const p of live){const d=Math.hypot(p.x-orb.x,p.y-orb.y);if(d>fieldRadius(p.field,zoom)||!rank(p.field)||!clear(orb.x,orb.y,p.x,p.y))continue;if(d<best){best=d;attractor=p;}}
 if(!attractor||best<=0)return {winner:null,moved:false};
 const step=Math.min(best,fieldSpeed(attractor.field,zoom)*Math.max(0,Math.min(.12,Number(dt)||0)));
 const dx=(attractor.x-orb.x)/best*step,dy=(attractor.y-orb.y)/best*step;
 if(!clear(orb.x,orb.y,orb.x+dx,orb.y+dy))return {winner:null,moved:false};
 const hit=first(dx,dy);if(hit)return {winner:hit.winner,moved:false};
 orb.x+=dx;orb.y+=dy;return {winner:null,moved:step>0};
}
return Object.freeze({rank,POWER,RATE,predator,close,petAttack,petLife,petSpeed,petCadence,petInterval,fieldRadius,fieldSpeed,stepOrb});
});
