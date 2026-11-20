const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/abyssal-horror-sprite-bridge.js'),'utf8');
test('Missing horror atlas leaves original renderer and shop art intact',async()=>{
  let originalCalls=0;
  const original={has:id=>id==='whiteShark',drawAtOrigin:()=>{originalCalls++;return true;},isBiting:()=>false,biteProgress:()=>-1,status:()=>({legacyReady:true})};
  const host={AbyssalAnimatedSprites:original,fetch:async()=>({ok:false})};
  vm.runInNewContext(source,{globalThis:host,Promise,Map,Set,Date,Object,Math});
  await Promise.resolve();
  assert.equal(host.AbyssalAnimatedSprites.has('whiteShark'),true);
  assert.equal(host.AbyssalAnimatedSprites.has('drifter'),false);
  assert.equal(host.AbyssalAnimatedSprites.drawAtOrigin({},'whiteShark',25,0,false),true);
  assert.equal(originalCalls,1);
});
test('Enabled manifest advertises species but falls back while images are loading',async()=>{
  const original={has:()=>false,drawAtOrigin:()=>false,isBiting:()=>false,biteProgress:()=>-1,status:()=>({})};
  const host={AbyssalAnimatedSprites:original,fetch:async()=>({ok:true,json:async()=>({enabled:true,columns:4,rows:4,frameWidth:420,frameHeight:320,creatures:['lurker']})})};
  vm.runInNewContext(source,{globalThis:host,Promise,Map,Set,Date,Object,Math});
  for(let i=0;i<4;i++)await Promise.resolve();
  assert.equal(host.AbyssalAnimatedSprites.has('lurker'),true);
  assert.equal(host.AbyssalAnimatedSprites.drawAtOrigin({},'lurker',25,0,false),false);
});
