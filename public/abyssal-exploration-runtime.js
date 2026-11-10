/* Exploration HUD and gathering. Online resources and vitals are server-owned.
 * Offline solo uses a separate local cache; never uploads unverified materials.
 */
(function(){
 'use strict';
 const config=window.AbyssalExplorationConfig,research=window.AbyssalResearchSystem,fields=window.AbyssalResourceFields,stream=window.AbyssalOceanStream,inventoryUI=window.AbyssalInventoryUI;
 if(!config||!research||!fields)return;
 const $=id=>document.getElementById(id);
 const shell=$('gameShell'),canvas=$('game');if(!shell||!canvas)return;
 const hud=document.createElement('section');
 hud.id='explorationOverlay';hud.className='exploration-overlay';hud.hidden=true;
 hud.innerHTML='<div class="exploration-stat"><span>GÁS RESPIRÁVEL</span><strong id="explorationGas">100%</strong><div class="exploration-track"><i id="explorationGasFill"></i></div></div>'+
 '<div class="exploration-stat"><span>PROFUNDIDADE / PRESSÃO</span><strong id="explorationDepth">0 m · 1 atm</strong><small id="explorationPressureWarning"></small></div>'+
 '<div class="exploration-stat exploration-collect"><span>SONAR DE RECURSOS · G</span><strong id="explorationDeposit">PROCURANDO SINAIS...</strong><small id="explorationGatherStatus">Aproxime-se de um depósito para coletar.</small><button type="button" id="explorationGatherBtn" disabled>COLETAR RECURSO</button></div>';
 const signal=document.createElement('div');signal.id='explorationRiftSignals';signal.className='exploration-stat exploration-sonar';signal.hidden=true;
 signal.innerHTML='<span>RADAR / SONAR DAS FOSSAS</span><strong id="explorationRiftSignalText">BUSCANDO ANOMALIAS</strong>';
 hud.appendChild(signal);
 shell.appendChild(hud);
 hud.querySelector('.exploration-collect').hidden=true; // Mar Aberto only.
 const markers=document.createElement('canvas');markers.id='explorationMarkers';markers.setAttribute('aria-hidden','true');markers.style.pointerEvents='none';markers.hidden=true;shell.appendChild(markers);
 const cfg=()=>window.AbyssalGameHooks?.explorationPosition?.();
 let account=null,localInventory={},localLevels={},nodes=[],taken=new Set(),near=null,runKey='',oxygen=0,capacity=0,noOxygenSeconds=0,serverVitals=null,lastTick=performance.now(),lastScan=0,lastRender=0,busy=false,lastLocalSave=0;
 try{localInventory=research.sanitizeInventory(JSON.parse(localStorage.getItem('abyssalSoloInventory')||'{}'));localLevels=research.sanitizeLevels(JSON.parse(localStorage.getItem('abyssalSoloResearch')||'{}'));}catch(_){localInventory=research.sanitizeInventory();localLevels=research.sanitizeLevels();}
 // Starter equipment is granted once per offline device, not on each run.
 try{
  const kit=fields.starterKit(localInventory,localStorage.getItem('abyssalSoloKitGrantedV1')==='1');
  localInventory=research.sanitizeInventory(kit.inventory);
  if(kit.changed){localStorage.setItem('abyssalSoloKitGrantedV1','1');localStorage.setItem('abyssalSoloInventory',JSON.stringify(localInventory));}
 }catch(_){}
 const notify=message=>{const node=$('explorationGatherStatus');if(node)node.textContent=message;};
 window.addEventListener('abyssal-account-data',ev=>{account=ev.detail||null;if(cfg()?.online)inventoryUI?.setInventory(research.sanitizeInventory(account?.resourceInventory||{}));renderResearch();});
 window.addEventListener('abyssal-specimen-discovery-request',()=>{
  // Discovery is recorded in the Abissário; no legacy resources are awarded in Solo.
  notify('Espécie registrada no Abissário.');
 });
 window.addEventListener('abyssal-companion-sonar',()=>{lastScan=0;const nearby=nodes.length;notify('Sonar do espécime ativado: '+nearby+' depósitos no radar.');});
 window.addEventListener('abyssal-resource-collected',ev=>{if(ev.detail?.id!=null){taken.add(String(ev.detail.id));nodes=nodes.filter(n=>n.id!==String(ev.detail.id));}});
 window.addEventListener('exploration-vitals',ev=>{serverVitals=ev.detail||null;});
 function stateLevels(){return research.migrateLegacy(account?.researchLevels||localLevels,account?.metaUpgrades||{}).levels;}
 function stateInventory(){const p=cfg();return p?(p.online?account?.resourceInventory||{}:localInventory):(account?.resourceInventory||localInventory);}
 function saveLocal(){
  try{
   localStorage.setItem('abyssalSoloInventory',JSON.stringify(localInventory));
   localStorage.setItem('abyssalSoloResearch',JSON.stringify(localLevels));
   localStorage.setItem('abyssalSoloGeologyTakenV1',JSON.stringify([...taken].slice(-5000)));
  }catch(_){}
 }
 function startRun(p){
  runKey=p.online?'abyssal:online:open-sea':'abyssal:solo:open-sea:v1';
  taken=new Set();nodes=[];serverVitals=null;noOxygenSeconds=0;oxygen=capacity=config.oxygenCapacity(stateLevels().oxygenTank);
  if(!p.online&&p.mode==='open-sea'){
   try{taken=new Set(JSON.parse(localStorage.getItem('abyssalSoloGeologyTakenV1')||'[]'));}catch(_){}
  }
  lastScan=0;notify(p.online?'Depósitos do Mar Aberto sincronizados.':'Depósitos locais: G para coletar, I para inventário.');
  inventoryUI?.setInventory(research.sanitizeInventory(stateInventory()));
 }
 function scan(p,time){
  if(!fields.ENABLED||!p.online||p.mode!=='open-sea'||time-lastScan<2200||busy)return;
  lastScan=time;
  window.AbyssalOnline?.explorationScan?.(result=>{
   if(!result?.ok||cfg()?.mode!=='open-sea')return;
   nodes=Array.isArray(result.nodes)?result.nodes:[];
   if(result.inventory){account={...(account||{}),resourceInventory:result.inventory};inventoryUI?.setInventory(result.inventory);}
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
  const selected=inventoryUI?.selectedTool?.()||'abyssPickaxe';
  const inventory=research.sanitizeInventory(stateInventory());
  const check=fields.eligible(near,p.x,p.y,inventory,115,selected);
  if(!check.ok){
   const messages={'too-far':'Aproxime-se do depósito.','select-tool':'Selecione '+(config.RESOURCES[check.tool]?.name||'a ferramenta')+' no inventário (I).',
    'tool-required':'Você precisa da picareta.','empty-cylinder-required':'Não há cilindros vazios.'};
   notify(messages[check.reason]||'Não foi possível coletar este recurso.');return;
  }
  busy=true;const target=near;
  if(p.online){
   window.AbyssalOnline?.explorationCollect?.(target.id,result=>{
    busy=false;
    if(result?.ok){
     taken.add(target.id);nodes=nodes.filter(n=>n.id!==target.id);
     if(result.account)account=result.account;
     inventoryUI?.setInventory(research.sanitizeInventory(result.inventory||account?.resourceInventory||{}));
     notify('Coletado: '+(config.RESOURCES[result.item]?.name||result.item)+' +'+result.amount);
    }else notify('Coleta indisponível: '+String(result?.reason||'erro'));
   },selected);
  }else{
   const result=fields.collect(target,inventory);busy=false;
   if(!result.ok){notify('Não foi possível coletar: '+result.reason);return;}
   taken.add(target.id);nodes=nodes.filter(n=>n.id!==target.id);
   localInventory=research.sanitizeInventory(result.inventory);saveLocal();
   inventoryUI?.setInventory(localInventory);
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
 function drawMarkers(p,visible){
  if(!visible||nodes.length===0){markers.hidden=true;return;}
  const rect=canvas.getBoundingClientRect(),shellRect=shell.getBoundingClientRect();
  const w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
  markers.hidden=false;markers.style.position='absolute';markers.style.left=(rect.left-shellRect.left)+'px';markers.style.top=(rect.top-shellRect.top)+'px';
  markers.style.width=w+'px';markers.style.height=h+'px';markers.style.zIndex='14';
  if(markers.width!==w||markers.height!==h){markers.width=w;markers.height=h;}
  const c=markers.getContext('2d');c.clearRect(0,0,w,h);
  const zoom=window.AbyssalGameHooks?.worldZoom?.()||.78;
  const originX=Math.max(0,Math.min(p.worldWidth-w/zoom,p.x-w/(2*zoom))),originY=Math.max(0,Math.min(p.worldHeight-h/zoom,p.y-h/(2*zoom)));
  for(const node of nodes){
   const x=(node.x-originX)*zoom,y=(node.y-originY)*zoom;
   if(x<0||y<0||x>w||y>h)continue;
   c.strokeStyle=node.id===near?.id?'#e6f4ab':'#6be0da';c.lineWidth=2;c.beginPath();c.arc(x,y,8,0,Math.PI*2);c.stroke();
   c.fillStyle='#e7fcfd';c.font='10px Inter,sans-serif';c.fillText(config.RESOURCES[node.type]?.name||node.type,x+12,y-5);
  }
 }
 function tick(time){
  requestAnimationFrame(tick);
  const delta=Math.min(.1,Math.max(0,(time-lastTick)/1000));lastTick=time;
  const p=cfg(),active=p&&['rift','open-sea'].includes(p.mode);hud.hidden=!active;inventoryUI?.setActive(p?.mode==='open-sea');hud.querySelector('.exploration-collect').hidden=p?.mode!=='open-sea';
  if(!active){markers.hidden=true;runKey='';return;}
  if(!runKey)startRun(p);
  if(!p.paused&&!p.online){
   const depth=config.depthAt(p.y,p.worldHeight,p.mode==='rift'?160:600);
   const safe=config.safeDepth(stateLevels().pressureSuit);
   oxygen=Math.max(0,oxygen-config.gasConsumption(depth)*delta);
   if(oxygen<=0)noOxygenSeconds+=delta;else noOxygenSeconds=0;
   const hazard=p.mode==='rift'?(depth>safe?Math.min(8,(depth-safe)*.16):0)+(oxygen===0?6:0):config.environmentDamage(depth,safe,noOxygenSeconds);
   if(hazard>0)window.AbyssalGameHooks?.explorationHit?.(delta*hazard);
  }
  if(fields.ENABLED&&!p.online&&p.mode==='open-sea'&&time-lastScan>850){
   lastScan=time;
   nodes=fields.streamNear(runKey,p.x,p.y,1900,taken);
  }
  scan(p,time);
  if(time-lastRender<160)return;lastRender=time;
  const depth=p.online&&serverVitals?serverVitals.depth:config.depthAt(p.y,p.worldHeight,p.mode==='rift'?160:600);
  const pressure=config.pressureAt(depth),safe=config.safeDepth(stateLevels().pressureSuit);
  const gas=p.online&&serverVitals?serverVitals.oxygen:oxygen;
  const max=p.online&&serverVitals?serverVitals.capacity:capacity;
  $('explorationGas').textContent=Math.ceil(gas/Math.max(1,max)*100)+'%';
  $('explorationGasFill').style.width=Math.max(0,Math.min(100,gas/Math.max(1,max)*100))+'%';
  $('explorationDepth').textContent=Math.round(depth)+' m · '+pressure.toFixed(1)+' atm';
  $('explorationPressureWarning').textContent=depth>safe?'ALERTA: resistência do traje excedida':gas/max<.2?'OXIGÊNIO BAIXO':'Limite do traje: '+safe+' m';
  near=p.mode==='open-sea'?closest(p):null;inventoryUI?.setInventory(research.sanitizeInventory(stateInventory()));$('explorationDeposit').textContent=near?(config.RESOURCES[near.type]?.name||near.type)+' · '+Math.round(near.distance)+' u':'NENHUM DEPÓSITO PRÓXIMO';
  const can=Boolean(near)&&fields.eligible(near,p.x,p.y,research.sanitizeInventory(stateInventory()),115,inventoryUI?.selectedTool?.()||'abyssPickaxe').ok&&!p.paused&&!busy;
  $('explorationGatherBtn').disabled=!can;
  signal.hidden=p.mode!=='rift';
  if(p.mode==='rift'){
   const signals=window.AbyssalGameHooks?.riftSonar?.()||[];
   const closest=signals[0];
   $('explorationRiftSignalText').textContent=closest?closest.label+' · '+Math.round(closest.distance)+' u':'SEM SINAIS PRÓXIMOS';
  }
  drawMarkers(p,true);
 }
 requestAnimationFrame(tick);
})();
