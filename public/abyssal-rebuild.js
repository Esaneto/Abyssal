
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
  {id:'leviathan',tier:'relic',habitat:'Fossa hadal',classTag:'RELÍQUIA',name:'Eco do Leviatã',lore:'Não é o Leviatã. É apenas o que ficou preso em você depois de encontrá-lo.'},
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
  {id:'aberration',tier:'relic',habitat:'Setor 07',classTag:'RELÍQUIA',name:'Casca da Aberração',lore:'Uma carapaça vazia. Ninguém conseguiu provar que a criatura a abandonou voluntariamente.'},
  {id:'angler',tier:'relic',habitat:'Zona batial',classTag:'RELÍQUIA',name:'Núcleo da Lanterna',lore:'A isca continua acesa. Coisas menores ainda se aproximam dela.'},
  {id:'maw',tier:'relic',habitat:'Fendas tectônicas',classTag:'RELÍQUIA',name:'Fragmento da Fenda',lore:'Uma mandíbula incompleta que ainda tenta fechar sobre qualquer fonte de calor.'},
  {id:'devourer',tier:'relic',habitat:'Sem registro',classTag:'RELÍQUIA',name:'Núcleo Devorador',lore:'A pressão cai ao redor dele, como se a água estivesse sendo puxada para dentro.'},
  {id:'reefshark',tier:'surface',habitat:'Mar aberto',classTag:'PELÁGICA',name:'Tubarão-branco',lore:'Um predador perfeito não precisa parecer monstruoso para ser temido.'},
  {id:'hammerhead',tier:'surface',habitat:'Plataforma continental',classTag:'PELÁGICA',name:'Tubarão-martelo',lore:'O cefalofólio percebe movimentos que os olhos ainda não alcançaram.'},
  {id:'abysscroc',tier:'surface',habitat:'Manguezal',classTag:'COSTEIRA',name:'Predador de Mangue',lore:'Um caçador anfíbio adaptado a águas turvas e ataques de curta distância.'},
  {id:'armoredgator',tier:'surface',habitat:'Estuário',classTag:'COSTEIRA',name:'Couraçado de Estuário',lore:'O dorso blindado transforma a superfície da água em uma armadura móvel.'},
  {id:'greensnake',tier:'abyssal',habitat:'Fossa esmeralda',classTag:'MISSÃO',name:'Serpente Esmeralda',lore:'Uma forma reservada aos que provaram que o fundo também pode ser conquistado.'},
  {id:'electriceel',tier:'surface',habitat:'Águas tropicais',classTag:'BIOELÉTRICA',name:'Enguia Elétrica',lore:'Descargas percorrem a linha lateral antes de qualquer movimento de ataque.'}
];

var activeFilter='all';

function createGate(){
  var menu=$('menuScreen');
  if(!menu||$('abyssGate'))return;

  var gate=document.createElement('aside');
  gate.id='abyssGate';
  gate.className='abyss-gate';
  gate.setAttribute('aria-label','Entrada para a Descida Abissal');
  gate.innerHTML=
    '<div class="abyss-gate-rim" aria-hidden="true"></div>'+
    '<div class="abyss-gate-depth" aria-hidden="true"><span class="abyss-gate-eye"></span></div>'+
    '<div class="abyss-gate-content">'+
      '<span class="abyss-gate-kicker">SINAL ABAIXO DO LIMITE CARTOGRAFADO</span>'+
      '<strong>DESCIDA ABISSAL</strong>'+
      '<p>Quanto mais fundo você for, maior a recompensa. Voltar ainda é uma escolha.</p>'+
      '<button id="abyssGateButton" class="abyss-gate-button" type="button">ABRIR A FENDA</button>'+
    '</div>';

  var fauna=menu.querySelector('.menu-fauna');
  menu.insertBefore(gate,fauna||menu.lastChild);

  var panel=document.createElement('section');
  panel.id='abyssDescentPanel';
  panel.className='abyss-descent-panel';
  panel.hidden=true;
  panel.innerHTML=
    '<div class="abyss-descent-dialog" role="dialog" aria-modal="true" aria-labelledby="abyssDescentTitle">'+
      '<button id="abyssDescentClose" class="abyss-descent-close" type="button" aria-label="Fechar">×</button>'+
      '<header class="abyss-descent-header">'+
        '<small>ESCOLHA COMO RESPONDER AO CHAMADO</small>'+
        '<h2 id="abyssDescentTitle">DESCIDA ABISSAL</h2>'+
        '<p>O fundo não promete que a subida será possível.</p>'+
      '</header>'+
      '<div class="abyss-descent-choices">'+
        '<button class="abyss-descent-choice" data-mode="solo" type="button">'+
          '<span class="abyss-choice-icon" aria-hidden="true">◌</span>'+
          '<strong>DESCER SOZINHO</strong>'+
          '<em>Ninguém voltou para contar o que existe depois da última luz.</em>'+
          '<small>Expedição solo · resposta imediata</small>'+
        '</button>'+
        '<button class="abyss-descent-choice" data-mode="group" type="button">'+
          '<span class="abyss-choice-icon" aria-hidden="true">◉ ◉</span>'+
          '<strong>DESCER EM CARDUME</strong>'+
          '<em>Os que voltaram trouxeram alguma coisa com eles.</em>'+
          '<small>Expedição online · tripulação compartilhada</small>'+
        '</button>'+
      '</div>'+
    '</div>';

  document.body.appendChild(panel);

  var close=function(){panel.hidden=true;$('abyssGateButton')?.focus();};
  gate.addEventListener('click',function(e){if(e.target!==$('abyssGateButton'))$('abyssGateButton').click();});
  $('abyssGateButton')?.addEventListener('click',function(){
    panel.hidden=false;
    var first=panel.querySelector('[data-mode="solo"]');
    if(first)first.focus();
  });
  $('abyssDescentClose')?.addEventListener('click',close);
  panel.addEventListener('click',function(e){if(e.target===panel)close();});
  var solo=panel.querySelector('[data-mode="solo"]');
  var group=panel.querySelector('[data-mode="group"]');
  if(solo)solo.addEventListener('click',function(){close();updateDepthMeter(0);window.dispatchEvent(new CustomEvent('abyssal-start-rift-solo'));});
  if(group)group.addEventListener('click',function(){close();window.AbyssalPreferredRoomMode='rift';var mode=$('roomModeInput');if(mode)mode.value='rift';window.AbyssalOnline?.connectAndJoin?.();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden)close();});
}

function ensureShopChrome(){
  var grid=$('skinGrid');
  if(!grid)return;

  if(!$('marineSearch')){
    var search=document.createElement('input');search.id='marineSearch';search.type='search';search.placeholder='Buscar espécie ou habilidade';search.setAttribute('aria-label','Buscar espécie ou habilidade');search.className='text-field';
    grid.before(search);search.addEventListener('input',function(){var term=search.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();Array.from(grid.children).forEach(function(card){card.hidden=!card.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term);});});
  }

  var heading=document.querySelector('#shopScreen .shop-heading h2');
  if(heading)heading.innerHTML='CATÁLOGO<br><em>DE ESPÉCIMES</em>';

  var eyebrow=document.querySelector('#shopScreen .eyebrow');
  if(eyebrow)eyebrow.innerHTML='<span class="pulse-dot"></span> ARQUIVO BIOLÓGICO · SETORES MAPEADOS';

  var section=document.querySelector('#shopScreen .shop-section-title');
  if(section)section.textContent='✦ FORMAS REGISTRADAS · PRÉVIA EM COMBATE';

  if(!document.querySelector('#shopScreen .abyss-skin-filters')){
    var intro=document.createElement('p');
    intro.className='abyss-specimen-intro';
    intro.textContent='Formas comuns sobrevivem perto da luz. As Relíquias carregam apenas vestígios dos horrores que continuam nas fossas. Chefes e elites verdadeiros não são domesticados.';

    var filters=document.createElement('div');
    filters.className='abyss-skin-filters';
    filters.setAttribute('aria-label','Filtrar catálogo de espécies');

    [['all','TODOS'],['surface','SUPERFÍCIE'],['deep','PROFUNDIDADE'],['abyssal','ABISSAIS'],['relic','RELÍQUIAS']].forEach(function(item){
      var key=item[0],label=item[1];
      var b=document.createElement('button');
      b.type='button';
      b.className='abyss-skin-filter'+(key==='all'?' active':'');
      b.dataset.filter=key;
      b.textContent=label;
      b.addEventListener('click',function(){
        activeFilter=key;
        filters.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b);});
        decorateCards();
      });
      filters.appendChild(b);
    });

    grid.parentNode.insertBefore(intro,grid);
    grid.parentNode.insertBefore(filters,grid);
  }
}

function decorateCards(){
  var grid=$('skinGrid');
  if(!grid)return;
  ensureShopChrome();

  var cards=Array.from(grid.children).filter(function(el){
    return el.classList.contains('skin-card')&&!el.classList.contains('boss-bundle-card');
  });

  cards.forEach(function(card,index){
    var spec=SPECIMENS[index];
    if(!spec)return;

    card.dataset.skinId=spec.id;
    card.dataset.abyssTier=spec.tier;
    card.classList.toggle('abyss-filtered-out',activeFilter!=='all'&&spec.tier!==activeFilter);

    var title=card.querySelector(':scope > strong');
    // Canonical species names belong to the gameplay catalog, never the legacy lore table.

    var meta=card.querySelector('.abyss-specimen-meta');
    if(!meta){
      meta=document.createElement('div');
      meta.className='abyss-specimen-meta';
      var ability=card.querySelector('.skin-ability');
      card.insertBefore(meta,ability||card.querySelector('button'));
    }
    meta.innerHTML='<span class="abyss-specimen-badge '+spec.tier+'">CLASSE · '+spec.classTag+'</span><span class="abyss-specimen-badge">HABITAT · '+spec.habitat+'</span>';

    var lore=card.querySelector('.abyss-specimen-lore');
    if(!lore){
      lore=document.createElement('p');
      lore.className='abyss-specimen-lore';
      var ability2=card.querySelector('.skin-ability');
      card.insertBefore(lore,ability2||card.querySelector('button'));
    }
    lore.textContent='';
  });

  var bundle=grid.querySelector('.boss-bundle-card');
  if(bundle){
    var title2=bundle.querySelector('strong');
    if(title2)title2.textContent='COLEÇÃO · RELÍQUIAS DO ABISMO';
    var desc=bundle.querySelector(':scope > p:not(.boss-bundle-count)');
    if(desc)desc.textContent='Vestígios dos seis grandes horrores. As criaturas verdadeiras continuam reservadas às profundezas.';
    bundle.dataset.abyssTier='relic';
    bundle.classList.toggle('abyss-filtered-out',activeFilter!=='all'&&activeFilter!=='relic');
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
    meter.innerHTML='<small id="abyssZoneValue">LIMIAR DA LUZ</small><strong id="abyssDepthValue">350 m</strong><span id="abyssRiskValue">SAQUE · 100%</span>';
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
        '<div><small>BÔNUS SE EXTRAIR</small><strong id="abyssCheckpointBonus">+15%</strong></div>'+
        '<div><small>SE O SINAL FOR PERDIDO</small><strong>65% DO SAQUE FINAL</strong></div>'+
      '</div>'+
      '<div class="abyss-checkpoint-actions">'+
        '<button id="abyssContinueBtn" class="abyss-checkpoint-descend" type="button"><strong>CONTINUAR DESCENDO</strong><span id="abyssContinueHint">A próxima zona paga mais.</span></button>'+
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
  if(roomMode==='pvp'||(!solo&&roomMode!=='rift')){meter.hidden=true;return;}
  meter.hidden=false;
  var depth=$('abyssDepthValue');
  var risk=$('abyssRiskValue');
  var zone=$('abyssZoneValue');
  var zoneData=state?.zone||window.AbyssalExpeditionRules?.zoneForBosses?.(count)||null;
  var depthValue=Number(state?.depth);
  if(!Number.isFinite(depthValue))depthValue=expeditionDepthForBosses(count);
  if(depth)depth.textContent=Math.round(depthValue).toLocaleString('pt-BR')+' m';
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

      if(depth)depth.textContent=expeditionDepthForBosses(bosses).toLocaleString('pt-BR')+' m';
      if(bonus)bonus.textContent='+'+Math.round(Math.min(.75,bosses*.15)*100)+'%';
      if(hint)hint.textContent='Desça até '+expeditionDepthForBosses(bosses+1).toLocaleString('pt-BR')+' m e aumente o bônus.';
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
