'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const AbyssalMap=require('../public/abyssal-map.js');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
const game=read('public/game.js');
const server=read('server.js');
const between=(src,start,end)=>{
 const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a, 'Missing source span: '+start);
 return src.slice(a,b);
};

test('Fossas gate unlocks only after clearing the current tier boss in solo and multiplayer',()=>{
 const code=between(game,'function cavePortalsUnlocked(){','function currentMapInteraction(){');
 const run=new Function('activeMapLayout','onlineRoomMode','onlineMode','onlineBossesDefeated','bossKillsThisRun','activeMapTier','enemies','BOSS_KINDS',code+'; return cavePortalsUnlocked();');
 const map=AbyssalMap.createLayout(123,0);
 const kinds=['boss','kraken','leviathan'];
 const unlocked=(online,defeated,tier=0,enemies=[])=>
   run(map,'rift',online,online?defeated:0,online?0:defeated,tier,enemies,kinds);
 assert.equal(unlocked(false,0),false);
 assert.equal(unlocked(false,1),true,'solo portals unlocked after boss');
 assert.equal(unlocked(true,0),false);
 assert.equal(unlocked(true,1),true,'online portals unlocked after authoritative boss');
 assert.equal(unlocked(true,1,1),false,'next tier still needs its own boss');
 assert.equal(unlocked(true,2,1),true);
 assert.equal(unlocked(true,1,0,[{kind:'boss',hp:10}]),false);
 assert.equal(unlocked(true,1,0,[{kind:'boss',hp:0}]),true);
 assert.match(game,/onlineBossesDefeated=defeated/);
 assert.match(game,/onlineBossesDefeated=Math\.max\(onlineBossesDefeated,activeMapTier\+1\)/);
});

test('both physical boss portal destinations are navigable and visually labeled',()=>{
 const layout=AbyssalMap.createLayout(733,0),portals=layout.portals;
 assert.equal(portals.boss.type,'tier-descent');
 assert.equal(portals.surface.type,'surface');
 const code=between(game,'function currentMapInteraction(){','function updateMapInteraction(');
 const enter=new Function('player','activeMapLayout','onlineRoomMode','gameState','ABYSSAL_MAP','cavePortalsUnlocked','GAME_WORLD_ZOOM',code+';return currentMapInteraction();');
 const context=(x,y,unlocked=true)=>enter({x,y,r:10},layout,'rift','playing',AbyssalMap,()=>unlocked,1.55);
 assert.equal(context(portals.boss.x,portals.boss.y).type,'next-tier');
 assert.equal(context(portals.surface.x,portals.surface.y).type,'surface');
 assert.equal(context(portals.boss.x,portals.boss.y,false),null);
 const paint=between(game,'function drawMapPortal(portal,t){','function drawAbyssalCaveMap(t){');
 assert.match(paint,/VOLTAR À SUPERFÍCIE/);
 assert.match(paint,/DESCER MAIS FUNDO/);
 assert.match(paint,/EXTRAIR RECOMPENSAS/);
 assert.match(game,/const caveCleared=cavePortalsUnlocked\(\)/);
 assert.match(game,/drawMapPortal\(layout\.portals\.surface,t\)/);
 assert.match(game,/drawMapPortal\(layout\.portals\.boss,t\)/);
});

test('standardized trail and poison use bounded active cadence instead of permanent passives',()=>{
 assert.match(game,/bubble\.damageTimer=\.60/);
 assert.match(game,/wakeHitAt\|\|0\)>=600/);
 assert.match(server,/BUBBLE_TRAIL_HIT_MS=600/);
 assert.match(server,/life:3\.2,damageTimer:\.45,skinActive:true/);
 assert.match(server,/active==='poison'/);assert.match(server,/\[800,1600,2400\]/);
 assert.doesNotMatch(game,/player\.sharkTrailTimer=BUBBLE_TRAIL_EMIT_SECONDS/);
 assert.doesNotMatch(game,/player\.inkTrailTimer=BUBBLE_TRAIL_EMIT_SECONDS/);
});
test('Windows and Android builds inspect actual embedded launcher artwork, not only source paths',()=>{
 const android=read('.github/workflows/ci.yml');
 const windows=read('.github/workflows/download-builds.yml');
 const generator=read('scripts/build-app-icons.cjs');
 const check=read('scripts/check-icon-pixels.cjs');
 const desktop=JSON.parse(read('desktop/package.json'));
 assert.match(android,/Verify Android APK embeds the native anchor launcher/);
 assert.match(android,/dump badging/);
 assert.match(android,/ic_launcher_foreground/);
 assert.match(android,/node scripts\/check-icon-pixels\.cjs/);
 assert.match(windows,/ExtractAssociatedIcon/);
 assert.match(windows,/Custom violet Abyssal anchor icon was not embedded/);
 assert.match(generator,/assertVisibleAbyssalIcon/);
 assert.match(check,/APK icon is missing the metallic anchor or purple tentacles/);
 assert.equal(desktop.build.win.signAndEditExecutable,true);
 assert.equal(desktop.build.nsis.installerHeaderIcon,'build/icon.ico');
 assert.equal(desktop.version,'3.5.10');
});
