(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let mobileViewport=window.matchMedia('(pointer: coarse)').matches||window.innerWidth<=700;
const cores=navigator.hardwareConcurrency||8;let lowPowerRendering=false,backgroundGradientCache=null,backgroundBloomCache=null,lastPaintAt=0;
let hostileSpritePaintFrame=-1,hostileSpritePaintsThisFrame=0;
const ADAPTIVE_QUALITY=[{name:'LEVE',dpr:.75},{name:'MÉDIO',dpr:1},{name:'ULTRA',dpr:Infinity}];
function savedGraphicsLevel(){try{const v=localStorage.getItem('abyssalGraphicsQuality');return v==='0'?0:v==='1'?1:2;}catch(_){return 2;}}
let adaptiveQualityLevel=savedGraphicsLevel(),adaptiveQualityLastCheck=0,adaptiveQualityBadWindows=0,adaptiveQualityGoodWindows=0,adaptiveDprScale=ADAPTIVE_QUALITY[adaptiveQualityLevel].dpr;
lowPowerRendering=adaptiveQualityLevel===0;
function graphicsDpr(){return Math.max(.5,Math.min(Math.max(1,window.devicePixelRatio||1),ADAPTIVE_QUALITY[adaptiveQualityLevel].dpr,4096/viewW,4096/viewH,Math.sqrt(16777216/(viewW*viewH))));}
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
const CREATURE_SCALE=window.AbyssalCreatureScale;
const RIFT_WILDLIFE=window.AbyssalRiftWildlife;
const OPEN_SEA_ECOLOGY=window.AbyssalOpenSeaEcology;
const OCEAN_STREAM=window.AbyssalOceanStream;
const soloOceanRespawn=window.AbyssalOceanRespawn?.createTracker?.();
let soloOceanRespawnCleanupAt=0;
const OCEAN_GEOGRAPHY=window.AbyssalOceanGeography;
const oceanWidth=()=>OCEAN_STREAM?.WIDTH||24000,oceanHeight=()=>OCEAN_STREAM?.HEIGHT||21000;
const defaultWidth=()=>isOpenSeaRun()?oceanWidth():4800,defaultHeight=()=>isOpenSeaRun()?oceanHeight():3000;
const PHOTON_RAY_VISUAL=window.AbyssalPhotonRay;
const EXPEDITION_RULES=window.AbyssalExpeditionRules;
const ABYSSAL_MAP=window.AbyssalMap;
const RIFT_HARDCORE=window.AbyssalRiftHardcore;
let activeRiftHazards=[],riftBossMarks=[],riftSoloHazardCooldowns=new Map(),soloRiftCheckpointRoomId='start';
let W=4800,H=3000,viewW=800,viewH=500,worldZoom=.78,mapFactor=1.7,cameraX=0,cameraY=0,dpr=1,last=0,elapsed=0,score=0,level=1,xp=0,xpNeed=10,hp=100,maxHp=100,gameState='menu',nextBossAt=60,lastBossMaxHp=0,lastBossDamage=0,lastBossSpeed=0,bossKillsThisRun=0,runProgressTimer=0;
let player=null,botBuddy=null,enemies=[],orbs=[],particles=[],projectiles=[],effects=[],damageNumbers=[],bloodPools=[],decor=[],arenaRocks=[],upgrades={},upgradeLevels={},chosen=[],spawnTimer=0,enemyId=0,shake=0,damageFlash=0,runSeed=0,bossIndex=0;
let onlineRoomMode='coop';
let requestedRunMode='classic';
let abyssalTutorialActive=false,explorationHeldItem='abyssWeapon';
window.addEventListener('abyssal-held-item-change',event=>{explorationHeldItem=String(event.detail?.itemId||'abyssWeapon');});
const isRiftRun=()=>onlineMode?onlineRoomMode==='rift':requestedRunMode==='rift';
const isOpenSeaRun=()=>onlineMode?onlineRoomMode==='open-sea':requestedRunMode==='open-sea';
const isClassicShooterRun=()=>onlineMode?['coop','pvp'].includes(onlineRoomMode):requestedRunMode==='classic';
const isClassicCavernRun=()=>isClassicShooterRun()&&(!onlineMode||onlineRoomMode==='coop');
const usesNaturalOceanTerrain=()=>isOpenSeaRun()||(onlineMode&&onlineRoomMode==='open-sea');
let runShotId='electric';
let runResonanceIds=[];
const RESONANCE_STORAGE_KEY='abyssalResonancePresets';
const RESONANCE_CATEGORIES={
 shots:['electric','pierce','photon','photonRay','nova','echoShot'],
 passive:['burst','ricochet','spread'],
 buffs:['power','rate','speed','range','magnet','regen','shield','shell','ward','lastStand','pressureCocoon','vitality','predator','closePressure']
};
const BASIC_SKILL_IDS=[...RESONANCE_CATEGORIES.shots,...RESONANCE_CATEGORIES.passive,...RESONANCE_CATEGORIES.buffs];
const RESONANCE_DEFAULTS={pve:['photon','range','regen'],pvp:['electric','shield','regen','shell','power','speed','magnet']};
// Exploration studies gate PvE resonance equipment. PvP retains an unrestricted
// legacy loadout and never requires oxygen/resources/research progression.
let explorationResearchLevels={};
let explorationLegacyMeta={};
try{explorationResearchLevels=JSON.parse(localStorage.getItem('abyssalSoloResearch')||'{}')||{};explorationLegacyMeta=JSON.parse(localStorage.getItem('abyssalMetaUpgrades')||'{}')||{};}catch(_){}
function resonanceAvailable(id,mode='pve'){
 if(mode==='pvp')return true;
 if(window.AbyssalSoloBase?.unlocked)return window.AbyssalSoloBase.unlocked(id);
 return ['photon','range','regen'].includes(id);
}
window.addEventListener('abyssal-solo-research-change',()=>{if(document.getElementById('resonanceScreen')&&!document.getElementById('resonanceScreen').hidden)renderResonanceChoices();});
window.addEventListener('abyssal-account-data',event=>{
 const data=event.detail||{};
 if(data.researchLevels&&typeof data.researchLevels==='object')explorationResearchLevels=data.researchLevels;
 if(data.metaUpgrades&&typeof data.metaUpgrades==='object')explorationLegacyMeta=data.metaUpgrades;
 if(document.getElementById('resonanceScreen')&&!document.getElementById('resonanceScreen').hidden)renderResonanceChoices();
});
window.addEventListener('storage',event=>{
 if(event.key==='abyssalSoloResearch')try{explorationResearchLevels=JSON.parse(event.newValue||'{}');}catch(_){}
});

let resonancePresets=(()=>{try{return JSON.parse(localStorage.getItem(RESONANCE_STORAGE_KEY)||JSON.stringify(RESONANCE_DEFAULTS))}catch{return JSON.parse(JSON.stringify(RESONANCE_DEFAULTS))}})();let resonanceEditingMode='pve',resonanceEditedInSession=false,resonanceSyncedAfterLogin=false;
function normalizeResonancePresets(value){const clean={pve:[],pvp:[]};for(const mode of ['pve','pvp']){const source=Array.isArray(value?.[mode])?value[mode]:RESONANCE_DEFAULTS[mode];const unique=[...new Set(source.map(String).filter(id=>BASIC_SKILL_IDS.includes(id)))].slice(0,7);let foundShot=false;clean[mode]=unique.filter(id=>{if(!RESONANCE_CATEGORIES.shots.includes(id))return true;if(foundShot)return false;foundShot=true;return true;});if(!clean[mode].some(id=>RESONANCE_CATEGORIES.shots.includes(id))){if(clean[mode].length>=7)clean[mode].pop();clean[mode].unshift(mode==='pvp'?'electric':'photon');}if(mode==='pve'){for(const starter of ['range','regen'])if(!clean.pve.includes(starter)){if(clean.pve.length>=7){let removable=-1;for(let ri=clean.pve.length-1;ri>=0;ri--){const candidate=clean.pve[ri];if(!RESONANCE_CATEGORIES.shots.includes(candidate)&&!['range','regen'].includes(candidate)){removable=ri;break;}}if(removable>=0)clean.pve.splice(removable,1);else clean.pve.pop();}clean.pve.push(starter);}}}return clean;}
resonancePresets=normalizeResonancePresets(resonancePresets);
function saveResonancePresets(){resonancePresets=normalizeResonancePresets(resonancePresets);try{localStorage.setItem(RESONANCE_STORAGE_KEY,JSON.stringify(resonancePresets));}catch(_){}if(window.AbyssalOnline?.isAuthenticated?.())window.AbyssalOnline?.saveCosmetics?.({resonancePresets});}
window.addEventListener('abyssal-account-data',event=>{const saved=event.detail?.resonancePresets;if(!saved)return;
 if(resonanceEditedInSession){if(!resonanceSyncedAfterLogin&&window.AbyssalOnline?.isAuthenticated?.()){resonanceSyncedAfterLogin=true;saveResonancePresets();}return;}
 resonancePresets=normalizeResonancePresets(saved);try{localStorage.setItem(RESONANCE_STORAGE_KEY,JSON.stringify(resonancePresets));}catch(_){}});
let onlineEnemyById=new Map(),onlineOrbById=new Map(),onlineDamageQueue=[],onlineSubmarineControllerId=null,onlineSubmarineWeapons=['photon'];
const predictedCombatHits=new Map();let predictedCombatSequence=0;
function nextCombatActionId(skillId='hit'){predictedCombatSequence=(predictedCombatSequence+1)>>>0;return `${String(skillId||'hit').slice(0,18)}:${Date.now().toString(36)}:${predictedCombatSequence.toString(36)}`;}
function predictCombatImpact(enemy,damage,skillId,actionId){if(!enemy||!actionId)return;const key=`${actionId}:${enemy.id}`;predictedCombatHits.set(key,{at:performance.now(),enemyId:String(enemy.id),skillId:String(skillId||''),damage:Number(damage)||0});enemy.hit=Math.max(Number(enemy.hit)||0,.16);burst(enemy.x,enemy.y,'#c4b4ff',3,50);spawnDamageNumber(enemy.x,enemy.y,damage,damageTone(skillId));if(predictedCombatHits.size>256){const cutoff=performance.now()-2500;for(const [id,row] of predictedCombatHits)if(row.at<cutoff)predictedCombatHits.delete(id);}}
function consumePredictedCombatImpact(data){const actionId=String(data?.actionId||'');if(!actionId||data?.id==null)return false;const key=`${actionId}:${data.id}`;const existed=predictedCombatHits.delete(key);return existed;}
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
const energyWallet=window.AbyssalSoloProgress;
let equippedSkin=localStorage.getItem('abyssalSkin')||'default',onlineMode=false,wasOnlineModeOnDeath=false,botBuddyTimer=0;
const SPECIMEN_SYSTEM=window.AbyssalSpecimenSystem;
const DIVER_ART=window.AbyssalDiverArt;
const DIVER_HITBOX=window.AbyssalDiverHitbox;
let diverGender=DIVER_ART?.genderOf?.(localStorage.getItem('abyssalDiverGender'))||'male';
window.AbyssalDiverGender=diverGender;
function setDiverGender(value,saveRemote=true){
 diverGender=DIVER_ART?.genderOf?.(value)||'male';
 window.AbyssalDiverGender=diverGender;
 try{localStorage.setItem('abyssalDiverGender',diverGender);}catch(_){}
 if(player)player.diverGender=diverGender;
 document.querySelectorAll('[data-diver-gender]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.diverGender===diverGender)));
 if(saveRemote)window.AbyssalOnline?.saveCosmetics?.({diverGender});
}
document.addEventListener('click',event=>{const b=event.target.closest?.('[data-diver-gender]');if(b&&!b.disabled)setDiverGender(b.dataset.diverGender);});
let specimenProficiency=SPECIMEN_SYSTEM?.normalizeMap?.((()=>{try{return JSON.parse(localStorage.getItem('abyssalSpecimenProficiency')||'{}')}catch{return {}}})())||{};
function specimenPoints(id=equippedSkin){return SPECIMEN_SYSTEM?.pointsFor?.(specimenProficiency,id)||0;}
function specimenProgressStats(id=equippedSkin){return SPECIMEN_SYSTEM?.stats?.(specimenPoints(id))||{points:0,progress:0,percent:0,cooldown:10,cooldownReduction:0,attributeBonus:0,rangeMultiplier:1,rangeBonus:0,respawnSeconds:20,respawnReduction:0};}
function specimenAlive(){return Boolean(player?.specimen?.alive!==false);}
function specimenPassiveActive(){return Boolean(player&&player.specimen&&player.specimen.alive!==false);}
function specimenOrigin(){if(player?.specimen)return {x:Number.isFinite(player.specimen.x)?player.specimen.x:player.x,y:Number.isFinite(player.specimen.y)?player.specimen.y:player.y};return {x:Number(player?.x)||0,y:Number(player?.y)||0};}
// Solo kills are queued per account and per dive, never as an arbitrary total balance.
let soloAdaptationRun=null,soloAdaptationSyncBusy=false;
function adaptationAccountKey(){const live=window.AbyssalOnline?.getAccount?.()?.nickname;if(live)return String(live).trim().toLowerCase();try{return localStorage.getItem('abyssalSessionToken')?String(JSON.parse(localStorage.getItem('abyssalAccount')||'{}').nickname||'').trim().toLowerCase():'';}catch{return '';}}
function readAdaptationQueue(key){try{return JSON.parse(localStorage.getItem('abyssalAdaptationQueue:'+key)||'[]')}catch{return [];}}
function writeAdaptationQueue(key,rows){try{localStorage.setItem('abyssalAdaptationQueue:'+key,JSON.stringify(rows));}catch(_){}}
function recordSoloAdaptation(id,boss){
 const key=adaptationAccountKey();if(!key||!soloAdaptationRun)return;
 const rows=readAdaptationQueue(key).filter(x=>x.id===soloAdaptationRun||JSON.stringify(x.counts)!==JSON.stringify(x.credited||{}));let row=rows.find(x=>x.id===soloAdaptationRun);
 if(!row){row={id:soloAdaptationRun,startedAt:Date.now(),counts:{}};rows.push(row);}
 const count=row.counts[id]||{common:0,boss:0};count[boss?'boss':'common']++;row.counts[id]=count;writeAdaptationQueue(key,rows);
 scheduleAccountMaintenance(1500);
}
function syncSoloAdaptation(){
 const key=adaptationAccountKey();if(!key||soloAdaptationSyncBusy||!window.AbyssalOnline?.isAuthenticated?.())return;
 const rows=readAdaptationQueue(key).filter(x=>JSON.stringify(x.counts)!==JSON.stringify(x.credited||{}));if(!rows.length)return;
 soloAdaptationSyncBusy=true;
 window.AbyssalOnline.syncSpecimenAdaptation(rows.slice(0,20),result=>{
  soloAdaptationSyncBusy=false;if(!result?.ok||adaptationAccountKey()!==key)return;
  const latest=readAdaptationQueue(key),sent=new Map(rows.slice(0,20).map(x=>[x.id,x]));
  const acknowledged=new Set(result.accepted||[]);
  writeAdaptationQueue(key,latest.flatMap(x=>{if(!acknowledged.has(x.id))return [x];const credited=sent.get(x.id)?.counts||{};if(x.id!==soloAdaptationRun&&JSON.stringify(x.counts)===JSON.stringify(credited))return [];return [{...x,credited}];}));
  if(result.account)window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}));if(acknowledged.size)syncSoloAdaptation();
 });
}
function pendingAdaptationMap(key,serverMap){
 const next=SPECIMEN_SYSTEM.normalizeMap(serverMap);
 for(const row of readAdaptationQueue(key))for(const [id,c] of Object.entries(row.counts||{})){
  const credited=row.credited?.[id]||{common:0,boss:0};
  next[id]=Math.min(5000,(next[id]||0)+Math.max(0,(c.common||0)-(credited.common||0))+10*Math.max(0,(c.boss||0)-(credited.boss||0)));
 }
 return next;
}
function saveSpecimenProficiencyLocal(){try{localStorage.setItem('abyssalSpecimenProficiency',JSON.stringify(specimenProficiency));}catch(_){}}
let expeditionMode=false,expeditionExtracted=false,expeditionRiskTier=0;
let soloDepthEventId=null,soloDepthEventEndsAt=0,pendingSoloDepthEventId=null;
let activeMapLayout=null,activeMapSeed=0,activeMapTier=0,onlineBossesDefeated=0;
let soloSideEncounterTier=-1,soloEliteRewardTier=-1,tierDescentPending=false,soloRiftActivatedRooms=new Set(),soloRiftSpawnQueue=[];
const SKIN_TRAIL_CADENCE_SECONDS=.5;
// Bubbles deal damage every 100 ms; emission remains at 200 ms to limit network/particles.
let sharkWakeTrails=[],inkTrails=[];
function setActiveMapDescriptor(descriptor){
 if(!isRiftRun()||onlineRoomMode==='pvp'||!ABYSSAL_MAP){activeMapLayout=null;activeMapSeed=0;activeMapTier=0;activeRiftHazards=[];riftBossMarks=[];W=defaultWidth();H=defaultHeight();return null;}
 const seed=Number(descriptor?.seed);
 if(!Number.isFinite(seed))return activeMapLayout;
 const tier=Math.max(0,Math.floor(Number(descriptor?.tier)||0));
 if(activeMapLayout&&activeMapSeed===seed&&activeMapTier===tier)return activeMapLayout;
 activeMapSeed=seed;activeMapTier=tier;activeMapLayout=ABYSSAL_MAP.createLayout(seed,tier);
 activeRiftHazards=RIFT_HARDCORE?.build(activeMapLayout,tier)||[];riftBossMarks=[];riftSoloHazardCooldowns.clear();soloRiftCheckpointRoomId='start';
 W=Number(activeMapLayout.width)||4800;H=Number(activeMapLayout.height)||3000;backgroundGradientCache=null;backgroundBloomCache=null;createDecor();updateCamera();
 return activeMapLayout;
}
function ensureSoloMap(){
 if(onlineMode||requestedRunMode!=='rift'||!ABYSSAL_MAP)return activeMapLayout;
 if(!activeMapLayout){runSeed=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;setActiveMapDescriptor({seed:runSeed,tier:0});}
 return activeMapLayout;
}
function mapResolveMove(fromX,fromY,toX,toY,padding=0){
 if(isClassicCavernRun()&&SOLO_CAVERN&&arenaRocks.length)return SOLO_CAVERN.resolve(arenaRocks,fromX,fromY,toX,toY,padding);
 if(!activeMapLayout&&usesNaturalOceanTerrain()&&OCEAN_GEOGRAPHY)return OCEAN_GEOGRAPHY.resolveMove(fromX,fromY,toX,toY,padding);
 if(!activeMapLayout||onlineRoomMode==='pvp'||!ABYSSAL_MAP)return {x:toX,y:toY,blocked:false};
 return ABYSSAL_MAP.resolveMove(activeMapLayout,fromX,fromY,toX,toY,padding);
}

let mapInteractionType=null,mapInteractionLastCheck=0,mapInteractionBusy=false;
function ensureMapInteractionButton(){
 let button=$('abyssMapInteractBtn');if(button)return button;
 button=document.createElement('button');button.id='abyssMapInteractBtn';button.type='button';button.hidden=true;button.className='abyss-map-interact';
 button.addEventListener('click',()=>activateMapInteraction());
 $('gameShell')?.appendChild(button);return button;
}
function checkSoloCaveEncounter(){
 if(onlineMode||!player||!activeMapLayout||!EXPEDITION_RULES||soloSideEncounterTier===activeMapTier)return;
 const room=ABYSSAL_MAP?.roomAt?.(activeMapLayout,player.x,player.y);if(room?.id!=='event')return;
 const encounter=EXPEDITION_RULES.sideEncounterFor?.(activeMapSeed,activeMapTier);if(!encounter)return;
 soloSideEncounterTier=activeMapTier;
 window.dispatchEvent(new CustomEvent('abyssal-cave-signal',{detail:{...encounter,tier:activeMapTier}}));
 if(encounter.type==='treasure'){spawnSoloOrb(player.x,player.y-12/GAME_WORLD_ZOOM,Math.max(1,Math.round((28+activeMapTier*7)*.22)));return;}
 const count=Math.max(1,Math.min(9,Math.floor(Number(encounter.ambushCount)||4)));
 for(let i=0;i<count&&enemies.length<MAX_ENEMIES;i++)spawnEnemy(false,'common',{roomId:'event',forceElite:false});
}
function cavePortalsUnlocked(){
 if(!activeMapLayout||onlineRoomMode==='pvp')return false;
 const defeated=onlineMode?onlineBossesDefeated:bossKillsThisRun;
 return defeated>activeMapTier&&!enemies.some(enemy=>enemy.hp>0&&BOSS_KINDS.includes(enemy.kind));
}
function currentMapInteraction(){
 if(!player||!activeMapLayout||onlineRoomMode==='pvp'||gameState!=='playing'||!ABYSSAL_MAP)return null;
 const portals=activeMapLayout.portals||{},padding=player.r+38/GAME_WORLD_ZOOM;
 if(portals.descent&&ABYSSAL_MAP.pointInPortal(portals.descent,player.x,player.y,-padding))return {type:'descent',label:'DESCER MAIS FUNDO',hint:'F · ENTRAR NO POÇO'};
 if(portals.landing&&ABYSSAL_MAP.pointInPortal(portals.landing,player.x,player.y,-padding))return {type:'ascend',label:'VOLTAR AO PATAMAR',hint:'F · SUBIR PELO VÓRTICE'};
 const unlocked=cavePortalsUnlocked();
 if(portals.surface&&unlocked&&ABYSSAL_MAP.pointInPortal(portals.surface,player.x,player.y,-padding))return {type:'surface',label:'VOLTAR À SUPERFÍCIE',hint:'F · EXTRAIR O SAQUE'};
 if((typeof activeMapTier!=='number'||activeMapTier<7)&&portals.boss&&unlocked&&ABYSSAL_MAP.pointInPortal(portals.boss,player.x,player.y,-padding))return {type:'next-tier',label:'DESCER MAIS FUNDO',hint:'F · PRÓXIMA CAMADA'};
 return null;
}
function updateMapInteraction(force=false){
 if(!isRiftRun()){const meter=document.getElementById('abyssDepthMeter');if(meter)meter.hidden=true;}
 const now=performance.now();if(!force&&now-mapInteractionLastCheck<100)return;mapInteractionLastCheck=now;
 if(!onlineMode)checkSoloCaveEncounter();
 const button=ensureMapInteractionButton(),interaction=currentMapInteraction();mapInteractionType=interaction?.type||null;
 if(!button)return;
 button.hidden=!interaction;
 if(interaction){const label=(mobileViewport?'':'F · ')+interaction.label;if(button.textContent!==label)button.textContent=label;button.dataset.kind=interaction.type;}
}
function applyMapTransition(kind,x,y){
 if(!player||!Number.isFinite(Number(x))||!Number.isFinite(Number(y)))return false;
 player.x=Number(x);player.y=Number(y);if(player.trail)player.trail.length=0;updateCamera();mapInteractionBusy=false;updateMapInteraction(true);
 const tierShift=kind==='next-tier';
 burst(player.x,player.y,tierShift?'#a66cff':kind==='descent'?'#55bfff':'#73f5df',lowPowerRendering?10:18,110);
 playWorldSound('portal',player,900,1);
 if(tierShift)enqueueGameplayNotice('cave',`CAMADA ${activeMapTier+1} ALCANÇADA`,'A pressão mudou. A fauna e as rotas desta descida não serão as mesmas.',70);
 else showToast(kind==='descent'?'VOCÊ DESCEU PARA UMA CAMADA MAIS PROFUNDA':'VÓRTICE DE RETORNO ATIVADO');
 return true;
}
function activateMapInteraction(){
 if(mapInteractionBusy)return false;
 const interaction=currentMapInteraction();if(!interaction)return false;
 if(interaction.type==='surface'){
  mapInteractionBusy=true;
  if(onlineMode){const button=$('endDiveBtn');if(button){button.click();return true;}mapInteractionBusy=false;return false;}
  expeditionExtracted=true;mapInteractionBusy=false;endGame();return true;
 }
 if(interaction.type==='next-tier'){
  if(activeMapTier>=(RIFT_HARDCORE?.FINAL_TIER??7))return false;
  if(onlineMode){
   mapInteractionBusy=true;
   const sent=window.AbyssalOnline?.requestMapTransition?.('next-tier',result=>{if(result?.ok===false){mapInteractionBusy=false;const reason=String(result.reason||'');enqueueGameplayNotice('cave','A PASSAGEM NÃO CEDEU',reason==='group-not-ready'?'Todo o cardume precisa se reunir no sigilo do boss.':reason==='boss-alive'?'A criatura colossal ainda domina esta camada.':'Derrote o boss desta camada e aproxime-se do sigilo.',85);updateMapInteraction(true);}});
   if(!sent){mapInteractionBusy=false;return false;}return true;
  }
  const nextTier=activeMapTier+1;setActiveMapDescriptor({seed:activeMapSeed,tier:nextTier});tierDescentPending=false;progressionDistance=0;
  enemies=[];orbs=[];projectiles=[];effects=[];enemyCollisionGrid.clear();
  seedSoloRiftEncounters();
  const spawn=ABYSSAL_MAP.startSpawn(activeMapLayout,0,1);
  return applyMapTransition('next-tier',spawn.x,spawn.y);
 }
 const portal=interaction.type==='descent'?activeMapLayout?.portals?.descent:activeMapLayout?.portals?.landing;
 if(!portal)return false;
 if(onlineMode){
  mapInteractionBusy=true;
  const sent=window.AbyssalOnline?.requestMapTransition?.(interaction.type,result=>{if(result?.ok===false){mapInteractionBusy=false;showToast(result.reason==='too-far'?'CHEGUE MAIS PERTO DO VÓRTICE':'A PASSAGEM NÃO RESPONDEU');updateMapInteraction(true);}});
  if(!sent){mapInteractionBusy=false;return false;}return true;
 }
 return applyMapTransition(interaction.type,portal.targetX,portal.targetY);
}
window.addEventListener('abyssal-map-transition',event=>{
 const result=event.detail||{};
 if(result.ok){
  if(result.map)setActiveMapDescriptor(result.map);
  if(result.kind==='next-tier'){enemies=[];orbs=[];onlineEnemyById.clear();onlineOrbById.clear();projectiles=[];effects=[];enemyCollisionGrid.clear();tierDescentPending=false;progressionDistance=0;}
  applyMapTransition(result.kind,result.x,result.y);
 }else{mapInteractionBusy=false;updateMapInteraction(true);}
});
function soloDepthState(){
 const bosses=Math.max(0,Number(bossKillsThisRun)||0),zone=EXPEDITION_RULES?.zoneForBosses?.(bosses)||null;
 const eventConfig=soloDepthEventId?EXPEDITION_RULES?.eventConfig?.(soloDepthEventId):null;
 const event=eventConfig&&soloDepthEventEndsAt>elapsed?{
  id:eventConfig.id,name:eventConfig.name,subtitle:eventConfig.subtitle,accent:eventConfig.accent,
  endsAt:soloDepthEventEndsAt,remaining:Math.max(0,soloDepthEventEndsAt-elapsed)
 }:null;
 return {
  bossesDefeated:bosses,
  mapTier:activeMapTier,
  nextTierUnlocked:bosses>activeMapTier&&!enemies.some(enemy=>BOSS_KINDS.includes(enemy.kind)),
  depth:activeMapLayout&&player&&ABYSSAL_MAP?.depthAt?ABYSSAL_MAP.depthAt(activeMapLayout,player.x,player.y):activeMapTier*350,
  zone:zone?{id:zone.id,name:zone.name,shortName:zone.shortName,subtitle:zone.subtitle,accent:zone.accent}:null,
  event
 };
}
function publishSoloDepthState(){
 if(onlineMode||!isRiftRun())return;
 window.dispatchEvent(new CustomEvent('abyssal-depth-state',{detail:soloDepthState()}));
}
let lastRiftDepthUiAt=0;
function publishLiveRiftDepth(){
 if(!isRiftRun()||!activeMapLayout||!player||!ABYSSAL_MAP?.depthAt)return;
 const now=performance.now();if(now-lastRiftDepthUiAt<120)return;lastRiftDepthUiAt=now;
 const bosses=onlineMode?onlineBossesDefeated:bossKillsThisRun,zone=EXPEDITION_RULES?.zoneForBosses?.(Math.max(activeMapTier,bosses))||null;
 window.dispatchEvent(new CustomEvent('abyssal-depth-state',{detail:{bossesDefeated:bosses,mapTier:activeMapTier,nextTierUnlocked:bosses>activeMapTier&&!enemies.some(enemy=>BOSS_KINDS.includes(enemy.kind)),depth:ABYSSAL_MAP.depthAt(activeMapLayout,player.x,player.y),zone,event:null}}));
}
function activatePendingSoloDepthEvent(){
 const id=pendingSoloDepthEventId;pendingSoloDepthEventId=null;
 if(!id||!EXPEDITION_RULES){publishSoloDepthState();return false;}
 const config=EXPEDITION_RULES.eventConfig(id);
 if(!config){publishSoloDepthState();return false;}
 soloDepthEventId=id;soloDepthEventEndsAt=elapsed+Math.max(1,Number(config.duration)||1);
 publishSoloDepthState();return true;
}
function expireSoloDepthEventIfNeeded(){
 if(onlineMode||!soloDepthEventId||elapsed<soloDepthEventEndsAt)return;
 soloDepthEventId=null;soloDepthEventEndsAt=0;publishSoloDepthState();
}

const SKIN_TAXONOMY=Object.freeze({
 saltcroc:{family:'reptile',collections:['shop']},blackcaiman:{family:'reptile',collections:['shop']},
 default:{collections:['signature']},
 violet:{family:'jelly',collections:['signature']},
 solar:{family:'benthic',collections:['signature']},
 toxic:{family:'benthic',collections:['signature']},
 thorn:{family:'benthic',collections:['signature']},
 abyssking:{family:'mollusc',collections:['signature']},
 royal:{family:'mollusc',collections:['signature']},
 glacier:{collections:['signature']},
 coral:{family:'benthic',collections:['signature']},
 bloodmoon:{family:'squid',collections:['signature']},
 voidwing:{family:'ray',collections:['signature']},
 abyssaleye:{family:'fish',collections:['signature']},
 deepwarden:{family:'crustacean',collections:['signature']},
 greensnake:{family:'eel',collections:['signature','mission'],unlockType:'mission'},
 riftSmileRelic:{family:'squid',collections:['relic','mission'],unlockType:'mission'},
 electriceel:{family:'ray',collections:['promo'],unlockType:'promo'},
  electriceellegacy:{family:'eel',collections:['shop']},
 reefshark:{family:'shark',collections:['shop']},
 hammerhead:{family:'shark',collections:['shop']},
 abysscroc:{family:'shark',collections:['shop']},
 armoredgator:{family:'crustacean',collections:['shop']},
 leviathan:{family:'fish',collections:['relic']},
 kraken:{family:'squid',collections:['relic']},
 aberration:{family:'octopus',collections:['relic']},
 angler:{family:'fish',collections:['relic']},
 maw:{family:'eel',collections:['relic']},
 devourer:{family:'squid',collections:['relic']}
});
const skinData=[
{id:'default',name:'Luz Abissal',color:'#75f8ed',price:0,paid:false,shape:'orb',desc:'Um núcleo vivo de luz bioluminescente, cercado por filamentos de maré.'},
{id:'violet',name:'Medusa-Coroa Violeta',color:'#bd91ff',price:199,paid:true,shape:'horns',desc:'Cnidário abissal fictício inspirado em medusas-coroa, com lóbulos violetas bioluminescentes.'},
{id:'solar',name:'Ouriço Solar',color:'#ffd078',price:2500,paid:false,shape:'spikes',desc:'Ouriço-do-mar de profundidade com espinhos dourados e fotóforos que pulsam como um pequeno sol.'},
{id:'toxic',name:'Anêmona Tóxica',color:'#a7ff78',price:4000,paid:false,shape:'tentacles',desc:'Anêmona abissal fictícia com tentáculos urticantes e glândulas que brilham em verde.'},
{id:'leviathan',name:'Eco do Peixe-Remo Leviatã',color:'#ff668f',price:999,paid:true,shape:'leviathan',desc:'Vestígio biológico do Peixe-Remo Leviatã: corpo laminar, crista sensorial e placas pálidas preservam uma fração da criatura colossal.'},
{id:'thorn',name:'Coroa de Espinhos',color:'#ff9b6a',price:8000,paid:false,shape:'coral',desc:'Galhos de coral negro crescem como uma coroa predatória.'},
{id:'abyssking',name:'Náutilo Soberano',color:'#8b7cff',price:10000,paid:false,shape:'king',desc:'Náutilo abissal fictício cuja concha segmentada forma uma coroa mineral em torno do núcleo violeta.'},
{id:'royal',name:'Pérola Regente',color:'#ff78d0',price:12000,paid:false,shape:'halo',desc:'Uma auréola de pérolas luminescentes envolve esta criatura rara.'},
{id:'glacier',name:'Glaciar Fantasma',color:'#91caff',price:13000,paid:false,shape:'crystal',desc:'Cristais de gelo marinho crescem em torno do seu corpo espectral.'},
{id:'coral',name:'Jardim Carnívoro',color:'#ff6f9d',price:6000,paid:false,shape:'coral',desc:'Corais rubros, espinhos calcificados e filamentos de anêmona.'},
{id:'bloodmoon',name:'Lula-Vampira Carmesim',color:'#ff3c66',price:9000,paid:false,shape:'fangs',desc:'Cefalópode inspirado na lula-vampira, com membranas escuras, braços denticulados e fotóforos carmesim.'},
{id:'voidwing',name:'Manta do Nada',color:'#b2a0ff',price:15000,paid:false,shape:'wings',desc:'Membranas espectrais se abrem como asas de uma criatura antiga.'},
{id:'abyssaleye',name:'Peixe-Olho-de-Barril',color:'#66f0ff',price:18000,paid:false,shape:'eye',desc:'Peixe de profundidade inspirado no barreleye, com cúpula translúcida e olhos tubulares voltados para a escuridão.'},
{id:'deepwarden',name:'Carcereiro das Fossas',color:'#b8d6c6',price:14000,paid:false,shape:'shell',desc:'Três placas minerais protegem um núcleo verde-fantasma.'},
{id:'riftSmileRelic',name:'Vestígio do Pesadelo Roxo',color:'#cc86ff',price:0,paid:false,shape:'nightmare',unlockType:'mission',desc:'Vestígio do Pesadelo Roxo com manto de polvo, olhos negros pontudos, íris amarelas em fenda vertical e oito braços curvos com ventosas bioluminescentes.'},
{id:'kraken',name:'Eco da Lula-Kraken',color:'#4f9fc7',price:999,paid:true,shape:'kraken',desc:'Ressonância orgânica da Lula-Kraken das Fossas, com manto vítreo e braços reduzidos. A criatura colossal permanece abaixo.'},
 {id:'aberration',name:'Eco do Polvo-de-Anéis-Azuis',color:'#338cff',price:999,paid:true,shape:'aberration',desc:'Eco controlável do Polvo-de-Anéis-Azuis Colossal, com manto azul, anéis bioluminescentes e braços pendentes.'},
 {id:'angler',name:'Núcleo do Peixe-Pescador',color:'#ffb45e',price:999,paid:true,shape:'angler',desc:'Fragmento vivo do Peixe-Pescador Abissal, com mandíbula descomunal permanentemente aberta e ilício bioluminescente.'},
 {id:'maw',name:'Fragmento da Enguia-Pelícano',color:'#c16cff',price:999,paid:true,shape:'maw',desc:'Fragmento da Enguia-Pelícano Colossal: preserva a enorme boca expansível e agora revela o corpo longo e serpentiforme da espécie.'},
 {id:'devourer',name:'Núcleo da Lula-Colossal',color:'#39d8c4',price:999,paid:true,shape:'devourer',desc:'Núcleo residual da Lula-Colossal do Vazio. O manto ainda produz uma corrente de sucção ao redor da criatura.'},
{id:'saltcroc',name:'Crocodilo-Marinho',color:'#537f87',price:499,paid:true,shape:'crocodile',desc:'Rostro longo em V, escamas dorsais e cauda muscular. Interpretação abissal do crocodilo-marinho.'},
{id:'blackcaiman',name:'Jacaré-Açu',color:'#425b68',price:499,paid:true,shape:'alligator',desc:'Focinho largo em U, crânio robusto e placas negras iluminadas pelas águas profundas.'},
{id:'reefshark',name:'Tubarão-branco',color:'#91c4ce',price:199,paid:true,shape:'greatwhite',desc:'Predador pelágico de dorso cinza, ventre claro, focinho cônico e cauda em crescente.'},
{id:'hammerhead',name:'Tubarão-martelo',color:'#73b6cd',price:199,paid:true,shape:'hammerhead',desc:'Silhueta reconhecível pelo cefalofólio largo, olhos laterais e nado de varredura.'},
{id:'abysscroc',name:'Tubarão-Touro Estuarino',color:'#518d68',price:499,paid:true,shape:'alligator',desc:'Tubarão costeiro robusto inspirado no tubarão-touro, adaptado a canais rasos, estuários e água turva.'},
{id:'armoredgator',name:'Caranguejo-Ferradura Couraçado',color:'#b59a65',price:499,paid:true,shape:'crocodile',desc:'Artrópode marinho blindado inspirado no caranguejo-ferradura, com carapaça mineralizada e télson longo.'},
{id:'greensnake',name:'Moréia Esmeralda Colossal',color:'#2ee88a',price:0,paid:false,shape:'serpent',desc:'Moréia oceânica colossal de pele verde-jade, corpo sinuoso e mandíbula dupla inspirada nas faringes das moréias.'},
  {id:'electriceel',name:'Raia-Elétrica Abissal',color:'#38e8ff',price:0,paid:false,shape:'eel',desc:'Raia marinha inspirada nas torpediniformes, com disco muscular e órgãos bioelétricos pulsando em ciano.'},
{id:'electriceellegacy',name:'Enguia-Elétrica Abissal',color:'#7ef6ff',price:499,paid:true,shape:'electric-eel',desc:'Enguia longa de corpo escuro e linhas ciano pulsantes, inspirada no visual elétrico clássico do Abyssal.'},
];
const SkinAbilities=window.AbyssalSkinAbilities;
const SKIN_STANDARD=window.AbyssalSkinStandard;
const SPECIMEN_EVASION=window.AbyssalSpecimenEvasion;
const SOLO_CAVERN=window.AbyssalSoloCavern;
const PET_TACTICS=window.AbyssalPetTactics;
const PET_HABIT_KEY='abyssalPetHabit';
let petHabit=PET_TACTICS?.normalize?.(localStorage.getItem(PET_HABIT_KEY))||'passive';
function setPetHabit(mode,announce=false){
 petHabit=PET_TACTICS?.normalize?.(mode)||'passive';
 try{localStorage.setItem(PET_HABIT_KEY,petHabit);}catch(_){}
 document.querySelectorAll('[data-pet-habit]').forEach(button=>{
  const selected=button.dataset.petHabit===petHabit;
  button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));
 });
 if(announce)showToast('ESPÉCIME: '+({passive:'PASSIVO · COLETOR',aggressive:'AGRESSIVO · COLETOR',guardian:'PROTETOR · COLETOR'}[petHabit]));
}
document.querySelectorAll('[data-pet-habit]').forEach(button=>button.addEventListener('click',()=>setPetHabit(button.dataset.petHabit,true)));
window.addEventListener('keydown',event=>{
 if(event.repeat||!document.body.classList.contains('game-active')||event.target?.matches?.('input,textarea,select'))return;
 const habit={'Digit4':'passive','Digit5':'aggressive','Digit6':'guardian'}[event.code];
 if(habit&&(!onlineMode||isClassicCavernRun())){event.preventDefault();setPetHabit(habit,true);}
});
const SPECIMEN_RARITY=window.AbyssalSpecimenRarity;
const SHOP_ECONOMY=window.AbyssalShopEconomy;
skinData.push(...(window.AbyssalCuratedSkins?.items||[]));
for(const skin of skinData){
 const profile=SKIN_STANDARD?.profile?.(skin.id);
 if(!profile)continue;
 skin.tier=profile.tier;skin.stat=profile.attribute;skin.multiplier=SKIN_STANDARD.passiveMultiplier(skin.id,profile.attribute);
 skin.bonuses=Object.freeze({[profile.attribute]:skin.multiplier});
 skin.ability=SKIN_STANDARD.describe(skin.id);
 if(profile.tier==='brl199'){skin.paid=true;skin.price=199;}
 else if(profile.tier==='brl499'){skin.paid=true;skin.price=499;}
 else if(profile.tier==='brl999'){skin.paid=true;skin.price=999;}
 else if(profile.tier==='mission'||profile.tier==='promo'){skin.paid=false;skin.price=0;}
 else if(profile.tier==='coins'){skin.paid=false;skin.rarity=SPECIMEN_RARITY?.rarityFor?.(skin.id)||'common';skin.price=skin.id==='default'?0:SHOP_ECONOMY.priceForRarity(skin.rarity);}
}
function skinShopTaxonomy(skin){
 const meta=SKIN_TAXONOMY[skin?.id]||{};
 const family=skin?.family||meta.family||null;
 const collections=[...(Array.isArray(meta.collections)?meta.collections:[]),...(skin?.collection?[skin.collection]:[])];
 return {family,collections:[...new Set(collections)]};
}
function skinShopCategories(skin){const tax=skinShopTaxonomy(skin),set=new Set(tax.collections);if(tax.family)set.add(tax.family);return set;}
function skinShopFamily(skin){return skinShopTaxonomy(skin).family||skinShopTaxonomy(skin).collections[0]||'signature';}
let ownedSkins=JSON.parse(localStorage.getItem('abyssalOwnedSkins')||'["default"]');
const SPECIMEN_DISCOVERY_KEY='abyssalDiscoveredSpecimens';
const SOLO_INITIAL_KINDS=Object.freeze(['drifter','stinger','brute','lurker']);
const DEVELOPMENT_FAUNA=new Set(['hawksbill','leatherback','butterflyray','eagleray']);
const SOLO_SPECIMEN_REFERENCES=Object.freeze({drifter:'violet',stinger:'abyssaleye',brute:'deepwarden',lurker:'maw',whiteShark:'reefshark',whiteSharkBoss:'reefshark',boss:'aberration',angler:'angler',maw:'maw',leviathan:'leviathan',kraken:'kraken',devourer:'devourer',riftSmile:'riftSmileRelic'});
const CLASSIC_SHOP_IDS=new Set(['default','solar','toxic','thorn','abyssking','royal','glacier','coral','bloodmoon','voidwing','abyssaleye','deepwarden']);
function specimenShopAvailable(skin){return Boolean(skin&&(ownedSkins.includes(skin.id)||(!DEVELOPMENT_FAUNA.has(skin.id)&&(SKIN_STANDARD.paid199.has(skin.id)||SKIN_STANDARD.paid499.has(skin.id)||SKIN_STANDARD.bossPaid.has(skin.id)||CLASSIC_SHOP_IDS.has(skin.id)||discoveredSpecimens.has(skin.id)))));}
let discoveredSpecimens=new Set(['default']);
try{const saved=JSON.parse(localStorage.getItem(SPECIMEN_DISCOVERY_KEY)||'[]');if(Array.isArray(saved))for(const id of saved)discoveredSpecimens.add(String(id));}catch(_){}
function persistSpecimenDiscovery(){
 try{localStorage.setItem(SPECIMEN_DISCOVERY_KEY,JSON.stringify([...discoveredSpecimens]));}catch(_){}
}
function registerSpecimenDiscovery(id,notify=true){
 id=String(id||'');
 if(!id||discoveredSpecimens.has(id))return;
 discoveredSpecimens.add(id);persistSpecimenDiscovery();
 if($('catalogScreen')&&!$('catalogScreen').hidden)renderCatalog();
 if(notify){
  window.dispatchEvent(new CustomEvent('abyssal-specimen-discovery-request',{detail:{id}}));
  showToast('NOVO ESPÉCIME REGISTRADO');
 }
 if(!$('shopScreen')?.hidden)renderShop();
}
window.addEventListener('abyssal-account-data',event=>{
 const serverList=event.detail?.discoveredSpecimens;
 if(!Array.isArray(serverList))return;
 discoveredSpecimens=new Set(['default',...serverList.map(String)]);persistSpecimenDiscovery();if(!$('catalogScreen')?.hidden)renderCatalog();if(!$('shopScreen')?.hidden)renderShop();
});
window.addEventListener('abyssal-specimen-discovery-confirmed',event=>registerSpecimenDiscovery(event.detail?.id,false));

let gameLanguage=['en','es'].includes(localStorage.getItem('abyssalLanguage'))?localStorage.getItem('abyssalLanguage'):'pt';
let shopCurrency='brl';
let shopRates={brl:1};
function setGameLanguage(language){gameLanguage=['en','es'].includes(language)?language:'pt';localStorage.setItem('abyssalLanguage',gameLanguage);shopCurrency='brl';const languageSelect=$('languageSelect');if(languageSelect)languageSelect.value=gameLanguage;const cockpitLanguage=$('cockpitLanguageSelect');if(cockpitLanguage)cockpitLanguage.value=gameLanguage;const currencySelect=$('shopCurrency');if(currencySelect)currencySelect.value='brl';if(!$('shopScreen')?.hidden)renderShop();window.dispatchEvent(new CustomEvent('abyssal-language-change',{detail:{language:gameLanguage,currency:'brl'}}));}
// Keep the last server-synchronized ownership cache while session restoration is pending. The authoritative account-data event replaces it after authentication.
function saveCosmetics(){localStorage.setItem('abyssalDiverGender',diverGender);localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));localStorage.setItem('abyssalMetaUpgrades',JSON.stringify(metaUpgrades));saveSpecimenProficiencyLocal();if(window.AbyssalOnline?.saveCosmetics)window.AbyssalOnline.saveCosmetics({ownedSkins,equippedSkin,metaUpgrades,diverGender,conqueror:ownedSkins.includes('greensnake')});}
function currentSkinColor(){return (skinData.find(s=>s.id===equippedSkin)||skinData[0]).color;}
let mobileFireHeld=false;
let pointer={x:0,y:0,down:false,active:false},keys={},joystickVector={x:0,y:0,active:false,pointerId:null},aimJoystickVector={x:0,y:0,active:false,pointerId:null};
const controlSettings={pc:localStorage.getItem('abyssalControlsPc')||'classic',mobile:localStorage.getItem('abyssalControlsMobile')||'classic'};
let controlAimAngle=0;
const MAX_ENEMIES=400,MAX_BOSSES=4,MAX_COMMON_ENEMIES=MAX_ENEMIES-MAX_BOSSES;
const SEA_PROGRESSION=window.AbyssalSeaProgression;
const SOLO_CLASSIC_CAP=50;
const soloEnemyCap=()=>requestedRunMode==='rift'?MAX_ENEMIES:requestedRunMode==='classic'?SOLO_CLASSIC_CAP:(SEA_PROGRESSION?.MAX_SEA_ENEMIES||100);
const soloCommonCap=()=>requestedRunMode==='rift'?MAX_COMMON_ENEMIES:requestedRunMode==='classic'?SOLO_CLASSIC_CAP-1:(SEA_PROGRESSION?.MAX_SEA_COMMON_ENEMIES||99);
const particleBudget=()=>520, projectileBudget=()=>240, effectBudget=()=>240, orbBudget=()=>180;
const gameplayFrameBudget={faunaThink:0,particleSpawns:0,networkFlushes:0};
function beginGameplayFrameBudget(){gameplayFrameBudget.faunaThink=0;gameplayFrameBudget.particleSpawns=0;gameplayFrameBudget.networkFlushes=0;}
function faunaThinkBudget(){return Math.max(10,Math.min(30,8+Math.ceil(enemies.length*.16)));}
function consumeFaunaThinkBudget(priority=false){const cap=faunaThinkBudget()+(priority?6:0);if(gameplayFrameBudget.faunaThink>=cap)return false;gameplayFrameBudget.faunaThink++;return true;}
function frameParticleSpawnBudget(){return adaptiveQualityLevel===0?100:adaptiveQualityLevel===1?135:175;}
function reserveParticleSpawns(requested){const available=Math.max(0,frameParticleSpawnBudget()-gameplayFrameBudget.particleSpawns),granted=Math.min(Math.max(0,requested|0),available);gameplayFrameBudget.particleSpawns+=granted;return granted;}
const BOSS_KINDS=['boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer','riftSmile'];
const BOSS_LABELS=Object.freeze({riftSmile:'PESADELO ROXO',boss:'POLVO-DE-ANÉIS-AZUIS COLOSSAL',leviathan:'PEIXE-REMO LEVIATÃ',maw:'ENGUIA-PELÍCANO COLOSSAL',angler:'PEIXE-PESCADOR ABISSAL',whiteSharkBoss:'TUBARÃO-BRANCO · O DEVORADOR PELÁGICO',kraken:'LULA-KRAKEN DAS FOSSAS',devourer:'LULA-COLOSSAL DO VAZIO'});
function anglerVisibilityAlpha(nowMs=Date.now()){
 const phase=((Number(nowMs)||0)%26000+26000)%26000;
 if(phase<3000)return Math.max(0,1-phase/3000);
 if(phase<13000)return 0;
 if(phase<16000)return Math.min(1,(phase-13000)/3000);
 return 1;
}
function anglerInvisibleNow(nowMs=Date.now()){const phase=((Number(nowMs)||0)%26000+26000)%26000;return phase>=3000&&phase<13000;}
function enemyHiddenFromAutoTarget(enemy,nowMs=Date.now()){return Boolean(enemy&&enemy.kind==='angler'&&anglerInvisibleNow(nowMs));}

const PROFILE_TITLE_NAMES=Object.freeze({...Object.fromEntries(Array.from({length:10},(_,i)=>['hall-top-'+(i+1),'Top '+(i+1)])),'sonar-novice':'Eco do Primeiro Sonar','lantern-hunter':'Caçador de Fotóforos','hadal-executioner':'Carrasco Hadal','first-predator':'Primeira Presa Colossal','abyss-stalker':'Perseguidor de Leviatãs','titan-bane':'Flagelo dos Titãs','cycle-pioneer':'Pioneiro dos Sete Selos','rift-cartographer':'Cartógrafo das Fossas','hadal-navigator':'Navegador Hadal','veteran-diver':'Veterano de Expedições','eternal-explorer':'Viajante Insondável','abyss-drifter':'Mergulhador das Fossas','abyss-spark':'Faísca das Fossas','current-hunter':'Caçador de Correntes','pelagic-executioner':'Carrasco Pelágico','leviathan-hunter':'Caçador de Leviatãs','sovereign-abyss':'Soberano do Insondável','shoal-founder':'Fundador do Cardume','supporter-of-the-depths':'Apoio das Profundezas','abyssal-famous':'Nome Conhecido','abyssal-icon':'Ícone do Abismo','living-legend':'Lenda Viva','abyssal-patron':'Patrono do Abismo','boss-abyssal':'Boss Abyssal'});
const PROFILE_TITLE_COLORS=Object.freeze({...Object.fromEntries(Array.from({length:10},(_,i)=>['hall-top-'+(i+1),['#ffd66b','#dce8f3','#d79a63'][i]||'#a5dfff'])),'sonar-novice':'#88dfe2','lantern-hunter':'#abf8e8','hadal-executioner':'#ff86ca','first-predator':'#ffe59e','abyss-stalker':'#dbb7ff','titan-bane':'#ffc37d','cycle-pioneer':'#a1ff9d','rift-cartographer':'#83e3fb','hadal-navigator':'#9fcaff','veteran-diver':'#e6d7ff','eternal-explorer':'#ffb8df','abyss-drifter':'#79f3f0','abyss-spark':'#8cf8ff','current-hunter':'#b39cff','pelagic-executioner':'#ff829b','leviathan-hunter':'#ffd27a','sovereign-abyss':'#e0b7ff','shoal-founder':'#73e7c3','supporter-of-the-depths':'#ff9fca','abyssal-famous':'#ffb0d9','abyssal-icon':'#f2a8ff','living-legend':'#ffe29b','abyssal-patron':'#ffd27a','boss-abyssal':'#ff6b9d'});
const particlePool=[],effectPool=[];
function recycleEffect(fx){if(!fx||effectPool.length>=420)return;effectPool.push(fx);}
function queueEffect(data){
 const critical=data?.type==='photon-ray'||data?.type==='gravity-cone';
 if(!critical&&effects.length>=effectBudget())return null;
 const fx=effectPool.pop()||{};
 for(const key in fx)delete fx[key];
 Object.assign(fx,data);effects.push(fx);return fx;
}
const hostileSpriteCache=new Map();
// Bound texture memory, not image detail. Evict old cached surfaces rather than downsample.
const MAX_SPRITE_PIXELS=12*1024*1024,MAX_SINGLE_SPRITE_PIXELS=4*1024*1024;
function getCachedSprite(cache,key){const sprite=cache.get(key);if(sprite){cache.delete(key);cache.set(key,sprite);}return sprite;}
function rememberCachedSprite(cache,key,sprite,maxEntries){cache.set(key,sprite);let pixels=0;for(const entry of cache.values())pixels+=entry.canvas.width*entry.canvas.height;while(cache.size>1&&(cache.size>maxEntries||pixels>MAX_SPRITE_PIXELS)){const oldest=cache.keys().next().value,entry=cache.get(oldest);pixels-=entry.canvas.width*entry.canvas.height;cache.delete(oldest);entry.canvas.width=1;entry.canvas.height=1;}}
const previewCanvasSizes=new WeakMap();
function preparePreviewCanvas(canvas){const c=canvas.getContext('2d');if(!c)return null;let size=previewCanvasSizes.get(canvas);if(!size){size={w:canvas.width,h:canvas.height};previewCanvasSizes.set(canvas,size);}const w=canvas.clientWidth||size.w,h=canvas.clientHeight||size.h,density=Math.max(1,window.devicePixelRatio||1),pw=Math.ceil(w*density),ph=Math.ceil(h*density);if(canvas.width!==pw||canvas.height!==ph){canvas.style.width=w+'px';canvas.style.height=h+'px';canvas.width=pw;canvas.height=ph;}c.setTransform(density,0,0,density,0,0);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';return {c,w,h};}
const aquaticMotionTracker=window.AbyssalSkinMotion?.createTracker?.({maxEntries:640})||null;
const aquaticMotionSource={};
const remoteCreatureAttackUntil=new Map();
const hostileSpriteState={__sprite:true,__visualMotion:null,phase:0};
const finalBossVisualState={x:0,y:0,r:0,angle:0};
function creatureAttackActivity(kind,state,hit=0){
 if(Number(hit)>0)return .55;
 if(Number(state?.visualAttackUntil)>performance.now())return 1;
 if(state?.suctionActive||state?.krakenSweepActive||state?.dashVx||state?.dashVy)return 1;
 if(Number(state?.krakenTelegraph)>0)return clamp(Number(state.krakenTelegraph),0,1)*.72;
 if(Number(state?.attackCd)>=0&&Number(state.attackCd)<.18)return .65;
 return 0;
}
function presentationMotion(source,t,angle){
 const family=window.AbyssalSkinMotion?.familyForEntity?.(source)||'signature';
 const pose=window.AbyssalSkinMotion?.pose?.({id:source?.id||source?.kind||family,family},t,.18,0)||{};
 const orientation=window.AbyssalSkinMotion?.anatomicalOrientation?.(angle,family)||{facing:1,pitch:Number(angle)||0};
 return {...pose,family,facing:orientation.facing,facingScale:orientation.facing,pitch:orientation.pitch,phaseTime:t};
}
function creatureVisualMotion(skin,kind,state,x,y,angle,t,playerCreature,preview=false){
 const id=String(state?.visualId||state?.id||(playerCreature?'skin:':'enemy:')+(skin?.id||kind||'creature'));
 const source=aquaticMotionSource;
 source.id=id;source.skin=skin;source.kind=kind;source.family=skin?.family;
 source.x=x;source.y=y;source.angle=angle;source.preview=preview;
 source.nominalSpeed=Number(state?.dashSpeed)||Number(state?.speed)||Number(state?.moveSpeed)||(playerCreature?180/GAME_WORLD_ZOOM:90);
 source.attack=creatureAttackActivity(kind,state,state?.hit);
 return aquaticMotionTracker&&!preview?aquaticMotionTracker.sample(source,t):presentationMotion(source,t,angle);
}
function applyCreatureVisualTransform(c,motion,r,heading=null){
 if(!motion)return;
 // Player skins follow the cursor; moving enemies and bosses follow their
 // displacement in every direction. Rotating and then mirroring would reverse
 // the intended heading, so use a positive scale whenever heading is provided.
 const followsAim=Number.isFinite(heading);
 c.rotate((followsAim?heading:0)+(Number(motion.roll)||0));
 c.scale((followsAim?1:(Number(motion.facingScale)||1))*(Number(motion.stretchX)||1),Number(motion.stretchY)||1);
 c.translate(-(Number(motion.recoil)||0)*r,(Number(motion.bob)||0)*r*.28);
}
let enemyCollisionGrid=new Map(),enemyCollisionCellSize=270,enemyCollisionBuckets=[],enemyCollisionBucketCount=0;
const projectileCandidates=[];
const areaEnemyCandidates=[],wildlifeNeighborCandidates=[],specimenNearbyEnemies=[],specimenNavigationThreats=[],specimenBodyCandidates=[],specimenContactCandidates=[];
// Reused objects/arrays for the hot enemy-update path (up to 400 entities per frame).
const soloEnemyMovementResult={};
const soloEnemyMovementOptions={minX:0,maxX:W,minY:0,maxY:H,stopDistance:0};
const soloMapNavProxy={x:0,y:0,local:true,skinId:'default',moveSpeed:150/GAME_WORLD_ZOOM,alive:true};
const soloMapNavTargets=[soloMapNavProxy];
let selectedSkillsRenderedSignature=null,lastHudUpdateAt=0,lastAbilityUiAt=-Infinity;
let soloSubmarine={x:0,y:0,powerSeconds:0,spawnFx:0,weaponTimers:Object.create(null),sections:[],debris:[],shieldSpent:false,shieldFlashUntil:0,repair:null};
const SOLO_HULL_HP=1000,SOLO_HULL_CUTS=[-300,-140,140,300],SOLO_HULL_NAMES=['POPA','CENTRO','PROA'];
function clipSoloHull(points,edge,keepRight){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],inside=p=>keepRight?p[0]>=edge:p[0]<=edge,ai=inside(a),bi=inside(b);if(ai)out.push(a);if(ai!==bi){const q=(edge-a[0])/(b[0]-a[0]);out.push([edge,a[1]+(b[1]-a[1])*q]);}}return out;}
function makeSoloHullSections(){const scale=1/GAME_WORLD_ZOOM,hull=SOLO_CAVERN.submarineHull(soloSubmarine.x,soloSubmarine.y,scale);return SOLO_HULL_NAMES.map((name,i)=>{const min=SOLO_HULL_CUTS[i]*scale,max=SOLO_HULL_CUTS[i+1]*scale,vertices=clipSoloHull(clipSoloHull(hull.vertices,min,true),max,false),cx=(min+max)*.5,local=vertices.map(([x,y])=>[x-cx,y]),rx=Math.max(...local.map(v=>Math.abs(v[0]))),ry=Math.max(...local.map(v=>Math.abs(v[1])));const rock={x:soloSubmarine.x+cx,y:soloSubmarine.y,rx,ry,r:Math.hypot(rx,ry),angle:0,vertices:local,cavernSolid:true,submarineHull:true,visualOnly:false,sectionId:i};return {id:i,name,hp:SOLO_HULL_HP,min,max,x:soloSubmarine.x+cx,y:soloSubmarine.y,rock,collision:[rock]};});}
function syncSoloHull(){arenaRocks=arenaRocks.filter(r=>!r.submarineHull).concat(soloSubmarine.sections.filter(s=>s.hp>0).map(s=>s.rock));soloSubmarine.hullRevision=(Number(soloSubmarine.hullRevision)||0)+1;}
function soloHullDistance(s,x,y){return Math.hypot(x-s.x,y-s.y);}
function nearestSoloHull(x,y,damagedOnly=false){let best=null,d=Infinity;for(const s of soloSubmarine.sections){if(damagedOnly?s.hp>=SOLO_HULL_HP:s.hp<=0)continue;const q=soloHullDistance(s,x,y);if(q<d){best=s;d=q;}}return best;}
function soloHullAttackTarget(e){const s=nearestSoloHull(e.x,e.y);if(!s)return null;const now=performance.now(),cached=e.submarineTargetCache;if(cached&&cached.section===s&&cached.revision===soloSubmarine.hullRevision&&now<cached.until)return cached.target;const r=s.rock,pad=Math.max(5,e.r*.62),a=Math.atan2(e.y-s.y,e.x-s.x);let best=null,cost=Infinity;for(const off of [0,.55,-.55,1.1,-1.1,1.65,-1.65,Math.PI]){const dx=Math.cos(a+off),dy=Math.sin(a+off);let lo=0,hi=r.r+pad+20;for(let i=0;i<9;i++){const mid=(lo+hi)*.5;if(SOLO_CAVERN.isBlocked(s.collision,s.x+dx*mid,s.y+dy*mid,pad+3))lo=mid;else hi=mid;}const x=s.x+dx*hi,y=s.y+dy*hi;if(SOLO_CAVERN.isBlocked(arenaRocks,x,y,pad))continue;const q=Math.hypot(e.x-x,e.y-y);if(q<cost){best={x,y};cost=q;}if(off===0&&best)break;}const target={...(best||{x:s.x,y:s.y}),local:false,submarine:true,section:s,skinId:'default',r:0,moveSpeed:player?.moveSpeed};e.submarineTargetCache={section:s,revision:soloSubmarine.hullRevision,until:now+180+(Number(e.id)||0)%70,target};return target;}
function soloCreatureTarget(e,diver){if(!isClassicShooterRun())return diver;if(soloSubmarinePowered()){const target=soloHullAttackTarget(e);if(target)return target;}const pet=player?.specimen;if(pet?.alive&&Math.hypot(e.x-pet.x,e.y-pet.y)<Math.hypot(e.x-diver.x,e.y-diver.y))return {x:pet.x,y:pet.y,r:pet.r,local:false,specimen:true,skinId:equippedSkin,moveSpeed:player.moveSpeed};return diver;}
function soloHullShieldReady(){return soloSubmarinePowered()&&!soloSubmarine.shieldSpent&&Boolean(window.AbyssalSoloBase?.get?.().submarineShield);}
function damageSoloHull(s,amount){
 if(!s||s.hp<=0||!(amount>0))return false;
 if(soloHullShieldReady()){soloSubmarine.shieldSpent=true;soloSubmarine.shieldFlashUntil=performance.now()+420;return false;}
 s.hp=Math.max(0,s.hp-amount);if(s.hp>0)return true;syncSoloHull();if(soloWeaponSection('photonRay')===s)clearSoloSubmarinePhotonRay();const scale=1/GAME_WORLD_ZOOM;for(let i=0;i<12;i++){const a=i*2.399;soloSubmarine.debris.push({x:s.x+(Math.cos(a)*55)*scale,y:s.y+Math.sin(a)*45*scale,vx:Math.cos(a)*(15+i*3)*scale,vy:(20+i*5)*scale,angle:a,spin:(i%2?1:-1)*(.4+i*.09),size:(7+i%5*3)*scale,life:3});}return true;
}
function soloHullInReach(e,extra=0){
 if(!soloSubmarineActive())return null;
 const pad=Math.max(5,e.r*.62)+(8+extra)/GAME_WORLD_ZOOM;
 if(Math.abs(e.x-soloSubmarine.x)>300/GAME_WORLD_ZOOM+pad||Math.abs(e.y-soloSubmarine.y)>110/GAME_WORLD_ZOOM+pad)return null;
 const held=e.submarineHoldSection;
 if(held&&held.hp>0&&SOLO_CAVERN.isBlocked(held.collision,e.x,e.y,pad))return held;
 let hit=null;for(const s of soloSubmarine.sections){if(s.hp>0&&SOLO_CAVERN.isBlocked(s.collision,e.x,e.y,pad)){if(!hit||soloHullDistance(s,e.x,e.y)<soloHullDistance(hit,e.x,e.y))hit=s;}}return hit;
}
function soloHullImpactPoint(e,s){
 const dx=e.x-s.x,dy=e.y-s.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;let lo=0,hi=s.rock.r+2;
 for(let i=0;i<10;i++){const mid=(lo+hi)*.5;if(SOLO_CAVERN.isBlocked(s.collision,s.x+ux*mid,s.y+uy*mid,0))lo=mid;else hi=mid;}
 return {x:s.x+ux*lo,y:s.y+uy*lo};
}
function soloHullContact(e,now){
 if(enemyParalyzedNow(e)||now<(Number(e.submarineAttackAt)||0))return false;
 const hit=soloHullInReach(e,e.submarineHoldSection?4:0);if(!hit)return false;
 e.submarineAttackAt=now+1000;
 const impact=soloHullImpactPoint(e,hit),angle=Math.atan2(impact.y-e.y,impact.x-e.x);
 e.hostileBite={startedAt:now,duration:480,angle};
 if(typeof renderHostileContactAbility==='function')renderHostileContactAbility({kind:e.kind,enemyId:e.id,enemy:e,enemyX:e.x,enemyY:e.y,enemyRadius:e.r,angle,enemyColor:e.color,playerX:impact.x,playerY:impact.y,submarine:true});
 damageSoloHull(hit,Math.max(5,Number(e.damage)||8));return true;
}
function holdSoloHullAttack(e,dt,now){
 // Hysteresis: a creature that has settled stays at its attack station
 // until its section is destroyed, power ends, or knockback moves it away.
 if(!soloSubmarinePowered()||!soloSubmarineActive()||enemyParalyzedNow(e)){e.submarineHoldSection=null;return false;}
 const section=soloHullInReach(e,e.submarineHoldSection?4:0);
 if(!section){e.submarineHoldSection=null;return false;}
 e.submarineHoldSection=section;
 e.vx=0;e.vy=0;e.dashVx=0;e.dashVy=0;
 e.angle=Math.atan2(section.y-e.y,section.x-e.x);
 e.phase=(Number(e.phase)||0)+dt*3;
 e.attackCd=Math.max(0,(Number(e.attackCd)||0)-dt);
 soloHullContact(e,now);return true;
}
const SOLO_HULL_REPAIR_SECONDS=6,ONLINE_HULL_REPAIR_SECONDS=15;
const submarineRepairSeconds=()=>onlineMode&&onlineRoomMode==='coop'?ONLINE_HULL_REPAIR_SECONDS:SOLO_HULL_REPAIR_SECONDS;
function soloRepairCandidate(){
 if(!soloSubmarineActive()||!player||soloSubmarine.spawnFx>1.25)return null;
 let best=null,d=Infinity;
 for(const s of soloSubmarine.sections){if(s.hp>=SOLO_HULL_HP||!SOLO_CAVERN.isBlocked(s.collision,player.x,player.y,75/GAME_WORLD_ZOOM+(Number(player.r)||0)))continue;const q=soloHullDistance(s,player.x,player.y);if(q<d){best=s;d=q;}}
 return best;
}
function soloRepairSurface(section,x,y){
 // Closest point on the actual polygon, including destroyed sections.
 const vertices=section.rock.vertices;let best=null,d=Infinity;
 for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length],ax=section.rock.x+a[0],ay=section.rock.y+a[1],dx=b[0]-a[0],dy=b[1]-a[1];
  const q=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1))),px=ax+dx*q,py=ay+dy*q,dist=Math.hypot(x-px,y-py);
  if(dist<d){d=dist;best={x:px,y:py};}
 }
 return best||{x:section.x,y:section.rock.y};
}
function cancelSoloHullRepair(){if(!soloSubmarine.repair)return false;soloSubmarine.repair=null;return true;}
function repairSoloHull(){
 if(soloSubmarine.repair){if(!onlineMode)cancelSoloHullRepair();else window.AbyssalOnline?.cancelSubmarineRepair?.();return false;}
 const section=soloRepairCandidate();if(!section)return false;
 const point=soloRepairSurface(section,player.x,player.y);
 if(onlineMode&&onlineRoomMode==='coop'){
  const sent=window.AbyssalOnline?.submarineRepair?.(section.id,result=>{
   if(!result?.ok){showToast(String(result?.message||'REPARO ONLINE INDISPONÍVEL').toUpperCase());return;}
   soloSubmarine.repair={section,elapsed:0,point,startX:player.x,startY:player.y,startedAt:Number(result.startedAt)||Date.now(),endsAt:Number(result.endsAt)||Date.now()+ONLINE_HULL_REPAIR_SECONDS*1000,online:true};
   showToast('REPARO INICIADO · 15 SEGUNDOS');
  });
  return Boolean(sent);
 }
 soloSubmarine.repair={section,elapsed:0,point,startX:player.x,startY:player.y};
 player.bodyAngle=player.angle=player.weaponAngle=Math.atan2(point.y-player.y,point.x-player.x);
 return true;
}
function finishSoloHullRepair(section){
 section.hp=SOLO_HULL_HP;syncSoloHull();
 if(SOLO_CAVERN.isBlocked(section.collision,player.x,player.y,player.r+2)){
  const p=SOLO_CAVERN.resolve(arenaRocks,player.x,player.y,player.x,player.y,player.r+2);player.x=p.x;player.y=p.y;
 }
}
function updateSoloHullRepair(dt){
 const job=soloSubmarine.repair;if(!job)return false;
 if(!soloSubmarineActive()||!player||!soloSubmarine.sections.includes(job.section)||job.section.hp>=SOLO_HULL_HP||
    Math.hypot(player.x-job.startX,player.y-job.startY)>8/GAME_WORLD_ZOOM||
    !SOLO_CAVERN.isBlocked(job.section.collision,player.x,player.y,75/GAME_WORLD_ZOOM+(Number(player.r)||0))){cancelSoloHullRepair();return false;}
 const point=job.point;player.bodyAngle=player.angle=player.weaponAngle=Math.atan2(point.y-player.y,point.x-player.x);
 const repairSeconds=submarineRepairSeconds();
 if(onlineMode&&job.online){job.elapsed=Math.min(repairSeconds,Math.max(0,(Date.now()-(Number(job.startedAt)||Date.now()))/1000));return false;}
 job.elapsed=Math.min(repairSeconds,job.elapsed+Math.max(0,Number(dt)||0));
 if(job.elapsed+1e-8<repairSeconds)return false;
 soloSubmarine.repair=null;finishSoloHullRepair(job.section);return true;
}
function ensureSoloRepairButton(){let b=$('soloSubmarineRepairBtn');if(b)return b;b=document.createElement('button');b.id='soloSubmarineRepairBtn';b.type='button';b.hidden=true;b.innerHTML='<span aria-hidden="true">🔧</span><small>REPARAR</small>';b.addEventListener('click',repairSoloHull);$('petHabitBar')?.prepend(b);return b;}
window.addEventListener('keydown',e=>{if(e.code==='KeyT'&&!e.repeat&&(soloSubmarine.repair||soloRepairCandidate())&&!e.target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]')){e.preventDefault();repairSoloHull();}});
const SOLO_SUB_RANGE=650/GAME_WORLD_ZOOM;
function soloSubmarineActive(){return isClassicShooterRun()&&gameState==='playing'&&(!onlineMode||onlineRoomMode==='coop');}
function resetSoloSubmarine(){
 soloSubmarine={x:W*.5,y:H*.39,powerSeconds:0,spawnFx:1.25,weaponTimers:Object.create(null),weaponAngles:Object.create(null),sections:[],debris:[],shieldSpent:false,shieldFlashUntil:0,repair:null};
 ensureSoloHull();
}
function ensureSoloHull(){if(!SOLO_CAVERN?.submarineHull||!soloSubmarine.x)return;if(!soloSubmarine.sections.length)soloSubmarine.sections=makeSoloHullSections();syncSoloHull();}
function soloSubmarinePowered(){return isClassicShooterRun()&&(!onlineMode||onlineRoomMode==='coop')&&soloSubmarine.powerSeconds>0.01;}
function soloSubmarineTopUp(){
 if(onlineMode&&onlineRoomMode==='coop'){
  const sent=window.AbyssalOnline?.submarinePower?.(result=>{if(result?.ok){soloSubmarine.powerSeconds=Math.max(soloSubmarine.powerSeconds,Number(result.powerSeconds)||0);showToast('SUBMARINO ONLINE ENERGIZADO · '+Math.ceil(soloSubmarine.powerSeconds/60)+' MIN');}else showToast(String(result?.message||'NÃO FOI POSSÍVEL ENERGIZAR').toUpperCase());});
  return {ok:Boolean(sent),online:true};
 }
 if(!window.AbyssalSoloBase)return {ok:false,reason:'unavailable'};
 const result=window.AbyssalSoloBase.topUp(soloSubmarine.powerSeconds);
 if(result.ok){soloSubmarine.powerSeconds=result.remaining;showToast('SUBMARINO ENERGIZADO · '+Math.ceil(result.remaining/60)+' MIN');playWorldSound('ui-purchase',player,750,.8);}
 else if(result.reason==='energy')showToast('ENERGIA INSUFICIENTE');
 else if(result.reason==='full')showToast('SUBMARINO JÁ ESTÁ COM CARGA MÁXIMA');
 return result;
}
function ensureSoloSubmarineButton(){
 let button=document.getElementById('soloSubmarinePowerBtn');if(button)return button;
 button=document.createElement('button');button.id='soloSubmarinePowerBtn';button.type='button';button.className='abyss-map-interact';button.hidden=true;
 button.addEventListener('click',soloSubmarineTopUp);document.getElementById('gameShell')?.append(button);return button;
}
function updateSoloSubmarineInteraction(){
 const button=ensureSoloSubmarineButton(),repair=ensureSoloRepairButton();if(!button)return;
 const job=soloSubmarine.repair,damaged=job?.section||soloRepairCandidate();repair.hidden=!soloSubmarineActive()||!damaged;if(damaged&&!repair.hidden){const label=repair.querySelector('small'),duration=submarineRepairSeconds(),name=job?(onlineMode?'REPARANDO · ':'CANCELAR · ')+Math.ceil(Math.max(0,duration-job.elapsed))+'s':damaged.name+' '+Math.ceil(damaged.hp)+'/'+SOLO_HULL_HP;if(label.textContent!==name)label.textContent=name;repair.setAttribute('aria-label',job?(onlineMode?'Reparo em andamento '+name:'Cancelar soldagem '+name):'Reparar '+name);}
 if(!soloSubmarineActive()||!player){button.hidden=true;return;}
 const near=Math.hypot(player.x-soloSubmarine.x,player.y-soloSubmarine.y)<=390/GAME_WORLD_ZOOM;
 button.hidden=!near;if(!near)return;
 const full=onlineMode?20+10*onlineSubmarineWeapons.length:20,seconds=Math.max(0,soloSubmarine.powerSeconds),minutes=seconds/60;
 const missing=Math.max(0,300-seconds),needed=missing<=.01?0:Math.max(1,Math.ceil(full*missing/300)),wallet=onlineMode?Math.max(0,Number(window.AbyssalOnline?.getAccount?.()?.energy)||0):Math.max(0,Number(energyWallet?.get().energy)||0),cost=wallet>0?Math.min(needed,wallet):needed;
 const parent=mobileViewport?$('petHabitBar'):$('gameShell');if(parent&&button.parentElement!==parent)parent.prepend(button);
 button.classList.toggle('compact-submarine-power',mobileViewport);
 button.disabled=needed===0||wallet<=0;
 button.setAttribute('aria-label','Energizar submarino: '+cost+' energia');
 if(mobileViewport){
  if(button.dataset.displayCost!==String(cost)||!button.querySelector('.sub-power-cost')){button.replaceChildren();const icon=document.createElement('span'),label=document.createElement('small');icon.textContent='⚡';icon.setAttribute('aria-hidden','true');label.className='sub-power-cost';label.textContent=String(cost);button.append(icon,label);button.dataset.displayCost=String(cost);}
 }else{delete button.dataset.displayCost;const text='F · ENERGIZAR SUBMARINO · '+cost+'⚡ / 5 MIN · '+minutes.toFixed(1)+' MIN · '+(onlineMode?onlineSubmarineWeapons.length:(window.AbyssalSoloBase?.installedWeapons?.().length||0))+' TORRE(S) / '+(window.AbyssalSoloBase?.MAX_WEAPONS||6);if(button.textContent!==text)button.textContent=text;}
}
window.addEventListener('keydown',event=>{if(event.code==='KeyF'&&!event.repeat&&soloSubmarineActive()&&player&&Math.hypot(player.x-soloSubmarine.x,player.y-soloSubmarine.y)<=390/GAME_WORLD_ZOOM){event.preventDefault();soloSubmarineTopUp();}});
const SOLO_WEAPON_MOUNTS=Object.freeze({photon:[-105,70,Math.PI/2],electric:[105,-80,-Math.PI/2],pierce:[-188,-48,-Math.PI*.75],photonRay:[257,-24,0],nova:[-230,25,Math.PI],echoShot:[168,78,Math.PI/2]});
function soloWeaponSection(id){const x=(SOLO_WEAPON_MOUNTS[id]||SOLO_WEAPON_MOUNTS.photon)[0];return soloSubmarine.sections[x<SOLO_HULL_CUTS[1]?0:x>SOLO_HULL_CUTS[2]?2:1];}
function soloWeaponOperational(id){return (soloWeaponSection(id)?.hp||0)>0;}
function submarineMount(id){const [x,y,a]=SOLO_WEAPON_MOUNTS[id]||SOLO_WEAPON_MOUNTS.photon;return {x:soloSubmarine.x+x/GAME_WORLD_ZOOM,y:soloSubmarine.y+y/GAME_WORLD_ZOOM,a};}
function submarineMuzzle(id,angle){const m=submarineMount(id),s=1/GAME_WORLD_ZOOM,px=m.x+Math.cos(m.a)*33*s,py=m.y+Math.sin(m.a)*33*s;return {x:px+Math.cos(angle)*48*s,y:py+Math.sin(angle)*48*s,px,py};}
const soloSubmarineTargetCandidates=[];
function refreshSoloSubmarineTargetCandidates(){
 soloSubmarineTargetCandidates.length=0;
 for(const e of enemies)if(e&&e.hp>0&&!enemyHiddenFromAutoTarget(e))soloSubmarineTargetCandidates.push(e);
 return soloSubmarineTargetCandidates;
}
function soloSubmarineTarget(id,candidates=soloSubmarineTargetCandidates){
 const m=submarineMount(id),pivot=submarineMuzzle(id,m.a),rangeSq=SOLO_SUB_RANGE*SOLO_SUB_RANGE;let target=null,bestSq=rangeSq+1;
 for(const e of candidates){
  const a=Math.atan2(e.y-pivot.py,e.x-pivot.px),delta=Math.atan2(Math.sin(a-m.a),Math.cos(a-m.a));if(Math.abs(delta)>Math.PI*.60)continue;
  const muzzle=submarineMuzzle(id,a),dx=e.x-muzzle.x,dy=e.y-muzzle.y,dSq=dx*dx+dy*dy;
  if(dSq>=bestSq||dSq>rangeSq||!pveProjectileTerrainClear(muzzle.x,muzzle.y,e.x,e.y,4/GAME_WORLD_ZOOM))continue;
  bestSq=dSq;target={enemy:e,angle:a};
 }
 return target;
}
function clearSoloSubmarinePhotonRay(){for(let i=effects.length-1;i>=0;i--)if(effects[i].submarinePhotonBeam)effects.splice(i,1);}
function fireSoloSubmarineWeapon(id,target,a,dt=0){
 if(!soloWeaponOperational(id))return;const muzzle=submarineMuzzle(id,a),ox=muzzle.x,oy=muzzle.y;
 const damage=getShotDamageAtLevel(1,id);
 if(id==='photonRay'){
  const width=PHOTON_RAY_VISUAL.widths[1]/GAME_WORLD_ZOOM,interval=PHOTON_RAY_VISUAL.pulseInterval;
  const end=clipPrismaticPhotonRay(ox,oy,ox+Math.cos(a)*SOLO_SUB_RANGE,oy+Math.sin(a)*SOLO_SUB_RANGE,Math.max(1,width*.5));
  refreshPhotonBeam('submarinePhotonBeam',true,ox,oy,end.x2,end.y2,width);
  if(soloSubmarine.weaponTimers[id]>0)return;
  soloSubmarine.weaponTimers[id]=interval;
  (soloSubmarine.weaponFlash||=Object.create(null))[id]=performance.now()+120;
  for(const e of enemies){
   if(!e||e.hp<=0||!PHOTON_RAY_VISUAL.segmentCircleHit(ox,oy,end.x2,end.y2,e.x,e.y,e.r+width*.5))continue;
   dealEnemyDamage(e,damage/BASE_SHOT_INTERVAL*interval,'photonRay',{origin:muzzle,submarineShot:true});e.hit=.08;burst(e.x,e.y,'#bafaff',2,35);
  }
  return;
 }
 if(soloSubmarine.weaponTimers[id]>0)return;
 soloSubmarine.weaponTimers[id]=id==='nova'?NOVA_SOLO_INTERVAL:BASE_SHOT_INTERVAL;
 (soloSubmarine.weaponFlash||=Object.create(null))[id]=performance.now()+120;
 if(id==='nova'){
  const novaDamage=damage/BASE_SHOT_INTERVAL;
  for(const e of enemies){
   if(!e||e.hp<=0||!window.AbyssalGravityCone?.contains?.(ox,oy,a,e.x,e.y,e.r,SOLO_SUB_RANGE)||!pveProjectileTerrainClear(ox,oy,e.x,e.y,2))continue;
   dealEnemyDamage(e,novaDamage,'nova',{origin:muzzle,submarineShot:true});burst(e.x,e.y,'#72f5ff',3,70);
  }
  spawnNovaVisual(ox,oy,SOLO_SUB_RANGE,'#72f5ff',false,a,false);playSkillSound('nova','trigger');return;
 }
 const profile=baseShotProfile(id,1);
 for(const offset of profile.offsets){const angle=a+offset;projectiles.push({x:ox,y:oy,vx:Math.cos(angle)*profile.speed,vy:Math.sin(angle)*profile.speed,r:profile.radius,damage,color:profile.color,life:Math.max(1.33,SOLO_SUB_RANGE/Math.max(1,profile.speed)+.12),maxDistance:SOLO_SUB_RANGE,travelled:0,special:id,pierceRemaining:id==='pierce'?1:0,hitIds:[],submarineShot:true});}
 emitBaseShotMuzzle(muzzle,a,id,profile.color,profile.offsets.length);playWorldSound('shot-'+id,muzzle,850,.82);
}
function updateSoloSubmarine(dt){
 if(!soloSubmarineActive())return;
 soloSubmarine.spawnFx=Math.max(0,soloSubmarine.spawnFx-dt);
 for(let i=soloSubmarine.debris.length-1;i>=0;i--){const d=soloSubmarine.debris[i];d.life-=dt;if(d.life<=0){soloSubmarine.debris.splice(i,1);continue;}d.x+=d.vx*dt;d.y+=d.vy*dt;d.vy+=28*dt/GAME_WORLD_ZOOM;d.angle+=d.spin*dt;}
 if(soloSubmarine.powerSeconds<=0){clearSoloSubmarinePhotonRay();return;}
 if(!onlineMode)soloSubmarine.powerSeconds=Math.max(0,soloSubmarine.powerSeconds-dt);
 if(soloSubmarine.powerSeconds<=0){clearSoloSubmarinePhotonRay();return;}
 const shots=onlineMode?onlineSubmarineWeapons:(window.AbyssalSoloBase?.installedWeapons?.()||[]);
 if(!shots.includes('photonRay')||!soloWeaponOperational('photonRay'))clearSoloSubmarinePhotonRay();
 const candidates=refreshSoloSubmarineTargetCandidates();
 shots.forEach(id=>{if(!soloWeaponOperational(id))return;soloSubmarine.weaponTimers[id]=Math.max(0,(Number(soloSubmarine.weaponTimers[id])||0)-dt);const target=soloSubmarineTarget(id,candidates);if(!target){if(id==='photonRay')clearSoloSubmarinePhotonRay();return;}soloSubmarine.weaponAngles[id]=target.angle;fireSoloSubmarineWeapon(id,target.enemy,target.angle,dt);});
}
function drawSoloSubmarine(t){
 if(!soloSubmarineActive()&&gameState!=='paused')return;
 const x=soloSubmarine.x,y=soloSubmarine.y,powered=soloSubmarine.powerSeconds>0,shield=soloHullShieldReady(),shieldFlash=Math.max(0,(soloSubmarine.shieldFlashUntil-performance.now())/420);
 ctx.save();ctx.translate(x,y);
 if(powered){ctx.fillStyle='rgba(70,232,220,.08)';ctx.shadowColor='#65fff0';ctx.shadowBlur=26/GAME_WORLD_ZOOM;ctx.beginPath();ctx.ellipse(0,0,150/GAME_WORLD_ZOOM,78/GAME_WORLD_ZOOM,0,0,Math.PI*2);ctx.fill();}
 if(shield||shieldFlash>0){ctx.globalAlpha=shield?1:shieldFlash;ctx.strokeStyle='rgba(132,190,255,.72)';ctx.lineWidth=3/GAME_WORLD_ZOOM;ctx.shadowColor='#7ab7ff';ctx.shadowBlur=18/GAME_WORLD_ZOOM;ctx.beginPath();ctx.ellipse(0,0,305/GAME_WORLD_ZOOM,180/GAME_WORLD_ZOOM,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
 ctx.shadowBlur=0;const ss=1/GAME_WORLD_ZOOM;
 ctx.save();if(soloSubmarine.sections.some(section=>section.hp<=0)){ctx.beginPath();for(const section of soloSubmarine.sections)if(section.hp>0)ctx.rect(section.min,-150*ss,section.max-section.min,300*ss);ctx.clip();}window.AbyssalMenuScenery?.drawSubmarineModel?.(ctx,0,0,ss,powered||soloSubmarine.spawnFx>0,t);ctx.restore();
 for(const section of soloSubmarine.sections){ctx.save();ctx.beginPath();ctx.rect(section.min,-150*ss,section.max-section.min,300*ss);ctx.clip();if(section.hp>0){if(section.hp<SOLO_HULL_HP){ctx.globalAlpha=(1-section.hp/SOLO_HULL_HP)*.45;ctx.fillStyle='#4c1917';ctx.beginPath();section.rock.vertices.forEach(([px,py],i)=>i?ctx.lineTo(px+section.x-x,py):ctx.moveTo(px+section.x-x,py));ctx.closePath();ctx.fill();}}else{const r=section.rock;ctx.translate(r.x-x,r.y-y);ctx.strokeStyle='#64777c';ctx.lineWidth=3*ss;ctx.fillStyle='rgba(13,24,29,.55)';ctx.beginPath();r.vertices.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#a16d45';ctx.lineWidth=2*ss;for(let i=0;i<4;i++){const px=(i-1.5)*r.rx*.42;ctx.beginPath();ctx.moveTo(px,-r.ry*.72);ctx.lineTo(px+12*ss,-12*ss);ctx.lineTo(px-8*ss,r.ry*.65);ctx.stroke();}}ctx.restore();const bx=section.x-x-52*ss,by=-118*ss;ctx.save();ctx.globalAlpha=.4;ctx.fillStyle='#07131b';ctx.fillRect(bx,by,104*ss,10*ss);ctx.fillStyle='#39ff14';ctx.shadowColor='#39ff14';ctx.shadowBlur=lowPowerRendering?0:12*ss;ctx.fillRect(bx,by,104*ss*section.hp/SOLO_HULL_HP,10*ss);ctx.shadowBlur=0;ctx.strokeStyle='#83ff72';ctx.lineWidth=ss;ctx.strokeRect(bx,by,104*ss,10*ss);ctx.restore();ctx.fillStyle='#e2f5f5';ctx.font='bold '+10*ss+'px sans-serif';ctx.textAlign='center';ctx.fillText(section.name+' '+Math.ceil(section.hp)+'/'+SOLO_HULL_HP,section.x-x,by-5*ss);}
 for(const d of soloSubmarine.debris){ctx.save();ctx.translate(d.x-x,d.y-y);ctx.rotate(d.angle);ctx.globalAlpha=Math.min(1,d.life);ctx.fillStyle='#a17c39';ctx.strokeStyle='#253238';ctx.lineWidth=2*ss;ctx.beginPath();ctx.moveTo(-d.size,-d.size*.35);ctx.lineTo(d.size*.8,-d.size*.6);ctx.lineTo(d.size,d.size*.4);ctx.lineTo(-d.size*.45,d.size*.7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
 // Ballast vents release small rising bubbles even with weapons offline.
 ctx.save();const bs=1/GAME_WORLD_ZOOM;for(let i=0;i<24;i++){const life=((t*.00042+i*.173)%1+1)%1,side=i%2?-1:1,px=(side*(185+(i%4)*12)+Math.sin(t*.0015+i*2.4)*9*life)*bs,py=(-17-life*104+(i%3)*5)*bs;ctx.globalAlpha=(1-life)*.65;ctx.strokeStyle='#bdeef3';ctx.lineWidth=.8*bs;ctx.beginPath();ctx.arc(px,py,(1.3+(i%4)*.65)*bs,0,Math.PI*2);ctx.stroke();}ctx.restore();
 const installed=onlineMode?onlineSubmarineWeapons:(window.AbyssalSoloBase?.installedWeapons?.()||[]);
 // Empty mechanical sockets are visible but cannot fire until a tower is researched.
 for(const id of Object.keys(SOLO_WEAPON_MOUNTS)){if(installed.includes(id)||!soloWeaponOperational(id))continue;const m=submarineMount(id);ctx.save();ctx.translate(m.x-x,m.y-y);ctx.rotate(m.a);ctx.scale(1/GAME_WORLD_ZOOM,1/GAME_WORLD_ZOOM);ctx.fillStyle='#26383d';ctx.strokeStyle='#9aaca6';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-6,-15,12,30,3);ctx.fill();ctx.stroke();ctx.fillStyle='#111d24';ctx.fillRect(0,-8,5,16);ctx.restore();}
 for(const id of installed){if(!soloWeaponOperational(id))continue;const m=submarineMount(id),angle=soloSubmarine.weaponAngles?.[id]??m.a,s=1/GAME_WORLD_ZOOM,color=id==='photonRay'?PHOTON_RAY_VISUAL.color:id==='nova'?'#72f5ff':baseShotProfile(id,1).color;
  ctx.save();ctx.translate(m.x-x,m.y-y);ctx.scale(s,s);ctx.rotate(m.a);ctx.fillStyle='#17252b';ctx.strokeStyle='#788c91';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(-8,-19,17,38,4);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#293940';ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(18,-5);ctx.lineTo(33,0);ctx.stroke();
  ctx.strokeStyle='#98a6a7';ctx.lineWidth=3;ctx.stroke();
  for(const px of [0,18,33]){ctx.fillStyle='#263a40';ctx.beginPath();ctx.arc(px,px===18?-5:0,8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a7b7b3';ctx.lineWidth=2;ctx.stroke();}
  ctx.translate(33,0);ctx.rotate(angle-m.a);const metal=ctx.createLinearGradient(0,-12,0,12);metal.addColorStop(0,'#a0b2b5');metal.addColorStop(.4,'#43565e');metal.addColorStop(1,'#14232c');ctx.fillStyle=metal;ctx.strokeStyle='#0b151b';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(-13,-12,31,24,4);ctx.fill();ctx.stroke();ctx.fillRect(14,-6,29,12);ctx.strokeRect(14,-6,29,12);ctx.fillStyle='#263b43';ctx.fillRect(39,-9,9,18);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=powered?10:0;ctx.fillRect(3,-3,12,6);ctx.fillRect(46,-4,2,8);ctx.shadowBlur=0;if(powered&&performance.now()<(soloSubmarine.weaponFlash?.[id]||0)){ctx.fillStyle=color;ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(48,-7);ctx.lineTo(68,0);ctx.lineTo(48,7);ctx.closePath();ctx.fill();}ctx.restore();
 }
 // Shared hull.
 ctx.restore();
 if(soloSubmarine.spawnFx>0&&player&&player.y>=soloSubmarine.y+80/GAME_WORLD_ZOOM){for(let i=0;i<42;i++){const phase=t*.002+i*1.7,life=soloSubmarine.spawnFx/2.2,q=i/41,px=soloSubmarine.x+(player.x-soloSubmarine.x)*q+Math.sin(phase)*(.4+q)*23/GAME_WORLD_ZOOM,py=soloSubmarine.y+86/GAME_WORLD_ZOOM+(player.y-soloSubmarine.y-86/GAME_WORLD_ZOOM)*q-(1-life)*q*32/GAME_WORLD_ZOOM;ctx.save();ctx.globalAlpha=Math.min(1,life);ctx.strokeStyle='#d7ffff';ctx.lineWidth=1/GAME_WORLD_ZOOM;ctx.beginPath();ctx.arc(px,py,(2+i%3)/GAME_WORLD_ZOOM,0,Math.PI*2);ctx.stroke();ctx.restore();}}
}

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
function setHudCollapsed(collapsed){hudCollapsed=Boolean(collapsed);document.body.classList.toggle('hud-collapsed',hudCollapsed);const button=$('toggleHudBtn');if(button){button.textContent=hudCollapsed?'‹':'›';button.setAttribute('aria-label',hudCollapsed?'Mostrar interface':'Ocultar interface');button.title=hudCollapsed?'Mostrar interface':'Ocultar interface';}}
$('toggleHudBtn')?.addEventListener('click',()=>setHudCollapsed(!hudCollapsed));
let pendingSkinPush=null;
window.addEventListener('abyssal-player-suction-pull',event=>{
 if(!onlineMode||!player)return;
 const d=event.detail||{},dx=Number(d.dx)||0,dy=Number(d.dy)||0;
 if(!dx&&!dy)return;
 if(d.bossId==='skin-push'){
  pendingSkinPush={dx,dy,duration:Math.max(.15,(Number(d.durationMs)||320)/1000),elapsed:0,applied:0};
  return;
 }
 const moved=mapResolveMove(player.x,player.y,clamp(player.x+dx,player.r,W-player.r),clamp(player.y+dy,player.r,H-player.r),player.r+8/GAME_WORLD_ZOOM);
 player.x=moved.x;player.y=moved.y;updateCamera();
});
function updateSmoothSkinPush(dt){
 if(!pendingSkinPush||!player)return;
 const push=pendingSkinPush;
 push.elapsed=Math.min(push.duration,push.elapsed+Math.max(0,dt));
 const t=push.elapsed/push.duration;
 const eased=1-Math.pow(1-t,3);
 const inc=eased-push.applied;push.applied=eased;
 const moved=mapResolveMove(player.x,player.y,
  clamp(player.x+push.dx*inc,player.r,W-player.r),
  clamp(player.y+push.dy*inc,player.r,H-player.r),player.r+8/GAME_WORLD_ZOOM);
 player.x=moved.x;player.y=moved.y;updateCamera();
 if(t>=1)pendingSkinPush=null;
}
let lastShot=0,lastHit=0,toastTimer=null;
const bestTimeEl=$('bestTime'),bestScoreEl=$('bestScore');if(bestTimeEl)bestTimeEl.textContent=fmtTime(bestTime);if(bestScoreEl)bestScoreEl.textContent=bestScore.toLocaleString('pt-BR');

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
  // Inbox messages are silent; the unread indicator is the only alert.
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
  const cockpit=document.querySelector('[data-cockpit-proxy="notifBtn"]');if(cockpit){cockpit.classList.toggle('has-unread',hasUnread);const indicator=cockpit.querySelector('.cockpit-unread-dot');if(indicator)indicator.hidden=!hasUnread;cockpit.setAttribute('aria-label',hasUnread?'Avisos: novos itens não lidos':'Avisos');}
  btn.setAttribute(
    'aria-label',
    hasUnread ? 'Abrir notificações — há itens não lidos' : 'Abrir notificações'
  );
}

window.addNotification = addNotification;
window.updateNotifBadge = updateNotifBadge;
window.openAbyssalNotifications = openNotifPanel;
function receiveAnnouncement(item){
 if(!item||typeof item.id!=='string'||typeof item.message!=='string')return;
 try{
  const key='abyssalAnnouncementReceipts',now=Date.now();
  const stored=JSON.parse(localStorage.getItem(key)||'{}'),seen=stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{};
  if(seen[item.id]||getStoredNotifications().some(n=>n.announcementId===item.id))return;
  const timestamp=Number(item.timestamp)||now;if(now-timestamp>=NOTIF_EXPIRY_MS)return;
  const list=getStoredNotifications();
  list.unshift({id:'announcement-'+item.id,announcementId:item.id,title:String(item.title||'COMUNICADO DO ABYSSAL'),message:item.message,type:'announcement',timestamp:now});
  saveNotifications(list.slice(0,30));
  for(const id of Object.keys(seen))if(now-Number(seen[id])>=NOTIF_EXPIRY_MS)delete seen[id];
  seen[item.id]=now;localStorage.setItem(key,JSON.stringify(seen));
  if(document.getElementById('notifPanel')&&!document.getElementById('notifPanel').hidden)renderNotifPanel();
 }catch(_){}
}
window.addEventListener('abyssal-announcement',event=>receiveAnnouncement(event.detail));
function refreshAnnouncements(){fetch((window.ABYSSAL_SERVER_URL||location.origin)+'/api/announcements',{cache:'no-store'}).then(response=>response.ok?response.json():[]).then(items=>{if(Array.isArray(items))items.slice().reverse().forEach(receiveAnnouncement);}).catch(()=>{});}
refreshAnnouncements();window.addEventListener('online',refreshAnnouncements);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAnnouncements();});

function showNotification(message, title = 'NOTIFICAÇÃO ABISSAL') {
  addNotification(message, title);
  updateNotifBadge();
}


updateNotifBadge();
// Zoom is centered on the diver. Olho Profundo increases visible world area
// and real projectile range while leaving the canvas and HUD unchanged.
const FAIR_VIEW_REFERENCE=Object.freeze({width:1366,height:768,zoom:.78});
const FAIR_VIEW_WORLD_AREA=(FAIR_VIEW_REFERENCE.width*FAIR_VIEW_REFERENCE.height)/(FAIR_VIEW_REFERENCE.zoom*FAIR_VIEW_REFERENCE.zoom);
const CAMERA_RANGE_MAX=Math.pow(1.22,3);
let cameraZoomTickAt=0;
function desiredWorldZoom(){
 const base=mobileViewport?.48:FAIR_VIEW_REFERENCE.zoom;
 // Fusing Olho do Abismo consumes range upgrades, but preserves full sight.
 const bonus=upgrades?.abyssEye?CAMERA_RANGE_MAX:Number(upgrades?.range)||1;
 const mobile=Boolean(mobileViewport);const zoomPreference=onlineRoomMode==='pvp'&&onlineMode?1:clamp(Number(localStorage.getItem(mobile?'abyssalCameraZoomMobile':'abyssalCameraZoomPc'))||(mobile?1:1.25),.75,1.5);
 return base*zoomPreference/clamp(bonus,1,CAMERA_RANGE_MAX);
}
function desiredMapFactor(){return 1.7;}
function updateCamera(){
 const now=performance.now();
 if(gameState==='playing'||(onlineMode&&gameState==='upgrade')){
  const target=desiredWorldZoom();
  const dt=cameraZoomTickAt?clamp((now-cameraZoomTickAt)/1000,0,.10):0;
  worldZoom+=(target-worldZoom)*(1-Math.exp(-dt*11));
  if(Math.abs(target-worldZoom)<.0001)worldZoom=target;
 }
 cameraZoomTickAt=now;
 if(!player){cameraX=0;cameraY=0;return;}
 const visibleWorldW=viewW/worldZoom,visibleWorldH=viewH/worldZoom;
 const focusX=player.x,focusY=player.y;
 cameraX=clamp(focusX-visibleWorldW*.5,0,Math.max(0,W-visibleWorldW));
 cameraY=clamp(focusY-visibleWorldH*.5,isOpenSeaRun()?-Math.min(240,visibleWorldH*.32):0,Math.max(0,H-visibleWorldH));
}
function resize(){
 const r=$('gameShell').getBoundingClientRect();
 const oldW=W,oldH=H;
 viewW=Math.max(320,r.width);viewH=Math.max(300,r.height);
 mobileViewport=window.matchMedia('(pointer: coarse)').matches||window.innerWidth<=700;
 lowPowerRendering=adaptiveQualityLevel===0;
 dpr=graphicsDpr();
 worldZoom=desiredWorldZoom();mapFactor=desiredMapFactor();
 W=Number(activeMapLayout?.width)||defaultWidth();H=Number(activeMapLayout?.height)||defaultHeight();mapFactor=1.7;
 // World coordinates never scale when the viewport rotates or resizes.
 const sx=1,sy=1;
 if(player){player.x*=sx;player.y*=sy;player.r=13/GAME_WORLD_ZOOM;player.moveSpeed=150/GAME_WORLD_ZOOM;player.x=clamp(player.x,24/GAME_WORLD_ZOOM,W-24/GAME_WORLD_ZOOM);player.y=clamp(player.y,24/GAME_WORLD_ZOOM,H-24/GAME_WORLD_ZOOM);}
 for(const list of [enemies,orbs,particles,projectiles])for(const o of list){if(Number.isFinite(o.x))o.x*=sx;if(Number.isFinite(o.y))o.y*=sy;if(Number.isFinite(o.x1))o.x1*=sx;if(Number.isFinite(o.x2))o.x2*=sx;if(Number.isFinite(o.y1))o.y1*=sy;if(Number.isFinite(o.y2))o.y2*=sy;if(Number.isFinite(o.interpFromX))o.interpFromX*=sx;if(Number.isFinite(o.interpFromY))o.interpFromY*=sy;if(Number.isFinite(o.interpTargetX))o.interpTargetX*=sx;if(Number.isFinite(o.interpTargetY))o.interpTargetY*=sy;}
 for(const o of effects){if(Number.isFinite(o.x))o.x*=sx;if(Number.isFinite(o.y))o.y*=sy;if(Number.isFinite(o.x1))o.x1*=sx;if(Number.isFinite(o.x2))o.x2*=sx;if(Number.isFinite(o.y1))o.y1*=sy;if(Number.isFinite(o.y2))o.y2*=sy;}
 const pixelWidth=Math.floor(viewW*dpr),pixelHeight=Math.floor(viewH*dpr);if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
 if(canvas.style.width!==viewW+'px')canvas.style.width=viewW+'px';if(canvas.style.height!==viewH+'px')canvas.style.height=viewH+'px';
 // Maintain antialiased silhouettes when cached skins rotate.
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 backgroundGradientCache=null;backgroundBloomCache=null;
 ctx.setTransform(dpr*worldZoom,0,0,dpr*worldZoom,0,0);
 if(!decor.length||oldW!==W||oldH!==H){createDecor();createArenaRocks();}updateCamera();
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
 // Exploration uses natural geology. Classic Solo/Online and PvP use arena stones.
 if(usesNaturalOceanTerrain()||isRiftRun())return;
 // Solo no longer uses the old perimeter art; its solid shelves are the whole arena.
 if(isClassicShooterRun()&&onlineRoomMode!=='pvp'&&SOLO_CAVERN){arenaRocks=SOLO_CAVERN.buildRocks(W,H);ensureSoloHull();return;}
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
 // Restore the physical arena edge landmarks for the classic 4800x3000 shooter.
 // Visual-only perimeter stones mark the four boundaries without impeding gameplay.
 const spacing=95/worldZoom,offset=24/worldZoom;
 const addBoundary=(x,y,edge,index)=>{
  const seed=Math.sin(index*127.1+edge.length*311.7)*43758.5453;
  const fraction=seed-Math.floor(seed),radius=(17+fraction*20)/worldZoom;
  const vertices=[],n=8;
  for(let j=0;j<n;j++){
   const a=j/n*Math.PI*2,noise=.72+.4*(.5+.5*Math.sin(index*7+j*11));
   vertices.push([Math.cos(a)*radius*noise,Math.sin(a)*radius*noise]);
  }
  arenaRocks.push({x,y,r:radius,edge,vertices,shade:fraction,visualOnly:true});
 };
 let index=0;
 for(let x=offset;x<W;x+=spacing){addBoundary(x,24/worldZoom,'top',index++);addBoundary(x,H-24/worldZoom,'bottom',index++);}
 for(let y=offset;y<H;y+=spacing){addBoundary(24/worldZoom,y,'left',index++);addBoundary(W-24/worldZoom,y,'right',index++);}
 for(const [x,y] of [[offset,offset],[W-offset,offset],[offset,H-offset],[W-offset,H-offset]])addBoundary(x,y,'corner',index++);

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
    list.innerHTML = '<div class="notif-empty"><span class="notif-empty-icon">🔔</span>Nenhuma notificação no momento.<br>Recompensas, títulos e de energia aparecem aqui.</div>';
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
  if(window.AbyssalCockpitNavigation?.routeScreen?.('notifPanel'))return;
  renderNotifPanel();
  panel.hidden = false;
  if(!window.AbyssalCockpitNavigation?.isEmbedded?.('notifPanel'))document.body.style.overflow = 'hidden';
  // Marcar como lidas apenas ao abrir a caixa, removendo o ponto vermelho do sino.
  try { localStorage.setItem('abyssalNotificationsLastSeen', String(Date.now())); } catch(e) {}
  updateNotifBadge();
}

function closeNotifPanel() {
  var panel = document.getElementById('notifPanel');
  if (!panel) return;
  if(window.AbyssalCockpitNavigation?.isEmbedded?.('notifPanel')){window.AbyssalCockpitNavigation.back();return;}
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
      if (e.target === panel&&!window.AbyssalCockpitNavigation?.isEmbedded?.('notifPanel')) closeNotifPanel();
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

// Sound synthesis and handlers removed. Legacy gameplay cue hooks are inert.
let lastDamageWarningAt=0,lastContactNoticeAt=0;
function audio(){}
function playWorldSound(){return false;}
function playSkillSound(){}
function playBossCry(){}
function playDevourerSuction(){}
function startAmbientMusic(){}
function updateAbyssalMusic(){}

// === SISTEMA DE ALERTAS ABISSAIS (vermelho, ameaçador, fade sólido) ===
let abyssalAlertTimer = null;
function getBossDisplayName(kind) {
  const n = {
    boss: 'POLVO-DE-ANÉIS-AZUIS COLOSSAL', leviathan: 'PEIXE-REMO LEVIATÃ', maw: 'ENGUIA-PELÍCANO COLOSSAL',
    angler: 'PEIXE-PESCADOR ABISSAL', kraken: 'LULA-KRAKEN DAS FOSSAS', devourer: 'LULA-COLOSSAL DO VAZIO',
    whiteSharkBoss: 'TUBARÃO-BRANCO COLOSSAL', whiteShark: 'TUBARÃO-BRANCO', riftSmile: 'PESADELO ROXO'
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
 const allowed=new Set(['boss','join','leave']);if(!allowed.has(kind))return;
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
 if(kicker)kicker.textContent=item.kind==='boss'?'SINAL DE PRESSÃO · CONTATO DESCONHECIDO':item.kind==='join'?'SINAL DE MERGULHADOR · CONEXÃO ESTABELECIDA':'SINAL DE MERGULHADOR · CONEXÃO ENCERRADA';
 if(title)title.textContent=item.title;if(copy)copy.textContent=item.text;
 el.hidden=false;el.classList.remove('boss-alert-enter','gameplay-notice-5s');void el.offsetWidth;el.classList.add('gameplay-notice-5s');
 clearTimeout(bossAlertTimer);bossAlertTimer=setTimeout(()=>{el.hidden=true;el.classList.remove('gameplay-notice-5s');el.dataset.noticeKind='';gameplayNoticeActive=false;pumpGameplayNotice();},5000);
}
function showToast(_message){/* Ordinary feedback stays in the relevant panel or notification inbox, never a floating toast. */}
window.addEventListener('abyssal-cave-signal',event=>{const d=event.detail||{};enqueueGameplayNotice('cave',String(d.name||'ECO LATERAL'),String(d.subtitle||d.reward||'Uma anomalia respondeu à sua presença.'),72);});
function renderBossAbilityVisual(data){
 const d=data||{};
 if(RIFT_HARDCORE&&String(d.abilityId||'').startsWith('rift-tentacle-')){
  const now=performance.now(),id=String(d.attackId||'');
  const delay=Math.max(0,Math.min(3000,(Number(d.hitAt)||0)-(Number(d.serverTime)||0)));
  const mark={id,x:Number(d.x)*W,y:Number(d.y)*H,shape:String(d.shape||'circle'),angle:Number(d.angle)||0,radius:Number(d.radius)||105,length:Number(d.length)||0,issuedAt:now,hitAt:now+delay,damage:Number(d.damage)||0};
  if(String(d.abilityId).endsWith('warning')){if(!riftBossMarks.some(m=>m.id===id))riftBossMarks.push(mark);playWorldSound('hazard-tentacle-warning',mark,1100,.78);}
  else {playWorldSound('hazard-tentacle-active',mark,1100,1);const existing=riftBossMarks.find(m=>m.id===id);if(existing)existing.impactUntil=now+410;else riftBossMarks.push({...mark,hitAt:now,impactUntil:now+410});burst(mark.x,mark.y,'#a66cff',22,150);}
  return;
 }
 const x=Number(d.x),y=Number(d.y);if(!Number.isFinite(x)||!Number.isFinite(y))return;
 const color=d.color||'#79f3f0',angle=Number(d.angle)||0,radius=Math.max(40/GAME_WORLD_ZOOM,Number(d.radius)||180/GAME_WORLD_ZOOM),id=String(d.abilityId||'');
 if(id.startsWith('wildlife-')){
  const active=id.slice(9);
  ctx.save();
  if(active==='cloud'||active==='poison'){
   spawnPoisonPlantCloudVisual(x,y,radius*.9,active==='poison'?'#a979ee':'#7dff73');
  }else if(active==='paralysis'){
   for(let i=0;i<7;i++){const a=i*2.4+performance.now()*.0009;
    queueEffect({type:'beam',x1:x,y1:y,x2:x+Math.cos(a)*radius*.72,y2:y+Math.sin(a)*radius*.72,
     life:.34,maxLife:.34,color:i%2?'#eefcff':'#51eaff',width:3/GAME_WORLD_ZOOM});}
   burst(x,y,'#78edff',10,90);
  }else if(active==='trail'){
   for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=radius*.5;
    queueEffect({type:'ring',x:x+Math.cos(a)*rr,y:y+Math.sin(a)*rr,r:4,max:radius*.27,life:.35,maxLife:.35,color});}
  }else if(active==='dash'){
   for(const d of [-1,1])queueEffect({type:'beam',x1:x,y1:y+d*radius*.22,
    x2:x+Math.cos(angle)*radius,y2:y+Math.sin(angle)*radius+d*radius*.15,
    life:.35,maxLife:.35,color:'#66dfff',width:4/GAME_WORLD_ZOOM});
  }else{
   queueEffect({type:'ring',x,y,r:0,max:radius,life:.45,maxLife:.45,color});
   burst(x,y,color,8,85);
  }
  ctx.restore();return;
 }
 const bossKind=String(d.kind||activeBossEntity?.kind||'boss');
 const cue=window.AbyssalWorldAudio?.PATTERNS?.['boss-attack-'+bossKind]?'boss-attack-'+bossKind:'boss-attack-boss';
 playWorldSound(cue,{x,y},1000,.82);
 if(id==='toxic-cloud'||id==='monster-toxic-cloud'){
  spawnPoisonPlantCloudVisual(x,y,radius,color||'#7dff73');
  return;
 }
 if(id==='ink-trail'){
  inkTrails.push({x,y,r:radius,life:3.4,maxLife:3.4,damageTimer:.45,remote:true,boss:true});if(inkTrails.length>260)inkTrails.splice(0,inkTrails.length-260);
  burst(x,y,'#07101d',8,45);
 }else if(id==='gulper-chomp'){
  queueEffect({type:'ring',x,y,r:0,max:radius,life:.62,maxLife:.62,color:'#d67cff'});
  queueEffect({type:'ring',x,y,r:0,max:radius*.82,life:.46,maxLife:.46,color:'#ff58cb'});
  queueEffect({type:'ring',x,y,r:radius*.72,max:radius*.3,life:.34,maxLife:.34,color:'#8ffcff'});
  for(let i=-5;i<=5;i++){const a=angle+i*.14;queueEffect({type:'beam',x1:x,y1:y,x2:x+Math.cos(a)*radius*.9,y2:y+Math.sin(a)*radius*.9,life:.32,maxLife:.32,color:i%2?'#f0a2ff':'#ff62cf',width:3.4/GAME_WORLD_ZOOM});}
  burst(x,y,'#c16cff',46,230);burst(x,y,'#ff62cf',18,135);
 }else if(id==='pressure-lance'){
  const reach=radius,nx=Math.cos(angle+Math.PI/2),ny=Math.sin(angle+Math.PI/2);
  for(const offset of [-28,0,28])queueEffect({type:'beam',x1:x+nx*offset/GAME_WORLD_ZOOM,y1:y+ny*offset/GAME_WORLD_ZOOM,x2:x+Math.cos(angle)*reach+nx*offset/GAME_WORLD_ZOOM,y2:y+Math.sin(angle)*reach+ny*offset/GAME_WORLD_ZOOM,life:.58,maxLife:.58,color:offset===0?'#efffff':offset<0?'#6fffe7':'#ff5578',width:(offset===0?7:4)/GAME_WORLD_ZOOM});
  queueEffect({type:'ring',x:x+Math.cos(angle)*reach,y:y+Math.sin(angle)*reach,r:0,max:68/GAME_WORLD_ZOOM,life:.45,maxLife:.45,color:'#6fffe7'});
  burst(x+Math.cos(angle)*reach*.72,y+Math.sin(angle)*reach*.72,'#4ce0d1',38,240);
 }else{
  queueEffect({type:'ring',x,y,r:0,max:radius,life:.45,maxLife:.45,color});burst(x,y,color,18,130);
 }
}
function renderHostileContactAbility(data){
 const d=data||{},kind=String(d.enemyKind||d.kind||''),skill=String(d.skillId||''),x=Number(d.enemyX??d.x),y=Number(d.enemyY??d.y),color=d.enemyColor||d.color||'#ff668d';
 if(!Number.isFinite(x)||!Number.isFinite(y))return;
 playWorldSound('enemy-attack-'+kind,{x,y},700,.73);
 const px=Number.isFinite(Number(d.playerX))?Number(d.playerX):Number(player?.x)||x,py=Number.isFinite(Number(d.playerY))?Number(d.playerY):Number(player?.y)||y;
 if(skill!=='tentacle-strike'){
  const enemy=d.enemy||(d.enemyId!=null?enemies.find(e=>String(e.id)===String(d.enemyId)):null);
  const angle=Math.atan2(py-y,px-x);
  if(enemy)enemy.hostileBite={startedAt:performance.now(),duration:480,angle};
  queueEffect({type:'bite-jaws',x:px,y:py,angle,max:Math.max(21/GAME_WORLD_ZOOM,Math.min(48/GAME_WORLD_ZOOM,(Number(d.enemyRadius)||player?.r||20)*.85)),life:.48,maxLife:.48,color:'#ffddd4'});
 }
 const radius=Math.max(34/GAME_WORLD_ZOOM,Number(d.enemyRadius)||42/GAME_WORLD_ZOOM);
 if(skill==='tentacle-strike'){
  queueEffect({type:'tentacle-strike',x1:x,y1:y,x2:px,y2:py,life:.32,maxLife:.32,color,width:Math.max(3,Number(d.enemyRadius)*.16||5)});
 }else if(skill==='bio-shock'||kind==='drifter'){
  queueEffect({type:'ring',x,y,r:0,max:radius*2.1,life:.48,maxLife:.48,color:'#74f7ff'});
  for(let i=0;i<6;i++){const a=i*Math.PI/3;queueEffect({type:'beam',x1:x,y1:y,x2:x+Math.cos(a)*radius*1.65,y2:y+Math.sin(a)*radius*1.65,life:.3,maxLife:.3,color:i%2?'#ff7caf':'#74f7ff',width:2.6/GAME_WORLD_ZOOM});}
  burst(x,y,'#74f7ff',18,105);
 }else if(skill==='venom-spine'||kind==='stinger'){
  const a=Number(d.angle)||0;for(let i=-2;i<=2;i++){const q=a+i*.16;queueEffect({type:'beam',x1:x-Math.cos(q)*radius*.4,y1:y-Math.sin(q)*radius*.4,x2:x+Math.cos(q)*radius*2.0,y2:y+Math.sin(q)*radius*2.0,life:.32,maxLife:.32,color:i===0?'#fff0a4':'#ff8d58',width:(i===0?4:2.4)/GAME_WORLD_ZOOM});}
  burst(x,y,'#ff9a55',16,120);
 }else if(skill==='crusher-claw'||kind==='brute'){
  queueEffect({type:'ring',x,y,r:0,max:radius*1.85,life:.52,maxLife:.52,color:'#bd88ff'});
  queueEffect({type:'ring',x,y,r:0,max:radius*1.25,life:.34,maxLife:.34,color:'#f1d6ff'});
  burst(x,y,'#bd88ff',24,135);
 }else if(skill==='gulper-bite'||kind==='lurker'){
  queueEffect({type:'ring',x,y,r:0,max:radius*1.95,life:.44,maxLife:.44,color:'#6e8dff'});
  for(let i=-3;i<=3;i++){const q=(Number(d.angle)||0)+i*.16;queueEffect({type:'beam',x1:x,y1:y,x2:x+Math.cos(q)*radius*1.65,y2:y+Math.sin(q)*radius*1.65,life:.26,maxLife:.26,color:'#9caeff',width:2.8/GAME_WORLD_ZOOM});}
  burst(x,y,'#6e8dff',20,125);
 }else{queueEffect({type:'ring',x,y,r:0,max:radius*1.5,life:.35,maxLife:.35,color});}
}
function showBossAlert(kind,id=null,threat=0,force=false){
 if(onlineMode&&onlineRoomMode==='pvp')return;
 const key=id==null?`${kind}:${Math.floor(performance.now()/1000)}`:`${kind}:${String(id)}`;
 if(!force&&alertedBossIds.has(key))return;alertedBossIds.add(key);if(alertedBossIds.size>64)alertedBossIds=new Set([...alertedBossIds].slice(-32));
 const names={
  boss:['☠ POLVO-DE-ANÉIS-AZUIS COLOSSAL','A TINTA NEGRA ESTÁ COBRINDO A ROTA. NÃO ATRAVESSE O RASTRO.'],
  leviathan:['☠ PEIXE-REMO LEVIATÃ','UM CORPO PELÁGICO COLOSSAL CORTA A FOSSA. A PRESSÃO MUDA COM CADA CURVA.'],
  maw:['☠ ENGUIA-PELÍCANO COLOSSAL','A GARGANTA SE EXPANDEU. O ECO DESAPARECE DENTRO DELA.'],
  angler:['☠ PEIXE-PESCADOR ABISSAL','A BOCA ESTÁ ABERTA. QUANDO O CORPO SUMIR, SÓ A ISCA CONTINUARÁ BRILHANDO.'],
  kraken:['☠ LULA-KRAKEN DAS FOSSAS','OITO BRAÇOS VARREM A CÂMARA EM ESPIRAL. NÃO FIQUE ENTRE AS VENTOSAS.'],
  riftSmile:['☠ PESADELO ROXO','A FOSSA RESPIRA ATRÁS DELE. SEUS TENTÁCULOS PERSEGUEM CADA MOVIMENTO.'],
  devourer:['☠ LULA-COLOSSAL DO VAZIO','O MANTO CONTRAIU. A CORRENTE INVERTEU E TUDO ESTÁ SENDO PUXADO.'],
  whiteSharkBoss:['☠ TUBARÃO-BRANCO COLOSSAL','O ÁPICE PREDATÓRIO EMERGIU. VELOCIDADE LETAL. FUJA OU MORRA.']
 };

 const [title,copy]=names[kind]||['☠ PRESENÇA COLOSSAL','UMA FORMA IMPOSSÍVEL SE MOVE NA ESCURIDÃO.'];
 enqueueGameplayNotice('boss',title,copy,100);
 shake=Math.max(shake,10);playBossCry(kind);
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
  if (!isClassicShooterRun()) { track.style.display = 'none'; return; }
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
  if (gameState !== 'playing'||!isClassicShooterRun()) return;

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

  if(tierDescentPending){updateProgressionTrackUI();return;}

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
  // The classic shooter arena has no tier portal. Requiring a descent here
  // permanently blocks the next solo boss after the first victory.
  tierDescentPending = isRiftRun();
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
  if (!onlineMode && bossProgressionCycle === 0) {
    if (window.AbyssalOnline?.isAuthenticated?.() && window.AbyssalOnline?.claimFirstProgressionBonus) {
      window.AbyssalOnline.claimFirstProgressionBonus({score,level,bossesKilled:Math.max(7,bossKillsThisRun)}, result=>{
        if(result?.awarded) window.dispatchEvent(new CustomEvent('abyssal-first-progression-reward',{detail:result}));
        else if(result?.ok===false) showToast(result.message||'Não foi possível confirmar a recompensa.');
      });
    } else addNotification('Entre em sua conta para resgatar o bônus único de 5.000 de energia da primeira progressão completa.','CONQUISTA DE PROGRESSÃO','cycle');
  }
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
    addNotification('Parabéns, desbravador! Pelo seu feito supremo no abismo, você conquistou a lendária skin "Moréia Esmeralda Colossal"!', 'NOVO ESPÉCIME LENDÁRIA OBTIDA', 'skin');
  }

  // Notificar servidor se estiver online ou autenticado
  if (window.AbyssalOnline?.saveCosmetics) {
    window.AbyssalOnline.sendRunProgress?.({score,level,bossesKilled:Math.max(42,bossKillsThisRun)});
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
          <div style="font-size:15px;font-weight:800;color:#2ee88a;">Moréia Esmeralda Colossal</div>
          <p style="font-size:12px;color:#a0dac3;margin-top:4px;line-height:1.4;">Inspirada em moréias oceânicas de corpo sinuoso, mandíbula faríngea e muco bioluminescente corrosivo.</p>
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

let diveEnergySkinId='default';
let soloRunIdentity=null;
function diveEnergyCalculation(){const base=Math.floor(Math.min(50000,Math.max(5,Math.floor(score/35)+(Number(level)||0)*2))/10),specimenBonus=SkinAbilities?.endDiveEnergyBonus?.(diveEnergySkinId)||0,bonus=Math.floor(diveStats.energyCollected*specimenBonus);return {earned:base+bonus,energyBonus:bonus,energyBonusPercent:Math.round(specimenBonus*100),specimenEnergyBonusPercent:Math.round(specimenBonus*100),totalRunCoins:base+bonus+bossKillsThisRun*10};}
let diveReport=null,diveStats={damageDealt:0,monstersKilled:0,energyCollected:0},diveSettling=false,diveSettled=false,diveEndReason='death';
function startGame(resumingDeploy=false){
 soloRunIdentity=onlineMode?null:{id:'solo-'+(globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2)),key:adaptationAccountKey()};
 diveEnergySkinId=equippedSkin;soloAdaptationRun=globalThis.crypto?.randomUUID?.()||('solo-'+Date.now()+'-'+Math.random().toString(36).slice(2));diveReport=null;diveStats={damageDealt:0,monstersKilled:0,energyCollected:0};diveSettling=false;diveSettled=false;diveEndReason='death';
 // A previous PvP session cannot leak its arena rules into a new Solo dive.
 if(!onlineMode)onlineRoomMode='coop';
 if(isRiftRun()||isOpenSeaRun()){controlSettings.pc='wasd-aim';controlSettings.mobile='dual-stick';}
 else {controlSettings.pc=localStorage.getItem('abyssalControlsPc')||'classic';controlSettings.mobile=localStorage.getItem('abyssalControlsMobile')||'classic';}
 // Control 1 belongs to the classic shooter. Exploration and Fossas force Control 2.
 mobileFireHeld=false;pointer.down=false;autoFollowCursor=false;
 document.body.classList.add('game-active');
 document.body.classList.toggle('abyss-solo-run',isClassicCavernRun());
 const ranking=$('runEnergyRanking');if(ranking)ranking.hidden=!onlineMode;
 runResultPending=false;
 window.AbyssalTreasure?.reset();expeditionMode=isRiftRun();expeditionExtracted=false;expeditionRiskTier=0;soloDepthEventId=null;soloDepthEventEndsAt=0;pendingSoloDepthEventId=null;soloSideEncounterTier=-1;soloEliteRewardTier=-1;tierDescentPending=false;onlineBossesDefeated=0;if(!onlineMode){activeMapLayout=null;W=isOpenSeaRun()?oceanWidth():defaultWidth();H=isOpenSeaRun()?oceanHeight():defaultHeight();if(requestedRunMode==='rift')ensureSoloMap();else runSeed=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;}else if(onlineRoomMode!=='rift'){activeMapLayout=null;activeMapSeed=0;activeMapTier=0;W=defaultWidth();H=defaultHeight();}
 
 elapsed=0;alertedBossIds.clear();gameplayNoticeQueue.length=0;gameplayNoticeActive=false;gameplayNoticeRecent.clear();clearTimeout(bossAlertTimer);const oldBossAlert=$('bossAlert');if(oldBossAlert){oldBossAlert.hidden=true;oldBossAlert.classList.remove('boss-alert-enter');}lastOnlineVitalsAt=0;authoritativeElapsed=onlineMode?0:null;lastSnapshotAt=0;lastSnapshotTick=0;lastAuthoritativeWorldId=null;lastAuthoritativeSnapshotSeq=0;lastAuthoritativeServerTime=0;pendingOnlineHitVitals=[];authoritativeSnapshotHistory=new Map();onlineMovementStalledSnapshots=0;onlineMovementConfirmedSnapshots=0;onlineMotionWatchdog?.reset?.();onlineClientMovementFallback=false;lastServerEnemyPositions.clear();score=0;level=1;xp=0;xpNeed=10;bossKillsThisRun=0;runProgressTimer=0;maxHp=100+Math.max(0,Number(metaUpgrades.bulkhead)||0)*8;hp=maxHp;spawnTimer=0;enemyId=0;shake=0;damageFlash=0;chosen=[];nextBossAt=60;bossIndex=0;lastBossKind=null;lastBossMaxHp=0;lastBossDamage=0;lastBossSpeed=0;lastRemoteBossId=null;alertedBossIds.clear();joystickVector={x:0,y:0,active:false,pointerId:null};
 setMobileGameActive(true);setHudCollapsed(false);$('toggleHudBtn').hidden=false;initBossProgression();
 const petBar=document.getElementById('petHabitBar');if(petBar)petBar.hidden=onlineMode&&!isClassicCavernRun();setPetHabit(petHabit);
 if(!onlineMode&&requestedRunMode==='rift')publishSoloDepthState();
  riftBossMarks=[];riftSoloHazardCooldowns.clear();soloRiftCheckpointRoomId='start';
if(isOpenSeaRun()){
 const researched=[...(resonancePresets.pve||[])].filter(id=>resonanceAvailable(id,'pve')&&id!=='range'&&id!=='regen');
 runResonanceIds=['photon','range','regen',...researched.filter(id=>id!=='photon')];
}else if(onlineRoomMode==='pvp'){
 runResonanceIds=[...(resonancePresets.pvp||[])];
 if(!runResonanceIds.some(id=>RESONANCE_CATEGORIES.shots.includes(id)))runResonanceIds.unshift('electric');
}else{
 runResonanceIds=[...(resonancePresets.pve||[])].filter(id=>resonanceAvailable(id,'pve'));
 if(!runResonanceIds.some(id=>RESONANCE_CATEGORIES.shots.includes(id)))runResonanceIds.unshift('photon');
}
 // Open Sea starts with a plain photon shot. Classic shooter keeps its own loadout.
 const selectedOpeningShot=isOpenSeaRun()?'photon':(runResonanceIds.find(id=>RESONANCE_CATEGORIES.shots.includes(id))||'photon');
 runShotId=selectedOpeningShot;
 upgrades={power:Math.pow(1.08,Math.max(0,Number(metaUpgrades.focuser)||0)),rate:1,range:1,speed:1+Math.max(0,Number(metaUpgrades.current)||0)*.05,magnet:1,regen:0,shield:Math.min(3,Math.max(0,Number(metaUpgrades.startShield)||0)),burst:0,electric:selectedOpeningShot==='electric'?1:0,pierce:selectedOpeningShot==='pierce'?1:0,ricochet:0,spread:0,photon:selectedOpeningShot==='photon'?1:0,photonRay:selectedOpeningShot==='photonRay'?1:0,nova:selectedOpeningShot==='nova'?1:0,echoShot:selectedOpeningShot==='echoShot'?1:0,shell:0,ward:0,lastStand:0,pressureCocoon:0,vitality:0,predator:0,closePressure:0,gravitationalRupture:0,arcChain:0,photonCascade:0,tidalEcho:0,hadalBeam:0};
 upgradeLevels={power:0,rate:0,range:0,speed:0,magnet:0,regen:0,shield:0,burst:0,electric:selectedOpeningShot==='electric'?1:0,pierce:selectedOpeningShot==='pierce'?1:0,ricochet:0,spread:0,photon:selectedOpeningShot==='photon'?1:0,photonRay:selectedOpeningShot==='photonRay'?1:0,nova:selectedOpeningShot==='nova'?1:0,echoShot:selectedOpeningShot==='echoShot'?1:0,shell:0,ward:0,lastStand:0,pressureCocoon:0,vitality:0,predator:0,closePressure:0,gravitationalRupture:0,arcChain:0,photonCascade:0,tidalEcho:0,hadalBeam:0};
 // Keep five-minute wildlife death timers when the player returns to the menu.
 soloOceanRespawnCleanupAt=0;soloOceanLastUpdate=0;
 enemies=[];orbs=[];onlineEnemyById.clear();onlineOrbById.clear();particles=[];particlePool.length=0;effectPool.length=0;sharkWakeTrails=[];inkTrails=[];projectiles=[];effects=[];enemyCollisionGrid.clear();hostileSpriteCache.clear();aquaticMotionTracker?.clear?.();remoteCreatureAttackUntil.clear();
 // Recreate bounds for the selected mode, not the menu's previous dimensions.
 createArenaRocks();
 if(isClassicShooterRun()&&(!onlineMode||onlineRoomMode==='coop'))resetSoloSubmarine();
 let soloSpawn=!onlineMode&&activeMapLayout&&ABYSSAL_MAP?ABYSSAL_MAP.startSpawn(activeMapLayout,0,1):{x:isOpenSeaRun()?180:(isClassicShooterRun()&&(!onlineMode||onlineRoomMode==='coop')?soloSubmarine.x:W*.5),y:isOpenSeaRun()?260:onlineRoomMode==='pvp'?H*.5:(isClassicShooterRun()&&(!onlineMode||onlineRoomMode==='coop')?soloSubmarine.y+170/GAME_WORLD_ZOOM:H*.11)};
 if(isClassicCavernRun())soloSpawn=SOLO_CAVERN?.submarineSpawn?.(arenaRocks,W,H,soloSubmarine,GAME_WORLD_ZOOM)||soloSpawn;
 expandingSkinClouds.length=0;expandingSkinPulses.length=0;
 player={x:soloSpawn.x,y:soloSpawn.y,r:13/GAME_WORLD_ZOOM,angle:Math.PI/2,bodyAngle:Math.PI/2,weaponAngle:Math.PI/2,diverGender,moveSpeed:150/GAME_WORLD_ZOOM,fireTimer:0,invuln:0,shieldTime:0,trail:[],pulseCooldown:0,dashCooldown:0,dashTime:0,skinActiveCooldown:0,skinTrailUntil:0,skinWeaponBuffUntil:0,skinWeaponBuffKind:null,skinShieldUntil:0};player.specimen={x:soloSpawn.x,y:soloSpawn.y-34/GAME_WORLD_ZOOM,r:11/GAME_WORLD_ZOOM,hp:SPECIMEN_SYSTEM.effectiveStats(equippedSkin,specimenPoints()).hp,maxHp:SPECIMEN_SYSTEM.effectiveStats(equippedSkin,specimenPoints()).hp,alive:true,respawnTimer:0,respawnAt:0,invuln:1.5};updateCamera();
 for(const id of runResonanceIds){if(id===selectedOpeningShot)continue;const skill=upgradeList.find(item=>item.id===id);if(!skill)continue;skill.apply();upgradeLevels[id]=1;}
 if(isOpenSeaRun()){const rangeSkill=upgradeList.find(item=>item.id==='range'),regenSkill=upgradeList.find(item=>item.id==='regen');if(!upgradeLevels.range){rangeSkill?.apply();upgradeLevels.range=1;}if(!upgradeLevels.regen){regenSkill?.apply();upgradeLevels.regen=1;}}
 // Persistent/passive abilities have a distinct cue when their effects enter a run.
 const activePassiveSounds=[];
 if(Number(metaUpgrades.bulkhead)>0)activePassiveSounds.push('bulkhead');
 if(Number(metaUpgrades.focuser)>0)activePassiveSounds.push('focuser');
 if(Number(metaUpgrades.current)>0)activePassiveSounds.push('current');
 if(upgrades.shield>0)activePassiveSounds.push('startShield');
 activePassiveSounds.slice(0,4).forEach((id,i)=>setTimeout(()=>{if(gameState==='playing'||(onlineMode&&gameState==='upgrade'))playSkillSound(id,'trigger')},180+i*190));
 const cockpit=document.getElementById('submarineWorkshop');if(cockpit&&!cockpit.hidden){cockpit.hidden=true;window.AbyssalSubmarineCockpit?.close?.();}
 gameState='playing';worldZoom=desiredWorldZoom();updateCamera();syncMobileFireButton();screens.forEach(s=>$(s).hidden=true);$('hud').hidden=false;const endBtn=document.getElementById('endDiveBtn');if(endBtn)endBtn.style.display='block';$('pauseBtn').hidden=false;botBuddyTimer=0;botBuddy=null;
 updateHud();last=performance.now();playWorldSound('ui-open',player,850,.9);if(!onlineMode){if(requestedRunMode==='rift')seedSoloRiftEncounters();else if(isOpenSeaRun())updateSoloOceanChunks(true);else {for(let i=0;i<3;i++)spawnEnemy(true,'common');}}if(onlineMode&&!resumingDeploy){window.AbyssalOnline?.beginRun?.();window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet,rangeStrength:upgrades.range,speedStrength:upgrades.speed,arcChainActive:Boolean(upgrades.arcChain),hadalBeamActive:Boolean(upgrades.hadalBeam),ricochetLevel:upgrades.ricochet,predatorLevel:upgrades.predator,prismaticLevel:upgrades.spread,electricLevel:upgrades.electric,shellLevel:upgrades.shell,lastStandLevel:upgrades.lastStand,submarineWeapons:window.AbyssalSoloBase?.installedWeapons?.()||['photon']});window.AbyssalOnline?.requestPlayerState?.();}else if(!onlineMode&&window.AbyssalOnline?.isAuthenticated?.())window.AbyssalOnline?.beginRun?.();snapshotClock=0;
 window.AbyssalTutorials?.enter(isOpenSeaRun()?'open-sea':onlineMode?onlineRoomMode:(requestedRunMode==='rift'?'rift-solo':'solo'));
 scheduleGameLoop();
}
const upgradeList=[
 {id:'power',name:'Pulso intenso',icon:'✧',desc:'Amplifica o núcleo ofensivo: +50% de dano dos disparos por nível. O brilho de impacto fica mais intenso conforme a potência cresce.',apply:()=>upgrades.power*=1.5},
 {id:'rate',name:'Ressonância veloz',icon:'⟡',desc:'Acelera a cadência em 28% por nível. A pulsação ao redor do núcleo acompanha o ritmo de disparo.',apply:()=>upgrades.rate*=1.28},
 {id:'speed',name:'Propulsão abissal',icon:'➤',desc:'Aumenta a velocidade de movimento em 18% por nível e reforça o rastro hidrodinâmico.',apply:()=>upgrades.speed*=1.18},
 {id:'range',name:'Olho profundo',icon:'◎',desc:'Afasta a câmera e amplia a visão e o alcance dos disparos em 22% por nível, até o nível 3.',apply:()=>upgrades.range*=1.22},
 {id:'magnet',name:'Afinidade abissal',icon:'⌁',desc:'Aumenta em 8% por nível a energia de evolução recebida.',apply:()=>upgrades.magnet*=1.08},
 {id:'regen',name:'Membrana viva',icon:'✚',desc:'Regenera vida gradualmente. Cada nível aumenta a frequência efetiva da recuperação e produz um pulso orgânico verde ao curar.',apply:()=>upgrades.regen+=1},
 {id:'shield',name:'Escudo espectral',icon:'◉',desc:'Adiciona uma carga de escudo, até 3. Cada carga bloqueia um dano e aparece como uma camada espectral ao redor do corpo.',apply:()=>upgrades.shield=Math.min(3,upgrades.shield+1)},
 {id:'burst',name:'Pulso de ruptura',icon:'✺',desc:'Libera dano em área: começa a cada 7 segundos, com intervalo mínimo de 3,5 segundos e dano crescente por nível.',apply:()=>upgrades.burst=Math.min(3,upgrades.burst+1)},
 {id:'electric',name:'Tempestade elétrica',icon:'ϟ',desc:'Corrente bioelétrica: dano moderado e 1, 2 ou 3 saltos. Cada salto causa dano reduzido; níveis maiores ampliam o alcance da corrente.',apply:()=>upgrades.electric=Math.min(3,(upgrades.electric||0)+1)},
 {id:'pierce',name:'Lança-abismo',icon:'➶',desc:'Arpão abissal pesado: lento, largo e atravessa 1, 2 ou 3 criaturas adicionais. Sua força está em rasgar fileiras inteiras, não em chegar primeiro ao alvo.',apply:()=>upgrades.pierce=Math.min(3,(upgrades.pierce||0)+1)},
 {id:'ricochet',name:'Ricochete caótico',icon:'⤴',desc:'Passiva universal: qualquer disparo que acerte um alvo pode ricochetear para outro inimigo próximo. Cada nível adiciona um salto, até 3, marcado por um feixe reto amarelo neon.',apply:()=>upgrades.ricochet=Math.min(3,(upgrades.ricochet||0)+1)},
 {id:'spread',name:'Rajada Prismática',icon:'✷',desc:'Por nível, adiciona exatamente 2, 4 ou 6 ataques laterais. Tiros comuns ganham projéteis em leque com dano dividido; Raio de Fótons ganha feixes laterais que causam 42% do dano do feixe principal quando atingem sozinhos, sem acumular sobre o mesmo alvo. Nova Gravitacional mantém o cone e lança 2, 4 ou 6 estilhaços frontais que dividem 28% do dano do pulso.',apply:()=>upgrades.spread=Math.min(3,(upgrades.spread||0)+1)},
 {id:'photon',name:'Lança de Fótons',icon:'➶',desc:'Dardo fotônico de precisão: extremamente veloz, fino e de alto dano em alvo único. Quase não permanece na tela e não perfura fileiras.',apply:()=>upgrades.photon=Math.min(3,(upgrades.photon||0)+1)},
 {id:'photonRay',name:'Raio de Fótons',icon:'☼',desc:'Feixe contínuo que atinge todos os alvos atravessados. No Controle 1, mira automaticamente no alvo mais próximo; no Controle 2, acompanha o mouse no PC ou o joystick de mira no celular. Níveis maiores aumentam potência e espessura.',apply:()=>upgrades.photonRay=Math.min(3,(upgrades.photonRay||0)+1)},
 {id:'nova',name:'Nova gravitacional',icon:'✹',desc:'Pulso gravitacional em cone para frente: 1,8s entre disparos no PvE e 2,4s no PvP. Obstáculos bloqueiam o dano.',apply:()=>upgrades.nova=Math.min(3,(upgrades.nova||0)+1)},
 {id:'echoShot',name:'Eco de Maré',icon:'⋔',desc:'Dispara dois projéteis paralelos com dano individual menor. Níveis maiores aumentam dano e velocidade sem abrir o leque.',apply:()=>upgrades.echoShot=Math.min(3,(upgrades.echoShot||0)+1)},
 {id:'shell',name:'Carapaça Abissal',icon:'🛡',desc:'Endurece a carapaça: reduz o dano recebido em 8% por nível, até 24%, indicado por placas minerais orbitais discretas.',apply:()=>upgrades.shell=Math.min(3,(upgrades.shell||0)+1)},
 {id:'ward',name:'Véu de Maré',icon:'◈',desc:'Cria automaticamente uma janela curta de invulnerabilidade. Começa a cada 28 s e recarrega mais rápido nos níveis seguintes; um véu azul se fecha quando ativa.',apply:()=>upgrades.ward=Math.min(3,(upgrades.ward||0)+1)},
 {id:'lastStand',name:'Último Fôlego',icon:'♥',desc:'Com até 30% da vida, reduz o dano recebido em 20%, 25% ou 30% conforme o nível. O núcleo assume um pulso carmesim enquanto estiver ativo.',apply:()=>upgrades.lastStand=Math.min(3,(upgrades.lastStand||0)+1)},
 {id:'pressureCocoon',name:'Casulo de Pressão',icon:'⬡',desc:'Quando o escudo chega a zero, recompõe automaticamente 1 carga após 24, 20 ou 16 segundos. Não acumula acima de 1 carga regenerada.',apply:()=>upgrades.pressureCocoon=Math.min(3,(upgrades.pressureCocoon||0)+1)},
 {id:'vitality',name:'Reserva Vital',icon:'✚',desc:'Aumenta a vida máxima em 10% por nível e cura imediatamente o valor acrescentado. O núcleo vital ganha um anel interno adicional.',apply:()=>{const previous=maxHp;maxHp=Math.round(maxHp*1.1);hp=Math.min(maxHp,hp+(maxHp-previous));upgrades.vitality=Math.min(3,(upgrades.vitality||0)+1)}},
 {id:'predator',name:'Instinto Predatório',icon:'☠',desc:'Especialista em caça: +14% de dano por nível contra chefes e elites (+3% contra outros). Finaliza alvos abaixo de 30% de vida com +6% adicional por nível.',apply:()=>upgrades.predator=Math.min(3,(upgrades.predator||0)+1)},
 {id:'closePressure',name:'Pressão de Caça',icon:'⌾',desc:'Causa +18%, +36% ou +54% de dano apenas contra inimigos a menos de 175 unidades. É mais forte que Instinto Predatório à curta distância, mas exige risco e posicionamento.',apply:()=>upgrades.closePressure=Math.min(3,(upgrades.closePressure||0)+1)}
];
const COMBO_SKILLS={
 gravitationalRupture:{id:'gravitationalRupture',name:'Ruptura gravitacional',icon:'✹',desc:'Fusão de Pulso de Ruptura + Nova Gravitacional Nv. 3. Conserva o disparo em cone e acrescenta um campo gravitacional de dano periódico.'},
 arcChain:{id:'arcChain',name:'Cadeia de Arcos',icon:'ϟ',desc:'Fusão de Tempestade Elétrica Nv. 3 + Ricochete Caótico Nv. 3. Correntes elétricas ricocheteiam por até 8 alvos próximos em cadeia.'},
 abyssEye:{id:'abyssEye',name:'Olho do Abismo',icon:'◉',desc:'Fusão de Lança do Abismo + Olho Profundo no nível 3. Os disparos deixam de respeitar o limite normal de alcance e seguem até atingir uma criatura ou obstáculo.'},
 vitalDrain:{id:'vitalDrain',name:'Dreno Vital',icon:'✚',desc:'Fusão de Membrana Viva + Pulso Intenso no nível 3. Converte 2% do dano causado em vida.'},
 photonCascade:{id:'photonCascade',name:'Cascata Prismática',icon:'✦',desc:'Fusão de Lança de Fótons Nv. 3 e Rajada Prismática Nv. 3. Adiciona 2 projéteis fotônicos ao leque sem mudar a identidade do disparo.'},
 tidalEcho:{id:'tidalEcho',name:'Maré Reverberante',icon:'⋔',desc:'Fusão de Eco de Maré Nv. 3 e Ricochete Caótico Nv. 3. Dispara uma terceira réplica central com ricochetes.'},
 hadalBeam:{id:'hadalBeam',name:'Feixe Hadal',icon:'☼',desc:'Fusão de Raio de Fótons Nv. 3 e Olho Profundo Nv. 3. Aumenta espessura em 35% e dano de pulso em 20%.'}
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
 const selected=Object.entries(upgradeLevels).filter(([id,rank])=>Number(rank)>0&&!(gravitationalRuptureActive&&['burst','nova'].includes(id))&&!(arcChainActive&&['electric','ricochet'].includes(id))&&!(upgrades.abyssEye&&['pierce','range'].includes(id))&&!(upgrades.vitalDrain&&['regen'].includes(id))&&!(upgrades.photonCascade&&['photon','spread'].includes(id))&&!(upgrades.tidalEcho&&['echoShot','ricochet'].includes(id))&&!(upgrades.hadalBeam&&['photonRay','range'].includes(id))).sort((a,b)=>a[0].localeCompare(b[0]));
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
 if(!upgrades.arcChain&&upgradeLevels.electric>=3&&upgradeLevels.ricochet>=3){
   upgrades.electric=0;upgrades.ricochet=0;upgrades.arcChain=1;
  upgradeLevels.arcChain=1;combinedNow=true;combinedSkillName=COMBO_SKILLS.arcChain.name;
  if(player)player.arcChainTimer=0;
 }
 if(!upgrades.photonCascade&&upgradeLevels.photon>=3&&upgradeLevels.spread>=3){upgrades.photonCascade=1;upgradeLevels.photonCascade=1;combinedNow=true;combinedSkillName=COMBO_SKILLS.photonCascade.name;}
 if(!upgrades.tidalEcho&&upgradeLevels.echoShot>=3&&upgradeLevels.ricochet>=3){upgrades.tidalEcho=1;upgradeLevels.tidalEcho=1;combinedNow=true;combinedSkillName=COMBO_SKILLS.tidalEcho.name;}
 if(!upgrades.hadalBeam&&upgradeLevels.photonRay>=3&&upgradeLevels.range>=3){upgrades.hadalBeam=1;upgradeLevels.hadalBeam=1;combinedNow=true;combinedSkillName=COMBO_SKILLS.hadalBeam.name;}
 if(onlineMode)window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet,rangeStrength:upgrades.range,speedStrength:upgrades.speed,arcChainActive:Boolean(upgrades.arcChain),hadalBeamActive:Boolean(upgrades.hadalBeam),ricochetLevel:upgrades.ricochet,predatorLevel:upgrades.predator,prismaticLevel:upgrades.spread,electricLevel:upgrades.electric,shellLevel:upgrades.shell,lastStandLevel:upgrades.lastStand,submarineWeapons:window.AbyssalSoloBase?.installedWeapons?.()||['photon']});
 // Save through the shared codex cache; referencing a local, undefined "codex" here
 // used to throw before the level-up overlay closed, breaking both click and auto-pick.
 discoverCodexSkill(u.id);
 if (!areAllUpgradesMaxed()) { level++; } else { level = 'MAX'; }
 gameState='playing';$('upgradeScreen').hidden=true;renderSelectedSkills();
 if(combinedNow){const nickname=window.AbyssalOnline?.getAccount?.()?.nickname||'Mergulhador';enqueueGameplayNotice('fusion',combinedSkillName.toUpperCase(),`${nickname} fundiu habilidades e despertou ${combinedSkillName}.`,60);if(onlineMode)window.AbyssalOnline?.sendFusion?.(combinedSkillName);}else showToast(`${u.name.toUpperCase()} · NÍVEL ${upgradeLevels[u.id]}/3`);
 playSkillSound(combinedNow?'nova':u.id,'learn');playWorldSound('ui-upgrade',player,800,.55);updateHud();last=performance.now();
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
 wrap.appendChild(fragment);$('upgradeScreen').hidden=false;playWorldSound('level-up',player,850,.75);
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
function chooseSoloSpawnRoom(){
 const map=ensureSoloMap();if(!map||!player||!EXPEDITION_RULES)return null;
 const playerRoom=ABYSSAL_MAP?.roomAt?.(map,player.x,player.y),lower=Number(playerRoom?.depth)>=7;
 const allowed=lower?new Set(['landing','boss']):new Set(['common','event','hub']);
 const candidates=map.rooms.filter(room=>{
  if(!allowed.has(room.type))return false;
  const cap=(EXPEDITION_RULES.roomDensityCap?.(room,activeMapTier,1)??Number(room.densityCap)??0);
  if(cap<=0)return false;
  let count=0;for(const enemy of enemies)if(!BOSS_KINDS.includes(enemy.kind)&&enemy.spawnRoomId===room.id)count++;
  return count<cap;
 });
 if(!candidates.length)return null;
 const weighted=[];
 for(const room of candidates){
  const cap=Math.max(1,(EXPEDITION_RULES.roomDensityCap?.(room,activeMapTier,1)??Number(room.densityCap)??1));
  let count=0;for(const enemy of enemies)if(!BOSS_KINDS.includes(enemy.kind)&&enemy.spawnRoomId===room.id)count++;
  const open=Math.max(.08,1-count/cap),tickets=Math.max(1,Math.round(open*(room.type==='event'?3:room.type==='hub'?4:6)));
  for(let i=0;i<tickets;i++)weighted.push(room.id);
 }
 return weighted[Math.floor(Math.random()*weighted.length)]||candidates[0].id;
}
// A 15x sea must not have 15x active mobs: maintain only nearby cells.
let soloOceanLastUpdate=0;
const soloOceanCellCache=new Map();
function cachedSoloOceanCell(cell){
 let data=soloOceanCellCache.get(cell.key);
 if(data){soloOceanCellCache.delete(cell.key);soloOceanCellCache.set(cell.key,data);return data;}
 data=OCEAN_STREAM.generate('abyssal-persistent-solo-v1',cell.cx,cell.cy,OPEN_SEA_ECOLOGY);
 soloOceanCellCache.set(cell.key,data);
 while(soloOceanCellCache.size>96)soloOceanCellCache.delete(soloOceanCellCache.keys().next().value);
 return data;
}
function updateSoloOceanChunks(force=false){
 if(!player||!isOpenSeaRun()||!OCEAN_STREAM||!OPEN_SEA_ECOLOGY)return;
 const now=performance.now();if(!force&&now-soloOceanLastUpdate<180)return;
 soloOceanLastUpdate=now;
 const respawnNow=Date.now();
 if(respawnNow>=soloOceanRespawnCleanupAt){soloOceanRespawn?.prune(respawnNow);soloOceanRespawnCleanupAt=respawnNow+30000;}
 const vw=viewW/worldZoom,vh=viewH/worldZoom;
 const radius=Math.max(2600,Math.hypot(vw,vh)*.5+1800);
 const nearby=OCEAN_STREAM.active([player],90,radius),active=new Set(nearby.map(c=>c.key));
 const visible=(x,y,r=0,margin=240)=>x+r>=cameraX-margin&&x-r<=cameraX+vw+margin&&y+r>=cameraY-margin&&y-r<=cameraY+vh+margin;
 // Retain visible/moving creatures even when their home cell leaves the active set.
 const retainRadius=radius+OCEAN_STREAM.CHUNK;
 enemies=enemies.filter(e=>!e.streamId||active.has(String(e.streamId).split(':').slice(0,2).join(':'))||visible(e.x,e.y,e.r,700)||Math.hypot(e.x-player.x,e.y-player.y)<retainRadius);
 const have=new Set(enemies.map(e=>e.streamId).filter(Boolean));
 let budget=Math.min(force?90:12,Math.max(0,90-enemies.length));
 const candidates=[];
 for(const cell of nearby){
  const fauna=cachedSoloOceanCell(cell);
  for(const specimen of fauna.animals){
   if(have.has(specimen.id)||(soloOceanRespawn&&!soloOceanRespawn.ready(specimen.id,respawnNow)))continue;
   if(Math.hypot(specimen.x-player.x,specimen.y-player.y)<170)continue;
   // Never introduce a fresh creature in the current camera during a dive.
   if(!force&&visible(specimen.x,specimen.y,180,160))continue;
   candidates.push(specimen);
  }
 }
 // Fill nearest future-visible cells first, not arbitrary chunk iteration order.
 candidates.sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
 for(const specimen of candidates){
  if(budget<=0)break;
  const mob=spawnEnemy(false,'common',{position:specimen,species:specimen.species,streamId:specimen.id,schoolId:specimen.schoolId});
  if(mob){have.add(specimen.id);budget--;}
 }
}
function spawnEnemy(initial=false,type='common',options={}){
 // An ocean streamed entity has its own absolute world position.

 if(!player||enemies.length>=soloEnemyCap())return null;
 const bossCount=enemies.filter(e=>BOSS_KINDS.includes(e.kind)).length,commonCount=enemies.length-bossCount;
 const isBossType = type === 'boss' || BOSS_KINDS.includes(type);
 if(isBossType&&(bossCount>=MAX_BOSSES||enemies.length>=soloEnemyCap()))return null;
 if(!isBossType&&commonCount>=soloCommonCap())return null;
 const ai=window.AbyssalEnemyAI,map=ensureSoloMap(),activeKinds=enemies.map(e=>e.kind);
 let point=options.position||(!map&&isClassicShooterRun()?(()=>{const portals=getArenaVortices().slice();if(isBossType)portals.sort((a,b)=>Math.hypot(b.x-player.x,b.y-player.y)-Math.hypot(a.x-player.x,a.y-player.y));const v=isBossType?portals[0]:portals[Math.floor(Math.random()*portals.length)];return {x:v.x,y:v.y};})():map&&ABYSSAL_MAP?ABYSSAL_MAP.spawnPoint(map,{type:isBossType?'boss':'common',initial,random:Math.random,bossesDefeated:bossKillsThisRun,roomId:options.roomId}):(ai?.chooseSpawnPoint?ai.chooseSpawnPoint(Math.random,null,W,H):{x:rand(100,290),y:rand(90,250)}));
 let ecologyRoom=map?.rooms?.find(room=>room.id===point.roomId)||null;
 let kind;
 if(BOSS_KINDS.includes(type))kind=type;
 else if(type==='boss')kind=ai?.chooseBossKind(activeKinds,Math.random,bossIndex++)||BOSS_KINDS.find(k=>!activeKinds.includes(k));
 else kind=options.kind&&SOLO_INITIAL_KINDS.includes(options.kind)?options.kind:EXPEDITION_RULES?.chooseCommonKindForRoom?.(Math.random,ecologyRoom,activeMapTier,soloDepthEventId)||EXPEDITION_RULES?.chooseCommonKind?.(Math.random,bossKillsThisRun,soloDepthEventId)||ai?.chooseCommonKind()||(()=>{const t=Math.random();return t<.56?'drifter':t<.78?'stinger':t<.94?'brute':'lurker'})();
 if(kind==='whiteShark'){const whiteSharkCount=enemies.filter(e=>e.kind==='whiteShark').length;if(whiteSharkCount>=10)kind='lurker';}
 if(!kind)return null;
 const openSeaSkin=!map&&isOpenSeaRun()&&!isBossType?(options.species||OPEN_SEA_ECOLOGY?.speciesAt?.(point.x,point.y,Math.random)):null;
 if(openSeaSkin){
  const nature=OPEN_SEA_ECOLOGY.temperament(openSeaSkin);
  kind=['reefshark','goblin','frilled'].includes(openSeaSkin)?'whiteShark':nature==='aggressive'?'lurker':nature==='smart'?'stinger':'drifter';
 }
 let data=ai?.statsForKind(kind)||({
  boss:{r:40,hp:5640,speed:52,damage:25,color:'#338cff',value:55},
  leviathan:{r:54,hp:9400,speed:44,damage:34,color:'#4ce0d1',value:90},
  maw:{r:45,hp:7500,speed:58,damage:31,color:'#c16cff',value:75},
  angler:{r:35,hp:6520,speed:66,damage:28,color:'#ffb45e',value:65},
  kraken:{r:80,hp:18400,speed:20,damage:38,color:'#8b5cf6',value:180},
  drifter:{r:10,hp:22,speed:51,damage:8,color:'#ff769d',value:1},
  stinger:{r:7,hp:13,speed:88,damage:6,color:'#ffbc78',value:2},
  brute:{r:16,hp:65,speed:30,damage:15,color:'#bd88ff',value:4},
  lurker:{r:20,hp:100,speed:43,damage:18,color:'#6e8dff',value:6}
 })[kind];
 const classicSolo=!onlineMode&&isClassicShooterRun();
 if(classicSolo&&!isBossType&&SOLO_INITIAL_KINDS.includes(kind))data={...data,hp:data.hp+50};
 if(classicSolo&&kind==='whiteShark')data={...data,hp:600};
 let eliteId=null;
 if(!isBossType&&!initial&&EXPEDITION_RULES&&!(classicSolo&&kind==='whiteShark')){
  eliteId=map||options.streamId?null:EXPEDITION_RULES.chooseElite(Math.random,bossKillsThisRun,soloDepthEventId,kind);
  if(options.forceElite&&!eliteId){const eliteIds=['carapace','frenzy','spectral'];eliteId=eliteIds[Math.floor(Math.random()*eliteIds.length)]||'carapace';}
  if(eliteId)data=EXPEDITION_RULES.applyEliteStats(data,eliteId);
 }
 if(!isBossType){
  const physicalScale=eliteId?1.18:1.07,speedScale=eliteId?1.08:1.03,hpScale=eliteId?1.12:1;
  data={...data,damage:Math.max(1,Math.round(Number(data.damage||1)*physicalScale)),speed:Number(data.speed||0)*speedScale,hp:Math.max(1,Math.round(Number(data.hp||1)*hpScale))};
  if(requestedRunMode!=='rift'&&!isOpenSeaRun()&&!(classicSolo&&kind==='whiteShark'))data=SEA_PROGRESSION?.strengthenCommon?.(data,elapsed)||data;
   if(openSeaSkin==='leviathan'||openSeaSkin==='siphonophore'){data.hp=Math.max(300,Number(data.hp)*8);data.speed=Math.max(22,Number(data.speed)*.5);data.damage=0;data.value=Math.max(5,Number(data.value)*5);}
   else if(openSeaSkin)data.hp=SPECIMEN_SYSTEM?.biologicalStats?.(openSeaSkin)?.hp||data.hp;
 }
 if(isBossType){data.hp=Math.round(data.hp*getBossCycleMultiplier());lastBossMaxHp=data.hp;lastBossDamage=data.damage;lastBossSpeed=data.speed;bossIndex++;}
 if(eliteId&&map&&!options.roomId&&!isBossType){
  point=ABYSSAL_MAP.spawnPoint(map,{type:'elite',random:Math.random,bossesDefeated:bossKillsThisRun});
  ecologyRoom=map?.rooms?.find(room=>room.id===point.roomId)||ecologyRoom;
 }
 if(!isBossType){const reward=EXPEDITION_RULES?.roomRewardMultiplier?.(ecologyRoom,activeMapTier)||1;data={...data,value:Math.max(1,Math.round((Number(data.value)||1)*reward))};}
 if(!map&&usesNaturalOceanTerrain()&&OCEAN_GEOGRAPHY&&OCEAN_GEOGRAPHY.isSolid(point.x,point.y,40)){
  const safe=OCEAN_GEOGRAPHY.nearestWater(point.x,point.y,40);if(!safe)return null;point={...point,x:safe.x,y:safe.y};
 }
 if(!onlineMode&&isClassicShooterRun()&&SOLO_CAVERN){const safe=SOLO_CAVERN.nearestWater(arenaRocks,W,H,point.x,point.y,Math.max(8,Math.min(110,(data.r||10)/GAME_WORLD_ZOOM*.62)));if(!safe)return null;point={...point,...safe};}
 const x=clamp(point.x,70/GAME_WORLD_ZOOM,W-70/GAME_WORLD_ZOOM),y=clamp(point.y,70/GAME_WORLD_ZOOM,H-70/GAME_WORLD_ZOOM);
 const specimenSkinId=isBossType?null:requestedRunMode==='rift'?(SPECIMEN_RARITY?.roll(skinData.map(item=>item.id),Math.random)||'default'):openSeaSkin;
 if(requestedRunMode==='rift'&&!isBossType)data.hp=RIFT_WILDLIFE?.health?.(kind,specimenSkinId,SPECIMEN_SYSTEM?.familyFor?.(specimenSkinId))||data.hp;
 const enemy={discoverySkinId:!onlineMode&&isClassicShooterRun()?SOLO_SPECIMEN_REFERENCES[kind]:null,specimenSkinId,streamId:options.streamId||null,schoolId:options.schoolId||null,id:++enemyId,x,y,...data,r:(CREATURE_SCALE?.creatureCollisionRadius?.(data.r,specimenSkinId)||data.r)/GAME_WORLD_ZOOM,speed:data.speed/GAME_WORLD_ZOOM,maxHp:data.hp,temperament:requestedRunMode==='rift'?RIFT_WILDLIFE?.disposition?.(kind,specimenSkinId,SPECIMEN_SYSTEM?.familyFor?.(specimenSkinId)):isOpenSeaRun()?OPEN_SEA_ECOLOGY?.temperament?.(specimenSkinId):'aggressive',wildlifeMode:isOpenSeaRun()&&!isBossType?OPEN_SEA_ECOLOGY?.temperament?.(specimenSkinId):null,homeX:x,homeY:y,habitatId:isOpenSeaRun()?OPEN_SEA_ECOLOGY?.habitatAt?.(x,y)?.id:null,angle:rand(0,6.28),phase:rand(0,6.28),hit:0,attackCd:rand(.3,1),kind,spawnRoomId:point.roomId||null,spawnedAt:Date.now(),eliteId,suctionActive:false,suctionTimer:0,suctionCooldown:kind==='devourer'?20:0,suctionPulse:0,krakenSweepTimer:kind==='kraken'?3.5:0,krakenSweepActive:false,krakenTelegraph:0,krakenSweepCycle:0};
 if(kind===RIFT_HARDCORE?.FINAL_KIND&&activeMapLayout){const chamber=activeMapLayout.rooms.find(room=>room.id==='boss');if(chamber){enemy.x=chamber.x;enemy.y=chamber.y;enemy.angle=0;}}
  enemies.push(enemy);if(requestedRunMode!=='rift')discoverCodexMonsters([kind]);
 if(eliteId){const elite=EXPEDITION_RULES?.eliteConfig?.(eliteId);if(elite)burst(x,y,elite.accent,8,80);}
 if(BOSS_KINDS.includes(kind)){lastBossKind=kind;if(!options.silentBoss)showBossAlert(kind,enemy.id,bossIndex);burst(x,y,data.color,kind==='kraken'?28:36,230);}
 return enemy;
}

function seedSoloRiftEncounters(){
 if(onlineMode||requestedRunMode!=='rift'||!activeMapLayout)return;
 soloRiftActivatedRooms=new Set();soloRiftSpawnQueue=[];
 spawnTimer=Infinity;nextBossAt=Infinity;
}

const SOLO_RIFT_ROOM_POPULATIONS=Object.freeze({shoal:3,trench:4,lantern:4,junction:4,event:3,hub:4,landing:5,elite:3});
function activateSoloRiftRoomEncounter(){
 if(onlineMode||requestedRunMode!=='rift'||!activeMapLayout||!player)return;
 for(const room of activeMapLayout.rooms){
  if(room.id==='start'||soloRiftActivatedRooms.has(room.id))continue;
  if(Math.hypot(player.x-room.x,player.y-room.y)>=Math.max(1700,room.ry+850,Math.hypot(viewW/worldZoom,viewH/worldZoom)*.5+Math.max(room.rx,room.ry)+500))continue;
  soloRiftActivatedRooms.add(room.id);
  const count=room.id==='boss'?1:SOLO_RIFT_ROOM_POPULATIONS[room.id]||0;
  if(count)soloRiftSpawnQueue.push({roomId:room.id,count,boss:room.id==='boss'});
 }
 // An entered room takes precedence over distant preloading. This also
 // guarantees the chamber boss exists when the player reaches its center.
 const currentRoom=ABYSSAL_MAP?.roomAt?.(activeMapLayout,player.x,player.y);
 if(currentRoom?.id==='boss'){
  const arrivingBoss=enemies.find(e=>BOSS_KINDS.includes(e.kind)&&e.spawnRoomId==='boss'&&e.hp>0);
  if(arrivingBoss)showBossAlert(arrivingBoss.kind,arrivingBoss.id,bossIndex);
 }
 if(currentRoom)soloRiftSpawnQueue.sort((a,b)=>Number(b.roomId===currentRoom.id)-Number(a.roomId===currentRoom.id));
 // Spread creation across animation frames instead of creating a whole
 // chamber's sprites/AI on its first visible frame.
 let budget=2;
 while(budget-->0&&soloRiftSpawnQueue.length){
  const job=soloRiftSpawnQueue[0];
  const enemy=job.boss?spawnEnemy(false,BOSS_KINDS[activeMapTier%BOSS_KINDS.length],{roomId:'boss',silentBoss:currentRoom?.id!=='boss'}):
    spawnEnemy(false,'common',{roomId:job.roomId,forceElite:job.roomId==='elite'});
  if(--job.count<=0||!enemy)soloRiftSpawnQueue.shift();
 }
}

function burst(x,y,color,n=10,force=100){
 n=Math.min(Math.max(0,Math.floor(n)),Math.max(0,particleBudget()-particles.length));
 n=reserveParticleSpawns(n);
 for(let i=0;i<n;i++){
  const a=Math.random()*Math.PI*2,s=rand(force*.25,force),life=rand(.22,.7),p=particlePool.pop()||{};
  p.x=x;p.y=y;p.vx=Math.cos(a)*s;p.vy=Math.sin(a)*s;p.life=life;p.max=life;p.r=rand(1,3.5);p.color=color;p.bubble=false;particles.push(p);
 }
}
function respawnSoloRiftCheckpoint(){
 if(!player||!activeMapLayout||!RIFT_HARDCORE)return;
 const cp=RIFT_HARDCORE.checkpoint(activeMapLayout,player.x,player.y,soloRiftCheckpointRoomId);
 const room=activeMapLayout.rooms.find(r=>r.id===cp.roomId);
 if(cp.roomId==='boss')for(const boss of enemies)if(boss.kind===RIFT_HARDCORE.FINAL_KIND&&boss.hp>0){boss.hp=boss.maxHp;boss.riftPendingAttacks=[];boss.riftNextAttackAt=0;}
 riftBossMarks=[];
 const safe=ABYSSAL_MAP.isWalkable(activeMapLayout,cp.x,cp.y,player.r)?cp:{x:room?.x??cp.x,y:(room?.y??cp.y)-Math.min(85,Number(room?.ry)||85)};
 player.x=safe.x;player.y=safe.y;player.trail.length=0;hp=maxHp;
 player.invuln=3.2;player.fireTimer=0;damageFlash=.35;shake=10;
 burst(player.x,player.y,'#a3eaff',26,160);playWorldSound('checkpoint',player,850,.85);
 enqueueGameplayNotice('cave','CHECKPOINT · '+String(room?.name||cp.roomId).toUpperCase(),'As Fossas o devolveram ao início da sala. Sua expedição continua.',84);
 updateCamera();updateHud();
}
function riftTouchesDiver(h,phase){
 if(!DIVER_HITBOX||!player)return null;
 for(const zone of DIVER_HITBOX.zones(player,performance.now())){
  for(const amount of [0,.5,1]){
   const px=zone.ax+(zone.bx-zone.ax)*amount,py=zone.ay+(zone.by-zone.ay)*amount;
   if(RIFT_HARDCORE.hit(h,px,py,zone.r,phase))return zone.name;
  }
 }
 return null;
}
function updateSoloRiftHardcore(dt){
 if(onlineMode||requestedRunMode!=='rift'||!player||!activeMapLayout||!RIFT_HARDCORE)return;
 const room=ABYSSAL_MAP.roomAt(activeMapLayout,player.x,player.y);
 if(room)soloRiftCheckpointRoomId=room.id;
 const nightmareAlive=activeMapTier===(RIFT_HARDCORE?.FINAL_TIER??7)&&enemies.some(enemy=>enemy.kind===RIFT_HARDCORE.FINAL_KIND&&enemy.hp>0);
 for(const h of activeRiftHazards){
  // Nightmare's eight tentacles exist only while the final boss is alive.
  if(h.type==='tentacle'&&!nightmareAlive)continue;
  const phase=RIFT_HARDCORE.state(h,elapsed);
  if(h.type==='tentacle'&&phase.phase!=='idle'){
   const derived=RIFT_HARDCORE.hazardAtCycle(h,phase.cycle);
   if(!derived.aimed){
    const sameRoom=room?.id===h.roomId;
    RIFT_HARDCORE.aimTentacle(h,phase.cycle,sameRoom?player.x:null,sameRoom?player.y:null);
   }
  }
  if(phase.phase!=='active')continue;
  if(riftTouchesDiver(h,phase)){
    // Suction is an uninterrupted current, not a tiny move every damage tick.
    if(h.type==='vortex'){
      const dx=h.x-player.x,dy=h.y-player.y,len=Math.hypot(dx,dy)||1;
      const pull=Math.min(Math.max(0,len-7),430*dt);
      const move=mapResolveMove(player.x,player.y,player.x+dx/len*pull,player.y+dy/len*pull,player.r);
      player.x=move.x;player.y=move.y;
    }
    const cooldown=riftSoloHazardCooldowns.get(h.id)||-Infinity;
   if(elapsed>=cooldown){
    riftSoloHazardCooldowns.set(h.id,elapsed+(h.type==='tentacle'?.69:1));
    hurtPlayer(h.damage,h.type==='poisonPlant'?'poison':'received');
    if(h.type==='poisonPlant')player.neurotoxinUntil=performance.now()+1150;
   }
  }
  // The companion is also vulnerable to every active hazard, even when
  // the diver's own anatomical hitboxes are outside the affected area.
  const specimen=player.specimen;
  if(specimen?.alive&&RIFT_HARDCORE.hit(h,specimen.x,specimen.y,specimen.r,phase)){
   specimen.riftImpactUntil ||= Object.create(null);
   const now=performance.now(),key=String(h.id);
   if(now>=(Number(specimen.riftImpactUntil[key])||0)){
    specimen.riftImpactUntil[key]=now+(h.type==='tentacle'?690:1000);
    hurtSpecimenSolo(Math.max(2,Number(h.damage)||7)*.72);
   }
  }
  // Hazards belong to the world, not to a player's weapon. They can kill
  // creatures, elites and bosses, except Nightmare's immunity to own arms.
  for(const enemy of [...enemies]){
   if(!enemy||enemy.hp<=0||(enemy.spawnedAt&&Date.now()-enemy.spawnedAt<3000)||(h.type==='tentacle'&&enemy.kind===RIFT_HARDCORE.FINAL_KIND))continue;
   if(!RIFT_HARDCORE.hit(h,enemy.x,enemy.y,Math.min(43,enemy.r*.48),phase))continue;
   enemy.riftHazardCooldowns ||= Object.create(null);
   if(elapsed<(enemy.riftHazardCooldowns[h.id]||0))continue;
   enemy.riftHazardCooldowns[h.id]=elapsed+(h.type==='tentacle'?.75:1.1);
   dealEnemyDamage(enemy,h.damage,'rift-hazard-'+h.type,{silentSound:true,secondary:true});
  }
 }
 // Pesadelo Roxo is static in the chamber, with a distinct lethal head.
 // Eight environmental tentacles now supply the entire offensive arm pattern.
 for(const enemy of enemies){
  if(enemy.kind!==RIFT_HARDCORE.FINAL_KIND||enemy.hp<=0||room?.id!=='boss')continue;
  const threshold=enemy.r*.85;
  if(DIVER_HITBOX?.circleHit?.(player,enemy.x,enemy.y,threshold,performance.now())&&
   performance.now()>(enemy.headTouchAt||0)){
   enemy.headTouchAt=performance.now()+900;
   hurtPlayer(50);
  }
 }
 riftBossMarks=[];
}
function hurtPlayer(dmg,tone='received'){
 if(player.invuln>0)return;if(upgrades.shield>0){upgrades.shield--;player.invuln=.7;burst(player.x,player.y,'#7ceff2',18,130);playSkillSound('shield','trigger');playWorldSound('shield-hit',player,600,.75);showToast('ESCUDO ABSORVEU O IMPACTO');return}
 const shellReduction=Math.min(.24,Math.max(0,Number(upgrades.shell)||0)*.08),lowHealthReduction=(hp<=maxHp*.3&&upgrades.lastStand>0)?(.15+Math.min(3,upgrades.lastStand)*.05):0;const received=Math.max(1,dmg*specimenPassiveMultiplier('defense')*(1-shellReduction)*(1-lowHealthReduction));cancelSoloHullRepair();hp-=received;spawnDamageNumber(player.x,player.y,received,tone);player.invuln=.8;shake=8;damageFlash=.25;burst(player.x,player.y,'#ff668d',14,120);playWorldSound('player-hit',player,900,.95);if(hp<=0){if(isRiftRun())respawnSoloRiftCheckpoint();else endGame();}
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
  queueEffect({type:'ring',x:pos.x,y:pos.y,r:0,max:Math.max(18/worldZoom,e.r*1.4),life:.28,maxLife:.28,color:'#ff5c7c'});
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
 const centerValid=measuredDistance<=radius+2&&reportedDistance<=radius+2;
 const radiusWithEnemy=Math.max(2,Number(data.enemyRadius)-Number(data.contactSafetyMargin||0));
 const bodyZone=data.hitZone&&DIVER_HITBOX?.circleHit?.({x:px,y:py,r:Number(data.playerR)||player?.r||13/GAME_WORLD_ZOOM,bodyAngle:Number(data.bodyAngle)||0,weaponAngle:Number(data.weaponAngle??data.bodyAngle)||0},source.x,source.y,radiusWithEnemy,Number(data.serverTime)||0);
 const anatomicalValid=Boolean(data.hitZone&&data.hitZone!=='tentacle'&&bodyZone===data.hitZone);
 const tentacleValid=data.hitZone==='tentacle'&&window.AbyssalEnemyAI?.tentacleContact?.({kind:source.kind,specimenSkinId:data.enemySkinId,x:source.x,y:source.y,r:Number(data.enemyRadius),angle:Number(data.enemyAngle)||0,phase:Number(data.enemyPhase)||0},{x:px,y:py,r:Number(data.playerR)||13/GAME_WORLD_ZOOM},Number(data.enemyRadius),SPECIMEN_SYSTEM.familyFor(data.enemySkinId));
 const geometryValid=sourceMismatch<=2&&Math.abs(measuredDistance-reportedDistance)<=3&&(centerValid||anatomicalValid||tentacleValid);
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
 if(Number(data.neurotoxinMs)>0)player.neurotoxinUntil=performance.now()+Math.min(100,Number(data.neurotoxinMs));
 if((data.reason==='enemy-attack'||data.reason==='boss-ability'||data.reason==='pvp-hit'||data.reason==='pvp-defeat')&&Number(data.damage)>0){spawnDamageNumber(player.x,player.y,Number(data.damage),'received');
  if(contactSourceReady)revealOnlineContactSource(data);
  else if(!data.targetWasHidden){window.AbyssalOnline?.requestWorldSnapshot?.('contact-resync');}
  if(data.source==='enemy'&&data.enemyId!=null)renderHostileContactAbility(data);
  shake=Math.max(shake,data.source==='boss-ability'?10:7);damageFlash=.24;burst(player.x,player.y,'#ff668d',16,125);playWorldSound('player-hit',player,850,.85);
 }else if(data.reason==='shield-block'||data.reason==='pvp-shield'||data.blocked){
  if(contactSourceReady)revealOnlineContactSource(data);
  burst(player.x,player.y,'#7ceff2',16,110);playSkillSound('shield','trigger');playWorldSound('shield-hit',player,800,.82);
 }else if(data.reason==='regeneration'&&Number(data.healed)>0)playSkillSound('regen','trigger');
 updateHud();
 if(data.alive===false&&gameState!=='over'&&!isRiftRun()){endGame();}
}
let lastOnlineVitalsAt=0;
function gainXp(value, source='shared'){
 if(!Number.isFinite(value)||value<=0||!player)return;
 const skinMultiplier=source!=='shared'&&!onlineMode?Math.min(1.26,Math.max(1,Number(upgrades.magnet)||1)):1;
 if(!onlineMode&&source==='kill'){diveStats.energyCollected+=value;energyWallet?.credit(value);}
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
function spawnNovaVisual(x,y,max,color='#72f5ff',pvp=onlineRoomMode==='pvp',angle=0,combined=false){
 const radius=Math.max(1,Number(max)||294/GAME_WORLD_ZOOM);
 queueEffect({type:'nova-core',x,y,r:0,max:Math.min(radius*.14,48/GAME_WORLD_ZOOM),life:.34,maxLife:.34,color});
 // Calculate obstruction only once per pulse; rendering reuses the clipped fan.
 const half=window.AbyssalGravityCone?.HALF_ANGLE||Math.PI/4;
 const fan=[];
 for(let i=0;i<=20;i++){
  const a=angle-half+(2*half*i/20),endX=x+Math.cos(a)*radius,endY=y+Math.sin(a)*radius;
  const clipped=clipPrismaticPhotonRay(x,y,endX,endY,2/GAME_WORLD_ZOOM);
  fan.push({angle:a,radius:Math.hypot(clipped.x2-x,clipped.y2-y)});
 }
 queueEffect({type:'gravity-cone',x,y,max:radius,angle,combined,fan,life:.58,maxLife:.58,color});
 if(!pvp)burst(x,y,color,lowPowerRendering?9:16,90);
}
function spawnProjectileDissolve(x,y,color='#9bbcff',special=null,blocked=false){
 const palette=special==='electric'?'#8ff8ff':special==='photon'?'#ffb8fa':special==='pierce'?'#ffd980':special==='spread'?'#d8b4fe':color;
 burst(x,y,palette,blocked?11:8,blocked?105:78);
 queueEffect({type:'projectile-dissolve',x,y,r:0,max:(blocked?24:18)/GAME_WORLD_ZOOM,life:.24,maxLife:.24,color:palette});
}
// Source-based colors prevent skin damage from being confused with weapon hits.
const SKIN_DAMAGE_SKILLS=new Set(['skin-active-dash','skin-active-cloud','skin-active-trail','skin-active-push','skin-active-poison','skin-active-poison-dot','skin-active-paralysis','skin-active-shot','skin-active-slowShot','skin-active-pulse']);
const PERIODIC_SKIN_DAMAGE_SKILLS=new Set(['skin-active-trail','skin-active-poison-dot']);
function damageTone(skillId=''){
 const id=String(skillId||'');
 if(SKIN_DAMAGE_SKILLS.has(id))return 'skin';
 if(id==='rift-hazard-poisonPlant')return 'poison';
 if(RESONANCE_CATEGORIES.passive.includes(id)||['gravitationalRupture','arcChain'].includes(id))return 'passive';
 return 'shot';
}
function showPeriodicSkinDamageNumber(enemy){
 if(!enemy)return false;
 const now=performance.now(),last=Number(enemy.skinDamageNumberAt)||-Infinity;
 if(now-last<850)return false;
 enemy.skinDamageNumberAt=now;
 return true;
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

const INFUSION_SHOT_TYPES=new Set(['physical','power','electric','pierce','photon','photonRay','nova','prismShard','spread','echoShot','ricochet']);
function enemyParalyzedNow(e){const until=Number(e?.paralyzedUntil)||0;return until>1e11?Date.now()<until:performance.now()<until;}
function applySoloWeaponInfusionHit(enemy,sourceSkill){
 if(onlineMode||!player||!enemy||enemy.hp<=0||performance.now()>=Number(player.skinWeaponBuffUntil||0))return;
 const kind=player.skinWeaponBuffKind,skill=String(sourceSkill||'physical');
 if(!INFUSION_SHOT_TYPES.has(skill))return;
 const now=performance.now();
 if(now<(Number(enemy.weaponInfusionNextAt)||0))return;
 enemy.weaponInfusionNextAt=now+500;
 if(kind==='paralysis'){
  enemy.paralyzedUntil=Math.max(Number(enemy.paralyzedUntil)||0,now+100);
  burst(enemy.x,enemy.y,'#62edff',5,42);
 }else if(kind==='poison'){
  if(!(enemy.poisonTimer>0))enemy.poisonTick=.5;
  enemy.poisonTimer=Math.max(Number(enemy.poisonTimer)||0,2.5);
  enemy.weaponPoisonUntil=now+2500;
  burst(enemy.x,enemy.y,'#b46bfa',5,38);
 }
}
function triggerHitSynergies(primaryTarget,baseDamage,sourceSkill,options={}){
 if(!primaryTarget||!Number.isFinite(baseDamage)||baseDamage<=0||options.secondary)return;
 const source=String(sourceSkill||'physical');
 // Hit modifiers are geometry-agnostic: projectiles, beams and radial attacks all participate.
 if(source==='electric'&&(options.submarineShot||(upgrades.electric||0)>0)&&!onlineMode){
  let chains=0,from=primaryTarget;const level=options.submarineShot?1:Math.max(1,Math.min(3,Number(upgrades.electric)||1)),visited=new Set([primaryTarget.id]),range=190/GAME_WORLD_ZOOM;
  while(chains<level){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(other.hp>0&&!visited.has(other.id)&&d<range&&d<nd&&pveProjectileTerrainClear(from.x,from.y,other.x,other.y,2)){next=other;nd=d}}if(!next)break;queueEffect({type:'electric-arc',x1:from.x,y1:from.y,x2:next.x,y2:next.y,seed:(Number(from.id)||chains)*17+(Number(next.id)||0),life:.22,maxLife:.22,color:'#31eaff',width:4.2/GAME_WORLD_ZOOM});dealEnemyDamage(next,baseDamage*shotBalanceValue('electric','chainDamage',level,.34),'electric',{secondary:true,origin:from});visited.add(next.id);from=next;chains++;}
 }


 if((upgrades.ricochet||0)>0&&source!=='ricochet'&&!onlineMode){
  let from=primaryTarget;const visited=new Set([primaryTarget.id]);for(let bounce=0;bounce<Math.min(3,upgrades.ricochet);bounce++){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(other.hp>0&&!visited.has(other.id)&&d<190/GAME_WORLD_ZOOM&&d<nd&&pveProjectileTerrainClear(from.x,from.y,other.x,other.y,2)){next=other;nd=d}}if(!next)break;queueEffect({type:'ricochet-line',x1:from.x,y1:from.y,x2:next.x,y2:next.y,life:.18,maxLife:.18,color:'#f7ff19',width:3.4/GAME_WORLD_ZOOM});playWorldSound('shot-ricochet',next,650,.46);burst(next.x,next.y,'#f7ff19',8,90);dealEnemyDamage(next,baseDamage*.42,'ricochet',{secondary:true,origin:from});visited.add(next.id);from=next;}
 }
}
// A focused hunter should specialize in elite pressure and finishing weakened
// targets, instead of being a strictly weaker generic damage multiplier.
function predatorDamageMultiplier(enemy){
 const rank=Math.min(3,Math.max(0,Number(upgrades.predator)||0));
 if(!rank)return 1;
 const elite=Boolean(enemy&&(BOSS_KINDS.includes(enemy.kind)||enemy.elite===true||enemy.isElite===true));
 const finisher=Number(enemy?.maxHp)>0&&Number(enemy?.hp)/Number(enemy.maxHp)<=.30;
 return 1+rank*(elite?.14:.03)+(finisher?rank*.06:0);
}
function dealEnemyDamage(enemy, damage, skillId=null, options={}){
  if(!enemy||enemy.hp<=0||!Number.isFinite(damage)||damage<=0)return;
 if(activeMapLayout&&enemy.spawnedAt&&Date.now()-enemy.spawnedAt<3000)return;
 if(onlineRoomMode!=='pvp'&&player&&!String(skillId||'').startsWith('rift-hazard-')&&skillId!=='skin-active-poison-dot'){const origin=options.origin||player;const ranged=options.projectile||options.submarineShot||['electric','pierce','photon','photonRay','nova','echoShot','prismShard','ricochet','skin-active-shot','skin-active-slowShot'].includes(skillId);if(!(ranged?pveProjectileTerrainClear:pveTerrainClear)(origin.x,origin.y,enemy.x,enemy.y,2))return;}
 if(onlineMode&&options.submarineShot&&window.AbyssalOnline?.getSocketId?.()!==onlineSubmarineControllerId){enemy.hit=.12;return;}
 score += Math.round(damage);
 if(options.silentSound!==true&&!options.secondary)playWorldSound('enemy-hit',enemy,620,.62);
 if(skillId&&options.silentSound!==true)playSkillSound(skillId,'trigger');
 if(upgrades.vitalDrain&&player&&Number.isFinite(damage)&&damage>0){const actualDamage=Math.min(damage,Math.max(0,Number(enemy?.hp)||damage))*predatorDamageMultiplier(enemy);hp=Math.min(maxHp,hp+actualDamage*.02);}

 if(onlineMode){
   const distance=Math.hypot(player.x-enemy.x,player.y-enemy.y),predatorMultiplier=predatorDamageMultiplier(enemy),closeMultiplier=distance<=175/GAME_WORLD_ZOOM?1+Math.min(.54,Math.max(0,Number(upgrades.closePressure)||0)*.18):1,queuedDamage=Number(damage)*predatorMultiplier*closeMultiplier;
   const actionId=String(options.actionId||nextCombatActionId(skillId));
   onlineDamageQueue.push({id:Number(enemy.id),damage:queuedDamage,skillId:String(options.submarineShot?'submarine-'+skillId:skillId||'').slice(0,32),actionId});
   // Predict only presentation. HP remains server-authoritative and is reconciled by actionId.
   if(options.visual!==false)predictCombatImpact(enemy,queuedDamage,skillId,actionId);
   else enemy.hit=.14;
   triggerHitSynergies(enemy,queuedDamage,skillId,options);
   return;
 }
 const distance=Math.hypot(player.x-enemy.x,player.y-enemy.y);
 const multiplier=specimenPassiveMultiplier('damage')*(BOSS_KINDS.includes(enemy.kind)?specimenPassiveMultiplier('bossDamage'):1),closeMultiplier=distance<=175/GAME_WORLD_ZOOM?1+Math.min(.54,Math.max(0,Number(upgrades.closePressure)||0)*.18):1;
 const appliedDamage=damage*predatorDamageMultiplier(enemy)*closeMultiplier*multiplier;diveStats.damageDealt+=Math.min(appliedDamage,Math.max(0,Number(enemy.hp)||0));applySoloWeaponInfusionHit(enemy,skillId);enemy.hp-=appliedDamage;enemy.hit=.14;if(activeMapLayout||enemy.wildlifeMode)enemy.provokedUntil=performance.now()+6500;if(options.visual!==false)spawnDamageNumber(enemy.x,enemy.y,appliedDamage,damageTone(skillId));
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
function rebuildEnemyCollisionGrid(){
 enemyCollisionGrid.clear();enemyCollisionBucketCount=0;enemyCollisionCellSize=270;
 for(const enemy of enemies){
  if(!enemy||enemy.hp<=0)continue;
  const gx=Math.floor(enemy.x/enemyCollisionCellSize),gy=Math.floor(enemy.y/enemyCollisionCellSize),key=gy*65536+gx;
  let bucket=enemyCollisionGrid.get(key);
  if(!bucket){bucket=enemyCollisionBuckets[enemyCollisionBucketCount]||(enemyCollisionBuckets[enemyCollisionBucketCount]=[]);bucket.length=0;enemyCollisionBucketCount++;enemyCollisionGrid.set(key,bucket);}
  bucket.push(enemy);
 }
}
function collectEnemyCandidatesNear(x,y,r,out=areaEnemyCandidates){
 out.length=0;if(!enemyCollisionGrid.size){for(const enemy of enemies)if(enemy&&enemy.hp>0)out.push(enemy);return out;}
 const minX=Math.floor((x-r)/enemyCollisionCellSize),maxX=Math.floor((x+r)/enemyCollisionCellSize),minY=Math.floor((y-r)/enemyCollisionCellSize),maxY=Math.floor((y+r)/enemyCollisionCellSize);
 for(let gy=minY;gy<=maxY;gy++)for(let gx=minX;gx<=maxX;gx++){const bucket=enemyCollisionGrid.get(gy*65536+gx);if(bucket)for(const enemy of bucket)out.push(enemy);}
 return out;
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
  const receivedAt=performance.now(),enemy={...raw,id:raw.id,x,y,r:Math.max(2,Number(raw.r)||12)/GAME_WORLD_ZOOM,serverX:x,serverY:y,interpFromX:x,interpFromY:y,interpTargetX:x,interpTargetY:y,interpAt:receivedAt,interpDuration:0,hit:0,authoritativePosition:true,motionSamples:[]};window.AbyssalEnemyNetcode?.pushMotionSample?.(enemy,{x,y,serverTime:serverTime||Date.now(),receivedAt});
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
 if(data.map)setActiveMapDescriptor(data.map);
 if(data.submarine&&onlineRoomMode==='coop'){
  if(!soloSubmarine.sections.length||Math.abs(soloSubmarine.x-(Number(data.submarine.x)||W*.5))>1||Math.abs(soloSubmarine.y-(Number(data.submarine.y)||H*.39))>1){soloSubmarine.x=Number(data.submarine.x)||W*.5;soloSubmarine.y=Number(data.submarine.y)||H*.39;soloSubmarine.sections=[];ensureSoloHull();}
  soloSubmarine.powerSeconds=Math.max(0,Number(data.submarine.powerSeconds)||0);onlineSubmarineControllerId=String(data.submarine.controllerId||'')||null;onlineSubmarineWeapons=Array.isArray(data.submarine.weapons)?[...data.submarine.weapons]:onlineSubmarineWeapons;
  let hullChanged=false;for(const remote of data.submarine.sections||[]){const local=soloSubmarine.sections.find(s=>s.id===Number(remote.id));if(!local)continue;const next=clamp(Number(remote.hp)||0,0,SOLO_HULL_HP);if(local.hp!==next){if(local.hp>0&&next===0){const scale=1/GAME_WORLD_ZOOM;for(let i=0;i<12;i++){const a=i*2.399;soloSubmarine.debris.push({x:local.x+Math.cos(a)*55*scale,y:local.y+Math.sin(a)*45*scale,vx:Math.cos(a)*(15+i*3)*scale,vy:(20+i*5)*scale,angle:a,spin:(i%2?1:-1)*(.4+i*.09),size:(7+i%5*3)*scale,life:3});}}if((local.hp>0)!==(next>0))hullChanged=true;local.hp=next;}}
  if(hullChanged)syncSoloHull();
  const repair=data.submarine.repair,section=repair?soloSubmarine.sections.find(s=>s.id===Number(repair.sectionId)):null;
  if(repair&&section&&String(repair.playerId)===String(window.AbyssalOnline?.getSocketId?.())){const point=soloRepairSurface(section,player?.x||section.x,player?.y||section.y);soloSubmarine.repair={section,point,startX:player?.x||0,startY:player?.y||0,startedAt:Number(repair.startedAt)||Date.now(),endsAt:Number(repair.endsAt)||Date.now()+ONLINE_HULL_REPAIR_SECONDS*1000,elapsed:Math.max(0,(Date.now()-(Number(repair.startedAt)||Date.now()))/1000),online:true};}
  else if(soloSubmarine.repair?.online)soloSubmarine.repair=null;
 }
 if(isRiftRun()&&data.depthState)window.dispatchEvent(new CustomEvent('abyssal-depth-state',{detail:data.depthState}));
 if(data.bossesDefeated!=null&&Number.isFinite(Number(data.bossesDefeated))){
  const defeated=Math.max(0,Math.floor(Number(data.bossesDefeated)||0));
   // Always use the authoritative world value for online cave portal unlocks.
   onlineBossesDefeated=defeated;
  const cycleLength=Math.max(1,bossCycleBosses.length||PROGRESSION_CYCLE_BOSS_SEQUENCE.length);
  bossProgressionCycle=Math.min(PROGRESSION_MAX_CYCLES,Math.floor(defeated/cycleLength));
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
 // Full and compact snapshots share the same timestamped motion history.
 if(window.AbyssalEnemyNetcode?.reconcileSnapshot){
  enemies=window.AbyssalEnemyNetcode.reconcileSnapshot(enemies,data.enemies,{radiusScale:1/GAME_WORLD_ZOOM,maxX:W,maxY:H,minX:0,minY:0,now,interpolationMs:72,serverTime:incomingServerTime,criticalIds:authoritativeCriticalIds||data.criticalEnemyIds||[],resetMotion:forceResync});
 }else{
  // Fallback mirrors the authoritative interpolation module instead of running a
  // second enemy simulation in the browser.
  enemies=data.enemies.map(raw=>{const old=previousById.get(raw.id),serverX=clamp(Number(raw.x)||0,0,W),serverY=clamp(Number(raw.y)||0,0,H),from=old?currentInterpolatedEnemyPosition(old,now):{x:serverX,y:serverY};return {...old,...raw,x:from.x,y:from.y,r:Math.max(2,Number(raw.r)||12)/GAME_WORLD_ZOOM,serverX,serverY,interpFromX:from.x,interpFromY:from.y,interpTargetX:serverX,interpTargetY:serverY,interpAt:now,interpDuration:(old&&!authoritativeCriticalIds.includes(String(raw.id)))?72:0,authoritativePosition:true};});
 }
 onlineEnemyById=new Map();for(const enemy of enemies)onlineEnemyById.set(String(enemy.id),enemy);
 orbs=(Array.isArray(data.orbs)?data.orbs:[]).map(o=>({id:o.id,x:Number(o.x)||0,y:Number(o.y)||0,value:Math.max(1,Number(o.value)||1)}));onlineOrbById=new Map(orbs.map(o=>[String(o.id),o]));
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
 // Contact packets carry the exact attacker position used by server-side damage.
 // Pull the already-rendered attacker toward that point immediately so damage can
 // never arrive from a creature that is visibly stranded somewhere else.
 const contactNow=performance.now();
 for(const raw of enemyRows){
  const id=String(raw.id),enemy=onlineEnemyById.get(id);if(!enemy)continue;
  const tx=clamp(Number(raw.x)||0,0,W),ty=clamp(Number(raw.y)||0,0,H),gap=Math.hypot(tx-(Number(enemy.x)||0),ty-(Number(enemy.y)||0));
  enemy.serverX=tx;enemy.serverY=ty;enemy.snapshotReceivedAt=contactNow;
  enemy.motionSamples=[];enemy.motionRenderTime=null;enemy.motionRenderAt=null;enemy.motionCorrection=null;
  window.AbyssalEnemyNetcode?.pushMotionSample?.(enemy,{x:tx,y:ty,serverTime:serverTime||Date.now(),receivedAt:contactNow});
  enemy.interpFromX=Number(enemy.x)||tx;enemy.interpFromY=Number(enemy.y)||ty;enemy.interpTargetX=tx;enemy.interpTargetY=ty;enemy.interpAt=contactNow;enemy.interpDuration=gap>90/GAME_WORLD_ZOOM?0:45;
  if(gap>90/GAME_WORLD_ZOOM){enemy.x=tx;enemy.y=ty;}
 }
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
 const now=performance.now(),serverInterval=clamp(Number(data.intervalMs)||50,30,250),orbInterval=clamp(Number(data.orbIntervalMs)||250,120,650);
 if(Number.isFinite(Number(data.elapsed))){authoritativeElapsed=Math.max(0,Number(data.elapsed));lastSnapshotAt=now;lastSnapshotTick=Number(data.tickCount)||lastSnapshotTick;}
 let moved=0;
 for(const row of data.enemies){
  if(!Array.isArray(row)||row.length<7)continue;
  const enemy=onlineEnemyById.get(String(row[0]));if(!enemy)continue;
  const tx=clamp(Number(row[1])||0,0,W),ty=clamp(Number(row[2])||0,0,H);
  const previousServerX=Number.isFinite(Number(enemy.serverX))?Number(enemy.serverX):Number(enemy.x)||tx;
  const previousServerY=Number.isFinite(Number(enemy.serverY))?Number(enemy.serverY):Number(enemy.y)||ty;
  const current=window.AbyssalEnemyNetcode?.renderedPosition?.(enemy,now)||currentInterpolatedEnemyPosition(enemy,now);
  const sampleMs=Number.isFinite(Number(enemy.snapshotReceivedAt))?clamp(now-Number(enemy.snapshotReceivedAt),30,250):serverInterval;
  const maxV=(enemy.kind==='whiteShark'||enemy.kind==='whiteSharkBoss')?450:220;
  const vx=clamp((tx-previousServerX)/(sampleMs/1000),-maxV,maxV),vy=clamp((ty-previousServerY)/(sampleMs/1000),-maxV,maxV);
  const teleport=Math.hypot(tx-current.x,ty-current.y)>260;
  // Lead one fraction of the server update and animate until its next 125ms packet.
  const visualDuration=teleport?0:clamp(sampleMs,45,90);
  enemy.x=teleport?tx:current.x;enemy.y=teleport?ty:current.y;
  enemy.serverX=tx;enemy.serverY=ty;enemy.snapshotReceivedAt=now;
  if(teleport){enemy.motionSamples=[];enemy.motionRenderTime=null;enemy.motionRenderAt=null;}
  window.AbyssalEnemyNetcode?.pushMotionSample?.(enemy,{x:tx,y:ty,serverTime:serverTime||Date.now(),receivedAt:now});
  enemy.interpFromX=enemy.x;enemy.interpFromY=enemy.y;
  enemy.interpTargetX=tx;enemy.interpTargetY=ty;
  enemy.interpAt=now;enemy.interpDuration=visualDuration;
  enemy.vx=vx;enemy.vy=vy;
  const incomingRevision=Math.max(0,Number(row[4])||0),currentRevision=Math.max(0,Number(enemy.damageRevision)||0);
  if(incomingRevision>=currentRevision){enemy.hp=Math.max(0,Number(row[3])||0);enemy.damageRevision=incomingRevision;}
  enemy.angle=Number(row[5])||0;enemy.phase=Number(row[6])||0;
  if(enemy.wildlifeMode&&row.length===10){enemy.aiIndicator=['','attack','evaluate','flee'][Number(row[7])||0]||null;enemy.wildlifeAbilityId=String(row[8]||'');enemy.wildlifeAbilityUntil=performance.now()+Math.max(0,Number(row[9])||0);}
  enemy.suctionActive=row[7]===true;enemy.suctionTimer=Math.max(0,Number(row[8])||0);enemy.suctionCooldown=Math.max(0,Number(row[9])||0);enemy.suctionPulse=Math.max(0,Number(row[10])||0);enemy.krakenSweepActive=row[11]===true;enemy.krakenTelegraph=clamp(Number(row[12])||0,0,1);enemy.krakenSweepCycle=Math.max(0,Number(row[13])||0);
  if(Math.hypot(tx-current.x,ty-current.y)>.02)moved++;
 }
 onlineVisualEnemyCount=enemies.length;onlineVisualMovingEnemies=moved;
}
function applySharedDamage(data){ /* Dano é resolvido diretamente no servidor; mantido apenas por compatibilidade. */ }
function applySharedXp(data){
 if(!onlineMode||!data||!player)return;
 gainXp(Math.max(0,Number(data.value)||0),'shared');
}
function spawnOnlineOrb(data){
 if(!onlineMode||!data||data.id==null||onlineOrbById.has(String(data.id)))return;
 const orb={id:data.id,x:Number(data.x)||0,y:Number(data.y)||0,value:Math.max(1,Number(data.value)||1)};
 onlineOrbById.set(String(orb.id),orb);orbs.push(orb);
 if(orbs.length>160){const removed=orbs.shift();onlineOrbById.delete(String(removed.id));}
}
function collectOnlineOrb(data){
 if(!onlineMode||!data)return;
 onlineOrbById.delete(String(data.id));orbs=orbs.filter(o=>String(o.id)!==String(data.id));
}
window.addEventListener('abyssal-orb-spawn',event=>spawnOnlineOrb(event.detail));
window.addEventListener('abyssal-orb-collect',event=>collectOnlineOrb(event.detail));
let soloOrbSequence=0;
function spawnSoloOrb(x,y,value){
 if(onlineMode)return;
 if(orbs.length>=160)orbs.shift();
 if(isClassicShooterRun()&&SOLO_CAVERN){const water=SOLO_CAVERN.nearestWater(arenaRocks,W,H,x,y,9/GAME_WORLD_ZOOM);if(water){x=water.x;y=water.y;}}
 orbs.push({id:'solo-'+(++soloOrbSequence),x,y,value:Math.max(1,Math.round(Number(value)||1))});
}
function tickSoloSpecimenOrbs(){
 if(onlineMode||!player||!orbs.length)return;
 const s=player.specimen,range=294/GAME_WORLD_ZOOM*(Number(upgrades.range)||1)*specimenPassiveMultiplier('range');
 for(let i=orbs.length-1;i>=0;i--){
  const o=orbs[i],distance=Math.hypot(player.x-o.x,player.y-o.y);
  // Only the living equipped specimen can collect an energy orb.
  const petContact=s?.alive&&distance<=range&&Math.hypot(s.x-o.x,s.y-o.y)<=s.r+7/GAME_WORLD_ZOOM&&pveTerrainClear(s.x,s.y,o.x,o.y,0);
  if(!petContact)continue;
  orbs.splice(i,1);gainXp(o.value,'kill');
 }
}
function drawExperienceOrbs(t){
 for(const orb of orbs){
  if(orb.x<cameraX-20/worldZoom||orb.x>cameraX+viewW/worldZoom+20/worldZoom||orb.y<cameraY-20/worldZoom||orb.y>cameraY+viewH/worldZoom+20/worldZoom)continue;
  const pulse=.82+.18*Math.sin(t*.003);
  ctx.save();ctx.globalAlpha=pulse;ctx.fillStyle='#bc79ff';ctx.shadowColor='#8a3bff';ctx.shadowBlur=lowPowerRendering?0:9/GAME_WORLD_ZOOM;
  ctx.beginPath();ctx.arc(orb.x,orb.y,4.5/GAME_WORLD_ZOOM,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='#f3dfff';ctx.lineWidth=1/GAME_WORLD_ZOOM;ctx.stroke();ctx.restore();
 }
}
function sendWorldSnapshot(dt){ /* O snapshot pertence ao servidor, não aos clientes. */ }
function killEnemy(i){
 const e=enemies[i];
 if(!e)return;if(!onlineMode)diveStats.monstersKilled++;
 if(!onlineMode&&isOpenSeaRun()&&e?.streamId)soloOceanRespawn?.mark(e.streamId,Date.now());
 const proficiencyBoss=BOSS_KINDS.includes(e.kind);
 if(!onlineMode&&specimenAlive()){
  specimenProficiency=SPECIMEN_SYSTEM?.addKill?.(specimenProficiency,equippedSkin,proficiencyBoss)||specimenProficiency;recordSoloAdaptation(equippedSkin,proficiencyBoss);
   const pet=player?.specimen;if(pet){const next=SPECIMEN_SYSTEM.effectiveStats(equippedSkin,specimenPoints()).hp;pet.hp=Math.min(next,pet.hp+Math.max(0,next-pet.maxHp));pet.maxHp=next;}
  saveSpecimenProficiencyLocal();syncSoloAdaptation();
 }
 const killedBoss=BOSS_KINDS.includes(e.kind);if(killedBoss){bossKillsThisRun++;pendingSoloDepthEventId=EXPEDITION_RULES?.chooseEvent?.(Math.random,bossKillsThisRun)||null;updateHud();publishSoloDepthState();}
 discoverCodexMonsters([e.kind]);if(!onlineMode){
 const eventXp=EXPEDITION_RULES?.eventXpMultiplier?.(soloDepthEventId)||1,sizeScale=clamp((e.r*GAME_WORLD_ZOOM)/10,.65,10),xpValue=Math.max(1,Math.round((killedBoss?e.value*getBossXpMultiplier():e.value*eventXp)*(.65+sizeScale*.55))),baseOrbXp=Math.max(1,Math.round(xpValue*.22)),scaledXp=!killedBoss&&requestedRunMode!=='rift'?Math.max(1,Math.round(SEA_PROGRESSION?.scaleXp?.(baseOrbXp,e.seaXpMultiplier)||baseOrbXp)):baseOrbXp;spawnSoloOrb(e.x,e.y,scaledXp);
 if(!killedBoss&&e.eliteId&&e.spawnRoomId==='elite'&&soloEliteRewardTier!==activeMapTier){
  soloEliteRewardTier=activeMapTier;spawnSoloOrb(e.x,e.y,Math.max(1,Math.round((EXPEDITION_RULES?.eliteRoomBonusValue?.(activeMapTier)||18)*.22)));
  window.dispatchEvent(new CustomEvent('abyssal-cave-signal',{detail:{id:'elite_cache',type:'reward',name:'CACHE DE ELITE',subtitle:'A assinatura vermelha colapsou e liberou um núcleo de experiência.',risk:'VENCIDO',reward:'BÔNUS DE ELITE',accent:'#ff5577',tier:activeMapTier}}));
 }
}burst(e.x,e.y,e.color,killedBoss?(e.kind==='kraken'?56:48):e.kind==='brute'?22:12,killedBoss?250:e.kind==='brute'?145:95);if(killedBoss){if(!onlineMode&&!soloRunIdentity?.key)energyWallet?.credit(10,'offline-reward');addNotification('Você ganhou 10 de energia por derrotar um boss.','RECOMPENSA DE BOSS · +10 ENERGIA','energy');saveCosmetics();if(!onlineMode&&expeditionMode){expeditionRiskTier=bossKillsThisRun;}}
   enemies.splice(i,1);aquaticMotionTracker?.forget?.(e.id);if(killedBoss&&!onlineMode&&requestedRunMode==='rift'){const finalClear=activeMapTier===(RIFT_HARDCORE?.FINAL_TIER??7)&&e.kind===RIFT_HARDCORE?.FINAL_KIND;if(finalClear){riftBossMarks=[];showToast('FOSSAS CONCLUÍDAS · RESGATE O BAÚ FINAL');}else showToast('VÓRTICES LIBERADOS · ESQUERDA: SUPERFÍCIE · DIREITA: DESCIDA');updateMapInteraction(true);}playWorldSound(killedBoss?'boss-death-'+e.kind:'enemy-death',e,killedBoss?1200:620,killedBoss?1:.62);updateHud(killedBoss);
}
function getLocalSkinCursorAngle(){
 // Rendering only. Auto-fire and server-authoritative abilities must continue
 // using player.angle, which may intentionally point away from the mouse.
 if(!player)return 0;
 const fallback=Number(player.visualAimAngle);
 if(isMobileDevice()||!Number.isFinite(pointer.clientX)||!Number.isFinite(pointer.clientY))return Number(player.angle)||0;
 const rect=canvas.getBoundingClientRect();
 const dx=cameraX+(pointer.clientX-rect.left)/worldZoom-player.x;
 const dy=cameraY+(pointer.clientY-rect.top)/worldZoom-player.y;
 // Crossing the center of the creature should not produce a wild flip.
 if(dx*dx+dy*dy<Math.max(4,player.r*.4)**2)return Number.isFinite(fallback)?fallback:(Number(player.angle)||0);
 player.visualAimAngle=Math.atan2(dy,dx);
 return player.visualAimAngle;
}
function specimenPassiveMultiplier(attribute){
 const profile=SKIN_STANDARD?.profile?.(equippedSkin);
 if(!profile||profile.attribute!==attribute||!specimenPassiveActive())return 1;
 return SPECIMEN_SYSTEM?.passiveMultiplier?.(profile,specimenPoints(),true)??SKIN_STANDARD.passiveMultiplier(equippedSkin,attribute);
}
function getFiringRange(){if(upgrades.abyssEye)return Math.min(Math.hypot(W,H),2000/GAME_WORLD_ZOOM);return 294*(upgrades.range||1)*specimenPassiveMultiplier('range')/GAME_WORLD_ZOOM;}
const BASE_SHOT_INTERVAL=.52,NOVA_SOLO_INTERVAL=1.8;
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
function baseShotProfile(id,level=1){return {speed:430*shotBalanceValue(id,'speed',level,1)/GAME_WORLD_ZOOM,radius:shotBalanceValue(id,'radius',level,4.1+(level-1)*.55)/GAME_WORLD_ZOOM,color:id==='echoShot'?'#5ef0d0':id==='photon'?'#f0abfc':id==='electric'?'#eaffff':id==='pierce'?'#ffe7a1':'#83fff3',offsets:id==='echoShot'?[-.045,.045]:[0]};}
function emitBaseShotMuzzle(muzzle,a,id,color,count){const {x,y}=muzzle;burst(x,y,color,count>1?9:5,count>1?90:45);if(id==='photon')queueEffect({type:'photon-flash',x1:x,y1:y,x2:x+Math.cos(a)*46/GAME_WORLD_ZOOM,y2:y+Math.sin(a)*46/GAME_WORLD_ZOOM,width:2.2/GAME_WORLD_ZOOM,life:.08,maxLife:.08,color:'#ff9cf6'});}
function refreshPhotonBeam(key,value,x1,y1,x2,y2,width){let beam=effects.find(fx=>fx[key]===value);if(!beam)beam=queueEffect({type:'photon-ray',[key]:value,maxLife:PHOTON_RAY_VISUAL.duration,color:PHOTON_RAY_VISUAL.color});if(!beam)return null;Object.assign(beam,{x1,y1,x2,y2,width,life:PHOTON_RAY_VISUAL.duration});return beam;}
function getShotDamageAtLevel(level,shotId=null){const rank=Math.max(1,Math.min(3,Math.trunc(Number(level)||1)));return shotBalanceValue(shotId,'damage',rank,[0,12,15,18][rank]);}
function isPcMouseAimMode(){return !isMobileDevice()&&(!isClassicShooterRun()||controlSettings.pc==='wasd-aim');}
function isManualFiringMode(){return !isClassicShooterRun()||isPcMouseAimMode()||(isMobileDevice()&&controlSettings.mobile==='dual-stick');}
function manualFireDown(){return isMobileDevice()?mobileFireHeld:pointer.down;}
function syncMobileFireButton(){const btn=$('mobileFireBtn');if(btn)btn.hidden=!(gameState==='playing'&&isMobileDevice()&&isManualFiringMode());}
function updateMouseAimFromCursor(){if(!isPcMouseAimMode()||!player||!Number.isFinite(pointer.clientX)||!Number.isFinite(pointer.clientY))return;const rect=canvas.getBoundingClientRect();pointer.x=cameraX+(pointer.clientX-rect.left)/worldZoom;pointer.y=cameraY+(pointer.clientY-rect.top)/worldZoom;controlAimAngle=Math.atan2(pointer.y-player.y,pointer.x-player.x);player.angle=controlAimAngle;player.weaponAngle=controlAimAngle;}
function getActiveShotId(){if(RESONANCE_CATEGORIES.shots.includes(runShotId))return runShotId;const preset=resonancePresets[onlineRoomMode==='pvp'?'pvp':'pve']||[];return preset.find(id=>RESONANCE_CATEGORIES.shots.includes(id))||(onlineRoomMode==='pvp'?'electric':'photon');}
// A side-beam and its actual hit segment must stop at the same solid rock.
// Single terrain visibility rule for PvE targeting, damage and visual rays.
function pveTerrainClear(ax,ay,bx,by,padding=2){
 if(activeMapLayout&&ABYSSAL_MAP)return ABYSSAL_MAP.segmentWalkable(activeMapLayout,ax,ay,bx,by,padding);
 if(usesNaturalOceanTerrain()&&OCEAN_GEOGRAPHY)return OCEAN_GEOGRAPHY.segmentClear(ax,ay,bx,by,padding);
 if(isClassicCavernRun()&&SOLO_CAVERN)return !SOLO_CAVERN.segmentBlocked(arenaRocks,ax,ay,bx,by,padding);
 return true;
}
// A solid hull stops creatures, divers, navigation and sight, but not weapon fire.
function pveProjectileTerrainClear(ax,ay,bx,by,padding=2){
 if(isClassicCavernRun()&&SOLO_CAVERN&&!activeMapLayout)return !SOLO_CAVERN.segmentBlocked(arenaRocks,ax,ay,bx,by,padding,true);
 return pveTerrainClear(ax,ay,bx,by,padding);
}
function soloSharkNavigation(e,target,pad){
 if(activeMapLayout&&ABYSSAL_MAP)return ABYSSAL_MAP.navigationTarget(activeMapLayout,e.x,e.y,target.x,target.y,{padding:pad,includePortal:false});
 if(usesNaturalOceanTerrain()&&OPEN_SEA_ECOLOGY)return OPEN_SEA_ECOLOGY.navigationTarget(e,target,pad,performance.now());
 if(!onlineMode&&isClassicShooterRun()&&SOLO_CAVERN){
  const nav=SOLO_CAVERN.pursuitTarget(arenaRocks,W,H,e,target,pad,performance.now());
  return nav.blocked?SOLO_CAVERN.escapeTarget(arenaRocks,W,H,e.x,e.y,target.x,target.y,pad,e.angle)||nav:nav;
 }
 return target;
}
function pveRayDistance(x,y,dx,dy,range,padding=0){
 if(isClassicCavernRun()&&SOLO_CAVERN&&!activeMapLayout&&padding===0)return SOLO_CAVERN.rayDistance(arenaRocks,x,y,dx,dy,range);
 if(pveTerrainClear(x,y,x+dx*range,y+dy*range,padding))return range;
 let lo=0,hi=range;for(let i=0;i<12;i++){const mid=(lo+hi)*.5;if(pveTerrainClear(x,y,x+dx*mid,y+dy*mid,padding))lo=mid;else hi=mid;}return lo;
}
function clipPrismaticPhotonRay(sx,sy,ex,ey,radius){
 const pvp=onlineRoomMode==='pvp';
 const blocked=(fraction)=>{
  const tx=sx+(ex-sx)*fraction,ty=sy+(ey-sy)*fraction;
  return pvp?projectileHitsPvpWall(sx,sy,tx,ty,radius):
   !pveProjectileTerrainClear(sx,sy,tx,ty,radius);
 };
 if(!blocked(1))return {x2:ex,y2:ey};
 let lo=0,hi=1;
 for(let k=0;k<12;k++){const mid=(lo+hi)*.5;if(blocked(mid))hi=mid;else lo=mid;}
 return {x2:sx+(ex-sx)*lo,y2:sy+(ey-sy)*lo};
}
function nextShotVolleyId(){if(!player)return '';player.shotSequence=(Number(player.shotSequence)||0)+1;return Date.now().toString(36)+'-'+player.shotSequence;}
function pointSegmentDistance(x,y,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/Math.max(1e-9,dx*dx+dy*dy),0,1);return Math.hypot(x-ax-dx*t,y-ay-dy*t);}
function aimAtEnemy(target){
 const dx=target.x-player.x,dy=target.y-player.y,d=Math.hypot(dx,dy),heading=Math.atan2(dy,dx);
 // Solve the lateral barrel offset analytically; iterative muzzle correction
 // flips 180 degrees when an enemy is closer than the barrel length.
 const offset=player.r*(DIVER_ART?.DRAW_SCALE||.60)*(DIVER_ART?.GUN_OFFSET_Y||12)/14;
 return d>offset?heading-Math.asin(clamp(offset/d,-1,1)):heading;
}
function updateAutomaticWeaponAim(){if(!player||isManualFiringMode()||(isClassicCavernRun()&&soloSubmarine.spawnFx>1.25))return;let target=null,best=getFiringRange();for(const e of enemies){if(!e||e.hp<=0||enemyHiddenFromAutoTarget(e))continue;const d=dist(player,e);if(d<best&&pveProjectileTerrainClear(player.x,player.y,e.x,e.y,2)){target=e;best=d;}}if(!target)return;player.weaponAngle=aimAtEnemy(target);player.angle=player.weaponAngle;}

function fire(){
 if(soloSubmarine.repair)return;
 if(isOpenSeaRun()&&explorationHeldItem!=='abyssWeapon')return;
 if(!player||Number(upgrades.nova)>0||Number(upgrades.gravitationalRupture)>0||Number(upgrades.photonRay)>0)return;let target=null,bd=Infinity;const maxRange=getFiringRange();
 if(onlineRoomMode==='pvp'){
  const peers=window.AbyssalOnline?.getPlayers?.()||[];
  for(const peer of peers){if(!peer||peer.alive===false)continue;const d=Math.hypot((Number(peer.x)||0)-player.x,(Number(peer.y)||0)-player.y);if(d<maxRange&&d<bd){target=peer;bd=d;}}
 }else for(const e of enemies){if(e.hp<=0||enemyHiddenFromAutoTarget(e)||!pveProjectileTerrainClear(player.x,player.y,e.x,e.y,2))continue;const d=dist(player,e);if(d<maxRange&&d<bd){target=e;bd=d}}
 const mouseAimMode=isPcMouseAimMode(),aimedMode=isManualFiringMode();
 if(!target&&!aimedMode)return;
 if(mouseAimMode)updateMouseAimFromCursor();
 // Automatic targeting solves aim from the visible barrel, not from the torso.
 // All projectiles in a spread share the physical muzzle origin.
 let a=aimedMode?controlAimAngle:aimAtEnemy(target);
 player.weaponAngle=a;
 const gunTip=DIVER_ART?.muzzle?.(player.x,player.y,player.r,a)||{x:player.x+Math.cos(a)*15,y:player.y+Math.sin(a)*15};
 const activeShot=getActiveShotId()||'electric',shotLevel=Math.max(1,Number(upgradeLevels[activeShot])||1);
 const baseDamage=shotLevel?getShotDamageAtLevel(shotLevel,activeShot):12;
 const shotDamage=baseDamage*(upgrades.power||1);
 const profile=baseShotProfile(activeShot,shotLevel),shotSpeed=profile.speed,shotColor=profile.color;
 const prismLevel=Math.max(0,Math.min(3,Number(upgrades.spread)||0));
 const baseOffsets=activeShot==='echoShot'&&upgrades.tidalEcho?[-.065,0,.065]:profile.offsets;
 const prismOffsets=Array.from({length:prismLevel*2},(_,i)=>{const rank=Math.floor(i/2)+1;return (i%2===0?-1:1)*(.095+.075*(rank-1));});
 const offsets=[...baseOffsets,...prismOffsets,...(upgrades.photonCascade?[-.36,.36]:[])];
 const angles=offsets.map(offset=>a+offset),volleyId=nextShotVolleyId();player.visualAttackUntil=performance.now()+140;
 for(const shotAngle of angles){const shotMuzzle=gunTip;const damage=shotDamage/(1+.4*prismLevel+(upgrades.photonCascade?.22:0)+(upgrades.tidalEcho?.16:0));const projectileRadius=profile.radius*GAME_WORLD_ZOOM;const special=activeShot==='photon'?'photon':activeShot==='pierce'?'pierce':activeShot==='electric'?'electric':activeShot==='echoShot'?'echoShot':null;const modifiers={abyssEye:Boolean(upgrades.abyssEye),ricochet:Math.max(0,Number(upgrades.ricochet)||0)};projectiles.push({x:shotMuzzle.x,y:shotMuzzle.y,barrelOrigin:!aimedMode&&target&&onlineRoomMode!=='pvp'?{x:player.x-Math.sin(a)*player.r*(DIVER_ART?.DRAW_SCALE||.60)*(DIVER_ART?.GUN_OFFSET_Y||12)/14,y:player.y+Math.cos(a)*player.r*(DIVER_ART?.DRAW_SCALE||.60)*(DIVER_ART?.GUN_OFFSET_Y||12)/14,targetId:target.id}:null,vx:Math.cos(shotAngle)*shotSpeed,vy:Math.sin(shotAngle)*shotSpeed,r:projectileRadius/GAME_WORLD_ZOOM,life:upgrades.abyssEye?18:Math.max(1.33,maxRange/Math.max(1,shotSpeed)+.12),travelled:0,maxDistance:upgrades.abyssEye?Math.hypot(W,H):Math.max(0,maxRange-player.r*DIVER_ART.DRAW_SCALE*DIVER_ART.BARREL_TIP_X/14),damage,pierceRemaining:activeShot==='pierce'?(upgrades.pierce||shotLevel):0,hitIds:[], color:shotColor,special,modifiers});if(onlineMode&&window.AbyssalOnline?.sendShot)window.AbyssalOnline.sendShot({x:shotMuzzle.x/W,y:shotMuzzle.y/H,vx:Math.cos(shotAngle)*shotSpeed/W,vy:Math.sin(shotAngle)*shotSpeed/H,damage,color:shotColor,special,modifiers,volleyId});} player.angle=a;player.weaponAngle=a;emitBaseShotMuzzle(gunTip,a,activeShot,shotColor,angles.length);playWorldSound('shot-'+activeShot,null,850,.82);
}
// Nova remains a radial pulse; Prism generates independent radial fragments
// instead of pretending that a second invisible Nova dealt damage.
function emitPrismaticNovaShards(novaDamage,sharedVolleyId){
 const rank=Math.max(0,Math.min(3,Number(upgrades.spread)||0));
 if(!player||rank===0)return;
 const count=2*rank,volleyId=sharedVolleyId||nextShotVolleyId(),baseAngle=Number(player.angle)||0;
 const speed=420/GAME_WORLD_ZOOM,damage=Math.max(1,Number(novaDamage)||1)*.28/count;
 const radius=4.3/GAME_WORLD_ZOOM,reach=getFiringRange();
 for(let i=0;i<count;i++){
  const a=baseAngle+(i-(count-1)*.5)*(.68/Math.max(1,count-1));
  const {x,y}=DIVER_ART?.muzzle?.(player.x,player.y,player.r,a)||{x:player.x+Math.cos(a)*13/GAME_WORLD_ZOOM,y:player.y+Math.sin(a)*13/GAME_WORLD_ZOOM};
  const vx=Math.cos(a)*speed,vy=Math.sin(a)*speed;
  const modifiers={ricochet:Math.max(0,Number(upgrades.ricochet)||0)};
  projectiles.push({x,y,vx,vy,r:radius,life:Math.max(1.33,reach/Math.max(1,speed)+.12),travelled:0,maxDistance:reach,damage,pierceRemaining:0,hitIds:[],special:'prismShard',color:'#b9a6ff',modifiers});
  if(onlineMode&&window.AbyssalOnline?.sendShot)window.AbyssalOnline.sendShot({x:x/W,y:y/H,vx:vx/W,vy:vy/H,damage,color:'#b9a6ff',special:'prismShard',modifiers,volleyId});
 }
}
function marineAbilityLineDistance(px,py,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;if(l2<=1e-9)return Math.hypot(px-ax,py-ay);
 const q=clamp(((px-ax)*dx+(py-ay)*dy)/l2,0,1);return Math.hypot(px-(ax+dx*q),py-(ay+dy*q));
}
function currentSkinActiveSpec(){
 if(!specimenAlive())return null;
 const base=SKIN_STANDARD?.activeSpec?.(equippedSkin);if(!base)return null;
 // Active identity, cooldown, duration, damage and range are the shop contract.
 // Proficiency must never silently rewrite a purchased/equipped specimen ability.
 return base;
}
function nearestSkinActiveTarget(range,origin=specimenOrigin()){
 let best=null,bd=Infinity;
 for(const e of enemies){if(!e||e.hp<=0||enemyHiddenFromAutoTarget(e))continue;const d=Math.hypot(e.x-origin.x,e.y-origin.y);if(d<=range&&d<bd&&pveTerrainClear(origin.x,origin.y,e.x,e.y,2)){best=e;bd=d;}}
 return best;
}
function specimenAbilityAngle(range){
 const origin=specimenOrigin(),optionTwo=isPcMouseAimMode()||(isMobileDevice()&&controlSettings.mobile==='dual-stick');
 if(optionTwo){
  if(isPcMouseAimMode()&&Number.isFinite(pointer.clientX)&&Number.isFinite(pointer.clientY)){
   const rect=canvas.getBoundingClientRect(),mx=cameraX+(pointer.clientX-rect.left)/worldZoom,my=cameraY+(pointer.clientY-rect.top)/worldZoom;
   return Math.atan2(my-origin.y,mx-origin.x);
  }
  return Number(controlAimAngle)||Number(player?.angle)||0;
 }
 const target=nearestSkinActiveTarget(range,origin);
 return target?Math.atan2(target.y-origin.y,target.x-origin.x):(Number(player?.angle)||0);
}
const expandingSkinClouds=[],expandingSkinPulses=[];
function updateSkinPulses(dt){
 if(onlineMode||!expandingSkinPulses.length)return;
 for(let i=expandingSkinPulses.length-1;i>=0;i--){
  const wave=expandingSkinPulses[i],previous=wave.edge||0;
  wave.elapsed=Math.min(wave.duration,wave.elapsed+Math.max(0,dt));
  wave.edge=wave.radius*clamp(wave.elapsed/wave.duration,0,1);
  for(const e of [...enemies]){
   if(!e||e.hp<=0||wave.hitIds.has(e.id))continue;
   const d=Math.hypot(e.x-wave.x,e.y-wave.y),margin=Math.max(6/GAME_WORLD_ZOOM,Number(e.r)||0);
   if(d+margin<previous||d-margin>wave.edge)continue;
   if(!pveTerrainClear(wave.x,wave.y,e.x,e.y,2))continue;wave.hitIds.add(e.id);dealEnemyDamage(e,wave.damage,'skin-active-pulse',{visual:true,origin:wave});
  }
  if(wave.elapsed>=wave.duration)expandingSkinPulses.splice(i,1);
 }
}
function updateSkinCloudExpansions(dt){
 if(onlineMode||!expandingSkinClouds.length)return;
 for(let i=expandingSkinClouds.length-1;i>=0;i--){
  const cloud=expandingSkinClouds[i];
  cloud.elapsed=Math.min(1.55,cloud.elapsed+Math.max(0,dt));
  const grow=clamp(cloud.elapsed/(1.55*.72),0,1);
  const edge=cloud.radius*(.06+.94*(1-Math.pow(1-grow,2)));
  for(let j=enemies.length-1;j>=0;j--){
   const e=enemies[j];
   if(!e||e.hp<=0||cloud.hitIds.has(e.id))continue;
   if(Math.hypot(e.x-cloud.x,e.y-cloud.y)>edge+(Number(e.r)||0))continue;
   if(!pveTerrainClear(cloud.x,cloud.y,e.x,e.y,2))continue;
   cloud.hitIds.add(e.id);e.poisonTimer=Math.max(Number(e.poisonTimer)||0,2.4);
   dealEnemyDamage(e,cloud.damage,'skin-active-cloud',{visual:true,origin:cloud});
  }
  if(cloud.elapsed>=1.55)expandingSkinClouds.splice(i,1);
 }
}
function spawnPoisonPlantCloudVisual(x,y,radius,color='#7dff73'){
 queueEffect({type:'poison-plant-cloud',x,y,max:radius,life:1.55,maxLife:1.55,color,seed:Date.now()%2000});
 // The poison-plant geometry renders its own uneven growing boundary and spores.
}

function startSkinSpecimenDash(origin,angle,range,duration=.65){
 if(!player?.specimen||!player.specimen.alive)return;
 const s=player.specimen,ux=Math.cos(angle),uy=Math.sin(angle);
 const valid=travel=>{const x2=origin.x+ux*travel,y2=origin.y+uy*travel;return x2>=s.r&&x2<=W-s.r&&y2>=s.r&&y2<=H-s.r&&(onlineRoomMode==='pvp'?!projectileHitsPvpWall(origin.x,origin.y,x2,y2,s.r):pveTerrainClear(origin.x,origin.y,x2,y2,s.r));};
 let lo=0,hi=range;if(valid(range))lo=range;else for(let i=0;i<16;i++){const mid=(lo+hi)*.5;if(valid(mid))lo=mid;else hi=mid;}
 const travel=lo;s.dash={x1:origin.x,y1:origin.y,x2:origin.x+ux*travel,y2:origin.y+uy*travel,startedAt:performance.now(),durationMs:duration*1000,angle,hitIds:new Set(),damage:Number(currentSkinActiveSpec()?.damage)||70};
 s.invuln=Math.max(Number(s.invuln)||0,duration);
}
function drawSpecimenDashArc(x,y,r,angle,t,progress){
 const forward=r*1.4,spread=Math.max(14/GAME_WORLD_ZOOM,r*1.9),fade=Math.sin(Math.PI*Math.max(0,Math.min(1,progress)));
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 ctx.globalAlpha=.38+.56*fade;ctx.strokeStyle='#79dfff';ctx.lineWidth=3.4/GAME_WORLD_ZOOM;
 ctx.shadowColor='#32baff';ctx.shadowBlur=lowPowerRendering?0:12/GAME_WORLD_ZOOM;
 for(const side of [-1,1]){
  ctx.beginPath();ctx.moveTo(-r*1.8,side*spread*.72);
  ctx.quadraticCurveTo(-r*.32,side*spread*1.4,forward+spread*.62,side*spread*.08);
  ctx.stroke();ctx.strokeStyle='#d4faff';ctx.lineWidth=1.1/GAME_WORLD_ZOOM;
  ctx.beginPath();ctx.moveTo(-r*.9,side*spread*.72);
  ctx.quadraticCurveTo(0,side*spread,forward+spread*.4,side*spread*.08);ctx.stroke();
  ctx.strokeStyle='#79dfff';ctx.lineWidth=3.4/GAME_WORLD_ZOOM;
 }
 for(let i=0;i<4;i++){const u=(i+.5)/4,xx=-r*2.5-u*r*2.5,yy=Math.sin(t*.018+i*2)*spread*.45;ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx-r*(.75+u),yy);ctx.stroke();}
 ctx.restore();
}
function drawWeaponInfusion(x,y,r,angle,t,kind){
 if(kind!=='poison'&&kind!=='paralysis')return;
 const muzzle=DIVER_ART?.muzzle?.(x,y,r,angle)||{x:x+Math.cos(angle)*r*2.3,y:y+Math.sin(angle)*r*2.3};
 const dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx,fromX=muzzle.x-dx*r*1.85,fromY=muzzle.y-dy*r*1.85;
 ctx.save();ctx.lineCap='round';
 if(kind==='paralysis'){
  for(let side=-1;side<=1;side+=2){
   ctx.beginPath();ctx.strokeStyle=side<0?'#30bfff':'#ecffff';ctx.lineWidth=(side<0?3.1:1.6)/GAME_WORLD_ZOOM;
   ctx.shadowColor='#2bcaff';ctx.shadowBlur=lowPowerRendering?0:11/GAME_WORLD_ZOOM;
   for(let i=0;i<=6;i++){const u=i/6,jitter=i===0||i===6?0:Math.sin(t*.034+i*17+side)*r*.32;
    const px=fromX+dx*r*1.85*u+nx*(side*r*.18+jitter),py=fromY+dy*r*1.85*u+ny*(side*r*.18+jitter);
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
   }ctx.stroke();
  }
 }else{
  ctx.fillStyle='rgba(167,58,240,.24)';ctx.strokeStyle='#dca5ff';ctx.lineWidth=1.35/GAME_WORLD_ZOOM;
  for(let i=0;i<8;i++){const u=(i+.5)/8,a=t*.0018+i*2.4;
   const px=fromX+dx*r*(1.9*u)+nx*Math.sin(a)*r*.47;
   const py=fromY+dy*r*(1.9*u)+ny*Math.sin(a)*r*.47-Math.cos(a)*r*.28;
   const rad=(2.3+Math.sin(a)*.8)/GAME_WORLD_ZOOM;
   ctx.beginPath();ctx.arc(px,py,rad,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
 }
 ctx.restore();
}
function spawnSkinActiveVisual(spec,angle,castOrigin=null){
 if(!player||!spec||!specimenAlive())return;
 const origin=castOrigin||specimenOrigin(),x=origin.x,y=origin.y,r=(Number(spec.range)||150)/GAME_WORLD_ZOOM,color=spec.color||currentSkinColor();
 if(spec.id==='cloud')spawnPoisonPlantCloudVisual(x,y,r,color);
 else if(spec.id==='dash')startSkinSpecimenDash(origin,angle,r,Number(spec.duration)||.65);
 else if(spec.id==='trail'){queueEffect({type:'ring',x,y,r:0,max:65/GAME_WORLD_ZOOM,life:.42,maxLife:.42,color});burst(x,y,color,10,90);}
 else if(spec.id==='push'){queueEffect({type:'ring',x,y,r:0,max:r,life:.58,maxLife:.58,color});burst(x,y,color,18,150);}
 else if(spec.id==='poison'){burst(player.x,player.y,'#b46bfa',8,70);}
 else if(spec.id==='paralysis'){burst(player.x,player.y,'#62edff',9,75);}
 else if(spec.id==='shot'||spec.id==='slowShot'){const reach=pveRayDistance(x,y,Math.cos(angle),Math.sin(angle),r,2);queueEffect({type:'beam',x1:x,y1:y,x2:x+Math.cos(angle)*reach,y2:y+Math.sin(angle)*reach,life:.42,maxLife:.42,color,width:spec.id==='shot'?6/GAME_WORLD_ZOOM:4/GAME_WORLD_ZOOM});burst(x,y,color,12,100);}
 else if(spec.id==='pulse'){queueEffect({type:'specimen-pulse-wave',x,y,r:0,max:r,life:.72,maxLife:.72,color});burst(x,y,color,20,155);}
 else if(spec.id==='shield'){queueEffect({type:'specimen-shield-bubble',x,y,max:74/GAME_WORLD_ZOOM,life:2,maxLife:2,color,local:true});}
}
function applySoloSkinActive(spec,angle){
 const origin=specimenOrigin(),range=(Number(spec.range)||160)/GAME_WORLD_ZOOM;
 const emitEffect=typeof queueEffect==='function'?queueEffect:fx=>{effects.push(fx);return fx;};
 const inRange=()=>enemies.filter(e=>e&&e.hp>0&&Math.hypot(e.x-origin.x,e.y-origin.y)<=range&&pveTerrainClear(origin.x,origin.y,e.x,e.y,2));
 if(spec.id==='dash'){
  // Damage is swept during actual movement, never at the speculative endpoint.
  const dash=player?.specimen?.dash;if(dash){dash.damage=Number(spec.damage)||70;dash.hitIds ||= new Set();}
 }else if(spec.id==='cloud'){
  expandingSkinClouds.push({x:origin.x,y:origin.y,radius:range,damage:spec.damage,elapsed:0,hitIds:new Set()});
  if(expandingSkinClouds.length>3)expandingSkinClouds.shift();
 }else if(spec.id==='trail'){
  // Stream nodes from the moving specimen, not five instant ones.
 }else if(spec.id==='push'){
  for(const e of inRange()){dealEnemyDamage(e,spec.damage,'skin-active-push',{visual:true,origin});const dx=e.x-origin.x,dy=e.y-origin.y,d=Math.hypot(dx,dy)||1;e.kbVx=dx/d*1720;e.kbVy=dy/d*1720;}
 }else if(spec.id==='poison'||spec.id==='paralysis'){
  // The active ability now buffs the diver's weapon; damage/status occurs on actual hits.
 }else if(spec.id==='shot'||spec.id==='slowShot'){
  const ex=origin.x+Math.cos(angle)*range,ey=origin.y+Math.sin(angle)*range;
  const target=enemies.filter(e=>e&&e.hp>0&&pveProjectileTerrainClear(origin.x,origin.y,e.x,e.y,2)&&marineAbilityLineDistance(e.x,e.y,origin.x,origin.y,ex,ey)<=18/GAME_WORLD_ZOOM+(Number(e.r)||0)).sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y))[0];
  if(target){const castPlayer=player,castRun=soloAdaptationRun;emitEffect({type:'skin-shot-telegraph',x1:origin.x,y1:origin.y,x2:target.x,y2:target.y,life:.42,maxLife:.42,color:spec.color,width:3/GAME_WORLD_ZOOM});setTimeout(()=>{if(gameState!=='playing'||player!==castPlayer||soloAdaptationRun!==castRun||!enemies.includes(target)||target.hp<=0||!pveProjectileTerrainClear(origin.x,origin.y,target.x,target.y,2))return;dealEnemyDamage(target,spec.damage,spec.id==='shot'?'skin-active-shot':'skin-active-slowShot',{visual:true,origin});if(spec.id==='slowShot')target.skinSlowedUntil=Date.now()+(spec.slowDurationMs||2000);},420);}
 }else if(spec.id==='pulse'){
  expandingSkinPulses.push({x:origin.x,y:origin.y,radius:range,damage:spec.damage,duration:.72,elapsed:0,edge:0,hitIds:new Set()});
  if(expandingSkinPulses.length>4)expandingSkinPulses.shift();
 }else if(spec.id==='shield'){
  player.invuln=Math.max(Number(player.invuln)||0,2);
  player.specimen.invuln=Math.max(Number(player.specimen.invuln)||0,2);
 }
}
function activateSkinAbility(inputEvent){
 if(soloSubmarine.repair)cancelSoloHullRepair();
 if(inputEvent?.isTrusted!==true)return false;
 if(!player||gameState!=='playing'||!specimenAlive())return false;
 // Only Mar Aberto uses companion sonar. Shooter Solo always executes the shop-described R ability.
 if(isOpenSeaRun()){
  if(Number(player.skinActiveCooldown)>0)return false;
  player.skinActiveCooldown=12;
  const origin=specimenOrigin();
  queueEffect({type:'ring',x:origin.x,y:origin.y,r:0,max:270/GAME_WORLD_ZOOM,life:.8,maxLife:.8,color:'#5de6db'});
  window.dispatchEvent(new CustomEvent('abyssal-companion-sonar',{detail:{x:origin.x,y:origin.y,range:270/GAME_WORLD_ZOOM}}));
  updateAbilityButtons(true);return true;
 }
 const spec=currentSkinActiveSpec();if(!spec)return false;
 if((Number(player.skinActiveCooldown)||0)>0||Number(player.skinTrailUntil)>performance.now()||Number(player.skinWeaponBuffUntil)>performance.now())return false;
 const angle=specimenAbilityAngle((Number(spec.range)||160)/GAME_WORLD_ZOOM),origin=specimenOrigin();
 if(spec.id==='trail'){
  player.skinTrailUntil=performance.now()+10000;
  player.skinTrailCooldownSeconds=Number(spec.cooldown)||10;
  player.skinTrailSampleAt=0;
  player.skinTrailPreviousX=NaN;player.skinTrailPreviousY=NaN;
  player.skinActiveCooldown=0;
 }else if(spec.id==='poison'||spec.id==='paralysis'){
  player.skinWeaponBuffUntil=performance.now()+10000;
  player.skinWeaponBuffKind=spec.id;
  player.skinWeaponBuffCooldownSeconds=Number(spec.cooldown)||10;
  player.skinActiveCooldown=0;
 }else player.skinActiveCooldown=Number(spec.cooldown)||10;
 if(!onlineMode)spawnSkinActiveVisual(spec,angle);
 if(onlineMode){
  const castPlayer=player;
  const sent=window.AbyssalOnline?.sendSkinAbility?.({type:'standard-active',active:spec.id,skin:equippedSkin,x:clamp(origin.x/W,0,1),y:clamp(origin.y/H,0,1),angle},result=>{
   if(player!==castPlayer)return;
   if(result?.ok===false&&player){player.skinTrailUntil=0;player.skinWeaponBuffUntil=0;player.skinWeaponBuffKind=null;player.specimen.dash=null;player.skinActiveCooldown=Math.max(0,(Number(result.remainingMs)||0)/1000);showToast(result.reason==='skin-active-cooldown'?'HABILIDADE EM RECARGA':'HABILIDADE NÃO CONFIRMADA · '+String(result.reason||'SEM RESPOSTA'));updateAbilityButtons(true);}
  });
  if(!sent){player.skinTrailUntil=0;player.skinWeaponBuffUntil=0;player.skinWeaponBuffKind=null;player.specimen.dash=null;player.skinActiveCooldown=0;updateAbilityButtons(true);return false;}
 }else applySoloSkinActive(spec,angle);
 playWorldSound(spec.id==='paralysis'?'ability-beam':spec.id==='dash'?'ability-dash':spec.id==='cloud'||spec.id==='poison'?'ability-poison':spec.id==='shield'?'shield-hit':'ability-nova',origin,850,.68);
 updateAbilityButtons(true);return true;
}
function updateSkinTrailRuntime(){
 if(!player||!Number(player.skinTrailUntil)||!specimenAlive())return;
 const now=performance.now();
 if(now>=player.skinTrailUntil||onlineMode)return;
 const spec=currentSkinActiveSpec();if(spec?.id!=='trail')return;
 if(now<(Number(player.skinTrailSampleAt)||0))return;
 const pos=specimenOrigin();
 const travelled=Math.hypot(pos.x-player.skinTrailPreviousX,pos.y-player.skinTrailPreviousY);
 if(Number.isFinite(travelled)&&travelled<9/GAME_WORLD_ZOOM)return;
 player.skinTrailPreviousX=pos.x;player.skinTrailPreviousY=pos.y;
 player.skinTrailSampleAt=now+160;
 const angle=Number(player.specimen?.facingAngle)||0;
 sharkWakeTrails.push({
  x:pos.x-Math.cos(angle)*10/GAME_WORLD_ZOOM,
  y:pos.y-Math.sin(angle)*10/GAME_WORLD_ZOOM,
  r:20/GAME_WORLD_ZOOM,life:10,maxLife:10,damageTimer:.25,
  color:spec.color,ink:spec.ink===true,skinActive:true
 });
 if(sharkWakeTrails.length>450)sharkWakeTrails.splice(0,sharkWakeTrails.length-450);
}
let soundMotionSkinId=null,soundMotionFamily='signature';
function equippedMotionFamily(){
 if(soundMotionSkinId!==equippedSkin){
  soundMotionSkinId=equippedSkin;
  const skin=skinData.find(s=>s.id===equippedSkin);
  soundMotionFamily=window.AbyssalSkinMotion?.familyFor?.(skin||equippedSkin)||'signature';
 }
 return soundMotionFamily;
}
function updateSpecimenRuntime(dt){
 if(isClassicCavernRun()&&soloSubmarine.spawnFx>1.25)return;
 if(!player?.specimen)return;
 const s=player.specimen;
 if(s.invuln>0)s.invuln=Math.max(0,s.invuln-dt);
 if(s.alive===false){
  s.dash=null;s.pendingBite=null;s.biteAnimation=null;s.attackTargetId=null;s.attackApproachAngle=null;s.attackHoldUntil=0;s.visualAttackUntil=0;s.bodyAttackCooldowns?.clear();s.vx=0;s.vy=0;
  s.respawnTimer=Number(s.respawnAt)>0?Math.max(0,(s.respawnAt-Date.now())/1000):Math.max(0,(Number(s.respawnTimer)||0)-dt);
  if(!onlineMode&&s.respawnTimer<=0){s.respawnAt=0;s.alive=true;s.hp=s.maxHp;s.invuln=1.5;s.x=player.x;s.y=player.y-34/GAME_WORLD_ZOOM;showToast('ESPÉCIME RESSURGIU');burst(s.x,s.y,currentSkinColor(),18,110);}
  return;
 }
 if(s.dash){
  const progress=clamp((performance.now()-s.dash.startedAt)/s.dash.durationMs,0,1),dash=s.dash,fromX=s.x,fromY=s.y;
  s.x=dash.x1+(dash.x2-dash.x1)*progress;s.y=dash.y1+(dash.y2-dash.y1)*progress;s.vx=(s.x-fromX)/Math.max(.001,dt);s.vy=(s.y-fromY)/Math.max(.001,dt);s.facingAngle=dash.angle;s.visualAttackUntil=Math.max(Number(s.visualAttackUntil)||0,performance.now()+80);
  if(!onlineMode){dash.hitIds ||= new Set();for(const e of enemies){if(!e||e.hp<=0||dash.hitIds.has(e.id))continue;const dx=s.x-fromX,dy=s.y-fromY,q=clamp(((e.x-fromX)*dx+(e.y-fromY)*dy)/Math.max(1e-9,dx*dx+dy*dy),0,1),contactX=fromX+dx*q,contactY=fromY+dy*q;if(Math.hypot(e.x-contactX,e.y-contactY)>Math.max(s.r,15/GAME_WORLD_ZOOM)+(Number(e.r)||0)||!pveTerrainClear(contactX,contactY,e.x,e.y,1))continue;dash.hitIds.add(e.id);dealEnemyDamage(e,dash.damage,'skin-active-dash',{visual:true,origin:{x:contactX,y:contactY}});}}
  if(progress>=1)s.dash=null;return;
 }
 if(onlineMode&&isClassicCavernRun()){
  const sync=window.AbyssalOnline?.getSpecimenMotion?.();if(sync){const dx=sync.x-s.x,dy=sync.y-s.y,blend=1-Math.exp(-dt*18);s.x+=dx*blend;s.y+=dy*blend;s.vx=dx*blend/Math.max(.001,dt);s.vy=dy*blend/Math.max(.001,dt);const a=Number(sync.angle)||0;s.facingAngle=(s.facingAngle||0)+Math.atan2(Math.sin(a-(s.facingAngle||0)),Math.cos(a-(s.facingAngle||0)))*blend;s.alive=sync.alive!==false;}return;
 }
 const radius=Number(s.r)||11/GAME_WORLD_ZOOM,soloCave=isClassicCavernRun()&&SOLO_CAVERN,pad=radius+1/GAME_WORLD_ZOOM;
 if(soloCave&&SOLO_CAVERN.isBlocked(arenaRocks,s.x,s.y,pad)){const water=SOLO_CAVERN.nearestWater(arenaRocks,W,H,s.x,s.y,pad);if(water){s.x=water.x;s.y=water.y;s.vx=0;s.vy=0;s.navGoal=null;}}
 const pos={x:s.x,y:s.y},threatRadius=360/GAME_WORLD_ZOOM,threatRadiusSq=threatRadius*threatRadius;
 collectEnemyCandidatesNear(pos.x,pos.y,threatRadius,specimenNearbyEnemies);
 let kept=0;for(const e of specimenNearbyEnemies)if(e&&e.hp>0&&(e.x-pos.x)**2+(e.y-pos.y)**2<threatRadiusSq)specimenNearbyEnemies[kept++]=e;specimenNearbyEnemies.length=kept;
 const threats=specimenNearbyEnemies,collectionRange=294/GAME_WORLD_ZOOM*(Number(upgrades.range)||1)*specimenPassiveMultiplier('range'),now=performance.now();
 if(!s.tacticalChoice||now>=(s.nextTacticsAt||0)||s.tacticalChoice.type==='orb'&&!orbs.includes(s.tacticalChoice.orb)||s.tacticalChoice.type==='enemy'&&(s.tacticalChoice.enemy.hp<=0||!enemies.includes(s.tacticalChoice.enemy))){
  const candidates=orbs.filter(o=>Math.hypot(o.x-player.x,o.y-player.y)<=collectionRange).sort((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)-Math.hypot(b.x-pos.x,b.y-pos.y)).slice(0,12);
  s.tacticalChoice=(!onlineMode||isClassicCavernRun())?PET_TACTICS?.choose?.({mode:petHabit,pet:pos,player,enemies:threats,orbs:candidates,collectionRange,attackRange:350/GAME_WORLD_ZOOM,guardRange:265/GAME_WORLD_ZOOM,preferredOrbId:s.tacticalChoice?.orb?.id,routeCost:o=>{if(o.id===s.unreachableOrbId&&now<(s.unreachableUntil||0))return Infinity;if(!soloCave)return Math.hypot(o.x-pos.x,o.y-pos.y);const nav=SOLO_CAVERN.navigationTarget(arenaRocks,W,H,pos.x,pos.y,o.x,o.y,pad);return nav.blocked?Infinity:Math.hypot(o.x-pos.x,o.y-pos.y)*(nav.direct?1:1.65);}}):null;s.nextTacticsAt=now+220;
 }
 const tactics=s.tacticalChoice,combatTarget=tactics?.type==='enemy'&&tactics.enemy?.hp>0&&enemies.includes(tactics.enemy)?tactics.enemy:null;
 const orb=tactics?(tactics.type==='orb'?tactics.orb:null):SPECIMEN_EVASION?.bestOrb(pos,orbs,player,collectionRange,threats,radius,28/GAME_WORLD_ZOOM);
 const visualRadius=CREATURE_SCALE?.visualRadius?.(equippedSkin,radius)||radius,profile=combatTarget?PET_TACTICS.attackProfile(equippedSkin,SPECIMEN_SYSTEM.familyFor(equippedSkin),visualRadius):null;
 let strikeGoal=null;
 if(combatTarget){
  const directAngle=Math.atan2(combatTarget.y-s.y,combatTarget.x-s.x),targetId=String(combatTarget.id);
  if(s.attackTargetId!==targetId||!Number.isFinite(s.attackApproachAngle))s.attackApproachAngle=directAngle;
  else{const turnDelta=Math.atan2(Math.sin(directAngle-s.attackApproachAngle),Math.cos(directAngle-s.attackApproachAngle)),maxTurn=Math.max(.015,dt*2.6);s.attackApproachAngle+=clamp(turnDelta,-maxTurn,maxTurn);}
  s.attackTargetId=targetId;strikeGoal=PET_TACTICS.attackGoal(s,combatTarget,profile,s.attackApproachAngle);
 }else{s.attackTargetId=null;s.attackApproachAngle=null;s.attackHoldUntil=0;}
 let target=strikeGoal?{x:strikeGoal.x,y:strikeGoal.y}:orb?{x:orb.x,y:orb.y}:{x:player.x,y:player.y-34/GAME_WORLD_ZOOM};
 specimenNavigationThreats.length=0;for(const e of threats)if(!combatTarget||e.id!==combatTarget.id)specimenNavigationThreats.push(e);
 const navigationThreats=specimenNavigationThreats;
 if(s.pendingBite&&now>=s.pendingBite.hitAt){const pending=s.pendingBite;s.pendingBite=null;const enemy=pending.enemy;if((!onlineMode||isClassicCavernRun())&&enemy.hp>0&&enemies.includes(enemy)&&pveTerrainClear(s.x,s.y,enemy.x,enemy.y,2)&&PET_TACTICS.attackContact(s,enemy,pending.profile,s.facingAngle||0,now*.0018)){dealEnemyDamage(enemy,pending.damage,'specimen-bite',{silentSound:true,secondary:true,origin:s});burst(enemy.x,enemy.y,currentSkinColor(),5,45);}}
 let attackHolding=false;
 if(combatTarget){
  const angle=strikeGoal.angle,delta=Math.atan2(Math.sin(angle-(s.facingAngle||0)),Math.cos(angle-(s.facingAngle||0)));s.facingAngle=(s.facingAngle||0)+delta*(1-Math.exp(-dt*12));
  const facing=s.facingAngle,phase=now*.0018,clear=pveTerrainClear(s.x,s.y,combatTarget.x,combatTarget.y,2),contact=clear&&PET_TACTICS.attackContact(s,combatTarget,profile,facing,phase,window.AbyssalEnemyAI?.touchesKrakenTentacle);
  if(contact)s.attackHoldUntil=Math.max(Number(s.attackHoldUntil)||0,now+180);
  const distanceToTarget=Math.hypot(combatTarget.x-s.x,combatTarget.y-s.y),holdBand=Math.max(7/GAME_WORLD_ZOOM,profile.slack*1.8);
  attackHolding=now<(Number(s.attackHoldUntil)||0)&&Math.abs(distanceToTarget-strikeGoal.stop)<=holdBand*2.2;if(attackHolding)target=pos;
  if(contact&&!profile.body&&now>=(s.nextTacticalAttack||0)){const damage=SPECIMEN_SYSTEM.effectiveStats(equippedSkin,specimenPoints()).damage;s.nextTacticalAttack=now+1020;s.visualAttackUntil=now+390;s.biteAnimation={startedAt:now,duration:360,reach:profile.reach};s.pendingBite={enemy:combatTarget,profile,damage,hitAt:now+230};}
  if(profile.body&&now>=(s.nextBodyAttackCheck||0)){
   s.nextBodyAttackCheck=now+90;s.bodyAttackCooldowns ||= new Map();const damage=SPECIMEN_SYSTEM.effectiveStats(equippedSkin,specimenPoints()).damage;
   collectEnemyCandidatesNear(s.x,s.y,profile.reach+220/GAME_WORLD_ZOOM,specimenBodyCandidates);
   for(const enemy of specimenBodyCandidates){if(enemy.hp<=0||now<(s.bodyAttackCooldowns.get(enemy.id)||0)||!PET_TACTICS.attackContact(s,enemy,profile,facing,phase,window.AbyssalEnemyAI?.touchesKrakenTentacle)||!pveTerrainClear(s.x,s.y,enemy.x,enemy.y,2))continue;s.bodyAttackCooldowns.set(enemy.id,now+1020);s.visualAttackUntil=now+300;s.attackHoldUntil=Math.max(Number(s.attackHoldUntil)||0,now+180);const dx=enemy.x-s.x,dy=enemy.y-s.y,d=Math.hypot(dx,dy)||1,er=Number(enemy.r)||0;queueEffect({type:'ring',x:enemy.x-dx/d*er,y:enemy.y-dy/d*er,max:Math.max(12,visualRadius*.65),life:.24,maxLife:.24,color:currentSkinColor()});dealEnemyDamage(enemy,damage,'specimen-body-contact',{silentSound:true,secondary:true,origin:s});burst(enemy.x,enemy.y,currentSkinColor(),5,45);}
   for(const [id,until] of s.bodyAttackCooldowns)if(now>=until)s.bodyAttackCooldowns.delete(id);
  }
 }
 if(!attackHolding&&activeMapLayout&&ABYSSAL_MAP?.navigationTarget){const route=ABYSSAL_MAP.navigationTarget(activeMapLayout,pos.x,pos.y,target.x,target.y,{padding:5/GAME_WORLD_ZOOM});if(route&&!route.blocked)target={x:route.x,y:route.y};}
 if(!attackHolding&&soloCave){
  if(!orb&&!combatTarget&&SOLO_CAVERN.isBlocked(arenaRocks,target.x,target.y,pad))target={x:player.x,y:player.y};
  const goal={...target},nav=SOLO_CAVERN.navigationTarget(arenaRocks,W,H,pos.x,pos.y,goal.x,goal.y,pad);if(!nav.blocked)target={x:nav.x,y:nav.y};else target=SOLO_CAVERN.escapeTarget(arenaRocks,W,H,pos.x,pos.y,goal.x,goal.y,pad,s.facingAngle)||pos;
  if((s.stuckSeconds||0)>.8&&Math.hypot(goal.x-pos.x,goal.y-pos.y)>radius+5){const escape=SOLO_CAVERN.escapeTarget(arenaRocks,W,H,pos.x,pos.y,goal.x,goal.y,pad,s.facingAngle);if(escape){s.escapeWaypoint=escape;s.escapeUntil=now+650;}if(orb){s.unreachableOrbId=orb.id;s.unreachableUntil=now+1800;s.nextTacticsAt=0;}s.stuckSeconds=0;}
  if(s.escapeWaypoint&&now<s.escapeUntil&&Math.hypot(s.escapeWaypoint.x-pos.x,s.escapeWaypoint.y-pos.y)>5)target=s.escapeWaypoint;else s.escapeWaypoint=null;
 }
 const toxin=performance.now()<(Number(player.neurotoxinUntil)||0)?.38:1,slowed=Date.now()<(Number(player.skinSlowedUntil)||0)?.62:1,normalSpeed=Math.max(0,(SPECIMEN_SYSTEM.effectiveStats(equippedSkin,specimenPoints()).speed/GAME_WORLD_ZOOM)*toxin*slowed);
 if(attackHolding){const decay=Math.exp(-dt*14);s.vx=(Number(s.vx)||0)*decay;s.vy=(Number(s.vy)||0)*decay;s.stuckSeconds=Math.max(0,(s.stuckSeconds||0)-dt*3);}
 else{
  const move=SPECIMEN_EVASION?.steer({position:pos,target,enemies:navigationThreats,speed:normalSpeed,dt,radius,clearance:28/GAME_WORLD_ZOOM,heading:Number(s.facingAngle)||0,resolve:activeMapLayout&&ABYSSAL_MAP?.resolveMove?(x,y)=>ABYSSAL_MAP.resolveMove(activeMapLayout,pos.x,pos.y,x,y,5/GAME_WORLD_ZOOM):(isClassicCavernRun()&&SOLO_CAVERN?(x,y)=>SOLO_CAVERN.resolve(arenaRocks,pos.x,pos.y,x,y,pad):(x,y)=>({x:clamp(x,18/GAME_WORLD_ZOOM,W-18/GAME_WORLD_ZOOM),y:clamp(y,18/GAME_WORLD_ZOOM,H-18/GAME_WORLD_ZOOM)}))});
  if(move){
   if(combatTarget){const min=profile.core+(Number(combatTarget.r)||0)+2,oldDistance=Math.hypot(pos.x-combatTarget.x,pos.y-combatTarget.y),newDistance=Math.hypot(move.x-combatTarget.x,move.y-combatTarget.y);if(newDistance<min&&newDistance<oldDistance){move.x=pos.x;move.y=pos.y;}}
   s.x=move.x;s.y=move.y;const dx=move.x-pos.x,dy=move.y-pos.y,travelled=Math.hypot(dx,dy),velocityBlend=1-Math.exp(-dt*10);s.vx=(Number(s.vx)||0)+((dx/Math.max(.001,dt))-(Number(s.vx)||0))*velocityBlend;s.vy=(Number(s.vy)||0)+((dy/Math.max(.001,dt))-(Number(s.vy)||0))*velocityBlend;
   s.stuckSeconds=Math.hypot(target.x-pos.x,target.y-pos.y)>radius+4&&travelled<normalSpeed*dt*.2?(s.stuckSeconds||0)+dt:Math.max(0,(s.stuckSeconds||0)-dt*2);
   if(travelled>.01&&!combatTarget){const heading=Math.atan2(s.vy||dy,s.vx||dx),diff=Math.atan2(Math.sin(heading-(s.facingAngle||0)),Math.cos(heading-(s.facingAngle||0)));s.facingAngle=(s.facingAngle||0)+diff*(1-Math.exp(-dt*9));}
  }
 }
}

function hurtSpecimenSolo(amount){
 const s=player?.specimen;if(!s||s.alive===false||s.invuln>0||!Number.isFinite(amount)||amount<=0)return false;
 s.hp=Math.max(0,s.hp-amount);s.invuln=.35;burst(s.x,s.y,'#ff6f8d',8,65);
 if(s.hp<=0){s.alive=false;s.respawnAt=Date.now()+specimenProgressStats().respawnSeconds*1000;s.respawnTimer=specimenProgressStats().respawnSeconds;const trailing=Number(player.skinTrailUntil)>0;player.skinTrailUntil=0;player.skinActiveCooldown=trailing?(Number(player.skinTrailCooldownSeconds)||10):0;showToast(`ESPÉCIME ABATIDO · RETORNO EM ${fmtTime(s.respawnTimer)}`);updateAbilityButtons(true);}
 return true;
}
function updateSoloSpecimenContact(){
 const s=player?.specimen;if(onlineMode||!s||s.alive===false)return;
 const now=performance.now();collectEnemyCandidatesNear(s.x,s.y,360/GAME_WORLD_ZOOM,specimenContactCandidates);
 for(const e of specimenContactCandidates){if(!e||e.hp<=0||Math.hypot(e.x-s.x,e.y-s.y)>e.r+s.r+6/GAME_WORLD_ZOOM)continue;if(now<(Number(e.specimenAttackAt)||0))continue;e.specimenAttackAt=now+850;hurtSpecimenSolo(Math.max(5,Number(e.damage)||8)*.72);}
}
let diverBubbleClock=0;
function update(dt){
 const isPvpMode=onlineRoomMode==='pvp';
 if((gameState!=='playing'&&!(onlineMode&&gameState==='upgrade'))||!player)return;
 updateMapInteraction();
 updateSoloSubmarine(dt);
 updateSoloSubmarineInteraction();
 updateSkinCloudExpansions(dt);
 updateSkinPulses(dt);
 updateSmoothSkinPush(dt);
 if(!onlineMode)activateSoloRiftRoomEncounter();
 // Movimento local responsivo: teclado e toque/arraste. No online, trocar de aba nunca pausa o estado local intencionalmente.
 if(gameState==='playing'){
   // Correntezas ambientais removidas: o movimento depende apenas dos comandos do jogador.
   player.pulseCooldown=Math.max(0,(player.pulseCooldown||0)-dt);player.dashCooldown=Math.max(0,(player.dashCooldown||0)-dt);
   if(Number(player.skinWeaponBuffUntil)>0){
    if(performance.now()>=player.skinWeaponBuffUntil){
     player.skinWeaponBuffUntil=0;player.skinWeaponBuffKind=null;
     player.skinActiveCooldown=Number(player.skinWeaponBuffCooldownSeconds)||10;
    }
   }else if(Number(player.skinTrailUntil)>0){
    if(performance.now()>=player.skinTrailUntil){
     player.skinTrailUntil=0;player.skinActiveCooldown=Number(player.skinTrailCooldownSeconds)||10;
    }
   }else player.skinActiveCooldown=Math.max(0,(player.skinActiveCooldown||0)-dt);player.dashTime=Math.max(0,(player.dashTime||0)-dt);updateAbilityButtons();
   let mx=(keys['d']||keys['D']||keys['ArrowRight']?1:0)-(keys['a']||keys['A']||keys['ArrowLeft']?1:0);
   let my=(keys['s']||keys['S']||keys['ArrowDown']?1:0)-(keys['w']||keys['W']||keys['ArrowUp']?1:0);
   if(isMobileDevice()&&joystickVector.active){mx=joystickVector.x;my=joystickVector.y;}
   if(soloSubmarine.repair&&Math.hypot(mx,my)>.12)cancelSoloHullRepair();
   if(isClassicCavernRun()&&soloSubmarine.spawnFx>1.25){mx=0;my=0;}
   if(Date.now()<(Number(player.skinParalyzedUntil)||0)){mx=0;my=0;}
   else if(!soloSubmarine.repair&&!isMobileDevice()&&(autoFollowCursor||controlSettings.pc==='classic'&&pointer.down)&&!(mx||my)){
    // T follows the cursor in both controls; WASD always overrides it.
    // The manual aim and fire button state are not changed by movement.
    const dx=pointer.x-player.x,dy=pointer.y-player.y,dd=Math.hypot(dx,dy);
    if(dd>12){mx=dx/dd;my=dy/dd}else{mx=0;my=0}
   }
   if(isClassicCavernRun()&&soloSubmarine.spawnFx>1.25){mx=0;my=0;}
   if(isPcMouseAimMode())updateMouseAimFromCursor();
   if(isMobileDevice()&&controlSettings.mobile==='dual-stick'&&aimJoystickVector.active){controlAimAngle=Math.atan2(aimJoystickVector.y,aimJoystickVector.x);player.angle=controlAimAngle;player.weaponAngle=controlAimAngle;}
   if(soloSubmarine.repair){mx=0;my=0;}
   const mag=Math.hypot(mx,my)||1; if(mx||my){playWorldSound('swim-'+equippedMotionFamily(),player,500,.48);if(upgradeLevels.speed>0)playSkillSound('speed','trigger');const isGhostDash=Boolean(player.ghostDashUntil&&performance.now()<player.ghostDashUntil),toxinMultiplier=performance.now()<(Number(player.neurotoxinUntil)||0)?.38:1;const skinSlowMultiplier=Date.now()<(Number(player.skinSlowedUntil)||0)?.62:1;const normalBaseSpeed=player.moveSpeed*upgrades.speed*specimenPassiveMultiplier('movement')*toxinMultiplier*skinSlowMultiplier;const dashMultiplier=isGhostDash?Math.max(1,(500/GAME_WORLD_ZOOM)/Math.max(1,normalBaseSpeed)):(player.dashTime>0?2.05:1);const nx=player.x+mx/mag*normalBaseSpeed*dashMultiplier*dt,ny=player.y+my/mag*normalBaseSpeed*dashMultiplier*dt;const wall=52/GAME_WORLD_ZOOM;let nextX=clamp(nx,wall+player.r,W-wall-player.r),nextY=clamp(ny,wall+player.r,H-wall-player.r);if(activeMapLayout&&onlineRoomMode!=='pvp'){const caveMove=mapResolveMove(player.x,player.y,nextX,nextY,player.r+8/GAME_WORLD_ZOOM);nextX=caveMove.x;nextY=caveMove.y;}else if(usesNaturalOceanTerrain()&&OCEAN_GEOGRAPHY){const seaMove=OCEAN_GEOGRAPHY.resolveMove(player.x,player.y,nextX,nextY,player.r+5/GAME_WORLD_ZOOM);nextX=seaMove.x;nextY=seaMove.y;}else if(isClassicCavernRun()&&SOLO_CAVERN){const rockMove=SOLO_CAVERN.resolve(arenaRocks,player.x,player.y,nextX,nextY,player.r+6/GAME_WORLD_ZOOM);nextX=rockMove.x;nextY=rockMove.y;}if(onlineRoomMode==='pvp'){for(const rock of arenaRocks){if(rock.visualOnly)continue;const a=-(rock.angle||0),ox=nextX-rock.x,oy=nextY-rock.y,lx=ox*Math.cos(a)-oy*Math.sin(a),ly=ox*Math.sin(a)+oy*Math.cos(a),rx=(rock.rx||rock.r)+player.r,ry=(rock.ry||rock.r)+player.r,nx=lx/Math.max(1,rx),ny=ly/Math.max(1,ry);if(nx*nx+ny*ny<1){const d=Math.hypot(nx,ny)||1;const pushX=nx/d*rx,pushY=ny/d*ry,ca=Math.cos(rock.angle||0),sa=Math.sin(rock.angle||0);nextX=rock.x+pushX*ca-pushY*sa;nextY=rock.y+pushX*sa+pushY*ca;}}}const traveledX=nextX-player.x,traveledY=nextY-player.y;player.x=nextX;player.y=nextY;if(Math.hypot(traveledX,traveledY)>.01){const swimHeading=Math.atan2(traveledY,traveledX);const diff=Math.atan2(Math.sin(swimHeading-(player.bodyAngle||0)),Math.cos(swimHeading-(player.bodyAngle||0)));player.bodyAngle=(player.bodyAngle||0)+diff*(1-Math.exp(-dt*13));}if(!isManualFiringMode()){/* Body heading is independent of automatic weapon aim. */}else player.weaponAngle=player.angle;updateCamera();player.trail.push({x:player.x,y:player.y,life:.28});if(player.trail.length>12)player.trail.shift();
   // Tiny cosmetic bubbles disperse quickly. They do not deal damage or use networking.
   diverBubbleClock+=dt;
   if(diverBubbleClock>=.075){
    diverBubbleClock=0;
    for(let n=0;n<2;n++){
     const p=particlePool.pop()||{},side=(Math.random()-.5)*player.r*.85;
     const a=player.bodyAngle||0;
     p.x=player.x-Math.cos(a)*player.r*1.35-Math.sin(a)*side;
     p.y=player.y-Math.sin(a)*player.r*1.35+Math.cos(a)*side;
     p.vx=-Math.cos(a)*13/GAME_WORLD_ZOOM+(Math.random()-.5)*8/GAME_WORLD_ZOOM;
     p.vy=(-18-Math.random()*12)/GAME_WORLD_ZOOM;
     p.max=.3+Math.random()*.23;p.life=p.max;
     p.r=(.8+Math.random()*.85)/GAME_WORLD_ZOOM;p.color='#d9faff';p.bubble=true;
     particles.push(p);
    }
   }}
   if(soloSubmarine.repair)updateSoloHullRepair(dt);else updateAutomaticWeaponAim();
   // No pointer/touch event may reset this timer. Upgrades alone increase cadence.
   player.fireTimer=Math.max(0,(Number(player.fireTimer)||0)-dt);
   if(!soloSubmarine.repair&&player.fireTimer<=0&&(!isManualFiringMode()||manualFireDown())&&(!isClassicCavernRun()||soloSubmarine.spawnFx<=1.25)){
    fire();player.fireTimer=Math.max(.12,BASE_SHOT_INTERVAL/((upgrades.rate||1)*specimenPassiveMultiplier('fireRate')));
   }
 }
 // Companion sim runs even if diver is not moving.
 updateSpecimenRuntime(dt);
 tickSoloSpecimenOrbs();
 updateSkinTrailRuntime();
 if(onlineMode&&authoritativeElapsed!==null&&lastSnapshotAt){elapsed=authoritativeElapsed+Math.max(0,(performance.now()-lastSnapshotAt)/1000);}else elapsed+=dt;if(!onlineMode)updateSoloRiftHardcore(dt);publishLiveRiftDepth();if(!onlineMode){expireSoloDepthEventIfNeeded();spawnTimer-=dt;if(isClassicShooterRun())updateBossProgressionStep(dt);}else if(onlineRoomMode==='coop'){if(!progressionPausedForBoss)progressionDistance=Math.min(100,progressionDistance+dt*3.8);updateProgressionTrackUI();}

  // Gestão da esteira de bolhas do tubarão (dura 5 segundos e causa dano reduzido)
  let areaGridReady=false;
  for (let i = sharkWakeTrails.length - 1; i >= 0; i--) {
    const bubble = sharkWakeTrails[i];
    bubble.life -= dt;
    bubble.damageTimer = (bubble.damageTimer || 0) - dt;
    if (bubble.damageTimer <= 0) {
      bubble.damageTimer=.50;
      if(onlineMode){if(bubble.life<=0)sharkWakeTrails.splice(i,1);continue;}
      if(!areaGridReady){rebuildEnemyCollisionGrid();areaGridReady=true;}
      const candidates=collectEnemyCandidatesNear(bubble.x,bubble.y,bubble.r+40/GAME_WORLD_ZOOM);
      for (const e of candidates) {
        if (Math.hypot(e.x - bubble.x, e.y - bubble.y) <= bubble.r + (e.r || 10)&&performance.now()-(e.wakeHitAt??-Infinity)>=500&&pveTerrainClear(bubble.x,bubble.y,e.x,e.y,2)) {
          e.wakeHitAt=performance.now();
          dealEnemyDamage(e,5,'skin-active-trail', { visual: showPeriodicSkinDamageNumber(e), silentSound: true, origin:bubble });
          burst(e.x, e.y, bubble.ink?'#768096':(bubble.color||'#7bf5ff'), 2, 30);
        }
      }
    }
    if (bubble.life <= 0) sharkWakeTrails.splice(i, 1);
  }

  for(let i=inkTrails.length-1;i>=0;i--){const ink=inkTrails[i];ink.life-=dt;if(ink.life<=0)inkTrails.splice(i,1);}

  // Dano contínuo de veneno (verde) nos inimigos envenenados
  for (const e of [...enemies]) {
    if (e.hp>0&&e.poisonTimer > 0) {
      e.poisonTimer -= dt;
      e.poisonTick = (e.poisonTick || 0) - dt;
      if (e.poisonTick <= 0) {
        e.poisonTick = SKIN_TRAIL_CADENCE_SECONDS;
        dealEnemyDamage(e, 5, 'skin-active-poison-dot', { visual: showPeriodicSkinDamageNumber(e), silentSound: true });
        burst(e.x + rand(-e.r*0.5, e.r*0.5), e.y + rand(-e.r*0.5, e.r*0.5), '#39ff74', 4, 45);
      }
    }
  }

player.invuln=Math.max(0,player.invuln-dt);damageFlash=Math.max(0,damageFlash-dt);shake=Math.max(0,shake-dt*22);
 if(!onlineMode&&isOpenSeaRun()&&spawnTimer<=0){updateSoloOceanChunks();spawnTimer=.20;}if(!onlineMode&&isClassicShooterRun()&&spawnTimer<=0){const commonCount=enemies.filter(e=>!BOSS_KINDS.includes(e.kind)).length;if(commonCount<soloCommonCap()&&enemies.length<soloEnemyCap()){spawnEnemy(false,'common');const ramp=clamp(elapsed/300,0,1),eventSpawn=EXPEDITION_RULES?.eventSpawnIntervalMultiplier?.(soloDepthEventId)||1;spawnTimer=Math.max(.18,.55*(1-(2/3)*ramp)*eventSpawn);}else spawnTimer=.35;}
 // Spawn de boss solo gerenciado exclusivamente pelo sistema de progressão (updateBossProgressionStep).
 // O bloco antigo de nextBossAt foi removido para evitar spawns duplicados fora da progressão.
 if(!onlineMode&&upgrades.regen>0&&Math.random()<dt*upgrades.regen*.25){const beforeRegen=hp;hp=Math.min(maxHp,hp+1);if(hp>beforeRegen){playSkillSound('regen','trigger');queueEffect({type:'regen-pulse',x:player.x,y:player.y,max:player.r*2.8,life:.55,maxLife:.55,color:'#67f5a0'});}}
 if(gameState==='playing'&&upgrades.ward>0){const interval=Math.max(18,28-(upgrades.ward-1)*4);if(!Number.isFinite(player.wardTimer))player.wardTimer=interval;player.wardTimer-=dt;if(player.wardTimer<=0){player.wardTimer=interval;player.invuln=Math.max(player.invuln,.55);burst(player.x,player.y,'#9deaff',14,105);queueEffect({type:'ward-collapse',x:player.x,y:player.y,max:player.r*3.2,life:.55,maxLife:.55,color:'#8deaff'});playSkillSound('shield','trigger');}}
 if(gameState==='playing'&&upgrades.pressureCocoon>0){const cocoonInterval=[0,24,20,16][Math.min(3,upgrades.pressureCocoon)];if(upgrades.shield<=0){player.pressureCocoonTimer=(Number.isFinite(player.pressureCocoonTimer)?player.pressureCocoonTimer:cocoonInterval)-dt;if(player.pressureCocoonTimer<=0){player.pressureCocoonTimer=cocoonInterval;upgrades.shield=1;queueEffect({type:'ward-collapse',x:player.x,y:player.y,max:player.r*3.6,life:.7,maxLife:.7,color:'#58d6c4'});burst(player.x,player.y,'#76f5df',18,100);if(onlineMode)window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet,rangeStrength:upgrades.range,speedStrength:upgrades.speed,arcChainActive:Boolean(upgrades.arcChain),hadalBeamActive:Boolean(upgrades.hadalBeam),ricochetLevel:upgrades.ricochet,prismaticLevel:upgrades.spread,predatorLevel:upgrades.predator,electricLevel:upgrades.electric,shellLevel:upgrades.shell,lastStandLevel:upgrades.lastStand,submarineWeapons:window.AbyssalSoloBase?.installedWeapons?.()||['photon']});}}else player.pressureCocoonTimer=cocoonInterval;}
 if(upgrades.burst>0){player.burstTimer=(player.burstTimer||0)-dt;if(player.burstTimer<=0){player.burstTimer=Math.max(3.5,7/upgrades.burst);for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<210*upgrades.range/GAME_WORLD_ZOOM){dealEnemyDamage(e,12*upgrades.burst,'burst');burst(e.x,e.y,'#b4a1ff',8,100)}}burst(player.x,player.y,'#b3a0ff',60,260);queueEffect({type:'ring',x:player.x,y:player.y,r:0,max:210*upgrades.range/GAME_WORLD_ZOOM,life:.62,maxLife:.62,color:'#c18cff'});queueEffect({type:'ring',x:player.x,y:player.y,r:0,max:145*upgrades.range/GAME_WORLD_ZOOM,life:.4,maxLife:.4,color:'#f0d9ff'});playWorldSound('ability-nova',player,1000,.82)}}
 if(upgrades.photonRay>0&&(!isManualFiringMode()||manualFireDown())){
  player.photonRayTimer=(Number(player.photonRayTimer)||0)-dt;
  const beamLevel=Math.max(1,Math.min(3,Number(upgrades.photonRay)||1));
  const beamInterval=PHOTON_RAY_VISUAL.pulseInterval,width=PHOTON_RAY_VISUAL.widths[beamLevel]*(upgrades.hadalBeam?1.35:1)/GAME_WORLD_ZOOM,beamRange=getFiringRange();
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
    if(!candidate||candidate.alive===false||(Number.isFinite(Number(candidate.hp))&&Number(candidate.hp)<=0)||(!isPvpMode&&enemyHiddenFromAutoTarget(candidate)))continue;
    const dx=(Number(candidate.x)||0)-player.x,dy=(Number(candidate.y)||0)-player.y,d=dx*dx+dy*dy;
    if(d<nearestDistance&&(isPvpMode||pveProjectileTerrainClear(player.x,player.y,candidate.x,candidate.y,2))){nearest=candidate;nearestDistance=d;}
   }
   if(nearest){aimAngle=aimAtEnemy(nearest);hasAim=true;}
  }
  if(!hasAim){if(player.photonRayActive&&onlineMode)window.AbyssalOnline?.sendPhotonRayStop?.();player.photonRayActive=false;player.photonRayTimer=Math.min(Number(player.photonRayTimer)||0,0);}
  const ux=Math.cos(aimAngle),uy=Math.sin(aimAngle);
  const gunOrigin=DIVER_ART?.muzzle?.(player.x,player.y,player.r,aimAngle)||{x:player.x,y:player.y};
  const rayX=gunOrigin.x,rayY=gunOrigin.y;
  // The target selects direction only. The visible/damaging ray always extends to full range.
  // This prevents the local client from visually snapping the endpoint onto an interpolated
  // moving target before the authoritative server position has actually crossed the beam.
  let beamLength=beamRange,beamTargetId=null;
  if(hasAim&&!manualPhotonAim){
   const candidates=isPvpMode?(window.AbyssalOnline?.getPlayers?.()||[]):enemies;
   let nearest=null,nearestDistance=beamRange;
   for(const candidate of candidates){
    if(!candidate||candidate.alive===false||(Number.isFinite(Number(candidate.hp))&&Number(candidate.hp)<=0)||(!isPvpMode&&enemyHiddenFromAutoTarget(candidate)))continue;
    const dx=(Number(candidate.x)||0)-player.x,dy=(Number(candidate.y)||0)-player.y,d=Math.hypot(dx,dy);
    if(d<nearestDistance){nearest=candidate;nearestDistance=d;}
   }
   if(nearest)beamTargetId=String(nearest.id??'');
  }
  let x2=rayX+ux*beamLength,y2=rayY+uy*beamLength;
  if(isPvpMode&&projectileHitsPvpWall(rayX,rayY,x2,y2,Math.max(1,width*.5))){
   let lo=0,hi=1;for(let step=0;step<10;step++){const mid=(lo+hi)*.5;if(projectileHitsPvpWall(rayX,rayY,rayX+(x2-rayX)*mid,rayY+(y2-rayY)*mid,Math.max(1,width*.5)))hi=mid;else lo=mid;}beamLength*=lo;x2=rayX+ux*beamLength;y2=rayY+uy*beamLength;beamTargetId=null;
  }
  if(!isPvpMode){const clipped=clipPrismaticPhotonRay(rayX,rayY,x2,y2,Math.max(1,width*.5));if(clipped.x2!==x2||clipped.y2!==y2){x2=clipped.x2;y2=clipped.y2;beamLength=Math.hypot(x2-rayX,y2-rayY);beamTargetId=null;}}
  const prismBeams=[];
  if(hasAim&&Number(upgrades.spread)>0){
   const rank=Math.max(0,Math.min(3,Number(upgrades.spread)||0));
   for(let i=0;i<rank*2;i++){
    const offset=(i%2===0?-1:1)*(.12+.075*Math.floor(i/2));
    const a=aimAngle+offset,rad=width*.58;
    const end=clipPrismaticPhotonRay(rayX,rayY,rayX+Math.cos(a)*beamRange,rayY+Math.sin(a)*beamRange,Math.max(1,rad*.5));
    prismBeams.push({x1:rayX,y1:rayY,x2:end.x2,y2:end.y2,width:rad});
   }
  }
  if(hasAim){player.angle=aimAngle;player.weaponAngle=aimAngle;player.photonRayActive=true;
   // Keep the additional prismatic rays visually continuous instead of
   // recreating flashes every pulse. Exactly 2/4/6 side rays match the rank.
   for(let i=0;i<prismBeams.length;i++){
    const beam=prismBeams[i],existing=effects.find(fx=>fx.localPrismBeamKey===i);
    if(existing){existing.x1=beam.x1;existing.y1=beam.y1;existing.x2=beam.x2;existing.y2=beam.y2;existing.width=beam.width;existing.life=PHOTON_RAY_VISUAL.duration;}
    else queueEffect({type:'photon-ray',localPrismBeamKey:i,x1:beam.x1,y1:beam.y1,x2:beam.x2,y2:beam.y2,width:beam.width,life:PHOTON_RAY_VISUAL.duration,maxLife:PHOTON_RAY_VISUAL.duration,color:'#c8a5ff'});
   }
  refreshPhotonBeam('localPhotonBeam',true,rayX,rayY,x2,y2,width);
  if(player.photonRayTimer<=0){
   player.photonRayTimer=beamInterval;
   const beamDps=(getShotDamageAtLevel(beamLevel,'photonRay')/BASE_SHOT_INTERVAL)*(upgrades.power||1)*(upgrades.hadalBeam?1.2:1),pulseDamage=beamDps*beamInterval;
   // A single command describes the whole ray. Server determines every PvE/PvP hit.
   if(onlineMode&&window.AbyssalOnline?.sendShot){const actionId=nextShotVolleyId();window.AbyssalOnline.sendShot({x:rayX/W,y:rayY/H,vx:ux*900/GAME_WORLD_ZOOM/W,vy:uy*900/GAME_WORLD_ZOOM/H,damage:pulseDamage,color:PHOTON_RAY_VISUAL.color,beamLevel,special:'photonRay',beamTargetId:beamTargetId||null,beamEndX:x2/W,beamEndY:y2/H,manualAim:manualPhotonAim,volleyId:actionId,actionId});}
   if(!onlineMode){
    // Damage may remove killed enemies from the original list; iterate a snapshot.
    for(const target of [...enemies]){
     if(!target||target.hp<=0)continue;
     const coreHit=PHOTON_RAY_VISUAL.segmentCircleHit(rayX,rayY,x2,y2,target.x,target.y,target.r+width*.5);
     const prismHit=!coreHit&&prismBeams.some(beam=>PHOTON_RAY_VISUAL.segmentCircleHit(beam.x1,beam.y1,beam.x2,beam.y2,target.x,target.y,target.r+beam.width*.5));
     if(!coreHit&&!prismHit)continue;
     dealEnemyDamage(target,pulseDamage*(coreHit?1:.42),'photonRay',{origin:gunOrigin});target.hit=.08;burst(target.x,target.y,prismHit?'#c8a5ff':'#bafaff',beamLevel+1,35);
    }
   }
  }
  }
 }else if(player.photonRayActive){
  if(onlineMode)window.AbyssalOnline?.sendPhotonRayStop?.();
  player.photonRayActive=false;
 }
 // Nova is still the primary shot when gravitationalRupture is fused.
 if((Number(upgrades.nova)>0||Number(upgrades.gravitationalRupture)>0)&&(!isManualFiringMode()||manualFireDown())){
  player.novaTimer=(Number.isFinite(player.novaTimer)?player.novaTimer:0)-dt;
  if(player.novaTimer<=0){
   player.novaTimer=isPvpMode?2.4:NOVA_SOLO_INTERVAL;
   const novaRange=getFiringRange(),combined=Number(upgrades.gravitationalRupture)>0;
   const novaLevel=Math.max(1,Math.min(3,Number(upgrades.nova)||Number(upgradeLevels.nova)||1));
   const novaDamage=(getShotDamageAtLevel(novaLevel,'nova')/BASE_SHOT_INTERVAL)*(upgrades.power||1);
   let novaAngle=Number(player.weaponAngle??player.angle)||0;
   if(isPcMouseAimMode()){
    updateMouseAimFromCursor();novaAngle=Number(player.weaponAngle??player.angle)||0;
   }else if(isMobileDevice()&&controlSettings.mobile==='dual-stick'&&aimJoystickVector.active){
    novaAngle=Number(controlAimAngle)||0;
   }else{
    let near=null,min=Infinity;
    for(const e of enemies){if(!e||e.hp<=0||enemyHiddenFromAutoTarget(e))continue;
     const d=Math.hypot(e.x-player.x,e.y-player.y);
     if(d<novaRange&&d<min&&pveProjectileTerrainClear(player.x,player.y,e.x,e.y,2)){min=d;near=e;}
    }
    if(near)novaAngle=aimAtEnemy(near);
   }
   player.weaponAngle=novaAngle;player.angle=novaAngle;
   const volleyId=nextShotVolleyId(),speed=420/GAME_WORLD_ZOOM;
   const muzzle=DIVER_ART?.muzzle?.(player.x,player.y,player.r,novaAngle)||{x:player.x+Math.cos(novaAngle)*28/GAME_WORLD_ZOOM,y:player.y+Math.sin(novaAngle)*28/GAME_WORLD_ZOOM};
   if(onlineMode&&window.AbyssalOnline?.sendShot)window.AbyssalOnline.sendShot({
    x:muzzle.x/W,y:muzzle.y/H,
    vx:Math.cos(novaAngle)*speed/W,vy:Math.sin(novaAngle)*speed/H,
    damage:novaDamage,color:'#72f5ff',special:'nova',volleyId,combined
   });
   else if(!onlineMode){
    for(const e of [...enemies]){
     if(!e||e.hp<=0||!window.AbyssalGravityCone?.contains?.(muzzle.x,muzzle.y,novaAngle,e.x,e.y,e.r,novaRange))continue;
     if(!pveProjectileTerrainClear(muzzle.x,muzzle.y,e.x,e.y,2))continue;
     dealEnemyDamage(e,novaDamage,'nova',{origin:muzzle});burst(e.x,e.y,'#72f5ff',3,70);
    }
   }
   spawnNovaVisual(muzzle.x,muzzle.y,novaRange,'#72f5ff',isPvpMode,novaAngle,combined);
   emitPrismaticNovaShards(novaDamage,volleyId);
   playSkillSound('nova','trigger');
  }
 }
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
    queueEffect({type:'beam',x1:e.x-5/worldZoom,y1:e.y-5/worldZoom,x2:e.x+5/worldZoom,y2:e.y+5/worldZoom,life:.16,maxLife:.16,color:'#9dfcff'});
   }
   playSkillSound('nova','trigger');playWorldSound('ability-nova',player,920,.70);
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
    queueEffect({type:'beam',x1:previous.x,y1:previous.y,x2:target.x,y2:target.y,life:.2,maxLife:.2,color:'#77f7ff'});
    burst(target.x,target.y,'#a4ffff',7,90);
    previous=target;
   }
   if(targets.length)playWorldSound('ability-beam',player,900,.47);
  }
 }
 // Co-op is rendered from the server's authoritative coordinates. Do NOT run a
 // second local AI here: that divergence is what made server-side contact attacks feel
 // like invisible enemies. Solo keeps its original local movement/collision loop.
 onlineVisualEnemyCount=enemies.length;onlineVisualMovingEnemies=0;
 const enemyFrameNow=performance.now(),localTarget={x:player.x,y:player.y,local:true,skinId:equippedSkin},localTargets=[localTarget];
 // Spatial index avoids all-pairs separation scans in dense hordes.
 if(!onlineMode&&isClassicShooterRun())rebuildEnemyCollisionGrid();
 for(let i=enemies.length-1;i>=0;i--){
  const e=enemies[i];e.hit=Math.max(0,e.hit-dt);
  if(onlineMode){
   const bx=Number(e.x)||0,by=Number(e.y)||0;
   const rendered=window.AbyssalEnemyNetcode?.renderedPosition?.(e,enemyFrameNow);
   const sx=Number.isFinite(Number(e.serverX))?Number(e.serverX):(rendered?.x??bx),sy=Number.isFinite(Number(e.serverY))?Number(e.serverY):(rendered?.y??by);
   const sampleAge=Number.isFinite(Number(e.snapshotReceivedAt))?clamp((enemyFrameNow-Number(e.snapshotReceivedAt))/1000,0,.18):0;
   const predictedX=sx+(Number(e.vx)||0)*sampleAge*.65,predictedY=sy+(Number(e.vy)||0)*sampleAge*.65;
   const renderX=Number.isFinite(Number(rendered?.x))?Number(rendered.x):predictedX,renderY=Number.isFinite(Number(rendered?.y))?Number(rendered.y):predictedY;
   const renderGap=Math.hypot(renderX-bx,renderY-by),serverGap=Math.hypot(sx-bx,sy-by);
   // The motion buffer is preferred, but serverX/serverY are an invariant fallback.
   // If interpolation stalls while authoritative coordinates keep advancing, converge
   // directly to the latest server trajectory instead of leaving a frozen hitbox sprite.
   const stalledVisual=renderGap<.015&&serverGap>.35;
   const targetX=stalledVisual?predictedX:renderX,targetY=stalledVisual?predictedY:renderY;
   const catchup=1-Math.exp(-dt*(stalledVisual?30:20));
   if(serverGap>120/GAME_WORLD_ZOOM){e.x=sx;e.y=sy;}
   else{e.x=bx+(targetX-bx)*catchup;e.y=by+(targetY-by)*catchup;}
   if(Math.hypot(e.x-bx,e.y-by)>.02)onlineVisualMovingEnemies++;
   continue;
  }
  if(activeMapLayout&&Date.now()-(e.spawnedAt||0)<3000)continue;
  if(e.kind===RIFT_HARDCORE?.FINAL_KIND)continue;
  const anglerHidden=false,target=soloCreatureTarget(e,localTarget),creatureTargets=target===localTarget?localTargets:[target];
  if(e.kind==='kraken'){
   e.krakenSweepTimer=Math.max(0,(Number(e.krakenSweepTimer)||0)-dt);
   if(e.krakenSweepTimer<=0){
    e.krakenSweepCycle=(Number(e.krakenSweepCycle)||0)+dt;
    const cycle=e.krakenSweepCycle,wasSweeping=Boolean(e.krakenSweepActive);
    e.krakenTelegraph=cycle<2.4?clamp(cycle/2.4,0,1):1;
    e.krakenSweepActive=cycle>=2.4&&cycle<5.2;
    if(!wasSweeping&&e.krakenSweepActive)playWorldSound('boss-attack-kraken',e,1200,.88);
    if(cycle>=10){e.krakenSweepCycle=0;e.krakenSweepActive=false;e.krakenTelegraph=0;}
   }
  }
  if(e.kind==='devourer'){
   e.suctionCooldown=Math.max(0,(Number(e.suctionCooldown)||0)-dt);
   if(e.suctionActive){e.suctionTimer=Math.max(0,(Number(e.suctionTimer)||0)-dt);if(e.suctionTimer<=0)e.suctionActive=false;}
   else if(e.suctionCooldown<=0){e.suctionActive=true;e.suctionTimer=4;e.suctionCooldown=20;e.suctionPulse=(Number(e.suctionPulse)||0)+1;playDevourerSuction();showToast('SUCÇÃO DO DEVORADOR · AFASTE-SE DA BOCA');}
   if(e.suctionActive){
    e.vx=0;e.vy=0;e.angle=Math.atan2(target.y-e.y,target.x-e.x);
    if(isClassicShooterRun())soloHullContact(e,enemyFrameNow);
    for(const creature of enemies){if(creature===e||!pveTerrainClear(e.x,e.y,creature.x,creature.y,2))continue;const pull=window.AbyssalEnemyAI?.suctionPullDelta?.(creature,e,dt);if(!pull||(!pull.dx&&!pull.dy))continue;const moved=mapResolveMove(creature.x,creature.y,creature.x+pull.dx,creature.y+pull.dy,Math.max(8,creature.r*.7));const adx=moved.x-creature.x,ady=moved.y-creature.y;creature.x=moved.x;creature.y=moved.y;creature.vx=adx/Math.max(dt,.001);creature.vy=ady/Math.max(dt,.001);}
    const pull=pveTerrainClear(e.x,e.y,player.x,player.y,2)?window.AbyssalEnemyAI?.suctionPullDelta?.(player,e,dt):null;if(pull&&(pull.dx||pull.dy)){const moved=mapResolveMove(player.x,player.y,clamp(player.x+pull.dx,player.r,W-player.r),clamp(player.y+pull.dy,player.r,H-player.r),player.r+8/GAME_WORLD_ZOOM);player.x=moved.x;player.y=moved.y;updateCamera();}
    continue;
   }
  }
  // Habilidades colossais: os mesmos números e geometrias usados pelo servidor autoritativo.
  if(!onlineMode&&e.kind==='boss'){
   e.inkTrailTimer=(Number(e.inkTrailTimer)||0)+dt;
   if(e.inkTrailTimer>=.275){
    e.inkTrailTimer=0;const radius=76/GAME_WORLD_ZOOM;
    const ix=e.x-Math.cos(e.angle||0)*e.r*.72,iy=e.y-Math.sin(e.angle||0)*e.r*.72;
    renderBossAbilityVisual({abilityId:'ink-trail',kind:e.kind,x:ix,y:iy,angle:e.angle||0,radius,color:'#07101d'});
    if(pveTerrainClear(ix,iy,player.x,player.y,2)&&DIVER_HITBOX?.circleHit?.(player,ix,iy,radius,performance.now())&&player.invuln<=0){hurtPlayer(2);shake=5;}
    if(player.specimen?.alive&&Math.hypot(player.specimen.x-ix,player.specimen.y-iy)<=radius+player.specimen.r)hurtSpecimenSolo(2*.72);
   }
  }
  // Peixe-pescador: a antiga isca ofensiva foi substituída pela camuflagem cíclica.
  if(!onlineMode&&e.kind==='maw'){
   e.mawChomp=(e.mawChomp||0)+dt;
   if(e.mawChomp>=4.0){
     e.mawChomp=0;const radius=205/GAME_WORLD_ZOOM;
     renderBossAbilityVisual({abilityId:'gulper-chomp',kind:e.kind,x:e.x,y:e.y,angle:e.angle||0,radius,color:e.color||'#c16cff'});
     if(pveTerrainClear(e.x,e.y,player.x,player.y,2)&&DIVER_HITBOX?.circleHit?.(player,e.x,e.y,radius,performance.now())&&player.invuln<=0){hurtPlayer(24);shake=11;}
     if(player.specimen?.alive&&Math.hypot(player.specimen.x-e.x,player.specimen.y-e.y)<=radius+player.specimen.r)hurtSpecimenSolo(24*.72);
   }
  }
  if(!onlineMode&&e.kind==='leviathan'){
   e.leviTrail=(e.leviTrail||0)+dt;e.pressureWaveTimer=(e.pressureWaveTimer||0)+dt;
   if(e.leviTrail>0.2){e.leviTrail=0;queueEffect({type:'ring',x:e.x,y:e.y,max:52/worldZoom,life:.36,maxLife:.36,color:'#4ce0d1'});}
   if(e.pressureWaveTimer>=4.8){
    e.pressureWaveTimer=0;const ang=e.angle||0,reach=pveRayDistance(e.x,e.y,Math.cos(ang),Math.sin(ang),480/GAME_WORLD_ZOOM,2),x2=e.x+Math.cos(ang)*reach,y2=e.y+Math.sin(ang)*reach;
    renderBossAbilityVisual({abilityId:'pressure-lance',kind:e.kind,x:e.x,y:e.y,angle:ang,radius:reach,color:e.color||'#4ce0d1'});
    if(pveTerrainClear(e.x,e.y,player.x,player.y,2)&&DIVER_HITBOX?.segmentHit?.(player,e.x,e.y,x2,y2,72/GAME_WORLD_ZOOM,performance.now())&&player.invuln<=0){hurtPlayer(22);shake=12;}
    if(player.specimen?.alive&&marineAbilityLineDistance(player.specimen.x,player.specimen.y,e.x,e.y,x2,y2)<=72/GAME_WORLD_ZOOM+player.specimen.r)hurtSpecimenSolo(22*.72);
   }
  }
  // 4. White Shark Boss: rastro de corte de barbatanas
  if(e.kind==='whiteSharkBoss'){
   e.sharkWake=(e.sharkWake||0)+dt;
   if(e.sharkWake>0.15){
     e.sharkWake=0;
     const sa=e.angle||0,nx=Math.cos(sa+Math.PI/2),ny=Math.sin(sa+Math.PI/2);for(const off of [-8,0,8])queueEffect({type:'beam',x1:e.x-Math.cos(sa)*42/GAME_WORLD_ZOOM+nx*off/GAME_WORLD_ZOOM,y1:e.y-Math.sin(sa)*42/GAME_WORLD_ZOOM+ny*off/GAME_WORLD_ZOOM,x2:e.x+Math.cos(sa)*18/GAME_WORLD_ZOOM+nx*off/GAME_WORLD_ZOOM,y2:e.y+Math.sin(sa)*18/GAME_WORLD_ZOOM+ny*off/GAME_WORLD_ZOOM,life:.28,maxLife:.28,color:off===0?'#eaffff':'#68a8b8',width:(off===0?4:2.4)/GAME_WORLD_ZOOM});
   }
  }
  // 5. Bruto: carapaça endurecida reflete fragmentos ao tomar hit
  if(e.kind==='brute'&&e.hit>0.08){
    burst(e.x,e.y,'#bd88ff',2,30);
  }

  const beforeEnemyX=e.x,beforeEnemyY=e.y;
  if(e.kbVx||e.kbVy){
   const dx=e.kbVx*dt,dy=e.kbVy*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/12));for(let i=0;i<steps;i++){const moved=mapResolveMove(e.x,e.y,clamp(e.x+dx/steps,0,W),clamp(e.y+dy/steps,0,H),Math.max(8,e.r*.68));e.x=moved.x;e.y=moved.y;if(moved.blocked){e.kbVx*=.25;e.kbVy*=.25;break;}}
   const decay=Math.exp(-dt*6.5);
   e.kbVx*=decay;e.kbVy*=decay;
   if(Math.hypot(e.kbVx,e.kbVy)<15){e.kbVx=0;e.kbVy=0;}
  }
  if(isClassicShooterRun()&&holdSoloHullAttack(e,dt,enemyFrameNow))continue;
  if(enemyParalyzedNow(e)){e.vx=0;e.vy=0;}
  else if(window.AbyssalEnemyAI?.moveTowardTarget){
   soloEnemyMovementOptions.minX=8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.maxX=W-8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.minY=8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.maxY=H-8/GAME_WORLD_ZOOM;soloEnemyMovementOptions.stopDistance=(target.submarine||target.specimen)?0:window.AbyssalEnemyAI.tentacleStopDistance(e,e.r,target.r||player.r,SPECIMEN_SYSTEM.familyFor(e.specimenSkinId));soloEnemyMovementOptions.holdPosition=false;
   let movementTargets=creatureTargets;if(anglerHidden)movementTargets=[];soloEnemyMovementOptions.freeSwim=false;
   if(!activeMapLayout&&usesNaturalOceanTerrain()&&e.wildlifeMode&&OPEN_SEA_ECOLOGY){
     if(Math.hypot(e.x-player.x,e.y-player.y)<=e.r+player.r+8/GAME_WORLD_ZOOM)e.provokedUntil=performance.now()+4000;
     const ecologyNow=performance.now(),playerDistance=Math.hypot(e.x-player.x,e.y-player.y),priority=playerDistance<520/GAME_WORLD_ZOOM||e.aiMode==='attack'||e.aiMode==='flee'||e.aiMode==='evade-predator';
     let ec=e.openSeaDecision;
     if(!ec||ecologyNow>=(Number(e.openSeaNextThinkAt)||0)){if(!ec||consumeFaunaThinkBudget(priority)){collectEnemyCandidatesNear(e.x,e.y,470/GAME_WORLD_ZOOM,wildlifeNeighborCandidates);ec=OPEN_SEA_ECOLOGY.decide(e,[player],elapsed,ecologyNow,wildlifeNeighborCandidates);e.openSeaDecision=ec;e.openSeaNextThinkAt=ecologyNow+(priority?90:160+(Math.abs(Number(e.id)||0)%5)*18);}}
     if(!ec){collectEnemyCandidatesNear(e.x,e.y,470/GAME_WORLD_ZOOM,wildlifeNeighborCandidates);ec=OPEN_SEA_ECOLOGY.decide(e,[player],elapsed,ecologyNow,wildlifeNeighborCandidates);e.openSeaDecision=ec;}
     e.openSeaWantsAttack=ec.aggressive||(window.AbyssalEnemyAI.isChargeAttack(e)&&e.sharkCharging);
     if(ec.aggressive&&player){
      const skill=OPEN_SEA_ECOLOGY?.activateAgainstPlayer?.(e,player,performance.now());
      if(skill){
       renderBossAbilityVisual({abilityId:'wildlife-'+skill.id,kind:e.kind,x:e.x,y:e.y,
        angle:e.angle||0,radius:skill.range,color:skill.color});
       if(skill.damage>0&&pveTerrainClear(e.x,e.y,player.x,player.y,2)){
        hurtPlayer(skill.damage);
        if(skill.neurotoxinMs>0)player.neurotoxinUntil=performance.now()+Math.min(100,skill.neurotoxinMs);
       }
      }
     }
     soloEnemyMovementOptions.stopDistance=ec.aggressive?window.AbyssalEnemyAI.tentacleStopDistance(e,e.r,player.r,SPECIMEN_SYSTEM.familyFor(e.specimenSkinId)):5;
     soloEnemyMovementOptions.freeSwim=!window.AbyssalEnemyAI.isChargeAttack(e)||(!ec.aggressive&&!e.sharkCharging);
     const swimRoute=OPEN_SEA_ECOLOGY.navigationTarget(e,ec.target,Math.max(10,Math.min(52,e.r*.56)),performance.now());
     soloMapNavProxy.x=swimRoute.x;soloMapNavProxy.y=swimRoute.y;
     soloMapNavProxy.moveSpeed=ec.target.moveSpeed||player.moveSpeed;
     movementTargets=soloMapNavTargets;
    }
    if(activeMapLayout&&RIFT_WILDLIFE){
    const home=activeMapLayout.rooms.find(room=>room.id===e.spawnRoomId)||ABYSSAL_MAP.roomAt(activeMapLayout,e.x,e.y);
    const ec=RIFT_WILDLIFE.decide(e,[player],{map:ABYSSAL_MAP,layout:activeMapLayout,room:home,now:performance.now(),seconds:elapsed,family:SPECIMEN_SYSTEM?.familyFor?.(e.specimenSkinId)});
    e.riftWantsAttack=ec.mode==='attack'||(window.AbyssalEnemyAI.isChargeAttack(e)&&e.sharkCharging);
    e.alerted=ec.alert;
    if(!e.riftWantsAttack&&(ec.mode==='patrol'||ec.mode==='alert')&&
       Math.hypot(player.x-e.x,player.y-e.y)<=player.r+e.r+8/GAME_WORLD_ZOOM){
      e.provokedUntil=performance.now()+4800;
      e.riftWantsAttack=true;
    }
    soloEnemyMovementOptions.stopDistance=e.riftWantsAttack?window.AbyssalEnemyAI.tentacleStopDistance(e,e.r,player.r,SPECIMEN_SYSTEM.familyFor(e.specimenSkinId)):4;
    if(!e.riftWantsAttack){soloMapNavProxy.x=ec.target.x;soloMapNavProxy.y=ec.target.y;soloMapNavProxy.moveSpeed=player.moveSpeed;movementTargets=soloMapNavTargets;}
   }
   if(!anglerHidden&&activeMapLayout&&ABYSSAL_MAP&&RIFT_WILDLIFE){
    // Patrols, alerted animals and fleeing wildlife require cave routing too.
    const goal=movementTargets[0];
    if(goal){
     const nav=ABYSSAL_MAP.navigationTarget(activeMapLayout,e.x,e.y,goal.x,goal.y,{padding:Math.max(8,Math.min(38,e.r*.58)),includePortal:false});
     if(nav&&!nav.direct&&Number.isFinite(nav.x)&&Number.isFinite(nav.y)){
      soloMapNavProxy.x=nav.x;soloMapNavProxy.y=nav.y;soloMapNavProxy.skinId=e.riftWantsAttack?equippedSkin:'default';soloMapNavProxy.moveSpeed=goal.moveSpeed||player.moveSpeed;movementTargets=soloMapNavTargets;
     }
    }
   }
   if(!onlineMode&&isClassicShooterRun()&&SOLO_CAVERN&&!anglerHidden&&e.kind!=='whiteShark'&&e.kind!=='whiteSharkBoss'){
    const pad=Math.max(5,e.r*.62),goal=movementTargets[0];
    if(goal){const nav=SOLO_CAVERN.pursuitTarget(arenaRocks,W,H,e,goal,pad,performance.now());
     if(!nav.direct){const waypoint=nav.blocked?SOLO_CAVERN.escapeTarget(arenaRocks,W,H,e.x,e.y,goal.x,goal.y,pad,e.angle)||nav:nav;soloMapNavProxy.x=waypoint.x;soloMapNavProxy.y=waypoint.y;soloMapNavProxy.moveSpeed=player.moveSpeed;soloMapNavProxy.skinId=equippedSkin;movementTargets=soloMapNavTargets;soloEnemyMovementOptions.stopDistance=0;soloEnemyMovementOptions.holdPosition=Boolean(nav.hold);}
    }
    // Non-shark cave fauna follows the path flow. Sharks keep their field-of-view locomotion.
    soloEnemyMovementOptions.freeSwim=!(e.kind==='whiteShark'||e.kind==='whiteSharkBoss');
   }
   if(window.AbyssalEnemyAI.isChargeAttack(e)){
    soloEnemyMovementOptions.sharkPadding=activeMapLayout?Math.max(8,Math.min(38,e.r*.58)):usesNaturalOceanTerrain()?Math.max(8,Math.min(58,e.r*.55)):Math.max(5,e.r*.62);
    soloEnemyMovementOptions.sharkTerrainClear=pveTerrainClear;
    soloEnemyMovementOptions.sharkNavigation=soloSharkNavigation;
    soloEnemyMovementOptions.sharkLineOfSight=pveTerrainClear(e.x,e.y,target.x,target.y,2)&&(activeMapLayout?e.riftWantsAttack:(!e.wildlifeMode||e.openSeaWantsAttack));if(!soloEnemyMovementOptions.freeSwim&&(soloEnemyMovementOptions.sharkLineOfSight||e.sharkCharging||target.submarine||target.specimen))movementTargets=creatureTargets;
    delete soloEnemyMovementOptions.sharkSteeringAngle;if(target.submarine||target.specimen)soloEnemyMovementOptions.sharkSteeringAngle=Math.atan2(movementTargets[0].y-e.y,movementTargets[0].x-e.x);if(!onlineMode&&isClassicShooterRun()&&SOLO_CAVERN&&!e.sharkCharging){const a=Number(e.angle)||0,pad=Math.max(5,e.r*.62),look=Math.max(120/GAME_WORLD_ZOOM,e.r*4);if(SOLO_CAVERN.segmentBlocked(arenaRocks,e.x,e.y,e.x+Math.cos(a)*look,e.y+Math.sin(a)*look,pad)){let best=-Infinity;for(const off of [-.55,.55,-1.05,1.05,-1.57,1.57,Math.PI]){const q=a+off,tx=e.x+Math.cos(q)*look,ty=e.y+Math.sin(q)*look;if(tx<pad||ty<pad||tx>W-pad||ty>H-pad||SOLO_CAVERN.segmentBlocked(arenaRocks,e.x,e.y,tx,ty,pad))continue;const rank=Math.cos(off)*.65+Math.cos(q-Math.atan2(target.y-e.y,target.x-e.x))*.15;if(rank>best){best=rank;soloEnemyMovementOptions.sharkSteeringAngle=q;}}if(!Number.isFinite(soloEnemyMovementOptions.sharkSteeringAngle))soloEnemyMovementOptions.sharkSteeringAngle=a+Math.PI;}}
   }else {delete soloEnemyMovementOptions.sharkLineOfSight;delete soloEnemyMovementOptions.sharkSteeringAngle;}
   if(soloEnemyMovementOptions.holdPosition){e.vx=0;e.vy=0;e.angle=Math.atan2(target.y-e.y,target.x-e.x);}else window.AbyssalEnemyAI.moveTowardTarget(e,movementTargets,dt,soloEnemyMovementOptions,soloEnemyMovementResult);
   if(!activeMapLayout&&usesNaturalOceanTerrain()&&OCEAN_GEOGRAPHY){const sea=OCEAN_GEOGRAPHY.resolveMove(beforeEnemyX,beforeEnemyY,e.x,e.y,Math.max(8,Math.min(58,e.r*.55)));e.x=sea.x;e.y=sea.y;if(sea.blocked){e.vx=(e.x-beforeEnemyX)/Math.max(dt,.001);e.vy=(e.y-beforeEnemyY)/Math.max(dt,.001);if(window.AbyssalEnemyAI.isChargeAttack(e))e.sharkReplan=true;}}
   if(!activeMapLayout&&e.wildlifeMode&&OPEN_SEA_ECOLOGY?.separateContact){
    collectEnemyCandidatesNear(e.x,e.y,180/GAME_WORLD_ZOOM,wildlifeNeighborCandidates);
    const spaced=OPEN_SEA_ECOLOGY.separateContact(e,wildlifeNeighborCandidates,dt);e.x=spaced.x;e.y=spaced.y;
   }
   if(activeMapLayout){const moved=mapResolveMove(beforeEnemyX,beforeEnemyY,e.x,e.y,Math.max(8,Math.min(38,e.r*.58)));e.x=moved.x;e.y=moved.y;if(moved.blocked&&window.AbyssalEnemyAI.isChargeAttack(e)){e.sharkReplan=true;}}
  }else{
   if(enemyParalyzedNow(e)){ /* paralisado */ } else { const nav=activeMapLayout&&ABYSSAL_MAP?ABYSSAL_MAP.navigationTarget(activeMapLayout,e.x,e.y,target.x,target.y,{padding:Math.max(8,Math.min(38,e.r*.58))}):target;const dx=nav.x-e.x,dy=nav.y-e.y,d=Math.hypot(dx,dy)||1;e.phase+=dt*(e.kind==='stinger'?7:3);e.angle=Math.atan2(dy,dx);const moved=mapResolveMove(e.x,e.y,e.x+dx/d*e.speed*dt,e.y+dy/d*e.speed*dt,Math.max(8,Math.min(38,e.r*.58)));e.x=moved.x;e.y=moved.y; }
  }
  if(!onlineMode&&isClassicShooterRun()&&SOLO_CAVERN){const moved=SOLO_CAVERN.resolve(arenaRocks,beforeEnemyX,beforeEnemyY,e.x,e.y,Math.max(5,e.r*.62));e.x=moved.x;e.y=moved.y;if(moved.blocked){e.vx=(e.x-beforeEnemyX)/Math.max(dt,.001);e.vy=(e.y-beforeEnemyY)/Math.max(dt,.001);
   if(e.kind==='whiteShark'||e.kind==='whiteSharkBoss'){
    e.sharkReplan=true;
    if(e.kind==='whiteSharkBoss')e.sharkChargeHit=false;
   }else{
    const pad=Math.max(5,e.r*.62),escape=SOLO_CAVERN.escapeTarget(arenaRocks,W,H,e.x,e.y,target.x,target.y,pad,e.angle);if(escape){e.caveRoute={...escape,direct:false,targetX:target.x,targetY:target.y,until:performance.now()+700};const a=Math.atan2(escape.y-e.y,escape.x-e.x);e.angle=a;e.vx=Math.cos(a)*Math.max(12,Number(e.speed)||20);e.vy=Math.sin(a)*Math.max(12,Number(e.speed)||20);}else{e.caveRoute=null;e.vx=0;e.vy=0;}
   }
  }}
  if(false&&!activeMapLayout&&usesNaturalOceanTerrain()&&OCEAN_GEOGRAPHY&&OCEAN_GEOGRAPHY.isSolid(e.x,e.y,Math.max(8,Math.min(58,e.r*.55)))){
   const corrected=OCEAN_GEOGRAPHY.resolveMove(beforeEnemyX,beforeEnemyY,e.x,e.y,Math.max(8,Math.min(58,e.r*.55)));
   e.x=corrected.x;e.y=corrected.y;
  }
  if(isClassicShooterRun()&&holdSoloHullAttack(e,dt,enemyFrameNow))continue;
  if(!onlineMode&&isClassicShooterRun()&&SOLO_CAVERN&&!window.AbyssalEnemyAI.isChargeAttack(e)&&!enemyParalyzedNow(e)){let sx=0,sy=0,count=0;for(const other of collectEnemyCandidatesNear(e.x,e.y,e.r+270)){if(other===e||other.hp<=0)continue;const dx=e.x-other.x,dy=e.y-other.y,space=(e.r+other.r)*.85,d=Math.hypot(dx,dy);if(d>=space)continue;const a=d>.01?Math.atan2(dy,dx):(Number(e.id)||1)*2.399,force=(space-d)/Math.max(1,space);sx+=Math.cos(a)*force;sy+=Math.sin(a)*force;if(++count>=6)break;}if(count){const step=Math.min(55,Number(e.speed)||55)*dt,moved=SOLO_CAVERN.resolve(arenaRocks,e.x,e.y,clamp(e.x+sx*step,0,W),clamp(e.y+sy*step,0,H),Math.max(5,e.r*.62));e.x=moved.x;e.y=moved.y;}}
  if(isClassicShooterRun())soloHullContact(e,enemyFrameNow);
  const td=Math.hypot(e.x-player.x,e.y-player.y);
  if(Math.hypot(e.x-beforeEnemyX,e.y-beforeEnemyY)>.05)onlineVisualMovingEnemies++;
  e.attackCd=(e.attackCd||0)-dt;const charge=window.AbyssalEnemyAI.isChargeAttack(e),biteReach=window.AbyssalEnemyAI.biteReach(e.r,player.r),biteClear=activeMapLayout?(!ABYSSAL_MAP||ABYSSAL_MAP.segmentWalkable(activeMapLayout,e.x,e.y,player.x,player.y,2)):usesNaturalOceanTerrain()?(!OCEAN_GEOGRAPHY||OCEAN_GEOGRAPHY.segmentClear(e.x,e.y,player.x,player.y,2)):(!SOLO_CAVERN||!isClassicShooterRun()||!SOLO_CAVERN.segmentBlocked(arenaRocks,e.x,e.y,player.x,player.y,2));
  const tentacleAttack=window.AbyssalEnemyAI.tentacleAttacker(e,SPECIMEN_SYSTEM.familyFor(e.specimenSkinId)),tentacleHit=tentacleAttack&&window.AbyssalEnemyAI.tentacleContact(e,player,e.r,SPECIMEN_SYSTEM.familyFor(e.specimenSkinId));
  const attackReach=tentacleAttack?tentacleHit:charge?(e.sharkCharging&&(e.kind==='whiteShark'||!e.sharkChargeHit)&&pointSegmentDistance(player.x,player.y,beforeEnemyX,beforeEnemyY,e.x,e.y)<=e.r+player.r):td<=biteReach;
  if(!enemyParalyzedNow(e)&&biteClear&&(activeMapLayout?e.riftWantsAttack:(!e.wildlifeMode||e.openSeaWantsAttack))&&target.local&&attackReach){if(e.attackCd<=0){const cp=tentacleAttack?{skillId:'tentacle-strike',power:e.kind==='kraken'&&e.krakenSweepActive?1.25:1,cooldown:.95,neuro:0}:{drifter:{skillId:'bio-shock',power:1.08,cooldown:.95,neuro:100},stinger:{skillId:'venom-spine',power:1.16,cooldown:.64,neuro:100},brute:{skillId:'crusher-claw',power:1.28,cooldown:1.05,neuro:0},lurker:{skillId:'gulper-bite',power:1.22,cooldown:.84,neuro:0}}[e.kind];if(player.invuln<=0){if(charge)e.sharkChargeHit=true;hurtPlayer(e.damage*(cp?.power||(e.kind==='kraken'&&e.krakenSweepActive?1.25:e.kind==='whiteSharkBoss'?1.15:e.kind==='devourer'&&e.suctionActive?1.2:1)));if(cp?.neuro)player.neurotoxinUntil=performance.now()+cp.neuro;}renderHostileContactAbility({kind:e.kind,enemyId:e.id,enemy:e,skillId:cp?.skillId,x:e.x,y:e.y,enemyRadius:e.r,angle:e.angle,color:e.color,playerX:player.x,playerY:player.y});e.attackCd=e.kind==='kraken'?.95:(cp?.cooldown||1.1);}}
 }
 // Predation decisions are sampled at 10 Hz; locomotion and visuals remain per-frame.
 if(!onlineMode&&isOpenSeaRun()&&OPEN_SEA_ECOLOGY?.simulatePredation){
  player.openSeaPredationAccumulator=(Number(player.openSeaPredationAccumulator)||0)+dt;
  if(player.openSeaPredationAccumulator>=.1){const predationStep=player.openSeaPredationAccumulator;player.openSeaPredationAccumulator=0;const clashes=OPEN_SEA_ECOLOGY.simulatePredation(enemies,predationStep,performance.now());if(clashes.length){const dead=new Set(clashes.filter(c=>c.killed).map(c=>String(c.preyId)));if(dead.size){const now=Date.now();for(const prey of enemies)if(prey.streamId&&dead.has(String(prey.id)))soloOceanRespawn?.mark(prey.streamId,now);enemies=enemies.filter(e=>!dead.has(String(e.id)));}}}
 }else if(player)player.openSeaPredationAccumulator=0;
 // Contact applies to companion independently of the diver's hurtbox.
 if(!onlineMode)updateSoloSpecimenContact();
 // Uniform-grid broad phase: build once after movement; each projectile checks only its cell and neighbors.
 rebuildEnemyCollisionGrid();
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i],prevX=p.x,prevY=p.y,stepX=p.vx*dt,stepY=p.vy*dt,stepDistance=Math.hypot(stepX,stepY),remaining=Math.max(0,(Number(p.maxDistance)||Infinity)-(Number(p.travelled)||0)),travel=Math.min(stepDistance,remaining),travelRatio=stepDistance>0?travel/stepDistance:0;p.x+=stepX*travelRatio;p.y+=stepY*travelRatio;p.travelled=(Number(p.travelled)||0)+travel;p.life-=dt;let hit=false;const reachedRange=travel+0.001<stepDistance||(Number.isFinite(p.maxDistance)&&p.travelled>=p.maxDistance);
 if(onlineRoomMode==='pvp'&&projectileHitsPvpWall(prevX,prevY,p.x,p.y,p.r||0)){spawnProjectileDissolve(p.x,p.y,p.color,p.special,true);playWorldSound('wall-hit',p,550,.52);projectiles.splice(i,1);continue;}if(onlineRoomMode!=='pvp'&&((activeMapLayout&&ABYSSAL_MAP&&!ABYSSAL_MAP.segmentWalkable(activeMapLayout,prevX,prevY,p.x,p.y,Math.max(2,p.r||0)))||(!activeMapLayout&&usesNaturalOceanTerrain()&&OCEAN_GEOGRAPHY&&!OCEAN_GEOGRAPHY.segmentClear(prevX,prevY,p.x,p.y,Math.max(2,p.r||0)))||(isClassicCavernRun()&&SOLO_CAVERN?.segmentBlocked(arenaRocks,prevX,prevY,p.x,p.y,p.r||0,true)))){spawnProjectileDissolve(p.x,p.y,p.color,p.special,true);playWorldSound('wall-hit',p,550,.52);projectiles.splice(i,1);continue;}
 projectileCandidates.length=0;const cellX=Math.floor(p.x/enemyCollisionCellSize),cellY=Math.floor(p.y/enemyCollisionCellSize);for(let gx=cellX-1;gx<=cellX+1;gx++)for(let gy=cellY-1;gy<=cellY+1;gy++){const bucket=enemyCollisionGrid.get(gy*65536+gx);if(bucket)for(const enemy of bucket)projectileCandidates.push(enemy);}for(let j=projectileCandidates.length-1;j>=0;j--){const e=projectileCandidates[j];p.hitIds ||= [];if(e.hp>0&&!p.hitIds.includes(e.id)&&(pointSegmentDistance(e.x,e.y,prevX,prevY,p.x,p.y)<p.r+e.r||(p.barrelOrigin&&p.travelled<=stepDistance+.001&&e.id===p.barrelOrigin.targetId&&pointSegmentDistance(e.x,e.y,p.barrelOrigin.x,p.barrelOrigin.y,prevX,prevY)<p.r+e.r&&(!activeMapLayout||!ABYSSAL_MAP||ABYSSAL_MAP.segmentWalkable(activeMapLayout,p.barrelOrigin.x,p.barrelOrigin.y,prevX,prevY,p.r))&&(!usesNaturalOceanTerrain()||!OCEAN_GEOGRAPHY||OCEAN_GEOGRAPHY.segmentClear(p.barrelOrigin.x,p.barrelOrigin.y,prevX,prevY,p.r))&&(!isClassicCavernRun()||!SOLO_CAVERN?.segmentBlocked(arenaRocks,p.barrelOrigin.x,p.barrelOrigin.y,prevX,prevY,p.r,true))))){p.hitIds.push(e.id);dealEnemyDamage(e,p.damage,p.special||(upgradeLevels.power>0?'power':null),{origin:{x:prevX,y:prevY},submarineShot:Boolean(p.submarineShot),projectile:true});e.hit=.12;burst(p.x,p.y,p.color,4,40);if(p.special)playWorldSound('enemy-hit',e,520,.34);
 if((p.pierceRemaining||0)>0){p.pierceRemaining--; }else{hit=true;break}}}if(hit||p.life<=0||reachedRange||p.x< -100/worldZoom||p.x>W+100/worldZoom||p.y< -100/worldZoom||p.y>H+100/worldZoom){if(hit||reachedRange)spawnProjectileDissolve(p.x,p.y,p.color,p.special,false);projectiles.splice(i,1)}}
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
 for(let i=effects.length-1;i>=0;i--){const fx=effects[i];fx.life-=dt;if(fx.life<=0){effects[i]=effects[effects.length-1];effects.pop();recycleEffect(fx);}}
 for(let i=damageNumbers.length-1;i>=0;i--){damageNumbers[i].life-=dt;if(damageNumbers[i].life<=0)damageNumbers.splice(i,1);}for(let i=bloodPools.length-1;i>=0;i--){bloodPools[i].life-=dt;if(bloodPools[i].life<=0)bloodPools.splice(i,1);}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.05,dt);p.vy*=Math.pow(.05,dt);p.life-=dt;if(p.life<=0){particles[i]=particles[particles.length-1];particles.pop();if(particlePool.length<700)particlePool.push(p)}}
 if(particles.length>particleBudget()){const excess=particles.length-particleBudget();for(let i=0;i<excess;i++){if(particlePool.length<700)particlePool.push(particles[i]);}particles.splice(0,excess);}if(projectiles.length>projectileBudget())projectiles.splice(0,projectiles.length-projectileBudget());if(effects.length>effectBudget()){let excess=effects.length-effectBudget();for(let i=0;i<effects.length&&excess>0;){const fx=effects[i];if(fx.type==='photon-ray'||fx.type==='gravity-cone'){i++;continue;}effects[i]=effects[effects.length-1];effects.pop();recycleEffect(fx);excess--;}}
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
 // Q and E are fixed research slots, automatically equipped when studied.
 return ['pulse','dash'].filter(id=>Number(metaUpgrades?.[id])>0);
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
function buyMetaUpgrade(id){showToast('HABILIDADES AGORA SÃO ESTUDADAS NO SUBMARINO');return;
 const item=metaShopItems.find(x=>x.id===id);if(!item)return;
 const current=Number(metaUpgrades[id])||0;if(current>=item.max){showToast('MELHORIA JÁ NO NÍVEL MÁXIMO');return;}
 if(window.AbyssalOnline?.isAuthenticated()){
  window.AbyssalOnline.purchaseMeta(id);return;
 }
 if((energyWallet?.get().energy||0)<item.price){showToast('ENERGIA INSUFICIENTE');return;}
 energyWallet?.debit(item.price);metaUpgrades[id]=current+1;saveCosmetics();renderShop();showToast(`${item.name.toUpperCase()} DESBLOQUEADO`);playSkillSound(id,'learn');playWorldSound('ui-purchase');
}
function activateAbility(id){
 if(soloSubmarine.repair)cancelSoloHullRepair();
 if(!player||gameState!=='playing')return;
 if(id==='pulse'){
  if(!(Number(metaUpgrades.pulse)>0)){showToast('ESTUDE PULSO DE MARÉ NO SUBMARINO');return;}if(!loadEquippedActiveSkills().includes('pulse')){showToast('EQUIPE PULSO DE MARÉ NA LOJA');return;}
  if(player.pulseCooldown>0)return;
  player.pulseCooldown=14;const pulseCastId=(Number(player.pulseCastId)||0)+1;player.pulseCastId=pulseCastId;const pulseCaster=player;const radius=245*upgrades.range/GAME_WORLD_ZOOM;
  // Online damage is server-authoritative so Q cannot silently fail or disagree between clients.
  if(onlineMode){const sent=window.AbyssalOnline?.sendActiveAbility?.('pulse',result=>{if(result?.ok!==false||player!==pulseCaster||pulseCaster.pulseCastId!==pulseCastId)return;pulseCaster.pulseCooldown=0;for(let i=effects.length-1;i>=0;i--)if(effects[i].pulseCastId===pulseCastId)effects.splice(i,1);updateAbilityButtons(true);});if(!sent){pulseCaster.pulseCooldown=0;updateAbilityButtons(true);return;}}
  else for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<radius+e.r)dealEnemyDamage(e,28*upgrades.power,'pulse',{silentSound:true,visual:true});}
  if(onlineRoomMode==='pvp')queueEffect({type:'occluded-ring',x:player.x,y:player.y,r:0,max:radius,life:.7,maxLife:.7,color:'#78f8f3',pulseCastId});
  else queueEffect({type:'ring',x:player.x,y:player.y,r:0,max:radius,life:.7,maxLife:.7,color:'#78f8f3',pulseCastId});
  burst(player.x,player.y,'#9ffff8',lowPowerRendering?12:22,210);playSkillSound('pulse','trigger');playWorldSound('ability-nova',player,880,.64);
 }else if(id==='dash'){
  if(!(Number(metaUpgrades.dash)>0)){showToast('ESTUDE PASSO FANTASMA NO SUBMARINO');return;}if(!loadEquippedActiveSkills().includes('dash')){showToast('EQUIPE PASSO FANTASMA NA LOJA');return;}
  if(player.dashCooldown>0)return;
  player.dashCooldown=18;
  player.dashTime=1.5;
  player.invuln=Math.max(player.invuln,1.5);
  player.ghostDashUntil=performance.now()+1500;
  if(onlineMode)window.AbyssalOnline?.sendProtection?.(1.5,'dash');
  burst(player.x,player.y,'#d8c9ff',lowPowerRendering?8:14,130);
  playSkillSound('dash','trigger');playWorldSound('ability-dash',player,750,.60);
 }
 updateAbilityButtons();
}
function updateAbilityButtons(force=false){
 const now=performance.now();
 // Cooldown labels only change to tenths of a second; updating the DOM 10x/second is enough.
 if(!force&&now-lastAbilityUiAt<100)return;
 lastAbilityUiAt=now;
 const pulse=$('skillPulseBtn'),dash=$('skillDashBtn'),skinBtn=$('skinActiveBtn'),equipped=loadEquippedActiveSkills();
 if(pulse){const hidden=!(Number(metaUpgrades.pulse)>0&&equipped.includes('pulse')),disabled=!player||player.pulseCooldown>0;if(pulse.hidden!==hidden)pulse.hidden=hidden;if(pulse.disabled!==disabled)pulse.disabled=disabled;const label=player&&player.pulseCooldown>0?`PULSO ${player.pulseCooldown.toFixed(1)}s`:(mobileViewport?'✦ PULSO DE MARÉ':'Q · PULSO DE MARÉ');if(pulse.textContent!==label)pulse.textContent=label;}
 if(dash){const hidden=!(Number(metaUpgrades.dash)>0&&equipped.includes('dash')),disabled=!player||player.dashCooldown>0;if(dash.hidden!==hidden)dash.hidden=hidden;if(dash.disabled!==disabled)dash.disabled=disabled;const label=player&&player.dashCooldown>0?`PASSO ${player.dashCooldown.toFixed(1)}s`:(mobileViewport?'✧ PASSO FANTASMA':'E · PASSO FANTASMA');if(dash.textContent!==label)dash.textContent=label;}
 if(skinBtn){const spec=currentSkinActiveSpec(),trailing=Boolean(player&&Number(player.skinTrailUntil)>performance.now()),infused=Boolean(player&&Number(player.skinWeaponBuffUntil)>performance.now()),disabled=!player||(isRiftRun()||onlineRoomMode==='pvp')&&!spec||!specimenAlive()||player.skinActiveCooldown>0||trailing||infused;skinBtn.hidden=!player;skinBtn.disabled=disabled;const label=player&&!specimenAlive()?(mobileViewport?`ESPÉCIME · ${Number(player?.specimen?.respawnTimer||0).toFixed(1)}s`:`R · ESPÉCIME ABATIDO · ${Number(player?.specimen?.respawnTimer||0).toFixed(1)}s`):infused?(mobileViewport?`ARMA ${player.skinWeaponBuffKind==='paralysis'?'ELÉTRICA':'VENENOSA'} · ${((player.skinWeaponBuffUntil-performance.now())/1000).toFixed(1)}s`:`R · ARMA ${player.skinWeaponBuffKind==='paralysis'?'ELÉTRICA':'VENENOSA'} · ${((player.skinWeaponBuffUntil-performance.now())/1000).toFixed(1)}s`):trailing?(mobileViewport?`RASTRO ATIVO · ${((player.skinTrailUntil-performance.now())/1000).toFixed(1)}s`:`R · RASTRO ATIVO · ${((player.skinTrailUntil-performance.now())/1000).toFixed(1)}s`):player&&player.skinActiveCooldown>0?(mobileViewport?`${spec?.name||'HABILIDADE'} · ${player.skinActiveCooldown.toFixed(1)}s`:`R · ${spec?.name||'HABILIDADE DO ESPÉCIME'} · ${player.skinActiveCooldown.toFixed(1)}s`):(mobileViewport?`✦ ${spec?.name||'HABILIDADE'}`:`R · ${spec?.name||'HABILIDADE DO ESPÉCIME'}`);const displayLabel=isOpenSeaRun()?(player?.skinActiveCooldown>0?'SONAR · '+player.skinActiveCooldown.toFixed(1)+'s':(mobileViewport?'R · SONAR':'R · SONAR DO ESPÉCIME')):label;if(skinBtn.textContent!==displayLabel)skinBtn.textContent=displayLabel;skinBtn.style.borderColor=spec?.color||'';}
}
function setTextIfChanged(id,value){const node=$(id),text=String(value);if(node&&node.textContent!==text)node.textContent=text;}
function setWidthIfChanged(id,value){const node=$(id),width=String(value);if(node&&node.style.width!==width)node.style.width=width;}
function updateHud(force=true){
 const now=performance.now();if(!force&&now-lastHudUpdateAt<100)return;lastHudUpdateAt=now;
 setTextIfChanged('timeText',fmtTime(elapsed));const levelDisplay = areAllUpgradesMaxed() || level === 'MAX' ? 'Nível MAX' : String(level).padStart(2,'0');
 setTextIfChanged('levelText', levelDisplay);setTextIfChanged('bossKillsText',String(bossKillsThisRun).padStart(2,'0'));setTextIfChanged('scoreText',score.toLocaleString('pt-BR'));setTextIfChanged('hpText',`${Math.ceil(Math.max(0,hp))} / ${maxHp}`);setWidthIfChanged('hpFill',`${clamp(hp/maxHp*100,0,100)}%`);setTextIfChanged('xpText',`${Math.floor(xp)} / ${xpNeed}`);setWidthIfChanged('xpFill',`${clamp(xp/xpNeed*100,0,100)}%`);renderSelectedSkills();if(isClassicCavernRun()){setTextIfChanged('soloEnergyBalance',String(window.AbyssalSoloProgress?.get().energy||0));setTextIfChanged('soloSubmarineStatus',soloSubmarine.powerSeconds>0?(Math.ceil(soloSubmarine.powerSeconds/60)+' MIN · '+(onlineMode?onlineSubmarineWeapons.length:(window.AbyssalSoloBase?.installedWeapons?.().length||0))+' ARMA(S)'):'SEM ENERGIA');}
}
let lastRunEnergyRankingSignature='';
window.addEventListener('abyssal-run-energy-ranking',ev=>{
 const root=$('runEnergyRankingList');if(!root)return;
 const ranking=Array.isArray(ev.detail)?ev.detail:[];
 const signature=ranking.map((item,index)=>[(Number(item.rank)||index+1),String(item.nickname||''),Math.floor(Number(item.energy)||0)].join(':')).join('|');
 if(signature===lastRunEnergyRankingSignature)return;
 lastRunEnergyRankingSignature=signature;
 root.innerHTML=ranking.length?ranking.map((item,index)=>'<div class="run-energy-row"><span class="energy-name">'+(Number(item.rank)||index+1)+'. '+escapeHtml(item.nickname||'Mergulhador')+'</span><span class="energy-value">'+Math.floor(Number(item.energy)||0).toLocaleString('pt-BR')+'</span></div>').join(''):'<span>Sem dados ainda</span>';
});
function renderRunEndPresentation(){
 const extracted=Boolean(expeditionMode&&expeditionExtracted),voluntary=diveEndReason==='voluntary',eyebrow=$('gameOverEyebrow'),title=$('gameOverTitle'),copy=$('gameOverCopy'),revive=$('reviveWithAdBtn'),again=$('againBtn'),menu=$('menuBtn');
 if(extracted||voluntary){
  if(eyebrow){eyebrow.classList.remove('danger-eyebrow');eyebrow.innerHTML='<span class="pulse-dot"></span> SINAL RECUPERADO';}
  if(title)title.innerHTML='MERGULHO<br><em>CONCLUÍDO.</em>';
  if(copy)copy.textContent='Seu relatório de expedição está pronto. Confira o que você conquistou nas profundezas.';
  if(revive)revive.hidden=true;
  if(again)again.textContent='DESCER NOVAMENTE';
  if(menu)menu.textContent='VOLTAR À SUPERFÍCIE';
 }else{
  if(eyebrow){eyebrow.classList.add('danger-eyebrow');eyebrow.innerHTML='<span class="pulse-dot"></span> SINAL PERDIDO';}
  if(title)title.innerHTML='FIM DO<br><em>MERGULHO.</em>';
  if(copy)copy.textContent='Sua vida acabou nas profundezas. Se você optar por assistir ao anúncio premiado até a conclusão, receberá 1 reviver e continuará este mergulho com a vida restaurada. Você também pode recusar e encerrar o mergulho normalmente.';
  if(revive)revive.hidden=false;
  if(again)again.textContent='ENCERRAR E MERGULHAR NOVAMENTE';
  if(menu)menu.textContent='ENCERRAR MERGULHO E VOLTAR AO MENU';
 }
}
function endGame(reason='death'){
 cancelSoloHullRepair();
 if(gameState==='over'||gameState==='menu')return;
 diveEndReason=expeditionExtracted?'extracted':reason;
 wasOnlineModeOnDeath=Boolean(onlineMode);
 const authenticated=Boolean(window.AbyssalOnline?.isAuthenticated?.());
 runResultPending=true;
 diveReport={reason:diveEndReason,survival:elapsed,damageDealt:onlineMode?null:diveStats.damageDealt,monstersKilled:onlineMode?null:diveStats.monstersKilled,energyCollected:onlineMode?null:diveStats.energyCollected,...diveEnergyCalculation(),level};
 renderDiveReport(diveReport,true);
 const endBtn=document.getElementById('endDiveBtn');if(endBtn)endBtn.style.display='none';
 renderRunEndPresentation();
 gameState='over';document.body.classList.remove('game-active');$('hud').hidden=true;$('pauseBtn').hidden=true;$('toggleHudBtn').hidden=true;setHudCollapsed(false);const mobileStick=$('mobileJoystick');if(mobileStick)mobileStick.hidden=true;$('gameOverScreen').hidden=false;const reviveButton=$('reviveWithAdBtn');if(reviveButton)reviveButton.disabled=false;setReviveMessage('');
 renderDiveReport(diveReport,authenticated);
 if(score>bestScore){bestScore=score;localStorage.setItem('abyssalBestScore',String(score));const el=$('bestScore');if(el)el.textContent=bestScore.toLocaleString('pt-BR')}
 if(elapsed>bestTime){bestTime=elapsed;localStorage.setItem('abyssalBestTime',String(elapsed));const el=$('bestTime');if(el)el.textContent=fmtTime(bestTime)}
 $('saveStatus').textContent=expeditionMode?(expeditionExtracted?'EXTRAÇÃO CONCLUÍDA · RECOMPENSA GARANTIDA':'EXPEDIÇÃO ENCERRADA · SEM PENALIDADE DE SAQUE'):(runResultPending?'RESULTADO AGUARDANDO SUA ESCOLHA':'SINAL DE SOBREVIVÊNCIA REGISTRADO');if(player)burst(player.x,player.y,expeditionExtracted?'#72f5df':'#ff7796',35,210);audio(expeditionExtracted?320:95,.5,'sawtooth',.04);if(diveEndReason!=='death')settleDiveReport();else if(onlineMode){const current=diveReport;window.AbyssalOnline?.previewRunReport?.(result=>{if(gameState!=='over'||diveReport!==current||diveSettling||diveSettled)return;diveReport={...diveReport,...result,survival:current.survival};renderDiveReport(diveReport,true);});}
}
function pauseGame(){if(onlineMode){showToast('A partida cooperativa não pode ser pausada.');return}if(gameState!=='playing')return;gameState='paused';$('pauseScreen').hidden=false;$('pauseBtn').hidden=true}
document.getElementById('mobilePauseBtn')?.addEventListener('click',pauseGame);
function resumeGame(){if(gameState!=='paused')return;gameState='playing';$('pauseScreen').hidden=true;$('pauseBtn').hidden=false;last=performance.now()}
function drawEliteMarker(enemy,t){
 const elite=EXPEDITION_RULES?.eliteConfig?.(enemy?.eliteId);if(!elite||!enemy)return;
 const pulse=.84+.16*Math.sin(t*.004+(Number(enemy.id)||0));
 ctx.save();ctx.globalAlpha=lowPowerRendering?.48:.72;ctx.strokeStyle=elite.accent;ctx.lineWidth=Math.max(1.2/GAME_WORLD_ZOOM,enemy.r*.08);
 if(!lowPowerRendering)ctx.shadowBlur=10/GAME_WORLD_ZOOM;ctx.shadowColor=elite.accent;
 ctx.beginPath();ctx.arc(enemy.x,enemy.y,enemy.r*(1.42+.08*pulse),0,Math.PI*2);ctx.stroke();
 ctx.globalAlpha=lowPowerRendering?.56:.88;ctx.fillStyle=elite.accent;const markR=Math.max(2.2/GAME_WORLD_ZOOM,enemy.r*.16),markY=enemy.y-enemy.r*1.62;
 ctx.beginPath();ctx.moveTo(enemy.x,markY-markR);ctx.lineTo(enemy.x+markR,markY);ctx.lineTo(enemy.x,markY+markR);ctx.lineTo(enemy.x-markR,markY);ctx.closePath();ctx.fill();ctx.restore();
}
function drawCaveGlyph(x,y,type,t,scale=1){
 ctx.save();ctx.translate(x,y);const pulse=.9+.1*Math.sin(t*.003+x*.01+y*.01);
 if(type==='common'||type==='event'){
  const color=type==='event'?'#be86ff':'#ff9c4a';ctx.globalAlpha=type==='event'?.48:.38;ctx.strokeStyle=color;ctx.lineWidth=2.2/GAME_WORLD_ZOOM;ctx.shadowBlur=lowPowerRendering?0:10;ctx.shadowColor=color;
  const r=(type==='event'?16:13)/GAME_WORLD_ZOOM*scale*pulse;ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.28,-r*.28);ctx.lineTo(r,0);ctx.lineTo(r*.28,r*.28);ctx.lineTo(0,r);ctx.lineTo(-r*.28,r*.28);ctx.lineTo(-r,0);ctx.lineTo(-r*.28,-r*.28);ctx.closePath();ctx.stroke();
 }else if(type==='elite'){
  ctx.globalAlpha=.58;ctx.strokeStyle='#ff496d';ctx.lineWidth=2.4/GAME_WORLD_ZOOM;ctx.shadowBlur=lowPowerRendering?0:12;ctx.shadowColor='#ff315f';const r=18/GAME_WORLD_ZOOM*scale*pulse;ctx.beginPath();for(let i=0;i<12;i++){const a=-Math.PI/2+i*Math.PI/6,rr=i%2===0?r:r*.52;const px=Math.cos(a)*rr,py=Math.sin(a)*rr;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.stroke();
 }else if(type==='boss'){
  ctx.globalAlpha=.62;ctx.strokeStyle='#ff315f';ctx.fillStyle='rgba(255,49,95,.08)';ctx.lineWidth=2.8/GAME_WORLD_ZOOM;ctx.shadowBlur=lowPowerRendering?0:14;ctx.shadowColor='#ff315f';const r=34/GAME_WORLD_ZOOM*scale;ctx.beginPath();ctx.arc(0,-5/GAME_WORLD_ZOOM,r*.55,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-r*.75,r*.55);ctx.lineTo(r*.75,-r*.15);ctx.moveTo(-r*.75,-r*.15);ctx.lineTo(r*.75,r*.55);ctx.stroke();ctx.fillStyle='#ff5677';ctx.beginPath();ctx.arc(-r*.2,-r*.12,r*.08,0,Math.PI*2);ctx.arc(r*.2,-r*.12,r*.08,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
function drawCaveBranchSignal(corridor,t){
 if(!corridor?.optional)return;
 const targetId=String(corridor.b||''),isElite=targetId==='elite',encounter=!isElite?EXPEDITION_RULES?.sideEncounterFor?.(activeMapSeed,activeMapTier):null;
 const x=corridor.x1+(corridor.x2-corridor.x1)*.42,y=corridor.y1+(corridor.y2-corridor.y1)*.42;
 const color=isElite?'#ff5b78':'#b98aff',title=isElite?'DESVIO ELITE':'ECO LATERAL';
 const detail=isElite?'RISCO MÁXIMO · CACHE DE ELITE':`${encounter?.risk||'INCERTO'} · ${encounter?.reward||'RECOMPENSA DESCONHECIDA'}`;
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=.72+.10*Math.sin(t*.003+x*.002);ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillStyle='rgba(1,5,11,.78)';ctx.strokeStyle=color;ctx.lineWidth=1.5/GAME_WORLD_ZOOM;const w=210/GAME_WORLD_ZOOM,h=48/GAME_WORLD_ZOOM;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,9/GAME_WORLD_ZOOM);ctx.fill();ctx.stroke();
 ctx.fillStyle=color;ctx.font=`800 ${12/GAME_WORLD_ZOOM}px Manrope, sans-serif`;ctx.fillText(title,0,-7/GAME_WORLD_ZOOM);
 ctx.fillStyle='#d8eef1';ctx.font=`700 ${9/GAME_WORLD_ZOOM}px Manrope, sans-serif`;ctx.fillText(detail,0,9/GAME_WORLD_ZOOM);ctx.restore();
}
function drawCaveRoomSignal(room,t){
 if(!room||!['elite','event','boss'].includes(room.type))return;
 let color='#a98cff',title=String(room.signal||'ECO ABISSAL'),detail=String(room.reward||'RECOMPENSA');
 if(room.type==='elite'){color='#ff5b78';detail='RISCO '+String(room.risk||5)+' · '+String(room.reward||'CACHE DE ELITE');}
 else if(room.type==='event'){const encounter=EXPEDITION_RULES?.sideEncounterFor?.(activeMapSeed,activeMapTier);color=encounter?.accent||'#b98aff';detail=String(encounter?.risk||'INCERTO')+' · '+String(encounter?.reward||room.reward||'ANOMALIA');}
 else {color='#ff315f';detail=cavePortalsUnlocked()?'VÓRTICES LIBERADOS · SUPERFÍCIE OU DESCIDA':'BOSS · BLOQUEIA A DESCIDA';}
 ctx.save();ctx.globalAlpha=.65+.08*Math.sin(t*.0025+room.x*.001);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.font=`800 ${11/GAME_WORLD_ZOOM}px Manrope, sans-serif`;ctx.fillText(title,room.x,room.y-room.ry*.62);ctx.fillStyle='#d7edf0';ctx.font=`700 ${9/GAME_WORLD_ZOOM}px Manrope, sans-serif`;ctx.fillText(detail,room.x,room.y-room.ry*.62+17/GAME_WORLD_ZOOM);ctx.restore();
}
const portalRevealTimes=new WeakMap();
function drawMapPortal(portal,t){
 if(!portal)return;
 if(!portalRevealTimes.has(portal))portalRevealTimes.set(portal,t);
 const reveal=Math.min(1,Math.max(0,(t-portalRevealTimes.get(portal))/2400)),opacity=reveal*reveal*(3-2*reveal);
 const descending=portal.type==='tier-descent'||portal.type==='descent';
 const r=portal.r,spin=(descending?1:-1)*t*.00024;
 ctx.save();ctx.globalAlpha=opacity;ctx.translate(portal.x,portal.y);
 ctx.save();ctx.scale(1,.72);
 // Broken basalt shelves surround a deep water funnel, including the entrance.
 for(let i=0;i<19;i++){
  const a=i*Math.PI*2/19,rr=r*(1.03+.08*Math.sin(i*9.7));
  const rock=ctx.createLinearGradient(Math.cos(a)*rr,Math.sin(a)*rr-r*.2,Math.cos(a)*rr,Math.sin(a)*rr+r*.2);
  rock.addColorStop(0,'#284957');rock.addColorStop(.45,'#102c3a');rock.addColorStop(1,'#030a13');ctx.fillStyle=rock;ctx.strokeStyle='#355665';ctx.lineWidth=1/GAME_WORLD_ZOOM;
  ctx.beginPath();for(let j=0;j<6;j++){const b=j*Math.PI/3,rad=r*(.16+.065*Math.sin(i*3+j));const x=Math.cos(a)*rr+Math.cos(b)*rad,y=Math.sin(a)*rr+Math.sin(b)*rad;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();
 }
 const water=ctx.createRadialGradient(-r*.08,r*.12,r*.02,0,0,r);
 water.addColorStop(0,'#000108');water.addColorStop(.36,'#010713');water.addColorStop(.65,'#062437');water.addColorStop(.85,'#10617a');water.addColorStop(.95,'#288aa0');water.addColorStop(1,'#102d3c');
 ctx.fillStyle=water;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
 // Ribbons narrow and darken as they bend into the shaft. No flat neon discs.
 for(let arm=0;arm<7;arm++)for(let section=0;section<3;section++){
  ctx.globalAlpha=opacity*[.1,.24,.5][section];ctx.strokeStyle=arm%3?'#69cfdf':'#597fd2';ctx.lineWidth=(1.1+section*.6)/GAME_WORLD_ZOOM;ctx.beginPath();
  for(let i=0;i<=24;i++){const q=(section+i/24)/3,rr=r*(.075+q*.91),a=arm*Math.PI*2/7+spin+(1-q)*5.2+Math.sin(q*13+arm)*.05;const x=Math.cos(a)*rr,y=Math.sin(a)*rr+((1-q)*r*.12);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
 }
 ctx.strokeStyle='#b3e5e8';ctx.lineWidth=1/GAME_WORLD_ZOOM;
 for(let i=0;i<24;i++){const q=(t*.0001+i/24)%1,depth=descending?1-q:q,rr=r*(.07+depth*.86),a=i*2.399+spin+q*7;ctx.globalAlpha=opacity*Math.sin(q*Math.PI)*.65;ctx.beginPath();ctx.arc(Math.cos(a)*rr,Math.sin(a)*rr,Math.max(.6,r*.019*depth),0,Math.PI*2);ctx.stroke();}
 ctx.globalAlpha=opacity;ctx.restore();
 if(portal.type==='tier-descent'||portal.type==='surface'){
  const label=portal.type==='surface'?'VOLTAR À SUPERFÍCIE':'DESCER MAIS FUNDO';
  const subtitle=portal.type==='surface'?'EXTRAIR RECOMPENSAS':'PRÓXIMA CAMADA';
  const labelY=r*.82+16/GAME_WORLD_ZOOM;
  ctx.save();ctx.globalAlpha=opacity;ctx.shadowBlur=12/GAME_WORLD_ZOOM;
  ctx.shadowColor=portal.type==='surface'?'#64d8ff':'#41b4ff';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`900 ${15/GAME_WORLD_ZOOM}px Manrope, sans-serif`;
  ctx.lineWidth=3/GAME_WORLD_ZOOM;ctx.strokeStyle='rgba(0,3,12,.97)';
  ctx.strokeText(label,0,labelY);ctx.fillStyle=portal.type==='surface'?'#a5e8ff':'#a4dfff';
  ctx.fillText(label,0,labelY);
  ctx.shadowBlur=0;ctx.font=`700 ${10/GAME_WORLD_ZOOM}px Manrope, sans-serif`;
  ctx.fillStyle='#e8f8ff';ctx.fillText(subtitle,0,labelY+19/GAME_WORLD_ZOOM);
  ctx.restore();
 }
 ctx.restore();
}
function drawAbyssalCaveMap(t){
 const layout=activeMapLayout;if(!layout||onlineRoomMode==='pvp')return false;
 const caveCleared=cavePortalsUnlocked();
 if(window.AbyssalTerrain){
  window.AbyssalTerrain.draw(ctx,layout,cameraX,cameraY,viewW/worldZoom,viewH/worldZoom,t);
  window.AbyssalTreasure?.update(ctx,activeMapTier,caveCleared,layout.rooms.find(r=>r.id==='boss'),player,t);
  drawMapPortal(layout.portals.start,t);if(caveCleared){drawMapPortal(layout.portals.surface,t);drawMapPortal(layout.portals.boss,t);}
  return true;
 }
 ctx.fillStyle='#01040a';ctx.fillRect(0,0,W,H);
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 for(const corridor of layout.corridors){
  const visible=corridor.x2>=cameraX-500&&corridor.x1<=cameraX+viewW/worldZoom+500&&Math.max(corridor.y1,corridor.y2)>=cameraY-500&&Math.min(corridor.y1,corridor.y2)<=cameraY+viewH/worldZoom+500;
  if(!visible)continue;
  const path=corridor.path||[{x:corridor.x1,y:corridor.y1},{x:corridor.x2,y:corridor.y2}];
  ctx.strokeStyle='rgba(0,1,4,.96)';ctx.lineWidth=corridor.width*2.28;ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  ctx.strokeStyle=corridor.optional?'rgba(23,22,35,.96)':'rgba(8,25,34,.98)';ctx.lineWidth=corridor.width*1.62;ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  ctx.strokeStyle=corridor.optional?'rgba(163,92,180,.12)':'rgba(91,194,199,.09)';ctx.lineWidth=Math.max(2,corridor.width*.055);ctx.stroke();if(corridor.optional)drawCaveBranchSignal(corridor,t);
 }
 for(const room of layout.rooms){
  if(room.x+room.rx<cameraX-350||room.x-room.rx>cameraX+viewW/worldZoom+350||room.y+room.ry<cameraY-350||room.y-room.ry>cameraY+viewH/worldZoom+350)continue;
  const palette=room.type==='boss'?['#020106','#260813','#ff315f']:room.type==='elite'?['#030207','#1b0b17','#ff496d']:room.type==='hub'?['#02070b','#09232a','#63e9de']:room.type==='landing'?['#01050a','#071927','#4cb9ff']:room.type==='start'?['#020806','#0b241f','#5cff82']:room.type==='event'?['#03020a','#15112a','#ad7cff']:['#020609','#09202a','#58c6c8'];
  ctx.fillStyle=palette[0];ctx.strokeStyle='rgba(3,5,9,.98)';ctx.lineWidth=46/GAME_WORLD_ZOOM;ctx.beginPath();ctx.ellipse(room.x,room.y,room.rx+20,room.ry+20,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=palette[1];ctx.strokeStyle=palette[2]+'33';ctx.lineWidth=7/GAME_WORLD_ZOOM;ctx.beginPath();ctx.ellipse(room.x,room.y,room.rx*.92,room.ry*.91,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  // Mineral shelves and benthic life frame the navigable water, without map icons.
  for(let i=0;i<48;i++){
   const a=i*Math.PI*2/48,noise=Math.sin(i*127.1+room.x)*.5+.5;
   const x=room.x+Math.cos(a)*room.rx*(.94+noise*.07),y=room.y+Math.sin(a)*room.ry*(.94+noise*.07);
   const r=16+noise*24;
   ctx.fillStyle=i%3===0?'#16343d':'#0b202c';ctx.strokeStyle='#25434b';ctx.lineWidth=2;
   ctx.beginPath();for(let j=0;j<7;j++){const b=j*Math.PI*2/7,rr=r*(.75+.25*Math.sin(j*7+i));const px=x+Math.cos(b)*rr,py=y+Math.sin(b)*rr*.7;j?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();
   if(i%4===0){ctx.strokeStyle='rgba(64,192,182,.45)';ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-12,y-18,x+5,y-35);ctx.moveTo(x,y-12);ctx.lineTo(x+13,y-24);ctx.stroke();}
  }
  const water=ctx.createRadialGradient(room.x-room.rx*.3,room.y-room.ry*.4,0,room.x,room.y,room.rx);
  water.addColorStop(0,'rgba(34,121,139,.12)');water.addColorStop(1,'rgba(0,8,18,0)');ctx.fillStyle=water;ctx.beginPath();ctx.ellipse(room.x,room.y,room.rx*.9,room.ry*.9,0,0,Math.PI*2);ctx.fill();
  drawCaveRoomSignal(room,t);
 }
 window.AbyssalTreasure?.update(ctx,activeMapTier,caveCleared,layout.rooms.find(r=>r.id==='boss'),player,t);
  drawMapPortal(layout.portals.start,t);if(caveCleared){drawMapPortal(layout.portals.surface,t);drawMapPortal(layout.portals.boss,t);}
 ctx.restore();
 return true;
}
function drawBackground(t){
 if(drawAbyssalCaveMap(t))return;
 if(isClassicCavernRun()&&SOLO_CAVERN){SOLO_CAVERN.paint(ctx,{left:cameraX,top:cameraY,width:viewW/worldZoom,height:viewH/worldZoom},t,W,H);return;}
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
 if(onlineMode||!isClassicShooterRun()){
 for(let x=left;x<right;x+=grid){ctx.beginPath();ctx.moveTo(x,Math.max(0,top));ctx.lineTo(x,Math.min(H,bottom));ctx.stroke()}
 for(let y=top;y<bottom;y+=grid){ctx.beginPath();ctx.moveTo(Math.max(0,left),y);ctx.lineTo(Math.min(W,right),y);ctx.stroke()}
 }
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
 const skin=playerCreature?(skinOverride||(skinData.find(s=>s.id===equippedSkin)||skinData[0])):null;
 const preview=renderContext!==ctx&&!enemyState?.__sprite;
 const visualMotion=enemyState?.__visualMotion||creatureVisualMotion(skin,kind,enemyState,x,y,angle,t,playerCreature,preview);
 const animationTime=Number(visualMotion?.phaseTime)||Number(t)||0;
 const liveSkinHeading=playerCreature&&renderContext===ctx&&Number.isFinite(angle)?angle:null;
 // Enemy/Boss locomotion uses the smoothed direction of actual travel.
 // Do not use attack-aim angle when its movement is in another direction.
 const movingEnemyHeading=!playerCreature&&renderContext===ctx&&kind!==RIFT_HARDCORE?.FINAL_KIND
  ?(Number.isFinite(visualMotion?.heading)?visualMotion.heading:(Number(angle)||0)):null;
 if(kind===RIFT_HARDCORE?.FINAL_KIND){
  c.save();c.translate(x,y);applyCreatureVisualTransform(c,visualMotion,r);
  finalBossVisualState.r=r;RIFT_HARDCORE.drawFinalBoss(c,finalBossVisualState,animationTime);c.restore();return;
 }
 // Cache elaborate hostile drawings off-screen and refresh them infrequently; a horde can share one sprite.
 if(renderContext===ctx&&!playerCreature&&!enemyState?.__directVector){
  const spread=kind==='kraken'?2.8:kind==='boss'?2.75:kind==='maw'?3.65:kind==='leviathan'?3.45:kind==='lurker'?2.55:BOSS_KINDS.includes(kind)?2.15:1.85;
  // One anatomical surface per species/size/color. Per-creature motion stays on
  // the cheap outer transform; phase variants multiplied the cache and caused
  // canvas creation/eviction loops in crowded online rooms.
  const side=Math.max(18,Math.ceil(r*spread*2)),density=Math.max(1,Math.ceil(dpr*worldZoom*1.25)),pixels=Math.ceil(side*density),key=kind+'|'+color+'|'+Math.round(r*100)+'|'+side+'|'+density;
  if(pixels*pixels>MAX_SINGLE_SPRITE_PIXELS||pixels>4096){drawCreature(x,y,r,angle,color,kind,t,false,hit,c,skinOverride,{...enemyState,__directVector:true,__visualMotion:visualMotion});return;}
  let sprite=getCachedSprite(hostileSpriteCache,key);
  if(!sprite){const surface=document.createElement('canvas');surface.width=pixels;surface.height=pixels;sprite={canvas:surface,context:surface.getContext('2d'),center:side/2,lastPaint:-Infinity};sprite.context.setTransform(density,0,0,density,0,0);rememberCachedSprite(hostileSpriteCache,key,sprite,48);}
  const refreshInterval=BOSS_KINDS.includes(kind)?50:83;const stale=t-sprite.lastPaint>=refreshInterval;const firstPaint=!Number.isFinite(sprite.lastPaint)||sprite.lastPaint<0;if(stale&&(firstPaint||hostileSpritePaintsThisFrame<2)){sprite.context.clearRect(0,0,side,side);hostileSpriteState.__visualMotion={...visualMotion,phaseTime:t};hostileSpriteState.phase=t*.003;drawCreature(sprite.center,sprite.center,r,0,color,kind,animationTime,false,0,sprite.context,null,hostileSpriteState);sprite.lastPaint=t;hostileSpritePaintsThisFrame++;}
  c.save();c.translate(x,y);applyCreatureVisualTransform(c,visualMotion,r,movingEnemyHeading);if(kind==='angler')c.globalAlpha=anglerVisibilityAlpha(Date.now());c.drawImage(sprite.canvas,-sprite.center,-sprite.center,side,side);if(kind==='angler'&&c.globalAlpha<.999){c.globalAlpha=1;const lx=.62*r,ly=-1.27*r,rr=.67*r,g=c.createRadialGradient(lx,ly,0,lx,ly,rr);g.addColorStop(0,'#fff');g.addColorStop(.2,'#fff7b3');g.addColorStop(.48,'#ffca57');g.addColorStop(1,'rgba(255,170,45,0)');c.fillStyle=g;c.shadowBlur=13;c.shadowColor='#ffdc70';c.beginPath();c.arc(lx,ly,rr,0,Math.PI*2);c.fill();}if(hit>0&&(kind!=='angler'||anglerVisibilityAlpha(Date.now())>.001)){c.globalAlpha=clamp(hit*2.6,0,.45)*(kind==='angler'?anglerVisibilityAlpha(Date.now()):1);c.fillStyle='#fff';c.beginPath();c.arc(0,0,r*.68,0,Math.PI*2);c.fill();}c.restore();return;
 }
 t=animationTime;
 const id=skin?.id||'default';
 if(playerCreature&&id==='riftSmileRelic'&&RIFT_HARDCORE?.drawNightmareRelic){c.save();c.translate(x,y);applyCreatureVisualTransform(c,visualMotion,r,liveSkinHeading);RIFT_HARDCORE.drawNightmareRelic(c,0,0,r,t);c.restore();return;}
 if(skin?.renderer==='marine'&&window.AbyssalMarineArt){window.AbyssalMarineArt.draw(c,x,y,r,angle,skin,animationTime,hit,visualMotion,liveSkinHeading!==null);return;}
 const boss=BOSS_KINDS.includes(kind);
 const glowScale=(playerCreature||boss)?(lowPowerRendering?.42:1):(r<13?.18:r<22?.38:.68)*(lowPowerRendering?.42:1);
 const pulse=1+Math.sin(t*.003+(x+y)*.01)*.025;
 c.save();c.translate(x,y);
 // All legacy skins get a restrained locomotion cycle without moving hitboxes:
 // fish oscillate along their axis, cephalopods pulse, benthic species sway.
 if(!enemyState?.__sprite)applyCreatureVisualTransform(c,visualMotion,r,liveSkinHeading??movingEnemyHeading);
 c.globalAlpha=1;
 const bodyGrad=(base=color)=>{const g=c.createRadialGradient(-r*.28,-r*.36,r*.05,r*.06,r*.05,r*1.45);g.addColorStop(0,hit>0?'#ffffff':'#f1ffff');g.addColorStop(.14,hit>0?'#ffffff':base);g.addColorStop(.53,base);g.addColorStop(.82,'#21465a');g.addColorStop(1,'#06111e');return g};
 const stroke=(draw,width=Math.max(1.1,r*.055),col=color,blur=10)=>{c.save();c.beginPath();draw();c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.shadowBlur=blur*glowScale;c.shadowColor=col;c.stroke();c.restore()};
 const fill=(draw,fillStyle,strokeStyle=null,width=Math.max(1,r*.045),blur=0)=>{c.save();c.beginPath();draw();c.fillStyle=fillStyle;c.shadowBlur=blur*glowScale;c.shadowColor=strokeStyle||color;c.fill();if(strokeStyle){c.strokeStyle=strokeStyle;c.lineWidth=width;c.lineJoin='round';c.stroke()}c.restore()};
 const body=(rx,ry,cy=0,base=color)=>fill(()=>c.ellipse(0,cy,r*rx*pulse,r*ry*pulse,0,0,Math.PI*2),bodyGrad(base),`rgba(224,255,255,.46)`,Math.max(1,r*.035),12);
 const fin=(points,col=color,edge='rgba(225,255,255,.55)')=>fill(()=>{
  // Tail/pectoral tips flex while their bases stay anchored to the body.
  const beat=Math.sin((Number(t)||0)*.0052);
  const point=(p)=>{const rear=Math.max(0,-p[0]-.65);
   return [p[0]*r,(p[1]+Math.sign(p[1]||1)*rear*.065*beat)*r];};
  const start=point(points[0]);c.moveTo(start[0],start[1]);
  for(let i=1;i<points.length;i++){const xy=point(points[i]);c.lineTo(xy[0],xy[1]);}
  c.closePath()},`rgba(8,30,46,.9)`,edge,Math.max(1,r*.035),8);
 const tentacle=(sx,sy,c1x,c1y,c2x,c2y,ex,ey,w=1, suckers=false)=>{
  const armSway=Math.sin((Number(t)||0)*.0053+sx*1.9+sy*.7)*.10;
  stroke(()=>{c.moveTo(sx*r,sy*r);c.bezierCurveTo(c1x*r,c1y*r,c2x*r,(c2y+armSway*.52)*r,ex*r,(ey+armSway)*r)},Math.max(.8,r*.045*w),color,9);
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


 const eelTail=()=>{const wave=Math.sin(t*.0038)*.13;
 fill(()=>{c.moveTo(-3.12*r,wave*r);c.bezierCurveTo(-2.48*r,(-.2+wave)*r,-1.73*r,-.25*r,-1.16*r,-.23*r);c.quadraticCurveTo(-.55*r,-.28*r,.03*r,-.30*r);c.lineTo(.03*r,.32*r);c.quadraticCurveTo(-.64*r,.25*r,-1.32*r,.22*r);c.bezierCurveTo(-2.06*r,.17*r,-2.58*r,(.13+wave)*r,-3.12*r,wave*r);c.closePath()},bodyGrad(color),'rgba(241,195,255,.62)',Math.max(1,r*.033),10);
 fill(()=>{c.moveTo(-3.10*r,wave*r);c.lineTo(-3.38*r,(wave-.26)*r);c.lineTo(-3.29*r,wave*r);c.lineTo(-3.42*r,(wave+.27)*r);c.closePath()},color,'rgba(237,186,255,.55)',Math.max(1,r*.025),6);
 stroke(()=>{c.moveTo(-2.99*r,wave*r);c.bezierCurveTo(-2.15*r,(wave-.03)*r,-1.38*r,.02*r,-.81*r,.01*r)},Math.max(.7,r*.023),'rgba(255,208,255,.54)',7)};
 const oarfishRibbon=()=>{const wave=Math.sin(t*.003)*.09;

 // A fine, flexible tail broadens progressively into a substantial oarfish head.
 fill(()=>{
  c.moveTo(-3.25*r,wave*r);
  c.bezierCurveTo(-2.96*r,(wave-.055)*r,-2.3*r,-.115*r,-1.5*r,-.16*r);
  c.bezierCurveTo(-.62*r,-.23*r,.22*r,-.34*r,.89*r,-.27*r);
  c.quadraticCurveTo(1.19*r,-.21*r,1.28*r,-.055*r);
  c.quadraticCurveTo(1.19*r,.18*r,.77*r,.28*r);
  c.bezierCurveTo(.07*r,.31*r,-.7*r,.18*r,-1.52*r,.135*r);
  c.bezierCurveTo(-2.39*r,.07*r,-2.97*r,(wave+.065)*r,-3.25*r,wave*r);
  c.closePath();
 },bodyGrad(color),'rgba(225,255,249,.7)',Math.max(1,r*.033),14);
 // Preserve the iridescent cyan and rose dorsal fin as the body tapers.
 for(let i=0;i<26;i++){
  const q=i/25,x=-3.0+i*.155,h=.11+.46*Math.pow(q,.8);
  stroke(()=>{c.moveTo(x*r,(-.10-.16*q)*r);c.quadraticCurveTo((x-.05)*r,(-.12-.16*q-h*.55)*r,(x-.095)*r,(-.12-.16*q-h)*r)},
   Math.max(.72,r*.018),i<7?'#ff668f':'#86f9ee',7);
 }
 for(let i=0;i<12;i++){
  const q=i/11,x=(-2.75+i*.29)*r,span=(.045+.095*q)*r;
  stroke(()=>{c.moveTo(x,-span);c.lineTo(x+.022*r,span)},Math.max(.6,r*.014),'rgba(232,255,248,.35)',2);
 }
};
 const lureOnly=(lx,ly)=>{c.save();c.globalAlpha=1;const rr=r*.67,g=c.createRadialGradient(lx*r,ly*r,0,lx*r,ly*r,rr);g.addColorStop(0,'#fff');g.addColorStop(.2,'#fff6b3');g.addColorStop(.48,'#ffca57');g.addColorStop(1,'rgba(255,170,45,0)');c.fillStyle=g;c.shadowColor='#ffda70';c.shadowBlur=12*glowScale;c.beginPath();c.arc(lx*r,ly*r,rr,0,Math.PI*2);c.fill();c.restore()};


 // Shared anatomical rendering: the boss and its skin have the same enormous open gape.
 const drawAnglerAnatomy=(colossal=false)=>{
  const u=colossal?1.08:1,lureX=colossal?.62:.55,lureY=colossal?-1.27:-1.18;
  fin([[-1.02,.02],[-1.62,-.45],[-1.44,.04],[-1.6,.42]],color);
  fin([[-.63,-.38],[-.33,-.94],[-.06,-.37]],color);
  fin([[-.48,.3],[-.74,.7],[-.05,.47]],color);
  // Thick cranial mass and cheeks, keeping the original warm amber palette.
  fill(()=>{c.moveTo(-1.17*r,0);c.bezierCurveTo(-1.12*r,-.54*r,-.54*r,-.83*r,.08*r,-.72*r);
   c.bezierCurveTo(.65*r,-.69*r,.84*r,-.32*r,.8*r,.11*r);
   c.bezierCurveTo(.64*r,.64*r,-.25*r,.72*r,-.86*r,.39*r);
   c.quadraticCurveTo(-1.16*r,.22*r,-1.17*r,0);c.closePath()},
   bodyGrad(color),'rgba(255,219,165,.73)',Math.max(1.1,r*.045),13);
  // A cavernous red-maroon throat, not a flat black mouth or black triangles.
  const throat=c.createRadialGradient(.66*r,.08*r,.06*r,.72*r,.08*r,.85*r);
  throat.addColorStop(0,'#a9475b');throat.addColorStop(.42,'#672436');
  throat.addColorStop(.78,'#351422');throat.addColorStop(1,'#210c19');
  fill(()=>{c.moveTo(.04*r,-.17*r);c.bezierCurveTo(.47*r,-.49*r,1.25*r,-.61*r,1.58*u*r,-.48*r);
   c.quadraticCurveTo(1.69*u*r,.06*r,1.6*u*r,.59*r);
   c.bezierCurveTo(1.06*r,.78*r,.4*r,.61*r,.02*r,.19*r);c.closePath()},
   throat,'rgba(255,158,118,.75)',Math.max(1.2,r*.043),9);
  fill(()=>{c.moveTo(.31*r,.25*r);c.bezierCurveTo(.68*r,.29*r,1.04*r,.55*r,1.36*r,.43*r);
   c.quadraticCurveTo(.96*r,.66*r,.42*r,.48*r);c.closePath()},
   'rgba(194,69,84,.63)','rgba(248,142,139,.28)',Math.max(.6,r*.012),3);
  for(let k=0;k<4;k++){const q=k/3;
   stroke(()=>{c.moveTo((.25+.15*q)*r,-(.09+.11*q)*r);
    c.quadraticCurveTo((.58+.13*q)*r,(.03+.12*q)*r,(.45+.13*q)*r,(.27+.11*q)*r)},
    Math.max(.65,r*.016),'rgba(245,128,120,.38)',2);
  }
  // Upper jaw arches sharply upward, visibly separate from the lower jaw.
  fill(()=>{c.moveTo(-.12*r,-.32*r);
   c.bezierCurveTo(.23*r,-.96*r,.99*r,-.92*r,1.55*u*r,-.57*r);
   c.quadraticCurveTo(1.63*u*r,-.46*r,1.48*u*r,-.39*r);
   c.bezierCurveTo(1.0*r,-.61*r,.46*r,-.37*r,.11*r,-.075*r);
   c.quadraticCurveTo(-.07*r,-.08*r,-.12*r,-.32*r);c.closePath()},
   bodyGrad('#d18a42'),'rgba(255,231,180,.86)',Math.max(1.1,r*.045),12);
  // The lower jaw hangs down, leaving a clear, very large gap.
  fill(()=>{c.moveTo(.04*r,.18*r);
   c.bezierCurveTo(.48*r,.54*r,1.09*r,.82*r,1.55*u*r,.48*r);
   c.quadraticCurveTo(1.64*u*r,.58*r,1.48*u*r,.74*r);
   c.bezierCurveTo(.94*r,1.02*r,.3*r,.75*r,-.07*r,.3*r);c.closePath()},
   bodyGrad('#b97037'),'rgba(255,214,156,.86)',Math.max(1.1,r*.045),12);
  // Needle-teeth follow both jaws instead of ringing a dark circular patch.
  c.save();c.fillStyle='#fff6d9';c.shadowColor='#ffcf94';c.shadowBlur=5*glowScale;
  for(let i=0;i<11;i++){const q=i/10,tx=(.34+1.13*q)*r;
   const top=(-.16-.27*q+.045*Math.sin(q*Math.PI))*r;
   const bottom=(.23+.23*q+.055*Math.sin(q*Math.PI))*r;
   const fang=(i%4===1?.2:.13)*r*(.8+.3*q);
   c.beginPath();c.moveTo(tx-.043*r,top-.025*r);
   c.quadraticCurveTo(tx,top+fang*.68,tx+.03*r,top+fang);
   c.lineTo(tx+.052*r,top-.012*r);c.closePath();c.fill();
   c.beginPath();c.moveTo(tx-.045*r,bottom+.025*r);
   c.quadraticCurveTo(tx,bottom-fang*.72,tx+.025*r,bottom-fang);
   c.lineTo(tx+.05*r,bottom+.01*r);c.closePath();c.fill();
  }c.restore();
  // Heavy forehead, gill folds and a small, focused predator eye.
  stroke(()=>{c.moveTo(-.64*r,-.43*r);c.bezierCurveTo(-.27*r,-.64*r,.05*r,-.59*r,.36*r,-.47*r)},
   Math.max(.8,r*.038),'rgba(255,240,194,.69)',6);
  for(let g=0;g<3;g++){const gx=(-.66+g*.13)*r;
   stroke(()=>{c.moveTo(gx,-.15*r);c.quadraticCurveTo(gx-.09*r,-.01*r,gx-.03*r,.22*r)},
    Math.max(.75,r*.024),'rgba(96,37,34,.68)',2);}
  eye(.02,-.42,r*(colossal?.085:.075),'#fff0b4');
  // Lure coordinates deliberately stay unchanged for lure-only camouflage.
  stroke(()=>{c.moveTo(-.12*r,-.61*r);c.quadraticCurveTo(.04*r,-1.36*r,lureX*r,lureY*r)},
   Math.max(1.3,r*.055),'#ffcc74',10);
  c.save();c.globalCompositeOperation='lighter';
  const glowR=r*(.18+.025*Math.sin(t*.008));
  const lamp=c.createRadialGradient(lureX*r,lureY*r,1,lureX*r,lureY*r,glowR*2.7);
  lamp.addColorStop(0,'#fff');lamp.addColorStop(.18,'#fffbd7');
  lamp.addColorStop(.46,'#ffd763');lamp.addColorStop(1,'rgba(255,142,45,0)');
  c.fillStyle=lamp;c.beginPath();c.arc(lureX*r,lureY*r,glowR*2.7,0,Math.PI*2);c.fill();c.restore();
 };

 const blueRingOctopus=()=>{const phase=t*.0028;
  for(let arm=0;arm<8;arm++){const offset=arm-3.5,sway=Math.sin(phase+arm*.72)*.19;
   krakenArm({sx:offset*.16,sy:.22,c1x:offset*.22+sway*.4,c1y:.76,c2x:offset*.26-sway,c2y:1.5,ex:offset*.29+sway*.7,ey:2.22+(arm%3)*.16},arm,phase);}
  const mantle=c.createRadialGradient(-.22*r,-.7*r,.05*r,0,-.25*r,1.1*r);mantle.addColorStop(0,'#a5dfff');mantle.addColorStop(.22,'#348fe7');mantle.addColorStop(.68,'#1763bf');mantle.addColorStop(1,'#092657');
  fill(()=>{c.moveTo(-.82*r,.15*r);c.bezierCurveTo(-.88*r,-.48*r,-.59*r,-1.35*r,0,-1.4*r);c.bezierCurveTo(.59*r,-1.35*r,.88*r,-.48*r,.82*r,.15*r);c.quadraticCurveTo(.35*r,.58*r,0,.55*r);c.quadraticCurveTo(-.35*r,.58*r,-.82*r,.15*r);c.closePath()},mantle,'rgba(133,212,255,.85)',Math.max(1.2,r*.043),14);
  for(let i=0;i<18;i++){const theta=i*2.399,px=Math.cos(theta)*(.26+(i%4)*.095),py=-.36+Math.sin(theta)*(.25+(i%3)*.11);c.save();c.strokeStyle='#67ddff';c.lineWidth=Math.max(1.1,r*.04);c.shadowBlur=11*glowScale;c.shadowColor='#13aaff';c.beginPath();c.arc(px*r,py*r,r*(.048+(i%3)*.01),0,Math.PI*2);c.stroke();c.restore();}
  eye(-.26,-.2,r*.062,'#e8ffff');eye(.26,-.2,r*.062,'#e8ffff');
 };

 if(playerCreature){
  // Every skin has a readable, largely bilateral deep-sea silhouette.
  if(id==='kraken'){
    // Glass-octopus inspired Kraken: translucent mantle, visible core, red eyes and an unsettling grin.
    for(let arm=0;arm<8;arm++){const pose=window.AbyssalEnemyAI?.krakenTentaclePose?.(arm,enemyState?.specimenCombatPhase??t*.0018)||{sx:Math.cos(arm*Math.PI/4)*.42,sy:.18,c1x:Math.cos(arm*Math.PI/4)*1.0,c1y:Math.sin(arm*Math.PI/4)*1.0,c2x:Math.cos(arm*Math.PI/4)*2.2,c2y:Math.sin(arm*Math.PI/4)*2.2,ex:Math.cos(arm*Math.PI/4)*3.4,ey:Math.sin(arm*Math.PI/4)*3.4};krakenArm(pose,arm,t);}
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
   // Bull shark silhouette: heavy shoulders, blunt snout, broad pectorals and a powerful caudal fin.
   fin([[-.9,0],[-1.8,-.8],[-1.55,0],[-1.72,.5]],color);
   fin([[-.4,-.25],[-.35,-1.05],[.25,-.3]],color);
   fin([[.25,.2],[-.45,.95],[.65,.35]],color);
   fill(()=>{c.moveTo(-1.2*r,0);c.bezierCurveTo(-.7*r,-.62*r,.7*r,-.7*r,1.25*r,-.23*r);c.quadraticCurveTo(1.53*r,0,1.24*r,.25*r);c.bezierCurveTo(.4*r,.65*r,-.7*r,.5*r,-1.2*r,0)},bodyGrad('#608e9b'),'#b7dbe0',Math.max(1,r*.035),3);
   fill(()=>{c.moveTo(-.9*r,.12*r);c.quadraticCurveTo(.3*r,.2*r,1.25*r,.08*r);c.quadraticCurveTo(.6*r,.6*r,-.9*r,.12*r)},'#a2bfc4',null,0,0);
   gills(.2,-.23,5);eye(.94,-.18,r*.07,'#c8f5fa');
   stroke(()=>{c.moveTo(.85*r,.15*r);c.quadraticCurveTo(1.1*r,.23*r,1.28*r,.06*r)},r*.035,'#132e40',0);
  } else if(id==='saltcroc'||id==='blackcaiman'){
   const caiman=id==='blackcaiman',jaw=caiman?.32:.18;
   for(const side of [-1,1])for(const xx of [-.55,.35])fill(()=>{c.moveTo(xx*r,side*.22*r);c.lineTo((xx-.25)*r,side*.72*r);c.lineTo((xx+.14)*r,side*.61*r);c.lineTo((xx+.25)*r,side*.24*r);c.closePath()},bodyGrad(color),'#759daa',r*.025,1);
   fill(()=>{c.moveTo(-.5*r,-.35*r);c.bezierCurveTo(-1.1*r,-.28*r,-1.65*r,Math.sin(t*.004)*.3*r,-2.3*r,.08*r);c.quadraticCurveTo(-1.3*r,.5*r,-.4*r,.38*r);c.closePath()},bodyGrad(color),'#739ca5',r*.03,2);
   body(.9,.43,0,color);
   fill(()=>{c.moveTo(.35*r,-.38*r);c.lineTo(1.65*r,-jaw*r);c.quadraticCurveTo(1.9*r,0,1.65*r,jaw*r);c.lineTo(.35*r,.38*r);c.closePath()},bodyGrad(color),'#a2c6ce',r*.035,2);
   for(let i=-3;i<=2;i++)for(const side of [-1,1])fill(()=>c.ellipse(i*.2*r,side*.16*r,.12*r,.09*r,0,0,Math.PI*2),'#294957','#6a98a4',r*.018,0);
   for(const side of [-1,1]){eye(.55,side*.27,r*.07,'#8ce9e7');for(let i=0;i<6;i++)fill(()=>{const xx=(.85+i*.13)*r;c.moveTo(xx,side*jaw*r);c.lineTo(xx+.05*r,side*(jaw-.07)*r);c.lineTo(xx+.08*r,side*jaw*r);c.closePath()},'#ceddd5',null,0,0);}
  } else if(id==='armoredgator'){
   // Horseshoe crab silhouette: domed prosoma, smaller abdomen and a long telson used by the spin ability.
   const pulse=.98+.02*Math.sin(t*.0042);
   fill(()=>{c.moveTo(-.85*r,0);c.quadraticCurveTo(-.72*r,-.78*r,.18*r,-.86*r);c.quadraticCurveTo(1.08*r,-.72*r,1.3*r,0);c.quadraticCurveTo(1.08*r,.72*r,.18*r,.86*r);c.quadraticCurveTo(-.72*r,.78*r,-.85*r,0);c.closePath()},bodyGrad('#8f7c50'),'rgba(235,211,158,.74)',Math.max(1,r*.045),8);
   fill(()=>{c.ellipse(-.56*r,0,.45*r,.56*r,0,0,Math.PI*2)},bodyGrad('#6d6044'),'rgba(211,190,143,.58)',Math.max(1,r*.03),4);
   stroke(()=>{c.moveTo(-.86*r,0);c.lineTo(-2.25*r,0)},Math.max(2,r*.075),'#c8ad6f',6);
   fill(()=>{c.moveTo(-2.3*r,0);c.lineTo(-1.95*r,-.09*r);c.lineTo(-1.95*r,.09*r);c.closePath()},'#e0c17b','rgba(255,235,187,.6)',Math.max(.7,r*.02),4);
   for(const side of [-1,1])for(let leg=0;leg<4;leg++){const x=(-.45+leg*.28)*r,y=side*(.28+leg*.045)*r;stroke(()=>{c.moveTo(x,y);c.lineTo(x-.18*r,side*.64*r);c.lineTo(x+.05*r,side*.72*r)},Math.max(1,r*.035),'rgba(192,164,105,.78)',2);}
   eye(.48,-.5,r*.035,'#f6d889');eye(.48,.5,r*.035,'#f6d889');
   c.save();c.globalAlpha=.18;c.strokeStyle='#ffe29a';c.lineWidth=Math.max(.7,r*.018);c.beginPath();c.ellipse(.18*r,0,.84*r*pulse,.7*r*pulse,0,0,Math.PI*2);c.stroke();c.restore();
    } else if(id==='electriceel'){
   // Electric ray / torpedo ray: rounded disc, short tail and paired electric organs.
   const flap=Math.sin(t*.0052)*.08;
   fill(()=>{c.moveTo(-.55*r,0);c.bezierCurveTo(-.25*r,(-.95-flap)*r,.72*r,-1.02*r,1.22*r,-.24*r);c.quadraticCurveTo(1.48*r,0,1.22*r,.24*r);c.bezierCurveTo(.72*r,1.02*r,-.25*r,(.95+flap)*r,-.55*r,0);c.closePath()},bodyGrad('#2a8aa0'),'rgba(153,248,255,.82)',Math.max(1.1,r*.04),12);
   fill(()=>{c.moveTo(-.48*r,-.12*r);c.lineTo(-2.05*r,-.18*r);c.lineTo(-2.28*r,0);c.lineTo(-2.05*r,.18*r);c.lineTo(-.48*r,.12*r);c.closePath()},bodyGrad('#176e86'),'rgba(112,226,239,.62)',Math.max(1,r*.03),5);
   fin([[-1.72,-.12],[-2.02,-.48],[-1.55,-.15]],'#237d91','#7befff');fin([[-1.72,.12],[-2.02,.48],[-1.55,.15]],'#237d91','#7befff');
   eye(.62,-.24,r*.045,'#e8ffff');eye(.62,.24,r*.045,'#e8ffff');
   for(const side of [-1,1]){c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.42+.22*Math.sin(t*.006+side);c.fillStyle='#65f8ff';c.shadowBlur=14*glowScale;c.shadowColor='#38e8ff';c.beginPath();c.ellipse(.14*r,side*.28*r,.3*r,.18*r,0,0,Math.PI*2);c.fill();c.restore();}
   for(let k=0;k<3;k++){const phase=t*.006+k*2.1,sx=(-.55+k*.42)*r,sy=Math.sin(phase)*.18*r;stroke(()=>{c.moveTo(sx,sy);c.lineTo(sx+.12*r,sy-.18*r);c.lineTo(sx+.25*r,sy+.08*r)},Math.max(.8,r*.018),'rgba(220,255,255,.92)',8);}
  } else if(id==='electriceellegacy'){
   // Classic electric eel rebuilt as one continuous muscular body, with cyan organs
   // travelling under the skin instead of borrowing the torpedo-ray silhouette.
   const wave=Math.sin(t*.0065)*.18,pulse=.55+.35*Math.sin(t*.010);
   fill(()=>{c.moveTo(-2.45*r,wave*r);c.bezierCurveTo(-1.72*r,(-.31+wave)*r,-.62*r,-.30*r,.28*r,-.22*r);c.bezierCurveTo(.82*r,-.19*r,1.22*r,-.16*r,1.48*r,-.05*r);c.quadraticCurveTo(1.62*r,.02*r,1.48*r,.13*r);c.bezierCurveTo(.72*r,.31*r,-.48*r,.35*r,-1.38*r,.25*r);c.bezierCurveTo(-1.92*r,.19*r,-2.20*r,(.13+wave)*r,-2.45*r,wave*r);c.closePath()},bodyGrad('#173d50'),'rgba(127,246,255,.86)',Math.max(1.2,r*.04),13);
   fill(()=>{c.moveTo(-2.12*r,(.02+wave)*r);c.bezierCurveTo(-1.38*r,(-.49+wave)*r,-.18*r,-.42*r,.86*r,-.24*r);c.bezierCurveTo(-.2*r,-.31*r,-1.32*r,-.30*r,-2.12*r,(.02+wave)*r);c.closePath()},'rgba(31,156,181,.34)','rgba(122,246,255,.44)',Math.max(.7,r*.018),5);
   fill(()=>{c.moveTo(.58*r,-.22*r);c.quadraticCurveTo(1.20*r,-.29*r,1.55*r,.01*r);c.quadraticCurveTo(1.18*r,.31*r,.58*r,.23*r);c.closePath()},bodyGrad('#245c6d'),'rgba(211,255,255,.9)',Math.max(1,r*.034),8);
   eye(1.02,-.16,r*.052,'#eaffff');eye(1.02,.16,r*.052,'#eaffff');
   c.save();c.globalCompositeOperation='lighter';c.strokeStyle=`rgba(101,248,255,${.34+pulse*.48})`;c.shadowBlur=(10+8*pulse)*glowScale;c.shadowColor='#38e8ff';c.lineWidth=Math.max(1.1,r*.026);
   c.beginPath();c.moveTo(-1.92*r,wave*r);for(let j=0;j<=10;j++){const xx=(-1.75+j*.25)*r,yy=(Math.sin(t*.011+j*1.7)*.12)*r;c.lineTo(xx,yy);}c.stroke();c.restore();
   for(let k=0;k<4;k++){const phase=t*.012+k*1.65,sx=(-1.4+k*.55)*r,sy=Math.sin(phase)*.15*r;stroke(()=>{c.moveTo(sx,sy);c.lineTo(sx+.10*r,sy-.17*r);c.lineTo(sx+.22*r,sy+.08*r)},Math.max(.8,r*.018),'rgba(225,255,255,.95)',9);}
  } else if(id==='greensnake'){
   // Giant emerald moray: continuous dorsal fin, sinuous body and a compact predatory head.
   const wave=Math.sin(t*.006)*.16;
   fill(()=>{c.moveTo(-2.35*r,wave*r);c.bezierCurveTo(-1.65*r,(-.34+wave)*r,-.72*r,-.33*r,.2*r,-.25*r);c.bezierCurveTo(.74*r,-.22*r,1.13*r,-.2*r,1.38*r,-.08*r);c.quadraticCurveTo(1.56*r,0,1.38*r,.11*r);c.bezierCurveTo(.68*r,.3*r,-.45*r,.36*r,-1.28*r,.28*r);c.bezierCurveTo(-1.82*r,.24*r,-2.1*r,(.16+wave)*r,-2.35*r,wave*r);c.closePath()},bodyGrad('#20935e'),'rgba(136,255,190,.84)',Math.max(1.2,r*.04),12);
   fill(()=>{c.moveTo(-2.05*r,(.02+wave)*r);c.bezierCurveTo(-1.28*r,(-.55+wave)*r,-.15*r,-.47*r,.74*r,-.29*r);c.bezierCurveTo(-.15*r,-.34*r,-1.2*r,-.34*r,-2.05*r,(.02+wave)*r);c.closePath()},'rgba(59,240,143,.34)','rgba(137,255,192,.38)',Math.max(.7,r*.018),4);
   fill(()=>{c.moveTo(.52*r,-.24*r);c.quadraticCurveTo(1.18*r,-.32*r,1.56*r,0);c.quadraticCurveTo(1.17*r,.34*r,.52*r,.25*r);c.closePath()},bodyGrad('#2ee88a'),'rgba(201,255,224,.9)',Math.max(1,r*.035),7);
   fill(()=>{c.moveTo(.86*r,.02*r);c.lineTo(1.52*r,.02*r);c.quadraticCurveTo(1.2*r,.2*r,.78*r,.17*r);c.closePath()},'#102c20','rgba(159,255,201,.42)',Math.max(.6,r*.014),1);
   for(let tooth=0;tooth<5;tooth++){const tx=(.95+tooth*.1)*r;fill(()=>{c.moveTo(tx,.02*r);c.lineTo(tx+.035*r,.105*r);c.lineTo(tx+.07*r,.02*r);c.closePath()},'#effff5',null,0,0);}
   eye(.98,-.18,r*.055,'#ffc84a');eye(.98,.18,r*.055,'#ffc84a');
   c.save();c.globalAlpha=.3+.12*Math.sin(t*.005);c.strokeStyle='#61ffac';c.shadowBlur=8*glowScale;c.shadowColor='#2ee88a';c.lineWidth=Math.max(.8,r*.02);c.beginPath();c.moveTo(-1.7*r,0);c.quadraticCurveTo(-.4*r,.18*r,.72*r,.02*r);c.stroke();c.restore();
  } else if(id==='default'){
   // Comb-jelly bell with six evenly spaced trailing cilia.
   for(let i=0;i<6;i++){const px=-.62+i*.25,side=i%2?-1:1;tentacle(px,.18,px-.08,.62,px+.12,1.12,px+.02,1.42,.9,false)}
   fill(()=>{c.moveTo(-.84*r,-.02*r);c.bezierCurveTo(-.9*r,-.7*r,-.48*r,-.9*r,0,-.86*r);c.bezierCurveTo(.5*r,-.9*r,.9*r,-.56*r,.82*r,-.02*r);c.quadraticCurveTo(0,.24*r,-.82*r,-.02*r)},bodyGrad(color),'rgba(204,255,253,.75)',Math.max(1.2,r*.06),16);
   stroke(()=>{c.moveTo(-.76*r,-.02*r);c.quadraticCurveTo(0,.28*r,.76*r,-.02*r)},Math.max(1,r*.06),'#dfffff',8);
   for(let k=0;k<5;k++){const xx=(-.52+k*.26)*r;stroke(()=>{c.moveTo(xx,-.62*r);c.quadraticCurveTo(xx-.03*r,-.35*r,xx+.03*r,-.14*r)},Math.max(.7,r*.025),'rgba(218,255,255,.55)',3)}
   eye(.24,-.25,r*.075);
   } else if(id==='leviathan'){
   oarfishRibbon();
   // The oarfish head now joins the ribbon, without an isolated round forehead mass.
   fill(()=>{c.moveTo(.50*r,-.29*r);c.quadraticCurveTo(.96*r,-.33*r,1.24*r,-.08*r);
    c.quadraticCurveTo(1.32*r,.02*r,1.22*r,.13*r);
    c.quadraticCurveTo(.94*r,.29*r,.52*r,.24*r);c.closePath()},
    bodyGrad('#d3bcc5'),'#f6e2ea',Math.max(.9,r*.028),5);
   fill(()=>{c.ellipse(.62*r,.045*r,.18*r,.11*r,-.03,0,Math.PI*2)},'rgba(255,231,236,.38)',null,0,2);
   eye(.98,-.11,r*.047,'#ffe9ef');gills(.5,-.14,3);
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
   // Royal abyss: a colonial siphonophore rather than another bell jelly.
   // A pearl-chain spine, crown float and four long feeding ribbons create a unique profile.
   const royalPulse=.92+.08*Math.sin(t*.0032);
   for(let i=0;i<6;i++){
    const px=(-1.22+i*.31)*r,py=Math.sin(t*.0026+i*.8)*.08*r;
    c.save();c.fillStyle=i%2?'#ffc9ec':'#ffe9b2';c.strokeStyle='rgba(255,244,215,.76)';c.lineWidth=Math.max(.7,r*.022);c.shadowBlur=lowPowerRendering?0:7*glowScale;c.shadowColor='#ffb9df';c.beginPath();c.ellipse(px,py,(.17-i*.008)*r,(.13-i*.006)*r,0,0,Math.PI*2);c.fill();c.stroke();c.restore();
   }
   for(let side of [-1,1]){
    tentacle(-.52,side*.12,-.86,side*.43,-1.05,side*.9,-1.42,side*1.34,.72);
    tentacle(.02,side*.16,-.15,side*.52,.18,side*.92,-.08,side*1.38,.62);
   }
   fill(()=>{c.moveTo(-.32*r,-.36*r);c.bezierCurveTo(-.18*r,-.88*r,.3*r,-1.02*r,.62*r,-.62*r);c.bezierCurveTo(.87*r,-.3*r,.83*r,.24*r,.52*r,.48*r);c.bezierCurveTo(.17*r,.67*r,-.25*r,.48*r,-.32*r,-.36*r);c.closePath()},bodyGrad('#c55ea7'),'rgba(255,222,241,.78)',Math.max(1.2,r*.05),13);
   fill(()=>{c.moveTo(-.02*r,-.65*r);c.lineTo(.12*r,-1.16*r);c.lineTo(.31*r,-.82*r);c.lineTo(.5*r,-1.22*r);c.lineTo(.64*r,-.66*r);c.closePath()},'#7f3979','#ffe4b4',Math.max(1,r*.04),8);
   c.save();c.globalAlpha=.78;c.strokeStyle='#fff0b8';c.lineWidth=Math.max(1,r*.045);c.shadowBlur=lowPowerRendering?0:10*glowScale;c.shadowColor='#ffd99b';c.beginPath();c.ellipse(.34*r,-.5*r,.55*r*royalPulse,.24*r*royalPulse,-.12,0,Math.PI*2);c.stroke();c.restore();
   eye(.48,-.3,r*.06,'#fff3c3');
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
   // Vampire squid: muscular mantle, paired fins and eight arms joined by a dark web.
   fin([[-.1,-.3],[.45,-.95],[.8,-.32]],'#853d65','#d68ba0');
   fin([[-.1,.3],[.45,.95],[.8,.32]],'#853d65','#d68ba0');
   fill(()=>{c.moveTo(-.48*r,-.38*r);c.bezierCurveTo(-.1*r,-.85*r,1.15*r,-.6*r,1.18*r,0);c.bezierCurveTo(1.15*r,.6*r,-.1*r,.85*r,-.48*r,.38*r);c.closePath()},bodyGrad('#843d5d'),'#d5a0b5',Math.max(1,r*.035),4);
   fill(()=>{c.moveTo(-.36*r,-.38*r);for(let i=0;i<=8;i++){const a=-1.05+i*.2625;c.lineTo((-1.1-Math.cos(a)*.42)*r,Math.sin(a)*.96*r);}c.lineTo(-.36*r,.38*r);c.closePath()},bodyGrad('#42243f'),'#a3587a',Math.max(.8,r*.025),2);
   for(let i=0;i<8;i++){const yy=(i-3.5)*.21;stroke(()=>{c.moveTo(-.32*r,yy*.38*r);c.bezierCurveTo(-.8*r,yy*.7*r,-1.26*r,yy*r,(-1.55+.12*Math.sin(t*.003+i))*r,yy*1.2*r)},Math.max(1.5,r*.075),'#99516e',3);}
   eye(-.25,-.28,r*.14,'#86d8ef');eye(-.25,.28,r*.12,'#86d8ef');
  } else if(id==='solar'){
   // Solar core: compact armored sunfish with a corona of rigid golden rays.
   for(let i=0;i<14;i++){const a=i*Math.PI/7,inner=.66,outer=i%2?1.0:1.18;fill(()=>{c.moveTo(Math.cos(a-.08)*inner*r,Math.sin(a-.08)*inner*r);c.lineTo(Math.cos(a)*outer*r,Math.sin(a)*outer*r);c.lineTo(Math.cos(a+.08)*inner*r,Math.sin(a+.08)*inner*r);c.closePath()},'#b66c24','#ffe7a1',Math.max(.7,r*.025),6);}
   fill(()=>{c.ellipse(0,0,.72*r,.62*r,0,0,Math.PI*2)},bodyGrad('#d68b31'),'rgba(255,236,164,.82)',Math.max(1.2,r*.05),14);
   c.save();const g=c.createRadialGradient(.1*r,-.08*r,1,.1*r,-.08*r,.48*r);g.addColorStop(0,'#fffce1');g.addColorStop(.4,'#ffd86a');g.addColorStop(1,'rgba(255,148,44,.12)');c.fillStyle=g;c.beginPath();c.arc(.1*r,-.08*r,.48*r,0,Math.PI*2);c.fill();c.restore();eye(.38,-.17,r*.055,'#fff4bc');
  } else if(id==='violet'){
   // Crown jelly: a scalloped muscular bell and trailing oral arms, with no fish fins.
   for(let i=0;i<12;i++){const yy=(i-5.5)*.105;stroke(()=>{c.moveTo(-.22*r,yy*r);c.bezierCurveTo(-.85*r,(yy+.12*Math.sin(t*.002+i))*r,-1.3*r,(yy*1.5-.1)*r,(-1.65-.2*Math.sin(i))*r,(yy*1.7+.12*Math.sin(t*.003+i))*r)},Math.max(.6,r*.026),i%2?'#8b6eb5':'#bca1dc',2);}
   fill(()=>{c.moveTo(-.35*r,-.67*r);c.bezierCurveTo(.45*r,-.94*r,1.05*r,-.52*r,1.06*r,0);c.bezierCurveTo(1.05*r,.52*r,.45*r,.94*r,-.35*r,.67*r);for(let i=0;i<=8;i++)c.lineTo((-.35-.12*Math.sin(i*Math.PI/2))*r,(.67-i*.1675)*r);c.closePath()},bodyGrad('#645282'),'#b3a3d0',Math.max(1,r*.035),4);
   for(let i=-2;i<=2;i++)stroke(()=>{c.moveTo(.86*r,0);c.quadraticCurveTo(.48*r,i*.26*r,-.28*r,i*.25*r)},Math.max(.7,r*.025),'rgba(180,206,239,.5)',2);
   fill(()=>c.ellipse(.35*r,0,.23*r,.37*r,0,0,Math.PI*2),'rgba(153,123,196,.4)',null,0,0);
  } else if(id==='aberration'||id==='angler'||id==='maw'||id==='devourer'){
   if(id==='aberration'){
    blueRingOctopus();
   }else if(id==='angler'){
    drawAnglerAnatomy(false);
   }else if(id==='maw'){
    eelTail();fill(()=>{c.ellipse(-.05*r,0,.91*r,.86*r,0,0,Math.PI*2)},bodyGrad(color),'rgba(238,197,255,.48)',Math.max(1,r*.04),8);
    c.save();c.fillStyle='#050611';c.strokeStyle='#f0c5ff';c.lineWidth=Math.max(1,r*.05);c.beginPath();c.ellipse(.12*r,0,.56*r,.63*r,0,0,Math.PI*2);c.fill();c.stroke();c.restore();teeth(.12,0,.52,.58,16,.8);eye(.65,-.15,r*.05,'#ffeaff');
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
  if(['reefshark','hammerhead','abysscroc','greensnake','leviathan'].includes(id))stroke(()=>{c.moveTo(-.55*r,.03*r);c.quadraticCurveTo(0,.21*r,.48*r,.04*r)},Math.max(.8,r*.025),'rgba(214,255,250,.52)',5);
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
  blueRingOctopus();
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
  oarfishRibbon();
  fill(()=>{c.ellipse(.88*r,-.015*r,.43*r,.3*r,-.04,0,Math.PI*2)},'#d0e9de','#f4fffb',Math.max(1,r*.03),9);
  fill(()=>{c.ellipse(.64*r,.06*r,.21*r,.12*r,-.03,0,Math.PI*2)},'rgba(209,255,243,.32)',null,0,2);
  eye(1.03,-.11,r*.052,'#bafff3');gills(.51,-.14,4);
  } else if(kind==='maw'){
  eelTail();fill(()=>{c.ellipse(-.07*r,0,.98*r,.91*r,0,0,Math.PI*2)},bodyGrad(color),'rgba(240,199,255,.46)',Math.max(1,r*.04),9);
  c.save();c.fillStyle='#080713';c.strokeStyle='#ff92e1';c.lineWidth=Math.max(1.5,r*.075);c.shadowBlur=14;c.shadowColor=color;c.beginPath();c.ellipse(.2*r,0,.56*r,.63*r,0,0,Math.PI*2);c.fill();c.stroke();c.restore();teeth(.2,0,.52,.59,18,1.05);eye(.52,-.12,r*.055,'#f4d5ff');
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
  drawAnglerAnatomy(true);
 }
 // Bioluminescent side line and paired sensory pores unify the species without flattening silhouettes.
 if(!['drifter','maw','angler'].includes(kind))stroke(()=>{c.moveTo(-.45*r,.06*r);c.quadraticCurveTo(-.05*r,.22*r,.42*r,.07*r)},Math.max(.8,r*.028),'rgba(211,255,246,.55)',5);
 c.restore();
}
function drawArenaTerrain(t){
 if(isClassicCavernRun()&&SOLO_CAVERN){SOLO_CAVERN.drawRocks(ctx,arenaRocks,{left:cameraX,top:cameraY,width:viewW/worldZoom,height:viewH/worldZoom},t);return;}
 // Open sea now has one source of truth for geology and drawing. Rift/PvP keep their own terrain.
 if(usesNaturalOceanTerrain()){
  window.AbyssalOpenSeaRender?.draw?.(ctx,{left:cameraX,top:cameraY,width:viewW/worldZoom,height:viewH/worldZoom},t,lowPowerRendering);
  window.AbyssalExplorationWorldRender?.(ctx,t,{left:cameraX,top:cameraY,right:cameraX+viewW/worldZoom,bottom:cameraY+viewH/worldZoom});
  return;
 }
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
 const strands=lowPowerRendering?9:16;
 ctx.save();ctx.translate(enemy.x,enemy.y);ctx.rotate(Number(enemy.angle)||0);
 ctx.strokeStyle='#8df9ee';ctx.lineWidth=2.8/GAME_WORLD_ZOOM;ctx.shadowBlur=lowPowerRendering?0:16/GAME_WORLD_ZOOM;ctx.shadowColor='#47e4d5';
 for(let i=0;i<strands;i++){
  const a=i*Math.PI*2/strands+elapsed*.55,outer=range*(.72+.22*Math.sin(elapsed*1.7+i));
  const sx=Math.cos(a)*outer,sy=Math.sin(a)*outer*.72,midX=Math.cos(a+.55)*outer*.5,midY=Math.sin(a+.55)*outer*.38;
  ctx.globalAlpha=.22+.2*(.5+.5*Math.sin(elapsed*3+i));ctx.beginPath();ctx.moveTo(sx,sy);ctx.quadraticCurveTo(midX,midY,mouthX,0);ctx.stroke();
  const travel=(t*.00065+i*.137)%1,px=sx+(mouthX-sx)*travel,py=sy*(1-travel)+(Math.sin(a+elapsed)*enemy.r*.16)*travel;
  ctx.globalAlpha=.45+.3*Math.sin(elapsed*4+i);ctx.fillStyle=i%2?'#d9fff8':'#6bf2e4';ctx.beginPath();ctx.arc(px,py,(2.2+(i%3))/GAME_WORLD_ZOOM,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=.34;ctx.strokeStyle='#7ff8e9';for(let ring=0;ring<5;ring++){const radius=range*(.18+ring*.18);ctx.beginPath();ctx.ellipse(0,0,radius,radius*.72,elapsed*.14+ring*.4,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}
function drawHostileSpeciesEffect(enemy,t){
 if(!enemy||!BOSS_KINDS.includes(enemy.kind))return;
 ctx.save();ctx.translate(enemy.x,enemy.y);ctx.rotate(Number(enemy.angle)||0);ctx.lineWidth=1.6/GAME_WORLD_ZOOM;
 if(enemy.kind==='boss'){
  ctx.globalAlpha=.22+.12*Math.sin(t*.007);ctx.strokeStyle='#32c8ff';ctx.shadowBlur=12;ctx.shadowColor='#1aa8ff';for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,enemy.r*(1.35+i*.23),enemy.r*(1.05+i*.17),t*.0004+i,0,Math.PI*2);ctx.stroke();}
 }else if(enemy.kind==='angler'){
  // No outline or halo reveals the camouflaged body: only the lure is visible.
 }else if(enemy.kind==='maw'){
  const cycle=(t%4500)/4500;ctx.globalAlpha=.18+.28*Math.max(0,1-cycle*2);ctx.strokeStyle='#e59aff';ctx.lineWidth=3/GAME_WORLD_ZOOM;ctx.beginPath();ctx.arc(enemy.r*.2,0,enemy.r*(.78+cycle*.85),0,Math.PI*2);ctx.stroke();
 }else if(enemy.kind==='leviathan'){
  ctx.globalAlpha=.22;ctx.strokeStyle='#70f7e8';for(let lane=-1;lane<=1;lane++){ctx.beginPath();ctx.moveTo(-enemy.r*3.1,lane*enemy.r*.28);ctx.bezierCurveTo(-enemy.r*2.1,lane*enemy.r*.55+Math.sin(t*.004+lane)*enemy.r*.18,-enemy.r*.9,lane*enemy.r*.2,enemy.r*.4,lane*enemy.r*.14);ctx.stroke();}
 }else if(enemy.kind==='whiteSharkBoss'){
  ctx.globalAlpha=.2;ctx.strokeStyle='#77dcff';for(let lane=-1;lane<=1;lane+=2){ctx.beginPath();ctx.moveTo(-enemy.r*2.15,lane*enemy.r*.3);ctx.lineTo(-enemy.r*.6,lane*enemy.r*.16);ctx.stroke();}
 }
 ctx.restore();
}
const specimenPortraits=new Map();
function registerSpecimenPortrait(canvas,skinId){
 if(!canvas?.getContext)return;specimenPortraits.set(canvas,String(skinId||equippedSkin));scheduleSpecimenPortraits();
}
function hasVisibleSpecimenPortrait(){
 for(const canvas of [...specimenPortraits.keys()]){
  if(!canvas?.isConnected){specimenPortraits.delete(canvas);continue;}
  if(canvas.getClientRects().length&&canvas.offsetWidth&&canvas.offsetHeight)return true;
 }
 return false;
}
function scheduleSpecimenPortraits(){if(!registerSpecimenPortrait.running&&specimenPortraits.size&&!document.hidden&&!document.body.classList.contains('game-active')&&hasVisibleSpecimenPortrait()){registerSpecimenPortrait.running=true;requestAnimationFrame(renderSpecimenPortraits);}}
new MutationObserver(scheduleSpecimenPortraits).observe(document.body,{attributes:true,attributeFilter:['class']});
document.addEventListener('visibilitychange',scheduleSpecimenPortraits);
function renderSpecimenPortraits(t){
 if(document.hidden||document.body.classList.contains('game-active')){registerSpecimenPortrait.running=false;return;}
 let visiblePortraits=0;
 for(const [canvas,skinId] of [...specimenPortraits]){
  if(!canvas.isConnected){specimenPortraits.delete(canvas);continue;}
  if(!canvas.getClientRects().length||!canvas.offsetWidth||!canvas.offsetHeight)continue;
  visiblePortraits++;
  const surface=preparePreviewCanvas(canvas);if(!surface)continue;const {c,w,h}=surface,skin=skinData.find(s=>s.id===skinId)||skinData[0];c.clearRect(0,0,w,h);
  const bg=c.createRadialGradient(w*.5,h*.48,10,w*.5,h*.48,w*.55);bg.addColorStop(0,'rgba(55,150,177,.18)');bg.addColorStop(1,'rgba(2,12,23,0)');if(!canvas.closest?.('#shopScreen')){c.fillStyle=bg;c.fillRect(0,0,w,h);}
  // Restore the natural diagonal swimming portrait used before the upright pose.
  const dx=w*.42,dy=h*.60,bob=Math.sin(t*.0022)*3;
  DIVER_ART?.draw?.(c,dx,dy+bob,27,-.10,-.10,t,{gender:diverGender,moving:true});
  const sx=w*.62,sy=h*.30+Math.cos(t*.002)*5;
  try{drawCreature(sx,sy,Math.max(13,w*.035),-.05,skin.color,'player',t,true,0,c,skin,{visualId:'portrait:'+skinId,moveSpeed:0});}catch(_){}
 }
 if(visiblePortraits>0&&hasVisibleSpecimenPortrait())requestAnimationFrame(renderSpecimenPortraits);else registerSpecimenPortrait.running=false;
}
window.addEventListener('abyssal-profile-specimen-render',event=>{const d=event.detail||{};registerSpecimenPortrait(d.canvas,d.skinId);});
window.addEventListener('abyssal-menu-specimen-canvas',event=>{const d=event.detail||{};registerSpecimenPortrait(d.canvas,equippedSkin);});
const remoteDiverMotion=new Map();
const remoteWeaponInfusions=new Map();
const remoteWeaponParalysis=new Map();
const remoteSpecimenDashes=new Map();
function clearRemoteVisualState(id=null){
 const key=id==null?'':String(id);
 if(key){
  remoteDiverMotion.delete(key);
  remoteWeaponInfusions.delete(key);
  remoteWeaponParalysis.delete(key);
  remoteSpecimenDashes.delete(key);
  remoteCreatureAttackUntil.delete(key);
  return;
 }
 remoteDiverMotion.clear();
 remoteWeaponInfusions.clear();
 remoteWeaponParalysis.clear();
 remoteSpecimenDashes.clear();
 remoteCreatureAttackUntil.clear();
}
window.addEventListener('abyssal-player-left',event=>clearRemoteVisualState(event.detail?.id));
window.addEventListener('abyssal-room-left',()=>clearRemoteVisualState());
window.addEventListener('abyssal-online-disconnected',()=>clearRemoteVisualState());
// Shared sprite atlas for enemy specimens summoned from the shop in Fossas.
// A refresh budget avoids redrawing complex skin anatomy for every hostile each frame.
const OCEAN_SHARK_HEIGHTS=Object.freeze({reefshark:2.8,hammerhead:3,goblin:2.6,frilled:2.1,greenland:3,abysscroc:2.9});
const riftSpecimenSpriteCache=new Map();
let riftSpecimenSpriteFrame=-1,riftSpecimenSpritePaints=0;
function drawRiftShopSpecimen(enemy,skin,time){
 if(riftSpecimenSpriteFrame!==time){riftSpecimenSpriteFrame=time;riftSpecimenSpritePaints=0;}
 const oceanFauna=isOpenSeaRun()&&Boolean(enemy.wildlifeMode),sharkHeight=OCEAN_SHARK_HEIGHTS[skin.id]||0;
 const normalRadius=CREATURE_SCALE?.riftVisualRadius?.(enemy.kind,Number(enemy.r)||8,skin.id)||CREATURE_SCALE?.monsterVisualRadius?.(enemy.kind,Number(enemy.r)||8,skin.id)||Math.max(4,Number(enemy.r)||8);
 // Preserve shop skin identity and a species-specific 3 m maximum visual body envelope.
 const radius=oceanFauna?(sharkHeight?16+sharkHeight*9:Math.min(79,CREATURE_SCALE?.monsterVisualRadius?.(enemy.kind,Number(enemy.r)||8,skin.id)||normalRadius)):normalRadius;
 // Render at the actual display density; oversized creatures use the vector fallback.
 const bucket=Math.max(4,Math.round(radius*2)/2);
 const renderScale=radius/bucket;
 const side=Math.ceil(bucket*8),density=Math.max(1,Math.ceil(dpr*worldZoom*renderScale*1.25)),pixels=Math.ceil(side*density);
 const key=skin.id+'|'+bucket+'|'+density;
 if(pixels*pixels>MAX_SINGLE_SPRITE_PIXELS||pixels>4096){drawCreature(enemy.x,enemy.y,radius,Number(enemy.angle)||0,skin.color,'player',time,true,enemy.hit||0,ctx,skin,enemy);return;}
 let sprite=getCachedSprite(riftSpecimenSpriteCache,key);
 if(!sprite){
  const canvas=document.createElement('canvas');canvas.width=pixels;canvas.height=pixels;
  sprite={canvas,c:canvas.getContext('2d'),side,lastPaint:-Infinity};sprite.c.setTransform(density,0,0,density,0,0);
  rememberCachedSprite(riftSpecimenSpriteCache,key,sprite,96);
 }
 const stale=time-sprite.lastPaint>=83;
 if(stale&&(sprite.lastPaint===-Infinity||riftSpecimenSpritePaints<3)){
  sprite.c.clearRect(0,0,sprite.side,sprite.side);
  drawCreature(sprite.side*.5,sprite.side*.5,bucket,0,skin.color,'player',time,true,0,sprite.c,skin,{__sprite:true,phase:Number(enemy.phase)||0});
  sprite.lastPaint=time;riftSpecimenSpritePaints++;
 }
 ctx.save();ctx.translate(enemy.x,enemy.y);ctx.rotate(Number(enemy.angle)||0);
 let organicSeed=0;for(const ch of String(enemy.streamId||enemy.id||skin.id))organicSeed=(Math.imul(organicSeed,33)+ch.charCodeAt(0))>>>0;
 const organicX=.96+(organicSeed%9)*.01,organicY=.94+((organicSeed>>>5)%13)*.01,organicShear=((organicSeed>>>11)%9-4)*.006;
 ctx.transform(renderScale*organicX,organicShear,organicShear*.45,renderScale*organicY,0,0);
 if(oceanFauna&&sharkHeight){
   // Menacing contrast, preserving the exact specimen-shop silhouette and palette.
   ctx.shadowColor=enemy.aiIndicator==='attack'?'#b72a34':'#273c52';
   ctx.shadowBlur=enemy.aiIndicator==='attack'?bucket*.48:bucket*.17;
  }
  ctx.drawImage(sprite.canvas,-sprite.side*.5,-sprite.side*.5,sprite.side,sprite.side);
  ctx.shadowBlur=0;
 if(enemy.hit>0){ctx.globalAlpha=Math.min(.38,Number(enemy.hit)*2);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,bucket*.65,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}
function drawSpecimenBite(pet,angle,bite,q){
 const size=Math.max(7,bite.reach*.38),open=q<.22?q/.22:Math.max(0,1-(q-.22)/.42),gap=size*(.12+.68*open);
 ctx.save();ctx.translate(pet.x+Math.cos(angle)*bite.reach,pet.y+Math.sin(angle)*bite.reach);ctx.rotate(angle+Math.PI/2);
 ctx.globalAlpha=q<.75?1:1-(q-.75)/.25;ctx.shadowBlur=lowPowerRendering?0:5;ctx.shadowColor='#ff8396';
 for(const side of [-1,1]){
  ctx.strokeStyle='#e5b0ad';ctx.lineWidth=Math.max(1.2,size*.12);ctx.beginPath();ctx.moveTo(-size*.85,side*gap);ctx.quadraticCurveTo(0,side*(gap+size*.22),size*.85,side*gap);ctx.stroke();
  ctx.fillStyle='#fff2db';for(let i=0;i<5;i++){const x=(-.68+i*.34)*size;ctx.beginPath();ctx.moveTo(x-size*.12,side*(gap+size*.04));ctx.lineTo(x+size*.12,side*(gap+size*.04));ctx.lineTo(x,side*(gap-size*.31));ctx.closePath();ctx.fill();}
 }
 ctx.restore();
}
function drawSoloWelding(x,y,r,aim,job,t){
 const p=job.point,scale=r*(DIVER_ART?.DRAW_SCALE||.60)/14,tip=DIVER_ART?.WELDER_TIP_X||57;
 const mx=x+Math.cos(aim)*tip*scale-Math.sin(aim)*5*scale,my=y+Math.sin(aim)*tip*scale+Math.cos(aim)*5*scale;
 const time=Number(t)||0,q=Math.max(0,Math.min(1,job.elapsed/submarineRepairSeconds())),flicker=.72+.28*Math.sin(time*.043);
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 // The welder emits a short electric arc and molten sparks at the hull,
 // anchored to the real repair point rather than to the player sprite.
 ctx.globalAlpha=flicker;ctx.strokeStyle='#4be9ff';ctx.lineWidth=2.5/GAME_WORLD_ZOOM;ctx.shadowColor='#4be9ff';ctx.shadowBlur=lowPowerRendering?0:12/GAME_WORLD_ZOOM;
 ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo((mx+p.x)*.5+Math.sin(time*.07)*2/GAME_WORLD_ZOOM,(my+p.y)*.5+Math.cos(time*.06)*2/GAME_WORLD_ZOOM);ctx.lineTo(p.x,p.y);ctx.stroke();
 ctx.globalAlpha=1;ctx.fillStyle='#eaffff';ctx.beginPath();ctx.arc(p.x,p.y,(2.3+flicker*2)/GAME_WORLD_ZOOM,0,Math.PI*2);ctx.fill();
 ctx.shadowBlur=0;
 for(let i=0;i<(lowPowerRendering?5:10);i++){
  const life=(time*.0017+i*.173)%1,a=aim+Math.PI+(i%5-2)*.42,reach=(4+life*(18+i%3*7))/GAME_WORLD_ZOOM;
  const px=p.x+Math.cos(a)*reach,py=p.y+Math.sin(a)*reach+life*life*8/GAME_WORLD_ZOOM;
  ctx.globalAlpha=(1-life)*.92;ctx.strokeStyle=i%3?'#ffbb55':'#bffbff';ctx.lineWidth=(i%2?1.1:1.7)/GAME_WORLD_ZOOM;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-Math.cos(a)*4/GAME_WORLD_ZOOM,py-Math.sin(a)*4/GAME_WORLD_ZOOM);ctx.stroke();
 }
 ctx.globalAlpha=1;const w=78/GAME_WORLD_ZOOM,h=5/GAME_WORLD_ZOOM,bx=x-w*.5,by=y-r*2.25-15/GAME_WORLD_ZOOM;
 ctx.fillStyle='rgba(5,19,29,.85)';ctx.fillRect(bx,by,w,h);ctx.fillStyle='#54eaff';ctx.fillRect(bx,by,w*q,h);
 ctx.strokeStyle='#9cecf7';ctx.lineWidth=1/GAME_WORLD_ZOOM;ctx.strokeRect(bx,by,w,h);
 ctx.fillStyle='#e8fbff';ctx.font='bold '+10/GAME_WORLD_ZOOM+'px sans-serif';ctx.textAlign='center';ctx.fillText('SOLDANDO · '+Math.ceil(submarineRepairSeconds()-job.elapsed)+'s',x,by-4/GAME_WORLD_ZOOM);ctx.restore();
}
function drawDiver(x,y,r,angle=0,t=0,remote=false,aim=angle,gender=diverGender,heldItem='abyssWeapon'){
 const weld=!remote&&isClassicCavernRun()?soloSubmarine.repair:null;
 if(weld){angle=aim=Math.atan2(weld.point.y-y,weld.point.x-x);heldItem='abyssWelder';}
 if(DIVER_ART?.draw){
  DIVER_ART.draw(ctx,x,y,r,angle,aim,t,{gender,remote,moving:!weld,heldItem,helmetLamp:!remote&&isOpenSeaRun(),swing:!remote&&isOpenSeaRun()?(Number(window.AbyssalExplorationToolState?.swing)||0):0,fillProgress:!remote&&isOpenSeaRun()?(Number(window.AbyssalExplorationToolState?.progress)||0):0,fillType:!remote&&isOpenSeaRun()?(window.AbyssalExplorationToolState?.node?.type||''):''});
  if(weld)drawSoloWelding(x,y,r,aim,weld,t);
  return;
 }
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='#1599de';ctx.beginPath();ctx.ellipse(0,0,r*1.7,r*.65,0,0,Math.PI*2);ctx.fill();ctx.restore();if(weld)drawSoloWelding(x,y,r,aim,weld,t);
}

function draw(t){
 if(hostileSpritePaintFrame!==t){hostileSpritePaintFrame=t;hostileSpritePaintsThisFrame=0;}
 // Only the current ocean menu owns menu rendering; do not paint the old canvas background.
 if(gameState==='menu')return;
 updateCamera();ctx.setTransform(dpr*worldZoom,0,0,dpr*worldZoom,0,0);ctx.save();if(shake>0)ctx.translate(rand(-shake,shake),rand(-shake,shake));ctx.translate(-cameraX,-cameraY);drawBackground(t);
 if(!activeMapLayout)drawArenaTerrain(t);
 if(isClassicCavernRun())drawSoloSubmarine(t);
 drawExperienceOrbs(t);
 if(activeMapLayout&&RIFT_HARDCORE){const nightmareAliveForRender=activeMapTier===(RIFT_HARDCORE?.FINAL_TIER??7)&&enemies.some(enemy=>enemy.kind===RIFT_HARDCORE.FINAL_KIND&&enemy.hp>0);const visibleHazards=nightmareAliveForRender?activeRiftHazards:activeRiftHazards.filter(h=>h.type!=='tentacle');RIFT_HARDCORE.draw(ctx,visibleHazards,elapsed,{x:cameraX,y:cameraY,w:viewW/worldZoom,h:viewH/worldZoom});
  const now=performance.now();riftBossMarks=riftBossMarks.filter(m=>now<(m.impactUntil||m.hitAt+420));
  for(const mark of riftBossMarks)RIFT_HARDCORE.drawBossMark(ctx,mark,now,Boolean(mark.impactUntil&&now<mark.impactUntil));
 }
 for(const p of projectiles){if(p.x<cameraX-70/worldZoom||p.x>cameraX+viewW/worldZoom+70/worldZoom||p.y<cameraY-70/worldZoom||p.y>cameraY+viewH/worldZoom+70/worldZoom)continue;ctx.save();const trail=p.allyShot?'#9bbcff':(p.special==='pierce'?'#ffd36b':p.special==='ricochet'?'#ffad55':p.special==='electric'?'#45e9ff':p.special==='photon'?'#ff8df4':p.color);ctx.strokeStyle=trail;ctx.lineCap='round';ctx.lineWidth=p.special==='pierce'?Math.max(3,p.r*1.25):p.allyShot?5.5:p.special==='electric'?Math.max(2.2,p.r*.72):p.special==='photon'?Math.max(2,p.r*.75):p.r*1.55;ctx.shadowBlur=lowPowerRendering?0:(p.special?13:p.allyShot?12:7);ctx.shadowColor=trail;const trailScale=p.special==='photon'?.035:p.special==='pierce'?.105:p.special==='electric'?.04:.045;ctx.beginPath();ctx.moveTo(p.x-p.vx*trailScale,p.y-p.vy*trailScale);ctx.lineTo(p.x,p.y);ctx.stroke();if(p.special==='electric'){const speed=Math.hypot(p.vx,p.vy)||1,ux=p.vx/speed,uy=p.vy/speed,nx=-uy,ny=ux,phase=(p.travelled||0)*.095,boltLength=Math.max(52/GAME_WORLD_ZOOM,speed*.095);ctx.strokeStyle='rgba(220,255,255,.98)';ctx.lineWidth=Math.max(1.5/GAME_WORLD_ZOOM,p.r*.48);ctx.beginPath();const segments=12;for(let s=0;s<=segments;s++){const q=s/segments,back=boltLength*(1-q),edge=Math.sin(Math.PI*q),bend=(Math.sin(phase+s*2.7)*5.5+Math.sin(phase*.57+s*5.1)*2.3)*edge/GAME_WORLD_ZOOM,xx=p.x-ux*back+nx*bend,yy=p.y-uy*back+ny*bend;if(s===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}ctx.stroke();ctx.strokeStyle='rgba(69,233,255,.72)';ctx.lineWidth=Math.max(3/GAME_WORLD_ZOOM,p.r*.9);ctx.globalAlpha*=.45;ctx.stroke();ctx.globalAlpha/=.45;ctx.fillStyle='#f7ffff';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1.6/GAME_WORLD_ZOOM,p.r*.42),0,Math.PI*2);ctx.fill();}else if(p.special==='pierce'){const pa=Math.atan2(p.vy,p.vx),ux=Math.cos(pa),uy=Math.sin(pa),nx=-uy,ny=ux;ctx.fillStyle='#fff0a8';ctx.beginPath();ctx.moveTo(p.x+ux*p.r*2.4,p.y+uy*p.r*2.4);ctx.lineTo(p.x-ux*p.r*.9+nx*p.r*.82,p.y-uy*p.r*.9+ny*p.r*.82);ctx.lineTo(p.x-ux*p.r*1.7,p.y-uy*p.r*1.7);ctx.lineTo(p.x-ux*p.r*.9-nx*p.r*.82,p.y-uy*p.r*.9-ny*p.r*.82);ctx.closePath();ctx.fill();ctx.strokeStyle='#b87825';ctx.lineWidth=1/worldZoom;ctx.stroke();}else if(p.special==='photon'){const pa=Math.atan2(p.vy,p.vx);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.ellipse(p.x,p.y,p.r*1.9,p.r*.46,pa,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ff8df4';ctx.lineWidth=1/worldZoom;ctx.beginPath();ctx.moveTo(p.x-Math.cos(pa)*p.r*3.4,p.y-Math.sin(pa)*p.r*3.4);ctx.lineTo(p.x+Math.cos(pa)*p.r*1.7,p.y+Math.sin(pa)*p.r*1.7);ctx.stroke();}else{ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
 if(p.allyShot){ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.x-p.vx*.018,p.y-p.vy*.018);ctx.lineTo(p.x+rand(-3,3),p.y+rand(-3,3));ctx.lineTo(p.x,p.y);ctx.stroke()}
 ctx.restore()}
  // Shark bubbles remain luminous blue; blue-ring octopus pressure bubbles
  // now use the same specular shape with black bodies and steel-blue rims.
  // Keep silhouettes small and non-opaque so enemies remain visible.
  function renderWakeBubble(blob,dark){
   const bound=dark?80:40;
   if(blob.x<cameraX-bound/worldZoom||blob.x>cameraX+viewW/worldZoom+bound/worldZoom||
      blob.y<cameraY-bound/worldZoom||blob.y>cameraY+viewH/worldZoom+bound/worldZoom)return;
   const maxLife=Math.max(.1,Number(blob.maxLife)||(dark?4:5));
   const ratio=clamp(Number(blob.life)/maxLife,0,1);
   if(ratio<=0)return;
   const rad=blob.r*(.64+.33*(1-ratio))*((dark&&blob.boss)?0.56:1);
   ctx.save();
   ctx.globalAlpha=ratio*(dark?.94:.52);
   ctx.shadowBlur=lowPowerRendering?0:(dark?5:7)/GAME_WORLD_ZOOM;
   ctx.shadowColor=dark?'#8490ae':'#7bf5ff';
   ctx.fillStyle=dark?'rgba(2,3,9,.97)':'rgba(123,245,255,.22)';
   ctx.strokeStyle=dark?'#8f9eb5':'#a6f7ff';
   ctx.lineWidth=Math.max(.8,(dark?1.8:1.5)/GAME_WORLD_ZOOM);
   ctx.beginPath();ctx.arc(blob.x,blob.y,rad,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.shadowBlur=0;
   ctx.globalAlpha=ratio*(dark?.85:.75);
   ctx.strokeStyle=dark?'#b2bdce':'#efffff';
   ctx.lineWidth=Math.max(.6,1.25/GAME_WORLD_ZOOM);
   ctx.beginPath();ctx.arc(blob.x-rad*.08,blob.y-rad*.05,rad*.73,Math.PI*1.13,Math.PI*1.66);ctx.stroke();
   ctx.fillStyle=dark?'#c6cede':'#ffffff';
   ctx.beginPath();ctx.arc(blob.x-rad*.25,blob.y-rad*.28,Math.max(1.1/GAME_WORLD_ZOOM,rad*.13),0,Math.PI*2);ctx.fill();
   if(dark){
    ctx.globalAlpha=ratio*.57;
    for(let j=0;j<2;j++){
     const bx=blob.x+rad*(j===0?1.04:-.86),by=blob.y+rad*(j===0?-.48:.79),sr=rad*(j===0?.25:.16);
     ctx.fillStyle='#05070e';ctx.strokeStyle='#8791a7';
     ctx.beginPath();ctx.arc(bx,by,sr,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
   }
   ctx.restore();
  }
  for(const b of sharkWakeTrails)renderWakeBubble(b,b.ink===true);
  for(const ink of inkTrails)renderWakeBubble(ink,true);

  for(const fx of effects){ctx.save();const progress=1-fx.life/fx.maxLife;ctx.globalAlpha=fx.type==='photon-ray'?clamp(fx.life/.065,0,1):clamp(fx.life/fx.maxLife,0,1);ctx.strokeStyle=fx.color;ctx.shadowBlur=lowPowerRendering?0:10;ctx.shadowColor=fx.color;ctx.lineWidth=fx.type==='ring'?4:(Number(fx.width)||3);let photonX2=fx.x2,photonY2=fx.y2;if(fx.type==='photon-ray'&&onlineRoomMode==='pvp'&&projectileHitsPvpWall(fx.x1,fx.y1,photonX2,photonY2,Math.max(1,Number(fx.width)||3))){let lo=0,hi=1;for(let step=0;step<9;step++){const mid=(lo+hi)*.5;if(projectileHitsPvpWall(fx.x1,fx.y1,fx.x1+(fx.x2-fx.x1)*mid,fx.y1+(fx.y2-fx.y1)*mid,Math.max(1,Number(fx.width)||3)))hi=mid;else lo=mid;}photonX2=fx.x1+(fx.x2-fx.x1)*lo;photonY2=fx.y1+(fx.y2-fx.y1)*lo;}ctx.beginPath();if(fx.type==='occluded-ring'){
 const radius=fx.max*progress,segments=360;let previous=null;
 for(let s=0;s<=segments;s++){const a=s/segments*Math.PI*2,ex=fx.x+Math.cos(a)*radius,ey=fx.y+Math.sin(a)*radius,blocked=projectileHitsPvpWall(fx.x,fx.y,ex,ey,2/GAME_WORLD_ZOOM);if(blocked){previous=null;continue;}if(!previous){ctx.moveTo(ex,ey);previous={x:ex,y:ey};continue;}const edgeBlocked=projectileHitsPvpWall(previous.x,previous.y,ex,ey,2/GAME_WORLD_ZOOM);if(edgeBlocked){ctx.moveTo(ex,ey);}else ctx.lineTo(ex,ey);previous={x:ex,y:ey};}
}else if(fx.type==='specimen-pulse-wave'){
 const radius=fx.max*progress;
 ctx.globalAlpha*=.92;ctx.lineWidth=5/GAME_WORLD_ZOOM;ctx.strokeStyle=fx.color||'#b86cff';ctx.shadowBlur=18/GAME_WORLD_ZOOM;
 for(const factor of [1,.84,.68]){ctx.beginPath();ctx.arc(fx.x,fx.y,radius*factor,0,Math.PI*2);ctx.globalAlpha*=factor===1?1:.72;ctx.stroke();}
 ctx.beginPath();
}else if(fx.type==='poison-plant-cloud'){
 // Same visual vocabulary as the toxic plant in the Fossas: expanding,
 // asymmetric watery smoke, connected irregular front, drifting spores.
 const grow=Math.min(1,Math.max(0,progress/.72)),rr=fx.max*(.06+.94*(1-Math.pow(1-grow,2)));
 const shapeCount=36,seed=Number(fx.seed)||0;
 ctx.globalAlpha*=.62+.2*Math.sin(progress*Math.PI);
 ctx.fillStyle=ctx.createRadialGradient(fx.x,fx.y,rr*.05,fx.x,fx.y,Math.max(rr,1));
 const cloudGradient=ctx.fillStyle;
 cloudGradient.addColorStop(0,'rgba(116,226,107,.30)');
 cloudGradient.addColorStop(.33,'rgba(83,198,116,.23)');
 cloudGradient.addColorStop(.76,'rgba(49,151,128,.17)');
 cloudGradient.addColorStop(1,'rgba(45,134,127,.06)');
 ctx.fillStyle=cloudGradient;
 ctx.beginPath();
 for(let i=0;i<=shapeCount;i++){
  const a=i*Math.PI*2/shapeCount,variation=.84+.10*Math.sin(a*5+seed*.01)+.07*Math.cos(a*9-seed*.03);
  const wave=.96+.04*Math.sin(a*7+performance.now()*.0009);
  const x=fx.x+Math.cos(a)*rr*variation*wave,y=fx.y+Math.sin(a)*rr*variation*wave;
  if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
 }
 ctx.closePath();ctx.fill();
 ctx.strokeStyle='rgba(145,244,122,.16)';ctx.lineWidth=1.9/GAME_WORLD_ZOOM;ctx.stroke();
 for(let i=0;i<(lowPowerRendering?12:24);i++){
  const a=i*2.399+seed*.02,rad=rr*(.2+((i*7)%17)/23);
  const x=fx.x+Math.cos(a)*rad+Math.sin(performance.now()*.0007+i)*3/GAME_WORLD_ZOOM;
  const y=fx.y+Math.sin(a)*rad+Math.cos(performance.now()*.0009+i*2)*3/GAME_WORLD_ZOOM;
  ctx.fillStyle=i%3?'rgba(117,219,149,.48)':'rgba(195,252,140,.55)';
  ctx.beginPath();ctx.ellipse(x,y,(2+i%4)/GAME_WORLD_ZOOM,(2+i%3)/GAME_WORLD_ZOOM,a,0,Math.PI*2);ctx.fill();
 }
 ctx.beginPath();
 }else if(fx.type==='specimen-shield-bubble'){
 let diver=player,companion=player?.specimen;
 if(!fx.local&&fx.ownerId){
  const peer=window.AbyssalOnline?.getPlayerById?.(fx.ownerId);
  diver=peer||null;companion=peer?{x:Number(peer.specimenX)||Number(peer.x),y:Number(peer.specimenY)||Number(peer.y)}:null;
 }
 if(diver&&companion){
  const mx=(Number(diver.x)+Number(companion.x))/2,my=(Number(diver.y)+Number(companion.y))/2;
  const width=Math.hypot(Number(diver.x)-Number(companion.x),Number(diver.y)-Number(companion.y))*.5+Math.max(32/GAME_WORLD_ZOOM,(Number(diver.r)||13/GAME_WORLD_ZOOM)*2.5);
  const height=width*.91,phase=1-fx.life/fx.maxLife;
  ctx.globalAlpha*=.7;ctx.shadowBlur=lowPowerRendering?0:13/GAME_WORLD_ZOOM;
  ctx.shadowColor='#8ff4e8';ctx.fillStyle='rgba(99,240,231,.10)';
  ctx.strokeStyle='rgba(190,255,250,.59)';ctx.lineWidth=2/GAME_WORLD_ZOOM;
  ctx.beginPath();ctx.ellipse(mx,my,width*(.94+.06*Math.sin(phase*7)),height*(.95+.05*Math.cos(phase*6)),0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;ctx.beginPath();
 }
 }else if(fx.type==='gravity-cone'){
 const angle=Number(fx.angle)||0,half=window.AbyssalGravityCone?.HALF_ANGLE||Math.PI/4;
 const reach=fx.max*(.22+.78*progress);
 ctx.globalAlpha*=.68;ctx.fillStyle='rgba(100,89,229,.20)';
 ctx.moveTo(fx.x,fx.y);
 for(const point of fx.fan||[]){
  const d=Math.min(reach,point.radius);
  ctx.lineTo(fx.x+Math.cos(point.angle)*d,fx.y+Math.sin(point.angle)*d);
 }
 ctx.closePath();ctx.fill();ctx.stroke();
 ctx.strokeStyle='#b9b0ff';ctx.lineWidth=2.5/GAME_WORLD_ZOOM;
 ctx.beginPath();
 for(const [index,point] of (fx.fan||[]).entries()){
  const d=Math.min(reach,point.radius),px=fx.x+Math.cos(point.angle)*d,py=fx.y+Math.sin(point.angle)*d;
  if(index===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
 }
 ctx.stroke();ctx.beginPath();
 }else if(fx.type==='skin-shot-telegraph'){
 ctx.strokeStyle=fx.color||'#ff3f59';ctx.globalAlpha*=.48+.35*Math.sin(performance.now()*.025);ctx.setLineDash([10/GAME_WORLD_ZOOM,8/GAME_WORLD_ZOOM]);ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(fx.x2,fx.y2);ctx.setLineDash([]);
 }else if(fx.type==='tentacle-strike'){
 const dx=fx.x2-fx.x1,dy=fx.y2-fx.y1,d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d,reach=Math.sin(Math.PI*Math.min(1,progress*1.25)),curve=d*.22*Math.sin(progress*Math.PI);
 ctx.lineCap='round';ctx.lineWidth=fx.width||4;ctx.moveTo(fx.x1,fx.y1);ctx.bezierCurveTo(fx.x1+dx*.25+nx*curve,fx.y1+dy*.25+ny*curve,fx.x1+dx*.75-nx*curve,fx.y1+dy*.75-ny*curve,fx.x1+dx*reach,fx.y1+dy*reach);
 }else if(fx.type==='bite-jaws'){
 const size=fx.max,closing=Math.min(1,progress*2.8),gap=size*(.75-.62*closing);ctx.translate(fx.x,fx.y);ctx.rotate(fx.angle||0);ctx.globalAlpha=progress<.7?1:Math.max(0,(1-progress)/.3);ctx.shadowColor='#ff5a78';ctx.shadowBlur=lowPowerRendering?0:9;
 for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-size*.8,side*gap);ctx.quadraticCurveTo(0,side*(gap+size*.30),size*.8,side*gap);ctx.strokeStyle='#ff7388';ctx.lineWidth=3/GAME_WORLD_ZOOM;ctx.stroke();ctx.fillStyle='#fff0df';for(let n=0;n<5;n++){const xx=-size*.65+n*size*.325;ctx.beginPath();ctx.moveTo(xx-size*.13,side*(gap+size*.08));ctx.lineTo(xx+size*.13,side*(gap+size*.08));ctx.lineTo(xx,side*(gap-size*.30));ctx.closePath();ctx.fill();}}
 ctx.beginPath();
 }else if(fx.type==='projectile-dissolve'){ctx.globalAlpha*=Math.max(0,1-progress);ctx.arc(fx.x,fx.y,fx.max*progress,0,Math.PI*2);}else if(fx.type==='nova-core'){ctx.globalAlpha*=Math.max(0,1-progress);ctx.fillStyle=fx.color||'#72f5ff';ctx.beginPath();ctx.arc(fx.x,fx.y,Math.max(4/GAME_WORLD_ZOOM,fx.max*progress),0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(fx.x,fx.y,fx.max*progress,0,Math.PI*2)}else if(fx.type==='ring'||fx.type==='regen-pulse'){ctx.arc(fx.x,fx.y,fx.max*progress,0,Math.PI*2)}else if(fx.type==='ward-collapse'){ctx.arc(fx.x,fx.y,fx.max*(1-progress*.72),0,Math.PI*2)}else if(fx.type==='electric-arc'){const dx=fx.x2-fx.x1,dy=fx.y2-fx.y1,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,segments=13;for(let s=0;s<=segments;s++){const q=s/segments,edge=q===0||q===1?0:1,wave=(Math.sin((Number(fx.seed)||0)*.23+s*3.7)+Math.sin((Number(fx.seed)||0)*.11+s*7.1)*.55)*Math.min(18/worldZoom,len*.095)*edge,xx=fx.x1+dx*q+nx*wave,yy=fx.y1+dy*q+ny*wave;if(s===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}}else if(fx.type==='ricochet-line'){ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(fx.x2,fx.y2);}else{ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(fx.type==='photon-ray'?photonX2:fx.x2,fx.type==='photon-ray'?photonY2:fx.y2)}ctx.stroke();if(fx.type==='ricochet-line'){ctx.globalAlpha*=.88;ctx.strokeStyle='#fff86a';ctx.shadowBlur=lowPowerRendering?0:16/GAME_WORLD_ZOOM;ctx.shadowColor='#f7ff19';ctx.lineWidth=Math.max(1/GAME_WORLD_ZOOM,(Number(fx.width)||3.4)*.42);ctx.stroke();}if(fx.type==='electric-arc'){ctx.globalAlpha*=.9;ctx.strokeStyle='#eaffff';ctx.shadowBlur=lowPowerRendering?5/GAME_WORLD_ZOOM:20/GAME_WORLD_ZOOM;ctx.shadowColor='#31eaff';ctx.lineWidth=Math.max(1.2/GAME_WORLD_ZOOM,(Number(fx.width)||4.2)*.4);ctx.stroke();}if(fx.type==='photon-ray'){ctx.strokeStyle='#ffffff';ctx.shadowBlur=0;ctx.lineWidth=Math.max(.8,(Number(fx.width)||3)*.32);ctx.beginPath();ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(photonX2,photonY2);ctx.stroke()}ctx.restore()}
 for(const pool of bloodPools){
  const q=clamp(pool.life/pool.maxLife,0,1),grow=1+(1-q)*.18;
  ctx.save();ctx.translate(pool.x,pool.y);ctx.rotate(pool.angle||0);ctx.globalAlpha=q*.56;ctx.fillStyle='#8f1028';ctx.shadowBlur=(lowPowerRendering?3:16)/worldZoom;ctx.shadowColor='rgba(151,8,39,.68)';
  ctx.beginPath();const lobes=pool.lobes||[];for(let i=0;i<lobes.length;i++){const l=lobes[i],px=Math.cos(l.a)*l.reach*grow,py=Math.sin(l.a)*l.reach*.68*grow;if(i===0)ctx.moveTo(px,py);else{const prev=lobes[i-1],cx=Math.cos((prev.a+l.a)/2)*pool.r*.55,cy=Math.sin((prev.a+l.a)/2)*pool.r*.38;ctx.quadraticCurveTo(cx,cy,px,py);}}ctx.closePath();ctx.fill();
  ctx.globalAlpha=q*.34;ctx.fillStyle='#c4213c';for(const l of lobes){ctx.beginPath();ctx.ellipse(Math.cos(l.a)*l.reach*.62,Math.sin(l.a)*l.reach*.42,l.width*1.2,l.width*.55,l.a,0,Math.PI*2);ctx.fill();}
  for(const d of pool.droplets||[]){ctx.globalAlpha=q*(.28+Math.min(.28,d.r/pool.r));ctx.beginPath();ctx.ellipse(Math.cos(d.a)*d.d,Math.sin(d.a)*d.d,d.r*d.stretch,d.r,d.a,0,Math.PI*2);ctx.fill();}
  ctx.restore();
 }

 for(const e of enemies){if(!onlineMode&&e.interpDuration>0&&Number.isFinite(e.interpAt)){const ip=clamp((performance.now()-e.interpAt)/e.interpDuration,0,1);e.x=e.interpFromX+(e.interpTargetX-e.interpFromX)*ip;e.y=e.interpFromY+(e.interpTargetY-e.interpFromY)*ip;}else if(!onlineMode&&Number.isFinite(e.interpTargetX)){e.x=e.interpTargetX;e.y=e.interpTargetY;}const renderRadius=activeMapLayout?(CREATURE_SCALE?.riftVisualRadius?.(e.kind,e.r,e.specimenSkinId)||CREATURE_SCALE?.monsterVisualRadius?.(e.kind,e.r,e.specimenSkinId)||e.r):(CREATURE_SCALE?.monsterVisualRadius?.(e.kind,e.r,e.specimenSkinId)||e.r);const renderPad=Math.max(e.r,renderRadius)*1.42*(e.kind==='kraken'?2.8:e.kind==='boss'?2.75:e.kind==='devourer'?2.55:e.kind==='leviathan'?3.45:e.kind==='maw'?3.65:e.kind==='lurker'?2.55:BOSS_KINDS.includes(e.kind)?2.15:1.85);if(e.x+renderPad<cameraX||e.x-renderPad>cameraX+viewW/worldZoom||e.y+renderPad<cameraY||e.y-renderPad>cameraY+viewH/worldZoom)continue;const anglerConcealed=e.kind==='angler'&&anglerVisibilityAlpha(Date.now())<=.001;if((e.discoverySkinId||e.specimenSkinId)&&!anglerConcealed&&player&&onlineRoomMode!=='pvp'&&Math.hypot(e.x-player.x,e.y-player.y)<440/GAME_WORLD_ZOOM
   &&(!activeMapLayout||!ABYSSAL_MAP?.segmentWalkable||ABYSSAL_MAP.segmentWalkable(activeMapLayout,player.x,player.y,e.x,e.y,3/GAME_WORLD_ZOOM))){
   if(!isClassicCavernRun()||!SOLO_CAVERN?.segmentBlocked(arenaRocks,player.x,player.y,e.x,e.y,3/GAME_WORLD_ZOOM))registerSpecimenDiscovery(e.discoverySkinId||e.specimenSkinId);
  }
  if(!anglerConcealed){drawSharkVisionCone(e,t);drawEnemyThreatAura(e,t);}ctx.save();ctx.globalAlpha=activeMapLayout?clamp((Date.now()-(e.spawnedAt||0))/3000,0,1):isOpenSeaRun()&&e.wildlifeMode?(.12+.88*clamp((Date.now()-(Number(e.spawnedAt)||0))/2400,0,1)):1;if(e.specimenSkinId){ /* Shop specimen artwork is also the wild fauna of Mar Aberto. */
   const specimenSkin=skinData.find(s=>s.id===e.specimenSkinId);
   if(specimenSkin)drawRiftShopSpecimen(e,specimenSkin,t);
   else drawCreature(e.x,e.y,(activeMapLayout?CREATURE_SCALE?.riftVisualRadius?.(e.kind,e.r):CREATURE_SCALE?.monsterVisualRadius?.(e.kind,e.r))||e.r,e.angle,e.color,e.kind,t,false,e.hit,ctx,null,e);
  }else drawCreature(e.x,e.y,(activeMapLayout?CREATURE_SCALE?.riftVisualRadius?.(e.kind,e.r):CREATURE_SCALE?.monsterVisualRadius?.(e.kind,e.r))||e.r,e.angle,e.color,e.kind,t,false,e.hit,ctx,null,e);ctx.restore();if(!anglerConcealed&&(!isOpenSeaRun()||!e.wildlifeMode||e.aiIndicator==='attack'))drawHostileSpeciesEffect(e,t);if(!anglerConcealed&&e.hostileBite){const bite=e.hostileBite,q=(performance.now()-bite.startedAt)/bite.duration;if(q>=1)e.hostileBite=null;else if(q>=0)drawSpecimenBite(e,bite.angle,{reach:Math.max(e.r,renderRadius*.65)},q);}
  if(!anglerConcealed&&!activeMapLayout&&e.wildlifeMode){
   const intent=e.aiIndicator;
   if(intent==='attack'){
    const radius=12/GAME_WORLD_ZOOM,px=e.x,py=e.y-Math.max(e.r,renderRadius)-19/GAME_WORLD_ZOOM;
    const color=intent==='attack'?'#e94c55':intent==='flee'?'#48dba2':'#f5f7ff';
    ctx.save();ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=lowPowerRendering?0:10/GAME_WORLD_ZOOM;
    ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold '+(16/GAME_WORLD_ZOOM)+'px Inter,sans-serif';
    ctx.fillStyle=intent==='evaluate'?'#24384b':'#071b28';ctx.fillText(intent==='evaluate'?'?':'!',px,py);ctx.restore();
   }
   const activeUntil=Number(e.wildlifeAbilityUntil)||0;
   if(activeUntil>(onlineMode?performance.now():performance.now())){
    const ability=window.AbyssalSkinStandard?.activeSpec?.(e.specimenSkinId);
    const color=ability?.color||'#76f2e9';
    ctx.save();ctx.globalAlpha=.35+.15*Math.sin(t*.014);ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=lowPowerRendering?0:14/GAME_WORLD_ZOOM;
    ctx.lineWidth=3/GAME_WORLD_ZOOM;ctx.beginPath();ctx.arc(e.x,e.y,Math.max(e.r,renderRadius)*1.25+6/GAME_WORLD_ZOOM,0,Math.PI*2);ctx.stroke();ctx.restore();
   }
  }
  if(e.eliteId&&!anglerConcealed)drawEliteMarker(e,t);
  if(e.kind==='kraken'&&Number(e.krakenTelegraph)>0&&!e.krakenSweepActive){ctx.save();const kr=e.r*(2.85+Number(e.krakenTelegraph)*.85);ctx.strokeStyle='rgba(213,180,255,.92)';ctx.shadowBlur=16/GAME_WORLD_ZOOM;ctx.shadowColor='#9a5cff';ctx.lineWidth=3/GAME_WORLD_ZOOM;ctx.setLineDash([14/GAME_WORLD_ZOOM,7/GAME_WORLD_ZOOM]);ctx.beginPath();ctx.arc(e.x,e.y,kr,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);for(let arm=0;arm<8;arm++){const a=arm*Math.PI/4+t*.00022;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*e.r*.8,e.y+Math.sin(a)*e.r*.8);ctx.lineTo(e.x+Math.cos(a)*kr,e.y+Math.sin(a)*kr);ctx.stroke();}ctx.restore();}
  if(!anglerConcealed&&performance.now()<(Number(e.weaponPoisonUntil)||0)){
   ctx.save();ctx.globalAlpha=.22+.11*Math.sin(t*.008);ctx.fillStyle='#bd56ef';
   for(let i=0;i<6;i++){const a=i*2.399+t*.00055;ctx.beginPath();ctx.arc(e.x+Math.cos(a)*e.r*.9,e.y+Math.sin(a)*e.r*.6-e.r*.4,Math.max(1.5/GAME_WORLD_ZOOM,e.r*.16),0,Math.PI*2);ctx.fill();}
   ctx.restore();
  }
  if (!anglerConcealed && enemyParalyzedNow(e)) {
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
  }if(e.kind==='devourer'&&e.suctionActive)drawDevourerSuction(e,t);if(!(hudCollapsed&&isClassicCavernRun())&&!anglerConcealed&&(e.hp<e.maxHp||BOSS_KINDS.includes(e.kind))){ctx.save();if(isClassicCavernRun())ctx.globalAlpha=.6;ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(e.x-e.r,e.y-e.r-(['boss','leviathan','maw','angler','devourer'].includes(e.kind)?16:8)/worldZoom,e.r*2,(['boss','leviathan','maw','angler','devourer'].includes(e.kind)?6:3)/worldZoom);ctx.fillStyle=e.color;ctx.fillRect(e.x-e.r,e.y-e.r-(['boss','leviathan','maw','angler'].includes(e.kind)?16:8),e.r*2*clamp(e.hp/e.maxHp,0,1),['boss','leviathan','maw','angler'].includes(e.kind)?6:3);if(BOSS_KINDS.includes(e.kind)){ctx.fillStyle='#ffd8e2';ctx.font=`bold ${14/worldZoom}px sans-serif`;ctx.textAlign='center';ctx.fillText(BOSS_LABELS[e.kind]||'BOSS ABISSAL',e.x,e.y-e.r-25/worldZoom)}ctx.restore();}}

 if(!(hudCollapsed&&isClassicCavernRun()))for(const number of damageNumbers){const q=clamp(number.life/number.maxLife,0,1),rise=(1-q)*62;const worldX=number.x+number.driftX*(1-q),worldY=number.y;const screenX=(worldX-cameraX)*worldZoom,screenY=(worldY-cameraY)*worldZoom-rise;ctx.save();/* Damage feedback is HUD-like: render in screen pixels so camera/world scaling can never shrink it. */ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=Math.min(1,q*1.35)*(isClassicCavernRun()?.6:1);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 18px Cinzel, Georgia, serif';ctx.fillStyle=number.tone==='received'?'#ff274a':number.tone==='skin'?'#52ff86':number.tone==='poison'?'#4bff7d':number.tone==='passive'?'#32cfff':'#ff174d';ctx.shadowBlur=3;ctx.shadowColor=ctx.fillStyle;ctx.strokeStyle='rgba(0,0,0,.86)';ctx.lineWidth=1;ctx.strokeText(String(number.value),screenX,screenY);ctx.fillText(String(number.value),screenX,screenY);ctx.restore();}
 const particleShadowBlur=0;let particleDrawIndex=0;for(const p of particles){if(adaptiveQualityLevel===0&&particleDrawIndex++%3!==0)continue;if(adaptiveQualityLevel===1&&particleDrawIndex++%3===2)continue;if(p.x<cameraX-20/worldZoom||p.x>cameraX+viewW/worldZoom+20/worldZoom||p.y<cameraY-20/worldZoom||p.y>cameraY+viewH/worldZoom+20/worldZoom)continue;ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.shadowBlur=particleShadowBlur;ctx.beginPath();const pr=p.r*(.4+.6*p.life/p.max);ctx.arc(p.x,p.y,pr,0,Math.PI*2);if(p.bubble){ctx.fillStyle='rgba(215,250,255,.16)';ctx.fill();ctx.strokeStyle=p.color;ctx.lineWidth=.75/worldZoom;ctx.stroke();if(pr>1.2/worldZoom){ctx.fillStyle='rgba(255,255,255,.65)';ctx.beginPath();ctx.arc(p.x-pr*.32,p.y-pr*.32,pr*.25,0,Math.PI*2);ctx.fill();}}else ctx.fill()}ctx.globalAlpha=1;
 if(player){if((!isClassicCavernRun()||soloSubmarine.spawnFx<=1.25||player.y>=soloSubmarine.y+86/GAME_WORLD_ZOOM)&&(damageFlash<=0||Math.floor(t/60)%2===0)){drawDiver(player.x,player.y,player.r,player.bodyAngle||0,t,false,player.weaponAngle??player.angle??0,diverGender,isOpenSeaRun()?explorationHeldItem:'abyssWeapon');
  if((!isOpenSeaRun()||explorationHeldItem==='abyssWeapon')&&performance.now()<Number(player.skinWeaponBuffUntil||0))drawWeaponInfusion(player.x,player.y,player.r,player.weaponAngle??player.angle??0,t,player.skinWeaponBuffKind);
  if(Date.now()<(Number(player.skinParalyzedUntil)||0)){ctx.save();ctx.strokeStyle='#8ceeff';ctx.lineWidth=2/GAME_WORLD_ZOOM;ctx.shadowColor='#42caff';ctx.shadowBlur=8/GAME_WORLD_ZOOM;for(let j=0;j<5;j++){const a=j*Math.PI*2/5+t*.004,rr=player.r*1.7;ctx.beginPath();ctx.moveTo(player.x+Math.cos(a)*rr*.45,player.y+Math.sin(a)*rr*.45);ctx.lineTo(player.x+Math.cos(a+.26)*rr,player.y+Math.sin(a+.26)*rr);ctx.lineTo(player.x+Math.cos(a)*rr*1.35,player.y+Math.sin(a)*rr*1.35);ctx.stroke();}ctx.restore();}if(player.specimen?.alive!==false){const specimenSkin=skinData.find(s=>s.id===equippedSkin)||skinData[0],sa=player.specimen.facingAngle??player.bodyAngle??0;drawCreature(player.specimen.x,player.specimen.y,CREATURE_SCALE?.visualRadius?.(equippedSkin,player.specimen.r)||player.specimen.r,sa,specimenSkin.color,'player',t,true,0,ctx,specimenSkin,{visualId:onlineMode?'specimen:self':'specimen:solo',moveSpeed:player.moveSpeed,visualAttackUntil:Number(player.specimen.visualAttackUntil)||0,vx:Number(player.specimen.vx)||0,vy:Number(player.specimen.vy)||0,specimenCombatPhase:performance.now()*.0018});
  const bite=player.specimen.biteAnimation;if(bite){const q=clamp((performance.now()-bite.startedAt)/bite.duration,0,1);if(q>=1)player.specimen.biteAnimation=null;else drawSpecimenBite(player.specimen,sa,bite,q);}
  if(player.specimen.dash){const progress=clamp((performance.now()-player.specimen.dash.startedAt)/player.specimen.dash.durationMs,0,1);drawSpecimenDashArc(player.specimen.x,player.specimen.y,player.specimen.r,sa,t,progress);}
  // If the companion crosses the diver, keep the diver in the foreground.
  // This is render order only; attacks and collisions retain true positions.
  const companionR=CREATURE_SCALE?.visualRadius?.(equippedSkin,player.specimen.r)||player.specimen.r;
  if(Math.hypot(player.specimen.x-player.x,player.specimen.y-player.y)<player.r*1.8+companionR*1.7)
    drawDiver(player.x,player.y,player.r,player.bodyAngle||0,t,false,player.weaponAngle??player.angle??0,diverGender,isOpenSeaRun()?explorationHeldItem:'abyssWeapon');
  if(!(hudCollapsed&&isClassicCavernRun())){ctx.save();ctx.globalAlpha=isClassicCavernRun()?.6:.82;ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(player.specimen.x-16/GAME_WORLD_ZOOM,player.specimen.y-(Math.max(22/GAME_WORLD_ZOOM,(CREATURE_SCALE?.visualRadius?.(equippedSkin,player.specimen.r)||player.specimen.r)*1.3)),32/GAME_WORLD_ZOOM,3/GAME_WORLD_ZOOM);ctx.fillStyle='#79f3f0';ctx.fillRect(player.specimen.x-16/GAME_WORLD_ZOOM,player.specimen.y-(Math.max(22/GAME_WORLD_ZOOM,(CREATURE_SCALE?.visualRadius?.(equippedSkin,player.specimen.r)||player.specimen.r)*1.3)),32/GAME_WORLD_ZOOM*clamp(player.specimen.hp/player.specimen.maxHp,0,1),3/GAME_WORLD_ZOOM);ctx.restore();}}}if(upgradeLevels.magnet>0){ctx.save();ctx.globalAlpha=.12+.025*Math.sin(t*.004);ctx.strokeStyle='#a98cff';ctx.lineWidth=1/worldZoom;ctx.setLineDash([3/worldZoom,8/worldZoom]);ctx.beginPath();ctx.arc(player.x,player.y,Math.min(92/GAME_WORLD_ZOOM,26/GAME_WORLD_ZOOM+upgradeLevels.magnet*13/GAME_WORLD_ZOOM),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();}if(upgrades.shell>0){ctx.save();ctx.globalAlpha=.28;ctx.strokeStyle='#90b8b0';ctx.lineWidth=2/worldZoom;const plates=Math.min(6,2+upgrades.shell);for(let i=0;i<plates;i++){const a=t*.00018+i*Math.PI*2/plates,r=player.r*1.7;ctx.beginPath();ctx.arc(player.x+Math.cos(a)*r,player.y+Math.sin(a)*r,3.2/worldZoom,0,Math.PI*2);ctx.stroke();}ctx.restore();}if(upgrades.lastStand>0&&hp/maxHp<=.3){ctx.save();ctx.globalAlpha=.38+.18*Math.sin(t*.014);ctx.strokeStyle='#ff4d6d';ctx.lineWidth=2.3/worldZoom;ctx.beginPath();ctx.arc(player.x,player.y,player.r*1.55,0,Math.PI*2);ctx.stroke();ctx.restore();}if(upgrades.predator>0){ctx.save();ctx.globalAlpha=.15;ctx.strokeStyle='#ff6b78';ctx.lineWidth=1/worldZoom;const marks=Math.min(5,2+upgrades.predator);for(let i=0;i<marks;i++){const a=t*.00032+i*Math.PI*2/marks,r=player.r*1.9;ctx.beginPath();ctx.moveTo(player.x+Math.cos(a)*r,player.y+Math.sin(a)*r);ctx.lineTo(player.x+Math.cos(a)*r*1.13,player.y+Math.sin(a)*r*1.13);ctx.stroke();}ctx.restore();}if(upgrades.shield>0){const chargeCount=Math.min(3,Math.max(0,Math.floor(upgrades.shield)));const shieldPulse=1+Math.sin(t*.008)*.025;ctx.save();ctx.globalAlpha=.18+chargeCount*.045;ctx.fillStyle='#73efff';ctx.strokeStyle='#9cf8ff';ctx.lineWidth=1.8/worldZoom;ctx.shadowBlur=10/worldZoom;ctx.shadowColor='#64eaff';ctx.beginPath();ctx.arc(player.x,player.y,player.r*(2.05+chargeCount*.08)*shieldPulse,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.42+chargeCount*.08;ctx.stroke();ctx.restore();}if(player.invuln>0){ctx.save();const shieldPulse=1+Math.sin(t*.012)*.035;ctx.globalAlpha=.58;ctx.strokeStyle='#8af9ff';ctx.fillStyle='rgba(105,235,255,.09)';ctx.lineWidth=2.2/worldZoom;ctx.shadowBlur=14/worldZoom;ctx.shadowColor='#70f6ff';ctx.beginPath();ctx.arc(player.x,player.y,player.r*1.9*shieldPulse,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}if(!(hudCollapsed&&isClassicCavernRun())){ctx.save();if(isClassicCavernRun())ctx.globalAlpha=.6;ctx.strokeStyle='rgba(126,245,244,.20)';ctx.fillStyle='rgba(126,245,244,.025)';ctx.lineWidth=1;ctx.setLineDash([5,9]);ctx.beginPath();if(!upgrades.abyssEye){ctx.arc(player.x,player.y,getFiringRange(),0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.setLineDash([]);ctx.restore();}if(damageFlash>0){ctx.fillStyle=`rgba(255,65,100,${damageFlash*.45})`;ctx.fillRect(0,0,W,H)}}
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
      const peerVisualId=String(peer.id||peer.socketId||peer.nickname||'diver');
      const previous=remoteDiverMotion.get(peerVisualId)||{x:px,y:py,angle:peer.angle||0,sx:Number.isFinite(Number(peer.specimenX))?Number(peer.specimenX):px,sy:Number.isFinite(Number(peer.specimenY))?Number(peer.specimenY):py-34/GAME_WORLD_ZOOM,lastAt:t};
      const vx=px-previous.x,vy=py-previous.y;
      let heading=previous.angle;
      if(Math.hypot(vx,vy)>.03){const headingTarget=Math.atan2(vy,vx),delta=Math.atan2(Math.sin(headingTarget-heading),Math.cos(headingTarget-heading));heading+=delta*.25;}
      const dtRemote=Math.min(.08,Math.max(0,(t-previous.lastAt)/1000));
      const targetX=Number.isFinite(Number(peer.specimenX))?Number(peer.specimenX):px;
      const targetY=Number.isFinite(Number(peer.specimenY))?Number(peer.specimenY):py-34/GAME_WORLD_ZOOM;
      const sxDelta=targetX-previous.sx,syDelta=targetY-previous.sy,sd=Math.hypot(sxDelta,syDelta);
      const followSpeed=(150/GAME_WORLD_ZOOM)*Math.max(1,Math.min(4,Number(peer.speedStrength)||1));
      const step=Math.min(sd,followSpeed*dtRemote);
      let sx=previous.sx+(sd>.001?sxDelta/sd*step:0),sy=previous.sy+(sd>.001?syDelta/sd*step:0);if(window.AbyssalOnline?.getSpecimenMotion?.(peerVisualId)){sx=Number(peer.specimenX);sy=Number(peer.specimenY);}
      const remoteDash=remoteSpecimenDashes.get(peerVisualId);
      if(remoteDash){
       const progress=clamp((performance.now()-remoteDash.startedAt)/remoteDash.durationMs,0,1);
       sx=remoteDash.x1+(remoteDash.x2-remoteDash.x1)*progress;
       sy=remoteDash.y1+(remoteDash.y2-remoteDash.y1)*progress;
       if(progress>=1)remoteSpecimenDashes.delete(peerVisualId);
      }
      remoteDiverMotion.set(peerVisualId,{x:px,y:py,angle:heading,sx,sy,lastAt:t});
      drawDiver(px,py,12/GAME_WORLD_ZOOM,heading,t,true,peer.angle||heading,peer.diverGender||'male');
      const paralyzedUntil=remoteWeaponParalysis.get(peerVisualId);
      if(paralyzedUntil){if(Date.now()>=paralyzedUntil)remoteWeaponParalysis.delete(peerVisualId);
       else{ctx.save();ctx.translate(px,py);ctx.rotate(t*.005);ctx.strokeStyle='#72eaff';ctx.shadowColor='#62edff';ctx.shadowBlur=8/GAME_WORLD_ZOOM;ctx.lineWidth=2.5/GAME_WORLD_ZOOM;
        for(let j=0;j<4;j++){const a=j*Math.PI*.5,r=21/GAME_WORLD_ZOOM;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.55,Math.sin(a)*r*.55);ctx.lineTo(Math.cos(a+.35)*r,Math.sin(a+.35)*r);ctx.lineTo(Math.cos(a)*r*1.35,Math.sin(a)*r*1.35);ctx.stroke();}ctx.restore();}}
      const remoteBuff=remoteWeaponInfusions.get(peerVisualId);
      if(remoteBuff){if(Date.now()>=remoteBuff.until)remoteWeaponInfusions.delete(peerVisualId);
       else drawWeaponInfusion(px,py,12/GAME_WORLD_ZOOM,peer.angle||heading,t,remoteBuff.kind);}
      if(peer.specimenAlive!==false){
       const peerSkin=window.AbyssalGameHooks?.skinForId?.(peer.skinId),specimenHeading=sd>.1?Math.atan2(syDelta,sxDelta):heading;
       drawCreature(sx,sy,CREATURE_SCALE?.visualRadius?.(peer.skinId,10/GAME_WORLD_ZOOM)||10/GAME_WORLD_ZOOM,specimenHeading,peerSkin?.color||peer.color||'#b8a4ff','peer',t,true,0,ctx,peerSkin,{visualId:'peer-specimen:'+peerVisualId,visualAttackUntil:remoteCreatureAttackUntil.get(peerVisualId)||0,moveSpeed:followSpeed});
       if(Math.hypot(sx-px,sy-py)<32/GAME_WORLD_ZOOM+(CREATURE_SCALE?.visualRadius?.(peer.skinId,10/GAME_WORLD_ZOOM)||10/GAME_WORLD_ZOOM)*1.7)
         drawDiver(px,py,12/GAME_WORLD_ZOOM,heading,t,true,peer.angle||heading,peer.diverGender||'male');
       if(remoteDash)drawSpecimenDashArc(sx,sy,10/GAME_WORLD_ZOOM,remoteDash.angle,t,clamp((performance.now()-remoteDash.startedAt)/remoteDash.durationMs,0,1));
      }
      const title=PROFILE_TITLE_NAMES[peer.titleId]||'';
      ctx.save();ctx.textAlign='center';ctx.textBaseline='alphabetic';
      if(title){ctx.font=`800 ${12/worldZoom}px Manrope`;ctx.fillStyle=PROFILE_TITLE_COLORS[peer.titleId]||'#79f3f0';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8/worldZoom;ctx.fillText(title,px,py-34/worldZoom);}
      ctx.shadowBlur=peer.isDeveloper?14/worldZoom:0;ctx.shadowColor=peer.isDeveloper?'#ff1744':'transparent';ctx.fillStyle=peer.isDeveloper?'#ff304f':'#d8ffff';ctx.font=`${peer.isDeveloper?900:700} ${14/worldZoom}px Manrope`;ctx.fillText(peer.nickname||'Mergulhador',px,py-18/worldZoom);ctx.restore();
    });
    const self=window.AbyssalOnline?.getAccount?.()||{};
    const selfTitle=PROFILE_TITLE_NAMES[self.equippedTitle]||'';
    ctx.save();ctx.textAlign='center';
    if(selfTitle){ctx.font=`800 ${12/worldZoom}px Manrope`;ctx.fillStyle=PROFILE_TITLE_COLORS[self.equippedTitle]||'#79f3f0';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8/worldZoom;ctx.fillText(selfTitle,player.x,player.y-34/worldZoom);}
    ctx.shadowBlur=self.isDeveloper?14/worldZoom:0;ctx.shadowColor=self.isDeveloper?'#ff1744':'transparent';ctx.fillStyle=self.isDeveloper?'#ff304f':'#d8ffff';ctx.font=`${self.isDeveloper?900:700} ${14/worldZoom}px Manrope`;ctx.fillText(self.nickname||'Mergulhador',player.x,player.y-18/worldZoom);ctx.restore();
 }
 // Solo light masks the entire world, and raycasts against actual physical rock.
 if(isClassicCavernRun()&&player){SOLO_CAVERN?.lighting(ctx,{left:cameraX,top:cameraY,width:viewW/worldZoom,height:viewH/worldZoom},player,window.AbyssalSoloProgress?.get().lamp||1,arenaRocks,t,[{x:soloSubmarine.x,y:soloSubmarine.y,active:soloSubmarinePowered()||soloSubmarine.spawnFx>0,radius:355/GAME_WORLD_ZOOM,strength:soloSubmarinePowered()?1:.78},{x:player.specimen?.x,y:player.specimen?.y,active:Boolean(player.specimen?.alive),radius:85/GAME_WORLD_ZOOM,color:currentSkinColor(),strength:.65}]);}
 // Mar Aberto retains its independent helmet light.
 if(isOpenSeaRun()&&player&&gameState==='playing'){
  const levels=window.AbyssalExplorationBridge?.levels?.()||{};
  window.AbyssalOpenSeaLighting?.draw?.(ctx,
   {left:cameraX,top:cameraY,width:viewW/worldZoom,height:viewH/worldZoom},
   player,Number(levels.helmetLamp)||0,t,lowPowerRendering);
 }
 // corner scanner details (not part of the Solo scene)
 if(onlineMode||!isClassicShooterRun()){
 ctx.save();ctx.strokeStyle='rgba(123,215,223,.23)';ctx.lineWidth=1;const s=14;[[12,12,1,1],[W-12,12,-1,1],[12,H-12,1,-1],[W-12,H-12,-1,-1]].forEach(([x,y,a,b])=>{ctx.beginPath();ctx.moveTo(x,y+s*b);ctx.lineTo(x,y);ctx.lineTo(x+s*a,y);ctx.stroke()});ctx.restore();}
 ctx.restore();
 drawBossDirectionIndicators(t);
}
function drawSharkVisionCone(e,t){
 if(!e||!['whiteShark','whiteSharkBoss'].includes(e.kind))return;
 const vision=window.AbyssalEnemyAI?.SHARK_VISION;if(!vision)return;
 const range=Number(window.AbyssalEnemyAI?.sharkVisionRange?.(e))||(Number(vision.range)||900/GAME_WORLD_ZOOM),half=Number(vision.halfAngle)||.55,a=Number(e.angle)||0;
 ctx.save();ctx.globalAlpha=.40;ctx.fillStyle='rgba(255,24,70,.26)';ctx.strokeStyle='#ff174d';
 ctx.shadowBlur=0;ctx.lineWidth=1/GAME_WORLD_ZOOM;
 ctx.beginPath();ctx.moveTo(e.x,e.y);
 if(!onlineMode&&isClassicShooterRun()&&SOLO_CAVERN?.visionFan){for(const point of SOLO_CAVERN.visionFan(arenaRocks,e.x,e.y,a,half,range))ctx.lineTo(point.x,point.y);}
 else {const segments=64;for(let i=0;i<=segments;i++){const q=a-half+i/segments*half*2,dx=Math.cos(q),dy=Math.sin(q),reach=Math.max(0,pveRayDistance(e.x,e.y,dx,dy,range,1)-1);ctx.lineTo(e.x+dx*reach,e.y+dy*reach);}}
 ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function drawEnemyThreatAura(e,t){
 if(!e||BOSS_KINDS.includes(e.kind))return;
 if(isOpenSeaRun()&&e.wildlifeMode&&e.aiIndicator!=='attack')return;
 const elite=e.eliteId?EXPEDITION_RULES?.eliteConfig?.(e.eliteId):null,accent=elite?.accent||e.color||'#ff668d';
 const pulse=1+Math.sin(t*.007+(Number(e.phase)||0))*.07,scale=e.eliteId?1.75:1.28;
 ctx.save();ctx.globalAlpha=e.eliteId?.24:.08;ctx.strokeStyle=accent;ctx.fillStyle=accent;ctx.shadowBlur=(e.eliteId?14:5)/worldZoom;ctx.shadowColor=accent;ctx.lineWidth=(e.eliteId?2.2:1)/worldZoom;ctx.beginPath();ctx.arc(e.x,e.y,e.r*scale*pulse,0,Math.PI*2);ctx.stroke();
 if(e.eliteId){ctx.globalAlpha=.12;ctx.beginPath();ctx.arc(e.x,e.y,e.r*1.28,0,Math.PI*2);ctx.fill();for(let i=0;i<6;i++){const a=t*.0006+i*Math.PI/3,rr=e.r*2.05;ctx.globalAlpha=.4;ctx.beginPath();ctx.arc(e.x+Math.cos(a)*rr,e.y+Math.sin(a)*rr,2.2/worldZoom,0,Math.PI*2);ctx.fill();}}
 ctx.restore();
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
  ctx.save();ctx.fillStyle='#d9f6ff';ctx.shadowBlur=8;ctx.shadowColor='#39c8ff';ctx.fillText(boss.kind==='boss'?'POLVO-DE-ANÉIS-AZUIS COLOSSAL':'BOSS ABISSAL',x,y+18);ctx.restore();
 }
 ctx.restore();
}
let loopErrorShown=false;
const gameFrameSamples=new Float32Array(180);
let gameFrameSampleCount=0,gameFrameSampleIndex=0,gameFrameFps=0,gameFrameWindowStart=0,gameFrameWindowCount=0;
let gameLastUpdateMs=0,gameLastDrawMs=0,gameMaxFrameMs=0,gameLongTaskCount=0,gameMaxLongTaskMs=0,gameInpMs=0;
function recordGameFrame(startedAt,endedAt,updateMs,drawMs){
 const duration=Math.max(0,endedAt-startedAt);gameFrameSamples[gameFrameSampleIndex]=duration;gameFrameSampleIndex=(gameFrameSampleIndex+1)%gameFrameSamples.length;gameFrameSampleCount=Math.min(gameFrameSamples.length,gameFrameSampleCount+1);
 gameLastUpdateMs=updateMs;gameLastDrawMs=drawMs;gameMaxFrameMs=Math.max(gameMaxFrameMs,duration);
 if(!gameFrameWindowStart)gameFrameWindowStart=endedAt;gameFrameWindowCount++;
 if(endedAt-gameFrameWindowStart>=1000){gameFrameFps=Math.round(gameFrameWindowCount*1000/(endedAt-gameFrameWindowStart));gameFrameWindowStart=endedAt;gameFrameWindowCount=0;}
}
function applyAdaptiveQuality(level,reason='runtime'){
 const next=Number(level);if(!Number.isInteger(next)||next<0||next>2||next===adaptiveQualityLevel)return;
 adaptiveQualityLevel=next;adaptiveDprScale=ADAPTIVE_QUALITY[next].dpr;lowPowerRendering=next===0;
 // Rebuild only the framebuffer. World/gameplay coordinates are untouched.
 dpr=graphicsDpr();
 canvas.width=Math.max(1,Math.floor(viewW*dpr));canvas.height=Math.max(1,Math.floor(viewH*dpr));canvas.style.width=viewW+'px';canvas.style.height=viewH+'px';
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 backgroundGradientCache=null;backgroundBloomCache=null;
 window.dispatchEvent(new CustomEvent('abyssal-quality-change',{detail:{level:next,name:ADAPTIVE_QUALITY[next].name,reason,dpr}}));
}
function updateAdaptivePerformance(now){/* Explicit graphics selection is never overridden by FPS sampling. */}
window.AbyssalAdaptivePerformance={snapshot:()=>({level:adaptiveQualityLevel,name:ADAPTIVE_QUALITY[adaptiveQualityLevel].name,dpr:Number(dpr.toFixed(2)),fps:gameFrameFps}),setLevel:level=>applyAdaptiveQuality(level,'manual-diagnostic'),setPreference:level=>{const n=Number(level);if(!Number.isInteger(n)||n<0||n>2)return;try{localStorage.setItem('abyssalGraphicsQuality',String(n));}catch(_){}applyAdaptiveQuality(n,'user-preference');}};
function flushGameplayNetworkFrame(dt){
 if(!onlineMode||!window.AbyssalOnline||!player)return;
 gameplayFrameBudget.networkFlushes++;flushOnlineDamageBatch();window.AbyssalOnline.sendPosition({x:player.x,y:player.y,angle:player.angle});sendWorldSnapshot(dt);
 runProgressTimer-=dt;if(runProgressTimer<=0){runProgressTimer=1;window.AbyssalOnline.sendRunProgress?.({score,level,survival:elapsed,bossesKilled:bossKillsThisRun});}
}
function getAbyssalPerformanceSnapshot(){
 const samples=[];for(let i=0;i<gameFrameSampleCount;i++)samples.push(gameFrameSamples[i]);samples.sort((a,b)=>a-b);
 const p95=samples.length?samples[Math.min(samples.length-1,Math.ceil(samples.length*.95)-1)]:0;
 const memory=performance.memory?.usedJSHeapSize;
 return {fps:gameFrameFps,lastUpdateMs:Number(gameLastUpdateMs.toFixed(2)),lastDrawMs:Number(gameLastDrawMs.toFixed(2)),frameP95Ms:Number(p95.toFixed(2)),maxFrameMs:Number(gameMaxFrameMs.toFixed(2)),longTaskCount:gameLongTaskCount,maxLongTaskMs:Number(gameMaxLongTaskMs.toFixed(2)),inpMs:Number(gameInpMs.toFixed(1)),entities:{enemies:enemies.length,orbs:orbs.length,projectiles:projectiles.length,particles:particles.length,effects:effects.length},frameBudget:{faunaThink:gameplayFrameBudget.faunaThink,faunaThinkCap:faunaThinkBudget(),particleSpawns:gameplayFrameBudget.particleSpawns,particleSpawnCap:frameParticleSpawnBudget(),networkFlushes:gameplayFrameBudget.networkFlushes},network:window.AbyssalOnline?.positionDiagnostics?.()||null,heapUsedMb:Number.isFinite(memory)?Number((memory/1048576).toFixed(1)):null};
}
window.AbyssalPerformance={snapshot:getAbyssalPerformanceSnapshot};
if(typeof PerformanceObserver!=='undefined'){
 try{const longTaskObserver=new PerformanceObserver(list=>{for(const entry of list.getEntries()){gameLongTaskCount++;gameMaxLongTaskMs=Math.max(gameMaxLongTaskMs,Number(entry.duration)||0);}});longTaskObserver.observe({type:'longtask',buffered:true});}catch(_){/* Long Task API is optional. */}
 try{const eventObserver=new PerformanceObserver(list=>{for(const entry of list.getEntries())if(Number(entry.interactionId)>0)gameInpMs=Math.max(gameInpMs,Number(entry.duration)||0);});eventObserver.observe({type:'event',buffered:true,durationThreshold:16});}catch(_){/* Event Timing / INP is optional. */}
}
const performanceDebugEnabled=(()=>{try{return new URLSearchParams(location.search).get('abyssalDebug')==='1';}catch(_){return false;}})();
if(performanceDebugEnabled){
 const panel=document.createElement('pre');panel.id='abyssalDebugPanel';panel.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99999;max-width:min(460px,calc(100vw - 16px));max-height:42vh;overflow:auto;margin:0;padding:8px 10px;background:rgba(0,0,0,.82);color:#bff;font:11px/1.4 monospace;pointer-events:none;white-space:pre-wrap;border:1px solid rgba(120,255,245,.28)';
 document.body.appendChild(panel);
 setInterval(()=>{const snap=getAbyssalPerformanceSnapshot();panel.textContent=JSON.stringify(snap,null,2);},500);
}
let gameLoopFrame=0,gameLoopTimer=0;
function scheduleGameLoop(delay=0){
 if(document.hidden||gameLoopFrame||gameLoopTimer)return;
 if(delay>0){
  gameLoopTimer=setTimeout(()=>{gameLoopTimer=0;if(!document.hidden)gameLoopFrame=requestAnimationFrame(loop);},delay);
  return;
 }
 gameLoopFrame=requestAnimationFrame(loop);
}
function stopGameLoop(){
 if(gameLoopFrame)cancelAnimationFrame(gameLoopFrame);
 if(gameLoopTimer)clearTimeout(gameLoopTimer);
 gameLoopFrame=0;gameLoopTimer=0;
}
function loop(t){
 gameLoopFrame=0;
 if(document.hidden)return;
 // The swimmer menu owns its own renderer; don't run the gameplay pipeline there.
 // A low-rate wake-up is sufficient to resume gameplay after a mode selection.
 if(gameState==='menu'&&!onlineMode){last=t;return;}
 const active=!abyssalTutorialActive&&(gameState==='playing'||(onlineMode&&gameState==='upgrade'));
 // During active gameplay, trust requestAnimationFrame instead of manually skipping
 // frames. The old 60-FPS divisor produced 37-55 FPS on 75/90/144/165 Hz displays.
 // Idle/menu rendering remains capped to ~30 FPS because motion there is non-critical.
 if(!active&&lastPaintAt&&t-lastPaintAt<1000/30-1){scheduleGameLoop();return;}
 const dt=Math.min(.10,Math.max(0,(t-last)/1000||0));last=t;lastPaintAt=t;
 const frameStarted=performance.now();let updateMs=0,drawMs=0;
 beginGameplayFrameBudget();
 try{
  if(active){const updateStarted=performance.now();const steps=Math.max(1,Math.ceil(dt/.020)),step=dt/steps;for(let i=0;i<steps;i++){if(abyssalTutorialActive||!(gameState==='playing'||(onlineMode&&gameState==='upgrade')))break;update(step);}flushGameplayNetworkFrame(dt);updateMs=performance.now()-updateStarted;}
  const drawStarted=performance.now();draw(t);const frameEnded=performance.now();drawMs=frameEnded-drawStarted;recordGameFrame(frameStarted,frameEnded,updateMs,drawMs);updateAdaptivePerformance(frameEnded);
 }catch(err){console.error('Abyssal frame error:',err);if(!loopErrorShown){loopErrorShown=true;showToast('A pressão distorce os instrumentos. Consulte o Console (F12) se persistir.')}}
 scheduleGameLoop();
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){stopGameLoop();return;}
 last=performance.now();scheduleGameLoop();
});
function coords(e){const r=canvas.getBoundingClientRect();return{x:cameraX+(e.clientX-r.left)/worldZoom,y:cameraY+(e.clientY-r.top)/worldZoom}}
canvas.addEventListener('pointerdown',e=>{if(gameState!=='playing'||isMobileDevice())return;pointer={...coords(e),clientX:e.clientX,clientY:e.clientY,down:true,active:true};canvas.setPointerCapture?.(e.pointerId);});
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
function configureControlButtons(){const opens=[$('controlsBtn'),$('mobileControlsTopBtn')].filter(Boolean),screen=$('controlsScreen'),close=$('controlsCloseBtn');const pc=[...document.querySelectorAll('[data-control-pc]')],mobile=[...document.querySelectorAll('[data-control-mobile]')];const refresh=()=>{const restricted=['playing','paused','upgrade'].includes(gameState)&&!isClassicShooterRun();pc.forEach(b=>{b.hidden=restricted&&b.dataset.controlPc==='classic';b.disabled=restricted&&b.dataset.controlPc==='classic';const a=b.dataset.controlPc===controlSettings.pc;b.classList.toggle('control-choice-active',a);b.setAttribute('aria-pressed',String(a));});mobile.forEach(b=>{b.hidden=restricted&&b.dataset.controlMobile==='classic';b.disabled=restricted&&b.dataset.controlMobile==='classic';const a=b.dataset.controlMobile===controlSettings.mobile;b.classList.toggle('control-choice-active',a);b.setAttribute('aria-pressed',String(a));});};opens.forEach(open=>open.addEventListener('click',()=>{refresh();if(screen)screen.hidden=false;}));close?.addEventListener('click',()=>{if(screen)screen.hidden=true;});screen?.addEventListener('click',e=>{if(e.target===screen)screen.hidden=true;});pc.forEach(b=>b.addEventListener('click',()=>{if(['playing','paused','upgrade'].includes(gameState)&&!isClassicShooterRun()&&b.dataset.controlPc==='classic')return;controlSettings.pc=b.dataset.controlPc;localStorage.setItem('abyssalControlsPc',controlSettings.pc);autoFollowCursor=false;pointer.down=false;syncMobileFireButton();refresh();}));mobile.forEach(b=>b.addEventListener('click',()=>{if(['playing','paused','upgrade'].includes(gameState)&&!isClassicShooterRun()&&b.dataset.controlMobile==='classic')return;controlSettings.mobile=b.dataset.controlMobile;localStorage.setItem('abyssalControlsMobile',controlSettings.mobile);joystickVector={x:0,y:0,active:false,pointerId:null};aimJoystickVector={x:0,y:0,active:false,pointerId:null};mobileFireHeld=false;syncMobileFireButton();const mobilePlaying=gameState==='playing'&&isMobileDevice();mobileMoveStick?.classList.remove('dual-stick-visible');mobileAimStick?.classList.toggle('dual-stick-visible',mobilePlaying&&controlSettings.mobile==='dual-stick');const old=$('mobileJoystick');if(old){old.hidden=true;old.classList.remove('is-floating');}refresh();}));}
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
const mobileFireBtn=$('mobileFireBtn');
if(mobileFireBtn){
 const release=()=>{mobileFireHeld=false;mobileFireBtn.classList.remove('is-firing');};
 mobileFireBtn.addEventListener('pointerdown',e=>{if(gameState!=='playing'||controlSettings.mobile!=='dual-stick')return;e.preventDefault();e.stopPropagation();mobileFireHeld=true;mobileFireBtn.classList.add('is-firing');try{mobileFireBtn.setPointerCapture(e.pointerId)}catch(_){}});
 ['pointerup','pointercancel','lostpointercapture'].forEach(name=>mobileFireBtn.addEventListener(name,release));
 window.addEventListener('blur',release);
}
configureControlButtons();setupDualStickEvents();
function isTextEntryTarget(target){return Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'));}
window.addEventListener('keydown',e=>{if(e.defaultPrevented||abyssalTutorialActive||isTextEntryTarget(e.target))return;keys[e.key]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if((e.key==='t'||e.key==='T')&&!e.repeat&&!isMobileDevice()&&gameState==='playing'){autoFollowCursor=!autoFollowCursor;if(autoFollowCursor){pointer.down=false;showToast('MOVIMENTO AUTOMÁTICO PELO CURSOR · T PARA PARAR');}else showToast('MOVIMENTO AUTOMÁTICO DESATIVADO');}if(!e.repeat&&(e.key==='q'||e.key==='Q')&&Number(metaUpgrades.pulse)>0)activateAbility('pulse');if(!e.repeat&&(e.key==='e'||e.key==='E')&&Number(metaUpgrades.dash)>0)activateAbility('dash');if(!e.repeat&&(e.key==='r'||e.key==='R'))activateSkinAbility(e);if(!e.repeat&&(e.key==='f'||e.key==='F')&&mapInteractionType)activateMapInteraction();if(e.key==='Escape'||e.key==='p'||e.key==='P'){if(gameState==='playing')pauseGame();else if(gameState==='paused')resumeGame()}});
window.addEventListener('keyup',e=>{if(isTextEntryTarget(e.target))return;keys[e.key]=false;});
function setReviveMessage(message){const node=$('reviveAdMessage');if(node)node.textContent=message||'';}
function prepareForH5Ad(){}
function resumeAfterH5Ad(){last=performance.now();}
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
 hp=maxHp;if(player)player.invuln=3;gameState='playing';$('gameOverScreen').hidden=true;$('hud').hidden=false;$('pauseBtn').hidden=false;setMobileGameActive(true);const end=$('endDiveBtn');if(end)end.style.display='block';updateHud();last=performance.now();
});
function pendingRunPayload(){return {survival:elapsed,score,level,bossesKilled:bossKillsThisRun,expedition:expeditionMode&&!onlineMode,extracted:expeditionExtracted,riskTier:expeditionRiskTier,...diveStats};}
function renderDiveReport(report,pending=false){
 if(!report)return;const n=v=>v==null?'—':Math.max(0,Math.round(Number(v)||0)).toLocaleString('pt-BR');
 setTextIfChanged('finalTime',fmtTime(report.survival));setTextIfChanged('finalScore',n(report.damageDealt));setTextIfChanged('finalLevel',n(report.level));setTextIfChanged('finalCoins',n(report.totalRunCoins));setTextIfChanged('finalEnergy',n(report.energyCollected));setTextIfChanged('finalKills',n(report.monstersKilled));const percent=Number(report.specimenEnergyBonusPercent)||0;setTextIfChanged('finalEnergyBonusPercent','+'+percent+'%');setTextIfChanged('finalEnergyBonus',report.energyCollected==null?'—':n(report.energyBonus));setTextIfChanged('finalEnergyWithBonus',report.energyCollected==null?'—':n(Number(report.energyCollected)+Number(report.energyBonus||0)));setTextIfChanged('finalReportStatus',pending?'Resultado provisório · aguardando confirmação':'Relatório do mergulho · 100% da energia coletada + bônus do Espécime');
}
function publishDiveReport(report){const n=v=>v==null?'Não disponível':Math.max(0,Math.round(Number(v)||0)).toLocaleString('pt-BR');const outcome=report.reason==='death'?'Mergulhador abatido':report.reason==='extracted'?'Extração concluída':'Encerramento voluntário';addNotification(outcome+' · Energia de conclusão: '+n(report.totalRunCoins)+' · Energia coletada: '+n(report.energyCollected)+' · Bônus: +'+n(report.energyBonusPercent)+'%'+' · Sobrevivência: '+fmtTime(report.survival)+' · Dano: '+n(report.damageDealt)+' · Criaturas abatidas: '+n(report.monstersKilled),'RELATÓRIO DE MERGULHO','dive');}
function settleDiveReport(onComplete){
 syncSoloAdaptation();
 if(diveSettled){onComplete?.();return;}if(diveSettling||!diveReport)return;
 diveSettling=true;const wasOnline=Boolean(onlineMode),authenticated=Boolean(window.AbyssalOnline?.isAuthenticated?.());
 const finish=result=>{
  diveSettling=false;if(!result?.ok){setTextIfChanged('finalReportStatus',result?.message||'Resultado não confirmado. Tente novamente.');return;}
  diveSettled=true;runResultPending=false;diveReport={...diveReport,...result,reason:diveEndReason,survival:diveReport.survival};renderDiveReport(diveReport,false);if(result.queued)setTextIfChanged('finalReportStatus','Mergulho salvo neste dispositivo · sincronização automática ao conectar');publishDiveReport(diveReport);onComplete?.();
 };
 if(!wasOnline&&soloRunIdentity?.key){
  const data={...pendingRunPayload(),id:soloRunIdentity.id,energySkinId:diveEnergySkinId,classicFirstCycle:requestedRunMode==='classic'&&bossKillsThisRun>=7};
  if(!window.AbyssalOnline?.queueSoloRun?.(soloRunIdentity.key,data)){finish({ok:false,message:'Não foi possível salvar o mergulho neste dispositivo. Tente novamente.'});return;}
  finish({ok:true,...diveEnergyCalculation(),queued:true});
  return;
 }
 if(wasOnline&&authenticated&&window.AbyssalOnline?.finishRun){window.AbyssalOnline.finishRun(pendingRunPayload(),{leaveAfter:true,onComplete:finish});return;}
 if(wasOnline){finish({ok:false,message:'Reconecte a conta para confirmar o resultado online.'});return;}
 const calculation=diveEnergyCalculation(),earned=calculation.earned;
 energyWallet?.credit(earned,'offline-reward');saveCosmetics();if(!$('shopScreen')?.hidden)renderShop();finish({ok:true,...diveEnergyCalculation()});
}
function returnToMainMenu(){cancelSoloHullRepair();mobileFireHeld=false;const manualBtn=$('mobileFireBtn');if(manualBtn)manualBtn.hidden=true;runResultPending=false;mapInteractionBusy=false;mapInteractionType=null;const mapButton=$('abyssMapInteractBtn');if(mapButton)mapButton.hidden=true;onlineMode=false;setMobileGameActive(false);setHudCollapsed(false);$('toggleHudBtn').hidden=true;document.body.classList.remove('game-active');gameState='menu';$('gameOverScreen').hidden=true;$('pauseScreen').hidden=true;$('upgradeScreen').hidden=true;$('hud').hidden=true;$('menuScreen').hidden=false;$('pauseBtn').hidden=true;const end=$('endDiveBtn');if(end)end.style.display='none';window.AbyssalCockpitNavigation?.showExterior?.();document.body.classList.add('abyss-hatch-navigation');window.dispatchEvent(new CustomEvent('abyssal-menu-return',{detail:{outside:true}}));}
$('playBtn').addEventListener('click',()=>{requestedRunMode='classic';onlineMode=false;startGame()});
// Separate route identifier for Mar Aberto. Existing classic/online handlers stay intact.
window.addEventListener('abyssal-start-open-sea',()=>{requestedRunMode='open-sea';onlineMode=false;startGame()});
window.addEventListener('abyssal-start-rift-solo',()=>{requestedRunMode='rift';onlineMode=false;startGame()});
$('againBtn').addEventListener('click',()=>settleDiveReport(()=>{
 const restartOnline=wasOnlineModeOnDeath;returnToMainMenu();
 if(restartOnline){window.AbyssalOnline?.showRooms?.();}else{window.AbyssalCockpitNavigation?.close?.();startGame();}
}));
$('menuBtn').addEventListener('click',()=>settleDiveReport(()=>returnToMainMenu()));
$('pauseBtn').addEventListener('click',pauseGame);$('resumeBtn').addEventListener('click',resumeGame);$('quitBtn').addEventListener('click',()=>{$('pauseScreen').hidden=true;endGame('voluntary');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&gameState==='playing'&&!onlineMode)pauseGame();if(!document.hidden)last=performance.now();});
window.addEventListener('resize',()=>{resize();if(gameState==='playing'||(onlineMode&&gameState==='upgrade')){setMobileGameActive(true);requestAnimationFrame(positionMobileRightStack);}});
window.addEventListener('abyssal-remote-shot',ev=>{const d=ev.detail;if(!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;const remoteShooterId=String(d.fromId||d.from||'');if(remoteShooterId)remoteCreatureAttackUntil.set(remoteShooterId,performance.now()+140);
 const col=d.color||'#9bbcff',special=d.special||null,x=d.x*W,y=d.y*H,vx=(d.vx||0)*W,vy=(d.vy||0)*H;
 if(special==='nova'){const max=Number(d.effectRadius)||294/GAME_WORLD_ZOOM,heading=Math.atan2(Number(d.vy)*H||0,Number(d.vx)*W||0);spawnNovaVisual(x,y,max,col,onlineRoomMode==='pvp',heading,d.combined===true);return;}
 if(special==='photonRay'){const length=Number(d.effectRadius)||294/GAME_WORLD_ZOOM,mag=Math.hypot(vx,vy)||1;const beamKey=String(d.fromId||d.from||'remote'),beamTargetId=d.beamTargetId==null?null:String(d.beamTargetId);const remoteEndValid=Number.isFinite(d.beamEndX)&&Number.isFinite(d.beamEndY);const beamX2=remoteEndValid?d.beamEndX*W:x+vx/mag*length,beamY2=remoteEndValid?d.beamEndY*H:y+vy/mag*length;const width=PHOTON_RAY_VISUAL.widths[Math.max(1,Math.min(3,Number(d.beamLevel)||1))]*(d.hadalBeamActive?1.35:1)/GAME_WORLD_ZOOM;const existing=effects.find(fx=>fx.type==='photon-ray'&&fx.remoteBeamKey===beamKey);if(existing){existing.targetX1=x;existing.targetY1=y;existing.targetX2=beamX2;existing.targetY2=beamY2;existing.remoteTargetId=beamTargetId;existing.width=width;existing.life=PHOTON_RAY_VISUAL.remoteHold;existing.maxLife=PHOTON_RAY_VISUAL.remoteHold;existing.color=PHOTON_RAY_VISUAL.color;}else queueEffect({type:'photon-ray',remoteBeamKey:beamKey,remoteTargetId:beamTargetId,x1:x,y1:y,x2:beamX2,y2:beamY2,targetX1:x,targetY1:y,targetX2:beamX2,targetY2:beamY2,width,life:PHOTON_RAY_VISUAL.remoteHold,maxLife:PHOTON_RAY_VISUAL.remoteHold,color:PHOTON_RAY_VISUAL.color});
  // The server owns the secondary beam endpoints; peers render those exact
  // lines, not an independently guessed client-side collision shape.
  const prism=Array.isArray(d.prismBeams)?d.prismBeams.slice(0,6):[];
  for(let i=0;i<prism.length;i++){
   const beam=prism[i];
   if(!Number.isFinite(beam.x2)||!Number.isFinite(beam.y2))continue;
   const key='prism:'+beamKey+':'+i,ex=beam.x2*W,ey=beam.y2*H;
   const existingPrism=effects.find(fx=>fx.remoteBeamKey===key);
   if(existingPrism){existingPrism.targetX1=x;existingPrism.targetY1=y;existingPrism.targetX2=ex;existingPrism.targetY2=ey;existingPrism.life=PHOTON_RAY_VISUAL.remoteHold;}
   else queueEffect({type:'photon-ray',remoteBeamKey:key,x1:x,y1:y,x2:ex,y2:ey,targetX1:x,targetY1:y,targetX2:ex,targetY2:ey,width:width*.58,life:PHOTON_RAY_VISUAL.remoteHold,maxLife:PHOTON_RAY_VISUAL.remoteHold,color:'#c8a5ff'});
  }
  return;}
 projectiles.push({x,y,vx,vy,r:(special==='pierce'?6.5:special==='electric'?5.8:5.2)/GAME_WORLD_ZOOM,life:1.05,damage:0,color:col,special,allyShot:true,remoteVisual:true,trailLife:.16});
 burst(x,y,col,5,75);
 if(projectiles.length>projectileBudget())projectiles.splice(0,projectiles.length-projectileBudget());
});
window.addEventListener('abyssal-hit-synergy-visual',event=>{const d=event.detail||{},x1=Number(d.x1)*W,y1=Number(d.y1)*H,x2=Number(d.x2)*W,y2=Number(d.y2)*H;if(![x1,y1,x2,y2].every(Number.isFinite))return;if(d.type==='ricochet-line')queueEffect({type:'ricochet-line',x1,y1,x2,y2,life:.18,maxLife:.18,color:'#f7ff19',width:3.4/GAME_WORLD_ZOOM});else if(d.type==='electric-arc')queueEffect({type:'electric-arc',x1,y1,x2,y2,seed:Number(d.seed)||performance.now(),life:.22,maxLife:.22,color:'#31eaff',width:4.2/GAME_WORLD_ZOOM});});
window.addEventListener('abyssal-remote-photon-stop',event=>{const fromId=String(event.detail?.fromId||'');if(!fromId)return;for(const fx of effects)if(fx.type==='photon-ray'&&fx.remoteBeamKey===fromId)fx.life=Math.min(fx.life,.06);});
window.AbyssalGameHooks={
 browserUpdateBlocked:()=>gameState!=='menu',
 notifyBrowserUpdate:()=>showToast('NOVA VERSÃO · ATUALIZAÇÃO AO RETORNAR AO MENU'),
 captureUpdateRun:()=>onlineMode&&player?{upgrades:{...upgrades},upgradeLevels:{...upgradeLevels},chosen:[...chosen],runShotId,runResonanceIds:[...runResonanceIds]}:null,
 setTutorialActive:active=>{
  abyssalTutorialActive=Boolean(active);
  if(player){player.invuln=active?Math.max(player.invuln,3600):Math.max(2,Math.min(player.invuln,5));}
  pointer.down=false;pointer.active=false;
  for(const key of Object.keys(keys))keys[key]=false;
  joystickVector={x:0,y:0,active:false,pointerId:null};
  last=performance.now();
  return true;
 },
 returnToSurface:()=>{
  if(onlineMode){document.getElementById('endDiveBtn')?.click();return true;}
  if(gameState==='playing'||gameState==='paused')endGame();
  document.getElementById('menuBtn')?.click();
  return true;
 },
 getPlayerPosition:()=>onlineMode&&player&&gameState!=='menu'&&gameState!=='over'?{x:player.x,y:player.y,angle:player.angle||0}:null,
 applyResearchUnlock:(id,level)=>{
  const def=window.AbyssalExplorationConfig?.RESEARCH?.[id];if(!def)return false;
  explorationResearchLevels[id]=Math.max(Number(explorationResearchLevels[id])||0,Number(level)||0);
  if(def.legacyMeta){
   metaUpgrades[id]=Math.max(Number(metaUpgrades[id])||0,Number(level)||0);
   localStorage.setItem('abyssalMetaUpgrades',JSON.stringify(metaUpgrades));
  }
  updateAbilityButtons(true);return true;
 },
 explorationPosition:()=>player&&['playing','paused','upgrade'].includes(gameState)?{x:player.x,y:player.y,angle:player.angle||0,mode:onlineMode?onlineRoomMode:requestedRunMode,online:onlineMode,worldWidth:W,worldHeight:H,paused:gameState!=='playing'}:null,
 explorationHit:amount=>{if(!onlineMode&&player&&gameState==='playing')hurtPlayer(Math.max(0,Number(amount)||0));},
 roomMode:()=>onlineRoomMode,
 petHabit:()=>petHabit,
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
 cameraState:()=>({x:cameraX,y:cameraY,zoom:worldZoom,viewW,viewH}),
 classicParityInspect:()=>({classic:isClassicCavernRun(),online:onlineMode,mode:onlineRoomMode,state:gameState,elapsed:Number(elapsed)||0,position:{x:Number(player?.x)||0,y:Number(player?.y)||0},world:{width:W,height:H,zoom:worldZoom},submarine:{x:soloSubmarine.x,y:soloSubmarine.y,repairSeconds:submarineRepairSeconds(),sections:soloSubmarine.sections.map(s=>({name:s.name,hp:s.hp,maxHp:SOLO_HULL_HP}))},rocks:arenaRocks.filter(r=>r.cavernSolid&&!r.visualOnly).map(r=>[r.x,r.y,r.rx,r.ry,r.vertices?.length||0]),weapons:onlineMode?onlineSubmarineWeapons:window.AbyssalSoloBase?.installedWeapons?.()||[],petVisible:!document.getElementById('petHabitBar')?.hidden}),
 developerInspect:()=>({online:onlineMode,mode:onlineMode?onlineRoomMode:requestedRunMode,state:gameState,fps:Number(window.__abyssalFps||0),elapsed:Number(elapsed)||0,hp:Number(hp)||0,maxHp:Number(maxHp)||0,x:Number(player?.x)||0,y:Number(player?.y)||0,enemies:enemies.filter(e=>e&&e.hp>0).length,bosses:enemies.filter(e=>e&&e.hp>0&&BOSS_KINDS.includes(e.kind)).length,orbs:orbs.length,submarine:isClassicCavernRun()?{powered:soloSubmarinePowered(),sections:soloSubmarine.sections.map(s=>({name:s.name,hp:s.hp,maxHp:SOLO_HULL_HP}))}:null}),
 developerCommand:command=>{
  if(window.AbyssalDeveloperActive!==true)return {ok:false,message:'Conta GameMaster não validada.'};
  if(onlineMode)return {ok:false,message:'Comandos online são processados pelo servidor DEV.'};
  if(command==='heal'){hp=maxHp;if(player)player.invuln=Math.max(player.invuln||0,1);return {ok:true,message:'Vida restaurada no modo local.'};}
  if(command==='god-mode'){if(!player)return {ok:false,message:'Inicie uma partida.'};player.devGodMode=!player.devGodMode;player.invuln=player.devGodMode?360000:0;return {ok:true,message:player.devGodMode?'Invulnerabilidade local ativada.':'Invulnerabilidade local desativada.'};}
  if(command==='clear-enemies'){enemies.length=0;orbs.length=0;return {ok:true,message:'Inimigos locais removidos.'};}
  if(command==='boss-now'){nextBossAt=Math.min(nextBossAt,elapsed);return {ok:true,message:'Próximo boss local antecipado.'};}
  return {ok:false,message:'Comando local indisponível.'};
 },
 skinId:()=>equippedSkin,
 isFossasActive:()=>isRiftRun()&&gameState!=='menu'&&gameState!=='over',
 isRiftPlaying:()=>isRiftRun()&&gameState==='playing',
 riftSonar:()=>{
  if(!isRiftRun()||!activeMapLayout||!player)return [];
  const rows=[];
  for(const room of activeMapLayout.rooms||[]){
   const d=Math.hypot(room.x-player.x,room.y-player.y);
   if(d<1600)rows.push({type:'room',id:room.id,x:room.x,y:room.y,distance:d,label:room.signal||room.id.toUpperCase()});
  }
  for(const hazard of activeRiftHazards||[]){
   const x=Number(hazard.sourceX??hazard.x),y=Number(hazard.sourceY??hazard.y);
   const d=Math.hypot(x-player.x,y-player.y);
   if(Number.isFinite(d)&&d<950)rows.push({type:'anomaly',id:hazard.id,x,y,distance:d,label:'ANOMALIA · '+String(hazard.type||'SINAL').toUpperCase()});
  }
  return rows.sort((a,b)=>a.distance-b.distance).slice(0,6);
 },

 skinName:id=>skinData.find(s=>s.id===id)?.name,
 riftRewardProgress:()=>({score,level,survival:elapsed,bossesKilled:bossKillsThisRun}),
 expeditionState:()=> ({active:expeditionMode&&!onlineMode,extracted:expeditionExtracted,riskTier:expeditionRiskTier,bossesKilled:bossKillsThisRun,elapsed,score,energyBonusPercent:diveEnergyCalculation().specimenEnergyBonusPercent,depthState:soloDepthState()}),
 pauseExpedition:()=>{if(!expeditionMode||onlineMode||gameState!=='playing')return false;gameState='paused';$('pauseBtn').hidden=true;return true;},
 resumeExpedition:()=>{if(!expeditionMode||onlineMode||gameState!=='paused')return false;gameState='playing';$('pauseBtn').hidden=false;last=performance.now();return true;},
 continueExpedition:()=>{if(!expeditionMode||onlineMode)return false;expeditionRiskTier=Math.max(expeditionRiskTier,bossKillsThisRun);activatePendingSoloDepthEvent();if(gameState==='paused'){gameState='playing';$('pauseBtn').hidden=false;last=performance.now();}return true;},
 extractExpedition:()=>{if(!expeditionMode||onlineMode||!['playing','paused'].includes(gameState))return false;expeditionExtracted=true;if($('pauseScreen'))$('pauseScreen').hidden=true;endGame();return true;},
 skinForId:id=>skinData.find(s=>s.id===id)||skinData[0],
 toast:message=>showToast(message),
 remoteHit:data=>{if(!player)return;const tx=data.x*W,ty=data.y*H;let nearest=null,bd=Infinity;for(const e of enemies){const d=Math.hypot(e.x-tx,e.y-ty);if(d<bd){bd=d;nearest=e}}if(nearest&&bd<100/GAME_WORLD_ZOOM){queueEffect({type:'beam',x1:tx,y1:ty,x2:nearest.x,y2:nearest.y,life:.14,maxLife:.14,color:'#bba8ff'});burst(nearest.x,nearest.y,'#bba8ff',5,60);}},
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
 if(!canvas)return;
 const surface=preparePreviewCanvas(canvas);if(!surface)return;
 const {c,w,h}=surface;c.clearRect(0,0,w,h);
 const isSpecimenVessel=Boolean(canvas.closest?.('#shopScreen'));
 const bg=c.createRadialGradient(w*.48,h*.42,2,w*.5,h*.5,Math.max(w,h)*.7);
 bg.addColorStop(0,'#0d2637');bg.addColorStop(.62,'#06121d');bg.addColorStop(1,'#020812');
 // Laboratory water and the handwritten journal paper must remain visible beneath the creature.
 if(!isSpecimenVessel && !canvas.closest?.('#catalogScreen')){c.fillStyle=bg;c.fillRect(0,0,w,h);}
 // Do not wrap every species in the same orbit/ring. The anatomy must dominate the preview.
 c.save();c.globalAlpha=.16;c.fillStyle=color;c.beginPath();c.ellipse(w*.5,h*.72,w*.21,h*.055,0,0,Math.PI*2);c.fill();c.restore();
 let scale=1;
 if(skin?.family){
  const family=String(skin.family),variant=Number(skin.variant)||0;
  // Marine skins should occupy the card with the same visual weight as signature Abyssal skins.
  if(family==='shark')scale=(variant===5||variant===7)?.8:1.0;
  else if(family==='eel')scale=.96;
  else if(family==='ray')scale=.92;
  else if(family==='octopus'||family==='squid')scale=.94;
  else if(family==='jelly')scale=.9;
  else if(family==='crustacean')scale=variant===5?.74:.92;
  else if(family==='fish')scale=variant===9?.8:.98;
  else if(family==='benthic')scale=.92;
  else if(family==='mollusc')scale=.94;
 }
 if(kind==='leviathan')scale=.68;
 else if(kind==='kraken'||kind==='devourer')scale=.7;
 else if(kind==='maw')scale=.78;
 const previewRadius=Math.min(w*.145,h*.235)*scale;
 if(kind==='player'&&skin){
   const now=performance.now(),sx=w*.5,sy=h*.5+Math.cos(now*.0024)*2.4;
   drawCreature(sx,sy,previewRadius*1.1,-.05,color,'player',now,true,0,c,skin,{visualId:'shop-specimen:'+skin.id,moveSpeed:0});
  }else drawCreature(w*.5,h*.48,previewRadius,-.08,color,kind,performance.now(),!!skin,0,c,skin);
}
// The shop uses no GIF/video downloads. Visible previews are repainted at
// 6-8 FPS with a strict per-tick cap and stop when the shop is closed.
let shopMotionFrame=0,shopMotionLast=0,shopMotionCursor=0;
let shopMotionObserver=null;
const shopMotionVisible=new Set();
function animateVisibleShopSkins(now){
 const screen=$('shopScreen');
 if(!screen||screen.hidden||document.hidden){shopMotionFrame=0;return;}
 const interval=isMobileDevice()?180:125;
 if(now-shopMotionLast>=interval){
  shopMotionLast=now;
  // Only animate capsules actually intersecting the scroll viewport.
  // With an observer this avoids scanning all catalogue canvases every 125ms.
  const canvases=shopMotionObserver?[...shopMotionVisible]:[...screen.querySelectorAll('.skin-preview-canvas[data-skin-id]')];
  if(canvases.length){
   const limit=isMobileDevice()?2:4;
   let drawn=0,scanned=0;
   while(scanned<canvases.length&&drawn<limit){
    const canvas=canvases[shopMotionCursor%canvases.length];
    shopMotionCursor=(shopMotionCursor+1)%canvases.length;scanned++;
    if(!shopMotionObserver){
     const rect=canvas.getBoundingClientRect();
     if(rect.bottom<0||rect.top>window.innerHeight||rect.width<1)continue;
    }
    const skin=skinData.find(item=>item.id===canvas.dataset.skinId);
    if(!skin)continue;
    renderCreaturePreview(canvas,'player',skin.color,skin);drawn++;
   }
  }
 }
 shopMotionFrame=requestAnimationFrame(animateVisibleShopSkins);
}
function startShopMotion(){
 if(!shopMotionFrame&&!$('shopScreen')?.hidden)shopMotionFrame=requestAnimationFrame(animateVisibleShopSkins);
}
function drawWheel(){
 const canvas=$('wheelCanvas');if(!canvas)return;const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,r=Math.min(w,h)*.43;const prizes=[2,5,10,30,60,100],colors=['#1a7083','#513b9f','#1b8891','#a64b82','#b87335','#d3ac3d'];c.clearRect(0,0,w,h);c.save();c.translate(cx,cy);c.rotate(wheelAngle);for(let i=0;i<prizes.length;i++){const a=-Math.PI/2+i*Math.PI*2/prizes.length,b=a+Math.PI*2/prizes.length;c.beginPath();c.moveTo(0,0);c.arc(0,0,r,a,b);c.closePath();const grad=c.createRadialGradient(0,0,r*.05,0,0,r);grad.addColorStop(0,colors[i]);grad.addColorStop(1,i===5?'#f3d46b':'#071825');c.fillStyle=grad;c.fill();c.strokeStyle='rgba(231,255,255,.72)';c.lineWidth=2;c.stroke();c.save();c.rotate(a+Math.PI/prizes.length);c.textAlign='right';c.fillStyle='#f5ffff';c.shadowBlur=9;c.shadowColor=colors[i];c.font=`900 ${i===5?18:16}px Manrope, sans-serif`;c.fillText(`${prizes[i]}`,r*.83,6);c.font='700 9px Manrope,sans-serif';c.fillStyle='#c1f7f8';c.fillText('ENERGIA',r*.83,18);c.restore();}c.restore();c.save();c.translate(cx,cy);c.fillStyle='#e6fbff';c.shadowBlur=20;c.shadowColor='#69fff3';c.beginPath();c.arc(0,0,r*.22,0,Math.PI*2);c.fill();c.fillStyle='#081923';c.beginPath();c.arc(0,0,r*.145,0,Math.PI*2);c.fill();c.fillStyle='#9efff6';c.font='900 11px Manrope,sans-serif';c.textAlign='center';c.fillText('ABYSS',0,4);c.restore();c.save();c.translate(cx,cy-r+2);c.fillStyle='#fff1af';c.strokeStyle='#8b5c2a';c.lineWidth=2;c.shadowBlur=14;c.shadowColor='#ffc65e';c.beginPath();c.moveTo(-13,-17);c.lineTo(13,-17);c.lineTo(0,8);c.closePath();c.fill();c.stroke();c.restore();}
function animateWheelToPrize(reward,grant=true){
 const vals=[2,5,10,30,60,100];const index=Math.max(0,vals.indexOf(Number(reward)));const canvas=$('wheelCanvas');wheelBusy=true;$('spinWheelBtn').disabled=true;if($('testWheelBtn'))$('testWheelBtn').disabled=true;const segment=Math.PI*2/vals.length;const desired=-(index+.5)*segment;const start=wheelAngle;const target=start+Math.PI*2*5+((desired-start%(Math.PI*2)+Math.PI*2)%(Math.PI*2));const begin=performance.now(),duration=3700;const spin=now=>{const p=clamp((now-begin)/duration,0,1),ease=1-Math.pow(1-p,4);wheelAngle=start+(target-start)*ease;drawWheel();if(p<1)requestAnimationFrame(spin);else{wheelBusy=false;$('spinWheelBtn').disabled=false;if($('testWheelBtn'))$('testWheelBtn').disabled=false;$('wheelMessage').textContent=grant?`VOCÊ GANHOU ${reward} energia!`:`Prévia do giro: ${reward} de energia. Nenhuma energia foi adicionada.`;if(grant){playWorldSound('ui-roulette',null,900,1);showToast(`ROLETA ABISSAL · +${reward} ENERGIA`);}else audio(480,.12,'sine',.02);}};requestAnimationFrame(spin);
}
function requestWheelSpin(){
 if(wheelBusy)return;
 if(!window.AbyssalOnline?.isAuthenticated()){$('wheelScreen').hidden=true;showToast('ENTRE NA CONTA PARA RECEBER RECOMPENSAS');window.AbyssalOnline?.openLogin();return;}
 if(typeof window.adBreak!=='function'){$('wheelMessage').textContent='Anúncios premiados ainda não estão ativos nesta versão. Use “Testar giro” para ver a animação sem ganhar energia.';showToast('ANÚNCIO PREMIADO AINDA NÃO CONFIGURADO');return;}
 let requested=false;wheelBusy=true;$('spinWheelBtn').disabled=true;if($('testWheelBtn'))$('testWheelBtn').disabled=true;
 try{window.adBreak({type:'reward',name:'abyssal-wheel',beforeAd:prepareForH5Ad,beforeReward:showAd=>{if(typeof showAd==='function')showAd();},adViewed:()=>{if(requested)return;requested=true;window.AbyssalOnline.spinWheel();},adDismissed:()=>{wheelBusy=false;$('spinWheelBtn').disabled=false;if($('testWheelBtn'))$('testWheelBtn').disabled=false;$('wheelMessage').textContent='O anúncio foi fechado antes de concluir. Nenhuma recompensa foi entregue.';},afterAd:()=>{resumeAfterH5Ad();if(!requested){wheelBusy=false;$('spinWheelBtn').disabled=false;if($('testWheelBtn'))$('testWheelBtn').disabled=false;}}});}catch(e){wheelBusy=false;$('spinWheelBtn').disabled=false;if($('testWheelBtn'))$('testWheelBtn').disabled=false;$('wheelMessage').textContent='Não foi possível abrir o anúncio. Verifique a integração do AdSense H5.';}
}
function weightedWheelPrize(){const n=Math.random()*100;if(n<40)return 2;if(n<70)return 5;if(n<88)return 10;if(n<96)return 30;if(n<99.9)return 60;return 100;}
 function openOriginalWheel(){ $('wheelScreen').hidden=false;drawWheel();if(!wheelBusy)$('wheelMessage').textContent='Gire para ganhar energia!'; }
 $('wheelBtn')?.addEventListener('click',()=>{if(window.AbyssalCockpitNavigation?.routeScreen?.('wheelScreen'))return;openOriginalWheel();});
$('wheelCloseBtn')?.addEventListener('click',()=>{$('wheelScreen').hidden=true});
$('wheelTopCloseBtn')?.addEventListener('click',()=>{$('wheelScreen').hidden=true});
$('spinWheelBtn')?.addEventListener('click',requestWheelSpin);
$('testWheelBtn')?.addEventListener('click',()=>{if(wheelBusy)return;animateWheelToPrize(weightedWheelPrize(),false);});
window.addEventListener('abyssal-wheel-result',ev=>{const d=ev.detail||{};if(d.ok){if(d.account)energyWallet?.setAccount(d.account.nickname,d.account.energy);saveCosmeticsLocalOnly();if(!$('shopScreen')?.hidden)renderShop();animateWheelToPrize(Number(d.reward)||2,true);}else{wheelBusy=false;$('spinWheelBtn').disabled=false;if($('testWheelBtn'))$('testWheelBtn').disabled=false;$('wheelMessage').textContent=d.message||'Não foi possível girar agora.';}});
function applyWorldEnemyDamageBatch(items){if(!Array.isArray(items))return;for(const item of items)applyWorldEnemyDamage(item);}
function applyWorldEnemyDamage(data){
 if(!onlineMode||!data||data.id==null)return;
 const enemy=onlineEnemyById.get(String(data.id))||enemies.find(e=>String(e.id)===String(data.id));
 if(!enemy)return;
 if(Number.isFinite(Number(data.hp)))enemy.hp=clamp(Number(data.hp),0,Number(enemy.maxHp)||Number(data.maxHp)||Infinity);
 if(Number.isFinite(Number(data.maxHp)))enemy.maxHp=Number(data.maxHp);
 if(Number.isFinite(Number(data.damageRevision)))enemy.damageRevision=Math.max(Number(enemy.damageRevision)||0,Number(data.damageRevision));
 enemy.hit=.16;
 if(Number(data.damage)>0&&!consumePredictedCombatImpact(data)&&(!PERIODIC_SKIN_DAMAGE_SKILLS.has(String(data.skillId||''))||showPeriodicSkinDamageNumber(enemy)))spawnDamageNumber(Number(data.enemyX)||enemy.x,Number(data.enemyY)||enemy.y,Number(data.damage),damageTone(data.skillId));
}
window.addEventListener('abyssal-player-vitals',ev=>applyOnlinePlayerVitals(ev.detail));
window.addEventListener('abyssal-player-damage-number',ev=>{const d=ev.detail||{};if(String(d.targetId)===String(window.AbyssalOnline?.getSocketId?.()))return;const x=Number(d.x)*W,y=Number(d.y)*H;if(Number.isFinite(x)&&Number.isFinite(y)&&Number(d.damage)>0)spawnDamageNumber(x,y,Number(d.damage),'received');});
window.addEventListener('abyssal-rift-checkpoint-respawn',ev=>{const d=ev.detail||{};if(!player||!isRiftRun())return;player.x=Number(d.x)||player.x;player.y=Number(d.y)||player.y;player.trail.length=0;hp=Number(d.hp)||maxHp;player.invuln=Math.max(player.invuln,3.2);damageFlash=.3;burst(player.x,player.y,'#a4e9ff',22,145);updateCamera();updateHud();enqueueGameplayNotice('cave','CHECKPOINT ATIVADO','Você renasceu no início da sala atual, mantendo a expedição.',84);});
window.addEventListener('abyssal-pvp-hit',ev=>{const d=ev.detail||{};if(Number(d.damage)<=0)return;const selfId=window.AbyssalOnline?.getSocketId?.();if(selfId&&String(d.targetId)===String(selfId))return;const predictedKey='pvp:'+String(d.actionId||'')+':'+String(d.targetId||'');if(d.actionId&&predictedCombatHits.delete(predictedKey))return;const px=Number(d.x)*W,py=Number(d.y)*H;if(Number.isFinite(px)&&Number.isFinite(py))spawnDamageNumber(px,py,Number(d.damage),'received');});

window.addEventListener('abyssal-world-damaged',ev=>applyWorldEnemyDamage(ev.detail));
window.addEventListener('abyssal-world-damaged-batch',ev=>applyWorldEnemyDamageBatch(ev.detail));
window.addEventListener('abyssal-rift-tentacle-aim',ev=>{
 const d=ev.detail||{};
 if(!RIFT_HARDCORE||!Array.isArray(activeRiftHazards))return;
 const hazard=activeRiftHazards.find(h=>h.id===d.id);
 if(hazard)RIFT_HARDCORE.aimTentacle(hazard,Number(d.cycle)||0,d.aimX,d.aimY);
});
window.addEventListener('abyssal-world-damage-result',ev=>{const d=ev.detail||{};if(d.ok){applyWorldEnemyDamage(d);return;}const reason=String(d.reason||'');if(['not-in-room','not-connected','enemy-not-found','ack-timeout'].includes(reason))return;const now=performance.now();if(onlineMode&&now-lastDamageWarningAt>15000){lastDamageWarningAt=now;console.warn('[Abyssal] Dano online rejeitado:',reason);}});
window.addEventListener('abyssal-boss-ability-visual',ev=>{
 const d=ev.detail||{};renderBossAbilityVisual({abilityId:d.abilityId,kind:d.kind,x:Number(d.x)*W,y:Number(d.y)*H,angle:Number(d.angle)||0,radius:Number(d.radius)||0,color:d.color});
});
window.addEventListener('abyssal-boss-warning',ev=>{
 const d=ev.detail||{};if(!d.kind)return;
 if(onlineMode&&onlineRoomMode==='pvp')return;
 if(onlineMode){progressionDistance=100;progressionPausedForBoss=true;activeBossEntities=[{id:d.id,kind:d.kind}];activeBossEntity=activeBossEntities[0];updateProgressionTrackUI();}
 const warningAlreadyShown=pendingProgressionBossWarningKind===d.kind&&(performance.now()-pendingProgressionBossWarningAt)<12000;
 if(warningAlreadyShown){pendingProgressionBossWarningKind=null;pendingProgressionBossWarningAt=0;return;}
 showBossAlert(d.kind,d.id,d.threat,true);
});
window.addEventListener('abyssal-world-defeated',ev=>{const e=ev.detail;if(!e)return;onlineEnemyById.delete(String(e.id));aquaticMotionTracker?.forget?.(e.id);const deadId=String(e.id);const deadIndex=enemies.findIndex(enemy=>String(enemy.id)===deadId);if(deadIndex>=0)enemies.splice(deadIndex,1);const bosses=BOSS_KINDS.includes(e.kind)||e.boss===true;if(bosses){bossKillsThisRun++;if(onlineMode&&onlineRoomMode==='rift'){onlineBossesDefeated=Math.max(onlineBossesDefeated,activeMapTier+1);updateMapInteraction(true);showToast('VÓRTICES LIBERADOS · À ESQUERDA SUPERFÍCIE · À DIREITA DESCIDA');}if(onlineMode&&progressionPausedForBoss){activeBossEntities=[];onProgressionBossDefeated(e);}updateHud();if(!(onlineMode&&onlineRoomMode==='rift'))showToast('ENTIDADE ABISSAL ELIMINADA · +10 ENERGIA');}const x=Number(e.x)||W*.5,y=Number(e.y)||H*.5;burst(x,y,e.color||'#8ffff4',bosses?(e.kind==='kraken'?38:30):10,bosses?225:85);playWorldSound(bosses?'boss-death-'+e.kind:'enemy-death',{x,y},bosses?1200:700,bosses?1:.7);if(bosses)updateHud(true);});
window.addEventListener('abyssal-world-defeated-batch',ev=>{
 const defeated=Array.isArray(ev.detail)?ev.detail:[];if(!defeated.length)return;
 let bossCount=0,bossSoundKind=null;const defeatedIds=new Set();
 for(const enemy of defeated){
  if(!enemy||enemy.id==null)continue;
  const id=String(enemy.id);defeatedIds.add(id);onlineEnemyById.delete(id);aquaticMotionTracker?.forget?.(id);
  const boss=BOSS_KINDS.includes(enemy.kind)||enemy.boss===true;
  if(boss){bossCount++;bossSoundKind ||= enemy.kind;bossKillsThisRun++;}
  const x=Number(enemy.x)||W*.5,y=Number(enemy.y)||H*.5;
  burst(x,y,enemy.color||'#8ffff4',boss?(enemy.kind==='kraken'?8:7):2,boss?190:65);
 }
 if(defeatedIds.size)enemies=enemies.filter(item=>!defeatedIds.has(String(item.id)));
 if(bossCount&&onlineMode&&progressionPausedForBoss){activeBossEntities=[];onProgressionBossDefeated();}
 if(bossCount&&onlineMode&&onlineRoomMode==='rift'){onlineBossesDefeated=Math.max(onlineBossesDefeated,activeMapTier+1);updateMapInteraction(true);showToast('VÓRTICES LIBERADOS · À ESQUERDA SUPERFÍCIE · À DIREITA DESCIDA');}else if(bossCount)showToast(bossCount===1?'ENTIDADE ABISSAL ELIMINADA · +10 ENERGIA':`${bossCount} ENTIDADES ABISSAIS ELIMINADAS`);
 playWorldSound(bossCount?'boss-death-'+bossSoundKind:'enemy-death',player,1200,bossCount?1:.7);updateHud(bossCount>0);
});
let shopPreviewObserver=null;
function renderShop(){
 const shopScroll=$('shopScreen')?.closest('.abyss-visor-body')||$('shopScreen')?.querySelector('.shop-modal'),savedScroll=shopScroll?.scrollTop||0;
 shopPreviewObserver?.disconnect();shopPreviewObserver=null;
 shopMotionObserver?.disconnect();shopMotionObserver=null;shopMotionVisible.clear();
 if('IntersectionObserver' in window){
  shopMotionObserver=new IntersectionObserver(entries=>{
   for(const entry of entries){if(entry.isIntersecting)shopMotionVisible.add(entry.target);else shopMotionVisible.delete(entry.target);}
  },{root:$('shopScreen')?.closest('.abyss-visor-body')||$('shopScreen')?.querySelector('.shop-modal')||null,rootMargin:'0px'});
 }
 if('IntersectionObserver' in window){
  shopPreviewObserver=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){
    const canvas=entry.target,skin=skinData.find(s=>s.id===canvas.dataset.skinId);
    if(skin)renderCreaturePreview(canvas,'player',skin.color,skin);
    shopPreviewObserver?.unobserve(canvas);
   }
  },{root:$('shopScreen')?.closest('.abyss-visor-body')||$('shopScreen')?.querySelector('.shop-modal')||null,rootMargin:'150px 0px'});
 }
 $('coinBalance').textContent=(energyWallet?.get().energy||0).toLocaleString(gameLanguage==='es'?'es-ES':gameLanguage==='en'?'en-US':'pt-BR');const grid=$('skinGrid');if(!grid)return;grid.innerHTML='';
 const currencySelect=$('shopCurrency');if(currencySelect){currencySelect.value=shopCurrency;currencySelect.hidden=false;}
 const english=gameLanguage==='en';
 const shopHeading=document.querySelector('.shop-heading h2');if(shopHeading)shopHeading.innerHTML=english?'SPECIMEN<br><em>CATALOG</em>':'CATÁLOGO DE<br><em>ESPÉCIMES</em>';
 const englishNames={violet:'Violet Wraith',leviathan:'Leviathan Echo',kraken:'Kraken Echo',aberration:'Aberration Husk',angler:'Lantern Core',maw:'Rift Fragment',devourer:'Devourer Core',reefshark:'Great White Shark',hammerhead:'Hammerhead Shark',abysscroc:'Estuarine Bull Shark',armoredgator:'Armored Horseshoe Crab'};
 const englishDescriptions={reefshark:'A great white shark with a gray back, pale belly and crescent fins.',hammerhead:'A hammerhead with a broad cephalofoil and wide-set eyes.',abysscroc:'A robust estuarine bull shark adapted to shallow channels, turbid water and sudden frontal bursts.',armoredgator:'A mineral-armored horseshoe crab with a broad carapace and a long defensive telson.'};
 const paidBrl=Object.freeze(Object.fromEntries(skinData.filter(skin=>skin.paid).map(skin=>[skin.id,skin.price])));
 const searchEl=$('shopSearchInput'),familyEl=$('shopFamilyFilter'),ownershipEl=$('shopOwnershipFilter');
 for(const el of [searchEl,familyEl,ownershipEl])if(el&&!el.dataset.shopFilterBound){el.dataset.shopFilterBound='1';el.addEventListener(el===searchEl?'input':'change',renderShop);}
 const query=String(searchEl?.value||'').trim().toLocaleLowerCase('pt-BR'),familyFilter=familyEl?.value||'all',ownershipFilter=ownershipEl?.value||'all';
 const visibleSkins=skinData.filter(skin=>{
  const owned=ownedSkins.includes(skin.id),rarityId=SPECIMEN_RARITY?.rarityFor(skin.id)||'common',known=specimenShopAvailable(skin),haystack=(known?(skin.name+' '+skin.desc+' '+(skin.ability||'')):'Em desenvolvimento').toLocaleLowerCase('pt-BR');
  return (!query||haystack.includes(query))&&(familyFilter==='all'||rarityId===familyFilter)&&(ownershipFilter==='all'||(ownershipFilter==='owned'?owned:!owned));
 }).sort((a,b)=>{const state=skin=>ownedSkins.includes(skin.id)?0:(specimenShopAvailable(skin)?1:2),sa=state(a),sb=state(b);if(sa!==sb)return sa-sb;const order={common:0,uncommon:1,rare:2,epic:3,legendary:4},ra=order[SPECIMEN_RARITY?.rarityFor(a.id)]??9,rb=order[SPECIMEN_RARITY?.rarityFor(b.id)]??9;if(ra!==rb)return ra-rb;return String(a.name).localeCompare(String(b.name),'pt-BR');});
 const summary=$('shopFilterSummary');if(summary)summary.textContent=`${visibleSkins.length} ESPÉCIMES`;
 visibleSkins.forEach(skin=>{const owned=ownedSkins.includes(skin.id),equipped=equippedSkin===skin.id,currencySymbol=shopCurrency.toUpperCase(),brlAmount=Number(paidBrl[skin.id]??skin.price),amount=shopCurrency==='brl'?brlAmount:Math.round(brlAmount*Number(shopRates[shopCurrency]||0)),price=skin.paid?(shopCurrency==='brl'||Number.isFinite(shopRates[shopCurrency])?new Intl.NumberFormat(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR',{style:'currency',currency:shopCurrency.toUpperCase()}).format(amount/100):(english?'Rate unavailable':'Cotação indisponível')):`${skin.price.toLocaleString(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR')} ⚡`,name=english?(englishNames[skin.id]||skin.name):skin.name;
    const isGreensnake = skin.id === 'greensnake';
    const isEel = skin.id === 'electriceel';
    const eelOwned = ownedSkins.includes('electriceel');
    const conquerorCompleted = ownedSkins.includes('greensnake');
const card=document.createElement('div');const known=specimenShopAvailable(skin);card.className='skin-card'+(!known?' unregistered':'')+(skin.paid?' paid-skin-card':'')+(owned?' owned':'')+(equipped?' equipped':'');const unlockType=SKIN_TAXONOMY[skin.id]?.unlockType||skin.unlockType||'shop';const purchaseLabel=!known?'EM DESENVOLVIMENTO':equipped?(english?'EQUIPPED':'EQUIPADA'):owned?(english?'EQUIP':'EQUIPAR'):unlockType==='mission'?(english?'MISSION REWARD':'RECOMPENSA DE MISSÃO'):unlockType==='promo'?(english?'PROMO CODE':'CÓDIGO PROMOCIONAL'):skin.paid?`${english?'BUY':'COMPRAR'} · ${price}`:`${english?'TAME':'DOMAR'} · ${skin.price.toLocaleString(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR')} ⚡`;const profile=SKIN_STANDARD?.profile(skin.id);
const active=SKIN_STANDARD?.activeSpec(skin.id);
const biological=SPECIMEN_SYSTEM.effectiveStats(skin.id,specimenPoints(skin.id));
const rarity=SPECIMEN_RARITY?.rarityFor(skin.id);
const rarityLabel=rarity?(SPECIMEN_RARITY.LABELS[rarity]||rarity):'Especial';
const attribute=profile?(SKIN_STANDARD.ATTRIBUTE_LABELS[profile.attribute]||profile.attribute):'';
const passive=profile?`${profile.attribute==='defense'?'-':'+'}${profile.percent}% de ${attribute}`:'';
const activeName=english?(active?.nameEn||active?.name||'Unknown'):(active?.name||'Desconhecida');
const shortDescription=String(english?(englishDescriptions[skin.id]||skin.desc):skin.desc).replace(/\s+/g,' ').slice(0,160);
const publicName=known?name:(english?'IN DEVELOPMENT':'EM DESENVOLVIMENTO');
card.innerHTML=`<div class="skin-preview specimen-vessel">
 <canvas class="skin-preview-canvas" width="220" height="178" aria-label="${known?publicName:'Espécime não registrada'}"></canvas>
 ${!known?'<span class="specimen-unknown-stamp">EM DESENVOLVIMENTO</span><span class="specimen-unknown-mark">?</span>':''}
 </div>
 <div class="specimen-card-information">
  <strong class="specimen-card-name">${publicName}</strong>
  <small class="specimen-rarity">${known?rarityLabel.toUpperCase():'???'}</small>
  ${known?`<div class="specimen-card-traits"><div><b>PASSIVA</b><span>${passive}</span></div><div><b>ATIVA</b><span>${activeName}</span></div></div>`:'<div class="specimen-card-unidentified">Registro em desenvolvimento. Esta espécie ainda não está disponível para compra.</div>'}
  ${known?`<div class="journal-stat-row"><span>VIDA <b>${Math.round(biological.hp)}</b></span><span>ATAQUE <b>${Math.round(biological.damage)}</b></span><span>VELOCIDADE <b>${Math.round(biological.speed)}</b></span></div><p class="specimen-card-description">${shortDescription}</p>`:''}
 </div>
 <button ${equipped||!known?'disabled':''}>${purchaseLabel}</button>`;
const preview=card.querySelector('canvas');if(known){preview.dataset.skinId=skin.id;if(shopPreviewObserver)shopPreviewObserver.observe(preview);else renderCreaturePreview(preview,'player',skin.color,skin);}else preview.hidden=true;
const btn=card.querySelector('button');if(!equipped&&known)btn.addEventListener('click',()=>{if(unlockType==='mission'&&!owned){showToast('RECOMPENSA EXCLUSIVA · CONQUISTE O DESAFIO DAS FOSSAS');return;}if(isGreensnake&&!conquerorCompleted){showToast('BLOQUEADA · Conquiste o abismo em 100% para desbloquear esta skin!');return;}if(isEel&&!eelOwned){showToast('BLOQUEADA · Use o código promocional no menu para desbloquear!');return;}if(owned){equippedSkin=skin.id;saveCosmetics();renderShop();showToast(english?'SKIN EQUIPPED':'ESPÉCIME EQUIPADO');playWorldSound('ui-equip');}else if(skin.paid){openSkinPurchaseConfirm(skin.id,name,price,false);}else if(window.AbyssalOnline?.isAuthenticated()){window.AbyssalOnline.purchaseSkin(skin.id)}else if((energyWallet?.get().energy||0)>=skin.price){energyWallet?.debit(skin.price);ownedSkins.push(skin.id);equippedSkin=skin.id;saveCosmetics();renderShop();addNotification('🐚 ' + skin.name + ' desbloqueada! Adquirida com ' + skin.price.toLocaleString('pt-BR') + ' energia na Loja. Equipe-a pelo Catálogo.', 'NOVO ESPÉCIME · LOJA ABISSAL', 'skin');
        updateNotifBadge(); updateNotifBadge();showToast(english?'SKIN UNLOCKED':'ESPÉCIME DESBLOQUEADO');playWorldSound('ui-purchase',null,900,1)}else showToast(english?'NOT ENOUGH ENERGY':'ENERGIA INSUFICIENTE');});grid.appendChild(card);if(known)shopMotionObserver?.observe(preview)});
 const bundleIds=['leviathan','kraken','aberration','angler','maw','devourer'];
 const remainingIds=bundleIds.filter(id=>!ownedSkins.includes(id)),remaining=remainingIds.length;
 const bundleFullBrl=3999;
 const bundleBrlAmount=remaining?Math.round(bundleFullBrl*(remaining/bundleIds.length)):0;
 const bundleAmount=shopCurrency==='brl'?bundleBrlAmount:Math.round(bundleBrlAmount*Number(shopRates[shopCurrency]||0));
 const bundlePrice=(shopCurrency==='brl'||Number.isFinite(shopRates[shopCurrency]))?new Intl.NumberFormat(gameLanguage==='es'?'es-ES':english?'en-US':'pt-BR',{style:'currency',currency:shopCurrency.toUpperCase()}).format(bundleAmount/100):(english?'Rate unavailable':'Cotação indisponível');
 const banner=$('bossBundleBanner');
 if(banner){
  const title=english?'ABYSS BOSS COLLECTION':gameLanguage==='es'?'COLECCIÓN DE JEFES ABISALES':'PACOTE DOS BOSSES ABISSAIS';
  const subtitle=remaining===0?(english?'All 6 relics owned':gameLanguage==='es'?'6 reliquias adquiridas':'6 relíquias adquiridas'):remaining===6?(english?'6 exclusive relics':gameLanguage==='es'?'6 reliquias exclusivas':'6 relíquias exclusivas'):(english?remaining+' of 6 relics remaining · proportional discount':gameLanguage==='es'?remaining+' de 6 reliquias restantes · descuento proporcional':remaining+' de 6 relíquias restantes · desconto proporcional');
  banner.innerHTML=`<svg class="boss-bundle-art" viewBox="0 0 112 76" aria-hidden="true" focusable="false"><defs><linearGradient id="bossBannerInk" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e4baf9"/><stop offset="1" stop-color="#8e63bc"/></linearGradient></defs><g fill="url(#bossBannerInk)" stroke="#dfbaff" stroke-width=".6"><path d="M8 35Q2 25 14 20Q25 17 30 26L37 21 34 31 38 38 27 35Q19 45 9 38Z"/><path d="M14 20Q17 8 28 10L24 20" opacity=".8"/><path d="M47 23Q47 8 57 6Q68 9 69 23L65 30 49 30Z"/><path d="M49 26Q40 37 44 49L48 44 54 31M54 28Q50 42 55 50L58 43 59 30M62 29Q64 44 72 47L69 40 67 28" fill="none" stroke="#bc8ee7" stroke-width="3" stroke-linecap="round"/><path d="M78 27Q84 16 95 19Q106 23 105 34L97 39 84 36 76 42 79 33Z"/><path d="M94 20Q89 10 100 9" fill="none" stroke="#dcadff" stroke-width="1.6"/><circle cx="101" cy="9" r="2.5"/><path d="M13 59Q16 45 29 47Q40 48 39 56Q36 64 25 58L14 68 5 68Z"/><path d="M49 57Q47 44 57 43Q67 43 68 57L62 62 51 62Z"/><path d="M52 60Q44 67 48 72M57 61L57 73M63 60Q71 67 67 72" fill="none" stroke="#bc8ee7" stroke-width="2.6" stroke-linecap="round"/><path d="M79 64Q74 55 83 49Q92 46 102 55L108 50 105 63 95 65 84 61Z"/></g><g fill="#20152e"><circle cx="22" cy="28" r="1.8"/><circle cx="54" cy="21" r="1.8"/><circle cx="63" cy="21" r="1.8"/><circle cx="94" cy="28" r="1.8"/><circle cx="29" cy="53" r="1.8"/><circle cx="54" cy="54" r="1.4"/><circle cx="63" cy="54" r="1.4"/><circle cx="91" cy="56" r="1.8"/></g></svg><div class="boss-banner-copy"><strong>${title}</strong><small>${subtitle}</small><button type="button" ${remaining===0?'disabled':''}>${remaining===0?(english?'COLLECTION COMPLETE':gameLanguage==='es'?'COLECCIÓN COMPLETA':'COLEÇÃO COMPLETA'):(english?'BUY · ':gameLanguage==='es'?'COMPRAR · ':'ADQUIRIR · ')+bundlePrice}</button></div>`;
  banner.querySelector('button').addEventListener('click',()=>{if(remaining)openSkinPurchaseConfirm('boss_bundle','Coleção · Relíquias do Abismo',bundlePrice,true);});
 }
 const metaGrid=$('metaUpgradeGrid');if(metaGrid){metaGrid.textContent='Habilidades Q/E e passivas agora são estudadas no laboratório do submarino. Melhorias adquiridas anteriormente permanecem no perfil.';[].forEach(item=>{const levelNow=Number(metaUpgrades[item.id])||0,ownedMax=levelNow>=item.max,activeEquipped=loadEquippedActiveSkills().includes(item.id);const activeOwned=item.type==='active'&&levelNow>0;const card=document.createElement('article');card.className='meta-card'+(ownedMax?' meta-max':'');const buttonLabel=activeOwned?(activeEquipped?'DESEQUIPAR':'EQUIPAR'):ownedMax?'NÍVEL MÁXIMO':`ADQUIRIR · ${item.price.toLocaleString('pt-BR')} ◈`;card.innerHTML=`<div class="meta-card-icon">${item.icon}</div><div class="meta-card-copy"><div class="meta-kicker">${item.type==='active'?'HABILIDADE ATIVA':'MELHORIA PASSIVA'} · NV. ${levelNow}/${item.max}</div><strong>${item.name}</strong><p>${item.desc}</p></div><button ${ownedMax&&!activeOwned?'disabled':''}>${buttonLabel}</button>`;const button=card.querySelector('button');if(activeOwned){button.addEventListener('click',()=>toggleEquippedActiveSkill(item.id));}else if(!ownedMax){button.addEventListener('click',()=>buyMetaUpgrade(item.id));}metaGrid.appendChild(card);});}
 updateAbilityButtons();drawWheel();startShopMotion();if(shopScroll)shopScroll.scrollTop=savedScroll;
}
function openSpecimenShop({refresh=true}={}){ $('shopScreen').hidden=false;if(refresh&&window.AbyssalOnline?.isAuthenticated?.())window.AbyssalOnline?.refreshAccount?.();renderShop(); }
$('shopBtn').addEventListener('click',openSpecimenShop);
window.AbyssalCockpitCatalog=Object.freeze({open(id){if(id==='shopScreen')openSpecimenShop({refresh:false});else if(id==='catalogScreen')renderCatalog();else if(id==='wheelScreen')openOriginalWheel();}});
$('shopCurrency')?.addEventListener('change',event=>{event.target.value='brl';shopCurrency='brl';renderShop()});
$('languageSelect')?.addEventListener('change',event=>setGameLanguage(event.target.value));
if($('languageSelect'))$('languageSelect').value=gameLanguage;
 $('cockpitLanguageSelect')?.addEventListener('change',event=>setGameLanguage(event.target.value));if($('cockpitLanguageSelect'))$('cockpitLanguageSelect').value=gameLanguage;

let pendingStripePurchase = null, stripeCheckoutBusy=false;
function openSkinPurchaseConfirm(skin, name, priceFormatted, isBundle = false) {
  const skinId = typeof skin === 'string' ? skin : skin?.id;
  if(!skinId||stripeCheckoutBusy)return;
  const modal = $('skinPurchaseConfirmModal');
  if (!modal) { window.AbyssalOnline?.purchaseStripe(skinId,'brl',gameLanguage);return; }
  // The cockpit is its own stacking context. Put the checkout dialog at the document root.
  if(modal.parentElement!==document.body)document.body.append(modal);
  pendingStripePurchase = { skin: { id: skinId, name }, name, priceFormatted, isBundle };
  const desc = $('skinPurchaseConfirmDesc');
  if (desc) {
    desc.textContent = `Você está prestes a adquirir ${name || 'este cosmético'} por ${priceFormatted || ''}. Esta transação será realizada em ambiente seguro da Stripe e adicionará o cosmético permanentemente à sua conta.`;
  }
  const check1 = $('skinBuyCheck1'), confirmBtn = $('skinPurchaseConfirmBtn');
  if (check1) check1.checked = false;
  if (confirmBtn) confirmBtn.disabled = true;
  const status=$('skinPurchaseStatus');if(status)status.textContent='';
  modal.hidden = false;
}
function closeSkinPurchaseConfirm() {
  if(stripeCheckoutBusy)return;
  const modal = $('skinPurchaseConfirmModal');
  if (modal) modal.hidden = true;
  pendingStripePurchase = null;
}
function updateSkinPurchaseBtn() {
  const check1 = $('skinBuyCheck1'), confirmBtn = $('skinPurchaseConfirmBtn');
  if (confirmBtn) confirmBtn.disabled = stripeCheckoutBusy||!check1?.checked;
}
$('skinBuyCheck1')?.addEventListener('change', updateSkinPurchaseBtn);
$('skinPurchaseTopCloseBtn')?.addEventListener('click', closeSkinPurchaseConfirm);
$('skinPurchaseCancelBtn')?.addEventListener('click', closeSkinPurchaseConfirm);
$('skinPurchaseConfirmBtn')?.addEventListener('click', () => {
  const check1 = $('skinBuyCheck1');
  if (!check1?.checked) return;
  const target = pendingStripePurchase;if(!target?.skin||stripeCheckoutBusy)return;
  stripeCheckoutBusy=true;updateSkinPurchaseBtn();
  const status=$('skinPurchaseStatus');if(status)status.textContent='Preparando pagamento em reais…';
  if(!window.AbyssalOnline?.purchaseStripe){stripeCheckoutBusy=false;updateSkinPurchaseBtn();if(status)status.textContent='Serviço de pagamento indisponível. Recarregue o jogo.';return;}
  window.AbyssalOnline.purchaseStripe(target.skin.id,'brl',gameLanguage);
});
$('skinPurchaseConfirmModal')?.addEventListener('click', (e) => {
  if (e.target === $('skinPurchaseConfirmModal')) closeSkinPurchaseConfirm();
});

window.addEventListener('abyssal-payment-result',event=>{stripeCheckoutBusy=false;updateSkinPurchaseBtn();const status=$('skinPurchaseStatus'),modal=$('skinPurchaseConfirmModal');if(!event.detail?.ok){const message=event.detail?.message||'Pagamento indisponível.';if(status&&modal&&!modal.hidden)status.textContent=message;else showToast(message);if(event.detail?.requiresLogin){closeSkinPurchaseConfirm();window.AbyssalOnline?.openLogin?.();}}});
const redeemCodeBtn=$('redeemCodeBtn');
function openRedeemCodeModal(){const modal=$('redeemCodeScreen');if(!modal)return;modal.hidden=false;const input=$('redeemCodeInput'),message=$('redeemCodeMessage'),choice=$('redeemSkinChoice');if(input){input.disabled=false;input.value='';}if(choice)choice.hidden=true;if(redeemCodeBtn){redeemCodeBtn.disabled=false;redeemCodeBtn.textContent='RESGATAR CÓDIGO';}if(message)message.textContent='';requestAnimationFrame(()=>input?.focus());}
function closeRedeemCodeModal(){const modal=$('redeemCodeScreen');if(modal)modal.hidden=true;}
$('openRedeemCodeBtn')?.addEventListener('click',openRedeemCodeModal);
$('redeemCodeCloseBtn')?.addEventListener('click',closeRedeemCodeModal);
$('redeemCodeBackBtn')?.addEventListener('click',closeRedeemCodeModal);
$('redeemCodeScreen')?.addEventListener('click',event=>{if(event.target===$('redeemCodeScreen'))closeRedeemCodeModal();});
window.addEventListener('abyssal-code-redeem-result',event=>{const result=event.detail||{},message=$('redeemCodeMessage'),input=$('redeemCodeInput'),choice=$('redeemSkinChoice'),select=$('redeemSkinSelect');if(!message)return;
 if(result.choiceRequired){
  const eligible=new Set(Array.isArray(result.eligibleSkinIds)?result.eligibleSkinIds:[]);
  const available=skinData.filter(skin=>eligible.has(skin.id)&&!ownedSkins.includes(skin.id));
  if(select){select.textContent='';const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Selecione sua skin';select.appendChild(placeholder);for(const skin of available.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))){const option=document.createElement('option');option.value=skin.id;option.textContent=skin.name+(skin.paid?' · PREMIUM':'');select.appendChild(option);}}
  if(choice)choice.hidden=false;
  if(input)input.disabled=true;
  if(redeemCodeBtn){redeemCodeBtn.textContent='DESBLOQUEAR SKIN ESCOLHIDA';redeemCodeBtn.disabled=!available.length;}
  message.textContent=available.length?(result.message||'Escolha uma skin e confirme o resgate.'):'Você já possui todas as skins elegíveis.';
  return;
 }
 if(result.ok){
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
    if(result.account)energyWallet?.setAccount(result.account.nickname,result.account.energy);
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
 const input=$('redeemCodeInput'),message=$('redeemCodeMessage'),choice=$('redeemSkinChoice'),skinSelect=$('redeemSkinSelect'),code=String(input?.value||'').trim();
 if(!message||!input)return;
 if(!code){message.textContent='DIGITE UM CÓDIGO PARA RESGATAR.';input.focus();return;}
 if(!window.AbyssalOnline?.isAuthenticated()){message.textContent='ENTRE NA SUA CONTA PARA RESGATAR CÓDIGOS.';return;}
 if(choice&&!choice.hidden){
  const skinId=String(skinSelect?.value||'');
  if(!skinId){message.textContent='ESCOLHA A SKIN ANTES DE CONFIRMAR.';skinSelect?.focus();return;}
  window.AbyssalOnline.redeemCode(code,skinId);
  return;
 }
 window.AbyssalOnline.redeemCode(code);
}
if(redeemCodeBtn)redeemCodeBtn.addEventListener('click',redeemAbyssalCode);
$('redeemCodeInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();redeemAbyssalCode();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('redeemCodeScreen')?.hidden)closeRedeemCodeModal();});

$('skillPulseBtn')?.addEventListener('click',()=>activateAbility('pulse'));$('skillDashBtn')?.addEventListener('click',()=>activateAbility('dash'));$('skinActiveBtn')?.addEventListener('click',event=>activateSkinAbility(event));
const catalogBtn=$('catalogBtn');if(catalogBtn)catalogBtn.addEventListener('click',renderCatalog);const rankingsBtn=$('rankingsBtn');if(rankingsBtn)rankingsBtn.addEventListener('click',()=>{if(window.AbyssalCockpitNavigation?.routeScreen?.('rankingsScreen'))return;const el=$('rankingsScreen');if(el)el.hidden=false;if(window.AbyssalOnline?.loadRankings)window.AbyssalOnline.loadRankings()});const catalogClose=$('catalogCloseBtn');if(catalogClose)catalogClose.addEventListener('click',()=>{$('catalogScreen').hidden=true});const rankingsClose=$('rankingsCloseBtn');if(rankingsClose)rankingsClose.addEventListener('click',()=>{$('rankingsScreen').hidden=true});

const resonanceSkillLabels={power:['✦','Pulso Intenso'],rate:['≋','Ressonância Veloz'],speed:['➤','Propulsão Abissal'],range:['◎','Olho Profundo'],magnet:['⌁','Campo Magnético'],regen:['♧','Membrana Viva'],shield:['◉','Escudo Espectral'],burst:['✺','Pulso de Ruptura'],electric:['ϟ','Tempestade Elétrica'],pierce:['➵','Lança do Abismo'],ricochet:['⤴','Ricochete Caótico'],spread:['✣','Rajada Prismática'],photon:['☄','Lança de Fótons'],photonRay:['⌁⃒','Raio de Fótons'],nova:['⊛','Nova Gravitacional'],echoShot:['⋔','Eco de Maré'],shell:['▰','Carapaça Abissal'],ward:['◇','Véu de Maré'],lastStand:['♥','Último Fôlego'],pressureCocoon:['⬡','Casulo de Pressão'],vitality:['♢','Reserva Vital'],predator:['☠','Instinto Predatório'],closePressure:['⌾','Pressão de Caça']};
const resonanceSkillDescriptions={power:'+50% de dano dos disparos por nível.',rate:'+28% de cadência por nível.',speed:'+18% de velocidade de movimento por nível.',range:'+22% de alcance dos disparos por nível.',magnet:'+8% de experiência recebida por nível.',regen:'Recupera vida gradualmente durante o mergulho.',shield:'Adiciona uma carga que bloqueia o próximo dano, até 3.',burst:'Explosão periódica de dano ao redor do jogador.',electric:'Corrente elétrica com até 3 saltos de dano reduzido.',pierce:'Arpão pesado que atravessa inimigos alinhados.',ricochet:'Projéteis saltam para outros alvos próximos.',spread:'Nv. 1/2/3: +2/+4/+6 disparos em leque, ou feixes laterais do Raio de Fótons (42% do dano, sem acúmulo no mesmo alvo), ou estilhaços radiais da Nova (28% do dano distribuído entre eles).',photon:'Dardo fotônico extremamente rápido e focado em alvo único.',photonRay:'Feixe automático contínuo no inimigo mais próximo.',nova:'Pulso gravitacional que atinge todos dentro do alcance.',echoShot:'Dois projéteis paralelos de maré com dano dividido e trajetória estreita.',shell:'Reduz o dano recebido em 8% por nível, até 24%.',ward:'Invulnerabilidade automática breve com recarga decrescente.',lastStand:'Com até 30% de vida, reduz dano recebido em 20%, 25% ou 30%, segundo o nível.',pressureCocoon:'Com escudo zerado, recompõe 1 carga após 24, 20 ou 16 segundos.',vitality:'+10% de vida máxima por nível e cura o valor acrescentado.',predator:'+14% de dano por nível em chefes e elites, +3% em comuns e +6% extra contra alvos com até 30% de vida.',closePressure:'+18% de dano por nível contra inimigos a menos de 175 unidades.'};
function resonanceCategoryOf(id){for(const [category,ids] of Object.entries(RESONANCE_CATEGORIES))if(ids.includes(id))return category;return 'buffs';}
function resonanceCounts(ids=resonancePresets[resonanceEditingMode]||[]){ids=ids.filter(id=>resonanceAvailable(id,resonanceEditingMode));return {shots:ids.filter(id=>RESONANCE_CATEGORIES.shots.includes(id)).length,passive:ids.filter(id=>RESONANCE_CATEGORIES.passive.includes(id)).length,buffs:ids.filter(id=>RESONANCE_CATEGORIES.buffs.includes(id)).length,total:ids.length};}
function renderResonanceChoices(){const root=$('resonanceSkillChoices');if(!root)return;const resonanceScroll=root.closest('.abyss-visor-body')||root.closest('.resonance-modal'),savedResonanceScroll=resonanceScroll?.scrollTop||0;root.replaceChildren();for(const [category,heading] of [['shots','DISPAROS · ESCOLHA EXATAMENTE 1'],['passive','PASSIVAS'],['buffs','BUFFS']]){const section=document.createElement('section');section.className='resonance-category';const title=document.createElement('h3');title.className='resonance-category-title';title.textContent=heading;section.append(title);const list=document.createElement('div');list.className='resonance-category-list';for(const id of RESONANCE_CATEGORIES[category]){const [icon,label]=resonanceSkillLabels[id],row=document.createElement('label');row.className='resonance-skill-option resonance-'+category;row.dataset.skill=id;row.title=resonanceSkillDescriptions[id]||'';const input=document.createElement('input');input.type='checkbox';input.value=id;const available=resonanceAvailable(id,resonanceEditingMode),fixedStarter=resonanceEditingMode==='pve'&&['range','regen'].includes(id);input.checked=fixedStarter||(available&&resonancePresets[resonanceEditingMode].includes(id));input.disabled=!available||fixedStarter;row.classList.toggle('resonance-locked',!available);row.classList.toggle('resonance-starter',fixedStarter);input.setAttribute('aria-label',label+(available?'':' · PESQUISA BLOQUEADA'));input.addEventListener('change',()=>{const current=resonancePresets[resonanceEditingMode];if(category==='shots'&&!input.checked&&current.includes(id)){input.checked=true;$('resonanceMessage').textContent='Você precisa manter exatamente 1 disparo selecionado.';return;}let next=current.filter(value=>value!==id);if(input.checked){if(category==='shots')next=next.filter(value=>!RESONANCE_CATEGORIES.shots.includes(value));if(next.length>=7){input.checked=false;$('resonanceMessage').textContent='O limite total é de 7 habilidades.';return;}next.push(id);}resonancePresets[resonanceEditingMode]=normalizeResonancePresets({...resonancePresets,[resonanceEditingMode]:next})[resonanceEditingMode];resonanceEditedInSession=true;saveResonancePresets();$('resonanceMessage').textContent='';if(category==='shots')renderResonanceChoices();else updateResonanceCount();});const badge=document.createElement('span');badge.className='resonance-skill-icon';badge.textContent=icon;badge.setAttribute('aria-hidden','true');const copy=document.createElement('span');copy.className='resonance-skill-copy';const name=document.createElement('strong');name.textContent=label;const description=document.createElement('small');description.textContent=resonanceSkillDescriptions[id]||'Habilidade de combate abissal.';copy.append(name,description);row.append(input,badge,copy);if(!available&&resonanceEditingMode==='pve'){const research=document.createElement('button');research.type='button';research.className='resonance-research-action';const price=window.AbyssalSoloBase?.cost(id)||0,energy=window.AbyssalSoloProgress?.get().energy||0;research.innerHTML='<strong>DESBLOQUEAR HABILIDADE</strong><span>'+price+' ⚡ ENERGIA · '+(energy>=price?'DISPONÍVEL':'FALTAM '+(price-energy))+'</span>';research.disabled=energy<price;research.setAttribute('aria-label','Desbloquear '+label+' por '+price+' energia');research.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const result=window.AbyssalSoloBase?.research(id);if(result?.ok){window.dispatchEvent(new CustomEvent('abyssal-solo-research-change'));$('resonanceMessage').textContent='Pesquisa concluída: '+label;}else $('resonanceMessage').textContent='Energia insuficiente para esta pesquisa.';});row.append(research);}list.append(row);}section.append(list);root.append(section);}const modal=document.querySelector('#resonanceScreen .resonance-modal');if(modal)modal.classList.toggle('resonance-pvp-theme',resonanceEditingMode==='pvp');updateResonanceCount();document.querySelectorAll('[data-resonance-mode]').forEach(b=>{const active=b.dataset.resonanceMode===resonanceEditingMode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});if(resonanceScroll)resonanceScroll.scrollTop=savedResonanceScroll;}
const RESONANCE_FUSION_RECIPES=Object.freeze([
 {id:'gravitationalRupture',name:'RUPTURA GRAVITACIONAL',items:[['nova','Nova Gravitacional'],['burst','Pulso de Ruptura']]},
 {id:'arcChain',name:'CADEIA DE ARCOS',items:[['electric','Tempestade Elétrica'],['ricochet','Ricochete Caótico']]},
 {id:'abyssEye',name:'OLHO DO ABISMO',items:[['pierce','Lança do Abismo'],['range','Olho Profundo']]},
 {id:'vitalDrain',name:'DRENO VITAL',items:[['regen','Membrana Viva'],['power','Pulso Intenso']]},
 {id:'photonCascade',name:'CASCATA PRISMÁTICA',items:[['photon','Lança de Fótons'],['spread','Rajada Prismática']]},
 {id:'tidalEcho',name:'MARÉ REVERBERANTE',items:[['echoShot','Eco de Maré'],['ricochet','Ricochete Caótico']]},
 {id:'hadalBeam',name:'FEIXE HADAL',items:[['photonRay','Raio de Fótons'],['range','Olho Profundo']]}
]);
function renderResonanceFusionGuide(){
 const root=$('resonanceFusionGuide');if(!root)return;
 const selected=new Set(resonancePresets[resonanceEditingMode]||[]);
 root.replaceChildren();
 const title=document.createElement('h3');title.className='resonance-fusion-heading';
 title.textContent='✦ FUSÕES DE OURO · COMO DESPERTAR';root.append(title);
 const description=document.createElement('p');description.className='resonance-fusion-explainer';
 description.textContent='Selecione as duas habilidades exigidas e alcance o nível 3 em ambas durante o mergulho. O disparo único continua valendo.';root.append(description);
 const grid=document.createElement('div');grid.className='resonance-fusion-grid';root.append(grid);
 for(const recipe of RESONANCE_FUSION_RECIPES){
  const entry=document.createElement('article');entry.className='resonance-fusion-recipe';
  const ready=recipe.items.every(([id])=>selected.has(id));
  entry.classList.toggle('ready',ready);
  const name=document.createElement('strong');name.textContent=recipe.name;
  const combo=document.createElement('p');combo.textContent=recipe.items.map(([,name])=>name+' NV. 3').join(' + ');
  const status=document.createElement('small');
  const missing=recipe.items.filter(([id])=>!selected.has(id)).map(([,name])=>name);
  status.textContent=ready?'✓ CONFIGURAÇÃO PRONTA PARA EVOLUIR':'FALTA NA SELEÇÃO: '+missing.join(' + ');
  entry.append(name,combo,status);grid.append(entry);
 }
}
function updateResonanceCount(){const counts=resonanceCounts();const el=$('resonanceSelectionCount');if(el)el.textContent=counts.shots+' Disparos · '+counts.passive+' Passivas · '+counts.buffs+' Buffs · '+counts.total+'/7';renderResonanceFusionGuide();}
$('resonanceBtn')?.addEventListener('click',()=>{if(window.AbyssalCockpitNavigation?.routeScreen?.('resonanceScreen'))return;resonanceEditingMode='pve';$('resonanceMessage').textContent='';renderResonanceChoices();$('resonanceScreen').hidden=false;});
document.querySelectorAll('[data-resonance-mode]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.resonanceMode==='pvp')return;resonanceEditingMode=b.dataset.resonanceMode;renderResonanceChoices();$('resonanceMessage').textContent='';}));
$('saveResonanceBtn')?.addEventListener('click',()=>{if(resonanceEditingMode==='pvp')return;const counts=resonanceCounts();if(counts.shots!==1){$('resonanceMessage').textContent='Selecione exatamente 1 disparo.';renderResonanceChoices();return;}if(!resonancePresets[resonanceEditingMode].length){$('resonanceMessage').textContent='Selecione pelo menos uma habilidade.';return;}saveResonancePresets();$('resonanceMessage').textContent='Combinação '+resonanceEditingMode.toUpperCase()+' salva!';updateResonanceCount();});
document.querySelectorAll('[data-close-screen="resonanceScreen"]').forEach(b=>b.addEventListener('click',()=>$('resonanceScreen').hidden=true));renderResonanceChoices();

let journalPreviewObserver=null;
function renderCatalog(){
 const el=$('catalogScreen'),grid=$('catalogGrid');if(!el||!grid)return;const catalogScroll=el.closest('.abyss-visor-body')||el.querySelector('.codex-modal'),savedCatalogScroll=catalogScroll?.scrollTop||0;el.hidden=false;
 journalPreviewObserver?.disconnect();journalPreviewObserver=null;
 const codex=getAbyssalCodex();
 const monsterData={
  drifter:{name:'Errante Luminescente',color:'#ff769d',hp:72,speed:51,damage:8,ability:'Choque Bio-Ondulatório: contato causa 8% mais dano e 0,65 s de neurochoque; recarga 0,95 s.',desc:'Ctenóforo translúcido que descarrega pulsos nervosos quando encosta na presa.'},
  stinger:{name:'Ferrão de Fenda',color:'#ffbc78',hp:65,speed:125,damage:7,ability:'Ferrão Venenoso: contato causa 16% mais dano, aplica 1,1 s de neurotoxina e pode atacar a cada 0,64 s.',desc:'Peixe-ferrão veloz, construído para perfurar e recuar antes da reação da presa.'},
  brute:{name:'Bruto de Placas',color:'#bd88ff',hp:115,speed:30,damage:15,ability:'Pinça Esmagadora: contato causa 28% mais dano; carapaça pesada mantém alta pressão de curto alcance.',desc:'Isópode titânico com placas sobrepostas e pinças capazes de esmagar a defesa frontal.'},
  lurker:{name:'Predador Sombrio',color:'#6e8dff',hp:165,speed:45,damage:19,ability:'Mordida Gular: contato causa 22% mais dano com uma mordida expansiva; recarga 0,84 s.',desc:'Enguia gulper predatória cuja boca se abre além do diâmetro do próprio corpo.'},
  whiteShark:{name:'Tubarão-branco',color:'#91c4ce',hp:600,speed:300,damage:30,ability:'Caçada por campo de visão: patrulha, detecta a presa e a persegue continuamente em velocidade máxima, contornando obstáculos.',desc:'Predador pelágico resistente, rápido e territorial. Mantém a perseguição após detectar uma presa e busca uma rota livre entre as rochas.'},
  boss:{name:'Polvo-de-Anéis-Azuis Colossal',color:'#338cff',hp:5640,speed:52,damage:25,ability:'Tinta Abissal: deixa continuamente manchas de tinta negra no trajeto; atravessar o rastro causa dano.',desc:'Polvo colossal azul, coberto por anéis bioluminescentes, com oito braços pendentes e um rastro de tinta letal.'},
  angler:{name:'Peixe-Pescador Abissal',color:'#ffb45e',hp:6520,speed:66,damage:28,ability:'Camuflagem Abissal: só a isca permanece visível durante 10 s invisível; transições de 3 s e 10 s de recarga.',desc:'Peixe-pescador colossal de boca permanentemente escancarada e isca intensamente bioluminescente.'},
  maw:{name:'Enguia-Pelícano Colossal',color:'#c16cff',hp:7500,speed:58,damage:31,ability:'Mordida Gular: a cada 4 s abre a bolsa em 205 px e causa 24 de dano ao redor.',desc:'Enguia-pelícano colossal com bolsa gular expansiva e dentes internos luminescentes.'},
  leviathan:{name:'Peixe-Remo Leviatã',color:'#4ce0d1',hp:9400,speed:44,damage:34,ability:'Lança de Pressão: a cada 4,8 s atravessa 480 px em linha, com faixa de 72 px e 22 de dano.',desc:'Peixe-remo colossal que comprime a água em corredores lineares antes de atravessar a fossa.'},
  whiteSharkBoss:{name:'Tubarão-branco Colossal',color:'#68a8b8',hp:13200,speed:400,damage:47,ability:'Frenesi Predatório: detecta a presa pelo cone frontal, investe em linha reta e recalcula o ricochete ao colidir com paredes ou obstáculos.',desc:'A lenda das trincheiras abissais. Um predador colossal que usa as paredes para redirecionar investidas.'},
  kraken:{name:'Lula-Kraken das Fossas',color:'#8b5cf6',hp:18400,speed:20,damage:38,ability:'Varredura Tentacular Óctupla: oito tentáculos afiados que cortam em espiral.',desc:'Lula gigantesca inspirada em cefalópodes de profundidade, com oito braços usados em varreduras circulares.'},
  riftSmile:{name:'Pesadelo Roxo',color:'#ba61e6',hp:52000,speed:0,damage:50,ability:'Oito tentáculos das paredes com trajetórias curvas que procuram jogadores e causam dano na ida e na volta; 50 de dano por contato com a cabeça.',desc:'Polvo colossal imóvel da última fossa: manto roxo musculoso, olhos negros pontudos com íris amarelas de gato e oito braços que emergem das paredes. Imune aos próprios tentáculos.'},
  devourer:{name:'Lula-Colossal do Vazio',color:'#39d8c4',hp:30000,speed:14,damage:42,ability:'Vórtice de Sucção Residual: suga tudo ao redor em um raio colossal a cada 20 segundos.',desc:'Lula-colossal fictícia cujo manto gera um pulso de sucção capaz de inverter correntes locais.'}
 };
 for(const [kind,entry] of Object.entries(monsterData)){const live=window.AbyssalEnemyAI?.ENEMY_STATS?.[kind];if(!live)continue;entry.hp=kind==='whiteShark'?600:SOLO_INITIAL_KINDS.includes(kind)?(Number(live.hp)||0)+50:Number(live.hp)||entry.hp;entry.damage=Number(live.damage)||entry.damage;entry.speed=Number(live.dashSpeed ?? live.speed ?? entry.speed);}
 const skillCopy={power:'Aumenta o dano de cada projétil.',rate:'Reduz o intervalo entre disparos automáticos.',speed:'Aumenta a velocidade de movimento.',range:'Afasta a câmera, amplia a visão e o alcance dos tiros e das ondas em 22% por nível.',abyssEye:'Olho do Abismo: alcance de disparo pelo mapa inteiro; o projétil para ao colidir.',vitalDrain:'Dreno Vital: recupera 2% do dano causado como vida.',magnet:'Aumenta a experiência recebida em 8% por nível.',regen:'Recupera vitalidade gradualmente.',shield:'Adiciona cargas que absorvem impactos.',burst:'Libera periodicamente uma onda de energia ao redor do jogador.',electric:'Faz os tiros encadearem arcos elétricos em inimigos próximos.',pierce:'Permite atravessar uma criatura adicional por nível, sem multiplicar o dano.',ricochet:'Faz arcos de energia saltarem para alvos próximos.',spread:'Passiva prismática que espalha dano entre alvos próximos sem alterar o disparo escolhido.',nova:'Libera periodicamente uma explosão circular de grande alcance.'};

 const renderMonster=([k,m],index)=>{
  const known=codex.monsters.includes(k),boss=BOSS_KINDS.includes(k),ability=m.ability||'';
  const split=ability.indexOf(': '),attack=split>=0?ability.slice(0,split):'Comportamento de combate',effect=split>=0?ability.slice(split+2):ability;
  return '<article class="codex-card specimen-journal-entry '+(known?'unlocked':'locked')+'" data-journal-monster="'+escapeHtml(k)+'">'
   +'<small class="journal-page-no">FOLHA '+String(index+1).padStart(3,'0')+' · '+(known?'REGISTRO':'LACRADO')+'</small>'
   +'<div class="codex-preview journal-creature" style="--preview:'+escapeHtml(m.color)+'">'+(known?'<canvas width="200" height="126" data-monster-preview="'+escapeHtml(k)+'" aria-label="Ilustração de '+escapeHtml(m.name)+'"></canvas>':'<span class="journal-sealed">NÃO REGISTRADO</span>')+'</div>'
   +'<b class="journal-specimen-title">'+(known?escapeHtml(m.name):'Forma desconhecida')+'</b>'
   +(known?'<small class="journal-classification">'+(boss?'ENTIDADE COLOSSAL':'FAUNA EXTERNA')+' · HABITAT: CAVERNAS ABISSAIS</small>'
    +'<div class="journal-stat-row"><span><b>VIDA</b> '+m.hp.toLocaleString('pt-BR')+'</span><span><b>DANO</b> '+m.damage+'</span><span><b>VELOCIDADE</b> '+m.speed+'</span></div>'
    +'<p class="journal-handwritten">Ataque: '+escapeHtml(attack)+'</p>'
    +'<p><b>Efeito:</b> '+escapeHtml(effect)+'</p><p class="journal-description"><b>História:</b> '+escapeHtml(m.desc)+'</p>'
    :'<p class="journal-handwritten">Registro incompleto. Observe esta criatura durante um mergulho para revelar sua identidade e comportamento.</p>')
   +'</article>';
 };

 const comboHtml=Object.values(COMBO_SKILLS).map(combo=>{const recipe=combo.id==='gravitationalRupture'?'Nova gravitacional Nv. 3 + Pulso de Ruptura Nv. 3':combo.id==='arcChain'?'Tempestade Elétrica Nv. 3 + Ricochete Caótico Nv. 3':combo.id==='abyssEye'?'Lança do Abismo Nv. 3 + Olho Profundo Nv. 3':'Membrana Viva Nv. 3 + Pulso Intenso Nv. 3';return `<article class="codex-card combo-codex-card special unlocked"><div class="combo-rarity">✦ FUSÃO ESPECIAL</div><div class="codex-preview skill-preview combo-preview" style="--preview:${combo.id==='arcChain'?'#75f3ff':'#c5a0ff'}">${combo.icon}</div><b>${combo.name}</b><p>${combo.desc}</p><small class="combo-recipe">COMBINAÇÃO · ${recipe}</small></article>`}).join('');
 const skillsHtml=upgradeList.map(u=>{const known=codex.skills.includes(u.id);return `<article class="codex-card ${known?'unlocked':'locked'}"><div class="codex-preview skill-preview" style="--preview:${known?'#9cecff':'#263747'}">${known?u.icon:'?'}</div><b>${known?u.name:'Ressonância desconhecida'}</b><p>${known?(skillCopy[u.id]||u.desc):'Descubra esta habilidade durante um mergulho para revelar seus efeitos.'}</p></article>`}).join('');
 const entries=Object.entries(monsterData),common=entries.filter(([k])=>!BOSS_KINDS.includes(k)),bosses=entries.filter(([k])=>BOSS_KINDS.includes(k));
 const journalSkins=[...skinData].sort((a,b)=>{const state=skin=>ownedSkins.includes(skin.id)?0:(specimenShopAvailable(skin)?1:2),sa=state(a),sb=state(b);if(sa!==sb)return sa-sb;return String(a.name).localeCompare(String(b.name),'pt-BR');});
 const specimenCards=journalSkins.map((skin,index)=>{
  const known=specimenShopAvailable(skin);
  const b=SPECIMEN_SYSTEM.effectiveStats(skin.id,specimenPoints(skin.id));
  const family=SPECIMEN_SYSTEM.FAMILY_LABELS[b.family]||b.family;
  const oceanHabitat=OPEN_SEA_ECOLOGY?.speciesHabitat?.(skin.id);
  const rarity=SPECIMEN_RARITY?.rarityFor(skin.id);
  const rarityLabel=rarity?SPECIMEN_RARITY.LABELS[rarity]||rarity:'Singular';
  return '<article class="codex-card specimen-journal-entry '+(known?'unlocked':'locked')+'">'
   +'<small class="journal-page-no">FOLHA '+String(common.length+index+1).padStart(3,'0')+' · '+(known?'REGISTRO':'LACRADO')+'</small>'
   +'<div class="codex-preview journal-creature">'+(known?'<canvas width="200" height="126" data-specimen-preview="'+escapeHtml(skin.id)+'" aria-label="Ilustração de '+escapeHtml(skin.name)+'"></canvas>':'<span class="journal-sealed">NÃO REGISTRADO</span>')+'</div>'
   +'<b class="journal-specimen-title">'+(known?escapeHtml(skin.name):'Forma desconhecida')+'</b>'
   +(known?'<small class="journal-classification">'+(oceanHabitat?'HABITAT: '+escapeHtml(oceanHabitat.name)+' · PROFUNDIDADE: '+oceanHabitat.minDepth+' a '+oceanHabitat.maxDepth+' m':'AVISTAMENTO: HABITAT NÃO REGISTRADO')+'</small>'
    +'<div class="journal-stat-row"><span><b>VIDA</b> '+Math.round(b.hp)+'</span><span><b>DANO</b> '+Math.round(b.damage)+'</span><span><b>VELOCIDADE</b> '+Math.round(b.speed)+'</span></div>'
    +'<p class="journal-handwritten">Ataque: '+escapeHtml(b.attack)+'</p>'
    +'<p><b>Efeito:</b> '+escapeHtml(b.effect)+'</p><p class="journal-description">'+escapeHtml(skin.desc)+'</p>'
    :'<p class="journal-handwritten">Avistamento pendente nas Fossas Abissais.</p>')
   +'</article>';
 }).join('');
 const found=skinData.filter(s=>s.id==='default'||discoveredSpecimens.has(s.id)).length,foundMonsters=entries.filter(([kind])=>codex.monsters.includes(kind)).length;
 const commonCards=common.map((entry,index)=>renderMonster(entry,index)).join('');
 const bossCards=bosses.map((entry,index)=>renderMonster(entry,common.length+journalSkins.length+index)).join('');
 grid.innerHTML='<div class="journal-progress">CADERNO EM CONSTRUÇÃO · '+(found+foundMonsters)+' DE '+(skinData.length+entries.length)+' REGISTROS BIOLÓGICOS</div>'
  +'<h3 class="codex-heading">I · REGISTROS ABISSAIS</h3><div class="codex-grid journal-specimen-grid">'+commonCards+specimenCards+'</div>'
  +'<h3 class="codex-heading">II · ENTIDADES COLOSSAIS</h3><div class="codex-grid journal-specimen-grid">'+bossCards+'</div>';
 const previewCanvases=[...grid.querySelectorAll('canvas[data-specimen-preview],canvas[data-monster-preview]')];
 const paintJournalCreature=canvas=>{
  if(canvas.dataset.specimenPreview){
   const skin=skinData.find(s=>s.id===canvas.dataset.specimenPreview);
   if(skin)renderCreaturePreview(canvas,'player',skin.color,skin);
  }else{
   const kind=canvas.dataset.monsterPreview,m=monsterData[kind];
   if(m)renderCreaturePreview(canvas,kind,m.color,null);
  }
 };
 if('IntersectionObserver' in window){
  journalPreviewObserver=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){
    paintJournalCreature(entry.target);journalPreviewObserver?.unobserve(entry.target);
   }
  },{root:el.closest('.abyss-visor-body')||el.querySelector('.codex-modal'),rootMargin:'140px 0px'});
  previewCanvases.forEach(canvas=>journalPreviewObserver.observe(canvas));
 }else previewCanvases.forEach(paintJournalCreature);
 if(catalogScroll)catalogScroll.scrollTop=savedCatalogScroll;
}

$('shopCloseBtn').addEventListener('click',()=>{$('shopScreen').hidden=true});
$('shopTopCloseBtn')?.addEventListener('click',()=>{$('shopScreen').hidden=true});

window.addEventListener('abyssal-authenticated',ev=>{const target=window.AbyssalOnlinePendingStart;if(!target||ev.detail?.restoringRoom)return;$('loginScreen').hidden=true;if(target==='MERGULHO-ONLINE'){if(!$('ageTermsScreen')?.hidden)return;window.AbyssalOnlinePendingStart=false;window.AbyssalOnline?.showRooms();}else{window.AbyssalOnlinePendingStart=false;window.AbyssalOnline?.showRooms();}});
window.addEventListener('abyssal-gameplay-notice',ev=>{const d=ev.detail||{};if(d.kind==='death'&&Number.isFinite(Number(d.x))&&Number.isFinite(Number(d.y)))spawnBloodPool(Number(d.x)*W,Number(d.y)*H,28/GAME_WORLD_ZOOM,Number(d.angle)||Math.random()*Math.PI*2);if(['join','leave'].includes(d.kind))enqueueGameplayNotice(d.kind,d.title||'ECO ABISSAL',d.text||'',30);});
window.addEventListener('abyssal-peer-skin-ability',ev=>{
 const d=ev.detail||{},fromId=String(d.fromId||'');
 if(d.type!=='standard-active'||!fromId)return;
 const local=fromId===String(window.AbyssalOnline?.getSocketId?.()||'');
 const px=clamp(Number(d.x)*W,0,W),py=clamp(Number(d.y)*H,0,H),angle=Number(d.angle)||0,active=String(d.active||''),color=d.color||'#79f3f0',range=(Number(d.range)||160)/GAME_WORLD_ZOOM;
 if(local){const spec=SKIN_STANDARD?.activeSpec?.(d.skin||equippedSkin);if(spec&&!['dash','shot','slowShot','shield'].includes(active))spawnSkinActiveVisual(spec,angle,{x:px,y:py});if(active==='shield'&&player){player.invuln=Math.max(player.invuln||0,2);if(player.specimen)player.specimen.invuln=Math.max(player.specimen.invuln||0,2);}return;}
 if(active==='cloud')spawnPoisonPlantCloudVisual(px,py,range,color);
 else if(active==='trail'){queueEffect({type:'ring',x:px,y:py,r:0,max:65/GAME_WORLD_ZOOM,life:.42,maxLife:.42,color});burst(px,py,color,10,90);}
 else if(active==='dash'){/* The actual moving specimen and blue water arc are driven by specimen-dash. */}
 else if(active==='paralysis'||active==='poison'){remoteWeaponInfusions.set(fromId,{kind:active,until:Date.now()+(Number(d.activeDurationMs)||10000)});const peer=window.AbyssalOnline?.getPlayerById?.(fromId);burst(peer?.x??px,peer?.y??py,active==='poison'?'#b46bfa':'#62edff',active==='poison'?8:9,75);}
 else if(active==='push'){queueEffect({type:'ring',x:px,y:py,r:0,max:range,life:.58,maxLife:.58,color});burst(px,py,color,18,150);} else if(active==='pulse'){queueEffect({type:'specimen-pulse-wave',x:px,y:py,r:0,max:range,life:.72,maxLife:.72,color});burst(px,py,color,20,155);}
 else if(active==='shield'){/* A joint bubble is synchronized by skin-shield-bubble. */}
 else if(active==='shot'||active==='slowShot'){/* The authoritative shot event renders the beam for everyone. */}
});
window.addEventListener('abyssal-specimen-attack',ev=>{const d=ev.detail||{};if(!Number.isFinite(d.x)||!Number.isFinite(d.y))return;queueEffect({type:'ring',x:d.x,y:d.y,max:24/GAME_WORLD_ZOOM,life:.25,maxLife:.25,color:'#8ff4e8'});});
window.addEventListener('abyssal-specimen-dash',ev=>{
 const d=ev.detail||{},id=String(d.fromId||''),durationMs=Math.max(100,Math.min(1200,Number(d.durationMs)||650));
 const x1=Number(d.x1)*W,y1=Number(d.y1)*H,x2=Number(d.x2)*W,y2=Number(d.y2)*H;
 if(!id||![x1,y1,x2,y2].every(Number.isFinite))return;
 const dash={x1,y1,x2,y2,startedAt:performance.now(),durationMs,angle:Math.atan2(y2-y1,x2-x1)};
 if(id===String(window.AbyssalOnline?.getSocketId?.()||'')&&player?.specimen){player.specimen.dash=dash;player.specimen.invuln=Math.max(player.specimen.invuln||0,durationMs/1000);}
 else remoteSpecimenDashes.set(id,dash);
});
window.addEventListener('abyssal-skin-weapon-impact',ev=>{
 const d=ev.detail||{},enemy=onlineEnemyById.get(String(d.enemyId||'')),now=performance.now();
 if(d.targetId&&d.kind==='paralysis')remoteWeaponParalysis.set(String(d.targetId),Date.now()+100);
 if(enemy){if(d.kind==='paralysis')enemy.paralyzedUntil=now+100;
  else if(d.kind==='poison')enemy.weaponPoisonUntil=now+2400;}
});
window.addEventListener('abyssal-skin-shield-bubble',ev=>{
 const d=ev.detail||{},selfId=String(window.AbyssalOnline?.getSocketId?.()||'');
 if(!d.fromId)return;
 const local=String(d.fromId)===selfId;
 const peer=window.AbyssalOnline?.getPlayerById?.(d.fromId);
 queueEffect({type:'specimen-shield-bubble',x:Number(peer?.x)||0,y:Number(peer?.y)||0,
  ownerId:d.fromId,local,max:74/GAME_WORLD_ZOOM,life:2,maxLife:2,color:'#8ff4e8'});
});
window.addEventListener('abyssal-skin-trail-node',ev=>{
 const node=ev.detail||{},wx=Number(node.x)*W,wy=Number(node.y)*H;
 if(!Number.isFinite(wx)||!Number.isFinite(wy)||wx<0||wx>W||wy<0||wy>H)return;
 sharkWakeTrails.push({x:wx,y:wy,r:20/GAME_WORLD_ZOOM,life:10,maxLife:10,
  color:node.color||'#79dfff',ink:node.ink===true,damageTimer:1,
  remote:true,skinActive:true});
 if(sharkWakeTrails.length>450)sharkWakeTrails.splice(0,sharkWakeTrails.length-450);
});
window.addEventListener('abyssal-skin-shot-telegraph',ev=>{
 const d=ev.detail||{},x1=Number(d.x1)*W,y1=Number(d.y1)*H,x2=Number(d.x2)*W,y2=Number(d.y2)*H;
 if(![x1,y1,x2,y2].every(Number.isFinite))return;
 queueEffect({type:'beam',x1,y1,x2,y2,life:.42,maxLife:.42,color:d.color||'#ff334f',width:(d.active==='shot'?6:4)/GAME_WORLD_ZOOM});burst(x1,y1,d.color||'#ff334f',12,100);
 queueEffect({type:'skin-shot-telegraph',x1,y1,x2,y2,life:.45,maxLife:.45,color:d.color||'#ff334f',width:4/GAME_WORLD_ZOOM});
});
window.addEventListener('abyssal-player-skin-status',ev=>{
 if(!player)return;const d=ev.detail||{},until=Number(d.until)||Date.now();
 if(d.type==='paralysis'){player.skinParalyzedUntil=Math.max(Number(player.skinParalyzedUntil)||0,until);queueEffect({type:'ring',x:player.x,y:player.y,r:0,max:55/GAME_WORLD_ZOOM,life:.52,maxLife:.52,color:'#62edff'});}
 if(d.type==='slow'){player.skinSlowedUntil=Math.max(Number(player.skinSlowedUntil)||0,until);queueEffect({type:'ring',x:player.x,y:player.y,r:0,max:48/GAME_WORLD_ZOOM,life:.65,maxLife:.65,color:'#9bd9ff'});}
});
function restoreDeployRunProgress(run){if(!run||typeof run!=='object')return;score=Math.max(0,Number(run.score)||0);level=Math.max(1,Math.floor(Number(run.level)||1));xp=Math.max(0,Number(run.xp)||0);xpNeed=Math.max(1,Math.floor(Number(run.xpNeed)||10));bossKillsThisRun=Math.max(0,Math.floor(Number(run.bossesKilled)||0));diveStats.damageDealt=Math.max(0,Number(run.damageDealt)||0);diveStats.monstersKilled=Math.max(0,Math.floor(Number(run.monstersKilled)||0));diveStats.energyCollected=Math.max(0,Math.floor(Number(run.energyCollected)||0));updateHud(true);}
function enterOnlineGameplay(data){const d=data||{};const canResume=Boolean(d.reconnected&&d.resumedRun&&player);onlineRoomMode=['pvp','rift','open-sea'].includes(d.room?.mode)?d.room.mode:'coop';requestedRunMode=onlineRoomMode==='rift'?'rift':onlineRoomMode==='open-sea'?'open-sea':'classic';onlineMode=true;
 // room-joined is authoritative. Commit the UI transition before any fallible arena/game setup.
 for(const id of [...screens,'roomsScreen','loginScreen']){const node=$(id);if(node)node.hidden=true;}
 document.body.classList.add('game-active');
 try{createArenaRocks();}catch(error){console.error('[online-entry] Falha ao preparar arena; continuando entrada:',error);arenaRocks=[];}
 if(!canResume){startGame(Boolean(d.resumedRun));if(d.resumedRun&&d.updateClient){const c=d.updateClient;for(const k of Object.keys(upgrades))if(Number.isFinite(c.upgrades?.[k])||typeof c.upgrades?.[k]==='boolean')upgrades[k]=c.upgrades[k];for(const k of Object.keys(upgradeLevels))if(Number.isFinite(c.upgradeLevels?.[k]))upgradeLevels[k]=Math.max(0,Math.min(3,c.upgradeLevels[k]));if(Array.isArray(c.chosen))chosen=c.chosen;if(RESONANCE_CATEGORIES.shots.includes(c.runShotId))runShotId=c.runShotId;if(Array.isArray(c.runResonanceIds))runResonanceIds=c.runResonanceIds.filter(id=>BASIC_SKILL_IDS.includes(id));}}else{gameState='playing';last=performance.now();onlineDamageQueue.length=0;const hud=$('hud'),toggle=$('toggleHudBtn'),pause=$('pauseBtn');if(hud)hud.hidden=false;if(toggle)toggle.hidden=false;if(pause)pause.hidden=false;setMobileGameActive(true);window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet,rangeStrength:upgrades.range,speedStrength:upgrades.speed,arcChainActive:Boolean(upgrades.arcChain),ricochetLevel:upgrades.ricochet,electricLevel:upgrades.electric,shellLevel:upgrades.shell,lastStandLevel:upgrades.lastStand,submarineWeapons:window.AbyssalSoloBase?.installedWeapons?.()||['photon']});}if(onlineRoomMode==='pvp'){enemies.length=0;orbs.length=0;projectiles.length=0;}if(player)player.invuln=Math.max(player.invuln,5);if(d.snapshot)window.AbyssalGameHooks?.applySnapshot(d.snapshot);if(d.spawn){let point=d.spawn;if(isClassicCavernRun()&&SOLO_CAVERN?.isBlocked(arenaRocks,point.x,point.y,25/GAME_WORLD_ZOOM))point=SOLO_CAVERN.submarineSpawn(arenaRocks,W,H,soloSubmarine,GAME_WORLD_ZOOM);window.AbyssalGameHooks?.setPlayerPosition?.(point.x,point.y);if(player?.specimen){player.specimen.x=player.x;player.specimen.y=player.y+28/GAME_WORLD_ZOOM;}}if(d.resumedRun&&isClassicCavernRun())soloSubmarine.spawnFx=0;if(d.resumedRun&&d.runResume)restoreDeployRunProgress(d.runResume);const badge=$('roomBadge');if(badge){badge.textContent=`${onlineRoomMode==='pvp'?'⚠ ARENA PvP':'⌁'} ${d.room?.id||''}`;badge.dataset.roomCode=d.room?.id||'';badge.dataset.mode=onlineRoomMode;badge.classList.toggle('pvp-room-badge',onlineRoomMode==='pvp');badge.hidden=false;}scheduleGameLoop();showToast(d.reconnected&&d.resumedRun?'CONEXÃO RESTAURADA · EXPEDIÇÃO RETOMADA':onlineRoomMode==='pvp'?'⚠ ARENA PvP · PERIGO':'MERGULHAR ONLINE · '+(d.room?.name||'SALA ABISSAL'));}
function activateOnlineEntry(detail){try{enterOnlineGameplay(detail||{});return document.body.classList.contains('game-active')&&gameState==='playing';}catch(error){console.error('[online-entry] Falha ao inicializar gameplay após confirmação da sala:',error);const menu=$('menuScreen'),rooms=$('roomsScreen'),login=$('loginScreen'),hud=$('hud'),pause=$('pauseBtn'),toggle=$('toggleHudBtn');if(menu)menu.hidden=true;if(rooms)rooms.hidden=true;if(login)login.hidden=true;document.body.classList.add('game-active');onlineMode=true;gameState='playing';setMobileGameActive(true);if(hud)hud.hidden=false;if(pause)pause.hidden=false;if(toggle)toggle.hidden=false;last=performance.now();scheduleGameLoop();return true;}}
window.addEventListener('abyssal-room-joined',ev=>{if(!activateOnlineEntry(ev.detail))showToast('Falha ao iniciar a expedição online. Tentando recuperar…');});
window.addEventListener('abyssal-room-entry-retry',ev=>{if(document.body.classList.contains('game-active')&&gameState==='playing')return;activateOnlineEntry(ev.detail||{});});
window.addEventListener('abyssal-room-created',ev=>{const d=ev.detail||{};const m=$('roomsMessage');if(m)m.textContent=d.ok?`Sala criada! Código para convidar amigos: ${d.room?.id||''}. Você será conectado agora.`:(d.message||'Não foi possível criar a sala.');});
window.addEventListener('abyssal-online-disconnected',()=>{onlineDamageQueue.length=0;});
window.addEventListener('abyssal-reconnect-failed',ev=>{onlineDamageQueue.length=0;onlineMode=false;setMobileGameActive(false);document.body.classList.remove('game-active');gameState='menu';$('hud').hidden=true;$('pauseBtn').hidden=true;$('menuScreen').hidden=false;window.AbyssalCockpitNavigation?.showExterior?.();window.dispatchEvent(new CustomEvent('abyssal-menu-return',{detail:{outside:true}}));const m=$('roomsMessage');if(m)m.textContent=ev.detail?.message||'A expedição não pôde ser retomada automaticamente. Entre novamente quando o servidor estabilizar.';showToast('CONEXÃO RESTAURADA · REENTRE NA EXPEDIÇÃO');});
window.addEventListener('abyssal-room-left',()=>{onlineDamageQueue.length=0;onlineRoomMode='coop';requestedRunMode='classic';activeMapLayout=null;W=defaultWidth();H=defaultHeight();createArenaRocks();const badge=$('roomBadge');if(badge){badge.hidden=true;badge.classList.remove('pvp-room-badge');}setMobileGameActive(false)});
const roomBadge=$('roomBadge');if(roomBadge)roomBadge.addEventListener('click',async()=>{const code=roomBadge.dataset.roomCode||'';try{await navigator.clipboard.writeText(code);showToast(`CÓDIGO ${code} COPIADO`)}catch{showToast(`CÓDIGO DA SALA: ${code}`)}});
function handleRoomsClosed(){onlineMode=false;if(gameState==='menu'){setMobileGameActive(false);document.body.classList.remove('game-active');$('hud').hidden=true;$('pauseBtn').hidden=true;$('gameOverScreen').hidden=true;$('menuScreen').hidden=false;}}
window.addEventListener('abyssal-modal-closed',ev=>{if(ev.detail?.screenId==='roomsScreen')handleRoomsClosed();});
$('refreshRoomsBtn')?.addEventListener('click',()=>window.AbyssalOnline?.requestRooms());
$('roomPrivateCheck')?.addEventListener('change',e=>{$('roomPasswordField').hidden=!e.target.checked});
$('createRoomBtn')?.addEventListener('click',()=>{const selected=$('roomModeInput')?.value;window.AbyssalOnline?.createRoom({name:$('roomNameInput').value,capacity:Number($('roomCapacityInput').value),isPrivate:$('roomPrivateCheck').checked,password:$('roomPasswordInput').value,mode:['pvp','rift','open-sea'].includes(selected)?selected:'coop'});});
$('joinRoomCodeBtn')?.addEventListener('click',()=>window.AbyssalOnline?.joinRoom($('roomCodeInput').value,$('roomJoinPasswordInput').value));
window.addEventListener('abyssal-rooms-list',ev=>{const screen=$('roomsScreen');if(screen&&!screen.hidden)renderRoomList(ev.detail||[]);});
window.addEventListener('abyssal-room-action-error',ev=>{const m=$('roomsMessage');if(m)m.textContent=ev.detail?.message||'Não foi possível realizar essa ação.';});
function renderRoomList(rooms){const root=$('roomsList');if(!root)return;const riftLobby=window.AbyssalPreferredRoomMode==='rift';let list=(Array.isArray(rooms)?rooms:[]);if(window.AbyssalPreferredRoomMode==='coop')list=list.filter(r=>r.mode==='coop');if(!list.length){root.innerHTML='<div class="room-empty">NENHUMA SALA DISPONÍVEL · CRIE UMA EXPEDIÇÃO OU ATUALIZE A LISTA.</div>';return;}root.innerHTML=list.map(r=>{const full=(Number(r.playerCount)||0)>=(Number(r.capacity)||6),privateRoom=Boolean(r.isPrivate),pvp=r.mode==='pvp',rift=r.mode==='rift',remote=r.joinable===false,label=rift?'FOSSAS · COOPERATIVO':pvp?'⚠ ARENA PvP · PERIGO':r.mode==='open-sea'?'MAR ABERTO · EXPLORAÇÃO':privateRoom?'PRIVADA · SENHA':(r.id==='MAR-ABERTO'?'SALA PÚBLICA PADRÃO':'PÚBLICA'),buttonDisabled=full||remote,buttonText=full?'LOTADA':remote?'OUTRA INSTÂNCIA':privateRoom?'SENHA':'ENTRAR';return `<article class="room-row${privateRoom?' room-row-private':''}${pvp?' pvp-room':''}${rift?' rift-room':''}"><div><b>${rift?'⌁ ':pvp?'⚠ ':privateRoom?'🔒 ':''}${escapeHtml(r.name||'Sala Abissal')}</b><small>${Number(r.playerCount)||0}/${Number(r.capacity)||6} mergulhadores · ${label}${Number.isFinite(Number(r.elapsed))&&Number(r.elapsed)>0?' · '+fmtTime(Number(r.elapsed)):''}</small></div><button type="button" class="room-join-btn" data-room-id="${escapeHtml(r.id)}" data-private="${privateRoom?'1':'0'}" data-joinable="${remote?'0':'1'}" ${buttonDisabled?'disabled':''}>${buttonText}</button></article>`}).join('');root.querySelectorAll('[data-room-id]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.roomId;const code=$('roomCodeInput'),password=$('roomJoinPasswordInput'),section=root.closest('.room-modal')?.querySelector('.room-join-code'),msg=$('roomsMessage');if(code)code.value=id;if(btn.dataset.joinable==='0'){if(msg)msg.textContent='Esta expedição está registrada, mas pertence a outro processo do servidor e não pode ser conectada por esta instância.';return;}if(btn.dataset.private==='1'){if(msg)msg.textContent='EXPEDIÇÃO SELADA. Informe a senha para romper o lacre e entrar.';section?.scrollIntoView({behavior:'smooth',block:'nearest'});password?.focus();return;}window.AbyssalOnline?.joinRoom(id,'');}));}

$('loginCancelBtn').addEventListener('click',()=>{$('loginScreen').hidden=true});
window.addEventListener('abyssal-final-victory',ev=>{
 if(ev.detail?.ok!==true)return;
 if(onlineMode&&!bossVictoryPending&&gameState==='playing')triggerAbyssalVictory();
});
window.addEventListener('abyssal-first-progression-reward',ev=>{
 const result=ev.detail||{};
 if(result.awarded!==true)return;
 addNotification('Você concluiu a primeira barra de progressão e ganhou 5.000 de energia abissais, uma única vez por conta.','PRIMEIRO CICLO CONQUISTADO','cycle');
 window.AbyssalTutorials?.showProgressionChoice?.();
});
window.addEventListener('abyssal-run-saved',ev=>{const r=ev.detail||{};if(!r.ok)return;const status=$('saveStatus');if(status)status.textContent=`MERGULHO REGISTRADO · ${Number(r.bossesKilled)||0} BOSSES · +${Number(r.totalRunCoins??((Number(r.earned)||0)+(Number(r.bossCoins)||0)))||0} ENERGIA NA EXPEDIÇÃO`;if(r.rankings)window.dispatchEvent(new CustomEvent('abyssal-rankings-refreshed',{detail:r.rankings}));});
let accountMaintenanceTimer=0;
function hasPendingAccountWork(){
 const key=adaptationAccountKey();
 const pendingAdaptation=Boolean(key&&readAdaptationQueue(key).some(row=>JSON.stringify(row.counts)!==JSON.stringify(row.credited||{})));
 return Boolean(energyWallet?.hasPending?.()||pendingAdaptation);
}
function scheduleAccountMaintenance(delay=30000){
 if(accountMaintenanceTimer){clearTimeout(accountMaintenanceTimer);accountMaintenanceTimer=0;}
 if(document.hidden||!hasPendingAccountWork())return;
 accountMaintenanceTimer=setTimeout(()=>{
  accountMaintenanceTimer=0;
  if(document.hidden||!hasPendingAccountWork())return;
  energyWallet?.sync();
  syncSoloAdaptation();
  if(hasPendingAccountWork())scheduleAccountMaintenance();
 },Math.max(1000,Number(delay)||30000));
}
window.addEventListener('abyssal-authenticated',()=>{syncSoloAdaptation();energyWallet?.sync();scheduleAccountMaintenance(3000);});
window.addEventListener('abyssal-account-signed-out',()=>{if(accountMaintenanceTimer){clearTimeout(accountMaintenanceTimer);accountMaintenanceTimer=0;}energyWallet?.setAccount('',0);});
window.addEventListener('abyssal-energy-queue-change',event=>{if(Number(event.detail?.pending)>0)scheduleAccountMaintenance(3000);else if(!hasPendingAccountWork()&&accountMaintenanceTimer){clearTimeout(accountMaintenanceTimer);accountMaintenanceTimer=0;}});
window.addEventListener('online',()=>{syncSoloAdaptation();energyWallet?.sync();scheduleAccountMaintenance(5000);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(accountMaintenanceTimer){clearTimeout(accountMaintenanceTimer);accountMaintenanceTimer=0;}}else if(hasPendingAccountWork())scheduleAccountMaintenance(3000);});
window.addEventListener('abyssal-account-data',e=>{
  const a=e.detail;if(!a)return;
  energyWallet?.setAccount(a.nickname,a.energy);
  const serverSkins=Array.isArray(a.ownedSkins)?a.ownedSkins:['default'];
  ownedSkins=[...new Set(serverSkins)];
  equippedSkin=a.equippedSkin||localStorage.getItem('abyssalSkin')||'default';
  if(!ownedSkins.includes(equippedSkin))equippedSkin='default';
  metaUpgrades=typeof a.metaUpgrades==='object'&&a.metaUpgrades?a.metaUpgrades:{};
  if(a.diverGender==='female'||a.diverGender==='male')setDiverGender(a.diverGender,false);
  const serverProficiency=a.specimenProficiency&&typeof a.specimenProficiency==='object'?a.specimenProficiency:{};specimenProficiency=pendingAdaptationMap(adaptationAccountKey(),serverProficiency);saveSpecimenProficiencyLocal();
  saveCosmeticsLocalOnly();
  const shopScreen=$('shopScreen');if(shopScreen&&!shopScreen.hidden)renderShop();
  updateAbilityButtons();
});
window.addEventListener('abyssal-specimen-proficiency',event=>{
 const d=event.detail||{};if(!d.skinId)return;
 specimenProficiency={...specimenProficiency,[String(d.skinId)]:Math.max(specimenPoints(String(d.skinId)),Number(d.points)||0)};saveSpecimenProficiencyLocal();updateAbilityButtons(true);
});
window.addEventListener('abyssal-specimen-state',event=>{
 const d=event.detail||{},selfId=window.AbyssalOnline?.getSocketId?.();
 if(selfId&&String(d.playerId)===String(selfId)&&player?.specimen&&(!d.skinId||String(d.skinId)===equippedSkin)){
  player.specimen.alive=d.alive!==false;player.specimen.hp=Math.max(0,Number(d.hp)||0);player.specimen.maxHp=Math.max(1,Number(d.maxHp)||55);
  player.specimen.respawnAt=d.alive===false?Number(d.respawnAt)||0:0;
  player.specimen.respawnTimer=d.alive===false?Math.max(0,(player.specimen.respawnAt-Date.now())/1000):0;
  if(!isClassicCavernRun()||d.reason==='respawn'||d.reason==='equipped'){if(Number.isFinite(Number(d.x)))player.specimen.x=Number(d.x)*W;if(Number.isFinite(Number(d.y)))player.specimen.y=Number(d.y)*H;}
  if(d.skinId&&Number.isFinite(Number(d.points))){const id=String(d.skinId);specimenProficiency={...specimenProficiency,[id]:Math.max(specimenPoints(id),Number(d.points))};saveSpecimenProficiencyLocal();}
  updateAbilityButtons(true);
  if(d.reason==='defeated')showToast('ESPÉCIME ABATIDO · BÔNUS E ATIVA INATIVOS');
  if(d.reason==='respawn')showToast('ESPÉCIME RESSURGIU');
 }else{
  const peer=window.AbyssalOnline?.getPlayerById?.(d.playerId);if(peer)peer.specimenAlive=d.alive!==false;
 }
});
window.addEventListener('abyssal-purchase-result',e=>{
  const r=e.detail||{};
  if(r.account){window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:r.account}));}
  showToast(r.message||'Compra processada');
  if(r.ok&&r.itemId){
    playSkillSound(r.itemId,'learn');
    if(!ownedSkins.includes(r.itemId)){
      ownedSkins.push(r.itemId);
      saveCosmetics();
    }
    const skinName = (SHOP_SKINS && SHOP_SKINS.find(s=>s.id===r.itemId)?.name) || r.itemId;
    addNotification('🐚 ' + skinName + ' desbloqueada com sucesso na sua conta! Equipe-a pelo Catálogo a qualquer momento.', 'NOVO ESPÉCIME · CONTA ONLINE', 'skin');
    updateNotifBadge();
  } else if(r.ok) {
    playWorldSound('ui-purchase',null,900,1);
  }
});
function saveCosmeticsLocalOnly(){localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));localStorage.setItem('abyssalMetaUpgrades',JSON.stringify(metaUpgrades));}
renderShop();

initNotifSystem();resize();
const gameplayResizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(document.body.classList.contains('game-active'))resize();}):null;
gameplayResizeObserver?.observe($('gameShell'));
gameState='menu';scheduleGameLoop();

const endDiveButton=document.createElement('button');endDiveButton.id='endDiveBtn';endDiveButton.type='button';endDiveButton.textContent='ENCERRAR MERGULHO';endDiveButton.style.cssText='position:absolute;right:18px;top:72px;z-index:8;border:1px solid rgba(255,130,160,.55);border-radius:8px;padding:8px 10px;background:rgba(30,10,25,.78);color:#ffd6e0;font:600 10px Manrope,system-ui;letter-spacing:.08em;cursor:pointer;display:none';document.getElementById('gameShell').appendChild(endDiveButton);
endDiveButton.addEventListener('click',()=>{if(['playing','paused','upgrade'].includes(gameState)){ $('pauseScreen').hidden=true;$('upgradeScreen').hidden=true;endGame('voluntary');}});

})();
