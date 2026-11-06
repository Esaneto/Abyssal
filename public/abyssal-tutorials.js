(function(root){
 'use strict';
 const MODES={
  solo:{
   title:'O Mergulho Solitário',kicker:'MANUAL DO EXPLORADOR · SOLO',
   intro:'Sobreviva às criaturas e avance pela sequência de chefes. Suas escolhas de ressonância transformam cada mergulho.',
   tips:[
    'Mova-se pelo mouse ou por WASD, conforme o controle escolhido. No celular, utilize o controle de movimento. A mira pode ser automática ou manual no Controle 2.',
    'Derrote criaturas para coletar orbes de experiência. Ao subir de nível, escolha uma nova habilidade ou melhoria.',
    'A barra de progressão libera um boss por etapa e pausa até a sua derrota. Sete bosses completam o primeiro ciclo.',
    'Na primeira barra completa de uma conta, você recebe 50.000 moedas abissais. Depois, pode retornar à superfície ou enfrentar ciclos cada vez mais fortes.',
    'Concluir toda a progressão em 100% concede a recompensa final: a Serpente Esmeralda.'
   ],end:'Q e E ativam habilidades equipadas. Use o menu de Controles para personalizar a navegação.'
  },
  coop:{
   title:'Mar Aberto · Expedição Online',kicker:'MANUAL DO EXPLORADOR · COOPERATIVO',
   intro:'Encontre outros mergulhadores em um mundo compartilhado, no qual bosses, criaturas, orbes e eventos pertencem ao servidor.',
   tips:[
    'Movimente-se e evolua em tempo real. Os inimigos e o progresso dos bosses são sincronizados entre os participantes da sala.',
    'Derrote monstros para coletar experiência e desbloquear ressonâncias. Ajude aliados a sobreviver aos ataques dos bosses.',
    'Cada boss da sequência vencido aproxima o grupo da conclusão da barra. Sua primeira barra pessoal completa dá 50.000 moedas, uma única vez por conta.',
    'Após receber o bônus, você escolhe voltar à superfície ou continuar pelos ciclos de fortalecimento, rumo à Serpente Esmeralda.',
    'Use a identificação da sala para convidar amigos; os dados de moedas e títulos pertencem à sua conta.'
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
    'O bônus de 50.000 moedas por progressão é exclusivo das campanhas solo e cooperativa, não da arena.'
   ],end:'Enquanto este manual estiver aberto, você está protegido e não pode causar dano.'
  },
  rift:{
   title:'Fossas · Exploração Online',kicker:'MANUAL DO EXPLORADOR · FOSSAS',
   intro:'Explore salas conectadas, cavernas e profundezas sob pressão. Cada descida altera o mapa e o perigo.',
   tips:[
    'Use o mapa das Fossas para encontrar fauna comum, elites e o boss. Cada câmara possui riscos e recompensas diferentes.',
    'Derrote o boss da camada para liberar os vórtices: um retorna à superfície e outro leva à profundidade seguinte.',
    'Navegue até o vórtice e interaja para escolher seu destino. Sobreviver e extrair o saque vale mais do que perder tudo nas profundezas.',
    'Elites e encontros especiais podem entregar experiência, fragmentos e baús. Fique atento aos sinais da expedição.',
    'Vulcões, fumarolas, tentáculos, redemoinhos, pressão, eletricidade e desmoronamentos ativam avisos antes de causar dano. Observe os sinais e atravesse durante a pausa.',
    'Se morrer, você renasce no início da câmara com proteção temporária, sem abandonar a expedição.',
    'Na oitava camada, O Sorriso do Abismo exige desviar das marcas vermelhas de seus tentáculos. Sua vitória libera o Baú Mofado Dourado com 100.000 moedas e uma skin garantida.'
   ],end:'Enquanto você lê, está protegido de dano e suas ações ofensivas ficam suspensas.'
  },
  'rift-solo':{
   title:'Fossas · Exploração Solo',kicker:'MANUAL DO EXPLORADOR · FOSSAS SOLO',
   intro:'Você está entrando sozinho em cavernas conectadas. Escolha rotas, enfrente elites e encontre a saída de cada camada.',
   tips:[
    'Monstros comuns fornecem experiência. As câmaras especiais guardam encontros e recompensas, com sinais de risco no mapa.',
    'Derrote o boss para ativar dois vórtices: retorno à superfície e descida à próxima camada.',
    'Aproxime-se de um vórtice e interaja para viajar. Você pode extrair o saque ou assumir maior risco e continuar descendo.',
    'Escolha ressonâncias ao subir de nível para se preparar para a pressão crescente.',
    'Vulcões, fumarolas, desmoronamentos, espinhos, iscas, correntes, pressão e tentáculos mostram avisos antes do impacto. Os tentáculos indicam a área de ataque em vermelho translúcido.',
    'A morte não encerra este mergulho: você retorna ao início da sala, recupera a vida e mantém os upgrades.',
    'No oitavo patamar, derrote O Sorriso do Abismo para abrir o Baú Mofado Dourado com 100.000 moedas e uma skin garantida.'
   ],end:'O tempo do mundo solo fica suspenso enquanto este manual estiver na tela.'
  }
 };
 const STEP_TOPICS=Object.freeze({
  solo:['move','combat','progress','coins','crown'],
  coop:['team','combat','progress','coins','skills'],
  pvp:['duel','cover','aim','skills','coins'],
  rift:['map','portals','chest','combat','volcano','checkpoint','final'],
  'rift-solo':['map','portals','chest','skills','poison','checkpoint','final']
 });
 const STEP_NAMES=Object.freeze({
  move:'CONTROLES',combat:'CRIATURAS E DISPAROS',progress:'BARRA DE BOSSES',
  coins:'MOEDAS E BÔNUS',crown:'CONQUISTA FINAL',team:'EQUIPE ONLINE',
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
 let guide=null,reward=null,activeMode=null,returnFocus=null;
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
  guide.innerHTML='<article class="abyssal-guide-card" role="dialog" aria-modal="true" aria-labelledby="abyssalGuideTitle" tabindex="-1"><button type="button" class="abyssal-guide-close" id="abyssalGuideX" aria-label="Fechar tutorial">×</button><div class="guide-kicker" id="abyssalGuideKicker"></div><h2 id="abyssalGuideTitle"></h2><p class="guide-intro" id="abyssalGuideIntro"></p><div id="abyssalGuideHazardGallery" class="abyssal-guide-hazard-gallery" hidden></div><ol id="abyssalGuideSteps"></ol><p class="guide-end" id="abyssalGuideEnd"></p><label class="abyssal-guide-choice"><input type="checkbox" id="abyssalGuideNever"><span>Não mostrar o tutorial novamente.</span></label><div class="abyssal-guide-actions"><button class="abyssal-guide-primary" type="button" id="abyssalGuideStart">COMEÇAR A JOGAR</button></div></article>';
  document.body.appendChild(guide);
  $('abyssalGuideX').addEventListener('click',close);
  $('abyssalGuideStart').addEventListener('click',close);
  guide.addEventListener('pointerdown',e=>{if(e.target===guide)e.preventDefault();});
  return guide;
 }
 function protect(active){
  root.AbyssalGameHooks?.setTutorialActive?.(active);
  if(root.AbyssalOnline?.currentRoom?.())root.AbyssalOnline?.setTutorialOpen?.(active);
 }
 function enter(mode){
  mode=MODES[mode]?mode:'solo';
  if(isDismissed(mode))return false;
  if(activeMode)close();
  ensureGuide();
  const def=MODES[mode];
  activeMode=mode;returnFocus=document.activeElement;
  $('abyssalGuideKicker').textContent=def.kicker;
  $('abyssalGuideTitle').textContent=def.title;
  $('abyssalGuideIntro').textContent=def.intro;
  $('abyssalGuideEnd').textContent=def.end;
  $('abyssalGuideNever').checked=false;
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
  protect(true);
  $('abyssalGuideX').focus({preventScroll:true});
  return true;
 }
 function close(){
  if(!activeMode)return;
  const mode=activeMode,never=Boolean($('abyssalGuideNever')?.checked);
  if(never){
   try{localStorage.setItem(storageKey(mode),'1');}catch{}
   root.AbyssalOnline?.setTutorialPreference?.(mode);
  }
  activeMode=null;if(guide)guide.hidden=true;
  document.body.classList.remove('abyssal-tutorial-open');
  protect(false);
  const focus=returnFocus;returnFocus=null;
  if(focus?.isConnected&&focus!==document.body)try{focus.focus({preventScroll:true});}catch{}
 }
 function ensureReward(){
  if(reward)return reward;
  reward=document.createElement('section');
  reward.id='abyssalProgressionChoice';reward.className='abyssal-guide-overlay';reward.hidden=true;
  reward.innerHTML='<article class="abyssal-guide-card" role="dialog" aria-modal="true" aria-labelledby="abyssalProgressionTitle" tabindex="-1"><div class="guide-kicker">PRIMEIRO CICLO CONQUISTADO</div><h2 id="abyssalProgressionTitle">Sua primeira barra de progressão está completa!</h2><p class="guide-reward">+50.000 MOEDAS ABISSAIS</p><p class="guide-prize-info">A recompensa já foi creditada à sua conta. Deseja voltar à superfície com a conquista ou continuar enfrentando bosses fortalecidos para conquistar a recompensa final, a Serpente Esmeralda, ao atingir 100%?</p><div class="abyssal-guide-actions"><button class="abyssal-guide-primary" id="abyssalProgressionContinue" type="button">CONTINUAR ATÉ A SERPENTE</button><button class="abyssal-guide-secondary" id="abyssalProgressionSurface" type="button">VOLTAR À SUPERFÍCIE</button></div></article>';
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
 root.AbyssalTutorials={enter,close,showProgressionChoice,isDismissed,MODES};
})(window);
