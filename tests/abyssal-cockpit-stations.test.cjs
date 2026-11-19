'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('cockpit station files are connected to production and offline shell',()=>{
 const html=read('public/index.html'),worker=read('public/offline-sw.js'),css=read('public/abyssal-cockpit-stations.css');
 for(const file of ['abyssal-cockpit-navigation.js','abyssal-cockpit-stations.css']){
  assert.match(html,new RegExp(file.replaceAll('.','\\.')));
  assert.ok(worker.includes("'"+file+"'"),file+' must be offline cached');
 }
 assert.match(html,/ARSENAL DE ECOS/);
 assert.doesNotMatch(html,/CATÁLOGO DE ESPÉCIMES/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/\[data-station="arsenal"\]/);
 assert.match(css,/\bscale\(1\.04\)/);
});
test('rendered cockpit has no replaced legacy controller script',()=>{
 const html=read('public/index.html');
 assert.doesNotMatch(html,/<script[^>]*src="abyssal-menu-interactions\.js/);
 assert.match(html,/id="submarineWorkshopGrid"/);
 assert.match(html,/id="abyssCockpitCanvas"/);
 const js=read('public/abyssal-cockpit-navigation.js');
 assert.match(js,/function restoreAll\(/);
 assert.match(js,/function routeScreen\(/);
 assert.match(js,/connectAndJoin\?\./);
 assert.doesNotMatch(js,/\.innerHTML\s*=\s*[^;]*(?:localStorage|nickname)/);
 new vm.Script(js,{filename:'abyssal-cockpit-navigation.js'});
 new vm.Script(read('public/abyssal-menu-tour.js'),{filename:'abyssal-menu-tour.js'});
});
test('cockpit controller initializes five stations and restores embedded pages',()=>{
 class Node{
  constructor(tag='div'){
   this.tagName=tag.toUpperCase();
   this.children=[];this.parentNode=null;this.dataset={};this.hidden=false;this.scrollTop=0;
   this.offsetLeft=0;this.offsetWidth=110;this.clientWidth=400;this.attributes={};this.listeners={};
   const set=new Set();this.classList={add:(...x)=>x.forEach(v=>set.add(v)),remove:(...x)=>x.forEach(v=>set.delete(v)),contains:v=>set.has(v),toggle:(v,on)=>on?set.add(v):set.delete(v)};
   this.style={setProperty(){}};
  }
  append(...nodes){for(const n of nodes){n.remove();n.parentNode=this;this.children.push(n)}return this}
  remove(){if(this.parentNode){const a=this.parentNode.children;const i=a.indexOf(this);if(i>=0)a.splice(i,1)}this.parentNode=null}
  replaceChildren(...nodes){for(const n of [...this.children])n.remove();this.append(...nodes)}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='hidden')this.hidden=true}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}
  click(){for(const fn of this.listeners.click||[])fn({target:this})}
  focus(){}
  scrollTo(){}
  closest(){return null}
  get isConnected(){return Boolean(this.parentNode)||this===nodes.submarineWorkshop}
  get nextSibling(){if(!this.parentNode)return null;return this.parentNode.children[this.parentNode.children.indexOf(this)+1]||null}
 }
 const nodes={submarineWorkshop:new Node(),submarineWorkshopGrid:new Node(),menuScreen:new Node()};
 nodes.submarineWorkshop.hidden=true;
 nodes.submarineWorkshopGrid.parentNode=nodes.submarineWorkshop;
 for(const id of ['submarineWorkshopBtn','submarineWorkshopClose','cockpitWheelBtn','cockpitProfileBtn','cockpitRankingBtn','cockpitCardumesBtn','shopScreen','shopBtn']){
  nodes[id]=new Node('button');
 }
 nodes.menuScreen.hidden=false;
 const doc={body:new Node('body'),createElement:t=>new Node(t),getElementById:id=>nodes[id]||null};
 const window={addEventListener(){},AbyssalSubmarineCockpit:{open(){},close(){}},AbyssalRevealStartup(){},dispatchEvent(){}};
 const ctx={window,document:doc,matchMedia:()=>({matches:false}),CustomEvent:class{constructor(type,data){this.type=type;this.detail=data.detail}},queueMicrotask:fn=>fn()};
 vm.runInNewContext(read('public/abyssal-cockpit-navigation.js'),ctx);
 const nav=window.AbyssalCockpitNavigation;
 assert.equal(nav.stations.length,5);
 assert.deepEqual(Array.from(nav.stations,x=>x.id),['social','cabine','laboratorio','arsenal','perfil']);
 nav.open();
 assert.equal(nodes.submarineWorkshop.hidden,false);
 assert.equal(nodes.menuScreen.hidden,true);
 nav.select('arsenal');
 assert.equal(nodes.submarineWorkshop.dataset.station,'arsenal');
 nodes.shopScreen.hidden=true;
 // Embedded navigation is limited to actually open screens. Login guards remain in original click handlers.
 const parent=new Node('div');doc.body.append(parent);parent.append(nodes.shopScreen);
 assert.equal(nav.routeScreen('shopScreen'),false);
 assert.equal(nodes.shopScreen.classList.contains('abyss-cockpit-embedded'),true);
 assert.equal(nav.isEmbedded('shopScreen'),true);
 nav.back();
 assert.equal(nodes.shopScreen.parentNode,parent);
 assert.equal(nav.isEmbedded('shopScreen'),false);
 nav.showExterior();
 assert.equal(nodes.submarineWorkshop.hidden,true);
 assert.equal(nodes.menuScreen.hidden,false);
});
