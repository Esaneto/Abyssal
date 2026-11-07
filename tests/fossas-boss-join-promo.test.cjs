'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Map=require('../public/abyssal-map.js');
const Sim=require('../world-simulation.js');
const AI=require('../public/enemy-ai.js');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Fossas party spawn remains away from cave walls through every depth',()=>{
 for(const seed of [1,32142,987654,4294967295]){
  for(let tier=0;tier<=7;tier++){
   const layout=Map.createLayout(seed,tier);
   const start=layout.rooms.find(r=>r.id==='start');
   for(let count=1;count<=6;count++){
    const points=Array.from({length:count},(_,i)=>Map.startSpawn(layout,i,count));
    for(const p of points){
     assert.ok(Map.isWalkable(layout,p.x,p.y,34),'unsafe spawn at tier '+tier);
     assert.ok(Math.hypot(p.x-start.x,p.y-start.y)<start.ry*.65,'spawn too close to chamber wall');
     const move=Map.resolveMove(layout,p.x,p.y,p.x+12,p.y+8,18);
     assert.equal(move.blocked,false,'newcomer must be able to leave the spawn');
    }
    for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)
     assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>20,'players must not share a spawn');
   }
  }
 }
});

test('Mar Aberto boss spawns after a legacy infinite-timer stall',()=>{
 const world=Sim.createWorldState(1000,'classic');
 Sim.initializeWorld(world,1000,()=>.3);
 const player={id:'p1',x:AI.WORLD_WIDTH/2,y:AI.WORLD_HEIGHT/2,alive:true,hp:100,maxHp:100};
 world.elapsed=200;world.nextBossAt=Infinity;
 Sim.tickWorld(world,[player],1050,()=>.3);
 assert.ok(Number.isFinite(world.nextBossAt)&&world.nextBossAt>world.elapsed);
 world.elapsed=world.nextBossAt-.001;world.lastTick=1050;
 const result=Sim.tickWorld(world,[player],1100,()=>.3);
 assert.equal(result.spawnedBosses.length,1,'boss should appear at next 26 second interval');
 assert.equal(Sim.countBosses(world).length,1);
 assert.equal(world.nextBossAt,Infinity,'do not spawn multiple bosses simultaneously');
});

test('server schedules next sea boss when defeated, without advancing Fossas boss timer',()=>{
 const server=read('server.js');
 assert.match(server,/w\.nextBossAt=room\.mode==='rift'\?Infinity:\(Number\(w\.elapsed\)\|\|0\)\+100\/3\.8/);
 const game=read('public/game.js');
 assert.match(game,/tierDescentPending = isRiftRun\(\);/);
 assert.match(game,/const spawned = spawnEnemy\(false, targetKind\)/);
});

test('next-tier Fossas transition moves living players and ignores stale old floor packets',()=>{
 const server=read('server.js');
 assert.match(server,/const party=livingPlayers\(room\);/);
 assert.match(server,/party\.forEach\(\(peer,index\)=>\{/);
 assert.match(server,/AbyssalMap\.startSpawn\(nextLayout,index,party\.length\)/);
 assert.match(server,/if\(room\.mode==='rift'&&receivedAt<\(Number\(p\.positionResumeGraceUntil\)\|\|0\)&&displacement>320\)/);
 assert.doesNotMatch(server,/if\(!allReady\)return reply\(\{ok:false,reason:'group-not-ready'\}\)/);
 assert.match(server,/AbyssalMap\.isWalkable\(layout,p\.x,p\.y,padding\+6\)/);
});

test('new joins send a single authoritative snapshot and do not force teammate resync',()=>{
 const server=read('server.js'),client=read('public/online.js');
 assert.match(server,/socket\.emit\('room-joined',joined\);ack\(\{ok:true,deliveredBy:'room-joined'\}\)/);
 assert.doesNotMatch(server,/ack\(joined\)/);
 assert.doesNotMatch(server,/setTimeout\(\(\)=>\{if\(room\.players\.has\(socket\.id\)\)\{socket\.emit\('game-snapshot'/);
 assert.match(client,/result=>\{if\(result\?\.ok&&result\.room&&result\.snapshot\)handleRoomJoined\(result\);\}/);
 assert.doesNotMatch(client,/requestWorldSnapshot\(wasReconnect\?'deploy-reconnect':'room-join'\)/);
 assert.match(client,/\},1000\/20\);\s*\}\s*function getPositionDiagnostics\(/);
});

test('exclusiveabyssal unlock requires a one-time server-validated chosen store skin',()=>{
 const server=read('server.js'),client=read('public/game.js'),html=read('public/index.html');
 assert.match(server,/if\(code==='exclusivoabyssal'\)/);
 assert.match(server,/const promoId='exclusive-abyssal-skin-choice-v1'/);
 assert.match(server,/u\.redeemedPromoIds\.includes\(promoId\)/);
 assert.match(server,/if\(!choices\.includes\(selected\)\)/);
 assert.match(server,/if\(u\.ownedSkins\.includes\(selected\)\)/);
 assert.match(server,/u\.ownedSkins\.push\(selected\)/);
 assert.match(server,/u\.redeemedPromoIds\.push\(promoId\)/);
 assert.match(server,/u\.equippedSkin=selected/);
 assert.match(html,/id="redeemSkinSelect"/);
 assert.match(client,/window\.AbyssalOnline\.redeemCode\(code,skinId\)/);
});

test('promo handler actually grants one premium skin once per account',()=>{
 const source=read('server.js');
 const start=source.indexOf("socket.on('redeem-code', payload => {");
 const end=source.indexOf("\n socket.on('purchase-meta'",start);
 assert.ok(start>=0&&end>start,'redeem handler must be registered');
 const script=source.slice(start,end);
 let handler=null,saveCount=0;
 const replies=[];
 const socket={
  data:{userKey:'user'},
  on:(name,callback)=>{if(name==='redeem-code')handler=callback;},
  emit:(name,data)=>{if(name==='code-redeem-result')replies.push(data);}
 };
 const users={user:{ownedSkins:['default'],redeemedPromoIds:[],equippedSkin:'default',coins:0}};
 const ids=new Set(['default','violet','reefshark','solar','greensnake','final-exclusive']);
 const run=new Function('socket','users','allowedSkinIds','RiftRewards','saveUsers','publicUser','process',script);
 run(socket,users,ids,{FINAL_SKIN:'final-exclusive'},()=>{saveCount++},u=>({...u}),{env:{}});
 assert.equal(typeof handler,'function');
 handler({code:' EXCLUSIVOABYSSAL '});
 assert.equal(replies.at(-1).choiceRequired,true);
 assert.ok(replies.at(-1).eligibleSkinIds.includes('violet'),'premium skins must be eligible');
 assert.ok(!replies.at(-1).eligibleSkinIds.includes('final-exclusive'),'achievement skins remain protected');
 handler({code:'exclusivoabyssal',skinId:'violet'});
 assert.equal(replies.at(-1).ok,true);
 assert.equal(replies.at(-1).skinId,'violet');
 assert.deepEqual(users.user.ownedSkins,['default','violet']);
 assert.equal(users.user.equippedSkin,'violet');
 assert.equal(users.user.coins,0);
 assert.equal(saveCount,1);
 handler({code:'exclusivoabyssal',skinId:'reefshark'});
 assert.equal(replies.at(-1).ok,false);
 assert.deepEqual(users.user.ownedSkins,['default','violet']);
 assert.equal(saveCount,1,'repeated redemption must never change persisted ownership');
 users.second={ownedSkins:['default'],redeemedPromoIds:[],equippedSkin:'default'};
 socket.data.userKey='second';
 handler({code:'exclusivoabyssal',skinId:'not-in-shop'});
 assert.equal(replies.at(-1).ok,false);
 assert.equal(users.second.ownedSkins.length,1);
});
