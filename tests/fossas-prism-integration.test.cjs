'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const map=require('../public/abyssal-map.js');
const traps=require('../public/abyssal-rift-hardcore.js');
const ai=require('../public/enemy-ai.js');
const curated=require('../public/abyssal-curated-skins.js').items;
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');

test('bosses advance through visible cave waypoints instead of steering into a wall',()=>{
 for(const seed of [42,99,72433,75443]){
  const layout=map.createLayout(seed,7);
  const start=layout.rooms.find(r=>r.id==='start');
  const boss=layout.rooms.find(r=>r.id==='boss');
  assert.ok(start&&boss);
  assert.equal(map.segmentWalkable(layout,start.x,start.y,boss.x,boss.y,5),false);
  const next=map.navigationTarget(layout,start.x,start.y,boss.x,boss.y,{padding:5});
  assert.equal(next.direct,false);
  assert.ok(Number.isFinite(next.x)&&Number.isFinite(next.y));
  assert.ok(map.segmentWalkable(layout,start.x,start.y,next.x,next.y,5),'safe first navigation waypoint');
 }
});

test('vertical transit shafts actually receive downhill boulders and concealed lures',()=>{
 for(const seed of [42,99,72433,75443]){
  const layout=map.createLayout(seed,7);
  const hazards=traps.build(layout,7);
  const stones=hazards.filter(h=>h.type==='rockfall'&&h.roomId.startsWith('passage:'));
  const lures=hazards.filter(h=>h.type==='lure'&&h.roomId.startsWith('passage:'));
  assert.ok(stones.length>=2,'rocks must fall across a traversable narrow passage');
  assert.ok(lures.length>=1,'lures must intercept real passage traffic');
  for(const stone of stones){
   assert.ok(stone.length>175&&Math.sin(stone.angle)>.5,'fall has a downward velocity');
   assert.equal(map.isWalkable(layout,stone.sourceX-Math.cos(stone.angle)*33,stone.sourceY-Math.sin(stone.angle)*33),false);
   const time=stone.period-stone.offset-stone.active+stone.active*.23;
   const phase=traps.state(stone,time),fall=traps.rockfallState(stone,phase);
   assert.equal(phase.phase,'active');
   assert.equal(traps.hit(stone,fall.x,fall.y,0,phase),true,'visible descending rock immediately damages on contact');
  }
  for(const lure of lures){
   assert.ok(lure.radius>=110,'lure uses effective, not only declared radius');
   const active=traps.state(lure,lure.period-lure.offset-lure.active+lure.active*.4);
   assert.equal(traps.hit(lure,lure.x,lure.y,0,active),true);
  }
 }
});

test('kraken arms extend well past the previous contact silhouette',()=>{
 const arms=Array.from({length:8},(_,i)=>ai.krakenTentaclePose(i,0));
 assert.equal(arms.length,8);
 assert.ok(arms.every(p=>Math.hypot(p.ex,p.ey)>3.8));
});

test('Nightmare boss and shop relic share the same Kraken head and suction-cup arm renderer',()=>{
 const src=read('public/abyssal-rift-hardcore.js');
 const boss=src.slice(src.indexOf('function drawFinalBoss('),src.indexOf('// Small, playable relic'));
 const relic=src.slice(src.indexOf('function drawNightmareRelic('),src.indexOf('return {FINAL_TIER'));
 assert.match(src,/function drawNightmareKrakenHead\(c,r,pulse=0\)/);
 assert.match(boss,/drawNightmareKrakenHead\(c,r,pulse\)/);
 assert.match(relic,/drawNightmareKrakenHead\(c,r,q\)/);
 assert.match(boss,/drawNightmareArm\(c,points/);
 assert.match(relic,/drawNightmareArm\(c,points/);
 assert.match(src,/function drawNightmareArm\(/);
});

test('Nova shards reuse the original shot volley and are validated by the server',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/emitPrismaticNovaShards\(novaDps,novaVolleyId\)/);
 assert.match(game,/special:'nova',volleyId:novaVolleyId/);
 assert.match(game,/const count=2\*rank,volleyId=sharedVolleyId\|\|nextShotVolleyId\(\)/);
 assert.match(server,/shot\.special==='prismShard'[\s\S]*shooter\.lastNovaVolleyId/);
 assert.match(server,/maxShards=2\*rank/);
 assert.match(server,/shot\.damage=Math\.min\(shot\.damage/);
});

test('Photon Prism has 2, 4 or 6 actual cave-clipped side beams, rendered for peers and resolved on server',()=>{
 const game=read('public/game.js'),online=read('public/online.js'),server=read('server.js');
 assert.match(game,/for\(let i=0;i<rank\*2;i\+\+\)/);
 assert.match(game,/clipPrismaticPhotonRay\(player\.x,player\.y/);
 assert.match(game,/prismBeams\.some\(beam=>PHOTON_RAY_VISUAL\.segmentCircleHit/);
 assert.match(game,/Array\.isArray\(d\.prismBeams\)/);
 assert.match(server,/const prismRank=clamp\(Math\.floor\(Number\(shooter\.prismaticLevel\)/);
 assert.match(server,/for\(let i=0;i<prismRank\*2;i\+\+\)/);
 assert.match(server,/shot\.prismBeams=secondarySegments\.map/);
 assert.match(server,/sideHit=!primaryHit&&secondarySegments\.some/);
 assert.match(online,/hadalBeamActive:data\.hadalBeamActive===true/);
});

test('curated marine skin palettes avoid near-duplicate RGB identifiers',()=>{
 const game=read('public/game.js');
 const catalog=game.slice(game.indexOf('const skinData=['),game.indexOf('\n];',game.indexOf('const skinData=[')));
 const originals=[...catalog.matchAll(/\{id:'([^']+)',name:'([^']+)',color:'(#[A-Fa-f0-9]{6})'/g)].map(m=>({id:m[1],color:m[3]}));
 const all=[...originals,...curated];
 const rgb=color=>[0,2,4].map(i=>parseInt(color.slice(i+1,i+3),16));
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
  const a=rgb(all[i].color),b=rgb(all[j].color);
  const distance=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  assert.ok(distance>=14,'near duplicate palette: '+all[i].id+' / '+all[j].id+' ('+distance.toFixed(1)+')');
 }
});
