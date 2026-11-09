'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const stream=require('../public/abyssal-ocean-stream.js');
const ecology=require('../public/abyssal-open-sea-ecology.js');
const resource=require('../public/abyssal-resource-fields.js');

test('Mar Aberto is exactly 15 times the original 4800x3000 surface',()=>{
 assert.equal(stream.WIDTH,24000);
 assert.equal(stream.HEIGHT,9000);
 assert.equal(stream.WIDTH*stream.HEIGHT/(4800*3000),15);
 assert.equal(stream.AREA_RATIO,15);
});

test('cells are generated on demand with stable IDs and distinct regions',()=>{
 const a=stream.generate('session',10,3,ecology);
 const b=stream.generate('session',10,3,ecology);
 const distant=stream.generate('session',18,6,ecology);
 assert.deepEqual(a,b);
 assert.equal(a.animals.length,3);
 assert.equal(a.resources.length,5);
 assert.notDeepEqual(a,distant);
 assert.ok(a.animals.every(n=>n.x>=12000&&n.x<13200));
 assert.ok(a.resources.every(n=>n.id.startsWith('10:3:r')));
});

test('large distant parties receive fair interest-area allocations',()=>{
 const participants=[{x:1100,y:900,alive:true},{x:21000,y:7100,alive:true}];
 const cells=stream.active(participants,30,1900);
 assert.ok(cells.length<=10);
 assert.ok(cells.some(cell=>cell.cx<=2&&cell.cy<=2));
 assert.ok(cells.some(cell=>cell.cx>=16&&cell.cy>=4));
 assert.equal(new Set(cells.map(c=>c.key)).size,cells.length);
});

test('resource scanner does not enumerate or instantiate the entire ocean',()=>{
 const x=12400,y=1600;
 const nodes=resource.streamNear('test-world',x,y,1800);
 assert.ok(nodes.length>0);
 assert.ok(nodes.length<150);
 assert.ok(nodes.every(n=>Math.hypot(n.x-x,n.y-y)<=1800));
 assert.ok(nodes.every(n=>ecology.habitatAt(n.x,n.y).resources.includes(n.type)));
 const skipped=resource.streamNear('test-world',x,y,1800,[nodes[0].id]);
 assert.equal(skipped.some(n=>n.id===nodes[0].id),false);
});

test('fauna migrates within 15x world and never clamps to original 4800x3000',()=>{
 const animal={id:23,schoolId:'15:3:s0',x:19500,y:6100,homeX:19500,homeY:6100,angle:0,wildlifeMode:'passive',hp:50,maxHp:50};
 const prey=ecology.decide(animal,[],120,50000);
 assert.equal(prey.mode,'patrol');
 assert.ok(prey.target.x>18000);
 assert.ok(prey.target.y>5000);
 const second={...animal,id:24};
 const other=ecology.decide(second,[],120,50000);
 assert.ok(Math.hypot(other.target.x-prey.target.x,other.target.y-prey.target.y)<75);
});

test('server, solo and UI explicitly share AOI streaming contract',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const sim=fs.readFileSync(path.join(__dirname,'../world-simulation.js'),'utf8');
 const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 assert.match(server,/function roomWorldWidth\(room\)/);
 assert.match(server,/if\(room\.mode==='coop'\)for\(const recipient of room\.players\.values\(\)\)/);
 assert.match(server,/getRoomSnapshot\(room,\{criticalReason:'area-refresh'\},recipient\)/);
 assert.match(sim,/function updateOceanStreaming\(world,players,now\)/);
 assert.match(game,/function updateSoloOceanChunks\(force=false\)/);
 assert.match(html,/abyssal-ocean-stream\.js/);
});


test('last partial ocean row never creates out-of-bounds fauna or resources',()=>{
 for(const cx of [0,10,19]){
  const cell=stream.generate('partial-row',cx,7,ecology);
  // The bottom row is mostly seabed. Only open pockets and caves can spawn.
  assert.ok(cell.animals.length>=0&&cell.animals.length<=stream.INITIAL_FAUNA);
  assert.ok(cell.resources.length>=0&&cell.resources.length<=stream.RESOURCE_COUNT);
  for(const entity of [...cell.animals,...cell.resources]){
   assert.ok(entity.x>=cx*stream.CHUNK&&entity.x<Math.min(stream.WIDTH,(cx+1)*stream.CHUNK));
   assert.ok(entity.y>=7*stream.CHUNK&&entity.y<stream.HEIGHT);
  }
 }
});


test('invalid sectors never spawn creatures or resource nodes',()=>{
 for(const [cx,cy] of [[-1,0],[0,-1],[20,0],[0,8],[NaN,0],[1.5,0]]){
  const cell=stream.generate('invalid-sector',cx,cy,ecology);
  assert.equal(cell.animals.length,0);
  assert.equal(cell.resources.length,0);
 }
});

test('sector budget and invalid player positions are handled safely',()=>{
 assert.deepEqual(stream.active([{x:1500,y:1500}],0),[]);
 assert.deepEqual(stream.active([{x:NaN,y:1500},{x:Infinity,y:1500}],30),[]);
 const cells=stream.active([{x:1500,y:1500},{x:NaN,y:1500}],30);
 assert.ok(cells.length>0&&cells.length<=10);
});
