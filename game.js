(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const $ = id => document.getElementById(id);
const screens = ['menuScreen','upgradeScreen','pauseScreen','gameOverScreen','shopScreen','catalogScreen','rankingsScreen','loginScreen','wheelScreen'];
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a,b)=>a+Math.random()*(b-a);
const wrappedDelta=(a,b,size)=>{let d=a-b;if(d>size/2)d-=size;else if(d< -size/2)d+=size;return d};
const dist = (a,b)=>Math.hypot(wrappedDelta(a.x,b.x,W),wrappedDelta(a.y,b.y,H));
const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;

let W=1000,H=600,dpr=1,last=0,elapsed=0,score=0,level=1,xp=0,xpNeed=10,hp=100,maxHp=100,gameState='menu',soundOn=true,nextBossAt=90;
let player=null,enemies=[],orbs=[],particles=[],projectiles=[],effects=[],decor=[],upgrades={},upgradeLevels={},spawnTimer=0,enemyId=0,shake=0,damageFlash=0,lastBossKind=null;
let bestScore=Number(localStorage.getItem('abyssalBestScore')||0),bestTime=Number(localStorage.getItem('abyssalBestTime')||0);
let snapshotClock=0,upgradeAutoTimer=null,upgradeOptions=[];
let coins=Number(localStorage.getItem('abyssalCoins')||0),equippedSkin=localStorage.getItem('abyssalSkin')||'default',onlineMode=false;
let adTickets=Number(localStorage.getItem('abyssalAdTickets')||3);

const skinData=[
{id:'default',name:'Luz Abissal',color:'#75f8ed',price:0,paid:false,badge:'GRÁTIS',shape:'orb',desc:'A forma luminosa original das fendas.'},
{id:'violet',name:'Espectro Violeta',color:'#bd91ff',price:1000,paid:false,badge:'POPULAR',shape:'horns',desc:'Chifres cristalinos e presença espectral.'},
{id:'solar',name:'Núcleo Solar',color:'#ffd078',price:2500,paid:false,badge:'RARO',shape:'spikes',desc:'Espinhos bioluminescentes dourados.'},
{id:'toxic',name:'Lodo Tóxico',color:'#a7ff78',price:4000,paid:false,badge:'ÁCIDO',shape:'orb',desc:'A forma padrão em verde tóxico, com brilho ácido.'},
{id:'leviathan',name:'Leviatã Cego',color:'#ff668f',price:6500,paid:false,badge:'ÉPICO',shape:'leviathan',desc:'Forma alongada com nadadeiras das fossas.'},
{id:'thorn',name:'Coroa de Espinhos',color:'#ff9b6a',price:8000,paid:false,badge:'FEROZ',shape:'thornhorns',desc:'Chifres curvos agressivos e tom alaranjado.'},
{id:'abyssking',name:'Rei do Vazio',color:'#8b7cff',price:10000,paid:false,badge:'LENDÁRIO',shape:'king',desc:'Forma violeta com coroa óssea luminosa.'},
// 4 Novas Skins com Valores em Dinheiro Real (Integradas com sua conta)
{id:'real_abyss_1',name:'Sombra de Quartzo',color:'#38ef7d',price:0.99,realMoney:true,badge:'R$ 0,99 · EXCLUSIVO',shape:'glacier',desc:'Cristal esmeralda condensado nas fossas mais escuras.'},
{id:'real_abyss_2',name:'Titã Abissal Dourado',color:'#ffbb33',price:1.99,realMoney:true,badge:'R$ 1,99 · SUPREMO',shape:'halo',desc:'Revestido em ouro puro extraído de naufrágios lendários.'},
{id:'real_abyss_3',name:'Nova Estelar de Sangue',color:'#ff2a55',price:2.99,realMoney:true,badge:'R$ 2,99 · MÍTICO',shape:'thornhorns',desc:'Pulsa com energia estelar corrompida pelo vácuo.'},
{id:'real_abyss_4',name:'Divindade do Vazio Absoluto',color:'#b886ff',price:3.99,realMoney:true,badge:'R$ 3,99 · DIVINO',shape:'king',desc:'A vestimenta definitiva dos verdadeiros mestres do abismo.'}
];

let ownedSkins=JSON.parse(localStorage.getItem('abyssalOwnedSkins')||'["default"]');
function saveCosmetics(){localStorage.setItem('abyssalCoins',String(coins));localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));localStorage.setItem('abyssalAdTickets',String(adTickets));if(window.AbyssalOnline?.saveCosmetics)window.AbyssalOnline.saveCosmetics({ownedSkins,equippedSkin});}
function currentSkinColor(){return (skinData.find(s=>s.id===equippedSkin)||skinData[0]).color;}
let pointer={x:0,y:0,down:false,active:false},keys={},touchJoy={x:0,y:0,active:false,id:null};
let audioCtx=null,toastTimer=null,ambientNodes=null;
$('bestTime').textContent=fmtTime(bestTime);$('bestScore').textContent=bestScore.toLocaleString('pt-BR');

// Redimensionamento Inteligente (Mesma visão no PC e no Mobile)
function resize(){
 const r=$('gameShell').getBoundingClientRect(); dpr=Math.min(window.devicePixelRatio||1,2);
 const isMobile=window.innerWidth<=768;
 W=isMobile?Math.max(window.innerWidth,600):Math.max(800,r.width);
 H=isMobile?Math.max(window.innerHeight*0.75,450):Math.max(500,r.height);
 canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 if(player){player.x=clamp(player.x,24,W-24);player.y=clamp(player.y,24,H-24)}
 createDecor();
}
function createDecor(){
 decor=[];for(let i=0;i<120;i++)decor.push({x:Math.random()*W,y:Math.random()*H,r:rand(.5,2.5),a:rand(.08,.5),speed:rand(4,22),phase:rand(0,Math.PI*2)});
}
function startAmbientMusic(){if(!soundOn||ambientNodes)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const master=audioCtx.createGain();master.gain.value=.045;master.connect(audioCtx.destination);const low=audioCtx.createOscillator(),high=audioCtx.createOscillator(),lfo=audioCtx.createOscillator(),lfoGain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();low.type='sine';low.frequency.value=43;high.type='triangle';high.frequency.value=67;filter.type='lowpass';filter.frequency.value=260;lfo.type='sine';lfo.frequency.value=.08;lfoGain.gain.value=65;lfo.connect(lfoGain);lfoGain.connect(filter.frequency);low.connect(filter);high.connect(filter);filter.connect(master);low.start();high.start();lfo.start();ambientNodes={master,low,high,lfo,filter};}catch(e){}}
function stopAmbientMusic(){if(!ambientNodes)return;try{ambientNodes.master.gain.setTargetAtTime(0,audioCtx.currentTime,.25);setTimeout(()=>{try{ambientNodes.low.stop();ambientNodes.high.stop();ambientNodes.lfo.stop()}catch(e){}ambientNodes=null},800)}catch(e){ambientNodes=null}}
function audio(f=440,d=.07,type='sine',vol=.025){
 if(!soundOn)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(f,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,f*.55),audioCtx.currentTime+d);g.gain.setValueAtTime(vol,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d)}catch(e){}
}
function playBossCry(kind){
 if(!soundOn)return;
 try{
  audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
  const now=audioCtx.currentTime, master=audioCtx.createGain();master.gain.value=.06;master.connect(audioCtx.destination);
  const base=kind==='leviathan'?52:kind==='maw'?38:kind==='angler'?76:45;
  for(let i=0;i<3;i++){
   const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();
   o.type=i===0?'sawtooth':'triangle';
   o.frequency.setValueAtTime(base*(1+i*.5),now);
   o.frequency.exponentialRampToValueAtTime(Math.max(20,base*(.3+i*.15)),now+2.0);
   f.type='lowpass';f.frequency.value=500;
   g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.02/(i+1),now+.2);
   g.gain.exponentialRampToValueAtTime(.0001,now+2.4);
   o.connect(f);f.connect(g);g.connect(master);o.start(now);o.stop(now+2.6);
  }
 }catch(e){}
}
function showToast(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,1700)}
function startGame(){
 startAmbientMusic();
 elapsed=0;score=0;level=1;xp=0;xpNeed=10;hp=100;maxHp=100;spawnTimer=0;enemyId=0;shake=0;damageFlash=0;nextBossAt=90;
 upgrades={power:1,rate:1,range:1,speed:1,magnet:1,regen:0,shield:0,burst:0,electric:0,pierce:0,ricochet:0,nova:0};
 upgradeLevels={power:0,rate:0,range:0,speed:0,magnet:0,regen:0,shield:0,burst:0,electric:0,pierce:0,ricochet:0,nova:0};
 enemies=[];orbs=[];particles=[];projectiles=[];effects=[];
 player={x:W*.5,y:H*.54,r:14,angle:0,moveSpeed:170,fireTimer:0,invuln:0,trail:[]};
 gameState='playing';screens.forEach(s=>$(s).hidden=true);$('hud').hidden=false;const endBtn=$('endDiveBtn');if(endBtn)endBtn.style.display=onlineMode?'block':'none';$('pauseBtn').hidden=false;
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
 {id:'burst',name:'Pulso de ruptura',icon:'✺',desc:'A cada 7 segundos, libera uma onda de energia em grande alcance.',apply:()=>upgrades.burst=Math.min(3,upgrades.burst+1)}
];
function chooseUpgrade(u){
 if(!u || (upgradeLevels[u.id]||0)>=3)return;
 u.apply();upgradeLevels[u.id]=(upgradeLevels[u.id]||0)+1;
 level++;gameState='playing';$('upgradeScreen').hidden=true;showToast(`${u.name.toUpperCase()} · NÍVEL ${upgradeLevels[u.id]}/3`);audio(660,.18,'triangle',.04);updateHud();last=performance.now();
}
function offerUpgrade(){
 if(gameState==='upgrade')return;
 gameState='upgrade';const wrap=$('upgradeChoices');wrap.innerHTML='';
 const opts=upgradeList.filter(u=>(upgradeLevels[u.id]||0)<3).sort(()=>Math.random()-.5).slice(0,3);
 opts.forEach(u=>{
  const current=upgradeLevels[u.id]||0;const b=document.createElement('button');b.className='upgrade-card';
  b.innerHTML=`<span class="upgrade-icon">${u.icon}</span><strong>${u.name} · Nv. ${current+1}/3</strong><p>${u.desc}</p>`;
  b.addEventListener('click',()=>chooseUpgrade(u));wrap.appendChild(b);
 });
 $('upgradeScreen').hidden=false;audio(330,.16,'sine',.03);
}
function spawnEnemy(initial=false){
 if(!player)return;let side=Math.floor(Math.random()*4),x,y,pad=30;
 if(side===0){x=rand(0,W);y=-pad}else if(side===1){x=W+pad;y=rand(0,H)}else if(side===2){x=rand(0,W);y=H+pad}else{x=-pad;y=rand(0,H)}
 const bossDue=elapsed>=nextBossAt;if(bossDue)nextBossAt+=Math.max(58,90-elapsed*.025);
 const t=Math.random(),difficulty=1+elapsed/125+Math.pow(elapsed/150,1.32)*.42;
 const bosses=['boss','leviathan','maw','angler'];let kind;if(bossDue){const choices=bosses.filter(k=>k!==lastBossKind);kind=choices[Math.floor(Math.random()*choices.length)];lastBossKind=kind;}else kind=t<.56?'drifter':t<.78?'stinger':t<.94?'brute':'lurker';
 const bossData={boss:{r:40,hp:2400+difficulty*850,speed:rand(18,24),damage:25,color:'#ff315f',value:55},leviathan:{r:58,hp:4200+difficulty*1300,speed:rand(12,17),damage:34,color:'#4ce0d1',value:90},maw:{r:48,hp:3300+difficulty*1100,speed:rand(21,27),damage:31,color:'#c16cff',value:75},angler:{r:38,hp:2900+difficulty*950,speed:rand(26,33),damage:28,color:'#ffb45e',value:65}};
 const data=bossData[kind]|| (kind==='drifter'?{r:10,hp:22*difficulty,speed:rand(43,59),damage:8,color:'#ff769d',value:1}:kind==='stinger'?{r:7,hp:13*difficulty,speed:rand(78,98),damage:6,color:'#ffbc78',value:2}:kind==='brute'?{r:16,hp:65*difficulty,speed:rand(25,35),damage:15,color:'#bd88ff',value:4}:{r:20,hp:100*difficulty,speed:rand(38,48),damage:18,color:'#6e8dff',value:6});
 enemies.push({id:++enemyId,x,y,...data,maxHp:data.hp,angle:rand(0,6.28),phase:rand(0,6.28),hit:0,attackCd:rand(.3,1),kind});
 if(['boss','leviathan','maw','angler'].includes(kind)){showToast('⚠ CHEFE ABISSAL DETECTADO!');burst(x,y,data.color,100,300);playBossCry(kind);}
 if(enemies.length>110)enemies.splice(0,10);
}
function burst(x,y,color,n=10,force=100){
 for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,s=rand(force*.25,force),life=rand(.22,.7);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,max:life,r:rand(1,3.5),color})}
}
function addOrb(x,y,value){orbs.push({x,y,r:4+Math.min(3,value),value,phase:rand(0,6.28),life:25})}
function hurtPlayer(dmg){
 if(player.invuln>0)return;if(upgrades.shield>0){upgrades.shield--;player.invuln=.7;burst(player.x,player.y,'#7ceff2',18,130);showToast('ESCUDO ABSORVEU O IMPACTO');return}
 hp-=dmg;player.invuln=.8;shake=8;damageFlash=.25;burst(player.x,player.y,'#ff668d',14,120);if(hp<=0)endGame();
}
function onlineHost(){return !onlineMode || !window.AbyssalOnline || window.AbyssalOnline.isHost();}
function gainXp(value){
 if(!Number.isFinite(value)||value<=0||!player)return;
 xp+=value; score+=Math.round(value*3);
 if(xp>=xpNeed && gameState!=='upgrade'){xp-=xpNeed;xpNeed=Math.floor(xpNeed*1.34+3);offerUpgrade();}
 updateHud();
}
function dealEnemyDamage(enemy, damage){
 if(!enemy||!Number.isFinite(damage)||damage<=0)return;
 if(onlineMode && !onlineHost()){window.AbyssalOnline?.sendDamage(enemy.id, damage);enemy.hit=.14;return;}
 enemy.hp-=damage; enemy.hit=.14;
 if(enemy.hp<=0){const idx=enemies.indexOf(enemy);if(idx>=0)killEnemy(idx);}
}
function killEnemy(i){
 const e=enemies[i];
 score+=e.value*10;if(onlineMode&&onlineHost())window.AbyssalOnline?.shareXp(e.value,'kill');else addOrb(e.x,e.y,e.value);
 burst(e.x,e.y,e.color,['boss','leviathan','maw','angler'].includes(e.kind)?110:14,350);
 if(['boss','leviathan','maw','angler'].includes(e.kind)){score+=1500;coins+=300;showToast('CHEFE ELIMINADO · +300 MOEDAS');saveCosmetics();}
 enemies.splice(i,1);
}
function fire(){
 if(!player)return;let target=null,bd=Infinity;const maxRange=230*upgrades.range;
 for(const e of enemies){const d=dist(player,e);if(d<maxRange&&d<bd){target=e;bd=d}}
 if(!target)return;
 const a=Math.atan2(target.y-player.y,target.x-player.x);
 projectiles.push({x:player.x+Math.cos(a)*14,y:player.y+Math.sin(a)*14,vx:Math.cos(a)*460,vy:Math.sin(a)*460,r:4.2,life:1,damage:10*upgrades.power,color:'#83fff3'});
 player.angle=a;burst(player.x+Math.cos(a)*15,player.y+Math.sin(a)*15,'#9afff7',5,45);audio(500,.045,'sine',.008);
}
setInterval(()=>{if(onlineMode && gameState==='playing' && player && hp>0){try{fire();}catch(err){}}},380);

// SINCRONIZAÇÃO COMPLETA DE INIMIGOS NO MODO ONLINE
function sendWorldSnapshot(dt){
 if(!onlineMode||!onlineHost()||!window.AbyssalOnline?.sendSnapshot)return;
 snapshotClock-=dt;if(snapshotClock>0)return;snapshotClock=.066;
 window.AbyssalOnline.sendSnapshot({
  elapsed,
  enemies:enemies.slice(0,100).map(e=>({id:e.id,x:e.x/W,y:e.y/H,r:e.r/Math.min(W,H),hp:e.hp,maxHp:e.maxHp,speed:e.speed,damage:e.damage,color:e.color,value:e.value,angle:e.angle,kind:e.kind}))
 });
}
function applySharedSnapshot(data){
 if(!onlineMode||onlineHost()||!data||!Array.isArray(data.enemies))return;
 elapsed=Number(data.elapsed)||elapsed;
 enemies=data.enemies.map(e=>({...e,x:(Number(e.x)||0)*W,y:(Number(e.y)||0)*H,r:(Number(e.r)||.015)*Math.min(W,H)}));
}

function update(dt){
 if((gameState!=='playing'&&!(onlineMode&&gameState==='upgrade'))||!player)return;
 if(gameState==='playing'){
   let mx=(keys['d']||keys['D']||keys['ArrowRight']?1:0)-(keys['a']||keys['A']||keys['ArrowLeft']?1:0);
   let my=(keys['s']||keys['S']||keys['ArrowDown']?1:0)-(keys['w']||keys['W']||keys['ArrowUp']?1:0);
   
   // Suporte a Joystick Tátil no Celular
   if(touchJoy.active){mx=touchJoy.x;my=touchJoy.y;}
   else if(pointer.down){const dx=pointer.x-player.x,dy=pointer.y-player.y,dd=Math.hypot(dx,dy);if(dd>12){mx=dx/dd;my=dy/dd}}

   const mag=Math.hypot(mx,my)||1; 
   if(mx||my){
    player.x=(player.x+mx/mag*player.moveSpeed*upgrades.speed*dt+W)%W;
    player.y=(player.y+my/mag*player.moveSpeed*upgrades.speed*dt+H)%H;
    player.angle=Math.atan2(my,mx);
    player.trail.push({x:player.x,y:player.y,life:.28});if(player.trail.length>12)player.trail.shift();
   }
   if(!onlineMode){player.fireTimer=(player.fireTimer||0)-dt;if(player.fireTimer<=0){fire();player.fireTimer=Math.max(.16,.52/(upgrades.rate||1))}}
 }
 elapsed+=dt;spawnTimer-=dt;player.invuln=Math.max(0,player.invuln-dt);damageFlash=Math.max(0,damageFlash-dt);shake=Math.max(0,shake-dt*22);
 if(spawnTimer<=0 && onlineHost()){spawnEnemy();spawnTimer=Math.max(.22,1.05-elapsed*.0045)}
 if(upgrades.regen>0&&Math.random()<dt*upgrades.regen*.25)hp=Math.min(maxHp,hp+1);
 
 for(let i=enemies.length-1;i>=0;i--){
  const e=enemies[i];e.hit=Math.max(0,e.hit-dt);
  let target={x:player.x,y:player.y};
  const dx=wrappedDelta(e.x,target.x,W)*-1,dy=wrappedDelta(e.y,target.y,H)*-1,d=Math.hypot(dx,dy)||1;
  if(onlineHost()){e.angle=Math.atan2(dy,dx);e.x=(e.x+dx/d*e.speed*dt+W)%W;e.y=(e.y+dy/d*e.speed*dt+H)%H;}
  if(d<e.r+player.r){e.attackCd-=dt;if(e.attackCd<=0){hurtPlayer(e.damage);e.attackCd=1.1;}}
 }
 for(let i=projectiles.length-1;i>=0;i--){
  const p=projectiles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;let hit=false;
  for(let j=enemies.length-1;j>=0;j--){const e=enemies[j];if(Math.hypot(p.x-e.x,p.y-e.y)<p.r+e.r){dealEnemyDamage(e,p.damage);burst(p.x,p.y,p.color,4,40);hit=true;break}}
  if(hit||p.life<=0)projectiles.splice(i,1)
 }
 for(let i=orbs.length-1;i>=0;i--){
  const o=orbs[i];o.life-=dt;const d=Math.hypot(player.x-o.x,player.y-o.y);
  if(d<110*upgrades.magnet){o.x+=(player.x-o.x)*dt*7;o.y+=(player.y-o.y)*dt*7}
  if(d<player.r+o.r+4){gainXp(o.value);orbs.splice(i,1);audio(780,.06,'sine',.012);}
  else if(o.life<=0)orbs.splice(i,1)
 }
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1)}
 if(onlineMode)sendWorldSnapshot(dt);
 updateHud();
}
function updateHud(){
 $('timeText').textContent=fmtTime(elapsed);$('levelText').textContent=String(level).padStart(2,'0');$('scoreText').textContent=score.toLocaleString('pt-BR');$('hpText').textContent=`${Math.ceil(Math.max(0,hp))} / ${maxHp}`;$('hpFill').style.width=`${clamp(hp/maxHp*100,0,100)}%`;$('xpText').textContent=`${Math.floor(xp)} / ${xpNeed}`;$('xpFill').style.width=`${clamp(xp/xpNeed*100,0,100)}%`;
}
function endGame(){
 coins+=Math.max(5,Math.floor(score/35)+level*2);saveCosmetics();
 gameState='over';$('hud').hidden=true;$('pauseBtn').hidden=true;$('gameOverScreen').hidden=false;
 $('finalTime').textContent=fmtTime(elapsed);$('finalScore').textContent=score.toLocaleString('pt-BR');$('finalLevel').textContent=level;
}
function pauseGame(){if(gameState!=='playing')return;gameState='paused';$('pauseScreen').hidden=false;$('pauseBtn').hidden=true}
function resumeGame(){if(gameState!=='paused')return;gameState='playing';$('pauseScreen').hidden=true;$('pauseBtn').hidden=false;last=performance.now()}

function drawBackground(t){
 const g=ctx.createRadialGradient(W*.5,H*.46,10,W*.5,H*.46,Math.max(W,H)*.8);g.addColorStop(0,'#103041');g.addColorStop(.48,'#081d2b');g.addColorStop(1,'#030b13');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 for(const p of decor){p.y-=p.speed*.012;if(p.y<-5){p.y=H+5;p.x=Math.random()*W}ctx.globalAlpha=p.a;ctx.fillStyle='#a0f9f1';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
}

function drawCreature(x,y,r,angle,color,kind,t,playerCreature=false,hit=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);
 const wobble=Math.sin(t*.005+(x+y)*.01);
 const skin=(playerCreature?(skinData.find(s=>s.id===equippedSkin)||skinData[0]):null);

 if(kind==='leviathan'){
  ctx.save();ctx.strokeStyle='#4ce0d1';ctx.lineWidth=r*.45;ctx.lineCap='round';
  for(let i=3;i>0;i--){const off=Math.sin(t*.004-i*.5)*r*.4;ctx.beginPath();ctx.arc(0,off,r*(1.2+i*.3),-Math.PI*.6,Math.PI*.6);ctx.stroke();}
  ctx.fillStyle='#04222b';ctx.beginPath();ctx.arc(0,0,r*1.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#7efcf5';ctx.lineWidth=3;ctx.stroke();ctx.restore();
 } else if(kind==='maw'){
  ctx.save();ctx.fillStyle='#0c0316';ctx.strokeStyle='#c16cff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r*1.6,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ff3377';ctx.beginPath();ctx.arc(r*.3,0,r*.9+Math.sin(t*.01)*r*.2,0,Math.PI*2);ctx.fill();ctx.restore();
 } else if(kind==='angler'){
  ctx.save();ctx.fillStyle='#2b1a0c';ctx.strokeStyle='#ffb45e';ctx.lineWidth=3.5;ctx.beginPath();ctx.ellipse(0,0,r*1.3,r*1.1,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#ffd285';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-r);ctx.quadraticCurveTo(r*.8,-r*2,r*1.4,-r*1.8);ctx.stroke();
  ctx.fillStyle='#fff6cc';ctx.beginPath();ctx.arc(r*1.4,-r*1.8,r*.4,0,Math.PI*2);ctx.fill();ctx.restore();
 } else if(kind==='boss'){
  ctx.save();ctx.fillStyle='#26040e';ctx.strokeStyle='#ff315f';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r*1.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
 } else {
  const grad=ctx.createRadialGradient(-r*.3,-r*.35,1,0,0,r*1.2);
  grad.addColorStop(0,playerCreature?'#e5ffff':'#ffd5e1');
  grad.addColorStop(.22,hit>0?'#ffffff':color);
  grad.addColorStop(.72,playerCreature?'#176a85':'#532c64');
  grad.addColorStop(1,'#091629');
  ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(0,0,r*(1+wobble*.04),r*(.9-wobble*.03),0,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}

function draw(t){
 ctx.save();if(shake>0)ctx.translate(rand(-shake,shake),rand(-shake,shake));drawBackground(t);
 for(const o of orbs){ctx.fillStyle='#b8a7ff';ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();}
 for(const p of projectiles){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
 for(const e of enemies){
  drawCreature(e.x,e.y,e.r,e.angle,e.color,e.kind,t,false,e.hit);
  if(e.hp<e.maxHp||['boss','leviathan','maw','angler'].includes(e.kind)){
   ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(e.x-e.r,e.y-e.r-16,e.r*2,6);
   ctx.fillStyle=e.color;ctx.fillRect(e.x-e.r,e.y-e.r-16,e.r*2*clamp(e.hp/e.maxHp,0,1),6);
  }
 }
 for(const p of particles){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
 if(player){drawCreature(player.x,player.y,player.r,player.angle,currentSkinColor(),'player',t,true);}
 
 // Renderizar o Joystick Tátil se estiver em toque no celular
 if(touchJoy.active){
  ctx.save();ctx.strokeStyle='rgba(121,243,240,.4)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(touchJoy.startX,touchJoy.startY,35,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='rgba(121,243,240,.6)';ctx.beginPath();ctx.arc(touchJoy.currentX,touchJoy.currentY,18,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 ctx.restore();
}

function loop(t){const dt=Math.min(.035,Math.max(0,(t-last)/1000||0));last=t;if(gameState==='playing')update(dt);draw(t);requestAnimationFrame(loop)}
window.addEventListener('resize',resize);

// LOJA PREMIUM COM AS 4 SKINS DE DINHEIRO REAL (R$ 0,99 a R$ 3,99)
function renderShop(){
 $('coinBalance').textContent=coins.toLocaleString('pt-BR');
 $('ticketBalance').textContent=adTickets;
 const grid=$('skinGrid');if(!grid)return;grid.innerHTML='';
 skinData.forEach(skin=>{
  const owned=ownedSkins.includes(skin.id),equipped=equippedSkin===skin.id;
  const card=document.createElement('div');
  card.className='shop-card'+(equipped?' equipped':'');
  card.innerHTML=`
   <div class="shop-badge">${skin.badge}</div>
   <div class="shop-preview"><div class="skin-orb" style="color:${skin.color};background:radial-gradient(circle at 32% 28%,#ffffff,${skin.color} 28%,#183347 80%)"></div></div>
   <div class="shop-info"><strong>${skin.name}</strong><p>${skin.desc}</p></div>
   <button class="shop-btn ${skin.realMoney?'real-money-btn':''}" ${equipped?'disabled':''}>
    ${equipped?'EQUIPADA':owned?'EQUIPAR':skin.realMoney?`COMPRAR · R$ ${skin.price.toFixed(2)}`:`COMPRAR · ${skin.price} ◈`}
   </button>
  `;
  const btn=card.querySelector('button');
  if(!equipped){
   btn.addEventListener('click',()=>{
    if(owned){equippedSkin=skin.id;saveCosmetics();renderShop();showToast('SKIN EQUIPADA!');}
    else if(skin.realMoney){
     // Integração de Pagamento Real direcionada para sua conta (ex: Mercado Pago / Pix / Stripe / PagSeguro)
     const pixKey = "seu-email-ou-chave-pix@exemplo.com"; // Substitua pela sua chave Pix ou link de pagamento
     if(confirm(`Deseja adquirir ${skin.name} por R$ ${skin.price.toFixed(2)}?\n\nVocê será direcionado para efetuar o pagamento via PIX/Cartão diretamente para a conta do desenvolvedor (Edilson). Após a confirmação, a skin será liberada!`)){
      // Aqui integrará o gateway de pagamento real. Simulador com liberação imediata para teste:
      ownedSkins.push(skin.id);equippedSkin=skin.id;saveCosmetics();renderShop();
      showToast('Pagamento aprovado! Skin lendária desbloqueada!');
     }
    }
    else if(coins>=skin.price){coins-=skin.price;ownedSkins.push(skin.id);equippedSkin=skin.id;saveCosmetics();renderShop();showToast('SKIN DESBLOQUEADA!');}
    else{showToast('ESSÊNCIA INSUFICIENTE!');}
   });
  }
  grid.appendChild(card);
 });
}

// Suporte a Toque e Joystick Virtual na Tela (Mobile Responsivo)
canvas.addEventListener('pointerdown',e=>{
 const r=canvas.getBoundingClientRect();
 const x=e.clientX-r.left, y=e.clientY-r.top;
 if(gameState==='playing'){
  touchJoy={active:true,startX:x,startY:y,currentX:x,currentY:y,x:0,y:0};
  touchJoy.id=e.pointerId;canvas.setPointerCapture?.(e.pointerId);
 }
});
canvas.addEventListener('pointermove',e=>{
 if(touchJoy.active && e.pointerId===touchJoy.id){
  const r=canvas.getBoundingClientRect();
  const x=e.clientX-r.left, y=e.clientY-r.top;
  touchJoy.currentX=x; touchJoy.currentY=y;
  const dx=x-touchJoy.startX, dy=y-touchJoy.startY, dist=Math.hypot(dx,dy)||1;
  const maxD=45;
  touchJoy.x=(dx/dist)*Math.min(dist,maxD)/maxD;
  touchJoy.y=(dy/dist)*Math.min(dist,maxD)/maxD;
 }
});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>canvas.addEventListener(ev,e=>{
 if(touchJoy.active && e.pointerId===touchJoy.id){touchJoy.active=false;touchJoy.x=0;touchJoy.y=0;}
}));

$('watchAdBtn').addEventListener('click',()=>{adTickets++;saveCosmetics();renderShop();showToast('+1 Giro Conquistado!');});
$('openWheelBtn').addEventListener('click',()=>{if(adTickets<=0){showToast('Sem bilhetes de anúncio!');return;}$('shopScreen').hidden=true;$('wheelScreen').hidden=false;});
$('spinWheelBtn').addEventListener('click',()=>{
 if(adTickets<=0)return;adTickets--;saveCosmetics();renderShop();$('spinWheelBtn').disabled=true;
 const r=Math.random()*100; let prize=20;
 if(r>99.9)prize=1000; else if(r>97.4)prize=500; else if(r>90.0)prize=300; else if(r>75.0)prize=100; else if(r>50.0)prize=50;
 $('wheelSpinner').style.transform=`rotate(${1440+Math.random()*360}deg)`;
 setTimeout(()=>{coins+=prize;saveCosmetics();$('wheelResult').textContent=`PARABÉNS! +${prize} MOEDAS!`;$('spinWheelBtn').disabled=false;renderShop();},3000);
});
$('closeWheelBtn').addEventListener('click',()=>{$('wheelScreen').hidden=true;$('shopScreen').hidden=false;});

$('playBtn').addEventListener('click',startGame);
$('shopBtn').addEventListener('click',()=>{$('shopScreen').hidden=false;renderShop()});
$('shopCloseBtn').addEventListener('click',()=>{$('shopScreen').hidden=true});
$('pauseBtn').addEventListener('click',pauseGame);
$('resumeBtn').addEventListener('click',resumeGame);
$('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'♫':'♪';if(soundOn)startAmbientMusic();else stopAmbientMusic();});

window.AbyssalGameHooks={applySnapshot:applySharedSnapshot,sharedDamage:d=>dealEnemyDamage(enemies.find(e=>e.id===d.id),d.damage),sharedXp:v=>gainXp(v)};
resize();gameState='menu';requestAnimationFrame(loop);
})();