'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('offline install precaches the exact versioned assets referenced by the current game',async()=>{
 const sw=fs.readFileSync(path.join(__dirname,'../public/offline-sw.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const callbacks={};let cachedURLs=[],cachedIndex=false;
 const response={ok:true,type:'basic',text:async()=>html,clone(){return this;}};
 const cache={
  async addAll(urls){cachedURLs=Array.from(urls);},
  async match(url){return cachedURLs.includes(String(url?.url||url))?response:null;},
  async put(url){if(String(url?.url||url)==='https://abyssal.example/index.html')cachedIndex=true;}
 };
 const self={
  registration:{scope:'https://abyssal.example/'},
  location:{origin:'https://abyssal.example'},
  addEventListener:(type,callback)=>{callbacks[type]=callback;},
  skipWaiting:async()=>{}
 };
 const context={self,URL,Request,fetch:async()=>response,caches:{open:async()=>cache}};
 vm.runInNewContext(sw,context,{filename:'offline-sw.js'});
 let pending=null;
 callbacks.install({waitUntil:task=>{pending=task;}});
 await pending;
 assert.equal(cachedIndex,true,'offline navigation HTML must be cached');
 for(const match of html.matchAll(/(?:src|href)="([^"]+[?]v=[^"]+)"/g)){
  const expected=new URL(match[1],self.registration.scope);
  if(expected.origin!==self.location.origin)continue;
  if(!/[.](?:css|js)$/.test(expected.pathname))continue;
  assert.ok(cachedURLs.includes(expected.href),expected.pathname+' is missing its exact versioned cache entry');
 }
 for(const name of ['abyssal-offshore-system.js','abyssal-submarine-cockpit.js',
  'abyssal-extraction-ui.js','abyssal-submarine-laboratory.css',
  'abyssal-ocean-respawn.js','abyssal-exploration-hud.css','update-manager.css','assets/branding/icon/0.b64','assets/branding/loading/5.b64']){
  assert.ok(cachedURLs.some(url=>new URL(url).pathname.endsWith('/'+name)),name+' is absent from offline install');
 }
});

test('online navigation fetches fresh shell; offline navigation uses installed shell',async()=>{
 const sw=fs.readFileSync(path.join(__dirname,'../public/offline-sw.js'),'utf8');
 const events={};
 const cached={source:'installed-html'},fresh={source:'current-html'};
 const cache={match:async()=>cached};
 let requestCount=0,online=true;
 const self={registration:{scope:'https://abyssal.example/'},location:{origin:'https://abyssal.example'},addEventListener:(key,cb)=>events[key]=cb};
 vm.runInNewContext(sw,{self,URL,Request,Response,caches:{open:async()=>cache},fetch:async()=>{requestCount++;if(!online)throw Error('offline');return fresh;}});
 const request={method:'GET',url:'https://abyssal.example/',mode:'navigate',headers:new Headers()};
 let response;
 events.fetch({request,respondWith:p=>response=p});
 assert.equal(await response,fresh);
 assert.equal(requestCount,1);
 online=false;events.fetch({request,respondWith:p=>response=p});
 assert.equal(await response,cached);
});
test('new versioned JavaScript never silently loads obsolete unversioned cache alias',async()=>{
 const sw=fs.readFileSync(path.join(__dirname,'../public/offline-sw.js'),'utf8');
 const events={};let source='';const fresh={version:'fresh'};
 const cache={match:async req=>{source=String(req.url||req);return source.endsWith('/online.js')?{version:'obsolete'}:null;}};
 const self={registration:{scope:'https://abyssal.example/'},location:{origin:'https://abyssal.example'},addEventListener:(key,cb)=>events[key]=cb};
 let requestCount=0;
 vm.runInNewContext(sw,{self,URL,Request,Response,caches:{open:async()=>cache},fetch:async()=>{requestCount++;return fresh;}});
 const request={method:'GET',url:'https://abyssal.example/online.js?v=3.6.999',mode:'same-origin',headers:new Headers()};
 let response;
 events.fetch({request,respondWith:p=>response=p});
 assert.equal(await response,fresh);
 assert.equal(requestCount,1);
 assert.match(source,/online[.]js[?]v=3[.]6[.]999/);
});
