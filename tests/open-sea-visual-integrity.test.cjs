'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const geo=require('../public/abyssal-ocean-geography.js');
const deposits=require('../public/abyssal-resource-fields.js');
const render=require('../public/abyssal-open-sea-render.js');

test('Open Sea depth and illumination share the 2,200m scale',()=>{
 assert.equal(geo.metersAt(geo.HEIGHT),2200);
 assert.ok(geo.lightAt(0)>.9);
 assert.ok(geo.lightAt(geo.HEIGHT*200/2200)>.10);
 assert.equal(geo.lightAt(geo.HEIGHT*1000/2200),0);
 assert.equal(deposits.depthAt(geo.HEIGHT*.5),1100);
});
test('shallow shelf supports reef and kelp; deep habitats stay deep',()=>{
 const reefY=geo.floorAt(900)-45;
 const kelpY=geo.floorAt(2150)-45;
 assert.ok(geo.metersAt(reefY)<210);
 assert.ok(geo.metersAt(kelpY)<210);
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
