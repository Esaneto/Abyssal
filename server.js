const RiftRewards=require('./rift-rewards');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Worker } = require('worker_threads');
const { monitorEventLoopDelay, performance } = require('perf_hooks');
const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();
const EnemyAI = require('./public/enemy-ai');
const WorldSimulation = require('./world-simulation');
const {splitXp}=require('./xp-distribution');
const SkinAbilities = require('./public/skin-abilities.js');
const SkinStandard = require('./public/skin-standard.js');
const SpecimenRarity = require('./public/specimen-rarity.js');
const SpecimenEvasion = require('./public/specimen-evasion.js');
const GravityCone = require('./public/gravity-cone.js');
const SpecimenSystem = require('./public/specimen-system.js');
const DiverHitbox = require('./public/diver-hitbox.js');
const DiverArt = require('./public/diver-art.js');
const NetCodec = require('./public/net-codec');
const PhotonRay = require('./public/photon-ray-config');
const PvpProjectiles = require('./pvp-projectiles');
const ExpeditionRules = require('./public/abyssal-expedition-rules.js');
const AbyssalMap = require('./public/abyssal-map.js');
const RiftHardcore = require('./public/abyssal-rift-hardcore.js');
const { normalizeDatabasePoolConfig } = require('./database-config');
const { ensureRunProgression, creditRunXp } = require('./run-progression');
const { DEFAULT_CAPACITY, consumeMovementBudget } = require('./movement-envelope');
const { registerPaymentRoutes, liveSalesReady } = require('./payments');
const { registerAccountRecoveryRoutes } = require('./account-recovery');
const { registerSupportRoutes } = require('./support');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const APP_VERSION=require('./package.json').version;
const HOST_CPU_COUNT=typeof os.availableParallelism==='function'?os.availableParallelism():os.cpus().length;
const RESOURCE_PROFILE=String(process.env.ABYSSAL_RESOURCE_PROFILE||'generic');
const HTTP_BACKLOG=clamp(Math.floor(Number(process.env.HTTP_BACKLOG)||1024),128,16384);
const DATABASE_POOL_MAX=clamp(Math.floor(Number(process.env.DATABASE_POOL_MAX)||5),1,20);
const LIBUV_THREADPOOL_SIZE=clamp(Math.floor(Number(process.env.UV_THREADPOOL_SIZE)||4),1,128);
let lastCpuUsage=process.cpuUsage(),lastCpuSampleAt=process.hrtime.bigint(),lastElu=performance.eventLoopUtilization();
let processCpuSample={processPercent:0,hostCapacityPercent:0},eventLoopUtilizationSample=0;
const cpuSampler=setInterval(()=>{
 const now=process.hrtime.bigint(),elapsedUs=Math.max(1,Number(now-lastCpuSampleAt)/1000),usage=process.cpuUsage(lastCpuUsage);
 const processPercent=((usage.user+usage.system)/elapsedUs)*100;
 const elu=performance.eventLoopUtilization(lastElu);
 processCpuSample={processPercent:Number(processPercent.toFixed(2)),hostCapacityPercent:Number((processPercent/Math.max(1,HOST_CPU_COUNT)).toFixed(2))};
 eventLoopUtilizationSample=Number(elu.utilization.toFixed(4));
 lastCpuUsage=process.cpuUsage();lastCpuSampleAt=now;lastElu=performance.eventLoopUtilization();
},1000);
cpuSampler.unref?.();
const BUBBLE_TRAIL_HIT_MS=500;

const NATIVE_APP_ORIGINS=new Set(['https://localhost','capacitor://localhost']);
const allowedSocketOrigins = new Set(String(process.env.APP_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
for(const origin of NATIVE_APP_ORIGINS)allowedSocketOrigins.add(origin);
function socketOriginAllowed(origin, request) {
 if (!origin) return true; // Native clients and same-machine integration tests.
 if (allowedSocketOrigins.has(origin)) return true;
 try { return new URL(origin).host.toLowerCase() === String(request?.headers?.host || '').toLowerCase(); }
 catch { return false; }
}

const app = express();
app.use((request,response,next)=>{
 const origin=String(request.headers.origin||'');
 if(NATIVE_APP_ORIGINS.has(origin)){
  response.setHeader('Access-Control-Allow-Origin',origin);
  response.setHeader('Vary','Origin');
  response.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  if(request.method==='OPTIONS')return response.sendStatus(204);
 }
 next();
});
app.use(express.json({limit:'16kb'}));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: false }, allowRequest: (request, callback) => callback(null, socketOriginAllowed(request.headers.origin, request)), maxHttpBufferSize: 1e5, pingInterval: 25000, pingTimeout: 60000, perMessageDeflate: false, httpCompression: { threshold: 2048 }, connectionStateRecovery: { maxDisconnectionDuration: 120000, skipMiddlewares: false } });
const PORT = Number(process.env.PORT || 3000);
// Socket.IO keeps the initial HTTP request by default; Abyssal does not use it after handshake.
io.engine.on('connection', rawSocket => { rawSocket.request = null; });
// Profiles and Cardumes remain available independently from text communication.
// Public text chat was removed from the product surface and server protocol.
const REWARDED_WHEEL_ENABLED = process.env.ABYSSAL_REWARDED_WHEEL_ENABLED === 'true';
const SOCIAL_FEATURES_ENABLED = true;
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
let persistenceWorker = null;
let persistenceWorkerClosing = false;
let persistenceWorkerSeq = 0;
const persistenceWorkerJobs = new Map();
const ASYNC_PERSISTENCE_ENABLED = process.env.ABYSSAL_ASYNC_PERSISTENCE !== 'false';

function startPersistenceWorker() {
 if (!ASYNC_PERSISTENCE_ENABLED || persistenceWorker) return;
 persistenceWorkerClosing=false;
 try {
  const worker = new Worker(path.join(__dirname, 'state-persistence-worker.js'));
  worker.unref?.();
  worker.on('message', message => {
   const job = persistenceWorkerJobs.get(Number(message?.id));
   if (!job) return;
   persistenceWorkerJobs.delete(Number(message.id));
   if (message.ok) job.resolve(message);
   else job.reject(new Error(message.error || 'state persistence worker failed'));
  });
  worker.on('error', error => {
   console.error('[persistence] Worker de serialização falhou:', error.message);
   for (const job of persistenceWorkerJobs.values()) job.reject(error);
   persistenceWorkerJobs.clear();
   persistenceWorker = null;
  });
  worker.on('exit', code => {
   if (persistenceWorker === worker) persistenceWorker = null;
   if (code !== 0&&!persistenceWorkerClosing) console.warn('[persistence] Worker de serialização encerrou com código', code);
  });
  persistenceWorker = worker;
 } catch (error) {
  console.warn('[persistence] Worker indisponível; usando fallback assíncrono:', error.message);
 }
}
startPersistenceWorker();

async function fallbackSerializeAndWrite({id,key,value,filePath,pretty,mode}) {
 const serialized=JSON.stringify(value,null,pretty?2:0);
 if(filePath){
  await fs.promises.mkdir(path.dirname(filePath),{recursive:true});
  const tempPath=`${filePath}.${process.pid}.${id}.tmp`;
  await fs.promises.writeFile(tempPath,serialized,{encoding:'utf8',mode});
  await fs.promises.rename(tempPath,filePath);
 }
 return {id,key,ok:true,serialized,bytes:Buffer.byteLength(serialized,'utf8')};
}
function snapshotState(key,value,filePath,pretty=false,mode=0o600){
 const id=++persistenceWorkerSeq;
 if(!persistenceWorker)return fallbackSerializeAndWrite({id,key,value,filePath,pretty,mode});
 return new Promise((resolve,reject)=>{
  persistenceWorkerJobs.set(id,{resolve,reject});
  try{persistenceWorker.postMessage({id,key,value,filePath,pretty,mode});}
  catch(error){persistenceWorkerJobs.delete(id);reject(error);}
 });
}
function persistState(key,value,filePath,pretty=false,mode=0o600){
 const snapshotPromise=snapshotState(key,value,filePath,pretty,mode);
 persistenceQueue=persistenceQueue.then(async()=>{
  const snapshot=await snapshotPromise;
  if(pgPool)await pgPool.query(
   'INSERT INTO abyssal_state (state_key, state_value, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (state_key) DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = NOW()',
   [key,snapshot.serialized]
  );
 }).catch(err=>console.error(`[persistence] Falha ao salvar ${key}:`,err.message));
}
function saveUsers(){persistState('users',users,USERS_FILE,true,0o600);}
let titleStatsSaveTimer=null;
function scheduleTitleStatsSave() {
 if(titleStatsSaveTimer)return;
 titleStatsSaveTimer=setTimeout(()=>{titleStatsSaveTimer=null;saveUsers();},2000);
 titleStatsSaveTimer.unref?.();
}
function saveCardumes(){persistState('cardumes',cardumes,CARDUMES_FILE,true,0o600);}
function saveRanks(){persistState('rankings',rankings,RANKS_FILE,true,0o600);}
async function closePersistenceWorker(){
 if(!persistenceWorker)return;
 persistenceWorkerClosing=true;
 const worker=persistenceWorker;persistenceWorker=null;
 try{await worker.terminate();}catch{}
}
async function initializePersistence() {
 if (!process.env.DATABASE_URL) {
  console.warn('[persistence] DATABASE_URL não configurada. Este deploy usará arquivos locais efêmeros; contas podem desaparecer após reinício/deploy.');
  return;
 }
 let Pool;
 try { ({ Pool } = require('pg')); }
 catch { throw new Error('DATABASE_URL foi configurada, mas o pacote pg não foi instalado. Execute npm install e faça um novo deploy.'); }
 const databasePoolConfig=normalizeDatabasePoolConfig(process.env.DATABASE_URL,process.env.DATABASE_SSL);
 pgPool = new Pool({
  ...databasePoolConfig,
  max: DATABASE_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
 });
 pgPool.on('error', err => console.error('[persistence] Erro inesperado no pool PostgreSQL:', err.message));
 await pgPool.query('CREATE TABLE IF NOT EXISTS abyssal_state (state_key TEXT PRIMARY KEY, state_value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
 const result = await pgPool.query("SELECT state_key, state_value FROM abyssal_state WHERE state_key IN ('users','rankings','cardumes')");
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
 console.log(`[persistence] PostgreSQL ativo: ${Object.keys(users).length} contas carregadas.`);
}
async function flushPersistence() { await persistenceQueue; }
async function refreshDeployResumeFromPersistence(userKey){
 if(!pgPool||!userKey)return users[userKey]||null;
 try{
  const result=await pgPool.query("SELECT state_value FROM abyssal_state WHERE state_key='users' LIMIT 1");
  const persisted=result.rows?.[0]?.state_value;
  const fresh=persisted&&typeof persisted==='object'?persisted[userKey]:null;
  if(fresh?.pendingRunResume&&Number(fresh.pendingRunResume.expiresAt)>=Date.now()){
   users[userKey]={...(users[userKey]||{}),...fresh,pendingRunResume:fresh.pendingRunResume};
  }
 }catch(err){console.error('[deploy] Falha ao atualizar retomada persistida:',err.message);}
 return users[userKey]||null;
}
let passwordHashQueue=Promise.resolve(),passwordHashPending=0;
const MAX_PENDING_PASSWORD_HASHES=32;
function hashPassword(password,salt){
 if(passwordHashPending>=MAX_PENDING_PASSWORD_HASHES)return Promise.resolve(null);
 passwordHashPending++;
 const job=passwordHashQueue.then(()=>new Promise(resolve=>crypto.scrypt(password,salt,64,(error,key)=>{
  if(error){console.error('[auth] scrypt falhou:',error.message);return resolve(null);}
  resolve(key.toString('hex'));
 })));
 passwordHashQueue=job.catch(()=>null);
 return job.finally(()=>{passwordHashPending=Math.max(0,passwordHashPending-1);});
}
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
  {id:'abyss-drifter',kind:'starter',required:0},{id:'sonar-novice',kind:'kills',required:15},{id:'abyss-spark',kind:'kills',required:50},
  {id:'lantern-hunter',kind:'kills',required:500},{id:'hadal-executioner',kind:'kills',required:2500},
  {id:'current-hunter',kind:'kills',required:250},{id:'pelagic-executioner',kind:'kills',required:1000},
  {id:'first-predator',kind:'bosses',required:3},{id:'leviathan-hunter',kind:'bosses',required:10},{id:'abyss-stalker',kind:'bosses',required:25},{id:'sovereign-abyss',kind:'bosses',required:50},{id:'titan-bane',kind:'bosses',required:100},
  {id:'cycle-pioneer',kind:'firstProgressionClear',required:1},{id:'rift-cartographer',kind:'riftBossesDefeated',required:3},{id:'hadal-navigator',kind:'riftBossesDefeated',required:12},
  {id:'veteran-diver',kind:'runsCompleted',required:10},{id:'eternal-explorer',kind:'runsCompleted',required:50},
  {id:'shoal-founder',kind:'cardumesCreated',required:1},
  {id:'supporter-of-the-depths',kind:'likesGiven',required:25},
  {id:'abyssal-famous',kind:'likesReceived',required:10},
  {id:'abyssal-icon',kind:'likesReceived',required:50},
  {id:'living-legend',kind:'likesReceived',required:100},
  {id:'abyssal-patron',kind:'storeSupporter',required:1},{id:'boss-abyssal',kind:'bossAbyssal',required:1},{id:'abyssal-conqueror',kind:'conqueror',required:1}
 ];
 function titleProgress(u,kind){if(kind==='conqueror')return (u.ownedSkins||[]).includes('greensnake')||(u.titleStats||{}).conqueror?1:0;if(kind==='storeSupporter'||kind==='bossAbyssal')return u.purchaseTitles?.[kind==='storeSupporter'?'storeSupporter':'bossAbyssal']?1:0;if(kind==='likesReceived')return Array.isArray(u.likedBy)?u.likedBy.length:0;if(kind==='likesGiven')return Array.isArray(u.likedProfiles)?u.likedProfiles.length:0;return Number((u.titleStats||{})[kind==='kills'?'monstersDefeated':kind==='bosses'?'bossesDefeated':kind])||0}
 function unlockedTitleIds(u){return TITLE_DEFINITIONS.filter(t=>t.kind==='starter'||titleProgress(u,t.kind)>=t.required).map(t=>t.id)}
 function ensureAccountId(u){if(!u)return null;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(u.accountId||'')))u.accountId=crypto.randomUUID();return u.accountId;}
 function publicUser(u) { ensureAccountId(u);u.matchHistory=Array.isArray(u.matchHistory)?u.matchHistory.slice(0,10):[];u.titleStats ||= {monstersDefeated:0,bossesDefeated:0,cardumesCreated:0};u.specimenProficiency=SpecimenSystem.normalizeMap(u.specimenProficiency);u.likedBy ||= [];u.likedProfiles ||= [];u.blockedUsers ||= [];u.equippedTitle ||= 'abyss-drifter';return { nickname: u.nickname, discoveredSpecimens:Array.isArray(u.discoveredSpecimens)?u.discoveredSpecimens:[], coins: u.coins || 0, ownedSkins: u.ownedSkins || ['default'], equippedSkin: u.equippedSkin || 'default', diverGender:u.diverGender==='female'?'female':'male', metaUpgrades: u.metaUpgrades || {}, resonancePresets:u.resonancePresets||null, specimenProficiency:u.specimenProficiency, cardumeId:u.cardumeId||null, equippedTitle:u.equippedTitle, unlockedTitles:unlockedTitleIds(u), titleStats:u.titleStats, likesReceived:u.likedBy.length, likesGiven:u.likedProfiles.length, blockedUsers:u.blockedUsers.map(key=>users[key]?.nickname||key), matchHistory:u.matchHistory,firstProgressionRewardClaimed:Boolean(u.firstProgressionRewardClaimed),tutorialDismissedModes:Array.isArray(u.tutorialDismissedModes)?u.tutorialDismissedModes:[] }; }
 function publicTitleProgress(u){return {titleStats:{...(u?.titleStats||{})},unlockedTitles:unlockedTitleIds(u)};}
 function publicProfile(key,viewerKey){const u=users[key];if(!u)return null;ensureAccountId(u);u.titleStats ||= {monstersDefeated:0,bossesDefeated:0,cardumesCreated:0};u.likedBy ||= [];u.likedProfiles ||= [];u.blockedUsers ||= [];const viewer=viewerKey?users[viewerKey]:null;if(viewer)viewer.blockedUsers ||= [];const c=cardumes[u.cardumeId];return {nickname:u.nickname,equippedTitle:u.equippedTitle||'abyss-drifter',equippedSkin:u.equippedSkin||'default',diverGender:u.diverGender==='female'?'female':'male',specimenProficiency:SpecimenSystem.normalizeMap(u.specimenProficiency),unlockedTitles:unlockedTitleIds(u),titleStats:{...u.titleStats},likesReceived:u.likedBy.length,likesGiven:u.likedProfiles.length,likedByMe:Boolean(viewerKey&&u.likedBy.includes(viewerKey)),blockedByMe:Boolean(viewer&&viewer.blockedUsers.includes(key)),hasBlockedMe:Boolean(viewerKey&&u.blockedUsers.includes(viewerKey)),isSelf:viewerKey===key,cardume:c?{id:c.id,name:c.name}:null};}
 function onlineAccountKeys(){const keys=new Set();for(const client of (io.sockets?.sockets?.values?.() || []))if(client.connected&&client.data.userKey)keys.add(client.data.userKey);return keys;}
 function cardumeRoster(c){const online=onlineAccountKeys();return c.members.map(key=>({key,nickname:users[key]?.nickname||key,online:online.has(key),equippedTitle:users[key]?.equippedTitle||'abyss-drifter',likesReceived:Array.isArray(users[key]?.likedBy)?users[key].likedBy.length:0,leader:c.leader===users[key]?.nickname})).filter(m=>users[m.key]).sort((a,b)=>Number(b.online)-Number(a.online)||Number(b.leader)-Number(a.leader)||a.nickname.localeCompare(b.nickname));}
 function emitCardumeRoster(c){if(!c)return;for(const client of (io.sockets?.sockets?.values?.() || []))if(client.data.userKey&&c.members.includes(client.data.userKey))client.emit('cardume-details',{cardume:{id:c.id,name:c.name,description:c.description,leader:c.leader,members:c.members.length,capacity:c.capacity},roster:cardumeRoster(c)});}
 function broadcastCardumeRosters(){for(const c of Object.values(cardumes))emitCardumeRoster(c);}
function rankedEntries(board) { return Object.values(board || {}).sort((a, b) => (Number(b.bossesKilled) || 0) - (Number(a.bossesKilled) || 0) || (Number(b.score ?? b.damage) || 0) - (Number(a.score ?? a.damage) || 0) || (Number(b.survival) || 0) - (Number(a.survival) || 0)).slice(0, 10); }
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
function rankingResetTimes(now=new Date()){
 const nextDay=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);
 const daysToMonday=(8-(now.getUTCDay()||7))%7||7,nextWeek=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+daysToMonday);
 const nextMonth=Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1);
 return {daily:nextDay,weekly:nextWeek,monthly:nextMonth};
}
function rankingPayload() { return { eternal: rankedEntries(rankings.eternal), daily: rankedEntries(rankings.daily[dayKey()]), weekly: rankedEntries(rankings.weekly[weekKey()]), monthly: rankedEntries(rankings.monthly?.[monthKey()]), resets:rankingResetTimes(), metric:'bossesKilled',tieBreakers:['score','survival'] }; }
app.use((req, res, next) => {
 res.set('X-Content-Type-Options','nosniff');
 res.set('X-Frame-Options','DENY');
 res.set('Referrer-Policy','strict-origin-when-cross-origin');
 res.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com"), fullscreen=(self)');
 res.set('Cross-Origin-Opener-Policy','same-origin');
 if(req.secure||String(req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https')res.set('Strict-Transport-Security','max-age=31536000');
 // Report-only while legacy inline scripts are migrated to nonces/hashes.
 res.set('Content-Security-Policy-Report-Only',"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.socket.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://checkout.stripe.com");
 if (/\.(html|js|css)$/i.test(req.path)) res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
 next();
});
app.get('/ads.txt', (_req, res) => {
 res.type('text/plain; charset=utf-8').set('Cache-Control','public, max-age=3600').send('google.com, pub-2314281138409028, DIRECT, f08c47fec0942fa0\n');
});
app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false, maxAge: 0 }));
if (typeof app.post === 'function') {
 registerPaymentRoutes({ app, getUsers: () => users, getPool: () => pgPool, saveUsers, dataDir: DATA_DIR });
}
if (typeof app.post === 'function') registerAccountRecoveryRoutes({app,getUsers:()=>users,saveUsers,io});
if (typeof app.post === 'function') registerSupportRoutes({app});
function resourceHealthPayload(){
 const memory=process.memoryUsage(),load=os.loadavg();
 return {
  profile:RESOURCE_PROFILE,
  node:process.version,
  pid:process.pid,
  uptimeSec:Math.floor(process.uptime()),
  cpu:{available:HOST_CPU_COUNT,processPercent:processCpuSample.processPercent,hostCapacityPercent:processCpuSample.hostCapacityPercent,load1:Number(load[0].toFixed(2)),load5:Number(load[1].toFixed(2)),load15:Number(load[2].toFixed(2))},
  memory:{rssMB:Number((memory.rss/1048576).toFixed(1)),heapUsedMB:Number((memory.heapUsed/1048576).toFixed(1)),heapTotalMB:Number((memory.heapTotal/1048576).toFixed(1)),externalMB:Number((memory.external/1048576).toFixed(1))},
  eventLoopUtilization:eventLoopUtilizationSample,
  authHashPending:passwordHashPending,
  libuvThreadpoolSize:LIBUV_THREADPOOL_SIZE,
  persistenceWorker:{enabled:ASYNC_PERSISTENCE_ENABLED,active:Boolean(persistenceWorker),pending:persistenceWorkerJobs.size},
  databasePoolMax:DATABASE_POOL_MAX,
  httpBacklog:HTTP_BACKLOG
 };
}
app.get('/health', (_req,res)=>res.set('Cache-Control','no-store').json({ok:true,service:'abyssal-server',build:APP_VERSION,online:onlineCount(),persistence:pgPool?'postgres':'local-ephemeral',resources:resourceHealthPayload(),eventLoopLag:{meanMs:Number((eventLoopDelay.mean/1e6).toFixed(2)),p95Ms:Number((eventLoopDelay.percentile(95)/1e6).toFixed(2)),maxMs:Number((eventLoopDelay.max/1e6).toFixed(2))},rooms:rooms.size,activeRooms:[...rooms.values()].filter(r=>r.players.size>0).length,activePlayers:[...rooms.values()].reduce((n,r)=>n+r.players.size,0),livingPlayers:[...rooms.values()].reduce((n,r)=>n+livingPlayers(r).length,0),simulatingRooms:[...rooms.values()].filter(r=>hasLivingPlayers(r)).length,maxPlayersPerRoom:MAX_PLAYERS_PER_ROOM,maxEnemiesPerRoom:MAX_ENEMIES_PER_ROOM,rankingMetric:'bossesKilled',roomRegistry:pgPool?(roomRegistryReady?'postgres-ready':'postgres-initializing'):'local-only',roomListPolicy:'public-and-private-metadata',backgroundSimulation:'server-owned',emptyRoomPolicy:'pause-while-occupied-clear-when-empty',simulation:{ticks:worldTickCount,lastTickAt:lastWorldTickAt?new Date(lastWorldTickAt).toISOString():null,tickAgeMs:lastWorldTickAt?Date.now()-lastWorldTickAt:null,errors:worldTickErrors,tickProcessing:{lastMs:Number(worldTickLastMs.toFixed(3)),avgMs:Number(worldTickAvgMs.toFixed(3)),maxMs:Number(worldTickMaxMs.toFixed(3))},combat:{...combatDiagnostics},movingRooms:[...rooms.values()].filter(r=>r.players.size>0&&r.world.lastMovementAt>0).length,movingEnemies:[...rooms.values()].reduce((n,r)=>n+(r.world.movingEnemyCount||0),0),totalEnemies:[...rooms.values()].reduce((n,r)=>n+r.world.enemies.length,0),activeRoomDetails:[...rooms.values()].filter(r=>r.players.size>0).map(r=>({id:r.id,tickProcessing:{lastMs:Number((Number(r.tickProcessingLastMs)||0).toFixed(3)),avgMs:Number((Number(r.tickProcessingAvgMs)||0).toFixed(3)),maxMs:Number((Number(r.tickProcessingMaxMs)||0).toFixed(3))},players:r.players.size,enemies:r.world.enemies.length,movingEnemies:r.world.movingEnemyCount||0,movementRecoveries:r.world.movementRecoveryCount||0,tickCount:r.world.tickCount||0,elapsed:Math.floor(r.world.elapsed||0),positionUpdates:[...r.players.values()].reduce((n,p)=>n+(p.positionUpdates||0),0),latestPositionAgeMs:Math.max(...[...r.players.values()].map(p=>p.lastPositionAt?Date.now()-p.lastPositionAt:Infinity)),stalePositionPlayers:[...r.players.values()].filter(p=>!p.lastPositionAt||Date.now()-p.lastPositionAt>3000).length,stalePositionAttackSkips:r.world.stalePositionAttackSkips||0,hiddenPlayers:[...r.players.values()].filter(p=>p.clientHidden===true).length,clientReportedEnemies:[...r.players.values()].reduce((n,p)=>n+(p.clientEnemyCount||0),0),clientReportedMovingEnemies:[...r.players.values()].reduce((n,p)=>n+(p.clientMovingEnemies||0),0),clientPredictingPlayers:[...r.players.values()].filter(p=>p.clientPredicting).length,clientMotionAgeMs:Math.max(...[...r.players.values()].map(p=>p.clientMotionAt?Date.now()-p.clientMotionAt:Infinity)),worldId:r.world.worldId,snapshotSeq:r.world.snapshotSeq||0,bossCount:r.world.enemies.filter(e=>isBossKind(e.kind)).length,nextBossIn:Math.max(0,Math.ceil((Number(r.world.nextBossAt)||60)-(Number(r.world.elapsed)||0)))}))},world:{width:WORLD_WIDTH,height:WORLD_HEIGHT,coordinateSystem:'world-units',engine:'server-authoritative-shared-enemies-reliable-snapshots-contact-guard-v4'},worldTickerActive:Boolean(worldTicker),roomsPendingDeletion:pendingRoomDeletion.size,movementGuardRejects}));
app.get('/api/rankings', (_req, res) => res.json(rankingPayload()));
app.get('/api/runtime-config', (_req,res)=>res.set('Cache-Control','no-store').json({previewMode:process.env.ABYSSAL_PREVIEW_MODE==='true',realPaymentsEnabled:liveSalesReady(),socialFeaturesEnabled:SOCIAL_FEATURES_ENABLED,randomRewardsEnabled:REWARDED_WHEEL_ENABLED}));
app.get('/favicon.ico', (_req,res)=>res.status(204).end());

const rooms = new Map();
const authAttempts = new Map();
function livingPlayers(room) { return [...(room?.players?.values?.() || [])].filter(player => player && player.alive !== false); }
function hasLivingPlayers(room) { return livingPlayers(room).length > 0; }
function playerVitalsPayload(player, extra = {}) {
 return { playerId: player.id, hp: Math.max(0, Number(player.hp) || 0), maxHp: Math.max(1, Number(player.maxHp) || 100), shieldCharges: Math.max(0, Math.min(3, Math.floor(Number(player.shieldCharges) || 0))), alive: player.alive !== false, invulnerabilityMs: Math.max(0, (Number(player.invulnerableUntil) || 0) - Date.now()), ...extra };
}
const BOSS_KINDS = new Set(['boss','leviathan','maw','angler','whiteSharkBoss','kraken','devourer','riftSmile']);
const MAX_PLAYERS_PER_ROOM = 6;
const MAX_ENEMIES_PER_ROOM = 400;
const MAX_BOSSES_PER_ROOM = 4;
const MAX_COMMON_ENEMIES = MAX_ENEMIES_PER_ROOM - MAX_BOSSES_PER_ROOM;
const WORLD_WIDTH = EnemyAI.WORLD_WIDTH;
const WORLD_HEIGHT = EnemyAI.WORLD_HEIGHT;
const WORLD_ZOOM = EnemyAI.WORLD_ZOOM; // Shared with the solo renderer.
function roomWorldHeight(room){return room?.mode==='rift'?(Number(WorldSimulation.mapLayoutFor(room.world)?.height)||WORLD_HEIGHT):WORLD_HEIGHT;}
function pvpArenaRocks(){
 const minDim=Math.min(WORLD_WIDTH,WORLD_HEIGHT),rocks=[];
 // Layout irregular, like eroded reef ridges and broken underwater rock spines.
 // A deterministic hash keeps the server collision map identical for every room.
 const rnd=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453123;return v-Math.floor(v);};
 for(let i=0;i<62;i++){
  const x=WORLD_WIDTH*(.035+rnd(i+1)*.93),y=WORLD_HEIGHT*(.045+rnd(i+91)*.91);
  if(Math.hypot(x-WORLD_WIDTH*.5,y-WORLD_HEIGHT*.5)<minDim*.245)continue;
  const long=minDim*(.032+rnd(i+191)*.045),thick=minDim*(.012+rnd(i+291)*.018);
  const vertical=rnd(i+391)>.77,rx=vertical?thick:long,ry=vertical?long:thick;
  const angle=(rnd(i+491)*2-1)*Math.PI*.92;
  rocks.push({x,y,rx,ry,angle,r:Math.max(rx,ry)});
 }
 // Add a few short, offset spurs around the perimeter to make natural broken ridges.
 for(let i=0;i<14;i++){
  const side=i%4,along=rnd(i+701),x=side<2?WORLD_WIDTH*(.04+along*.92):(side===2?WORLD_WIDTH*.035:WORLD_WIDTH*.965),y=side>=2?WORLD_HEIGHT*(.05+along*.9):(side===0?WORLD_HEIGHT*.035:WORLD_HEIGHT*.965);
  const rx=minDim*(.025+rnd(i+801)*.025),ry=minDim*(.012+rnd(i+901)*.014),angle=(rnd(i+1001)*2-1)*Math.PI;
  rocks.push({x,y,rx,ry,angle,r:Math.max(rx,ry)});
 }
 return rocks;
}
const PVP_ARENA_ROCKS=pvpArenaRocks();
 // Rotations never change. Precompute instead of taking hundreds of thousands of
 // trig operations per second when six players fire through the rocky arena.
 for(const rock of PVP_ARENA_ROCKS){const angle=-(Number(rock.angle)||0);rock.cosAngle=Math.cos(angle);rock.sinAngle=Math.sin(angle);}
function pvpRockAt(x,y,padding=0){
 for(const rock of PVP_ARENA_ROCKS){
  const dx=x-rock.x,dy=y-rock.y;
  // A circle bounding any rotated ellipse cheaply rejects distant rock checks.
  const bound=rock.r+padding;
  if(Math.abs(dx)>bound||Math.abs(dy)>bound)continue;
  const lx=dx*rock.cosAngle-dy*rock.sinAngle,ly=dx*rock.sinAngle+dy*rock.cosAngle;
  const rx=(Number(rock.rx)||rock.r)+padding,ry=(Number(rock.ry)||rock.r)+padding;
  if((lx/Math.max(1,rx))**2+(ly/Math.max(1,ry))**2<1)return rock;
 }
 return null;
}
function pvpSegmentHitsRock(x1,y1,x2,y2,padding=0){const dx=x2-x1,dy=y2-y1,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/8));for(let i=0;i<=steps;i++){const t=i/steps;if(pvpRockAt(x1+dx*t,y1+dy*t,padding))return true;}return false;}
function pvpDamageAmount(attacker,target,baseDamage,distance=Infinity){
 const outgoing=SkinAbilities.damageMultiplier(attacker?.skinId,'player',distance,Number(attacker?.maxHp)>0?Number(attacker.hp)/Number(attacker.maxHp):1,attacker?.specimenPoints,attacker?.specimenAlive!==false);
 const skinDefense=SkinAbilities.incomingDamageMultiplier(target?.skinId,target?.specimenPoints,target?.specimenAlive!==false);
 const shellLevel=clamp(Math.floor(Number(target?.shellLevel)||0),0,3);
 const shellDefense=1-shellLevel*.08;
 const predatorLevel=clamp(Math.floor(Number(attacker?.predatorLevel)||0),0,3);
 const preyHpRatio=Number(target?.maxHp)>0?Number(target.hp)/Number(target.maxHp):1;
 const hunter=1+predatorLevel*.03+(preyHpRatio<=.30?predatorLevel*.06:0);
 const lastStandLevel=clamp(Math.floor(Number(target?.lastStandLevel)||0),0,3);
 const lowHealth=Number(target?.maxHp)>0&&Number(target?.hp)/Number(target.maxHp)<=.30;
 const lastStandDefense=lowHealth&&lastStandLevel>0?1-(.15+lastStandLevel*.05):1;
 return Math.max(.25,Math.min(1000,Number(baseDamage)||0)*outgoing*hunter*skinDefense*shellDefense*lastStandDefense);
}
function applySkinActivePvpDamage(room,attacker,target,rawDamage,skillId,now){
 if(!room||!attacker||!target||target.id===attacker.id||target.alive===false)return null;
 if(now<(Number(target.invulnerableUntil)||0))return null;
 let blocked=false,damage=0;
 if((Number(target.shieldCharges)||0)>0){target.shieldCharges--;target.invulnerableUntil=now+350;blocked=true;}
 else{
  damage=pvpDamageAmount(attacker,target,rawDamage,Math.hypot(Number(attacker.x)-Number(target.x),Number(attacker.y)-Number(target.y)));
  target.hp=Math.max(0,(Number(target.hp)||target.maxHp)-damage);target.lastDamageAt=now;target.invulnerableUntil=now+180;
  if(target.hp<=0){target.alive=false;awardPvpKillXp(room,target,attacker.id);target.velocityX=0;target.velocityY=0;io.to(channelFor(room)).emit('gameplay-notice',{kind:'death',title:String(target.nickname||'MERGULHADOR').toUpperCase(),text:`${target.nickname||'Um mergulhador'} foi vencido por uma habilidade de Espécime.`,x:Number(target.x)/WORLD_WIDTH,y:Number(target.y)/WORLD_HEIGHT,playerId:target.id});}
 }
 io.to(target.id).emit('player-vitals',playerVitalsPayload(target,{reason:target.alive===false?'pvp-defeat':blocked?'pvp-shield':'pvp-hit',source:'skin-active',damage:blocked?0:damage,attackerId:attacker.id,skillId,serverTime:now}));
 io.to(channelFor(room)).emit('pvp-hit',{x:target.x/WORLD_WIDTH,y:target.y/WORLD_HEIGHT,targetId:target.id,attackerId:attacker.id,damage:blocked?0:damage,skillId,blocked});
 return {blocked,damage,target};
}

const WEAPON_INFUSION_SHOTS=new Set(['physical','electric','pierce','photon','photonRay','nova','prismShard','spread','echoShot','power','ricochet']);
function weaponInfusionFor(player,skillId,now){
 const skill=String(skillId||'physical');
 if(!player||now>=(Number(player.skinWeaponBuffUntil)||0)||!WEAPON_INFUSION_SHOTS.has(skill))return null;
 return player.skinWeaponBuffKind==='paralysis'||player.skinWeaponBuffKind==='poison'?player.skinWeaponBuffKind:null;
}
function applyWeaponInfusionToEnemy(socket,room,player,enemy,skillId,now){
 const kind=weaponInfusionFor(player,skillId,now);
 if(!kind||!enemy||Number(enemy.hp)<=0)return;
 const last=Number(enemy.weaponInfusionLastAt)||0;
 if(now-last<500)return;
 enemy.weaponInfusionLastAt=now;
 if(kind==='paralysis')enemy.paralyzedUntil=Math.max(Number(enemy.paralyzedUntil)||0,now+100);
 else if(kind==='poison'&&now>=(Number(enemy.weaponPoisonProcUntil)||0)){
  enemy.weaponPoisonProcUntil=now+2400;
  for(const delay of [500,1000,1500,2000,2500])setTimeout(()=>{
   if(!room.players.has(player.id)||!room.world?.enemies?.includes(enemy)||Number(enemy.hp)<=0||player.alive===false||socketRoom(socket)!==room)return;
   player.skinActiveServerResolving=true;
   player.weaponPoisonOrigin={x:Number(enemy.x),y:Number(enemy.y)};
   try{processWorldDamage(socket,Number(enemy.id),5,'skin-active-poison-dot');}
   finally{player.skinActiveServerResolving=false;player.weaponPoisonOrigin=null;}
  },delay);
 }
 io.to(channelFor(room)).emit('skin-weapon-impact',{enemyId:enemy.id,kind,until:kind==='paralysis'?now+100:now+2400,x:enemy.x/WORLD_WIDTH,y:enemy.y/roomWorldHeight(room)});
}
function applyWeaponInfusionToPvp(room,attacker,target,skillId,now){
 const kind=weaponInfusionFor(attacker,skillId,now);
 if(!kind||!target||target.alive===false)return;
 const last=Number(target.weaponInfusionLastAt)||0;
 if(now-last<500)return;
 target.weaponInfusionLastAt=now;
 if(kind==='paralysis'){
  target.skinParalyzedUntil=Math.max(Number(target.skinParalyzedUntil)||0,now+100);
  io.to(target.id).emit('player-skin-status',{type:'paralysis',until:target.skinParalyzedUntil});
 }else if(kind==='poison'&&now>=(Number(target.weaponPoisonProcUntil)||0)){
  target.weaponPoisonProcUntil=now+2400;
  for(const delay of [500,1000,1500,2000,2500])setTimeout(()=>{
   const live=room.players.get(target.id);if(!room.players.has(attacker.id)||!live||live.alive===false)return;
   applySkinActivePvpDamage(room,attacker,live,5,'skin-active-poison-dot',Date.now());
  },delay);
 }
 io.to(channelFor(room)).emit('skin-weapon-impact',{targetId:target.id,kind,until:kind==='paralysis'?now+100:now+2400,x:target.x/WORLD_WIDTH,y:target.y/roomWorldHeight(room)});
}
function applyPvpHitSynergies(room,attacker,primaryTarget,baseDamage,sourceSkill,now){
 applyWeaponInfusionToPvp(room,attacker,primaryTarget,sourceSkill,now);
 if(!room||!attacker||!primaryTarget||!Number.isFinite(baseDamage)||baseDamage<=0)return;
 const source=String(sourceSkill||'physical'),players=[...room.players.values()].filter(p=>p.id!==attacker.id&&p.alive!==false);
 const secondaryHit=(target,rawDamage,skillId)=>{
  if(!target||now<(Number(target.invulnerableUntil)||0))return null;
  let blocked=false,damage=0;if((Number(target.shieldCharges)||0)>0){target.shieldCharges--;target.invulnerableUntil=now+350;blocked=true;}else{damage=pvpDamageAmount(attacker,target,rawDamage,Math.hypot(Number(attacker.x)-Number(target.x),Number(attacker.y)-Number(target.y)));target.hp=Math.max(0,(Number(target.hp)||target.maxHp)-damage);target.lastDamageAt=now;target.invulnerableUntil=now+180;if(target.hp<=0){target.alive=false;awardPvpKillXp(room,target,attacker.id);target.velocityX=0;target.velocityY=0;io.to(channelFor(room)).emit('gameplay-notice',{kind:'death',title:String(target.nickname||'MERGULHADOR').toUpperCase(),text:`${target.nickname||'Um mergulhador'} foi engolido pelas profundezas.`,x:Number(target.x)/WORLD_WIDTH,y:Number(target.y)/WORLD_HEIGHT,playerId:target.id});}}
  io.to(target.id).emit('player-vitals',playerVitalsPayload(target,{reason:target.alive===false?'pvp-defeat':blocked?'pvp-shield':'pvp-hit',source:'pvp',damage:blocked?0:damage,attackerId:attacker.id,skillId,serverTime:now}));
  io.to(channelFor(room)).emit('pvp-hit',{x:target.x/WORLD_WIDTH,y:target.y/WORLD_HEIGHT,targetId:target.id,attackerId:attacker.id,damage:blocked?0:damage,skillId,blocked});return target;
 };
 if(source==='electric'&&Number(attacker.electricLevel)>0){let from=primaryTarget,visited=new Set([primaryTarget.id]);for(let n=0;n<Math.min(3,attacker.electricLevel);n++){let next=null,nd=Infinity;for(const p of players){const d=Math.hypot(p.x-from.x,p.y-from.y);if(!visited.has(p.id)&&d<190/WORLD_ZOOM&&d<nd&&!pvpSegmentHitsRock(from.x,from.y,p.x,p.y,2/WORLD_ZOOM)){next=p;nd=d}}if(!next)break;io.to(channelFor(room)).emit('hit-synergy-visual',{type:'electric-arc',fromId:attacker.id,x1:from.x/WORLD_WIDTH,y1:from.y/WORLD_HEIGHT,x2:next.x/WORLD_WIDTH,y2:next.y/WORLD_HEIGHT,seed:Date.now()+n});secondaryHit(next,baseDamage*.34,'electric');visited.add(next.id);from=next;}}
 if(Number(attacker.ricochetLevel)>0&&source!=='ricochet'){let from=primaryTarget,visited=new Set([primaryTarget.id]);for(let n=0;n<Math.min(3,attacker.ricochetLevel);n++){let next=null,nd=Infinity;for(const p of players){const d=Math.hypot(p.x-from.x,p.y-from.y);if(!visited.has(p.id)&&d<190/WORLD_ZOOM&&d<nd&&!pvpSegmentHitsRock(from.x,from.y,p.x,p.y,2/WORLD_ZOOM)){next=p;nd=d}}if(!next)break;io.to(channelFor(room)).emit('hit-synergy-visual',{type:'ricochet-line',fromId:attacker.id,x1:from.x/WORLD_WIDTH,y1:from.y/WORLD_HEIGHT,x2:next.x/WORLD_WIDTH,y2:next.y/WORLD_HEIGHT});secondaryHit(next,baseDamage*.42,'ricochet');visited.add(next.id);from=next;}}
}

// Every PvE XP reward becomes a stationary, server-owned orb. No damage shares.
function grantSharedXp(room,total,_contributors={},source='kill',enemyId=null,position=null){
 if(!room||room.mode==='pvp'||!(Number(total)>0))return;
 const w=room.world;if(!w)return;
 w.orbs=Array.isArray(w.orbs)?w.orbs:[];
 const enemy=w.enemies.find(e=>String(e.id)===String(enemyId));
 const player=[...room.players.values()].find(p=>p.alive!==false);
 const x=Number(position?.x??enemy?.x??player?.x??WORLD_WIDTH/2);
 const y=Number(position?.y??enemy?.y??player?.y??roomWorldHeight(room)/2);
 const orb={id:(w.nextOrbId=(Number(w.nextOrbId)||0)+1),x,y,value:Math.max(1,Math.round(Number(total))),source,spawnedAt:Date.now()};
 w.orbs.push(orb);
 if(w.orbs.length>160)w.orbs.shift();
 io.to(channelFor(room)).emit('world-orb-spawned',orb);
}
function tickSpecimenOrbs(room,players){
 const w=room.world,orbs=w?.orbs;
 if(!Array.isArray(orbs)||!orbs.length)return;
 for(const member of players){
  if(member.alive===false||member.specimenAlive===false||member.runStats?.settled)continue;
  const position=specimenPositionFor(member);
  for(let i=orbs.length-1;i>=0;i--){
   const orb=orbs[i];
   if(Math.hypot(position.x-orb.x,position.y-orb.y)>(position.r+7/WORLD_ZOOM))continue;
   const range=294/WORLD_ZOOM*clamp(Number(member.rangeStrength)||1,1,2.5)*
    SkinAbilities.targetRangeMultiplier(member.skinId,member.specimenPoints,true);
   if(Math.hypot((Number(member.x)||0)-orb.x,(Number(member.y)||0)-orb.y)>range)continue;
   const amount=Math.max(1,Math.round(orb.value*SkinAbilities.orbExperienceMultiplier(member.skinId,member.specimenPoints,true)));
   orbs.splice(i,1);
   if(member.runStats)creditRunXp(member.runStats,amount);
   io.to(member.id).emit('shared-xp-award',{value:amount,source:'specimen-orb',orbId:orb.id});
   io.to(channelFor(room)).emit('world-orb-collected',{id:orb.id,playerId:member.id});
  }
 }
}
// PvP has no neutral monsters: XP is credited on an actual elimination,
// never from collectable arena objects or a client-sent reward.
function awardPvpKillXp(room,target,attackerId){
 if(room?.mode!=='pvp'||!target||!attackerId)return;
 const stamp=Number(target.lastDamageAt)||Date.now();
 if(target.lastPvpXpDeathAt===stamp)return;
 target.lastPvpXpDeathAt=stamp;
 const attacker=room.players.get(String(attackerId));
 if(!attacker||attacker.id===target.id||attacker.alive===false||attacker.runStats?.settled)return;
 const value=Math.round(25*SkinAbilities.orbExperienceMultiplier(attacker.skinId,attacker.specimenPoints,attacker.specimenAlive!==false)*clamp(Number(attacker.magnetStrength)||1,1,1.26)*1000)/1000;
 if(attacker.runStats)creditRunXp(attacker.runStats,value);
 io.to(attacker.id).emit('shared-xp-award',{value,source:'pvp-elimination',enemyId:target.id});
}
const SERVER_STARTED_AT = new Date().toISOString();
const SERVER_INSTANCE_ID = crypto.randomUUID();
let worldTickCount = 0;
let movementGuardRejects = 0;
let lastWorldTickAt = 0;
let worldTickErrors = 0;
let worldTickLastMs = 0;
let worldTickAvgMs = 0;
let worldTickMaxMs = 0;
const combatDiagnostics = { damageEvents: 0, appliedHits: 0, rejectedHits: 0, kills: 0, bossSpawns: 0, playerAttacks: 0, playerDefeats: 0, lastDamageAt: null, lastBossSpawnAt: null, lastPlayerAttackAt: null, lastDamageReason: null, lastPlayerHit: null, directXpAwards:0 };
let worldTicker = null;
const simulatingRooms = new Set();
let roomRegistryReady = false;
let roomDirectoryQueue = Promise.resolve();
function queueRoomDirectory(work){const run=roomDirectoryQueue.then(work,work);roomDirectoryQueue=run.catch(()=>{});return run;}
const deletingRoomIds = new Set();
const pendingRoomDeletion = new Set();
const DEFAULT_ROOM_ID = 'MAR-ABERTO';
const PVP_ROOM_ID = 'MAR-VERMELHO';
const FOSSAS_ROOM_ID = 'MAR-ABYSSAL';
const curatedSkins=require('./public/abyssal-curated-skins.js');
const allowedSkinIds = new Set(['default','violet','solar','toxic','leviathan','thorn','abyssking','royal','glacier','coral','bloodmoon','voidwing','abyssaleye','deepwarden','kraken','aberration','angler','maw','devourer','reefshark','hammerhead','abysscroc','armoredgator','electriceel','electriceellegacy','greensnake','saltcroc','blackcaiman']);
for(const skin of curatedSkins.items)allowedSkinIds.add(skin.id);
allowedSkinIds.add(RiftRewards.FINAL_SKIN);
function isBossKind(kind){ return BOSS_KINDS.has(kind); }
function makeRunStats(){ return { id: crypto.randomUUID(), startedAt: Date.now(), bossesKilled: 0, personalBossesKilled:0, damageDealt:0, score: 0, level: 1, authoritativeXp:0, authoritativeXpNeed:10, pendingUpgradeCredits:0, settled: false, historySaved:false }; }
function stashDeployRun(socket){const room=socketRoom(socket),member=room?.players.get(socket.id),user=users[socket.data.userKey];const run=member?.runStats;if(!room||!member||!user||!run||run.settled)return false;const deployWorld=room.world?JSON.parse(JSON.stringify(room.world)):null;user.pendingRunResume={...run,settled:false,historySaved:Boolean(run.historySaved),roomId:room.id,roomMode:normalizeRoomMode(room.mode),roomResume:{id:room.id,name:room.name||room.id,mode:normalizeRoomMode(room.mode),isPrivate:Boolean(room.isPrivate),passwordSalt:room.passwordSalt||null,passwordHash:room.passwordHash||null,capacity:room.capacity,world:deployWorld},resumeX:Number(member.x),resumeY:Number(member.y),resumeHp:Number(member.hp),resumeShieldCharges:Number(member.shieldCharges)||0,savedAt:Date.now(),expiresAt:Date.now()+5*60*1000};return true;}
function takeDeployRun(user,room){const saved=user?.pendingRunResume;if(!saved)return null;const valid=Number(saved.expiresAt)>=Date.now()&&!saved.settled&&saved.roomId===room.id&&saved.roomMode===normalizeRoomMode(room.mode);if(!valid)return null;delete user.pendingRunResume;return {...makeRunStats(),...saved,settled:false,historySaved:Boolean(saved.historySaved)};}
function restoreDeployRoom(user,requestedId){const saved=user?.pendingRunResume,meta=saved?.roomResume;if(!saved||!meta||String(saved.roomId)!==String(requestedId)||Number(saved.expiresAt)<Date.now()||saved.settled)return null;let room=rooms.get(requestedId);if(!room){room=makeRoom({id:String(meta.id||requestedId),name:String(meta.name||requestedId).slice(0,28),isPrivate:false,capacity:Number(meta.capacity)||6,mode:meta.mode});room.isPrivate=Boolean(meta.isPrivate);room.passwordSalt=meta.passwordSalt||null;room.passwordHash=meta.passwordHash||null;rooms.set(room.id,room);}if(room.players.size===0&&meta.world&&typeof meta.world==='object'){room.world=JSON.parse(JSON.stringify(meta.world));room.world.mode=room.mode==='rift'?'rift':'classic';room.world.lastTick=Date.now();room.world.snapshotTimer=0;room.world.reliableSnapshotTimer=0;room.world.playerSnapshotTimer=0;room.world.orbSnapshotTimer=0;}return room;}
function ensureMatchParticipant(room,p){
 if(!room||!p)return null;room.matchParticipants ||= new Map();
 const key=String(p.userKey||p.nickname||p.id);let row=room.matchParticipants.get(key);
 if(!row){row={key,nickname:String(p.nickname||'Mergulhador').slice(0,18),bossesKilled:0,damage:0,joinedAt:Date.now()};room.matchParticipants.set(key,row);}
 return row;
}
function saveMatchHistoryForUser(user,room,run){
 if(!user||!room||!run||run.historySaved)return;
 const participants=[...(room.matchParticipants?.values?.()||[])].map(p=>({nickname:p.nickname,bossesKilled:Math.max(0,Math.floor(Number(p.bossesKilled)||0)),damage:Math.max(0,Math.round(Number(p.damage)||0))})).sort((a,b)=>b.damage-a.damage||b.bossesKilled-a.bossesKilled||a.nickname.localeCompare(b.nickname));
 const record={id:String(run.id||crypto.randomUUID()),roomId:room.id,roomName:room.name||room.id,mode:room.mode,playedAt:new Date().toISOString(),participants};
 user.matchHistory=[record,...(Array.isArray(user.matchHistory)?user.matchHistory:[]).filter(x=>String(x?.id)!==record.id)].slice(0,10);run.historySaved=true;
}
// Bundle cosmetic title-progress updates during high-density enemy kill streaks.
// Damage, XP orbs and death notifications continue to be sent immediately.
const pendingKillTitleProgress=new WeakMap();
function sendKillTitleProgress(socket,immediate=false){
 if(!socket)return;
 const waiting=pendingKillTitleProgress.get(socket);
 if(waiting){if(!immediate)return;clearTimeout(waiting);pendingKillTitleProgress.delete(socket);}
 const emit=()=>{
  pendingKillTitleProgress.delete(socket);
  if(!socket.connected||!socket.data?.userKey)return;
  const account=users[socket.data.userKey];
  if(account)socket.emit('title-progress',publicTitleProgress(account));
 };
 if(immediate){emit();return;}
 const timer=setTimeout(emit,350);
 timer.unref?.();
 pendingKillTitleProgress.set(socket,timer);
}
function normalizeRoomMode(mode){return mode==='pvp'?'pvp':mode==='rift'?'rift':'coop';}
function makeWorldState(mode='coop'){return WorldSimulation.createWorldState(Date.now(),mode==='rift'?'rift':'classic');}
function makeRoom({id,name,isPrivate=false,passwordSalt=null,passwordHash=null,capacity=6,mode='coop'}={}){
 mode=normalizeRoomMode(mode);
 return {id,name,mode,isPrivate,passwordSalt,passwordHash,capacity:Math.max(1,Math.min(MAX_PLAYERS_PER_ROOM,Number(capacity)||6)),players:new Map(),world:makeWorldState(mode),cleanupTimer:null,emptyRoomTimer:null,createdAt:Date.now(),lastPlayersBroadcastAt:0,matchParticipants:new Map()};
}
rooms.set(DEFAULT_ROOM_ID,makeRoom({id:DEFAULT_ROOM_ID,name:'Mar Aberto',capacity:6}));
rooms.set(PVP_ROOM_ID,makeRoom({id:PVP_ROOM_ID,name:'Mar Vermelho',capacity:6,mode:'pvp'}));
rooms.set(FOSSAS_ROOM_ID,makeRoom({id:FOSSAS_ROOM_ID,name:'Mar Abyssal - Fossas Cooperativo',capacity:6,mode:'rift'}));
function socketRoom(socket){return socket?.data?.roomId?rooms.get(socket.data.roomId)||null:null;}
function channelFor(room){return `abyss-room:${room.id}`;}
function specimenPositionFor(player){
 const x=Number(player?.x)||0,y=(Number(player?.y)||0)-34/WORLD_ZOOM;
 return {x:Number.isFinite(player?.specimenX)?player.specimenX:x,y:Number.isFinite(player?.specimenY)?player.specimenY:y,r:11/WORLD_ZOOM};
}
function specimenStatsFor(player){return SpecimenSystem.stats(Number(player?.specimenPoints)||0);}
function applySpecimenImpact(room,player,rawAmount,source,now,cooldownMs=850){
 if(!room||!player||player.specimenAlive===false||player.alive===false)return false;
 if(now<(Number(player.specimenShieldUntil)||0)||now<(Number(player.specimenInvulnerableUntil)||0)||now<(Number(player.specimenDashUntil)||0))return false;
 const key=String(source||'environment'),until=player.specimenHitCooldowns||Object.create(null);
 if(now<(Number(until[key])||0))return false;
 until[key]=now+cooldownMs;player.specimenHitCooldowns=until;
 if(Object.keys(until).length>128){for(const item of Object.keys(until))if(until[item]<now)delete until[item];}
 const damage=Math.max(1,Number(rawAmount)||1);
 player.specimenHp=Math.max(0,(Number.isFinite(Number(player.specimenHp))?Number(player.specimenHp):player.specimenMaxHp)-damage);
 player.specimenInvulnerableUntil=now+280;
 if(player.specimenHp<=0){
  player.specimenAlive=false;
  player.specimenRespawnAt=now+Math.round(specimenStatsFor(player).respawnSeconds*1000);
  if(Number(player.skinTrailUntil)>now){
   player.skinTrailUntil=0;
   player.skinActiveReadyAt=Math.max(Number(player.skinActiveReadyAt)||0,
    now+Math.round(Number(SkinStandard.activeSpec(player.skinId)?.cooldown||10)*1000));
  }else player.skinActiveReadyAt=0;
  emitSpecimenState(room,player,'defeated');
 }else emitSpecimenState(room,player,'hit');
 return true;
}
function emitSpecimenState(room,player,reason='state'){
 if(!room||!player)return;
 const pos=specimenPositionFor(player);
 const payload={playerId:player.id,skinId:player.skinId,alive:player.specimenAlive!==false,hp:Math.max(0,Number(player.specimenHp)||0),maxHp:Math.max(1,Number(player.specimenMaxHp)||55),respawnAt:Number(player.specimenRespawnAt)||0,x:pos.x/WORLD_WIDTH,y:pos.y/roomWorldHeight(room),reason,points:Number(player.specimenPoints)||0,stats:specimenStatsFor(player)};
 io.to(channelFor(room)).emit('specimen-state',payload);
}

function publicRoomInfo(room){
 const bossCount=room.world.enemies.filter(e=>isBossKind(e.kind)).length;
 return {id:room.id,code:room.id,name:room.name,mode:normalizeRoomMode(room.mode),isPrivate:Boolean(room.isPrivate),playerCount:room.players.size,capacity:room.capacity,available:room.players.size<room.capacity,joinable:true,local:true,state:room.players.size?'INICIADA':'AGUARDANDO',elapsed:Math.floor(room.world.elapsed||0),enemyCount:room.mode==='pvp'?0:room.world.enemies.length,bossCount:room.mode==='pvp'?0:bossCount};
}
function sortRoomInfos(list){return list.sort((a,b)=>{const priority=id=>id===DEFAULT_ROOM_ID?0:id===PVP_ROOM_ID?1:id===FOSSAS_ROOM_ID?2:3;const pa=priority(a.id),pb=priority(b.id);if(pa!==pb)return pa-pb;return (Number(b.playerCount)||0)-(Number(a.playerCount)||0)||String(a.name||'').localeCompare(String(b.name||''));});}
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
 if(!merged.has(DEFAULT_ROOM_ID))merged.set(DEFAULT_ROOM_ID,{id:DEFAULT_ROOM_ID,code:DEFAULT_ROOM_ID,name:'Mar Aberto',mode:'coop',isPrivate:false,playerCount:0,capacity:6,available:true,joinable:true,local:true,state:'AGUARDANDO',elapsed:0,enemyCount:0,bossCount:0,fallback:true});
 if(!merged.has(PVP_ROOM_ID))merged.set(PVP_ROOM_ID,{id:PVP_ROOM_ID,code:PVP_ROOM_ID,name:'Mar Vermelho',mode:'pvp',isPrivate:false,playerCount:0,capacity:6,available:true,joinable:true,local:true,state:'AGUARDANDO',elapsed:0,enemyCount:0,bossCount:0,fallback:true});
 if(!merged.has(FOSSAS_ROOM_ID))merged.set(FOSSAS_ROOM_ID,{id:FOSSAS_ROOM_ID,code:FOSSAS_ROOM_ID,name:'Mar Abyssal - Fossas Cooperativo',mode:'rift',isPrivate:false,playerCount:0,capacity:6,available:true,joinable:true,local:true,state:'AGUARDANDO',elapsed:0,enemyCount:0,bossCount:0,fallback:true});
 return sortRoomInfos([...merged.values()]);
}
function broadcastRooms(){roomListForClients().then(list=>io.emit('rooms-list',list)).catch(err=>console.error('[rooms] broadcast falhou:',err.message));}
app.get('/api/rooms',async(_req,res)=>{try{const list=await roomListForClients();res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate').set('Pragma','no-cache').json({ok:true,rooms:list,serverStartedAt:SERVER_STARTED_AT,build:'3.5.9',generatedAt:new Date().toISOString()});}catch(err){console.error('[rooms] API falhou:',err.message);res.status(200).set('Cache-Control','no-store').json({ok:true,rooms:roomList(),serverStartedAt:SERVER_STARTED_AT,build:'3.5.9',directoryFallback:true});}});
function randomRoomId(){let id;do{id=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(id));return id;}
function worldDepthState(world){
 if(!world)return {bossesDefeated:0,depth:350,zone:null,event:null};
 const bossesDefeated=Math.max(0,Math.floor(Number(world.bossesDefeated)||0));
 const zone=ExpeditionRules.zoneForBosses(bossesDefeated);
 return {
  bossesDefeated,
  mapTier:Math.max(0,Math.floor(Number(world.mapTier)||0)),
  nextTierUnlocked:Number(world.mapTier)<RiftHardcore.FINAL_TIER&&bossesDefeated>Math.max(0,Math.floor(Number(world.mapTier)||0))&&!world.enemies.some(enemy=>BOSS_KINDS.has(enemy.kind)),
  depth:Math.max(0,Math.floor(Number(world.mapTier)||0))*350+(bossesDefeated>Math.max(0,Math.floor(Number(world.mapTier)||0))?350:0),
  zone:zone?{id:zone.id,name:zone.name,shortName:zone.shortName,subtitle:zone.subtitle,accent:zone.accent}:null,
  event:WorldSimulation.currentDepthEvent(world)
 };
}
function getRoomSnapshot(room, metadata = {}){
 if(!room?.world)return null;
 const world=room.world;world.snapshotSeq=(Number(world.snapshotSeq)||0)+1;
 const bossesDefeated=Math.max(0,Math.floor(Number(world.bossesDefeated)||0));
 const activeBossCount=world.enemies.reduce((count,enemy)=>count+(BOSS_KINDS.has(enemy.kind)?1:0),0);
 const progressionPausedForBoss=activeBossCount>0;
 const nextBossAt=Number(world.nextBossAt);
 const elapsed=Math.max(0,Number(world.elapsed)||0);
 const nextBossInSeconds=progressionPausedForBoss?0:(Number.isFinite(nextBossAt)?Math.max(0,nextBossAt-elapsed):100/3.8);
 const progressionDistance=progressionPausedForBoss?100:clamp(100-nextBossInSeconds*3.8,0,100);
 return {room:publicRoomInfo(room),worldId:String(world.worldId||`${room.id}-${room.createdAt||0}`),snapshotSeq:world.snapshotSeq,elapsed:world.elapsed,serverTime:Date.now(),tickCount:world.tickCount||0,movingEnemyCount:world.movingEnemyCount||0,bossesDefeated,bossProgressionCycle:Math.floor(bossesDefeated/7),bossCycleIndex:bossesDefeated%BOSS_KINDS.size,progressionDistance,progressionPausedForBoss,nextBossInSeconds,map:room.mode==='rift'?{version:AbyssalMap.VERSION,seed:Number(world.mapSeed)||0,tier:Number(world.mapTier)||0}:null,depthState:room.mode==='rift'?worldDepthState(world):null,criticalEnemyIds:Array.isArray(metadata.criticalEnemyIds)?metadata.criticalEnemyIds.map(String):[],criticalReason:metadata.criticalReason||null,enemies:world.enemies.slice(0,MAX_ENEMIES_PER_ROOM).map(({damageContributors,...visibleEnemy})=>visibleEnemy),orbs:(world.orbs||[]).map(o=>({id:o.id,x:o.x,y:o.y,value:o.value}))};
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
  const activeWorldHeight=roomWorldHeight(room);
  const zoom=clamp(Number(recipient.worldZoom)||WORLD_ZOOM,.35,1.2);
  const viewWidth=windowWidthSafe(recipient.viewportWidth,1200)/zoom;
  const viewHeight=windowWidthSafe(recipient.viewportHeight,700)/zoom;
  const cameraX=clamp((Number(recipient.x)||0)-viewWidth*.5,0,Math.max(0,WORLD_WIDTH-viewWidth));
  const cameraY=clamp((Number(recipient.y)||0)-viewHeight*.5,0,Math.max(0,activeWorldHeight-viewHeight));
  const paddingX=viewWidth*.22,paddingY=viewHeight*.22;
  bounds={left:cameraX-paddingX,right:cameraX+viewWidth+paddingX,top:cameraY-paddingY,bottom:cameraY+viewHeight+paddingY};
 }
 // Near entities follow the authoritative 20 Hz simulation cadence. Off-screen entities
 // receive a lighter 4 Hz keep-warm sample so they enter the viewport with fresh history
 // without sending the full 400-enemy set on every tick.
 const motionNow=Date.now(),sendFar=!recipient||motionNow-(Number(recipient.lastFarMotionAt)||0)>=250;
 if(recipient&&sendFar)recipient.lastFarMotionAt=motionNow;
 const enemies=recipient?world.enemies.filter(e=>sendFar||(e.x>=bounds.left&&e.x<=bounds.right&&e.y>=bounds.top&&e.y<=bounds.bottom)):world.enemies;
 return {
  worldId:String(world.worldId||`${room.id}-${room.createdAt||0}`),
  snapshotSeq:world.snapshotSeq,elapsed:world.elapsed,serverTime:motionNow,tickCount:world.tickCount||0,intervalMs:50,
  enemies:enemies.map(e=>{
   const x=Math.round((Number(e.x)||0)*100)/100,y=Math.round((Number(e.y)||0)*100)/100;
    const base=[e.id,x,y,Number(e.hp)||0,Number(e.damageRevision)||0,Math.round((Number(e.angle)||0)*1000)/1000,Math.round((Number(e.phase)||0)*1000)/1000];
   if(e.kind==='devourer')return [...base,e.suctionActive===true,Math.round((Number(e.suctionTimer)||0)*100)/100,Math.round((Number(e.suctionCooldown)||0)*100)/100,Math.round((Number(e.suctionPulse)||0)*100)/100];
   if(e.kind==='kraken')return [...base,false,0,0,0,e.krakenSweepActive===true,Math.round((Number(e.krakenTelegraph)||0)*100)/100,Math.round((Number(e.krakenSweepCycle)||0)*100)/100];
   return base;
  }),

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
 return [...room.players.values()].map(peer=>[Number(peer.netId)||0,Number(peer.x)||0,Number(peer.y)||0,Number(peer.angle)||0]);
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
 if(room?.mode==='pvp'){
  room.world.initialized=true;room.world.enemies=[];room.world.orbs=[];room.world.nextEnemyId=0;room.world.nextOrbId=0;
  return [];
 }
 const spawned=WorldSimulation.initializeWorld(room.world,Date.now());
 return spawned;
}
function clearRoomWorld(room){
 if(!room)return;
 room.world=makeWorldState(room.mode);
 // Persistent PvP room must never carry unfinished attacks into the next session.
 if(room.pvpProjectiles)room.pvpProjectiles.length=0;
}
function scheduleUnjoinedRoomExpiry(room,delay=30000){
 if(!room||room.id===DEFAULT_ROOM_ID||room.id===PVP_ROOM_ID||room.id===FOSSAS_ROOM_ID)return;
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
const FIRST_PROGRESSION_REWARD_COINS=50000;
function grantFirstProgressionReward(user){
 if(!user||user.firstProgressionRewardClaimed===true)return false;
 user.firstProgressionRewardClaimed=true;
 user.coins=(Number(user.coins)||0)+FIRST_PROGRESSION_REWARD_COINS;
 user.titleStats ||= {};
 user.titleStats.firstProgressionClear=1;
 return true;
}
function grantFinalConquest(user){
 if(!user)return false;
 user.ownedSkins=Array.isArray(user.ownedSkins)?user.ownedSkins:['default'];
 if(user.ownedSkins.includes('greensnake')&&user.titleStats?.conqueror)return false;
 if(!user.ownedSkins.includes('greensnake'))user.ownedSkins.push('greensnake');
 user.titleStats ||= {};user.titleStats.conqueror=1;
 return true;
}
function awardWorldBossCoins(room){
 const seen=new Set();let changed=false;
 for(const p of room.players.values()){
  // Reading a tutorial grants safety, never passive boss-credit farming.
  if(p.tutorialActive)continue;
  if(p.runStats&&!p.runStats.settled)p.runStats.bossesKilled=(Number(p.runStats.bossesKilled)||0)+1;
  if(!p.userKey||seen.has(p.userKey))continue;seen.add(p.userKey);
  const u=users[p.userKey];if(!u)continue;
  if(room.mode==='rift'&&p.alive!==false){
   u.titleStats ||= {};u.titleStats.riftBossesDefeated=(Number(u.titleStats.riftBossesDefeated)||0)+1;
   const chest=RiftRewards.grant(u,`${room.world.worldId}:${room.world.mapTier}`,{final:Number(room.world.mapTier)===RiftHardcore.FINAL_TIER&&room.world.lastBossKind===RiftHardcore.FINAL_KIND});
   io.to(p.id).emit('rift-chest-ready',{id:chest.id,tier:room.world.mapTier,final:Boolean(chest.final)});
  }
  if(room.mode==='coop'&&p.alive!==false&&Number(p.runStats?.bossesKilled)>=7&&grantFirstProgressionReward(u)){
   p.invulnerableUntil=Math.max(Number(p.invulnerableUntil)||0,Date.now()+25000);
   io.to(p.id).emit('first-progression-reward',{ok:true,awarded:true,amount:FIRST_PROGRESSION_REWARD_COINS});
  }
  if(room.mode==='coop'&&p.alive!==false&&Number(p.runStats?.bossesKilled)>=42&&grantFinalConquest(u)){
   io.to(p.id).emit('abyssal-final-victory',{ok:true,skinId:'greensnake',titleId:'abyssal-conqueror'});
  }
  u.coins=(Number(u.coins)||0)+100;changed=true;io.to(p.id).emit('account-data',publicUser(u));
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
  // A sala viva sempre termina quando fica vazia. Durante manutenção, a retomada de até
  // cinco minutos vem exclusivamente do snapshot persistido em pendingRunResume.
  clearRoomWorld(room);
  if(room.emptyRoomTimer){clearTimeout(room.emptyRoomTimer);room.emptyRoomTimer=null;}
  if(roomId!==DEFAULT_ROOM_ID&&roomId!==PVP_ROOM_ID&&roomId!==FOSSAS_ROOM_ID){
   rooms.delete(roomId);deletingRoomIds.add(roomId);pendingRoomDeletion.add(roomId);
   deleteRoomRow(roomId).then(()=>broadcastRooms()).catch(err=>console.error('[rooms] limpeza da sala vazia:',err.message));
  }
 }else persistRoomRow(room).catch(err=>console.error('[rooms] atualização de contagem:',err.message));
 broadcastRooms();broadcastOnline();refreshWorldTicker();
}
const RICOCHET_SHOT_SKILLS=new Set(['electric','pierce','photon','photonRay','nova','echoShot','prismShard']);
function processWorldDamage(socket,id,damage,skillId=null,batch=null,actionId='',enemyLookup=null){
 combatDiagnostics.damageEvents++;
 const room=socketRoom(socket);
 const reject=(reason)=>{combatDiagnostics.rejectedHits++;combatDiagnostics.lastDamageReason=reason;return {ok:false,id:Number.isFinite(id)?id:null,reason};};
 if(!room||!socket.data.joined)return reject('not-in-room');
 if(!Number.isSafeInteger(id)||!Number.isFinite(damage)||damage<=0||damage>1000)return reject('invalid-hit');
 const player=room.players.get(socket.id);
 const w=room.world,normalizedId=Number(id);let idx=-1,enemy=null;
 if(enemyLookup){enemy=enemyLookup.get(normalizedId)||null;if(!enemy)return reject('enemy-not-found');}
 else{idx=w.enemies.findIndex(e=>Number(e.id)===normalizedId);if(idx<0)return reject('enemy-not-found');enemy=w.enemies[idx];}
 const now=Date.now();
  // Enemies remain invulnerable for the entire emergence animation.
  if(room.mode==='rift'&&enemy.spawnedAt&&now-Number(enemy.spawnedAt)<3000)return reject('enemy-emerging');
  // Reject hits through solid cave walls on the authoritative server.
  const hitOrigin=skillId==='nova'&&player?.novaConeOrigin?player.novaConeOrigin:
   skillId==='skin-active-trail'&&player?.skinActiveServerResolving&&player.skinTrailDamageOrigin?player.skinTrailDamageOrigin:
   skillId==='skin-active-poison-dot'&&player?.skinActiveServerResolving&&player.weaponPoisonOrigin?player.weaponPoisonOrigin:player;
  if(room.mode==='rift'&&hitOrigin&&AbyssalMap.segmentWalkable&&
     !AbyssalMap.segmentWalkable(WorldSimulation.mapLayoutFor(w),Number(hitOrigin.x),Number(hitOrigin.y),Number(enemy.x),Number(enemy.y),Math.min(7,Number(enemy.r)||5)))
     return reject('cave-wall-blocked');
  let requestedDamage=damage;
 if(String(skillId||'').startsWith('skin-active-')&&!player?.skinActiveServerResolving)return reject('skin-active-server-only');
 if(skillId==='photonRay'){
  if(!player)return reject('photon-no-player');
  const range=294*clamp(Number(player.rangeStrength)||1,1,Math.pow(1.22,3))*SkinAbilities.targetRangeMultiplier(player.skinId,player.specimenPoints,player.specimenAlive!==false)/WORLD_ZOOM;
  if(Math.hypot(Number(player.x)-Number(enemy.x),Number(player.y)-Number(enemy.y))>range+20/WORLD_ZOOM)return reject('photon-out-of-range');
  if(!player.photonServerResolving)return reject('photon-ray-server-only');
  requestedDamage=Math.min(requestedDamage,45);
 }
 if(skillId==='nova'){
  if(!player)return reject('nova-no-player');
  const range=294*clamp(Number(player.rangeStrength)||1,1,Math.pow(1.22,3))*
   SkinAbilities.targetRangeMultiplier(player.skinId,player.specimenPoints,player.specimenAlive!==false)/WORLD_ZOOM;
  const coneOrigin=player.novaConeOrigin||player;
  if(now>(Number(player.novaConeUntil)||0)||!GravityCone.contains(coneOrigin.x,coneOrigin.y,
   Number(player.novaConeAngle)||0,enemy.x,enemy.y,enemy.r,range))return reject('nova-outside-cone');
  const cooldown=room.mode==='pvp'?2400:1800,windowUntil=Number(player.novaDamageWindowUntil)||0;
  if(now>windowUntil){if(now<(Number(player.novaDamageReadyAt)||0))return reject('nova-cooldown');player.novaDamageReadyAt=now+cooldown;player.novaDamageWindowUntil=now+260;player.novaDamageTargetIds=new Set();}
  player.novaDamageTargetIds ||= new Set();if(player.novaDamageTargetIds.has(normalizedId))return reject('nova-duplicate-target');player.novaDamageTargetIds.add(normalizedId);
 }
 if(skillId==='arcChain'){
  if(!player||player.arcChainActive!==true)return reject('arc-chain-not-unlocked');
  const rangeStrength=clamp(Number(player.rangeStrength)||1,1,Math.pow(1.22,3));
  const distance=Math.hypot(Number(player.x)-Number(enemy.x),Number(player.y)-Number(enemy.y));
  const radius=294*rangeStrength*SkinAbilities.targetRangeMultiplier(player.skinId,player.specimenPoints,player.specimenAlive!==false)/WORLD_ZOOM;
  if(!Number.isFinite(distance)||distance>radius)return reject('arc-chain-out-of-range');
  const windowUntil=Number(player.arcChainWindowUntil)||0;
  if(now>windowUntil){
   if(now<(Number(player.arcChainReadyAt)||0))return reject('arc-chain-cooldown');
   player.arcChainReadyAt=now+440;
   player.arcChainWindowUntil=now+250;
   player.arcChainTargetIds=new Set();
  }
  player.arcChainTargetIds ||= new Set();
  if(player.arcChainTargetIds.has(normalizedId)||player.arcChainTargetIds.size>=8)return reject('arc-chain-target-limit');
  player.arcChainTargetIds.add(normalizedId);
  requestedDamage=Math.min(requestedDamage,16);
 }
 const targetDistance=Math.hypot(Number(player?.x)-Number(enemy.x),Number(player?.y)-Number(enemy.y));
 const skinMultiplier=SkinAbilities.damageMultiplier(player?.skinId,enemy.kind,targetDistance,Number(player?.maxHp)>0?Number(player?.hp)/Number(player.maxHp):1,player?.specimenPoints,player?.specimenAlive!==false);
 const applied=Math.min(250,requestedDamage*skinMultiplier);
 combatDiagnostics.appliedHits++;combatDiagnostics.lastDamageAt=new Date(now).toISOString();combatDiagnostics.lastDamageReason='accepted';
 const hpBefore=Math.max(0,Number(enemy.hp)||0);
 enemy.hp=Math.max(0,hpBefore-applied);
 if(room?.mode==='rift'&&applied>0)enemy.provokedUntil=now+6500;
 // Overkill cannot count as extra damage for the proportional XP share.
 if(player){enemy.damageContributors ||= Object.create(null);const id=String(player.id);enemy.damageContributors[id]=(Number(enemy.damageContributors[id])||0)+Math.min(applied,hpBefore);}
 if(player?.runStats&&!player.runStats.settled){player.runStats.damageDealt=(Number(player.runStats.damageDealt)||0)+applied;const historyRow=ensureMatchParticipant(room,player);if(historyRow)historyRow.damage=(Number(historyRow.damage)||0)+applied;}enemy.hit=.16;enemy.damageRevision=(Number(enemy.damageRevision)||0)+1;

 if(player&&applied>0&&!String(skillId||'').startsWith('skin-active-'))applyWeaponInfusionToEnemy(socket,room,player,enemy,skillId,now);
 const damageEvent={ok:true,id:enemy.id,hp:enemy.hp,maxHp:enemy.maxHp,damageRevision:enemy.damageRevision,damage:applied,skillId,actionId:String(actionId||'').slice(0,72),kind:enemy.kind,enemyX:enemy.x,enemyY:enemy.y,enemyColor:enemy.color,killed:enemy.hp<=0};
 if(batch)batch.damaged.push(damageEvent);
 else io.to(channelFor(room)).emit('world-enemy-damaged',damageEvent);
 if(enemy.hp<=0){
  const removeIdx=idx>=0?idx:w.enemies.indexOf(enemy);if(removeIdx>=0)w.enemies.splice(removeIdx,1);if(enemyLookup)enemyLookup.delete(normalizedId);combatDiagnostics.kills++;
  const boss=isBossKind(enemy.kind);
  const killer=users[socket.data.userKey];
  if(killer){
   killer.titleStats ||= {monstersDefeated:0,bossesDefeated:0};
   killer.titleStats.monstersDefeated=(Number(killer.titleStats.monstersDefeated)||0)+1;
   if(boss)killer.titleStats.bossesDefeated=(Number(killer.titleStats.bossesDefeated)||0)+1;if(boss&&player?.runStats&&!player.runStats.settled){player.runStats.personalBossesKilled=(Number(player.runStats.personalBossesKilled)||0)+1;const historyRow=ensureMatchParticipant(room,player);if(historyRow)historyRow.bossesKilled=(Number(historyRow.bossesKilled)||0)+1;}
   if(player?.specimenAlive!==false){
    killer.specimenProficiency=SpecimenSystem.addKill(killer.specimenProficiency,player.skinId,boss);
    player.specimenPoints=SpecimenSystem.pointsFor(killer.specimenProficiency,player.skinId);
    io.to(socket.id).emit('specimen-proficiency',{skinId:player.skinId,points:player.specimenPoints,stats:SpecimenSystem.stats(player.specimenPoints)});
   }
   scheduleTitleStatsSave();
   if(batch)batch.accountUpdated=true;
   else sendKillTitleProgress(socket,boss);
  }
  const defeatedEvent={id:enemy.id,x:enemy.x,y:enemy.y,kind:enemy.kind,value:enemy.value,color:enemy.color,boss};
  if(batch)batch.defeated.push(defeatedEvent);
  else io.to(channelFor(room)).emit('world-enemy-defeated',defeatedEvent);
  // XP dos bosses cresce apenas 2% por ciclo completo de sete bosses.
  if(boss){
   const completedCycles=Math.floor(Math.max(0,Number(w.bossesDefeated)||0)/BOSS_KINDS.size);
   enemy.value=Math.round(Math.max(1,Number(enemy.value)||1)*(1+completedCycles*0.02));
   w.bossesDefeated=(Number(w.bossesDefeated)||0)+1;
   if(room.mode==='rift'&&Number(w.mapTier)===RiftHardcore.FINAL_TIER&&enemy.kind===RiftHardcore.FINAL_KIND){w.riftCompleted=true;io.to(channelFor(room)).emit('world-cave-signal',{id:'rift_complete',type:'reward',name:'FOSSAS CONCLUÍDAS',subtitle:'O Pesadelo Roxo caiu. Resgate o baú final para receber suas recompensas.',risk:'CONCLUÍDO',reward:'PESADELO ROXO + ESPÉCIME ALEATÓRIO + 100.000 MOEDAS',accent:'#c887ff',tier:w.mapTier});}
   // Fossas waits for the next tier; Mar Aberto schedules the next
   // boss after another complete progression segment.
   w.nextBossAt=room.mode==='rift'?Infinity:(Number(w.elapsed)||0)+100/3.8;
  }
  grantSharedXp(room,WorldSimulation.xpValueForEnemy(w,enemy),null,'kill',enemy.id,{x:enemy.x,y:enemy.y});
  if(!boss&&enemy.eliteId&&enemy.spawnRoomId==='elite'&&Number(w.eliteRewardClaimedTier)!==Number(w.mapTier)){
   w.eliteRewardClaimedTier=Math.max(0,Math.floor(Number(w.mapTier)||0));
   grantSharedXp(room,ExpeditionRules.eliteRoomBonusValue?.(w.mapTier)||18,null,'elite-cache',enemy.id,{x:enemy.x,y:enemy.y});
   io.to(channelFor(room)).emit('world-cave-signal',{id:'elite_cache',type:'reward',name:'CACHE DE ELITE',subtitle:'A assinatura vermelha colapsou e liberou um núcleo de experiência.',risk:'VENCIDO',reward:'BÔNUS DE ELITE',accent:'#ff5577',tier:w.mapTier});
  }
 if(boss){
   WorldSimulation.startDepthEvent(w,Math.random);
   io.to(channelFor(room)).emit('world-depth-state',worldDepthState(w));
   awardWorldBossCoins(room);
  }
  // A batch sends one consolidated lifecycle update after every hit has been
  // validated; single-hit compatibility uses the same compact lifecycle events.
  if(batch)batch.worldChanged=true;
 }
 // Tempestade elétrica is also resolved here online so every client sees the same distorted arc.
 if(player&&skillId==='electric'&&Number(player.electricLevel)>0){
  let fromX=Number(enemy.x),fromY=Number(enemy.y);
  const visited=new Set([Number(enemy.id)]);
  for(let chain=0;chain<Math.min(3,Number(player.electricLevel)||0);chain++){
   let next=null,nextDistance=Infinity;
   for(const candidate of w.enemies){
    if(!candidate||Number(candidate.hp)<=0||visited.has(Number(candidate.id)))continue;
    const distance=Math.hypot(Number(candidate.x)-fromX,Number(candidate.y)-fromY);
    if(distance<190/WORLD_ZOOM&&distance<nextDistance){next=candidate;nextDistance=distance;}
   }
   if(!next)break;
   visited.add(Number(next.id));
   io.to(channelFor(room)).emit('hit-synergy-visual',{type:'electric-arc',fromId:socket.id,x1:fromX/WORLD_WIDTH,y1:fromY/WORLD_HEIGHT,x2:Number(next.x)/WORLD_WIDTH,y2:Number(next.y)/WORLD_HEIGHT,seed:now+chain*97+Number(next.id)});
   const chained=processWorldDamage(socket,Number(next.id),Math.max(1,requestedDamage*.34),'electric-chain',batch,actionId,enemyLookup);
   if(!chained?.ok)break;
   fromX=Number(next.x);fromY=Number(next.y);
  }
 }
 // Prism is implemented as actual independently simulated projectiles on the client.
 // The shared-shot handler receives the complete volley; no invisible damage is injected here.
 // Ricochet is a server-authoritative hit synergy in PvE as well as PvP.
 // It applies to every damaging source that resolves through processWorldDamage, including Photon Ray,
 // while ricochet-generated hits cannot recursively start another chain.
 if(player&&Number(player.ricochetLevel)>0&&RICOCHET_SHOT_SKILLS.has(String(skillId||''))){
  let fromX=Number(enemy.x),fromY=Number(enemy.y);
  const visited=new Set([Number(enemy.id)]);
  for(let bounce=0;bounce<Math.min(3,Number(player.ricochetLevel)||0);bounce++){
   let next=null,nextDistance=Infinity;
   for(const candidate of w.enemies){
    if(!candidate||Number(candidate.hp)<=0||visited.has(Number(candidate.id)))continue;
    const distance=Math.hypot(Number(candidate.x)-fromX,Number(candidate.y)-fromY);
    if(distance<190/WORLD_ZOOM&&distance<nextDistance){next=candidate;nextDistance=distance;}
   }
   if(!next)break;
   visited.add(Number(next.id));
   io.to(channelFor(room)).emit('hit-synergy-visual',{type:'ricochet-line',fromId:socket.id,x1:fromX/WORLD_WIDTH,y1:fromY/WORLD_HEIGHT,x2:Number(next.x)/WORLD_WIDTH,y2:Number(next.y)/WORLD_HEIGHT});
   const bounced=processWorldDamage(socket,Number(next.id),Math.max(1,requestedDamage*.42),'ricochet',batch,actionId,enemyLookup);
   if(!bounced?.ok)break;
   fromX=Number(next.x);fromY=Number(next.y);
  }
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
 run.settled=true;run.score=score;run.level=level;run.bossesKilled=bossesKilled;user.titleStats ||= {};user.titleStats.runsCompleted=(Number(user.titleStats.runsCompleted)||0)+1;saveMatchHistoryForUser(user,room,run);
 if(member)member.runStats=run;else socket.data.runStats=run;
 settlePeriods();
 const entry={key,nickname:user.nickname,bossesKilled,score:Math.round(score),damage:Math.round(score),level,survival:Math.round(survival),updatedAt:new Date().toISOString()};
 const better=(old)=>!old||bossesKilled>(Number(old.bossesKilled)||0)||(bossesKilled===(Number(old.bossesKilled)||0)&&(score>(Number(old.score??old.damage)||0)||(score===(Number(old.score??old.damage)||0)&&survival>(Number(old.survival)||0))));
 const put=board=>{if(better(board[key]))board[key]=entry;};
 rankings.eternal ||= {};rankings.daily ||= {};rankings.weekly ||= {};rankings.monthly ||= {};
 rankings.daily[dayKey()] ||= {};rankings.weekly[weekKey()] ||= {};rankings.monthly[monthKey()] ||= {};
 put(rankings.eternal);put(rankings.daily[dayKey()]);put(rankings.weekly[weekKey()]);put(rankings.monthly[monthKey()]);
 const expedition=Boolean(!member&&payload.expedition===true),extracted=Boolean(expedition&&payload.extracted===true);const baseEarned=Math.max(5,Math.floor(score/35)+level*2);const expeditionMultiplier=expedition?(1+Math.min(.75,bossesKilled*.15)):1;const earned=Math.min(50000,Math.max(3,Math.round(baseEarned*expeditionMultiplier)));const bossCoins=bossesKilled*100;const unpaidBossCoins=member?0:bossCoins;user.coins=(Number(user.coins)||0)+earned+unpaidBossCoins;run.completionCoins=earned;run.totalRunCoins=earned+bossCoins;
 saveRanks();saveUsers();await flushPersistence();
 const result={ok:true,earned,bossesKilled,bossCoins,totalRunCoins:earned+bossCoins,survival:Math.round(survival),score:Math.round(score),level,expedition,extracted,expeditionMultiplier,account:publicUser(user),rankings:rankingPayload(),message:expedition?(extracted?`Extração registrada: ${bossesKilled} boss(es), bônus de ${Math.round((expeditionMultiplier-1)*100)}% e +${earned} moedas de conclusão.`:`Expedição encerrada: ${bossesKilled} boss(es) abatido(s). Nenhuma penalidade de retirada foi aplicada (+${earned}).`):`Mergulho registrado: ${bossesKilled} boss(es) abatido(s), ${bossCoins} moedas por boss e +${earned} moedas de conclusão.`};
 socket.emit('run-saved',result);io.emit('rankings-updated',rankingPayload());return result;
}

function reviveAtRiftCheckpoint(room,p,now){
 const layout=WorldSimulation.mapLayoutFor(room.world);
 const cp=RiftHardcore.checkpoint(layout,Number(p.x)||0,Number(p.y)||0,p.riftCheckpointRoomId||'start');
 const roomPoint=layout?.rooms?.find(row=>row.id===cp.roomId);
 const fallback=roomPoint?{x:roomPoint.x,y:roomPoint.y-Math.min(105,roomPoint.ry*.23)}:AbyssalMap.startSpawn(layout,0,1);
 const safe=AbyssalMap.isWalkable(layout,cp.x,cp.y,Number(p.r)||13/WORLD_ZOOM)?cp:fallback;
 p.x=safe.x;p.y=safe.y;p.riftCheckpointRoomId=cp.roomId;
 p.alive=true;p.hp=p.maxHp;p.shieldCharges=p.initialShieldCharges||0;
 p.invulnerableUntil=now+3200;p.regenAccumulator=0;p.velocityX=0;p.velocityY=0;
 p.positionResumeGraceUntil=now+1650;p.lastPositionAt=now;
 p.lastPositionSeq=Number(p.lastPositionSeq)||0;p.movementBudget=DEFAULT_CAPACITY;p.movementBudgetAt=now;
 p.riftHazardCooldowns=Object.create(null);
 io.to(p.id).emit('player-reconcile',NetCodec.reconcile(Number(p.lastPositionSeq)||0,p.x,p.y,true));
 io.to(p.id).emit('rift-checkpoint-respawn',{x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,roomId:cp.roomId,invulnerabilityMs:3200,serverTime:now});
 io.to(p.id).emit('player-vitals',playerVitalsPayload(p,{reason:'rift-checkpoint',serverTime:now+1}));
}
function announcePlayerDamage(room,hit){
 if(Number(hit?.damage)<=0)return;
 const target=room.players.get(hit.playerId);
 if(!target)return;
 io.to(channelFor(room)).emit('player-damage-number',{targetId:target.id,x:Number(target.x)/WORLD_WIDTH,y:Number(target.y)/roomWorldHeight(room),damage:Number(hit.damage),source:hit.abilityId||hit.enemyKind||'enemy'});
}

function emitPvpRosterThrottled(room,now,force=false){
 if(!force&&now-(Number(room.lastPvpRosterAt)||0)<180)return;
 room.lastPvpRosterAt=now;
 io.to(channelFor(room)).emit('world-players',[...room.players.values()].map(({userKey,runStats,...p})=>p));
}
function resolveMovingPvpShot(room,shot,target,point,now){
 const shooter=room.players.get(shot.ownerId);
 if(!shooter||shooter.alive===false||target.alive===false||now<(Number(target.invulnerableUntil)||0))return;
 if(shot.volleyTargets?.has(target.id))return;
 shot.volleyTargets?.add(target.id);
 const rawDamage=Math.max(1,Math.min(35,Number(shot.damage)||12));
 const damage=pvpDamageAmount(shooter,target,rawDamage,Math.hypot(shooter.x-target.x,shooter.y-target.y));
 let blocked=false;
 if((Number(target.shieldCharges)||0)>0){target.shieldCharges--;target.invulnerableUntil=now+350;blocked=true;}
 else{
  target.hp=Math.max(0,(Number(target.hp)||target.maxHp)-damage);
  target.lastDamageAt=now;target.invulnerableUntil=now+180;
  if(target.hp<=0){
   target.alive=false;target.velocityX=0;target.velocityY=0;awardPvpKillXp(room,target,shooter.id);
   io.to(channelFor(room)).emit('gameplay-notice',{kind:'death',title:String(target.nickname||'MERGULHADOR').toUpperCase(),text:`${target.nickname||'Um mergulhador'} foi engolido pelas profundezas.`,x:target.x/WORLD_WIDTH,y:target.y/WORLD_HEIGHT,playerId:target.id});
  }
 }
 io.to(target.id).emit('player-vitals',playerVitalsPayload(target,{reason:target.alive===false?'pvp-defeat':blocked?'pvp-shield':'pvp-hit',source:'pvp',damage:blocked?0:damage,attackerId:shooter.id,serverTime:now}));
 io.to(channelFor(room)).emit('pvp-hit',{x:point.x/WORLD_WIDTH,y:point.y/WORLD_HEIGHT,targetId:target.id,attackerId:shooter.id,damage:blocked?0:damage,skillId:shot.special||'physical',actionId:shot.actionId,blocked});
 if(!blocked&&damage>0)applyPvpHitSynergies(room,shooter,target,rawDamage,shot.special||'physical',now);
 emitPvpRosterThrottled(room,now,target.alive===false);
}
// Server-authoritative moving trails: one short-lived node per distinct specimen
// position, shared with every client. Their damage and persistence stay server-side.
function tickSkinTrailNodes(room,players,now){
 const w=room?.world;if(!w)return;
 const previous=Number(w.skinTrailLastTick)||now;
 const dt=Math.min(.12,Math.max(0,(now-previous)/1000));w.skinTrailLastTick=now;
 w.sharkWakeTrails=Array.isArray(w.sharkWakeTrails)?w.sharkWakeTrails:[];
 for(let i=w.sharkWakeTrails.length-1;i>=0;i--){
  const node=w.sharkWakeTrails[i];node.life=(Number(node.life)||0)-dt;
  node.damageTimer=(Number(node.damageTimer)||0)-dt;
  if(node.life<=0)w.sharkWakeTrails.splice(i,1);
 }
 for(const p of players){
  if(p.alive===false||p.specimenAlive===false||now>=(Number(p.skinTrailUntil)||0))continue;
  if(now<(Number(p.skinTrailNextAt)||0))continue;
  const pos=specimenPositionFor(p);
  const traveled=Math.hypot(pos.x-p.skinTrailLastX,pos.y-p.skinTrailLastY);
  if(Number.isFinite(traveled)&&traveled<9/WORLD_ZOOM)continue;
  const angle=Math.atan2(pos.y-(Number(p.skinTrailLastY)||pos.y),pos.x-(Number(p.skinTrailLastX)||pos.x));
  const x=pos.x-Math.cos(angle)*10/WORLD_ZOOM,y=pos.y-Math.sin(angle)*10/WORLD_ZOOM;
  p.skinTrailNextAt=now+160;p.skinTrailLastX=pos.x;p.skinTrailLastY=pos.y;
  const ink=SkinStandard.isInkTrailSkin(p.skinId),color=SkinStandard.trailColor(p.skinId);
  w.sharkWakeTrails.push({ownerId:p.id,x,y,r:20/WORLD_ZOOM,life:10,maxLife:10,damageTimer:.25,
   skinActive:true,ink,color});
  io.to(channelFor(room)).emit('skin-trail-node',{ownerId:p.id,x:x/WORLD_WIDTH,
   y:y/roomWorldHeight(room),ink,color,serverTime:now});
 }
 if(w.sharkWakeTrails.length>450)w.sharkWakeTrails.splice(0,w.sharkWakeTrails.length-450);
}
function tickRoom(room, now) {
 if (!room || room.players.size === 0) { if (room) clearRoomWorld(room); return; }
 const activePlayers = livingPlayers(room);
 if (!activePlayers.length) return;
 // Authoritative pressure knockback uses the same cubic ease as the client's
 // short local prediction, rather than teleporting peers by the whole distance.
 for(const victim of activePlayers){
  const impulse=victim.skinPushImpulse;if(!impulse)continue;
  impulse.elapsed=Math.min(impulse.duration,impulse.elapsed+.05);
  const t=impulse.elapsed/impulse.duration,eased=1-Math.pow(1-t,3);
  const delta=eased-impulse.applied;impulse.applied=eased;
  const nextX=victim.x+impulse.dx*delta,nextY=victim.y+impulse.dy*delta;
  if(!pvpRockAt(nextX,nextY,Number(victim.r)||13/WORLD_ZOOM)){
   victim.x=clamp(nextX,20,WORLD_WIDTH-20);
   victim.y=clamp(nextY,20,roomWorldHeight(room)-20);
  }else victim.skinPushImpulse=null;
  if(t>=1)victim.skinPushImpulse=null;
 }
 // Companions treat survival as higher priority than orb collection.
 const hostile=room.mode==='pvp'?[]:(room.world?.enemies||[]).map(e=>({x:Number(e.x)||0,y:Number(e.y)||0,r:(Number(e.r)||10)/WORLD_ZOOM,hp:e.hp,vx:Number(e.vx)||0,vy:Number(e.vy)||0}));
 const specimenCaveLayout=room.mode==='rift'?WorldSimulation.mapLayoutFor(room.world):null;
 for(const peer of activePlayers){
  if(!Number.isFinite(peer.specimenX)||!Number.isFinite(peer.specimenY)){
   peer.specimenX=Number(peer.x)||0;peer.specimenY=(Number(peer.y)||0)-34/WORLD_ZOOM;
  }
  const lastAt=Number(peer.specimenLastAt)||now,dt=Math.min(.12,Math.max(0,(now-lastAt)/1000));peer.specimenLastAt=now;
  if(peer.specimenAlive===false)continue;
  if(peer.specimenDash&&now<(Number(peer.specimenDashUntil)||0)){
   const dash=peer.specimenDash,progress=clamp((now-dash.startedAt)/650,0,1);
   peer.specimenX=dash.x1+(dash.x2-dash.x1)*progress;
   peer.specimenY=dash.y1+(dash.y2-dash.y1)*progress;
   continue;
  }
  if(peer.specimenDash){peer.specimenX=peer.specimenDash.x2;peer.specimenY=peer.specimenDash.y2;peer.specimenDash=null;emitSpecimenState(room,peer,'dash-landed');}
  const pos={x:peer.specimenX,y:peer.specimenY},radius=11/WORLD_ZOOM;
  const acquisitionRange=294/WORLD_ZOOM*clamp(Number(peer.rangeStrength)||1,1,2.5)*SkinAbilities.targetRangeMultiplier(peer.skinId,peer.specimenPoints,true);
  const orb=room.mode==='pvp'?null:SpecimenEvasion.bestOrb(pos,room.world?.orbs||[],peer,acquisitionRange,hostile,radius,28/WORLD_ZOOM);
  let target=orb?{x:orb.x,y:orb.y}:{x:(Number(peer.x)||0),y:(Number(peer.y)||0)-34/WORLD_ZOOM};
  if(specimenCaveLayout){
   const route=AbyssalMap.navigationTarget(specimenCaveLayout,pos.x,pos.y,target.x,target.y,{padding:5/WORLD_ZOOM});
   if(route&&!route.blocked)target={x:route.x,y:route.y};
  }
  const speed=(SpecimenSystem.biologicalStats(peer.skinId).speed/WORLD_ZOOM)*clamp(Number(peer.speedStrength)||1,1,4)*SkinAbilities.movementMultiplier(peer.skinId,peer.specimenPoints,true);
  const avoidSq=(280/WORLD_ZOOM)**2;
   const nearbyHostile=hostile.filter(e=>(e.x-pos.x)**2+(e.y-pos.y)**2<avoidSq);
   const move=SpecimenEvasion.steer({position:pos,target,enemies:nearbyHostile,speed,dt,radius,clearance:28/WORLD_ZOOM,
   heading:Number(peer.specimenEvasionHeading)||0,
   resolve:specimenCaveLayout?(x,y)=>AbyssalMap.resolveMove(specimenCaveLayout,pos.x,pos.y,x,y,5/WORLD_ZOOM):(x,y)=>({x:clamp(x,18/WORLD_ZOOM,WORLD_WIDTH-18/WORLD_ZOOM),y:clamp(y,18/WORLD_ZOOM,roomWorldHeight(room)-18/WORLD_ZOOM)})});
  peer.specimenX=move.x;peer.specimenY=move.y;peer.specimenEvasionHeading=move.angle;
 }
 const w = room.world;
 tickSpecimenOrbs(room,activePlayers);
 tickSkinTrailNodes(room,activePlayers,now);
 // Arena PvP is a separate ruleset: never spawn or simulate monsters in this mode.
 if(room.mode==='pvp'){
  if(room.pvpProjectiles?.length)PvpProjectiles.advance(room.pvpProjectiles,activePlayers,now,pvpRockAt,(shot,target,point,at)=>resolveMovingPvpShot(room,shot,target,point,at));
   const w=room.world;w.sharkWakeTrails=Array.isArray(w.sharkWakeTrails)?w.sharkWakeTrails:[];
  for(let i=w.sharkWakeTrails.length-1;i>=0;i--){const bubble=w.sharkWakeTrails[i];if(bubble.life<=0){w.sharkWakeTrails.splice(i,1);continue;}if(bubble.damageTimer>0)continue;bubble.damageTimer=.50;for(const target of activePlayers){if(target.id===bubble.ownerId||target.alive===false)continue;if(!DiverHitbox.circleHit(target,bubble.x,bubble.y,bubble.r,now)||pvpSegmentHitsRock(bubble.x,bubble.y,target.x,target.y,1/WORLD_ZOOM))continue;const hitAt=Date.now();let blocked=false;const bubbleOwner=room.players.get(bubble.ownerId);const bubbleDamage=pvpDamageAmount(bubbleOwner,target,5,Math.hypot(Number(target.x)-Number(bubbleOwner?.x),Number(target.y)-Number(bubbleOwner?.y)));if((Number(target.shieldCharges)||0)>0){target.shieldCharges--;target.invulnerableUntil=hitAt+350;blocked=true;}else if(hitAt>=(Number(target.invulnerableUntil)||0)){if(hitAt-(Number(target.lastBubbleDamageAt)||0)<BUBBLE_TRAIL_HIT_MS)continue;target.lastBubbleDamageAt=hitAt;target.hp=Math.max(0,(Number(target.hp)||target.maxHp)-bubbleDamage);target.lastDamageAt=hitAt;target.invulnerableUntil=hitAt+90;if(target.hp<=0){target.alive=false;awardPvpKillXp(room,target,bubble.ownerId);target.velocityX=0;target.velocityY=0;io.to(channelFor(room)).emit('gameplay-notice',{kind:'death',title:String(target.nickname||'MERGULHADOR').toUpperCase(),text:`${target.nickname||'Um mergulhador'} foi engolido pelas profundezas.`,x:Number(target.x)/WORLD_WIDTH,y:Number(target.y)/WORLD_HEIGHT,playerId:target.id});}}else continue;io.to(target.id).emit('player-vitals',playerVitalsPayload(target,{reason:target.alive===false?'pvp-defeat':blocked?'pvp-shield':'pvp-hit',source:'skin-active-trail',damage:blocked?0:bubbleDamage,attackerId:bubble.ownerId,serverTime:hitAt}));io.to(channelFor(room)).emit('pvp-hit',{x:bubble.x/WORLD_WIDTH,y:bubble.y/WORLD_HEIGHT,targetId:target.id,attackerId:bubble.ownerId,damage:blocked?0:bubbleDamage,blocked,source:bubble.skinActive?'skin-active-trail':'reefshark-bubble'});}}
  if(now-(Number(room.lastPlayersBroadcastAt)||0)>=40){room.lastPlayersBroadcastAt=now;io.to(channelFor(room)).volatile.emit('player-motion',NetCodec.playerMotion(getRoomPlayerMotion(room)));}
  return;
 }
 // Boss difficulty scales to everyone occupying the room, including players who are
 // temporarily down and may revive; movement and damage still target living players.
 if(room.mode==='rift'){
  const layout=WorldSimulation.mapLayoutFor(room.world);
  for(const p of activePlayers){const found=AbyssalMap.roomAt(layout,Number(p.x),Number(p.y));if(found)p.riftCheckpointRoomId=found.id;}
 }
 w.roomPlayerCount = room.players.size;
 const result = WorldSimulation.tickWorld(w, activePlayers, now);
 // PvE rastro is damaging while each sampled node exists, not only on activation.
 // A target cannot take extra damage from overlapping bubbles by the same owner.
 for(const bubble of w.sharkWakeTrails||[]){
  if(bubble.life<=0||bubble.damageTimer>0)continue;
  bubble.damageTimer=.60;
  const owner=room.players.get(bubble.ownerId),ownerSocket=owner&&io.sockets.sockets.get(owner.id);
  if(!ownerSocket||owner.alive===false)continue;
  for(const enemy of w.enemies||[]){
   if(Number(enemy.hp)<=0)continue;
   const radius=Number(bubble.r)||20/WORLD_ZOOM;
   if(Math.abs(Number(enemy.x)-bubble.x)>radius+Number(enemy.r)||Math.abs(Number(enemy.y)-bubble.y)>radius+Number(enemy.r))continue;
   if(Math.hypot(Number(enemy.x)-bubble.x,Number(enemy.y)-bubble.y)>radius+(Number(enemy.r)||10))continue;
   enemy.skinTrailLastHit ||= Object.create(null);
   if(now-(Number(enemy.skinTrailLastHit[owner.id])||0)<500)continue;
   enemy.skinTrailLastHit[owner.id]=now;
   owner.skinActiveServerResolving=true;owner.skinTrailDamageOrigin={x:bubble.x,y:bubble.y};
   try{processWorldDamage(ownerSocket,Number(enemy.id),5,'skin-active-trail',null,'trail:'+now);}
   finally{owner.skinActiveServerResolving=false;owner.skinTrailDamageOrigin=null;}
  }
 }
 // The companion is a separate target for hostile contact, boss abilities and
 // physical Rift hazards. The server owns damage, respawn and invulnerability.
 const abilities=Array.isArray(result.bossAbilityEvents)?result.bossAbilityEvents:[];
 const riftLayout=room.mode==='rift'?WorldSimulation.mapLayoutFor(w):null;
 const hazards=riftLayout?RiftHardcore.build(riftLayout,w.mapTier):[];
 const nightmareAlive=room.mode==='rift'&&Number(w.mapTier)===RiftHardcore.FINAL_TIER&&w.enemies.some(enemy=>enemy.kind===RiftHardcore.FINAL_KIND&&enemy.hp>0);
 for(const p of activePlayers){
  if(p.specimenAlive===false){
   if(now>=(Number(p.specimenRespawnAt)||0)){
    p.specimenAlive=true;p.specimenHp=Number(p.specimenMaxHp)||55;p.specimenRespawnAt=0;
    p.specimenX=Number(p.x)||0;p.specimenY=(Number(p.y)||0)-34/WORLD_ZOOM;
    p.specimenLastAt=now;p.specimenInvulnerableUntil=now+1600;
    emitSpecimenState(room,p,'respawn');
   }
   continue;
  }
  const pos=specimenPositionFor(p);
  for(const enemy of w.enemies){
   if(!enemy||Number(enemy.hp)<=0)continue;
   const reach=(Number(enemy.r)||10)+pos.r+6/WORLD_ZOOM;
   if(Math.hypot(Number(enemy.x)-pos.x,Number(enemy.y)-pos.y)>reach)continue;
   if(applySpecimenImpact(room,p,Math.max(5,Number(enemy.damage)||8)*.72,'enemy:'+enemy.id,now,850))break;
  }
  if(p.specimenAlive===false)continue;
  for(const ability of abilities){
   const reach=Number(ability.radius)||0,ex=Number(ability.x)||0,ey=Number(ability.y)||0;
   let touching=false,damage=7;
   if(ability.abilityId==='pressure-lance'){
    const angle=Number(ability.angle)||0;
    touching=DiverHitbox.pointSegmentDistance(pos.x,pos.y,ex,ey,ex+Math.cos(angle)*reach,ey+Math.sin(angle)*reach)<=pos.r+72/WORLD_ZOOM;
    damage=22;
   }else if(ability.abilityId==='gulper-chomp'){
    touching=Math.hypot(pos.x-ex,pos.y-ey)<=reach+pos.r;damage=24;
   }else if(ability.abilityId==='ink-trail'){
    touching=Math.hypot(pos.x-ex,pos.y-ey)<=reach+pos.r;damage=2;
   }
   if(touching)applySpecimenImpact(room,p,damage*.72,'ability:'+ability.bossId+':'+ability.abilityId,now,500);
   if(p.specimenAlive===false)break;
  }
  if(p.specimenAlive===false)continue;
  for(const h of hazards){
   if(h.type==='tentacle'&&!nightmareAlive)continue;
   const phase=RiftHardcore.state(h,w.elapsed);
   if(phase.phase!=='active'||!RiftHardcore.hit(h,pos.x,pos.y,pos.r,phase))continue;
   applySpecimenImpact(room,p,Math.max(2,Number(h.damage)||7)*.72,'rift:'+h.id,now,h.type==='tentacle'?690:1000);
   if(p.specimenAlive===false)break;
  }
 }
 const spawnedEnemies = Array.isArray(result.spawnedEnemies) ? result.spawnedEnemies : [];
 const spawnedBosses = (result.spawnedBosses || []).filter(boss => isBossKind(boss.kind));
 const spawnedXpRewards = Array.isArray(result.spawnedXpRewards) ? result.spawnedXpRewards : [];
 const playerHits = Array.isArray(result.playerHits) ? result.playerHits : [];
 const bossAbilityHits = Array.isArray(result.bossAbilityHits) ? result.bossAbilityHits : [];
 const bossAbilityEvents = Array.isArray(result.bossAbilityEvents) ? result.bossAbilityEvents : [];
 const riftAims=Array.isArray(result.riftAims)?result.riftAims:[];
 const environmentDamages=Array.isArray(result.environmentDamages)?result.environmentDamages:[];
 const environmentKills=Array.isArray(result.environmentKills)?result.environmentKills:[];
 if(result.eventEnded)io.to(channelFor(room)).emit('world-depth-state',worldDepthState(w));
 // One server-owned curved path per tentacle cycle, synchronized to every observer.
 for(const aim of riftAims)io.to(channelFor(room)).emit('world-rift-tentacle-aim',aim);
 for(const hit of environmentDamages)io.to(channelFor(room)).emit('world-enemy-damaged',{ok:true,...hit});
 for(const death of environmentKills){
  io.to(channelFor(room)).emit('world-enemy-defeated',death);
  grantSharedXp(room,death.xpValue||1,null,'rift-hazard-kill',death.id,{x:death.x,y:death.y});
  if(death.boss){awardWorldBossCoins(room);WorldSimulation.startDepthEvent(w,Math.random);io.to(channelFor(room)).emit('world-depth-state',worldDepthState(w));}
 }
 if(environmentKills.length){combatDiagnostics.kills+=environmentKills.length;combatDiagnostics.appliedHits+=environmentDamages.length;}
 for(const reward of spawnedXpRewards)grantSharedXp(room,reward.value,null,reward.source||'rift-reward');
 if(result.sideEncounter)io.to(channelFor(room)).emit('world-cave-signal',result.sideEncounter);

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
   const motion=getRoomMotionSnapshot(room,{player:recipient});
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
 for(const event of bossAbilityEvents){
  if(!event||!event.abilityId)continue;
  io.to(channelFor(room)).emit('boss-ability-visual',{
   bossId:event.bossId,kind:event.kind,abilityId:event.abilityId,
   x:Number(event.x)/WORLD_WIDTH,y:Number(event.y)/roomWorldHeight(room),
   angle:Number(event.angle)||0,radius:Number(event.radius)||0,color:event.color||'#79f3f0',serverTime:now,
    shape:event.shape||null,length:Number(event.length)||0,issuedAt:Number(event.issuedAt)||0,hitAt:Number(event.hitAt)||0,attackId:event.id||null,damage:Number(event.damage)||0
  });
 }
 for(const hit of bossAbilityHits){
  if(!hit?.playerId)continue;
  io.to(hit.playerId).emit('player-vitals',{
   ...hit,source:'boss-ability',reason:'boss-ability',skillId:hit.abilityId,serverTime:now
  });
  announcePlayerDamage(room,hit);
  if(hit.alive===false&&room.mode!=='rift'){
   const defeated=room.players.get(hit.playerId),nickname=String(defeated?.nickname||'Mergulhador').slice(0,18);
   io.to(channelFor(room)).emit('gameplay-notice',{kind:'death',title:nickname.toUpperCase(),text:`${nickname} foi destruído por uma habilidade colossal.`,x:Number(defeated?.x)/WORLD_WIDTH,y:Number(defeated?.y)/WORLD_HEIGHT,playerId:hit.playerId});
   io.to(channelFor(room)).emit('world-players',[...room.players.values()].map(({userKey,runStats,...peer})=>peer));
  }
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
  announcePlayerDamage(room,hit);
  if (!hit.alive&&room.mode!=='rift') {
   const defeated=room.players.get(hit.playerId);const nickname=String(defeated?.nickname||'Mergulhador').slice(0,18);
   io.to(channelFor(room)).emit('gameplay-notice',{kind:'death',title:nickname.toUpperCase(),text:`${nickname} foi engolido pelas profundezas.`,x:Number(defeated?.x)/WORLD_WIDTH,y:Number(defeated?.y)/WORLD_HEIGHT,playerId:hit.playerId});
   io.to(channelFor(room)).emit('world-players', [...room.players.values()].map(({ userKey, runStats, ...peer }) => peer));
  }
 }
 for (const heal of result.playerHeals || []) {
  io.to(heal.playerId).emit('player-vitals', { ...heal, reason: 'regeneration', serverTime: now });
 }
 if(room.mode==='rift'){
  const bossRoom=WorldSimulation.mapLayoutFor(room.world)?.rooms.find(r=>r.id==='boss');
  const guardians=room.world.enemies.filter(e=>e.kind===RiftHardcore.FINAL_KIND&&e.hp>0);
  const bossPlayers=[...room.players.values()].filter(p=>p.riftCheckpointRoomId==='boss');
  if(bossRoom&&guardians.length&&bossPlayers.length&&!bossPlayers.some(p=>p.alive!==false)){
   for(const guardian of guardians){guardian.hp=guardian.maxHp;guardian.riftPendingAttacks=[];guardian.riftNextAttackAt=0;}
  }
  let changed=false;
  for(const p of room.players.values())if(p.alive===false){reviveAtRiftCheckpoint(room,p,now);changed=true;}
  if(changed)io.to(channelFor(room)).emit('world-players',[...room.players.values()].map(({userKey,runStats,...p})=>p));
 }
 if (result.sendPlayers) io.to(channelFor(room)).emit('world-players', [...room.players.values()].map(({ userKey, runStats, ...p }) => p));
}

function worldTick() {
 if(!simulatingRooms.size){if(worldTicker){clearInterval(worldTicker);worldTicker=null;}return;}
 const tickStarted=process.hrtime.bigint(),now=Date.now();worldTickCount++;lastWorldTickAt=now;
 for(const room of simulatingRooms){
  if(rooms.get(room.id)!==room){simulatingRooms.delete(room);continue;}
  const roomTickStarted=process.hrtime.bigint();
  try{tickRoom(room,now);}
  catch(err){worldTickErrors++;room.world.lastTick=now;console.error(`[simulation] tick failed in room ${room.id}:`,err.stack||err);}
  const roomTickMs=Number(process.hrtime.bigint()-roomTickStarted)/1e6;
  room.tickProcessingLastMs=roomTickMs;
  room.tickProcessingAvgMs=Number(room.tickProcessingAvgMs)>0?Number(room.tickProcessingAvgMs)*.92+roomTickMs*.08:roomTickMs;
  room.tickProcessingMaxMs=Math.max(Number(room.tickProcessingMaxMs)||0,roomTickMs);
  if(!hasLivingPlayers(room))simulatingRooms.delete(room);
 }
 const tickMs=Number(process.hrtime.bigint()-tickStarted)/1e6;worldTickLastMs=tickMs;worldTickAvgMs=worldTickAvgMs?worldTickAvgMs*.92+tickMs*.08:tickMs;worldTickMaxMs=Math.max(worldTickMaxMs,tickMs);
 // Only currently occupied, living rooms are visited in the hot 50 ms loop.
 if(!simulatingRooms.size&&worldTicker){clearInterval(worldTicker);worldTicker=null;}
}

function windowWidthSafe(value,fallback){return Math.max(320,Math.min(10000,Number(value)||fallback||1200));}
io.on('connection', socket => {
 socket.data.nickname = null; socket.data.userKey = null; socket.data.joined = false; socket.data.roomId = null; broadcastOnline();
 socket.emit('online-count', onlineCount()); roomListForClients().then(list=>{if(socket.connected)socket.emit('rooms-list',list)}).catch(err=>{console.error('[rooms] lista inicial falhou:',err.message);if(socket.connected)socket.emit('rooms-list',roomList())});
 socket.on('authenticate', async (payload = {}) => {
  const ip = socket.handshake.address || 'unknown', now = Date.now();
  const attempts = (authAttempts.get(ip) || []).filter(t => now - t < 60000);
  if (attempts.length >= 12) return socket.emit('auth-result', { ok: false, message: 'Muitas tentativas. Aguarde um minuto.' });
  const nickname = String(payload.nickname || '').trim(), password = String(payload.password || '');
  if (!/^[a-zA-Z0-9_]{3,18}$/.test(nickname) || password.length < 8 || password.length > 128) return socket.emit('auth-result', { ok: false, message: 'Nickname inválido ou senha fora do limite (8–128 caracteres).' });
  const key = nickname.toLowerCase(); let user = Object.hasOwn(users, key) ? users[key] : null;
  const mode = payload.mode === 'register' ? 'register' : 'login';
  if (mode === 'register') {
   const email=String(payload.email||'').trim().toLowerCase();
   if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return socket.emit('auth-result',{ok:false,message:'Informe um email válido para recuperação de senha.'});
   if (user) return socket.emit('auth-result', { ok: false, message: 'Este nickname já existe. Use Entrar ou escolha outro nickname.' });
   if(Object.values(users).some(existing=>String(existing?.email||'').toLowerCase()===email))return socket.emit('auth-result',{ok:false,message:'Este email já está vinculado a uma conta.'});
   const salt = crypto.randomBytes(16).toString('hex');
   const passwordHash=await hashPassword(password,salt);
   if(!passwordHash)return socket.emit('auth-result',{ok:false,message:'Não foi possível proteger sua senha agora. Tente novamente.'});
   if(Object.hasOwn(users,key)||Object.values(users).some(existing=>String(existing?.email||'').toLowerCase()===email))return socket.emit('auth-result',{ok:false,message:'Nickname ou email acabou de ser registrado. Tente outro.'});
   user = users[key] = { accountId:crypto.randomUUID(),nickname,email,salt,passwordHash, createdAt: new Date().toISOString(), coins: 0, ownedSkins: ['default'], equippedSkin: 'default', metaUpgrades:{}, lastWheelAt:0 };
   saveUsers();
  } else {
   if (!user) return socket.emit('auth-result', { ok: false, message: 'Conta não encontrada. Clique em Criar conta primeiro.' });
   const candidate = await hashPassword(password, user.salt);
   if (!candidate || !safeEqual(candidate, user.passwordHash)) { attempts.push(now); authAttempts.set(ip, attempts); return socket.emit('auth-result', { ok: false, message: 'Senha incorreta para este nickname.' }); }
  }
  ensureAccountId(user);user.metaUpgrades ||= {}; user.ownedSkins ||= ['default']; user.redeemedCodes ||= []; user.coins ||= 0; user.lastWheelAt ||= 0; user.titleStats ||= {monstersDefeated:0,bossesDefeated:0,cardumesCreated:0}; user.likedBy ||= [];user.likedProfiles ||= []; user.equippedTitle ||= 'abyss-drifter'; socket.data.nickname = user.nickname; socket.data.userKey = key;
  const sessionToken=issueSessionToken(user);saveUsers();await flushPersistence();
  socket.emit('auth-result', { ok: true, mode, ...publicUser(user), sessionToken });broadcastCardumeRosters();
 });
 socket.on('resume-session',async(payload={})=>{
  const token=String(payload?.token||'');
  if(!/^[a-f0-9]{64}$/i.test(token))return socket.emit('session-resumed',{ok:false,message:'Sessão expirada. Entre novamente.'});
  const digest=hashSessionToken(token),now=Date.now();
  // During a rolling Render deploy the replacement instance boots before the retiring
  // instance receives SIGTERM. Read PostgreSQL again here so session restoration cannot
  // overwrite a deploy snapshot that was persisted after this process booted.
  if(pgPool){
   try{
    const result=await pgPool.query("SELECT state_value FROM abyssal_state WHERE state_key='users' LIMIT 1");
    const persisted=result.rows?.[0]?.state_value;
    if(persisted&&typeof persisted==='object'){
     const freshMatch=Object.entries(persisted).find(([,candidate])=>(Array.isArray(candidate?.sessionTokens)?candidate.sessionTokens:[]).some(item=>item&&Number(item.expiresAt)>now&&safeEqual(item.hash,digest)));
     if(freshMatch){const [freshKey,freshUser]=freshMatch;users[freshKey]={...(users[freshKey]||{}),...freshUser};}
    }
   }catch(err){console.error('[deploy] Falha ao atualizar sessão persistida:',err.message);}
  }
  const match=Object.entries(users).find(([,user])=>(Array.isArray(user.sessionTokens)?user.sessionTokens:[]).some(item=>item&&Number(item.expiresAt)>now&&safeEqual(item.hash,digest)));
  if(!match)return socket.emit('session-resumed',{ok:false,message:'Sessão expirada. Entre novamente.'});
  const [key,user]=match;
  user.sessionTokens=user.sessionTokens.filter(item=>item&&Number(item.expiresAt)>now);
  ensureAccountId(user);user.metaUpgrades ||= {};user.ownedSkins ||= ['default'];user.redeemedCodes ||= [];user.coins ||= 0;user.lastWheelAt ||= 0;user.titleStats ||= {monstersDefeated:0,bossesDefeated:0,cardumesCreated:0};user.likedBy ||= [];user.likedProfiles ||= [];user.equippedTitle ||= 'abyss-drifter';
  socket.data.nickname=user.nickname;socket.data.userKey=key;
  // Do not rewrite the entire users snapshot here. The reconnecting client joins the
  // preserved room next; writing stale process memory at this point can erase another
  // instance's shutdown handoff.
  socket.emit('session-resumed',{ok:true,...publicUser(user)});broadcastCardumeRosters();
 });
  socket.on('get-public-profile',(payload={})=>{if(!SOCIAL_FEATURES_ENABLED)return socket.emit('public-profile-result',{ok:false,message:'Perfis públicos estão temporariamente indisponíveis durante a revisão de segurança.'});const nickname=String(payload.nickname||'').trim();if(!/^[a-zA-Z0-9_]{3,18}$/.test(nickname))return socket.emit('public-profile-result',{ok:false,message:'Perfil indisponível.'});const key=nickname.toLowerCase(),profile=publicProfile(key,socket.data.userKey||null);if(!profile)return socket.emit('public-profile-result',{ok:false,message:'Jogador não encontrado.'});socket.emit('public-profile-result',{ok:true,profile});});
  socket.on('toggle-user-block',(payload={})=>{
   if(!SOCIAL_FEATURES_ENABLED)return socket.emit('user-block-result',{ok:false,message:'Os recursos sociais estão indisponíveis.'});
   const viewerKey=socket.data.userKey,viewer=users[viewerKey];if(!viewer)return socket.emit('user-block-result',{ok:false,message:'Entre na sua conta para bloquear usuários.'});
   const targetKey=String(payload.nickname||'').trim().toLowerCase(),target=users[targetKey];if(!target)return socket.emit('user-block-result',{ok:false,message:'Jogador não encontrado.'});
   if(targetKey===viewerKey)return socket.emit('user-block-result',{ok:false,message:'Você não pode bloquear o próprio perfil.'});
   viewer.blockedUsers ||= [];viewer.likedProfiles ||= [];target.likedBy ||= [];
   const blocked=viewer.blockedUsers.includes(targetKey);
   if(blocked)viewer.blockedUsers=viewer.blockedUsers.filter(key=>key!==targetKey);
   else{viewer.blockedUsers.push(targetKey);viewer.likedProfiles=viewer.likedProfiles.filter(key=>key!==targetKey);target.likedBy=target.likedBy.filter(key=>key!==viewerKey);}
   saveUsers();socket.emit('user-block-result',{ok:true,blocked:!blocked,profile:publicProfile(targetKey,viewerKey),account:publicUser(viewer),message:blocked?'Usuário desbloqueado.':'Usuário bloqueado. Interações sociais entre vocês foram interrompidas.'});
  });
  socket.on('toggle-profile-like',(payload={})=>{if(!SOCIAL_FEATURES_ENABLED)return socket.emit('profile-like-result',{ok:false,message:'Os recursos sociais estão temporariamente indisponíveis durante a revisão de segurança.'});const viewerKey=socket.data.userKey;if(!viewerKey||!users[viewerKey])return socket.emit('profile-like-result',{ok:false,message:'Entre na sua conta para curtir perfis.'});const targetNickname=String(payload.nickname||'').trim();const targetKey=targetNickname.toLowerCase(),target=users[targetKey],viewer=users[viewerKey];if(!target)return socket.emit('profile-like-result',{ok:false,message:'Jogador não encontrado.'});if(targetKey===viewerKey)return socket.emit('profile-like-result',{ok:false,message:'Você não pode curtir seu próprio perfil.'});target.blockedUsers ||= [];viewer.blockedUsers ||= [];if(viewer.blockedUsers.includes(targetKey)||target.blockedUsers.includes(viewerKey))return socket.emit('profile-like-result',{ok:false,message:'Esta interação não está disponível entre usuários bloqueados.'});target.likedBy ||= [];viewer.likedProfiles ||= [];const already=target.likedBy.includes(viewerKey);if(already){target.likedBy=target.likedBy.filter(k=>k!==viewerKey);viewer.likedProfiles=viewer.likedProfiles.filter(k=>k!==targetKey);}else{target.likedBy.push(viewerKey);viewer.likedProfiles.push(targetKey);}saveUsers();socket.emit('profile-like-result',{ok:true,liked:!already,profile:publicProfile(targetKey,viewerKey),account:publicUser(viewer),message:already?'Curtida removida.':'Você curtiu este perfil!'});for(const client of (io.sockets?.sockets?.values?.() || []))if(client.data?.userKey===targetKey){client.emit('account-data',publicUser(target));client.emit('profile-likes-updated',{likesReceived:target.likedBy.length});}});
  socket.on('report-ugc',async(payload={})=>{
   const reporterKey=socket.data.userKey,reporter=users[reporterKey];
   if(!reporter)return socket.emit('ugc-report-result',{ok:false,message:'Entre na sua conta para enviar uma denúncia.'});
   const type=payload.type==='cardume'?'cardume':'profile',targetId=String(payload.targetId||'').trim().slice(0,80),reason=String(payload.reason||'').trim().slice(0,60),details=String(payload.details||'').trim().replace(/[\u0000-\u001f]/g,' ').slice(0,800);
   const allowedReasons=new Set(['nome-improprio','assedio','discriminacao','fraude','dados-pessoais','conteudo-ilegal','outro']);
   if(!targetId||!allowedReasons.has(reason))return socket.emit('ugc-report-result',{ok:false,message:'Selecione um motivo válido para a denúncia.'});
   let targetLabel='',targetKey='',snapshot='';
   if(type==='profile'){
    targetKey=targetId.toLowerCase();const target=users[targetKey];if(!target)return socket.emit('ugc-report-result',{ok:false,message:'Perfil não encontrado.'});
    if(targetKey===reporterKey)return socket.emit('ugc-report-result',{ok:false,message:'Você não pode denunciar o próprio perfil.'});
    targetLabel=target.nickname;ensureAccountId(target);snapshot='Nickname atual: '+target.nickname+'\nUUID permanente da conta: '+target.accountId;
   }else{const c=cardumes[targetId];if(!c)return socket.emit('ugc-report-result',{ok:false,message:'Cardume não encontrado.'});targetKey=c.id;targetLabel=c.name;snapshot='Nome: '+c.name+'\nID interno do Cardume: '+c.id+'\nDescrição: '+String(c.description||'')+'\nLíder: '+String(c.leader||'');}
   reporter.moderationReports ||= [];const now=Date.now(),recent=reporter.moderationReports.filter(r=>now-Number(r.at||0)<3600000);reporter.moderationReports=recent;
   if(recent.length>=8)return socket.emit('ugc-report-result',{ok:false,message:'Limite temporário de denúncias atingido. Aguarde antes de enviar outra.'});
   const matchId=String(payload.matchId||'').slice(0,80),duplicate=recent.find(r=>r.type===type&&r.targetKey===targetKey&&r.reason===reason&&String(r.matchId||'')===matchId);
   if(duplicate)return socket.emit('ugc-report-result',{ok:false,message:'Esta denúncia já foi registrada recentemente. Protocolo: '+String(duplicate.reportId).slice(0,8).toUpperCase()});
   const context=payload.context&&typeof payload.context==='object'?payload.context:{};
   const contextLines=matchId?['ID da partida: '+matchId,'Sala: '+String(context.roomName||context.roomId||'não informada').slice(0,100),'Data da partida: '+String(context.playedAt||'não informada').slice(0,60),'Bosses abatidos pelo alvo: '+Math.max(0,Math.floor(Number(context.bossesKilled)||0)),'Dano do alvo: '+Math.max(0,Math.round(Number(context.damage)||0)).toLocaleString('pt-BR')]:['Origem: perfil/cardume fora do histórico de partidas'];
   const target=type==='profile'?users[targetKey]:null;const priorReports=target?Math.max(0,Number(target.moderationReportCount)||0):0;
   const apiKey=String(process.env.SENDGRID_API_KEY||''),from=String(process.env.RECOVERY_FROM_EMAIL||'');if(!apiKey||!from)return socket.emit('ugc-report-result',{ok:false,message:'O canal de moderação está temporariamente indisponível.'});
   const reportId=crypto.randomUUID(),createdAt=new Date().toISOString();
   const body=['DENÚNCIA DE UGC - ABYSSAL','Protocolo: '+reportId,'Data UTC: '+createdAt,'','IDENTIFICAÇÃO','Denunciante: '+reporter.nickname,'UUID permanente do denunciante: '+ensureAccountId(reporter),'Tipo: '+type,'Alvo: '+targetLabel,'UUID permanente do alvo: '+(target?ensureAccountId(target):targetKey),'Motivo: '+reason,'Denúncias anteriores registradas contra este alvo: '+priorReports,'','CONTEXTO DA PARTIDA',...contextLines,'','CONTEÚDO / PERFIL CAPTURADO',snapshot,'','RELATO DO DENUNCIANTE',details||'Não informado','','Ação necessária: revisar o contexto e aplicar medida apropriada conforme Termos e regras da comunidade. Não aplicar punição automática apenas pela quantidade de denúncias.'].join('\n');
   try{
    const response=await fetch('https://api.sendgrid.com/v3/mail/send',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({personalizations:[{to:[{email:'abyssalelectrongames@gmail.com'}]}],from:{email:from,name:'Abyssal - Moderação'},subject:'Abyssal | DENÚNCIA | '+reason+' | '+targetLabel+' | '+reportId.slice(0,8).toUpperCase(),content:[{type:'text/plain',value:body}]})});
    if(!response.ok)return socket.emit('ugc-report-result',{ok:false,message:'Não foi possível entregar a denúncia ao suporte agora.'});
    reporter.moderationReports.push({at:now,reportId,type,targetKey,reason,matchId});if(target)target.moderationReportCount=priorReports+1;saveUsers();
    socket.emit('ugc-report-result',{ok:true,reportId,message:'Denúncia enviada ao suporte para análise. Protocolo: '+reportId.slice(0,8).toUpperCase()});
   }catch(err){console.error('[moderation] Falha ao enviar denúncia:',err.message);socket.emit('ugc-report-result',{ok:false,message:'Falha temporária ao enviar a denúncia.'});}
  });
  socket.on('get-cardume-details',()=>{if(!SOCIAL_FEATURES_ENABLED)return socket.emit('cardume-details',{cardume:null,roster:[]});const user=users[socket.data.userKey],c=user&&cardumes[user.cardumeId];if(!c)return socket.emit('cardume-details',{cardume:null,roster:[]});emitCardumeRoster(c);});

    const publicCardume = c => ({id:c.id,name:c.name,description:c.description,leader:c.leader,members:c.members.length,capacity:c.capacity,createdAt:c.createdAt,open:c.open});
  const sendCardumes = () => socket.emit('cardumes-list',SOCIAL_FEATURES_ENABLED?Object.values(cardumes).map(publicCardume).sort((a,b)=>b.members-a.members||a.name.localeCompare(b.name)):[]);
  socket.on('list-cardumes',sendCardumes);
  socket.on('create-cardume',(payload={})=>{
   if(!SOCIAL_FEATURES_ENABLED)return socket.emit('cardume-action-result',{ok:false,message:'Os recursos sociais estão temporariamente indisponíveis enquanto os controles de segurança são preparados.'});
   const key=socket.data.userKey,user=users[key];if(!user)return socket.emit('cardume-action-result',{ok:false,message:'Entre na sua conta para criar um Cardume.'});
   if(user.cardumeId&&cardumes[user.cardumeId])return socket.emit('cardume-action-result',{ok:false,message:'Você já faz parte de um Cardume.'});
   const name=String(payload.name||'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,24),description=String(payload.description||'').replace(/[<>\u0000-\u001f]/g,' ').trim().slice(0,120);
   if(name.length<3)return socket.emit('cardume-action-result',{ok:false,message:'O nome do Cardume deve ter pelo menos 3 caracteres.'});
   if(Object.values(cardumes).some(c=>c.name.toLowerCase()===name.toLowerCase()))return socket.emit('cardume-action-result',{ok:false,message:'Já existe um Cardume com esse nome.'});
   if(Object.keys(cardumes).length>=500)return socket.emit('cardume-action-result',{ok:false,message:'O limite de Cardumes foi atingido.'});
   const id=crypto.randomUUID(),entry={id,name,description,leader:user.nickname,members:[key],capacity:30,open:true,createdAt:Date.now()};cardumes[id]=entry;user.cardumeId=id;user.titleStats ||= {};user.titleStats.cardumesCreated=(Number(user.titleStats.cardumesCreated)||0)+1;saveCardumes();saveUsers();socket.emit('cardume-action-result',{ok:true,message:'Cardume criado! Você é o líder.',cardume:publicCardume(entry),account:publicUser(user)});sendCardumes();emitCardumeRoster(entry);
  });
  socket.on('join-cardume',(payload={})=>{
   if(!SOCIAL_FEATURES_ENABLED)return socket.emit('cardume-action-result',{ok:false,message:'Os recursos sociais estão temporariamente indisponíveis enquanto os controles de segurança são preparados.'});
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
  socket.on('list-rooms', async () => { socket.emit('rooms-list',await roomListForClients()); });
 socket.on('create-room', async payload => {
  if(!socket.data.nickname||!socket.data.userKey)return socket.emit('room-created',{ok:false,message:'Entre na sua conta antes de criar uma sala.'});
  payload=payload&&typeof payload==='object'?payload:{};
  const name=String(payload.name||'Expedição Abissal').trim().replace(/[<>]/g,'').slice(0,28)||'Expedição Abissal';
  const capacity=Math.max(1,Math.min(MAX_PLAYERS_PER_ROOM,Math.floor(Number(payload.capacity)||6)));
  const isPrivate=Boolean(payload.isPrivate),password=String(payload.password||''),mode=normalizeRoomMode(payload.mode);
  if(isPrivate&&(password.length<4||password.length>64))return socket.emit('room-created',{ok:false,message:'A senha da sala privada deve ter entre 4 e 64 caracteres.'});
  if(rooms.size>=60)return socket.emit('room-created',{ok:false,message:'O servidor atingiu o limite temporário de salas. Tente entrar em uma sala existente.'});
  const passwordSalt=isPrivate?crypto.randomBytes(16).toString('hex'):null;
  const passwordHash=isPrivate?await hashPassword(password,passwordSalt):null;
  if(isPrivate&&!passwordHash)return socket.emit('room-created',{ok:false,message:'Não foi possível proteger a sala agora. Tente novamente.'});
  const id=randomRoomId(),room=makeRoom({id,name,isPrivate,passwordSalt,passwordHash,capacity,mode});rooms.set(id,room);
  if(room.cleanupTimer){clearTimeout(room.cleanupTimer);room.cleanupTimer=null;}
  scheduleUnjoinedRoomExpiry(room,30000);
  socket.emit('room-created',{ok:true,room:publicRoomInfo(room),message:`Sala criada. Código para convite: ${id}`});broadcastRooms();io.to(socket.id).emit('rooms-list',await roomListForClients());
 });
 socket.on('join-room', async (payload,acknowledge) => {
  const ack=data=>{if(typeof acknowledge==='function')try{acknowledge(data)}catch{}};
  if(!socket.data.nickname||!socket.data.userKey)return socket.emit('room-join-result',{ok:false,message:'Entre na sua conta antes de entrar em uma sala.'});
  payload=payload&&typeof payload==='object'?payload:{};
  const id=String(payload.roomId||DEFAULT_ROOM_ID).trim().toUpperCase();
  let u=users[socket.data.userKey];
  // A normal join must never load the entire persisted accounts JSONB.
  // Only a deploy reconnect needs to recover a pending session from storage.
  if(payload.reconnect===true&&!u?.pendingRunResume)u=await refreshDeployResumeFromPersistence(socket.data.userKey);
  const room=rooms.get(id)||restoreDeployRoom(u,id);
  if(!room){let remote=false;if(pgPool&&roomRegistryReady){try{const q=await pgPool.query('SELECT 1 FROM abyssal_rooms WHERE room_id=$1 AND lease_until>NOW() AND owner_instance<>$2 AND player_count>0',[id,SERVER_INSTANCE_ID]);remote=q.rowCount>0;}catch{}}return socket.emit('room-join-result',{ok:false,message:remote?'Esta sala pertence a outra instância do servidor e não pode ser acessada por este processo.':'Sala não encontrada ou expirada. Atualize a lista de expedições.'});}
  if(room.isPrivate){const candidate=await hashPassword(String(payload.password||''),room.passwordSalt);if(!candidate||!safeEqual(candidate,room.passwordHash))return socket.emit('room-join-result',{ok:false,message:'Senha incorreta para esta sala privada.'});}
  const existingRoom=socketRoom(socket);
  if(existingRoom&&existingRoom.id===room.id){const existingPlayer=room.players.get(socket.id);const joined={ok:true,room:publicRoomInfo(room),spawn:existingPlayer?{x:existingPlayer.x,y:existingPlayer.y}:null,resumedRun:false,players:[...room.players.values()].filter(x=>x.id!==socket.id).map(({userKey,runStats,...x})=>x),snapshot:getRoomSnapshot(room)};socket.emit('room-joined',joined);ack({ok:true,deliveredBy:'room-joined'});return;}
  if(!room.players.has(socket.id)&&room.players.size>=room.capacity)return socket.emit('room-join-result',{ok:false,message:'Esta sala está cheia.'});
  if(existingRoom)removeFromRoom(socket,{announce:true,emitResult:false});
  if(room.emptyRoomTimer){clearTimeout(room.emptyRoomTimer);room.emptyRoomTimer=null;}
  if(room.cleanupTimer){clearTimeout(room.cleanupTimer);room.cleanupTimer=null;}
  // A room's shared world survives defeats and re-entry. It is cleared only when the
  // last socket leaves the room (removeFromRoom), not when everyone is temporarily dead.
  ensureWorld(room);
  socket.data.joined=true;socket.data.roomId=room.id;socket.join(channelFor(room));
  const maxHp=100+Math.max(0,Math.min(3,Math.floor(Number(u?.metaUpgrades?.bulkhead)||0)))*8;
  const equippedSkinId=allowedSkinIds.has(u?.equippedSkin)?u.equippedSkin:'default';
  const initialShieldCharges=Math.max(0,Math.min(3,Math.floor(Number(u?.metaUpgrades?.startShield)||0)));
  const now=Date.now();
  const occupiedSpawnSlots=new Set([...room.players.values()].map(player=>Number(player.spawnSlot)).filter(Number.isInteger));
  let spawnIndex=0;while(occupiedSpawnSlots.has(spawnIndex)&&spawnIndex<room.capacity)spawnIndex++;
  const spawnAngle=(Math.PI*2*spawnIndex)/Math.max(1,room.capacity),spawnRadius=95/WORLD_ZOOM;
  const expeditionSpawn=room.mode==='rift'?AbyssalMap.startSpawn(WorldSimulation.mapLayoutFor(room.world),spawnIndex,room.capacity):null;
  const spawnX=expeditionSpawn?expeditionSpawn.x:clamp(WORLD_WIDTH*.5+Math.cos(spawnAngle)*spawnRadius,80,WORLD_WIDTH-80),spawnY=expeditionSpawn?expeditionSpawn.y:clamp(WORLD_HEIGHT*.5+Math.sin(spawnAngle)*spawnRadius,80,WORLD_HEIGHT-80);
  const hadPendingRun=Boolean(u?.pendingRunResume),resumedRun=takeDeployRun(u,room);if(resumedRun?.roomResume?.world&&room.players.size===0){room.world=JSON.parse(JSON.stringify(resumedRun.roomResume.world));room.world.mode=room.mode==='rift'?'rift':'classic';room.world.lastTick=Date.now();room.world.snapshotTimer=0;room.world.reliableSnapshotTimer=0;room.world.playerSnapshotTimer=0;room.world.orbSnapshotTimer=0;}if(hadPendingRun)saveUsers();const restoredX=resumedRun&&Number.isFinite(Number(resumedRun.resumeX))?clamp(Number(resumedRun.resumeX),80,WORLD_WIDTH-80):spawnX,restoredY=resumedRun&&Number.isFinite(Number(resumedRun.resumeY))?clamp(Number(resumedRun.resumeY),80,roomWorldHeight(room)-80):spawnY,restoredHp=resumedRun&&Number.isFinite(Number(resumedRun.resumeHp))?clamp(Number(resumedRun.resumeHp),1,maxHp):maxHp,restoredShield=resumedRun?Math.max(0,Math.min(3,Math.floor(Number(resumedRun.resumeShieldCharges)||0))):initialShieldCharges;
  const specimenPoints=SpecimenSystem.pointsFor(u?.specimenProficiency,equippedSkinId),p={id:socket.id,netId:(room.nextPlayerNetId=(Number(room.nextPlayerNetId)||0)+1)>>>0,nickname:socket.data.nickname,userKey:socket.data.userKey,spawnSlot:spawnIndex,x:restoredX,y:restoredY,r:13/WORLD_ZOOM,angle:0,hp:restoredHp,maxHp,alive:true,shieldCharges:restoredShield,initialShieldCharges,regenLevel:0,magnetStrength:1,rangeStrength:1,arcChainActive:false,regenAccumulator:0,invulnerableUntil:now+5000,joinedAt:now,tutorialActive:false,tutorialOpenUsed:false,skillSelectingUntil:0,lastDamageAt:0,positionUpdates:0,lastPositionAt:now,velocityX:0,velocityY:0,clientHidden:Boolean(payload.clientHidden),positionResumeGraceUntil:0,viewportWidth:windowWidthSafe(payload.viewportWidth,1200),viewportHeight:windowWidthSafe(payload.viewportHeight,700),worldWidth:WORLD_WIDTH,worldHeight:roomWorldHeight(room),worldZoom:WORLD_ZOOM,color:'#bd91ff',skinId:equippedSkinId,bodyAngle:0,diverGender:u?.diverGender==='female'?'female':'male',speedStrength:1,specimenX:restoredX,specimenY:restoredY-34/WORLD_ZOOM,specimenLastAt:now,specimenPoints,specimenHp:SpecimenSystem.biologicalStats(equippedSkinId).hp,specimenMaxHp:SpecimenSystem.biologicalStats(equippedSkinId).hp,specimenAlive:true,specimenRespawnAt:0,devourerVacuumUntil:0,titleId:u?.equippedTitle||'abyss-drifter',runStats:resumedRun||makeRunStats()};ensureMatchParticipant(room,p);
  // Reconnected players may resume from coordinates saved for a different
  // cave tier or an older collision map. Never enter embedded in a wall.
  if(room.mode==='rift'){
   const layout=WorldSimulation.mapLayoutFor(room.world);
   const padding=Math.max(10,Number(p.r)||13/WORLD_ZOOM);
   if(!AbyssalMap.isWalkable(layout,p.x,p.y,padding+6)){
    const safe=AbyssalMap.startSpawn(layout,spawnIndex,room.capacity);
    p.x=safe.x;p.y=safe.y;p.velocityX=0;p.velocityY=0;
    p.riftCheckpointRoomId='start';
   }
  }
  room.players.set(socket.id,p);ensureWorld(room);
  const joined={ok:true,room:publicRoomInfo(room),spawn:{x:p.x,y:p.y},resumedRun:Boolean(resumedRun),players:[...room.players.values()].filter(x=>x.id!==socket.id).map(({userKey,runStats,...x})=>x),snapshot:getRoomSnapshot(room)};p.lastFullSnapshotAt=now;socket.emit('room-joined',joined);ack({ok:true,deliveredBy:'room-joined'});
  socket.emit('player-vitals',playerVitalsPayload(p,{reason:'spawn',serverTime:now}));
  socket.to(channelFor(room)).emit('player-joined',((({userKey,runStats,...x})=>x)(p)));
  // The initial room-joined payload already contains the full world snapshot.
  // Do not resend it to the newcomer AND broadcast it to every teammate.
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
 const handlePlayerPosition=(payload, acknowledge, compact=false)=>{
  const ack=(data)=>{if(typeof acknowledge==='function')acknowledge(data);if(compact&&data?.blocked){const room=socketRoom(socket),p=room?.players.get(socket.id);if(p)io.to(socket.id).volatile.emit('player-reconcile',NetCodec.reconcile(Number(p.lastPositionSeq)||0,Number(p.x)||0,Number(p.y)||0,true));}};
  if(!socket.data.joined||!payload||typeof payload!=='object')return ack({ok:false,reason:'not-in-room'});
  const room=socketRoom(socket),p=room?.players.get(socket.id);if(!p)return ack({ok:false,reason:'player-not-found'});
  // Once the server has declared a character dead, late/background heartbeat packets
  // must not move it back into the active world. ACK without updating the last position
  // so a throttled browser can harmlessly send until it receives the death event.
  if(p.alive===false)return ack({ok:true,dead:true,seq:p.lastPositionSeq||0,receivedAt:p.lastPositionAt,positionUpdates:p.positionUpdates||0});
  if(Date.now()<(Number(p.skinParalyzedUntil)||0)){socket.emit('player-reconcile',NetCodec.reconcile(Number(p.lastPositionSeq)||0,Number(p.x)||0,Number(p.y)||0,true));return ack({ok:true,blocked:true,reason:'skin-paralyzed',seq:p.lastPositionSeq||0,receivedAt:p.lastPositionAt,positionUpdates:p.positionUpdates||0});}
  const x=Number(payload.x),y=Number(payload.y);if(!Number.isFinite(x)||!Number.isFinite(y))return ack({ok:false,reason:'invalid-coordinates'});
  const incomingSeq=Math.max(0,Math.floor(Number(payload.seq)||0));
  if(incomingSeq>0&&incomingSeq<=(Number(p.lastPositionSeq)||0))return ack({ok:true,duplicate:true,seq:p.lastPositionSeq,receivedAt:p.lastPositionAt,positionUpdates:p.positionUpdates||0});
  const receivedAt=Date.now(),previousAt=Number(p.lastPositionAt)||0,deltaSeconds=(receivedAt-previousAt)/1000;
  const previousX=Number(p.x)||0,previousY=Number(p.y)||0,dx=x-previousX,dy=y-previousY,displacement=Math.hypot(dx,dy);
  // A depth transition teleports everyone by thousands of world units.
  // Discard delayed packets referring to the previous floor, instead of
  // treating them as movement or running collision resolution from the
  // freshly spawned player to their old-floor location.
  if(room.mode==='rift'&&receivedAt<(Number(p.positionResumeGraceUntil)||0)&&displacement>320){
   p.lastPositionSeq=incomingSeq||((Number(p.lastPositionSeq)||0)+1);
   p.lastPositionAt=receivedAt;p.velocityX=0;p.velocityY=0;
   socket.emit('player-reconcile',NetCodec.reconcile(Number(p.lastPositionSeq)||0,previousX,previousY,true));
   return ack({ok:true,blocked:true,reason:'stale-depth-position',seq:p.lastPositionSeq,receivedAt,positionUpdates:p.positionUpdates||0});
  }
  if(room.mode==='pvp'&&(pvpRockAt(x,y,Number(p.r)||13/WORLD_ZOOM)||pvpSegmentHitsRock(previousX,previousY,x,y,Number(p.r)||13/WORLD_ZOOM))){p.velocityX=0;p.velocityY=0;return ack({ok:true,blocked:true,reason:'terrain',seq:p.lastPositionSeq||0,receivedAt:p.lastPositionAt,positionUpdates:p.positionUpdates||0});}
  const skinDashActive=receivedAt<(Number(p.skinDashUntil)||0);
  const movement=skinDashActive?{allowed:displacement<=230/WORLD_ZOOM}:consumeMovementBudget(p,displacement,receivedAt);
  if(!movement.allowed){movementGuardRejects++;p.movementRejects=(Number(p.movementRejects)||0)+1;p.velocityX=0;p.velocityY=0;return ack({ok:true,blocked:true,reason:'movement-envelope',seq:p.lastPositionSeq||0,receivedAt:p.lastPositionAt,positionUpdates:p.positionUpdates||0});}
  let acceptedX=x,acceptedY=y;
  if(room.mode==='rift'){
   const layout=WorldSimulation.mapLayoutFor(room.world),resolved=AbyssalMap.resolveMove(layout,previousX,previousY,x,y,Math.max(10,Number(p.r)||13/WORLD_ZOOM));
   acceptedX=resolved.x;acceptedY=resolved.y;
   if(resolved.blocked&&Math.hypot(acceptedX-x,acceptedY-y)>2){p.velocityX=0;p.velocityY=0;if(compact)io.to(socket.id).volatile.emit('player-reconcile',NetCodec.reconcile(Number(p.lastPositionSeq)||0,acceptedX,acceptedY,true));}
  }
  const acceptedDx=acceptedX-previousX,acceptedDy=acceptedY-previousY,acceptedDisplacement=Math.hypot(acceptedDx,acceptedDy);
  if(acceptedDisplacement>.5){const nextAngle=Math.atan2(acceptedDy,acceptedDx),beforeAngle=Number(p.bodyAngle)||0;const diff=Math.atan2(Math.sin(nextAngle-beforeAngle),Math.cos(nextAngle-beforeAngle));p.bodyAngle=beforeAngle+diff*.55;}
  if(acceptedDisplacement<0.5){p.velocityX=0;p.velocityY=0;}
  else if(deltaSeconds>=0.015&&deltaSeconds<=0.3){let vx=acceptedDx/deltaSeconds,vy=acceptedDy/deltaSeconds,speed=Math.hypot(vx,vy);if(speed>900){vx=vx/speed*900;vy=vy/speed*900;}p.velocityX=vx;p.velocityY=vy;}
  else {p.velocityX=0;p.velocityY=0;}
  const activeWorldHeight=roomWorldHeight(room);p.x=clamp(acceptedX,8/WORLD_ZOOM,WORLD_WIDTH-8/WORLD_ZOOM);p.y=clamp(acceptedY,8/WORLD_ZOOM,activeWorldHeight-8/WORLD_ZOOM);p.positionUpdates=(p.positionUpdates||0)+1;p.lastPositionAt=receivedAt;if(receivedAt>=(Number(p.positionResumeGraceUntil)||0))p.positionResumeGraceUntil=0;if(typeof payload.clientHidden==='boolean')p.clientHidden=payload.clientHidden;if(p.clientHidden){p.velocityX=0;p.velocityY=0;}p.lastPositionSeq=incomingSeq||((Number(p.lastPositionSeq)||0)+1);
  // PvP pickup uses only the accepted authoritative position. Rejected teleports can never claim an orb.
  
  p.angle=Math.max(-Math.PI*2,Math.min(Math.PI*2,Number(payload.angle)||0));
  p.worldWidth=WORLD_WIDTH;p.worldHeight=activeWorldHeight;p.clientMotionAt=Date.now();
  if(!compact){
   p.viewportWidth=windowWidthSafe(payload.viewportWidth,p.viewportWidth||1200);p.viewportHeight=windowWidthSafe(payload.viewportHeight,p.viewportHeight||700);p.worldZoom=clamp(Number(payload.worldZoom)||p.worldZoom||WORLD_ZOOM,.35,1.2);
   p.clientEnemyCount=Math.max(0,Math.min(MAX_ENEMIES_PER_ROOM,Math.floor(Number(payload.clientEnemyCount)||0)));p.clientMovingEnemies=Math.max(0,Math.min(MAX_ENEMIES_PER_ROOM,Math.floor(Number(payload.clientMovingEnemies)||0)));
   p.clientPredicting=Boolean(payload.clientPredicting);p.clientGameState=String(payload.clientGameState||'unknown').slice(0,24);
   const color=String(payload.color||p.color||'#bd91ff');p.color=/^#[0-9a-fA-F]{6}$/.test(color)?color:(p.color||'#bd91ff');
  }
  const account=users[socket.data.userKey],skinId=String(account?.equippedSkin||'default');
  p.skinId=allowedSkinIds.has(skinId)&&((account?.ownedSkins||['default']).includes(skinId))?skinId:'default';
  // Relay live player transforms independently of world-enemy snapshots. Throttle per room
  // so all clients see movement/skins without flooding Socket.IO with every heartbeat.
  const playerMotionIntervalMs=1000/30;
  if(receivedAt-(Number(room.lastPlayersBroadcastAt)||0)>=playerMotionIntervalMs){
   room.lastPlayersBroadcastAt=receivedAt;
   const motion=getRoomPlayerMotion(room);
   if(motion.length>1)io.to(channelFor(room)).volatile.emit('player-motion',NetCodec.playerMotion(motion,receivedAt));
  }
  if(compact){
   // Reconcile at 5 Hz, not every transform. Client movement remains immediate while
   // authoritative rock/bounds corrections arrive often enough to stay visually tight.
   if(receivedAt-(Number(p.lastReconcileAt)||0)>=200){p.lastReconcileAt=receivedAt;io.to(socket.id).volatile.emit('player-reconcile',NetCodec.reconcile(p.lastPositionSeq,p.x,p.y,false));}
  }else ack({ok:true,seq:p.lastPositionSeq,receivedAt:p.lastPositionAt,positionUpdates:p.positionUpdates});
 };
 socket.on('player-position',(payload,acknowledge)=>{if(socketRoom(socket)?.players.get(socket.id)?.tutorialActive)return;handlePlayerPosition(payload,acknowledge,false);});
 socket.on('player-motion-input',row=>{
  if(socketRoom(socket)?.players.get(socket.id)?.tutorialActive)return;
  const decoded=NetCodec.readInput(row);if(decoded)return handlePlayerPosition(decoded,null,true);
  if(!Array.isArray(row)||row.length<4)return;
  handlePlayerPosition({seq:Number(row[0]),x:Number(row[1]),y:Number(row[2]),angle:Number(row[3])},null,true);
 });
 socket.on('map-transition',(payload={},acknowledge)=>{
  const reply=data=>{if(typeof acknowledge==='function')try{acknowledge(data)}catch{};socket.emit('map-transition-result',data);};
  const room=socketRoom(socket),p=room?.players.get(socket.id);
  if(!room||room.mode!=='rift'||!p||p.alive===false)return reply({ok:false,reason:'unavailable'});
  const kind=String(payload?.kind||''),layout=WorldSimulation.mapLayoutFor(room.world),now=Date.now();
  if(!layout||!['descent','ascend','next-tier'].includes(kind))return reply({ok:false,reason:'invalid-transition'});
  if(now-(Number(p.lastMapTransitionAt)||0)<850)return reply({ok:false,reason:'cooldown'});
  if(kind==='next-tier'){
   const w=room.world,source=layout.portals.boss,requesterRadius=Number(source?.r||110)+(Number(p.r)||13/WORLD_ZOOM)+38/WORLD_ZOOM;
   if(!source||Math.hypot(Number(p.x)-source.x,Number(p.y)-source.y)>requesterRadius)return reply({ok:false,reason:'too-far'});
   if(Number(w.mapTier)>=RiftHardcore.FINAL_TIER)return reply({ok:false,reason:'final-depth'});
   if(w.enemies.some(enemy=>BOSS_KINDS.has(enemy.kind)))return reply({ok:false,reason:'boss-alive'});
   const currentTier=Math.max(0,Math.floor(Number(w.mapTier)||0));
   if(Math.max(0,Math.floor(Number(w.bossesDefeated)||0))<=currentTier)return reply({ok:false,reason:'boss-not-cleared'});
   // The portal moves the entire cooperative party together. Previously
   // EVERY player had to overlap the small portal, so one blocked teammate
   // prevented the entire group from descending.
   const party=livingPlayers(room);
   if(!party.length)return reply({ok:false,reason:'no-active-players'});
   w.mapTier=currentTier+1;w.enemies=[];w.orbs=[];w.nextOrbId=0;w.commonSpawnTimer=Infinity;w.nextBossAt=Infinity;w.riftEncountersSeeded=false;w.riftActivatedRooms={};
   w.snapshotTimer=0;w.reliableSnapshotTimer=0;w.sideEncounterId=null;
   const nextLayout=WorldSimulation.mapLayoutFor(w),descriptor={version:AbyssalMap.VERSION,seed:Number(w.mapSeed)||0,tier:w.mapTier};
   // Every player belongs to the new world tier, including defeated peers.
   // They remain defeated until revived, but their future respawn must not
   // retain coordinates from a cave that no longer exists.
   const travellers=[...room.players.values()];
   travellers.forEach((peer,index)=>{
    const spawn=AbyssalMap.startSpawn(nextLayout,index,travellers.length);
    peer.x=spawn.x;peer.y=spawn.y;peer.velocityX=0;peer.velocityY=0;peer.positionResumeGraceUntil=now+1800;peer.lastPositionAt=now;peer.lastMapTransitionAt=now;peer.movementBudget=DEFAULT_CAPACITY;peer.movementBudgetAt=now;peer.riftCheckpointRoomId='start';
    io.to(peer.id).emit('map-transition-result',{ok:true,kind:'next-tier',x:peer.x,y:peer.y,map:descriptor,tier:w.mapTier,serverTime:now});
   });
   io.to(channelFor(room)).emit('world-players',[...room.players.values()].map(({userKey,runStats,...peer})=>peer));
   io.to(channelFor(room)).emit('world-depth-state',worldDepthState(w));broadcastWorld(room,{criticalReason:'map-tier-transition'});
   if(typeof acknowledge==='function')try{acknowledge({ok:true,kind:'next-tier',x:p.x,y:p.y,map:descriptor,tier:w.mapTier,serverTime:now});}catch{}
   return;
  }
  const source=kind==='descent'?layout.portals.descent:layout.portals.landing;
  const target=kind==='descent'?{x:Number(layout.portals.descent.targetX),y:Number(layout.portals.descent.targetY)}:{x:Number(layout.portals.landing.targetX),y:Number(layout.portals.landing.targetY)};
  const proximity=Math.hypot(Number(p.x)-source.x,Number(p.y)-source.y),allowedRadius=Number(source.r)+(Number(p.r)||13/WORLD_ZOOM)+38/WORLD_ZOOM;
  if(!Number.isFinite(proximity)||proximity>allowedRadius)return reply({ok:false,reason:'too-far'});
  if(!AbyssalMap.isWalkable(layout,target.x,target.y,Math.max(10,Number(p.r)||13/WORLD_ZOOM)))return reply({ok:false,reason:'invalid-destination'});
  p.x=target.x;p.y=target.y;p.velocityX=0;p.velocityY=0;p.positionResumeGraceUntil=now+120;p.lastPositionAt=now;p.lastMapTransitionAt=now;p.movementBudget=DEFAULT_CAPACITY;p.movementBudgetAt=now;
  const result={ok:true,kind,x:p.x,y:p.y,serverTime:now};
  io.to(socket.id).emit('player-reconcile',NetCodec.reconcile(Number(p.lastPositionSeq)||0,p.x,p.y,true));
  io.to(channelFor(room)).emit('world-players',[...room.players.values()].map(({userKey,runStats,...peer})=>peer));reply(result);
 });
 socket.on('player-net-meta',meta=>{
  const room=socketRoom(socket),p=room?.players.get(socket.id);if(!room||!p||!meta||typeof meta!=='object')return;
  p.viewportWidth=windowWidthSafe(meta.viewportWidth,p.viewportWidth||1200);p.viewportHeight=windowWidthSafe(meta.viewportHeight,p.viewportHeight||700);p.worldZoom=clamp(Number(meta.worldZoom)||p.worldZoom||WORLD_ZOOM,.35,1.2);
  p.clientEnemyCount=Math.max(0,Math.min(MAX_ENEMIES_PER_ROOM,Math.floor(Number(meta.clientEnemyCount)||0)));p.clientMovingEnemies=Math.max(0,Math.min(MAX_ENEMIES_PER_ROOM,Math.floor(Number(meta.clientMovingEnemies)||0)));
  p.clientPredicting=Boolean(meta.clientPredicting);p.clientGameState=String(meta.clientGameState||'unknown').slice(0,24);p.clientHidden=Boolean(meta.clientHidden);p.clientMotionAt=Date.now();
 });
 socket.on('player-build', payload => {
  const room = socketRoom(socket), p = room?.players.get(socket.id);
  if (!p || p.alive === false || !payload || typeof payload !== 'object') return;
  // Only gameplay inputs are accepted; HP/max HP remain server-authoritative.
  p.shieldCharges = clamp(Math.floor(Number(payload.shieldCharges) || 0), 0, 3);
  p.regenLevel = clamp(Math.floor(Number(payload.regenLevel) || 0), 0, 3);
  p.magnetStrength = clamp(Number(payload.magnetStrength) || 1, 1, 1.26);
  p.rangeStrength = clamp(Number(payload.rangeStrength) || 1, 1, Math.pow(1.22, 3));
  p.speedStrength=clamp(Number(payload.speedStrength)||1,1,4);
  p.arcChainActive = payload.arcChainActive === true;
  p.hadalBeamActive = payload.hadalBeamActive === true;
  p.ricochetLevel = clamp(Math.floor(Number(payload.ricochetLevel) || 0), 0, 3);
  p.prismaticLevel = clamp(Math.floor(Number(payload.prismaticLevel) || 0), 0, 3);
  p.predatorLevel = clamp(Math.floor(Number(payload.predatorLevel) || 0), 0, 3);
  p.electricLevel = clamp(Math.floor(Number(payload.electricLevel) || 0), 0, 3);
  p.shellLevel = clamp(Math.floor(Number(payload.shellLevel) || 0), 0, 3);
  p.lastStandLevel = clamp(Math.floor(Number(payload.lastStandLevel) || 0), 0, 3);
 });
 socket.on('tutorial-preference',payload=>{
  const u=users[socket.data.userKey],mode=String(payload?.mode||'');
  if(!u||!['solo','coop','pvp','rift','rift-solo'].includes(mode)||payload?.dismissed!==true)return;
  u.tutorialDismissedModes=Array.isArray(u.tutorialDismissedModes)?u.tutorialDismissedModes:[];
  if(!u.tutorialDismissedModes.includes(mode)){u.tutorialDismissedModes.push(mode);saveUsers();}
  socket.emit('account-data',publicUser(u));
 });
 socket.on('specimen-discovered',(payload={})=>{
  const room=socketRoom(socket),player=room?.players.get(socket.id);
  if(!room||room.mode!=='rift'||!player||player.alive===false)return;
  const id=String(payload.id||'').slice(0,64);
  if(!id||!SpecimenRarity.rarityFor(id))return;
  const layout=WorldSimulation.mapLayoutFor(room.world);
  const visible=(room.world?.enemies||[]).some(e=>e?.specimenSkinId===id&&Number(e.hp)>0
   &&Math.hypot(Number(e.x)-player.x,Number(e.y)-player.y)<480/WORLD_ZOOM
   &&(!layout||AbyssalMap.segmentWalkable(layout,player.x,player.y,e.x,e.y,3/WORLD_ZOOM)));
  if(!visible)return;
  const user=users[socket.data.userKey];if(!user)return;
  user.discoveredSpecimens=Array.isArray(user.discoveredSpecimens)?user.discoveredSpecimens:[];
  if(user.discoveredSpecimens.includes(id))return;
  user.discoveredSpecimens.push(id);
  scheduleTitleStatsSave();
  socket.emit('specimen-discovered',{id});
 });
 socket.on('tutorial-state',payload=>{
  const room=socketRoom(socket),p=room?.players.get(socket.id);
  if(!p||p.alive===false||!payload||typeof payload!=='object')return;
  const now=Date.now();
  if(payload.open===true){
   if(p.tutorialOpenUsed||now-(Number(p.joinedAt)||now)>15000)return;
   p.tutorialOpenUsed=true;p.tutorialActive=true;
   p.tutorialPreviousProtection=Number(p.invulnerableUntil)||0;
   p.invulnerableUntil=Number.MAX_SAFE_INTEGER;
  }else if(p.tutorialActive){
   p.tutorialActive=false;
   p.invulnerableUntil=Math.max(now+2000,Math.min(Number(p.tutorialPreviousProtection)||0,now+5000));
  }
 });
 socket.on('claim-first-progression',async(payload={},ack)=>{
  const reply=data=>{if(typeof ack==='function')ack(data);};
  const user=users[socket.data.userKey],run=socket.data.runStats;
  if(!user||!run||run.settled||socketRoom(socket)||run.mode!=='solo')return reply({ok:false,message:'Bônus disponível apenas após a campanha Solo clássica.'});
  if(user.firstProgressionRewardClaimed)return reply({ok:true,awarded:false,alreadyClaimed:true,account:publicUser(user)});
  if((Number(run.bossesKilled)||0)<7||Date.now()-(Number(run.startedAt)||Date.now())<120000)return reply({ok:false,message:'A primeira barra ainda não foi validada pelo servidor.'});
  if(!grantFirstProgressionReward(user))return reply({ok:true,awarded:false,alreadyClaimed:true,account:publicUser(user)});
  saveUsers();await flushPersistence();
  const account=publicUser(user);socket.emit('account-data',account);
  reply({ok:true,awarded:true,amount:FIRST_PROGRESSION_REWARD_COINS,account});
 });
 socket.on('player-protection', payload => {
  const room = socketRoom(socket), p = room?.players.get(socket.id), u = users[socket.data.userKey];
  if (!p || p.alive === false || !payload || typeof payload !== 'object') return;
  const seconds = Number(payload.seconds), reason = String(payload.reason || '');
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 25) return;
  const now = Date.now();
  if (reason === 'upgrade-offer') {
   const run=ensureRunProgression(p.runStats);
   if (seconds !== 25 || (Number(p.upgradeProtectionUntil) || 0) > now || !run || run.pendingUpgradeCredits<=0) return;
   run.pendingUpgradeCredits--;
   p.skillSelectingUntil = now + 25000;
   p.upgradeProtectionUntil = now + 25000;
   p.invulnerableUntil = Math.max(Number(p.invulnerableUntil) || 0, p.upgradeProtectionUntil);
   return;
  }
  if (reason === 'upgrade-selected') {
   if (seconds !== 3 || (Number(p.upgradeProtectionUntil) || 0) <= 0 || now > (Number(p.upgradeProtectionUntil) || 0) + 1000) return;
   p.upgradeProtectionUntil = 0;
   p.skillSelectingUntil = 0;
   p.invulnerableUntil = now + 3000;
   return;
  }
  if (reason === 'dash') {
   if (seconds !== 1.5 || !(Number(u?.metaUpgrades?.dash)>0) || now - (Number(p.lastDashProtectionAt) || 0) < 15000) return;
   p.lastDashProtectionAt = now;
   p.invulnerableUntil = Math.max(Number(p.invulnerableUntil) || 0, now + 1500);
   return;
  }
  // No generic protection channel: join/reconnect protection is created by the server
  // when the room member is instantiated, and unknown client reasons are ignored.
 });
 socket.on('request-player-state', () => {
  const room = socketRoom(socket), p = room?.players.get(socket.id);
  if (!p) return;
  socket.emit('player-vitals', playerVitalsPayload(p, { reason: 'resync', serverTime: Date.now() }));
 });
 socket.on('player-hit', payload => {const room=socketRoom(socket);if(!room||!payload||room.players.get(socket.id)?.tutorialActive)return;const x=Number(payload.x),y=Number(payload.y),damage=Number(payload.damage);if(![x,y,damage].every(Number.isFinite)||x<0||x>1||y<0||y>1||damage<0||damage>1000)return;socket.to(channelFor(room)).emit('remote-hit',{x,y,damage,from:socket.data.nickname});});
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
 socket.on('begin-run',(payload={})=>{
  if(!socket.data.userKey)return;
  const room=socketRoom(socket),p=room?.players.get(socket.id);
  if(p){
   if(!p.runStats||p.runStats.settled){p.runStats=makeRunStats();p.runLevel=1;p.energy=0;}
   if(p.alive===false){p.alive=true;p.hp=p.maxHp;p.shieldCharges=p.initialShieldCharges||0;p.invulnerableUntil=Date.now()+5000;p.skillSelectingUntil=0;p.regenAccumulator=0;}
   ensureWorld(room);
   socket.emit('player-vitals',playerVitalsPayload(p,{reason:'run-start',serverTime:Date.now()}));
   // The initial join already delivered the world. A later begin-run
   // still supports explicit resync without flooding all room members.
   if(Date.now()-(Number(p.lastFullSnapshotAt)||0)>1200){
    socket.emit('game-snapshot',getRoomSnapshot(room,{criticalReason:'resume-resync'}));
    p.lastFullSnapshotAt=Date.now();
   }
   refreshWorldTicker();
  } else socket.data.runStats={...makeRunStats(),mode:payload.mode==='rift'?'rift':'solo'};
 });
 socket.on('run-progress',payload=>{if(!socket.data.userKey||!payload||typeof payload!=='object')return;const room=socketRoom(socket),p=room?.players.get(socket.id),run=p?.runStats||socket.data.runStats;if(!run||run.settled)return;run.score=Math.max(0,Math.min(1e9,Number(payload.score)||0));const previousLevel=Math.max(1,Math.floor(Number(p?.runLevel)||Number(run.level)||1));run.level=Math.max(1,Math.min(9999,Math.floor(Number(payload.level)||1)));if(p){const account=users[socket.data.userKey];if(run.level>previousLevel&&p.alive!==false){p.hp=p.maxHp;socket.emit('player-vitals',playerVitalsPayload(p,{reason:'level-up',serverTime:Date.now()}));}p.energy=run.score;p.runLevel=run.level;p.runNickname=account?.nickname||p.nickname;const ranking=[...room.players.values()].filter(peer=>peer.alive!==false).map(peer=>({id:peer.id,nickname:peer.runNickname||peer.nickname||'Mergulhador',energy:Math.max(0,Number(peer.energy)||0)})).sort((a,b)=>b.energy-a.energy||a.nickname.localeCompare(b.nickname)).slice(0,6).map((peer,index)=>({...peer,rank:index+1}));io.to(channelFor(room)).volatile.emit('run-energy-ranking',ranking);}else run.bossesKilled=Math.max(0,Math.min(10000,Math.floor(Number(payload.bossesKilled)||0)));});
 socket.on('get-match-history',()=>{const u=users[socket.data.userKey];socket.emit('match-history-result',{ok:Boolean(u),matches:Array.isArray(u?.matchHistory)?u.matchHistory.slice(0,10):[]});});
 socket.on('finish-run',async(payload={},ack)=>{try{const result=await finishRunForSocket(socket,payload);if(typeof ack==='function')ack(result);}catch(err){console.error('[run] Falha ao finalizar mergulho:',err.message);if(typeof ack==='function')ack({ok:false,message:'Não foi possível gravar o resultado do mergulho.'});}});
 socket.on('game-snapshot', () => {}); // Clientes nunca publicam o estado autoritativo.
 socket.on('request-host-state', () => {});
 socket.on('request-host-transfer', () => {});
 socket.on('photon-ray-stop',()=>{const room=socketRoom(socket),player=room?.players.get(socket.id);if(room&&player&&player.alive!==false)socket.to(channelFor(room)).emit('photon-ray-stop',{fromId:socket.id});});
 socket.on('shared-shot', payload => {
  const room=socketRoom(socket),shooter=room?.players.get(socket.id);if(!room||!shooter||!payload||shooter.alive===false||shooter.tutorialActive)return;
  const x=Number(payload.x),y=Number(payload.y),vx=Number(payload.vx),vy=Number(payload.vy);
  const shotWorldHeight=roomWorldHeight(room);
  if(![x,y,vx,vy].every(Number.isFinite)||x<0||x>1||y<0||y>1||Math.abs(vx)>1500||Math.abs(vy)>1500)return;
  const now=Date.now(),volleyId=String(payload.volleyId||'').slice(0,64);
   const sameVolley=Boolean(volleyId&&volleyId===shooter.lastShotVolleyId&&now-(Number(shooter.lastShotAt)||0)<90);
   if(!sameVolley&&now-(Number(shooter.lastShotAt)||0)<90)return;
   if(sameVolley){const volleyPackets=(Number(shooter.lastShotVolleyPackets)||1)+1;if(volleyPackets>12)return;shooter.lastShotVolleyPackets=volleyPackets;}
   else{shooter.lastShotAt=now;shooter.lastShotVolleyId=volleyId||null;shooter.lastShotVolleyPackets=1;shooter.lastShotVolleyTargets=new Set();}
  const shot={x,y,vx,vy,combined:payload.combined===true,actionId:String(payload.actionId||payload.volleyId||'').slice(0,72),color:payload.special==='photonRay'?PhotonRay.color:/^#[0-9a-fA-F]{6}$/.test(String(payload.color))?payload.color:'#9bbcff',damage:Math.max(0,Math.min(1000,Number(payload.damage)||0)),special:['pierce','electric','spread','photon','photonRay','nova','echoShot','prismShard'].includes(payload.special)?payload.special:null,modifiers:{abyssEye:Boolean(payload.modifiers?.abyssEye),ricochet:Math.max(0,Math.min(3,Math.trunc(Number(payload.modifiers?.ricochet)||0)))},from:socket.data.nickname,fromId:socket.id,at:now};
  if(shot.special==='nova'&&room.mode!=='pvp'){
   if(now<(Number(shooter.novaShotReadyAt)||0))return;
   const dx=vx*WORLD_WIDTH,dy=vy*shotWorldHeight,speed=Math.hypot(dx,dy);
   if(speed<30||speed>1800||Math.hypot(x*WORLD_WIDTH-shooter.x,y*shotWorldHeight-shooter.y)>95/WORLD_ZOOM)return;
   const heading=Math.atan2(dy,dx);
   const muzzle=DiverArt.muzzle(shooter.x,shooter.y,shooter.r,heading);
   const range=294*clamp(Number(shooter.rangeStrength)||1,1,Math.pow(1.22,3))*
    SkinAbilities.targetRangeMultiplier(shooter.skinId,shooter.specimenPoints,shooter.specimenAlive!==false)/WORLD_ZOOM;
   shooter.novaShotReadyAt=now+1800;
   shooter.novaConeAngle=heading;shooter.novaConeUntil=now+320;shooter.novaConeOrigin=muzzle;
   shooter.lastNovaVolleyId=volleyId;
   shooter.novaShardExpiresAt=now+600;
   shooter.novaShardCount=0;
   shooter.novaReferenceDamage=Math.min(45,Math.max(1,shot.damage));
   shot.x=muzzle.x/WORLD_WIDTH;shot.y=muzzle.y/shotWorldHeight;shot.effectRadius=range;
   const layout=room.mode==='rift'?WorldSimulation.mapLayoutFor(room.world):null;
   for(const enemy of [...(room.world?.enemies||[])]){
    if(Number(enemy.hp)<=0||!GravityCone.contains(muzzle.x,muzzle.y,heading,enemy.x,enemy.y,enemy.r,range))continue;
    if(layout&&AbyssalMap.segmentWalkable&&!AbyssalMap.segmentWalkable(layout,muzzle.x,muzzle.y,enemy.x,enemy.y,Math.min(7,Number(enemy.r)||5)))continue;
    processWorldDamage(socket,Number(enemy.id),Math.min(45,Math.max(1,shot.damage)),'nova',null,shot.actionId);
   }
  }
  if(shot.special==='prismShard'){
   const rank=clamp(Math.floor(Number(shooter.prismaticLevel)||0),0,3),maxShards=2*rank;
   // Each fragment must belong to a recently accepted Nova pulse. This also
   // prevents forging arbitrary high-damage shards or extra projectiles.
   if(!maxShards||!volleyId||volleyId!==shooter.lastNovaVolleyId||
      now>(Number(shooter.novaShardExpiresAt)||0)||
      (Number(shooter.novaShardCount)||0)>=maxShards)return;
   if(Number.isFinite(Number(shooter.novaConeAngle))){
    const heading=Math.atan2(vy*shotWorldHeight,vx*WORLD_WIDTH);
    const difference=Math.atan2(Math.sin(heading-shooter.novaConeAngle),Math.cos(heading-shooter.novaConeAngle));
    if(Math.abs(difference)>.45)return;
   }
   shooter.novaShardCount=(Number(shooter.novaShardCount)||0)+1;
   shot.damage=Math.min(shot.damage,Math.max(1,Number(shooter.novaReferenceDamage)||1)*.28/maxShards);
  }
  if(shot.special==='photonRay'){if(now<(Number(shooter.photonShotReadyAt)||0))return;shooter.photonShotReadyAt=now+190;shot.beamLevel=Math.max(1,Math.min(PhotonRay.maxLevel,Math.trunc(Number(payload.beamLevel)||1)));shot.hadalBeamActive=shooter.hadalBeamActive===true;}
  if(shot.special==='photonRay'&&payload.beamTargetId!=null){
   const targetId=String(payload.beamTargetId).slice(0,64),target=room.mode==='pvp'?room.players.get(targetId):room.world?.enemies?.find(e=>String(e.id)===targetId&&Number(e.hp)>0);
   const targetRange=294*clamp(Number(shooter.rangeStrength)||1,1,Math.pow(1.22,3))*SkinAbilities.targetRangeMultiplier(shooter.skinId,shooter.specimenPoints,shooter.specimenAlive!==false)/WORLD_ZOOM;
   if(target&&target.alive!==false&&target.id!==socket.id&&Math.hypot(Number(target.x)-shooter.x,Number(target.y)-shooter.y)<=targetRange+20/WORLD_ZOOM)shot.beamTargetId=targetId;
  }
  if(shot.special==='photonRay'&&room.mode!=='pvp'){
   const endX=Number(payload.beamEndX),endY=Number(payload.beamEndY);
   const range=294*clamp(Number(shooter.rangeStrength)||1,1,Math.pow(1.22,3))*SkinAbilities.targetRangeMultiplier(shooter.skinId,shooter.specimenPoints,shooter.specimenAlive!==false)/WORLD_ZOOM;
   if(Number.isFinite(endX)&&Number.isFinite(endY)&&endX>=0&&endX<=1&&endY>=0&&endY<=1&&Math.hypot((endX-x)*WORLD_WIDTH,(endY-y)*shotWorldHeight)<=range+8/WORLD_ZOOM){shot.beamEndX=endX;shot.beamEndY=endY;}
  }
  if(shot.special==='photonRay'){
   const dx=vx*WORLD_WIDTH,dy=vy*shotWorldHeight,speed=Math.hypot(dx,dy);
   const gunDistance=(Number(shooter.r)||13/WORLD_ZOOM)*DiverArt.DRAW_SCALE*DiverArt.BARREL_TIP_X/14;
   const uxMuzzle=speed>0?dx/speed:1,uyMuzzle=speed>0?dy/speed:0;
   const below=(Number(shooter.r)||13/WORLD_ZOOM)*DiverArt.DRAW_SCALE*DiverArt.GUN_OFFSET_Y/14;
   const sx=Number(shooter.x)+uxMuzzle*gunDistance-uyMuzzle*below;
   const sy=Number(shooter.y)+uyMuzzle*gunDistance+uxMuzzle*below;
   if(!Number.isFinite(sx)||!Number.isFinite(sy)||speed<30||speed>1800)return;
   const rangeStrength=clamp(Number(shooter.rangeStrength)||1,1,Math.pow(1.22,3));
   const beamRange=294*rangeStrength*SkinAbilities.targetRangeMultiplier(shooter.skinId,shooter.specimenPoints,shooter.specimenAlive!==false)/WORLD_ZOOM;
   let ux=dx/speed,uy=dy/speed;
   const manualAim=payload.manualAim===true;
   if(!manualAim&&shot.beamTargetId){
    const lockedTarget=room.mode==='pvp'?room.players.get(shot.beamTargetId):room.world?.enemies?.find(enemy=>String(enemy.id)===shot.beamTargetId&&Number(enemy.hp)>0);
    if(lockedTarget&&lockedTarget.alive!==false&&lockedTarget.id!==socket.id){
     const lockDx=Number(lockedTarget.x)-sx,lockDy=Number(lockedTarget.y)-sy,lockDistance=Math.hypot(lockDx,lockDy);
     if(Number.isFinite(lockDistance)&&lockDistance>0&&lockDistance<=beamRange+20/WORLD_ZOOM){ux=lockDx/lockDistance;uy=lockDy/lockDistance;}
    }
   }
   // The beam endpoint is range-authoritative, never target-authoritative.
   // Auto aim chooses direction on the client, but a nearby/moving target must not shorten
   // the ray. Damage is evaluated against this full segment using authoritative positions.
   let length=beamRange;
   if(room.mode==='pvp'){
    // The same wall clipping applies to the actual hit segment and its visual endpoint.
    for(let distance=0;distance<=length;distance+=4/WORLD_ZOOM){
     if(pvpRockAt(sx+ux*distance,sy+uy*distance,4/WORLD_ZOOM)){length=Math.max(0,distance-4/WORLD_ZOOM);break;}
    }
   }
   if(room.mode==='rift'){
      const layout=WorldSimulation.mapLayoutFor(room.world);
      for(let distance=0;distance<=length;distance+=6/WORLD_ZOOM){
        if(!AbyssalMap.isWalkable(layout,sx+ux*distance,sy+uy*distance,4/WORLD_ZOOM)){
          length=Math.max(0,distance-6/WORLD_ZOOM);break;
        }
      }
    }
    const ex=sx+ux*length,ey=sy+uy*length;
   shot.x=sx/WORLD_WIDTH;shot.y=sy/shotWorldHeight;shot.effectRadius=length;
   shot.beamEndX=clamp(ex/WORLD_WIDTH,0,1);shot.beamEndY=clamp(ey/shotWorldHeight,0,1);
   // A single authoritative photon command resolves all Prism side rays.
   // Clients cannot supply extra beam endpoints or bypass the 190 ms cadence.
   const prismRank=clamp(Math.floor(Number(shooter.prismaticLevel)||0),0,3);
   const secondarySegments=[];
   for(let i=0;i<prismRank*2;i++){
    const angle=Math.atan2(uy,ux)+(i%2===0?-1:1)*(.12+.075*Math.floor(i/2));
    const dx=Math.cos(angle),dy=Math.sin(angle);
    let sideLength=beamRange;
    if(room.mode==='pvp'){
     for(let d=0;d<=beamRange;d+=4/WORLD_ZOOM){
      if(pvpRockAt(sx+dx*d,sy+dy*d,3/WORLD_ZOOM)){sideLength=Math.max(0,d-4/WORLD_ZOOM);break;}
     }
    }else if(room.mode==='rift'){
     const layout=WorldSimulation.mapLayoutFor(room.world);
     for(let d=0;d<=beamRange;d+=6/WORLD_ZOOM){
      if(!AbyssalMap.isWalkable(layout,sx+dx*d,sy+dy*d,3/WORLD_ZOOM)){sideLength=Math.max(0,d-6/WORLD_ZOOM);break;}
     }
    }
    secondarySegments.push({x2:sx+dx*sideLength,y2:sy+dy*sideLength});
   }
   shot.prismBeams=secondarySegments.map(beam=>({x2:clamp(beam.x2/WORLD_WIDTH,0,1),y2:clamp(beam.y2/shotWorldHeight,0,1)}));
   const hitRadius=(room.mode==='pvp'?5/WORLD_ZOOM:0)+PhotonRay.widths[shot.beamLevel]*(shooter.hadalBeamActive?1.35:1)/(2*WORLD_ZOOM);
   if(room.mode==='pvp'){
    let changed=false;
    for(const target of room.players.values()){
     if(target.id===socket.id||target.alive===false||now<(Number(target.invulnerableUntil)||0))continue;
     const hitRadiusWithTarget=(Number(target.r)||13/WORLD_ZOOM)+hitRadius;
     const primaryHit=DiverHitbox.segmentHit(target,sx,sy,ex,ey,hitRadius,now);
     const sideHit=!primaryHit&&secondarySegments.some(beam=>DiverHitbox.segmentHit(target,sx,sy,beam.x2,beam.y2,hitRadius*.88,now));
     if(!primaryHit&&!sideHit)continue;
     const rawDamage=Math.max(1,Math.min(35,shot.damage||12))*(primaryHit?1:.42);
     const damage=pvpDamageAmount(shooter,target,rawDamage,Math.hypot(sx-target.x,sy-target.y));
     let blocked=false;
     if((Number(target.shieldCharges)||0)>0){target.shieldCharges--;target.invulnerableUntil=now+350;blocked=true;}
     else{target.hp=Math.max(0,(Number(target.hp)||target.maxHp)-damage);target.lastDamageAt=now;target.invulnerableUntil=now+180;
      if(target.hp<=0){target.alive=false;awardPvpKillXp(room,target,socket.id);target.velocityX=0;target.velocityY=0;io.to(channelFor(room)).emit('gameplay-notice',{kind:'death',title:String(target.nickname||'MERGULHADOR').toUpperCase(),text:`${target.nickname||'Um mergulhador'} foi engolido pelas profundezas.`,x:target.x/WORLD_WIDTH,y:target.y/WORLD_HEIGHT,playerId:target.id});}
     }
     io.to(target.id).emit('player-vitals',playerVitalsPayload(target,{reason:target.alive===false?'pvp-defeat':blocked?'pvp-shield':'pvp-hit',source:'pvp',damage:blocked?0:damage,attackerId:socket.id,serverTime:now}));
     io.to(channelFor(room)).emit('pvp-hit',{x:target.x/WORLD_WIDTH,y:target.y/WORLD_HEIGHT,targetId:target.id,attackerId:socket.id,damage:blocked?0:damage,skillId:'photonRay',actionId:shot.actionId,blocked});
     if(!blocked&&damage>0)applyPvpHitSynergies(room,shooter,target,rawDamage,'photonRay',now);
     changed=true;
    }
    if(changed)emitPvpRosterThrottled(room,now);
   }else{
    shooter.photonServerResolving=true;
    try{
     const enemyLookup=new Map((room.world?.enemies||[]).map(enemy=>[Number(enemy.id),enemy]));
     for(const enemy of [...(room.world?.enemies||[])]){
      if(!enemy||Number(enemy.hp)<=0)continue;
      const hitRadiusWithTarget=Math.max(2,Number(enemy.r)||12)/WORLD_ZOOM+hitRadius;
      const primaryHit=PhotonRay.segmentCircleHit(sx,sy,ex,ey,Number(enemy.x),Number(enemy.y),hitRadiusWithTarget);
      const sideHit=!primaryHit&&secondarySegments.some(beam=>PhotonRay.segmentCircleHit(sx,sy,beam.x2,beam.y2,Number(enemy.x),Number(enemy.y),hitRadiusWithTarget*.88));
      if(!primaryHit&&!sideHit)continue;
      processWorldDamage(socket,Number(enemy.id),Math.min(45,Math.max(1,shot.damage||12))*(primaryHit?1:.42),'photonRay',null,shot.actionId,enemyLookup);
     }
    }finally{shooter.photonServerResolving=false;}
   }
  }else if(room.mode==='pvp'){
   const sx=Number(shooter.x),sy=Number(shooter.y),originDistance=Math.hypot(x*WORLD_WIDTH-sx,y*shotWorldHeight-sy);
   if(originDistance>70/WORLD_ZOOM)return;
   // PvP muzzle is computed from the authoritative player and shot direction,
   // never from arbitrary client origin coordinates.
   const shotHeading=Math.atan2(vy*shotWorldHeight,vx*WORLD_WIDTH);
   const gunDistance=(Number(shooter.r)||13/WORLD_ZOOM)*DiverArt.DRAW_SCALE*DiverArt.BARREL_TIP_X/14;
   const below=(Number(shooter.r)||13/WORLD_ZOOM)*DiverArt.DRAW_SCALE*DiverArt.GUN_OFFSET_Y/14;
   const authoritativeMuzzleX=sx+Math.cos(shotHeading)*gunDistance-Math.sin(shotHeading)*below;
   const authoritativeMuzzleY=sy+Math.sin(shotHeading)*gunDistance+Math.cos(shotHeading)*below;
   if(shot.special!=='nova'){
    shot.x=authoritativeMuzzleX/WORLD_WIDTH;
    shot.y=authoritativeMuzzleY/shotWorldHeight;
   }else{shot.x=authoritativeMuzzleX/WORLD_WIDTH;shot.y=authoritativeMuzzleY/shotWorldHeight;}
   const rangeStrength=clamp(Number(shooter.rangeStrength)||1,1,Math.pow(1.22,3));
   const rangeMultiplier=SkinAbilities.targetRangeMultiplier(shooter.skinId,shooter.specimenPoints,shooter.specimenAlive!==false);
   if(shot.special==='nova'){
    if(now<(Number(shooter.novaShotReadyAt)||0))return;
    const vxWorld=vx*WORLD_WIDTH,vyWorld=vy*shotWorldHeight,coneSpeed=Math.hypot(vxWorld,vyWorld);
    if(coneSpeed<30||coneSpeed>1800)return;
    const heading=Math.atan2(vyWorld,vxWorld);
    shooter.novaShotReadyAt=now+2400;
     shooter.lastNovaVolleyId=volleyId;shooter.novaShardExpiresAt=now+600;shooter.novaShardCount=0;
     shooter.novaReferenceDamage=Math.min(35,Math.max(1,shot.damage));
    const radius=294*rangeStrength*rangeMultiplier/WORLD_ZOOM,centerX=authoritativeMuzzleX,centerY=authoritativeMuzzleY,rawDamage=Math.max(1,Math.min(35,shot.damage||12));
    shot.effectRadius=radius;
    let worldPlayersChanged=false;
    for(const target of room.players.values()){
     if(target.id===socket.id||target.alive===false||now<(Number(target.invulnerableUntil)||0))continue;
     if(!GravityCone.contains(centerX,centerY,heading,target.x,target.y,target.r,radius))continue;
     // The cone cannot damage anyone behind solid cover.
     if(pvpSegmentHitsRock(centerX,centerY,target.x,target.y,2/WORLD_ZOOM))continue;
     let blocked=false,appliedDamage=0;
     if((Number(target.shieldCharges)||0)>0){target.shieldCharges--;target.invulnerableUntil=now+350;blocked=true;}
     else{appliedDamage=pvpDamageAmount(shooter,target,rawDamage,Math.hypot(centerX-target.x,centerY-target.y));target.hp=Math.max(0,(Number(target.hp)||target.maxHp)-appliedDamage);target.lastDamageAt=now;target.invulnerableUntil=now+180;if(target.hp<=0){target.alive=false;awardPvpKillXp(room,target,socket.id);target.velocityX=0;target.velocityY=0;io.to(channelFor(room)).emit('gameplay-notice',{kind:'death',title:String(target.nickname||'MERGULHADOR').toUpperCase(),text:`${target.nickname||'Um mergulhador'} foi engolido pelas profundezas.`,x:Number(target.x)/WORLD_WIDTH,y:Number(target.y)/WORLD_HEIGHT,playerId:target.id});}}
     io.to(target.id).emit('player-vitals',playerVitalsPayload(target,{reason:target.alive===false?'pvp-defeat':blocked?'pvp-shield':'pvp-hit',source:'pvp',damage:blocked?0:appliedDamage,attackerId:socket.id,serverTime:now}));
     io.to(channelFor(room)).emit('pvp-hit',{x:target.x/WORLD_WIDTH,y:target.y/WORLD_HEIGHT,targetId:target.id,attackerId:socket.id,damage:blocked?0:appliedDamage,skillId:shot.special||'physical',actionId:shot.actionId,blocked});if(!blocked&&appliedDamage>0)applyPvpHitSynergies(room,shooter,target,rawDamage,shot.special||'physical',now);
     worldPlayersChanged=true;
    }
    if(worldPlayersChanged)emitPvpRosterThrottled(room,now);
   }else{
    const dx=vx*WORLD_WIDTH,dy=vy*shotWorldHeight,speed=Math.hypot(dx,dy);
    if(speed<30||speed>1800)return;
    // Resolve damage at actual impact during the existing 50ms room simulation.
    const allowedRange=294*rangeStrength*rangeMultiplier/WORLD_ZOOM;
    const maxDistance=shot.modifiers?.abyssEye===true?Math.hypot(WORLD_WIDTH,shotWorldHeight):allowedRange;
    const nowShot=Date.now();
    room.pvpProjectiles ||= [];
    PvpProjectiles.enqueue(room.pvpProjectiles,{
     ownerId:socket.id,x:sx,y:sy,ux:dx/speed,uy:dy/speed,speed,
     remaining:maxDistance,lifetime:shot.modifiers?.abyssEye===true?8:Math.max(1.05,Math.min(2.5,maxDistance/Math.max(1,speed)+.14)),
     worldWidth:WORLD_WIDTH,worldHeight:shotWorldHeight,worldZoom:WORLD_ZOOM,
     radius:5/WORLD_ZOOM,damage:shot.damage,special:shot.special,actionId:shot.actionId,
     volleyTargets:shooter.lastShotVolleyTargets,lastAt:nowShot,createdAt:nowShot
    });
   }
  }
  if(shot.special==='photonRay'||room.mode==='pvp')io.to(channelFor(room)).emit('shared-shot',shot);
  else io.to(channelFor(room)).volatile.emit('shared-shot',shot);
 });
 socket.on('fusion-achieved',payload=>{const room=socketRoom(socket),player=room?.players.get(socket.id);if(!room||!player||player.alive===false||player.tutorialActive)return;const name=String(payload?.name||'').trim().slice(0,48);if(!name)return;const nickname=String(socket.data.nickname||'Mergulhador').slice(0,18);io.to(channelFor(room)).emit('gameplay-notice',{kind:'fusion',title:name.toUpperCase(),text:`${nickname} fundiu habilidades e despertou ${name}.`});});
 socket.on('skin-ability',(payload,acknowledge)=>{
  const room=socketRoom(socket),player=room?.players.get(socket.id);
  const ack=(ok,reason,extra={})=>{if(typeof acknowledge==='function')acknowledge({ok,reason,serverTime:Date.now(),...extra});};
  if(!room||!socket.data.joined||!player||player.alive===false||player.tutorialActive||!payload||typeof payload!=='object')return ack(false,'not-in-room');
  if(payload.type!=='standard-active')return ack(false,'legacy-skin-ability-removed');
  const skin=String(payload.skin||'').slice(0,32),active=String(payload.active||'').slice(0,24),baseSpec=SkinStandard.activeSpec(skin);
  if(!baseSpec||player.skinId!==skin||baseSpec.id!==active)return ack(false,'skin-active-mismatch');
  if(player.specimenAlive===false)return ack(false,'specimen-defeated');
  const mastery=specimenStatsFor(player),spec={...baseSpec,cooldown:active==='paralysis'||active==='poison'?10:mastery.cooldown,range:(Number(baseSpec.range)||0)*mastery.rangeMultiplier};
  if(active==='paralysis'&&!['electriceel','electriceellegacy'].includes(skin))return ack(false,'paralysis-electric-only');
  const now=Date.now(),ready=Number(player.skinActiveReadyAt)||0;
  if(now<ready)return ack(false,'skin-active-cooldown',{remainingMs:ready-now});
  const nx=Number(payload.x),ny=Number(payload.y),angle=clamp(Number(payload.angle)||0,-Math.PI*2,Math.PI*2),worldHeight=roomWorldHeight(room);
  if(!Number.isFinite(nx)||!Number.isFinite(ny)||nx<0||nx>1||ny<0||ny>1)return ack(false,'skin-active-position');
  const specimenPos=specimenPositionFor(player),originX=specimenPos.x,originY=specimenPos.y;
  if(Math.hypot(originX-nx*WORLD_WIDTH,originY-ny*worldHeight)>45/WORLD_ZOOM)return ack(false,'skin-active-position');
  const radius=(Number(spec.range)||160)/WORLD_ZOOM,ux=Math.cos(angle),uy=Math.sin(angle);
  const enemies=[...(room.world?.enemies||[])];
  const worldLayout=room.mode==='rift'?WorldSimulation.mapLayoutFor(room.world):null;
  const canReachEnemy=e=>e&&Number(e.hp)>0&&
   (!worldLayout||!AbyssalMap.segmentWalkable||AbyssalMap.segmentWalkable(worldLayout,originX,originY,Number(e.x),Number(e.y),Math.min(7,Number(e.r)||5)));
  const lineDistance=(px,py,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,denom=dx*dx+dy*dy;if(denom<=1e-9)return Math.hypot(px-ax,py-ay);const q=clamp(((px-ax)*dx+(py-ay)*dy)/denom,0,1);return Math.hypot(px-(ax+dx*q),py-(ay+dy*q));};
  const resolveEnemyDamage=(enemy,amount,skillId)=>{
   if(!canReachEnemy(enemy))return;
   player.skinActiveServerResolving=true;
   try{processWorldDamage(socket,Number(enemy.id),amount,skillId,null,'skin:'+now);}
   finally{player.skinActiveServerResolving=false;}
  };
  const areaEnemies=()=>enemies.filter(e=>canReachEnemy(e)&&Math.hypot(Number(e.x)-originX,Number(e.y)-originY)<=radius+(Number(e.r)||0)).slice(0,24);
  const nearestEnemy=()=>areaEnemies().sort((a,b)=>Math.hypot(a.x-originX,a.y-originY)-Math.hypot(b.x-originX,b.y-originY))[0]||null;
  const livingOpponents=()=>[...room.players.values()].filter(p=>p.id!==player.id&&p.alive!==false);
  const visiblePvpTargets=()=>livingOpponents().filter(p=>Math.hypot(p.x-originX,p.y-originY)<=radius+(Number(p.r)||0)&&
   !pvpSegmentHitsRock(originX,originY,p.x,p.y,Math.max(2,Number(p.r)||13/WORLD_ZOOM))).slice(0,6);
  const hitPvp=(target,amount,skillId)=>applySkinActivePvpDamage(room,player,target,amount,skillId,Date.now());
  const weaponInfusion=active==='paralysis'||active==='poison';
  const activeDuration=weaponInfusion?10000:active==='trail'?10000:0;
  player.skinActiveReadyAt=now+activeDuration+Math.round(Number(spec.cooldown||10)*1000);
  if(weaponInfusion){player.skinWeaponBuffKind=active;player.skinWeaponBuffUntil=now+10000;}
  // One authoritative event also drives peer VFX. Ability damage remains server-controlled.
  io.to(channelFor(room)).emit('peer-skin-ability',{type:'standard-active',fromId:player.id,active,skin,angle,x:originX/WORLD_WIDTH,y:originY/worldHeight,range:Number(spec.range)||0,color:spec.color,activeDurationMs:activeDuration,until:now+activeDuration});
  if(active==='dash'){
   let travel=radius;
   for(let step=0;step<14;step++){
    const tx=originX+ux*travel,ty=originY+uy*travel;
    const outside=tx<12/WORLD_ZOOM||tx>WORLD_WIDTH-12/WORLD_ZOOM||ty<12/WORLD_ZOOM||ty>worldHeight-12/WORLD_ZOOM;
    const blocked=outside||(room.mode==='pvp'?pvpSegmentHitsRock(originX,originY,tx,ty,11/WORLD_ZOOM):worldLayout&&AbyssalMap.segmentWalkable&&!AbyssalMap.segmentWalkable(worldLayout,originX,originY,tx,ty,11/WORLD_ZOOM));
    if(!blocked)break;
    travel*=.82;
   }
   const x2=originX+ux*travel,y2=originY+uy*travel;
   player.specimenDash={x1:originX,y1:originY,x2,y2,startedAt:now};
   player.specimenDashUntil=now+650;
   player.specimenInvulnerableUntil=Math.max(Number(player.specimenInvulnerableUntil)||0,player.specimenDashUntil);
   io.to(channelFor(room)).emit('specimen-dash',{fromId:player.id,x1:originX/WORLD_WIDTH,y1:originY/worldHeight,x2:x2/WORLD_WIDTH,y2:y2/worldHeight,durationMs:650,startedAt:now});
  }
  if(active==='shield'){
   const until=now+2000;
   player.specimenShieldUntil=until;player.specimenInvulnerableUntil=until;
   player.invulnerableUntil=Math.max(Number(player.invulnerableUntil)||0,until);
   io.to(channelFor(room)).emit('skin-shield-bubble',{fromId:player.id,until,serverTime:now});
  }
  if(active==='trail'){
   player.skinTrailUntil=now+10000;player.skinTrailNextAt=now;
   player.skinTrailLastX=NaN;player.skinTrailLastY=NaN;
   // Samples are emitted by tickSkinTrailNodes from the authoritative specimen.
  }else if(active==='shot'||active==='slowShot'){
   const ex=originX+ux*radius,ey=originY+uy*radius;
   io.to(channelFor(room)).emit('skin-shot-telegraph',{fromId:player.id,x1:originX/WORLD_WIDTH,y1:originY/worldHeight,x2:ex/WORLD_WIDTH,y2:ey/worldHeight,color:room.mode==='pvp'?'#ff334f':spec.color,hitAt:now+450,active});
   setTimeout(()=>{
    const liveRoom=socketRoom(socket),livePlayer=liveRoom?.players.get(socket.id);if(liveRoom!==room||!livePlayer||livePlayer.alive===false)return;
    if(room.mode==='pvp'){
     const target=livingOpponents().filter(p=>lineDistance(Number(p.x),Number(p.y),originX,originY,ex,ey)<=30/WORLD_ZOOM&&!pvpSegmentHitsRock(originX,originY,Number(p.x),Number(p.y),Math.max(2,Number(p.r)||13/WORLD_ZOOM))).sort((a,b)=>Math.hypot(a.x-originX,a.y-originY)-Math.hypot(b.x-originX,b.y-originY))[0];
     if(target){hitPvp(target,spec.damage,'skin-active-'+active);if(active==='slowShot'){target.skinSlowedUntil=Date.now()+2200;io.to(target.id).emit('player-skin-status',{type:'slow',until:target.skinSlowedUntil,multiplier:.62});}}
    }else{
     const target=[...(room.world?.enemies||[])].filter(e=>Number(e.hp)>0&&lineDistance(Number(e.x),Number(e.y),originX,originY,ex,ey)<=24/WORLD_ZOOM).sort((a,b)=>Math.hypot(a.x-originX,a.y-originY)-Math.hypot(b.x-originX,b.y-originY))[0];
     if(target){resolveEnemyDamage(target,spec.damage,'skin-active-'+active);if(active==='slowShot')target.skinSlowedUntil=Date.now()+2200;}
    }
   },450);
  }else if(active==='cloud'){
   // Each victim takes one impact when the growing toxic edge actually reaches it.
   const touched=new Set();
   for(const delay of [250,500,800,1150])setTimeout(()=>{
    if(socketRoom(socket)!==room||!room.players.has(player.id)||player.alive===false)return;
    const grow=clamp(delay/(1550*.72),0,1);
    const edge=radius*(.06+.94*(1-Math.pow(1-grow,2)));
    if(room.mode==='pvp'){
     for(const target of livingOpponents()){
      if(touched.size>=24||touched.has(target.id)||Math.hypot(target.x-originX,target.y-originY)>edge+(Number(target.r)||0))continue;
      if(pvpSegmentHitsRock(originX,originY,target.x,target.y,2/WORLD_ZOOM))continue;
      const hit=hitPvp(target,spec.damage,'skin-active-cloud');
      if(!hit)continue;
      touched.add(target.id);
      if(!hit.blocked)for(const dotDelay of [500,1000,1500,2000])setTimeout(()=>{
       const live=room.players.get(target.id);
       if(socketRoom(socket)===room&&room.players.has(player.id)&&live?.alive!==false)hitPvp(live,5,'skin-active-poison-dot');
      },dotDelay);
     }
    }else{
     for(const e of room.world?.enemies||[]){
      if(touched.size>=24||!e||touched.has(e.id)||!canReachEnemy(e)||Math.hypot(e.x-originX,e.y-originY)>edge+(Number(e.r)||0))continue;
      touched.add(e.id);resolveEnemyDamage(e,spec.damage,'skin-active-cloud');
      for(const dotDelay of [500,1000,1500,2000])setTimeout(()=>{
       if(socketRoom(socket)===room&&room.players.has(player.id)&&player.alive!==false&&room.world?.enemies?.includes(e)&&Number(e.hp)>0){
        player.skinActiveServerResolving=true;player.weaponPoisonOrigin={x:Number(e.x),y:Number(e.y)};
        try{processWorldDamage(socket,Number(e.id),1.2,'skin-active-poison-dot');}
        finally{player.skinActiveServerResolving=false;player.weaponPoisonOrigin=null;}
       }
      },dotDelay);
     }
    }
   },delay);
  }else if(room.mode==='pvp'){
   const targets=visiblePvpTargets();
   if(active==='dash'){
    const ex=player.specimenDash.x2,ey=player.specimenDash.y2;for(const target of livingOpponents())if(lineDistance(target.x,target.y,originX,originY,ex,ey)<=34/WORLD_ZOOM&&!pvpSegmentHitsRock(originX,originY,target.x,target.y,2/WORLD_ZOOM))hitPvp(target,spec.damage,'skin-active-dash');
   }else if(active==='shield'||active==='poison'||active==='paralysis'){}
   else for(const target of targets){
    const hit=hitPvp(target,spec.damage,'skin-active-'+active);if(!hit)continue;
    if(active==='push'){const dx=target.x-originX,dy=target.y-originY,d=Math.hypot(dx,dy)||1,tx=target.x+dx/d*93/WORLD_ZOOM,ty=target.y+dy/d*93/WORLD_ZOOM;
     if(!pvpSegmentHitsRock(target.x,target.y,tx,ty,Number(target.r)||13/WORLD_ZOOM)){
      target.skinPushImpulse={dx:dx/d*93/WORLD_ZOOM,dy:dy/d*93/WORLD_ZOOM,elapsed:0,applied:0,duration:.32};
      io.to(target.id).emit('player-suction-pull',{dx:target.skinPushImpulse.dx,dy:target.skinPushImpulse.dy,bossId:'skin-push',strength:1,durationMs:320});
     }}
    if(active==='cloud'){for(const delay of [500,1000,1500,2000])setTimeout(()=>{const live=room.players.get(target.id);if(live?.alive!==false)hitPvp(live,5,'skin-active-poison-dot');},delay);}
   }
  }else{
   if(active==='dash'){const ex=player.specimenDash.x2,ey=player.specimenDash.y2;for(const e of enemies)if(canReachEnemy(e)&&lineDistance(e.x,e.y,originX,originY,ex,ey)<=34/WORLD_ZOOM)resolveEnemyDamage(e,spec.damage,'skin-active-dash');}
   else if(active==='shield'){}
   else if(active==='poison'||active==='paralysis'){}
   else for(const e of areaEnemies()){resolveEnemyDamage(e,spec.damage,'skin-active-'+active);if(active==='push'){const dx=e.x-originX,dy=e.y-originY,d=Math.hypot(dx,dy)||1;e.kbVx=dx/d*645;e.kbVy=dy/d*645;}if(active==='cloud')for(const delay of [500,1000,1500,2000])setTimeout(()=>{if(Number(e.hp)>0)resolveEnemyDamage(e,5,'skin-active-poison-dot');},delay);}
  }
  ack(true,'accepted',{cooldownMs:Math.round(Number(spec.cooldown||10)*1000),active,activeDurationMs:activeDuration,readyAt:player.skinActiveReadyAt});
 });
 socket.on('active-ability',(payload,acknowledge)=>{
  const room=socketRoom(socket),player=room?.players.get(socket.id),u=users[socket.data.userKey],id=String(payload?.id||'');
  const ack=(ok,reason)=>{if(typeof acknowledge==='function')acknowledge({ok,reason,serverTime:Date.now()});};
  if(!room||!player||player.alive===false||player.tutorialActive||id!=='pulse'||!(Number(u?.metaUpgrades?.pulse)>0))return ack(false,'invalid-ability');
  const now=Date.now();if(now<(Number(player.pulseReadyAt)||0))return ack(false,'cooldown');player.pulseReadyAt=now+14000;ack(true,'accepted');
  const rangeStrength=clamp(Number(player.rangeStrength)||1,1,Math.pow(1.22,3)),radius=245*rangeStrength/WORLD_ZOOM,baseDamage=28*Math.pow(1.08,Math.max(0,Number(u?.metaUpgrades?.focuser)||0));
  if(room.mode==='pvp'){
   for(const target of room.players.values()){
    if(target.id===socket.id||target.alive===false||Math.hypot(target.x-player.x,target.y-player.y)>=radius)continue;
    if(pvpSegmentHitsRock(player.x,player.y,target.x,target.y,2/WORLD_ZOOM))continue;
    const damage=pvpDamageAmount(player,target,Math.min(24,baseDamage),Math.hypot(target.x-player.x,target.y-player.y));let blocked=false;
    if((Number(target.shieldCharges)||0)>0){target.shieldCharges--;target.invulnerableUntil=now+350;blocked=true;}
    else if(now>=(Number(target.invulnerableUntil)||0)){target.hp=Math.max(0,(Number(target.hp)||target.maxHp)-damage);target.lastDamageAt=now;target.invulnerableUntil=now+180;if(target.hp<=0){target.alive=false;awardPvpKillXp(room,target,socket.id);target.velocityX=0;target.velocityY=0;io.to(channelFor(room)).emit('gameplay-notice',{kind:'death',title:String(target.nickname||'MERGULHADOR').toUpperCase(),text:`${target.nickname||'Um mergulhador'} foi engolido pelas profundezas.`,x:Number(target.x)/WORLD_WIDTH,y:Number(target.y)/WORLD_HEIGHT,playerId:target.id});}}
    io.to(target.id).emit('player-vitals',playerVitalsPayload(target,{reason:target.alive===false?'pvp-defeat':blocked?'pvp-shield':'pvp-hit',source:'pvp',damage:blocked?0:damage,attackerId:socket.id,skillId:'pulse',serverTime:now}));
    io.to(channelFor(room)).emit('pvp-hit',{x:target.x/WORLD_WIDTH,y:target.y/WORLD_HEIGHT,targetId:target.id,attackerId:socket.id,damage:blocked?0:damage,skillId:'pulse',blocked});
   }
   io.to(channelFor(room)).emit('world-players',[...room.players.values()].map(({userKey,runStats,...peer})=>peer));
  }else{
   const targets=room.world.enemies.filter(enemy=>Math.hypot(enemy.x-player.x,enemy.y-player.y)<radius).slice(0,96);
   const batch={damaged:[],defeated:[],accountUpdated:false,worldChanged:false},enemyLookup=new Map(room.world.enemies.map(enemy=>[Number(enemy.id),enemy]));
   for(const enemy of targets)processWorldDamage(socket,Number(enemy.id),baseDamage,'pulse',batch,'',enemyLookup);
   if(batch.damaged.length)io.to(channelFor(room)).emit('world-enemies-damaged',batch.damaged);
   if(batch.defeated.length)io.to(channelFor(room)).emit('world-enemies-defeated',batch.defeated);
   
   if(batch.accountUpdated)sendKillTitleProgress(socket,batch.defeated.some(enemy=>enemy.boss));
  }
 });
 socket.on('shared-damage', (payload,acknowledge) => {if(socketRoom(socket)?.players.get(socket.id)?.tutorialActive){if(typeof acknowledge==='function')acknowledge({ok:false,reason:'tutorial-active'});return;}const skillId=String(payload?.skillId||'').slice(0,32);const result=processWorldDamage(socket,Number(payload?.id),Number(payload?.damage),skillId);if(typeof acknowledge==='function')acknowledge(result);});
 socket.on('shared-damage-batch',(payload={},acknowledge)=>{
  const ack=data=>{if(typeof acknowledge==='function')acknowledge(data)};
  const room=socketRoom(socket);
  if(!room||!socket.data.joined)return ack({ok:false,reason:'not-in-room',accepted:0});
  if(room.players.get(socket.id)?.tutorialActive)return ack({ok:false,reason:'tutorial-active',accepted:0});
  const hits=Array.isArray(payload?.hits)?payload.hits.slice(0,128):[];
  if(!hits.length)return ack({ok:false,reason:'empty-batch',accepted:0});
  const batch={damaged:[],defeated:[],accountUpdated:false,worldChanged:false},enemyLookup=new Map(room.world.enemies.map(enemy=>[Number(enemy.id),enemy]));
  let accepted=0,rejected=0;
  for(const hit of hits){
   const result=processWorldDamage(socket,Number(hit?.id),Number(hit?.damage),String(hit?.skillId||'').slice(0,32),batch,String(hit?.actionId||'').slice(0,72),enemyLookup);
   if(result?.ok)accepted++;else rejected++;
  }
  if(batch.damaged.length)io.to(channelFor(room)).emit('world-enemies-damaged',batch.damaged);
  if(batch.defeated.length)io.to(channelFor(room)).emit('world-enemies-defeated',batch.defeated);
  
  if(batch.accountUpdated)sendKillTitleProgress(socket,batch.defeated.some(enemy=>enemy.boss));
  ack({ok:accepted>0,accepted,rejected,defeated:batch.defeated.length});
 });
 socket.on('shared-xp-award', () => {}); // Clients cannot award XP; the server credits verified kills.
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
   for(const session of (io.sockets?.sockets?.values?.() || [])){
    if(session.data.userKey!==key)continue;
    const isRequester=session.id===socket.id;
    removeFromRoom(session,{announce:true,emitResult:true});
    session.data.userKey=null;session.data.nickname=null;session.data.joined=false;session.data.roomId=null;
    if(!isRequester)session.emit('account-force-logout',{message:'Esta conta foi excluída em outra sessão.'});
   }
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
 socket.on('open-rift-chest',async(payload={},ack)=>{
  const reply=result=>{if(typeof ack==='function')ack(result);};
  const u=users[socket.data.userKey];if(!u)return reply({ok:false,message:'Entre na sua conta para abrir o baú.'});
  const room=socketRoom(socket),p=room?.players.get(socket.id);
  let id=String(payload.id||'');
  if(!id&&room?.mode==='rift'){const chest=u.riftChests?.find(c=>c.key===`${room.world.worldId}:${room.world.mapTier}`);if(chest)id=chest.id;}
  if(!id){
   // Local expeditions use the existing reported-run progression. Their combat
   // is client simulated; rewards are always selected and persisted here.
   const run=socket.data.runStats,tier=Number(payload.tier);
   if(room||!run||run.settled||run.mode!=='rift'||!Number.isInteger(tier)||tier<0||tier>=(Number(run.bossesKilled)||0))return reply({ok:false,message:'A derrota do boss ainda não foi registrada. Aguarde e tente novamente.'});
   id=RiftRewards.grant(u,`solo:${run.id}:${tier}`,{final:tier===RiftHardcore.FINAL_TIER&&Number(run.bossesKilled)>RiftHardcore.FINAL_TIER}).id;
  }else{
   const chest=u.riftChests?.find(c=>c.id===id);
   if(!chest)return reply({ok:false,message:'Baú não encontrado.'});
   if(!chest.reward&&room&&room.mode==='rift'&&p){const bossRoom=WorldSimulation.mapLayoutFor(room.world)?.rooms.find(r=>r.id==='boss');if(p.alive===false||!bossRoom||Math.hypot(p.x-bossRoom.x,p.y-bossRoom.y)>bossRoom.rx)return reply({ok:false,message:'Aproxime-se do baú na caverna do boss.'});}
  }
  const result=RiftRewards.open(u,id);saveUsers();
  try{await flushPersistence();}catch{ return reply({ok:false,message:'Não foi possível confirmar o salvamento. Tente novamente.'}); }
  socket.emit('account-data',publicUser(u));reply(result);
 });
 socket.on('get-account', () => { const u = users[socket.data.userKey]; if (u) socket.emit('account-data', publicUser(u)); });
  socket.on('equip-title', payload => { const u=users[socket.data.userKey];if(!u||!payload)return;const id=String(payload.id||'');if(!unlockedTitleIds(u).includes(id))return socket.emit('account-data',publicUser(u));u.equippedTitle=id;saveUsers();socket.emit('account-data',publicUser(u));const room=socketRoom(socket),player=room?.players.get(socket.id);if(player){player.titleId=id;io.to(channelFor(room)).emit('world-players',[...room.players.values()].map(({userKey,runStats,...p})=>p));} });
 socket.on('save-cosmetics', payload => {
  const u = users[socket.data.userKey];
  if (!u || !payload) return;
  // Keep ownership filtering aligned with the canonical server whitelist, including
  // all generated marine species. Never maintain a second legacy-only whitelist here.
  u.ownedSkins = [...new Set(['default', ...(u.ownedSkins || []).filter(x => allowedSkinIds.has(x))])];
  // A conclusão dos ciclos finais concede a Moréia Esmeralda Colossal à conta.
  // O cliente envia esta confirmação ao concluir a conquista; a skin é registrada
  // no perfil antes de aceitar uma solicitação para equipá-la.
  if(payload.conqueror===true){
   const room=socketRoom(socket),run=room?.players.get(socket.id)?.runStats||socket.data.runStats;
   const reachedFinal=run&&!run.settled&&(Number(run.bossesKilled)||0)>=42&&
     (room?.mode==='coop'||(!room&&run.mode==='solo'&&Date.now()-(Number(run.startedAt)||Date.now())>=900000));
   if(reachedFinal)grantFinalConquest(u);
  }
  if(payload.diverGender==='female'||payload.diverGender==='male'){
   u.diverGender=payload.diverGender;
   const currentRoom=socketRoom(socket),activePlayer=currentRoom?.players.get(socket.id);
   if(activePlayer){activePlayer.diverGender=u.diverGender;io.to(channelFor(currentRoom)).emit('world-players',[...currentRoom.players.values()].map(({userKey,runStats,...p})=>p));}
  }
  if(payload.resonancePresets&&typeof payload.resonancePresets==='object'){const valid=['power','rate','speed','range','magnet','regen','shield','burst','electric','pierce','ricochet','spread','photon','photonRay','nova','echoShot','shell','ward','lastStand','pressureCocoon','vitality','predator','closePressure'];const shotSkills=new Set(['electric','pierce','spread','photon','photonRay','nova','echoShot']);const presets={pve:[],pvp:[]};for(const mode of ['pve','pvp']){const ids=Array.isArray(payload.resonancePresets[mode])?payload.resonancePresets[mode]:[];let hasShot=false;presets[mode]=[...new Set(ids.map(String).filter(id=>valid.includes(id)))].filter(id=>{if(!shotSkills.has(id))return true;if(hasShot)return false;hasShot=true;return true;}).slice(0,7);if(!presets[mode].some(id=>shotSkills.has(id))){if(presets[mode].length>=7)presets[mode].pop();presets[mode].unshift('electric');}}u.resonancePresets=presets;}
  if (u.ownedSkins.includes(payload.equippedSkin)){
   u.equippedSkin = payload.equippedSkin;
   const room=socketRoom(socket),p=room?.players.get(socket.id);
   if(p){p.skinId=u.equippedSkin;p.specimenPoints=SpecimenSystem.pointsFor(u.specimenProficiency,p.skinId);p.specimenAlive=true;p.specimenMaxHp=SpecimenSystem.biologicalStats(p.skinId).hp;p.specimenHp=p.specimenMaxHp;p.specimenRespawnAt=0;p.specimenX=Number(p.x)||0;p.specimenY=(Number(p.y)||0)-34/WORLD_ZOOM;p.specimenLastAt=Date.now();emitSpecimenState(room,p,'equipped');}
  }
  saveUsers();
  socket.emit('account-data', publicUser(u));
 });
 socket.on('purchase-skin', payload => {
  const u = users[socket.data.userKey]; if (!u || !payload) return;
  const stripeOnlySkins = new Set(['saltcroc','blackcaiman','violet','leviathan','kraken','aberration','angler','maw','devourer','reefshark','hammerhead','abysscroc','armoredgator']);
  const requestedId=String(payload.id||'');
  if(stripeOnlySkins.has(requestedId))return socket.emit('purchase-result',{ok:false,message:'Este Espécime exige checkout hospedado e confirmação de pagamento.'});
  const prices = { solar:2500, toxic:4000, thorn:8000, abyssking:10000, royal:12000, glacier:13000, coral:6000, bloodmoon:9000, voidwing:15000, abyssaleye:18000, deepwarden:14000 };
  Object.assign(prices,Object.fromEntries(curatedSkins.items.map(s=>[s.id,s.price])));
  const id = String(payload.id || ''), price = prices[id];
  if (!price) return socket.emit('purchase-result', { ok:false, message:'Espécime indisponível para compra com moedas.' });
  if ((u.ownedSkins || ['default']).includes(id)) return socket.emit('purchase-result', { ok:true, message:'Você já possui este Espécime.', account:publicUser(u) });
  if ((u.coins || 0) < price) return socket.emit('purchase-result', { ok:false, message:'Moedas abissais insuficientes.', account:publicUser(u) });
  u.coins -= price; u.ownedSkins = [...(u.ownedSkins || ['default']), id]; u.equippedSkin = id; saveUsers(); socket.emit('purchase-result', { ok:true, message:'Espécime desbloqueado e salvo na conta!', account:publicUser(u) });
 });
 socket.on('redeem-code', payload => {
  const u=users[socket.data.userKey];if(!u)return socket.emit('code-redeem-result',{ok:false,message:'Entre na sua conta para resgatar este código.'});
  const code=String(payload?.code||'').trim().toLowerCase();
  const welcome=String(process.env.ABYSSAL_WELCOME_CODE||'').trim().toLowerCase();
  const founder=String(process.env.ABYSSAL_FOUNDER_CODE||'').trim().toLowerCase();
  u.redeemedPromoIds=Array.isArray(u.redeemedPromoIds)?u.redeemedPromoIds:[];
  if(code==='exclusivoabyssal'){
   const promoId='exclusive-abyssal-skin-choice-v1';
   if(u.redeemedPromoIds.includes(promoId))return socket.emit('code-redeem-result',{ok:false,message:'Este código já foi utilizado nesta conta.'});
   // Only store skins qualify, including paid ones. Achievement and final-boss
   // rewards are not store merchandise and remain progression unlocks.
   const choices=[...allowedSkinIds].filter(id=>id!=='default'&&id!=='greensnake'&&id!==RiftRewards.FINAL_SKIN);
   const selected=String(payload?.skinId||'').trim();
   if(!selected)return socket.emit('code-redeem-result',{ok:true,choiceRequired:true,eligibleSkinIds:choices,message:'Código validado! Escolha um Espécime da loja, inclusive os pagos. Um Espécime gratuito por conta.'});
   if(!choices.includes(selected))return socket.emit('code-redeem-result',{ok:false,message:'Este Espécime não está disponível para o código. Escolha outro da loja.'});
   u.ownedSkins=Array.isArray(u.ownedSkins)?u.ownedSkins:['default'];
   if(u.ownedSkins.includes(selected))return socket.emit('code-redeem-result',{ok:false,message:'Você já possui este Espécime. Escolha outra da loja.',choiceRequired:true,eligibleSkinIds:choices});
   u.ownedSkins.push(selected);
   u.equippedSkin=selected;
   u.redeemedPromoIds.push(promoId);
   saveUsers();
   socket.emit('code-redeem-result',{ok:true,skinId:selected,coinsAwarded:0,message:'Espécime escolhido desbloqueado permanentemente! Código exclusivoabyssal utilizado.',account:publicUser(u)});
   return;
  }
  let id='',coinsAwarded=0,skinId=null,message='';
  if(welcome&&code===welcome){id='welcome-10k';coinsAwarded=10000;message='Código resgatado! +10.000 essências.';}
  else if(founder&&code===founder){id='founder-electric-eel';coinsAwarded=60000;skinId='electriceel';message='Código histórico validado! +60.000 moedas e Espécime lendário Raia-Elétrica Abissal desbloqueado permanentemente!';}
  else return socket.emit('code-redeem-result',{ok:false,message:'Código inválido. Confira e tente novamente.'});
  if(u.redeemedPromoIds.includes(id))return socket.emit('code-redeem-result',{ok:false,message:'Este código já foi resgatado nesta conta.'});
  u.coins=(Number(u.coins)||0)+coinsAwarded;u.ownedSkins=Array.isArray(u.ownedSkins)?u.ownedSkins:['default'];if(skinId&&!u.ownedSkins.includes(skinId))u.ownedSkins.push(skinId);u.redeemedPromoIds.push(id);saveUsers();
  socket.emit('code-redeem-result',{ok:true,message,skinId,coinsAwarded,account:publicUser(u)});
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
  if(!REWARDED_WHEEL_ENABLED)return socket.emit('wheel-result',{ok:false,message:'As recompensas aleatórias estão desativadas enquanto a política de segurança é revisada.'});
  const u=users[socket.data.userKey];if(!u)return socket.emit('wheel-result',{ok:false,message:'Entre na sua conta para guardar a recompensa.'});
  const now=Date.now(),cooldown=20*60*60*1000;if(now-(Number(u.lastWheelAt)||0)<cooldown)return socket.emit('wheel-result',{ok:false,message:'Você já usou seu giro premiado recentemente. Volte mais tarde.',account:publicUser(u)});
  // Chamado somente após o callback adViewed da API oficial de anúncio recompensado.
  const roll=Math.random()*100;let reward=roll<40?20:roll<70?50:roll<88?100:roll<96?300:roll<99.9?600:1000;
  u.coins=(u.coins||0)+reward;u.lastWheelAt=now;saveUsers();socket.emit('wheel-result',{ok:true,reward,coins:u.coins,account:publicUser(u),nextSpinAt:now+cooldown});
 });
 socket.on('submit-run', async payload => { try { const result=await finishRunForSocket(socket,payload||{}); socket.emit('run-saved',result); } catch(err) { console.error('[run] Falha no submit-run legado:',err.message); } });
 socket.on('disconnect', () => { if(!shutdownStarted&&socket.data.userKey&&(socket.data.joined||socket.data.runStats)){finishRunForSocket(socket,{}).catch(err=>console.error('[run] Falha ao finalizar desconexão:',err.message));} removeFromRoom(socket,{announce:true,emitResult:false}); broadcastOnline(); setTimeout(broadcastCardumeRosters,0); });
});
setInterval(settlePeriods, 60 * 60 * 1000).unref();
// Detecta a virada do dia em America/Sao_Paulo; o boot também corrige dias perdidos após spin-down.
setInterval(()=>heartbeatRoomDirectory().catch(err=>console.error('[rooms] heartbeat falhou:',err.message)),5000).unref();
async function boot() {
 await initializePersistence();
 await initializeRoomRegistry();
 settlePeriods();
 await flushPersistence();
 server.listen({port:PORT,host:'0.0.0.0',backlog:HTTP_BACKLOG}, () => console.log(`Abyssal online em http://localhost:${PORT} · persistência: ${pgPool ? 'PostgreSQL' : 'local efêmera'} · perfil: ${RESOURCE_PROFILE} · CPUs: ${HOST_CPU_COUNT}`));
}
boot().catch(err => {
 console.error('[boot] O servidor não será iniciado para evitar aceitar contas sem persistência configurada/funcional:', err);
 process.exit(1);
});
let shutdownStarted = false;
async function shutdown(signal) {
 if (shutdownStarted) return; shutdownStarted = true;
 console.log(`[shutdown] ${signal}: preservando expedições e transferindo clientes…`);
 const hardStop = setTimeout(() => process.exit(1), 8000); hardStop.unref();
 try {
  // Snapshot active runs before notifying or disconnecting clients. A deploy must never
  // depend on a WebSocket remaining attached to the retiring Render instance.
  let deployRuns=0;for(const client of (io.sockets?.sockets?.values?.()||[]))if(stashDeployRun(client))deployRuns++;if(deployRuns)saveUsers();
  if(titleStatsSaveTimer){clearTimeout(titleStatsSaveTimer);titleStatsSaveTimer=null;saveUsers();}
  await flushPersistence();
  io.emit('server-maintenance',{reason:'deploy',instanceId:SERVER_INSTANCE_ID,message:'Atualização em andamento. Reconectando automaticamente…'});
  await new Promise(resolve=>setTimeout(resolve,250));
  // server.close() waits for persistent WebSockets. Explicitly detach them so Socket.IO
  // reconnects clients to the new Render instance instead of leaving them on maintenance.
  io.disconnectSockets(true);
  await new Promise(resolve=>setTimeout(resolve,80));
  await new Promise(resolve => { if (server.listening) server.close(resolve); else resolve(); });
  await flushPersistence();
  if(pgPool&&roomRegistryReady){try{await pgPool.query('DELETE FROM abyssal_rooms WHERE owner_instance=$1',[SERVER_INSTANCE_ID]);}catch(err){console.error('[rooms] limpeza no encerramento:',err.message);}}
  if (pgPool) await pgPool.end();
  await closePersistenceWorker();
  clearTimeout(hardStop); process.exit(0);
 } catch (err) { console.error('[shutdown] Falha ao finalizar com segurança:', err.message); process.exit(1); }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
