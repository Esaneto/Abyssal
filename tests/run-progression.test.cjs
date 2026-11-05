'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ensureRunProgression,creditRunXp}=require('../run-progression');

test('authoritative XP grants an upgrade credit only after the real threshold',()=>{
 const run={};
 assert.equal(creditRunXp(run,9),0);
 assert.equal(run.authoritativeXp,9);
 assert.equal(run.authoritativeXpNeed,10);
 assert.equal(run.pendingUpgradeCredits,0);
 assert.equal(creditRunXp(run,1),1);
 assert.equal(run.authoritativeXp,0);
 assert.equal(run.authoritativeXpNeed,16);
 assert.equal(run.pendingUpgradeCredits,1);
});

test('one large authoritative orb can grant chained upgrade credits deterministically',()=>{
 const run={authoritativeXp:0,authoritativeXpNeed:10,pendingUpgradeCredits:0};
 const gained=creditRunXp(run,100);
 assert.ok(gained>1);
 assert.equal(run.pendingUpgradeCredits,gained);
 assert.ok(run.authoritativeXp>=0&&run.authoritativeXp<run.authoritativeXpNeed);
 assert.ok(run.authoritativeXpNeed>10);
});

test('deploy-restored progression is normalized without resetting earned credit',()=>{
 const run={authoritativeXp:'7',authoritativeXpNeed:'24',pendingUpgradeCredits:'2'};
 const same=ensureRunProgression(run);
 assert.equal(same,run);
 assert.equal(run.authoritativeXp,7);
 assert.equal(run.authoritativeXpNeed,24);
 assert.equal(run.pendingUpgradeCredits,2);
});

test('invalid XP never creates credits and credit storage is bounded',()=>{
 const run={pendingUpgradeCredits:64};
 assert.equal(creditRunXp(run,-20),0);
 assert.equal(run.pendingUpgradeCredits,64);
 creditRunXp(run,1e9);
 assert.equal(run.pendingUpgradeCredits,64);
});
