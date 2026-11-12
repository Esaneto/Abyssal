'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Mar Aberto suspends its animation loop while inactive or hidden',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js');
 assert.match(runtime,/function scheduleExplorationFrame\(\)/);
 assert.match(runtime,/function setExplorationActive\(active\)/);
 assert.match(runtime,/if\(!active\)return;/);
 assert.match(runtime,/if\(document\.hidden\)\{if\(explorationFrame\)cancelAnimationFrame\(explorationFrame\)/);
 assert.match(runtime,/if\(cfg\(\)\?\.mode==='open-sea'\)scheduleExplorationFrame\(\)/);
 assert.doesNotMatch(runtime,/function tick\(time\)\{\s*requestAnimationFrame\(tick\)/);
});

test('hidden specimen portraits do not keep a permanent requestAnimationFrame chain',()=>{
 const game=read('public/game.js');
 assert.match(game,/function hasVisibleSpecimenPortrait\(\)/);
 assert.match(game,/visiblePortraits>0&&hasVisibleSpecimenPortrait\(\)/);
 assert.match(game,/if\(!canvas\.getClientRects\(\)\.length\|\|!canvas\.offsetWidth\|\|!canvas\.offsetHeight\)continue/);
});

test('multiplayer heartbeat exists only for a visible active room',()=>{
 const online=read('public/online.js');
 assert.match(online,/function startPositionHeartbeat\(\)[\s\S]*?document\.hidden\|\|!currentRoom/);
 assert.match(online,/function stopPositionHeartbeat\(\)[\s\S]*?clearInterval\(positionHeartbeatTimer\)/);
 assert.match(online,/currentRoom=data\.room\|\|null;startPositionHeartbeat\(\)/);
 assert.match(online,/socket\.on\('world-left'[\s\S]*?stopPositionHeartbeat\(\)/);
 assert.match(online,/socket\.on\('disconnect'[\s\S]*?stopPositionHeartbeat\(\)/);
 assert.match(online,/if\(hidden\)\{[\s\S]*?stopPositionHeartbeat\(\)[\s\S]*?\}else\{[\s\S]*?if\(currentRoom\)startPositionHeartbeat\(\)/);
});

test('remote player render state is released when peers leave or the room closes',()=>{
 const game=read('public/game.js');
 const online=read('public/online.js');
 assert.match(game,/function clearRemoteVisualState\(id=null\)/);
 for(const name of ['remoteDiverMotion','remoteWeaponInfusions','remoteWeaponParalysis','remoteSpecimenDashes','remoteCreatureAttackUntil']){
  assert.match(game,new RegExp(name+'\\.delete\\(key\\)'));
  assert.match(game,new RegExp(name+'\\.clear\\(\\)'));
 }
 assert.match(game,/abyssal-player-left'[\s\S]*?clearRemoteVisualState/);
 assert.match(game,/abyssal-room-left'[\s\S]*?clearRemoteVisualState/);
 assert.match(online,/socket\.on\('player-left'[\s\S]*?abyssal-player-left/);
});

test('run ranking traffic and DOM refreshes are bounded',()=>{
 const server=read('server.js');
 const game=read('public/game.js');
 const online=read('public/online.js');
 assert.match(server,/lastRunRankingBroadcastAt/);
 assert.match(server,/>=1000/);
 assert.match(game,/lastRunEnergyRankingSignature/);
 assert.match(game,/if\(signature===lastRunEnergyRankingSignature\)return/);
 assert.match(online,/if\(!root\.isConnected\|\|!root\.getClientRects\(\)\.length\)\{clearInterval\(window\.__abyssalRankingTimer\)/);
});

test('focus and visibility resume share one deduplicated state request',()=>{
 const online=read('public/online.js');
 assert.match(online,/function requestResumePlayerState\(\)/);
 assert.match(online,/now-lastResumeStateRequestAt<750/);
 assert.match(online,/window\.addEventListener\('focus',requestResumePlayerState\)/);
});

test('authentication rate-limit memory is pruned during long server uptime',()=>{
 const server=read('server.js');
 assert.match(server,/function pruneAuthAttempts\(now=Date\.now\(\)\)/);
 assert.match(server,/authAttempts\.size<2048/);
 assert.match(server,/if\(recent\.length\)authAttempts\.set\(ip,recent\);else authAttempts\.delete\(ip\)/);
 assert.match(server,/pruneAuthAttempts\(now\)/);
 assert.match(server,/authAttempts\.delete\(ip\);[\s\S]*?ensureAccountId\(user\)/);
});

test('gameplay loop fully suspends while the browser tab is hidden',()=>{
 const game=read('public/game.js');
 assert.match(game,/let gameLoopFrame=0,gameLoopTimer=0/);
 assert.match(game,/function scheduleGameLoop\(delay=0\)/);
 assert.match(game,/if\(document\.hidden\|\|gameLoopFrame\|\|gameLoopTimer\)return/);
 assert.match(game,/function stopGameLoop\(\)[\s\S]*?cancelAnimationFrame\(gameLoopFrame\)[\s\S]*?clearTimeout\(gameLoopTimer\)/);
 assert.match(game,/document\.addEventListener\('visibilitychange',[\s\S]*?if\(document\.hidden\)\{stopGameLoop\(\);return;\}[\s\S]*?scheduleGameLoop\(\)/);
 assert.doesNotMatch(game,/gameState==='menu'&&!onlineMode\)\{last=t;setTimeout\(\(\)=>requestAnimationFrame\(loop\),125\)/);
});

test('account maintenance uses one visible fallback timer instead of permanent intervals',()=>{
 const game=read('public/game.js');
 assert.match(game,/let accountMaintenanceTimer=0/);
 assert.match(game,/function scheduleAccountMaintenance\(delay=30000\)/);
 assert.match(game,/if\(document\.hidden\)return/);
 assert.doesNotMatch(game,/setInterval\(\(\)=>energyWallet\?\.sync\(\),5000\)/);
 assert.doesNotMatch(game,/setInterval\(syncSoloAdaptation,15000\)/);
});

test('online retry maintenance pauses while hidden and remains event-driven',()=>{
 const online=read('public/online.js');
 assert.match(online,/let onlineMaintenanceTimer=0/);
 assert.match(online,/function scheduleOnlineMaintenance\(delay=30000\)/);
 assert.match(online,/if\(document\.hidden\)return/);
 assert.doesNotMatch(online,/setInterval\(\(\)=>\{if\(authenticated&&readSoloQueue/);
 assert.match(online,/window\.addEventListener\('online',[\s\S]*?scheduleOnlineMaintenance\(3000\)/);
});

test('hidden account screens cache data without rebuilding their DOM',()=>{
 const online=read('public/online.js');
 assert.match(online,/function renderRankings\(data\)\{try\{localStorage\.setItem\('abyssalRankingsCache'/);
 assert.match(online,/const root=\$\('rankingContent'\),screen=\$\('rankingsScreen'\);if\(!root\|\|!data\|\|screen\?\.hidden\)return/);
 assert.match(online,/socket\.on\('cardumes-list',items=>\{const screen=\$\('cardumesScreen'\);if\(screen&&!screen\.hidden\)renderCardumesList\(items\);\}\)/);
 assert.match(online,/if\(serverAccount&&\$\('profileScreen'\)&&!\$\('profileScreen'\)\.hidden\)renderProfile\(serverAccount\)/);
});

test('account outbox completion no longer triggers unrelated hidden ranking or profile renders',()=>{
 const online=read('public/online.js');
 assert.match(online,/const row=readSoloQueue\(key\)\[0\];if\(!row\)return;/);
 const sync=online.slice(online.indexOf('function syncSpecimenAdaptation'),online.indexOf('// Durable account-scoped outbox'));
 assert.doesNotMatch(sync,/renderProfile\(/);
});

test('shop rebuilds are skipped for hidden post-run and wheel updates',()=>{
 const game=read('public/game.js');
 assert.match(game,/energyWallet\?\.credit\(earned,'offline-reward'\);saveCosmetics\(\);if\(!\$\('shopScreen'\)\?\.hidden\)renderShop\(\)/);
 assert.match(game,/saveCosmeticsLocalOnly\(\);if\(!\$\('shopScreen'\)\?\.hidden\)renderShop\(\);animateWheelToPrize/);
 assert.match(game,/const currencySelect=\$\('shopCurrency'\);if\(currencySelect\)currencySelect\.value='brl';if\(!\$\('shopScreen'\)\?\.hidden\)renderShop\(\)/);
 assert.match(game,/abyssal-rooms-list',ev=>\{const screen=\$\('roomsScreen'\);if\(screen&&!screen\.hidden\)renderRoomList/);
});
