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
 assert.match(index,/abyssal-rebuild\.css\?v=2/);
 assert.match(index,/abyssal-rebuild\.js\?v=4/);
 assert.match(rebuild,/DESCIDA ABISSAL/);
 assert.match(rebuild,/DESCER SOZINHO/);
 assert.match(rebuild,/DESCER EM CARDUME/);
 assert.doesNotMatch(rebuild,/socket\.emit|sendPosition|sendDamageBatch/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});


test('depth rules load before gameplay and literal newline escape debris is absent',()=>{
 assert.match(index,/abyssal-expedition-rules\.js\?v=2/);
 const rulesScript=index.search(/abyssal-expedition-rules\.js\?v=\d+(?:\.\d+)*/),gameScript=index.search(/game\.js\?v=\d+(?:\.\d+)*/);
 assert.ok(rulesScript>=0&&gameScript>=0&&rulesScript<gameScript);
 assert.doesNotMatch(index,/\\\\n/);
});

test('depth and event UI remains cosmetic and does not add gameplay network traffic',()=>{
 assert.match(rebuild,/abyssal-depth-state/);
 assert.match(rebuild,/abyssEventBanner/);
 assert.match(rebuild,/abyssEventAtmosphere/);
 assert.match(rebuild,/abyssZoneValue/);
 assert.match(rebuild,/abyssal-room-joined[\s\S]*mode!=='rift'[\s\S]*event:null/);
 assert.match(css,/body:not\(\.game-active\) \.abyss-event-atmosphere/);
 assert.doesNotMatch(rebuild,/socket\.emit|sendPosition|sendDamageBatch|requestAnimationFrame\([^)]*send/);
 const eventCss=css.slice(css.indexOf('Depth zones + rare events'));
 assert.match(eventCss,/abyss-event-predator_migration/);
 assert.match(eventCss,/abyss-event-black_current/);
 assert.match(eventCss,/abyss-event-resonance_bloom/);
 assert.doesNotMatch(eventCss,/backdrop-filter/);
});

test('rift expedition is explicit and its exits replace the old boss checkpoint overlay',()=>{
 assert.match(game,/expeditionMode=isRiftRun\(\)/);
 assert.doesNotMatch(game,/dispatchEvent\(new CustomEvent\('abyssal-expedition-checkpoint'/);
 assert.match(game,/clearedBosses>activeMapTier&&!bossAlive/);
 assert.match(game,/pauseExpedition:\(\)=>\{if\(!expeditionMode\|\|onlineMode/);
 assert.match(server,/const expedition=Boolean\(!member&&payload\.expedition===true\)/);
});

test('extraction is server-accounted and death preserves only part of completion payout',()=>{
 assert.match(game,/expeditionExtracted\?1\+Math\.min\(\.75,bossKillsThisRun\*\.15\):\.65/);
 assert.match(server,/extracted\?1\+Math\.min\(\.75,bossesKilled\*\.15\):\.65/);
 assert.match(game,/extracted:expeditionExtracted/);
 assert.match(server,/Sinal perdido:.*65% da recompensa/);
});

test('successful extraction has its own result state and cannot offer a revive ad',()=>{
 assert.match(game,/function renderRunEndPresentation\(\)/);
 assert.match(game,/VOCÊ VOLTOU\.<br><em>POR ENQUANTO\.<\/em>/);
 assert.match(game,/if\(revive\)revive\.hidden=true/);
 assert.match(game,/DESCER NOVAMENTE/);
});

test('boss collection is framed as relics instead of playable full bosses',()=>{
 for(const name of ['Eco do Peixe-Remo Leviatã','Eco da Lula-Kraken','Eco do Polvo-de-Anéis-Azuis','Núcleo do Peixe-Pescador','Fragmento da Enguia-Pelícano','Núcleo da Lula-Colossal']){
  assert.ok(game.includes(name),name+' should be present in the playable collection');
 }
 assert.match(rebuild,/RELÍQUIAS/);
 assert.match(rebuild,/Chefes e elites verdadeiros não são domesticados/);
});
