'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const atlas=require('../public/abyssal-animated-sprites.js');
const source=fs.readFileSync(path.join(__dirname,'../public/abyssal-animated-sprites.js'),'utf8');
test('22 pre-interpolated caudal frames loop with no index jump',()=>{
 const period=22*45;
 assert.equal(atlas.whiteSharkSwimPosition(0),0);
 assert.equal(atlas.whiteSharkSwimPosition(period),0);
 assert.ok(atlas.whiteSharkSwimPosition(period-1)>21.9);
 assert.ok(atlas.whiteSharkSwimPosition(period+1)<.03);
 for(let ms=0;ms<=period*2;ms+=8){
  const p=atlas.whiteSharkFrameWeights(ms,-1);
  assert.equal(p.length,1);assert.equal(p[0].mode,'swim');
  assert.equal(p[0].opacity,1);assert.ok(p[0].index>=0&&p[0].index<22);
 }
});
test('attack uses only its own sprite frames and closes back into swim',()=>{
 for(const p of [0,.03,.07,.14,.44,.75,.9,.999]){
  const f=atlas.whiteSharkFrameWeights(1600,p);
  assert.equal(f.length,1);assert.equal(f[0].mode,'attack');
  assert.ok(f[0].index>=0&&f[0].index<22);
 }
 assert.equal(atlas.whiteSharkFrameWeights(100,-1)[0].mode,'swim');
});
test('one drawImage on the game canvas per shark frame, without render-time buffers',()=>{
 const draws=[],ctx={save(){},restore(){},drawImage(...args){draws.push(args)}};
 class Img{constructor(){this.naturalWidth=672;this.naturalHeight=1008;}set src(v){this.path=v;this.onload?.();}}
 const root={Image:Img,performance:{now:()=>1800}};
 vm.runInNewContext(source,{globalThis:root});
 const api=root.AbyssalAnimatedSprites;
 assert.equal(api.status().whiteSharkReady,true);
 assert.equal(api.status().whiteSharkDrawCalls,1);
 assert.equal(api.drawAtOrigin(ctx,'whiteShark',24,400,false),true);
 assert.equal(draws.length,1);
 draws.length=0;
 assert.equal(api.drawAtOrigin(ctx,'whiteShark',24,400,true,0,{hostileBite:{startedAt:1600,duration:300,phaseStart:.44}}),true);
 assert.equal(draws.length,1);
});
test('only the ordinary white shark disables whole-body sway',()=>{
 const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 assert.match(game,/if\(spriteId==='whiteShark'&&!playerCreature\)/);
 assert.match(game,/c\.rotate\(Number\(movingEnemyHeading\)\|\|0\)/);
});