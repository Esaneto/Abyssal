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
