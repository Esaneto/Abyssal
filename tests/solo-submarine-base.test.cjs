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

test('researched shots become submarine weapons and raise five-minute power cost by ten',()=>{
 const wallet=energyWallet(1000),base=baseModule.create(memory(),wallet);
 assert.deepEqual(base.unlockedShots(),['photon']);
 assert.equal(base.fullPowerCost(),30); // light 20 + one photon weapon 10
 assert.equal(base.research('electric').ok,true);
 assert.equal(base.fullPowerCost(),40);
 assert.ok(base.unlockedShots().includes('electric'));
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
 assert.match(game,/unlockedShots\?\.\(\)/);
 assert.match(game,/fireSoloSubmarineWeapon/);
 assert.match(game,/submarineShield/);
 assert.match(game,/SOLO_SUB_RANGE=294\/GAME_WORLD_ZOOM/);
 assert.match(game,/ENERGIZAR SUBMARINO/);
});

test('cavern plants emit green light and submarine contributes a separate world light',()=>{
 const cave=fs.readFileSync(path.join(__dirname,'..','public/abyssal-solo-cavern.js'),'utf8');
 assert.match(cave,/shadowColor='#59ff9a'/);
 assert.match(cave,/globalCompositeOperation='screen'/);
 assert.match(cave,/extraLights=\[\]/);
});
