'use strict';

const crypto = require('crypto');
const GMAdmin=require('./gamemaster-admin');

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
  await pool.query("DELETE FROM abyssal_chat_reports WHERE status IN ('dismissed','actioned') AND closed_at < NOW()-INTERVAL '180 days'; DELETE FROM abyssal_chat_moderation_audit WHERE created_at < NOW()-INTERVAL '180 days';");
}

function registerChatModerationRoutes({ app, getUsers, saveUsers, getPool, getChatMessage, removeMessage, isDeveloper, persistUsers, notifyUser }) {
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
    return Boolean(account && (allowlist.has(account.key) || isDeveloper?.(account.user)));
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
      const message = await getChatMessage(reporter.key,messageId);
      if (!message || message.senderKey === reporter.key) return res.status(404).json({ ok: false, message: 'Mensagem indisponível para denúncia.' });
      const reportId = crypto.randomUUID();
      const inserted = await pool.query(
        "INSERT INTO abyssal_chat_reports(report_id,reporter_key,reported_key,message_id,message_nickname,message_text,reason) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(reporter_key,message_id) DO NOTHING RETURNING report_id",
        [reportId, reporter.key, String(message.senderKey || ''), message.id, String(message.nickname || 'Mergulhador').slice(0,18), String(message.text || '').slice(0,180), reason]
      );
      if (!inserted.rowCount) return res.status(409).set('Cache-Control', 'no-store').json({ ok: false, message: 'Você já denunciou esta mensagem.' });
      return res.status(201).set('Cache-Control', 'no-store').json({ ok: true, message: 'Obrigado por ajudar a manter a comunidade saudável. Sua denúncia será analisada e tomaremos as providências necessárias.' });
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
        "SELECT report_id,reported_key,message_nickname,message_text,reason,status,created_at FROM abyssal_chat_reports WHERE status IN ('open','followup') ORDER BY created_at ASC LIMIT 100"
      );
      return res.set('Cache-Control', 'no-store').json({ ok: true, reports: result.rows });
    } catch (error) {
      console.error('[chat-moderation] Queue lookup failed:', error.message);
      return res.status(503).json({ ok: false, message: 'Não foi possível carregar a fila.' });
    }
  });

  const resolving=new Set();
  app.get('/api/moderation/chat/audit',async(req,res)=>{
    if(!isModerator(auth(req)))return res.status(403).set('Cache-Control','no-store').json({ok:false});
    const pool=getPool();if(!pool)return res.status(503).json({ok:false});
    try{await ensureModerationSchema(pool);const r=await pool.query('SELECT a.audit_id,a.report_id,a.action,a.note,a.created_at,r.message_nickname FROM abyssal_chat_moderation_audit a LEFT JOIN abyssal_chat_reports r ON r.report_id=a.report_id ORDER BY a.created_at DESC LIMIT 100');return res.set('Cache-Control','no-store').json({ok:true,rows:r.rows});}catch{return res.status(503).json({ok:false});}
  });
  app.post('/api/moderation/chat/reports/:id/resolve', json, async (req, res) => {
    const moderator = auth(req);
    if (!isModerator(moderator)) return res.status(403).set('Cache-Control', 'no-store').json({ ok: false, message: 'Acesso restrito à equipe de moderação.' });
    const action = String(req.body?.action || '');
    const note = String(req.body?.note || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
    if (!note || !['dismiss', 'warn', 'mute_24h', 'ban_chat', 'needs_followup'].includes(action)) return res.status(400).json({ ok: false, message: 'Ação de moderação inválida.' });
    const pool = getPool();
    if (!pool) return res.status(503).json({ ok: false, message: 'PostgreSQL indisponível.' });
    const id=String(req.params.id||'');
    if(resolving.has(id))return res.status(409).json({ok:false,message:'Denúncia em análise. Tente novamente.'});
    resolving.add(id);
    let client;
    try {
      await ensureModerationSchema(pool);
      const report=await pool.query("SELECT report_id,reported_key,message_id FROM abyssal_chat_reports WHERE report_id=$1 AND status IN ('open','followup')",[id]);
      if(!report.rowCount)return res.status(404).json({ok:false,message:'Denúncia não encontrada ou já analisada.'});
      const row=report.rows[0],target=getUsers()[row.reported_key],punitive=['warn','mute_24h','ban_chat'].includes(action);
      if(punitive&&(isDeveloper?.(target)||target?.reviewAccount))return res.status(403).json({ok:false,message:'Conta protegida.'});
      // Persist the penalty and receipt before closing the case; never hold a
      // pooled transaction connection while waiting for the account snapshot.
      if(target){
       const receipts=target.chatReportReceipts||{},prior=receipts[id];
       if(prior&&prior!==action)return res.status(409).json({ok:false,message:'Uma medida já foi aplicada. Conclua a mesma ação ou revogue a punição na central.'});
       if(punitive){
        if(!prior){
         GMAdmin.apply(target,{action:action==='mute_24h'?'mute':action==='ban_chat'?'ban-chat':'warn',hours:24,reason:note},{});
         target.chatReportReceipts={...receipts,[id]:action};
        }
        if(persistUsers)await persistUsers();else saveUsers();
        notifyUser?.(row.reported_key,target);
       }
      }
      if(punitive&&removeMessage)await removeMessage(row.message_id);
      client=await pool.connect();
      await client.query('BEGIN');
      const locked=await client.query("SELECT report_id FROM abyssal_chat_reports WHERE report_id=$1 AND status IN ('open','followup') FOR UPDATE",[id]);
      if(!locked.rowCount){await client.query('ROLLBACK');return res.status(404).json({ok:false,message:'Denúncia já analisada.'});}
      const status=action==='dismiss'?'dismissed':action==='needs_followup'?'followup':'actioned';
      await client.query("UPDATE abyssal_chat_reports SET status=$2,closed_at=CASE WHEN $2='followup' THEN NULL ELSE NOW() END,moderator_key=$3,resolution=$4 WHERE report_id=$1",[id,status,moderator.key,note]);
      await client.query('INSERT INTO abyssal_chat_moderation_audit(audit_id,report_id,moderator_key,action,note) VALUES($1,$2,$3,$4,$5)',[crypto.randomUUID(),id,moderator.key,action,note]);
      await client.query('COMMIT');
      return res.set('Cache-Control','no-store').json({ok:true,status});
    } catch(error){
      if(client)await client.query('ROLLBACK').catch(()=>{});
      console.error('[chat-moderation] Resolve failed:',error.message);
      return res.status(503).json({ok:false,message:'Não foi possível concluir a análise. Repita a mesma decisão.'});
    } finally {client?.release();resolving.delete(id);}
  });
}

module.exports = { registerChatModerationRoutes, ensureModerationSchema };
