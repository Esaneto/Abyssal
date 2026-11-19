/* ABYSSAL Deep Cabin 2.5D. Presentation only: all commerce, research and gameplay
 * remain owned by the existing cockpit navigation and server runtime.
 * See docs/DEEP_MENU_ARCHITECTURE.md before modifying this module.
 */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const workshop=$('submarineWorkshop');
if(!workshop||$('abyssDeepMenu'))return;
const reduce=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
const deep=document.createElement('section');
deep.id='abyssDeepMenu';deep.className='deep-menu';deep.setAttribute('aria-label','Interior do submarino Abyssal');
deep.innerHTML=
 '<div class="deep-world" id="deepWorld" aria-hidden="false">'+
  '<div class="deep-chamber"><div class="deep-ceiling"></div><div class="deep-backwall"></div><div class="deep-leftwall"></div><div class="deep-rightwall"></div><div class="deep-floor"></div><div class="deep-floor-lines"></div><div class="deep-ceiling-ribs"></div></div>'+
  '<div class="deep-operations" aria-label="Central de operações">'+
   '<button type="button" class="deep-sonar deep-hotspot" data-deep-target="social" aria-label="Abrir sonar social, Cardumes, Ranking, Avisos e Roleta"><span class="deep-sonar-face"><i class="deep-sonar-sweep"></i><i class="deep-sonar-ping p1"></i><i class="deep-sonar-ping p2"></i><i class="deep-sonar-ping p3"></i></span><strong>SONAR SOCIAL</strong></button>'+
   '<button type="button" class="deep-research deep-hotspot" data-deep-target="research" aria-label="Abrir terminal de Pesquisa, Submarino e Ressonância"><span class="deep-research-display"><i class="deep-research-core"></i><i class="deep-research-branch b1"></i><i class="deep-research-branch b2"></i><i class="deep-research-branch b3"></i><i class="deep-research-branch b4"></i></span><strong>PESQUISA</strong><small>MERGULHADOR / SUBMARINO / RESSONÂNCIA</small></button>'+
  '</div>'+
  '<button type="button" class="deep-capsule deep-suits deep-hotspot" data-deep-target="wardrobe" aria-label="Abrir Armário do mergulhador"><span class="deep-capsule-rim"></span><span class="deep-capsule-glass"><canvas id="deepSuitPreview" width="220" height="320" aria-hidden="true"></canvas><span class="deep-capsule-scan"></span></span><span class="deep-capsule-base"></span><strong>ARMÁRIO</strong><small>TRAJES / ACESSÓRIOS</small></button>'+
  '<button type="button" class="deep-capsule deep-ecos deep-hotspot" data-deep-target="ecos" aria-label="Abrir Loja de Ecos"><span class="deep-capsule-rim"></span><span class="deep-capsule-glass"><canvas id="deepEchoPreview" width="240" height="300" aria-hidden="true"></canvas><span class="deep-capsule-scan"></span></span><span class="deep-capsule-base"></span><strong>ECOS</strong><small>ORGANISMOS ABISSAIS</small></button>'+
  '<button type="button" class="deep-hatch deep-hotspot" data-deep-target="hatch" aria-label="Abrir escotilha e escolher mergulho"><span class="deep-hatch-outer"><span class="deep-hatch-bolts"></span><span class="deep-hatch-inner"><span class="deep-hatch-lid"><i class="deep-hatch-wheel"></i><i class="deep-hatch-cross"></i></span></span></span><strong>MERGULHAR</strong></button>'+
 '</div>'+
 '<div class="deep-topline"><span class="deep-brand">ABYSSAL <small>ESTAÇÃO DE OPERAÇÕES</small></span><div class="deep-utilities"><button type="button" data-deep-quick="account">CONTA</button><button type="button" data-deep-quick="settings" aria-expanded="false" aria-controls="deepSettings">AJUSTES</button><button type="button" data-deep-quick="guide">AJUDA</button></div><div id="deepSettings" class="deep-settings-popover" hidden role="group" aria-label="Ajustes da cabine"><button type="button" data-deep-setting="controls">CONTROLES</button><button type="button" data-deep-setting="hudEditor">EDITAR HUD</button><button type="button" data-deep-setting="volume">VOLUME / ÁUDIO</button><button type="button" data-deep-setting="filter">GRÁFICOS</button><button type="button" data-deep-setting="language">IDIOMA</button><button type="button" data-deep-setting="fullscreen">TELA CHEIA</button><button type="button" data-deep-setting="download">BAIXAR ABYSSAL</button></div></div>'+
 '<div class="deep-hatch-choice" id="deepHatchChoice" hidden role="group" aria-label="Escolher modo de mergulho"><p>ESCOTILHA / EXPEDIÇÃO</p><button type="button" id="deepSoloDive">01 · MERGULHO SOLO</button><button type="button" id="deepOnlineDive">02 · MERGULHO ONLINE</button></div>'+
 '<div class="deep-bottomline"><span id="deepInstruction">SELECIONE UM EQUIPAMENTO PARA APROXIMAR A CÂMERA</span><button type="button" id="deepReturn" hidden>‹ VOLTAR À CABINE</button></div>';
workshop.append(deep);
const visor=workshop.querySelector('.abyss-cockpit-console');
let focus='overview',pendingOnline=false,launching=false,raf=0,lastDraw=0,seenWorkshop=false;
const suit=$('deepSuitPreview'),echo=$('deepEchoPreview'),suitC=suit.getContext('2d'),echoC=echo.getContext('2d');
const deck=$('deepWorld'),back=$('deepReturn'),choices=$('deepHatchChoice'),settings=$('deepSettings'),settingsToggle=deep.querySelector('[data-deep-quick="settings"]');
const body=document.body;
function isOpen(){return !workshop.hidden&&!body.classList.contains('game-active');}
function activate(){
 if(!isOpen())return;
 seenWorkshop=true;workshop.classList.add('abyss-deep-active');
 // Clear any stale page returned from an editor or embedded screen.
 if(!launching)overview();
 startPreview();
}
function closeSettings(){settings.hidden=true;settingsToggle.setAttribute('aria-expanded','false');}
function overview(){
 observedEmbedded=false;
 closeSettings();
 if(launching)return;
 focus='overview';deep.dataset.focus='overview';
 workshop.classList.remove('abyss-deep-detail','abyss-deep-approaching');
 workshop.classList.remove('abyss-deep-hatch-opening');
 choices.hidden=true;back.hidden=true;
 deep.hidden=false;
 $('deepInstruction').textContent='SELECIONE UM EQUIPAMENTO PARA APROXIMAR A CÂMERA';
 const lid=deep.querySelector('.deep-hatch-lid');if(lid)lid.style.transform='';
}
function view(target){
 if(!isOpen()||launching)return;
 closeSettings();
 if(!['hatch','wardrobe','ecos','research','social'].includes(target))return;
 focus=target;deep.dataset.focus=target;
 choices.hidden=true;back.hidden=false;workshop.classList.add('abyss-deep-approaching');
 workshop.classList.remove('abyss-deep-detail');
 $('deepInstruction').textContent='CÂMERA / '+({hatch:'ESCOTILHA',wardrobe:'ARMÁRIO',ecos:'CONTENÇÃO DE ECOS',research:'PESQUISA',social:'SONAR SOCIAL'})[target];
 if(target==='hatch'){
  choices.hidden=false;
  $('deepSoloDive').focus({preventScroll:true});
  return;
 }
 const route=()=>{
  if(focus!==target||!isOpen())return;
  const nav=root.AbyssalCockpitNavigation;if(!nav)return;
  if(target==='wardrobe'){nav.select('perfil');nav.routeCommand('wardrobe');}
  else if(target==='ecos'){nav.select('arsenal');nav.routeScreen('shopScreen');}
  else if(target==='research'){nav.select('laboratorio');}
  else {nav.select('social');}
  workshop.classList.add('abyss-deep-detail');
  workshop.classList.remove('abyss-deep-approaching');
  deep.querySelector('.deep-bottomline')?.scrollIntoView?.({block:'nearest'});
 };
 if(reduce())route();else root.setTimeout(route,490);
}
function openSetting(name){
 observedEmbedded=false;
 if(!['controls','hudEditor','volume','filter','language','fullscreen','download'].includes(name))return;
 const nav=root.AbyssalCockpitNavigation;if(!nav)return;
 closeSettings();focus='quick';deep.dataset.focus='research';
 workshop.classList.add('abyss-deep-detail');workshop.classList.remove('abyss-deep-approaching');
 back.hidden=false;choices.hidden=true;
 nav.select('cabine');
 if(name==='download')nav.routeScreen('downloadScreen');else nav.routeCommand(name);
}
function showQuick(target){
 if(target==='guide'){root.AbyssalTutorials?.openManual?.('solo');return;}
 if(target==='settings'){const next=settings.hidden;settings.hidden=!next;settingsToggle.setAttribute('aria-expanded',String(next));return;}
 const nav=root.AbyssalCockpitNavigation;if(!nav)return;
 closeSettings();focus='quick';deep.dataset.focus='research';
 workshop.classList.add('abyss-deep-detail');workshop.classList.remove('abyss-deep-approaching');
 back.hidden=false;choices.hidden=true;
 if(target==='account'){nav.select('perfil');nav.routeScreen(root.AbyssalOnline?.isAuthenticated?.()?'profileScreen':'loginScreen');}
}

deep.addEventListener('click',event=>{
 const setting=event.target.closest('[data-deep-setting]');if(setting){openSetting(setting.dataset.deepSetting);return;}
 const target=event.target.closest('[data-deep-target]');
 if(target){view(target.dataset.deepTarget);return;}
 const quick=event.target.closest('[data-deep-quick]');
 if(quick)showQuick(quick.dataset.deepQuick);
});
back.addEventListener('click',()=>{root.AbyssalCockpitNavigation?.select?.('cabine');overview();deep.querySelector('.deep-hatch')?.focus({preventScroll:true});});
workshop.addEventListener('keydown',event=>{
 if(!isOpen()||!workshop.classList.contains('abyss-deep-active')||event.key!=='Escape'||launching)return;
 if(!settings.hidden){closeSettings();event.preventDefault();event.stopImmediatePropagation();return;}
 if(focus==='overview')return;
 if(workshop.classList.contains('abyss-deep-detail')&&workshop.querySelector('.abyss-cockpit-embedded:not([hidden])')){
  root.AbyssalCockpitNavigation?.back?.();event.preventDefault();event.stopImmediatePropagation();return;
 }
 event.preventDefault();event.stopImmediatePropagation();back.click();
},true);
function bubbles(){
 const layer=document.createElement('div');layer.className='deep-dive-transition';
 layer.setAttribute('aria-hidden','true');layer.innerHTML='<div class="deep-dive-tunnel"></div><div class="deep-dive-bubbles"></div>';
 const wave=layer.querySelector('.deep-dive-bubbles');
 for(let i=0;i<31;i++){
  const dot=document.createElement('i');dot.style.setProperty('--bx',(7+(i*71)%88)+'%');
  dot.style.setProperty('--by',(16+(i*43)%90)+'%');
  dot.style.setProperty('--br',(5+(i*13)%27)+'px');
  dot.style.setProperty('--bd',((i%9)*-.19)+'s');
  wave.append(dot);
 }
 body.append(layer);return layer;
}
function soloDive(){
 if(launching)return;launching=true;choices.hidden=true;
 focus='hatch';deep.dataset.focus='hatch';workshop.classList.add('abyss-deep-hatch-opening');
 const transition=bubbles();let started=false,ended=false;
 const startedAt=performance.now();
 const cleanup=()=>{transition.classList.add('is-clearing');root.setTimeout(()=>transition.remove(),780);launching=false;};
 const start=()=>{
  if(started)return;
  started=true;
  const live=$('playBtn');
  if(live&&!live.disabled)live.click();
  else {cleanup();workshop.classList.remove('abyss-deep-hatch-opening');overview();}
 };
 const finish=()=>{
  if(ended||!launching)return;
  if(!started)start();
  if(!launching)return;
  const ready=body.classList.contains('game-active')&&$('hud')?.hidden===false;
  if(!ready){
   // Slow startup: keep the bubble tunnel until gameplay is actually visible.
   // Do not expose an unfinished black frame or wait forever after a failed launch.
   if(performance.now()-startedAt<15000){root.setTimeout(finish,160);return;}
   ended=true;cleanup();
   root.AbyssalCockpitNavigation?.open?.();
   overview();
   $('roomsMessage')?.replaceChildren(document.createTextNode('Não foi possível iniciar o mergulho. Tente novamente.'));
   return;
  }
  ended=true;cleanup();
 };
 if(reduce()){start();finish();return;}
 root.setTimeout(()=>transition.classList.add('is-descending'),900);
 root.setTimeout(start,1950);
 root.setTimeout(finish,2900);
}
function onlineDive(){
 if(launching)return;
 choices.hidden=true;pendingOnline=true;
 root.AbyssalPreferredRoomMode='coop';
 const mode=$('roomModeInput');if(mode)mode.value='coop';
 const nav=root.AbyssalCockpitNavigation;
 nav?.select('cabine');workshop.classList.add('abyss-deep-detail');
 workshop.classList.remove('abyss-deep-approaching');
 focus='online';
 root.AbyssalOnline?.connectAndJoin?.('MERGULHO-ONLINE');
}
$('deepSoloDive').addEventListener('click',soloDive);
$('deepOnlineDive').addEventListener('click',onlineDive);
root.addEventListener('abyssal-room-joined',()=>{
 if(!pendingOnline)return;pendingOnline=false;const overlay=bubbles();
 overlay.classList.add('is-descending');
 root.setTimeout(()=>overlay.classList.add('is-clearing'),reduce()?0:1700);
 root.setTimeout(()=>overlay.remove(),reduce()?500:2550);
});
root.addEventListener('abyssal-room-left',()=>{pendingOnline=false;});
root.addEventListener('abyssal-room-join-failed',()=>{pendingOnline=false;});
// returnToMainMenu already opens the cockpit; reopening here would reset its live controls.
function drawSamples(t){
 // Display actual diver assets and actual shop species; no fake ownership/unlocks.
 const sc=suitC,ec=echoC;if(!sc||!ec)return;
 sc.clearRect(0,0,suit.width,suit.height);
 const art=root.AbyssalDiverArt,avatar=root.AbyssalAvatarBase;
 if(art?.draw){
  const products=avatar?.slots?.outfit||[];
  const choice=products.length?products[Math.floor(t/11000)%products.length]:null;
  const appearance=avatar?.normalize?.({...avatar.get(),outfit:choice?.id||'navy'})||undefined;
  sc.save();sc.translate(suit.width/2,suit.height*.54+Math.sin(t*.0011)*3);
  art.draw(sc,0,0,46,-Math.PI/2,-Math.PI/2,t,{gender:root.AbyssalDiverGender||'male',appearance,moving:true,heldItem:'none'});
  sc.restore();
 }else{
  sc.strokeStyle='#b7e7e4';sc.lineWidth=9;sc.beginPath();sc.arc(110,86,24,0,Math.PI*2);sc.moveTo(110,112);sc.lineTo(110,213);sc.moveTo(110,144);sc.lineTo(71,184);sc.moveTo(110,144);sc.lineTo(150,184);sc.stroke();
 }
 ec.clearRect(0,0,echo.width,echo.height);
 const catalog=root.AbyssalCuratedSkins;
 const species=['eagleray','dumbo','nautilus','ribbonmoray'].map(id=>catalog?.byId?.[id]).filter(Boolean);
 if(root.AbyssalMarineArt?.draw&&species.length){
  const step=Math.floor(t/12000);
  for(let i=0;i<2;i++){
   const selected=species[(step+i+species.length)%species.length];
   const x=echo.width*(i===0?.51:.38)+Math.sin(t*.00055+i*2)*echo.width*.14;
   const y=echo.height*(i===0?.42:.76)+Math.sin(t*.00094+i*2)*10;
   ec.save();ec.globalAlpha=i===0?1:.48;
   try{root.AbyssalMarineArt.draw(ec,x,y,i===0?50:25,Math.sin(t*.0007+i)*.25,selected,t,false);}catch(_){}
   ec.restore();
  }
 }
}
function loop(t){
 raf=0;if(!isOpen()||document.hidden||body.classList.contains('game-active'))return;
 const interval=focus==='overview'?100:45;
 if(t-lastDraw>=interval){lastDraw=t;drawSamples(t);}
 raf=root.requestAnimationFrame(loop);
}
function startPreview(){if(!raf&&!document.hidden&&isOpen())raf=root.requestAnimationFrame(loop);}
function stopPreview(){if(raf)root.cancelAnimationFrame(raf);raf=0;lastDraw=0;}
const observer=new MutationObserver(()=>{
 if(isOpen()&&!workshop.classList.contains('abyss-deep-active'))activate();
 if(!isOpen()){stopPreview();workshop.classList.remove('abyss-deep-active','abyss-deep-detail','abyss-deep-approaching','abyss-deep-hatch-opening');focus='overview';deep.dataset.focus='overview';choices.hidden=true;back.hidden=true;closeSettings();}
});
observer.observe(workshop,{attributes:true,attributeFilter:['hidden']});
const grid=$('submarineWorkshopGrid');
let observedEmbedded=false;
const embeddedObserver=new MutationObserver(()=>{
 if(!isOpen()||!workshop.classList.contains('abyss-deep-active')){observedEmbedded=false;return;}
 // Only return automatically if an actual embedded modal was previously open.
 // Built-in settings, wardrobe and research render without an embedded modal.
 const visibleEmbedded=grid?.querySelector('.abyss-cockpit-embedded:not([hidden])');
 if(visibleEmbedded){
  observedEmbedded=true;
  if(focus==='overview'){focus='quick';deep.dataset.focus='research';back.hidden=false;}
  workshop.classList.add('abyss-deep-detail');
 }else if(observedEmbedded){
  observedEmbedded=false;
  if(focus==='quick'&&workshop.classList.contains('abyss-deep-detail'))overview();
 }
});
if(grid)embeddedObserver.observe(grid,{subtree:true,childList:true});

document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPreview();else startPreview();});
root.AbyssalDeepMenu=Object.freeze({overview,isEnabled:()=>true,focus:()=>focus,view,visualStatus:()=>({active:isOpen(),focus,realDiver:Boolean(root.AbyssalDiverArt),realEcos:Boolean(root.AbyssalMarineArt)})});
if(isOpen())activate();
})(window);
