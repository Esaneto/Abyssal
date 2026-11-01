'use strict';
const crypto=require('crypto');

function registerAccountRecoveryRoutes({app,getUsers,saveUsers,io}){
 const json=require('express').json({limit:'8kb'}),requests=new Map();
 const generic={ok:true,message:'Se a conta tiver um email de recuperação, enviaremos instruções.'};
 function allowRequest(key){
  const now=Date.now(),recent=(requests.get(key)||[]).filter(time=>now-time<60*60*1000);
  if(recent.length>=5){requests.set(key,recent);return false;}
  recent.push(now);requests.set(key,recent);if(requests.size>5000)for(const [id,times] of requests)if(!times.some(time=>now-time<60*60*1000))requests.delete(id);
  return true;
 }
 async function sendResetEmail(email,url){
  const apiKey=String(process.env.SENDGRID_API_KEY||''),from=String(process.env.RECOVERY_FROM_EMAIL||'');
  if(!apiKey||!from)return false;
  const response=await fetch('https://api.sendgrid.com/v3/mail/send',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({personalizations:[{to:[{email}]}],from:{email:from},reply_to:{email:'abyssalelectrongames@gmail.com'},subject:'Redefinição de senha do Abyssal / Abyssal password reset',content:[{type:'text/plain',value:`Para redefinir sua senha, acesse este link em até 20 minutos: ${url}\n\nIf you did not request a reset, ignore this message.`}]})});
  return response.ok;
 }
 app.post('/api/account/password-reset/request',json,async(req,res)=>{
  const ip=String(req.ip||req.socket?.remoteAddress||'unknown').slice(0,120);
  if(!allowRequest(`ip:${ip}`))return res.status(202).set('Cache-Control','no-store').json(generic);
  const email=String(req.body?.email||'').trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(202).set('Cache-Control','no-store').json(generic);
  const emailHash=crypto.createHash('sha256').update(email).digest('hex');
  if(!allowRequest(`email:${emailHash}`))return res.status(202).set('Cache-Control','no-store').json(generic);
  const user=Object.values(getUsers()).find(item=>String(item?.email||'').trim().toLowerCase()===email);
  const base=String(process.env.PUBLIC_BASE_URL||'').replace(/\/$/,'');
  if(user&&base){
   try{
    const baseUrl=new URL(base);
    if(baseUrl.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(baseUrl.hostname))throw new Error('recovery-url-requires-https');
    const token=crypto.randomBytes(32).toString('hex'),expiresAt=Date.now()+20*60*1000;
    const link=new URL('/',baseUrl);link.hash=new URLSearchParams({passwordResetToken:token}).toString();
    if(await sendResetEmail(email,link.toString())){user.passwordReset={hash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt};saveUsers();}
   }catch(error){console.error('[account-recovery] email delivery unavailable:',error.message);}
  }
  res.status(202).set('Cache-Control','no-store').json(generic);
 });
 app.post('/api/account/password-reset/complete',json,(req,res)=>{
  const token=String(req.body?.token||''),password=String(req.body?.password||'');
  if(!/^[a-f0-9]{64}$/i.test(token)||password.length<8||password.length>128)return res.status(400).set('Cache-Control','no-store').json({ok:false,message:'Link inválido ou senha fora do limite (8–128 caracteres).'});
  const digest=crypto.createHash('sha256').update(token).digest('hex'),now=Date.now();
  const entry=Object.entries(getUsers()).find(([,user])=>user?.passwordReset&&Number(user.passwordReset.expiresAt)>now&&user.passwordReset.hash===digest);
  if(!entry)return res.status(400).set('Cache-Control','no-store').json({ok:false,message:'Este link expirou ou já foi usado. Solicite outro.'});
  const [key,user]=entry,salt=crypto.randomBytes(16).toString('hex');
  user.salt=salt;user.passwordHash=crypto.scryptSync(password,salt,64).toString('hex');delete user.passwordReset;
  user.sessionTokens=[];saveUsers();
  if(io)for(const socket of io.sockets.sockets.values())if(socket.data.userKey===key){socket.emit('account-force-logout');socket.disconnect(true);}
  res.set('Cache-Control','no-store').json({ok:true,message:'Senha atualizada. Entre com a nova senha.'});
 });
}

module.exports={registerAccountRecoveryRoutes};
