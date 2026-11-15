'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('mobile cockpit keeps preview and catalog visible together; desktop remains scoped',()=>{
 const css=read('public/mobile-portrait.css');
 assert.match(css,/html\.abyssal-handheld/);
 assert.match(css,/grid-template-areas:"stage" "panel" "actions"/);
 assert.match(css,/grid-template-areas:"stage panel" "actions actions"/);
 assert.match(css,/\.aw-mobile-switch\{display:none!important\}/);
 assert.match(read('public/avatar-wardrobe.js'),/compact=!document\.documentElement\.classList\.contains\('abyssal-handheld'\)/);
 assert.match(read('public/abyssal-exploration-runtime.js'),/mobile-cockpit-back/);
 assert.equal(JSON.parse(read('public/manifest.webmanifest')).orientation,'any');
 assert.match(read('scripts/configure-android.cjs'),/android:screenOrientation="fullUser"/);
 assert.doesNotMatch(read('public/game.js'),/orientation\?\.lock\?\.\('portrait'\)/);
 assert.match(read('public/offline-sw.js'),/-v(?:237|238|239|240)/);
});
test('orientation controller permits portrait and landscape',()=>{
 const classes=new Set(),listeners={};
 const html={classList:{add:(...a)=>a.forEach(x=>classes.add(x)),remove:(...a)=>a.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},style:{setProperty(){},removeProperty(){}}};
 const document={documentElement:html,readyState:'complete',activeElement:null,addEventListener:(k,f)=>listeners[k]=f};
 const window={screen:{orientation:{type:'portrait-primary',unlock(){},addEventListener(){}}},innerWidth:390,innerHeight:844,addEventListener:(k,f)=>listeners[k]=f};
 vm.runInNewContext(read('public/mobile-portrait.js'),{window,document,navigator:{userAgent:'Android',maxTouchPoints:5},clearTimeout,setTimeout});
 assert.equal(window.AbyssalMobileOrientation.blocked,false);
 assert.ok(classes.has('abyssal-handheld'));
 window.screen.orientation.type='landscape-primary';window.innerWidth=844;window.innerHeight=390;listeners.resize();
 assert.equal(window.AbyssalMobileOrientation.portrait,false);
 assert.equal(window.AbyssalMobileOrientation.blocked,false);
 assert.ok(classes.has('abyssal-handheld-landscape'));
 assert.ok(!classes.has('abyssal-mobile-landscape'));
});
test('entry art warmup reuses deterministic raster art across dives without retaining terrain objects',()=>{
 const cave=require('../public/abyssal-solo-cavern.js');
 assert.deepEqual(cave.buildRocks(4800,3000),cave.buildRocks(4800,3000));
 let allocations=0;
 const oldDocument=global.document,oldIdle=global.requestIdleCallback;
 const ctx=new Proxy({}, {get:(_,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
 try{
  global.document={createElement(){allocations++;return {width:0,height:0,getContext:()=>ctx};}};
  global.requestIdleCallback=fn=>fn();
  cave.prepareWorldArt(4800,3000,1);
  assert.ok(allocations>0&&allocations<=6);
  const first=allocations;
  cave.prepareWorldArt(4800,3000,1);
  assert.equal(allocations,first);
 }finally{if(oldDocument===undefined)delete global.document;else global.document=oldDocument;if(oldIdle===undefined)delete global.requestIdleCallback;else global.requestIdleCallback=oldIdle;}
 const game=read('public/game.js');assert.match(game,/AbyssalLastDiveEntry/);assert.match(game,/prepareWorldArt/);
});
