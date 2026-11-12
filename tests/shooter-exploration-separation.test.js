'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');

test('classic Solo and cooperative Online retain 4800x3000 shooter arena',()=>{
 const game=source('public/game.js'),world=source('world-simulation.js'),server=source('server.js');
 assert.match(game,/const defaultWidth=\(\)=>isOpenSeaRun\(\)\?oceanWidth\(\):4800/);
 assert.match(game,/defaultHeight=\(\)=>isOpenSeaRun\(\)\?oceanHeight\(\):3000/);
 assert.match(world,/width:mode==='open-sea'\?OceanStream\.WIDTH:WORLD_WIDTH/);
 assert.match(server,/function roomWorldWidth\(room\)\{return room\?\.mode==='open-sea'\?OceanStream\.WIDTH:WORLD_WIDTH;/);
 assert.match(server,/room\.world\.mode='classic'/);
});

test('classic shooter enemies spawn from corner fissures and follow aggressive AI',()=>{
 const game=source('public/game.js'),world=source('world-simulation.js'),enemyAI=source('public/enemy-ai.js');
 assert.match(game,/else for\(let i=0;i<7;i\+\+\)spawnEnemy\(true,'common'\)/);
 assert.match(game,/if\(!onlineMode&&isClassicShooterRun\(\)&&spawnTimer<=0\)/);
 assert.match(world,/if \(world\.mode==='classic' && world\.commonSpawnTimer <= 0\)/);
 assert.match(game,/wildlifeMode:isOpenSeaRun\(\)&&!isBossType\?/);
 assert.match(world,/wildlifeMode:world\.mode==='open-sea'&&type!=='boss'\?/);
 assert.match(enemyAI,/function chooseSpawnPoint\(/);
 assert.match(enemyAI,/cornerOverride/);
});

test('only classic modes advance the periodic boss progression track',()=>{
 const game=source('public/game.js'),world=source('world-simulation.js');
 assert.match(game,/gameState !== 'playing'\|\|!isClassicShooterRun\(\)/);
 assert.match(game,/if\(isClassicShooterRun\(\)\)updateBossProgressionStep\(dt\)/);
 assert.match(game,/if \(!isClassicShooterRun\(\)\) \{ track\.style\.display = 'none'/);
 assert.match(world,/if \(world\.mode==='classic' && world\.elapsed >= world\.nextBossAt/);
 assert.match(world,/if \(world\.mode==='open-sea'\) spawnedEnemies\.push\(\.\.\.updateOceanStreaming/);
});

test('natural geography and ecology are exclusive to open sea exploration',()=>{
 const game=source('public/game.js'),world=source('world-simulation.js');
 assert.match(game,/if\(usesNaturalOceanTerrain\(\)\)\{/);
 assert.match(game,/if\(!player\|\|!isOpenSeaRun\(\)\|\|!OCEAN_STREAM/);
 assert.match(world,/if\(world\.mode!=='open-sea'\|\|now-/);
 assert.match(world,/const openSeaSkin=world\.mode==='open-sea'/);
});

test('control 1 is selectable only in classic shooter and control 2 obeys cadence',()=>{
 const game=source('public/game.js');
 assert.match(game,/function isManualFiringMode\(\)\{return !isClassicShooterRun\(\)/);
 assert.match(game,/if\(isRiftRun\(\)\|\|isOpenSeaRun\(\)\)\{controlSettings\.pc='wasd-aim';controlSettings\.mobile='dual-stick';\}/);
 assert.match(game,/b\.disabled=restricted&&b\.dataset\.controlPc==='classic'/);
 assert.match(game,/b\.disabled=restricted&&b\.dataset\.controlMobile==='classic'/);
 assert.match(game,/player\.fireTimer=Math\.max\(0,\(Number\(player\.fireTimer\)\|\|0\)-dt\)/);
 assert.match(game,/player\.fireTimer=Math\.max\(\.12,\.52\/\(\(upgrades\.rate\|\|1\)\*specimenPassiveMultiplier\('fireRate'\)\)\)/);
 const pointer=game.slice(game.indexOf("canvas.addEventListener('pointerdown'"),game.indexOf("canvas.addEventListener('pointermove'"));
 const mobile=game.slice(game.indexOf("mobileFireBtn.addEventListener('pointerdown'"),game.indexOf("['pointerup','pointercancel','lostpointercapture']"));
 assert.doesNotMatch(pointer,/fireTimer\s*=\s*0/);
 assert.doesNotMatch(mobile,/fireTimer\s*=\s*0/);
});

test('old solo/online handlers live outside the visual menu',()=>{
 const html=source('public/index.html');
 const start=html.indexOf('id="menuScreen"'),bridge=html.indexOf('id="classicDiveActionBridges"'),hud=html.indexOf('id="hud"');
 assert.ok(start>=0&&bridge>start&&hud>bridge);
 const menu=html.slice(start,bridge);
 assert.doesNotMatch(menu,/id="(?:playBtn|onlineBtn)"/);
 assert.match(menu,/id="divePortalBtn"/);
 assert.match(menu,/id="openSeaPortalBtn"/);
 assert.match(menu,/id="riftPortalBtn"/);
 assert.match(html,/id="playBtn" type="button" hidden tabindex="-1"/);
 assert.match(html,/id="onlineBtn" type="button" hidden tabindex="-1"/);
 assert.match(html,/#menuScreen\.ocean-menu-v2:not\(\.menu-ready\)\{visibility:hidden!important\}/);
});

test('classic co-op never consumes oxygen, suffers depth pressure or receives depth events',()=>{
 const server=source('server.js');
 assert.match(server,/if\(room\.mode==='open-sea'\)\{\s*for\(const diver of activePlayers\)/);
 assert.match(server,/if\(room\.mode==='rift'\|\|room\.mode==='open-sea'\)\{\s*const research=/);
 assert.match(server,/if\(room\.mode==='rift'\)\{\s*WorldSimulation\.startDepthEvent\(w,Math\.random\)/);
 const game=source('public/game.js');
 assert.match(game,/function publishSoloDepthState\(\)\{\s*if\(onlineMode\|\|!isRiftRun\(\)\)return;/);
 assert.match(game,/if\(isRiftRun\(\)&&data\.depthState\)window\.dispatchEvent/);
});

test('classic arena builds visible perimeter rocks but exploration does not',()=>{
 const game=source('public/game.js');
 assert.match(game,/if\(usesNaturalOceanTerrain\(\)\|\|isRiftRun\(\)\)return;/);
 assert.match(game,/const spacing=95\/worldZoom,offset=24\/worldZoom;/);
 assert.match(game,/arenaRocks\.push\(\{x,y,r:radius,edge,vertices,shade:fraction,visualOnly:true\}\)/);
 assert.match(game,/createArenaRocks\(\);[\s\S]{0,220}const soloSpawn=/);
 assert.match(game,/if\(usesNaturalOceanTerrain\(\)\)\{\s*window\.AbyssalOpenSeaRender/);
});

test('T follows mouse with manual control 2 and never toggles auto-fire',()=>{
 const game=source('public/game.js');
 assert.match(game,/autoFollowCursor\|\|controlSettings\.pc==='classic'&&pointer\.down/);
 assert.match(game,/&&!?\(mx\|\|my\)/);
 assert.match(game,/if\(dd>12\)\{mx=dx\/dd;my=dy\/dd\}/);
 assert.match(game,/if\(isPcMouseAimMode\(\)\)updateMouseAimFromCursor\(\)/);
 assert.match(game,/autoFollowCursor=!autoFollowCursor/);
 assert.match(game,/autoFollowCursor=false;\s*document\.body\.classList\.add\('game-active'\)/);
});
