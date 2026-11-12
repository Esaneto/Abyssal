const test=require('node:test'),assert=require('node:assert/strict');
const cave=require('../public/abyssal-solo-cavern.js');
const rocks=cave.buildRocks(4800,3000);
test('Solo terrain creates reproducible physical rocks with navigable gaps',()=>{
 assert.equal(rocks.length,14);
 assert.deepEqual(rocks,cave.buildRocks(4800,3000));
 assert.ok(rocks.every(r=>r.cavernSolid&&!r.visualOnly));
 assert.equal(cave.isBlocked(rocks,2400,330,13),false);
});
test('Physical rock blocks movement and allows axis sliding',()=>{
 const r=rocks[0];
 assert.equal(cave.isBlocked(rocks,r.x,r.y,0),true);
 const result=cave.resolve(rocks,r.x-r.r-80,r.y,r.x,r.y,12);
 assert.equal(result.blocked,true);
 assert.equal(cave.isBlocked(rocks,result.x,result.y,12),false);
});
test('Bullets hit rocks, while clear paths remain open',()=>{
 const r=rocks[0];
 assert.equal(cave.segmentBlocked(rocks,r.x-r.r-50,r.y,r.x+r.r+50,r.y,2),true);
 assert.equal(cave.segmentBlocked(rocks,2400,270,2400,390,2),false);
});

test('Enemies navigate around a rock instead of steering into its center',()=>{
 const r=rocks[0],start={x:r.x-r.r-50,y:r.y},goal={x:r.x+r.r+50,y:r.y};
 let pos=start;
 assert.equal(cave.segmentBlocked(rocks,start.x,start.y,goal.x,goal.y,12),true);
 const first=cave.navigationTarget(rocks,4800,3000,pos.x,pos.y,goal.x,goal.y,12);
 assert.equal(first.direct,false);assert.equal(first.blocked,false);
 for(let i=0;i<400&&Math.hypot(goal.x-pos.x,goal.y-pos.y)>10;i++){
  const nav=cave.navigationTarget(rocks,4800,3000,pos.x,pos.y,goal.x,goal.y,12);
  assert.equal(nav.blocked,false);
  const d=Math.hypot(nav.x-pos.x,nav.y-pos.y);const step=Math.min(18,d);
  pos=cave.resolve(rocks,pos.x,pos.y,pos.x+(nav.x-pos.x)/(d||1)*step,pos.y+(nav.y-pos.y)/(d||1)*step,12);
  assert.equal(cave.isBlocked(rocks,pos.x,pos.y,12),false);
 }
 assert.ok(Math.hypot(goal.x-pos.x,goal.y-pos.y)<20,'path must reach target behind solid rock');
});
test('Lamp levels follow Deep Eye 22% progression',()=>{
 const a=cave.lampParameters(1),b=cave.lampParameters(2),c=cave.lampParameters(3);
 assert.equal(b.range/a.range,1.22);assert.ok(Math.abs(c.range/b.range-1.22)<1e-9);
 assert.ok(a.halo<a.range/4);assert.ok(c.halfAngle<Math.PI/2);
});
test('Energy persists, upgrades consume collected currency and cannot overspend',()=>{
 const {create}=require('../public/abyssal-solo-progress.js'),map=new Map(),store={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let p=create(store);assert.deepEqual(p.get(),{energy:0,lamp:1});
 assert.equal(p.upgradeLamp().ok,false);p.credit(79);assert.equal(p.upgradeLamp().ok,false);p.credit(1);
 assert.equal(p.upgradeLamp().ok,true);assert.deepEqual(p.get(),{energy:0,lamp:2});
 p.credit(180);p=create(store);assert.equal(p.upgradeLamp().ok,true);
 assert.deepEqual(create(store).get(),{energy:0,lamp:3});assert.equal(p.upgradeLamp().ok,false);
});
