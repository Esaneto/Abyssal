'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const boss=fs.readFileSync(path.join(root,'public','abyssal-boss-renderer.js'),'utf8');
const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');

test('only weak colossal bosses route through the dedicated redesign renderer',()=>{
 assert.match(game,/BOSS_KINDS\.includes\(kind\)&&!\['whiteSharkBoss','kraken','devourer'\]\.includes\(kind\)&&window\.drawAbyssalBoss/);
 assert.match(html,/abyssal-boss-renderer\.js\?v=2/);
 for(const kind of ['boss','angler','maw','leviathan'])assert.ok(boss.includes("'"+kind+"'"),kind);
});

test('proven shark kraken and devourer boss visuals remain on the established renderer',()=>{
 assert.match(game,/!\['whiteSharkBoss','kraken','devourer'\]\.includes\(kind\)/);
 assert.doesNotMatch(boss,/kind==='whiteSharkBoss'/);
 assert.doesNotMatch(boss,/kind==='kraken'/);
 assert.doesNotMatch(boss,/kind==='devourer'/);
});

test('redesigned bosses have unique anatomy markers',()=>{
 for(const marker of [
  'Compact mass first, warning rings second',
  'Head-dominant anglerfish',
  'Long ribbon body + a jaw that is almost the whole head',
  'colossal ribbon, not a normal fish'
 ]) assert.ok(boss.includes(marker),marker);
});
