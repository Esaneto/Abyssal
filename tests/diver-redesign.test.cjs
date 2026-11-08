'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const art=require('../public/diver-art.js');

test('diver visual uses one shared anatomy with female hair only as variation',()=>{
 assert.equal(art.genderOf('male'),'male');
 assert.equal(art.genderOf('female'),'female');
 assert.equal(art.genderOf('invalid'),'male');
 const code=read('public/diver-art.js');
 assert.match(code,/if\(female\)/);
 assert.match(code,/Hair is BLACK in both versions/);
 assert.match(code,/Two HUMAN upper legs and calves/);
 assert.match(code,/c\.rotate\(\(Number\(aim\)\|\|0\)-\(Number\(heading\)\|\|0\)\)/);
});
test('weapon muzzle is directionally correct',()=>{
 const origin=art.muzzle(100,200,14,0);
 assert.equal(origin.x,127.6);assert.equal(origin.y,200);
 const up=art.muzzle(100,200,14,-Math.PI/2);
 assert.ok(Math.abs(up.x-100)<1e-9);assert.ok(Math.abs(up.y-172.4)<1e-9);
});
test('diver body faces motion, weapon faces aim and projectile originates at weapon',()=>{
 const game=read('public/game.js');
 assert.match(game,/player\.bodyAngle=/);
 assert.match(game,/player\.weaponAngle=/);
 assert.match(game,/drawDiver\(player\.x,player\.y,player\.r,player\.bodyAngle/);
 assert.doesNotMatch(game,/drawDiver\(player\.x,player\.y,player\.r,getLocalSkinCursorAngle/);
 assert.match(game,/DIVER_ART\?\.muzzle\?\.\(player\.x,player\.y,player\.r,shotAngle\)/);
 assert.match(game,/const gunOrigin=DIVER_ART\?\.muzzle/);
});
test('independent specimen follows normal upgraded swim speed and is ticked',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/updateSpecimenRuntime\(dt\);/);
 assert.match(game,/const normalSpeed=Math\.max\(0,player\.moveSpeed\*/);
 assert.match(game,/const step=Math\.min\(distance,normalSpeed\*Math\.max\(0,dt\)\)/);
 assert.match(server,/specimenX:restoredX,specimenY:restoredY-34\/WORLD_ZOOM/);
 assert.match(server,/const travel=Math\.min\(distance,normalSpeed\*dt\)/);
 assert.match(server,/p\.speedStrength=clamp\(Number\(payload\.speedStrength\)/);
 assert.match(server,/const authoritativeMuzzleX=sx\+Math\.cos\(shotHeading\)\*gunDistance/);
});
test('profile choice persists while new ocean menu does not create a second Fossas gate',()=>{
 const html=read('public/index.html'),server=read('server.js');
 const rebuild=read('public/abyssal-rebuild.js'),ocean=read('public/abyssal-menu-ocean.js'),css=read('public/abyssal-menu-v2.css');
 assert.match(html,/data-diver-gender="male"/);assert.match(html,/data-diver-gender="female"/);
 assert.match(html,/diver-art\.js\?v=/);
 assert.match(server,/u\.diverGender=payload\.diverGender/);
 assert.match(rebuild,/var legacyMenu=!menu\.classList\.contains\('ocean-menu-v2'\)/);
 assert.match(rebuild,/portalTrigger=legacyMenu\?\$\('abyssGateButton'\):\$\('riftPortalBtn'\)/);
 assert.doesNotMatch(ocean,/const rift=document\.getElementById/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)!important/);
});
