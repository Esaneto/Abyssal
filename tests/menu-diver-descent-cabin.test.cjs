'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('menu starts outside the hull; explicit cabin exits retain the hatch animation',()=>{
 const menu=read('public/abyssal-menu-ocean.js');
 assert.match(menu,/emergence<1/);
 assert.match(menu,/dt\/\(mobileScene\?1\.55:1\.72\)/);
 assert.match(menu,/stage\.classList\.toggle\('abyss-menu-arrival',fromCabin\)/);
 assert.match(menu,/function resetToHatch\(fromCabin=false\)/);
 assert.match(menu,/py=fromCabin\?pos\.y:arrivalEnd\(\)/);
 assert.match(menu,/emergence=fromCabin\?0:1/);
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
 assert.match(sw,/sample-audio-v172/);
 assert.match(build,new RegExp("version:'"+require('../package.json').version.replace(/\./g,'\\.')+"'"));
});

test('menu exits through hatch but gameplay uses collision-checked external spawn',()=>{
 const menu=read('public/abyssal-menu-ocean.js'),game=read('public/game.js'),server=read('server.js');
 assert.match(menu,/const pos=hatch\(\)/);assert.match(menu,/const starting=hatch\(\)/);
 assert.match(game,/SOLO_CAVERN\?\.submarineSpawn/);assert.match(server,/ClassicCavern\.submarineSpawn/);
 const cave=require('../public/abyssal-solo-cavern.js'),sub={x:2400,y:1170},rocks=[...cave.buildRocks(4800,3000),cave.submarineHull(sub.x,sub.y,1/.78)];
 const points=Array.from({length:6},(_,slot)=>cave.submarineSpawn(rocks,4800,3000,sub,.78,slot));
 assert.equal(new Set(points.map(p=>p.x+':'+p.y)).size,6);
 for(const p of points){assert.ok(p.y>sub.y+99/.78);assert.equal(cave.isBlocked(rocks,p.x,p.y,25/.78),false);}
});
