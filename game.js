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
let W=800,H=500,dpr=1,last=0,elapsed=0,score=0,level=1,xp=0,xpNeed=10,hp=100,maxHp=100,gameState='menu',soundOn=true,nextBossAt=90;
let player=null,botBuddy=null,enemies=[],orbs=[],particles=[],projectiles=[],effects=[],decor=[],upgrades={},upgradeLevels={},chosen=[],spawnTimer=0,enemyId=0,shake=0,damageFlash=0,runSeed=0,bossIndex=0;
let bestScore=Number(localStorage.getItem('abyssalBestScore')||0),bestTime=Number(localStorage.getItem('abyssalBestTime')||0);
let snapshotClock=0,upgradeAutoTimer=null,upgradeOptions=[],sharedXpApplying=false,lastBossKind=null;
let coins=Number(localStorage.getItem('abyssalCoins')||0),equippedSkin=localStorage.getItem('abyssalSkin')||'default',onlineMode=false,botBuddyTimer=0;
let adTickets=Number(localStorage.getItem('abyssalAdTickets')||3);

const skinData=[
{id:'default',name:'Luz Abissal',color:'#75f8ed',price:0,paid:false,badge:'GRÁTIS',shape:'orb',desc:'A forma luminosa original das fendas.'},
{id:'violet',name:'Espectro Violeta',color:'#bd91ff',price:1000,paid:false,badge:'POPULAR',shape:'horns',desc:'Chifres cristalinos e presença espectral.'},
{id:'solar',name:'Núcleo Solar',color:'#ffd078',price:2500,paid:false,badge:'RARO',shape:'spikes',desc:'Espinhos bioluminescentes dourados.'},
{id:'toxic',name:'Lodo Tóxico',color:'#a7ff78',price:4000,paid:false,badge:'ÁCIDO',shape:'orb',desc:'A forma padrão em verde tóxico, com brilho ácido.'},
{id:'leviathan',name:'Leviatã Cego',color:'#ff668f',price:6500,paid:false,badge:'ÉPICO',shape:'leviathan',desc:'Forma alongada com nadadeiras das fossas.'},
{id:'thorn',name:'Coroa de Espinhos',color:'#ff9b6a',price:8000,paid:false,badge:'FEROZ',shape:'thornhorns',desc:'Chifres curvos agressivos e tom alaranjado.'},
{id:'abyssking',name:'Rei do Vazio',color:'#8b7cff',price:10000,paid:false,badge:'LENDÁRIO',shape:'king',desc:'Forma violeta com coroa óssea luminosa.'},
{id:'royal',name:'Abismo Real',color:'#ff78d0',price:49.90,paid:true,badge:'R$ 49,90 · PREMIUM',shape:'halo',desc:'Edição de colecionador com auréola divina animada.'},
{id:'glacier',name:'Glaciar Fantasma',color:'#91caff',price:79.90,paid:true,badge:'R$ 79,90 · EXCLUSIVO',shape:'glacier',desc:'Edição mítica com cristais de gelo eterno e aura polar.'}
];

let ownedSkins=JSON.parse(localStorage.getItem('abyssalOwnedSkins')||'["default"]');
function saveCosmetics(){localStorage.setItem('abyssalCoins',String(coins));localStorage.setItem('abyssalSkin',equippedSkin);localStorage.setItem('abyssalOwnedSkins',JSON.stringify(ownedSkins));localStorage.setItem('abyssalAdTickets',String(adTickets));if(window.AbyssalOnline?.saveCosmetics)window.AbyssalOnline.saveCosmetics({ownedSkins,equippedSkin});}
function currentSkinColor(){return (skinData.find(s=>s.id===equippedSkin)||skinData[0]).color;}
let pointer={x:0,y:0,down:false,active:false},keys={};
let audioCtx=null,toastTimer=null,ambientNodes=null;
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
 elapsed=0;score=0;level=1;xp=0;xpNeed=10;hp=100;maxHp=100;spawnTimer=0;enemyId=0;shake=0;damageFlash=0;chosen=[];nextBossAt=90;
 upgrades={power:1,rate:1,range:1,speed:1,magnet:1,regen:0,shield:0,burst:0,electric:0,pierce:0,ricochet:0,nova:0};
 upgradeLevels={power:0,rate:0,range:0,speed:0,magnet:0,regen:0,shield:0,burst:0,electric:0,pierce:0,ricochet:0,nova:0};
 enemies=[];orbs=[];particles=[];projectiles=[];effects=[];
 player={x:W*.5,y:H*.54,r:13,angle:0,moveSpeed:150,fireTimer:0,invuln:0,shieldTime:0,trail:[]};
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
 level++;gameState='playing';$('upgradeScreen').hidden=true;showToast(`${u.name.toUpperCase()} · NÍVEL ${upgradeLevels[u.id]}/3`);audio(660+upgradeLevels[u.id]*100,.18,'triangle',.04);updateHud();last=performance.now();
}
function offerUpgrade(){
 if(gameState==='upgrade')return;
 gameState='upgrade';chosen=[];upgradeOptions=upgradeList.filter(u=>(upgradeLevels[u.id]||0)<3).sort(()=>Math.random()-.5).slice(0,3);const wrap=$('upgradeChoices');wrap.innerHTML='';
 if(!upgradeOptions.length){gameState='playing';$('upgradeScreen').hidden=true;return}
 if(onlineMode&&player)player.invuln=Math.max(player.invuln,10);
 upgradeOptions.forEach(u=>{const current=upgradeLevels[u.id]||0;const b=document.createElement('button');b.className='upgrade-card';b.innerHTML=`<span class="upgrade-icon">${u.icon}</span><strong>${u.name} · Nv. ${current+1}/3</strong><p>${u.desc}</p><small class="upgrade-progress">${'◆'.repeat(current)}${'◇'.repeat(3-current)}</small>`;b.addEventListener('click',()=>chooseUpgrade(u));wrap.appendChild(b)});
 $('upgradeScreen').hidden=false;audio(330,.16,'sine',.03);
}
function spawnEnemy(initial=false){
 if(!player)return;let side=Math.floor(Math.random()*4),x,y,pad=30;
 if(side===0){x=rand(0,W);y=-pad}else if(side===1){x=W+pad;y=rand(0,H)}else if(side===2){x=rand(0,W);y=H+pad}else{x=-pad;y=rand(0,H)}
 const bossDue=elapsed>=nextBossAt;if(bossDue)nextBossAt+=Math.max(58,90-elapsed*.025);
 const t=Math.random(),difficulty=1+elapsed/125+Math.pow(elapsed/150,1.32)*.42;
 const bosses=['boss','leviathan','maw','angler'];let kind;if(bossDue){const choices=bosses.filter(k=>k!==lastBossKind);kind=choices[Math.floor(Math.random()*choices.length)];lastBossKind=kind;bossIndex++;}else kind=t<.56?'drifter':t<.78?'stinger':t<.94?'brute':'lurker';
 const bossData={boss:{r:40,hp:2400+difficulty*850,speed:rand(18,24)+elapsed*.012,damage:25,color:'#ff315f',value:55},leviathan:{r:58,hp:4200+difficulty*1300,speed:rand(12,17)+elapsed*.009,damage:34,color:'#4ce0d1',value:90},maw:{r:48,hp:3300+difficulty*1100,speed:rand(21,27)+elapsed*.012,damage:31,color:'#c16cff',value:75},angler:{r:38,hp:2900+difficulty*950,speed:rand(26,33)+elapsed*.014,damage:28,color:'#ffb45e',value:65}};
 const data=bossData[kind]|| (kind==='drifter'?{r:10,hp:22*difficulty,speed:rand(43,59)+elapsed*.07,damage:8,color:'#ff769d',value:1}
 :kind==='stinger'?{r:7,hp:13*difficulty,speed:rand(78,98)+elapsed*.09,damage:6,color:'#ffbc78',value:2}
 :kind==='brute'?{r:16,hp:65*difficulty,speed:rand(25,35)+elapsed*.035,damage:15,color:'#bd88ff',value:4}
 :{r:20,hp:100*difficulty,speed:rand(38,48)+elapsed*.04,damage:18,color:'#6e8dff',value:6});
 enemies.push({id:++enemyId,x,y,...data,maxHp:data.hp,angle:rand(0,6.28),phase:rand(0,6.28),hit:0,attackCd:rand(.3,1),kind});
 if(['boss','leviathan','maw','angler'].includes(kind)){showToast(kind==='leviathan'?'⚠ O LEVIATÃ DAS FOSSAS DESPERTOU':kind==='maw'?'⚠ A BOCA DO ABISMO SE ABRIU':kind==='angler'?'⚠ UMA LANTERNA MORTAL SE APROXIMA':'⚠ UMA ABERRAÇÃO SUPREMA SE APROXIMA');burst(x,y,data.color,100,300);playBossCry(kind);audio(48,.8,'sawtooth',.08)}
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
 enemies.splice(i,1);audio(260,.055,'triangle',.012);
}
function fire(){
 if(!player)return;let target=null,bd=Infinity;const maxRange=210*upgrades.range;
 for(const e of enemies){const d=dist(player,e);if(d<maxRange&&d<bd){target=e;bd=d}}
 if(!target)return;
 const a=Math.atan2(target.y-player.y,target.x-player.x);
 projectiles.push({x:player.x+Math.cos(a)*13,y:player.y+Math.sin(a)*13,vx:Math.cos(a)*430,vy:Math.sin(a)*430,r:4.1,life:.95,damage:9.5*upgrades.power,color:upgrades.ricochet>0?'#ffc47a':upgrades.electric>0?'#eaffff':upgrades.pierce>0?'#ffe7a1':'#83fff3'});
 player.angle=a;const muzzleX=player.x+Math.cos(a)*15,muzzleY=player.y+Math.sin(a)*15;burst(muzzleX,muzzleY,'#9afff7',5,45);audio(500,.045,'sine',.008);
}
setInterval(()=>{if(onlineMode && gameState==='playing' && player && hp>0){try{fire();}catch(err){}}},380);

function update(dt){
 if((gameState!=='playing'&&!(onlineMode&&gameState==='upgrade'))||!player)return;
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
 
 for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];e.hit=Math.max(0,e.hit-dt);let target={x:player.x,y:player.y};const dx=wrappedDelta(e.x,target.x,W)*-1,dy=wrappedDelta(e.y,target.y,H)*-1,d=Math.hypot(dx,dy)||1;if(onlineHost()){e.phase+=dt*4;e.angle=Math.atan2(dy,dx);e.x=(e.x+dx/d*e.speed*dt+W)%W;e.y=(e.y+dy/d*e.speed*dt+H)%H;}if(d<e.r+player.r){e.attackCd-=dt;if(e.attackCd<=0){hurtPlayer(e.damage);e.attackCd=1.1;}}}
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;let hit=false;for(let j=enemies.length-1;j>=0;j--){const e=enemies[j];if(Math.hypot(p.x-e.x,p.y-e.y)<p.r+e.r){dealEnemyDamage(e,p.damage);burst(p.x,p.y,p.color,4,40);hit=true;break}}if(hit||p.life<=0)projectiles.splice(i,1)}
 for(let i=orbs.length-1;i>=0;i--){const o=orbs[i];o.phase+=dt*3;o.life-=dt;const d=Math.hypot(player.x-o.x,player.y-o.y);if(d<100*upgrades.magnet){o.x+=(player.x-o.x)*dt*6;o.y+=(player.y-o.y)*dt*6}if(d<player.r+o.r+4){gainXp(o.value);orbs.splice(i,1);audio(780,.06,'sine',.012);}else if(o.life<=0)orbs.splice(i,1)}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1)}
 updateHud();
}
function updateHud(){
 $('timeText').textContent=fmtTime(elapsed);$('levelText').textContent=String(level).padStart(2,'0');$('scoreText').textContent=score.toLocaleString('pt-BR');$('hpText').textContent=`${Math.ceil(Math.max(0,hp))} / ${maxHp}`;$('hpFill').style.width=`${clamp(hp/maxHp*100,0,100)}%`;$('xpText').textContent=`${Math.floor(xp)} / ${xpNeed}`;$('xpFill').style.width=`${clamp(xp/xpNeed*100,0,100)}%`;
}
function endGame(){
 coins+=Math.max(5,Math.floor(score/35)+level*2);saveCosmetics();
 gameState='over';$('hud').hidden=true;$('pauseBtn').hidden=true;$('gameOverScreen').hidden=false;
 $('finalTime').textContent=fmtTime(elapsed);$('finalScore').textContent=score.toLocaleString('pt-BR');$('finalLevel').textContent=level;
 if(score>bestScore){bestScore=score;localStorage.setItem('abyssalBestScore',String(score));$('bestScore').textContent=bestScore.toLocaleString('pt-BR')}
}
function pauseGame(){if(gameState!=='playing')return;gameState='paused';$('pauseScreen').hidden=false;$('pauseBtn').hidden=true}
function resumeGame(){if(gameState!=='paused')return;gameState='playing';$('pauseScreen').hidden=true;$('pauseBtn').hidden=false;last=performance.now()}

function drawBackground(t){
 const g=ctx.createRadialGradient(W*.5,H*.46,10,W*.5,H*.46,Math.max(W,H)*.8);g.addColorStop(0,'#103041');g.addColorStop(.48,'#081d2b');g.addColorStop(1,'#030b13');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 for(const p of decor){p.y-=p.speed*.012;if(p.y<-5){p.y=H+5;p.x=Math.random()*W}ctx.globalAlpha=p.a*(.6+.4*Math.sin(t*.001+p.phase));ctx.fillStyle='#a0f9f1';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
}

// RENDERIZADOR AVANÇADO DE BOSSES E CRIATURAS (TOTALMENTE EM VETOR/CANVAS)
function drawCreature(x,y,r,angle,color,kind,t,playerCreature=false,hit=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);
 const wobble=Math.sin(t*.005+(x+y)*.01);
 const skin=(playerCreature?(skinData.find(s=>s.id===equippedSkin)||skinData[0]):null);

 if(kind==='leviathan'){
  // LEVIATÃ DAS FOSSAS: Colosso serpentino com nadadeiras biossensoriais fluidas
  ctx.save();ctx.strokeStyle='#4ce0d1';ctx.lineWidth=r*.45;ctx.lineCap='round';
  for(let i=3;i>0;i--){const off=Math.sin(t*.004-i*.5)*r*.4;ctx.beginPath();ctx.arc(0,off,r*(1.2+i*.3),-Math.PI*.6,Math.PI*.6);ctx.stroke();}
  ctx.fillStyle='#04222b';ctx.beginPath();ctx.arc(0,0,r*1.5,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#7efcf5';ctx.lineWidth=3;ctx.stroke();
  // Cristais dorsais
  ctx.fillStyle='#e0ffff';for(let k=0;k<5;k++){const fx=-r+k*r*.5;ctx.beginPath();ctx.moveTo(fx,-r*.8);ctx.lineTo(fx+r*.2,-r*1.6);ctx.lineTo(fx+r*.4,-r*.8);ctx.fill();}
  ctx.restore();
 } else if(kind==='maw'){
  // A BOCA DO ABISMO: Esfera sombria com mandíbula estelar e fileiras de dentes pulsantes
  ctx.save();ctx.fillStyle='#0c0316';ctx.strokeStyle='#c16cff';ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(0,0,r*1.6,0,Math.PI*2);ctx.fill();ctx.stroke();
  // Mandíbula aberta com dentes brilhantes
  ctx.fillStyle='#ff3377';ctx.beginPath();ctx.arc(r*.3,0,r*.9+Math.sin(t*.01)*r*.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffffff';for(let d=0;d<8;d++){const a=d*(Math.PI/4);ctx.beginPath();ctx.arc(r*.3+Math.cos(a)*r*.6,Math.sin(a)*r*.6,3,0,Math.PI*2);ctx.fill();}
  ctx.restore();
 } else if(kind==='angler'){
  // LANTERNA MORTAL: Predador blindado com antena bulbosa luminosa e espinhos dorsais
  ctx.save();ctx.fillStyle='#2b1a0c';ctx.strokeStyle='#ffb45e';ctx.lineWidth=3.5;
  ctx.beginPath();ctx.ellipse(0,0,r*1.3,r*1.1,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  // Haste e antena de luz
  ctx.strokeStyle='#ffd285';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-r);ctx.quadraticCurveTo(r*.8,-r*2,r*1.4,-r*1.8);ctx.stroke();
  const pulse=1+Math.sin(t*.015)*.3;
  ctx.fillStyle='#fff6cc';ctx.shadowBlur=25;ctx.shadowColor='#ffb45e';
  ctx.beginPath();ctx.arc(r*1.4,-r*1.8,r*.4*pulse,0,Math.PI*2);ctx.fill();ctx.restore();
 } else if(kind==='boss'){
  // ABERRAÇÃO SUPREMA: Núcleo mecânico-abissal com aura escarlate flamejante
  ctx.save();ctx.fillStyle='#26040e';ctx.strokeStyle='#ff315f';ctx.lineWidth=4;
  ctx.shadowBlur=30;ctx.shadowColor='#ff315f';
  ctx.beginPath();ctx.arc(0,0,r*1.4,0,Math.PI*2);ctx.fill();ctx.stroke();
  // Chifres ramificados
  ctx.beginPath();ctx.moveTo(-r*.5,-r*.8);ctx.lineTo(-r*1.2,-r*1.8);ctx.lineTo(-r*.2,-r*1.2);
  ctx.moveTo(r*.5,-r*.8);ctx.lineTo(r*1.2,-r*1.8);ctx.lineTo(r*.2,-r*1.2);ctx.stroke();
  ctx.restore();
 } else {
  // Criaturas normais e Jogador
  const grad=ctx.createRadialGradient(-r*.3,-r*.35,1,0,0,r*1.2);
  grad.addColorStop(0,playerCreature?'#e5ffff':'#ffd5e1');
  grad.addColorStop(.22,hit>0?'#ffffff':color);
  grad.addColorStop(.72,playerCreature?'#176a85':'#532c64');
  grad.addColorStop(1,'#091629');
  ctx.fillStyle=grad;ctx.shadowBlur=playerCreature?22:16;ctx.shadowColor=color;ctx.beginPath();
  ctx.ellipse(0,0,r*(1+wobble*.04),r*(.9-wobble*.03),0,0,Math.PI*2);ctx.fill();
  
  if(playerCreature && skin?.shape==='halo'){
   ctx.save();ctx.rotate(Math.sin(t*.0015)*.08);ctx.strokeStyle='#fff0b8';ctx.lineWidth=2;ctx.shadowBlur=20;ctx.shadowColor='#fff0b8';
   ctx.beginPath();ctx.ellipse(0,-r*1.1,r*.6,r*.18,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  if(playerCreature && skin?.shape==='glacier'){
   ctx.save();ctx.fillStyle='#bfe3ff';ctx.shadowBlur=15;ctx.shadowColor='#52a5ff';
   ctx.beginPath();ctx.moveTo(0,-r*1.4);ctx.lineTo(-r*.3,-r*.9);ctx.lineTo(r*.3,-r*.9);ctx.closePath();ctx.fill();ctx.restore();
  }
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
   if(['boss','leviathan','maw','angler'].includes(e.kind)){
    ctx.fillStyle='#ffd8e2';ctx.font='bold 11px sans-serif';ctx.textAlign='center';
    const names={boss:'ABERRAÇÃO SUPREMA',leviathan:'LEVIATÃ DAS FOSSAS',maw:'BOCA DO ABISMO',angler:'LANTERNA MORTAL'};
    ctx.fillText(names[e.kind],e.x,e.y-e.r-22);
   }
  }
 }
 for(const p of particles){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
 if(player){drawCreature(player.x,player.y,player.r,player.angle,currentSkinColor(),'player',t,true);}
 ctx.restore();
}

function loop(t){const dt=Math.min(.035,Math.max(0,(t-last)/1000||0));last=t;if(gameState==='playing')update(dt);draw(t);requestAnimationFrame(loop)}
window.addEventListener('resize',resize);

// LOJA PREMIUM DE SKINS
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
   <button class="shop-btn ${skin.paid?'paid-btn':''}" ${equipped?'disabled':''}>
    ${equipped?'EQUIPADA':owned?'EQUIPAR':skin.paid?skin.price:`COMPRAR · ${skin.price} ◈`}
   </button>
  `;
  const btn=card.querySelector('button');
  if(!equipped){
   btn.addEventListener('click',()=>{
    if(owned){equippedSkin=skin.id;saveCosmetics();renderShop();showToast('SKIN EQUIPADA!');}
    else if(skin.paid){
     alert(`Simulação de Compra Premium: Redirecionando para o Gateway Seguro para adquirir ${skin.name} por R$ ${skin.price.toFixed(2)}...`);
     ownedSkins.push(skin.id);equippedSkin=skin.id;saveCosmetics();renderShop();showToast('COMPRA PREMIUM APROVADA!');
    }
    else if(coins>=skin.price){coins-=skin.price;ownedSkins.push(skin.id);equippedSkin=skin.id;saveCosmetics();renderShop();showToast('SKIN DESBLOQUEADA!');}
    else{showToast('ESSÊNCIA INSUFICIENTE!');}
   });
  }
  grid.appendChild(card);
 });
}

// SISTEMA DE ROLETA DIÁRIA COM ANÚNCIOS
$('watchAdBtn').addEventListener('click',()=>{
 adTickets++; saveCosmetics(); renderShop();
 showToast('Anúncio simulado assistido! +1 Giro Conquistado.');
 audio(880,.2,'triangle',.04);
});
$('openWheelBtn').addEventListener('click',()=>{
 if(adTickets<=0){showToast('Você precisa assistir a um anúncio para ganhar um bilhete!');return;}
 $('shopScreen').hidden=true; $('wheelScreen').hidden=false;
});
$('spinWheelBtn').addEventListener('click',()=>{
 if(adTickets<=0)return;
 adTickets--; saveCosmetics(); renderShop();
 $('spinWheelBtn').disabled=true;
 
 // Probabilidades Matemáticas rigorosas solicitadas:
 // 20 (50%), 50 (25%), 100 (15%), 300 (7.4%), 500 (2.5%), 1000 (0.1%)
 const r=Math.random()*100;
 let prize=20;
 if(r>99.9) prize=1000;
 else if(r>97.4) prize=500;
 else if(r>90.0) prize=300;
 else if(r>75.0) prize=100;
 else if(r>50.0) prize=50;

 const wheelEl=$('wheelSpinner');
 wheelEl.style.transform=`rotate(${1440+Math.random()*360}deg)`;
 setTimeout(()=>{
  coins+=prize; saveCosmetics();
  $('wheelResult').textContent=`PARABÉNS! VOCÊ GANHOU ${prize} MOEDAS ABISSAIS!`;
  $('spinWheelBtn').disabled=false;
  renderShop();
 },3000);
});
$('closeWheelBtn').addEventListener('click',()=>{$('wheelScreen').hidden=true; $('shopScreen').hidden=false;});

// Listeners de Menu e Navegação
$('playBtn').addEventListener('click',startGame);
$('shopBtn').addEventListener('click',()=>{$('shopScreen').hidden=false;renderShop()});
$('shopCloseBtn').addEventListener('click',()=>{$('shopScreen').hidden=true});
$('pauseBtn').addEventListener('click',pauseGame);
$('resumeBtn').addEventListener('click',resumeGame);
$('quitBtn').addEventListener('click',()=>{gameState='menu';$('pauseScreen').hidden=true;$('hud').hidden=true;$('menuScreen').hidden=true;});
$('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'♫':'♪';if(soundOn)startAmbientMusic();else stopAmbientMusic();});

resize();gameState='menu';requestAnimationFrame(loop);
})();