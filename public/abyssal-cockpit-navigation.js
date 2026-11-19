/* Abyssal station navigation. Presentation only: gameplay, saves and payments stay in their existing modules. */
(function(root){
'use strict';
if(root.AbyssalCockpitNavigation)return;
const $=id=>document.getElementById(id);
const screen=$('submarineWorkshop'),grid=$('submarineWorkshopGrid');
if(!screen||!grid)return;
const STATIONS=Object.freeze([
 {id:'social',title:'CENTRAL SOCIAL',short:'SOCIAL',hint:'Cardumes, ranking e recompensas',icon:'◈'},
 {id:'cabine',title:'CABINE CENTRAL',short:'CABINE',hint:'Prepare sua expedição',icon:'⌂'},
 {id:'laboratorio',title:'LABORATÓRIO',short:'PESQUISA',hint:'Mergulhador, submarino e ressonância',icon:'⚗'},
 {id:'arsenal',title:'ARSENAL DE ECOS',short:'ARSENAL',hint:'Colecione, equipe e adquira Ecos',icon:'✧'},
 {id:'perfil',title:'MEU MERGULHADOR',short:'PERFIL',hint:'Conta, títulos e armário',icon:'♙'}
]);
const EMBEDDABLE=new Set(['shopScreen','catalogScreen','rankingsScreen','cardumesScreen','profileScreen',
 'roomsScreen','resonanceScreen','wheelScreen','notifPanel','redeemCodeScreen',
 'skinPurchaseConfirmModal','matchHistoryScreen','ugcReportScreen','downloadScreen','supportScreen']);
const TITLES={shopScreen:'ARSENAL DE ECOS',catalogScreen:'ABYSSÁRIO',rankingsScreen:'RANKING',
 cardumesScreen:'CARDUMES',profileScreen:'MEU PERFIL',roomsScreen:'MERGULHO ONLINE',
 resonanceScreen:'RESSONÂNCIA',wheelScreen:'ROLETA',notifPanel:'AVISOS',
 redeemCodeScreen:'RESGATAR CÓDIGO',skinPurchaseConfirmModal:'CONFIRMAR COMPRA',
 matchHistoryScreen:'HISTÓRICO',ugcReportScreen:'DENÚNCIA',downloadScreen:'BAIXAR ABYSSAL',supportScreen:'SUPORTE'};
const origin=new Map();
let station='cabine',current=null,history=[],drag=null,dragged=false,opened=false;
function el(tag,cls,label){const n=document.createElement(tag);if(cls)n.className=cls;if(label!==undefined)n.textContent=label;return n;}
function button(label,action,cls){const n=el('button',cls||'abyss-station-action',label);n.type='button';n.addEventListener('click',action);return n;}
function touchGame(){return document.body.classList.contains('game-active');}
const visor=el('section','abyss-cockpit-visor');
visor.setAttribute('aria-label','Tela da cabine');
const heading=el('header','abyss-visor-heading');
const headingText=el('div','abyss-station-heading-text');
const kicker=el('small','', 'ABYSSAL / ESTAÇÕES');
const title=el('strong','', 'CABINE CENTRAL');
const hint=el('span','', 'Prepare sua expedição');
headingText.append(kicker,title);
const backButton=button('‹ VOLTAR',back,'abyss-station-back');
backButton.hidden=true;
heading.append(headingText,hint,backButton);
const body=el('div','abyss-visor-body');
body.tabIndex=0;
body.setAttribute('aria-label','Conteúdo da estação selecionada');
visor.append(heading,body);
const deck=el('nav','abyss-control-deck abyss-station-deck');
deck.setAttribute('aria-label','Estações da cabine');
const previous=button('‹',()=>selectRelative(-1),'abyss-station-arrow');
previous.setAttribute('aria-label','Estação anterior');
const next=button('›',()=>selectRelative(1),'abyss-station-arrow');
next.setAttribute('aria-label','Próxima estação');
const rail=el('div','abyss-station-rail');
rail.tabIndex=0;
rail.setAttribute('role','group');
rail.setAttribute('aria-label','Arraste para mudar de estação');
const stationButtons=new Map();
STATIONS.forEach(s=>{
 const b=button('',()=>select(s.id),'abyss-control-key abyss-station-key');
 b.dataset.station=s.id;b.setAttribute('aria-label',s.title);
 const ico=el('span','abyss-control-icon',s.icon);ico.setAttribute('aria-hidden','true');
 const label=el('span','abyss-station-key-name',s.short);
 b.append(ico,label);rail.append(b);stationButtons.set(s.id,b);
});
deck.append(previous,rail,next);
grid.replaceChildren(visor,deck);
function headingTo(name,description){
 title.textContent=name;hint.textContent=description||'';
 backButton.hidden=!current;
}
function restore(node){
 if(!node)return;
 node.hidden=true;node.classList.remove('abyss-cockpit-embedded');
 const o=origin.get(node);
 if(o?.parent?.isConnected){
  if(o.next?.parentNode===o.parent)o.parent.insertBefore(node,o.next);
  else o.parent.append(node);
 }else document.body.append(node);
 origin.delete(node);
}
function restoreAll(){
 for(const node of [...origin.keys()])restore(node);
 current=null;history=[];
}
function empty(){
 restoreAll();body.replaceChildren();body.scrollTop=0;
}
function card(titleText,copy,action,buttonText){
 const item=el('article','abyss-station-card');
 const info=el('div','abyss-station-card-copy');
 info.append(el('strong','',titleText),el('p','',copy));
 item.append(info,button(buttonText||'ACESSAR',action,'abyss-station-action'));
 return item;
}
function gridCards(cards){
 const list=el('div','abyss-station-cards');
 cards.forEach(c=>list.append(card(...c)));
 body.append(list);
}
function openLegacy(sourceId,targetId,after){
 const source=$(sourceId);
 if(!source)return;
 source.click();
 const target=$(targetId);
 if(target&&!target.hidden&&!target.classList.contains('abyss-cockpit-embedded'))routeScreen(targetId);
 if(typeof after==='function')after();
}
function researchPage(mode){
 body.replaceChildren();
 const sub=el('div','abyss-lab-subnav');
 [['mergulhador','MERGULHADOR'],['submarino','SUBMARINO'],['ressonancia','RESSONÂNCIA']].forEach(([id,label])=>{
  const b=button(label,()=>id==='ressonancia'?openLegacy('resonanceBtn','resonanceScreen'):researchPage(id));
  b.classList.toggle('is-active',id===mode);b.setAttribute('aria-pressed',String(id===mode));sub.append(b);
 });
 body.append(sub);
 const api=root.AbyssalSoloBase;
 if(!api){body.append(el('p','abyss-station-note','Pesquisas temporariamente indisponíveis.'));return;}
 const balance=Number(root.AbyssalSoloProgress?.get?.().energy)||0;
 body.append(el('p','abyss-station-note','Energia disponível: '+balance.toLocaleString('pt-BR')+'. Pesquisas são permanentes.'));
 const names={photon:'Lança de Fótons',photonRay:'Raio de Fótons',electric:'Descarga Elétrica',
 pierce:'Perfuração',nova:'Nova',echoShot:'Disparo Eco',burst:'Rajada Prismática',
 ricochet:'Ricochete',spread:'Dispersão',range:'Alcance',regen:'Regeneração',
 power:'Potência',rate:'Cadência',speed:'Velocidade',magnet:'Magnetismo',shield:'Escudo',
 shell:'Carapaça',ward:'Proteção',lastStand:'Última Resistência',
 pressureCocoon:'Casulo de Pressão',vitality:'Vitalidade',predator:'Predador',
 closePressure:'Pressão Próxima',magneticField:'Campo Magnético',
 petAttack:'Ataque do Eco',petLife:'Vida do Eco',petSpeed:'Velocidade do Eco',
 petCadence:'Cadência do Eco',submarineShield:'Escudo do Submarino'};
 const ids=mode==='submarino'?[...api.SHOTS.map(id=>'weapon:'+id),'submarineShield']:[...api.SHOTS,...api.PASSIVES,...api.BUFFS];
 const cards=el('div','abyss-station-research');
 ids.forEach(id=>{
  const key=id.startsWith('weapon:')?id.slice(7):id,owned=api.unlocked(id);
  const installed=mode==='submarino'&&key!=='submarineShield'&&api.installedWeapons().includes(key);
  const entry=el('article','abyss-station-research-item');
  const label=el('div','abyss-station-card-copy');
  label.append(el('strong','',names[key]||key),el('small','',owned?(installed?'INSTALADA':'PESQUISADA'):'CUSTO: '+api.cost(id)+' ENERGIA'));
  entry.append(label);
  if(mode==='submarino'&&owned&&key!=='submarineShield'){
   entry.append(button(installed?'REMOVER':'INSTALAR',()=>{
    const result=installed?api.uninstallWeapon(key):api.installWeapon(key);
    if(!result.ok){message.textContent='Não foi possível alterar o equipamento.';return;}
    researchPage(mode);
   }));
  }else if(!owned){
   entry.append(button('PESQUISAR',()=>{
    const result=api.research(id);
    if(!result.ok){message.textContent=result.reason==='energy'?'Energia insuficiente.':'Pesquisa indisponível.';return;}
    researchPage(mode);
   }));
  }else entry.append(el('span','abyss-station-owned','CONCLUÍDA'));
  cards.append(entry);
 });
 body.append(cards);
 const message=el('p','abyss-station-note');message.setAttribute('role','status');body.append(message);
}
function openWardrobe(){
 const api=root.AbyssalAvatarWardrobe;
 showCustom('ARMÁRIO','Personalize seu mergulhador',api?.createPage?.()||el('p','','Armário indisponível.'));
}
function showCustom(name,description,node){
 restoreAll();body.replaceChildren(node);body.scrollTop=0;
 current={type:'custom',name,description,node};history=[{type:'station',station}];
 headingTo(name,description);
}
function drawStation(){
 empty();
 const s=STATIONS.find(x=>x.id===station)||STATIONS[1];
 headingTo(s.title,s.hint);
 if(s.id==='cabine'){
  const callout=el('div','abyss-station-callout');
  callout.append(el('small','','CENTRAL DE EXPEDIÇÕES'),el('strong','','PRONTO PARA MERGULHAR?'),
   el('p','','Escolha sua modalidade. Ajuste seus Ecos e pesquisas nas estações ao lado.'));
  const actions=el('div','abyss-station-dive-actions');
  actions.append(button('MERGULHAR SOLO',()=>{
   close(false);$('playBtn')?.click();
  },'abyss-station-primary'),button('MERGULHAR ONLINE',()=>{
   root.AbyssalPreferredRoomMode='coop';
   const mode=$('roomModeInput');if(mode)mode.value='coop';
   root.AbyssalOnline?.showRooms?.();
  },'abyss-station-secondary'));
  callout.append(actions);body.append(callout);
  gridCards([['Configurações','Áudio, gráficos, idioma e controles.',()=>routeCommand('volume'),'AJUSTAR'],
  ['Guia da cabine','Conheça as estações e os comandos.',()=>root.AbyssalMenuTour?.open?.(),'VER GUIA']]);
 }else if(s.id==='social'){
  gridCards([['CARDUMES','Encontre mergulhadores e acompanhe seu grupo.',()=>openLegacy('cardumesBtn','cardumesScreen')],
   ['RANKING','Classificações e recompensas de energia.',()=>openLegacy('rankingsBtn','rankingsScreen')],
   ['ROLETA','Confira giros e recompensas.',()=>openLegacy('wheelBtn','wheelScreen')],
   ['AVISOS','Notificações, convites e conquistas.',()=>openLegacy('notifBtn','notifPanel')]]);
 }else if(s.id==='laboratorio'){
  gridCards([['PESQUISA DO MERGULHADOR','Evolua habilidades com energia.',()=>researchPage('mergulhador')],
   ['PESQUISA DO SUBMARINO','Desbloqueie armas e instale equipamentos.',()=>researchPage('submarino')],
   ['RESSONÂNCIA','Configure sua combinação de habilidades.',()=>openLegacy('resonanceBtn','resonanceScreen')],
   ['ABYSSÁRIO','Consulte espécies registradas.',()=>openLegacy('catalogBtn','catalogScreen')]]);
 }else if(s.id==='arsenal'){
  gridCards([['MEUS ECOS','Visualize e gerencie os Ecos adquiridos.',()=>openLegacy('shopBtn','shopScreen',()=>{
   const filter=$('shopOwnershipFilter');if(filter){filter.value='owned';filter.dispatchEvent(new Event('change',{bubbles:true}));}
  })],
  ['ADQUIRIR ECOS','Explore o catálogo, raridades e habilidades.',()=>openLegacy('shopBtn','shopScreen',()=>{
   const filter=$('shopOwnershipFilter');if(filter){filter.value='all';filter.dispatchEvent(new Event('change',{bubbles:true}));}
  })],
  ['CÓDIGOS','Resgate códigos e recompensas de energia.',()=>openLegacy('shopBtn','shopScreen',()=>{$('openRedeemCodeBtn')?.click();})]]);
 }else if(s.id==='perfil'){
  gridCards([['MEU PERFIL','Estatísticas, conta e títulos.',()=>openLegacy('profileBtn','profileScreen')],
   ['ARMÁRIO','Roupas, acessórios e aparência do mergulhador.',openWardrobe],
   ['HISTÓRICO','Revise suas últimas expedições online.',()=>openLegacy('matchHistoryBtn','matchHistoryScreen')],
   ['CONFIGURAÇÕES','Ajuste os controles da sua expedição.',()=>routeCommand('controls')]]);
 }
}
function updateStationNav(){
 const idx=STATIONS.findIndex(x=>x.id===station);
 previous.disabled=idx===0;next.disabled=idx===STATIONS.length-1;
 stationButtons.forEach((b,id)=>{
  const active=id===station;b.classList.toggle('is-active',active);
  b.setAttribute('aria-pressed',String(active));b.tabIndex=active?0:-1;
  b.style.setProperty('--station-distance',String(Math.abs(STATIONS.findIndex(s=>s.id===id)-idx)));
 });
 const btn=stationButtons.get(station);
 if(btn&&typeof rail.scrollTo==='function'){
  const left=btn.offsetLeft-(rail.clientWidth-btn.offsetWidth)/2;
  rail.scrollTo({left:Math.max(0,left),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
}
function select(id){
 if(!STATIONS.some(x=>x.id===id))return;
 station=id;screen.dataset.station=id;drawStation();updateStationNav();
}
function selectRelative(step){const index=STATIONS.findIndex(s=>s.id===station);select(STATIONS[Math.min(STATIONS.length-1,Math.max(0,index+step))].id);}
function routeScreen(id){
 if(screen.hidden||touchGame()||!EMBEDDABLE.has(id))return false;
 const node=$(id);if(!node)return false;
 if(current?.node===node)return false;
 const old=current;
 if(old)history.push(old);
 else history.push({type:'station',station});
 if(old?.type==='custom')old.node.remove();
 if(old?.type==='embedded')old.node.hidden=true;
 if(!origin.has(node))origin.set(node,{parent:node.parentNode,next:node.nextSibling});
 body.append(node);node.classList.add('abyss-cockpit-embedded');node.hidden=false;
 current={type:'embedded',id,node};
 headingTo(TITLES[id]||'ABYSSAL','Painel integrado à cabine');
 body.scrollTop=0;
 // Legacy handlers must still finish loading accounts, catalog, rooms and rankings.
 return false;
}
function isEmbedded(id){return Boolean($(id)?.classList.contains('abyss-cockpit-embedded'));}
function back(){
 if(!current){select('cabine');return;}
 if(current.type==='embedded')restore(current.node);
 current=null;
 const prev=history.pop();
 if(prev?.type==='embedded'&&prev.node?.isConnected){
  current=prev;body.append(prev.node);prev.node.hidden=false;
  headingTo(TITLES[prev.id]||'ABYSSAL','Painel integrado à cabine');
 }else if(prev?.type==='custom'){
  current=prev;body.replaceChildren(prev.node);headingTo(prev.name,prev.description);
 }else select(prev?.station||station);
 body.scrollTop=0;
}
function routeCommand(name){
 if(screen.hidden||touchGame())return false;
 if(name==='wardrobe'){openWardrobe();return true;}
 if(name==='notices'){$('notifBtn')?.click();return true;}
 if(name==='download'){$('mobileDownloadTopBtn')?.click();return true;}
 if(['language','controls','volume','filter','fullscreen'].includes(name)){
  const page=root.AbyssalCockpitSettings?.createPage?.(name);
  showCustom(({language:'IDIOMA',controls:'CONTROLES',volume:'ÁUDIO',filter:'GRÁFICOS',fullscreen:'TELA CHEIA'})[name],
   'Preferências deste dispositivo',page||el('p','','Configuração indisponível.'));
  return true;
 }
 return false;
}
function open(){
 if(touchGame())return false;
 screen.hidden=false;opened=true;
 $('menuScreen')?.setAttribute('hidden','');
 document.body.classList.remove('abyss-hatch-navigation');
 select('cabine');
 root.AbyssalSubmarineCockpit?.open?.();
 root.AbyssalRevealStartup?.();
 return true;
}
function close(outside){
 restoreAll();body.replaceChildren();
 screen.hidden=true;opened=false;root.AbyssalSubmarineCockpit?.close?.();
 if(outside){showExterior();root.dispatchEvent(new CustomEvent('abyssal-modal-closed',{detail:{screenId:'submarineWorkshop',animateExit:true}}));}
}
function showExterior(){
 close(false);
 if(touchGame())return;
 const menu=$('menuScreen');if(menu)menu.hidden=false;
 document.body.classList.add('abyss-hatch-navigation');
 root.AbyssalRevealStartup?.();
}
$('submarineWorkshopBtn')?.addEventListener('click',open);
$('submarineWorkshopClose')?.addEventListener('click',()=>showExterior());
$('cockpitWheelBtn')?.addEventListener('click',()=>{select('social');openLegacy('wheelBtn','wheelScreen');});
$('cockpitProfileBtn')?.addEventListener('click',()=>{select('perfil');openLegacy('profileBtn','profileScreen');});
$('cockpitRankingBtn')?.addEventListener('click',()=>{select('social');openLegacy('rankingsBtn','rankingsScreen');});
$('cockpitCardumesBtn')?.addEventListener('click',()=>{select('social');openLegacy('cardumesBtn','cardumesScreen');});
body.addEventListener('click',event=>{
 const closeButton=event.target.closest?.('[data-close-screen],#shopCloseBtn,#shopTopCloseBtn,#catalogCloseBtn,#cardumesCloseBtn,#wheelCloseBtn,#notifPanelClose,#rankingsCloseBtn');
 if(!closeButton||!current?.node||!current.node.contains(closeButton))return;
 const closed=current.node;
 queueMicrotask(()=>{if(current?.node===closed&&closed.hidden)back();});
});
screen.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!event.target.closest('input,textarea,select,[role=dialog]')){event.preventDefault();current?back():showExterior();}
});
rail.addEventListener('keydown',event=>{
 if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();selectRelative(event.key==='ArrowLeft'?-1:1);stationButtons.get(station)?.focus();}
});
rail.addEventListener('pointerdown',event=>{
 if(event.button!==0||event.target.closest('input'))return;
 drag={x:event.clientX,y:event.clientY,lastX:event.clientX,id:event.pointerId};
 dragged=false;
});
rail.addEventListener('pointermove',event=>{
 if(!drag||event.pointerId!==drag.id)return;
 if(Math.abs(event.clientX-drag.x)>7&&Math.abs(event.clientX-drag.x)>Math.abs(event.clientY-drag.y)){
  try{rail.setPointerCapture?.(event.pointerId);}catch(_){}
  rail.scrollLeft+=drag.lastX-event.clientX;
 }
 drag.lastX=event.clientX;
});
rail.addEventListener('pointerup',event=>{
 if(!drag||event.pointerId!==drag.id)return;
 const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
 drag=null;if(Math.abs(dx)<40||Math.abs(dx)<Math.abs(dy)*1.3)return;
 dragged=true;selectRelative(dx<0?1:-1);
});
rail.addEventListener('pointercancel',()=>{drag=null;});
rail.addEventListener('click',event=>{if(dragged){event.preventDefault();event.stopImmediatePropagation();dragged=false;}},true);
root.addEventListener('abyssal-room-joined',()=>close(false));
root.AbyssalCockpitNavigation=Object.freeze({open,close,showExterior,routeScreen,routeCommand,back,isEmbedded,select,stations:STATIONS});
select('cabine');
})(window);