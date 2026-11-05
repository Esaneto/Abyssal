'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');

test('Royal skin is a siphonophore colony instead of reusing the starter bell silhouette',()=>{
  const start=game.indexOf("else if(id==='royal')");
  const end=game.indexOf("else if(id==='toxic')",start);
  assert.ok(start>=0&&end>start);
  const royal=game.slice(start,end);
  assert.match(royal,/colonial siphonophore/);
  assert.match(royal,/pearl-chain spine/);
  assert.match(royal,/for\(let i=0;i<6;i\+\+\)/);
  assert.match(royal,/tentacle\(-\.52/);
  assert.doesNotMatch(royal,/for\(let i=0;i<8;i\+\+\)/);
});

test('boss relic cosmetics have a shared visual rarity signature without changing combat data',()=>{
  assert.match(game,/const RELIC_SKIN_IDS=new Set\(\['leviathan','kraken','aberration','angler','maw','devourer'\]\)/);
  const signatureStart=game.indexOf('// Rarity signatures distinguish collectible forms');
  const signatureEnd=game.indexOf('// Fine luminous lateral line',signatureStart);
  assert.ok(signatureStart>=0&&signatureEnd>signatureStart);
  const signature=game.slice(signatureStart,signatureEnd);
  assert.match(signature,/RELIC_SKIN_IDS\.has\(id\)/);
  assert.match(signature,/setLineDash/);
  assert.match(signature,/ellipse\(-\.04\*r,0,1\.22\*r,1\.02\*r/);
  assert.doesNotMatch(signature,/damage|hp|maxHp|speed|sendShot|socket|emit/);
});

test('abyssal signature set remains separate from boss relic cosmetics',()=>{
  assert.match(game,/const ABYSSAL_SIGNATURE_IDS=new Set\(\['abyssking','bloodmoon','abyssaleye','greensnake'\]\)/);
  assert.match(game,/else if\(ABYSSAL_SIGNATURE_IDS\.has\(id\)\)/);
});

test('Kraken identity and eight-arm silhouette are preserved by the rarity pass',()=>{
  const start=game.indexOf("if(id==='kraken')");
  const end=game.indexOf("else if(id==='default')",start);
  const kraken=game.slice(start,end);
  assert.match(kraken,/for\(let arm=0;arm<8;arm\+\+\)/);
  assert.match(kraken,/Glass-octopus inspired Kraken/);
});

test('canonical specimen names no longer depend on DOM relabeling',()=>{
  for(const [id,name] of [
    ['abyssking','Soberano do Vazio'],
    ['royal','Pérola Regente'],
    ['voidwing','Manta do Nada']
  ]){
    assert.match(game,new RegExp("\\{id:'"+id+"',name:'"+name+"'"));
  }
  assert.doesNotMatch(game,/name:'Rei do Vazio'|name:'Abismo Real'|name:'Asa do Nada'/);
});
