'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const geo=require('../public/abyssal-ocean-geography.js');
const deposits=require('../public/abyssal-resource-fields.js');
const render=require('../public/abyssal-open-sea-render.js');

test('Open Sea depth and illumination share the 2,200m scale',()=>{
 assert.equal(geo.metersAt(geo.HEIGHT),2200);
 assert.ok(geo.lightAt(0)>.9);
 assert.ok(geo.lightAt(geo.HEIGHT*200/2200)<.01);
 assert.equal(geo.lightAt(geo.HEIGHT*1000/2200),0);
 assert.equal(deposits.depthAt(geo.HEIGHT*.5),1100);
});
test('shallow shelf supports reef and kelp; deep habitats stay deep',()=>{
 const reefY=geo.floorAt(900)-45;
 const kelpY=geo.floorAt(2150)-45;
 assert.ok(geo.metersAt(reefY)<100);
 assert.ok(geo.metersAt(kelpY)<100);
 assert.equal(geo.classify(900,reefY),'reef');
 assert.equal(geo.classify(2150,kelpY),'kelp');
 assert.equal(geo.classify(15000,geo.HEIGHT*.91),'abyss');
});
test('starting diver and above-water surface remain navigable',()=>{
 assert.equal(geo.isSolid(180,260,24),false);
 assert.ok(geo.ROCKS.every(r=>Number.isFinite(r.x)&&Number.isFinite(r.y)&&r.y>=0&&r.y<=geo.HEIGHT));
});
test('low power renderer tolerates surface sky and deep world bounds',()=>{
 const gradient=()=>({addColorStop(){}});
 const canvas=new Proxy({}, {get(_,key){
  if(key==='createLinearGradient'||key==='createRadialGradient')return gradient;
  return ()=>{};
 },set(){return true;}});
 assert.doesNotThrow(()=>render.draw(canvas,{left:0,top:-180,width:1300,height:950},1,true));
 assert.doesNotThrow(()=>render.draw(canvas,{left:17500,top:18000,width:1200,height:1100},1,true));
});

test('new wildlife silhouettes use exact specimen-store palette without replacing anatomy',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const curated=require('../public/abyssal-curated-skins.js');
 const source=fs.readFileSync(path.join(__dirname,'../public/abyssal-fauna-anatomy.js'),'utf8');
 const sandbox={AbyssalCuratedSkins:curated};
 vm.runInNewContext(source,sandbox,{filename:'abyssal-fauna-anatomy.js'});
 const art=sandbox.AbyssalFaunaAnatomy;
 for(const id of ['goblin','frilled','butterflyray','eagleray','stingray','hawksbill','leatherback',
  'spidercrab','yeticrab','nautilus','zebramoray','bigfin','whiplash','viperfish',
  'blackdragon','seapig','siphonophore']){
  assert.equal(art.supported(id),true,id+' keeps its approved shape');
  assert.equal(art.paletteFor(id).primary,curated.byId[id].color,id+' must use the SHOP theme');
 }
 assert.doesNotMatch(source,/hue-rotate\(/,'no arbitrary approximation of shop color by hue rotation');
 const paints=[],angles=[];
 const ctx=new Proxy({},{
  get(_,key){
   if(key==='createLinearGradient')return ()=>({addColorStop(_position,color){paints.push(color);}});
   if(key==='rotate')return angle=>angles.push(angle);
   return ()=>{};
  },
  set(_,key,value){if(key==='fillStyle'||key==='strokeStyle')paints.push(value);return true;}
 });
 for(const id of ['goblin','eagleray','bigfin','hawksbill','nautilus','seapig','siphonophore']){
  const enemy={specimenSkinId:id,x:500,y:600,angle:0,phase:0};
  paints.length=0;
  assert.equal(art.draw(ctx,enemy,42,1000),true,id+' can draw');
  assert.ok(paints.includes(curated.byId[id].color),id+' must actually paint using its shop color');
 }
 const animal={specimenSkinId:'eagleray',x:500,y:600,angle:0,phase:0};
 angles.length=0;
 art.draw(ctx,animal,40,2000);
 animal.angle=Math.PI;
 art.draw(ctx,animal,40,2016);
 assert.ok(Math.abs(angles[1]-angles[0])<1,'a new AI heading must turn smoothly, not snap 180 degrees');
});

test('deep geological waters contain camera-culled living light without altering rock collision',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../public/abyssal-open-sea-render.js'),'utf8');
 assert.match(source,/function drawGeologicalBacklight\(/);
 assert.match(source,/drawGeologicalBacklight\(ctx,left,top,right,bottom,time,lowPower\);/);
 assert.match(source,/geo\.visualBiomeAt\?\.\(x,y\)\?\.id!=='geological'/);
 assert.match(source,/const tile=660/);
 assert.match(source,/if\(lowPower\)continue;/);
 assert.ok(geo.ROCKS.length>0);
});

test('geological bioluminescent colonies are anchored to real rock surfaces and capped',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../public/abyssal-open-sea-render.js'),'utf8');
 assert.match(source,/function drawDeepRockColonies\(/);
 assert.match(source,/geo\.rockSurfaceAt\(rock,angle,3\)/);
 assert.match(source,/if\(visible>=14\)break/);
 assert.match(source,/if\(lowPower\)return/);
 assert.match(source,/drawDeepRockColonies\(ctx,left,top,right,bottom,time,lowPower\)/);
});
