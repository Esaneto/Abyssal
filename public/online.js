(() => {
'use strict';
const $=id=>document.getElementById(id);
let socket=null,authenticated=false,connected=false,localPlayerId=null,players=new Map(),lastPositionAt=0,hostId=null,currentRoom=null,pendingRoomPassword='',roomPollTimer=null,socketRoomsCache=null,httpRoomsCache=null,socketRoomsAt=0,httpRoomsAt=0;
let positionHeartbeatTimer=null,latestPositionPayload=null,positionPacketInFlight=false,positionSequence=0,positionAckAt=0,positionAckErrors=0,positionPacketsSent=0;
let account=JSON.parse(localStorage.getItem('abyssalAccount')||'null'),serverAccount=null;
let sessionToken=localStorage.getItem('abyssalSessionToken')||'',deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;const message=$('downloadInstallMessage');if(message)message.textContent='Abyssal instalado com sucesso neste dispositivo.';});
 const PROFILE_TITLES=[
  {id:'abyss-drifter',name:'Mergulhador das Fossas',icon:'✧',rarity:'COMUM',color:'#79f3f0',description:'Seu primeiro vínculo com as profundezas.',goal:'Disponível desde o início.',kind:'starter'},
  {id:'abyss-spark',name:'Faísca das Fossas',icon:'◈',rarity:'INCOMUM',color:'#8cf8ff',description:'A luz que sobrevive onde o sol não chega.',goal:'Derrote 50 monstros.',kind:'kills',required:50},
  {id:'current-hunter',name:'Caçador de Correntes',icon:'〰',rarity:'RARO',color:'#b39cff',description:'Você aprendeu a caçar contra a correnteza.',goal:'Derrote 250 monstros.',kind:'kills',required:250},
  {id:'pelagic-executioner',name:'Carrasco Pelágico',icon:'✹',rarity:'ÉPICO',color:'#ff829b',description:'Até os predadores recuam ao sentir sua presença.',goal:'Derrote 1.000 monstros.',kind:'kills',required:1000},
  {id:'leviathan-hunter',name:'Caçador de Leviatãs',icon:'♆',rarity:'ÉPICO',color:'#ffd27a',description:'Um troféu conquistado contra os gigantes do abismo.',goal:'Derrote 10 bosses.',kind:'bosses',required:10},
  {id:'sovereign-abyss',name:'Soberano do Insondável',icon:'♛',rarity:'LENDÁRIO',color:'#e0b7ff',description:'O próprio oceano parece reconhecer seu nome.',goal:'Derrote 50 bosses.',kind:'bosses',required:50},
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
 function titleArtwork(id){return TITLE_ARTWORK[id]||TITLE_ARTWORK['abyss-drifter'];}
 const profileNumber=n=>Math.max(0,Number(n)||0);
 let viewedPublicProfile=null;
 function renderProfile(data=serverAccount){
  if(data&&serverAccount&&data.nickname===serverAccount.nickname)serverAccount={...serverAccount,...(data.cardumeId?{cardumeId:data.cardumeId}:{})};
  const root=$('profileTitleGrid');if(!root)return;
  const user=data||{},stats=user.titleStats||{},kills=profileNumber(stats.monstersDefeated),bosses=profileNumber(stats.bossesDefeated);
  const received=profileNumber(user.likesReceived),given=profileNumber(user.likesGiven),created=profileNumber(stats.cardumesCreated);
  const progressFor=t=>t.kind==='kills'?kills:t.kind==='bosses'?bosses:t.kind==='likesReceived'?received:t.kind==='likesGiven'?given:t.kind==='cardumesCreated'?created:((t.kind==='storeSupporter'||t.kind==='bossAbyssal'||t.kind==='conqueror')&&Array.isArray(user.unlockedTitles)&&user.unlockedTitles.includes(t.id)?1:0);
  const equipped=user.equippedTitle||'abyss-drifter';
  const unlockedIds=new Set(Array.isArray(user.unlockedTitles)?user.unlockedTitles:PROFILE_TITLES.filter(t=>t.kind==='starter'||progressFor(t)>=t.required).map(t=>t.id));
  const unlocked=PROFILE_TITLES.filter(t=>unlockedIds.has(t.id));
  const current=PROFILE_TITLES.find(t=>t.id===equipped)||PROFILE_TITLES[0];
  $('profileNickname').textContent=user.nickname||account?.nickname||'VISITANTE';
  $('profileEquippedLabel').textContent='Título equipado: '+current.name;
  $('profileEmblem').innerHTML=titleArtwork(current.id);$('profileEmblem').style.setProperty('--title-color',current.color);$('profileEmblem').style.color=current.color;
  $('profileAccountNote').textContent=window.AbyssalOnline?.isAuthenticated()?'Título e progresso salvos na sua conta.':(window.AbyssalOnline?.isConnected()?'Entre na sua conta para salvar seu título.':'Conexão interrompida; exibindo os últimos dados sincronizados.');
  $('profileKills').textContent=kills.toLocaleString('pt-BR');$('profileBosses').textContent=bosses.toLocaleString('pt-BR');
  $('profileTitleCount').textContent=unlocked.length;$('profileTitleProgress').textContent=unlocked.length+' de '+PROFILE_TITLES.length+' disponíveis';
  root.innerHTML=PROFILE_TITLES.map(t=>{
   const progress=progressFor(t),owned=unlockedIds.has(t.id),isEquipped=equipped===t.id;
   const percent=t.kind==='starter'?100:Math.min(100,Math.floor(progress/t.required*100));
    const detail=t.kind==='starter'?t.goal:owned?'Conquista concluída':percent+'% · '+progress.toLocaleString('pt-BR')+'/'+t.required.toLocaleString('pt-BR');
   return '<article class="profile-title-card '+(owned?'':'is-locked')+' '+(isEquipped?'is-equipped':'')+'" style="--title-color:'+t.color+'"><div class="profile-title-icon" aria-hidden="true">'+titleArtwork(t.id)+'</div><div class="profile-title-copy"><h4 class="profile-title-name">'+escapeHtml(t.name)+'</h4><p class="profile-title-desc">'+escapeHtml(t.description)+'</p><div class="profile-title-meta"><span>'+t.rarity+'</span><span>·</span><span class="profile-title-state '+(owned?'':'locked')+'">'+(owned?'✓ DESBLOQUEADO':'⌑ BLOQUEADO')+'</span></div><p class="profile-title-desc" style="margin-top:7px">'+escapeHtml(owned?t.goal:detail)+'</p><div class="profile-title-progressbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'"><span style="width:'+percent+'%"></span></div><button class="profile-title-action" data-equip-title="'+t.id+'" '+(!owned||isEquipped||!window.AbyssalOnline?.isAuthenticated()?'disabled':'')+'>'+(isEquipped?'EQUIPADO':owned?'EQUIPAR TÍTULO':window.AbyssalOnline?.isAuthenticated()?'AINDA BLOQUEADO':'ENTRE PARA EQUIPAR')+'</button></div></article>';
  }).join('');
 }
 const CHAT_TITLE_META={
  'abyss-drifter':{name:'Mergulhador das Fossas',color:'#79f3f0'},
  'abyss-spark':{name:'Faísca das Fossas',color:'#8cf8ff'},
  'current-hunter':{name:'Caçador de Correntes',color:'#b39cff'},
  'pelagic-executioner':{name:'Carrasco Pelágico',color:'#ff829b'},
  'leviathan-hunter':{name:'Caçador de Leviatãs',color:'#ffd27a'},
  'sovereign-abyss':{name:'Soberano do Insondável',color:'#e0b7ff'},
  'shoal-founder':{name:'Fundador do Cardume',color:'#73e7c3'},
  'supporter-of-the-depths':{name:'Apoio das Profundezas',color:'#ff9fca'},
  'abyssal-famous':{name:'Nome Conhecido',color:'#ffb0d9'},
  'abyssal-icon':{name:'Ícone do Abismo',color:'#f2a8ff'},
  'living-legend':{name:'Lenda Viva',color:'#ffe29b'},
  'abyssal-patron':{name:'Patrono do Abismo',color:'#ffd27a'},
  'boss-abyssal':{name:'Boss Abyssal',color:'#ff6b9d'},
   'abyssal-conqueror':{name:'Conquistador Abyssal',color:'#2ee88a'}
 };
 function setGlobalChatStatus(online){const panel=$('globalChatPanel'),status=$('globalChatStatus');if(panel)panel.classList.toggle('is-offline',!online);if(status)status.textContent=online?'SINAL ESTÁVEL':'SEM SINAL';}
 function renderGlobalChatMessage(message){
  const list=$('globalChatMessages');if(!list||!message)return;
  const empty=list.querySelector('.global-chat-empty');if(empty)empty.remove();
  const row=document.createElement('article');row.className='global-chat-message';
  const head=document.createElement('div');head.className='global-chat-message-head';
  const name=document.createElement('strong');name.className='global-chat-name';name.textContent=String(message.nickname||'Mergulhador').slice(0,18);head.appendChild(name);
  const title=CHAT_TITLE_META[message.titleId];if(title){const badge=document.createElement('span');badge.className='global-chat-title';badge.style.setProperty('--chat-title-color',title.color);badge.textContent=title.name;head.appendChild(badge);}
  const time=document.createElement('time');time.className='global-chat-time';time.textContent=new Date(Number(message.at)||Date.now()).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});head.appendChild(time);
  const body=document.createElement('p');body.className='global-chat-message-body';body.textContent=String(message.text||'').slice(0,180);
  row.append(head,body);
  if(authenticated&&sessionToken&&message.id&&message.nickname!==account?.nickname){
   const actions=document.createElement('div');actions.className='global-chat-message-actions';
   const report=document.createElement('button');report.type='button';report.className='small-action global-chat-report';report.textContent='DENUNCIAR';
   report.setAttribute('aria-label','Denunciar mensagem de '+String(message.nickname||'jogador'));
   report.addEventListener('click',async()=>{
    const choices=['bullying','hate','sexual_content','personal_information','threat','spam','other'];
    const labels=['Assédio ou bullying','Discurso de ódio','Conteúdo sexual','Dados pessoais','Ameaça','Spam','Outro'];
    const selected=window.prompt('Escolha o motivo da denúncia:\n'+labels.map((label,index)=>(index+1)+'. '+label).join('\n')+'\n\nDigite um número de 1 a 7.');
    const index=Number(selected)-1;if(!Number.isInteger(index)||index<0||index>=choices.length)return;
    report.disabled=true;
    try{
     const response=await fetch(SERVER_URL+'/api/chat/reports',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionToken},body:JSON.stringify({messageId:message.id,reason:choices[index]})});
     const result=await response.json();if(!response.ok)throw new Error(result.message||'Não foi possível enviar a denúncia.');
     report.textContent='DENÚNCIA ENVIADA';
    }catch(error){report.disabled=false;window.dispatchEvent(new CustomEvent('abyssal-payment-result',{detail:{ok:false,message:error.message}}));}
   });
   actions.appendChild(report);row.appendChild(actions);
  }
  list.appendChild(row);
  while(list.children.length>50)list.firstElementChild?.remove();
  list.scrollTop=list.scrollHeight;
 }
 function renderGlobalChatHistory(messages){const list=$('globalChatMessages');if(!list)return;list.replaceChildren();(Array.isArray(messages)?messages:[]).slice(-50).forEach(renderGlobalChatMessage);if(!list.children.length){const empty=document.createElement('p');empty.className='global-chat-empty';empty.textContent='Nenhuma transmissão recente. Seja o primeiro a falar.';list.appendChild(empty)}}
 function sendGlobalChatMessage(text){if(!socket?.connected){const hint=$('globalChatHint');if(hint)hint.textContent='Sem conexão com o servidor. Tente novamente.';return false}if(!authenticated){const hint=$('globalChatHint');if(hint)hint.textContent='Entre na sua conta para transmitir mensagens.';return false}socket.emit('global-chat-send',{text});return true}

 function showCardumeDirectory(){const d=$('cardumeDirectory'),detail=$('cardumeDetail');if(d)d.hidden=false;if(detail)detail.hidden=true;}
 function showCardumeDetail(data){const c=data?.cardume,roster=Array.isArray(data?.roster)?data.roster:[];if(!c){showCardumeDirectory();return;}const d=$('cardumeDirectory'),detail=$('cardumeDetail');if(d)d.hidden=true;if(detail)detail.hidden=false;$('cardumeDetailName').textContent=c.name;$('cardumeDetailDescription').textContent=c.description||'Um grupo de mergulhadores explorando as profundezas.';$('cardumeMemberCount').textContent=c.members+' / '+c.capacity;const root=$('cardumeMembers');if(!root)return;root.replaceChildren();if(!roster.length){const p=document.createElement('p');p.className='rooms-empty';p.textContent='Nenhum membro encontrado.';root.appendChild(p);return;}for(const m of roster){const row=document.createElement('article');row.className='cardume-member';const dot=document.createElement('span');dot.className='member-presence'+(m.online?' is-online':'');dot.title=m.online?'Online':'Offline';const copy=document.createElement('div');copy.className='cardume-member-copy';const name=document.createElement('strong');name.textContent=m.nickname+(m.leader?' · LÍDER':'');const meta=document.createElement('small');meta.textContent=(m.online?'ONLINE':'OFFLINE')+' · '+(CHAT_TITLE_META[m.equippedTitle]?.name||'Mergulhador das Fossas')+' · '+(m.likesReceived||0)+' curtidas';copy.append(name,meta);const btn=document.createElement('button');btn.type='button';btn.textContent='VER PERFIL';btn.addEventListener('click',()=>openPublicProfile(m.nickname));row.append(dot,copy,btn);root.appendChild(row);}}
 function openPublicProfile(nickname){if(!socket?.connected)return;viewedPublicProfile=String(nickname||'');socket.emit('get-public-profile',{nickname:viewedPublicProfile});}
 function showPublicProfile(profile){if(!profile)return;viewedPublicProfile=profile.nickname;$('profileScreen').hidden=false;$('cardumesScreen').hidden=true;$('accountDeletePanel').hidden=true;$('publicProfileActions').hidden=Boolean(profile.isSelf);$('profileMessage').textContent=profile.isSelf?'Este é o seu perfil.':'Perfil público do mergulhador.';$('profileNickname').textContent=profile.nickname;const title=PROFILE_TITLES.find(t=>t.id===profile.equippedTitle)||PROFILE_TITLES[0];$('profileEquippedLabel').textContent='Título equipado: '+title.name;$('profileEmblem').innerHTML=titleArtwork(title.id);$('profileEmblem').style.setProperty('--title-color',title.color);$('profileEmblem').style.color=title.color;$('profileKills').textContent=profileNumber(profile.titleStats?.monstersDefeated).toLocaleString('pt-BR');$('profileBosses').textContent=profileNumber(profile.titleStats?.bossesDefeated).toLocaleString('pt-BR');$('profileTitleCount').textContent=(profile.unlockedTitles||[]).length;$('profileTitleProgress').textContent=(profile.unlockedTitles||[]).length+' de '+PROFILE_TITLES.length+' títulos';renderProfile(profile);$('profileAccountNote').textContent=profile.cardume?'Cardume: '+profile.cardume.name:'Ainda não faz parte de um Cardume.';$('profileLikesCount')=profileNumber(profile.likesReceived)+' curtidas';const like=$('likeProfileBtn');like.textContent=profile.likedByMe?'♥ CURTIDO · REMOVER':'♡ CURTIR PERFIL';like.disabled=!authenticated||profile.isSelf;}
 function renderCardumesList(items){const root=$('cardumesList');if(!root)return;root.replaceChildren();if(!Array.isArray(items)||!items.length){const p=document.createElement('p');p.className='rooms-empty';p.textContent='Nenhum Cardume criado ainda. Seja o primeiro a fundar um.';root.appendChild(p);return;}for(const c of items){const card=document.createElement('article');card.className='cardume-card';const copy=document.createElement('div'),name=document.createElement('strong'),desc=document.createElement('p'),meta=document.createElement('small');name.textContent=c.name;desc.textContent=c.description||'Este Cardume ainda não adicionou uma descrição.';meta.textContent='LÍDER '+c.leader+' · '+c.members+'/'+c.capacity+' MERGULHADORES';copy.append(name,desc,meta);const btn=document.createElement('button');btn.type='button';btn.textContent='RECRUTAR-SE';btn.disabled=!authenticated||Boolean(serverAccount?.cardumeId)||c.members>=c.capacity;btn.addEventListener('click',()=>socket?.emit('join-cardume',{id:c.id}));card.append(copy,btn);root.appendChild(card);}}
 function requestCardumes(){if(!socket?.connected){const msg=$('cardumeMessage');if(msg)msg.textContent='Conectando ao servidor…';connect();return;}socket.emit('list-cardumes');const msg=$('cardumeMessage');if(msg)msg.textContent=authenticated?'Explore a lista e entre em um Cardume.':'Entre na sua conta para criar ou entrar em um Cardume.';}
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
function updateAccount(){const status=$('accountStatus');const btn=$('loginBtn');let guest=localStorage.getItem('abyssalGuestNumber');if(!guest){guest=String(1000+Math.floor(Math.random()*9000));localStorage.setItem('abyssalGuestNumber',guest)}if(status)status.textContent=authenticated&&account?`CONECTADO COMO ${account.nickname.toUpperCase()}`:sessionToken&&account?.nickname?(connected?'RESTAURANDO CONTA':'RECONEXÃO PENDENTE'):`VISITANTE #${guest}`;if(btn)btn.textContent=authenticated?'CONTA CONECTADA':sessionToken&&account?.nickname?'RESTAURAR CONTA':'ENTRAR / CRIAR CONTA'}
function openLogin(){$('loginScreen').hidden=false;setMessage(account?`Último nickname: ${account.nickname}. Digite sua senha para entrar.`:'Crie uma conta ou entre com seu nickname e senha.');if(account)$('nicknameInput').value=account.nickname}
function connect(){
 if(socket){if(!socket.connected)socket.connect();return socket;}
 if(typeof window.io!=='function'){setMessage('Não foi possível carregar o cliente online. Verifique sua conexão.',true);return null}
 socket=window.io(SERVER_URL,{transports:['websocket','polling'],reconnection:true,timeout:8000});
 startPositionHeartbeat();
 socket.on('connect',()=>{connected=true;localPlayerId=socket.id;positionSequence=0;latestPositionPayload=null;positionPacketInFlight=false;if(sessionToken&&!authenticated){setMessage('Reconectando sua sessão segura…');socket.emit('resume-session',{token:sessionToken});}else if(account?.nickname&&!authenticated){setMessage(`Conectado. Entre novamente como ${account.nickname} para validar esta sessão.`);}else setMessage(authenticated?`Servidor conectado como ${account?.nickname||'mergulhador'}.`:'Servidor conectado. Entre ou crie uma conta para jogar online.');socket.emit('list-rooms');refreshRoomsHttp();if($('roomsScreen')&&!$('roomsScreen').hidden)startRoomPolling();});
 socket.on('online-count',n=>{const el=$('onlineCount');if(el)el.textContent=String(n)});
  socket.on('cardumes-list',renderCardumesList);socket.on('cardume-details',showCardumeDetail);socket.on('public-profile-result',result=>{if(result?.ok)showPublicProfile(result.profile);else{const msg=$('cardumeMessage');if(msg)msg.textContent=result?.message||'Perfil indisponível.'}});socket.on('profile-like-result',result=>{if(result?.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}));}if(result?.profile)showPublicProfile(result.profile);else if(result?.message){const msg=$('profileMessage');if(msg)msg.textContent=result.message;}});socket.on('profile-likes-updated',data=>{if(serverAccount&&String($('profileNickname')?.textContent||'').toLowerCase()===String(serverAccount.nickname||'').toLowerCase()){$('profileLikesCount').textContent=profileNumber(data?.likesReceived)+' curtidas';if(serverAccount)serverAccount.likesReceived=profileNumber(data?.likesReceived);}});socket.on('cardume-action-result',result=>{const msg=$('cardumeMessage');if(msg)msg.textContent=result?.message||'Operação concluída.';if(result?.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}));}if(result?.ok){socket.emit('list-cardumes');if(result.account?.cardumeId)socket.emit('get-cardume-details');else showCardumeDirectory();}});
  socket.on('global-chat-history',renderGlobalChatHistory);socket.on('global-chat-message',renderGlobalChatMessage);socket.on('global-chat-reset',()=>renderGlobalChatHistory([]));socket.on('global-chat-error',result=>{const hint=$('globalChatHint');if(hint)hint.textContent=result?.message||'Não foi possível enviar a mensagem.'});
  socket.on('connect',()=>setGlobalChatStatus(true));
 socket.on('rooms-list',list=>{socketRoomsCache=Array.isArray(list)?list:[];socketRoomsAt=Date.now();publishMergedRooms()});
 socket.on('boss-warning',data=>window.dispatchEvent(new CustomEvent('abyssal-boss-warning',{detail:data||{}})));
 socket.on('room-created',result=>{window.dispatchEvent(new CustomEvent('abyssal-room-created',{detail:result||{ok:false,message:'Falha ao criar a sala.'}}));if(result?.ok){const pw=pendingRoomPassword;pendingRoomPassword='';joinRoom(result.room?.id,pw)}});
 socket.on('room-join-result',result=>{if(result&&!result.ok)window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:result}))});
 socket.on('room-joined',data=>{if(!data?.ok)return;currentRoom=data.room||null;localPlayerId=socket.id;latestPositionPayload=null;positionPacketInFlight=false;stopRoomPolling();applyPlayerList(data.players||[]);window.dispatchEvent(new CustomEvent('abyssal-room-joined',{detail:data}));setTimeout(()=>socket?.connected&&requestWorldSnapshot('room-join'),180);});
 socket.on('world-left',()=>{currentRoom=null;latestPositionPayload=null;positionPacketInFlight=false;players.clear();window.dispatchEvent(new CustomEvent('abyssal-room-left'))});
 socket.on('legacy-join-world',data=>joinRoom(data?.roomId||'MAR-ABERTO',''));
 socket.on('account-data',data=>{
  if(!authenticated||!data)return;
  serverAccount=data;
  renderProfile(data);
  if($('profileMessage')&&!$('profileScreen').hidden)$('profileMessage').textContent='Perfil sincronizado com sua conta.';
  window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:data}));
 });
 socket.on('purchase-result',result=>{if(result.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}))}window.dispatchEvent(new CustomEvent('abyssal-purchase-result',{detail:result}));});
socket.on('code-redeem-result',result=>{if(result.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}));}window.dispatchEvent(new CustomEvent('abyssal-code-redeem-result',{detail:result}));});
 socket.on('wheel-result',result=>{if(result.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}))}window.dispatchEvent(new CustomEvent('abyssal-wheel-result',{detail:result}));});
 socket.on('world-enemy-damaged',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-damaged',{detail:data||{}}));});
 socket.on('world-enemies-damaged',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-damaged-batch',{detail:Array.isArray(data)?data:[]}));});
 // Server-owned HP/shields are sent reliably. Bridge them to the game UI; without this
 // listener a minimized client could be killed server-side but still look alive on resume.
 socket.on('player-vitals',data=>{window.dispatchEvent(new CustomEvent('abyssal-player-vitals',{detail:data||{}}));});
 socket.on('player-suction-pull',data=>{window.dispatchEvent(new CustomEvent('abyssal-player-suction-pull',{detail:data||{}}));});
 socket.on('world-enemy-defeated',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-defeated',{detail:data}));});
 socket.on('world-enemies-defeated',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-defeated-batch',{detail:Array.isArray(data)?data:[]}));});
 socket.on('world-xp-orb-spawned',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-xp-orb-spawned',{detail:data||{}}));});
 socket.on('world-xp-orbs-spawned',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-xp-orbs-spawned',{detail:Array.isArray(data)?data:[]}));});
 socket.on('world-xp-orbs-expired',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-xp-orbs-expired',{detail:Array.isArray(data)?data:[]}));});
 socket.on('world-xp-orb-collected',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-xp-orb-collected',{detail:data||{}}));});
 socket.on('run-saved',result=>{if(result.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}))}window.dispatchEvent(new CustomEvent('abyssal-run-saved',{detail:result}))});
 socket.on('rankings-data',renderRankings);socket.on('rankings-updated',renderRankings);
 socket.on('connect_error',()=>{connected=false;setMessage('Não conectou ao servidor. Abra o jogo por http://localhost:3000 e confirme que npm start está rodando.',true)});
 socket.on('disconnect',()=>{setGlobalChatStatus(false);connected=false;authenticated=false;players.clear();currentRoom=null;latestPositionPayload=null;positionSequence=0;positionPacketInFlight=false;hostId=null;stopRoomPolling();updateAccount();if(serverAccount)renderProfile(serverAccount);setMessage(sessionToken?'Conexão interrompida. Tentando restaurar sua sessão…':'Conexão perdida. Entre novamente para validar a conta.',true);window.dispatchEvent(new CustomEvent('abyssal-online-disconnected'))});
 socket.on('auth-result',result=>{
  if(!result.ok){authenticated=false;account=null;serverAccount=null;sessionToken='';localStorage.removeItem('abyssalSessionToken');localStorage.removeItem('abyssalAccount');$('profileScreen').hidden=true;updateAccount();renderProfile({});setMessage(result.message||'Falha na autenticação.',true);return}
  authenticated=true;account={nickname:result.nickname};serverAccount=result;
  if(result.sessionToken){sessionToken=result.sessionToken;localStorage.setItem('abyssalSessionToken',sessionToken);}
  localStorage.setItem('abyssalAccount',JSON.stringify(account));$('passwordInput').value='';
  updateAccount();renderProfile(result);
  window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result}));
  setMessage(`Bem-vindo, ${result.nickname}!`);$('loginScreen').hidden=true;refreshKidGate();
  socket.emit('get-account');socket.emit('list-cardumes');window.dispatchEvent(new CustomEvent('abyssal-authenticated'));
 });
 socket.on('session-resumed',result=>{
  if(!result?.ok){sessionToken='';localStorage.removeItem('abyssalSessionToken');authenticated=false;serverAccount=null;$('profileScreen').hidden=true;updateAccount();renderProfile({});if(account?.nickname)setMessage('Sua sessão expirou. Entre novamente para acessar o perfil e o chat.',true);return;}
  authenticated=true;account={nickname:result.nickname};serverAccount=result;
  localStorage.setItem('abyssalAccount',JSON.stringify(account));updateAccount();renderProfile(result);
  setMessage(`Sessão restaurada: ${result.nickname}.`);refreshKidGate();
  socket.emit('get-account');window.dispatchEvent(new CustomEvent('abyssal-authenticated'));
 });
 socket.on('global-chat-sent',result=>{if(!result?.ok)return;const hint=$('globalChatHint');if(hint)hint.textContent='Mensagem transmitida para o abismo.'});
 socket.on('world-host',()=>{}); // Compatibilidade com clientes antigos: nenhum jogador é eleito host.

 socket.on('game-snapshot',data=>{if(window.AbyssalGameHooks?.applySnapshot)window.AbyssalGameHooks.applySnapshot(data);});
 socket.on('world-enemies-spawned',data=>{if(window.AbyssalGameHooks?.applySpawn)window.AbyssalGameHooks.applySpawn(data);});
 socket.on('enemy-contact-source',data=>{if(window.AbyssalGameHooks?.registerContactSnapshot)window.AbyssalGameHooks.registerContactSnapshot(data);});
 socket.on('enemy-motion',data=>{if(window.AbyssalGameHooks?.applyMotion)window.AbyssalGameHooks.applyMotion(data);});
 socket.on('shared-damage',data=>{if(window.AbyssalGameHooks?.sharedDamage)window.AbyssalGameHooks.sharedDamage(data);});
 socket.on('shared-xp-award',data=>{if(window.AbyssalGameHooks?.sharedXp)window.AbyssalGameHooks.sharedXp(data);});
 socket.on('world-players',list=>applyPlayerList(list));
 socket.on('player-motion',rows=>applyPlayerMotion(rows));
 socket.on('run-energy-ranking',ranking=>window.dispatchEvent(new CustomEvent('abyssal-run-energy-ranking',{detail:Array.isArray(ranking)?ranking:[]})));
 socket.on('revive-result',result=>window.dispatchEvent(new CustomEvent('abyssal-revive-result',{detail:result||{ok:false,message:'Não foi possível ressuscitar agora.'}})));
 socket.on('player-joined',p=>{if(p.id!==socket.id)storePlayer(p)});
 socket.on('player-left',id=>players.delete(id));
 socket.on('remote-hit',data=>{if(window.AbyssalGameHooks?.remoteHit)window.AbyssalGameHooks.remoteHit(data)});
 socket.on('shared-shot',data=>{if(data&&data.from!==account?.nickname)window.dispatchEvent(new CustomEvent('abyssal-remote-shot',{detail:data}))});
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
 if(!clean.has('MAR-ABERTO'))clean.set('MAR-ABERTO',{id:'MAR-ABERTO',code:'MAR-ABERTO',name:'Mar Aberto',playerCount:0,capacity:6,isPrivate:false,available:true,fallback:true,joinable:true});
 list=[...clean.values()].sort((a,b)=>a.id==='MAR-ABERTO'?-1:b.id==='MAR-ABERTO'?1:(Number(b.playerCount)||0)-(Number(a.playerCount)||0));
 window.dispatchEvent(new CustomEvent('abyssal-rooms-list',{detail:list}));
}
function refreshRoomsHttp(){
 const requestedAt=Date.now();
 fetch(`/api/rooms?_=${requestedAt}`,{cache:'no-store',headers:{'Cache-Control':'no-cache'}})
  .then(r=>r.ok?r.json():null)
  .then(data=>{if(!data||!Array.isArray(data.rooms))return;const completedAt=Date.now();if(completedAt<socketRoomsAt)return;httpRoomsCache=data.rooms;httpRoomsAt=completedAt;publishMergedRooms()})
  .catch(()=>{});
}
function startRoomPolling(){stopRoomPolling();roomPollTimer=setInterval(()=>{const screen=$('roomsScreen');if(!screen||screen.hidden){stopRoomPolling();return;}if(socket?.connected)socket.emit('list-rooms');refreshRoomsHttp()},3500)}
function stopRoomPolling(){if(roomPollTimer){clearInterval(roomPollTimer);roomPollTimer=null}}
function showRooms(){
 const s=connect();if(!s)return;
 const screen=$('roomsScreen');if(screen)screen.hidden=false;
 const message=$('roomsMessage');if(message)message.textContent='Sondando expedições ativas…';
 refreshRoomsHttp();
 const request=()=>{s.emit('list-rooms');refreshRoomsHttp();startRoomPolling()};if(s.connected)request();else s.once('connect',request);
}
function requestRooms(){if(socket?.connected)socket.emit('list-rooms');refreshRoomsHttp();}
function connectAndJoin(){
 const s=connect();if(!s)return;
 if(authenticated){window.AbyssalOnlinePendingStart=false;showRooms();return;}
 window.AbyssalOnlinePendingStart=true;openLogin();
}
function joinWorld(roomId='MAR-ABERTO',password=''){return joinRoom(roomId,password)}
function joinRoom(roomId='MAR-ABERTO',password=''){
 if(!socket?.connected||!authenticated){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'Conecte-se à sua conta antes de entrar em uma sala.'}}));return false;}
 const id=String(roomId||'MAR-ABERTO').trim().toUpperCase();if(!id){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'Informe o código da sala.'}}));return false;}
 socket.emit('join-room',{roomId:id,password:String(password||''),viewportWidth:window.AbyssalGameHooks?.viewportWidth?.()||window.innerWidth||1200,viewportHeight:window.AbyssalGameHooks?.viewportHeight?.()||window.innerHeight||700,worldWidth:window.AbyssalGameHooks?.worldWidth?.()||window.innerWidth||1200,worldHeight:window.AbyssalGameHooks?.worldHeight?.()||window.innerHeight||700,worldZoom:window.AbyssalGameHooks?.worldZoom?.()||1});return true;
}
function createRoom(data={}){
 if(!socket?.connected||!authenticated){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'Entre na sua conta antes de criar uma sala.'}}));return false;}
 const isPrivate=Boolean(data.isPrivate),password=String(data.password||'');if(isPrivate&&(password.length<4||password.length>64)){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'A senha da sala privada deve ter entre 4 e 64 caracteres.'}}));return false;}
 pendingRoomPassword=isPrivate?password:'';socket.emit('create-room',{name:String(data.name||'Expedição Abissal'),capacity:Number(data.capacity)||6,isPrivate,password});return true;
}
function leaveWorld(){if(socket?.connected&&authenticated)socket.emit('leave-world');players.clear();hostId=null;currentRoom=null;stopRoomPolling();}
function requestHostTransfer(){if(socket?.connected&&authenticated&&hostId===socket.id)socket.emit('request-host-transfer');}
$('loginSubmitBtn').addEventListener('click',()=>authenticate($('nicknameInput').value,$('passwordInput').value,'login'));
$('registerBtn').addEventListener('click',()=>authenticate($('nicknameInput').value,$('passwordInput').value,'register'));
function setAuthFlowMessage(id,message,isError=false){const el=$(id);if(!el)return;el.textContent=message;el.classList.toggle('is-error',Boolean(isError));}
function closePasswordRecovery(){ $('passwordRecoveryScreen').hidden=true; $('recoveryMessage').textContent=''; }
async function kidApi(path, options={}) {
 const headers={Authorization:'Bearer '+sessionToken,...(options.body?{'Content-Type':'application/json'}:{})};
 const response=await fetch('/api/kid/'+path,{...options,headers});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)throw new Error(result.message||'Não foi possível concluir a verificação de idade.');
 return result;
}
function renderKidGate(state) { return; 
 const screen=$('kidAgeGateScreen'),parent=$('kidParentChallenge'),frame=$('kidAgeAssuranceFrame'),check=$('kidCheckChallenge'),submit=$('kidAgeGateSubmit'),message=$('kidAgeGateMessage');
 if(!screen)return;
 screen.hidden=state.status==='passed';
 if(state.status==='passed'){if(frame){frame.hidden=true;frame.removeAttribute('src');}return;}
 if(state.status!=='pending'&&frame){frame.hidden=true;frame.removeAttribute('src');}
 if(state.status==='prohibited'){message.textContent='A configuração de idade do produto não permite criar uma sessão para esta conta.';submit.hidden=true;return;}
 submit.hidden=state.status==='pending';
 parent.hidden=state.status!=='pending'||state.challengeType!=='CHALLENGE_PARENTAL_CONSENT';
 check.hidden=state.status!=='pending';
 if(state.status==='pending'&&state.challengeUrl){
  try{
   const url=new URL(state.challengeUrl);
   if(!['https:'].includes(url.protocol)||!(url.hostname==='k-id.com'||url.hostname.endsWith('.k-id.com')))throw new Error('invalid challenge url');
   if(state.challengeType==='CHALLENGE_AGE_GATE_AGE_ASSURANCE'){frame.src=url.href;frame.hidden=false;}else{frame.hidden=true;frame.removeAttribute('src');}
   $('kidChallengeLink').href=url.href;
  }catch{frame.hidden=true;frame.removeAttribute('src');$('kidChallengeLink').href='https://asktoplay.com';}
 }
 $('kidChallengeCode').textContent=state.oneTimePassword?'Código para o responsável: '+state.oneTimePassword:'';
}
let kidPermissionRefreshBusy=false;
async function refreshKidGate() { return; 
 if(!authenticated||!sessionToken)return;
 const screen=$('kidAgeGateScreen'),message=$('kidAgeGateMessage');
 try{
  const state=await kidApi('status');
  if(state.status==='passed'){
   const session=await kidApi('session');
   renderKidGate(session);window.dispatchEvent(new CustomEvent('abyssal-kid-permissions',{detail:session.permissions||[]}));
  }else{renderKidGate(state);if(screen)screen.hidden=false;}
 }catch(error){
  if(screen){screen.hidden=false;message.textContent=error.message||'Não foi possível validar sua idade.';}
 }
}
$('kidAgeGateSubmit')?.addEventListener('click',async()=>{
 const button=$('kidAgeGateSubmit'),message=$('kidAgeGateMessage'),dateOfBirth=$('kidDateOfBirth').value;
 if(!dateOfBirth){message.textContent='Informe sua data de nascimento.';return;}
 button.disabled=true;message.textContent='Verificando com segurança…';
 try{const state=await kidApi('check',{method:'POST',body:JSON.stringify({dateOfBirth})});message.textContent=state.status==='passed'?'Idade confirmada.':state.status==='pending'?'Aguardando autorização ou verificação.':state.status==='prohibited'?'Não foi possível liberar o acesso para esta idade.':'';renderKidGate(state);if(state.status==='passed')await refreshKidGate();}
 catch(error){message.textContent=error.message;}finally{button.disabled=false;}
});
$('kidSendParentEmail')?.addEventListener('click',async()=>{
 const button=$('kidSendParentEmail'),message=$('kidAgeGateMessage'),email=$('kidParentEmail').value.trim();
 button.disabled=true;message.textContent='Enviando convite…';
 try{await kidApi('challenge-email',{method:'POST',body:JSON.stringify({email})});message.textContent='Convite enviado ao responsável.';}
 catch(error){message.textContent=error.message;}finally{button.disabled=false;}
});
$('kidCheckChallenge')?.addEventListener('click',async()=>{
 const button=$('kidCheckChallenge'),message=$('kidAgeGateMessage');
 button.disabled=true;message.textContent='Consultando autorização…';
 try{const state=await kidApi('challenge-status',{method:'POST',body:JSON.stringify({})});renderKidGate(state);message.textContent=state.status==='passed'?'Autorização confirmada.':state.status==='prohibited'?'A autorização não foi concedida.':'A autorização ainda está pendente.';if(state.status==='passed')await refreshKidGate();}
 catch(error){message.textContent=error.message;}finally{button.disabled=false;}
});


$('supportBtn')?.addEventListener('click',()=>{$('menuScreen').hidden=true;$('supportScreen').hidden=false;$('supportMessageStatus').textContent='';$('supportEmailInput').focus();});
$('supportCancelBtn')?.addEventListener('click',()=>{$('supportScreen').hidden=true;$('menuScreen').hidden=false;});
$('sendSupportBtn')?.addEventListener('click',async()=>{const name=String($('supportNameInput').value||'').trim(),email=String($('supportEmailInput').value||'').trim(),subject=String($('supportSubjectInput').value||''),message=String($('supportMessageInput').value||'').trim(),website=String($('supportWebsiteInput').value||'');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setAuthFlowMessage('supportMessageStatus','Informe um e-mail válido para podermos responder.',true);$('supportEmailInput').focus();return}if(message.length<10){setAuthFlowMessage('supportMessageStatus','Conte um pouco mais: a mensagem precisa ter pelo menos 10 caracteres.',true);$('supportMessageInput').focus();return}const button=$('sendSupportBtn');button.disabled=true;setAuthFlowMessage('supportMessageStatus','Transmitindo mensagem…');try{const response=await fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,subject,message,website})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.message||'Não foi possível enviar sua mensagem.');setAuthFlowMessage('supportMessageStatus','Mensagem enviada! Nossa equipe recebeu seu contato.');$('supportNameInput').value='';$('supportEmailInput').value='';$('supportMessageInput').value='';$('supportWebsiteInput').value='';}catch(error){setAuthFlowMessage('supportMessageStatus',error.message||'Falha no envio. Tente novamente mais tarde.',true)}finally{button.disabled=false}});
$('forgotPasswordBtn')?.addEventListener('click',()=>{$('loginScreen').hidden=true;$('passwordResetScreen').hidden=true;$('passwordRecoveryScreen').hidden=false;$('recoveryEmailInput').value=String($('emailInput').value||'').trim();setAuthFlowMessage('recoveryMessage','');$('recoveryEmailInput').focus();});
$('recoveryCancelBtn')?.addEventListener('click',()=>{closePasswordRecovery();$('loginScreen').hidden=false;});
$('requestPasswordResetBtn')?.addEventListener('click',async()=>{const email=String($('recoveryEmailInput').value||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setAuthFlowMessage('recoveryMessage','Informe um e-mail válido.',true);$('recoveryEmailInput').focus();return}const button=$('requestPasswordResetBtn');button.disabled=true;setAuthFlowMessage('recoveryMessage','Enviando solicitação…');try{const response=await fetch('/api/account/password-reset/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const result=await response.json();setAuthFlowMessage('recoveryMessage',result.message||'Se a conta tiver um e-mail de recuperação, enviaremos as instruções.');}catch{setAuthFlowMessage('recoveryMessage','Não foi possível solicitar agora. Tente novamente.',true)}finally{button.disabled=false}});
$('completePasswordResetBtn')?.addEventListener('click',async()=>{const token=new URLSearchParams(location.hash.slice(1)).get('passwordResetToken')||'',password=String($('newPasswordInput').value||''),confirmation=String($('confirmNewPasswordInput').value||'');if(password.length<8||password.length>128){setAuthFlowMessage('resetMessage','A senha deve ter de 8 a 128 caracteres.',true);$('newPasswordInput').focus();return}if(password!==confirmation){setAuthFlowMessage('resetMessage','As senhas não coincidem. Confira os dois campos.',true);$('confirmNewPasswordInput').focus();return}const button=$('completePasswordResetBtn');button.disabled=true;setAuthFlowMessage('resetMessage','Atualizando sua senha…');try{const response=await fetch('/api/account/password-reset/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});const result=await response.json();setAuthFlowMessage('resetMessage',result.message||'Link inválido ou expirado.',!result.ok);if(result.ok){history.replaceState(null,'',location.pathname);$('passwordResetScreen').hidden=true;$('loginScreen').hidden=false;$('passwordInput').value='';$('newPasswordInput').value='';$('confirmNewPasswordInput').value='';setMessage('Senha atualizada com sucesso. Entre com sua nova senha.');}}catch{setAuthFlowMessage('resetMessage','Não foi possível atualizar a senha. Tente novamente.',true)}finally{button.disabled=false}});
$('passwordInput').addEventListener('keydown',e=>{if(e.key==='Enter')authenticate($('nicknameInput').value,$('passwordInput').value,'login')});
$('nicknameInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('passwordInput').focus()});
function buildPositionPayload(player){const motion=window.AbyssalGameHooks?.motionDiagnostics?.()||{};return {x:Number(player.x),y:Number(player.y),angle:Number(player.angle)||0,viewportWidth:window.AbyssalGameHooks?.viewportWidth?.()||window.innerWidth||1200,viewportHeight:window.AbyssalGameHooks?.viewportHeight?.()||window.innerHeight||700,worldWidth:window.AbyssalGameHooks?.worldWidth?.()||4800,worldHeight:window.AbyssalGameHooks?.worldHeight?.()||3000,worldZoom:window.AbyssalGameHooks?.worldZoom?.()||.78,color:window.AbyssalGameHooks?.skinColor?.()||'#bd91ff',skinId:window.AbyssalGameHooks?.skinId?.()||'default',clientEnemyCount:motion.enemyCount||0,clientMovingEnemies:motion.movingEnemies||0,clientPredicting:Boolean(motion.predictingLocally),clientGameState:String(motion.gameState||'unknown'),clientHidden:Boolean(document.hidden)};}
function sendPosition(player){if(!player)return;const payload=buildPositionPayload(player);if(Number.isFinite(payload.x)&&Number.isFinite(payload.y))latestPositionPayload=payload;}
function startPositionHeartbeat(){
 if(positionHeartbeatTimer)return;
 positionHeartbeatTimer=setInterval(()=>{
  if(!socket?.connected||!authenticated||!currentRoom)return;
  // Always sample the live game object before sending. Position packets are ephemeral:
  // if one is dropped, the next tick supersedes it instead of waiting behind an ACK.
  const live=window.AbyssalGameHooks?.getPlayerPosition?.();
  if(live&&Number.isFinite(Number(live.x))&&Number.isFinite(Number(live.y)))latestPositionPayload=buildPositionPayload(live);
  if(!latestPositionPayload)return;
  const now=performance.now();if(now-lastPositionAt<60)return;
  const payload={...latestPositionPayload,seq:++positionSequence,clientSentAt:Date.now()};
  lastPositionAt=now;positionPacketsSent++;positionPacketInFlight=false;
  socket.volatile.emit('player-position',payload,(result)=>{
   // This ACK is diagnostic only. A dropped packet must never block the next position.
   if(result?.ok){positionAckAt=Date.now();positionAckErrors=0;}
   else{positionAckErrors++;if(positionAckErrors===3)window.dispatchEvent(new CustomEvent('abyssal-position-stream-warning',{detail:{errors:positionAckErrors,ageMs:positionAckAt?Date.now()-positionAckAt:null}}));}
  });
 },80);
}
function getPositionDiagnostics(){return {lastAckAt:positionAckAt,ackAgeMs:positionAckAt?Date.now()-positionAckAt:null,ackErrors:positionAckErrors,inFlight:positionPacketInFlight,sequence:positionSequence,packetsSent:positionPacketsSent};}
function sendHit(x,y,damage){if(socket?.connected&&authenticated)socket.emit('player-hit',{x,y,damage})}
function sendDamage(id,damage,skillId=null){if(!socket?.connected||!authenticated||!currentRoom)return false;const numericId=Number(id),amount=Number(damage);if(!Number.isSafeInteger(numericId)||!Number.isFinite(amount)||amount<=0)return false;socket.emit('shared-damage',{id:numericId,damage:Math.min(1000,amount),skillId:String(skillId||'').slice(0,32)});return true;}
function sendDamageBatch(hits){
 if(!socket?.connected||!authenticated||!currentRoom||!Array.isArray(hits))return false;
 const valid=hits.slice(0,128).map(hit=>({id:Number(hit?.id),damage:Number(hit?.damage),skillId:String(hit?.skillId||'').slice(0,32)})).filter(hit=>Number.isSafeInteger(hit.id)&&Number.isFinite(hit.damage)&&hit.damage>0);
 if(!valid.length)return false;
 socket.emit('shared-damage-batch',{hits:valid});return true;
}
function sendShot(shot){if(!socket?.connected||!authenticated||!shot)return;socket.emit('shared-shot',{...shot,at:Date.now()})}
function sendSnapshot(data){if(socket?.connected&&authenticated&&hostId===socket.id)socket.emit('game-snapshot',data)}
function shareXp(value,source='enemy'){if(socket?.connected&&authenticated&&hostId===socket.id)socket.emit('shared-xp-award',{value,source})}
function beginRun(){if(socket?.connected&&authenticated)socket.emit('begin-run')}
function sendBuild(data={}){if(socket?.connected&&authenticated)socket.emit('player-build',{shieldCharges:Number(data.shieldCharges)||0,regenLevel:Number(data.regenLevel)||0,magnetStrength:Math.max(1,Math.min(4.5,Number(data.magnetStrength)||1))})}
function sendProtection(seconds,reason='gameplay'){if(socket?.connected&&authenticated)socket.emit('player-protection',{seconds:Number(seconds)||0,reason})}
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
function loadRankings(){if(socket?.connected)socket.emit('get-rankings');else fetch('/api/rankings').then(r=>r.json()).then(renderRankings).catch(()=>{});}
function purchaseSkin(id){if(socket?.connected&&authenticated)socket.emit('purchase-skin',{id});else window.dispatchEvent(new CustomEvent('abyssal-purchase-result',{detail:{ok:false,message:'Entre na sua conta para comprar skins e salvar a compra nela.'}}));}

let ageAssuranceBusy=false;
async function refreshAgeAssuranceStatus(){return refreshKidGate();}
async function startAgeAssurance(){
 if(!authenticated||!sessionToken){openLogin();return;}
 $('kidAgeGateScreen').hidden=false;
 await refreshKidGate();
}

async function purchaseStripe(productId,currency,language='pt'){
 if(!authenticated||!sessionToken){window.dispatchEvent(new CustomEvent('abyssal-payment-result',{detail:{ok:false,message:'Entre na sua conta antes de comprar.'}}));openLogin();return;}
 try{
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+sessionToken};
  const response=await fetch(SERVER_URL+'/api/payments/checkout',{method:'POST',headers,body:JSON.stringify({productId,currency:'brl',language})});
  const result=await response.json();if(!response.ok)throw new Error(result.message||'Checkout indisponível.');
  window.location.assign(result.url);
 }catch(error){window.dispatchEvent(new CustomEvent('abyssal-payment-result',{detail:{ok:false,message:error.message}}));}
}
function purchaseMeta(id){if(socket?.connected&&authenticated)socket.emit('purchase-meta',{id});else window.dispatchEvent(new CustomEvent('abyssal-purchase-result',{detail:{ok:false,message:'Entre na sua conta para salvar melhorias persistentes.'}}));}
function redeemCode(code){if(socket?.connected&&authenticated)socket.emit('redeem-code',{code});else window.dispatchEvent(new CustomEvent('abyssal-code-redeem-result',{detail:{ok:false,message:'Entre na sua conta para resgatar essências na conta.'}}));}
function spinWheel(){if(socket?.connected&&authenticated)socket.emit('spin-wheel');else window.dispatchEvent(new CustomEvent('abyssal-wheel-result',{detail:{ok:false,message:'Entre em uma conta para receber moedas pela roleta.'}}));}
function saveCosmetics(data){if(socket?.connected&&authenticated)socket.emit('save-cosmetics',data)}
 function equipTitle(id){if(socket?.connected&&authenticated)socket.emit('equip-title',{id});else{const m=$('profileMessage');if(m)m.textContent='Entre na sua conta para equipar e salvar títulos.'}}
 function refreshAccount(){if(socket?.connected&&authenticated)socket.emit('get-account')}
function renderRankings(data){const root=$('rankingContent');if(!root||!data)return;const sections=[['eternal','HALL ETERNO','Marca histórica: quantidade de bosses derrotados por mergulho.'],['monthly','RANKING MENSAL','Top 10 do mês recebe 5.000 moedas ao fechar o período.'],['weekly','RANKING SEMANAL','Top 10 da semana recebe 1.000 moedas ao fechar o período.'],['daily','RANKING DIÁRIO','Top 10 do dia recebe 100 moedas ao fechar o período.']];root.innerHTML=sections.map(([key,title,note])=>{const list=data[key]||[];return `<section class="ranking-section"><h3>${title}</h3>${list.length?list.map((p,i)=>`<div class="ranking-row"><span class="rank-place">#${i+1}</span><span class="rank-name">${escapeHtml(p.nickname||'Mergulhador')}</span><span class="rank-time">${Number(p.bossesKilled)||0} BOSS${Number(p.bossesKilled)===1?'':'ES'} · ${Math.round(Number(p.score??p.damage)||0).toLocaleString('pt-BR')} DANO</span></div>`).join(''):'<div class="ranking-row"><span class="rank-place">—</span><span class="rank-name">Nenhum mergulho registrado</span><span class="rank-time">0 BOSSES</span></div>'}<p class="ranking-note">${note} Desempate: maior dano causado durante a partida e tempo de mergulho.</p></section>`}).join('')}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function getInterpolatedPeer(p,now=performance.now()){
 const duration=Math.max(1,Number(p.interpDuration)||1),t=Math.max(0,Math.min(1,(now-(Number(p.interpAt)||now))/duration));
 return {...p,x:Number(p.fromX)+(Number(p.targetX)-Number(p.fromX))*t,y:Number(p.fromY)+(Number(p.targetY)-Number(p.fromY))*t};
}
function storePlayer(incoming){
 if(!incoming||!incoming.id||incoming.id===localPlayerId)return;
 const now=performance.now(),old=players.get(incoming.id),rendered=old?getInterpolatedPeer(old,now):null;
 const x=Number.isFinite(Number(incoming.x))?Number(incoming.x):(window.AbyssalGameHooks?.worldWidth?.()||4800)*.5,y=Number.isFinite(Number(incoming.y))?Number(incoming.y):(window.AbyssalGameHooks?.worldHeight?.()||3000)*.5;
 players.set(incoming.id,{...(old||{}),...incoming,fromX:rendered?rendered.x:x,fromY:rendered?rendered.y:y,targetX:x,targetY:y,interpAt:now,interpDuration:135});
}
function applyPlayerList(list){
 const keep=new Set();(Array.isArray(list)?list:[]).forEach(p=>{if(p?.id&&p.id!==localPlayerId){keep.add(p.id);storePlayer(p)}});
 for(const id of players.keys())if(!keep.has(id))players.delete(id);
}
function applyPlayerMotion(rows){
 if(!Array.isArray(rows))return;
 for(const row of rows){
  if(!Array.isArray(row)||row.length<6)continue;
  const id=String(row[0]??'');if(!id||id===localPlayerId)continue;
  storePlayer({id,x:Number(row[1]),y:Number(row[2]),angle:Number(row[3])||0,color:row[4],skinId:row[5]});
 }
}
function getPlayers(){return [...players.values()].map(p=>getInterpolatedPeer(p));}

updateAccount();
function revivePlayer(){if(socket?.connected&&authenticated)socket.emit('revive-player');else window.dispatchEvent(new CustomEvent('abyssal-revive-result',{detail:{ok:false,message:'Conecte-se à sua conta para continuar este mergulho online.'}}));}
 window.AbyssalOnline={openLogin,showRooms,requestRooms,createRoom,joinRoom,connectAndJoin,connect,authenticate,joinWorld,leaveWorld,sendPosition,sendHit,getPlayers,isAuthenticated:()=>authenticated,isConnected:()=>connected,isHost:()=>false,currentRoom:()=>currentRoom,positionDiagnostics:getPositionDiagnostics,sendDamage,sendDamageBatch,sendShot,sendSnapshot:()=>{},requestHostTransfer:()=>{},shareXp:()=>{},beginRun,revivePlayer,sendBuild,sendProtection,requestPlayerState,requestWorldSnapshot,sendRunProgress,finishRun,submitRun,loadRankings,renderRankings,purchaseSkin,purchaseStripe,startAgeAssurance,refreshAgeAssuranceStatus,purchaseMeta,redeemCode,spinWheel,saveCosmetics,equipTitle,refreshAccount,openProfile,sendGlobalChatMessage,getAccount:()=>serverAccount};
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
 if(!hidden)requestPlayerState('resume-resync');
});
window.addEventListener('focus',()=>requestPlayerState());
window.addEventListener('abyssal-rankings-refreshed',ev=>renderRankings(ev.detail));

 window.addEventListener('abyssal-age-assurance-status',event=>{
  const status=$('ageAssuranceStatus'),button=$('ageAssuranceButton'),detail=event.detail||{};
  const messages={
   verified:'Idade 18+ confirmada pela Stripe em modo de teste. / Age 18+ verified in test mode.',
   underage:'A verificação confirmou idade inferior a 18 anos. Compras bloqueadas. / Under 18 confirmed. Purchases blocked.',
   needs_setup:'A verificação precisa ser concluída na Stripe antes de liberar a loja.',
   needs_review:'Não foi possível confirmar a maioridade. Inicie uma nova verificação ou contate o suporte.',
   processing:'A Stripe ainda está processando seus documentos. Esta tela atualizará o resultado ao consultar novamente.',
   requires_input:'A Stripe precisa de novas informações. Inicie uma nova tentativa de verificação.',
   canceled:'A tentativa anterior foi cancelada. Você pode iniciar uma nova verificação.',
   not_started:'Nenhuma verificação iniciada.',
   pending:'Verificação pendente. / Verification pending.'
  };
  if(status)status.textContent=detail.message||messages[detail.status]||messages.pending;
  if(button)button.disabled=detail.status==='verified'||detail.status==='underage'||ageAssuranceBusy;
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
  button.textContent=active?'⤢':'⛶';
  button.title=active?'Sair da tela cheia (Esc)':'Ativar tela cheia';
  button.setAttribute('aria-label',active?'Sair da tela cheia':'Ativar tela cheia');
 }
 document.addEventListener('fullscreenchange',updateFullscreenButton);
 document.addEventListener('webkitfullscreenchange',updateFullscreenButton);
 $('downloadBtn')?.addEventListener('click',()=>{$('downloadScreen').hidden=false;});
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
 $('profileBtn')?.addEventListener('click',openProfile);$('profileCloseBtn')?.addEventListener('click',()=>{$('profileScreen').hidden=true;viewedPublicProfile=null;$('accountDeletePanel').hidden=false;$('publicProfileActions').hidden=true});$('likeProfileBtn')?.addEventListener('click',()=>{if(viewedPublicProfile&&authenticated)socket?.emit('toggle-profile-like',{nickname:viewedPublicProfile});else openLogin()});
 document.addEventListener('click',ev=>{const button=ev.target.closest('[data-equip-title]');if(!button)return;equipTitle(button.dataset.equipTitle)});
 $('globalChatForm')?.addEventListener('submit',ev=>{ev.preventDefault();const input=$('globalChatInput');if(!input)return;const text=input.value.trim();if(!text)return;if(sendGlobalChatMessage(text)){input.value='';const hint=$('globalChatHint');if(hint)hint.textContent='Enviando mensagem…'}});
 $('globalChatInput')?.addEventListener('focus',()=>{if(!authenticated){const hint=$('globalChatHint');if(hint)hint.textContent='Entre na sua conta para transmitir mensagens.'}});
 const chatPanel=$('globalChatPanel');
 if(chatPanel)chatPanel.classList.remove('chat-expanded');
 if(!socket)connect();
 
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
 window.addEventListener('abyssal-account-data',ev=>renderProfile(ev.detail));
})();
