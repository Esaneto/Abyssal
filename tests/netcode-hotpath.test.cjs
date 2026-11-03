'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('hot player movement uses compact volatile tuples and slow metadata channel',()=>{
 const online=fs.readFileSync(path.join(__dirname,'..','public','online.js'),'utf8');
 assert.match(online,/volatile\.emit\('player-motion-input',\[seq,latestPositionPayload\.x,latestPositionPayload\.y,latestPositionPayload\.angle,Date\.now\(\)\]\)/);
 assert.match(online,/isPvp\?1000\/30:1000\/20/);
 assert.match(online,/now-lastNetMetaAt>=1000/);
 assert.match(online,/socket\.volatile\.emit\('player-net-meta',buildNetMeta\(\)\)/);
});

test('movement reconciliation is sequence based and preserves newer prediction',()=>{
 const online=fs.readFileSync(path.join(__dirname,'..','public','online.js'),'utf8');
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(online,/pendingMotion\.set\(seq/);
 assert.match(online,/authoritativeX-predicted\.x/);
 assert.match(server,/volatile\.emit\('player-reconcile',\[p\.lastPositionSeq,p\.x,p\.y,false\]\)/);
 assert.match(game,/player\.x=clamp\(player\.x\+dx\*weight/);
});

test('PvP blocked movement forces immediate authoritative reconciliation',()=>{
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(server,/compact&&data\?\.blocked/);
 assert.match(server,/volatile\.emit\('player-reconcile'.*true/);
});

test('distant common AI is tiered while bosses and nearby threats stay full-rate',()=>{
 const world=fs.readFileSync(path.join(__dirname,'..','world-simulation.js'),'utf8');
 assert.match(world,/const highPriority=BOSS_KINDS\.includes\(enemy\.kind\)\|\|nearestPlayerSq<1400\*1400/);
 assert.match(world,/enemy\.aiMoveDt=.*\+dt/);
 assert.match(world,/movementDt=Math\.min\(\.1,Math\.max\(dt,enemy\.aiMoveDt\)\)/);
});
