'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8');
const oauth=require('../public/google-oauth-config.js');
test('Google OAuth uses registered Web client, never Android client or previous typo',()=>{
 const server=read('server.js');
 const WEB='356475666791-t5tfa24kg3lqad3r1b5h4ecusvachjv6.apps.googleusercontent.com';
 const ANDROID='356475666791-b0m2248cgt80et9126c41br3mnk868v3.apps.googleusercontent.com';
 assert.equal(oauth.WEB_CLIENT_ID,WEB);
 assert.equal(oauth.ANDROID_PLAY_CLIENT_ID,ANDROID);
 assert.equal(oauth.normalizeWebClientId(WEB),WEB);
 assert.equal(oauth.normalizeWebClientId(ANDROID),'');
 assert.equal(oauth.normalizeWebClientId(oauth.PREVIOUS_MISTYPED_WEB_ID),'');
 assert.equal(oauth.normalizeWebClientId(''),'');
 assert.equal(oauth.isWebClientId('invalid-client'),false);
 assert.deepEqual(JSON.parse(JSON.stringify(oauth.resolveWebClientId(''))),{clientId:WEB,source:'project-web',corrected:false});
 assert.deepEqual(JSON.parse(JSON.stringify(oauth.resolveWebClientId(ANDROID))),{clientId:WEB,source:'recovered-project-web',corrected:true});
 assert.deepEqual(JSON.parse(JSON.stringify(oauth.resolveWebClientId(oauth.PREVIOUS_MISTYPED_WEB_ID))),{clientId:WEB,source:'recovered-project-web',corrected:true});
 assert.equal(oauth.resolveWebClientId(WEB).clientId,WEB);
 assert.match(server,/resolveWebClientId\(GOOGLE_OAUTH_CONFIGURED_ID\)/);
 assert.match(server,/clientId:GOOGLE_OAUTH_WEB_CLIENT_ID/);
 assert.match(server,/verifyGoogleIdToken\(payload\.idToken,clientId\)/);
 assert.doesNotMatch(server,/USER_PROVIDED_CLIENT_ID|GOOGLE_OAUTH_FALLBACK_USED/);
});

test('login animates real diver outfits/accessories without changing owned profile',()=>{
 const html=read('public/index.html'),css=read('public/abyssal-login-v2.css');
 const js=read('public/login-wardrobe-preview.js'),sw=read('public/offline-sw.js');
 assert.match(html,/id="abyssLoginWardrobeCanvas"/);
 assert.match(html,/google-oauth-config\.js\?v=/);
 assert.match(html,/login-wardrobe-preview\.js\?v=/);
 assert.match(js,/AbyssalDiverArt/);
 assert.match(js,/painter\.draw\(/);
 assert.match(js,/base\.normalize/);
 assert.match(js,/prefers-reduced-motion/);
 assert.match(js,/setInterval\(swapAppearance,changeInterval\)/);
 assert.match(js,/if\(reducedMotion\?\.matches\)paint\(transitionAt\)/);
 assert.doesNotMatch(js,/if\(!reduced\?\.matches\)frame=requestAnimationFrame/);
 assert.match(js,/Math\.random/);
 for(const slot of ['outfit','mask','visor','fins','hair','hairColor','eyewear','headgear','back'])assert.ok(js.includes("'"+slot+"'"),'Missing cosmetic '+slot);
 assert.doesNotMatch(js,/base\.apply\(/);
 assert.match(js,/previewCycles/);
 assert.match(css,/abyss-entry-avatar-canvas/);
 assert.match(sw,/login-wardrobe-preview\.js/);
 assert.match(sw,/google-oauth-config\.js/);
});
test('Google web client initialization validates server config and Android reuses its Web audience',()=>{
 const online=read('public/online.js');
 assert.match(online,/fetch\(SERVER_URL\+'\/api\/auth\/google-config'/);
 assert.match(online,/AbyssalGoogleOauthConfig\?\.isWebClientId\(clientId\)/);
 assert.match(online,/client_id:clientId/);
 assert.match(online,/plugin\.signIn\(\{clientId:googleOAuthClientId\}\)/);
 assert.doesNotMatch(online,/!\s*\/\^\\\\w/);
});

test('OAuth warning is outside GIS iframe container and adapts to panel width',()=>{
 const html=read('public/index.html'),css=read('public/abyssal-login-v2.css');
 const online=read('public/online.js');
 assert.match(html,/<p id="loginGoogleStatus"/);
 assert.match(css,/#loginScreen #loginGoogleHost\{[\s\S]*?flex-direction:column/);
 assert.match(css,/#loginScreen #loginGoogleStatus\[hidden\]\{display:none!important\}/);
 assert.match(online,/const status=\$\('loginGoogleStatus'\)/);
 assert.doesNotMatch(online,/host\.appendChild\(note\)/);
 assert.doesNotMatch(online,/cfg\.source==='fallback'/);
});
