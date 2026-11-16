const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const config=require('../public/abyssal-exploration-config'),research=require('../public/abyssal-research-system'),audio=require('../public/skill-audio');
const retired=['bulkhead','focuser','current','startShield'],legacy={bulkhead:3,focuser:3,current:3,startShield:1,pulse:1,dash:1};
const read=p=>fs.readFileSync(p,'utf8');
test('retired shop passives cannot be researched, migrated, equipped or unlocked by old saves',()=>{
 const levels=research.migrateLegacy(legacy,legacy).levels;
 for(const id of retired){assert.equal(config.RESEARCH[id],undefined);assert.equal(levels[id],undefined);assert.equal(research.unlocked(id,legacy,legacy),false);assert.equal(research.study(id,legacy,{}).reason,'unknown-research');}
 assert.deepEqual(research.sanitizeLegacyActives(legacy),{pulse:1,dash:1});assert.deepEqual(research.equipActives(['pulse','dash',...retired],levels,legacy),['pulse','dash']);
 assert.equal(research.studyCombatEnergy('pulse',{},legacy,500).reason,'owned');
 assert.equal(research.studyCombatEnergy('dash',{}, {},400).ok,true);
 assert.equal(legacy.bulkhead,3,'historical purchase records are not mutated');
});
test('fresh Solo and Online dives have the same baseline regardless of old purchase records',()=>{
 const game=read('public/game.js'),server=read('server.js');
 const hp=game.match(/runProgressTimer=0;maxHp=([^;]+);hp=maxHp/)[1];
 const start=game.match(/upgrades=\{power:([^,]+),rate:([^,]+),range:([^,]+),speed:([^,]+),magnet:([^,]+),regen:([^,]+),shield:([^,]+),burst:/);
 assert.equal(Number(hp),100);assert.deepEqual(start.slice(1).map(Number),[1,1,1,1,1,0,0]);
 assert.match(server,/const maxHp=100;/);assert.match(server,/const initialShieldCharges=0;/);assert.match(server,/baseDamage=28;/);
 for(const id of retired){assert.ok(!game.includes('metaUpgrades.'+id));assert.ok(!server.includes('metaUpgrades?.'+id));}
 assert.doesNotMatch(game,/metaShopItems|buyMetaUpgrade|toggleEquippedActiveSkill/);assert.doesNotMatch(read('public/index.html'),/metaUpgradeGrid|meta-shop-heading/);
});
test('current progression, research and specimen abilities remain distinct and available',()=>{
 for(const id of ['pulse','dash','power','rate','speed','range','magnet','regen','shield','pressureCocoon','vitality','photon','ricochet','spread','nova','photonRay','echoShot'])assert.ok(config.RESEARCH[id],id);
 assert.equal(config.RESEARCH.pulse.slot,'Q');assert.equal(config.RESEARCH.dash.slot,'E');
 const game=read('public/game.js');for(const id of ['magneticField','petAttack','petLife','petSpeed','petCadence','gravitationalRupture','arcChain','photonCascade','tidalEcho','hadalBeam'])assert.match(game,new RegExp(id+':0'));
 assert.match(game,/function activateSkinAbility\(/);assert.match(game,/function activateAbility\(id\)/);assert.match(game,/function loadEquippedActiveSkills\(/);
 assert.match(read('server.js'),/socket\.on\('purchase-meta'/,'old clients must receive a rejection, never a purchase');
});
