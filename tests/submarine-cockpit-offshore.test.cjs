'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const config=require('../public/abyssal-exploration-config.js');
const research=require('../public/abyssal-research-system.js');
const offshore=require('../public/abyssal-offshore-system.js');

test('platform tech tree can be reached using only actual Mar Aberto deposits',()=>{
 const present=new Set(['seaMineral','phosphorite','ferromanganeseCrust','polymetallicNodule','hydrothermalSulfide']);
 for(const [id,definition] of Object.entries(config.RESEARCH)){
  for(const item of Object.keys(definition.cost||{}))assert.ok(present.has(item),id+' requires unavailable '+item);
 }
 let levels=research.sanitizeLevels(),inventory=research.sanitizeInventory({
  seaMineral:1000,phosphorite:1000,ferromanganeseCrust:1000,polymetallicNodule:1000,hydrothermalSulfide:1000
 });
 for(const id of ['sampler','sonar','pressureSuit','offshoreSurvey','offshorePlatform','subseaUmbilical']){
  const transaction=research.study(id,levels,inventory);
  assert.equal(transaction.ok,true,id+' should be researched with collected deposits');
  levels=transaction.levels;inventory=transaction.inventory;
 }
 assert.equal(levels.offshorePlatform,1);
 assert.equal(levels.subseaUmbilical,1);
});

test('FPSO line must be acquired, attached to real well, then brought back',()=>{
 const levels={offshoreSurvey:1,offshorePlatform:1,subseaUmbilical:2};
 const ship={x:520,y:95},well={id:'well-a',type:'oilSeep',x:4100,y:3800};
 let state=offshore.normalize({},1000);
 let result=offshore.transition(state,levels,'start',{x:3000,y:400},null,1000);
 assert.equal(result.ok,false);
 result=offshore.transition(state,levels,'start',ship,null,1000);
 assert.equal(result.ok,true);
 state=result.state;
 result=offshore.transition(state,levels,'finish',ship,null,1500);
 assert.equal(result.ok,false);
 result=offshore.transition(state,levels,'connect',{x:4100,y:3800},well,2000);
 assert.equal(result.ok,true);
 state=result.state;
 result=offshore.transition(state,levels,'finish',ship,null,3000);
 assert.equal(result.ok,true);
 state=result.state;
 assert.equal(state.connections.length,1);
 assert.equal(state.installation,null);
 assert.equal(offshore.transition(state,levels,'start',ship,null,4000).ok,true);
 const oneMinute=offshore.accrue(state,levels,63000);
 assert.ok(Math.abs(oneMinute.oil-1.5)<.000001);
 assert.equal(oneMinute.gas,0);
});

test('different reservoirs yield independent oil/gas and tanks cannot overflow',()=>{
 const levels={offshoreSurvey:1,offshorePlatform:1,subseaUmbilical:3};
 let state={oil:0,gas:0,lastAt:1000,connections:[
  {id:'o',type:'oilSeep',x:4400,y:2000},{id:'g',type:'gasSeep',x:8000,y:4000}
 ]};
 state=offshore.accrue(state,levels,61000);
 assert.ok(Math.abs(state.oil-1.5)<.000001);
 assert.ok(Math.abs(state.gas-2.1)<.000001);
 state=offshore.accrue(state,levels,10**9);
 assert.equal(state.oil,offshore.capacity(levels));
 assert.equal(state.gas,offshore.capacity(levels));
 assert.equal(offshore.rates(state,{offshorePlatform:0,subseaUmbilical:3}).gas,0);
});

test('duplicate wellheads and unresearched extraction are rejected',()=>{
 const player={x:520,y:95},well={id:'w1',type:'gasSeep',x:2000,y:3400};
 assert.equal(offshore.transition({}, {},'start',player,null,100).ok,false);
 const levels={offshoreSurvey:1,offshorePlatform:1,subseaUmbilical:1};
 let r=offshore.transition({},levels,'start',player,null,100);
 assert.equal(r.ok,true);
 r=offshore.transition(r.state,levels,'connect',{x:2000,y:3400},well,200);
 assert.equal(r.ok,true);
 r=offshore.transition(r.state,levels,'finish',player,null,300);
 assert.equal(r.ok,true);
 const connected=r.state;
 assert.equal(offshore.transition(connected,levels,'start',player,null,400).ok,false);
 const cloned={...connected,installation:{phase:'laying',startedAt:450}};
 assert.equal(offshore.transition(cloned,{...levels,subseaUmbilical:2},'connect',{x:2000,y:3400},well,500).ok,false);
});

test('authoritative server validates offshore mode, tools and real reservoir IDs',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 assert.match(server,/socket\.on\('exploration-offshore-action'/);
 assert.match(server,/room\?\.mode!=='open-sea'/);
 assert.match(server,/resourceInventory\?\.offshoreCable/);
 assert.match(server,/nodesForWorld\(room,p\.x,p\.y,190\)/);
 assert.match(server,/OffshoreSystem\.transition\(/);
 assert.match(server,/u\.offshoreProduction=result\.state;saveUsers\(\)/);
 assert.match(server,/id==='subseaUmbilical'/);
});

test('cockpit renders a coherent original structural scene and animated water',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../public/abyssal-submarine-cockpit.js'),'utf8');
 const calls={count:0};
 const gradient={addColorStop(){}};
 const ctx=new Proxy({},{get(o,k){
  if(k in o)return o[k];
  if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>gradient;
  return (...args)=>{calls.count++;};
 },set(o,k,v){o[k]=v;return true;}});
 const element={hidden:false,width:0,height:0,getContext:()=>ctx,
  getBoundingClientRect:()=>({width:1440,height:900})};
 const screen={hidden:false};
 const win={AbyssalDiverGender:'female',addEventListener(){},AbyssalOnline:{getAccount:()=>null}};
 const queue=new Map();let next=0;
 const sandbox={
  document:{getElementById:id=>id==='submarineWorkshop'?screen:id==='abyssCockpitCanvas'?element:null},
  window:win,requestAnimationFrame:callback=>{const id=++next;queue.set(id,callback);return id;},
  cancelAnimationFrame:id=>queue.delete(id)
 };
 vm.runInNewContext(src,sandbox);
 assert.ok(win.AbyssalSubmarineCockpit?.open);
 win.AbyssalSubmarineCockpit.open();
 const item=[...queue.entries()][0];queue.delete(item[0]);item[1](110);
 assert.ok(calls.count>50,'cockpit should paint multiple layers');
 assert.ok(element.width>0&&element.height>0,'canvas should be sized');
 assert.equal(win.AbyssalSubmarineCockpit.visualStatus().bitmapBackdrop,false);
 win.AbyssalDiverGender='male';
 const item2=[...queue.entries()][0];queue.delete(item2[0]);item2[1](220);
 assert.ok(calls.count>100);
 win.AbyssalSubmarineCockpit.close();
 assert.equal(queue.size,0);
});

test('lab can only open after return-to-hatch animation',()=>{
 const menu=fs.readFileSync(path.join(__dirname,'../public/abyssal-menu-ocean.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 assert.match(menu,/kind:'lab'/);
 assert.match(menu,/s\.kind==='lab'\?1\.28/);
 assert.match(menu,/s\.kind==='lab'\)\{diver\.style\.opacity='0';return;/);
 assert.match(html,/id="abyssCockpitCanvas"/);
 assert.match(html,/id="submarineWorkshopBtn"/);
 assert.match(html,/LABORATÓRIO/);
});

test('offshore production funds real research with atomic stock deductions',()=>{
 const levels=research.sanitizeLevels({
  offshoreSurvey:1,offshorePlatform:1,subseaUmbilical:2,oilProcessing:1,gasProcessing:1
 });
 const inventory=research.sanitizeInventory({
  seaMineral:400,phosphorite:400,ferromanganeseCrust:400,
  polymetallicNodule:400,hydrothermalSulfide:400
 });
 const stock=offshore.accrue({oil:100,gas:100,lastAt:1000,connections:[
  {id:'oil-1',type:'oilSeep',x:3300,y:3000},
  {id:'gas-1',type:'gasSeep',x:5400,y:4400}
 ]},levels,1000);
 const upgrade=research.study('offshoreStorage',levels,inventory,stock);
 assert.equal(upgrade.ok,true);
 assert.deepEqual(upgrade.offshoreCost,{oil:24,gas:18});
 assert.equal(upgrade.offshore.oil,76);
 assert.equal(upgrade.offshore.gas,82);
 assert.equal(upgrade.levels.offshoreStorage,1);
 assert.equal(offshore.capacity(upgrade.levels)-offshore.capacity(levels),250);
 assert.ok(offshore.rates(stock,{...levels,oilProcessing:2}).oil>offshore.rates(stock,levels).oil);
 assert.ok(offshore.rates(stock,{...levels,gasProcessing:2}).gas>offshore.rates(stock,levels).gas);
 const denied=research.study('offshoreStorage',levels,inventory,{...stock,oil:0,gas:0});
 assert.equal(denied.ok,false);
 assert.equal(denied.reason,'offshore-resources');
});

test('online world and HUD always use account-owned offshore connections',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/abyssal-exploration-runtime.js'),'utf8');
 assert.match(source,/function currentOffshore\(now=Date\.now\(\)\)/);
 assert.match(source,/account\?\.offshoreProduction\|\|\{oil:0,gas:0,lastAt:now,connections:\[\],installation:null\}/);
 assert.match(source,/installation:\(\)=>currentOffshore\(\)\.installation/);
 assert.match(source,/isConnected:id=>currentOffshore\(\)\.connections\.some/);
 assert.match(source,/currentOffshore\(\)\.connections\.some\(l=>l\.id===String\(near\.id\)\)/);
 assert.match(source,/const levels=stateLevels\(\),offshore=currentOffshore\(\)/);
});

test('FPSO resource spending is validated by the server and shown in cockpit controls',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const cockpit=fs.readFileSync(path.join(__dirname,'../public/abyssal-exploration-runtime.js'),'utf8');
 assert.match(server,/ResearchSystem\.study\(id,levels,u\.resourceInventory\|\|\{\},offshoreBalance\)/);
 assert.match(server,/if\(result\.offshore\)u\.offshoreProduction=result\.offshore/);
 assert.match(cockpit,/offshoreCostFor\?\.\(id,level\)/);
 assert.match(cockpit,/if\(result\.offshore\)offshore=result\.offshore/);
 assert.match(cockpit,/localResearchMode\(\)/);
});
