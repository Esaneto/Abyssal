const test = require('node:test');
const assert = require('node:assert/strict');
const AI = require('../public/enemy-ai.js');
const close=(a,b,epsilon=.001)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const speed=e=>Math.hypot(e.vx,e.vy);
const tick=(e,t,options={},dt=.025)=>AI.moveTowardTarget(e,[t],dt,options);
test('white shark patrols until frontal sight, then pursues at full speed despite cone exit',()=>{
 const e={kind:'whiteShark',x:100,y:100,angle:0},t={x:50,y:100,alive:true};
 tick(e,t); assert.equal(e.sharkCharging,false); close(speed(e),126);
 t.x=300;t.y=100;tick(e,t);assert.equal(e.sharkCharging,true);close(speed(e),300);
 t.x=90;t.y=300;tick(e,t);assert.equal(e.sharkCharging,true);assert.equal(e.sharkVisionVisible,false);
 close(speed(e),300);assert.ok(e.vy>0&&e.vx<0);
});
test('a closer rear target does not mask prey in the frontal cone',()=>{
 const e={kind:'whiteShark',x:100,y:100,angle:0},front={x:300,y:100,alive:true},rear={x:60,y:100,alive:true};
 const r=AI.moveTowardTarget(e,[rear,front],.025,{sharkTerrainClear:()=>true});
 assert.equal(r.target,front);assert.equal(e.sharkCharging,true);assert.ok(e.vx>0);
});
test('solid terrain occludes the initial acquisition',()=>{
 const e={kind:'whiteShark',x:100,y:100,angle:0},t={x:300,y:100,alive:true};
 tick(e,t,{sharkLineOfSight:false,sharkTerrainClear:()=>true});
 assert.equal(e.sharkCharging,false);close(speed(e),126);
});
test('boss holds its ballistic heading until the boundary and rebounds at max speed',()=>{
 const e={kind:'whiteSharkBoss',x:100,y:100,angle:0},t={x:300,y:100,alive:true};
 const opt={minX:0,maxX:320,minY:0,maxY:320};
 tick(e,t,opt,.1);t.x=100;t.y=200;
 tick(e,t,opt,.1);close(e.angle,0);close(speed(e),400);
 for(let i=0;i<5;i++)tick(e,t,opt,.1);
 assert.ok(e.vx<0&&e.vy>0);assert.equal(e.sharkCharging,true);close(speed(e),400);
});
function wallClear(ax,ay,bx,by){
 const dx=bx-ax;
 if(Math.abs(dx)<1e-9)return !(ax>=220&&ax<=240&&Math.min(ay,by)<250);
 for(const wx of [220,240]){
   const q=(wx-ax)/dx;
   if(q>=0&&q<=1&&ay+(by-ay)*q<250)return false;
 }
 return !(bx>=220&&bx<=240&&by<250);
}
test('boss chooses a favorable bounce around a solid obstruction without crossing it',()=>{
 const e={kind:'whiteSharkBoss',x:100,y:100,angle:0},t={x:180,y:100,alive:true};
 const opt={minX:0,maxX:500,minY:0,maxY:500,sharkTerrainClear:wallClear,sharkNavigation:()=>({x:190,y:290})};
 tick(e,t,opt);t.x=350;let reached=false;
 for(let i=0;i<500;i++){
   const x=e.x,y=e.y;tick(e,t,opt);
   assert.ok(wallClear(x,y,e.x,e.y),'no tunneling through rock');
   close(speed(e),400);assert.equal(e.sharkCharging,true);
   if(Math.hypot(e.x-t.x,e.y-t.y)<30)reached=true;
 }
 assert.ok(reached,'boss should reach the target after a favorable ricochet');
});
test('white shark uses a navigation waypoint to pursue around solid terrain',()=>{
 const e={kind:'whiteShark',x:100,y:100,angle:0},t={x:180,y:100,alive:true};
 const opt={minX:0,maxX:500,minY:0,maxY:500,sharkTerrainClear:wallClear,sharkNavigation:(e)=>e.y<275?{x:190,y:290}:{x:350,y:290}};
 tick(e,t,opt);t.x=350;let reached=false;
 for(let i=0;i<250;i++){
  const x=e.x,y=e.y;tick(e,t,opt);
  assert.ok(wallClear(x,y,e.x,e.y));close(speed(e),300);
  if(Math.hypot(e.x-t.x,e.y-t.y)<30){reached=true;break;}
 }
 assert.ok(reached);
});
