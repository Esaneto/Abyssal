'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');

test('server protection channel has no generic client-controlled invulnerability path',()=>{
 const start=server.indexOf("socket.on('player-protection'");
 const end=server.indexOf("socket.on('request-player-state'",start);
 assert.ok(start>=0&&end>start);
 const handler=server.slice(start,end);
 assert.match(handler,/reason = String\(payload\.reason \|\| ''\)/);
 assert.doesNotMatch(handler,/lastProtectionRequestAt/);
 assert.doesNotMatch(handler,/reason \|\| 'gameplay'/);
 assert.doesNotMatch(handler,/now \+ seconds \* 1000[\s\S]*?return;?[\s\S]*?\}\);$/);
});

test('upgrade protection consumes server-earned XP credit',()=>{
 const start=server.indexOf("socket.on('player-protection'");
 const end=server.indexOf("socket.on('request-player-state'",start);
 const handler=server.slice(start,end);
 assert.match(handler,/ensureRunProgression\(p\.runStats\)/);
 assert.match(handler,/run\.pendingUpgradeCredits<=0/);
 assert.match(handler,/run\.pendingUpgradeCredits--/);
 assert.match(server,/creditRunXp\(player\.runStats,orb\.value\)/);
 assert.match(server,/creditRunXp\(collector\.runStats,pickup\.value\)/);
});

test('dash protection requires the owned meta upgrade and exact legitimate duration',()=>{
 const start=server.indexOf("socket.on('player-protection'");
 const end=server.indexOf("socket.on('request-player-state'",start);
 const handler=server.slice(start,end);
 assert.match(handler,/reason === 'dash'/);
 assert.match(handler,/seconds !== 1\.5/);
 assert.match(handler,/u\?\.metaUpgrades\?\.dash/);
 assert.match(handler,/now \+ 1500/);
});

test('room join relies on server-created protection and sends no redundant protection packet',()=>{
 const start=game.indexOf('function enterOnlineGameplay(data)');
 const end=game.indexOf('function activateOnlineEntry',start);
 assert.ok(start>=0&&end>start);
 const entry=game.slice(start,end);
 assert.match(entry,/player\.invuln=Math\.max\(player\.invuln,5\)/);
 assert.doesNotMatch(entry,/sendProtection/);
 assert.match(server,/invulnerableUntil:now\+5000/);
});
