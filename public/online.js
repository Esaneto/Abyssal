(() => {
'use strict';
const $=id=>document.getElementById(id);
let socket=null,authenticated=false,connected=false,localPlayerId=null,players=new Map(),lastPositionAt=0,hostId=null,currentRoom=null,pendingRoomPassword='';
let account=JSON.parse(localStorage.getItem('abyssalAccount')||'null'),serverAccount=null;
const SERVER_URL=window.ABYSSAL_SERVER_URL||window.location.origin;
function setMessage(message,error=false){const el=$('loginMessage');if(el){el.textContent=message;el.style.color=error?'#ff91a5':'#9ef3de'}}
function updateAccount(){const status=$('accountStatus');const btn=$('loginBtn');let guest=localStorage.getItem('abyssalGuestNumber');if(!guest){guest=String(1000+Math.floor(Math.random()*9000));localStorage.setItem('abyssalGuestNumber',guest)}if(status)status.textContent=authenticated&&account?`CONECTADO COMO ${account.nickname.toUpperCase()}`:`VISITANTE #${guest}`;if(btn)btn.textContent=authenticated?'CONTA CONECTADA':'ENTRAR / CRIAR CONTA'}
function openLogin(){$('loginScreen').hidden=false;setMessage(account?`Último nickname: ${account.nickname}. Digite sua senha para entrar.`:'Crie uma conta ou entre com seu nickname e senha.');if(account)$('nicknameInput').value=account.nickname}
function connect(){
 if(socket?.connected)return socket;
 if(typeof window.io!=='function'){setMessage('Não foi possível carregar o cliente online. Verifique sua conexão.',true);return null}
 socket=window.io(SERVER_URL,{transports:['websocket','polling'],reconnection:true,timeout:8000});
 socket.on('connect',()=>{connected=true;localPlayerId=socket.id;if(account?.nickname)setMessage(`Servidor conectado. Entre com ${account.nickname}.`);else setMessage('Servidor conectado. Entre ou crie uma conta para jogar online.');});
 socket.on('online-count',n=>{const el=$('onlineCount');if(el)el.textContent=String(n)});
 socket.on('rooms-list',list=>window.dispatchEvent(new CustomEvent('abyssal-rooms-list',{detail:Array.isArray(list)?list:[]})));
 socket.on('room-created',result=>{window.dispatchEvent(new CustomEvent('abyssal-room-created',{detail:result||{ok:false,message:'Falha ao criar a sala.'}}));if(result?.ok){const pw=pendingRoomPassword;pendingRoomPassword='';joinRoom(result.room?.id,pw)}});
 socket.on('room-join-result',result=>{if(result&&!result.ok)window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:result}))});
 socket.on('room-joined',data=>{if(!data?.ok)return;currentRoom=data.room||null;localPlayerId=socket.id;applyPlayerList(data.players||[]);window.dispatchEvent(new CustomEvent('abyssal-room-joined',{detail:data}));});
 socket.on('world-left',()=>{currentRoom=null;players.clear();window.dispatchEvent(new CustomEvent('abyssal-room-left'))});
 socket.on('legacy-join-world',data=>joinRoom(data?.roomId||'MAR-ABERTO',''));
 socket.on('account-data',data=>{serverAccount=data;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:data}));});
 socket.on('purchase-result',result=>{if(result.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}))}window.dispatchEvent(new CustomEvent('abyssal-purchase-result',{detail:result}));});
 socket.on('wheel-result',result=>{if(result.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}))}window.dispatchEvent(new CustomEvent('abyssal-wheel-result',{detail:result}));});
 socket.on('world-enemy-defeated',data=>{window.dispatchEvent(new CustomEvent('abyssal-world-defeated',{detail:data}));});
 socket.on('run-saved',result=>{if(result.account){serverAccount=result.account;window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result.account}))}window.dispatchEvent(new CustomEvent('abyssal-run-saved',{detail:result}))});
 socket.on('rankings-data',renderRankings);socket.on('rankings-updated',renderRankings);
 socket.on('connect_error',()=>{connected=false;setMessage('Não conectou ao servidor. Abra o jogo por http://localhost:3000 e confirme que npm start está rodando.',true)});
 socket.on('disconnect',()=>{connected=false;players.clear();setMessage('Conexão perdida. Tentando reconectar…',true)});
 socket.on('auth-result',result=>{if(!result.ok){authenticated=false;account=null;localStorage.removeItem('abyssalAccount');updateAccount();setMessage(result.message||'Falha na autenticação.',true);return}authenticated=true;account={nickname:result.nickname};serverAccount=result;localStorage.setItem('abyssalAccount',JSON.stringify(account));$('passwordInput').value='';updateAccount();window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:result}));setMessage(`Bem-vindo, ${result.nickname}!`);$('loginScreen').hidden=true;socket.emit('get-account');window.dispatchEvent(new CustomEvent('abyssal-authenticated'));});
 socket.on('world-host',()=>{}); // Compatibilidade com clientes antigos: nenhum jogador é eleito host.

 socket.on('game-snapshot',data=>{if(window.AbyssalGameHooks?.applySnapshot)window.AbyssalGameHooks.applySnapshot(data);});
 socket.on('shared-damage',data=>{if(window.AbyssalGameHooks?.sharedDamage)window.AbyssalGameHooks.sharedDamage(data);});
 socket.on('shared-xp-award',data=>{if(window.AbyssalGameHooks?.sharedXp)window.AbyssalGameHooks.sharedXp(data);});
 socket.on('world-players',list=>applyPlayerList(list));
 socket.on('player-joined',p=>{if(p.id!==socket.id)storePlayer(p)});
 socket.on('player-left',id=>players.delete(id));
 socket.on('remote-hit',data=>{if(window.AbyssalGameHooks?.remoteHit)window.AbyssalGameHooks.remoteHit(data)});
 socket.on('shared-shot',data=>{if(data&&data.from!==account?.nickname)window.dispatchEvent(new CustomEvent('abyssal-remote-shot',{detail:data}))});
 socket.on('server-message',m=>{if(window.AbyssalGameHooks?.toast)window.AbyssalGameHooks.toast(m)});
 return socket;
}
function authenticate(nickname,password,mode='login'){
 const s=connect();if(!s){setMessage('Servidor online indisponível.',true);return}
 nickname=(nickname||'').trim();password=password||'';
 if(!/^[a-zA-Z0-9_]{3,18}$/.test(nickname)){setMessage('Nickname: 3–18 caracteres, letras, números ou _.',true);return}
 if(password.length<8){setMessage('A senha precisa ter pelo menos 8 caracteres.',true);return}
 setMessage(mode==='register'?'Criando conta…':'Verificando acesso…');
 const send=()=>s.emit('authenticate',{nickname,password,mode});
 if(s.connected)send();else {s.once('connect',send);setTimeout(()=>{if(!s.connected)setMessage('O servidor não respondeu. Execute npm start na pasta do projeto.',true)},9000)}
}
function showRooms(){
 const s=connect();if(!s)return;
 const screen=$('roomsScreen');if(screen)screen.hidden=false;
 const message=$('roomsMessage');if(message)message.textContent='Carregando salas disponíveis…';
 const request=()=>s.emit('list-rooms');if(s.connected)request();else s.once('connect',request);
}
function requestRooms(){if(!socket?.connected)return;socket.emit('list-rooms')}
function connectAndJoin(){
 const s=connect();if(!s)return;
 if(authenticated){window.AbyssalOnlinePendingStart=false;showRooms();return;}
 window.AbyssalOnlinePendingStart=true;openLogin();
}
function joinWorld(roomId='MAR-ABERTO',password=''){return joinRoom(roomId,password)}
function joinRoom(roomId='MAR-ABERTO',password=''){
 if(!socket?.connected||!authenticated){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'Conecte-se à sua conta antes de entrar em uma sala.'}}));return false;}
 const id=String(roomId||'MAR-ABERTO').trim().toUpperCase();if(!id){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'Informe o código da sala.'}}));return false;}
 socket.emit('join-room',{roomId:id,password:String(password||''),viewportWidth:window.AbyssalGameHooks?.viewportWidth?.()||window.innerWidth||1200,viewportHeight:window.AbyssalGameHooks?.viewportHeight?.()||window.innerHeight||700});return true;
}
function createRoom(data={}){
 if(!socket?.connected||!authenticated){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'Entre na sua conta antes de criar uma sala.'}}));return false;}
 const isPrivate=Boolean(data.isPrivate),password=String(data.password||'');if(isPrivate&&(password.length<4||password.length>64)){window.dispatchEvent(new CustomEvent('abyssal-room-action-error',{detail:{message:'A senha da sala privada deve ter entre 4 e 64 caracteres.'}}));return false;}
 pendingRoomPassword=isPrivate?password:'';socket.emit('create-room',{name:String(data.name||'Expedição Abissal'),capacity:Number(data.capacity)||6,isPrivate,password});return true;
}
function leaveWorld(){if(socket?.connected&&authenticated)socket.emit('leave-world');players.clear();hostId=null;currentRoom=null;}
function requestHostTransfer(){if(socket?.connected&&authenticated&&hostId===socket.id)socket.emit('request-host-transfer');}
$('loginSubmitBtn').addEventListener('click',()=>authenticate($('nicknameInput').value,$('passwordInput').value,'login'));
$('registerBtn').addEventListener('click',()=>authenticate($('nicknameInput').value,$('passwordInput').value,'register'));
$('passwordInput').addEventListener('keydown',e=>{if(e.key==='Enter')authenticate($('nicknameInput').value,$('passwordInput').value,'login')});
$('nicknameInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('passwordInput').focus()});
function sendPosition(player){if(!socket?.connected||!authenticated||!player)return;const now=performance.now();if(now-lastPositionAt<80)return;lastPositionAt=now;socket.volatile.emit('player-position',{x:player.x, y:player.y, angle:player.angle,viewportWidth:window.AbyssalGameHooks?.viewportWidth?.()||window.innerWidth||1200,viewportHeight:window.AbyssalGameHooks?.viewportHeight?.()||window.innerHeight||700,color:window.AbyssalGameHooks?.skinColor?.()||'#bd91ff',skinId:window.AbyssalGameHooks?.skinId?.()||'default'})}
function sendHit(x,y,damage){if(socket?.connected&&authenticated)socket.emit('player-hit',{x,y,damage})}
function sendDamage(id,damage){if(socket?.connected&&authenticated)socket.emit('shared-damage',{id,damage})}
function sendShot(shot){if(!socket?.connected||!authenticated||!shot)return;socket.emit('shared-shot',{...shot,at:Date.now()})}
function sendSnapshot(data){if(socket?.connected&&authenticated&&hostId===socket.id)socket.emit('game-snapshot',data)}
function shareXp(value,source='enemy'){if(socket?.connected&&authenticated&&hostId===socket.id)socket.emit('shared-xp-award',{value,source})}
function submitRun(data){if(socket?.connected&&authenticated)socket.emit('submit-run',data)}
function loadRankings(){if(socket?.connected)socket.emit('get-rankings');else fetch('/api/rankings').then(r=>r.json()).then(renderRankings).catch(()=>{});}
function purchaseSkin(id){if(socket?.connected&&authenticated)socket.emit('purchase-skin',{id});else window.dispatchEvent(new CustomEvent('abyssal-purchase-result',{detail:{ok:false,message:'Entre na sua conta para comprar skins e salvar a compra nela.'}}));}
function purchaseMeta(id){if(socket?.connected&&authenticated)socket.emit('purchase-meta',{id});else window.dispatchEvent(new CustomEvent('abyssal-purchase-result',{detail:{ok:false,message:'Entre na sua conta para salvar melhorias persistentes.'}}));}
function spinWheel(){if(socket?.connected&&authenticated)socket.emit('spin-wheel');else window.dispatchEvent(new CustomEvent('abyssal-wheel-result',{detail:{ok:false,message:'Entre em uma conta para receber moedas pela roleta.'}}));}
function saveCosmetics(data){if(socket?.connected&&authenticated)socket.emit('save-cosmetics',data)}
function renderRankings(data){const root=$('rankingContent');if(!root||!data)return;const sections=[['eternal','GLOBAL ETERNO','Top 10 mensal recebe 5.000 moedas abissais.'],['weekly','RANKING SEMANAL','Top 10 semanal recebe 1.000 moedas abissais.'],['daily','RANKING DIÁRIO','Top 10 diário recebe 100 moedas abissais.']];root.innerHTML=sections.map(([key,title,note])=>{const list=data[key]||[];return `<section class="ranking-section"><h3>${title}</h3>${list.length?list.map((p,i)=>`<div class="ranking-row"><span class="rank-place">#${i+1}</span><span class="rank-name">${escapeHtml(p.nickname||'Mergulhador')}</span><span class="rank-time">${formatTime(p.survival)}</span></div>`).join(''):'<div class="ranking-row"><span class="rank-place">—</span><span class="rank-name">Ainda sem registros</span><span class="rank-time">00:00</span></div>'}<p class="ranking-note">${note}</p></section>`}).join('')}
function formatTime(s){s=Math.max(0,Math.floor(Number(s)||0));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function getInterpolatedPeer(p,now=performance.now()){
 const duration=Math.max(1,Number(p.interpDuration)||1),t=Math.max(0,Math.min(1,(now-(Number(p.interpAt)||now))/duration));
 return {...p,x:Number(p.fromX)+(Number(p.targetX)-Number(p.fromX))*t,y:Number(p.fromY)+(Number(p.targetY)-Number(p.fromY))*t};
}
function storePlayer(incoming){
 if(!incoming||!incoming.id||incoming.id===localPlayerId)return;
 const now=performance.now(),old=players.get(incoming.id),rendered=old?getInterpolatedPeer(old,now):null;
 const x=Number.isFinite(Number(incoming.x))?Number(incoming.x):.5,y=Number.isFinite(Number(incoming.y))?Number(incoming.y):.5;
 players.set(incoming.id,{...(old||{}),...incoming,fromX:rendered?rendered.x:x,fromY:rendered?rendered.y:y,targetX:x,targetY:y,interpAt:now,interpDuration:115});
}
function applyPlayerList(list){
 const keep=new Set();(Array.isArray(list)?list:[]).forEach(p=>{if(p?.id&&p.id!==localPlayerId){keep.add(p.id);storePlayer(p)}});
 for(const id of players.keys())if(!keep.has(id))players.delete(id);
}
function getPlayers(){return [...players.values()].map(p=>getInterpolatedPeer(p));}

updateAccount();
window.AbyssalOnline={openLogin,showRooms,requestRooms,createRoom,joinRoom,connectAndJoin,connect,authenticate,joinWorld,leaveWorld,sendPosition,sendHit,getPlayers,isAuthenticated:()=>authenticated,isConnected:()=>connected,isHost:()=>false,currentRoom:()=>currentRoom,sendDamage,sendShot,sendSnapshot:()=>{},requestHostTransfer:()=>{},shareXp:()=>{},submitRun,loadRankings,purchaseSkin,purchaseMeta,spinWheel,saveCosmetics,getAccount:()=>serverAccount};
})();