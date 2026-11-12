const test=require('node:test'),assert=require('node:assert/strict');
const cave=require('../public/abyssal-solo-cavern.js');
const rocks=cave.buildRocks(4800,3000);
test('Solo terrain creates reproducible physical rocks with navigable gaps',()=>{
 assert.equal(rocks.length,14);
 assert.deepEqual(rocks,cave.buildRocks(4800,3000));
 assert.ok(rocks.every(r=>r.cavernSolid&&!r.visualOnly));
 assert.equal(cave.isBlocked(rocks,2400,330,13),false);
});
test('Physical rock blocks movement and allows axis sliding',()=>{
 const r=rocks[0];
 assert.equal(cave.isBlocked(rocks,r.x,r.y,0),true);
 const result=cave.resolve(rocks,r.x-r.r-80,r.y,r.x,r.y,12);
 assert.equal(result.blocked,true);
 assert.equal(cave.isBlocked(rocks,result.x,result.y,12),false);
});
test('Bullets hit rocks, while clear paths remain open',()=>{
 const r=rocks[0];
 assert.equal(cave.segmentBlocked(rocks,r.x-r.r-50,r.y,r.x+r.r+50,r.y,2),true);
 assert.equal(cave.segmentBlocked(rocks,2400,270,2400,390,2),false);
});

test('Enemies navigate around a rock instead of steering into its center',()=>{
 const r=rocks[0],start={x:r.x-r.r-50,y:r.y},goal={x:r.x+r.r+50,y:r.y};
 let pos=start;
 assert.equal(cave.segmentBlocked(rocks,start.x,start.y,goal.x,goal.y,12),true);
 const first=cave.navigationTarget(rocks,4800,3000,pos.x,pos.y,goal.x,goal.y,12);
 assert.equal(first.direct,false);assert.equal(first.blocked,false);
 for(let i=0;i<400&&Math.hypot(goal.x-pos.x,goal.y-pos.y)>10;i++){
  const nav=cave.navigationTarget(rocks,4800,3000,pos.x,pos.y,goal.x,goal.y,12);
  assert.equal(nav.blocked,false);
  const d=Math.hypot(nav.x-pos.x,nav.y-pos.y);const step=Math.min(18,d);
  pos=cave.resolve(rocks,pos.x,pos.y,pos.x+(nav.x-pos.x)/(d||1)*step,pos.y+(nav.y-pos.y)/(d||1)*step,12);
  assert.equal(cave.isBlocked(rocks,pos.x,pos.y,12),false);
 }
 assert.ok(Math.hypot(goal.x-pos.x,goal.y-pos.y)<20,'path must reach target behind solid rock');
});
test('Lamp levels follow Deep Eye 22% progression',()=>{
 const a=cave.lampParameters(1),b=cave.lampParameters(2),c=cave.lampParameters(3);
 assert.equal(b.range/a.range,1.22);assert.ok(Math.abs(c.range/b.range-1.22)<1e-9);
 assert.ok(a.halo<a.range/4);assert.ok(c.halfAngle<Math.PI/2);
});
test('Energy persists, upgrades consume collected currency and cannot overspend',()=>{
 const {create}=require('../public/abyssal-solo-progress.js'),map=new Map(),store={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let p=create(store);assert.deepEqual(p.get(),{energy:0,lamp:1});
 assert.equal(p.upgradeLamp().ok,false);p.credit(79);assert.equal(p.upgradeLamp().ok,false);p.credit(1);
 assert.equal(p.upgradeLamp().ok,true);assert.deepEqual(p.get(),{energy:0,lamp:2});
 p.credit(180);p=create(store);assert.equal(p.upgradeLamp().ok,true);
 assert.deepEqual(create(store).get(),{energy:0,lamp:3});assert.equal(p.upgradeLamp().ok,false);
});

test('The real polygon blocks the flashlight and prevents large-step tunnelling',()=>{
 const r=rocks[0],start={x:r.x-r.r-50,y:r.y},end={x:r.x+r.r+50,y:r.y};
 const distance=cave.rayDistance(rocks,start.x,start.y,1,0,end.x-start.x);
 assert.ok(distance>0&&distance<end.x-start.x);
 assert.equal(cave.segmentBlocked(rocks,start.x,start.y,end.x,end.y,0),true);
 const pos=cave.resolve(rocks,start.x,start.y,end.x,end.y,12);
 assert.equal(pos.blocked,true);assert.ok(pos.x<r.x);
 assert.equal(cave.isBlocked(rocks,pos.x,pos.y,12),false);
});
test('Starting corridor allows real Solo horizontal movement between upper and lower shelves',()=>{
 assert.equal(cave.segmentBlocked(rocks,2400,330,2750,330,24),false);
});

test('pursuit rounds a wall when diver hugs the opposite side',()=>{
 const wall={x:500,y:400,rx:25,ry:180,r:183,angle:0,vertices:[[-25,-180],[25,-180],[25,180],[-25,180]],cavernSolid:true};const rocks=[wall],actor={x:400,y:400,angle:0},goal={x:534,y:400};let reached=false;
 for(let i=0;i<700;i++){const nav=cave.pursuitTarget(rocks,1000,800,actor,goal,24,i*16),d=Math.hypot(nav.x-actor.x,nav.y-actor.y);if(d>.01){const step=Math.min(4,d),p=cave.resolve(rocks,actor.x,actor.y,actor.x+(nav.x-actor.x)/d*step,actor.y+(nav.y-actor.y)/d*step,24);actor.x=p.x;actor.y=p.y;}assert.equal(cave.isBlocked(rocks,actor.x,actor.y,24),false);if(actor.x>550&&Math.hypot(actor.x-goal.x,actor.y-goal.y)<80){reached=true;break;}}
 assert.ok(reached,'must round the shelf to reach the diver side');
});


// Exercise the production hull state against the actual polygon/terrain resolver.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function submarineHarness(){
 const src=fs.readFileSync(path.resolve(__dirname,'../public/game.js'),'utf8');
 const helpers=src.slice(src.indexOf('let soloSubmarine='),src.indexOf('function soloSubmarineTopUp()'));
 const mounts=src.slice(src.indexOf('const SOLO_WEAPON_MOUNTS='),src.indexOf('function submarineMount('));
 let now=1000;
 const context={SOLO_CAVERN:cave,GAME_WORLD_ZOOM:1,W:4800,H:3000,arenaRocks:[],onlineMode:false,gameState:'playing',isClassicShooterRun:()=>true,player:{x:2400,y:900,r:18,moveSpeed:180,specimen:{x:2400,y:850,r:20,alive:true}},equippedSkin:'default',window:{addEventListener(){}},performance:{now:()=>now},clearSoloSubmarinePhotonRay(){},enemyParalyzedNow:()=>false};
 vm.createContext(context);
 vm.runInContext(helpers+mounts+';resetSoloSubmarine();',context);
 return {run:s=>vm.runInContext(s,context),advance:ms=>{now+=ms;},context};
}
test('Submarine has three independent 300 HP sections and every mount belongs to one section',()=>{
 const h=submarineHarness();
 assert.equal(h.run('soloSubmarine.sections.length'),3);
 assert.equal(h.run('soloSubmarine.sections.reduce((sum,s)=>sum+s.hp,0)'),900);
 assert.equal(h.run('arenaRocks.filter(r=>r.submarineHull).length'),3);
 assert.equal(h.run("soloWeaponSection('pierce').id"),0);
 assert.equal(h.run("soloWeaponSection('nova').id"),0);
 assert.equal(h.run("soloWeaponSection('photon').id"),1);
 assert.equal(h.run("soloWeaponSection('electric').id"),1);
 assert.equal(h.run("soloWeaponSection('photonRay').id"),2);
 assert.equal(h.run("soloWeaponSection('echoShot').id"),2);
});
test('destroying one section opens physical passage and disables only its turrets; repair restores both',()=>{
 const h=submarineHarness();
 assert.equal(h.run('SOLO_CAVERN.segmentBlocked(arenaRocks,2400,950,2400,1400,2)'),true);
 h.run('damageSoloHull(soloSubmarine.sections[1],300)');
 assert.equal(h.run('soloSubmarine.sections[1].hp'),0);
 assert.equal(h.run('soloSubmarine.debris.length'),12);
 assert.equal(h.run('SOLO_CAVERN.segmentBlocked(arenaRocks,2400,950,2400,1400,2)'),false);
 assert.equal(h.run("soloWeaponOperational('photon')"),false);
 assert.equal(h.run("soloWeaponOperational('pierce')"),true);
 assert.equal(h.run('soloSubmarine.sections[0].hp+soloSubmarine.sections[2].hp'),600);
 h.run('player.x=2400;player.y=1170');
 assert.equal(h.run('repairSoloHull()'),true);
 assert.equal(h.run('soloSubmarine.sections[1].hp'),300);
 assert.equal(h.run("soloWeaponOperational('photon')"),true);
 assert.equal(h.run('SOLO_CAVERN.segmentBlocked(arenaRocks,2400,950,2400,1400,2)'),true);
 assert.equal(h.run('SOLO_CAVERN.isBlocked(arenaRocks,player.x,player.y,player.r+2)'),false);
});
test('powered hull always takes priority; unpowered creatures choose the nearest diver or specimen',()=>{
 const h=submarineHarness();
 h.run('player.x=100;player.y=100;player.specimen.x=500;player.specimen.y=500;soloSubmarine.powerSeconds=300;var mob={id:1,x:510,y:500,r:20,damage:20};var diver={x:player.x,y:player.y,local:true}');
 assert.equal(h.run('soloCreatureTarget(mob,diver).submarine'),true);
 assert.equal(h.run('SOLO_CAVERN.isBlocked(arenaRocks,soloCreatureTarget(mob,diver).x,soloCreatureTarget(mob,diver).y,Math.max(5,mob.r*.62))'),false);
 h.run('soloSubmarine.powerSeconds=0');
 assert.equal(h.run('soloCreatureTarget(mob,diver).specimen'),true);
 h.run('mob.x=110;mob.y=100');
 assert.equal(h.run('soloCreatureTarget(mob,diver).local'),true);
 h.run('player.specimen.alive=false;mob.x=510;mob.y=500');
 assert.equal(h.run('soloCreatureTarget(mob,diver).local'),true);
});
test('unpowered hull takes contact damage, one hit per creature cooldown, with no automatic attraction',()=>{
 const h=submarineHarness();
 h.run('var mob={id:1,x:2400,y:1063,r:30,damage:20};soloSubmarine.powerSeconds=0;');
 h.run('soloHullContact(mob,1000)');
 assert.equal(h.run('soloSubmarine.sections[1].hp'),280);
 h.run('soloHullContact(mob,1100)');
 assert.equal(h.run('soloSubmarine.sections[1].hp'),280);
 h.run('soloHullContact(mob,2100)');
 assert.equal(h.run('soloSubmarine.sections[1].hp'),260);
});

test('researched submarine shield absorbs exactly one positive hit per dive, with no recharge on power top-up',()=>{
 const h=submarineHarness();h.context.window.AbyssalSoloBase={get:()=>({submarineShield:true})};
 h.run('soloSubmarine.powerSeconds=300;var mob={id:1,x:2400,y:1063,r:30,damage:20}');
 assert.equal(h.run('soloHullShieldReady()'),true);
 assert.equal(h.run('damageSoloHull(soloSubmarine.sections[1],0)'),false);
 assert.equal(h.run('soloHullShieldReady()'),true);
 h.run('soloHullContact(mob,1000)');
 assert.equal(h.run('soloSubmarine.sections[1].hp'),300);
 assert.equal(h.run('soloSubmarine.shieldSpent'),true);
 h.run('soloSubmarine.powerSeconds=300;soloHullContact(mob,2100)');
 assert.equal(h.run('soloSubmarine.sections[1].hp'),280);
 assert.equal(h.run('soloHullShieldReady()'),false);
 h.run('resetSoloSubmarine();soloSubmarine.powerSeconds=300');
 assert.equal(h.run('soloHullShieldReady()'),true);
});
test('powered hull attack station holds position and triggers one bite per cooldown',()=>{
 const h=submarineHarness();let visualCount=0;h.context.renderHostileContactAbility=()=>visualCount++;
 h.run('soloSubmarine.powerSeconds=300;var mob={id:1,x:2400,y:1063,r:30,damage:20,vx:90,vy:50}');
 assert.equal(h.run('holdSoloHullAttack(mob,.016,1000)'),true);
 assert.equal(h.run('mob.vx'),0);assert.equal(h.run('mob.vy'),0);
 assert.equal(h.run('mob.hostileBite.duration'),480);
 assert.equal(h.run('soloSubmarine.sections[1].hp'),280);
 for(let i=1;i<60;i++)assert.equal(h.run('holdSoloHullAttack(mob,.016,'+(1000+i*16)+')'),true);
 assert.equal(h.run('mob.x'),2400);assert.equal(h.run('mob.y'),1063);
 assert.equal(visualCount,1);
 h.run('holdSoloHullAttack(mob,.016,2100)');
 assert.equal(h.run('soloSubmarine.sections[1].hp'),260);assert.equal(visualCount,2);
 h.run('soloSubmarine.powerSeconds=0');
 assert.equal(h.run('holdSoloHullAttack(mob,.016,2200)'),false);
});
