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
  async put(url){if(String(url)==='https://abyssal.example/index.html')cachedIndex=true;}
 };
 const self={
  registration:{scope:'https://abyssal.example/'},
  location:{origin:'https://abyssal.example'},
  addEventListener:(type,callback)=>{callbacks[type]=callback;},
  skipWaiting:async()=>{}
 };
 const context={self,URL,fetch:async()=>response,caches:{open:async()=>cache}};
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
  'abyssal-open-sea-lighting.js','abyssal-ocean-respawn.js','abyssal-fauna-anatomy.js']){
  assert.ok(cachedURLs.some(url=>new URL(url).pathname.endsWith('/'+name)),name+' is absent from offline install');
 }
});
