'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('remote players use short interpolation plus bounded jitter extrapolation',()=>{
 const online=read('public/online.js');
 assert.match(online,/interpDuration:Math\.max\(16,Math\.min\(40,sampleMs\*\.8\)\)/);
 assert.match(online,/peerExtrapolationMs:isPvp\?70:95/);
 assert.match(online,/extraMs=Math\.min\(Number\(p\.peerExtrapolationMs\)\|\|90/);
});

test('common enemy motion packets omit boss-only fields and preserve keep-warm relevance',()=>{
 const server=read('server.js');
 assert.match(server,/const base=\[e\.id,Math\.round\(Number\(e\.x\)/);
 assert.match(server,/if\(e\.kind==='devourer'\)return \[\.\.\.base/);
 assert.match(server,/if\(e\.kind==='kraken'\)return \[\.\.\.base/);
 assert.match(server,/sendFar=!recipient\|\|motionNow-\(Number\(recipient\.lastFarMotionAt\)\|\|0\)>=500/);
 const game=read('public/game.js');
 assert.match(game,/row\.length<7/);
});

test('XP motion is authoritative at 4 Hz with bounded client extrapolation',()=>{
 const sim=read('world-simulation.js');
 const server=read('server.js');
 const game=read('public/game.js');
 assert.match(sim,/world\.orbSnapshotTimer = 0\.25/);
 assert.match(server,/orbIntervalMs:250/);
 assert.match(game,/function currentInterpolatedOrbPosition/);
 assert.match(game,/Math\.min\(140,Math\.max\(0,elapsed-duration\)\)/);
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
