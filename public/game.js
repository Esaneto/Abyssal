(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
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
let W=3600,H=2200,viewW=800,viewH=500,worldZoom=.78,mapFactor=1.7,cameraX=0,cameraY=0,dpr=1,last=0,elapsed=0,score=0,level=1,xp=0,xpNeed=10,hp=100,maxHp=100,gameState='menu',soundOn=true,nextBossAt=60,lastBossMaxHp=0,lastBossDamage=0,lastBossSpeed=0,bossKillsThisRun=0,runProgressTimer=0;
let player=null,botBuddy=null,enemies=[],orbs=[],particles=[],projectiles=[],effects=[],decor=[],arenaRocks=[],upgrades={},upgradeLevels={},chosen=[],spawnTimer=0,enemyId=0,shake=0,damageFlash=0,runSeed=0,bossIndex=0;
let bestScore=Number(localStorage.getItem('abyssalBestScore')||0),bestTime=Number(localStorage.getItem('abyssalBestTime')||0);
let snapshotClock=0,upgradeAutoTimer=null,upgradeOptions=[],sharedXpApplying=false,lastBossKind=null,lastRemoteBossId=null,metaUpgrades=JSON.parse(localStorage.getItem('abyssalMetaUpgrades')||'{}'),wheelBusy=false,wheelAngle=0,bossAlertTimer=null,alertedBossIds=new Set(),authoritativeElapsed=null,lastSnapshotAt=0,lastSnapshotTick=0;
let onlineMovementStalledSnapshots=0,onlineMovementConfirmedSnapshots=0,onlineClientMovementFallback=false,lastServerEnemyPositions=new Map(),onlineVisualMovingEnemies=0,onlineVisualEnemyCount=0,onlineMotionWatchdog=window.AbyssalEnemyNetcode?.createMotionWatchdog({motionEpsilon:.35,healthyRatio:.18,resumeAfter:4,stallAfter:3})||null;
let coins=Number(localStorage.getItem('abyssalCoins')||0),equippedSkin=localStorage.getItem('abyssalSkin')||'default',onlineMode=false,botBuddyTimer=0;
const skinData=[
{id:'default',name:'Luz Abissal',color:'#75f8ed',price:0,paid:false,shape:'orb',desc:'Um núcleo vivo de luz bioluminescente, cercado por filamentos de maré.'},
{id:'violet',name:'Espectro Violeta',color:'#bd91ff',price:1000,paid:false,shape:'horns',desc:'Chifres translúcidos e uma aura espectral que pulsa no escuro.'},
{id:'solar',name:'Núcleo Solar',color:'#ffd078',price:2500,paid:false,shape:'spikes',desc:'Espinhos dourados como fragmentos de uma estrela afogada.'},
{id:'toxic',name:'Lodo Tóxico',color:'#a7ff78',price:4000,paid:false,shape:'tentacles',desc:'Tentáculos ácidos terminados em glândulas que brilham em verde.'},
{id:'leviathan',name:'Leviatã Cego',color:'#ff668f',price:6500,paid:false,shape:'leviathan',desc:'Uma forma alongada com placas dorsais e olhos sensoriais apagados.'},
{id:'thorn',name:'Coroa de Espinhos',color:'#ff9b6a',price:8000,paid:false,shape:'coral',desc:'Galhos de coral negro crescem como uma coroa predatória.'},
{id:'abyssking',name:'Rei do Vazio',color:'#8b7cff',price:10000,paid:false,shape:'king',desc:'Uma coroa óssea sobre um núcleo imperial de luz violeta.'},
{id:'royal',name:'Abismo Real',color:'#ff78d0',price:12000,paid:false,shape:'halo',desc:'Uma auréola de pérolas luminescentes envolve esta criatura rara.'},
{id:'glacier',name:'Glaciar Fantasma',color:'#91caff',price:13000,paid:false,shape:'crystal',desc:'Cristais de gelo marinho crescem em torno do seu corpo espectral.'},
{id:'coral',name:'Jardim Carnívoro',color:'#ff6f9d',price:6000,paid:false,shape:'coral',desc:'Corais rubros, espinhos calcificados e filamentos de anêmona.'},
{id:'bloodmoon',name:'Lua Sangrenta',color:'#ff3c66',price:9000,paid:false,shape:'fangs',desc:'Uma mandíbula dupla e presas pálidas sob um brilho carmesim.'},
{id:'voidwing',name:'Asa do Nada',color:'#b2a0ff',price:15000,paid:false,shape:'wings',desc:'Membranas espectrais se abrem como asas de uma criatura antiga.'},
{id:'abyssaleye',name:'Olho do Insondável',color:'#66f0ff',price:18000,paid:false,shape:'eye',desc:'Uma íris colossal observa em várias direções ao mesmo tempo.'},
{id:'deepwarden',name:'Carcereiro das Fossas',color:'#b8d6c6',price:14000,paid:false,shape:'shell',desc:'Três placas minerais protegem um núcleo verde-fantasma.'}
];
let ownedSkins=JSON.parse(localStorage.getItem('abyssalOwnedSkins')||'["default"]');
function saveCosmetics(){localStorage.setItem('abyssalCoins',String(coins));localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));localStorage.setItem('abyssalMetaUpgrades',JSON.stringify(metaUpgrades));if(window.AbyssalOnline?.saveCosmetics)window.AbyssalOnline.saveCosmetics({ownedSkins,equippedSkin,metaUpgrades});}
function currentSkinColor(){return (skinData.find(s=>s.id===equippedSkin)||skinData[0]).color;}
let pointer={x:0,y:0,down:false,active:false},keys={},joystickVector={x:0,y:0,active:false,pointerId:null};
const MAX_ENEMIES=50,MAX_BOSSES=4,MAX_COMMON_ENEMIES=MAX_ENEMIES-MAX_BOSSES;
const particleBudget=()=>isMobileDevice()?360:850, projectileBudget=()=>isMobileDevice()?120:180, effectBudget=()=>isMobileDevice()?80:160, orbBudget=()=>isMobileDevice()?120:220;
const BOSS_KINDS=['boss','leviathan','maw','angler'];
const isMobileDevice=()=>window.matchMedia('(pointer: coarse)').matches||window.innerWidth<=700;
function setMobileGameActive(active){const enabled=Boolean(active)&&isMobileDevice();document.body.classList.toggle('mobile-game-active',enabled);document.documentElement.classList.toggle('mobile-game-active',enabled);const stick=$('mobileJoystick');if(stick)stick.hidden=!enabled;resize();}
let audioCtx=null,lastShot=0,lastHit=0,toastTimer=null,ambientNodes=null;
$('bestTime').textContent=fmtTime(bestTime);$('bestScore').textContent=bestScore.toLocaleString('pt-BR');

// The logical world is shared across devices; mobile uses a smaller zoom to reveal more of that same world.
function desiredWorldZoom(){return isMobileDevice() ? .42 : .78;}
function desiredMapFactor(){return 1.7;}
function updateCamera(){
 if(!player){cameraX=0;cameraY=0;return;}
 const visibleWorldW=viewW/worldZoom,visibleWorldH=viewH/worldZoom;
 cameraX=clamp(player.x-visibleWorldW*.5,0,Math.max(0,W-visibleWorldW));
 cameraY=clamp(player.y-visibleWorldH*.5,0,Math.max(0,H-visibleWorldH));
}
function resize(){
 const r=$('gameShell').getBoundingClientRect();
 const oldW=W,oldH=H,oldZoom=worldZoom;
 viewW=Math.max(320,r.width);viewH=Math.max(300,r.height);
 dpr=Math.min(window.devicePixelRatio||1,isMobileDevice()?1.25:1.8);
 worldZoom=desiredWorldZoom();mapFactor=desiredMapFactor();
 W=3600;H=2200;mapFactor=1.7;
 const sx=oldW>0?W/oldW:1,sy=oldH>0?H/oldH:1,rz=oldZoom>0?oldZoom/worldZoom:1;
 if(player){player.x*=sx;player.y*=sy;player.r*=rz;player.moveSpeed=150/worldZoom;player.x=clamp(player.x,24/worldZoom,W-24/worldZoom);player.y=clamp(player.y,24/worldZoom,H-24/worldZoom);}
 for(const list of [enemies,orbs,particles,projectiles])for(const o of list){if(Number.isFinite(o.x))o.x*=sx;if(Number.isFinite(o.y))o.y*=sy;if(Number.isFinite(o.x1))o.x1*=sx;if(Number.isFinite(o.x2))o.x2*=sx;if(Number.isFinite(o.y1))o.y1*=sy;if(Number.isFinite(o.y2))o.y2*=sy;if(Number.isFinite(o.r))o.r*=rz;if(Number.isFinite(o.vx))o.vx*=rz;if(Number.isFinite(o.vy))o.vy*=rz;if(Number.isFinite(o.speed))o.speed*=rz;if(Number.isFinite(o.interpFromX))o.interpFromX*=sx;if(Number.isFinite(o.interpFromY))o.interpFromY*=sy;if(Number.isFinite(o.interpTargetX))o.interpTargetX*=sx;if(Number.isFinite(o.interpTargetY))o.interpTargetY*=sy;}
 for(const o of effects){if(Number.isFinite(o.x))o.x*=sx;if(Number.isFinite(o.y))o.y*=sy;if(Number.isFinite(o.x1))o.x1*=sx;if(Number.isFinite(o.x2))o.x2*=sx;if(Number.isFinite(o.y1))o.y1*=sy;if(Number.isFinite(o.y2))o.y2*=sy;if(Number.isFinite(o.max))o.max*=rz;if(Number.isFinite(o.r))o.r*=rz;}
 canvas.width=Math.floor(viewW*dpr);canvas.height=Math.floor(viewH*dpr);
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
function startAmbientMusic(){if(!soundOn||ambientNodes)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const master=audioCtx.createGain();master.gain.value=.045;master.connect(audioCtx.destination);const low=audioCtx.createOscillator(),high=audioCtx.createOscillator(),lfo=audioCtx.createOscillator(),lfoGain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();low.type='sine';low.frequency.value=43;high.type='triangle';high.frequency.value=67;filter.type='lowpass';filter.frequency.value=260;lfo.type='sine';lfo.frequency.value=.08;lfoGain.gain.value=65;lfo.connect(lfoGain);lfoGain.connect(filter.frequency);low.connect(filter);high.connect(filter);filter.connect(master);low.start();high.start();lfo.start();ambientNodes={master,low,high,lfo,filter};}catch(e){console.warn('Áudio ambiente indisponível',e)}}
function stopAmbientMusic(){if(!ambientNodes)return;try{ambientNodes.master.gain.setTargetAtTime(0,audioCtx.currentTime,.25);setTimeout(()=>{try{ambientNodes.low.stop();ambientNodes.high.stop();ambientNodes.lfo.stop()}catch(e){}ambientNodes=null},800)}catch(e){ambientNodes=null}}
function audio(f=440,d=.07,type='sine',vol=.025){
 if(!soundOn)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(f,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,f*.55),audioCtx.currentTime+d);g.gain.setValueAtTime(vol,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d)}catch(e){}
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
  const base=kind==='leviathan'?58:kind==='maw'?42:kind==='angler'?82:kind==='boss'?49:65;
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
  setTimeout(()=>{try{master.disconnect()}catch(e){}},3000);
 }catch(e){}
}
function showToast(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,1700)}
function showBossAlert(kind,id=null,threat=0){
 const key=id==null?`${kind}:${Math.floor(performance.now()/1000)}`:String(id);
 if(alertedBossIds.has(key))return;alertedBossIds.add(key);if(alertedBossIds.size>32)alertedBossIds=new Set([...alertedBossIds].slice(-16));
 const names={boss:['ABERRAÇÃO ABISSAL','ALGO RASGOU A ESCURIDÃO. NÃO OLHE PARA A LUZ VERMELHA.'],leviathan:['O LEVIATÃ DAS FOSSAS','A PRESSÃO SUBIU. UMA COISA IMENSA ESTÁ VINDO PELO FUNDO.'],maw:['A BOCA DO ABISMO','O ECO QUE VOCÊ OUVIU NÃO FOI SEU. CORRA.'],angler:['A LANTERNA MORTAL','A LUZ NÃO É UM RESGATE. É A ISCA.']};
 const [title,copy]=names[kind]||['PRESENÇA COLOSSAL','UMA FORMA IMPOSSÍVEL SE MOVE NA ESCURIDÃO.'];
 const alert=$('bossAlert');if(alert){$('bossAlertTitle').textContent=title;$('bossAlertText').textContent=copy;$('bossAlertKicker').textContent=threat?`SINAL DE PRESSÃO · AMEAÇA ${threat}`:'SINAL DE PRESSÃO · CONTATO DESCONHECIDO';alert.hidden=false;alert.classList.remove('boss-alert-enter');void alert.offsetWidth;alert.classList.add('boss-alert-enter');clearTimeout(bossAlertTimer);bossAlertTimer=setTimeout(()=>{alert.hidden=true;alert.classList.remove('boss-alert-enter')},4600);}
 shake=Math.max(shake,10);playBossCry(kind);audio(kind==='leviathan'?43:kind==='maw'?38:kind==='angler'?58:46,1.15,'sawtooth',.055);
}

function showScreen(id){screens.forEach(s=>$(s).hidden=s!==id);$('hud').hidden=id!=='gameScreen';}
function startGame(){
 startAmbientMusic();
 elapsed=0;lastOnlineVitalsAt=0;authoritativeElapsed=onlineMode?0:null;lastSnapshotAt=0;lastSnapshotTick=0;onlineMovementStalledSnapshots=0;onlineMovementConfirmedSnapshots=0;onlineMotionWatchdog?.reset?.();onlineClientMovementFallback=false;lastServerEnemyPositions.clear();score=0;level=1;xp=0;xpNeed=10;bossKillsThisRun=0;runProgressTimer=0;maxHp=100+Math.max(0,Number(metaUpgrades.bulkhead)||0)*8;hp=maxHp;spawnTimer=0;enemyId=0;shake=0;damageFlash=0;chosen=[];nextBossAt=60;bossIndex=0;lastBossKind=null;lastBossMaxHp=0;lastBossDamage=0;lastBossSpeed=0;lastRemoteBossId=null;alertedBossIds.clear();joystickVector={x:0,y:0,active:false,pointerId:null};
 setMobileGameActive(true);
 upgrades={power:Math.pow(1.08,Math.max(0,Number(metaUpgrades.focuser)||0)),rate:1,range:1,speed:1+Math.max(0,Number(metaUpgrades.current)||0)*.05,magnet:1,regen:0,shield:Math.max(0,Number(metaUpgrades.startShield)||0),burst:0,electric:0,pierce:0,ricochet:0,nova:0};
 upgradeLevels={power:0,rate:0,range:0,speed:0,magnet:0,regen:0,shield:0,burst:0,electric:0,pierce:0,ricochet:0,nova:0};
 enemies=[];orbs=[];particles=[];projectiles=[];effects=[];
 player={x:W*.5,y:H*.5,r:13/worldZoom,angle:0,moveSpeed:150/worldZoom,fireTimer:0,invuln:0,shieldTime:0,trail:[],pulseCooldown:0,dashCooldown:0,dashTime:0};updateCamera();
 // Persistent/passive abilities have a distinct cue when their effects enter a run.
 const activePassiveSounds=[];
 if(Number(metaUpgrades.bulkhead)>0)activePassiveSounds.push('bulkhead');
 if(Number(metaUpgrades.focuser)>0)activePassiveSounds.push('focuser');
 if(Number(metaUpgrades.current)>0)activePassiveSounds.push('current');
 if(upgrades.shield>0)activePassiveSounds.push('startShield');
 activePassiveSounds.slice(0,4).forEach((id,i)=>setTimeout(()=>{if(gameState==='playing'||(onlineMode&&gameState==='upgrade'))playSkillSound(id,'trigger')},180+i*190));
 gameState='playing';screens.forEach(s=>$(s).hidden=true);$('hud').hidden=false;const endBtn=document.getElementById('endDiveBtn');if(endBtn)endBtn.style.display=onlineMode?'block':'none';$('pauseBtn').hidden=false;botBuddyTimer=0;botBuddy=null;
 updateHud();last=performance.now();audio(520,.12,'sine',.04);if(!onlineMode)for(let i=0;i<3;i++)spawnEnemy(true);if(onlineMode){window.AbyssalOnline?.beginRun?.();window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet});window.AbyssalOnline?.requestPlayerState?.();}snapshotClock=0;
}
const upgradeList=[
 {id:'power',name:'Pulso intenso',icon:'✧',desc:'Seus disparos causam 50% mais dano por nível.',apply:()=>upgrades.power*=1.5},
 {id:'rate',name:'Ressonância veloz',icon:'⟡',desc:'Dispare mais rápido. Cada nível reduz ainda mais o intervalo.',apply:()=>upgrades.rate*=1.28},
 {id:'speed',name:'Propulsão abissal',icon:'➤',desc:'Mova-se 18% mais rápido.',apply:()=>upgrades.speed*=1.18},
 {id:'range',name:'Olho profundo',icon:'◎',desc:'Aumenta o alcance dos disparos.',apply:()=>upgrades.range*=1.22},
 {id:'magnet',name:'Campo magnético',icon:'⌁',desc:'Atrai fragmentos de energia de mais longe.',apply:()=>upgrades.magnet*=1.45},
 {id:'regen',name:'Membrana viva',icon:'✚',desc:'Recupera 1 ponto de vida a cada 4 segundos.',apply:()=>upgrades.regen+=1},
 {id:'shield',name:'Escudo espectral',icon:'◉',desc:'Ganha uma carga que bloqueia o próximo dano.',apply:()=>upgrades.shield=Math.min(3,upgrades.shield+1)},
 {id:'burst',name:'Pulso de ruptura',icon:'✺',desc:'A cada 7 segundos, libera uma onda de energia em grande alcance.',apply:()=>upgrades.burst=Math.min(3,upgrades.burst+1)},
 {id:'electric',name:'Tempestade elétrica',icon:'ϟ',desc:'Disparos encadeiam raios visíveis em até 2 inimigos próximos.',apply:()=>upgrades.electric=Math.min(3,(upgrades.electric||0)+1)},
 {id:'pierce',name:'Lança-abismo',icon:'➶',desc:'Projéteis atravessam +1 criatura por nível. Não aumenta o dano por impacto.',apply:()=>upgrades.pierce=Math.min(3,(upgrades.pierce||0)+1)},
 {id:'ricochet',name:'Ricochete caótico',icon:'⤴',desc:'O projétil salta visualmente até 2 vezes entre alvos próximos.',apply:()=>upgrades.ricochet=Math.min(3,(upgrades.ricochet||0)+1)},
 {id:'nova',name:'Nova gravitacional',icon:'✹',desc:'A cada 9 segundos, libera uma explosão abissal de longo alcance.',apply:()=>upgrades.nova=Math.min(3,(upgrades.nova||0)+1)}
];
function chooseUpgrade(u){
 if(!u || (upgradeLevels[u.id]||0)>=3)return;
 if(upgradeAutoTimer){clearTimeout(upgradeAutoTimer);upgradeAutoTimer=null;}
 u.apply();if(player)player.invuln=2;if(onlineMode){window.AbyssalOnline?.sendProtection?.(2,'upgrade-selected');window.AbyssalOnline?.sendBuild?.({shieldCharges:upgrades.shield,regenLevel:upgrades.regen,magnetStrength:upgrades.magnet});}upgradeLevels[u.id]=(upgradeLevels[u.id]||0)+1;
 const codex=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');if(!codex.skills.includes(u.id))codex.skills.push(u.id);localStorage.setItem('abyssalCodex',JSON.stringify(codex));
 level++;gameState='playing';$('upgradeScreen').hidden=true;showToast(`${u.name.toUpperCase()} · NÍVEL ${upgradeLevels[u.id]}/3`);playSkillSound(u.id,'learn');updateHud();last=performance.now();if(onlineMode&&xp>=xpNeed){xp-=xpNeed;xpNeed=Math.floor(xpNeed*1.34+3);setTimeout(()=>{if(gameState==='playing')offerUpgrade()},0)}
}
function offerUpgrade(){
 if(gameState==='upgrade')return;
 gameState='upgrade';chosen=[];upgradeOptions=upgradeList.filter(u=>(upgradeLevels[u.id]||0)<3).sort(()=>Math.random()-.5).slice(0,3);const wrap=$('upgradeChoices');wrap.innerHTML='';
 if(!upgradeOptions.length){gameState='playing';$('upgradeScreen').hidden=true;return}
 // Em coop, a escolha não congela o mundo e concede até 10 s de invulnerabilidade.
 if(player)player.invuln=Math.max(player.invuln,10);if(onlineMode)window.AbyssalOnline?.sendProtection?.(10,'upgrade-offer');
 upgradeOptions.forEach(u=>{const current=upgradeLevels[u.id]||0;const b=document.createElement('button');b.className='upgrade-card';b.innerHTML=`<span class="upgrade-icon">${u.icon}</span><strong>${u.name} · Nv. ${current+1}/3</strong><p>${u.desc}</p><small class="upgrade-progress">${'◆'.repeat(current)}${'◇'.repeat(3-current)} · ${current===0?'Desbloqueio':`Melhoria ${current} → ${current+1}`}</small>`;b.addEventListener('click',()=>chooseUpgrade(u));wrap.appendChild(b)});
 $('upgradeScreen').hidden=false;audio(330,.16,'sine',.03);
 upgradeAutoTimer=setTimeout(()=>{if(gameState==='upgrade'&&upgradeOptions.length){const available=upgradeOptions.filter(u=>(upgradeLevels[u.id]||0)<3);if(available.length)chooseUpgrade(available[Math.floor(Math.random()*available.length)]);else{gameState='playing';$('upgradeScreen').hidden=true}}},10000);
}
function spawnEnemy(initial=false,type='common'){
 if(!player||enemies.length>=MAX_ENEMIES)return null;
 const bossCount=enemies.filter(e=>BOSS_KINDS.includes(e.kind)).length,commonCount=enemies.length-bossCount;
 if(type==='boss'&&(bossCount>=MAX_BOSSES||enemies.length>=MAX_ENEMIES))return null;
 if(type!=='boss'&&commonCount>=MAX_COMMON_ENEMIES)return null;
 // Shared catalog + spawn-point logic: solo and online use identical anatomy, stats and corner vortices.
 const ai=window.AbyssalEnemyAI;
 const activeKinds=enemies.map(e=>e.kind);
 const kind=type==='boss'?(ai?.chooseBossKind(activeKinds)||BOSS_KINDS.find(k=>!activeKinds.includes(k))):
   (ai?.chooseCommonKind()||(()=>{const t=Math.random();return t<.56?'drifter':t<.78?'stinger':t<.94?'brute':'lurker'})());
 if(!kind)return null;
 const data=ai?.statsForKind(kind)||({
  boss:{r:40,hp:2820,speed:52,damage:25,color:'#ff315f',value:55},
  leviathan:{r:54,hp:4700,speed:44,damage:34,color:'#4ce0d1',value:90},
  maw:{r:45,hp:3750,speed:58,damage:31,color:'#c16cff',value:75},
  angler:{r:35,hp:3260,speed:66,damage:28,color:'#ffb45e',value:65},
  drifter:{r:10,hp:22,speed:51,damage:8,color:'#ff769d',value:1},
  stinger:{r:7,hp:13,speed:88,damage:6,color:'#ffbc78',value:2},
  brute:{r:16,hp:65,speed:30,damage:15,color:'#bd88ff',value:4},
  lurker:{r:20,hp:100,speed:43,damage:18,color:'#6e8dff',value:6}
 })[kind];
 if(type==='boss'){
  data.hp=lastBossMaxHp>0?Math.max(data.hp,lastBossMaxHp*1.5):data.hp;
  data.damage=lastBossDamage>0?Math.max(data.damage,Math.round(lastBossDamage*1.12)):data.damage;
  data.speed=Math.min(90,lastBossSpeed>0?Math.max(data.speed,lastBossSpeed*1.05):data.speed);
  lastBossMaxHp=data.hp;lastBossDamage=data.damage;lastBossSpeed=data.speed;bossIndex++;
 }
 const point=ai?.chooseSpawnPoint?ai.chooseSpawnPoint(Math.random,null,W,H):{x:rand(100,290),y:rand(90,250)};
 const x=clamp(point.x,70/worldZoom,W-70/worldZoom),y=clamp(point.y,70/worldZoom,H-70/worldZoom);
 const enemy={id:++enemyId,x,y,...data,r:data.r/worldZoom,speed:data.speed/worldZoom,maxHp:data.hp,angle:rand(0,6.28),phase:rand(0,6.28),hit:0,attackCd:rand(.3,1),kind};
 enemies.push(enemy);
 const seen=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');if(!seen.monsters.includes(kind)){seen.monsters.push(kind);localStorage.setItem('abyssalCodex',JSON.stringify(seen));}
 if(BOSS_KINDS.includes(kind)){lastBossKind=kind;showBossAlert(kind,enemy.id,bossIndex);burst(x,y,data.color,70,300);}
 return enemy;
}
function burst(x,y,color,n=10,force=100){
 n=Math.min(n,Math.max(0,particleBudget()-particles.length));for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,s=rand(force*.25,force),life=rand(.22,.7);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,max:life,r:rand(1,3.5),color})}
}
function addOrb(x,y,value){const r=(window.AbyssalEnemyAI?.xpOrbRadius?.(value)||Math.min(15,4+Math.sqrt(Math.max(1,value))))/worldZoom;orbs.push({id:`solo-${Math.random().toString(36).slice(2)}`,x,y,r,value,phase:rand(0,6.28),life:25})}
function hurtPlayer(dmg){
 if(player.invuln>0)return;if(upgrades.shield>0){upgrades.shield--;player.invuln=.7;burst(player.x,player.y,'#7ceff2',18,130);playSkillSound('shield','trigger');showToast('ESCUDO ABSORVEU O IMPACTO');return}
 hp-=dmg;player.invuln=.8;shake=8;damageFlash=.25;burst(player.x,player.y,'#ff668d',14,120);audio(120,.16,'sawtooth',.03);if(hp<=0)endGame();
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
 const nowMs=Date.now();
 if(nowMs-lastContactNoticeAt>1600){lastContactNoticeAt=nowMs;const names={drifter:'ERRANTE LUMINESCENTE',stinger:'FERRÃO DE FENDA',brute:'BRUTO DE PLACAS',lurker:'OCULTO DAS FOSSAS',boss:'ABERRAÇÃO ABISSAL',leviathan:'LEVIATÃ DAS FOSSAS',maw:'A BOCA DO ABISMO',angler:'LANTERNA MORTAL'};showToast(e?`ATAQUE IDENTIFICADO · ${names[kind]||kind.toUpperCase()}`:'IMPACTO RECEBIDO · SINCRONIZANDO POSIÇÕES');}
}
function applyOnlinePlayerVitals(data){
 if(!onlineMode||!player||!data||typeof data!=='object')return;
 const receivedAt=Number(data.serverTime)||Date.now();
 if(receivedAt<(Number(lastOnlineVitalsAt)||0))return;
 lastOnlineVitalsAt=receivedAt;
 if(Number.isFinite(Number(data.maxHp)))maxHp=Math.max(1,Number(data.maxHp));
 if(Number.isFinite(Number(data.hp)))hp=clamp(Number(data.hp),0,maxHp);
 if(Number.isFinite(Number(data.shieldCharges)))upgrades.shield=clamp(Math.floor(Number(data.shieldCharges)),0,3);
 if(Number.isFinite(Number(data.invulnerabilityMs)))player.invuln=clamp(Number(data.invulnerabilityMs)/1000,0,10);
 if(data.reason==='enemy-attack'&&Number(data.damage)>0){revealOnlineContactSource(data);shake=Math.max(shake,6);damageFlash=.22;burst(player.x,player.y,'#ff668d',12,100);audio(115,.14,'sawtooth',.025);}
 else if(data.reason==='shield-block'||data.blocked){revealOnlineContactSource(data);burst(player.x,player.y,'#7ceff2',16,110);playSkillSound('shield','trigger');}
 else if(data.reason==='regeneration'&&Number(data.healed)>0)playSkillSound('regen','trigger');
 updateHud();
 if(data.alive===false&&gameState!=='over')endGame();
}
let lastOnlineVitalsAt=0;
function onlineHost(){return !onlineMode;} // O mundo online é simulado pelo servidor, nunca por um jogador.
function gainXp(value, source='shared'){
 if(!Number.isFinite(value)||value<=0||!player)return;
 xp+=value; score+=Math.round(value*3);
 if(xp>=xpNeed && gameState!=='upgrade'){
   xp-=xpNeed; xpNeed=Math.floor(xpNeed*1.34+3); offerUpgrade();
 }
 updateHud();
}
function dealEnemyDamage(enemy, damage, skillId=null){
 if(!enemy||!Number.isFinite(damage)||damage<=0)return;
 if(skillId)playSkillSound(skillId,'trigger');
 if(onlineMode){
   const sent=window.AbyssalOnline?.sendDamage(enemy.id, damage);
   if(!sent)window.dispatchEvent(new CustomEvent('abyssal-world-damage-result',{detail:{ok:false,id:enemy.id,reason:'not-connected'}}));
   enemy.hit=.14;
   burst(enemy.x,enemy.y,'#c4b4ff',5,60);
   return;
 }
 enemy.hp-=damage; enemy.hit=.14;
 if(enemy.hp<=0){const idx=enemies.indexOf(enemy);if(idx>=0)killEnemy(idx);}
}
function currentInterpolatedEnemyPosition(e,now){
 if(!e)return {x:0,y:0};
 const duration=Math.max(1,Number(e.interpDuration)||1),t=Number.isFinite(e.interpAt)?clamp((now-e.interpAt)/duration,0,1):1;
 const sx=Number.isFinite(e.interpFromX)?e.interpFromX:e.x,sy=Number.isFinite(e.interpFromY)?e.interpFromY:e.y;
 const tx=Number.isFinite(e.interpTargetX)?e.interpTargetX:e.x,ty=Number.isFinite(e.interpTargetY)?e.interpTargetY:e.y;
 return {x:sx+(tx-sx)*t,y:sy+(ty-sy)*t};
}
function nearestOnlineTargetDistance(x,y){
 let best=player?Math.hypot(player.x-x,player.y-y):Infinity;
 const peers=window.AbyssalOnline?.getPlayers?.()||[];
 for(const peer of peers){const px=Number(peer.x),py=Number(peer.y);if(Number.isFinite(px)&&Number.isFinite(py))best=Math.min(best,Math.hypot(px-x,py-y));}
 return best;
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
  return {...(old||{}),...raw,x:from.x,y:from.y,r:Math.max(2,Number(raw.r)||4)/worldZoom,interpFromX:from.x,interpFromY:from.y,interpTargetX:tx,interpTargetY:ty,interpAt:now,interpDuration:old?100:0,authoritativePosition:true};
 });
}
function applySharedSnapshot(data){
 if(!onlineMode||!data||!Array.isArray(data.enemies))return;
 const now=performance.now(),previousById=new Map(enemies.map(e=>[e.id,e]));
 observeOnlineServerMotion(data);
 if(Number.isFinite(Number(data.elapsed))){authoritativeElapsed=Math.max(0,Number(data.elapsed));lastSnapshotAt=now;lastSnapshotTick=Number(data.tickCount)||lastSnapshotTick;}
 const previousBossIds=new Set(enemies.filter(e=>BOSS_KINDS.includes(e.kind)).map(e=>e.id));
 // Snapshots reconcile authoritative gameplay fields, but positions belong to the shared
 // local movement step. Never assign finite interpolation targets here: draw() uses a
 // finite interpTargetX/Y as a hard set-position operation and would freeze first-spawned mobs.
 if(window.AbyssalEnemyNetcode?.reconcileSnapshot){
  enemies=window.AbyssalEnemyNetcode.reconcileSnapshot(enemies,data.enemies,{radiusScale:1/worldZoom,maxX:W,maxY:H,minX:0,minY:0,now,interpolationMs:100});
 }else{
  // Fallback mirrors the authoritative interpolation module instead of running a
  // second enemy simulation in the browser.
  enemies=data.enemies.map(raw=>{const old=previousById.get(raw.id),serverX=clamp(Number(raw.x)||0,0,W),serverY=clamp(Number(raw.y)||0,0,H),from=old?currentInterpolatedEnemyPosition(old,now):{x:serverX,y:serverY};return {...old,...raw,x:from.x,y:from.y,r:Math.max(2,Number(raw.r)||12)/worldZoom,serverX,serverY,interpFromX:from.x,interpFromY:from.y,interpTargetX:serverX,interpTargetY:serverY,interpAt:now,interpDuration:old?100:0,authoritativePosition:true};});
 }
 applySharedOrbs(data.orbs,now);
 const codex=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');let codexChanged=false;for(const e of enemies){if(!codex.monsters.includes(e.kind)){codex.monsters.push(e.kind);codexChanged=true;}}if(codexChanged)localStorage.setItem('abyssalCodex',JSON.stringify(codex));
 const newBoss=enemies.find(e=>BOSS_KINDS.includes(e.kind)&&!previousBossIds.has(e.id));if(newBoss){lastRemoteBossId=newBoss.id;showBossAlert(newBoss.kind,newBoss.id,Number(newBoss.threat)||0);burst(newBoss.x,newBoss.y,newBoss.color,70,270);}
}
function applySharedDamage(data){ /* Dano é resolvido diretamente no servidor; mantido apenas por compatibilidade. */ }
function applySharedXp(data){
 if(!onlineMode||!data||!player)return;
 gainXp(Math.max(0,Number(data.value)||0),'shared');
}
function sendWorldSnapshot(dt){ /* O snapshot pertence ao servidor, não aos clientes. */ }
function killEnemy(i){
 const e=enemies[i];
 const killedBoss=BOSS_KINDS.includes(e.kind);if(killedBoss){bossKillsThisRun++;updateHud();}
 const codex=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');if(!codex.monsters.includes(e.kind))codex.monsters.push(e.kind);localStorage.setItem('abyssalCodex',JSON.stringify(codex));score+=e.value*10;if(!onlineMode)addOrb(e.x,e.y,e.value);burst(e.x,e.y,e.color,['boss','leviathan','maw','angler'].includes(e.kind)?100:e.kind==='brute'?22:12,['boss','leviathan','maw','angler'].includes(e.kind)?340:e.kind==='brute'?145:95);if(['boss','leviathan','maw','angler'].includes(e.kind)){score+=1400;coins+=100;showToast('BOSS ABISSAL DERROTADO · +100 MOEDAS');saveCosmetics();}enemies.splice(i,1);audio(e.kind==='brute'?160:260,.055,'triangle',.012);
}
function fire(){
 if(!player)return;let target=null,bd=Infinity;const maxRange=210*upgrades.range/worldZoom;
 for(const e of enemies){const d=dist(player,e);if(d<maxRange&&d<bd){target=e;bd=d}}
 if(!target)return;
 const a=Math.atan2(target.y-player.y,target.x-player.x);
 if(upgradeLevels.rate>0)playSkillSound('rate','trigger');
 if(upgrades.range>1.08&&bd>210/worldZoom)playSkillSound('range','trigger');
 projectiles.push({x:player.x+Math.cos(a)*13,y:player.y+Math.sin(a)*13,vx:Math.cos(a)*430/worldZoom,vy:Math.sin(a)*430/worldZoom,r:4.1/worldZoom,life:.95,damage:12*upgrades.power,pierceRemaining:upgrades.pierce||0,hitIds:[],color:upgrades.ricochet>0?'#ffc47a':upgrades.electric>0?'#eaffff':upgrades.pierce>0?'#ffe7a1':'#83fff3',special:upgrades.pierce>0?'pierce':upgrades.electric>0?'electric':upgrades.ricochet>0?'ricochet':null});
 if(onlineMode&&window.AbyssalOnline?.sendShot)window.AbyssalOnline.sendShot({x:(player.x+Math.cos(a)*13/worldZoom)/W,y:(player.y+Math.sin(a)*13/worldZoom)/H,vx:Math.cos(a)*430/(W*worldZoom),vy:Math.sin(a)*430/(H*worldZoom),damage:12*upgrades.power,color:upgrades.ricochet>0?'#ffc47a':upgrades.electric>0?'#eaffff':upgrades.pierce>0?'#ffe7a1':'#83fff3',special:upgrades.pierce>0?'pierce':upgrades.electric>0?'electric':upgrades.ricochet>0?'ricochet':null});
 player.angle=a;const muzzleX=player.x+Math.cos(a)*15,muzzleY=player.y+Math.sin(a)*15;burst(muzzleX,muzzleY,upgrades.ricochet>0?'#ffc47a':upgrades.electric>0?'#eaffff':upgrades.pierce>0?'#ffe7a1':'#9afff7',upgrades.ricochet>0||upgrades.electric>0?9:5,upgrades.ricochet>0||upgrades.electric>0?90:45);if(upgrades.electric>0)effects.push({type:'beam',x1:player.x,y1:player.y,x2:muzzleX+Math.cos(a)*30,y2:muzzleY+Math.sin(a)*30,life:.16,maxLife:.16,color:'#eaffff'});audio(500,.045,'sine',.008);
}
function update(dt){
 if((gameState!=='playing'&&!(onlineMode&&gameState==='upgrade'))||!player)return;
 // Movimento local responsivo: teclado e toque/arraste. No online, trocar de aba nunca pausa o estado local intencionalmente.
 if(gameState==='playing'){
   player.pulseCooldown=Math.max(0,(player.pulseCooldown||0)-dt);player.dashCooldown=Math.max(0,(player.dashCooldown||0)-dt);player.dashTime=Math.max(0,(player.dashTime||0)-dt);updateAbilityButtons();
   let mx=(keys['d']||keys['D']||keys['ArrowRight']?1:0)-(keys['a']||keys['A']||keys['ArrowLeft']?1:0);
   let my=(keys['s']||keys['S']||keys['ArrowDown']?1:0)-(keys['w']||keys['W']||keys['ArrowUp']?1:0);
   if(isMobileDevice()&&joystickVector.active){mx=joystickVector.x;my=joystickVector.y;}
   else if(pointer.down&&!isMobileDevice()){const dx=pointer.x-player.x,dy=pointer.y-player.y,dd=Math.hypot(dx,dy);if(dd>12){mx=dx/dd;my=dy/dd}else{mx=0;my=0}}
   const mag=Math.hypot(mx,my)||1; if(mx||my){if(upgradeLevels.speed>0)playSkillSound('speed','trigger');const dashMultiplier=player.dashTime>0?2.05:1;const nx=player.x+mx/mag*player.moveSpeed*upgrades.speed*dashMultiplier*dt,ny=player.y+my/mag*player.moveSpeed*upgrades.speed*dashMultiplier*dt;const wall=52/worldZoom;player.x=clamp(nx,wall+player.r,W-wall-player.r);player.y=clamp(ny,wall+player.r,H-wall-player.r);player.angle=Math.atan2(my,mx);updateCamera();player.trail.push({x:player.x,y:player.y,life:.28});if(player.trail.length>12)player.trail.shift()}
   player.fireTimer=(player.fireTimer||0)-dt;if(player.fireTimer<=0){fire();player.fireTimer=Math.max(.12,.52/(upgrades.rate||1))}
 }
 if(onlineMode&&authoritativeElapsed!==null&&lastSnapshotAt){elapsed=authoritativeElapsed+Math.max(0,(performance.now()-lastSnapshotAt)/1000);}else elapsed+=dt;if(!onlineMode)spawnTimer-=dt;player.invuln=Math.max(0,player.invuln-dt);damageFlash=Math.max(0,damageFlash-dt);shake=Math.max(0,shake-dt*22);
 if(!onlineMode&&spawnTimer<=0){const commonCount=enemies.filter(e=>!BOSS_KINDS.includes(e.kind)).length;if(commonCount<MAX_COMMON_ENEMIES&&enemies.length<MAX_ENEMIES){spawnEnemy(false,'common');spawnTimer=Math.max(.38,1.05-elapsed*.0015)}else spawnTimer=.35;}
 if(!onlineMode&&elapsed>=nextBossAt){const activeBosses=enemies.filter(e=>BOSS_KINDS.includes(e.kind)).length;if(activeBosses<MAX_BOSSES&&enemies.length<MAX_ENEMIES)spawnEnemy(false,'boss');nextBossAt=elapsed+60;}
 if(!onlineMode&&upgrades.regen>0&&Math.random()<dt*upgrades.regen*.25){const beforeRegen=hp;hp=Math.min(maxHp,hp+1);if(hp>beforeRegen)playSkillSound('regen','trigger');}
 if(upgrades.burst>0){player.burstTimer=(player.burstTimer||0)-dt;if(player.burstTimer<=0){player.burstTimer=Math.max(3.5,7/upgrades.burst);for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<210*upgrades.range/worldZoom){dealEnemyDamage(e,12*upgrades.burst,'burst');burst(e.x,e.y,'#b4a1ff',8,100)}}burst(player.x,player.y,'#b3a0ff',60,260);effects.push({type:'ring',x:player.x,y:player.y,r:0,max:210*upgrades.range/worldZoom,life:.55,maxLife:.55,color:'#b3a0ff'});playSkillSound('burst','trigger')}}
 if(upgrades.nova>0){player.novaTimer=(player.novaTimer||0)-dt;if(player.novaTimer<=0){player.novaTimer=Math.max(4.5,9/upgrades.nova);for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<210*upgrades.range/worldZoom){dealEnemyDamage(e,18*upgrades.nova,'nova');burst(e.x,e.y,'#72f5ff',12,130)}}burst(player.x,player.y,'#72f5ff',85,300);effects.push({type:'ring',x:player.x,y:player.y,r:0,max:210*upgrades.range/worldZoom,life:.75,maxLife:.75,color:'#72f5ff'});playSkillSound('nova','trigger')}}
 // Co-op is rendered from the server's authoritative coordinates. Do NOT run a
 // second local AI here: that divergence is what made server-side contact attacks feel
 // like invisible enemies. Solo keeps its original local movement/collision loop.
 onlineVisualEnemyCount=enemies.length;onlineVisualMovingEnemies=0;
 const enemyFrameNow=performance.now();
 for(let i=enemies.length-1;i>=0;i--){
  const e=enemies[i];e.hit=Math.max(0,e.hit-dt);
  if(onlineMode){
   const bx=Number(e.x)||0,by=Number(e.y)||0;
   const p=window.AbyssalEnemyNetcode?.renderedPosition?.(e,enemyFrameNow);
   if(p){e.x=p.x;e.y=p.y;}
   if(Math.hypot(e.x-bx,e.y-by)>.02)onlineVisualMovingEnemies++;
   continue;
  }
  const target={x:player.x,y:player.y,local:true};
  const beforeEnemyX=e.x,beforeEnemyY=e.y;
  if(window.AbyssalEnemyAI?.moveTowardTarget){
   window.AbyssalEnemyAI.moveTowardTarget(e,[target],dt,{minX:8/worldZoom,maxX:W-8/worldZoom,minY:8/worldZoom,maxY:H-8/worldZoom,stopDistance:Math.max(1,(e.r+player.r+8/worldZoom)*.96)});
  }else{
   const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy)||1;e.phase+=dt*(e.kind==='stinger'?7:3);e.angle=Math.atan2(dy,dx);e.x=clamp(e.x+dx/d*e.speed*dt,8/worldZoom,W-8/worldZoom);e.y=clamp(e.y+dy/d*e.speed*dt,8/worldZoom,H-8/worldZoom);
  }
  const td=Math.hypot(e.x-player.x,e.y-player.y);
  if(Math.hypot(e.x-beforeEnemyX,e.y-beforeEnemyY)>.05)onlineVisualMovingEnemies++;
  if(target.local&&td<e.r+player.r+8/worldZoom){e.attackCd-=dt;if(player.invuln<=0){hurtPlayer(e.damage);e.attackCd=e.kind==='stinger'?.8:1.1;}}
 }
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;let hit=false;for(let j=enemies.length-1;j>=0;j--){const e=enemies[j];p.hitIds ||= [];if(!p.hitIds.includes(e.id)&&Math.hypot(p.x-e.x,p.y-e.y)<p.r+e.r){p.hitIds.push(e.id);dealEnemyDamage(e,p.damage,p.special||(upgradeLevels.power>0?'power':null));e.hit=.12;burst(p.x,p.y,p.color,4,40);if(p.special)playSkillSound(p.special,'trigger');
 if((upgrades.electric||0)>0){let chains=0,from=e;const visited=new Set([e.id]);while(chains<Math.min(3,upgrades.electric)){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(!visited.has(other.id)&&d<120/worldZoom&&d<nd){next=other;nd=d}}if(!next)break;effects.push({type:'beam',x1:from.x,y1:from.y,x2:next.x,y2:next.y,life:.24,maxLife:.24,color:'#79f3ff'});burst(from.x,from.y,'#e6ffff',4,70);burst(next.x,next.y,'#79f3ff',12,120);dealEnemyDamage(next,p.damage*(.28+upgrades.electric*.08),'electric');playSkillSound('electric','trigger');next.hit=.12;burst(next.x,next.y,'#79f3ff',10,95);visited.add(next.id);from=next;chains++;}}
 if((upgrades.ricochet||0)>0){let from=e;const visited=new Set([e.id]);for(let bounce=0;bounce<Math.min(2,upgrades.ricochet);bounce++){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(!visited.has(other.id)&&d<190/worldZoom&&d<nd){next=other;nd=d}}if(!next)break;effects.push({type:'beam',x1:from.x,y1:from.y,x2:next.x,y2:next.y,life:.28,maxLife:.28,color:'#ffc47a'});burst(from.x,from.y,'#fff0c7',4,65);burst(next.x,next.y,'#ffc47a',14,135);dealEnemyDamage(next,p.damage*.42,'ricochet');playSkillSound('ricochet','trigger');next.hit=.15;burst(next.x,next.y,'#ffc47a',14,125);visited.add(next.id);from=next;}}
 if((p.pierceRemaining||0)>0){p.pierceRemaining--; }else{hit=true;break}}}if(hit||p.life<=0||p.x< -100/worldZoom||p.x>W+100/worldZoom||p.y< -100/worldZoom||p.y>H+100/worldZoom)projectiles.splice(i,1)}
 for(let i=orbs.length-1;i>=0;i--){
  const o=orbs[i];
  if(onlineMode){o.phase=(Number(o.phase)||0)+dt*3;const op=currentInterpolatedEnemyPosition(o,performance.now());o.x=op.x;o.y=op.y;continue;}
  o.phase+=dt*3;o.life-=dt;
  let d=Math.hypot(player.x-o.x,player.y-o.y);
  if(d<100*upgrades.magnet/worldZoom){
   if(upgradeLevels.magnet>0)playSkillSound('magnet','trigger');
   const f=clamp((100*upgrades.magnet/worldZoom-d)/(100/worldZoom),0,1),pull=Math.min(d,dt*(2+f*8));
   if(d>0.001){o.x+=(player.x-o.x)/d*pull;o.y+=(player.y-o.y)/d*pull;}
   d=Math.hypot(player.x-o.x,player.y-o.y);
  }
  if(d<player.r+o.r+4/worldZoom){
   orbs.splice(i,1);burst(o.x,o.y,'#9f91ff',5,55);audio(700+Math.random()*180,.06,'sine',.012);
   gainXp(o.value,'orb');
   if(gameState==='upgrade')break;
  }else if(o.life<=0)orbs.splice(i,1);
 }
 for(let i=effects.length-1;i>=0;i--){effects[i].life-=dt;if(effects[i].life<=0)effects.splice(i,1)}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.05,dt);p.vy*=Math.pow(.05,dt);p.life-=dt;if(p.life<=0)particles.splice(i,1)}
 if(particles.length>particleBudget())particles.splice(0,particles.length-particleBudget());if(projectiles.length>projectileBudget())projectiles.splice(0,projectiles.length-projectileBudget());if(effects.length>effectBudget())effects.splice(0,effects.length-effectBudget());if(orbs.length>orbBudget())orbs.splice(0,orbs.length-orbBudget());
 if(onlineMode&&window.AbyssalOnline){window.AbyssalOnline.sendPosition({x:player.x,y:player.y,angle:player.angle});sendWorldSnapshot(dt);runProgressTimer-=dt;if(runProgressTimer<=0){runProgressTimer=1;window.AbyssalOnline.sendRunProgress?.({score,level,survival:elapsed,bossesKilled:bossKillsThisRun});}}
 updateHud();
}
const metaShopItems=[
 {id:'bulkhead',name:'Costelas de Basalto',type:'passive',price:1800,max:3,icon:'⬡',desc:'+8 de vida máxima por nível.'},
 {id:'focuser',name:'Lente de Fótons',type:'passive',price:2200,max:3,icon:'✧',desc:'+8% de dano inicial por nível.'},
 {id:'current',name:'Aletas de Corrente',type:'passive',price:1600,max:3,icon:'➤',desc:'+5% de movimento por nível.'},
 {id:'startShield',name:'Casulo de Pressão',type:'passive',price:3200,max:1,icon:'◉',desc:'Comece cada mergulho com 1 carga de escudo.'},
 {id:'pulse',name:'Pulso de Maré',type:'active',price:3500,max:1,icon:'✺',desc:'Ative Q ou o botão para causar dano em área. Recarga: 14 s.'},
 {id:'dash',name:'Passo Fantasma',type:'active',price:4200,max:1,icon:'〰',desc:'Ative E ou o botão para disparar em alta velocidade e ficar invulnerável por 1,25 s.'}
];
function buyMetaUpgrade(id){
 const item=metaShopItems.find(x=>x.id===id);if(!item)return;
 const current=Number(metaUpgrades[id])||0;if(current>=item.max){showToast('MELHORIA JÁ NO NÍVEL MÁXIMO');return;}
 if(window.AbyssalOnline?.isAuthenticated()){
  window.AbyssalOnline.purchaseMeta(id);return;
 }
 if(coins<item.price){showToast('ESSÊNCIA INSUFICIENTE');return;}
 coins-=item.price;metaUpgrades[id]=current+1;saveCosmetics();renderShop();showToast(`${item.name.toUpperCase()} DESBLOQUEADO`);playSkillSound(id,'learn');
}
function activateAbility(id){
 if(!player||gameState!=='playing')return;
 if(id==='pulse'){
  if(!(Number(metaUpgrades.pulse)>0)){showToast('DESBLOQUEIE PULSO DE MARÉ NA LOJA');return;}
  if(player.pulseCooldown>0)return;
  player.pulseCooldown=14;const radius=245*upgrades.range/worldZoom;
  for(const e of [...enemies])if(dist(player,e)<radius){dealEnemyDamage(e,28*upgrades.power,'pulse');burst(e.x,e.y,'#78f8f3',10,120);}
  effects.push({type:'ring',x:player.x,y:player.y,r:0,max:radius,life:.7,maxLife:.7,color:'#78f8f3'});burst(player.x,player.y,'#9ffff8',60,260);playSkillSound('pulse','trigger');showToast('PULSO DE MARÉ · LIBERADO');
 }else if(id==='dash'){
  if(!(Number(metaUpgrades.dash)>0)){showToast('DESBLOQUEIE PASSO FANTASMA NA LOJA');return;}
  if(player.dashCooldown>0)return;
  player.dashCooldown=18;player.dashTime=1.25;player.invuln=Math.max(player.invuln,1.25);if(onlineMode)window.AbyssalOnline?.sendProtection?.(1.25,'dash');player.x=clamp(player.x+Math.cos(player.angle||0)*92/worldZoom,52/worldZoom+player.r,W-52/worldZoom-player.r);player.y=clamp(player.y+Math.sin(player.angle||0)*92/worldZoom,52/worldZoom+player.r,H-52/worldZoom-player.r);updateCamera();burst(player.x,player.y,'#d8c9ff',24,150);playSkillSound('dash','trigger');showToast('PASSO FANTASMA · INVULNERÁVEL');
 }
 updateAbilityButtons();
}
function updateAbilityButtons(){
 const pulse=$('skillPulseBtn'),dash=$('skillDashBtn');
 if(pulse){pulse.hidden=!(Number(metaUpgrades.pulse)>0);pulse.disabled=!player||player.pulseCooldown>0;pulse.textContent=player&&player.pulseCooldown>0?`PULSO ${player.pulseCooldown.toFixed(1)}s`:'Q · PULSO DE MARÉ';}
 if(dash){dash.hidden=!(Number(metaUpgrades.dash)>0);dash.disabled=!player||player.dashCooldown>0;dash.textContent=player&&player.dashCooldown>0?`PASSO ${player.dashCooldown.toFixed(1)}s`:'E · PASSO FANTASMA';}
}
function updateHud(){
 $('timeText').textContent=fmtTime(elapsed);$('levelText').textContent=String(level).padStart(2,'0');$('bossKillsText').textContent=String(bossKillsThisRun).padStart(2,'0');$('scoreText').textContent=score.toLocaleString('pt-BR');$('hpText').textContent=`${Math.ceil(Math.max(0,hp))} / ${maxHp}`;$('hpFill').style.width=`${clamp(hp/maxHp*100,0,100)}%`;$('xpText').textContent=`${Math.floor(xp)} / ${xpNeed}`;$('xpFill').style.width=`${clamp(xp/xpNeed*100,0,100)}%`;
}
function endGame(){
 if(gameState==='over'||gameState==='menu')return;
 const authenticated=Boolean(window.AbyssalOnline?.isAuthenticated?.());
 if(authenticated&&window.AbyssalOnline?.finishRun)window.AbyssalOnline.finishRun({survival:elapsed,score,level,bossesKilled:bossKillsThisRun},{leaveAfter:onlineMode});
 else { coins+=Math.max(5,Math.floor(score/35)+level*2);saveCosmetics();renderShop(); }
 if(onlineMode&&!authenticated)window.AbyssalOnline?.leaveWorld();
 const endBtn=document.getElementById('endDiveBtn');if(endBtn)endBtn.style.display='none';
 gameState='over';$('hud').hidden=true;$('pauseBtn').hidden=true;const mobileStick=$('mobileJoystick');if(mobileStick)mobileStick.hidden=true;$('gameOverScreen').hidden=false;
 $('finalTime').textContent=fmtTime(elapsed);$('finalScore').textContent=score.toLocaleString('pt-BR');$('finalLevel').textContent=level;
 if(score>bestScore){bestScore=score;localStorage.setItem('abyssalBestScore',String(score));$('bestScore').textContent=bestScore.toLocaleString('pt-BR')}
 if(elapsed>bestTime){bestTime=elapsed;localStorage.setItem('abyssalBestTime',String(elapsed));$('bestTime').textContent=fmtTime(bestTime)}
 $('saveStatus').textContent='SINAL DE SOBREVIVÊNCIA REGISTRADO';burst(player.x,player.y,'#ff7796',35,210);audio(95,.5,'sawtooth',.04);
}
function pauseGame(){if(onlineMode){showToast('A partida cooperativa não pode ser pausada.');return}if(gameState!=='playing')return;gameState='paused';$('pauseScreen').hidden=false;$('pauseBtn').hidden=true}
function resumeGame(){if(gameState!=='paused')return;gameState='playing';$('pauseScreen').hidden=true;$('pauseBtn').hidden=false;last=performance.now()}
function drawBackground(t){
 const g=ctx.createRadialGradient(W*.5,H*.46,10,W*.5,H*.46,Math.max(W,H)*.8);g.addColorStop(0,'#103041');g.addColorStop(.48,'#081d2b');g.addColorStop(1,'#030b13');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 // Deep-water light columns
 ctx.save();for(let i=0;i<5;i++){const x=W*(.1+i*.2)+Math.sin(t*.00015+i)*25;ctx.globalAlpha=.025+Math.sin(t*.0003+i)*.008;ctx.fillStyle=i%2?'#5bd9dd':'#6878df';ctx.beginPath();ctx.moveTo(x-35,0);ctx.lineTo(x+30,0);ctx.lineTo(x+130,H);ctx.lineTo(x+20,H);ctx.closePath();ctx.fill()}ctx.restore();
 // Subtle grid
 ctx.save();ctx.strokeStyle='rgba(93,175,190,.045)';ctx.lineWidth=1;const grid=44,ox=(t*.008)%grid,oy=(t*.004)%grid;for(let x=-grid+ox;x<W;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=-grid+oy;y<H;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.restore();
 for(const p of decor){p.y-=p.speed*.012;if(p.y<-5){p.y=H+5;p.x=Math.random()*W}ctx.globalAlpha=p.a*(.6+.4*Math.sin(t*.001+p.phase));ctx.fillStyle='#a0f9f1';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
 // distant drifting silhouettes
 for(let i=0;i<4;i++){const x=((i*317+t*.012*(i%2?1:-1))%(W+180))-90,y=H*(.18+i*.2)+Math.sin(t*.0005+i)*18;ctx.globalAlpha=.06;ctx.fillStyle='#68d0d6';ctx.beginPath();ctx.ellipse(x,y,25+i*3,7+i,Math.sin(t*.0002+i),0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(x-20,y);ctx.lineTo(x-35,y-10);ctx.lineTo(x-32,y+10);ctx.fill()}ctx.globalAlpha=1;
}
function drawCreature(x,y,r,angle,color,kind,t,playerCreature=false,hit=0,renderContext=ctx,skinOverride=null){
 const c=renderContext;
 const skin=playerCreature?(skinOverride||(skinData.find(s=>s.id===equippedSkin)||skinData[0])):null;
 const id=skin?.id||'default';
 const boss=['boss','leviathan','maw','angler'].includes(kind);
 const glowScale=(playerCreature||boss)?1:(r<13?.18:r<22?.38:.68);
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
 const eye=(ex,ey,er=r*.09,iris='#e6ffff')=>{c.save();c.fillStyle='#020a12';c.beginPath();c.ellipse(ex*r,ey*r,er*1.3,er*1.65,0,0,Math.PI*2);c.fill();c.fillStyle=iris;c.shadowBlur=12*glowScale;c.shadowColor=iris;c.beginPath();c.arc(ex*r+er*.2,ey*r-er*.18,er*.5,0,Math.PI*2);c.fill();c.restore()};
 const teeth=(cx,cy,rx,ry,count=8,scale=1,reverse=false)=>{c.save();c.fillStyle='#f6fbec';c.shadowBlur=7*glowScale;c.shadowColor='#ffb4bb';for(let i=0;i<count;i++){const a=(i/count)*Math.PI*2,tx=cx+Math.cos(a)*rx,ty=cy+Math.sin(a)*ry,innerX=cx+Math.cos(a)*rx*.68,innerY=cy+Math.sin(a)*ry*.68;c.beginPath();c.moveTo(tx*r,ty*r);c.lineTo((innerX+Math.cos(a+.2)*.09*scale)*r,(innerY+Math.sin(a+.2)*.09*scale)*r);c.lineTo((innerX+Math.cos(a-.2)*.09*scale)*r,(innerY+Math.sin(a-.2)*.09*scale)*r);c.closePath();c.fill()}c.restore()};
 const gills=(x0=-.2,y0=-.28,count=3,side=1)=>{for(let i=0;i<count;i++){const xx=x0+i*.12;stroke(()=>{c.moveTo(xx*r,y0*r);c.quadraticCurveTo((xx-.12)*r,(y0+.13)*r,(xx-.06)*r,(y0+.22)*r)},Math.max(.7,r*.028),'rgba(194,255,248,.72)',4)}};
 const finRay=(x0,y0,x1,y1,x2,y2,col=color)=>fin([[x0,y0],[x1,y1],[x2,y2]],col,'rgba(230,255,249,.48)');

 if(playerCreature){
  // Every skin has a readable, largely bilateral deep-sea silhouette.
  if(id==='default'){
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
 if(kind==='drifter'){
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
 } else if(kind==='leviathan'){
  // Ancient trench leviathan: colossal plated eel with bony crest, fins and side gills.
  fill(()=>{c.moveTo(-2.6*r,.02*r);c.quadraticCurveTo(-2.0*r,-.47*r,-1.15*r,-.42*r);c.quadraticCurveTo(-.45*r,-.3*r,.1*r,-.35*r);c.lineTo(.72*r,-.18*r);c.lineTo(1.0*r,.04*r);c.quadraticCurveTo(.35*r,.4*r,-.78*r,.34*r);c.quadraticCurveTo(-1.8*r,.43*r,-2.6*r,.02*r)},bodyGrad(color),'rgba(225,255,250,.66)',Math.max(1.4,r*.045),15);
  fin([[-2.32,.03],[-2.88,-.28],[-2.63,.05],[-2.86,.31]],color);for(let i=0;i<9;i++){const xx=(-1.75+i*.25)*r;fin([[xx/r,-.32],[xx/r-.1,-.78-(i%3===0?.18:0)],[xx/r+.14,-.28]],color,'#d0fff9');stroke(()=>{c.moveTo(xx,-.23*r);c.lineTo((xx-.02*r),.25*r)},Math.max(.8,r*.026),'rgba(231,255,255,.72)',4)}
  fill(()=>{c.ellipse(.68*r,-.04*r,.3*r,.28*r,-.08,0,Math.PI*2)},'#d0e9de','#f4fffb',Math.max(1,r*.04),10);eye(.76,-.14,r*.055,'#9dfff0');gills(.13,-.18,4);
 } else if(kind==='maw'){
  // A circular predator: jaw ring, radial teeth, plated lips and short feeding tentacles.
  for(let i=0;i<8;i++){const a=Math.PI+i*Math.PI/7,sx=Math.cos(a)*.58,sy=Math.sin(a)*.58;tentacle(sx,sy,sx-.18,sy+.22,sx+.15,sy+.54,sx-.1,sy+.82,.85)}
  body(1.05,1.0,0,color);c.save();c.fillStyle='#080713';c.strokeStyle='#ff92e1';c.lineWidth=Math.max(1.5,r*.075);c.shadowBlur=22;c.shadowColor=color;c.beginPath();c.ellipse(.2*r,0,.56*r,.63*r,0,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle='rgba(255,220,252,.7)';c.lineWidth=Math.max(1,r*.035);c.beginPath();c.ellipse(.2*r,0,.68*r,.75*r,0,0,Math.PI*2);c.stroke();c.restore();teeth(.2,0,.52,.59,18,1.05);for(let side of [-1,1]){fin([[-.48,side*.35],[-.92,side*.78],[-.35,side*.63]],color);fin([[.55,side*.4],[.9,side*.68],[.73,side*.29]],'#f6bcff')}eye(.52,-.12,r*.055,'#f4d5ff');
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
 const vortices=[
  {x:138,y:138,label:'FENDA I',phase:0},
  {x:W-138,y:138,label:'FENDA II',phase:1.2},
  {x:138,y:H-138,label:'FENDA III',phase:2.4},
  {x:W-138,y:H-138,label:'FENDA IV',phase:3.6}
 ];
 for(const v of vortices){
  const pulse=1+Math.sin(t*.0014+v.phase)*.08,r=58/worldZoom*pulse;
  const glow=ctx.createRadialGradient(v.x,v.y,1,v.x,v.y,r*1.9);glow.addColorStop(0,'rgba(49,215,218,.18)');glow.addColorStop(.55,'rgba(43,135,164,.08)');glow.addColorStop(1,'rgba(10,35,52,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(v.x,v.y,r*1.9,0,Math.PI*2);ctx.fill();
  for(let ring=0;ring<3;ring++){const rr=(18+ring*15+Math.sin(t*.0011+v.phase+ring)*3)/worldZoom;ctx.beginPath();ctx.ellipse(v.x,v.y,rr*1.08,rr*.72,t*.00018*(ring%2?-1:1)+v.phase,0,Math.PI*2);ctx.strokeStyle=`rgba(96,244,233,${.28-ring*.065})`;ctx.lineWidth=(2-ring*.35)/worldZoom;ctx.stroke();}
  ctx.save();ctx.translate(v.x,v.y);ctx.rotate(-t*.00042-v.phase);ctx.beginPath();for(let a=0;a<=Math.PI*3.5;a+=.12){const rr=(4+a*2.3)/worldZoom;if(a===0)ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);else ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.strokeStyle='rgba(110,247,239,.64)';ctx.lineWidth=1.6/worldZoom;ctx.shadowBlur=14/worldZoom;ctx.shadowColor='#4de4df';ctx.stroke();ctx.restore();
  ctx.fillStyle='rgba(160,242,237,.8)';ctx.font=`${9/worldZoom}px 'DM Mono',monospace`;ctx.textAlign='center';ctx.fillText(v.label,v.x,v.y+79/worldZoom);
 }
 ctx.setLineDash([]);ctx.shadowBlur=0;
 // The central abyssal cave is a fixed landmark in the map, not an effect attached to the player.
 const caveX=W*.5,caveY=H*.5;for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(caveX,caveY,(88+i*25)/worldZoom,(52+i*17)/worldZoom,Math.sin(t*.00015+i)*.035,0,Math.PI*2);ctx.strokeStyle=`rgba(98,207,218,${.12-i*.017})`;ctx.lineWidth=1.5/worldZoom;ctx.stroke();}
 const left=cameraX-70/worldZoom,right=cameraX+viewW/worldZoom+70/worldZoom,top=cameraY-70/worldZoom,bottom=cameraY+viewH/worldZoom+70/worldZoom;
 for(const rock of arenaRocks){if(rock.x<left||rock.x>right||rock.y<top||rock.y>bottom)continue;ctx.save();ctx.translate(rock.x,rock.y);ctx.beginPath();rock.vertices.forEach(([vx,vy],i)=>{const x=vx*(rock.shade>.5?1.14:1),y=vy*(rock.shade>.5?.9:1.12);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.closePath();const gr=ctx.createLinearGradient(-rock.r,-rock.r,rock.r,rock.r);gr.addColorStop(0,'#244958');gr.addColorStop(.45,'#102a38');gr.addColorStop(1,'#06121c');ctx.fillStyle=gr;ctx.strokeStyle='rgba(102,181,193,.45)';ctx.lineWidth=1.6/worldZoom;ctx.shadowBlur=8/worldZoom;ctx.shadowColor='rgba(35,145,162,.2)';ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-rock.r*.25,-rock.r*.15);ctx.lineTo(-rock.r*.04,-rock.r*.42);ctx.lineTo(rock.r*.18,-rock.r*.09);ctx.strokeStyle='rgba(141,224,229,.22)';ctx.lineWidth=1/worldZoom;ctx.stroke();ctx.restore();}
 ctx.strokeStyle='rgba(108,215,222,.32)';ctx.lineWidth=2/worldZoom;ctx.setLineDash([9/worldZoom,13/worldZoom]);ctx.strokeRect(18/worldZoom,18/worldZoom,W-36/worldZoom,H-36/worldZoom);ctx.setLineDash([]);
 ctx.restore();
}

function draw(t){
 ctx.setTransform(dpr*worldZoom,0,0,dpr*worldZoom,0,0);updateCamera();ctx.save();if(shake>0)ctx.translate(rand(-shake,shake),rand(-shake,shake));ctx.translate(-cameraX,-cameraY);drawBackground(t);drawArenaTerrain(t);
 // faint floor current rings
 ctx.save();ctx.strokeStyle='rgba(105,207,214,.08)';for(let i=0;i<4;i++){const rr=(65+i*46+Math.sin(t*.001+i)*4)/worldZoom;ctx.beginPath();ctx.ellipse(player?.x??W*.5,player?.y??H*.5,rr*1.5/worldZoom,rr*.7/worldZoom,Math.sin(t*.0002)*.1,0,Math.PI*2);ctx.stroke()}ctx.restore();
 for(const o of orbs){if(onlineMode&&Number.isFinite(o.interpAt)){const op=currentInterpolatedEnemyPosition(o,performance.now());o.x=op.x;o.y=op.y;}const pulse=1+Math.sin(o.phase)*.2;ctx.save();ctx.shadowBlur=18;ctx.shadowColor='#a28dff';ctx.fillStyle='#b8a7ff';ctx.beginPath();ctx.arc(o.x,o.y,o.r*pulse,0,Math.PI*2);ctx.fill();ctx.fillStyle='#effaff';ctx.beginPath();ctx.arc(o.x-o.r*.25,o.y-o.r*.25,o.r*.3,0,Math.PI*2);ctx.fill();ctx.restore()}
 for(const p of projectiles){ctx.save();const trail=p.allyShot?'#9bbcff':(p.special==='pierce'?'#ffe7a1':p.special==='ricochet'?'#ffc47a':p.special==='electric'?'#79f3ff':p.color);ctx.strokeStyle=trail;ctx.lineWidth=p.special==='pierce'?6:p.allyShot?5.5:p.special==='electric'?5:p.special==='ricochet'?5:p.r*2;ctx.shadowBlur=p.special?30:p.allyShot?26:18;ctx.shadowColor=trail;ctx.beginPath();ctx.moveTo(p.x-p.vx*(p.special==='pierce'?.065:.045),p.y-p.vy*(p.special==='pierce'?.065:.045));ctx.lineTo(p.x,p.y);ctx.stroke();if(p.special==='electric'){ctx.strokeStyle='#eaffff';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(p.x-p.vx*.025,p.y-p.vy*.025);ctx.lineTo(p.x+rand(-4,4),p.y+rand(-4,4));ctx.lineTo(p.x,p.y);ctx.stroke()}ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(p.x,p.y,p.special==='pierce'?p.r*1.3:p.r,0,Math.PI*2);ctx.fill();
 if(p.allyShot){ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.x-p.vx*.018,p.y-p.vy*.018);ctx.lineTo(p.x+rand(-3,3),p.y+rand(-3,3));ctx.lineTo(p.x,p.y);ctx.stroke()}
 ctx.restore()}
 for(const e of enemies){if(onlineMode&&window.AbyssalEnemyNetcode?.renderedPosition){const p=window.AbyssalEnemyNetcode.renderedPosition(e,performance.now());e.x=p.x;e.y=p.y;}else if(e.interpDuration>0&&Number.isFinite(e.interpAt)){const ip=clamp((performance.now()-e.interpAt)/e.interpDuration,0,1);e.x=e.interpFromX+(e.interpTargetX-e.interpFromX)*ip;e.y=e.interpFromY+(e.interpTargetY-e.interpFromY)*ip;}else if(Number.isFinite(e.interpTargetX)){e.x=e.interpTargetX;e.y=e.interpTargetY;}drawCreature(e.x,e.y,e.r,e.angle,e.color,e.kind,t,false,e.hit);if(e.hp<e.maxHp||['boss','leviathan','maw','angler'].includes(e.kind)){ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(e.x-e.r,e.y-e.r-(['boss','leviathan','maw','angler'].includes(e.kind)?16:8),e.r*2,['boss','leviathan','maw','angler'].includes(e.kind)?6:3);ctx.fillStyle=e.color;ctx.fillRect(e.x-e.r,e.y-e.r-(['boss','leviathan','maw','angler'].includes(e.kind)?16:8),e.r*2*clamp(e.hp/e.maxHp,0,1),['boss','leviathan','maw','angler'].includes(e.kind)?6:3);if(['boss','leviathan','maw','angler'].includes(e.kind)){ctx.fillStyle='#ffd8e2';ctx.font='bold 11px sans-serif';ctx.textAlign='center';const labels={boss:'ABERRAÇÃO ABISSAL',leviathan:'LEVIATÃ DAS FOSSAS',maw:'A BOCA DO ABISMO',angler:'LANTERNA MORTAL'};ctx.fillText(labels[e.kind]||'BOSS ABISSAL',e.x,e.y-e.r-22)}}}
 for(const fx of effects){ctx.save();ctx.globalAlpha=clamp(fx.life/fx.maxLife,0,1);ctx.strokeStyle=fx.color;ctx.shadowBlur=24;ctx.shadowColor=fx.color;ctx.lineWidth=fx.type==='ring'?4:3;ctx.beginPath();if(fx.type==='ring'){const progress=1-fx.life/fx.maxLife;ctx.arc(fx.x,fx.y,fx.max*progress,0,Math.PI*2)}else{ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(fx.x2,fx.y2);ctx.lineTo(fx.x2+rand(-5,5),fx.y2+rand(-5,5))}ctx.stroke();ctx.restore()}
 for(const p of particles){ctx.save();ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.shadowBlur=7;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(.4+.6*p.life/p.max),0,Math.PI*2);ctx.fill();ctx.restore()}
 if(player){for(const tr of player.trail){if(tr.life>0){ctx.globalAlpha=tr.life/.28*.18;ctx.fillStyle='#7ffbf2';ctx.beginPath();ctx.arc(tr.x,tr.y,player.r*.7,0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1;if(player.invuln<=0||Math.floor(t/80)%2===0)drawCreature(player.x,player.y,player.r,player.angle,currentSkinColor(),'player',t,true);ctx.save();ctx.strokeStyle='rgba(126,245,244,.20)';ctx.fillStyle='rgba(126,245,244,.025)';ctx.lineWidth=1;ctx.setLineDash([5,9]);ctx.beginPath();ctx.arc(player.x,player.y,210*(upgrades.range||1)/worldZoom,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.restore();if(damageFlash>0){ctx.fillStyle=`rgba(255,65,100,${damageFlash*.45})`;ctx.fillRect(0,0,W,H)}}
 // Cooperative companions: live players are relayed by the online server; if alone, a helper drone appears.
 if(player && onlineMode){
   const peers=window.AbyssalOnline?window.AbyssalOnline.getPlayers():[];
   peers.forEach(peer=>{const px=Number(peer.x)||0,py=Number(peer.y)||0;drawCreature(px,py,12/worldZoom,peer.angle||0,peer.color||'#b8a4ff','peer',t,true,0,ctx,window.AbyssalGameHooks?.skinForId?.(peer.skinId));ctx.fillStyle='#d8ffff';ctx.font='10px Manrope';ctx.textAlign='center';ctx.fillText(peer.nickname||'Mergulhador',px,py-22)});
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
function loop(t){const dt=Math.min(.035,Math.max(0,(t-last)/1000||0));last=t;try{if(gameState==='playing'||(onlineMode&&gameState==='upgrade'))update(dt);draw(t)}catch(err){console.error('Abyssal frame error:',err);if(!loopErrorShown){loopErrorShown=true;showToast('A pressão distorceu os instrumentos. Consulte o Console (F12) se persistir.')}}requestAnimationFrame(loop)}
function coords(e){const r=canvas.getBoundingClientRect();return{x:cameraX+(e.clientX-r.left)/worldZoom,y:cameraY+(e.clientY-r.top)/worldZoom}}
canvas.addEventListener('pointerdown',e=>{if(gameState!=='playing'||isMobileDevice())return;pointer={...coords(e),down:true,active:true};canvas.setPointerCapture?.(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(pointer.down&&!isMobileDevice())Object.assign(pointer,coords(e))});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>canvas.addEventListener(ev,()=>{pointer.down=false;pointer.active=false}));
const joystick=$('mobileJoystick'),joystickKnob=$('joystickKnob');
function setJoystickFromPointer(e){if(!joystick||!joystickKnob)return;const base=joystick.querySelector('.joystick-base');if(!base)return;const r=base.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=Math.max(18,r.width*.34);let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max;}joystickVector.x=dx/max;joystickVector.y=dy/max;joystickVector.active=Math.hypot(joystickVector.x,joystickVector.y)>.13;joystickKnob.style.transform=`translate(${dx}px, ${dy}px)`;}
if(joystick){joystick.addEventListener('pointerdown',e=>{if(gameState!=='playing')return;e.preventDefault();joystickVector.pointerId=e.pointerId;joystick.setPointerCapture?.(e.pointerId);setJoystickFromPointer(e)});joystick.addEventListener('pointermove',e=>{if(joystickVector.pointerId===e.pointerId)setJoystickFromPointer(e)});const release=()=>{joystickVector={x:0,y:0,active:false,pointerId:null};if(joystickKnob)joystickKnob.style.transform='translate(0, 0)'};['pointerup','pointercancel','lostpointercapture'].forEach(ev=>joystick.addEventListener(ev,release));}
window.addEventListener('keydown',e=>{keys[e.key]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if((e.key==='q'||e.key==='Q')&&Number(metaUpgrades.pulse)>0)activateAbility('pulse');if((e.key==='e'||e.key==='E')&&Number(metaUpgrades.dash)>0)activateAbility('dash');if(e.key==='Escape'||e.key==='p'||e.key==='P'){if(gameState==='playing')pauseGame();else if(gameState==='paused')resumeGame()}});
window.addEventListener('keyup',e=>keys[e.key]=false);
$('playBtn').addEventListener('click',()=>{onlineMode=false;startGame()});$('againBtn').addEventListener('click',()=>{if(onlineMode){window.AbyssalOnline?.leaveWorld();onlineMode=false;}startGame()});$('menuBtn').addEventListener('click',()=>{gameState='menu';setMobileGameActive(false);$('gameOverScreen').hidden=true;$('menuScreen').hidden=false;$('pauseBtn').hidden=true});
$('pauseBtn').addEventListener('click',pauseGame);$('resumeBtn').addEventListener('click',resumeGame);$('quitBtn').addEventListener('click',()=>{if(onlineMode)window.AbyssalOnline?.leaveWorld();onlineMode=false;setMobileGameActive(false);gameState='menu';$('pauseScreen').hidden=true;$('hud').hidden=true;$('menuScreen').hidden=false;$('pauseBtn').hidden=true});
$('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'♫':'♪';$('soundBtn').style.color=soundOn?'':'#617783';if(soundOn){startAmbientMusic();audio(580,.08,'sine',.025)}else stopAmbientMusic()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&gameState==='playing'&&!onlineMode)pauseGame();if(!document.hidden)last=performance.now();});
window.addEventListener('resize',()=>{if(gameState==='playing'||(onlineMode&&gameState==='upgrade'))setMobileGameActive(true);else resize()});
window.addEventListener('abyssal-remote-shot',ev=>{const d=ev.detail;if(!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;
 const col=d.color||'#9bbcff',special=d.special||null;
 projectiles.push({x:d.x*W,y:d.y*H,vx:(d.vx||0)*W,vy:(d.vy||0)*H,r:(special==='pierce'?6.5:special==='electric'?5.8:5.2)/worldZoom,life:1.05,damage:0,color:col,special,allyShot:true,remoteVisual:true,trailLife:.16});
 burst(d.x*W,d.y*H,col,5,75);
 if(projectiles.length>projectileBudget())projectiles.splice(0,projectiles.length-projectileBudget());
});
window.AbyssalGameHooks={
 getPlayerPosition:()=>onlineMode&&player&&gameState!=='menu'&&gameState!=='over'?{x:player.x,y:player.y,angle:player.angle||0}:null,
 skinColor:()=>currentSkinColor(),
 viewportWidth:()=>viewW,
 viewportHeight:()=>viewH,
 worldWidth:()=>W,
 worldHeight:()=>H,
 worldZoom:()=>worldZoom,
 skinId:()=>equippedSkin,
 skinForId:id=>skinData.find(s=>s.id===id)||skinData[0],
 toast:message=>showToast(message),
 remoteHit:data=>{if(!player)return;const tx=data.x*W,ty=data.y*H;let nearest=null,bd=Infinity;for(const e of enemies){const d=Math.hypot(e.x-tx,e.y-ty);if(d<bd){bd=d;nearest=e}}if(nearest&&bd<100/worldZoom){effects.push({type:'beam',x1:tx,y1:ty,x2:nearest.x,y2:nearest.y,life:.14,maxLife:.14,color:'#bba8ff'});burst(nearest.x,nearest.y,'#bba8ff',5,60);}},
 applySnapshot:applySharedSnapshot,
  onlineMovementFallback:()=>onlineClientMovementFallback,
  motionDiagnostics:()=>({enemyCount:onlineVisualEnemyCount,movingEnemies:onlineVisualMovingEnemies,predictingLocally:false,stalledSnapshots:onlineMovementStalledSnapshots,confirmedSnapshots:onlineMovementConfirmedSnapshots,gameState}),
 restoreHostState:data=>{if(!data||!Array.isArray(data.enemies))return;enemies=data.enemies.map(e=>({...e,x:Number(e.x)||0,y:Number(e.y)||0,r:Math.max(2,Number(e.r)||12)/worldZoom}));},
 sharedDamage:applySharedDamage,
 sharedXp:applySharedXp,
};
function renderCreaturePreview(canvas,kind,color,skin=null){
 if(!canvas)return;const c=canvas.getContext('2d');if(!c)return;const w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);const bg=c.createRadialGradient(w*.5,h*.45,2,w*.5,h*.5,Math.max(w,h)*.65);bg.addColorStop(0,'#102d40');bg.addColorStop(1,'#030913');c.fillStyle=bg;c.fillRect(0,0,w,h);c.save();c.strokeStyle='rgba(130,232,239,.16)';c.lineWidth=1;c.beginPath();c.ellipse(w*.5,h*.64,w*.3,h*.16,0,0,Math.PI*2);c.stroke();c.restore();drawCreature(w*.5,h*.49,Math.min(w*.18,h*.29),-.2,color,kind,performance.now(),!!skin,0,c,skin);}
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
$('wheelBtn')?.addEventListener('click',()=>{$('wheelScreen').hidden=false;drawWheel();$('wheelMessage').textContent='Uma chance de recompensa a cada anúncio premiado. O prêmio é sorteado pelo servidor quando a integração estiver ativa.';});
$('wheelCloseBtn')?.addEventListener('click',()=>{$('wheelScreen').hidden=true});
$('spinWheelBtn')?.addEventListener('click',requestWheelSpin);
$('testWheelBtn')?.addEventListener('click',()=>{if(wheelBusy)return;animateWheelToPrize(weightedWheelPrize(),false);});
window.addEventListener('abyssal-wheel-result',ev=>{const d=ev.detail||{};if(d.ok){coins=Number(d.coins)||coins;saveCosmeticsLocalOnly();renderShop();animateWheelToPrize(Number(d.reward)||20,true);}else{wheelBusy=false;$('spinWheelBtn').disabled=false;$('testWheelBtn').disabled=false;$('wheelMessage').textContent=d.message||'Não foi possível girar agora.';}});
function applyWorldEnemyDamage(data){
 if(!onlineMode||!data||data.id==null)return;
 const enemy=enemies.find(e=>String(e.id)===String(data.id));
 if(!enemy)return;
 if(Number.isFinite(Number(data.hp)))enemy.hp=clamp(Number(data.hp),0,Number(enemy.maxHp)||Number(data.maxHp)||Infinity);
 if(Number.isFinite(Number(data.maxHp)))enemy.maxHp=Number(data.maxHp);
 if(Number.isFinite(Number(data.damageRevision)))enemy.damageRevision=Math.max(Number(enemy.damageRevision)||0,Number(data.damageRevision));
 enemy.hit=.16;
}
window.addEventListener('abyssal-player-vitals',ev=>applyOnlinePlayerVitals(ev.detail));
window.addEventListener('abyssal-world-damaged',ev=>applyWorldEnemyDamage(ev.detail));
window.addEventListener('abyssal-world-xp-orb-collected',ev=>{const d=ev.detail||{};orbs=orbs.filter(o=>String(o.id)!==String(d.orbId));const x=Number(d.x),y=Number(d.y);if(Number.isFinite(x)&&Number.isFinite(y)){burst(x,y,'#b8a7ff',9,70);audio(680,.06,'sine',.012);}});
window.addEventListener('abyssal-world-damage-result',ev=>{const d=ev.detail||{};if(d.ok){applyWorldEnemyDamage(d);return;}const now=performance.now();if(onlineMode&&now-lastDamageWarningAt>2200){lastDamageWarningAt=now;showToast(`IMPACTO NÃO CONFIRMADO · ${String(d.reason||'sem resposta').toUpperCase()}`);}});
window.addEventListener('abyssal-boss-warning',ev=>{const d=ev.detail||{};if(d.kind)showBossAlert(d.kind,d.id,d.threat);});
window.addEventListener('abyssal-world-defeated',ev=>{const e=ev.detail;if(!e)return;enemies=enemies.filter(enemy=>String(enemy.id)!==String(e.id));score+=Number(e.value||0)*10;const bosses=['boss','leviathan','maw','angler'].includes(e.kind);if(bosses){bossKillsThisRun++;score+=1400;updateHud();showToast('ENTIDADE ABISSAL ELIMINADA · +100 MOEDAS');}const x=Number(e.x)||W*.5,y=Number(e.y)||H*.5;burst(x,y,e.color||'#8ffff4',bosses?90:14,bosses?300:100);audio(bosses?180:260,.08,'triangle',.025);});
function renderShop(){
 $('coinBalance').textContent=coins.toLocaleString('pt-BR');const grid=$('skinGrid');if(!grid)return;grid.innerHTML='';
 skinData.forEach(skin=>{const owned=ownedSkins.includes(skin.id),equipped=equippedSkin===skin.id;const card=document.createElement('div');card.className='skin-card'+(equipped?' equipped':'');card.innerHTML=`<div class="skin-preview"><canvas class="skin-preview-canvas" width="160" height="92" aria-label="Prévia real da skin ${skin.name}"></canvas></div><strong>${skin.name}</strong><p>${skin.desc}</p><button ${skin.paid?'disabled':''}>${equipped?'EQUIPADA':owned?'EQUIPAR':skin.paid?'EM BREVE · PREMIUM':`COMPRAR · ${skin.price.toLocaleString('pt-BR')} ◈`}</button>`;renderCreaturePreview(card.querySelector('canvas'),'player',skin.color,skin);const btn=card.querySelector('button');if(!skin.paid&&!equipped)btn.addEventListener('click',()=>{if(owned){equippedSkin=skin.id;saveCosmetics();renderShop();showToast('SKIN EQUIPADA');}else if(window.AbyssalOnline?.isAuthenticated()){window.AbyssalOnline.purchaseSkin(skin.id)}else if(coins>=skin.price){coins-=skin.price;ownedSkins.push(skin.id);equippedSkin=skin.id;saveCosmetics();renderShop();showToast('SKIN DESBLOQUEADA');audio(760,.12,'triangle',.03)}else showToast('ESSÊNCIA INSUFICIENTE');});grid.appendChild(card)});
 const metaGrid=$('metaUpgradeGrid');if(metaGrid){metaGrid.innerHTML='';metaShopItems.forEach(item=>{const levelNow=Number(metaUpgrades[item.id])||0,ownedMax=levelNow>=item.max;const card=document.createElement('article');card.className='meta-card'+(ownedMax?' meta-max':'');card.innerHTML=`<div class="meta-card-icon">${item.icon}</div><div class="meta-card-copy"><div class="meta-kicker">${item.type==='active'?'HABILIDADE ATIVA':'MELHORIA PASSIVA'} · NV. ${levelNow}/${item.max}</div><strong>${item.name}</strong><p>${item.desc}</p></div><button ${ownedMax?'disabled':''}>${ownedMax?'DESBLOQUEADO':`ADQUIRIR · ${item.price.toLocaleString('pt-BR')} ◈`}</button>`;const button=card.querySelector('button');if(!ownedMax)button.addEventListener('click',()=>buyMetaUpgrade(item.id));metaGrid.appendChild(card);});}
 updateAbilityButtons();drawWheel();
}
$('shopBtn').addEventListener('click',()=>{$('shopScreen').hidden=false;renderShop()});
$('skillPulseBtn')?.addEventListener('click',()=>activateAbility('pulse'));$('skillDashBtn')?.addEventListener('click',()=>activateAbility('dash'));
const catalogBtn=$('catalogBtn');if(catalogBtn)catalogBtn.addEventListener('click',renderCatalog);const rankingsBtn=$('rankingsBtn');if(rankingsBtn)rankingsBtn.addEventListener('click',()=>{const el=$('rankingsScreen');if(el)el.hidden=false;if(window.AbyssalOnline?.loadRankings)window.AbyssalOnline.loadRankings()});const catalogClose=$('catalogCloseBtn');if(catalogClose)catalogClose.addEventListener('click',()=>{$('catalogScreen').hidden=true});const rankingsClose=$('rankingsCloseBtn');if(rankingsClose)rankingsClose.addEventListener('click',()=>{$('rankingsScreen').hidden=true});
function renderCatalog(){
 const el=$('catalogScreen'),grid=$('catalogGrid');if(!el||!grid)return;el.hidden=false;
 const codex=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');
 const monsterData={
  drifter:{name:'Errante Luminescente',color:'#ff769d',desc:'Ctenóforo de sino translúcido. Avança em linha direta e deixa cílios brilhantes ondularem na água escura. Aparece em grupos e testa sua atenção.'},
  stinger:{name:'Ferrão de Fenda',color:'#ffbc78',desc:'Peixe-ferrão veloz, corpo estreito, espinhos dorsais e mandíbula afiada. Tem pouca resistência, mas encurta a distância depressa quando vários cercam o mergulhador.'},
  brute:{name:'Bruto de Placas',color:'#bd88ff',desc:'Isópode abissal de carapaça mineral, placas sobrepostas e patas simétricas. É lento, resistente e pode bloquear as rotas de fuga.'},
  lurker:{name:'Predador Sombrio',color:'#6e8dff',desc:'Enguia gulper de mandíbula expansível e corpo alongado. Segue persistentemente o mergulhador e é mais difícil de eliminar que a fauna menor.'},
  boss:{name:'Aberração Abissal',color:'#ff315f',desc:'Uma entidade cefalópode coroada por osso, com máscara calcificada e braços curvados como ganchos. O brilho rubro denuncia uma criatura feita para caçar mergulhadores.'},
  leviathan:{name:'Leviatã das Fossas',color:'#4ce0d1',desc:'Serpente colossal de trincheira, com crânio pálido, costelas externas e nadadeiras em fileira. Seu corpo comprido domina as rotas de fuga.'},
  maw:{name:'A Boca do Abismo',color:'#c16cff',desc:'Predador radial cuja silhueta é uma mandíbula circular cercada por dentes. Não há olhos fáceis de localizar — apenas um anel de fome que avança contra a luz.'},
  angler:{name:'Lanterna Mortal',color:'#ffb45e',desc:'Peixe-pescador de mandíbula articulada, espinhos e isca bioluminescente. A luz atrai a presa para perto da boca, onde qualquer erro é punido.'}
 };
 const skillCopy={power:'Aumenta o dano de cada projétil.',rate:'Reduz o intervalo entre disparos automáticos.',speed:'Aumenta a velocidade de movimento.',range:'Amplia o alcance dos tiros e das ondas.',magnet:'Atrai fragmentos de experiência de mais longe no modo solo.',regen:'Recupera vitalidade gradualmente.',shield:'Adiciona cargas que absorvem impactos.',burst:'Libera periodicamente uma onda de energia ao redor do jogador.',electric:'Faz os tiros encadearem arcos elétricos em inimigos próximos.',pierce:'Permite atravessar uma criatura adicional por nível, sem multiplicar o dano.',ricochet:'Faz arcos de energia saltarem para alvos próximos.',nova:'Libera periodicamente uma explosão circular de grande alcance.'};
 const renderMonster=([k,m])=>{const known=codex.monsters.includes(k);return `<article class="codex-card monster-codex-card ${known?'unlocked':'locked'}"><div class="codex-preview monster-preview" style="--preview:${m.color}"><canvas width="180" height="112" data-monster-preview="${k}" aria-label="Prévia real de ${known?m.name:'uma criatura não identificada'}"></canvas></div><b>${known?m.name:'Forma não identificada'}</b><p>${known?m.desc:'Registro incompleto. Observe esta criatura durante uma expedição para decifrar sua identidade e comportamento.'}</p></article>`};
 const skillsHtml=upgradeList.map(u=>{const known=codex.skills.includes(u.id);return `<article class="codex-card ${known?'unlocked':'locked'}"><div class="codex-preview skill-preview" style="--preview:${known?'#9cecff':'#263747'}">${known?u.icon:'?'}</div><b>${known?u.name:'Ressonância desconhecida'}</b><p>${known?(skillCopy[u.id]||u.desc):'Descubra esta habilidade durante um mergulho para revelar seus efeitos.'}</p></article>`}).join('');
 const entries=Object.entries(monsterData),common=entries.filter(([k])=>!['boss','leviathan','maw','angler'].includes(k)),bosses=entries.filter(([k])=>['boss','leviathan','maw','angler'].includes(k));
 grid.innerHTML='<h3 class="codex-heading">✦ HABILIDADES DESCOBERTAS</h3><div class="codex-grid">'+skillsHtml+'</div><h3 class="codex-heading">◈ FAUNA DAS CAMADAS EXTERNAS</h3><div class="codex-grid">'+common.map(renderMonster).join('')+'</div><h3 class="codex-heading">☠ ENTIDADES COLOSSAIS · FOSSAS ABISSAIS</h3><div class="codex-grid">'+bosses.map(renderMonster).join('')+'</div>';
 grid.querySelectorAll('canvas[data-monster-preview]').forEach(canvas=>{const kind=canvas.dataset.monsterPreview,m=monsterData[kind];renderCreaturePreview(canvas,kind,m.color,null);});
}

$('shopCloseBtn').addEventListener('click',()=>{$('shopScreen').hidden=true});
$('loginBtn').addEventListener('click',()=>{if(window.AbyssalOnline)window.AbyssalOnline.openLogin()});
$('onlineBtn').addEventListener('click',()=>{startAmbientMusic();onlineMode=true;if(window.AbyssalOnline?.isAuthenticated())window.AbyssalOnline.showRooms();else window.AbyssalOnline?.connectAndJoin()});
window.addEventListener('abyssal-authenticated',()=>{if(window.AbyssalOnlinePendingStart){window.AbyssalOnlinePendingStart=false;$('loginScreen').hidden=true;onlineMode=true;window.AbyssalOnline?.showRooms()}});
window.addEventListener('abyssal-boss-warning',ev=>{const d=ev.detail||{};showBossAlert(d.kind,d.id,d.threat);});
window.addEventListener('abyssal-room-joined',ev=>{onlineMode=true;$('roomsScreen').hidden=true;$('menuScreen').hidden=true;startGame();const d=ev.detail||{};if(d.snapshot)window.AbyssalGameHooks?.applySnapshot(d.snapshot);const badge=$('roomBadge');if(badge){badge.textContent=`⌁ ${d.room?.id||''} · TOQUE PARA COPIAR`;badge.dataset.roomCode=d.room?.id||'';badge.hidden=false;}showToast(`MERGULHAR ONLINE · ${d.room?.name||'SALA ABISSAL'}`)});
window.addEventListener('abyssal-room-created',ev=>{const d=ev.detail||{};const m=$('roomsMessage');if(m)m.textContent=d.ok?`Sala criada! Código para convidar amigos: ${d.room?.id||''}. Você será conectado agora.`:(d.message||'Não foi possível criar a sala.');});
window.addEventListener('abyssal-room-left',()=>{const badge=$('roomBadge');if(badge)badge.hidden=true;setMobileGameActive(false)});
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
window.addEventListener('abyssal-purchase-result',e=>{const r=e.detail||{};showToast(r.message||'Compra processada');if(r.ok&&r.itemId)playSkillSound(r.itemId,'learn');else if(r.ok)audio(760,.15,'triangle',.035);});
function saveCosmeticsLocalOnly(){localStorage.setItem('abyssalCoins',String(coins));localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));localStorage.setItem('abyssalMetaUpgrades',JSON.stringify(metaUpgrades));}
renderShop();resize();gameState='menu';requestAnimationFrame(loop);

const endDiveButton=document.createElement('button');endDiveButton.id='endDiveBtn';endDiveButton.type='button';endDiveButton.textContent='ENCERRAR MERGULHO';endDiveButton.style.cssText='position:absolute;right:18px;top:72px;z-index:8;border:1px solid rgba(255,130,160,.55);border-radius:8px;padding:8px 10px;background:rgba(30,10,25,.78);color:#ffd6e0;font:600 10px Manrope,system-ui;letter-spacing:.08em;cursor:pointer;display:none';document.getElementById('gameShell').appendChild(endDiveButton);
endDiveButton.addEventListener('click',()=>{
 const wasOnline=onlineMode,authenticated=Boolean(window.AbyssalOnline?.isAuthenticated?.());
 const returnToMenu=(result)=>{onlineMode=false;setMobileGameActive(false);gameState='menu';$('hud').hidden=true;$('pauseBtn').hidden=true;$('upgradeScreen').hidden=true;$('pauseScreen').hidden=true;$('gameOverScreen').hidden=true;$('menuScreen').hidden=false;endDiveButton.style.display='none';const earned=Number(result?.earned)||0;const kills=Number(result?.bossesKilled??bossKillsThisRun)||0;const total=Number(result?.totalRunCoins??(earned+(Number(result?.bossCoins)||0)))||0;showToast(`MERGULHO ENCERRADO · ${kills} BOSS(ES) · +${total} MOEDAS NA EXPEDIÇÃO`);};
 if(authenticated&&window.AbyssalOnline?.finishRun){const sent=window.AbyssalOnline.finishRun({survival:elapsed,score,level,bossesKilled:bossKillsThisRun},{leaveAfter:wasOnline,onComplete:result=>returnToMenu(result)});if(sent){endDiveButton.disabled=true;endDiveButton.textContent='REGISTRANDO…';setTimeout(()=>{endDiveButton.disabled=false;endDiveButton.textContent='ENCERRAR MERGULHO'},12000);return;}}
 if(!authenticated){coins+=Math.max(5,Math.floor(score/35)+level*2);saveCosmetics();renderShop();if(wasOnline)window.AbyssalOnline?.leaveWorld();returnToMenu({earned:Math.max(5,Math.floor(score/35)+level*2),bossesKilled:bossKillsThisRun});}else returnToMenu({earned:0,bossesKilled:bossKillsThisRun});
});

})();