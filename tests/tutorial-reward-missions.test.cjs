'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=name=>fs.readFileSync(name,'utf8');
const server=read('server.js'),game=read('public/game.js'),online=read('public/online.js');
const marine=read('public/marine-art.js'),guide=read('public/abyssal-tutorials.js');
test('all game mode tutorials are distinct and have a closable, optional guide',()=>{
 assert.doesNotThrow(()=>new vm.Script(guide));
 for(const mode of ['solo','coop','pvp','rift','rift-solo'])assert.match(guide,new RegExp('\\b'+(mode==='rift-solo'?"'rift-solo'":mode)+':\\{'));
 assert.match(guide,/Não mostrar o tutorial novamente/);
 assert.match(guide,/abyssalGuideX/);
 assert.match(guide,/setTutorialActive/);
 assert.match(read('public/index.html'),/abyssal-tutorials\.js/);
 assert.match(read('public/abyssal-tutorials.css'),/tentacle|tentáculos|tentacle|guide-card|abyssal-guide-card/i);
});
test('marine skin neon uses original color and alpha silhouette with bounded sprite cache',()=>{
 assert.match(marine,/neonForSpecies\(s\.color\)/);
 assert.match(marine,/shadowBlur=Math\.max/);
 assert.match(marine,/drawImage\(entry\.canvas/);
 assert.match(marine,/marineSpriteCache\.size>32/);
 assert.match(marine,/String\(s\.color\)/);
 assert.doesNotThrow(()=>new vm.Script(marine));
});
test('the 50000 first bar bonus is claimed only once on the server after qualifying progress',()=>{
 assert.match(server,/FIRST_PROGRESSION_REWARD_COINS=50000/);
 assert.match(server,/user\.firstProgressionRewardClaimed===true/);
 assert.match(server,/if\(!grantFirstProgressionReward\(user\)\)/);
 assert.match(server,/run\.mode!=='solo'/);
 assert.match(server,/run\.bossesKilled\)\|\|0\)<7/);
 assert.match(server,/room\.mode==='coop'.*bossesKilled.*>=7/);
 assert.match(server,/saveUsers\(\);await flushPersistence\(\)/);
 assert.match(game,/claimFirstProgressionBonus/);
 assert.match(online,/socket\.on\('first-progression-reward'/);
});
test('tutorial immunity is authoritative and disallows attacks and movement',()=>{
 assert.match(server,/socket\.on\('tutorial-state'/);
 assert.match(server,/tutorialOpenUsed/);
 assert.match(server,/invulnerableUntil=Number\.MAX_SAFE_INTEGER/);
 assert.match(server,/shooter\.tutorialActive/);
 assert.match(server,/player\.tutorialActive/);
 assert.match(server,/reason:'tutorial-active'/);
 assert.match(game,/abyssalTutorialActive/);
 assert.match(game,/!abyssalTutorialActive&&/);
 assert.match(guide,/setTutorialOpen/);
});
test('missions and titles match exactly across profile and server',()=>{
 const defs=[...server.matchAll(/\{id:'([^']+)',kind:'([^']+)',required:(\d+)\}/g)].map(m=>({id:m[1],kind:m[2],required:+m[3]}));
 const newIds=['sonar-novice','lantern-hunter','hadal-executioner','first-predator','abyss-stalker','titan-bane','cycle-pioneer','rift-cartographer','hadal-navigator','veteran-diver','eternal-explorer'];
 for(const id of newIds){assert.ok(defs.some(t=>t.id===id),'server missing '+id);assert.ok(online.includes("id:'"+id+"'"),'client missing '+id);}
 assert.equal(new Set(defs.map(t=>t.id)).size,defs.length);
 assert.match(server,/riftBossesDefeated/);
 assert.match(server,/runsCompleted/);
});
