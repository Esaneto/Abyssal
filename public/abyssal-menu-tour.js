/* First-launch menu tour. Highlights the live controls, not screenshots.
 * Never starts a dive, buys an item, logs in, or changes game settings. */
(function(root){
'use strict';
const KEY='abyssalMenuTourV1', $=id=>document.getElementById(id);
const STEPS=Object.freeze([
 {area:'exterior',target:'#divePortalBtn',title:'Escolha seu mergulho',copy:'Mergulhar abre a escolha entre Solo e Online. No Solo, jogue no seu ritmo; no Online, escolha ou crie uma sala cooperativa.'},
 {area:'exterior',target:'#submarineWorkshopBtn',title:'Entre na cabine',copy:'A cabine reúne equipamento, pesquisa, armário e sistemas do submarino. Use este botão para preparar a expedição.'},
 {area:'exterior',target:'#profileBtn',title:'Sua conta e progresso',copy:'No Perfil você pode entrar, criar uma conta e acompanhar conquistas. Uma conta permite guardar compras e sincronizar o progresso.'},
 {area:'exterior',target:'#hubMore',title:'Mais opções',copy:'Abra este menu para acessar rankings, Cardumes, recompensas, controles, idioma, downloads e suporte. O guia de mergulho explica o combate.'},
 {area:'cabin',target:'.abyss-control-deck',title:'Comandos da cabine',copy:'O painel central muda conforme o botão escolhido. Mergulhar prepara a expedição; Pesquisa reúne melhorias; Espécimes abre a loja; Abyssário consulta o registro de espécies.'},
 {area:'research',target:'.solo-research-tabs',title:'Pesquisa do mergulhador',copy:'Pesquise lanterna, Q (Pulso de Maré) e E (Propulsor Abissal). O botão Submarino abre as pesquisas da base e Ressonância organiza as habilidades do mergulho.'},
 {area:'resonance',target:'#resonanceSkillChoices [data-research-id="range"]',title:'Prepare suas ressonâncias',copy:'Escolha um disparo e combine habilidades que favoreçam seu estilo de combate. Você pode ajustar suas escolhas antes de mergulhar.'},
 {area:'wardrobe',target:'[data-cockpit-setting="wardrobe"]',title:'Personalize o mergulhador',copy:'Experimente cabelos, trajes, máscaras, armas e nadadeiras. Itens não adquiridos aparecem na prévia, mas só podem ser salvos depois da compra.'},
 {area:'shop',target:'.abyss-control-shop',title:'Espécimes e Abyssário',copy:'Espécimes oferece criaturas companheiras e suas habilidades. No Abyssário você consulta as espécies descobertas, raridades e informações de combate.'},
 {area:'cabin',target:'.abyss-cockpit-utilities',title:'Atalhos da cabine',copy:'Roleta entrega recompensas; Perfil mostra sua conta; Ranking acompanha as classificações; Cardumes conecta você à comunidade.'},
 {area:'cabin',target:'.abyss-cockpit-top-actions',title:'Ajustes e avisos',copy:'Use os comandos superiores para idioma, controles, armário, volume, gráficos, avisos, downloads e tela cheia.'},
 {area:'cabin',target:'#submarineWorkshopClose',title:'Pronto para mergulhar',copy:'A escotilha retorna ao menu principal. Quando estiver pronto, escolha Mergulhar. Você pode reabrir este guia a qualquer momento.'}
]);
let overlay=null,card=null,spot=null,idx=0,active=false,previousFocus=null,origin='exterior',raf=0,autoObserver=null,autoScheduled=false,autoOff=false;
const editable=node=>!!node?.closest?.('textarea,input:not([type=button],[type=submit],[type=reset],[type=checkbox],[type=radio],[type=range],[type=file],[type=color]),[contenteditable]:not([contenteditable=false]),[data-selectable-text]');
document.addEventListener('selectstart',e=>{if(!editable(e.target))e.preventDefault();},true);
document.addEventListener('dragstart',e=>{if(!editable(e.target)&&e.target?.closest?.('img,a,svg,canvas')&&!e.target?.closest?.('[draggable=true]'))e.preventDefault();},true);
function visible(n){if(!n||n.closest('[hidden]')||!n.getClientRects().length)return false;const style=getComputedStyle(n);return style.display!=='none'&&style.visibility!=='hidden';}
function seen(){try{return localStorage.getItem(KEY)==='1';}catch{return false;}}
function markSeen(){autoOff=true;try{localStorage.setItem(KEY,'1');}catch{}autoObserver?.disconnect();}
function create(){
 if(overlay)return;
 overlay=document.createElement('section');overlay.id='abyssalMenuTour';overlay.hidden=true;overlay.setAttribute('role','presentation');
 overlay.innerHTML='<div class="amt-spot" aria-hidden="true"></div><span class="amt-arrow" aria-hidden="true">➤</span><article class="amt-card" role="dialog" aria-modal="true" aria-labelledby="amtTitle" aria-describedby="amtCopy" tabindex="-1"><div class="amt-kicker">GUIA DA CABINE</div><div class="amt-counter" aria-live="polite"></div><progress value="1" max="12" aria-label="Progresso do tutorial"></progress><h2 id="amtTitle"></h2><p id="amtCopy"></p><p class="amt-instruction">Siga a luz e avance quando compreender esta etapa.</p><div class="amt-actions"><button class="amt-prev" type="button">Voltar</button><button class="amt-next" type="button">Próximo</button><button class="amt-skip" type="button">Pular tutorial</button></div></article>';
 document.body.append(overlay);card=overlay.querySelector('.amt-card');spot=overlay.querySelector('.amt-spot');
 overlay.querySelector('.amt-prev').onclick=()=>show(idx-1);
 overlay.querySelector('.amt-next').onclick=()=>idx===STEPS.length-1?close():show(idx+1);
 overlay.querySelector('.amt-skip').onclick=close;
 overlay.addEventListener('pointerdown',e=>{if(e.target===overlay||e.target===spot)e.preventDefault();});
}
function prepare(step){
 const nav=root.AbyssalCockpitNavigation,cabin=$('submarineWorkshop');if(!nav)return;
 if(step.area==='exterior'){if(!visible($('menuScreen'))||cabin&&!cabin.hidden)nav.showExterior();return;}
 if(cabin?.hidden)nav.open();
 if(step.area==='research')cabin?.querySelector('.abyss-control-research')?.click();
 else if(step.area==='resonance'){cabin?.querySelector('.abyss-control-research')?.click();nav.routeScreen('resonanceScreen');}
 else if(step.area==='wardrobe')nav.routeCommand('wardrobe');
 else if(step.area==='shop')cabin?.querySelector('.abyss-control-shop')?.click();
 else cabin?.querySelector('.abyss-control-solo')?.click();
}
function rectFor(target){const w=innerWidth,h=innerHeight;if(!target||!visible(target))return {left:w/2-12,right:w/2+12,top:h/2-12,bottom:h/2+12};const r=target.getBoundingClientRect(),clamp=(v,max)=>Math.max(4,Math.min(max-4,v));return {left:clamp(r.left-5,w),right:clamp(r.right+5,w),top:clamp(r.top-5,h),bottom:clamp(r.bottom+5,h)};}
function place(){
 raf=0;if(!active)return;const w=innerWidth,h=innerHeight,r=rectFor(document.querySelector(STEPS[idx].target));let left=r.left,top=r.top,right=Math.max(left+1,r.right),bottom=Math.max(top+1,r.bottom);
 Object.assign(spot.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
 const cw=card.offsetWidth,ch=card.offsetHeight,gap=12,clamp=(v,min,max)=>Math.max(min,Math.min(Math.max(min,max),v));
 const candidates=[[right+gap,(top+bottom-ch)/2],[left-cw-gap,(top+bottom-ch)/2],[(left+right-cw)/2,bottom+gap],[(left+right-cw)/2,top-ch-gap]];
 const options=candidates.map(([x,y])=>{x=clamp(x,12,w-cw-12);y=clamp(y,12,h-ch-12);const overlap=Math.max(0,Math.min(x+cw,right)-Math.max(x,left))*Math.max(0,Math.min(y+ch,bottom)-Math.max(y,top));return {x,y,overlap};}).sort((a,b)=>a.overlap-b.overlap);
 card.style.left=options[0].x+'px';card.style.top=options[0].y+'px';
 const arrow=overlay.querySelector('.amt-arrow');if(arrow){const nearRight=right+52<w,ax=nearRight?right+12:Math.max(4,left-35);arrow.style.left=ax+'px';arrow.style.top=clamp((top+bottom)/2-16,16,h-44)+'px';arrow.style.rotate=nearRight?'0deg':'180deg';}
}
function queuePlace(){if(active&&!raf)raf=requestAnimationFrame(place);}
function show(n){
 idx=Math.max(0,Math.min(STEPS.length-1,n));const step=STEPS[idx];prepare(step);
 card.querySelector('#amtTitle').textContent=step.title;card.querySelector('#amtCopy').textContent=step.copy;const lang=root.AbyssalI18n?.getLanguage?.()||'pt';card.querySelector('.amt-counter').textContent=(lang==='en'?'Step ':lang==='es'?'Etapa ':'Etapa ')+(idx+1)+(lang==='en'?' of ':' de ')+STEPS.length;const progress=card.querySelector('progress');progress.max=STEPS.length;progress.value=idx+1;
 const prev=card.querySelector('.amt-prev'),next=card.querySelector('.amt-next');prev.disabled=idx===0;next.textContent=idx===STEPS.length-1?'Concluir':'Próximo';
 const target=document.querySelector(step.target);if(target&&visible(target))target.scrollIntoView?.({block:'nearest',inline:'nearest'});queuePlace();const current=idx;root.setTimeout?.(()=>{if(active&&idx===current)queuePlace();},140);next.focus({preventScroll:true});
}
function open(from='exterior',full=false){
 if(active||document.body.classList.contains('game-active')||!root.AbyssalCockpitNavigation)return false;
 create();previousFocus=document.activeElement;origin=from;active=true;autoObserver?.disconnect();overlay.hidden=false;document.body.classList.add('abyssal-menu-tour-open');show(from==='cabin'&&!full?4:0);return true;
}
function close(){
 if(!active)return;active=false;markSeen();overlay.hidden=true;document.body.classList.remove('abyssal-menu-tour-open');if(raf)cancelAnimationFrame(raf);raf=0;
 const nav=root.AbyssalCockpitNavigation;if(origin==='exterior')nav?.showExterior();else{if($('submarineWorkshop')?.hidden)nav?.open();$('submarineWorkshop')?.querySelector('.abyss-control-solo')?.click();}
 const focus=previousFocus;previousFocus=null;if(focus?.isConnected&&visible(focus))focus.focus({preventScroll:true});else (origin==='cabin'?$('cockpitTourBtn'):$('menuTourBtn'))?.focus({preventScroll:true});
}
function blocked(){if(document.documentElement.classList.contains('abyssal-startup')||document.body.classList.contains('game-active')||document.hidden)return true;const loading=$('abyssalStartupLoading');if(loading&&!loading.classList.contains('is-hidden'))return true;for(const n of document.querySelectorAll('.modal-screen:not(#submarineWorkshop),.modal-overlay,#abyssalTutorialOverlay,#abyssalProgressionChoice,#abyssalDiveChoicePanel'))if(visible(n))return true;return false;}
function autoCheck(){
 autoScheduled=false;if(autoOff||active||seen()){autoObserver?.disconnect();return;}if(blocked())return;
 const menu=$('menuScreen'),cabin=$('submarineWorkshop');if(visible(cabin))open('cabin',true);else if(visible(menu))open('exterior',true);
}
function scheduleAuto(){if(!autoOff&&!autoScheduled){autoScheduled=true;requestAnimationFrame(autoCheck);}}
function boot(){
 $('menuTourBtn')?.addEventListener('click',()=>open('exterior'));$('cockpitTourBtn')?.addEventListener('click',()=>open('cabin'));
 if(!seen()){autoObserver=new MutationObserver(scheduleAuto);autoObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});scheduleAuto();}
}
document.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}if(e.key==='Tab'){const nodes=[...card.querySelectorAll('button:not(:disabled)')],first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}},true);
document.addEventListener('focusin',e=>{if(active&&!overlay.contains(e.target))card.querySelector('.amt-next')?.focus({preventScroll:true});},true);
root.addEventListener('resize',queuePlace,{passive:true});document.addEventListener('scroll',queuePlace,true);document.addEventListener('visibilitychange',scheduleAuto);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
root.AbyssalMenuTour=Object.freeze({open,close,STEPS});
})(window);
