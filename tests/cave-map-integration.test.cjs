'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const index=read('public/index.html'),game=read('public/game.js'),server=read('server.js'),online=read('public/online.js'),world=read('world-simulation.js'),css=read('public/abyssal-rebuild.css');

test('shared cave geometry loads before gameplay and is used by solo plus server',()=>{
 assert.ok(index.indexOf('abyssal-map.js?v=2')>0);
 assert.ok(index.indexOf('abyssal-map.js?v=2')<index.indexOf('game.js?v=4.4.5'));
 assert.match(game,/const ABYSSAL_MAP=window\.AbyssalMap/);
 assert.match(world,/require\('\.\/public\/abyssal-map\.js'\)/);
 assert.match(server,/require\('\.\/public\/abyssal-map\.js'\)/);
});

test('co-op snapshots share only compact deterministic map identity',()=>{
 assert.match(server,/map:\{version:AbyssalMap\.VERSION,seed:Number\(world\.mapSeed\)\|\|0,tier:Number\(world\.mapTier\)\|\|0\}/);
 assert.match(game,/if\(data\.map\)setActiveMapDescriptor\(data\.map\)/);
 assert.doesNotMatch(server,/map:\{[^}]*rooms:/);
});

test('co-op spawn collision and enemy simulation all use cave geometry',()=>{
 assert.match(server,/AbyssalMap\.startSpawn\(WorldSimulation\.mapLayoutFor\(room\.world\)/);
 assert.match(server,/AbyssalMap\.resolveMove\(layout,previousX,previousY,x,y/);
 assert.match(world,/AbyssalMap\.spawnPoint\(layout/);
 assert.match(world,/AbyssalMap\.navigationTarget\(mapLayout/);
 assert.match(world,/AbyssalMap\.resolveMove\(mapLayout/);
 assert.match(game,/mapResolveMove\(player\.x,player\.y,nextX,nextY/);
});

test('boss and elite placement have dedicated chambers',()=>{
 assert.match(world,/type: type === 'boss' \? 'boss' : type/);
 assert.match(world,/if \(eliteId && !options\.roomId && type !== 'elite'\)/);
 assert.match(world,/AbyssalMap\.spawnPoint\(layout, \{ type: 'elite'/);
 assert.match(game,/if\(eliteId&&!options\.roomId&&!isBossType\)/);
 assert.match(game,/ABYSSAL_MAP\.spawnPoint\(map,\{type:'elite'/);
 assert.match(world,/enemy\.eliteId&&enemy\.spawnRoomId==='elite'/);
 assert.match(game,/e\.eliteId&&e\.spawnRoomId==='elite'/);
});

test('descent portals use F or a contextual mobile button and server validation',()=>{
 assert.match(game,/e\.key==='f'\|\|e\.key==='F'/);
 assert.match(game,/abyssMapInteractBtn/);
 assert.match(game,/requestMapTransition\?\.\(interaction\.type/);
 assert.match(online,/function requestMapTransition/);
 assert.match(online,/socket\.timeout\(3000\)\.emit\('map-transition'/);
 assert.match(server,/socket\.on\('map-transition'/);
 assert.match(server,/proximity>allowedRadius/);
 assert.match(server,/AbyssalMap\.isWalkable\(layout,target\.x,target\.y/);
 assert.match(css,/\.abyss-map-interact/);
});

test('surface vortex reuses the existing safe run-finalization path',()=>{
 assert.match(game,/interaction\.type==='surface'/);
 assert.match(game,/const button=\$\('endDiveBtn'\);if\(button\)\{button\.click\(\)/);
 assert.match(game,/expeditionExtracted=true/);
});

test('PvP retains its dedicated arena instead of inheriting expedition caves',()=>{
 assert.match(game,/onlineRoomMode==='pvp'\)\{activeMapLayout=null/);
 assert.match(game,/function currentMapInteraction\(\)\{[\s\S]*?onlineRoomMode==='pvp'[\s\S]*?return null/);
 assert.match(server,/const expeditionSpawn=room\.mode==='coop'\?/);
});
