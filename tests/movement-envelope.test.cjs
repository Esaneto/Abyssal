'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DEFAULT_RATE,DEFAULT_CAPACITY,consumeMovementBudget}=require('../movement-envelope');

test('normal movement replenishes faster than the legal high-speed client consumes it',()=>{
 const state={};
 let now=1000;
 for(let i=0;i<60;i++){
  const result=consumeMovementBudget(state,30,now);
  assert.equal(result.allowed,true);
  now+=50;
 }
 assert.ok(state.movementBudget>=0&&state.movementBudget<=DEFAULT_CAPACITY);
});

test('one burst can absorb jitter but repeated impossible jumps exhaust the budget',()=>{
 const state={};
 const first=consumeMovementBudget(state,DEFAULT_CAPACITY-5,1000);
 assert.equal(first.allowed,true);
 const second=consumeMovementBudget(state,100,1010);
 assert.equal(second.allowed,false);
 assert.ok(second.allowance<100);
});

test('budget replenishes from wall-clock time without multiplying allowance per packet',()=>{
 const state={};
 consumeMovementBudget(state,420,1000);
 const blockedA=consumeMovementBudget(state,100,1050);
 const blockedB=consumeMovementBudget(state,100,1050);
 assert.equal(blockedA.allowed,false);
 assert.equal(blockedB.allowed,false);
 assert.equal(blockedB.allowance,blockedA.allowance);
 const later=consumeMovementBudget(state,90,1150);
 assert.equal(later.allowed,true);
});

test('dash-range speed remains comfortably legal at 20 to 30 Hz',()=>{
 const state={};
 let now=1000;
 for(let i=0;i<90;i++){
  const result=consumeMovementBudget(state,26,now);
  assert.equal(result.allowed,true);
  now+=40;
 }
});

test('sustained movement above the configured server envelope is eventually rejected',()=>{
 const state={};
 let now=1000, rejected=false;
 for(let i=0;i<100;i++){
  const result=consumeMovementBudget(state,60,now);
  if(!result.allowed){rejected=true;break;}
  now+=50;
 }
 assert.equal(rejected,true);
 assert.equal(DEFAULT_RATE,900);
});
