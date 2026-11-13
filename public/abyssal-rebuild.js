
(function(){
'use strict';
if(window.__abyssalRebuildV1)return;
window.__abyssalRebuildV1=true;

var $=function(id){return document.getElementById(id);};

var SPECIMENS=[
  {id:'default',tier:'core',habitat:'Núcleo',classTag:'NÚCLEO',name:'Luz Abissal',lore:'O primeiro brilho. Pequeno demais para explicar por que as outras coisas o seguem.'},
  {id:'violet',tier:'deep',habitat:'Mesopelágico',classTag:'ESPECTRAL',name:'Espectro Violeta',lore:'Uma forma espectral que parece existir alguns centímetros fora da água.'},
  {id:'solar',tier:'core',habitat:'Zona fótica',classTag:'SOLAR',name:'Núcleo Solar',lore:'Fragmentos de luz presos em uma criatura que nunca deveria ter visto o sol.'},
  {id:'toxic',tier:'deep',habitat:'Fendas sulfurosas',classTag:'TÓXICA',name:'Lodo Tóxico',lore:'As glândulas verdes continuam pulsando mesmo depois de separadas do hospedeiro.'},
  {id:'leviathan',tier:'relic',habitat:'Fossa hadal',classTag:'RELÍQUIA',name:'Eco do Peixe-Remo Leviatã',lore:'Uma fita colossal de carne e crista luminosa, moldada a partir do peixe-remo das profundezas.'},
  {id:'thorn',tier:'deep',habitat:'Recife negro',classTag:'CALCIFICADA',name:'Coroa de Espinhos',lore:'Coral predatório calcificado em torno de um núcleo ainda consciente.'},
  {id:'abyssking',tier:'abyssal',habitat:'Setor interditado',classTag:'ABISSAL',name:'Soberano do Vazio',lore:'Uma coroa não significa que exista um reino. Às vezes significa que algo venceu tudo ao redor.'},
  {id:'royal',tier:'deep',habitat:'Talude profundo',classTag:'SIMBIÓTICA',name:'Pérola Regente',lore:'Organismos luminescentes orbitam a criatura como se reconhecessem autoridade.'},
  {id:'glacier',tier:'deep',habitat:'Águas polares',classTag:'POLAR',name:'Glaciar Fantasma',lore:'Cristais marinhos crescem sem reduzir a temperatura da água ao redor.'},
  {id:'coral',tier:'deep',habitat:'Recife afótico',classTag:'COLONIAL',name:'Jardim Carnívoro',lore:'Não é um jardim. É uma colônia que aprendeu a caçar.'},
  {id:'bloodmoon',tier:'abyssal',habitat:'Zona de pressão',classTag:'ABISSAL',name:'Lua Sangrenta',lore:'A mandíbula fica mais visível quando o organismo está perto da morte.'},
  {id:'voidwing',tier:'deep',habitat:'Coluna oceânica',classTag:'PELÁGICA',name:'Manta do Nada',lore:'Membranas amplas cortam a água sem produzir o deslocamento esperado.'},
  {id:'abyssaleye',tier:'abyssal',habitat:'Desconhecido',classTag:'ABISSAL',name:'Olho do Insondável',lore:'O registro mostra a mesma íris olhando para câmeras instaladas em pontos diferentes.'},
  {id:'deepwarden',tier:'deep',habitat:'Fundo rochoso',classTag:'BLINDADA',name:'Carcereiro das Fossas',lore:'Placas minerais se fecharam sobre um organismo que ainda tenta sair.'},
  {id:'kraken',tier:'relic',habitat:'Fossa hadal',classTag:'RELÍQUIA',name:'Eco do Kraken',lore:'O Kraken permanece lá embaixo. Isto é somente uma memória biológica dos seus tentáculos.'},
  {id:'aberration',tier:'relic',habitat:'Fossa abissal',classTag:'RELÍQUIA',name:'Eco do Polvo-de-Anéis-Azuis',lore:'Manto azul e anéis bioluminescentes denunciam a criatura antes que a tinta negra apague o caminho atrás dela.'},
  {id:'angler',tier:'relic',habitat:'Zona batial',classTag:'RELÍQUIA',name:'Núcleo do Peixe-Pescador',lore:'A boca permanece escancarada enquanto a isca pulsa. Depois, o corpo inteiro desaparece na água escura.'},
  {id:'maw',tier:'relic',habitat:'Fendas tectônicas',classTag:'RELÍQUIA',name:'Fragmento da Enguia-Pelícano',lore:'A mandíbula descomunal permanece intacta, agora ligada ao corpo longo e afilado da enguia-pelícano.'},
  {id:'devourer',tier:'relic',habitat:'Sem registro',classTag:'RELÍQUIA',name:'Núcleo Devorador',lore:'A pressão cai ao redor dele, como se a água estivesse sendo puxada para dentro.'},
  {id:'reefshark',tier:'surface',habitat:'Mar aberto',classTag:'PELÁGICA',name:'Tubarão-branco',lore:'Um predador perfeito não precisa parecer monstruoso para ser temido.'},
  {id:'hammerhead',tier:'surface',habitat:'Plataforma continental',classTag:'PELÁGICA',name:'Tubarão-martelo',lore:'O cefalofólio percebe movimentos que os olhos ainda não alcançaram.'},
  {id:'abysscroc',tier:'surface',habitat:'Manguezal',classTag:'COSTEIRA',name:'Predador de Mangue',lore:'Um caçador anfíbio adaptado a águas turvas e ataques de curta distância.'},
  {id:'armoredgator',tier:'surface',habitat:'Estuário',classTag:'COSTEIRA',name:'Couraçado de Estuário',lore:'O dorso blindado transforma a superfície da água em uma armadura móvel.'},
  {id:'greensnake',tier:'abyssal',habitat:'Fossa esmeralda',classTag:'MISSÃO',name:'Serpente Esmeralda',lore:'Uma forma reservada aos que provaram que o fundo também pode ser conquistado.'},
  {id:'electriceel',tier:'surface',habitat:'Águas tropicais',classTag:'BIOELÉTRICA',name:'Enguia Elétrica',lore:'Descargas percorrem a linha lateral antes de qualquer movimento de ataque.'}
];

// Correntes desenhadas uma vez em SVG; a animação fica a cargo do compositor CSS.
// Correntes de comprimentos e curvaturas irregulares: geometria estática e leve.
// The old orbital SVG/vortex is retired. Fossas keeps its existing dialog.
function createGate(){
  var menu=$('menuScreen');
  if(!menu||$('abyssDescentPanel'))return;
  var panel=document.createElement('section');
  panel.id='abyssDescentPanel';
  panel.className='abyss-descent-panel';
  panel.hidden=true;
  panel.innerHTML=
    '<div class="abyss-descent-dialog" role="dialog" aria-modal="true" aria-labelledby="abyssDescentTitle">'+
      '<button id="abyssDescentClose" class="abyss-descent-close" type="button" aria-label="Fechar">×</button>'+
      '<header class="abyss-descent-header">'+
        '<small>ONDE A LUZ NÃO ALCANÇA</small>'+
        '<h2 id="abyssDescentTitle">FOSSAS ABISSAIS</h2>'+
        '<p>Escolha como explorar as correntes mais profundas e enfrentar as criaturas que vivem nelas.</p>'+
      '</header>'+
      '<div class="abyss-descent-choices">'+
        '<button class="abyss-descent-choice" data-mode="solo" type="button">'+
          '<svg class="abyss-choice-icon abyss-fish-icon" viewBox="0 0 92 44" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M23 22C35 9 53 7 69 22C53 37 35 35 23 22Z"/><path d="M23 22 7 12v20l16-10Z"/><path d="m40 12 8-8 10 9M43 31l9 9 9-11"/><circle cx="59" cy="20" r="2.1" fill="currentColor" stroke="none"/></svg>'+
          '<strong>EXPLORAR SOZINHO</strong>'+
          '<em>Enfrente a escuridão, descubra espécies desconhecidas e sobreviva por conta própria.</em>'+
          '<small>Expedição solo · exploração individual</small>'+
        '</button>'+
        '<button class="abyss-descent-choice" data-mode="group" type="button">'+
          '<svg class="abyss-choice-icon abyss-fish-icon abyss-fish-school" viewBox="0 0 112 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><g transform="translate(0 2)"><path d="M12 13Q23 2 38 13Q23 24 12 13ZM12 13 2 6v14l10-7Z"/><circle cx="32" cy="11" r="1.7" fill="currentColor" stroke="none"/></g><g transform="translate(36 0)"><path d="M15 24Q30 8 49 24Q30 39 15 24ZM15 24 2 15v18l13-9Z"/><circle cx="42" cy="21" r="2" fill="currentColor" stroke="none"/></g><g transform="translate(82 22) scale(.7)"><path d="M12 13Q23 2 38 13Q23 24 12 13ZM12 13 2 6v14l10-7Z"/><circle cx="32" cy="11" r="1.7" fill="currentColor" stroke="none"/></g></svg>'+
          '<strong>MERGULHAR EM CARDUME</strong>'+
          '<em>Entre com outros mergulhadores, explore as fossas e enfrente as ameaças em equipe.</em>'+
          '<small>Expedição online · cardume cooperativo</small>'+
        '</button>'+
      '</div>'+
    '</div>';

  document.body.appendChild(panel);

  var portalTrigger=$('riftPortalBtn');
  var close=function(cancelled=true){panel.hidden=true;if(cancelled)window.dispatchEvent(new CustomEvent('abyssal-menu-portal-cancelled',{detail:{portal:'riftPortalBtn'}}));portalTrigger?.focus();};
  portalTrigger?.addEventListener('click',function(){
    panel.hidden=false;
    var first=panel.querySelector('[data-mode="solo"]');
    if(first)first.focus();
  });
  $('abyssDescentClose')?.addEventListener('click',close);
  panel.addEventListener('click',function(e){if(e.target===panel)close();});
  var solo=panel.querySelector('[data-mode="solo"]');
  var group=panel.querySelector('[data-mode="group"]');
  if(solo)solo.addEventListener('click',function(){close(false);updateDepthMeter(0);window.dispatchEvent(new CustomEvent('abyssal-start-rift-solo'));});
  if(group)group.addEventListener('click',function(){close(false);window.AbyssalPreferredRoomMode='rift';var mode=$('roomModeInput');if(mode)mode.value='rift';window.AbyssalOnline?.connectAndJoin?.();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden)close();});
}

const shopHabitatById=new Map(SPECIMENS.map(spec=>[spec.id,spec]));
window.AbyssalShopHabitat=id=>shopHabitatById.get(id)?.tier||'unclassified';
function decorateCards(){
 const grid=$('skinGrid');if(!grid)return;
 for(const card of grid.querySelectorAll('.skin-card[data-skin-id]')){
  const spec=shopHabitatById.get(card.dataset.skinId);
  if(!spec||card.classList.contains('unregistered')||card.querySelector('.abyss-specimen-meta'))continue;
  const meta=document.createElement('div');meta.className='abyss-specimen-meta';
  for(const value of ['Classe: '+spec.classTag,'Habitat: '+spec.habitat]){const tag=document.createElement('span');tag.className='abyss-specimen-badge';tag.textContent=value;meta.append(tag);}
  card.querySelector('.specimen-card-information')?.append(meta);
 }
}
function watchShop(){
  var grid=$('skinGrid');
  if(!grid)return;
  var scheduled=false;
  var schedule=function(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(function(){
      scheduled=false;
      decorateCards();
    });
  };
  new MutationObserver(schedule).observe(grid,{childList:true,subtree:false});
  schedule();
}

function retitleMenu(){
  var shopLabel=document.querySelector('#shopBtn .menu-action-label');
  if(shopLabel)shopLabel.textContent='CATÁLOGO DE ESPÉCIMES';

  var catalogLabel=document.querySelector('#catalogBtn .menu-action-label');
  if(catalogLabel)catalogLabel.textContent='ABYSSÁRIO';

  var intro=document.querySelector('#menuScreen .intro');
  if(intro)intro.textContent='Seu sinal atravessou uma região apagada dos mapas. O fundo respondeu. Agora cada descida revela algo que preferia continuar escondido.';
}


function createExpeditionUI(){
  if($('abyssExpeditionCheckpoint'))return;

  var hud=$('hud');
  if(hud){
    var meter=document.createElement('div');
    meter.id='abyssDepthMeter';
    meter.className='abyss-depth-meter';
    meter.hidden=true;
    meter.innerHTML='<small id="abyssZoneValue">LIMIAR DA LUZ</small><strong id="abyssDepthValue">0 M de Profundidade ☠</strong><span id="abyssRiskValue">SAQUE · 100%</span>';
    hud.appendChild(meter);
  }

  var panel=document.createElement('section');
  panel.id='abyssExpeditionCheckpoint';
  panel.className='abyss-checkpoint-panel';
  panel.hidden=true;
  panel.innerHTML=
    '<div class="abyss-checkpoint-card" role="dialog" aria-modal="true" aria-labelledby="abyssCheckpointTitle">'+
      '<span class="abyss-checkpoint-signal">SINAL ESTÁVEL · JANELA DE EXTRAÇÃO</span>'+
      '<h2 id="abyssCheckpointTitle">VOCÊ PODE SUBIR.</h2>'+
      '<p id="abyssCheckpointLore">A pressão abaixo deste ponto está aumentando.</p>'+
      '<div class="abyss-checkpoint-stats">'+
        '<div><small>PROFUNDIDADE</small><strong id="abyssCheckpointDepth">1.000 m</strong></div>'+
        '<div><small>BÔNUS DO ESPÉCIME</small><strong id="abyssCheckpointBonus">+0%</strong></div>'+
        '<div><small>ENERGIA COLETADA</small><strong>100% GARANTIDA</strong></div>'+
      '</div>'+
      '<div class="abyss-checkpoint-actions">'+
        '<button id="abyssContinueBtn" class="abyss-checkpoint-descend" type="button"><strong>CONTINUAR DESCENDO</strong><span id="abyssContinueHint">Explore a próxima zona.</span></button>'+
        '<button id="abyssExtractBtn" class="abyss-checkpoint-extract" type="button"><strong>VOLTAR À SUPERFÍCIE</strong><span>Garantir o saque e encerrar esta expedição.</span></button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(panel);

  var atmosphere=document.createElement('div');
  atmosphere.id='abyssEventAtmosphere';
  atmosphere.className='abyss-event-atmosphere';
  atmosphere.hidden=true;
  atmosphere.setAttribute('aria-hidden','true');
  document.body.appendChild(atmosphere);

  var eventBanner=document.createElement('aside');
  eventBanner.id='abyssEventBanner';
  eventBanner.className='abyss-event-banner';
  eventBanner.hidden=true;
  eventBanner.setAttribute('role','status');
  eventBanner.setAttribute('aria-live','polite');
  eventBanner.innerHTML='<small>ANOMALIA DA PROFUNDEZA</small><strong id="abyssEventName"></strong><span id="abyssEventCopy"></span>';
  document.body.appendChild(eventBanner);

  $('abyssContinueBtn')?.addEventListener('click',function(){
    panel.hidden=true;
    window.AbyssalGameHooks?.continueExpedition?.();
  });
  $('abyssExtractBtn')?.addEventListener('click',function(){
    panel.hidden=true;
    var meter=$('abyssDepthMeter');if(meter)meter.hidden=true;
    window.AbyssalGameHooks?.extractExpedition?.();
  });
}

function expeditionDepthForBosses(bosses){
  return 350+Math.max(0,Number(bosses)||0)*650;
}

var lastDepthState=null;
function updateDepthMeter(bosses,state){
  var meter=$('abyssDepthMeter');
  if(!meter)return;
  var count=Math.max(0,Number(bosses)||0);
  var roomMode=window.AbyssalGameHooks?.roomMode?.();
  var solo=window.AbyssalGameHooks?.expeditionState?.()?.active===true;
  if(window.AbyssalGameHooks?.isFossasActive?.()===false||roomMode==='pvp'||(!solo&&roomMode!=='rift')){meter.hidden=true;return;}
  meter.hidden=false;
  var depth=$('abyssDepthValue');
  var risk=$('abyssRiskValue');
  var zone=$('abyssZoneValue');
  var zoneData=state?.zone||window.AbyssalExpeditionRules?.zoneForBosses?.(count)||null;
  var depthValue=Number(state?.depth);
  if(!Number.isFinite(depthValue))depthValue=expeditionDepthForBosses(count);
  if(depth)depth.textContent=Math.round(depthValue).toLocaleString('pt-BR')+' M de Profundidade ☠';
  if(zone)zone.textContent=zoneData?.name||'PROFUNDIDADE NÃO CARTOGRAFADA';
  if(risk)risk.textContent=state?.event?.name?('EVENTO · '+state.event.name):(solo?'EXTRAÇÃO · +'+Math.round(Math.min(.75,count*.15)*100)+'%':'EXPEDIÇÃO · '+(zoneData?.shortName||'CO-OP'));
}

function applyDepthState(state){
  if(!state||typeof state!=='object')return;
  lastDepthState=state;
  var bosses=Math.max(0,Number(state.bossesDefeated)||0);
  updateDepthMeter(bosses,state);

  var banner=$('abyssEventBanner'),atmosphere=$('abyssEventAtmosphere'),event=state.event||null;
  document.body.classList.remove('abyss-event-predator_migration','abyss-event-black_current','abyss-event-resonance_bloom');
  if(!event){
    if(banner)banner.hidden=true;
    if(atmosphere)atmosphere.hidden=true;
    return;
  }
  document.body.classList.add('abyss-event-'+String(event.id||'').replace(/[^a-z0-9_-]/gi,''));
  if(atmosphere)atmosphere.hidden=false;
  if(banner){
    var name=$('abyssEventName'),copy=$('abyssEventCopy');
    if(name)name.textContent=event.name||'ANOMALIA';
    if(copy)copy.textContent=event.subtitle||'O ambiente mudou.';
    banner.hidden=false;
  }
}

function bindDepthState(){
  window.addEventListener('abyssal-depth-state',function(event){applyDepthState(event.detail||{});});
  window.addEventListener('abyssal-room-joined',function(event){if(event.detail?.room?.mode!=='rift')applyDepthState({bossesDefeated:0,depth:0,zone:null,event:null});});
  window.addEventListener('abyssal-room-left',function(){applyDepthState({bossesDefeated:0,depth:350,zone:window.AbyssalExpeditionRules?.zoneForBosses?.(0)||null,event:null});});
}

function bindExpeditionCheckpoints(){
  window.addEventListener('abyssal-expedition-checkpoint',function(event){
    var detail=event.detail||{};
    var bosses=Math.max(1,Number(detail.bossesKilled)||1);
    updateDepthMeter(bosses,lastDepthState);
    window.setTimeout(function(){
      var state=window.AbyssalGameHooks?.expeditionState?.();
      if(!state?.active)return;
      if(!window.AbyssalGameHooks?.pauseExpedition?.())return;

      var panel=$('abyssExpeditionCheckpoint');
      if(!panel)return;

      var depth=$('abyssCheckpointDepth');
      var bonus=$('abyssCheckpointBonus');
      var hint=$('abyssContinueHint');
      var lore=$('abyssCheckpointLore');

      if(depth)depth.textContent=expeditionDepthForBosses(bosses).toLocaleString('pt-BR')+' M de Profundidade ☠';
      if(bonus)bonus.textContent='+'+(Number(state.energyBonusPercent)||0)+'%';
      if(hint)hint.textContent='Desça até '+expeditionDepthForBosses(bosses+1).toLocaleString('pt-BR')+' m e encontre novas criaturas.';
      if(lore)lore.textContent=bosses>=4?'Há algo se movendo abaixo da zona mapeada.':bosses>=2?'O sonar está registrando formas maiores abaixo de você.':'A pressão abaixo deste ponto está aumentando.';

      panel.hidden=false;
      $('abyssContinueBtn')?.focus();
    },700);
  });
}


function init(){
  document.body.classList.add('abyss-rebuild-ready');
  retitleMenu();
  createGate();
  createExpeditionUI();
  bindExpeditionCheckpoints();
  bindDepthState();
  watchShop();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
