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
test('natural sizes preserve predator/prey hierarchy next to an adult diver',()=>{
 const r=id=>Scale.visualRadius(id,11);
 assert.ok(r('greenland')>r('reefshark'));
 assert.ok(r('reefshark')>r('viperfish'));
 assert.ok(r('phantomjelly')>r('dumbo'));
 assert.ok(r('leatherback')>r('hawksbill'));
 assert.ok(r('spidercrab')>r('pistolshrimp'));
 assert.ok(r('kraken')>r('reefshark'));
 assert.ok(Scale.monsterVisualRadius('riftSmile',154)>Scale.monsterVisualRadius('whiteShark',24));
 assert.ok(Scale.visualRadius('default',11)>0);
});
test('oversized tentacles do not block cave corridors with full visual bounds',()=>{
 for(const id of Object.keys(Scale.ADULT_METERS)){
  const visual=Scale.visualRadius(id,10);
  const hit=Scale.creatureCollisionRadius(10,id);
  assert.ok(Number.isFinite(visual)&&visual>=7);
  assert.ok(hit>=5&&hit<=15.5+1e-9,id);
 }
 assert.ok(Scale.visualRadius('kraken',10)<=38,'companions need bounded silhouette');
 assert.ok(Scale.monsterVisualRadius('riftSmile',154)<=175,'final boss must not fill the screen');
 assert.ok(Scale.monsterVisualRadius('kraken',80)<=138,'boss must fit in the chamber');
});
test('large companions are capped, with diver always foreground on local and online rendering',()=>{
 for(const id of Object.keys(Scale.ADULT_METERS)){
  assert.ok(Scale.visualRadius(id,11)>=14.5&&Scale.visualRadius(id,11)<=38,id+' must be readable and bounded');
  assert.ok(Scale.monsterVisualRadius('drifter',10,id)<=105,id+' wilderness sprite too large');
 }
 const src=read('public/game.js');
 assert.match(src,/companionR\*1\.7/);
 assert.match(src,/if\(Math\.hypot\(sx-px,sy-py\)/);
 assert.match(src,/drawDiver\(px,py,12\/GAME_WORLD_ZOOM,heading/);
});
test('solo and server use the same collision species table and multiplayer receives the correct script',()=>{
 const server=read('world-simulation.js'),game=read('public/game.js'),html=read('public/index.html'),offline=read('public/offline-sw.js');
 assert.match(server,/CreatureScale\.creatureCollisionRadius\(stats\.r,specimenSkinId\)/);
 assert.match(game,/CREATURE_SCALE\?\.creatureCollisionRadius\?\.\(data\.r,specimenSkinId\)/);
 assert.match(game,/CREATURE_SCALE\?\.visualRadius\?\.\(equippedSkin,player\.specimen\.r\)/);
 assert.match(game,/CREATURE_SCALE\?\.visualRadius\?\.\(peer\.skinId,10\/GAME_WORLD_ZOOM\)/);
 assert.match(game,/CREATURE_SCALE\?\.monsterVisualRadius\?\.\(enemy\.kind,Number\(enemy\.r\)/);
 assert.match(game,/Math\.max\(4,Math\.round\(radius\*2\)\/2\)/);
 assert.match(game,/density=Math\.max\(1,Math\.ceil\(dpr\*worldZoom\*renderScale\*1\.25\)\)/);
 assert.match(game,/MAX_SINGLE_SPRITE_PIXELS/);
 assert.match(html,/creature-scale\.js\?v=/);
 assert.match(offline,/'creature-scale\.js'/);
});
