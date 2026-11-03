const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'public/game.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/style.css'),'utf8');

test('camera uses a shared world-area reference instead of platform-specific zoom',()=>{
 assert.match(game,/FAIR_VIEW_REFERENCE/);
 assert.match(game,/FAIR_VIEW_WORLD_AREA/);
 assert.match(game,/Math\.sqrt\(viewportArea\/FAIR_VIEW_WORLD_AREA\)/);
 assert.doesNotMatch(game,/isMobileDevice\(\)\s*\?\s*\.5\s*:\s*\.78/);
});

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

test('mobile camera pulls farther back than desktop fair-area baseline',()=>{
 const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
 assert.match(game,/mobileViewport\?clamp\(fairZoom\*\.82,\.25,\.72\):clamp\(fairZoom,\.34,1\.12\)/);
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
 assert.match(game,/mobileDprCap=lowPowerRendering\?1\.35:2/);
 assert.match(game,/mobileViewport\?mobileDprCap:1\.65/);
});
test('PvP movement stream prioritizes low latency without reliable packet backlog',()=>{
 const online=fs.readFileSync(path.join(__dirname,'..','public','online.js'),'utf8');
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(online,/isPvp\?40:75/);
 assert.match(online,/interpDuration:isPvp\?58:105/);
 assert.match(online,/socket\.volatile\.emit\('player-position'/);
 assert.match(server,/playerMotionIntervalMs=room\.mode==='pvp'\?40:75/);
 assert.match(server,/volatile\.emit\('player-motion'/);
});
