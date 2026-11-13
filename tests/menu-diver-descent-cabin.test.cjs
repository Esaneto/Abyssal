'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('main menu opens with diver descending from submarine before input',()=>{
 const menu=read('public/abyssal-menu-ocean.js');
 assert.match(menu,/emergence<1/);
 assert.match(menu,/dt/\(mobileScene\?1\.55:1\.72\)/);
 assert.match(menu,/stage\.classList\.add\('abyss-menu-arrival'\)/);
 assert.match(menu,/stage\.classList\.add\('abyss-cabin-ready'\)/);
 assert.match(menu,/\|\|emergence<1\)return false/);
});

test('cabin entry is explicit and visually emphasized',()=>{
 const html=read('public/index.html');
 const css=read('public/abyssal-menu-v2.css');
 assert.match(html,/abyss-hatch-kicker">SUBMARINO/);
 assert.match(html,/abyss-hatch-label">CABINE/);
 assert.match(html,/abyss-hatch-action">ENTRAR/);
 assert.match(css,/abyss-cabin-pulse/);
 assert.match(css,/submarineWorkshopBtn\.abyss-laboratory-hatch/);
 assert.match(css,/pointer-events:auto/);
});

test('menu release refreshes offline shell',()=>{
 const sw=read('public/offline-sw.js');
 const build=read('public/client-build.js');
 assert.match(sw,/menu-cabin-v148/);
 assert.match(build,/version:'3\.6\.8'/);
});
