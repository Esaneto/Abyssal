'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const game = read('public/game.js');

test('browser scripts parse before menu event handlers are wired', () => {
  assert.doesNotThrow(() => new vm.Script(read('public/game.js'), { filename: 'public/game.js' }));
  assert.doesNotThrow(() => new vm.Script(read('public/online.js'), { filename: 'public/online.js' }));
});

test('mobile gameplay retains a touch pause button when the top bar is hidden', () => {
  const html = read('public/index.html');
  const game = read('public/game.js');
  const css = read('public/style.css');
  const mobilePauseStyle = css.slice(css.indexOf('.mobile-pause-btn'), css.indexOf('@media(max-width:700px){body.game-active #mobilePauseBtn'));
  assert.match(html, /id="mobilePauseBtn"/);
  assert.match(game, /mobilePauseBtn[^\n]*addEventListener\('click',pauseGame\)/);
  assert.match(css, /@media\(max-width:700px\)\{body\.game-active #mobilePauseBtn\{display:grid\}/);
  assert.match(mobilePauseStyle, /right:max\(56px,calc\(env\(safe-area-inset-right\) \+ 56px\)\)/);
});

test('level-up choice uses the shared codex cache and cannot fail on an undefined codex variable', () => {
  const game = read('public/game.js');
  const start = game.indexOf('function chooseUpgrade(u){');
  const end = game.indexOf('function spawnEnemy(', start);
  assert.ok(start >= 0 && end > start, 'upgrade handlers are present');
  const handlers = game.slice(start, end);
  assert.match(handlers, /discoverCodexSkill\(u\.id\)/);
  assert.doesNotMatch(handlers, /codex\.skills/);
});

test('paid predator skins render species-specific great white, black caiman, and Nile crocodile silhouettes', () => {
  const game = read('public/game.js');
  const start = game.indexOf('function drawCreature(');
  const end = game.indexOf('\nfunction ', start + 1);
  const renderer = game.slice(start, end < 0 ? undefined : end);
  const white = renderer.slice(renderer.indexOf("id==='reefshark'"), renderer.indexOf("id==='hammerhead'"));
  const caiman = renderer.slice(renderer.indexOf("id==='abysscroc'"), renderer.indexOf("id==='armoredgator'"));
  const nile = renderer.slice(renderer.indexOf("id==='armoredgator'"), renderer.indexOf("id==='default'"));
  assert.match(white, /countershading/);
  assert.match(white, /crescent tail/);
  assert.match(caiman, /Black caiman/);
  assert.match(caiman, /rounded head/);
  assert.match(nile, /Nile crocodile/);
  assert.match(nile, /visible teeth/);
  assert.notEqual(caiman, nile, 'the two crocodilians must not share one silhouette branch');
});

test('level-up shows a 25-second countdown and picks a random option if time expires', () => {
  const game = read('public/game.js');
  const html = read('public/index.html');
  assert.match(html, /id="upgradeTimerText"/);
  assert.match(html, /id="upgradeTimerFill"/);
  assert.match(game, /upgradeDeadlineAt=performance\.now\(\)\+25000/);
  assert.match(game, /Math\.floor\(Math\.random\(\)\*available\.length\)/);
  assert.match(game, /clearUpgradeCountdown\(\)/);
});

test('co-op XP orbs visibly move toward the nearest player inside magnet range', () => {
  const sim = require('../world-simulation');
  const ai = require('../public/enemy-ai');
  const world = sim.createWorldState(10000);
  world.initialized = true;
  world.lastTick = 10000;
  world.nextBossAt = 100000;
  world.commonSpawnTimer = 100000;
  world.snapshotTimer = 100000;
  world.reliableSnapshotTimer = 100000;
  world.playerSnapshotTimer = 100000;
  const zoom = Number(ai.WORLD_ZOOM) || 1;
  const distance = 0.65 * 140 / zoom;
  const initialX = 500 + distance;
  world.orbs = [{ id: 1, x: initialX, y: 500, r: 4, value: 2, life: 25, phase: 0 }];
  const player = {
    id: 'magnet-test-player', x: 500, y: 500, r: 10 / zoom,
    alive: true, hp: 100, maxHp: 100, magnetStrength: 1,
    shieldCharges: 0, regenLevel: 0, invulnerableUntil: 0, regenAccumulator: 0
  };
  sim.tickWorld(world, [player], 10100, () => 0.5);
  assert.equal(world.orbs.length, 1, 'test orb should remain available rather than being collected immediately');
  assert.ok(world.orbs[0].x < initialX - 2, 'a distant orb should move noticeably toward the player in one server tick');
});

test('responsive screens avoid visible scrollbars and keep three skill cards in one row', () => {
  const css = read('public/style.css');
  assert.match(css, /\*::-webkit-scrollbar\{display:none!important/);
  assert.match(css, /#upgradeScreen \.upgrade-choices\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-template-columns:minmax\(0,1\.08fr\) minmax\(250px,\.72fr\)/);
});


test('profile back button uses the shared modal close contract', () => {
  const html = read('public/index.html');
  assert.match(html, /id="profileCloseBtn"[^>]*data-close-screen="profileScreen"/);
});


test('closing the online lobby from a finished run restores an interactive main menu', () => {
  const game = read('public/game.js');
  assert.match(game, /function handleRoomsClosed\(\)\{onlineMode=false;if\(gameState==='menu'\)/);
  assert.match(game, /\$\('menuScreen'\)\.hidden=false/);
  assert.match(game, /abyssal-modal-closed[^\n]*handleRoomsClosed\(\)/);
});

test('desktop level-up UI is enlarged without changing the mobile breakpoint', () => {
  const css = read('public/style.css');
  const marker = css.indexOf('Desktop-only level-up readability');
  assert.ok(marker >= 0);
  const desktopRules = css.slice(marker);
  assert.match(desktopRules, /@media\(min-width:701px\)/);
  assert.match(desktopRules, /#upgradeScreen \.modal-card\{width:min\(1040px,94vw\)/);
  assert.match(desktopRules, /#upgradeScreen \.upgrade-card p\{font-size:13px/);
});


test('paid skin ownership survives session restoration and shop refreshes authoritative account', () => {
  const game = read('public/game.js');
  assert.doesNotMatch(game, /ownedSkins=ownedSkins\.filter\(id=>!premiumIds\.has\(id\)\)/);
  assert.match(game, /shopBtn[^\n]*refreshAccount/);
  assert.match(game, /if\(r\.account\)\{window\.dispatchEvent\(new CustomEvent\('abyssal-account-data'/);
  assert.match(game, /equipped\?\(english\?'EQUIPPED':'EQUIPADA'\):owned\?\(english\?'EQUIP':'EQUIPAR'\)/);
});


test('maintenance overlay cannot remain latched after transport reconnect', () => {
  const online = read('public/online.js');
  assert.match(online, /socket\.on\('connect',\(\)=>\{connected=true;everConnected=true;hideMaintenanceOverlay\(\)/);
  assert.match(online, /!sessionToken\)\{failReconnect\('Servidor reconectado/);
  assert.match(online, /if\(reconnectPending\)failReconnect\('Servidor reconectado, mas sua sessão precisa ser validada novamente\.'/);
});


test('resonance taxonomy separates shots, damaging passives and non-damaging buffs', () => {
  assert.match(game, /shots:\\['electric','pierce','spread','photon','photonRay','nova','echoShot'\\]/);
  assert.match(game, /passive:\\['burst','ricochet'\\]/);
  assert.match(game, /buffs:\['power','rate','speed','range','magnet','regen','shield','shell','ward','lastStand','pressureCocoon','vitality','predator','closePressure'\]/);
  assert.doesNotMatch(game, /id:'repulse'/);
  assert.doesNotMatch(game, /defensive:\[/);
  assert.match(game, /\['passive','PASSIVAS'\],\['buffs','BUFFS'\]/);
});

test('damage numbers use red for shots and blue for damaging passives', () => {
  assert.match(game, /number\.tone==='passive'\?'#32cfff':'#ff174d'/);
  assert.match(game, /RESONANCE_CATEGORIES\.passive\.includes\(id\).*return 'passive'/s);
});

test('gameplay canvas follows actual game shell geometry', () => {
  assert.match(game, /new ResizeObserver\(\(\)=>\{if\(document\.body\.classList\.contains\('game-active'\)\)resize\(\);\}\)/);
  assert.match(game, /canvas\.style\.width=viewW\+'px';canvas\.style\.height=viewH\+'px'/);
});


test('electric storm is visually distinct from ricochet and uses the same bounce reach', () => {
  assert.match(game, /range=190\/GAME_WORLD_ZOOM/);
  assert.match(game, /segments=13/);
  assert.match(game, /shadowColor='#31eaff'/);
  assert.match(game, /type:'ricochet-line'.*color:'#f7ff19'/s);
});

test('mob damage numbers remain readable at fixed screen scale', () => {
  assert.match(game, /ctx\.font='900 112px var\(--abyssal-runic\),Georgia,serif'/);
});


test('floating damage numbers render in fixed screen pixels independent of camera zoom', () => {
 assert.match(game, /screenX=\(worldX-cameraX\)\*worldZoom/);
 assert.match(game, /ctx\.setTransform\(dpr,0,0,dpr,0,0\)/);
 assert.match(game, /ctx\.font='900 112px var\(--abyssal-runic\),Georgia,serif'/);
 assert.match(game, /number\.tone==='passive'\?'#32cfff':'#ff174d'/);
});


test('deploy resume does not depend on stale onlineMode ordering', () => {
 assert.match(game, /const canResume=Boolean\(d\.reconnected&&d\.resumedRun&&player\)/);
 assert.doesNotMatch(game, /d\.reconnected&&d\.resumedRun&&onlineMode&&player/);
});

test('Q and E ignore keyboard auto-repeat', () => {
 assert.match(game, /!e\.repeat&&\(e\.key==='q'\|\|e\.key==='Q'\)/);
 assert.match(game, /!e\.repeat&&\(e\.key==='e'\|\|e\.key==='E'\)/);
});


test('deploy resume explicitly restores the gameplay visual state even if client transiently entered menu', () => {
 const handler=game.slice(game.indexOf("window.addEventListener('abyssal-room-joined'"),game.indexOf("window.addEventListener('abyssal-room-created'"));
 assert.match(handler,/screens\.forEach\(id=>\$\(id\)\.hidden=true\)/);
 assert.match(handler,/document\.body\.classList\.add\('game-active'\)/);
 assert.match(handler,/\$\('toggleHudBtn'\)\.hidden=false/);
 assert.match(handler,/setMobileGameActive\(true\)/);
});


test('successful room join has an atomic DOM-safe path into gameplay', () => {
 assert.match(game,/function enterOnlineGameplay\(data\)/);
 assert.match(game,/for\(const id of \[\.\.\.screens,'roomsScreen','loginScreen'\]\)/);
 assert.match(game,/if\(hud\)hud\.hidden=false/);
 assert.match(game,/if\(toggle\)toggle\.hidden=false/);
 assert.match(game,/catch\(error\)\{console\.error\('\[online-entry\] Falha ao ativar gameplay:'/);
});


test('authoritative room join commits menu exit before fallible arena setup', () => {
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 const start=game.indexOf('function enterOnlineGameplay');
 const end=game.indexOf('function activateOnlineEntry',start);
 const handler=game.slice(start,end);
 assert.ok(handler.indexOf("node.hidden=true")>=0);
 assert.ok(handler.indexOf("document.body.classList.add('game-active')")>=0);
 assert.ok(handler.indexOf('try{createArenaRocks();}')>=0);
 assert.ok(handler.indexOf("node.hidden=true")<handler.indexOf('try{createArenaRocks();}'));
 assert.ok(handler.indexOf("document.body.classList.add('game-active')")<handler.indexOf('try{createArenaRocks();}'));
});

test('online entry fallback cannot return the client to a visible menu after server acceptance', () => {
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 const start=game.indexOf('function activateOnlineEntry');
 const end=game.indexOf("window.addEventListener('abyssal-room-joined'",start);
 const handler=game.slice(start,end);
 assert.match(handler,/if\(menu\)menu\.hidden=true/);
 assert.match(handler,/onlineMode=true;gameState='playing'/);
 assert.match(handler,/return true/);
});


test('online reconnect retry state used during room join is declared', () => {
 const online=fs.readFileSync(path.join(__dirname,'..','public','online.js'),'utf8');
 assert.match(online,/reconnectSessionRetry=null/);
 assert.match(online,/reconnectSessionAttempts=0/);
 assert.ok(online.indexOf('reconnectSessionRetry=null') < online.indexOf('function clearReconnectWatchdog'));
 assert.ok(online.indexOf('reconnectSessionAttempts=0') < online.indexOf('function clearReconnectWatchdog'));
});


test('damage indicator canvas font uses the current valid concrete 18px family', () => {
 const game=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
 assert.match(game,/ctx\.font='900 18px Cinzel, Georgia, serif'/);
 assert.doesNotMatch(game,/ctx\.font='900 18px var\(--abyssal-runic\)/);
});
