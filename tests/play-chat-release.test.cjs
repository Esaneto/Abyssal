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
 assert.match(sw,/'cardume-comms\.css'/);assert.match(audit,/'cardume-comms\.css'/);assert.match(audit,/Stale or missing Play asset/);
 assert.match(audit,/REQUEST_INSTALL_PACKAGES/);
});
