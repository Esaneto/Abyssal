'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('main-menu hatch is always named CABINE and opens the laboratory visor',()=>{
 const html=read('public/index.html');
 const menu=read('public/abyssal-menu-ocean.js');
 const runtime=read('public/abyssal-exploration-runtime.js');
 assert.match(html,/id="submarineWorkshopBtn"[^>]*aria-label="Entrar na cabine do submarino"[^>]*><span class="abyss-hatch-label">CABINE<\/span>/);
 assert.doesNotMatch(html,/abyss-hatch-label">LABORATÓRIO/);
 assert.match(html,/class="abyss-cockpit-brand"/);
 assert.match(html,/SUBMARINO DE EXPLORAÇÃO/);
 assert.match(menu,/id:'submarineWorkshopBtn'.*label:'CABINE'.*kind:'lab'/);
 assert.match(runtime,/activeConsoleSection='solo';workshop\.hidden=false;renderWorkshop\(\)/);
});

test('seven clickable hardware controls update a single integrated cockpit visor',()=>{
 const source=read('public/abyssal-exploration-runtime.js');
 const style=read('public/abyssal-submarine-laboratory.css');
 const html=read('public/index.html');
 for(const id of ['solo','laboratory','minerals','shop','specimens','sea','rift'])
  assert.match(source,new RegExp("id:'"+id+"'"),id+' must be present on the console');
 assert.match(source,/function mountCockpitConsole\(utility\)/);
 assert.match(source,/workshopGrid\.replaceChildren\(visor,keys\)/);
 assert.match(source,/key\.setAttribute\('aria-pressed'/);
 assert.match(source,/activeConsoleSection=option\.id;renderWorkshop\(\)/);
 assert.match(style,/\.abyss-control-key\.is-active/);
 assert.match(style,/\.abyss-cockpit-visor/);
 assert.match(style,/\.abyss-visor-body/);
 assert.match(style,/@media\(max-width:700px\)/);
 assert.match(html,/class="abyss-cockpit-ticker"/);
 assert.ok(html.indexOf('abyssal-resource-icons.js')<html.indexOf('abyssal-exploration-runtime.js'));
 assert.ok(html.indexOf('abyssal-resource-icons.js')<html.indexOf('abyssal-inventory-ui.js'));
});

test('research mineral requirements and inventory use the same original illustrations',()=>{
 const source=read('public/abyssal-exploration-runtime.js');
 const inventory=read('public/abyssal-inventory-ui.js');
 const artwork=require('../public/abyssal-resource-icons.js');
 for(const mineral of ['polymetallicNodule','ferromanganeseCrust','phosphorite','hydrothermalSulfide','oilSeep','gasSeep','abyssPickaxe']){
  assert.equal(artwork.has(mineral),true,mineral);
  assert.match(artwork.svg(mineral),/<svg.*<\/svg>/s);
 }
 assert.match(source,/className='abyss-mineral-requirements'/);
 assert.match(source,/className='abyss-requirement'/);
 assert.match(source,/AbyssalResourceIcons\?\.svg\?\.\(id\)/);
 assert.match(inventory,/AbyssalResourceIcons\?\.has\?\.\(id\)/);
 assert.match(read('public/diver-art.js'),/voxel-inspired miner tool/);
});

test('the command bridge paints structural geometry and moving sea fauna',()=>{
 const source=read('public/abyssal-submarine-cockpit.js');
 const calls={n:0};
 const ctx=new Proxy({},{
  get(target,name){
   if(name in target)return target[name];
   if(name==='createLinearGradient'||name==='createRadialGradient')return ()=>({addColorStop(){}});
   return ()=>{calls.n++;};
  },set(target,name,value){target[name]=value;return true;}
 });
 const canvas={width:0,height:0,getContext:()=>ctx,getBoundingClientRect:()=>({width:1440,height:900})};
 const screen={hidden:false};const callbacks=new Map();
 const win={AbyssalDiverGender:'female',devicePixelRatio:1,addEventListener(){},AbyssalOnline:{getAccount:()=>null}};
 let next=0;
 const scope={document:{getElementById:id=>id==='submarineWorkshop'?screen:id==='abyssCockpitCanvas'?canvas:null},
  window:win,requestAnimationFrame:fn=>{callbacks.set(++next,fn);return next;},cancelAnimationFrame:n=>callbacks.delete(n)};
 vm.runInNewContext(source,scope,{filename:'abyssal-submarine-cockpit.js'});
 win.AbyssalSubmarineCockpit.open();
 const a=[...callbacks.entries()][0];callbacks.delete(a[0]);assert.doesNotThrow(()=>a[1](100));
 const femaleCalls=calls.n;
 assert.ok(femaleCalls>150,'scene should include structural and animated details');
 const status=win.AbyssalSubmarineCockpit.visualStatus();assert.equal(status.original,true);assert.equal(status.bitmapBackdrop,false);assert.equal(status.liveOcean,true);assert.ok(status.frames>=2);
 win.AbyssalDiverGender='male';
 const b=[...callbacks.entries()][0];callbacks.delete(b[0]);assert.doesNotThrow(()=>b[1](200));
 assert.ok(calls.n>femaleCalls);
 win.AbyssalSubmarineCockpit.close();
 assert.equal(callbacks.size,0);
});
