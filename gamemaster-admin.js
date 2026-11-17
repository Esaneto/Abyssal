'use strict';
const crypto=require('node:crypto');
const DAY=86400000;
const clean=(v,n=300)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
const blocked=(u,now=Date.now())=>!!(u&&(u.adminBanned||Number(u.adminSuspendedUntil)>now));
function accessMessage(u){return 'Acesso online '+(u.adminBanned?'banido permanentemente':'suspenso até '+new Date(Number(u.adminSuspendedUntil)).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))+'. Motivo: '+(u.adminAccessReason||'Violação das regras')+'. Consulte o suporte para contestar.';}
function notices(u,now=Date.now()){return (u.adminNotices||[]).filter(x=>now-Number(x.timestamp)<30*DAY).slice(0,30);}
function notice(u,message,now=Date.now(),title='GAMEMASTER'){u.adminNotices=[{id:crypto.randomUUID(),title:clean(title,100),message:clean(message,600),timestamp:now},...notices(u,now)].slice(0,30);}
const ACTIONS=['warn','mute','unmute','ban-chat','unban-chat','kick','suspend','ban','restore','grant-energy','take-energy','grant-specimen','grant-cosmetic','grant-resource','ranking-exclude','ranking-restore','notice'];
function apply(u,p,c,now=Date.now()){
 const a=clean(p.action,40),reason=clean(p.reason),item=clean(p.item,100),amount=Number(p.amount),hours=Number(p.hours);
 if(!ACTIONS.includes(a)||!reason)throw Error('Ação e motivo são obrigatórios.');
 if(['mute','suspend'].includes(a)&&(!Number.isInteger(hours)||hours<1||hours>2160))throw Error('Duração: 1 a 2160 horas.');
 if(['grant-energy','take-energy','grant-resource'].includes(a)&&(!Number.isSafeInteger(amount)||amount<1||amount>1000000))throw Error('Quantidade: 1 a 1.000.000.');
 let result,before=null,after=null;
 switch(a){
 case 'warn':before=Number(u.chatWarnings)||0;after=Math.min(100,before+1);u.chatWarnings=after;u.chatLastViolationAt=now;result='Advertência registrada';break;
 case 'mute':before=Number(u.chatMutedUntil)||0;after=Math.max(before,now+hours*3600000);u.chatMutedUntil=after;result='Comunicação silenciada até '+new Date(after).toISOString();break;
 case 'unmute':before=Number(u.chatMutedUntil)||0;after=u.chatMutedUntil=0;result='Silenciamento revogado';break;
 case 'ban-chat':before=!!u.chatBanned;after=u.chatBanned=true;result='Comunicação bloqueada';break;
 case 'unban-chat':before=!!u.chatBanned;after=u.chatBanned=false;u.chatMutedUntil=0;result='Comunicação liberada';break;
 case 'kick':result='Remoção da partida';break;
 case 'suspend':if(u.adminBanned)throw Error('Revogue o banimento antes de suspender.');before=Number(u.adminSuspendedUntil)||0;after=u.adminSuspendedUntil=Math.max(before,now+hours*3600000);u.adminAccessReason=reason;u.sessionTokens=[];result='Acesso online suspenso até '+new Date(after).toISOString();break;
 case 'ban':before=!!u.adminBanned;after=u.adminBanned=true;u.adminSuspendedUntil=0;u.adminAccessReason=reason;u.sessionTokens=[];result='Acesso online banido permanentemente';break;
 case 'restore':before={banned:!!u.adminBanned,until:Number(u.adminSuspendedUntil)||0};u.adminBanned=false;u.adminSuspendedUntil=0;u.adminAccessReason='';after=false;result='Acesso online restaurado';break;
 case 'grant-energy':case 'take-energy':before=Math.max(0,Math.floor(Number(u.energy)||0));after=before+(a==='grant-energy'?amount:-amount);if(after<0||after>999999999)throw Error('Saldo fora do limite.');u.energy=after;result=(a==='grant-energy'?'Energia concedida: ':'Energia retirada: ')+amount;break;
 case 'grant-specimen':if(!c.skins.has(item)||item==='default')throw Error('Espécime inválido.');if((u.ownedSkins||[]).includes(item))throw Error('Espécime já adquirido.');u.ownedSkins=[...new Set(['default',...(u.ownedSkins||[]),item])];after=true;result='Espécime concedido: '+item;break;
 case 'grant-cosmetic':if(!c.cosmetics.includes(item))throw Error('Cosmético inválido.');if((u.ownedAvatarCosmetics||[]).includes(item))throw Error('Cosmético já adquirido.');u.ownedAvatarCosmetics=[...new Set([...(u.ownedAvatarCosmetics||[]),item])];after=true;result='Cosmético concedido: '+item;break;
 case 'grant-resource':if(!c.resources.includes(item))throw Error('Recurso inválido.');before=Math.max(0,Math.floor(Number(u.resourceInventory?.[item])||0));after=before+amount;if(after>1000000)throw Error('Limite de inventário excedido.');u.resourceInventory={...(u.resourceInventory||{}),[item]:after};result='Recurso concedido: '+item+' × '+amount;break;
 case 'ranking-exclude':before=!!u.adminRankingExcluded;after=u.adminRankingExcluded=true;result='Conta excluída dos rankings';break;
 case 'ranking-restore':before=!!u.adminRankingExcluded;after=u.adminRankingExcluded=false;result='Participação nos rankings restaurada';break;
 case 'notice':result='Comunicado administrativo';break;
 }
 u.adminUpdatedAt=now;notice(u,result+'. Motivo: '+reason,now);return {action:a,reason,item,amount:Number.isFinite(amount)?amount:null,hours:Number.isFinite(hours)?hours:null,before,after,result};
}
function summary(key,u,online,detail=false){const data={key,nickname:u.nickname,accountId:u.accountId||null,online,energy:Math.max(0,Number(u.energy)||0),warnings:Number(u.chatWarnings)||0,mutedUntil:Number(u.chatMutedUntil)||0,chatBanned:!!u.chatBanned,banned:!!u.adminBanned,suspendedUntil:Number(u.adminSuspendedUntil)||0,rankingExcluded:!!u.adminRankingExcluded,reportCount:Number(u.moderationReportCount)||0};if(detail)Object.assign(data,{ownedSkins:u.ownedSkins||['default'],cosmetics:u.ownedAvatarCosmetics||[],inventory:u.resourceInventory||{},matchHistory:(u.matchHistory||[]).slice(0,10)});return data;}
function createAdmin({getUsers,isDeveloper,persist,onlineKeys,onlineConnections=()=>0,catalog,onAction,inRoom=key=>onlineKeys().has(key)}){
 let busy=false;
 function attach(socket){socket.on('gamemaster-admin',async(p={},ack)=>{
  const reply=x=>{if(typeof ack==='function')ack(x);},fail=message=>reply({ok:false,message});
  const actor=socket.data.userKey,users=getUsers(),gm=users[actor];
  if(actor!=='gamemaster'||!isDeveloper(gm))return fail('Acesso exclusivo do GameMaster.');
  p=p&&typeof p==='object'?p:{};const op=p.op,key=clean(p.target,80).toLowerCase(),u=Object.hasOwn(users,key)?users[key]:null;
  if(op==='online'){
   const keys=[...onlineKeys()].filter(k=>Object.hasOwn(users,k));
   const sorted=keys.sort((a,b)=>String(users[a].nickname||a).localeCompare(String(users[b].nickname||b),'pt-BR'));
   return reply({ok:true,total:sorted.length,connections:Math.max(0,Number(onlineConnections())||0),players:sorted.map(k=>({...summary(k,users[k],true),inGame:Boolean(inRoom(k))}))});
  }
  if(op==='list'){const q=clean(p.query,80).toLowerCase(),offset=Math.max(0,Math.min(100000,Math.floor(Number(p.offset)||0))),online=onlineKeys();const keys=Object.keys(users).filter(k=>k!==actor&&(!q||k.includes(q)||String(users[k].accountId||'').toLowerCase()===q)).sort();return reply({ok:true,total:keys.length,offset,players:keys.slice(offset,offset+30).map(k=>summary(k,users[k],online.has(k)))});}
  if(op==='detail')return u&&key!==actor?reply({ok:true,player:summary(key,u,onlineKeys().has(key),true)}):fail('Jogador não encontrado.');
  if(op==='catalog'){const c=catalog();return reply({ok:true,skins:[...c.skins].filter(x=>x!=='default'),cosmetics:c.cosmetics,resources:c.resources});}
  if(op==='audit')return reply({ok:true,rows:(gm.adminAudit||[]).slice(0,100)});
  if(op==='reports')return reply({ok:true,rows:(gm.adminUgcReports||[]).filter(x=>['open','followup'].includes(x.status)).slice(0,100)});
  if(!['action','resolve-report'].includes(op))return fail('Operação desconhecida.');
  if(busy)return fail('Outra operação em andamento. Tente novamente.');
  const id=clean(p.requestId,80);if(!/^[a-f0-9-]{36}$/i.test(id))return fail('Identificador inválido.');
  const signature=JSON.stringify([op,key,p.action,p.item,p.amount,p.hours,p.reason,p.reportId,p.resolution]);
  const prior=(gm.adminAudit||[]).find(x=>x.id===id);
  busy=true;
  try{
   if(prior){if(prior.signature!==signature)return fail('Identificador já utilizado.');await persist();return reply({ok:true,message:prior.result,duplicate:true});}
   let row;
   if(op==='action'){
    if(!u||key===actor||isDeveloper(u)||u.reviewAccount)return fail('Conta protegida ou inexistente.');
    if(p.action==='kick'&&!inRoom(key))return fail('Jogador não está em uma partida.');
    row={id,signature,at:Date.now(),actor,target:key,nickname:u.nickname,...apply(u,p,catalog())};
   }else{
    const report=(gm.adminUgcReports||[]).find(x=>x.id===p.reportId),reason=clean(p.reason);
    if(!report||!['open','followup'].includes(report.status)||!['dismiss','actioned','followup'].includes(p.resolution)||!reason)return fail('Denúncia ou decisão inválida.');
    report.status=p.resolution;report.resolution=reason;report.moderator=actor;report.closedAt=p.resolution==='followup'?null:Date.now();
    row={id,signature,at:Date.now(),actor,target:report.targetKey,nickname:report.targetLabel,reportId:report.id,action:'report-'+p.resolution,reason,result:'Denúncia atualizada: '+p.resolution};
   }
   gm.adminAudit=[row,...(gm.adminAudit||[])].slice(0,2000);gm.adminUpdatedAt=Date.now();
   if(op==='action')onAction(key,u,row);
   await persist();reply({ok:true,message:row.result});
  }catch(e){fail(e.message||'Falha administrativa.');}finally{busy=false;}
 });}
 return {attach};
}
// A locally known session must respect newer administrative revocations even
// when the persisted token was removed and therefore cannot be found by token.
function syncSessionSnapshot(users,persisted,hasToken,now=Date.now()){
 if(!persisted||typeof persisted!=='object')return;
 const local=Object.entries(users).find(([,u])=>hasToken(u));
 if(local){
  const [key,current]=local,fresh=Object.hasOwn(persisted,key)?persisted[key]:null;
  if(!fresh)return;
  const localAt=Number(current.adminUpdatedAt)||0,freshAt=Number(fresh.adminUpdatedAt)||0;
  if(freshAt>localAt||(freshAt===localAt&&blocked(fresh,now)&&!blocked(current,now))){
   users[key]={...current,...fresh};
  }
  return;
 }
 const found=Object.entries(persisted).find(([,u])=>hasToken(u));
 if(!found)return;
 const [key,fresh]=found,current=Object.hasOwn(users,key)?users[key]:null;
 // Never let a stale database token undo a newer in-process punishment.
 if(current&&(blocked(current,now)||Number(current.adminUpdatedAt||0)>Number(fresh.adminUpdatedAt||0)))return;
 if(!blocked(fresh,now))users[key]={...(current||{}),...fresh};
}
module.exports={createAdmin,apply,blocked,accessMessage,notices,notice,syncSessionSnapshot};
