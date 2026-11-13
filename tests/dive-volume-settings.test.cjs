'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const game=fs.readFileSync('public/game.js','utf8'),html=fs.readFileSync('public/index.html','utf8');
test('dive audio uses the existing saved channels',()=>{for(const id of ['diveSfxVolume','diveMusicVolume'])assert.match(html,new RegExp('id="'+id+'"'));assert.match(game,/abyssalSfxVolume',80/);assert.match(game,/abyssalMusicVolume',45/);assert.match(game,/abyssal-volume-change.*channel:key,value:value\/100/);});
test('cooperative settings never pause the simulation',()=>{const pause=game.slice(game.indexOf('function pauseGame(){'),game.indexOf('function drawEliteMarker'));assert.match(pause,/if\(!onlineMode\)\{gameState='paused'/);assert.match(pause,/syncDiveVolumeSettings\(\)/);assert.match(game,/gameState='over';closeDiveSettings\(\)/);});
