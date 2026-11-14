'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const economy=require('../public/abyssal-shop-economy.js');
const rarity=require('../public/specimen-rarity.js');
const specimens=require('../public/specimen-system.js');
const ai=require('../public/enemy-ai.js');

test('energy shop prices and paid rarity tiers match the current economy',()=>{
 const estimate=economy.estimateTenMinuteCoins();
 assert.ok(estimate.totalOffline>0,'the estimate must remain positive');
 assert.equal(estimate.totalOnline,estimate.totalOffline+estimate.bossCoins);
 // The old ten-minute affordability assumption predates the energy conversion.
 // Actual progression is governed by collected energy, not this legacy estimate.
 assert.deepEqual(economy.PRICE_BY_RARITY,{common:2500,uncommon:5000});
 assert.equal(economy.priceForRarity('common'),2500);
 assert.equal(economy.priceForRarity('uncommon'),5000);
 for(const tier of ['rare','epic','legendary'])assert.equal(economy.priceForRarity(tier),0,'paid rarity must not have an energy price');
 assert.equal(rarity.rarityFor('solar'),'common');
 assert.equal(rarity.rarityFor('thorn'),'uncommon');
 assert.equal(rarity.rarityFor('voidwing'),'rare');
 assert.equal(rarity.rarityFor('atolla'),'epic');
 assert.equal(rarity.rarityFor('gharial'),'legendary');
});

test('specimen biology always exposes gameplay HP speed and damage with rarity scaling',()=>{
 for(const id of ['default','solar','toxic','voidwing','atolla','gharial','kraken']){
  const stats=specimens.biologicalStats(id);
  assert.ok(stats.hp>0,id+' hp');assert.ok(stats.speed>0,id+' speed');assert.ok(stats.damage>0,id+' damage');
  assert.ok(['common','uncommon','rare','epic','legendary'].includes(stats.rarity),id+' rarity');
  assert.ok(Number.isFinite(stats.activeDamage),id+' active damage');
 }
 assert.ok(specimens.biologicalStats('toxic').hp>0);
 const game=read('public/game.js');
 assert.match(game,/SPECIMEN_SYSTEM\.effectiveStats\(equippedSkin,specimenPoints\(\)\)\.damage/);
 assert.match(game,/SPECIMEN_SYSTEM\.effectiveStats\(equippedSkin,specimenPoints\(\)\)\.speed/);
 assert.match(game,/SPECIMEN_SYSTEM\.effectiveStats\(equippedSkin,specimenPoints\(\)\)\.hp/);
});

test('white shark detects only targets inside its forward vision cone',()=>{
 const shark={id:1,kind:'whiteShark',x:100,y:100,angle:0,speed:100};
 const front=ai.sharkVisionState(shark,{x:300,y:100},1000);
 const behind=ai.sharkVisionState({...shark,sharkAlertUntil:0},{x:0,y:100},1000);
 assert.equal(front.visible,true);assert.equal(behind.visible,false);
 assert.ok(ai.SHARK_VISION.range>0&&ai.SHARK_VISION.halfAngle>0);
 const hidden={...shark,sharkAlertUntil:0,dashVx:null,dashVy:null};
 ai.moveTowardTarget(hidden,[{x:0,y:100,moveSpeed:150}],.1,{freeSwim:false,minX:0,maxX:1000,minY:0,maxY:1000,sharkLineOfSight:true});
 assert.ok(hidden.x>100,'shark outside cone should patrol forward, not home backward');
});

test('Control 1 projectiles originate from each rendered gun barrel',()=>{
 const game=read('public/game.js');
 assert.match(game,/const gunTip=DIVER_ART\?\.muzzle\?\.\(player\.x,player\.y,player\.r,a\)/); assert.match(game,/const shotMuzzle=gunTip/);
 assert.match(game,/projectiles\.push\(\{x:shotMuzzle\.x,y:shotMuzzle\.y/);
 assert.match(game,/sendShot\(\{x:shotMuzzle\.x\/W,y:shotMuzzle\.y\/H/);
});

test('Solo R uses shop active, pulse expands from specimen, and sonar is Open Sea only',()=>{
 const game=read('public/game.js');
 assert.match(game,/Only Mar Aberto uses companion sonar/);
 assert.match(game,/if\(isOpenSeaRun\(\)\)\{/);
 assert.match(game,/const spec=currentSkinActiveSpec\(\)/);
 assert.match(game,/expandingSkinPulses\.push\(\{x:origin\.x,y:origin\.y/);
 assert.match(game,/type:'specimen-pulse-wave'/);
 assert.match(game,/d\+margin<previous\|\|d-margin>wave\.edge/);
});

test('Solo commands are organized with Research and a purple Resonance action',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js'),css=read('public/abyssal-solo-hud.css');
 assert.match(runtime,/'PESQUISA'/);assert.doesNotMatch(runtime,/'MELHORIAS SOLO'/);
 assert.match(runtime,/abyss-resonance-action/);
 assert.match(css,/\.abyss-resonance-action/);assert.match(css,/#9b63ff/);
 assert.match(css,/bottom:158px!important/);
});

test('server uses the same rarity price authority for online coin purchases',()=>{
 const server=read('server.js');
 assert.match(server,/require\('\.\/public\/abyssal-shop-economy\.js'\)/);
 assert.match(server,/if\(profile\.tier!=='coins'\)return socket\.emit\('purchase-result',\{ok:false/);
 assert.match(server,/ShopEconomy\.priceForRarity\(rarity\)/);assert.match(server,/active==='pulse'/);assert.match(server,/const previous=radius\*clamp/);
});
