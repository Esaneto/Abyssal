/* Universal aquatic animation profiles for every Abyssal creature.
 * No sprite sheets, network packets, gameplay mutations, or independent loops.
 * Poses are deterministic; the optional tracker only smooths render activity
 * and anatomical facing from positions the game already owns. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.AbyssalSkinMotion=api;
})(globalThis,function(){
 'use strict';
 const PROFILES=Object.freeze({
  fish:{speed:3.1,bob:.016,roll:.012,tail:.24,fin:.08,pulse:.010},
  shark:{speed:2.9,bob:.013,roll:.016,tail:.28,fin:.12,pulse:.008},
  ray:{speed:2.5,bob:.025,roll:.025,tail:.14,fin:.26,pulse:.028},
  eel:{speed:3.35,bob:.012,roll:.044,tail:.42,fin:.032,pulse:.012},
  octopus:{speed:2.05,bob:.044,roll:.021,tail:.22,fin:.09,pulse:.047},
  squid:{speed:2.85,bob:.037,roll:.018,tail:.22,fin:.17,pulse:.042},
  jelly:{speed:1.62,bob:.050,roll:.019,tail:.16,fin:.28,pulse:.077},
  crustacean:{speed:3.55,bob:.009,roll:.024,tail:.07,fin:.08,pulse:.011},
  mollusc:{speed:1.32,bob:.009,roll:.014,tail:.05,fin:.04,pulse:.018},
  reptile:{speed:2.38,bob:.017,roll:.034,tail:.24,fin:.12,pulse:.013},
  benthic:{speed:1.43,bob:.024,roll:.013,tail:.07,fin:.19,pulse:.022},
  signature:{speed:2.55,bob:.024,roll:.013,tail:.19,fin:.12,pulse:.026}
 });
 const SIGNATURE_FAMILY=Object.freeze({
  kraken:'octopus',aberration:'octopus',riftSmileRelic:'octopus',bloodmoon:'octopus',
  toxic:'octopus',angler:'fish',leviathan:'fish',devourer:'squid',
  maw:'eel',greensnake:'eel',reefshark:'shark',hammerhead:'shark',abysscroc:'shark',
  saltcroc:'reptile',blackcaiman:'reptile',armoredgator:'crustacean',
  electriceel:'ray',violet:'jelly',voidwing:'ray',abyssaleye:'fish',
  deepwarden:'mollusc',abyssking:'mollusc',solar:'benthic',coral:'benthic',
  thorn:'benthic',glacier:'benthic',royal:'mollusc',default:'signature'
 });
 const ENEMY_FAMILY=Object.freeze({
  drifter:'jelly',stinger:'fish',brute:'crustacean',lurker:'eel',whiteShark:'shark',
  boss:'octopus',angler:'fish',maw:'eel',leviathan:'fish',whiteSharkBoss:'shark',
  kraken:'octopus',devourer:'squid',riftSmile:'octopus'
 });
 const ORIENTATION_LIMIT=Object.freeze({
  fish:.34,shark:.25,ray:.22,eel:.38,octopus:.16,squid:.20,jelly:.12,
  crustacean:.10,mollusc:.10,reptile:.22,benthic:.08,signature:.22
 });
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 function familyFor(s){
  if(typeof s==='string')return SIGNATURE_FAMILY[s]||'signature';
  return PROFILES[s?.family]?s.family:(SIGNATURE_FAMILY[s?.id]||'signature');
 }
 function familyForEntity(entity){
  if(!entity)return 'signature';
  if(entity.skin)return familyFor(entity.skin);
  if(PROFILES[entity.family])return entity.family;
  const kind=String(entity.kind||entity.id||'');
  if(ENEMY_FAMILY[kind])return ENEMY_FAMILY[kind];
  if(/shark|tubar/i.test(kind))return 'shark';
  if(/octo|kraken|polvo|smile/i.test(kind))return 'octopus';
  if(/squid|lula/i.test(kind))return 'squid';
  if(/jelly|medus|drifter/i.test(kind))return 'jelly';
  if(/eel|moray|enguia|maw|lurker/i.test(kind))return 'eel';
  if(/crab|shrimp|lobster|brute/i.test(kind))return 'crustacean';
  return familyFor(entity);
 }
 // Stable ID-based offset gives related species independent swimming rhythms.
 function hashId(id){let value=2166136261;for(const ch of String(id||'abyssal')){value=Math.imul(value^ch.charCodeAt(0),16777619);}return value>>>0;}
 function phaseOffsetMs(id){return (hashId(id)%4096)*1.37;}
 function pose(skin,ms=0,movement=1,attack=0,out=null){
  const family=familyFor(skin),id=typeof skin==='string'?skin:String(skin?.id||family),rig=PROFILES[family];
  const result=out||{};
  const hash=result.id===id&&Number.isFinite(result.motionHash)?result.motionHash:hashId(id),offset=(hash%1024)/1024*Math.PI*2;
  const active=.42+.58*clamp(Number(movement)||0,0,1);
  const attackAmount=clamp(Number(attack)||0,0,1);
  const time=Math.max(0,Number(ms)||0)*.001*(rig.speed*(.93+(hash%13)*.011));
  const wave=Math.sin(time+offset),recoil=Math.cos(time*1.3+offset*.55);
  const breath=Math.sin(time*.5+offset);
  // Assign fields directly when a tracker-owned result is provided. Avoiding
  // an intermediate object here prevents horde-sized garbage collection spikes.
  result.id=id;result.family=family;result.phase=time+offset;result.activity=active;result.attack=attackAmount;
  result.bob=rig.bob*wave*active;
  result.roll=rig.roll*recoil*active;
  result.stretchX=1+rig.pulse*breath*active-attackAmount*.018;
  result.stretchY=1-rig.pulse*.85*breath*active+attackAmount*.024;
  result.tail=rig.tail*recoil*(active+attackAmount*.18);
  result.fin=rig.fin*Math.sin(time*1.08+offset)*(active+attackAmount*.12);
  result.arms=rig.fin*Math.cos(time*.76+offset)*(active+attackAmount*.22);
  result.gait=rig.tail*Math.sin(time*1.95+offset)*active;
  result.recoil=attackAmount*.055;
  result.glow=.78+.22*(.5+.5*Math.sin(time*.58+offset));
  return result;
 }
 function anatomicalOrientation(angle,family='signature',out=null){
  let normalized=Number.isFinite(Number(angle))?Number(angle):0;
  normalized=Math.atan2(Math.sin(normalized),Math.cos(normalized));
  const facing=Math.cos(normalized)>=0?1:-1;
  let pitch=facing>0?normalized:Math.atan2(Math.sin(normalized-Math.PI),Math.cos(normalized-Math.PI));
  const limit=ORIENTATION_LIMIT[family]??ORIENTATION_LIMIT.signature;
  pitch=clamp(pitch,-limit,limit);
  const result=out||{};result.facing=facing;result.pitch=pitch;result.limit=limit;return result;
 }
 function createTracker({maxEntries=512}={}){
  const states=new Map();
  function sample(entity,ms=0){
   const id=String(entity?.id||entity?.kind||'creature'),family=familyForEntity(entity);
   let state=states.get(id);
   if(!state){const motionHash=hashId(id);state={id,family,motionHash,phaseOffset:(motionHash%4096)*1.37,orientation:{},x:Number(entity?.x)||0,y:Number(entity?.y)||0,at:Number(ms)||0,locomotion:.12,facing:1,facingScale:1,pitch:0,motionAngle:Number(entity?.angle)||0};states.set(id,state);if(states.size>maxEntries)states.delete(states.keys().next().value);}
   const now=Number(ms)||0,dt=clamp((now-state.at)/1000,.001,.1),x=Number(entity?.x)||0,y=Number(entity?.y)||0;
   const dx=x-state.x,dy=y-state.y,speed=Math.hypot(dx,dy)/dt,nominal=Math.max(1,Number(entity?.nominalSpeed)||90);
   const target=entity?.preview ? .18 : clamp(speed/nominal,0,1);
   const response=target>state.locomotion?8:4;
   state.locomotion+=(target-state.locomotion)*(1-Math.exp(-response*dt));
   if(speed>nominal*.025)state.motionAngle=Math.atan2(dy,dx);
   else if(!Number.isFinite(state.motionAngle))state.motionAngle=Number(entity?.angle)||0;
   const orientation=anatomicalOrientation(state.motionAngle,family,state.orientation);
   if(orientation.facing!==state.facing&&Math.abs(Math.cos(state.motionAngle))>.18)state.facing=orientation.facing;
   state.facingScale+=(state.facing-state.facingScale)*(1-Math.exp(-11*dt));
   state.pitch+=(orientation.pitch-state.pitch)*(1-Math.exp(-9*dt));
   state.family=family;state.x=x;state.y=y;state.at=now;
   state.phaseTime=now+state.phaseOffset;
   state.attack=clamp(Number(entity?.attack)||0,0,1);
   pose(state,state.phaseTime,state.locomotion,state.attack,state);
   return state;
  }
  function forget(id){states.delete(String(id));}
  function clear(){states.clear();}
  return {sample,forget,clear,size:()=>states.size};
 }
 return {PROFILES,SIGNATURE_FAMILY,ENEMY_FAMILY,ORIENTATION_LIMIT,familyFor,familyForEntity,hashId,phaseOffsetMs,pose,anatomicalOrientation,createTracker};
});
