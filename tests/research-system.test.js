'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const research=require('../public/abyssal-research-system.js');

test('research consumes materials atomically and increases exactly one level',()=>{
 const original={seaMineral:5};
 const result=research.study('salvageTool',{},original);
 assert.equal(result.ok,true);
 assert.equal(result.level,1);
 assert.equal(result.inventory.seaMineral,3);
 assert.equal(original.seaMineral,5);
});

test('research rejects unaffordable or missing prerequisites',()=>{
 assert.equal(research.study('sonar',{}, {ferromanganeseCrust:3,phosphorite:3}).reason,'prerequisite');
 assert.equal(research.study('sonar',{sampler:1},{ferromanganeseCrust:0,phosphorite:2}).reason,'resources');
 assert.equal(research.study('sonar',{sampler:1},{ferromanganeseCrust:2,phosphorite:1}).ok,true);
});

test('higher research levels require more materials',()=>{
 assert.equal(research.costFor('oxygenTank',0).seaMineral,3);
 assert.equal(research.costFor('oxygenTank',2).seaMineral,9);
 assert.equal(research.study('oxygenTank',{oxygenTank:5},{seaMineral:100}).reason,'max-level');
});

test('old paid abilities remain usable after the research migration',()=>{
 const legacy={pulse:1,dash:1,bulkhead:2};
 const moved=research.migrateLegacy({},legacy);
 assert.equal(moved.levels.pulse,1);
 assert.equal(moved.levels.dash,1);
 assert.equal(moved.levels.bulkhead,2);
 assert.equal(research.equipActives(['pulse','dash','unknown'],moved.levels,legacy).length,2);
 assert.equal(research.unlocked('pulse',{},legacy),true);
 assert.deepEqual(legacy,{pulse:1,dash:1,bulkhead:2});
 assert.equal(research.unlocked('ricochet',{},legacy),false,'legacy ownership must not grant unrelated technologies');
});

test('untrusted inventory and research counts are bounded and sanitized',()=>{
 assert.equal(research.sanitizeInventory({seaMineral:-10,deepCrystal:Infinity}).seaMineral,0);
 assert.equal(research.sanitizeInventory({seaMineral:1e10}).seaMineral,1000000);
 assert.equal(research.sanitizeLevels({oxygenTank:1000}).oxygenTank,5);
});
