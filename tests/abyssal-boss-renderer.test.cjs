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
 assert.match(html,/abyssal-boss-renderer\.js\?v=4/);
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


test('redesigned bosses expose high-contrast secondary colors and luminous organs',()=>{
 for(const marker of ['#35e7ff','#ff4b7d','#ff5ba7','#69f5ff','#ff5fcf','#6fffe9'])assert.ok(boss.includes(marker),marker);
});


test('non-reference bosses use biological features instead of generic scars',()=>{
 assert.doesNotMatch(boss,/scar\(-\.48,-\.05,-\.2,\.2\)/);
 assert.doesNotMatch(boss,/scar\(-\.7,-\.24,-\.25,-\.02\)/);
 assert.doesNotMatch(boss,/scar\(-\.95,-\.12,-\.55,\.12\)/);
 for(const marker of ['Two dominant hunting arms','Gill fan and throat glow','rgba(255,65,190,.16)','for(let i=0;i<8;i++){const xx=-2.55+i*.38'])assert.ok(boss.includes(marker),marker);
});
