const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e5 });
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RANKS_FILE = path.join(DATA_DIR, 'rankings.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
const EMPTY_RANKINGS = { eternal: {}, daily: {}, weekly: {}, monthly: {}, settled: { day: '', week: '', month: '' } };
let users = Object.assign(Object.create(null), readJson(USERS_FILE, {}));
let rankings = readJson(RANKS_FILE, EMPTY_RANKINGS);
let pgPool = null;
let persistenceQueue = Promise.resolve();
function persistState(key, value) {
 if (!pgPool) return;
 // Queue writes in order and snapshot the value now, so parallel socket events cannot reorder them.
 const serialized = JSON.stringify(value);
 persistenceQueue = persistenceQueue.then(() => pgPool.query(
  'INSERT INTO abyssal_state (state_key, state_value, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (state_key) DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = NOW()',
  [key, serialized]
 )).catch(err => console.error(`[persistence] Falha ao salvar ${key} no PostgreSQL:`, err.message));
}
function saveUsers() {
 try { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), { mode: 0o600 }); }
 catch (err) { console.warn('[persistence] Arquivo local indisponível:', err.message); }
 persistState('users', users);
}
function saveRanks() {
 try { fs.writeFileSync(RANKS_FILE, JSON.stringify(rankings, null, 2)); }
 catch (err) { console.warn('[persistence] Arquivo de rankings local indisponível:', err.message); }
 persistState('rankings', rankings);
}
async function initializePersistence() {
 if (!process.env.DATABASE_URL) {
  console.warn('[persistence] DATABASE_URL não configurada. Este deploy usará arquivos locais efêmeros; contas podem desaparecer após reinício/deploy.');
  return;
 }
 let Pool;
 try { ({ Pool } = require('pg')); }
 catch { throw new Error('DATABASE_URL foi configurada, mas o pacote pg não foi instalado. Execute npm install e faça um novo deploy.'); }
 pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
 });
 pgPool.on('error', err => console.error('[persistence] Erro inesperado no pool PostgreSQL:', err.message));
 await pgPool.query('CREATE TABLE IF NOT EXISTS abyssal_state (state_key TEXT PRIMARY KEY, state_value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
 const result = await pgPool.query("SELECT state_key, state_value FROM abyssal_state WHERE state_key IN ('users','rankings')");
 const stored = Object.fromEntries(result.rows.map(row => [row.state_key, row.state_value]));
 if (stored.users && typeof stored.users === 'object' && !Array.isArray(stored.users)) {
  users = Object.assign(Object.create(null), stored.users);
 } else {
  // First run: migrate whatever the old local JSON files still contain into durable storage.
  await pgPool.query("INSERT INTO abyssal_state (state_key,state_value) VALUES ('users',$1::jsonb) ON CONFLICT (state_key) DO NOTHING", [JSON.stringify(users)]);
 }
 if (stored.rankings && typeof stored.rankings === 'object' && !Array.isArray(stored.rankings)) {
  rankings = { ...EMPTY_RANKINGS, ...stored.rankings, monthly: { ...(stored.rankings.monthly || {}) }, settled: { ...EMPTY_RANKINGS.settled, ...(stored.rankings.settled || {}) } };
 } else {
  rankings = { ...EMPTY_RANKINGS, ...rankings, monthly: { ...(rankings.monthly || {}) }, settled: { ...EMPTY_RANKINGS.settled, ...(rankings.settled || {}) } };
  await pgPool.query("INSERT INTO abyssal_state (state_key,state_value) VALUES ('rankings',$1::jsonb) ON CONFLICT (state_key) DO NOTHING", [JSON.stringify(rankings)]);
 }
 console.log(`[persistence] PostgreSQL ativo: ${Object.keys(users).length} contas carregadas.`);
}
async function flushPersistence() { await persistenceQueue; }
function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function safeEqual(a, b) { const aa = Buffer.from(a, 'hex'), bb = Buffer.from(b, 'hex'); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); }
function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function weekKey(d = new Date()) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7)); const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); const week = Math.ceil((((x - yearStart) / 86400000) + 1) / 7); return `${x.getUTCFullYear()}-W${String(week).padStart(2, '0')}`; }
function monthKey(d = new Date()) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
function publicUser(u) { return { nickname: u.nickname, coins: u.coins || 0, ownedSkins: u.ownedSkins || ['default'], equippedSkin: u.equippedSkin || 'default', metaUpgrades: u.metaUpgrades || {} }; }
function rankedEntries(board) { return Object.values(board || {}).sort((a, b) => (Number(b.bossesKilled) || 0) - (Number(a.bossesKilled) || 0) || (Number(b.score) || 0) - (Number(a.score) || 0) || (Number(b.survival) || 0) - (Number(a.survival) || 0)).slice(0, 10); }
function awardBoard(board, amount, periodName) { for (const entry of rankedEntries(board)) { const user = users[entry.key]; if (user) user.coins = (user.coins || 0) + amount; } }
function settlePeriods() {
 const d = dayKey(), w = weekKey(), m = monthKey();
 rankings.monthly ||= {};
 if (rankings.settled.day && rankings.settled.day !== d) awardBoard(rankings.daily[rankings.settled.day], 100, 'diário');
 if (rankings.settled.week && rankings.settled.week !== w) awardBoard(rankings.weekly[rankings.settled.week], 1000, 'semanal');
 if (rankings.settled.month && rankings.settled.month !== m) awardBoard(rankings.monthly[rankings.settled.month], 5000, 'mensal');
 rankings.daily[d] ||= {}; rankings.weekly[w] ||= {}; rankings.monthly[m] ||= {};
 rankings.settled = { day: d, week: w, month: m }; saveUsers(); saveRanks();
}
function onlineCount() { return io.engine.clientsCount; }
function broadcastOnline() { io.emit('online-count', onlineCount()); }
function rankingPayload() { return { eternal: rankedEntries(rankings.eternal), daily: rankedEntries(rankings.daily[dayKey()]), weekly: rankedEntries(rankings.weekly[weekKey()]), monthly: rankedEntries(rankings.monthly?.[monthKey()]) }; }
app.use((req, res, next) => { if (/\.(html|js|css)$/i.test(req.path)) res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); next(); });
app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false, maxAge: 0 }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'abyssal-server', online: onlineCount(), persistence: pgPool ? 'postgres' : 'local-ephemeral', rooms: rooms.size, maxPlayersPerRoom: MAX_PLAYERS_PER_ROOM, maxEnemiesPerRoom: MAX_ENEMIES_PER_ROOM, rankingMetric: 'bossesKilled', world: { width: WORLD_WIDTH, height: WORLD_HEIGHT } }));
app.get('/api/rankings', (_req, res) => res.json(rankingPayload()));

const rooms = new Map();
const authAttempts = new Map();
const BOSS_KINDS = new Set(['boss','leviathan','maw','angler']);
const MAX_PLAYERS_PER_ROOM = 6;
const MAX_ENEMIES_PER_ROOM = 50;
const MAX_BOSSES_PER_ROOM = 4;
const MAX_COMMON_ENEMIES = MAX_ENEMIES_PER_ROOM - MAX_BOSSES_PER_ROOM;
const WORLD_WIDTH = 3600;
const WORLD_HEIGHT = 2200;
const SERVER_STARTED_AT = new Date().toISOString();
const DEFAULT_ROOM_ID = 'MAR-ABERTO';
const allowedSkinIds = new Set(['default','violet','solar','toxic','leviathan','thorn','abyssking','royal','glacier','coral','bloodmoon','voidwing','abyssaleye','deepwarden']);
function isBossKind(kind){ return BOSS_KINDS.has(kind); }
function makeRunStats(){ return { id: crypto.randomUUID(), startedAt: Date.now(), bossesKilled: 0, score: 0, level: 1, settled: false }; }
function makeWorldState(){return {initialized:false,elapsed:0,enemies:[],nextEnemyId:0,nextBossAt:60,bossSpawnCount:0,lastBossKind:null,lastBossMaxHp:0,lastBossDamage:0,lastBossSpeed:0,commonSpawnTimer:.15,lastTick:Date.now(),snapshotTimer:0,playerSnapshotTimer:0};}
function makeRoom({id,name,isPrivate=false,password='',capacity=6}={}){
 const passwordSalt=isPrivate?crypto.randomBytes(16).toString('hex'):null;
 return {id,name,isPrivate,passwordSalt,passwordHash:isPrivate?hashPassword(password,passwordSalt):null,capacity:Math.max(1,Math.min(MAX_PLAYERS_PER_ROOM,Number(capacity)||6)),players:new Map(),world:makeWorldState(),cleanupTimer:null,createdAt:Date.now()};
}
rooms.set(DEFAULT_ROOM_ID,makeRoom({id:DEFAULT_ROOM_ID,name:'Mar Aberto',capacity:6}));
function socketRoom(socket){return socket?.data?.roomId?rooms.get(socket.data.roomId)||null:null;}
function channelFor(room){return `abyss-room:${room.id}`;}
function publicRoomInfo(room){return {id:room.id,code:room.id,name:room.name,isPrivate:room.isPrivate,playerCount:room.players.size,capacity:room.capacity,available:room.players.size<room.capacity};}
function roomList(){return [...rooms.values()].sort((a,b)=>{if(a.id===b.id)return 0;if(a.id===DEFAULT_ROOM_ID)return -1;if(b.id===DEFAULT_ROOM_ID)return 1;return b.players.size-a.players.size;}).map(publicRoomInfo);}
function broadcastRooms(){io.emit('rooms-list',roomList());}
app.get('/api/rooms', (_req,res)=>res.set('Cache-Control','no-store, no-cache, must-revalidate').json({ok:true,rooms:roomList(),serverStartedAt:SERVER_STARTED_AT}));
function randomRoomId(){let id;do{id=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(id));return id;}
function getRoomSnapshot(room){return {room:publicRoomInfo(room),elapsed:room.world.elapsed,enemies:room.world.enemies.slice(0,MAX_ENEMIES_PER_ROOM).map(e=>({...e}))};}
function broadcastWorld(room){if(room?.world?.initialized)io.to(channelFor(room)).volatile.emit('game-snapshot',getRoomSnapshot(room));}
function ensureWorld(room){
 const w=room.world;if(w.initialized)return;
 w.initialized=true;w.elapsed=0;w.nextBossAt=60;w.bossSpawnCount=0;w.lastBossKind=null;w.lastBossMaxHp=0;w.lastBossDamage=0;w.lastBossSpeed=0;w.nextEnemyId=0;w.enemies=[];w.commonSpawnTimer=.8;w.lastTick=Date.now();w.snapshotTimer=0;w.playerSnapshotTimer=0;
 for(let i=0;i<3;i++)spawnWorldEnemy(room,'common',true);
}
function spawnWorldEnemy(room,type='common',initial=false){
 const w=room.world;if(!w.initialized||w.enemies.length>=MAX_ENEMIES_PER_ROOM)return null;
 const bosses=w.enemies.filter(e=>isBossKind(e.kind));
 if(type==='boss'&&bosses.length>=MAX_BOSSES_PER_ROOM)return null;
 if(type!=='boss'&&w.enemies.filter(e=>!isBossKind(e.kind)).length>=MAX_COMMON_ENEMIES)return null;
 // The logical world is identical on desktop and mobile. Fauna enters from four fixed deep-sea vortices.
 const corner=Math.floor(Math.random()*4),insetX=rand(100,290),insetY=rand(90,250);
 let worldX=corner===0?insetX:corner===1?WORLD_WIDTH-insetX:corner===2?insetX:WORLD_WIDTH-insetX;
 let worldY=corner===0?insetY:corner===1?insetY:corner===2?WORLD_HEIGHT-insetY:WORLD_HEIGHT-insetY;
 if(initial){ worldX=clamp(worldX,100,WORLD_WIDTH-100); worldY=clamp(worldY,100,WORLD_HEIGHT-100); }
 let x=worldX/WORLD_WIDTH,y=worldY/WORLD_HEIGHT;
 const bossData={
  boss:{r:40,hp:2820,speed:22,damage:25,color:'#ff315f',value:55},
  leviathan:{r:54,hp:4700,speed:16,damage:34,color:'#4ce0d1',value:90},
  maw:{r:45,hp:3750,speed:25,damage:31,color:'#c16cff',value:75},
  angler:{r:35,hp:3260,speed:30,damage:28,color:'#ffb45e',value:65}
 };
 const commonData={
  drifter:{r:10,hp:22,speed:51,damage:8,color:'#ff769d',value:1},
  stinger:{r:7,hp:13,speed:88,damage:6,color:'#ffbc78',value:2},
  brute:{r:16,hp:65,speed:30,damage:15,color:'#bd88ff',value:4},
  lurker:{r:20,hp:100,speed:43,damage:18,color:'#6e8dff',value:6}
 };
 let kind;
 if(type==='boss'){
  const available=[...BOSS_KINDS].filter(k=>!bosses.some(e=>e.kind===k));
  if(!available.length)return null;
  kind=available[Math.floor(Math.random()*available.length)];
 }else{
  const t=Math.random();kind=t<.56?'drifter':t<.78?'stinger':t<.94?'brute':'lurker';
 }
 const base={...(bossData[kind]||commonData[kind]||commonData.drifter)};
 if(type==='boss'){
  // A vida cresce sempre 50% em relação ao boss mais recentemente criado, independentemente da espécie.
  base.hp=w.lastBossMaxHp>0?w.lastBossMaxHp*1.5:base.hp;
  base.damage=w.lastBossDamage>0?Math.max(base.damage,Math.round(w.lastBossDamage*1.12)):base.damage;
  base.speed=Math.min(90,w.lastBossSpeed>0?Math.max(base.speed,w.lastBossSpeed*1.05):base.speed);
  w.lastBossMaxHp=base.hp;w.lastBossDamage=base.damage;w.lastBossSpeed=base.speed;w.bossSpawnCount++;
 }
 const enemy={id:++w.nextEnemyId,x,y,r:base.r,hp:base.hp,maxHp:base.hp,speed:base.speed,damage:base.damage,color:base.color,value:base.value,angle:Math.random()*Math.PI*2,phase:Math.random()*Math.PI*2,hit:0,attackCd:.6,kind,threat:w.bossSpawnCount};
 w.enemies.push(enemy);
 return enemy;
}
function awardWorldBossCoins(room){
 const seen=new Set();let changed=false;
 for(const p of room.players.values()){
  if(p.runStats&&!p.runStats.settled)p.runStats.bossesKilled=(Number(p.runStats.bossesKilled)||0)+1;
  if(!p.userKey||seen.has(p.userKey))continue;seen.add(p.userKey);
  const u=users[p.userKey];if(!u)continue;
  u.coins=(u.coins||0)+100;changed=true;io.to(p.id).emit('account-data',publicUser(u));
 }
 if(changed)saveUsers();
}
function removeFromRoom(socket,{announce=true,emitResult=true}={}){
 const room=socketRoom(socket);if(!room){socket.data.joined=false;socket.data.roomId=null;return;}
 room.players.delete(socket.id);socket.leave(channelFor(room));socket.data.joined=false;socket.data.roomId=null;
 if(announce&&socket.data.nickname)io.to(channelFor(room)).emit('server-message',`${socket.data.nickname} deixou as profundezas.`);
 socket.to(channelFor(room)).emit('player-left',socket.id);
 io.to(channelFor(room)).volatile.emit('world-players',[...room.players.values()].map(({userKey,...p})=>p));
 if(emitResult)socket.emit('world-left');
 if(room.isPrivate&&room.players.size===0){
  if(room.cleanupTimer)clearTimeout(room.cleanupTimer);
  room.cleanupTimer=setTimeout(()=>{if(room.players.size===0){rooms.delete(room.id);broadcastRooms();}},10*60*1000);room.cleanupTimer.unref?.();
 }
 broadcastRooms();broadcastOnline();
}
function processWorldDamage(socket,id,damage){
 const room=socketRoom(socket);if(!room||!socket.data.joined||!Number.isFinite(id)||!Number.isFinite(damage)||damage<=0||damage>1000)return;
 const w=room.world,idx=w.enemies.findIndex(e=>e.id===id);if(idx<0)return;
 const enemy=w.enemies[idx];enemy.hp-=Math.min(250,damage);enemy.hit=.14;
 if(enemy.hp<=0){
  w.enemies.splice(idx,1);const boss=isBossKind(enemy.kind);
  io.to(channelFor(room)).emit('world-enemy-defeated',{id:enemy.id,x:enemy.x,y:enemy.y,kind:enemy.kind,value:enemy.value,color:enemy.color,boss});
  io.to(channelFor(room)).emit('shared-xp-award',{value:Math.max(1,Math.round(enemy.value)),source:'kill'});
  if(boss)awardWorldBossCoins(room);
 }
}
async function finishRunForSocket(socket,payload={}){
 const key=socket.data.userKey,user=users[key];if(!key||!user)return {ok:false,message:'Entre em uma conta para registrar este mergulho.'};
 const room=socketRoom(socket),member=room?.players.get(socket.id),run=member?.runStats||socket.data.runStats||makeRunStats();
 if(run.settled)return {ok:true,duplicate:true,earned:0,bossesKilled:Number(run.bossesKilled)||0,bossCoins:Number(run.bossesKilled||0)*100,totalRunCoins:0,account:publicUser(user),rankings:rankingPayload()};
 const now=Date.now();
 const survival=Math.max(0,Math.min(86400,Math.floor((now-(Number(run.startedAt)||now))/1000)));
 const score=Math.max(0,Math.min(1e9,Number(payload.score??run.score)||0));
 const level=Math.max(1,Math.min(9999,Math.floor(Number(payload.level??run.level)||1)));
 const bossesKilled=Math.max(0,Math.min(10000,Math.floor(member?(Number(run.bossesKilled)||0):(Number(payload.bossesKilled??run.bossesKilled)||0))));
 run.settled=true;run.score=score;run.level=level;run.bossesKilled=bossesKilled;
 if(member)member.runStats=run;else socket.data.runStats=run;
 settlePeriods();
 const entry={key,nickname:user.nickname,bossesKilled,score:Math.round(score),level,survival:Math.round(survival),updatedAt:new Date().toISOString()};
 const better=(old)=>!old||bossesKilled>(Number(old.bossesKilled)||0)||(bossesKilled===(Number(old.bossesKilled)||0)&&(score>(Number(old.score)||0)||(score===(Number(old.score)||0)&&survival>(Number(old.survival)||0))));
 const put=board=>{if(better(board[key]))board[key]=entry;};
 rankings.eternal ||= {};rankings.daily ||= {};rankings.weekly ||= {};rankings.monthly ||= {};
 rankings.daily[dayKey()] ||= {};rankings.weekly[weekKey()] ||= {};rankings.monthly[monthKey()] ||= {};
 put(rankings.eternal);put(rankings.daily[dayKey()]);put(rankings.weekly[weekKey()]);put(rankings.monthly[monthKey()]);
 const earned=Math.min(50000,Math.max(5,Math.floor(score/35)+level*2));const bossCoins=bossesKilled*100;const unpaidBossCoins=member?0:bossCoins;user.coins=(Number(user.coins)||0)+earned+unpaidBossCoins;run.completionCoins=earned;run.totalRunCoins=earned+bossCoins;
 saveRanks();saveUsers();await flushPersistence();
 const result={ok:true,earned,bossesKilled,bossCoins,totalRunCoins:earned+bossCoins,survival:Math.round(survival),score:Math.round(score),level,account:publicUser(user),rankings:rankingPayload(),message:`Mergulho registrado: ${bossesKilled} boss(es) abatido(s), ${bossCoins} moedas por boss e +${earned} moedas de conclusão.`};
 socket.emit('run-saved',result);io.emit('rankings-updated',rankingPayload());return result;
}
function worldTick(){
 const now=Date.now();
 for(const room of rooms.values()){
  const w=room.world,dt=Math.max(0,Math.min(.1,(now-w.lastTick)/1000));w.lastTick=now;
  if(room.players.size===0)continue;
  if(!w.initialized)ensureWorld(room);
  w.elapsed+=dt;
  w.playerSnapshotTimer-=dt;
  if(w.playerSnapshotTimer<=0){w.playerSnapshotTimer=.1;io.to(channelFor(room)).volatile.emit('world-players',[...room.players.values()].map(({userKey,...p})=>p));}
  // Fauna comum surge continuamente, inclusive enquanto bosses estão vivos. Reservamos 4 vagas para os colossos.
  w.commonSpawnTimer-=dt;
  let commonCount=w.enemies.filter(e=>!isBossKind(e.kind)).length;
  // Watchdog de fauna: nenhum snapshot vazio por travamento de timer ou morte da horda inteira.
  if(commonCount===0&&w.enemies.length<MAX_ENEMIES_PER_ROOM){spawnWorldEnemy(room,'common');commonCount=1;w.commonSpawnTimer=.6;}
  if(w.commonSpawnTimer<=0){
   if(commonCount<MAX_COMMON_ENEMIES&&w.enemies.length<MAX_ENEMIES_PER_ROOM)spawnWorldEnemy(room,'common');
   w.commonSpawnTimer=commonCount<MAX_COMMON_ENEMIES?Math.max(.38,1.02-w.elapsed*.0015):.15;
  }
  // Um boss por janela de 60 s até coexistirem os quatro tipos. Um mesmo tipo não pode coexistir com sua cópia.
  if(w.elapsed>=w.nextBossAt){
   const activeBossCount=w.enemies.filter(e=>isBossKind(e.kind)).length;
   if(activeBossCount<MAX_BOSSES_PER_ROOM&&w.enemies.length<MAX_ENEMIES_PER_ROOM){
    const spawned=spawnWorldEnemy(room,'boss');
    if(spawned)io.to(channelFor(room)).emit('boss-warning',{id:spawned.id,kind:spawned.kind,threat:w.bossSpawnCount});
   }
   w.nextBossAt=w.elapsed+60;
  }
  const players=[...room.players.values()];
  for(const e of w.enemies){
   e.hit=Math.max(0,(e.hit||0)-dt);e.attackCd=Math.max(0,(e.attackCd||0)-dt);e.phase=(e.phase||0)+dt*(e.kind==='stinger'?7:3);
   let target=null,best=Infinity,dxWorld=0,dyWorld=0;
   for(const p of players){const dx=(p.x-e.x)*WORLD_WIDTH,dy=(p.y-e.y)*WORLD_HEIGHT,d=Math.hypot(dx,dy);if(d<best){best=d;target=p;dxWorld=dx;dyWorld=dy;}}
   // Authoritative pursuit in shared world-units. This stays consistent across PC and mobile and never depends on visibility.
   if(target&&best>Math.max(8,Number(e.r)||8)){
    const move=Math.min(best,e.speed*dt),nx=dxWorld/(best||1),ny=dyWorld/(best||1);e.angle=Math.atan2(dyWorld,dxWorld);
    e.x=clamp(e.x+(nx*move)/WORLD_WIDTH,0.025,0.975);e.y=clamp(e.y+(ny*move)/WORLD_HEIGHT,0.025,0.975);
   }
  }
  w.snapshotTimer-=dt;
  // 10 snapshots/s; volatile snapshots prefer current state over queued old coordinates.
  if(w.snapshotTimer<=0){w.snapshotTimer=.1;broadcastWorld(room);}
 }
}
setInterval(worldTick,50).unref();
function windowWidthSafe(value,fallback){return Math.max(320,Math.min(10000,Number(value)||fallback||1200));}
io.on('connection', socket => {
 socket.data.nickname = null; socket.data.userKey = null; socket.data.joined = false; socket.data.roomId = null; broadcastOnline();
 socket.emit('online-count', onlineCount()); socket.emit('rooms-list',roomList());
 socket.on('authenticate', (payload = {}) => {
  const ip = socket.handshake.address || 'unknown', now = Date.now();
  const attempts = (authAttempts.get(ip) || []).filter(t => now - t < 60000);
  if (attempts.length >= 12) return socket.emit('auth-result', { ok: false, message: 'Muitas tentativas. Aguarde um minuto.' });
  const nickname = String(payload.nickname || '').trim(), password = String(payload.password || '');
  if (!/^[a-zA-Z0-9_]{3,18}$/.test(nickname) || password.length < 8 || password.length > 128) return socket.emit('auth-result', { ok: false, message: 'Nickname inválido ou senha fora do limite (8–128 caracteres).' });
  const key = nickname.toLowerCase(); let user = Object.hasOwn(users, key) ? users[key] : null;
  const mode = payload.mode === 'register' ? 'register' : 'login';
  if (mode === 'register') {
   if (user) return socket.emit('auth-result', { ok: false, message: 'Este nickname já existe. Use Entrar ou escolha outro nickname.' });
   const salt = crypto.randomBytes(16).toString('hex');
   user = users[key] = { nickname, salt, passwordHash: hashPassword(password, salt), createdAt: new Date().toISOString(), coins: 0, ownedSkins: ['default'], equippedSkin: 'default', metaUpgrades:{}, lastWheelAt:0 };
   saveUsers();
  } else {
   if (!user) return socket.emit('auth-result', { ok: false, message: 'Conta não encontrada. Clique em Criar conta primeiro.' });
   const candidate = hashPassword(password, user.salt);
   if (!safeEqual(candidate, user.passwordHash)) { attempts.push(now); authAttempts.set(ip, attempts); return socket.emit('auth-result', { ok: false, message: 'Senha incorreta para este nickname.' }); }
  }
  user.metaUpgrades ||= {}; user.ownedSkins ||= ['default']; user.coins ||= 0; user.lastWheelAt ||= 0; socket.data.nickname = user.nickname; socket.data.userKey = key;
  socket.emit('auth-result', { ok: true, mode, ...publicUser(user) });
 });
 socket.on('list-rooms', () => { socket.emit('rooms-list',roomList()); });
 socket.on('create-room', payload => {
  if(!socket.data.nickname||!socket.data.userKey)return socket.emit('room-created',{ok:false,message:'Entre na sua conta antes de criar uma sala.'});
  payload=payload&&typeof payload==='object'?payload:{};
  const name=String(payload.name||'Expedição Abissal').trim().replace(/[<>]/g,'').slice(0,28)||'Expedição Abissal';
  const capacity=Math.max(1,Math.min(MAX_PLAYERS_PER_ROOM,Math.floor(Number(payload.capacity)||6)));
  const isPrivate=Boolean(payload.isPrivate),password=String(payload.password||'');
  if(isPrivate&&(password.length<4||password.length>64))return socket.emit('room-created',{ok:false,message:'A senha da sala privada deve ter entre 4 e 64 caracteres.'});
  if(rooms.size>=60)return socket.emit('room-created',{ok:false,message:'O servidor atingiu o limite temporário de salas. Tente entrar em uma sala existente.'});
  const id=randomRoomId(),room=makeRoom({id,name,isPrivate,password,capacity});rooms.set(id,room);
  if(room.cleanupTimer){clearTimeout(room.cleanupTimer);room.cleanupTimer=null;}
  socket.emit('room-created',{ok:true,room:publicRoomInfo(room),message:`Sala criada. Código de convite: ${id}`});broadcastRooms();io.to(socket.id).emit('rooms-list',roomList());
 });
 socket.on('join-room', payload => {
  if(!socket.data.nickname||!socket.data.userKey)return socket.emit('room-join-result',{ok:false,message:'Entre na sua conta antes de entrar em uma sala.'});
  payload=payload&&typeof payload==='object'?payload:{};
  const id=String(payload.roomId||DEFAULT_ROOM_ID).trim().toUpperCase(),room=rooms.get(id);
  if(!room)return socket.emit('room-join-result',{ok:false,message:'Sala não encontrada. Confira o código de convite.'});
  if(room.isPrivate){const candidate=hashPassword(String(payload.password||''),room.passwordSalt);if(!safeEqual(candidate,room.passwordHash))return socket.emit('room-join-result',{ok:false,message:'Senha incorreta para esta sala privada.'});}
  if(!room.players.has(socket.id)&&room.players.size>=room.capacity)return socket.emit('room-join-result',{ok:false,message:'Esta sala está cheia.'});
  if(socket.data.joined)removeFromRoom(socket,{announce:true,emitResult:false});
  if(room.cleanupTimer){clearTimeout(room.cleanupTimer);room.cleanupTimer=null;}
  socket.data.joined=true;socket.data.roomId=room.id;socket.join(channelFor(room));
  const u=users[socket.data.userKey];
  const p={id:socket.id,nickname:socket.data.nickname,userKey:socket.data.userKey,x:.5,y:.5,angle:0,viewportWidth:windowWidthSafe(payload.viewportWidth,1200),viewportHeight:windowWidthSafe(payload.viewportHeight,700),worldWidth:WORLD_WIDTH,worldHeight:WORLD_HEIGHT,worldZoom:Math.max(.5,Math.min(1.1,Number(payload.worldZoom)||.78)),color:'#bd91ff',skinId:allowedSkinIds.has(u?.equippedSkin)?u.equippedSkin:'default',runStats:makeRunStats()};
  room.players.set(socket.id,p);ensureWorld(room);if(!room.world.enemies.length){for(let i=0;i<3;i++)spawnWorldEnemy(room,'common',true);}
  socket.emit('room-joined',{ok:true,room:publicRoomInfo(room),players:[...room.players.values()].filter(x=>x.id!==socket.id).map(({userKey,...x})=>x),snapshot:getRoomSnapshot(room)});
  socket.to(channelFor(room)).emit('player-joined',((({userKey,...x})=>x)(p)));setTimeout(()=>{if(room.players.has(socket.id)){if(!room.world.enemies.length)for(let i=0;i<3;i++)spawnWorldEnemy(room,'common',true);socket.emit('game-snapshot',getRoomSnapshot(room));broadcastWorld(room);}},120); 
  io.to(channelFor(room)).volatile.emit('world-players',[...room.players.values()].map(({userKey,...x})=>x));
  io.to(channelFor(room)).emit('server-message',`${socket.data.nickname} entrou nas profundezas · ${room.name}.`);broadcastRooms();broadcastOnline();
 });
 socket.on('join-world', () => socket.emit('legacy-join-world', {roomId:DEFAULT_ROOM_ID}));
 socket.on('leave-world', async () => { if(socket.data.userKey&&socket.data.joined) { try { await finishRunForSocket(socket,{}); } catch(err) { console.error('[run] Falha ao finalizar mergulho ao sair:',err.message); } } removeFromRoom(socket,{announce:true,emitResult:true}); });
 socket.on('player-position', payload => {
  if(!socket.data.joined||!payload||typeof payload!=='object')return;
  const room=socketRoom(socket),p=room?.players.get(socket.id);if(!p)return;
  p.x=Math.max(.01,Math.min(.99,Number(payload.x)||.5));p.y=Math.max(.01,Math.min(.99,Number(payload.y)||.5));
  p.angle=Math.max(-Math.PI*2,Math.min(Math.PI*2,Number(payload.angle)||0));
  p.viewportWidth=windowWidthSafe(payload.viewportWidth,p.viewportWidth||1200);p.viewportHeight=windowWidthSafe(payload.viewportHeight,p.viewportHeight||700);p.worldWidth=WORLD_WIDTH;p.worldHeight=WORLD_HEIGHT;p.worldZoom=.78;
  const color=String(payload.color||'#bd91ff');p.color=/^#[0-9a-fA-F]{6}$/.test(color)?color:'#bd91ff';
  const skinId=String(payload.skinId||'default');p.skinId=allowedSkinIds.has(skinId)?skinId:'default';
 });
 socket.on('player-hit', payload => {const room=socketRoom(socket);if(!room||!payload)return;const x=Number(payload.x),y=Number(payload.y),damage=Number(payload.damage);if(![x,y,damage].every(Number.isFinite)||x<0||x>1||y<0||y>1||damage<0||damage>1000)return;socket.to(channelFor(room)).emit('remote-hit',{x,y,damage,from:socket.data.nickname});});
 socket.on('request-world-snapshot',()=>{const room=socketRoom(socket);if(!room||!socket.data.joined)return;ensureWorld(room);if(!room.world.enemies.length)for(let i=0;i<3;i++)spawnWorldEnemy(room,'common',true);socket.emit('game-snapshot',getRoomSnapshot(room));});
 socket.on('begin-run',()=>{if(!socket.data.userKey)return;const room=socketRoom(socket),p=room?.players.get(socket.id);if(p){if(!p.runStats||p.runStats.settled)p.runStats=makeRunStats();}else socket.data.runStats=makeRunStats();});
 socket.on('run-progress',payload=>{if(!socket.data.userKey||!payload||typeof payload!=='object')return;const room=socketRoom(socket),p=room?.players.get(socket.id),run=p?.runStats||socket.data.runStats;if(!run||run.settled)return;run.score=Math.max(0,Math.min(1e9,Number(payload.score)||0));run.level=Math.max(1,Math.min(9999,Number(payload.level)||1));if(!p)run.bossesKilled=Math.max(0,Math.min(10000,Math.floor(Number(payload.bossesKilled)||0)));});
 socket.on('finish-run',async(payload={},ack)=>{try{const result=await finishRunForSocket(socket,payload);if(typeof ack==='function')ack(result);}catch(err){console.error('[run] Falha ao finalizar mergulho:',err.message);if(typeof ack==='function')ack({ok:false,message:'Não foi possível gravar o resultado do mergulho.'});}});
 socket.on('game-snapshot', () => {}); // Clientes nunca publicam o estado autoritativo.
 socket.on('request-host-state', () => {});
 socket.on('request-host-transfer', () => {});
 socket.on('shared-shot', payload => {const room=socketRoom(socket);if(!room||!payload)return;const x=Number(payload.x),y=Number(payload.y),vx=Number(payload.vx),vy=Number(payload.vy);if(![x,y,vx,vy].every(Number.isFinite)||x<0||x>1||y<0||y>1||Math.abs(vx)>1500||Math.abs(vy)>1500)return;io.to(channelFor(room)).volatile.emit('shared-shot',{x,y,vx,vy,color:/^#[0-9a-fA-F]{6}$/.test(String(payload.color))?payload.color:'#9bbcff',damage:Math.max(0,Math.min(1000,Number(payload.damage)||0)),special:['pierce','electric','ricochet'].includes(payload.special)?payload.special:null,from:socket.data.nickname,at:Date.now()});});
 socket.on('shared-damage', payload => {if(!payload)return;processWorldDamage(socket,Number(payload.id),Number(payload.damage));});
 socket.on('shared-xp-award', () => {}); // XP é concedido pelo servidor quando uma criatura é derrotada.
 socket.on('get-rankings', () => socket.emit('rankings-data', rankingPayload()));
 socket.on('get-account', () => { const u = users[socket.data.userKey]; if (u) socket.emit('account-data', publicUser(u)); });
 socket.on('save-cosmetics', payload => { const u = users[socket.data.userKey]; if (!u || !payload) return; const allowed = new Set(['default','violet','solar','toxic','leviathan','thorn','abyssking','royal','glacier','coral','bloodmoon','voidwing','abyssaleye','deepwarden']); u.ownedSkins = [...new Set(['default', ...(u.ownedSkins || []).filter(x => allowed.has(x))])]; if (u.ownedSkins.includes(payload.equippedSkin)) u.equippedSkin = payload.equippedSkin; saveUsers(); socket.emit('account-data', publicUser(u)); });
 socket.on('purchase-skin', payload => {
  const u = users[socket.data.userKey]; if (!u || !payload) return;
  const prices = { violet:1000, solar:2500, toxic:4000, leviathan:6500, thorn:8000, abyssking:10000, royal:12000, glacier:13000, coral:6000, bloodmoon:9000, voidwing:15000, abyssaleye:18000, deepwarden:14000 };
  const id = String(payload.id || ''), price = prices[id];
  if (!price) return socket.emit('purchase-result', { ok:false, message:'Skin indisponível para compra com moedas.' });
  if ((u.ownedSkins || ['default']).includes(id)) return socket.emit('purchase-result', { ok:true, message:'Você já possui esta skin.', account:publicUser(u) });
  if ((u.coins || 0) < price) return socket.emit('purchase-result', { ok:false, message:'Moedas abissais insuficientes.', account:publicUser(u) });
  u.coins -= price; u.ownedSkins = [...(u.ownedSkins || ['default']), id]; u.equippedSkin = id; saveUsers(); socket.emit('purchase-result', { ok:true, message:'Skin desbloqueada e salva na conta!', account:publicUser(u) });
 });
 socket.on('purchase-meta', payload => {
  const u=users[socket.data.userKey];if(!u||!payload)return;
  const catalogue={bulkhead:{price:1800,max:3},focuser:{price:2200,max:3},current:{price:1600,max:3},startShield:{price:3200,max:1},pulse:{price:3500,max:1},dash:{price:4200,max:1}};
  const id=String(payload.id||''),item=catalogue[id];if(!item)return socket.emit('purchase-result',{ok:false,message:'Melhoria indisponível.',account:publicUser(u)});
  u.metaUpgrades ||= {};const current=Number(u.metaUpgrades[id])||0;
  if(current>=item.max)return socket.emit('purchase-result',{ok:false,message:'Esta melhoria já está no nível máximo.',account:publicUser(u)});
  if((u.coins||0)<item.price)return socket.emit('purchase-result',{ok:false,message:'Moedas abissais insuficientes.',account:publicUser(u)});
  u.coins-=item.price;u.metaUpgrades[id]=current+1;saveUsers();socket.emit('purchase-result',{ok:true,message:'Adaptação permanente desbloqueada!',account:publicUser(u)});
 });
 socket.on('spin-wheel', () => {
  const u=users[socket.data.userKey];if(!u)return socket.emit('wheel-result',{ok:false,message:'Entre na sua conta para guardar a recompensa.'});
  const now=Date.now(),cooldown=20*60*60*1000;if(now-(Number(u.lastWheelAt)||0)<cooldown)return socket.emit('wheel-result',{ok:false,message:'Você já usou seu giro premiado recentemente. Volte mais tarde.',account:publicUser(u)});
  // Chamado somente após o callback adViewed da API oficial de anúncio recompensado.
  const roll=Math.random()*100;let reward=roll<40?20:roll<70?50:roll<88?100:roll<96?300:roll<99.9?600:1000;
  u.coins=(u.coins||0)+reward;u.lastWheelAt=now;saveUsers();socket.emit('wheel-result',{ok:true,reward,coins:u.coins,account:publicUser(u),nextSpinAt:now+cooldown});
 });
 socket.on('submit-run', async payload => { try { const result=await finishRunForSocket(socket,payload||{}); socket.emit('run-saved',result); } catch(err) { console.error('[run] Falha no submit-run legado:',err.message); } });
 socket.on('disconnect', () => { if(socket.data.userKey&&(socket.data.joined||socket.data.runStats)){finishRunForSocket(socket,{}).catch(err=>console.error('[run] Falha ao finalizar desconexão:',err.message));} removeFromRoom(socket,{announce:true,emitResult:false}); broadcastOnline(); });
});
setInterval(settlePeriods, 60 * 60 * 1000).unref();
async function boot() {
 await initializePersistence();
 settlePeriods();
 await flushPersistence();
 server.listen(PORT, '0.0.0.0', () => console.log(`Abyssal online em http://localhost:${PORT} · persistência: ${pgPool ? 'PostgreSQL' : 'local efêmera'}`));
}
boot().catch(err => {
 console.error('[boot] O servidor não será iniciado para evitar aceitar contas sem persistência configurada/funcional:', err);
 process.exit(1);
});
let shutdownStarted = false;
async function shutdown(signal) {
 if (shutdownStarted) return; shutdownStarted = true;
 console.log(`[shutdown] ${signal}: fechando conexões e salvando dados pendentes…`);
 const hardStop = setTimeout(() => process.exit(1), 8000); hardStop.unref();
 try {
  await new Promise(resolve => { if (server.listening) server.close(resolve); else resolve(); });
  await flushPersistence();
  if (pgPool) await pgPool.end();
  clearTimeout(hardStop); process.exit(0);
 } catch (err) { console.error('[shutdown] Falha ao finalizar com segurança:', err.message); process.exit(1); }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
