const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../public/abyssal-curated-skins'),A=require('../public/skin-abilities'),S=require('../public/skin-standard'),P=require('../payments');
test('curated species keep high coin prices and receive runtime standardized profiles',()=>{
 assert.equal(C.items.length,41);
 for(const skin of C.items){assert.ok(skin.price>=45000);assert.equal(skin.paid,false);const p=S.profile(skin.id);assert.ok(p);assert.equal(p.percent,10);assert.ok(S.ACTIVE[p.active]);}
});
test('premium reptiles follow the new BRL tiers and exactly one passive attribute',()=>{
 for(const id of ['saltcroc','blackcaiman'])assert.equal(P.PAID_SKINS[id].brl,499);
 assert.equal(S.profile('saltcroc').percent,14);assert.equal(S.profile('blackcaiman').percent,14);
 assert.notEqual(S.profile('saltcroc').active+'|'+S.profile('saltcroc').attribute,S.profile('blackcaiman').active+'|'+S.profile('blackcaiman').attribute);
});
test('removed common blue-ring octopus does not affect the colossal boss or paid relic identity',()=>{
 assert.equal(C.byId.bluering,undefined);const game=fs.readFileSync('public/game.js','utf8');
 assert.match(game,/id:'aberration',name:'Eco do Polvo-de-Anéis-Azuis'/);
 assert.match(game,/boss:'POLVO-DE-ANÉIS-AZUIS COLOSSAL'/);
 assert.match(game,/blueRingOctopus\(\)/);
 assert.equal(S.profile('aberration').active,'trail');
});
