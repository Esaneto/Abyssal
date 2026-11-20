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
  await host.AbyssalAnimatedSprites.preloadHorror();
  assert.equal(host.AbyssalAnimatedSprites.has('lurker'),true);
  assert.equal(host.AbyssalAnimatedSprites.drawAtOrigin({},'lurker',25,0,false),false);
});

test('New atlas never replaces an unrelated Eco species, and attacks crossfade smoothly',async()=>{
  const originalDrawn=[];
  const original={
    has:id=>id==='reefshark',
    drawAtOrigin:(c,id)=>{originalDrawn.push(id);return true;},
    isBiting:()=>true,
    biteProgress:(state,t,attack)=>attack?(state?.progress??0.5):-1,
    status:()=>({})
  };
  class FakeImage{
    constructor(){this.naturalWidth=1680;this.naturalHeight=1280;this.key='';}
    set src(value){this.key=value;this.onload?.();}
  }
  const host={
    AbyssalAnimatedSprites:original,
    Image:FakeImage,
    performance:{now:()=>1200},
    fetch:async()=>({ok:true,json:async()=>({enabled:true,columns:4,rows:4,frameWidth:420,frameHeight:320,creatures:['whiteShark']})})
  };
  vm.runInNewContext(source,{globalThis:host,Promise,Map,Set,Date,Object,Math});
  const atlas=host.AbyssalAnimatedSprites;
  await atlas.preloadHorror();
  assert.equal(atlas.has('reefshark'),true);
  assert.equal(atlas.drawAtOrigin({},'reefshark',20,100,false),true);
  assert.deepEqual(originalDrawn,['reefshark']);
  const calls=[];
  const canvas={save(){},restore(){},drawImage(image){calls.push(image.key);}};
  atlas.drawAtOrigin(canvas,'whiteShark',20,150,true,0,{progress:.5});
  for(let i=0;i<8;i++)await Promise.resolve();
  calls.length=0;
  assert.equal(atlas.drawAtOrigin(canvas,'whiteShark',20,150,true,0,{progress:.08}),true);
  assert.ok(calls.some(x=>x.endsWith('/swim.webp')),'The swim pose must still appear at attack onset');
  assert.ok(calls.some(x=>x.endsWith('/attack.webp')),'The attack pose must start fading in');
  calls.length=0;
  atlas.drawAtOrigin(canvas,'whiteShark',20,150,true,0,{progress:.5});
  assert.ok(calls.length>0&&calls.every(x=>x.endsWith('/attack.webp')),'Only attack poses at peak');
  calls.length=0;
  atlas.drawAtOrigin(canvas,'whiteShark',20,150,false,0,{progress:.8});
  assert.ok(calls.length>0&&calls.every(x=>x.endsWith('/swim.webp')),'Return to swim with no phantom bite');
});
