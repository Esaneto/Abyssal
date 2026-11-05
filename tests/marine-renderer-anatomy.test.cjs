'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const renderer=fs.readFileSync(path.join(root,'public','marine-renderer.js'),'utf8');

test('marine renderer keeps species anatomy distinct inside the shark family',()=>{
  for(const marker of [
    'Whale shark: broad blunt head',
    'Basking shark: cavernous open mouth',
    'Shortfin mako: torpedo body',
    'Thresher: upper caudal lobe dominates total silhouette',
    'Goblin: flattened blade-like rostrum',
    'Frilled shark: eel-like body',
    'Lantern shark: compact deep-sea profile',
    'Greenland shark: very thick, slow, blunt body'
  ]) assert.ok(renderer.includes(marker),marker);
});

test('marine renderer no longer collapses shark and fish into one shared generic branch',()=>{
  assert.doesNotMatch(renderer,/case 'shark':case 'fish'/);
  assert.match(renderer,/case 'shark':drawShark\(\);break;/);
  assert.match(renderer,/case 'fish':drawFish\(\);break;/);
});

test('canonical marine renderer documents anatomy-first identity as an invariant',()=>{
  assert.match(renderer,/species identity must come from anatomy first, not color/);
  assert.match(renderer,/If silhouettes collapse into a shared family template, that is a regression/);
});

test('deep-sea fish variants preserve iconic silhouettes',()=>{
  assert.match(renderer,/hatchetfish/);
  assert.match(renderer,/black dragonfish/);
  assert.match(renderer,/viper\/fangfish/);
  assert.match(renderer,/hadal snailfish/);
  assert.match(renderer,/tripod fish/);
});

test('creature previews do not reintroduce the shared orbit frame and cache versions are current',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
  const start=game.indexOf('function renderCreaturePreview(');
  const end=game.indexOf('function drawWheel()',start);
  const preview=game.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(preview,/strokeStyle='rgba\(130,232,239,.16\)'/);
  assert.match(preview,/The anatomy must dominate the preview/);
  assert.match(html,/marine-species\.js\?v=4/);
  assert.match(html,/marine-renderer\.js\?v=6/);
  assert.match(html,/skin-abilities\.js\?v=3\.7\.2/);
  assert.match(html,/game\.js\?v=4\.4\.13/);
});


test('squid and octopus variants use species-level body plans rather than one recolored template',()=>{
  for(const marker of [
    'Every squid variant has a different mantle/fin/arm silhouette',
    "if(v===0){polygon([[1.18,0]",
    "else if(v===3){polygon([[1.08,0]",
    "else if(v===7){polygon([[.86,0]",
    "else if(v===8){polygon([[1.42,0]",
    "else {polygon([[1.25,0]"
  ]) assert.ok(renderer.includes(marker),marker);
  assert.match(renderer,/Abyssal material pass: mineral seams, photophores and scar-like asymmetry/);
});

test('marine skins use dark abyssal body materials with color as an accent',()=>{
 assert.match(renderer,/const bodyPaint=c\.createLinearGradient/);
 assert.match(renderer,/bodyPaint\.addColorStop\(0,'#02080e'\)/);
 assert.match(renderer,/bodyPaint\.addColorStop\(\.55,s\.color\)/);
 assert.match(renderer,/resolveFill=fill=>!fill\|\|fill===s\.color\?bodyPaint:fill/);
});


test('all marine families use the canonical Abyssal signature renderer',()=>{
 for(const marker of [
  'CANONICAL MARINE SKIN RENDERER',
  'Species-specific eel heads are mandatory',
  'drawSquid',
  'drawOctopus',
  'drawJelly',
  'drawCrustacean',
  'drawFish',
  'drawBenthic',
  'drawMollusc'
 ]) assert.ok(renderer.includes(marker),marker);
 assert.match(renderer,/accent color is secondary bioluminescence/);
 assert.match(renderer,/materialPass/);
});
