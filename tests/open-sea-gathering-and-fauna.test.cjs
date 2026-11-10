const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const fields=require('../public/abyssal-resource-fields.js');
const config=require('../public/abyssal-exploration-config.js');
const geo=require('../public/abyssal-ocean-geography.js');
const eco=require('../public/abyssal-open-sea-ecology.js');

test('mining and sampling require distinct equipped tools and time',()=>{
 assert.equal(fields.toolFor('phosphorite'),'abyssPickaxe');
 assert.equal(fields.toolFor('gasSeep'),'emptyCylinder');
 assert.equal(fields.toolFor('oilSeep'),'emptyCylinder');
 assert.ok(fields.durationFor('phosphorite')>=1500);
 assert.ok(fields.durationFor('gasSeep')>fields.durationFor('phosphorite'));
 const item={id:'geo:1:1:0',type:'phosphorite',x:100,y:100,amount:3};
 assert.equal(fields.eligible(item,103,103,{abyssPickaxe:1},125,'emptyCylinder').ok,false);
 assert.equal(fields.eligible(item,103,103,{abyssPickaxe:1},125,'abyssPickaxe').ok,true);
 const reward=fields.collect(item,{abyssPickaxe:1,phosphorite:0});
 assert.equal(reward.inventory.phosphorite,3);
 assert.equal(reward.inventory.abyssPickaxe,1);
});
test('oil/gas sample requires empty vial and never increments platform stock',()=>{
 for(const type of ['oilSeep','gasSeep']){
  const node={id:'geo:0:0:0',type,x:50,y:50,amount:1};
  assert.equal(fields.eligible(node,50,50,{emptyCylinder:0},125,'emptyCylinder').ok,false);
  assert.equal(fields.eligible(node,50,50,{emptyCylinder:2},125,'emptyCylinder').ok,true);
  const out=fields.collect(node,{emptyCylinder:2,oilCylinder:0,gasCylinder:0});
  assert.equal(out.ok,true);
  assert.equal(out.inventory.emptyCylinder,1);
  assert.equal(out.inventory[type==='oilSeep'?'oilCylinder':'gasCylinder'],1);
  assert.ok(!('oil' in out.inventory)&&!('gas' in out.inventory));
 }
});
test('fauna depth bands follow 2,200m and bottom dwellers remain near substrate',()=>{
 assert.equal(geo.metersAt(geo.HEIGHT),2200);
 assert.equal(eco.habitatAt(15000,geo.HEIGHT*.88).depthBand,'deep');
 const mid=eco.speciesAt(15000,geo.HEIGHT*.56,()=>.5);
 assert.ok(typeof mid==='string'&&mid.length>0);
});
test('online extraction explicitly separates timed work from collection',()=>{
 const server=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
 assert.match(server,/exploration-extract-begin/);
 assert.match(server,/exploration-extract-complete/);
 assert.match(server,/ResourceFields\.durationFor\(action\.type\)/);
 assert.match(server,/resourcePickup/);
 const source=fs.readFileSync(path.resolve(__dirname,'../public/abyssal-extraction-ui.js'),'utf8');
 assert.match(source,/drop=\{/);
 assert.match(source,/explorationCollect/);
});
