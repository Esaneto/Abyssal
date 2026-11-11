'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const geo=require('../public/abyssal-ocean-geography.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Seven passable rock arches are shared by physics and Open Sea rendering',()=>{
 assert.equal(geo.PASSAGE_ARCHES.length,7);
 const xs=geo.PASSAGE_ARCHES.map(p=>p.x);
 assert.ok(xs.every((x,i)=>i===0||x>xs[i-1]));
 for(const p of geo.PASSAGE_ARCHES){
  const arch=geo.ROCKS.find(r=>r.type==='arch'&&r.x===p.x&&r.y===p.y);
  assert.ok(arch,'missing real collision geometry at '+p.x);
  assert.equal(geo.isSolid(p.x,p.y,18),false,'arch tunnel must be water '+p.x);
  assert.equal(geo.isSolid(p.x,p.y-p.ry*.75,12),true,'arch roof must be solid '+p.x);
  assert.equal(geo.segmentClear(p.x-p.rx-70,p.y,p.x+p.rx+70,p.y,18),true,'swim corridor blocked '+p.x);
 }
});
test('Sonar uses actual isSolid collision geometry, not a decorative image',()=>{
 const source=read('public/abyssal-sonar-minimap.js');
 assert.match(source,/geo\.isSolid\(/);
 assert.match(source,/geo\.WIDTH/);
 assert.match(source,/geo\.HEIGHT/);
 assert.match(source,/spanX=2600,spanY=1700/);
 assert.match(source,/setInterval\(/);
 assert.match(source,/aria-expanded/);
 const html=read('public/index.html');
 assert.match(html,/abyssal-sonar-minimap\.js/);
 assert.match(html,/abyssal-cinematic-refresh\.css/);
});
test('Full HUD can fold without hiding the game canvas or losing the toggle',()=>{
 const css=read('public/abyssal-cinematic-refresh.css');
 assert.match(css,/#gameShell > :not\(#game\):not\(#abyssalSonarShell\)/);
 assert.match(css,/body\.abyss-hud-folded/);
 assert.match(css,/#abyssalHudToggle/);
});
test('Redundant extraction window remains hidden while keyboard extraction survives',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js');
 const ui=read('public/abyssal-extraction-ui.js');
 assert.match(runtime,/hud\.querySelector\('\.exploration-collect'\)\.hidden=true;/);
 assert.doesNotMatch(runtime,/hud\.querySelector\('\.exploration-collect'\)\.hidden=!active/);
 assert.match(ui,/e\.key==='g'/);
 assert.match(ui,/canvas\.addEventListener\('pointerdown'/);
});
test('Command bridge removes the separate cartoon pilot and preserves real marine anatomy',()=>{
 const cabin=read('public/abyssal-submarine-cockpit.js');
 const fauna=read('public/abyssal-fauna-anatomy.js');
 assert.match(cabin,/function chair\(/);
 assert.match(cabin,/function fish\(/);
 assert.match(cabin,/function manta\(/);
 assert.doesNotMatch(cabin,/function diver\(/);
 assert.match(fauna,/recognizable fish anatomy/);
 assert.match(fauna,/internal radial chambers/);
});
