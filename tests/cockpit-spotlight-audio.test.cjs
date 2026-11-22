'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');

test('Bravery Demon is the sole soundtrack, looped and precached for offline use',()=>{
 const audio=read('public/abyssal-sample-audio.js'),sw=read('public/offline-sw.js');
 const html=read('public/index.html');
 new vm.Script(audio);
 assert.match(audio,/music:\{file:'music\/bravery_demon_bpm210\.ogg'/);
 assert.match(audio,/source\.loop=true/);
 assert.match(audio,/createMediaElementSource/);
 assert.match(audio,/element\.loop=true/);
 assert.match(audio,/element\.preload='auto'/);
 assert.match(audio,/DOMContentLoaded/);
 assert.match(audio,/pointerdown',unlock/);
 assert.match(sw,/audio\/music\/bravery_demon_bpm210\.ogg/);
 assert.match(sw,/bravery-cabin-v311/);
 assert.doesNotMatch(audio,/musica\.mp3/);
 assert.doesNotMatch(sw,/musica\.mp3/);
 assert.match(html,/abyssal-sample-audio\.js\?v=3\.6\.133\.bravery1/);
 assert.ok(fs.existsSync('public/audio/music/bravery_demon_bpm210.ogg'));
 assert.ok(!fs.existsSync('public/audio/music/musica.mp3'));
});
test('removed synthetic cavitation noise does not return in propulsor motor loop',()=>{
 const audio=read('public/abyssal-sample-audio.js');
 assert.doesNotMatch(audio,/rand\(\)\*\.045/);
 assert.match(audio,/no added cavitation hiss/);
});
test('cockpit keeps one selected station, with small faded neighbors and accessible arrows',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js'),css=read('public/abyssal-cockpit-stations.css');
 new vm.Script(runtime);
 assert.match(runtime,/\bis-prev\b/);
 assert.match(runtime,/\bis-active\b/);
 assert.match(runtime,/\bis-next\b/);
 assert.match(runtime,/if\(offscreen\)\{key\.tabIndex=-1;key\.setAttribute\('aria-hidden','true'\)/);
 assert.match(runtime,/\[\.\.\.rail\.children\]\.forEach\(\(button,index\)=>setSpotlightSlot\(button,index,currentIndex\)\)/);
 assert.match(runtime,/keys\.append\(prev,rail,next\)/);
 assert.match(runtime,/workshopGrid\.replaceChildren\(visor,keys\)/);
 assert.match(css,/@keyframes abyss-visor-enter/);
});
