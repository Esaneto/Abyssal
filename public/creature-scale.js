/* Abyssal biological scale. Approximate adult lengths/spans (m).
 * Diver reference: 1.8 m. Giant/hadal fictional forms use art-directed sizes.
 * Visual size is distinct from a conservative central collision core in narrow caves.
 * All clients use the same table; no RNG, allocations or timers on animation ticks.
 */
(function(root,factory){
 const curated=typeof module==='object'&&module.exports?require('./abyssal-curated-skins.js'):root.AbyssalCuratedSkins;
 const api=factory(curated);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalCreatureScale=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(curated){
 'use strict';
 const ADULT_METERS=Object.freeze({
  default:1.7,violet:1.1,solar:1.4,toxic:1.5,thorn:1.8,abyssking:2.8,
  royal:2.8,glacier:2.3,coral:1.8,bloodmoon:4.2,voidwing:4.6,abyssaleye:2.5,
  deepwarden:3.6,riftSmileRelic:13,kraken:11,aberration:6,angler:3.5,maw:7.5,
  leviathan:13,devourer:14,saltcroc:5,blackcaiman:4.2,reefshark:4.8,
  hammerhead:4.5,abysscroc:5.2,armoredgator:4.3,greensnake:2.1,
  electriceel:2.0,electriceellegacy:2.0,
  eagleray:2.2,ribbonmoray:1.2,dumbo:.35,blanket:2.0,atolla:.25,
  phantomjelly:6.0,yeticrab:.15,nautilus:.22,gharial:4.6,goblin:3.4,
  frilled:1.6,greenland:5.1,butterflyray:2.8,stingray:1.6,
  guitarfish:2.1,sawtootheel:1.8,zebramoray:1.2,dogtootheel:1.5,
  mimic:.8,glassoctopus:.5,combjelly:.22,helmetjelly:.6,
  siphonophore:8,spidercrab:3.0,deeplobster:.65,pistolshrimp:.05,
  scalyfoot:.04,bluedragon:.04,whelk:.28,leatherback:2.0,
  seasnake:1.7,hawksbill:.9,jewelsquid:.4,bigfin:5.5,whiplash:1.4,
  viperfish:.32,blackdragon:.38,hatchetfish:.12,basketstar:.8,
  crinoid:.35,seapig:.16
 });
 // Gameplay lengths, in metres. The source adult specimen table remains biological.
 const DIVER_METERS=1.8;
 // 100 model units from crown to soles, scaled by the actual gameplay diver rig.
 const DIVER_WORLD_LENGTH=100*(13/.78)*.60/14;
 const PIXELS_PER_METER=DIVER_WORLD_LENGTH/DIVER_METERS;
 const BOSS_METERS=Object.freeze({boss:5.2,angler:4,maw:6.5,leviathan:8,whiteSharkBoss:8,kraken:8,devourer:8,riftSmile:8});
 const MONSTER_METERS=Object.freeze({drifter:.5,stinger:.5,brute:.5,lurker:.8,whiteShark:4.8,...BOSS_METERS});
 const ART_SPAN=Object.freeze({drifter:2,stinger:3.02,brute:2.45,lurker:3.4,whiteShark:3.1,whiteSharkBoss:3.1,boss:5.5,angler:3.1,maw:4.5,leviathan:5.2,kraken:9.6,devourer:3.3,riftSmile:4.6});
 // Collision uses the visible central body; elongated tails/fins remain non-solid.
 const BODY_CORE=Object.freeze({drifter:.8,stinger:.65,brute:.95,lurker:.7,whiteShark:.84,whiteSharkBoss:.84,boss:1,angler:1,maw:1,leviathan:.8,kraken:.76,devourer:1.3,riftSmile:1});
 const SKIN_SPAN=Object.freeze({reefshark:3.1,hammerhead:2.7,abysscroc:3.3,gharial:3.6,goblin:3.4,frilled:3.7,greenland:3.2,saltcroc:3.7,blackcaiman:3.7,greensnake:4.4,electriceellegacy:4.4,ribbonmoray:4.4,sawtootheel:4.4,zebramoray:4.4,dogtootheel:4.4,leviathan:5.2,maw:4.5,kraken:9.6,devourer:3.3,aberration:5.5,riftSmileRelic:5.4,phantomjelly:4.5,siphonophore:5.5});
 const FAMILY_SPAN=Object.freeze({shark:3.2,eel:4.4,ray:3.5,octopus:5.5,squid:5.5,jelly:3.5,crustacean:3.2,mollusc:2.8,reptile:3.7,benthic:2.8,fish:3.1,signature:3.0});
 const sizeOf=id=>ADULT_METERS[String(id)]||null;
 const skinFamily=id=>curated?.byId?.[id]?.family||null;
 const skinSpan=id=>SKIN_SPAN[id]||FAMILY_SPAN[skinFamily(id)]||3.2;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function monsterMeters(kind,skinId=null){if(skinId)return Math.max(.5,sizeOf(skinId)||MONSTER_METERS[kind]||1.8);return MONSTER_METERS[kind]||1.8;}
 function companionMeters(id){return clamp(sizeOf(id)||1.8,.5,3);}
 function visualRadius(id,base=11){return companionMeters(id)*PIXELS_PER_METER/skinSpan(id);}
 function monsterVisualRadius(kind,base=10,skinId=null){return monsterMeters(kind,skinId)*PIXELS_PER_METER/(skinId?skinSpan(skinId):ART_SPAN[kind]||3.2);}
 function riftVisualRadius(kind,base=10,skinId=null){return monsterVisualRadius(kind,base,skinId);}
 function creatureCollisionRadius(base=10,skinId=null,kind=null){
  if(!kind&&!skinId)return Math.max(2,Number(base)||10);
  return monsterVisualRadius(kind,base,skinId)*(skinId ? .82 : (BODY_CORE[kind]||.82));
 }
 function companionCollisionRadius(id){return visualRadius(id)*.82;}
 // The classic Abyssary displays these full, unscaled HP values.
 const CLASSIC_HP=Object.freeze({drifter:72,stinger:65,brute:115,lurker:165,whiteShark:600,boss:5640,angler:6520,maw:7500,leviathan:9400,whiteSharkBoss:13200,kraken:18400,devourer:30000,riftSmile:52000});
 function healthStep(seconds){return clamp(Math.floor(Math.max(0,Number(seconds)||0)/120),0,8);}
 function healthMultiplier(seconds){return (2+healthStep(seconds))/10;}
 function scaledHealth(base,seconds){return Math.max(1,Math.round(Math.max(1,Number(base)||1)*healthMultiplier(seconds)));}
 function applyHealthRamp(enemy,seconds){
  const base=Number(enemy.fullHp);if(!(base>0)||enemy.hp<=0)return false;
  const next=scaledHealth(base,seconds),before=Math.max(1,Number(enemy.maxHp)||next);
  if(next===before)return false;
  const fraction=clamp((Number(enemy.hp)||0)/before,0,1);
  enemy.maxHp=next;enemy.hp=Math.max(1,Math.min(next,Math.round(next*fraction)));
  if(Number.isFinite(enemy.damageRevision))enemy.damageRevision++;
  return true;
 }
 return Object.freeze({ADULT_METERS,MONSTER_METERS,BOSS_METERS,DIVER_METERS,DIVER_WORLD_LENGTH,PIXELS_PER_METER,ART_SPAN,CLASSIC_HP,sizeOf,monsterMeters,companionMeters,visualRadius,monsterVisualRadius,riftVisualRadius,creatureCollisionRadius,companionCollisionRadius,healthStep,healthMultiplier,scaledHealth,applyHealthRamp});

});
