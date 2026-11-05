'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

const index=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const rebuild=fs.readFileSync(path.join(root,'public','abyssal-rebuild.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public','abyssal-rebuild.css'),'utf8');
const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');

test('descent gate is loaded as a lightweight client-only menu layer',()=>{
 assert.match(index,/abyssal-rebuild\.css\?v=1/);
 assert.match(index,/abyssal-rebuild\.js\?v=1/);
 assert.match(rebuild,/DESCIDA ABISSAL/);
 assert.match(rebuild,/DESCER SOZINHO/);
 assert.match(rebuild,/DESCER EM CARDUME/);
 assert.doesNotMatch(rebuild,/socket\.emit|sendPosition|sendDamageBatch/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});

test('solo expedition checkpoints are isolated from online play',()=>{
 assert.match(game,/expeditionMode=!onlineMode/);
 assert.match(game,/if\(!onlineMode&&expeditionMode\).*abyssal-expedition-checkpoint/);
 assert.match(game,/pauseExpedition:\(\)=>\{if\(!expeditionMode\|\|onlineMode/);
 assert.match(server,/const expedition=Boolean\(!member&&payload\.expedition===true\)/);
});

test('extraction is server-accounted and death preserves only part of completion payout',()=>{
 assert.match(game,/expeditionExtracted\?1\+Math\.min\(\.75,bossKillsThisRun\*\.15\):\.65/);
 assert.match(server,/extracted\?1\+Math\.min\(\.75,bossesKilled\*\.15\):\.65/);
 assert.match(game,/extracted:expeditionExtracted/);
 assert.match(server,/Sinal perdido:.*65% da recompensa/);
});

test('boss collection is framed as relics instead of playable full bosses',()=>{
 for(const name of ['Eco do Leviatã','Eco do Kraken','Casca da Aberração','Núcleo da Lanterna','Fragmento da Fenda','Núcleo Devorador']){
  assert.ok(game.includes(name),name+' should be present in the playable collection');
 }
 assert.match(rebuild,/RELÍQUIAS/);
 assert.match(rebuild,/Chefes e elites verdadeiros não são domesticados/);
});
