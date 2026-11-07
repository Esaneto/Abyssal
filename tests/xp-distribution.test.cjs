'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {splitXp}=require('../xp-distribution');

const player=(id,alive=true)=>({id,alive,runStats:{settled:false}});
const sum=shares=>Math.round(shares.reduce((total,share)=>total+share.value,0)*1000)/1000;

test('80 percent damage and 20 percent team participation share a fixed XP pool',()=>{
 const shares=splitXp(100,[player('alpha'),player('beta')],{alpha:80,beta:20});
 assert.equal(shares.find(p=>p.id==='alpha').value,74);
 assert.equal(shares.find(p=>p.id==='beta').value,26);
 assert.equal(sum(shares),100,'a kill cannot mint full XP for every participant');
});

test('a support player without a hit still receives the squad baseline',()=>{
 const shares=splitXp(100,[player('alpha'),player('beta'),player('support')],{alpha:70,beta:30});
 const xp=Object.fromEntries(shares.map(p=>[p.id,p.value]));
 assert.ok(xp.alpha>xp.beta);
 assert.ok(xp.beta>xp.support);
 assert.ok(xp.support>0);
 assert.equal(sum(shares),100);
});

test('neutral hazard death with no damage ledger splits equally among active teammates',()=>{
 const shares=splitXp(90,[player('a'),player('b'),player('c')],null);
 assert.deepEqual(shares.map(p=>p.value),[30,30,30]);
});

test('single player gets the entire XP award without collecting anything',()=>{
 assert.deepEqual(splitXp(1,[player('solo')],{}),[{id:'solo',value:1,damage:0}]);
});

test('dead, tutorial and settled players cannot receive automatic rewards',()=>{
 const shares=splitXp(50,[player('a'),player('dead',false),{...player('tutorial'),tutorialActive:true},{id:'settled',runStats:{settled:true}}],{a:10,dead:500});
 assert.deepEqual(shares,[{id:'a',value:50,damage:10}]);
});

test('fractional XP remains exact and deterministic even for tiny enemy awards',()=>{
 const group=[player('a'),player('b'),player('c')];
 const shares=splitXp(1,group,{a:19,b:7,c:1});
 assert.equal(sum(shares),1);
 assert.ok(shares[0].value>shares[1].value&&shares[1].value>shares[2].value);
 assert.deepEqual(shares,splitXp(1,group,{a:19,b:7,c:1}));
});

test('invalid or negative damage cannot inflate experience',()=>{
 const shares=splitXp(20,[player('a'),player('b')],{a:-100,b:1e9});
 assert.equal(sum(shares),20);
 assert.ok(shares[1].value>shares[0].value);
 assert.deepEqual(splitXp(-10,[player('a')],{a:20}),[]);
});
