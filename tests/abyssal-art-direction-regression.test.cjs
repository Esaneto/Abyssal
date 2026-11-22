'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('cockpit grid forces monitor over a compact accessible physical deck',()=>{
 const css=read('public/abyssal-submarine-laboratory.css');
 const smoke=read('scripts/browser-smoke.cjs');
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)!important/);
 assert.match(css,/grid-auto-flow:row!important/);
 assert.match(smoke,/Console deck overlaps monitor/);
 assert.match(read('public/abyssal-exploration-runtime.js'),/hint\.textContent='Deslize para ver mais';[\s\S]{0,350}body\.scrollHeight<=body\.clientHeight\+5/);
 assert.match(smoke,/Oversized vertically stretched console key/);
});
test('cockpit and diver retain genuine art geometry',()=>{
 const cabin=read('public/abyssal-submarine-cockpit.js');
 const diver=read('public/diver-art.js');
 assert.match(cabin,/function exteriorReef\(/);
 assert.match(cabin,/function reflectedWater\(/);
 assert.match(diver,/const visorGlass=c\.createLinearGradient/);
 const body=read('public/abyssal-realistic-body.js');
 assert.match(body,/function drawScubaBackpack\(\)/);
 assert.match(body,/const metal=grad\(/);
 assert.match(diver,/const metal=c\.createLinearGradient/);
});
test('cockpit integrates real marine silhouettes and partial physical seats without a competing pilot overlay',()=>{
 const source=read('public/abyssal-submarine-cockpit.js');
 assert.match(source,/function fish\(/);
 assert.match(source,/function manta\(/);
 assert.match(source,/function chair\(/);
 assert.match(source,/function deck\(/);
 assert.match(source,/function metal\(/);
 assert.match(source,/function hardware\(/);
 assert.match(source,/function windowFrame\(/);
 assert.doesNotMatch(source,/function diver\(/);
 assert.doesNotMatch(source,/new Image\(/);
});
test('diver keeps the server-matched rifle and readable animated hair',()=>{
 const art=require('../public/diver-art.js');
 assert.equal(art.BARREL_TIP_X,69);assert.equal(art.GUN_OFFSET_Y,12);
 const source=read('public/diver-art.js');
 assert.match(source,/const step=longHair\?4:5/);
 assert.match(read('public/abyssal-realistic-body.js'),/External breathing-gas backpack/);
 assert.match(source,/Legacy fallback: compressed-gas cylinders are external/);
});
test('shared geography retains its depth provinces',()=>{
 const geo=require('../public/abyssal-ocean-geography.js');
 assert.equal(geo.visualBiomeAt(800,400).id,'coastal');
 assert.equal(geo.visualBiomeAt(8500,2900).id,'cinematic');
 assert.equal(geo.visualBiomeAt(19000,9000).id,'geological');
});
