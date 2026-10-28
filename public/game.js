(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const $ = id => document.getElementById(id);
const screens = ['menuScreen','upgradeScreen','pauseScreen','gameOverScreen'];
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const wrapGameCoordinate=(v,size)=>((v%size)+size)%size;
const rand = (a,b)=>a+Math.random()*(b-a);
const wrappedDelta=(a,b,size)=>{let d=a-b;if(d>size/2)d-=size;else if(d< -size/2)d+=size;return d};
const dist = (a,b)=>Math.hypot(wrappedDelta(a.x,b.x,W),wrappedDelta(a.y,b.y,H));
const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
let W=800,H=500,dpr=1,last=0,elapsed=0,score=0,level=1,xp=0,xpNeed=10,hp=100,maxHp=100,gameState='menu',soundOn=true,nextBossAt=60,lastBossMaxHp=0;
let player=null,botBuddy=null,enemies=[],orbs=[],particles=[],projectiles=[],effects=[],decor=[],upgrades={},upgradeLevels={},chosen=[],spawnTimer=0,enemyId=0,shake=0,damageFlash=0,runSeed=0,bossIndex=0;
let bestScore=Number(localStorage.getItem('abyssalBestScore')||0),bestTime=Number(localStorage.getItem('abyssalBestTime')||0);
let snapshotClock=0,upgradeAutoTimer=null,upgradeOptions=[],sharedXpApplying=false,lastBossKind=null,lastRemoteBossId=null,metaUpgrades=JSON.parse(localStorage.getItem('abyssalMetaUpgrades')||'{}'),wheelBusy=false,wheelAngle=0;
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
let pointer={x:0,y:0,down:false,active:false},keys={};
let audioCtx=null,lastShot=0,lastHit=0,toastTimer=null,ambientNodes=null;
$('bestTime').textContent=fmtTime(bestTime);$('bestScore').textContent=bestScore.toLocaleString('pt-BR');

function resize(){
 const r=$('gameShell').getBoundingClientRect(); dpr=Math.min(window.devicePixelRatio||1,2);W=Math.max(320,r.width);H=Math.max(320,r.height);
 canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 if(player){player.x=clamp(player.x,24,W-24);player.y=clamp(player.y,24,H-24)}
 createDecor();
}
function createDecor(){
 decor=[];for(let i=0;i<100;i++)decor.push({x:Math.random()*W,y:Math.random()*H,r:rand(.5,2.2),a:rand(.08,.5),speed:rand(4,22),phase:rand(0,Math.PI*2)});
}
function startAmbientMusic(){if(!soundOn||ambientNodes)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const master=audioCtx.createGain();master.gain.value=.045;master.connect(audioCtx.destination);const low=audioCtx.createOscillator(),high=audioCtx.createOscillator(),lfo=audioCtx.createOscillator(),lfoGain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();low.type='sine';low.frequency.value=43;high.type='triangle';high.frequency.value=67;filter.type='lowpass';filter.frequency.value=260;lfo.type='sine';lfo.frequency.value=.08;lfoGain.gain.value=65;lfo.connect(lfoGain);lfoGain.connect(filter.frequency);low.connect(filter);high.connect(filter);filter.connect(master);low.start();high.start();lfo.start();ambientNodes={master,low,high,lfo,filter};}catch(e){console.warn('Áudio ambiente indisponível',e)}}
function stopAmbientMusic(){if(!ambientNodes)return;try{ambientNodes.master.gain.setTargetAtTime(0,audioCtx.currentTime,.25);setTimeout(()=>{try{ambientNodes.low.stop();ambientNodes.high.stop();ambientNodes.lfo.stop()}catch(e){}ambientNodes=null},800)}catch(e){ambientNodes=null}}
function audio(f=440,d=.07,type='sine',vol=.025){
 if(!soundOn)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(f,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,f*.55),audioCtx.currentTime+d);g.gain.setValueAtTime(vol,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d)}catch(e){}
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
function showScreen(id){screens.forEach(s=>$(s).hidden=s!==id);$('hud').hidden=id!=='gameScreen';}
function startGame(){
 startAmbientMusic();
 elapsed=0;score=0;level=1;xp=0;xpNeed=10;maxHp=100+Math.max(0,Number(metaUpgrades.bulkhead)||0)*8;hp=maxHp;spawnTimer=0;enemyId=0;shake=0;damageFlash=0;chosen=[];nextBossAt=60;bossIndex=0;lastBossKind=null;lastBossMaxHp=0;lastRemoteBossId=null;
 upgrades={power:Math.pow(1.08,Math.max(0,Number(metaUpgrades.focuser)||0)),rate:1,range:1,speed:1+Math.max(0,Number(metaUpgrades.current)||0)*.05,magnet:1,regen:0,shield:Math.max(0,Number(metaUpgrades.startShield)||0),burst:0,electric:0,pierce:0,ricochet:0,nova:0};
 upgradeLevels={power:0,rate:0,range:0,speed:0,magnet:0,regen:0,shield:0,burst:0,electric:0,pierce:0,ricochet:0,nova:0};
 enemies=[];orbs=[];particles=[];projectiles=[];effects=[];
 player={x:W*.5,y:H*.54,r:13,angle:0,moveSpeed:150,fireTimer:0,invuln:0,shieldTime:0,trail:[],pulseCooldown:0,dashCooldown:0,dashTime:0};
 gameState='playing';screens.forEach(s=>$(s).hidden=true);$('hud').hidden=false;const endBtn=document.getElementById('endDiveBtn');if(endBtn)endBtn.style.display=onlineMode?'block':'none';$('pauseBtn').hidden=false;botBuddyTimer=0;botBuddy=null;
 updateHud();last=performance.now();audio(520,.12,'sine',.04);if(onlineMode)window.AbyssalOnline?.joinWorld();if(!onlineMode)for(let i=0;i<3;i++)spawnEnemy(true);snapshotClock=0;
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
 u.apply();if(player)player.invuln=2;upgradeLevels[u.id]=(upgradeLevels[u.id]||0)+1;
 const codex=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');if(!codex.skills.includes(u.id))codex.skills.push(u.id);localStorage.setItem('abyssalCodex',JSON.stringify(codex));
 level++;gameState='playing';$('upgradeScreen').hidden=true;showToast(`${u.name.toUpperCase()} · NÍVEL ${upgradeLevels[u.id]}/3`);audio(660+upgradeLevels[u.id]*100,.18,'triangle',.04);updateHud();last=performance.now();if(onlineMode&&xp>=xpNeed){xp-=xpNeed;xpNeed=Math.floor(xpNeed*1.34+3);setTimeout(()=>{if(gameState==='playing')offerUpgrade()},0)}
}
function offerUpgrade(){
 if(gameState==='upgrade')return;
 gameState='upgrade';chosen=[];upgradeOptions=upgradeList.filter(u=>(upgradeLevels[u.id]||0)<3).sort(()=>Math.random()-.5).slice(0,3);const wrap=$('upgradeChoices');wrap.innerHTML='';
 if(!upgradeOptions.length){gameState='playing';$('upgradeScreen').hidden=true;return}
 // Em coop, a escolha não congela o mundo e concede até 10 s de invulnerabilidade.
 if(player)player.invuln=Math.max(player.invuln,10);
 upgradeOptions.forEach(u=>{const current=upgradeLevels[u.id]||0;const b=document.createElement('button');b.className='upgrade-card';b.innerHTML=`<span class="upgrade-icon">${u.icon}</span><strong>${u.name} · Nv. ${current+1}/3</strong><p>${u.desc}</p><small class="upgrade-progress">${'◆'.repeat(current)}${'◇'.repeat(3-current)} · ${current===0?'Desbloqueio':`Melhoria ${current} → ${current+1}`}</small>`;b.addEventListener('click',()=>chooseUpgrade(u));wrap.appendChild(b)});
 $('upgradeScreen').hidden=false;audio(330,.16,'sine',.03);
 upgradeAutoTimer=setTimeout(()=>{if(gameState==='upgrade'&&upgradeOptions.length){const available=upgradeOptions.filter(u=>(upgradeLevels[u.id]||0)<3);if(available.length)chooseUpgrade(available[Math.floor(Math.random()*available.length)]);else{gameState='playing';$('upgradeScreen').hidden=true}}},10000);
}
function spawnEnemy(initial=false){
 if(!player)return;const bossTypes=['boss','leviathan','maw','angler'];if(!initial&&enemies.some(e=>bossTypes.includes(e.kind)))return null;let side=Math.floor(Math.random()*4),x,y,pad=30;
 if(side===0){x=rand(0,W);y=-pad}else if(side===1){x=W+pad;y=rand(0,H)}else if(side===2){x=rand(0,W);y=H+pad}else{x=-pad;y=rand(0,H)}
 const bosses=['boss','leviathan','maw','angler'];
 const bossAlive=enemies.some(e=>bosses.includes(e.kind));
 const bossDue=!initial&&elapsed>=nextBossAt&&!bossAlive;
 if(bossDue)nextBossAt=elapsed+60;
 const t=Math.random();
 let kind;if(bossDue){const choices=bosses.filter(k=>k!==lastBossKind);kind=choices[Math.floor(Math.random()*choices.length)];lastBossKind=kind;}else kind=t<.56?'drifter':t<.78?'stinger':t<.94?'brute':'lurker';
 const bossData={boss:{r:40,hp:2820,speed:22,damage:25,color:'#ff315f',value:55},leviathan:{r:54,hp:4700,speed:16,damage:34,color:'#4ce0d1',value:90},maw:{r:45,hp:3750,speed:25,damage:31,color:'#c16cff',value:75},angler:{r:35,hp:3260,speed:30,damage:28,color:'#ffb45e',value:65}};
 const data=bossData[kind]|| (kind==='drifter'?{r:10,hp:22,speed:51,damage:8,color:'#ff769d',value:1}
 :kind==='stinger'?{r:7,hp:13,speed:88,damage:6,color:'#ffbc78',value:2}
 :kind==='brute'?{r:16,hp:65,speed:30,damage:15,color:'#bd88ff',value:4}
 :{r:20,hp:100,speed:43,damage:18,color:'#6e8dff',value:6});
 if(bossDue){data.hp=lastBossMaxHp>0?lastBossMaxHp*1.5:data.hp;lastBossMaxHp=data.hp;bossIndex++;}
 enemies.push({id:++enemyId,x,y,...data,maxHp:data.hp,angle:rand(0,6.28),phase:rand(0,6.28),hit:0,attackCd:rand(.3,1),kind});
 const seen=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');if(!seen.monsters.includes(kind)){seen.monsters.push(kind);localStorage.setItem('abyssalCodex',JSON.stringify(seen));}
 if(bosses.includes(kind)){const names={boss:'⚠ O CORAÇÃO PARTIDO DESPERTOU',leviathan:'⚠ O LEVIATÃ DAS FOSSAS DESPERTOU',maw:'⚠ A BOCA DO ABISMO SE ABRIU',angler:'⚠ A LANTERNA MORTAL SE APROXIMA'};showToast(names[kind]);burst(x,y,data.color,110,300);playBossCry(kind);}
 if(enemies.length>95)enemies.splice(0,10);
}
function burst(x,y,color,n=10,force=100){
 for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,s=rand(force*.25,force),life=rand(.22,.7);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,max:life,r:rand(1,3.5),color})}
}
function addOrb(x,y,value){orbs.push({x,y,r:4+Math.min(3,value),value,phase:rand(0,6.28),life:25})}
function hurtPlayer(dmg){
 if(player.invuln>0)return;if(upgrades.shield>0){upgrades.shield--;player.invuln=.7;burst(player.x,player.y,'#7ceff2',18,130);audio(240,.14,'triangle',.04);showToast('ESCUDO ABSORVEU O IMPACTO');return}
 hp-=dmg;player.invuln=.8;shake=8;damageFlash=.25;burst(player.x,player.y,'#ff668d',14,120);audio(120,.16,'sawtooth',.03);if(hp<=0)endGame();
}
function onlineHost(){return !onlineMode;} // O mundo online é simulado pelo servidor, nunca por um jogador.
function gainXp(value, source='shared'){
 if(!Number.isFinite(value)||value<=0||!player)return;
 xp+=value; score+=Math.round(value*3);
 if(xp>=xpNeed && gameState!=='upgrade'){
   xp-=xpNeed; xpNeed=Math.floor(xpNeed*1.34+3); offerUpgrade();
 }
 updateHud();
}
function dealEnemyDamage(enemy, damage){
 if(!enemy||!Number.isFinite(damage)||damage<=0)return;
 if(onlineMode){
   window.AbyssalOnline?.sendDamage(enemy.id, damage);
   enemy.hit=.14;
   burst(enemy.x,enemy.y,'#c4b4ff',5,60);
   return;
 }
 enemy.hp-=damage; enemy.hit=.14;
 if(enemy.hp<=0){const idx=enemies.indexOf(enemy);if(idx>=0)killEnemy(idx);}
}
function applySharedSnapshot(data){
 if(!onlineMode||!data||!Array.isArray(data.enemies))return;
 elapsed=Number(data.elapsed)||elapsed;
 const previousBossIds=new Set(enemies.filter(e=>['boss','leviathan','maw','angler'].includes(e.kind)).map(e=>e.id));
 enemies=data.enemies.map(e=>({...e,x:(Number(e.x)||0)*W,y:(Number(e.y)||0)*H,r:(Number(e.r)||.015)*Math.min(W,H)}));
 const codex=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');let codexChanged=false;for(const e of enemies){if(!codex.monsters.includes(e.kind)){codex.monsters.push(e.kind);codexChanged=true;}}if(codexChanged)localStorage.setItem('abyssalCodex',JSON.stringify(codex));
 const newBoss=enemies.find(e=>['boss','leviathan','maw','angler'].includes(e.kind)&&!previousBossIds.has(e.id));
 if(newBoss){lastRemoteBossId=newBoss.id;const names={boss:'⚠ O CORAÇÃO PARTIDO DESPERTOU',leviathan:'⚠ O LEVIATÃ DAS FOSSAS DESPERTOU',maw:'⚠ A BOCA DO ABISMO SE ABRIU',angler:'⚠ A LANTERNA MORTAL SE APROXIMA'};showToast(names[newBoss.kind]||'⚠ UMA PRESENÇA COLOSSAL SE APROXIMA');playBossCry(newBoss.kind);burst(newBoss.x,newBoss.y,newBoss.color,90,270);}
}
function applySharedDamage(data){ /* Dano é resolvido diretamente no servidor; mantido apenas por compatibilidade. */ }
function applySharedXp(data){
 if(!onlineMode||!data||!player)return;
 gainXp(Math.max(0,Number(data.value)||0),'shared');
}
function sendWorldSnapshot(dt){ /* O snapshot pertence ao servidor, não aos clientes. */ }
function killEnemy(i){
 const e=enemies[i];
 const codex=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');if(!codex.monsters.includes(e.kind))codex.monsters.push(e.kind);localStorage.setItem('abyssalCodex',JSON.stringify(codex));score+=e.value*10;if(onlineMode){if(onlineHost())window.AbyssalOnline?.shareXp(e.value,'kill');}else addOrb(e.x,e.y,e.value);burst(e.x,e.y,e.color,['boss','leviathan','maw','angler'].includes(e.kind)?100:e.kind==='brute'?22:12,['boss','leviathan','maw','angler'].includes(e.kind)?340:e.kind==='brute'?145:95);if(['boss','leviathan','maw','angler'].includes(e.kind)){score+=1400;coins+=100;nextBossAt=elapsed+60;showToast('BOSS ABISSAL DERROTADO · +100 MOEDAS');saveCosmetics();}enemies.splice(i,1);audio(e.kind==='brute'?160:260,.055,'triangle',.012);
}
function fire(){
 if(!player)return;let target=null,bd=Infinity;const maxRange=210*upgrades.range;
 for(const e of enemies){const d=dist(player,e);if(d<maxRange&&d<bd){target=e;bd=d}}
 if(!target)return;
 const a=Math.atan2(target.y-player.y,target.x-player.x);
 projectiles.push({x:player.x+Math.cos(a)*13,y:player.y+Math.sin(a)*13,vx:Math.cos(a)*430,vy:Math.sin(a)*430,r:4.1,life:.95,damage:12*upgrades.power,pierceRemaining:upgrades.pierce||0,hitIds:[],color:upgrades.ricochet>0?'#ffc47a':upgrades.electric>0?'#eaffff':upgrades.pierce>0?'#ffe7a1':'#83fff3',special:upgrades.pierce>0?'pierce':upgrades.electric>0?'electric':upgrades.ricochet>0?'ricochet':null});
 if(onlineMode&&window.AbyssalOnline?.sendShot)window.AbyssalOnline.sendShot({x:(player.x+Math.cos(a)*13)/W,y:(player.y+Math.sin(a)*13)/H,vx:Math.cos(a)*430/W,vy:Math.sin(a)*430/H,damage:12*upgrades.power,color:upgrades.ricochet>0?'#ffc47a':upgrades.electric>0?'#eaffff':upgrades.pierce>0?'#ffe7a1':'#83fff3',special:upgrades.pierce>0?'pierce':upgrades.electric>0?'electric':upgrades.ricochet>0?'ricochet':null});
 player.angle=a;const muzzleX=player.x+Math.cos(a)*15,muzzleY=player.y+Math.sin(a)*15;burst(muzzleX,muzzleY,upgrades.ricochet>0?'#ffc47a':upgrades.electric>0?'#eaffff':upgrades.pierce>0?'#ffe7a1':'#9afff7',upgrades.ricochet>0||upgrades.electric>0?9:5,upgrades.ricochet>0||upgrades.electric>0?90:45);if(upgrades.electric>0)effects.push({type:'beam',x1:player.x,y1:player.y,x2:muzzleX+Math.cos(a)*30,y2:muzzleY+Math.sin(a)*30,life:.16,maxLife:.16,color:'#eaffff'});audio(500,.045,'sine',.008);
}
function update(dt){
 if((gameState!=='playing'&&!(onlineMode&&gameState==='upgrade'))||!player)return;
 // Movimento local responsivo: teclado e toque/arraste. No online, trocar de aba nunca pausa o estado local intencionalmente.
 if(gameState==='playing'){
   player.pulseCooldown=Math.max(0,(player.pulseCooldown||0)-dt);player.dashCooldown=Math.max(0,(player.dashCooldown||0)-dt);player.dashTime=Math.max(0,(player.dashTime||0)-dt);updateAbilityButtons();
   let mx=(keys['d']||keys['D']||keys['ArrowRight']?1:0)-(keys['a']||keys['A']||keys['ArrowLeft']?1:0);
   let my=(keys['s']||keys['S']||keys['ArrowDown']?1:0)-(keys['w']||keys['W']||keys['ArrowUp']?1:0);
   if(pointer.down){const dx=pointer.x-player.x,dy=pointer.y-player.y,dd=Math.hypot(dx,dy);if(dd>12){mx=dx/dd;my=dy/dd}else{mx=0;my=0}}
   const mag=Math.hypot(mx,my)||1; if(mx||my){const dashMultiplier=player.dashTime>0?2.05:1;player.x=(player.x+mx/mag*player.moveSpeed*upgrades.speed*dashMultiplier*dt+W)%W;player.y=(player.y+my/mag*player.moveSpeed*upgrades.speed*dashMultiplier*dt+H)%H;player.angle=Math.atan2(my,mx);player.trail.push({x:player.x,y:player.y,life:.28});if(player.trail.length>12)player.trail.shift()}
   player.fireTimer=(player.fireTimer||0)-dt;if(player.fireTimer<=0){fire();player.fireTimer=Math.max(.12,.52/(upgrades.rate||1))}
 }
 if(!onlineMode){elapsed+=dt;spawnTimer-=dt;}player.invuln=Math.max(0,player.invuln-dt);damageFlash=Math.max(0,damageFlash-dt);shake=Math.max(0,shake-dt*22);
 if(!onlineMode&&spawnTimer<=0){spawnEnemy();spawnTimer=Math.max(.22,1.05-elapsed*.0045)}
 if(upgrades.regen>0&&Math.random()<dt*upgrades.regen*.25)hp=Math.min(maxHp,hp+1);
 if(upgrades.burst>0){player.burstTimer=(player.burstTimer||0)-dt;if(player.burstTimer<=0){player.burstTimer=Math.max(3.5,7/upgrades.burst);for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<210*upgrades.range){dealEnemyDamage(e,12*upgrades.burst);burst(e.x,e.y,'#b4a1ff',8,100)}}burst(player.x,player.y,'#b3a0ff',60,260);effects.push({type:'ring',x:player.x,y:player.y,r:0,max:210*upgrades.range,life:.55,maxLife:.55,color:'#b3a0ff'});audio(180,.2,'triangle',.05)}}
 if(upgrades.nova>0){player.novaTimer=(player.novaTimer||0)-dt;if(player.novaTimer<=0){player.novaTimer=Math.max(4.5,9/upgrades.nova);for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<210*upgrades.range){dealEnemyDamage(e,18*upgrades.nova);burst(e.x,e.y,'#72f5ff',12,130)}}burst(player.x,player.y,'#72f5ff',85,300);effects.push({type:'ring',x:player.x,y:player.y,r:0,max:210*upgrades.range,life:.75,maxLife:.75,color:'#72f5ff'});audio(120,.38,'sawtooth',.045)}}
 // Aliado IA: atua como um segundo jogador, deslocando-se por conta própria e disparando projéteis visíveis.
 const humanPeers=onlineMode&&window.AbyssalOnline?window.AbyssalOnline.getPlayers():[];
 for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];e.hit=Math.max(0,e.hit-dt);let targets=[{x:player.x,y:player.y,local:true}];if(onlineMode&&window.AbyssalOnline){for(const peer of window.AbyssalOnline.getPlayers()){targets.push({x:(Number(peer.x)||0)*W,y:(Number(peer.y)||0)*H,local:false,id:peer.id})}}let target=targets[0],td=Infinity;for(const candidate of targets){const dd=Math.hypot(wrappedDelta(e.x,candidate.x,W),wrappedDelta(e.y,candidate.y,H));if(dd<td){td=dd;target=candidate}}const dx=wrappedDelta(e.x,target.x,W)*-1,dy=wrappedDelta(e.y,target.y,H)*-1,d=Math.hypot(dx,dy)||1;if(!onlineMode){e.phase+=dt*(e.kind==='stinger'?7:3);e.angle=Math.atan2(dy,dx);e.x=(e.x+dx/d*e.speed*dt+W)%W;e.y=(e.y+dy/d*e.speed*dt+H)%H;}if(target.local&&td<e.r+player.r){e.attackCd-=dt;if(player.invuln<=0){hurtPlayer(e.damage);e.attackCd=e.kind==='stinger'?.8:1.1;if(!onlineMode){e.x=(e.x-dx/d*10+W)%W;e.y=(e.y-dy/d*10+H)%H;}}}}
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;let hit=false;for(let j=enemies.length-1;j>=0;j--){const e=enemies[j];p.hitIds ||= [];if(!p.hitIds.includes(e.id)&&Math.hypot(p.x-e.x,p.y-e.y)<p.r+e.r){p.hitIds.push(e.id);dealEnemyDamage(e,p.damage);e.hit=.12;burst(p.x,p.y,p.color,4,40);
 if((upgrades.electric||0)>0){let chains=0,from=e;const visited=new Set([e.id]);while(chains<Math.min(3,upgrades.electric)){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(!visited.has(other.id)&&d<120&&d<nd){next=other;nd=d}}if(!next)break;effects.push({type:'beam',x1:from.x,y1:from.y,x2:next.x,y2:next.y,life:.24,maxLife:.24,color:'#79f3ff'});burst(from.x,from.y,'#e6ffff',4,70);burst(next.x,next.y,'#79f3ff',12,120);dealEnemyDamage(next,p.damage*(.28+upgrades.electric*.08));next.hit=.12;burst(next.x,next.y,'#79f3ff',10,95);visited.add(next.id);from=next;chains++;}}
 if((upgrades.ricochet||0)>0){let from=e;const visited=new Set([e.id]);for(let bounce=0;bounce<Math.min(2,upgrades.ricochet);bounce++){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(!visited.has(other.id)&&d<190&&d<nd){next=other;nd=d}}if(!next)break;effects.push({type:'beam',x1:from.x,y1:from.y,x2:next.x,y2:next.y,life:.28,maxLife:.28,color:'#ffc47a'});burst(from.x,from.y,'#fff0c7',4,65);burst(next.x,next.y,'#ffc47a',14,135);dealEnemyDamage(next,p.damage*.42);next.hit=.15;burst(next.x,next.y,'#ffc47a',14,125);visited.add(next.id);from=next;}}
 if((p.pierceRemaining||0)>0){p.pierceRemaining--; }else{hit=true;break}}}p.x=(p.x+W)%W;p.y=(p.y+H)%H;if(hit||p.life<=0)projectiles.splice(i,1)}
 for(let i=orbs.length-1;i>=0;i--){if(onlineMode)break;const o=orbs[i];o.phase+=dt*3;o.life-=dt;const d=Math.hypot(player.x-o.x,player.y-o.y);if(d<100*upgrades.magnet){const f=clamp((100*upgrades.magnet-d)/100,0,1);o.x+=(player.x-o.x)*dt*(2+f*8);o.y+=(player.y-o.y)*dt*(2+f*8)}if(d<player.r+o.r+4){xp+=o.value;score+=o.value*3;burst(o.x,o.y,'#9f91ff',5,55);orbs.splice(i,1);audio(700+Math.random()*180,.06,'sine',.012);if(xp>=xpNeed){xp-=xpNeed;xpNeed=Math.floor(xpNeed*1.34+3);offerUpgrade();break}}else if(o.life<=0)orbs.splice(i,1)}
 for(let i=effects.length-1;i>=0;i--){effects[i].life-=dt;if(effects[i].life<=0)effects.splice(i,1)}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.05,dt);p.vy*=Math.pow(.05,dt);p.life-=dt;if(p.life<=0)particles.splice(i,1)}
 if(onlineMode&&window.AbyssalOnline){window.AbyssalOnline.sendPosition({x:player.x/W,y:player.y/H,angle:player.angle});sendWorldSnapshot(dt);}
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
 coins-=item.price;metaUpgrades[id]=current+1;saveCosmetics();renderShop();showToast(`${item.name.toUpperCase()} DESBLOQUEADO`);audio(650,.13,'triangle',.025);
}
function activateAbility(id){
 if(!player||gameState!=='playing')return;
 if(id==='pulse'){
  if(!(Number(metaUpgrades.pulse)>0)){showToast('DESBLOQUEIE PULSO DE MARÉ NA LOJA');return;}
  if(player.pulseCooldown>0)return;
  player.pulseCooldown=14;const radius=245*upgrades.range;
  for(const e of [...enemies])if(dist(player,e)<radius){dealEnemyDamage(e,28*upgrades.power);burst(e.x,e.y,'#78f8f3',10,120);}
  effects.push({type:'ring',x:player.x,y:player.y,r:0,max:radius,life:.7,maxLife:.7,color:'#78f8f3'});burst(player.x,player.y,'#9ffff8',60,260);audio(180,.3,'triangle',.055);showToast('PULSO DE MARÉ · LIBERADO');
 }else if(id==='dash'){
  if(!(Number(metaUpgrades.dash)>0)){showToast('DESBLOQUEIE PASSO FANTASMA NA LOJA');return;}
  if(player.dashCooldown>0)return;
  player.dashCooldown=18;player.dashTime=1.25;player.invuln=Math.max(player.invuln,1.25);player.x=wrapGameCoordinate(player.x+Math.cos(player.angle||0)*92,W);player.y=wrapGameCoordinate(player.y+Math.sin(player.angle||0)*92,H);burst(player.x,player.y,'#d8c9ff',24,150);audio(300,.16,'sawtooth',.035);showToast('PASSO FANTASMA · INVULNERÁVEL');
 }
 updateAbilityButtons();
}
function updateAbilityButtons(){
 const pulse=$('skillPulseBtn'),dash=$('skillDashBtn');
 if(pulse){pulse.hidden=!(Number(metaUpgrades.pulse)>0);pulse.disabled=!player||player.pulseCooldown>0;pulse.textContent=player&&player.pulseCooldown>0?`PULSO ${player.pulseCooldown.toFixed(1)}s`:'Q · PULSO DE MARÉ';}
 if(dash){dash.hidden=!(Number(metaUpgrades.dash)>0);dash.disabled=!player||player.dashCooldown>0;dash.textContent=player&&player.dashCooldown>0?`PASSO ${player.dashCooldown.toFixed(1)}s`:'E · PASSO FANTASMA';}
}
function updateHud(){
 $('timeText').textContent=fmtTime(elapsed);$('levelText').textContent=String(level).padStart(2,'0');$('scoreText').textContent=score.toLocaleString('pt-BR');$('hpText').textContent=`${Math.ceil(Math.max(0,hp))} / ${maxHp}`;$('hpFill').style.width=`${clamp(hp/maxHp*100,0,100)}%`;$('xpText').textContent=`${Math.floor(xp)} / ${xpNeed}`;$('xpFill').style.width=`${clamp(xp/xpNeed*100,0,100)}%`;
}
function endGame(){
 if(window.AbyssalOnline?.submitRun)window.AbyssalOnline.submitRun({survival:elapsed,score,level});
 coins+=Math.max(5,Math.floor(score/35)+level*2);saveCosmetics();renderShop();
 if(onlineMode)window.AbyssalOnline?.leaveWorld();
 const endBtn=document.getElementById('endDiveBtn');if(endBtn)endBtn.style.display='none';
 gameState='over';$('hud').hidden=true;$('pauseBtn').hidden=true;$('gameOverScreen').hidden=false;
 $('finalTime').textContent=fmtTime(elapsed);$('finalScore').textContent=score.toLocaleString('pt-BR');$('finalLevel').textContent=level;
 if(score>bestScore){bestScore=score;localStorage.setItem('abyssalBestScore',String(score));$('bestScore').textContent=bestScore.toLocaleString('pt-BR')}
 if(elapsed>bestTime){bestTime=elapsed;localStorage.setItem('abyssalBestTime',String(elapsed));$('bestTime').textContent=fmtTime(bestTime)}
 $('saveStatus').textContent='RECORDE SALVO';burst(player.x,player.y,'#ff7796',35,210);audio(95,.5,'sawtooth',.04);
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
 c.save();c.translate(x,y);c.rotate(angle||0);
 const wobble=Math.sin(t*.004+(x+y)*.01);
 // tentacles
 const skin=(playerCreature?(skinOverride||(skinData.find(s=>s.id===equippedSkin)||skinData[0])):null);const n=playerCreature?6:(['boss','leviathan','maw','angler'].includes(kind)?(kind==='leviathan'?22:kind==='maw'?18:14):kind==='brute'?7:4);
 for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2;c.save();c.rotate(a);const len=r*(playerCreature?1.45:(['boss','leviathan','maw','angler'].includes(kind)?(kind==='leviathan'?2.25:kind==='maw'?1.95:1.75):kind==='brute'?1.15:1.05));c.beginPath();c.moveTo(r*.55,0);c.bezierCurveTo(len*.5,Math.sin(t*.004+i*2)*r*.6,len*.8,Math.cos(t*.003+i)*r*.55,len+wobble*r*.2,Math.sin(t*.004+i)*r*.75);c.strokeStyle=color;c.lineWidth=Math.max(1.2,r*.12);c.lineCap='round';c.shadowBlur=playerCreature?14:8;c.shadowColor=color;c.stroke();c.restore()}
 const grad=c.createRadialGradient(-r*.3,-r*.35,1,0,0,r*1.2);grad.addColorStop(0,playerCreature?'#e5ffff':'#ffd5e1');grad.addColorStop(.22,hit>0?'#ffffff':color);grad.addColorStop(.72,playerCreature?'#176a85':'#532c64');grad.addColorStop(1,'#091629');
 c.fillStyle=grad;c.shadowBlur=playerCreature?22:16;c.shadowColor=color;c.beginPath();
 let bodyX=1+wobble*.04,bodyY=.9-wobble*.03;
 if(kind==='leviathan'||(playerCreature&&skin?.shape==='leviathan')){bodyX=1.42;bodyY=.62}
 if(kind==='maw'){bodyX=1.12;bodyY=1.05}
 if(kind==='angler'){bodyX=1.02;bodyY=.92}
 if(kind==='stinger'){bodyX=.78;bodyY=.7}
 if(kind==='brute'){bodyX=1.2;bodyY=1.12}
 if(kind==='lurker'){bodyX=1.38;bodyY=.68}
 if(playerCreature && ['shell','coral'].includes(skin?.shape)){bodyX=1.06;bodyY=1.05}
 if(playerCreature && skin?.shape==='horns'){
   c.save();c.strokeStyle=color;c.lineWidth=Math.max(2,r*.16);c.lineCap='round';c.shadowBlur=18;c.shadowColor=color;
   c.beginPath();c.moveTo(-r*.42,-r*.48);c.bezierCurveTo(-r*.95,-r*1.05,-r*.88,-r*1.32,-r*.62,-r*1.38);
   c.moveTo(r*.42,-r*.48);c.bezierCurveTo(r*.95,-r*1.05,r*.88,-r*1.32,r*.62,-r*1.38);c.stroke();c.restore();
 }
 if(playerCreature && skin?.shape==='halo'){
   c.save();c.rotate(Math.sin(t*.0015)*.08);c.strokeStyle='#fff0b8';c.lineWidth=Math.max(2,r*.10);c.shadowBlur=22;c.shadowColor='#fff0b8';
   c.beginPath();c.ellipse(0,-r*1.02,r*.62,r*.19,0,0,Math.PI*2);c.stroke();
   for(let k=0;k<8;k++){const a=k*Math.PI/4;c.fillStyle='#fff9d8';c.beginPath();c.arc(Math.cos(a)*r*.62,-r*1.02+Math.sin(a)*r*.19,Math.max(1.2,r*.045),0,Math.PI*2);c.fill()}c.restore();
 }
 if(playerCreature&&skin?.shape==='king'){bodyX=1.12;bodyY=1.02}
 c.ellipse(0,0,r*bodyX,r*bodyY,0,0,Math.PI*2);c.fill();c.shadowBlur=0;
 // Unique silhouette details: maw, angler lure, and the king's crown are visibly different.
 if(kind==='maw'){
   c.save();c.rotate(Math.sin(t*.001)*.05);c.fillStyle='#100714';c.strokeStyle='#ff557f';c.lineWidth=Math.max(2,r*.09);c.shadowBlur=18;c.shadowColor='#ff315f';c.beginPath();c.ellipse(r*.32,0,r*.48,r*.58,0,0,Math.PI*2);c.fill();c.stroke();
   c.fillStyle='#fff0d9';for(let tooth=0;tooth<9;tooth++){const a=tooth/9*Math.PI*2;const tx=r*.32+Math.cos(a)*r*.38,ty=Math.sin(a)*r*.47;c.beginPath();c.moveTo(tx,ty);c.lineTo(tx-Math.cos(a)*r*.12,ty-Math.sin(a)*r*.12);c.lineTo(tx+Math.cos(a+1.1)*r*.05,ty+Math.sin(a+1.1)*r*.05);c.closePath();c.fill()}c.restore();
 }
 if(kind==='leviathan'){
   c.save();c.fillStyle='#4ce0d1';c.strokeStyle='#c5fff8';c.shadowBlur=20;c.shadowColor='#4ce0d1';c.lineWidth=Math.max(2,r*.07);for(let fin=0;fin<7;fin++){const fx=-r*.65+fin*r*.22;c.beginPath();c.moveTo(fx,-r*.35);c.quadraticCurveTo(fx-r*.12,-r*1.0,fx+r*.18,-r*.82);c.lineTo(fx+r*.16,-r*.28);c.closePath();c.fill();c.stroke()}c.restore();
 }
 if(kind==='boss'){
   c.save();c.strokeStyle='#ff315f';c.fillStyle='#ff315f';c.shadowBlur=25;c.shadowColor='#ff315f';c.lineWidth=Math.max(2,r*.1);c.beginPath();c.moveTo(-r*.55,-r*.6);c.lineTo(-r*.8,-r*1.55);c.lineTo(-r*.18,-r*.95);c.lineTo(r*.05,-r*1.75);c.lineTo(r*.35,-r*.95);c.lineTo(r*.85,-r*1.4);c.lineTo(r*.62,-r*.48);c.stroke();c.restore();
 }
 if(kind==='angler'){
   c.save();c.strokeStyle='#ffbd72';c.lineWidth=Math.max(2,r*.09);c.shadowBlur=16;c.shadowColor='#ff9c55';c.beginPath();c.moveTo(r*.05,-r*.55);c.quadraticCurveTo(r*.35,-r*1.25,r*.72,-r*1.05);c.stroke();c.fillStyle='#fff1b0';c.beginPath();c.arc(r*.74,-r*1.05,r*.17*(1+Math.sin(t*.01)*.12),0,Math.PI*2);c.fill();c.restore();
 }
 if(playerCreature && skin?.shape==='horns'){
   c.save();c.strokeStyle=color;c.lineWidth=Math.max(2,r*.16);c.lineCap='round';c.shadowBlur=18;c.shadowColor=color;
   c.beginPath();c.moveTo(-r*.42,-r*.48);c.bezierCurveTo(-r*.95,-r*1.05,-r*.88,-r*1.32,-r*.62,-r*1.38);
   c.moveTo(r*.42,-r*.48);c.bezierCurveTo(r*.95,-r*1.05,r*.88,-r*1.32,r*.62,-r*1.38);c.stroke();c.restore();
 }
 if(playerCreature && skin?.shape==='halo'){
   c.save();c.rotate(Math.sin(t*.0015)*.08);c.strokeStyle='#fff0b8';c.lineWidth=Math.max(2,r*.10);c.shadowBlur=22;c.shadowColor='#fff0b8';
   c.beginPath();c.ellipse(0,-r*1.02,r*.62,r*.19,0,0,Math.PI*2);c.stroke();
   for(let k=0;k<8;k++){const a=k*Math.PI/4;c.fillStyle='#fff9d8';c.beginPath();c.arc(Math.cos(a)*r*.62,-r*1.02+Math.sin(a)*r*.19,Math.max(1.2,r*.045),0,Math.PI*2);c.fill()}c.restore();
 }
 if(playerCreature&&skin?.shape==='king'){
   c.save();c.fillStyle='#d6c7ff';c.strokeStyle='#8b7cff';c.lineWidth=2;c.shadowBlur=18;c.shadowColor='#8b7cff';c.beginPath();c.moveTo(-r*.55,-r*.55);c.lineTo(-r*.48,-r*1.15);c.lineTo(-r*.12,-r*.78);c.lineTo(r*.05,-r*1.3);c.lineTo(r*.28,-r*.76);c.lineTo(r*.62,-r*1.08);c.lineTo(r*.55,-r*.45);c.closePath();c.fill();c.stroke();c.restore();
 }

 if(kind==='leviathan'){
   // Pale skeletal crown resembling a skull emerging from the head.
   c.save();c.translate(-r*.08,-r*.18);c.shadowBlur=20;c.shadowColor='#f5ffff';c.strokeStyle='#f4ffff';c.fillStyle='rgba(225,250,255,.82)';c.lineWidth=Math.max(2,r*.055);
   c.beginPath();c.ellipse(0,-r*.53,r*.48,r*.34,0,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#07131d';c.beginPath();c.ellipse(-r*.18,-r*.54,r*.10,r*.13,0,0,Math.PI*2);c.ellipse(r*.18,-r*.54,r*.10,r*.13,0,0,Math.PI*2);c.fill();c.strokeStyle='#eaffff';c.beginPath();c.moveTo(-r*.24,-r*.27);c.lineTo(-r*.2,-r*.12);c.lineTo(-r*.1,-r*.25);c.lineTo(0,-r*.1);c.lineTo(r*.1,-r*.25);c.lineTo(r*.2,-r*.12);c.lineTo(r*.24,-r*.27);c.stroke();c.restore();
 }
 if(kind==='angler'){
   // Long luminous lure and sharp jaw teeth.
   c.save();c.strokeStyle='#fff2a8';c.lineWidth=Math.max(2,r*.07);c.shadowBlur=26;c.shadowColor='#ffb84e';c.beginPath();c.moveTo(r*.05,-r*.45);c.bezierCurveTo(r*.1,-r*1.1,r*.55,-r*1.65,r*.8,-r*1.45);c.stroke();c.fillStyle='#fffbd2';c.beginPath();c.arc(r*.82,-r*1.46,r*.2*(1+Math.sin(t*.012)*.12),0,Math.PI*2);c.fill();c.fillStyle='#faffdf';c.beginPath();c.ellipse(r*.55,r*.15,r*.38,r*.22,0,0,Math.PI*2);c.fill();for(let tooth=0;tooth<7;tooth++){const tx=r*.28+tooth*r*.09;c.beginPath();c.moveTo(tx,r*.02);c.lineTo(tx+r*.035,r*.17);c.lineTo(tx+r*.07,r*.03);c.fill()}c.restore();
 }
 if(kind==='maw'){
   // Oversized abyssal maw with a second ring of teeth and long tendrils.
   c.save();c.translate(r*.35,0);c.shadowBlur=26;c.shadowColor='#ff3c88';c.fillStyle='#03030b';c.strokeStyle='#ff5c9d';c.lineWidth=Math.max(2,r*.08);c.beginPath();c.ellipse(0,0,r*.62,r*.72,0,0,Math.PI*2);c.fill();c.stroke();for(let row=0;row<2;row++){const count=row?13:11;for(let tooth=0;tooth<count;tooth++){const a=tooth/count*Math.PI*2;const rr=row?r*.52:r*.43;const tx=Math.cos(a)*rr,ty=Math.sin(a)*rr;c.fillStyle=row?'#b9faff':'#fff4df';c.beginPath();c.moveTo(tx,ty);c.lineTo(tx-Math.cos(a)*r*.2,ty-Math.sin(a)*r*.2);c.lineTo(tx+Math.cos(a+1.15)*r*.08,ty+Math.sin(a+1.15)*r*.08);c.closePath();c.fill()}}c.restore();
 }
 if(kind==='boss'){
   // Tall, branching horns with bony ridges.
   c.save();c.strokeStyle='#ff476d';c.shadowBlur=28;c.shadowColor='#ff174d';c.lineWidth=Math.max(3,r*.12);for(const side of [-1,1]){c.beginPath();c.moveTo(side*r*.28,-r*.45);c.bezierCurveTo(side*r*.55,-r*.9,side*r*.95,-r*1.9,side*r*1.18,-r*1.55);c.bezierCurveTo(side*r*1.28,-r*1.35,side*r*.92,-r*1.2,side*r*.82,-r*.75);c.stroke();c.beginPath();c.moveTo(side*r*.48,-r*.62);c.lineTo(side*r*.75,-r*1.18);c.stroke()}c.restore();
 }

 // Silhuetas especiais das skins: cada compra muda a forma, não só a cor.
 if(playerCreature&&skin?.shape==='crystal'){
  c.save();c.shadowBlur=20;c.shadowColor=color;for(let k=0;k<8;k++){const a=k*Math.PI/4,rr=r*1.05;c.save();c.rotate(a);c.fillStyle=k%2?'#e6fbff':color;c.strokeStyle='#efffff';c.lineWidth=1.2;c.beginPath();c.moveTo(r*.8,0);c.lineTo(r*1.42,-r*.18);c.lineTo(r*1.62,0);c.lineTo(r*1.42,r*.18);c.closePath();c.fill();c.stroke();c.restore()}c.restore();
 }
 if(playerCreature&&skin?.shape==='coral'){
  c.save();c.strokeStyle='#ffe2f0';c.lineWidth=Math.max(2,r*.09);c.lineCap='round';c.shadowBlur=18;c.shadowColor=color;for(const side of [-1,1]){c.beginPath();c.moveTo(side*r*.24,-r*.55);c.lineTo(side*r*.42,-r*1.05);c.lineTo(side*r*.25,-r*1.22);c.moveTo(side*r*.42,-r*1.05);c.lineTo(side*r*.68,-r*1.16);c.moveTo(side*r*.1,-r*.68);c.lineTo(side*r*.05,-r*1.1);c.stroke()}for(let k=0;k<5;k++){c.fillStyle='#ffe6a8';c.beginPath();c.arc(Math.cos(k*1.25)*r*.95,Math.sin(k*1.25)*r*.95,r*.065,0,Math.PI*2);c.fill()}c.restore();
 }
 if(playerCreature&&skin?.shape==='wings'){
  c.save();c.shadowBlur=22;c.shadowColor=color;c.fillStyle=color;c.strokeStyle='#e8ddff';c.lineWidth=1.4;for(const side of [-1,1]){c.beginPath();c.moveTo(-r*.25,0);c.bezierCurveTo(side*r*.65,-r*.9,side*r*1.6,-r*1.2,side*r*1.78,-r*.25);c.bezierCurveTo(side*r*1.25,r*.15,side*r*.7,r*.45,-r*.25,0);c.closePath();c.globalAlpha=.72;c.fill();c.globalAlpha=1;c.stroke();for(let feather=0;feather<3;feather++){c.beginPath();c.moveTo(side*r*.45,-r*.2+feather*r*.2);c.lineTo(side*r*(.95+feather*.18),-r*(.72-feather*.1));c.stroke()}}c.restore();
 }
 if(playerCreature&&skin?.shape==='fangs'){
  c.save();c.fillStyle='#fff0e7';c.strokeStyle='#ff8caa';c.lineWidth=1.2;c.shadowBlur=16;c.shadowColor=color;for(let k=0;k<6;k++){const side=k%2?1:-1,xx=side*r*(.32+Math.floor(k/2)*.22),yy=(k%3-1)*r*.24;c.beginPath();c.moveTo(xx,yy);c.lineTo(xx+side*r*.06,yy+r*.36);c.lineTo(xx+side*r*.13,yy);c.closePath();c.fill();c.stroke()}c.restore();
 }
 if(playerCreature&&skin?.shape==='eye'){
  c.save();c.shadowBlur=22;c.shadowColor=color;c.fillStyle='#07131d';c.strokeStyle='#c9ffff';c.lineWidth=Math.max(1.5,r*.08);c.beginPath();c.ellipse(r*.18,0,r*.53,r*.43,-.08,0,Math.PI*2);c.fill();c.stroke();const iris=c.createRadialGradient(r*.18,0,1,r*.18,0,r*.3);iris.addColorStop(0,'#fff8d0');iris.addColorStop(.25,color);iris.addColorStop(1,'#13243e');c.fillStyle=iris;c.beginPath();c.arc(r*.18,0,r*.3,0,Math.PI*2);c.fill();c.fillStyle='#02050b';c.beginPath();c.ellipse(r*.22,0,r*.07,r*.24,0,0,Math.PI*2);c.fill();for(let k=0;k<5;k++){const a=k*Math.PI*2/5;c.fillStyle='#e6ffff';c.beginPath();c.arc(Math.cos(a)*r*1.25,Math.sin(a)*r*1.25,r*.09,0,Math.PI*2);c.fill()}c.restore();
 }
 if(playerCreature&&skin?.shape==='shell'){
  c.save();c.shadowBlur=15;c.shadowColor=color;c.fillStyle='#c3e2d7';c.strokeStyle=color;c.lineWidth=1.6;for(let k=0;k<3;k++){const xx=(-.68+k*.68)*r;c.beginPath();c.moveTo(xx-r*.24,-r*.42);c.lineTo(xx,-r*.9);c.lineTo(xx+r*.28,-r*.44);c.lineTo(xx+r*.2,r*.24);c.lineTo(xx-r*.2,r*.3);c.closePath();c.fill();c.stroke()}c.restore();
 }
 // Enemy-specific anatomy, shared by live combat and the codex portrait renderer.
 if(!playerCreature&&kind==='stinger'){
  c.save();c.strokeStyle='#fff0cc';c.fillStyle='#ff9e60';c.lineWidth=Math.max(1.5,r*.12);c.shadowBlur=14;c.shadowColor=color;c.beginPath();c.moveTo(-r*.45,0);c.lineTo(-r*1.45,0);c.lineTo(-r*1.05,-r*.2);c.closePath();c.fill();c.stroke();for(let k=0;k<4;k++){const yy=(k-1.5)*r*.3;c.beginPath();c.moveTo(-r*.1,yy);c.lineTo(-r*.55,yy+Math.sign(yy||1)*r*.45);c.stroke()}c.restore();
 }
 if(!playerCreature&&kind==='brute'){
  c.save();c.fillStyle='#655184';c.strokeStyle='#ead9ff';c.lineWidth=Math.max(1.5,r*.09);c.shadowBlur=12;c.shadowColor=color;for(let k=0;k<5;k++){const a=(k/5)*Math.PI*2;c.save();c.rotate(a);c.beginPath();c.moveTo(r*.5,0);c.lineTo(r*.94,-r*.32);c.lineTo(r*1.04,r*.08);c.lineTo(r*.58,r*.33);c.closePath();c.fill();c.stroke();c.restore()}c.strokeStyle='#f8e7ff';c.beginPath();c.moveTo(-r*.2,-r*.4);c.lineTo(-r*.06,-r*.08);c.lineTo(-r*.32,r*.18);c.stroke();c.restore();
 }
 if(!playerCreature&&kind==='lurker'){
  c.save();c.strokeStyle='#9eb7ff';c.fillStyle='#dce8ff';c.shadowBlur=14;c.shadowColor=color;for(let k=0;k<4;k++){const xx=(-.55+k*.35)*r;c.beginPath();c.ellipse(xx,-r*.12,r*.07,r*.14,0,0,Math.PI*2);c.fill()}c.strokeStyle=color;c.lineWidth=Math.max(1.2,r*.05);c.beginPath();c.moveTo(-r*.2,r*.45);c.quadraticCurveTo(r*.8,r*.8,r*1.1,r*.35);c.stroke();c.restore();
 }
 // eyes face forward
 c.rotate(0);const eyeY=-r*.05,eyeX=r*.27;c.fillStyle='#04111b';c.beginPath();c.ellipse(eyeX,-r*.12,r*.12,r*.19,0,0,Math.PI*2);c.ellipse(eyeX,r*.19,r*.12,r*.16,0,0,Math.PI*2);c.fill();c.fillStyle=playerCreature?'#d5ffff':'#ffe4b9';c.beginPath();c.arc(eyeX+r*.025,-r*.15,r*.045,0,Math.PI*2);c.fill();
 if((playerCreature&&['horns','king','spikes'].includes(skin?.shape))||['boss','leviathan','maw','angler'].includes(kind)){c.save();c.strokeStyle=color;c.fillStyle=color;c.shadowBlur=22;c.shadowColor=color;c.lineWidth=Math.max(2,r*.12);for(let h=0;h<(['boss','leviathan','maw','angler'].includes(kind)?(kind==='leviathan'?8:kind==='maw'?3:5):skin?.shape==='king'?4:2);h++){const side=h%2===0?-1:1,baseX=['boss','leviathan','maw','angler'].includes(kind)?r*.25:0,baseY=side*r*.45;c.beginPath();c.moveTo(baseX,baseY);c.quadraticCurveTo(baseX+side*r*.8,baseY-side*r*.9,baseX+side*r*(kind==='leviathan'?2.1:['boss','maw','angler'].includes(kind)?1.7:1.2),baseY-side*r*(kind==='leviathan'?1.9:['boss','maw','angler'].includes(kind)?1.4:.95));c.stroke()}c.restore()}
 if(['boss','leviathan','maw','angler'].includes(kind)){c.strokeStyle=color;c.lineWidth=3;c.shadowBlur=20;c.shadowColor='#ff315f';c.beginPath();c.arc(0,0,r*(kind==='leviathan'?1.8:1.5),t*.001,t*.001+Math.PI*1.7);c.stroke();c.fillStyle='#fff0f5';c.beginPath();c.arc(r*.3,-r*.15,r*.1,0,Math.PI*2);c.arc(r*.3,r*.2,r*.1,0,Math.PI*2);c.fill()}
 if(playerCreature){
   if(skin?.shape==='spikes'){
     c.save();c.fillStyle='#fff0b5';c.strokeStyle=color;c.lineWidth=1.5;c.shadowBlur=14;c.shadowColor=color;
     for(let k=0;k<7;k++){const a=-Math.PI*.85+k*(Math.PI*1.7/6);c.beginPath();c.moveTo(Math.cos(a)*r*.72,Math.sin(a)*r*.72);c.lineTo(Math.cos(a)*r*1.42,Math.sin(a)*r*1.42);c.lineTo(Math.cos(a+.16)*r*.65,Math.sin(a+.16)*r*.65);c.closePath();c.fill();c.stroke()}c.restore();
   }
   if(skin?.shape==='horns'){
     c.save();c.strokeStyle='#f2e5ff';c.lineWidth=Math.max(2,r*.15);c.shadowBlur=18;c.shadowColor=color;for(const side of [-1,1]){c.beginPath();c.moveTo(side*r*.32,-r*.5);c.bezierCurveTo(side*r*.6,-r*1.05,side*r*1.12,-r*1.15,side*r*1.02,-r*1.52);c.stroke()}c.restore();
   }
   if(skin?.shape==='tentacles'){
     c.save();c.strokeStyle='#e2ffae';c.lineWidth=Math.max(2,r*.08);c.shadowBlur=16;c.shadowColor=color;for(let k=0;k<4;k++){const side=k%2?1:-1,yy=(k-1.5)*r*.28;c.beginPath();c.moveTo(side*r*.55,yy);c.bezierCurveTo(side*r*1.1,yy-r*.2,side*r*1.5,yy+r*.35,side*r*1.85,yy-r*.15);c.stroke();c.fillStyle='#fff4a8';c.beginPath();c.arc(side*r*1.85,yy-r*.15,r*.055,0,Math.PI*2);c.fill()}c.restore();
   }
   c.strokeStyle='rgba(179,255,248,.7)';c.lineWidth=1.3;c.beginPath();c.arc(0,0,r*1.38,-.7,.7);c.stroke();if(upgrades.shield>0){c.strokeStyle='rgba(129,239,255,.75)';c.lineWidth=2;c.beginPath();c.arc(0,0,r*1.8,t*.001,t*.001+Math.PI*1.6);c.stroke()}}
 c.restore();
}
function draw(t){
 ctx.save();if(shake>0)ctx.translate(rand(-shake,shake),rand(-shake,shake));drawBackground(t);
 // faint floor current rings
 ctx.save();ctx.strokeStyle='rgba(105,207,214,.08)';for(let i=0;i<4;i++){const rr=65+i*46+Math.sin(t*.001+i)*4;ctx.beginPath();ctx.ellipse(W*.5,H*.55,rr*1.5,rr*.7,Math.sin(t*.0002)*.1,0,Math.PI*2);ctx.stroke()}ctx.restore();
 for(const o of orbs){const pulse=1+Math.sin(o.phase)*.2;ctx.save();ctx.shadowBlur=18;ctx.shadowColor='#a28dff';ctx.fillStyle='#b8a7ff';ctx.beginPath();ctx.arc(o.x,o.y,o.r*pulse,0,Math.PI*2);ctx.fill();ctx.fillStyle='#effaff';ctx.beginPath();ctx.arc(o.x-o.r*.25,o.y-o.r*.25,o.r*.3,0,Math.PI*2);ctx.fill();ctx.restore()}
 for(const p of projectiles){ctx.save();const trail=p.allyShot?'#9bbcff':(p.special==='pierce'?'#ffe7a1':p.special==='ricochet'?'#ffc47a':p.special==='electric'?'#79f3ff':p.color);ctx.strokeStyle=trail;ctx.lineWidth=p.special==='pierce'?6:p.allyShot?5.5:p.special==='electric'?5:p.special==='ricochet'?5:p.r*2;ctx.shadowBlur=p.special?30:p.allyShot?26:18;ctx.shadowColor=trail;ctx.beginPath();ctx.moveTo(p.x-p.vx*(p.special==='pierce'?.065:.045),p.y-p.vy*(p.special==='pierce'?.065:.045));ctx.lineTo(p.x,p.y);ctx.stroke();if(p.special==='electric'){ctx.strokeStyle='#eaffff';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(p.x-p.vx*.025,p.y-p.vy*.025);ctx.lineTo(p.x+rand(-4,4),p.y+rand(-4,4));ctx.lineTo(p.x,p.y);ctx.stroke()}ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(p.x,p.y,p.special==='pierce'?p.r*1.3:p.r,0,Math.PI*2);ctx.fill();
 if(p.allyShot){ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.x-p.vx*.018,p.y-p.vy*.018);ctx.lineTo(p.x+rand(-3,3),p.y+rand(-3,3));ctx.lineTo(p.x,p.y);ctx.stroke()}
 ctx.restore()}
 for(const e of enemies){drawCreature(e.x,e.y,e.r,e.angle,e.color,e.kind,t,false,e.hit);if(e.hp<e.maxHp||['boss','leviathan','maw','angler'].includes(e.kind)){ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(e.x-e.r,e.y-e.r-(['boss','leviathan','maw','angler'].includes(e.kind)?16:8),e.r*2,['boss','leviathan','maw','angler'].includes(e.kind)?6:3);ctx.fillStyle=e.color;ctx.fillRect(e.x-e.r,e.y-e.r-(['boss','leviathan','maw','angler'].includes(e.kind)?16:8),e.r*2*clamp(e.hp/e.maxHp,0,1),['boss','leviathan','maw','angler'].includes(e.kind)?6:3);if(['boss','leviathan','maw','angler'].includes(e.kind)){ctx.fillStyle='#ffd8e2';ctx.font='bold 11px sans-serif';ctx.textAlign='center';const labels={boss:'ABERRAÇÃO ABISSAL',leviathan:'LEVIATÃ DAS FOSSAS',maw:'A BOCA DO ABISMO',angler:'LANTERNA MORTAL'};ctx.fillText(labels[e.kind]||'BOSS ABISSAL',e.x,e.y-e.r-22)}}}
 for(const fx of effects){ctx.save();ctx.globalAlpha=clamp(fx.life/fx.maxLife,0,1);ctx.strokeStyle=fx.color;ctx.shadowBlur=24;ctx.shadowColor=fx.color;ctx.lineWidth=fx.type==='ring'?4:3;ctx.beginPath();if(fx.type==='ring'){const progress=1-fx.life/fx.maxLife;ctx.arc(fx.x,fx.y,fx.max*progress,0,Math.PI*2)}else{ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(fx.x2,fx.y2);ctx.lineTo(fx.x2+rand(-5,5),fx.y2+rand(-5,5))}ctx.stroke();ctx.restore()}
 for(const p of particles){ctx.save();ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.shadowBlur=7;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(.4+.6*p.life/p.max),0,Math.PI*2);ctx.fill();ctx.restore()}
 if(player){for(const tr of player.trail){if(tr.life>0){ctx.globalAlpha=tr.life/.28*.18;ctx.fillStyle='#7ffbf2';ctx.beginPath();ctx.arc(tr.x,tr.y,player.r*.7,0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1;if(player.invuln<=0||Math.floor(t/80)%2===0)drawCreature(player.x,player.y,player.r,player.angle,currentSkinColor(),'player',t,true);ctx.save();ctx.strokeStyle='rgba(126,245,244,.20)';ctx.fillStyle='rgba(126,245,244,.025)';ctx.lineWidth=1;ctx.setLineDash([5,9]);ctx.beginPath();ctx.arc(player.x,player.y,210*(upgrades.range||1),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.restore();if(damageFlash>0){ctx.fillStyle=`rgba(255,65,100,${damageFlash*.45})`;ctx.fillRect(0,0,W,H)}}
 // Cooperative companions: live players are relayed by the online server; if alone, a helper drone appears.
 if(player && onlineMode){
   const peers=window.AbyssalOnline?window.AbyssalOnline.getPlayers():[];
   peers.forEach(peer=>{const px=peer.x*W,py=peer.y*H;drawCreature(px,py,12,peer.angle||0,peer.color||'#b8a4ff','peer',t,true,0,ctx,window.AbyssalGameHooks?.skinForId?.(peer.skinId));ctx.fillStyle='#d8ffff';ctx.font='10px Manrope';ctx.textAlign='center';ctx.fillText(peer.nickname||'Mergulhador',px,py-22)});
 }
 // corner scanner details
 ctx.save();ctx.strokeStyle='rgba(123,215,223,.23)';ctx.lineWidth=1;const s=14;[[12,12,1,1],[W-12,12,-1,1],[12,H-12,1,-1],[W-12,H-12,-1,-1]].forEach(([x,y,a,b])=>{ctx.beginPath();ctx.moveTo(x,y+s*b);ctx.lineTo(x,y);ctx.lineTo(x+s*a,y);ctx.stroke()});ctx.restore();
 ctx.restore();
}
let loopErrorShown=false;
function loop(t){const dt=Math.min(.035,Math.max(0,(t-last)/1000||0));last=t;try{if(gameState==='playing'||(onlineMode&&gameState==='upgrade'))update(dt);draw(t)}catch(err){console.error('Abyssal frame error:',err);if(!loopErrorShown){loopErrorShown=true;showToast('Um efeito falhou; a partida continua. Consulte o Console (F12).')}}requestAnimationFrame(loop)}
function coords(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
canvas.addEventListener('pointerdown',e=>{if(gameState!=='playing')return;pointer={...coords(e),down:true,active:true};canvas.setPointerCapture?.(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(pointer.down)Object.assign(pointer,coords(e))});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>canvas.addEventListener(ev,()=>{pointer.down=false;pointer.active=false}));
window.addEventListener('keydown',e=>{keys[e.key]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if((e.key==='q'||e.key==='Q')&&Number(metaUpgrades.pulse)>0)activateAbility('pulse');if((e.key==='e'||e.key==='E')&&Number(metaUpgrades.dash)>0)activateAbility('dash');if(e.key==='Escape'||e.key==='p'||e.key==='P'){if(gameState==='playing')pauseGame();else if(gameState==='paused')resumeGame()}});
window.addEventListener('keyup',e=>keys[e.key]=false);
$('playBtn').addEventListener('click',()=>{onlineMode=false;startGame()});$('againBtn').addEventListener('click',()=>{if(onlineMode){window.AbyssalOnline?.joinWorld()}startGame()});$('menuBtn').addEventListener('click',()=>{gameState='menu';$('gameOverScreen').hidden=true;$('menuScreen').hidden=false;$('pauseBtn').hidden=true});
$('pauseBtn').addEventListener('click',pauseGame);$('resumeBtn').addEventListener('click',resumeGame);$('quitBtn').addEventListener('click',()=>{if(onlineMode)window.AbyssalOnline?.leaveWorld();onlineMode=false;gameState='menu';$('pauseScreen').hidden=true;$('hud').hidden=true;$('menuScreen').hidden=false;$('pauseBtn').hidden=true});
$('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'♫':'♪';$('soundBtn').style.color=soundOn?'':'#617783';if(soundOn){startAmbientMusic();audio(580,.08,'sine',.025)}else stopAmbientMusic()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&gameState==='playing'&&!onlineMode)pauseGame();if(!document.hidden)last=performance.now();});
window.addEventListener('resize',resize);
window.addEventListener('abyssal-remote-shot',ev=>{const d=ev.detail;if(!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;
 const col=d.color||'#9bbcff',special=d.special||null;
 projectiles.push({x:d.x*W,y:d.y*H,vx:(d.vx||0)*W,vy:(d.vy||0)*H,r:special==='pierce'?6.5:special==='electric'?5.8:5.2,life:1.05,damage:0,color:col,special,allyShot:true,remoteVisual:true,trailLife:.16});
 burst(d.x*W,d.y*H,col,5,75);
 if(projectiles.length>350)projectiles.splice(0,projectiles.length-350);
});
window.AbyssalGameHooks={
 skinColor:()=>currentSkinColor(),
 skinId:()=>equippedSkin,
 skinForId:id=>skinData.find(s=>s.id===id)||skinData[0],
 toast:message=>showToast(message),
 remoteHit:data=>{if(!player)return;const tx=data.x*W,ty=data.y*H;let nearest=null,bd=Infinity;for(const e of enemies){const d=Math.hypot(e.x-tx,e.y-ty);if(d<bd){bd=d;nearest=e}}if(nearest&&bd<100){effects.push({type:'beam',x1:tx,y1:ty,x2:nearest.x,y2:nearest.y,life:.14,maxLife:.14,color:'#bba8ff'});burst(nearest.x,nearest.y,'#bba8ff',5,60);}},
 applySnapshot:applySharedSnapshot,
 restoreHostState:data=>{if(!data||!Array.isArray(data.enemies))return;elapsed=Number(data.elapsed)||elapsed;enemies=data.enemies.map(e=>({...e,x:(Number(e.x)||0)*W,y:(Number(e.y)||0)*H,r:(Number(e.r)||.015)*Math.min(W,H)}));},
 sharedDamage:applySharedDamage,
 sharedXp:applySharedXp,
};
function renderCreaturePreview(canvas,kind,color,skin=null){
 if(!canvas)return;const c=canvas.getContext('2d');if(!c)return;const w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);const bg=c.createRadialGradient(w*.5,h*.45,2,w*.5,h*.5,Math.max(w,h)*.65);bg.addColorStop(0,'#102d40');bg.addColorStop(1,'#030913');c.fillStyle=bg;c.fillRect(0,0,w,h);c.save();c.strokeStyle='rgba(130,232,239,.16)';c.lineWidth=1;c.beginPath();c.ellipse(w*.5,h*.64,w*.3,h*.16,0,0,Math.PI*2);c.stroke();c.restore();drawCreature(w*.5,h*.49,Math.min(19,h*.22),-.2,color,kind,performance.now(),!!skin,0,c,skin);}
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
window.addEventListener('abyssal-world-defeated',ev=>{const e=ev.detail;if(!e)return;score+=Number(e.value||0)*10;const bosses=['boss','leviathan','maw','angler'].includes(e.kind);if(bosses){score+=1400;showToast('BOSS ABISSAL DERROTADO · +100 MOEDAS');}const x=(Number(e.x)||.5)*W,y=(Number(e.y)||.5)*H;burst(x,y,e.color||'#8ffff4',bosses?90:14,bosses?300:100);audio(bosses?180:260,.08,'triangle',.025);});
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
 drifter:{name:'Errante Luminescente',color:'#ff769d',symbol:'◉',desc:'Predador comum das zonas iluminadas do abismo. Move-se diretamente em direção ao mergulhador e causa dano por contato. Surge em grupos e sua velocidade aumenta conforme a expedição se prolonga.'},
 stinger:{name:'Ferrão de Fenda',color:'#ffbc78',symbol:'⌁',desc:'Caçador pequeno e extremamente ágil, com apêndices pontiagudos. Tem pouca resistência, mas tenta encurtar a distância rapidamente, tornando-se perigoso quando vários atacam ao mesmo tempo.'},
 brute:{name:'Bruto de Placas',color:'#bd88ff',symbol:'◈',desc:'Criatura pesada protegida por placas minerais. Aguenta muito mais dano do que os errantes e causa impactos fortes ao tocar o jogador. Sua movimentação é lenta, mas pode bloquear rotas de fuga.'},
 lurker:{name:'Predador Sombrio',color:'#6e8dff',symbol:'⦿',desc:'Habitante das regiões sem luz. Tem corpo alongado, olhos frios e comportamento persistente de perseguição. Resiste mais que as criaturas comuns e pune jogadores que permanecem parados.'},
 boss:{name:'Aberração Abissal',color:'#ff315f',symbol:'♆',desc:'Chefe de grande porte com crista óssea e tentáculos vermelhos bioluminescentes. Possui enorme reserva de vida e dano de contato elevado. A sua presença indica que a dificuldade da expedição aumentou.'},
 leviathan:{name:'Leviatã das Fossas',color:'#4ce0d1',symbol:'♜',desc:'Colosso alongado das fossas oceânicas, com nadadeiras luminosas e longos apêndices sensoriais. Tem a maior resistência entre os chefes conhecidos. Sua aproximação ocupa muito espaço e limita as rotas seguras.'},
 maw:{name:'A Boca do Abismo',color:'#c16cff',symbol:'◉',desc:'Massa predatória construída em torno de uma mandíbula circular repleta de dentes. Avança sem hesitar e transforma o contato direto em uma ameaça constante. O brilho violeta do corpo é visível mesmo na escuridão.'},
 angler:{name:'Lanterna Mortal',color:'#ffb45e',symbol:'✹',desc:'Predador de águas profundas que usa um órgão luminoso para detectar movimento. A haste brilhante e os espinhos da cabeça distinguem sua silhueta. É mais veloz que os chefes pesados e causa dano elevado.'}
 };

 const skillCopy={power:'Aumenta o dano causado por cada projétil.',rate:'Reduz o intervalo entre disparos automáticos.',speed:'Aumenta a velocidade de movimento do jogador.',range:'Amplia a distância máxima em que os inimigos podem ser escolhidos como alvo e alcançados pelas ondas.',magnet:'Atrai fragmentos de experiência de uma distância maior no modo solo.',regen:'Recupera vida gradualmente ao longo da partida.',shield:'Adiciona cargas de escudo que absorvem impactos antes de reduzir a vitalidade.',burst:'Libera periodicamente uma onda de energia ao redor do jogador, causando dano aos inimigos próximos.',electric:'Faz os disparos saltarem em raios visíveis entre inimigos próximos, causando dano adicional em cada salto.',pierce:'Permite atravessar uma criatura adicional por nível. A habilidade não aumenta o dano por impacto.',ricochet:'Cria arcos luminosos que saltam do alvo atingido para criaturas próximas, causando dano secundário.',nova:'Dispara periodicamente uma explosão circular de grande alcance que causa dano aos inimigos dentro da área.'};
 grid.innerHTML='<h3 class="codex-heading">✦ HABILIDADES DESCOBERTAS</h3><div class="codex-grid">'+upgradeList.map(u=>{const known=codex.skills.includes(u.id);return `<article class="codex-card ${known?'unlocked':'locked'}"><div class="codex-preview skill-preview" style="--preview:${known?'#9cecff':'#263747'}">${known?u.icon:'?'}</div><b>${known?u.name:'Ressonância desconhecida'}</b><p>${known?(skillCopy[u.id]||u.desc):'Descubra esta habilidade durante um mergulho para revelar seus efeitos.'}</p></article>`}).join('')+'</div><h3 class="codex-heading">◈ CRIATURAS ENCONTRADAS</h3><div class="codex-grid">'+Object.entries(monsterData).map(([k,m])=>{const known=codex.monsters.includes(k);return `<article class="codex-card monster-codex-card ${known?'unlocked':'locked'}"><div class="codex-preview monster-preview" style="--preview:${m.color}"><canvas width="150" height="95" data-monster-preview="${k}" aria-label="Prévia real de ${known?m.name:'uma criatura não identificada'}"></canvas></div><b>${known?m.name:'Forma não identificada'}</b><p>${known?m.desc:'Sinal visual capturado. Encontre esta criatura durante uma expedição para revelar seu nome e comportamento.'}</p></article>`}).join('')+'</div>';
 grid.querySelectorAll('canvas[data-monster-preview]').forEach(canvas=>{const kind=canvas.dataset.monsterPreview,m=monsterData[kind];renderCreaturePreview(canvas,kind,m.color,null);});
}

$('shopCloseBtn').addEventListener('click',()=>{$('shopScreen').hidden=true});
$('loginBtn').addEventListener('click',()=>{if(window.AbyssalOnline)window.AbyssalOnline.openLogin()});
$('onlineBtn').addEventListener('click',()=>{startAmbientMusic();onlineMode=true;if(window.AbyssalOnline)window.AbyssalOnline.connectAndJoin();if(window.AbyssalOnline?.isAuthenticated()){startGame();showToast('MODO COOPERATIVO ATIVADO')}});
window.addEventListener('abyssal-authenticated',()=>{if(window.AbyssalOnlinePendingStart){window.AbyssalOnlinePendingStart=false;$('loginScreen').hidden=true;onlineMode=true;startGame();showToast('CONECTADO AO ABISMO COOPERATIVO')}});
$('loginCancelBtn').addEventListener('click',()=>{$('loginScreen').hidden=true});
window.addEventListener('abyssal-account-data',e=>{const a=e.detail;if(!a)return;coins=Number(a.coins)||0;ownedSkins=Array.isArray(a.ownedSkins)?a.ownedSkins:['default'];equippedSkin=a.equippedSkin||'default';metaUpgrades=typeof a.metaUpgrades==='object'&&a.metaUpgrades?a.metaUpgrades:metaUpgrades;saveCosmeticsLocalOnly();renderShop();updateAbilityButtons();});
window.addEventListener('abyssal-purchase-result',e=>{const r=e.detail||{};showToast(r.message||'Compra processada');if(r.ok)audio(760,.15,'triangle',.035);});
function saveCosmeticsLocalOnly(){localStorage.setItem('abyssalCoins',String(coins));localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));localStorage.setItem('abyssalMetaUpgrades',JSON.stringify(metaUpgrades));}
renderShop();resize();gameState='menu';requestAnimationFrame(loop);

const endDiveButton=document.createElement('button');endDiveButton.id='endDiveBtn';endDiveButton.type='button';endDiveButton.textContent='ENCERRAR MERGULHO';endDiveButton.style.cssText='position:absolute;right:18px;top:72px;z-index:8;border:1px solid rgba(255,130,160,.55);border-radius:8px;padding:8px 10px;background:rgba(30,10,25,.78);color:#ffd6e0;font:600 10px Manrope,system-ui;letter-spacing:.08em;cursor:pointer;display:none';document.getElementById('gameShell').appendChild(endDiveButton);
endDiveButton.addEventListener('click',()=>{if(onlineMode)window.AbyssalOnline?.leaveWorld();onlineMode=false;gameState='menu';$('hud').hidden=true;$('pauseBtn').hidden=true;$('upgradeScreen').hidden=true;$('pauseScreen').hidden=true;$('gameOverScreen').hidden=true;$('menuScreen').hidden=false;endDiveButton.style.display='none';showToast('Mergulho encerrado. Os outros jogadores continuam jogando.');});

})();