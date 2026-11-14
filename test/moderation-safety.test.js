'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {recordReport,ACTIONS}=require('../chat-moderation');
const root=path.resolve(__dirname,'..'),source=p=>fs.readFileSync(path.join(root,p),'utf8');
function fakePool({duplicate=false,count=0,insertError=false}={}){
 const calls=[];let released=false;
 const client={query:async(sql,args)=>{calls.push({sql,args});
  if(sql.includes('SELECT report_id FROM'))return {rowCount:duplicate?1:0,rows:duplicate?[{report_id:'existing'}]:[]};
  if(sql.includes('SELECT COUNT'))return {rows:[{total:count}]};
  if(insertError&&sql.includes('INSERT INTO'))throw Error('write failed');
  return {rowCount:1,rows:[]};
 },release(){released=true;}};
 return {pool:{query:async()=>({}),connect:async()=>client},calls,released:()=>released};
}
const data={type:'profile',reporterKey:'reporter',reportedKey:'target',accountId:'account-id',targetId:'target',label:'Target',snapshot:'Original evidence',reason:'assedio',details:'Context',matchId:'m'};
test('profile and cardume reports commit to PostgreSQL before returning success',async()=>{
 for(const type of ['profile','cardume','chat']){
  const f=fakePool(),r=await recordReport(f.pool,{...data,type,messageId:type==='chat'?'message-id':undefined});
  assert.equal(r.ok,true);assert.match(r.reportId,/^[a-f0-9-]{36}$/);
  const insert=f.calls.find(c=>c.sql.includes('INSERT INTO'));
  assert.equal(insert.args[7],type);assert.equal(insert.args[8],'account-id');assert.equal(insert.args[5],'Original evidence');
  assert.ok(f.calls.some(c=>c.sql==='COMMIT'));assert.ok(f.released());
 }
});
test('duplicate reports and rate limits do not create new reports',async()=>{
 for(const [opts,status] of [[{duplicate:true},409],[{count:10},429]]){
  const f=fakePool(opts),r=await recordReport(f.pool,data);assert.equal(r.ok,false);assert.equal(r.status,status);
  assert.ok(!f.calls.some(c=>c.sql.includes('INSERT INTO')));assert.ok(f.calls.some(c=>c.sql==='ROLLBACK'));assert.ok(f.released());
 }
});
test('storage failure cannot produce a success receipt',async()=>{
 assert.equal((await recordReport(null,data)).ok,false);
 const f=fakePool({insertError:true});await assert.rejects(recordReport(f.pool,data),/write failed/);assert.ok(f.calls.some(c=>c.sql==='ROLLBACK'));assert.ok(f.released());
});
test('moderation action types are limited and never delete accounts',()=>{
 assert.ok(ACTIONS.chat.includes('remove_message'));assert.ok(ACTIONS.chat.includes('mute_7d'));
 assert.ok(ACTIONS.profile.includes('suspend_online_7d'));assert.deepEqual(ACTIONS.cardume,['dismiss','needs_followup','remove_cardume_content']);
 for(const actions of Object.values(ACTIONS))assert.ok(!actions.includes('delete_account'));
});
test('moderation preserves identity and gates active online restrictions',()=>{
 const mod=source('chat-moderation.js'),server=source('server.js'),chat=source('cardume-chat.js');
 assert.match(mod,/target\.accountId!==report\.target_account_id/);
 assert.match(chat,/sender_account_id/);assert.match(server,/onlineSuspendedUntil\)>Date\.now\(\)/);
 assert.match(server,/onOnlineSuspended:async key/);
 for(const file of ['chat-moderation.js','cardume-chat.js','server.js','public/online.js'])assert.doesNotThrow(()=>new vm.Script(source(file)));
});
test('chat interactions are outside message layout and receipts require server confirmation',()=>{
 const html=source('public/index.html'),client=source('public/online.js'),css=source('public/cardume-comms.css');
 assert.match(html,/id="cardumeChatContext"[^>]*hidden/);assert.match(css,/\.cardume-chat-context\{position:absolute/);
 assert.match(client,/function openChatMenu/);assert.match(client,/function finishUgcReport/);assert.match(client,/DENÚNCIA RECEBIDA/);
 assert.match(client,/if\(result\.ok\)window\.addNotification/);
});
