'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const geo=require('../public/abyssal-ocean-geography.js');
const fields=require('../public/abyssal-resource-fields.js');
const cfg=require('../public/abyssal-exploration-config.js');
const research=require('../public/abyssal-research-system.js');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('first-time exploration grants one pickaxe and one reusable cylinder',()=>{
 const first=fields.starterKit({},false);
 assert.equal(first.granted,true);
 assert.equal(first.inventory.abyssPickaxe,1);
 assert.equal(first.inventory.emptyCylinder,1);
 const second=fields.starterKit(first.inventory,true);
 assert.equal(second.changed,false);
 assert.deepEqual(second.inventory,first.inventory);
 assert.equal(research.sanitizeInventory(first.inventory).emptyCylinder,1);
});

test('ore requires picareta, and each seep creates a filled cylinder and retains the sampler',()=>{
 const ore={id:'geo:2:3:1',x:60,y:70,type:'polymetallicNodule',amount:3};
 const oil={id:'geo:2:3:2',x:60,y:70,type:'oilSeep',amount:1};
 const gas={id:'geo:2:3:3',x:60,y:70,type:'gasSeep',amount:1};
 let inv=fields.starterKit({},false).inventory;
 assert.equal(fields.eligible(ore,60,70,inv,115,'emptyCylinder').reason,'select-tool');
 assert.equal(fields.eligible(oil,60,70,inv,115,'abyssPickaxe').reason,'select-tool');
 assert.equal(fields.eligible(ore,300,70,inv,115,'abyssPickaxe').reason,'too-far');
 assert.equal(fields.eligible(ore,60,70,inv,115,'abyssPickaxe').ok,true);
 let result=fields.collect(ore,inv);
 assert.equal(result.ok,true);assert.equal(result.amount,3);assert.equal(result.inventory.polymetallicNodule,3);
 assert.equal(result.inventory.abyssPickaxe,1,'pickaxe is reusable');
 inv=result.inventory;result=fields.collect(oil,inv);assert.equal(result.ok,true);
 assert.equal(result.item,'oilCylinder');assert.equal(result.inventory.emptyCylinder,1);
 assert.equal(result.inventory.oilCylinder,1);assert.equal(result.inventory.gasCylinder,undefined);
 inv=result.inventory;result=fields.collect(gas,inv);assert.equal(result.ok,true);
 assert.equal(result.item,'gasCylinder');assert.equal(result.inventory.emptyCylinder,1);
 assert.equal(result.inventory.oilCylinder,1);assert.equal(result.inventory.gasCylinder,1);
 assert.equal(inv.gasCylinder,undefined,'the original inventory is not mutated');
 assert.equal(fields.collect(oil,{abyssPickaxe:1,emptyCylinder:0}).reason,'empty-cylinder-required');
});

test('sector deposits remain local, deterministic and within navigable sea water',()=>{
 const a=fields.streamNear('seabed-fixture',11500,geo.floorAt(11500)-170,2100);
 const b=fields.streamNear('seabed-fixture',11500,geo.floorAt(11500)-170,2100);
 assert.deepEqual(a,b);
 assert.ok(a.length>0,'deep seabed must have mineral-bearing outcrops');
 assert.ok(a.length<=64);
 assert.equal(new Set(a.map(n=>n.id)).size,a.length);
 for(const n of a){
  assert.ok(n.x>=0&&n.x<geo.WIDTH&&n.y>=0&&n.y<geo.HEIGHT,n.id);
  assert.equal(geo.isSolid(n.x,n.y,17),false,n.id);
  assert.ok(cfg.RESOURCES[n.type].kind==='ore'||cfg.RESOURCES[n.type].kind==='seep');
  assert.ok(n.id.startsWith('geo:'));
 }
 assert.deepEqual(fields.streamNear('seabed-fixture',11500,geo.floorAt(11500)-170,2100,new Set(a.map(n=>n.id))),[]);
});

test('minerals and seeps represent distinct physical settings, not generic rewards',()=>{
 for(const id of ['phosphorite','ferromanganeseCrust','polymetallicNodule','hydrothermalSulfide']){
  assert.equal(cfg.RESOURCES[id].kind,'ore',id);
 }
 assert.equal(cfg.RESOURCES.oilSeep.filled,'oilCylinder');
 assert.equal(cfg.RESOURCES.gasSeep.filled,'gasCylinder');
 assert.ok(fields.depthAt(15000)>fields.depthAt(2500));
});

test('inventory is exclusive to Mar Aberto and server rejects untrusted collection',()=>{
 const server=source('server.js'),runtime=source('public/abyssal-exploration-runtime.js');
 const ui=source('public/abyssal-inventory-ui.js'),html=source('public/index.html');
 assert.match(server,/room\.mode!=='open-sea'/);
 assert.match(server,/ResourceFields\.eligible\(node,p\.x,p\.y,inventory,125,tool\)/);
 assert.match(server,/ResourceFields\.eligible\(node,p\.x,p\.y,ResearchSystem\.sanitizeInventory\(u\.resourceInventory\|\|\{\}\),125,action\.tool\)/);
 assert.match(server,/ResourceFields\.collect\(pending\.node,current\)/);
 assert.match(runtime,/p\.mode==='open-sea'\?closest\(p\):null/);
 assert.match(ui,/event\.key\?\.toLowerCase\(\)==='i'/);
 assert.ok(html.indexOf('abyssal-inventory-ui.js')<html.indexOf('abyssal-exploration-runtime.js'));
});

test('mining UI is isolated to open sea and asynchronous callbacks cannot leak across game modes',()=>{
 const runtime=source('public/abyssal-exploration-runtime.js');
 assert.match(runtime,/if\(runKey!==expectedRun\)startRun\(p\)/,'returning from Fossas must start a fresh Mar Aberto session');
 assert.match(runtime,/if\(!c\|\|!p\|\|p\.mode!=='open-sea'\)return/,'world resources must not render inside Fossas');
 assert.match(runtime,/if\(!result\?\.ok\|\|runKey!==requestedRun\|\|cfg\(\)\?\.mode!=='open-sea'/,'obsolete online sector scans must be discarded');
 const gathering=source('public/abyssal-extraction-ui.js');
 assert.match(gathering,/if\(action!==a\)return/,'late extraction acknowledgements must not affect a new run');
 assert.match(gathering,/if\(drop!==d\)return/,'late collection acknowledgements must not affect a new run');
 assert.match(gathering,/if\(!begin\)\{action=null;bridge\.notify\('Extração online indisponível\.'/,'missing online extraction transport must abandon the pending action');
});
test('all geological deposits have their own visual silhouette in exploration',()=>{
 const runtime=source('public/abyssal-exploration-runtime.js');
 for(const kind of ['polymetallicNodule','ferromanganeseCrust','hydrothermalSulfide']){
  assert.ok(runtime.includes("type==='"+kind+"'"),kind+' needs a distinctive art branch');
 }
 for(const kind of ['oilSeep','gasSeep'])assert.ok(runtime.includes("type==='"+kind+"'"),kind);
});


test('resource markers use the authoritative game camera so deposits stay fused to world geometry',()=>{
 const runtime=source('public/abyssal-exploration-runtime.js'),game=source('public/game.js');
 assert.match(game,/cameraState:\(\)=>\(\{x:cameraX,y:cameraY,zoom:worldZoom,viewW,viewH\}\)/);
 assert.match(runtime,/AbyssalGameHooks\?\.cameraState\?\.\(\)/);
 assert.match(runtime,/Number\.isFinite\(camera\?\.x\)\?camera\.x/);
});


test('mined deposits animate only on collection and breakup stays in world coordinates',()=>{
 const runtime=source('public/abyssal-exploration-runtime.js');
 assert.match(runtime,/collectionFx\.push\(\{x:target\.x,y:target\.y,started:performance\.now\(\)/);
 const gather=source('public/abyssal-extraction-ui.js');
 assert.match(gather,/if\(a\.tool==='abyssPickaxe'\)bridge\.extractionBurst\?\.\(n\)/,'ore fractures only after confirmed extraction');
 assert.match(runtime,/const x=\(fx\.x-originX\)\*zoom,y=\(fx\.y-originY\)\*zoom/);
 assert.match(runtime,/nodes\.length===0&&collectionFx\.length===0/);
});


test('open sea resources render in world canvas instead of overlay UI',()=>{
 const runtime=source('public/abyssal-exploration-runtime.js');
 const game=source('public/game.js');
 assert.match(runtime,/window\.AbyssalExplorationWorldRender=drawWorldResources/);
 assert.match(game,/AbyssalExplorationWorldRender\?\.\(ctx,t/);
 assert.match(runtime,/markers\.hidden=true; \/\/ Resources render inside the game world canvas/);
});

test('open sea wildlife disables legacy shark wall dash',()=>{
 const ai=source('public/enemy-ai.js');
 const game=source('public/game.js');
 assert.match(ai,/options\.freeSwim !== true/);
 assert.match(game,/soloEnemyMovementOptions\.freeSwim=true/);
});
