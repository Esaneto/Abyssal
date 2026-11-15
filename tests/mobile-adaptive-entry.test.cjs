'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('mobile cockpit keeps preview and catalog visible together; desktop remains scoped',()=>{
 const css=read('public/mobile-portrait.css');
 assert.match(css,/html\.abyssal-handheld/);
 const wardrobe=read('public/avatar-wardrobe.css');
 assert.match(wardrobe,/grid-template-areas:"stage stage" "nav panel" "actions actions"/);
 assert.match(wardrobe,/grid-template-areas:"nav stage panel" "actions actions actions"/);
 assert.doesNotMatch(css,/aw-mobile-switch|aw-mobile-catalog/);
 assert.match(read('public/avatar-wardrobe.js'),/page\.append\(groupsRow,stage,panel,actions\)/);
 assert.match(read('public/abyssal-exploration-runtime.js'),/mobile-cockpit-back/);
 assert.equal(JSON.parse(read('public/manifest.webmanifest')).orientation,'any');
 assert.match(read('scripts/configure-android.cjs'),/android:screenOrientation="fullUser"/);
 assert.doesNotMatch(read('public/game.js'),/orientation\?\.lock\?\.\('portrait'\)/);
 assert.doesNotMatch(read('public/style.css'),/body\.mobile-game-active #gameShell>\*\{visibility:hidden!important\}/);
 assert.match(read('public/offline-sw.js'),/const VERSION = '[^']+-v\d+';/);
});
test('orientation controller permits portrait and landscape',()=>{
 const classes=new Set(),listeners={};
 const html={classList:{add:(...a)=>a.forEach(x=>classes.add(x)),remove:(...a)=>a.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},style:{setProperty(){},removeProperty(){}}};
 const document={documentElement:html,readyState:'complete',activeElement:null,querySelector:()=>null,addEventListener:(k,f)=>listeners[k]=f};
 const window={screen:{orientation:{type:'portrait-primary',unlock(){},addEventListener(){}}},innerWidth:390,innerHeight:844,dispatchEvent(){},addEventListener:(k,f)=>listeners[k]=f};
 vm.runInNewContext(read('public/mobile-portrait.js'),{window,document,navigator:{userAgent:'Android',maxTouchPoints:5},clearTimeout,setTimeout,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
 assert.equal(window.AbyssalMobileOrientation.blocked,false);
 assert.ok(classes.has('abyssal-handheld'));
 window.screen.orientation.type='landscape-primary';window.innerWidth=844;window.innerHeight=390;listeners.resize();
 assert.equal(window.AbyssalMobileOrientation.portrait,false);
 assert.equal(window.AbyssalMobileOrientation.blocked,false);
 assert.ok(classes.has('abyssal-handheld-landscape'));
 assert.ok(!classes.has('abyssal-mobile-landscape'));
 window.innerWidth=390;window.innerHeight=844;listeners.resize();assert.equal(window.AbyssalMobileOrientation.portrait,true);assert.ok(!classes.has('abyssal-handheld-landscape'));
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
