'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {apply,blocked,createAdmin}=require('../gamemaster-admin');
const c={skins:new Set(['default','kraken']),cosmetics:['mask:one'],resources:['iron']};
test('economy and ownership validated',()=>{const u={energy:50};apply(u,{action:'grant-energy',amount:100,reason:'Reward'},c);assert.equal(u.energy,150);assert.throws(()=>apply(u,{action:'take-energy',amount:151,reason:'Correction'},c));assert.equal(u.energy,150);apply(u,{action:'grant-specimen',item:'kraken',reason:'Reward'},c);assert.ok(u.ownedSkins.includes('kraken'));assert.throws(()=>apply(u,{action:'grant-specimen',item:'fake',reason:'Reward'},c));assert.equal(u.adminNotices.length,2)});
test('suspension expires and ban can be reversed',()=>{const u={sessionTokens:[{}]},now=1000;apply(u,{action:'mute',hours:24,reason:'Abuse'},c,now);assert.equal(u.chatMutedUntil,now+86400000);apply(u,{action:'suspend',hours:2,reason:'Abuse'},c,now);assert.ok(blocked(u,now));assert.equal(blocked(u,now+7200000),false);assert.deepEqual(u.sessionTokens,[]);apply(u,{action:'ban',reason:'Abuse'},c,now);assert.ok(blocked(u,now+99999999));apply(u,{action:'restore',reason:'Appeal'},c,now);assert.equal(blocked(u,now),false)});
test('only GameMaster can mutate and repeated ID cannot grant twice',async()=>{const users={gamemaster:{role:'developer'},player:{nickname:'Player',energy:0},other:{role:'developer'}};let saved=0;const admin=createAdmin({getUsers:()=>users,isDeveloper:u=>u?.role==='developer',persist:async()=>{saved++},onlineKeys:()=>new Set(),catalog:()=>c,onAction:()=>{}});let handler;const socket={data:{userKey:'other'},on:(_,fn)=>handler=fn};admin.attach(socket);const send=p=>new Promise(resolve=>handler(p,resolve));assert.equal((await send({op:'list'})).ok,false);socket.data.userKey='gamemaster';const p={op:'action',target:'player',action:'grant-energy',amount:100,reason:'Reward',requestId:'12345678-1234-1234-1234-123456789abc'};assert.equal((await send(p)).ok,true);assert.equal((await send(p)).duplicate,true);assert.equal(users.player.energy,100);assert.equal(saved,2);assert.equal((await send({...p,target:'gamemaster',requestId:'22345678-1234-1234-1234-123456789abc'})).ok,false)});

test('notices can be targeted recruitment and do not require GameMaster title',()=>{const u={};require('../gamemaster-admin').notice(u,'Invite',Date.now(),'CONVITE DE CARDUME');assert.equal(u.adminNotices[0].title,'CONVITE DE CARDUME')});
test('source contracts protect invite consent, membership and mute',()=>{const fs=require('node:fs'),p=require('node:path'),s=fs.readFileSync(p.join(__dirname,'../server.js'),'utf8'),client=fs.readFileSync(p.join(__dirname,'../public/online.js'),'utf8');assert.match(s,/socket\.on\('invite-cardume'/);assert.match(s,/c\.leader!==u\.nickname/);assert.match(s,/target\.blockedUsers\?\.includes\(key\)/);assert.match(s,/Você não será inscrito automaticamente/);assert.match(client,/chat-safety-menu/);assert.match(client,/Convidar para Cardume|Enviar convite de Cardume/);});

test('rolling deploy cannot revive an administratively revoked session',()=>{
 const {syncSessionSnapshot}=require('../gamemaster-admin');
 const hasToken=u=>(u.sessionTokens||[]).some(x=>x.hash==='valid');
 const users={player:{energy:50,adminUpdatedAt:10,sessionTokens:[{hash:'valid'}]}};
 syncSessionSnapshot(users,{player:{energy:50,adminUpdatedAt:20,adminBanned:true,sessionTokens:[]}},hasToken,100);
 assert.equal(hasToken(users.player),false);assert.ok(blocked(users.player,100));
 syncSessionSnapshot(users,{player:{adminUpdatedAt:10,sessionTokens:[{hash:'valid'}]}},hasToken,100);
 assert.equal(hasToken(users.player),false);assert.ok(blocked(users.player,100));
});
test('resume preserves newer local gameplay when administrative revisions match',()=>{
 const {syncSessionSnapshot}=require('../gamemaster-admin');
 const hasToken=u=>(u.sessionTokens||[]).some(x=>x.hash==='valid');
 const users={player:{energy:500,adminUpdatedAt:10,sessionTokens:[{hash:'valid'}]}};
 syncSessionSnapshot(users,{player:{energy:50,adminUpdatedAt:10,sessionTokens:[{hash:'valid'}]}},hasToken,100);
 assert.equal(users.player.energy,500);
 const replacement={};syncSessionSnapshot(replacement,users,hasToken,100);assert.equal(replacement.player.energy,500);
});
