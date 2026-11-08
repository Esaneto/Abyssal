'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = path => fs.readFileSync(path, 'utf8');

test('principal actions keep unique IDs inside the radial navigation',()=>{

 const html=read('public/index.html');
 const ocean=html.slice(html.indexOf('<section id="menuScreen"'),html.indexOf('</section>',html.indexOf('<section id="menuScreen"')));
 assert.match(ocean,/class="screen ocean-menu-v2"/);
 assert.match(ocean,/id="menuOceanStage"/);
 for(const id of ['playBtn','onlineBtn','riftPortalBtn','resonanceBtn','wheelBtn','shopBtn','profileBtn','catalogBtn','rankingsBtn','cardumesBtn','matchHistoryBtn','supportBtn']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' must be unique');
  assert.match(ocean,new RegExp('id="'+id+'"'),id+' must be accessible from menu');
 }

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


test('cinematic menu retains interactive actions with symmetric cards',()=>{

 const html=read('public/index.html'),css=read('public/abyssal-menu-v2.css');
 const nav=html.match(/<nav class="abyss-ocean-utilities"[^>]*>([\s\S]*?)<\/nav>/);
 assert.ok(nav,'bottom utilities must be present');
 for(const id of ['resonanceBtn','wheelBtn','profileBtn'])assert.match(nav[1],new RegExp('id="'+id+'"'));
 assert.equal((html.match(/id="controlsBtn"/g)||[]).length,1);
 assert.match(css,/grid-template-columns:repeat\(9,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(html,/abyssal-menu-interactions\.js\?v=1/);

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


test('orbital navigation is a direct fullscreen menu child, not a narrow legacy menu column',()=>{

 const html=read('public/index.html'),css=read('public/abyssal-menu-v2.css');
 const section=html.slice(html.indexOf('<section id="menuScreen"'),html.indexOf('</section>',html.indexOf('<section id="menuScreen"')));
 assert.match(section,/id="menuOceanStage"/);
 assert.match(section,/class="abyss-ocean-utilities"/);
 assert.doesNotMatch(section,/class="menu-content"/);
 assert.match(css,/#menuScreen\.ocean-menu-v2\{[\s\S]*?grid-template-rows/);
 assert.match(css,/#menuScreen\.ocean-menu-v2\.submarine-menu #menuOceanStage/);

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
  const game=read('public/game.js'),server=read('server.js'),payments=read('payments.js');
  for(const id of ['saltcroc','blackcaiman']){
    assert.match(game,new RegExp("id:'"+id+"'[^\\n]*paid:true"));
    assert.match(game,new RegExp("paidBrl=Object\\.freeze\\(\\{[^\\n]*"+id+":499"));
    assert.match(payments,new RegExp(id+":\\{[^\\n]*brl:499"));
    assert.match(server,new RegExp("stripeOnlySkins = new Set\\(\\[[^\\n]*'"+id+"'"));
  }
});


test('six central choices are the existing game actions without duplicated extra buttons',()=>{

 const html=read('public/index.html'),menu=read('public/abyssal-menu-ocean.js');
 const stage=html.slice(html.indexOf('id="menuOceanPortalLayer"'),html.indexOf('id="menuOceanDiver"'));
 const nav=html.slice(html.indexOf('class="abyss-ocean-utilities"'),html.indexOf('class="abyss-ocean-account"'));
 for(const id of ['playBtn','onlineBtn','riftPortalBtn'])assert.match(stage,new RegExp('id="'+id+'"'));
 for(const id of ['resonanceBtn','rankingsBtn','wheelBtn','shopBtn','profileBtn'])assert.match(nav,new RegExp('id="'+id+'"'));
 assert.match(menu,/stations\.length!==3/);
 assert.doesNotMatch(html,/id="abyssSettingsBtn"|id="abyssExitBtn"/);

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

 const html=read('public/index.html'),css=read('public/abyssal-lab-menu.css');
 const nav=html.slice(html.indexOf('<nav class="abyss-ocean-utilities"'),html.indexOf('</nav>',html.indexOf('<nav class="abyss-ocean-utilities"')));
 for(const id of ['resonanceBtn','wheelBtn','profileBtn']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  assert.match(nav,new RegExp('id="'+id+'"'));
 }
 assert.match(css,/\.abyss-ocean-utilities>\.abyss-ocean-utility\{/);
 assert.match(css,/min-height:48px!important/);

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

 const menu=read('public/abyssal-menu-ocean.js'),css=read('public/abyssal-lab-menu.css'),html=read('public/index.html');
 assert.match(menu,/function renderCurrents\(now\)/);
 assert.match(menu,/currents\.bezierCurveTo/);
 assert.match(menu,/requestAnimationFrame\(animate\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/abyssal-menu-ocean\.js\?v=2026\.11\.8\.14/);

});

test('main menu play and abyss gate have their requested labels',()=>{

 const html=read('public/index.html'),rebuild=read('public/abyssal-rebuild.js'),i18n=read('public/i18n.js');
 assert.match(html,/id="playBtn"[^>]*>[\s\S]*?<strong>MERGULHO SOLO<\/strong>/);
 assert.match(html,/id="riftPortalBtn"[^>]*>[\s\S]*?<strong>FOSSAS<\/strong>/);
 assert.match(rebuild,/window\.AbyssalPreferredRoomMode='rift'/);
 assert.match(i18n,/'MERGULHAR':'DIVE'/);

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

 const html=read('public/index.html'),css=read('public/abyssal-lab-menu.css'),game=read('public/game.js');
 assert.match(html,/id="shopBtn" class="abyss-ocean-utility/);
 assert.match(css,/#menuScreen\.ocean-menu-v2\.submarine-menu #shopBtn/);
 assert.match(css,/#shopScreen #skinGrid \.skin-card \.skin-preview::before/);
 assert.match(game,/\$\('shopBtn'\)\.addEventListener\('click'/);

});

test('desktop current uses the browser frame clock even when SVG CSS animations freeze',()=>{

 const menu=read('public/abyssal-menu-ocean.js'),html=read('public/index.html');
 assert.match(menu,/function animate\(now\)/);
 assert.match(menu,/renderCurrents\(now\)/);
 assert.match(menu,/requestAnimationFrame\(animate\)/);
 assert.match(menu,/now\*\.00022/);
 assert.match(html,/abyssal-menu-ocean\.js\?v=2026\.11\.8\.14/);

});

test('Specimen Catalog decor is actual curled purple tentacles around a translucent brown card',()=>{

 const css=read('public/abyssal-lab-menu.css'),html=read('public/index.html');
 assert.match(html,/id="shopBtn"/);
 assert.match(css,/#shopScreen \.shop-modal/);
 assert.match(css,/#shopScreen #skinGrid \.skin-card \.skin-preview/);
 assert.match(css,/rgba\(232,253,255,\.92\)/);
 assert.match(css,/#shopScreen #skinGrid \.skin-card>p::before/);

});

test('Fossas Abissais has longer spikes, extra cracks and restrained blood red outline',()=>{
  const css=read('public/abyssal-menu-orbit.css');
  const js=read('public/abyssal-rebuild.js');
  assert.match(js,/>FOSSAS ABISSAIS<\/button>/);
  assert.match(css,/#abyssGate \.abyss-gate-content::before\{/);
  assert.match(css,/background:rgba\(131,31,37,\.83\)!important/);
  assert.match(css,/5% 0%,22% 9%,34% 0%/);
  assert.match(css,/border:2px solid rgba\(140,37,42,\.92\)!important/);
  assert.match(css,/linear-gradient\(117deg,transparent 0 19%,rgba\(185,190,204,\.54\)/);
});


test('Fossas Abissais retains fractured basalt and gains a narrower blood-drip edge',()=>{
  const html=read('public/index.html');
  const css=read('public/abyssal-shop-blood-theme.css');
  const original=read('public/abyssal-menu-orbit.css');
  assert.match(html,/abyssal-shop-blood-theme\.css\?v=2/);
  assert.match(original,/#abyssGate \.abyss-gate-content::before/);
  assert.match(css,/#abyssGate \.abyss-gate-content::before\s*\{/);
  assert.match(css,/inset:-1px!important/);
  assert.match(css,/#abyssGate \.abyss-gate-content::after\s*\{/);
  assert.match(css,/top:calc\(100% - 5px\)!important/);
  assert.match(css,/background:rgba\(90,16,21,\.62\)!important/);
  assert.match(css,/#abyssGate #abyssGateButton::after\s*\{/);
  assert.match(css,/linear-gradient\(140deg,#07080c 0%,#010204 49%,#100b10 100%\)/);
});

test('Fossas Abissais interior dialog keeps its controls and uses black blood-drip style',()=>{
  const css=read('public/abyssal-shop-blood-theme.css');
  const source=read('public/abyssal-rebuild.js');
  assert.match(source,/class="abyss-descent-dialog"/);
  assert.match(css,/\.abyss-descent-panel \.abyss-descent-dialog::after\s*\{/);
  assert.match(css,/\.abyss-descent-panel \.abyss-descent-choice\[data-mode="group"\]/);
  assert.match(css,/\.abyss-descent-panel \.abyss-descent-close\{z-index:3!important\}/);
  assert.doesNotMatch(css,/\.abyss-descent-panel \.abyss-descent-dialog > \*\s*\{/);
});

test('shop cards use brown glass and only paid species have purple tentacle corners',()=>{
  const html=read('public/index.html');
  const css=read('public/abyssal-shop-blood-theme.css');
  const game=read('public/game.js');
  const frame=read('public/abyssal-specimen-tentacles.svg');
  assert.match(html,/id="shopScreen"/);
  assert.match(html,/id="skinGrid" class="skin-grid"/);
  assert.match(game,/card\.className='skin-card'/);
  assert.match(css,/#shopScreen \.shop-modal\s*\{/);
  assert.match(css,/#shopScreen \.shop-modal::before\s*\{/);
  assert.match(css,/#shopScreen #skinGrid \.skin-card\s*\{/);
  assert.match(css,/#shopScreen #skinGrid \.skin-card\.paid-skin-card::before\s*\{/);
  assert.match(css,/background-image:url\('abyssal-specimen-tentacles\.svg'\)!important/);
  assert.match(css,/pointer-events:none!important/);
  assert.match(css,/#shopScreen #skinGrid \.skin-card\.owned\s*\{/);
  assert.match(css,/#shopScreen #skinGrid \.skin-card\.equipped\s*\{/);
  assert.match(css,/#shopScreen #skinGrid \.skin-card > :not\(\.boss-bundle-aura\)/);
  assert.match(frame,/<svg[^>]*viewBox="0 0 300 420"/);
  assert.match(frame,/translate\(300 420\) scale\(-1 -1\)/);
});


test('Fossas Abissais solo and shoal use fish glyphs, contextual copy and intact handlers',()=>{
  const js=read('public/abyssal-rebuild.js');
  const css=read('public/abyssal-interface-harmony.css');
  const i18n=read('public/i18n.js');
  assert.match(js,/data-mode="solo"/);
  assert.match(js,/data-mode="group"/);
  assert.equal((js.match(/class="abyss-choice-icon abyss-fish-icon/g)||[]).length,2);
  assert.doesNotMatch(js,/<span class="abyss-choice-icon" aria-hidden="true">(?:◌|◉)/);
  assert.match(js,/EXPLORAR SOZINHO/);
  assert.match(js,/MERGULHAR EM CARDUME/);
  assert.match(js,/FOSSAS ABISSAIS<\/h2>/);
  assert.match(js,/abyssal-start-rift-solo/);
  assert.match(js,/connectAndJoin/);
  assert.match(css,/\.abyss-descent-panel \.abyss-descent-choice \.abyss-fish-icon/);
  assert.match(i18n,/'MERGULHAR EM CARDUME':'DIVE WITH A SHOAL'/);
});

test('Fossas Abissais shortens the red shadow without fading its contour',()=>{
  const css=read('public/abyssal-interface-harmony.css');
  assert.match(css,/drop-shadow\(0 0 \.75px rgba\(125,20,30,\.65\)\)/);
  assert.match(css,/background:rgba\(90,16,21,\.62\)!important;opacity:\.76!important/);
  assert.match(css,/#abyssGate \.abyss-gate-content::after/);
  assert.match(css,/#abyssGate #abyssGateButton/);
});

test('every skin is brown; only paid skin cards keep tentacle ornament',()=>{
  const game=read('public/game.js');
  const original=read('public/abyssal-shop-blood-theme.css');
  const css=read('public/abyssal-interface-harmony.css');
  assert.match(game,/skin\.paid\?' paid-skin-card':''/);
  assert.match(original,/#shopScreen #skinGrid \.skin-card\.paid-skin-card::before\{/);
  assert.doesNotMatch(original,/#shopScreen #skinGrid \.skin-card::before\{/);
  assert.match(css,/#shopScreen #skinGrid \.skin-card:not\(\.paid-skin-card\)::before/);
  assert.match(css,/#shopScreen #skinGrid \.skin-card\.paid-skin-card::before/);
  assert.match(game,/card\.className='skin-card'/);
});

test('shop abilities and back to menu are brown, redeem code retains distinct styling',()=>{
  const html=read('public/index.html');
  const css=read('public/abyssal-interface-harmony.css');
  assert.match(html,/abyssal-interface-harmony\.css\?v=2/);
  assert.match(css,/#shopScreen #metaUpgradeGrid \.meta-card/);
  assert.match(css,/#shopScreen #metaUpgradeGrid \.meta-card>button:not\(:disabled\)/);
  assert.match(css,/#shopScreen #skinGrid \.skin-card \.skin-ability/);
  assert.match(css,/#shopScreen #shopCloseBtn,#shopScreen #shopTopCloseBtn/);
  assert.match(css,/#shopScreen #marineSearch/);
  assert.doesNotMatch(css,/#shopScreen #openRedeemCodeBtn\s*[,{]/);
  assert.doesNotMatch(css,/#redeemCodeScreen\s*[{,]/);
});

test('resonance modal including PVP reuses translucent violet button identity',()=>{
  const html=read('public/index.html');
  const css=read('public/abyssal-interface-harmony.css');
  assert.match(html,/id="resonanceScreen"/);
  assert.match(css,/#resonanceScreen \.resonance-modal\.resonance-pvp-theme/);
  assert.match(css,/rgba\(183,112,250,\.83\)!important/);
  assert.match(css,/#resonanceScreen \.resonance-modal \.resonance-skill-option:has\(input:checked\)/);
  assert.match(css,/#resonanceScreen \.resonance-modal #saveResonanceBtn/);
  assert.match(css,/#resonanceScreen \.resonance-modal \.resonance-mode-tabs button/);
});


test('PvE remains blue and PvP remains red, regardless of selected Resonance mode',()=>{
  const css=read('public/abyssal-interface-harmony.css');
  const html=read('public/index.html');
  const game=read('public/game.js');
  assert.match(html,/abyssal-interface-harmony\.css\?v=2/);
  assert.match(html,/game\.js\?v=\d{4}\.\d{1,2}\.\d{1,2}\.\d+/);
  assert.match(css,/button\[data-resonance-mode="pve"\]\{/);
  assert.match(css,/button\[data-resonance-mode="pvp"\]\{/);
  assert.match(css,/rgba\(86,170,255,\.88\)/);
  assert.match(css,/rgba\(255,92,109,\.87\)/);
  assert.match(game,/b\.setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(game,/b\.classList\.toggle\('active',active\)/);
});

test('the selected PvE or PvP tab grows, while both unselected tabs keep their regular size',()=>{
  const css=read('public/abyssal-interface-harmony.css');
  assert.match(css,/button\[data-resonance-mode="pve"\]\[aria-pressed="true"\]\{/);
  assert.match(css,/button\[data-resonance-mode="pvp"\]\[aria-pressed="true"\]\{/);
  const selected=css.match(/transform:scale\(1\.09\)!important/g)||[];
  assert.equal(selected.length,2);
  assert.match(css,/transform:scale\(1\)!important/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(css,/transform:scale\(1\.065\)!important/);
});

test('checked Resonance abilities turn green in both PvE and PvP, including checkbox and labels',()=>{
  const css=read('public/abyssal-interface-harmony.css');
  assert.match(css,/\.resonance-pvp-theme \.resonance-skill-option:has\(input:checked\)/);
  assert.match(css,/border:2px solid rgba\(104,236,155,\.93\)!important/);
  assert.match(css,/background:linear-gradient\(140deg,rgba\(33,119,68,\.54\)/);
  assert.match(css,/\.resonance-skill-option input:checked/);
  assert.match(css,/background:#79efab!important/);
  assert.match(css,/\.resonance-skill-option:has\(input:checked\) \.resonance-skill-copy strong/);
});
