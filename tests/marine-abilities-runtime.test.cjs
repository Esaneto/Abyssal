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
  assert.ok(profile.cooldown>=3.5&&profile.cooldown<=9,s.id);
  assert.ok(profile.damage>0&&profile.radius>0,s.id);
  assert.ok(profile.description.includes(profile.title),s.id);
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
