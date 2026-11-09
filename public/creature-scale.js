/* Abyssal biological scale. Approximate adult lengths/spans (m).
 * Diver reference: 1.7 m. Giant/hadal fictional forms use art-directed sizes.
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
  leviathan:13,devourer:14,saltcroc:5,blackcaiman:4.2,reefshark:2.4,
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
 const MONSTER_METERS=Object.freeze({
  drifter:.7,stinger:.3,brute:1.9,lurker:2.6,whiteShark:4.8,
  boss:5.2,angler:4,maw:8,leviathan:14,whiteSharkBoss:9,
  kraken:16,devourer:20,riftSmile:29
 });
 // In-game art radius is based on the animal's major body axis, not weight.
 // At 1.7 m, the diver's drawn body is roughly 40 logical pixels high.
 const PIXELS_PER_METER=9.3;
 const sizeOf=id=>ADULT_METERS[String(id)]||null;
 // Gameplay-friendly visual scale: preserve biological ordering without letting
 // a companion obscure the diver or giant enemies fill a whole chamber.
 // A softer curve maintains visible differences between the smallest and largest.
 function visualRadius(id,base=11){
  const meters=sizeOf(id);
  if(meters===null)return Math.max(8,Math.min(18,Number(base)||11));
  return Math.max(14.5,Math.min(38,14.5+Math.sqrt(meters)*6.25));
 }
 function monsterVisualRadius(kind,base=10,skinId=null){
  const length=skinId?sizeOf(skinId):MONSTER_METERS[String(kind)];
  if(!length)return Math.max(8,Math.min(78,Number(base)||10));
  // Monsters can be bigger than companions; bosses are imposing without
  // concealing the screen. The final boss has its own chamber-scale ceiling.
  const boss=skinId===null&&['boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer','riftSmile'].includes(String(kind));
  const cap=kind==='riftSmile'&&!skinId?175:boss?138:skinId?105:83;
  const radius=(boss?29:19)+Math.sqrt(length)*(boss?20:12.4);
  return Math.max(8,Math.min(cap,radius));
 }
 // Fossas use a legible, near-linear biological scale rather than the
 // compact sqrt scale of the open sea. Radius affects artwork only, not hits.
 // Tiny fauna remain at least half a diver's approximate 40px body length.
 function riftVisualRadius(kind,base=10,skinId=null){
  const meters=skinId?sizeOf(skinId):MONSTER_METERS[String(kind)];
  if(!Number.isFinite(meters)||meters<=0)return monsterVisualRadius(kind,base,skinId);
  const boss=!skinId&&['boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer','riftSmile'].includes(String(kind));
  const cap=kind==='riftSmile'&&!skinId?205:boss?190:skinId?165:110;
  return Math.max(17,Math.min(cap,14+meters*12));
 }
 // Large octopus arms and jelly tentacles are non-solid; a central
 // collision body fits in caves while the full animal remains visible.
 function creatureCollisionRadius(base=10,skinId=null){
  const original=Math.max(2,Number(base)||10);
  if(!skinId)return original;
  const meters=sizeOf(skinId);
  if(meters===null)return original;
  return Math.max(5,Math.min(original*1.55,Math.max(original*.8,meters*PIXELS_PER_METER*.36)));
 }
 return Object.freeze({ADULT_METERS,MONSTER_METERS,PIXELS_PER_METER,sizeOf,visualRadius,monsterVisualRadius,riftVisualRadius,creatureCollisionRadius});
});
