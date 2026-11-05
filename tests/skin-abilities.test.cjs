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
  assert.equal(abilities.damageMultiplier('leviathan','whiteSharkBoss',500,1),1.4);
  assert.equal(abilities.damageMultiplier('leviathan','common',500,1),1);
  assert.equal(abilities.damageMultiplier('thorn','common',100,1),1.24);
  assert.equal(abilities.damageMultiplier('thorn','common',220,1),1);
  assert.equal(abilities.damageMultiplier('bloodmoon','common',500,.35),1.3);
  assert.equal(abilities.damageMultiplier('angler','common',300,1),1);
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


test('marine electric ray and emerald moray render deterministically with preserved mechanics', () => {
  const game=read('public/game.js');
  const rayStart=game.indexOf("} else if(id==='electriceel'){");
  const morayStart=game.indexOf("} else if(id==='greensnake'){");
  const defaultStart=game.indexOf("} else if(id==='default'){");
  assert.ok(rayStart>0&&morayStart>rayStart&&defaultStart>morayStart);
  assert.doesNotMatch(game.slice(rayStart,morayStart),/Math\\.random/);
  assert.match(game.slice(rayStart,morayStart),/Electric ray \/ torpedo ray/);
  assert.match(game.slice(morayStart,defaultStart),/Giant emerald moray/);
  assert.match(game,/Muco corrosivo: ataques contaminam criaturas atingidas/);
  assert.match(game,/Descarga Torpedo: ataques paralisam brevemente as criaturas atingidas/);
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


test('relic skins keep established passives except the two replaced by active species abilities',()=>{
 const abilities=require('../public/skin-abilities');
 assert.equal(abilities.damageMultiplier('leviathan','kraken',500,1),1.4);
 assert.equal(abilities.damageMultiplier('angler','drifter',300,1),1);
 assert.equal(abilities.damageMultiplier('maw','drifter',100,1),1.3);
 assert.equal(abilities.damageMultiplier('devourer','kraken',300,1),1.2);
 assert.equal(abilities.incomingDamageMultiplier('aberration'),1);
 assert.equal(abilities.incomingDamageMultiplier('kraken'),.9);
 assert.equal(abilities.targetRangeMultiplier('angler'),1);
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
 assert.ok(game.includes('Camuflagem abissal: somente a isca fica brilhando durante 10 s de invisibilidade; transições de 3 s e recarga de 10 s.'));
 assert.ok(game.includes('Tinta abissal: ao nadar, deixa um rastro de tinta negra'));
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
 assert.ok(game.includes("phase=(p.travelled||0)*.095"));
 assert.ok(game.includes("Math.sin(phase+s*2.7)*5.5"));
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
 for(const token of ["type:'regen-pulse'","type:'ward-collapse'","type:'ricochet-line'","upgrades.lastStand>0&&hp/maxHp<=.3","if(upgrades.predator>0)","if(upgrades.shell>0)","if(upgradeLevels.magnet>0)"]) assert.ok(game.includes(token),token);
});


test('marine replacements preserve distinct bull shark and horseshoe-crab silhouettes',()=>{
 const game=read('public/game.js');
 const shark=game.slice(game.indexOf("else if(id==='abysscroc'){"),game.indexOf("else if(id==='armoredgator'){"));
 const horseshoe=game.slice(game.indexOf("else if(id==='armoredgator'){"),game.indexOf("else if(id==='electriceel'){"));
 assert.ok(shark.includes('Bull shark silhouette'));
 assert.ok(shark.includes('powerful caudal fin'));
 assert.ok(horseshoe.includes('Horseshoe crab silhouette'));
 assert.ok(horseshoe.includes('long telson'));
 assert.notEqual(shark,horseshoe);
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
 assert.ok(game.includes("new Set(['boss','fusion','join','death','cave'])"));
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

test('blue-ring ink and angler camouflage replace the old aberration and angler passives',()=>{
 const game=read('public/game.js'),sim=read('world-simulation.js'),server=read('server.js');
 assert.equal(abilities.incomingDamageMultiplier('aberration'),1);
 assert.equal(abilities.damageMultiplier('angler','common',300,1),1);
 assert.equal(abilities.targetRangeMultiplier('angler'),1);
 assert.match(game,/type:'ink-trail'/);
 assert.match(game,/blue-ring-ink/);
 assert.match(server,/type==='ink-trail'/);
 assert.match(server,/source:'blue-ring-ink'/);
 assert.match(sim,/abilityId:'ink-trail'/);
 assert.match(sim,/p\.skinId==='angler'&&anglerInvisibleAt\(now\)/);
 assert.doesNotMatch(server,/triggerPvpAberrationEcho/);
 assert.doesNotMatch(sim,/aberrationEchoTriggered/);
 assert.match(game,/function enemyHiddenFromAutoTarget/);
 assert.match(game,/if\(enemyHiddenFromAutoTarget\(e\)\)continue/);
});

test('PvP authoritative damage applies skin and learned defensive passives',()=>{
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(server,/function pvpDamageAmount\(/);
 assert.match(server,/SkinAbilities\.damageMultiplier\(attacker\?\.skinId,'player'/);
 assert.match(server,/SkinAbilities\.incomingDamageMultiplier\(target\?\.skinId\)/);
 assert.match(server,/shellLevel\*\.08/);
 assert.match(server,/lastStandLevel/);
 assert.doesNotMatch(server,/triggerPvpAberrationEcho/);
 assert.match(server,/room\.world\.inkTrails/);
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
 assert.match(game,/#8f1028/);
 assert.match(game,/#c4213c/);
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
 assert.match(game,/if\(!primaryTarget\|\|!Number\.isFinite\(baseDamage\)\|\|baseDamage<=0\|\|options\.secondary\)return/);
 assert.match(game,/source==='electric'/);
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
 assert.match(server,/processWorldDamage\(socket,Number\(enemy\.id\),baseDamage,'pulse',batch,'',enemyLookup\)/);
});
test('Gravitational Nova has mode-aware cadence enforced by client and server',()=>{
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(game,/player\.novaTimer=isPvpMode\?2\.4:1\.8/);
 assert.match(server,/cooldown=room\.mode==='pvp'\?2400:1800/);
 assert.match(server,/shooter\.novaShotReadyAt=now\+2400/);
 assert.match(game,/function update\(dt\)\{\r?\n const isPvpMode=onlineRoomMode==='pvp'/);
});


test('resonance always keeps exactly one shot and defaults to electric storm',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes("RESONANCE_DEFAULTS={pve:['electric'"));
 assert.ok(game.includes("if(!clean[mode].some(id=>RESONANCE_CATEGORIES.shots.includes(id)))"));
 assert.ok(game.includes("Você precisa manter exatamente 1 disparo selecionado."));
 assert.ok(game.includes("DISPAROS · ESCOLHA EXATAMENTE 1"));
});

test('photon ray control modes share authoritative endpoints',()=>{
 const game=read('public/game.js');
 const server=read('server.js');
 assert.ok(game.includes("controlSettings.pc==='wasd-aim'"));
 assert.ok(game.includes("controlSettings.mobile==='dual-stick'"));
 assert.ok(game.includes("manualAim:manualPhotonAim"));
 assert.ok(game.includes("beamEndX:x2/W,beamEndY:y2/H"));
 assert.ok(server.includes("const manualAim=payload.manualAim===true"));
 assert.ok(server.includes("shot.beamEndX=clamp(ex/WORLD_WIDTH,0,1)"));
});

test('projectiles dissolve at collision and range end and electric shot is a twisted bolt',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes("function spawnProjectileDissolve"));
 assert.ok(game.includes("if(hit||reachedRange)spawnProjectileDissolve"));
 assert.ok(game.includes("fx.type==='projectile-dissolve'"));
 assert.ok(game.includes("segments=12"));
 assert.ok(game.includes("Math.sin(phase+s*2.7)"));
});


test('selected shot identity is never replaced by passive modifiers',()=>{
 const game=read('public/game.js');
 const server=read('server.js');
 assert.ok(game.includes("const activeShot=getActiveShotId()||'electric'"));
 assert.ok(game.includes("const modifiers={abyssEye:Boolean(upgrades.abyssEye),ricochet:"));
 assert.doesNotMatch(game,/const special=upgrades\.abyssEye/);
 assert.doesNotMatch(game,/activeShot==='photon'\?'#f0abfc':upgrades\.ricochet/);
 assert.ok(server.includes("modifiers:{abyssEye:Boolean(payload.modifiers?.abyssEye)"));
});

test('Abyssal Runic typography and dynamic i18n are global',()=>{
 const html=read('public/index.html');
 const css=read('public/style.css');
 const i18n=read('public/i18n.js');
 assert.ok(html.includes('family=Cinzel:wght@400;500;600;700;800;900'));
 assert.ok(css.includes('--abyssal-runic:"Cinzel"'));
 assert.ok(css.includes('html,body,button,input,select,textarea{font-family:var(--abyssal-runic)!important;}'));
 assert.ok(i18n.includes("attributeFilter:['title','placeholder','aria-label']"));
 assert.ok(i18n.includes("'Tempestade elétrica':'Electric Storm'"));
 assert.doesNotMatch(i18n,/SCHOOAL/);
});


test('Cinzel reaches online CTA and decorative microcopy is removed',()=>{
 const html=read('public/index.html');
 const css=read('public/style.css');
 const game=read('public/game.js');
 assert.ok(html.includes('family=Cinzel:wght@400;500;600;700;800;900'));
 assert.ok(css.includes('#onlineBtn,#onlineBtn *'));
 assert.doesNotMatch(html,/V\. 3\.5\.12/);
 assert.doesNotMatch(html,/UMA EXPERIÊNCIA ARCADE ORIGINAL/);
 assert.doesNotMatch(html,/EXPEDIÇÕES PÚBLICAS E PRIVADAS · ATÉ 6 MERGULHADORES/);
 assert.doesNotMatch(html,/CATÁLOGO DE CRIATURAS/);
 assert.doesNotMatch(game,/Uncial Antiqua/);
});


test('desktop menu keeps login above language and legal links clickable',()=>{
 const html=read('public/index.html');
 const css=read('public/style.css');
 assert.ok(html.includes('account-line menu-account-utility'));
 assert.ok(html.includes('language-setting menu-language-utility'));
 assert.ok(html.includes('href="/terms.html" target="_blank" rel="noopener"'));
 assert.ok(css.includes('#menuScreen .menu-account-utility'));
 assert.ok(css.includes('#menuScreen .menu-language-utility'));
 assert.ok(css.includes('#menuScreen .legal-footer a{position:relative!important;z-index:13!important;pointer-events:auto!important'));
});


test('equipped shot is locked for the whole run and cannot fall back to electric mid-run',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes("let runShotId='electric'"));
 assert.ok(game.includes('runShotId=selectedOpeningShot'));
 assert.ok(game.includes("if(RESONANCE_CATEGORIES.shots.includes(runShotId))return runShotId"));
 assert.doesNotMatch(game,/find\(id=>RESONANCE_CATEGORIES\.shots\.includes\(id\)&&\(Number\(upgradeLevels\[id\]\)\|\|0\)>0\)/);
});

test('electric storm chains from its own primary hit and keeps an extended bolt visual',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.ok(game.includes("if(source==='electric'&&(upgrades.electric||0)>0&&!onlineMode)"));
 assert.ok(server.includes("if(source==='electric'&&Number(attacker.electricLevel)>0)"));
 assert.ok(game.includes('boltLength=Math.max(52/GAME_WORLD_ZOOM,speed*.095)'));
 assert.ok(game.includes('const segments=12'));
});

test('abyss eye remains a modifier on the PvP server instead of replacing shot identity',()=>{
 const server=read('server.js');
 assert.ok(server.includes("shot.modifiers?.abyssEye===true?12"));
 assert.doesNotMatch(server,/duration=shot\.special==='abyssEye'/);
});

test('resonance UI uses Abyssal runic typography with a larger menu label',()=>{
 const css=read('public/style.css');
 assert.ok(css.includes('.resonance-modal button,'));
 assert.ok(css.includes('font-family:var(--abyssal-runic)!important;'));
 assert.ok(css.includes('#menuScreen .resonance-menu-btn{font-size:14px!important;min-height:48px!important;}'));
});


test('level-up pool is frozen from the resonance selected when the run starts',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes('let runResonanceIds=[]'));
 assert.ok(game.includes("runResonanceIds=[...(resonancePresets[onlineRoomMode==='pvp'?'pvp':'pve']||[])]"));
 assert.ok(game.includes('const available=upgradeList.filter(u=>runResonanceIds.includes(u.id)'));
 assert.ok(game.includes("!runResonanceIds.includes(u.id)"));
 assert.ok(game.includes('upgradeList.filter(u=>runResonanceIds.includes(u.id)).every'));
});

test('a non-selected shot cannot be accepted even if injected into an upgrade choice',()=>{
 const game=read('public/game.js');
 assert.ok(game.includes("if(gameState!=='upgrade'||!u||!runResonanceIds.includes(u.id)||(upgradeLevels[u.id]||0)>=3)return;"));
});


test('start menu omits survival record and anchors account utilities to section right',()=>{
 const html=read('public/index.html'),css=read('public/style.css');
 assert.doesNotMatch(html,/MELHOR SOBREVIVÊNCIA/);
 assert.doesNotMatch(html,/class="record-row"/);
 assert.ok(css.includes('MENU SECTION RIGHT RAIL V21'));
 assert.ok(css.includes('#menuScreen{position:relative!important;}'));
 assert.ok(css.includes('right:clamp(24px,3vw,48px)!important;'));
});


test('deploy announces maintenance before shutdown and client shows it immediately',()=>{
 const server=read('server.js'),online=read('public/online.js');
 assert.ok(server.includes("io.emit('server-maintenance'"));
 assert.ok(online.includes("socket.on('server-maintenance'"));
 assert.ok(online.includes("showMaintenanceOverlay('Conexão interrompida. Reconectando ao servidor…')"));
});
test('legal links remain present and escaped newline artifacts are absent',()=>{
 const html=read('public/index.html');
 for(const href of ['/terms.html','/privacy.html','/community.html','/store-policy.html'])assert.ok(html.includes('href="'+href+'"'));
 assert.ok(!html.includes('\\n\\n\\n'));
});


test('menu modals expose a canonical working close action and sticky X',()=>{
 const html=read('public/index.html'),online=read('public/online.js'),css=read('public/style.css');
 for(const [button,screen] of Object.entries({supportCancelBtn:'supportScreen',shopCloseBtn:'shopScreen',wheelCloseBtn:'wheelScreen',roomsCloseBtn:'roomsScreen',cardumesCloseBtn:'cardumesScreen',catalogCloseBtn:'catalogScreen',rankingsCloseBtn:'rankingsScreen',downloadCloseBtn:'downloadScreen'})){
  assert.match(html,new RegExp('id="'+button+'"[^>]*data-close-screen="'+screen+'"'));
 }
 for(const screen of ['supportScreen','roomsScreen','cardumesScreen','catalogScreen','rankingsScreen','downloadScreen'])assert.ok(html.includes('data-close-screen="'+screen+'"'));
 assert.ok(online.includes("event.target.closest?.('[data-close-screen]')"));
 assert.ok(!online.includes('event.stopImmediatePropagation()'));
 assert.ok(css.includes('UNIVERSAL MODAL CLOSE V23'));
 assert.ok(css.includes('position:sticky!important'));
});


test('shared modal closer never suppresses unrelated menu click handlers',()=>{
 const online=read('public/online.js');
 assert.ok(online.includes("document.addEventListener('click',event=>{const button=event.target.closest?.('[data-close-screen]')"));
 assert.doesNotMatch(online,/stopImmediatePropagation\(\)/);
 assert.doesNotMatch(online,/\},true\);\s*window\.addEventListener\('beforeinstallprompt'/);
});
test('successful socket reconnect releases maintenance UI even while expedition restore continues',()=>{
 const online=read('public/online.js');
 assert.ok(online.includes("socket.on('connect',()=>{connected=true;everConnected=true;hideMaintenanceOverlay();"));
});


test('removed start-screen records cannot abort game initialization',()=>{
 const html=read('public/index.html'),game=read('public/game.js');
 assert.ok(!html.includes('id="bestTime"'));
 assert.ok(!html.includes('id="bestScore"'));
 assert.ok(game.includes("const bestTimeEl=$('bestTime'),bestScoreEl=$('bestScore');if(bestTimeEl)"));
 assert.ok(game.includes("const el=$('bestScore');if(el)el.textContent"));
 assert.ok(game.includes("const el=$('bestTime');if(el)el.textContent"));
 assert.ok(game.includes("if($('testWheelBtn'))$('testWheelBtn').disabled="));
});
test('core menu navigation handlers remain registered after initialization guards',()=>{
 const game=read('public/game.js'),online=read('public/online.js'),server=read('server.js');
 for(const id of ['playBtn','resonanceBtn','wheelBtn','shopBtn','catalogBtn','rankingsBtn'])assert.ok(game.includes(id),id+' must remain wired in game.js');
 assert.ok(online.includes('function connectAndJoin()'));
 assert.ok(server.includes("rooms.set(DEFAULT_ROOM_ID"));
 assert.ok(server.includes("rooms.set(PVP_ROOM_ID"));
 assert.ok(server.includes("socket.on('create-room'"));
});


test('legal links stay restored and pinned to bottom-left menu corner',()=>{
 const html=read('public/index.html'),css=read('public/style.css');
 for(const href of ['/terms.html','/privacy.html','/community.html','/store-policy.html'])assert.ok(html.includes('href="'+href+'"'));
 assert.match(css,/LEGAL FOOTER FINAL ANCHOR V24/);
 assert.match(css,/#menuScreen \.menu-footer\{[\s\S]*?position:fixed!important;[\s\S]*?left:max\(12px,[\s\S]*?right:auto!important;[\s\S]*?top:auto!important;[\s\S]*?bottom:max\(10px,/);
 assert.match(css,/#menuScreen\[hidden\] \.menu-footer\{display:none!important;\}/);
});


test('photon ray target controls direction but never shortens beam range',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.ok(game.includes('The target selects direction only. The visible/damaging ray always extends to full range.'));
 assert.ok(game.includes('let beamLength=beamRange,beamTargetId=null;'));
 assert.ok(!game.includes('beamLength=Math.min(beamRange,nearestDistance)'));
 assert.ok(server.includes('The beam endpoint is range-authoritative, never target-authoritative.'));
 assert.ok(server.includes('let length=beamRange;'));
 assert.ok(!server.includes('if(nearest)length=Math.min(length,nearestDistance)'));
});
test('photon ray full-range segment still respects PvP rock occlusion',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.ok(game.includes('projectileHitsPvpWall(player.x,player.y,x2,y2'));
 assert.ok(server.includes('pvpRockAt(sx+ux*distance,sy+uy*distance'));
 assert.ok(server.includes('PhotonRay.segmentCircleHit(sx,sy,ex,ey'));
});


test('online combat predicts presentation but keeps HP server authoritative',()=>{
 const game=read('public/game.js'),online=read('public/online.js'),server=read('server.js');
 assert.ok(game.includes('const predictedCombatHits=new Map()'));
 assert.ok(game.includes('predictCombatImpact(enemy,queuedDamage,skillId,actionId)'));
 assert.ok(game.includes('consumePredictedCombatImpact(data)'));
 assert.ok(online.includes("actionId:String(hit?.actionId||'').slice(0,72)"));
 assert.ok(server.includes("actionId:String(actionId||'').slice(0,72)"));
});
test('authoritative shots carry correlation ids for photon and PvP reconciliation',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.ok(server.includes("actionId:String(payload.actionId||payload.volleyId||'').slice(0,72)"));
 assert.ok(server.includes("processWorldDamage(socket,Number(enemy.id),Math.min(45,Math.max(1,shot.damage||12)),'photonRay',null,shot.actionId,enemyLookup)"));
 assert.ok(game.includes("const predictedKey='pvp:'+String(d.actionId||'')+':'+String(d.targetId||'')"));
});
test('movement keeps local prediction and remote interpolation',()=>{
 const game=read('public/game.js'),online=read('public/online.js');
 assert.ok(game.includes('reconcilePlayer:({dx=0,dy=0,blocked=false}={})=>'));
 assert.ok(online.includes("socket.volatile.emit('player-motion-input'"));
 assert.ok(online.includes('function applyPlayerMotion(rows)'));
 assert.ok(game.includes('function currentInterpolatedEnemyPosition(e,now)'));
});


test('mobile legal links are the final normal-flow menu element instead of an overlay',()=>{
 const html=read('public/index.html'),css=read('public/style.css');
 assert.ok(html.indexOf('class="menu-footer"')>html.indexOf('class="menu-content"'));
 assert.ok(css.includes('MENU LEGAL MOBILE FINAL FLOW V26'));
 assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?#menuScreen \.menu-footer\{[\s\S]*?position:relative!important;[\s\S]*?bottom:auto!important;[\s\S]*?order:999!important;/);
});


test('game source contains no injected literal escaped newline tokens',()=>{
 const game=read('public/game.js');
 assert.ok(!game.includes('\\\\n'),'game.js must use real line breaks, never injected literal backslash-n tokens');
});
