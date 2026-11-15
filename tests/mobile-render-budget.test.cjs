'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const game=fs.readFileSync('public/game.js','utf8');
const cave=require('../public/abyssal-solo-cavern.js');
test('mobile DPR is bounded independently of desktop and world coordinates',()=>{
 const source=game.slice(game.indexOf('function graphicsDpr()'),game.indexOf('const $ ='));
 const ctx={window:{devicePixelRatio:3},ADAPTIVE_QUALITY:[{dpr:.75},{dpr:1},{dpr:Infinity}],MOBILE_DPR_CAPS:[1.25,1.75,2.5],adaptiveQualityLevel:2,adaptiveQualityCeiling:2,mobileViewport:true,viewW:390,viewH:844};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 assert.equal(ctx.graphicsDpr(),2.5);ctx.adaptiveQualityLevel=0;assert.equal(ctx.graphicsDpr(),2.5);ctx.adaptiveQualityCeiling=1;assert.equal(ctx.graphicsDpr(),1.75);ctx.adaptiveQualityCeiling=0;assert.equal(ctx.graphicsDpr(),1.25);ctx.adaptiveQualityCeiling=2;ctx.viewW=1000;ctx.viewH=1000;assert.equal(ctx.graphicsDpr(),2);ctx.viewW=390;ctx.viewH=844;
 ctx.mobileViewport=false;ctx.adaptiveQualityLevel=2;assert.equal(ctx.graphicsDpr(),3);ctx.adaptiveQualityLevel=1;assert.equal(ctx.graphicsDpr(),1);ctx.adaptiveQualityLevel=0;assert.equal(ctx.graphicsDpr(),1);
});
test('mobile graphics falls after sustained overload and recovers slowly up to preference',()=>{
 const source=game.slice(game.indexOf('function updateAdaptivePerformance(now)'),game.indexOf('window.AbyssalAdaptivePerformance='));
 const ctx={mobileViewport:true,gameState:'playing',onlineMode:false,adaptiveQualityLevel:2,adaptiveQualityCeiling:2,adaptiveQualityLastCheck:0,adaptiveQualityBadWindows:0,adaptiveQualityGoodWindows:0,adaptiveFrameCost:0,adaptiveFrameCount:0,gameLastUpdateMs:10,gameLastDrawMs:20};
 ctx.applyAdaptiveQuality=(level)=>{ctx.adaptiveQualityLevel=level;};vm.createContext(ctx);vm.runInContext(source,ctx);
 let t=1;for(;t<4400;t+=34)ctx.updateAdaptivePerformance(t);
 assert.equal(ctx.adaptiveQualityLevel,1);
 for(;t<8800;t+=34)ctx.updateAdaptivePerformance(t);assert.equal(ctx.adaptiveQualityLevel,0);
 ctx.gameLastUpdateMs=2;ctx.gameLastDrawMs=4;
 for(let i=0;i<1100;i++,t+=16)ctx.updateAdaptivePerformance(t);
 assert.equal(ctx.adaptiveQualityLevel,1);
 ctx.adaptiveQualityCeiling=1;
 for(let i=0;i<1200;i++,t+=16)ctx.updateAdaptivePerformance(t);
 assert.equal(ctx.adaptiveQualityLevel,1);
 ctx.mobileViewport=false;ctx.gameLastDrawMs=50;
 for(let i=0;i<300;i++,t+=34)ctx.updateAdaptivePerformance(t);
 assert.equal(ctx.adaptiveQualityLevel,1);
});
test('mobile static art is allocated once, mask stays bounded, ray geometry unchanged',()=>{
 const oldDocument=global.document,allocations=[];
 const ctx=new Proxy({}, {get:(obj,key)=>key in obj?obj[key]:key==='getTransform'?()=>({a:.5,b:0}):key==='createLinearGradient'||key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}});
 try{
  global.document={createElement(){const canvas={width:0,height:0,getContext:()=>ctx};allocations.push(canvas);return canvas;}};
  const view={left:200,top:150,width:1000,height:1500};
  cave.paint(ctx,view,100,4800,3000,true);const count=allocations.length;
  assert.equal(count,1);cave.paint(ctx,view,200,4800,3000,true);assert.equal(allocations.length,count);
  const rocks=cave.buildRocks(4800,3000),player={x:2400,y:330,r:17,bodyAngle:0};
  cave.lighting(ctx,view,player,1,rocks,100,[],true);
  assert.equal(allocations.length,2);assert.ok(Math.max(allocations[1].width,allocations[1].height)<=640);
  for(let i=0;i<32;i++){const a=i*Math.PI/16;assert.equal(cave.rayDistance(rocks,player.x,player.y,Math.cos(a),Math.sin(a),570),cave.rayDistance(rocks,player.x,player.y,Math.cos(a),Math.sin(a),570,true));}
 }finally{if(oldDocument===undefined)delete global.document;else global.document=oldDocument;}
});