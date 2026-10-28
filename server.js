const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e5 });
const PORT = Number(process.env.PORT || 3000);

// Configuração do Banco de Dados SQLite (Gratuito e Local)
const dbPath = path.join(__dirname, 'data', 'abyssal.db');
const fs = require('fs');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Erro ao abrir o banco de dados:', err.message);
  else console.log('Conectado ao banco de dados SQLite com sucesso.');
});

// Criar tabela de usuários se não existir
db.run(`CREATE TABLE IF NOT EXISTS users (
  nickname TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  coins INTEGER DEFAULT 0,
  owned_skins TEXT DEFAULT '["default"]',
  equipped_skin TEXT DEFAULT 'default'
)`);

function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function safeEqual(a, b) { const aa = Buffer.from(a, 'hex'), bb = Buffer.from(b, 'hex'); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); }
function publicUser(u) { return { nickname: u.nickname, coins: u.coins || 0, ownedSkins: JSON.parse(u.owned_skins || '["default"]'), equippedSkin: u.equipped_skin || 'default' }; }

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'abyssal-server' }));

io.on('connection', socket => {
 socket.data.nickname = null;
 
 socket.on('authenticate', (payload = {}) => {
  const nickname = String(payload.nickname || '').trim();
  const password = String(payload.password || '');
  if (!/^[a-zA-Z0-9_]{3,18}$/.test(nickname) || password.length < 8) {
    return socket.emit('auth-result', { ok: false, message: 'Nickname inválido (3-18 chars) ou senha menor que 8 caracteres.' });
  }
  
  const mode = payload.mode === 'register' ? 'register' : 'login';

  db.get(`SELECT * FROM users WHERE nickname = ?`, [nickname], (err, user) => {
    if (err) return socket.emit('auth-result', { ok: false, message: 'Erro no servidor.' });

    if (mode === 'register') {
      if (user) return socket.emit('auth-result', { ok: false, message: 'Este nickname já existe. Escolha outro ou clique em Entrar.' });
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      db.run(`INSERT INTO users (nickname, password_hash, salt, coins, owned_skins, equipped_skin) VALUES (?, ?, ?, 0, '["default"]', 'default')`,
        [nickname, passwordHash, salt], (err) => {
          if (err) return socket.emit('auth-result', { ok: false, message: 'Erro ao criar conta.' });
          socket.data.nickname = nickname;
          socket.emit('auth-result', { ok: true, mode, nickname, coins: 0, ownedSkins: ['default'], equippedSkin: 'default' });
        }
      );
    } else {
      if (!user) return socket.emit('auth-result', { ok: false, message: 'Conta não encontrada. Crie uma conta primeiro.' });
      const candidate = hashPassword(password, user.salt);
      if (!safeEqual(candidate, user.password_hash)) {
        return socket.emit('auth-result', { ok: false, message: 'Senha incorreta.' });
      }
      socket.data.nickname = user.nickname;
      socket.emit('auth-result', { ok: true, mode, ...publicUser(user) });
    }
  });
 });

 socket.on('save-cosmetics', payload => {
  if (!socket.data.nickname || !payload) return;
  const equipped = String(payload.equippedSkin || 'default');
  db.run(`UPDATE users SET equipped_skin = ? WHERE nickname = ?`, [equipped, socket.data.nickname]);
 });

 socket.on('purchase-skin', payload => {
  if (!socket.data.nickname || !payload) return;
  const prices = { violet:1000, solar:2500, toxic:4000, leviathan:6500, thorn:8000, abyssking:10000 };
  const id = String(payload.id || ''), price = prices[id];
  if (!price) return socket.emit('purchase-result', { ok:false, message:'Skin indisponível.' });

  db.get(`SELECT * FROM users WHERE nickname = ?`, [socket.data.nickname], (err, user) => {
    if (err || !user) return;
    let owned = JSON.parse(user.owned_skins || '["default"]');
    if (owned.includes(id)) return socket.emit('purchase-result', { ok:true, message:'Você já possui esta skin.', account:publicUser(user) });
    if (user.coins < price) return socket.emit('purchase-result', { ok:false, message:'Moedas insuficientes.', account:publicUser(user) });

    user.coins -= price;
    owned.push(id);
    db.run(`UPDATE users SET coins = ?, owned_skins = ?, equipped_skin = ? WHERE nickname = ?`,
      [user.coins, JSON.stringify(owned), id, socket.data.nickname], () => {
        socket.emit('purchase-result', { ok:true, message:'Skin comprada e salva com sucesso!', account:publicUser({ ...user, owned_skins: JSON.stringify(owned), equipped_skin: id }) });
      }
    );
  });
 });
});

server.listen(PORT, '0.0.0.0', () => {
 console.log(`Servidor rodando na porta ${PORT} com SQLite ativo!`);
});