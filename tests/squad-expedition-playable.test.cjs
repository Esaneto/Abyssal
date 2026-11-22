'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const P=require(path.join(root,'public/abyssal-squad-physics.js'));
const script=fs.readFileSync(path.join(root,'public/abyssal-squad-map.js'),'utf8');
function world(){
 const sample={x:215,y:312,rx:50,ry:40,angle:0,vertices:[[-50,-40],[50,-40],[50,40],[-50,40]]};
 const ctx={document:{readyState:'loading',addEventListener(){}},AbyssalSoloCavern:{buildRocks(w,h){assert.equal(w,4800);assert.equal(h,3000);return [sample];}}};
 vm.runInNewContext(script,ctx,{filename:'abyssal-squad-map.js'});return ctx.AbyssalSquadMapWorld;
}
test('the playable world has a continuous 9600x6000 area and preserved Solo center',()=>{
 const w=world();assert.equal(w.width,9600);assert.equal(w.height,6000);
 assert.equal(w.caves.length,8);assert.equal(w.center.x,2400);assert.equal(w.center.y,1500);
 assert.equal(w.rocks.filter(x=>x.classic).length,1);
 assert.equal(P.blocked(w,w.submarine.x,w.submarine.y,15),false);
});
test('danger scales downward and Pesadelo Roxo owns exactly eight unique tentacle hazards',()=>{
 const w=world(),enc=P.createEncounters(w),by=Object.fromEntries(enc.map(e=>[e.zone,e]));
 assert.equal(enc.length,8);
 for(const zone of ['canyons','gardens'])assert.equal(by[zone].tier,1);
 for(const zone of ['crystals','hadal'])assert.equal(by[zone].tier,4);
 assert.equal(by.crystals.bossKind,'riftSmile');assert.equal(by.crystals.bossName,'Pesadelo Roxo');
 assert.equal(by.crystals.traps.length,8);
 assert.equal(new Set(by.crystals.traps.map(t=>t.id)).size,8);
 for(const e of enc){if(e.zone!=='crystals')assert.equal(e.traps.length,0);}
 for(const trap of by.crystals.traps)assert.equal(P.blocked(w,trap.x,trap.y,12),false);
});
test('each cave has a usable entrance, a clear interior and solid walls',()=>{
 const w=world();for(const c of w.caves){
  assert.equal(P.blocked(w,c.x,c.y,15),false,c.zone+' chamber');
  const entry=P.safeEntry(w,c);assert.ok(entry,c.zone+' entry');
  assert.equal(P.visible(w,entry.x,entry.y,c.x,c.y),true,c.zone+' corridor');
  const wall=c.wallPolygons[0],mx=wall.reduce((sum,v)=>sum+v[0],0)/wall.length,my=wall.reduce((sum,v)=>sum+v[1],0)/wall.length;
  assert.equal(P.blocked(w,mx,my,2),true,c.zone+' wall');
 }
});
test('player movement cannot cross solid rock or world boundary',()=>{
 const w=world(),rock=w.rocks.find(r=>r.classic);
 const pt=rock.points[0],res=P.move(w,pt[0]-100,pt[1]-100,1000,1000,15);
 assert.equal(P.blocked(w,res.x,res.y,15),false);
 assert.equal(P.blocked(w,-10,300,15),true);
 const edge=P.move(w,50,50,-999,-999,15);assert.ok(edge.x>=15&&edge.y>=15);
});
test('tentacles warn before damage; map runtime is intentionally nonpersistent',()=>{
 const t={index:0};assert.equal(P.trapState(t,7.8),'warning');assert.equal(P.trapState(t,9),'active');assert.equal(P.trapState(t,2),'idle');
 const play=fs.readFileSync(path.join(root,'public/abyssal-squad-playtest.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 assert.match(html,/abyssal-squad-physics\.js/);assert.match(html,/abyssal-squad-playtest\.js/);
 assert.match(play,/EXPLORAR TERRENO/);assert.match(play,/Nenhuma recompensa/);assert.doesNotMatch(play,/grantReward|purchaseCoins|UPDATE accounts/);
});
