'use strict';
function registerSupportRoutes({app}){
 const json=require('express').json({limit:'8kb'}),attempts=new Map(),recipient='abyssalelectrongames@gmail.com';
 function allow(ip){
  const now=Date.now(),recent=(attempts.get(ip)||[]).filter(time=>now-time<60*60*1000);
  if(recent.length>=3){attempts.set(ip,recent);return false;}
  recent.push(now);attempts.set(ip,recent);
  if(attempts.size>4000)for(const [key,times] of attempts)if(!times.some(time=>now-time<60*60*1000))attempts.delete(key);
  return true;
 }
 app.post('/api/account-deletion-request',json,async(req,res)=>{
  res.set('Cache-Control','no-store');
  const ip=String(req.ip||req.socket?.remoteAddress||'unknown').slice(0,120);
  if(!allow(ip))return res.status(429).json({ok:false,message:'Muitas solicitações. Aguarde uma hora e tente novamente.'});
  const nickname=String(req.body?.nickname||'').trim().replace(/[\r\n\t]+/g,' ').slice(0,60);
  const email=String(req.body?.email||'').trim().toLowerCase();
  if(!nickname||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return res.status(400).json({ok:false,message:'Informe o nickname e o e-mail vinculados à conta.'});
  const apiKey=String(process.env.SENDGRID_API_KEY||''),from=String(process.env.RECOVERY_FROM_EMAIL||'');
  if(!apiKey||!from)return res.status(503).json({ok:false,message:'O canal de exclusão está temporariamente indisponível.'});
  const textBody=['SOLICITAÇÃO EXTERNA DE EXCLUSÃO DE CONTA ABYSSAL','', 'Nickname: '+nickname,'E-mail informado: '+email,'Data UTC: '+new Date().toISOString(),'','Solicitação iniciada pela página pública de exclusão. Verificar titularidade por método proporcional antes da exclusão.'].join('\n');
  try{
   const payload={personalizations:[{to:[{email:recipient}]}],from:{email:from,name:'Abyssal - Privacidade'},reply_to:{email},subject:'Abyssal | EXCLUSÃO DE CONTA | '+nickname,content:[{type:'text/plain',value:textBody}]};
   const response=await fetch('https://api.sendgrid.com/v3/mail/send',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(!response.ok)return res.status(502).json({ok:false,message:'Não foi possível registrar a solicitação agora.'});
   return res.json({ok:true,message:'Solicitação registrada. O suporte verificará a titularidade e processará a exclusão.'});
  }catch(error){console.error('[privacy] Falha no pedido externo de exclusão:',error.message);return res.status(502).json({ok:false,message:'Falha temporária. Tente novamente.'});}
 });
 app.post('/api/support',json,async(req,res)=>{
  res.set('Cache-Control','no-store');
  const ip=String(req.ip||req.socket?.remoteAddress||'unknown').slice(0,120);
  if(!allow(ip))return res.status(429).json({ok:false,message:'Muitas mensagens enviadas. Aguarde uma hora e tente novamente.'});
  const name=String(req.body?.name||'').trim().replace(/[\r\n\t]+/g,' ').slice(0,60);
  const email=String(req.body?.email||'').trim().toLowerCase();
  const subject=String(req.body?.subject||'Outro assunto').trim().replace(/[\r\n]+/g,' ').slice(0,80);
  const message=String(req.body?.message||'').trim();
  if(String(req.body?.website||'').trim())return res.json({ok:true});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return res.status(400).json({ok:false,message:'Informe um e-mail válido.'});
  if(message.length<10||message.length>2000)return res.status(400).json({ok:false,message:'A mensagem deve ter entre 10 e 2.000 caracteres.'});
  const apiKey=String(process.env.SENDGRID_API_KEY||''),from=String(process.env.RECOVERY_FROM_EMAIL||'');
  if(!apiKey||!from)return res.status(503).json({ok:false,message:'O suporte está temporariamente indisponível. Tente novamente mais tarde.'});
  const textBody=['Nova mensagem de suporte do Abyssal','', 'Nome/Nickname: '+(name||'Não informado'),'E-mail para resposta: '+email,'Assunto: '+subject,'','Mensagem:',message,'','Enviado pelo formulário de suporte do jogo.'].join('\n');
  try{
   const payload={personalizations:[{to:[{email:recipient}]}],from:{email:from,name:'Abyssal - Suporte'},reply_to:{email:email},subject:'Abyssal | Suporte: '+subject,content:[{type:'text/plain',value:textBody}]};
   const response=await fetch('https://api.sendgrid.com/v3/mail/send',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(!response.ok){console.error('[support] SendGrid recusou mensagem; status:',response.status);return res.status(502).json({ok:false,message:'Não foi possível enviar agora. Tente novamente em alguns minutos.'});}
   return res.json({ok:true,message:'Mensagem enviada com sucesso.'});
  }catch(error){console.error('[support] Falha no envio:',error.message);return res.status(502).json({ok:false,message:'Falha temporária no envio. Tente novamente.'});}
 });
}
module.exports={registerSupportRoutes};
