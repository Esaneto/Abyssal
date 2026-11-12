'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const Biology=require('../public/specimen-system.js');
const Standard=require('../public/skin-standard.js');
const Curated=require('../public/abyssal-curated-skins.js');

test('all shop specimens have rarity-defined HP, speed, combat damage and their active attack data',()=>{
 const ids=Object.keys(Standard.profiles);
 assert.ok(ids.length>40);
 for(const id of ids){
  const bio=Biology.biologicalStats(id),ability=Standard.activeSpec(id);
  assert.ok(Number.isFinite(bio.hp)&&bio.hp>0,id);
  assert.ok(Number.isFinite(bio.speed)&&bio.speed>0,id);
  const base=Biology.RARITY_BASE[bio.rarity];
  assert.equal(bio.hp,base.hp,id);
  assert.equal(bio.speed,base.speed,id);
  assert.equal(bio.damage,base.damage,id);
  assert.equal(bio.activeDamage,ability.damage,id);
  assert.equal(bio.attack,ability.name,id);
  assert.equal(bio.effect,ability.effect,id);
 }
});
test('curated specimen family taxonomy is shared between client and server',()=>{
 for(const row of Curated.items)assert.equal(Biology.familyFor(row.id),row.family,row.id);
 assert.ok(Biology.biologicalStats('reefshark').hp>Biology.biologicalStats('violet').hp);
});
test('the Abyssario reveals a gradual journal with authoritative biological stats',()=>{
 const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 const css=fs.readFileSync(path.join(root,'public/abyssal-specimen-themes.css'),'utf8');
 const game=fs.readFileSync(path.join(root,'public/game.js'),'utf8');
 assert.match(html,/abyssal-specimen-themes\.css/);
 assert.match(html,/class="modal-card codex-modal abyss-journal"/);
 assert.match(css,/#catalogScreen \.abyss-journal/);
 assert.match(css,/#shopScreen #skinGrid \.skin-card \.skin-preview\.specimen-vessel/);
 assert.match(game,/specimen-journal-entry/);
 assert.match(game,/IntersectionObserver/);
 assert.match(game,/shopPreviewObserver/);
 assert.match(game,/SPECIMEN_SYSTEM\.effectiveStats\(equippedSkin,specimenPoints\(\)\)\.hp/);
});
test('multiplayer uses authoritative biological vitals and speed',()=>{
 const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.match(server,/specimenMaxHp:SpecimenSystem\.effectiveStats\(equippedSkinId,specimenPoints\)\.hp/);
 assert.match(server,/SpecimenSystem\.effectiveStats\(peer\.skinId,peer\.specimenPoints\)\.speed/);
 assert.match(server,/p\.specimenMaxHp=SpecimenSystem\.effectiveStats\(p\.skinId,p\.specimenPoints\)\.hp/);
});
