'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const b=require('../public/abyssal-resonance-balance.js');
const pet=(id,x,field=0,alive=true)=>({id,x,y:0,r:10,field,alive});
test('conditional damage is stronger than general damage within its niche',()=>{
 assert.ok(Math.abs(b.POWER**3-1.404928)<1e-9);
 assert.ok(b.predator(3,true,1)>b.POWER**3);
 assert.ok(b.predator(3,true,.2)>b.predator(3,true,1));
 assert.equal(b.close(3,175),1.75);assert.equal(b.close(3,176),1);
 assert.ok(b.predator(3,false,1)<b.POWER**3);
 assert.equal(b.RATE,1.15);
});
test('pet upgrades are rank-capped and only use their own stat multipliers',()=>{
 for(const [actual,expected] of [[b.petAttack(3),1.45],[b.petLife(3),1.6],[b.petSpeed(3),1.36],[b.petCadence(3),1.45]])assert.ok(Math.abs(actual-expected)<1e-9);
 assert.equal(b.petLife(100),1.6);assert.equal(b.petAttack(-1),1);
 assert.ok(Math.abs(b.petInterval(3)-703.448)<.001);
 assert.deepEqual([0,1,2,3].map(n=>b.fieldRadius(n)),[0,65,90,115]);
});
test('orb moves toward nearest active field without assigning ownership',()=>{
 const orb={x:0,y:0},a=pet('a',70,2);
 const result=b.stepOrb(orb,[a],.05);
 assert.equal(result.winner,null);assert.equal(result.moved,true);assert.equal(orb.x,7);
 const collector=pet('b',10,0);
 assert.equal(b.stepOrb(orb,[a,collector],.05).winner.id,'b');
});
test('first contact beats field owner even along the attraction path',()=>{
 const orb={x:0,y:0},owner=pet('owner',100,3),intercept=pet('intercept',30,0);
 assert.equal(b.stepOrb(orb,[owner,intercept],.12).winner.id,'intercept');
 assert.equal(b.stepOrb({x:0,y:0},[intercept,owner],.12).winner.id,'intercept');
});
test('walls, dead specimens and insufficient field rank prevent attraction',()=>{
 for(const [pets,clear] of [[[pet('dead',60,3,false)],()=>true],[[pet('far',90,1)],()=>true],[[pet('wall',60,3)],()=>false],[[pet('none',60)],()=>true]]){
  const orb={x:0,y:0};assert.equal(b.stepOrb(orb,pets,.05,1,clear).moved,false);assert.equal(orb.x,0);
 }
 assert.equal(b.stepOrb({x:0,y:0},[pet('near',5,0)],.05).winner.id,'near');
});
test('new research unlocks preserve the existing Energização ID',()=>{
 const base=require('../public/abyssal-solo-base.js');
 for(const id of ['magnet','magneticField','petAttack','petLife','petSpeed','petCadence'])assert.ok(base.BUFFS.includes(id));
 const game=fs.readFileSync('public/game.js','utf8');assert.match(game,/magnet:\['⌁','Energização'\]/);
 assert.match(game,/RES_BAL\.petAttack\(upgrades\.petAttack\)/);
 assert.match(game,/RES_BAL\.petSpeed\(upgrades\.petSpeed\)/);
});

test('ten-slot resonance presets preserve the new specimen skills across server normalization',()=>{
 const base=require('../public/abyssal-solo-base.js');
 const all=['photon','range','regen','magnet','magneticField','petAttack','petLife','petSpeed','petCadence','power'];
 const normalized=base.normalizePresets({pve:all,pvp:all});
 assert.deepEqual(normalized.pve,all);assert.deepEqual(normalized.pvp,all);
 assert.deepEqual(base.normalizePresets(normalized),normalized);
 assert.equal(base.normalizePreset([...all,'rate']).length,10);
 assert.deepEqual(base.normalizePreset(['electric',...all]),['electric',...all.slice(1)]);
 assert.deepEqual(base.normalizePreset(['photon',...all,'unknown','arcChain']),all);
 const without=base.normalizePreset([...all], 'pve',id=>id!=='power');
 assert.equal(without.length,9);
 assert.equal(base.normalizePreset([...without,'rate']).length,10);
 assert.deepEqual(base.normalizePreset(all.slice(1)),all);
 const server=fs.readFileSync('server.js','utf8'),game=fs.readFileSync('public/game.js','utf8');
 assert.match(server,/u\.resonancePresets=SoloBase\.normalizePresets\(payload\.resonancePresets\)/);
 assert.match(game,/window\.AbyssalSoloBase\.normalizePresets\(value\)/);
 assert.match(game,/let next=selectableResonancePreset\(\)\.filter/);
});
