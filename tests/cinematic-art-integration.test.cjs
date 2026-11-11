'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const art=require('../public/abyssal-cinematic-art.js');
const geo=require('../public/abyssal-ocean-geography.js');
const canvas=()=>new Proxy({},{
 get(o,k){
  if(k in o)return o[k];
  if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop(){}});
  return ()=>{};
 },
 set(o,k,v){o[k]=v;return true;}
});
test('cinematic lighting has viewport-bounded scenes and does not mutate gameplay geometry',()=>{
 const c=canvas(),before=geo.ROCKS.length;
 assert.doesNotThrow(()=>art.cabinBackdrop(c,1000));
 assert.doesNotThrow(()=>art.cabinForeground(c,1200));
 assert.doesNotThrow(()=>art.cabinInterior(c,1500));
 assert.doesNotThrow(()=>art.cabinLiveWorld(c,1700,{draw(){}},'female'));
 assert.doesNotThrow(()=>art.seaAtmosphere(c,{left:0,top:0,width:1280,height:720},1800,false,geo));
 assert.doesNotThrow(()=>art.seaHighlights(c,{left:0,top:0,width:1280,height:720},1800,false,geo));
 assert.doesNotThrow(()=>art.seaAtmosphere(c,{left:23000,top:17000,width:400,height:500},1800,true,geo));
 assert.equal(geo.ROCKS.length,before);
});
test('paint passes are connected to the live cockpit, Open Sea and asset cache versions',()=>{
 const cabin=read('public/abyssal-submarine-cockpit.js');
 const ocean=read('public/abyssal-open-sea-render.js');
 const html=read('public/index.html');
 assert.match(cabin,/AbyssalCinematicArt\?\.cabinBackdrop/);
 assert.match(cabin,/AbyssalCinematicArt\?\.cabinForeground/);
 assert.match(cabin,/AbyssalCinematicArt\?\.cabinInterior/);
 assert.match(cabin,/AbyssalCinematicArt\?\.cabinLiveWorld/);
 assert.match(ocean,/AbyssalCinematicArt\?\.seaAtmosphere/);
 assert.match(ocean,/AbyssalCinematicArt\?\.seaHighlights/);
 assert.ok(html.indexOf('abyssal-cinematic-art.js')<html.indexOf('abyssal-open-sea-render.js'));
 assert.ok(html.indexOf('abyssal-cinematic-art.js')<html.indexOf('abyssal-submarine-cockpit.js'));
});
