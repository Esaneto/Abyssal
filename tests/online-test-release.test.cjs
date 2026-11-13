'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Online is unlocked in both routing and presentation',()=>{
 const gates=read('public/abyssal-feature-gates.js'),css=read('public/abyssal-solo-focus.css');
 assert.match(gates,/const LOCKED=new Set\(\['sea','rift'\]\)/);
 assert.match(css,/#abyssDiveOnlineChoice::after\{content:none\}/);
 assert.doesNotMatch(css,/#abyssDiveOnlineChoice::after\{[^}]*EM DESENVOLVIMENTO/);
});
test('Online choice preserves target through login',()=>{
 const menu=read('public/abyssal-menu-ocean.js'),online=read('public/online.js');
 assert.match(menu,/connectAndJoin[^\n]*MERGULHO-ONLINE/);
 assert.match(online,/function connectAndJoin\(targetRoom='MERGULHO-ONLINE'\)/);
 assert.match(online,/if\(authenticated\)\{[^\n]*showRooms\(\);return;/);
 assert.doesNotMatch(online,/joinRoom\('MERGULHO-ONLINE'\)/);
});
test('release client version matches package',()=>assert.ok(read('public/client-build.js').includes("version:'"+JSON.parse(read('package.json')).version+"'")));

test('online menu requires explicit room selection after login and age acceptance',()=>{
 const online=read('public/online.js'),game=read('public/game.js');
 const start=online.slice(online.indexOf('function connectAndJoin('),online.indexOf('function joinWorld('));
 assert.doesNotMatch(start,/\bjoinRoom\(/);
 assert.match(start,/showRooms\(\)/);
 const auth=game.split('\n').find(l=>l.includes("window.addEventListener('abyssal-authenticated'"));
 assert.match(auth,/showRooms\(\)/);assert.doesNotMatch(auth,/joinRoom\(/);
 assert.match(game,/list=list\.filter\(r=>r\.mode==='coop'\)/);
 assert.match(game,/window\.AbyssalOnline\?\.joinRoom\(id,''\)/);
});
