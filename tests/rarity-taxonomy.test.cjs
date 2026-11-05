'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const rebuild=fs.readFileSync(path.join(root,'public','abyssal-rebuild.js'),'utf8');
const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');

test('specimen lore cannot create a second literal rarity system',()=>{
 const start=rebuild.indexOf('var SPECIMENS=['),end=rebuild.indexOf('];',start);
 const block=rebuild.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(block,/rarity:/);
 assert.match(block,/classTag:/);
 assert.match(rebuild,/CLASSE · /);
 assert.match(rebuild,/HABITAT · /);
 assert.doesNotMatch(rebuild,/spec\.rarity/);
 assert.match(html,/abyssal-rebuild\.js\?v=3/);
});

test('legacy coin prices follow the power hierarchy on client and server',()=>{
 const expected={solar:4800,toxic:14000,coral:18000,thorn:22000,royal:36000,glacier:42000,voidwing:48000};
 for(const [id,price] of Object.entries(expected)){
  assert.ok(game.includes("id:'"+id+"'")&&game.includes("price:"+price),id);
  assert.ok(server.includes(id+':'+price),id);
 }
});

test('premium fallback prices rise with stronger legacy skins',()=>{
 const marker="const paidBrl=Object.freeze({violet:690,reefshark:690,hammerhead:790,abysscroc:990,armoredgator:990,abyssking:1290,bloodmoon:1390,abyssaleye:1490,deepwarden:1590,angler:1690,aberration:1790,maw:1890,leviathan:2190,kraken:2490,devourer:2790});";
 assert.ok(game.includes(marker));
});

test('reference boss art remains preserved while attack effects are amplified',()=>{
 assert.match(game,/krakenTelegraph/);
 assert.match(game,/for\(let arm=0;arm<8;arm\+\+\)/);
 assert.match(game,/const strands=lowPowerRendering\?9:16/);
 assert.match(game,/e\.kind==='whiteSharkBoss'\?1\.15/);
 assert.match(game,/e\.kind==='devourer'&&e\.suctionActive\?1\.2/);
});
