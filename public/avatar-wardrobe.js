(function(){
 'use strict';
 const base=window.AbyssalAvatarBase;
 if(!base)return;
 const labels={hair:'Corte de cabelo',hairColor:'Cor do cabelo',outfit:'Trajes',mask:'Máscaras',visor:'Viseiras',back:'Cilindros',fins:'Nadadeiras',skin:'Tom de pele',eyes:'Olhos',eyewear:'Óculos',headgear:'Acessórios',equipment:'Equipamento'};
 const groups=[{id:'suits',name:'Trajes',slots:['outfit']},{id:'masks',name:'Máscaras',slots:['mask','visor','eyewear']},{id:'look',name:'Aparência',slots:['hair','hairColor','skin','eyes','headgear']},{id:'gear',name:'Equipamentos',slots:['back','fins','equipment']}];
 const tools=[{id:'none',name:'Sem item'},{id:'abyssWeapon',name:'Rifle'},{id:'abyssPropulsorIdle',name:'Propulsor'},{id:'abyssWelder',name:'Soldador'}];
 const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
 function createPage(){
  const page=element('section','abyss-wardrobe');page.setAttribute('aria-label','Armário do mergulhador');
  let draft=base.get(),gender=window.AbyssalDiverGender||'male',category='outfit',held='none',flipped=false,swim=false,raf=0,last=0,motion=null,poseAt=0,observer=null,viewMode=1,lightMode=0,group='suits',query='',zoom=false;
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const stage=element('div','aw-stage'),intro=element('div','aw-intro');
  intro.append(element('small','aw-eyebrow','ESTAÇÃO 03 / VESTIÁRIO'),element('strong','','Seu mergulhador'));const status=element('span','aw-stage-status','PRÉVIA AO VIVO');intro.append(status);
  const canvas=element('canvas','aw-canvas');canvas.width=660;canvas.height=750;canvas.setAttribute('aria-label','Prévia animada do mergulhador');
  const view=element('div','aw-view');const flip=element('button','','Inverter lado'),pose=element('button','','Testar nado');for(const b of [flip,pose])b.type='button';const perspective=element('button','','Vista ¾'),lighting=element('button','','Luz: cabine');perspective.type=lighting.type='button';const zoomBtn=element('button','','Detalhe do rosto');zoomBtn.type='button';view.append(flip,pose,perspective,lighting,zoomBtn);stage.append(intro,canvas,view);
  const panel=element('div','aw-panel'),heading=element('div','aw-panel-head');heading.append(element('small','aw-eyebrow','CONFIGURAÇÃO / VISUAL'),element('strong','','Estação de equipamento'));
  const genderRow=element('div','aw-tabs');for(const [id,label] of [['male','Mergulhador'],['female','Mergulhadora']]){const b=element('button','',label);b.type='button';b.dataset.gender=id;b.setAttribute('aria-pressed',String(gender===id));b.onclick=()=>{gender=id;for(const item of genderRow.children)item.setAttribute('aria-pressed',String(item.dataset.gender===gender));renderChoices();paint(performance.now());};genderRow.append(b);}
  const groupsRow=element('div','aw-tabs aw-groups'),tabs=element('div','aw-tabs aw-categories'),searchRow=element('div','aw-search'),search=element('input','aw-search-input'),count=element('span','aw-count'),choices=element('div','aw-choices'),message=element('p','aw-message','Alterações em prévia.');message.setAttribute('role','status');search.type='search';search.placeholder='Buscar pelo nome';search.setAttribute('aria-label','Buscar cosméticos');searchRow.append(search,count);search.oninput=()=>{query=search.value;renderChoices();};
  const footer=element('div','aw-footer'),reset=element('button','aw-secondary','Restaurar padrão'),save=element('button','aw-primary','Salvar aparência');reset.type=save.type='button';footer.append(reset,save);
  function chooseCategory(key){category=key;query='';search.value='';zoom=key==='mask'||key==='visor'||key==='eyewear';zoomBtn.textContent=zoom?'Corpo inteiro':'Detalhe do rosto';if(zoom)swim=false;pose.textContent=swim?'Ver em repouso':'Testar nado';pose.setAttribute('aria-pressed',String(swim));renderChoices();paint(performance.now());}
  function renderTabs(){tabs.replaceChildren();for(const g of groupsRow.children)g.setAttribute('aria-pressed',String(g.dataset.group===group));for(const key of groups.find(g=>g.id===group).slots){const b=element('button','',labels[key]);b.type='button';b.dataset.category=key;b.onclick=()=>chooseCategory(key);tabs.append(b);}tabs.hidden=tabs.children.length===1;}
  for(const g of groups){const b=element('button','',g.name);b.type='button';b.dataset.group=g.id;b.onclick=()=>{group=g.id;renderTabs();chooseCategory(g.slots[0]);};groupsRow.append(b);}renderTabs();
  function renderChoices(){
   choices.dataset.category=category;
   for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.category===category));choices.replaceChildren();
   const textKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const all=category==='equipment'?tools:base.slots[category],items=all.filter(item=>textKey(item.name).includes(textKey(query.trim())));count.textContent=items.length+' / '+all.length;if(!items.length){choices.append(element('p','aw-empty','Nenhum item encontrado.'));return;}
   for(const item of items){
    const b=element('button','aw-option');b.type='button';b.setAttribute('aria-pressed',String((category==='equipment'?held:draft[category])===item.id));
    if(['hair','outfit','mask'].includes(category)){const thumb=element('canvas','aw-hair-thumb');thumb.width=140;thumb.height=140;thumb.setAttribute('aria-hidden','true');b.append(thumb);const tc=thumb.getContext('2d');if(tc){const appearance=base.select({...draft,hair:'shaved'},category,item.id),f=(category==='mask'?{x:70,y:70+31*3.25,r:3.25*14/.60}:category==='hair'?window.AbyssalDiverRig?.hairPortraitFrame(140,140,item.id):window.AbyssalDiverRig?.previewFrame(140,140,-Math.PI/2,-Math.PI/2,'none',false,'shaved'))||{x:70,y:76,r:24};window.AbyssalDiverArt?.draw(tc,f.x,f.y,f.r,-Math.PI/2,-Math.PI/2,0,{gender,appearance,heldItem:'none',moving:false,reducedMotion:true,helmetLamp:category!=='mask',viewYaw:0});}}
    if(item.swatch){const swatch=element('span','aw-swatch');swatch.style.background=item.swatch;b.append(swatch);}
    const copy=element('span','aw-option-copy');copy.append(element('strong','',item.name));if(item.description){b.title=item.description;copy.append(element('small','',item.description));}if(category==='outfit'||category==='mask')copy.append(element('span','aw-tier',item.id==='navy'||item.id==='standard'?'Básico':'Especial'));b.append(copy);
    b.dataset.item=item.id;b.onclick=()=>{if(category==='equipment')held=item.id;else draft=base.select(draft,category,item.id);message.textContent=category==='equipment'?'Equipamento apenas para prévia.':base.same(draft,base.get())?'Aparência atual.':'Alterações não salvas.';for(const card of choices.querySelectorAll('button[data-item]'))card.setAttribute('aria-pressed',String(card.dataset.item===item.id));paint(performance.now());};choices.append(b);
   }
  }
  function paint(now){
   const ctx=canvas.getContext('2d');if(!ctx)return;const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
   const angle=swim?(flipped?Math.PI+.10:-.10):-Math.PI/2,aim=held==='none'||swim?angle:held==='abyssWelder'?-.20:0,powered=swim&&held==='abyssPropulsorIdle';
   const scale=Math.min(w/44,h/47),frame=zoom&&!swim?{x:w/2,y:h/2+31*scale,r:scale*14/.60}:window.AbyssalDiverRig?.previewFrame(w,h,angle,aim,held,powered,draft.hair)||{x:w/2,y:h*.42,r:h*.12};
   ctx.save();ctx.translate(flipped&&!swim?w-frame.x:frame.x,frame.y);if(flipped&&!swim)ctx.scale(-1,1);const r=frame.r;
   motion=window.AbyssalDiverRig?.advance(motion,swim?1:0,poseAt?Math.min(.10,(now-poseAt)/1000):0,swim&&held==='abyssPropulsorIdle',{heading:angle,vx:swim?Math.cos(angle)*(powered?3:1):0,vy:swim?Math.sin(angle)*(powered?3:1):0});poseAt=now;
   window.AbyssalDiverArt?.draw(ctx,0,reduceMotion?.matches?0:Math.sin(now*.0015)*4,r,angle,aim,now,{gender,appearance:draft,motion,moving:swim,heldItem:swim&&held==='abyssPropulsorIdle'?'abyssPropulsor':held,propulsorActive:swim&&held==='abyssPropulsorIdle',reducedMotion:Boolean(reduceMotion?.matches&&!swim),helmetLamp:true,viewYaw:swim?1:[0,.65,1][viewMode],light:[{depth:0,intensity:.85,angle:-1.2},{depth:800,intensity:.18,angle:-1.2},{depth:800,intensity:1,angle:-.5}][lightMode]});ctx.restore();
  }
  function tick(now){raf=0;if(!page.isConnected||page.closest('[hidden]')||document.hidden)return;if(now-last>=42){last=now;paint(now);}if(!reduceMotion?.matches||swim)raf=requestAnimationFrame(tick);}
  function start(){if(!raf&&page.isConnected&&!page.closest('[hidden]')&&!document.hidden)raf=requestAnimationFrame(tick);}
  function syncGender(){for(const item of genderRow.children)item.setAttribute('aria-pressed',String(item.dataset.gender===gender));}
  flip.onclick=()=>{flipped=!flipped;flip.setAttribute('aria-pressed',String(flipped));paint(performance.now());};
  zoomBtn.onclick=()=>{zoom=!zoom;if(zoom){swim=false;pose.textContent='Testar nado';pose.setAttribute('aria-pressed','false');}zoomBtn.textContent=zoom?'Corpo inteiro':'Detalhe do rosto';paint(performance.now());};
  pose.onclick=()=>{swim=!swim;if(swim){zoom=false;zoomBtn.textContent='Detalhe do rosto';}pose.setAttribute('aria-pressed',String(swim));pose.textContent=swim?'Ver em repouso':'Testar nado';paint(performance.now());start();};
  perspective.onclick=()=>{viewMode=(viewMode+1)%3;perspective.textContent=['Vista frontal','Vista ¾','Vista lateral'][viewMode];paint(performance.now());};
  lighting.onclick=()=>{lightMode=(lightMode+1)%3;lighting.textContent=['Luz: cabine','Luz: abismo','Luz: farol'][lightMode];paint(performance.now());};
  reset.onclick=()=>{draft=base.normalize(null);gender=window.AbyssalDiverGender||'male';held='none';flipped=false;swim=false;motion=null;viewMode=1;lightMode=0;zoom=false;zoomBtn.textContent='Detalhe do rosto';perspective.textContent='Vista ¾';lighting.textContent='Luz: cabine';flip.setAttribute('aria-pressed','false');pose.setAttribute('aria-pressed','false');pose.textContent='Testar nado';syncGender();renderChoices();paint(performance.now());message.textContent='Padrão em prévia. Salve para aplicar.';};
  save.onclick=()=>{base.apply(draft);const b=document.querySelector('[data-diver-gender="'+gender+'"]');if(b)b.click();else{window.AbyssalDiverGender=gender;try{localStorage.setItem('abyssalDiverGender',gender);}catch{}}window.AbyssalOnline?.saveCosmetics?.({avatarAppearance:base.get(),diverGender:gender});message.textContent='Aparência salva neste dispositivo.';};
  panel.append(heading,genderRow,groupsRow,tabs,searchRow,choices,message,footer);page.append(stage,panel);renderChoices();paint(0);
  // Observe only the mounted document and release every listener when the panel is removed.
  let wasMounted=false;const onVisibility=()=>start();document.addEventListener('visibilitychange',onVisibility);
  observer=new MutationObserver(()=>{if(page.isConnected){wasMounted=true;start();}else if(wasMounted){if(raf)cancelAnimationFrame(raf);raf=0;observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);}});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  queueMicrotask(()=>{if(page.isConnected){wasMounted=true;start();}else{observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);}});return page;
 }
 window.AbyssalAvatarWardrobe=Object.freeze({createPage});
})();