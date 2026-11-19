/* First-launch menu tour. Highlights the live controls, not screenshots.
 * Never starts a dive, buys an item, logs in, or changes game settings. */
(function(root){
'use strict';
const KEY='abyssalMenuTourV2', $=id=>document.getElementById(id);
const STEPS=Object.freeze([
 {area:'exterior',target:'#divePortalBtn',title:'Escolha seu mergulho',copy:'A opção Mergulhar apresenta os modos Solo e Online. Na cabine, os dois modos também possuem atalhos próprios.'},
 {area:'exterior',target:'#submarineWorkshopBtn',title:'Entre na cabine',copy:'A cabine reúne as estações de preparação, progressão e comunidade.'},
 {area:'exterior',target:'#profileBtn',title:'Sua conta e progresso',copy:'Entre na sua conta para sincronizar progresso e acompanhar suas conquistas.'},
 {area:'exterior',target:'#hubMore',title:'Opções adicionais',copy:'Suporte, idioma e downloads continuam disponíveis no menu.'},
 {area:'cabin',target:'[data-station="cabine"]',title:'Cabine central',copy:'Esta é sua estação inicial. Use os botões para iniciar o modo Solo ou Online.'},
 {area:'research',target:'[data-station="laboratorio"]',title:'Laboratório',copy:'Pesquise habilidades do mergulhador, armas do submarino e abra a Ressonância.'},
 {area:'resonance',target:'.abyss-station-cards',title:'Prepare sua evolução',copy:'A Ressonância permite organizar habilidades antes da expedição.'},
 {area:'wardrobe',target:'[data-station="perfil"]',title:'Seu mergulhador',copy:'Abra o perfil, o armário ou o histórico da conta nesta estação.'},
 {area:'shop',target:'[data-station="arsenal"]',title:'Arsenal de Ecos',copy:'Aqui você encontra seus Ecos, adquire outros e gerencia os companheiros.'},
 {area:'social',target:'[data-station="social"]',title:'Central social',copy:'Cardumes, Ranking, Roleta e Avisos ficam agrupados nesta estação.'},
 {area:'cabin',target:'.abyss-cockpit-top-actions',title:'Ajustes rápidos',copy:'Idioma, controles, áudio, gráficos e avisos continuam acessíveis no alto da cabine.'},
 {area:'cabin',target:'#submarineWorkshopClose',title:'Voltar pela escotilha',copy:'Este botão retorna ao exterior. Você também pode navegar pelas setas ou arrastar a barra das estações.'}
]);
let overlay=null,card=null,spot=null,idx=0,active=false,previousFocus=null,origin='exterior',raf=0,autoObserver=null,autoScheduled=false,autoOff=false;
const editable=node=>!!node?.closest?.('textarea,input:not([type=button],[type=submit],[type=reset],[type=checkbox],[type=radio],[type=range],[type=file],[type=color]),[contenteditable]:not([contenteditable=false]),[data-selectable-text]');
// Selection is permitted so instructions and labels remain accessible.
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
 const target={cabin:'cabine',research:'laboratorio',resonance:'laboratorio',
  wardrobe:'perfil',shop:'arsenal',social:'social'}[step.area]||'cabine';
 nav.select(target);
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
 const nav=root.AbyssalCockpitNavigation;if(origin==='exterior')nav?.showExterior();else{if($('submarineWorkshop')?.hidden)nav?.open();nav?.select('cabine');}
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
