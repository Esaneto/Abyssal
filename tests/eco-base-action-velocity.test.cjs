'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Evasion=require('../public/specimen-evasion.js');
const Balance=require('../public/abyssal-resonance-balance.js');
const Standard=require('../public/skin-standard.js');
const Specimen=require('../public/specimen-system.js');
const ROOT=path.resolve(__dirname,'..');
const approx=(x,y)=>Math.abs(x-y)<1e-7;

test('all equipped Ecos cruise at 90% and act at 200% of the diver base speed',()=>{
 const base=Evasion.playerBaseSpeed(.78);
 assert.ok(approx(base,150/.78));
 assert.equal(Evasion.DIVER_BASE_SPEED,150);
 assert.equal(Evasion.speedMultiplierForIntent('follow'),.9);
 assert.equal(Evasion.speedMultiplierForIntent('combat'),2);
 assert.equal(Evasion.speedMultiplierForIntent('collect'),2);
 assert.ok(Object.keys(Standard.profiles).length>=10);
 for(const id of Object.keys(Standard.profiles)){
  assert.ok(Specimen.effectiveStats(id,5000).speed>0);
  const args={position:{x:0,y:0},target:{x:1000,y:0},enemies:[],speed:base,dt:.05,radius:10,heading:0};
  const follow=Evasion.steer({...args,intent:'follow'});
  const combat=Evasion.steer({...args,intent:'combat'});
  const collect=Evasion.steer({...args,intent:'collect'});
  assert.ok(approx(follow.x,base*.9*.05),id+' unexpected follow speed');
  assert.ok(approx(combat.x,base*2*.05),id+' unexpected combat speed');
  assert.ok(approx(collect.x,base*2*.05),id+' unexpected collection speed');
 }
});

test('Eco resonance and adaptation increase the 200% action speed, not 90% following',()=>{
 const base=Evasion.playerBaseSpeed(.78);
 const bonus=Balance.petSpeed(3)*(1+Specimen.stats(5000).attributeBonus);
 assert.ok(approx(bonus,1.496));
 const args={position:{x:0,y:0},target:{x:1000,y:0},enemies:[],speed:base,actionSpeedMultiplier:bonus,dt:.05,radius:9,heading:0};
 const follow=Evasion.steer({...args,intent:'follow'});
 const combat=Evasion.steer({...args,intent:'combat'});
 const collect=Evasion.steer({...args,intent:'collect'});
 assert.ok(approx(follow.x,base*.9*.05),'the 90% cruise must not inherit an Eco bonus');
 assert.ok(approx(combat.x,base*2*bonus*.05),'the bonus must multiply the 200% combat speed');
 assert.ok(approx(collect.x,base*2*bonus*.05),'the bonus must multiply 200% collection speed');
});

test('transition from cruising to boosted action accelerates without a stop or teleport',()=>{
 const base=Evasion.playerBaseSpeed(.78),bonus=Balance.petSpeed(3)*(1+Specimen.stats(5000).attributeBonus),state={};
 let p={x:0,y:0},before=0;
 for(let frame=0;frame<15;frame++){
  const moved=Evasion.steer({position:p,target:{x:6000,y:0},speed:base,actionSpeedMultiplier:bonus,dt:.05,radius:9,intent:'follow',state,heading:0});
  before=moved.x-p.x;p={x:moved.x,y:moved.y};
 }
 const first=Evasion.steer({position:p,target:{x:6000,y:0},speed:base,actionSpeedMultiplier:bonus,dt:.05,radius:9,intent:'combat',state,heading:0});
 assert.ok(first.x-p.x>before,'entering action must accelerate');
 assert.ok(first.x-p.x<=base*2*bonus*.05+.001,'must not jump faster than the boosted action speed');
 p={x:first.x,y:first.y};
 for(let frame=0;frame<40;frame++){
  const moved=Evasion.steer({position:p,target:{x:6000,y:0},speed:base,actionSpeedMultiplier:bonus,dt:.05,radius:9,intent:'combat',state,heading:0});
  assert.ok(moved.x>p.x,'chasing must not stall');
  p={x:moved.x,y:moved.y};
 }
 assert.ok(Math.abs(state.ecoMotionSpeed-base*2*bonus)<.01,'must settle at boosted 200% action speed');
});

test('Solo and Online use identical pre-bonus diver base and action-only Eco resonance',()=>{
 const game=fs.readFileSync(path.join(ROOT,'public/game.js'),'utf8');
 const server=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');
 assert.match(game,/SPECIMEN_EVASION\.playerBaseSpeed\(GAME_WORLD_ZOOM\)\*toxin\*slowed/);
 assert.match(server,/const speed=SpecimenEvasion\.playerBaseSpeed\(WORLD_ZOOM\)/);
 assert.match(game,/actionSpeedMultiplier:RES_BAL\.petSpeed\(upgrades\.petSpeed\)\*\(1\+SPECIMEN_SYSTEM\.stats\(specimenPoints\(\)\)\.attributeBonus\)/);
 assert.match(server,/actionSpeedMultiplier:ResBalance\.petSpeed\(peer\.petSpeed\)\*\(1\+SpecimenSystem\.stats\(peer\.specimenPoints\)\.attributeBonus\)/);
 assert.doesNotMatch(game,/effectiveStats\(equippedSkin,specimenPoints\(\)\)\.speed\*RES_BAL\.petSpeed/);
 assert.doesNotMatch(server,/effectiveStats\(peer\.skinId,peer\.specimenPoints\)\.speed\*ResBalance\.petSpeed/);
});

test('browser and offline cache use the new shared Eco speed revision',()=>{
 const html=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
 const sw=fs.readFileSync(path.join(ROOT,'public/offline-sw.js'),'utf8');
 const build=fs.readFileSync(path.join(ROOT,'public/client-build.js'),'utf8');
 assert.match(html,/specimen-evasion\.js\?v=2026\.11\.22\.eco-velocity-v309/);
 assert.match(html,/game\.js\?v=2026\.11\.22\.eco-velocity-v309/);
 assert.match(sw,/2026-11-22-eco-velocity-v309/);
 assert.match(build,/revision:'eco-velocity-v309'/);
});
