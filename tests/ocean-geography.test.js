'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const geo=require('../public/abyssal-ocean-geography.js');
const ecology=require('../public/abyssal-open-sea-ecology.js');
const stream=require('../public/abyssal-ocean-stream.js');
const renderer=require('../public/abyssal-open-sea-render.js');

test('ocean is a wide side section with a sunlit shelf, canyon and abyssal basin',()=>{
 assert.equal(geo.WIDTH,24000);
 assert.equal(geo.HEIGHT,21000);
 assert.ok(geo.floorAt(1000)>4000&&geo.floorAt(1000)<9000);
 assert.ok(geo.floorAt(10000)>7700);
 assert.ok(geo.ROCKS.length>=10);
 assert.ok(geo.CAVES.length>=5);
 assert.equal(geo.classify(1300,geo.floorAt(1300)-90),'reef');
 assert.equal(geo.classify(2600,geo.floorAt(2600)-90),'kelp');
});

test('large navigable ocean, seabed collision and open paths around cliffs',()=>{
 let free=0,total=0;
 for(let x=400;x<geo.WIDTH;x+=400)for(let y=300;y<geo.HEIGHT;y+=450){
  if(!geo.isSolid(x,y,18))free++;
  total++;
 }
 assert.ok(free/total>.57);
 const x=1000,y=geo.floorAt(x);
 assert.equal(geo.isSolid(x,y+110,10),true);
 assert.equal(geo.isSolid(x,y-150,10),false);
 assert.equal(geo.segmentClear(x,y-250,x,y+150,18),false);
 const moved=geo.resolveMove(x,y-250,x,y+150,18);
 assert.equal(moved.blocked,true);
 assert.equal(geo.isSolid(moved.x,moved.y,18),false);
 assert.equal(geo.segmentClear(1000,600,5000,600,20),true); // Open-water route beneath the cave canopy
});

test('real cave entrances and chambers are accessible water voids',()=>{
 for(const cave of geo.CAVES){
  assert.ok(cave.nodes.length>=3);
  for(const chamber of cave.nodes){
   assert.equal(geo.isSolid(chamber.x,chamber.y,18),false,cave.id+' '+JSON.stringify(chamber));
  }
  for(let i=1;i<cave.nodes.length;i++){
   const a=cave.nodes[i-1],b=cave.nodes[i];
   assert.equal(geo.segmentClear(a.x,a.y,b.x,b.y,20),true,cave.id+' segment '+i);
  }
 }
});

test('streaming creates no wildlife or resources inside ocean rock',()=>{
 for(const [cx,cy] of [[0,0],[2,2],[6,4],[10,3],[14,6],[19,7]]){
  const cell=stream.generate('ocean-geometry-test',cx,cy,ecology);
  assert.ok(cell.animals.length<=stream.INITIAL_FAUNA);
  assert.ok(cell.resources.length<=stream.RESOURCE_COUNT);
  for(const entity of [...cell.animals,...cell.resources]){
   assert.ok(entity.x>=cx*stream.CHUNK&&entity.x<Math.min(geo.WIDTH,(cx+1)*stream.CHUNK));
   assert.ok(entity.y>=cy*stream.CHUNK&&entity.y<Math.min(geo.HEIGHT,(cy+1)*stream.CHUNK));
   assert.equal(geo.isSolid(entity.x,entity.y,12),false,'embedded entity '+entity.id);
  }
  assert.deepEqual(cell,stream.generate('ocean-geometry-test',cx,cy,ecology));
 }
});

test('solo, coop, ecology, render and chart depend on one shared geography',()=>{
 const game=fs.readFileSync(path.resolve(__dirname,'../public/game.js'),'utf8');
 const server=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
 const world=fs.readFileSync(path.resolve(__dirname,'../world-simulation.js'),'utf8');
 const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');
 const chart=fs.readFileSync(path.resolve(__dirname,'../public/abyssal-navigation-chart.js'),'utf8');
 assert.match(html,/abyssal-ocean-geography\.js/);
 assert.match(game,/OCEAN_GEOGRAPHY\.resolveMove/);
 assert.match(server,/OceanGeography\.resolveMove/);
 assert.match(world,/OceanGeography\.isSolid/);
 assert.match(chart,/geo\.floorAt/);
 assert.equal(typeof renderer.draw,'function');
});

test('Mar Aberto entry uses a collidable coral canopy without trapping the starting diver',()=>{
 const start={x:1300,y:420};
 assert.equal(geo.isSolid(start.x,start.y,23),false,'starting diver remains in water');
 assert.equal(geo.isSolid(1000,190,18),true,'reef canopy is actual geology');
 assert.equal(geo.segmentClear(1300,420,1700,480,20),true,'entry corridor remains swimmable');
 const overhang=geo.ROCKS.filter(r=>r.type==='overhang');
 assert.ok(overhang.length>=2,'large hanging reef ledges exist in scene and collision');
});
