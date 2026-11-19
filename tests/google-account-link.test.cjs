'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {findByGoogleSub,googleLinkDecision}=require('../google-account-link');
const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');
test('linked Google sub identifies the original account, preserving nickname and other fields',()=>{
 const users={nekko:{nickname:'Nekko',email:'n@example.com',googleSub:'101',energy:1500,sessionTokens:[{hash:'hash'}]},newbie:{nickname:'Newbie',email:'x@example.com'}};
 assert.deepEqual(findByGoogleSub(users,'101'),['nekko',users.nekko]);
 assert.equal(findByGoogleSub(users,'other'),null);
 assert.deepEqual(googleLinkDecision(users,'nekko','101'),{ok:true,alreadyLinked:true});
 assert.equal(users.nekko.energy,1500);
});
test('explicit account link rejects duplicate and conflicting Google identity',()=>{
 const users={a:{googleSub:'101'},b:{},c:{googleSub:'303'}};
 assert.deepEqual(googleLinkDecision(users,'b','101'),{ok:false,reason:'google_already_linked'});
 assert.deepEqual(googleLinkDecision(users,'a','303'),{ok:false,reason:'google_already_linked'});
 assert.deepEqual(googleLinkDecision(users,'a','202'),{ok:false,reason:'account_already_linked'});
 assert.deepEqual(googleLinkDecision(users,'unknown','202'),{ok:false,reason:'account_not_found'});
 assert.deepEqual(googleLinkDecision(users,'b','202'),{ok:true,alreadyLinked:false});
});
test('server linking requires active owned session and verified Google token; never links by email',()=>{
 const server=read('server.js');
 assert.match(server,/socket\.on\('link-google-account'/);
 assert.match(server,/socket\.data\.userKey/);
 assert.match(server,/hashSessionToken\(session\)/);
 assert.match(server,/Number\(t\.expiresAt\)>now&&safeEqual\(t\.hash,digest\)/);
 assert.match(server,/verifyGoogleIdToken\(payload\.idToken,GOOGLE_OAUTH_WEB_CLIENT_ID\)/);
 assert.match(server,/googleLinkDecision\(users,key,google\.sub\)/);
 assert.match(server,/user\.googleSub=google\.sub/);
 assert.match(server,/await flushPersistence\(\)/);
 assert.match(server,/googleLinked:Boolean\(u\.googleSub\)/);
 assert.match(server,/code:'google_link_required'/);
 assert.match(server,/findByGoogleSub\(users,google\.sub\)/);
});
test('signup and profile-link flows are wired without linking based on email',()=>{
 const online=read('public/online.js'),html=read('public/index.html'),css=read('public/abyssal-login-v2.css');
 assert.match(online,/code==='google_signup_required'/);
 assert.match(online,/code==='google_link_required'/);
 assert.match(online,/s\.timeout\(15000\)\.emit\('link-google-account'/);
 assert.match(online,/idToken:token,sessionToken/);
 assert.match(online,/setEntryMode\('register'\)/);
 assert.match(online,/googlePendingToken/);
 assert.match(online,/googleLinkIntent/);
 assert.match(online,/use_fedcm_for_button:true/);
 assert.match(html,/id="googleAccountContext"/);
 assert.match(html,/id="abyssEntryTabs"/);
 assert.match(html,/id="profileGoogleLinkBtn"/);
 assert.match(css,/#loginScreen #abyssEntryTabs\[hidden\]/);
});
test('popup COOP permits Google callback but maintains strict API isolation',()=>{
 const server=read('server.js');
 assert.match(server,/same-origin-allow-popups/);
 assert.match(server,/req\.path==='\/'\|\|\/\\\.html\$\/i\.test\(req\.path\)/);
 assert.match(server,/:'same-origin'\)/);
});
