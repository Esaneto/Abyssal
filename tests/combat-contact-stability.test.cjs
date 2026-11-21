'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const AI=require('../public/enemy-ai.js');
const Pet=require('../public/abyssal-pet-tactics.js');
const Evasion=require('../public/specimen-evasion.js');
const Rift=require('../public/rift-wildlife.js');
const root=path.resolve(__dirname,'..');
const source=(file)=>fs.readFileSync(path.join(root,file),'utf8');

test('non-charge predators settle at contact distance and resume chase when prey moves',()=>{
 const target={x:500,y:400,r:13,alive:true},enemy={id:17,kind:'drifter',x:0,y:400,r:10,angle:0,speed:90,vx:0,vy:0};
 const stop=AI.tentacleStopDistance(enemy,enemy.r,target.r,'fish');
 enemy.x=target.x-stop+0.5;
 const initial=enemy.x;
 for(let i=0;i<150;i++)AI.moveTowardTarget(enemy,[target],.05,{minX:0,maxX:1200,minY:0,maxY:900,stopDistance:stop});
 assert.ok(Math.abs(enemy.x-initial)<.01,'enemy must not orbit inside strike range');
 assert.equal(enemy.vx,0);
 assert.equal(enemy.vy,0);
 target.x+=100;
 for(let i=0;i<10;i++)AI.moveTowardTarget(enemy,[target],.05,{minX:0,maxX:1200,minY:0,maxY:900,stopDistance:stop});
 assert.ok(enemy.x>initial+5,'enemy should resume chasing prey when it moves away');
});

test('aggressive Echo locks on a nearby enemy instead of alternating with XP',()=>{
 const close={id:4,x:92,y:0,r:16,hp:100};
 const nearOrb={id:'orb',x:10,y:0};
 const pet={x:0,y:0},player={x:0,y:0};
 const decision=Pet.choose({mode:'aggressive',pet,player,enemies:[close],orbs:[nearOrb],collectionRange:300,attackRange:220});
 assert.equal(decision.type,'enemy');
 const farther={...close,x:165};
 const persisted=Pet.choose({mode:'aggressive',pet,player,enemies:[farther],orbs:[nearOrb],collectionRange:300,attackRange:220,preferredEnemyId:4});
 assert.equal(persisted.type,'enemy');
 assert.equal(Pet.choose({mode:'passive',pet,player,enemies:[close],orbs:[nearOrb],collectionRange:300}).type,'orb');
});

test('attackGoal is physically reachable by shark jaws and octopus body without repeated circling',()=>{
 const enemy={id:3,kind:'drifter',r:18,hp:80,x:380,y:210};
 for(const [id,family,radius] of [['reefshark','shark',25],['aberration','octopus',36],['kraken','octopus',56]]){
  const profile=Pet.attackProfile(id,family,radius);
  const goal=Pet.attackGoal({x:180,y:210,facingAngle:0},enemy,profile);
  const atGoal={x:goal.x,y:goal.y};
  assert.ok(goal.stop>enemy.r,id+' must respect core collision geometry');
  assert.equal(Pet.attackContact(atGoal,enemy,profile,goal.angle,0),true,id+' must be able to hit at goal');
 }
});

test('steering does not move an Echo that has already reached its tactical destination',()=>{
 const position={x:200,y:150};
 const result=Evasion.steer({position,target:{x:200,y:150},enemies:[{x:232,y:150,r:12,hp:100}],radius:20,speed:180,dt:.05,heading:0});
 assert.deepEqual([result.x,result.y],[position.x,position.y]);
});

test('nearby predator reacquires a rear target, but never through solid terrain',()=>{
 const p={x:85,y:100,alive:true,r:13},enemy={id:7,kind:'whiteShark',specimenSkinId:'reefshark',x:100,y:100,r:22,angle:0,hp:100,maxHp:100};
 assert.equal(Rift.canSee(enemy,p,null,null),false,'rear targets remain outside the normal sight cone');
 assert.equal(Rift.decide({...enemy},[p],{family:'shark',now:1000}).mode,'attack');
 const blocked={segmentWalkable:()=>false};
 assert.notEqual(Rift.decide({...enemy},[p],{family:'shark',now:1000,map:blocked,layout:{rooms:[]}}).mode,'attack');
});

test('Solo and Online share stable attack and server recovery guards',()=>{
 const game=source('public/game.js'),server=source('server.js'),world=source('world-simulation.js');
 assert.match(game,/preferredEnemyId:s\.attackTargetId/);
 assert.match(game,/attackHolding=contact\|\|/);
 assert.match(server,/preferredEnemyId:peer\.specimenAttackId/);
 assert.match(server,/attackHolding=contact\|\|/);
 assert.match(world,/if\(nearest<=stop\+3\)\{enemy\.vx=0;enemy\.vy=0;return false;\}/);
 assert.match(world,/Math\.hypot\(actualTarget\.x-enemy\.x,actualTarget\.y-enemy\.y\)>\(Number\(movementOptions\.stopDistance\)\|\|0\)\+4/);
});
