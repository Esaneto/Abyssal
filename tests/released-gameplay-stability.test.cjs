const test=require('node:test'),assert=require('node:assert/strict');
const cave=require('../public/abyssal-solo-cavern'),tactics=require('../public/abyssal-pet-tactics'),scale=require('../public/creature-scale'),hud=require('../public/abyssal-hud-editor');
test('specimen approach is within actual contact for body and bite families',()=>{
 const enemy={x:1000,y:1000,r:30,kind:'drifter',hp:100};
 for(const [id,family] of [['octopus','octopus'],['jellyfish','jelly'],['manta','ray'],['squid','squid'],['default','fish'],['crab','crustacean'],['eel','eel']]){
  const profile=tactics.attackProfile(id,family,scale.visualRadius(id)),pet={x:600,y:1000},goal=tactics.attackGoal(pet,enemy,profile);
  assert.equal(tactics.attackContact(goal,enemy,profile,goal.angle,0),true,family);
  const approach=tactics.limitApproach(pet,enemy,enemy,goal.stop-1);
  assert.equal(tactics.attackContact(approach,enemy,profile,goal.angle,0),true,family);
 }
});
test('cavern boundaries constrain all four edges, large steps and invalid starting coordinates',()=>{
 for(const [x,y,tx,ty] of [[95,50,120,50],[5,50,-20,50],[50,95,50,120],[50,5,50,-20],[120,-20,140,-40]]){
  const m=cave.resolve([],x,y,tx,ty,5,100,100);assert.equal(m.blocked,true);assert.ok(m.x>=5-1e-8&&m.x<=95+1e-8&&m.y>=5-1e-8&&m.y<=95+1e-8);
  const n=cave.navigationTarget([],100,100,50,50,tx,ty,5);assert.ok(n.x>=5&&n.x<=95&&n.y>=5&&n.y<=95);
  const a={x:50,y:50},route=cave.pursuitTarget([],100,100,a,{x:tx,y:ty},5);assert.ok(route.x>=5&&route.x<=95&&route.y>=5&&route.y<=95);
 }
 const rock={x:50,y:50,r:43,rx:10,ry:40,angle:0,vertices:[[-10,-40],[10,-40],[10,40],[-10,40]],cavernSolid:true};
 const m=cave.resolve([rock],20,50,90,50,5,100,100);assert.ok(m.blocked&&m.x<40);assert.equal(cave.isBlocked([rock],m.x,m.y,5),false);
});
test('live HUD placement uses the frozen plan instead of refitting dynamic content',()=>{
 const plan=hud.planPositions([{id:'stats',pos:{x:.5,y:.05,s:1},box:{w:100,h:30}},{id:'skills',pos:{x:.8,y:.2,s:1},box:{w:48,h:38},reserve:{reference:38,height:160}}],500,500);
 const a=hud.fixedPlacement(plan.positions.stats,500,500);assert.equal(a.y,25);assert.deepEqual(hud.fixedPlacement(plan.positions.stats,500,500),a);
 const one=hud.fixedPlacement(hud.displayPosition(plan.positions.skills,plan.slots.skills,{h:38},500),500,500),many=hud.fixedPlacement(hud.displayPosition(plan.positions.skills,plan.slots.skills,{h:160},500),500,500);
 assert.ok(Math.abs((one.y-19)-(many.y-80))<1e-7);
 assert.equal(hud.canRemove('pet'),false);
});
