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
