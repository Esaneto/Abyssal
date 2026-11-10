'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const geo=require('../public/abyssal-ocean-geography.js');
const eco=require('../public/abyssal-open-sea-ecology.js');
const stream=require('../public/abyssal-ocean-stream.js');
const fields=require('../public/abyssal-resource-fields.js');
const renderer=require('../public/abyssal-open-sea-render.js');

test('three visual biomes resolve deterministically from world coordinate and depth',()=>{
 assert.equal(geo.visualBiomeAt(1200,700).id,'coastal');
 assert.equal(geo.visualBiomeAt(8500,2900).id,'cinematic');
 assert.equal(geo.visualBiomeAt(19000,8000).id,'geological');
 assert.equal(geo.visualBiomeAt(22000,18000).id,'geological');
 assert.equal(geo.visualBiomeAt(8500,2900),geo.visualBiomeAt(8500,2900));
 assert.equal(geo.VISUAL_BIOMES.cinematic.label,'CÂNIONS SUBMERSOS');
});
test('store-specimen populations differ and the initial water pocket stays predator-free',()=>{
 const coast=eco.habitatAt(1000,700),canyon=eco.habitatAt(8500,2900),rock=eco.habitatAt(19000,8000);
 assert.equal(coast.visualId,'coastal');assert.equal(canyon.visualId,'cinematic');assert.equal(rock.visualId,'geological');
 assert.notDeepEqual(eco.VISUAL_FAUNA.coastal.shelf,eco.VISUAL_FAUNA.cinematic.shelf);
 assert.notDeepEqual(eco.VISUAL_FAUNA.cinematic.twilight,eco.VISUAL_FAUNA.geological.twilight);
 for(let i=0;i<20;i++){
  const id=eco.speciesAt(250,400,()=>i/20);
  assert.equal(eco.predatorAllowedAt(id,250,400),true);
 }
});
test('streaming is sparse, stable and preserves the small safe entry region',()=>{
 const a=stream.generate('three-biomes',0,0,eco);
 assert.deepEqual(a,stream.generate('three-biomes',0,0,eco));
 assert.ok(a.animals.every(p=>!(p.x<850&&p.y<780)));
 assert.ok(stream.INITIAL_FAUNA<=3);
});
test('petroleum and natural gas deposits only identify rock-hosted fractures',()=>{
 const seen=new Set();let checked=0;
 const supports=geo.ROCKS.filter(r=>geo.metersAt(r.y)>350).slice(0,32);
 for(const rock of supports){
  for(const node of fields.streamNear('three-biomes-resource-test',rock.x,rock.y,1500)){
   if(seen.has(node.id))continue;seen.add(node.id);
   if(node.type!=='oilSeep'&&node.type!=='gasSeep')continue;
   checked++;assert.equal(node.feature,'rock-reservoir');
   assert.ok(Number.isFinite(node.rockAngle));
   assert.equal(geo.isSolid(node.x,node.y,18),false);
  }
 }
 assert.ok(seen.size>0,'geological outcrops should expose resource nodes');
 assert.ok(checked>0,'real rock fissures should host at least one hydrocarbon node');
});
test('camera-limited biome renderers and UI remain available across the same ocean',()=>{
 const canvas=new Proxy({}, {get(_,key){
  if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
  return ()=>{};
 },set(){return true;}});
 for(const view of [
  {left:350,top:200,width:1200,height:800},
  {left:8400,top:2400,width:1200,height:1000},
  {left:18000,top:7300,width:1400,height:900},
  {left:19500,top:18300,width:900,height:800}
 ])assert.doesNotThrow(()=>renderer.draw(canvas,view,1700,false));
 const ui=fs.readFileSync(path.join(__dirname,'../public/abyssal-exploration-runtime.js'),'utf8');
 assert.match(ui,/explorationBiome/);
});
