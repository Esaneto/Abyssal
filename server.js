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
let users = readJson(USERS_FILE, {});
let rankings = readJson(RANKS_FILE, { eternal: {}, daily: {}, weekly: {}, settled: { day: '', week: '', month: '' } });
function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), { mode: 0o600 }); }
function saveRanks() { fs.writeFileSync(RANKS_FILE, JSON.stringify(rankings, null, 2)); }
function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function safeEqual(a, b) { const aa = Buffer.from(a, 'hex'), bb = Buffer.from(b, 'hex'); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); }
function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function weekKey(d = new Date()) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7)); const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); const week = Math.ceil((((x - yearStart) / 86400000) + 1) / 7); return `${x.getUTCFullYear()}-W${String(week).padStart(2, '0')}`; }
function monthKey(d = new Date()) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
function publicUser(u) { return { nickname: u.nickname, coins: u.coins || 0, ownedSkins: u.ownedSkins || ['default'], equippedSkin: u.equippedSkin || 'default' }; }
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
app.get('/health', (_req, res) => res.json({ ok: true, service: 'abyssal-server', online: onlineCount() }));
app.get('/api/rankings', (_req, res) => res.json(rankingPayload()));

const worldPlayers = new Map();
let worldHostId = null;
let latestWorldSnapshot = null;
const authAttempts = new Map();
io.on('connection', socket => {
 socket.data.nickname = null; socket.data.userKey = null; socket.data.joined = false; broadcastOnline();
 socket.emit('online-count', onlineCount());
 socket.on('authenticate', (payload = {}) => {
  const ip = socket.handshake.address || 'unknown', now = Date.now();
  const attempts = (authAttempts.get(ip) || []).filter(t => now - t < 60000);
  if (attempts.length >= 12) return socket.emit('auth-result', { ok: false, message: 'Muitas tentativas. Aguarde um minuto.' });
  const nickname = String(payload.nickname || '').trim(), password = String(payload.password || '');
  if (!/^[a-zA-Z0-9_]{3,18}$/.test(nickname) || password.length < 8 || password.length > 128) return socket.emit('auth-result', { ok: false, message: 'Nickname inválido ou senha fora do limite (8–128 caracteres).' });
  const key = nickname.toLowerCase(); let user = users[key];
  const mode = payload.mode === 'register' ? 'register' : 'login';
  if (mode === 'register') {
   if (user) return socket.emit('auth-result', { ok: false, message: 'Este nickname já existe. Use Entrar ou escolha outro nickname.' });
   const salt = crypto.randomBytes(16).toString('hex');
   user = users[key] = { nickname, salt, passwordHash: hashPassword(password, salt), createdAt: new Date().toISOString(), coins: 0, ownedSkins: ['default'], equippedSkin: 'default' };
   saveUsers();
  } else {
   if (!user) return socket.emit('auth-result', { ok: false, message: 'Conta não encontrada. Clique em Criar conta primeiro.' });
   const candidate = hashPassword(password, user.salt);
   if (!safeEqual(candidate, user.passwordHash)) { attempts.push(now); authAttempts.set(ip, attempts); return socket.emit('auth-result', { ok: false, message: 'Senha incorreta para este nickname.' }); }
  }
  socket.data.nickname = user.nickname; socket.data.userKey = key;
  socket.emit('auth-result', { ok: true, mode, ...publicUser(user) });
 });
 socket.on('join-world', () => {
  if (!socket.data.nickname) return socket.emit('server-message', 'Entre com sua conta para participar do modo online.');
  if (socket.data.joined) return;
  socket.data.joined = true; socket.join('abyss');
  const p = { id: socket.id, nickname: socket.data.nickname, x: .5, y: .5, angle: 0, color: '#bd91ff' }; worldPlayers.set(socket.id, p);
  if (!worldHostId) worldHostId = socket.id; io.to('abyss').emit('world-host', { id: worldHostId }); socket.emit('world-players', [...worldPlayers.values()]); socket.to('abyss').emit('player-joined', p);
  io.to('abyss').emit('server-message', `${socket.data.nickname} entrou nas profundezas.`); broadcastOnline();
 });
 socket.on('leave-world', () => {
  if (!socket.data.joined) return;
  socket.data.joined = false;
  const oldHost = worldHostId;
  worldPlayers.delete(socket.id);
  if(worldPlayers.size===0) latestWorldSnapshot=null;
  socket.leave('abyss');
  if (oldHost === socket.id) {
   worldHostId = worldPlayers.keys().next().value || null;
   if (worldHostId) io.to('abyss').emit('world-host', { id: worldHostId });
  }
  socket.to('abyss').emit('player-left', socket.id);
  io.to('abyss').emit('world-players', [...worldPlayers.values()]);
  if (socket.data.nickname) io.to('abyss').emit('server-message', `${socket.data.nickname} encerrou o mergulho.`);
  socket.emit('world-left');
 });
 socket.on('player-position', payload => { if (!socket.data.joined || !payload || typeof payload !== 'object') return; const p = worldPlayers.get(socket.id); if (!p) return; p.x = Math.max(.02, Math.min(.98, Number(payload.x) || .5)); p.y = Math.max(.02, Math.min(.98, Number(payload.y) || .5)); p.angle = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, Number(payload.angle) || 0)); const color = String(payload.color || '#bd91ff'); p.color = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#bd91ff'; io.to('abyss').emit('world-players', [...worldPlayers.values()]); });
 socket.on('player-hit', payload => { if (!socket.data.joined || !payload) return; const x = Number(payload.x), y = Number(payload.y), damage = Number(payload.damage); if (![x,y,damage].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1 || damage < 0 || damage > 1000) return; socket.to('abyss').emit('remote-hit', { x, y, damage, from: socket.data.nickname }); });
 socket.on('game-snapshot', payload => { if (!socket.data.joined || socket.id !== worldHostId || !payload || !Array.isArray(payload.enemies)) return; const enemies = payload.enemies.slice(0, 120).map(e => ({ id: Number(e.id), x: Math.max(0, Math.min(1, Number(e.x) || 0)), y: Math.max(0, Math.min(1, Number(e.y) || 0)), r: Math.max(0.002, Math.min(0.2, Number(e.r) || 0.02)), hp: Math.max(0, Math.min(1e8, Number(e.hp) || 0)), maxHp: Math.max(1, Math.min(1e8, Number(e.maxHp) || 1)), speed: Math.max(0, Math.min(500, Number(e.speed) || 0)), damage: Math.max(0, Math.min(10000, Number(e.damage) || 0)), color: /^#[0-9a-fA-F]{6}$/.test(String(e.color)) ? e.color : '#ff769d', value: Math.max(0, Math.min(100000, Number(e.value) || 0)), angle: Number(e.angle) || 0, phase: Number(e.phase) || 0, hit: Number(e.hit) || 0, attackCd: Number(e.attackCd) || 0, kind: String(e.kind || 'drifter').slice(0, 20) })); latestWorldSnapshot = { hostId: socket.id, elapsed: Math.max(0, Math.min(86400, Number(payload.elapsed) || 0)), enemies }; io.to('abyss').emit('game-snapshot', latestWorldSnapshot); });
 socket.on('request-host-state', () => { if(socket.data.joined && socket.id===worldHostId && latestWorldSnapshot) socket.emit('host-state', latestWorldSnapshot); });
 socket.on('request-host-transfer', () => { if(!socket.data.joined || socket.id!==worldHostId || worldPlayers.size<2) return; const next=[...worldPlayers.keys()].find(id=>id!==socket.id); if(!next) return; worldHostId=next; io.to('abyss').emit('world-host',{id:worldHostId}); if(latestWorldSnapshot) io.to(worldHostId).emit('host-state',latestWorldSnapshot); });
 socket.on('shared-shot', payload => { if (!socket.data.joined || !payload) return; const x=Number(payload.x), y=Number(payload.y), vx=Number(payload.vx), vy=Number(payload.vy); if (![x,y,vx,vy].every(Number.isFinite) || x<0 || x>1 || y<0 || y>1 || Math.abs(vx)>1500 || Math.abs(vy)>1500) return; io.to('abyss').emit('shared-shot', { x,y,vx,vy,color:/^#[0-9a-fA-F]{6}$/.test(String(payload.color))?payload.color:'#9bbcff', damage:Math.max(0,Math.min(1000,Number(payload.damage)||0)), special:['pierce','electric','ricochet'].includes(payload.special)?payload.special:null, from:socket.data.nickname, at:Date.now() }); });
 socket.on('shared-damage', payload => { if (!socket.data.joined || !payload) return; const id=Number(payload.id), damage=Number(payload.damage); if (!Number.isFinite(id) || !Number.isFinite(damage) || damage<0 || damage>1000) return; if (socket.id===worldHostId) return; io.to(worldHostId).emit('shared-damage', { id, damage, from: socket.data.nickname }); });
 socket.on('shared-xp-award', payload => { if (!socket.data.joined || socket.id !== worldHostId || !payload) return; const value = Number(payload.value); if (!Number.isFinite(value) || value <= 0 || value > 10000) return; io.to('abyss').emit('shared-xp-award', { value: Math.round(value), source: String(payload.source || 'enemy').slice(0, 20) }); });
 socket.on('get-rankings', () => socket.emit('rankings-data', rankingPayload()));
 socket.on('get-account', () => { const u = users[socket.data.userKey]; if (u) socket.emit('account-data', publicUser(u)); });
 socket.on('save-cosmetics', payload => { const u = users[socket.data.userKey]; if (!u || !payload) return; const allowed = new Set(['default','violet','solar','toxic','leviathan','thorn','abyssking']); u.ownedSkins = [...new Set(['default', ...(u.ownedSkins || []).filter(x => allowed.has(x))])]; if (u.ownedSkins.includes(payload.equippedSkin)) u.equippedSkin = payload.equippedSkin; saveUsers(); socket.emit('account-data', publicUser(u)); });
 socket.on('purchase-skin', payload => { const u = users[socket.data.userKey]; if (!u || !payload) return; const prices = { violet:1000, solar:2500, toxic:4000, leviathan:6500, thorn:8000, abyssking:10000 }; const id = String(payload.id || ''), price = prices[id]; if (!price) return socket.emit('purchase-result', { ok:false, message:'Skin indisponível para compra com moedas.' }); if ((u.ownedSkins || ['default']).includes(id)) return socket.emit('purchase-result', { ok:true, message:'Você já possui esta skin.', account:publicUser(u) }); if ((u.coins || 0) < price) return socket.emit('purchase-result', { ok:false, message:'Moedas abissais insuficientes.', account:publicUser(u) }); u.coins -= price; u.ownedSkins = [...(u.ownedSkins || ['default']), id]; u.equippedSkin = id; saveUsers(); socket.emit('purchase-result', { ok:true, message:'Skin desbloqueada e salva na conta!', account:publicUser(u) }); });
 socket.on('submit-run', payload => {
  const key = socket.data.userKey, user = users[key]; if (!key || !user || !payload) return;
  const survival = Math.max(0, Math.min(86400, Number(payload.survival) || 0)), score = Math.max(0, Math.min(1e9, Number(payload.score) || 0)), level = Math.max(1, Math.min(9999, Number(payload.level) || 1));
  if (survival < 1) return; settlePeriods(); const entry = { key, nickname: user.nickname, survival: Math.round(survival), score: Math.round(score), level, updatedAt: new Date().toISOString() };
  const put = board => { const old = board[key]; if (!old || survival > old.survival || (survival === old.survival && score > old.score)) board[key] = entry; };
  rankings.eternal ||= {}; rankings.daily[dayKey()] ||= {}; rankings.weekly[weekKey()] ||= {}; put(rankings.eternal); put(rankings.daily[dayKey()]); put(rankings.weekly[weekKey()]); saveRanks();
  const earned = Math.max(5, Math.floor(score / 35) + level * 2); user.coins = (user.coins || 0) + earned; saveUsers(); socket.emit('run-saved', { earned, account: publicUser(user), rankings: rankingPayload() }); io.emit('rankings-updated', rankingPayload());
 });
 socket.on('disconnect', () => { if (worldPlayers.has(socket.id)) { worldPlayers.delete(socket.id); if(worldPlayers.size===0) latestWorldSnapshot=null; if (worldHostId === socket.id) { worldHostId = worldPlayers.keys().next().value || null; if (worldHostId) io.to('abyss').emit('world-host', { id: worldHostId }); } socket.to('abyss').emit('player-left', socket.id); if (socket.data.nickname) io.to('abyss').emit('server-message', `${socket.data.nickname} deixou as profundezas.`); } broadcastOnline(); });
});
setInterval(settlePeriods, 60 * 60 * 1000).unref();
server.listen(PORT, '0.0.0.0', () => { settlePeriods(); console.log(`Abyssal online em http://localhost:${PORT}`); });
