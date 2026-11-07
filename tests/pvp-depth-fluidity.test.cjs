'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const bullets=require('../pvp-projectiles');
const map=require('../public/abyssal-map');
const traps=require('../public/abyssal-rift-hardcore');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const players=()=>[{id:'shooter',alive:true,x:100,y:100,r:13},{id:'victim',alive:true,x:210,y:100,r:13}];
const shot=(extra={})=>({ownerId:'shooter',x:100,y:100,ux:1,uy:0,speed:200,remaining:400,lifetime:2,lastAt:1000,createdAt:1000,worldWidth:2000,worldHeight:2000,worldZoom:.78,radius:5,volleyTargets:new Set(),...extra});
test('PvP travel must reach the target before authorizing hit',()=>{
 const shots=[shot()],hits=[];
 bullets.advance(shots,players(),1050,()=>false,(_s,t)=>hits.push(t.id));
 assert.deepEqual(hits,[]);
 for(let at=1100;at<=1600;at+=50)bullets.advance(shots,players(),at,()=>false,(_s,t)=>hits.push(t.id));
 assert.deepEqual(hits,['victim']);
 assert.equal(shots.length,0);
});
test('PvP walls block moving shots and targets can evade after launch',()=>{
 const blocked=[shot()],hits=[];
 for(let at=1050;at<=1600;at+=50)bullets.advance(blocked,players(),at,x=>x>=165,()=>hits.push('wallghost'));
 assert.equal(blocked.length,0);
 const dodged=[shot()],peers=players();peers[1].y=220;
 for(let at=1050;at<=1600;at+=50)bullets.advance(dodged,peers,at,()=>false,()=>hits.push('ghost'));
 assert.deepEqual(hits,[]);
});
test('Projectile pool remains bounded even during six-player firestorms',()=>{
 const shots=[];for(let i=0;i<bullets.MAX_PROJECTILES+30;i++)bullets.enqueue(shots,shot({createdAt:i}));
 assert.equal(shots.length,bullets.MAX_PROJECTILES);
});
test('First Fossas floor has only fire and all other traps unlock progressively',()=>{
 const unlock={fumarole:1,pressure:2,rockfall:2,spikes:3,electric:4,lure:5,vortex:6};
 for(const seed of [42,99,72433]){
  const layout=map.createLayout(seed,7);
  for(let tier=0;tier<=7;tier++){
   const rows=traps.build(layout,tier);
   for(const h of rows){
    if(tier===0)assert.equal(h.type,'volcano');
    if(h.type==='tentacle')assert.equal(h.roomId,'boss');
    if(h.type!=='tentacle'&&h.type!=='volcano')assert.ok(tier>=unlock[h.type],h.type+' unlocked too early');
   }
   if(tier<7)assert.equal(rows.filter(h=>h.type==='tentacle').length,0);
   else assert.ok(rows.filter(h=>h.type==='tentacle').length<=8);
  }
 }
});
test('Rajada Prismática remains a passive alongside the selected primary shot',()=>{
 const game=read('public/game.js');
 assert.match(game,/passive:\['burst','ricochet','spread'\]/);
 assert.match(game,/for\(const id of runResonanceIds\)[\s\S]*?skill\.apply\(\);upgradeLevels\[id\]=1/);
 assert.match(game,/resonanceEditedInSession=true;saveResonancePresets\(\)/);
});
test('PvP authoritative movement reconciles moving bullets instead of precomputing hits',()=>{
 const server=read('server.js');
 assert.match(server,/PvpProjectiles\.advance\(/);
 assert.match(server,/PvpProjectiles\.enqueue\(/);
 assert.match(server,/const sx=Number\(shooter\.x\),sy=Number\(shooter\.y\)/);
 assert.doesNotMatch(server,/duration=shot\.modifiers\?\.abyssEye===true\?12/);
});
