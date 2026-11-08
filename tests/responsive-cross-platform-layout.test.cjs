const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const game=fs.readFileSync(path.join(root,'public/game.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/style.css'),'utf8');


test('mobile UI has explicit portrait and landscape layouts',()=>{
 assert.match(css,/@media \(max-width:700px\) and \(orientation:portrait\)/);
 assert.match(css,/@media \(pointer:coarse\) and \(orientation:landscape\)/);
 assert.match(css,/--touch-target:48px/);
});

test('desktop gameplay controls use stable edge and center zones',()=>{
 assert.match(css,/body\.game-active:not\(\.mobile-game-active\) #activeAbilities\.active-abilities/);
 assert.match(css,/body\.game-active:not\(\.mobile-game-active\) #selectedSkillsPanel/);
 assert.match(css,/@media \(min-width:701px\)/);
});

test('gameplay overlays are detached from the HUD coordinate box',()=>{
 const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
 const hudClose=html.indexOf('</section>',html.indexOf('<section id="hud"'));
 const overlay=html.indexOf('id="gameplayOverlayRoot"');
 assert.ok(hudClose>0 && overlay>hudClose,'overlay root must be a sibling after HUD');
 assert.match(css,/\.gameplay-overlay-root\{position:absolute;inset:0/);
});

test('mobile information panels occupy opposite arena corners',()=>{
 assert.match(css,/#selectedSkillsPanel\{left:var\(--game-safe-left\)!important;right:auto!important/);
 assert.match(css,/#runEnergyRanking\{left:auto!important;right:var\(--game-safe-right\)!important/);
});

test('desktop persistent match UI is zoned into extreme corners',()=>{
 assert.match(css,/DESKTOP MATCH HUD V5/);
 assert.match(css,/\.hud\{\s*left:14px!important;right:auto!important;top:14px!important/);
 assert.match(css,/#selectedSkillsPanel\{\s*left:auto!important;right:14px!important;top:14px!important/);
 assert.match(css,/#runEnergyRanking\{\s*left:auto!important;right:14px!important;top:auto!important;bottom:14px!important/);
 assert.match(css,/#activeAbilities\.active-abilities\{\s*left:14px!important;right:auto!important;top:auto!important;bottom:14px!important/);
});

test('gameplay overlays are impossible to render outside an active match',()=>{
 assert.match(css,/\.gameplay-overlay-root\{display:none!important\}/);
 assert.match(css,/body\.game-active \.gameplay-overlay-root\{display:block!important\}/);
 assert.match(css,/body:not\(\.game-active\) #selectedSkillsPanel/);
});

test('desktop progression is horizontal at top-left with four stats below',()=>{
 assert.match(css,/GAMEPLAY HUD V6/);
 assert.match(css,/#bossProgressionTrack\{[\s\S]*width:100%!important/);
 assert.match(css,/\.hud-top\{[\s\S]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.hud\{[\s\S]*left:14px!important;right:auto!important;top:14px!important/);
});
test('runtime no longer writes ranking coordinates',()=>{
 const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
 assert.doesNotMatch(game,/function positionRunEnergyRanking\(/);
 assert.doesNotMatch(game,/ranking\.style\.top/);
});
test('end dive return clears game-active state',()=>{
 const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
 assert.match(game,/const returnToMenu=\(result\)=>\{onlineMode=false;setMobileGameActive\(false\);document\.body\.classList\.remove\('game-active'\)/);
});

test('mobile menu utilities do not use fixed positioning in final layout',()=>{
 const final=css.slice(css.lastIndexOf('MOBILE V7'));
 assert.match(final,/#menuScreen \.download-cta,#menuScreen \.controls-cta\{\s*position:static!important/);
 assert.match(final,/@media \(max-width:700px\) and \(orientation:portrait\)/);
 assert.match(final,/@media \(pointer:coarse\) and \(orientation:landscape\)/);
});

test('mobile match uses floating movement and only fixed aim stick',()=>{
 const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
 assert.match(game,/\[\[mobileAimStick,true\]\]\.forEach/);
 assert.match(css,/body\.mobile-game-active #mobileMoveStick\{display:none!important\}/);
 assert.match(css,/#mobileAimStick\.dual-stick-visible/);
 assert.match(css,/#mobileJoystick\.is-floating/);
});
test('mobile match requests portrait and blocks landscape as fallback',()=>{
 const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
 assert.match(game,/screen\.orientation\?\.lock\?\.\('portrait'\)/);
 assert.match(css,/@media \(pointer:coarse\) and \(orientation:landscape\)/);
 assert.match(css,/GIRE O CELULAR PARA A VERTICAL/);
});
test('desktop end dive and collapsed HUD controls own distinct edge zones',()=>{
 const final=css.slice(css.lastIndexOf('UI V8'));
 assert.match(final,/#endDiveBtn\{[\s\S]*top:calc\(14px \+ min\(30vh,260px\) \+ 12px\)!important/);
 assert.match(final,/body\.game-active\.hud-collapsed:not\(\.mobile-game-active\) #toggleHudBtn\{\s*right:14px!important/);
 assert.match(final,/#activeAbilities\.active-abilities\{[\s\S]*left:14px!important;right:auto!important;[\s\S]*bottom:14px!important/);
});

test('gameplay notices are arena-centered and fade across exactly five seconds',()=>{
 const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
 const final=css.slice(css.lastIndexOf('GAMEPLAY NOTICES V9'));
 assert.match(game,/classList\.add\('gameplay-notice-5s'\)/);
 assert.match(game,/\},5000\);/);
 assert.match(final,/body\.game-active #bossAlert\.boss-alert\{[\s\S]*left:50%!important;[\s\S]*top:14px!important/);
 assert.match(final,/@keyframes gameplayNoticeFiveSeconds/);
 assert.match(final,/100%\{opacity:0/);
});
test('legacy progression danger notifications are retired on desktop and mobile',()=>{
 const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
 const fn=game.slice(game.indexOf("function showAbyssalAlert"),game.indexOf("const gameplayNoticeQueue"));
 assert.match(fn,/return;/);
 assert.match(css,/#abyssalDangerAlert\{display:none!important\}/);
});

test('gameplay notification queue deduplicates semantic relay duplicates',()=>{
 const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
 assert.match(game,/const gameplayNoticeRecent=new Map\(\)/);
 assert.match(game,/gameplayNoticeKey\(kind,title,text\)/);
 assert.match(game,/if\(now-last<7000\)return/);
});

test('mobile canvas uses adaptive high-DPI rendering instead of forced DPR 1',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 assert.match(game,/Math\.min\(window\.devicePixelRatio\|\|1,lowPowerRendering\?1\.2:\(mobileViewport\?2:1\.8\)\)/);
 assert.match(game,/adaptiveDprScale/);
});
test('PvP movement stream prioritizes low latency without reliable packet backlog',()=>{
 const online=fs.readFileSync(path.join(__dirname,'..','public','online.js'),'utf8');
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(online,/now-lastPositionAt<1000\/30/);
 assert.match(online,/interpDuration:Math\.max\(24,Math\.min\(isPvp\?45:55,sampleMs\*1\.05\)\)/);
 assert.match(online,/socket\.volatile\.emit\('player-motion-input'/);
 assert.match(server,/playerMotionIntervalMs=1000\/30/);
 assert.match(server,/volatile\.emit\('player-motion'/);
});

test('Abyssary text reflows to one column on narrow phones',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','public','style.css'),'utf8');
 assert.match(css,/RESPONSIVE TEXT AUTHORITY V11/);
 assert.match(css,/@media\(max-width:560px\)[\s\S]*?\.codex-grid\{grid-template-columns:1fr!important\}/);
 assert.match(css,/\.codex-card b\{[\s\S]*?font-size:clamp\(11px,2\.5vw,13px\)/);
 assert.match(css,/\.codex-card p\{[\s\S]*?font-size:clamp\(10px,2\.25vw,11px\)/);
 assert.match(css,/overflow-wrap:anywhere/);
});


test('Android responsive authority prevents modal and gameplay box overlap',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','public','style.css'),'utf8');
 const final=css.slice(css.lastIndexOf('ANDROID RESPONSIVE AUTHORITY V12'));
 assert.match(final,/\.modal-screen\{[\s\S]*overflow-y:auto!important;overflow-x:hidden!important/);
 assert.match(final,/\.modal-card,\.shop-modal,\.codex-modal,\.wheel-modal[\s\S]*max-width:100%!important/);
 assert.match(final,/\.skin-grid,\.meta-upgrade-grid,\.catalog-grid,\.codex-grid,\.upgrade-choices\{[\s\S]*grid-template-columns:1fr!important/);
 assert.match(final,/body\.mobile-game-active #selectedSkillsPanel\{[\s\S]*left:auto!important;right:var\(--game-safe-right\)!important/);
 assert.match(final,/body\.mobile-game-active #runEnergyRanking\{[\s\S]*left:var\(--game-safe-left\)!important;right:auto!important/);
 assert.match(final,/max-width:calc\(50vw - 14px\)!important/);
 assert.match(final,/@media \(max-width:380px\)/);
 assert.match(final,/@media \(pointer:coarse\) and \(orientation:landscape\)/);
});


test('mobile menu moves download and controls to topbar and protects title flow',()=>{
 const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
 const css=fs.readFileSync(path.join(root,'public','style.css'),'utf8');
 const final=css.slice(css.lastIndexOf('MOBILE MENU TOP UTILITIES V13'));
 assert.match(html,/id="mobileDownloadTopBtn"[\s\S]*id="mobileControlsTopBtn"/);
 assert.match(html,/id="downloadBtn" class="secondary-btn download-cta desktop-menu-utility"/);
 assert.match(html,/id="controlsBtn" class="secondary-btn controls-cta desktop-menu-utility"/);
 assert.match(final,/\.mobile-top-utility\{display:none\}/);
 assert.match(final,/#menuScreen \.desktop-menu-utility\{display:none!important\}/);
 assert.match(final,/#menuScreen h1\{[\s\S]*min-height:calc\(1\.92em \+ 8px\)!important;[\s\S]*overflow:visible!important/);
});


test('mobile header uses compact vector icons and menu remains vertically scrollable',()=>{
 const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
 const css=fs.readFileSync(path.join(root,'public','style.css'),'utf8');
 const final=css.slice(css.lastIndexOf('MOBILE HEADER + SCROLL AUTHORITY V14'));
 assert.doesNotMatch(html,/mobileDownloadTopBtn[^>]*>[\s\S]{0,20}\\n/);
 assert.match(html,/id="mobileDownloadTopBtn"[\s\S]*?<svg class="ui-icon"/);
 assert.match(html,/id="mobileControlsTopBtn"[\s\S]*?<svg class="ui-icon"/);
 assert.match(final,/#menuScreen\{[\s\S]*overflow-y:auto!important/);
 assert.match(final,/touch-action:pan-y!important/);
 assert.match(final,/#menuScreen \.menu-content\{[\s\S]*height:auto!important;[\s\S]*max-height:none!important/);
 assert.match(final,/#menuScreen \.language-setting\{[\s\S]*align-self:flex-end!important/);
 assert.match(final,/\.top-actions \.icon-btn\{[\s\S]*width:30px!important;height:30px!important/);
});


test('new menu uses isolated portal layout and retains mobile volume popup',()=>{
 const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
 const css=fs.readFileSync(path.join(root,'public','style.css'),'utf8');
 const ocean=fs.readFileSync(path.join(root,'public','abyssal-menu-v2.css'),'utf8');
 for(const id of ['shopBtn','catalogBtn','rankingsBtn','cardumesBtn','profileBtn','supportBtn'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(ocean,/#menuScreen\.ocean-menu-v2\{/);
 assert.match(ocean,/\.abyss-ocean-portal-layer/);
 assert.match(css,/\.volume-popup\{[\s\S]*position:fixed!important;[\s\S]*left:10px!important;right:10px!important/);
});

test('gameplay uses the full viewport with collapsible chrome and platform-specific abyss vignette', () => {
  const css = read('public/style.css');
  assert.match(css, /body\.game-active #gameShell\{[\s\S]*position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important/);
  assert.match(css, /body\.game-active\.hud-collapsed \.topbar\{opacity:0!important/);
  assert.match(css, /body\.game-active #gameShell::after/);
  assert.match(css, /@media \(max-width:700px\),\(pointer:coarse\)[\s\S]*body\.game-active #gameShell::after[\s\S]*linear-gradient\(180deg/);
});


test('match HUD reserves topbar space and reclaims it when chrome is collapsed', () => {
  const css = read('public/style.css');
  assert.match(css, /body\.game-active\{--match-ui-top:calc\(max\(8px,env\(safe-area-inset-top\)\) \+ 64px\)\}/);
  assert.match(css, /body\.game-active\.hud-collapsed\{--match-ui-top:max\(10px,env\(safe-area-inset-top\)\)\}/);
  assert.match(css, /body\.game-active:not\(\.mobile-game-active\) \.hud\{top:var\(--match-ui-top\)!important/);
  assert.match(css, /body\.mobile-game-active \.hud\{top:var\(--match-ui-top\)!important/);
});



test('fullscreen expands field of view without changing world scale',()=>{
 const game=read('public/game.js');
 const zoom=game.slice(game.indexOf('function desiredWorldZoom'),game.indexOf('function desiredMapFactor'));
 assert.match(zoom,/return mobileViewport\?\.48:FAIR_VIEW_REFERENCE\.zoom/);
 assert.doesNotMatch(zoom,/viewW|viewH|viewportArea|Math\.sqrt/);
});

test('mobile match HUD starts at safe-area top regardless of collapsed chrome',()=>{
 const css=read('public/style.css');
 const final=css.slice(css.lastIndexOf('MOBILE MATCH HUD V18'));
 assert.match(final,/body\.game-active,\s*body\.game-active\.hud-collapsed\{--match-ui-top:max\(7px,env\(safe-area-inset-top\)\)\}/);
 assert.match(final,/body\.mobile-game-active \.hud\{top:var\(--match-ui-top\)!important\}/);
});

test('active gameplay rebuilds framebuffer on every viewport resize',()=>{
 const game=read('public/game.js');
 assert.match(game,/window\.addEventListener\('resize',\(\)=>\{resize\(\);if\(gameState==='playing'/);
});

test('final edge layout keeps end dive below desktop ranking and lifts mobile aim only',()=>{
 const css=read('public/style.css');
 const final=css.slice(css.lastIndexOf('MATCH EDGE LAYOUT V19'),css.indexOf('/* Authoritative gameplay owns',css.lastIndexOf('MATCH EDGE LAYOUT V19')));
 assert.match(final,/#endDiveBtn\{[\s\S]*bottom:14px!important/);
 assert.match(final,/#runEnergyRanking\{[\s\S]*bottom:62px!important;[\s\S]*max-height:calc\(100dvh - 76px\)!important/);
 assert.match(final,/#mobileAimStick\.dual-stick-visible\{[\s\S]*bottom:calc\(var\(--game-safe-bottom\) \+ 54px\)!important/);
 assert.doesNotMatch(final,/mobile-game-active #runEnergyRanking/);
});
