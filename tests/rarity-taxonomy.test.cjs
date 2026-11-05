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
 const expected={solar:2500,toxic:4000,coral:6000,thorn:8000,abyssking:10000,royal:12000,glacier:13000,bloodmoon:9000,voidwing:15000,abyssaleye:18000,deepwarden:14000};
 for(const [id,price] of Object.entries(expected)){
  assert.ok(game.includes("id:'"+id+"'")&&game.includes("price:"+price),id);
  assert.ok(server.includes(id+':'+price),id);
 }
});

test('premium fallback prices preserve the original BRL table',()=>{
 const marker="const paidBrl=Object.freeze({violet:390,reefshark:590,hammerhead:590,abysscroc:690,armoredgator:690,angler:1290,maw:1490,aberration:1490,leviathan:1690,kraken:1890,devourer:1990});";
 assert.ok(game.includes(marker));
});

test('reference boss art remains preserved while attack effects are amplified',()=>{
 assert.match(game,/krakenTelegraph/);
 assert.match(game,/for\(let arm=0;arm<8;arm\+\+\)/);
 assert.match(game,/const strands=lowPowerRendering\?9:16/);
 assert.match(game,/e\.kind==='whiteSharkBoss'\?1\.15/);
 assert.match(game,/e\.kind==='devourer'&&e\.suctionActive\?1\.2/);
});
