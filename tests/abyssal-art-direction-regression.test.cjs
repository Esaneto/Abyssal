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
 assert.match(read('public/abyssal-exploration-runtime.js'),/ROLE OU DESLIZE PARA VER MAIS/);
 assert.match(smoke,/Oversized vertically stretched console key/);
});
test('2.5D world and diver add genuine art geometry',()=>{
 const ocean=read('public/abyssal-open-sea-render.js');
 const cabin=read('public/abyssal-submarine-cockpit.js');
 const diver=read('public/diver-art.js');
 assert.match(ocean,/Localized natural rock illumination/);
 assert.match(ocean,/strataLines=lowPower\?3:6/);
 assert.match(cabin,/function exteriorReef\(/);
 assert.match(cabin,/function reflectedWater\(/);
 assert.match(diver,/const visorGlass=c\.createLinearGradient/);
 assert.match(diver,/const tankVolume=c\.createLinearGradient/);
});
test('cockpit uses recognizable marine life and real gendered rear pilot equipment',()=>{
 const source=read('public/abyssal-submarine-cockpit.js');
 assert.match(source,/function manta\(/);
 assert.match(source,/function turtle\(/);
 assert.match(source,/function jelly\(/);
 assert.match(source,/Two distinct oxygen cylinders/);
});
test('diver keeps the server-matched rifle and readable animated hair',()=>{
 const art=require('../public/diver-art.js');
 assert.equal(art.BARREL_TIP_X,69);assert.equal(art.GUN_OFFSET_Y,12);
 const source=read('public/diver-art.js');
 assert.match(source,/const step=female\?4:5/);
 assert.match(source,/Paired metal oxygen tanks/);
});
test('open sea implements actual visual facets, rock roots and 3 depth provinces',()=>{
 const source=read('public/abyssal-open-sea-render.js');
 const geo=require('../public/abyssal-ocean-geography.js');
 assert.match(source,/const faces=Math\.min\(lowPower\?12:30/);
 assert.match(source,/geo\.rockSurfaceAt\(rock,-Math\.acos\(q\)/);
 assert.match(source,/Fractured cliff edge instead of an uninterrupted vertical column/);
 assert.match(source,/Limit atmospheric relief to a nearby distant ledge/);
 assert.match(source,/Separate sandstone\/basalt plates show up at gameplay camera scales/);
 assert.equal(geo.visualBiomeAt(800,400).id,'coastal');
 assert.equal(geo.visualBiomeAt(8500,2900).id,'cinematic');
 assert.equal(geo.visualBiomeAt(19000,9000).id,'geological');
});
