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
