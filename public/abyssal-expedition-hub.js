/* Expedition hub. Navigation is DOM-based; the ocean backdrop is a decorative
 * preview, not a separate simulation. Existing buttons keep their own handlers.
 */
(function(){
 'use strict';
 function boot(){
  const menu=document.getElementById('menuScreen');
  const stage=document.getElementById('menuOceanStage');
  const layer=document.getElementById('menuOceanPortalLayer');
  const solo=document.getElementById('playBtn');
  const online=document.getElementById('onlineBtn');
  const rift=document.getElementById('riftPortalBtn');
  const scenery=document.getElementById('menuOceanScenery');
  if(!menu||!stage||!layer||!solo||!online||!rift||!scenery||menu.dataset.expeditionHubReady)return;
  menu.dataset.expeditionHubReady='true';
  menu.classList.add('expedition-hub');
  const heading=menu.querySelector('.abyss-menu-heading p');
  if(heading)heading.textContent='Explore o Mar Aberto. Prepare sua próxima expedição no submarino.';
  const panel=document.createElement('section');
  panel.className='expedition-left-panel';
  panel.setAttribute('aria-label','Escolher tipo de expedição');
  const tag=document.createElement('span');tag.className='expedition-label';tag.textContent='CENTRAL DE EXPEDIÇÕES';
  const title=document.createElement('h2');title.textContent='ESCOLHA O MERGULHO';
  const intro=document.createElement('p');intro.textContent='O mergulhador é seu protagonista. Explore sozinho ou com outros jogadores.';
  const actions=document.createElement('div');actions.className='expedition-mode-actions';
  actions.append(solo,online);
  solo.querySelector('strong').textContent='MERGULHAR SOLO';
  online.querySelector('strong').textContent='MERGULHAR ONLINE';
  const base=document.createElement('button');base.id='openSubmarineBaseBtn';base.type='button';base.className='expedition-base-btn';
  base.textContent='SUBMARINO · BASE DE OPERAÇÕES';
  panel.append(tag,title,intro,actions,base);
  stage.insertBefore(panel,layer);
  const caption=document.createElement('div');caption.className='expedition-ocean-caption';
  const captionTag=document.createElement('span');captionTag.className='expedition-label';captionTag.textContent='OCEANO EXPLORÁVEL';
  const captionTitle=document.createElement('h2');captionTitle.textContent='MAR ABERTO';
  const captionText=document.createElement('p');captionText.textContent='Vida marinha, habitats e profundidades por descobrir.';
  caption.append(captionTag,captionTitle,captionText);
  layer.appendChild(caption);
  // Fossas remains a separate destination and retains its preexisting dialog.
  rift.querySelector('strong').textContent='FOSSAS ABISSAIS';
  layer.appendChild(rift);
  const baseDialog=document.createElement('div');
  baseDialog.id='submarineBasePanel';
  baseDialog.className='expedition-submarine-modal';
  baseDialog.hidden=true;
  baseDialog.innerHTML='<section class="expedition-submarine-card" role="dialog" aria-modal="true" aria-labelledby="expeditionBaseTitle">'+
   '<header><span class="expedition-label">CENTRAL DO SUBMARINO</span><button id="closeSubmarineBaseBtn" type="button" aria-label="Fechar base">×</button></header>'+
   '<h2 id="expeditionBaseTitle">BASE DE OPERAÇÕES</h2>'+
   '<p>Prepare a expedição, consulte a enciclopédia e acompanhe as tecnologias em desenvolvimento.</p>'+
   '<div class="expedition-base-grid">'+
   '<button type="button" data-base-target="shopBtn"><strong>ESPÉCIMES E EQUIPAMENTOS</strong><small>Consultar o catálogo existente</small></button>'+
   '<button type="button" data-base-target="catalogBtn"><strong>ENCICLOPÉDIA</strong><small>Consultar espécies registradas</small></button>'+
   '<button type="button" data-base-target="resonanceBtn"><strong>RESSONÂNCIA</strong><small>Configuração atual enquanto a pesquisa é integrada</small></button>'+
   '</div><div id="expeditionResearchIndex" class="expedition-research-index" aria-label="Tecnologias planejadas"></div>'+
   '</section>';
  document.body.appendChild(baseDialog);
  const close=()=>{baseDialog.hidden=true;base.focus();};
  base.addEventListener('click',()=>{
   const index=baseDialog.querySelector('#expeditionResearchIndex');
   if(index&&!index.childElementCount){
    const h=document.createElement('h3');h.textContent='ÁRVORE DE PESQUISAS';
    const note=document.createElement('p');note.textContent='Projetos tecnológicos registrados. O desbloqueio por coleta de materiais será ativado após a integração com o inventário e o servidor.';
    const list=document.createElement('ul');
    for(const item of Object.values(window.AbyssalExplorationConfig?.RESEARCH||{})){
     const li=document.createElement('li');li.textContent=item.name+' · '+(item.group==='equipment'?'EQUIPAMENTO':item.group==='active'?'HABILIDADE Q/E':'PASSIVA');list.append(li);
    }
    index.append(h,note,list);
   }
   baseDialog.hidden=false;
  });
  baseDialog.querySelector('#closeSubmarineBaseBtn').addEventListener('click',close);
  baseDialog.addEventListener('click',event=>{if(event.target===baseDialog)close();});
  baseDialog.addEventListener('click',event=>{
   const btn=event.target.closest('[data-base-target]');if(!btn)return;
   const destination=document.getElementById(btn.dataset.baseTarget);
   close();
   destination?.click();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!baseDialog.hidden)close();});
  // Reuse the deterministic procedural seascape. Fish are cosmetic and only
  // render in the menu, with a small bounded update cost.
  const canvas=document.createElement('canvas');
  canvas.className='expedition-marine-canvas';canvas.setAttribute('aria-hidden','true');layer.appendChild(canvas);
  const context=canvas.getContext('2d',{alpha:true});
  let width=0,height=0,dpr=1,lastFrame=0;
  function fit(){
   const rect=layer.getBoundingClientRect();
   width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));
   dpr=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(1300000/(width*height)));
   canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
   canvas.style.width=width+'px';canvas.style.height=height+'px';
   context.setTransform(dpr,0,0,dpr,0,0);
   window.AbyssalMenuScenery?.draw?.(scenery,width,height);
  }
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(fit):null;
  observer?.observe(layer);window.addEventListener('resize',fit);fit();
  function fish(x,y,size,tone,phase){
   context.save();context.translate(x,y);context.scale(size,size);
   context.fillStyle=tone;context.beginPath();
   context.moveTo(-1,0);context.quadraticCurveTo(0,-.44,1,0);context.quadraticCurveTo(0,.44,-1,0);
   context.moveTo(-.8,0);context.lineTo(-1.55,-.56);context.lineTo(-1.55,.56);
   context.closePath();context.fill();
   context.beginPath();context.arc(.56,-.10,.09,0,Math.PI*2);
   context.fillStyle='rgba(232,253,255,.8)';context.fill();context.restore();
  }
  function frame(t){
   requestAnimationFrame(frame);
   if(menu.hidden||document.hidden||!context||t-lastFrame<48)return;
   lastFrame=t;context.clearRect(0,0,width,height);
   for(let school=0;school<4;school++){
    const direction=school%2?-1:1,shift=(t*.010*(1+school*.26))%(width+150);
    const cx=direction>0?shift-70:width+70-shift;
    const cy=height*(.23+school*.145);
    for(let i=0;i<12;i++){
     const angle=i*2.399,rad=Math.sqrt(i)*8;
     fish(cx+Math.cos(angle)*rad,cy+Math.sin(angle)*rad*.7+Math.sin(t*.001+i)*2,2.8+(i%4)*.4,
      school%2?'rgba(119,179,189,.55)':'rgba(126,208,213,.54)');
    }
   }
   // Two giant silhouettes suggest scale without simulating combat in the menu.
   for(let k=0;k<2;k++){
    const drift=(t*.003*(k+1))%(width+440);
    const x=k?width+220-drift:drift-220,y=height*(k?.47:.68);
    context.save();context.translate(x,y);context.scale(k?1:-1,1);
    context.fillStyle=k?'rgba(45,91,112,.24)':'rgba(30,72,96,.32)';
    context.beginPath();context.ellipse(0,0,k?68:94,k?18:25,0,0,Math.PI*2);
    context.moveTo(-65,0);context.lineTo(-129,-34);context.lineTo(-120,39);context.closePath();context.fill();
    context.beginPath();context.moveTo(-8,-12);context.lineTo(7,-37);context.lineTo(29,-12);context.fill();
    context.restore();
   }
  }
  requestAnimationFrame(frame);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
