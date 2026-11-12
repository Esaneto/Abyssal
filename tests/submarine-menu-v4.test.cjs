'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=(name)=>fs.readFileSync(name,'utf8');
const scenery=require('../public/ocean-menu-scenery.js');

test('submarine main screen has just three gameplay destinations and keeps utility actions',()=>{
 const html=read('public/index.html');
 for(const id of ['playBtn','onlineBtn','riftPortalBtn','resonanceBtn','wheelBtn','profileBtn','shopBtn']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' must remain unique');
 }
 const stage=html.slice(html.indexOf('id="menuOceanStage"'),html.indexOf('id="menuOceanMobilePad"'));
 for(const id of ['playBtn','onlineBtn','riftPortalBtn'])assert.match(stage,new RegExp('id="'+id+'"'));
 for(const id of ['resonanceBtn','wheelBtn','profileBtn','shopBtn'])assert.doesNotMatch(stage,new RegExp('id="'+id+'"'));
 assert.match(html,/id="menuOceanSubmarine"/);
});

test('solo and online are the left and right currents; Fossas stays at the seabed',()=>{
 const js=read('public/abyssal-menu-ocean.js');
 assert.match(js,/id:'playBtn',x:\.19,y:\.47/);
 assert.match(js,/id:'onlineBtn',x:\.81,y:\.47/);
 assert.match(js,/id:'riftPortalBtn',x:\.50,y:\.835/);
 assert.match(js,/menu\.classList\.add\('submarine-menu'\)/);
 assert.match(js,/function playEntrance\(s\)/);
 assert.match(js,/transition=\{station:s/);
 assert.match(js,/s\.button\.dataset\.portalArriving='1'/);
 assert.match(js,/s\.button\.click\(\)/);
});

test('player drops from the open submarine hatch with bubble bursts and returns after modal cancellation',()=>{
 const js=read('public/abyssal-menu-ocean.js');
 const rebuild=read('public/abyssal-rebuild.js');
 assert.match(js,/const hatch=\(\)=>/);
 assert.match(js,/emergence=Math\.min\(1,emergence\+step\)/);
 assert.match(js,/for\(let n=0;n<4;n\+\+\)bubble\(px,py\+17,true\)/);
 assert.match(js,/function resetToHatch\(\)/);
 assert.match(js,/window\.addEventListener\('abyssal-modal-closed'/);
 assert.match(js,/window\.addEventListener\('abyssal-menu-portal-cancelled'/);
 assert.match(rebuild,/abyssal-menu-portal-cancelled/);
 assert.match(rebuild,/close\(false\);updateDepthMeter\(0\)/);
});

test('scenery supports yellow metal submarine and black open hatch in responsive sizes',()=>{
 assert.equal(typeof scenery.drawSubmarine,'function');
 const methods=[];
 const gradient={addColorStop(offset){assert.ok(offset>=0&&offset<=1)}};
 const c=new Proxy({},{
  get(target,key){
   if(key==='createLinearGradient'||key==='createRadialGradient')return()=>gradient;
   return(...args)=>{methods.push(String(key))};
  },
  set(){return true}
 });
 const canvas={getContext:()=>c,style:{}};
 for(const [w,h] of [[340,240],[768,410],[1440,760]]){
  assert.doesNotThrow(()=>scenery.drawSubmarine(canvas,w,h));
  assert.ok(canvas.width>0&&canvas.height>0);
 }
 assert.ok(methods.includes('ellipse'),'submarine body and hatch should be illustrated');
 const raw=read('public/ocean-menu-scenery.js');
 assert.match(raw,/#e9b943/);
 assert.match(raw,/#070c12/);
});

test('bottom utilities preserve clear identities while laboratory capsules replace wood visuals',()=>{
 const css=read('public/abyssal-menu-v2.css');
 const sw=read('public/offline-sw.js');
 const lab=read('public/abyssal-lab-menu.css');
 assert.match(lab,/#shopScreen #skinGrid \.skin-card \.skin-preview::before/);
 assert.match(lab,/#menuScreen\.ocean-menu-v2\.submarine-menu \.abyss-destination\.abyss-current-entry::before/);
 assert.match(sw,/'abyssal-lab-menu\.css'/);
 assert.match(css,/\.submarine-menu #resonanceBtn/);
 assert.match(css,/\.submarine-menu #wheelBtn/);
 assert.match(css,/\.submarine-menu #profileBtn/);
 assert.match(css,/\.submarine-menu #shopBtn/);
 assert.match(css,/#shopScreen #skinGrid \.skin-card/);
 assert.match(sw,/'abyssal-wood-tentacles\.svg'/);
 assert.match(css,/\.submarine-menu \.abyss-ocean-utilities/);
});

test('mobile menu scale fits short landscapes and preserves desktop geometry',()=>{
 for(const [w,h] of [[340,240],[768,410],[850,220],[960,300],[1440,760]]){
  const base=Math.min(1.2,Math.max(.59,w/800));
  assert.equal(scenery.menuSubmarineScale(w,h,false),base);
  const mobile=scenery.menuSubmarineScale(w,h,true);
  assert.ok(mobile>0&&mobile<=base*.75);
  assert.ok(mobile*210<h*.40);
 }
 const js=read('public/abyssal-menu-ocean.js');
 assert.match(js,/y:210\*subScale/);
 assert.match(js,/drawSubmarine\?\.\(submarine,w,h,subScale\)/);
 assert.match(js,/mobileScene=mobileQuery\.matches/);
 const css=read('public/abyssal-menu-v2.css');
 assert.match(css,/abyss-mobile-zoom #submarineWorkshopBtn[\s\S]*?min-width:44px!important;min-height:44px!important/);
});
