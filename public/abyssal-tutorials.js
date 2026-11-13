(function(root){
 'use strict';
 const MODES={
  solo:{
   title:'O Mergulho Solitário',kicker:'MANUAL DO EXPLORADOR · SOLO',
   intro:'Sobreviva às criaturas e avance pela sequência de chefes. Suas escolhas de ressonância transformam cada mergulho.',
   tips:[
    'Use WASD ou o mouse, conforme o Controle escolhido. No celular, mova o joystick. No Controle 2, você controla a mira e os disparos.',
    'Derrote criaturas para coletar orbes de experiência. Ao subir de nível, escolha uma nova habilidade ou melhoria.',
    'A barra de progressão libera um boss por etapa e pausa até a sua derrota. Sete bosses completam o primeiro ciclo.',
    'Na primeira barra completa de uma conta, você recebe 5.000 de energia. Depois, pode retornar à superfície ou enfrentar ciclos cada vez mais fortes.',
    'Concluir toda a progressão em 100% concede a recompensa final: a Serpente Esmeralda.'
    ,'Energize o submarino próximo à base: 20 de energia por 5 minutos de luz, mais 10 por torre. Cada uma das três partes tem 1.000 de vida. Aproxime-se e use Reparar (T no PC) por 6 segundos.'
    ,'Você mantém 100% da energia coletada. Sem bônus (0%), 1.000 de energia continuam 1.000; com um Espécime de +10%, passam a 1.100. O bônus é creditado ao encerrar o mergulho, sem alterar a experiência.',
    'Na cabine, abra Pesquisa > Mergulhador. Desbloqueie Pulso de Maré (Q) e Passo Fantasma (E) com energia. Use R para a habilidade do Espécime; no celular, toque nos botões.'
   ],end:'Dica: volte à cabine para pesquisar, trocar seu Espécime e preparar o próximo mergulho.'
  },
  coop:{
   title:'Mergulho Cooperativo Online',kicker:'MANUAL DO EXPLORADOR · COOPERATIVO',
   intro:'Encontre outros mergulhadores em um mundo compartilhado, no qual bosses, criaturas, orbes e eventos pertencem ao servidor.',
   tips:[
    'Movimente-se e evolua em tempo real. Os inimigos e o progresso dos bosses são sincronizados entre os participantes da sala.',
    'Derrote monstros para coletar experiência e desbloquear ressonâncias. Ajude aliados a sobreviver aos ataques dos bosses.',
    'Cada boss da sequência vencido aproxima o grupo da conclusão da barra. Sua primeira barra pessoal completa dá 5.000 de energia, uma única vez por conta.',
    'Após receber o bônus, você escolhe voltar à superfície ou continuar pelos ciclos de fortalecimento, rumo à Serpente Esmeralda.',
    'Escolha ou crie uma sala antes de entrar. Energize a base compartilhada: 20 de energia por ciclo de 5 minutos, mais 10 por torre. Cada seção tem 1.000 de vida; o reparo leva 15 segundos.',
    'Você mantém 100% da energia coletada. O bônus do Espécime é aplicado no encerramento: 0% = 1.000 de energia; +10% = 1.100. A experiência não recebe esse bônus.',
    'No ranking por bosses derrotados, os 10 primeiros de cada período recebem energia: diário 100, semanal 1.000 e mensal 5.000.',
    'Pesquise Q (Pulso de Maré) e E (Passo Fantasma) na cabine. R ativa a habilidade do Espécime. Use os botões correspondentes no celular.'
   ],end:'A partida continua acontecendo para os demais. Enquanto este manual estiver aberto, você fica protegido, mas não pode atacar.'
  },
  pvp:{
   title:'Mar Vermelho · Arena PvP',kicker:'MANUAL DO COMBATENTE · JOGADOR CONTRA JOGADOR',
   intro:'Uma arena de confronto entre mergulhadores. Aqui não existe a barra de bosses da campanha.',
   tips:[
    'Sua missão é superar outros jogadores usando movimentação, disparos e as habilidades de sua skin.',
    'As pedras da arena bloqueiam passagem e disparos. Use-as como cobertura para escapar ou preparar sua investida.',
    'Os tiros e os efeitos de combate são validados pelo servidor. Antecipe o movimento e controle o alcance das habilidades.',
    'Aumente sua resistência com ressonâncias e faça uso cuidadoso das habilidades Q e E.',
    'O bônus de 5.000 de energia por progressão é exclusivo das campanhas solo e cooperativa, não da arena.'
   ],end:'Enquanto este manual estiver aberto, você está protegido e não pode causar dano.'
  },
  rift:{
   title:'Fossas · Exploração Online',kicker:'MANUAL DO EXPLORADOR · FOSSAS',
   intro:'Explore salas conectadas, cavernas e profundezas sob pressão. Cada descida altera o mapa e o perigo.',
   tips:[
    'Use o mapa das Fossas para encontrar fauna comum, elites e o boss. Cada câmara possui riscos e recompensas diferentes.',
    'Derrote o boss da camada para liberar os vórtices de retorno e, quando houver outra camada, de descida.',
    'Navegue até o vórtice e interaja para escolher seu destino. Sobreviver e extrair o saque vale mais do que perder tudo nas profundezas.',
    'Elites e encontros especiais podem entregar experiência, fragmentos e baús. Fique atento aos sinais da expedição.',
    'Vulcões jorram até a parede oposta; as plantas espalham veneno pela área sem atravessar rochas. Vórtices ocupam corredores. Uma marca vermelha avisa a investida dos tentáculos antes que eles saiam das fendas.',
    'Se morrer, você renasce no início da câmara com proteção temporária, sem abandonar a expedição.',
    'Na oitava camada, Pesadelo Roxo exige desviar das marcas vermelhas de seus tentáculos. Sua vitória libera o Baú Mofado Dourado com 10.000 de energia e uma skin garantida.'
   ],end:'Enquanto você lê, está protegido de dano e suas ações ofensivas ficam suspensas.'
  },
  'open-sea':{
   title:'Mar Aberto · Exploração Oceânica',kicker:'MANUAL DO EXPLORADOR · MAR ABERTO',
   intro:'Explore o oceano, registre a fauna e reúna recursos. Este modo é diferente da campanha de combate por bosses.',
   tips:[
    'Nade em todas as direções e explore a superfície, cavernas e regiões profundas. Observe o sonar e os caminhos entre as rochas.',
    'Acompanhe a profundidade, a pressão e a reserva de oxigênio. Retorne à superfície para recarregar o oxigênio antes que ele acabe.',
    'Use as ferramentas e o inventário para coletar recursos e registrar descobertas. Evite a fauna perigosa.',
    'Use a energia armazenada para pesquisas, melhorias e aquisição de Espécimes no submarino. As orbes roxas fornecem energia de pesquisa.',
    'O painel do submarino reúne seus equipamentos e sistemas. Planeje a exploração conforme a resistência do traje.'
   ],end:'Observe os instrumentos antes de avançar para águas mais profundas.'
  },
  'rift-solo':{
   title:'Fossas · Exploração Solo',kicker:'MANUAL DO EXPLORADOR · FOSSAS SOLO',
   intro:'Você está entrando sozinho em cavernas conectadas. Escolha rotas, enfrente elites e encontre a saída de cada camada.',
   tips:[
    'Monstros comuns fornecem experiência. As câmaras especiais guardam encontros e recompensas, com sinais de risco no mapa.',
    'Derrote o boss para liberar o retorno à superfície e, quando houver outra camada, a descida.',
    'Aproxime-se de um vórtice e interaja para viajar. Você pode extrair o saque ou assumir maior risco e continuar descendo.',
    'Escolha ressonâncias ao subir de nível para se preparar para a pressão crescente.',
    'O fogo espirra até a rocha oposta; o gás verde se espalha por todo o espaço aberto. Vórtices bloqueiam corredores. Observe a marca vermelha antes da investida dos tentáculos, que retornam lentamente às fendas.',
    'A morte não encerra este mergulho: você retorna ao início da sala, recupera a vida e mantém os upgrades.',
    'No oitavo patamar, derrote Pesadelo Roxo para abrir o Baú Mofado Dourado com 10.000 de energia e uma skin garantida.'
   ],end:'O tempo do mundo solo fica suspenso enquanto este manual estiver na tela.'
  }
 };
 const STEP_TOPICS=Object.freeze({
  solo:['move','combat','progress','energy','crown','submarine','bonus','skills'],
  coop:['team','combat','progress','energy','submarine','bonus','ranking','skills'],
  pvp:['duel','cover','aim','skills','energy'],
  'open-sea':['map','oxygen','inventory','energy','submarine'],
  rift:['map','portals','chest','combat','volcano','checkpoint','final'],
  'rift-solo':['map','portals','chest','skills','poison','checkpoint','final']
 });
 const STEP_NAMES=Object.freeze({
  move:'CONTROLES',combat:'CRIATURAS E DISPAROS',progress:'BARRA DE BOSSES',
  energy:'ENERGIA E RECOMPENSAS',bonus:'BÔNUS FINAL DE ENERGIA',submarine:'SISTEMAS DO SUBMARINO',ranking:'RANKINGS',oxygen:'OXIGÊNIO E PRESSÃO',inventory:'FERRAMENTAS E RECURSOS',crown:'CONQUISTA FINAL',team:'EQUIPE ONLINE',
  duel:'DUELOS',cover:'USE AS ROCHAS',aim:'MIRA PRECISA',skills:'HABILIDADES Q/E',
  map:'EXPLORE AS CÂMARAS',portals:'VÓRTICES DE PASSAGEM',
  checkpoint:'RESSURGIMENTO',volcano:'PERIGOS DO CENÁRIO',
  poison:'VENENO E ARMADILHAS',final:'CHEFE FINAL',chest:'SAQUE E RECOMPENSAS'
 });
 const GALLERY=Object.freeze([
  {topic:'volcano',label:'ROCHA VULCÂNICA'},
  {topic:'poison',label:'PLANTAS VENENOSAS'},
  {topic:'vortex',label:'POÇO DE SUCÇÃO'},
  {topic:'tentacle',label:'AVISO DO TENTÁCULO'}
 ]);
 const $=id=>document.getElementById(id);
 let guide=null,reward=null,activeMode=null,returnFocus=null,stepIndex=0,preview=false;
 function accountKey(){const nickname=root.AbyssalOnline?.getAccount?.()?.nickname;return String(nickname||'convidado').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'_').slice(0,60);}
 function storageKey(mode){return 'abyssalTutorialHideV1:'+accountKey()+':'+mode;}
 function isDismissed(mode){
  const user=root.AbyssalOnline?.getAccount?.();
  if(Array.isArray(user?.tutorialDismissedModes)&&user.tutorialDismissedModes.includes(mode))return true;
  try{return localStorage.getItem(storageKey(mode))==='1';}catch{return false;}
 }
 function ensureGuide(){
  if(guide)return guide;
  guide=document.createElement('section');
  guide.id='abyssalTutorialOverlay';guide.className='abyssal-guide-overlay';guide.hidden=true;
  guide.setAttribute('role','presentation');
  guide.innerHTML='<article class="abyssal-guide-card" role="dialog" aria-modal="true" aria-labelledby="abyssalGuideTitle" tabindex="-1"><button type="button" class="abyssal-guide-close" id="abyssalGuideX" aria-label="Fechar tutorial">×</button><div class="guide-kicker" id="abyssalGuideKicker"></div><h2 id="abyssalGuideTitle"></h2><p class="guide-intro" id="abyssalGuideIntro"></p><div id="abyssalGuideHazardGallery" class="abyssal-guide-hazard-gallery" hidden></div><div class="guide-mode-switch" id="abyssalGuideModes" hidden><button type="button" data-guide-mode="solo">Solo</button><button type="button" data-guide-mode="coop">Online</button></div><div class="guide-progress"><span id="abyssalGuideCount" aria-live="polite"></span><progress id="abyssalGuideProgress" value="1" max="1"></progress></div><ol id="abyssalGuideSteps"></ol><p class="guide-end" id="abyssalGuideEnd"></p><label class="abyssal-guide-choice"><input type="checkbox" id="abyssalGuideNever"><span>Não mostrar o tutorial novamente.</span></label><div class="abyssal-guide-actions"><button class="abyssal-guide-secondary" type="button" id="abyssalGuidePrev">VOLTAR</button><button class="abyssal-guide-primary" type="button" id="abyssalGuideNext">PRÓXIMO</button><button class="abyssal-guide-secondary" type="button" id="abyssalGuideStart">PULAR / JOGAR</button></div></article>';
  document.body.appendChild(guide);
  $('abyssalGuideX').addEventListener('click',close);
  $('abyssalGuideStart').addEventListener('click',close);
  $('abyssalGuidePrev').addEventListener('click',()=>showStep(stepIndex-1));
  $('abyssalGuideNext').addEventListener('click',()=>{if(stepIndex>=MODES[activeMode].tips.length-1)close();else showStep(stepIndex+1);});
  $('abyssalGuideModes').addEventListener('click',e=>{const mode=e.target.closest('[data-guide-mode]')?.dataset.guideMode;if(mode&&mode!==activeMode)enter(mode,true);});
  guide.addEventListener('keydown',e=>{
   if(e.key!=='Tab')return;
   const nodes=[...guide.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(n=>n.getClientRects().length);
   if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
  guide.addEventListener('pointerdown',e=>{if(e.target===guide)e.preventDefault();});
  return guide;
 }
 function protect(active){
  root.AbyssalGameHooks?.setTutorialActive?.(active);
  if(root.AbyssalOnline?.currentRoom?.())root.AbyssalOnline?.setTutorialOpen?.(active);
 }
 function showStep(index){
  if(!activeMode)return;
  const cards=[...$('abyssalGuideSteps').children],last=cards.length-1;
  stepIndex=Math.max(0,Math.min(last,index));
  cards.forEach((card,i)=>{card.hidden=i!==stepIndex;});
  $('abyssalGuideCount').textContent='ETAPA '+(stepIndex+1)+' DE '+cards.length;
  const bar=$('abyssalGuideProgress');bar.max=cards.length;bar.value=stepIndex+1;
  $('abyssalGuidePrev').disabled=stepIndex===0;
  $('abyssalGuideNext').textContent=stepIndex===last?(preview?'CONCLUIR':'COMEÇAR A JOGAR'):'PRÓXIMO';
  $('abyssalGuideStart').hidden=stepIndex===last;
  $('abyssalGuideHazardGallery').hidden=!['rift','rift-solo'].includes(activeMode)||!['volcano','poison'].includes(STEP_TOPICS[activeMode]?.[stepIndex]);
  $('abyssalGuideEnd').hidden=stepIndex!==last;
  $('abyssalGuideSteps').scrollIntoView?.({block:'nearest'});
 }
 function enter(mode,manual=false){
  mode=MODES[mode]?mode:'solo';
  if(!manual&&isDismissed(mode))return false;
  if(activeMode)close();preview=manual;
  ensureGuide();
  const def=MODES[mode];
  activeMode=mode;returnFocus=document.activeElement;
  $('abyssalGuideKicker').textContent=def.kicker;
  $('abyssalGuideTitle').textContent=def.title;
  $('abyssalGuideIntro').textContent=def.intro;
  $('abyssalGuideEnd').textContent=def.end;
  $('abyssalGuideNever').checked=false;
  $('abyssalGuideNever').closest('label').hidden=preview;
  $('abyssalGuideModes').hidden=!preview;
  $('abyssalGuideModes').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.guideMode===mode)));
  $('abyssalGuideStart').textContent=preview?'FECHAR':'PULAR / JOGAR';
  const isRift=mode==='rift'||mode==='rift-solo';
  const gallery=$('abyssalGuideHazardGallery');gallery.hidden=!isRift;
  gallery.replaceChildren(...(isRift?GALLERY:[]).map(item=>{
   const figure=document.createElement('figure');figure.className='abyssal-guide-gallery-item';
   const art=document.createElement('div');art.className='guide-picture';
   art.innerHTML=root.AbyssalTutorialArt?.render(item.topic)||'';
   const label=document.createElement('figcaption');label.textContent=item.label;
   figure.append(art,label);return figure;
  }));
  $('abyssalGuideSteps').replaceChildren(...def.tips.map((content,index)=>{
   const topic=STEP_TOPICS[mode]?.[index]||'map';
   const li=document.createElement('li');li.className='abyssal-guide-step-card';
   const picture=document.createElement('div');picture.className='guide-picture';
   picture.innerHTML=root.AbyssalTutorialArt?.render(topic)||'';
   const copy=document.createElement('div');copy.className='guide-step-text';
   const title=document.createElement('strong');title.className='guide-step-title';
   title.textContent=String(index+1).padStart(2,'0')+' · '+(STEP_NAMES[topic]||'DICA');
   const paragraph=document.createElement('p');paragraph.textContent=content;
   copy.append(title,paragraph);li.append(picture,copy);
   return li;
  }));
  guide.hidden=false;document.body.classList.add('abyssal-tutorial-open');
  if(!preview)protect(true);
  showStep(0);
  $('abyssalGuideX').focus({preventScroll:true});
  return true;
 }
 function close(){
  if(!activeMode)return;
  const mode=activeMode,never=Boolean($('abyssalGuideNever')?.checked);
  if(never&&!preview){
   try{localStorage.setItem(storageKey(mode),'1');}catch{}
   root.AbyssalOnline?.setTutorialPreference?.(mode);
  }
  activeMode=null;if(guide)guide.hidden=true;
  document.body.classList.remove('abyssal-tutorial-open');
  if(!preview)protect(false);preview=false;
  const focus=returnFocus;returnFocus=null;
  if(focus?.isConnected&&focus!==document.body)try{focus.focus({preventScroll:true});}catch{}
 }
 function ensureReward(){
  if(reward)return reward;
  reward=document.createElement('section');
  reward.id='abyssalProgressionChoice';reward.className='abyssal-guide-overlay';reward.hidden=true;
  reward.innerHTML='<article class="abyssal-guide-card" role="dialog" aria-modal="true" aria-labelledby="abyssalProgressionTitle" tabindex="-1"><div class="guide-kicker">PRIMEIRO CICLO CONQUISTADO</div><h2 id="abyssalProgressionTitle">Sua primeira barra de progressão está completa!</h2><p class="guide-reward">+5.000 DE ENERGIA</p><p class="guide-prize-info">A recompensa já foi creditada à sua conta. Deseja voltar à superfície com a conquista ou continuar enfrentando bosses fortalecidos para conquistar a recompensa final, a Serpente Esmeralda, ao atingir 100%?</p><div class="abyssal-guide-actions"><button class="abyssal-guide-primary" id="abyssalProgressionContinue" type="button">CONTINUAR ATÉ A SERPENTE</button><button class="abyssal-guide-secondary" id="abyssalProgressionSurface" type="button">VOLTAR À SUPERFÍCIE</button></div></article>';
  document.body.appendChild(reward);
  $('abyssalProgressionContinue').addEventListener('click',()=>{reward.hidden=true;document.body.classList.remove('abyssal-tutorial-open');root.AbyssalGameHooks?.setTutorialActive?.(false);});
  $('abyssalProgressionSurface').addEventListener('click',()=>{reward.hidden=true;document.body.classList.remove('abyssal-tutorial-open');root.AbyssalGameHooks?.setTutorialActive?.(false);root.AbyssalGameHooks?.returnToSurface?.();});
  return reward;
 }
 function showProgressionChoice(){
  if(!ensureReward().hidden)return;
  root.AbyssalGameHooks?.setTutorialActive?.(true);
  document.body.classList.add('abyssal-tutorial-open');
  reward.hidden=false;
  $('abyssalProgressionContinue').focus({preventScroll:true});
 }
 document.addEventListener('keydown',e=>{
  if((activeMode||reward&&!reward.hidden)&&e.key==='Escape'){
   e.preventDefault();e.stopImmediatePropagation();
   if(activeMode)close();else $('abyssalProgressionContinue')?.click();
  }
 },true);
 root.AbyssalTutorials={enter,close,showProgressionChoice,isDismissed,MODES,openManual:mode=>enter(mode,true)};
})(window);
