'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {registerAccountRecoveryRoutes}=require('../account-recovery');

function fixture(){
 const routes={},users={rhea:{nickname:'Rhea',email:'rhea@example.test',salt:'old',passwordHash:'old-hash',sessionTokens:[{hash:'session',expiresAt:Date.now()+60000}]}};
 let saves=0,disconnects=0;
 const app={post(path,_middleware,handler){routes[path]=handler}};
 const io={sockets:{sockets:new Map([['sock',{data:{userKey:'rhea'},emit(){},disconnect(){disconnects++}}]])}};
 registerAccountRecoveryRoutes({app,getUsers:()=>users,saveUsers(){saves++},io});
 function response(){return {statusCode:200,headers:{},status(n){this.statusCode=n;return this},set(k,v){this.headers[k]=v;return this},json(value){this.body=value;return this}}}
 return {routes,users,response,get saves(){return saves},get disconnects(){return disconnects}};
}

test('password recovery is generic, stores only an expiring token hash and invalidates sessions after one use',async t=>{
 const f=fixture(),oldFetch=global.fetch,oldKey=process.env.SENDGRID_API_KEY,oldFrom=process.env.RECOVERY_FROM_EMAIL,oldBase=process.env.PUBLIC_BASE_URL;let link='';
 global.fetch=async(_url,options)=>{const message=JSON.parse(options.body);link=message.content[0].value.match(/https:\/\/[^\s]+/)[0];return {ok:true,status:202}};
 process.env.SENDGRID_API_KEY='test-key';process.env.RECOVERY_FROM_EMAIL='verified@example.test';process.env.PUBLIC_BASE_URL='https://game.example.test';
 t.after(()=>{global.fetch=oldFetch;for(const [key,value] of Object.entries({SENDGRID_API_KEY:oldKey,RECOVERY_FROM_EMAIL:oldFrom,PUBLIC_BASE_URL:oldBase})){if(value===undefined)delete process.env[key];else process.env[key]=value}});
 const requested=f.response();await f.routes['/api/account/password-reset/request']({ip:'127.0.0.1',body:{email:'RHEA@example.test'}},requested);
 assert.equal(requested.statusCode,202);assert.match(requested.body.message,/Se a conta/);assert.ok(f.users.rhea.passwordReset.hash);assert.notEqual(f.users.rhea.passwordReset.hash,new URL(link).searchParams.get('passwordResetToken'));assert.ok(f.users.rhea.passwordReset.expiresAt>Date.now());
 const token=new URLSearchParams(new URL(link).hash.slice(1)).get('passwordResetToken'),completed=f.response();f.routes['/api/account/password-reset/complete']({body:{token,password:'new-password-123'}},completed);
 assert.equal(completed.body.ok,true);assert.equal(f.users.rhea.sessionTokens.length,0);assert.equal(f.disconnects,1);assert.equal(f.users.rhea.passwordReset,undefined);assert.notEqual(f.users.rhea.passwordHash,'old-hash');
 const replay=f.response();f.routes['/api/account/password-reset/complete']({body:{token,password:'another-password'}},replay);assert.equal(replay.statusCode,400);
 const unknown=f.response();await f.routes['/api/account/password-reset/request']({ip:'127.0.0.2',body:{email:'unknown@example.test'}},unknown);assert.deepEqual(unknown.body,requested.body);
 assert.ok(f.saves>=2);
});

test('reset request fails closed without configured email delivery and reset tokens must be strong',async t=>{
 const f=fixture(),oldKey=process.env.SENDGRID_API_KEY,oldFrom=process.env.RECOVERY_FROM_EMAIL,oldBase=process.env.PUBLIC_BASE_URL;
 delete process.env.SENDGRID_API_KEY;delete process.env.RECOVERY_FROM_EMAIL;delete process.env.PUBLIC_BASE_URL;
 t.after(()=>{for(const [key,value] of Object.entries({SENDGRID_API_KEY:oldKey,RECOVERY_FROM_EMAIL:oldFrom,PUBLIC_BASE_URL:oldBase})){if(value===undefined)delete process.env[key];else process.env[key]=value}});
 const requested=f.response();await f.routes['/api/account/password-reset/request']({ip:'127.0.0.3',body:{email:'rhea@example.test'}},requested);assert.equal(requested.statusCode,202);assert.equal(f.users.rhea.passwordReset,undefined);
 const invalid=f.response();f.routes['/api/account/password-reset/complete']({body:{token:'weak',password:'long-enough-password'}},invalid);assert.equal(invalid.statusCode,400);
});
