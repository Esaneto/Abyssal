'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Skins=require('../skin-abilities'),Catalog=require('../public/abyssal-curated-skins.js');
const read=path=>fs.readFileSync(path,'utf8');
const close=(a,b)=>Math.abs(a-b)<1e-9;
test('all 41 species stay within PvE/PvP effective attack, mitigation and mobility budgets',()=>{
 assert.equal(Catalog.items.length,41);
 const ids=new Set();
 for(const s of Catalog.items){
  assert.ok(!ids.has(s.id),'duplicate '+s.id);ids.add(s.id);
  assert.ok(s.paid===false&&s.price>=45000,'species economic identity changed');
  assert.ok(s.bonuses&&s.bonuses[s.stat]===s.multiplier,s.id+' primary stat differs');
  const dmg=Skins.damageMultiplier(s.id,'drifter',100,1),boss=Skins.damageMultiplier(s.id,'kraken',100,1);
  const defense=Skins.incomingDamageMultiplier(s.id);
  const fire=Skins.fireRateMultiplier(s.id),move=Skins.movementMultiplier(s.id);
  const range=Skins.targetRangeMultiplier(s.id),magnet=Skins.magnetRangeMultiplier(s.id);
  const xp=Skins.orbExperienceMultiplier(s.id);
  assert.ok(dmg>=1&&dmg<=1.17,s.id+' high base damage '+dmg);
  assert.ok(boss<=1.17,s.id+' high boss damage');
  assert.ok(defense>=.87&&defense<=1,s.id+' excessive mitigation '+defense);
  assert.ok(fire>=1&&fire<=1.12,s.id+' excessive fire rate '+fire);
  assert.ok(move>=1&&move<=1.12,s.id+' excessive mobility '+move);
  assert.ok(range<=1.19&&magnet<=1.30&&xp<=1.18,s.id+' excessive support');
  assert.ok(dmg*fire<=1.28,s.id+' unsustainable damage per second');
  assert.ok(dmg*fire/defense<=1.34,s.id+' stacked attack + sustain');
  assert.ok(s.ability.length>30&&s.ability.includes('%'),s.id+' undocumented stat');
 }
 assert.equal(ids.has('bluering'),false,'previously deleted common blue-ring octopus was restored');
});
test('paid/special skins remain recognizable but cannot dominate by stacking passive multipliers',()=>{
 assert.ok(close(Skins.damageMultiplier('saltcroc','kraken',100,1),1.24*1.12));
 assert.ok(Skins.damageMultiplier('saltcroc','kraken',100,1)<1.4);
 assert.ok(close(Skins.damageMultiplier('saltcroc','player',100,1),1.24));
 assert.equal(Skins.incomingDamageMultiplier('blackcaiman'),.85);
 assert.equal(Skins.movementMultiplier('blackcaiman'),1.1);
 assert.equal(Skins.damageMultiplier('leviathan','riftSmile',500,1),1.2);
 assert.equal(Skins.damageMultiplier('riftSmileRelic','riftSmile',500,1),1.1);
 assert.equal(Skins.damageMultiplier('greensnake','player',500,1),1.06);
 assert.equal(Skins.damageMultiplier('electriceel','player',500,1),1.05);
 assert.equal(Skins.damageMultiplier('greensnake','drifter',500,1),1);
 assert.equal(Skins.damageMultiplier('electriceel','drifter',500,1),1);
 assert.equal(Skins.magnetRangeMultiplier('devourer'),1.25);
 assert.equal(Skins.magnetRangeMultiplier('hammerhead'),1.30);
});
test('server and browser share every passive plus cooldown/damage constants for active abilities',()=>{
 assert.equal(read('public/skin-abilities.js'),read('skin-abilities.js'));
 const server=read('server.js'),game=read('public/game.js');
 assert.match(server,/BUBBLE_TRAIL_HIT_SECONDS=\.30,BUBBLE_TRAIL_HIT_MS=300/);
 assert.match(game,/BUBBLE_TRAIL_HIT_SECONDS=\.30,BUBBLE_TRAIL_HIT_MS=300/);
 assert.match(server,/SKIN_TRAIL_CADENCE_SECONDS=\.75,SKIN_TRAIL_CADENCE_MS=750/);
 assert.match(game,/SKIN_TRAIL_CADENCE_SECONDS=\.75,SKIN_TRAIL_CADENCE_MS=750/);
 assert.match(server,/armoredgator-spin':\{skin:'armoredgator',cooldown:9000,range:190\/WORLD_ZOOM,damage:27/);
 assert.match(game,/armoredgator:\{cooldown:9,range:190,damage:27/);
 assert.match(server,/abysscroc-lunge':\{skin:'abysscroc',cooldown:16000,range:210\/WORLD_ZOOM,damage:34/);
 assert.match(game,/abysscroc:\{cooldown:16,range:210,damage:34/);
 assert.match(server,/krakenContactAt'\+normalizedId;if\(now-\(Number\(player\[key\]\)\|\|0\)<850/);
 assert.match(game,/krakenTentacleHitAt\)\|\|0\)<850/);
 assert.match(server,/requestedDamage=Math.min\(requestedDamage,15\)/);
 assert.match(game,/dealEnemyDamage\(target,15,'kraken-contact'/);
 assert.match(server,/toxicCloudReadyAt=now\+6500/);
 assert.match(game,/player\.toxicCloudTimer=6\.5/);
});
test('poison cannot perpetually reapply itself and online poison is server-verified',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/!\['poison-dot','toxic-cloud','pelagic-wake','blue-ring-ink'\]\.includes/);
 assert.match(game,/dealEnemyDamage\(e, 2\.5, 'poison-dot'/);
 assert.match(server,/if\(skillId==='poison-dot'\)/);
 assert.match(server,/enemy\.poisonOwnerId!==player\.id/);
 assert.match(server,/enemy\.poisonTickReadyAt=now\+750/);
 assert.match(server,/enemy\.poisonedUntil=now\+3500/);
 assert.match(server,/requestedDamage=Math.min\(requestedDamage,2\.5\)/);
 assert.match(server,/owner\.skinId!==skin/);
 assert.match(server,/Math\.hypot\(Number\(owner\.x\)-x\*WORLD_WIDTH/);
});
test('previously protected boss blue-ring playable relic and boss visual stay intact',()=>{
 const game=read('public/game.js');
 assert.match(game,/id:'aberration',name:'Eco do Polvo-de-Anéis-Azuis'/);
 assert.match(game,/boss:'POLVO-DE-ANÉIS-AZUIS COLOSSAL'/);
 assert.match(game,/type:'ink-trail',skin:'aberration'/);
});

test('Violet resonance matches authoritative four-target 230-range cap and retired shark dash is denied',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/filter\(v=>v\.d<=230\/GAME_WORLD_ZOOM\)\.sort\(\(a,b\)=>a\.d-b\.d\)\.slice\(0,4\)/);
 assert.match(game,/max:230\/GAME_WORLD_ZOOM,life:\.58/);
 assert.match(server,/if\(distance>230\/WORLD_ZOOM\)return reject\('skin-ability-out-of-range'\)/);
 assert.match(server,/violetResonanceTargetIds\.size>=4/);
 assert.match(server,/if\(skillId==='reefshark-dash'\)return reject\('skin-ability-removed'\)/);
});
