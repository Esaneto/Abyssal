'use strict';
const crypto=require('node:crypto');
const {screenChatMessage,obfuscationView}=require('./chat-safety');
const RULES_VERSION='2026-11-14-cardume-v1';
const QUICK=Object.freeze({ok:'👍',danger:'⚠️',help:'🆘',energy:'🔋',repair:'🔧',attack:'🎯',oxygen:'🫧',retreat:'↩️',follow:'💡',thanks:'🤝',good:'❤️',creature:'🐋'});
function blocked(users,a,b){return a!==b&&Boolean(users[a]?.blockedUsers?.includes(b)||users[b]?.blockedUsers?.includes(a));}
function membership(users,cardumes,key){const u=users[key],c=u&&cardumes[u.cardumeId];return c&&Array.isArray(c.members)&&c.members.includes(key)?c:null;}
function screen(input){
 if(typeof input!=='string'||input.length>180)return {ok:false,reason:'length'};
 const r=screenChatMessage(input,180);if(!r.ok)return r;
 const n=obfuscationView(r.text),compact=n.replace(/\s+/g,'');
 if(/\b(?:discord\.gg|t\.me|wa\.me|bit\.ly|[a-z0-9-]+\.(?:com|net|org|io|gg|br|xyz))\b/i.test(r.text))return {ok:false,reason:'contact_or_link'};
 if(/\b(?:idiota|imbecil|retardado|vadia|arrombado|nigger|faggot|whore|slut|retard|kill yourself|se mata|nudes?|porno|sexo|estupro|rape|pedofilia)\b/i.test(n))return {ok:false,reason:'abuse'};
 if(/(?:caralho|buceta|vaisefoder|vaisefuder|motherfucker|nigger|faggot)/i.test(compact)||/^(?:fdp|pqp|fuck|shit)$/i.test(compact))return {ok:false,reason:'profanity'};
 return r;
}
function penalty(u,reason,now=Date.now()){
 if(['empty','length','repeated_characters'].includes(reason))return 0;
 const prior=now-Number(u.chatLastViolationAt||0)<7*86400000?Number(u.chatWarnings)||0:0;
 u.chatWarnings=Math.min(100,prior+1);u.chatLastViolationAt=now;u.chatLastViolationReason=reason;
 const duration=['threat','grooming_or_off_platform_contact'].includes(reason)?86400000:[0,300000,1800000,86400000][Math.min(3,prior)];
 if(duration)u.chatMutedUntil=Math.max(Number(u.chatMutedUntil)||0,now+duration);return duration;
}
function createCardumeChat({io,getUsers,getCardumes,getPool,saveUsers,getRoom,enabled}){
 let schemaPool=null,schemaPromise=null;
 const rates=new Map(),pending=new Set(),lastText=new Map();
 function rate(key,kind,ms){const now=Date.now(),id=key+':'+kind,last=rates.get(id)||0;if(now-last<ms)return false;rates.set(id,now);return true;}
 const rateTimer=setInterval(()=>{const cutoff=Date.now()-600000;for(const [key,at] of rates)if(at<cutoff)rates.delete(key);for(const [key,v] of lastText)if(v.at<cutoff)lastText.delete(key);},600000);rateTimer.unref?.();
 async function db(){
  const pool=getPool();if(!pool)throw Error('chat storage unavailable');
  if(pool!==schemaPool||!schemaPromise){schemaPool=pool;schemaPromise=pool.query("CREATE TABLE IF NOT EXISTS abyssal_cardume_messages (id TEXT PRIMARY KEY,cardume_id TEXT NOT NULL,sender_key TEXT NOT NULL,nickname TEXT NOT NULL,message_text TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS abyssal_cardume_messages_recent_idx ON abyssal_cardume_messages(cardume_id,created_at DESC);").catch(e=>{schemaPromise=null;throw e;});}
  await schemaPromise;return pool;
 }
 const retention=setInterval(()=>{if(getPool())db().then(pool=>pool.query("DELETE FROM abyssal_cardume_messages WHERE created_at<NOW()-INTERVAL '7 days'")).catch(e=>console.error('[cardume-chat] cleanup:',e.message));},3600000);retention.unref?.();
 const visible=row=>({id:row.id,cardumeId:row.cardume_id,nickname:row.nickname,text:row.message_text,at:new Date(row.created_at).getTime()});
 const members=key=>enabled()?membership(getUsers(),getCardumes(),key):null;
 const allowed=(key,c)=>Boolean(key&&members(key)?.id===c.id);
 async function history(key,c){const pool=await db(),r=await pool.query("SELECT * FROM abyssal_cardume_messages WHERE cardume_id=$1 AND created_at>=NOW()-INTERVAL '7 days' ORDER BY created_at DESC,id DESC LIMIT 50",[c.id]);return allowed(key,c)?r.rows.reverse().filter(row=>!blocked(getUsers(),key,row.sender_key)).map(visible):[];}
 async function getChatMessage(reporterKey,id){const c=members(reporterKey);if(!c)return null;const pool=await db(),r=await pool.query("SELECT * FROM abyssal_cardume_messages WHERE id=$1 AND cardume_id=$2 AND created_at>=NOW()-INTERVAL '7 days'",[id,c.id]);if(!allowed(reporterKey,c))return null;const m=r.rows[0];return m?{id:m.id,senderKey:m.sender_key,nickname:m.nickname,text:m.message_text}:null;}
 function attach(socket){
  const key=()=>socket.data.userKey,ack=(cb,data)=>{if(typeof cb==='function')cb(data);};
  socket.on('cardume-chat-history',async(_payload,cb)=>{
   const k=key(),c=members(k);if(!c||!rate(k,'history',800))return ack(cb,{ok:false,message:'Chat indisponível ou atualização muito rápida.'});
   try{const messages=await history(k,c);if(key()!==k||!allowed(k,c))return ack(cb,{ok:false,message:'Cardume alterado.'});ack(cb,{ok:true,cardumeId:c.id,messages,accepted:getUsers()[k]?.cardumeChatRules===RULES_VERSION});}catch(e){console.error('[cardume-chat] history:',e.message);ack(cb,{ok:false,message:'Chat temporariamente indisponível.'});}
  });
  socket.on('cardume-chat-send',async(payload,cb)=>{
   const k=key(),c=members(k),u=getUsers()[k];if(!c||!u)return ack(cb,{ok:false,message:'Entre em um Cardume para conversar.'});
   if(!rate(k,'send',2000)||pending.has(k))return ack(cb,{ok:false,message:'Aguarde 2 segundos antes de enviar outra mensagem.'});
   if(u.chatBanned||Number(u.chatMutedUntil)>Date.now())return ack(cb,{ok:false,message:'Seu chat está silenciado.',mutedUntil:Number(u.chatMutedUntil)||0});
   if(u.cardumeChatRules!==RULES_VERSION){if(payload?.acceptRules!==true)return ack(cb,{ok:false,message:'Aceite as regras da comunidade para conversar.'});u.cardumeChatRules=RULES_VERSION;saveUsers();}
   const r=screen(payload?.text);if(!r.ok){const duration=penalty(u,r.reason);saveUsers();return ack(cb,{ok:false,message:duration?'Mensagem bloqueada. Chat temporariamente silenciado.':'Mensagem bloqueada. Revise o texto e as regras da comunidade.',mutedUntil:Number(u.chatMutedUntil)||0});}
   const prev=lastText.get(k);if(prev?.text===r.text&&Date.now()-prev.at<30000)return ack(cb,{ok:false,message:'Evite repetir a mesma mensagem.'});
   pending.add(k);
   try{const pool=await db();if(key()!==k||!allowed(k,c))return ack(cb,{ok:false,message:'Cardume alterado.'});
    const id=crypto.randomUUID(),result=await pool.query("INSERT INTO abyssal_cardume_messages(id,cardume_id,sender_key,nickname,message_text) VALUES($1,$2,$3,$4,$5) RETURNING *",[id,c.id,k,u.nickname,r.text]);
    if(key()!==k||!allowed(k,c)){await pool.query('DELETE FROM abyssal_cardume_messages WHERE id=$1',[id]);return ack(cb,{ok:false,message:'Cardume alterado.'});}
    lastText.set(k,{text:r.text,at:Date.now()});
    await pool.query("DELETE FROM abyssal_cardume_messages WHERE cardume_id=$1 AND id IN (SELECT id FROM abyssal_cardume_messages WHERE cardume_id=$1 ORDER BY created_at DESC,id DESC OFFSET 50)",[c.id]);
    const message=visible(result.rows[0]);for(const client of(io.sockets?.sockets?.values?.()||[])){const recipient=client.data.userKey;if(allowed(recipient,c)&&!blocked(getUsers(),k,recipient))client.emit('cardume-chat-message',message);}ack(cb,{ok:true});
   }catch(e){console.error('[cardume-chat] send:',e.message);ack(cb,{ok:false,message:'Não foi possível enviar a mensagem.'});}finally{pending.delete(k);}
  });
  socket.on('online-quick-emoji',(payload,cb)=>{
   const k=key(),u=getUsers()[k],room=getRoom(socket),id=payload?.id;
   if(!enabled()||!u||!room||!socket.data.joined||!room.players.has(socket.id)||room.players.get(socket.id)?.alive===false||typeof id!=='string'||!Object.hasOwn(QUICK,id)||!rate(k,'emoji',2500))return ack(cb,{ok:false});
   for(const client of(io.sockets?.sockets?.values?.()||[])){const recipient=client.data.userKey;if(recipient&&getRoom(client)===room&&room.players.has(client.id)&&!blocked(getUsers(),k,recipient))client.emit('online-quick-emoji',{id,playerId:socket.id,nickname:u.nickname});}ack(cb,{ok:true});
  });
 }
 async function removeMessage(id){const pool=await db(),r=await pool.query('DELETE FROM abyssal_cardume_messages WHERE id=$1 RETURNING cardume_id',[id]),c=r.rows[0]&&getCardumes()[r.rows[0].cardume_id];if(c)for(const client of(io.sockets?.sockets?.values?.()||[]))if(allowed(client.data.userKey,c))client.emit('cardume-chat-removed',{id,cardumeId:c.id});}
 async function deleteAccount(key){if(!getPool())return;const pool=await db();await pool.query('DELETE FROM abyssal_cardume_messages WHERE sender_key=$1',[key]);lastText.delete(key);}
 return {attach,getChatMessage,removeMessage,deleteAccount};
}
module.exports={createCardumeChat,screen,penalty,membership,blocked,QUICK,RULES_VERSION};
