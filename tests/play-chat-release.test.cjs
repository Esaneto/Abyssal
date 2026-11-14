'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {registerChatModerationRoutes,ensureModerationSchema}=require('../chat-moderation');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('moderation retention preserves open and follow-up reports',async()=>{
 const queries=[];await ensureModerationSchema({query:async sql=>queries.push(sql)});
 assert.match(queries[1],/status IN \('dismissed','actioned'\)/);
 assert.doesNotMatch(queries[1],/status <> 'open'/);
});
test('resolve follow-up keeps report pending and releases db connection before message removal',async()=>{
 const token='a'.repeat(64),users={gm:{sessionTokens:[{hash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt:Date.now()+60000}],admin:true},target:{}};
 const routes={},order=[],client={query:async(sql,args)=>{order.push(sql);if(sql.includes('FOR UPDATE'))return {rowCount:1,rows:[{report_id:'report',reported_key:'target',message_id:'message'}]};return {rowCount:1,rows:[]};},release(){order.push('release');}};
 const pool={query:async sql=>{order.push('pool:'+sql);return {rows:[]};},connect:async()=>{order.push('connect');return client;}};
 registerChatModerationRoutes({app:{post:(p,...h)=>routes[p]=h.at(-1),get:(p,...h)=>routes[p]=h.at(-1)},getUsers:()=>users,saveUsers(){},getPool:()=>pool,getChatMessage:async()=>null,removeMessage:async()=>{order.push('remove');},isDeveloper:u=>u.admin});
 const req={headers:{authorization:'Bearer '+token},params:{id:'report'},body:{action:'needs_followup'}},res={status(){return this;},set(){return this;},json(r){this.result=r;return this;}};
 await routes['/api/moderation/chat/reports/:id/resolve'](req,res);
 assert.equal(res.result.status,'followup');assert.ok(order.find(s=>s.includes("CASE WHEN $2='followup' THEN NULL")));
 assert.ok(order.indexOf('connect')>order.findIndex(s=>s.startsWith('pool:')));
 order.length=0;req.body.action='warn';await routes['/api/moderation/chat/reports/:id/resolve'](req,res);
 assert.equal(res.result.ok,true);assert.ok(order.indexOf('release')<order.indexOf('remove'));assert.equal(users.target.chatWarnings,1);
});
test('chat UI, cache and final Play package include the moderated communication assets',()=>{
 const html=read('public/index.html'),js=read('public/online.js'),css=read('public/cardume-comms.css'),sw=read('public/offline-sw.js'),audit=read('scripts/audit-play-aab.cjs');
 for(const id of ['cardumeChatHistory','cardumeChatCount','cardumeChatSend','cardumeChatAccept','cardumeChatStatus'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/role="log"/);assert.match(html,/maxlength="180"/);
 assert.match(js,/chatHistoryPending/);assert.match(js,/syncChatComposer/);assert.match(js,/text\.textContent=m\.text/);
 assert.match(css,/min-height:44px/);assert.match(css,/\.cardume-message\.is-self/);
 assert.match(js,/document\.createElement\('details'\)/);assert.match(js,/chat-safety-toggle/);assert.match(js,/Ver perfil/);assert.match(js,/Curtir/);assert.match(js,/menu\.append\(profile,like,block,report\)/);assert.match(js,/openPublicProfile\(m\.nickname\)/);assert.match(js,/likeChatProfile\(m\.nickname,like\)/);assert.match(js,/Denunciar mensagem/);assert.match(js,/Bloquear jogador/);assert.match(css,/\.chat-message-actions:not\(\[open\]\) \.chat-safety-menu/);
 assert.match(sw,/'cardume-comms\.css'/);assert.match(audit,/'cardume-comms\.css'/);assert.match(audit,/Stale or missing Play asset/);
 assert.match(audit,/REQUEST_INSTALL_PACKAGES/);
});

test('chat profile likes are idempotent, acknowledged without navigation, and honor blocks',()=>{
 const vm=require('node:vm');
 const source=read('server.js').split('\n').find(line=>line.includes("socket.on('toggle-profile-like'"));
 assert.ok(source,'profile like handler must exist');
 let handler,saves=0;const events=[];
 const users={a:{nickname:'A',likedProfiles:[],likedBy:[],blockedUsers:[]},b:{nickname:'B',likedProfiles:[],likedBy:[],blockedUsers:[]}};
 const socket={data:{userKey:'a'},on:(name,fn)=>{assert.equal(name,'toggle-profile-like');handler=fn;},emit:(...args)=>events.push(args)};
 vm.runInNewContext(source,{socket,users,SOCIAL_FEATURES_ENABLED:true,saveUsers:()=>saves++,publicProfile:(target,viewer)=>({nickname:users[target].nickname,likedByMe:users[target].likedBy.includes(viewer)}),publicUser:u=>({nickname:u.nickname}),io:{sockets:{sockets:new Map()}}});
 let result;const ack=r=>result=r;
 handler({nickname:'B',liked:true},ack);
 assert.equal(result.ok,true);assert.equal(result.liked,true);assert.equal(users.b.likedBy.length,1);assert.equal(saves,1);assert.equal(events.length,0);
 handler({nickname:'B',liked:true},ack);
 assert.equal(result.liked,true);assert.equal(users.b.likedBy.length,1);assert.equal(saves,1);
 handler({nickname:'B'});
 assert.equal(events[0][0],'profile-like-result');assert.equal(events[0][1].liked,false);assert.equal(users.b.likedBy.length,0);
 users.b.blockedUsers.push('a');handler({nickname:'B',liked:true},ack);
 assert.equal(result.ok,false);assert.equal(users.b.likedBy.length,0);
 handler({nickname:'A',liked:true},ack);assert.equal(result.ok,false);
});
