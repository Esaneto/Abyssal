(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let mobileViewport=window.matchMedia('(pointer: coarse)').matches||window.innerWidth<=700;
const cores=navigator.hardwareConcurrency||8;let lowPowerRendering=mobileViewport||cores<=4,backgroundGradientCache=null,backgroundBloomCache=null,lastPaintAt=0;
let adaptiveQualityLevel=2,adaptiveQualityLastCheck=0,adaptiveQualityBadWindows=0,adaptiveQualityGoodWindows=0,adaptiveDprScale=1;
const ADAPTIVE_QUALITY=[{name:'ECONOMIA',dpr:.72},{name:'EQUILIBRADO',dpr:.86},{name:'ALTO',dpr:1}];
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
const PHOTON_RAY_VISUAL=window.AbyssalPhotonRay;
let W=4800,H=3000,viewW=800,viewH=500,worldZoom=.78,mapFactor=1.7,cameraX=0,cameraY=0,dpr=1,last=0,elapsed=0,score=0,level=1,xp=0,xpNeed=10,hp=100,maxHp=100,gameState='menu',soundOn=true,nextBossAt=60,lastBossMaxHp=0,lastBossDamage=0,lastBossSpeed=0,bossKillsThisRun=0,runProgressTimer=0;
let player=null,botBuddy=null,enemies=[],orbs=[],particles=[],projectiles=[],effects=[],damageNumbers=[],bloodPools=[],decor=[],arenaRocks=[],upgrades={},upgradeLevels={},chosen=[],spawnTimer=0,enemyId=0,shake=0,damageFlash=0,runSeed=0,bossIndex=0;
let onlineRoomMode='coop';
let runShotId='electric';
let runResonanceIds=[];
const RESONANCE_STORAGE_KEY='abyssalResonancePresets';
const RESONANCE_CATEGORIES={
 shots:['electric','pierce','spread','photon','photonRay','nova','echoShot'],
 defensive:['shield','regen','burst','shell','ward','lastStand','repulse','pressureCocoon'],
 passive:['power','rate','speed','range','magnet','ricochet','vitality','predator','closePressure']
};
const BASIC_SKILL_IDS=[...RESONANCE_CATEGORIES.shots,...RESONANCE_CATEGORIES.defensive,...RESONANCE_CATEGORIES.passive];
const RESONANCE_DEFAULTS={pve:['electric','shield','regen','shell','power','speed','magnet'],pvp:['electric','shield','regen','shell','power','speed','magnet']};
let resonancePresets=(()=>{try{return JSON.parse(localStorage.getItem(RESONANCE_STORAGE_KEY)||JSON.stringify(RESONANCE_DEFAULTS))}catch{return JSON.parse(JSON.stringify(RESONANCE_DEFAULTS))}})();let resonanceEditingMode='pve';
function normalizeResonancePresets(value){const clean={pve:[],pvp:[]};for(const mode of ['pve','pvp']){const source=Array.isArray(value?.[mode])?value[mode]:RESONANCE_DEFAULTS[mode];const unique=[...new Set(source.map(String).filter(id=>BASIC_SKILL_IDS.includes(id)))].slice(0,7);let foundShot=false;clean[mode]=unique.filter(id=>{if(!RESONANCE_CATEGORIES.shots.includes(id))return true;if(foundShot)return false;foundShot=true;return true;});if(!clean[mode].some(id=>RESONANCE_CATEGORIES.shots.includes(id))){if(clean[mode].length>=7)clean[mode].pop();clean[mode].unshift('electric');}}return clean;}
resonancePresets=normalizeResonancePresets(resonancePresets);
function saveResonancePresets(){resonancePresets=normalizeResonancePresets(resonancePresets);try{localStorage.setItem(RESONANCE_STORAGE_KEY,JSON.stringify(resonancePresets));}catch(_){}if(window.AbyssalOnline?.isAuthenticated?.())window.AbyssalOnline?.saveCosmetics?.({resonancePresets});}
window.addEventListener('abyssal-account-data',event=>{const saved=event.detail?.resonancePresets;if(saved){resonancePresets=normalizeResonancePresets(saved);try{localStorage.setItem(RESONANCE_STORAGE_KEY,JSON.stringify(resonancePresets));}catch(_){}}});
let onlineEnemyById=new Map(),onlineOrbById=new Map(),onlineDamageQueue=[];
let autoFollowCursor=false;
let bestScore=Number(localStorage.getItem('abyssalBestScore')||0),bestTime=Number(localStorage.getItem('abyssalBestTime')||0);
let bossProgressionCycle=0,bossCycleStreak=0,bossCycleBosses=[],bossCycleIndex=0,progressionDistance=0,progressionPausedForBoss=false,activeBossEntity=null,bossVictoryPending=false;
let pendingProgressionBossWarningKind=null,pendingProgressionBossWarningAt=0;
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
let musicVolume=Number(localStorage.getItem('abyssalMusicVolume')??0.45);
let sharkWakeTrails=[];
const skinData=[
{id:'default',name:'Luz Abissal',color:'#75f8ed',price:0,paid:false,shape:'orb',desc:'Um núcleo vivo de luz bioluminescente, cercado por filamentos de maré.',ability:'Ressonância de retorno: concede 12% mais experiência ao recolher orbes.'},
{id:'violet',name:'Espectro Violeta',color:'#bd91ff',price:100,paid:true,shape:'horns',desc:'Um espectro luminescente com cornos de energia violeta.',ability:'Ressonância espectral: a cada 10 segundos, libera uma onda violeta que causa dano aos inimigos próximos.'},
{id:'solar',name:'Núcleo Solar',color:'#ffd078',price:2500,paid:false,shape:'spikes',desc:'Espinhos dourados como fragmentos de uma estrela afogada.',ability:'Sobrecarga solar: dispara 18% mais rápido.'},
{id:'toxic',name:'Lodo Tóxico',color:'#a7ff78',price:4000,paid:false,shape:'tentacles',desc:'Tentáculos ácidos terminados em glândulas que brilham em verde.',ability:'Nuvem tóxica: a cada 5 segundos, libera uma nuvem de veneno que contamina e causa dano contínuo às criaturas próximas.'},
{id:'leviathan',name:'Leviatã Cego',color:'#ff668f',price:6500,paid:true,shape:'leviathan',desc:'Uma réplica cega do Leviatã das Fossas: corpo serpentino colossal, placas dorsais ósseas, crânio pálido e fendas sensoriais no lugar dos olhos.',ability:'Caçador de colossos: causa 40% mais dano aos bosses e recebe 8% menos dano.'},
{id:'thorn',name:'Coroa de Espinhos',color:'#ff9b6a',price:8000,paid:false,shape:'coral',desc:'Galhos de coral negro crescem como uma coroa predatória.',ability:'Espinhos reativos: causa 24% mais dano a inimigos próximos.'},
{id:'abyssking',name:'Rei do Vazio',color:'#8b7cff',price:10000,paid:false,shape:'king',desc:'Uma coroa óssea sobre um núcleo imperial de luz violeta.',ability:'Escudo régio: começa cada mergulho com uma carga extra de escudo.'},
{id:'royal',name:'Abismo Real',color:'#ff78d0',price:12000,paid:false,shape:'halo',desc:'Uma auréola de pérolas luminescentes envolve esta criatura rara.',ability:'Essência da realeza: concede 25% mais experiência ao recolher orbes.'},
{id:'glacier',name:'Glaciar Fantasma',color:'#91caff',price:13000,paid:false,shape:'crystal',desc:'Cristais de gelo marinho crescem em torno do seu corpo espectral.',ability:'Permafrost: reduz em 26% a velocidade de inimigos próximos.'},
{id:'coral',name:'Jardim Carnívoro',color:'#ff6f9d',price:6000,paid:false,shape:'coral',desc:'Corais rubros, espinhos calcificados e filamentos de anêmona.',ability:'Jardim vivo: recupera até 4 pontos de vida ao eliminar uma criatura.'},
{id:'bloodmoon',name:'Lua Sangrenta',color:'#ff3c66',price:9000,paid:false,shape:'fangs',desc:'Uma mandíbula dupla e presas pálidas sob um brilho carmesim.',ability:'Fome rubra: causa 30% mais dano quando a vida cai a 35% ou menos.'},
{id:'voidwing',name:'Asa do Nada',color:'#b2a0ff',price:15000,paid:false,shape:'wings',desc:'Membranas espectrais se abrem como asas de uma criatura antiga.',ability:'Corrente ascendente: aumenta a velocidade de movimento em 18%.'},
{id:'abyssaleye',name:'Olho do Insondável',color:'#66f0ff',price:18000,paid:false,shape:'eye',desc:'Uma íris colossal observa em várias direções ao mesmo tempo.',ability:'Olho caçador: aumenta em 20% o alcance de aquisição de alvos.'},
{id:'deepwarden',name:'Carcereiro das Fossas',color:'#b8d6c6',price:14000,paid:false,shape:'shell',desc:'Três placas minerais protegem um núcleo verde-fantasma.',ability:'Carapaça abissal: reduz em 18% o dano recebido.'},
{id:'kraken',name:'Kraken do Abismo',color:'#4f9fc7',price:30000,paid:true,shape:'kraken',desc:'Uma entidade translúcida das fossas, com manto vítreo, núcleo visceral, oito tentáculos e olhos vermelhos que brilham na escuridão.',ability:'Tentáculos do Abismo: oito tentáculos colossais causam dano por contato; a pele também reduz em 10% o dano recebido.'},
 {id:'aberration',name:'Máscara da Aberração',color:'#ff315f',price:16000,paid:true,shape:'aberration',desc:'A carapaça óssea e os apêndices curvos da primeira entidade colossal.',ability:'Carapaça da Aberração: reduz em 12% todo dano recebido; ao sofrer o primeiro impacto do mergulho, libera uma onda de repulsão.'},
 {id:'angler',name:'Lanterna Mortal',color:'#ffb45e',price:19000,paid:true,shape:'angler',desc:'A isca incandescente e a mandíbula de agulhas do peixe-pescador abissal.',ability:'Isca predatória: +25% de dano a longa distância e +15% de alcance de aquisição de alvos.'},
 {id:'maw',name:'Mandíbula da Fenda',color:'#c16cff',price:22000,paid:true,shape:'maw',desc:'Uma boca circular de dentes radiais, cercada por filamentos de caça.',ability:'Mordida de fenda: +30% de dano contra inimigos próximos e 6% de redução de dano recebido.'},
 {id:'devourer',name:'Devorador do Vazio',color:'#39d8c4',price:35000,paid:true,shape:'devourer',desc:'A silhueta bojuda e a boca descomunal da criatura que engole correntes inteiras.',ability:'Vácuo residual: +20% de dano contra bosses, +35% de alcance magnético e, após eliminar um boss, atrai orbes por 5 segundos.'},
{id:'reefshark',name:'Tubarão-branco',color:'#91c4ce',price:499,paid:true,shape:'greatwhite',desc:'Predador pelágico de dorso cinza, ventre claro, focinho cônico e cauda em crescente.',ability:'Esteira Pelágica: ao nadar, deixa um rastro de bolhas por 5 segundos que causa dano reduzido a criaturas que o atravessam. Ataques comuns causam +15% de dano contra criaturas que não são bosses.'},
{id:'hammerhead',name:'Tubarão-martelo',color:'#73b6cd',price:499,paid:true,shape:'hammerhead',desc:'Silhueta reconhecível pelo cefalofólio largo, olhos laterais e nado de varredura.',ability:'Eletrorecepção: amplia em 50% o alcance de atração dos orbes de experiência.'},
{id:'abysscroc',name:'Jacaré-açu',color:'#518d68',price:499,paid:true,shape:'alligator',desc:'Corpo pesado, focinho largo em U, cauda musculosa e osteodermos escuros.',ability:'Mordida de Emboscada: executa uma arrancada curta com dano frontal. A carapaça reduz em 15% o dano recebido.'},
{id:'armoredgator',name:'Crocodilo-do-nilo',color:'#b59a65',price:499,paid:true,shape:'crocodile',desc:'Perfil alongado, focinho em V, dentes aparentes e fileiras altas de escudos dorsais.',ability:'Giro do Nilo: a rotação da cauda repele inimigos próximos e libera uma onda de impacto.'},
{id:'greensnake',name:'Serpente Esmeralda',color:'#2ee88a',price:0,paid:false,shape:'serpent',desc:'Uma serpente colossal das profundezas, esculpida em escamas de jade reluzentes com olhos de âmbar.',ability:'Veneno corrosivo: ataques envenenam criaturas atingidas.'},
  {id:'electriceel',name:'Enguia Elétrica',color:'#38e8ff',price:0,paid:false,shape:'eel',desc:'Predadora bioelétrica de corpo alongado, ventre luminoso e pulsos ciano que percorrem a linha lateral.',ability:'Descarga Estática: ataques paralisam brevemente as criaturas atingidas.'},
];
const SkinAbilities=window.AbyssalSkinAbilities;
let ownedSkins=JSON.parse(localStorage.getItem('abyssalOwnedSkins')||'["default"]');
let gameLanguage=['en','es'].includes(localStorage.getItem('abyssalLanguage'))?localStorage.getItem('abyssalLanguage'):'pt';
let shopCurrency='brl';
let shopRates={brl:1};
function setGameLanguage(language){gameLanguage=['en','es'].includes(language)?language:'pt';localStorage.setItem('abyssalLanguage',gameLanguage);shopCurrency='brl';const languageSelect=$('languageSelect');if(languageSelect)languageSelect.value=gameLanguage;const currencySelect=$('shopCurrency');if(currencySelect)currencySelect.value='brl';renderShop();window.dispatchEvent(new CustomEvent('abyssal-language-change',{detail:{language:gameLanguage,currency:'brl'}}));}
if(!window.AbyssalOnline?.isAuthenticated()){const premiumIds=new Set(skinData.filter(skin=>skin.paid).map(skin=>skin.id));ownedSkins=ownedSkins.filter(id=>!premiumIds.has(id));if(premiumIds.has(equippedSkin))equippedSkin='default';}
function saveCosmetics(){localStorage.setItem('abyssalCoins',String(coins));localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));localStorage.setItem('abyssalMetaUpgrades',JSON.stringify(metaUpgrades));if(window.AbyssalOnline?.saveCosmetics)window.AbyssalOnline.saveCosmetics({ownedSkins,equippedSkin,metaUpgrades,conqueror:ownedSkins.includes('greensnake')});}
function currentSkinColor(){return (skinData.find(s=>s.id===equippedSkin)||skinData[0]).color;}
let pointer={x:0,y:0,down:false,active:false},keys={},joystickVector={x:0,y:0,active:false,pointerId:null},aimJoystickVector={x:0,y:0,active:false,pointerId:null};
const controlSettings={pc:localStorage.getItem('abyssalControlsPc')||'classic',mobile:localStorage.getItem('abyssalControlsMobile')||'classic'};
let controlAimAngle=0;
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
function setMobileGameActive(active){mobileViewport=window.matchMedia('(pointer: coarse)').matches||window.innerWidth<=700;const enabled=Boolean(active)&&isMobileDevice();document.body.classList.toggle('mobile-game-active',enabled);document.documentElement.classList.toggle('mobile-game-active',enabled);const stick=$('mobileJoystick');if(stick)stick.hidden=true;$('mobileMoveStick')?.classList.remove('dual-stick-visible');$('mobileAimStick')?.classList.toggle('dual-stick-visible',enabled&&controlSettings.mobile==='dual-stick');if(enabled&&!window.ABYSSAL_NATIVE_SHELL)try{screen.orientation?.lock?.('portrait').catch(()=>{});}catch(_){};if(!enabled){joystickVector={x:0,y:0,active:false,pointerId:null};aimJoystickVector={x:0,y:0,active:false,pointerId:null};stick?.classList.remove('is-floating');if(stick){stick.style.left='';stick.style.top='';stick.style.bottom='';stick.style.transform='';}}resize();}
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
  const lastSeen = Number(localStorage.getItem('abyssalNotificationsLastSeen') || 0);
  const hasUnread = list.some(item => Number(item.timestamp) > lastSeen);

  const dot = document.getElementById('notifUnreadDot');
  btn.classList.toggle('has-unread', hasUnread);
  if (dot) dot.hidden = !hasUnread;
  btn.setAttribute(
    'aria-label',
    hasUnread ? 'Abrir notificações — há itens não lidos' : 'Abrir notificações'
  );
}

window.addNotification = addNotification;
window.updateNotifBadge = updateNotifBadge;
window.openAbyssalNotifications = openNotifPanel;

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
// Competitive camera: every platform renders the same world AREA.
// 1366x768 at the legacy .78 zoom is the reference. Portrait/landscape change shape, not information volume.
const FAIR_VIEW_REFERENCE=Object.freeze({width:1366,height:768,zoom:.78});
const FAIR_VIEW_WORLD_AREA=(FAIR_VIEW_REFERENCE.width*FAIR_VIEW_REFERENCE.height)/(FAIR_VIEW_REFERENCE.zoom*FAIR_VIEW_REFERENCE.zoom);
function desiredWorldZoom(){
 const viewportArea=Math.max(320,viewW)*Math.max(300,viewH);
 const fairZoom=Math.sqrt(viewportArea/FAIR_VIEW_WORLD_AREA);
 // Touch screens need extra tactical reach because fingers and controls cover part of the arena.
 // Desktop keeps the competitive reference; mobile is pulled back ~18% with a lower floor for portrait phones.
 return mobileViewport?clamp(fairZoom*.82,.25,.72):clamp(fairZoom,.34,1.12);
}
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
 lowPowerRendering=cores<=4||(memory>0&&memory<=4);adaptiveQualityLevel=lowPowerRendering?0:2;adaptiveDprScale=ADAPTIVE_QUALITY[adaptiveQualityLevel].dpr;
 // Preserve mobile sharpness without blindly rendering a 3x/4x framebuffer.
 // Strong phones get up to 2x DPR; constrained devices retain a lighter adaptive buffer.
 const nativeDpr=Math.min(window.devicePixelRatio||1,lowPowerRendering?1:1.45);
 dpr=Math.max(1,nativeDpr*adaptiveDprScale);
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
function projectileHitsPvpWall(x1,y1,x2,y2,padding=0){
 const dx=x2-x1,dy=y2-y1,segmentLength=Math.hypot(dx,dy),steps=Math.max(1,Math.ceil(segmentLength/4));
 for(const rock of arenaRocks){
  if(rock.visualOnly)continue;
  const a=-(rock.angle||0),rx=(rock.rx||rock.r)+padding,ry=(rock.ry||rock.r)+padding;
  for(let i=0;i<=steps;i++){
   const t=i/steps,ox=x1+dx*t-rock.x,oy=y1+dy*t-rock.y,lx=ox*Math.cos(a)-oy*Math.sin(a),ly=ox*Math.sin(a)+oy*Math.cos(a);
   if((lx/Math.max(1,rx))**2+(ly/Math.max(1,ry))**2<1)return true;
  }
 }
 return false;
}
function createArenaRocks(){
 arenaRocks=[];
 if(onlineRoomMode==='pvp'){
  const minDim=Math.min(W,H),cx=W*.5,cy=H*.5;
  const rnd=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453123;return v-Math.floor(v);};
  const addRidge=(x,y,rx,ry,angle,seed)=>{
   const vertices=[],n=9+Math.floor(rnd(seed+17)*5);
   for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2,noise=.79+rnd(seed+i*13)*.31;
    vertices.push([Math.cos(a)*rx*noise,Math.sin(a)*ry*noise]);
   }
   arenaRocks.push({x,y,r:Math.max(rx,ry),rx,ry,angle,edge:'reef',vertices,shade:rnd(seed+29),seed});
  };
  for(let i=0;i<62;i++){
   const x=W*(.035+rnd(i+1)*.93),y=H*(.045+rnd(i+91)*.91);
   if(Math.hypot(x-cx,y-cy)<minDim*.245)continue;
   const long=minDim*(.032+rnd(i+191)*.045),thick=minDim*(.012+rnd(i+291)*.018),vertical=rnd(i+391)>.77;
   addRidge(x,y,vertical?thick:long,vertical?long:thick,(rnd(i+491)*2-1)*Math.PI*.92,i+100);
  }
  for(let i=0;i<14;i++){
   const side=i%4,along=rnd(i+701),x=side<2?W*(.04+along*.92):(side===2?W*.035:W*.965),y=side>=2?H*(.05+along*.9):(side===0?H*.035:H*.965);
   addRidge(x,y,minDim*(.025+rnd(i+801)*.025),minDim*(.012+rnd(i+901)*.014),(rnd(i+1001)*2-1)*Math.PI,i+800);
  }
  // Natural perimeter stones visually mark the arena limits without adding interior clutter.
  const spacing=95/worldZoom,offset=24/worldZoom;
  const addBoundary=(x,y,edge)=>{const radius=rand(17,37)/worldZoom,vertices=[],n=7+Math.floor(Math.random()*3);for(let i=0;i<n;i++){const a=i/n*Math.PI*2,rr=radius*rand(.66,1.24);vertices.push([Math.cos(a)*rr,Math.sin(a)*rr]);}arenaRocks.push({x,y,r:radius,edge,vertices,shade:Math.random(),visualOnly:true});};
  for(let x=offset;x<W;x+=spacing){addBoundary(x,rand(8,34)/worldZoom,'top');addBoundary(x,H-rand(8,34)/worldZoom,'bottom');}
  for(let y=offset;y<H;y+=spacing){addBoundary(rand(8,34)/worldZoom,y,'left');addBoundary(W-rand(8,34)/worldZoom,y,'right');}
  for(const [x,y] of [[offset,offset],[W-offset,offset],[offset,H-offset],[W-offset,H-offset]])for(let i=0;i<3;i++)addBoundary(clamp(x+rand(-22,22)/worldZoom,0,W),clamp(y+rand(-22,22)/worldZoom,0,H),'corner');
  return;
 }
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
  // Marcar como lidas apenas ao abrir a caixa, removendo o ponto vermelho do sino.
  try { localStorage.setItem('abyssalNotificationsLastSeen', String(Date.now())); } catch(e) {}
  updateNotifBadge();
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
      window.AbyssalMasterVolume = masterSoundVolume;
    });
  }

  const musicSlider=$('musicVolumeSlider'),musicLabel=$('musicVolumeText');
  if(musicSlider){
    musicSlider.value=Math.round(clamp(musicVolume,0,1)*100);
    if(musicLabel)musicLabel.textContent=musicSlider.value+'%';
    musicSlider.addEventListener('input',e=>{
      musicVolume=Number(e.target.value)/100;localStorage.setItem('abyssalMusicVolume',String(musicVolume));
      if(musicLabel)musicLabel.textContent=e.target.value+'%';
      if(ambientNodes?.master?.gain)ambientNodes.master.gain.value=.34*musicVolume;
      if(window.AbyssalMusicTrack)window.AbyssalMusicTrack.volume=musicVolume;
      window.AbyssalMusicVolume=musicVolume;
    });
  }

  // Manter popup aberto no clique/toque em mobile
  if (wrapper && popup) {
    wrapper.addEventListener('pointerenter', () => popup.classList.add('active'));
    wrapper.addEventListener('pointerleave', () => popup.classList.remove('active'));
  }
}
window.AbyssalMasterVolume = masterSoundVolume;

window.AbyssalAudioDiagnostics=()=>({contextState:audioCtx?.state||'not-created',musicCreated:Boolean(ambientNodes),musicVolume,masterGain:ambientNodes?.master?.gain?.value??null,gameState,soundOn});

function getAbyssalMusicIntensity(){
 if(gameState!=='playing'&&!(onlineMode&&gameState==='upgrade'))return 0;
 if(progressionPausedForBoss||activeBossEntity||activeBossEntities?.length)return 1;
 if(!player)return .12;
 let nearby=0,threat=0;
 for(const e of enemies){const d=Math.hypot((e.x||0)-player.x,(e.y||0)-player.y);if(d<430/GAME_WORLD_ZOOM){nearby++;threat+=d<180/GAME_WORLD_ZOOM?2:1;}}
 const hpPressure=maxHp>0?1-clamp(hp/maxHp,0,1):0;
 return clamp(.14+nearby*.045+threat*.035+hpPressure*.32,0,.78);
}
function createAbyssalNoiseBuffer(ctx,duration=2){
 const length=Math.max(1,Math.floor(ctx.sampleRate*duration)),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
 let brown=0;for(let i=0;i<length;i++){brown=(brown*.985)+(Math.random()*2-1)*.035;data[i]=brown;}
 return buffer;
}
function abyssalMusicVoice(freq,duration,volume,type='sine',detune=0,delay=0){
 if(!ambientNodes||!audioCtx||musicVolume<=0)return;
 const now=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter(),pan=audioCtx.createStereoPanner?.();
 o.type=type;o.frequency.setValueAtTime(freq,now);o.detune.value=detune;
 f.type='lowpass';f.frequency.value=900+ambientNodes.intensity*900;f.Q.value=.45;
 g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),now+.28);g.gain.exponentialRampToValueAtTime(.0001,now+duration);
 o.connect(f);f.connect(g);if(pan){pan.pan.value=Math.sin(freq*.013)*.42;g.connect(pan);pan.connect(ambientNodes.musicBus)}else g.connect(ambientNodes.musicBus);
 o.start(now);o.stop(now+duration+.08);
}
function abyssalMusicPulse(intensity){
 if(!ambientNodes||!audioCtx)return;
 const progressions=[[110,130.81,164.81],[98,123.47,146.83],[87.31,110,130.81],[98,116.54,146.83]];
 const chord=progressions[ambientNodes.bar%progressions.length],boss=intensity>.9;
 chord.forEach((freq,i)=>abyssalMusicVoice(freq*(i===0?1:2),boss?1.8:3.8,boss?.018:.013,'sine',(i-1)*4,i*.16));
 const melody=[329.63,293.66,261.63,220,246.94,293.66,261.63,196];
 const note=melody[ambientNodes.bar%melody.length];
 abyssalMusicVoice(note,boss?.7:1.65,boss?.026:.018,'sine',Math.sin(ambientNodes.bar)*5,.55);
 if(ambientNodes.bar%2===0)abyssalMusicVoice(note*1.5,.9,.008,'triangle',7,1.15);
 if(intensity>.62){abyssalMusicVoice(chord[0]*2,.42,.013,'triangle',0,.25);abyssalMusicVoice(chord[0]*3,.32,.009,'sine',0,.78);}
 if(boss){abyssalMusicVoice(146.83,.34,.018,'triangle',-9,.12);abyssalMusicVoice(174.61,.34,.016,'triangle',8,.62);}
 ambientNodes.bar++;
}
function updateAbyssalMusic(){
 if(!ambientNodes||!audioCtx)return;
 const target=getAbyssalMusicIntensity();ambientNodes.intensity+=(target-ambientNodes.intensity)*.18;
 const now=audioCtx.currentTime;
 ambientNodes.master.gain.setTargetAtTime(.34*musicVolume,now,.25);
 ambientNodes.waterGain.gain.setTargetAtTime(.0025+.0025*ambientNodes.intensity,now,1.5);
 const interval=ambientNodes.intensity>.9?1500:ambientNodes.intensity>.62?1900:ambientNodes.intensity>.32?2400:3200;
 if(performance.now()-ambientNodes.lastPulse>=interval){ambientNodes.lastPulse=performance.now();abyssalMusicPulse(ambientNodes.intensity);}
}
async function startAmbientMusic(){if(!soundOn)return;try{
 audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')await audioCtx.resume();if(audioCtx.state!=='running')return false;if(ambientNodes)return true;
 const master=audioCtx.createGain(),musicBus=audioCtx.createGain(),compressor=audioCtx.createDynamicsCompressor();
 master.gain.value=.34*musicVolume;musicBus.gain.value=1;compressor.threshold.value=-18;compressor.knee.value=14;compressor.ratio.value=2.2;compressor.attack.value=.02;compressor.release.value=.45;musicBus.connect(compressor);compressor.connect(master);master.connect(audioCtx.destination);
 const water=audioCtx.createBufferSource(),waterFilter=audioCtx.createBiquadFilter(),waterGain=audioCtx.createGain();
 water.buffer=createAbyssalNoiseBuffer(audioCtx,3.6);water.loop=true;waterFilter.type='bandpass';waterFilter.frequency.value=1150;waterFilter.Q.value=.22;waterGain.gain.value=.0025;water.connect(waterFilter);waterFilter.connect(waterGain);waterGain.connect(musicBus);water.start();
 ambientNodes={master,musicBus,compressor,water,waterGain,intensity:.12,lastPulse:0,bar:0};
 abyssalMusicPulse(.12);ambientNodes.pulseTimer=setInterval(()=>{if(!ambientNodes||audioCtx?.state!=='running')return;abyssalMusicPulse(ambientNodes.intensity)},3200);return true;
}catch(e){console.warn('Trilha procedural indisponível',e);return false}}
function unlockAbyssalAudioFromGesture(){if(!soundOn)return;startAmbientMusic();}
['pointerdown','keydown','touchstart'].forEach(type=>window.addEventListener(type,unlockAbyssalAudioFromGesture,{once:true,passive:true}));
function stopAmbientMusic(){if(!ambientNodes)return;try{
 const nodes=ambientNodes;if(nodes.pulseTimer)clearInterval(nodes.pulseTimer);nodes.master.gain.setTargetAtTime(.0001,audioCtx.currentTime,.18);setTimeout(()=>{try{nodes.water?.stop();nodes.master.disconnect();}catch(_){}if(ambientNodes===nodes)ambientNodes=null;},520);
}catch(e){ambientNodes=null}}
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

// === SISTEMA DE ALERTAS ABISSAIS (vermelho, ameaçador, fade sólido) ===
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
  // Legacy progression notices are intentionally non-visual.
  // Match overlays are restricted to boss, fusion, join and death via enqueueGameplayNotice().
  return;
}
const gameplayNoticeQueue=[];let gameplayNoticeActive=false;
const gameplayNoticeRecent=new Map();
function gameplayNoticeKey(kind,title,text){
 return [kind,String(title||'').trim().toLowerCase(),String(text||'').trim().toLowerCase()].join('|');
}
function enqueueGameplayNotice(kind,title,text='',priority=0){
 const allowed=new Set(['boss','fusion','join','death']);if(!allowed.has(kind))return;
 const now=Date.now(),key=gameplayNoticeKey(kind,title,text),last=gameplayNoticeRecent.get(key)||0;
 // Network relays and local prediction can report the same semantic event twice.
 // Suppress identical notices across the active 5s display plus a short relay margin.
 if(now-last<7000)return;
 gameplayNoticeRecent.set(key,now);
 if(gameplayNoticeRecent.size>64)for(const [k,at] of gameplayNoticeRecent)if(now-at>15000)gameplayNoticeRecent.delete(k);
 gameplayNoticeQueue.push({kind,title:String(title||''),text:String(text||''),priority:Number(priority)||0,at:now,key});
 gameplayNoticeQueue.sort((a,b)=>b.priority-a.priority||a.at-b.at);pumpGameplayNotice();
}
function pumpGameplayNotice(){
 if(gameplayNoticeActive||!gameplayNoticeQueue.length)return;
 const item=gameplayNoticeQueue.shift(),el=$('bossAlert');if(!el)return;
 gameplayNoticeActive=true;el.dataset.noticeKind=item.kind;
 const kicker=$('bossAlertKicker'),title=$('bossAlertTitle'),copy=$('bossAlertText');
 if(kicker)kicker.textContent=item.kind==='boss'?'SINAL DE PRESSÃO · CONTATO DESCONHECIDO':item.kind==='fusion'?'RESSONÂNCIA · FUSÃO CONCLUÍDA':item.kind==='join'?'SINAL DE MERGULHADOR · CONEXÃO ESTABELECIDA':'SINAL PERDIDO · ECO INTERROMPIDO';
 if(title)title.textContent=item.title;if(copy)copy.textContent=item.text;
 el.hidden=false;el.classList.remove('boss-alert-enter','gameplay-notice-5s');void el.offsetWidth;el.classList.add('gameplay-notice-5s');
 clearTimeout(bossAlertTimer);bossAlertTimer=setTimeout(()=>{el.hidden=true;el.classList.remove('gameplay-notice-5s');el.dataset.noticeKind='';gameplayNoticeActive=false;pumpGameplayNotice();},5000);
}
function showToast(t){if(gameState==='playing'&&onlineMode)return;$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,1700)}
function showBossAlert(kind,id=null,threat=0,force=false){
 if(onlineMode&&onlineRoomMode==='pvp')return;
 const key=id==null?`${kind}:${Math.floor(performance.now()/1000)}`:`${kind}:${String(id)}`;
 if(!force&&alertedBossIds.has(key))return;alertedBossIds.add(key);if(alertedBossIds.size>64)alertedBossIds=new Set([...alertedBossIds].slice(-32));
 const names={
  boss:['☠ ABERRAÇÃO ABISSAL','ALGO RASGOU A ESCURIDÃO. ELE SENTE SEU CALOR. CORRA.'],
  leviathan:['☠ O LEVIATÃ DAS FOSSAS','A PRESSÃO EXPLODIU. UMA CRIATURA COLOSSAL EMERGE DO FUNDO. NÃO HÁ SAÍDA.'],
  maw:['☠ A BOCA DO ABISMO','ESSE ECO NÃO FOI SEU. ESSA GARGANTA NÃO TEM FUNDO. NADE.'],
  angler:['☠ A LANTERNA MORTAL','A LUZ É UMA MENTIRA. OS DENTES JÁ ESTÃO FECHANDO.'],
  kraken:['☠ KRAKEN DO ABISMO','OITO BRAÇOS ENVOLVEM AS TREVAS. VOCÊ JÁ ESTÁ DENTRO DELE.'],
  devourer:['☠ O DEVORADOR DO VAZIO','A CORRENTE INVERTEU. O OCEANO INTEIRO ESTÁ SENDO ENGOLIDO.'],
  whiteSharkBoss:['☠ TUBARÃO-BRANCO COLOSSAL','O ÁPICE PREDATÓRIO EMERGIU. VELOCIDADE LETAL. FUJA OU MORRA.']
 };

 const [title,copy]=names[kind]||['☠ PRESENÇA COLOSSAL','UMA FORMA IMPOSSÍVEL SE MOVE NA ESCURIDÃO.'];
 enqueueGameplayNotice('boss',title,copy,100);
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

function getBossXpMultiplier() {
  return 1 + (bossProgressionCycle * 0.02);
}

function updateProgressionTrackUI() {
  var track = $('bossProgressionTrack');
  if (!track) return;
  // A arena PvP não possui ciclos de bosses nem progressão de expedição.
  if (onlineMode && onlineRoomMode === 'pvp') { track.style.display = 'none'; return; }
  track.style.display = 'block';
  var hpBonusPercent = Math.round(bossProgressionCycle * 20);
  var xpBonusPercent = Math.round(bossProgressionCycle * 2);
  var cycleBadge = $('trackCycleBadge');
  if (cycleBadge) {
    if (bossProgressionCycle >= PROGRESSION_MAX_CYCLES) {
      cycleBadge.classList.add('maxed');
      cycleBadge.textContent = 'CICLO MÁXIMO ⚡ +100% HP · +10% XP';
    } else {
      cycleBadge.classList.remove('maxed');
      cycleBadge.textContent = 'CICLO ' + (bossProgressionCycle + 1) + ' · +' + hpBonusPercent + '% HP / +' + xpBonusPercent + '% XP';
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

  // O aviso começa exatamente quando a barra chega a 100%, antes da confirmação de rede.
  // No online, o servidor continua sendo a autoridade sobre o spawn e a vida do boss.
  if (onlineMode) {
    pendingProgressionBossWarningKind=targetKind;
    pendingProgressionBossWarningAt=performance.now();
    showBossAlert(targetKind, `progression-${bossProgressionCycle}-${bossCycleIndex}`, 0);
    updateProgressionTrackUI();
    return;
  }
  const spawned = spawnEnemy(false, targetKind);
  if (spawned) {
    activeBossEntities.push(spawned);
    activeBossEntity = spawned;
    showBossAlert(targetKind, spawned.id, Number(spawned.threat) || 0);
  } else progressionPausedForBoss = false;
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
    const hpBonus = bossProgressionCycle * 20;
    const xpBonus = bossProgressionCycle * 2;
    // Cada ciclo fortalece somente a vida dos bosses; a recompensa de XP sobe 2%.
    showAbyssalAlert('☠ BOSSES FORTALECIDOS! +'+hpBonus+'% VIDA · +'+xpBonus+'% XP', 'CICLO DE PROGRESSÃO COMPLETADO');
    addNotification("Vida dos bosses: +"+hpBonus+"%. Recompensa de XP dos bosses: +"+xpBonus+"%.", "PROGRESSÃO ABISSAL ☠", "cycle");
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
      <div style="background:linear-gradient(180deg,#0a1e28 0%,#041019 100%);border:2px solid #2ee88a;box-shadow:0 0 35px rgba(46,232,138,0.5);border-radius:16px;max-width:540px;width:100%;padding:28px 24px;text-align:center;color:#fff;font-family:"Cinzel",Georgia,serif;">
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
        <button id="victoryContinueBtn" style="background:#2ee88a;color:#04140d;font-weight:800;font-size:13px;letter-spacing:0.1em;border:none;border-radius:8px;padding:12px 28px;cursor:pointer;box-shadow:0 0 16px rgba(46,232,138,0.6);transition:transform 0.15s ease;">
          GLÓRIA AO CONQUISTADOR
        </button>
      </div>
    `;
    document.body.appendChild(modal);
    const victoryContinueBtn = $('victoryContinueBtn');
    victoryContinueBtn.addEventListener('mouseenter', () => { victoryContinueBtn.style.transform = 'scale(1.04)'; });
    victoryContinueBtn.addEventListener('mouseleave', () => { victoryContinueBtn.style.transform = 'scale(1)'; });
    victoryContinueBtn.addEventListener('click', () => {
      modal.remove();
      endGame();
    });
  }
}

function startGame(){
 document.body.classList.add('game-active');
 runResultPending=false;
 startAmbientMusic();
 elapsed=0;alertedBossIds.clear();clearTimeout(bossAlertTimer);const oldBossAlert=$('bossAlert');if(oldBossAlert){oldBossAlert.hidden=true;oldBossAlert.classList.remove('boss-alert-enter');}lastOnlineVitalsAt=0;authoritativeElapsed=onlineMode?0:null;lastSnapshotAt=0;lastSnapshotTick=0;lastAuthoritativeWorldId=null;lastAuthoritativeSnapshotSeq=0;lastAuthoritativeServerTime=0;pendingOnlineHitVitals=[];authoritativeSnapshotHistory=new Map();onlineMovementStalledSnapshots=0;onlineMovementConfirmedSnapshots=0;onlineMotionWatchdog?.reset?.();onlineClientMovementFallback=false;lastServerEnemyPositions.clear();score=0;level=1;xp=0;xpNeed=10;bossKillsThisRun=0;runProgressTimer=0;maxHp=100+Math.max(0,Number(metaUpgrades.bulkhead)||0)*8;hp=maxHp;spawnTimer=0;enemyId=0;shake=0;damageFlash=0;chosen=[];nextBossAt=60;bossIndex=0;lastBossKind=null;lastBossMaxHp=0;lastBossDamage=0;lastBossSpeed=0;lastRemoteBossId=null;alertedBossIds.clear();joystickVector={x:0,y:0,active:false,pointerId:null};
 setMobileGameActive(true);setHudCollapsed(false);$('toggleHudBtn').hidden=false;initBossProgression();
runResonanceIds=[...(resonancePresets[onlineRoomMode==='pvp'?'pvp':'pve']||[])];
 const selectedOpeningShot=runResonanceIds.find(id=>RESONANCE_CATEGORIES.shots.includes(id))||'electric';
 runShotId=selectedOpeningShot;
 upgrades={power:Math.pow(1.08,Math.max(0,Number(metaUpgrades.focuser)||0)),rate:1,range:1,speed:1+Math.max(0,Number(metaUpgrades.current)||0)*.05,magnet:1,regen:0,shield:Math.min(3,Math.max(0,Number(metaUpgrades.startShield)||0)+(equippedSkin==='abyssking'||equippedSkin==='armoredgator'?1:0)),burst:0,electric:selectedOpeningShot==='electric'?1:0,pierce:selectedOpeningShot==='pierce'?1:0,ricochet:0,spread:selectedOpeningShot==='spread'?1:0,photon:selectedOpeningShot==='photon'?1:0,photonRay:selectedOpeningShot==='photonRay'?1:0,nova:selectedOpeningShot==='nova'?1:0,echoShot:selectedOpeningShot==='echoShot'?1:0,shell:0,ward:0,lastStand:0,repulse:0,pressureCocoon:0,vitality:0,predator:0,closePressure:0,gravitationalRupture:0,arcChain:0};
 upgradeLevels={power:0,rate:0,range:0,speed:0,magnet:0,regen:0,shield:0,burst:0,electric:selectedOpeningShot==='electric'?1:0,pierce:selectedOpeningShot==='pierce'?1:0,ricochet:0,spread:selectedOpeningShot==='spread'?1:0,photon:selectedOpeningShot==='photon'?1:0,photonRay:selectedOpeningShot==='photonRay'?1:0,nova:selectedOpeningShot==='nova'?1:0,echoShot:selectedOpeningShot==='echoShot'?1:0,shell:0,ward:0,lastStand:0,repulse:0,pressureCocoon:0,vitality:0,predator:0,closePressure:0,gravitationalRupture:0,arcChain:0};
 enemies=[];orbs=[];onlineEnemyById.clear();onlineOrbById.clear();particles=[];particlePool.length=0;sharkWakeTrails=[];projectiles=[];effects=[];enemyCollisionGrid.clear();hostileSpriteCache.clear();
 player={x:W*.5,y:H*.5,r:13/GAME_WORLD_ZOOM,angle:0,moveSpeed:150/GAME_WORLD_ZOOM,fireTimer:0,invuln:0,shieldTime:0,trail:[],pulseCooldown:0,dashCooldown:0,dashTime:0,krakenSweepTimer:7,toxicCloudTimer:5};updateCamera();
 // Persistent/passive abilities have a distinct cue when their effects enter a run.
 const activePassiveSounds=[];
 if(Number(metaUpgrades.bulkhead)>0)activePassiveSounds.push('bulkhead');
 if(Number(metaUpgrades.focuser)>0)activePassiveSounds.push('focuser');
 if(Number(metaUpgrades.current)>0)activePassiveSounds.push('current');
 if(upgrades.shield>0)activePassiveSounds.push('startShield');
 activePassiveSounds.slice(0,4).forEach((id,i)=>setTimeout(()=>{if(gameState==='playing'||(onlineMode&&gameState==='upgrade'))playSkillSound(id,'trigger')},180+i*190));
 gameState='playing';startAmbientMusic();screens.forEach(s=>$(s).hidden=true);$('hud').hidden=false;const endBtn=document.getElementById('endDiveBtn');if(endBtn)endBtn.style.display=onlineMode?'block':'none';$('pauseBtn').hidden=false;botBuddyTimer=0;botBuddy=null;
 updateHud();last=performance.now();audio(520,.12,'sine',.04);if(!onlineMode)for(let i=0;i<3;i++)spawnEnemy(true);if(onlineMode){window.AbyssalOnline?.beginRun?.();window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet,rangeStrength:upgrades.range,arcChainActive:Boolean(upgrades.arcChain),ricochetLevel:upgrades.ricochet,electricLevel:upgrades.electric,shellLevel:upgrades.shell,lastStandLevel:upgrades.lastStand});window.AbyssalOnline?.requestPlayerState?.();}else if(window.AbyssalOnline?.isAuthenticated?.())window.AbyssalOnline?.beginRun?.();snapshotClock=0;
}
const upgradeList=[
 {id:'power',name:'Pulso intenso',icon:'✧',desc:'Amplifica o núcleo ofensivo: +50% de dano dos disparos por nível. O brilho de impacto fica mais intenso conforme a potência cresce.',apply:()=>upgrades.power*=1.5},
 {id:'rate',name:'Ressonância veloz',icon:'⟡',desc:'Acelera a cadência em 28% por nível. A pulsação ao redor do núcleo acompanha o ritmo de disparo.',apply:()=>upgrades.rate*=1.28},
 {id:'speed',name:'Propulsão abissal',icon:'➤',desc:'Aumenta a velocidade de movimento em 18% por nível e reforça o rastro hidrodinâmico.',apply:()=>upgrades.speed*=1.18},
 {id:'range',name:'Olho profundo',icon:'◎',desc:'Expande o alcance dos disparos em 22% por nível. O limite de aquisição fica visualmente mais definido.',apply:()=>upgrades.range*=1.22},
 {id:'magnet',name:'Campo magnético',icon:'⌁',desc:'Amplia em 45% por nível o campo que atrai orbes de experiência; os orbes capturados deixam um fio de energia até você.',apply:()=>upgrades.magnet*=1.45},
 {id:'regen',name:'Membrana viva',icon:'✚',desc:'Regenera vida gradualmente. Cada nível aumenta a frequência efetiva da recuperação e produz um pulso orgânico verde ao curar.',apply:()=>upgrades.regen+=1},
 {id:'shield',name:'Escudo espectral',icon:'◉',desc:'Adiciona uma carga de escudo, até 3. Cada carga bloqueia um dano e aparece como uma camada espectral ao redor do corpo.',apply:()=>upgrades.shield=Math.min(3,upgrades.shield+1)},
 {id:'burst',name:'Pulso de ruptura',icon:'✺',desc:'Libera dano em área: começa a cada 7 segundos, com intervalo mínimo de 3,5 segundos e dano crescente por nível.',apply:()=>upgrades.burst=Math.min(3,upgrades.burst+1)},
 {id:'electric',name:'Tempestade elétrica',icon:'ϟ',desc:'Corrente bioelétrica: dano moderado e 1, 2 ou 3 saltos. Cada salto causa dano reduzido; níveis maiores ampliam o alcance da corrente.',apply:()=>upgrades.electric=Math.min(3,(upgrades.electric||0)+1)},
 {id:'pierce',name:'Lança-abismo',icon:'➶',desc:'Arpão abissal pesado: lento, largo e atravessa 1, 2 ou 3 criaturas adicionais. Sua força está em rasgar fileiras inteiras, não em chegar primeiro ao alvo.',apply:()=>upgrades.pierce=Math.min(3,(upgrades.pierce||0)+1)},
 {id:'ricochet',name:'Ricochete caótico',icon:'⤴',desc:'Após o primeiro impacto, o projétil salta para outro inimigo próximo. Cada nível adiciona um ricochete, até 3, marcado por trajetórias âmbar.',apply:()=>upgrades.ricochet=Math.min(3,(upgrades.ricochet||0)+1)},
 {id:'spread',name:'Rajada Prismática',icon:'✷',desc:'Cobertura em leque: 3, 5 ou 7 fragmentos de baixo dano individual. Forte contra grupos próximos, fraco quando poucos fragmentos acertam o mesmo alvo.',apply:()=>upgrades.spread=Math.min(3,(upgrades.spread||0)+1)},
 {id:'photon',name:'Lança de Fótons',icon:'➶',desc:'Dardo fotônico de precisão: extremamente veloz, fino e de alto dano em alvo único. Quase não permanece na tela e não perfura fileiras.',apply:()=>upgrades.photon=Math.min(3,(upgrades.photon||0)+1)},
 {id:'photonRay',name:'Raio de Fótons',icon:'☼',desc:'Feixe contínuo que atinge todos os alvos atravessados. No Controle 1, mira automaticamente no alvo mais próximo; no Controle 2, acompanha o mouse no PC ou o joystick de mira no celular. Níveis maiores aumentam potência e espessura.',apply:()=>upgrades.photonRay=Math.min(3,(upgrades.photonRay||0)+1)},
 {id:'nova',name:'Nova gravitacional',icon:'✹',desc:'Pulso radial de alto controle: recarga de 1,8 s no PvE e 2,4 s no PvP. Atinge apenas alvos com caminho radial livre; cobertura bloqueia dano e onda visual.',apply:()=>upgrades.nova=Math.min(3,(upgrades.nova||0)+1)},
 {id:'echoShot',name:'Eco de Maré',icon:'⋔',desc:'Dispara dois projéteis paralelos com dano individual menor. Níveis maiores aumentam dano e velocidade sem abrir o leque.',apply:()=>upgrades.echoShot=Math.min(3,(upgrades.echoShot||0)+1)},
 {id:'shell',name:'Carapaça Abissal',icon:'🛡',desc:'Endurece a carapaça: reduz o dano recebido em 8% por nível, até 24%, indicado por placas minerais orbitais discretas.',apply:()=>upgrades.shell=Math.min(3,(upgrades.shell||0)+1)},
 {id:'ward',name:'Véu de Maré',icon:'◈',desc:'Cria automaticamente uma janela curta de invulnerabilidade. Começa a cada 28 s e recarrega mais rápido nos níveis seguintes; um véu azul se fecha quando ativa.',apply:()=>upgrades.ward=Math.min(3,(upgrades.ward||0)+1)},
 {id:'lastStand',name:'Último Fôlego',icon:'♥',desc:'Ao chegar a 30% de vida ou menos, entra em sobrevivência extrema e reduz o dano recebido em 20%. O núcleo assume um pulso carmesim enquanto estiver ativo.',apply:()=>upgrades.lastStand=Math.min(3,(upgrades.lastStand||0)+1)},
 {id:'repulse',name:'Pulso Repulsor',icon:'✺',desc:'Emite uma onda defensiva que fere inimigos próximos. Níveis maiores ampliam dano, raio e frequência; o efeito é uma onda azul que empurra visualmente a água.',apply:()=>upgrades.repulse=Math.min(3,(upgrades.repulse||0)+1)},
 {id:'pressureCocoon',name:'Casulo de Pressão',icon:'⬡',desc:'Quando o escudo chega a zero, recompõe automaticamente 1 carga após 24, 20 ou 16 segundos. Não acumula acima de 1 carga regenerada.',apply:()=>upgrades.pressureCocoon=Math.min(3,(upgrades.pressureCocoon||0)+1)},
 {id:'vitality',name:'Reserva Vital',icon:'✚',desc:'Aumenta a vida máxima em 10% por nível e cura imediatamente o valor acrescentado. O núcleo vital ganha um anel interno adicional.',apply:()=>{const previous=maxHp;maxHp=Math.round(maxHp*1.1);hp=Math.min(maxHp,hp+(maxHp-previous));upgrades.vitality=Math.min(3,(upgrades.vitality||0)+1)}},
 {id:'predator',name:'Instinto Predatório',icon:'☠',desc:'Aumenta todo o dano causado em 8% por nível, até 24%. Quando um alvo entra no alcance, marcas predatórias rubras orbitam o núcleo.',apply:()=>upgrades.predator=Math.min(3,(upgrades.predator||0)+1)},
 {id:'closePressure',name:'Pressão de Caça',icon:'⌾',desc:'Causa +8% de dano por nível contra criaturas muito próximas. Recompensa posicionamento agressivo sem aumentar o dano a longa distância.',apply:()=>upgrades.closePressure=Math.min(3,(upgrades.closePressure||0)+1)}
];
const COMBO_SKILLS={
 gravitationalRupture:{id:'gravitationalRupture',name:'Ruptura gravitacional',icon:'✹',desc:'Fusão de Pulso de Ruptura + Nova Gravitacional no nível 3. Mantém um campo ao redor do jogador que causa dano periódico dentro do alcance de disparo.'},
 arcChain:{id:'arcChain',name:'Cadeia de Arcos',icon:'ϟ',desc:'Fusão de Tempestade Elétrica + Pulso Intenso no nível 3. Descargas encadeadas atingem até 8 inimigos dentro do campo elétrico.'},
 abyssEye:{id:'abyssEye',name:'Olho do Abismo',icon:'◉',desc:'Fusão de Lança do Abismo + Olho Profundo no nível 3. Os disparos deixam de respeitar o limite normal de alcance e seguem até atingir uma criatura ou obstáculo.'},
 vitalDrain:{id:'vitalDrain',name:'Dreno Vital',icon:'✚',desc:'Fusão de Membrana Viva + Pulso Intenso no nível 3. Converte 2% do dano causado em vida.'}
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
 const selected=Object.entries(upgradeLevels).filter(([id,rank])=>Number(rank)>0&&!(gravitationalRuptureActive&&['burst','nova'].includes(id))&&!(arcChainActive&&['electric','power'].includes(id))&&!(upgrades.abyssEye&&['pierce','range'].includes(id))&&!(upgrades.vitalDrain&&['regen'].includes(id))).sort((a,b)=>a[0].localeCompare(b[0]));
 const signature=selected.map(([id,rank])=>id+':'+rank).join('|')||'none';
 // Avoid replacing focused/clicked skill buttons on every simulation frame.
 if(signature===selectedSkillsRenderedSignature&&panel.dataset.skillsSignature===signature)return;
 selectedSkillsRenderedSignature=signature;panel.dataset.skillsSignature=signature;
 panel.innerHTML=selected.length?selected.map(([id,rank])=>{const skill=upgradeList.find(item=>item.id===id)||COMBO_SKILLS[id];return skill?'<button type="button" class="selected-skill-row" data-skill-id="'+skill.id+'" aria-label="Ver descrição: '+skill.name+'"><span>'+skill.icon+'</span><span class="selected-skill-name">'+skill.name+'</span><strong>NV '+rank+'</strong></button>':''}).join(''):'<p class="selected-skills-empty">Nenhuma habilidade adquirida</p>';
 requestAnimationFrame(positionMobileRightStack);}
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
function positionMobileRightStack(){
 if(!document.body.classList.contains('mobile-game-active'))return;
 const panel=$('selectedSkillsPanel'),end=$('endDiveBtn'),room=$('roomBadge');if(!panel)return;
 const shell=$('gameShell'),shellRect=shell?.getBoundingClientRect?.(),panelRect=panel.getBoundingClientRect(),gap=8;
 const top=Math.max(0,panelRect.bottom-(shellRect?.top||0)+gap);
 if(end){end.style.top=top+'px';end.style.right='var(--game-safe-right)';}
 if(room){const endHeight=end&&getComputedStyle(end).display!=='none'?end.getBoundingClientRect().height:0;room.style.top=(top+endHeight+gap)+'px';room.style.right='var(--game-safe-right)';}
}
function hideSkillDescription(){const tooltip=$('skillDescriptionTooltip');if(tooltip)tooltip.hidden=true;}
const selectedSkillPanel=$('selectedSkillsList');
// Ranking position is owned by responsive CSS. Do not write inline top/right values here.
selectedSkillPanel?.addEventListener('pointerover',event=>{if(event.pointerType==='mouse'){const row=event.target.closest('[data-skill-id]');if(row)showSkillDescription(row.dataset.skillId,row);}});
selectedSkillPanel?.addEventListener('pointerout',event=>{if(event.pointerType==='mouse'&&!event.relatedTarget?.closest?.('[data-skill-id]'))hideSkillDescription();});
selectedSkillPanel?.addEventListener('click',event=>{const row=event.target.closest('[data-skill-id]');if(row)showSkillDescription(row.dataset.skillId,row);});
document.addEventListener('click',event=>{if(!event.target.closest?.('#selectedSkillsPanel'))hideSkillDescription();});
function chooseUpgrade(u){
 if(gameState!=='upgrade'||!u||!runResonanceIds.includes(u.id)||(upgradeLevels[u.id]||0)>=3)return;
 clearUpgradeCountdown();gameState='upgrade-applying';
 u.apply();
 if(player){player.invuln=3;hp=maxHp;}
 if(onlineMode)window.AbyssalOnline?.sendProtection?.(3,'upgrade-selected');
 upgradeLevels[u.id]=(upgradeLevels[u.id]||0)+1;
 let combinedNow=false,combinedSkillName='';
 if(!upgrades.gravitationalRupture&&upgradeLevels.burst>=3&&upgradeLevels.nova>=3){
  upgrades.burst=0;upgrades.nova=0;upgrades.gravitationalRupture=1;
  upgradeLevels.gravitationalRupture=1;combinedNow=true;combinedSkillName=COMBO_SKILLS.gravitationalRupture.name;
  if(player)player.gravitationalRuptureTimer=0;
 }
 if(!upgrades.abyssEye&&upgradeLevels.pierce>=3&&upgradeLevels.range>=3){upgrades.pierce=0;upgrades.range=0;upgrades.abyssEye=1;upgradeLevels.abyssEye=1;combinedNow=true;combinedSkillName=COMBO_SKILLS.abyssEye.name;discoverCodexSkill('abyssEye');}
 if(!upgrades.vitalDrain&&upgradeLevels.regen>=3&&upgradeLevels.power>=3){upgrades.regen=0;upgrades.vitalDrain=1;upgradeLevels.vitalDrain=1;combinedNow=true;combinedSkillName=COMBO_SKILLS.vitalDrain.name;discoverCodexSkill('vitalDrain');}
 if(!upgrades.arcChain&&upgradeLevels.electric>=3&&upgradeLevels.power>=3){
  upgrades.electric=0;upgrades.arcChain=1;
  upgradeLevels.arcChain=1;combinedNow=true;combinedSkillName=COMBO_SKILLS.arcChain.name;
  if(player)player.arcChainTimer=0;
 }
 if(onlineMode)window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet,rangeStrength:upgrades.range,arcChainActive:Boolean(upgrades.arcChain),ricochetLevel:upgrades.ricochet,electricLevel:upgrades.electric,shellLevel:upgrades.shell,lastStandLevel:upgrades.lastStand});
 // Save through the shared codex cache; referencing a local, undefined "codex" here
 // used to throw before the level-up overlay closed, breaking both click and auto-pick.
 discoverCodexSkill(u.id);
 if (!areAllUpgradesMaxed()) { level++; } else { level = 'MAX'; }
 gameState='playing';$('upgradeScreen').hidden=true;renderSelectedSkills();
 if(combinedNow){const nickname=window.AbyssalOnline?.getAccount?.()?.nickname||'Mergulhador';enqueueGameplayNotice('fusion',combinedSkillName.toUpperCase(),`${nickname} fundiu habilidades e despertou ${combinedSkillName}.`,60);if(onlineMode)window.AbyssalOnline?.sendFusion?.(combinedSkillName);}else showToast(`${u.name.toUpperCase()} · NÍVEL ${upgradeLevels[u.id]}/3`);
 playSkillSound(combinedNow?'nova':u.id,'learn');updateHud();last=performance.now();
 if(xp>=xpNeed){xp-=xpNeed;xpNeed=Math.floor(xpNeed*1.34+3);setTimeout(()=>{if(gameState==='playing')offerUpgrade()},0)}
}

function areAllUpgradesMaxed(){return upgradeList.filter(u=>runResonanceIds.includes(u.id)).every(u=>(upgradeLevels[u.id]||0)>=3);}

function offerUpgrade(){
 if(gameState==='upgrade'||gameState==='upgrade-applying')return;
 if(areAllUpgradesMaxed()){$('upgradeScreen').hidden=true;return;}
 clearUpgradeCountdown();
 gameState='upgrade';chosen=[];
 const available=upgradeList.filter(u=>runResonanceIds.includes(u.id)&&(upgradeLevels[u.id]||0)<3);
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
 const isBossType = type === 'boss' || BOSS_KINDS.includes(type);
 if(isBossType&&(bossCount>=MAX_BOSSES||enemies.length>=MAX_ENEMIES))return null;
 if(!isBossType&&commonCount>=MAX_COMMON_ENEMIES)return null;
 // Shared catalog + spawn-point logic: solo and online use identical anatomy, stats and corner vortices.
 const ai=window.AbyssalEnemyAI;
 const activeKinds=enemies.map(e=>e.kind);
 let kind;
 if(BOSS_KINDS.includes(type)){
  kind = type;
 } else if(type==='boss'){
  kind = ai?.chooseBossKind(activeKinds,Math.random,bossIndex++)||BOSS_KINDS.find(k=>!activeKinds.includes(k));
 } else {
  kind = ai?.chooseCommonKind()||(()=>{const t=Math.random();return t<.56?'drifter':t<.78?'stinger':t<.94?'brute':'lurker'})();
 }
 if(kind==='whiteShark'){
  const whiteSharkCount=enemies.filter(e=>e.kind==='whiteShark').length;
  if(whiteSharkCount>=10)kind='drifter';
 }
 if(!kind)return null;
 const data=ai?.statsForKind(kind)||({
  boss:{r:40,hp:5640,speed:52,damage:25,color:'#ff315f',value:55},
  leviathan:{r:54,hp:9400,speed:44,damage:34,color:'#4ce0d1',value:90},
  maw:{r:45,hp:7500,speed:58,damage:31,color:'#c16cff',value:75},
  angler:{r:35,hp:6520,speed:66,damage:28,color:'#ffb45e',value:65},
  kraken:{r:80,hp:18400,speed:20,damage:38,color:'#8b5cf6',value:180},
  drifter:{r:10,hp:22,speed:51,damage:8,color:'#ff769d',value:1},
  stinger:{r:7,hp:13,speed:88,damage:6,color:'#ffbc78',value:2},
  brute:{r:16,hp:65,speed:30,damage:15,color:'#bd88ff',value:4},
  lurker:{r:20,hp:100,speed:43,damage:18,color:'#6e8dff',value:6}
 })[kind];
 if(isBossType){
  // Preserve the ordered base HP tiers in solo just as in the online simulation.
  data.hp = Math.round(data.hp * getBossCycleMultiplier());
  // A progressão por ciclo altera somente a vida; dano e velocidade base do boss são preservados.
  lastBossMaxHp=data.hp;lastBossDamage=data.damage;lastBossSpeed=data.speed;bossIndex++;
 }
 const point=ai?.chooseSpawnPoint?ai.chooseSpawnPoint(Math.random,null,W,H):{x:rand(100,290),y:rand(90,250)};
 const x=clamp(point.x,70/GAME_WORLD_ZOOM,W-70/GAME_WORLD_ZOOM),y=clamp(point.y,70/GAME_WORLD_ZOOM,H-70/GAME_WORLD_ZOOM);
 const enemy={id:++enemyId,x,y,...data,r:data.r/GAME_WORLD_ZOOM,speed:data.speed/GAME_WORLD_ZOOM,maxHp:data.hp,angle:rand(0,6.28),phase:rand(0,6.28),hit:0,attackCd:rand(.3,1),kind,suctionActive:false,suctionTimer:0,suctionCooldown:kind==='devourer'?20:0,suctionPulse:0,krakenSweepTimer:kind==='kraken'?3.5:0,krakenSweepActive:false,krakenTelegraph:0,krakenSweepCycle:0};
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
 const shellReduction=Math.min(.24,Math.max(0,Number(upgrades.shell)||0)*.08),lowHealthReduction=(hp<=maxHp*.3&&upgrades.lastStand>0)?.2:0;const received=Math.max(1,dmg*(SkinAbilities?.incomingDamageMultiplier(equippedSkin)||1)*(1-shellReduction)*(1-lowHealthReduction));hp-=received;player.invuln=equippedSkin==='violet'?1:.8;shake=8;damageFlash=.25;burst(player.x,player.y,'#ff668d',14,120);audio(120,.16,'sawtooth',.03);if(hp<=0)endGame();
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
 if((data.reason==='enemy-attack'||data.reason==='pvp-hit'||data.reason==='pvp-defeat')&&Number(data.damage)>0){spawnDamageNumber(player.x,player.y,Number(data.damage),damageTone(data.skillId));
  if(contactSourceReady)revealOnlineContactSource(data);
  else if(!data.targetWasHidden){window.AbyssalOnline?.requestWorldSnapshot?.('contact-resync');}
  shake=Math.max(shake,6);damageFlash=.22;burst(player.x,player.y,'#ff668d',12,100);audio(115,.14,'sawtooth',.025);
 }else if(data.reason==='shield-block'||data.reason==='pvp-shield'||data.blocked){
  if(contactSourceReady)revealOnlineContactSource(data);
  burst(player.x,player.y,'#7ceff2',16,110);playSkillSound('shield','trigger');
 }else if(data.reason==='regeneration'&&Number(data.healed)>0)playSkillSound('regen','trigger');
 updateHud();
 if(data.alive===false&&gameState!=='over'){endGame();}
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
function spawnNovaVisual(x,y,max,color='#72f5ff',pvp=onlineRoomMode==='pvp'){
 const radius=Math.max(1,Number(max)||294/GAME_WORLD_ZOOM);
 effects.push({type:'nova-core',x,y,r:0,max:Math.min(radius*.16,52/GAME_WORLD_ZOOM),life:.34,maxLife:.34,color});
 if(pvp){
  effects.push({type:'occluded-ring',x,y,r:0,max:radius,life:.7,maxLife:.7,color:'#7568ff'});
  effects.push({type:'occluded-ring',x,y,r:0,max:radius*.72,life:.52,maxLife:.52,color:'#b8aaff'});
 }else{
  burst(x,y,color,24,Math.min(360,radius*.4));
  effects.push({type:'ring',x,y,r:0,max:radius,life:.7,maxLife:.7,color:'#7568ff'});
  effects.push({type:'ring',x,y,r:0,max:radius*.72,life:.52,maxLife:.52,color:'#b8aaff'});
 }
}
function spawnProjectileDissolve(x,y,color='#9bbcff',special=null,blocked=false){
 const palette=special==='electric'?'#8ff8ff':special==='photon'?'#ffb8fa':special==='pierce'?'#ffd980':special==='spread'?'#d8b4fe':color;
 burst(x,y,palette,blocked?11:8,blocked?105:78);
 effects.push({type:'projectile-dissolve',x,y,r:0,max:(blocked?24:18)/GAME_WORLD_ZOOM,life:.24,maxLife:.24,color:palette});
}
function damageTone(skillId=''){
 const id=String(skillId||'').toLowerCase();
 if(id.includes('poison')||id.includes('toxic')||id.includes('venom')||id.includes('greensnake'))return 'poison';
 if(id.includes('electric')||id.includes('arc')||id.includes('ricochet'))return 'energy';
 return 'physical';
}
function spawnDamageNumber(x,y,amount,tone='physical'){
 const value=Math.max(0,Number(amount)||0);if(!value||!Number.isFinite(x)||!Number.isFinite(y))return;
 damageNumbers.push({x,y,value:Math.max(1,Math.round(value)),tone,life:2,maxLife:2,driftX:(Math.random()-.5)*12/GAME_WORLD_ZOOM});
 if(damageNumbers.length>180)damageNumbers.splice(0,damageNumbers.length-180);
}
function spawnBloodPool(x,y,r=18/GAME_WORLD_ZOOM,angle=Math.random()*Math.PI*2){
 if(!Number.isFinite(x)||!Number.isFinite(y))return;
 const radius=Math.max(14/GAME_WORLD_ZOOM,Number(r)||0),seed=Math.random()*10000,lobes=[];
 for(let i=0;i<9;i++){const a=i*Math.PI*2/9+(Math.random()-.5)*.42,reach=radius*(.62+Math.random()*.92);lobes.push({a,reach,width:radius*(.22+Math.random()*.34)});}
 const droplets=Array.from({length:8},(_,i)=>{const spread=(Math.random()-.5)*1.25,jet=radius*(1.05+Math.random()*(i<3?2.8:1.5));return{a:angle+spread,d:jet,r:radius*(.07+Math.random()*.14),stretch:1.2+Math.random()*2.4};});
 bloodPools.push({x,y,r:radius,angle,seed,lobes,droplets,life:5,maxLife:5});
 if(bloodPools.length>40)bloodPools.shift();
}
function triggerHitSynergies(primaryTarget,baseDamage,sourceSkill,options={}){
 if(!primaryTarget||!Number.isFinite(baseDamage)||baseDamage<=0||options.secondary)return;
 const source=String(sourceSkill||'physical');
 // Hit modifiers are geometry-agnostic: projectiles, beams and radial attacks all participate.
 if((upgrades.electric||0)>0&&source!=='arcChain'){
  let chains=0,from=primaryTarget;const level=Math.max(1,Math.min(3,Number(upgrades.electric)||1)),visited=new Set([primaryTarget.id]),range=shotBalanceValue('electric','chainRange',level,130)/GAME_WORLD_ZOOM;
  while(chains<level){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(other.hp>0&&!visited.has(other.id)&&d<range&&d<nd){next=other;nd=d}}if(!next)break;effects.push({type:'electric-arc',x1:from.x,y1:from.y,x2:next.x,y2:next.y,seed:(Number(from.id)||chains)*17+(Number(next.id)||0),life:.18,maxLife:.18,color:'#52e8ff'});dealEnemyDamage(next,baseDamage*shotBalanceValue('electric','chainDamage',level,.34),'electric',{secondary:true});visited.add(next.id);from=next;chains++;}
 }
 if((upgrades.ricochet||0)>0&&source!=='ricochet'){
  let from=primaryTarget;const visited=new Set([primaryTarget.id]);for(let bounce=0;bounce<Math.min(3,upgrades.ricochet);bounce++){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(other.hp>0&&!visited.has(other.id)&&d<190/GAME_WORLD_ZOOM&&d<nd){next=other;nd=d}}if(!next)break;effects.push({type:'ricochet-arc',x1:from.x,y1:from.y,x2:next.x,y2:next.y,life:.22,maxLife:.22,color:'#ffad55'});burst(next.x,next.y,'#ffc47a',10,110);dealEnemyDamage(next,baseDamage*.42,'ricochet',{secondary:true});visited.add(next.id);from=next;}
 }
}
function dealEnemyDamage(enemy, damage, skillId=null, options={}){
  score += Math.round(damage);
 if(!enemy||!Number.isFinite(damage)||damage<=0)return;
 if(skillId&&options.silentSound!==true)playSkillSound(skillId,'trigger');
 if(upgrades.vitalDrain&&player&&Number.isFinite(damage)&&damage>0){const actualDamage=Math.min(damage,Math.max(0,Number(enemy?.hp)||damage))*(1+Math.min(.24,Math.max(0,Number(upgrades.predator)||0)*.08));hp=Math.min(maxHp,hp+actualDamage*.02);}

  if(equippedSkin==='electriceel' && enemy && enemy.hp > 0){
    enemy.paralyzedUntil = Math.max(enemy.paralyzedUntil || 0, performance.now() + 100);
    burst(enemy.x, enemy.y, '#38e8ff', 3, 50);
  }


  if(equippedSkin==='greensnake' && enemy && enemy.hp > 0) {
    enemy.poisonTimer = Math.max(enemy.poisonTimer || 0, 4.0);
  }

 if(onlineMode){
   const distance=Math.hypot(player.x-enemy.x,player.y-enemy.y),predatorMultiplier=1+Math.min(.24,Math.max(0,Number(upgrades.predator)||0)*.08),closeMultiplier=distance<=175/GAME_WORLD_ZOOM?1+Math.min(.24,Math.max(0,Number(upgrades.closePressure)||0)*.08):1,queuedDamage=Number(damage)*predatorMultiplier*closeMultiplier;
   onlineDamageQueue.push({id:Number(enemy.id),damage:queuedDamage,skillId:String(skillId||'').slice(0,32)});
   // O servidor continua autoritativo para HP; as sinergias são derivadas do impacto confirmado localmente
   // e cada dano secundário também entra na fila autoritativa.
   enemy.hit=.14;
   if(options.visual!==false)burst(enemy.x,enemy.y,'#c4b4ff',3,50);
   triggerHitSynergies(enemy,queuedDamage,skillId,options);
   return;
 }
 const distance=Math.hypot(player.x-enemy.x,player.y-enemy.y);
 const multiplier=SkinAbilities?.damageMultiplier(equippedSkin,enemy.kind,distance,hp/maxHp)||1,closeMultiplier=distance<=175/GAME_WORLD_ZOOM?1+Math.min(.24,Math.max(0,Number(upgrades.closePressure)||0)*.08):1;
 const appliedDamage=damage*(1+Math.min(.24,Math.max(0,Number(upgrades.predator)||0)*.08))*closeMultiplier*multiplier;enemy.hp-=appliedDamage;enemy.hit=.14;if(options.visual!==false)spawnDamageNumber(enemy.x,enemy.y,appliedDamage,damageTone(skillId));
 // O impacto gera modificadores antes de remover o alvo. Assim um golpe fatal ainda pode ricochetear.
 triggerHitSynergies(enemy,appliedDamage,skillId,options);
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
 if(data.bossesDefeated!=null&&Number.isFinite(Number(data.bossesDefeated))){
  const defeated=Math.max(0,Math.floor(Number(data.bossesDefeated)||0));
  const cycleLength=Math.max(1,bossCycleBosses.length||PROGRESSION_CYCLE_BOSS_SEQUENCE.length);
  bossProgressionCycle=Math.floor(defeated/cycleLength);
  bossCycleIndex=defeated%cycleLength;
  bossCycleStreak=bossCycleIndex;
  const snapshotBosses=data.enemies.filter(enemy=>enemy&&BOSS_KINDS.includes(enemy.kind));
  activeBossEntities=snapshotBosses.map(enemy=>({id:enemy.id,kind:enemy.kind}));
  activeBossEntity=activeBossEntities[0]||null;
  progressionPausedForBoss=activeBossEntities.length>0||data.progressionPausedForBoss===true;
  progressionDistance=progressionPausedForBoss?100:clamp(Number(data.progressionDistance)||0,0,100);
  bossVictoryPending=false;
  updateProgressionTrackUI();
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
  enemy.suctionActive=row[7]===true;enemy.suctionTimer=Math.max(0,Number(row[8])||0);enemy.suctionCooldown=Math.max(0,Number(row[9])||0);enemy.suctionPulse=Math.max(0,Number(row[10])||0);enemy.krakenSweepActive=row[11]===true;enemy.krakenTelegraph=clamp(Number(row[12])||0,0,1);enemy.krakenSweepCycle=Math.max(0,Number(row[13])||0);
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
 discoverCodexMonsters([e.kind]);if(!onlineMode){const xpValue=killedBoss?Math.round(e.value*getBossXpMultiplier()):e.value;addOrb(e.x,e.y,xpValue);}burst(e.x,e.y,e.color,killedBoss?(e.kind==='kraken'?56:48):e.kind==='brute'?22:12,killedBoss?250:e.kind==='brute'?145:95);if(killedBoss){coins+=100;addNotification('Você ganhou 100 moedas abissais por derrotar um boss.','RECOMPENSA DE BOSS · +100 MOEDAS','coins');showToast('BOSS ABISSAL DERROTADO · +100 MOEDAS');saveCosmetics();}
 if(equippedSkin==='devourer'&&killedBoss){player.devourerVacuumUntil=performance.now()+5000;showToast('VÁCUO RESIDUAL · ORBES ATRAÍDOS');}
 if(!onlineMode&&equippedSkin==='coral')hp=Math.min(maxHp,hp+4);
 enemies.splice(i,1);audio(e.kind==='brute'?160:260,.055,'triangle',.012);updateHud();
}
function getFiringRange(){if(upgrades.abyssEye)return Math.hypot(W,H);return 294*(upgrades.range||1)*(SkinAbilities?.targetRangeMultiplier(equippedSkin)||1)/GAME_WORLD_ZOOM;}
const SHOT_BALANCE=Object.freeze({
 electric:{damage:[0,11,13,15],speed:[0,1.02,1.06,1.10],radius:[0,4.2,4.5,4.8],chainDamage:[0,.38,.34,.30],chainRange:[0,125,140,155]},
 pierce:{damage:[0,13,16,19],speed:[0,.86,.90,.94],radius:[0,5.4,6.0,6.6]},
 spread:{damage:[0,6.0,4.6,3.8],speed:[0,.94,.96,.98],radius:[0,3.5,3.5,3.6]},
 photon:{damage:[0,14,18,22],speed:[0,1.55,1.82,2.08],radius:[0,2.9,3.1,3.3]},
 photonRay:{damage:[0,10,13,16]},
 nova:{damage:[0,10,13,16]},
 echoShot:{damage:[0,8,10,12],speed:[0,1.05,1.08,1.12],radius:[0,3.7,4.0,4.3]}
});
function shotBalanceValue(id,key,level,fallback){const cfg=SHOT_BALANCE[id],rank=Math.max(1,Math.min(3,Math.trunc(Number(level)||1))),value=cfg?.[key]?.[rank];return Number.isFinite(value)?value:fallback;}
function getShotDamageAtLevel(level,shotId=null){const rank=Math.max(1,Math.min(3,Math.trunc(Number(level)||1)));return shotBalanceValue(shotId,'damage',rank,[0,12,15,18][rank]);}
function isPcMouseAimMode(){return !isMobileDevice()&&controlSettings.pc==='wasd-aim';}
function updateMouseAimFromCursor(){if(!isPcMouseAimMode()||!player||!Number.isFinite(pointer.clientX)||!Number.isFinite(pointer.clientY))return;const rect=canvas.getBoundingClientRect();pointer.x=cameraX+(pointer.clientX-rect.left)/worldZoom;pointer.y=cameraY+(pointer.clientY-rect.top)/worldZoom;controlAimAngle=Math.atan2(pointer.y-player.y,pointer.x-player.x);player.angle=controlAimAngle;}
function getActiveShotId(){if(RESONANCE_CATEGORIES.shots.includes(runShotId))return runShotId;const preset=resonancePresets[onlineRoomMode==='pvp'?'pvp':'pve']||[];return preset.find(id=>RESONANCE_CATEGORIES.shots.includes(id))||'electric';}
function nextShotVolleyId(){if(!player)return '';player.shotSequence=(Number(player.shotSequence)||0)+1;return Date.now().toString(36)+'-'+player.shotSequence;}
function fire(){
 if(!player||Number(upgrades.nova)>0||Number(upgrades.photonRay)>0)return;let target=null,bd=Infinity;const maxRange=getFiringRange();
 if(onlineRoomMode==='pvp'){
  const peers=window.AbyssalOnline?.getPlayers?.()||[];
  for(const peer of peers){if(!peer||peer.alive===false)continue;const d=Math.hypot((Number(peer.x)||0)-player.x,(Number(peer.y)||0)-player.y);if(d<maxRange&&d<bd){target=peer;bd=d;}}
 }else for(const e of enemies){const d=dist(player,e);if(d<maxRange&&d<bd){target=e;bd=d}}
 const mouseAimMode=isPcMouseAimMode(),aimedMode=mouseAimMode||(isMobileDevice()&&controlSettings.mobile==='dual-stick');
 if(!target&&!aimedMode)return;
 if(mouseAimMode)updateMouseAimFromCursor();
 const a=aimedMode?controlAimAngle:Math.atan2(target.y-player.y,target.x-player.x);
 const activeShot=getActiveShotId()||'electric',shotLevel=Math.max(1,Number(upgradeLevels[activeShot])||1);
 const baseDamage=shotLevel?getShotDamageAtLevel(shotLevel,activeShot):12;
 const shotDamage=baseDamage*(upgrades.power||1);
 const shotSpeed=430*shotBalanceValue(activeShot,'speed',shotLevel,1)/GAME_WORLD_ZOOM;
 const shotColor=activeShot==='spread'?'#d8b4fe':activeShot==='echoShot'?'#5ef0d0':activeShot==='photon'?'#f0abfc':activeShot==='electric'?'#eaffff':activeShot==='pierce'?'#ffe7a1':'#83fff3';
 let offsets=[0];if(activeShot==='spread'){offsets=shotLevel>=3?[0,-.12,.12,-.24,.24,-.36,.36]:shotLevel===2?[0,-.14,.14,-.28,.28]:[0,-.18,.18];}else if(activeShot==='echoShot'){offsets=[-.045,.045];}
 const angles=offsets.map(offset=>a+offset),volleyId=nextShotVolleyId(),volleyHitIds=[];
 for(const shotAngle of angles){const damage=shotDamage;const projectileRadius=shotLevel?shotBalanceValue(activeShot,'radius',shotLevel,4.1+(shotLevel-1)*.55):4.1;const special=activeShot==='photon'?'photon':activeShot==='pierce'?'pierce':activeShot==='electric'?'electric':activeShot==='echoShot'?'echoShot':activeShot==='spread'?'spread':null;const modifiers={abyssEye:Boolean(upgrades.abyssEye),ricochet:Math.max(0,Number(upgrades.ricochet)||0)};projectiles.push({x:player.x+Math.cos(shotAngle)*13/GAME_WORLD_ZOOM,y:player.y+Math.sin(shotAngle)*13/GAME_WORLD_ZOOM,vx:Math.cos(shotAngle)*shotSpeed,vy:Math.sin(shotAngle)*shotSpeed,r:projectileRadius/GAME_WORLD_ZOOM,life:upgrades.abyssEye?18:1.33,travelled:0,maxDistance:upgrades.abyssEye?Math.hypot(W,H):Math.max(0,maxRange-13/GAME_WORLD_ZOOM),damage,pierceRemaining:activeShot==='pierce'?(upgrades.pierce||shotLevel):0,hitIds:volleyHitIds,color:shotColor,special,modifiers});if(onlineMode&&window.AbyssalOnline?.sendShot)window.AbyssalOnline.sendShot({x:(player.x+Math.cos(shotAngle)*13/GAME_WORLD_ZOOM)/W,y:(player.y+Math.sin(shotAngle)*13/GAME_WORLD_ZOOM)/H,vx:Math.cos(shotAngle)*shotSpeed/W,vy:Math.sin(shotAngle)*shotSpeed/H,damage,color:shotColor,special,modifiers,volleyId});} player.angle=a;const muzzleX=player.x+Math.cos(a)*15,muzzleY=player.y+Math.sin(a)*15;burst(muzzleX,muzzleY,shotColor,angles.length>1?9:5,angles.length>1?90:45);if(activeShot==='photon')effects.push({type:'photon-flash',x1:player.x,y1:player.y,x2:muzzleX+Math.cos(a)*46/GAME_WORLD_ZOOM,y2:muzzleY+Math.sin(a)*46/GAME_WORLD_ZOOM,width:2.2/GAME_WORLD_ZOOM,life:.08,maxLife:.08,color:'#ff9cf6'});audio(500,.045,'sine',.008);
}
function update(dt){
 const isPvpMode=onlineRoomMode==='pvp';
 if((gameState!=='playing'&&!(onlineMode&&gameState==='upgrade'))||!player)return;
 // Movimento local responsivo: teclado e toque/arraste. No online, trocar de aba nunca pausa o estado local intencionalmente.
 if(gameState==='playing'){
   // Correntezas ambientais removidas: o movimento depende apenas dos comandos do jogador.
   player.pulseCooldown=Math.max(0,(player.pulseCooldown||0)-dt);player.violetCooldown=Math.max(0,(player.violetCooldown||0)-dt);player.dashCooldown=Math.max(0,(player.dashCooldown||0)-dt);player.dashTime=Math.max(0,(player.dashTime||0)-dt);updateAbilityButtons();
   let mx=(keys['d']||keys['D']||keys['ArrowRight']?1:0)-(keys['a']||keys['A']||keys['ArrowLeft']?1:0);
   let my=(keys['s']||keys['S']||keys['ArrowDown']?1:0)-(keys['w']||keys['W']||keys['ArrowUp']?1:0);
   if(isMobileDevice()&&joystickVector.active){mx=joystickVector.x;my=joystickVector.y;}
   else if(!isMobileDevice()&&controlSettings.pc==='classic'&&(autoFollowCursor||pointer.down)){const dx=pointer.x-player.x,dy=pointer.y-player.y,dd=Math.hypot(dx,dy);if(dd>12){mx=dx/dd;my=dy/dd}else{mx=0;my=0}}
   if(isPcMouseAimMode())updateMouseAimFromCursor();
   if(isMobileDevice()&&controlSettings.mobile==='dual-stick'&&aimJoystickVector.active){controlAimAngle=Math.atan2(aimJoystickVector.y,aimJoystickVector.x);player.angle=controlAimAngle;}
   const mag=Math.hypot(mx,my)||1; if(mx||my){if(upgradeLevels.speed>0)playSkillSound('speed','trigger');const isGhostDash=Boolean(player.ghostDashUntil&&performance.now()<player.ghostDashUntil);const normalBaseSpeed=player.moveSpeed*upgrades.speed*(SkinAbilities?.movementMultiplier(equippedSkin)||1);const dashMultiplier=isGhostDash?Math.max(1,(500/GAME_WORLD_ZOOM)/Math.max(1,normalBaseSpeed)):(player.dashTime>0?2.05:1);const nx=player.x+mx/mag*normalBaseSpeed*dashMultiplier*dt,ny=player.y+my/mag*normalBaseSpeed*dashMultiplier*dt;const wall=52/GAME_WORLD_ZOOM;let nextX=clamp(nx,wall+player.r,W-wall-player.r),nextY=clamp(ny,wall+player.r,H-wall-player.r);if(onlineRoomMode==='pvp'){for(const rock of arenaRocks){if(rock.visualOnly)continue;const a=-(rock.angle||0),ox=nextX-rock.x,oy=nextY-rock.y,lx=ox*Math.cos(a)-oy*Math.sin(a),ly=ox*Math.sin(a)+oy*Math.cos(a),rx=(rock.rx||rock.r)+player.r,ry=(rock.ry||rock.r)+player.r,nx=lx/Math.max(1,rx),ny=ly/Math.max(1,ry);if(nx*nx+ny*ny<1){const d=Math.hypot(nx,ny)||1;const pushX=nx/d*rx,pushY=ny/d*ry,ca=Math.cos(rock.angle||0),sa=Math.sin(rock.angle||0);nextX=rock.x+pushX*ca-pushY*sa;nextY=rock.y+pushX*sa+pushY*ca;}}}player.x=nextX;player.y=nextY;if(!((!isMobileDevice()&&controlSettings.pc==='wasd-aim')||(isMobileDevice()&&controlSettings.mobile==='dual-stick')))player.angle=Math.atan2(my,mx);updateCamera();player.trail.push({x:player.x,y:player.y,life:.28});if(player.trail.length>12)player.trail.shift()}

   if (['reefshark', 'whiteShark'].includes(equippedSkin) && (mx || my)) {
     if (Math.random() < 0.45) {
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
     // As bolhas locais são criadas a cada frame, mas no online enviamos só 6-7
     // amostras por segundo para manter o efeito visível sem inundar o WebSocket.
     if (onlineMode && window.AbyssalOnline?.sendSkinAbility) {
       player.sharkTrailNetworkTimer = (Number(player.sharkTrailNetworkTimer) || 0) - dt;
       if (player.sharkTrailNetworkTimer <= 0) {
         player.sharkTrailNetworkTimer = 0.16;
         window.AbyssalOnline.sendSkinAbility({
           type: 'bubble-trail',
           skin: equippedSkin,
           x: clamp((player.x - Math.cos(player.angle || 0) * (player.r * 1.1)) / W, 0, 1),
           y: clamp((player.y - Math.sin(player.angle || 0) * (player.r * 1.1)) / H, 0, 1),
           angle: player.angle
         });
       }
     }
   }

   if(equippedSkin==='toxic'){
    player.toxicCloudTimer=(Number(player.toxicCloudTimer)||5)-dt;
    if(player.toxicCloudTimer<=0){
     player.toxicCloudTimer=5;
     const cloudRadius=190/GAME_WORLD_ZOOM;
     effects.push({type:'ring',x:player.x,y:player.y,r:0,max:cloudRadius,life:1.4,maxLife:1.4,color:'#75ff68'});
     burst(player.x,player.y,'#75ff68',30,95);
     for(const target of enemies){if(target.hp<=0||Math.hypot(target.x-player.x,target.y-player.y)>cloudRadius)continue;target.poisonTimer=Math.max(Number(target.poisonTimer)||0,5);dealEnemyDamage(target,8,'toxic-cloud',{silentSound:true});}
     if(onlineMode&&window.AbyssalOnline?.sendSkinAbility)window.AbyssalOnline.sendSkinAbility({skin:'toxic',x:player.x/W,y:player.y/H,angle:player.angle});
     playSkillSound('toxic-cloud','trigger');
    }
   }
   if(equippedSkin==='violet'&&player.violetCooldown<=0){
    player.violetCooldown=10;
    if(onlineMode&&window.AbyssalOnline?.sendSkinAbility)window.AbyssalOnline.sendSkinAbility({skin:'violet',x:player.x/W,y:player.y/H,angle:player.angle});
    const pulseTargets=enemies.map(e=>({e,d:Math.hypot(e.x-player.x,e.y-player.y)})).filter(v=>v.d<=230/GAME_WORLD_ZOOM).sort((a,b)=>a.d-b.d).slice(0,4);
    burst(player.x,player.y,'#bd91ff',28,155);effects.push({type:'beam',x1:player.x-34/GAME_WORLD_ZOOM,y1:player.y,x2:player.x+34/GAME_WORLD_ZOOM,y2:player.y,life:.24,maxLife:.24,color:'#d9b7ff'});
    for(const target of pulseTargets){dealEnemyDamage(target.e,22,'violet-resonance',{visual:true});burst(target.e.x,target.e.y,'#d7b7ff',7,75);}
   }
   player.fireTimer=(player.fireTimer||0)-dt;if(player.fireTimer<=0){fire();player.fireTimer=Math.max(.12,.52/((upgrades.rate||1)*(SkinAbilities?.fireRateMultiplier(equippedSkin)||1)))}
 }
 if(onlineMode&&authoritativeElapsed!==null&&lastSnapshotAt){elapsed=authoritativeElapsed+Math.max(0,(performance.now()-lastSnapshotAt)/1000);}else elapsed+=dt;if(!onlineMode){spawnTimer-=dt;updateBossProgressionStep(dt);}else{updateBossProgressionStep(dt);}

  // Gestão da esteira de bolhas do tubarão (dura 5 segundos e causa dano reduzido)
  for (let i = sharkWakeTrails.length - 1; i >= 0; i--) {
    const bubble = sharkWakeTrails[i];
    bubble.life -= dt;
    bubble.damageTimer = (bubble.damageTimer || 0) - dt;
    if (bubble.damageTimer <= 0) {
      bubble.damageTimer = 0.55;
      for (const e of enemies) {
        if (Math.hypot(e.x - bubble.x, e.y - bubble.y) <= bubble.r + (e.r || 10)) {
          dealEnemyDamage(e, 1, 'pelagic-wake', { visual: false, silentSound: true });
          burst(e.x, e.y, '#7bf5ff', 2, 30);
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
 // Spawn de boss solo gerenciado exclusivamente pelo sistema de progressão (updateBossProgressionStep).
 // O bloco antigo de nextBossAt foi removido para evitar spawns duplicados fora da progressão.
 if(!onlineMode&&upgrades.regen>0&&Math.random()<dt*upgrades.regen*.25){const beforeRegen=hp;hp=Math.min(maxHp,hp+1);if(hp>beforeRegen){playSkillSound('regen','trigger');effects.push({type:'regen-pulse',x:player.x,y:player.y,max:player.r*2.8,life:.55,maxLife:.55,color:'#67f5a0'});}}
 if(gameState==='playing'&&upgrades.ward>0){const interval=Math.max(18,28-(upgrades.ward-1)*4);if(!Number.isFinite(player.wardTimer))player.wardTimer=interval;player.wardTimer-=dt;if(player.wardTimer<=0){player.wardTimer=interval;player.invuln=Math.max(player.invuln,.55);burst(player.x,player.y,'#9deaff',14,105);effects.push({type:'ward-collapse',x:player.x,y:player.y,max:player.r*3.2,life:.55,maxLife:.55,color:'#8deaff'});playSkillSound('shield','trigger');}}
 if(gameState==='playing'&&upgrades.repulse>0){const interval=Math.max(6,12-(upgrades.repulse-1)*3);if(!Number.isFinite(player.repulseTimer))player.repulseTimer=interval;player.repulseTimer-=dt;if(player.repulseTimer<=0){player.repulseTimer=interval;const radius=(90+upgrades.repulse*22)/GAME_WORLD_ZOOM;for(const enemy of enemies){if(enemy.hp>0&&dist(player,enemy)<=radius)dealEnemyDamage(enemy,6+upgrades.repulse*3,'repulse',{silentSound:true});}effects.push({type:'ring',x:player.x,y:player.y,r:0,max:radius,life:.5,maxLife:.5,color:'#78dfff'});effects.push({type:'ring',x:player.x,y:player.y,r:0,max:radius*.68,life:.34,maxLife:.34,color:'#d9fbff'});}}
 if(gameState==='playing'&&upgrades.pressureCocoon>0){const cocoonInterval=[0,24,20,16][Math.min(3,upgrades.pressureCocoon)];if(upgrades.shield<=0){player.pressureCocoonTimer=(Number.isFinite(player.pressureCocoonTimer)?player.pressureCocoonTimer:cocoonInterval)-dt;if(player.pressureCocoonTimer<=0){player.pressureCocoonTimer=cocoonInterval;upgrades.shield=1;effects.push({type:'ward-collapse',x:player.x,y:player.y,max:player.r*3.6,life:.7,maxLife:.7,color:'#58d6c4'});burst(player.x,player.y,'#76f5df',18,100);if(onlineMode)window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet,rangeStrength:upgrades.range,arcChainActive:Boolean(upgrades.arcChain),ricochetLevel:upgrades.ricochet,electricLevel:upgrades.electric,shellLevel:upgrades.shell,lastStandLevel:upgrades.lastStand});}}else player.pressureCocoonTimer=cocoonInterval;}
 if(['reefshark','abysscroc','armoredgator'].includes(equippedSkin)){
  const cfg={reefshark:{cooldown:14,range:260,damage:18,arc:.48,width:58},abysscroc:{cooldown:16,range:210,damage:42,arc:.78,width:120},armoredgator:{cooldown:3,range:190,damage:45,arc:Math.PI,width:0}}[equippedSkin];
  player.predatorAbilityTimer=(Number(player.predatorAbilityTimer)||4)-dt;
  if(player.predatorAbilityTimer<=0){
   player.predatorAbilityTimer=cfg.cooldown;
   const angle=Number(player.angle)||0,range=cfg.range/GAME_WORLD_ZOOM;
   if(equippedSkin==='abysscroc')player.dashTime=.32;
   const targets=enemies.filter(e=>{const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy);if(d>range)return false;if(cfg.arc>=Math.PI)return true;const a=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(a-angle),Math.cos(a-angle));return Math.abs(delta)<=cfg.arc&&Math.abs(Math.sin(delta)*d)<=cfg.width/GAME_WORLD_ZOOM;}).sort((a,b)=>dist(player,a)-dist(player,b)).slice(0,8);
   const color=equippedSkin==='reefshark'?'#8bd8ec':equippedSkin==='abysscroc'?'#79bd83':'#c5a66e';
   if(equippedSkin!=='reefshark'){burst(player.x,player.y,color,28,175);effects.push({type:'ring',x:player.x,y:player.y,r:0,max:range,life:.42,maxLife:.42,color});}

   if(equippedSkin!=='reefshark'){
    for(const target of targets){
      dealEnemyDamage(target,cfg.damage,equippedSkin==='abysscroc'?'abysscroc-lunge':'armoredgator-spin',{visual:true});
      burst(target.x,target.y,color,7,90);
      if(equippedSkin==='armoredgator'){
        // Mantém o mesmo impulso que será processado pelo servidor online.
        const kdx=target.x-player.x,kdy=target.y-player.y;
        const kdd=Math.hypot(kdx,kdy)||1;
        target.kbVx=(kdx/kdd)*620;
        target.kbVy=(kdy/kdd)*620;
      }
    }
   }
   // O Tubarão-branco mantém apenas o rastro gerado ao se movimentar; não transmite mais o jato frontal.
   if(onlineMode && window.AbyssalOnline?.sendSkinAbility){
     window.AbyssalOnline.sendSkinAbility({skin: equippedSkin, x: player.x/W, y: player.y/H, angle: player.angle});
   }
  }
 }
 if(equippedSkin==='kraken'){
  const phase=performance.now()*.0018;
  const krakenProxy={kind:'kraken',x:player.x,y:player.y,r:player.r*1.45,angle:player.angle||0,phase};
  for(const target of enemies){
   if(!target||target.hp<=0)continue;
   if(!window.AbyssalEnemyAI?.touchesKrakenTentacle?.(krakenProxy,target,1))continue;
   const now=performance.now();if(now-(Number(target.krakenTentacleHitAt)||0)<420)continue;
   target.krakenTentacleHitAt=now;dealEnemyDamage(target,24,'kraken-contact');target.hit=.18;burst(target.x,target.y,'#a98bff',4,55);
  }
 }
 if(upgrades.burst>0){player.burstTimer=(player.burstTimer||0)-dt;if(player.burstTimer<=0){player.burstTimer=Math.max(3.5,7/upgrades.burst);for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<210*upgrades.range/GAME_WORLD_ZOOM){dealEnemyDamage(e,12*upgrades.burst,'burst');burst(e.x,e.y,'#b4a1ff',8,100)}}burst(player.x,player.y,'#b3a0ff',60,260);effects.push({type:'ring',x:player.x,y:player.y,r:0,max:210*upgrades.range/GAME_WORLD_ZOOM,life:.62,maxLife:.62,color:'#c18cff'});effects.push({type:'ring',x:player.x,y:player.y,r:0,max:145*upgrades.range/GAME_WORLD_ZOOM,life:.4,maxLife:.4,color:'#f0d9ff'});audio(500,.045,'sine',.008)}}
 if(upgrades.photonRay>0){
  player.photonRayTimer=(Number(player.photonRayTimer)||0)-dt;
  const beamLevel=Math.max(1,Math.min(3,Number(upgrades.photonRay)||1));
  const beamInterval=PHOTON_RAY_VISUAL.pulseInterval,width=PHOTON_RAY_VISUAL.widths[beamLevel]/GAME_WORLD_ZOOM,beamRange=getFiringRange();
  // Controle 2 owns manual continuous aiming. Controle 1 keeps automatic nearest-target aiming.
  const manualPhotonAim=(!isMobileDevice()&&controlSettings.pc==='wasd-aim')||(isMobileDevice()&&controlSettings.mobile==='dual-stick');
  let aimAngle=Number(player.angle)||0,hasAim=false;
  if(manualPhotonAim&&!isMobileDevice()&&Number.isFinite(pointer.clientX)&&Number.isFinite(pointer.clientY)){
   const rect=canvas.getBoundingClientRect();
   const cursorX=cameraX+(pointer.clientX-rect.left)/worldZoom;
   const cursorY=cameraY+(pointer.clientY-rect.top)/worldZoom;
   if(Math.hypot(cursorX-player.x,cursorY-player.y)>2/GAME_WORLD_ZOOM){aimAngle=Math.atan2(cursorY-player.y,cursorX-player.x);hasAim=true;}
  }else if(manualPhotonAim&&isMobileDevice()&&aimJoystickVector.active){
   aimAngle=Math.atan2(aimJoystickVector.y,aimJoystickVector.x);hasAim=true;
  }else if(manualPhotonAim){
   // Keep firing along the last manual aim while the mouse/stick is momentarily stationary.
   hasAim=true;
  }
  if(!manualPhotonAim){
   const candidates=isPvpMode?(window.AbyssalOnline?.getPlayers?.()||[]):enemies;
   let nearest=null,nearestDistance=beamRange*beamRange;
   for(const candidate of candidates){
    if(!candidate||candidate.alive===false||(Number.isFinite(Number(candidate.hp))&&Number(candidate.hp)<=0))continue;
    const dx=(Number(candidate.x)||0)-player.x,dy=(Number(candidate.y)||0)-player.y,d=dx*dx+dy*dy;
    if(d<nearestDistance){nearest=candidate;nearestDistance=d;}
   }
   if(nearest){aimAngle=Math.atan2((Number(nearest.y)||0)-player.y,(Number(nearest.x)||0)-player.x);hasAim=true;}
  }
  if(!hasAim){if(player.photonRayActive&&onlineMode)window.AbyssalOnline?.sendPhotonRayStop?.();player.photonRayActive=false;player.photonRayTimer=Math.min(Number(player.photonRayTimer)||0,0);}
  const ux=Math.cos(aimAngle),uy=Math.sin(aimAngle);
  let beamLength=beamRange,beamTargetId=null;
  if(hasAim&&!manualPhotonAim){
   const candidates=isPvpMode?(window.AbyssalOnline?.getPlayers?.()||[]):enemies;
   let nearest=null,nearestDistance=beamRange;
   for(const candidate of candidates){
    if(!candidate||candidate.alive===false||(Number.isFinite(Number(candidate.hp))&&Number(candidate.hp)<=0))continue;
    const dx=(Number(candidate.x)||0)-player.x,dy=(Number(candidate.y)||0)-player.y,d=Math.hypot(dx,dy);
    if(d<nearestDistance){nearest=candidate;nearestDistance=d;}
   }
   if(nearest){beamLength=Math.min(beamRange,nearestDistance);beamTargetId=String(nearest.id??'');}
  }
  let x2=player.x+ux*beamLength,y2=player.y+uy*beamLength;
  if(isPvpMode&&projectileHitsPvpWall(player.x,player.y,x2,y2,Math.max(1,width*.5))){
   let lo=0,hi=1;for(let step=0;step<10;step++){const mid=(lo+hi)*.5;if(projectileHitsPvpWall(player.x,player.y,player.x+(x2-player.x)*mid,player.y+(y2-player.y)*mid,Math.max(1,width*.5)))hi=mid;else lo=mid;}beamLength*=lo;x2=player.x+ux*beamLength;y2=player.y+uy*beamLength;beamTargetId=null;
  }
  if(hasAim){player.angle=aimAngle;player.photonRayActive=true;
  const localBeam=effects.find(fx=>fx.localPhotonBeam);
  if(localBeam){localBeam.x1=player.x;localBeam.y1=player.y;localBeam.x2=x2;localBeam.y2=y2;localBeam.width=width;localBeam.life=PHOTON_RAY_VISUAL.duration;}
  else effects.push({type:'photon-ray',localPhotonBeam:true,x1:player.x,y1:player.y,x2,y2,width,life:PHOTON_RAY_VISUAL.duration,maxLife:PHOTON_RAY_VISUAL.duration,color:PHOTON_RAY_VISUAL.color});
  if(player.photonRayTimer<=0){
   player.photonRayTimer=beamInterval;
   const beamDps=(getShotDamageAtLevel(beamLevel,'photonRay')/.52)*(upgrades.power||1),pulseDamage=beamDps*beamInterval;
   // A single command describes the whole ray. Server determines every PvE/PvP hit.
   if(onlineMode&&window.AbyssalOnline?.sendShot)window.AbyssalOnline.sendShot({x:player.x/W,y:player.y/H,vx:ux*900/GAME_WORLD_ZOOM/W,vy:uy*900/GAME_WORLD_ZOOM/H,damage:pulseDamage,color:PHOTON_RAY_VISUAL.color,beamLevel,special:'photonRay',beamTargetId:beamTargetId||null,beamEndX:x2/W,beamEndY:y2/H,manualAim:manualPhotonAim,volleyId:nextShotVolleyId()});
   if(!onlineMode){
    // Damage may remove killed enemies from the original list; iterate a snapshot.
    for(const target of [...enemies]){
     if(!target||target.hp<=0)continue;
     if(!PHOTON_RAY_VISUAL.segmentCircleHit(player.x,player.y,x2,y2,target.x,target.y,target.r+width*.5))continue;
     dealEnemyDamage(target,pulseDamage,'photonRay');target.hit=.08;burst(target.x,target.y,'#bafaff',beamLevel+1,35);
    }
   }
  }
  }
 }else if(player.photonRayActive){
  if(onlineMode)window.AbyssalOnline?.sendPhotonRayStop?.();
  player.photonRayActive=false;
 }
  if(upgrades.nova>0){player.novaTimer=(Number.isFinite(player.novaTimer)?player.novaTimer:0)-dt;if(player.novaTimer<=0){player.novaTimer=isPvpMode?2.4:1.8;const novaRange=getFiringRange(),novaLevel=Math.max(1,Math.min(3,Number(upgrades.nova)||1)),novaDps=(getShotDamageAtLevel(novaLevel)/.52)*(upgrades.power||1);for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<=novaRange){dealEnemyDamage(e,novaDps,'nova');burst(e.x,e.y,'#72f5ff',3,70)}}if(onlineMode&&window.AbyssalOnline?.sendShot)window.AbyssalOnline.sendShot({x:player.x/W,y:player.y/H,vx:0,vy:0,damage:novaDps,color:'#72f5ff',special:'nova',volleyId:nextShotVolleyId()});spawnNovaVisual(player.x,player.y,novaRange,'#72f5ff',isPvpMode);playSkillSound('nova','trigger')}}
 if(upgrades.gravitationalRupture>0){
  player.gravitationalRuptureTimer=(Number(player.gravitationalRuptureTimer)||0)-dt;
  if(player.gravitationalRuptureTimer<=0){
   // Cadência alinhada ao disparo-base: a fusão continua forte pelo alcance/área, não por atacar quase 3x por segundo.
   player.gravitationalRuptureTimer=.52;
   const fieldRange=getFiringRange();
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
   const fieldRange=294*(upgrades.range||1)*(SkinAbilities?.targetRangeMultiplier(equippedSkin)||1)/GAME_WORLD_ZOOM;
   const targets=enemies.filter(e=>dist(player,e)<=fieldRange).sort((a,b)=>dist(player,a)-dist(player,b)).slice(0,8);
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
  if(e.kind==='kraken'){
   e.krakenSweepTimer=Math.max(0,(Number(e.krakenSweepTimer)||0)-dt);
   if(e.krakenSweepTimer<=0){
    e.krakenSweepCycle=(Number(e.krakenSweepCycle)||0)+dt;
    const cycle=e.krakenSweepCycle;
    e.krakenTelegraph=cycle<2.4?clamp(cycle/2.4,0,1):1;
    e.krakenSweepActive=cycle>=2.4&&cycle<5.2;
    if(cycle>=10){e.krakenSweepCycle=0;e.krakenSweepActive=false;e.krakenTelegraph=0;}
   }
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
  if(e.kbVx||e.kbVy){
   e.x=clamp(e.x+e.kbVx*dt,8/GAME_WORLD_ZOOM,W-8/GAME_WORLD_ZOOM);
   e.y=clamp(e.y+e.kbVy*dt,8/GAME_WORLD_ZOOM,H-8/GAME_WORLD_ZOOM);
   const decay=Math.exp(-dt*6.5);
   e.kbVx*=decay;e.kbVy*=decay;
   if(Math.hypot(e.kbVx,e.kbVy)<15){e.kbVx=0;e.kbVy=0;}
  }
  if(window.AbyssalEnemyAI?.moveTowardTarget){
   soloEnemyMovementOptions.minX=8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.maxX=W-8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.minY=8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.maxY=H-8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.stopDistance=Math.max(1,(e.r+player.r+8/GAME_WORLD_ZOOM)*.96);
   window.AbyssalEnemyAI.moveTowardTarget(e,localTargets,dt,soloEnemyMovementOptions,soloEnemyMovementResult);
  }else{
   if(e.paralyzedUntil && performance.now() < e.paralyzedUntil){ /* paralisado */ } else { const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy)||1;e.phase+=dt*(e.kind==='stinger'?7:3);e.angle=Math.atan2(dy,dx);e.x=clamp(e.x+dx/d*e.speed*dt,8/GAME_WORLD_ZOOM,W-8/GAME_WORLD_ZOOM);e.y=clamp(e.y+dy/d*e.speed*dt,8/GAME_WORLD_ZOOM,H-8/GAME_WORLD_ZOOM); }
  }
  const td=Math.hypot(e.x-player.x,e.y-player.y);
  if(Math.hypot(e.x-beforeEnemyX,e.y-beforeEnemyY)>.05)onlineVisualMovingEnemies++;
  e.attackCd = (e.attackCd || 0) - dt; if(target.local&&(td<e.r+player.r+8/GAME_WORLD_ZOOM||(e.kind==='kraken'&&e.krakenSweepActive===true&&window.AbyssalEnemyAI?.touchesKrakenTentacle?.(e,player,1)))){if(e.attackCd<=0){if(player.invuln<=0){hurtPlayer(e.damage);}e.attackCd=e.kind==='stinger'?.8:e.kind==='kraken'?.95:1.1;}}
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
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i],prevX=p.x,prevY=p.y,stepX=p.vx*dt,stepY=p.vy*dt,stepDistance=Math.hypot(stepX,stepY),remaining=Math.max(0,(Number(p.maxDistance)||Infinity)-(Number(p.travelled)||0)),travel=Math.min(stepDistance,remaining),travelRatio=stepDistance>0?travel/stepDistance:0;p.x+=stepX*travelRatio;p.y+=stepY*travelRatio;p.travelled=(Number(p.travelled)||0)+travel;p.life-=dt;let hit=false;const reachedRange=travel+0.001<stepDistance||(Number.isFinite(p.maxDistance)&&p.travelled>=p.maxDistance);
 if(onlineRoomMode==='pvp'&&projectileHitsPvpWall(prevX,prevY,p.x,p.y,p.r||0)){spawnProjectileDissolve(p.x,p.y,p.color,p.special,true);audio(150,.035,'triangle',.006);projectiles.splice(i,1);continue;}
 projectileCandidates.length=0;const cellX=Math.floor(p.x/enemyCollisionCellSize),cellY=Math.floor(p.y/enemyCollisionCellSize);for(let gx=cellX-1;gx<=cellX+1;gx++)for(let gy=cellY-1;gy<=cellY+1;gy++){const bucket=enemyCollisionGrid.get(gy*65536+gx);if(bucket)for(const enemy of bucket)projectileCandidates.push(enemy);}for(let j=projectileCandidates.length-1;j>=0;j--){const e=projectileCandidates[j];p.hitIds ||= [];if(e.hp>0&&!p.hitIds.includes(e.id)&&Math.hypot(p.x-e.x,p.y-e.y)<p.r+e.r){p.hitIds.push(e.id);dealEnemyDamage(e,p.damage,p.special||(upgradeLevels.power>0?'power':null));e.hit=.12;burst(p.x,p.y,p.color,4,40);if(p.special)audio(500,.045,'sine',.008);
 if((p.pierceRemaining||0)>0){p.pierceRemaining--; }else{hit=true;break}}}if(hit||p.life<=0||reachedRange||p.x< -100/worldZoom||p.x>W+100/worldZoom||p.y< -100/worldZoom||p.y>H+100/worldZoom){if(hit||reachedRange)spawnProjectileDissolve(p.x,p.y,p.color,p.special,false);projectiles.splice(i,1)}}
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
 for(const beam of effects){
  if(!beam.remoteBeamKey||!onlineMode)continue;
  const blend=1-Math.exp(-dt*18);
  const owner=window.AbyssalOnline?.getPlayerById?.(beam.remoteBeamKey);
  const originX=owner?.x??beam.targetX1??beam.x1,originY=owner?.y??beam.targetY1??beam.y1;
  beam.x1+=(originX-beam.x1)*blend;beam.y1+=(originY-beam.y1)*blend;
  let destinationX=beam.targetX2??beam.x2,destinationY=beam.targetY2??beam.y2;
  // Keep the ray aimed in the last authoritative direction while its shooter moves between packets.
  if(owner&&!beam.remoteTargetId){destinationX=originX+(beam.targetX2-beam.targetX1);destinationY=originY+(beam.targetY2-beam.targetY1);}
  if(beam.remoteTargetId){
   const target=onlineRoomMode==='pvp'?window.AbyssalOnline?.getPlayerById?.(beam.remoteTargetId):onlineEnemyById.get(beam.remoteTargetId);
   if(target&&target.alive!==false&&Number(target.hp)!==0){
    const point=onlineRoomMode==='pvp'?target:currentInterpolatedEnemyPosition(target,performance.now());
    destinationX=point.x;destinationY=point.y;
   }
  }
  beam.x2+=(destinationX-beam.x2)*blend;beam.y2+=(destinationY-beam.y2)*blend;
 }
 for(let i=effects.length-1;i>=0;i--){effects[i].life-=dt;if(effects[i].life<=0){effects[i]=effects[effects.length-1];effects.pop();}}
 for(let i=damageNumbers.length-1;i>=0;i--){damageNumbers[i].life-=dt;if(damageNumbers[i].life<=0)damageNumbers.splice(i,1);}for(let i=bloodPools.length-1;i>=0;i--){bloodPools[i].life-=dt;if(bloodPools[i].life<=0)bloodPools.splice(i,1);}
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
  player.pulseCooldown=14;const pulseCastId=(Number(player.pulseCastId)||0)+1;player.pulseCastId=pulseCastId;const pulseCaster=player;const radius=245*upgrades.range/GAME_WORLD_ZOOM;
  // Online damage is server-authoritative so Q cannot silently fail or disagree between clients.
  if(onlineMode){const sent=window.AbyssalOnline?.sendActiveAbility?.('pulse',result=>{if(result?.ok!==false||player!==pulseCaster||pulseCaster.pulseCastId!==pulseCastId)return;pulseCaster.pulseCooldown=0;for(let i=effects.length-1;i>=0;i--)if(effects[i].pulseCastId===pulseCastId)effects.splice(i,1);updateAbilityButtons(true);});if(!sent){pulseCaster.pulseCooldown=0;updateAbilityButtons(true);return;}}
  else for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<radius)dealEnemyDamage(e,28*upgrades.power,'pulse',{silentSound:true,visual:false});}
  if(onlineRoomMode==='pvp')effects.push({type:'occluded-ring',x:player.x,y:player.y,r:0,max:radius,life:.7,maxLife:.7,color:'#78f8f3',pulseCastId});
  else effects.push({type:'ring',x:player.x,y:player.y,r:0,max:radius,life:.7,maxLife:.7,color:'#78f8f3',pulseCastId});
  burst(player.x,player.y,'#9ffff8',lowPowerRendering?12:22,210);playSkillSound('pulse','trigger');
 }else if(id==='dash'){
  if(!(Number(metaUpgrades.dash)>0)){showToast('DESBLOQUEIE PASSO FANTASMA NA LOJA');return;}if(!loadEquippedActiveSkills().includes('dash')){showToast('EQUIPE PASSO FANTASMA NA LOJA');return;}
  if(player.dashCooldown>0)return;
  player.dashCooldown=18;
  player.dashTime=1.5;
  player.invuln=Math.max(player.invuln,1.5);
  player.ghostDashUntil=performance.now()+1500;
  if(onlineMode)window.AbyssalOnline?.sendProtection?.(1.5,'dash');
  burst(player.x,player.y,'#d8c9ff',lowPowerRendering?8:14,130);
  playSkillSound('dash','trigger');
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
function drawCreature(x,y,r,angle,color,kind,t,playerCreature=false,hit=0,renderContext=ctx,skinOverride=null,enemyState=null){
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
 const fin=(points,col=color,edge='rgba(225,255,255,.55)')=>fill(()=>{c.moveTo(points[0][0]*r,points[0][1]*r);for(let i=1;i<points.length;i++)c.lineTo(points[i][0]*r,points[i][1]*r);c.closePath()},`rgba(8,30,46,.9)`,edge,Math.max(1,r*.035),8);
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
    // Glass-octopus inspired Kraken: translucent mantle, visible core, red eyes and an unsettling grin.
    for(let arm=0;arm<8;arm++){const pose=window.AbyssalEnemyAI?.krakenTentaclePose?.(arm,t*.0018)||{sx:Math.cos(arm*Math.PI/4)*.42,sy:.18,c1x:Math.cos(arm*Math.PI/4)*1.0,c1y:Math.sin(arm*Math.PI/4)*1.0,c2x:Math.cos(arm*Math.PI/4)*2.2,c2y:Math.sin(arm*Math.PI/4)*2.2,ex:Math.cos(arm*Math.PI/4)*3.4,ey:Math.sin(arm*Math.PI/4)*3.4};krakenArm(pose,arm,t);}
    const glass=c.createRadialGradient(-.24*r,-.62*r,.04*r,.02*r,-.34*r,1.25*r);glass.addColorStop(0,'rgba(226,250,255,.74)');glass.addColorStop(.2,'rgba(105,190,224,.42)');glass.addColorStop(.62,'rgba(24,88,137,.28)');glass.addColorStop(1,'rgba(3,25,51,.58)');
    fill(()=>{c.moveTo(-.72*r,-.08*r);c.bezierCurveTo(-.88*r,-.72*r,-.56*r,-1.58*r,0,-1.72*r);c.bezierCurveTo(.56*r,-1.58*r,.88*r,-.72*r,.72*r,-.08*r);c.quadraticCurveTo(.55*r,.24*r,0,.34*r);c.quadraticCurveTo(-.55*r,.24*r,-.72*r,-.08*r);c.closePath()},glass,'rgba(171,226,255,.82)',Math.max(1.3,r*.055),15);
    fill(()=>{c.ellipse(0,-.72*r,.27*r,.43*r,-.04,0,Math.PI*2)},'rgba(92,34,49,.72)','rgba(224,176,184,.42)',Math.max(.8,r*.024),4);
    for(let i=0;i<11;i++){const a=i*2.399,rr=(.1+(i%4)*.045)*r;c.save();c.fillStyle='rgba(67,21,31,.78)';c.beginPath();c.arc(Math.cos(a)*.19*r,(-.76+Math.sin(a)*.28)*r,rr*.28,0,Math.PI*2);c.fill();c.restore();}
    fill(()=>{c.ellipse(0,.18*r,.74*r,.5*r,0,0,Math.PI*2)},'rgba(46,113,157,.34)','rgba(172,225,247,.72)',Math.max(1.1,r*.04),8);
    for(let side of [-1,1]){fill(()=>{c.ellipse(side*.31*r,.06*r,.17*r,.135*r,side*.06,0,Math.PI*2)},'rgba(5,13,24,.92)','rgba(255,92,105,.88)',Math.max(1,r*.028),9);fill(()=>{c.ellipse(side*.31*r,.06*r,.075*r,.075*r,0,0,Math.PI*2)},'#ff263f','#ff8a98',Math.max(.8,r*.018),12);}
    stroke(()=>{c.moveTo(-.27*r,.25*r);c.bezierCurveTo(-.13*r,.46*r,.14*r,.46*r,.28*r,.24*r)},Math.max(1.2,r*.045),'rgba(255,232,238,.92)',5);
    for(let i=0;i<7;i++){const xx=(-.21+i*.07)*r;stroke(()=>{c.moveTo(xx,.31*r);c.lineTo(xx*.84,.39*r)},Math.max(.7,r*.018),'rgba(180,24,43,.78)',2);}
    for(let i=0;i<12;i++){const a=i*Math.PI/6;c.save();c.fillStyle='rgba(198,238,255,.58)';c.beginPath();c.arc(Math.cos(a)*.46*r,(.38+Math.sin(a)*.14)*r,Math.max(1,r*.026),0,Math.PI*2);c.fill();c.restore();}
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
   // Black caiman / Jacaré-açu: focinho curto e muito largo em U, olhos/narinas no topo,
   // corpo negro robusto, osteodermos baixos e cauda lateralmente comprimida.
   const swim=Math.sin(t*.0038)*.035,tailWave=Math.sin(t*.0048)*.12;
   fill(()=>{c.moveTo(-.62*r,-.2*r);c.bezierCurveTo(-1.08*r,-.25*r,-1.65*r,(-.2+tailWave)*r,-2.22*r,tailWave*r);c.bezierCurveTo(-1.64*r,(.22+tailWave)*r,-1.02*r,.29*r,-.58*r,.23*r);c.closePath()},bodyGrad('#182a22'),'rgba(106,139,104,.68)',Math.max(1,r*.035),5);
   fill(()=>{c.ellipse(-.08*r,swim*r,.92*r,.39*r,0,0,Math.PI*2)},bodyGrad('#24382d'),'rgba(122,151,111,.72)',Math.max(1,r*.04),7);
   // Low paired scutes, closer to a caiman/alligator armored back than triangular fantasy spikes.
   for(let row=0;row<2;row++)for(let plate=0;plate<6;plate++){const px=(-.72+plate*.27)*r,py=(-.16+row*.3)*r;fill(()=>{c.roundRect(px-r*.09,py-r*.055,r*.18,r*.11,r*.035)},plate%2?'#314839':'#3b5140','rgba(151,167,126,.35)',Math.max(.5,r*.012),0);}
   // Signature rounded head: compact U-shaped skull with elevated eye ridges and terminal nostrils.
   fill(()=>{c.moveTo(.38*r,-.31*r);c.quadraticCurveTo(.92*r,-.38*r,1.34*r,-.29*r);c.quadraticCurveTo(1.58*r,-.2*r,1.6*r,0);c.quadraticCurveTo(1.58*r,.2*r,1.34*r,.29*r);c.quadraticCurveTo(.9*r,.38*r,.38*r,.31*r);c.closePath()},bodyGrad('#2d4434'),'rgba(164,184,138,.75)',Math.max(1,r*.04),6);
   fill(()=>{c.moveTo(.48*r,.05*r);c.quadraticCurveTo(1.05*r,.14*r,1.56*r,.08*r);c.quadraticCurveTo(1.31*r,.3*r,.48*r,.25*r);c.closePath()},'#151d18','rgba(125,145,108,.42)',Math.max(.6,r*.015),1);
   for(const side of [-1,1]){fill(()=>c.ellipse(.62*r,side*.24*r,r*.14,r*.085,0,0,Math.PI*2),'#344b39','#1b2a21',Math.max(.6,r*.015),0);eye(.62,side*.25,r*.052,'#e0b35a');}
   for(const side of [-1,1])fill(()=>c.ellipse(1.38*r,side*.11*r,r*.035,r*.026,0,0,Math.PI*2),'#0b1310',null,0,0);
   // Four short limbs remain tucked alongside the body in a swimming posture.
   for(const side of [-1,1])for(let leg=0;leg<2;leg++){const lx=(-.45+leg*.62)*r,ly=side*.27*r;c.save();c.strokeStyle='#23382b';c.lineWidth=Math.max(2,r*.08);c.lineCap='round';c.beginPath();c.moveTo(lx,ly);c.lineTo(lx-.08*r,side*.53*r);c.lineTo(lx+.13*r,side*.61*r);c.stroke();c.restore();}
  } else if(id==='armoredgator'){
   // Nile crocodile / Crocodilo-do-nilo: focinho mais estreito em V, dentes inferiores visíveis,
   // cabeça comprida, escudos dorsais altos e cauda longa de natação.
   const tailWave=Math.sin(t*.0045)*.11;
   fill(()=>{c.moveTo(-.7*r,-.17*r);c.bezierCurveTo(-1.18*r,-.22*r,-1.72*r,(-.19+tailWave)*r,-2.32*r,tailWave*r);c.bezierCurveTo(-1.7*r,(.2+tailWave)*r,-1.15*r,.25*r,-.64*r,.2*r);c.closePath()},bodyGrad('#62583b'),'rgba(198,181,132,.66)',Math.max(1,r*.035),5);
   fill(()=>{c.ellipse(-.08*r,0,.9*r,.34*r,0,0,Math.PI*2)},bodyGrad('#756746'),'rgba(215,195,142,.7)',Math.max(1,r*.04),7);
   // Paired rectangular/keeled osteoderms, not oversized triangular fins.
   for(let plate=0;plate<7;plate++){const px=(-.72+plate*.23)*r;for(const side of [-1,1])fill(()=>{c.moveTo((px/r-.09)*r,side*.08*r);c.lineTo((px/r-.03)*r,side*.2*r);c.lineTo((px/r+.09)*r,side*.19*r);c.lineTo((px/r+.12)*r,side*.07*r);c.closePath()},plate%2?'#a18c58':'#b39b61','rgba(67,58,38,.62)',Math.max(.5,r*.012),0);}
   // Long V-shaped rostrum. The jaw narrows toward the nose.
   fill(()=>{c.moveTo(.35*r,-.24*r);c.lineTo(.82*r,-.2*r);c.lineTo(1.68*r,-.07*r);c.lineTo(1.82*r,0);c.lineTo(1.68*r,.07*r);c.lineTo(.82*r,.2*r);c.lineTo(.35*r,.24*r);c.closePath()},bodyGrad('#8a7950'),'rgba(230,211,158,.78)',Math.max(1,r*.035),5);
   fill(()=>{c.moveTo(.58*r,.02*r);c.lineTo(1.73*r,-.015*r);c.lineTo(1.62*r,.105*r);c.lineTo(.58*r,.14*r);c.closePath()},'#201c15','rgba(223,205,156,.4)',Math.max(.5,r*.012),1);
   for(const side of [-1,1])eye(.47,side*.205,r*.05,'#f0c766');
   for(const side of [-1,1])fill(()=>c.ellipse(1.58*r,side*.045*r,r*.025,r*.018,0,0,Math.PI*2),'#14120e',null,0,0);
   // Crocodile signature: visible teeth from both jaws remain interlocking with mouth closed.
   for(let tooth=0;tooth<9;tooth++){const tx=(.72+tooth*.105)*r,side=tooth%2?1:-1;fill(()=>{c.moveTo(tx,side*.025*r);c.lineTo(tx+.035*r,side*.12*r);c.lineTo(tx+.068*r,side*.028*r);c.closePath()},'#f4ebcf','rgba(73,65,46,.55)',Math.max(.4,r*.01),0);}
   for(const side of [-1,1])for(let leg=0;leg<2;leg++){const lx=(-.43+leg*.6)*r,ly=side*.24*r;c.save();c.strokeStyle='#6c6040';c.lineWidth=Math.max(2,r*.07);c.lineCap='round';c.beginPath();c.moveTo(lx,ly);c.lineTo(lx-.03*r,side*.49*r);c.lineTo(lx+.17*r,side*.58*r);c.stroke();c.restore();}
    } else if(id==='electriceel'){
   // Bioelectric eel: low, continuous silhouette with a long anal fin and travelling organ pulses.
   const swim=Math.sin(t*.0046)*.055,tail=Math.sin(t*.0062)*.16;
   fill(()=>{c.moveTo(-2.35*r,tail*r);c.bezierCurveTo(-1.72*r,(-.16+swim)*r,-.82*r,-.28*r,.12*r,-.24*r);c.bezierCurveTo(.62*r,-.22*r,1.12*r,-.14*r,1.38*r,-.03*r);c.quadraticCurveTo(1.5*r,0,1.38*r,.08*r);c.bezierCurveTo(.68*r,.27*r,-.35*r,.32*r,-1.18*r,.24*r);c.bezierCurveTo(-1.72*r,.18*r,-2.06*r,(.12+tail)*r,-2.35*r,tail*r);c.closePath()},bodyGrad('#176e86'),'rgba(95,245,255,.86)',Math.max(1.1,r*.035),12);
   // Electric eels lack the tall shark-like dorsal fin. The long ventral fin drives the swimming motion.
   fill(()=>{c.moveTo(-1.72*r,.19*r);c.bezierCurveTo(-.9*r,(.48+swim)*r,.28*r,.43*r,1.08*r,.17*r);c.bezierCurveTo(.25*r,.31*r,-.82*r,.34*r,-1.72*r,.19*r);c.closePath()},'rgba(41,173,193,.42)','rgba(119,255,247,.42)',Math.max(.7,r*.018),3);
   eye(1.02,-.105,r*.045,'#d9ffff');
   // Organ pulses travel from tail to head instead of flickering randomly each frame.
   c.save();c.globalCompositeOperation='lighter';for(let k=0;k<7;k++){const phase=(t*.00055+k/7)%1,px=(-1.85+phase*2.85)*r,py=Math.sin(phase*9+t*.004)*.075*r,alpha=.25+.55*Math.sin(phase*Math.PI);c.globalAlpha=Math.max(.12,alpha);c.fillStyle=k%2?'#8ffff8':'#b9d8ff';c.shadowBlur=12*glowScale;c.shadowColor='#38e8ff';c.beginPath();c.ellipse(px,py,Math.max(1,r*.045),Math.max(.7,r*.022),0,0,Math.PI*2);c.fill();}c.restore();
   for(let k=0;k<3;k++){const phase=t*.006+k*2.1,sx=(-1.15+k*.78)*r,sy=Math.sin(phase)*.13*r;stroke(()=>{c.moveTo(sx,sy);c.lineTo(sx+Math.sin(phase*1.7)*.16*r,sy+Math.cos(phase*1.3)*.18*r);c.lineTo(sx+.3*r,sy+Math.sin(phase*2.2)*.08*r)},Math.max(.8,r*.018),'rgba(220,255,255,.9)',8);}
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
   // Blind Leviathan mirrors the trench boss: long plated eel, bony crest and eyeless skull.
   fill(()=>{c.moveTo(-2.6*r,.02*r);c.quadraticCurveTo(-2.0*r,-.47*r,-1.15*r,-.42*r);c.quadraticCurveTo(-.45*r,-.3*r,.1*r,-.35*r);c.lineTo(.72*r,-.18*r);c.lineTo(1.0*r,.04*r);c.quadraticCurveTo(.35*r,.4*r,-.78*r,.34*r);c.quadraticCurveTo(-1.8*r,.43*r,-2.6*r,.02*r)},bodyGrad(color),'rgba(255,222,232,.7)',Math.max(1.2,r*.045),15);
   fin([[-2.32,.03],[-2.88,-.28],[-2.63,.05],[-2.86,.31]],color);
   for(let i=0;i<9;i++){const xx=(-1.75+i*.25)*r;fin([[xx/r,-.32],[xx/r-.1,-.78-(i%3===0?.18:0)],[xx/r+.14,-.28]],'#8e3857','#ffd0df');stroke(()=>{c.moveTo(xx,-.23*r);c.lineTo((xx-.02*r),.25*r)},Math.max(.8,r*.026),'rgba(255,220,232,.7)',4)}
   fill(()=>{c.ellipse(.68*r,-.04*r,.31*r,.29*r,-.08,0,Math.PI*2)},'#ead7d8','#fff4f2',Math.max(1,r*.04),10);
   for(let slit=0;slit<3;slit++)stroke(()=>{c.moveTo((.58+slit*.07)*r,-.17*r);c.lineTo((.54+slit*.07)*r,-.06*r)},Math.max(1,r*.025),'#7c314b',3);
   gills(.13,-.18,4);
  } else if(id==='voidwing'){
   // Manta ray: broad paired pectoral wings and a long tapering tail.
   fill(()=>{c.moveTo(-.7*r,-.18*r);c.quadraticCurveTo(-.05*r,-.4*r,.48*r,-.2*r);c.lineTo(1.0*r,-.02*r);c.quadraticCurveTo(.56*r,.02*r,.34*r,.22*r);c.quadraticCurveTo(.08*r,.5*r,-.22*r,.28*r);c.lineTo(-1.32*r,.84*r);c.quadraticCurveTo(-1.05*r,.25*r,-.9*r,.08*r);c.lineTo(-1.32*r,-.82*r);c.quadraticCurveTo(-1.02*r,-.3*r,-.7*r,-.18*r);c.closePath()},bodyGrad(color),'rgba(230,255,255,.62)',Math.max(1,r*.04),14);
   stroke(()=>{c.moveTo(-.7*r,0);c.quadraticCurveTo(-.2*r,.22*r,.56*r,.08*r)},Math.max(1,r*.045),'rgba(216,255,253,.75)',5);tentacle(-1.12,.0,-1.8,.06,-2.05,.08,-2.5,.12,.55);eye(.53,-.08,r*.06);
  } else if(id==='deepwarden'){
   // Trench warden: a compact mineral trilobite with layered armor and anchoring legs.
   for(const side of [-1,1])for(let i=0;i<5;i++){const xx=(-.68+i*.29);stroke(()=>{c.moveTo(xx*r,side*.28*r);c.lineTo((xx-.12)*r,side*(.58+i*.035)*r);c.lineTo((xx+.02)*r,side*(.72+i*.025)*r)},Math.max(1,r*.05),'#78998b',4);}
   fill(()=>{c.ellipse(-.08*r,0,1.02*r,.66*r,0,0,Math.PI*2)},bodyGrad('#6e8f80'),'rgba(207,238,224,.72)',Math.max(1.2,r*.05),7);
   for(let i=0;i<6;i++){const xx=(-.82+i*.29)*r;fill(()=>{c.moveTo(xx,-.5*r);c.lineTo(xx+.18*r,-.58*r);c.lineTo(xx+.28*r,0);c.lineTo(xx+.18*r,.54*r);c.lineTo(xx,.48*r);c.closePath()},i%2?'#4c6a60':'#5b796d','rgba(207,238,224,.42)',Math.max(.7,r*.022),2);}
   fill(()=>{c.moveTo(.62*r,-.38*r);c.lineTo(1.04*r,-.24*r);c.lineTo(1.18*r,0);c.lineTo(1.04*r,.24*r);c.lineTo(.62*r,.38*r);c.closePath()},'#789b89','rgba(229,255,241,.72)',Math.max(1,r*.035),5);
   eye(.74,-.18,r*.055,'#b9ffe1');eye(.74,.18,r*.055,'#b9ffe1');
  } else if(id==='abyssking'){
   // Void king: floating crowned cephalopod, visually unrelated to the armored warden.
   for(let i=0;i<6;i++){const a=(i/5-.5)*1.7;tentacle(-.35,Math.sin(a)*.32,-.72,Math.sin(a)*.58,-1.05,Math.sin(a)*.78,-1.3-Math.abs(a)*.12,Math.sin(a)*.9,.8);}
   fill(()=>{c.moveTo(-.68*r,.16*r);c.bezierCurveTo(-.8*r,-.48*r,-.38*r,-.76*r,.05*r,-.72*r);c.bezierCurveTo(.55*r,-.7*r,.82*r,-.34*r,.72*r,.2*r);c.quadraticCurveTo(.1*r,.55*r,-.68*r,.16*r);c.closePath()},bodyGrad('#514a9a'),'rgba(180,166,255,.72)',Math.max(1.2,r*.05),12);
   fill(()=>{c.moveTo(-.46*r,-.5*r);c.lineTo(-.42*r,-1.02*r);c.lineTo(-.12*r,-.7*r);c.lineTo(.05*r,-1.2*r);c.lineTo(.28*r,-.7*r);c.lineTo(.55*r,-1.0*r);c.lineTo(.5*r,-.48*r);c.closePath()},'#15152f','#b9aaff',Math.max(1,r*.04),10);
   c.save();c.fillStyle='#050611';c.beginPath();c.ellipse(.16*r,.02*r,.3*r,.23*r,0,0,Math.PI*2);c.fill();c.restore();eye(.1,-.08,r*.065,'#d8ccff');eye(.36,-.04,r*.05,'#9d8cff');
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
   // Toxic sludge: asymmetrical gelatinous predator with acid sacs and dripping pseudopods.
   for(let i=0;i<7;i++){const yy=(-.48+i*.16);tentacle(-.45,yy,-.78,yy+.08,-.9,yy+(i%2?.28:-.22),-1.18-(i%3)*.08,yy+(i-3)*.08,.62);}
   fill(()=>{c.moveTo(-.58*r,.36*r);c.bezierCurveTo(-.82*r,-.22*r,-.42*r,-.68*r,.08*r,-.62*r);c.bezierCurveTo(.65*r,-.58*r,.82*r,-.1*r,.66*r,.42*r);c.quadraticCurveTo(.22*r,.58*r,-.58*r,.36*r);c.closePath()},bodyGrad('#5a9d45'),'rgba(191,255,142,.72)',Math.max(1.2,r*.05),12);
   for(const [px,py,pr] of [[-.2,-.22,.13],[.18,.15,.1],[.42,-.18,.08]]){c.save();c.fillStyle='#c7ff6b';c.shadowBlur=10*glowScale;c.shadowColor='#83ff45';c.beginPath();c.arc(px*r,py*r,pr*r,0,Math.PI*2);c.fill();c.restore();}
   fill(()=>{c.ellipse(.46*r,.08*r,.22*r,.16*r,0,0,Math.PI*2)},'#10200d','#baff80',Math.max(.8,r*.025),3);eye(.36,-.24,r*.055,'#eaffad');
  } else if(id==='thorn'){
   // Crown of thorns: radial armored starfish, all silhouette and defensive spines.
   for(let i=0;i<12;i++){const a=i*Math.PI/6,inner=.58+(i%2)*.08,outer=1.18+(i%3)*.12;fill(()=>{c.moveTo(Math.cos(a-.13)*inner*r,Math.sin(a-.13)*inner*r);c.lineTo(Math.cos(a)*outer*r,Math.sin(a)*outer*r);c.lineTo(Math.cos(a+.13)*inner*r,Math.sin(a+.13)*inner*r);c.closePath()},i%2?'#8e3f3a':'#b75843','rgba(255,183,131,.7)',Math.max(.7,r*.025),5);}
   body(.64,.61,0,'#9e493e');for(let i=0;i<6;i++){const a=i*Math.PI/3;c.save();c.fillStyle='#ffd09e';c.beginPath();c.arc(Math.cos(a)*.38*r,Math.sin(a)*.38*r,Math.max(1,r*.035),0,Math.PI*2);c.fill();c.restore();}eye(.22,-.12,r*.055,'#ffe1b8');
  } else if(id==='coral'){
   // Carnivorous garden: branching coral colony with a central anemone mouth and feeding polyps.
   for(const side of [-1,1])for(let b=0;b<4;b++){const yy=(b-1.5)*.2;stroke(()=>{c.moveTo(-.3*r,yy*r);c.bezierCurveTo(-.7*r,side*(.22+b*.08)*r,-.72*r,side*(.65+b*.06)*r,(-.92-b*.08)*r,side*(.92+b*.08)*r)},Math.max(1.3,r*.065),b%2?'#bd3f68':'#e25b7c',8);for(let p=0;p<2;p++){const px=(-.64-b*.04-p*.12)*r,py=side*(.45+b*.06+p*.14)*r;fill(()=>c.arc(px,py,Math.max(1.2,r*.055),0,Math.PI*2),'#ffb3c3','#ffe3d5',Math.max(.6,r*.018),4);}}
   fill(()=>{c.ellipse(.12*r,0,.7*r,.62*r,0,0,Math.PI*2)},bodyGrad('#b74468'),'rgba(255,177,200,.7)',Math.max(1,r*.04),9);
   c.save();c.fillStyle='#170817';c.strokeStyle='#ff8fb3';c.lineWidth=Math.max(1,r*.035);c.beginPath();c.ellipse(.35*r,0,.28*r,.34*r,0,0,Math.PI*2);c.fill();c.stroke();c.restore();teeth(.35,0,.25,.3,10,.7);eye(.05,-.25,r*.045,'#ffd2df');
  } else if(id==='bloodmoon'){
   // Pale deep-sea fangfish with a huge split jaw.
   fin([[-1.1,0],[-1.62,-.42],[-1.53,.05],[-1.68,.38]] ,color);fin([[-.3,-.34],[-.05,-.88],[.18,-.31]],color);
   fill(()=>{c.moveTo(-1.2*r,0);c.quadraticCurveTo(-.78*r,-.6*r,.05*r,-.48*r);c.lineTo(.75*r,-.17*r);c.lineTo(.98*r,.02*r);c.lineTo(.56*r,.12*r);c.quadraticCurveTo(-.4*r,.55*r,-1.2*r,0)},bodyGrad(color),'rgba(255,224,232,.5)',Math.max(1,r*.04),12);
   fill(()=>{c.moveTo(.38*r,-.05*r);c.quadraticCurveTo(.8*r,-.42*r,.93*r,-.18*r);c.lineTo(.75*r,.02*r);c.lineTo(.97*r,.27*r);c.quadraticCurveTo(.63*r,.32*r,.38*r,.12*r);c.closePath()},'#06111d','#ffbec9',Math.max(1,r*.045),8);
   for(let i=0;i<5;i++){const xx=(.47+i*.085)*r;fin([[xx/r,-.08],[xx/r-.035,.035],[xx/r+.035,.035]],'#fff0e7','#ffbec9');fin([[xx/r,.12],[xx/r-.03,.02],[xx/r+.03,.02]],'#fff0e7','#ffbec9')}eye(.36,-.25,r*.06,'#ffedf2');
  } else if(id==='solar'){
   // Solar core: compact armored sunfish with a corona of rigid golden rays.
   for(let i=0;i<14;i++){const a=i*Math.PI/7,inner=.66,outer=i%2?1.0:1.18;fill(()=>{c.moveTo(Math.cos(a-.08)*inner*r,Math.sin(a-.08)*inner*r);c.lineTo(Math.cos(a)*outer*r,Math.sin(a)*outer*r);c.lineTo(Math.cos(a+.08)*inner*r,Math.sin(a+.08)*inner*r);c.closePath()},'#b66c24','#ffe7a1',Math.max(.7,r*.025),6);}
   fill(()=>{c.ellipse(0,0,.72*r,.62*r,0,0,Math.PI*2)},bodyGrad('#d68b31'),'rgba(255,236,164,.82)',Math.max(1.2,r*.05),14);
   c.save();const g=c.createRadialGradient(.1*r,-.08*r,1,.1*r,-.08*r,.48*r);g.addColorStop(0,'#fffce1');g.addColorStop(.4,'#ffd86a');g.addColorStop(1,'rgba(255,148,44,.12)');c.fillStyle=g;c.beginPath();c.arc(.1*r,-.08*r,.48*r,0,Math.PI*2);c.fill();c.restore();eye(.38,-.17,r*.055,'#fff4bc');
  } else if(id==='violet'){
   // Violet specter: translucent horned ghost, deliberately unlike any ordinary fish.
   for(let i=0;i<5;i++){const yy=(-.35+i*.18);tentacle(-.48,yy,-.85,yy-.12,-1.08,yy+.18,-1.38,yy+(i-2)*.12,.65);}
   fill(()=>{c.moveTo(-.55*r,.38*r);c.bezierCurveTo(-.82*r,-.15*r,-.55*r,-.7*r,.02*r,-.72*r);c.bezierCurveTo(.58*r,-.7*r,.82*r,-.25*r,.7*r,.28*r);c.quadraticCurveTo(.18*r,.65*r,-.55*r,.38*r);c.closePath()},bodyGrad('#7650b8'),'rgba(221,199,255,.72)',Math.max(1.1,r*.045),16);
   fin([[.12,-.58],[.35,-1.16],[.52,-.5]],'#6c4ca7','#e1d1ff');fin([[.45,-.42],[.78,-.92],[.7,-.28]],'#6c4ca7','#e1d1ff');
   c.save();c.globalAlpha=.6;c.fillStyle='#c9a8ff';c.shadowBlur=16*glowScale;c.shadowColor='#a56dff';c.beginPath();c.ellipse(.08*r,.03*r,.34*r,.42*r,0,0,Math.PI*2);c.fill();c.restore();eye(.18,-.13,r*.07,'#f0e6ff');
  } else if(id==='aberration'||id==='angler'||id==='maw'||id==='devourer'){
   if(id==='aberration'){
    for(let side of [-1,1])for(let i=0;i<3;i++)tentacle(-.42+i*.35,side*.18,-.62+i*.3,side*.48,-.38+i*.3,side*.82,-.68+i*.4,side*1.05,.85,true);
    fill(()=>{c.moveTo(-.7*r,-.3*r);c.lineTo(-.5*r,-.78*r);c.lineTo(-.1*r,-.52*r);c.lineTo(.22*r,-.85*r);c.lineTo(.7*r,-.32*r);c.lineTo(.68*r,.2*r);c.lineTo(.1*r,.55*r);c.lineTo(-.55*r,.25*r);c.closePath()},bodyGrad(color),'rgba(255,188,202,.8)',Math.max(1.2,r*.05),12);
    fill(()=>{c.ellipse(.2*r,-.02*r,.35*r,.38*r,0,0,Math.PI*2)},'#111b28','#fff0f2',Math.max(1,r*.04),4);eye(.03,-.16,r*.07,'#fff5e8');eye(.4,-.1,r*.045,'#ffe0a1');
   }else if(id==='angler'){
    fin([[-.9,0],[-1.45,-.42],[-1.35,.08],[-1.5,.38]],color);body(1.0,.72,.08,color);
    fill(()=>{c.moveTo(.15*r,-.1*r);c.quadraticCurveTo(.75*r,-.58*r,1.0*r,-.2*r);c.lineTo(.68*r,.1*r);c.lineTo(1.02*r,.38*r);c.quadraticCurveTo(.44*r,.44*r,.15*r,.13*r);c.closePath()},'#06101a','#fff0c7',Math.max(1,r*.045),8);
    teeth(.61,.06,.36,.25,9,.68);stroke(()=>{c.moveTo(-.02*r,-.5*r);c.quadraticCurveTo(.1*r,-1.12*r,.48*r,-1.04*r)},Math.max(1,r*.06),'#fff0a4',8);c.save();c.fillStyle='#fff4b0';c.shadowBlur=20*glowScale;c.shadowColor='#ffcf70';c.beginPath();c.arc(.48*r,-1.04*r,Math.max(1.5,r*.09),0,Math.PI*2);c.fill();c.restore();eye(.48,-.28,r*.06,'#fff0a4');
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
  for(let arm=0;arm<8;arm++){const phase=Number.isFinite(Number(enemyState?.phase))?Number(enemyState.phase):(Number(t)||0)*.00042;const pose=window.AbyssalEnemyAI?.krakenTentaclePose?.(arm,phase)||{sx:Math.cos(arm*Math.PI/4)*.44,sy:.25,c1x:Math.cos(arm*Math.PI/4)*.95,c1y:Math.sin(arm*Math.PI/4)*.95,c2x:Math.cos(arm*Math.PI/4)*2.1,c2y:Math.sin(arm*Math.PI/4)*2.1,ex:Math.cos(arm*Math.PI/4)*3.4,ey:Math.sin(arm*Math.PI/4)*3.4};krakenArm(pose,arm,t);}
  const krakenGlass=c.createRadialGradient(-.25*r,-.55*r,.05*r,.04*r,-.32*r,1.3*r);krakenGlass.addColorStop(0,'rgba(235,252,255,.78)');krakenGlass.addColorStop(.18,'rgba(102,189,224,.45)');krakenGlass.addColorStop(.62,'rgba(20,78,127,.3)');krakenGlass.addColorStop(1,'rgba(2,19,43,.62)');
  fill(()=>{c.moveTo(-.72*r,-.02*r);c.bezierCurveTo(-.9*r,-.68*r,-.57*r,-1.5*r,0,-1.64*r);c.bezierCurveTo(.57*r,-1.5*r,.9*r,-.68*r,.72*r,-.02*r);c.quadraticCurveTo(.55*r,.3*r,0,.4*r);c.quadraticCurveTo(-.55*r,.3*r,-.72*r,-.02*r);c.closePath()},krakenGlass,'rgba(173,229,255,.86)',Math.max(1.5,r*.055),16);
  fill(()=>{c.ellipse(0,-.68*r,.28*r,.42*r,-.04,0,Math.PI*2)},'rgba(91,29,43,.78)','rgba(223,169,181,.42)',Math.max(.8,r*.022),3);
  for(let i=0;i<13;i++){const a=i*2.17;c.save();c.fillStyle='rgba(59,15,27,.78)';c.beginPath();c.arc(Math.cos(a)*.19*r,(-.7+Math.sin(a)*.28)*r,Math.max(1.1,r*.025),0,Math.PI*2);c.fill();c.restore();}
  fill(()=>{c.ellipse(0,.16*r,.72*r,.5*r,0,0,Math.PI*2)},'rgba(39,103,151,.35)','rgba(178,230,250,.76)',Math.max(1.2,r*.04),9);
  for(let side of [-1,1]){fill(()=>{c.ellipse(side*.3*r,.03*r,.18*r,.14*r,side*.06,0,Math.PI*2)},'rgba(3,11,22,.95)','rgba(255,72,91,.9)',Math.max(1,r*.028),10);fill(()=>{c.ellipse(side*.3*r,.03*r,.075*r,.078*r,0,0,Math.PI*2)},'#ff203d','#ff8796',Math.max(.8,r*.018),13);}
  stroke(()=>{c.moveTo(-.29*r,.23*r);c.bezierCurveTo(-.14*r,.47*r,.15*r,.47*r,.3*r,.22*r)},Math.max(1.4,r*.046),'rgba(255,235,239,.94)',5);
  for(let i=0;i<7;i++){const xx=(-.21+i*.07)*r;stroke(()=>{c.moveTo(xx,.3*r);c.lineTo(xx*.82,.39*r)},Math.max(.8,r*.018),'rgba(177,20,39,.8)',2);}
  for(let i=0;i<12;i++){const a=i*Math.PI/6;c.save();c.fillStyle='rgba(200,239,255,.58)';c.beginPath();c.arc(Math.cos(a)*.45*r,(.38+Math.sin(a)*.14)*r,Math.max(1.2,r*.027),0,Math.PI*2);c.fill();c.restore();}
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
 for(const rock of arenaRocks){
  const reach=rock.r+35/worldZoom;if(rock.x<left-reach||rock.x>right+reach||rock.y<top-reach||rock.y>bottom+reach)continue;
  ctx.save();ctx.translate(rock.x,rock.y);ctx.rotate(rock.angle||0);ctx.lineJoin='round';
  // Dark contact shadow gives the reef a raised, heavy silhouette.
  ctx.beginPath();rock.vertices.forEach(([vx,vy],i)=>{if(i===0)ctx.moveTo(vx+5/worldZoom,vy+7/worldZoom);else ctx.lineTo(vx+5/worldZoom,vy+7/worldZoom)});ctx.closePath();ctx.fillStyle='rgba(0,5,12,.38)';ctx.fill();
  const palette=rock.shade>.68?['#263e49','#172e3b','#0d202d']:rock.shade>.34?['#304854','#1a303d','#0c202b']:['#253b48','#142a38','#091b28'];
  ctx.beginPath();rock.vertices.forEach(([vx,vy],i)=>{if(i===0)ctx.moveTo(vx,vy);else ctx.lineTo(vx,vy)});ctx.closePath();
  ctx.fillStyle=palette[1];ctx.strokeStyle='rgba(104,151,164,.48)';ctx.lineWidth=2/worldZoom;ctx.shadowBlur=lowPowerRendering?0:6/worldZoom;ctx.shadowColor='rgba(9,31,43,.42)';ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  // Uneven eroded shelf on the upper side, plus broken mineral seams.
  ctx.beginPath();ctx.moveTo(rock.vertices[0][0]*.72,rock.vertices[0][1]*.55);
  for(let i=1;i<Math.min(5,rock.vertices.length);i++)ctx.lineTo(rock.vertices[i][0]*.78,rock.vertices[i][1]*.72);
  ctx.strokeStyle='rgba(119,170,180,.32)';ctx.lineWidth=2.2/worldZoom;ctx.stroke();
  for(let k=0;k<2;k++){
   const seed=(rock.seed||0)+k*7,px=(Math.sin(seed*12.3)*.34)*rock.rx,py=(Math.cos(seed*8.7)*.25)*rock.ry;
   ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.sin(seed)*rock.rx*.11,py+rock.ry*.18);ctx.lineTo(px+Math.cos(seed*2)*rock.rx*.22,py+rock.ry*.24);
   ctx.strokeStyle=k?'rgba(2,12,20,.58)':'rgba(123,166,174,.2)';ctx.lineWidth=(k?1.5:1)/worldZoom;ctx.stroke();
  }
  // Tiny muted algae / sponge patches, kept subtle so silhouettes stay readable.
  if(!lowPowerRendering&&rock.shade>.72){ctx.fillStyle='rgba(45,103,91,.42)';ctx.beginPath();ctx.ellipse(-rock.rx*.12,-rock.ry*.08,Math.max(3,rock.rx*.12),Math.max(2,rock.ry*.18),-.25,0,Math.PI*2);ctx.fill();}
  ctx.restore();
 }
 ctx.strokeStyle='rgba(108,215,222,.14)';ctx.lineWidth=1/worldZoom;ctx.strokeRect(18/worldZoom,18/worldZoom,W-36/worldZoom,H-36/worldZoom);
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
 for(const p of projectiles){if(p.x<cameraX-70/worldZoom||p.x>cameraX+viewW/worldZoom+70/worldZoom||p.y<cameraY-70/worldZoom||p.y>cameraY+viewH/worldZoom+70/worldZoom)continue;ctx.save();const trail=p.allyShot?'#9bbcff':(p.special==='pierce'?'#ffd36b':p.special==='ricochet'?'#ffad55':p.special==='electric'?'#45e9ff':p.special==='photon'?'#ff8df4':p.color);ctx.strokeStyle=trail;ctx.lineCap='round';ctx.lineWidth=p.special==='pierce'?Math.max(3,p.r*1.25):p.allyShot?5.5:p.special==='electric'?Math.max(2.2,p.r*.72):p.special==='photon'?Math.max(2,p.r*.75):p.r*1.55;ctx.shadowBlur=lowPowerRendering?0:(p.special?13:p.allyShot?12:7);ctx.shadowColor=trail;const trailScale=p.special==='photon'?.035:p.special==='pierce'?.105:p.special==='electric'?.04:.045;ctx.beginPath();ctx.moveTo(p.x-p.vx*trailScale,p.y-p.vy*trailScale);ctx.lineTo(p.x,p.y);ctx.stroke();if(p.special==='electric'){const speed=Math.hypot(p.vx,p.vy)||1,ux=p.vx/speed,uy=p.vy/speed,nx=-uy,ny=ux,phase=(p.travelled||0)*.095,boltLength=Math.max(52/GAME_WORLD_ZOOM,speed*.095);ctx.strokeStyle='rgba(220,255,255,.98)';ctx.lineWidth=Math.max(1.5/GAME_WORLD_ZOOM,p.r*.48);ctx.beginPath();const segments=12;for(let s=0;s<=segments;s++){const q=s/segments,back=boltLength*(1-q),edge=Math.sin(Math.PI*q),bend=(Math.sin(phase+s*2.7)*5.5+Math.sin(phase*.57+s*5.1)*2.3)*edge/GAME_WORLD_ZOOM,xx=p.x-ux*back+nx*bend,yy=p.y-uy*back+ny*bend;if(s===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}ctx.stroke();ctx.strokeStyle='rgba(69,233,255,.72)';ctx.lineWidth=Math.max(3/GAME_WORLD_ZOOM,p.r*.9);ctx.globalAlpha*=.45;ctx.stroke();ctx.globalAlpha/=.45;ctx.fillStyle='#f7ffff';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1.6/GAME_WORLD_ZOOM,p.r*.42),0,Math.PI*2);ctx.fill();}else if(p.special==='pierce'){const pa=Math.atan2(p.vy,p.vx),ux=Math.cos(pa),uy=Math.sin(pa),nx=-uy,ny=ux;ctx.fillStyle='#fff0a8';ctx.beginPath();ctx.moveTo(p.x+ux*p.r*2.4,p.y+uy*p.r*2.4);ctx.lineTo(p.x-ux*p.r*.9+nx*p.r*.82,p.y-uy*p.r*.9+ny*p.r*.82);ctx.lineTo(p.x-ux*p.r*1.7,p.y-uy*p.r*1.7);ctx.lineTo(p.x-ux*p.r*.9-nx*p.r*.82,p.y-uy*p.r*.9-ny*p.r*.82);ctx.closePath();ctx.fill();ctx.strokeStyle='#b87825';ctx.lineWidth=1/worldZoom;ctx.stroke();}else if(p.special==='photon'){const pa=Math.atan2(p.vy,p.vx);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.ellipse(p.x,p.y,p.r*1.9,p.r*.46,pa,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ff8df4';ctx.lineWidth=1/worldZoom;ctx.beginPath();ctx.moveTo(p.x-Math.cos(pa)*p.r*3.4,p.y-Math.sin(pa)*p.r*3.4);ctx.lineTo(p.x+Math.cos(pa)*p.r*1.7,p.y+Math.sin(pa)*p.r*1.7);ctx.stroke();}else{ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
 if(p.allyShot){ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.x-p.vx*.018,p.y-p.vy*.018);ctx.lineTo(p.x+rand(-3,3),p.y+rand(-3,3));ctx.lineTo(p.x,p.y);ctx.stroke()}
 ctx.restore()}
 for(const e of enemies){if(onlineMode&&window.AbyssalEnemyNetcode?.renderedPosition){const p=window.AbyssalEnemyNetcode.renderedPosition(e,performance.now());e.x=p.x;e.y=p.y;}else if(e.interpDuration>0&&Number.isFinite(e.interpAt)){const ip=clamp((performance.now()-e.interpAt)/e.interpDuration,0,1);e.x=e.interpFromX+(e.interpTargetX-e.interpFromX)*ip;e.y=e.interpFromY+(e.interpTargetY-e.interpFromY)*ip;}else if(Number.isFinite(e.interpTargetX)){e.x=e.interpTargetX;e.y=e.interpTargetY;}const renderPad=e.r*(e.kind==='kraken'?2.8:e.kind==='devourer'?2.55:e.kind==='leviathan'?3.15:e.kind==='lurker'?2.55:BOSS_KINDS.includes(e.kind)?2.15:1.85);if(e.x+renderPad<cameraX||e.x-renderPad>cameraX+viewW/worldZoom||e.y+renderPad<cameraY||e.y-renderPad>cameraY+viewH/worldZoom)continue;drawCreature(e.x,e.y,e.r,e.angle,e.color,e.kind,t,false,e.hit,ctx,null,e);
  if(e.kind==='kraken'&&Number(e.krakenTelegraph)>0&&!e.krakenSweepActive){ctx.save();ctx.strokeStyle='rgba(213,180,255,.82)';ctx.lineWidth=2.2/GAME_WORLD_ZOOM;ctx.setLineDash([14/GAME_WORLD_ZOOM,9/GAME_WORLD_ZOOM]);ctx.beginPath();ctx.arc(e.x,e.y,e.r*(2.7+Number(e.krakenTelegraph)*.75),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
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

  for(const fx of effects){ctx.save();const progress=1-fx.life/fx.maxLife;ctx.globalAlpha=fx.type==='photon-ray'?clamp(fx.life/.065,0,1):clamp(fx.life/fx.maxLife,0,1);ctx.strokeStyle=fx.color;ctx.shadowBlur=lowPowerRendering?0:10;ctx.shadowColor=fx.color;ctx.lineWidth=fx.type==='ring'?4:(Number(fx.width)||3);let photonX2=fx.x2,photonY2=fx.y2;if(fx.type==='photon-ray'&&onlineRoomMode==='pvp'&&projectileHitsPvpWall(fx.x1,fx.y1,photonX2,photonY2,Math.max(1,Number(fx.width)||3))){let lo=0,hi=1;for(let step=0;step<9;step++){const mid=(lo+hi)*.5;if(projectileHitsPvpWall(fx.x1,fx.y1,fx.x1+(fx.x2-fx.x1)*mid,fx.y1+(fx.y2-fx.y1)*mid,Math.max(1,Number(fx.width)||3)))hi=mid;else lo=mid;}photonX2=fx.x1+(fx.x2-fx.x1)*lo;photonY2=fx.y1+(fx.y2-fx.y1)*lo;}ctx.beginPath();if(fx.type==='occluded-ring'){
 const radius=fx.max*progress,segments=360;let previous=null;
 for(let s=0;s<=segments;s++){const a=s/segments*Math.PI*2,ex=fx.x+Math.cos(a)*radius,ey=fx.y+Math.sin(a)*radius,blocked=projectileHitsPvpWall(fx.x,fx.y,ex,ey,2/GAME_WORLD_ZOOM);if(blocked){previous=null;continue;}if(!previous){ctx.moveTo(ex,ey);previous={x:ex,y:ey};continue;}const edgeBlocked=projectileHitsPvpWall(previous.x,previous.y,ex,ey,2/GAME_WORLD_ZOOM);if(edgeBlocked){ctx.moveTo(ex,ey);}else ctx.lineTo(ex,ey);previous={x:ex,y:ey};}
}else if(fx.type==='projectile-dissolve'){ctx.globalAlpha*=Math.max(0,1-progress);ctx.arc(fx.x,fx.y,fx.max*progress,0,Math.PI*2);}else if(fx.type==='nova-core'){ctx.globalAlpha*=Math.max(0,1-progress);ctx.fillStyle=fx.color||'#72f5ff';ctx.beginPath();ctx.arc(fx.x,fx.y,Math.max(4/GAME_WORLD_ZOOM,fx.max*progress),0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(fx.x,fx.y,fx.max*progress,0,Math.PI*2)}else if(fx.type==='ring'||fx.type==='regen-pulse'){ctx.arc(fx.x,fx.y,fx.max*progress,0,Math.PI*2)}else if(fx.type==='ward-collapse'){ctx.arc(fx.x,fx.y,fx.max*(1-progress*.72),0,Math.PI*2)}else if(fx.type==='electric-arc'){const dx=fx.x2-fx.x1,dy=fx.y2-fx.y1,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,segments=7;for(let s=0;s<=segments;s++){const q=s/segments,edge=q===0||q===1?0:1,wave=Math.sin((Number(fx.seed)||0)*.17+s*2.2)*Math.min(9/worldZoom,len*.055)*edge,xx=fx.x1+dx*q+nx*wave,yy=fx.y1+dy*q+ny*wave;if(s===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}}else if(fx.type==='ricochet-arc'){const dx=fx.x2-fx.x1,dy=fx.y2-fx.y1;ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(fx.x1+dx*.46-dy*.08,fx.y1+dy*.46+dx*.08);ctx.lineTo(fx.x2,fx.y2);}else{ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(fx.type==='photon-ray'?photonX2:fx.x2,fx.type==='photon-ray'?photonY2:fx.y2)}ctx.stroke();if(fx.type==='electric-arc'){ctx.globalAlpha*=.72;ctx.strokeStyle='#efffff';ctx.lineWidth=Math.max(.8,(Number(fx.width)||3)*.32);ctx.stroke();}if(fx.type==='photon-ray'){ctx.strokeStyle='#ffffff';ctx.shadowBlur=0;ctx.lineWidth=Math.max(.8,(Number(fx.width)||3)*.32);ctx.beginPath();ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(photonX2,photonY2);ctx.stroke()}ctx.restore()}
 for(const pool of bloodPools){
  const q=clamp(pool.life/pool.maxLife,0,1),grow=1+(1-q)*.18;
  ctx.save();ctx.translate(pool.x,pool.y);ctx.rotate(pool.angle||0);ctx.globalAlpha=q*.56;ctx.fillStyle='#8f1028';ctx.shadowBlur=(lowPowerRendering?3:16)/worldZoom;ctx.shadowColor='rgba(151,8,39,.68)';
  ctx.beginPath();const lobes=pool.lobes||[];for(let i=0;i<lobes.length;i++){const l=lobes[i],px=Math.cos(l.a)*l.reach*grow,py=Math.sin(l.a)*l.reach*.68*grow;if(i===0)ctx.moveTo(px,py);else{const prev=lobes[i-1],cx=Math.cos((prev.a+l.a)/2)*pool.r*.55,cy=Math.sin((prev.a+l.a)/2)*pool.r*.38;ctx.quadraticCurveTo(cx,cy,px,py);}}ctx.closePath();ctx.fill();
  ctx.globalAlpha=q*.34;ctx.fillStyle='#c4213c';for(const l of lobes){ctx.beginPath();ctx.ellipse(Math.cos(l.a)*l.reach*.62,Math.sin(l.a)*l.reach*.42,l.width*1.2,l.width*.55,l.a,0,Math.PI*2);ctx.fill();}
  for(const d of pool.droplets||[]){ctx.globalAlpha=q*(.28+Math.min(.28,d.r/pool.r));ctx.beginPath();ctx.ellipse(Math.cos(d.a)*d.d,Math.sin(d.a)*d.d,d.r*d.stretch,d.r,d.a,0,Math.PI*2);ctx.fill();}
  ctx.restore();
 }
 for(const number of damageNumbers){const q=clamp(number.life/number.maxLife,0,1),rise=(1-q)*48/GAME_WORLD_ZOOM;ctx.save();ctx.globalAlpha=Math.min(1,q*1.35);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.max(13,17/worldZoom)}px var(--abyssal-runic),Georgia,serif`;ctx.fillStyle=number.tone==='poison'?'#39ff72':number.tone==='energy'?'#32cfff':'#ff174d';ctx.shadowBlur=12/worldZoom;ctx.shadowColor=ctx.fillStyle;ctx.strokeStyle='rgba(0,0,0,.72)';ctx.lineWidth=3/worldZoom;const tx=number.x+number.driftX*(1-q),ty=number.y-rise;ctx.strokeText(String(number.value),tx,ty);ctx.fillText(String(number.value),tx,ty);ctx.restore();}
 const particleShadowBlur=0;for(const p of particles){if(p.x<cameraX-20/worldZoom||p.x>cameraX+viewW/worldZoom+20/worldZoom||p.y<cameraY-20/worldZoom||p.y>cameraY+viewH/worldZoom+20/worldZoom)continue;ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.shadowBlur=particleShadowBlur;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(.4+.6*p.life/p.max),0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
 if(player){for(const tr of player.trail){if(tr.life>0){ctx.globalAlpha=tr.life/.28*.18;ctx.fillStyle='#7ffbf2';ctx.beginPath();ctx.arc(tr.x,tr.y,player.r*.7,0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1;if(damageFlash<=0||Math.floor(t/60)%2===0)drawCreature(player.x,player.y,player.r,player.angle,currentSkinColor(),'player',t,true);if(upgradeLevels.speed>0&&(Math.abs(player.x-(player.trail.at(-1)?.x??player.x))>0||player.trail.length>1)){ctx.save();ctx.globalAlpha=.18;ctx.strokeStyle='#68f4d7';ctx.lineWidth=(1.2+upgradeLevels.speed*.35)/worldZoom;for(let i=0;i<2+Math.min(3,upgradeLevels.speed);i++){const a=(player.angle||0)+Math.PI+(i-(1+upgradeLevels.speed)/2)*.22,len=(18+upgradeLevels.speed*6)/worldZoom;ctx.beginPath();ctx.moveTo(player.x+Math.cos(a)*player.r*.8,player.y+Math.sin(a)*player.r*.8);ctx.lineTo(player.x+Math.cos(a)*len,player.y+Math.sin(a)*len);ctx.stroke();}ctx.restore();}if(upgradeLevels.magnet>0){ctx.save();ctx.globalAlpha=.12+.025*Math.sin(t*.004);ctx.strokeStyle='#a98cff';ctx.lineWidth=1/worldZoom;ctx.setLineDash([3/worldZoom,8/worldZoom]);ctx.beginPath();ctx.arc(player.x,player.y,Math.min(92/GAME_WORLD_ZOOM,26/GAME_WORLD_ZOOM+upgradeLevels.magnet*13/GAME_WORLD_ZOOM),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();}if(upgrades.shell>0){ctx.save();ctx.globalAlpha=.28;ctx.strokeStyle='#90b8b0';ctx.lineWidth=2/worldZoom;const plates=Math.min(6,2+upgrades.shell);for(let i=0;i<plates;i++){const a=t*.00018+i*Math.PI*2/plates,r=player.r*1.7;ctx.beginPath();ctx.arc(player.x+Math.cos(a)*r,player.y+Math.sin(a)*r,3.2/worldZoom,0,Math.PI*2);ctx.stroke();}ctx.restore();}if(upgrades.lastStand>0&&hp/maxHp<=.3){ctx.save();ctx.globalAlpha=.38+.18*Math.sin(t*.014);ctx.strokeStyle='#ff4d6d';ctx.lineWidth=2.3/worldZoom;ctx.beginPath();ctx.arc(player.x,player.y,player.r*1.55,0,Math.PI*2);ctx.stroke();ctx.restore();}if(upgrades.predator>0){ctx.save();ctx.globalAlpha=.15;ctx.strokeStyle='#ff6b78';ctx.lineWidth=1/worldZoom;const marks=Math.min(5,2+upgrades.predator);for(let i=0;i<marks;i++){const a=t*.00032+i*Math.PI*2/marks,r=player.r*1.9;ctx.beginPath();ctx.moveTo(player.x+Math.cos(a)*r,player.y+Math.sin(a)*r);ctx.lineTo(player.x+Math.cos(a)*r*1.13,player.y+Math.sin(a)*r*1.13);ctx.stroke();}ctx.restore();}if(upgrades.shield>0){const chargeCount=Math.min(3,Math.max(0,Math.floor(upgrades.shield)));const shieldPulse=1+Math.sin(t*.008)*.025;ctx.save();ctx.globalAlpha=.18+chargeCount*.045;ctx.fillStyle='#73efff';ctx.strokeStyle='#9cf8ff';ctx.lineWidth=1.8/worldZoom;ctx.shadowBlur=10/worldZoom;ctx.shadowColor='#64eaff';ctx.beginPath();ctx.arc(player.x,player.y,player.r*(2.05+chargeCount*.08)*shieldPulse,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.42+chargeCount*.08;ctx.stroke();ctx.restore();}if(player.invuln>0){ctx.save();const shieldPulse=1+Math.sin(t*.012)*.035;ctx.globalAlpha=.58;ctx.strokeStyle='#8af9ff';ctx.fillStyle='rgba(105,235,255,.09)';ctx.lineWidth=2.2/worldZoom;ctx.shadowBlur=14/worldZoom;ctx.shadowColor='#70f6ff';ctx.beginPath();ctx.arc(player.x,player.y,player.r*1.9*shieldPulse,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}ctx.save();ctx.strokeStyle='rgba(126,245,244,.20)';ctx.fillStyle='rgba(126,245,244,.025)';ctx.lineWidth=1;ctx.setLineDash([5,9]);ctx.beginPath();if(!upgrades.abyssEye){ctx.arc(player.x,player.y,getFiringRange(),0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.setLineDash([]);ctx.restore();if(damageFlash>0){ctx.fillStyle=`rgba(255,65,100,${damageFlash*.45})`;ctx.fillRect(0,0,W,H)}}
 // Combined skill: circular field matches firing range, with a restrained spark animation.
 if(player&&upgrades.gravitationalRupture>0){
  const fieldRange=getFiringRange();
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
 ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.font='900 10px "Cinzel", Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';
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
function applyAdaptiveQuality(level,reason='runtime'){
 const next=clamp(Math.round(level),0,2);if(next===adaptiveQualityLevel)return;
 adaptiveQualityLevel=next;adaptiveDprScale=ADAPTIVE_QUALITY[next].dpr;lowPowerRendering=next===0;
 // Rebuild only the framebuffer. World/gameplay coordinates are untouched.
 const nativeDpr=Math.max(1,window.devicePixelRatio||1),baseCap=mobileViewport?(next===0?1.25:next===1?1.55:2):(next===0?1.15:next===1?1.4:1.65);
 dpr=Math.min(nativeDpr*adaptiveDprScale,baseCap);
 canvas.width=Math.max(1,Math.floor(viewW*dpr));canvas.height=Math.max(1,Math.floor(viewH*dpr));canvas.style.width=viewW+'px';canvas.style.height=viewH+'px';
 backgroundGradientCache=null;backgroundBloomCache=null;
 window.dispatchEvent(new CustomEvent('abyssal-quality-change',{detail:{level:next,name:ADAPTIVE_QUALITY[next].name,reason,dpr}}));
}
function updateAdaptivePerformance(now){
 if(gameState!=='playing'||now-adaptiveQualityLastCheck<2500||gameFrameFps<=0)return;
 adaptiveQualityLastCheck=now;
 const fps=gameFrameFps,p95=(()=>{const a=[];for(let i=0;i<gameFrameSampleCount;i++)a.push(gameFrameSamples[i]);a.sort((x,y)=>x-y);return a.length?a[Math.min(a.length-1,Math.ceil(a.length*.95)-1)]:0})();
 const bad=fps<48||p95>23,good=fps>=57&&p95<18;
 if(bad){adaptiveQualityBadWindows++;adaptiveQualityGoodWindows=0}else if(good){adaptiveQualityGoodWindows++;adaptiveQualityBadWindows=0}else{adaptiveQualityBadWindows=Math.max(0,adaptiveQualityBadWindows-1);adaptiveQualityGoodWindows=0}
 if(adaptiveQualityBadWindows>=2&&adaptiveQualityLevel>0){adaptiveQualityBadWindows=0;applyAdaptiveQuality(adaptiveQualityLevel-1,'sustained-frame-pressure')}
 else if(adaptiveQualityGoodWindows>=8&&adaptiveQualityLevel<2){adaptiveQualityGoodWindows=0;applyAdaptiveQuality(adaptiveQualityLevel+1,'sustained-headroom')}
}
window.AbyssalAdaptivePerformance={snapshot:()=>({level:adaptiveQualityLevel,name:ADAPTIVE_QUALITY[adaptiveQualityLevel].name,dpr:Number(dpr.toFixed(2)),fps:gameFrameFps}),setLevel:level=>applyAdaptiveQuality(level,'manual-diagnostic')};
function getAbyssalPerformanceSnapshot(){
 const samples=[];for(let i=0;i<gameFrameSampleCount;i++)samples.push(gameFrameSamples[i]);samples.sort((a,b)=>a-b);
 const p95=samples.length?samples[Math.min(samples.length-1,Math.ceil(samples.length*.95)-1)]:0;
 const memory=performance.memory?.usedJSHeapSize;
 return {fps:gameFrameFps,lastUpdateMs:Number(gameLastUpdateMs.toFixed(2)),lastDrawMs:Number(gameLastDrawMs.toFixed(2)),frameP95Ms:Number(p95.toFixed(2)),maxFrameMs:Number(gameMaxFrameMs.toFixed(2)),longTaskCount:gameLongTaskCount,maxLongTaskMs:Number(gameMaxLongTaskMs.toFixed(2)),entities:{enemies:enemies.length,orbs:orbs.length,projectiles:projectiles.length,particles:particles.length,effects:effects.length},network:window.AbyssalOnline?.positionDiagnostics?.()||null,heapUsedMb:Number.isFinite(memory)?Number((memory/1048576).toFixed(1)):null};
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
  if(active){const updateStarted=performance.now();update(dt);updateAbyssalMusic();updateMs=performance.now()-updateStarted;}
  const drawStarted=performance.now();draw(t);const frameEnded=performance.now();drawMs=frameEnded-drawStarted;recordGameFrame(frameStarted,frameEnded,updateMs,drawMs);updateAdaptivePerformance(frameEnded);
 }catch(err){console.error('Abyssal frame error:',err);if(!loopErrorShown){loopErrorShown=true;showToast('A pressão distorce os instrumentos. Consulte o Console (F12) se persistir.')}}
 requestAnimationFrame(loop);
}
function coords(e){const r=canvas.getBoundingClientRect();return{x:cameraX+(e.clientX-r.left)/worldZoom,y:cameraY+(e.clientY-r.top)/worldZoom}}
canvas.addEventListener('pointerdown',e=>{if(gameState!=='playing'||isMobileDevice())return;pointer={...coords(e),clientX:e.clientX,clientY:e.clientY,down:true,active:true};canvas.setPointerCapture?.(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!isMobileDevice()){pointer.clientX=e.clientX;pointer.clientY=e.clientY;Object.assign(pointer,coords(e));pointer.active=true;}});
window.addEventListener('pointermove',e=>{if(isMobileDevice())return;pointer.clientX=e.clientX;pointer.clientY=e.clientY;if(isPcMouseAimMode()&&gameState==='playing')updateMouseAimFromCursor();},{passive:true});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>canvas.addEventListener(ev,()=>{pointer.down=false;pointer.active=false}));
const joystick=$('mobileJoystick'),joystickKnob=$('joystickKnob'),gameShell=$('gameShell');
function setJoystickFromPointer(e){if(!joystick||!joystickKnob)return;const base=joystick.querySelector('.joystick-base');if(!base)return;const r=base.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=Math.max(18,r.width*.34);let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max;}joystickVector.x=dx/max;joystickVector.y=dy/max;joystickVector.active=Math.hypot(joystickVector.x,joystickVector.y)>.13;joystickKnob.style.transform=`translate(${dx}px, ${dy}px)`;}
function releaseMobileJoystick(e){if(!joystick||joystickVector.pointerId!==e.pointerId)return;joystickVector={x:0,y:0,active:false,pointerId:null};joystick.hidden=true;joystick.classList.remove('is-floating');joystick.style.left='';joystick.style.top='';joystick.style.bottom='';joystick.style.transform='';if(joystickKnob)joystickKnob.style.transform='translate(0, 0)';}
if(gameShell&&joystick){
 gameShell.addEventListener('pointerdown',e=>{
  if(gameState!=='playing'||!isMobileDevice()||joystickVector.pointerId!==null)return;
  if(e.target.closest('button,a,input,select,textarea,.active-ability,.screen,#mobileJoystick,#mobileMoveStick,#mobileAimStick'))return;
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
// Dual sticks fixos com captura de toque independente.
const mobileMoveStick=$('mobileMoveStick'),mobileAimStick=$('mobileAimStick');
function updateFixedStick(e,stick,knob,isAim){if(!stick||!knob)return;const base=stick.querySelector('.joystick-base');if(!base)return;const r=base.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=Math.max(18,r.width*.34);let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max;}const vector={x:dx/max,y:dy/max,active:Math.hypot(dx/max,dy/max)>.13,pointerId:e.pointerId};if(isAim)aimJoystickVector=vector;else joystickVector=vector;knob.style.transform=`translate(${dx}px, ${dy}px)`;}
function resetFixedStick(knob,isAim){if(isAim)aimJoystickVector={x:0,y:0,active:false,pointerId:null};else joystickVector={x:0,y:0,active:false,pointerId:null};if(knob)knob.style.transform='translate(0, 0)';}
function configureControlButtons(){const opens=[$('controlsBtn'),$('mobileControlsTopBtn')].filter(Boolean),screen=$('controlsScreen'),close=$('controlsCloseBtn');const pc=[...document.querySelectorAll('[data-control-pc]')],mobile=[...document.querySelectorAll('[data-control-mobile]')];const refresh=()=>{pc.forEach(b=>{const a=b.dataset.controlPc===controlSettings.pc;b.classList.toggle('control-choice-active',a);b.setAttribute('aria-pressed',String(a));});mobile.forEach(b=>{const a=b.dataset.controlMobile===controlSettings.mobile;b.classList.toggle('control-choice-active',a);b.setAttribute('aria-pressed',String(a));});};opens.forEach(open=>open.addEventListener('click',()=>{refresh();if(screen)screen.hidden=false;}));close?.addEventListener('click',()=>{if(screen)screen.hidden=true;});screen?.addEventListener('click',e=>{if(e.target===screen)screen.hidden=true;});pc.forEach(b=>b.addEventListener('click',()=>{controlSettings.pc=b.dataset.controlPc;localStorage.setItem('abyssalControlsPc',controlSettings.pc);autoFollowCursor=false;pointer.down=false;refresh();}));mobile.forEach(b=>b.addEventListener('click',()=>{controlSettings.mobile=b.dataset.controlMobile;localStorage.setItem('abyssalControlsMobile',controlSettings.mobile);joystickVector={x:0,y:0,active:false,pointerId:null};aimJoystickVector={x:0,y:0,active:false,pointerId:null};const mobilePlaying=gameState==='playing'&&isMobileDevice();mobileMoveStick?.classList.remove('dual-stick-visible');mobileAimStick?.classList.toggle('dual-stick-visible',mobilePlaying&&controlSettings.mobile==='dual-stick');const old=$('mobileJoystick');if(old){old.hidden=true;old.classList.remove('is-floating');}refresh();}));}
function setupDualStickEvents(){
 const activeSticks=new Map();
 [[mobileAimStick,true]].forEach(([stick,isAim])=>{
  if(!stick)return;
  const knob=stick.querySelector('.joystick-knob');
  stick.addEventListener('pointerdown',e=>{
   if(gameState!=='playing'||!isMobileDevice())return;
   e.preventDefault();
   const current=isAim?aimJoystickVector:joystickVector;
   if(current.pointerId!==null)return;
   activeSticks.set(e.pointerId,{stick,knob,isAim});
   try{stick.setPointerCapture?.(e.pointerId)}catch(_){}
   updateFixedStick(e,stick,knob,isAim);
  });
 });
 window.addEventListener('pointermove',e=>{
  const active=activeSticks.get(e.pointerId);
  if(active)updateFixedStick(e,active.stick,active.knob,active.isAim);
 },{passive:false});
 const release=e=>{
  const active=activeSticks.get(e.pointerId);
  if(!active)return;
  resetFixedStick(active.knob,active.isAim);
  activeSticks.delete(e.pointerId);
 };
 window.addEventListener('pointerup',release);
 window.addEventListener('pointercancel',release);
}
configureControlButtons();setupDualStickEvents();
function isTextEntryTarget(target){return Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'));}
window.addEventListener('keydown',e=>{if(isTextEntryTarget(e.target))return;keys[e.key]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if((e.key==='t'||e.key==='T')&&!e.repeat&&!isMobileDevice()&&gameState==='playing'){autoFollowCursor=!autoFollowCursor;if(autoFollowCursor){pointer.down=false;showToast('MOVIMENTO AUTOMÁTICO PELO CURSOR · T PARA PARAR');}else showToast('MOVIMENTO AUTOMÁTICO DESATIVADO');}if((e.key==='q'||e.key==='Q')&&Number(metaUpgrades.pulse)>0)activateAbility('pulse');if((e.key==='e'||e.key==='E')&&Number(metaUpgrades.dash)>0)activateAbility('dash');if(e.key==='Escape'||e.key==='p'||e.key==='P'){if(gameState==='playing')pauseGame();else if(gameState==='paused')resumeGame()}});
window.addEventListener('keyup',e=>{if(isTextEntryTarget(e.target))return;keys[e.key]=false;});
function setReviveMessage(message){const node=$('reviveAdMessage');if(node)node.textContent=message||'';}
let adAudioWasRunning=false;
function prepareForH5Ad(){
 adAudioWasRunning=Boolean(audioCtx&&audioCtx.state==='running');
 try{if(audioCtx&&audioCtx.state==='running')audioCtx.suspend();}catch(_){}
}
function resumeAfterH5Ad(){
 try{if(adAudioWasRunning&&audioCtx&&audioCtx.state==='suspended')audioCtx.resume();}catch(_){}
 adAudioWasRunning=false;last=performance.now();
}
function resumeAfterRewardedRevive(){
 if(onlineMode){window.AbyssalOnline?.revivePlayer?.();return;}
 if(!player){setReviveMessage('Não foi possível recuperar este mergulho.');return;}
 hp=maxHp;player.invuln=3;gameState='playing';$('gameOverScreen').hidden=true;$('hud').hidden=false;$('pauseBtn').hidden=false;setMobileGameActive(true);setReviveMessage('Ressurreição concluída! Nível e habilidades preservados.');updateHud();last=performance.now();
}
$('reviveWithAdBtn')?.addEventListener('click',()=>{
 const button=$('reviveWithAdBtn');if(!button)return;
 if(typeof window.adBreak!=='function'){setReviveMessage('Anúncio recompensado indisponível neste momento. Tente novamente mais tarde.');return;}
 button.disabled=true;setReviveMessage('Carregando anúncio recompensado…');let requested=false;
 try{window.adBreak({type:'reward',name:'abyssal-revive',beforeAd:prepareForH5Ad,afterAd:resumeAfterH5Ad,beforeReward:showAd=>{if(typeof showAd==='function')showAd();},adViewed:()=>{if(requested)return;requested=true;resumeAfterRewardedRevive();},adDismissed:()=>{if(!requested)setReviveMessage('O anúncio foi fechado antes da recompensa.');button.disabled=false;},adBreakDone:()=>{button.disabled=false;if(!requested)setReviveMessage('Nenhuma recompensa foi confirmada pelo anúncio.');}});}
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
     gameState = 'menu';
     onlineMode = false;
     enemies = []; orbs = []; particles = []; projectiles = []; effects = [];
     player = null;
     $('gameOverScreen').hidden = true;
     $('hud').hidden = true;
     document.body.classList.remove('game-active');
     if(window.AbyssalOnline?.isAuthenticated?.()){
       window.AbyssalOnline?.leaveWorld?.();
       setTimeout(()=>window.AbyssalOnline?.showRooms?.(), 150);
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
document.addEventListener('visibilitychange',()=>{if(document.hidden&&gameState==='playing'&&!onlineMode)pauseGame();if(!document.hidden){last=performance.now();if(audioCtx?.state==='suspended')audioCtx.resume().then(()=>{if(soundOn&&!ambientNodes)startAmbientMusic()}).catch(()=>{});}});
window.addEventListener('resize',()=>{if(gameState==='playing'||(onlineMode&&gameState==='upgrade')){setMobileGameActive(true);requestAnimationFrame(positionMobileRightStack);}else resize()});
window.addEventListener('abyssal-remote-shot',ev=>{const d=ev.detail;if(!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;
 const col=d.color||'#9bbcff',special=d.special||null,x=d.x*W,y=d.y*H,vx=(d.vx||0)*W,vy=(d.vy||0)*H;
 if(special==='nova'){const max=Number(d.effectRadius)||294/GAME_WORLD_ZOOM;spawnNovaVisual(x,y,max,col,onlineRoomMode==='pvp');return;}
 if(special==='photonRay'){const length=Number(d.effectRadius)||294/GAME_WORLD_ZOOM,mag=Math.hypot(vx,vy)||1;const beamKey=String(d.fromId||d.from||'remote'),beamTargetId=d.beamTargetId==null?null:String(d.beamTargetId);const remoteEndValid=Number.isFinite(d.beamEndX)&&Number.isFinite(d.beamEndY);const beamX2=remoteEndValid?d.beamEndX*W:x+vx/mag*length,beamY2=remoteEndValid?d.beamEndY*H:y+vy/mag*length;const width=PHOTON_RAY_VISUAL.widths[Math.max(1,Math.min(3,Number(d.beamLevel)||1))]/GAME_WORLD_ZOOM;const existing=effects.find(fx=>fx.type==='photon-ray'&&fx.remoteBeamKey===beamKey);if(existing){existing.targetX1=x;existing.targetY1=y;existing.targetX2=beamX2;existing.targetY2=beamY2;existing.remoteTargetId=beamTargetId;existing.width=width;existing.life=PHOTON_RAY_VISUAL.remoteHold;existing.maxLife=PHOTON_RAY_VISUAL.remoteHold;existing.color=PHOTON_RAY_VISUAL.color;}else effects.push({type:'photon-ray',remoteBeamKey:beamKey,remoteTargetId:beamTargetId,x1:x,y1:y,x2:beamX2,y2:beamY2,targetX1:x,targetY1:y,targetX2:beamX2,targetY2:beamY2,width,life:PHOTON_RAY_VISUAL.remoteHold,maxLife:PHOTON_RAY_VISUAL.remoteHold,color:PHOTON_RAY_VISUAL.color});return;}
 projectiles.push({x,y,vx,vy,r:(special==='pierce'?6.5:special==='electric'?5.8:5.2)/GAME_WORLD_ZOOM,life:1.05,damage:0,color:col,special,allyShot:true,remoteVisual:true,trailLife:.16});
 burst(x,y,col,5,75);
 if(projectiles.length>projectileBudget())projectiles.splice(0,projectiles.length-projectileBudget());
});
window.addEventListener('abyssal-remote-photon-stop',event=>{const fromId=String(event.detail?.fromId||'');if(!fromId)return;for(const fx of effects)if(fx.type==='photon-ray'&&fx.remoteBeamKey===fromId)fx.life=Math.min(fx.life,.06);});
window.AbyssalGameHooks={
 getPlayerPosition:()=>onlineMode&&player&&gameState!=='menu'&&gameState!=='over'?{x:player.x,y:player.y,angle:player.angle||0}:null,
 roomMode:()=>onlineRoomMode,
  setPlayerPosition:(x,y)=>{if(!player||!Number.isFinite(Number(x))||!Number.isFinite(Number(y)))return false;player.x=clamp(Number(x),8/GAME_WORLD_ZOOM,W-8/GAME_WORLD_ZOOM);player.y=clamp(Number(y),8/GAME_WORLD_ZOOM,H-8/GAME_WORLD_ZOOM);updateCamera();return true;},
 reconcilePlayer:({dx=0,dy=0,blocked=false}={})=>{
  if(!player||!onlineMode||!Number.isFinite(dx)||!Number.isFinite(dy))return false;
  const error=Math.hypot(dx,dy);if(error<.75)return true;
  // Apply the authoritative error to the current predicted position. This preserves
  // movement performed after the acknowledged sequence instead of snapping to an old state.
  const weight=blocked?1:Math.min(1,.35+error/120);
  player.x=clamp(player.x+dx*weight,8/GAME_WORLD_ZOOM,W-8/GAME_WORLD_ZOOM);
  player.y=clamp(player.y+dy*weight,8/GAME_WORLD_ZOOM,H-8/GAME_WORLD_ZOOM);
  updateCamera();return true;
 },
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
 try{window.adBreak({type:'reward',name:'abyssal-wheel',beforeAd:prepareForH5Ad,beforeReward:showAd=>{if(typeof showAd==='function')showAd();},adViewed:()=>{if(requested)return;requested=true;window.AbyssalOnline.spinWheel();},adDismissed:()=>{wheelBusy=false;$('spinWheelBtn').disabled=false;$('testWheelBtn').disabled=false;$('wheelMessage').textContent='O anúncio foi fechado antes de concluir. Nenhuma recompensa foi entregue.';},afterAd:()=>{resumeAfterH5Ad();if(!requested){wheelBusy=false;$('spinWheelBtn').disabled=false;$('testWheelBtn').disabled=false;}}});}catch(e){wheelBusy=false;$('spinWheelBtn').disabled=false;$('testWheelBtn').disabled=false;$('wheelMessage').textContent='Não foi possível abrir o anúncio. Verifique a integração do AdSense H5.';}
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
 if(Number(data.damage)>0)spawnDamageNumber(Number(data.enemyX)||enemy.x,Number(data.enemyY)||enemy.y,Number(data.damage),damageTone(data.skillId));
}
window.addEventListener('abyssal-player-vitals',ev=>applyOnlinePlayerVitals(ev.detail));
window.addEventListener('abyssal-pvp-hit',ev=>{const d=ev.detail||{};if(Number(d.damage)<=0)return;const selfId=window.AbyssalOnline?.getSocketId?.();if(selfId&&String(d.targetId)===String(selfId))return;const px=Number(d.x)*W,py=Number(d.y)*H;if(Number.isFinite(px)&&Number.isFinite(py))spawnDamageNumber(px,py,Number(d.damage),damageTone(d.skillId));});

window.addEventListener('abyssal-world-damaged',ev=>applyWorldEnemyDamage(ev.detail));
window.addEventListener('abyssal-world-damaged-batch',ev=>applyWorldEnemyDamageBatch(ev.detail));
window.addEventListener('abyssal-world-xp-orb-spawned',ev=>applySharedOrbSpawn(ev.detail));
window.addEventListener('abyssal-world-xp-orbs-spawned',ev=>{for(const orb of Array.isArray(ev.detail)?ev.detail:[])applySharedOrbSpawn(orb);});
window.addEventListener('abyssal-world-xp-orbs-expired',ev=>removeSharedOrbIds(ev.detail));
window.addEventListener('abyssal-world-xp-orb-collected',ev=>{const d=ev.detail||{};removeSharedOrbIds([d.orbId]);const x=Number(d.x),y=Number(d.y);if(Number.isFinite(x)&&Number.isFinite(y)){burst(x,y,'#b8a7ff',9,70);audio(680,.06,'sine',.012);}});
window.addEventListener('abyssal-world-damage-result',ev=>{const d=ev.detail||{};if(d.ok){applyWorldEnemyDamage(d);return;}const reason=String(d.reason||'');if(['not-in-room','not-connected','enemy-not-found','ack-timeout'].includes(reason))return;const now=performance.now();if(onlineMode&&now-lastDamageWarningAt>15000){lastDamageWarningAt=now;console.warn('[Abyssal] Dano online rejeitado:',reason);}});
window.addEventListener('abyssal-boss-warning',ev=>{
 const d=ev.detail||{};if(!d.kind)return;
 if(onlineMode&&onlineRoomMode==='pvp')return;
 if(onlineMode){progressionDistance=100;progressionPausedForBoss=true;activeBossEntities=[{id:d.id,kind:d.kind}];activeBossEntity=activeBossEntities[0];updateProgressionTrackUI();}
 const warningAlreadyShown=pendingProgressionBossWarningKind===d.kind&&(performance.now()-pendingProgressionBossWarningAt)<12000;
 if(warningAlreadyShown){pendingProgressionBossWarningKind=null;pendingProgressionBossWarningAt=0;return;}
 showBossAlert(d.kind,d.id,d.threat,true);
});
window.addEventListener('abyssal-world-defeated',ev=>{const e=ev.detail;if(!e)return;onlineEnemyById.delete(String(e.id));enemies=enemies.filter(enemy=>String(enemy.id)!==String(e.id));const bosses=BOSS_KINDS.includes(e.kind)||e.boss===true;if(bosses){bossKillsThisRun++;if(onlineMode&&progressionPausedForBoss){activeBossEntities=[];onProgressionBossDefeated(e);}updateHud();showToast('ENTIDADE ABISSAL ELIMINADA · +100 MOEDAS');}const x=Number(e.x)||W*.5,y=Number(e.y)||H*.5;burst(x,y,e.color||'#8ffff4',bosses?(e.kind==='kraken'?38:30):10,bosses?225:85);audio(bosses?180:260,.08,'triangle',.025);});
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
 if(bossCount&&onlineMode&&progressionPausedForBoss){activeBossEntities=[];onProgressionBossDefeated();}
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
 skinData.forEach(skin=>{const owned=ownedSkins.includes(skin.id),equipped=equippedSkin===skin.id,currencySymbol=shopCurrency.toUpperCase(),bossIds=['leviathan','kraken','aberration','angler','maw','devourer'],predatorIds=['reefshark','hammerhead','abysscroc','armoredgator'],brlAmount=skin.id==='violet'?100:(bossIds.includes(skin.id)?999:(predatorIds.includes(skin.id)?499:skin.price)),amount=shopCurrency==='brl'?brlAmount:Math.round(brlAmount*Number(shopRates[shopCurrency]||0)),price=skin.paid?(shopCurrency==='brl'||Number.isFinite(shopRates[shopCurrency])?new Intl.NumberFormat(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR',{style:'currency',currency:shopCurrency.toUpperCase()}).format(amount/100):(english?'Rate unavailable':'Cotação indisponível')):`${skin.price.toLocaleString(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR')} ◈`,name=english?(englishNames[skin.id]||skin.name):skin.name;
    const isGreensnake = skin.id === 'greensnake';
    const isEel = skin.id === 'electriceel';
    const eelOwned = ownedSkins.includes('electriceel');
    const conquerorCompleted = ownedSkins.includes('greensnake');
const card=document.createElement('div');card.className='skin-card'+(owned?' owned':'')+(equipped?' equipped':'');card.innerHTML=`<div class="skin-preview"><canvas class="skin-preview-canvas" width="160" height="92" aria-label="${english?'Preview':'Prévia'} ${name}"></canvas></div><strong>${name}</strong><p>${english?(englishDescriptions[skin.id]||skin.desc):skin.desc}</p><p class="skin-ability"><b>${english?'ABILITY':'HABILIDADE'}</b> ${english?(englishAbilities[skin.id]||skin.ability||'A rare adaptation of the deep.'):skin.ability||'Uma adaptação rara das profundezas.'}</p><button ${equipped?'disabled':''}>${equipped?(english?'EQUIPPED':'EQUIPADA'):owned?(english?'EQUIP':'EQUIPAR'):skin.paid?`${english?'BUY':'COMPRAR'} · ${price}`:`${english?'BUY':'COMPRAR'} · ${skin.price.toLocaleString(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR')} ◈`}</button>`;renderCreaturePreview(card.querySelector('canvas'),'player',skin.color,skin);const btn=card.querySelector('button');if(!equipped)btn.addEventListener('click',()=>{if(isGreensnake&&!conquerorCompleted){showToast('BLOQUEADA · Conquiste o abismo em 100% para desbloquear esta skin!');return;}if(isEel&&!eelOwned){showToast('BLOQUEADA · Use o código promocional no menu para desbloquear!');return;}if(owned){equippedSkin=skin.id;saveCosmetics();renderShop();showToast(english?'SKIN EQUIPPED':'SKIN EQUIPADA');}else if(skin.paid){openSkinPurchaseConfirm(skin.id,name,price,false);}else if(window.AbyssalOnline?.isAuthenticated()){window.AbyssalOnline.purchaseSkin(skin.id)}else if(coins>=skin.price){coins-=skin.price;ownedSkins.push(skin.id);equippedSkin=skin.id;saveCosmetics();renderShop();addNotification('🐚 ' + skin.name + ' desbloqueada! Adquirida com ' + skin.price.toLocaleString('pt-BR') + ' moedas abissais na Loja. Equipe-a pelo Catálogo.', 'NOVA SKIN · LOJA ABISSAL', 'skin');
        updateNotifBadge(); updateNotifBadge();showToast(english?'SKIN UNLOCKED':'SKIN DESBLOQUEADA');audio(760,.12,'triangle',.03)}else showToast(english?'NOT ENOUGH ABYSSAL COINS':'MOEDAS ABISSAIS INSUFICIENTES');});grid.appendChild(card)});
 const bundle=document.createElement('article');bundle.className='skin-card boss-bundle-card';const bundleIds=['leviathan','kraken','aberration','angler','maw','devourer'];const remaining=bundleIds.filter(id=>!ownedSkins.includes(id)).length;const bundleBrlAmount=remaining===6?4999:null;const bundleAmount=shopCurrency==='brl'?bundleBrlAmount:Math.round(bundleBrlAmount*Number(shopRates[shopCurrency]||0));const bundleNames={leviathan:'Leviatã Cego',kraken:'Kraken do Abismo',aberration:'Máscara da Aberração',angler:'Lanterna Mortal',maw:'Mandíbula da Fenda',devourer:'Devorador do Vazio'};bundle.innerHTML=`<div class="boss-bundle-aura" aria-hidden="true">✦</div><strong>Pacote dos seis bosses</strong><p>Uma coleção abissal com artefatos vivos e animação exclusiva.</p><ul class="boss-bundle-list">${bundleIds.map(id=>`<li>${ownedSkins.includes(id)?'✓':'✧'} ${bundleNames[id]}${ownedSkins.includes(id)?' · ADQUIRIDA':''}</li>`).join('')}</ul><p class="boss-bundle-count">${remaining} de 6 skins restantes · ${remaining===6?'DESCONTO DO PACOTE COMPLETO':'preço individual das skins restantes'}</p><button ${remaining===0?'disabled':''}>${remaining===0?'CONTEÚDO COMPLETO':remaining<6?(english?'OWNED SKINS HIDDEN FROM PRICE':'SKINS ADQUIRIDAS SEM PREÇO'):`${english?'BUY BUNDLE':'COMPRAR PACOTE'} · ${(shopCurrency==='brl'||Number.isFinite(shopRates[shopCurrency])?new Intl.NumberFormat(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR',{style:'currency',currency:shopCurrency.toUpperCase()}).format(bundleAmount/100):(english?'Rate unavailable':'Cotação indisponível'))}`}</button>`;bundle.querySelector('button').addEventListener('click',()=>{if(remaining)openSkinPurchaseConfirm('boss_bundle','Pacote dos Seis Bosses',`${(shopCurrency==='brl'||Number.isFinite(shopRates[shopCurrency])?new Intl.NumberFormat(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR',{style:'currency',currency:shopCurrency.toUpperCase()}).format(bundleAmount/100):(english?'Rate unavailable':'Cotação indisponível'))}`,true);});grid.appendChild(bundle);
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
  const check1 = $('skinBuyCheck1'), confirmBtn = $('skinPurchaseConfirmBtn');
  if (check1) check1.checked = false;
  if (confirmBtn) confirmBtn.disabled = true;
  modal.hidden = false;
}
function closeSkinPurchaseConfirm() {
  const modal = $('skinPurchaseConfirmModal');
  if (modal) modal.hidden = true;
  pendingStripePurchase = null;
}
function updateSkinPurchaseBtn() {
  const check1 = $('skinBuyCheck1'), confirmBtn = $('skinPurchaseConfirmBtn');
  if (confirmBtn) confirmBtn.disabled = !check1?.checked;
}
$('skinBuyCheck1')?.addEventListener('change', updateSkinPurchaseBtn);
$('skinPurchaseTopCloseBtn')?.addEventListener('click', closeSkinPurchaseConfirm);
$('skinPurchaseCancelBtn')?.addEventListener('click', closeSkinPurchaseConfirm);
$('skinPurchaseConfirmBtn')?.addEventListener('click', () => {
  const check1 = $('skinBuyCheck1');
  if (!check1?.checked) return;
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
  if(result.skinId === 'electriceel'){
    try{
      const codes=JSON.parse(localStorage.getItem('abyssalRedeemedCodes')||'[]');
      if(!codes.includes('vi-o-nascimento-abyssal'))codes.push('vi-o-nascimento-abyssal');
      localStorage.setItem('abyssalRedeemedCodes',JSON.stringify(codes));
    }catch(_){}
  }
  if(result.coinsAwarded){
    coins += Number(result.coinsAwarded);
  }
  saveCosmetics();
  message.textContent=result.message||'CÓDIGO RESGATADO!';
  addNotification(result.message||'Código promocional resgatado na sua conta online!', 'RESGATE CONFIRMADO ⚡', 'promo');
  if(input){input.value='';input.disabled=true;}
  if(redeemCodeBtn)redeemCodeBtn.disabled=true;
  audio(880,.18,'triangle',.035);
  renderShop();
}else{message.textContent=result.message||'Não foi possível resgatar o código.';}});
function redeemAbyssalCode(){
 const input=$('redeemCodeInput'),message=$('redeemCodeMessage'),code=String(input?.value||'').trim();
 if(!message||!input)return;
 if(!code){message.textContent='DIGITE UM CÓDIGO PARA RESGATAR.';input.focus();return;}
 if(!window.AbyssalOnline?.isAuthenticated()){message.textContent='ENTRE NA SUA CONTA PARA RESGATAR CÓDIGOS.';return;}
 window.AbyssalOnline.redeemCode(code);
}
if(redeemCodeBtn)redeemCodeBtn.addEventListener('click',redeemAbyssalCode);
$('redeemCodeInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();redeemAbyssalCode();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('redeemCodeScreen')?.hidden)closeRedeemCodeModal();});

$('skillPulseBtn')?.addEventListener('click',()=>activateAbility('pulse'));$('skillDashBtn')?.addEventListener('click',()=>activateAbility('dash'));
const catalogBtn=$('catalogBtn');if(catalogBtn)catalogBtn.addEventListener('click',renderCatalog);const rankingsBtn=$('rankingsBtn');if(rankingsBtn)rankingsBtn.addEventListener('click',()=>{const el=$('rankingsScreen');if(el)el.hidden=false;if(window.AbyssalOnline?.loadRankings)window.AbyssalOnline.loadRankings()});const catalogClose=$('catalogCloseBtn');if(catalogClose)catalogClose.addEventListener('click',()=>{$('catalogScreen').hidden=true});const rankingsClose=$('rankingsCloseBtn');if(rankingsClose)rankingsClose.addEventListener('click',()=>{$('rankingsScreen').hidden=true});

const resonanceSkillLabels={power:['✦','Pulso Intenso'],rate:['≋','Ressonância Veloz'],speed:['➤','Propulsão Abissal'],range:['◎','Olho Profundo'],magnet:['⌁','Campo Magnético'],regen:['♧','Membrana Viva'],shield:['◉','Escudo Espectral'],burst:['✺','Pulso de Ruptura'],electric:['ϟ','Tempestade Elétrica'],pierce:['➵','Lança do Abismo'],ricochet:['⤴','Ricochete Caótico'],spread:['✣','Rajada Prismática'],photon:['☄','Lança de Fótons'],photonRay:['⌁⃒','Raio de Fótons'],nova:['⊛','Nova Gravitacional'],echoShot:['⋔','Eco de Maré'],shell:['▰','Carapaça Abissal'],ward:['◇','Véu de Maré'],lastStand:['♥','Último Fôlego'],repulse:['◌','Pulso Repulsor'],pressureCocoon:['⬡','Casulo de Pressão'],vitality:['♢','Reserva Vital'],predator:['☠','Instinto Predatório'],closePressure:['⌾','Pressão de Caça']};
const resonanceSkillDescriptions={power:'+50% de dano dos disparos por nível.',rate:'+28% de cadência por nível.',speed:'+18% de velocidade de movimento por nível.',range:'+22% de alcance dos disparos por nível.',magnet:'+45% de alcance de atração de orbes por nível.',regen:'Recupera vida gradualmente durante o mergulho.',shield:'Adiciona uma carga que bloqueia o próximo dano, até 3.',burst:'Explosão periódica de dano ao redor do jogador.',electric:'Corrente elétrica com até 3 saltos de dano reduzido.',pierce:'Arpão pesado que atravessa inimigos alinhados.',ricochet:'Projéteis saltam para outros alvos próximos.',spread:'3, 5 ou 7 fragmentos em leque para cobertura frontal.',photon:'Dardo fotônico extremamente rápido e focado em alvo único.',photonRay:'Feixe automático contínuo no inimigo mais próximo.',nova:'Pulso gravitacional que atinge todos dentro do alcance.',echoShot:'Dois projéteis paralelos de maré com dano dividido e trajetória estreita.',shell:'Reduz o dano recebido em 8% por nível, até 24%.',ward:'Invulnerabilidade automática breve com recarga decrescente.',lastStand:'Abaixo de 30% de vida, reduz o dano recebido em 20%.',repulse:'Onda defensiva periódica que fere inimigos próximos.',pressureCocoon:'Com escudo zerado, recompõe 1 carga após 24, 20 ou 16 segundos.',vitality:'+10% de vida máxima por nível e cura o valor acrescentado.',predator:'+8% de todo dano por nível, até 24%.',closePressure:'+8% de dano por nível contra criaturas muito próximas.'};
function resonanceCategoryOf(id){for(const [category,ids] of Object.entries(RESONANCE_CATEGORIES))if(ids.includes(id))return category;return 'passive';}
function resonanceCounts(ids=resonancePresets[resonanceEditingMode]||[]){return {shots:ids.filter(id=>RESONANCE_CATEGORIES.shots.includes(id)).length,defensive:ids.filter(id=>RESONANCE_CATEGORIES.defensive.includes(id)).length,passive:ids.filter(id=>RESONANCE_CATEGORIES.passive.includes(id)).length,total:ids.length};}
function renderResonanceChoices(){const root=$('resonanceSkillChoices');if(!root)return;root.replaceChildren();for(const [category,heading] of [['shots','DISPAROS · ESCOLHA EXATAMENTE 1'],['defensive','DEFENSIVAS'],['passive','PASSIVAS']]){const section=document.createElement('section');section.className='resonance-category';const title=document.createElement('h3');title.className='resonance-category-title';title.textContent=heading;section.append(title);const list=document.createElement('div');list.className='resonance-category-list';for(const id of RESONANCE_CATEGORIES[category]){const [icon,label]=resonanceSkillLabels[id],row=document.createElement('label');row.className='resonance-skill-option resonance-'+category;row.dataset.skill=id;row.title=resonanceSkillDescriptions[id]||'';const input=document.createElement('input');input.type='checkbox';input.value=id;input.checked=resonancePresets[resonanceEditingMode].includes(id);input.setAttribute('aria-label',label);input.addEventListener('change',()=>{const current=resonancePresets[resonanceEditingMode];if(category==='shots'&&!input.checked&&current.includes(id)){input.checked=true;$('resonanceMessage').textContent='Você precisa manter exatamente 1 disparo selecionado.';return;}let next=current.filter(value=>value!==id);if(input.checked){if(category==='shots')next=next.filter(value=>!RESONANCE_CATEGORIES.shots.includes(value));if(next.length>=7){input.checked=false;$('resonanceMessage').textContent='O limite total é de 7 habilidades.';return;}next.push(id);}resonancePresets[resonanceEditingMode]=normalizeResonancePresets({...resonancePresets,[resonanceEditingMode]:next})[resonanceEditingMode];$('resonanceMessage').textContent='';if(category==='shots')renderResonanceChoices();else updateResonanceCount();});const badge=document.createElement('span');badge.className='resonance-skill-icon';badge.textContent=icon;badge.setAttribute('aria-hidden','true');const copy=document.createElement('span');copy.className='resonance-skill-copy';const name=document.createElement('strong');name.textContent=label;const description=document.createElement('small');description.textContent=resonanceSkillDescriptions[id]||'Habilidade de combate abissal.';copy.append(name,description);row.append(input,badge,copy);list.append(row);}section.append(list);root.append(section);}const modal=document.querySelector('#resonanceScreen .resonance-modal');if(modal)modal.classList.toggle('resonance-pvp-theme',resonanceEditingMode==='pvp');updateResonanceCount();document.querySelectorAll('[data-resonance-mode]').forEach(b=>b.classList.toggle('active',b.dataset.resonanceMode===resonanceEditingMode));}
function updateResonanceCount(){const counts=resonanceCounts();const el=$('resonanceSelectionCount');if(el)el.textContent=counts.shots+' Disparos · '+counts.defensive+' Defensivas · '+counts.passive+' Passivas · '+counts.total+'/7';}
$('resonanceBtn')?.addEventListener('click',()=>{resonanceEditingMode='pve';$('resonanceMessage').textContent='';renderResonanceChoices();$('resonanceScreen').hidden=false;});
document.querySelectorAll('[data-resonance-mode]').forEach(b=>b.addEventListener('click',()=>{resonanceEditingMode=b.dataset.resonanceMode;renderResonanceChoices();$('resonanceMessage').textContent='';}));
$('saveResonanceBtn')?.addEventListener('click',()=>{const counts=resonanceCounts();if(counts.shots!==1){$('resonanceMessage').textContent='Selecione exatamente 1 disparo.';renderResonanceChoices();return;}if(!resonancePresets[resonanceEditingMode].length){$('resonanceMessage').textContent='Selecione pelo menos uma habilidade.';return;}saveResonancePresets();$('resonanceMessage').textContent='Combinação '+resonanceEditingMode.toUpperCase()+' salva!';updateResonanceCount();});
document.querySelectorAll('[data-close-screen="resonanceScreen"]').forEach(b=>b.addEventListener('click',()=>$('resonanceScreen').hidden=true));renderResonanceChoices();

function renderCatalog(){
 const el=$('catalogScreen'),grid=$('catalogGrid');if(!el||!grid)return;el.hidden=false;
 const codex=getAbyssalCodex();
 const monsterData={
  drifter:{name:'Errante Luminescente',color:'#ff769d',hp:22,speed:51,damage:8,ability:'Emissão Bio-Ondulatória: grupos sincronizados que avançam em ondas luminescentes.',desc:'Ctenóforo translúcido que avança em cardumes rítmicos pelas fossas externas.'},
  stinger:{name:'Ferrão de Fenda',color:'#ffbc78',hp:13,speed:125,damage:7,ability:'Arremetida Hipodérmica: velocidade extrema em linha reta com ferrão penetrante.',desc:'Peixe-ferrão veloz de corpo esguio e dentes agulhados que caça em bando.'},
  brute:{name:'Bruto de Placas',color:'#bd88ff',hp:65,speed:30,damage:15,ability:'Blindagem Bêntica: carapaça espessa que absorve projéteis e isola passagens.',desc:'Isópode titânico com placas sobrepostas impenetráveis e patas blindadas.'},
  lurker:{name:'Predador Sombrio',color:'#6e8dff',hp:100,speed:43,damage:18,ability:'Faringe Expansiva: mandíbula que dilata e perseguição incansável nas trevas.',desc:'Enguia gulper predatória que persegue sua presa sem recuar.'},
  whiteShark:{name:'Tubarão-branco',color:'#91c4ce',hp:300,speed:300,damage:28,ability:'Investida Imparável: move-se SOMENTE por arrancadas em linha reta que só param ao atingir a parede, então vira na direção do jogador e investe novamente.',desc:'O ápice dos caçadores pelágicos. Não para, não recua. Cada investida é calculada e letal.'},
  boss:{name:'Aberração Abissal',color:'#ff315f',hp:5640,speed:52,damage:25,ability:'Ganchos Cefalópodes: tentáculos curvados e máscara óssea que repelem mergulhadores.',desc:'Entidade coroada por placas calcificadas e braços farpados que esmagam quem se aproxima.'},
  angler:{name:'Lanterna Mortal',color:'#ffb45e',hp:6520,speed:66,damage:28,ability:'Isca Bioluminescente: atrai com brilho hipnótico antes de fechar mandíbulas de agulha.',desc:'Predador arcaico com lanterna incandescente e dentes voltados para dentro.'},
  maw:{name:'A Boca do Abismo',color:'#c16cff',hp:7500,speed:58,damage:31,ability:'Fome Circular: anel contínuo de dentes radiais que devora correntes inteiras.',desc:'Criatura anelar voraz cujo corpo inteiro é uma garganta predatória viva.'},
  leviathan:{name:'Leviatã das Fossas',color:'#4ce0d1',hp:9400,speed:44,damage:34,ability:'Domínio de Trincheira: espinhas dorsais monumentais que bloqueiam rotas de fuga.',desc:'Serpente colóssal com costelas externas que atravessa as fendas mais profundas.'},
  whiteSharkBoss:{name:'Tubarão-branco Colossal',color:'#68a8b8',hp:12000,speed:350,damage:45,ability:'Frenesi Colossal Imparável: investidas em linha reta à velocidade de 350 · só para ao colidir com a parede · vira e investe novamente sem parar.',desc:'A lenda das trincheiras abissais. Mais rápido que qualquer outra criatura. Cada investida abala o oceano.'},
  kraken:{name:'Kraken do Abismo',color:'#8b5cf6',hp:18400,speed:20,damage:38,ability:'Varredura Tentacular Óctupla: oito tentáculos afiados que cortam em espiral.',desc:'Senhor primordial das fossas oceânicas cujos tentáculos envolvem a escuridão.'},
  devourer:{name:'Devorador do Vazio',color:'#39d8c4',hp:30000,speed:14,damage:42,ability:'Vórtice de Sucção Residual: suga tudo ao redor em um raio colossal a cada 20 segundos.',desc:'Entidade que distorce as correntes abissais engolindo cardumes e mergulhadores inteiros.'}
 };
 for(const [kind,entry] of Object.entries(monsterData)){const live=window.AbyssalEnemyAI?.ENEMY_STATS?.[kind];if(!live)continue;entry.hp=Number(live.hp)||entry.hp;entry.damage=Number(live.damage)||entry.damage;entry.speed=Number(live.dashSpeed ?? live.speed ?? entry.speed);}
 const skillCopy={power:'Aumenta o dano de cada projétil.',rate:'Reduz o intervalo entre disparos automáticos.',speed:'Aumenta a velocidade de movimento.',range:'Amplia o alcance dos tiros e das ondas.',abyssEye:'Olho do Abismo: alcance de disparo pelo mapa inteiro; o projétil para ao colidir.',vitalDrain:'Dreno Vital: recupera 2% do dano causado como vida.',magnet:'Atrai fragmentos de experiência de mais longe no modo solo.',regen:'Recupera vitalidade gradualmente.',shield:'Adiciona cargas que absorvem impactos.',burst:'Libera periodicamente uma onda de energia ao redor do jogador.',electric:'Faz os tiros encadearem arcos elétricos em inimigos próximos.',pierce:'Permite atravessar uma criatura adicional por nível, sem multiplicar o dano.',ricochet:'Faz arcos de energia saltarem para alvos próximos.',nova:'Libera periodicamente uma explosão circular de grande alcance.'};
 
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

 const comboHtml=Object.values(COMBO_SKILLS).map(combo=>{const recipe=combo.id==='gravitationalRupture'?'Nova gravitacional Nv. 3 + Pulso de Ruptura Nv. 3':combo.id==='arcChain'?'Tempestade Elétrica Nv. 3 + Pulso Intenso Nv. 3':combo.id==='abyssEye'?'Lança do Abismo Nv. 3 + Olho Profundo Nv. 3':'Membrana Viva Nv. 3 + Pulso Intenso Nv. 3';return `<article class="codex-card combo-codex-card special unlocked"><div class="combo-rarity">✦ FUSÃO ESPECIAL</div><div class="codex-preview skill-preview combo-preview" style="--preview:${combo.id==='arcChain'?'#75f3ff':'#c5a0ff'}">${combo.icon}</div><b>${combo.name}</b><p>${combo.desc}</p><small class="combo-recipe">COMBINAÇÃO · ${recipe}</small></article>`}).join('');
 const skillsHtml=upgradeList.map(u=>{const known=codex.skills.includes(u.id);return `<article class="codex-card ${known?'unlocked':'locked'}"><div class="codex-preview skill-preview" style="--preview:${known?'#9cecff':'#263747'}">${known?u.icon:'?'}</div><b>${known?u.name:'Ressonância desconhecida'}</b><p>${known?(skillCopy[u.id]||u.desc):'Descubra esta habilidade durante um mergulho para revelar seus efeitos.'}</p></article>`}).join('');
 const entries=Object.entries(monsterData),common=entries.filter(([k])=>!BOSS_KINDS.includes(k)),bosses=entries.filter(([k])=>BOSS_KINDS.includes(k));
 grid.innerHTML='<h3 class="codex-heading">◈ FAUNA DAS CAMADAS EXTERNAS</h3><div class="codex-grid">'+common.map(renderMonster).join('')+'</div><h3 class="codex-heading">☠ ENTIDADES COLOSSAIS · FOSSAS ABISSAIS</h3><div class="codex-grid">'+bosses.map(renderMonster).join('')+'</div>';
 grid.querySelectorAll('canvas[data-monster-preview]').forEach(canvas=>{const kind=canvas.dataset.monsterPreview,m=monsterData[kind];renderCreaturePreview(canvas,kind,m.color,null);});
}

$('shopCloseBtn').addEventListener('click',()=>{$('shopScreen').hidden=true});
$('shopTopCloseBtn')?.addEventListener('click',()=>{$('shopScreen').hidden=true});

window.addEventListener('abyssal-authenticated',()=>{if(window.AbyssalOnlinePendingStart){window.AbyssalOnlinePendingStart=false;$('loginScreen').hidden=true;onlineMode=true;window.AbyssalOnline?.showRooms()}});
window.addEventListener('abyssal-gameplay-notice',ev=>{const d=ev.detail||{};if(d.kind==='death'&&Number.isFinite(Number(d.x))&&Number.isFinite(Number(d.y)))spawnBloodPool(Number(d.x)*W,Number(d.y)*H,28/GAME_WORLD_ZOOM,Number(d.angle)||Math.random()*Math.PI*2);if(['fusion','join','death'].includes(d.kind))enqueueGameplayNotice(d.kind,d.title||'ECO ABISSAL',d.text||'',d.kind==='fusion'?60:30);});
window.addEventListener('abyssal-peer-skin-ability',ev=>{
  const d=ev.detail||{};
  // O rastro de bolhas precisa ser replicado como amostras curtas de posição:
  // ele não é uma habilidade de recarga e não pode depender do evento de ataque.
  if(d.type==='bubble-trail' && (d.skin==='reefshark'||d.skin==='whiteShark')){
    const bx=clamp(Number(d.x)*W,0,W),by=clamp(Number(d.y)*H,0,H);
    sharkWakeTrails.push({x:bx,y:by,r:rand(14,22),life:5,maxLife:5,color:'#7bf5ff',remote:true});
    if(sharkWakeTrails.length>250)sharkWakeTrails.splice(0,sharkWakeTrails.length-250);
    return;
  }
  // Use as coordenadas normalizadas do instante da habilidade. O snapshot do outro jogador
  // pode estar atrasado ou representar outra escala de coordenadas.
  const px=clamp(Number(d.x)*W,0,W),py=clamp(Number(d.y)*H,0,H);
  const angle=Number.isFinite(Number(d.angle))?Number(d.angle):0;
  const skin=String(d.skin||'');
  const skinColor=(skinData.find(item=>item.id===skin)||{}).color||'#79f3f0';
  if(skin==='reefshark'||skin==='whiteShark'){
    const reach=260/GAME_WORLD_ZOOM;
    effects.push({type:'beam',x1:px,y1:py,x2:px+Math.cos(angle)*reach,y2:py+Math.sin(angle)*reach,life:.32,maxLife:.32,color:'#8bd8ec'});
    effects.push({type:'ring',x:px,y:py,r:0,max:72/GAME_WORLD_ZOOM,life:.32,maxLife:.32,color:'#8bd8ec'});
    burst(px+Math.cos(angle)*reach*.65,py+Math.sin(angle)*reach*.65,'#8bd8ec',14,120);
  } else if(skin==='violet'){
    effects.push({type:'ring',x:px,y:py,r:0,max:230/GAME_WORLD_ZOOM,life:.5,maxLife:.5,color:'#bd91ff'});
    effects.push({type:'beam',x1:px-34/GAME_WORLD_ZOOM,y1:py,x2:px+34/GAME_WORLD_ZOOM,y2:py,life:.24,maxLife:.24,color:'#d9b7ff'});
    burst(px,py,'#bd91ff',24,145);
  } else if(skin==='toxic'){
    effects.push({type:'ring',x:px,y:py,r:0,max:190/GAME_WORLD_ZOOM,life:1.4,maxLife:1.4,color:'#75ff68'});burst(px,py,'#75ff68',26,90);
  } else if(skin==='kraken'){
    effects.push({type:'ring',x:px,y:py,r:0,max:280/GAME_WORLD_ZOOM,life:.45,maxLife:.45,color:'#8b5cf6'});
    for(let i=0;i<8;i++){const a=i*Math.PI/4+angle;effects.push({type:'beam',x1:px,y1:py,x2:px+Math.cos(a)*280/GAME_WORLD_ZOOM,y2:py+Math.sin(a)*280/GAME_WORLD_ZOOM,life:.28,maxLife:.28,color:'#8b5cf6'});}
    burst(px,py,'#8b5cf6',20,150);
  } else if(skin==='armoredgator'){
    effects.push({type:'ring',x:px,y:py,r:0,max:190/GAME_WORLD_ZOOM,life:.42,maxLife:.42,color:'#c5a66e'});
    burst(px,py,'#c5a66e',28,175);
  } else if(skin==='abysscroc'){
    effects.push({type:'ring',x:px,y:py,r:0,max:210/GAME_WORLD_ZOOM,life:.42,maxLife:.42,color:'#79bd83'});
    burst(px,py,'#79bd83',28,175);
  } else {
    // Fallback visual para outros IDs de skin quando o evento de habilidade for enviado.
    const reach=(skin==='devourer'?320:skin==='greensnake'?210:skin==='electriceel'?165:125)/GAME_WORLD_ZOOM;
    effects.push({type:'ring',x:px,y:py,r:0,max:reach,life:.4,maxLife:.4,color:skinColor});
    for(let i=0;i<4;i++){const a=angle+i*Math.PI/2;effects.push({type:'beam',x1:px,y1:py,x2:px+Math.cos(a)*reach*.72,y2:py+Math.sin(a)*reach*.72,life:.22,maxLife:.22,color:skinColor});}
    burst(px,py,skinColor,16,120);
  }
});
window.addEventListener('abyssal-room-joined',ev=>{const d=ev.detail||{};const canResume=Boolean(d.reconnected&&d.resumedRun&&onlineMode&&player&&gameState!=='menu'&&gameState!=='over');onlineRoomMode=d.room?.mode==='pvp'?'pvp':'coop';createArenaRocks();onlineMode=true;$('roomsScreen').hidden=true;$('menuScreen').hidden=true;if(!canResume)startGame();else{gameState='playing';last=performance.now();onlineDamageQueue.length=0;$('hud').hidden=false;$('pauseBtn').hidden=false;setMobileGameActive(true);window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet,rangeStrength:upgrades.range,arcChainActive:Boolean(upgrades.arcChain),ricochetLevel:upgrades.ricochet,electricLevel:upgrades.electric,shellLevel:upgrades.shell,lastStandLevel:upgrades.lastStand});}if(onlineRoomMode==='pvp'){enemies.length=0;orbs.length=0;projectiles.length=0;}if(player)player.invuln=Math.max(player.invuln,5);window.AbyssalOnline?.sendProtection?.(5,d.reconnected?'deploy-reconnect':'room-join');if(d.spawn)window.AbyssalGameHooks?.setPlayerPosition?.(d.spawn.x,d.spawn.y);if(d.snapshot)window.AbyssalGameHooks?.applySnapshot(d.snapshot);const badge=$('roomBadge');if(badge){badge.textContent=`${onlineRoomMode==='pvp'?'⚠ ARENA PvP':'⌁'} ${d.room?.id||''}`;badge.dataset.roomCode=d.room?.id||'';badge.dataset.mode=onlineRoomMode;badge.classList.toggle('pvp-room-badge',onlineRoomMode==='pvp');badge.hidden=false;}showToast(d.reconnected&&d.resumedRun?'CONEXÃO RESTAURADA · EXPEDIÇÃO RETOMADA':onlineRoomMode==='pvp'?'⚠ ARENA PvP · PERIGO':'MERGULHAR ONLINE · '+(d.room?.name||'SALA ABISSAL'))});
window.addEventListener('abyssal-room-created',ev=>{const d=ev.detail||{};const m=$('roomsMessage');if(m)m.textContent=d.ok?`Sala criada! Código para convidar amigos: ${d.room?.id||''}. Você será conectado agora.`:(d.message||'Não foi possível criar a sala.');});
window.addEventListener('abyssal-online-disconnected',()=>{onlineDamageQueue.length=0;});
window.addEventListener('abyssal-reconnect-failed',ev=>{onlineDamageQueue.length=0;onlineMode=false;setMobileGameActive(false);document.body.classList.remove('game-active');gameState='menu';$('hud').hidden=true;$('pauseBtn').hidden=true;$('menuScreen').hidden=false;const m=$('roomsMessage');if(m)m.textContent=ev.detail?.message||'A expedição não pôde ser retomada automaticamente. Entre novamente quando o servidor estabilizar.';showToast('CONEXÃO RESTAURADA · REENTRE NA EXPEDIÇÃO');});
window.addEventListener('abyssal-room-left',()=>{onlineDamageQueue.length=0;onlineRoomMode='coop';createArenaRocks();const badge=$('roomBadge');if(badge){badge.hidden=true;badge.classList.remove('pvp-room-badge');}setMobileGameActive(false)});
const roomBadge=$('roomBadge');if(roomBadge)roomBadge.addEventListener('click',async()=>{const code=roomBadge.dataset.roomCode||'';try{await navigator.clipboard.writeText(code);showToast(`CÓDIGO ${code} COPIADO`)}catch{showToast(`CÓDIGO DA SALA: ${code}`)}});
$('roomsCloseBtn')?.addEventListener('click',()=>{$('roomsScreen').hidden=true;onlineMode=false});
window.addEventListener('abyssal-modal-closed',ev=>{if(ev.detail?.screenId==='roomsScreen')onlineMode=false;});
$('refreshRoomsBtn')?.addEventListener('click',()=>window.AbyssalOnline?.requestRooms());
$('roomPrivateCheck')?.addEventListener('change',e=>{$('roomPasswordField').hidden=!e.target.checked});
$('createRoomBtn')?.addEventListener('click',()=>window.AbyssalOnline?.createRoom({name:$('roomNameInput').value,capacity:Number($('roomCapacityInput').value),isPrivate:$('roomPrivateCheck').checked,password:$('roomPasswordInput').value,mode:$('roomModeInput')?.value==='pvp'?'pvp':'coop'}));
$('joinRoomCodeBtn')?.addEventListener('click',()=>window.AbyssalOnline?.joinRoom($('roomCodeInput').value,$('roomJoinPasswordInput').value));
window.addEventListener('abyssal-rooms-list',ev=>renderRoomList(ev.detail||[]));
window.addEventListener('abyssal-room-action-error',ev=>{const m=$('roomsMessage');if(m)m.textContent=ev.detail?.message||'Não foi possível realizar essa ação.';});
function renderRoomList(rooms){const root=$('roomsList');if(!root)return;let list=Array.isArray(rooms)?rooms:[];if(!list.length)list=[{id:'MAR-ABERTO',name:'Mar Aberto',playerCount:0,capacity:6,isPrivate:false,fallback:true,joinable:true}];root.innerHTML=list.map(r=>{const full=(Number(r.playerCount)||0)>=(Number(r.capacity)||6),privateRoom=Boolean(r.isPrivate),pvp=r.mode==='pvp',remote=r.joinable===false,label=pvp?'⚠ ARENA PvP · PERIGO':privateRoom?'PRIVADA · SENHA':(r.id==='MAR-ABERTO'?'SALA PÚBLICA PADRÃO':'PÚBLICA'),buttonDisabled=full||remote,buttonText=full?'LOTADA':remote?'OUTRA INSTÂNCIA':privateRoom?'SENHA':'ENTRAR';return `<article class="room-row${privateRoom?' room-row-private':''}${pvp?' pvp-room':''}"><div><b>${pvp?'⚠ ':privateRoom?'🔒 ':''}${escapeHtml(r.name||'Sala Abissal')}</b><small>${Number(r.playerCount)||0}/${Number(r.capacity)||6} mergulhadores · ${label}${Number.isFinite(Number(r.elapsed))&&Number(r.elapsed)>0?' · '+fmtTime(Number(r.elapsed)):''}</small></div><button type="button" class="room-join-btn" data-room-id="${escapeHtml(r.id)}" data-private="${privateRoom?'1':'0'}" data-joinable="${remote?'0':'1'}" ${buttonDisabled?'disabled':''}>${buttonText}</button></article>`}).join('');root.querySelectorAll('[data-room-id]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.roomId;const code=$('roomCodeInput'),password=$('roomJoinPasswordInput'),section=root.closest('.room-modal')?.querySelector('.room-join-code'),msg=$('roomsMessage');if(code)code.value=id;if(btn.dataset.joinable==='0'){if(msg)msg.textContent='Esta expedição está registrada, mas pertence a outro processo do servidor e não pode ser conectada por esta instância.';return;}if(btn.dataset.private==='1'){if(msg)msg.textContent='EXPEDIÇÃO SELADA. Informe a senha para romper o lacre e entrar.';section?.scrollIntoView({behavior:'smooth',block:'nearest'});password?.focus();return;}window.AbyssalOnline?.joinRoom(id,'');}));}

$('loginCancelBtn').addEventListener('click',()=>{$('loginScreen').hidden=true});
window.addEventListener('abyssal-run-saved',ev=>{const r=ev.detail||{};if(!r.ok)return;const status=$('saveStatus');if(status)status.textContent=`MERGULHO REGISTRADO · ${Number(r.bossesKilled)||0} BOSSES · +${Number(r.totalRunCoins??((Number(r.earned)||0)+(Number(r.bossCoins)||0)))||0} MOEDAS NA EXPEDIÇÃO`;if(r.rankings)window.dispatchEvent(new CustomEvent('abyssal-rankings-refreshed',{detail:r.rankings}));});
window.addEventListener('abyssal-account-data',e=>{
  const a=e.detail;if(!a)return;
  coins=Number(a.coins)||0;
  const serverSkins=Array.isArray(a.ownedSkins)?a.ownedSkins:['default'];
  ownedSkins=[...new Set(serverSkins)];
  equippedSkin=a.equippedSkin||localStorage.getItem('abyssalSkin')||'default';
  if(!ownedSkins.includes(equippedSkin))equippedSkin='default';
  metaUpgrades=typeof a.metaUpgrades==='object'&&a.metaUpgrades?a.metaUpgrades:metaUpgrades;
  saveCosmeticsLocalOnly();
  renderShop();
  updateAbilityButtons();
});
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
 const returnToMenu=(result)=>{onlineMode=false;setMobileGameActive(false);document.body.classList.remove('game-active');setHudCollapsed(false);$('toggleHudBtn').hidden=true;gameState='menu';$('hud').hidden=true;$('pauseBtn').hidden=true;$('upgradeScreen').hidden=true;$('pauseScreen').hidden=true;$('gameOverScreen').hidden=true;$('menuScreen').hidden=false;endDiveButton.style.display='none';const earned=Number(result?.earned)||0;const kills=Number(result?.bossesKilled??bossKillsThisRun)||0;const total=Number(result?.totalRunCoins??(earned+(Number(result?.bossCoins)||0)))||0;showToast(`MERGULHO ENCERRADO · ${kills} BOSS(ES) · +${total} MOEDAS NA EXPEDIÇÃO`);};
 if(authenticated&&window.AbyssalOnline?.finishRun){const sent=window.AbyssalOnline.finishRun({survival:elapsed,score,level,bossesKilled:bossKillsThisRun},{leaveAfter:wasOnline,onComplete:result=>returnToMenu(result)});if(sent){endDiveButton.disabled=true;endDiveButton.textContent='REGISTRANDO…';setTimeout(()=>{endDiveButton.disabled=false;endDiveButton.textContent='ENCERRAR MERGULHO'},12000);return;}}
 if(!authenticated){coins+=Math.max(5,Math.floor(score/35)+level*2);saveCosmetics();renderShop();if(wasOnline)window.AbyssalOnline?.leaveWorld();returnToMenu({earned:Math.max(5,Math.floor(score/35)+level*2),bossesKilled:bossKillsThisRun});}else returnToMenu({earned:0,bossesKilled:bossKillsThisRun});
});

})();
