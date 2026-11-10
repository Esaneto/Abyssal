'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ecology=require('../public/abyssal-open-sea-ecology.js');
const ocean=require('../public/abyssal-ocean-stream.js');
const curated=require('../public/abyssal-curated-skins.js');
test('predators only spawn in deep western water or shallow eastern water',()=>{
 for(const id of ['reefshark','hammerhead','goblin','greenland','viperfish','angler']){
  assert.equal(ecology.predatorAllowedAt(id,500,300),false);
  assert.equal(ecology.predatorAllowedAt(id,7500,0),false);
  assert.equal(ecology.predatorAllowedAt(id,7500,300),true);
  assert.equal(ecology.predatorAllowedAt(id,500,1100),true);
 }
});
test('streamed fauna uses shop IDs and safe predator spawn positions',()=>{
 const known=new Set([...Object.keys(curated.byId),'reefshark','hammerhead','abysscroc','leviathan','angler']);
 for(const [cx,cy] of [[0,0],[1,0],[7,0],[1,1],[2,4],[14,3]]){
  const sector=ocean.generate('regression',cx,cy,ecology);
  for(const a of sector.animals){
   assert.ok(known.has(a.species),a.species);
   assert.equal(ecology.predatorAllowedAt(a.species,a.x,a.y),true,a.species);
  }
 }
});
test('exploration uses shop art, hides ranking and separates oxygen and vitality',()=>{
 const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../public/abyssal-exploration-hud.css'),'utf8');
 assert.ok(game.includes('if(e.specimenSkinId){'));
 assert.ok(!game.includes('AbyssalFaunaAnatomy?.draw'));
 assert.ok(!html.includes('src="abyssal-fauna-anatomy.js'));
 assert.match(css,/#runEnergyRanking/);
 assert.match(css,/#activeAbilities/);
 assert.match(css,/#selectedSkillsPanel/);
 assert.match(css,/#hud\.hud/);
});
