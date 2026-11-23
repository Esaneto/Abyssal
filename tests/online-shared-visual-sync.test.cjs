'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('every accepted shared shot is delivered reliably, without volatile combat relays',()=>{
 const server=read('server.js');
 assert.match(server,/io\.to\(channelFor\(room\)\)\.emit\('shared-shot',shot\)/);
 assert.doesNotMatch(server,/volatile\.emit\('shared-shot'/);
 assert.match(server,/shot\.visual=\{/);
 assert.match(server,/radius:clamp\(Number\(visual\.radius\)/);
 assert.match(server,/maxDistance:clamp\(Number\(visual\.maxDistance\)/);
 assert.match(server,/life:clamp\(Number\(visual\.life\)/);
});

test('remote and local projectiles share size, lifespan, range and rendering',()=>{
 const game=read('public/game.js');
 assert.match(game,/visual:\{radius:shotVisual\.r,maxDistance:shotVisual\.maxDistance,life:shotVisual\.life\}/);
 assert.match(game,/visual:\{radius,maxDistance:reach,life:shardLife\}/);
 assert.match(game,/const visual=d\.visual\|\|\{\},radius=clamp/);
 assert.match(game,/projectiles\.push\(\{x,y,vx,vy,r:radius,life,maxDistance,travelled:0,damage:0,color:col,special,remoteVisual:true/);
 assert.match(game,/if\(p\.remoteVisual\)\{/);
 assert.doesNotMatch(game,/allyShot:true,remoteVisual:true/);
});

test('remote effects do not generate client-authoritative hits',()=>{
 const game=read('public/game.js');
 const projectileLoop=game.slice(game.indexOf('for(let i=projectiles.length-1;i>=0;i--)'),game.indexOf('for(const beam of effects)'));
 assert.ok(projectileLoop.indexOf('if(p.remoteVisual)')>=0);
 assert.ok(projectileLoop.indexOf('if(p.remoteVisual)')<projectileLoop.indexOf('projectileCandidates.length=0'));
 assert.match(game,/if\(special==='photon'\)queueEffect\(\{type:'photon-flash'/);
});

test('movement is sent at up to 40Hz with reliable transform before new shot volleys',()=>{
 const online=read('public/online.js'),server=read('server.js');
 assert.match(online,/now-lastPositionAt<1000\/40/);
 assert.match(server,/const playerMotionIntervalMs=1000\/40/);
 assert.match(online,/flushPosition\(true,true\)/);
 assert.match(online,/if\(reliable\)socket\.emit\('player-motion-input',packet\)/);
 assert.match(online,/else socket\.volatile\.emit\('player-motion-input',packet\)/);
 assert.match(online,/peer\.motionBufferMs=Math\.max\(isPvp\?25:28/);
});

test('visual performance settings appear before graphical quality in cockpit',()=>{
 const cockpit=read('public/abyssal-submarine-cockpit.js');
 assert.match(cockpit,/\['DESEMPENHO VISUAL','performance'\]/);
 assert.ok(cockpit.indexOf("['DESEMPENHO VISUAL','performance']")<cockpit.indexOf("['GRÁFICOS','filter']"));
 assert.ok(cockpit.indexOf("name==='performance'")<cockpit.indexOf("name==='filter'"));
});
