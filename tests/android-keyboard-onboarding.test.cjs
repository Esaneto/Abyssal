'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const kb=require('../public/abyssal-keyboard-focus');
test('Android IME geometry uses the visual viewport, including offset and resizes',()=>{
 assert.deepEqual(kb.viewport({innerHeight:800,visualViewport:{height:365,offsetTop:0}},800),{top:0,bottom:365,height:365,keyboard:true});
 assert.deepEqual(kb.viewport({innerHeight:800,visualViewport:{height:350,offsetTop:24}},800),{top:24,bottom:374,height:350,keyboard:true});
 assert.equal(kb.viewport({innerHeight:800,visualViewport:{height:790,offsetTop:0}},800).keyboard,false);
 assert.equal(kb.distanceToVisible({top:520,bottom:555},{top:0,bottom:365,height:365},22),212);
 assert.equal(kb.distanceToVisible({top:125,bottom:150},{top:0,bottom:365,height:365},22),0);
});
test('focused redemption field is scrolled above keyboard and has safe preview fallback',()=>{
 const handlers={},viewHandlers={},classes=new Set(['abyssal-handheld']),vars=new Map(),children=[];
 let dock,frame=null,scroll=0;
 const html={classList:{contains:key=>classes.has(key),add:key=>classes.add(key),remove:key=>classes.delete(key)},style:{setProperty:(k,v)=>vars.set(k,v),removeProperty:k=>vars.delete(k)},clientHeight:800};
 const parent={scrollHeight:900,clientHeight:330,parentElement:null,scrollBy:({top})=>{scroll+=top;}};
 const field={type:'text',value:'ABYSSAL-TEST-123',id:'redeemCodeInput',name:'redeemCode',placeholder:'Digite seu código',disabled:false,readOnly:false,parentElement:parent,matches:()=>true, getAttribute:()=>null,
  getBoundingClientRect:()=>({top:555-scroll,bottom:600-scroll})};
 const doc={documentElement:html,activeElement:null,
  body:{appendChild:x=>{dock=x;}},
  createElement:tag=>({tag,children:[],hidden:false,append(...arr){this.children.push(...arr);},textContent:'',style:{}}),
  querySelectorAll:()=>[],
  addEventListener:(name,handler)=>{handlers[name]=handler;}
 };
 const vv={height:800,offsetTop:0,addEventListener:(name,handler)=>{viewHandlers[name]=handler;}};
 const win={innerHeight:800,visualViewport:vv,document:doc,addEventListener:()=>{},
  getComputedStyle:()=>({overflowY:'auto'}), requestAnimationFrame:cb=>{frame=cb;return 1;},
  setTimeout:()=>1,clearTimeout:()=>{}};
 assert.equal(kb.install({window:win,document:doc}),true);
 doc.activeElement=field;handlers.focusin({target:field});
 vv.height=345;viewHandlers.resize();frame();frame=null;
 assert.ok(classes.has('abyssal-ime-visible'));
 assert.equal(vars.get('--abyssal-ime-height'),'345px');
 assert.ok(scroll>0,'scrolls the original input into the visible space above IME');
 assert.ok(dock,'creates a fallback dock without moving the input');
 assert.equal(dock.hidden,true,'visible original input does not need duplicate preview');
 // An unscrollable field still has a readable presentation while the IME is up.
 parent.scrollHeight=330;scroll=0;field.getBoundingClientRect=()=>({top:620,bottom:660});
 viewHandlers.resize();frame();frame=null;
 assert.equal(dock.hidden,false);assert.equal(dock.children[1].textContent,'ABYSSAL-TEST-123');
 assert.equal(doc.activeElement,field,'no focus stealing from the original input');
});
test('first-run tutorial is modal, dimmed and has a visible directional cue until finished or skipped',()=>{
 const style=fs.readFileSync('public/abyssal-onboarding-spotlight.css','utf8');
 const tour=fs.readFileSync('public/abyssal-menu-tour.js','utf8');
 const guide=fs.readFileSync('public/abyssal-tutorials.js','utf8');
 assert.match(style,/#abyssalMenuTour \.amt-spot[^}]*box-shadow:0 0 0 9999px/s);
 assert.match(style,/rgba\(0,5,15,\.88\)/);
 assert.match(style,/\.amt-arrow/);
 assert.match(style,/#abyssalTutorialOverlay\.abyssal-guide-overlay/);
 assert.match(style,/#abyssalTutorialOverlay \.abyssal-guide-actions\{position:sticky/);
 assert.match(tour,/class="amt-arrow"/);
 assert.match(tour,/class="amt-instruction"/);
 assert.match(tour,/overlay\.hidden=true/);
 assert.match(tour,/\.amt-skip'\)\.onclick=close/);
 assert.match(guide,/guide\.hidden=false/);
 assert.match(guide,/guide\.hidden=true/);
});
test('all new keyboard and spotlight assets ship with mobile Android offline files',()=>{
 const html=fs.readFileSync('public/index.html','utf8'),sw=fs.readFileSync('public/offline-sw.js','utf8');
 const ci=fs.readFileSync('.github/workflows/ci.yml','utf8');
 for(const file of ['abyssal-keyboard-focus.js','abyssal-keyboard-focus.css','abyssal-onboarding-spotlight.css']){
  assert.ok(html.includes(file),file);
  assert.ok(sw.includes("'"+file+"'"),file);
 }
 assert.match(ci,/cmp public\/abyssal-keyboard-focus\.js android\/app\/src\/main\/assets\/public\/abyssal-keyboard-focus\.js/);
});
