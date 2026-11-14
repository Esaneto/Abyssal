(function(){
 'use strict';
 const base=window.AbyssalAvatarBase;
 if(!base)return;
 const labels={hair:'Corte de cabelo',hairColor:'Cor do cabelo',outfit:'Traje',visor:'Viseira',back:'Cilindros',fins:'Nadadeiras',equipment:'Equipamento'};
 const tools=[{id:'none',name:'Sem item'},{id:'abyssWeapon',name:'Rifle'},{id:'abyssPropulsorIdle',name:'Propulsor'},{id:'abyssWelder',name:'Soldador'}];
 const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
 function createPage(){
  const page=element('section','abyss-wardrobe');page.setAttribute('aria-label','Armário do mergulhador');
  let draft=base.get(),gender=window.AbyssalDiverGender||'male',category='outfit',held='none',flipped=false,swim=false,raf=0,last=0;
  const stage=element('div','aw-stage'),intro=element('div','aw-intro');
  intro.append(element('small','aw-eyebrow','ESTAÇÃO 03 / VESTIÁRIO'),element('strong','','Seu mergulhador'),element('p','','Experimente a aparência. As escolhas são cosméticas e não alteram habilidades.'));
  const canvas=element('canvas','aw-canvas');canvas.width=440;canvas.height=500;canvas.setAttribute('aria-label','Prévia animada do mergulhador');
  const view=element('div','aw-view');const flip=element('button','','Inverter lado'),pose=element('button','','Testar nado');for(const b of [flip,pose])b.type='button';view.append(flip,pose);stage.append(intro,canvas,view);
  const panel=element('div','aw-panel'),heading=element('div','aw-panel-head');heading.append(element('small','aw-eyebrow','CONFIGURAÇÃO / VISUAL'),element('strong','','Personalização'));
  const genderRow=element('div','aw-tabs');for(const [id,label] of [['male','Mergulhador'],['female','Mergulhadora']]){const b=element('button','',label);b.type='button';b.dataset.gender=id;b.setAttribute('aria-pressed',String(gender===id));b.onclick=()=>{gender=id;for(const item of genderRow.children)item.setAttribute('aria-pressed',String(item.dataset.gender===gender));paint(performance.now());};genderRow.append(b);}
  const tabs=element('div','aw-tabs aw-categories'),choices=element('div','aw-choices'),message=element('p','aw-message','Alterações em prévia.');message.setAttribute('role','status');
  const footer=element('div','aw-footer'),reset=element('button','aw-secondary','Restaurar padrão'),save=element('button','aw-primary','Salvar aparência');reset.type=save.type='button';footer.append(reset,save);
  for(const key of [...Object.keys(base.slots),'equipment']){const b=element('button','',labels[key]);b.type='button';b.dataset.category=key;b.onclick=()=>{category=key;renderChoices();};tabs.append(b);}
  function renderChoices(){
   for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.category===category));choices.replaceChildren();
   for(const item of category==='equipment'?tools:base.slots[category]){
    const b=element('button','aw-option');b.type='button';b.setAttribute('aria-pressed',String((category==='equipment'?held:draft[category])===item.id));
    if(item.swatch){const swatch=element('span','aw-swatch');swatch.style.background=item.swatch;b.append(swatch);}
    b.append(element('span','',item.name));
    b.onclick=()=>{if(category==='equipment')held=item.id;else draft=base.select(draft,category,item.id);message.textContent=category==='equipment'?'Equipamento apenas para prévia.':'Alterações em prévia.';renderChoices();paint(performance.now());};choices.append(b);
   }
  }
  function paint(now){
   const ctx=canvas.getContext('2d');if(!ctx)return;const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
   ctx.save();ctx.translate(w/2,h/2-8);if(flipped)ctx.scale(-1,1);
   const angle=swim?-.10:-Math.PI/2,aim=swim?angle:0,r=swim?Math.min(w*.13,h*.13):h*.125;
   window.AbyssalDiverArt?.draw(ctx,0,Math.sin(now*.0015)*5,r,angle,aim,now,{gender,appearance:draft,moving:swim,heldItem:held,helmetLamp:true});ctx.restore();
  }
  function tick(now){raf=0;if(!page.isConnected||page.closest('[hidden]'))return;if(now-last>=50){last=now;paint(now);}raf=requestAnimationFrame(tick);}
  function start(){if(!raf)raf=requestAnimationFrame(tick);}
  flip.onclick=()=>{flipped=!flipped;flip.setAttribute('aria-pressed',String(flipped));paint(performance.now());};
  pose.onclick=()=>{swim=!swim;pose.setAttribute('aria-pressed',String(swim));pose.textContent=swim?'Ver em repouso':'Testar nado';paint(performance.now());};
  reset.onclick=()=>{draft=base.normalize(null);gender=window.AbyssalDiverGender||'male';held='none';renderChoices();paint(performance.now());message.textContent='Padrão em prévia. Salve para aplicar.';};
  save.onclick=()=>{base.apply(draft);const b=document.querySelector('[data-diver-gender="'+gender+'"]');if(b)b.click();else{window.AbyssalDiverGender=gender;try{localStorage.setItem('abyssalDiverGender',gender);}catch{}}window.AbyssalOnline?.saveCosmetics?.({avatarAppearance:base.get(),diverGender:gender});message.textContent='Aparência salva. Pronta para o mergulho.';};
  panel.append(heading,genderRow,tabs,choices,message,footer);page.append(stage,panel);renderChoices();paint(0);start();return page;
 }
 window.AbyssalAvatarWardrobe=Object.freeze({createPage});
})();