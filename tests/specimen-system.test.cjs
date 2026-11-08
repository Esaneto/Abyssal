'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Specimen=require('../public/specimen-system.js');
const Standard=require('../public/skin-standard.js');
const Abilities=require('../public/skin-abilities.js');

test('specimen proficiency scales from 0 to 5000 with requested caps',()=>{
 const zero=Specimen.stats(0),half=Specimen.stats(2500),max=Specimen.stats(5000);
 assert.equal(zero.cooldown,10);assert.equal(zero.respawnSeconds,20);assert.equal(zero.attributeBonus,0);assert.equal(zero.rangeBonus,0);
 assert.equal(half.cooldown,7.5);assert.equal(half.respawnSeconds,15);assert.equal(half.attributeBonus,.025);assert.equal(half.rangeBonus,.10);
 assert.equal(max.cooldown,5);assert.equal(max.respawnSeconds,10);assert.equal(max.attributeBonus,.05);assert.equal(max.rangeBonus,.20);
 assert.equal(Specimen.pointsForKill(false),1);assert.equal(Specimen.pointsForKill(true),10);
 assert.equal(Specimen.addKill({kraken:4995},'kraken',true).kraken,5000);
});

test('every specimen active has ten-second base cooldown',()=>{
 for(const active of Object.values(Standard.ACTIVE))assert.equal(active.cooldown,10,active.name);
});

test('specimen passive is disabled while companion is down and gains up to five extra percentage points',()=>{
 const profile=Standard.profile('reefshark');
 assert.equal(profile.attribute,'movement');
 assert.equal(Abilities.movementMultiplier('reefshark',0,false),1);
 assert.equal(Abilities.movementMultiplier('reefshark',0,true),1.12);
 assert.equal(Abilities.movementMultiplier('reefshark',5000,true),1.17);
});

test('boss kill contributes ten adaptation points while a normal kill contributes one',()=>{
 let map={};
 map=Specimen.addKill(map,'kraken',false);
 assert.equal(map.kraken,1);
 map=Specimen.addKill(map,'kraken',true);
 assert.equal(map.kraken,11);
});
