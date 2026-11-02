(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let mobileViewport=window.matchMedia('(pointer: coarse)').matches||window.innerWidth<=700;
let lowPowerRendering=false,backgroundGradientCache=null,backgroundBloomCache=null,lastPaintAt=0;
const $ = id => document.getElementById(id);
const screens = ['menuScreen','upgradeScreen','pauseScreen','gameOverScreen'];
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const wrapGameCoordinate=(v,size)=>((v%size)+size)%size;
const rand = (a,b)=>a+Math.random()*(b-a);
const wrappedDelta=(a,b,size)=>a-b;
const dist = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
// Escape untrusted room/nickname text before inserting it into lobby markup.
function escapeHtml(value){return String(value??'').replace(/[&<>\"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[character]));}
const GAME_WORLD_ZOOM=.78;
let W=4800,H=3000,viewW=800,viewH=500,worldZoom=.78,mapFactor=1.7,cameraX=0,cameraY=0,dpr=1,last=0,elapsed=0,score=0,level=1,xp=0,xpNeed=10,hp=100,maxHp=100,gameState='menu',soundOn=true,nextBossAt=60,lastBossMaxHp=0,lastBossDamage=0,lastBossSpeed=0,bossKillsThisRun=0,runProgressTimer=0;
let player=null,botBuddy=null,enemies=[],orbs=[],particles=[],projectiles=[],effects=[],decor=[],arenaRocks=[],upgrades={},upgradeLevels={},chosen=[],spawnTimer=0,enemyId=0,shake=0,damageFlash=0,runSeed=0,bossIndex=0;
let onlineEnemyById=new Map(),onlineOrbById=new Map(),onlineDamageQueue=[];
let autoFollowCursor=false;
let bestScore=Number(localStorage.getItem('abyssalBestScore')||0),bestTime=Number(localStorage.getItem('abyssalBestTime')||0);
let bossProgressionCycle=0,bossCycleStreak=0,bossCycleBosses=[],bossCycleIndex=0,progressionDistance=0,progressionPausedForBoss=false,activeBossEntity=null,bossVictoryPending=false;
let runResultPending=false;
let snapshotClock=0,upgradeAutoTimer=null,upgradeCountdownInterval=null,upgradeDeadlineAt=0,upgradeOptions=[],sharedXpApplying=false,lastBossKind=null,lastRemoteBossId=null,metaUpgrades=JSON.parse(localStorage.getItem('abyssalMetaUpgrades')||'{}'),wheelBusy=false,wheelAngle=0,bossAlertTimer=null,alertedBossIds=new Set(),authoritativeElapsed=null,lastSnapshotAt=0,lastSnapshotTick=0,lastAuthoritativeWorldId=null,lastAuthoritativeSnapshotSeq=0,lastAuthoritativeServerTime=0,pendingOnlineHitVitals=[],authoritativeSnapshotHistory=new Map();
let cachedAbyssalCodex=null,cachedCodexMonsterIds=null,codexSavePending=false;
function getAbyssalCodex(){
 if(!cachedAbyssalCodex){
  try{cachedAbyssalCodex=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}')}catch{cachedAbyssalCodex={skills:[],monsters:[]}}
  if(!cachedAbyssalCodex||typeof cachedAbyssalCodex!=='object')cachedAbyssalCodex={skills:[],monsters:[]};
  if(!Array.isArray(cachedAbyssalCodex.skills))cachedAbyssalCodex.skills=[];
  if(!Array.isArray(cachedAbyssalCodex.monsters))cachedAbyssalCodex.monsters=[];
  cachedCodexMonsterIds=new Set(cachedAbyssalCodex.monsters.map(String));
 }
 return cachedAbyssalCodex;
}
function scheduleCodexSave(){
 if(codexSavePending)return;
 codexSavePending=true;
 setTimeout(()=>{codexSavePending=false;try{localStorage.setItem('abyssalCodex',JSON.stringify(getAbyssalCodex()))}catch(error){console.warn('Não foi possível salvar o catálogo local.',error)}},800);
}
function discoverCodexMonsters(items){
 const codex=getAbyssalCodex();let changed=false;
 for(const item of items||[]){
  const kind=String(typeof item==='string'?item:item?.kind||'').trim();
  if(!kind||cachedCodexMonsterIds.has(kind))continue;
  cachedCodexMonsterIds.add(kind);codex.monsters.push(kind);changed=true;
 }
 if(changed)scheduleCodexSave();
}
function discoverCodexSkill(skillId){
 const codex=getAbyssalCodex(),id=String(skillId||'').trim();
 if(!id||codex.skills.includes(id))return;
 codex.skills.push(id);scheduleCodexSave();
}
let onlineMovementStalledSnapshots=0,onlineMovementConfirmedSnapshots=0,onlineClientMovementFallback=false,lastServerEnemyPositions=new Map(),onlineVisualMovingEnemies=0,onlineVisualEnemyCount=0,onlineMotionWatchdog=window.AbyssalEnemyNetcode?.createMotionWatchdog({motionEpsilon:.35,healthyRatio:.18,resumeAfter:4,stallAfter:3})||null;
let coins=Number(localStorage.getItem('abyssalCoins')||0),equippedSkin=localStorage.getItem('abyssalSkin')||'default',onlineMode=false,wasOnlineModeOnDeath=false,botBuddyTimer=0;
let masterSoundVolume=Number(localStorage.getItem('abyssalSoundVolume')??0.8);
let sharkWakeTrails=[];
const skinData=[
{id:'default',name:'Luz Abissal',color:'#75f8ed',price:0,paid:false,shape:'orb',desc:'Um núcleo vivo de luz bioluminescente, cercado por filamentos de maré.',ability:'Ressonância de retorno: concede 12% mais experiência ao recolher orbes.'},
{id:'violet',name:'Espectro Violeta',color:'#bd91ff',price:100,paid:true,shape:'horns',desc:'Um espectro luminescente com cornos de energia violeta.',ability:'Ressonância espectral: a cada 10 segundos, libera uma onda violeta que causa dano aos inimigos próximos.'},
{id:'solar',name:'Núcleo Solar',color:'#ffd078',price:2500,paid:false,shape:'spikes',desc:'Espinhos dourados como fragmentos de uma estrela afogada.',ability:'Sobrecarga solar: dispara 18% mais rápido.'},
{id:'toxic',name:'Lodo Tóxico',color:'#a7ff78',price:4000,paid:false,shape:'tentacles',desc:'Tentáculos ácidos terminados em glândulas que brilham em verde.',ability:'Veneno de maré: todos os ataques causam 12% mais dano.'},
{id:'leviathan',name:'Leviatã Cego',color:'#ff668f',price:6500,paid:true,shape:'leviathan',desc:'Uma forma alongada com placas dorsais e olhos sensoriais apagados.',ability:'Caçador de colossos: causa 25% mais dano aos bosses.'},
{id:'thorn',name:'Coroa de Espinhos',color:'#ff9b6a',price:8000,paid:false,shape:'coral',desc:'Galhos de coral negro crescem como uma coroa predatória.',ability:'Espinhos reativos: causa 24% mais dano a inimigos próximos.'},
{id:'abyssking',name:'Rei do Vazio',color:'#8b7cff',price:10000,paid:false,shape:'king',desc:'Uma coroa óssea sobre um núcleo imperial de luz violeta.',ability:'Escudo régio: começa cada mergulho com uma carga extra de escudo.'},
{id:'royal',name:'Abismo Real',color:'#ff78d0',price:12000,paid:false,shape:'halo',desc:'Uma auréola de pérolas luminescentes envolve esta criatura rara.',ability:'Essência da realeza: concede 25% mais experiência ao recolher orbes.'},
{id:'glacier',name:'Glaciar Fantasma',color:'#91caff',price:13000,paid:false,shape:'crystal',desc:'Cristais de gelo marinho crescem em torno do seu corpo espectral.',ability:'Permafrost: reduz em 26% a velocidade de inimigos próximos.'},
{id:'coral',name:'Jardim Carnívoro',color:'#ff6f9d',price:6000,paid:false,shape:'coral',desc:'Corais rubros, espinhos calcificados e filamentos de anêmona.',ability:'Jardim vivo: recupera até 4 pontos de vida ao eliminar uma criatura.'},
{id:'bloodmoon',name:'Lua Sangrenta',color:'#ff3c66',price:9000,paid:false,shape:'fangs',desc:'Uma mandíbula dupla e presas pálidas sob um brilho carmesim.',ability:'Fome rubra: causa 30% mais dano quando a vida cai a 35% ou menos.'},
{id:'voidwing',name:'Asa do Nada',color:'#b2a0ff',price:15000,paid:false,shape:'wings',desc:'Membranas espectrais se abrem como asas de uma criatura antiga.',ability:'Corrente ascendente: aumenta a velocidade de movimento em 18%.'},
{id:'abyssaleye',name:'Olho do Insondável',color:'#66f0ff',price:18000,paid:false,shape:'eye',desc:'Uma íris colossal observa em várias direções ao mesmo tempo.',ability:'Olho caçador: aumenta em 20% o alcance de aquisição de alvos.'},
{id:'deepwarden',name:'Carcereiro das Fossas',color:'#b8d6c6',price:14000,paid:false,shape:'shell',desc:'Três placas minerais protegem um núcleo verde-fantasma.',ability:'Carapaça abissal: reduz em 18% o dano recebido.'},
{id:'kraken',name:'Kraken do Abismo',color:'#8b5cf6',price:30000,paid:true,shape:'kraken',desc:'Uma entidade das fossas com oito tentáculos robustos, pontas afiadas e olhos violeta que emergem da escuridão.',ability:'Varredura tentacular: a cada 12 segundos, atinge até seis inimigos próximos.'},
 {id:'aberration',name:'Máscara da Aberração',color:'#ff315f',price:16000,paid:true,shape:'aberration',desc:'A carapaça óssea e os apêndices curvos da primeira entidade colossal.',ability:'Eco rubro: o primeiro impacto sofrido em cada mergulho gera uma pequena onda de repulsão.'},
 {id:'angler',name:'Lanterna Mortal',color:'#ffb45e',price:19000,paid:true,shape:'angler',desc:'A isca incandescente e a mandíbula de agulhas do peixe-pescador abissal.',ability:'Isca predatória: aumenta em 10% o dano contra criaturas a longa distância.'},
 {id:'maw',name:'Mandíbula da Fenda',color:'#c16cff',price:22000,paid:true,shape:'maw',desc:'Uma boca circular de dentes radiais, cercada por filamentos de caça.',ability:'Mordida de fenda: aumenta em 12% o dano contra inimigos próximos.'},
 {id:'devourer',name:'Devorador do Vazio',color:'#39d8c4',price:35000,paid:true,shape:'devourer',desc:'A silhueta bojuda e a boca descomunal da criatura que engole correntes inteiras.',ability:'Vácuo residual: após eliminar um boss, atrai orbes próximos por alguns segundos.'},
{id:'reefshark',name:'Tubarão-branco',color:'#91c4ce',price:499,paid:true,shape:'greatwhite',desc:'Um grande tubarão branco de dorso cinza, ventre claro e nadadeiras em foice.',ability:'Gira a cauda em um golpe frontal, deixando um rastro de espuma azul que fere inimigos atravessados.'},
{id:'hammerhead',name:'Tubarão-martelo',color:'#73b6cd',price:499,paid:true,shape:'hammerhead',desc:'O cefalofólio largo e os olhos laterais denunciam um tubarão-martelo.',ability:'Eletrorecepção: atrai orbes de experiência de 50% mais longe.'},
{id:'abysscroc',name:'Jacaré-açu',color:'#518d68',price:499,paid:true,shape:'alligator',desc:'Focinho largo, pernas curtas, cauda forte e placas de um jacaré-açu.',ability:'Mordida de emboscada: uma arrancada baixa e explosiva que causa dano em cone à frente.'},
{id:'armoredgator',name:'Crocodilo-do-nilo',color:'#b59a65',price:499,paid:true,shape:'crocodile',desc:'Focinho triangular, escamas rugosas e armadura dorsal de crocodiliano.',ability:'Giro do Nilo: rotação de cauda que repele inimigos próximos e cria uma onda de impacto.'},
{id:'greensnake',name:'Serpente Esmeralda',color:'#2ee88a',price:0,paid:false,shape:'serpent',desc:'Uma serpente colossal das profundezas, esculpida em escamas de jade reluzentes com olhos de âmbar.',ability:'Soberania Ofídica: concede 20% mais velocidade e veneno corrosivo que amplifica o dano.'},
  {id:'electriceel',name:'Enguia Elétrica',color:'#38e8ff',price:0,paid:false,shape:'eel',desc:'Enguia abissal de corpo sinuoso que gera descargas bioelétricas contínuas através da água salgada.',ability:'Descarga Estática: Seus ataques irradiam eletricidade paralisando brevemente (0,1s) os inimigos atingidos.'},
];
const SkinAbilities=window.AbyssalSkinAbilities;
let ownedSkins=JSON.parse(localStorage.getItem('abyssalOwnedSkins')||'["default"]');
let gameLanguage=['en','es'].includes(localStorage.getItem('abyssalLanguage'))?localStorage.getItem('abyssalLanguage'):'pt';
let shopCurrency='brl';
let shopRates={brl:1};
function setGameLanguage(language){gameLanguage=['en','es'].includes(language)?language:'pt';localStorage.setItem('abyssalLanguage',gameLanguage);shopCurrency='brl';const languageSelect=$('languageSelect');if(languageSelect)languageSelect.value=gameLanguage;const currencySelect=$('shopCurrency');if(currencySelect)currencySelect.value='brl';renderShop();window.dispatchEvent(new CustomEvent('abyssal-language-change',{detail:{language:gameLanguage,currency:'brl'}}));}
if(!window.AbyssalOnline?.isAuthenticated()){const premiumIds=new Set(skinData.filter(skin=>skin.paid).map(skin=>skin.id));ownedSkins=ownedSkins.filter(id=>!premiumIds.has(id));if(premiumIds.has(equippedSkin))equippedSkin='default';}
function saveCosmetics(){localStorage.setItem('abyssalCoins',String(coins));localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));localStorage.setItem('abyssalMetaUpgrades',JSON.stringify(metaUpgrades));if(window.AbyssalOnline?.saveCosmetics)window.AbyssalOnline.saveCosmetics({ownedSkins,equippedSkin,metaUpgrades});}
function currentSkinColor(){return (skinData.find(s=>s.id===equippedSkin)||skinData[0]).color;}
let pointer={x:0,y:0,down:false,active:false},keys={},joystickVector={x:0,y:0,active:false,pointerId:null};
const MAX_ENEMIES=400,MAX_BOSSES=4,MAX_COMMON_ENEMIES=MAX_ENEMIES-MAX_BOSSES;
const particleBudget=()=>isMobileDevice()?240:520, projectileBudget=()=>isMobileDevice()?100:160, effectBudget=()=>isMobileDevice()?64:120, orbBudget=()=>isMobileDevice()?100:180;
const BOSS_KINDS=['boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer'];
const BOSS_LABELS=Object.freeze({boss:'ABERRAÇÃO ABISSAL',leviathan:'LEVIATÃ DAS FOSSAS',maw:'A BOCA DO ABISMO',angler:'LANTERNA MORTAL',whiteSharkBoss:'TUBARÃO-BRANCO · O DEVORADOR PELÁGICO',kraken:'KRAKEN · SENHOR DAS FOSSAS',devourer:'DEVORADOR DO VAZIO'});
const PROFILE_TITLE_NAMES=Object.freeze({'abyss-drifter':'Mergulhador das Fossas','abyss-spark':'Faísca das Fossas','current-hunter':'Caçador de Correntes','pelagic-executioner':'Carrasco Pelágico','leviathan-hunter':'Caçador de Leviatãs','sovereign-abyss':'Soberano do Insondável','shoal-founder':'Fundador do Cardume','supporter-of-the-depths':'Apoio das Profundezas','abyssal-famous':'Nome Conhecido','abyssal-icon':'Ícone do Abismo','living-legend':'Lenda Viva','abyssal-patron':'Patrono do Abismo','boss-abyssal':'Boss Abyssal'});
const PROFILE_TITLE_COLORS=Object.freeze({'abyss-drifter':'#79f3f0','abyss-spark':'#8cf8ff','current-hunter':'#b39cff','pelagic-executioner':'#ff829b','leviathan-hunter':'#ffd27a','sovereign-abyss':'#e0b7ff','shoal-founder':'#73e7c3','supporter-of-the-depths':'#ff9fca','abyssal-famous':'#ffb0d9','abyssal-icon':'#f2a8ff','living-legend':'#ffe29b','abyssal-patron':'#ffd27a','boss-abyssal':'#ff6b9d'});
const particlePool=[];
const hostileSpriteCache=new Map();
let enemyCollisionGrid=new Map(),enemyCollisionCellSize=270,enemyCollisionBuckets=[],enemyCollisionBucketCount=0;
const projectileCandidates=[];
// Reused objects/arrays for the hot enemy-update path (up to 400 entities per frame).
const soloEnemyMovementResult={};
const soloEnemyMovementOptions={minX:0,maxX:W,minY:0,maxY:H,stopDistance:0};
let selectedSkillsRenderedSignature=null,lastHudUpdateAt=0,lastAbilityUiAt=-Infinity,lastSoloRankingValue=null;
const BACKGROUND_BEAM_COLORS=['#47e5dc','#5369ad','#ad3b69','#317b94','#714c9e'];
let arenaVortexLayoutKey='',arenaVortexLayoutCache=[],arenaVortexGradientKey='';
let arenaVortexGlowGradients=new Map();
function getArenaVortices(){
 const key=W+':'+H;
 if(key!==arenaVortexLayoutKey){arenaVortexLayoutKey=key;arenaVortexLayoutCache=[{x:138,y:138,label:'FENDA I',phase:0},{x:W-138,y:138,label:'FENDA II',phase:1.2},{x:138,y:H-138,label:'FENDA III',phase:2.4},{x:W-138,y:H-138,label:'FENDA IV',phase:3.6}];}
 return arenaVortexLayoutCache;
}
function getArenaVortexGlow(vortex){
 const key=W+':'+H+':'+worldZoom;
 if(key!==arenaVortexGradientKey){arenaVortexGradientKey=key;arenaVortexGlowGradients=new Map();}
 let gradient=arenaVortexGlowGradients.get(vortex.label);
 if(!gradient){const radius=58/worldZoom*1.9*1.1;gradient=ctx.createRadialGradient(vortex.x,vortex.y,1,vortex.x,vortex.y,radius);gradient.addColorStop(0,'rgba(49,215,218,.18)');gradient.addColorStop(.55,'rgba(43,135,164,.08)');gradient.addColorStop(1,'rgba(10,35,52,0)');arenaVortexGlowGradients.set(vortex.label,gradient);}
 return gradient;
}
const isMobileDevice=()=>mobileViewport;
function setMobileGameActive(active){mobileViewport=window.matchMedia('(pointer: coarse)').matches||window.innerWidth<=700;const enabled=Boolean(active)&&isMobileDevice();document.body.classList.toggle('mobile-game-active',enabled);document.documentElement.classList.toggle('mobile-game-active',enabled);const stick=$('mobileJoystick');if(stick)stick.hidden=true;if(!enabled){joystickVector={x:0,y:0,active:false,pointerId:null};stick?.classList.remove('is-floating');if(stick){stick.style.left='';stick.style.top='';stick.style.bottom='';stick.style.transform='';}}resize();}
let hudCollapsed=false;
function setHudCollapsed(collapsed){hudCollapsed=Boolean(collapsed);document.body.classList.toggle('hud-collapsed',hudCollapsed);const button=$('toggleHudBtn');if(button){button.textContent=hudCollapsed?'‹':'›';button.setAttribute('aria-label',hudCollapsed?'Mostrar habilidades e ranking':'Ocultar habilidades e ranking');button.title=hudCollapsed?'Mostrar habilidades e ranking':'Ocultar habilidades e ranking';}}
$('toggleHudBtn')?.addEventListener('click',()=>setHudCollapsed(!hudCollapsed));
window.addEventListener('abyssal-player-suction-pull',event=>{if(!onlineMode||!player)return;const d=event.detail||{},dx=Number(d.dx)||0,dy=Number(d.dy)||0;if(!dx&&!dy)return;player.x=clamp(player.x+dx,player.r,W-player.r);player.y=clamp(player.y+dy,player.r,H-player.r);updateCamera();});
let audioCtx=null,lastShot=0,lastHit=0,toastTimer=null,ambientNodes=null;
$('bestTime').textContent=fmtTime(bestTime);$('bestScore').textContent=bestScore.toLocaleString('pt-BR');

// The logical world is shared across devices; mobile uses a smaller zoom to reveal more of that same world.

/*** SISTEMA DE NOTIFICAÇÕES PERSISTENTE (7 DIAS + EXCLUSÃO MANUAL) ***/
const NOTIF_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function getStoredNotifications() {
  try {
    const raw = localStorage.getItem('abyssalNotifications');
    const list = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    // Excluir automaticamente notificações com mais de 7 dias
    const valid = list.filter(item => (now - (Number(item.timestamp) || now)) < NOTIF_EXPIRY_MS);
    if (valid.length !== list.length) {
      localStorage.setItem('abyssalNotifications', JSON.stringify(valid));
    }
    return valid;
  } catch(e) {
    return [];
  }
}

function saveNotifications(list) {
  try {
    localStorage.setItem('abyssalNotifications', JSON.stringify(list));
    updateNotifBadge();
  } catch(e) {}
}

function addNotification(message, title = 'NOTIFICAÇÃO ABISSAL', type = 'info') {
  const list = getStoredNotifications();
  const newItem = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    title,
    message,
    type,
    timestamp: Date.now()
  };
  list.unshift(newItem);
  if (list.length > 30) list.pop();
  saveNotifications(list);
  updateNotifBadge();
  showToast(`${title}: ${message.slice(0, 50)}...`);
}

function deleteNotification(id) {
  let list = getStoredNotifications();
  list = list.filter(item => item.id !== id);
  saveNotifications(list);
  updateNotifBadge();
}

function clearAllNotifications() {
  saveNotifications([]);
  updateNotifBadge();
}

function updateNotifBadge() {
  const btn = $('#notifBtn');
  if (!btn) return;
  const list = getStoredNotifications();
  let dot = btn.querySelector('.notification-badge-dot');
  if (list.length > 0) {
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'notification-badge-dot';
      btn.appendChild(dot);
    }
  } else if (dot) {
    dot.remove();
  }
}

function showNotification(message, title = 'NOTIFICAÇÃO ABISSAL') {
  addNotification(message, title);
  updateNotifBadge();
}

function showEndOfRun(coinsEarned) {
  // Notificação de moedas enviada apenas uma vez ao fim da partida
  const amount = Number(coinsEarned) || 0;
  const msg = amount > 0
    ? 'Expedição encerrada! Você acumulou ' + amount.toLocaleString('pt-BR') + ' moedas abissais nesta partida.'
    : 'O mergulho terminou. Volte às profundezas para acumular mais moedas abissais!';
  addNotification(msg, 'FIM DE MERGULHO ⚓', 'coins');
  updateNotifBadge();
}

updateNotifBadge();
// Mobile reveals five times more world than before while desktop keeps its current framing.
// Mantém escala de combate legível no celular; evita zoom extremo que prejudica leitura e controle.
function desiredWorldZoom(){return isMobileDevice() ? .5 : .78;}
function desiredMapFactor(){return 1.7;}
function updateCamera(){
 if(!player){cameraX=0;cameraY=0;return;}
 const visibleWorldW=viewW/worldZoom,visibleWorldH=viewH/worldZoom;
 cameraX=clamp(player.x-visibleWorldW*.5,0,Math.max(0,W-visibleWorldW));
 cameraY=clamp(player.y-visibleWorldH*.5,0,Math.max(0,H-visibleWorldH));
}
function resize(){
 const r=$('gameShell').getBoundingClientRect();
 const oldW=W,oldH=H;
 viewW=Math.max(320,r.width);viewH=Math.max(300,r.height);
 mobileViewport=window.matchMedia('(pointer: coarse)').matches||window.innerWidth<=700;
 const cores=Number(navigator.hardwareConcurrency)||4,memory=Number(navigator.deviceMemory)||0;
 lowPowerRendering=mobileViewport||cores<=4||(memory>0&&memory<=4);
 // Canvas pixel cost grows quadratically with DPR; cap buffer resolution on constrained devices.
 dpr=Math.min(window.devicePixelRatio||1,lowPowerRendering?1:1.45);
 worldZoom=desiredWorldZoom();mapFactor=desiredMapFactor();
 W=4800;H=3000;mapFactor=1.7;
 const sx=oldW>0?W/oldW:1,sy=oldH>0?H/oldH:1;
 if(player){player.x*=sx;player.y*=sy;player.r=13/GAME_WORLD_ZOOM;player.moveSpeed=150/GAME_WORLD_ZOOM;player.x=clamp(player.x,24/GAME_WORLD_ZOOM,W-24/GAME_WORLD_ZOOM);player.y=clamp(player.y,24/GAME_WORLD_ZOOM,H-24/GAME_WORLD_ZOOM);}
 for(const list of [enemies,orbs,particles,projectiles])for(const o of list){if(Number.isFinite(o.x))o.x*=sx;if(Number.isFinite(o.y))o.y*=sy;if(Number.isFinite(o.x1))o.x1*=sx;if(Number.isFinite(o.x2))o.x2*=sx;if(Number.isFinite(o.y1))o.y1*=sy;if(Number.isFinite(o.y2))o.y2*=sy;if(Number.isFinite(o.interpFromX))o.interpFromX*=sx;if(Number.isFinite(o.interpFromY))o.interpFromY*=sy;if(Number.isFinite(o.interpTargetX))o.interpTargetX*=sx;if(Number.isFinite(o.interpTargetY))o.interpTargetY*=sy;}
 for(const o of effects){if(Number.isFinite(o.x))o.x*=sx;if(Number.isFinite(o.y))o.y*=sy;if(Number.isFinite(o.x1))o.x1*=sx;if(Number.isFinite(o.x2))o.x2*=sx;if(Number.isFinite(o.y1))o.y1*=sy;if(Number.isFinite(o.y2))o.y2*=sy;}
 canvas.width=Math.floor(viewW*dpr);canvas.height=Math.floor(viewH*dpr);
 backgroundGradientCache=null;backgroundBloomCache=null;
 ctx.setTransform(dpr*worldZoom,0,0,dpr*worldZoom,0,0);
 createDecor();createArenaRocks();updateCamera();
}
function createDecor(){
 decor=[];const count=isMobileDevice()?64:110;
 for(let i=0;i<count;i++)decor.push({x:Math.random()*W,y:Math.random()*H,r:rand(.5,2.2)/worldZoom,a:rand(.08,.42),speed:rand(4,22)/worldZoom,phase:rand(0,Math.PI*2)});
}
function createArenaRocks(){
 arenaRocks=[];const spacing=95/worldZoom,offset=24/worldZoom;
 const add=(x,y,edge)=>{const radius=rand(17,37)/worldZoom;const vertices=[];const n=7+Math.floor(Math.random()*3);for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2;const rr=radius*rand(.66,1.24);vertices.push([Math.cos(a)*rr,Math.sin(a)*rr]);}arenaRocks.push({x,y,r:radius,edge,vertices,shade:Math.random()});};
 for(let x=offset;x<W;x+=spacing){add(x,rand(8,34)/worldZoom,'top');add(x,H-rand(8,34)/worldZoom,'bottom');}
 for(let y=offset;y<H;y+=spacing){add(rand(8,34)/worldZoom,y,'left');add(W-rand(8,34)/worldZoom,y,'right');}
 // Anchor stones at the four corners keep the boundary readable even when the camera is near an edge.
 for(const [x,y] of [[offset,offset],[W-offset,offset],[offset,H-offset],[W-offset,H-offset]])for(let i=0;i<3;i++)add(clamp(x+rand(-22,22)/worldZoom,0,W),clamp(y+rand(-22,22)/worldZoom,0,H),'corner');
}

// Controle Interativo de Volume

// ==========================================
// SISTEMA DE NOTIFICAÇÕES — PAINEL FLUTUANTE
// ==========================================
function renderNotifPanel() {
  var panel = document.getElementById('notifPanel');
  var list  = document.getElementById('notifPanelList');
  if (!panel || !list) return;
  var items = getStoredNotifications();
  if (!items.length) {
    list.innerHTML = '<div class="notif-empty"><span class="notif-empty-icon">🔔</span>Nenhuma notificação no momento.<br>Recompensas, títulos e moedas aparecem aqui.</div>';
  } else {
    var html = '';
    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii];
      var d = new Date(item.timestamp);
      var timeStr = d.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'}) + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      html += '<div class="notif-item" role="listitem">' +
        '<div class="notif-item-top">' +
          '<span class="notif-item-title">' + escapeHtml(item.title) + '</span>' +
          '<button class="notif-item-del" data-nid="' + item.id + '" title="Excluir">🗑️</button>' +
        '</div>' +
        '<p class="notif-item-msg">' + escapeHtml(item.message) + '</p>' +
        '<span class="notif-item-time">' + timeStr + '</span>' +
      '</div>';
    }
    list.innerHTML = html;
    list.querySelectorAll('[data-nid]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteNotification(btn.dataset.nid);
        renderNotifPanel();
        updateNotifBadge();
      });
    });
  }
  // Botão de limpar tudo
  var existing = panel.querySelector('.notif-clear-all');
  if (existing) existing.remove();
  if (items.length > 0) {
    var clearBtn = document.createElement('button');
    clearBtn.className = 'notif-clear-all';
    clearBtn.textContent = 'LIMPAR TUDO';
    clearBtn.addEventListener('click', function() {
      clearAllNotifications();
      renderNotifPanel();
      updateNotifBadge();
    });
    document.getElementById('notifPanelList').parentElement.insertBefore(clearBtn, document.getElementById('notifPanelList'));
  }
}

function openNotifPanel() {
  var panel = document.getElementById('notifPanel');
  if (!panel) return;
  renderNotifPanel();
  panel.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeNotifPanel() {
  var panel = document.getElementById('notifPanel');
  if (!panel) return;
  panel.hidden = true;
  document.body.style.overflow = '';
}

function initNotifSystem() {
  // Botão de sino
  var btn = document.getElementById('notifBtn');
  if (btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      openNotifPanel();
    });
  }
  // Botão de fechar dentro do painel
  var closeBtn = document.getElementById('notifPanelClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      closeNotifPanel();
    });
  }
  // Clicar fora do inner fecha o painel
  var panel = document.getElementById('notifPanel');
  if (panel) {
    panel.addEventListener('click', function(e) {
      if (e.target === panel) closeNotifPanel();
    });
  }
  // ESC fecha
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var p = document.getElementById('notifPanel');
      if (p && !p.hidden) closeNotifPanel();
    }
  });
  updateNotifBadge();
}

function initVolumeControls() {
  const slider = $('volumeSlider');
  const label = $('volumeText');
  const popup = $('volumePopup');
  const wrapper = $('soundControlWrapper');
  const soundBtn = $('soundBtn');

  if (slider) {
    slider.value = Math.round((masterSoundVolume || 0.8) * 100);
    if (label) label.textContent = slider.value + '%';

    slider.addEventListener('input', (e) => {
      const val = Number(e.target.value) / 100;
      masterSoundVolume = val;
      localStorage.setItem('abyssalSoundVolume', String(val));
      if (label) label.textContent = e.target.value + '%';
      if (soundBtn) {
        soundBtn.textContent = val > 0.4 ? '🔊' : val > 0 ? '🔉' : '🔇';
      }
      if (ambientNodes?.master?.gain) {
        ambientNodes.master.gain.value = 0.08 * masterSoundVolume;
      }
      window.AbyssalMasterVolume = masterSoundVolume;
    });
  }

  // Manter popup aberto no clique/toque em mobile
  if (wrapper && popup) {
    wrapper.addEventListener('pointerenter', () => popup.classList.add('active'));
    wrapper.addEventListener('pointerleave', () => popup.classList.remove('active'));
  }
}
window.AbyssalMasterVolume = masterSoundVolume;

function startAmbientMusic(){if(!soundOn||ambientNodes)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const master=audioCtx.createGain();master.gain.value=0.08 * (masterSoundVolume || 0.8);master.connect(audioCtx.destination);const low=audioCtx.createOscillator(),high=audioCtx.createOscillator(),lfo=audioCtx.createOscillator(),lfoGain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();low.type='sine';low.frequency.value=43;high.type='triangle';high.frequency.value=67;filter.type='lowpass';filter.frequency.value=260;lfo.type='sine';lfo.frequency.value=.08;lfoGain.gain.value=65;lfo.connect(lfoGain);lfoGain.connect(filter.frequency);low.connect(filter);high.connect(filter);filter.connect(master);low.start();high.start();lfo.start();ambientNodes={master,low,high,lfo,filter};}catch(e){console.warn('Áudio ambiente indisponível',e)}}
function stopAmbientMusic(){if(!ambientNodes)return;try{ambientNodes.master.gain.setTargetAtTime(0,audioCtx.currentTime,.25);setTimeout(()=>{try{ambientNodes.low.stop();ambientNodes.high.stop();ambientNodes.lfo.stop()}catch(e){}ambientNodes=null},800)}catch(e){ambientNodes=null}}
function audio(f=440,d=.07,type='sine',vol=.025){
 if(!soundOn)return;
 try{
  audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
  const effectiveVol = Math.max(0.001, Math.min(1.0, vol * 2.8 * (masterSoundVolume || 0.8)));
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;
  o.frequency.setValueAtTime(f,audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(40,f*.55),audioCtx.currentTime+d);
  g.gain.setValueAtTime(effectiveVol,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime+d);
 }catch(e){}
}
const lastSkillSfxAt=Object.create(null);
const skillSoundCooldown={rate:650,speed:1100,range:850,magnet:1000,regen:1200,power:320,shield:450,burst:600,electric:360,pierce:360,ricochet:360,nova:700,pulse:500,dash:500,bulkhead:500,focuser:500,current:850,startShield:500};
let lastDamageWarningAt=0,lastContactNoticeAt=0;
function playSkillSound(skillId,stage='learn'){
 if(!soundOn)return;
 const stamp=performance.now();
 if(stage!=='learn'&&stamp-(lastSkillSfxAt[skillId]||-Infinity)<(skillSoundCooldown[skillId]||400))return;
 lastSkillSfxAt[skillId]=stamp;
 try{
  audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
  window.AbyssalSkillAudio?.play(audioCtx,skillId,{volume:stage==='learn'?.026:.014});
 }catch(_){/* áudio sintético é opcional */}
}
function playBossCry(kind){
 if(!soundOn)return;
 try{
  audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
  const now=audioCtx.currentTime, master=audioCtx.createGain();master.gain.value=.055;master.connect(audioCtx.destination);
  const base=kind==='devourer'?58:kind==='leviathan'?58:kind==='maw'?42:kind==='angler'?82:kind==='kraken'?32:kind==='boss'?49:65;
  for(let i=0;i<3;i++){
   const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();
   o.type=i===0?'sawtooth':i===1?'triangle':'sine';
   o.frequency.setValueAtTime(base*(1+i*.43),now);
   o.frequency.exponentialRampToValueAtTime(Math.max(22,base*(.42+i*.18)),now+1.8+i*.25);
   f.type='lowpass';f.frequency.value= i===0?420:800;
   g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.018/(i+1),now+.18);
   g.gain.exponentialRampToValueAtTime(.0001,now+2.2+i*.2);
   o.connect(f);f.connect(g);g.connect(master);o.start(now);o.stop(now+2.5+i*.2);
  }
  if(kind==='devourer'){
   // Original synthesized abyssal scream: filtered noise, descending sub-bass and a slow detuned call.
   const length=Math.floor(audioCtx.sampleRate*1.9),buffer=audioCtx.createBuffer(1,length,audioCtx.sampleRate),samples=buffer.getChannelData(0);
   for(let i=0;i<length;i++){const p=i/length;samples[i]=(Math.random()*2-1)*Math.pow(1-p,1.25);}
   const source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain(),lfo=audioCtx.createOscillator(),lfoGain=audioCtx.createGain();
   source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(1250,now);filter.frequency.exponentialRampToValueAtTime(150,now+1.8);filter.Q.value=1.4;
   gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.035,now+.24);gain.gain.exponentialRampToValueAtTime(.0001,now+1.85);
   lfo.type='sine';lfo.frequency.value=2.2;lfoGain.gain.value=55;lfo.connect(lfoGain);lfoGain.connect(filter.frequency);source.connect(filter);filter.connect(gain);gain.connect(master);source.start(now);source.stop(now+1.9);lfo.start(now);lfo.stop(now+2);
  }
  setTimeout(()=>{try{master.disconnect()}catch(e){}},3000);
 }catch(e){}
}
function playDevourerSuction(){
 if(!soundOn)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();
  const now=audioCtx.currentTime,length=Math.floor(audioCtx.sampleRate*.95),buffer=audioCtx.createBuffer(1,length,audioCtx.sampleRate),samples=buffer.getChannelData(0);
  for(let i=0;i<length;i++){const p=i/length;samples[i]=(Math.random()*2-1)*(.2+.8*p)*Math.sin(Math.PI*p);}
  const source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(180,now);filter.frequency.exponentialRampToValueAtTime(920,now+.48);filter.frequency.exponentialRampToValueAtTime(110,now+.92);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.035,now+.18);gain.gain.exponentialRampToValueAtTime(.0001,now+.94);source.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);source.start(now);source.stop(now+.95);
 }catch(_){/* Som sintético opcional; a habilidade continua funcionando sem áudio. */}
}

// === SISTEMA DE ALERTAS ABISSAIS (vermelho, ameaçador, fade em 5s) ===
let abyssalAlertTimer = null;
function getBossDisplayName(kind) {
  const n = {
    boss: 'ABERRAÇÃO ABISSAL', leviathan: 'LEVIATÃ DAS FOSSAS', maw: 'A BOCA DO ABISMO',
    angler: 'LANTERNA MORTAL', kraken: 'KRAKEN DO ABISMO', devourer: 'DEVORADOR DO VAZIO',
    whiteSharkBoss: 'TUBARÃO-BRANCO COLOSSAL', whiteShark: 'TUBARÃO-BRANCO'
  };
  return n[kind] || kind.toUpperCase();
}
function showAbyssalAlert(text, subtitle = '') {
  const el = $('abyssalDangerAlert');
  if (!el) return;
  const titleEl = el.querySelector('.adanger-title');
  const subEl = el.querySelector('.adanger-sub');
  if (titleEl) titleEl.textContent = text;
  if (subEl) subEl.textContent = subtitle;
  // Reiniciar animação: remover classes, forçar reflow, re-adicionar
  el.classList.remove('adanger-visible', 'adanger-fadeout');
  void el.offsetWidth;
  el.classList.add('adanger-visible');
  clearTimeout(abyssalAlertTimer);
  // Após 7s total (2s visível + 5s fade) limpar
  abyssalAlertTimer = setTimeout(() => {
    el.classList.remove('adanger-visible', 'adanger-fadeout');
  }, 7200);
}
function showToast(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,1700)}
function showBossAlert(kind,id=null,threat=0){
 const key=id==null?`${kind}:${Math.floor(performance.now()/1000)}`:String(id);
 if(alertedBossIds.has(key))return;alertedBossIds.add(key);if(alertedBossIds.size>32)alertedBossIds=new Set([...alertedBossIds].slice(-16));
 const names={boss:['☠ ABERRAÇÃO ABISSAL','ALGO RASGOU A ESCURIDÃO. ELE SENTE SEU CALOR. CORRA.'],leviathan:['☠ O LEVIATÃ DAS FOSSAS','A PRESSÃO EXPLODIU. UMA CRIATURA COLOSSAL EMERGE DO FUNDO. NÃO HÁ SAÍDA.'],maw:['☠ A BOCA DO ABISMO','ESSE ECO NÃO FOI SEU. ESSA GARGANTA NÃO TEM FUNDO. NADE.'],angler:['☠ A LANTERNA MORTAL','A LUZ É UMA MENTIRA. OS DENTES JÁ ESTÃO FECHANDO.'],kraken:['☠ KRAKEN DO ABISMO','OITO BRAÇOS ENVOLVEM AS TREVAS. VOCÊ JÁ ESTÁ DENTRO DELE.'],devourer:['☠ O DEVORADOR DO VAZIO','A CORRENTE INVERTEU. O OCEANO INTEIRO ESTÁ SENDO ENGOLIDO.'],whiteSharkBoss:['☠ TUBARÃO-BRANCO COLOSSAL','O ÁPICE PREDATÓRIO EMERGIU. VELOCIDADE LETAL. FUJA OU MORRA.']};
 const [title,copy]=names[kind]||['PRESENÇA COLOSSAL','UMA FORMA IMPOSSÍVEL SE MOVE NA ESCURIDÃO.'];
 const alert=$('bossAlert');if(alert){$('bossAlertTitle').textContent=title;$('bossAlertText').textContent=copy;$('bossAlertKicker').textContent=threat?`☠ NÍVEL DE AMEAÇA ${threat} · ALERTA MÁXIMO`:'☠ CONTATO ABISSAL · PREPARE-SE';alert.hidden=false;alert.classList.remove('boss-alert-enter');void alert.offsetWidth;alert.classList.add('boss-alert-enter');clearTimeout(bossAlertTimer);bossAlertTimer=setTimeout(()=>{alert.hidden=true;alert.classList.remove('boss-alert-enter')},4600);}
  showAbyssalAlert(title, copy.slice(0,80));
 shake=Math.max(shake,10);playBossCry(kind);audio(kind==='leviathan'?43:kind==='maw'?38:kind==='angler'?58:46,1.15,'sawtooth',.055);
}

document.querySelectorAll('[data-close-screen]').forEach(button=>button.addEventListener('click',()=>{const screen=$(button.dataset.closeScreen);if(screen)screen.hidden=true;}));

// ==========================================
// SISTEMA DE PROGRESSÃO CONTÍNUA DE BOSSES
// ==========================================
const PROGRESSION_CYCLE_BOSS_SEQUENCE = ['boss', 'angler', 'maw', 'leviathan', 'whiteSharkBoss', 'kraken', 'devourer'];
const PROGRESSION_MAX_CYCLES = 5; // 0%, 20%, 40%, 60%, 80%, 100%

let activeBossEntities = [];

function initBossProgression() {
  bossProgressionCycle = 0;
  bossCycleStreak = 0;
  bossCycleIndex = 0;
  progressionDistance = 0;
  progressionPausedForBoss = false;
  activeBossEntity = null;
  activeBossEntities = [];
  bossVictoryPending = false;
  // Bosses ordenados estritamente por HP (do menor para o maior)
  bossCycleBosses = [...PROGRESSION_CYCLE_BOSS_SEQUENCE].sort((a,b) => (window.AbyssalEnemyAI?.ENEMY_STATS[a]?.hp||0) - (window.AbyssalEnemyAI?.ENEMY_STATS[b]?.hp||0));
  updateProgressionTrackUI();
}

function getBossCycleMultiplier() {
  return 1 + (bossProgressionCycle * 0.20);
}

function updateProgressionTrackUI() {
  var track = $('bossProgressionTrack');
  if (!track) return;
  track.style.display = 'block';
  track.style.display = 'block';
  var bonusPercent = Math.round(bossProgressionCycle * 20);
  var cycleBadge = $('trackCycleBadge');
  if (cycleBadge) {
    if (bossProgressionCycle >= PROGRESSION_MAX_CYCLES) {
      cycleBadge.classList.add('maxed');
      cycleBadge.textContent = 'CICLO MÁXIMO ⚡ +100% FORTALECIDO';
    } else {
      cycleBadge.classList.remove('maxed');
      cycleBadge.textContent = 'CICLO ' + (bossProgressionCycle + 1) + ' · +' + bonusPercent + '% BOSS HP/XP';
    }
  }
  var fill = $('trackFill');
  var marker = $('trackPlayerMarker');
  var totalBosses = bossCycleBosses.length;
  var segmentRatio = progressionPausedForBoss ? 1 : clamp(progressionDistance / 100, 0, 1);
  var totalPercent = clamp(((bossCycleIndex + (progressionPausedForBoss ? 0 : segmentRatio)) / totalBosses) * 100, 0, 100);
  if (fill) fill.style.width = totalPercent + '%';
  if (marker) marker.style.left = totalPercent + '%';
  var nodesContainer = $('trackBossNodes');
  if (!nodesContainer) return;
  var bossIcons = {
    boss: "<svg viewBox=\"0 0 24 24\" class=\"boss-node-svg\"><path fill=\"currentColor\" d=\"M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-7 9c0 2 3 3 7 3s7-1 7-3v1c0 4-3 7-7 7s-7-3-7-7v-1zm4 8.5 3 2 3-2\"/><circle cx=\"9\" cy=\"5.5\" r=\"1\" fill=\"#fff\"/><circle cx=\"15\" cy=\"5.5\" r=\"1\" fill=\"#fff\"/></svg>",
    angler: "<svg viewBox=\"0 0 24 24\" class=\"boss-node-svg\"><circle cx=\"17\" cy=\"3\" r=\"2.2\" fill=\"currentColor\"/><path stroke=\"currentColor\" stroke-width=\"1.6\" fill=\"none\" d=\"M12 11c1.5-5 5-8 5-8\"/><ellipse cx=\"10\" cy=\"14\" rx=\"7\" ry=\"4.5\" fill=\"currentColor\"/><path d=\"M6 13l1 4m4-5v5m4-5l-1 4\" stroke=\"#fff\" stroke-width=\"1.3\"/></svg>",
    maw: "<svg viewBox=\"0 0 24 24\" class=\"boss-node-svg\"><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"/><circle cx=\"12\" cy=\"12\" r=\"3\" fill=\"currentColor\" opacity=\".6\"/><path stroke=\"currentColor\" stroke-width=\"1.2\" d=\"M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3\"/></svg>",
    leviathan: "<svg viewBox=\"0 0 24 24\" class=\"boss-node-svg\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.8\" stroke-linecap=\"round\" d=\"M2 17c3-9 7-10 12-4s8 7 6-5\"/><circle cx=\"20\" cy=\"8\" r=\"2.5\" fill=\"currentColor\"/></svg>",
    whiteSharkBoss: "<svg viewBox=\"0 0 24 24\" class=\"boss-node-svg\"><path fill=\"currentColor\" d=\"M2 14c4-2 9-8 14-8 4 0 7 3 7 6s-7 8-14 7l-6 4 3-5z\"/><polygon points=\"13,6 16,1 18,7\" fill=\"currentColor\"/><circle cx=\"19\" cy=\"12\" r=\"1.5\" fill=\"#fff\"/><path d=\"M8 14c1 2 5 2 7 0\" stroke=\"#fff\" stroke-width=\"1.2\" fill=\"none\"/></svg>",
    kraken: "<svg viewBox=\"0 0 24 24\" class=\"boss-node-svg\"><ellipse cx=\"12\" cy=\"9\" rx=\"7\" ry=\"6\" fill=\"currentColor\"/><circle cx=\"9.5\" cy=\"8\" r=\"1.5\" fill=\"#fff\"/><circle cx=\"14.5\" cy=\"8\" r=\"1.5\" fill=\"#fff\"/><circle cx=\"9.5\" cy=\"8\" r=\".7\" fill=\"#111\"/><circle cx=\"14.5\" cy=\"8\" r=\".7\" fill=\"#111\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" d=\"M6 15c-1 3-3 5-4 4m6-4c0 3-1 5-2 6m5-6v6m3-6c0 3 1 5 2 6m1-7c1 3 3 5 4 4\"/></svg>",
    devourer: "<svg viewBox=\"0 0 24 24\" class=\"boss-node-svg\"><path fill=\"currentColor\" d=\"M2 12c3-7 11-8 16-4l5 4-5 4C13 20 5 19 2 12z\"/><circle cx=\"17\" cy=\"12\" r=\"4\" fill=\"#04202c\"/><circle cx=\"17\" cy=\"12\" r=\"2\" fill=\"currentColor\" opacity=\".4\"/><path stroke=\"currentColor\" stroke-width=\"1.2\" d=\"M10 8c2 3 2 7 0 9\"/></svg>"
  };
  var nodesHtml = '';
  for (var ni = 0; ni < totalBosses; ni++) {
    var leftPercent = 8 + (ni / Math.max(1, totalBosses - 1)) * 84;
    var kind = bossCycleBosses[ni];
    var statusClass = 'pending';
    var label = bossIcons[kind] || '<span style="font-size:14px">☠</span>';
    if (ni < bossCycleIndex) { statusClass = 'defeated'; label = '<span style="font-size:13px;font-weight:700">✓</span>'; }
    else if (ni === bossCycleIndex && progressionPausedForBoss) { statusClass = 'active'; }
    else if (ni === bossCycleIndex) { statusClass = 'next'; }
    var bossName = getBossDisplayName(kind);
    var tooltip = ni < bossCycleIndex ? (bossName + ' — DERROTADO') :
      ni === bossCycleIndex && progressionPausedForBoss ? (bossName + ' — EM COMBATE!') :
      ni === bossCycleIndex ? (bossName + ' — PRÓXIMO') :
      (bossName + ' — AGUARDANDO');
    nodesHtml += '<div class="track-node ' + statusClass + '" style="left:' + leftPercent + '%" title="' + tooltip + '">' + label + '</div>';
  }
  nodesContainer.innerHTML = nodesHtml;
}

function updateBossProgressionStep(dt) {
  if (gameState !== 'playing') return;

  // Se houver boss(es) ativo(s), pausar o avanço até que TODOS sejam derrotados
  if (progressionPausedForBoss) {
    if (activeBossEntities.length > 0) {
      const activeIds = new Set(enemies.map(e => e.id));
      activeBossEntities = activeBossEntities.filter(b => activeIds.has(b.id));
      if (activeBossEntities.length === 0) {
        onProgressionBossDefeated();
      }
    } else if (activeBossEntity) {
      const stillAlive = enemies.some(e => e.id === activeBossEntity.id);
      if (!stillAlive) {
        onProgressionBossDefeated();
      }
    }
    updateProgressionTrackUI();
    return;
  }

  // Progresso avança com o tempo de sobrevivência
  progressionDistance += dt * 3.8; // ~26 segundos entre bosses
  if (progressionDistance >= 100) {
    progressionDistance = 100;
    triggerProgressionBossSpawn();
  }
  updateProgressionTrackUI();
}

function triggerProgressionBossSpawn() {
  if (progressionPausedForBoss) return;
  const targetKind = bossCycleBosses[bossCycleIndex];
  if (!targetKind) return;

  progressionPausedForBoss = true;
  activeBossEntities = [];

  // REGRA: sempre 1 boss por vez — próximo só aparece após este morrer
  const spawned = !onlineMode ? spawnEnemy(false, targetKind) : null;
  if (spawned) {
    activeBossEntities.push(spawned);
    activeBossEntity = spawned;
  }

  showAbyssalAlert('☠ ' + getBossDisplayName(targetKind) + ' SURGIU DAS PROFUNDEZAS!', 'ALERTA DE AMEAÇA ABISSAL');
  updateProgressionTrackUI();
}

function onProgressionBossDefeated(bossEntity) {
  progressionPausedForBoss = false;
  activeBossEntity = null;
  progressionDistance = 0;
  bossCycleIndex++;

  // Checar se completou o ciclo de bosses
  if (bossCycleIndex >= bossCycleBosses.length) {
    onProgressionCycleCompleted();
  } else {
    showAbyssalAlert(`✦ BOSS DERROTADO · PROGRESSÃO RETOMADA ${bossCycleIndex}/${bossCycleBosses.length}`, 'ABISMO RECUOU');
  }
  updateProgressionTrackUI();
}

function onProgressionCycleCompleted() {
  bossCycleIndex = 0;
  progressionDistance = 0;
  activeBossEntities = [];
  activeBossEntity = null;

  if (bossProgressionCycle < PROGRESSION_MAX_CYCLES) {
    bossProgressionCycle++;
    const bonus = bossProgressionCycle * 20;
    // Mensagem de alerta exigida ao fim de cada progressão
    showAbyssalAlert('☠ O ABISMO ERGUE-SE MAIS FORTE! +'+bonus+'% VITALIDADE E XP DOS BOSSES', 'CICLO DE PROGRESSÃO COMPLETADO');
    addNotification("O Abismo ergue-se mais forte! Todos os bosses foram fortalecidos em +"+bonus+"% de Vitalidade e Recompensas.", "ABISMO FORTALECIDO ☠", "cycle");
    burst(player.x, player.y, '#ff4772', 80, 280);
    audio(720, 0.45, 'sawtooth', 0.06);
  } else {
    // Vitória máxima (+100% de fortalecimento completado)!
    triggerAbyssalVictory();
  }
}

function triggerAbyssalVictory() {
  if (bossVictoryPending) return;
  bossVictoryPending = true;

  // Desbloquear título "Conquistador Abyssal"
  try {
    const titles = JSON.parse(localStorage.getItem('abyssalTitles') || '[]');
    if (!titles.includes('abyssal-conqueror')) {
      titles.push('abyssal-conqueror');
      localStorage.setItem('abyssalTitles', JSON.stringify(titles));
      addNotification('Você completou todos os ciclos de progressão (100% fortalecimento) e recebeu o título honorário: "Conquistador Abyssal"!', 'NOVO TÍTULO DESBLOQUEADO ☬', 'title');
    }
  } catch(e) {}

  // Desbloquear skin exclusiva "greensnake" SOMENTE com 100% de progressão concluída
  if (!ownedSkins.includes('greensnake')) {
    ownedSkins.push('greensnake');
    saveCosmetics();
    addNotification('Parabéns, desbravador! Pelo seu feito supremo no abismo, você conquistou a lendária skin "Serpente Esmeralda"!', 'NOVA SKIN LENDÁRIA OBTIDA 🐍', 'skin');
  }

  // Notificar servidor se estiver online ou autenticado
  if (window.AbyssalOnline?.saveCosmetics) {
    window.AbyssalOnline.saveCosmetics({ ownedSkins, conqueror: true, unlockedTitle: 'abyssal-conqueror' });
  }

  showToast('🏆 VOCÊ CONQUISTOU O ABISMO! TÍTULO "CONQUISTADOR ABYSSAL" E SKIN SERPENTE ESMERALDA DESBLOQUEADOS! 🏆');

  setTimeout(() => {
    showVictoryModal();
  }, 1200);
}

function showVictoryModal() {
  let modal = $('victoryScreenModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'victoryScreenModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(2,10,18,0.92);backdrop-filter:blur(10px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:notifSlideDown 0.4s ease-out;';
    modal.innerHTML = `
      <div style="background:linear-gradient(180deg,#0a1e28 0%,#041019 100%);border:2px solid #2ee88a;box-shadow:0 0 35px rgba(46,232,138,0.5);border-radius:16px;max-width:540px;width:100%;padding:28px 24px;text-align:center;color:#fff;font-family:Manrope,system-ui,sans-serif;">
        <div style="font-size:42px;margin-bottom:8px;">👑 🐍 👑</div>
        <h2 style="font-size:22px;letter-spacing:0.12em;color:#2ee88a;text-shadow:0 0 14px rgba(46,232,138,0.8);margin-bottom:12px;">VOCÊ CONQUISTOU O ABISMO!</h2>
        <p style="font-size:14px;color:#d5f8ec;line-height:1.6;margin-bottom:18px;">
          Desafio Supremo Superado! Você sobreviveu a todos os ciclos de bosses até o patamar lendário de <b>+100% de fortalecimento</b>.
        </p>
        <div style="background:rgba(46,232,138,0.12);border:1px solid #2ee88a;border-radius:10px;padding:12px 14px;margin-bottom:16px;text-align:left;">
          <div style="color:#2ee88a;font-weight:700;font-size:13px;letter-spacing:0.06em;margin-bottom:4px;">✦ TÍTULO DESBLOQUEADO:</div>
          <div style="font-size:15px;font-weight:800;color:#fff;">"Conquistador Abyssal"</div>
        </div>
        <div style="background:rgba(46,232,138,0.12);border:1px solid #2ee88a;border-radius:10px;padding:12px 14px;margin-bottom:22px;text-align:left;">
          <div style="color:#2ee88a;font-weight:700;font-size:13px;letter-spacing:0.06em;margin-bottom:4px;">✦ SKIN EXCLUSIVA CONCEDIDA:</div>
          <div style="font-size:15px;font-weight:800;color:#2ee88a;">Serpente Esmeralda (Colossal)</div>
          <p style="font-size:12px;color:#a0dac3;margin-top:4px;line-height:1.4;">Inspirada nas grandes serpentes marinhas de jade com mandíbulas afiadas e rastro venenoso.</p>
        </div>
        <button id="victoryContinueBtn" style="background:#2ee88a;color:#04140d;font-weight:800;font-size:13px;letter-spacing:0.1em;border:none;border-radius:8px;padding:12px 28px;cursor:pointer;box-shadow:0 0 16px rgba(46,232,138,0.6);transition:transform 0.15s ease;" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
          GLÓRIA AO CONQUISTADOR
        </button>
      </div>
    `;
    document.body.appendChild(modal);
    $('victoryContinueBtn').addEventListener('click', () => {
      modal.remove();
      endGame();
    });
  }
}

function startGame(){
 document.body.classList.add('game-active');
 runResultPending=false;
 startAmbientMusic();
 elapsed=0;lastOnlineVitalsAt=0;authoritativeElapsed=onlineMode?0:null;lastSnapshotAt=0;lastSnapshotTick=0;lastAuthoritativeWorldId=null;lastAuthoritativeSnapshotSeq=0;lastAuthoritativeServerTime=0;pendingOnlineHitVitals=[];authoritativeSnapshotHistory=new Map();onlineMovementStalledSnapshots=0;onlineMovementConfirmedSnapshots=0;onlineMotionWatchdog?.reset?.();onlineClientMovementFallback=false;lastServerEnemyPositions.clear();score=0;level=1;xp=0;xpNeed=10;bossKillsThisRun=0;runProgressTimer=0;maxHp=100+Math.max(0,Number(metaUpgrades.bulkhead)||0)*8;hp=maxHp;spawnTimer=0;enemyId=0;shake=0;damageFlash=0;chosen=[];nextBossAt=60;bossIndex=0;lastBossKind=null;lastBossMaxHp=0;lastBossDamage=0;lastBossSpeed=0;lastRemoteBossId=null;alertedBossIds.clear();joystickVector={x:0,y:0,active:false,pointerId:null};
 setMobileGameActive(true);setHudCollapsed(false);$('toggleHudBtn').hidden=false;initBossProgression();
 upgrades={power:Math.pow(1.08,Math.max(0,Number(metaUpgrades.focuser)||0)),rate:1,range:1,speed:1+Math.max(0,Number(metaUpgrades.current)||0)*.05,magnet:1,regen:0,shield:Math.min(3,Math.max(0,Number(metaUpgrades.startShield)||0)+(equippedSkin==='abyssking'||equippedSkin==='armoredgator'?1:0)),burst:0,electric:0,pierce:0,ricochet:0,spread:0,photon:0,nova:0,gravitationalRupture:0,arcChain:0};
 upgradeLevels={power:0,rate:0,range:0,speed:0,magnet:0,regen:0,shield:0,burst:0,electric:0,pierce:0,ricochet:0,nova:0,gravitationalRupture:0,arcChain:0};
 enemies=[];orbs=[];onlineEnemyById.clear();onlineOrbById.clear();particles=[];particlePool.length=0;sharkWakeTrails=[];projectiles=[];effects=[];enemyCollisionGrid.clear();hostileSpriteCache.clear();
 player={x:W*.5,y:H*.5,r:13/GAME_WORLD_ZOOM,angle:0,moveSpeed:150/GAME_WORLD_ZOOM,fireTimer:0,invuln:0,shieldTime:0,trail:[],pulseCooldown:0,dashCooldown:0,dashTime:0,krakenSweepTimer:7};updateCamera();
 // Persistent/passive abilities have a distinct cue when their effects enter a run.
 const activePassiveSounds=[];
 if(Number(metaUpgrades.bulkhead)>0)activePassiveSounds.push('bulkhead');
 if(Number(metaUpgrades.focuser)>0)activePassiveSounds.push('focuser');
 if(Number(metaUpgrades.current)>0)activePassiveSounds.push('current');
 if(upgrades.shield>0)activePassiveSounds.push('startShield');
 activePassiveSounds.slice(0,4).forEach((id,i)=>setTimeout(()=>{if(gameState==='playing'||(onlineMode&&gameState==='upgrade'))playSkillSound(id,'trigger')},180+i*190));
 gameState='playing';screens.forEach(s=>$(s).hidden=true);$('hud').hidden=false;const endBtn=document.getElementById('endDiveBtn');if(endBtn)endBtn.style.display=onlineMode?'block':'none';$('pauseBtn').hidden=false;botBuddyTimer=0;botBuddy=null;
 updateHud();last=performance.now();audio(520,.12,'sine',.04);if(!onlineMode)for(let i=0;i<3;i++)spawnEnemy(true);if(onlineMode){window.AbyssalOnline?.beginRun?.();window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet});window.AbyssalOnline?.requestPlayerState?.();}else if(window.AbyssalOnline?.isAuthenticated?.())window.AbyssalOnline?.beginRun?.();snapshotClock=0;
}
const upgradeList=[
 {id:'power',name:'Pulso intenso',icon:'✧',desc:'Seus disparos causam 50% mais dano por nível.',apply:()=>upgrades.power*=1.5},
 {id:'rate',name:'Ressonância veloz',icon:'⟡',desc:'Dispare mais rápido. Cada nível reduz ainda mais o intervalo.',apply:()=>upgrades.rate*=1.28},
 {id:'speed',name:'Propulsão abissal',icon:'➤',desc:'Mova-se 18% mais rápido.',apply:()=>upgrades.speed*=1.18},
 {id:'range',name:'Olho profundo',icon:'◎',desc:'Aumenta o alcance dos disparos.',apply:()=>upgrades.range*=1.22},
 {id:'magnet',name:'Campo magnético',icon:'⌁',desc:'Atrai fragmentos de energia de mais longe.',apply:()=>upgrades.magnet*=1.45},
 {id:'regen',name:'Membrana viva',icon:'✚',desc:'Recupera 1 ponto de vida a cada 4 segundos.',apply:()=>upgrades.regen+=1},
 {id:'shield',name:'Escudo espectral',icon:'◉',desc:'Ganha uma carga que bloqueia o próximo dano.',apply:()=>upgrades.shield=Math.min(3,upgrades.shield+1)},
 {id:'burst',name:'Pulso de ruptura',icon:'✺',desc:'Libera dano em área: começa a cada 7 segundos, com intervalo mínimo de 3,5 segundos e dano crescente por nível.',apply:()=>upgrades.burst=Math.min(3,upgrades.burst+1)},
 {id:'electric',name:'Tempestade elétrica',icon:'ϟ',desc:'Cada disparo encadeia raios em até 3 alvos próximos; cada nível adiciona um salto e aumenta o dano dos raios.',apply:()=>upgrades.electric=Math.min(3,(upgrades.electric||0)+1)},
 {id:'pierce',name:'Lança-abismo',icon:'➶',desc:'Projéteis atravessam +1 criatura por nível. Não aumenta o dano por impacto.',apply:()=>upgrades.pierce=Math.min(3,(upgrades.pierce||0)+1)},
 {id:'ricochet',name:'Ricochete caótico',icon:'⤴',desc:'Os projéteis ricocheteiam entre inimigos próximos: cada nível adiciona um salto, até 3.',apply:()=>upgrades.ricochet=Math.min(3,(upgrades.ricochet||0)+1)},
 {id:'spread',name:'Rajada Prismática',icon:'✷',desc:'Dispara fótons laterais em cada ataque, cobrindo uma área maior.',apply:()=>upgrades.spread=Math.min(3,(upgrades.spread||0)+1)},
 {id:'photon',name:'Lança de Fótons',icon:'➶',desc:'Projéteis mais rápidos e concentrados causam dano adicional.',apply:()=>upgrades.photon=Math.min(3,(upgrades.photon||0)+1)},
 {id:'nova',name:'Nova gravitacional',icon:'✹',desc:'Libera uma explosão de longo alcance a cada 9 segundos no nível 1; níveis seguintes aumentam o dano e reduzem o intervalo até 4,5 segundos. ',apply:()=>upgrades.nova=Math.min(3,(upgrades.nova||0)+1)}
];
const COMBO_SKILLS={
 gravitationalRupture:{id:'gravitationalRupture',name:'Ruptura gravitacional',icon:'✹',desc:'Campo gravitacional contínuo com alcance igual ao alcance de disparo. Inimigos dentro da área recebem dano periódico e faíscas de energia.'},
 arcChain:{id:'arcChain',name:'Cadeia de Arcos',icon:'ϟ',desc:'Combina Tempestade Elétrica e Ricochete: a cada pulso, arcos de energia saltam entre até 12 inimigos em um raio duas vezes maior que o alcance de disparo.'}
};
function clearUpgradeCountdown(){
 if(upgradeAutoTimer){clearTimeout(upgradeAutoTimer);upgradeAutoTimer=null;}
 if(upgradeCountdownInterval){clearInterval(upgradeCountdownInterval);upgradeCountdownInterval=null;}
 upgradeDeadlineAt=0;
}
function updateUpgradeCountdown(){
 const remainingMs=Math.max(0,upgradeDeadlineAt-performance.now());
 const remainingSeconds=Math.ceil(remainingMs/1000);
 const timerText=$('upgradeTimerText'),timerFill=$('upgradeTimerFill'),timer=$('upgradeTimer');
 if(timerText)timerText.textContent=`ESCOLHA EM ${remainingSeconds}s`;
 if(timerFill)timerFill.style.width=`${Math.max(0,Math.min(100,remainingMs/25000*100))}%`;
 if(timer)timer.dataset.urgent=remainingSeconds<=3?'true':'false';
}
function renderSelectedSkills(){
 const panel=$('selectedSkillsList');if(!panel)return;
 const gravitationalRuptureActive=Number(upgrades.gravitationalRupture)>0;
 const arcChainActive=Number(upgrades.arcChain)>0;
 const selected=Object.entries(upgradeLevels).filter(([id,rank])=>Number(rank)>0&&!(gravitationalRuptureActive&&['burst','nova'].includes(id))&&!(arcChainActive&&['electric','ricochet'].includes(id))).sort((a,b)=>a[0].localeCompare(b[0]));
 const signature=selected.map(([id,rank])=>id+':'+rank).join('|')||'none';
 // Avoid replacing focused/clicked skill buttons on every simulation frame.
 if(signature===selectedSkillsRenderedSignature&&panel.dataset.skillsSignature===signature)return;
 selectedSkillsRenderedSignature=signature;panel.dataset.skillsSignature=signature;
 panel.innerHTML=selected.length?selected.map(([id,rank])=>{const skill=upgradeList.find(item=>item.id===id)||COMBO_SKILLS[id];return skill?'<button type="button" class="selected-skill-row" data-skill-id="'+skill.id+'" aria-label="Ver descrição: '+skill.name+'"><span>'+skill.icon+'</span><span class="selected-skill-name">'+skill.name+'</span><strong>NV '+rank+'</strong></button>':''}).join(''):'<p class="selected-skills-empty">Nenhuma habilidade adquirida</p>';
}
function showSkillDescription(id,target){
 const skill=upgradeList.find(item=>item.id===String(id||''))||COMBO_SKILLS[String(id||'')],tooltip=$('skillDescriptionTooltip');if(!skill||!tooltip)return;
 tooltip.replaceChildren();const title=document.createElement('strong'),description=document.createElement('span');title.textContent=skill.name;description.textContent=skill.desc;tooltip.append(title,description);tooltip.hidden=false;
 // Measure after rendering, then keep the entire description inside the viewport.
 tooltip.style.left='8px';tooltip.style.top='8px';
 const rect=target?.getBoundingClientRect?.(),box=tooltip.getBoundingClientRect(),margin=8,gap=6;
 const maxLeft=Math.max(margin,window.innerWidth-box.width-margin);
 const left=rect?Math.max(margin,Math.min(maxLeft,rect.left)):margin;
 const maxTop=Math.max(margin,window.innerHeight-box.height-margin);
 let top=rect?rect.bottom+gap:margin;
 if(top+box.height>window.innerHeight-margin&&rect)top=rect.top-box.height-gap;
 top=Math.max(margin,Math.min(maxTop,top));
 tooltip.style.left=left+'px';tooltip.style.top=top+'px';
}
function hideSkillDescription(){const tooltip=$('skillDescriptionTooltip');if(tooltip)tooltip.hidden=true;}
const selectedSkillPanel=$('selectedSkillsList');
// Mantém o ranking logo abaixo do painel de habilidades e acompanha seu crescimento.
function positionRunEnergyRanking(){
 const panel=$('selectedSkillsPanel');
 const ranking=$('runEnergyRanking');
 if(!panel||!ranking)return;
 const rect=panel.getBoundingClientRect();
 const gap=8;
 ranking.style.top=Math.max(8,rect.bottom+gap)+'px';
 ranking.style.right=Math.max(5,window.innerWidth-rect.right)+'px';
}
const skillsPanelForRanking=$('selectedSkillsPanel');
if(skillsPanelForRanking&&'ResizeObserver' in window){
 const rankingLayoutObserver=new ResizeObserver(positionRunEnergyRanking);
 rankingLayoutObserver.observe(skillsPanelForRanking);
}
window.addEventListener('resize',positionRunEnergyRanking);
positionRunEnergyRanking();
selectedSkillPanel?.addEventListener('pointerover',event=>{if(event.pointerType==='mouse'){const row=event.target.closest('[data-skill-id]');if(row)showSkillDescription(row.dataset.skillId,row);}});
selectedSkillPanel?.addEventListener('pointerout',event=>{if(event.pointerType==='mouse'&&!event.relatedTarget?.closest?.('[data-skill-id]'))hideSkillDescription();});
selectedSkillPanel?.addEventListener('click',event=>{const row=event.target.closest('[data-skill-id]');if(row)showSkillDescription(row.dataset.skillId,row);});
document.addEventListener('click',event=>{if(!event.target.closest?.('#selectedSkillsPanel'))hideSkillDescription();});
function chooseUpgrade(u){
 if(gameState!=='upgrade'||!u||(upgradeLevels[u.id]||0)>=3)return;
 clearUpgradeCountdown();gameState='upgrade-applying';
 u.apply();
 if(player){player.invuln=3;hp=maxHp;}
 if(onlineMode){window.AbyssalOnline?.sendProtection?.(3,'upgrade-selected');window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet});}
 upgradeLevels[u.id]=(upgradeLevels[u.id]||0)+1;
 let combinedNow=false,combinedSkillName='';
 if(!upgrades.gravitationalRupture&&upgradeLevels.burst>=3&&upgradeLevels.nova>=3){
  upgrades.burst=0;upgrades.nova=0;upgrades.gravitationalRupture=1;
  upgradeLevels.gravitationalRupture=1;combinedNow=true;combinedSkillName=COMBO_SKILLS.gravitationalRupture.name;
  if(player)player.gravitationalRuptureTimer=0;
 }
 if(!upgrades.arcChain&&upgradeLevels.electric>=3&&upgradeLevels.ricochet>=3){
  upgrades.electric=0;upgrades.ricochet=0;upgrades.arcChain=1;
  upgradeLevels.arcChain=1;combinedNow=true;combinedSkillName=COMBO_SKILLS.arcChain.name;
  if(player)player.arcChainTimer=0;
 }
 // Save through the shared codex cache; referencing a local, undefined "codex" here
 // used to throw before the level-up overlay closed, breaking both click and auto-pick.
 discoverCodexSkill(u.id);
 if (!areAllUpgradesMaxed()) { level++; } else { level = 'MAX'; }
 gameState='playing';$('upgradeScreen').hidden=true;renderSelectedSkills();
 showToast(combinedNow?`FUSÃO DESBLOQUEADA · ${combinedSkillName.toUpperCase()}`:`${u.name.toUpperCase()} · NÍVEL ${upgradeLevels[u.id]}/3`);
 playSkillSound(combinedNow?'nova':u.id,'learn');updateHud();last=performance.now();
 if(xp>=xpNeed){xp-=xpNeed;xpNeed=Math.floor(xpNeed*1.34+3);setTimeout(()=>{if(gameState==='playing')offerUpgrade()},0)}
}

function areAllUpgradesMaxed() {
  return upgradeList.every(u => (upgradeLevels[u.id] || 0) >= 3);
}

function offerUpgrade(){
 if(gameState==='upgrade'||gameState==='upgrade-applying')return;
 if(areAllUpgradesMaxed()){$('upgradeScreen').hidden=true;return;}
 clearUpgradeCountdown();
 gameState='upgrade';chosen=[];
 const available=upgradeList.filter(u=>(upgradeLevels[u.id]||0)<3);
 for(let i=available.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[available[i],available[j]]=[available[j],available[i]];}
 upgradeOptions=available.slice(0,3);
 const wrap=$('upgradeChoices'),fragment=document.createDocumentFragment();wrap.replaceChildren();
 if(!upgradeOptions.length){gameState='playing';$('upgradeScreen').hidden=true;return}
 // A level-up pauses gameplay and grants protection while the player has 25 seconds to choose.
 if(player)player.invuln=Math.max(player.invuln,25);
 if(onlineMode)window.AbyssalOnline?.sendProtection?.(25,'upgrade-offer');
 upgradeOptions.forEach(u=>{
  const current=upgradeLevels[u.id]||0,b=document.createElement('button');
  b.type='button';b.className='upgrade-card';
  b.innerHTML=`<span class="upgrade-icon">${u.icon}</span><strong>${u.name} · Nv. ${current+1}/3</strong><p>${u.desc}</p><small class="upgrade-progress">${'◆'.repeat(current)}${'◇'.repeat(3-current)} · ${current===0?'Desbloqueio':`Melhoria ${current} → ${current+1}`}</small>`;
  b.addEventListener('click',()=>chooseUpgrade(u));fragment.appendChild(b);
 });
 wrap.appendChild(fragment);$('upgradeScreen').hidden=false;audio(330,.16,'sine',.03);
 upgradeDeadlineAt=performance.now()+25000;updateUpgradeCountdown();
 upgradeCountdownInterval=setInterval(()=>{
  if(gameState!=='upgrade'){clearUpgradeCountdown();return}
  updateUpgradeCountdown();
 },100);
 // Safety fallback: select one available skill if the player does not choose within 25 seconds.
 upgradeAutoTimer=setTimeout(()=>{
  if(gameState!=='upgrade')return;
  const available=upgradeOptions.filter(u=>(upgradeLevels[u.id]||0)<3);
  if(available.length)chooseUpgrade(available[Math.floor(Math.random()*available.length)]);
  else{clearUpgradeCountdown();gameState='playing';$('upgradeScreen').hidden=true;}
 },25000);
}
function spawnEnemy(initial=false,type='common'){
 if(!player||enemies.length>=MAX_ENEMIES)return null;
 const bossCount=enemies.filter(e=>BOSS_KINDS.includes(e.kind)).length,commonCount=enemies.length-bossCount;
 if(type==='boss'&&(bossCount>=MAX_BOSSES||enemies.length>=MAX_ENEMIES))return null;
 if(type!=='boss'&&commonCount>=MAX_COMMON_ENEMIES)return null;
 // Shared catalog + spawn-point logic: solo and online use identical anatomy, stats and corner vortices.
 const ai=window.AbyssalEnemyAI;
 const activeKinds=enemies.map(e=>e.kind);
 let kind=type==='boss'?(ai?.chooseBossKind(activeKinds,Math.random,bossIndex++)||BOSS_KINDS.find(k=>!activeKinds.includes(k))):
   (ai?.chooseCommonKind()||(()=>{const t=Math.random();return t<.56?'drifter':t<.78?'stinger':t<.94?'brute':'lurker'})());
 if(kind==='whiteShark'){
  const whiteSharkCount=enemies.filter(e=>e.kind==='whiteShark').length;
  if(whiteSharkCount>=10)kind='drifter';
 }
 if(!kind)return null;
 const data=ai?.statsForKind(kind)||({
  boss:{r:40,hp:2820,speed:52,damage:25,color:'#ff315f',value:55},
  leviathan:{r:54,hp:4700,speed:44,damage:34,color:'#4ce0d1',value:90},
  maw:{r:45,hp:3750,speed:58,damage:31,color:'#c16cff',value:75},
  angler:{r:35,hp:3260,speed:66,damage:28,color:'#ffb45e',value:65},
  kraken:{r:80,hp:9200,speed:20,damage:38,color:'#8b5cf6',value:180},
  drifter:{r:10,hp:22,speed:51,damage:8,color:'#ff769d',value:1},
  stinger:{r:7,hp:13,speed:88,damage:6,color:'#ffbc78',value:2},
  brute:{r:16,hp:65,speed:30,damage:15,color:'#bd88ff',value:4},
  lurker:{r:20,hp:100,speed:43,damage:18,color:'#6e8dff',value:6}
 })[kind];
 if(type==='boss'){
  // Preserve the ordered base HP tiers in solo just as in the online simulation.
  data.damage=lastBossDamage>0?Math.max(data.damage,Math.round(lastBossDamage*1.12)):data.damage;
  data.speed=kind==='devourer'?14:kind==='kraken'?20:Math.min(90,lastBossSpeed>0?Math.max(data.speed,lastBossSpeed*1.05):data.speed);
  lastBossMaxHp=data.hp;lastBossDamage=data.damage;lastBossSpeed=data.speed;bossIndex++;
 }
 const point=ai?.chooseSpawnPoint?ai.chooseSpawnPoint(Math.random,null,W,H):{x:rand(100,290),y:rand(90,250)};
 const x=clamp(point.x,70/GAME_WORLD_ZOOM,W-70/GAME_WORLD_ZOOM),y=clamp(point.y,70/GAME_WORLD_ZOOM,H-70/GAME_WORLD_ZOOM);
 const enemy={id:++enemyId,x,y,...data,r:data.r/GAME_WORLD_ZOOM,speed:data.speed/GAME_WORLD_ZOOM,maxHp:data.hp,angle:rand(0,6.28),phase:rand(0,6.28),hit:0,attackCd:rand(.3,1),kind,suctionActive:false,suctionTimer:0,suctionCooldown:kind==='devourer'?20:0,suctionPulse:0};
 enemies.push(enemy);
 discoverCodexMonsters([kind]);
 if(BOSS_KINDS.includes(kind)){lastBossKind=kind;showBossAlert(kind,enemy.id,bossIndex);burst(x,y,data.color,kind==='kraken'?28:36,230);}
 return enemy;
}
function burst(x,y,color,n=10,force=100){
 n=Math.min(Math.max(0,Math.floor(n)),Math.max(0,particleBudget()-particles.length));
 for(let i=0;i<n;i++){
  const a=Math.random()*Math.PI*2,s=rand(force*.25,force),life=rand(.22,.7),p=particlePool.pop()||{};
  p.x=x;p.y=y;p.vx=Math.cos(a)*s;p.vy=Math.sin(a)*s;p.life=life;p.max=life;p.r=rand(1,3.5);p.color=color;particles.push(p);
 }
}
function addOrb(x,y,value){const r=(window.AbyssalEnemyAI?.xpOrbRadius?.(value)||Math.min(15,4+Math.sqrt(Math.max(1,value))))/GAME_WORLD_ZOOM;orbs.push({id:`solo-${Math.random().toString(36).slice(2)}`,x,y,r,value,phase:rand(0,6.28),life:25})}
function hurtPlayer(dmg){
 if(player.invuln>0)return;if(upgrades.shield>0){upgrades.shield--;player.invuln=equippedSkin==='violet'?1:.7;burst(player.x,player.y,'#7ceff2',18,130);playSkillSound('shield','trigger');showToast('ESCUDO ABSORVEU O IMPACTO');return}
 const received=Math.max(1,dmg*(SkinAbilities?.incomingDamageMultiplier(equippedSkin)||1));hp-=received;player.invuln=equippedSkin==='violet'?1:.8;shake=8;damageFlash=.25;burst(player.x,player.y,'#ff668d',14,120);audio(120,.16,'sawtooth',.03);if(hp<=0)endGame();
}
function revealOnlineContactSource(data){
 // Never create or teleport a mob from a damage event. The authoritative room snapshot
 // owns existence and position; this event may only highlight an already-rendered entity.
 if(!onlineMode||!data||data.enemyId==null)return;
 const kind=String(data.enemyKind||'drifter'),e=enemies.find(item=>String(item.id)===String(data.enemyId));
 if(e){
  e.hit=.28;
  const pos=window.AbyssalEnemyNetcode?.renderedPosition?.(e,performance.now())||{x:e.x,y:e.y};
  const color=String(e.color||data.enemyColor||'#ff567a');
  burst(pos.x,pos.y,color,8,75);
  effects.push({type:'ring',x:pos.x,y:pos.y,r:0,max:Math.max(18/worldZoom,e.r*1.4),life:.28,maxLife:.28,color:'#ff5c7c'});
 }
 // Mensagem de colisão removida por solicitação do usuário
}
function authoritativeContactFrame(data){
 if(!data||data.enemyId==null||!data.worldId||!Number(data.snapshotSeq))return null;
 return authoritativeSnapshotHistory.get(`${String(data.worldId)}:${Math.floor(Number(data.snapshotSeq))}`)||null;
}
function verifyAuthoritativeContact(data){
 const frame=authoritativeContactFrame(data);if(!frame)return {ready:false,valid:false,reason:'snapshot-pending'};
 const id=String(data.enemyId),source=frame.enemies.get(id);
 if(!source||!frame.criticalEnemyIds.has(id))return {ready:true,valid:false,reason:'attacker-not-in-critical-snapshot'};
 const ex=Number(data.enemyX),ey=Number(data.enemyY),px=Number(data.playerX),py=Number(data.playerY),reportedDistance=Number(data.contactDistance),radius=Number(data.contactRadius);
 if(![ex,ey,px,py,reportedDistance,radius].every(Number.isFinite)||radius<=0)return {ready:true,valid:false,reason:'invalid-contact-geometry'};
 const sourceMismatch=Math.hypot(source.x-ex,source.y-ey);
 const measuredDistance=Math.hypot(source.x-px,source.y-py);
 const geometryValid=sourceMismatch<=2&&Math.abs(measuredDistance-reportedDistance)<=3&&measuredDistance<=radius+2&&reportedDistance<=radius+2;
 return {ready:true,valid:geometryValid,reason:geometryValid?null:'contact-position-mismatch',frame,source};
}
function alignPlayerToAuthoritativeContact(data){
 if(!player||!data)return false;
 const sx=Number(data.playerX),sy=Number(data.playerY);
 if(!Number.isFinite(sx)||!Number.isFinite(sy))return false;
 const distance=Math.hypot(player.x-sx,player.y-sy);
 const contactRadius=Math.max(1,Number(data.contactRadius)||40);
 // Client movement is predicted locally; on a confirmed server hit we reconcile only
 // if the two positions diverged enough to make the attacker appear unrelated to damage.
 if(distance>Math.max(12/GAME_WORLD_ZOOM,contactRadius*.38)){
  player.x=clamp(sx,player.r,W-player.r);player.y=clamp(sy,player.r,H-player.r);
  if(player.trail)player.trail.length=0;
  updateCamera();return true;
 }
 return false;
}
function applyOnlinePlayerVitals(data){
 if(!onlineMode||!player||!data||typeof data!=='object')return;
 const contactEvent=data.source==='enemy'&&data.enemyId!=null&&(data.reason==='enemy-attack'||data.reason==='shield-block'||data.blocked===true);
 let contactSourceReady=false,contactVerification=null;
 if(contactEvent){
  contactVerification=verifyAuthoritativeContact(data);
  contactSourceReady=String(lastAuthoritativeWorldId||'')===String(data.worldId||'')&&contactVerification.valid&&enemies.some(e=>String(e.id)===String(data.enemyId));
  // A server-confirmed collision is authoritative for HP. Never silently discard its
  // vitals because a render snapshot is late; reconcile the local player and request the
  // newest complete world if the expected attacker snapshot is not currently available.
  // Do not teleport a visible player when contact arrives. Visible hits are reconciled
  // by the authoritative enemy snapshot and movement prediction. Only a hidden client
  // may be aligned to its last server-known position when it resumes.
  if(data.targetWasHidden===true)alignPlayerToAuthoritativeContact(data);
  if(!contactSourceReady){
   window.AbyssalOnline?.requestWorldSnapshot?.('contact-resync');
   
  }
 }
 const receivedAt=Number(data.serverTime)||Date.now();
 if(receivedAt<(Number(lastOnlineVitalsAt)||0))return;
 lastOnlineVitalsAt=receivedAt;
 if(Number.isFinite(Number(data.maxHp)))maxHp=Math.max(1,Number(data.maxHp));
 if(Number.isFinite(Number(data.hp)))hp=clamp(Number(data.hp),0,maxHp);
 if(Number.isFinite(Number(data.shieldCharges)))upgrades.shield=clamp(Math.floor(Number(data.shieldCharges)),0,3);
 if(Number.isFinite(Number(data.invulnerabilityMs)))player.invuln=clamp(Number(data.invulnerabilityMs)/1000,0,30);
 if(data.reason==='enemy-attack'&&Number(data.damage)>0){
  if(contactSourceReady)revealOnlineContactSource(data);
  else if(!data.targetWasHidden){window.AbyssalOnline?.requestWorldSnapshot?.('contact-resync');}
  shake=Math.max(shake,6);damageFlash=.22;burst(player.x,player.y,'#ff668d',12,100);audio(115,.14,'sawtooth',.025);
 }else if(data.reason==='shield-block'||data.blocked){
  if(contactSourceReady)revealOnlineContactSource(data);
  burst(player.x,player.y,'#7ceff2',16,110);playSkillSound('shield','trigger');
 }else if(data.reason==='regeneration'&&Number(data.healed)>0)playSkillSound('regen','trigger');
 updateHud();
 if(data.alive===false&&gameState!=='over')endGame();
}
let lastOnlineVitalsAt=0;
function gainXp(value, source='shared'){
 if(!Number.isFinite(value)||value<=0||!player)return;
 const skinMultiplier=source==='orb'&&!onlineMode?(SkinAbilities?.orbExperienceMultiplier(equippedSkin)||1):1;
 xp+=value*skinMultiplier;
 if(xp>=xpNeed && gameState!=='upgrade'){
   if(areAllUpgradesMaxed()){
     xp = xpNeed; // Trava XP no máximo sem oferecer upgrade
   } else {
     xp-=xpNeed; xpNeed=Math.floor(xpNeed*1.34+3); offerUpgrade();
   }
 }
 updateHud();
}
function dealEnemyDamage(enemy, damage, skillId=null, options={}){
  score += Math.round(damage);
 if(!enemy||!Number.isFinite(damage)||damage<=0)return;
 if(skillId&&options.silentSound!==true)playSkillSound(skillId,'trigger');

  if(equippedSkin==='electriceel' && enemy && enemy.hp > 0){
    enemy.paralyzedUntil = Math.max(enemy.paralyzedUntil || 0, performance.now() + 100);
    burst(enemy.x, enemy.y, '#38e8ff', 3, 50);
  }


  if(['toxic', 'greensnake'].includes(equippedSkin) && enemy && enemy.hp > 0) {
    enemy.poisonTimer = Math.max(enemy.poisonTimer || 0, 4.0);
  }

 if(onlineMode){
   onlineDamageQueue.push({id:Number(enemy.id),damage:Number(damage),skillId:String(skillId||'').slice(0,32)});
   // O dano permanece autoritativo; só a transmissão é agrupada por quadro.
   enemy.hit=.14;
   if(options.visual!==false)burst(enemy.x,enemy.y,'#c4b4ff',3,50);
   return;
 }
 const distance=Math.hypot(player.x-enemy.x,player.y-enemy.y);
 const multiplier=SkinAbilities?.damageMultiplier(equippedSkin,enemy.kind,distance,hp/maxHp)||1;
 enemy.hp-=damage*multiplier; enemy.hit=.14;
 if(enemy.hp<=0){const idx=enemies.indexOf(enemy);if(idx>=0)killEnemy(idx);}
}
function flushOnlineDamageBatch(){
 if(!onlineMode||!onlineDamageQueue.length)return;
 const batch=onlineDamageQueue.splice(0,128);
 const sent=window.AbyssalOnline?.sendDamageBatch?.(batch);
 if(!sent)onlineDamageQueue.length=0;
}
function currentInterpolatedEnemyPosition(e,now){
 if(!e)return {x:0,y:0};
 const duration=Math.max(1,Number(e.interpDuration)||1),t=Number.isFinite(e.interpAt)?clamp((now-e.interpAt)/duration,0,1):1;
 const sx=Number.isFinite(e.interpFromX)?e.interpFromX:e.x,sy=Number.isFinite(e.interpFromY)?e.interpFromY:e.y;
 const tx=Number.isFinite(e.interpTargetX)?e.interpTargetX:e.x,ty=Number.isFinite(e.interpTargetY)?e.interpTargetY:e.y;
 return {x:sx+(tx-sx)*t,y:sy+(ty-sy)*t};
}
function observeOnlineServerMotion(data){
 const list=Array.isArray(data.enemies)?data.enemies:[];
 let moved=false;const nextPositions=new Map();
 for(const raw of list){if(!raw||raw.id==null)continue;const x=Number(raw.x)||0,y=Number(raw.y)||0,prev=lastServerEnemyPositions.get(raw.id);nextPositions.set(raw.id,{x,y});if(prev&&Math.hypot(x-prev.x,y-prev.y)>.35)moved=true;}
 lastServerEnemyPositions=nextPositions;
 if(onlineMotionWatchdog){
  const result=onlineMotionWatchdog.observe(list);
  onlineMovementStalledSnapshots=result.stalledStreak;
  onlineMovementConfirmedSnapshots=result.healthyStreak;
 }else if(moved){
  onlineMovementConfirmedSnapshots++;onlineMovementStalledSnapshots=0;
 }else{
  onlineMovementConfirmedSnapshots=0;onlineMovementStalledSnapshots++;
 }
 // Visual movement is always simulated locally with the same AI as solo. The watchdog
 // is diagnostic only: a healthy-looking snapshot must not disable the local AI and
 // a snapshot must never hard-reset a creature's rendered x/y.
 onlineClientMovementFallback=false;
}

function applySharedOrbs(incomingOrbs,now=performance.now()){
 const previous=new Map(orbs.filter(o=>o&&o.id!=null).map(o=>[String(o.id),o]));
 const list=Array.isArray(incomingOrbs)?incomingOrbs:[];
 orbs=list.filter(raw=>raw&&raw.id!=null).map(raw=>{
  const old=previous.get(String(raw.id));
  const tx=clamp(Number(raw.x)||0,0,W),ty=clamp(Number(raw.y)||0,0,H);
  const from=old?currentInterpolatedEnemyPosition(old,now):{x:tx,y:ty};
  return {...(old||{}),...raw,x:from.x,y:from.y,r:Math.max(2,Number(raw.r)||4)/GAME_WORLD_ZOOM,interpFromX:from.x,interpFromY:from.y,interpTargetX:tx,interpTargetY:ty,interpAt:now,interpDuration:old?500:0,authoritativePosition:true};
 });
 onlineOrbById=new Map();for(const orb of orbs)onlineOrbById.set(String(orb.id),orb);
}
function applySharedSpawn(data){
 if(!onlineMode||!data||!Array.isArray(data.enemies))return;
 const worldId=String(data.worldId||''),sequence=Math.max(0,Math.floor(Number(data.snapshotSeq)||0)),serverTime=Math.max(0,Number(data.serverTime)||0);
 if(!worldId||worldId!==lastAuthoritativeWorldId||!sequence||sequence<=lastAuthoritativeSnapshotSeq)return;
 if(lastAuthoritativeServerTime&&serverTime&&serverTime<lastAuthoritativeServerTime)return;
 lastAuthoritativeSnapshotSeq=sequence;if(serverTime>0)lastAuthoritativeServerTime=Math.max(lastAuthoritativeServerTime,serverTime);
 const newBosses=[];
 for(const raw of data.enemies){
  if(!raw||raw.id==null||onlineEnemyById.has(String(raw.id)))continue;
  const x=clamp(Number(raw.x)||0,0,W),y=clamp(Number(raw.y)||0,0,H),kind=String(raw.kind||'drifter');
  const enemy={...raw,id:raw.id,x,y,r:Math.max(2,Number(raw.r)||12)/GAME_WORLD_ZOOM,serverX:x,serverY:y,interpFromX:x,interpFromY:y,interpTargetX:x,interpTargetY:y,interpAt:performance.now(),interpDuration:0,hit:0,authoritativePosition:true};
  enemies.push(enemy);onlineEnemyById.set(String(enemy.id),enemy);
  if(BOSS_KINDS.includes(kind))newBosses.push(enemy);
 }
 discoverCodexMonsters(enemies);
 for(const boss of newBosses){lastRemoteBossId=boss.id;showBossAlert(boss.kind,boss.id,Number(boss.threat)||0);burst(boss.x,boss.y,boss.color,boss.kind==='kraken'?22:26,210);}
 onlineVisualEnemyCount=enemies.length;
}
function applySharedSnapshot(data){
 if(!onlineMode||!data||!Array.isArray(data.enemies))return;
 const incomingWorldId=String(data.worldId||''),incomingSeq=Math.max(0,Math.floor(Number(data.snapshotSeq)||0)),incomingServerTime=Math.max(0,Number(data.serverTime)||0);
 // Reliable lifecycle and movement snapshots share one sequence. Never let an
 // older packet restore a dead/spawn-removed entity or roll enemy positions backwards.
 if(lastAuthoritativeServerTime&&incomingServerTime&&incomingServerTime<lastAuthoritativeServerTime)return;
 if(incomingWorldId&&lastAuthoritativeWorldId&&incomingWorldId===lastAuthoritativeWorldId&&incomingSeq>0&&incomingSeq<=lastAuthoritativeSnapshotSeq)return;
 if(incomingWorldId&&lastAuthoritativeWorldId&&incomingWorldId!==lastAuthoritativeWorldId){
  if(incomingServerTime&&lastAuthoritativeServerTime&&incomingServerTime<lastAuthoritativeServerTime)return;
  enemies=[];orbs=[];onlineEnemyById.clear();onlineOrbById.clear();lastAuthoritativeSnapshotSeq=0;authoritativeSnapshotHistory.clear();pendingOnlineHitVitals=pendingOnlineHitVitals.filter(item=>String(item.worldId||'')===incomingWorldId);
 }
 if(incomingWorldId)lastAuthoritativeWorldId=incomingWorldId;
 if(incomingSeq>0)lastAuthoritativeSnapshotSeq=incomingSeq;
 if(incomingServerTime>0)lastAuthoritativeServerTime=Math.max(lastAuthoritativeServerTime,incomingServerTime);
 const forceResync=String(data.criticalReason||'')==='resume-resync'||String(data.criticalReason||'')==='contact-resync';
 const authoritativeCriticalIds=forceResync?data.enemies.filter(e=>e&&e.id!=null).map(e=>String(e.id)):(data.criticalEnemyIds||[]).map(String);
 if(incomingWorldId&&incomingSeq>0){
  const frame={worldId:incomingWorldId,snapshotSeq:incomingSeq,serverTime:incomingServerTime,criticalEnemyIds:new Set(authoritativeCriticalIds),enemies:new Map(data.enemies.filter(e=>e&&e.id!=null).map(e=>[String(e.id),{id:String(e.id),kind:String(e.kind||'drifter'),x:Number(e.x)||0,y:Number(e.y)||0,r:Number(e.r)||10,hp:Number(e.hp)||0,maxHp:Number(e.maxHp)||0}]))};
  authoritativeSnapshotHistory.set(`${incomingWorldId}:${incomingSeq}`,frame);
  while(authoritativeSnapshotHistory.size>18)authoritativeSnapshotHistory.delete(authoritativeSnapshotHistory.keys().next().value);
 }
 const now=performance.now(),previousById=new Map(enemies.map(e=>[e.id,e]));
 observeOnlineServerMotion(data);
 if(Number.isFinite(Number(data.elapsed))){authoritativeElapsed=Math.max(0,Number(data.elapsed));lastSnapshotAt=now;lastSnapshotTick=Number(data.tickCount)||lastSnapshotTick;}
 const previousBossIds=new Set(enemies.filter(e=>BOSS_KINDS.includes(e.kind)).map(e=>e.id));
 // Snapshots reconcile authoritative gameplay fields, but positions belong to the shared
 // local movement step. Never assign finite interpolation targets here: draw() uses a
 // finite interpTargetX/Y as a hard set-position operation and would freeze first-spawned mobs.
 if(window.AbyssalEnemyNetcode?.reconcileSnapshot){
  enemies=window.AbyssalEnemyNetcode.reconcileSnapshot(enemies,data.enemies,{radiusScale:1/GAME_WORLD_ZOOM,maxX:W,maxY:H,minX:0,minY:0,now,interpolationMs:100,criticalIds:authoritativeCriticalIds||data.criticalEnemyIds||[]});
 }else{
  // Fallback mirrors the authoritative interpolation module instead of running a
  // second enemy simulation in the browser.
  enemies=data.enemies.map(raw=>{const old=previousById.get(raw.id),serverX=clamp(Number(raw.x)||0,0,W),serverY=clamp(Number(raw.y)||0,0,H),from=old?currentInterpolatedEnemyPosition(old,now):{x:serverX,y:serverY};return {...old,...raw,x:from.x,y:from.y,r:Math.max(2,Number(raw.r)||12)/GAME_WORLD_ZOOM,serverX,serverY,interpFromX:from.x,interpFromY:from.y,interpTargetX:serverX,interpTargetY:serverY,interpAt:now,interpDuration:(old&&!authoritativeCriticalIds.includes(String(raw.id)))?100:0,authoritativePosition:true};});
 }
 onlineEnemyById=new Map();for(const enemy of enemies)onlineEnemyById.set(String(enemy.id),enemy);
 applySharedOrbs(data.orbs,now);
 const suctionStarted=data.enemies.some(raw=>raw&&raw.kind==='devourer'&&raw.suctionActive===true&&!previousById.get(raw.id)?.suctionActive);
 if(suctionStarted){playDevourerSuction();showToast('SUCÇÃO DO DEVORADOR · AFASTE-SE DA BOCA');}
 const queued=pendingOnlineHitVitals;pendingOnlineHitVitals=[];
 for(const item of queued){
  const ready=String(lastAuthoritativeWorldId||'')===String(item.worldId||'')&&verifyAuthoritativeContact(item).valid&&enemies.some(e=>String(e.id)===String(item.enemyId));
  if(ready)applyOnlinePlayerVitals(item);
  else if(now-(Number(item._queuedAt)||now)<900)pendingOnlineHitVitals.push(item);
  else window.AbyssalOnline?.requestPlayerState?.();
 }
 discoverCodexMonsters(enemies);
 const newBoss=enemies.find(e=>BOSS_KINDS.includes(e.kind)&&!previousBossIds.has(e.id));if(newBoss){lastRemoteBossId=newBoss.id;showBossAlert(newBoss.kind,newBoss.id,Number(newBoss.threat)||0);burst(newBoss.x,newBoss.y,newBoss.color,newBoss.kind==='kraken'?26:32,230);}
}
function registerEnemyContactSnapshot(data){
 if(!onlineMode||!data||!Array.isArray(data.enemies))return;
 const worldId=String(data.worldId||''),sequence=Math.max(0,Math.floor(Number(data.snapshotSeq)||0)),serverTime=Math.max(0,Number(data.serverTime)||0);
 if(!worldId||worldId!==lastAuthoritativeWorldId||!sequence||sequence<=lastAuthoritativeSnapshotSeq)return;
 if(lastAuthoritativeServerTime&&serverTime&&serverTime<lastAuthoritativeServerTime)return;
 const criticalIds=new Set((data.criticalEnemyIds||[]).map(String));
 const enemyRows=data.enemies.filter(enemy=>enemy&&enemy.id!=null);
 const frame={worldId,snapshotSeq:sequence,serverTime,criticalEnemyIds:criticalIds,enemies:new Map(enemyRows.map(enemy=>[String(enemy.id),{id:String(enemy.id),kind:String(enemy.kind||'drifter'),x:Number(enemy.x)||0,y:Number(enemy.y)||0,r:Number(enemy.r)||10,hp:Number(enemy.hp)||0,maxHp:Number(enemy.maxHp)||0}]))};
 if(!frame.enemies.size||![...criticalIds].some(id=>frame.enemies.has(id)))return;
 authoritativeSnapshotHistory.set(`${worldId}:${sequence}`,frame);
 while(authoritativeSnapshotHistory.size>18)authoritativeSnapshotHistory.delete(authoritativeSnapshotHistory.keys().next().value);
 lastAuthoritativeSnapshotSeq=sequence;
 if(serverTime>0)lastAuthoritativeServerTime=Math.max(lastAuthoritativeServerTime,serverTime);
}
function applySharedMotion(data){
 if(!onlineMode||!data||!Array.isArray(data.enemies))return;
 const worldId=String(data.worldId||''),sequence=Math.max(0,Math.floor(Number(data.snapshotSeq)||0)),serverTime=Math.max(0,Number(data.serverTime)||0);
 // Compact motion packets update only entities already introduced by a reliable full snapshot.
 if(!worldId||worldId!==lastAuthoritativeWorldId||!sequence||sequence<=lastAuthoritativeSnapshotSeq)return;
 if(lastAuthoritativeServerTime&&serverTime&&serverTime<lastAuthoritativeServerTime)return;
 lastAuthoritativeSnapshotSeq=sequence;
 if(serverTime>0)lastAuthoritativeServerTime=Math.max(lastAuthoritativeServerTime,serverTime);
 const now=performance.now(),duration=clamp(Number(data.intervalMs)||100,60,160),orbDuration=clamp(Number(data.orbIntervalMs)||500,400,650);
 if(Number.isFinite(Number(data.elapsed))){authoritativeElapsed=Math.max(0,Number(data.elapsed));lastSnapshotAt=now;lastSnapshotTick=Number(data.tickCount)||lastSnapshotTick;}
 let moved=0;
 for(const row of data.enemies){
  if(!Array.isArray(row)||row.length<11)continue;
  const enemy=onlineEnemyById.get(String(row[0]));if(!enemy)continue;
  const tx=clamp(Number(row[1])||0,0,W),ty=clamp(Number(row[2])||0,0,H);
  const previousServerX=Number.isFinite(Number(enemy.serverX))?Number(enemy.serverX):Number(enemy.x)||tx;
  const previousServerY=Number.isFinite(Number(enemy.serverY))?Number(enemy.serverY):Number(enemy.y)||ty;
  const current=window.AbyssalEnemyNetcode?.renderedPosition?.(enemy,now)||currentInterpolatedEnemyPosition(enemy,now);
  enemy.x=current.x;enemy.y=current.y;enemy.serverX=tx;enemy.serverY=ty;
  enemy.interpFromX=current.x;enemy.interpFromY=current.y;enemy.interpTargetX=tx;enemy.interpTargetY=ty;enemy.interpAt=now;enemy.interpDuration=duration;
  // Compact server packets don't carry velocity. Estimate it from authoritative
  // positions so RTT spikes don't make an enemy freeze between snapshots.
  const maxV=(enemy.kind==='whiteShark'||enemy.kind==='whiteSharkBoss')?450:220;
  enemy.vx=clamp((tx-previousServerX)/(duration/1000),-maxV,maxV);
  enemy.vy=clamp((ty-previousServerY)/(duration/1000),-maxV,maxV);
  const incomingRevision=Math.max(0,Number(row[4])||0),currentRevision=Math.max(0,Number(enemy.damageRevision)||0);
  if(incomingRevision>=currentRevision){enemy.hp=Math.max(0,Number(row[3])||0);enemy.damageRevision=incomingRevision;}
  enemy.angle=Number(row[5])||0;enemy.phase=Number(row[6])||0;
  enemy.suctionActive=row[7]===true;enemy.suctionTimer=Math.max(0,Number(row[8])||0);enemy.suctionCooldown=Math.max(0,Number(row[9])||0);enemy.suctionPulse=Math.max(0,Number(row[10])||0);
  if(Math.hypot(tx-current.x,ty-current.y)>.02)moved++;
 }
 if(Array.isArray(data.orbs)){
  const activeOrbIds=new Set();
  for(const row of data.orbs){
   if(!Array.isArray(row)||row.length<5)continue;
   const id=String(row[0]);activeOrbIds.add(id);
   const orb=onlineOrbById.get(id);if(!orb)continue;
   const tx=clamp(Number(row[1])||0,0,W),ty=clamp(Number(row[2])||0,0,H),current=currentInterpolatedEnemyPosition(orb,now);
   orb.x=current.x;orb.y=current.y;orb.interpFromX=current.x;orb.interpFromY=current.y;orb.interpTargetX=tx;orb.interpTargetY=ty;orb.interpAt=now;orb.interpDuration=orbDuration;
   orb.phase=Number(row[3])||0;orb.life=Math.max(0,Number(row[4])||0);
  }
  if(data.orbScope!=='view'){
   let removedOrb=false;
   for(const id of onlineOrbById.keys())if(!activeOrbIds.has(id)){onlineOrbById.delete(id);removedOrb=true;}
   if(removedOrb)orbs=orbs.filter(orb=>onlineOrbById.has(String(orb.id)));
  }
 }
 onlineVisualEnemyCount=enemies.length;onlineVisualMovingEnemies=moved;
}
function applySharedDamage(data){ /* Dano é resolvido diretamente no servidor; mantido apenas por compatibilidade. */ }
function applySharedOrbSpawn(raw){
 if(!onlineMode||!raw||raw.id==null)return;
 const now=performance.now(),id=String(raw.id),old=onlineOrbById.get(id);
 const tx=clamp(Number(raw.x)||0,0,W),ty=clamp(Number(raw.y)||0,0,H),from=old?currentInterpolatedEnemyPosition(old,now):{x:tx,y:ty};
 const orb={...(old||{}),...raw,x:from.x,y:from.y,r:Math.max(2,Number(raw.r)||4)/GAME_WORLD_ZOOM,interpFromX:from.x,interpFromY:from.y,interpTargetX:tx,interpTargetY:ty,interpAt:now,interpDuration:old?500:0,authoritativePosition:true};
 if(old)Object.assign(old,orb);else orbs.push(orb);
 onlineOrbById.set(id,old||orb);
}
function removeSharedOrbIds(ids){
 if(!Array.isArray(ids)||!ids.length)return;
 const removed=new Set(ids.map(String));
 for(const id of removed)onlineOrbById.delete(id);
 orbs=orbs.filter(orb=>!removed.has(String(orb.id)));
}
function applySharedXp(data){
 if(!onlineMode||!data||!player)return;
 gainXp(Math.max(0,Number(data.value)||0),'shared');
}
function sendWorldSnapshot(dt){ /* O snapshot pertence ao servidor, não aos clientes. */ }
function killEnemy(i){
 const e=enemies[i];
 const killedBoss=BOSS_KINDS.includes(e.kind);if(killedBoss){bossKillsThisRun++;updateHud();}
 discoverCodexMonsters([e.kind]);if(!onlineMode){const xpValue=killedBoss?e.value*Math.pow(3,Math.max(0,bossKillsThisRun-1)):e.value;addOrb(e.x,e.y,xpValue);}burst(e.x,e.y,e.color,killedBoss?(e.kind==='kraken'?56:48):e.kind==='brute'?22:12,killedBoss?250:e.kind==='brute'?145:95);if(killedBoss){coins+=100;showToast('BOSS ABISSAL DERROTADO · +100 MOEDAS');saveCosmetics();}
 if(equippedSkin==='devourer'&&killedBoss){player.devourerVacuumUntil=performance.now()+5000;showToast('VÁCUO RESIDUAL · ORBES ATRAÍDOS');}
 if(!onlineMode&&equippedSkin==='coral')hp=Math.min(maxHp,hp+4);
 enemies.splice(i,1);audio(e.kind==='brute'?160:260,.055,'triangle',.012);updateHud();
}
function fire(){
 if(!player)return;let target=null,bd=Infinity;const maxRange=294*upgrades.range*(SkinAbilities?.targetRangeMultiplier(equippedSkin)||1)/GAME_WORLD_ZOOM;
 for(const e of enemies){const d=dist(player,e);if(d<maxRange&&d<bd){target=e;bd=d}}
 if(!target)return;
 const a=Math.atan2(target.y-player.y,target.x-player.x);
 const shotSpeed=430*(1+(upgrades.photon||0)*.22)/GAME_WORLD_ZOOM;
 const shotDamage=12*upgrades.power*(1+(upgrades.photon||0)*.16);
 const shotColor=(upgrades.spread||0)>0?'#d8b4fe':(upgrades.photon||0)>0?'#f0abfc':upgrades.ricochet>0?'#ffc47a':upgrades.electric>0?'#eaffff':upgrades.pierce>0?'#ffe7a1':'#83fff3';
 const angles=[a];if((upgrades.spread||0)>0){angles.push(a-.14,a+.14);if(upgrades.spread>=3)angles.push(a-.27,a+.27);}
 for(const shotAngle of angles){const damage=shotDamage/angles.length*(angles.length>1?1.35:1);projectiles.push({x:player.x+Math.cos(shotAngle)*13/GAME_WORLD_ZOOM,y:player.y+Math.sin(shotAngle)*13/GAME_WORLD_ZOOM,vx:Math.cos(shotAngle)*shotSpeed,vy:Math.sin(shotAngle)*shotSpeed,r:(4.1+(upgrades.photon||0)*.35)/GAME_WORLD_ZOOM,life:1.33,damage,pierceRemaining:upgrades.pierce||0,hitIds:[],color:shotColor,special:(upgrades.photon||0)>0?'photon':upgrades.pierce>0?'pierce':upgrades.electric>0?'electric':upgrades.ricochet>0?'ricochet':null});if(onlineMode&&window.AbyssalOnline?.sendShot)window.AbyssalOnline.sendShot({x:(player.x+Math.cos(shotAngle)*13/GAME_WORLD_ZOOM)/W,y:(player.y+Math.sin(shotAngle)*13/GAME_WORLD_ZOOM)/H,vx:Math.cos(shotAngle)*shotSpeed/W,vy:Math.sin(shotAngle)*shotSpeed/W,damage,color:shotColor,special:(upgrades.photon||0)>0?'photon':upgrades.pierce>0?'pierce':upgrades.electric>0?'electric':upgrades.ricochet>0?'ricochet':null});}
 player.angle=a;const muzzleX=player.x+Math.cos(a)*15,muzzleY=player.y+Math.sin(a)*15;burst(muzzleX,muzzleY,shotColor,angles.length>1?9:5,angles.length>1?90:45);if(upgrades.electric>0)effects.push({type:'beam',x1:player.x,y1:player.y,x2:muzzleX+Math.cos(a)*30,y2:muzzleY+Math.sin(a)*30,life:.16,maxLife:.16,color:'#eaffff'});audio(500,.045,'sine',.008);
}
function update(dt){
 if((gameState!=='playing'&&!(onlineMode&&gameState==='upgrade'))||!player)return;
 // Movimento local responsivo: teclado e toque/arraste. No online, trocar de aba nunca pausa o estado local intencionalmente.
 if(gameState==='playing'){
   // Correntezas ambientais removidas: o movimento depende apenas dos comandos do jogador.
   player.pulseCooldown=Math.max(0,(player.pulseCooldown||0)-dt);player.violetCooldown=Math.max(0,(player.violetCooldown||0)-dt);player.dashCooldown=Math.max(0,(player.dashCooldown||0)-dt);player.dashTime=Math.max(0,(player.dashTime||0)-dt);updateAbilityButtons();
   let mx=(keys['d']||keys['D']||keys['ArrowRight']?1:0)-(keys['a']||keys['A']||keys['ArrowLeft']?1:0);
   let my=(keys['s']||keys['S']||keys['ArrowDown']?1:0)-(keys['w']||keys['W']||keys['ArrowUp']?1:0);
   if(isMobileDevice()&&joystickVector.active){mx=joystickVector.x;my=joystickVector.y;}
   else if(!isMobileDevice()&&(autoFollowCursor||pointer.down)){const dx=pointer.x-player.x,dy=pointer.y-player.y,dd=Math.hypot(dx,dy);if(dd>12){mx=dx/dd;my=dy/dd}else{mx=0;my=0}}
   const mag=Math.hypot(mx,my)||1; if(mx||my){if(upgradeLevels.speed>0)playSkillSound('speed','trigger');const dashMultiplier=player.dashTime>0?2.05:1;const nx=player.x+mx/mag*player.moveSpeed*upgrades.speed*(SkinAbilities?.movementMultiplier(equippedSkin)||1)*dashMultiplier*dt,ny=player.y+my/mag*player.moveSpeed*upgrades.speed*(SkinAbilities?.movementMultiplier(equippedSkin)||1)*dashMultiplier*dt;const wall=52/GAME_WORLD_ZOOM;player.x=clamp(nx,wall+player.r,W-wall-player.r);player.y=clamp(ny,wall+player.r,H-wall-player.r);player.angle=Math.atan2(my,mx);updateCamera();player.trail.push({x:player.x,y:player.y,life:.28});if(player.trail.length>12)player.trail.shift()}

   if (['reefshark', 'whiteShark'].includes(equippedSkin) && (mx || my) && Math.random() < 0.45) {
     sharkWakeTrails.push({
       x: player.x - Math.cos(player.angle || 0) * (player.r * 1.1) + rand(-6, 6),
       y: player.y - Math.sin(player.angle || 0) * (player.r * 1.1) + rand(-6, 6),
       r: rand(14, 22),
       life: 5.0,
       maxLife: 5.0,
       color: '#7bf5ff'
     });
     if (sharkWakeTrails.length > 250) sharkWakeTrails.shift();
   }

   if(equippedSkin==='violet'&&player.violetCooldown<=0){
    player.violetCooldown=10;
    const pulseTargets=enemies.map(e=>({e,d:Math.hypot(e.x-player.x,e.y-player.y)})).filter(v=>v.d<=230/GAME_WORLD_ZOOM).sort((a,b)=>a.d-b.d).slice(0,4);
    burst(player.x,player.y,'#bd91ff',28,155);effects.push({type:'beam',x1:player.x-34/GAME_WORLD_ZOOM,y1:player.y,x2:player.x+34/GAME_WORLD_ZOOM,y2:player.y,life:.24,maxLife:.24,color:'#d9b7ff'});
    for(const target of pulseTargets){dealEnemyDamage(target.e,22,'violet-resonance',{visual:true});burst(target.e.x,target.e.y,'#d7b7ff',7,75);}
   }
   player.fireTimer=(player.fireTimer||0)-dt;if(player.fireTimer<=0){fire();player.fireTimer=Math.max(.12,.52/((upgrades.rate||1)*(SkinAbilities?.fireRateMultiplier(equippedSkin)||1)))}
 }
 if(onlineMode&&authoritativeElapsed!==null&&lastSnapshotAt){elapsed=authoritativeElapsed+Math.max(0,(performance.now()-lastSnapshotAt)/1000);}else elapsed+=dt;if(!onlineMode){spawnTimer-=dt;updateBossProgressionStep(dt);}else{updateBossProgressionStep(dt);}

  // Gestão da esteira de bolhas do tubarão (dura 5 segundos e causa dano suave)
  for (let i = sharkWakeTrails.length - 1; i >= 0; i--) {
    const bubble = sharkWakeTrails[i];
    bubble.life -= dt;
    bubble.damageTimer = (bubble.damageTimer || 0) - dt;
    if (bubble.damageTimer <= 0) {
      bubble.damageTimer = 0.4;
      for (const e of enemies) {
        if (Math.hypot(e.x - bubble.x, e.y - bubble.y) <= bubble.r + (e.r || 10)) {
          dealEnemyDamage(e, 2, 'pelagic-wake', { visual: false, silentSound: true });
          burst(e.x, e.y, '#7bf5ff', 3, 40);
        }
      }
    }
    if (bubble.life <= 0) sharkWakeTrails.splice(i, 1);
  }

  // Dano contínuo de veneno (verde) nos inimigos envenenados
  for (const e of enemies) {
    if (e.poisonTimer > 0) {
      e.poisonTimer -= dt;
      e.poisonTick = (e.poisonTick || 0) - dt;
      if (e.poisonTick <= 0) {
        e.poisonTick = 0.35;
        dealEnemyDamage(e, 5, 'poison-dot', { visual: false, silentSound: true });
        burst(e.x + rand(-e.r*0.5, e.r*0.5), e.y + rand(-e.r*0.5, e.r*0.5), '#39ff74', 4, 45);
      }
    }
  }

player.invuln=Math.max(0,player.invuln-dt);damageFlash=Math.max(0,damageFlash-dt);shake=Math.max(0,shake-dt*22);
 if(!onlineMode&&equippedSkin==='devourer'&&player.devourerVacuumUntil>performance.now()){for(const orb of orbs){const d=Math.hypot(player.x-orb.x,player.y-orb.y);if(d>1&&d<760/GAME_WORLD_ZOOM){const pull=Math.min(d,dt*(110+Math.max(0,760/GAME_WORLD_ZOOM-d)*.22));orb.x+=(player.x-orb.x)/d*pull;orb.y+=(player.y-orb.y)/d*pull;}}}
 if(!onlineMode&&spawnTimer<=0){const commonCount=enemies.filter(e=>!BOSS_KINDS.includes(e.kind)).length;if(commonCount<MAX_COMMON_ENEMIES&&enemies.length<MAX_ENEMIES){spawnEnemy(false,'common');const ramp=clamp(elapsed/300,0,1);spawnTimer=Math.max(.18,.55*(1-(2/3)*ramp));}else spawnTimer=.35;}
 if(!onlineMode&&elapsed>=nextBossAt){
  const activeBosses=enemies.filter(e=>BOSS_KINDS.includes(e.kind)).length;
  if(activeBosses<MAX_BOSSES&&enemies.length<MAX_ENEMIES){
    const bossKinds = window.AbyssalEnemyAI?.chooseBossesForSession?.(1) || ['boss'];
    for(const k of bossKinds){
      if(enemies.length<MAX_ENEMIES&&enemies.filter(e=>BOSS_KINDS.includes(e.kind)).length<MAX_BOSSES) spawnEnemy(false, k);
    }
  }
  nextBossAt=elapsed+60;
 }
 if(!onlineMode&&upgrades.regen>0&&Math.random()<dt*upgrades.regen*.25){const beforeRegen=hp;hp=Math.min(maxHp,hp+1);if(hp>beforeRegen)playSkillSound('regen','trigger');}
 if(['reefshark','abysscroc','armoredgator'].includes(equippedSkin)){
  const cfg={reefshark:{cooldown:14,range:260,damage:18,arc:.48,width:58},abysscroc:{cooldown:16,range:210,damage:42,arc:.78,width:120},armoredgator:{cooldown:14,range:190,damage:30,arc:Math.PI,width:0}}[equippedSkin];
  player.predatorAbilityTimer=(Number(player.predatorAbilityTimer)||4)-dt;
  if(player.predatorAbilityTimer<=0){
   player.predatorAbilityTimer=cfg.cooldown;
   const angle=Number(player.angle)||0,range=cfg.range/GAME_WORLD_ZOOM;
   if(equippedSkin==='abysscroc')player.dashTime=.32;
   const targets=enemies.filter(e=>{const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy);if(d>range)return false;if(cfg.arc>=Math.PI)return true;const a=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(a-angle),Math.cos(a-angle));return Math.abs(delta)<=cfg.arc&&Math.abs(Math.sin(delta)*d)<=cfg.width/GAME_WORLD_ZOOM;}).sort((a,b)=>dist(player,a)-dist(player,b)).slice(0,8);
   const color=equippedSkin==='reefshark'?'#8bd8ec':equippedSkin==='abysscroc'?'#79bd83':'#c5a66e';
   burst(player.x,player.y,color,28,175);effects.push({type:'ring',x:player.x,y:player.y,r:0,max:range,life:.42,maxLife:.42,color});

    if(equippedSkin==='reefshark'){
      for(let step=0; step<=range; step+=24){
        sharkWakeTrails.push({
          x: player.x + Math.cos(angle)*step + rand(-12,12),
          y: player.y + Math.sin(angle)*step + rand(-12,12),
          r: rand(18, 30),
          life: 5.0,
          maxLife: 5.0,
          color: '#8bd8ec'
        });
      }
    }

   for(const target of targets){
     dealEnemyDamage(target,cfg.damage,equippedSkin==='reefshark'?'reefshark-dash':equippedSkin==='abysscroc'?'abysscroc-lunge':'armoredgator-spin',{visual:true});
     burst(target.x,target.y,color,7,90);
     if(equippedSkin==='armoredgator'){
       const kdx=target.x-player.x,kdy=target.y-player.y;
       const kdd=Math.hypot(kdx,kdy)||1;
       const kbForce=130/GAME_WORLD_ZOOM;
       target.x=clamp(target.x+(kdx/kdd)*kbForce,8/GAME_WORLD_ZOOM,W-8/GAME_WORLD_ZOOM);
       target.y=clamp(target.y+(kdy/kdd)*kbForce,8/GAME_WORLD_ZOOM,H-8/GAME_WORLD_ZOOM);
       target.vx=(kdx/kdd)*280;
       target.vy=(kdy/kdd)*280;
     }
   }
   showToast(equippedSkin==='reefshark'?'RASGO PELÁGICO':equippedSkin==='abysscroc'?'MORDIDA DE EMBOSCADA':'GIRO DO NILO');
  }
 }
 if(equippedSkin==='kraken'){
  player.krakenSweepTimer=(Number(player.krakenSweepTimer)||0)-dt;
  if(player.krakenSweepTimer<=0){player.krakenSweepTimer=12;let hitCount=0;const range=280/GAME_WORLD_ZOOM;for(const target of enemies){if(hitCount>=6)break;if(Math.hypot(target.x-player.x,target.y-player.y)>range)continue;dealEnemyDamage(target,48,'kraken-sweep');target.hit=.22;effects.push({type:'beam',x1:player.x,y1:player.y,x2:target.x,y2:target.y,life:.22,maxLife:.22,color:'#8b5cf6'});burst(target.x,target.y,'#8b5cf6',5,80);hitCount++;}if(hitCount){effects.push({type:'ring',x:player.x,y:player.y,r:0,max:range,life:.45,maxLife:.45,color:'#8b5cf6'});playSkillSound('kraken-sweep','trigger');showToast('KRAKEN · VARREDURA TENTACULAR');}}
 }
 if(upgrades.burst>0){player.burstTimer=(player.burstTimer||0)-dt;if(player.burstTimer<=0){player.burstTimer=Math.max(3.5,7/upgrades.burst);for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<210*upgrades.range/GAME_WORLD_ZOOM){dealEnemyDamage(e,12*upgrades.burst,'burst');burst(e.x,e.y,'#b4a1ff',8,100)}}burst(player.x,player.y,'#b3a0ff',60,260);effects.push({type:'ring',x:player.x,y:player.y,r:0,max:210*upgrades.range/GAME_WORLD_ZOOM,life:.55,maxLife:.55,color:'#b3a0ff'});audio(500,.045,'sine',.008)}}
 if(upgrades.nova>0){player.novaTimer=(player.novaTimer||0)-dt;if(player.novaTimer<=0){player.novaTimer=Math.max(4.5,9/upgrades.nova);for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<210*upgrades.range/GAME_WORLD_ZOOM){dealEnemyDamage(e,18*upgrades.nova,'nova');burst(e.x,e.y,'#72f5ff',12,130)}}burst(player.x,player.y,'#72f5ff',85,300);effects.push({type:'ring',x:player.x,y:player.y,r:0,max:210*upgrades.range/GAME_WORLD_ZOOM,life:.75,maxLife:.75,color:'#72f5ff'});audio(500,.045,'sine',.008)}}
 if(upgrades.gravitationalRupture>0){
  player.gravitationalRuptureTimer=(Number(player.gravitationalRuptureTimer)||0)-dt;
  if(player.gravitationalRuptureTimer<=0){
   player.gravitationalRuptureTimer=.34;
   const fieldRange=588*(upgrades.range||1)*(SkinAbilities?.targetRangeMultiplier(equippedSkin)||1)/GAME_WORLD_ZOOM;
   for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];if(dist(player,e)>fieldRange)continue;
    dealEnemyDamage(e,10,'gravitationalRupture');
    burst(e.x,e.y,'#76f7ff',8,80);
    effects.push({type:'beam',x1:e.x-5/worldZoom,y1:e.y-5/worldZoom,x2:e.x+5/worldZoom,y2:e.y+5/worldZoom,life:.16,maxLife:.16,color:'#9dfcff'});
   }
   playSkillSound('nova','trigger');
  }
 }
 if(upgrades.arcChain>0){
  player.arcChainTimer=(Number(player.arcChainTimer)||0)-dt;
  if(player.arcChainTimer<=0){
   player.arcChainTimer=.48;
   const fieldRange=588*(upgrades.range||1)*(SkinAbilities?.targetRangeMultiplier(equippedSkin)||1)/GAME_WORLD_ZOOM;
   const targets=enemies.filter(e=>dist(player,e)<=fieldRange).sort((a,b)=>dist(player,a)-dist(player,b)).slice(0,12);
   let previous={x:player.x,y:player.y};
   for(const target of targets){
    dealEnemyDamage(target,16,'arcChain');
    target.hit=.16;
    effects.push({type:'beam',x1:previous.x,y1:previous.y,x2:target.x,y2:target.y,life:.2,maxLife:.2,color:'#77f7ff'});
    burst(target.x,target.y,'#a4ffff',7,90);
    previous=target;
   }
   if(targets.length)audio(650,.04,'sine',.009);
  }
 }
 // Co-op is rendered from the server's authoritative coordinates. Do NOT run a
 // second local AI here: that divergence is what made server-side contact attacks feel
 // like invisible enemies. Solo keeps its original local movement/collision loop.
 onlineVisualEnemyCount=enemies.length;onlineVisualMovingEnemies=0;
 const enemyFrameNow=performance.now(),localTarget={x:player.x,y:player.y,local:true,skinId:equippedSkin},localTargets=[localTarget];
 for(let i=enemies.length-1;i>=0;i--){
  const e=enemies[i];e.hit=Math.max(0,e.hit-dt);
  if(onlineMode){
   const bx=Number(e.x)||0,by=Number(e.y)||0;
   const p=window.AbyssalEnemyNetcode?.renderedPosition?.(e,enemyFrameNow);
   if(p){e.x=p.x;e.y=p.y;}
   if(Math.hypot(e.x-bx,e.y-by)>.02)onlineVisualMovingEnemies++;
   continue;
  }
  if(e.kind==='devourer'){
   e.suctionCooldown=Math.max(0,(Number(e.suctionCooldown)||0)-dt);
   if(e.suctionActive){e.suctionTimer=Math.max(0,(Number(e.suctionTimer)||0)-dt);if(e.suctionTimer<=0)e.suctionActive=false;}
   else if(e.suctionCooldown<=0){e.suctionActive=true;e.suctionTimer=4;e.suctionCooldown=20;e.suctionPulse=(Number(e.suctionPulse)||0)+1;playDevourerSuction();showToast('SUCÇÃO DO DEVORADOR · AFASTE-SE DA BOCA');}
   if(e.suctionActive){
    e.vx=0;e.vy=0;e.angle=Math.atan2(player.y-e.y,player.x-e.x);
    for(const creature of enemies){if(creature===e)continue;const pull=window.AbyssalEnemyAI?.suctionPullDelta?.(creature,e,dt);if(!pull||(!pull.dx&&!pull.dy))continue;creature.x=clamp(creature.x+pull.dx,8/GAME_WORLD_ZOOM,W-8/GAME_WORLD_ZOOM);creature.y=clamp(creature.y+pull.dy,8/GAME_WORLD_ZOOM,H-8/GAME_WORLD_ZOOM);creature.vx=pull.dx/Math.max(dt,.001);creature.vy=pull.dy/Math.max(dt,.001);}
    const pull=window.AbyssalEnemyAI?.suctionPullDelta?.(player,e,dt);if(pull&&(pull.dx||pull.dy)){player.x=clamp(player.x+pull.dx,player.r,W-player.r);player.y=clamp(player.y+pull.dy,player.r,H-player.r);updateCamera();}
    continue;
   }
  }
  // Habilidades ativas reais dos monstros e bosses:
  // 1. Angler (Lanterna): puxão hipnótico de curto alcance
  if(e.kind==='angler'){
   e.anglerPulse=(e.anglerPulse||0)+dt;
   if(e.anglerPulse>3.8){
     e.anglerPulse=0;
     const dToP=Math.hypot(player.x-e.x,player.y-e.y);
     if(dToP<320/GAME_WORLD_ZOOM){
       const pull=22/GAME_WORLD_ZOOM;
       player.x-=(player.x-e.x)/dToP*pull;
       player.y-=(player.y-e.y)/dToP*pull;
       effects.push({type:'ring',x:e.x,y:e.y,max:90/worldZoom,life:.25,maxLife:.25,color:'#ffcb70'});
     }
   }
  }
  // 2. Maw (A Boca do Abismo): mordida expansiva com micro-onda de choque
  if(e.kind==='maw'){
   e.mawChomp=(e.mawChomp||0)+dt;
   if(e.mawChomp>4.5){
     e.mawChomp=0;
     burst(e.x,e.y,'#c16cff',12,110);
     const dToP=Math.hypot(player.x-e.x,player.y-e.y);
     if(dToP<160/GAME_WORLD_ZOOM&&player.invuln<=0){hurtPlayer(12);shake=6;}
   }
  }
  // 3. Leviathan (Leviatã): tremor de trincheira com rastro
  if(e.kind==='leviathan'){
   e.leviTrail=(e.leviTrail||0)+dt;
   if(e.leviTrail>0.25){
     e.leviTrail=0;
     effects.push({type:'ring',x:e.x,y:e.y,max:40/worldZoom,life:.3,maxLife:.3,color:'#4ce0d1'});
   }
  }
  // 4. White Shark Boss: rastro de corte de barbatanas
  if(e.kind==='whiteSharkBoss'){
   e.sharkWake=(e.sharkWake||0)+dt;
   if(e.sharkWake>0.15){
     e.sharkWake=0;
     effects.push({type:'beam',x1:e.x-Math.cos(e.angle||0)*28,y1:e.y-Math.sin(e.angle||0)*28,x2:e.x+Math.cos(e.angle||0)*10,y2:e.y+Math.sin(e.angle||0)*10,life:.22,maxLife:.22,color:'#68a8b8'});
   }
  }
  // 5. Bruto: carapaça endurecida reflete fragmentos ao tomar hit
  if(e.kind==='brute'&&e.hit>0.08){
    burst(e.x,e.y,'#bd88ff',2,30);
  }

  const target=localTarget;
  const beforeEnemyX=e.x,beforeEnemyY=e.y;
  if(window.AbyssalEnemyAI?.moveTowardTarget){
   soloEnemyMovementOptions.minX=8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.maxX=W-8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.minY=8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.maxY=H-8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.stopDistance=Math.max(1,(e.r+player.r+8/GAME_WORLD_ZOOM)*.96);
   window.AbyssalEnemyAI.moveTowardTarget(e,localTargets,dt,soloEnemyMovementOptions,soloEnemyMovementResult);
  }else{
   if(e.paralyzedUntil && performance.now() < e.paralyzedUntil){ /* paralisado */ } else { const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy)||1;e.phase+=dt*(e.kind==='stinger'?7:3);e.angle=Math.atan2(dy,dx);e.x=clamp(e.x+dx/d*e.speed*dt,8/GAME_WORLD_ZOOM,W-8/GAME_WORLD_ZOOM);e.y=clamp(e.y+dy/d*e.speed*dt,8/GAME_WORLD_ZOOM,H-8/GAME_WORLD_ZOOM); }
  }
  const td=Math.hypot(e.x-player.x,e.y-player.y);
  if(Math.hypot(e.x-beforeEnemyX,e.y-beforeEnemyY)>.05)onlineVisualMovingEnemies++;
  e.attackCd = (e.attackCd || 0) - dt; if(target.local&&(td<e.r+player.r+8/GAME_WORLD_ZOOM||(e.kind==='kraken'&&window.AbyssalEnemyAI?.touchesKrakenTentacle?.(e,player,1)))){if(e.attackCd<=0){if(player.invuln<=0){hurtPlayer(e.damage);}e.attackCd=e.kind==='stinger'?.8:e.kind==='kraken'?.95:1.1;}}
 }
 // Uniform-grid broad phase: build once after movement; each projectile checks only its cell and neighbors.
 enemyCollisionGrid.clear();enemyCollisionBucketCount=0;enemyCollisionCellSize=270;
 for(const enemy of enemies){
  if(enemy.hp<=0)continue;
  const gx=Math.floor(enemy.x/enemyCollisionCellSize),gy=Math.floor(enemy.y/enemyCollisionCellSize),key=gy*65536+gx;
  let bucket=enemyCollisionGrid.get(key);
  if(!bucket){bucket=enemyCollisionBuckets[enemyCollisionBucketCount]||(enemyCollisionBuckets[enemyCollisionBucketCount]=[]);bucket.length=0;enemyCollisionBucketCount++;enemyCollisionGrid.set(key,bucket);}
  bucket.push(enemy);
 }
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;let hit=false;projectileCandidates.length=0;const cellX=Math.floor(p.x/enemyCollisionCellSize),cellY=Math.floor(p.y/enemyCollisionCellSize);for(let gx=cellX-1;gx<=cellX+1;gx++)for(let gy=cellY-1;gy<=cellY+1;gy++){const bucket=enemyCollisionGrid.get(gy*65536+gx);if(bucket)for(const enemy of bucket)projectileCandidates.push(enemy);}for(let j=projectileCandidates.length-1;j>=0;j--){const e=projectileCandidates[j];p.hitIds ||= [];if(e.hp>0&&!p.hitIds.includes(e.id)&&Math.hypot(p.x-e.x,p.y-e.y)<p.r+e.r){p.hitIds.push(e.id);dealEnemyDamage(e,p.damage,p.special||(upgradeLevels.power>0?'power':null));e.hit=.12;burst(p.x,p.y,p.color,4,40);if(p.special)audio(500,.045,'sine',.008);
 if((upgrades.electric||0)>0){let chains=0,from=e;const visited=new Set([e.id]);while(chains<Math.min(3,upgrades.electric)){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(!visited.has(other.id)&&d<120/GAME_WORLD_ZOOM&&d<nd){next=other;nd=d}}if(!next)break;effects.push({type:'beam',x1:from.x,y1:from.y,x2:next.x,y2:next.y,life:.24,maxLife:.24,color:'#79f3ff'});burst(from.x,from.y,'#e6ffff',4,70);burst(next.x,next.y,'#79f3ff',12,120);dealEnemyDamage(next,p.damage*(.28+upgrades.electric*.08),'electric');audio(500,.045,'sine',.008);next.hit=.12;burst(next.x,next.y,'#79f3ff',10,95);visited.add(next.id);from=next;chains++;}}
 if((upgrades.ricochet||0)>0){let from=e;const visited=new Set([e.id]);for(let bounce=0;bounce<Math.min(3,upgrades.ricochet);bounce++){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(!visited.has(other.id)&&d<190/GAME_WORLD_ZOOM&&d<nd){next=other;nd=d}}if(!next)break;effects.push({type:'beam',x1:from.x,y1:from.y,x2:next.x,y2:next.y,life:.28,maxLife:.28,color:'#ffc47a'});burst(from.x,from.y,'#fff0c7',4,65);burst(next.x,next.y,'#ffc47a',14,135);dealEnemyDamage(next,p.damage*.42,'ricochet');audio(500,.045,'sine',.008);next.hit=.15;burst(next.x,next.y,'#ffc47a',14,125);visited.add(next.id);from=next;}}
 if((p.pierceRemaining||0)>0){p.pierceRemaining--; }else{hit=true;break}}}if(hit||p.life<=0||p.x< -100/worldZoom||p.x>W+100/worldZoom||p.y< -100/worldZoom||p.y>H+100/worldZoom)projectiles.splice(i,1)}
 for(let i=orbs.length-1;i>=0;i--){
  const o=orbs[i];
  if(onlineMode){o.phase=(Number(o.phase)||0)+dt*3;const op=currentInterpolatedEnemyPosition(o,performance.now());o.x=op.x;o.y=op.y;continue;}
  o.phase+=dt*3;o.life-=dt;
  let d=Math.hypot(player.x-o.x,player.y-o.y);
  const magnetLevel=Math.max(0,Number(upgradeLevels.magnet)||0);
  const magnetRange=140*Math.max(1,Number(upgrades.magnet)||1)*(SkinAbilities?.magnetRangeMultiplier(equippedSkin)||1)/GAME_WORLD_ZOOM;
  if(d<magnetRange){
   if(magnetLevel>0)playSkillSound('magnet','trigger');
   const f=clamp((magnetRange-d)/Math.max(1,magnetRange),0,1);
   // Pull speed is scaled by zoom so attraction stays visibly strong on both desktop and mobile.
   const pullSpeed=(36+f*150)*(1+magnetLevel*.22)/GAME_WORLD_ZOOM;
   const pull=Math.min(d,dt*pullSpeed);
   if(d>0.001){o.x+=(player.x-o.x)/d*pull;o.y+=(player.y-o.y)/d*pull;}
   d=Math.hypot(player.x-o.x,player.y-o.y);
  }
  if(d<player.r+o.r+4/GAME_WORLD_ZOOM){
   orbs.splice(i,1);burst(o.x,o.y,'#9f91ff',5,55);audio(700+Math.random()*180,.06,'sine',.012);
   gainXp(o.value,'orb');
   if(gameState==='upgrade')break;
  }else if(o.life<=0)orbs.splice(i,1);
 }
 for(let i=effects.length-1;i>=0;i--){effects[i].life-=dt;if(effects[i].life<=0)effects.splice(i,1)}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.05,dt);p.vy*=Math.pow(.05,dt);p.life-=dt;if(p.life<=0){particles[i]=particles[particles.length-1];particles.pop();if(particlePool.length<700)particlePool.push(p)}}
 if(particles.length>particleBudget()){const excess=particles.length-particleBudget();for(let i=0;i<excess;i++){if(particlePool.length<700)particlePool.push(particles[i]);}particles.splice(0,excess);}if(projectiles.length>projectileBudget())projectiles.splice(0,projectiles.length-projectileBudget());if(effects.length>effectBudget())effects.splice(0,effects.length-effectBudget());if(orbs.length>orbBudget())orbs.splice(0,orbs.length-orbBudget());
 if(onlineMode&&window.AbyssalOnline){flushOnlineDamageBatch();window.AbyssalOnline.sendPosition({x:player.x,y:player.y,angle:player.angle});sendWorldSnapshot(dt);runProgressTimer-=dt;if(runProgressTimer<=0){runProgressTimer=1;window.AbyssalOnline.sendRunProgress?.({score,level,survival:elapsed,bossesKilled:bossKillsThisRun});}}
 updateHud(false);
}
const metaShopItems=[
 {id:'bulkhead',name:'Costelas de Basalto',type:'passive',price:1800,max:3,icon:'⬡',desc:'+8 de vida máxima por nível.'},
 {id:'focuser',name:'Lente de Fótons',type:'passive',price:2200,max:3,icon:'✧',desc:'+8% de dano inicial por nível.'},
 {id:'current',name:'Aletas de Corrente',type:'passive',price:1600,max:3,icon:'➤',desc:'+5% de movimento por nível.'},
 {id:'startShield',name:'Casulo de Pressão',type:'passive',price:3200,max:1,icon:'◉',desc:'Comece cada mergulho com 1 carga de escudo.'},
 {id:'pulse',name:'Pulso de Maré',type:'active',price:3500,max:1,icon:'✺',desc:'Ative Q ou o botão para causar dano em área. Recarga: 14 s.'},
 {id:'dash',name:'Passo Fantasma',type:'active',price:4200,max:1,icon:'〰',desc:'Ative E ou o botão para disparar em alta velocidade e ficar invulnerável por 1,25 s.'}
];
let equippedActiveSkillsCache=null;
function loadEquippedActiveSkills(){
 if(!equippedActiveSkillsCache){
  try{const value=JSON.parse(localStorage.getItem('abyssalEquippedActiveSkills')||'[]');equippedActiveSkillsCache=Array.isArray(value)?value.filter(id=>id==='pulse'||id==='dash'):[];}
  catch(_){equippedActiveSkillsCache=[];}
 }
 return equippedActiveSkillsCache;
}
window.addEventListener('storage',event=>{if(event.key==='abyssalEquippedActiveSkills'){equippedActiveSkillsCache=null;updateAbilityButtons(true);}});
function toggleEquippedActiveSkill(id){
 if(!['pulse','dash'].includes(id)||!(Number(metaUpgrades[id])>0))return;
 let equipped=[...loadEquippedActiveSkills()];
 if(equipped.includes(id))equipped=equipped.filter(x=>x!==id);
 else{if(equipped.length>=2){showToast('VOCÊ JÁ EQUIPOU 2 HABILIDADES ATIVAS');return;}equipped.push(id);}
 equippedActiveSkillsCache=equipped;
 localStorage.setItem('abyssalEquippedActiveSkills',JSON.stringify(equipped));renderShop();updateAbilityButtons(true);showToast(equipped.includes(id)?'HABILIDADE EQUIPADA':'HABILIDADE DESEQUIPADA');
}
function buyMetaUpgrade(id){
 const item=metaShopItems.find(x=>x.id===id);if(!item)return;
 const current=Number(metaUpgrades[id])||0;if(current>=item.max){showToast('MELHORIA JÁ NO NÍVEL MÁXIMO');return;}
 if(window.AbyssalOnline?.isAuthenticated()){
  window.AbyssalOnline.purchaseMeta(id);return;
 }
 if(coins<item.price){showToast('MOEDAS ABISSAIS INSUFICIENTES');return;}
 coins-=item.price;metaUpgrades[id]=current+1;saveCosmetics();renderShop();showToast(`${item.name.toUpperCase()} DESBLOQUEADO`);playSkillSound(id,'learn');
}
function activateAbility(id){
 if(!player||gameState!=='playing')return;
 if(id==='pulse'){
  if(!(Number(metaUpgrades.pulse)>0)){showToast('DESBLOQUEIE PULSO DE MARÉ NA LOJA');return;}if(!loadEquippedActiveSkills().includes('pulse')){showToast('EQUIPE PULSO DE MARÉ NA LOJA');return;}
  if(player.pulseCooldown>0)return;
  player.pulseCooldown=14;const radius=245*upgrades.range/GAME_WORLD_ZOOM;
  for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<radius)dealEnemyDamage(e,28*upgrades.power,'pulse',{silentSound:true,visual:false});}
  effects.push({type:'ring',x:player.x,y:player.y,r:0,max:radius,life:.7,maxLife:.7,color:'#78f8f3'});burst(player.x,player.y,'#9ffff8',lowPowerRendering?12:22,210);playSkillSound('pulse','trigger');showToast('PULSO DE MARÉ · LIBERADO');
 }else if(id==='dash'){
  if(!(Number(metaUpgrades.dash)>0)){showToast('DESBLOQUEIE PASSO FANTASMA NA LOJA');return;}if(!loadEquippedActiveSkills().includes('dash')){showToast('EQUIPE PASSO FANTASMA NA LOJA');return;}
  if(player.dashCooldown>0)return;
  player.dashCooldown=18;player.dashTime=1.25;player.invuln=Math.max(player.invuln,1.25);if(onlineMode)window.AbyssalOnline?.sendProtection?.(1.25,'dash');player.x=clamp(player.x+Math.cos(player.angle||0)*92/GAME_WORLD_ZOOM,52/GAME_WORLD_ZOOM+player.r,W-52/GAME_WORLD_ZOOM-player.r);player.y=clamp(player.y+Math.sin(player.angle||0)*92/GAME_WORLD_ZOOM,52/GAME_WORLD_ZOOM+player.r,H-52/GAME_WORLD_ZOOM-player.r);updateCamera();burst(player.x,player.y,'#d8c9ff',lowPowerRendering?8:14,130);playSkillSound('dash','trigger');showToast('PASSO FANTASMA · INVULNERÁVEL');
 }
 updateAbilityButtons();
}
function updateAbilityButtons(force=false){
 const now=performance.now();
 // Cooldown labels only change to tenths of a second; updating the DOM 10x/second is enough.
 if(!force&&now-lastAbilityUiAt<100)return;
 lastAbilityUiAt=now;
 const pulse=$('skillPulseBtn'),dash=$('skillDashBtn'),equipped=loadEquippedActiveSkills();
 if(pulse){const hidden=!(Number(metaUpgrades.pulse)>0&&equipped.includes('pulse')),disabled=!player||player.pulseCooldown>0;if(pulse.hidden!==hidden)pulse.hidden=hidden;if(pulse.disabled!==disabled)pulse.disabled=disabled;const label=player&&player.pulseCooldown>0?`PULSO ${player.pulseCooldown.toFixed(1)}s`:(mobileViewport?'✦ PULSO DE MARÉ':'Q · PULSO DE MARÉ');if(pulse.textContent!==label)pulse.textContent=label;}
 if(dash){const hidden=!(Number(metaUpgrades.dash)>0&&equipped.includes('dash')),disabled=!player||player.dashCooldown>0;if(dash.hidden!==hidden)dash.hidden=hidden;if(dash.disabled!==disabled)dash.disabled=disabled;const label=player&&player.dashCooldown>0?`PASSO ${player.dashCooldown.toFixed(1)}s`:(mobileViewport?'✧ PASSO FANTASMA':'E · PASSO FANTASMA');if(dash.textContent!==label)dash.textContent=label;}
}
function setTextIfChanged(id,value){const node=$(id),text=String(value);if(node&&node.textContent!==text)node.textContent=text;}
function setWidthIfChanged(id,value){const node=$(id),width=String(value);if(node&&node.style.width!==width)node.style.width=width;}
function renderSoloEnergyRanking(){
 const root=$('runEnergyRankingList');if(!root)return;
 const value=Math.floor(score).toLocaleString('pt-BR');
 if(!root.querySelector('.energy-value')){
  const row=document.createElement('div');row.className='run-energy-row';
  const name=document.createElement('span');name.className='energy-name';name.textContent='1. Você';
  const amount=document.createElement('span');amount.className='energy-value';
  row.append(name,amount);root.replaceChildren(row);lastSoloRankingValue=null;
 }
 if(value!==lastSoloRankingValue){const amount=root.querySelector('.energy-value');if(amount)amount.textContent=value;lastSoloRankingValue=value;}
}
function updateHud(force=true){
 const now=performance.now();if(!force&&now-lastHudUpdateAt<100)return;lastHudUpdateAt=now;
 setTextIfChanged('timeText',fmtTime(elapsed));const levelDisplay = areAllUpgradesMaxed() || level === 'MAX' ? 'Nível MAX' : String(level).padStart(2,'0');
 setTextIfChanged('levelText', levelDisplay);setTextIfChanged('bossKillsText',String(bossKillsThisRun).padStart(2,'0'));setTextIfChanged('scoreText',score.toLocaleString('pt-BR'));setTextIfChanged('hpText',`${Math.ceil(Math.max(0,hp))} / ${maxHp}`);setWidthIfChanged('hpFill',`${clamp(hp/maxHp*100,0,100)}%`);setTextIfChanged('xpText',`${Math.floor(xp)} / ${xpNeed}`);setWidthIfChanged('xpFill',`${clamp(xp/xpNeed*100,0,100)}%`);renderSelectedSkills();if(!onlineMode)renderSoloEnergyRanking();
}
window.addEventListener('abyssal-run-energy-ranking',ev=>{const root=$('runEnergyRankingList');if(!root)return;const ranking=Array.isArray(ev.detail)?ev.detail:[];root.innerHTML=ranking.length?ranking.map((item,index)=>'<div class="run-energy-row"><span class="energy-name">'+(Number(item.rank)||index+1)+'. '+escapeHtml(item.nickname||'Mergulhador')+'</span><span class="energy-value">'+Math.floor(Number(item.energy)||0).toLocaleString('pt-BR')+'</span></div>').join(''):'<span>Sem dados ainda</span>';});
function endGame(){
 if(gameState==='over'||gameState==='menu')return;
 wasOnlineModeOnDeath=Boolean(onlineMode);
 const authenticated=Boolean(window.AbyssalOnline?.isAuthenticated?.());
 const earnedCoins=Math.max(5,Math.floor(score/35)+level*2);
 if(authenticated&&window.AbyssalOnline?.finishRun)runResultPending=true;
 else if(onlineMode){coins+=earnedCoins;saveCosmetics();renderShop();}
 else{coins+=earnedCoins;saveCosmetics();renderShop();runResultPending=true;}
 showEndOfRun(earnedCoins);
 updateNotifBadge();
 if(onlineMode&&!authenticated)window.AbyssalOnline?.leaveWorld();
 const endBtn=document.getElementById('endDiveBtn');if(endBtn)endBtn.style.display='none';
 gameState='over';document.body.classList.remove('game-active');$('hud').hidden=true;$('pauseBtn').hidden=true;$('toggleHudBtn').hidden=true;setHudCollapsed(false);const mobileStick=$('mobileJoystick');if(mobileStick)mobileStick.hidden=true;$('gameOverScreen').hidden=false;const reviveButton=$('reviveWithAdBtn');if(reviveButton)reviveButton.disabled=false;setReviveMessage('');
 $('finalTime').textContent=fmtTime(elapsed);$('finalScore').textContent=score.toLocaleString('pt-BR');$('finalLevel').textContent=level;
 if(score>bestScore){bestScore=score;localStorage.setItem('abyssalBestScore',String(score));$('bestScore').textContent=bestScore.toLocaleString('pt-BR')}
 if(elapsed>bestTime){bestTime=elapsed;localStorage.setItem('abyssalBestTime',String(elapsed));$('bestTime').textContent=fmtTime(bestTime)}
 $('saveStatus').textContent=runResultPending?'RESULTADO AGUARDANDO SUA ESCOLHA':'SINAL DE SOBREVIVÊNCIA REGISTRADO';burst(player.x,player.y,'#ff7796',35,210);audio(95,.5,'sawtooth',.04);
}
function pauseGame(){if(onlineMode){showToast('A partida cooperativa não pode ser pausada.');return}if(gameState!=='playing')return;gameState='paused';$('pauseScreen').hidden=false;$('pauseBtn').hidden=true}
document.getElementById('mobilePauseBtn')?.addEventListener('click',pauseGame);
function resumeGame(){if(gameState!=='paused')return;gameState='playing';$('pauseScreen').hidden=true;$('pauseBtn').hidden=false;last=performance.now()}
function drawBackground(t){
 // Static gradients are created once per canvas size/zoom instead of allocating them every frame.
 if(!backgroundGradientCache){backgroundGradientCache=ctx.createRadialGradient(W*.5,H*.45,10,W*.5,H*.45,Math.max(W,H)*.82);backgroundGradientCache.addColorStop(0,'#0d2a39');backgroundGradientCache.addColorStop(.34,'#071a2b');backgroundGradientCache.addColorStop(.68,'#03111f');backgroundGradientCache.addColorStop(1,'#01040a');}
 if(!backgroundBloomCache){backgroundBloomCache=ctx.createRadialGradient(W*.79,H*.62,2,W*.79,H*.62,560);backgroundBloomCache.addColorStop(0,'rgba(145,25,70,.12)');backgroundBloomCache.addColorStop(.42,'rgba(91,29,95,.06)');backgroundBloomCache.addColorStop(1,'rgba(1,5,12,0)');}
 ctx.fillStyle=backgroundGradientCache;ctx.fillRect(0,0,W,H);
 // Faint pools of alien bioluminescence and a distant warning-red bloom.
 ctx.save();
 ctx.fillStyle=backgroundBloomCache;ctx.fillRect(W*.45,H*.2,W*.55,H*.8);
 for(let i=0;i<5;i++){const x=W*(.1+i*.2)+Math.sin(t*.00015+i)*25;ctx.globalAlpha=.018+Math.sin(t*.0003+i)*.006;ctx.fillStyle=BACKGROUND_BEAM_COLORS[i];ctx.beginPath();ctx.moveTo(x-35,0);ctx.lineTo(x+30,0);ctx.lineTo(x+130,H);ctx.lineTo(x+20,H);ctx.closePath();ctx.fill()}
 ctx.restore();
 // Draw only the grid cells inside the camera viewport; the former world-wide scan was wasted work every frame.
 ctx.save();ctx.strokeStyle='rgba(93,175,190,.028)';ctx.lineWidth=1;const grid=70,ox=(t*.003)%grid,oy=(t*.002)%grid;
 const left=Math.floor(cameraX/grid)*grid-grid+ox,right=cameraX+viewW/worldZoom+grid;
 const top=Math.floor(cameraY/grid)*grid-grid+oy,bottom=cameraY+viewH/worldZoom+grid;
 for(let x=left;x<right;x+=grid){ctx.beginPath();ctx.moveTo(x,Math.max(0,top));ctx.lineTo(x,Math.min(H,bottom));ctx.stroke()}
 for(let y=top;y<bottom;y+=grid){ctx.beginPath();ctx.moveTo(Math.max(0,left),y);ctx.lineTo(Math.min(W,right),y);ctx.stroke()}
 ctx.restore();
 // Keep the whole drift field alive, but only paint particles that can appear in the current view.
 const visibleLeft=cameraX-30/worldZoom,visibleRight=cameraX+viewW/worldZoom+30/worldZoom;
 const visibleTop=cameraY-30/worldZoom,visibleBottom=cameraY+viewH/worldZoom+30/worldZoom;
 for(const p of decor){p.y-=p.speed*.012;if(p.y<-5){p.y=H+5;p.x=Math.random()*W;}if(p.x<visibleLeft||p.x>visibleRight||p.y<visibleTop||p.y>visibleBottom)continue;ctx.globalAlpha=p.a*(.6+.4*Math.sin(t*.001+p.phase));ctx.fillStyle='#9dfbf1';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}
 ctx.globalAlpha=1;
 // Shadowy, distant fauna cross the edge of sight.
 for(let i=0;i<4;i++){const x=((i*317+t*.009*(i%2?1:-1))%(W+180))-90,y=H*(.18+i*.2)+Math.sin(t*.0005+i)*18;if(x<visibleLeft-60||x>visibleRight+60||y<visibleTop-40||y>visibleBottom+40)continue;ctx.globalAlpha=.055;ctx.fillStyle=i===2?'#8e527b':'#426d85';ctx.beginPath();ctx.ellipse(x,y,25+i*3,7+i,Math.sin(t*.0002+i),0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(x-20,y);ctx.lineTo(x-35,y-10);ctx.lineTo(x-32,y+10);ctx.fill()}ctx.globalAlpha=1;
}
function drawCreature(x,y,r,angle,color,kind,t,playerCreature=false,hit=0,renderContext=ctx,skinOverride=null){
 const c=renderContext;
 // Cache elaborate hostile drawings off-screen and refresh them infrequently; a horde can share one sprite.
 if(renderContext===ctx&&!playerCreature){
  const spread=kind==='kraken'?2.8:kind==='leviathan'?3.15:kind==='lurker'?2.55:BOSS_KINDS.includes(kind)?2.15:1.85;
  const side=Math.max(18,Math.ceil(r*spread*2)),key=kind+'|'+color+'|'+Math.round(r*100)+'|'+side;
  let sprite=hostileSpriteCache.get(key);
  if(!sprite){const surface=document.createElement('canvas');surface.width=side;surface.height=side;sprite={canvas:surface,context:surface.getContext('2d'),center:side/2,lastPaint:-Infinity};hostileSpriteCache.set(key,sprite);if(hostileSpriteCache.size>48)hostileSpriteCache.delete(hostileSpriteCache.keys().next().value);}
  const refreshInterval=lowPowerRendering?(BOSS_KINDS.includes(kind)?140:220):(BOSS_KINDS.includes(kind)?85:150);if(t-sprite.lastPaint>=refreshInterval){sprite.context.clearRect(0,0,side,side);drawCreature(sprite.center,sprite.center,r,0,color,kind,t,false,0,sprite.context);sprite.lastPaint=t;}
  c.save();c.translate(Math.round(x),Math.round(y));c.rotate(Number.isFinite(angle)?angle:0);c.drawImage(sprite.canvas,-sprite.center,-sprite.center);if(hit>0){c.globalAlpha=clamp(hit*2.6,0,.45);c.fillStyle='#fff';c.beginPath();c.arc(0,0,r*.68,0,Math.PI*2);c.fill();}c.restore();return;
 }
 const skin=playerCreature?(skinOverride||(skinData.find(s=>s.id===equippedSkin)||skinData[0])):null;
 const id=skin?.id||'default';
 const boss=BOSS_KINDS.includes(kind);
 const glowScale=(playerCreature||boss)?(lowPowerRendering?.42:1):(r<13?.18:r<22?.38:.68)*(lowPowerRendering?.42:1);
 const pulse=1+Math.sin(t*.003+(x+y)*.01)*.025;
 c.save();c.translate(x,y);c.rotate(Number.isFinite(angle)?angle:0);c.globalAlpha=1;
 const bodyGrad=(base=color)=>{const g=c.createRadialGradient(-r*.28,-r*.36,r*.05,r*.06,r*.05,r*1.45);g.addColorStop(0,hit>0?'#ffffff':'#f1ffff');g.addColorStop(.14,hit>0?'#ffffff':base);g.addColorStop(.53,base);g.addColorStop(.82,'#21465a');g.addColorStop(1,'#06111e');return g};
 const stroke=(draw,width=Math.max(1.1,r*.055),col=color,blur=10)=>{c.save();c.beginPath();draw();c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.shadowBlur=blur*glowScale;c.shadowColor=col;c.stroke();c.restore()};
 const fill=(draw,fillStyle,strokeStyle=null,width=Math.max(1,r*.045),blur=0)=>{c.save();c.beginPath();draw();c.fillStyle=fillStyle;c.shadowBlur=blur*glowScale;c.shadowColor=strokeStyle||color;c.fill();if(strokeStyle){c.strokeStyle=strokeStyle;c.lineWidth=width;c.lineJoin='round';c.stroke()}c.restore()};
 const body=(rx,ry,cy=0,base=color)=>fill(()=>c.ellipse(0,cy,r*rx*pulse,r*ry*pulse,0,0,Math.PI*2),bodyGrad(base),`rgba(224,255,255,.46)`,Math.max(1,r*.035),12);
 const fin=(points,col=color,edge='rgba(225,255,255,.55)')=>fill(()=>{c.moveTo(points[0][0]*r,points[0][1]*r);for(let i=1;i<points.length;i++)c.lineTo(points[i][0]*r,points[i][1]*r);c.closePath()},`rgba(8,30,46,.9)`,col,Math.max(1,r*.035),8);
 const tentacle=(sx,sy,c1x,c1y,c2x,c2y,ex,ey,w=1, suckers=false)=>{
  stroke(()=>{c.moveTo(sx*r,sy*r);c.bezierCurveTo(c1x*r,c1y*r,c2x*r,c2y*r,ex*r,ey*r)},Math.max(.8,r*.045*w),color,9);
  if(suckers){c.save();c.fillStyle='#d8fff9';c.shadowBlur=6*glowScale;c.shadowColor=color;for(let j=1;j<=4;j++){const q=j/5,px=(sx*(1-q)**3+3*c1x*q*(1-q)**2+3*c2x*q*q*(1-q)+ex*q**3)*r,py=(sy*(1-q)**3+3*c1y*q*(1-q)**2+3*c2y*q*q*(1-q)+ey*q**3)*r;c.beginPath();c.arc(px,py,Math.max(.7,r*.035),0,Math.PI*2);c.fill()}c.restore()}
 };
   const krakenArm=(pose,armIndex,phase)=>{
   const points=[];
   for(let j=0;j<=18;j++){const q=j/18,mt=1-q;const x=mt*mt*mt*pose.sx+3*mt*mt*q*pose.c1x+3*mt*q*q*pose.c2x+q*q*q*pose.ex;const y=mt*mt*mt*pose.sy+3*mt*mt*q*pose.c1y+3*mt*q*q*pose.c2y+q*q*q*pose.ey;points.push({x:x*r,y:y*r,t:q});}
   const left=[],right=[];
   for(let j=0;j<points.length;j++){const p=points[j],prev=points[Math.max(0,j-1)],next=points[Math.min(points.length-1,j+1)],dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1;const width=r*(.115*Math.pow(1-p.t,1.22)+.008);const nx=-dy/len,ny=dx/len;left.push([p.x+nx*width,p.y+ny*width]);right.push([p.x-nx*width,p.y-ny*width]);}
   c.save();c.beginPath();left.forEach((p,j)=>j?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));for(let j=right.length-1;j>=0;j--)c.lineTo(right[j][0],right[j][1]);c.closePath();c.fillStyle=bodyGrad(color);c.shadowBlur=(playerCreature||boss)?8*glowScale:0;c.shadowColor=color;c.fill();c.strokeStyle='rgba(130,255,231,.62)';c.lineWidth=Math.max(.8,r*.016);c.stroke();
   c.shadowBlur=3*glowScale;c.fillStyle='#caffef';for(let j=3;j<=11;j+=2){const p=points[j],width=r*(.115*Math.pow(1-p.t,1.22)+.008);c.beginPath();c.ellipse(p.x,p.y,Math.max(.65,width*.23),Math.max(.5,width*.16),Math.atan2(points[Math.min(18,j+1)].y-p.y,points[Math.min(18,j+1)].x-p.x),0,Math.PI*2);c.fill();}c.restore();
  };
  const eye=(ex,ey,er=r*.09,iris='#e6ffff')=>{c.save();c.fillStyle='#020a12';c.beginPath();c.ellipse(ex*r,ey*r,er*1.3,er*1.65,0,0,Math.PI*2);c.fill();c.fillStyle=iris;c.shadowBlur=12*glowScale;c.shadowColor=iris;c.beginPath();c.arc(ex*r+er*.2,ey*r-er*.18,er*.5,0,Math.PI*2);c.fill();c.restore()};
 const teeth=(cx,cy,rx,ry,count=8,scale=1,reverse=false)=>{c.save();c.fillStyle='#f6fbec';c.shadowBlur=7*glowScale;c.shadowColor='#ffb4bb';for(let i=0;i<count;i++){const a=(i/count)*Math.PI*2,tx=cx+Math.cos(a)*rx,ty=cy+Math.sin(a)*ry,innerX=cx+Math.cos(a)*rx*.68,innerY=cy+Math.sin(a)*ry*.68;c.beginPath();c.moveTo(tx*r,ty*r);c.lineTo((innerX+Math.cos(a+.2)*.09*scale)*r,(innerY+Math.sin(a+.2)*.09*scale)*r);c.lineTo((innerX+Math.cos(a-.2)*.09*scale)*r,(innerY+Math.sin(a-.2)*.09*scale)*r);c.closePath();c.fill()}c.restore()};
 const gills=(x0=-.2,y0=-.28,count=3,side=1)=>{for(let i=0;i<count;i++){const xx=x0+i*.12;stroke(()=>{c.moveTo(xx*r,y0*r);c.quadraticCurveTo((xx-.12)*r,(y0+.13)*r,(xx-.06)*r,(y0+.22)*r)},Math.max(.7,r*.028),'rgba(194,255,248,.72)',4)}};
 const finRay=(x0,y0,x1,y1,x2,y2,col=color)=>fin([[x0,y0],[x1,y1],[x2,y2]],col,'rgba(230,255,249,.48)');

 if(playerCreature){
  // Every skin has a readable, largely bilateral deep-sea silhouette.
  if(id==='kraken'){
    for(let arm=0;arm<8;arm++){const pose=window.AbyssalEnemyAI?.krakenTentaclePose?.(arm,t*.0018)||{sx:Math.cos(.34+arm*.35)*.44,sy:.25,c1x:.6,c1y:.72,c2x:Math.cos(.34+arm*.35)*1.2,c2y:1.2,ex:Math.cos(.34+arm*.35)*2,ey:1.8};krakenArm(pose,arm,t);}
    fill(()=>{c.moveTo(-.76*r,.12*r);c.bezierCurveTo(-.98*r,-.27*r,-.73*r,-.82*r,-.25*r,-.83*r);c.bezierCurveTo(.25*r,-.97*r,.78*r,-.62*r,.78*r,.1*r);c.quadraticCurveTo(.35*r,.52*r,-.08*r,.45*r);c.quadraticCurveTo(-.47*r,.48*r,-.76*r,.12*r);},bodyGrad(color),'rgba(196,164,255,.9)',Math.max(1.2,r*.06),15);
    for(let side of [-1,1]){fill(()=>{c.moveTo(side*.48*r,-.34*r);c.lineTo(side*.85*r,-.63*r);c.lineTo(side*.77*r,-.23*r);c.closePath()},'#07131d',color,Math.max(1,r*.025),4);c.save();c.fillStyle='#d9c7ff';c.shadowBlur=13*glowScale;c.shadowColor='#a855f7';c.beginPath();c.ellipse(side*.34*r,-.22*r,r*.075,r*.12,side*-.16,0,Math.PI*2);c.fill();c.restore();}
    c.save();c.fillStyle='rgba(1,1,10,.98)';c.strokeStyle='rgba(167,139,250,.7)';c.lineWidth=Math.max(1,r*.025);c.beginPath();c.ellipse(0,.2*r,.22*r,.105*r,0,0,Math.PI*2);c.fill();c.stroke();c.restore();
    for(let g=0;g<3;g++)stroke(()=>{c.moveTo((-.42+g*.1)*r,-.44*r);c.quadraticCurveTo((-.35+g*.1)*r,-.26*r,(-.3+g*.1)*r,-.12*r)},Math.max(.7,r*.024),'rgba(207,255,239,.55)',2);
   } else if(id==='reefshark'){
   // Great white shark: pointed conical snout, countershading, crescent tail,
   // tall triangular dorsal fin and swept pectoral fins form a clear shark outline.
   fin([[-1.12,-.02],[-1.72,-.48],[-1.49,-.04],[-1.77,.43]],'#405761');
   fin([[-.38,-.29],[-.12,-1.08],[.12,-.31]],'#536a73');
   fin([[-.12,.20],[-.55,.80],[.34,.34]],'#465e69');
   fin([[.35,.12],[.04,.63],[.63,.25]],'#536a73');
   fill(()=>{c.moveTo(-1.36*r,0);c.quadraticCurveTo(-1.02*r,-.47*r,-.35*r,-.48*r);c.quadraticCurveTo(.28*r,-.42*r,.85*r,-.17*r);c.lineTo(1.25*r,-.015*r);c.lineTo(.83*r,.12*r);c.quadraticCurveTo(.18*r,.48*r,-.58*r,.34*r);c.quadraticCurveTo(-1.08*r,.25*r,-1.36*r,0)},bodyGrad('#718994'),'rgba(231,251,255,.78)',Math.max(1,r*.04),12);
   fill(()=>{c.moveTo(-.38*r,.205*r);c.quadraticCurveTo(.22*r,.37*r,1.12*r,.045*r);c.quadraticCurveTo(.72*r,.34*r,.08*r,.39*r);c.quadraticCurveTo(-.22*r,.36*r,-.38*r,.205*r)},'#e5e7dc','rgba(255,255,255,.68)',Math.max(.8,r*.026),3);
   fill(()=>{c.moveTo(.92*r,.14*r);c.quadraticCurveTo(1.08*r,.10*r,1.22*r,.04*r);c.quadraticCurveTo(1.03*r,.22*r,.77*r,.21*r);c.closePath()},'#263d47','rgba(255,255,255,.38)',Math.max(.7,r*.02),2);
   gills(-.47,-.2,5);eye(.79,-.155,r*.05,'#09131a');
  } else if(id==='hammerhead'){
   // Hammerhead: unmistakable lateral cephalofoil with eyes set at its ends.
   fin([[-1.0,0],[-1.55,-.36],[-1.39,.03],[-1.55,.32]],color);fin([[-.22,-.28],[-.02,-.78],[.18,-.28]],color);fin([[-.05,.25],[-.32,.65],[.24,.3]],color);
   fill(()=>{c.moveTo(-1.18*r,0);c.quadraticCurveTo(-.75*r,-.47*r,-.05*r,-.36*r);c.lineTo(.58*r,-.2*r);c.lineTo(.94*r,-.14*r);c.lineTo(.82*r,-.02*r);c.lineTo(.95*r,.12*r);c.lineTo(.52*r,.2*r);c.quadraticCurveTo(-.25*r,.46*r,-1.18*r,0)},bodyGrad(color),'rgba(222,250,255,.75)',Math.max(1,r*.04),12);
   fill(()=>{c.moveTo(.28*r,-.18*r);c.lineTo(.6*r,-.28*r);c.lineTo(1.1*r,-.27*r);c.lineTo(1.12*r,-.08*r);c.lineTo(.96*r,0);c.lineTo(1.12*r,.08*r);c.lineTo(1.1*r,.27*r);c.lineTo(.6*r,.28*r);c.lineTo(.28*r,.17*r);c.closePath()},bodyGrad(color),'rgba(226,251,255,.85)',Math.max(1,r*.04),10);
   eye(.82,-.22,r*.06,'#e8ffff');eye(.82,.22,r*.06,'#e8ffff');gills(-.36,-.18,4);
  } else if(id==='abysscroc'){
   // Black caiman: low, heavy silhouette; extra-wide rounded rostrum,
   // four splayed webbed legs, a deep tail and pronounced dark osteoderms.
   fill(()=>{c.moveTo(-.55*r,-.22*r);c.quadraticCurveTo(-1.18*r,-.2*r,-1.92*r,-.02*r);c.quadraticCurveTo(-1.28*r,.26*r,-.48*r,.23*r);c.closePath()},bodyGrad('#243d31'),'rgba(191,218,170,.72)',Math.max(1,r*.04),7);
   for(const side of [-1,1])for(let leg=0;leg<2;leg++){const lx=(-.48+leg*.62)*r,ly=side*.2*r;c.save();c.strokeStyle='#253d30';c.lineWidth=Math.max(2.4,r*.105);c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(lx,ly);c.lineTo(lx+(-.12+leg*.12)*r,side*.58*r);c.lineTo(lx+(.08+leg*.12)*r,side*.69*r);c.stroke();c.beginPath();c.moveTo(lx+(.08+leg*.12)*r,side*.69*r);c.lineTo(lx+(.32+leg*.12)*r,side*.77*r);c.lineTo(lx+(.14+leg*.12)*r,side*.62*r);c.stroke();c.restore();}
   fill(()=>{c.ellipse(-.06*r,0,.89*r,.43*r,0,0,Math.PI*2)},bodyGrad('#294434'),'rgba(204,223,179,.75)',Math.max(1,r*.045),9);
   for(let plate=0;plate<9;plate++){const px=(-.77+plate*.18)*r;fin([[px/r,-.1],[px/r+.07,-.39],[px/r+.18,-.12]],plate%2?'#a4a27a':'#c1b995','rgba(27,44,34,.96)');}
   // The caiman's signature broad, rounded head and blunt U-shaped jaw.
   fill(()=>{c.moveTo(.48*r,-.23*r);c.quadraticCurveTo(.9*r,-.32*r,1.23*r,-.24*r);c.quadraticCurveTo(1.45*r,-.12*r,1.43*r,0);c.quadraticCurveTo(1.45*r,.15*r,1.2*r,.23*r);c.lineTo(.48*r,.23*r);c.closePath()},bodyGrad('#334d37'),'rgba(221,232,186,.8)',Math.max(1,r*.04),5);
   fill(()=>{c.moveTo(.65*r,.17*r);c.quadraticCurveTo(1.08*r,.26*r,1.41*r,.12*r);c.lineTo(1.25*r,.27*r);c.lineTo(.67*r,.24*r);c.closePath()},'#9d9c76','rgba(226,233,194,.5)',Math.max(.7,r*.02),2);
   eye(.55,-.235,r*.075,'#f3c66c');eye(.55,.235,r*.075,'#f3c66c');
   for(let bump=0;bump<5;bump++){const bx=(.78+bump*.105)*r;fill(()=>c.ellipse(bx,-.21*r,r*.025,r*.022,0,0,Math.PI*2),'#d5cda5','#253b2d',Math.max(.5,r*.012),0);}
  } else if(id==='armoredgator'){
   // Nile crocodile: narrower, more elongated profile, V-shaped snout,
   // interlocking visible teeth, four legs and high paired dorsal scutes.
   fill(()=>{c.moveTo(-.7*r,-.15*r);c.quadraticCurveTo(-1.35*r,-.2*r,-2.15*r,-.015*r);c.quadraticCurveTo(-1.38*r,.19*r,-.64*r,.17*r);c.closePath()},bodyGrad('#756746'),'rgba(231,219,177,.72)',Math.max(1,r*.035),6);
   for(const side of [-1,1])for(let leg=0;leg<2;leg++){const lx=(-.38+leg*.58)*r,ly=side*.22*r;c.save();c.strokeStyle='#80704b';c.lineWidth=Math.max(2,r*.085);c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(lx,ly);c.lineTo(lx+(-.08+leg*.1)*r,side*.53*r);c.lineTo(lx+(.11+leg*.1)*r,side*.66*r);c.stroke();for(let toe=0;toe<3;toe++){c.beginPath();c.moveTo(lx+(.11+leg*.1)*r,side*.66*r);c.lineTo(lx+(.2+leg*.1+toe*.045)*r,side*.73*r);c.stroke();}c.restore();}
   fill(()=>{c.moveTo(-.85*r,-.2*r);c.quadraticCurveTo(-.52*r,-.48*r,.08*r,-.43*r);c.quadraticCurveTo(.47*r,-.35*r,.79*r,-.13*r);c.lineTo(.84*r,.13*r);c.quadraticCurveTo(.4*r,.42*r,-.32*r,.34*r);c.quadraticCurveTo(-.72*r,.27*r,-.85*r,-.2*r)},bodyGrad('#81734f'),'rgba(242,224,177,.72)',Math.max(1,r*.04),8);
   for(let plate=0;plate<10;plate++){const px=(-.66+plate*.15)*r;fin([[px/r,-.14],[px/r+.045,-.46],[px/r+.12,-.17]],plate%2?'#c4ae70':'#ddc584','rgba(68,59,40,.94)');fin([[px/r,.06],[px/r+.045,.33],[px/r+.12,.08]],'#9c8b5d','rgba(61,53,37,.9)');}
   // Long, pointed V-shaped crocodile muzzle with alternating conical teeth.
   fill(()=>{c.moveTo(.38*r,-.18*r);c.lineTo(.83*r,-.145*r);c.lineTo(1.48*r,-.075*r);c.lineTo(1.62*r,0);c.lineTo(1.48*r,.075*r);c.lineTo(.83*r,.145*r);c.lineTo(.38*r,.18*r);c.closePath()},bodyGrad('#94845b'),'rgba(247,231,189,.82)',Math.max(1,r*.035),5);
   fill(()=>{c.moveTo(.72*r,-.025*r);c.lineTo(1.55*r,-.045*r);c.lineTo(1.47*r,.075*r);c.lineTo(.72*r,.09*r);c.closePath()},'#2a251d','rgba(240,228,190,.5)',Math.max(.7,r*.018),1);
   eye(.43,-.2,r*.06,'#f5d174');eye(.43,.2,r*.06,'#f5d174');
   for(let tooth=0;tooth<8;tooth++){const tx=(.78+tooth*.085)*r,side=tooth%2?1:-1;fin([[tx/r,side*.025],[tx/r+.035,side*.12],[tx/r+.07,side*.035]],'#f8f0d4','#4c4634');}
    } else if(id==='electriceel'){
   // Enguia Elétrica: corpo longo azul ciano/violeta com arcos elétricos e filamentos
   const wave = Math.sin(t * 0.008) * 0.22;
   fill(()=>{
     c.moveTo(-2.2*r, wave*r);
     c.quadraticCurveTo(-1.5*r, -0.32*r + wave*r, -0.7*r, -0.25*r);
     c.quadraticCurveTo(0, -0.18*r - wave*r, 0.8*r, -0.12*r);
     c.lineTo(1.2*r, 0);
     c.lineTo(0.8*r, 0.12*r);
     c.quadraticCurveTo(0, 0.18*r + wave*r, -0.7*r, 0.25*r);
     c.quadraticCurveTo(-1.5*r, 0.32*r - wave*r, -2.2*r, wave*r);
     c.closePath();
   }, bodyGrad('#1a8fff'), '#38e8ff', Math.max(1.3, r*.04), 18);

   // Olhos e barbatana dorsal translúcida
   stroke(()=>{
     c.moveTo(-1.8*r, -0.12*r + wave*r*0.5);
     c.quadraticCurveTo(-0.5*r, -0.38*r, 0.6*r, -0.15*r);
   }, Math.max(1.5, r*0.06), '#64f6ff', 12);

   // Faíscas e arcos de eletricidade crepitando pelo corpo da enguia
   for(let k=0; k<4; k++){
     const sparkX = (-1.4 + k * 0.65) * r + rand(-3, 3);
     const sparkY = Math.sin(t*0.007 + k*1.5) * 0.15 * r + rand(-6, 6);
     stroke(()=>{
       c.moveTo(sparkX, sparkY);
       c.lineTo(sparkX + rand(-8, 8), sparkY + rand(-10, 10));
       c.lineTo(sparkX + rand(-14, 14), sparkY + rand(-6, 6));
     }, 1.6, '#ffffff', 14);
   }
   fill(()=>{ c.arc(0.7*r, -0.07*r, 2.5, 0, Math.PI*2); }, '#ffffff', '#38e8ff', 1, 8);
   fill(()=>{ c.arc(0.7*r, 0.07*r, 2.5, 0, Math.PI*2); }, '#ffffff', '#38e8ff', 1, 8);
  } else if(id==='greensnake'){
   // Serpente Esmeralda: corpo serpenteante de jade, escamas dorsais brilhantes e olhar ancestral
   const segWave = Math.sin(t * 0.006) * 0.15;
   fill(()=>{
     c.moveTo(-2.4*r, segWave*r);
     c.quadraticCurveTo(-1.8*r, -0.45*r + segWave*r, -0.9*r, -0.38*r);
     c.quadraticCurveTo(0, -0.28*r - segWave*r, 0.85*r, -0.15*r);
     c.lineTo(1.35*r, 0);
     c.lineTo(0.85*r, 0.18*r);
     c.quadraticCurveTo(0, 0.35*r + segWave*r, -0.9*r, 0.3*r);
     c.quadraticCurveTo(-1.8*r, 0.4*r - segWave*r, -2.4*r, segWave*r);
     c.closePath();
   }, bodyGrad('#2ee88a'), 'rgba(180,255,210,.9)', Math.max(1.3, r*.05), 16);
   for(let s=0; s<9; s++){
     const sx = (-1.8 + s * 0.34) * r;
     const sy = Math.sin(t*0.005 + s*0.6) * 0.08 * r;
     fin([[sx/r, -0.1 + sy/r], [sx/r + 0.08, -0.38 + sy/r], [sx/r + 0.16, -0.1 + sy/r]], '#187845', '#79ffba');
   }
   fill(()=>{
     c.moveTo(0.55*r, -0.22*r);
     c.lineTo(1.25*r, -0.18*r);
     c.lineTo(1.55*r, 0);
     c.lineTo(1.25*r, 0.18*r);
     c.lineTo(0.55*r, 0.22*r);
     c.closePath();
   }, bodyGrad('#3af597'), 'rgba(215,255,230,.95)', Math.max(1.1, r*.04), 8);
   eye(0.9, -0.18, r*0.07, '#ffc83b');
   eye(0.9, 0.18, r*0.07, '#ffc83b');
   stroke(()=>{
     c.moveTo(1.52*r, 0);
     c.lineTo(1.8*r, 0);
     c.lineTo(1.95*r, -0.06*r);
     c.moveTo(1.8*r, 0);
     c.lineTo(1.95*r, 0.06*r);
   }, Math.max(1.2, r*0.025), '#ff4d6d', 4);
  } else if(id==='default'){
   // Comb-jelly bell with six evenly spaced trailing cilia.
   for(let i=0;i<6;i++){const px=-.62+i*.25,side=i%2?-1:1;tentacle(px,.18,px-.08,.62,px+.12,1.12,px+.02,1.42,.9,false)}
   fill(()=>{c.moveTo(-.84*r,-.02*r);c.bezierCurveTo(-.9*r,-.7*r,-.48*r,-.9*r,0,-.86*r);c.bezierCurveTo(.5*r,-.9*r,.9*r,-.56*r,.82*r,-.02*r);c.quadraticCurveTo(0,.24*r,-.82*r,-.02*r)},bodyGrad(color),'rgba(204,255,253,.75)',Math.max(1.2,r*.06),16);
   stroke(()=>{c.moveTo(-.76*r,-.02*r);c.quadraticCurveTo(0,.28*r,.76*r,-.02*r)},Math.max(1,r*.06),'#dfffff',8);
   for(let k=0;k<5;k++){const xx=(-.52+k*.26)*r;stroke(()=>{c.moveTo(xx,-.62*r);c.quadraticCurveTo(xx-.03*r,-.35*r,xx+.03*r,-.14*r)},Math.max(.7,r*.025),'rgba(218,255,255,.55)',3)}
   eye(.24,-.25,r*.075);
  } else if(id==='leviathan'){
   // A long abyssal eel, ribbed armor, paired fins and a pale skull.
   fill(()=>{c.moveTo(-2.15*r,0);c.quadraticCurveTo(-1.55*r,-.52*r,-.65*r,-.43*r);c.quadraticCurveTo(.1*r,-.32*r,.68*r,-.22*r);c.lineTo(.95*r,0);c.quadraticCurveTo(.36*r,.42*r,-.65*r,.34*r);c.quadraticCurveTo(-1.5*r,.37*r,-2.15*r,0)},bodyGrad(color),'rgba(223,255,250,.55)',Math.max(1,r*.04),14);
   fin([[-1.92,0],[-2.5,-.25],[-2.28,.1],[-2.48,.27]],color);fin([[-.85,-.34],[-.52,-.88],[-.22,-.36]],color);fin([[-.15,-.28],[.12,-.72],[.34,-.22]],color);
   for(let i=0;i<7;i++){const xx=(-1.4+i*.27)*r;stroke(()=>{c.moveTo(xx,-.3*r);c.quadraticCurveTo((xx-.16*r),0,xx,.29*r)},Math.max(1.2,r*.05),'rgba(221,255,251,.62)',6)}
   fill(()=>{c.ellipse(.58*r,-.03*r,.25*r,.29*r,-.08,0,Math.PI*2)},'#c9e6dc','#f5ffff',Math.max(1,r*.04),9);eye(.69,-.12,r*.055,'#a2fff4');gills(.15,-.18,4);
  } else if(id==='voidwing'){
   // Manta ray: broad paired pectoral wings and a long tapering tail.
   fill(()=>{c.moveTo(-.7*r,-.18*r);c.quadraticCurveTo(-.05*r,-.4*r,.48*r,-.2*r);c.lineTo(1.0*r,-.02*r);c.quadraticCurveTo(.56*r,.02*r,.34*r,.22*r);c.quadraticCurveTo(.08*r,.5*r,-.22*r,.28*r);c.lineTo(-1.32*r,.84*r);c.quadraticCurveTo(-1.05*r,.25*r,-.9*r,.08*r);c.lineTo(-1.32*r,-.82*r);c.quadraticCurveTo(-1.02*r,-.3*r,-.7*r,-.18*r);c.closePath()},bodyGrad(color),'rgba(230,255,255,.62)',Math.max(1,r*.04),14);
   stroke(()=>{c.moveTo(-.7*r,0);c.quadraticCurveTo(-.2*r,.22*r,.56*r,.08*r)},Math.max(1,r*.045),'rgba(216,255,253,.75)',5);tentacle(-1.12,.0,-1.8,.06,-2.05,.08,-2.5,.12,.55);eye(.53,-.08,r*.06);
  } else if(id==='deepwarden'||id==='abyssking'){
   // Isopod/crab: paired legs, overlapping mineral plates and symmetric pincers.
   for(let side of [-1,1])for(let i=0;i<4;i++){const xx=(-.62+i*.32);stroke(()=>{c.moveTo(xx*r,side*.22*r);c.quadraticCurveTo((xx-.18)*r,side*.55*r,(xx-.36)*r,side*.74*r)},Math.max(1.2,r*.065),color,8);stroke(()=>{c.moveTo((xx-.36)*r,side*.74*r);c.lineTo((xx-.54)*r,side*.78*r)},Math.max(1,r*.04),'rgba(235,255,247,.8)',5)}
   fill(()=>{c.ellipse(-.05*r,0,.92*r,.63*r,0,0,Math.PI*2)},bodyGrad(color),'rgba(221,255,248,.62)',Math.max(1,r*.05),12);
   for(let i=0;i<5;i++){const xx=(-.72+i*.32)*r;fill(()=>{c.beginPath();c.moveTo(xx,-.48*r);c.lineTo((xx+.12*r),-.56*r);c.lineTo((xx+.2*r),.08*r);c.lineTo((xx+.1*r),.43*r);c.lineTo(xx,.48*r);c.closePath()},'rgba(4,24,37,.38)','rgba(230,255,255,.58)',Math.max(.7,r*.025),4)}
   for(let side of [-1,1]){stroke(()=>{c.moveTo(.42*r,side*.2*r);c.quadraticCurveTo(.8*r,side*.25*r,.86*r,side*.49*r)},Math.max(1.8,r*.09),color,8);fin([[.78,side*.4],[1.18,side*.6],[1.03,side*.24],[.86,side*.18]],color)}
   eye(.4,-.2,r*.06);eye(.4,.2,r*.06);if(id==='abyssking'){fill(()=>{c.moveTo(-.44*r,-.46*r);c.lineTo(-.38*r,-1.0*r);c.lineTo(-.12*r,-.65*r);c.lineTo(.03*r,-1.15*r);c.lineTo(.25*r,-.64*r);c.lineTo(.54*r,-.94*r);c.lineTo(.48*r,-.36*r);c.closePath()},'#d9e9ff',color,Math.max(1,r*.04),10)}
  } else if(id==='abyssaleye'){
   // Not a plain eyeball: a protected radial organism with a layered iris and tendrils.
   for(let i=0;i<8;i++){const a=i*Math.PI/4,sx=Math.cos(a)*.68,sy=Math.sin(a)*.68,ex=Math.cos(a)*1.28,ey=Math.sin(a)*1.05;stroke(()=>{c.moveTo(sx*r,sy*r);c.quadraticCurveTo(Math.cos(a+.22)*r,Math.sin(a+.22)*r,ex*r,ey*r)},Math.max(1.4,r*.055),color,10);c.save();c.fillStyle='#d4ffff';c.shadowBlur=9;c.shadowColor=color;c.beginPath();c.arc(ex*r,ey*r,Math.max(1,r*.045),0,Math.PI*2);c.fill();c.restore()}
   body(1,.92,0,color);c.save();c.fillStyle='#07131e';c.strokeStyle='#c8fffb';c.lineWidth=Math.max(1.2,r*.06);c.shadowBlur=18;c.shadowColor=color;c.beginPath();c.ellipse(.12*r,0,.53*r,.62*r,0,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=color;c.beginPath();c.ellipse(.17*r,0,.32*r,.43*r,0,0,Math.PI*2);c.fill();c.fillStyle='#020a14';c.beginPath();c.ellipse(.25*r,0,.12*r,.3*r,0,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(.29*r,-.18*r,r*.07,0,Math.PI*2);c.fill();c.restore();
  } else if(id==='glacier'){
   // Geometric comb jelly with paired ice fins and fine luminous ribs.
   fin([[-.65,0],[-1.25,-.62],[-.98,0],[-1.22,.62]] ,'#92d5ff');fin([[.12,-.48],[.32,-1.1],[.52,-.38]],'#d6f9ff');fin([[.12,.48],[.32,1.1],[.52,.38]],'#d6f9ff');
   fill(()=>{c.moveTo(-.72*r,0);c.lineTo(-.4*r,-.55*r);c.lineTo(.2*r,-.58*r);c.lineTo(.78*r,-.1*r);c.lineTo(.55*r,.45*r);c.lineTo(-.2*r,.56*r);c.closePath()},bodyGrad(color),'#c3eeff',Math.max(1.2,r*.06),14);
   for(let i=0;i<7;i++){const xx=(-.45+i*.16)*r;stroke(()=>{c.moveTo(xx,-.42*r);c.lineTo((xx+.08)*r,.42*r)},Math.max(.7,r*.026),'rgba(230,253,255,.75)',5)}eye(.38,-.08,r*.05,'#a7ecff');
  } else if(id==='royal'){
   for(let i=0;i<8;i++){const a=Math.PI+i*Math.PI/7,sx=Math.cos(a)*.5,sy=Math.sin(a)*.48;tentacle(sx,sy,sx-.1,sy+.28,sx+.2,sy+.7,sx+.05,1.18,.8)}
   fill(()=>{c.moveTo(-.84*r,-.02*r);c.bezierCurveTo(-.85*r,-.62*r,-.44*r,-.88*r,0,-.82*r);c.bezierCurveTo(.47*r,-.88*r,.86*r,-.5*r,.84*r,-.02*r);c.quadraticCurveTo(0,.18*r,-.84*r,-.02*r)},bodyGrad(color),'rgba(255,247,203,.75)',Math.max(1.2,r*.05),14);
   stroke(()=>{c.ellipse(0,-.8*r,.54*r,.2*r,0,0,Math.PI*2)},Math.max(1.2,r*.065),'#fff0b1',14);for(let i=0;i<9;i++){const a=Math.PI*2*i/9;c.save();c.fillStyle='#fff5bd';c.shadowBlur=10;c.shadowColor='#fff5bd';c.beginPath();c.arc(Math.cos(a)*.54*r,-.8*r+Math.sin(a)*.2*r,Math.max(1.3,r*.045),0,Math.PI*2);c.fill();c.restore()}eye(.25,-.28,r*.06,'#fff3c3');
  } else if(id==='toxic'){
   // Vampire squid mantle with eight mirrored arms and sucker rows.
   for(let i=0;i<8;i++){const side=i<4?-1:1,j=i%4,sy=(j-1.5)*.18;tentacle(-.5,sy,side*.2,sy+.22,side*.88,sy+.46,side*(1.05+j*.12),sy+.72,.85,true)}
   fill(()=>{c.moveTo(-.72*r,-.1*r);c.quadraticCurveTo(-.74*r,-.68*r,-.1*r,-.72*r);c.quadraticCurveTo(.55*r,-.65*r,.72*r,-.04*r);c.lineTo(.35*r,.28*r);c.lineTo(-.38*r,.3*r);c.closePath()},bodyGrad(color),'rgba(215,255,190,.65)',Math.max(1.2,r*.05),14);eye(.33,-.17,r*.06,'#eaffbb');
  } else if(id==='thorn'||id==='coral'){
   // Mirrored coral antlers, feeding fronds and symmetrical oral crown.
   for(let side of [-1,1]){
    stroke(()=>{c.moveTo(-.15*r,side*.1*r);c.bezierCurveTo(-.55*r,side*.35*r,-.68*r,side*.75*r,-.88*r,side*1.0*r)},Math.max(1.5,r*.07),color,12);
    stroke(()=>{c.moveTo(-.54*r,side*.55*r);c.lineTo(-.92*r,side*.47*r);c.lineTo(-1.08*r,side*.68*r)},Math.max(1.2,r*.055),'#ffa7bc',8);
    stroke(()=>{c.moveTo(-.68*r,side*.77*r);c.lineTo(-.48*r,side*1.05*r);c.lineTo(-.53*r,side*1.2*r)},Math.max(1.1,r*.05),color,8);
    for(let j=0;j<3;j++){const xx=(.25+j*.16)*r;stroke(()=>{c.moveTo(xx,side*.15*r);c.quadraticCurveTo((xx+.22*r),side*.4*r,(xx+.08*r),side*.62*r)},Math.max(.8,r*.035),'#f9bfce',5)}
   }
   body(.72,.66,.08,color);c.save();c.fillStyle='#071723';c.beginPath();c.ellipse(.28*r,-.05*r,.24*r,.31*r,0,0,Math.PI*2);c.fill();c.restore();eye(.35,-.12,r*.06,'#fff0d1');
  } else if(id==='bloodmoon'){
   // Pale deep-sea fangfish with a huge split jaw.
   fin([[-1.1,0],[-1.62,-.42],[-1.53,.05],[-1.68,.38]] ,color);fin([[-.3,-.34],[-.05,-.88],[.18,-.31]],color);
   fill(()=>{c.moveTo(-1.2*r,0);c.quadraticCurveTo(-.78*r,-.6*r,.05*r,-.48*r);c.lineTo(.75*r,-.17*r);c.lineTo(.98*r,.02*r);c.lineTo(.56*r,.12*r);c.quadraticCurveTo(-.4*r,.55*r,-1.2*r,0)},bodyGrad(color),'rgba(255,224,232,.5)',Math.max(1,r*.04),12);
   fill(()=>{c.moveTo(.38*r,-.05*r);c.quadraticCurveTo(.8*r,-.42*r,.93*r,-.18*r);c.lineTo(.75*r,.02*r);c.lineTo(.97*r,.27*r);c.quadraticCurveTo(.63*r,.32*r,.38*r,.12*r);c.closePath()},'#06111d','#ffbec9',Math.max(1,r*.045),8);
   for(let i=0;i<5;i++){const xx=(.47+i*.085)*r;fin([[xx/r,-.08],[xx/r-.035,.035],[xx/r+.035,.035]],'#fff0e7','#ffbec9');fin([[xx/r,.12],[xx/r-.03,.02],[xx/r+.03,.02]],'#fff0e7','#ffbec9')}eye(.36,-.25,r*.06,'#ffedf2');
  } else if(id==='solar'||id==='violet'){
   // Spiny viperfish: tapered fusiform body, forked tail and symmetrical dorsal spines.
   fin([[-1.05,0],[-1.62,-.37],[-1.42,0],[-1.64,.34]],color);fin([[-.6,-.28],[-.42,-.88],[-.18,-.34]],color);fin([[0,-.28],[.12,-.75],[.32,-.24]],color);fin([[-.5,.28],[-.32,.68],[-.12,.29]],color);
   fill(()=>{c.moveTo(-1.25*r,0);c.quadraticCurveTo(-.8*r,-.56*r,-.05*r,-.42*r);c.lineTo(.78*r,-.14*r);c.lineTo(1.04*r,0);c.lineTo(.68*r,.13*r);c.quadraticCurveTo(-.38*r,.46*r,-1.25*r,0)},bodyGrad(color),'rgba(236,255,255,.52)',Math.max(1,r*.04),12);
   for(let i=0;i<6;i++){const xx=(-.68+i*.22)*r;fin([[xx/r,-.34],[xx/r+.05,-.65-(id==='solar'?.12:0)],[xx/r+.13,-.3]],id==='solar'?'#ffedbc':'#dfceff')};gills(-.08,-.19,3);eye(.62,-.06,r*.055);
   if(id==='violet'){for(let side of [-1,1])fin([[.05,side*.25],[.28,side*.78],[.43,side*.24]],'#e4d2ff')}
  } else if(id==='aberration'||id==='angler'||id==='maw'||id==='devourer'){
   if(id==='aberration'){
    for(let side of [-1,1])for(let i=0;i<3;i++)tentacle(-.42+i*.35,side*.18,-.62+i*.3,side*.48,-.38+i*.3,side*.82,-.68+i*.4,side*1.05,.85,true);
    fill(()=>{c.moveTo(-.7*r,-.3*r);c.lineTo(-.5*r,-.78*r);c.lineTo(-.1*r,-.52*r);c.lineTo(.22*r,-.85*r);c.lineTo(.7*r,-.32*r);c.lineTo(.68*r,.2*r);c.lineTo(.1*r,.55*r);c.lineTo(-.55*r,.25*r);c.closePath()},bodyGrad(color),'rgba(255,188,202,.8)',Math.max(1.2,r*.05),12);
    fill(()=>{c.ellipse(.2*r,-.02*r,.35*r,.38*r,0,0,Math.PI*2)},'#111b28','#fff0f2',Math.max(1,r*.04),4);eye(.03,-.16,r*.07,'#fff5e8');eye(.4,-.1,r*.045,'#ffe0a1');
   }else if(id==='angler'){
    fin([[-.9,0],[-1.45,-.42],[-1.35,.08],[-1.5,.38]],color);body(1.0,.72,.08,color);
    fill(()=>{c.moveTo(.15*r,-.1*r);c.quadraticCurveTo(.75*r,-.58*r,1.0*r,-.2*r);c.lineTo(.68*r,.1*r);c.lineTo(1.02*r,.38*r);c.quadraticCurveTo(.44*r,.44*r,.15*r,.13*r);c.closePath()},'#06101a','#fff0c7',Math.max(1,r*.045),8);
    teeth(.61,.06,.36,.25,9,.68);stroke(()=>{c.moveTo(-.02*r,-.5*r);c.quadraticCurveTo(.1*r,-1.12*r,.48*r,-1.04*r)},Math.max(1,r*.06),'#fff0a4',8);eye(.48,-.28,r*.06,'#fff0a4');
   }else if(id==='maw'){
    for(let i=0;i<7;i++){const a=Math.PI+i*Math.PI/6;tentacle(Math.cos(a)*.58,Math.sin(a)*.58,Math.cos(a)*.8,Math.sin(a)*.8,Math.cos(a)*1.12,Math.sin(a)*1.1,Math.cos(a)*1.35,Math.sin(a)*1.2,.7)}
    body(1.0,.95,0,color);c.save();c.fillStyle='#050611';c.strokeStyle='#f0c5ff';c.lineWidth=Math.max(1,r*.05);c.beginPath();c.ellipse(.12*r,0,.56*r,.63*r,0,0,Math.PI*2);c.fill();c.stroke();c.restore();teeth(.12,0,.52,.58,16,.8);eye(.65,-.15,r*.05,'#ffeaff');
   }else{
    fin([[-1.05,0],[-1.65,-.35],[-1.5,.08],[-1.6,.42]],color);body(1.18,.98,.12,color);
    fill(()=>{c.ellipse(-.1*r,.48*r,.85*r,.48*r,0,0,Math.PI*2)},bodyGrad(color),'rgba(211,255,246,.35)',Math.max(1,r*.035),5);
    for(let side of [-1,1])fin([[-.55,side*.45],[-.95,side*.95],[-.12,side*.62]],color);
    c.save();c.fillStyle='#020811';c.strokeStyle='#a4fff0';c.lineWidth=Math.max(1.2,r*.06);c.shadowBlur=10*glowScale;c.shadowColor=color;c.beginPath();c.ellipse(.48*r,.02*r,.68*r,.72*r,-.08,0,Math.PI*2);c.fill();c.stroke();c.restore();teeth(.48,.02,.62,.65,20,.88);eye(.2,-.52,r*.065,'#eaffff');eye(.55,-.48,r*.06,'#eaffff');gills(-.28,-.28,4);
   }
  } else {
   // Safe fallback for any future skin: bilateral bell and trailing filaments.
   for(let side of [-1,1])for(let i=0;i<3;i++)tentacle(-.4+i*.34,side*.2,-.65+i*.3,side*.55,-.35+i*.3,side*.95,-.6+i*.45,side*1.16,.8);
   body(.85,.72,0,color);eye(.3,-.16,r*.06);
  }
  // Fine luminous lateral line makes skin previews look like the live character.
  if(!['royal','glacier','abyssaleye'].includes(id))stroke(()=>{c.moveTo(-.55*r,.03*r);c.quadraticCurveTo(0,.21*r,.48*r,.04*r)},Math.max(.8,r*.025),'rgba(214,255,250,.52)',5);
  c.restore();return;
 }

 // HOSTILE FAUNA: each enemy category has its own anatomy, not just a recolored orb.
 if(kind==='kraken'){
  for(let arm=0;arm<8;arm++){const phase=(Number(t)||0)*.0015+(Number(x)+Number(y))*.0002;const pose=window.AbyssalEnemyAI?.krakenTentaclePose?.(arm,phase)||{sx:Math.cos(.34+arm*.35)*.44,sy:.25,c1x:.6,c1y:.72,c2x:Math.cos(.34+arm*.35)*1.2,c2y:1.2,ex:Math.cos(.34+arm*.35)*2,ey:1.8};krakenArm(pose,arm,t);}
  fill(()=>{c.moveTo(-.76*r,.12*r);c.bezierCurveTo(-.98*r,-.27*r,-.73*r,-.82*r,-.25*r,-.83*r);c.bezierCurveTo(.25*r,-.97*r,.78*r,-.62*r,.78*r,.1*r);c.quadraticCurveTo(.35*r,.52*r,-.08*r,.45*r);c.quadraticCurveTo(-.47*r,.48*r,-.76*r,.12*r);},bodyGrad(color),'rgba(132,247,223,.88)',Math.max(1.5,r*.06),14);
  for(let side of [-1,1]){fill(()=>{c.moveTo(side*.48*r,-.34*r);c.lineTo(side*.85*r,-.63*r);c.lineTo(side*.77*r,-.23*r);c.closePath()},'#07131d',color,Math.max(1,r*.025),4);c.save();c.fillStyle='#ff203f';c.shadowBlur=12*glowScale;c.shadowColor='#ff1b42';c.beginPath();c.ellipse(side*.34*r,-.22*r,r*.09,r*.13,side*-.16,0,Math.PI*2);c.fill();c.restore();}
  c.save();c.fillStyle='#020309';c.strokeStyle='rgba(150,26,54,.9)';c.lineWidth=Math.max(1,r*.03);c.beginPath();c.moveTo(-.42*r,.03*r);c.quadraticCurveTo(0,.32*r,.45*r,.015*r);c.quadraticCurveTo(.35*r,.42*r,0,.38*r);c.quadraticCurveTo(-.32*r,.37*r,-.42*r,.03*r);c.closePath();c.fill();c.stroke();c.fillStyle='#e9d5c9';for(let tooth=0;tooth<9;tooth++){const tx=(-.36+tooth*.09)*r,ty=(.12+Math.sin(tooth*.7)*.045)*r;c.beginPath();c.moveTo(tx,ty);c.lineTo(tx+r*.035,ty+r*.12);c.lineTo(tx+r*.07,ty+r*.01);c.closePath();c.fill();}c.restore();
 } else if(kind==='kraken'){
  // The boss uses the same eight animated, tapered tentacles as the player skin.
  for(let arm=0;arm<8;arm++){
   const pose=window.AbyssalEnemyAI?.krakenTentaclePose?.(arm,t*.0018)||{sx:Math.cos(arm*Math.PI/4)*.44,sy:.25,c1x:.65,c1y:.65,c2x:Math.cos(arm*Math.PI/4)*1.42,c2y:1.1,ex:Math.cos(arm*Math.PI/4)*2.1,ey:Math.sin(arm*Math.PI/4)*2.1};
   krakenArm(pose,arm,t);
  }
  fill(()=>{c.moveTo(-.76*r,.12*r);c.bezierCurveTo(-.98*r,-.27*r,-.73*r,-.82*r,-.25*r,-.83*r);c.bezierCurveTo(.25*r,-.97*r,.78*r,-.62*r,.78*r,.1*r);c.quadraticCurveTo(.35*r,.52*r,-.08*r,.45*r);c.quadraticCurveTo(-.47*r,.48*r,-.76*r,.12*r);},bodyGrad('#8b5cf6'),'rgba(196,164,255,.9)',Math.max(1.2,r*.06),15);
  for(let side of [-1,1]){c.save();c.fillStyle='#d9c7ff';c.shadowBlur=13*glowScale;c.shadowColor='#a855f7';c.beginPath();c.ellipse(side*.34*r,-.22*r,r*.075,r*.12,side*-.16,0,Math.PI*2);c.fill();c.restore();}
  c.save();c.fillStyle='rgba(1,1,10,.98)';c.strokeStyle='rgba(167,139,250,.85)';c.lineWidth=Math.max(1,r*.025);c.beginPath();c.ellipse(0,.2*r,.22*r,.105*r,0,0,Math.PI*2);c.fill();c.stroke();c.restore();
  for(let g=0;g<3;g++)stroke(()=>{c.moveTo((-.42+g*.1)*r,-.44*r);c.quadraticCurveTo((-.35+g*.1)*r,-.26*r,(-.3+g*.1)*r,-.12*r)},Math.max(.7,r*.024),'rgba(207,195,255,.7)',2);
 } else if(kind==='drifter'){
  // Bell-shaped comb jelly with scalloped rim, luminous ribs and trailing cilia.
  for(let i=0;i<7;i++){const xx=(-.65+i*.215);tentacle(xx,.12,xx-.08,.45,xx+.08,.85,xx+Math.sin(i)*.12,1.12,.7)}
  fill(()=>{c.moveTo(-.82*r,.02*r);c.bezierCurveTo(-.92*r,-.35*r,-.67*r,-.83*r,0,-.84*r);c.bezierCurveTo(.65*r,-.82*r,.92*r,-.37*r,.82*r,.02*r);for(let i=0;i<=8;i++){const xx=(.82-i*.205)*r;c.quadraticCurveTo(xx-.08*r,.22*r,xx-.205*r,.03*r)}c.closePath()},bodyGrad(color),'rgba(234,255,253,.67)',Math.max(1,r*.05),12);
  for(let i=0;i<7;i++){const xx=(-.62+i*.2)*r;stroke(()=>{c.moveTo(xx,-.65*r);c.quadraticCurveTo((xx-.035*r),-.33*r,(xx+.02*r),-.08*r)},Math.max(.6,r*.025),'rgba(235,255,255,.62)',4)}eye(.3,-.22,r*.07);
 } else if(kind==='stinger'){
  // Fast viperfish with narrow jaws, forked tail and defensive dorsal rays.
  fin([[-1.05,0],[-1.78,-.45],[-1.52,0],[-1.76,.43]],color);fin([[-.58,-.26],[-.38,-.95],[-.16,-.3]],'#ffcf9a');fin([[-.08,-.28],[.12,-.72],[.32,-.2]],color);fin([[-.3,.24],[-.08,.58],[.1,.22]],color);
  fill(()=>{c.moveTo(-1.2*r,0);c.quadraticCurveTo(-.83*r,-.53*r,-.12*r,-.42*r);c.lineTo(.74*r,-.12*r);c.lineTo(1.24*r,-.02*r);c.lineTo(.76*r,.12*r);c.quadraticCurveTo(-.48*r,.4*r,-1.2*r,0)},bodyGrad(color),'rgba(255,241,219,.48)',Math.max(1,r*.04),9);
  fill(()=>{c.moveTo(.35*r,.05*r);c.lineTo(1.14*r,.08*r);c.lineTo(.62*r,.24*r);c.closePath()},'#07111b','#fff0d4',Math.max(.7,r*.03),4);for(let i=0;i<5;i++)fin([[.42+i*.12,-.05],[.46+i*.12,.12],[.5+i*.12,-.04]],'#fff3df');gills(-.14,-.18,3);eye(.63,-.1,r*.06,'#fff0c9');
 } else if(kind==='brute'){
  // Armored benthic isopod: symmetrical legs, mineral carapace and two pincers.
  for(let side of [-1,1])for(let i=0;i<4;i++){const xx=-.6+i*.32;stroke(()=>{c.moveTo(xx*r,side*.18*r);c.quadraticCurveTo((xx-.12)*r,side*.48*r,(xx-.31)*r,side*.72*r)},Math.max(1.1,r*.07),color,8);stroke(()=>{c.moveTo((xx-.31)*r,side*.72*r);c.lineTo((xx-.46)*r,side*.79*r)},Math.max(.8,r*.04),'#edddff',4)}
  fill(()=>{c.ellipse(-.05*r,0,.98*r,.62*r,0,0,Math.PI*2)},bodyGrad(color),'rgba(243,233,255,.68)',Math.max(1,r*.05),11);
  for(let i=0;i<6;i++){const xx=(-.76+i*.27)*r;fill(()=>{c.beginPath();c.moveTo(xx,-.42*r);c.lineTo(xx+.1*r,-.54*r);c.lineTo(xx+.22*r,-.1*r);c.lineTo(xx+.14*r,.42*r);c.lineTo(xx,.45*r);c.closePath()},'rgba(17,25,43,.45)','rgba(241,223,255,.68)',Math.max(.8,r*.03),4)}
  for(let side of [-1,1]){stroke(()=>{c.moveTo(.45*r,side*.17*r);c.quadraticCurveTo(.79*r,side*.25*r,.88*r,side*.5*r)},Math.max(1.6,r*.1),color,8);fin([[.75,side*.42],[1.18,side*.62],[1.03,side*.26],[.85,side*.18]],color)}eye(.4,-.18,r*.065,'#f7edff');eye(.4,.13,r*.055,'#f7edff');
 } else if(kind==='lurker'){
  // Gulper eel: whip-tail, deep pouch-like jaw and rows of needle teeth.
  fill(()=>{c.moveTo(-2.0*r,.06*r);c.quadraticCurveTo(-1.55*r,-.32*r,-.92*r,-.24*r);c.quadraticCurveTo(-.38*r,-.4*r,.18*r,-.31*r);c.lineTo(.76*r,-.16*r);c.lineTo(.98*r,.12*r);c.quadraticCurveTo(.48*r,.4*r,-.25*r,.29*r);c.quadraticCurveTo(-1.15*r,.42*r,-2*r,.06*r)},bodyGrad(color),'rgba(192,210,255,.5)',Math.max(1,r*.04),9);
  fin([[-1.8,.06],[-2.32,-.2],[-2.1,.12],[-2.28,.32]],color);fill(()=>{c.moveTo(.35*r,-.1*r);c.quadraticCurveTo(.8*r,-.48*r,1.08*r,-.2*r);c.lineTo(.68*r,.08*r);c.lineTo(1.05*r,.36*r);c.quadraticCurveTo(.58*r,.42*r,.35*r,.13*r);c.closePath()},'#050b16','#96acff',Math.max(1,r*.045),8);
  for(let i=0;i<6;i++){const xx=(.42+i*.085)*r;fin([[xx/r,-.13],[xx/r-.03,.02],[xx/r+.03,.02]],'#eff3ff');fin([[xx/r,.1],[xx/r-.03,.0],[xx/r+.03,.0]],'#eff3ff')};for(let i=0;i<5;i++){const xx=(-1.35+i*.28)*r;stroke(()=>{c.moveTo(xx,-.22*r);c.lineTo((xx-.05*r),.23*r)},Math.max(.7,r*.025),'rgba(196,218,255,.7)',3)}eye(.45,-.28,r*.06,'#d6deff');
 } else if(kind==='boss'){
  // Aberração Abissal: horned abyssal cephalopod with a bone mask and fan of hooked arms.
  for(let i=0;i<10;i++){const side=i<5?-1:1,j=i%5,sy=(-.4+j*.2);tentacle(-.48,sy,side*.3,sy+.18,side*(.9+j*.12),sy+.55,side*(1.25+j*.18),sy+.9,.95,true)}
  fill(()=>{c.moveTo(-.75*r,-.22*r);c.lineTo(-.56*r,-.75*r);c.lineTo(-.15*r,-.6*r);c.lineTo(.1*r,-.92*r);c.lineTo(.38*r,-.55*r);c.lineTo(.78*r,-.38*r);c.lineTo(.72*r,.18*r);c.lineTo(.25*r,.48*r);c.lineTo(-.38*r,.4*r);c.closePath()},bodyGrad(color),'#ffb8ca',Math.max(1.5,r*.055),16);
  fill(()=>{c.moveTo(-.47*r,-.28*r);c.lineTo(-.25*r,-.58*r);c.lineTo(.02*r,-.44*r);c.lineTo(.28*r,-.6*r);c.lineTo(.52*r,-.22*r);c.lineTo(.42*r,.2*r);c.lineTo(0,.32*r);c.lineTo(-.38*r,.15*r);c.closePath()},'#d9e5e0','#fff1f2',Math.max(1.2,r*.04),7);
  c.save();c.fillStyle='#10121d';c.beginPath();c.ellipse(.08*r,.03*r,.28*r,.26*r,0,0,Math.PI*2);c.fill();c.restore();for(let side of [-1,1]){fin([[-.5,side*.12],[-1.0,side*.32],[-.7,side*.43]],'#ff7896');fin([[.05,side*.3],[.25,side*.62],[.42,side*.3]],'#ff7896')}eye(.02,-.15,r*.075,'#fff2f5');eye(.25,-.04,r*.045,'#ffdb83');
 } else if(kind==='devourer'){
  // A broad-bodied pelican eel with a distended throat pouch and a cavernous mouth.
  fin([[-1.2,0],[-1.8,-.38],[-1.65,.08],[-1.82,.4]],color);fin([[-.42,-.58],[-.15,-1.12],[.12,-.48]],color);fin([[-.35,.5],[-.08,1.02],[.28,.48]],color);
  fill(()=>{c.ellipse(-.1*r,.12*r,1.3*r,1.08*r,-.06,0,Math.PI*2)},bodyGrad(color),'rgba(194,255,244,.8)',Math.max(1.8,r*.055),16);
  fill(()=>{c.ellipse(-.16*r,.58*r,.95*r,.55*r,.02,0,Math.PI*2)},bodyGrad(color),'rgba(144,231,218,.5)',Math.max(1,r*.035),7);
  for(let i=0;i<6;i++){const xx=(-.82+i*.29)*r;stroke(()=>{c.moveTo(xx,-.48*r);c.quadraticCurveTo(xx-.08*r,.04*r,xx+.03*r,.8*r)},Math.max(1.4,r*.045),'rgba(211,255,248,.7)',5)}
  c.save();c.fillStyle='#010811';c.strokeStyle='#9efff0';c.lineWidth=Math.max(1.5,r*.06);c.shadowBlur=22*glowScale;c.shadowColor=color;c.beginPath();c.ellipse(.62*r,.05*r,.78*r,.78*r,-.06,0,Math.PI*2);c.fill();c.stroke();c.restore();
  c.save();c.fillStyle='#f5fff3';for(let tooth=0;tooth<14;tooth++){const xx=(-.03+tooth*.095)*r;c.beginPath();c.moveTo(xx,-.63*r);c.lineTo(xx+.04*r,-.34*r);c.lineTo(xx+.085*r,-.64*r);c.closePath();c.fill();c.beginPath();c.moveTo(xx,.68*r);c.lineTo(xx+.04*r,.39*r);c.lineTo(xx+.085*r,.69*r);c.closePath();c.fill();}c.restore();
  eye(.2,-.52,r*.07,'#e8fff9');eye(.75,-.43,r*.06,'#befff5');gills(-.7,-.25,4);
 } else if(kind==='leviathan'){
  // Ancient trench leviathan: colossal plated eel with bony crest, fins and side gills.
  fill(()=>{c.moveTo(-2.6*r,.02*r);c.quadraticCurveTo(-2.0*r,-.47*r,-1.15*r,-.42*r);c.quadraticCurveTo(-.45*r,-.3*r,.1*r,-.35*r);c.lineTo(.72*r,-.18*r);c.lineTo(1.0*r,.04*r);c.quadraticCurveTo(.35*r,.4*r,-.78*r,.34*r);c.quadraticCurveTo(-1.8*r,.43*r,-2.6*r,.02*r)},bodyGrad(color),'rgba(225,255,250,.66)',Math.max(1.4,r*.045),15);
  fin([[-2.32,.03],[-2.88,-.28],[-2.63,.05],[-2.86,.31]],color);for(let i=0;i<9;i++){const xx=(-1.75+i*.25)*r;fin([[xx/r,-.32],[xx/r-.1,-.78-(i%3===0?.18:0)],[xx/r+.14,-.28]],color,'#d0fff9');stroke(()=>{c.moveTo(xx,-.23*r);c.lineTo((xx-.02*r),.25*r)},Math.max(.8,r*.026),'rgba(231,255,255,.72)',4)}
  fill(()=>{c.ellipse(.68*r,-.04*r,.3*r,.28*r,-.08,0,Math.PI*2)},'#d0e9de','#f4fffb',Math.max(1,r*.04),10);eye(.76,-.14,r*.055,'#9dfff0');gills(.13,-.18,4);
 } else if(kind==='maw'){
  // A circular predator: jaw ring, radial teeth, plated lips and short feeding tentacles.
  for(let i=0;i<8;i++){const a=Math.PI+i*Math.PI/7,sx=Math.cos(a)*.58,sy=Math.sin(a)*.58;tentacle(sx,sy,sx-.18,sy+.22,sx+.15,sy+.54,sx-.1,sy+.82,.85)}
  body(1.05,1.0,0,color);c.save();c.fillStyle='#080713';c.strokeStyle='#ff92e1';c.lineWidth=Math.max(1.5,r*.075);c.shadowBlur=22;c.shadowColor=color;c.beginPath();c.ellipse(.2*r,0,.56*r,.63*r,0,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle='rgba(255,220,252,.7)';c.lineWidth=Math.max(1,r*.035);c.beginPath();c.ellipse(.2*r,0,.68*r,.75*r,0,0,Math.PI*2);c.stroke();c.restore();teeth(.2,0,.52,.59,18,1.05);for(let side of [-1,1]){fin([[-.48,side*.35],[-.92,side*.78],[-.35,side*.63]],color);fin([[.55,side*.4],[.9,side*.68],[.73,side*.29]],'#f6bcff')}eye(.52,-.12,r*.055,'#f4d5ff');
 } else if(kind==='whiteShark'||kind==='whiteSharkBoss'){
  // Tubarão-branco & Boss Tubarão-branco: corpo hidrodinâmico, cauda em foice e barbatana dorsal cortante
  const isBossShark = kind==='whiteSharkBoss';
  const sharkBase = isBossShark ? '#68a8b8' : '#91c4ce';
  fin([[-1.15,-.02],[-1.78,-.52],[-1.52,-.04],[-1.82,.46]], isBossShark?'#2a424d':'#3e5661');
  fin([[-.38,-.29],[-.12,-1.15],[.12,-.31]], isBossShark?'#375360':'#4f6874');
  fin([[-.12,.20],[-.58,.84],[.36,.36]], isBossShark?'#2e4753':'#47616d');
  fin([[.35,.12],[.04,.68],[.65,.26]], isBossShark?'#375360':'#4f6874');
  fill(()=>{c.moveTo(-1.38*r,0);c.quadraticCurveTo(-1.02*r,-.48*r,-.35*r,-.49*r);c.quadraticCurveTo(.28*r,-.43*r,.88*r,-.18*r);c.lineTo(1.28*r,-.015*r);c.lineTo(.85*r,.13*r);c.quadraticCurveTo(.18*r,.49*r,-.58*r,.35*r);c.quadraticCurveTo(-1.08*r,.26*r,-1.38*r,0)},bodyGrad(sharkBase),isBossShark?'rgba(175,238,255,.9)':'rgba(231,251,255,.78)',Math.max(1.2,r*.045),isBossShark?16:12);
  fill(()=>{c.moveTo(-.38*r,.205*r);c.quadraticCurveTo(.22*r,.37*r,1.14*r,.045*r);c.quadraticCurveTo(.72*r,.34*r,.08*r,.39*r);c.quadraticCurveTo(-.22*r,.36*r,-.38*r,.205*r)},'#e8ece5','rgba(255,255,255,.7)',Math.max(.8,r*.026),3);
  fill(()=>{c.moveTo(.88*r,.14*r);c.quadraticCurveTo(1.12*r,.10*r,1.26*r,.03*r);c.quadraticCurveTo(1.03*r,.24*r,.74*r,.22*r);c.closePath()},'#17262d','rgba(255,255,255,.4)',Math.max(.7,r*.02),2);
  gills(-.47,-.2,5);
  eye(.82,-.16,r*(isBossShark?.075:.055),isBossShark?'#ff3355':'#07131b');
  if(isBossShark){
    for(let tooth=0;tooth<7;tooth++){const tx=(.82+tooth*.065)*r;fin([[tx/r,.12],[tx/r+.02,.22],[tx/r+.04,.12]],'#ffffff','#1a2830');}
    c.save();c.strokeStyle='#7be9ff';c.lineWidth=Math.max(1,r*.03);c.shadowBlur=12*glowScale;c.shadowColor='#4be1ff';c.beginPath();c.moveTo(-.9*r,-.2*r);c.lineTo(.4*r,-.2*r);c.stroke();c.restore();
  }
 } else if(kind==='angler'){
  // Lanternfish horror: armored forehead, gaping toothed jaw, lure, tail and fins.
  fin([[-.85,0],[-1.55,-.45],[-1.4,.02],[-1.55,.4]],color);fin([[-.45,-.34],[-.2,-.9],[.05,-.34]],color);fin([[-.18,.25],[.1,.66],[.18,.24]],color);
  fill(()=>{c.moveTo(-1.0*r,0);c.quadraticCurveTo(-.78*r,-.72*r,-.12*r,-.62*r);c.quadraticCurveTo(.52*r,-.55*r,.82*r,-.12*r);c.lineTo(.65*r,.12*r);c.quadraticCurveTo(.08*r,.45*r,-.65*r,.32*r);c.closePath()},bodyGrad(color),'rgba(255,231,177,.58)',Math.max(1,r*.045),14);
  fill(()=>{c.moveTo(.22*r,-.05*r);c.lineTo(.88*r,-.14*r);c.lineTo(.65*r,.1*r);c.lineTo(.93*r,.36*r);c.lineTo(.25*r,.25*r);c.closePath()},'#080f19','#ffd7a0',Math.max(1,r*.04),8);for(let i=0;i<6;i++){const xx=(.3+i*.085)*r;fin([[xx/r,-.08],[xx/r-.025,.08],[xx/r+.03,.02]],'#fff4d5')}
  stroke(()=>{c.moveTo(-.05*r,-.47*r);c.quadraticCurveTo(.02*r,-1.14*r,.48*r,-1.14*r)},Math.max(1.5,r*.065),'#ffcb70',14);c.save();const pulseSize=r*.14*(1+Math.sin(t*.009)*.12);const lamp=c.createRadialGradient(.48*r,-1.14*r,1,.48*r,-1.14*r,pulseSize*2);lamp.addColorStop(0,'#fffde4');lamp.addColorStop(.35,'#ffd277');lamp.addColorStop(1,'rgba(255,147,55,0)');c.fillStyle=lamp;c.beginPath();c.arc(.48*r,-1.14*r,pulseSize*2,0,Math.PI*2);c.fill();c.restore();eye(.43,-.32,r*.055,'#fff3c5');
 }
 // Bioluminescent side line and paired sensory pores unify the species without flattening silhouettes.
 if(kind!=='drifter'&&kind!=='maw')stroke(()=>{c.moveTo(-.45*r,.06*r);c.quadraticCurveTo(-.05*r,.22*r,.42*r,.07*r)},Math.max(.8,r*.028),'rgba(211,255,246,.55)',5);
 if(boss){c.save();c.strokeStyle=color;c.lineWidth=Math.max(1.2,r*.035);c.shadowBlur=17;c.shadowColor=color;c.beginPath();c.ellipse(0,0,r*1.46,r*1.27,0,t*.0007,t*.0007+Math.PI*1.7);c.stroke();c.restore()}
 c.restore();
}
function drawArenaTerrain(t){
 // Quatro vórtices fixos nos cantos do mapa marcam fendas de onde a fauna entra. Eles não seguem a câmera/jogador.
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 const vortices=getArenaVortices();
 for(const v of vortices){
  const pulse=1+Math.sin(t*.0014+v.phase)*.08,r=58/worldZoom*pulse;
  ctx.fillStyle=getArenaVortexGlow(v);ctx.beginPath();ctx.arc(v.x,v.y,r*1.9,0,Math.PI*2);ctx.fill();
  for(let ring=0;ring<3;ring++){const rr=(18+ring*15+Math.sin(t*.0011+v.phase+ring)*3)/worldZoom;ctx.beginPath();ctx.ellipse(v.x,v.y,rr*1.08,rr*.72,t*.00018*(ring%2?-1:1)+v.phase,0,Math.PI*2);ctx.strokeStyle=`rgba(96,244,233,${.28-ring*.065})`;ctx.lineWidth=(2-ring*.35)/worldZoom;ctx.stroke();}
  ctx.save();ctx.translate(v.x,v.y);ctx.rotate(-t*.00042-v.phase);ctx.beginPath();for(let a=0;a<=Math.PI*3.5;a+=.12){const rr=(4+a*2.3)/worldZoom;if(a===0)ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);else ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.strokeStyle='rgba(110,247,239,.64)';ctx.lineWidth=1.6/worldZoom;ctx.shadowBlur=14/worldZoom;ctx.shadowColor='#4de4df';ctx.stroke();ctx.restore();
  ctx.fillStyle='rgba(160,242,237,.8)';ctx.font=`${9/worldZoom}px 'DM Mono',monospace`;ctx.textAlign='center';ctx.fillText(v.label,v.x,v.y+79/worldZoom);
 }
 ctx.setLineDash([]);ctx.shadowBlur=0;
 // The central abyssal cave is a fixed landmark in the map, not an effect attached to the player.
 const caveX=W*.5,caveY=H*.5;for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(caveX,caveY,(88+i*25)/worldZoom,(52+i*17)/worldZoom,Math.sin(t*.00015+i)*.035,0,Math.PI*2);ctx.strokeStyle=`rgba(98,207,218,${.12-i*.017})`;ctx.lineWidth=1.5/worldZoom;ctx.stroke();}
 const left=cameraX-70/worldZoom,right=cameraX+viewW/worldZoom+70/worldZoom,top=cameraY-70/worldZoom,bottom=cameraY+viewH/worldZoom+70/worldZoom;
 for(const rock of arenaRocks){if(rock.x<left||rock.x>right||rock.y<top||rock.y>bottom)continue;ctx.save();ctx.translate(rock.x,rock.y);ctx.beginPath();rock.vertices.forEach(([vx,vy],i)=>{const x=vx*(rock.shade>.5?1.14:1),y=vy*(rock.shade>.5?.9:1.12);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.closePath();ctx.fillStyle=rock.shade>.5?'#183543':'#0b202d';ctx.strokeStyle='rgba(102,181,193,.36)';ctx.lineWidth=1.6/worldZoom;ctx.shadowBlur=lowPowerRendering?0:4/worldZoom;ctx.shadowColor='rgba(35,145,162,.16)';ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-rock.r*.25,-rock.r*.15);ctx.lineTo(-rock.r*.04,-rock.r*.42);ctx.lineTo(rock.r*.18,-rock.r*.09);ctx.strokeStyle='rgba(141,224,229,.22)';ctx.lineWidth=1/worldZoom;ctx.stroke();ctx.restore();}
 ctx.strokeStyle='rgba(108,215,222,.32)';ctx.lineWidth=2/worldZoom;ctx.setLineDash([9/worldZoom,13/worldZoom]);ctx.strokeRect(18/worldZoom,18/worldZoom,W-36/worldZoom,H-36/worldZoom);ctx.setLineDash([]);
 ctx.restore();
}

function drawDevourerSuction(enemy,t){
 if(!enemy||!enemy.suctionActive)return;
 const range=1240/GAME_WORLD_ZOOM,mouthX=enemy.r*.55,elapsed=(Number(enemy.suctionPulse)||0)*1.7+t*.001;
 const strands=lowPowerRendering?7:12;
 ctx.save();ctx.translate(enemy.x,enemy.y);ctx.rotate(Number(enemy.angle)||0);
 ctx.strokeStyle='#8df9ee';ctx.lineWidth=2.2/GAME_WORLD_ZOOM;ctx.shadowBlur=lowPowerRendering?0:10/GAME_WORLD_ZOOM;ctx.shadowColor='#47e4d5';
 for(let i=0;i<strands;i++){
  const a=i*Math.PI*2/strands+elapsed*.55,outer=range*(.72+.22*Math.sin(elapsed*1.7+i));
  const sx=Math.cos(a)*outer,sy=Math.sin(a)*outer*.72,midX=Math.cos(a+.55)*outer*.5,midY=Math.sin(a+.55)*outer*.38;
  ctx.globalAlpha=.22+.2*(.5+.5*Math.sin(elapsed*3+i));ctx.beginPath();ctx.moveTo(sx,sy);ctx.quadraticCurveTo(midX,midY,mouthX,0);ctx.stroke();
  const travel=(t*.00065+i*.137)%1,px=sx+(mouthX-sx)*travel,py=sy*(1-travel)+(Math.sin(a+elapsed)*enemy.r*.16)*travel;
  ctx.globalAlpha=.45+.3*Math.sin(elapsed*4+i);ctx.fillStyle=i%2?'#d9fff8':'#6bf2e4';ctx.beginPath();ctx.arc(px,py,(2.2+(i%3))/GAME_WORLD_ZOOM,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=.28;ctx.strokeStyle='#7ff8e9';for(let ring=0;ring<3;ring++){const radius=range*(.28+ring*.25);ctx.beginPath();ctx.ellipse(0,0,radius,radius*.72,elapsed*.14+ring*.4,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}
function draw(t){
 ctx.setTransform(dpr*worldZoom,0,0,dpr*worldZoom,0,0);updateCamera();ctx.save();if(shake>0)ctx.translate(rand(-shake,shake),rand(-shake,shake));ctx.translate(-cameraX,-cameraY);drawBackground(t);
 // The menu has its own CSS scene. Do not render the full arena/entities behind it.
 if(gameState==='menu'){ctx.restore();return;}
 drawArenaTerrain(t);
 for(const o of orbs){if(onlineMode&&Number.isFinite(o.interpAt)){const op=currentInterpolatedEnemyPosition(o,performance.now());o.x=op.x;o.y=op.y;}if(o.x<cameraX-40/worldZoom||o.x>cameraX+viewW/worldZoom+40/worldZoom||o.y<cameraY-40/worldZoom||o.y>cameraY+viewH/worldZoom+40/worldZoom)continue;const pulse=1+Math.sin(o.phase)*.2;ctx.save();ctx.shadowBlur=lowPowerRendering?0:8;ctx.shadowColor='#a28dff';ctx.fillStyle='#b8a7ff';ctx.beginPath();ctx.arc(o.x,o.y,o.r*pulse,0,Math.PI*2);ctx.fill();ctx.fillStyle='#effaff';ctx.beginPath();ctx.arc(o.x-o.r*.25,o.y-o.r*.25,o.r*.3,0,Math.PI*2);ctx.fill();ctx.restore()}
 for(const p of projectiles){if(p.x<cameraX-70/worldZoom||p.x>cameraX+viewW/worldZoom+70/worldZoom||p.y<cameraY-70/worldZoom||p.y>cameraY+viewH/worldZoom+70/worldZoom)continue;ctx.save();const trail=p.allyShot?'#9bbcff':(p.special==='pierce'?'#ffe7a1':p.special==='ricochet'?'#ffc47a':p.special==='electric'?'#79f3ff':p.color);ctx.strokeStyle=trail;ctx.lineWidth=p.special==='pierce'?6:p.allyShot?5.5:p.special==='electric'?5:p.special==='ricochet'?5:p.r*2;ctx.shadowBlur=lowPowerRendering?0:(p.special?16:p.allyShot?13:9);ctx.shadowColor=trail;ctx.beginPath();ctx.moveTo(p.x-p.vx*(p.special==='pierce'?.065:.045),p.y-p.vy*(p.special==='pierce'?.065:.045));ctx.lineTo(p.x,p.y);ctx.stroke();if(p.special==='electric'){ctx.strokeStyle='#eaffff';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(p.x-p.vx*.025,p.y-p.vy*.025);ctx.lineTo(p.x+rand(-4,4),p.y+rand(-4,4));ctx.lineTo(p.x,p.y);ctx.stroke()}ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(p.x,p.y,p.special==='pierce'?p.r*1.3:p.r,0,Math.PI*2);ctx.fill();
 if(p.allyShot){ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.x-p.vx*.018,p.y-p.vy*.018);ctx.lineTo(p.x+rand(-3,3),p.y+rand(-3,3));ctx.lineTo(p.x,p.y);ctx.stroke()}
 ctx.restore()}
 for(const e of enemies){if(onlineMode&&window.AbyssalEnemyNetcode?.renderedPosition){const p=window.AbyssalEnemyNetcode.renderedPosition(e,performance.now());e.x=p.x;e.y=p.y;}else if(e.interpDuration>0&&Number.isFinite(e.interpAt)){const ip=clamp((performance.now()-e.interpAt)/e.interpDuration,0,1);e.x=e.interpFromX+(e.interpTargetX-e.interpFromX)*ip;e.y=e.interpFromY+(e.interpTargetY-e.interpFromY)*ip;}else if(Number.isFinite(e.interpTargetX)){e.x=e.interpTargetX;e.y=e.interpTargetY;}const renderPad=e.r*(e.kind==='kraken'?2.8:e.kind==='devourer'?2.55:e.kind==='leviathan'?3.15:e.kind==='lurker'?2.55:BOSS_KINDS.includes(e.kind)?2.15:1.85);if(e.x+renderPad<cameraX||e.x-renderPad>cameraX+viewW/worldZoom||e.y+renderPad<cameraY||e.y-renderPad>cameraY+viewH/worldZoom)continue;drawCreature(e.x,e.y,e.r,e.angle,e.color,e.kind,t,false,e.hit);
  if (e.paralyzedUntil && performance.now() < e.paralyzedUntil) {
    ctx.save();
    ctx.strokeStyle = '#38e8ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const sparks = 4;
    for (let s = 0; s < sparks; s++) {
      const sa = (s / sparks) * Math.PI * 2 + (t * 0.02);
      const sr1 = e.r * 0.7;
      const sr2 = e.r * 1.35;
      ctx.moveTo(e.x + Math.cos(sa) * sr1, e.y + Math.sin(sa) * sr1);
      ctx.lineTo(e.x + Math.cos(sa + 0.3) * (sr1 + sr2) * 0.5, e.y + Math.sin(sa + 0.3) * (sr1 + sr2) * 0.5);
      ctx.lineTo(e.x + Math.cos(sa) * sr2, e.y + Math.sin(sa) * sr2);
    }
    ctx.stroke();
    ctx.restore();
  }if(e.kind==='devourer'&&e.suctionActive)drawDevourerSuction(e,t);if(e.hp<e.maxHp||BOSS_KINDS.includes(e.kind)){ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(e.x-e.r,e.y-e.r-(['boss','leviathan','maw','angler','devourer'].includes(e.kind)?16:8)/worldZoom,e.r*2,(['boss','leviathan','maw','angler','devourer'].includes(e.kind)?6:3)/worldZoom);ctx.fillStyle=e.color;ctx.fillRect(e.x-e.r,e.y-e.r-(['boss','leviathan','maw','angler'].includes(e.kind)?16:8),e.r*2*clamp(e.hp/e.maxHp,0,1),['boss','leviathan','maw','angler'].includes(e.kind)?6:3);if(BOSS_KINDS.includes(e.kind)){ctx.fillStyle='#ffd8e2';ctx.font=`bold ${14/worldZoom}px sans-serif`;ctx.textAlign='center';ctx.fillText(BOSS_LABELS[e.kind]||'BOSS ABISSAL',e.x,e.y-e.r-25/worldZoom)}}}
 
  // Renderizar esteira de bolhas pelágicas do tubarão (duração de 5s)
  for (const b of sharkWakeTrails) {
    if (b.x < cameraX - 40/worldZoom || b.x > cameraX + viewW/worldZoom + 40/worldZoom ||
        b.y < cameraY - 40/worldZoom || b.y > cameraY + viewH/worldZoom + 40/worldZoom) continue;
    const alpha = clamp(b.life / b.maxLife, 0, 1) * 0.45;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#a6f7ff';
    ctx.fillStyle = 'rgba(123, 245, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * (0.6 + 0.4 * (1 - b.life / b.maxLife)), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Ponto de luz interno na bolha
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, Math.max(1.5, b.r * 0.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for(const fx of effects){ctx.save();ctx.globalAlpha=clamp(fx.life/fx.maxLife,0,1);ctx.strokeStyle=fx.color;ctx.shadowBlur=lowPowerRendering?0:10;ctx.shadowColor=fx.color;ctx.lineWidth=fx.type==='ring'?4:3;ctx.beginPath();if(fx.type==='ring'){const progress=1-fx.life/fx.maxLife;ctx.arc(fx.x,fx.y,fx.max*progress,0,Math.PI*2)}else{ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(fx.x2,fx.y2);ctx.lineTo(fx.x2+rand(-5,5),fx.y2+rand(-5,5))}ctx.stroke();ctx.restore()}
 const particleShadowBlur=0;for(const p of particles){if(p.x<cameraX-20/worldZoom||p.x>cameraX+viewW/worldZoom+20/worldZoom||p.y<cameraY-20/worldZoom||p.y>cameraY+viewH/worldZoom+20/worldZoom)continue;ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.shadowBlur=particleShadowBlur;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(.4+.6*p.life/p.max),0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
 if(player){for(const tr of player.trail){if(tr.life>0){ctx.globalAlpha=tr.life/.28*.18;ctx.fillStyle='#7ffbf2';ctx.beginPath();ctx.arc(tr.x,tr.y,player.r*.7,0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1;if(damageFlash<=0||Math.floor(t/60)%2===0)drawCreature(player.x,player.y,player.r,player.angle,currentSkinColor(),'player',t,true);if(upgrades.shield>0){const chargeCount=Math.min(3,Math.max(0,Math.floor(upgrades.shield)));const shieldPulse=1+Math.sin(t*.008)*.025;ctx.save();ctx.globalAlpha=.18+chargeCount*.045;ctx.fillStyle='#73efff';ctx.strokeStyle='#9cf8ff';ctx.lineWidth=1.8/worldZoom;ctx.shadowBlur=10/worldZoom;ctx.shadowColor='#64eaff';ctx.beginPath();ctx.arc(player.x,player.y,player.r*(2.05+chargeCount*.08)*shieldPulse,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.42+chargeCount*.08;ctx.stroke();ctx.restore();}if(player.invuln>0){ctx.save();const shieldPulse=1+Math.sin(t*.012)*.035;ctx.globalAlpha=.58;ctx.strokeStyle='#8af9ff';ctx.fillStyle='rgba(105,235,255,.09)';ctx.lineWidth=2.2/worldZoom;ctx.shadowBlur=14/worldZoom;ctx.shadowColor='#70f6ff';ctx.beginPath();ctx.arc(player.x,player.y,player.r*1.9*shieldPulse,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}ctx.save();ctx.strokeStyle='rgba(126,245,244,.20)';ctx.fillStyle='rgba(126,245,244,.025)';ctx.lineWidth=1;ctx.setLineDash([5,9]);ctx.beginPath();ctx.arc(player.x,player.y,294*(upgrades.range||1)*(equippedSkin==='abyssaleye'?1.2:1)/GAME_WORLD_ZOOM,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.restore();if(damageFlash>0){ctx.fillStyle=`rgba(255,65,100,${damageFlash*.45})`;ctx.fillRect(0,0,W,H)}}
 // Combined skill: circular field matches firing range, with a restrained spark animation.
 if(player&&upgrades.gravitationalRupture>0){
  const fieldRange=294*(upgrades.range||1)*(equippedSkin==='abyssaleye'?1.2:1)/GAME_WORLD_ZOOM;
  const pulse=1+Math.sin(t*.004)*.025;
  ctx.save();ctx.globalAlpha=.14;ctx.fillStyle='#5deeff';ctx.beginPath();ctx.arc(player.x,player.y,fieldRange*pulse,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.78;ctx.strokeStyle='#7df8ff';ctx.lineWidth=2/worldZoom;ctx.setLineDash([9/worldZoom,7/worldZoom]);ctx.beginPath();ctx.arc(player.x,player.y,fieldRange*pulse,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<8;i++){const a=t*.00045+i*Math.PI/4,r=fieldRange*(.22+((i%3)*.19));ctx.globalAlpha=.35+.35*Math.sin(t*.006+i);ctx.fillStyle=i%2?'#d7ffff':'#6cecff';ctx.beginPath();ctx.arc(player.x+Math.cos(a)*r,player.y+Math.sin(a)*r,2.2/worldZoom,0,Math.PI*2);ctx.fill();}
  ctx.restore();
 }
 // Cooperative companions: live players are relayed by the online server; if alone, a helper drone appears.
 if(player && onlineMode){
   const peers=window.AbyssalOnline?window.AbyssalOnline.getPlayers():[];
   peers.forEach(peer=>{
      const px=Number(peer.x)||0,py=Number(peer.y)||0;
      drawCreature(px,py,12/GAME_WORLD_ZOOM,peer.angle||0,peer.color||'#b8a4ff','peer',t,true,0,ctx,window.AbyssalGameHooks?.skinForId?.(peer.skinId));
      const title=PROFILE_TITLE_NAMES[peer.titleId]||'';
      ctx.save();ctx.textAlign='center';ctx.textBaseline='alphabetic';
      if(title){ctx.font=`800 ${12/worldZoom}px Manrope`;ctx.fillStyle=PROFILE_TITLE_COLORS[peer.titleId]||'#79f3f0';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8/worldZoom;ctx.fillText(title,px,py-34/worldZoom);}
      ctx.shadowBlur=0;ctx.fillStyle='#d8ffff';ctx.font=`700 ${14/worldZoom}px Manrope`;ctx.fillText(peer.nickname||'Mergulhador',px,py-18/worldZoom);ctx.restore();
    });
    const self=window.AbyssalOnline?.getAccount?.()||{};
    const selfTitle=PROFILE_TITLE_NAMES[self.equippedTitle]||'';
    ctx.save();ctx.textAlign='center';
    if(selfTitle){ctx.font=`800 ${12/worldZoom}px Manrope`;ctx.fillStyle=PROFILE_TITLE_COLORS[self.equippedTitle]||'#79f3f0';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8/worldZoom;ctx.fillText(selfTitle,player.x,player.y-34/worldZoom);}
    ctx.shadowBlur=0;ctx.fillStyle='#d8ffff';ctx.font=`700 ${14/worldZoom}px Manrope`;ctx.fillText(self.nickname||'Mergulhador',player.x,player.y-18/worldZoom);ctx.restore();
 }
 // corner scanner details
 ctx.save();ctx.strokeStyle='rgba(123,215,223,.23)';ctx.lineWidth=1;const s=14;[[12,12,1,1],[W-12,12,-1,1],[12,H-12,1,-1],[W-12,H-12,-1,-1]].forEach(([x,y,a,b])=>{ctx.beginPath();ctx.moveTo(x,y+s*b);ctx.lineTo(x,y);ctx.lineTo(x+s*a,y);ctx.stroke()});ctx.restore();
 ctx.restore();
 drawBossDirectionIndicators(t);
}
function drawBossDirectionIndicators(t){
 if(!onlineMode||!player||!canvas)return;
 const bosses=enemies.filter(e=>BOSS_KINDS.includes(e.kind));if(!bosses.length)return;
 const cw=canvas.clientWidth||viewW,ch=canvas.clientHeight||viewH,margin=32;
 ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.font='900 10px Manrope, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const boss of bosses){
  const sx=(boss.x-cameraX)*worldZoom,sy=(boss.y-cameraY)*worldZoom;
  if(sx>=margin&&sx<=cw-margin&&sy>=margin&&sy<=ch-margin)continue;
  const dx=sx-cw/2,dy=sy-ch/2,ax=Math.max(1,Math.abs(dx)),ay=Math.max(1,Math.abs(dy));
  const scale=Math.min((cw/2-margin)/ax,(ch/2-margin)/ay),x=clamp(cw/2+dx*scale,margin,cw-margin),y=clamp(ch/2+dy*scale,margin,ch-margin),angle=Math.atan2(dy,dx);
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);const pulse=1+Math.sin(t*.012)*.12;ctx.fillStyle='#ff315f';ctx.shadowBlur=18;ctx.shadowColor='#ff174d';ctx.beginPath();ctx.moveTo(12*pulse,0);ctx.lineTo(-7,-7);ctx.lineTo(-4,0);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.restore();
  ctx.save();ctx.fillStyle='#ffd7e0';ctx.shadowBlur=8;ctx.shadowColor='#ff315f';ctx.fillText(boss.kind==='boss'?'ABERRAÇÃO ABISSAL':'BOSS ABISSAL',x,y+18);ctx.restore();
 }
 ctx.restore();
}
let loopErrorShown=false;
const gameFrameSamples=new Float32Array(180);
let gameFrameSampleCount=0,gameFrameSampleIndex=0,gameFrameFps=0,gameFrameWindowStart=0,gameFrameWindowCount=0;
let gameLastUpdateMs=0,gameLastDrawMs=0,gameMaxFrameMs=0,gameLongTaskCount=0,gameMaxLongTaskMs=0;
function recordGameFrame(startedAt,endedAt,updateMs,drawMs){
 const duration=Math.max(0,endedAt-startedAt);gameFrameSamples[gameFrameSampleIndex]=duration;gameFrameSampleIndex=(gameFrameSampleIndex+1)%gameFrameSamples.length;gameFrameSampleCount=Math.min(gameFrameSamples.length,gameFrameSampleCount+1);
 gameLastUpdateMs=updateMs;gameLastDrawMs=drawMs;gameMaxFrameMs=Math.max(gameMaxFrameMs,duration);
 if(!gameFrameWindowStart)gameFrameWindowStart=endedAt;gameFrameWindowCount++;
 if(endedAt-gameFrameWindowStart>=1000){gameFrameFps=Math.round(gameFrameWindowCount*1000/(endedAt-gameFrameWindowStart));gameFrameWindowStart=endedAt;gameFrameWindowCount=0;}
}
function getAbyssalPerformanceSnapshot(){
 const samples=[];for(let i=0;i<gameFrameSampleCount;i++)samples.push(gameFrameSamples[i]);samples.sort((a,b)=>a-b);
 const p95=samples.length?samples[Math.min(samples.length-1,Math.ceil(samples.length*.95)-1)]:0;
 const memory=performance.memory?.usedJSHeapSize;
 return {fps:gameFrameFps,lastUpdateMs:Number(gameLastUpdateMs.toFixed(2)),lastDrawMs:Number(gameLastDrawMs.toFixed(2)),frameP95Ms:Number(p95.toFixed(2)),maxFrameMs:Number(gameMaxFrameMs.toFixed(2)),longTaskCount:gameLongTaskCount,maxLongTaskMs:Number(gameMaxLongTaskMs.toFixed(2)),entities:{enemies:enemies.length,orbs:orbs.length,projectiles:projectiles.length,particles:particles.length,effects:effects.length},heapUsedMb:Number.isFinite(memory)?Number((memory/1048576).toFixed(1)):null};
}
window.AbyssalPerformance={snapshot:getAbyssalPerformanceSnapshot};
if(typeof PerformanceObserver!=='undefined'){
 try{const longTaskObserver=new PerformanceObserver(list=>{for(const entry of list.getEntries()){gameLongTaskCount++;gameMaxLongTaskMs=Math.max(gameMaxLongTaskMs,Number(entry.duration)||0);}});longTaskObserver.observe({type:'longtask',buffered:true});}catch(_){/* Long Task API is optional. */}
}
function loop(t){
 const active=gameState==='playing'||(onlineMode&&gameState==='upgrade');
 const minFrameInterval=active?1000/60:1000/30;
 if(lastPaintAt&&t-lastPaintAt<minFrameInterval-1){requestAnimationFrame(loop);return;}
 const dt=Math.min(.035,Math.max(0,(t-last)/1000||0));last=t;lastPaintAt=t;
 const frameStarted=performance.now();let updateMs=0,drawMs=0;
 try{
  if(active){const updateStarted=performance.now();update(dt);updateMs=performance.now()-updateStarted;}
  const drawStarted=performance.now();draw(t);const frameEnded=performance.now();drawMs=frameEnded-drawStarted;recordGameFrame(frameStarted,frameEnded,updateMs,drawMs);
 }catch(err){console.error('Abyssal frame error:',err);if(!loopErrorShown){loopErrorShown=true;showToast('A pressão distorce os instrumentos. Consulte o Console (F12) se persistir.')}}
 requestAnimationFrame(loop);
}
function coords(e){const r=canvas.getBoundingClientRect();return{x:cameraX+(e.clientX-r.left)/worldZoom,y:cameraY+(e.clientY-r.top)/worldZoom}}
canvas.addEventListener('pointerdown',e=>{if(gameState!=='playing'||isMobileDevice())return;pointer={...coords(e),down:true,active:true};canvas.setPointerCapture?.(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!isMobileDevice()){Object.assign(pointer,coords(e));pointer.active=true;}});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>canvas.addEventListener(ev,()=>{pointer.down=false;pointer.active=false}));
const joystick=$('mobileJoystick'),joystickKnob=$('joystickKnob'),gameShell=$('gameShell');
function setJoystickFromPointer(e){if(!joystick||!joystickKnob)return;const base=joystick.querySelector('.joystick-base');if(!base)return;const r=base.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=Math.max(18,r.width*.34);let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max;}joystickVector.x=dx/max;joystickVector.y=dy/max;joystickVector.active=Math.hypot(joystickVector.x,joystickVector.y)>.13;joystickKnob.style.transform=`translate(${dx}px, ${dy}px)`;}
function releaseMobileJoystick(e){if(!joystick||joystickVector.pointerId!==e.pointerId)return;joystickVector={x:0,y:0,active:false,pointerId:null};joystick.hidden=true;joystick.classList.remove('is-floating');joystick.style.left='';joystick.style.top='';joystick.style.bottom='';joystick.style.transform='';if(joystickKnob)joystickKnob.style.transform='translate(0, 0)';}
if(gameShell&&joystick){
 gameShell.addEventListener('pointerdown',e=>{
  if(gameState!=='playing'||!isMobileDevice()||joystickVector.pointerId!==null)return;
  if(e.target.closest('button,a,input,select,textarea,.active-ability,.screen,#mobileJoystick'))return;
  e.preventDefault();
  joystickVector={x:0,y:0,active:false,pointerId:e.pointerId};
  joystick.hidden=false;joystick.classList.add('is-floating');
  joystick.style.left=`${e.clientX}px`;joystick.style.top=`${e.clientY}px`;joystick.style.bottom='auto';joystick.style.transform='translate(-50%, -50%)';
  gameShell.setPointerCapture?.(e.pointerId);
  setJoystickFromPointer(e);
 });
 gameShell.addEventListener('pointermove',e=>{if(joystickVector.pointerId===e.pointerId)setJoystickFromPointer(e)});
 ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>gameShell.addEventListener(ev,releaseMobileJoystick));
}
function isTextEntryTarget(target){return Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'));}
window.addEventListener('keydown',e=>{if(isTextEntryTarget(e.target))return;keys[e.key]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if((e.key==='t'||e.key==='T')&&!e.repeat&&!isMobileDevice()&&gameState==='playing'){autoFollowCursor=!autoFollowCursor;if(autoFollowCursor){pointer.down=false;showToast('MOVIMENTO AUTOMÁTICO PELO CURSOR · T PARA PARAR');}else showToast('MOVIMENTO AUTOMÁTICO DESATIVADO');}if((e.key==='q'||e.key==='Q')&&Number(metaUpgrades.pulse)>0)activateAbility('pulse');if((e.key==='e'||e.key==='E')&&Number(metaUpgrades.dash)>0)activateAbility('dash');if(e.key==='Escape'||e.key==='p'||e.key==='P'){if(gameState==='playing')pauseGame();else if(gameState==='paused')resumeGame()}});
window.addEventListener('keyup',e=>{if(isTextEntryTarget(e.target))return;keys[e.key]=false;});
function setReviveMessage(message){const node=$('reviveAdMessage');if(node)node.textContent=message||'';}
function resumeAfterRewardedRevive(){
 if(onlineMode){window.AbyssalOnline?.revivePlayer?.();return;}
 if(!player){setReviveMessage('Não foi possível recuperar este mergulho.');return;}
 hp=maxHp;player.invuln=3;gameState='playing';$('gameOverScreen').hidden=true;$('hud').hidden=false;$('pauseBtn').hidden=false;setMobileGameActive(true);setReviveMessage('Ressurreição concluída! Nível e habilidades preservados.');updateHud();last=performance.now();
}
$('reviveWithAdBtn')?.addEventListener('click',()=>{
 const button=$('reviveWithAdBtn');if(!button)return;
 if(typeof window.adBreak!=='function'){setReviveMessage('Anúncio recompensado indisponível neste momento. Tente novamente mais tarde.');return;}
 button.disabled=true;setReviveMessage('Carregando anúncio recompensado…');let requested=false;
 try{window.adBreak({type:'reward',name:'abyssal-revive',beforeReward:showAd=>{if(typeof showAd==='function')showAd();},adViewed:()=>{if(requested)return;requested=true;resumeAfterRewardedRevive();},adDismissed:()=>{if(!requested)setReviveMessage('O anúncio foi fechado antes da recompensa.');button.disabled=false;},adBreakDone:()=>{button.disabled=false;if(!requested)setReviveMessage('Nenhuma recompensa foi confirmada pelo anúncio.');}});}
 catch(error){console.warn('Falha ao iniciar anúncio de ressurreição:',error);button.disabled=false;setReviveMessage('Não foi possível abrir o anúncio agora.');}
});
window.addEventListener('abyssal-revive-result',event=>{
 const result=event.detail||{};setReviveMessage(result.message||'');
 const button=$('reviveWithAdBtn');if(button)button.disabled=false;
 if(!result.ok)return;
 hp=maxHp;if(player)player.invuln=3;gameState='playing';$('gameOverScreen').hidden=true;$('hud').hidden=false;$('pauseBtn').hidden=false;setMobileGameActive(true);updateHud();last=performance.now();
});
function pendingRunPayload(){return {survival:elapsed,score,level,bossesKilled:bossKillsThisRun};}
function returnToMainMenu(){runResultPending=false;onlineMode=false;setMobileGameActive(false);setHudCollapsed(false);$('toggleHudBtn').hidden=true;document.body.classList.remove('game-active');gameState='menu';$('gameOverScreen').hidden=true;$('menuScreen').hidden=false;$('pauseBtn').hidden=true;}
$('playBtn').addEventListener('click',()=>{onlineMode=false;startGame()});
$('againBtn').addEventListener('click',()=>{
 const shouldRestartOnline = wasOnlineModeOnDeath;
 const proceedRestart = () => {
   runResultPending = false;
   if(shouldRestartOnline){
     onlineMode = true;
     $('gameOverScreen').hidden = true;
     if(window.AbyssalOnline?.isAuthenticated?.()){
       window.AbyssalOnline?.showRooms?.();
     }else{
       window.AbyssalOnline?.connectAndJoin?.();
     }
   }else{
     onlineMode = false;
     startGame();
   }
 };
 if(runResultPending&&window.AbyssalOnline?.isAuthenticated?.()&&window.AbyssalOnline?.finishRun){
  const sent=window.AbyssalOnline.finishRun(pendingRunPayload(),{leaveAfter:false,onComplete:()=>proceedRestart()});
  if(sent)return;
 }
 if(runResultPending&&!window.AbyssalOnline?.isAuthenticated?.()&&!onlineMode){coins+=Math.max(5,Math.floor(score/35)+level*2);saveCosmetics();renderShop();}
 proceedRestart();
});
$('menuBtn').addEventListener('click',()=>{
 if(runResultPending&&window.AbyssalOnline?.isAuthenticated?.()&&window.AbyssalOnline?.finishRun){
  const sent=window.AbyssalOnline.finishRun(pendingRunPayload(),{leaveAfter:onlineMode,onComplete:()=>returnToMainMenu()});
  if(sent)return;
 }
 if(runResultPending&&!window.AbyssalOnline?.isAuthenticated?.()&&!onlineMode){coins+=Math.max(5,Math.floor(score/35)+level*2);saveCosmetics();renderShop();}
 if(onlineMode)window.AbyssalOnline?.leaveWorld?.();
 returnToMainMenu();
});
$('pauseBtn').addEventListener('click',pauseGame);$('resumeBtn').addEventListener('click',resumeGame);$('quitBtn').addEventListener('click',()=>{if(onlineMode)window.AbyssalOnline?.leaveWorld();onlineMode=false;setMobileGameActive(false);gameState='menu';$('pauseScreen').hidden=true;$('hud').hidden=true;$('toggleHudBtn').hidden=true;setHudCollapsed(false);document.body.classList.remove('game-active');$('menuScreen').hidden=false;$('pauseBtn').hidden=true});
$('soundBtn').addEventListener('click',()=>{
  // O volume é ajustado apenas pela rolagem do slider; o clique apenas ativa o popup de volume sem mutar o jogo
  const popup=$('volumePopup');
  if(popup)popup.classList.toggle('active');
  if(!ambientNodes)startAmbientMusic();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&gameState==='playing'&&!onlineMode)pauseGame();if(!document.hidden)last=performance.now();});
window.addEventListener('resize',()=>{if(gameState==='playing'||(onlineMode&&gameState==='upgrade'))setMobileGameActive(true);else resize()});
window.addEventListener('abyssal-remote-shot',ev=>{const d=ev.detail;if(!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;
 const col=d.color||'#9bbcff',special=d.special||null;
 projectiles.push({x:d.x*W,y:d.y*H,vx:(d.vx||0)*W,vy:(d.vy||0)*H,r:(special==='pierce'?6.5:special==='electric'?5.8:5.2)/GAME_WORLD_ZOOM,life:1.05,damage:0,color:col,special,allyShot:true,remoteVisual:true,trailLife:.16});
 burst(d.x*W,d.y*H,col,5,75);
 if(projectiles.length>projectileBudget())projectiles.splice(0,projectiles.length-projectileBudget());
});
window.AbyssalGameHooks={
 getPlayerPosition:()=>onlineMode&&player&&gameState!=='menu'&&gameState!=='over'?{x:player.x,y:player.y,angle:player.angle||0}:null,
  setPlayerPosition:(x,y)=>{if(!player||!Number.isFinite(Number(x))||!Number.isFinite(Number(y)))return false;player.x=clamp(Number(x),8/GAME_WORLD_ZOOM,W-8/GAME_WORLD_ZOOM);player.y=clamp(Number(y),8/GAME_WORLD_ZOOM,H-8/GAME_WORLD_ZOOM);updateCamera();return true;},
 skinColor:()=>currentSkinColor(),
 viewportWidth:()=>viewW,
 viewportHeight:()=>viewH,
 worldWidth:()=>W,
 worldHeight:()=>H,
 worldZoom:()=>worldZoom,
 skinId:()=>equippedSkin,
 skinForId:id=>skinData.find(s=>s.id===id)||skinData[0],
 toast:message=>showToast(message),
 remoteHit:data=>{if(!player)return;const tx=data.x*W,ty=data.y*H;let nearest=null,bd=Infinity;for(const e of enemies){const d=Math.hypot(e.x-tx,e.y-ty);if(d<bd){bd=d;nearest=e}}if(nearest&&bd<100/GAME_WORLD_ZOOM){effects.push({type:'beam',x1:tx,y1:ty,x2:nearest.x,y2:nearest.y,life:.14,maxLife:.14,color:'#bba8ff'});burst(nearest.x,nearest.y,'#bba8ff',5,60);}},
 applySnapshot:applySharedSnapshot,
 applySpawn:applySharedSpawn,
 registerContactSnapshot:registerEnemyContactSnapshot,
 applyMotion:applySharedMotion,
  onlineMovementFallback:()=>onlineClientMovementFallback,
  motionDiagnostics:()=>({enemyCount:onlineVisualEnemyCount,movingEnemies:onlineVisualMovingEnemies,predictingLocally:false,stalledSnapshots:onlineMovementStalledSnapshots,confirmedSnapshots:onlineMovementConfirmedSnapshots,gameState}),
 restoreHostState:data=>{if(!data||!Array.isArray(data.enemies))return;enemies=data.enemies.map(e=>({...e,x:Number(e.x)||0,y:Number(e.y)||0,r:Math.max(2,Number(e.r)||12)/GAME_WORLD_ZOOM}));onlineEnemyById=new Map(enemies.map(e=>[String(e.id),e]));},
 sharedDamage:applySharedDamage,
 sharedXp:applySharedXp,
};
function renderCreaturePreview(canvas,kind,color,skin=null){
 if(!canvas)return;const c=canvas.getContext('2d');if(!c)return;const w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);const bg=c.createRadialGradient(w*.5,h*.45,2,w*.5,h*.5,Math.max(w,h)*.65);bg.addColorStop(0,'#102d40');bg.addColorStop(1,'#030913');c.fillStyle=bg;c.fillRect(0,0,w,h);c.save();c.strokeStyle='rgba(130,232,239,.16)';c.lineWidth=1;c.beginPath();c.ellipse(w*.5,h*.64,w*.3,h*.16,0,0,Math.PI*2);c.stroke();c.restore();const previewRadius=skin?.id==='kraken'?Math.min(w*.105,h*.17):Math.min(w*.145,h*.235);drawCreature(w*.5,h*.47,previewRadius,-.2,color,kind,performance.now(),!!skin,0,c,skin);}
function drawWheel(){
 const canvas=$('wheelCanvas');if(!canvas)return;const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,r=Math.min(w,h)*.43;const prizes=[20,50,100,300,600,1000],colors=['#1a7083','#513b9f','#1b8891','#a64b82','#b87335','#d3ac3d'];c.clearRect(0,0,w,h);c.save();c.translate(cx,cy);c.rotate(wheelAngle);for(let i=0;i<prizes.length;i++){const a=-Math.PI/2+i*Math.PI*2/prizes.length,b=a+Math.PI*2/prizes.length;c.beginPath();c.moveTo(0,0);c.arc(0,0,r,a,b);c.closePath();const grad=c.createRadialGradient(0,0,r*.05,0,0,r);grad.addColorStop(0,colors[i]);grad.addColorStop(1,i===5?'#f3d46b':'#071825');c.fillStyle=grad;c.fill();c.strokeStyle='rgba(231,255,255,.72)';c.lineWidth=2;c.stroke();c.save();c.rotate(a+Math.PI/prizes.length);c.textAlign='right';c.fillStyle='#f5ffff';c.shadowBlur=9;c.shadowColor=colors[i];c.font=`900 ${i===5?18:16}px Manrope, sans-serif`;c.fillText(`${prizes[i]}`,r*.83,6);c.font='700 9px Manrope,sans-serif';c.fillStyle='#c1f7f8';c.fillText('MOEDAS',r*.83,18);c.restore();}c.restore();c.save();c.translate(cx,cy);c.fillStyle='#e6fbff';c.shadowBlur=20;c.shadowColor='#69fff3';c.beginPath();c.arc(0,0,r*.22,0,Math.PI*2);c.fill();c.fillStyle='#081923';c.beginPath();c.arc(0,0,r*.145,0,Math.PI*2);c.fill();c.fillStyle='#9efff6';c.font='900 11px Manrope,sans-serif';c.textAlign='center';c.fillText('ABYSS',0,4);c.restore();c.save();c.translate(cx,cy-r+2);c.fillStyle='#fff1af';c.strokeStyle='#8b5c2a';c.lineWidth=2;c.shadowBlur=14;c.shadowColor='#ffc65e';c.beginPath();c.moveTo(-13,-17);c.lineTo(13,-17);c.lineTo(0,8);c.closePath();c.fill();c.stroke();c.restore();}
function animateWheelToPrize(reward,grant=true){
 const vals=[20,50,100,300,600,1000];const index=Math.max(0,vals.indexOf(Number(reward)));const canvas=$('wheelCanvas');wheelBusy=true;$('spinWheelBtn').disabled=true;$('testWheelBtn').disabled=true;const segment=Math.PI*2/vals.length;const desired=-(index+.5)*segment;const start=wheelAngle;const target=start+Math.PI*2*5+((desired-start%(Math.PI*2)+Math.PI*2)%(Math.PI*2));const begin=performance.now(),duration=3700;const spin=now=>{const p=clamp((now-begin)/duration,0,1),ease=1-Math.pow(1-p,4);wheelAngle=start+(target-start)*ease;drawWheel();if(p<1)requestAnimationFrame(spin);else{wheelBusy=false;$('spinWheelBtn').disabled=false;$('testWheelBtn').disabled=false;$('wheelMessage').textContent=grant?`VOCÊ GANHOU ${reward} MOEDAS ABISSAIS!`:`Prévia do giro: ${reward} moedas. Nenhuma moeda foi adicionada.`;if(grant){audio(790,.25,'triangle',.04);showToast(`ROLETA ABISSAL · +${reward} MOEDAS`);}else audio(480,.12,'sine',.02);}};requestAnimationFrame(spin);
}
function requestWheelSpin(){
 if(wheelBusy)return;
 if(!window.AbyssalOnline?.isAuthenticated()){$('wheelScreen').hidden=true;showToast('ENTRE NA CONTA PARA RECEBER RECOMPENSAS');window.AbyssalOnline?.openLogin();return;}
 if(typeof window.adBreak!=='function'){$('wheelMessage').textContent='Anúncios premiados ainda não estão ativos nesta versão. Use “Testar giro” para ver a animação sem ganhar moedas.';showToast('ANÚNCIO PREMIADO AINDA NÃO CONFIGURADO');return;}
 let requested=false;wheelBusy=true;$('spinWheelBtn').disabled=true;$('testWheelBtn').disabled=true;
 try{window.adBreak({type:'reward',name:'abyssal-wheel',beforeReward:showAd=>{if(typeof showAd==='function')showAd();},adViewed:()=>{if(requested)return;requested=true;window.AbyssalOnline.spinWheel();},adDismissed:()=>{wheelBusy=false;$('spinWheelBtn').disabled=false;$('testWheelBtn').disabled=false;$('wheelMessage').textContent='O anúncio foi fechado antes de concluir. Nenhuma recompensa foi entregue.';},afterAd:()=>{if(!requested){wheelBusy=false;$('spinWheelBtn').disabled=false;$('testWheelBtn').disabled=false;}}});}catch(e){wheelBusy=false;$('spinWheelBtn').disabled=false;$('testWheelBtn').disabled=false;$('wheelMessage').textContent='Não foi possível abrir o anúncio. Verifique a integração do AdSense H5.';}
}
function weightedWheelPrize(){const n=Math.random()*100;if(n<40)return 20;if(n<70)return 50;if(n<88)return 100;if(n<96)return 300;if(n<99.9)return 600;return 1000;}
 $('wheelBtn')?.addEventListener('click',()=>{$('wheelScreen').hidden=false;drawWheel();$('wheelMessage').textContent='Gire para ganhar moedas abissais!';});
$('wheelCloseBtn')?.addEventListener('click',()=>{$('wheelScreen').hidden=true});
$('wheelTopCloseBtn')?.addEventListener('click',()=>{$('wheelScreen').hidden=true});
$('spinWheelBtn')?.addEventListener('click',requestWheelSpin);
$('testWheelBtn')?.addEventListener('click',()=>{if(wheelBusy)return;animateWheelToPrize(weightedWheelPrize(),false);});
window.addEventListener('abyssal-wheel-result',ev=>{const d=ev.detail||{};if(d.ok){coins=Number(d.coins)||coins;saveCosmeticsLocalOnly();renderShop();animateWheelToPrize(Number(d.reward)||20,true);}else{wheelBusy=false;$('spinWheelBtn').disabled=false;$('testWheelBtn').disabled=false;$('wheelMessage').textContent=d.message||'Não foi possível girar agora.';}});
function applyWorldEnemyDamageBatch(items){if(!Array.isArray(items))return;for(const item of items)applyWorldEnemyDamage(item);}
function applyWorldEnemyDamage(data){
 if(!onlineMode||!data||data.id==null)return;
 const enemy=onlineEnemyById.get(String(data.id))||enemies.find(e=>String(e.id)===String(data.id));
 if(!enemy)return;
 if(Number.isFinite(Number(data.hp)))enemy.hp=clamp(Number(data.hp),0,Number(enemy.maxHp)||Number(data.maxHp)||Infinity);
 if(Number.isFinite(Number(data.maxHp)))enemy.maxHp=Number(data.maxHp);
 if(Number.isFinite(Number(data.damageRevision)))enemy.damageRevision=Math.max(Number(enemy.damageRevision)||0,Number(data.damageRevision));
 enemy.hit=.16;
}
window.addEventListener('abyssal-player-vitals',ev=>applyOnlinePlayerVitals(ev.detail));
window.addEventListener('abyssal-world-damaged',ev=>applyWorldEnemyDamage(ev.detail));
window.addEventListener('abyssal-world-damaged-batch',ev=>applyWorldEnemyDamageBatch(ev.detail));
window.addEventListener('abyssal-world-xp-orb-spawned',ev=>applySharedOrbSpawn(ev.detail));
window.addEventListener('abyssal-world-xp-orbs-spawned',ev=>{for(const orb of Array.isArray(ev.detail)?ev.detail:[])applySharedOrbSpawn(orb);});
window.addEventListener('abyssal-world-xp-orbs-expired',ev=>removeSharedOrbIds(ev.detail));
window.addEventListener('abyssal-world-xp-orb-collected',ev=>{const d=ev.detail||{};removeSharedOrbIds([d.orbId]);const x=Number(d.x),y=Number(d.y);if(Number.isFinite(x)&&Number.isFinite(y)){burst(x,y,'#b8a7ff',9,70);audio(680,.06,'sine',.012);}});
window.addEventListener('abyssal-world-damage-result',ev=>{const d=ev.detail||{};if(d.ok){applyWorldEnemyDamage(d);return;}const reason=String(d.reason||'');if(['not-in-room','not-connected','enemy-not-found','ack-timeout'].includes(reason))return;const now=performance.now();if(onlineMode&&now-lastDamageWarningAt>15000){lastDamageWarningAt=now;console.warn('[Abyssal] Dano online rejeitado:',reason);}});
window.addEventListener('abyssal-boss-warning',ev=>{const d=ev.detail||{};if(d.kind)showBossAlert(d.kind,d.id,d.threat);});
window.addEventListener('abyssal-world-defeated',ev=>{const e=ev.detail;if(!e)return;onlineEnemyById.delete(String(e.id));enemies=enemies.filter(enemy=>String(enemy.id)!==String(e.id));const bosses=BOSS_KINDS.includes(e.kind);if(bosses){bossKillsThisRun++;updateHud();showToast('ENTIDADE ABISSAL ELIMINADA · +100 MOEDAS');}const x=Number(e.x)||W*.5,y=Number(e.y)||H*.5;burst(x,y,e.color||'#8ffff4',bosses?(e.kind==='kraken'?38:30):10,bosses?225:85);audio(bosses?180:260,.08,'triangle',.025);});
window.addEventListener('abyssal-world-defeated-batch',ev=>{
 const defeated=Array.isArray(ev.detail)?ev.detail:[];if(!defeated.length)return;
 let bossCount=0;
 for(const enemy of defeated){
  if(!enemy||enemy.id==null)continue;
  onlineEnemyById.delete(String(enemy.id));enemies=enemies.filter(item=>String(item.id)!==String(enemy.id));
  const boss=BOSS_KINDS.includes(enemy.kind)||enemy.boss===true;
  if(boss){bossCount++;bossKillsThisRun++;}
  const x=Number(enemy.x)||W*.5,y=Number(enemy.y)||H*.5;
  burst(x,y,enemy.color||'#8ffff4',boss?(enemy.kind==='kraken'?8:7):2,boss?190:65);
 }
 if(bossCount)showToast(bossCount===1?'ENTIDADE ABISSAL ELIMINADA · +100 MOEDAS':`${bossCount} ENTIDADES ABISSAIS ELIMINADAS`);
 audio(bossCount?180:260,.08,'triangle',.025);updateHud();
});
function renderShop(){
 $('coinBalance').textContent=coins.toLocaleString(gameLanguage==='es'?'es-ES':gameLanguage==='en'?'en-US':'pt-BR');const grid=$('skinGrid');if(!grid)return;grid.innerHTML='';
 const currencySelect=$('shopCurrency');if(currencySelect){currencySelect.value=shopCurrency;currencySelect.hidden=false;}
 const english=gameLanguage==='en';
 const shopHeading=document.querySelector('.shop-heading h2');if(shopHeading)shopHeading.innerHTML=english?'ABYSSAL<br><em>RELICS</em>':'VESTÍGIOS<br><em>DO ABISMO</em>';
 const englishNames={violet:'Violet Wraith',leviathan:'Blind Leviathan',kraken:'Abyss Kraken',aberration:'Aberration Mask',angler:'Deadly Lantern',maw:'Rift Maw',devourer:'Void Devourer',reefshark:'Great White Shark',hammerhead:'Hammerhead Shark',abysscroc:'Black Caiman',armoredgator:'Nile Crocodile'};
 const englishDescriptions={reefshark:'A great white shark with a gray back, pale belly and crescent fins.',hammerhead:'A hammerhead with a broad cephalofoil and wide-set eyes.',abysscroc:'Broad snout, short legs, powerful tail and armored back of a black caiman.',armoredgator:'Pointed snout, rugged scales and dorsal armor inspired by the Nile crocodile.'};
 const englishAbilities={reefshark:'Pelagic slash: a short high-speed dash leaves a blue wake that damages enemies crossed.',hammerhead:'Electroreception: attract experience orbs from 50% farther away.',abysscroc:'Ambush bite: a low explosive lunge deals cone damage in front.',armoredgator:'Nile roll: a tail spin knocks nearby enemies back with a shockwave.'};
 skinData.forEach(skin=>{const owned=ownedSkins.includes(skin.id)&&(!skin.paid||window.AbyssalOnline?.isAuthenticated()),equipped=equippedSkin===skin.id,currencySymbol=shopCurrency.toUpperCase(),bossIds=['leviathan','kraken','aberration','angler','maw','devourer'],predatorIds=['reefshark','hammerhead','abysscroc','armoredgator'],brlAmount=skin.id==='violet'?100:(bossIds.includes(skin.id)?999:(predatorIds.includes(skin.id)?499:skin.price)),amount=shopCurrency==='brl'?brlAmount:Math.round(brlAmount*Number(shopRates[shopCurrency]||0)),price=skin.paid?(shopCurrency==='brl'||Number.isFinite(shopRates[shopCurrency])?new Intl.NumberFormat(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR',{style:'currency',currency:shopCurrency.toUpperCase()}).format(amount/100):(english?'Rate unavailable':'Cotação indisponível')):`${skin.price.toLocaleString(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR')} ◈`,name=english?(englishNames[skin.id]||skin.name):skin.name;
    const isGreensnake = skin.id === 'greensnake';
    const isEel = skin.id === 'electriceel';
    const eelOwned = ownedSkins.includes('electriceel');
    const conquerorCompleted = ownedSkins.includes('greensnake');
const card=document.createElement('div');card.className='skin-card'+(equipped?' equipped':'');card.innerHTML=`<div class="skin-preview"><canvas class="skin-preview-canvas" width="160" height="92" aria-label="${english?'Preview':'Prévia'} ${name}"></canvas></div><strong>${name}</strong><p>${english?(englishDescriptions[skin.id]||skin.desc):skin.desc}</p><p class="skin-ability"><b>${english?'ABILITY':'HABILIDADE'}</b> ${english?(englishAbilities[skin.id]||skin.ability||'A rare adaptation of the deep.'):skin.ability||'Uma adaptação rara das profundezas.'}</p><button ${equipped?'disabled':''}>${equipped?(english?'EQUIPPED':'EQUIPADA'):owned?(english?'EQUIP':'EQUIPAR'):skin.paid?`${english?'BUY':'COMPRAR'} · ${price}`:`${english?'BUY':'COMPRAR'} · ${skin.price.toLocaleString(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR')} ◈`}</button>`;renderCreaturePreview(card.querySelector('canvas'),'player',skin.color,skin);const btn=card.querySelector('button');if(!equipped)btn.addEventListener('click',()=>{if(isGreensnake&&!conquerorCompleted){showToast('BLOQUEADA · Conquiste o abismo em 100% para desbloquear esta skin!');return;}if(isEel&&!eelOwned){showToast('BLOQUEADA · Use o código promocional no menu para desbloquear!');return;}if(owned){equippedSkin=skin.id;saveCosmetics();renderShop();showToast(english?'SKIN EQUIPPED':'SKIN EQUIPADA');}else if(skin.paid){openSkinPurchaseConfirm(skin.id,name,price,false);}else if(window.AbyssalOnline?.isAuthenticated()){window.AbyssalOnline.purchaseSkin(skin.id)}else if(coins>=skin.price){coins-=skin.price;ownedSkins.push(skin.id);equippedSkin=skin.id;saveCosmetics();renderShop();addNotification('🐚 ' + skin.name + ' desbloqueada! Adquirida com ' + skin.price.toLocaleString('pt-BR') + ' moedas abissais na Loja. Equipe-a pelo Catálogo.', 'NOVA SKIN · LOJA ABISSAL', 'skin');
        updateNotifBadge(); updateNotifBadge();showToast(english?'SKIN UNLOCKED':'SKIN DESBLOQUEADA');audio(760,.12,'triangle',.03)}else showToast(english?'NOT ENOUGH ABYSSAL COINS':'MOEDAS ABISSAIS INSUFICIENTES');});grid.appendChild(card)});
 const bundle=document.createElement('article');bundle.className='skin-card boss-bundle-card';const bundleIds=['leviathan','kraken','aberration','angler','maw','devourer'];const remaining=bundleIds.filter(id=>!ownedSkins.includes(id)).length;const bundleBrlAmount=remaining===6?4999:999*remaining;const bundleAmount=shopCurrency==='brl'?bundleBrlAmount:Math.round(bundleBrlAmount*Number(shopRates[shopCurrency]||0));const bundleNames={leviathan:'Leviatã Cego',kraken:'Kraken do Abismo',aberration:'Máscara da Aberração',angler:'Lanterna Mortal',maw:'Mandíbula da Fenda',devourer:'Devorador do Vazio'};bundle.innerHTML=`<div class="boss-bundle-aura" aria-hidden="true">✦</div><strong>Pacote dos seis bosses</strong><p>Uma coleção abissal com artefatos vivos e animação exclusiva.</p><ul class="boss-bundle-list">${bundleIds.map(id=>`<li>${ownedSkins.includes(id)?'✓':'✧'} ${bundleNames[id]}${ownedSkins.includes(id)?' · ADQUIRIDA':''}</li>`).join('')}</ul><p class="boss-bundle-count">${remaining} de 6 skins restantes · ${remaining===6?'DESCONTO DO PACOTE COMPLETO':'preço individual das skins restantes'}</p><button ${remaining===0?'disabled':''}>${remaining===0?'CONTEÚDO COMPLETO':`${english?'BUY BUNDLE':'COMPRAR PACOTE'} · ${(shopCurrency==='brl'||Number.isFinite(shopRates[shopCurrency])?new Intl.NumberFormat(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR',{style:'currency',currency:shopCurrency.toUpperCase()}).format(bundleAmount/100):(english?'Rate unavailable':'Cotação indisponível'))}`}</button>`;bundle.querySelector('button').addEventListener('click',()=>{if(remaining)openSkinPurchaseConfirm('boss_bundle','Pacote dos Seis Bosses',`${(shopCurrency==='brl'||Number.isFinite(shopRates[shopCurrency])?new Intl.NumberFormat(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR',{style:'currency',currency:shopCurrency.toUpperCase()}).format(bundleAmount/100):(english?'Rate unavailable':'Cotação indisponível'))}`,true);});grid.appendChild(bundle);
 const metaGrid=$('metaUpgradeGrid');if(metaGrid){metaGrid.innerHTML='';metaShopItems.forEach(item=>{const levelNow=Number(metaUpgrades[item.id])||0,ownedMax=levelNow>=item.max,activeEquipped=loadEquippedActiveSkills().includes(item.id);const activeOwned=item.type==='active'&&levelNow>0;const card=document.createElement('article');card.className='meta-card'+(ownedMax?' meta-max':'');const buttonLabel=activeOwned?(activeEquipped?'DESEQUIPAR':'EQUIPAR'):ownedMax?'NÍVEL MÁXIMO':`ADQUIRIR · ${item.price.toLocaleString('pt-BR')} ◈`;card.innerHTML=`<div class="meta-card-icon">${item.icon}</div><div class="meta-card-copy"><div class="meta-kicker">${item.type==='active'?'HABILIDADE ATIVA':'MELHORIA PASSIVA'} · NV. ${levelNow}/${item.max}</div><strong>${item.name}</strong><p>${item.desc}</p></div><button ${ownedMax&&!activeOwned?'disabled':''}>${buttonLabel}</button>`;const button=card.querySelector('button');if(activeOwned){button.addEventListener('click',()=>toggleEquippedActiveSkill(item.id));}else if(!ownedMax){button.addEventListener('click',()=>buyMetaUpgrade(item.id));}metaGrid.appendChild(card);});}
 updateAbilityButtons();drawWheel();
}
$('shopBtn').addEventListener('click',()=>{$('shopScreen').hidden=false;renderShop()});
$('shopCurrency')?.addEventListener('change',event=>{event.target.value='brl';shopCurrency='brl';renderShop()});
$('languageSelect')?.addEventListener('change',event=>setGameLanguage(event.target.value));
if($('languageSelect'))$('languageSelect').value=gameLanguage;

let pendingStripePurchase = null;
function openSkinPurchaseConfirm(skin, name, priceFormatted, isBundle = false) {
  const modal = $('skinPurchaseConfirmModal');
  if (!modal) {
    window.AbyssalOnline?.purchaseStripe(skin.id,shopCurrency,gameLanguage);
    return;
  }
  const skinId = typeof skin === 'string' ? skin : skin?.id;
  pendingStripePurchase = { skin: { id: skinId, name }, name, priceFormatted, isBundle };
  const desc = $('skinPurchaseConfirmDesc');
  if (desc) {
    desc.textContent = `Você está prestes a adquirir ${name || 'este cosmético'} por ${priceFormatted || ''}. Esta transação será realizada em ambiente seguro da Stripe e adicionará o cosmético permanentemente à sua conta.`;
  }
  const check1 = $('skinBuyCheck1'), check2 = $('skinBuyCheck2'), confirmBtn = $('skinPurchaseConfirmBtn');
  if (check1) check1.checked = false;
  if (check2) check2.checked = false;
  if (confirmBtn) confirmBtn.disabled = true;
  modal.hidden = false;
}
function closeSkinPurchaseConfirm() {
  const modal = $('skinPurchaseConfirmModal');
  if (modal) modal.hidden = true;
  pendingStripePurchase = null;
}
function updateSkinPurchaseBtn() {
  const check1 = $('skinBuyCheck1'), check2 = $('skinBuyCheck2'), confirmBtn = $('skinPurchaseConfirmBtn');
  if (confirmBtn) confirmBtn.disabled = !(check1?.checked && check2?.checked);
}
$('skinBuyCheck1')?.addEventListener('change', updateSkinPurchaseBtn);
$('skinBuyCheck2')?.addEventListener('change', updateSkinPurchaseBtn);
$('skinPurchaseTopCloseBtn')?.addEventListener('click', closeSkinPurchaseConfirm);
$('skinPurchaseCancelBtn')?.addEventListener('click', closeSkinPurchaseConfirm);
$('skinPurchaseConfirmBtn')?.addEventListener('click', () => {
  const check1 = $('skinBuyCheck1'), check2 = $('skinBuyCheck2');
  if (!check1?.checked || !check2?.checked) return;
  const target = pendingStripePurchase;
  closeSkinPurchaseConfirm();
  if (target?.skin) {
    const skin = target.skin;
    window.AbyssalOnline?.purchaseStripe(skin.id,shopCurrency,gameLanguage);
  }
});
$('skinPurchaseConfirmModal')?.addEventListener('click', (e) => {
  if (e.target === $('skinPurchaseConfirmModal')) closeSkinPurchaseConfirm();
});

window.addEventListener('abyssal-payment-result',event=>{if(!event.detail?.ok)showToast(event.detail?.message||'PAGAMENTO INDISPONÍVEL');});
const redeemCodeBtn=$('redeemCodeBtn');
function openRedeemCodeModal(){const modal=$('redeemCodeScreen');if(!modal)return;modal.hidden=false;const input=$('redeemCodeInput'),message=$('redeemCodeMessage');if(input){input.disabled=false;input.value='';}if(redeemCodeBtn)redeemCodeBtn.disabled=false;if(message)message.textContent='';requestAnimationFrame(()=>input?.focus());}
function closeRedeemCodeModal(){const modal=$('redeemCodeScreen');if(modal)modal.hidden=true;}
$('openRedeemCodeBtn')?.addEventListener('click',openRedeemCodeModal);
$('redeemCodeCloseBtn')?.addEventListener('click',closeRedeemCodeModal);
$('redeemCodeBackBtn')?.addEventListener('click',closeRedeemCodeModal);
$('redeemCodeScreen')?.addEventListener('click',event=>{if(event.target===$('redeemCodeScreen'))closeRedeemCodeModal();});
window.addEventListener('abyssal-code-redeem-result',event=>{const result=event.detail||{},message=$('redeemCodeMessage'),input=$('redeemCodeInput');if(!message)return;if(result.ok){
  if(result.skinId && !ownedSkins.includes(result.skinId)){
    ownedSkins.push(result.skinId);
    equippedSkin=result.skinId;
  }
  if(result.coinsAwarded){
    coins += Number(result.coinsAwarded);
  }
  saveCosmeticsLocalOnly();
  message.textContent=result.message||'CÓDIGO RESGATADO!';
  addNotification(result.message||'Código promocional resgatado na sua conta online!', 'RESGATE CONFIRMADO ⚡', 'promo');
  if(input){input.value='';input.disabled=true;}
  if(redeemCodeBtn)redeemCodeBtn.disabled=true;
  audio(880,.18,'triangle',.035);
  renderShop();
}else{message.textContent=result.message||'Não foi possível resgatar o código.';}});
function redeemAbyssalCode(){
 const input=$('redeemCodeInput'),message=$('redeemCodeMessage'),code=String(input?.value||'').trim().toLowerCase();
 if(!message||!input)return;
 if(!code){message.textContent='DIGITE UM CÓDIGO PARA RESGATAR.';input.focus();return;}if(code!=='bemvindoabyssal'&&code!=='abyssal10k'&&code!=='vi-o-nascimento-abyssal'){message.textContent='CÓDIGO INVÁLIDO. Confira e tente novamente.';input.focus();return;}
 if(window.AbyssalOnline?.isAuthenticated()){window.AbyssalOnline.redeemCode(code);return;}
 let redeemed=[];try{const stored=JSON.parse(localStorage.getItem('abyssalRedeemedCodes')||'[]');if(Array.isArray(stored))redeemed=stored;}catch(_){}
 if(redeemed.includes(code)){message.textContent='ESTE CÓDIGO JÁ FOI RESGATADO NESTE PERFIL.';return;}
 if(code==='vi-o-nascimento-abyssal'){
  coins+=60000;
  if(!ownedSkins.includes('electriceel')) ownedSkins.push('electriceel');
  equippedSkin='electriceel';
  redeemed.push(code);
  localStorage.setItem('abyssalRedeemedCodes',JSON.stringify(redeemed));
  saveCosmetics();
  message.textContent='CÓDIGO SUPREMO RESGATADO! +60.000 MOEDAS E SKIN ENGUIA ELÉTRICA!';
  addNotification('Você resgatou o código histórico "vi-o-nascimento-abyssal"! +60.000 moedas e a skin exclusiva "Enguia Elétrica" foram adicionadas à sua conta.', 'RESGATE PROMOCIONAL HISTÓRICO ⚡', 'promo');
 } else {
  coins+=10000;
  redeemed.push(code);
  localStorage.setItem('abyssalRedeemedCodes',JSON.stringify(redeemed));
  saveCosmetics();
  message.textContent='CÓDIGO RESGATADO! +10.000 MOEDAS ABISSAIS.';
  addNotification('Código promocional resgatado! +10.000 moedas abissais adicionadas.', 'RESGATE CONCLUÍDO ✦', 'promo');
 }
 input.value='';input.disabled=true;if(redeemCodeBtn)redeemCodeBtn.disabled=true;audio(880,.18,'triangle',.035);renderShop();
}
if(redeemCodeBtn)redeemCodeBtn.addEventListener('click',redeemAbyssalCode);
$('redeemCodeInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();redeemAbyssalCode();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('redeemCodeScreen')?.hidden)closeRedeemCodeModal();});

$('skillPulseBtn')?.addEventListener('click',()=>activateAbility('pulse'));$('skillDashBtn')?.addEventListener('click',()=>activateAbility('dash'));
const catalogBtn=$('catalogBtn');if(catalogBtn)catalogBtn.addEventListener('click',renderCatalog);const rankingsBtn=$('rankingsBtn');if(rankingsBtn)rankingsBtn.addEventListener('click',()=>{const el=$('rankingsScreen');if(el)el.hidden=false;if(window.AbyssalOnline?.loadRankings)window.AbyssalOnline.loadRankings()});const catalogClose=$('catalogCloseBtn');if(catalogClose)catalogClose.addEventListener('click',()=>{$('catalogScreen').hidden=true});const rankingsClose=$('rankingsCloseBtn');if(rankingsClose)rankingsClose.addEventListener('click',()=>{$('rankingsScreen').hidden=true});
function renderCatalog(){
 const el=$('catalogScreen'),grid=$('catalogGrid');if(!el||!grid)return;el.hidden=false;
 const codex=getAbyssalCodex();
 const monsterData={
  drifter:{name:'Errante Luminescente',color:'#ff769d',hp:22,speed:51,damage:8,ability:'Emissão Bio-Ondulatória: grupos sincronizados que avançam em ondas luminescentes.',desc:'Ctenóforo translúcido que avança em cardumes rítmicos pelas fossas externas.'},
  stinger:{name:'Ferrão de Fenda',color:'#ffbc78',hp:13,speed:125,damage:7,ability:'Arremetida Hipodérmica: velocidade extrema em linha reta com ferrão penetrante.',desc:'Peixe-ferrão veloz de corpo esguio e dentes agulhados que caça em bando.'},
  brute:{name:'Bruto de Placas',color:'#bd88ff',hp:65,speed:30,damage:15,ability:'Blindagem Bêntica: carapaça espessa que absorve projéteis e isola passagens.',desc:'Isópode titânico com placas sobrepostas impenetráveis e patas blindadas.'},
  lurker:{name:'Predador Sombrio',color:'#6e8dff',hp:100,speed:43,damage:18,ability:'Faringe Expansiva: mandíbula que dilata e perseguição incansável nas trevas.',desc:'Enguia gulper predatória que persegue sua presa sem recuar.'},
  whiteShark:{name:'Tubarão-branco',color:'#91c4ce',hp:300,speed:240,damage:28,ability:'Investida Imparável: move-se SOMENTE por arrancadas em linha reta que só param ao atingir a parede, então vira na direção do jogador e investe novamente.',desc:'O ápice dos caçadores pelágicos. Não para, não recua. Cada investida é calculada e letal.'},
  boss:{name:'Aberração Abissal',color:'#ff315f',hp:2820,speed:52,damage:25,ability:'Ganchos Cefalópodes: tentáculos curvados e máscara óssea que repelem mergulhadores.',desc:'Entidade coroada por placas calcificadas e braços farpados que esmagam quem se aproxima.'},
  angler:{name:'Lanterna Mortal',color:'#ffb45e',hp:3260,speed:66,damage:28,ability:'Isca Bioluminescente: atrai com brilho hipnótico antes de fechar mandíbulas de agulha.',desc:'Predador arcaico com lanterna incandescente e dentes voltados para dentro.'},
  maw:{name:'A Boca do Abismo',color:'#c16cff',hp:3750,speed:58,damage:31,ability:'Fome Circular: anel contínuo de dentes radiais que devora correntes inteiras.',desc:'Criatura anelar voraz cujo corpo inteiro é uma garganta predatória viva.'},
  leviathan:{name:'Leviatã das Fossas',color:'#4ce0d1',hp:4700,speed:44,damage:34,ability:'Domínio de Trincheira: espinhas dorsais monumentais que bloqueiam rotas de fuga.',desc:'Serpente colóssal com costelas externas que atravessa as fendas mais profundas.'},
  whiteSharkBoss:{name:'Tubarão-branco Colossal',color:'#68a8b8',hp:6000,speed:290,damage:45,ability:'Frenesi Colossal Imparável: investidas em linha reta à velocidade de 290 · só para ao colidir com a parede · vira e investe novamente sem parar.',desc:'A lenda das trincheiras abissais. Mais rápido que qualquer outra criatura. Cada investida abala o oceano.'},
  kraken:{name:'Kraken do Abismo',color:'#8b5cf6',hp:9200,speed:20,damage:38,ability:'Varredura Tentacular Óctupla: oito tentáculos afiados que cortam em espiral.',desc:'Senhor primordial das fossas oceânicas cujos tentáculos envolvem a escuridão.'},
  devourer:{name:'Devorador do Vazio',color:'#39d8c4',hp:15000,speed:14,damage:42,ability:'Vórtice de Sucção Residual: suga tudo ao redor em um raio colossal a cada 20 segundos.',desc:'Entidade que distorce as correntes abissais engolindo cardumes e mergulhadores inteiros.'}
 };
 const skillCopy={power:'Aumenta o dano de cada projétil.',rate:'Reduz o intervalo entre disparos automáticos.',speed:'Aumenta a velocidade de movimento.',range:'Amplia o alcance dos tiros e das ondas.',magnet:'Atrai fragmentos de experiência de mais longe no modo solo.',regen:'Recupera vitalidade gradualmente.',shield:'Adiciona cargas que absorvem impactos.',burst:'Libera periodicamente uma onda de energia ao redor do jogador.',electric:'Faz os tiros encadearem arcos elétricos em inimigos próximos.',pierce:'Permite atravessar uma criatura adicional por nível, sem multiplicar o dano.',ricochet:'Faz arcos de energia saltarem para alvos próximos.',nova:'Libera periodicamente uma explosão circular de grande alcance.'};
 
 const renderMonster=([k,m])=>{
  const known=codex.monsters.includes(k);
  const hpBadge = `<span class="stat-badge stat-hp" title="Vitalidade Máxima"><svg viewBox="0 0 24 24" class="stat-icon" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> <b>${m.hp.toLocaleString('pt-BR')}</b> HP</span>`;
  const dmgBadge = `<span class="stat-badge stat-dmg" title="Dano ao Jogador"><svg viewBox="0 0 24 24" class="stat-icon" fill="currentColor"><path d="M14.5 2.5l7 7-14 14H3v-4.5l11.5-11.5zm3.5 3.5l-2-2-10 10V16h2l10-10z"/></svg> <b>${m.damage}</b> DANO</span>`;
   const spdBadge = `<span class="stat-badge stat-spd" title="Velocidade de Deslocamento"><svg viewBox="0 0 24 24" class="stat-icon" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg> <b>${m.speed}</b> VELOCIDADE</span>`;
  const abilityBox = `<div class="codex-ability-box"><span class="codex-ability-tag">HABILIDADE</span> <span class="codex-ability-text">${escapeHtml(m.ability)}</span></div>`;
  
  return `<article class="codex-card monster-codex-card ${known?'unlocked':'locked'}">
   <div class="codex-preview monster-preview" style="--preview:${m.color}">
     <canvas width="180" height="112" data-monster-preview="${k}" aria-label="Prévia real de ${known?m.name:'uma criatura não identificada'}"></canvas>
   </div>
   <div class="codex-header-row">
     <b>${known?m.name:'Forma não identificada'}</b>
     ${known ? `<div class="monster-stats-row">${hpBadge}${dmgBadge}${spdBadge}</div>` : ''}
   </div>
   <p>${known?m.desc:'Registro incompleto. Observe esta criatura durante uma expedição para decifrar sua identidade e comportamento.'}</p>
   ${known ? abilityBox : ''}
  </article>`;
 };

 const comboHtml=Object.values(COMBO_SKILLS).map(combo=>{const recipe=combo.id==='gravitationalRupture'?'Nova gravitacional Nv. 3 + Pulso de Ruptura Nv. 3':'Tempestade Elétrica Nv. 3 + Ricochete Caótico Nv. 3';return `<article class="codex-card combo-codex-card special unlocked"><div class="combo-rarity">✦ FUSÃO ESPECIAL</div><div class="codex-preview skill-preview combo-preview" style="--preview:${combo.id==='arcChain'?'#75f3ff':'#c5a0ff'}">${combo.icon}</div><b>${combo.name}</b><p>${combo.desc}</p><small class="combo-recipe">COMBINAÇÃO · ${recipe}</small></article>`}).join('');
 const skillsHtml=upgradeList.map(u=>{const known=codex.skills.includes(u.id);return `<article class="codex-card ${known?'unlocked':'locked'}"><div class="codex-preview skill-preview" style="--preview:${known?'#9cecff':'#263747'}">${known?u.icon:'?'}</div><b>${known?u.name:'Ressonância desconhecida'}</b><p>${known?(skillCopy[u.id]||u.desc):'Descubra esta habilidade durante um mergulho para revelar seus efeitos.'}</p></article>`}).join('');
 const entries=Object.entries(monsterData),common=entries.filter(([k])=>!BOSS_KINDS.includes(k)),bosses=entries.filter(([k])=>BOSS_KINDS.includes(k));
 grid.innerHTML='<h3 class="codex-heading special-codex-heading">✦ FUSÕES ESPECIAIS · RARIDADE ABISSAL</h3><div class="codex-grid combo-codex-grid">'+comboHtml+'</div><h3 class="codex-heading">✦ HABILIDADES DESCOBERTAS</h3><div class="codex-grid">'+skillsHtml+'</div><h3 class="codex-heading">◈ FAUNA DAS CAMADAS EXTERNAS</h3><div class="codex-grid">'+common.map(renderMonster).join('')+'</div><h3 class="codex-heading">☠ ENTIDADES COLOSSAIS · FOSSAS ABISSAIS</h3><div class="codex-grid">'+bosses.map(renderMonster).join('')+'</div>';
 grid.querySelectorAll('canvas[data-monster-preview]').forEach(canvas=>{const kind=canvas.dataset.monsterPreview,m=monsterData[kind];renderCreaturePreview(canvas,kind,m.color,null);});
}

$('shopCloseBtn').addEventListener('click',()=>{$('shopScreen').hidden=true});
$('shopTopCloseBtn')?.addEventListener('click',()=>{$('shopScreen').hidden=true});
$('loginBtn').addEventListener('click',()=>{if(window.AbyssalOnline)window.AbyssalOnline.openLogin()});
$('onlineBtn').addEventListener('click',()=>{startAmbientMusic();onlineMode=true;if(window.AbyssalOnline?.isAuthenticated())window.AbyssalOnline.showRooms();else window.AbyssalOnline?.connectAndJoin()});
window.addEventListener('abyssal-authenticated',()=>{if(window.AbyssalOnlinePendingStart){window.AbyssalOnlinePendingStart=false;$('loginScreen').hidden=true;onlineMode=true;window.AbyssalOnline?.showRooms()}});
window.addEventListener('abyssal-boss-warning',ev=>{const d=ev.detail||{};showBossAlert(d.kind,d.id,d.threat);});
window.addEventListener('abyssal-room-joined',ev=>{onlineMode=true;$('roomsScreen').hidden=true;$('menuScreen').hidden=true;startGame();if(player)player.invuln=Math.max(player.invuln,5);window.AbyssalOnline?.sendProtection?.(5,'room-join');const d=ev.detail||{};if(d.spawn)window.AbyssalGameHooks?.setPlayerPosition?.(d.spawn.x,d.spawn.y);if(d.snapshot)window.AbyssalGameHooks?.applySnapshot(d.snapshot);const badge=$('roomBadge');if(badge){badge.textContent=`⌁ ${d.room?.id||''}`;badge.dataset.roomCode=d.room?.id||'';badge.hidden=false;}showToast(`MERGULHAR ONLINE · ${d.room?.name||'SALA ABISSAL'}`)});
window.addEventListener('abyssal-room-created',ev=>{const d=ev.detail||{};const m=$('roomsMessage');if(m)m.textContent=d.ok?`Sala criada! Código para convidar amigos: ${d.room?.id||''}. Você será conectado agora.`:(d.message||'Não foi possível criar a sala.');});
window.addEventListener('abyssal-online-disconnected',()=>{onlineDamageQueue.length=0;});
window.addEventListener('abyssal-room-left',()=>{onlineDamageQueue.length=0;const badge=$('roomBadge');if(badge)badge.hidden=true;setMobileGameActive(false)});
const roomBadge=$('roomBadge');if(roomBadge)roomBadge.addEventListener('click',async()=>{const code=roomBadge.dataset.roomCode||'';try{await navigator.clipboard.writeText(code);showToast(`CÓDIGO ${code} COPIADO`)}catch{showToast(`CÓDIGO DA SALA: ${code}`)}});
$('roomsCloseBtn')?.addEventListener('click',()=>{$('roomsScreen').hidden=true;onlineMode=false});
$('refreshRoomsBtn')?.addEventListener('click',()=>window.AbyssalOnline?.requestRooms());
$('roomPrivateCheck')?.addEventListener('change',e=>{$('roomPasswordField').hidden=!e.target.checked});
$('createRoomBtn')?.addEventListener('click',()=>window.AbyssalOnline?.createRoom({name:$('roomNameInput').value,capacity:Number($('roomCapacityInput').value),isPrivate:$('roomPrivateCheck').checked,password:$('roomPasswordInput').value}));
$('joinRoomCodeBtn')?.addEventListener('click',()=>window.AbyssalOnline?.joinRoom($('roomCodeInput').value,$('roomJoinPasswordInput').value));
window.addEventListener('abyssal-rooms-list',ev=>renderRoomList(ev.detail||[]));
window.addEventListener('abyssal-room-action-error',ev=>{const m=$('roomsMessage');if(m)m.textContent=ev.detail?.message||'Não foi possível realizar essa ação.';});
function renderRoomList(rooms){const root=$('roomsList');if(!root)return;let list=Array.isArray(rooms)?rooms:[];if(!list.length)list=[{id:'MAR-ABERTO',name:'Mar Aberto',playerCount:0,capacity:6,isPrivate:false,fallback:true,joinable:true}];root.innerHTML=list.map(r=>{const full=(Number(r.playerCount)||0)>=(Number(r.capacity)||6),privateRoom=Boolean(r.isPrivate),remote=r.joinable===false,label=privateRoom?'PRIVADA · SENHA':(r.id==='MAR-ABERTO'?'SALA PÚBLICA PADRÃO':'PÚBLICA'),buttonDisabled=full||remote,buttonText=full?'LOTADA':remote?'OUTRA INSTÂNCIA':privateRoom?'SENHA':'ENTRAR';return `<article class="room-row${privateRoom?' room-row-private':''}"><div><b>${privateRoom?'🔒 ':''}${escapeHtml(r.name||'Sala Abissal')}</b><small>${Number(r.playerCount)||0}/${Number(r.capacity)||6} mergulhadores · ${label}${Number.isFinite(Number(r.elapsed))&&Number(r.elapsed)>0?' · '+fmtTime(Number(r.elapsed)):''}</small></div><button type="button" class="room-join-btn" data-room-id="${escapeHtml(r.id)}" data-private="${privateRoom?'1':'0'}" data-joinable="${remote?'0':'1'}" ${buttonDisabled?'disabled':''}>${buttonText}</button></article>`}).join('');root.querySelectorAll('[data-room-id]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.roomId;const code=$('roomCodeInput'),password=$('roomJoinPasswordInput'),section=root.closest('.room-modal')?.querySelector('.room-join-code'),msg=$('roomsMessage');if(code)code.value=id;if(btn.dataset.joinable==='0'){if(msg)msg.textContent='Esta expedição está registrada, mas pertence a outro processo do servidor e não pode ser conectada por esta instância.';return;}if(btn.dataset.private==='1'){if(msg)msg.textContent='EXPEDIÇÃO SELADA. Informe a senha para romper o lacre e entrar.';section?.scrollIntoView({behavior:'smooth',block:'nearest'});password?.focus();return;}window.AbyssalOnline?.joinRoom(id,'');}));}

$('loginCancelBtn').addEventListener('click',()=>{$('loginScreen').hidden=true});
window.addEventListener('abyssal-run-saved',ev=>{const r=ev.detail||{};if(!r.ok)return;const status=$('saveStatus');if(status)status.textContent=`MERGULHO REGISTRADO · ${Number(r.bossesKilled)||0} BOSSES · +${Number(r.totalRunCoins??((Number(r.earned)||0)+(Number(r.bossCoins)||0)))||0} MOEDAS NA EXPEDIÇÃO`;if(r.rankings)window.dispatchEvent(new CustomEvent('abyssal-rankings-refreshed',{detail:r.rankings}));});
window.addEventListener('abyssal-account-data',e=>{const a=e.detail;if(!a)return;coins=Number(a.coins)||0;ownedSkins=Array.isArray(a.ownedSkins)?a.ownedSkins:['default'];equippedSkin=a.equippedSkin||'default';metaUpgrades=typeof a.metaUpgrades==='object'&&a.metaUpgrades?a.metaUpgrades:metaUpgrades;saveCosmeticsLocalOnly();renderShop();updateAbilityButtons();});
window.addEventListener('abyssal-purchase-result',e=>{
  const r=e.detail||{};
  showToast(r.message||'Compra processada');
  if(r.ok&&r.itemId){
    playSkillSound(r.itemId,'learn');
    if(!ownedSkins.includes(r.itemId)){
      ownedSkins.push(r.itemId);
      saveCosmetics();
    }
    const skinName = (SHOP_SKINS && SHOP_SKINS.find(s=>s.id===r.itemId)?.name) || r.itemId;
    addNotification('🐚 ' + skinName + ' desbloqueada com sucesso na sua conta! Equipe-a pelo Catálogo a qualquer momento.', 'NOVA SKIN · CONTA ONLINE', 'skin');
    updateNotifBadge();
  } else if(r.ok) {
    audio(760,.15,'triangle',.035);
  }
});
function saveCosmeticsLocalOnly(){localStorage.setItem('abyssalCoins',String(coins));localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));localStorage.setItem('abyssalMetaUpgrades',JSON.stringify(metaUpgrades));}
renderShop();
document.querySelectorAll('#menuScreen canvas[data-menu-creature]').forEach(canvas=>{
  const kind=canvas.dataset.menuCreature, color=canvas.dataset.menuColor||'#79f3f0';
  renderCreaturePreview(canvas,kind,color,null);
});

initNotifSystem();initVolumeControls();resize();gameState='menu';requestAnimationFrame(loop);

const endDiveButton=document.createElement('button');endDiveButton.id='endDiveBtn';endDiveButton.type='button';endDiveButton.textContent='ENCERRAR MERGULHO';endDiveButton.style.cssText='position:absolute;right:18px;top:72px;z-index:8;border:1px solid rgba(255,130,160,.55);border-radius:8px;padding:8px 10px;background:rgba(30,10,25,.78);color:#ffd6e0;font:600 10px Manrope,system-ui;letter-spacing:.08em;cursor:pointer;display:none';document.getElementById('gameShell').appendChild(endDiveButton);
endDiveButton.addEventListener('click',()=>{
 const wasOnline=onlineMode,authenticated=Boolean(window.AbyssalOnline?.isAuthenticated?.());
 const returnToMenu=(result)=>{onlineMode=false;setMobileGameActive(false);gameState='menu';$('hud').hidden=true;$('pauseBtn').hidden=true;$('upgradeScreen').hidden=true;$('pauseScreen').hidden=true;$('gameOverScreen').hidden=true;$('menuScreen').hidden=false;endDiveButton.style.display='none';const earned=Number(result?.earned)||0;const kills=Number(result?.bossesKilled??bossKillsThisRun)||0;const total=Number(result?.totalRunCoins??(earned+(Number(result?.bossCoins)||0)))||0;showToast(`MERGULHO ENCERRADO · ${kills} BOSS(ES) · +${total} MOEDAS NA EXPEDIÇÃO`);};
 if(authenticated&&window.AbyssalOnline?.finishRun){const sent=window.AbyssalOnline.finishRun({survival:elapsed,score,level,bossesKilled:bossKillsThisRun},{leaveAfter:wasOnline,onComplete:result=>returnToMenu(result)});if(sent){endDiveButton.disabled=true;endDiveButton.textContent='REGISTRANDO…';setTimeout(()=>{endDiveButton.disabled=false;endDiveButton.textContent='ENCERRAR MERGULHO'},12000);return;}}
 if(!authenticated){coins+=Math.max(5,Math.floor(score/35)+level*2);saveCosmetics();renderShop();if(wasOnline)window.AbyssalOnline?.leaveWorld();returnToMenu({earned:Math.max(5,Math.floor(score/35)+level*2),bossesKilled:bossKillsThisRun});}else returnToMenu({earned:0,bossesKilled:bossKillsThisRun});
});

})();
