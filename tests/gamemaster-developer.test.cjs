'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('GameMaster credentials come from environment and role is server-side',()=>{
 const server=read('server.js');
 assert.match(server,/ABYSSAL_GAMEMASTER_PASSWORD/);
 assert.match(server,/role='developer'/);
 assert.match(server,/developerAccess=true/);
 assert.match(server,/isDeveloperUser\(u\)/);
 assert.doesNotMatch(server,/GameMaster[^\n]{0,120}password\s*[:=]\s*['"][^'"]+/i);
});

test('regular users cannot execute developer commands',()=>{
 const server=read('server.js');
 assert.match(server,/socket\.on\('developer-command'/);
 assert.match(server,/if\(!isDeveloperUser\(u\)\)return reply\(\{ok:false,message:'Acesso de desenvolvedor negado\.'/);
 assert.match(server,/socket\.on\('developer-inspect'/);
});

test('developer panel and neon identity are bundled',()=>{
 const index=read('public/index.html');
 const css=read('public/developer-tools.css');
 const js=read('public/developer-tools.js');
 const online=read('public/online.js');
 const game=read('public/game.js');
 assert.match(index,/developer-tools\.css/);
 assert.match(index,/developer-tools\.js/);
 assert.match(css,/developer-nickname/);
 assert.match(js,/GAMEMASTER · DEV/);
 assert.match(online,/AbyssalOnlineDev/);
 assert.match(game,/peer\.isDeveloper\?'#ff304f'/);
});

test('developer action set includes rapid testing operations',()=>{
 const server=read('server.js');
 for(const command of ['grant-energy','unlock-specimens','max-proficiency','heal','god-mode','clear-enemies','boss-now']){
  assert.match(server,new RegExp("command==='"+command+"'"));
 }
});
