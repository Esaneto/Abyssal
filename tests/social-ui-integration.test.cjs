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


