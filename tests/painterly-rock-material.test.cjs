'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('retired Open Sea rock atlas is absent from production assets and offline cache',()=>{
 assert.equal(fs.existsSync(path.join(root,'public/abyssal-basalt-material.webp')),false);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'public/offline-sw.js'),'utf8'),/abyssal-basalt-material\.webp/);
});
