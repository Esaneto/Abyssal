(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const $ = id => document.getElementById(id);
const screens = ['menuScreen','upgradeScreen','pauseScreen','gameOverScreen'];
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a,b)=>a+Math.random()*(b-a);
const wrappedDelta=(a,b,size)=>{let d=a-b;if(d>size/2)d-=size;else if(d< -size/2)d+=size;return d};
const dist = (a,b)=>Math.hypot(wrappedDelta(a.x,b.x,W),wrappedDelta(a.y,b.y,H));
const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
let W=800,H=500,dpr=1,last=0,elapsed=0,score=0,level=1,xp=0,xpNeed=10,hp=100,maxHp=100,gameState='menu',soundOn=true,nextBossAt=90;
let player=null,botBuddy=null,enemies=[],orbs=[],particles=[],projectiles=[],effects=[],decor=[],upgrades={},upgradeLevels={},chosen=[],spawnTimer=0,enemyId=0,shake=0,damageFlash=0,runSeed=0,bossIndex=0;
let bestScore=Number(localStorage.getItem('abyssalBestScore')||0),bestTime=Number(localStorage.getItem('abyssalBestTime')||0);
let snapshotClock=0,upgradeAutoTimer=null,upgradeOptions=[],sharedXpApplying=false,lastBossKind=null;
let coins=Number(localStorage.getItem('abyssalCoins')||0),equippedSkin=localStorage.getItem('abyssalSkin')||'default',onlineMode=false,botBuddyTimer=0;
const skinData=[
{id:'default',name:'Luz Abissal',color:'#75f8ed',price:0,paid:false,shape:'orb',desc:'A forma luminosa original.'},
{id:'violet',name:'Espectro Violeta',color:'#bd91ff',price:1000,paid:false,shape:'horns',desc:'Chifres cristalinos e presença espectral.'},
{id:'solar',name:'Núcleo Solar',color:'#ffd078',price:2500,paid:false,shape:'spikes',desc:'Espinhos bioluminescentes dourados.'},
{id:'toxic',name:'Lodo Tóxico',color:'#a7ff78',price:4000,paid:false,shape:'orb',desc:'A forma padrão em verde tóxico, com brilho ácido.'},
{id:'leviathan',name:'Leviatã Cego',color:'#ff668f',price:6500,paid:false,shape:'orb',desc:'Forma padrão em rosa abissal, com brilho intenso.'},
{id:'thorn',name:'Coroa de Espinhos',color:'#ff9b6a',price:8000,paid:false,shape:'horns',desc:'Forma padrão alaranjada com dois chifres curvos animados.'},
{id:'abyssking',name:'Rei do Vazio',color:'#8b7cff',price:10000,paid:false,shape:'king',desc:'Forma padrão violeta com uma coroa óssea luminosa.'},
{id:'royal',name:'Abismo Real',color:'#ff78d0',price:0,paid:true,shape:'halo',desc:'Edição premium rosa com auréola dourada animada.'},
{id:'glacier',name:'Glaciar Fantasma',color:'#91caff',price:0,paid:true,shape:'horns',desc:'Edição premium azul-gelo com chifres cristalinos.'}
];
let ownedSkins=JSON.parse(localStorage.getItem('abyssalOwnedSkins')||'["default"]');
function saveCosmetics(){localStorage.setItem('abyssalCoins',String(coins));localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));if(window.AbyssalOnline?.saveCosmetics)window.AbyssalOnline.saveCosmetics({ownedSkins,equippedSkin});}
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
 elapsed=0;score=0;level=1;xp=0;xpNeed=10;hp=100;maxHp=100;spawnTimer=0;enemyId=0;shake=0;damageFlash=0;chosen=[];nextBossAt=90;
 upgrades={power:1,rate:1,range:1,speed:1,magnet:1,regen:0,shield:0,burst:0,electric:0,pierce:0,ricochet:0,nova:0};
 upgradeLevels={power:0,rate:0,range:0,speed:0,magnet:0,regen:0,shield:0,burst:0,electric:0,pierce:0,ricochet:0,nova:0};
 enemies=[];orbs=[];particles=[];projectiles=[];effects=[];
 player={x:W*.5,y:H*.54,r:13,angle:0,moveSpeed:150,fireTimer:0,invuln:0,shieldTime:0,trail:[]};
 gameState='playing';screens.forEach(s=>$(s).hidden=true);$('hud').hidden=false;const endBtn=document.getElementById('endDiveBtn');if(endBtn)endBtn.style.display=onlineMode?'block':'none';$('pauseBtn').hidden=false;botBuddyTimer=0;botBuddy=null;
 updateHud();last=performance.now();audio(520,.12,'sine',.04);if(onlineMode)window.AbyssalOnline?.joinWorld();if(!onlineMode||onlineHost())for(let i=0;i<3;i++)spawnEnemy(true);snapshotClock=0;
}
const upgradeList=[
 {id:'power',name:'Pulso intenso',icon:'✧',desc:'Seus disparos causam 35% mais dano.',apply:()=>upgrades.power*=1.35},
 {id:'rate',name:'Ressonância veloz',icon:'⟡',desc:'Dispare 22% mais rápido.',apply:()=>upgrades.rate*=1.22},
 {id:'speed',name:'Propulsão abissal',icon:'➤',desc:'Mova-se 18% mais rápido.',apply:()=>upgrades.speed*=1.18},
 {id:'range',name:'Olho profundo',icon:'◎',desc:'Aumenta o alcance dos disparos.',apply:()=>upgrades.range*=1.22},
 {id:'magnet',name:'Campo magnético',icon:'⌁',desc:'Atrai fragmentos de energia de mais longe.',apply:()=>upgrades.magnet*=1.45},
 {id:'regen',name:'Membrana viva',icon:'✚',desc:'Recupera 1 ponto de vida a cada 4 segundos.',apply:()=>upgrades.regen+=1},
 {id:'shield',name:'Escudo espectral',icon:'◉',desc:'Ganha uma carga que bloqueia o próximo dano.',apply:()=>upgrades.shield=Math.min(3,upgrades.shield+1)},
 {id:'burst',name:'Pulso de ruptura',icon:'✺',desc:'A cada 7 segundos, libera uma onda de energia em grande alcance.',apply:()=>upgrades.burst=Math.min(3,upgrades.burst+1)},
 {id:'electric',name:'Tempestade elétrica',icon:'ϟ',desc:'Disparos encadeiam raios visíveis em até 2 inimigos próximos.',apply:()=>upgrades.electric=Math.min(3,(upgrades.electric||0)+1)},
 {id:'pierce',name:'Lança-abismo',icon:'➶',desc:'Projéteis atravessam até 2 criaturas e causam 15% mais dano.',apply:()=>upgrades.pierce=Math.min(3,(upgrades.pierce||0)+1)},
 {id:'ricochet',name:'Ricochete caótico',icon:'⤴',desc:'O projétil salta visualmente até 2 vezes entre alvos próximos.',apply:()=>upgrades.ricochet=Math.min(3,(upgrades.ricochet||0)+1)},
 {id:'nova',name:'Nova gravitacional',icon:'✹',desc:'A cada 9 segundos, libera uma explosão abissal de longo alcance.',apply:()=>upgrades.nova=Math.min(3,(upgrades.nova||0)+1)}
];
function chooseUpgrade(u){
 if(!u || (upgradeLevels[u.id]||0)>=3)return;
 if(upgradeAutoTimer){clearTimeout(upgradeAutoTimer);upgradeAutoTimer=null;}
 u.apply();upgradeLevels[u.id]=(upgradeLevels[u.id]||0)+1;
 const codex=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');if(!codex.skills.includes(u.id))codex.skills.push(u.id);localStorage.setItem('abyssalCodex',JSON.stringify(codex));
 level++;gameState='playing';$('upgradeScreen').hidden=true;showToast(`${u.name.toUpperCase()} · NÍVEL ${upgradeLevels[u.id]}/3`);audio(660+upgradeLevels[u.id]*100,.18,'triangle',.04);updateHud();last=performance.now();if(onlineMode&&xp>=xpNeed){xp-=xpNeed;xpNeed=Math.floor(xpNeed*1.34+3);setTimeout(()=>{if(gameState==='playing')offerUpgrade()},0)}
}
function offerUpgrade(){
 if(gameState==='upgrade')return;
 gameState='upgrade';chosen=[];upgradeOptions=upgradeList.filter(u=>(upgradeLevels[u.id]||0)<3).sort(()=>Math.random()-.5).slice(0,3);const wrap=$('upgradeChoices');wrap.innerHTML='';
 if(!upgradeOptions.length){gameState='playing';$('upgradeScreen').hidden=true;return}
 // Em coop, a escolha não congela o mundo e concede até 10 s de invulnerabilidade.
 if(onlineMode&&player)player.invuln=Math.max(player.invuln,10);
 upgradeOptions.forEach(u=>{const current=upgradeLevels[u.id]||0;const b=document.createElement('button');b.className='upgrade-card';b.innerHTML=`<span class="upgrade-icon">${u.icon}</span><strong>${u.name} · Nv. ${current+1}/3</strong><p>${u.desc}</p><small class="upgrade-progress">${'◆'.repeat(current)}${'◇'.repeat(3-current)} · ${current===0?'Desbloqueio':`Melhoria ${current} → ${current+1}`}</small>`;b.addEventListener('click',()=>chooseUpgrade(u));wrap.appendChild(b)});
 $('upgradeScreen').hidden=false;audio(330,.16,'sine',.03);
 if(onlineMode){upgradeAutoTimer=setTimeout(()=>{if(gameState==='upgrade'&&upgradeOptions.length){const available=upgradeOptions.filter(u=>(upgradeLevels[u.id]||0)<3);if(available.length)chooseUpgrade(available[Math.floor(Math.random()*available.length)]);else{gameState='playing';$('upgradeScreen').hidden=true}}},10000)}
}
function spawnEnemy(initial=false){
 if(!player)return;let side=Math.floor(Math.random()*4),x,y,pad=30;
 if(side===0){x=rand(0,W);y=-pad}else if(side===1){x=W+pad;y=rand(0,H)}else if(side===2){x=rand(0,W);y=H+pad}else{x=-pad;y=rand(0,H)}
 const bossDue=elapsed>=nextBossAt;if(bossDue)nextBossAt+=Math.max(58,90-elapsed*.025);
 const t=Math.random(),difficulty=1+elapsed/125+Math.pow(elapsed/150,1.32)*.42;
 const bosses=['boss','leviathan','maw','angler'];let kind;if(bossDue){const choices=bosses.filter(k=>k!==lastBossKind);kind=choices[Math.floor(Math.random()*choices.length)];lastBossKind=kind;bossIndex++;}else kind=t<.56?'drifter':t<.78?'stinger':t<.94?'brute':'lurker';
 const bossData={boss:{r:38,hp:2200+difficulty*820,speed:rand(18,24)+elapsed*.012,damage:25,color:'#ff315f',value:55},leviathan:{r:54,hp:3900+difficulty*1250,speed:rand(12,17)+elapsed*.009,damage:34,color:'#4ce0d1',value:90},maw:{r:45,hp:3100+difficulty*1050,speed:rand(21,27)+elapsed*.012,damage:31,color:'#c16cff',value:75},angler:{r:35,hp:2700+difficulty*900,speed:rand(26,33)+elapsed*.014,damage:28,color:'#ffb45e',value:65}};
 const data=bossData[kind]|| (kind==='drifter'?{r:10,hp:22*difficulty,speed:rand(43,59)+elapsed*.07,damage:8,color:'#ff769d',value:1}
 :kind==='stinger'?{r:7,hp:13*difficulty,speed:rand(78,98)+elapsed*.09,damage:6,color:'#ffbc78',value:2}
 :kind==='brute'?{r:16,hp:65*difficulty,speed:rand(25,35)+elapsed*.035,damage:15,color:'#bd88ff',value:4}
 :{r:20,hp:100*difficulty,speed:rand(38,48)+elapsed*.04,damage:18,color:'#6e8dff',value:6});
 enemies.push({id:++enemyId,x,y,...data,maxHp:data.hp,angle:rand(0,6.28),phase:rand(0,6.28),hit:0,attackCd:rand(.3,1),kind});
 const seen=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');if(!seen.monsters.includes(kind)){seen.monsters.push(kind);localStorage.setItem('abyssalCodex',JSON.stringify(seen));}
 if(['boss','leviathan','maw','angler'].includes(kind)){showToast(kind==='leviathan'?'⚠ O LEVIATÃ DAS FOSSAS DESPERTOU':kind==='maw'?'⚠ A BOCA DO ABISMO SE ABRIU':kind==='angler'?'⚠ UMA LANTERNA MORTAL SE APROXIMA':'⚠ UMA PRESENÇA COLOSSAL SE APROXIMA');burst(x,y,data.color,90,280);audio(48,.8,'sawtooth',.08)}
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
function onlineHost(){return !onlineMode || !window.AbyssalOnline || window.AbyssalOnline.isHost();}
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
 if(onlineMode && !onlineHost()){
   window.AbyssalOnline?.sendDamage(enemy.id, damage);
   enemy.hit=.14;
   burst(enemy.x,enemy.y,'#c4b4ff',5,60);
   return;
 }
 enemy.hp-=damage; enemy.hit=.14;
 if(enemy.hp<=0){const idx=enemies.indexOf(enemy);if(idx>=0)killEnemy(idx);}
}
function applySharedSnapshot(data){
 if(!onlineMode||onlineHost()||!data||!Array.isArray(data.enemies))return;
 elapsed=Number(data.elapsed)||elapsed;
 enemies=data.enemies.map(e=>({...e,x:(Number(e.x)||0)*W,y:(Number(e.y)||0)*H,r:(Number(e.r)||.015)*Math.min(W,H)}));
}
function applySharedDamage(data){
 if(!onlineMode||!onlineHost()||!data)return;
 const enemy=enemies.find(e=>e.id===Number(data.id));
 if(enemy)dealEnemyDamage(enemy,Math.min(1000,Number(data.damage)||0));
}
function applySharedXp(data){
 if(!onlineMode||!data||!player)return;
 gainXp(Math.max(0,Number(data.value)||0),'shared');
}
function sendWorldSnapshot(dt){
 if(!onlineMode||!onlineHost()||!window.AbyssalOnline?.sendSnapshot)return;
 snapshotClock-=dt;if(snapshotClock>0)return;snapshotClock=.066;
 window.AbyssalOnline.sendSnapshot({elapsed,enemies:enemies.slice(0,120).map(e=>({id:e.id,x:e.x/W,y:e.y/H,r:e.r/Math.min(W,H),hp:e.hp,maxHp:e.maxHp,speed:e.speed,damage:e.damage,color:e.color,value:e.value,angle:e.angle,phase:e.phase,hit:e.hit,attackCd:e.attackCd,kind:e.kind}))});
}
function killEnemy(i){
 const e=enemies[i];
 const codex=JSON.parse(localStorage.getItem('abyssalCodex')||'{"skills":[],"monsters":[]}');if(!codex.monsters.includes(e.kind))codex.monsters.push(e.kind);localStorage.setItem('abyssalCodex',JSON.stringify(codex));score+=e.value*10;if(onlineMode){if(onlineHost())window.AbyssalOnline?.shareXp(e.value,'kill');}else addOrb(e.x,e.y,e.value);burst(e.x,e.y,e.color,['boss','leviathan','maw','angler'].includes(e.kind)?100:e.kind==='brute'?22:12,['boss','leviathan','maw','angler'].includes(e.kind)?340:e.kind==='brute'?145:95);if(['boss','leviathan','maw','angler'].includes(e.kind)){score+=1400;coins+=250;showToast('BOSS ABISSAL DERROTADO · +250 MOEDAS');saveCosmetics();}enemies.splice(i,1);audio(e.kind==='brute'?160:260,.055,'triangle',.012);
}
function fire(){
 if(!player)return;let target=null,bd=Infinity;const maxRange=210*upgrades.range;
 for(const e of enemies){const d=dist(player,e);if(d<maxRange&&d<bd){target=e;bd=d}}
 if(!target)return;
 const a=Math.atan2(target.y-player.y,target.x-player.x);
 projectiles.push({x:player.x+Math.cos(a)*13,y:player.y+Math.sin(a)*13,vx:Math.cos(a)*430,vy:Math.sin(a)*430,r:4.1,life:.95,damage:9.5*upgrades.power,color:upgrades.ricochet>0?'#ffc47a':upgrades.electric>0?'#eaffff':upgrades.pierce>0?'#ffe7a1':'#83fff3',special:upgrades.pierce>0?'pierce':upgrades.electric>0?'electric':upgrades.ricochet>0?'ricochet':null});
 if(onlineMode&&window.AbyssalOnline?.sendShot)window.AbyssalOnline.sendShot({x:(player.x+Math.cos(a)*13)/W,y:(player.y+Math.sin(a)*13)/H,vx:Math.cos(a)*430/W,vy:Math.sin(a)*430/H,color:upgrades.ricochet>0?'#ffc47a':upgrades.electric>0?'#eaffff':upgrades.pierce>0?'#ffe7a1':'#83fff3',special:upgrades.pierce>0?'pierce':upgrades.electric>0?'electric':upgrades.ricochet>0?'ricochet':null});
 player.angle=a;const muzzleX=player.x+Math.cos(a)*15,muzzleY=player.y+Math.sin(a)*15;burst(muzzleX,muzzleY,upgrades.ricochet>0?'#ffc47a':upgrades.electric>0?'#eaffff':upgrades.pierce>0?'#ffe7a1':'#9afff7',upgrades.ricochet>0||upgrades.electric>0?9:5,upgrades.ricochet>0||upgrades.electric>0?90:45);if(upgrades.electric>0)effects.push({type:'beam',x1:player.x,y1:player.y,x2:muzzleX+Math.cos(a)*30,y2:muzzleY+Math.sin(a)*30,life:.16,maxLife:.16,color:'#eaffff'});audio(500,.045,'sine',.008);
}
// Online firing uses a separate heartbeat so background-tab animation throttling
// does not silently disable the living player's automatic weapon.
let onlineAutofireHeartbeat = null;
function ensureOnlineAutofireHeartbeat(){
 if(onlineAutofireHeartbeat!==null)return;
 onlineAutofireHeartbeat=setInterval(()=>{
   if(onlineMode && gameState==='playing' && player && hp>0){
     try{fire();}catch(err){console.warn('Online autofire heartbeat:',err);}
   }
 }, 380);
}
ensureOnlineAutofireHeartbeat();
function update(dt){
 if((gameState!=='playing'&&!(onlineMode&&gameState==='upgrade'))||!player)return;
 // Movimento local responsivo: teclado e toque/arraste. No online, trocar de aba nunca pausa o estado local intencionalmente.
 if(gameState==='playing'){
   let mx=(keys['d']||keys['D']||keys['ArrowRight']?1:0)-(keys['a']||keys['A']||keys['ArrowLeft']?1:0);
   let my=(keys['s']||keys['S']||keys['ArrowDown']?1:0)-(keys['w']||keys['W']||keys['ArrowUp']?1:0);
   if(pointer.down){const dx=pointer.x-player.x,dy=pointer.y-player.y,dd=Math.hypot(dx,dy);if(dd>12){mx=dx/dd;my=dy/dd}else{mx=0;my=0}}
   const mag=Math.hypot(mx,my)||1; if(mx||my){player.x=(player.x+mx/mag*player.moveSpeed*upgrades.speed*dt+W)%W;player.y=(player.y+my/mag*player.moveSpeed*upgrades.speed*dt+H)%H;player.angle=Math.atan2(my,mx);player.trail.push({x:player.x,y:player.y,life:.28});if(player.trail.length>12)player.trail.shift()}
   if(!onlineMode){player.fireTimer=(player.fireTimer||0)-dt;if(player.fireTimer<=0){fire();player.fireTimer=Math.max(.16,.52/(upgrades.rate||1))}}
 }
 elapsed+=dt;spawnTimer-=dt;player.invuln=Math.max(0,player.invuln-dt);damageFlash=Math.max(0,damageFlash-dt);shake=Math.max(0,shake-dt*22);
 if(spawnTimer<=0 && onlineHost()){spawnEnemy();spawnTimer=Math.max(.22,1.05-elapsed*.0045)}
 if(upgrades.regen>0&&Math.random()<dt*upgrades.regen*.25)hp=Math.min(maxHp,hp+1);
 if(upgrades.burst>0){player.burstTimer=(player.burstTimer||0)-dt;if(player.burstTimer<=0){player.burstTimer=Math.max(3.5,7/upgrades.burst);for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<210*upgrades.range){dealEnemyDamage(e,12*upgrades.burst);burst(e.x,e.y,'#b4a1ff',8,100)}}burst(player.x,player.y,'#b3a0ff',60,260);effects.push({type:'ring',x:player.x,y:player.y,r:0,max:210*upgrades.range,life:.55,maxLife:.55,color:'#b3a0ff'});audio(180,.2,'triangle',.05)}}
 if(upgrades.nova>0){player.novaTimer=(player.novaTimer||0)-dt;if(player.novaTimer<=0){player.novaTimer=Math.max(4.5,9/upgrades.nova);for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(dist(player,e)<210*upgrades.range){dealEnemyDamage(e,18*upgrades.nova);burst(e.x,e.y,'#72f5ff',12,130)}}burst(player.x,player.y,'#72f5ff',85,300);effects.push({type:'ring',x:player.x,y:player.y,r:0,max:210*upgrades.range,life:.75,maxLife:.75,color:'#72f5ff'});audio(120,.38,'sawtooth',.045)}}
 // Aliado IA: atua como um segundo jogador, deslocando-se por conta própria e disparando projéteis visíveis.
 const humanPeers=onlineMode&&window.AbyssalOnline?window.AbyssalOnline.getPlayers():[];
 for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];e.hit=Math.max(0,e.hit-dt);let targets=[{x:player.x,y:player.y,local:true}];if(onlineMode&&window.AbyssalOnline){for(const peer of window.AbyssalOnline.getPlayers()){targets.push({x:(Number(peer.x)||0)*W,y:(Number(peer.y)||0)*H,local:false,id:peer.id})}}let target=targets[0],td=Infinity;for(const candidate of targets){const dd=Math.hypot(wrappedDelta(e.x,candidate.x,W),wrappedDelta(e.y,candidate.y,H));if(dd<td){td=dd;target=candidate}}const dx=wrappedDelta(e.x,target.x,W)*-1,dy=wrappedDelta(e.y,target.y,H)*-1,d=Math.hypot(dx,dy)||1;if(onlineHost()){e.phase+=dt*(e.kind==='stinger'?7:3);e.angle=Math.atan2(dy,dx);e.x=(e.x+dx/d*e.speed*dt+W)%W;e.y=(e.y+dy/d*e.speed*dt+H)%H;}if(target.local&&td<e.r+player.r){e.attackCd-=dt;if(e.attackCd<=0){hurtPlayer(e.damage);e.attackCd=e.kind==='stinger'?.8:1.1;if(onlineHost()){e.x=(e.x-dx/d*10+W)%W;e.y=(e.y-dy/d*10+H)%H;}}}}
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;let hit=false;for(let j=enemies.length-1;j>=0;j--){const e=enemies[j];if(Math.hypot(p.x-e.x,p.y-e.y)<p.r+e.r){dealEnemyDamage(e,p.damage*(1+(upgrades.pierce||0)*.18));e.hit=.12;burst(p.x,p.y,p.color,4,40);
 if((upgrades.electric||0)>0){let chains=0,from=e;const visited=new Set([e.id]);while(chains<Math.min(3,upgrades.electric)){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(!visited.has(other.id)&&d<120&&d<nd){next=other;nd=d}}if(!next)break;effects.push({type:'beam',x1:from.x,y1:from.y,x2:next.x,y2:next.y,life:.24,maxLife:.24,color:'#79f3ff'});burst(from.x,from.y,'#e6ffff',4,70);burst(next.x,next.y,'#79f3ff',12,120);dealEnemyDamage(next,p.damage*(.28+upgrades.electric*.08));next.hit=.12;burst(next.x,next.y,'#79f3ff',10,95);visited.add(next.id);from=next;chains++;}}
 if((upgrades.ricochet||0)>0){let from=e;const visited=new Set([e.id]);for(let bounce=0;bounce<Math.min(2,upgrades.ricochet);bounce++){let next=null,nd=Infinity;for(const other of enemies){const d=dist(from,other);if(!visited.has(other.id)&&d<190&&d<nd){next=other;nd=d}}if(!next)break;effects.push({type:'beam',x1:from.x,y1:from.y,x2:next.x,y2:next.y,life:.28,maxLife:.28,color:'#ffc47a'});burst(from.x,from.y,'#fff0c7',4,65);burst(next.x,next.y,'#ffc47a',14,135);dealEnemyDamage(next,p.damage*.42);next.hit=.15;burst(next.x,next.y,'#ffc47a',14,125);visited.add(next.id);from=next;}}
 hit=!(upgrades.pierce>0);if(hit)break}}p.x=(p.x+W)%W;p.y=(p.y+H)%H;if(hit||p.life<=0)projectiles.splice(i,1)}
 for(let i=orbs.length-1;i>=0;i--){if(onlineMode)break;const o=orbs[i];o.phase+=dt*3;o.life-=dt;const d=Math.hypot(player.x-o.x,player.y-o.y);if(d<100*upgrades.magnet){const f=clamp((100*upgrades.magnet-d)/100,0,1);o.x+=(player.x-o.x)*dt*(2+f*8);o.y+=(player.y-o.y)*dt*(2+f*8)}if(d<player.r+o.r+4){xp+=o.value;score+=o.value*3;burst(o.x,o.y,'#9f91ff',5,55);orbs.splice(i,1);audio(700+Math.random()*180,.06,'sine',.012);if(xp>=xpNeed){xp-=xpNeed;xpNeed=Math.floor(xpNeed*1.34+3);offerUpgrade();break}}else if(o.life<=0)orbs.splice(i,1)}
 for(let i=effects.length-1;i>=0;i--){effects[i].life-=dt;if(effects[i].life<=0)effects.splice(i,1)}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.05,dt);p.vy*=Math.pow(.05,dt);p.life-=dt;if(p.life<=0)particles.splice(i,1)}
 if(onlineMode&&window.AbyssalOnline){window.AbyssalOnline.sendPosition({x:player.x/W,y:player.y/H,angle:player.angle});sendWorldSnapshot(dt);}
 updateHud();
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
function drawCreature(x,y,r,angle,color,kind,t,playerCreature=false,hit=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);
 const wobble=Math.sin(t*.004+(x+y)*.01);
 // tentacles
 const skin=(playerCreature?(skinData.find(s=>s.id===equippedSkin)||skinData[0]):null);const n=playerCreature?6:(['boss','leviathan','maw','angler'].includes(kind)?(kind==='leviathan'?22:kind==='maw'?18:14):kind==='brute'?7:4);
 for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2;ctx.save();ctx.rotate(a);const len=r*(playerCreature?1.45:(['boss','leviathan','maw','angler'].includes(kind)?(kind==='leviathan'?2.25:kind==='maw'?1.95:1.75):kind==='brute'?1.15:1.05));ctx.beginPath();ctx.moveTo(r*.55,0);ctx.bezierCurveTo(len*.5,Math.sin(t*.004+i*2)*r*.6,len*.8,Math.cos(t*.003+i)*r*.55,len+wobble*r*.2,Math.sin(t*.004+i)*r*.75);ctx.strokeStyle=color;ctx.lineWidth=Math.max(1.2,r*.12);ctx.lineCap='round';ctx.shadowBlur=playerCreature?14:8;ctx.shadowColor=color;ctx.stroke();ctx.restore()}
 const grad=ctx.createRadialGradient(-r*.3,-r*.35,1,0,0,r*1.2);grad.addColorStop(0,playerCreature?'#e5ffff':'#ffd5e1');grad.addColorStop(.22,hit>0?'#ffffff':color);grad.addColorStop(.72,playerCreature?'#176a85':'#532c64');grad.addColorStop(1,'#091629');
 ctx.fillStyle=grad;ctx.shadowBlur=playerCreature?22:16;ctx.shadowColor=color;ctx.beginPath();
 let bodyX=1+wobble*.04,bodyY=.9-wobble*.03;
 if(kind==='leviathan'||(playerCreature&&skin?.shape==='leviathan')){bodyX=1.42;bodyY=.62}
 if(kind==='maw'){bodyX=1.12;bodyY=1.05}
 if(kind==='angler'){bodyX=1.02;bodyY=.92}
 if(playerCreature && skin?.shape==='horns'){
   ctx.save();ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,r*.16);ctx.lineCap='round';ctx.shadowBlur=18;ctx.shadowColor=color;
   ctx.beginPath();ctx.moveTo(-r*.42,-r*.48);ctx.bezierCurveTo(-r*.95,-r*1.05,-r*.88,-r*1.32,-r*.62,-r*1.38);
   ctx.moveTo(r*.42,-r*.48);ctx.bezierCurveTo(r*.95,-r*1.05,r*.88,-r*1.32,r*.62,-r*1.38);ctx.stroke();ctx.restore();
 }
 if(playerCreature && skin?.shape==='halo'){
   ctx.save();ctx.rotate(Math.sin(t*.0015)*.08);ctx.strokeStyle='#fff0b8';ctx.lineWidth=Math.max(2,r*.10);ctx.shadowBlur=22;ctx.shadowColor='#fff0b8';
   ctx.beginPath();ctx.ellipse(0,-r*1.02,r*.62,r*.19,0,0,Math.PI*2);ctx.stroke();
   for(let k=0;k<8;k++){const a=k*Math.PI/4;ctx.fillStyle='#fff9d8';ctx.beginPath();ctx.arc(Math.cos(a)*r*.62,-r*1.02+Math.sin(a)*r*.19,Math.max(1.2,r*.045),0,Math.PI*2);ctx.fill()}ctx.restore();
 }
 if(playerCreature&&skin?.shape==='king'){bodyX=1.12;bodyY=1.02}
 ctx.ellipse(0,0,r*bodyX,r*bodyY,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 // Unique silhouette details: maw, angler lure, and the king's crown are visibly different.
 if(kind==='maw'){
   ctx.save();ctx.rotate(Math.sin(t*.001)*.05);ctx.fillStyle='#100714';ctx.strokeStyle='#ff557f';ctx.lineWidth=Math.max(2,r*.09);ctx.shadowBlur=18;ctx.shadowColor='#ff315f';ctx.beginPath();ctx.ellipse(r*.32,0,r*.48,r*.58,0,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.fillStyle='#fff0d9';for(let tooth=0;tooth<9;tooth++){const a=tooth/9*Math.PI*2;const tx=r*.32+Math.cos(a)*r*.38,ty=Math.sin(a)*r*.47;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx-Math.cos(a)*r*.12,ty-Math.sin(a)*r*.12);ctx.lineTo(tx+Math.cos(a+1.1)*r*.05,ty+Math.sin(a+1.1)*r*.05);ctx.closePath();ctx.fill()}ctx.restore();
 }
 if(kind==='leviathan'){
   ctx.save();ctx.fillStyle='#4ce0d1';ctx.strokeStyle='#c5fff8';ctx.shadowBlur=20;ctx.shadowColor='#4ce0d1';ctx.lineWidth=Math.max(2,r*.07);for(let fin=0;fin<7;fin++){const fx=-r*.65+fin*r*.22;ctx.beginPath();ctx.moveTo(fx,-r*.35);ctx.quadraticCurveTo(fx-r*.12,-r*1.0,fx+r*.18,-r*.82);ctx.lineTo(fx+r*.16,-r*.28);ctx.closePath();ctx.fill();ctx.stroke()}ctx.restore();
 }
 if(kind==='boss'){
   ctx.save();ctx.strokeStyle='#ff315f';ctx.fillStyle='#ff315f';ctx.shadowBlur=25;ctx.shadowColor='#ff315f';ctx.lineWidth=Math.max(2,r*.1);ctx.beginPath();ctx.moveTo(-r*.55,-r*.6);ctx.lineTo(-r*.8,-r*1.55);ctx.lineTo(-r*.18,-r*.95);ctx.lineTo(r*.05,-r*1.75);ctx.lineTo(r*.35,-r*.95);ctx.lineTo(r*.85,-r*1.4);ctx.lineTo(r*.62,-r*.48);ctx.stroke();ctx.restore();
 }
 if(kind==='angler'){
   ctx.save();ctx.strokeStyle='#ffbd72';ctx.lineWidth=Math.max(2,r*.09);ctx.shadowBlur=16;ctx.shadowColor='#ff9c55';ctx.beginPath();ctx.moveTo(r*.05,-r*.55);ctx.quadraticCurveTo(r*.35,-r*1.25,r*.72,-r*1.05);ctx.stroke();ctx.fillStyle='#fff1b0';ctx.beginPath();ctx.arc(r*.74,-r*1.05,r*.17*(1+Math.sin(t*.01)*.12),0,Math.PI*2);ctx.fill();ctx.restore();
 }
 if(playerCreature && skin?.shape==='horns'){
   ctx.save();ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,r*.16);ctx.lineCap='round';ctx.shadowBlur=18;ctx.shadowColor=color;
   ctx.beginPath();ctx.moveTo(-r*.42,-r*.48);ctx.bezierCurveTo(-r*.95,-r*1.05,-r*.88,-r*1.32,-r*.62,-r*1.38);
   ctx.moveTo(r*.42,-r*.48);ctx.bezierCurveTo(r*.95,-r*1.05,r*.88,-r*1.32,r*.62,-r*1.38);ctx.stroke();ctx.restore();
 }
 if(playerCreature && skin?.shape==='halo'){
   ctx.save();ctx.rotate(Math.sin(t*.0015)*.08);ctx.strokeStyle='#fff0b8';ctx.lineWidth=Math.max(2,r*.10);ctx.shadowBlur=22;ctx.shadowColor='#fff0b8';
   ctx.beginPath();ctx.ellipse(0,-r*1.02,r*.62,r*.19,0,0,Math.PI*2);ctx.stroke();
   for(let k=0;k<8;k++){const a=k*Math.PI/4;ctx.fillStyle='#fff9d8';ctx.beginPath();ctx.arc(Math.cos(a)*r*.62,-r*1.02+Math.sin(a)*r*.19,Math.max(1.2,r*.045),0,Math.PI*2);ctx.fill()}ctx.restore();
 }
 if(playerCreature&&skin?.shape==='king'){
   ctx.save();ctx.fillStyle='#d6c7ff';ctx.strokeStyle='#8b7cff';ctx.lineWidth=2;ctx.shadowBlur=18;ctx.shadowColor='#8b7cff';ctx.beginPath();ctx.moveTo(-r*.55,-r*.55);ctx.lineTo(-r*.48,-r*1.15);ctx.lineTo(-r*.12,-r*.78);ctx.lineTo(r*.05,-r*1.3);ctx.lineTo(r*.28,-r*.76);ctx.lineTo(r*.62,-r*1.08);ctx.lineTo(r*.55,-r*.45);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 }

 if(kind==='leviathan'){
   // Pale skeletal crown resembling a skull emerging from the head.
   ctx.save();ctx.translate(-r*.08,-r*.18);ctx.shadowBlur=20;ctx.shadowColor='#f5ffff';ctx.strokeStyle='#f4ffff';ctx.fillStyle='rgba(225,250,255,.82)';ctx.lineWidth=Math.max(2,r*.055);
   ctx.beginPath();ctx.ellipse(0,-r*.53,r*.48,r*.34,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#07131d';ctx.beginPath();ctx.ellipse(-r*.18,-r*.54,r*.10,r*.13,0,0,Math.PI*2);ctx.ellipse(r*.18,-r*.54,r*.10,r*.13,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#eaffff';ctx.beginPath();ctx.moveTo(-r*.24,-r*.27);ctx.lineTo(-r*.2,-r*.12);ctx.lineTo(-r*.1,-r*.25);ctx.lineTo(0,-r*.1);ctx.lineTo(r*.1,-r*.25);ctx.lineTo(r*.2,-r*.12);ctx.lineTo(r*.24,-r*.27);ctx.stroke();ctx.restore();
 }
 if(kind==='angler'){
   // Long luminous lure and sharp jaw teeth.
   ctx.save();ctx.strokeStyle='#fff2a8';ctx.lineWidth=Math.max(2,r*.07);ctx.shadowBlur=26;ctx.shadowColor='#ffb84e';ctx.beginPath();ctx.moveTo(r*.05,-r*.45);ctx.bezierCurveTo(r*.1,-r*1.1,r*.55,-r*1.65,r*.8,-r*1.45);ctx.stroke();ctx.fillStyle='#fffbd2';ctx.beginPath();ctx.arc(r*.82,-r*1.46,r*.2*(1+Math.sin(t*.012)*.12),0,Math.PI*2);ctx.fill();ctx.fillStyle='#faffdf';ctx.beginPath();ctx.ellipse(r*.55,r*.15,r*.38,r*.22,0,0,Math.PI*2);ctx.fill();for(let tooth=0;tooth<7;tooth++){const tx=r*.28+tooth*r*.09;ctx.beginPath();ctx.moveTo(tx,r*.02);ctx.lineTo(tx+r*.035,r*.17);ctx.lineTo(tx+r*.07,r*.03);ctx.fill()}ctx.restore();
 }
 if(kind==='maw'){
   // Oversized abyssal maw with a second ring of teeth and long tendrils.
   ctx.save();ctx.translate(r*.35,0);ctx.shadowBlur=26;ctx.shadowColor='#ff3c88';ctx.fillStyle='#03030b';ctx.strokeStyle='#ff5c9d';ctx.lineWidth=Math.max(2,r*.08);ctx.beginPath();ctx.ellipse(0,0,r*.62,r*.72,0,0,Math.PI*2);ctx.fill();ctx.stroke();for(let row=0;row<2;row++){const count=row?13:11;for(let tooth=0;tooth<count;tooth++){const a=tooth/count*Math.PI*2;const rr=row?r*.52:r*.43;const tx=Math.cos(a)*rr,ty=Math.sin(a)*rr;ctx.fillStyle=row?'#b9faff':'#fff4df';ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx-Math.cos(a)*r*.2,ty-Math.sin(a)*r*.2);ctx.lineTo(tx+Math.cos(a+1.15)*r*.08,ty+Math.sin(a+1.15)*r*.08);ctx.closePath();ctx.fill()}}ctx.restore();
 }
 if(kind==='boss'){
   // Tall, branching horns with bony ridges.
   ctx.save();ctx.strokeStyle='#ff476d';ctx.shadowBlur=28;ctx.shadowColor='#ff174d';ctx.lineWidth=Math.max(3,r*.12);for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*r*.28,-r*.45);ctx.bezierCurveTo(side*r*.55,-r*.9,side*r*.95,-r*1.9,side*r*1.18,-r*1.55);ctx.bezierCurveTo(side*r*1.28,-r*1.35,side*r*.92,-r*1.2,side*r*.82,-r*.75);ctx.stroke();ctx.beginPath();ctx.moveTo(side*r*.48,-r*.62);ctx.lineTo(side*r*.75,-r*1.18);ctx.stroke()}ctx.restore();
 }

 // eyes face forward
 ctx.rotate(0);const eyeY=-r*.05,eyeX=r*.27;ctx.fillStyle='#04111b';ctx.beginPath();ctx.ellipse(eyeX,-r*.12,r*.12,r*.19,0,0,Math.PI*2);ctx.ellipse(eyeX,r*.19,r*.12,r*.16,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=playerCreature?'#d5ffff':'#ffe4b9';ctx.beginPath();ctx.arc(eyeX+r*.025,-r*.15,r*.045,0,Math.PI*2);ctx.fill();
 if((playerCreature&&['horns','king','spikes'].includes(skin?.shape))||['boss','leviathan','maw','angler'].includes(kind)){ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.shadowBlur=22;ctx.shadowColor=color;ctx.lineWidth=Math.max(2,r*.12);for(let h=0;h<(['boss','leviathan','maw','angler'].includes(kind)?(kind==='leviathan'?8:kind==='maw'?3:5):skin?.shape==='king'?4:2);h++){const side=h%2===0?-1:1,baseX=['boss','leviathan','maw','angler'].includes(kind)?r*.25:0,baseY=side*r*.45;ctx.beginPath();ctx.moveTo(baseX,baseY);ctx.quadraticCurveTo(baseX+side*r*.8,baseY-side*r*.9,baseX+side*r*(kind==='leviathan'?2.1:['boss','maw','angler'].includes(kind)?1.7:1.2),baseY-side*r*(kind==='leviathan'?1.9:['boss','maw','angler'].includes(kind)?1.4:.95));ctx.stroke()}ctx.restore()}
 if(['boss','leviathan','maw','angler'].includes(kind)){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.shadowBlur=20;ctx.shadowColor='#ff315f';ctx.beginPath();ctx.arc(0,0,r*(kind==='leviathan'?1.8:1.5),t*.001,t*.001+Math.PI*1.7);ctx.stroke();ctx.fillStyle='#fff0f5';ctx.beginPath();ctx.arc(r*.3,-r*.15,r*.1,0,Math.PI*2);ctx.arc(r*.3,r*.2,r*.1,0,Math.PI*2);ctx.fill()}
 if(playerCreature){
   if(skin?.shape==='spikes'){
     ctx.save();ctx.fillStyle='#fff0b5';ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.shadowBlur=14;ctx.shadowColor=color;
     for(let k=0;k<7;k++){const a=-Math.PI*.85+k*(Math.PI*1.7/6);ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.72,Math.sin(a)*r*.72);ctx.lineTo(Math.cos(a)*r*1.42,Math.sin(a)*r*1.42);ctx.lineTo(Math.cos(a+.16)*r*.65,Math.sin(a+.16)*r*.65);ctx.closePath();ctx.fill();ctx.stroke()}ctx.restore();
   }
   if(skin?.shape==='horns'){
     ctx.save();ctx.strokeStyle='#f2e5ff';ctx.lineWidth=Math.max(2,r*.15);ctx.shadowBlur=18;ctx.shadowColor=color;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*r*.32,-r*.5);ctx.bezierCurveTo(side*r*.6,-r*1.05,side*r*1.12,-r*1.15,side*r*1.02,-r*1.52);ctx.stroke()}ctx.restore();
   }
   if(skin?.shape==='tentacles'){
     ctx.save();ctx.strokeStyle='#e2ffae';ctx.lineWidth=Math.max(2,r*.08);ctx.shadowBlur=16;ctx.shadowColor=color;for(let k=0;k<4;k++){const side=k%2?1:-1,yy=(k-1.5)*r*.28;ctx.beginPath();ctx.moveTo(side*r*.55,yy);ctx.bezierCurveTo(side*r*1.1,yy-r*.2,side*r*1.5,yy+r*.35,side*r*1.85,yy-r*.15);ctx.stroke();ctx.fillStyle='#fff4a8';ctx.beginPath();ctx.arc(side*r*1.85,yy-r*.15,r*.055,0,Math.PI*2);ctx.fill()}ctx.restore();
   }
   ctx.strokeStyle='rgba(179,255,248,.7)';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(0,0,r*1.38,-.7,.7);ctx.stroke();if(upgrades.shield>0){ctx.strokeStyle='rgba(129,239,255,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*1.8,t*.001,t*.001+Math.PI*1.6);ctx.stroke()}}
 ctx.restore();
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
   peers.forEach(peer=>{const px=peer.x*W,py=peer.y*H;drawCreature(px,py,12,peer.angle||0,peer.color||'#b8a4ff','peer',t,true);ctx.fillStyle='#d8ffff';ctx.font='10px Manrope';ctx.textAlign='center';ctx.fillText(peer.nickname||'Mergulhador',px,py-22)});
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
window.addEventListener('keydown',e=>{keys[e.key]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='Escape'||e.key==='p'||e.key==='P'){if(gameState==='playing')pauseGame();else if(gameState==='paused')resumeGame()}});
window.addEventListener('keyup',e=>keys[e.key]=false);
$('playBtn').addEventListener('click',()=>{onlineMode=false;startGame()});$('againBtn').addEventListener('click',()=>{if(onlineMode){window.AbyssalOnline?.joinWorld()}startGame()});$('menuBtn').addEventListener('click',()=>{gameState='menu';$('gameOverScreen').hidden=true;$('menuScreen').hidden=false;$('pauseBtn').hidden=true});
$('pauseBtn').addEventListener('click',pauseGame);$('resumeBtn').addEventListener('click',resumeGame);$('quitBtn').addEventListener('click',()=>{if(onlineMode)window.AbyssalOnline?.leaveWorld();onlineMode=false;gameState='menu';$('pauseScreen').hidden=true;$('hud').hidden=true;$('menuScreen').hidden=false;$('pauseBtn').hidden=true});
$('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'♫':'♪';$('soundBtn').style.color=soundOn?'':'#617783';if(soundOn){startAmbientMusic();audio(580,.08,'sine',.025)}else stopAmbientMusic()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(gameState==='playing'&&!onlineMode)pauseGame();if(onlineMode&&onlineHost())window.AbyssalOnline?.requestHostTransfer()}else{last=performance.now()}});
window.addEventListener('resize',resize);
window.addEventListener('abyssal-remote-shot',ev=>{const d=ev.detail;if(!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;
 const col=d.color||'#9bbcff',special=d.special||null;
 projectiles.push({x:d.x*W,y:d.y*H,vx:(d.vx||0)*W,vy:(d.vy||0)*H,r:special==='pierce'?6.5:special==='electric'?5.8:5.2,life:1.05,damage:0,color:col,special,allyShot:true,remoteVisual:true,trailLife:.16});
 burst(d.x*W,d.y*H,col,5,75);
 if(projectiles.length>350)projectiles.splice(0,projectiles.length-350);
});
window.AbyssalGameHooks={
 skinColor:()=>currentSkinColor(),
 toast:message=>showToast(message),
 remoteHit:data=>{if(!player)return;const tx=data.x*W,ty=data.y*H;let nearest=null,bd=Infinity;for(const e of enemies){const d=Math.hypot(e.x-tx,e.y-ty);if(d<bd){bd=d;nearest=e}}if(nearest&&bd<100){effects.push({type:'beam',x1:tx,y1:ty,x2:nearest.x,y2:nearest.y,life:.14,maxLife:.14,color:'#bba8ff'});burst(nearest.x,nearest.y,'#bba8ff',5,60);}},
 applySnapshot:applySharedSnapshot,
 restoreHostState:data=>{if(!data||!Array.isArray(data.enemies))return;elapsed=Number(data.elapsed)||elapsed;enemies=data.enemies.map(e=>({...e,x:(Number(e.x)||0)*W,y:(Number(e.y)||0)*H,r:(Number(e.r)||.015)*Math.min(W,H)}));},
 sharedDamage:applySharedDamage,
 sharedXp:applySharedXp,
};
function renderShop(){
 $('coinBalance').textContent=coins.toLocaleString('pt-BR');const grid=$('skinGrid');if(!grid)return;grid.innerHTML='';
 skinData.forEach(skin=>{const owned=ownedSkins.includes(skin.id),equipped=equippedSkin===skin.id;const card=document.createElement('div');card.className='skin-card'+(equipped?' equipped':'');card.innerHTML=`<div class="skin-preview"><div class="skin-orb" style="color:${skin.color};background:radial-gradient(circle at 32% 28%,#ffffff,${skin.color} 28%,#183347 80%)"></div></div><strong>${skin.name}</strong><p>${skin.desc}</p><button ${skin.paid?'disabled':''}>${equipped?'EQUIPADA':owned?'EQUIPAR':skin.paid?'EM BREVE · PREMIUM':`COMPRAR · ${skin.price} ◈`}</button>`;const btn=card.querySelector('button');if(!skin.paid&&!equipped)btn.addEventListener('click',()=>{if(owned){equippedSkin=skin.id;saveCosmetics();renderShop();showToast('SKIN EQUIPADA')}else if(window.AbyssalOnline?.isAuthenticated()){window.AbyssalOnline.purchaseSkin(skin.id)}else if(coins>=skin.price){coins-=skin.price;ownedSkins.push(skin.id);equippedSkin=skin.id;saveCosmetics();renderShop();showToast('SKIN DESBLOQUEADA');audio(760,.12,'triangle',.03)}else showToast('ESSÊNCIA INSUFICIENTE');});grid.appendChild(card)});
}
$('shopBtn').addEventListener('click',()=>{$('shopScreen').hidden=false;renderShop()});
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
 const monsterSvg=(k,c)=>{const tentacles=k==='leviathan'||k==='maw'?8:k==='boss'?6:k==='angler'?4:3;const spikes=k==='boss'||k==='brute'||k==='angler';let paths='';for(let i=0;i<tentacles;i++){let side=i%2?1:-1,y=-18+i*6;paths+=`<path d="M ${side*14} ${y} Q ${side*32} ${y-18} ${side*(34+(i%3)*5)} ${y+12}" fill="none" stroke="${c}" stroke-width="${k==='leviathan'?4:2.5}" stroke-linecap="round"/><circle cx="${side*(34+(i%3)*5)}" cy="${y+12}" r="2.5" fill="#e8ffff"/>`}let horns=spikes?`<path d="M-15 -20 L-25 -43 L-8 -29 L0 -49 L8 -29 L25 -43 L15 -20" fill="${c}" stroke="#fff0f5" stroke-width="1.5"/>`:'';let mouth=k==='maw'?'<ellipse cx="7" cy="2" rx="12" ry="15" fill="#160d27" stroke="#ffe9ff" stroke-width="2"/><path d="M-2 -9 L2 -3 L6 -10 L10 -2 L15 -8 M-2 9 L2 4 L6 11 L10 4 L15 9" fill="#fff1ff"/>':'<ellipse cx="7" cy="-2" rx="4" ry="6" fill="#07121d"/><ellipse cx="7" cy="-2" rx="1.5" ry="3" fill="#fff4d7"/>';let lure=k==='angler'?'<path d="M2 -18 Q 10 -38 25 -34" fill="none" stroke="#ffbd72" stroke-width="3"/><circle cx="27" cy="-35" r="5" fill="#fff5b2" stroke="#ff9c55" stroke-width="2"/>':'';return `<svg viewBox="-55 -55 110 110" role="img" aria-label="Ilustração de ${k}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g${k}"><stop stop-color="#f4ffff"/><stop offset=".25" stop-color="${c}"/><stop offset="1" stop-color="#101a34"/></radialGradient></defs><circle r="43" fill="#071622" stroke="${c}" stroke-opacity=".35"/>${paths}${horns}<path d="M-22 -7 Q-27 -24 -8 -28 Q15 -30 24 -9 Q30 10 12 23 Q-8 33 -23 12 Z" fill="url(#g${k})" stroke="${c}" stroke-width="2.5"/>${mouth}${lure}<circle cx="-8" cy="-9" r="3" fill="#f2ffff" opacity=".85"/><circle cx="17" cy="12" r="2" fill="#fff" opacity=".8"/></svg>`};
 const skillCopy={power:'Aumenta o dano causado por cada projétil.',rate:'Reduz o intervalo entre disparos automáticos.',speed:'Aumenta a velocidade de movimento do jogador.',range:'Amplia a distância máxima em que os inimigos podem ser escolhidos como alvo e alcançados pelas ondas.',magnet:'Atrai fragmentos de experiência de uma distância maior no modo solo.',regen:'Recupera vida gradualmente ao longo da partida.',shield:'Adiciona cargas de escudo que absorvem impactos antes de reduzir a vitalidade.',burst:'Libera periodicamente uma onda de energia ao redor do jogador, causando dano aos inimigos próximos.',electric:'Faz os disparos saltarem em raios visíveis entre inimigos próximos, causando dano adicional em cada salto.',pierce:'Permite que os projéteis atravessem inimigos em vez de desaparecerem no primeiro impacto e aumenta o dano do disparo.',ricochet:'Cria arcos luminosos que saltam do alvo atingido para criaturas próximas, causando dano secundário.',nova:'Dispara periodicamente uma explosão circular de grande alcance que causa dano aos inimigos dentro da área.'};
 grid.innerHTML='<h3 class="codex-heading">✦ HABILIDADES DESCOBERTAS</h3><div class="codex-grid">'+upgradeList.map(u=>{const known=codex.skills.includes(u.id);return `<article class="codex-card ${known?'unlocked':'locked'}"><div class="codex-preview skill-preview" style="--preview:${known?'#9cecff':'#263747'}">${known?u.icon:'?'}</div><b>${known?u.name:'Ressonância desconhecida'}</b><p>${known?(skillCopy[u.id]||u.desc):'Descubra esta habilidade durante um mergulho para revelar seus efeitos.'}</p></article>`}).join('')+'</div><h3 class="codex-heading">◈ CRIATURAS ENCONTRADAS</h3><div class="codex-grid">'+Object.entries(monsterData).map(([k,m])=>{const known=codex.monsters.includes(k);return `<article class="codex-card ${known?'unlocked':'locked'}"><div class="codex-preview monster-preview" style="--preview:${known?m.color:'#263747'}">${known?monsterSvg(k,m.color):'?'}</div><b>${known?m.name:'Criatura desconhecida'}</b><p>${known?m.desc:'Silhueta e dados ocultos. Encontre esta criatura durante uma expedição para catalogá-la.'}</p></article>`}).join('')+'</div>';
}

$('shopCloseBtn').addEventListener('click',()=>{$('shopScreen').hidden=true});
$('loginBtn').addEventListener('click',()=>{if(window.AbyssalOnline)window.AbyssalOnline.openLogin()});
$('onlineBtn').addEventListener('click',()=>{startAmbientMusic();onlineMode=true;if(window.AbyssalOnline)window.AbyssalOnline.connectAndJoin();if(window.AbyssalOnline?.isAuthenticated()){startGame();showToast('MODO COOPERATIVO ATIVADO')}});
window.addEventListener('abyssal-authenticated',()=>{if(window.AbyssalOnlinePendingStart){window.AbyssalOnlinePendingStart=false;$('loginScreen').hidden=true;onlineMode=true;startGame();showToast('CONECTADO AO ABISMO COOPERATIVO')}});
$('loginCancelBtn').addEventListener('click',()=>{$('loginScreen').hidden=true});
window.addEventListener('abyssal-account-data',e=>{const a=e.detail;if(!a)return;coins=Number(a.coins)||0;ownedSkins=Array.isArray(a.ownedSkins)?a.ownedSkins:['default'];equippedSkin=a.equippedSkin||'default';saveCosmeticsLocalOnly();renderShop();});
window.addEventListener('abyssal-purchase-result',e=>{const r=e.detail||{};showToast(r.message||'Compra processada');if(r.ok)audio(760,.15,'triangle',.035);});
function saveCosmeticsLocalOnly(){localStorage.setItem('abyssalCoins',String(coins));localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));}
renderShop();resize();gameState='menu';requestAnimationFrame(loop);

const endDiveButton=document.createElement('button');endDiveButton.id='endDiveBtn';endDiveButton.type='button';endDiveButton.textContent='ENCERRAR MERGULHO';endDiveButton.style.cssText='position:absolute;right:18px;top:72px;z-index:8;border:1px solid rgba(255,130,160,.55);border-radius:8px;padding:8px 10px;background:rgba(30,10,25,.78);color:#ffd6e0;font:600 10px Manrope,system-ui;letter-spacing:.08em;cursor:pointer;display:none';document.getElementById('gameShell').appendChild(endDiveButton);
endDiveButton.addEventListener('click',()=>{if(onlineMode)window.AbyssalOnline?.leaveWorld();onlineMode=false;gameState='menu';$('hud').hidden=true;$('pauseBtn').hidden=true;$('upgradeScreen').hidden=true;$('pauseScreen').hidden=true;$('gameOverScreen').hidden=true;$('menuScreen').hidden=false;endDiveButton.style.display='none';showToast('Mergulho encerrado. Os outros jogadores continuam jogando.');});

})();