'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('submarine hull is 1000 HP in client and online server simulation',()=>{
 const game=read('public/game.js');
 const world=read('world-simulation.js');
 assert.match(game,/const SOLO_HULL_HP=1000/);
 assert.match(world,/const ONLINE_SUBMARINE_SECTION_HP=1000/);
});

test('offline shell cache is bumped so stale game.js cannot survive the release',()=>{
 const sw=read('public/offline-sw.js');
 const offline=read('public/offline-ui.js');
 const build=read('public/client-build.js');
 assert.match(sw,/online-submarine-1000hp-v147/);
 assert.match(offline,/updateViaCache:'none'/);
 assert.match(build,/version:'3\.6\.7'/);
});
