'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Mergulho Online is not development-locked',()=>{
 const gates=read('public/abyssal-feature-gates.js');
 assert.match(gates,/const LOCKED=new Set\(\['sea','rift'\]\)/);
 assert.doesNotMatch(gates,/LOCKED=.*online/);
 assert.match(gates,/Mergulho Online está LIBERADO PARA TESTE/);
});

test('Online choice joins permanent test room directly',()=>{
 const menu=read('public/abyssal-menu-ocean.js');
 const online=read('public/online.js');
 assert.match(menu,/DISPONÍVEL PARA TESTE/);
 assert.match(menu,/joinRoom\('MERGULHO-ONLINE'\)/);
 assert.match(online,/function connectAndJoin\(targetRoom='MERGULHO-ONLINE'\)/);
 assert.match(online,/joinRoom\('MERGULHO-ONLINE'\)/);
});

test('client cache and version are refreshed for Online release',()=>{
 const sw=read('public/offline-sw.js');
 const build=read('public/client-build.js');
 assert.match(sw,/online-test-release-v149/);
 assert.match(build,/version:'3\.6\.9'/);
});
