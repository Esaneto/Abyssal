const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../rift-rewards'),C=require('../public/abyssal-curated-skins');
test('coin species counts reflect removal of the common blue-ring octopus',()=>{
 for(const family of ['shark','ray','eel','octopus','jelly','crustacean','mollusc','reptile','squid','fish','benthic']){
  const species=C.items.filter(s=>s.family===family&&s.morph);
  assert.equal(species.length,family==='octopus'?2:3,family);
  assert.ok(species.every(s=>!s.paid&&s.price>=85000));
 }
});
test('loot contains every purchased coin skin and excludes premium, promo and mission skins',()=>{
 for(const skin of C.items)assert.ok(R.COIN_SKINS.includes(skin.id));
 for(const id of ['saltcroc','blackcaiman','kraken','devourer','electriceel','greensnake','default'])assert.ok(!R.COIN_SKINS.includes(id));
});
test('exact 3 percent skin probability and six coin values, without duplicates',()=>{
 let skins=0;for(let roll=0;roll<100;roll++){const u={coins:0,ownedSkins:['default']},c=R.grant(u,'boss');let call=0;const r=R.open(u,c.id,n=>call++===0?roll:0);if(r.reward.type==='skin')skins++;else assert.equal(r.reward.amount,300);}
 assert.equal(skins,3);
 R.COINS.forEach((amount,i)=>{const u={},c=R.grant(u,'boss');let call=0;assert.equal(R.open(u,c.id,()=>call++===0?99:i).reward.amount,amount);assert.equal(u.coins,amount);assert.equal(R.open(u,c.id).duplicate,true);assert.equal(u.coins,amount);assert.equal(R.grant(u,'boss').id,c.id);});
});
test('owned skins are excluded; complete collection falls back to coins',()=>{
 const u={ownedSkins:[...R.COIN_SKINS]},c=R.grant(u,'boss');assert.equal(R.open(u,c.id,()=>0).reward.type,'coins');assert.equal(R.open(u,'forged').ok,false);
});
test('all seven Fossas bosses spawn once at their chamber and the next cycle remains playable',()=>{
 const W=require('../world-simulation'),AI=require('../public/enemy-ai');
 const w=W.createWorldState(0,'rift');w.mapSeed=812;w.initialized=true;
 for(let tier=0;tier<=AI.BOSS_KINDS.length;tier++){
  w.mapTier=tier;w.enemies=[];w.riftEncountersSeeded=false;w.riftActivatedRooms={};W.seedRiftEncounters(w);
  const layout=W.mapLayoutFor(w),room=layout.rooms.find(r=>r.id==='boss');
  const p={id:'p',x:room.x,y:room.y,hp:100,alive:true};
  const spawned=W.activateRiftEncounters(w,[p],()=>.5),boss=spawned.find(e=>AI.BOSS_KINDS.includes(e.kind));
  assert.ok(boss,`missing boss at tier ${tier}`);assert.equal(boss.kind,AI.BOSS_KINDS[tier%AI.BOSS_KINDS.length]);
  assert.equal(W.activateRiftEncounters(w,[p],()=>.5).length,0);if(tier<7)assert.equal(layout.portals.boss.unlockedAfterBosses,tier+1);else assert.equal(layout.portals.boss,null);
  assert.ok(layout.height>=9000);w.bossesDefeated=tier+1;
 }
});

test('Berçário de Ressonância keeps its treasure identity but also spawns cave fauna',()=>{
 const W=require('../world-simulation');
 const w=W.createWorldState(0,'rift');w.mapSeed=42;w.initialized=true;w.mapTier=0;W.seedRiftEncounters(w,()=>.5);
 const layout=W.mapLayoutFor(w),room=layout.rooms.find(r=>r.id==='event');
 const spawned=W.activateRiftEncounters(w,[{id:'p',x:room.x,y:room.y,hp:100,alive:true}],()=>.5);
 assert.equal(spawned.filter(e=>e.spawnRoomId==='event').length,6);
});
test('final Fossa chest guarantees Nightmare relic, one random skin and the 100k final prize',()=>{
 const u={coins:0,ownedSkins:['default']},c=R.grant(u,'final',{final:true});
 const result=R.open(u,c.id,()=>0);
 assert.equal(result.reward.type,'final');
 assert.equal(result.reward.nightmareSkinId,R.FINAL_SKIN);
 assert.ok(u.ownedSkins.includes(R.FINAL_SKIN));
 assert.ok(R.COIN_SKINS.includes(result.reward.randomSkinId));
 assert.ok(u.ownedSkins.includes(result.reward.randomSkinId));
 assert.equal(result.reward.amount,100000);
 assert.equal(u.coins,100000);
 const duplicate=R.open(u,c.id,()=>1);
 assert.equal(duplicate.duplicate,true);
 assert.equal(u.coins,100000,'reopening cannot credit the final prize twice');
});
