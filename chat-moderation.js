'use strict';
const crypto=require('node:crypto');
const CHAT_REASONS=new Set(['bullying','hate','sexual_content','personal_information','threat','child_safety','spam','other']);
const ACTIONS={
 chat:['dismiss','needs_followup','remove_message','warn','mute_24h','mute_7d','ban_chat','suspend_online_7d'],
 profile:['dismiss','needs_followup','warn','suspend_online_7d'],
 cardume:['dismiss','needs_followup','remove_cardume_content']
};
const ACTION_LABELS={warn:'Advertência',mute_24h:'Chat silenciado por 24 horas',mute_7d:'Chat silenciado por 7 dias',ban_chat:'Acesso ao chat suspenso por tempo indeterminado',suspend_online_7d:'Multiplayer suspenso por 7 dias'};
const schemas=new WeakMap();
function authenticatedUser(users,token){
 if(!token||!/^[a-f0-9]{64}$/i.test(token))return null;
 const hash=crypto.createHash('sha256').update(token).digest('hex'),now=Date.now();
 for(const [key,user] of Object.entries(users||{}))if((user.sessionTokens||[]).some(x=>x&&Number(x.expiresAt)>now&&x.hash===hash))return {key,user};
 return null;
}
async function ensureModerationSchema(pool){
 if(!schemas.has(pool))schemas.set(pool,pool.query(`
 CREATE TABLE IF NOT EXISTS abyssal_chat_reports (
 report_id TEXT PRIMARY KEY, reporter_key TEXT NOT NULL, reported_key TEXT NOT NULL, message_id TEXT NOT NULL,
 message_nickname TEXT NOT NULL, message_text TEXT NOT NULL, reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 closed_at TIMESTAMPTZ, moderator_key TEXT, resolution TEXT);
 ALTER TABLE abyssal_chat_reports ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'chat';
 ALTER TABLE abyssal_chat_reports ADD COLUMN IF NOT EXISTS target_account_id TEXT;
 ALTER TABLE abyssal_chat_reports ADD COLUMN IF NOT EXISTS target_id TEXT;
 ALTER TABLE abyssal_chat_reports ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT '';
 ALTER TABLE abyssal_chat_reports ADD COLUMN IF NOT EXISTS match_id TEXT NOT NULL DEFAULT '';
 CREATE UNIQUE INDEX IF NOT EXISTS abyssal_chat_reports_once_idx ON abyssal_chat_reports(reporter_key,message_id);
 CREATE INDEX IF NOT EXISTS abyssal_chat_reports_queue_idx ON abyssal_chat_reports(status,created_at);
 CREATE TABLE IF NOT EXISTS abyssal_chat_moderation_audit (
 audit_id TEXT PRIMARY KEY, report_id TEXT NOT NULL, moderator_key TEXT NOT NULL,
 action TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 `).catch(e=>{schemas.delete(pool);throw e;}));
 await schemas.get(pool);
}
async function cleanup(pool){
 await ensureModerationSchema(pool);
 await pool.query("DELETE FROM abyssal_chat_reports WHERE status IN ('dismissed','actioned') AND closed_at < NOW()-INTERVAL '180 days'; DELETE FROM abyssal_chat_moderation_audit WHERE created_at < NOW()-INTERVAL '180 days';");
}
async function recordReport(pool,data){
 if(!pool)return {ok:false,status:503,message:'Denúncias exigem armazenamento seguro. Tente novamente mais tarde.'};
 await ensureModerationSchema(pool);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[data.reporterKey]);
  const duplicate=await client.query(`SELECT report_id FROM abyssal_chat_reports WHERE reporter_key=$1 AND
   ((report_type='chat' AND message_id=$2) OR (report_type=$3 AND report_type<>'chat' AND target_id=$4 AND reason=$5 AND match_id=$6 AND created_at>NOW()-INTERVAL '1 hour')) LIMIT 1`,
   [data.reporterKey,data.messageId||'',data.type,data.targetId||'',data.reason,data.matchId||'']);
  if(duplicate.rowCount){await client.query('ROLLBACK');return {ok:false,status:409,reportId:duplicate.rows[0].report_id,message:'Você já registrou esta denúncia recentemente.'};}
  const recent=await client.query("SELECT COUNT(*)::int AS total FROM abyssal_chat_reports WHERE reporter_key=$1 AND created_at>NOW()-INTERVAL '1 hour'",[data.reporterKey]);
  if(Number(recent.rows[0]?.total||0)>=10){await client.query('ROLLBACK');return {ok:false,status:429,message:'Limite de denúncias atingido. Tente novamente mais tarde.'};}
  const id=crypto.randomUUID();
  await client.query('INSERT INTO abyssal_chat_reports(report_id,reporter_key,reported_key,message_id,message_nickname,message_text,reason,report_type,target_account_id,target_id,details,match_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
   [id,data.reporterKey,data.reportedKey||'',data.messageId||id,String(data.label||'').slice(0,80),String(data.snapshot||'').slice(0,3000),data.reason,data.type,data.accountId||null,data.targetId||null,String(data.details||'').slice(0,800),data.matchId||'']);
  await client.query('COMMIT');
  return {ok:true,reportId:id,message:'Denúncia registrada para análise.'};
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
}
function registerChatModerationRoutes({app,getUsers,saveUsers,flushPersistence,getPool,getChatMessage,removeMessage,isDeveloper,applyCardumeAction,onOnlineSuspended,notifyAccount,notifyReport}){
 const json=require('express').json({limit:'4kb'});
 const timer=setInterval(()=>{const p=getPool();if(p)cleanup(p).catch(e=>console.error('[moderation] cleanup:',e.message));},86400000);timer.unref?.();
 function auth(req){const h=String(req.headers.authorization||'');return authenticatedUser(getUsers(),h.startsWith('Bearer ')?h.slice(7):'');}
 function isModerator(a){const allow=new Set(String(process.env.ABYSSAL_MODERATOR_USER_KEYS||'').split(',').map(v=>v.trim()).filter(Boolean));return Boolean(a&&(allow.has(a.key)||isDeveloper?.(a.user)));}
 app.post('/api/chat/reports',json,async(req,res)=>{
  const reporter=auth(req);if(!reporter)return res.status(401).json({ok:false,message:'Entre na sua conta para denunciar.'});
  const messageId=String(req.body?.messageId||''),reason=String(req.body?.reason||''),details=String(req.body?.details||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,800);
  if(!/^[a-f0-9-]{36}$/i.test(messageId)||!CHAT_REASONS.has(reason))return res.status(400).json({ok:false,message:'Denúncia inválida.'});
  if(!getPool())return res.status(503).json({ok:false,message:'Armazenamento indisponível. Tente novamente.'});
  try{
   const m=await getChatMessage(reporter.key,messageId);
   if(!m||m.senderKey===reporter.key)return res.status(404).json({ok:false,message:'Mensagem indisponível para denúncia.'});
   const r=await recordReport(getPool(),{type:'chat',reporterKey:reporter.key,reportedKey:m.senderKey,accountId:m.senderAccountId,messageId:m.id,targetId:m.id,label:m.nickname,snapshot:m.text,reason,details});
   res.status(r.ok?201:r.status||503).set('Cache-Control','no-store').json(r);
   if(r.ok&&notifyReport)Promise.resolve(notifyReport({reportId:r.reportId,type:'chat',reason,label:m.nickname})).catch(e=>console.error('[moderation] email:',e.message));
  }catch(e){console.error('[moderation] report:',e.message);return res.status(503).json({ok:false,message:'Não foi possível registrar a denúncia.'});}
 });
 app.get('/api/moderation/chat/reports',async(req,res)=>{
  const moderator=auth(req);if(!isModerator(moderator))return res.status(403).json({ok:false,message:'Acesso restrito à moderação.'});
  const p=getPool();if(!p)return res.status(503).json({ok:false,message:'Banco de dados indisponível.'});
  try{
   await ensureModerationSchema(p);
   const history=req.query?.history==='1';
   const result=await p.query(`SELECT r.report_id,r.report_type,r.message_nickname,r.message_text,r.reason,r.details,r.match_id,r.status,r.created_at,r.closed_at,r.resolution,
    a.action AS last_action,
    (SELECT count(*)::int FROM abyssal_chat_reports x WHERE x.status='actioned' AND x.report_id<>r.report_id AND ((r.target_account_id IS NOT NULL AND x.target_account_id=r.target_account_id) OR (r.report_type='cardume' AND x.report_type='cardume' AND x.target_id=r.target_id))) AS previous_actions
    FROM abyssal_chat_reports r LEFT JOIN LATERAL (SELECT action FROM abyssal_chat_moderation_audit WHERE report_id=r.report_id ORDER BY created_at DESC LIMIT 1) a ON true
    WHERE r.status = ANY($1::text[]) ORDER BY
    CASE WHEN r.reason IN ('threat','sexual_content','personal_information','conteudo-ilegal','dados-pessoais','ameaca','conteudo-sexual','seguranca-menor','child_safety') THEN 0 ELSE 1 END,
    CASE WHEN $2 THEN -EXTRACT(EPOCH FROM r.created_at) ELSE EXTRACT(EPOCH FROM r.created_at) END LIMIT 100`,
    [history?['dismissed','actioned']:['open','followup'],history]);
   const reports=result.rows.map(r=>({...r,actions:ACTIONS[r.report_type]||['dismiss','needs_followup']}));
   return res.set('Cache-Control','no-store').json({ok:true,reports});
  }catch(e){console.error('[moderation] queue:',e.message);return res.status(503).json({ok:false,message:'Não foi possível carregar a fila.'});}
 });
 app.post('/api/moderation/chat/reports/:id/resolve',json,async(req,res)=>{
  const moderator=auth(req);if(!isModerator(moderator))return res.status(403).json({ok:false,message:'Acesso restrito à moderação.'});
  const action=String(req.body?.action||''),note=String(req.body?.note||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,300),p=getPool();
  if(!p)return res.status(503).json({ok:false,message:'Banco de dados indisponível.'});
  let client;
  try{
   await ensureModerationSchema(p);client=await p.connect();await client.query('BEGIN');
   const result=await client.query("SELECT * FROM abyssal_chat_reports WHERE report_id=$1 AND status IN ('open','followup') FOR UPDATE",[String(req.params.id||'')]);
   const report=result.rows[0];
   if(!report){await client.query('ROLLBACK');return res.status(404).json({ok:false,message:'Denúncia indisponível ou já encerrada.'});}
   if(!(ACTIONS[report.report_type]||[]).includes(action)){await client.query('ROLLBACK');return res.status(400).json({ok:false,message:'Ação incompatível com esta denúncia.'});}
   const target=getUsers()[report.reported_key],userAction=Object.hasOwn(ACTION_LABELS,action);
   if(userAction&&(!target||!report.target_account_id||target.accountId!==report.target_account_id||isDeveloper?.(target))){
    await client.query('ROLLBACK');return res.status(409).json({ok:false,message:'Identidade do alvo não confirmada ou conta protegida. Revise manualmente; é possível remover a mensagem sem punir a conta.'});
   }
   if(action==='remove_cardume_content'){const ok=await applyCardumeAction?.(report.target_id);if(!ok){await client.query('ROLLBACK');return res.status(409).json({ok:false,message:'Cardume indisponível.'});}}
   if(userAction){
    target.moderationNotices=Array.isArray(target.moderationNotices)?target.moderationNotices:[];
    if(!target.moderationNotices.some(n=>n.reportId===report.report_id)){
     const now=Date.now();
     if(action==='warn'){target.chatWarnings=Math.min(100,(Number(target.chatWarnings)||0)+1);target.chatLastViolationAt=now;}
     if(action==='mute_24h'||action==='mute_7d'||action==='suspend_online_7d')target.chatMutedUntil=Math.max(Number(target.chatMutedUntil)||0,now+(action==='mute_24h'?1:7)*86400000);
     if(action==='ban_chat'){target.chatBanned=true;}
     if(action==='suspend_online_7d')target.onlineSuspendedUntil=Math.max(Number(target.onlineSuspendedUntil)||0,now+7*86400000);
     target.moderationNotices.unshift({reportId:report.report_id,action,label:ACTION_LABELS[action],at:now});
     target.moderationNotices=target.moderationNotices.filter(n=>now-Number(n.at)<180*86400000).slice(0,100);
     saveUsers();await flushPersistence?.();
    }
    if(action==='suspend_online_7d')await onOnlineSuspended?.(report.reported_key);
   }
   if(report.report_type==='chat'&&(userAction||action==='remove_message'))await removeMessage?.(report.message_id);
   const status=action==='dismiss'?'dismissed':action==='needs_followup'?'followup':'actioned';
   await client.query("UPDATE abyssal_chat_reports SET status=$2,closed_at=CASE WHEN $2='followup' THEN NULL ELSE NOW() END,moderator_key=$3,resolution=$4 WHERE report_id=$1",[report.report_id,status,moderator.key,note||action]);
   await client.query('INSERT INTO abyssal_chat_moderation_audit(audit_id,report_id,moderator_key,action,note) VALUES($1,$2,$3,$4,$5)',[crypto.randomUUID(),report.report_id,moderator.key,action,note]);
   await client.query('COMMIT');client.release();client=null;
   if(userAction)notifyAccount?.(report.reported_key);
   return res.json({ok:true,status,message:'Decisão registrada.'});
  }catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});console.error('[moderation] resolve:',e.message);return res.status(503).json({ok:false,message:'Não foi possível concluir a análise. Verifique e tente novamente.'});}finally{client?.release();}
 });
}
module.exports={registerChatModerationRoutes,ensureModerationSchema,recordReport,ACTIONS};
