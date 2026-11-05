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
 assert.match(html,/marine-species\.js\?v=10/);
 assert.match(html,/marine-renderer\.js\?v=10/);
 assert.match(html,/abyssal-boss-renderer\.js\?v=4/);
 assert.match(html,/skin-abilities\.js\?v=3\.7\.2/);
 assert.match(html,/game\.js\?v=4\.4\.18/);
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

test('marine skins use signature-style multi-color volume and luminous accents',()=>{
 assert.match(renderer,/Signature-skin color language/);
 assert.match(renderer,/const bodyGrad=/);
 assert.match(renderer,/createLinearGradient/);
 assert.match(renderer,/createRadialGradient/);
 assert.match(renderer,/palette\.shadow/);
 assert.match(renderer,/palette\.base/);
 assert.match(renderer,/palette\.accent/);
 assert.match(renderer,/palette\.rim/);
 assert.match(renderer,/palette\.glow/);
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
 assert.match(block,/family==='eel'\)scale=\.96/);
 assert.match(block,/family==='octopus'\|\|family==='squid'\)scale=\.94/);
 assert.match(block,/family==='fish'\)scale=variant===9\?\.8:\.98/);
 assert.match(block,/\(variant===5\|\|variant===7\)\?\.8:1\.0/);
});


test('every marine species receives a named signature-art key',()=>{
 const species=require('../public/marine-species').species;
 assert.equal(new Set(species.map(s=>s.art?.key)).size,100);
 assert.equal(new Set(species.map(s=>s.art?.tone)).size>=40,true);
 for(const s of species){
  assert.ok(s.art?.key,s.id);assert.ok(/^#[0-9a-f]{6}$/i.test(s.art?.tone||''),s.id);
  for(const key of ['base','shadow','rim','glow','accent','eye'])assert.match(String(s.art?.palette?.[key]||''),/^#[0-9a-f]{6}$/i,s.id+':'+key);
 }
});

test('renderer includes explicit signature art for all 100 profiles',()=>{
 const species=require('../public/marine-species').species;
 for(const s of species)assert.ok(renderer.includes("case '"+s.art.key+"'"),s.art.key);
});


test('every family receives signature mass and expression before decorative markings',()=>{
 assert.match(renderer,/const signatureMassPass=\(\)=>/);
 assert.match(renderer,/Signature Abyssal principle: expression and mass come before decorative markings/);
 assert.match(renderer,/signatureMassPass\(\);\n signatureArt\(\);/);
 for(const family of ['shark','ray','eel','squid','octopus','jelly','crustacean','fish','benthic','mollusc']){
  assert.ok(renderer.includes("if(family==='"+family+"'")||renderer.includes("else if(family==='"+family+"'"),family);
 }
});

test('signature mass pass gives expressive faces and exaggerated silhouettes',()=>{
 for(const marker of [
  'const face=(x0,y0,rx,ry',
  'const glowCore=(x0,y0,rx,ry',
  'const crown=(count,centerX,baseY,width,height)',
  "if(v===5){fillPath([[-.92,-.02],[-1.55,-.4],[-2.25,-1.5]",
  "if(v===6){fillPath([[.88,-.12],[1.95,-.04]",
  "if(v===6){glowCore(.88,.08,.34,.26",
  "if(v===7){for(const sy of [-1,1])stroke([[-.35,sy*.12],[-2.45,sy*.78]",
  "if(v===3)for(let i=0;i<8;i++){const a=i*Math.PI/4"
 ]) assert.ok(renderer.includes(marker),marker);
});


test('generic material pass cannot reintroduce arbitrary scars',()=>{
 const start=renderer.indexOf('const materialPass='),end=renderer.indexOf('shadow();',start);
 const block=renderer.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(block,/scars\(/);
 assert.match(block,/Generic scratches were visually incoherent/);
 assert.match(renderer,/const rarityPass=\(\)=>/);
 assert.match(renderer,/signatureArt\(\);\n rarityPass\(\);/);
});
