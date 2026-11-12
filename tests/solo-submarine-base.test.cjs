'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const baseModule=require('../public/abyssal-solo-base.js');

function memory(){
 const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v))};
}
function energyWallet(amount=1000){
 let energy=amount;return {get:()=>({energy}),debit:n=>{const spend=Math.min(energy,Math.max(0,Math.floor(Number(n)||0)));energy-=spend;return {ok:spend===n,spent:spend,energy};}};
}

test('starter resonance is photon plus Deep Eye and Living Membrane',()=>{
 const base=baseModule.create(memory(),energyWallet());
 assert.deepEqual(base.STARTERS,['photon','range','regen']);
 for(const id of base.STARTERS)assert.equal(base.unlocked(id),true);
 assert.equal(base.unlocked('electric'),false);
});

test('research costs match the requested energy tiers',()=>{
 const base=baseModule.create(memory(),energyWallet());
 assert.equal(base.cost('electric'),100);
 assert.equal(base.cost('burst'),80);
 assert.equal(base.cost('power'),60);
 assert.equal(base.cost('submarineShield'),100);
});

test('researched submarine weapons require installation and raise power cost by ten',()=>{
 const wallet=energyWallet(1000),base=baseModule.create(memory(),wallet);
 assert.deepEqual(base.unlockedShots(),['photon']);
 assert.equal(base.fullPowerCost(),30); // light 20 + one photon weapon 10
 assert.equal(base.research('weapon:electric').ok,true);
 assert.equal(base.fullPowerCost(),30);
 assert.equal(base.installWeapon('electric').ok,true);
 assert.equal(base.fullPowerCost(),40);
 assert.ok(base.installedWeapons().includes('electric'));
});

test('partial submarine recharge spends proportionally and supports partial wallets',()=>{
 const wallet=energyWallet(100),base=baseModule.create(memory(),wallet);
 const full=base.topUp(0);assert.equal(full.ok,true);assert.equal(full.cost,30);assert.equal(Math.round(full.remaining),300);
 const half=base.topUp(150);assert.equal(half.ok,true);assert.equal(half.cost,15);assert.equal(Math.round(half.remaining),300);
 const smallWallet=energyWallet(3),small=baseModule.create(memory(),smallWallet),partial=small.topUp(0);
 assert.equal(partial.ok,true);assert.equal(partial.cost,3);assert.equal(Math.round(partial.secondsAdded),30);
});

test('Solo game mounts a powered submarine with automatic researched guns and shield',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public/game.js'),'utf8');
 assert.match(game,/function drawSoloSubmarine/);
 assert.match(game,/function updateSoloSubmarine\(dt\)/);
 assert.match(game,/installedWeapons\?\.\(\)/);
 assert.match(game,/fireSoloSubmarineWeapon/);
 assert.match(game,/submarineShield/);
 assert.match(game,/SOLO_SUB_RANGE=650\/GAME_WORLD_ZOOM/);
 assert.match(game,/ENERGIZAR SUBMARINO/);
});

test('cavern plants emit green light and submarine contributes a separate world light',()=>{
 const cave=fs.readFileSync(path.join(__dirname,'..','public/abyssal-solo-cavern.js'),'utf8');
 assert.match(cave,/shadowColor='#24ff78'/);
 assert.match(cave,/globalCompositeOperation='screen'/);
 assert.match(cave,/extraLights=\[\]/);
});

test('six weapon slots, independent permanent research, persistence and free swaps',()=>{
 const store=memory(),wallet=energyWallet(1000),base=baseModule.create(store,wallet);
 assert.equal(base.MAX_WEAPONS,6);assert.deepEqual(base.installedWeapons(),['photon']);
 assert.equal(base.installWeapon('nova').reason,'research');
 for(const id of ['electric','pierce','nova','echoShot','photonRay']){
  assert.equal(base.research('weapon:'+id).ok,true);
  assert.equal(base.installWeapon(id).ok,true);
 }
 assert.equal(base.installedWeapons().length,6);assert.equal(base.fullPowerCost(),80);
 assert.equal(base.installWeapon('nova').reason,'installed');
 assert.deepEqual(baseModule.create(store,wallet).installedWeapons(),['photon','electric','pierce','nova','echoShot','photonRay']);
 assert.equal(base.uninstallWeapon('photon').ok,true);assert.equal(base.unlocked('weapon:photon'),true);
 assert.equal(base.fullPowerCost(),70);assert.equal(base.installWeapon('photon').ok,true);
 assert.equal(wallet.get().energy,500);
});
test('legacy installation migrates to six slots and preserves all research',()=>{
 const store=memory();store.setItem(baseModule.KEY,JSON.stringify({weapons:['electric','pierce','nova','echoShot','photonRay']}));const base=baseModule.create(store,energyWallet());assert.deepEqual(base.installedWeapons(),['photon','electric','pierce','nova','echoShot','photonRay']);assert.equal(base.unlocked('weapon:echoShot'),true);
});
test('existing version-one installations retain choices and can equip remaining researched guns',()=>{
 const store=memory();store.setItem(baseModule.KEY,JSON.stringify({weaponSlotsVersion:1,weapons:['photon','electric','pierce'],researchedWeapons:['photon','electric','pierce','nova','echoShot','photonRay']}));const base=baseModule.create(store,energyWallet());
 assert.equal(base.installedWeapons().length,3);
 for(const id of ['nova','echoShot','photonRay'])assert.equal(base.installWeapon(id).ok,true);
 assert.equal(base.installedWeapons().length,6);assert.equal(base.fullPowerCost(),80);
});

test('submarine uses diver shot profiles, continuous photon ray and nova cone',()=>{const game=fs.readFileSync(path.join(__dirname,'..','public/game.js'),'utf8');assert.match(game,/const profile=baseShotProfile\(id,1\)/);assert.match(game,/refreshPhotonBeam\('submarinePhotonBeam',true/);assert.match(game,/refreshPhotonBeam\('localPhotonBeam',true/);assert.match(game,/soloSubmarine\.weaponTimers\[id\]=interval/);assert.match(game,/const BASE_SHOT_INTERVAL=\.52,NOVA_SOLO_INTERVAL=1\.8/);assert.match(game,/spawnNovaVisual\(ox,oy,SOLO_SUB_RANGE/);assert.doesNotMatch(game,/id==='photonRay'\?1\.25/);});
