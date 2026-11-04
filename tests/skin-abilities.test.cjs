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

test('Photon Ray uses manual aim only with the second PC or mobile control option', () => {
 const game=read('public/game.js');
 const start=game.indexOf("if(upgrades.photonRay>0){"),end=game.indexOf("if(upgrades.nova>0)",start),block=game.slice(start,end);
 assert.ok(block.includes("controlSettings.pc==='wasd-aim'"));
 assert.ok(block.includes("controlSettings.mobile==='dual-stick'"));
 assert.ok(block.includes('manualPhotonAim'));
 assert.ok(block.includes('if(!manualPhotonAim){'));
 assert.ok(block.includes('nearestDistance=beamRange*beamRange'));
 assert.ok(block.includes('PHOTON_RAY_VISUAL.segmentCircleHit'));
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


test('toxic basic attacks do not poison while emerald serpent still does',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes("if(equippedSkin==='greensnake' && enemy && enemy.hp > 0)"));
 assert.ok(!game.includes("['toxic', 'greensnake'].includes(equippedSkin)"));
 assert.ok(game.includes("if(equippedSkin==='toxic'){"));
 assert.ok(game.includes("target.poisonTimer=Math.max(Number(target.poisonTimer)||0,5)"));
});

test('gameplay notifications are queued with boss priority and restricted kinds',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes("new Set(['boss','fusion','join','death'])"));
 assert.ok(game.includes("enqueueGameplayNotice('boss',title,copy,100)"));
 assert.ok(game.includes("gameplayNoticeQueue.sort((a,b)=>b.priority-a.priority||a.at-b.at)"));
});

test('PvP projectile collision uses fine rock sweep and nova exposes occlusion visual',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.ok(game.includes('Math.ceil(segmentLength/4)'));
 assert.ok(game.includes("type:'occluded-ring'"));
 assert.ok(server.includes('pvpSegmentHitsRock(centerX,centerY,target.x,target.y,2/WORLD_ZOOM)'));
});

test('rankings expose settlement timestamps for client countdowns',()=>{
 const server=read('server.js'),online=read('public/online.js');
 assert.ok(server.includes('resets:rankingResetTimes()'));
 assert.ok(online.includes('ranking-countdown'));
 assert.ok(online.includes('RECOMPENSA EM'));
});

test('Aberration Mask keeps 12% mitigation and first-hit echo repels the attacker',()=>{
 assert.equal(abilities.incomingDamageMultiplier('aberration'),0.88);
 const sim=fs.readFileSync(path.join(__dirname,'..','world-simulation.js'),'utf8');
 assert.match(sim,/aberrationEchoTriggered = true/);
 assert.doesNotMatch(sim,/nearby\.id === enemy\.id/);
 assert.match(sim,/damage: appliedDamage, blocked, aberrationEchoTriggered/);
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(server,/if\(hit\.aberrationEchoTriggered\)/);
 assert.match(server,/skin:'aberration'/);
});

test('PvP authoritative damage applies skin and learned defensive passives',()=>{
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(server,/function pvpDamageAmount\(/);
 assert.match(server,/SkinAbilities\.damageMultiplier\(attacker\?\.skinId,'player'/);
 assert.match(server,/SkinAbilities\.incomingDamageMultiplier\(target\?\.skinId\)/);
 assert.match(server,/shellLevel\*\.08/);
 assert.match(server,/lastStandLevel/);
 assert.match(server,/triggerPvpAberrationEcho/);
 assert.match(server,/bubbleDamage=pvpDamageAmount/);
});
test('PvP radial wave renderer cannot bridge through arena rocks',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 assert.match(game,/type:'occluded-ring'/);
 assert.match(game,/segments=360/);
 assert.match(game,/edgeBlocked=projectileHitsPvpWall/);
 assert.match(game,/shellLevel:upgrades\.shell,lastStandLevel:upgrades\.lastStand/);
});

test('local PvP nova uses the same rock-occluded rings as remote nova',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 assert.match(game,/spawnNovaVisual\(player\.x,player\.y,novaRange,'#72f5ff',isPvpMode\)/);
 assert.match(game,/function spawnNovaVisual/);
});

test('combat feedback has typed two-second damage numbers and five-second blood pools',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 assert.match(game,/tone,life:2,maxLife:2/);
 assert.match(game,/life:5,maxLife:5/);
 assert.match(game,/#39ff72/);
 assert.match(game,/#32cfff/);
 assert.match(game,/#ff174d/);
 assert.match(game,/abyssal-pvp-hit/);
});
test('ambient soundtrack uses discrete tension pulses instead of continuous hum oscillators',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 const start=game.slice(game.indexOf('function startAmbientMusic'),game.indexOf('function audio('));
 assert.match(start,/setInterval/);
 assert.doesNotMatch(start,/frequency\.value=43/);
 assert.doesNotMatch(start,/frequency\.value=67/);
});
test('mobile end dive and room badge are dynamically stacked below selected skills',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 assert.match(game,/function positionMobileRightStack/);
 assert.match(game,/panelRect\.bottom/);
 assert.match(game,/requestAnimationFrame\(positionMobileRightStack\)/);
});

test('hit synergies apply to projectile, photon beam and direct-hit geometries',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 assert.match(game,/function triggerHitSynergies\(/);
 assert.match(game,/triggerHitSynergies\(enemy,appliedDamage,skillId,options\)/);
 assert.match(game,/source!=='ricochet'/);
 assert.match(game,/source!=='electric'&&source!=='arcChain'/);
 assert.match(game,/ricochetLevel:upgrades\.ricochet,electricLevel:upgrades\.electric/);
});
test('PvP server applies hit synergies authoritatively and respects rock cover',()=>{
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(server,/function applyPvpHitSynergies\(/);
 assert.match(server,/p\.ricochetLevel = clamp/);
 assert.match(server,/p\.electricLevel = clamp/);
 assert.match(server,/applyPvpHitSynergies\(room,shooter,targetHit,rawDamage/);
 assert.match(server,/pvpSegmentHitsRock\(from\.x,from\.y,p\.x,p\.y/);
});

test('online PvE and lethal primary hits still trigger hit synergies',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 const damageFn=game.slice(game.indexOf('function dealEnemyDamage('),game.indexOf('function flushOnlineDamageBatch('));
 const onlineTrigger=damageFn.indexOf('triggerHitSynergies(enemy,queuedDamage,skillId,options);');
 const onlineReturn=damageFn.indexOf('return;',damageFn.indexOf('if(onlineMode){'));
 assert.ok(onlineTrigger>=0&&onlineTrigger<onlineReturn,'online hit synergies must run before return');
 const soloTrigger=damageFn.indexOf('triggerHitSynergies(enemy,appliedDamage,skillId,options);');
 const lethalRemoval=damageFn.indexOf('if(enemy.hp<=0)');
 assert.ok(soloTrigger>=0&&soloTrigger<lethalRemoval,'lethal primary hit must trigger synergies before enemy removal');
});

test('local and remote Nova share one visual constructor',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 assert.match(game,/function spawnNovaVisual\(/);
 assert.match(game,/spawnNovaVisual\(player\.x,player\.y,novaRange,'#72f5ff',isPvpMode\)/);
 assert.match(game,/spawnNovaVisual\(x,y,max,col,onlineRoomMode==='pvp'\)/);
 assert.match(game,/type:'nova-core'/);
});

test('Q Pulse uses authoritative online damage and PvP wall occlusion',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 const online=fs.readFileSync(path.join(__dirname,'..','public','online.js'),'utf8');
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(game,/sendActiveAbility\?\.\('pulse',result=>/);
 assert.match(game,/type:'occluded-ring'.*color:'#78f8f3'/);
 assert.match(online,/socket\.timeout\(3000\)\.emit\('active-ability'/);
 assert.match(server,/socket\.on\('active-ability'/);
 assert.match(server,/pvpSegmentHitsRock\(player\.x,player\.y,target\.x,target\.y/);
 assert.match(server,/processWorldDamage\(socket,Number\(enemy\.id\),baseDamage,'pulse'\)/);
});
test('Gravitational Nova has mode-aware cadence enforced by client and server',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(game,/player\.novaTimer=isPvpMode\?2\.4:1\.8/);
 assert.match(server,/cooldown=room\.mode==='pvp'\?2400:1800/);
 assert.match(server,/shooter\.novaShotReadyAt=now\+2400/);
 assert.match(game,/function update\(dt\)\{\r?\n const isPvpMode=onlineRoomMode==='pvp'/);
});
