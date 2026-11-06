'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = path => fs.readFileSync(path, 'utf8');

test('principal actions keep unique IDs inside the radial navigation', () => {
  const html = read('public/index.html');
  const orbit = html.match(/<nav class="abyss-orbit-navigation"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(orbit, 'radial navigation element must exist');
  [
    'playBtn', 'resonanceBtn', 'wheelBtn', 'onlineBtn', 'shopBtn',
    'catalogBtn', 'rankingsBtn', 'cardumesBtn', 'profileBtn',
    'matchHistoryBtn', 'supportBtn'
  ].forEach(id => {
    const pattern = new RegExp('\\bid="' + id + '"', 'g');
    assert.equal((html.match(pattern) || []).length, 1, id + ' must stay unique');
    assert.match(orbit[1], pattern, id + ' must be in the orbit');
  });
});

test('the descent gate is inserted inside the orbit without changing its events', () => {
  const source = read('public/abyssal-rebuild.js');
  assert.match(source, /orbit\.appendChild\(gate\)/);
  assert.match(source, /buildVortexStreams\(\)/);
  assert.match(source, /id="abyssGateButton"/);
  assert.match(source, /abyssal-start-rift-solo/);
  assert.match(source, /connectAndJoin/);
});

test('menu motion has a reduced-motion option and mobile touch layout', () => {
  const css = read('public/abyssal-menu-orbit.css');
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media\(max-width:1000px\),\(pointer:coarse\)/);
  assert.match(css, /abyss-vortex-shaft/);
  assert.match(css, /pointer-events:auto!important/);
});


test('cinematic menu retains interactive actions with symmetric cards', () => {
  const html=read('public/index.html');
  const nav=html.match(/<nav class="abyss-orbit-navigation"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav);
  ['resonanceBtn','wheelBtn','profileBtn','controlsBtn'].forEach(id=>{
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' unique');
    assert.match(nav[1],new RegExp('id="'+id+'"'));
  });
  assert.doesNotMatch(html,/abyssal-menu-interactions\.js\?v=1/);
  assert.match(html,/abyssal-menu-orbit\.css\?v=7/);
  assert.match(nav[1],/class="abyss-orbit-extras"/);
});

test('purple tentacle cursor has become a centered aiming reticle', () => {
  const svg=read('public/abyssal-tentacle-cursor.svg');
  const css=read('public/abyssal-menu-orbit.css');
  assert.match(svg,/<svg[^>]*width="32" height="32"/);
  assert.match(svg,/rotate\(270 24 24\)/);
  assert.match(svg,/cx="24" cy="24" r="3\.5"/);
  assert.match(css,/cursor:url\('abyssal-tentacle-cursor\.svg\?v=3'\) 16 16,crosshair!important/);
});

test('reference-inspired interface centers vortex and keeps extra features reachable', () => {
  const css=read('public/abyssal-menu-orbit.css');
  assert.match(css,/url\('abyssal-ocean-cinema\.svg'\)/);
  assert.match(css,/#abyssGate\s*\{\s*left:50%!important;top:50%!important/);
  assert.match(css,/abyss-orbit-extras/);
  assert.match(css,/@media\(max-width:1000px\),\(pointer:coarse\)/);
  const game=read('public/game.js'),online=read('public/online.js');
  assert.match(game,/\$\('resonanceBtn'\)\?\.addEventListener\('click'/);
  assert.match(game,/\$\('wheelBtn'\)\?\.addEventListener\('click'/);
  assert.match(online,/\$\('profileBtn'\)\?\.addEventListener\('click'/);
});


test('orbital navigation is a direct fullscreen menu child, not a narrow legacy menu column', () => {
  const html=read('public/index.html');
  const css=read('public/abyssal-menu-orbit.css');
  const section=html.slice(html.indexOf('<section id="menuScreen"'),html.indexOf('<section id="hud"'));
  const columnClose=section.indexOf('      </div>');
  const navStart=section.indexOf('<nav class="abyss-orbit-navigation"');
  assert.ok(navStart>columnClose,'orbit must no longer be inside menu-content');
  assert.match(section,/<div class="menu-content">[\s\S]*?<\/h1>\s*<\/div>\s*<nav class="abyss-orbit-navigation"/);
  assert.match(css,/#menuScreen > \.abyss-orbit-navigation\s*\{[\s\S]*?width:100vw!important/);
  assert.match(css,/#menuScreen > \.abyss-orbit-navigation #abyssGate\s*\{[\s\S]*?left:50%!important;top:50%!important/);
});

test('cursor is an aiming crosshair centered on a purple dot, even when hovering over the gate',()=>{
  const cursor=read('public/abyssal-tentacle-cursor.svg');
  const css=read('public/abyssal-menu-orbit.css');
  assert.match(cursor,/width="32" height="32" viewBox="0 0 48 48"/);
  assert.match(cursor,/rotate\(270 24 24\)/);
  assert.match(cursor,/<circle cx="24" cy="24" r="3\.5"/);
  assert.match(css,/cursor:url\('abyssal-tentacle-cursor\.svg\?v=3'\) 16 16,crosshair!important/);
  assert.match(css,/#abyssGate \*/);
});

test('crocodile and caiman require real payment rather than coins',()=>{
  const game=read('public/game.js');
  const server=read('server.js');
  const payments=read('payments.js');
  for(const id of ['saltcroc','blackcaiman']){
    assert.match(game,new RegExp("id:'"+id+"'[^\\n]*price:999,paid:true"));
    assert.match(game,new RegExp("paidBrl=Object\\.freeze\\(\\{[^\\n]*"+id+":999"));
    assert.match(payments,new RegExp(id+":\\{[^\\n]*brl:999"));
    assert.match(server,new RegExp("stripeOnlySkins = new Set\\(\\[[^\\n]*'"+id+"'"));
    assert.doesNotMatch(server,new RegExp("const prices = \\{[^\\n]*\\b"+id+":"));
  }
});


test('six central choices are the existing game actions without duplicated extra buttons',()=>{
  const html=read('public/index.html');
  const nav=html.match(/<nav class="abyss-orbit-navigation"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const primary=nav.match(/<div class="menu-secondary-actions">([\s\S]*?)<\/div>/)[1];
  const extras=nav.match(/<div class="abyss-orbit-extras"[^>]*>([\s\S]*?)<\/div>/)[1];
  for(const id of ['onlineBtn','resonanceBtn','rankingsBtn','wheelBtn','shopBtn','profileBtn']){
    assert.match(primary,new RegExp('id="'+id+'"'),id+' is a main card');
    assert.doesNotMatch(extras,new RegExp('id="'+id+'"'),id+' is not duplicated below');
  }
  for(const id of ['abyssSettingsBtn','abyssExitBtn']){
    assert.doesNotMatch(html,new RegExp('id="'+id+'"'),id+' redundant entry removed');
  }
  assert.match(extras,/id="controlsBtn"[^>]*hidden/);
});

test('portal has deterministic uneven currents and the fenda button sits at its center',()=>{
  const js=read('public/abyssal-rebuild.js');
  const css=read('public/abyssal-menu-orbit.css');
  assert.match(js,/count=11,steps=84/);
  assert.match(js,/var outer=207\+noise/);
  assert.match(css,/#abyssGate \.abyss-gate-content\{\s*position:absolute!important;z-index:12!important;[\s\S]*?top:50%!important/);
  assert.match(css,/\.abyss-vortex-plane::before\{\s*opacity:0!important/);
});

test('cursor references use one asset and one hot spot to avoid hover jumps',()=>{
  const css=read('public/abyssal-menu-orbit.css');
  assert.doesNotMatch(css,/cursor:url\('abyssal-tentacle-cursor\.svg'\) 6 5/);
  const cursors=[...css.matchAll(/cursor:url\('abyssal-tentacle-cursor\.svg(?:\?v=3)?'\) ([0-9]+) ([0-9]+),\s*([a-z-]+)!important/g)];
  assert.ok(cursors.length>=3,'cursor should be applied across menu and UI');
  for(const [,x,y,fallback] of cursors){
    assert.equal(x,'16');assert.equal(y,'16');assert.equal(fallback,'crosshair');
  }
});


test('three promoted buttons inherit the exact old configuration, controls and exit slots',()=>{
  const html=read('public/index.html');
  const css=read('public/abyssal-menu-orbit.css');
  const orbit=html.match(/<nav class="abyss-orbit-navigation"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const choices=orbit.match(/<div class="menu-secondary-actions">([\s\S]*?)<\/div>/)[1];
  const slots={
    resonanceBtn:['71%','31%'],
    wheelBtn:['81%','48.5%'],
    profileBtn:['71%','68%']
  };
  for(const [id,[x,y]] of Object.entries(slots)){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
    assert.match(choices,new RegExp('id="'+id+'"'));
    const rule=new RegExp('#'+id+'\\s*\\{\\s*--orbit-x:'+x.replace('%','%')+';--orbit-y:'+y.replace('%','%')+';');
    assert.match(css,rule,id+' should use its retired card slot');
  }
  assert.doesNotMatch(choices,/id="(?:abyssSettingsBtn|abyssExitBtn|controlsBtn)"/);
  assert.doesNotMatch(css,/inset-inline:auto!important;bottom:auto!important;/);
});

test('ocean depth center fades without an opaque black disc overlay',()=>{
  const css=read('public/abyssal-menu-orbit.css');
  assert.match(css,/#abyssGate \.abyss-vortex-shaft\s*\{[\s\S]*?display:none!important/);
  assert.match(css,/-webkit-mask-image:radial-gradient\(ellipse at 50% 52%,/);
  assert.match(css,/rgba\(0,10,30,\.55\) 20%/);
  assert.match(css,/rgba\(0,13,37,\.22\) 32%/);
  assert.match(css,/transparent 58%\)!important/);
});

test('cursor hotspot is exactly its rendered center for all interactive elements',()=>{
  const css=read('public/abyssal-menu-orbit.css');
  const svg=read('public/abyssal-tentacle-cursor.svg');
  assert.match(svg,/width="32" height="32" viewBox="0 0 48 48"/);
  assert.match(svg,/<circle cx="24" cy="24" r="1\.4"/);
  const cursors=[...css.matchAll(/cursor:url\('abyssal-tentacle-cursor\.svg\?v=3'\) (\d+) (\d+),crosshair!important/g)];
  assert.ok(cursors.length>=3,'menu and game should share one cursor reference');
  for(const m of cursors){assert.equal(Number(m[1]),16);assert.equal(Number(m[2]),16)}
});


test('desktop vortex spins with a separate composited layer while reduced motion remains accessible',()=>{
  const js=read('public/abyssal-rebuild.js');
  const css=read('public/abyssal-menu-orbit.css');
  const html=read('public/index.html');
  assert.match(js,/class="abyss-vortex-flow-layer"/);
  assert.match(js,/class="abyss-vortex-flow-layer" aria-hidden="true"[^']*'\+buildVortexStreams/);
  assert.match(css,/@keyframes abyssCurrentCirculate/);
  assert.match(css,/@media\(prefers-reduced-motion:no-preference\)/);
  assert.match(css,/abyssCurrentCirculate 12s linear infinite!important/);
  assert.match(css,/abyssVortexRotate 18s linear infinite reverse!important/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html,/abyssal-rebuild\.js\?v=5/);
});

test('main menu play and abyss gate have their requested labels',()=>{
  const html=read('public/index.html');
  const rebuild=read('public/abyssal-rebuild.js');
  const i18n=read('public/i18n.js');
  assert.match(html,/id="playBtn"[^>]*>MERGULHAR <span>/);
  assert.match(rebuild,/id="abyssGateButton"[^>]*>FOSSAS ABISSAIS<\/button>/);
  assert.match(i18n,/'MERGULHAR':'DIVE'/);
  assert.match(i18n,/'MERGULHAR':'BUCEAR'/);
});


test('Fossas Abissais has fractured black styling and translations',()=>{
  const js=read('public/abyssal-rebuild.js');
  const css=read('public/abyssal-menu-orbit.css');
  const translations=read('public/i18n.js');
  assert.match(js,/>FOSSAS ABISSAIS<\/button>/);
  assert.match(css,/#abyssGate #abyssGateButton\{[\s\S]*?clip-path:polygon\(/);
  assert.match(css,/#07090e 0%,#010204 49%,#101117 100%/);
  assert.match(translations,/'FOSSAS ABISSAIS':'ABYSSAL TRENCHES'/);
  assert.match(translations,/'FOSSAS ABISSAIS':'FOSAS ABISALES'/);
});

test('Wheel is golden translucent and Resonance is violet translucent',()=>{
  const css=read('public/abyssal-menu-orbit.css');
  assert.match(css,/#wheelBtn\{\s*background:linear-gradient\(145deg,rgba\(255,218,76,\.19\)/);
  assert.match(css,/border:2px solid rgba\(255,215,65,\.96\)!important/);
  assert.match(css,/#resonanceBtn\{\s*background:linear-gradient\(150deg,rgba\(147,63,244,\.22\)/);
  assert.match(css,/border:2px solid rgba\(185,114,255,\.96\)!important/);
});

test('Specimen Catalog has a nautical anchor, keeping real shop click action',()=>{
  const html=read('public/index.html');
  const css=read('public/abyssal-menu-orbit.css');
  const js=read('public/abyssal-rebuild.js');
  assert.match(html,/id="shopBtn" class="secondary-btn menu-action nautical-anchor-btn"/);
  assert.match(html,/class="menu-nav-icon ui-icon anchor-icon"/);
  assert.match(css,/#shopBtn\.nautical-anchor-btn\{/);
  assert.match(js,/shopLabel\.textContent='CATÁLOGO DE ESPÉCIMES'/);
});

test('desktop current uses the browser frame clock even when SVG CSS animations freeze',()=>{
  const js=read('public/abyssal-rebuild.js');
  const css=read('public/abyssal-menu-orbit.css');
  const html=read('public/index.html');
  assert.match(js,/function runDesktopVortex\(\)/);
  assert.match(js,/window\.requestAnimationFrame\(tick\)/);
  assert.match(js,/flow\.style\.setProperty\('transform'/);
  assert.match(js,/water\.style\.setProperty\('transform'/);
  assert.match(js,/if\(document\.hidden\|\|menu\.hidden\|\|document\.body\.classList\.contains\('game-active'\)\)/);
  assert.match(css,/@media\(hover:hover\) and \(pointer:fine\)\{\s*body:not\(\.game-active\) #menuScreen #abyssGate \.abyss-vortex-flow-layer,[\s\S]*?animation:none!important/);
  assert.match(html,/abyssal-menu-orbit\.css\?v=8/);
  assert.match(html,/abyssal-rebuild\.js\?v=6/);
});
