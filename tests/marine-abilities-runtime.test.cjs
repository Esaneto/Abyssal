'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const species=require('../public/marine-species').species;
const abilities=require('../public/marine-abilities');
const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const simulation=fs.readFileSync(path.join(root,'world-simulation.js'),'utf8');

test('every marine species has a unique active ability profile and rarity',()=>{
 assert.equal(Object.keys(abilities.profiles).length,100);
 assert.equal(new Set(Object.values(abilities.profiles).map(p=>p.id)).size,100);
 assert.equal(new Set(Object.values(abilities.profiles).map(p=>p.title)).size,100);
 for(const s of species){
  const profile=abilities.profileFor(s.id);
  assert.ok(profile,s.id);
  assert.ok(abilities.RARITY_ORDER.includes(profile.rarity),s.id);
  assert.ok(profile.cooldown>=3.2&&profile.cooldown<=9,s.id);
  assert.ok(profile.damage>0&&profile.radius>0&&profile.powerScore>0,s.id);
  assert.ok(profile.description.includes(profile.title),s.id);assert.match(profile.description,/Recarga \d+(?:\.\d+)?s\./,s.id);
 }
});

test('shop exposes specimen filters and orders skins by rarity',()=>{
 for(const id of ['shopSearchInput','shopRarityFilter','shopFamilyFilter','shopOwnershipFilter','shopFilterSummary'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(game,/visibleSkins=skinData\.filter/);
 assert.match(game,/shopRarityRank\(skinShopRarity\(a\)\)-shopRarityRank\(skinShopRarity\(b\)\)/);
 assert.match(game,/ORDENADOS DO MENOS RARO AO MAIS RARO/);
 assert.match(game,/skin-rarity/);
});

test('marine abilities execute real damage patterns and replicate visuals online',()=>{
 assert.match(game,/function triggerMarineSpeciesAbility\(profile\)/);
 assert.match(game,/dealEnemyDamage\(target,baseDamage\*falloff,'marine-'/);
 assert.match(game,/window\.AbyssalOnline\.sendSkinAbility/);
 assert.match(game,/renderMarineAbilityVisual\(MarineAbilities\.profileFor\(skin\)/);
 for(const kind of ['dash','cone','aura','multi','lance','sweep','armor','pulse','chain','veil','mark','trap','pull','grasp','rage','blast','spines'])assert.ok(Object.values(abilities.profiles).some(p=>p.kind===kind),kind);
});

test('weak bosses have authoritative physical abilities and synchronized visuals',()=>{
 for(const id of ['neuro-ring','lure-pulse','gulper-chomp','pressure-lance']){
  assert.ok(simulation.includes("'"+id+"'"),id);
  assert.ok(game.includes("'"+id+"'"),id);
 }
 assert.match(simulation,/bossAbilityHits/);
 assert.match(simulation,/bossAbilityEvents/);
 assert.match(server,/boss-ability-visual/);
 assert.match(server,/reason:'boss-ability'/);
 assert.match(game,/abyssal-boss-ability-visual/);
});

test('approved boss trio remains excluded from redesign routing',()=>{
 assert.match(game,/!\['whiteSharkBoss','kraken','devourer'\]\.includes\(kind\)/);
});


test('Abyssal collection remains visible through biological taxonomy and mission rewards are top tier',()=>{
 const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
 for(const row of [
  "violet:{family:'jelly',collections:['signature']}",
  "bloodmoon:{family:'squid',collections:['signature']}",
  "voidwing:{family:'ray',collections:['signature']}",
  "abyssaleye:{family:'fish',collections:['signature']}",
  "abyssking:{family:'mollusc',collections:['signature']}",
  "greensnake:{family:'eel',collections:['signature','mission'],unlockType:'mission'}"
 ])assert.ok(game.includes(row),row);
 assert.match(game,/greensnake:'colossal'/);
 assert.match(game,/categories\.has\(familyFilter\)/);
 assert.match(html,/value="mission"/);
 assert.match(html,/value="promo"/);
});

test('enemy pressure is stronger in both authoritative and solo simulation',()=>{
 const world=fs.readFileSync(path.join(root,'world-simulation.js'),'utf8');
 assert.match(world,/physicalScale=eliteId\?1\.18:1\.07/);
 assert.match(world,/speedScale=eliteId\?1\.08:1\.03/);
 assert.match(game,/physicalScale=eliteId\?1\.18:1\.07/);
 assert.match(game,/drawEnemyThreatAura/);
 assert.match(game,/drawSkinPresenceAura/);
});


test('paid and high-rarity marine abilities are mechanically stronger',()=>{
 const rows=species.map(s=>({s,p:abilities.profileFor(s.id)}));
 const epic=rows.filter(x=>x.s.rarity==='epic').map(x=>x.p.powerScore);
 const legendary=rows.filter(x=>x.s.rarity==='legendary').map(x=>x.p.powerScore);
 const mythic=rows.filter(x=>x.s.rarity==='mythic').map(x=>x.p.powerScore);
 const avg=a=>a.reduce((n,v)=>n+v,0)/a.length;
 assert.ok(avg(legendary)>avg(epic));
 assert.ok(avg(mythic)>avg(legendary));
 for(const {s,p} of rows.filter(x=>x.s.paid)){assert.equal(p.paid,true,s.id);assert.ok(p.damage>=60,s.id);}
});

test('common enemies and redesigned bosses expose stronger named physical attacks',()=>{
 for(const marker of ["skillId:'bio-shock'","skillId:'venom-spine'","skillId:'crusher-claw'","skillId:'gulper-bite'"])assert.ok(simulation.includes(marker),marker);
 for(const marker of ["bossAbilityHit(enemy,target,18,now,'neuro-ring'","bossAbilityHit(enemy,target,12,now,'lure-pulse'","bossAbilityHit(enemy,target,24,now,'gulper-chomp'","bossAbilityHit(enemy,target,22,now,'pressure-lance'"])assert.ok(simulation.includes(marker),marker);
 assert.match(game,/function renderHostileContactAbility\(data\)/);
 assert.match(game,/hurtPlayer\(e\.damage\*\(cp\?\.power\|\|\(e\.kind==='kraken'/);
 assert.match(game,/whiteSharkBoss'\?1\.15/);
 assert.match(game,/devourer'&&e\.suctionActive\?1\.2/);
});
