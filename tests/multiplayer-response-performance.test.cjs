'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('remote players use timestamped jitter buffer plus bounded fallback extrapolation',()=>{
 const online=read('public/online.js');
 assert.match(online,/interpDuration:Math\.max\(24,Math\.min\(isPvp\?45:55,sampleMs\*1\.05\)\)/);
 assert.match(online,/peerExtrapolationMs:isPvp\?60:85/);
 assert.match(online,/function pushPeerMotionSample/);
 assert.match(online,/motionBufferMs=Math\.max/);
 assert.match(online,/serverNow=Number\(latest\.serverTime\)/);
 assert.match(online,/extraMs=Math\.min\(90/);
});

test('common enemy motion packets omit boss-only fields and preserve keep-warm relevance',()=>{
 const server=read('server.js');
 const sim=read('world-simulation.js');
 assert.match(server,/const x=Math\.round\(\(Number\(e\.x\)\|\|0\)\*100\)\/100/);
 assert.match(server,/intervalMs:50/);
 assert.match(server,/if\(e\.kind==='devourer'\)return \[\.\.\.base/);
 assert.match(server,/if\(e\.kind==='kraken'\)return \[\.\.\.base/);
 assert.match(server,/sendFar=!recipient\|\|motionNow-\(Number\(recipient\.lastFarMotionAt\)\|\|0\)>=250/);
 assert.match(sim,/world\.snapshotTimer = 0\.05/);
 const game=read('public/game.js');
 assert.match(game,/row\.length<7/);
});

test('XP is awarded directly by the authoritative server without orb motion traffic',()=>{
 const sim=read('world-simulation.js');
 const server=read('server.js');
 const game=read('public/game.js');
 assert.doesNotMatch(sim,/orbSnapshotTimer/);
 assert.doesNotMatch(sim,/\borbs\s*:/);
 assert.match(server,/function grantSharedXp\(/);
 assert.match(server,/emit\('shared-xp-award'/);
 assert.doesNotMatch(server,/emit\('world-xp-orb/);
 assert.match(game,/function applySharedXp\(data\)/);
});

test('authoritative damage batches build one enemy lookup instead of scanning per hit',()=>{
 const server=read('server.js');
 assert.match(server,/enemyLookup=new Map\(room\.world\.enemies\.map/);
 assert.match(server,/if\(enemyLookup\)\{enemy=enemyLookup\.get\(normalizedId\)/);
 assert.match(server,/enemyLookup\.delete\(normalizedId\)/);
});

test('server health exposes real tick processing measurements',()=>{
 const server=read('server.js');
 assert.match(server,/tickProcessing:\{lastMs:/);
 assert.match(server,/process\.hrtime\.bigint\(\)/);
 assert.match(server,/worldTickAvgMs=worldTickAvgMs\?worldTickAvgMs\*\.92\+tickMs\*\.08/);
});

test('development diagnostics expose FPS frame INP RTT jitter and packet rates without production UI',()=>{
 const game=read('public/game.js');
 const online=read('public/online.js');
 assert.match(game,/abyssalDebug/);
 assert.match(game,/inpMs:Number\(gameInpMs\.toFixed\(1\)\)/);
 assert.match(online,/sentPerSec/);
 assert.match(online,/motionRttMs/);
 assert.match(online,/motionJitterMs/);
 assert.match(game,/if\(performanceDebugEnabled\)/);
});
