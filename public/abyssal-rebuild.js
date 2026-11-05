
(function(){
'use strict';
if(window.__abyssalRebuildV1)return;
window.__abyssalRebuildV1=true;

var $=function(id){return document.getElementById(id);};

var SPECIMENS=[
  {id:'default',tier:'core',habitat:'Núcleo',rarity:'ORIGEM',name:'Luz Abissal',lore:'O primeiro brilho. Pequeno demais para explicar por que as outras coisas o seguem.'},
  {id:'violet',tier:'deep',habitat:'Mesopelágico',rarity:'RARA',name:'Espectro Violeta',lore:'Uma forma espectral que parece existir alguns centímetros fora da água.'},
  {id:'solar',tier:'core',habitat:'Zona fótica',rarity:'INCOMUM',name:'Núcleo Solar',lore:'Fragmentos de luz presos em uma criatura que nunca deveria ter visto o sol.'},
  {id:'toxic',tier:'deep',habitat:'Fendas sulfurosas',rarity:'RARA',name:'Lodo Tóxico',lore:'As glândulas verdes continuam pulsando mesmo depois de separadas do hospedeiro.'},
  {id:'leviathan',tier:'relic',habitat:'Fossa hadal',rarity:'RELÍQUIA',name:'Eco do Leviatã',lore:'Não é o Leviatã. É apenas o que ficou preso em você depois de encontrá-lo.'},
  {id:'thorn',tier:'deep',habitat:'Recife negro',rarity:'RARA',name:'Coroa de Espinhos',lore:'Coral predatório calcificado em torno de um núcleo ainda consciente.'},
  {id:'abyssking',tier:'abyssal',habitat:'Setor interditado',rarity:'ABISSAL',name:'Soberano do Vazio',lore:'Uma coroa não significa que exista um reino. Às vezes significa que algo venceu tudo ao redor.'},
  {id:'royal',tier:'deep',habitat:'Talude profundo',rarity:'RARA',name:'Pérola Regente',lore:'Organismos luminescentes orbitam a criatura como se reconhecessem autoridade.'},
  {id:'glacier',tier:'deep',habitat:'Águas polares',rarity:'RARA',name:'Glaciar Fantasma',lore:'Cristais marinhos crescem sem reduzir a temperatura da água ao redor.'},
  {id:'coral',tier:'deep',habitat:'Recife afótico',rarity:'RARA',name:'Jardim Carnívoro',lore:'Não é um jardim. É uma colônia que aprendeu a caçar.'},
  {id:'bloodmoon',tier:'abyssal',habitat:'Zona de pressão',rarity:'ABISSAL',name:'Lua Sangrenta',lore:'A mandíbula fica mais visível quando o organismo está perto da morte.'},
  {id:'voidwing',tier:'deep',habitat:'Coluna oceânica',rarity:'RARA',name:'Manta do Nada',lore:'Membranas amplas cortam a água sem produzir o deslocamento esperado.'},
  {id:'abyssaleye',tier:'abyssal',habitat:'Desconhecido',rarity:'ABISSAL',name:'Olho do Insondável',lore:'O registro mostra a mesma íris olhando para câmeras instaladas em pontos diferentes.'},
  {id:'deepwarden',tier:'deep',habitat:'Fundo rochoso',rarity:'RARA',name:'Carcereiro das Fossas',lore:'Placas minerais se fecharam sobre um organismo que ainda tenta sair.'},
  {id:'kraken',tier:'relic',habitat:'Fossa hadal',rarity:'RELÍQUIA',name:'Eco do Kraken',lore:'O Kraken permanece lá embaixo. Isto é somente uma memória biológica dos seus tentáculos.'},
  {id:'aberration',tier:'relic',habitat:'Setor 07',rarity:'RELÍQUIA',name:'Casca da Aberração',lore:'Uma carapaça vazia. Ninguém conseguiu provar que a criatura a abandonou voluntariamente.'},
  {id:'angler',tier:'relic',habitat:'Zona batial',rarity:'RELÍQUIA',name:'Núcleo da Lanterna',lore:'A isca continua acesa. Coisas menores ainda se aproximam dela.'},
  {id:'maw',tier:'relic',habitat:'Fendas tectônicas',rarity:'RELÍQUIA',name:'Fragmento da Fenda',lore:'Uma mandíbula incompleta que ainda tenta fechar sobre qualquer fonte de calor.'},
  {id:'devourer',tier:'relic',habitat:'Sem registro',rarity:'RELÍQUIA',name:'Núcleo Devorador',lore:'A pressão cai ao redor dele, como se a água estivesse sendo puxada para dentro.'},
  {id:'reefshark',tier:'surface',habitat:'Mar aberto',rarity:'PELÁGICA',name:'Tubarão-branco',lore:'Um predador perfeito não precisa parecer monstruoso para ser temido.'},
  {id:'hammerhead',tier:'surface',habitat:'Plataforma continental',rarity:'PELÁGICA',name:'Tubarão-martelo',lore:'O cefalofólio percebe movimentos que os olhos ainda não alcançaram.'},
  {id:'abysscroc',tier:'surface',habitat:'Manguezal',rarity:'COSTEIRA',name:'Predador de Mangue',lore:'Um caçador anfíbio adaptado a águas turvas e ataques de curta distância.'},
  {id:'armoredgator',tier:'surface',habitat:'Estuário',rarity:'COSTEIRA',name:'Couraçado de Estuário',lore:'O dorso blindado transforma a superfície da água em uma armadura móvel.'},
  {id:'greensnake',tier:'abyssal',habitat:'Fossa esmeralda',rarity:'LENDÁRIA',name:'Serpente Esmeralda',lore:'Uma forma reservada aos que provaram que o fundo também pode ser conquistado.'},
  {id:'electriceel',tier:'surface',habitat:'Águas tropicais',rarity:'BIOELÉTRICA',name:'Enguia Elétrica',lore:'Descargas percorrem a linha lateral antes de qualquer movimento de ataque.'}
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

  var close=function(){panel.hidden=true;};
  $('abyssGateButton')?.addEventListener('click',function(){
    panel.hidden=false;
    var first=panel.querySelector('[data-mode="solo"]');
    if(first)first.focus();
  });
  $('abyssDescentClose')?.addEventListener('click',close);
  panel.addEventListener('click',function(e){if(e.target===panel)close();});
  var solo=panel.querySelector('[data-mode="solo"]');
  var group=panel.querySelector('[data-mode="group"]');
  if(solo)solo.addEventListener('click',function(){close();var b=$('playBtn');if(b)b.click();});
  if(group)group.addEventListener('click',function(){close();var b=$('onlineBtn');if(b)b.click();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden)close();});
}

function ensureShopChrome(){
  var grid=$('skinGrid');
  if(!grid)return;

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
    if(title)title.textContent=spec.name;

    var meta=card.querySelector('.abyss-specimen-meta');
    if(!meta){
      meta=document.createElement('div');
      meta.className='abyss-specimen-meta';
      var ability=card.querySelector('.skin-ability');
      card.insertBefore(meta,ability||card.querySelector('button'));
    }
    meta.innerHTML='<span class="abyss-specimen-badge '+spec.tier+'">'+spec.rarity+'</span><span class="abyss-specimen-badge">'+spec.habitat+'</span>';

    var lore=card.querySelector('.abyss-specimen-lore');
    if(!lore){
      lore=document.createElement('p');
      lore.className='abyss-specimen-lore';
      var ability2=card.querySelector('.skin-ability');
      card.insertBefore(lore,ability2||card.querySelector('button'));
    }
    lore.textContent=spec.lore;
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

function init(){
  document.body.classList.add('abyss-rebuild-ready');
  retitleMenu();
  createGate();
  watchShop();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
