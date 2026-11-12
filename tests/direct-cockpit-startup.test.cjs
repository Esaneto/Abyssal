'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('startup never exposes the legacy ocean menu before the cockpit',()=>{
 const html=read('public/index.html'),runtime=read('public/abyssal-exploration-runtime.js'),ocean=read('public/abyssal-menu-ocean.js');
 assert.match(html,/<html lang="pt-BR" class="abyssal-startup">/);
 assert.match(html,/html\.abyssal-startup #app\{opacity:0!important/);
 assert.match(html,/body:not\(\.abyss-hatch-navigation\) #menuScreen\.ocean-menu-v2\{display:none!important/);
 assert.match(runtime,/renderWorkshop\(\);window\.AbyssalSubmarineCockpit\?\.open\?\.\(\);window\.AbyssalRevealStartup\?\.\(\)/);
 assert.match(ocean,/const visible=hatchVisible\(\)/);
 assert.match(read('public/online.js'),/screen\.hidden=false;window\.AbyssalRevealStartup\?\.\(\)/);
 assert.doesNotMatch(read('public/offline-ui.js'),/window\.location\.reload\(/);
});
