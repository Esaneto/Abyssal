const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('submarine menu preserves native game actions behind cinematic suction',()=>{
 const js=read('public/abyssal-menu-ocean.js');
 assert.match(js,/menu\.classList\.add\('submarine-menu'\)/);
 assert.match(js,/dataset\.portalArriving==='1'/);
 assert.match(js,/event\.stopImmediatePropagation\(\)/);
 assert.match(js,/stage\.addEventListener\('pointermove'/);
 assert.match(js,/playEntrance\(s\)/);
 assert.match(js,/s\.button\.click\(\)/);
 assert.match(js,/ROUTES=\[/);
 assert.match(js,/function renderCurrents\(now\)/);
 assert.match(js,/currents\.fillText\(letters\[j\],0,0\)/);
 assert.match(js,/window\.addEventListener\('abyssal-menu-portal-cancelled'/);
});

test('submarine ejection bubbles are cosmetic and capped',()=>{
 const js=read('public/abyssal-menu-ocean.js');
 assert.match(js,/function resetToHatch\(\)/);
 assert.match(js,/const hatch=\(\)=>/);
 assert.match(js,/emergence=Math\.min\(1,emergence\+step\)/);
 assert.match(js,/for\(let n=0;n<4;n\+\+\)bubble\(px,py\+17,true\)/);
 assert.match(js,/if\(bubbles\.length>145\)/);
 assert.match(js,/if\(b\.life<=0\)\{bubbles\.splice/);
 assert.match(read('public/abyssal-menu-v2.css'),/\.abyss-ocean-bubbles\{/);
});

test('profile restores dynamic diagonal swimming pose',()=>{
 const js=read('public/game.js');
 assert.match(js,/dx=w\*\.42,dy=h\*\.60/);
 assert.match(js,/DIVER_ART\?\.draw\?\.\(c,dx,dy\+bob,27,-\.10,-\.10,t/);
 assert.match(js,/sx=w\*\.62,sy=h\*\.30/);
});

test('diver movement has short harmless bubbles but no old blue or speed streaks',()=>{
 const js=read('public/game.js');
 assert.match(js,/diverBubbleClock>=\.075/);
 assert.match(js,/p\.bubble=true/);
 assert.match(js,/if\(p\.bubble\)\{ctx\.strokeStyle=p\.color/);
 assert.doesNotMatch(js,/AbyssalMarineArt\?\.wake\(ctx,player/);
 assert.doesNotMatch(js,/ctx\.globalAlpha=tr\.life\/\.28\*\.18/);
 assert.doesNotMatch(js,/if\(upgradeLevels\.speed>0&&\(Math\.abs\(player\.x-/);
});

test('red reticle and changed assets are delivered with a fresh offline cache',()=>{
 const css=read('public/abyssal-menu-v2.css');
 const svg=read('public/abyssal-red-reticle.svg');
 const html=read('public/index.html');
 const sw=read('public/offline-sw.js');
 assert.match(svg,/width="32" height="32" viewBox="0 0 48 48"/);
 assert.match(svg,/<circle cx="24" cy="24" r="2\.6"/);
 assert.match(css,/cursor:url\('abyssal-red-reticle\.svg\?v=1'\) 16 16,crosshair!important/);
 assert.match(html,/abyssal-menu-ocean\.js\?v=2026\.11\.8\.12/);
 assert.match(html,/abyssal-menu-v2\.css\?v=2026\.11\.8\.12/);
 assert.match(sw,/'abyssal-red-reticle\.svg'/);
 assert.match(sw,/'abyssal-menu-ocean\.js'/);
});
