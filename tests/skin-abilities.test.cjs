'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const abilities = require('../skin-abilities');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('skin damage passives are deterministic and preserve boss/range conditions', () => {
  assert.equal(abilities.damageMultiplier('toxic','common',500,1),1);
  assert.equal(abilities.damageMultiplier('leviathan','kraken',500,1),1.4);
  assert.equal(abilities.damageMultiplier('leviathan','common',500,1),1);
  assert.equal(abilities.damageMultiplier('thorn','common',100,1),1.24);
  assert.equal(abilities.damageMultiplier('thorn','common',220,1),1);
  assert.equal(abilities.damageMultiplier('bloodmoon','common',500,.35),1.3);
  assert.equal(abilities.damageMultiplier('angler','common',300,1),1.25);
  assert.equal(abilities.damageMultiplier('maw','common',100,1),1.3);
});

test('passive movement, defense, targeting, XP and magnet bonuses are centralized', () => {
  assert.equal(abilities.incomingDamageMultiplier('deepwarden'),.82);
  assert.equal(abilities.incomingDamageMultiplier('abysscroc'),.85);
  assert.equal(abilities.enemySpeedMultiplier('glacier',200),.74);
  assert.equal(abilities.enemySpeedMultiplier('glacier',300),1);
  assert.equal(abilities.movementMultiplier('voidwing'),1.18);
  assert.equal(abilities.movementMultiplier('electriceel'),1);
  assert.equal(abilities.movementMultiplier('greensnake'),1);
  assert.equal(abilities.damageMultiplier('electriceel','common',500,1),1);
  assert.equal(abilities.damageMultiplier('greensnake','common',500,1),1);
  assert.equal(abilities.targetRangeMultiplier('abyssaleye'),1.2);
  assert.equal(abilities.fireRateMultiplier('solar'),1.18);
  assert.equal(abilities.orbExperienceMultiplier('default'),1.12);
  assert.equal(abilities.orbExperienceMultiplier('royal'),1.25);
  assert.equal(abilities.magnetRangeMultiplier('hammerhead'),1.5);
});

test('Violet resonance has client trigger and server-authoritative cooldown/range/target limits', () => {
  const game=read('public/game.js'), server=read('server.js'), html=read('public/index.html');
  assert.match(game,/violet-resonance/);
  assert.match(game,/player\.violetCooldown=10/);
  assert.match(server,/player\.skinId!=='violet'/);
  assert.match(server,/violetResonanceReadyAt=now\+10000/);
  assert.match(server,/violetResonanceTargetIds\.size>=4/);
  assert.match(html,/skin-abilities\.js/);
});

test('predator skins trigger client events and have server-side validation', () => {
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game, /\['reefshark','abysscroc','armoredgator'\]\.includes\(equippedSkin\)/);
 assert.match(game, /sendSkinAbility\(\{skin: equippedSkin/);
 for(const id of ['reefshark-dash','abysscroc-lunge','armoredgator-spin']) assert.match(server,new RegExp(id));
 for(const id of ['abysscroc-lunge','armoredgator-spin']) assert.match(game,new RegExp(id));
});
test('browser and server use the same skin ability module', () => {
  assert.equal(read('skin-abilities.js'),read('public/skin-abilities.js'));
  assert.match(read('server.js'),/require\('\.\/skin-abilities'\)/);
  assert.match(read('world-simulation.js'),/SkinAbilities\.magnetRangeMultiplier/);
  assert.match(read('world-simulation.js'),/SkinAbilities\.orbExperienceMultiplier/);
});


test('eel remains deterministic while emerald serpent keeps its original swimming identity', () => {
  const game=read('public/game.js');
  const eelStart=game.indexOf("} else if(id==='electriceel'){");
  const snakeStart=game.indexOf("} else if(id==='greensnake'){");
  const defaultStart=game.indexOf("} else if(id==='default'){");
  assert.ok(eelStart>0&&snakeStart>eelStart&&defaultStart>snakeStart);
  assert.doesNotMatch(game.slice(eelStart,snakeStart),/Math\\.random/);
  assert.ok(game.slice(snakeStart,defaultStart).includes('const segWave = Math.sin(t * 0.006) * 0.15;'));
  assert.match(game,/Veneno corrosivo: ataques envenenam criaturas atingidas/);
  assert.match(game,/Descarga Estática: ataques paralisam brevemente as criaturas atingidas/);
});


test('named premium skins retain reachable render branches', () => {
 const game=read('public/game.js');
 for(const id of ['bloodmoon','thorn','abyssaleye']) assert.ok(game.includes("else if(id==='"+id+"'){"));
 const premiumGroup="else if(id==='aberration'||id==='angler'||id==='maw'||id==='devourer'){";
 assert.equal(game.split(premiumGroup).length-1,1);
});

test('Photon Ray auto-targets nearest in-range target without mouse steering', () => {
 const game=read('public/game.js');
 const start=game.indexOf("if(upgrades.photonRay>0){"),end=game.indexOf("if(upgrades.nova>0)",start),block=game.slice(start,end);
 assert.ok(block.includes('d<=beamRange&&d<targetDistance'));
 assert.ok(!block.includes('mouseAimMode')&&!block.includes('updateMouseAimFromCursor')&&!block.includes('controlAimAngle'));
 assert.ok(block.includes('Math.atan2'));
});

test('Kraken skin uses animated contact-damage tentacles', () => {
 const game=read('public/game.js'),ai=read('public/enemy-ai.js');
 assert.ok(game.includes('touchesKrakenTentacle?.(krakenProxy,target,1)'));
 assert.ok(game.includes("dealEnemyDamage(target,24,'kraken-contact')"));
 assert.ok(ai.includes('const length = 3.35 + 0.32'));
});


test('premium boss skins expose meaningful verified combat advantages',()=>{
 const abilities=require('../public/skin-abilities');
 assert.equal(abilities.damageMultiplier('leviathan','kraken',500,1),1.4);
 assert.equal(abilities.damageMultiplier('angler','drifter',300,1),1.25);
 assert.equal(abilities.damageMultiplier('maw','drifter',100,1),1.3);
 assert.equal(abilities.damageMultiplier('devourer','kraken',300,1),1.2);
 assert.equal(abilities.incomingDamageMultiplier('aberration'),.88);
 assert.equal(abilities.incomingDamageMultiplier('kraken'),.9);
 assert.equal(abilities.targetRangeMultiplier('angler'),1.15);
 assert.equal(abilities.magnetRangeMultiplier('devourer'),1.35);
});

test('toxic skin releases a poison cloud every five seconds',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes("player.toxicCloudTimer=5"));
 assert.ok(game.includes("dealEnemyDamage(target,8,'toxic-cloud'"));
 assert.ok(game.includes("target.poisonTimer=Math.max(Number(target.poisonTimer)||0,5)"));
});

test('paid skin copy matches implemented white shark and boss-skin mechanics',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes('Esteira Pelágica: ao nadar, deixa um rastro de bolhas por 5 segundos'));
 assert.ok(game.includes('Caçador de colossos: causa 40% mais dano aos bosses e recebe 8% menos dano.'));
 assert.ok(game.includes('Isca predatória: +25% de dano a longa distância e +15% de alcance'));
 assert.ok(game.includes('Mordida de fenda: +30% de dano contra inimigos próximos'));
});


test('shot families use explicit power budgets instead of full damage per projectile',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes("spread:{damage:[0,6.0,4.6,3.8]"));
 assert.ok(game.includes("photon:{damage:[0,14,18,22]"));
 assert.ok(game.includes("pierce:{damage:[0,13,16,19]"));
 assert.ok(game.includes("electric:{damage:[0,11,13,15]"));
 assert.ok(game.includes("getShotDamageAtLevel(shotLevel,activeShot)"));
});

test('electric shot has deterministic lightning geometry and reduced chain damage',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes("type:'electric-arc'"));
 assert.ok(game.includes("chainDamage:[0,.38,.34,.30]"));
 assert.ok(game.includes("Math.sin((Number(fx.seed)||0)*.17+s*2.2)"));
 assert.ok(!game.includes("if(p.special==='electric'){ctx.strokeStyle='#eaffff';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(p.x-p.vx*.025,p.y-p.vy*.025);ctx.lineTo(p.x+rand(-4,4)"));
});

test('major radial abilities use layered silhouettes for readable VFX',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes("color:'#7568ff'"));
 assert.ok(game.includes("color:'#b8aaff'"));
 assert.ok(game.includes("color:'#c18cff'"));
 assert.ok(game.includes("color:'#f0d9ff'"));
});


test('abyss lance and photon lance have opposite silhouettes and travel profiles',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes("pierce:{damage:[0,13,16,19],speed:[0,.86,.90,.94],radius:[0,5.4,6.0,6.6]}"));
 assert.ok(game.includes("photon:{damage:[0,14,18,22],speed:[0,1.55,1.82,2.08],radius:[0,2.9,3.1,3.3]}"));
 assert.ok(game.includes("p.special==='photon'?.035:p.special==='pierce'?.105"));
 assert.ok(game.includes("ctx.ellipse(p.x,p.y,p.r*1.9,p.r*.46"));
 assert.ok(game.includes("p.r*2.4"));
});

test('passive and defensive skills expose readable gameplay feedback',()=>{
 const game=read('public/game.js');
 for(const token of ["type:'regen-pulse'","type:'ward-collapse'","type:'ricochet-arc'","upgrades.lastStand>0&&hp/maxHp<=.3","if(upgrades.predator>0)","if(upgrades.shell>0)","if(upgradeLevels.magnet>0)"]) assert.ok(game.includes(token),token);
});


test('crocodilian skins preserve real-world silhouette differences',()=>{
 const game=read('public/game.js');
 const caiman=game.slice(game.indexOf("else if(id==='abysscroc'){"),game.indexOf("else if(id==='armoredgator'){"));
 const croc=game.slice(game.indexOf("else if(id==='armoredgator'){"),game.indexOf("else if(id==='electriceel'){"));
 assert.ok(caiman.includes('U-shaped skull'));
 assert.ok(caiman.includes("bodyGrad('#182a22')"));
 assert.ok(croc.includes('V-shaped rostrum'));
 assert.ok(croc.includes('visible teeth'));
});

test('resonance adds one new tactical option to every category',()=>{
 const game=read('public/game.js'),server=read('server.js');
 for(const id of ['echoShot','pressureCocoon','closePressure']){assert.ok(game.includes(id),id);assert.ok(server.includes(id),id);}
 assert.ok(game.includes("echoShot:{damage:[0,8,10,12]"));
 assert.ok(game.includes("offsets=[-.045,.045]"));
 assert.ok(game.includes("const cocoonInterval=[0,24,20,16]"));
 assert.ok(game.includes("distance<=175/GAME_WORLD_ZOOM"));
});

test('resonance selector renders dedicated icon badges and abyss category styling',()=>{
 const game=read('public/game.js'),css=read('public/style.css');
 assert.ok(game.includes("badge.className='resonance-skill-icon'"));
 assert.ok(game.includes("echoShot:['⋔','Eco de Maré']"));
 assert.ok(game.includes("row.className='resonance-skill-option resonance-'+category"));
 assert.ok(css.includes('.resonance-shots .resonance-skill-icon'));
 assert.ok(css.includes('.resonance-defensive .resonance-skill-icon'));
 assert.ok(css.includes('.resonance-passive .resonance-skill-icon'));
});
