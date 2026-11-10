'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const geo=require('../public/abyssal-ocean-geography.js');
const stream=require('../public/abyssal-ocean-stream.js');
const resources=require('../public/abyssal-resource-fields.js');
const renderer=require('../public/abyssal-open-sea-render.js');
const lamp=require('../public/abyssal-open-sea-lighting.js');
const respawn=require('../public/abyssal-ocean-respawn.js');

test('a coastal swimming corridor remains open with diver clearance',()=>{
  assert.equal(geo.isSolid(180,260,24),false);
  assert.equal(geo.segmentClear(180,260,3150,260,24),true);
});

test('rock silhouettes are collidable with the same authored geometry',()=>{
 for(const rock of geo.ROCKS)for(let i=0;i<12;i++){
  const angle=i*Math.PI/6;
  const inner=geo.rockSurfaceAt(rock,angle,-10);
  assert.equal(geo.rockContains(rock,inner.x,inner.y),true,rock.id+' interior');
 }
});

test('all six cave entrances have navigable primary tunnels',()=>{
 assert.equal(geo.CAVES.length,6);
 for(const cave of geo.CAVES){
  const [entry,next]=cave.nodes;
  assert.equal(geo.isSolid(entry.x,entry.y,18),false,cave.id+' entrance');
  assert.equal(geo.segmentClear(entry.x,entry.y,next.x,next.y,18),true,cave.id+' tunnel');
 }
});

test('wildlife generation is deterministic and death cooldown is exactly five minutes',()=>{
 assert.equal(respawn.RESPAWN_MS,300000);
 const tracker=respawn.createTracker();
 tracker.mark('cell:fauna1',5000);
 assert.equal(tracker.ready('cell:fauna1',304999),false);
 assert.equal(tracker.ready('cell:fauna1',305000),true);
 const ecology={
  speciesAt:()=> 'reefshark',
  temperament:()=> 'aggressive',
  isSchooling:()=>false
 };
 assert.deepEqual(stream.generate('persistent-wildlife',0,0,ecology),stream.generate('persistent-wildlife',0,0,ecology));
});

test('minerals stream only near the player',()=>{
 const rocks=resources.streamNear('profile',2600,890,1600,new Set());
 assert.ok(Array.isArray(rocks));
 assert.ok(rocks.every(n=>Math.hypot(n.x-2600,n.y-890)<=1600));
});

test('sunlight fades by real depth, flashlight upgrades broaden illumination',()=>{
 assert.ok(geo.lightAt(geo.HEIGHT*900/2200)<.0005);
 assert.equal(geo.metersAt(geo.HEIGHT),2200);
 assert.ok(lamp.parameters(1400,3).range>lamp.parameters(1400,0).range);
 assert.ok(lamp.parameters(1400,3).halfAngle>lamp.parameters(1400,0).halfAngle);
});

test('Open Sea renderers operate with canvas primitives across depths',()=>{
 const ctx=new Proxy({},{get(obj,key){
  if(key in obj)return obj[key];
  if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
  return ()=>{};
 },set(obj,key,value){obj[key]=value;return true;}});
 assert.doesNotThrow(()=>renderer.draw(ctx,{left:200,top:-100,width:1100,height:900},2000,false));
 assert.doesNotThrow(()=>renderer.draw(ctx,{left:6000,top:11000,width:1200,height:900},2000,true));
 assert.doesNotThrow(()=>lamp.draw(ctx,{left:200,top:400,width:900,height:650},{x:500,y:1100,bodyAngle:.3,weaponAngle:.5,r:17},2,500,false));
});

test('muzzle, hatch, and offshore installation states remain integrated',()=>{
 const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const oceanMenu=fs.readFileSync(path.join(__dirname,'../public/abyssal-menu-ocean.js'),'utf8');
 const runtime=fs.readFileSync(path.join(__dirname,'../public/abyssal-exploration-runtime.js'),'utf8');
 const offshore=fs.readFileSync(path.join(__dirname,'../public/abyssal-offshore-system.js'),'utf8');
 const surface=fs.readFileSync(path.join(__dirname,'../public/abyssal-submarine-laboratory.css'),'utf8');
 assert.match(game,/x:gunTip\.x,y:gunTip\.y/);
 assert.match(game,/x:gunTip\.x\/W,y:gunTip\.y\/H/);
 assert.match(oceanMenu,/--abyss-hatch-y/);
 assert.match(surface,/#submarineWorkshopBtn\.abyss-laboratory-hatch/);
 assert.match(runtime,/Offshore\.transition\(/);
 assert.match(runtime,/explorationOffshoreAction/);
 assert.match(offshore,/phase:'laying'/);
 assert.match(offshore,/phase:'return'/);
 assert.match(offshore,/connections:\[\.\.\.data\.connections/);
});
