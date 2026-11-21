'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(ROOT,'public/abyssal-squad-map.js'),'utf8');
function run(){
 const calls=[];
 const sample={x:215,y:312,rx:50,ry:40,angle:0,vertices:[[-50,-40],[50,-40],[50,40],[-50,40]]};
 const context={document:{readyState:'loading',addEventListener(type,fn){calls.push(type);}},
 AbyssalSoloCavern:{buildRocks(w,h){assert.equal(w,4800);assert.equal(h,3000);return [sample];}}};
 vm.runInNewContext(script,context,{filename:'abyssal-squad-map.js'});
 return {world:context.AbyssalSquadMapWorld,calls};
}
test('nine areas, eight independent biomes and cave spawns',()=>{
 const {world}=run();
 assert.equal(world.width,9600);assert.equal(world.height,6000);
 assert.equal(world.zones.length,9);assert.equal(world.caves.length,8);
 assert.equal(new Set(world.caves.map(x=>x.zone)).size,8);
 assert.equal(world.center.x,2400);assert.equal(world.center.y,1500);
 assert.equal(world.center.w,4800);assert.equal(world.center.h,3000);
});
test('classic geometry uses original world coordinates, translated only',()=>{
 const {world}=run();
 assert.equal(world.sourceRocks,1);
 const r=world.rocks.find(x=>x.classic);
 assert.ok(r);
 assert.equal(r.x,2615);assert.equal(r.y,1812);
 assert.deepEqual(JSON.parse(JSON.stringify(r.points)),[[2565,1772],[2665,1772],[2665,1852],[2565,1852]]);
});
test('every generated cave has a chamber, one entrance gap and vortex',()=>{
 const {world}=run();
 for(const cave of world.caves){
  const z=world.zones.find(x=>x.id===cave.zone);
  assert.ok(cave.x>z.x&&cave.x<z.x+z.w);
  assert.ok(cave.y>z.y&&cave.y<z.y+z.h);
  assert.equal(cave.vortex.x,cave.x);assert.equal(cave.vortex.y,cave.y);
  assert.ok(cave.wallPolygons.length>15&&cave.wallPolygons.length<34);
  for(const wall of cave.wallPolygons)assert.equal(wall.length,4);
 }
});
test('deterministic map generation across loads',()=>{
 const a=run().world,b=run().world;
 assert.equal(JSON.stringify(a),JSON.stringify(b));
});
test('entry is a preview, never replaces current Solo/Online actions',()=>{
 const html=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
 assert.match(html,/abyssal-squad-map\.css/);
 assert.match(html,/abyssal-squad-map\.js/);
 assert.match(script,/abyssDiveExpeditionChoice/);
 assert.match(script,/FASE 1 \/ CONSTRUÇÃO DO MUNDO/);
 assert.match(html,/<script src="abyssal-menu-ocean\.js/);
});
