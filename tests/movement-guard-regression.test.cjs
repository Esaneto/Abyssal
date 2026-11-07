'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');

test('player positions pass terrain and movement envelope before authoritative assignment',()=>{
 const start=server.indexOf('const handlePlayerPosition=(payload');
 const end=server.indexOf("socket.on('player-position'",start);
 assert.ok(start>=0&&end>start);
 const handler=server.slice(start,end);
 const terrain=handler.indexOf("reason:'terrain'");
 const movement=handler.indexOf('consumeMovementBudget');
 const caveResolution=handler.indexOf('AbyssalMap.resolveMove');
 const assignment=handler.indexOf('p.x=clamp(acceptedX');
 assert.ok(terrain>=0&&movement>terrain&&caveResolution>movement&&assignment>caveResolution);
 assert.doesNotMatch(handler,/collectPvpOrbsNearPlayer/);
});

test('movement rejection reconciles compact clients to the authoritative position',()=>{
 const start=server.indexOf('const handlePlayerPosition=(payload');
 const end=server.indexOf("socket.on('player-position'",start);
 const handler=server.slice(start,end);
 assert.match(handler,/reason:'movement-envelope'/);
 assert.match(handler,/movementGuardRejects\+\+/);
 assert.match(handler,/if\(compact&&data\?\.blocked\)[\s\S]*player-reconcile/);
});

test('accepted velocity cap now covers legal dash movement while the budget controls sustained speed',()=>{
 const start=server.indexOf('const handlePlayerPosition=(payload');
 const end=server.indexOf("socket.on('player-position'",start);
 const handler=server.slice(start,end);
 assert.match(handler,/if\(speed>900\)/);
 assert.match(server,/movementGuardRejects/);
});
