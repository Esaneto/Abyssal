'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Evasion=require('../public/specimen-evasion.js');
const Standard=require('../public/skin-standard.js');
const Specimen=require('../public/specimen-system.js');
const ROOT=path.resolve(__dirname,'..');
const near=(a,b,t=.000001)=>Math.abs(a-b)<=t;

test('every Eco follows a steadily swimming diver without repeated zero-motion ticks',()=>{
 let checked=0;
 for(const id of Object.keys(Standard.profiles)){
  const speed=Specimen.effectiveStats(id,0).speed;
  const state={},samples=[];let pos={x:0,y:0};
  for(let i=0;i<100;i++){
   const target={x:18+i*.65,y:0};
   const moved=Evasion.steer({position:pos,target,enemies:[],speed,dt:.05,radius:9,heading:0,intent:'follow',state});
   assert.ok(moved.x>=pos.x-.001,id+' went backwards while diver moved forward');
   pos={x:moved.x,y:moved.y};samples.push(pos.x);
  }
  const stopped=samples.slice(10).filter((x,i)=>i&&x-samples[i+9]<.001).length;
  assert.ok(stopped<=2,id+' repeatedly stopped following the diver ('+stopped+')');
  assert.ok(pos.x>25,id+' did not follow the diver');
  checked++;
 }
 assert.ok(checked>=10,'test must cover the shared renderer catalog, not only one shark');
});

test('cruising behind diver is slower than engaging an objective, regardless of Eco species',()=>{
 for(const id of Object.keys(Standard.profiles)){
  const speed=Specimen.effectiveStats(id,0).speed;
  const travel=Evasion.steer({position:{x:0,y:0},target:{x:42,y:0},enemies:[],speed,dt:.05,radius:9,heading:0,intent:'follow'});
  const chase=Evasion.steer({position:{x:0,y:0},target:{x:42,y:0},enemies:[],speed,dt:.05,radius:9,heading:0,intent:'combat'});
  const collect=Evasion.steer({position:{x:0,y:0},target:{x:42,y:0},enemies:[],speed,dt:.05,radius:9,heading:0,intent:'collect'});
  assert.ok(chase.x>travel.x*1.4,id+' did not accelerate toward threat');
  assert.ok(collect.x>travel.x,id+' did not accelerate toward orb');
 }
});

test('following a moving diver respects real collision resolver, not teleporting through walls',()=>{
 const state={};let p={x:0,y:0};
 const resolve=(x,y)=>({x:Math.min(x,30),y});
 for(let i=0;i<100;i++){
  const next=Evasion.steer({position:p,target:{x:20+i*.7,y:0},speed:190,dt:.05,radius:9,heading:0,intent:'follow',state,resolve});
  assert.ok(next.x<=30+1e-7);p={x:next.x,y:next.y};
 }
});

test('combat steering still advances through a crowd and holds attack stance without unrelated jitter',()=>{
 const Pet=require('../public/abyssal-pet-tactics.js'),Scale=require('../public/creature-scale.js');
 const enemy={id:1,x:85,y:0,r:15,kind:'drifter',hp:100},profile=Pet.attackProfile('reefshark','shark',Scale.visualRadius('reefshark'));
 let p={x:0,y:0},stance=false;
 for(let i=0;i<130;i++){
  const goal=Pet.attackGoal(p,enemy,profile,0);
  if(Pet.attackStance(p,enemy,profile)){stance=true;break;}
  const m=Evasion.steer({position:p,target:goal,speed:200,dt:.05,radius:Scale.companionCollisionRadius('reefshark'),enemies:[],intent:'combat',heading:0});
  p=Pet.limitApproach(p,m,enemy,goal.stop-1);
 }
 assert.equal(stance,true);
});

test('rollback removes the Expedition playtest and reverts offline shell before the new mode',()=>{
 const html=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
 const cache=fs.readFileSync(path.join(ROOT,'public/offline-sw.js'),'utf8');
 assert.doesNotMatch(html,/abyssal-squad-(?:map|playtest|physics|visuals)\.(?:js|css)/);
 assert.doesNotMatch(cache,/squad-terrain|expedition-visual|abyssal-squad-/);
 for(const file of ['public/abyssal-squad-map.js','public/abyssal-squad-physics.js','public/abyssal-squad-playtest.js','public/abyssal-squad-visuals.js']){
  assert.equal(fs.existsSync(path.join(ROOT,file)),false,file+' was not rolled back');
 }
});

test('same common Eco steering is connected to Solo and Online authoritative movement',()=>{
 const game=fs.readFileSync(path.join(ROOT,'public/game.js'),'utf8');
 const server=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');
 assert.match(game,/SPECIMEN_EVASION\?\.steer\(/);
 assert.match(server,/SpecimenEvasion\.steer\(/);
 assert.match(game,/intent:combatTarget\?'combat':orb\?'collect':'follow',state:s/);
 assert.match(server,/intent:combatTarget\?'combat':orb\?'collect':'follow',state:peer/);
});
