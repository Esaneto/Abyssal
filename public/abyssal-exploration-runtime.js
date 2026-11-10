/* Exploration HUD and gathering. Online resources and vitals are server-owned.
 * Offline solo uses a separate local cache; never uploads unverified materials.
 */
(function(){
 'use strict';
 const config=window.AbyssalExplorationConfig,research=window.AbyssalResearchSystem,fields=window.AbyssalResourceFields,stream=window.AbyssalOceanStream;
 const inventoryUI=()=>window.AbyssalInventoryUI;
 if(!config||!research||!fields)return;
 const $=id=>document.getElementById(id);
 const shell=$('gameShell'),canvas=$('game');if(!shell||!canvas)return;
 const hud=document.createElement('section');
 hud.id='explorationOverlay';hud.className='exploration-overlay';hud.hidden=true;
 hud.innerHTML='<div class="exploration-stat"><span>GÁS RESPIRÁVEL</span><strong id="explorationGas">100%</strong><div class="exploration-track"><i id="explorationGasFill"></i></div></div>'+
 '<div class="exploration-stat exploration-instruments"><span>INSTRUMENTOS DE MERGULHO</span><strong id="explorationDepth">PROF. 0 m</strong><strong id="explorationPressure">PRESSÃO 1.0 atm</strong><small id="explorationPressureWarning"></small></div>'+
 '<div class="exploration-stat exploration-collect"><span>SONAR DE RECURSOS · G</span><strong id="explorationDeposit">PROCURANDO SINAIS...</strong><small id="explorationGatherStatus">Aproxime-se de um depósito para coletar.</small><button type="button" id="explorationGatherBtn" disabled>COLETAR RECURSO</button></div>';
 const signal=document.createElement('div');signal.id='explorationRiftSignals';signal.className='exploration-stat exploration-sonar';signal.hidden=true;
 signal.innerHTML='<span>RADAR / SONAR DAS FOSSAS</span><strong id="explorationRiftSignalText">BUSCANDO ANOMALIAS</strong>';
 hud.appendChild(signal);
 shell.appendChild(hud);
 hud.querySelector('.exploration-collect').hidden=true; // Mar Aberto only.
 const markers=document.createElement('canvas');markers.id='explorationMarkers';markers.setAttribute('aria-hidden','true');markers.style.pointerEvents='none';markers.hidden=true;shell.appendChild(markers);
 const cfg=()=>window.AbyssalGameHooks?.explorationPosition?.();
 const workshop=document.getElementById('submarineWorkshop'),workshopGrid=document.getElementById('submarineWorkshopGrid');
 function renderWorkshop(){if(!workshopGrid)return;const levels=stateLevels(),inventory=research.sanitizeInventory(stateInventory());updateOffshoreProduction();workshopGrid.replaceChildren();const labTitle=document.createElement('div');labTitle.className='submarine-lab-heading';labTitle.innerHTML='<strong>ÁRVORE TECNOLÓGICA · LABORATÓRIO ABISSAL</strong><span>NÚCLEO ESSENCIAL → SOBREVIVÊNCIA / ENGENHARIA / ENERGIA → TECNOLOGIAS AVANÇADAS</span>';workshopGrid.appendChild(labTitle);if(levels.offshorePlatform){const production=document.createElement('article');production.className='submarine-upgrade branch-industry';const rates=offshoreRates(),cap=offshoreCapacity(),oilPct=Math.min(100,offshore.oil/cap*100),gasPct=Math.min(100,offshore.gas/cap*100);production.innerHTML='<small>PRODUÇÃO OFFSHORE · '+(offshore.connections.length?'OPERACIONAL':'AGUARDANDO POÇO')+'</small><strong>CENTRAL DE PRODUÇÃO</strong><span class="offshore-row"><b>PETRÓLEO</b><i><em style="width:'+oilPct+'%"></em></i><b>'+offshore.oil.toFixed(1)+' / '+cap+'</b><small>+'+(rates.oil*60).toFixed(1)+'/min</small></span><span class="offshore-row gas"><b>GÁS</b><i><em style="width:'+gasPct+'%"></em></i><b>'+offshore.gas.toFixed(1)+' / '+cap+'</b><small>+'+(rates.gas*60).toFixed(1)+'/min</small></span><span>Poços ativos: '+offshore.connections.length+'/'+Math.max(1,Number(levels.subseaUmbilical)||0)+(oilPct>=100||gasPct>=100?' · TANQUE CHEIO: expanda o armazenamento para não perder produção.':'')+'</span>';workshopGrid.appendChild(production);}for(const [id,def] of Object.entries(config.RESEARCH)){const card=document.createElement('article');card.className='submarine-upgrade branch-'+(def.starter?'core':def.group==='industry'?'industry':def.group==='shot'?'energy':def.group==='active'?'energy':def.group==='passive'?'adaptation':'engineering');const level=Number(levels[id])||0,cost=research.costFor(id,level)||{};const label=def.starter?'TECNOLOGIA ESSENCIAL':def.group==='industry'?'ENGENHARIA OFFSHORE':def.group==='shot'?'PESQUISA DE DISPARO':def.group==='active'?'ENERGIA ATIVA':def.group==='passive'?'TECNOLOGIA PASSIVA':String(def.group||'sistema').toUpperCase();card.innerHTML='<small>'+label+'</small><strong>'+def.name+' · '+level+'/'+def.max+'</strong><span>'+(def.description||'')+(def.starter?' · Equipamento padrão do mergulhador.':Object.entries(cost).map(([r,n])=>' · '+(config.RESOURCES[r]?.name||r)+' × '+n).join(''))+(def.requires?.length?' · Requer: '+def.requires.map(r=>config.RESEARCH[r]?.name||r).join(', '):'')+'</span>';const btn=document.createElement('button');btn.type='button';btn.className='secondary-btn';btn.textContent=def.starter?'PADRÃO':level>=def.max?'MÁXIMO':'PESQUISAR';btn.disabled=Boolean(def.starter)||level>=def.max;btn.onclick=()=>window.dispatchEvent(new CustomEvent('abyssal-exploration-research-request',{detail:{id}}));card.appendChild(btn);workshopGrid.appendChild(card);}}
 document.getElementById('submarineWorkshopBtn')?.addEventListener('click',()=>{if(workshop){workshop.hidden=false;renderWorkshop();}});
 document.getElementById('submarineWorkshopClose')?.addEventListener('click',()=>{if(workshop)workshop.hidden=true;});
 window.addEventListener('abyssal-account-data',()=>{if(workshop&&!workshop.hidden)renderWorkshop();});

 let account=null,localInventory={},localLevels={},offshore={oil:0,gas:0,lastAt:Date.now(),connections:[]},nodes=[],collectionFx=[],taken=new Set(),near=null,runKey='',oxygen=0,capacity=0,noOxygenSeconds=0,serverVitals=null,lastTick=performance.now(),lastScan=0,lastRender=0,busy=false,lastLocalSave=0;
 try{localInventory=research.sanitizeInventory(JSON.parse(localStorage.getItem('abyssalSoloInventory')||'{}'));localLevels=research.sanitizeLevels(JSON.parse(localStorage.getItem('abyssalSoloResearch')||'{}'));const saved=JSON.parse(localStorage.getItem('abyssalSoloOffshoreV1')||'null');if(saved&&typeof saved==='object')offshore={oil:Math.max(0,Number(saved.oil)||0),gas:Math.max(0,Number(saved.gas)||0),lastAt:Number(saved.lastAt)||Date.now(),connections:Array.isArray(saved.connections)?saved.connections.slice(0,24):[]};}catch(_){localInventory=research.sanitizeInventory();localLevels=research.sanitizeLevels();}
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
 function stateLevels(){return research.migrateLegacy(account?.researchLevels||localLevels,account?.metaUpgrades||{}).levels;}
 function stateInventory(){const p=cfg();return p?(p.online?account?.resourceInventory||{}:localInventory):(account?.resourceInventory||localInventory);}
 function saveLocal(){
  try{
   localStorage.setItem('abyssalSoloInventory',JSON.stringify(localInventory));
   localStorage.setItem('abyssalSoloResearch',JSON.stringify(localLevels));
   localStorage.setItem('abyssalSoloGeologyTakenV1',JSON.stringify([...taken].slice(-5000)));localStorage.setItem('abyssalSoloOffshoreV1',JSON.stringify(offshore));
  }catch(_){}
 }
 function offshoreRates(){let oil=0,gas=0;for(const link of offshore.connections||[]){if(link.type==='oilSeep')oil+=.025;else if(link.type==='gasSeep')gas+=.035;}return {oil,gas};}
 function offshoreCapacity(){return 500+Math.max(0,(Number(stateLevels().subseaUmbilical)||1)-1)*250;}
 function updateOffshoreProduction(now=Date.now()){
  const elapsed=Math.max(0,Math.min(86400000,now-(Number(offshore.lastAt)||now)))/1000;offshore.lastAt=now;if(!elapsed)return;
  const rates=offshoreRates(),oilRate=rates.oil,gasRate=rates.gas;
  const cap=offshoreCapacity();offshore.oil=Math.min(cap,offshore.oil+oilRate*elapsed);offshore.gas=Math.min(cap,offshore.gas+gasRate*elapsed);
 }
 function connectOffshoreReserve(target){
  const id=String(target.id),levels=stateLevels(),selected=inventoryUI()?.selectedTool?.();
  if(!levels.offshorePlatform||!levels.subseaUmbilical||selected!=='offshoreCable')return false;
  if(offshore.connections.some(link=>link.id===id)){notify('Esta reserva já está ligada à plataforma.');return true;}
  if(offshore.connections.length>=Number(levels.subseaUmbilical)){notify('Todas as linhas submarinas pesquisadas já estão em uso.');return true;}
  offshore.connections.push({id,type:target.type,x:target.x,y:target.y,connectedAt:Date.now()});offshore.lastAt=Date.now();saveLocal();
  notify((target.type==='oilSeep'?'PETRÓLEO':'GÁS')+' CONECTADO · produção automática iniciada na plataforma.');return true;
 }
 function startRun(p){
  runKey=p.mode==='open-sea'?(p.online?'abyssal:online:open-sea':'abyssal:solo:open-sea:v1'):(p.online?'abyssal:online:rift':'abyssal:solo:rift');
  busy=false;
  taken=new Set();nodes=[];collectionFx=[];serverVitals=null;noOxygenSeconds=0;oxygen=capacity=config.oxygenCapacity(stateLevels().oxygenTank);
  if(!p.online&&p.mode==='open-sea'){
   try{taken=new Set(JSON.parse(localStorage.getItem('abyssalSoloGeologyTakenV1')||'[]'));}catch(_){}
  }
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
 function collect(){
  const p=cfg();if(!p||p.mode!=='open-sea'||p.paused||!near||busy)return;
  if(near.type==='oilSeep'||near.type==='gasSeep'){const levels=stateLevels();if(!levels.offshoreSurvey){notify('INDÍCIO DE HIDROCARBONETO. Pesquise Geofísica Offshore no submarino para mapear a reserva.');return;}if(!levels.offshorePlatform){notify('RESERVA MAPEADA. Construa a Plataforma de Produção Abissal no submarino.');return;}if(!levels.subseaUmbilical){notify('PLATAFORMA SEM LINHA. Pesquise Linhas Submarinas de Produção para conectar esta reserva.');return;}if((inventoryUI()?.selectedTool?.()||'')!=='offshoreCable'){notify('EQUIPE A DUTO DE PRODUÇÃO. Leve-a até a reserva para concluir a ligação.');return;}connectOffshoreReserve(near);return;}
  const selected=inventoryUI()?.selectedTool?.()||'abyssPickaxe';
  const inventory=research.sanitizeInventory(stateInventory());
  const check=fields.eligible(near,p.x,p.y,inventory,115,selected);
  if(!check.ok){
   const messages={'too-far':'Aproxime-se do depósito.','select-tool':'Selecione '+(config.RESOURCES[check.tool]?.name||'a ferramenta')+' no inventário (I).',
    'tool-required':'Você precisa da picareta.','empty-cylinder-required':'Não há cilindros vazios.','offshore-infrastructure-required':'Petróleo e gás exigem infraestrutura offshore pesquisada no submarino.'};
   notify(messages[check.reason]||'Não foi possível coletar este recurso.');return;
  }
  busy=true;const target=near;
  if(p.online){
   const requestedRun=runKey,send=window.AbyssalOnline?.explorationCollect;
   if(typeof send!=='function'){busy=false;notify('Coleta online indisponível.');return;}
   send(target.id,result=>{
    if(runKey!==requestedRun)return;
    busy=false;
    if(result?.ok){
     collectionFx.push({x:target.x,y:target.y,started:performance.now(),seed:String(target.id).length*97});taken.add(target.id);nodes=nodes.filter(n=>n.id!==target.id);
     if(result.account)account=result.account;
     inventoryUI()?.setInventory(research.sanitizeInventory(result.inventory||account?.resourceInventory||{}));
     notify('Coletado: '+(config.RESOURCES[result.item]?.name||result.item)+' +'+result.amount);
    }else notify('Coleta indisponível: '+String(result?.reason||'erro'));
   },selected);
  }else{
   const result=fields.collect(target,inventory);busy=false;
   if(!result.ok){notify('Não foi possível coletar: '+result.reason);return;}
   collectionFx.push({x:target.x,y:target.y,started:performance.now(),seed:String(target.id).length*97});taken.add(target.id);nodes=nodes.filter(n=>n.id!==target.id);
   localInventory=research.sanitizeInventory(result.inventory);saveLocal();
   inventoryUI()?.setInventory(localInventory);
   notify('Coletado: '+config.RESOURCES[result.item].name+' +'+result.amount+' (inventário local)');
  }
 }
 $('explorationGatherBtn').addEventListener('click',collect);
 window.addEventListener('keydown',ev=>{if((ev.key==='g'||ev.key==='G')&&!ev.repeat&&!ev.target.closest?.('input,textarea,select,[contenteditable]'))collect();});
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
   materials.textContent=level>=def.max?'Pesquisa concluída':Object.entries(cost).map(([material,amount])=>(config.RESOURCES[material]?.name||material)+': '+amount).join(' · ');
   const button=document.createElement('button');button.type='button';button.textContent=level>=def.max?'CONCLUÍDO':'ESTUDAR';
   const available=research.study(id,levels,inventory);button.disabled=!available.ok;
   if(!available.ok&&available.reason==='prerequisite')materials.textContent+=' · Pré-requisito: '+def.requires.map(r=>config.RESEARCH[r]?.name||r).join(', ');
   button.addEventListener('click',()=>{
    button.disabled=true;
    const done=result=>{
     if(result.ok){
      if(result.account){account=result.account;}else{
       localLevels=result.levels;localInventory=result.inventory;saveLocal();
       window.AbyssalGameHooks?.applyResearchUnlock?.(id,result.level);
       if(id==='subseaUmbilical'){localInventory.offshoreCable=Math.max(Number(localInventory.offshoreCable)||0,Number(result.level)||1);saveLocal();inventoryUI()?.setInventory(localInventory);}
      }
      renderResearch();
     }else{materials.textContent='Falha: '+String(result.reason||'erro');button.disabled=false;}
    };
    if(account)window.AbyssalOnline?.explorationStudy?.(id,done);
    else done(research.study(id,localLevels,localInventory));
   });
   card.append(heading,desc,materials,button);grid.append(card);
  }
  index.append(grid);
 }
 const baseButton=$('openSubmarineBaseBtn');
 baseButton?.addEventListener('click',()=>{renderResearch();});
 function drawWorldResources(c,time,view){
  const p=cfg();if(!c||!p||p.mode!=='open-sea')return;
  const left=Number(view?.left)||0,top=Number(view?.top)||0,right=Number(view?.right)||p.worldWidth,bottom=Number(view?.bottom)||p.worldHeight;
  const t=(Number(time)||performance.now())/1000;
  for(const node of nodes){
   if(node.x<left-90||node.x>right+90||node.y<top-110||node.y>bottom+90)continue;
   const type=node.type,oil=type==='oilSeep',gas=type==='gasSeep',seep=oil||gas;
   c.save();c.translate(node.x,node.y);
   c.fillStyle=seep?'#202c33':'#243941';c.strokeStyle='#49616a';c.lineWidth=1.4;
   c.beginPath();c.moveTo(-32,16);c.lineTo(-27,-10);c.lineTo(-12,-22);c.lineTo(6,-17);c.lineTo(25,-26);c.lineTo(34,-3);c.lineTo(24,17);c.lineTo(4,24);c.lineTo(-17,21);c.closePath();c.fill();c.stroke();
   if(type==='polymetallicNodule'){for(let n=0;n<7;n++){const x=-22+n*7.6,y=(n%3)*3+2,r=5+(n%3)*1.5;c.fillStyle=n%2?'#454c56':'#333b45';c.beginPath();c.ellipse(x,y,r,r*.78,n*.37,0,Math.PI*2);c.fill();}}
   else if(type==='ferromanganeseCrust'){c.fillStyle='#151d28';c.beginPath();c.moveTo(-25,3);c.lineTo(-16,-7);c.lineTo(-4,-3);c.lineTo(8,-13);c.lineTo(25,-7);c.lineTo(29,1);c.lineTo(8,7);c.lineTo(-13,9);c.closePath();c.fill();}
   else if(type==='hydrothermalSulfide'){c.fillStyle='#30262a';c.beginPath();c.moveTo(-10,11);c.lineTo(-13,-28);c.lineTo(-4,-34);c.lineTo(2,-24);c.lineTo(11,-30);c.lineTo(14,8);c.closePath();c.fill();}
   else if(seep){for(let n=0;n<4;n++){const phase=t*(gas?1.5:.55)+n*1.4,rise=(phase*20)%58;c.strokeStyle=gas?'rgba(92,190,137,.5)':'rgba(8,15,20,.65)';c.lineWidth=2;c.beginPath();c.moveTo(-8+n*5,-3);c.quadraticCurveTo(-13+n*7,-18-rise*.4,-5+n*6,-18-rise);c.stroke();}}
   else {const col=type==='phosphorite'?'#9f8c66':'#609ca0';for(let n=0;n<5;n++){const x=-18+n*9,y=n%2?-1:-7,s=5+(n%3)*2;c.fillStyle=col;c.beginPath();c.moveTo(x,y-s);c.lineTo(x+s*.8,y);c.lineTo(x+s*.4,y+s*.5);c.lineTo(x-s*.6,y+s*.3);c.closePath();c.fill();}}
   c.restore();
  }
  // Surface production platform is a researched world structure, never a starter object.
  const levels=stateLevels();
  updateOffshoreProduction();
  if(levels.offshorePlatform){
   const platformX=520,platformY=95;
   for(const link of offshore.connections||[]){if(link.x<left-300&&platformX<left-300||link.x>right+300&&platformX>right+300)continue;const midY=Math.max(230,link.y*.42);c.save();c.strokeStyle=link.type==='oilSeep'?'#594c37':'#628b7c';c.lineWidth=8;c.beginPath();c.moveTo(platformX,platformY+80);c.bezierCurveTo(platformX+80,midY,link.x-120,midY,link.x,link.y);c.stroke();c.strokeStyle='rgba(205,222,211,.28)';c.lineWidth=2;c.stroke();const phase=(t*.18)%1;for(let k=0;k<4;k++){const u=(phase+k*.25)%1,iu=1-u,x=Math.pow(iu,3)*link.x+3*Math.pow(iu,2)*u*(link.x-120)+3*iu*u*u*(platformX+80)+u*u*u*platformX,y=Math.pow(iu,3)*link.y+3*Math.pow(iu,2)*u*midY+3*iu*u*u*midY+u*u*u*(platformY+80);c.fillStyle=link.type==='oilSeep'?'#d4a65a':'#8fe0b3';c.beginPath();c.arc(x,y,4.5,0,Math.PI*2);c.fill();}c.fillStyle='#1b2a30';c.strokeStyle='#d8b85e';c.lineWidth=2;c.fillRect(link.x-18,link.y-13,36,18);c.strokeRect(link.x-18,link.y-13,36,18);c.fillStyle='#b9e9d2';c.font='700 9px sans-serif';c.fillText('ATIVO',link.x-15,link.y-1);c.restore();}
  }
  if(levels.offshorePlatform&&top<650){
   const px=520,py=95;c.save();c.translate(px,py);c.strokeStyle='#9ba9ac';c.lineWidth=7;c.beginPath();c.moveTo(-45,5);c.lineTo(-58,105);c.moveTo(45,5);c.lineTo(58,105);c.stroke();c.fillStyle='#d6a52f';c.fillRect(-78,-18,156,28);c.fillStyle='#26343b';c.fillRect(-55,-42,72,24);c.strokeStyle='#d9c36d';c.lineWidth=3;c.beginPath();c.moveTo(28,-18);c.lineTo(50,-92);c.lineTo(62,-18);c.stroke();c.fillStyle='#d7edf0';c.font='700 12px sans-serif';c.fillText('PLATAFORMA OFFSHORE',-72,-50);c.font='700 11px sans-serif';c.fillStyle='#f0d989';c.fillText('PETRÓLEO '+offshore.oil.toFixed(1)+' / '+offshoreCapacity(),-72,128);c.fillStyle='#9ee6bf';c.fillText('GÁS '+offshore.gas.toFixed(1)+' / '+offshoreCapacity(),-72,145);c.fillStyle='#d7edf0';c.fillText('POÇOS '+offshore.connections.length+' / '+Math.max(1,Number(levels.subseaUmbilical)||0),-72,162);c.restore();
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
   c.fillStyle=seep?'#26323a':'#273f48';c.strokeStyle=selected?'#e8ce8a':'#55717b';c.lineWidth=2;
   c.beginPath();c.moveTo(-32,16);c.lineTo(-27,-10);c.lineTo(-12,-22);c.lineTo(6,-17);c.lineTo(25,-26);c.lineTo(34,-3);c.lineTo(24,17);c.lineTo(4,24);c.lineTo(-17,21);c.closePath();c.fill();c.stroke();
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
  const p=cfg(),active=p?.mode==='open-sea';hud.hidden=!active;inventoryUI()?.setActive(active);hud.querySelector('.exploration-collect').hidden=!active;
  if(!active){markers.hidden=true;runKey='';return;}
  const expectedRun=p.online?'abyssal:online:open-sea':'abyssal:solo:open-sea:v1';
  if(runKey!==expectedRun)startRun(p);
  if(!p.paused&&!p.online){
   const depth=config.depthAt(p.y,p.worldHeight,2200);
   const safe=config.safeDepth(stateLevels().pressureSuit);
   oxygen=Math.max(0,oxygen-config.gasConsumption(depth)*delta);
   if(oxygen<=0)noOxygenSeconds+=delta;else noOxygenSeconds=0;
   const hazard=config.environmentDamage(depth,safe,noOxygenSeconds);
   if(hazard>0)window.AbyssalGameHooks?.explorationHit?.(delta*hazard);
  }
  if(fields.ENABLED&&!p.online&&p.mode==='open-sea'&&time-lastScan>850){
   lastScan=time;
   nodes=fields.streamNear(runKey,p.x,p.y,1900,taken);
  }
  scan(p,time);
  if(!p.online&&time-lastLocalSave>5000){lastLocalSave=time;updateOffshoreProduction();saveLocal();}if(time-lastRender<160)return;lastRender=time;
  const depth=p.online&&serverVitals?serverVitals.depth:config.depthAt(p.y,p.worldHeight,2200);
  const pressure=config.pressureAt(depth),safe=config.safeDepth(stateLevels().pressureSuit);
  const gas=p.online&&serverVitals?serverVitals.oxygen:oxygen;
  const max=p.online&&serverVitals?serverVitals.capacity:capacity;
  $('explorationGas').textContent=Math.ceil(gas/Math.max(1,max)*100)+'%';
  $('explorationGasFill').style.width=Math.max(0,Math.min(100,gas/Math.max(1,max)*100))+'%';
  $('explorationDepth').textContent='PROF. '+Math.round(depth)+' m';$('explorationPressure').textContent='PRESSÃO '+pressure.toFixed(1)+' atm';
  $('explorationPressureWarning').textContent=depth>safe?'ALERTA: resistência do traje excedida':gas/max<.2?'OXIGÊNIO BAIXO':'Limite do traje: '+safe+' m';
  near=p.mode==='open-sea'?closest(p):null;inventoryUI()?.setInventory(research.sanitizeInventory(stateInventory()));$('explorationDeposit').textContent=near?((near.type==='oilSeep'||near.type==='gasSeep')?(offshore.connections.some(l=>l.id===String(near.id))?'POÇO CONECTADO · PRODUZINDO':stateLevels().offshoreSurvey?'RESERVA MAPEADA · '+Math.round(near.distance)+' u':'INDÍCIO GEOLÓGICO · '+Math.round(near.distance)+' u'):(config.RESOURCES[near.type]?.name||near.type)+' · '+Math.round(near.distance)+' u'):'NENHUM DEPÓSITO PRÓXIMO';
  const selectedTool=inventoryUI()?.selectedTool?.()||'abyssPickaxe',isHydrocarbon=near&&(near.type==='oilSeep'||near.type==='gasSeep');const can=Boolean(near)&&(isHydrocarbon?(near.distance<=115&&selectedTool==='offshoreCable'&&stateLevels().offshorePlatform&&stateLevels().subseaUmbilical&&!offshore.connections.some(l=>l.id===String(near.id))):fields.eligible(near,p.x,p.y,research.sanitizeInventory(stateInventory()),115,selectedTool).ok)&&!p.paused&&!busy;
  $('explorationGatherBtn').disabled=!can;
  signal.hidden=true;
  markers.hidden=true; // Resources render inside the game world canvas, never as UI overlay.
 }
 requestAnimationFrame(tick);
})();
