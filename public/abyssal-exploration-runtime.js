/* Exploration HUD and gathering. Online resources and vitals are server-owned.
 * Offline solo uses a separate local cache; never uploads unverified materials.
 */
(function(){
 'use strict';
 const oceanGeo=window.AbyssalOceanGeography,config=window.AbyssalExplorationConfig,research=window.AbyssalResearchSystem,fields=window.AbyssalResourceFields,stream=window.AbyssalOceanStream;
 const inventoryUI=()=>window.AbyssalInventoryUI;
 const Offshore=window.AbyssalOffshoreSystem;
 if(!config||!research||!fields)return;
 const $=id=>document.getElementById(id);
 const shell=$('gameShell'),canvas=$('game');if(!shell||!canvas)return;
 const hud=document.createElement('section');
 hud.id='explorationOverlay';hud.className='exploration-overlay';hud.hidden=true;
 hud.innerHTML='<div class="exploration-stat exploration-instruments"><span class="exploration-tag">EXPLORAÇÃO — MAR ABERTO</span><strong id="explorationDepth">PROF. 0 m</strong><strong id="explorationPressure">PRESSÃO 1.0 atm</strong><div class="exploration-oxygen-row"><span class="metric-oxy-label">OXIGÊNIO</span> <strong id="explorationGas" class="metric-oxygen">100%</strong></div><div class="exploration-track"><i id="explorationGasFill"></i></div><small id="explorationPressureWarning"></small><small id="explorationBiome" hidden>REGIÃO · RECIFES E COSTA</small></div>'+
 '<div class="exploration-stat exploration-collect"><span>COLETA · SEGURE G OU CLIQUE NO DEPÓSITO</span><strong id="explorationDeposit">PROCURANDO SINAIS...</strong><small id="explorationGatherStatus">Aproxime-se de uma rocha ou exsudação para interagir.</small><div class="exploration-work-track"><i id="explorationWorkFill"></i></div><button type="button" id="explorationGatherBtn" disabled>SEGURE PARA EXTRAIR</button></div>';
 const signal=document.createElement('div');signal.id='explorationRiftSignals';signal.className='exploration-stat exploration-sonar';signal.hidden=true;
 signal.innerHTML='<span>RADAR / SONAR DAS FOSSAS</span><strong id="explorationRiftSignalText">BUSCANDO ANOMALIAS</strong>';
 hud.appendChild(signal);
 shell.appendChild(hud);
 hud.querySelector('.exploration-collect').hidden=true; // Legacy extraction panel removed from visible gameplay; G and clicks still extract.
 const markers=document.createElement('canvas');markers.id='explorationMarkers';markers.setAttribute('aria-hidden','true');markers.style.pointerEvents='none';markers.hidden=true;shell.appendChild(markers);
 const cfg=()=>window.AbyssalGameHooks?.explorationPosition?.();
 const workshop=document.getElementById('submarineWorkshop'),workshopGrid=document.getElementById('submarineWorkshopGrid');
 let activeLabSection='survival',activeConsoleSection='laboratory',soloConsolePage='home';
 // Move the original live screens, not copies: purchases, filters, canvases,
 // ownership and catalog discovery retain their existing IDs and listeners.
 let embeddedCatalog=null,skipEmbeddedOpen=false,loginReturn='profile',publicProfileReturn='cardumes';
 const embeddedPages=Object.freeze({shop:'shopScreen',specimens:'catalogScreen',profile:'profileScreen',cardumes:'cardumesScreen',resonance:'resonanceScreen',login:'loginScreen',recovery:'passwordRecoveryScreen',notices:'notifPanel',download:'downloadScreen'});
 const embeddedTitles=Object.freeze({profile:'PERFIL',cardumes:'CARDUMES',resonance:'RESSONÂNCIA',login:'IDENTIFICAÇÃO DO MERGULHADOR',recovery:'RECUPERAR ACESSO',notices:'CENTRAL DE AVISOS',download:'BAIXAR ABYSSAL',language:'IDIOMA',controls:'CONTROLES',zoom:'ZOOM DA CÂMERA',volume:'VOLUME',filter:'FILTRO VISUAL',fullscreen:'TELA CHEIA'});
 function navigateEmbedded(id,skip=false){if(!workshop||workshop.hidden)return false;const page=Object.keys(embeddedPages).find(key=>embeddedPages[key]===id);if(!page)return false;if(embeddedCatalog?.screen.id===id)return false;if(page==='login'&&activeConsoleSection!=='login'&&activeConsoleSection!=='recovery')loginReturn=activeConsoleSection;if(page==='profile'&&skip&&activeConsoleSection==='cardumes')publicProfileReturn='cardumes';else if(page==='profile'&&!skip)publicProfileReturn='solo';activeConsoleSection=page;skipEmbeddedOpen=skip;renderWorkshop();return true;}
 const commandPages=new Set(['language','controls','zoom','volume','filter','fullscreen']);
 function navigateCommand(page){if(!workshop||workshop.hidden)return false;if(page==='notices'||page==='download')return navigateEmbedded(embeddedPages[page]);if(!commandPages.has(page))return false;activeConsoleSection=page;renderWorkshop();return true;}
 function backEmbedded(){const page=activeConsoleSection==='login'?loginReturn:activeConsoleSection==='recovery'?'login':activeConsoleSection==='profile'?publicProfileReturn:'solo';activeConsoleSection=page;renderWorkshop();}
 function restoreEmbeddedCatalog(){
  if(!embeddedCatalog)return;
  const {screen,anchor,role,modal,modalRole,modalAria}=embeddedCatalog;embeddedCatalog=null;
  screen.hidden=true;screen.classList.remove('abyss-cockpit-embedded');
  if(role===null)screen.removeAttribute('role');else screen.setAttribute('role',role);
  if(modal){if(modalAria===null)modal.removeAttribute('aria-modal');else modal.setAttribute('aria-modal',modalAria);if(modalRole===null)modal.removeAttribute('role');else modal.setAttribute('role',modalRole);}
  if(screen.id==='notifPanel')screen.setAttribute('aria-modal','true');anchor.replaceWith(screen);
 }
 function embedCatalog(body,id){
  const screen=$(id);if(!screen)return;
  const anchor=document.createComment('original '+id+' location');
  screen.before(anchor);
  const modal=screen.querySelector('.modal-card,#notifPanelInner'),role=screen.getAttribute('role'),modalRole=modal?.getAttribute('role'),modalAria=modal?.getAttribute('aria-modal');
  embeddedCatalog={screen,anchor,role,modal,modalRole,modalAria};
  screen.classList.add('abyss-cockpit-embedded');screen.setAttribute('role','region');if(id==='notifPanel')screen.removeAttribute('aria-modal');
  if(modal){modal.removeAttribute('aria-modal');modal.setAttribute('role','region');}
  body.append(screen);screen.hidden=false;
  // Render directly, bypassing any external-menu click or feature gate.
  const skip=skipEmbeddedOpen;skipEmbeddedOpen=false;if(skip)return;
  if(id==='profileScreen')window.AbyssalOnline?.openProfile?.();else if(id==='cardumesScreen')window.AbyssalOnline?.openCardumes?.();else if(id==='loginScreen')window.AbyssalOnline?.openLogin?.();else if(id==='resonanceScreen')$('resonanceBtn')?.click();else if(id==='notifPanel')window.openAbyssalNotifications?.();else if(id==='downloadScreen')$('downloadBtn')?.click();else if(id!=='passwordRecoveryScreen')window.AbyssalCockpitCatalog?.open(id);
 }
 function installEmbeddedClose(id){
  const screen=$(id);if(!screen)return;
  screen.addEventListener('click',event=>{
   if(embeddedCatalog?.screen!==screen)return;
   const button=event.target.closest?.('#shopCloseBtn,#shopTopCloseBtn,#catalogCloseBtn,#profileCloseBtn,#cardumesCloseBtn,#loginCancelBtn,#notifPanelClose,#downloadCloseBtn,[data-close-screen]');
   if(!button)return;
   event.preventDefault();event.stopImmediatePropagation();
   backEmbedded();
  },true);
 }
 for(const id of Object.values(embeddedPages))installEmbeddedClose(id);
 const LAB_SECTIONS=Object.freeze([
  {id:'survival',label:'SOBREVIVÊNCIA',groups:['essential','equipment']},
  {id:'weapons',label:'ARMAMENTO · EM DESENVOLVIMENTO',groups:['starter']},
  {id:'industry',label:'ENGENHARIA OFFSHORE',groups:['industry']}
 ]);
 const visorScrollByPage=new Map();
 function renderWorkshop(){
  if(!workshopGrid)return;
  const previous=workshopGrid.querySelector('.abyss-visor-body');
  if(previous?.dataset.pageKey)visorScrollByPage.set(previous.dataset.pageKey,previous.scrollTop);
  renderWorkshopContent();
  const current=workshopGrid.querySelector('.abyss-visor-body');
  if(current){const position=visorScrollByPage.get(current.dataset.pageKey)||0;current.scrollTop=position;}
 }
 function renderWorkshopContent(){
  if(!workshopGrid)return;
  restoreEmbeddedCatalog();
  if(activeConsoleSection!=='laboratory'){renderConsoleUtility();return;}
  const levels=stateLevels(),inventory=research.sanitizeInventory(stateInventory()),offshore=currentOffshore();
  workshopGrid.replaceChildren();
  const title=document.createElement('div');title.className='submarine-console-overview';
  const researched=Object.entries(config.RESEARCH).filter(([id,def])=>Number(levels[id])>0&&!def.starter).length;
  title.innerHTML='<small>CENTRAL DE CONTROLE · '+(localResearchMode()?'EXPEDIÇÃO SOLO / DISPOSITIVO':'CONTA ONLINE / SERVIDOR')+'</small><strong>LABORATÓRIO ABISSAL</strong><span>TECNOLOGIAS '+researched+'/'+Object.keys(config.RESEARCH).length+' · SISTEMA DE ILUMINAÇÃO: NÍVEL '+(Number(levels.helmetLamp)||0)+'/3 · PLATAFORMA: '+(levels.offshorePlatform?'OPERACIONAL':'NÃO CONSTRUÍDA')+'</span>';
  workshopGrid.appendChild(title);
  const nav=document.createElement('nav');nav.className='submarine-console-tabs';nav.setAttribute('aria-label','Estações de pesquisa');
  for(const item of LAB_SECTIONS){
   const button=document.createElement('button');button.type='button';
   button.className='submarine-console-tab'+(activeLabSection===item.id?' is-active':'');
   button.setAttribute('aria-pressed',String(activeLabSection===item.id));
   button.textContent=item.label;
   button.addEventListener('click',()=>{activeLabSection=item.id;renderWorkshop();});
   nav.appendChild(button);
  }
  workshopGrid.appendChild(nav);
  const materials=document.createElement('div');materials.className='submarine-console-stock';
  const stocks=Object.entries(inventory).filter(([id,n])=>n>0&&id!=='abyssWeapon').slice(0,7);
  materials.textContent='MATERIAIS DISPONÍVEIS   '+(stocks.length?stocks.map(([id,n])=>(config.RESOURCES[id]?.name||id)+' '+n).join('  ·  '):'SEM ESTOQUE');
  workshopGrid.appendChild(materials);
  if(activeLabSection==='industry'){
   const panel=document.createElement('div');panel.className='submarine-console-production';
   if(levels.offshorePlatform){
    const cap=offshoreCapacity(),rates=offshoreRates();
    const oil=Math.min(100,offshore.oil/cap*100),gas=Math.min(100,offshore.gas/cap*100);
    panel.innerHTML='<small>MÓDULO DE PRODUÇÃO OFFSHORE · '+(offshore.connections.length?'FLUXO ATIVO':'AGUARDANDO POÇOS')+'</small><strong>ESTOQUES DA UNIDADE FLUTUANTE</strong>'+
     '<div class="submarine-console-meter"><b>PETRÓLEO</b><i><em style="width:'+oil+'%"></em></i><span>'+offshore.oil.toFixed(1)+' / '+cap+' · '+(rates.oil*60).toFixed(1)+'/min</span></div>'+
     '<div class="submarine-console-meter gas"><b>GÁS NATURAL</b><i><em style="width:'+gas+'%"></em></i><span>'+offshore.gas.toFixed(1)+' / '+cap+' · '+(rates.gas*60).toFixed(1)+'/min</span></div>'+
     '<small>RESERVAS CONECTADAS: '+offshore.connections.length+'/'+Math.max(1,Number(levels.subseaUmbilical)||0)+(offshore.installation?' · DUTO EM INSTALAÇÃO: '+(offshore.installation.phase==='laying'?'FIXAR NA RESERVA':'RETORNAR AO FPSO'):'')+'</small>';
   }else panel.innerHTML='<small>MÓDULO DE PRODUÇÃO OFFSHORE</small><strong>PLATAFORMA AINDA NÃO CONSTRUÍDA</strong><p>Estude geofísica, descubra reservatórios e construa a unidade flutuante para liberar esta estação.</p>';
   workshopGrid.appendChild(panel);
  }
  const selected=LAB_SECTIONS.find(entry=>entry.id===activeLabSection)||LAB_SECTIONS[0];
  const visible=Object.entries(config.RESEARCH).filter(([,def])=>selected.groups.includes(def.group));
  const cardGrid=document.createElement('div');cardGrid.className='submarine-console-card-grid';
  for(const [id,def] of visible){
   const level=Number(levels[id])||0,cost=research.costFor(id,level)||{},offshoreCost=research.offshoreCostFor?.(id,level)||{};
   const available=research.study(id,levels,inventory,offshore);
   const card=document.createElement('article');card.className='submarine-console-card'+(level>=def.max?' is-complete':'');
   const status=window.AbyssalLaunchFocus?.soloOnly?'EM DESENVOLVIMENTO':def.starter?'EQUIPAMENTO ESSENCIAL':level>=def.max?'PESQUISA CONCLUÍDA':available.ok?'DISPONÍVEL':available.reason==='prerequisite'?'BLOQUEADA':available.reason==='offshore-resources'?'AGUARDANDO PRODUÇÃO OFFSHORE':'MATERIAIS INSUFICIENTES';
   const header=document.createElement('small');header.textContent=status;const h=document.createElement('strong');h.textContent=def.name+'  '+level+'/'+def.max;
   const desc=document.createElement('p');desc.textContent=def.description||((def.group==='active'?'Habilidade '+(def.slot||''):def.group==='shot'?'Tecnologia de disparo':def.group==='passive'?'Tecnologia passiva':'Sistema do traje')+'.');
   const req=document.createElement('span');req.className='abyss-mineral-requirements';
   function addReq(id,n){
    const tag=document.createElement('span');tag.className='abyss-requirement';
    const art=document.createElement('span');art.innerHTML=window.AbyssalResourceIcons?.svg?.(id)||'';
    const label=document.createElement('span');label.textContent=(config.RESOURCES[id]?.name||id)+' ×'+n;
    tag.append(art,label);req.append(tag);
   }
   if(level>=def.max)req.textContent='MÓDULO INSTALADO';
   else{
    for(const [material,n] of Object.entries(cost))addReq(material,n);
    for(const [type,n] of Object.entries(offshoreCost))if(n>0)addReq(type==='oil'?'oilSeep':'gasSeep',n);
    if(!req.childNodes.length)req.textContent='SEM CUSTO';
    if(available.reason==='prerequisite'){
     const missing=document.createElement('small');missing.textContent='REQUER: '+(def.requires||[]).filter(dep=>!levels[dep]).map(dep=>config.RESEARCH[dep]?.name||dep).join(', ');req.append(missing);
    }
   }
   const button=document.createElement('button');button.type='button';button.className='secondary-btn';
   button.textContent=def.starter?'ATIVO':level>=def.max?'CONCLUÍDO':available.reason==='prerequisite'?'REQUER PESQUISA':available.reason==='resources'?'FALTAM MINÉRIOS':available.reason==='offshore-resources'?'AGUARDANDO PETRÓLEO/GÁS':'PESQUISAR';
   button.disabled=Boolean(window.AbyssalLaunchFocus?.soloOnly)||Boolean(def.starter)||!available.ok;
   if(window.AbyssalLaunchFocus?.soloOnly)button.textContent='EM DESENVOLVIMENTO';
   button.addEventListener('click',()=>{
    if(window.AbyssalLaunchFocus?.soloOnly)return;
    button.disabled=true;
    const done=result=>{
     if(result?.ok){
      if(result.account)account=result.account;
      else{
       localLevels=result.levels;localInventory=result.inventory;
       if(result.offshore)offshore=result.offshore;
       if(id==='subseaUmbilical')localInventory.offshoreCable=Math.max(Number(localInventory.offshoreCable)||0,Number(result.level)||1);
       saveLocal();inventoryUI()?.setInventory(localInventory);
       window.AbyssalGameHooks?.applyResearchUnlock?.(id,result.level);
      }
      renderWorkshop();
     }else{button.disabled=false;req.textContent='FALHA: '+String(result?.reason||'erro');}
    };
    if(account&&!localResearchMode())window.AbyssalOnline?.explorationStudy?.(id,done);
    else done(research.study(id,localLevels,localInventory,currentOffshore()));
   });
   card.append(header,h,desc,req,button);cardGrid.appendChild(card);
  }
  workshopGrid.appendChild(cardGrid);
  mountCockpitConsole();
 }

 // Seven actual console keys share one built-in display. They never create
 // duplicate floating menus on top of the submarine dashboard.
 const CONSOLE_BUTTONS=Object.freeze([
  {id:'solo',name:'MERGULHAR',symbol:'≈',title:'MERGULHAR'},
  {id:'shop',name:'ESPÉCIMES',symbol:'▣',title:'ESPÉCIMES'},
  {id:'specimens',name:'ABYSSÁRIO',symbol:'◈',title:'ABYSSÁRIO'},
  {id:'laboratory',name:'LABORATÓRIO',symbol:'⌬',title:'LABORATÓRIO ABISSAL',locked:true},
  {id:'minerals',name:'MINÉRIOS',symbol:'◆',title:'AMOSTRAS GEOLÓGICAS',locked:true},
  {id:'sea',name:'MAR ABERTO',symbol:'≈',title:'EXPLORAÇÃO OCEÂNICA',locked:true},
  {id:'rift',name:'FOSSAS',symbol:'⌄',title:'FOSSAS ABISSAIS',locked:true}
 ]);
 function mountCockpitConsole(utility){
  const old=utility?[utility]:Array.from(workshopGrid.children);
  const chosen=CONSOLE_BUTTONS.find(option=>option.id===activeConsoleSection)||CONSOLE_BUTTONS[0];
  const visor=document.createElement('section');visor.className='abyss-cockpit-visor';
  visor.setAttribute('aria-label','Visor central de comandos');
  const heading=document.createElement('header');heading.className='abyss-visor-heading';
  const column=document.createElement('div'),small=document.createElement('small'),title=document.createElement('strong');
  small.textContent='ABYSSAL / CENTRAL DE COMANDOS';title.textContent=activeConsoleSection==='solo'&&soloConsolePage!=='home'?(soloConsolePage==='diver'?'PESQUISA · MERGULHADOR':'PESQUISA · SUBMARINO'):embeddedTitles[activeConsoleSection]||chosen.title;column.append(small,title);
  const status=document.createElement('span');status.textContent=localResearchMode()?'EXPEDIÇÃO SOLO':'CONTA ONLINE';
  heading.append(column,status);visor.append(heading);
  const body=document.createElement('div');body.className='abyss-visor-body';body.tabIndex=0;body.dataset.pageKey=activeConsoleSection+':'+(activeConsoleSection==='solo'?soloConsolePage:activeConsoleSection==='laboratory'?activeLabSection:'main');
  for(const node of old){
   if(node.classList.contains('submarine-console-overview'))continue;
   if(node.classList.contains('submarine-console-tabs'))node.classList.add('abyss-lab-subnav');
   body.append(node);
  }
  visor.append(body);
  const keys=document.createElement('nav');keys.className='abyss-control-deck';keys.setAttribute('aria-label','Controles físicos da cabine');
  for(const option of CONSOLE_BUTTONS){
   const key=document.createElement('button');key.type='button';
   key.className='abyss-control-key abyss-control-'+option.id+(option.id===activeConsoleSection?' is-active':'');
   key.setAttribute('aria-label',option.name);
   key.setAttribute('aria-pressed',String(option.id===activeConsoleSection));
   if(option.locked){key.dataset.abyssLocked='true';key.setAttribute('aria-description','Em desenvolvimento. Disponível futuramente.');}
   const symbol=document.createElement('span');symbol.className='abyss-control-icon';
   symbol.textContent=option.symbol;symbol.setAttribute('aria-hidden','true');
   const name=document.createElement('span');name.textContent=option.name;
   key.append(symbol,name);
   key.addEventListener('click',()=>{
    if(option.locked){window.AbyssalLaunchFocus?.notify?.();return;}
    if(activeConsoleSection!==option.id){activeConsoleSection=option.id;soloConsolePage='home';renderWorkshop();}
   });
   keys.append(key);
  }
  // Show scrolling guidance only when the actual monitor contains hidden rows.
  const hint=document.createElement('span');
  hint.className='abyss-visor-scroll-hint';
  hint.textContent='▾ ROLE OU DESLIZE PARA VER MAIS';
  hint.setAttribute('aria-hidden','true');hint.hidden=true;visor.append(hint);
  const refreshHint=()=>{hint.hidden=body.scrollHeight<=body.clientHeight+5
   ||body.scrollTop+body.clientHeight>=body.scrollHeight-5;};
  body.addEventListener('scroll',refreshHint,{passive:true});
  requestAnimationFrame(refreshHint);
  workshopGrid.replaceChildren(visor,keys);
  for(const [id,page] of [['cockpitProfileBtn','profile'],['cockpitCardumesBtn','cardumes']])$(id)?.setAttribute('aria-pressed',String(activeConsoleSection===page));
  workshop.querySelectorAll('[data-cockpit-setting],[data-cockpit-proxy]').forEach(button=>{const page=button.dataset.cockpitSetting||({notifBtn:'notices',mobileDownloadTopBtn:'download',fullscreenBtn:'fullscreen'})[button.dataset.cockpitProxy];button.setAttribute('aria-pressed',String(page===activeConsoleSection));});
  if(embeddedPages[activeConsoleSection])embedCatalog(body,embeddedPages[activeConsoleSection]);
 }
 function createSoloResearchNav(){
  const group=document.createElement('section');group.className='solo-research-navigation';
  const title=document.createElement('h3');title.className='solo-research-heading';title.textContent='PESQUISA';group.append(title);
  const nav=document.createElement('nav');nav.className='solo-upgrade-nav solo-research-tabs';nav.setAttribute('aria-label','Áreas de pesquisa');
  for(const item of [{id:'diver',label:'MERGULHADOR'},{id:'submarine',label:'SUBMARINO'},{id:'resonance',label:'RESSONÂNCIA'}]){
   const button=document.createElement('button');button.type='button';button.className='abyss-visor-action';button.textContent=item.label;button.setAttribute('aria-pressed',String(activeConsoleSection==='resonance'?item.id==='resonance':soloConsolePage===item.id));
   button.addEventListener('click',()=>{if(item.id==='resonance'){navigateEmbedded('resonanceScreen');return;}if(activeConsoleSection!=='solo'||soloConsolePage!==item.id){activeConsoleSection='solo';soloConsolePage=item.id;renderWorkshop();}});nav.append(button);
  }
  group.append(nav);return group;
 }
 window.addEventListener('abyssal-modal-closed',event=>{if(event.detail?.screenId==='resonanceScreen')for(const nav of workshop?.querySelectorAll('.solo-research-tabs')||[]){const buttons=nav.querySelectorAll('button');buttons[2]?.setAttribute('aria-pressed','false');}});
 function renderConsoleUtility(){
  if(!workshopGrid)return;
  if(commandPages.has(activeConsoleSection)){const utility=window.AbyssalCockpitSettings?.createPage?.(activeConsoleSection);if(utility){mountCockpitConsole(utility);return;}}
  if(embeddedPages[activeConsoleSection]){const utility=document.createElement('div');if(activeConsoleSection==='resonance'){utility.className='abyss-console-info';utility.append(createSoloResearchNav());}mountCockpitConsole(utility);return;}
  const utility=document.createElement('div');utility.className='abyss-console-info';
  if(activeConsoleSection==='solo'&&['diver','submarine'].includes(soloConsolePage)){
   const progress=window.AbyssalSoloProgress,state=progress?.get()||{energy:0,lamp:1},base=window.AbyssalSoloBase;
   utility.append(createSoloResearchNav());
   const balance=document.createElement('strong');balance.className='solo-stored-energy';balance.textContent='ENERGIA ARMAZENADA: '+state.energy.toLocaleString('pt-BR');utility.append(balance);
   const note=document.createElement('p');note.textContent='Pesquisas de equipamentos e armamentos da base usam energia coletada pelo espécime nas orbes roxas. As habilidades do mergulhador são pesquisadas exclusivamente na Ressonância.';utility.append(note);
   const section=(title,copy)=>{const h=document.createElement('h3');h.className='solo-research-heading';h.textContent=title;utility.append(h);if(copy){const p=document.createElement('p');p.className='solo-research-copy';p.textContent=copy;utility.append(p);}};
   const researchRow=(id,name,description,cost,owned,onBuy)=>{
    const row=document.createElement('div');row.className='solo-lamp-row solo-research-row'+(owned?' is-complete':'');
    const data=document.createElement('div'),label=document.createElement('strong'),desc=document.createElement('small');label.textContent=name;desc.textContent=description;data.append(label,desc);
    const buy=document.createElement('button');buy.type='button';buy.className='abyss-visor-action';buy.textContent=owned?'PESQUISADA':'DESBLOQUEAR · '+cost+' ENERGIA';buy.classList.add('solo-research-buy');buy.disabled=owned||state.energy<cost;buy.setAttribute('aria-pressed',String(owned));
    buy.addEventListener('click',()=>{const result=onBuy?.();if(result?.ok){window.dispatchEvent(new CustomEvent('abyssal-solo-research-change',{detail:{id}}));renderWorkshop();}});
    row.append(data,buy);utility.append(row);
   };
   if(soloConsolePage==='diver'){
   section('ILUMINAÇÃO PESSOAL','A lanterna continua independente dos sistemas do submarino.');
   for(let lv=1;lv<=3;lv++){
    const row=document.createElement('div');row.className='solo-lamp-row';
    const data=document.createElement('div'),name=document.createElement('strong'),desc=document.createElement('small');name.textContent='LANTERNA · NV. '+lv;const lamp=window.AbyssalSoloCavern?.lampParameters(lv);desc.textContent='Cone de luz · alcance '+Math.round(lamp?.range||570)+' · '+(lv===1?'equipamento inicial':Math.round((Math.pow(1.22,lv-1)-1)*100)+'% de alcance adicional');data.append(name,desc);
    const buy=document.createElement('button');buy.type='button';buy.className='abyss-visor-action';buy.textContent=lv<=state.lamp?'INSTALADA':(progress?.costFor(lv)||0)+' ENERGIA';buy.disabled=lv!==state.lamp+1||state.energy<(progress?.costFor(lv)||0);buy.setAttribute('aria-pressed',String(lv<=state.lamp));buy.addEventListener('click',()=>{if(progress?.upgradeLamp().ok)renderWorkshop();});row.append(data,buy);utility.append(row);
   }
   }else{
   section('SISTEMAS DO SUBMARINO','A luz da base consome 20 Energia por 5 minutos. Cada arma automática instalada acrescenta 10 Energia ao mesmo ciclo. Recargas parciais custam apenas a proporção que falta.');
   researchRow('submarineShield','ESCUDO DO SUBMARINO','Campo defensivo pesquisável que repele criaturas enquanto a base estiver energizada. Não aumenta o consumo do ciclo.',base?.cost?.('submarineShield')||100,Boolean(base?.get?.().submarineShield),()=>base?.research?.('submarineShield'));
   const labels={electric:'TEMPESTADE ELÉTRICA',pierce:'LANÇA DO ABISMO',photon:'LANÇA DE FÓTONS',photonRay:'RAIO DE FÓTONS',nova:'NOVA GRAVITACIONAL',echoShot:'ECO DE MARÉ',burst:'PULSO DE RUPTURA',ricochet:'RICOCHETE CAÓTICO',spread:'RAJADA PRISMÁTICA',power:'PULSO INTENSO',rate:'RESSONÂNCIA VELOZ',speed:'PROPULSÃO ABISSAL',range:'OLHO PROFUNDO',magnet:'AFINIDADE ABISSAL',regen:'MEMBRANA VIVA',shield:'ESCUDO ESPECTRAL',shell:'CARAPAÇA ABISSAL',ward:'VÉU DE MARÉ',lastStand:'ÚLTIMO FÔLEGO',pressureCocoon:'CASULO DE PRESSÃO',vitality:'RESERVA VITAL',predator:'INSTINTO PREDATÓRIO',closePressure:'PRESSÃO DE CAÇA'};
   
   const installed=base?.installedWeapons?.()||[],maxWeapons=base?.MAX_WEAPONS||3;
   section('ARMAMENTO DO SUBMARINO · '+installed.length+'/'+maxWeapons,'Lança de Fótons é instalada de fábrica. Pesquise os demais disparos e escolha até três torres. Remova uma torre para liberar espaço; a pesquisa permanece salva.');
   const slots=document.createElement('p');slots.className='solo-research-copy';slots.textContent=Array.from({length:maxWeapons},(_,i)=>(i+1)+'. '+(labels[installed[i]]||'ESPAÇO LIVRE')).join('  ·  ');utility.append(slots);
   for(const id of base?.SHOTS||[]){
    const key='weapon:'+id,owned=base.unlocked(key),mounted=installed.includes(id);
    if(!owned){researchRow(key,'TORRE · '+labels[id],'Pesquisa permanente. Após desbloquear, instale em um espaço livre.',base.cost(key),false,()=>base.research(key));continue;}
    const row=document.createElement('div');row.className='solo-lamp-row solo-research-row'+(mounted?' is-complete':'');
    const data=document.createElement('div'),label=document.createElement('strong'),desc=document.createElement('small');label.textContent='TORRE · '+labels[id];desc.textContent=mounted?'INSTALADA · +10 energia por ciclo':'PESQUISADA · '+(installed.length>=maxWeapons?'Remova uma torre para instalar.':'Pronta para instalação gratuita.');data.append(label,desc);
    const btn=document.createElement('button');btn.type='button';btn.className='abyss-visor-action solo-research-buy';btn.textContent=mounted?'DESINSTALAR':'INSTALAR';btn.disabled=!mounted&&installed.length>=maxWeapons;btn.setAttribute('aria-pressed',String(mounted));
    btn.addEventListener('click',()=>{const result=mounted?base.uninstallWeapon(id):base.installWeapon(id);if(result.ok)renderWorkshop();});
    row.append(data,btn);utility.append(row);
   }

   const power=document.createElement('p');power.className='solo-research-copy';power.textContent='CUSTO ATUAL DA BASE: '+(base?.fullPowerCost?.()||20)+' ENERGIA / 5 MIN · '+(base?.installedWeapons?.().length||0)+' ARMA(S) INSTALADA(S)';utility.append(power);
   }
   const back=document.createElement('button');back.type='button';back.className='abyss-visor-action';back.textContent='VOLTAR AO MERGULHO';back.addEventListener('click',()=>{soloConsolePage='home';renderWorkshop();});utility.append(back);
  }else if(activeConsoleSection==='minerals'){
   const gallery=document.createElement('div');gallery.className='abyss-mineral-gallery';
   const inventory=research.sanitizeInventory(stateInventory());
   for(const id of ['polymetallicNodule','ferromanganeseCrust','phosphorite','hydrothermalSulfide','oilSeep','gasSeep']){
    const card=document.createElement('div');card.className='abyss-mineral-tile';
    const art=document.createElement('span');art.innerHTML=window.AbyssalResourceIcons?.svg?.(id)||'';
    const data=document.createElement('div'),label=document.createElement('strong'),stock=document.createElement('small');
    label.textContent=config.RESOURCES[id]?.name||id;
    const item=id==='oilSeep'?'oilCylinder':id==='gasSeep'?'gasCylinder':id;
    stock.textContent=(id!==item?'AMOSTRAS ':'ESTOQUE ')+(Number(inventory[item])||0);
    data.append(label,stock);card.append(art,data);gallery.append(card);
   }
   utility.append(gallery);
   const note=document.createElement('p');note.textContent='Minérios coletados no Mar Aberto financiam as pesquisas. As imagens aparecem também nos requisitos de cada tecnologia.';
   utility.append(note);
  }else{
   const pages={
    solo:['MERGULHAR','A expedição ativa do Abyssal. Sobreviva, evolua seus disparos e comande o seu espécime durante a partida.','INICIAR MERGULHAR','playBtn'],
    shop:['ESPÉCIMES','Veja aparências, cápsulas e ofertas. Compras e preços são controlados pela loja original do jogo.','ABRIR ESPÉCIMES','shopBtn'],
    specimens:['REGISTRO DE ESPÉCIES','Explore o Abissário com raridades, criaturas descobertas e habilidades.','ABRIR ABYSSÁRIO','catalogBtn'],
    sea:['EXPEDIÇÃO OCEÂNICA','Nade pelo Mar Aberto, colete amostras e monte instalações de extração.','INICIAR EXPLORAÇÃO','openSeaPortalBtn'],
    rift:['DESCIDA ÀS FOSSAS','Enfrente as cavernas, armadilhas e os chefes das Fossas Abissais.','INICIAR DESCIDA','riftPortalBtn']
   };
   const info=pages[activeConsoleSection];if(info){
    const heading=document.createElement('strong');heading.textContent=info[0];
    const body=document.createElement('p');body.textContent=info[1];
    const action=document.createElement('button');action.className='abyss-visor-action'+(activeConsoleSection==='shop'?' abyss-shop-action':activeConsoleSection==='specimens'?' abyss-codex-action':'');action.type='button';action.textContent=info[2];
    action.addEventListener('click',()=>{
     // Utility screens open over the bridge; gameplay routes leave the bridge.
     const target=document.getElementById(info[3]);
     if(activeConsoleSection==='shop'||activeConsoleSection==='specimens'){
      if(target&&!target.disabled)target.click();
     }else{
      closeWorkshop();if(target&&!target.disabled)target.click();
     }
    });
    utility.append(heading,body,action);
    if(activeConsoleSection==='solo'){
     utility.append(createSoloResearchNav());
    }
   }
  }
  mountCockpitConsole(utility);
 }

 const openWorkshop=()=>{if(!workshop)return;activeConsoleSection='solo';soloConsolePage='home';workshop.hidden=false;renderWorkshop();window.AbyssalSubmarineCockpit?.open?.();};
 const closeWorkshop=()=>{if(!workshop||workshop.hidden)return;restoreEmbeddedCatalog();workshop.hidden=true;window.AbyssalSubmarineCockpit?.close?.();window.dispatchEvent(new CustomEvent('abyssal-modal-closed',{detail:{screenId:'submarineWorkshop'}}));};
 window.AbyssalCockpitNavigation=Object.freeze({open:openWorkshop,close:closeWorkshop,routeScreen:navigateEmbedded,routeCommand:navigateCommand,isEmbedded:id=>embeddedCatalog?.screen.id===id,back:backEmbedded});
 window.addEventListener('abyssal-authenticated',()=>{if(!workshop.hidden&&activeConsoleSection==='login'){activeConsoleSection=loginReturn==='login'?'profile':loginReturn;renderWorkshop();}});
 document.getElementById('submarineWorkshopBtn')?.addEventListener('click',openWorkshop);
 document.getElementById('submarineWorkshopClose')?.addEventListener('click',closeWorkshop);
 // Use original account/community screens directly, bypassing hidden menu controls.
 $('cockpitProfileBtn')?.addEventListener('click',()=>{navigateEmbedded('profileScreen');});
 $('cockpitCardumesBtn')?.addEventListener('click',()=>{navigateEmbedded('cardumesScreen');});

 // The command bridge is now the primary menu presentation. Existing hatch
 // navigation remains available after a player explicitly closes the bridge.
 let openedPrimaryCockpit=false;
 function showPrimaryCockpit(){
  if(openedPrimaryCockpit||!workshop)return;
  const menu=document.getElementById('menuScreen');
  if(!menu||menu.hidden||document.body.classList.contains('game-active'))return;
  for(const id of ['ageTermsScreen','loginScreen']){
   const modal=document.getElementById(id);
   if(modal&&!modal.hidden)return;
  }
  openedPrimaryCockpit=true;openWorkshop();
 }
 window.addEventListener('load',()=>setTimeout(showPrimaryCockpit,0),{once:true});
 for(const id of ['ageTermsScreen','menuScreen']){
  const modal=document.getElementById(id);
  if(modal&&typeof MutationObserver==='function'){
   const observer=new MutationObserver(()=>setTimeout(showPrimaryCockpit,70));
   observer.observe(modal,{attributes:true,attributeFilter:['hidden','style']});
  }
 }
 window.addEventListener('abyssal-open-main-cockpit',()=>{
  if(document.body.classList.contains('game-active'))return;
  openedPrimaryCockpit=true;openWorkshop();
 });

 workshop?.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();}});
 window.addEventListener('abyssal-account-data',()=>{if(workshop&&!workshop.hidden&&!embeddedCatalog)renderWorkshop();});

 let account=null,localInventory={},localLevels={},offshore={oil:0,gas:0,lastAt:Date.now(),connections:[],installation:null},nodes=[],collectionFx=[],taken=new Set(),near=null,runKey='',oxygen=0,capacity=0,noOxygenSeconds=0,serverVitals=null,lastTick=performance.now(),lastScan=0,lastRender=0,busy=false,lastLocalSave=0;
 try{localInventory=research.sanitizeInventory(JSON.parse(localStorage.getItem('abyssalSoloInventory')||'{}'));localLevels=research.sanitizeLevels(JSON.parse(localStorage.getItem('abyssalSoloResearch')||'{}'));const saved=JSON.parse(localStorage.getItem('abyssalSoloOffshoreV1')||'null');if(saved&&typeof saved==='object')offshore={oil:Math.max(0,Number(saved.oil)||0),gas:Math.max(0,Number(saved.gas)||0),lastAt:Number(saved.lastAt)||Date.now(),connections:Array.isArray(saved.connections)?saved.connections.slice(0,24):[],installation:saved.installation&&['laying','return'].includes(saved.installation.phase)?saved.installation:null};}catch(_){localInventory=research.sanitizeInventory();localLevels=research.sanitizeLevels();}
 // Starter equipment is granted once per offline device, not on each run.
 try{
  const kit=fields.starterKit(localInventory,localStorage.getItem('abyssalSoloKitGrantedV1')==='1');
  localInventory=research.sanitizeInventory(kit.inventory);
  if(kit.changed){localStorage.setItem('abyssalSoloKitGrantedV1','1');localStorage.setItem('abyssalSoloInventory',JSON.stringify(localInventory));}
 }catch(_){}
 const notify=message=>{const node=$('explorationGatherStatus');if(node)node.textContent=message;};
 window.addEventListener('abyssal-account-data',ev=>{account=ev.detail||null;if(cfg()?.online)inventoryUI()?.setInventory(research.sanitizeInventory(account?.resourceInventory||{}));renderResearch();});
 window.addEventListener('abyssal-specimen-discovery-request',()=>{
  // Discovery is recorded in the Abissário; no legacy resources are awarded in Solo.
  notify('Espécie registrada no Abissário.');
 });
 window.addEventListener('abyssal-companion-sonar',()=>{lastScan=0;const nearby=nodes.length;notify('Sonar do espécime ativado: '+nearby+' depósitos no radar.');});
 window.addEventListener('abyssal-resource-collected',ev=>{if(ev.detail?.id!=null){taken.add(String(ev.detail.id));nodes=nodes.filter(n=>n.id!==String(ev.detail.id));}});
 window.addEventListener('exploration-vitals',ev=>{serverVitals=ev.detail||null;});
 window.addEventListener('abyssal-start-open-sea',()=>{
  inventoryUI()?.setActive(true);
  inventoryUI()?.setInventory(research.sanitizeInventory(stateInventory()));
 });
 window.addEventListener('abyssal-start-rift-solo',()=>inventoryUI()?.setActive(false));
 function localResearchMode(){
  const p=cfg();
  if(p?.mode==='open-sea')return !p.online;
  let recent='';try{recent=localStorage.getItem('abyssalLabProgressModeV2')||'';}catch(_){}
  return recent==='solo'||!account;
 }
 function stateLevels(){return research.migrateLegacy(localResearchMode()?localLevels:account?.researchLevels||localLevels,account?.metaUpgrades||{}).levels;}
 function stateInventory(){return localResearchMode()?localInventory:(account?.resourceInventory||localInventory);}
 function saveLocal(){
  try{
   offshore=Offshore?.accrue?.(offshore,localLevels,Date.now())||offshore;
   localStorage.setItem('abyssalSoloInventory',JSON.stringify(localInventory));
   localStorage.setItem('abyssalSoloResearch',JSON.stringify(localLevels));
   localStorage.setItem('abyssalSoloGeologyTakenV1',JSON.stringify([...taken].slice(-5000)));localStorage.setItem('abyssalSoloOffshoreV1',JSON.stringify(offshore));
  }catch(_){}
 }
 function currentOffshore(now=Date.now()){
  const source=localResearchMode()?offshore:(account?.offshoreProduction||{oil:0,gas:0,lastAt:now,connections:[],installation:null});
  return Offshore?.accrue?.(source,stateLevels(),now)||source;
 }
 function offshoreRates(){return Offshore?.rates?.(currentOffshore(),stateLevels())||{oil:0,gas:0};}
 function offshoreCapacity(){return Offshore?.capacity?.(stateLevels())||500;}
 function updateOffshoreProduction(now=Date.now()){return currentOffshore(now);}
 const PLATFORM_X=Offshore?.PLATFORM_X||520,PLATFORM_Y=Offshore?.PLATFORM_Y||95;
 const offshorePipePathCache=new Map();
 function platformNearby(p=cfg()){return Boolean(p&&p.mode==='open-sea'&&Math.hypot(p.x-PLATFORM_X,p.y-PLATFORM_Y)<175);}
 function applyOffshoreResult(result,source,action){
  if(!result?.ok){
   const errors={
    'platform-distance':'Aproxime-se do FPSO na superfície.',
    'no-free-pipelines':'Limite de dutos atingido. Pesquise outra linha.',
    'start-at-platform':'Retire a bobina no FPSO antes de conectar a reserva.',
    'installation-already-in-progress':'Já existe um duto em instalação.',
    'well-already-linked':'Esta reserva já está conectada.',
    'well-distance':'Aproxime-se da cabeça do poço.',
    'offshore-cable-required':'Equipe um duto após pesquisar na central.',
    'missing-research':'Pesquise geofísica, plataforma e dutos primeiro.'
   };
   notify(errors[result?.reason]||('Operação offshore indisponível: '+String(result?.reason||'erro')));
   return false;
  }
  if(source==='solo'){offshore=result.state;saveLocal();}
  else if(result.account)account=result.account;
  const messages={laying:'BOBINA RETIRADA · Nade até uma reserva e fixe o duto.',
   return:'EXTREMIDADE FIXADA · Volte ao FPSO para terminar a conexão.',
   producing:'FLUXO ATIVO · Petróleo e gás seguem pelos dutos até a unidade flutuante.'};
  notify(messages[result.phase]||'Duto atualizado.');
  if(workshop&&!workshop.hidden)renderWorkshop();
  return true;
 }
 function platformAction(){
  const p=cfg(),levels=stateLevels(),selected=inventoryUI()?.selectedTool?.();
  if(!platformNearby(p)||selected!=='offshoreCable')return false;
  if(!levels.offshorePlatform||!levels.subseaUmbilical){notify('Pesquise a plataforma e os dutos no Laboratório.');return false;}
  const active=currentOffshore(),action=active.installation?.phase==='return'?'finish':'start';
  if(p.online){
   window.AbyssalOnline?.explorationOffshoreAction?.(action,null,result=>applyOffshoreResult(result,'online',action));
   return true;
  }
  return applyOffshoreResult(Offshore.transition(offshore,levels,action,p,null,Date.now()),'solo',action);
 }
 function connectOffshoreReserve(target){
  const p=cfg(),levels=stateLevels();
  if(!p||!target||!['oilSeep','gasSeep'].includes(target.type))return false;
  if(inventoryUI()?.selectedTool?.()!=='offshoreCable')return false;
  if(p.online){
   window.AbyssalOnline?.explorationOffshoreAction?.('connect',target.id,result=>applyOffshoreResult(result,'online','connect'));
   return true;
  }
  return applyOffshoreResult(Offshore.transition(offshore,levels,'connect',p,target,Date.now()),'solo','connect');
 }
 function startRun(p){
  if(p.mode==='open-sea')try{localStorage.setItem('abyssalLabProgressModeV2',p.online?'online':'solo');}catch(_){}
  runKey=p.mode==='open-sea'?(p.online?'abyssal:online:open-sea':'abyssal:solo:open-sea:v1'):(p.online?'abyssal:online:rift':'abyssal:solo:rift');
  busy=false;
  taken=new Set();nodes=[];collectionFx=[];serverVitals=null;noOxygenSeconds=0;oxygen=capacity=config.oxygenCapacity(stateLevels().oxygenTank);
  if(!p.online&&p.mode==='open-sea'){
   try{taken=new Set(JSON.parse(localStorage.getItem('abyssalSoloGeologyTakenV1')||'[]'));}catch(_){}
  }
  window.AbyssalGathering?.reset?.();
  lastScan=0;notify(p.online?'Depósitos do Mar Aberto sincronizados.':'Depósitos locais: G para coletar, I para inventário.');
  inventoryUI()?.setInventory(research.sanitizeInventory(stateInventory()));
 }
 function scan(p,time){
  if(!fields.ENABLED||!p.online||p.mode!=='open-sea'||time-lastScan<2200||busy)return;
  lastScan=time;
  const requestedRun=runKey;
  window.AbyssalOnline?.explorationScan?.(result=>{
   if(!result?.ok||runKey!==requestedRun||cfg()?.mode!=='open-sea'||!cfg()?.online)return;
   nodes=Array.isArray(result.nodes)?result.nodes:[];
   if(result.inventory){account={...(account||{}),resourceInventory:result.inventory};inventoryUI()?.setInventory(result.inventory);}
  });
 }
 function closest(p){
  const candidates=fields.nearby(nodes,p.x,p.y,320,taken);
  let item=null,distance=Infinity;
  for(const node of candidates){const d=Math.hypot(node.x-p.x,node.y-p.y);if(d<distance){distance=d;item=node;}}
  return item?{...item,distance}:null;
 }
 // Gatherer handles physical extraction and magnet pickup; this bridge keeps
 // the separate online authority and solo inventory ownership intact.
 window.AbyssalExplorationBridge=Object.freeze({
  config,research,fields,canvas,notify,cfg,
  nearby:()=>nodes,
  closest:()=>{const p=cfg();return p?closest(p):null;},
  inventory:()=>research.sanitizeInventory(stateInventory()),
  levels:()=>stateLevels(),
  connect:node=>connectOffshoreReserve(node),
  platformNearby:p=>platformNearby(p),
  platformAction:()=>platformAction(),
  installation:()=>currentOffshore().installation,
  isConnected:id=>currentOffshore().connections.some(l=>l.id===String(id)),
  prepareSolo:node=>fields.collect(node,research.sanitizeInventory(localInventory)),
  claimSolo:(node,result)=>{
   if(!result?.ok)return result;
   localInventory=research.sanitizeInventory(result.inventory);
   taken.add(node.id);nodes=nodes.filter(n=>n.id!==node.id);saveLocal();
   inventoryUI()?.setInventory(localInventory);return result;
  },
  claimOnline:(node,result)=>{
   if(!result?.ok)return result;
   taken.add(node.id);nodes=nodes.filter(n=>n.id!==node.id);
   if(result.account)account=result.account;
   inventoryUI()?.setInventory(research.sanitizeInventory(result.inventory||account?.resourceInventory||{}));return result;
  },
  extractionBurst:target=>{
   if(cfg()?.mode!=='open-sea'||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return;
   const seed=String(target.id||'').split('').reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0);
   collectionFx.push({x:target.x,y:target.y,started:performance.now(),seed});
   if(collectionFx.length>24)collectionFx.splice(0,collectionFx.length-24);
  },
  feedback:(item,amount)=>inventoryUI()?.collectFeedback?.(item,amount),
  sprite:()=>window.AbyssalExplorationToolState
 });
 function renderResearch(){
  const base=$('submarineBasePanel'),index=base?.querySelector('#expeditionResearchIndex');
  if(!index||base.hidden)return;
  const levels=stateLevels(),inventory=research.sanitizeInventory(stateInventory());
  index.replaceChildren();
  const title=document.createElement('h3');title.textContent='PESQUISAS E EQUIPAMENTOS';index.append(title);
  const material=document.createElement('p');material.textContent='Materiais: '+Object.entries(inventory).filter(([,n])=>n>0).map(([id,n])=>(config.RESOURCES[id]?.name||id)+' '+n).join(' · ')||'Sem materiais disponíveis';
  index.append(material);
  const grid=document.createElement('div');grid.className='exploration-research-grid';
  for(const [id,def] of Object.entries(config.RESEARCH)){
   const card=document.createElement('article');card.className='exploration-research-card';
   const heading=document.createElement('strong');heading.textContent=def.name;
   const level=Number(levels[id])||0,cost=research.costFor(id,level);
   const desc=document.createElement('small');
   desc.textContent='Nível '+level+'/'+def.max+' · '+(def.group==='active'?'Habilidade '+def.slot:def.group==='passive'?'Passiva':'Equipamento');
   const materials=document.createElement('p');
   materials.textContent=level>=def.max?'Pesquisa concluída':[
    ...Object.entries(cost).map(([material,amount])=>(config.RESOURCES[material]?.name||material)+': '+amount),
    ...Object.entries(research.offshoreCostFor?.(id,level)||{}).map(([type,amount])=>(type==='oil'?'Petróleo':'Gás')+': '+amount)
   ].join(' · ');
   const button=document.createElement('button');button.type='button';button.textContent=level>=def.max?'CONCLUÍDO':'ESTUDAR';
   const available=research.study(id,levels,inventory,currentOffshore());button.disabled=!available.ok;
   if(!available.ok&&available.reason==='prerequisite')materials.textContent+=' · Pré-requisito: '+def.requires.map(r=>config.RESEARCH[r]?.name||r).join(', ');
   button.addEventListener('click',()=>{
    button.disabled=true;
    const done=result=>{
     if(result.ok){
      if(result.account){account=result.account;}else{
       localLevels=result.levels;localInventory=result.inventory;
       if(result.offshore)offshore=result.offshore;
       saveLocal();
       window.AbyssalGameHooks?.applyResearchUnlock?.(id,result.level);
       if(id==='subseaUmbilical'){localInventory.offshoreCable=Math.max(Number(localInventory.offshoreCable)||0,Number(result.level)||1);saveLocal();inventoryUI()?.setInventory(localInventory);}
      }
      renderResearch();
     }else{materials.textContent='Falha: '+String(result.reason||'erro');button.disabled=false;}
    };
    if(account&&!localResearchMode())window.AbyssalOnline?.explorationStudy?.(id,done);
    else done(research.study(id,localLevels,localInventory,currentOffshore()));
   });
   card.append(heading,desc,materials,button);grid.append(card);
  }
  index.append(grid);
 }
 const baseButton=$('openSubmarineBaseBtn');
 baseButton?.addEventListener('click',()=>{renderResearch();});
 function drawPipeFlow(c,link,t,viewport,levels){
  if(!link||!['oilSeep','gasSeep'].includes(link.type))return;
  const geo=window.AbyssalOceanGeography;if(!geo)return;
  const bx=PLATFORM_X,by=PLATFORM_Y;
  const key=[link.id,link.x,link.y,geo.VERSION||0].join(':');
  let cached=offshorePipePathCache.get(key);
  if(!cached){
   const path=[{x:link.x,y:link.y},{x:link.x,y:geo.floorAt(link.x)-26}];
   const dx=bx-link.x,steps=Math.ceil(Math.abs(dx)/125);
   for(let j=1;j<=steps;j++){
    const x=link.x+dx*j/Math.max(1,steps);path.push({x,y:geo.floorAt(x)-26});
   }
   // Segmented subsea pipeline leads into a curved FPSO riser.
   const seabed=geo.floorAt(bx)-26;
   path.push({x:bx+26,y:seabed-55},{x:bx+45,y:Math.max(by+90,seabed*.56)},
    {x:bx+37,y:by+80},{x:bx,y:by-80});
   const segments=[];let total=0;
   for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],len=Math.hypot(b.x-a.x,b.y-a.y);
    if(len<.001)continue;segments.push({a,b,len,begin:total});total+=len;
   }
   cached={segments,total};
   if(offshorePipePathCache.size>=12)offshorePipePathCache.clear();
   offshorePipePathCache.set(key,cached);
  }
  const {segments,total}=cached;
  if(total<=0)return;
  const gas=link.type==='gasSeep',color=gas?'#88e7c4':'#e3b678';
  const boost=Math.max(0,Math.min(3,Number(gas?levels?.gasProcessing:levels?.oilProcessing)||0));
  const speed=(gas?62:44)*(1+boost*.18);
  // Flow runs from the geological reserve to the ship, not the reverse.
  const count=Math.max(4,Math.min(24,Math.floor(total/180)));
  c.save();c.lineCap='round';
  for(let n=0;n<count;n++){
   const position=(t*speed+n*total/count)%total;
   let i=segments.findIndex(s=>position<=s.begin+s.len);
   if(i<0)i=segments.length-1;
   const part=segments[i],q=Math.min(1,Math.max(0,(position-part.begin)/part.len));
   const x=part.a.x+(part.b.x-part.a.x)*q,y=part.a.y+(part.b.y-part.a.y)*q;
   if(x<viewport.left-20||x>viewport.right+20||y<viewport.top-20||y>viewport.bottom+20)continue;
   c.fillStyle=color;c.shadowColor=color;c.shadowBlur=gas?8:5;c.globalAlpha=.77;
   if(gas){c.beginPath();c.arc(x,y,2.8,0,Math.PI*2);c.fill();}
   else{
    const angle=Math.atan2(part.b.y-part.a.y,part.b.x-part.a.x);
    c.save();c.translate(x,y);c.rotate(angle);
    c.beginPath();c.ellipse(0,0,6,2.5,0,0,Math.PI*2);c.fill();c.restore();
   }
  }
  c.restore();
 }
 // Large stationary bedrock reservoir with a tiny pressure seep at its top.
 // The same object can later receive an industrial subsea production pipeline.
 function drawNaturalReservoir(c,node,t){
  // The marker is a fissure inset on the actual host rock, not a free-floating oval.
  const gas=node.type==='gasSeep',r=Math.max(55,Math.min(120,Number(node.reservoirRadius)||90));
  const angle=Number.isFinite(node.rockAngle)?node.rockAngle:-Math.PI/2;
  c.save();c.rotate(angle+Math.PI/2);c.lineJoin='round';c.lineCap='round';
  c.fillStyle=gas?'rgba(13,54,52,.75)':'rgba(8,19,25,.82)';
  c.strokeStyle=gas?'rgba(116,191,165,.55)':'rgba(135,118,91,.55)';c.lineWidth=3;
  c.beginPath();c.moveTo(-r*.87,13);c.lineTo(-r*.58,3);c.lineTo(-r*.35,10);
  c.lineTo(-r*.12,-1);c.lineTo(r*.15,7);c.lineTo(r*.42,-3);
  c.lineTo(r*.85,8);c.lineTo(r*.63,29);c.lineTo(r*.12,37);
  c.lineTo(-r*.41,30);c.closePath();c.fill();c.stroke();
  for(let i=0;i<6;i++){
   const xx=(i/5-.5)*r*1.4;
   c.strokeStyle=gas?'rgba(84,162,137,.36)':'rgba(107,108,95,.32)';
   c.lineWidth=1.2;c.beginPath();c.moveTo(xx,18);c.lineTo(xx-6,31);c.stroke();
  }
  // Small localized seep animation flows outward from a geological fracture.
  const hash=String(node.id).length*13;
  for(let i=0;i<(gas?4:2);i++){
   const phase=t*(gas?16:9)+i*17+hash,travel=phase%60,xx=-17+i*11+Math.sin(phase*.1)*5;
   if(gas){
    c.fillStyle='rgba(136,230,196,.42)';c.beginPath();
    c.arc(xx,-travel,2.1+i%2,0,Math.PI*2);c.fill();
   }else{
    c.strokeStyle='rgba(25,36,40,.66)';c.lineWidth=2.2;
    c.beginPath();c.moveTo(xx,-travel);c.lineTo(xx+2,-travel-8);c.stroke();
   }
  }c.restore();
 }
 function drawWorldResources(c,time,view){
  const p=cfg();if(!c||!p||p.mode!=='open-sea')return;
  const left=Number(view?.left)||0,top=Number(view?.top)||0,right=Number(view?.right)||p.worldWidth,bottom=Number(view?.bottom)||p.worldHeight;
  const t=(Number(time)||performance.now())/1000;
  for(const node of nodes){
   if(window.AbyssalGathering?.pendingId?.()===node.id)continue;
   if(node.x<left-390||node.x>right+390||node.y<top-240||node.y>bottom+245)continue;
   const type=node.type,oil=type==='oilSeep',gas=type==='gasSeep',seep=oil||gas;
   c.save();c.translate(node.x,node.y);
   if(seep){drawNaturalReservoir(c,node,t);c.restore();continue;}
   // Deposit is part of a fractured bedrock outcrop, not an identical icon.
   const seed=String(node.id).split('').reduce((s,ch)=>((s*31+ch.charCodeAt(0))>>>0),17);
   const a=(seed%53)*.11,shape=seep?32:26;
   c.fillStyle=seep?'#16262d':'#23373c';c.strokeStyle='rgba(83,112,119,.45)';c.lineWidth=1.2;
   if(node.feature==='embedded-rock'){
    // Veins sit directly on the rendered rock instead of painting a second floating boulder.
    c.strokeStyle='rgba(135,166,165,.36)';c.lineWidth=2.3;
    c.beginPath();c.moveTo(-23,9);c.quadraticCurveTo(-11,-12,4,-6);c.quadraticCurveTo(18,-14,23,-5);c.stroke();
   }else{
    c.beginPath();
    for(let j=0;j<=13;j++){const angle=j/13*Math.PI*2,r=shape*(.74+.23*Math.sin(j*2.43+a)+.12*Math.cos(j*4.13+a)),x=Math.cos(angle)*r,y=Math.sin(angle)*r*.57+5;if(j===0)c.moveTo(x,y);else c.lineTo(x,y);}
    c.closePath();c.fill();c.stroke();
   }
   c.strokeStyle='rgba(126,161,161,.16)';c.lineWidth=1;c.beginPath();c.moveTo(-21,7);c.quadraticCurveTo(-8,-11,4,-6);c.quadraticCurveTo(18,-14,23,-7);c.stroke();
   if(type==='polymetallicNodule'){for(let n=0;n<7;n++){const x=-22+n*7.6,y=(n%3)*3+2,r=5+(n%3)*1.5;c.fillStyle=n%2?'#454c56':'#333b45';c.beginPath();c.ellipse(x,y,r,r*.78,n*.37,0,Math.PI*2);c.fill();}}
   else if(type==='ferromanganeseCrust'){c.fillStyle='#151d28';c.beginPath();c.moveTo(-25,3);c.lineTo(-16,-7);c.lineTo(-4,-3);c.lineTo(8,-13);c.lineTo(25,-7);c.lineTo(29,1);c.lineTo(8,7);c.lineTo(-13,9);c.closePath();c.fill();}
   else if(type==='hydrothermalSulfide'){c.fillStyle='#30262a';c.beginPath();c.moveTo(-10,11);c.lineTo(-13,-28);c.lineTo(-4,-34);c.lineTo(2,-24);c.lineTo(11,-30);c.lineTo(14,8);c.closePath();c.fill();}
   else if(seep){for(let n=0;n<4;n++){const phase=t*(gas?1.5:.55)+n*1.4,rise=(phase*20)%58;c.strokeStyle=gas?'rgba(92,190,137,.5)':'rgba(8,15,20,.65)';c.lineWidth=2;c.beginPath();c.moveTo(-8+n*5,-3);c.quadraticCurveTo(-13+n*7,-18-rise*.4,-5+n*6,-18-rise);c.stroke();}}
   else {const col=type==='phosphorite'?'#9f8c66':'#609ca0';for(let n=0;n<5;n++){const x=-18+n*9,y=n%2?-1:-7,s=5+(n%3)*2;c.fillStyle=col;c.beginPath();c.moveTo(x,y-s);c.lineTo(x+s*.8,y);c.lineTo(x+s*.4,y+s*.5);c.lineTo(x-s*.6,y+s*.3);c.closePath();c.fill();}}
   c.restore();
  }
  window.AbyssalGathering?.draw?.(c,time,{left,top,right,bottom});
  // Surface production platform is a researched world structure, never a starter object.
  const levels=stateLevels(),offshore=currentOffshore();
  if(levels.offshorePlatform){
   const platformX=520,platformY=95;
   const installing=offshore.installation;
   const draft=installing?installing.phase==='laying'?
    {id:'draft',type:'oilSeep',x:p.x,y:p.y,preview:true}:
    {...installing.target,preview:true}:null;
   const allLines=draft?[...offshore.connections,draft]:offshore.connections;
   for(const link of allLines){
    // A subsea flowline lies over the seabed; a flexible riser reaches the floating vessel.
    const from=Math.max(Math.min(platformX,link.x),left-160);
    const to=Math.min(Math.max(platformX,link.x),right+160);
    if(from>to)continue;
    const oil=link.type==='oilSeep',body=link.preview?'#aa8a52':oil?'#514639':'#48635f',indicator=oil?'#d7ad6c':'#83d6b0';
    c.save();c.lineCap='round';c.lineJoin='round';
    if(platformX>=left-120&&platformX<=right+120){
     const bottomY=window.AbyssalOceanGeography.floorAt(platformX)-26;
     c.beginPath();c.moveTo(platformX,platformY-80);
     c.bezierCurveTo(platformX+44,platformY+100,platformX+55,bottomY-155,platformX+24,bottomY);
     c.strokeStyle=body;c.lineWidth=8;c.stroke();
     c.strokeStyle='rgba(173,207,199,.32)';c.lineWidth=2;c.stroke();
     if(!link.preview){
      c.strokeStyle=indicator;c.lineWidth=2.2;c.globalAlpha=.75;
      c.setLineDash([7,26]);c.lineDashOffset=t*33;c.stroke();c.setLineDash([]);
      c.globalAlpha=1;
     }
    }
    c.beginPath();
    let started=false;
    for(let x=from;x<=to;x+=90){
     const y=window.AbyssalOceanGeography.floorAt(x)-26;
     if(!started){c.moveTo(x,y);started=true;}else c.lineTo(x,y);
    }
    c.lineTo(to,window.AbyssalOceanGeography.floorAt(to)-26);
    c.strokeStyle=body;c.lineWidth=link.preview?6:8;c.stroke();
    c.strokeStyle=indicator;c.globalAlpha=link.preview?.38:.66;c.lineWidth=2;
    c.setLineDash([9,42]);c.lineDashOffset=t*26;c.stroke();c.setLineDash([]);
    c.globalAlpha=1;
    if(!link.preview&&link.x>=left-90&&link.x<=right+90&&link.y>=top-180&&link.y<=bottom+180){
     const floor=window.AbyssalOceanGeography.floorAt(link.x)-26;
     c.strokeStyle=body;c.lineWidth=6;c.beginPath();c.moveTo(link.x,floor);c.quadraticCurveTo(link.x-23,link.y+52,link.x,link.y);c.stroke();
     c.fillStyle='#263842';c.strokeStyle='#7f9895';c.lineWidth=2;
     c.fillRect(link.x-16,link.y-13,32,21);c.strokeRect(link.x-16,link.y-13,32,21);
     c.strokeStyle='#b7a571';c.beginPath();c.moveTo(link.x,link.y-13);c.lineTo(link.x,link.y-28);c.moveTo(link.x-9,link.y-24);c.lineTo(link.x+9,link.y-24);c.stroke();
     c.fillStyle=indicator;c.beginPath();c.arc(link.x+10,link.y-7,3.2,0,Math.PI*2);c.fill();
    }
    if(link.preview&&link.x>=left-90&&link.x<=right+90&&link.y>=top-90&&link.y<=bottom+90){
     c.strokeStyle='#e6ce91';c.lineWidth=3;c.setLineDash([6,7]);
     const bed=window.AbyssalOceanGeography.floorAt(link.x)-26;
     c.beginPath();c.moveTo(link.x,bed);c.lineTo(link.x,link.y);c.stroke();c.setLineDash([]);
     c.fillStyle='#ddbc71';c.font='700 11px sans-serif';c.fillText(installing.phase==='laying'?'BOBINA EM INSTALAÇÃO':'LIGAR NO FPSO',link.x+16,link.y-14);
    }
    c.restore();
    if(!link.preview)drawPipeFlow(c,link,t,{left,top,right,bottom},levels);
   }
  }
  if(levels.offshorePlatform&&top<650){
   const px=PLATFORM_X,py=45;c.save();c.translate(px,py);
   // Floating production vessel: a deep-water production system, not a rigid seabed tripod.
   const bob=Math.sin(t*.47)*1.8;c.translate(0,bob);
   c.fillStyle='#253942';c.strokeStyle='#819ba1';c.lineWidth=2;
   c.beginPath();c.moveTo(-112,-69);c.lineTo(112,-69);c.lineTo(99,-42);c.quadraticCurveTo(0,-30,-102,-42);c.closePath();c.fill();c.stroke();
   c.fillStyle='#a8493e';c.fillRect(-99,-49,195,5);
   c.fillStyle='#b3b9ab';c.fillRect(-106,-83,212,14);
   c.fillStyle='#40535c';c.fillRect(-82,-119,50,36);c.fillStyle='#9eb3b6';c.fillRect(-76,-113,15,10);c.fillRect(-53,-113,15,10);
   for(let j=0;j<3;j++){c.fillStyle=j%2?'#859e9f':'#78939a';c.fillRect(-16+j*28,-106,21,23);c.strokeStyle='#b8b49e';c.lineWidth=1.6;c.strokeRect(-16+j*28,-106,21,23);}
   c.strokeStyle='#b8a36c';c.lineWidth=3;c.beginPath();c.moveTo(72,-83);c.lineTo(87,-153);c.lineTo(96,-83);c.moveTo(75,-114);c.lineTo(93,-114);c.stroke();
   c.fillStyle='#e3a653';c.fillRect(84,-154,8,5);
   const tanks=[offshore.oil,offshore.gas],colors=['#cba05b','#82c9a3'];
   for(let i=0;i<2;i++){const x=-85+i*46;c.fillStyle='#1a2d34';c.fillRect(x,-138,29,20);c.strokeStyle='#90a5a4';c.strokeRect(x,-138,29,20);c.fillStyle=colors[i];c.fillRect(x+3,-121-14*Math.min(1,tanks[i]/offshoreCapacity()),23,14*Math.min(1,tanks[i]/offshoreCapacity()));}
   c.fillStyle='#d9e5df';c.font='700 11px sans-serif';c.fillText('FPSO · PRODUÇÃO E ARMAZENAMENTO',-104,-165);
   c.fillStyle='#d3ae6e';c.fillText('ÓLEO '+offshore.oil.toFixed(0)+' / '+offshoreCapacity(),-99,26);
   c.fillStyle='#9cdeb9';c.fillText('GÁS '+offshore.gas.toFixed(0)+' / '+offshoreCapacity(),-99,41);
   c.fillStyle='#ccdbd5';c.fillText('POÇOS '+offshore.connections.length+'/'+Math.max(1,Number(levels.subseaUmbilical)||0),-99,56);
   if(platformNearby(p)&&inventoryUI()?.selectedTool?.()==='offshoreCable'){
    c.fillStyle='#f2d594';c.font='700 11px sans-serif';
    c.fillText(installing?.phase==='return'?'G · FINALIZAR LIGAÇÃO':'G · RETIRAR DUTO',-99,77);
   }
   c.restore();
  }
  if(levels.offshorePlatform){
   // Separate survey/drilling vessel and subsea strata, inspired by offshore
   // well sections. These illustrations add no invisible solid collisions.
   if(left<1200&&right>780&&top<340){
    const bx=940,by=85;c.save();c.translate(bx,by);
    c.fillStyle='#374954';c.beginPath();c.moveTo(-82,-36);c.lineTo(86,-36);c.lineTo(71,-19);c.quadraticCurveTo(0,-6,-73,-19);c.closePath();c.fill();
    c.strokeStyle='#b7bdba';c.lineWidth=2;c.stroke();
    c.fillStyle='#9caeb0';c.fillRect(-70,-46,135,11);c.fillStyle='#33444a';c.fillRect(40,-65,25,19);
    c.strokeStyle='#ddb46e';c.lineWidth=3;c.beginPath();c.moveTo(-12,-44);c.lineTo(5,-156);c.lineTo(25,-44);c.moveTo(-8,-78);c.lineTo(19,-78);c.moveTo(-6,-105);c.lineTo(14,-105);c.stroke();
    c.fillStyle='#cee3db';c.font='700 10px sans-serif';c.fillText('NAVIO-SONDA',-58,-160);c.restore();
   }
   const wells=[...offshore.connections,...(installing?.phase==='return'?[installing.target]:[])];
   for(const well of wells){
    const wx=Number(well.x),fy=window.AbyssalOceanGeography.floorAt(wx);
    if(wx<left-170||wx>right+170||fy<top-310||fy>bottom+260)continue;
    c.save();
    // Geological cutaway: sediment, caprock, and confined fluid pocket.
    c.fillStyle='rgba(126,137,140,.11)';c.beginPath();c.moveTo(wx-138,fy+65);
    c.quadraticCurveTo(wx-60,fy+43,wx+12,fy+65);c.quadraticCurveTo(wx+84,fy+38,wx+140,fy+60);
    c.lineTo(wx+140,fy+91);c.quadraticCurveTo(wx,fy+110,wx-138,fy+96);c.closePath();c.fill();
    const oil=well.type==='oilSeep';
    c.fillStyle=oil?'rgba(21,20,24,.77)':'rgba(73,149,165,.50)';
    c.beginPath();c.moveTo(wx-117,fy+179);c.bezierCurveTo(wx-59,fy+141,wx+45,fy+153,wx+124,fy+176);
    c.quadraticCurveTo(wx+75,fy+230,wx-112,fy+221);c.closePath();c.fill();
    c.strokeStyle='rgba(164,180,170,.32)';c.lineWidth=3;c.beginPath();
    c.moveTo(wx-135,fy+136);c.quadraticCurveTo(wx,fy+119,wx+135,fy+137);c.stroke();
    c.strokeStyle='#8d9893';c.lineWidth=10;c.beginPath();c.moveTo(wx,fy-36);c.lineTo(wx,fy+183);c.stroke();
    c.strokeStyle='#c4a776';c.lineWidth=3;c.beginPath();c.moveTo(wx,fy-31);c.lineTo(wx,fy+182);c.stroke();
    c.strokeStyle=oil?'#d2a669':'#8be6bf';c.lineWidth=2;c.beginPath();
    c.moveTo(wx+8,fy+167);c.lineTo(wx+8,fy-28);c.stroke();
    c.font='700 10px sans-serif';c.fillStyle=oil?'#e1c49b':'#a8ead5';
    c.fillText(oil?'RESERVATÓRIO DE PETRÓLEO':'RESERVATÓRIO DE GÁS',wx-105,fy+258);
    c.restore();
   }
  }
  const now=performance.now();collectionFx=collectionFx.filter(fx=>now-fx.started<650);
  for(const fx of collectionFx){const age=(now-fx.started)/650;if(age<0||age>=1)continue;c.save();c.translate(fx.x,fx.y);c.globalAlpha=1-age;for(let i=0;i<8;i++){const a=i/8*Math.PI*2,travel=12+age*(25+i%3*8);c.fillStyle=i%2?'#718083':'#394a50';c.beginPath();c.arc(Math.cos(a)*travel,Math.sin(a)*travel+age*age*18,2.8,0,Math.PI*2);c.fill();}c.restore();}
 }
 window.AbyssalExplorationWorldRender=drawWorldResources;
 function drawMarkers(p,visible){
  const fxNow=performance.now();collectionFx=collectionFx.filter(fx=>fxNow-fx.started<650);
  if(!visible||(nodes.length===0&&collectionFx.length===0)){markers.hidden=true;return;}
  const rect=canvas.getBoundingClientRect(),shellRect=shell.getBoundingClientRect();
  const w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
  markers.hidden=false;markers.style.position='absolute';markers.style.left=(rect.left-shellRect.left)+'px';markers.style.top=(rect.top-shellRect.top)+'px';
  markers.style.width=w+'px';markers.style.height=h+'px';markers.style.zIndex='14';
  if(markers.width!==w||markers.height!==h){markers.width=w;markers.height=h;}
  const c=markers.getContext('2d');c.clearRect(0,0,w,h);
  const camera=window.AbyssalGameHooks?.cameraState?.(),zoom=Number(camera?.zoom)||window.AbyssalGameHooks?.worldZoom?.()||.78;
  // Deposits are world geometry. Project them through the exact game camera instead
  // of rebuilding an approximate camera from the diver position, which caused jumps.
  const originX=Number.isFinite(camera?.x)?camera.x:Math.max(0,Math.min(p.worldWidth-w/zoom,p.x-w/(2*zoom)));
  const originY=Number.isFinite(camera?.y)?camera.y:Math.max(0,Math.min(p.worldHeight-h/zoom,p.y-h/(2*zoom)));
  const t=performance.now()/1000;
  for(const node of nodes){
   const x=(node.x-originX)*zoom,y=(node.y-originY)*zoom;
   if(x< -80||y< -100||x>w+80||y>h+80)continue;
   const type=node.type,oil=type==='oilSeep',gas=type==='gasSeep',seep=oil||gas;
   const selected=node.id===near?.id;
   const scale=Math.max(.58,Math.min(1.24,zoom*1.18));
   c.save();c.translate(x,y);c.scale(scale,scale);
   // Jagged natural rock/crevice. Every resource is anchored to rock or sediment.
   c.fillStyle=seep?'#1e2f34':'#2a4044';c.strokeStyle=selected?'#e8ce8a':'rgba(85,113,123,.32)';c.lineWidth=selected?2:1.1;
   c.beginPath();const signature=String(node.id).split('').reduce((s,ch)=>((s*33+ch.charCodeAt(0))>>>0),11);for(let k=0;k<=15;k++){const angle=k/15*Math.PI*2,r=26+7*Math.sin(k*2.7+signature*.01)+4*Math.cos(k*4.2+signature*.03),x=Math.cos(angle)*r,y=Math.sin(angle)*r*.65+4;if(k===0)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();c.fill();c.stroke();
   c.strokeStyle='#637f85';c.lineWidth=1;c.beginPath();c.moveTo(-22,-7);c.lineTo(-11,-15);c.lineTo(3,-13);c.lineTo(18,-20);c.stroke();
   if(seep){
    // Dark oil jets and green-tinged gas bubbles are distinct gameplay silhouettes.
    c.lineWidth=5;c.strokeStyle='#06111b';c.beginPath();c.moveTo(-18,7);c.lineTo(-7,-7);c.lineTo(5,0);c.lineTo(18,-13);c.stroke();
    c.lineWidth=2;c.strokeStyle=gas?'#7ee4a8':'#475a66';c.stroke();
    for(let n=0;n<5;n++){
     const sx=-8+n*5,phase=t*(gas?1.75:.64)+n*1.2;
     if(oil){
      const drift=Math.sin(phase)*5,flight=(phase*14)%58;
      c.strokeStyle=n%2?'#131b24':'#030a11';c.lineWidth=3+n%2;
      c.beginPath();c.moveTo(sx,-4);c.bezierCurveTo(sx-4,-15,sx+drift+4,-25-flight*.2,sx+drift,-18-flight);c.stroke();
      c.strokeStyle='#7a939c';c.lineWidth=.8;c.beginPath();c.moveTo(sx+2,-13-flight*.3);c.lineTo(sx+drift+2,-19-flight);c.stroke();
     }else{
      const rise=(phase*28)%73,wiggle=Math.sin(phase*2)*7;
      c.beginPath();c.arc(sx+wiggle,-10-rise,2.8+n%3,0,Math.PI*2);
      c.fillStyle='#2e9f6ba6';c.fill();c.strokeStyle='#94efb7';c.lineWidth=1.3;c.stroke();
      c.fillStyle='#c3f9cd';c.beginPath();c.arc(sx+wiggle-1,-11-rise,1.2,0,Math.PI*2);c.fill();
     }
    }
   }else if(type==='polymetallicNodule'){
    // Actual abyssal nodules resemble dark rounded concretions, not bright crystals.
    for(let n=0;n<7;n++){
     const px=-22+n*7.6,py=(n%3)*3+2,r=5+(n%3)*1.5;
     c.fillStyle=n%2?'#454c56':'#333b45';c.strokeStyle='#899298';c.lineWidth=1;
     c.beginPath();c.ellipse(px,py,r,r*.78,n*.37,0,Math.PI*2);c.fill();c.stroke();
     c.fillStyle='#a5afb1';c.beginPath();c.arc(px-2,py-2,1.2,0,Math.PI*2);c.fill();
    }
   }else if(type==='ferromanganeseCrust'){
    // Metallic mineral crust is laminated onto rock, not standing as ore crystals.
    c.fillStyle='#141e2e';c.strokeStyle='#9a8cc0';c.lineWidth=2;
    c.beginPath();c.moveTo(-25,3);c.lineTo(-16,-7);c.lineTo(-4,-3);c.lineTo(8,-13);c.lineTo(25,-7);c.lineTo(29,1);c.lineTo(8,7);c.lineTo(-13,9);c.closePath();c.fill();c.stroke();
    c.strokeStyle='#af9cb9';c.lineWidth=1;c.beginPath();c.moveTo(-20,2);c.lineTo(-6,0);c.lineTo(8,-8);c.lineTo(21,-3);c.stroke();
   }else if(type==='hydrothermalSulfide'){
    // Sulfides are visibly clustered at a metal-rich chimney/fracture.
    c.fillStyle='#30262a';c.strokeStyle='#c9a078';c.lineWidth=2;
    c.beginPath();c.moveTo(-10,11);c.lineTo(-13,-28);c.lineTo(-4,-34);c.lineTo(2,-24);c.lineTo(11,-30);c.lineTo(14,8);c.closePath();c.fill();c.stroke();
    c.fillStyle='#ceb98c';for(let n=0;n<6;n++)c.fillRect(-9+(n*5)%18,-22+n*4,2,2);
    for(let n=0;n<3;n++){const dy=(t*8+n*17)%35;c.strokeStyle='#849c9580';c.lineWidth=2;c.beginPath();c.moveTo(-1+n*4,-25);c.quadraticCurveTo(-9+n*6,-36-dy*.3,3+n*8,-41-dy);c.stroke();}
   }else{
    const col=type==='phosphorite'?'#d7bb81':'#81cbd0';
    for(let n=0;n<5;n++){
     const px=-18+n*9,py=n%2===0?-4:4,size=7+(n%3)*2;
     c.fillStyle=col;c.globalAlpha=.64+n*.06;
     c.beginPath();c.moveTo(px,py-size);c.lineTo(px+size*.8,py-2);c.lineTo(px+size*.45,py+size*.5);c.lineTo(px-size*.6,py+size*.35);c.closePath();c.fill();
     c.fillStyle='#f3e9c6';c.fillRect(px-1,py-size*.5,2,2);
    }
    c.globalAlpha=1;
   }
   if(selected){c.strokeStyle='#e6d19a';c.lineWidth=1.6;c.setLineDash([3,4]);c.beginPath();c.arc(0,0,38,0,Math.PI*2);c.stroke();c.setLineDash([]);}
   c.restore();
   if(Math.hypot(node.x-p.x,node.y-p.y)<430){
    c.fillStyle='#e9f2ef';c.font='bold 11px Inter,sans-serif';
    c.shadowColor='#000';c.shadowBlur=5;c.fillText(config.RESOURCES[type]?.name||type,x+23,y-28);c.shadowBlur=0;
   }
  }
  for(const fx of collectionFx){
   const age=(fxNow-fx.started)/650;if(age<0||age>=1)continue;
   const x=(fx.x-originX)*zoom,y=(fx.y-originY)*zoom;
   if(x< -90||y< -90||x>w+90||y>h+90)continue;
   c.save();c.translate(x,y);c.globalAlpha=1-age;
   for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2+(fx.seed%17)*.11,travel=12+age*(25+(i%3)*8),px=Math.cos(a)*travel,py=Math.sin(a)*travel+age*age*18;
    c.fillStyle=i%2?'#7d8f91':'#3d5157';c.beginPath();c.moveTo(px-4,py+3);c.lineTo(px,py-5);c.lineTo(px+5,py+2);c.closePath();c.fill();
   }
   c.strokeStyle='#d8c99a';c.lineWidth=2;c.beginPath();c.arc(0,0,34+age*18,0,Math.PI*2);c.stroke();c.restore();
  }
 }
 function tick(time){
  requestAnimationFrame(tick);
  const delta=Math.min(.1,Math.max(0,(time-lastTick)/1000));lastTick=time;
  const p=cfg(),active=p?.mode==='open-sea';document.body.classList.toggle('open-sea-exploration',active);hud.hidden=!active;inventoryUI()?.setActive(active);hud.querySelector('.exploration-collect').hidden=true;
  if(!active){markers.hidden=true;runKey='';window.AbyssalGathering?.reset?.();return;}
  const expectedRun=p.online?'abyssal:online:open-sea':'abyssal:solo:open-sea:v1';
  if(runKey!==expectedRun)startRun(p);
  if(!p.paused&&!p.online){
   const depth=config.depthAt(p.y,p.worldHeight,2200);
   const safe=config.safeDepth(stateLevels().pressureSuit);
   oxygen=config.oxygenAfterTick(oxygen,capacity,delta,depth,p.y,p.r);
   if(oxygen<=0)noOxygenSeconds+=delta;else noOxygenSeconds=0;
   const hazard=config.environmentDamage(depth,safe,noOxygenSeconds);
   if(hazard>0)window.AbyssalGameHooks?.explorationHit?.(delta*hazard);
  }
  if(fields.ENABLED&&!p.online&&p.mode==='open-sea'&&time-lastScan>850){
   lastScan=time;
   nodes=fields.streamNear(runKey,p.x,p.y,1900,taken);
  }
  scan(p,time);
  window.AbyssalGathering?.tick?.(time,delta,p);
  if(!p.online&&time-lastLocalSave>5000){lastLocalSave=time;updateOffshoreProduction();saveLocal();}if(time-lastRender<160)return;lastRender=time;
  const depth=p.online&&serverVitals?serverVitals.depth:config.depthAt(p.y,p.worldHeight,2200);
  const pressure=config.pressureAt(depth),safe=config.safeDepth(stateLevels().pressureSuit);
  const gas=p.online&&serverVitals?serverVitals.oxygen:oxygen;
  const max=p.online&&serverVitals?serverVitals.capacity:capacity;
  $('explorationGas').textContent=Math.ceil(Math.max(0,gas)/Math.max(1,max)*100)+'%';hud.classList.toggle('oxygen-critical',gas/Math.max(1,max)<.2);
  $('explorationGasFill').style.width=Math.max(0,Math.min(100,gas/Math.max(1,max)*100))+'%';
  $('explorationDepth').textContent='PROF. '+Math.round(depth)+' m';$('explorationPressure').textContent='PRESSÃO '+pressure.toFixed(1)+' atm';
  $('explorationBiome').textContent='REGIÃO · '+(oceanGeo?.visualBiomeAt?.(p.x,p.y)?.label||'MAR ABERTO');
   $('explorationPressureWarning').textContent=config.atBreathingSurface(p.y,p.r)?'SUPERFÍCIE · RECARREGANDO OXIGÊNIO':depth>safe?'ALERTA: resistência do traje excedida':gas/max<.2?'OXIGÊNIO BAIXO':'Limite do traje: '+safe+' m';
  // Position vitality from measured oxygen/depth card boundaries. On narrow
  // mobile screens text may wrap, so fixed pixel spacing would overlap.
  const vitals=$('hud'), instruments=hud.querySelector('.exploration-instruments');
  if(vitals&&instruments){
   const lower=instruments.getBoundingClientRect().bottom-shell.getBoundingClientRect().top+8;
   const nextTop=Math.max(0,Math.ceil(lower))+'px';
   if(vitals.style.getPropertyValue('--abyss-vitals-top')!==nextTop)
    vitals.style.setProperty('--abyss-vitals-top',nextTop);
  }
  near=p.mode==='open-sea'?closest(p):null;inventoryUI()?.setInventory(research.sanitizeInventory(stateInventory()));$('explorationDeposit').textContent=near?((near.type==='oilSeep'||near.type==='gasSeep')?(currentOffshore().connections.some(l=>l.id===String(near.id))?'POÇO CONECTADO · PRODUZINDO':stateLevels().offshoreSurvey?'RESERVA MAPEADA · '+Math.round(near.distance)+' u':'INDÍCIO GEOLÓGICO · '+Math.round(near.distance)+' u'):(config.RESOURCES[near.type]?.name||near.type)+' · '+Math.round(near.distance)+' u'):'NENHUM DEPÓSITO PRÓXIMO';
  window.AbyssalGathering?.refreshHUD?.(near,p);
  signal.hidden=true;
  markers.hidden=true; // Resources render inside the game world canvas, never as UI overlay.
 }
 requestAnimationFrame(tick);
})();
