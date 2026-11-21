const test=require('node:test');
const assert=require('node:assert/strict');
const AI=require('../public/enemy-ai.js');
const atlas=require('../public/abyssal-animated-sprites.js');

test('ordinary white shark never starts biting during distant pursuit',()=>{
 const e={kind:'whiteShark'};
 for(const t of [0,40,180,450])assert.equal(AI.whiteSharkBiteWindow(e,'diver',false,t).ready,false);
 assert.equal(e.whiteSharkBiteWindup,null);
 assert.equal(atlas.isBiting(e,450),false);
});
test('bite has a 180ms near-contact windup and cancels if prey escapes',()=>{
 const e={kind:'whiteShark'};
 assert.equal(AI.whiteSharkBiteWindow(e,'diver',true,1000).started,true);
 assert.equal(AI.whiteSharkBiteWindow(e,'diver',true,1110).ready,false);
 assert.equal(atlas.isBiting(e,1110),true);
 assert.ok(atlas.biteProgress(e,1110,true,1110)>0);
 const cancelled=AI.whiteSharkBiteWindow(e,'diver',false,1120);
 assert.equal(cancelled.cancelled,true);
 assert.equal(e.whiteSharkBiteWindup,null);
 assert.equal(atlas.isBiting(e,1130),true);
 assert.equal(atlas.biteProgress(e,1300,true,1300),-1);
 assert.equal(AI.whiteSharkBiteWindow(e,'diver',true,1300).ready,false);
 assert.equal(AI.whiteSharkBiteWindow(e,'diver',true,1420).ready,false);
 assert.equal(AI.whiteSharkBiteWindow(e,'diver',true,1480).ready,true);
});
test('changing the target restarts the windup and the boss remains unchanged',()=>{
 const e={kind:'whiteShark'};
 AI.whiteSharkBiteWindow(e,'player-A',true,10);
 assert.equal(AI.whiteSharkBiteWindow(e,'player-B',true,200).ready,false);
 assert.equal(AI.whiteSharkBiteWindow(e,'player-B',true,379).ready,false);
 assert.equal(AI.whiteSharkBiteWindow(e,'player-B',true,380).ready,true);
 assert.equal(AI.whiteSharkBiteWindow({kind:'whiteSharkBoss'},'player-A',true,10).ready,true);
});
test('the shark attack finishes by returning to a swimming frame',()=>{
 const state={hostileBite:{startedAt:1000,duration:300,phaseStart:.44}};
 assert.equal(atlas.biteProgress(state,1000,true,1000),.44);
 assert.ok(atlas.biteProgress(state,1250,true,1250)>.8);
 assert.equal(atlas.biteProgress(state,1301,true,1301),-1);
});
test('both required atlas assets are declared for offline use and are present in the repository',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 for(const mode of ['swim','attack']){
  const asset=path.join(__dirname,'../public/abyssal-white-shark-'+mode+'.webp');
  const header=fs.readFileSync(asset);
  assert.equal(header.subarray(0,4).toString(),'RIFF');
  assert.equal(header.subarray(8,12).toString(),'WEBP');
  assert.equal(header.subarray(12,16).toString(),'VP8X');
  assert.equal(1+header[24]+(header[25]<<8)+(header[26]<<16),672);
  assert.equal(1+header[27]+(header[28]<<8)+(header[29]<<16),1008);
  assert.ok(header.length<400000);
 }
 const sw=fs.readFileSync(path.join(__dirname,'../public/offline-sw.js'),'utf8');
 assert.match(sw,/abyssal-white-shark-swim[.]webp/);
 assert.match(sw,/abyssal-white-shark-attack[.]webp/);
});
