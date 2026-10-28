const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e5 });
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RANKS_FILE = path.join(DATA_DIR, 'rankings.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
const EMPTY_RANKINGS = { eternal: {}, daily: {}, weekly: {}, settled: { day: '', week: '', month: '' } };
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
  rankings = { ...EMPTY_RANKINGS, ...stored.rankings, settled: { ...EMPTY_RANKINGS.settled, ...(stored.rankings.settled || {}) } };
 } else {
  rankings = { ...EMPTY_RANKINGS, ...rankings, settled: { ...EMPTY_RANKINGS.settled, ...(rankings.settled || {}) } };
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
function rankedEntries(board) { return Object.values(board || {}).sort((a, b) => b.survival - a.survival || b.score - a.score).slice(0, 10); }
function awardBoard(board, amount, periodName) { for (const entry of rankedEntries(board)) { const user = users[entry.key]; if (user) user.coins = (user.coins || 0) + amount; } }
function settlePeriods() {
 const d = dayKey(), w = weekKey(), m = monthKey();
 if (rankings.settled.day && rankings.settled.day !== d) awardBoard(rankings.daily[rankings.settled.day], 100, 'diário');
 if (rankings.settled.week && rankings.settled.week !== w) awardBoard(rankings.weekly[rankings.settled.week], 1000, 'semanal');
 if (rankings.settled.month && rankings.settled.month !== m) awardBoard(rankings.eternal, 5000, 'global mensal');
 rankings.settled = { day: d, week: w, month: m }; saveUsers(); saveRanks();
}
function onlineCount() { return io.engine.clientsCount; }
function broadcastOnline() { io.emit('online-count', onlineCount()); }
function rankingPayload() { return { eternal: rankedEntries(rankings.eternal), daily: rankedEntries(rankings.daily[dayKey()]), weekly: rankedEntries(rankings.weekly[weekKey()]) }; }
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'abyssal-server', online: onlineCount(), persistence: pgPool ? 'postgres' : 'local-ephemeral' }));
app.get('/api/rankings', (_req, res) => res.json(rankingPayload()));

const worldPlayers = new Map();
const authAttempts = new Map();
const BOSS_KINDS = new Set(['boss','leviathan','maw','angler']);
const worldState = { initialized:false, elapsed:0, enemies:[], nextEnemyId:0, nextBossAt:60, bossSpawnCount:0, lastBossKind:null, lastBossMaxHp:0, spawnTimer:0, lastTick:Date.now(), snapshotTimer:0, playerSnapshotTimer:0 };
function isBossKind(kind){ return BOSS_KINDS.has(kind); }
function ensureWorld(){
 if(worldState.initialized)return;
 worldState.initialized=true;worldState.elapsed=0;worldState.nextBossAt=60;worldState.bossSpawnCount=0;worldState.lastBossKind=null;worldState.lastBossMaxHp=0;worldState.nextEnemyId=0;worldState.enemies=[];worldState.spawnTimer=.8;worldState.lastTick=Date.now();worldState.snapshotTimer=0;worldState.playerSnapshotTimer=0;
 for(let i=0;i<3;i++)spawnWorldEnemy(true);
}
function spawnWorldEnemy(initial=false){
 if(!worldState.initialized)return null;
 const bossAlive=worldState.enemies.some(e=>isBossKind(e.kind));if(bossAlive&&!initial)return null;
 const side=Math.floor(Math.random()*4);let x=Math.random(),y=Math.random(),pad=.055;
 if(side===0)y=-pad;else if(side===1)x=1+pad;else if(side===2)y=1+pad;else x=-pad;
 const bossDue=!initial&&worldState.elapsed>=worldState.nextBossAt&&!bossAlive;
 let kind;
 if(bossDue){const options=[...BOSS_KINDS].filter(k=>k!==worldState.lastBossKind);kind=options[Math.floor(Math.random()*options.length)]||'boss';worldState.lastBossKind=kind;worldState.nextBossAt=worldState.elapsed+60;}
 else {const t=Math.random();kind=t<.56?'drifter':t<.78?'stinger':t<.94?'brute':'lurker';}
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
 const data={...(bossData[kind]||commonData[kind]||commonData.drifter)};
 if(bossDue){
  const tier=worldState.bossSpawnCount;
  data.hp=worldState.lastBossMaxHp>0?worldState.lastBossMaxHp*1.5:data.hp;
  data.damage=Math.min(95,Math.round(data.damage*Math.pow(1.12,tier)));
  data.speed=Math.min(90,data.speed*Math.pow(1.055,tier));
  worldState.lastBossMaxHp=data.hp;worldState.bossSpawnCount++;
 }
 const enemy={id:++worldState.nextEnemyId,x,y,r:data.r/500,hp:data.hp,maxHp:data.hp,speed:data.speed,damage:data.damage,color:data.color,value:data.value,angle:Math.random()*Math.PI*2,phase:Math.random()*Math.PI*2,hit:0,attackCd:.6,kind};
 worldState.enemies.push(enemy);
 if(worldState.enemies.length>95)worldState.enemies.splice(0,worldState.enemies.length-95);
 return enemy;
}
function worldSnapshot(){return {elapsed:worldState.elapsed,enemies:worldState.enemies.slice(0,120).map(e=>({...e}))};}
function broadcastWorld(){if(worldState.initialized)io.to('abyss').emit('game-snapshot',worldSnapshot());}
function awardWorldBossCoins(){
 const seen=new Set();let changed=false;
 for(const p of worldPlayers.values()){
  if(!p.userKey||seen.has(p.userKey))continue;seen.add(p.userKey);
  const u=users[p.userKey];if(!u)continue;
  u.coins=(u.coins||0)+100;changed=true;io.to(p.id).emit('account-data',publicUser(u));
 }
 if(changed)saveUsers();
}
function processWorldDamage(socket,id,damage){
 if(!socket.data.joined||!Number.isFinite(id)||!Number.isFinite(damage)||damage<=0||damage>1000)return;
 const idx=worldState.enemies.findIndex(e=>e.id===id);if(idx<0)return;
 const enemy=worldState.enemies[idx];enemy.hp-=Math.min(250,damage);enemy.hit=.14;
 if(enemy.hp<=0){
  worldState.enemies.splice(idx,1);const boss=isBossKind(enemy.kind);
  io.to('abyss').emit('world-enemy-defeated',{id:enemy.id,x:enemy.x,y:enemy.y,kind:enemy.kind,value:enemy.value,color:enemy.color,boss});
  io.to('abyss').emit('shared-xp-award',{value:Math.max(1,Math.round(enemy.value)),source:'kill'});
  if(boss){worldState.nextBossAt=worldState.elapsed+60;awardWorldBossCoins();}
 }
 // O próximo snapshot periódico (~12,5 Hz) inclui vida/remoção; não retransmitimos o mundo a cada projétil.
}
function worldTick(){
 const now=Date.now(),dt=Math.max(0,Math.min(.1,(now-worldState.lastTick)/1000));worldState.lastTick=now;
 if(!worldState.initialized)return;
 worldState.elapsed+=dt;
 // O relógio do mundo pertence ao servidor e continua mesmo sem uma aba em primeiro plano.
 // Sem mergulhadores conectados, congelamos encontros para que o retorno não gere hordas artificiais.
 if(worldPlayers.size===0)return;
 worldState.playerSnapshotTimer-=dt;
 if(worldState.playerSnapshotTimer<=0){worldState.playerSnapshotTimer=.08;io.to('abyss').emit('world-players',[...worldPlayers.values()]);}
 worldState.spawnTimer-=dt;
 const activeBoss=worldState.enemies.some(e=>isBossKind(e.kind));
 if(worldState.spawnTimer<=0){if(!activeBoss)spawnWorldEnemy(false);worldState.spawnTimer=activeBoss ? .45 : Math.max(.35,1.02-worldState.elapsed*.003);}
 const players=[...worldPlayers.values()];
 for(const e of worldState.enemies){
  e.hit=Math.max(0,(e.hit||0)-dt);e.attackCd=Math.max(0,(e.attackCd||0)-dt);e.phase=(e.phase||0)+dt*(e.kind==='stinger'?7:3);
  let target=null,best=Infinity;
  for(const p of players){const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx*(p.viewportWidth||1200),dy*(p.viewportHeight||700));if(d<best){best=d;target=p;}}
  if(target&&best>2){
   const dx=target.x-e.x,dy=target.y-e.y,vw=target.viewportWidth||1200,vh=target.viewportHeight||700;
   const px=dx*vw,py=dy*vh,dpx=Math.hypot(px,py)||1;e.angle=Math.atan2(py,px);
   const move=e.speed*dt;e.x+=(px/dpx*move)/vw;e.y+=(py/dpx*move)/vh;
  }
 }
 worldState.snapshotTimer-=dt;if(worldState.snapshotTimer<=0){worldState.snapshotTimer=.08;broadcastWorld();}
}
setInterval(worldTick,50).unref();
io.on('connection', socket => {
 socket.data.nickname = null; socket.data.userKey = null; socket.data.joined = false; broadcastOnline();
 socket.emit('online-count', onlineCount());
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
 socket.on('join-world', () => {
  if (!socket.data.nickname) return socket.emit('server-message', 'Entre com sua conta para participar do modo online.');
  if (socket.data.joined) return;
  ensureWorld();socket.data.joined = true; socket.join('abyss');
  const p = { id: socket.id, nickname: socket.data.nickname, userKey:socket.data.userKey, x: .5, y: .5, angle: 0, viewportWidth:1200, viewportHeight:700, color: '#bd91ff', skinId: users[socket.data.userKey]?.equippedSkin || 'default' }; worldPlayers.set(socket.id, p);
  socket.emit('world-players', [...worldPlayers.values()].filter(x=>x.id!==socket.id)); socket.to('abyss').emit('player-joined', p);
  socket.emit('game-snapshot',worldSnapshot());io.to('abyss').emit('server-message', `${socket.data.nickname} entrou nas profundezas.`); broadcastOnline();
 });
 socket.on('leave-world', () => {
  if (!socket.data.joined) return;
  socket.data.joined = false;worldPlayers.delete(socket.id);socket.leave('abyss');
  socket.to('abyss').emit('player-left', socket.id);io.to('abyss').emit('world-players', [...worldPlayers.values()]);
  if (socket.data.nickname) io.to('abyss').emit('server-message', `${socket.data.nickname} encerrou o mergulho.`);
  socket.emit('world-left');broadcastOnline();
 });
 socket.on('player-position', payload => {
  if (!socket.data.joined || !payload || typeof payload !== 'object') return;
  const p = worldPlayers.get(socket.id); if (!p) return;
  p.x = Math.max(.02, Math.min(.98, Number(payload.x) || .5)); p.y = Math.max(.02, Math.min(.98, Number(payload.y) || .5));
  p.angle = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, Number(payload.angle) || 0));
  p.viewportWidth = Math.max(320, Math.min(3000, Number(payload.viewportWidth) || p.viewportWidth || 1200));
  p.viewportHeight = Math.max(320, Math.min(2200, Number(payload.viewportHeight) || p.viewportHeight || 700));
  const color = String(payload.color || '#bd91ff'); p.color = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#bd91ff';
  const skinId=String(payload.skinId||'default');p.skinId=new Set(['default','violet','solar','toxic','leviathan','thorn','abyssking','royal','glacier','coral','bloodmoon','voidwing','abyssaleye','deepwarden']).has(skinId)?skinId:'default';
 });
 socket.on('player-hit', payload => { if (!socket.data.joined || !payload) return; const x = Number(payload.x), y = Number(payload.y), damage = Number(payload.damage); if (![x,y,damage].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1 || damage < 0 || damage > 1000) return; socket.to('abyss').emit('remote-hit', { x, y, damage, from: socket.data.nickname }); });
 socket.on('game-snapshot', () => {}); // Clientes não publicam mais o estado autoritativo.
 socket.on('request-host-state', () => {});
 socket.on('request-host-transfer', () => {});
 socket.on('shared-shot', payload => { if (!socket.data.joined || !payload) return; const x=Number(payload.x), y=Number(payload.y), vx=Number(payload.vx), vy=Number(payload.vy); if (![x,y,vx,vy].every(Number.isFinite) || x<0 || x>1 || y<0 || y>1 || Math.abs(vx)>1500 || Math.abs(vy)>1500) return; io.to('abyss').emit('shared-shot', { x,y,vx,vy,color:/^#[0-9a-fA-F]{6}$/.test(String(payload.color))?payload.color:'#9bbcff', damage:Math.max(0,Math.min(1000,Number(payload.damage)||0)), special:['pierce','electric','ricochet'].includes(payload.special)?payload.special:null, from:socket.data.nickname, at:Date.now() }); });
 socket.on('shared-damage', payload => { if (!payload) return; processWorldDamage(socket,Number(payload.id),Number(payload.damage)); });
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
 socket.on('submit-run', payload => {
  const key = socket.data.userKey, user = users[key]; if (!key || !user || !payload) return;
  const survival = Math.max(0, Math.min(86400, Number(payload.survival) || 0)), score = Math.max(0, Math.min(1e9, Number(payload.score) || 0)), level = Math.max(1, Math.min(9999, Number(payload.level) || 1));
  if (survival < 1) return; settlePeriods(); const entry = { key, nickname: user.nickname, survival: Math.round(survival), score: Math.round(score), level, updatedAt: new Date().toISOString() };
  const put = board => { const old = board[key]; if (!old || survival > old.survival || (survival === old.survival && score > old.score)) board[key] = entry; };
  rankings.eternal ||= {}; rankings.daily[dayKey()] ||= {}; rankings.weekly[weekKey()] ||= {}; put(rankings.eternal); put(rankings.daily[dayKey()]); put(rankings.weekly[weekKey()]); saveRanks();
  const earned = Math.max(5, Math.floor(score / 35) + level * 2); user.coins = (user.coins || 0) + earned; saveUsers(); socket.emit('run-saved', { earned, account: publicUser(user), rankings: rankingPayload() }); io.emit('rankings-updated', rankingPayload());
 });
 socket.on('disconnect', () => { if (worldPlayers.has(socket.id)) { worldPlayers.delete(socket.id); socket.to('abyss').emit('player-left', socket.id);io.to('abyss').emit('world-players',[...worldPlayers.values()]);if(socket.data.nickname)io.to('abyss').emit('server-message',`${socket.data.nickname} deixou as profundezas.`); } broadcastOnline(); });
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
