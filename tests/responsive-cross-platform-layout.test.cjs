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
