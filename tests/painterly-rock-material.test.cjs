'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'public/abyssal-open-sea-render.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/offline-sw.js'),'utf8');
const atlas=fs.readFileSync(path.join(root,'public/abyssal-basalt-material.webp'));
test('painterly rock atlas stays local, offline and confined to existing collision silhouettes',()=>{
 assert.equal(atlas.toString('ascii',0,4),'RIFF');
 assert.equal(atlas.toString('ascii',8,12),'WEBP');
 assert.ok(atlas.byteLength<30000);
 assert.match(src,/function rockMaterialFor\(lowPower\)/);
 assert.match(src,/if\(lowPower\|\|typeof Image/);
 assert.match(src,/ctx\.save\(\);ctx\.clip\(\)/);
 assert.match(src,/ctx\.globalCompositeOperation='soft-light'/);
 assert.match(sw,/abyssal-basalt-material\.webp/);
});
