'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const baseModule=require('../public/abyssal-solo-base.js');

function memory(){
 const map=new Map();
 return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
}
function wallet(initial){
 let energy=initial;
 return {get:()=>({energy}),debit:n=>{const spent=Math.min(energy,Math.max(0,Math.floor(n)));energy-=spent;return {ok:spent===n,spent,energy};}};
}

test('Solo base starts with Photon Lance, Deep Eye and Living Membrane',()=>{
 const base=baseModule.create(memory(),wallet(1000));
 assert.deepEqual(base.STARTERS,['photon','range','regen']);
 assert.equal(base.unlocked('photon'),true);
 assert.equal(base.unlocked('range'),true);
 assert.equal(base.unlocked('regen'),true);
 assert.equal(base.unlocked('electric'),false);
});

test('resonance research costs follow shot passive buff rules',()=>{
 const base=baseModule.create(memory(),wallet(1000));
 assert.equal(base.cost('electric'),100);
 assert.equal(base.cost('burst'),80);
 assert.equal(base.cost('power'),60);
 assert.equal(base.research('electric').ok,true);
 assert.equal(base.research('burst').ok,true);
 assert.equal(base.research('power').ok,true);
});

test('submarine power costs 20 plus 10 for every installed weapon and partial top-up is proportional',()=>{
 const energy=wallet(1000),base=baseModule.create(memory(),energy);
 assert.equal(base.unlockedShots().length,1);
 assert.equal(base.fullPowerCost(),30);
 assert.equal(base.research('weapon:electric').ok,true);
 assert.equal(base.installWeapon('electric').ok,true);
 assert.equal(base.fullPowerCost(),40);
 assert.equal(base.research('submarineShield').ok,true);
 assert.equal(base.fullPowerCost(),40,'shield research must not add recurring energy cost');
 const full=base.topUp(0);
 assert.equal(full.cost,40);assert.equal(full.remaining,300);
 const half=base.topUp(150);
 assert.equal(half.cost,20);assert.equal(half.remaining,300);
});

test('Solo submarine is a powered world object with automatic researched weapons, bubbles and light',()=>{
 const game=read('public/game.js'),cave=read('public/abyssal-solo-cavern.js');
 assert.match(game,/let soloSubmarine=\{/);
 assert.match(game,/function updateSoloSubmarine\(dt\)/);
 assert.match(game,/window\.AbyssalSoloBase\?\.installedWeapons/);
 assert.match(game,/fireSoloSubmarineWeapon/);
 assert.match(game,/spawnFx/);
 assert.match(game,/SOLO_CAVERN\?\.lighting\([^;]+soloSubmarinePowered/);
 assert.match(cave,/24ff78/);
 assert.match(cave,/Every rock plant remains faintly self-luminous/);
});

test('PvE Resonance is research-gated while chosen skills still start at level 1',()=>{
 const game=read('public/game.js');
 assert.match(game,/if\(window\.AbyssalSoloBase\?\.unlocked\)return window\.AbyssalSoloBase\.unlocked\(id\)/);
 assert.match(game,/RESONANCE_DEFAULTS=\{pve:\['photon','range','regen'\]/);
 assert.match(game,/skill\.apply\(\);upgradeLevels\[id\]=1/);
});

test('cockpit research text documents proportional power and no shield surcharge',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js');
 assert.match(runtime,/20 Energia por 5 minutos/);
 assert.match(runtime,/Cada arma automática instalada acrescenta 10 Energia/);
 assert.match(runtime,/Não aumenta o consumo do ciclo/);
});
