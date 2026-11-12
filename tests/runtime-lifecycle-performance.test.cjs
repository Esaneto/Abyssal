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
 assert.match(online,/if\(hidden\)stopPositionHeartbeat\(\);else if\(currentRoom\)startPositionHeartbeat\(\)/);
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
