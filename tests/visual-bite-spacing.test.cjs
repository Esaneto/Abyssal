const test=require('node:test');
const assert=require('node:assert/strict');
const AI=require('../public/enemy-ai.js');
const Scale=require('../public/creature-scale.js');
const Pet=require('../public/abyssal-pet-tactics.js');
test('ordinary shark stops outside visible snout and backs out of overlap',()=>{
 const visual=Scale.monsterVisualRadius('whiteShark',24),target={x:300,y:300,r:17,visualRadius:20};
 const shark={kind:'whiteShark',x:170,y:300,r:24,angle:0,sharkCharging:true};
 const options={sharkVisualRadius:visual,sharkTerrainClear:()=>true};
 const stop=AI.sharkBiteStop(24,20,visual);
 for(let i=0;i<60;i++)AI.moveTowardTarget(shark,[target],.016,options);
 assert.ok(Math.abs(Math.hypot(shark.x-target.x,shark.y-target.y)-stop)<1.1);
 assert.ok(stop>1.28*visual+20);
 assert.ok(stop<AI.sharkBiteReach(24,20,visual));
 shark.x=295;shark.angle=0;
 for(let i=0;i<60;i++)AI.moveTowardTarget(shark,[target],.016,options);
 assert.ok(Math.abs(target.x-shark.x-stop)<1.1);
});
test('mascot uses visible shark geometry and clips approach without entering target',()=>{
 const enemy={kind:'whiteShark',x:300,y:300,r:24},pet={x:150,y:300};
 const p=Pet.attackProfile('reefshark','fish',25),goal=Pet.attackGoal(pet,enemy,p);
 assert.ok(goal.stop>=Pet.attackTargetRadius(enemy)+p.core*.4,'strike distance respects body clearance');
 assert.ok(goal.stop<=Pet.attackTargetRadius(enemy)+p.reach,'strike distance must be inside the bite envelope');
 assert.ok(Pet.attackStance({x:goal.x,y:goal.y},enemy,p),'reached strike goal is a stable stance');
 assert.ok(Pet.attackContact({x:goal.x,y:goal.y},enemy,p,0,0));
 const clipped=Pet.limitApproach(pet,{x:290,y:300},enemy,goal.stop-1);
 assert.ok(Math.abs(Math.hypot(clipped.x-enemy.x,clipped.y-enemy.y)-(goal.stop-1))<1e-6);
});
