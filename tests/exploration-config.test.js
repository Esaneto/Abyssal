'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rules=require('../public/abyssal-exploration-config.js');

test('solo and online share the open-sea world; PvP stays separate',()=>{
 assert.equal(rules.MODES.solo.world,rules.MODES.online.world);
 assert.equal(rules.MODES.online.cooperative,true);
 assert.equal(rules.MODES.rift.world,'rift');
 assert.equal(rules.MODES.pvp.world,'arena');
 assert.equal(rules.MODES.pvp.survival,false);
});

test('pressure and breathing gas reflect depth without confusing suit rating',()=>{
 assert.equal(rules.pressureAt(0),1);
 assert.equal(rules.pressureAt(10),2);
 assert.equal(rules.pressureAt(100),11);
 assert.equal(rules.gasConsumption(10,1),2);
 assert.ok(rules.oxygenCapacity(1)>rules.oxygenCapacity(0));
 assert.ok(rules.safeDepth(1)>rules.safeDepth(0));
});

test('research registry records Q/E, passives and resource prerequisites',()=>{
 const {RESEARCH}=rules;
 assert.equal(RESEARCH.pulse.slot,'Q');
 assert.equal(RESEARCH.dash.slot,'E');
 assert.equal(RESEARCH.bulkhead.group,'passive');
 assert.equal(RESEARCH.oxygenTank.group,'equipment');
 assert.equal(rules.canResearch('pulse',{sonar:0},{deepCrystal:10,bioSample:10}).reason,'prerequisite');
 assert.equal(rules.canResearch('pulse',{sonar:1},{deepCrystal:0,bioSample:10}).reason,'resources');
 assert.equal(rules.canResearch('pulse',{sonar:1},{deepCrystal:2,bioSample:2}).ok,true);
 assert.equal(rules.canResearch('pulse',{sonar:1,pulse:1},{deepCrystal:2,bioSample:2}).reason,'max-level');
});

test('habitat filtering never invents species outside configured depth',()=>{
 assert.ok(rules.habitatFor(20).includes('reef'));
 assert.ok(!rules.habitatFor(6000).includes('reef'));
 assert.ok(rules.habitatFor(6000).includes('abyss'));
 for(const [id,resource] of Object.entries(rules.RESOURCES)){
  assert.ok(resource.habitats.every(h=>Boolean(rules.HABITATS[h])),id);
 }
});

test('expedition hub uses old game handlers without legacy swim controller',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const menu=fs.readFileSync(path.join(__dirname,'../public/abyssal-expedition-hub.js'),'utf8');
 assert.match(html,/abyssal-exploration-config\.js/);
 assert.match(html,/abyssal-expedition-hub\.js/);
 assert.doesNotMatch(html,/<script src="abyssal-menu-ocean\.js/);
 assert.match(menu,/actions\.append\(solo,online\)/);
 assert.match(menu,/layer\.appendChild\(rift\)/);
 assert.match(menu,/AbyssalMenuScenery\?\.draw/);
});
