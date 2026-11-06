'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const AbyssalMap=require('../public/abyssal-map.js');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

function terrainHarness(){
 const jobs=[],images=[],drawn=[];
 const canvasContext={
  createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),
  putImageData:()=>{}
 };
 const ctx={
  save(){},restore(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},
  stroke(){},fill(){},ellipse(){},arc(){},drawImage(canvas){drawn.push(canvas);},
  createRadialGradient:()=>({addColorStop(){}})
 };
 const context={
  window:{},
  document:{createElement(tag){
   assert.equal(tag,'canvas');
   const canvas={width:0,height:0,getContext:()=>canvasContext};
   images.push(canvas);
   return canvas;
  }},
  requestIdleCallback:callback=>{jobs.push(callback);return jobs.length;},
  setTimeout:callback=>{jobs.push(callback);return jobs.length;},
  Math
 };
 vm.runInNewContext(read('public/ocean-terrain.js'),context,{filename:'ocean-terrain.js'});
 return {terrain:context.window.AbyssalTerrain,ctx,jobs,images,drawn};
}

test('Fossas first frame paints immediately without a full-world pixel raster',()=>{
 const {terrain,ctx,jobs,images,drawn}=terrainHarness();
 const layout=AbyssalMap.createLayout('fast-entry-test',0);
 terrain.draw(ctx,layout,2120,50,710,580,100);
 assert.equal(images.length,0,'the initial frame must not allocate/rasterize a giant image');
 assert.equal(drawn.length,0,'terrain tiles should appear only after the first frame');
 assert.ok(jobs.length>0,'tile generation should be deferred');
 const before=terrain.stats(layout);
 assert.equal(before.built,0);
 assert.ok(before.queued>0);
 jobs.shift()();
 assert.equal(images.length,1,'each idle job renders exactly one tile');
 assert.ok(images[0].width<=96&&images[0].height<=96,'maximum tile size must be 96x96 pixels');
 terrain.draw(ctx,layout,2120,50,710,580,140);
 assert.ok(drawn.length>=1,'finished tile must become visible after the next draw');
 assert.equal(terrain.stats(layout).built,1);
});

test('visible terrain tiles complete progressively and are reused',()=>{
 const {terrain,ctx,jobs,images,drawn}=terrainHarness();
 const layout=AbyssalMap.createLayout(17021,0);
 terrain.draw(ctx,layout,2200,210,900,600,1);
 const pending=terrain.stats(layout).queued;
 assert.ok(pending>1&&pending<30,'work must be scoped to current viewport');
 for(let i=0;i<pending&&jobs.length;i++)jobs.shift()();
 assert.equal(terrain.stats(layout).queued,0);
 assert.equal(terrain.stats(layout).cached,pending);
 assert.ok(images.every(item=>item.width<=96&&item.height<=96));
 const built=terrain.stats(layout).built;
 terrain.draw(ctx,layout,2200,210,900,600,80);
 assert.equal(terrain.stats(layout).built,built,'revisiting a cached view must not rasterize again');
 assert.ok(drawn.length>=pending,'each visible cached tile is drawn');
 const next=AbyssalMap.createLayout(17021,1);
 terrain.draw(ctx,next,2200,210,900,600,120);
 assert.equal(terrain.stats(next).built,0,'next tier must remain nonblocking');
});

test('slow offline network cannot delay individual game scripts during cave entry',()=>{
 const sw=read('public/offline-sw.js');
 const html=read('public/index.html');
 assert.match(html,/ocean-terrain\.js\?v=3/);
 assert.match(sw,/const VERSION = '2026-11-06-hadal-nightmare-v11'/);
 assert.match(sw,/abyssal-tutorial-art\.js/);
 assert.match(sw,/abyssal-rift-hardcore\.js/);
 assert.match(sw,/if \(inShell && !isNavigation && cached\)/);
 assert.match(sw,/event\.waitUntil\?\.\(refresh\)/);
 assert.match(sw,/return cached;/);
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/url\.pathname\.startsWith\('\/socket\.io\/'\)/);
});
