'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Map=require('../public/abyssal-map.js');

test('main expedition route always descends and boss is the deepest room',()=>{
 const layout=Map.createLayout('retention-route',0);
 const ids=['start','shoal','trench','lantern','junction','hub','landing','boss'];
 const rooms=ids.map(id=>layout.rooms.find(room=>room.id===id));
 for(let i=1;i<rooms.length;i++)assert.ok(rooms[i].y>rooms[i-1].y,ids[i]+' must be deeper than '+ids[i-1]);
 const boss=layout.rooms.find(room=>room.id==='boss');
 assert.equal(Math.max(...layout.rooms.map(room=>room.y)),boss.y);
 assert.equal(Math.max(...layout.rooms.map(room=>room.depth)),boss.depth);
});

test('seed variation changes lateral room shapes without inverting depth',()=>{
 const a=Map.createLayout('seed-a',0),b=Map.createLayout('seed-b',0);
 const main=['start','shoal','trench','lantern','junction','hub','landing','boss'];
 assert.ok(main.some(id=>a.rooms.find(r=>r.id===id).x!==b.rooms.find(r=>r.id===id).x));
 for(const layout of [a,b]){
  const ys=main.map(id=>layout.rooms.find(r=>r.id===id).y);
  assert.ok(ys.every((y,i)=>i===0||y>ys[i-1]));
 }
});

test('the expedition is one continuous cave and both exits sit behind the boss',()=>{
 const layout=Map.createLayout('portal-depth',0);
 assert.equal(layout.corridors.some(edge=>new Set([edge.a,edge.b]).has('hub')&&new Set([edge.a,edge.b]).has('landing')),true);
 const hub=layout.rooms.find(room=>room.id==='hub'),landing=layout.rooms.find(room=>room.id==='landing');
 assert.equal(Map.roomPath(layout,hub.id,landing.id).join('>'),'hub>landing');
 assert.equal(layout.portals.descent,null);
 assert.equal(layout.portals.landing,null);
 assert.equal(Map.roomAt(layout,layout.portals.surface.x,layout.portals.surface.y)?.id,'boss');
 assert.equal(Map.roomAt(layout,layout.portals.boss.x,layout.portals.boss.y)?.id,'boss');
});

test('walkable geometry blocks empty rectangle space and slides along cave walls',()=>{
 const layout=Map.createLayout('collision',0),start=layout.rooms.find(room=>room.id==='start');
 assert.equal(Map.isWalkable(layout,start.x,start.y,16),true);
 assert.equal(Map.isWalkable(layout,4700,200,16),false);
 const move=Map.resolveMove(layout,start.x,start.y,start.x-1000,start.y,18);
 assert.equal(move.blocked,true);
 assert.equal(Map.isWalkable(layout,move.x,move.y,18),true);
});

test('encounter spawn roles map to common elite and deepest boss chambers',()=>{
 const layout=Map.createLayout('encounters',0);
 const fixed=()=>.25;
 const common=Map.spawnPoint(layout,{type:'common',random:fixed,bossesDefeated:1});
 const elite=Map.spawnPoint(layout,{type:'elite',random:fixed,bossesDefeated:4});
 const boss=Map.spawnPoint(layout,{type:'boss',random:fixed,bossesDefeated:7});
 assert.notEqual(common.roomId,'elite');
 assert.equal(elite.roomId,'elite');
 assert.equal(boss.roomId,'boss');
 for(const point of [common,elite,boss])assert.equal(Map.isWalkable(layout,point.x,point.y,16),true);
});

test('optional encounter branches are lateral but never deeper than the final boss',()=>{
 const layout=Map.createLayout('branches',0),elite=layout.rooms.find(r=>r.id==='elite'),event=layout.rooms.find(r=>r.id==='event'),boss=layout.rooms.find(r=>r.id==='boss');
 assert.equal(elite.optional,true);
 assert.equal(event.optional,true);
 assert.ok(elite.y<boss.y&&event.y<boss.y);
 assert.ok(Math.abs(elite.x-event.x)>1500);
});

test('navigation stays on the cave graph instead of cutting through solid rock',()=>{
 const layout=Map.createLayout('navigation',0),start=layout.rooms.find(r=>r.id==='start'),hub=layout.rooms.find(r=>r.id==='hub');
 assert.equal(Map.segmentWalkable(layout,start.x,start.y,hub.x,hub.y,14),false);
 const nav=Map.navigationTarget(layout,start.x,start.y,hub.x,hub.y,{padding:14});
 assert.equal(nav.direct,false);
 assert.equal(nav.roomId,'shoal');
 assert.equal(Map.isWalkable(layout,nav.x,nav.y,14),true);
});
