const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { monitorEventLoopDelay } = require('perf_hooks');
const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();
const EnemyAI = require('./public/enemy-ai');
const WorldSimulation = require('./world-simulation');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e5, pingInterval: 25000, pingTimeout: 60000, connectionStateRecovery: { maxDisconnectionDuration: 120000, skipMiddlewares: false } });
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data')); // Override only for isolated tests or an explicit persistent volume.
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RANKS_FILE = path.join(DATA_DIR, 'rankings.json');
const CARDUMES_FILE = path.join(DATA_DIR, 'cardumes.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
const EMPTY_RANKINGS = { eternal: {}, daily: {}, weekly: {}, monthly: {}, settled: { day: '', week: '', month: '' } };
let users = Object.assign(Object.create(null), readJson(USERS_FILE, {}));
let rankings = readJson(RANKS_FILE, EMPTY_RANKINGS);
let cardumes = readJson(CARDUMES_FILE, {});
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
let titleStatsSaveTimer=null;
function scheduleTitleStatsSave() {
 if(titleStatsSaveTimer)return;
 titleStatsSaveTimer=setTimeout(()=>{titleStatsSaveTimer=null;saveUsers();},2000);
 titleStatsSaveTimer.unref?.();
}
function saveCardumes() {
 try { fs.writeFileSync(CARDUMES_FILE, JSON.stringify(cardumes, null, 2), { mode: 0o600 }); }
 catch (err) { console.warn('[persistence] Arquivo de cardumes indisponível:', err.message); }
 persistState('cardumes', cardumes);
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
 const result = await pgPool.query("SELECT state_key, state_value FROM abyssal_state WHERE state_key IN ('users','rankings','cardumes','global_chat')");
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
 if (stored.cardumes && typeof stored.cardumes === 'object' && !Array.isArray(stored.cardumes)) cardumes = stored.cardumes;
 else await pgPool.query("INSERT INTO abyssal_state (state_key,state_value) VALUES ('cardumes',$1::jsonb) ON CONFLICT (state_key) DO NOTHING", [JSON.stringify(cardumes)]);
 if (stored.global_chat && typeof stored.global_chat === 'object' && !Array.isArray(stored.global_chat)) {
  globalChatHistory.splice(0, globalChatHistory.length, ...(Array.isArray(stored.global_chat.messages) ? stored.global_chat.messages.slice(-CHAT_HISTORY_LIMIT) : []));
  globalChatDayKey = String(stored.global_chat.dayKey || globalChatDayKey);
 } else persistGlobalChat();
 resetGlobalChatIfNewDay();
 console.log(`[persistence] PostgreSQL ativo: ${Object.keys(users).length} contas carregadas; chat global restaurado.`);
}
async function flushPersistence() { await persistenceQueue; }
function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function safeEqual(a, b) { const aa = Buffer.from(a, 'hex'), bb = Buffer.from(b, 'hex'); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); }
function hashSessionToken(token) { return crypto.createHash('sha256').update(String(token || '')).digest('hex'); }
function issueSessionToken(user) {
 const now=Date.now(),expiresAt=now+30*24*60*60*1000;
 user.sessionTokens=(Array.isArray(user.sessionTokens)?user.sessionTokens:[]).filter(item=>item&&Number(item.expiresAt)>now);
 const token=crypto.randomBytes(32).toString('hex');
 user.sessionTokens.push({hash:hashSessionToken(token),expiresAt});
 if(user.sessionTokens.length>10)user.sessionTokens=user.sessionTokens.slice(-10);
 return token;
}
function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function weekKey(d = new Date()) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7)); const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); const week = Math.ceil((((x - yearStart) / 86400000) + 1) / 7); return `${x.getUTCFullYear()}-W${String(week).padStart(2, '0')}`; }
function monthKey(d = new Date()) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
const TITLE_DEFINITIONS=[
  {id:'abyss-drifter',kind:'starter',required:0},{id:'abyss-spark',kind:'kills',required:50},
  {id:'current-hunter',kind:'kills',required:250},{id:'pelagic-executioner',kind:'kills',required:1000},
  {id:'leviathan-hunter',kind:'bosses',required:10},{id:'sovereign-abyss',kind:'bosses',required:50},
  {id:'shoal-founder',kind:'cardumesCreated',required:1},
  {id:'supporter-of-the-depths',kind:'likesGiven',required:25},
  {id:'abyssal-famous',kind:'likesReceived',required:10},
  {id:'abyssal-icon',kind:'likesReceived',required:50},
  {id:'living-legend',kind:'likesReceived',required:100}
 ];
 function titleProgress(u,kind){if(kind==='likesReceived')return Array.isArray(u.likedBy)?u.likedBy.length:0;if(kind==='likesGiven')return Array.isArray(u.likedProfiles)?u.likedProfiles.length:0;return Number((u.titleStats||{})[kind==='kills'?'monstersDefeated':kind==='bosses'?'bossesDefeated':kind])||0}
 function unlockedTitleIds(u){return TITLE_DEFINITIONS.filter(t=>t.kind==='starter'||titleProgress(u,t.kind)>=t.required).map(t=>t.id)}
 function publicUser(u) { u.titleStats ||= {monstersDefeated:0,bossesDefeated:0,cardumesCreated:0};u.likedBy ||= [];u.likedProfiles ||= [];u.equippedTitle ||= 'abyss-drifter';return { nickname: u.nickname, coins: u.coins || 0, ownedSkins: u.ownedSkins || ['default'], equippedSkin: u.equippedSkin || 'default', metaUpgrades: u.metaUpgrades || {}, redeemedCodes:u.redeemedCodes||[], cardumeId:u.cardumeId||null, equippedTitle:u.equippedTitle, unlockedTitles:unlockedTitleIds(u), titleStats:u.titleStats, likesReceived:u.likedBy.length, likesGiven:u.likedProfiles.length }; }
 function publicProfile(key,viewerKey){const u=users[key];if(!u)return null;u.titleStats ||= {monstersDefeated:0,bossesDefeated:0,cardumesCreated:0};u.likedBy ||= [];u.likedProfiles ||= [];const c=cardumes[u.cardumeId];return {nickname:u.nickname,equippedTitle:u.equippedTitle||'abyss-drifter',unlockedTitles:unlockedTitleIds(u),titleStats:{...u.titleStats},likesReceived:u.likedBy.length,likesGiven:u.likedProfiles.length,likedByMe:Boolean(viewerKey&&u.likedBy.includes(viewerKey)),isSelf:viewerKey===key,cardume:c?{id:c.id,name:c.name}:null};}
 function onlineAccountKeys(){const keys=new Set();for(const client of io.sockets.sockets.values())if(client.connected&&client.data.userKey)keys.add(client.data.userKey);return keys;}
 function cardumeRoster(c){const online=onlineAccountKeys();return c.members.map(key=>({key,nickname:users[key]?.nickname||key,online:online.has(key),equippedTitle:users[key]?.equippedTitle||'abyss-drifter',likesReceived:Array.isArray(users[key]?.likedBy)?users[key].likedBy.length:0,leader:c.leader===users[key]?.nickname})).filter(m=>users[m.key]).sort((a,b)=>Number(b.online)-Number(a.online)||Number(b.leader)-Number(a.leader)||a.nickname.localeCompare(b.nickname));}
 function emitCardumeRoster(c){if(!c)return;for(const client of io.sockets.sockets.values())if(client.data.userKey&&c.members.includes(client.data.userKey))client.emit('cardume-details',{cardume:{id:c.id,name:c.name,description:c.description,leader:c.leader,members:c.members.length,capacity:c.capacity},roster:cardumeRoster(c)});}
 function broadcastCardumeRosters(){for(const c of Object.values(cardumes))emitCardumeRoster(c);}
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
app.get('/health', (_req,res)=>res.set('Cache-Control','no-store').json({ok:true,service:'abyssal-server',build:'3.5.7',online:onlineCount(),persistence:pgPool?'postgres':'local-ephemeral',eventLoopLag:{meanMs:Number((eventLoopDelay.mean/1e6).toFixed(2)),p95Ms:Number((eventLoopDelay.percentile(95)/1e6).toFixed(2)),maxMs:Number((eventLoopDelay.max/1e6).toFixed(2))},rooms:rooms.size,activeRooms:[...rooms.values()].filter(r=>r.players.size>0).length,activePlayers:[...rooms.values()].reduce((n,r)=>n+r.players.size,0),livingPlayers:[...rooms.values()].reduce((n,r)=>n+livingPlayers(r).length,0),simulatingRooms:[...rooms.values()].filter(r=>hasLivingPlayers(r)).length,maxPlayersPerRoom:MAX_PLAYERS_PER_ROOM,maxEnemiesPerRoom:MAX_ENEMIES_PER_ROOM,rankingMetric:'bossesKilled',roomRegistry:pgPool?(roomRegistryReady?'postgres-ready':'postgres-initializing'):'local-only',roomListPolicy:'public-and-private-metadata',backgroundSimulation:'server-owned',emptyRoomPolicy:'pause-while-occupied-clear-when-empty',simulation:{ticks:worldTickCount,lastTickAt:lastWorldTickAt?new Date(lastWorldTickAt).toISOString():null,tickAgeMs:lastWorldTickAt?Date.now()-lastWorldTickAt:null,errors:worldTickErrors,combat:{...combatDiagnostics},movingRooms:[...rooms.values()].filter(r=>r.players.size>0&&r.world.lastMovementAt>0).length,movingEnemies:[...rooms.values()].reduce((n,r)=>n+(r.world.movingEnemyCount||0),0),totalEnemies:[...rooms.values()].reduce((n,r)=>n+r.world.enemies.length,0),activeRoomDetails:[...rooms.values()].filter(r=>r.players.size>0).map(r=>({id:r.id,players:r.players.size,enemies:r.world.enemies.length,movingEnemies:r.world.movingEnemyCount||0,movementRecoveries:r.world.movementRecoveryCount||0,tickCount:r.world.tickCount||0,elapsed:Math.floor(r.world.elapsed||0),positionUpdates:[...r.players.values()].reduce((n,p)=>n+(p.positionUpdates||0),0),latestPositionAgeMs:Math.max(...[...r.players.values()].map(p=>p.lastPositionAt?Date.now()-p.lastPositionAt:Infinity)),stalePositionPlayers:[...r.players.values()].filter(p=>!p.lastPositionAt||Date.now()-p.lastPositionAt>3000).length,stalePositionAttackSkips:r.world.stalePositionAttackSkips||0,hiddenPlayers:[...r.players.values()].filter(p=>p.clientHidden===true).length,clientReportedEnemies:[...r.players.values()].reduce((n,p)=>n+(p.clientEnemyCount||0),0),clientReportedMovingEnemies:[...r.players.values()].reduce((n,p)=>n+(p.clientMovingEnemies||0),0),clientPredictingPlayers:[...r.players.values()].filter(p=>p.clientPredicting).length,clientMotionAgeMs:Math.max(...[...r.players.values()].map(p=>p.clientMotionAt?Date.now()-p.clientMotionAt:Infinity)),worldId:r.world.worldId,snapshotSeq:r.world.snapshotSeq||0,bossCount:r.world.enemies.filter(e=>isBossKind(e.kind)).length,nextBossIn:Math.max(0,Math.ceil((Number(r.world.nextBossAt)||60)-(Number(r.world.elapsed)||0)))}))},world:{width:WORLD_WIDTH,height:WORLD_HEIGHT,coordinateSystem:'world-units',engine:'server-authoritative-shared-enemies-reliable-snapshots-contact-guard-v4'},worldTickerActive:Boolean(worldTicker),roomsPendingDeletion:pendingRoomDeletion.size}));
app.get('/api/rankings', (_req, res) => res.json(rankingPayload()));
app.get('/favicon.ico', (_req,res)=>res.status(204).end());

const rooms = new Map();
const authAttempts = new Map();
const globalChatHistory=[];
const globalChatRate=new Map();
const CHAT_HISTORY_LIMIT=50,CHAT_MESSAGE_LIMIT=180,CHAT_RATE_WINDOW_MS=10000,CHAT_RATE_MAX=5,CHAT_MIN_INTERVAL_MS=900;
const CHAT_TITLE_IDS=new Set(TITLE_DEFINITIONS.map(t=>t.id));
function saoPauloDayKey(date = new Date()) {
 const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
 const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
 return `${values.year}-${values.month}-${values.day}`;
}
let globalChatDayKey = saoPauloDayKey();
function persistGlobalChat() { persistState('global_chat', { dayKey: globalChatDayKey, messages: globalChatHistory.slice(-CHAT_HISTORY_LIMIT) }); }
function resetGlobalChatIfNewDay() {
 const today = saoPauloDayKey();
 if (globalChatDayKey === today) return false;
 globalChatHistory.length = 0;
 globalChatDayKey = today;
 persistGlobalChat();
 io.emit('global-chat-reset', { dayKey: today });
 console.log(`[chat] Histórico global reiniciado à meia-noite de São Paulo (${today}).`);
 return true;
}
function publicChatMessage(message){return {id:message.id,nickname:message.nickname,titleId:message.titleId,text:message.text,at:message.at};}
function livingPlayers(room) { return [...(room?.players?.values?.() || [])].filter(player => player && player.alive !== false); }
function hasLivingPlayers(room) { return livingPlayers(room).length > 0; }
function playerVitalsPayload(player, extra = {}) {
 return { playerId: player.id, hp: Math.max(0, Number(player.hp) || 0), maxHp: Math.max(1, Number(player.maxHp) || 100), shieldCharges: Math.max(0, Math.min(3, Math.floor(Number(player.shieldCharges) || 0))), alive: player.alive !== false, invulnerabilityMs: Math.max(0, (Number(player.invulnerableUntil) || 0) - Date.now()), ...extra };
}
const BOSS_KINDS = new Set(['boss','leviathan','maw','angler','kraken','devourer']);
const MAX_PLAYERS_PER_ROOM = 6;
const MAX_ENEMIES_PER_ROOM = 400;
const MAX_BOSSES_PER_ROOM = 4;
const MAX_COMMON_ENEMIES = MAX_ENEMIES_PER_ROOM - MAX_BOSSES_PER_ROOM;
const WORLD_WIDTH = EnemyAI.WORLD_WIDTH;
const WORLD_HEIGHT = EnemyAI.WORLD_HEIGHT;
const WORLD_ZOOM = EnemyAI.WORLD_ZOOM; // Shared with the solo renderer.
const SERVER_STARTED_AT = new Date().toISOString();
const SERVER_INSTANCE_ID = crypto.randomUUID();
let worldTickCount = 0;
let lastWorldTickAt = 0;
let worldTickErrors = 0;
const combatDiagnostics = { damageEvents: 0, appliedHits: 0, rejectedHits: 0, kills: 0, bossSpawns: 0, playerAttacks: 0, playerDefeats: 0, lastDamageAt: null, lastBossSpawnAt: null, lastPlayerAttackAt: null, lastDamageReason: null, lastPlayerHit: null, xpOrbsSpawned: 0, xpOrbsCollected: 0, lastXpOrbPickup: null };
let worldTicker = null;
const simulatingRooms = new Set();
let roomRegistryReady = false;
let roomDirectoryQueue = Promise.resolve();
function queueRoomDirectory(work){const run=roomDirectoryQueue.then(work,work);roomDirectoryQueue=run.catch(()=>{});return run;}
const deletingRoomIds = new Set();
const pendingRoomDeletion = new Set();
const DEFAULT_ROOM_ID = 'MAR-ABERTO';
const allowedSkinIds = new Set(['default','violet','solar','toxic','leviathan','thorn','abyssking','royal','glacier','coral','bloodmoon','voidwing','abyssaleye','deepwarden','kraken','aberration','angler','maw','devourer']);
function isBossKind(kind){ return BOSS_KINDS.has(kind); }
function makeRunStats(){ return { id: crypto.randomUUID(), startedAt: Date.now(), bossesKilled: 0, score: 0, level: 1, settled: false }; }
function makeWorldState(){return WorldSimulation.createWorldState();}
function makeRoom({id,name,isPrivate=false,password='',capacity=6}={}){
 const passwordSalt=isPrivate?crypto.randomBytes(16).toString('hex'):null;
 return {id,name,isPrivate,passwordSalt,passwordHash:isPrivate?hashPassword(password,passwordSalt):null,capacity:Math.max(1,Math.min(MAX_PLAYERS_PER_ROOM,Number(capacity)||6)),players:new Map(),world:makeWorldState(),cleanupTimer:null,emptyRoomTimer:null,createdAt:Date.now()};
}
rooms.set(DEFAULT_ROOM_ID,makeRoom({id:DEFAULT_ROOM_ID,name:'Mar Aberto',capacity:6}));
function socketRoom(socket){return socket?.data?.roomId?rooms.get(socket.data.roomId)||null:null;}
function channelFor(room){return `abyss-room:${room.id}`;}
function publicRoomInfo(room){
 const bossCount=room.world.enemies.filter(e=>isBossKind(e.kind)).length;
 return {id:room.id,code:room.id,name:room.name,isPrivate:Boolean(room.isPrivate),playerCount:room.players.size,capacity:room.capacity,available:room.players.size<room.capacity,joinable:true,local:true,state:room.players.size?'INICIADA':'AGUARDANDO',elapsed:Math.floor(room.world.elapsed||0),enemyCount:room.world.enemies.length,bossCount};
}
function sortRoomInfos(list){return list.sort((a,b)=>{if(a.id===DEFAULT_ROOM_ID)return -1;if(b.id===DEFAULT_ROOM_ID)return 1;return (Number(b.playerCount)||0)-(Number(a.playerCount)||0)||String(a.name||'').localeCompare(String(b.name||''));});}
function roomList(){return sortRoomInfos([...rooms.values()].map(publicRoomInfo));}
async function roomListForClients(){
 const merged=new Map();
 if(pgPool&&roomRegistryReady){
  try{
   const result=await pgPool.query("SELECT room_id,name,is_private,capacity,player_count,owner_instance,lease_until,created_at FROM abyssal_rooms WHERE lease_until>NOW() AND player_count>0 ORDER BY player_count DESC,created_at ASC");
   for(const r of result.rows){if(deletingRoomIds.has(r.room_id))continue;const count=Number(r.player_count)||0,capacity=Number(r.capacity)||6;merged.set(r.room_id,{id:r.room_id,code:r.room_id,name:r.name,isPrivate:Boolean(r.is_private),playerCount:count,capacity,available:count<capacity,joinable:r.owner_instance===SERVER_INSTANCE_ID,local:r.owner_instance===SERVER_INSTANCE_ID,remote:r.owner_instance!==SERVER_INSTANCE_ID,state:'INICIADA',elapsed:0,enemyCount:0,bossCount:0,createdAt:r.created_at});}
  }catch(err){console.error('[rooms] Consulta ao diretório falhou; usando instância local:',err.message);}
 }
 // Live in-process rooms contain the authoritative player count and are always joinable by this process.
 for(const room of rooms.values())if(!deletingRoomIds.has(room.id))merged.set(room.id,publicRoomInfo(room));
 if(!merged.has(DEFAULT_ROOM_ID))merged.set(DEFAULT_ROOM_ID,{id:DEFAULT_ROOM_ID,code:DEFAULT_ROOM_ID,name:'Mar Aberto',isPrivate:false,playerCount:0,capacity:6,available:true,joinable:true,local:true,state:'AGUARDANDO',elapsed:0,enemyCount:0,bossCount:0,fallback:true});
 return sortRoomInfos([...merged.values()]);
}
function broadcastRooms(){roomListForClients().then(list=>io.emit('rooms-list',list)).catch(err=>console.error('[rooms] broadcast falhou:',err.message));}
app.get('/api/rooms',async(_req,res)=>{try{const list=await roomListForClients();res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate').set('Pragma','no-cache').json({ok:true,rooms:list,serverStartedAt:SERVER_STARTED_AT,build:'3.5.8',generatedAt:new Date().toISOString()});}catch(err){console.error('[rooms] API falhou:',err.message);res.status(200).set('Cache-Control','no-store').json({ok:true,rooms:roomList(),serverStartedAt:SERVER_STARTED_AT,build:'3.5.8',directoryFallback:true});}});
function randomRoomId(){let id;do{id=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(id));return id;}
function getRoomSnapshot(room, metadata = {}){
 if(!room?.world)return null;
 const world=room.world;world.snapshotSeq=(Number(world.snapshotSeq)||0)+1;
 return {room:publicRoomInfo(room),worldId:String(world.worldId||`${room.id}-${room.createdAt||0}`),snapshotSeq:world.snapshotSeq,elapsed:world.elapsed,serverTime:Date.now(),tickCount:world.tickCount||0,movingEnemyCount:world.movingEnemyCount||0,criticalEnemyIds:Array.isArray(metadata.criticalEnemyIds)?metadata.criticalEnemyIds.map(String):[],criticalReason:metadata.criticalReason||null,enemies:world.enemies.slice(0,MAX_ENEMIES_PER_ROOM).map(e=>({...e})),orbs:(world.orbs||[]).slice(0,220).map(o=>({...o}))};
}
function getRoomContactSnapshot(room, hits = []){
 if(!room?.world?.initialized||!Array.isArray(hits)||!hits.length)return null;
 const world=room.world;
 const hitIds=[...new Set(hits.map(hit=>String(hit?.enemyId??'')).filter(Boolean))];
 const enemies=hitIds.map(id=>{
  const enemy=world.enemies.find(item=>String(item.id)===id);
  return enemy?{id:enemy.id,kind:enemy.kind,x:enemy.x,y:enemy.y,r:enemy.r,hp:enemy.hp,maxHp:enemy.maxHp}:null;
 }).filter(Boolean);
 if(!enemies.length)return null;
 world.snapshotSeq=(Number(world.snapshotSeq)||0)+1;
 return {worldId:String(world.worldId||`${room.id}-${room.createdAt||0}`),snapshotSeq:world.snapshotSeq,serverTime:Date.now(),criticalEnemyIds:enemies.map(enemy=>String(enemy.id)),enemies};
}
// Critical changes are reliable: joins, new entities, deaths and contact attacks must
// never refer to an entity that the client has not received yet. Routine positions stay volatile.
function getRoomMotionSnapshot(room, options = {}){
 if(!room?.world?.initialized||!room.players.size)return null;
 const world=room.world;
 world.snapshotSeq=(Number(world.snapshotSeq)||0)+1;
 const recipient=options.player&&room.players.get(options.player.id)===options.player?options.player:null;
 let bounds=null;
 if(recipient){
  const zoom=clamp(Number(recipient.worldZoom)||WORLD_ZOOM,.35,1.2);
  const viewWidth=windowWidthSafe(recipient.viewportWidth,1200)/zoom;
  const viewHeight=windowWidthSafe(recipient.viewportHeight,700)/zoom;
  const cameraX=clamp((Number(recipient.x)||0)-viewWidth*.5,0,Math.max(0,WORLD_WIDTH-viewWidth));
  const cameraY=clamp((Number(recipient.y)||0)-viewHeight*.5,0,Math.max(0,WORLD_HEIGHT-viewHeight));
  const paddingX=viewWidth*.22,paddingY=viewHeight*.22;
  bounds={left:cameraX-paddingX,right:cameraX+viewWidth+paddingX,top:cameraY-paddingY,bottom:cameraY+viewHeight+paddingY};
 }
 const enemies=recipient?world.enemies.filter(enemy=>isBossKind(enemy.kind)||(enemy.x>=bounds.left&&enemy.x<=bounds.right&&enemy.y>=bounds.top&&enemy.y<=bounds.bottom)):world.enemies;
 const visibleOrbs=recipient?(world.orbs||[]).filter(orb=>orb.x>=bounds.left&&orb.x<=bounds.right&&orb.y>=bounds.top&&orb.y<=bounds.bottom):(world.orbs||[]);
 return {
  worldId:String(world.worldId||`${room.id}-${room.createdAt||0}`),
  snapshotSeq:world.snapshotSeq,elapsed:world.elapsed,serverTime:Date.now(),tickCount:world.tickCount||0,intervalMs:100,
  enemies:enemies.map(e=>[
   e.id,Math.round(Number(e.x)||0),Math.round(Number(e.y)||0),Number(e.hp)||0,Number(e.damageRevision)||0,
   Math.round((Number(e.angle)||0)*100)/100,Math.round((Number(e.phase)||0)*100)/100,
   e.suctionActive===true,Math.round((Number(e.suctionTimer)||0)*100)/100,
   Math.round((Number(e.suctionCooldown)||0)*100)/100,Math.round((Number(e.suctionPulse)||0)*100)/100
  ]),
  ...(options.includeOrbs?{orbIntervalMs:500,orbScope:recipient?'view':'all',orbs:visibleOrbs.slice(0,220).map(o=>[o.id,o.x,o.y,Number(o.phase)||0,Number(o.life)||0])}:{})
 };
}
function getRoomSpawnSnapshot(room, spawnedEnemies = []){
 if(!room?.world?.initialized||!room.players.size||!Array.isArray(spawnedEnemies)||!spawnedEnemies.length)return null;
 const world=room.world;world.snapshotSeq=(Number(world.snapshotSeq)||0)+1;
 return {
  worldId:String(world.worldId||`${room.id}-${room.createdAt||0}`),
  snapshotSeq:world.snapshotSeq,serverTime:Date.now(),elapsed:world.elapsed,tickCount:world.tickCount||0,
  criticalEnemyIds:spawnedEnemies.map(enemy=>String(enemy.id)),
  enemies:spawnedEnemies.map(enemy=>({...enemy}))
 };
}
function getRoomPlayerMotion(room){
 if(!room?.players?.size)return [];
 return [...room.players.values()].map(peer=>[String(peer.id),Number(peer.x)||0,Number(peer.y)||0,Number(peer.angle)||0,String(peer.color||'#bd91ff'),String(peer.skinId||'default')]);
}
function broadcastWorld(room, metadata = {}){if(room?.world?.initialized&&room.players.size)io.to(channelFor(room)).emit('game-snapshot',getRoomSnapshot(room,metadata));}
async function persistRoomRow(room){
 if(!pgPool||!roomRegistryReady||!room||room.id===DEFAULT_ROOM_ID)return;
 if(room.players.size===0){deletingRoomIds.add(room.id);pendingRoomDeletion.add(room.id);return deleteRoomRow(room.id);}
 return queueRoomDirectory(async()=>{
  // Re-check after acquiring the queue: a leave event may have destroyed this room since this write was queued.
  if(rooms.get(room.id)!==room||room.players.size===0||deletingRoomIds.has(room.id)){
   await pgPool.query('DELETE FROM abyssal_rooms WHERE room_id=$1',[room.id]);
   pendingRoomDeletion.delete(room.id);deletingRoomIds.delete(room.id);return;
  }
  await pgPool.query(`INSERT INTO abyssal_rooms(room_id,name,is_private,capacity,player_count,owner_instance,created_at,updated_at,lease_until)
  VALUES($1,$2,$3,$4,$5,$6,to_timestamp($7/1000.0),NOW(),NOW()+INTERVAL '25 seconds')
  ON CONFLICT(room_id) DO UPDATE SET name=EXCLUDED.name,is_private=EXCLUDED.is_private,capacity=EXCLUDED.capacity,player_count=EXCLUDED.player_count,owner_instance=EXCLUDED.owner_instance,updated_at=NOW(),lease_until=NOW()+INTERVAL '25 seconds'`,[room.id,room.name,Boolean(room.isPrivate),room.capacity,room.players.size,SERVER_INSTANCE_ID,room.createdAt||Date.now()]);
 });
}
async function deleteRoomRow(roomId){
 if(roomId===DEFAULT_ROOM_ID){pendingRoomDeletion.delete(roomId);deletingRoomIds.delete(roomId);return;}
 deletingRoomIds.add(roomId);
 if(!pgPool||!roomRegistryReady){pendingRoomDeletion.delete(roomId);deletingRoomIds.delete(roomId);return;}
 try{return await queueRoomDirectory(async()=>{await pgPool.query('DELETE FROM abyssal_rooms WHERE room_id=$1',[roomId]);pendingRoomDeletion.delete(roomId);deletingRoomIds.delete(roomId);});}
 catch(err){pendingRoomDeletion.add(roomId);deletingRoomIds.add(roomId);throw err;}
}
async function heartbeatRoomDirectory(){
 if(!pgPool||!roomRegistryReady)return;
 await queueRoomDirectory(()=>pgPool.query('DELETE FROM abyssal_rooms WHERE lease_until<NOW() OR player_count<=0'));
 for(const id of [...pendingRoomDeletion]){try{await deleteRoomRow(id);}catch(err){console.error('[rooms] tentativa de remover sala órfã falhou:',err.message);}}
 for(const room of rooms.values())if(room.id!==DEFAULT_ROOM_ID&&room.players.size>0)await persistRoomRow(room);
}
async function initializeRoomRegistry(){
 if(!pgPool)return;
 await pgPool.query(`CREATE TABLE IF NOT EXISTS abyssal_rooms(room_id TEXT PRIMARY KEY,name TEXT NOT NULL,is_private BOOLEAN NOT NULL DEFAULT FALSE,capacity INTEGER NOT NULL DEFAULT 6,player_count INTEGER NOT NULL DEFAULT 0,owner_instance TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),lease_until TIMESTAMPTZ NOT NULL)`);
 await pgPool.query('CREATE INDEX IF NOT EXISTS abyssal_rooms_lease_idx ON abyssal_rooms(lease_until)');
 roomRegistryReady=true;
 // Socket memberships and arena simulations live in memory. Old room rows can never be rejoined after a deploy, so discard the directory and repopulate only active rooms.
 await pgPool.query('DELETE FROM abyssal_rooms');
 await heartbeatRoomDirectory();
}
function ensureWorld(room){
 const spawned=WorldSimulation.initializeWorld(room.world,Date.now());
 return spawned;
}
function spawnWorldEnemy(room,type='common',initial=false){
 return WorldSimulation.spawnEnemy(room.world,{type,initial});
}
function clearRoomWorld(room){
 if(!room)return;
 room.world=WorldSimulation.createWorldState(Date.now());
}
function scheduleUnjoinedRoomExpiry(room,delay=30000){
 if(!room||room.id===DEFAULT_ROOM_ID)return;
 if(room.emptyRoomTimer)clearTimeout(room.emptyRoomTimer);
 room.emptyRoomTimer=setTimeout(()=>{
  room.emptyRoomTimer=null;
  if(room.players.size===0&&rooms.get(room.id)===room){
   rooms.delete(room.id);clearRoomWorld(room);deletingRoomIds.add(room.id);pendingRoomDeletion.add(room.id);
   deleteRoomRow(room.id).catch(err=>console.error('[rooms] remoção de sala vazia:',err.message));
   refreshWorldTicker();broadcastRooms();
  }
 },delay);
 room.emptyRoomTimer.unref?.();
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
function refreshWorldTicker(){
 simulatingRooms.clear();
 for(const room of rooms.values())if(hasLivingPlayers(room))simulatingRooms.add(room);
 if(simulatingRooms.size&&!worldTicker){worldTicker=setInterval(worldTick,50);worldTicker.unref?.();}
 else if(!simulatingRooms.size&&worldTicker){clearInterval(worldTicker);worldTicker=null;}
}
function removeFromRoom(socket,{announce=true,emitResult=true}={}){
 const room=socketRoom(socket);
 if(!room){socket.data.joined=false;socket.data.roomId=null;return;}
 const roomId=room.id;
 room.players.delete(socket.id);socket.leave(channelFor(room));socket.data.joined=false;socket.data.roomId=null;
 if(announce&&socket.data.nickname&&room.players.size>0)io.to(channelFor(room)).emit('server-message',`${socket.data.nickname} deixou as profundezas.`);
 socket.to(channelFor(room)).emit('player-left',socket.id);
 io.to(channelFor(room)).emit('world-players',[...room.players.values()].map(({userKey,runStats,...p})=>p));
 if(emitResult)socket.emit('world-left');
 if(room.players.size===0){
  // Empty arenas must stop simulating immediately and release all enemy/particle-like state.
  clearRoomWorld(room);
  if(room.emptyRoomTimer){clearTimeout(room.emptyRoomTimer);room.emptyRoomTimer=null;}
  if(roomId!==DEFAULT_ROOM_ID){
   rooms.delete(roomId);deletingRoomIds.add(roomId);pendingRoomDeletion.add(roomId);
   deleteRoomRow(roomId).then(()=>broadcastRooms()).catch(err=>console.error('[rooms] limpeza da sala vazia:',err.message));
  }
 }else persistRoomRow(room).catch(err=>console.error('[rooms] atualização de contagem:',err.message));
 broadcastRooms();broadcastOnline();refreshWorldTicker();
}
function processWorldDamage(socket,id,damage,skillId=null,batch=null){
 combatDiagnostics.damageEvents++;
 const room=socketRoom(socket);
 const reject=(reason)=>{combatDiagnostics.rejectedHits++;combatDiagnostics.lastDamageReason=reason;return {ok:false,id:Number.isFinite(id)?id:null,reason};};
 if(!room||!socket.data.joined)return reject('not-in-room');
 if(!Number.isSafeInteger(id)||!Number.isFinite(damage)||damage<=0||damage>1000)return reject('invalid-hit');
 const player=room.players.get(socket.id);
 const w=room.world,normalizedId=Number(id),idx=w.enemies.findIndex(e=>Number(e.id)===normalizedId);if(idx<0)return reject('enemy-not-found');
 const enemy=w.enemies[idx],now=Date.now();
 let requestedDamage=damage;
 if(skillId==='kraken-sweep'){
  if(!player||player.skinId!=='kraken')return reject('skin-ability-not-owned');
  const radius=280/WORLD_ZOOM, distance=Math.hypot(Number(player.x)-Number(enemy.x),Number(player.y)-Number(enemy.y));
  if(distance>radius)return reject('skin-ability-out-of-range');
  if(now>(Number(player.krakenSweepWindowUntil)||0)){
   if(now<(Number(player.krakenSweepReadyAt)||0))return reject('skin-ability-cooldown');
   player.krakenSweepReadyAt=now+12000;player.krakenSweepWindowUntil=now+800;player.krakenSweepTargetIds=new Set();
  }
  player.krakenSweepTargetIds ||= new Set();
  if(player.krakenSweepTargetIds.has(normalizedId))return reject('skin-ability-already-hit');
  player.krakenSweepTargetIds.add(normalizedId);
  requestedDamage=Math.min(requestedDamage,48);
 }
 let skinMultiplier=1;
 if(player?.skinId==='toxic')skinMultiplier*=1.12;
 if(player?.skinId==='leviathan'&&isBossKind(enemy.kind))skinMultiplier*=1.25;
 if(player?.skinId==='thorn'&&Math.hypot(Number(player.x)-Number(enemy.x),Number(player.y)-Number(enemy.y))<((Number(enemy.r)||10)+85)/WORLD_ZOOM)skinMultiplier*=1.24;
 if(player?.skinId==='bloodmoon'&&Number(player.maxHp)>0&&Number(player.hp)/Number(player.maxHp)<=0.35)skinMultiplier*=1.3;
 const applied=Math.min(250,requestedDamage*skinMultiplier);
 enemy.hp=Math.max(0,Number(enemy.hp||0)-applied);enemy.hit=.16;enemy.damageRevision=(Number(enemy.damageRevision)||0)+1;
 combatDiagnostics.appliedHits++;combatDiagnostics.lastDamageAt=new Date().toISOString();combatDiagnostics.lastDamageReason=null;
 const damageEvent={ok:true,id:enemy.id,hp:enemy.hp,maxHp:enemy.maxHp,damageRevision:enemy.damageRevision,damage:applied,kind:enemy.kind,enemyX:enemy.x,enemyY:enemy.y,enemyColor:enemy.color,killed:enemy.hp<=0};
 if(batch)batch.damaged.push(damageEvent);
 else io.to(channelFor(room)).emit('world-enemy-damaged',damageEvent);
 if(enemy.hp<=0){
  w.enemies.splice(idx,1);combatDiagnostics.kills++;
  const boss=isBossKind(enemy.kind);
  const killer=users[socket.data.userKey];
  if(killer){
   killer.titleStats ||= {monstersDefeated:0,bossesDefeated:0};
   killer.titleStats.monstersDefeated=(Number(killer.titleStats.monstersDefeated)||0)+1;
   if(boss)killer.titleStats.bossesDefeated=(Number(killer.titleStats.bossesDefeated)||0)+1;
   scheduleTitleStatsSave();
   if(batch)batch.accountUpdated=true;
   else socket.emit('account-data',publicUser(killer));
  }
  const defeatedEvent={id:enemy.id,x:enemy.x,y:enemy.y,kind:enemy.kind,value:enemy.value,color:enemy.color,boss};
  if(batch)batch.defeated.push(defeatedEvent);
  else io.to(channelFor(room)).emit('world-enemy-defeated',defeatedEvent);
  // Each successive boss drops triple the previous boss's base XP: x1, x3, x9...
  // The multiplier is shared by the room and persists across player re-entry.
  if(boss){
   enemy.value=Math.round(Math.max(1,Number(enemy.value)||1)*Math.pow(3,Math.max(0,Number(w.bossesDefeated)||0)));
   w.bossesDefeated=(Number(w.bossesDefeated)||0)+1;
  }
  const orb=WorldSimulation.spawnXpOrb(w,enemy);
  if(orb){
   combatDiagnostics.xpOrbsSpawned++;
   if(batch)batch.orbs.push({...orb});
   else io.to(channelFor(room)).emit('world-xp-orb-spawned',{...orb});
  }
  if(boss)awardWorldBossCoins(room);
  if(player?.skinId==='coral'&&player.alive!==false){
   const healed=Math.min(4,Math.max(0,player.maxHp-player.hp));
   if(healed>0){player.hp+=healed;socket.emit('player-vitals',playerVitalsPayload(player,{reason:'regeneration',healed,serverTime:Date.now()}));}
  }
  // A batch sends one consolidated lifecycle update after every hit has been
  // validated; single-hit compatibility uses the same compact lifecycle events.
  if(batch)batch.worldChanged=true;
 }
 return damageEvent;
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
function tickRoom(room, now) {
 if (!room || room.players.size === 0) { if (room) clearRoomWorld(room); return; }
 const activePlayers = livingPlayers(room);
 if (!activePlayers.length) return;
 const w = room.world;
 // Boss difficulty scales to everyone occupying the room, including players who are
 // temporarily down and may revive; movement and damage still target living players.
 w.roomPlayerCount = room.players.size;
 const result = WorldSimulation.tickWorld(w, activePlayers, now);
 const spawnedEnemies = Array.isArray(result.spawnedEnemies) ? result.spawnedEnemies : [];
 const spawnedBosses = (result.spawnedBosses || []).filter(boss => isBossKind(boss.kind));
 const playerHits = Array.isArray(result.playerHits) ? result.playerHits : [];
 const xpCollected = Array.isArray(result.xpCollected) ? result.xpCollected : [];
 const expiredOrbIds = Array.isArray(result.expiredOrbIds) ? result.expiredOrbIds : [];

 // Full snapshots are reserved for periodic recovery. Entity creation, damage and orb
 // lifecycle changes use compact reliable events; motion stays volatile and view-scoped.
 const criticalEnemyIds=[...new Set([...spawnedEnemies.map(enemy=>String(enemy.id)),...playerHits.map(hit=>String(hit.enemyId))])];
 let criticalSnapshot=null;
 if(result.sendReliableSnapshot){
  const reason=playerHits.length?'enemy-contact':'periodic-baseline';
  criticalSnapshot=getRoomSnapshot(room,{criticalEnemyIds,criticalReason:reason});
  if(criticalSnapshot)io.to(channelFor(room)).emit('game-snapshot',criticalSnapshot);
  // Keep the periodic full-state recovery aligned with world-simulation.js (30 s).
  w.reliableSnapshotTimer=30;
 }else if(spawnedEnemies.length>0){
  const spawnFrame=getRoomSpawnSnapshot(room,spawnedEnemies);
  if(spawnFrame)io.to(channelFor(room)).emit('world-enemies-spawned',spawnFrame);
 }
 if(result.sendSnapshot){
  for(const recipient of activePlayers){
   const motion=getRoomMotionSnapshot(room,{player:recipient,includeOrbs:Boolean(result.sendOrbSnapshot)});
   if(motion)io.to(recipient.id).volatile.emit('enemy-motion',motion);
  }
 }
 let contactSnapshot=null;
 if(!criticalSnapshot&&playerHits.length){
  contactSnapshot=getRoomContactSnapshot(room,playerHits);
  if(contactSnapshot){
   const recipients=new Set(playerHits.map(hit=>String(hit.playerId)));
   for(const playerId of recipients)io.to(playerId).emit('enemy-contact-source',contactSnapshot);
  }else{
   // Fail safe: preserve strict collision verification if the attacker disappeared mid-tick.
   criticalSnapshot=getRoomSnapshot(room,{criticalEnemyIds,criticalReason:'enemy-contact'});
   if(criticalSnapshot)io.to(channelFor(room)).emit('game-snapshot',criticalSnapshot);
   w.reliableSnapshotTimer=1;
  }
 }

 for (const boss of spawnedBosses) {
  combatDiagnostics.bossSpawns++; combatDiagnostics.lastBossSpawnAt = new Date().toISOString();
  io.to(channelFor(room)).emit('boss-warning', { id: boss.id, kind: boss.kind, threat: boss.threat, hp: boss.hp, maxHp: boss.maxHp, elapsed: Math.floor(w.elapsed || 0) });
 }
 // Relay authoritative suction displacement to the affected player's predicted client.
 // Position heartbeats continue normally, keeping the server aligned while controls can fight the pull.
 for (const pull of result.playerSuctionPulls || []) {
  if (!pull || !pull.playerId || (!pull.dx && !pull.dy)) continue;
  io.to(pull.playerId).emit('player-suction-pull', {
   dx: Number(pull.dx) || 0, dy: Number(pull.dy) || 0,
   bossId: pull.bossId, strength: Number(pull.strength) || 0
  });
 }
 if(expiredOrbIds.length)io.to(channelFor(room)).emit('world-xp-orbs-expired',expiredOrbIds);
 // Shared XP orb pickup is decided by the server. A single orb can only be claimed
 // once, and only the winning player receives the XP event. Snapshot above has removed it.
 for (const pickup of xpCollected) {
  combatDiagnostics.xpOrbsCollected++;
  combatDiagnostics.lastXpOrbPickup={at:new Date(now).toISOString(),orbId:pickup.orbId,playerId:pickup.playerId,value:pickup.value};
  io.to(channelFor(room)).emit('world-xp-orb-collected',{orbId:pickup.orbId,playerId:pickup.playerId,value:pickup.value,x:pickup.x,y:pickup.y});
  io.to(pickup.playerId).emit('shared-xp-award',{value:pickup.value,source:'orb',orbId:pickup.orbId});
 }
 // Only the authoritative simulation can produce enemy-contact damage. The reliable
 // snapshot with criticalEnemyIds was delivered first, so the attacker already exists at
 // its actual server position on every client before these vitals arrive.
 for (const hit of playerHits) {
  combatDiagnostics.playerAttacks++;
  combatDiagnostics.lastPlayerAttackAt = new Date().toISOString();
  if (!hit.alive) combatDiagnostics.playerDefeats++;
  const contactSnapshotSeq=criticalSnapshot?.snapshotSeq||contactSnapshot?.snapshotSeq||null;
  combatDiagnostics.lastPlayerHit = { at: new Date(now).toISOString(), enemyId: hit.enemyId, enemyKind: hit.enemyKind, enemyX: hit.enemyX, enemyY: hit.enemyY, playerX: hit.playerX, playerY: hit.playerY, contactDistance: hit.contactDistance, contactRadius: hit.contactRadius, rawContactRadius: hit.rawContactRadius, contactSafetyMargin: hit.contactSafetyMargin, positionAgeMs: hit.positionAgeMs, targetWasHidden: hit.targetWasHidden, playerVelocityX: room.players.get(hit.playerId)?.velocityX||0, playerVelocityY: room.players.get(hit.playerId)?.velocityY||0, damage: hit.damage, blocked: hit.blocked, worldId: w.worldId, snapshotSeq: contactSnapshotSeq };
  // A reliable full or attacker-only snapshot is always emitted before contact vitals.
  io.to(hit.playerId).emit('player-vitals', { ...hit, source: 'enemy', worldId: w.worldId, snapshotSeq: contactSnapshotSeq, reason: hit.blocked ? 'shield-block' : 'enemy-attack', serverTime: now });
  if (!hit.alive) {
   io.to(channelFor(room)).emit('server-message', 'Um mergulhador foi engolido pelas profundezas.');
   io.to(channelFor(room)).emit('world-players', [...room.players.values()].map(({ userKey, runStats, ...peer }) => peer));
  }
 }
 for (const heal of result.playerHeals || []) {
  io.to(heal.playerId).emit('player-vitals', { ...heal, reason: 'regeneration', serverTime: now });
 }
 if (result.sendPlayers) io.to(channelFor(room)).emit('world-players', [...room.players.values()].map(({ userKey, runStats, ...p }) => p));
}

function worldTick() {
 if(!simulatingRooms.size){if(worldTicker){clearInterval(worldTicker);worldTicker=null;}return;}
 const now=Date.now();worldTickCount++;lastWorldTickAt=now;
 for(const room of simulatingRooms){
  if(rooms.get(room.id)!==room){simulatingRooms.delete(room);continue;}
  try{tickRoom(room,now);}
  catch(err){worldTickErrors++;room.world.lastTick=now;console.error(`[simulation] tick failed in room ${room.id}:`,err.stack||err);}
  if(!hasLivingPlayers(room))simulatingRooms.delete(room);
 }
 // Only currently occupied, living rooms are visited in the hot 50 ms loop.
 if(!simulatingRooms.size&&worldTicker){clearInterval(worldTicker);worldTicker=null;}
}

function windowWidthSafe(value,fallback){return Math.max(320,Math.min(10000,Number(value)||fallback||1200));}
io.on('connection', socket => {
 socket.data.nickname = null; socket.data.userKey = null; socket.data.joined = false; socket.data.roomId = null; broadcastOnline();
 socket.emit('online-count', onlineCount()); socket.emit('global-chat-history',globalChatHistory); roomListForClients().then(list=>{if(socket.connected)socket.emit('rooms-list',list)}).catch(err=>{console.error('[rooms] lista inicial falhou:',err.message);if(socket.connected)socket.emit('rooms-list',roomList())});
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
  user.metaUpgrades ||= {}; user.ownedSkins ||= ['default']; user.redeemedCodes ||= []; user.coins ||= 0; user.lastWheelAt ||= 0; user.titleStats ||= {monstersDefeated:0,bossesDefeated:0,cardumesCreated:0}; user.likedBy ||= [];user.likedProfiles ||= []; user.equippedTitle ||= 'abyss-drifter'; socket.data.nickname = user.nickname; socket.data.userKey = key;
  const sessionToken=issueSessionToken(user);saveUsers();
  socket.emit('auth-result', { ok: true, mode, ...publicUser(user), sessionToken });broadcastCardumeRosters();
 });
 socket.on('resume-session',(payload={})=>{
  const token=String(payload?.token||'');
  if(!/^[a-f0-9]{64}$/i.test(token))return socket.emit('session-resumed',{ok:false,message:'Sessão expirada. Entre novamente.'});
  const digest=hashSessionToken(token),now=Date.now();
  const match=Object.entries(users).find(([,user])=>(Array.isArray(user.sessionTokens)?user.sessionTokens:[]).some(item=>item&&Number(item.expiresAt)>now&&safeEqual(item.hash,digest)));
  if(!match)return socket.emit('session-resumed',{ok:false,message:'Sessão expirada. Entre novamente.'});
  const [key,user]=match;
  user.sessionTokens=user.sessionTokens.filter(item=>item&&Number(item.expiresAt)>now);
  user.metaUpgrades ||= {};user.ownedSkins ||= ['default'];user.redeemedCodes ||= [];user.coins ||= 0;user.lastWheelAt ||= 0;user.titleStats ||= {monstersDefeated:0,bossesDefeated:0,cardumesCreated:0};user.likedBy ||= [];user.likedProfiles ||= [];user.equippedTitle ||= 'abyss-drifter';
  socket.data.nickname=user.nickname;socket.data.userKey=key;saveUsers();
  socket.emit('session-resumed',{ok:true,...publicUser(user)});broadcastCardumeRosters();
 });
 socket.on('global-chat-history',()=>socket.emit('global-chat-history',globalChatHistory));
  socket.on('get-public-profile',(payload={})=>{const nickname=String(payload.nickname||'').trim();if(!/^[a-zA-Z0-9_]{3,18}$/.test(nickname))return socket.emit('public-profile-result',{ok:false,message:'Perfil indisponível.'});const key=nickname.toLowerCase(),profile=publicProfile(key,socket.data.userKey||null);if(!profile)return socket.emit('public-profile-result',{ok:false,message:'Jogador não encontrado.'});socket.emit('public-profile-result',{ok:true,profile});});
  socket.on('toggle-profile-like',(payload={})=>{const viewerKey=socket.data.userKey;if(!viewerKey||!users[viewerKey])return socket.emit('profile-like-result',{ok:false,message:'Entre na sua conta para curtir perfis.'});const targetNickname=String(payload.nickname||'').trim();const targetKey=targetNickname.toLowerCase(),target=users[targetKey],viewer=users[viewerKey];if(!target)return socket.emit('profile-like-result',{ok:false,message:'Jogador não encontrado.'});if(targetKey===viewerKey)return socket.emit('profile-like-result',{ok:false,message:'Você não pode curtir seu próprio perfil.'});target.likedBy ||= [];viewer.likedProfiles ||= [];const already=target.likedBy.includes(viewerKey);if(already){target.likedBy=target.likedBy.filter(k=>k!==viewerKey);viewer.likedProfiles=viewer.likedProfiles.filter(k=>k!==targetKey);}else{target.likedBy.push(viewerKey);viewer.likedProfiles.push(targetKey);}saveUsers();socket.emit('profile-like-result',{ok:true,liked:!already,profile:publicProfile(targetKey,viewerKey),account:publicUser(viewer),message:already?'Curtida removida.':'Você curtiu este perfil!'});for(const client of io.sockets.sockets.values())if(client.data.userKey===targetKey){client.emit('account-data',publicUser(target));client.emit('profile-likes-updated',{likesReceived:target.likedBy.length});}});
  socket.on('get-cardume-details',()=>{const user=users[socket.data.userKey],c=user&&cardumes[user.cardumeId];if(!c)return socket.emit('cardume-details',{cardume:null,roster:[]});emitCardumeRoster(c);});

    const publicCardume = c => ({id:c.id,name:c.name,description:c.description,leader:c.leader,members:c.members.length,capacity:c.capacity,createdAt:c.createdAt,open:c.open});
  const sendCardumes = () => socket.emit('cardumes-list',Object.values(cardumes).map(publicCardume).sort((a,b)=>b.members-a.members||a.name.localeCompare(b.name)));
  socket.on('list-cardumes',sendCardumes);
  socket.on('create-cardume',(payload={})=>{
   const key=socket.data.userKey,user=users[key];if(!user)return socket.emit('cardume-action-result',{ok:false,message:'Entre na sua conta para criar um Cardume.'});
   if(user.cardumeId&&cardumes[user.cardumeId])return socket.emit('cardume-action-result',{ok:false,message:'Você já faz parte de um Cardume.'});
   const name=String(payload.name||'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,24),description=String(payload.description||'').replace(/[<>\u0000-\u001f]/g,' ').trim().slice(0,120);
   if(name.length<3)return socket.emit('cardume-action-result',{ok:false,message:'O nome do Cardume deve ter pelo menos 3 caracteres.'});
   if(Object.values(cardumes).some(c=>c.name.toLowerCase()===name.toLowerCase()))return socket.emit('cardume-action-result',{ok:false,message:'Já existe um Cardume com esse nome.'});
   if(Object.keys(cardumes).length>=500)return socket.emit('cardume-action-result',{ok:false,message:'O limite de Cardumes foi atingido.'});
   const id=crypto.randomUUID(),entry={id,name,description,leader:user.nickname,members:[key],capacity:30,open:true,createdAt:Date.now()};cardumes[id]=entry;user.cardumeId=id;user.titleStats ||= {};user.titleStats.cardumesCreated=(Number(user.titleStats.cardumesCreated)||0)+1;saveCardumes();saveUsers();socket.emit('cardume-action-result',{ok:true,message:'Cardume criado! Você é o líder.',cardume:publicCardume(entry),account:publicUser(user)});sendCardumes();emitCardumeRoster(entry);
  });
  socket.on('join-cardume',(payload={})=>{
   const key=socket.data.userKey,user=users[key];if(!user)return socket.emit('cardume-action-result',{ok:false,message:'Entre na sua conta para recrutar-se em um Cardume.'});
   if(user.cardumeId&&cardumes[user.cardumeId])return socket.emit('cardume-action-result',{ok:false,message:'Você já pertence a um Cardume. Saia dele antes de entrar em outro.'});
   const c=cardumes[String(payload.id||'')];if(!c||!c.open)return socket.emit('cardume-action-result',{ok:false,message:'Este Cardume não está disponível.'});
   if(c.members.length>=c.capacity)return socket.emit('cardume-action-result',{ok:false,message:'Este Cardume está cheio.'});
   c.members.push(key);user.cardumeId=c.id;saveCardumes();saveUsers();socket.emit('cardume-action-result',{ok:true,message:'Você entrou no Cardume '+c.name+'.',cardume:publicCardume(c),account:publicUser(user)});sendCardumes();emitCardumeRoster(c);
  });
  socket.on('leave-cardume',()=>{
   const key=socket.data.userKey,user=users[key];if(!user)return socket.emit('cardume-action-result',{ok:false,message:'Entre na sua conta primeiro.'});
   const c=cardumes[user.cardumeId];if(!c)return socket.emit('cardume-action-result',{ok:false,message:'Você não está em um Cardume.'});
   c.members=c.members.filter(member=>member!==key);delete user.cardumeId;
   if(!c.members.length)delete cardumes[c.id];else if(c.leader===user.nickname)c.leader=users[c.members[0]]?.nickname||'Líder';
   saveCardumes();saveUsers();socket.emit('cardume-action-result',{ok:true,message:'Você saiu do Cardume.',account:publicUser(user)});sendCardumes();emitCardumeRoster(c);
  });
socket.on('global-chat-send',(payload={})=>{
   if(!socket.data.userKey||!socket.data.nickname)return socket.emit('global-chat-error',{message:'Entre na sua conta para conversar no chat global.'});
   const now=Date.now(),previous=globalChatRate.get(socket.id)||[];
   const recent=previous.filter(t=>now-t<CHAT_RATE_WINDOW_MS);
   if(recent.length>=CHAT_RATE_MAX||(recent.length&&now-recent[recent.length-1]<CHAT_MIN_INTERVAL_MS)){
    globalChatRate.set(socket.id,recent);return socket.emit('global-chat-error',{message:'Você está transmitindo rápido demais. Aguarde um pouco.'});
   }
   const text=String(payload?.text||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,CHAT_MESSAGE_LIMIT);
   if(!text)return;
   recent.push(now);globalChatRate.set(socket.id,recent);
   const user=users[socket.data.userKey];
   const message={id:crypto.randomUUID(),nickname:socket.data.nickname,titleId:CHAT_TITLE_IDS.has(user?.equippedTitle)?user.equippedTitle:'abyss-drifter',text,at:now};
   globalChatHistory.push(message);if(globalChatHistory.length>CHAT_HISTORY_LIMIT)globalChatHistory.splice(0,globalChatHistory.length-CHAT_HISTORY_LIMIT);
   persistGlobalChat();
   io.emit('global-chat-message',publicChatMessage(message));
   socket.emit('global-chat-sent',{ok:true,id:message.id});
  });
  socket.on('list-rooms', async () => { socket.emit('rooms-list',await roomListForClients()); });
 socket.on('create-room', async payload => {
  if(!socket.data.nickname||!socket.data.userKey)return socket.emit('room-created',{ok:false,message:'Entre na sua conta antes de criar uma sala.'});
  payload=payload&&typeof payload==='object'?payload:{};
  const name=String(payload.name||'Expedição Abissal').trim().replace(/[<>]/g,'').slice(0,28)||'Expedição Abissal';
  const capacity=Math.max(1,Math.min(MAX_PLAYERS_PER_ROOM,Math.floor(Number(payload.capacity)||6)));
  const isPrivate=Boolean(payload.isPrivate),password=String(payload.password||'');
  if(isPrivate&&(password.length<4||password.length>64))return socket.emit('room-created',{ok:false,message:'A senha da sala privada deve ter entre 4 e 64 caracteres.'});
  if(rooms.size>=60)return socket.emit('room-created',{ok:false,message:'O servidor atingiu o limite temporário de salas. Tente entrar em uma sala existente.'});
  const id=randomRoomId(),room=makeRoom({id,name,isPrivate,password,capacity});rooms.set(id,room);
  if(room.cleanupTimer){clearTimeout(room.cleanupTimer);room.cleanupTimer=null;}
  scheduleUnjoinedRoomExpiry(room,30000);
  socket.emit('room-created',{ok:true,room:publicRoomInfo(room),message:`Sala criada. Código para convite: ${id}`});broadcastRooms();io.to(socket.id).emit('rooms-list',await roomListForClients());
 });
 socket.on('join-room', async payload => {
  if(!socket.data.nickname||!socket.data.userKey)return socket.emit('room-join-result',{ok:false,message:'Entre na sua conta antes de entrar em uma sala.'});
  payload=payload&&typeof payload==='object'?payload:{};
  const id=String(payload.roomId||DEFAULT_ROOM_ID).trim().toUpperCase();
  const room=rooms.get(id);
  if(!room){let remote=false;if(pgPool&&roomRegistryReady){try{const q=await pgPool.query('SELECT 1 FROM abyssal_rooms WHERE room_id=$1 AND lease_until>NOW() AND owner_instance<>$2 AND player_count>0',[id,SERVER_INSTANCE_ID]);remote=q.rowCount>0;}catch{}}return socket.emit('room-join-result',{ok:false,message:remote?'Esta sala pertence a outro processo do servidor. Mantenha uma única instância no Render.':'Sala não encontrada ou expirada. Atualize a lista de expedições.'});}
  if(room.isPrivate){const candidate=hashPassword(String(payload.password||''),room.passwordSalt);if(!safeEqual(candidate,room.passwordHash))return socket.emit('room-join-result',{ok:false,message:'Senha incorreta para esta sala privada.'});}
  const existingRoom=socketRoom(socket);
  if(existingRoom&&existingRoom.id===room.id){socket.emit('room-joined',{ok:true,room:publicRoomInfo(room),spawn:{x:p.x,y:p.y},players:[...room.players.values()].filter(x=>x.id!==socket.id).map(({userKey,runStats,...x})=>x),snapshot:getRoomSnapshot(room)});return;}
  if(!room.players.has(socket.id)&&room.players.size>=room.capacity)return socket.emit('room-join-result',{ok:false,message:'Esta sala está cheia.'});
  if(existingRoom)removeFromRoom(socket,{announce:true,emitResult:false});
  if(room.emptyRoomTimer){clearTimeout(room.emptyRoomTimer);room.emptyRoomTimer=null;}
  if(room.cleanupTimer){clearTimeout(room.cleanupTimer);room.cleanupTimer=null;}
  // A room's shared world survives defeats and re-entry. It is cleared only when the
  // last socket leaves the room (removeFromRoom), not when everyone is temporarily dead.
  ensureWorld(room);
  socket.data.joined=true;socket.data.roomId=room.id;socket.join(channelFor(room));
  const u=users[socket.data.userKey];
  const maxHp=100+Math.max(0,Math.min(3,Math.floor(Number(u?.metaUpgrades?.bulkhead)||0)))*8;
  const equippedSkinId=allowedSkinIds.has(u?.equippedSkin)?u.equippedSkin:'default';
  const initialShieldCharges=Math.max(0,Math.min(3,Math.floor(Number(u?.metaUpgrades?.startShield)||0)+(equippedSkinId==='abyssking'?1:0)));
  const now=Date.now();
  const occupiedSpawnSlots=new Set([...room.players.values()].map(player=>Number(player.spawnSlot)).filter(Number.isInteger));
  let spawnIndex=0;while(occupiedSpawnSlots.has(spawnIndex)&&spawnIndex<room.capacity)spawnIndex++;
  const spawnAngle=(Math.PI*2*spawnIndex)/Math.max(1,room.capacity),spawnRadius=95/WORLD_ZOOM;
  const spawnX=clamp(WORLD_WIDTH*.5+Math.cos(spawnAngle)*spawnRadius,80,WORLD_WIDTH-80),spawnY=clamp(WORLD_HEIGHT*.5+Math.sin(spawnAngle)*spawnRadius,80,WORLD_HEIGHT-80);
  const p={id:socket.id,nickname:socket.data.nickname,userKey:socket.data.userKey,spawnSlot:spawnIndex,x:spawnX,y:spawnY,r:13/WORLD_ZOOM,angle:0,hp:maxHp,maxHp,alive:true,shieldCharges:initialShieldCharges,initialShieldCharges,regenLevel:0,magnetStrength:1,regenAccumulator:0,invulnerableUntil:now+5000,skillSelectingUntil:0,lastDamageAt:0,positionUpdates:0,lastPositionAt:now,velocityX:0,velocityY:0,clientHidden:Boolean(payload.clientHidden),positionResumeGraceUntil:0,viewportWidth:windowWidthSafe(payload.viewportWidth,1200),viewportHeight:windowWidthSafe(payload.viewportHeight,700),worldWidth:WORLD_WIDTH,worldHeight:WORLD_HEIGHT,worldZoom:WORLD_ZOOM,color:'#bd91ff',skinId:equippedSkinId,titleId:u?.equippedTitle||'abyss-drifter',runStats:makeRunStats()};
  room.players.set(socket.id,p);ensureWorld(room);if(!room.world.enemies.length)ensureWorld(room);
  socket.emit('room-joined',{ok:true,room:publicRoomInfo(room),players:[...room.players.values()].filter(x=>x.id!==socket.id).map(({userKey,runStats,...x})=>x),snapshot:getRoomSnapshot(room)});
  socket.emit('player-vitals',playerVitalsPayload(p,{reason:'spawn',serverTime:now}));
  socket.to(channelFor(room)).emit('player-joined',((({userKey,runStats,...x})=>x)(p)));
  setTimeout(()=>{if(room.players.has(socket.id)){socket.emit('game-snapshot',getRoomSnapshot(room));broadcastWorld(room);}},120);
  io.to(channelFor(room)).emit('world-players',[...room.players.values()].map(({userKey,runStats,...x})=>x));
  io.to(channelFor(room)).emit('server-message',`${socket.data.nickname} entrou nas profundezas · ${room.name}.`);
  persistRoomRow(room).catch(err=>console.error('[rooms] atualizar contagem após entrada:',err.message));broadcastRooms();broadcastOnline();refreshWorldTicker();
 });
 socket.on('join-world', () => socket.emit('legacy-join-world', {roomId:DEFAULT_ROOM_ID}));
 socket.on('leave-world', async () => { if(socket.data.userKey&&socket.data.joined) { try { await finishRunForSocket(socket,{}); } catch(err) { console.error('[run] Falha ao finalizar mergulho ao sair:',err.message); } } removeFromRoom(socket,{announce:true,emitResult:true}); });
 socket.on('client-visibility', payload => {
  const room=socketRoom(socket),p=room?.players.get(socket.id);if(!room||!p||!socket.data.joined)return;
  p.clientHidden=Boolean(payload?.hidden);p.visibilityUpdatedAt=Date.now();
  if(p.clientHidden){p.velocityX=0;p.velocityY=0;}
  // On resume, don't allow contact hits until the browser's fresh world position arrives.
  if(!p.clientHidden){p.velocityX=0;p.velocityY=0;p.positionResumeGraceUntil=Date.now()+180;}
 });
 socket.on('player-position', (payload, acknowledge) => {
  const ack=(data)=>{if(typeof acknowledge==='function')acknowledge(data)};
  if(!socket.data.joined||!payload||typeof payload!=='object')return ack({ok:false,reason:'not-in-room'});
  const room=socketRoom(socket),p=room?.players.get(socket.id);if(!p)return ack({ok:false,reason:'player-not-found'});
  // Once the server has declared a character dead, late/background heartbeat packets
  // must not move it back into the active world. ACK without updating the last position
  // so a throttled browser can harmlessly send until it receives the death event.
  if(p.alive===false)return ack({ok:true,dead:true,seq:p.lastPositionSeq||0,receivedAt:p.lastPositionAt,positionUpdates:p.positionUpdates||0});
  const x=Number(payload.x),y=Number(payload.y);if(!Number.isFinite(x)||!Number.isFinite(y))return ack({ok:false,reason:'invalid-coordinates'});
  const incomingSeq=Math.max(0,Math.floor(Number(payload.seq)||0));
  if(incomingSeq>0&&incomingSeq<=(Number(p.lastPositionSeq)||0))return ack({ok:true,duplicate:true,seq:p.lastPositionSeq,receivedAt:p.lastPositionAt,positionUpdates:p.positionUpdates||0});
  const receivedAt=Date.now(),previousAt=Number(p.lastPositionAt)||0,deltaSeconds=(receivedAt-previousAt)/1000;
  const previousX=Number(p.x)||0,previousY=Number(p.y)||0,dx=x-previousX,dy=y-previousY,displacement=Math.hypot(dx,dy);
  if(displacement<0.5){p.velocityX=0;p.velocityY=0;}
  else if(deltaSeconds>=0.015&&deltaSeconds<=0.3){let vx=dx/deltaSeconds,vy=dy/deltaSeconds,speed=Math.hypot(vx,vy);if(speed>320){vx=vx/speed*320;vy=vy/speed*320;}p.velocityX=vx;p.velocityY=vy;}
  else {p.velocityX=0;p.velocityY=0;}
  p.x=clamp(x,8/WORLD_ZOOM,WORLD_WIDTH-8/WORLD_ZOOM);p.y=clamp(y,8/WORLD_ZOOM,WORLD_HEIGHT-8/WORLD_ZOOM);p.positionUpdates=(p.positionUpdates||0)+1;p.lastPositionAt=receivedAt;p.positionResumeGraceUntil=0;if(typeof payload.clientHidden==='boolean')p.clientHidden=payload.clientHidden;if(p.clientHidden){p.velocityX=0;p.velocityY=0;}p.lastPositionSeq=incomingSeq||((Number(p.lastPositionSeq)||0)+1);
  p.angle=Math.max(-Math.PI*2,Math.min(Math.PI*2,Number(payload.angle)||0));
  p.viewportWidth=windowWidthSafe(payload.viewportWidth,p.viewportWidth||1200);p.viewportHeight=windowWidthSafe(payload.viewportHeight,p.viewportHeight||700);p.worldWidth=WORLD_WIDTH;p.worldHeight=WORLD_HEIGHT;p.worldZoom=clamp(Number(payload.worldZoom)||WORLD_ZOOM,.35,1.2);
  p.clientEnemyCount=Math.max(0,Math.min(MAX_ENEMIES_PER_ROOM,Math.floor(Number(payload.clientEnemyCount)||0)));
  p.clientMovingEnemies=Math.max(0,Math.min(MAX_ENEMIES_PER_ROOM,Math.floor(Number(payload.clientMovingEnemies)||0)));
  p.clientPredicting=Boolean(payload.clientPredicting);p.clientGameState=String(payload.clientGameState||'unknown').slice(0,24);p.clientMotionAt=Date.now();
  const color=String(payload.color||'#bd91ff');p.color=/^#[0-9a-fA-F]{6}$/.test(color)?color:'#bd91ff';
  const account=users[socket.data.userKey],skinId=String(account?.equippedSkin||'default');
  p.skinId=allowedSkinIds.has(skinId)&&((account?.ownedSkins||['default']).includes(skinId))?skinId:'default';
  // Relay live player transforms independently of world-enemy snapshots. Throttle per room
  // so all clients see movement/skins without flooding Socket.IO with every heartbeat.
  if(receivedAt-(Number(room.lastPlayersBroadcastAt)||0)>=100){
   room.lastPlayersBroadcastAt=receivedAt;
   const motion=getRoomPlayerMotion(room);
   if(motion.length>1)io.to(channelFor(room)).volatile.emit('player-motion',motion);
  }
  ack({ok:true,seq:p.lastPositionSeq,receivedAt:p.lastPositionAt,positionUpdates:p.positionUpdates});
 });
 socket.on('player-build', payload => {
  const room = socketRoom(socket), p = room?.players.get(socket.id);
  if (!p || p.alive === false || !payload || typeof payload !== 'object') return;
  // Only gameplay inputs are accepted; HP/max HP remain server-authoritative.
  p.shieldCharges = clamp(Math.floor(Number(payload.shieldCharges) || 0), 0, 3);
  p.regenLevel = clamp(Math.floor(Number(payload.regenLevel) || 0), 0, 3);
  p.magnetStrength = clamp(Number(payload.magnetStrength) || 1, 1, 4.5);
 });
 socket.on('player-protection', payload => {
  const room = socketRoom(socket), p = room?.players.get(socket.id);
  if (!p || p.alive === false || !payload || typeof payload !== 'object') return;
  const seconds = Number(payload.seconds), reason = String(payload.reason || 'gameplay');
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 25) return;
  const now = Date.now();
  // Rate-limit gameplay grants and track the skill-selection window so enemy AI can retarget.
  if (reason === 'upgrade-offer') {
   if (seconds !== 25 || (Number(p.upgradeProtectionUntil) || 0) > now) return;
   p.skillSelectingUntil = now + 25000;
   p.upgradeProtectionUntil = now + 25000;
   p.invulnerableUntil = Math.max(Number(p.invulnerableUntil) || 0, p.upgradeProtectionUntil);
   return;
  }
  if (reason === 'upgrade-selected') {
   if (now > (Number(p.upgradeProtectionUntil) || 0) + 1000 || seconds !== 3) return;
   p.upgradeProtectionUntil = 0;
   p.skillSelectingUntil = 0;
   p.invulnerableUntil = now + 3000;
   return;
  }
  if (reason === 'dash') {
   if (seconds > 1.25 || now - (Number(p.lastDashProtectionAt) || 0) < 15000) return;
   p.lastDashProtectionAt = now;
   p.invulnerableUntil = Math.max(Number(p.invulnerableUntil) || 0, now + seconds * 1000);
   return;
  }
  if (now - (Number(p.lastProtectionRequestAt) || 0) < 1000) return;
  p.lastProtectionRequestAt = now;
  p.invulnerableUntil = Math.max(Number(p.invulnerableUntil) || 0, now + seconds * 1000);
 });
 socket.on('request-player-state', () => {
  const room = socketRoom(socket), p = room?.players.get(socket.id);
  if (!p) return;
  socket.emit('player-vitals', playerVitalsPayload(p, { reason: 'resync', serverTime: Date.now() }));
 });
 socket.on('player-hit', payload => {const room=socketRoom(socket);if(!room||!payload)return;const x=Number(payload.x),y=Number(payload.y),damage=Number(payload.damage);if(![x,y,damage].every(Number.isFinite)||x<0||x>1||y<0||y>1||damage<0||damage>1000)return;socket.to(channelFor(room)).emit('remote-hit',{x,y,damage,from:socket.data.nickname});});
 socket.on('request-world-snapshot',(payload={})=>{const room=socketRoom(socket);if(!room||!socket.data.joined)return;
  // Resuming a minimized tab may request a snapshot after server-side death. That must
  // not silently create a new horde or restart the clock; only join/begin-run initializes.
  if(!hasLivingPlayers(room)){const emptySnapshot=getRoomSnapshot(room,{criticalReason:'empty-world'});if(emptySnapshot){emptySnapshot.enemies=[];emptySnapshot.orbs=[];}socket.emit('game-snapshot',emptySnapshot);return;}
  ensureWorld(room);if(!room.world.enemies.length)ensureWorld(room);
  const reason=String(payload?.reason||'manual');
  const resumeResync=reason==='resume-resync';
  const snapshot=getRoomSnapshot(room,{criticalReason:resumeResync?'resume-resync':reason==='contact-resync'?'contact-resync':reason==='room-join'?'room-join':null,criticalEnemyIds:resumeResync?room.world.enemies.map(e=>String(e.id)):[]});
  socket.emit('game-snapshot',snapshot);});
 socket.on('revive-player',()=>{
  const room=socketRoom(socket),p=room?.players.get(socket.id);
  if(!socket.data.userKey||!p||p.alive!==false)return socket.emit('revive-result',{ok:false,message:'Este mergulho não pode ser retomado agora.'});
  const now=Date.now();p.alive=true;p.hp=p.maxHp;p.shieldCharges=p.initialShieldCharges||0;p.invulnerableUntil=now+3000;p.skillSelectingUntil=0;p.upgradeProtectionUntil=0;p.regenAccumulator=0;
  if(!room.world.initialized||!room.world.enemies.length)ensureWorld(room);
  socket.emit('revive-result',{ok:true,message:'Ressurreição concluída! Seu nível e suas habilidades foram preservados.'});
  socket.emit('player-vitals',playerVitalsPayload(p,{reason:'revive',serverTime:now}));
  io.to(channelFor(room)).emit('world-players',[...room.players.values()].map(({userKey,runStats,...peer})=>peer));refreshWorldTicker();
 });
 socket.on('begin-run',()=>{
  if(!socket.data.userKey)return;
  const room=socketRoom(socket),p=room?.players.get(socket.id);
  if(p){
   if(!p.runStats||p.runStats.settled){p.runStats=makeRunStats();p.runLevel=1;p.energy=0;}
   if(p.alive===false){p.alive=true;p.hp=p.maxHp;p.shieldCharges=p.initialShieldCharges||0;p.invulnerableUntil=Date.now()+5000;p.skillSelectingUntil=0;p.regenAccumulator=0;}
   ensureWorld(room);
   socket.emit('player-vitals',playerVitalsPayload(p,{reason:'run-start',serverTime:Date.now()}));
   socket.emit('game-snapshot',getRoomSnapshot(room,{criticalReason:'resume-resync'}));
   broadcastWorld(room);
   refreshWorldTicker();
  } else socket.data.runStats=makeRunStats();
 });
 socket.on('run-progress',payload=>{if(!socket.data.userKey||!payload||typeof payload!=='object')return;const room=socketRoom(socket),p=room?.players.get(socket.id),run=p?.runStats||socket.data.runStats;if(!run||run.settled)return;run.score=Math.max(0,Math.min(1e9,Number(payload.score)||0));const previousLevel=Math.max(1,Math.floor(Number(p?.runLevel)||Number(run.level)||1));run.level=Math.max(1,Math.min(9999,Math.floor(Number(payload.level)||1)));if(p){const account=users[socket.data.userKey];if(run.level>previousLevel&&p.alive!==false){p.hp=p.maxHp;socket.emit('player-vitals',playerVitalsPayload(p,{reason:'level-up',serverTime:Date.now()}));}p.energy=run.score;p.runLevel=run.level;p.runNickname=account?.nickname||p.nickname;const ranking=[...room.players.values()].filter(peer=>peer.alive!==false).map(peer=>({id:peer.id,nickname:peer.runNickname||peer.nickname||'Mergulhador',energy:Math.max(0,Number(peer.energy)||0)})).sort((a,b)=>b.energy-a.energy||a.nickname.localeCompare(b.nickname)).slice(0,6).map((peer,index)=>({...peer,rank:index+1}));io.to(channelFor(room)).volatile.emit('run-energy-ranking',ranking);}else run.bossesKilled=Math.max(0,Math.min(10000,Math.floor(Number(payload.bossesKilled)||0)));});
 socket.on('finish-run',async(payload={},ack)=>{try{const result=await finishRunForSocket(socket,payload);if(typeof ack==='function')ack(result);}catch(err){console.error('[run] Falha ao finalizar mergulho:',err.message);if(typeof ack==='function')ack({ok:false,message:'Não foi possível gravar o resultado do mergulho.'});}});
 socket.on('game-snapshot', () => {}); // Clientes nunca publicam o estado autoritativo.
 socket.on('request-host-state', () => {});
 socket.on('request-host-transfer', () => {});
 socket.on('shared-shot', payload => {const room=socketRoom(socket);if(!room||!payload)return;const x=Number(payload.x),y=Number(payload.y),vx=Number(payload.vx),vy=Number(payload.vy);if(![x,y,vx,vy].every(Number.isFinite)||x<0||x>1||y<0||y>1||Math.abs(vx)>1500||Math.abs(vy)>1500)return;io.to(channelFor(room)).volatile.emit('shared-shot',{x,y,vx,vy,color:/^#[0-9a-fA-F]{6}$/.test(String(payload.color))?payload.color:'#9bbcff',damage:Math.max(0,Math.min(1000,Number(payload.damage)||0)),special:['pierce','electric','ricochet','photon'].includes(payload.special)?payload.special:null,from:socket.data.nickname,at:Date.now()});});
 socket.on('shared-damage', (payload,acknowledge) => {const skillId=String(payload?.skillId||'').slice(0,32);const result=processWorldDamage(socket,Number(payload?.id),Number(payload?.damage),skillId);if(typeof acknowledge==='function')acknowledge(result);});
 socket.on('shared-damage-batch',(payload={},acknowledge)=>{
  const ack=data=>{if(typeof acknowledge==='function')acknowledge(data)};
  const room=socketRoom(socket);
  if(!room||!socket.data.joined)return ack({ok:false,reason:'not-in-room',accepted:0});
  const hits=Array.isArray(payload?.hits)?payload.hits.slice(0,128):[];
  if(!hits.length)return ack({ok:false,reason:'empty-batch',accepted:0});
  const batch={damaged:[],defeated:[],orbs:[],accountUpdated:false,worldChanged:false};
  let accepted=0,rejected=0;
  for(const hit of hits){
   const result=processWorldDamage(socket,Number(hit?.id),Number(hit?.damage),String(hit?.skillId||'').slice(0,32),batch);
   if(result?.ok)accepted++;else rejected++;
  }
  if(batch.damaged.length)io.to(channelFor(room)).emit('world-enemies-damaged',batch.damaged);
  if(batch.defeated.length)io.to(channelFor(room)).emit('world-enemies-defeated',batch.defeated);
  if(batch.orbs.length)io.to(channelFor(room)).emit('world-xp-orbs-spawned',batch.orbs);
  if(batch.accountUpdated){const account=users[socket.data.userKey];if(account)socket.emit('account-data',publicUser(account));}
  ack({ok:accepted>0,accepted,rejected,defeated:batch.defeated.length});
 });
 socket.on('shared-xp-award', () => {}); // Clientes não podem conceder XP; só o servidor entrega após coletar um orbe.
 socket.on('get-rankings', () => socket.emit('rankings-data', rankingPayload()));
 socket.on('delete-account', async(payload={}) => {
  const key=socket.data.userKey,user=users[key];
  if(!key||!user)return socket.emit('account-deletion-result',{ok:false,message:'Entre na sua conta para excluir seu perfil.'});
  const typedNickname=String(payload.nickname||'').trim();
  if(typedNickname.toLowerCase()!==String(user.nickname||'').trim().toLowerCase()){
   return socket.emit('account-deletion-result',{ok:false,message:'O nickname digitado não corresponde à sua conta. Nenhuma informação foi excluída.'});
  }
  try{
   // Disconnect every active session for this account before removing the key, so stale sockets
   // cannot mutate a newly-created account that reuses the same nickname.
   for(const session of io.sockets.sockets.values()){
    if(session.data.userKey!==key)continue;
    const isRequester=session.id===socket.id;
    removeFromRoom(session,{announce:true,emitResult:true});
    session.data.userKey=null;session.data.nickname=null;session.data.joined=false;session.data.roomId=null;
    if(!isRequester)session.emit('account-force-logout',{message:'Esta conta foi excluída em outra sessão.'});
   }
   // Remove recent chat messages associated with the deleted profile as part of data cleanup.
   for(let i=globalChatHistory.length-1;i>=0;i--){
    if(String(globalChatHistory[i]?.nickname||'').toLowerCase()===String(user.nickname||'').toLowerCase())globalChatHistory.splice(i,1);
   }
   io.emit('global-chat-history',globalChatHistory.map(publicChatMessage));
   // Keep social links and Cardume membership consistent when an account is deleted.
   const oldCardume=cardumes[user.cardumeId];
   if(oldCardume){oldCardume.members=oldCardume.members.filter(member=>member!==key);if(!oldCardume.members.length)delete cardumes[oldCardume.id];else if(oldCardume.leader===user.nickname)oldCardume.leader=users[oldCardume.members[0]]?.nickname||'Líder';saveCardumes();}
   for(const other of Object.values(users)){other.likedBy=(Array.isArray(other.likedBy)?other.likedBy:[]).filter(member=>member!==key);other.likedProfiles=(Array.isArray(other.likedProfiles)?other.likedProfiles:[]).filter(profile=>profile!==key);}
   delete users[key];
   const removeFromBoard=(board)=>{
    if(!board||typeof board!=='object')return;
    delete board[key];
    for(const value of Object.values(board))if(value&&typeof value==='object')removeFromBoard(value);
   };
   removeFromBoard(rankings);
   saveUsers();saveRanks();await flushPersistence();
   socket.emit('account-deletion-result',{ok:true,message:'Sua conta e os dados associados foram excluídos permanentemente.'});
   broadcastOnline();broadcastCardumeRosters();
  }catch(err){
   console.error('[account] Falha ao excluir conta:',err.message);
   socket.emit('account-deletion-result',{ok:false,message:'Não foi possível concluir a exclusão agora. Tente novamente mais tarde.'});
  }
 });
 socket.on('get-account', () => { const u = users[socket.data.userKey]; if (u) socket.emit('account-data', publicUser(u)); });
  socket.on('equip-title', payload => { const u=users[socket.data.userKey];if(!u||!payload)return;const id=String(payload.id||'');if(!unlockedTitleIds(u).includes(id))return socket.emit('account-data',publicUser(u));u.equippedTitle=id;saveUsers();socket.emit('account-data',publicUser(u));const room=socketRoom(socket),player=room?.players.get(socket.id);if(player){player.titleId=id;io.to(channelFor(room)).emit('world-players',[...room.players.values()].map(({userKey,runStats,...p})=>p));} });
 socket.on('save-cosmetics', payload => { const u = users[socket.data.userKey]; if (!u || !payload) return; const allowed = new Set(['default','violet','solar','toxic','leviathan','thorn','abyssking','royal','glacier','coral','bloodmoon','voidwing','abyssaleye','deepwarden','kraken','aberration','angler','maw','devourer']); u.ownedSkins = [...new Set(['default', ...(u.ownedSkins || []).filter(x => allowed.has(x))])]; if (u.ownedSkins.includes(payload.equippedSkin)) u.equippedSkin = payload.equippedSkin; saveUsers(); socket.emit('account-data', publicUser(u)); });
 socket.on('purchase-skin', payload => {
  const u = users[socket.data.userKey]; if (!u || !payload) return;
  const prices = { violet:1000, solar:2500, toxic:4000, leviathan:6500, thorn:8000, abyssking:10000, royal:12000, glacier:13000, coral:6000, bloodmoon:9000, voidwing:15000, abyssaleye:18000, deepwarden:14000, kraken:30000, aberration:16000, angler:19000, maw:22000, devourer:35000 };
  const id = String(payload.id || ''), price = prices[id];
  if (!price) return socket.emit('purchase-result', { ok:false, message:'Skin indisponível para compra com moedas.' });
  if ((u.ownedSkins || ['default']).includes(id)) return socket.emit('purchase-result', { ok:true, message:'Você já possui esta skin.', account:publicUser(u) });
  if ((u.coins || 0) < price) return socket.emit('purchase-result', { ok:false, message:'Moedas abissais insuficientes.', account:publicUser(u) });
  u.coins -= price; u.ownedSkins = [...(u.ownedSkins || ['default']), id]; u.equippedSkin = id; saveUsers(); socket.emit('purchase-result', { ok:true, message:'Skin desbloqueada e salva na conta!', account:publicUser(u) });
 });
 socket.on('redeem-code', payload => {
  const u=users[socket.data.userKey];if(!u)return socket.emit('code-redeem-result',{ok:false,message:'Entre na sua conta para resgatar este código.'});
  const code=String(payload?.code||'').trim().toLowerCase();if(code==='bemvindoabyssal'){
   u.redeemedCodes ||= [];
   if(u.redeemedCodes.includes('bemvindoabyssal'))return socket.emit('code-redeem-result',{ok:false,message:'Este código de boas-vindas já foi utilizado nesta conta.'});
   u.coins=(Number(u.coins)||0)+10000;u.redeemedCodes.push('bemvindoabyssal');saveUsers();return socket.emit('code-redeem-result',{ok:true,message:'Boas-vindas ao Abyssal! +10.000 moedas abissais. Código usado nesta conta.',account:publicUser(u)});
  }
  if(code!=='abyssal10k')return socket.emit('code-redeem-result',{ok:false,message:'Código inválido. Confira e tente novamente.'});
  u.redeemedCodes ||= [];
  u.coins=(Number(u.coins)||0)+10000;saveUsers();socket.emit('code-redeem-result',{ok:true,message:'Código resgatado! +10.000 essências.',account:publicUser(u)});
 });
 socket.on('purchase-meta', payload => {
  const u=users[socket.data.userKey];if(!u||!payload)return;
  const catalogue={bulkhead:{price:1800,max:3},focuser:{price:2200,max:3},current:{price:1600,max:3},startShield:{price:3200,max:1},pulse:{price:3500,max:1},dash:{price:4200,max:1}};
  const id=String(payload.id||''),item=catalogue[id];if(!item)return socket.emit('purchase-result',{ok:false,itemId:id,message:'Melhoria indisponível.',account:publicUser(u)});
  u.metaUpgrades ||= {};const current=Number(u.metaUpgrades[id])||0;
  if(current>=item.max)return socket.emit('purchase-result',{ok:false,itemId:id,message:'Esta melhoria já está no nível máximo.',account:publicUser(u)});
  if((u.coins||0)<item.price)return socket.emit('purchase-result',{ok:false,itemId:id,message:'Moedas abissais insuficientes.',account:publicUser(u)});
  u.coins-=item.price;u.metaUpgrades[id]=current+1;saveUsers();socket.emit('purchase-result',{ok:true,itemId:id,message:'Adaptação permanente desbloqueada!',account:publicUser(u)});
 });
 socket.on('spin-wheel', () => {
  const u=users[socket.data.userKey];if(!u)return socket.emit('wheel-result',{ok:false,message:'Entre na sua conta para guardar a recompensa.'});
  const now=Date.now(),cooldown=20*60*60*1000;if(now-(Number(u.lastWheelAt)||0)<cooldown)return socket.emit('wheel-result',{ok:false,message:'Você já usou seu giro premiado recentemente. Volte mais tarde.',account:publicUser(u)});
  // Chamado somente após o callback adViewed da API oficial de anúncio recompensado.
  const roll=Math.random()*100;let reward=roll<40?20:roll<70?50:roll<88?100:roll<96?300:roll<99.9?600:1000;
  u.coins=(u.coins||0)+reward;u.lastWheelAt=now;saveUsers();socket.emit('wheel-result',{ok:true,reward,coins:u.coins,account:publicUser(u),nextSpinAt:now+cooldown});
 });
 socket.on('submit-run', async payload => { try { const result=await finishRunForSocket(socket,payload||{}); socket.emit('run-saved',result); } catch(err) { console.error('[run] Falha no submit-run legado:',err.message); } });
 socket.on('disconnect', () => { globalChatRate.delete(socket.id); if(socket.data.userKey&&(socket.data.joined||socket.data.runStats)){finishRunForSocket(socket,{}).catch(err=>console.error('[run] Falha ao finalizar desconexão:',err.message));} removeFromRoom(socket,{announce:true,emitResult:false}); broadcastOnline(); setTimeout(broadcastCardumeRosters,0); });
});
setInterval(settlePeriods, 60 * 60 * 1000).unref();
// Detecta a virada do dia em America/Sao_Paulo; o boot também corrige dias perdidos após spin-down.
setInterval(resetGlobalChatIfNewDay, 30 * 1000).unref();
setInterval(()=>heartbeatRoomDirectory().catch(err=>console.error('[rooms] heartbeat falhou:',err.message)),5000).unref();
async function boot() {
 await initializePersistence();
 await initializeRoomRegistry();
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
  if(titleStatsSaveTimer){clearTimeout(titleStatsSaveTimer);titleStatsSaveTimer=null;saveUsers();}
  await new Promise(resolve => { if (server.listening) server.close(resolve); else resolve(); });
  await flushPersistence();
  if(pgPool&&roomRegistryReady){try{await pgPool.query('DELETE FROM abyssal_rooms WHERE owner_instance=$1',[SERVER_INSTANCE_ID]);}catch(err){console.error('[rooms] limpeza no encerramento:',err.message);}}
  if (pgPool) await pgPool.end();
  clearTimeout(hardStop); process.exit(0);
 } catch (err) { console.error('[shutdown] Falha ao finalizar com segurança:', err.message); process.exit(1); }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
