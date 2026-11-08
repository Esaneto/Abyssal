const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('ocean menu keeps portal travel but supports click-and-hold mouse steering',()=>{
 const js=read('public/abyssal-menu-ocean.js');
 assert.match(js,/dataset\.portalArriving==='1'/);
 assert.match(js,/event\.stopImmediatePropagation\(\)/);
 assert.match(js,/followingPointer=event\.pointerId/);
 assert.match(js,/stage\.addEventListener\('pointermove'/);
 assert.match(js,/navigateToPointer\(event\)/);
 assert.match(js,/if\(r\.width<10\|\|r\.height<10\)return/);
 assert.match(js,/Math\.abs\(stage\.clientWidth-stageW\)>2/);
 assert.match(js,/function drawPortalRoutes\(\)/);
 assert.match(js,/routesCtx\.fillText\(station\.label/);
});

test('menu microbubbles are cosmetic, fade and are capped',()=>{
 const js=read('public/abyssal-menu-ocean.js');
 assert.match(js,/bubbleElapsed>\.075/);
 assert.match(js,/radius:1\+Math\.random\(\)\*1\.3/);
 assert.match(js,/if\(motionBubbles\.length>50\)/);
 assert.match(js,/if\(b\.life<=0\)\{motionBubbles\.splice/);
 assert.match(read('public/abyssal-menu-v2.css'),/\.abyss-ocean-bubbles\{/);
});

test('profile places an upright diver facing right, specimen left',()=>{
 const js=read('public/game.js');
 assert.match(js,/dx=w\*\.64,dy=h\*\.53/);
 assert.match(js,/DIVER_ART\?\.draw\?\.\(c,dx,dy\+bob,27,-Math\.PI\/2,0,t/);
 assert.match(js,/sx=w\*\.23,sy=h\*\.52/);
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
 assert.match(html,/abyssal-menu-ocean\.js\?v=7/);
 assert.match(html,/abyssal-menu-v2\.css\?v=2026\.11\.7\.6/);
 assert.match(sw,/'abyssal-red-reticle\.svg'/);
 assert.match(sw,/'abyssal-menu-ocean\.js'/);
});
