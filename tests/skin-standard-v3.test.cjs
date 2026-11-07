'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Standard=require('../public/skin-standard.js');
const Payments=require('../payments.js');

test('skin tiers use exactly 10 12 14 and 16 percent',()=>{
 assert.equal(Standard.TIER_PERCENT.coins,10);
 assert.equal(Standard.TIER_PERCENT.brl199,12);
 assert.equal(Standard.TIER_PERCENT.brl499,14);
 assert.equal(Standard.TIER_PERCENT.brl999,16);
});
test('every skin has one unique active plus attribute pair',()=>{
 assert.equal(Standard.validate(),true);
 const pairs=new Set();
 for(const p of Object.values(Standard.profiles)){
  assert.ok(Standard.ACTIVE[p.active],p.id+' active');
  assert.ok(Standard.ATTRIBUTES.includes(p.attribute),p.id+' attribute');
  const key=p.active+'|'+p.attribute;assert.ok(!pairs.has(key),key);pairs.add(key);
 }
});
test('paralysis belongs only to the electric ray and electric eel',()=>{
 const ids=Object.values(Standard.profiles).filter(p=>p.active==='paralysis').map(p=>p.id).sort();
 assert.deepEqual(ids,['electriceel','electriceellegacy']);
 assert.equal(Standard.profile('electriceel').attribute,'fireRate');
 assert.equal(Standard.profile('electriceellegacy').attribute,'movement');
});
test('boss skins cost R$9.99 and premium tiers use only R$1.99 R$4.99 R$9.99',()=>{
 const paid=Payments.PAID_SKINS;
 for(const id of ['leviathan','kraken','aberration','angler','maw','devourer'])assert.equal(paid[id].brl,999,id);
 for(const product of Object.values(paid))assert.ok([199,499,999].includes(product.brl),product.name);
 assert.equal(paid.electriceellegacy.brl,499);
 assert.equal(paid.riftSmileRelic,undefined);
});
test('Mar Aberto conquest still awards greensnake at 42 bosses',()=>{
 const server=fs.readFileSync('server.js','utf8'),game=fs.readFileSync('public/game.js','utf8'),html=fs.readFileSync('public/index.html','utf8');
 assert.match(server,/runStats\.bossesKilled\s*>=\s*42/);
 assert.match(server,/grantFinalConquest\(u\)/);
 assert.match(server,/skinId:'greensnake'/);
 assert.match(game,/ownedSkins\.push\('greensnake'\)/);
});
test('standardized skin actives are server-authoritative and manual',()=>{
 const server=fs.readFileSync('server.js','utf8'),game=fs.readFileSync('public/game.js','utf8');
 assert.match(server,/payload\.type!=='standard-active'/);
 assert.match(server,/SkinStandard\.activeSpec\(skin\)/);
 assert.match(server,/skin-active-server-only/);
 assert.match(game,/function activateSkinAbility\(/);
 assert.match(game,/e\.key==='r'\|\|e\.key==='R'/);
 assert.match(html,/id="skinActiveBtn"/);
});
test('Leviathan projectile telegraphs before PvP damage and toxic cloud uses poison plant visual',()=>{
 const server=fs.readFileSync('server.js','utf8'),game=fs.readFileSync('public/game.js','utf8');
 assert.equal(Standard.profile('leviathan').active,'shot');
 assert.match(server,/skin-shot-telegraph/);
 assert.match(server,/hitAt:now\+450/);
 assert.match(game,/type:'poison-plant-cloud'/);
 assert.match(game,/id==='toxic-cloud'\|\|id==='monster-toxic-cloud'/);
});
