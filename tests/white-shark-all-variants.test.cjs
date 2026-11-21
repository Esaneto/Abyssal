'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/abyssal-animated-sprites.js'),'utf8');
const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
test('wild white shark, boss and catalogue Eco share identical atlas URLs',()=>{
 let frames=[];
 class MockImage{constructor(){this.naturalWidth=576;this.naturalHeight=512;}
  set src(url){this.url=url;
   if(url.includes('abyssal-white-shark-swim')){this.naturalWidth=1280;this.naturalHeight=1008;}
   else if(url.includes('abyssal-white-shark-attack')){this.naturalWidth=2560;this.naturalHeight=1848;}
   else if(url.includes('abyssal-sharks-2.5d')){this.naturalWidth=576;this.naturalHeight=2880;}
   this.onload?.();
  }
 }
 const renderer={save(){},restore(){},drawImage(...items){frames.push(items);}};
 const host={Image:MockImage,performance:{now:()=>1300}};
 vm.runInNewContext(source,{globalThis:host});
 const api=host.AbyssalAnimatedSprites;assert.equal(api.status().whiteSharkReady,true);
 for(const id of ['whiteShark','whiteSharkBoss','reefshark']){
  const radius=id==='whiteSharkBoss'?62:22;frames=[];
  assert.equal(api.drawAtOrigin(renderer,id,radius,330,false),true);
  assert.equal(frames.length,1);assert.match(frames[0][0].url,/abyssal-white-shark-swim/);
  assert.equal(frames[0][8],radius*3.1);
  frames=[];const state={hostileBite:{startedAt:1100,duration:380,phaseStart:.44}};
  assert.equal(api.drawAtOrigin(renderer,id,radius,330,true,0,state),true);
  assert.equal(frames.length,1);assert.match(frames[0][0].url,/abyssal-white-shark-attack/);
 }
});
test('catalogue entry and boss specimen reference retain their identities',()=>{
 assert.match(game,/id:'reefshark',name:'Tubarão-branco'/);
 assert.match(game,/whiteShark:'reefshark',whiteSharkBoss:'reefshark'/);
 assert.match(game,/spriteId==='whiteShark'\|\|spriteId==='whiteSharkBoss'\|\|spriteId==='reefshark'/);
 assert.match(game,/if\(skin\.id==='reefshark'\)ctx\.rotate/);
});