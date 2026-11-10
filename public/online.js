(() => {
'use strict';
const $=id=>document.getElementById(id);
let socket=null,authenticated=false,connected=false,localPlayerId=null,players=new Map(),playersByNetId=new Map(),lastPositionAt=0,hostId=null,currentRoom=null,pendingRoomPassword='',roomPollTimer=null,socketRoomsCache=null,httpRoomsCache=null,socketRoomsAt=0,httpRoomsAt=0;
let positionHeartbeatTimer=null,latestPositionPayload=null,positionPacketInFlight=false,positionSequence=0,positionAckAt=0,positionAckErrors=0,positionPacketsSent=0,lastNetMetaAt=0,lastReconcileSeq=0,pendingMotion=new Map(),motionRttMs=null,motionJitterMs=null,motionAckCount=0;
let account=JSON.parse(localStorage.getItem('abyssalAccount')||'null'),serverAccount=null;
const networkDebugEnabled=(()=>{try{return new URLSearchParams(location.search).get('abyssalDebug')==='1';}catch(_){return false;}})();
let netDiagWindowAt=performance.now(),netDiagSent=0,netDiagReceived=0,netDiagSentBytes=0,netDiagReceivedBytes=0,netDiagRates={sentPerSec:0,receivedPerSec:0,sentBytesPerSec:0,receivedBytesPerSec:0};
const netDiagEncoder=typeof TextEncoder!=='undefined'?new TextEncoder():null;
function diagnosticBytes(values){
 if(!networkDebugEnabled)return 0;let total=0;
 for(const value of values){
  if(value instanceof ArrayBuffer)total+=value.byteLength;
  else if(ArrayBuffer.isView(value))total+=value.byteLength;
  else try{const raw=JSON.stringify(value);total+=netDiagEncoder?netDiagEncoder.encode(raw).byteLength:raw.length*2;}catch(_){}
 }
 return total;
}
function updateNetworkDiagnosticWindow(){
 if(!networkDebugEnabled)return;const now=performance.now(),elapsed=now-netDiagWindowAt;if(elapsed<1000)return;
 const scale=1000/Math.max(1,elapsed);netDiagRates={sentPerSec:Number((netDiagSent*scale).toFixed(1)),receivedPerSec:Number((netDiagReceived*scale).toFixed(1)),sentBytesPerSec:Math.round(netDiagSentBytes*scale),receivedBytesPerSec:Math.round(netDiagReceivedBytes*scale)};
 netDiagWindowAt=now;netDiagSent=0;netDiagReceived=0;netDiagSentBytes=0;netDiagReceivedBytes=0;
}
function attachNetworkDiagnostics(target){
 if(!networkDebugEnabled||!target||target.__abyssalNetworkDiagnostics)return;target.__abyssalNetworkDiagnostics=true;
 target.onAny?.((_event,...args)=>{netDiagReceived++;netDiagReceivedBytes+=diagnosticBytes(args);updateNetworkDiagnosticWindow();});
 target.onAnyOutgoing?.((_event,...args)=>{netDiagSent++;netDiagSentBytes+=diagnosticBytes(args);updateNetworkDiagnosticWindow();});
}
let sessionToken=localStorage.getItem('abyssalSessionToken')||'',deferredInstallPrompt=null,maintenanceTimer=null,maintenanceVisible=false,maintenanceFailSafe=null,everConnected=false,activeRoomPassword='',reconnectTarget=null,reconnectPending=false,reconnectFallbackUsed=false,reconnectWatchdog=null,reconnectSessionRetry=null,reconnectSessionAttempts=0;
function showMaintenanceOverlay(message='Reconectando ao servidor automaticamente…'){maintenanceVisible=true;const status=$('maintenanceStatusText');if(status)status.textContent=message;const el=$('maintenanceOverlay');if(el)el.hidden=false;if(!maintenanceFailSafe)maintenanceFailSafe=setTimeout(()=>{maintenanceFailSafe=null;if(!maintenanceVisible)return;if(reconnectPending)failReconnect('A reconexão automática excedeu o tempo limite. O menu foi liberado para você tentar novamente.');else{hideMaintenanceOverlay();window.dispatchEvent(new CustomEvent('abyssal-reconnect-failed',{detail:{ok:false,message:'Servidor indisponível por tempo demais. Tente novamente pelo menu online.'}}));}},180000);}
function hideMaintenanceOverlay(){maintenanceVisible=false;if(maintenanceTimer){clearTimeout(maintenanceTimer);maintenanceTimer=null;}if(maintenanceFailSafe){clearTimeout(maintenanceFailSafe);maintenanceFailSafe=null;}const el=$('maintenanceOverlay');if(el)el.hidden=true;}
function scheduleMaintenanceOverlay(){if((!window.AbyssalGameHooks?.getPlayerPosition?.()&&!reconnectPending)||!everConnected||maintenanceVisible||maintenanceTimer)return;maintenanceTimer=setTimeout(()=>{maintenanceTimer=null;if(!connected)showMaintenanceOverlay();},1800);}
function rememberReconnectTarget(){const live=window.AbyssalGameHooks?.getPlayerPosition?.();if(!currentRoom||!live)return;reconnectTarget={id:String(currentRoom.id||'MAR-ABERTO').toUpperCase(),mode:currentRoom.mode==='pvp'?'pvp':'coop',password:activeRoomPassword};reconnectPending=true;reconnectFallbackUsed=false;}
function clearReconnectWatchdog(){if(reconnectWatchdog){clearTimeout(reconnectWatchdog);reconnectWatchdog=null;}if(reconnectSessionRetry){clearTimeout(reconnectSessionRetry);reconnectSessionRetry=null;}reconnectSessionAttempts=0;}
function failReconnect(message='A expedição não pôde ser retomada automaticamente.'){clearReconnectWatchdog();reconnectPending=false;reconnectTarget=null;reconnectFallbackUsed=false;hideMaintenanceOverlay();window.dispatchEvent(new CustomEvent('abyssal-reconnect-failed',{detail:{ok:false,message}}));}
function armReconnectWatchdog(){clearReconnectWatchdog();reconnectWatchdog=setTimeout(()=>{if(reconnectPending)failReconnect('O servidor voltou, mas a expedição não respondeu a tempo. Entre novamente pelo menu online.');},15000);}
function resumeSessionForReconnect(){if(!reconnectPending||!socket?.connected||!sessionToken)return false;if(reconnectSessionAttempts>=5)return false;reconnectSessionAttempts++;socket.emit('resume-session',{token:sessionToken,reconnect:true,attempt:reconnectSessionAttempts});if(reconnectSessionRetry)clearTimeout(reconnectSessionRetry);reconnectSessionRetry=setTimeout(()=>{reconnectSessionRetry=null;if(reconnectPending&&!authenticated&&socket?.connected)resumeSessionForReconnect();},1800);return true;}
function restoreRoomAfterReconnect(){if(!reconnectPending||!reconnectTarget||!socket?.connected)return false;if(!authenticated){if(!sessionToken){failReconnect('Servidor reconectado. Entre novamente para continuar a expedição.');return false;}armReconnectWatchdog();return false;}const target=reconnectTarget;setMessage('Sessão restaurada. Retomando a expedição…');armReconnectWatchdog();return joinRoom(target.id,target.password,{reconnect:true});}
function closeModalScreen(screenId){const screen=$(screenId);if(!screen)return false;screen.hidden=true;if(screenId==='supportScreen'){const menu=$('menuScreen');if(menu)menu.hidden=false;}if(screenId==='roomsScreen')window.dispatchEvent(new CustomEvent('abyssal-modal-closed',{detail:{screenId}}));return true;}
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-close-screen]');if(!button)return;const screenId=button.dataset.closeScreen;if(!screenId)return;event.preventDefault();closeModalScreen(screenId);});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;const message=$('downloadInstallMessage');if(message)message.textContent='Abyssal instalado com sucesso neste dispositivo.';});
 const PROFILE_TITLES=[
  {id:'abyss-drifter',name:'Mergulhador das Fossas',icon:'✧',rarity:'COMUM',color:'#79f3f0',description:'Seu primeiro vínculo com as profundezas.',goal:'Disponível desde o início.',kind:'starter'},
  {id:'sonar-novice',name:'Eco do Primeiro Sonar',icon:'◉',rarity:'COMUM',color:'#88dfe2',description:'O primeiro eco que retornou das profundezas.',goal:'Missão: derrote 15 monstros.',kind:'kills',required:15},
  {id:'abyss-spark',name:'Faísca das Fossas',icon:'◈',rarity:'INCOMUM',color:'#8cf8ff',description:'A luz que sobrevive onde o sol não chega.',goal:'Derrote 50 monstros.',kind:'kills',required:50},
  {id:'current-hunter',name:'Caçador de Correntes',icon:'〰',rarity:'RARO',color:'#b39cff',description:'Você aprendeu a caçar contra a correnteza.',goal:'Derrote 250 monstros.',kind:'kills',required:250},
  {id:'lantern-hunter',name:'Caçador de Fotóforos',icon:'✺',rarity:'ÉPICO',color:'#abf8e8',description:'Sua rota é iluminada apenas pelos fotóforos das presas.',goal:'Missão: derrote 500 monstros.',kind:'kills',required:500},
  {id:'hadal-executioner',name:'Carrasco Hadal',icon:'☠',rarity:'LENDÁRIO',color:'#ff86ca',description:'Seu rastro é reconhecido onde a luz não alcança.',goal:'Missão: derrote 2.500 monstros.',kind:'kills',required:2500},
  {id:'pelagic-executioner',name:'Carrasco Pelágico',icon:'✹',rarity:'ÉPICO',color:'#ff829b',description:'Até os predadores recuam ao sentir sua presença.',goal:'Derrote 1.000 monstros.',kind:'kills',required:1000},
  {id:'first-predator',name:'Primeira Presa Colossal',icon:'♆',rarity:'INCOMUM',color:'#ffe59e',description:'O primeiro gigante caiu diante da sua expedição.',goal:'Missão: derrote 3 bosses.',kind:'bosses',required:3},
  {id:'abyss-stalker',name:'Perseguidor de Leviatãs',icon:'◈',rarity:'LENDÁRIO',color:'#dbb7ff',description:'Você não perde o rastro dos predadores maiores.',goal:'Missão: derrote 25 bosses.',kind:'bosses',required:25},
  {id:'titan-bane',name:'Flagelo dos Titãs',icon:'♜',rarity:'MÍTICO',color:'#ffc37d',description:'Seu nome é registrado na queda de cem gigantes.',goal:'Missão: derrote 100 bosses.',kind:'bosses',required:100},
  {id:'leviathan-hunter',name:'Caçador de Leviatãs',icon:'♆',rarity:'ÉPICO',color:'#ffd27a',description:'Um troféu conquistado contra os gigantes do abismo.',goal:'Derrote 10 bosses.',kind:'bosses',required:10},
  {id:'sovereign-abyss',name:'Soberano do Insondável',icon:'♛',rarity:'LENDÁRIO',color:'#e0b7ff',description:'O próprio oceano parece reconhecer seu nome.',goal:'Derrote 50 bosses.',kind:'bosses',required:50},
  {id:'cycle-pioneer',name:'Pioneiro dos Sete Selos',icon:'✧',rarity:'RARO',color:'#a1ff9d',description:'Venceu sua primeira barra completa de sete bosses.',goal:'Missão: conclua a primeira barra de progressão e resgate 50.000 moedas.',kind:'firstProgressionClear',required:1},
  {id:'rift-cartographer',name:'Cartógrafo das Fossas',icon:'⌁',rarity:'RARO',color:'#83e3fb',description:'Registrou três passagens vencidas além da luz.',goal:'Missão: vença 3 bosses nas Fossas online.',kind:'riftBossesDefeated',required:3},
  {id:'hadal-navigator',name:'Navegador Hadal',icon:'⟁',rarity:'LENDÁRIO',color:'#9fcaff',description:'Sua bússola reconhece o caminho sem superfície.',goal:'Missão: vença 12 bosses nas Fossas online.',kind:'riftBossesDefeated',required:12},
  {id:'veteran-diver',name:'Veterano de Expedições',icon:'⟡',rarity:'RARO',color:'#e6d7ff',description:'Dez expedições encerradas, dez histórias preservadas.',goal:'Missão: finalize 10 mergulhos registrados.',kind:'runsCompleted',required:10},
  {id:'eternal-explorer',name:'Viajante Insondável',icon:'✦',rarity:'MÍTICO',color:'#ffb8df',description:'Cinquenta mergulhos e ainda há mistérios nas profundezas.',goal:'Missão: finalize 50 mergulhos registrados.',kind:'runsCompleted',required:50},
  {id:'shoal-founder',name:'Fundador do Cardume',icon:'≋',rarity:'RARO',color:'#73e7c3',description:'Você reuniu mergulhadores sob uma mesma bandeira.',goal:'Crie seu primeiro Cardume.',kind:'cardumesCreated',required:1},
  {id:'supporter-of-the-depths',name:'Apoio das Profundezas',icon:'♡',rarity:'RARO',color:'#ff9fca',description:'Você reconhece o valor dos outros mergulhadores.',goal:'Curta 25 perfis de jogadores.',kind:'likesGiven',required:25},
  {id:'abyssal-famous',name:'Nome Conhecido',icon:'✦',rarity:'ÉPICO',color:'#ffb0d9',description:'Sua presença já chamou a atenção da comunidade.',goal:'Receba 10 curtidas no seu perfil.',kind:'likesReceived',required:10},
  {id:'abyssal-icon',name:'Ícone do Abismo',icon:'✧',rarity:'ÉPICO',color:'#f2a8ff',description:'Seu nome ecoa entre os cardumes.',goal:'Receba 50 curtidas no seu perfil.',kind:'likesReceived',required:50},
  {id:'living-legend',name:'Lenda Viva',icon:'♛',rarity:'LENDÁRIO',color:'#ffe29b',description:'Poucos mergulhadores alcançam esse reconhecimento.',goal:'Receba 100 curtidas no seu perfil.',kind:'likesReceived',required:100},
  {id:'abyssal-patron',name:'Patrono do Abismo',icon:'✦',rarity:'MÍTICO',color:'#ffd27a',description:'Você apoiou o desenvolvimento das profundezas com uma compra confirmada na loja.',goal:'Realize uma compra com dinheiro real confirmada pelo servidor.',kind:'storeSupporter',required:1},
  {id:'boss-abyssal',name:'Boss Abyssal',icon:'♛',rarity:'EXCLUSIVO',color:'#ff6b9d',description:'Um título reservado a quem adquiriu o pacote Boss Abyssal.',goal:'Adquira o pacote Boss Abyssal com pagamento confirmado.',kind:'bossAbyssal',required:1},
   {id:'abyssal-conqueror',name:'Conquistador Abyssal',icon:'☬',rarity:'TRANSCENDENTAL',color:'#2ee88a',description:'Você desafiou e conquistou o abismo em seu limite supremo (+100% fortalecimento).',goal:'Complete todos os ciclos de progressão até o nível máximo de 100%.',kind:'conqueror',required:1}
 ];
 const TITLE_ARTWORK={
  'abyss-drifter':'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="32" r="24" opacity=".55"/><path d="M9 35c7-7 13 7 21 0s14 7 25 0M13 43c6-4 11 4 17 0s12 4 21 0"/><path d="m32 12 3.2 7 7.5.8-5.6 5 1.6 7.2-6.7-3.8-6.7 3.8 1.6-7.2-5.6-5 7.5-.8z" fill="currentColor" fill-opacity=".18"/></svg>',
  'abyss-spark':'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M32 5 38 24 57 32 38 38 32 59 25 39 7 32 25 25z" fill="currentColor" fill-opacity=".14"/><path d="m32 17 4.5 10.5L47 32l-10.5 4.5L32 47l-4.5-10.5L17 32l10.5-4.5z"/><circle cx="32" cy="32" r="3" fill="currentColor"/></svg>',
  'current-hunter':'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 18c8-7 14 7 22 0s14 7 26 0M8 29c8-7 14 7 22 0s14 7 26 0M8 40c8-7 14 7 22 0s14 7 26 0"/><path d="m42 8-9 33-10 14 14-9z" fill="currentColor" fill-opacity=".16"/></svg>',
  'pelagic-executioner':'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 18 22 8l10 7L43 8l11 10-3 24-19 13-19-13z" fill="currentColor" fill-opacity=".12"/><path d="M15 27 25 22l7 5 8-5 9 5-6 11-8-3-7 3z"/><path d="m22 38 4 8 5-5 4 5 6-8M32 15v7"/><circle cx="24" cy="28" r="2" fill="currentColor"/><circle cx="41" cy="28" r="2" fill="currentColor"/></svg>',
  'leviathan-hunter':'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="35" r="19" opacity=".55"/><path d="M32 7v44M21 15l11 10 11-10M20 25l-8 8 8 8M44 25l8 8-8 8"/><path d="M25 35c4-5 10-5 14 0-4 5-10 5-14 0z" fill="currentColor" fill-opacity=".18"/><circle cx="32" cy="35" r="3" fill="currentColor"/></svg>',
  'sovereign-abyss':'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="35" r="15" fill="currentColor" fill-opacity=".13"/><path d="M11 20 20 27 24 12 32 23 40 12 44 27 53 20 48 38M11 20l4 23 17 12 17-12 4-23"/><path d="M25 35c4-5 10-5 14 0-4 5-10 5-14 0z"/><circle cx="32" cy="35" r="3" fill="currentColor"/><path d="M8 49c5-2 7 2 11 0m26 0c4 2 6-2 11 0"/></svg>',
   'abyssal-conqueror':'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="32" r="22" stroke="#2ee88a" stroke-width="2" fill="#2ee88a" fill-opacity=".15"/><path d="M16 42 Q32 18 48 42 M20 30 Q32 10 44 30 M32 8 L32 56" stroke="#4efca0" stroke-width="2.6"/><circle cx="32" cy="20" r="4" fill="#2ee88a"/><circle cx="32" cy="44" r="3" fill="#ffd078"/></svg>'
 };
 function titleArtwork(id){return TITLE_ARTWORK[id]||TITLE_ARTWORK[id.includes('boss')||id.includes('titan')||id.includes('predator')?'leviathan-hunter':id.includes('rift')||id.includes('hadal')||id.includes('sonar')?'abyss-spark':'current-hunter'];}
 const profileNumber=n=>Math.max(0,Number(n)||0);
 function renderSpecimenProfile(user={}){
  const id=String(user.equippedSkin||'default'),map=user.specimenProficiency||{},points=window.AbyssalSpecimenSystem?.pointsFor?.(map,id)||0,stats=window.AbyssalSpecimenSystem?.stats?.(points)||{percent:0,cooldown:10,attributeBonus:0,rangeBonus:0,respawnSeconds:20};
  const specimen=window.AbyssalGameHooks?.skinForId?.(id),name=specimen?.name||id;
  const nameNode=$('profileSpecimenName'),pct=$('profileAdaptationPercent'),fill=$('profileAdaptationFill'),pointsNode=$('profileAdaptationPoints');
  if(nameNode)nameNode.textContent=name;
  if(pct)pct.textContent=Math.floor(stats.percent)+'%';
  if(fill)fill.style.width=Math.max(0,Math.min(100,stats.percent))+'%';
  if(pointsNode)pointsNode.textContent=points.toLocaleString('pt-BR')+' / 5000';
  const bar=fill?.parentElement;if(bar){bar.setAttribute('aria-valuenow',String(points));bar.setAttribute('aria-label','Adaptação de '+name);}
  if($('profileAdaptCooldown'))$('profileAdaptCooldown').textContent='RECARGA: '+stats.cooldown.toFixed(1).replace('.',',')+'s';
  if($('profileAdaptAttribute'))$('profileAdaptAttribute').textContent='ATRIBUTO: +'+(stats.attributeBonus*100).toFixed(1).replace('.',',')+'%';
  if($('profileAdaptRange'))$('profileAdaptRange').textContent='ALCANCE: +'+Math.round(stats.rangeBonus*100)+'%';
  if($('profileAdaptRespawn'))$('profileAdaptRespawn').textContent='RESSURGIMENTO: '+Math.floor(stats.respawnSeconds/60).toString().padStart(2,'0')+':'+Math.floor(stats.respawnSeconds%60).toString().padStart(2,'0');
  window.dispatchEvent(new CustomEvent('abyssal-profile-specimen-render',{detail:{canvas:$('profileSpecimenCanvas'),skinId:id}}));
 }
 let viewedPublicProfile=null;
 function renderProfile(data=serverAccount){
  if(data&&serverAccount&&data.nickname===serverAccount.nickname)serverAccount={...serverAccount,...(data.cardumeId?{cardumeId:data.cardumeId}:{})};
  const root=$('profileTitleGrid');if(!root)return;
  const user=data||{},stats=user.titleStats||{},kills=profileNumber(stats.monstersDefeated),bosses=profileNumber(stats.bossesDefeated);
  const appearance=user.diverGender==='female'?'female':user.diverGender==='male'?'male':(localStorage.getItem('abyssalDiverGender')==='female'?'female':'male');
  document.querySelectorAll('#profileDiverGender [data-diver-gender]').forEach(button=>{
   button.setAttribute('aria-pressed',String(button.dataset.diverGender===appearance));
   button.disabled=Boolean(user.isSelf===false);
  });
  const received=profileNumber(user.likesReceived),given=profileNumber(user.likesGiven),created=profileNumber(stats.cardumesCreated);
  const progressFor=t=>t.kind==='kills'?kills:t.kind==='bosses'?bosses:t.kind==='likesReceived'?received:t.kind==='likesGiven'?given:t.kind==='cardumesCreated'?created:(t.kind==='storeSupporter'||t.kind==='bossAbyssal'||t.kind==='conqueror')?(Array.isArray(user.unlockedTitles)&&user.unlockedTitles.includes(t.id)?1:0):profileNumber(stats[t.kind]);
  const equipped=user.equippedTitle||'abyss-drifter';
  const unlockedIds=new Set(Array.isArray(user.unlockedTitles)?user.unlockedTitles:PROFILE_TITLES.filter(t=>t.kind==='starter'||progressFor(t)>=t.required).map(t=>t.id));
  // Notificar títulos desbloqueados recém-detectados
  try {
    const knownUnlocked = JSON.parse(localStorage.getItem('abyssalKnownOnlineTitles') || '[]');
    let newlyUnlocked = 0;
    unlockedIds.forEach(tId => {
      if (!knownUnlocked.includes(tId) && tId !== 'abyss-drifter') {
        knownUnlocked.push(tId);
        newlyUnlocked++;
        const titleObj = PROFILE_TITLES.find(pt => pt.id === tId);
        const tName = titleObj ? titleObj.name : tId;
        const tGoal = titleObj?.goal ? (' Conquista: ' + titleObj.goal) : '';
        if (typeof window.addNotification === 'function') {
          window.addNotification('☬ Você desbloqueou o título "' + tName + '"!' + tGoal, 'NOVO TÍTULO DESBLOQUEADO ☬', 'title');
        }
      }
    });
    if (newlyUnlocked > 0) {
      localStorage.setItem('abyssalKnownOnlineTitles', JSON.stringify(knownUnlocked));
      if (typeof window.updateNotifBadge === 'function') window.updateNotifBadge();
    }
  } catch(e) {}
  const unlocked=PROFILE_TITLES.filter(t=>unlockedIds.has(t.id));
  const current=PROFILE_TITLES.find(t=>t.id===equipped)||PROFILE_TITLES[0];
  $('profileNickname').textContent=user.nickname||account?.nickname||'VISITANTE';
  $('profileEquippedLabel').textContent='Título equipado: '+current.name;
  $('profileEmblem').innerHTML=titleArtwork(current.id);$('profileEmblem').style.setProperty('--title-color',current.color);$('profileEmblem').style.color=current.color;
  $('profileAccountNote').textContent=window.AbyssalOnline?.isAuthenticated()?'Título e progresso salvos na sua conta.':(window.AbyssalOnline?.isConnected()?'Entre na sua conta para salvar seu título.':'Conexão interrompida; exibindo os últimos dados sincronizados.');
  $('profileKills').textContent=kills.toLocaleString('pt-BR');$('profileBosses').textContent=bosses.toLocaleString('pt-BR');
  $('profileTitleCount').textContent=unlocked.length;$('profileTitleProgress').textContent=unlocked.length+' de '+PROFILE_TITLES.length+' disponíveis';renderSpecimenProfile(user);
  root.innerHTML=PROFILE_TITLES.map(t=>{
   const progress=progressFor(t),owned=unlockedIds.has(t.id),isEquipped=equipped===t.id;
   const percent=t.kind==='starter'?100:Math.min(100,Math.floor(progress/t.required*100));
    const detail=t.kind==='starter'?t.goal:owned?'Conquista concluída':percent+'% · '+progress.toLocaleString('pt-BR')+'/'+t.required.toLocaleString('pt-BR');
   return '<article class="profile-title-card '+(owned?'':'is-locked')+' '+(isEquipped?'is-equipped':'')+'" style="--title-color:'+t.color+'"><div class="profile-title-icon" aria-hidden="true">'+titleArtwork(t.id)+'</div><div class="profile-title-copy"><h4 class="profile-title-name">'+escapeHtml(t.name)+'</h4><p class="profile-title-desc">'+escapeHtml(t.description)+'</p><div class="profile-title-meta"><span>'+t.rarity+'</span><span>·</span><span class="profile-title-state '+(owned?'':'locked')+'">'+(owned?'✓ DESBLOQUEADO':'⌑ BLOQUEADO')+'</span></div><p class="profile-title-desc" style="margin-top:7px">'+escapeHtml(owned?t.goal:detail)+'</p><div class="profile-title-progressbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'"><span style="width:'+percent+'%"></span></div><button class="profile-title-action" data-equip-title="'+t.id+'" '+(!owned||isEquipped||!window.AbyssalOnline?.isAuthenticated()?'disabled':'')+'>'+(isEquipped?'EQUIPADO':owned?'EQUIPAR TÍTULO':window.AbyssalOnline?.isAuthenticated()?'AINDA BLOQUEADO':'ENTRE PARA EQUIPAR')+'</button></div></article>';
  }).join('');
 }

 function showCardumeDirectory(){const d=$('cardumeDirectory'),detail=$('cardumeDetail');if(d)d.hidden=false;if(detail)detail.hidden=true;}
 function showCardumeDetail(data){const c=data?.cardume,roster=Array.isArray(data?.roster)?data.roster:[];if(!c){showCardumeDirectory();return;}const d=$('cardumeDirectory'),detail=$('cardumeDetail');if(d)d.hidden=true;if(detail)detail.hidden=false;$('cardumeDetailName').textContent=c.name;$('cardumeDetailDescription').textContent=c.description||'Um grupo de mergulhadores explorando as profundezas.';$('cardumeMemberCount').textContent=c.members+' / '+c.capacity;const root=$('cardumeMembers');if(!root)return;root.replaceChildren();if(!roster.length){const p=document.createElement('p');p.className='rooms-empty';p.textContent='Nenhum membro encontrado.';root.appendChild(p);return;}for(const m of roster){const row=document.createElement('article');row.className='cardume-member';const dot=document.createElement('span');dot.className='member-presence'+(m.online?' is-online':'');dot.title=m.online?'Online':'Offline';const copy=document.createElement('div');copy.className='cardume-member-copy';const name=document.createElement('strong');name.textContent=m.nickname+(m.leader?' · LÍDER':'');const meta=document.createElement('small');meta.textContent=(m.online?'ONLINE':'OFFLINE')+' · '+(PROFILE_TITLES.find(t=>t.id===m.equippedTitle)?.name||'Mergulhador das Fossas')+' · '+(m.likesReceived||0)+' curtidas';copy.append(name,meta);const btn=document.createElement('button');btn.type='button';btn.textContent='VER PERFIL';btn.addEventListener('click',()=>openPublicProfile(m.nickname));row.append(dot,copy,btn);root.appendChild(row);}}
 function openPublicProfile(nickname,reportContext=null){if(!socket?.connected)return;viewedPublicProfile=String(nickname||'');viewedProfileReportContext=reportContext;socket.emit('get-public-profile',{nickname:viewedPublicProfile});}
 function showPublicProfile(profile){if(!profile)return;viewedPublicProfile=profile.nickname;$('profileScreen').hidden=false;$('cardumesScreen').hidden=true;$('accountDeletePanel').hidden=true;$('publicProfileActions').hidden=Boolean(profile.isSelf);$('profileMessage').textContent=profile.isSelf?'Este é o seu perfil.':'Perfil público do mergulhador.';$('profileNickname').textContent=profile.nickname;const title=PROFILE_TITLES.find(t=>t.id===profile.equippedTitle)||PROFILE_TITLES[0];$('profileEquippedLabel').textContent='Título equipado: '+title.name;$('profileEmblem').innerHTML=titleArtwork(title.id);$('profileEmblem').style.setProperty('--title-color',title.color);$('profileEmblem').style.color=title.color;$('profileKills').textContent=profileNumber(profile.titleStats?.monstersDefeated).toLocaleString('pt-BR');$('profileBosses').textContent=profileNumber(profile.titleStats?.bossesDefeated).toLocaleString('pt-BR');$('profileTitleCount').textContent=(profile.unlockedTitles||[]).length;$('profileTitleProgress').textContent=(profile.unlockedTitles||[]).length+' de '+PROFILE_TITLES.length+' títulos';renderProfile(profile);$('profileAccountNote').textContent=profile.cardume?'Cardume: '+profile.cardume.name:'Ainda não faz parte de um Cardume.';$('profileLikesCount').textContent=profileNumber(profile.likesReceived)+' curtidas';const like=$('likeProfileBtn');like.textContent=profile.likedByMe?'♥ CURTIDO · REMOVER':'♡ CURTIR PERFIL';like.disabled=!authenticated||profile.isSelf||profile.blockedByMe||profile.hasBlockedMe;const block=$('blockProfileBtn');if(block){block.textContent=profile.blockedByMe?'⊘ DESBLOQUEAR':'⊘ BLOQUEAR';block.disabled=!authenticated||profile.isSelf;block.dataset.blocked=String(Boolean(profile.blockedByMe));}}
 function renderCardumesList(items){const root=$('cardumesList');if(!root)return;root.replaceChildren();if(!Array.isArray(items)||!items.length){const p=document.createElement('p');p.className='rooms-empty';p.textContent='Nenhum Cardume criado ainda. Seja o primeiro a fundar um.';root.appendChild(p);return;}for(const c of items){const card=document.createElement('article');card.className='cardume-card';const copy=document.createElement('div'),name=document.createElement('strong'),desc=document.createElement('p'),meta=document.createElement('small');name.textContent=c.name;desc.textContent=c.description||'Este Cardume ainda não adicionou uma descrição.';meta.textContent='LÍDER '+c.leader+' · '+c.members+'/'+c.capacity+' MERGULHADORES';copy.append(name,desc,meta);const btn=document.createElement('button');btn.type='button';btn.textContent='RECRUTAR-SE';btn.disabled=!authenticated||Boolean(serverAccount?.cardumeId)||c.members>=c.capacity;btn.addEventListener('click',()=>socket?.emit('join-cardume',{id:c.id}));const report=document.createElement('button');report.type='button';report.className='secondary-btn';report.textContent='⚑ DENUNCIAR';report.disabled=!authenticated;report.addEventListener('click',()=>openUgcReport('cardume',c.id,c.name));const actions=document.createElement('div');actions.className='cardume-card-actions';actions.append(btn,report);card.append(copy,actions);root.appendChild(card);}}
 function requestCardumes(){if(!socket?.connected){const msg=$('cardumeMessage');if(msg)msg.textContent='Conectando ao servidor…';connect();return;}socket.emit('list-cardumes');const msg=$('cardumeMessage');if(msg)msg.textContent=authenticated?'Explore a lista e entre em um Cardume.':'Entre na sua conta para criar ou entrar em um Cardume.';}
 function renderMatchHistory(matches=[]){
  const root=$('matchHistoryList');if(!root)return;root.replaceChildren();
  if(!matches.length){root.innerHTML='<div class="match-history-empty">Nenhuma partida online registrada ainda.</div>';return;}
  matches.slice(0,10).forEach((match,index)=>{
   const card=document.createElement('article');card.className='match-history-card';
   const when=new Date(match.playedAt);const players=Array.isArray(match.participants)?match.participants:[];
   card.innerHTML='<header class="match-history-head"><div><strong>PARTIDA '+(index+1)+'</strong><span>'+escapeHtml(match.roomName||match.roomId||'Sala')+'</span></div><time>'+(!Number.isNaN(when.getTime())?when.toLocaleString('pt-BR'):'')+'</time></header><div class="match-history-columns"><span>MERGULHADOR</span><span>BOSSES</span><span>DANO</span><span></span></div>';
   const body=document.createElement('div');body.className='match-history-players';
   players.forEach(player=>{const row=document.createElement('div');row.className='match-history-player';row.innerHTML='<strong>'+escapeHtml(player.nickname||'Mergulhador')+'</strong><span>'+Math.max(0,Number(player.bossesKilled)||0)+'</span><span>'+Math.max(0,Math.round(Number(player.damage)||0)).toLocaleString('pt-BR')+'</span>';const btn=document.createElement('button');btn.type='button';btn.className='match-profile-btn';btn.textContent='VER PERFIL';btn.addEventListener('click',()=>{ $('matchHistoryScreen').hidden=true;openPublicProfile(player.nickname,{matchId:match.id,context:{roomId:match.roomId,roomName:match.roomName,playedAt:match.playedAt,bossesKilled:player.bossesKilled,damage:player.damage}});});row.appendChild(btn);body.appendChild(row);});
   card.appendChild(body);root.appendChild(card);
  });
 }
 function openMatchHistory(){
  const screen=$('matchHistoryScreen');if(!screen)return;
  if(!authenticated||!serverAccount){openLogin();setMessage('Entre na sua conta para consultar o histórico de partidas.',true);return;}
  screen.hidden=false;const msg=$('matchHistoryMessage');if(msg)msg.textContent='Carregando partidas…';
  if(socket?.connected)socket.emit('get-match-history');else connect();
 }
 function openProfile(){
  const screen=$('profileScreen');if(!screen)return;
  if(viewedPublicProfile){viewedPublicProfile=null;$('accountDeletePanel').hidden=false;$('publicProfileActions').hidden=true;}
  if(!authenticated||!serverAccount){
   screen.hidden=true;
   openLogin();
   setMessage('Entre na sua conta para acessar seu perfil e carregar suas conquistas.',true);
   return;
  }
  screen.hidden=false;
  const deleteInput=$('deleteNicknameInput');if(deleteInput)deleteInput.value='';
  const deleteBtn=$('deleteAccountBtn');if(deleteBtn)deleteBtn.disabled=true;
  $('profileMessage').textContent='Sincronizando suas informações com o servidor…';
  renderProfile(serverAccount);
  refreshAccount();
 }
const SERVER_URL=window.ABYSSAL_SERVER_URL||window.location.origin;
fetch(SERVER_URL+'/api/runtime-config').then(response=>response.ok?response.json():null).then(config=>{
 if(!config?.previewMode)return;
 const notice=document.createElement('aside');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 notice.style.cssText='position:fixed;z-index:1000;top:8px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 24px);padding:9px 14px;border:1px solid #e5b75d;border-radius:6px;background:#201b11;color:#fff0c6;font:700 11px/1.5 system-ui;text-align:center;box-shadow:0 4px 24px #0009';
 notice.textContent=document.documentElement.lang==='en'?'TEST PREVIEW — no real payments; accounts and progress are temporary. Do not reuse passwords or enter personal information.':'PRÉVIA DE TESTE — sem pagamentos reais; contas e progresso são temporários. Não reutilize senhas nem informe dados pessoais.';
 document.body.prepend(notice);
}).catch(()=>{});
function setMessage(message,error=false){const el=$('loginMessage');if(el){el.textContent=message;el.style.color=error?'#ff91a5':'#9ef3de'}}
let socketClientLoading=null,pendingJoinAfterClient=false;
function loadSocketClient(){
 if(typeof window.io==='function')return Promise.resolve(true);
 if(navigator.onLine===false)return Promise.resolve(false);
 if(socketClientLoading)return socketClientLoading;
 socketClientLoading=new Promise(resolve=>{
  const script=document.createElement('script');
  script.src='https://cdn.socket.io/4.8.1/socket.io.min.js';
  script.async=true;script.crossOrigin='anonymous';
  script.onload=()=>resolve(typeof window.io==='function');
  script.onerror=()=>resolve(false);
  document.head.appendChild(script);
 }).then(ready=>{
  socketClientLoading=null;
  if(ready){
   connect();
   if(pendingJoinAfterClient){pendingJoinAfterClient=false;connectAndJoin();}
  }else pendingJoinAfterClient=false;
  return ready;
 });
 return socketClientLoading;
}
function updateAccount(){const status=$('accountStatus');const btn=$('loginBtn');let guest=localStorage.getItem('abyssalGuestNumber');if(!guest){guest=String(1000+Math.floor(Math.random()*9000));localStorage.setItem('abyssalGuestNumber',guest)}if(status)status.textContent=authenticated&&account?`CONECTADO COMO ${account.nickname.toUpperCase()}`:sessionToken&&account?.nickname?(connected?'RESTAURANDO CONTA':'RECONEXÃO PENDENTE'):`VISITANTE #${guest}`;if(btn)btn.textContent=authenticated?'CONTA CONECTADA':sessionToken&&account?.nickname?'RESTAURAR CONTA':'ENTRAR / CRIAR CONTA'}
function openLogin(){$('loginScreen').hidden=false;setMessage(account?`Último nickname: ${account.nickname}. Digite sua senha para entrar.`:'Crie uma conta ou entre com seu nickname e senha.');if(account)$('nicknameInput').value=account.nickname}
function connect(){
 if(socket){if(!socket.connected)socket.connect();return socket;}
 if(typeof window.io!=='function'){
  if(navigator.onLine===false)setMessage('Sem internet: solo e Fossas Abissais estão disponíveis offline.',true);
  else{setMessage('Preparando a conexão online…');loadSocketClient();}
  return null;
 }
 socket=window.io(SERVER_URL,{transports:['websocket','polling'],reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:700,reconnectionDelayMax:3500,randomizationFactor:.35,timeout:8000});
 attachNetworkDiagnostics(socket);
 socket.on('ugc-report-result',result=>{const status=$('ugcReportStatus');if(status)status.textContent=result?.message||'Não foi possível enviar a denúncia.';const btn=$('ugcReportSendBtn');if(btn)btn.disabled=false;if(result?.ok)setTimeout(closeUgcReport,2200)});
 startPositionHeartbeat();
 socket.on('connect',()=>{connected=true;everConnected=true;hideMaintenanceOverlay();if(reconnectPending&&reconnectTarget&&sessionToken)showMaintenanceOverlay('Servidor encontrado. Restaurando sessão e expedição…');else if(reconnectPending&&reconnectTarget&&!sessionToken)failReconnect('Servidor reconectado. Entre novamente para continuar a expedição.');localPlayerId=socket.id;positionSequence=0;latestPositionPayload=null;positionPacketInFlight=false;pendingMotion.clear();lastReconcileSeq=0;motionRttMs=null;motionJitterMs=null;motionAckCount=0;if(sessionToken&&!authenticated){setMessage('Reconectando sua sessão segura…');if(reconnectPending&&reconnectTarget){armReconnectWatchdog();resumeSessionForReconnect();}else socket.emit('resume-session',{token:sessionToken});}else if(account?.nickname&&!authenticated){setMessage(`Conectado. Entre novamente como ${account.nickname} para validar esta sessão.`);}else setMessage(authenticated?`Servidor conectado como ${account?.nickname||'mergulhador'}.`:'Servidor conectado. Entre ou crie uma conta para jogar online.');socket.emit('list-rooms');refreshRoomsHttp();if($('roomsScreen')&&!$('roomsScreen').hidden)startRoomPolling();});
 socket.on('online-count',n=>{const el=$('onlineCount');if(el)el.textContent=String(n)});
  socket.on('match-history-result',result=>{const msg=$('matchHistoryMessage');if(!result?.ok){if(msg)msg.textContent='Não foi possível carregar o histórico.';return;}renderMatchHistory(result.matches||[]);if(msg)msg.textContent=(result.matches||[]).length+' partida(s) armazenada(s), máximo de 10.';});socket.on('cardumes-list',renderCardumesList);socket.on('cardume-details',showCardumeDetail);socket.on('public-profile-result',result=>{if(result?.ok)showPublicProfile(result.profile);else{const msg=$('cardumeMessage');if(msg)msg.textContent=result?.message||'Perfil indisponível.'}});socket.on('user-block-result',result=>{if(result?.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}));}if(result?.profile)showPublicProfile(result.profile);else if(result?.message){const msg=$('profileMessage');if(msg)msg.textContent=result.message;}});socket.on('profile-like-result',result=>{if(result?.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}));}if(result?.profile)showPublicProfile(result.profile);else if(result?.message){const msg=$('profileMessage');if(msg)msg.textContent=result.message;}});socket.on('profile-likes-updated',data=>{if(serverAccount&&String($('profileNickname')?.textContent||'').toLowerCase()===String(serverAccount.nickname||'').toLowerCase()){$('profileLikesCount').textContent=profileNumber(data?.likesReceived)+' curtidas';if(serverAccount)serverAccount.likesReceived=profileNumber(data?.likesReceived);}});socket.on('cardume-action-result',result=>{const msg=$('cardumeMessage');if(msg)msg.textContent=result?.message||'Operação concluída.';if(result?.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}));}if(result?.ok){socket.emit('list-cardumes');if(result.account?.cardumeId)socket.emit('get-cardume-details');else showCardumeDirectory();}});
 socket.on('rooms-list',list=>{socketRoomsCache=Array.isArray(list)?list:[];socketRoomsAt=Date.now();publishMergedRooms()});
 socket.on('boss-warning',data=>window.dispatchEvent(new CustomEvent('abyssal-boss-warning',{detail:data||{}})));
 socket.on('room-created',result=>{window.dispatchEvent(new CustomEvent('abyssal-room-created',{detail:result||{ok:false,message:'Falha ao criar a sala.'}}));if(result?.ok){const pw=pendingRoomPassword;pendingRoomPassword='';joinRoom(result.room?.id,pw)}});
 socket.on('room-join-result',result=>{if(!result||result.ok)return;if(reconnectPending&&reconnectTarget&&!reconnectFallbackUsed){reconnectFallbackUsed=true;const fallback=reconnectTarget.mode==='pvp'?'MAR-VERMELHO':'MAR-ABERTO';reconnectTarget={...reconnectTarget,id:fallback,password:''};setMessage('A sala anterior foi reiniciada no deploy. Retomando na arena padrão…');joinRoom(fallback,'',{reconnect:true});return;}failReconnect(result?.message||'A expedição não pôde ser retomada automaticamente.');window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:result}));});
 function handleRoomJoined(data){if(!data?.ok)return false;const roomId=String(data.room?.id||'').toUpperCase();if(!reconnectPending&&currentRoom&&String(currentRoom.id||'').toUpperCase()===roomId&&localPlayerId===socket?.id&&document.body.classList.contains('game-active'))return true;clearReconnectWatchdog();const wasReconnect=Boolean(reconnectPending&&reconnectTarget&&roomId===String(reconnectTarget.id||'').toUpperCase());currentRoom=data.room||null;if(wasReconnect){activeRoomPassword=reconnectTarget.password||'';showMaintenanceOverlay('Expedição restaurada. Sincronizando o mundo…');}reconnectPending=false;reconnectTarget=null;reconnectFallbackUsed=false;localPlayerId=socket.id;latestPositionPayload=null;positionPacketInFlight=false;stopRoomPolling();const roomsScreen=$('roomsScreen');if(roomsScreen)roomsScreen.hidden=true;try{applyPlayerList(data.players||[])}catch(error){console.error('[online] Falha ao preparar lista de jogadores:',error)}const entryDetail={...data,reconnected:wasReconnect};window.dispatchEvent(new CustomEvent('abyssal-room-joined',{detail:entryDetail}));queueMicrotask(()=>{if(!document.body.classList.contains('game-active'))window.dispatchEvent(new CustomEvent('abyssal-room-entry-retry',{detail:entryDetail}));});hideMaintenanceOverlay();setTimeout(()=>hideMaintenanceOverlay(),120);// The room-joined packet already carries the complete world state.
 // Avoid requesting a second full world snapshot immediately on every join.
 return true;}
 socket.on('room-joined',handleRoomJoined);
 socket.on('world-left',()=>{currentRoom=null;latestPositionPayload=null;positionPacketInFlight=false;players.clear();playersByNetId.clear();window.dispatchEvent(new CustomEvent('abyssal-room-left'))});
 socket.on('legacy-join-world',data=>joinRoom(data?.roomId||'MAR-ABERTO',''));
 socket.on('rift-chest-ready',data=>window.dispatchEvent(new CustomEvent('abyssal-rift-chest',{detail:data})));
 socket.on('first-progression-reward',data=>window.dispatchEvent(new CustomEvent('abyssal-first-progression-reward',{detail:data||{}})));
 socket.on('abyssal-final-victory',data=>window.dispatchEvent(new CustomEvent('abyssal-final-victory',{detail:data||{}})));
 socket.on('specimen-discovered',data=>window.dispatchEvent(new CustomEvent('abyssal-specimen-discovery-confirmed',{detail:data||{}})));
 socket.on('account-data',data=>{
  if(!authenticated||!data)return;
  serverAccount=data;
  if($('profileMessage')&&!$('profileScreen').hidden)$('profileMessage').textContent='Perfil sincronizado com sua conta.';
  window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:data}));
 });
 socket.on('title-progress',data=>{
  if(!authenticated||!serverAccount||!data)return;
  serverAccount={...serverAccount,titleStats:{...(serverAccount.titleStats||{}),...(data.titleStats||{})},unlockedTitles:Array.isArray(data.unlockedTitles)?data.unlockedTitles:serverAccount.unlockedTitles};
  if($('profileScreen')&&!$('profileScreen').hidden)renderProfile(serverAccount);
 });
 socket.on('purchase-result',result=>{if(result.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}))}window.dispatchEvent(new CustomEvent('abyssal-purchase-result',{detail:result}));});
socket.on('code-redeem-result',result=>{if(result.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}));}window.dispatchEvent(new CustomEvent('abyssal-code-redeem-result',{detail:result}));});
 socket.on('wheel-result',result=>{if(result.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}))}window.dispatchEvent(new CustomEvent('abyssal-wheel-result',{detail:result}));});
 socket.on('exploration-resource-collected',data=>window.dispatchEvent(new CustomEvent('abyssal-resource-collected',{detail:data||{}})));
 socket.on('world-depth-state',data=>{window.dispatchEvent(new CustomEvent('abyssal-depth-state',{detail:data||{}}));});
 socket.on('world-cave-signal',data=>{window.dispatchEvent(new CustomEvent('abyssal-cave-signal',{detail:data||{}}));});
 socket.on('world-enemy-damaged',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-damaged',{detail:data||{}}));});
 socket.on('world-enemies-damaged',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-damaged-batch',{detail:Array.isArray(data)?data:[]}));});
 // Server-owned HP/shields are sent reliably. Bridge them to the game UI; without this
 // listener a minimized client could be killed server-side but still look alive on resume.
 socket.on('player-vitals',data=>{window.dispatchEvent(new CustomEvent('abyssal-player-vitals',{detail:data||{}}));});
 socket.on('player-damage-number',data=>window.dispatchEvent(new CustomEvent('abyssal-player-damage-number',{detail:data||{}})));
 socket.on('rift-checkpoint-respawn',data=>window.dispatchEvent(new CustomEvent('abyssal-rift-checkpoint-respawn',{detail:data||{}})));
 socket.on('pvp-hit',data=>{window.dispatchEvent(new CustomEvent('abyssal-pvp-hit',{detail:data||{}}));});
 socket.on('hit-synergy-visual',data=>{window.dispatchEvent(new CustomEvent('abyssal-hit-synergy-visual',{detail:data||{}}));});
 socket.on('player-suction-pull',data=>{window.dispatchEvent(new CustomEvent('abyssal-player-suction-pull',{detail:data||{}}));});
 socket.on('boss-ability-visual',data=>{window.dispatchEvent(new CustomEvent('abyssal-boss-ability-visual',{detail:data||{}}));});
 socket.on('specimen-state',data=>{window.dispatchEvent(new CustomEvent('abyssal-specimen-state',{detail:data||{}}));});
 socket.on('specimen-proficiency',data=>{
  if(serverAccount&&data?.skinId){serverAccount.specimenProficiency={...(serverAccount.specimenProficiency||{}),[String(data.skinId)]:Math.max(0,Number(data.points)||0)};window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:serverAccount}));}
  window.dispatchEvent(new CustomEvent('abyssal-specimen-proficiency',{detail:data||{}}));
 });
 socket.on('world-enemy-defeated',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-defeated',{detail:data}));});
 socket.on('world-enemies-defeated',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-defeated-batch',{detail:Array.isArray(data)?data:[]}));});
 socket.on('world-rift-tentacle-aim',data=>{window.dispatchEvent(new CustomEvent('abyssal-rift-tentacle-aim',{detail:data||{}}));});
 socket.on('run-saved',result=>{if(result.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}))}window.dispatchEvent(new CustomEvent('abyssal-run-saved',{detail:result}))});
 socket.on('rankings-data',renderRankings);socket.on('rankings-updated',renderRankings);
 socket.on('server-maintenance',data=>{rememberReconnectTarget();if(reconnectPending)showMaintenanceOverlay(data?.message||'Atualização detectada. Reconectando automaticamente…');setMessage('Servidor entrando em manutenção. Sua expedição será restaurada automaticamente…',true);});
 socket.on('connect_error',()=>{connected=false;if(reconnectPending||window.AbyssalGameHooks?.getPlayerPosition?.())showMaintenanceOverlay('Servidor temporariamente indisponível. Tentando reconectar…');else hideMaintenanceOverlay();setMessage('Servidor temporariamente indisponível. Solo disponível offline.',true)});
 socket.on('disconnect',(reason)=>{rememberReconnectTarget();connected=false;if(reconnectPending||window.AbyssalGameHooks?.getPlayerPosition?.())showMaintenanceOverlay('Conexão interrompida. Reconectando ao servidor…');else hideMaintenanceOverlay();authenticated=false;players.clear();latestPositionPayload=null;positionSequence=0;positionPacketInFlight=false;hostId=null;stopRoomPolling();updateAccount();if(serverAccount)renderProfile(serverAccount);setMessage(sessionToken?'Conexão interrompida. Sua expedição será retomada automaticamente…':'Conexão perdida. Entre novamente para validar a conta.',true);window.dispatchEvent(new CustomEvent('abyssal-online-disconnected',{detail:{reason,reconnectPending}}));if(reason==='io server disconnect')setTimeout(()=>{if(socket&&!socket.connected)socket.connect();},700);});
 socket.on('auth-result',result=>{
  if(!result.ok){authenticated=false;account=null;serverAccount=null;sessionToken='';localStorage.removeItem('abyssalSessionToken');localStorage.removeItem('abyssalAccount');$('profileScreen').hidden=true;updateAccount();renderProfile({});if(reconnectPending)failReconnect('Servidor reconectado, mas sua sessão precisa ser validada novamente.');else hideMaintenanceOverlay();setMessage(result.message||'Falha na autenticação.',true);return}
  authenticated=true;account={nickname:result.nickname};serverAccount=result;
  if(result.sessionToken){sessionToken=result.sessionToken;localStorage.setItem('abyssalSessionToken',sessionToken);}
  localStorage.setItem('abyssalAccount',JSON.stringify(account));$('passwordInput').value='';
  updateAccount();renderProfile(result);
  window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result}));
  setMessage(`Bem-vindo, ${result.nickname}!`);$('loginScreen').hidden=true;openAgeTermsIfNeeded();
  socket.emit('get-account');socket.emit('list-cardumes');const restoring=restoreRoomAfterReconnect();window.dispatchEvent(new CustomEvent('abyssal-authenticated',{detail:{restoringRoom:Boolean(restoring)}}));
 });
 socket.on('session-resumed',result=>{
  if(reconnectSessionRetry){clearTimeout(reconnectSessionRetry);reconnectSessionRetry=null;}
  if(!result?.ok){authenticated=false;serverAccount=null;const explicitlyExpired=/expir|inválid|invalid/i.test(String(result?.message||''));if(explicitlyExpired){sessionToken='';localStorage.removeItem('abyssalSessionToken');}$('profileScreen').hidden=true;updateAccount();renderProfile({});if(account?.nickname)setMessage(explicitlyExpired?'Sua sessão expirou. Entre novamente para acessar o perfil.':'Não foi possível validar sua sessão agora. Tentaremos novamente na próxima conexão.',true);if(reconnectPending)failReconnect(explicitlyExpired?'Sua sessão expirou durante a atualização. Entre novamente para continuar.':'O servidor voltou, mas não conseguiu validar a sessão nesta tentativa.');else hideMaintenanceOverlay();return;}
  authenticated=true;account={nickname:result.nickname};serverAccount=result;
  localStorage.setItem('abyssalAccount',JSON.stringify(account));updateAccount();renderProfile(result);
  setMessage(`Sessão restaurada: ${result.nickname}.`);refreshKidGate();
  socket.emit('get-account');const restoring=restoreRoomAfterReconnect();window.dispatchEvent(new CustomEvent('abyssal-authenticated',{detail:{restoringRoom:Boolean(restoring)}}));
 });
 socket.on('world-host',()=>{}); // Compatibilidade com clientes antigos: nenhum jogador é eleito host.

 socket.on('game-snapshot',data=>{if(window.AbyssalGameHooks?.applySnapshot)window.AbyssalGameHooks.applySnapshot(data);});
 socket.on('map-transition-result',data=>{
  if(data?.ok){
   // Old pending transforms refer to the previous depth layout. Do not
   // reconcile them into the new chamber or resend them after teleportation.
   pendingMotion.clear();
   latestPositionPayload=null;
   positionPacketInFlight=false;
   lastPositionAt=0;
  }
  window.dispatchEvent(new CustomEvent('abyssal-map-transition',{detail:data||{}}));
 });
 socket.on('player-reconcile',data=>{
  data=window.AbyssalNetCodec?.readReconcile?.(data)||data;
  if(!Array.isArray(data)||data.length<4)return;const seq=Number(data[0])||0;if(seq<=lastReconcileSeq)return;lastReconcileSeq=seq;positionAckAt=Date.now();
  const predicted=pendingMotion.get(seq),authoritativeX=Number(data[1]),authoritativeY=Number(data[2]);
  if(predicted?.sentAt!=null){const sample=Math.max(0,performance.now()-predicted.sentAt);motionJitterMs=motionRttMs==null?0:motionJitterMs*.8+Math.abs(sample-motionRttMs)*.2;motionRttMs=motionRttMs==null?sample:motionRttMs*.8+sample*.2;motionAckCount++;}
  for(const key of pendingMotion.keys())if(key<=seq)pendingMotion.delete(key);
  if(predicted&&Number.isFinite(authoritativeX)&&Number.isFinite(authoritativeY)){
   const dx=authoritativeX-predicted.x,dy=authoritativeY-predicted.y;
   if(Math.hypot(dx,dy)>.75)window.AbyssalGameHooks?.reconcilePlayer?.({seq,dx,dy,blocked:Boolean(data[3])});
  }
 });
 socket.on('world-enemies-spawned',data=>{if(window.AbyssalGameHooks?.applySpawn)window.AbyssalGameHooks.applySpawn(data);});
 socket.on('enemy-contact-source',data=>{if(window.AbyssalGameHooks?.registerContactSnapshot)window.AbyssalGameHooks.registerContactSnapshot(data);});
 socket.on('enemy-motion',data=>{if(window.AbyssalGameHooks?.applyMotion)window.AbyssalGameHooks.applyMotion(data);});
 socket.on('shared-damage',data=>{if(window.AbyssalGameHooks?.sharedDamage)window.AbyssalGameHooks.sharedDamage(data);});
 socket.on('shared-xp-award',data=>{if(window.AbyssalGameHooks?.sharedXp)window.AbyssalGameHooks.sharedXp(data);});
  socket.on('world-orb-spawned',data=>window.dispatchEvent(new CustomEvent('abyssal-orb-spawn',{detail:data})));
  socket.on('world-orb-collected',data=>window.dispatchEvent(new CustomEvent('abyssal-orb-collect',{detail:data})));
 socket.on('world-players',list=>applyPlayerList(list));
 socket.on('player-motion',rows=>applyPlayerMotion(window.AbyssalNetCodec?.readPlayerMotion?.(rows)||rows));
 socket.on('run-energy-ranking',ranking=>window.dispatchEvent(new CustomEvent('abyssal-run-energy-ranking',{detail:Array.isArray(ranking)?ranking:[]})));
 socket.on('revive-result',result=>window.dispatchEvent(new CustomEvent('abyssal-revive-result',{detail:result||{ok:false,message:'Não foi possível ressuscitar agora.'}})));
 socket.on('player-joined',p=>{if(p.id!==socket.id){storePlayer(p);window.dispatchEvent(new CustomEvent('abyssal-gameplay-notice',{detail:{kind:'join',title:String(p.nickname||'Mergulhador').toUpperCase(),text:`${p.nickname||'Um mergulhador'} entrou nas profundezas.`}}));}});
 socket.on('player-left',id=>{const peer=players.get(id);if(peer?.netId)playersByNetId.delete(Number(peer.netId)>>>0);players.delete(id);});
 socket.on('gameplay-notice',data=>window.dispatchEvent(new CustomEvent('abyssal-gameplay-notice',{detail:data||{}})));
 socket.on('remote-hit',data=>{if(window.AbyssalGameHooks?.remoteHit)window.AbyssalGameHooks.remoteHit(data)});
 socket.on('shared-shot',data=>{if(data&&data.fromId!==socket?.id)window.dispatchEvent(new CustomEvent('abyssal-remote-shot',{detail:data}))});
 socket.on('photon-ray-stop',data=>{if(data?.fromId&&data.fromId!==socket?.id)window.dispatchEvent(new CustomEvent('abyssal-remote-photon-stop',{detail:data}))});
 socket.on('peer-skin-ability',data=>{if(data&&typeof data==='object'){data.receivedAt=Date.now();}window.dispatchEvent(new CustomEvent('abyssal-peer-skin-ability',{detail:data||{}}));});
  socket.on('skin-shield-bubble',data=>{window.dispatchEvent(new CustomEvent('abyssal-skin-shield-bubble',{detail:data||{}}));});
  socket.on('skin-trail-node',data=>{if(data)window.dispatchEvent(new CustomEvent('abyssal-skin-trail-node',{detail:data}));});
socket.on('skin-shot-telegraph',data=>window.dispatchEvent(new CustomEvent('abyssal-skin-shot-telegraph',{detail:data||{}})));
socket.on('player-skin-status',data=>window.dispatchEvent(new CustomEvent('abyssal-player-skin-status',{detail:data||{}})));
 socket.on('specimen-dash',data=>window.dispatchEvent(new CustomEvent('abyssal-specimen-dash',{detail:data||{}})));
 socket.on('skin-weapon-impact',data=>window.dispatchEvent(new CustomEvent('abyssal-skin-weapon-impact',{detail:data||{}})));
 socket.on('server-message',m=>{if(window.AbyssalGameHooks?.toast)window.AbyssalGameHooks.toast(m)});
 socket.on('account-deletion-result',result=>{
  const message=result?.message||'Não foi possível excluir a conta.';
  if(!result?.ok){const el=$('profileMessage');if(el)el.textContent=message;return}
  authenticated=false;account=null;serverAccount=null;sessionToken='';localStorage.removeItem('abyssalSessionToken');localStorage.removeItem('abyssalAccount');
  $('profileScreen').hidden=true;$('loginScreen').hidden=true;$('downloadScreen').hidden=true;
  updateAccount();renderProfile({});
  const toast=$('toast');if(toast){toast.textContent='Conta excluída permanentemente.';toast.hidden=false;setTimeout(()=>{toast.hidden=true},4500)}
 });
 socket.on('account-force-logout',()=>{
  authenticated=false;account=null;serverAccount=null;sessionToken='';localStorage.removeItem('abyssalSessionToken');localStorage.removeItem('abyssalAccount');
  $('profileScreen').hidden=true;updateAccount();renderProfile({});
 });
 return socket;
}
function authenticate(nickname,password,mode='login'){
 const s=connect();if(!s){setMessage('Servidor online indisponível.',true);return}
 nickname=(nickname||'').trim();password=password||'';
 if(!/^[a-zA-Z0-9_]{3,18}$/.test(nickname)){setMessage('Nickname: 3–18 caracteres, letras, números ou _.',true);return}
 if(password.length<8){setMessage('A senha precisa ter pelo menos 8 caracteres.',true);return}
 const email=String($('emailInput')?.value||'').trim().toLowerCase();
 if(mode==='register'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)){setMessage('Informe um email válido para recuperar sua senha.',true);return}
 setMessage(mode==='register'?'Criando conta…':'Verificando acesso…');
 const send=()=>s.emit('authenticate',{nickname,password,mode,email});
 if(s.connected)send();else {s.once('connect',send);setTimeout(()=>{if(!s.connected)setMessage('O servidor não respondeu. Execute npm start na pasta do projeto.',true)},9000)}
}
function publishMergedRooms(){
 // Keep the most recently received full roster. Both endpoints return the complete list,
 // including private rooms (metadata only; never passwords or password hashes).
 let list=[];
 const useHttp=Array.isArray(httpRoomsCache)&&httpRoomsAt>socketRoomsAt;
 if(useHttp)list=httpRoomsCache;
 else if(Array.isArray(socketRoomsCache))list=socketRoomsCache;
 else if(Array.isArray(httpRoomsCache))list=httpRoomsCache;
 const clean=new Map();
 for(const room of (Array.isArray(list)?list:[])){
  if(!room||!room.id)continue;
  const id=String(room.id).toUpperCase();
  clean.set(id,{...room,id,code:room.code||id,isPrivate:Boolean(room.isPrivate),playerCount:Math.max(0,Number(room.playerCount)||0),capacity:Math.max(1,Number(room.capacity)||6)});
 }
 if(!clean.has('MAR-ABERTO'))clean.set('MAR-ABERTO',{id:'MAR-ABERTO',code:'MAR-ABERTO',name:'Mar Aberto',mode:'open-sea',playerCount:0,capacity:6,isPrivate:false,available:true,fallback:true,joinable:true});
 if(!clean.has('MAR-VERMELHO'))clean.set('MAR-VERMELHO',{id:'MAR-VERMELHO',code:'MAR-VERMELHO',name:'Mar Vermelho',mode:'pvp',playerCount:0,capacity:6,isPrivate:false,available:true,fallback:true,joinable:true});
 if(!clean.has('MAR-ABYSSAL'))clean.set('MAR-ABYSSAL',{id:'MAR-ABYSSAL',code:'MAR-ABYSSAL',name:'Mar Abyssal - Fossas Cooperativo',mode:'rift',playerCount:0,capacity:6,isPrivate:false,available:true,fallback:true,joinable:true});
 list=[...clean.values()].sort((a,b)=>{const priority=id=>id==='MAR-ABERTO'?0:id==='MAR-VERMELHO'?1:id==='MAR-ABYSSAL'?2:3;const pa=priority(a.id),pb=priority(b.id);if(pa!==pb)return pa-pb;return (Number(b.playerCount)||0)-(Number(a.playerCount)||0);});
 window.dispatchEvent(new CustomEvent('abyssal-rooms-list',{detail:list}));
}
function refreshRoomsHttp(){
 const requestedAt=Date.now();
 fetch(SERVER_URL+`/api/rooms?_=${requestedAt}`,{cache:'no-store',headers:{'Cache-Control':'no-cache'}})
  .then(r=>r.ok?r.json():null)
  .then(data=>{if(!data||!Array.isArray(data.rooms))return;const completedAt=Date.now();if(completedAt<socketRoomsAt)return;httpRoomsCache=data.rooms;httpRoomsAt=completedAt;publishMergedRooms()})
  .catch(()=>{});
}
function startRoomPolling(){stopRoomPolling();roomPollTimer=setInterval(()=>{const screen=$('roomsScreen');if(!screen||screen.hidden){stopRoomPolling();return;}if(socket?.connected)socket.emit('list-rooms');refreshRoomsHttp()},3500)}
function stopRoomPolling(){if(roomPollTimer){clearInterval(roomPollTimer);roomPollTimer=null}}
function showRooms(){
 const s=connect();if(!s)return;
 const screen=$('roomsScreen');if(screen)screen.hidden=false;
 const mode=$('roomModeInput');if(mode)mode.value=window.AbyssalPreferredRoomMode==='rift'?'rift':'open-sea';
 const message=$('roomsMessage');if(message)message.textContent='Sondando expedições ativas…';
 refreshRoomsHttp();
 const request=()=>{s.emit('list-rooms');refreshRoomsHttp();startRoomPolling()};if(s.connected)request();else s.once('connect',request);
}
function requestRooms(){if(socket?.connected)socket.emit('list-rooms');refreshRoomsHttp();}
function connectAndJoin(){
 const s=connect();if(!s){if(navigator.onLine!==false){pendingJoinAfterClient=true;setMessage('Carregando o cliente online…');}else setMessage('Sem internet: entre em MERGULHAR para jogar solo.',true);return;}
 if(authenticated){window.AbyssalOnlinePendingStart=false;showRooms();return;}
 window.AbyssalOnlinePendingStart=true;
 if(sessionToken){
  setMessage('Restaurando sua sessão segura…');
  if(s.connected)s.emit('resume-session',{token:sessionToken});
  return;
 }
 openLogin();
}
function joinWorld(roomId='MAR-ABERTO',password=''){return joinRoom(roomId,password)}
function joinRoom(roomId='MAR-ABERTO',password='',options={}){
 if(!socket?.connected||!authenticated){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'Conecte-se à sua conta antes de entrar em uma sala.'}}));return false;}
 const id=String(roomId||'MAR-ABERTO').trim().toUpperCase();if(!id){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'Informe o código da sala.'}}));return false;}
 if(!options.reconnect)activeRoomPassword=String(password||'');
 socket.emit('join-room',{roomId:id,password:String(password||''),reconnect:Boolean(options.reconnect),viewportWidth:window.AbyssalGameHooks?.viewportWidth?.()||window.innerWidth||1200,viewportHeight:window.AbyssalGameHooks?.viewportHeight?.()||window.innerHeight||700,worldWidth:window.AbyssalGameHooks?.worldWidth?.()||window.innerWidth||1200,worldHeight:window.AbyssalGameHooks?.worldHeight?.()||window.innerHeight||700,worldZoom:window.AbyssalGameHooks?.worldZoom?.()||1},result=>{if(result?.ok&&result.room&&result.snapshot)handleRoomJoined(result);});return true;
}
function createRoom(data={}){
 if(!socket?.connected||!authenticated){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'Entre na sua conta antes de criar uma sala.'}}));return false;}
 const isPrivate=Boolean(data.isPrivate),password=String(data.password||'');if(isPrivate&&(password.length<4||password.length>64)){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'A senha da sala privada deve ter entre 4 e 64 caracteres.'}}));return false;}
 pendingRoomPassword=isPrivate?password:'';socket.emit('create-room',{name:String(data.name||'Expedição Abissal'),capacity:Number(data.capacity)||6,isPrivate,password,mode:['pvp','rift','open-sea'].includes(data.mode)?data.mode:'coop'});return true;
}
function leaveWorld(){if(socket?.connected&&authenticated)socket.emit('leave-world');players.clear();hostId=null;currentRoom=null;stopRoomPolling();}
function requestHostTransfer(){if(socket?.connected&&authenticated&&hostId===socket.id)socket.emit('request-host-transfer');}
$('loginSubmitBtn').addEventListener('click',()=>authenticate($('nicknameInput').value,$('passwordInput').value,'login'));
$('registerBtn').addEventListener('click',()=>authenticate($('nicknameInput').value,$('passwordInput').value,'register'));
function setAuthFlowMessage(id,message,isError=false){const el=$(id);if(!el)return;el.textContent=message;el.classList.toggle('is-error',Boolean(isError));}
function closePasswordRecovery(){ $('passwordRecoveryScreen').hidden=true; $('recoveryMessage').textContent=''; }
const AGE_TERMS_VERSION='2026-11-03-v2';
function ageProfile(){
 try{return JSON.parse(localStorage.getItem('abyssalAgeProfile')||'null')}catch(_){return null}
}
function hasAgeTermsProfile(){const p=ageProfile();return Boolean(p&&p.termsVersion===AGE_TERMS_VERSION&&['under16','teen','adult'].includes(p.band));}
function calculateAge(year,month,day){
 const now=new Date(),birth=new Date(year,month-1,day);
 if(birth.getFullYear()!==year||birth.getMonth()!==month-1||birth.getDate()!==day||birth>now)return null;
 let age=now.getFullYear()-year;
 const beforeBirthday=(now.getMonth()<month-1)||(now.getMonth()===month-1&&now.getDate()<day);
 if(beforeBirthday)age--;
 return age>=0&&age<=125?age:null;
}
function applyAgeTreatment(){
 const p=ageProfile(),restricted=!p||p.band==='under16';
 window.AbyssalAgeBand=p?.band||'unknown';
 window.AbyssalRestrictedAgeTreatment=restricted;
}
function openAgeTermsIfNeeded(){
 if(hasAgeTermsProfile()){applyAgeTreatment();return false}
 const screen=$('ageTermsScreen');if(screen)screen.hidden=false;
 return true;
}
$('ageTermsContinue')?.addEventListener('click',()=>{
 const day=Number($('ageBirthDay')?.value),month=Number($('ageBirthMonth')?.value),year=Number($('ageBirthYear')?.value),message=$('ageTermsMessage');
 const age=calculateAge(year,month,day);
 if(age===null){if(message)message.textContent='Informe uma data de nascimento válida.';return}
 if(!$('ageTermsAccept')?.checked){if(message)message.textContent='Para continuar, leia e aceite os Termos de Uso e confirme a leitura da Política de Privacidade.';return}
 const band=age<16?'under16':age<18?'teen':'adult';
 localStorage.setItem('abyssalAgeProfile',JSON.stringify({band,termsVersion:AGE_TERMS_VERSION,acceptedAt:new Date().toISOString()}));
 window.google_tag_for_age_treatment=band==='teen'?2:band==='under16'?1:0;
 window.loadAbyssalAds?.();
 if(message)message.textContent='';
 $('ageTermsScreen').hidden=true;applyAgeTreatment();
});
applyAgeTreatment();
const _ageStartup=ageProfile();if(hasAgeTermsProfile()){window.google_tag_for_age_treatment=_ageStartup?.band==='teen'?2:_ageStartup?.band==='under16'?1:0;window.loadAbyssalAds?.();}
queueMicrotask(openAgeTermsIfNeeded);

let pendingUgcReport=null,viewedProfileReportContext=null;
function openUgcReport(type,targetId,label){
 if(!authenticated){openLogin();return}
 pendingUgcReport={type,targetId,...(type==='profile'&&viewedProfileReportContext?viewedProfileReportContext:{})};$('ugcReportTarget').textContent='Denunciando: '+String(label||targetId);$('ugcReportDetails').value='';$('ugcReportStatus').textContent='';$('ugcReportScreen').hidden=false;
}
function closeUgcReport(){$('ugcReportScreen').hidden=true;pendingUgcReport=null}
$('reportProfileBtn')?.addEventListener('click',()=>{if(viewedPublicProfile)openUgcReport('profile',viewedPublicProfile,viewedPublicProfile)});
$('blockProfileBtn')?.addEventListener('click',()=>{if(viewedPublicProfile&&socket?.connected)socket.emit('toggle-user-block',{nickname:viewedPublicProfile});});
$('ugcReportCloseBtn')?.addEventListener('click',closeUgcReport);$('ugcReportCancelBtn')?.addEventListener('click',closeUgcReport);
$('ugcReportSendBtn')?.addEventListener('click',()=>{if(!pendingUgcReport)return;const reason=$('ugcReportReason').value,details=$('ugcReportDetails').value.trim(),btn=$('ugcReportSendBtn');btn.disabled=true;$('ugcReportStatus').textContent='Enviando denúncia para análise...';socket.emit('report-ugc',{...pendingUgcReport,reason,details})});

$('supportBtn')?.addEventListener('click',()=>{$('menuScreen').hidden=true;$('supportScreen').hidden=false;$('supportMessageStatus').textContent='';$('supportEmailInput').focus();});
$('supportCancelBtn')?.addEventListener('click',()=>{$('supportScreen').hidden=true;$('menuScreen').hidden=false;});
$('sendSupportBtn')?.addEventListener('click',async()=>{const name=String($('supportNameInput').value||'').trim(),email=String($('supportEmailInput').value||'').trim(),subject=String($('supportSubjectInput').value||''),message=String($('supportMessageInput').value||'').trim(),website=String($('supportWebsiteInput').value||'');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setAuthFlowMessage('supportMessageStatus','Informe um e-mail válido para podermos responder.',true);$('supportEmailInput').focus();return}if(message.length<10){setAuthFlowMessage('supportMessageStatus','Conte um pouco mais: a mensagem precisa ter pelo menos 10 caracteres.',true);$('supportMessageInput').focus();return}const button=$('sendSupportBtn');button.disabled=true;setAuthFlowMessage('supportMessageStatus','Transmitindo mensagem…');try{const response=await fetch(SERVER_URL+'/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,subject,message,website})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.message||'Não foi possível enviar sua mensagem.');setAuthFlowMessage('supportMessageStatus','Mensagem enviada! Nossa equipe recebeu seu contato.');$('supportNameInput').value='';$('supportEmailInput').value='';$('supportMessageInput').value='';$('supportWebsiteInput').value='';}catch(error){setAuthFlowMessage('supportMessageStatus',error.message||'Falha no envio. Tente novamente mais tarde.',true)}finally{button.disabled=false}});
$('forgotPasswordBtn')?.addEventListener('click',()=>{$('loginScreen').hidden=true;$('passwordResetScreen').hidden=true;$('passwordRecoveryScreen').hidden=false;$('recoveryEmailInput').value=String($('emailInput').value||'').trim();setAuthFlowMessage('recoveryMessage','');$('recoveryEmailInput').focus();});
$('recoveryCancelBtn')?.addEventListener('click',()=>{closePasswordRecovery();$('loginScreen').hidden=false;});
$('requestPasswordResetBtn')?.addEventListener('click',async()=>{const email=String($('recoveryEmailInput').value||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setAuthFlowMessage('recoveryMessage','Informe um e-mail válido.',true);$('recoveryEmailInput').focus();return}const button=$('requestPasswordResetBtn');button.disabled=true;setAuthFlowMessage('recoveryMessage','Enviando solicitação…');try{const response=await fetch(SERVER_URL+'/api/account/password-reset/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const result=await response.json();setAuthFlowMessage('recoveryMessage',result.message||'Se a conta tiver um e-mail de recuperação, enviaremos as instruções.');}catch{setAuthFlowMessage('recoveryMessage','Não foi possível solicitar agora. Tente novamente.',true)}finally{button.disabled=false}});
$('completePasswordResetBtn')?.addEventListener('click',async()=>{const token=new URLSearchParams(location.hash.slice(1)).get('passwordResetToken')||'',password=String($('newPasswordInput').value||''),confirmation=String($('confirmNewPasswordInput').value||'');if(password.length<8||password.length>128){setAuthFlowMessage('resetMessage','A senha deve ter de 8 a 128 caracteres.',true);$('newPasswordInput').focus();return}if(password!==confirmation){setAuthFlowMessage('resetMessage','As senhas não coincidem. Confira os dois campos.',true);$('confirmNewPasswordInput').focus();return}const button=$('completePasswordResetBtn');button.disabled=true;setAuthFlowMessage('resetMessage','Atualizando sua senha…');try{const response=await fetch(SERVER_URL+'/api/account/password-reset/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});const result=await response.json();setAuthFlowMessage('resetMessage',result.message||'Link inválido ou expirado.',!result.ok);if(result.ok){history.replaceState(null,'',location.pathname);$('passwordResetScreen').hidden=true;$('loginScreen').hidden=false;$('passwordInput').value='';$('newPasswordInput').value='';$('confirmNewPasswordInput').value='';setMessage('Senha atualizada com sucesso. Entre com sua nova senha.');}}catch{setAuthFlowMessage('resetMessage','Não foi possível atualizar a senha. Tente novamente.',true)}finally{button.disabled=false}});
$('passwordInput').addEventListener('keydown',e=>{if(e.key==='Enter')authenticate($('nicknameInput').value,$('passwordInput').value,'login')});
$('nicknameInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('passwordInput').focus()});
function buildPositionPayload(player){return {x:Number(player.x),y:Number(player.y),angle:Number(player.angle)||0};}
function buildNetMeta(){const motion=window.AbyssalGameHooks?.motionDiagnostics?.()||{};return {viewportWidth:window.AbyssalGameHooks?.viewportWidth?.()||window.innerWidth||1200,viewportHeight:window.AbyssalGameHooks?.viewportHeight?.()||window.innerHeight||700,worldZoom:window.AbyssalGameHooks?.worldZoom?.()||.78,color:window.AbyssalGameHooks?.skinColor?.()||'#bd91ff',skinId:window.AbyssalGameHooks?.skinId?.()||'default',clientEnemyCount:motion.enemyCount||0,clientMovingEnemies:motion.movingEnemies||0,clientPredicting:Boolean(motion.predictingLocally),clientGameState:String(motion.gameState||'unknown'),clientHidden:Boolean(document.hidden)};}
// One sender for frame updates, heartbeat recovery and shot ordering.
function flushPosition(force=false){
 if(!socket?.connected||!authenticated||!currentRoom||!latestPositionPayload)return false;
 const now=performance.now();if(!force&&now-lastPositionAt<1000/30)return false;
 // Never queue stale transforms when the transport is congested.
 if(socket.io?.engine?.transport?.writable===false)return false;
 const seq=++positionSequence;
 pendingMotion.set(seq,{x:latestPositionPayload.x,y:latestPositionPayload.y,sentAt:now});if(pendingMotion.size>32)pendingMotion.delete(pendingMotion.keys().next().value);
 socket.volatile.emit('player-motion-input',window.AbyssalNetCodec?.input?.(seq,latestPositionPayload.x,latestPositionPayload.y,latestPositionPayload.angle)||[seq,latestPositionPayload.x,latestPositionPayload.y,latestPositionPayload.angle]);
 lastPositionAt=now;positionPacketsSent++;
 if(now-lastNetMetaAt>=1000){lastNetMetaAt=now;socket.volatile.emit('player-net-meta',buildNetMeta());}
 return true;
}
function sendPosition(player){
 if(!player)return;const payload=buildPositionPayload(player);
 if(Number.isFinite(payload.x)&&Number.isFinite(payload.y)){latestPositionPayload=payload;flushPosition();}
}
function startPositionHeartbeat(){
 if(positionHeartbeatTimer)return;
 positionHeartbeatTimer=setInterval(()=>{
  if(!socket?.connected||!authenticated||!currentRoom)return;
  const live=window.AbyssalGameHooks?.getPlayerPosition?.();
  if(live&&Number.isFinite(Number(live.x))&&Number.isFinite(Number(live.y)))latestPositionPayload=buildPositionPayload(live);
  flushPosition();
 },1000/20);
}
function getPositionDiagnostics(){updateNetworkDiagnosticWindow();return {lastAckAt:positionAckAt,ackAgeMs:positionAckAt?Date.now()-positionAckAt:null,ackErrors:positionAckErrors,inFlight:positionPacketInFlight,sequence:positionSequence,packetsSent:positionPacketsSent,motionRttMs:motionRttMs==null?null:Number(motionRttMs.toFixed(1)),motionJitterMs:motionJitterMs==null?null:Number(motionJitterMs.toFixed(1)),motionAckCount,...(networkDebugEnabled?netDiagRates:{})};}
function sendHit(x,y,damage){if(socket?.connected&&authenticated)socket.emit('player-hit',{x,y,damage})}
function sendDamage(id,damage,skillId=null){if(!socket?.connected||!authenticated||!currentRoom)return false;const numericId=Number(id),amount=Number(damage);if(!Number.isSafeInteger(numericId)||!Number.isFinite(amount)||amount<=0)return false;socket.emit('shared-damage',{id:numericId,damage:Math.min(1000,amount),skillId:String(skillId||'').slice(0,32)});return true;}
function sendDamageBatch(hits){
 if(!socket?.connected||!authenticated||!currentRoom||!Array.isArray(hits))return false;
 const valid=hits.slice(0,128).map(hit=>({id:Number(hit?.id),damage:Number(hit?.damage),skillId:String(hit?.skillId||'').slice(0,32),actionId:String(hit?.actionId||'').slice(0,72)})).filter(hit=>Number.isSafeInteger(hit.id)&&Number.isFinite(hit.damage)&&hit.damage>0);
 if(!valid.length)return false;
 socket.emit('shared-damage-batch',{hits:valid});return true;
}
function sendShot(shot){
 if(!socket?.connected||!authenticated||!currentRoom||!shot)return;
 const live=window.AbyssalGameHooks?.getPlayerPosition?.();
 if(live)latestPositionPayload=buildPositionPayload(live);
 // Preserve ordered position -> shot delivery without waiting for an acknowledgement.
 // Once per frame avoids multiplying input traffic for spread volleys.
 if(performance.now()-lastPositionAt>=8)flushPosition(true);
 socket.emit('shared-shot',{...shot,at:Date.now()});
}
function sendPhotonRayStop(){if(socket?.connected&&authenticated&&currentRoom)socket.emit('photon-ray-stop');}
function sendSnapshot(data){if(socket?.connected&&authenticated&&hostId===socket.id)socket.emit('game-snapshot',data)}
function shareXp(value,source='enemy'){if(socket?.connected&&authenticated&&hostId===socket.id)socket.emit('shared-xp-award',{value,source})}
function beginRun(){if(socket?.connected&&authenticated)socket.emit('begin-run',{mode:window.AbyssalGameHooks?.expeditionState?.()?.active?'rift':'solo'})}
function sendBuild(data={}){if(socket?.connected&&authenticated)socket.emit('player-build',{shieldCharges:Number(data.shieldCharges)||0,regenLevel:Number(data.regenLevel)||0,magnetStrength:Math.max(1,Math.min(4.5,Number(data.magnetStrength)||1)),rangeStrength:Math.max(1,Math.min(Math.pow(1.22,3),Number(data.rangeStrength)||1)),speedStrength:Math.max(1,Math.min(4,Number(data.speedStrength)||1)),arcChainActive:data.arcChainActive===true,hadalBeamActive:data.hadalBeamActive===true,ricochetLevel:Math.max(0,Math.min(3,Math.floor(Number(data.ricochetLevel)||0))),prismaticLevel:Math.max(0,Math.min(3,Math.floor(Number(data.prismaticLevel)||0))),predatorLevel:Math.max(0,Math.min(3,Math.floor(Number(data.predatorLevel)||0))),electricLevel:Math.max(0,Math.min(3,Math.floor(Number(data.electricLevel)||0))),shellLevel:Math.max(0,Math.min(3,Math.floor(Number(data.shellLevel)||0))),lastStandLevel:Math.max(0,Math.min(3,Math.floor(Number(data.lastStandLevel)||0)))})}
function setTutorialOpen(open){if(socket?.connected&&authenticated&&currentRoom)socket.emit('tutorial-state',{open:open===true});}
function setTutorialPreference(mode){if(socket?.connected&&authenticated)socket.emit('tutorial-preference',{mode:String(mode||'').slice(0,16),dismissed:true});}
function claimFirstProgressionBonus(progress,onResult){
 if(!socket?.connected||!authenticated){onResult?.({ok:false,message:'Entre em sua conta para resgatar o prêmio único.'});return false;}
 if(currentRoom){onResult?.({ok:false,message:'A recompensa do modo online é entregue automaticamente pelo servidor.'});return false;}
 socket.emit('run-progress',progress||{});
 socket.timeout(12000).emit('claim-first-progression',{mode:'solo'},(err,result)=>{if(!err&&result?.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}));}onResult?.(err?{ok:false,message:'Sem confirmação do servidor. Tente novamente.'}:result);});return true;
}
function sendProtection(seconds,reason='gameplay'){if(socket?.connected&&authenticated)socket.emit('player-protection',{seconds:Number(seconds)||0,reason})}
function sendActiveAbility(id,onResult){if(!socket?.connected||!authenticated||!currentRoom){onResult?.({ok:false,reason:'disconnected'});return false;}socket.timeout(3000).emit('active-ability',{id:String(id||'').slice(0,24)},(err,result)=>{if(!err&&result)onResult?.(result);});return true;}
function requestWorldSnapshot(reason='manual'){if(socket?.connected&&authenticated&&currentRoom)socket.emit('request-world-snapshot',{reason:String(reason||'manual')})}
function requestPlayerState(reason='resync'){if(socket?.connected&&authenticated&&currentRoom){requestWorldSnapshot(reason);socket.emit('request-player-state')}}
function sendRunProgress(data){if(socket?.connected&&authenticated)socket.volatile.emit('run-progress',data)}
function finishRun(data,options={}){
 if(!socket?.connected||!authenticated){if(typeof options.onComplete==='function')options.onComplete({ok:false,earned:0,bossesKilled:Number(data?.bossesKilled)||0,message:'Não foi possível conectar para salvar o mergulho.'});return false;}
 const leaveAfter=Boolean(options.leaveAfter),onComplete=typeof options.onComplete==='function'?options.onComplete:null;
 socket.timeout(12000).emit('finish-run',data||{},(err,result)=>{
  if(err||!result){const failure={ok:false,earned:0,bossesKilled:Number(data?.bossesKilled)||0,message:'O servidor não confirmou o salvamento do mergulho.'};if(onComplete)onComplete(failure);if(leaveAfter&&socket?.connected)socket.emit('leave-world');return;}
  if(leaveAfter&&socket?.connected)socket.emit('leave-world');if(onComplete)onComplete(result);
 });return true;
}
function submitRun(data){return finishRun(data||{},{});}
function loadRankings(){if(socket?.connected)socket.emit('get-rankings');else fetch(SERVER_URL+'/api/rankings').then(r=>r.json()).then(renderRankings).catch(()=>{});}
function purchaseSkin(id){if(socket?.connected&&authenticated)socket.emit('purchase-skin',{id});else window.dispatchEvent(new CustomEvent('abyssal-purchase-result',{detail:{ok:false,message:'Entre na sua conta para comprar skins e salvar a compra nela.'}}));}

async function purchaseStripe(productId,currency,language='pt'){
 const nativeAndroid=Boolean(window.Capacitor?.isNativePlatform?.()&&window.Capacitor?.getPlatform?.()==='android');
 if(nativeAndroid){window.dispatchEvent(new CustomEvent('abyssal-payment-result',{detail:{ok:false,message:language==='en'?'Purchases in the Google Play version use Google Play Billing and will be enabled when the store catalog is connected.':'As compras na versão Google Play usam o Google Play Billing e serão liberadas quando o catálogo da loja for conectado.'}}));return;}
 if(!authenticated||!sessionToken){window.dispatchEvent(new CustomEvent('abyssal-payment-result',{detail:{ok:false,message:'Entre na sua conta antes de comprar.'}}));openLogin();return;}
 try{
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+sessionToken};
  const response=await fetch(SERVER_URL+'/api/payments/checkout',{method:'POST',headers,body:JSON.stringify({productId,currency:'brl',language})});
  const result=await response.json();if(!response.ok)throw new Error(result.message||'Checkout indisponível.');
  window.location.assign(result.url);
 }catch(error){window.dispatchEvent(new CustomEvent('abyssal-payment-result',{detail:{ok:false,message:error.message}}));}
}
function explorationScan(callback){
 if(!socket?.connected||!authenticated||!currentRoom){callback?.({ok:false,reason:'offline'});return;}
 socket.timeout(7000).emit('exploration-scan',{},(error,data)=>callback?.(error?{ok:false,reason:'timeout'}:data));
}
function explorationExtractBegin(id,tool,callback){
 if(!socket?.connected||!authenticated||!currentRoom){callback?.({ok:false,reason:'offline'});return;}
 socket.timeout(7000).emit('exploration-extract-begin',{id,tool},(error,data)=>callback?.(error?{ok:false,reason:'timeout'}:data));
}
function explorationExtractComplete(id,callback){
 if(!socket?.connected||!authenticated||!currentRoom){callback?.({ok:false,reason:'offline'});return;}
 socket.timeout(7000).emit('exploration-extract-complete',{id},(error,data)=>callback?.(error?{ok:false,reason:'timeout'}:data));
}
function explorationCollect(id,callback){
 const tool=String(arguments[2]||'abyssPickaxe');
 if(!socket?.connected||!authenticated||!currentRoom){callback?.({ok:false,reason:'offline'});return;}
 socket.timeout(7000).emit('exploration-collect',{id,tool},(error,data)=>{
  const result=error?{ok:false,reason:'timeout'}:data;
  if(result?.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}));}
  callback?.(result);
 });
}
function explorationStudy(id,callback){
 if(!socket?.connected||!authenticated){callback?.({ok:false,reason:'authentication'});return;}
 socket.timeout(7000).emit('exploration-study',{id},(error,data)=>{
  const result=error?{ok:false,reason:'timeout'}:data;
  if(result?.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}));}
  callback?.(result);
 });
}
function purchaseMeta(id){if(socket?.connected&&authenticated)socket.emit('purchase-meta',{id});else window.dispatchEvent(new CustomEvent('abyssal-purchase-result',{detail:{ok:false,message:'Entre na sua conta para salvar melhorias persistentes.'}}));}
function redeemCode(code,skinId=null){if(socket?.connected&&authenticated)socket.emit('redeem-code',{code,skinId:skinId||undefined});else window.dispatchEvent(new CustomEvent('abyssal-code-redeem-result',{detail:{ok:false,message:'Entre na sua conta para resgatar o código.'}}));}
function spinWheel(){if(socket?.connected&&authenticated)socket.emit('spin-wheel');else window.dispatchEvent(new CustomEvent('abyssal-wheel-result',{detail:{ok:false,message:'Entre em uma conta para receber moedas pela roleta.'}}));}
function saveCosmetics(data){if(socket?.connected&&authenticated)socket.emit('save-cosmetics',data)}
 function equipTitle(id){if(socket?.connected&&authenticated)socket.emit('equip-title',{id});else{const m=$('profileMessage');if(m)m.textContent='Entre na sua conta para equipar e salvar títulos.'}}
 function refreshAccount(){if(socket?.connected&&authenticated)socket.emit('get-account')}
function rankingCountdown(target){const ms=Math.max(0,Number(target)-Date.now()),s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),sec=s%60;return d>0?`${d}d ${h}h ${m}m`:`${h}h ${m}m ${sec}s`;}
function renderRankings(data){
 const root=$('rankingContent');if(!root||!data)return;
 const resets=data.resets||{},sections=[['eternal','HALL ETERNO','Marca histórica: quantidade de bosses derrotados por mergulho.'],['monthly','RANKING MENSAL','Top 10 recebe 5.000 moedas quando o período fechar.'],['weekly','RANKING SEMANAL','Top 10 recebe 1.000 moedas quando o período fechar.'],['daily','RANKING DIÁRIO','Top 10 recebe 100 moedas quando o período fechar.']];
 root.innerHTML=sections.map(([key,title,note])=>{const list=data[key]||[],timer=key==='eternal'?'PERMANENTE':`RECOMPENSA EM <strong class="ranking-countdown" data-reset="${Number(resets[key])||0}">${rankingCountdown(resets[key])}</strong>`;return `<section class="ranking-section ranking-${key}"><header class="ranking-section-head"><h3>${title}</h3><span class="ranking-reset">${timer}</span></header>${list.length?list.map((p,i)=>`<div class="ranking-row"><span class="rank-place">#${i+1}</span><span class="rank-name">${escapeHtml(p.nickname||'Mergulhador')}</span><span class="rank-time">${Number(p.bossesKilled)||0} BOSS${Number(p.bossesKilled)===1?'':'ES'} · ${Math.round(Number(p.score??p.damage)||0).toLocaleString('pt-BR')} DANO</span></div>`).join(''):'<div class="ranking-row"><span class="rank-place">·</span><span class="rank-name">Nenhum mergulho registrado</span><span class="rank-time">0 BOSSES</span></div>'}<p class="ranking-note">${note} Desempate: maior dano e depois maior tempo de mergulho.</p></section>`}).join('');
 clearInterval(window.__abyssalRankingTimer);window.__abyssalRankingTimer=setInterval(()=>{document.querySelectorAll('.ranking-countdown[data-reset]').forEach(el=>el.textContent=rankingCountdown(el.dataset.reset));},1000);
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function pushPeerMotionSample(peer,x,y,serverTime,receivedAt){
 if(!peer||![x,y,serverTime,receivedAt].every(Number.isFinite))return false;
 const samples=Array.isArray(peer.motionSamples)?peer.motionSamples:(peer.motionSamples=[]),last=samples[samples.length-1];
 if(last&&serverTime<=Number(last.serverTime))return false;
 samples.push({x,y,serverTime,receivedAt});while(samples.length>10)samples.shift();
 if(last){
  const serverSpacing=Math.max(16,Math.min(250,serverTime-Number(last.serverTime))),arrivalSpacing=Math.max(0,Math.min(500,receivedAt-Number(last.receivedAt)));
  const jitter=Math.abs(arrivalSpacing-serverSpacing);
  peer.motionJitterMs=Number.isFinite(Number(peer.motionJitterMs))?Number(peer.motionJitterMs)*.82+jitter*.18:jitter;
  const isPvp=window.AbyssalGameHooks?.roomMode?.()==='pvp';
  peer.motionBufferMs=Math.max(isPvp?50:65,Math.min(isPvp?90:125,(isPvp?58:72)+(Number(peer.motionJitterMs)||0)*1.45));
 }else peer.motionBufferMs=window.AbyssalGameHooks?.roomMode?.()==='pvp'?58:72;
 return true;
}
function getInterpolatedPeer(p,now=performance.now()){
 const samples=Array.isArray(p.motionSamples)?p.motionSamples:null;
 if(samples&&samples.length>=2){
  const latest=samples[samples.length-1],serverNow=Number(latest.serverTime)+Math.max(0,now-Number(latest.receivedAt)),renderTime=serverNow-(Number(p.motionBufferMs)||72);
  if(renderTime<=Number(samples[0].serverTime))return {...p,x:Number(samples[0].x),y:Number(samples[0].y)};
  let a=samples[0],b=samples[1];
  for(let i=1;i<samples.length;i++){b=samples[i];if(Number(b.serverTime)>=renderTime){a=samples[i-1];break;}a=b;}
  if(Number(b.serverTime)>=renderTime&&Number(b.serverTime)>Number(a.serverTime)){
   const t=Math.max(0,Math.min(1,(renderTime-Number(a.serverTime))/(Number(b.serverTime)-Number(a.serverTime))));
   return {...p,x:Number(a.x)+(Number(b.x)-Number(a.x))*t,y:Number(a.y)+(Number(b.y)-Number(a.y))*t};
  }
  const previous=samples[samples.length-2],dt=Math.max(.001,(Number(latest.serverTime)-Number(previous.serverTime))/1000),maxSpeed=420;
  let vx=(Number(latest.x)-Number(previous.x))/dt,vy=(Number(latest.y)-Number(previous.y))/dt,speed=Math.hypot(vx,vy);if(speed>maxSpeed){vx=vx/speed*maxSpeed;vy=vy/speed*maxSpeed;}
  const extraMs=Math.min(90,Math.max(0,renderTime-Number(latest.serverTime)));
  return {...p,x:Number(latest.x)+vx*extraMs/1000,y:Number(latest.y)+vy*extraMs/1000};
 }
 const duration=Math.max(1,Number(p.interpDuration)||1),elapsed=Math.max(0,now-(Number(p.interpAt)||now)),t=Math.max(0,Math.min(1,elapsed/duration));
 const fromX=Number(p.fromX)||0,fromY=Number(p.fromY)||0,targetX=Number(p.targetX)||0,targetY=Number(p.targetY)||0;
 let x=fromX+(targetX-fromX)*t,y=fromY+(targetY-fromY)*t;
 if(t>=1){const extraMs=Math.min(Number(p.peerExtrapolationMs)||90,Math.max(0,elapsed-duration));x=targetX+(Number(p.velocityX)||0)*(extraMs/1000);y=targetY+(Number(p.velocityY)||0)*(extraMs/1000);}
 return {...p,x,y};
}
function storePlayer(incoming,frameServerTime=0){
 if(!incoming||!incoming.id||incoming.id===localPlayerId)return;
 const now=performance.now(),old=players.get(incoming.id),rendered=old?getInterpolatedPeer(old,now):null,isPvp=window.AbyssalGameHooks?.roomMode?.()==='pvp';
 const x=Number.isFinite(Number(incoming.x))?Number(incoming.x):(window.AbyssalGameHooks?.worldWidth?.()||4800)*.5,y=Number.isFinite(Number(incoming.y))?Number(incoming.y):(window.AbyssalGameHooks?.worldHeight?.()||3000)*.5;
 const sampleMs=old?Math.max(20,Math.min(250,now-(Number(old.sampleAt)||now))):(1000/30),oldX=old?Number(old.targetX):x,oldY=old?Number(old.targetY):y,maxSpeed=420;
 let velocityX=old&&Number.isFinite(oldX)?(x-oldX)/(sampleMs/1000):0,velocityY=old&&Number.isFinite(oldY)?(y-oldY)/(sampleMs/1000):0;
 const speed=Math.hypot(velocityX,velocityY);if(speed>maxSpeed){velocityX=velocityX/speed*maxSpeed;velocityY=velocityY/speed*maxSpeed;}
 const next={...(old||{}),...incoming,fromX:rendered?rendered.x:x,fromY:rendered?rendered.y:y,targetX:x,targetY:y,interpAt:now,interpDuration:Math.max(24,Math.min(isPvp?45:55,sampleMs*1.05)),sampleAt:now,velocityX,velocityY,peerExtrapolationMs:isPvp?60:85,motionSamples:Array.isArray(old?.motionSamples)?old.motionSamples:[]};
 pushPeerMotionSample(next,x,y,Number(frameServerTime)||Date.now(),now);
 players.set(incoming.id,next);if(Number(next.netId)>0)playersByNetId.set(Number(next.netId)>>>0,incoming.id);
}
function applyPlayerList(list){
 const keep=new Set();(Array.isArray(list)?list:[]).forEach(p=>{if(p?.id&&p.id!==localPlayerId){keep.add(p.id);storePlayer(p)}});
 for(const id of players.keys())if(!keep.has(id)){const peer=players.get(id);if(peer?.netId)playersByNetId.delete(Number(peer.netId)>>>0);players.delete(id);}
}
function applyPlayerMotion(rows){
 if(!Array.isArray(rows))return;
 for(const row of rows){
  if(!Array.isArray(row)||row.length<4)continue;
  const netId=Number(row[0])>>>0,id=playersByNetId.get(netId),peer=id?players.get(id):null;if(!peer||peer.id===localPlayerId)continue;
  storePlayer({id:peer.id,netId,x:Number(row[1]),y:Number(row[2]),angle:Number(row[3])||0},frameServerTime);
 }
}
function getPlayers(){return [...players.values()].map(p=>getInterpolatedPeer(p));}
function getPlayerById(id){const peer=players.get(String(id));return peer?getInterpolatedPeer(peer):null;}
function sendSkinAbility(data,onResult){if(!socket?.connected||!authenticated||!currentRoom)return false;socket.emit('skin-ability',data,result=>{if(!result?.ok)console.warn('[Abyssal] O servidor recusou o efeito visual da skin:',result?.reason||'sem confirmação');onResult?.(result||{ok:false,reason:'no-ack'});});return true;}
function sendFusion(name){if(!socket?.connected||!authenticated||!currentRoom)return false;socket.emit('fusion-achieved',{name:String(name||'').slice(0,48)});return true;}
function requestMapTransition(kind,onResult){if(!socket?.connected||!authenticated||!currentRoom){onResult?.({ok:false,reason:'disconnected'});return false;}socket.timeout(3000).emit('map-transition',{kind:String(kind||'').slice(0,16)},(err,result)=>{if(err){onResult?.({ok:false,reason:'timeout'});return;}if(result)onResult?.(result);});return true;}

updateAccount();
if(sessionToken)queueMicrotask(()=>connect());
function revivePlayer(){if(socket?.connected&&authenticated)socket.emit('revive-player');else window.dispatchEvent(new CustomEvent('abyssal-revive-result',{detail:{ok:false,message:'Conecte-se à sua conta para continuar este mergulho online.'}}));}
 function openRiftChest(payload,onResult){
  if(!socket?.connected||!authenticated){onResult({ok:false,message:'Conecte-se e entre na sua conta para abrir o baú.'});return;}
  if(payload.progress)socket.emit('run-progress',payload.progress);
  socket.timeout(12000).emit('open-rift-chest',payload,(err,result)=>onResult(err?{ok:false,message:'Sem confirmação. Tente abrir novamente.'}:result));
 }
 window.AbyssalOnline={explorationScan,explorationCollect,explorationExtractBegin,explorationExtractComplete,explorationStudy,openRiftChest,openLogin,showRooms,requestRooms,createRoom,joinRoom,connectAndJoin,connect,authenticate,joinWorld,leaveWorld,sendPosition,sendHit,getPlayers,getPlayerById,getSocketId:()=>socket?.id||localPlayerId,isAuthenticated:()=>authenticated,isConnected:()=>connected,isHost:()=>false,currentRoom:()=>currentRoom,positionDiagnostics:getPositionDiagnostics,sendDamage,sendDamageBatch,sendShot,sendPhotonRayStop,sendSkinAbility,sendFusion,requestMapTransition,sendSnapshot:()=>{},requestHostTransfer:()=>{},shareXp:()=>{},beginRun,revivePlayer,sendBuild,sendProtection,setTutorialOpen,setTutorialPreference,claimFirstProgressionBonus,sendActiveAbility,requestPlayerState,requestWorldSnapshot,sendRunProgress,finishRun,submitRun,loadRankings,renderRankings,purchaseSkin,purchaseStripe,purchaseMeta,redeemCode,spinWheel,saveCosmetics,equipTitle,refreshAccount,openProfile,getAccount:()=>serverAccount};
 // Authentication and multiplayer navigation belong to the online module so gameplay startup errors cannot disable them.
 $('loginBtn')?.addEventListener('click',()=>openLogin());
 $('profileBtn')?.addEventListener('click',()=>openProfile());
 $('matchHistoryBtn')?.addEventListener('click',()=>openMatchHistory());
 $('onlineBtn')?.addEventListener('click',()=>{
  window.AbyssalPreferredRoomMode='coop';
  if(authenticated)showRooms();
  else connectAndJoin();
 });
document.addEventListener('visibilitychange',()=>{
 const hidden=Boolean(document.hidden);
 if(socket?.connected&&authenticated&&currentRoom){
  socket.emit('client-visibility',{hidden});
  const live=window.AbyssalGameHooks?.getPlayerPosition?.();
  if(live&&Number.isFinite(Number(live.x))&&Number.isFinite(Number(live.y))){
   latestPositionPayload=buildPositionPayload(live);
   socket.emit('player-position',{...latestPositionPayload,seq:++positionSequence,clientSentAt:Date.now()});
  }
 }
 if(!hidden){if(socket&&!socket.connected)socket.connect();requestPlayerState('resume-resync');}
});
window.addEventListener('focus',()=>requestPlayerState());
window.addEventListener('abyssal-rankings-refreshed',ev=>renderRankings(ev.detail));
 window.addEventListener('abyssal-specimen-discovery-request',event=>{
  if(socket?.connected&&authenticated)socket.emit('specimen-discovered',{id:String(event.detail?.id||'')});
 });


 const deleteInput=$('deleteNicknameInput'),deleteBtn=$('deleteAccountBtn');
 function updateDeleteButton(){
  if(!deleteInput||!deleteBtn)return;
  const expected=String(serverAccount?.nickname||'').trim().toLowerCase();
  deleteBtn.disabled=!authenticated||!expected||deleteInput.value.trim().toLowerCase()!==expected;
 }
 deleteInput?.addEventListener('input',updateDeleteButton);
 deleteBtn?.addEventListener('click',()=>{
  if(!authenticated||!serverAccount)return;
  const expected=String(serverAccount.nickname||'').trim().toLowerCase();
  if(deleteInput.value.trim().toLowerCase()!==expected){updateDeleteButton();return}
  const message=$('profileMessage');
  if(message)message.textContent='Solicitando exclusão segura da conta…';
  deleteBtn.disabled=true;
  socket.emit('delete-account',{nickname:deleteInput.value.trim()});
 });
 $('fullscreenBtn')?.addEventListener('click',async()=>{
  const button=$('fullscreenBtn');
  try{
   const isFullscreen=Boolean(document.fullscreenElement||document.webkitFullscreenElement);
   if(window.ABYSSAL_NATIVE_SHELL){button.title='Tela cheia gerenciada pelo aplicativo Android.';return;}
   if(isFullscreen){
    if(document.exitFullscreen)await document.exitFullscreen();
    else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
   }else{
    const root=document.documentElement;
    if(root.requestFullscreen)await root.requestFullscreen();
    else if(root.webkitRequestFullscreen)root.webkitRequestFullscreen();
    else throw new Error('unsupported');
    try{if(screen.orientation?.lock)await screen.orientation.lock('landscape')}catch(_orientationError){}
   }
  }catch(err){
   if(button)button.title='Este navegador não permite tela cheia por botão. Em iPhone/iPad, adicione o jogo à Tela de Início para abrir sem a barra do navegador.';
   const toast=$('toast');
   if(toast){toast.textContent='Tela cheia não está disponível neste navegador. Em iPhone/iPad, use Compartilhar → Adicionar à Tela de Início.';toast.hidden=false;setTimeout(()=>{toast.hidden=true},6500)}
  }
 });
 window.__abyssalFullscreenHandlerReady=true;
 function updateFullscreenButton(){
  const button=$('fullscreenBtn');if(!button)return;
  const active=Boolean(document.fullscreenElement||document.webkitFullscreenElement);
  button.classList.toggle('is-fullscreen',active);
  button.title=active?'Sair da tela cheia (Esc)':'Ativar tela cheia';
  button.setAttribute('aria-label',active?'Sair da tela cheia':'Ativar tela cheia');
 }
 document.addEventListener('fullscreenchange',updateFullscreenButton);
 document.addEventListener('webkitfullscreenchange',updateFullscreenButton);
 [$('downloadBtn'),$('mobileDownloadTopBtn')].filter(Boolean).forEach(button=>button.addEventListener('click',()=>{$('downloadScreen').hidden=false;}));
 $('downloadCloseBtn')?.addEventListener('click',()=>{$('downloadScreen').hidden=true});
 $('playBrowserBtn')?.addEventListener('click',()=>{$('downloadScreen').hidden=true});
 $('installPwaBtn')?.addEventListener('click',async()=>{
  const message=$('downloadInstallMessage');if(!message)return;
  if(deferredInstallPrompt){
   try{await deferredInstallPrompt.prompt();const choice=await deferredInstallPrompt.userChoice;message.textContent=choice?.outcome==='accepted'?'Instalação iniciada. Siga a confirmação exibida pelo navegador.':'Instalação cancelada. Você pode tentar novamente.';}
   catch(error){message.textContent='A instalação automática não está disponível agora. Use o menu do navegador.';}
   deferredInstallPrompt=null;return;
  }
  const ua=navigator.userAgent||'';
  if(/iphone|ipad|ipod/i.test(ua)){message.textContent='No iPhone/iPad: abra no Safari, toque em Compartilhar e selecione “Adicionar à Tela de Início”.';return;}
  if(/android/i.test(ua)){message.textContent='No Android: abra no Chrome, toque no menu ⋮ e escolha “Instalar app” ou “Adicionar à tela inicial”.';return;}
  message.textContent='No Chrome/Edge: abra o menu do navegador e procure “Instalar Abyssal” ou “Instalar esta página como aplicativo”.';
 });
 document.querySelectorAll('[data-platform]').forEach(button=>button.addEventListener('click',()=>{
  if(button.tagName==='A')return;
  const platform=button.dataset.platform,message=$('downloadInstallMessage');if(!message)return;
  if(platform==='windows'){message.textContent='Abrindo o instalador do Abyssal para Windows…';window.location.href='https://github.com/Esaneto/Abyssal/releases/latest/download/Abyssal-Setup.exe';return;}
  if(platform==='android'){message.textContent='Abrindo o pacote APK do Abyssal… No Android, talvez seja necessário autorizar a instalação de aplicativos baixados pelo navegador.';window.location.href='https://github.com/Esaneto/Abyssal/releases/latest/download/Abyssal-Android.apk';return;}
  if(platform==='google-play'){message.textContent='O Abyssal ainda não está publicado na Google Play. A publicação exige gerar e assinar um pacote Android, configurar a ficha da loja e concluir a análise do Google.';return;}
  if(platform==='app-store'){message.textContent='O Abyssal ainda não está publicado na Apple App Store. A publicação exige um build iOS assinado, cadastro Apple Developer e aprovação da loja.';return;}
  if(platform==='ios'){message.textContent='No iPhone/iPad: abra esta página no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”. Abra pelo novo ícone para uma experiência mais próxima de um aplicativo em tela cheia.';return;}
 }));
 $('cardumesBtn')?.addEventListener('click',()=>{$('cardumesScreen').hidden=false;showCardumeDirectory();requestCardumes();if(serverAccount?.cardumeId)socket?.emit('get-cardume-details')});$('cardumesCloseBtn')?.addEventListener('click',()=>{$('cardumesScreen').hidden=true});$('refreshCardumesBtn')?.addEventListener('click',requestCardumes);$('refreshCardumeDetailBtn')?.addEventListener('click',()=>socket?.emit('get-cardume-details'));$('backToCardumeDirectoryBtn')?.addEventListener('click',()=>{showCardumeDirectory();requestCardumes()});$('createCardumeBtn')?.addEventListener('click',()=>{if(!authenticated){const msg=$('cardumeMessage');if(msg)msg.textContent='Entre na sua conta para criar um Cardume.';openLogin();return;}const name=$('cardumeNameInput').value.trim(),description=$('cardumeDescriptionInput').value.trim();socket?.emit('create-cardume',{name,description});});$('leaveCardumeBtn')?.addEventListener('click',()=>socket?.emit('leave-cardume'));
 document.addEventListener('click',ev=>{const button=ev.target.closest('[data-equip-title]');if(!button)return;equipTitle(button.dataset.equipTitle)});


 if(navigator.onLine!==false&&!socket)connect();
 window.addEventListener('online',()=>{if(!socket?.connected)connect();});
 
 // Handle return from Stripe checkout
 const urlParams = new URLSearchParams(window.location.search);
 if (urlParams.get('payment') === 'success') {
  showToast('PAGAMENTO CONFIRMADO! ATUALIZANDO CONTEÚDO...');
  window.history.replaceState({}, document.title, window.location.pathname);
  setTimeout(() => {
   if (socket?.connected && authenticated) socket.emit('get-account');
  }, 1000);
 } else if (urlParams.get('payment') === 'cancelled') {
  showToast('PAGAMENTO CANCELADO.');
  window.history.replaceState({}, document.title, window.location.pathname);
 }

 const resetToken=new URLSearchParams(location.hash.slice(1)).get('passwordResetToken');
 if(resetToken){$('loginScreen').hidden=true;$('passwordRecoveryScreen').hidden=true;$('passwordResetScreen').hidden=false;$('newPasswordInput').focus();setAuthFlowMessage('resetMessage','');}
 window.addEventListener('abyssal-account-data',ev=>{const screen=$('profileScreen');if(screen&&!screen.hidden)renderProfile(ev.detail);});
})();
