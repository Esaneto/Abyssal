'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=pathFromRoot=>fs.readFileSync(path.resolve(__dirname,'..',pathFromRoot),'utf8');
const currentId='356475666791-b0m2248cgt80et9126c41br3mnk868v3.apps.googleusercontent.com';
const oldId='356475666791-t6tfa24kg3iqad3r1b5h4ecusvachjv6.apps.googleusercontent.com';
test('Google OAuth selects the supplied Web client and rejects retired fallback',()=>{
 const server=read('server.js');
 assert.ok(server.includes("GOOGLE_OAUTH_DEFAULT_CLIENT_ID='"+currentId+"'"));
 assert.ok(server.includes("GOOGLE_OAUTH_RETIRED_CLIENT_ID='"+oldId+"'"));
 assert.match(server,/googleOAuthEnvClientId===GOOGLE_OAUTH_RETIRED_CLIENT_ID/);
 assert.match(server,/verifyGoogleIdToken\(payload\.idToken,clientId\)/);
});
test('login shows in-game diver wardrobe preview without external game image',()=>{
 const html=read('public/index.html'),css=read('public/abyssal-login-v2.css');
 const js=read('public/login-wardrobe-preview.js'),sw=read('public/offline-sw.js');
 assert.match(html,/id="abyssLoginWardrobeCanvas"/);
 assert.match(html,/login-wardrobe-preview\.js\?v=/);
 assert.match(js,/AbyssalDiverArt/);
 assert.match(js,/painter\.draw\(/);
 assert.match(js,/base\.normalize/);
 assert.match(js,/prefers-reduced-motion/);
 assert.match(css,/abyss-entry-avatar-canvas/);
 assert.doesNotMatch(css,/url\('abyssal-cabin-ocean\.webp'\)/);
 assert.match(sw,/login-wardrobe-preview\.js/);
});
test('Web and native Google sign in use server-provided OAuth client id',()=>{
 const online=read('public/online.js');
 assert.match(online,/fetch\(SERVER_URL\+'\/api\/auth\/google-config'/);
 assert.match(online,/client_id:googleOAuthClientId/);
 assert.match(online,/plugin\.signIn\(\{clientId:googleOAuthClientId\}\)/);
});
