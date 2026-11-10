'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const stream=require('../public/abyssal-ocean-stream.js');
const ecology=require('../public/abyssal-open-sea-ecology.js');
const resource=require('../public/abyssal-resource-fields.js');

test('Mar Aberto expands to 35 times the original 4800x3000 surface',()=>{
 assert.equal(stream.WIDTH,24000);
 assert.equal(stream.HEIGHT,21000);
 assert.equal(stream.WIDTH*stream.HEIGHT/(4800*3000),35);
 assert.equal(stream.AREA_RATIO,35);
});

test('cells are generated on demand with stable IDs and distinct regions',()=>{
 const a=stream.generate('session',10,3,ecology);
 const b=stream.generate('session',10,3,ecology);
 const distant=stream.generate('session',18,6,ecology);
 assert.deepEqual(a,b);
 assert.equal(a.animals.length,stream.INITIAL_FAUNA,'open-water cells should reach the bounded fauna budget');
 assert.equal(a.resources.length,0);
 assert.notDeepEqual(a,distant);
 assert.ok(a.animals.every(n=>n.x>=12000&&n.x<13200));
 assert.deepEqual(a.resources,[]);
});

test('large distant parties receive fair interest-area allocations',()=>{
 const participants=[{x:1100,y:900,alive:true},{x:21000,y:7100,alive:true}];
 const cells=stream.active(participants,30,1900);
 assert.ok(cells.length<=10);
 assert.ok(cells.some(cell=>cell.cx<=2&&cell.cy<=2));
 assert.ok(cells.some(cell=>cell.cx>=16&&cell.cy>=4));
 assert.equal(new Set(cells.map(c=>c.key)).size,cells.length);
});

test('geological nodes are independently streamed while legacy shooter and Fossas generation stays disabled',()=>{
 const a=resource.streamNear('test-world',12400,1600,1800);
 const b=resource.streamNear('test-world',12400,1600,1800);
 assert.deepEqual(a,b);
 assert.ok(a.every(node=>node.id.startsWith('geo:')));
 assert.deepEqual(resource.create('test-world'),[]);
 assert.equal(resource.eligible({id:'1',x:0,y:0,type:'seaMineral'},0,0).reason,'tool-required');
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
 assert.match(server,/if\(\['coop','open-sea'\]\.includes\(room\.mode\)\)for\(const recipient of room\.players\.values\(\)\)/);
 assert.match(server,/getRoomSnapshot\(room,\{criticalReason:'area-refresh'\},recipient\)/);
 assert.match(sim,/function updateOceanStreaming\(world,players,now\)/);
 assert.match(game,/function updateSoloOceanChunks\(force=false\)/);
 assert.match(html,/abyssal-ocean-stream\.js/);
});


test('last partial ocean row never creates out-of-bounds fauna or resources',()=>{
 for(const cx of [0,10,19]){
  const cell=stream.generate('partial-row',cx,17,ecology);
  // The bottom row is mostly seabed. Only open pockets and caves can spawn.
  assert.ok(cell.animals.length>=0&&cell.animals.length<=stream.INITIAL_FAUNA);
  assert.ok(cell.resources.length>=0&&cell.resources.length<=stream.RESOURCE_COUNT);
  for(const entity of [...cell.animals,...cell.resources]){
   assert.ok(entity.x>=cx*stream.CHUNK&&entity.x<Math.min(stream.WIDTH,(cx+1)*stream.CHUNK));
   assert.ok(entity.y>=17*stream.CHUNK&&entity.y<stream.HEIGHT);
  }
 }
});


test('invalid sectors never spawn creatures or resource nodes',()=>{
 for(const [cx,cy] of [[-1,0],[0,-1],[20,0],[0,18],[NaN,0],[1.5,0]]){
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

test('wild fauna spawn clear of all other animals while retaining deterministic schools',()=>{
 let schoolCount=0,checked=0;
 for(const seed of ['ocean-school-a','ocean-school-b','ocean-school-c']){
  for(const [cx,cy] of [[10,3],[2,0],[5,2],[12,1],[17,5]]){
   const a=stream.generate(seed,cx,cy,ecology),b=stream.generate(seed,cx,cy,ecology);
   assert.deepEqual(a,b,'existing world seeds must keep stable creature positions');
   for(let i=0;i<a.animals.length;i++)for(let j=i+1;j<a.animals.length;j++){
    const x=a.animals[i],y=a.animals[j];
    assert.ok(Math.hypot(x.x-y.x,x.y-y.y)>=stream.MIN_FAUNA_SPACING-.001,
     'spawn collision in '+a.key+': '+x.id+'/'+y.id);
    checked++;
   }
   if(a.animals.length>=2&&a.animals.some(x=>a.animals.filter(y=>y.schoolId===x.schoolId).length>1))schoolCount++;
  }
 }
 assert.ok(checked>10,'inspect multiple real spawning configurations');
 assert.ok(schoolCount>=1,'same-species groups must still exist with space between members');
});
