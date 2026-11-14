(function(root){
'use strict';
let active=false,panel=null,toggle=null,message=null,pollTimer=null,lastFrame=performance.now(),frames=0;
function fpsLoop(now){frames++;if(now-lastFrame>=500){root.__abyssalFps=Math.round(frames*1000/(now-lastFrame));frames=0;lastFrame=now;}requestAnimationFrame(fpsLoop)}requestAnimationFrame(fpsLoop);
function metric(label,id){return '<div class="dev-metric"><small>'+label+'</small><strong id="'+id+'">-</strong></div>'}
function ensure(){
 if(toggle)return;
 toggle=document.createElement('button');toggle.id='developerToolsToggle';toggle.type='button';toggle.textContent='DEV';toggle.title='Ferramentas GameMaster · F10';
 panel=document.createElement('section');panel.id='developerToolsPanel';panel.hidden=true;panel.innerHTML='<div class="dev-panel-head"><strong>GAMEMASTER · DEV</strong><small>F10</small></div><div class="dev-telemetry">'+metric('BUILD','devBuild')+metric('FPS','devFps')+metric('MODO','devMode')+metric('SALA','devRoom')+metric('HP','devHp')+metric('POSIÇÃO','devPosition')+metric('INIMIGOS','devEnemies')+metric('BOSSES','devBosses')+metric('ENERGIA','devEnergy')+metric('PRÓXIMO BOSS','devNextBoss')+'</div><div class="dev-actions"><button data-dev-command="heal">CURAR / REVIVER</button><button data-dev-command="god-mode">INVULNERÁVEL</button><button data-dev-command="grant-energy">+100K ENERGIA</button><button data-dev-command="unlock-specimens">LIBERAR ESPÉCIMES</button><button data-dev-command="max-proficiency">PROFICIÊNCIA MÁX.</button><button data-dev-command="boss-now">FORÇAR BOSS</button><button data-dev-command="clear-enemies" data-danger="1">LIMPAR INIMIGOS</button><button data-dev-command="refresh">ATUALIZAR DADOS</button></div><p id="developerToolsMessage"></p>';
 document.body.append(toggle,panel);message=panel.querySelector('#developerToolsMessage');buildAdmin();
 toggle.addEventListener('click',()=>setOpen(panel.hidden));
 panel.addEventListener('click',e=>{const b=e.target.closest('[data-dev-command]');if(b)runCommand(b.dataset.devCommand,b)});
 document.addEventListener('keydown',e=>{if(e.code==='F10'&&active){e.preventDefault();setOpen(panel.hidden)}});
}
function setActive(value){
 active=Boolean(value);root.AbyssalDeveloperActive=active;ensure();document.body.classList.toggle('abyssal-developer',active);
 if(!active){panel.hidden=true;stopPoll();clearAdmin();}
}
function setOpen(open){if(!active)return;ensure();panel.hidden=!open;if(open){refresh();startPoll()}else stopPoll()}
function startPoll(){stopPoll();pollTimer=setInterval(refresh,900)}
function stopPoll(){if(pollTimer){clearInterval(pollTimer);pollTimer=null}}
function put(id,value){const el=document.getElementById(id);if(el)el.textContent=value==null?'-':String(value)}
async function refresh(){
 if(!active)return;
 const local=root.AbyssalGameHooks?.developerInspect?.()||{};
 let server=null;
 if(root.AbyssalOnlineDev?.isDeveloper?.())server=await root.AbyssalOnlineDev.inspect();
 const s=server?.ok?server:null,p=s?.player||null,w=s?.world||null,r=s?.room||null,a=s?.account||null;
 put('devBuild',s?.build||root.ABYSSAL_CLIENT_BUILD?.version||'-');
 put('devFps',local.fps||root.__abyssalFps||0);
 put('devMode',r?.mode||local.mode||'menu');
 put('devRoom',r?r.id:(local.online?'online':'local'));
 put('devHp',p?Math.round(p.hp)+' / '+Math.round(p.maxHp):Math.round(local.hp||0)+' / '+Math.round(local.maxHp||0));
 put('devPosition',p?Math.round(p.x)+', '+Math.round(p.y):Math.round(local.x||0)+', '+Math.round(local.y||0));
 put('devEnemies',w?.enemies??local.enemies??0);
 put('devBosses',w?.bosses??local.bosses??0);
 put('devEnergy',a?Number(a.energy||0).toLocaleString('pt-BR'):'-');
 put('devNextBoss',w?Math.max(0,w.nextBossIn)+'s':'-');
}
async function runCommand(command,button){
 if(command==='refresh'){await refresh();return}
 button.disabled=true;
 let result;
 const local=root.AbyssalGameHooks?.developerInspect?.()||{};
 const serverOnly=new Set(['grant-energy','unlock-specimens','max-proficiency']);
 if(!serverOnly.has(command)&&local.online===false)result=root.AbyssalGameHooks?.developerCommand?.(command)||{ok:false,message:'Comando local indisponível.'};
 else result=await root.AbyssalOnlineDev?.command?.(command)||{ok:false,message:'Servidor DEV indisponível.'};
 if(message)message.textContent=result?.message|| (result?.ok?'Comando concluído.':'Falha no comando.');
 button.disabled=false;await refresh();
}

let adminRoot=null,body=null,statusEl=null,epoch=0,request=null,view='players';
const labels={'warn':'Advertir','mute':'Silenciar','unmute':'Revogar silêncio','ban-chat':'Bloquear comunicação','unban-chat':'Liberar comunicação','kick':'Expulsar da partida','suspend':'Suspender acesso','ban':'Banir acesso online','restore':'Restaurar acesso','grant-energy':'Dar energia','take-energy':'Retirar energia','grant-specimen':'Dar espécime','grant-cosmetic':'Dar cosmético','grant-resource':'Dar recurso','ranking-exclude':'Excluir dos rankings','ranking-restore':'Restaurar nos rankings','notice':'Enviar aviso'};
function node(tag,t,cls){const n=document.createElement(tag);if(t!==undefined)n.textContent=t;if(cls)n.className=cls;return n}
function button(t,fn){const b=node('button',t);b.type='button';b.onclick=fn;return b}
function option(sel,v,t=v){const o=node('option',t);o.value=v;sel.append(o)}
function field(t,n){const l=node('label',t);l.append(n);return l}
function status(t){statusEl.textContent=t||''}
async function api(p){try{return await root.AbyssalOnlineDev.admin(p)}catch{return {ok:false,message:'GameMaster não conectado.'}}}
function clearAdmin(){epoch++;request=null;if(body)body.replaceChildren();if(adminRoot)adminRoot.hidden=true}
function buildAdmin(){
 const open=button('CENTRAL DE COMANDO',()=>{adminRoot.hidden=!adminRoot.hidden;if(!adminRoot.hidden)show('players')});open.className='gm-admin-open';panel.append(open);
 adminRoot=node('section',undefined,'gm-admin');adminRoot.hidden=true;const nav=node('div',undefined,'gm-nav');for(const [id,t] of [['players','Jogadores'],['reports','Denúncias'],['chat','Chat'],['audit','Auditoria']])nav.append(button(t,()=>show(id)));statusEl=node('p','');statusEl.setAttribute('role','status');body=node('div');adminRoot.append(nav,statusEl,body);panel.append(adminRoot)
}
async function show(v){view=v;const token=++epoch;body.replaceChildren();status('Carregando…');
 if(v==='players'){const q=node('input'),list=node('div'),nav=node('div',undefined,'gm-nav');q.placeholder='Nickname ou ID';q.setAttribute('aria-label','Buscar jogador');let offset=0;const load=async()=>{const r=await api({op:'list',query:q.value,offset});if(token!==epoch)return;list.replaceChildren();if(!r.ok)return status(r.message);status(r.total+' jogador(es).');for(const p of r.players){const b=button(p.nickname+' · '+(p.online?'online':'offline')+' · '+p.energy.toLocaleString('pt-BR')+' energia',()=>player(p.key));b.className='gm-player';list.append(b)}const pg=node('div',undefined,'gm-nav');if(offset>0)pg.append(button('Anterior',()=>{offset-=30;load()}));if(offset+30<r.total)pg.append(button('Próxima',()=>{offset+=30;load()}));list.append(pg)};nav.append(q,button('Buscar',()=>{offset=0;load()}));q.onkeydown=e=>{if(e.key==='Enter'){offset=0;load()}};body.append(nav,list);return load()}
 if(v==='audit'){const r=await api({op:'audit'});if(token!==epoch)return;if(!r.ok)return status(r.message);status(r.rows.length+' ações recentes.');for(const a of r.rows){const card=node('article',undefined,'gm-card');card.append(node('strong',a.nickname||a.target),node('p',a.result+' · '+a.reason),node('small',new Date(a.at).toLocaleString('pt-BR')+' · '+a.id));body.append(card)}return}
 let r;try{r=v==='chat'?await root.AbyssalOnlineDev.reports():await api({op:'reports'})}catch{return status('Fila indisponível.')}if(token!==epoch)return;if(!r?.ok)return status(r?.message||'Fila indisponível.');const rows=v==='chat'?r.reports:r.rows;status(rows.length+' denúncias pendentes.');
 for(const a of rows){const card=node('article',undefined,'gm-card'),key=v==='chat'?a.reported_key:a.type==='profile'?a.targetKey:null;card.append(node('strong',a.targetLabel||a.message_nickname),node('p',a.reason+' · '+(a.details||a.message_text||'Sem relato')),node('small',a.snapshot||''));if(a.context)card.append(node('small','Contexto informado, não verificado: '+a.context));if(key)card.append(button('Gerenciar jogador',()=>player(key)));const select=node('select'),note=node('textarea');note.maxLength=300;note.placeholder='Justificativa obrigatória';for(const [value,t] of (v==='chat'?[['dismiss','Arquivar'],['warn','Advertir e remover'],['mute_24h','Silenciar 24 h'],['ban_chat','Bloquear chat'],['needs_followup','Acompanhar']]:[['dismiss','Arquivar'],['actioned','Medida aplicada'],['followup','Acompanhar']]))option(select,value,t);let receipt=null;const apply=button('Registrar decisão',async()=>{if(!note.value.trim())return status('Informe a justificativa.');const signature=select.value+'|'+note.value;if(!receipt||receipt.signature!==signature){if(!confirm('Registrar decisão?'))return;receipt={signature,id:crypto.randomUUID()}}apply.disabled=true;try{const x=v==='chat'?await root.AbyssalOnlineDev.resolveChat(a.report_id,select.value,note.value):await api({op:'resolve-report',target:key||'',reportId:a.id,resolution:select.value,reason:note.value,requestId:receipt.id});if(token!==epoch)return;if(x?.ok)await show(v);else status(x?.message||'Falha na decisão.')}catch{status('Falha na decisão.')}finally{apply.disabled=false}});card.append(field('Decisão',select),field('Motivo',note),apply);body.append(card)}
}
async function player(key){const token=++epoch;body.replaceChildren();status('Carregando jogador…');const [r,c]=await Promise.all([api({op:'detail',target:key}),api({op:'catalog'})]);if(token!==epoch)return;if(!r.ok||!c.ok)return status(r.message||c.message);const p=r.player;status('Conta: '+p.nickname);const head=node('article',undefined,'gm-card');head.append(button('Voltar à lista',()=>show('players')),node('strong',p.nickname+' · '+(p.online?'online':'offline')),node('p','Energia: '+p.energy+' | Advertências: '+p.warnings+' | Denúncias: '+p.reportCount),node('p','Acesso: '+(p.banned?'banido':p.suspendedUntil>Date.now()?'suspenso até '+new Date(p.suspendedUntil).toLocaleString('pt-BR'):'liberado')+' | Chat: '+(p.chatBanned?'bloqueado':p.mutedUntil>Date.now()?'silenciado':'liberado')+' | Ranking: '+(p.rankingExcluded?'excluído':'normal')),node('small','ID: '+(p.accountId||p.key)));const d=node('details');d.append(node('summary','Inventário e histórico'),node('p','Espécimes: '+p.ownedSkins.join(', ')),node('p','Cosméticos: '+p.cosmetics.join(', ')),node('p','Recursos: '+Object.entries(p.inventory).filter(x=>Number(x[1])>0).map(x=>x[0]+': '+x[1]).join(', ')),node('p','Últimas partidas: '+p.matchHistory.map(m=>String(m.roomName||m.roomId||'Partida')+' · '+String(m.playedAt||'')).join(' | ')));head.append(d);body.append(head);
 const action=node('select'),item=node('select'),amount=node('input'),hours=node('input'),reason=node('textarea');for(const [id,t] of Object.entries(labels))option(action,id,t);amount.type=hours.type='number';amount.min=hours.min='1';amount.max='1000000';hours.max='2160';amount.value='100';hours.value='24';reason.maxLength=300;reason.placeholder='Motivo obrigatório, visível ao jogador';const i=field('Item',item),n=field('Quantidade',amount),h=field('Duração em horas',hours);function fields(){const a=action.value,items=a==='grant-specimen'?c.skins:a==='grant-cosmetic'?c.cosmetics:a==='grant-resource'?c.resources:[];item.replaceChildren();for(const id of items)option(item,id);i.hidden=!items.length;n.hidden=!['grant-energy','take-energy','grant-resource'].includes(a);h.hidden=!['mute','suspend'].includes(a);request=null}action.onchange=fields;fields();
 const apply=button('CONFIRMAR AÇÃO',async()=>{if(!reason.value.trim())return status('Informe o motivo.');const data={op:'action',target:p.key,action:action.value,item:item.value,amount:Number(amount.value),hours:Number(hours.value),reason:reason.value.trim()},signature=JSON.stringify(data);if(!request||request.signature!==signature){if(!confirm('Aplicar '+labels[data.action]+' a '+p.nickname+'?'))return;request={signature,id:crypto.randomUUID()}}apply.disabled=true;const x=await api({...data,requestId:request.id});if(token!==epoch)return;apply.disabled=false;if(x.ok){request=null;await player(p.key)}status(x.message||'Operação concluída.')});body.append(field('Ação',action),i,n,h,field('Motivo',reason),apply)
}
function deliverAdminNotices(event){const a=event.detail;if(!a?.nickname||!Array.isArray(a.adminNotices)||typeof root.addNotification!=='function')return;try{const k='abyssalAdminNoticeReceipts:'+a.nickname.toLowerCase(),seen=JSON.parse(localStorage.getItem(k)||'[]');for(const n of [...a.adminNotices].reverse())if(!seen.includes(n.id)){root.addNotification(n.message,n.title,'admin');seen.push(n.id)}localStorage.setItem(k,JSON.stringify(seen.slice(-100)))}catch{}}
root.addEventListener('abyssal-account-data',deliverAdminNotices);

root.addEventListener('abyssal-account-data',e=>setActive(Boolean(e.detail?.isDeveloper)));
root.addEventListener('abyssal-account-signed-out',()=>setActive(false));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});else ensure();
try{const cached=JSON.parse(localStorage.getItem('abyssalAccount')||'null');if(cached?.isDeveloper)setActive(true)}catch(_){}
})(window);
