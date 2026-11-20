'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('deep menu is loaded after live cockpit and cached offline',()=>{
 const html=read('public/index.html'),sw=read('public/offline-sw.js');
 assert.match(html,/abyssal-deep-menu\.css/);
 assert.match(html,/abyssal-deep-menu\.js/);
 assert.ok(html.indexOf('abyssal-exploration-runtime.js')<html.indexOf('abyssal-deep-menu.js'));
 assert.match(sw,/'abyssal-deep-menu\.js'/);
 assert.match(sw,/'abyssal-deep-menu\.css'/);
 assert.match(sw,/'abyssal-deep-menu-cinematic\.css'/);
 assert.match(sw,/'abyssal-cabin-deck\.webp'/);
 assert.match(sw,/'abyssal-cabin-ocean-hq\.webp'/);
});
test('deep menu keeps the original gameplay, account, shop and art authority',()=>{
 const s=read('public/abyssal-deep-menu.js');
 new vm.Script(s,{filename:'abyssal-deep-menu.js'});
 for(const id of ['deepSoloDive','deepOnlineDive','deepSuitPreview','deepEchoPreview','deepHatchChoice','deepReturn'])assert.match(s,new RegExp(id));
 for(const name of ['AbyssalCockpitNavigation','AbyssalDiverArt','AbyssalMarineArt','AbyssalCuratedSkins','AbyssalOnline','abyssal-room-joined','playBtn'])assert.match(s,new RegExp(name));
 assert.doesNotMatch(s,/stripe|localStorage\.setItem|\/api\/payments/i);
 for(const setting of ['controls','hudEditor','volume','filter','language','fullscreen','download'])assert.match(s,new RegExp('data-deep-setting="'+setting+'"'));
 assert.match(s,/nav\.routeCommand\(name\)/);
 assert.match(s,/nav\.routeScreen\('downloadScreen'\)/);
});
test('deep cabin keeps reduced motion and responsive hit targets',()=>{
 const css=read('public/abyssal-deep-menu.css');
 for(const name of ['deep-suits','deep-ecos','deep-hatch-lid','deep-sonar-sweep','deep-research-display','abyss-deep-detail'])assert.match(css,new RegExp(name));
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/safe-area-inset-bottom/);
});
test('entry and return route through the new single cockpit',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js'),game=read('public/game.js');
 assert.match(runtime,/openedPrimaryCockpit=true;openWorkshop\(\)/);
 assert.match(game,/window\.AbyssalDeepMenu\?\.isEnabled\?\.\(\)/);
 assert.match(game,/cockpitNav\?\.open\?\.\(\)/);
 assert.match(read('AGENT_FRAMEWORK.md'),/Definition of Done/);
});
