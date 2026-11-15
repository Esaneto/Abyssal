'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Scale=require('../public/creature-scale.js');
const Curated=require('../public/abyssal-curated-skins.js');
const read=path=>fs.readFileSync(path,'utf8');
test('every curated marine specimen has a finite biological reference size',()=>{
 for(const specimen of Curated.items){
  const meters=Scale.sizeOf(specimen.id);
  assert.ok(Number.isFinite(meters)&&meters>0,'missing adult size '+specimen.id);
 }
 assert.ok(Curated.items.length>=40);
});
test('natural lengths preserve predator/prey hierarchy next to a 1.80 m diver',()=>{
 assert.equal(Scale.DIVER_METERS,1.8);
 const length=id=>Scale.monsterMeters(null,id);
 assert.ok(length('greenland')>length('reefshark'));
 assert.ok(length('reefshark')>length('viperfish'));
 assert.ok(length('phantomjelly')>length('dumbo'));
 assert.ok(length('leatherback')>length('hawksbill'));
 assert.ok(length('spidercrab')>length('pistolshrimp'));
 assert.ok(length('kraken')>length('reefshark'));
 assert.equal(Scale.monsterMeters('stinger'),.5);
 assert.equal(Scale.monsterMeters('whiteShark'),4.8);
});
test('every enemy has a proportional body radius and boss length is 4–8 m',()=>{
 for(const [kind,meters] of Object.entries(Scale.MONSTER_METERS)){
  const visual=Scale.monsterVisualRadius(kind);
  const hit=Scale.creatureCollisionRadius(10,null,kind);
  assert.ok(meters>=.5&&Number.isFinite(visual)&&visual>0);
  assert.ok(hit>0&&hit<=visual*1.3+1e-9);
  assert.ok(Math.abs(visual*Scale.ART_SPAN[kind]-meters*Scale.PIXELS_PER_METER)<1e-8);
 }
 for(const meters of Object.values(Scale.BOSS_METERS))assert.ok(meters>=4&&meters<=8);
 for(const id of Object.keys(Scale.ADULT_METERS)){
  assert.ok(Scale.monsterMeters(null,id)>=.5);
  assert.ok(Scale.creatureCollisionRadius(10,id)>0);
  assert.ok(Scale.creatureCollisionRadius(10,id)<Scale.monsterVisualRadius(null,10,id));
 }
});
test('equipped companions are limited to 3 m and diver stays foreground',()=>{
 for(const id of Object.keys(Scale.ADULT_METERS)){
  assert.ok(Scale.companionMeters(id)>=.5&&Scale.companionMeters(id)<=3,id);
  assert.ok(Scale.visualRadius(id)>0&&Scale.companionCollisionRadius(id)<Scale.visualRadius(id));
 }
 assert.equal(Scale.companionMeters('kraken'),3);
 assert.equal(Scale.companionMeters('leviathan'),3);
 const src=read('public/game.js');
 assert.match(src,/companionR\*1\.7/);
 assert.match(src,/if\(Math\.hypot\(sx-px,sy-py\)/);
 assert.match(src,/drawDiver\(px,py,12\/GAME_WORLD_ZOOM,heading/);
});
test('solo and server use the same collision species table and multiplayer receives the correct script',()=>{
 const server=read('world-simulation.js'),game=read('public/game.js'),html=read('public/index.html'),offline=read('public/offline-sw.js');
 assert.match(server,/CreatureScale\.creatureCollisionRadius\(stats\.r,specimenSkinId,kind\)\*WORLD_ZOOM/);
 assert.match(game,/CREATURE_SCALE\?\.creatureCollisionRadius\?\.\(data\.r,specimenSkinId,kind\)/);
 assert.match(game,/CREATURE_SCALE\?\.visualRadius\?\.\(equippedSkin,player\.specimen\.r\)/);
 assert.match(game,/CREATURE_SCALE\?\.visualRadius\?\.\(peer\.skinId,10\/GAME_WORLD_ZOOM\)/);
 assert.match(game,/CREATURE_SCALE\?\.monsterVisualRadius\?\.\(enemy\.kind,Number\(enemy\.r\)/);
 assert.match(game,/Math\.max\(4,Math\.round\(radius\*2\)\/2\)/);
 assert.match(game,/density=Math\.max\(1,Math\.ceil\(dpr\*worldZoom\*renderScale\*1\.25\)\)/);
 assert.match(game,/MAX_SINGLE_SPRITE_PIXELS/);
 assert.match(html,/creature-scale\.js\?v=/);
 assert.match(offline,/'creature-scale\.js'/);
});
