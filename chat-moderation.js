'use strict';

const crypto = require('crypto');

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function authenticatedUser(users, token) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = digest(token), now = Date.now();
  for (const [key, user] of Object.entries(users || {})) {
    const sessions = Array.isArray(user.sessionTokens) ? user.sessionTokens : [];
    if (sessions.some(item => item && Number(item.expiresAt) > now && item.hash === tokenHash)) return { key, user };
  }
  return null;
}

async function ensureModerationSchema(pool) {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS abyssal_chat_reports (" +
    "report_id TEXT PRIMARY KEY, reporter_key TEXT NOT NULL, reported_key TEXT NOT NULL, message_id TEXT NOT NULL," +
    "message_nickname TEXT NOT NULL, message_text TEXT NOT NULL, reason TEXT NOT NULL," +
    "status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()," +
    "closed_at TIMESTAMPTZ, moderator_key TEXT, resolution TEXT);" +
    "CREATE UNIQUE INDEX IF NOT EXISTS abyssal_chat_reports_once_idx ON abyssal_chat_reports(reporter_key,message_id);" +
    "CREATE INDEX IF NOT EXISTS abyssal_chat_reports_queue_idx ON abyssal_chat_reports(status,created_at);" +
    "CREATE TABLE IF NOT EXISTS abyssal_chat_moderation_audit (" +
    "audit_id TEXT PRIMARY KEY, report_id TEXT NOT NULL, moderator_key TEXT NOT NULL," +
    "action TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"
  );
  await pool.query("DELETE FROM abyssal_chat_reports WHERE status <> 'open' AND closed_at < NOW()-INTERVAL '180 days'; DELETE FROM abyssal_chat_moderation_audit WHERE created_at < NOW()-INTERVAL '180 days';");
}

function registerChatModerationRoutes({ app, getUsers, saveUsers, getPool, getChatHistory }) {
  const json = require('express').json({ limit: '4kb' });
  const reasons = new Set(['bullying', 'hate', 'sexual_content', 'personal_information', 'threat', 'spam', 'other']);

  const retentionTimer = setInterval(() => {
    const pool = getPool();
    if (pool) ensureModerationSchema(pool).catch(error => console.error('[chat-moderation] Retention cleanup failed:', error.message));
  }, 24 * 60 * 60 * 1000);
  retentionTimer.unref?.();

  function auth(req) {
    const header = String(req.headers.authorization || '');
    return authenticatedUser(getUsers(), header.startsWith('Bearer ') ? header.slice(7) : '');
  }

  function isModerator(account) {
    // Stable internal account keys are used instead of nicknames, which can
    // change and must never be treated as a privileged identity.
    const allowlist = new Set(String(process.env.ABYSSAL_MODERATOR_USER_KEYS || '')
      .split(',').map(value => value.trim()).filter(Boolean));
    return Boolean(account && allowlist.has(account.key));
  }

  app.post('/api/chat/reports', json, async (req, res) => {
    const reporter = auth(req);
    if (!reporter) return res.status(401).set('Cache-Control', 'no-store').json({ ok: false, message: 'Entre na sua conta para denunciar.' });
    const messageId = String(req.body?.messageId || '');
    const reason = String(req.body?.reason || '');
    if (!/^[a-f0-9-]{36}$/i.test(messageId) || !reasons.has(reason)) {
      return res.status(400).set('Cache-Control', 'no-store').json({ ok: false, message: 'Denúncia inválida.' });
    }
    const pool = getPool();
    if (!pool) return res.status(503).set('Cache-Control', 'no-store').json({ ok: false, message: 'Denúncias exigem armazenamento seguro. Tente novamente mais tarde.' });
    try {
      await ensureModerationSchema(pool);
      const recent = await pool.query(
        "SELECT COUNT(*)::int AS total FROM abyssal_chat_reports WHERE reporter_key=$1 AND created_at>NOW()-INTERVAL '1 hour'",
        [reporter.key]
      );
      if (Number(recent.rows[0]?.total || 0) >= 10) return res.status(429).json({ ok: false, message: 'Limite de denúncias atingido. Tente novamente mais tarde.' });
      const message = (getChatHistory() || []).find(item => item && item.id === messageId);
      if (!message || message.senderKey === reporter.key) return res.status(404).json({ ok: false, message: 'Mensagem indisponível para denúncia.' });
      const reportId = crypto.randomUUID();
      const inserted = await pool.query(
        "INSERT INTO abyssal_chat_reports(report_id,reporter_key,reported_key,message_id,message_nickname,message_text,reason) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(reporter_key,message_id) DO NOTHING RETURNING report_id",
        [reportId, reporter.key, String(message.senderKey || ''), message.id, String(message.nickname || 'Mergulhador').slice(0,18), String(message.text || '').slice(0,180), reason]
      );
      if (!inserted.rowCount) return res.status(409).set('Cache-Control', 'no-store').json({ ok: false, message: 'Você já denunciou esta mensagem.' });
      return res.status(201).set('Cache-Control', 'no-store').json({ ok: true, message: 'Denúncia enviada para análise.' });
    } catch (error) {
      console.error('[chat-moderation] Report failed:', error.message);
      return res.status(503).json({ ok: false, message: 'Não foi possível registrar a denúncia.' });
    }
  });

  app.get('/api/moderation/chat/reports', async (req, res) => {
    const moderator = auth(req);
    if (!isModerator(moderator)) return res.status(403).set('Cache-Control', 'no-store').json({ ok: false, message: 'Acesso restrito à equipe de moderação.' });
    const pool = getPool();
    if (!pool) return res.status(503).json({ ok: false, message: 'PostgreSQL indisponível.' });
    try {
      await ensureModerationSchema(pool);
      const result = await pool.query(
        "SELECT report_id,message_nickname,message_text,reason,status,created_at FROM abyssal_chat_reports WHERE status='open' ORDER BY created_at ASC LIMIT 100"
      );
      return res.set('Cache-Control', 'no-store').json({ ok: true, reports: result.rows });
    } catch (error) {
      console.error('[chat-moderation] Queue lookup failed:', error.message);
      return res.status(503).json({ ok: false, message: 'Não foi possível carregar a fila.' });
    }
  });

  app.post('/api/moderation/chat/reports/:id/resolve', json, async (req, res) => {
    const moderator = auth(req);
    if (!isModerator(moderator)) return res.status(403).set('Cache-Control', 'no-store').json({ ok: false, message: 'Acesso restrito à equipe de moderação.' });
    const action = String(req.body?.action || '');
    const note = String(req.body?.note || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
    if (!['dismiss', 'warn', 'mute_24h', 'ban_chat', 'needs_followup'].includes(action)) return res.status(400).json({ ok: false, message: 'Ação de moderação inválida.' });
    const pool = getPool();
    if (!pool) return res.status(503).json({ ok: false, message: 'PostgreSQL indisponível.' });
    const client = await pool.connect();
    try {
      await ensureModerationSchema(pool);
      await client.query('BEGIN');
      const report = await client.query('SELECT report_id,reported_key FROM abyssal_chat_reports WHERE report_id=$1 AND status=\'open\' FOR UPDATE', [String(req.params.id || '')]);
      if (!report.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, message: 'Denúncia não encontrada ou já analisada.' }); }
      const status = action === 'dismiss' ? 'dismissed' : action === 'needs_followup' ? 'followup' : 'actioned';
      const target = getUsers()[report.rows[0].reported_key];
      await client.query('UPDATE abyssal_chat_reports SET status=$2,closed_at=NOW(),moderator_key=$3,resolution=$4 WHERE report_id=$1', [report.rows[0].report_id, status, moderator.key, note || action]);
      await client.query('INSERT INTO abyssal_chat_moderation_audit(audit_id,report_id,moderator_key,action,note) VALUES($1,$2,$3,$4,$5)', [crypto.randomUUID(), report.rows[0].report_id, moderator.key, action, note]);
      await client.query('COMMIT');
      if (target && action === 'warn') { target.chatWarnings = Math.min(100, (Number(target.chatWarnings) || 0) + 1); saveUsers(); }
      if (target && action === 'mute_24h') { target.chatMutedUntil = Date.now() + 24 * 60 * 60 * 1000; saveUsers(); }
      if (target && action === 'ban_chat') { target.chatBanned = true; target.chatMutedUntil = 0; saveUsers(); }
      return res.json({ ok: true, status });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[chat-moderation] Resolve failed:', error.message);
      return res.status(503).json({ ok: false, message: 'Não foi possível concluir a análise.' });
    } finally { client.release(); }
  });
}

module.exports = { registerChatModerationRoutes, ensureModerationSchema };
