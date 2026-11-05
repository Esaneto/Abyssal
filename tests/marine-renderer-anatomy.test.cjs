'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const renderer=fs.readFileSync(path.join(root,'public','marine-renderer.js'),'utf8');
const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');

test('marine renderer keeps shark anatomy species-specific',()=>{
 for(const marker of [
  'if(v===2){ // whale shark',
  'if(v===3){ // basking',
  'if(v===4){ // mako',
  'if(v===5){ // thresher',
  'if(v===6){ // goblin',
  'if(v===7){ // frilled',
  'if(v===8){ // lantern shark',
  'if(v===9){ // greenland'
 ]) assert.ok(renderer.includes(marker),marker);
 assert.doesNotMatch(renderer,/case 'shark':case 'fish'/);
});

test('canonical marine renderer encodes the current visual contract',()=>{
 assert.match(renderer,/CANONICAL MARINE SKIN RENDERER/);
 assert.match(renderer,/anatomy\/silhouette identifies the species/);
 assert.match(renderer,/dark organic\/mineral material identifies the Abyssal universe/);
 assert.match(renderer,/accent color is secondary bioluminescence/);
});

test('deep-sea fish variants keep distinct iconic body plans',()=>{
 for(const marker of [
  "if(v===0){ellipse(.05,0,.88,.38)",
  "if(v===1){ellipse(.02,0,.76,.74)",
  "if(v===4){fillPath([[-.85,0]",
  "if(v===5){bezier([.95,0]",
  "if(v===6||v===7){ellipse(.05,0,.92,.36)",
  "if(v===8){ellipse(.02,0,.9,.48",
  "stroke([[.15,.18],[-.1,1.35]]"
 ]) assert.ok(renderer.includes(marker),marker);
});

test('creature previews keep anatomy dominant and cache versions current',()=>{
 const start=game.indexOf('function renderCreaturePreview(');
 const end=game.indexOf('function drawWheel()',start);
 const preview=game.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(preview,/strokeStyle='rgba\(130,232,239,.16\)'/);
 assert.match(preview,/The anatomy must dominate the preview/);
 assert.match(html,/marine-species\.js\?v=5/);
 assert.match(html,/marine-renderer\.js\?v=7/);
 assert.match(html,/abyssal-boss-renderer\.js\?v=2/);
 assert.match(html,/skin-abilities\.js\?v=3\.7\.2/);
 assert.match(html,/game\.js\?v=4\.4\.14/);
});

test('squid and octopus variants use separate species-level anatomy',()=>{
 assert.match(renderer,/const drawSquid=\(\)=>/);
 assert.match(renderer,/const drawOctopus=\(\)=>/);
 for(const marker of [
  "if(v===0)fillPath([[1.18,0]",
  "else if(v===3){fillPath([[1.08,0]",
  "else if(v===7){fillPath([[.86,0]",
  "else if(v===8){fillPath([[1.42,0]",
  "else {fillPath([[1.25,0]"
 ]) assert.ok(renderer.includes(marker),marker);
 assert.ok(renderer.includes('for(let i=0;i<8;i++){const sy=(i-3.5)*.12,extra='));
});

test('marine skins use dark Abyssal material with luminous accents',()=>{
 assert.match(renderer,/Deliberately monochromatic/);\n assert.match(renderer,/const bodyGrad=\(\)=>tone\(\.34\)/);\n assert.doesNotMatch(renderer,/createLinearGradient/);\n assert.doesNotMatch(renderer,/createRadialGradient/);
 assert.match(renderer,/materialPass/);
 assert.match(renderer,/globalCompositeOperation='lighter'/);
 assert.match(renderer,/scars/);
 assert.match(renderer,/pores/);
});

test('all marine families route through the canonical renderer',()=>{
 for(const marker of [
  "case 'shark':drawShark();break;",
  "case 'ray':drawRay();break;",
  "case 'eel':drawEel();break;",
  "case 'squid':drawSquid();break;",
  "case 'octopus':drawOctopus();break;",
  "case 'jelly':drawJelly();break;",
  "case 'crustacean':drawCrustacean();break;",
  "case 'fish':drawFish();break;",
  "case 'benthic':drawBenthic();break;",
  "case 'mollusc':drawMollusc();break;"
 ]) assert.ok(renderer.includes(marker),marker);
});

test('eel family cannot regress to a bare colored spline',()=>{
 assert.match(renderer,/Species-specific eel heads are mandatory/);
 assert.match(renderer,/if\(v===6\)\{ \/\/ pelican/);
 assert.match(renderer,/if\(v===3\)\{ \/\/ dragon moray/);
 assert.match(renderer,/if\(v===7\)\{ \/\/ saw eel/);
 assert.match(renderer,/ellipse\(.72,0,v===5\?\.5:\.44/);
});


test('marine preview scale matches signature Abyssal visual weight',()=>{
 const start=game.indexOf(" if(skin?.family){",game.indexOf('function renderCreaturePreview('));
 const end=game.indexOf(" if(kind==='leviathan')",start);
 const block=game.slice(start,end);
 assert.match(block,/family==='eel'\)scale=\.86/);
 assert.match(block,/family==='octopus'\|\|family==='squid'\)scale=\.8/);
 assert.match(block,/family==='fish'\)scale=variant===9\?\.74:\.88/);
 assert.match(block,/\(variant===5\|\|variant===7\)\?\.76:\.9/);
});


test('every marine species receives a named signature-art key',()=>{
 const species=require('../public/marine-species').species;
 assert.equal(new Set(species.map(s=>s.art?.key)).size,100);
 assert.equal(new Set(species.map(s=>s.art?.tone)).size>=40,true);
 for(const s of species){assert.ok(s.art?.key,s.id);assert.ok(/^#[0-9a-f]{6}$/i.test(s.art?.tone||''),s.id);}
});

test('renderer includes explicit signature art for all 100 profiles',()=>{
 const species=require('../public/marine-species').species;
 for(const s of species)assert.ok(renderer.includes("case '"+s.art.key+"'"),s.art.key);
});
