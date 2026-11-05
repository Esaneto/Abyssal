'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const boss=fs.readFileSync(path.join(root,'public','abyssal-boss-renderer.js'),'utf8');
const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');

test('all colossal hostile bosses route through the dedicated abyssal renderer',()=>{
 assert.match(game,/BOSS_KINDS\.includes\(kind\)&&window\.drawAbyssalBoss/);
 assert.match(html,/abyssal-boss-renderer\.js\?v=1/);
 for(const kind of ['boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer']){
   assert.ok(boss.includes("kind==='"+kind+"'"),kind);
 }
});

test('boss renderer encodes unique silhouette anatomy instead of shared rings',()=>{
 for(const marker of [
  'heavy mineral mantle, eight hooked arms',
  'enormous skull, cavernous jaw',
  'enormous hinge jaw and black throat pouch',
  'very long ribbon body, segmented armor',
  'exaggerated skull, serrated jaw',
  'spear mantle, two feeding tentacles much longer',
  'massive mantle, hooked arms'
 ]) assert.ok(boss.includes(marker),marker);
 assert.doesNotMatch(boss,/ellipse\(0,0,r\*1\.46,r\*1\.27/);
});
