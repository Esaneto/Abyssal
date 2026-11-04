'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('notification system is bridged to online features',()=>{
 const game=read('public/game.js');
 assert.match(game,/window\.addNotification\s*=\s*addNotification/);
 assert.match(game,/window\.updateNotifBadge\s*=\s*updateNotifBadge/);
 assert.match(game,/notifUnreadDot/);
});




test('remaining UGC has in-app reporting wired to human moderation',()=>{
 const server=read('server.js'),online=read('public/online.js'),html=read('public/index.html');
 assert.match(server,/socket\.on\('report-ugc'/);
 assert.match(server,/abyssalelectrongames@gmail\.com/);
 assert.match(server,/CONTEÚDO CAPTURADO NO MOMENTO DA DENÚNCIA/);
 assert.match(online,/openUgcReport\('profile'/);
 assert.match(online,/openUgcReport\('cardume'/);
 assert.match(html,/id="ugcReportScreen"/);
 assert.match(html,/id="reportProfileBtn"/);
});

test('account deletion exists both in-app and as a public web request path',()=>{
 const server=read('server.js'),html=read('public/index.html'),support=read('support.js'),deletion=read('public/delete-account.html');
 assert.match(server,/socket\.on\('delete-account'/);
 assert.match(html,/id="deleteAccountBtn"/);
 assert.match(support,/\/api\/account-deletion-request/);
 assert.match(deletion,/Excluir conta do Abyssal/);
});


test('hidden modal screens cannot intercept login or menu controls',()=>{
 const css=read('public/style.css');
 assert.match(css,/\.screen\[hidden\],\.modal-screen\[hidden\]\{display:none!important;pointer-events:none!important\}/);
});

test('download and controls menu utilities remain compact instead of full width',()=>{
 const css=read('public/style.css');
 assert.match(css,/#menuScreen \.download-cta,#menuScreen \.controls-cta\{[\s\S]*?width:max-content!important/);
 assert.match(css,/#menuScreen \.download-cta\{right:10px!important;bottom:44px!important/);
 assert.match(css,/#menuScreen \.controls-cta\{right:10px!important;bottom:10px!important/);
});


test('moderation socket listener is bound only after the socket is created',()=>{
 const online=read('public/online.js');
 const created=online.indexOf("socket=window.io(SERVER_URL");
 const listener=online.indexOf("socket.on('ugc-report-result'");
 assert.ok(created>=0&&listener>created,'report listener must not dereference a null socket during startup');
});

test('mobile hides download controls and fullscreen utilities',()=>{
 const css=read('public/style.css');
 assert.match(css,/@media\(max-width:700px\),\(pointer:coarse\)[\s\S]*?#mobileDownloadTopBtn,#mobileControlsTopBtn,#fullscreenBtn/);
 assert.match(css,/#menuScreen #downloadBtn,#menuScreen #controlsBtn[\s\S]*?display:none!important/);
});
