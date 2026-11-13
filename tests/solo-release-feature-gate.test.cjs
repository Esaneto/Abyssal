'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../public/abyssal-feature-gates.js'),'utf8');
const smoke=fs.readFileSync(path.join(__dirname,'../scripts/browser-smoke.cjs'),'utf8');

function exercise({hostname='127.0.0.1',stage='sea',ci=false,kind='abyssal-start-open-sea'}={}){
 const handlers=new Map();
 let blocked=0;
 const notice={setAttribute(){},classList:{add(){},remove(){}},textContent:''};
 const document={
  readyState:'loading',
  getElementById:()=>null,
  createElement:()=>notice,
  body:{appendChild(){}},
  addEventListener(){}
 };
 const window={
  __ABYSSAL_CI_SMOKE__:ci,
  addEventListener(name,handler){handlers.set(name,handler);}
 };
 vm.runInNewContext(source,{window,document,location:{hostname,search:'?stage='+stage},
  URLSearchParams,setTimeout:()=>0,clearTimeout:()=>{}},{filename:'abyssal-feature-gates.js'});
 const handler=handlers.get(kind);
 assert.equal(typeof handler,'function');
 handler({stopImmediatePropagation(){blocked++;}});
 return {blocked,focus:window.AbyssalLaunchFocus};
}

test('unfinished Sea and Rift modes remain locked while classic Online is released',()=>{
 for(const [stage,kind] of [['sea','abyssal-start-open-sea'],['deep','abyssal-start-rift-solo'],['boss','abyssal-start-rift-solo']]){
  const result=exercise({stage,kind});
  assert.equal(result.blocked,1,stage+' may not bypass release lock on localhost');
  assert.equal(result.focus.isLocked(stage==='sea'?'sea':'rift'),true);
 }
});

test('legacy QA exception requires explicit smoke authorization and loopback hostname',()=>{
 const accepted=exercise({ci:true,stage:'deep',kind:'abyssal-start-rift-solo'});
 assert.equal(accepted.blocked,0);
 assert.equal(accepted.focus.soloOnly,false);
 assert.equal(accepted.focus.isLocked('online'),false);
 for(const hostname of ['abyssal.example','localhost','192.168.1.9']){
  assert.equal(exercise({hostname,ci:true,stage:'deep',kind:'abyssal-start-rift-solo'}).blocked,1,hostname);
 }
 assert.equal(exercise({ci:true,stage:'unknown'}).blocked,1);
});

test('browser acceptance keeps Solo coverage while legacy-only probes remain explicit',()=>{
 assert.match(smoke,/const legacyModes=process\.argv\.includes\('--legacy-modes'\)/);
 assert.match(smoke,/if\(legacyModes\)for\(const biome/);
 assert.match(smoke,/if\(legacyModes\)await realGameplaySmoke/);
 assert.match(smoke,/window\.__ABYSSAL_CI_SMOKE__=true/);
 assert.match(smoke,/\['solo-desktop',1280,720,null,null\]/);
 assert.match(smoke,/\['solo-mobile',390,844/);
});
