(function(){
 'use strict';
 const base=window.AbyssalAvatarBase;
 if(!base)return;
 const labels={hair:'Corte de cabelo',hairColor:'Cor do cabelo',outfit:'Traje',visor:'Viseira',back:'Cilindros',fins:'Nadadeiras',equipment:'Equipamento'};
 const tools=[{id:'none',name:'Sem item'},{id:'abyssWeapon',name:'Rifle'},{id:'abyssPropulsorIdle',name:'Propulsor'},{id:'abyssWelder',name:'Soldador'}];
 const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
 function createPage(){
  const page=element('section','abyss-wardrobe');page.setAttribute('aria-label','Armário do mergulhador');
  let draft=base.get(),gender=window.AbyssalDiverGender||'male',category='outfit',held='none',flipped=false,swim=false,raf=0,last=0,motion=null,poseAt=0,observer=null;
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const stage=element('div','aw-stage'),intro=element('div','aw-intro');
  intro.append(element('small','aw-eyebrow','ESTAÇÃO 03 / VESTIÁRIO'),element('strong','','Seu mergulhador'),element('p','','Monte seu traje, teste ferramentas e confira a aparência em movimento. Personalizações cosméticas, sem vantagens de combate.'));
  const canvas=element('canvas','aw-canvas');canvas.width=660;canvas.height=750;canvas.setAttribute('aria-label','Prévia animada do mergulhador');
  const view=element('div','aw-view');const flip=element('button','','Inverter lado'),pose=element('button','','Testar nado');for(const b of [flip,pose])b.type='button';view.append(flip,pose);stage.append(intro,canvas,view);
  const panel=element('div','aw-panel'),heading=element('div','aw-panel-head');heading.append(element('small','aw-eyebrow','CONFIGURAÇÃO / VISUAL'),element('strong','','Estação de equipamento'));
  const genderRow=element('div','aw-tabs');for(const [id,label] of [['male','Mergulhador'],['female','Mergulhadora']]){const b=element('button','',label);b.type='button';b.dataset.gender=id;b.setAttribute('aria-pressed',String(gender===id));b.onclick=()=>{gender=id;for(const item of genderRow.children)item.setAttribute('aria-pressed',String(item.dataset.gender===gender));paint(performance.now());};genderRow.append(b);}
  const tabs=element('div','aw-tabs aw-categories'),choices=element('div','aw-choices'),message=element('p','aw-message','Alterações em prévia.');message.setAttribute('role','status');
  const footer=element('div','aw-footer'),reset=element('button','aw-secondary','Restaurar padrão'),save=element('button','aw-primary','Salvar aparência');reset.type=save.type='button';footer.append(reset,save);
  for(const key of [...Object.keys(base.slots),'equipment']){const b=element('button','',labels[key]);b.type='button';b.dataset.category=key;b.onclick=()=>{category=key;renderChoices();};tabs.append(b);}
  function renderChoices(){
   choices.dataset.category=category;
   for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.category===category));choices.replaceChildren();
   for(const item of category==='equipment'?tools:base.slots[category]){
    const b=element('button','aw-option');b.type='button';b.setAttribute('aria-pressed',String((category==='equipment'?held:draft[category])===item.id));
    if(category==='hair'){const thumb=element('canvas','aw-hair-thumb');thumb.width=140;thumb.height=140;thumb.setAttribute('aria-hidden','true');b.append(thumb);const tc=thumb.getContext('2d');if(tc){const appearance=base.select({...draft,hair:'shaved'},'hair',item.id),f=window.AbyssalDiverRig?.hairPortraitFrame(140,140,item.id)||{x:70,y:76,r:24};window.AbyssalDiverArt?.draw(tc,f.x,f.y,f.r,-Math.PI/2,-Math.PI/2,0,{gender,appearance,heldItem:'none',moving:false,reducedMotion:true,helmetLamp:true});}}
    if(item.swatch){const swatch=element('span','aw-swatch');swatch.style.background=item.swatch;b.append(swatch);}
    const copy=element('span','aw-option-copy');copy.append(element('strong','',item.name));if(item.description)copy.append(element('small','',item.description));b.append(copy);
    b.onclick=()=>{if(category==='equipment')held=item.id;else draft=base.select(draft,category,item.id);message.textContent=category==='equipment'?'Equipamento apenas para prévia.':'Alterações em prévia.';renderChoices();paint(performance.now());};choices.append(b);
   }
  }
  function paint(now){
   const ctx=canvas.getContext('2d');if(!ctx)return;const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
   const angle=swim?-.10:-Math.PI/2,aim=held==='none'||swim?angle:held==='abyssWelder'?-.20:0,powered=swim&&held==='abyssPropulsorIdle';
   const frame=window.AbyssalDiverRig?.previewFrame(w,h,angle,aim,held,powered,draft.hair)||{x:w/2,y:h*.42,r:h*.12};
   ctx.save();ctx.translate(flipped?w-frame.x:frame.x,frame.y);if(flipped)ctx.scale(-1,1);const r=frame.r;
   motion=window.AbyssalDiverRig?.advance(motion,swim?1:0,poseAt?Math.min(.10,(now-poseAt)/1000):0,swim&&held==='abyssPropulsorIdle',{heading:angle,vx:swim?Math.cos(angle)*(powered?3:1):0,vy:swim?Math.sin(angle)*(powered?3:1):0});poseAt=now;
   window.AbyssalDiverArt?.draw(ctx,0,reduceMotion?.matches?0:Math.sin(now*.0015)*4,r,angle,aim,now,{gender,appearance:draft,motion,moving:swim,heldItem:swim&&held==='abyssPropulsorIdle'?'abyssPropulsor':held,propulsorActive:swim&&held==='abyssPropulsorIdle',reducedMotion:Boolean(reduceMotion?.matches&&!swim),helmetLamp:true});ctx.restore();
  }
  function tick(now){raf=0;if(!page.isConnected||page.closest('[hidden]')||document.hidden)return;if(now-last>=42){last=now;paint(now);}if(!reduceMotion?.matches||swim)raf=requestAnimationFrame(tick);}
  function start(){if(!raf&&page.isConnected&&!page.closest('[hidden]')&&!document.hidden)raf=requestAnimationFrame(tick);}
  function syncGender(){for(const item of genderRow.children)item.setAttribute('aria-pressed',String(item.dataset.gender===gender));}
  flip.onclick=()=>{flipped=!flipped;flip.setAttribute('aria-pressed',String(flipped));paint(performance.now());};
  pose.onclick=()=>{swim=!swim;pose.setAttribute('aria-pressed',String(swim));pose.textContent=swim?'Ver em repouso':'Testar nado';paint(performance.now());start();};
  reset.onclick=()=>{draft=base.normalize(null);gender=window.AbyssalDiverGender||'male';held='none';flipped=false;swim=false;motion=null;flip.setAttribute('aria-pressed','false');pose.setAttribute('aria-pressed','false');pose.textContent='Testar nado';syncGender();renderChoices();paint(performance.now());message.textContent='Padrão em prévia. Salve para aplicar.';};
  save.onclick=()=>{base.apply(draft);const b=document.querySelector('[data-diver-gender="'+gender+'"]');if(b)b.click();else{window.AbyssalDiverGender=gender;try{localStorage.setItem('abyssalDiverGender',gender);}catch{}}window.AbyssalOnline?.saveCosmetics?.({avatarAppearance:base.get(),diverGender:gender});message.textContent='Aparência salva. Pronta para o mergulho.';};
  panel.append(heading,genderRow,tabs,choices,message,footer);page.append(stage,panel);renderChoices();paint(0);
  // Observe only the mounted document and release every listener when the panel is removed.
  let wasMounted=false;const onVisibility=()=>start();document.addEventListener('visibilitychange',onVisibility);
  observer=new MutationObserver(()=>{if(page.isConnected){wasMounted=true;start();}else if(wasMounted){if(raf)cancelAnimationFrame(raf);raf=0;observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);}});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  queueMicrotask(()=>{if(page.isConnected){wasMounted=true;start();}else{observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);}});return page;
 }
 window.AbyssalAvatarWardrobe=Object.freeze({createPage});
})();