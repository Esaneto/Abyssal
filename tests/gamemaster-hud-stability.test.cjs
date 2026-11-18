'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const hud=require('../public/abyssal-hud-editor.js');
const read=name=>fs.readFileSync('public/'+name,'utf8');

test('the public GameMaster baseline uses native PC and distinct saved mobile orientations',()=>{
 const pc=hud.defaultLayout('solo','desktop');
 const portrait=hud.defaultLayout('solo','portrait');
 const landscape=hud.defaultLayout('solo','landscape');
 assert.deepEqual(pc,{},'GameMaster PC does not have any saved HUD override');
 assert.deepEqual(portrait.stats,{x:0.4987702469031016,y:0.06359508633613586,s:.9});
 assert.deepEqual(portrait.pause,{x:1,y:0.036030980256887585,s:1});
 assert.deepEqual(portrait.hide,{x:.078125,y:.06850961538461539,s:1});
 assert.equal(portrait.health.x,.24212964375813803);
 assert.equal(landscape.health.x,.25240384615384615);
 assert.equal(landscape.stats.x,.7807625348751361);
 assert.notDeepEqual(portrait,landscape);
 assert.deepEqual(hud.defaultLayout('online','desktop'),{comms:{x:.045,y:.505,s:1}});
 for(const p of hud.PROFILES){
  const solo=hud.defaultLayout('solo',p),online=hud.defaultLayout('online',p);
  assert.deepEqual(Object.fromEntries(Object.entries(online).filter(([id])=>id!=='comms')),solo);
 }
});

test('individual account and orientation customizations still override defaults',()=>{
 const saved=hud.normalize({portrait:{pulse:{x:.3,y:.8,s:.75}},desktop:{dash:{x:.4,y:.7,s:1.2}},online:{landscape:{power:{x:.6,y:.8,s:1}}}});
 assert.equal(hud.effectiveLayout(saved,'solo','portrait').pulse.x,.3);
 assert.equal(hud.effectiveLayout(saved,'solo','desktop').dash.x,.4);
 assert.equal(hud.effectiveLayout(saved,'online','landscape').power.x,.6);
 assert.equal(hud.effectiveLayout(saved,'solo','landscape').power.x,.05654380183953505);
 assert.deepEqual(hud.normalize(saved),saved);
});

test('HUD placements do not reset for ordinary gameplay mutations or temporary mobile viewport size changes',()=>{
 const js=read('abyssal-hud-editor.js');
 assert.match(js,/const replan=!layoutPlan\|\|layoutPlan\.key!==key\|\|geometryChanged/);
 assert.match(js,/if\(replan\)\{\s*clear\(\);/);
 assert.match(js,/if\(!replan&&!missing&&!sizeChanged\)\{entries\.push/);
 assert.match(js,/const pause=doc\.getElementById\('pauseScreen'\)/);
 assert.match(js,/root\.matchMedia\?\.\('\(pointer: coarse\)'\)/);
 assert.doesNotMatch(js,/root\.innerWidth<=700\?root\.innerWidth>root\.innerHeight/);
});

test('pause and modal layer wins over emoji wheel and all action controls',()=>{
 const css=read('abyssal-hud-editor.css');
 assert.match(css,/#quickComms:has\(#quickCommsWheel:not\(\[hidden\]\)\)\{z-index:40!important\}/);
 assert.match(css,/#pauseScreen,#controlsScreen,#gameOverScreen/);
 assert.match(css,/#pauseScreen:not\(\[hidden\]\)\) > :is\(#quickComms/);
 assert.match(css,/visibility:hidden!important;pointer-events:none!important/);
 assert.match(css,/#skillPulseBtn,#skillDashBtn,#skinActiveBtn/);
});

test('shop landscape grid and compact horizontal cards are scoped to handheld landscape only',()=>{
 const css=read('mobile-portrait.css');
 const mark=css.lastIndexOf('Mobile landscape only:');
 const scoped=css.slice(mark);
 assert.ok(mark>=0);
 assert.match(scoped,/@media \(orientation:landscape\)/);
 assert.match(scoped,/#shopScreen #skinGrid/);
 assert.match(scoped,/grid-template-columns:minmax\(85px,36%\) minmax\(0,1fr\)/);
 assert.match(scoped,/\.skin-card \.skin-preview\.specimen-vessel/);
 assert.match(scoped,/\.skin-card>button\{grid-column:1\/-1/);
 assert.ok(!scoped.includes('@media (orientation:portrait)'), 'new shop rules must not affect portrait');
 assert.ok(!fs.existsSync('scripts/probe-public-gamemaster-hud.cjs'),'temporary diagnostic must be removed');
});
