'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('loading screen uses scalable vector artwork instead of low resolution raster as primary art',()=>{
 const js=read('public/loading-screen.js');
 const css=read('public/loading-screen.css');
 assert.match(js,/abyssal-ocean-cinema\.svg\?v=2026\.11\.13\.loading-hq/);
 assert.match(css,/transform:none/);
 assert.match(css,/background-size:cover/);
 assert.match(css,/abyssal-loading-brand/);
});

test('low resolution chunked image is fallback only',()=>{
 const js=read('public/loading-screen.js');
 const setArt=js.slice(js.indexOf('function setArt'),js.indexOf('function ensure'));
 assert.match(setArt,/probe\.onerror/);
 assert.match(setArt,/readChunks\(LOADING_CHUNKS\)/);
});

test('high quality loading release refreshes browser cache',()=>{
 const sw=read('public/offline-sw.js');
 const build=read('public/client-build.js');
 const revision=Number(sw.match(/const VERSION = '[^']*-v(\d+)'/)?.[1]);
 assert.ok(revision>=151,'cache must be at least the high-quality loading release');
 assert.match(build,new RegExp("version:'"+require('../package.json').version.replace(/\./g,'\\.')+"'"));
});
