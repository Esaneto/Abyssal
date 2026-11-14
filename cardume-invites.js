'use strict';
const crypto=require('node:crypto');
const TTL=7*86400000;
const rows=v=>Array.isArray(v)?v:[];
function visible(user,users,cardumes,{now=Date.now(),blocked=()=>false}={}){
 if(!user||blocked(user)||(user.cardumeId&&cardumes[user.cardumeId]))return [];
 const key=String(user.nickname||'').toLowerCase();
 return rows(user.cardumeInvites).filter(i=>{
  if(!i||typeof i.id!=='string'||!Number.isFinite(Number(i.at))||now-Number(i.at)>=TTL||Number(i.at)>now)return false;
  const c=cardumes[i.cardumeId],s=users[i.senderKey];
  return Boolean(c&&s&&s.accountId&&s.accountId===i.senderAccountId&&c.open&&c.leader===s.nickname&&c.members.includes(i.senderKey)&&c.members.length<c.capacity&&!c.members.includes(key)&&!blocked(s)&&!s.chatBanned&&!(Number(s.chatMutedUntil)>now)&&!rows(user.blockedUsers).includes(i.senderKey)&&!rows(s.blockedUsers).includes(key));
 }).slice(0,10);
}
function publicInvites(user,users,cardumes,opts){
 return visible(user,users,cardumes,opts).map(i=>({id:i.id,cardumeName:cardumes[i.cardumeId].name,sender:users[i.senderKey].nickname,at:i.at}));
}
function create(target,senderKey,sender,cardume,users,cardumes,opts={}){
 const now=opts.now??Date.now(),active=visible(target,users,cardumes,{...opts,now});
 const existing=active.find(i=>i.cardumeId===cardume.id);
 if(existing)return {ok:true,existing:true,invite:existing};
 if(active.length>=10)return {ok:false,message:'Este jogador atingiu o limite de convites pendentes.'};
 const invite={id:crypto.randomUUID(),cardumeId:cardume.id,senderKey,senderAccountId:sender.accountId,at:now};
 target.cardumeInvites=[invite,...active];
 return {ok:true,invite};
}
function respond(user,id,accept,users,cardumes,opts={}){
 const now=opts.now??Date.now();
 if(typeof accept!=='boolean'||typeof id!=='string'||!id||id.length>80)return {ok:false,message:'Escolha aceitar ou recusar um convite válido.'};
 const receipts=rows(user.cardumeInviteResponses).filter(r=>now-Number(r.at)<TTL).slice(0,20);
 const previous=receipts.find(r=>r.id===id);
 if(previous)return previous.accept===accept?{ok:true,receipt:previous,repeated:true}:{ok:false,message:'Este convite já foi respondido.'};
 const invitation=rows(user.cardumeInvites).find(i=>i.id===id);
 if(!invitation)return {ok:false,message:'Convite indisponível.'};
 const c=cardumes[invitation.cardumeId],key=String(user.nickname||'').toLowerCase();
 if(accept&&!visible(user,users,cardumes,{...opts,now}).some(i=>i.id===id))return {ok:false,message:'O convite expirou ou o Cardume não está mais disponível.'};
 if(accept){c.members.push(key);user.cardumeId=c.id;user.cardumeInvites=[];}
 else user.cardumeInvites=rows(user.cardumeInvites).filter(i=>i.id!==id);
 const receipt={id,accept,cardumeId:invitation.cardumeId,at:now};
 user.cardumeInviteResponses=[receipt,...receipts].slice(0,20);
 return {ok:true,receipt};
}
module.exports={TTL,visible,publicInvites,create,respond};
