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

test('global chat exposes usable report and block controls',()=>{
 const online=read('public/online.js'),css=read('public/style.css');
 assert.match(online,/openChatReportDialog/);
 assert.match(online,/DENUNCIAR/);
 assert.match(online,/BLOQUEAR/);
 assert.match(online,/\/api\/chat\/reports/);
 assert.match(online,/socket\.emit\('global-chat-history'\)/);
 assert.match(css,/global-chat-message-actions/);
 assert.match(css,/chat-report-overlay/);
});

test('server returns explicit chat filter reasons to the client',()=>{
 const server=read('server.js');
 for(const reason of ['contact_or_link','profanity','threat','grooming_or_off_platform_contact','repeated_characters'])assert.match(server,new RegExp(reason));
 assert.match(server,/reason:screened\.reason/);
});
