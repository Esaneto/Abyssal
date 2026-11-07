/* Animated anatomy profiles for all Abyssal playable skins.
 * No sprite sheets, network packets, dependencies, or per-actor timers.
 * A pose is a deterministic function of skin ID and presentation time. */
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
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 function familyFor(s){
  if(typeof s==='string')return SIGNATURE_FAMILY[s]||'signature';
  return PROFILES[s?.family]?s.family:(SIGNATURE_FAMILY[s?.id]||'signature');
 }
 // Stable ID-based offset gives related species independent swimming rhythms.
 function hashId(id){let value=2166136261;for(const ch of String(id||'abyssal')){value=Math.imul(value^ch.charCodeAt(0),16777619);}return value>>>0;}
 function pose(skin,ms=0,movement=1){
  const family=familyFor(skin),id=typeof skin==='string'?skin:String(skin?.id||family),rig=PROFILES[family];
  const hash=hashId(id),offset=(hash%1024)/1024*Math.PI*2;
  const active=.42+.58*clamp(Number(movement)||0,0,1);
  const time=Math.max(0,Number(ms)||0)*.001*(rig.speed*(.93+(hash%13)*.011));
  const wave=Math.sin(time+offset),recoil=Math.cos(time*1.3+offset*.55);
  const breath=Math.sin(time*.5+offset);
  return {
   id,family,phase:time+offset,activity:active,
   bob:rig.bob*wave*active,
   roll:rig.roll*recoil*active,
   stretchX:1+rig.pulse*breath*active,
   stretchY:1-rig.pulse*.85*breath*active,
   tail:rig.tail*recoil*active,
   fin:rig.fin*Math.sin(time*1.08+offset)*active,
   arms:rig.fin*Math.cos(time*.76+offset)*active,
   gait:rig.tail*Math.sin(time*1.95+offset)*active,
   glow:.78+.22*(.5+.5*Math.sin(time*.58+offset))
  };
 }
 return {PROFILES,SIGNATURE_FAMILY,familyFor,hashId,pose};
});