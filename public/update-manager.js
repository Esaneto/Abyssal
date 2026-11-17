(function(root){
 'use strict';
 const build=root.ABYSSAL_CLIENT_BUILD||{version:'0.0.0'};
 const server=()=>String(root.ABYSSAL_SERVER_URL||root.ABYSSAL_SERVER_CONFIG?.nativeUrl||root.location.origin||'').replace(/\/+$/,'');
 const native=()=>Boolean(root.AbyssalOffline?.nativeAssets);
 function platform(){
  try{const p=root.Capacitor?.getPlatform?.();if(p==='android')return 'android';}
  catch(_){}
  if(root.AbyssalOffline?.localDesktop&&/Windows/i.test(navigator.userAgent||''))return 'windows';
  if(/Android/i.test(navigator.userAgent||''))return 'android';
  if(/Windows/i.test(navigator.userAgent||''))return 'windows';
  return '';
 }
 function parts(v){return String(v||'0').split('.').map(x=>Math.max(0,parseInt(x,10)||0)).slice(0,3);}
 function cmp(a,b){const aa=parts(a),bb=parts(b);for(let i=0;i<3;i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return d;}return 0;}
 function androidBridge(){return root.Capacitor?.Plugins?.AbyssalUpdater||null;}
 function windowsBridge(){return root.AbyssalNativeUpdater||null;}
 function browserMode(){return !native()&&['https:','http:'].includes(root.location.protocol);}
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function workerBuild(worker){return new Promise(resolve=>{if(!worker||typeof MessageChannel==='undefined')return resolve('');const channel=new MessageChannel();let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();resolve(String(value||''));};const timer=setTimeout(()=>finish(''),500);channel.port1.onmessage=ev=>finish(ev.data?.version);try{worker.postMessage({type:'abyssal-client-build'},[channel.port2]);}catch(_){finish('');}});}
 async function refreshBrowserTo(version){
  const target=String(version||'').trim();if(!target)return false;
  const key='abyssalBrowserReload:'+target;
  try{if(sessionStorage.getItem(key)==='1')return false;}catch(_){}
  root.AbyssalLoadingScreen?.status('ATUALIZANDO ABYSSAL','Nova versão encontrada. Atualizando arquivos do navegador…','update',58);
  let reloaded=false;
  const reload=()=>{
   if(reloaded)return;reloaded=true;
   try{
    const url=new URL(root.location.href);url.searchParams.set('abyssVersion',target);url.searchParams.set('_t',Date.now().toString(36));
    root.location.replace(url.href);
   }catch(_){root.location.reload();}
  };
  try{
   if('serviceWorker' in navigator){
    const reg=await navigator.serviceWorker.getRegistration('/');
    if(reg&&navigator.serviceWorker.controller){
     // Do not navigate while the old worker still owns the page: it serves its
     // old HTML and assets even when the server is already on the new version.
     const requestUpdate=async()=>{await reg.update();};
     await Promise.race([requestUpdate(),delay(5000)]);
     let ready=false;
     for(let attempt=0;attempt<8;attempt++){
      if(cmp(await workerBuild(navigator.serviceWorker.controller),target)>=0){ready=true;break;}
      await delay(250);
     }
     if(!ready){root.AbyssalLoadingScreen?.releaseAfterUpdate?.('Nova versão ainda em preparação.');return false;}
    }
   }
  }catch(error){console.warn('[Abyssal] Falha ao atualizar Service Worker:',error?.message||error);root.AbyssalLoadingScreen?.releaseAfterUpdate?.('Atualização será tentada novamente.');return false;}
  try{sessionStorage.setItem(key,'1');}catch(_){}
  setTimeout(reload,80);return true;
 }
 let browserCheckInFlight=null;
 let pendingNotice='';
 async function checkBrowser(force=false,allowActive=false){
  if(browserCheckInFlight){const result=await browserCheckInFlight;if(!allowActive||result?.reloadStarted||!result?.version||cmp(result.version,build.version)<=0)return result;return checkBrowser(force,true);}
  browserCheckInFlight=checkBrowserInner(force,allowActive);
  try{return await browserCheckInFlight;}finally{browserCheckInFlight=null;}
 }
 async function checkBrowserInner(force=false,allowActive=false){
  if(!browserMode()||navigator.onLine===false)return null;
  try{
   const response=await fetch('/api/browser-version?currentVersion='+encodeURIComponent(build.version||'')+'&t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(5000)});
   if(!response.ok)return null;
   const data=await response.json();if(!data?.ok||!data.version)return data;
   if(cmp(data.version,build.version)>0){
    const blocked=root.AbyssalGameHooks?.browserUpdateBlocked?.()??document.body.classList.contains('game-active');
    if(blocked&&!allowActive){if(pendingNotice!==data.version){pendingNotice=data.version;root.AbyssalGameHooks?.notifyBrowserUpdate?.();}return {...data,reloadStarted:false};}
    root.AbyssalLoadingScreen?.beginUpdate(data.version);
    const reloadStarted=await refreshBrowserTo(data.version);
    return {...data,reloadStarted};
   }else if(force){
    root.AbyssalLoadingScreen?.status('VERSÃO ATUAL','O navegador já está usando a versão mais recente.','boot',92);
    root.AbyssalLoadingScreen?.resolveUpdateGate();
   }
   return data;
  }catch(error){console.warn('[Abyssal] Falha ao verificar atualização web:',error?.message||error);return null;}
 }
 const gameplayBlocked=()=>Boolean(root.AbyssalGameHooks?.browserUpdateBlocked?.()??document.body?.classList.contains('game-active'));
 let installingNative=false,permissionResume=null;
 async function resumeAcceptedAndroidUpdate(){
  const pending=permissionResume;if(!pending||installingNative||document.visibilityState==='hidden'||gameplayBlocked())return;
  if(Date.now()-pending.at>10*60*1000){permissionResume=null;return;}
  try{if(!(await androidBridge()?.canInstallApk?.())?.allowed)return;if(permissionResume!==pending||installingNative)return;permissionResume=null;await installNative(pending.data,pending.status,pending.button);}catch(_){}
 }
 root.addEventListener('focus',resumeAcceptedAndroidUpdate);
 document.addEventListener('visibilitychange',resumeAcceptedAndroidUpdate);
 async function installNative(data,status,button){
  if(installingNative)return {ok:false,busy:true};
  if(gameplayBlocked()){if(status)status.textContent='Encerre o mergulho antes de instalar a atualização.';return {ok:false,gameplayActive:true};}
  installingNative=true;
  const original=button?.textContent||'ATUALIZAR AGORA';
  root.AbyssalLoadingScreen?.beginUpdate(data.latestVersion||'');
  root.AbyssalLoadingScreen?.updateDownload('Baixando e verificando o pacote oficial…',64);
  if(button){button.disabled=true;button.textContent='BAIXANDO ATUALIZAÇÃO…';}
  if(status)status.textContent='Baixando e verificando a atualização. Não feche o Abyssal.';
  let progressListener=null;
  try{
   let result;
   if(data.platform==='play'){
    // A Play update is mandatory only on a NEW launch. Never release the game
    // gate after cancellation or an interrupted immediate update.
    if(button)button.textContent='ABRINDO GOOGLE PLAY…';
    if(status)status.textContent='A Google Play fará a atualização e reiniciará o aplicativo. Seu progresso salvo será preservado.';
    try{
     result=await androidBridge().startPlayUpdate();
    }catch(playError){
     // Play Core can disallow the IMMEDIATE flow for a specific track or
     // installation. Keep the gate, but provide the official listing as a
     // safe fallback instead of trapping the player in a failed flow.
     if(root.Capacitor?.Plugins?.AbyssalStore?.openListing){
      await root.Capacitor.Plugins.AbyssalStore.openListing();
      if(status)status.textContent='Abra a atualização na Google Play e reinicie o Abyssal após instalar.';
      return {ok:false,storeOpened:true};
     }
     throw playError;
    }
    if(status)status.textContent=result?.ok
     ?'Atualização iniciada. Aguarde a Google Play instalar e reiniciar o Abyssal.'
     :'Atualização não concluída. Toque em ATUALIZAR novamente para continuar.';
    return result;
   }
   if(data.platform==='android'&&androidBridge()?.installApk){
    try{progressListener=await androidBridge().addListener?.('updateProgress',p=>{const received=Number(p.received)||0,total=Number(p.total)||0;if(p.phase==='verify'){root.AbyssalLoadingScreen?.updateInstall('Verificando assinatura e integridade do APK…',94);if(status)status.textContent='Verificando assinatura e integridade…';return;}const mb=(received/1048576).toFixed(1),pct=total>0?Math.min(100,Math.round(received/total*100)):0;const msg='Baixando '+mb+' MB'+(total>0?' de '+(total/1048576).toFixed(1)+' MB · '+pct+'%':'');root.AbyssalLoadingScreen?.updateDownload(msg,total>0?Math.min(90,30+pct*.6):64);if(status)status.textContent=msg;});}catch(_){}
    result=await androidBridge().installApk({url:data.url,sha256:data.sha256||'',version:data.latestVersion||''});
    if(result?.permissionRequired){
     permissionResume={data,status,button,at:Date.now()};
     root.AbyssalLoadingScreen?.releaseAfterUpdate('Autorize o Abyssal a instalar atualizações e volte ao jogo.');
     if(status)status.textContent='Autorize o Abyssal a instalar atualizações e volte ao jogo. Após autorizar, volte ao jogo para continuar automaticamente. Se necessário, toque novamente em ATUALIZAR AGORA.';
     return result;
    }
    if(!result?.ok||!result?.launched)throw new Error('android-installer-not-launched');
    permissionResume=null;
    root.AbyssalLoadingScreen?.releaseAfterUpdate('Download concluído. Confirme a instalação na tela do Android.');
    if(status)status.textContent='Download concluído. Confirme a instalação na tela do Android.';
    return result;
   }
   if(data.platform==='windows'&&typeof windowsBridge()?.installUpdate==='function'){
    root.AbyssalLoadingScreen?.updateDownload('Baixando, validando e preparando o instalador do Windows…',68);
    if(status)status.textContent='Baixando, validando e preparando o instalador do Windows…';
    result=await windowsBridge().installUpdate({url:data.url,sha256:data.sha256||'',version:data.latestVersion||''});
    if(!result?.ok||!result?.launched)throw new Error('windows-installer-not-launched');
    root.AbyssalLoadingScreen?.updateInstall('Instalador validado e aberto. O Abyssal será fechado.',96);
    if(status)status.textContent='Instalador aberto. O Abyssal será fechado para concluir a atualização.';
    return result;
   }
   root.AbyssalLoadingScreen?.releaseAfterUpdate('Este build precisa abrir o pacote oficial uma única vez.');
   if(status)status.textContent='Este build ainda não possui o atualizador interno. Abrindo o pacote oficial uma única vez…';
   try{root.open(data.url,'_blank','noopener');}catch(_){root.location.href=data.url;}
   return {ok:false,fallback:true};
  }catch(error){
   console.error('[Abyssal] Falha ao instalar atualização:',error);
   if(data.platform==='play'){
    // Failure cannot expose the outdated version on a mandatory Play launch.
    if(status)status.textContent='Falha ao abrir a atualização da Google Play. Verifique sua conexão e toque novamente em ATUALIZAR.';
   }else{
    root.AbyssalLoadingScreen?.updateError('Não foi possível concluir a atualização. Abrindo a versão instalada.');
    if(status)status.textContent='Não foi possível concluir a atualização. Verifique a conexão e tente novamente.';
   }
   return {ok:false,error:String(error?.message||error||'update-failed')};
  }finally{
   try{await progressListener?.remove?.();}catch(_){}
   installingNative=false;
   if(button?.isConnected){button.disabled=false;button.textContent=original;}
  }
 }
 function modal(data){
  // The player may have started diving while the asynchronous check was running.
  if(gameplayBlocked()||installingNative)return false;
  const existing=document.getElementById('abyssalUpdatePrompt');
  if(existing){existing.remove();}
  const el=document.createElement('section');el.id='abyssalUpdatePrompt';el.className='abyssal-update-prompt';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.dataset.required=data.required?'true':'false';
  const card=document.createElement('div');card.className='abyssal-update-card';
  const kicker=document.createElement('small');kicker.textContent=data.required?'ATUALIZAÇÃO OBRIGATÓRIA':'ATUALIZAÇÃO DISPONÍVEL';
  const title=document.createElement('h2');title.textContent=data.platform==='play'?'ABYSSAL · GOOGLE PLAY':'ABYSSAL '+String(data.latestVersion||'');
  const version=document.createElement('p');version.className='abyssal-update-version';version.textContent=data.platform==='play'?'Versão instalada '+String(build.version||'')+' · nova versão na loja':'Versão instalada '+String(build.version||'')+' → '+String(data.latestVersion||'');
  const notes=document.createElement('p');notes.textContent=data.required&&data.platform==='play'
   ?'Existe uma nova versão na Google Play. Para continuar jogando, atualize o Abyssal. O progresso dos mergulhos anteriores continua salvo.'
   :String(data.releaseNotes||'Nova versão disponível.');
  const actions=document.createElement('div');actions.className='abyssal-update-actions';
  const now=document.createElement('button');now.type='button';now.className='primary-btn';now.dataset.updateNow='';now.textContent=data.platform==='play'?'ATUALIZAR PELA GOOGLE PLAY':'ATUALIZAR AGORA';actions.appendChild(now);
  if(!data.required){
   const later=document.createElement('button');later.type='button';later.className='secondary-btn';later.dataset.updateLater='';later.textContent='DEPOIS';actions.appendChild(later);
   later.addEventListener('click',()=>{if(installingNative)return;permissionResume=null;try{sessionStorage.setItem('abyssalUpdateDeferred',String(data.latestVersion||''));}catch(_){}root.AbyssalLoadingScreen?.releaseAfterUpdate('Atualização adiada. Abrindo a versão instalada.');el.remove();});
  }
  const help=document.createElement('p');help.className='abyssal-update-help';help.textContent=data.platform==='play'?'A Google Play fará a atualização na instalação existente, sem baixar outro aplicativo.':data.platform==='android'
   ?'O Abyssal baixa o APK oficial dentro do aplicativo. O Android pedirá sua confirmação para instalar a atualização.'
   :'O Abyssal baixa e valida o instalador oficial dentro do aplicativo e o abre para concluir a atualização.';
  const status=document.createElement('p');status.className='abyssal-update-help';status.dataset.updateStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  card.append(kicker,title,version,notes,actions,help,status);el.appendChild(card);
  now.addEventListener('click',()=>installNative(data,status,now));
  document.body.appendChild(el);
  return true;
 }
 let nativeCheckInFlight=null;
 let lastNativeCheckAt=0;
 // Once the first Play Store availability check has completed, never promote
 // a newly published update into a blocking prompt during this app session.
 // The next cold launch rechecks and enforces the new version.
 let playLaunchChecked=false,playLaunchData=null;
 async function check(force=false){
  if(!native())return checkInner(force);
  if(nativeCheckInFlight)return nativeCheckInFlight;
  if(installingNative)return null;
  if(!force&&document.getElementById('abyssalUpdatePrompt'))return null;
  if(gameplayBlocked())return null;
  if(!force&&playLaunchChecked&&platform()==='android'&&androidBridge())return playLaunchData;
  if(!force&&Date.now()-lastNativeCheckAt<10000)return null;
  lastNativeCheckAt=Date.now();nativeCheckInFlight=checkInner(force);
  try{return await nativeCheckInFlight;}finally{nativeCheckInFlight=null;}
 }
 async function checkInner(force=false){
  if(!native()){
   const browserResult=await checkBrowser(force);
   root.AbyssalLoadingScreen?.resolveUpdateGate();
   return browserResult;
  }
  const p=platform();
  if(p==='android'&&androidBridge()?.getUpdateChannel){
   try{
    const bridge=androidBridge(),channel=await bridge.getUpdateChannel();
    if(channel?.channel==='play'){
     if(playLaunchChecked&&!force){
      root.AbyssalLoadingScreen?.resolveUpdateGate();
      return playLaunchData;
     }
     const isColdLaunch=!playLaunchChecked;
     playLaunchChecked=true;
     if(navigator.onLine===false){
      root.AbyssalLoadingScreen?.status('MODO OFFLINE','Sem conexão, não foi possível consultar a Google Play. A verificação será feita na próxima abertura.','offline',84);
      root.AbyssalLoadingScreen?.resolveUpdateGate();
      return null;
     }
     // Play Core is the only authority for updates in Play-installed builds.
     // No server version or sideload APK is used to force an upgrade.
     const play=bridge.checkPlayUpdate?await Promise.race([
      bridge.checkPlayUpdate(),
      delay(6500).then(()=>null)
     ]):null;
     if(play?.available){
      const version='play-'+String(play.versionCode||'available');
      const data={ok:true,platform:'play',latestVersion:version,
       required:isColdLaunch,releaseNotes:'Uma nova versão oficial está disponível na Google Play.'};
      playLaunchData=data;
      root.AbyssalLoadingScreen?.resolveUpdateGate();
      if(!gameplayBlocked()&&(isColdLaunch||force))modal(data);
      return data;
     }
     playLaunchData={ok:true,platform:'play',latestVersion:build.version,available:false};
     root.AbyssalLoadingScreen?.resolveUpdateGate();
     return playLaunchData;
    }
   }catch(error){
    // Fail open for unavailable Play services/network; do not lock offline
    // players behind a prompt that cannot perform an installation.
    playLaunchChecked=true;
    console.warn('[Abyssal] Não foi possível consultar Google Play:',error?.message||error);
    root.AbyssalLoadingScreen?.resolveUpdateGate();
    return null;
   }
  }
  if(navigator.onLine===false){
   root.AbyssalLoadingScreen?.status('MODO OFFLINE','Sem internet: usando os arquivos locais. Solo e modos offline continuam disponíveis.','offline',84);
   root.AbyssalLoadingScreen?.resolveUpdateGate();
   return null;
  }
  if(!p){root.AbyssalLoadingScreen?.resolveUpdateGate();return null;}
  const base=server();if(!/^https:\/\//i.test(base)){root.AbyssalLoadingScreen?.resolveUpdateGate();return null;}
  root.AbyssalLoadingScreen?.status('VERIFICANDO ATUALIZAÇÕES','Conexão disponível. Conferindo a versão mais recente…','boot',34);
  try{
   const response=await fetch(base+'/api/client-update?platform='+encodeURIComponent(p)+'&currentVersion='+encodeURIComponent(build.version||''),{cache:'no-store',signal:AbortSignal.timeout(6000)});
   if(!response.ok){
    root.AbyssalLoadingScreen?.status('SERVIDOR INDISPONÍVEL','Abrindo a versão local instalada.','offline',86);
    root.AbyssalLoadingScreen?.resolveUpdateGate();
    return null;
   }
   const data=await response.json();
   if(!data?.ok||data.platform!==p||!/^\d+\.\d+\.\d+$/.test(String(data.latestVersion||'')))throw new Error('invalid-update-metadata');
   if(cmp(data.latestVersion,build.version)<=0){
    root.AbyssalLoadingScreen?.status('VERSÃO ATUAL','Nenhuma atualização necessária.','boot',88);
    root.AbyssalLoadingScreen?.resolveUpdateGate();
    return data;
   }
   if(data.updatable!==true){root.AbyssalLoadingScreen?.status('APK AINDA NÃO ASSINADO','Abrindo a versão instalada.','boot',86);root.AbyssalLoadingScreen?.resolveUpdateGate();return data;}
   if(/^[a-f0-9]{64}$/i.test(String(data.sha256||''))){data.sha256=String(data.sha256).toLowerCase();}
   else if(data.metadataUrl){
    try{
     const publishedResponse=await fetch(data.metadataUrl+'?v='+encodeURIComponent(data.latestVersion),{cache:'no-store',signal:AbortSignal.timeout(6000)});
     if(!publishedResponse.ok){
      root.AbyssalLoadingScreen?.status('ATUALIZAÇÃO EM PUBLICAÇÃO','Abrindo a versão instalada enquanto o pacote termina de ser publicado.','boot',86);
      root.AbyssalLoadingScreen?.resolveUpdateGate();return data;
     }
     const published=await publishedResponse.json();
     if(published.platform!==p||String(published.version||'')!==String(data.latestVersion||'')){
      root.AbyssalLoadingScreen?.status('ATUALIZAÇÃO EM PUBLICAÇÃO','O novo pacote ainda está sendo finalizado. Abrindo a versão instalada.','boot',86);
      root.AbyssalLoadingScreen?.resolveUpdateGate();return data;
     }
     if(published.updatable!==true){
      root.AbyssalLoadingScreen?.status('APK AINDA NÃO ASSINADO','Abrindo a versão instalada.','boot',86);
      root.AbyssalLoadingScreen?.resolveUpdateGate();return data;
     }
     if(!/^[a-f0-9]{64}$/i.test(String(published.sha256||''))){
      root.AbyssalLoadingScreen?.status('ATUALIZAÇÃO EM VALIDAÇÃO','Abrindo a versão instalada.','boot',86);
      root.AbyssalLoadingScreen?.resolveUpdateGate();return data;
     }
     data.sha256=String(published.sha256).toLowerCase();
     if(published.url)data.url=published.url;
    }catch(_){
     root.AbyssalLoadingScreen?.status('SEM ACESSO AO PACOTE','Abrindo a versão local instalada.','offline',86);
     root.AbyssalLoadingScreen?.resolveUpdateGate();return data;
    }
   }else{
    root.AbyssalLoadingScreen?.resolveUpdateGate();return data;
   }
   let deferred='';try{deferred=sessionStorage.getItem('abyssalUpdateDeferred')||'';}catch(_){}
   if(force||data.required||deferred!==String(data.latestVersion||'')){
    root.AbyssalLoadingScreen?.resolveUpdateGate();
    modal(data);
   }else{
    root.AbyssalLoadingScreen?.releaseAfterUpdate('Atualização adiada nesta sessão. Abrindo a versão instalada.');
   }
   return data;
  }catch(error){
   console.warn('[Abyssal] Falha ao verificar atualização:',error?.message||error);
   root.AbyssalLoadingScreen?.status('SEM CONEXÃO COM O SERVIDOR','Abrindo a versão local instalada.','offline',86);
   root.AbyssalLoadingScreen?.resolveUpdateGate();
   return null;
  }
 }
 root.AbyssalUpdater={check,currentVersion:build.version,platform,installNative,checkBrowser};
 function bindManualCheck(){
  // Browser downloads use their deployment; native shells use configured HTTPS.
  const downloadBase=native()?server():root.location.origin;
  if(/^https?:\/\//i.test(downloadBase||'')){
   for(const link of document.querySelectorAll?.('a.download-option-link[data-stable-fallback]')||[]){
    const p=link.dataset.platform;
    if(p==='windows'||p==='android')link.href=downloadBase+'/api/download/'+p;
   }
  }
  const button=document.getElementById('checkNativeUpdateBtn'),message=document.getElementById('downloadInstallMessage');
  if(!button)return;
  button.hidden=!native()||!platform();
  if(button.dataset.bound==='1')return;
  button.dataset.bound='1';
  button.addEventListener('click',async()=>{
   button.disabled=true;if(message)message.textContent='Verificando atualização…';
   const data=await check(true);
   if(message){
    if(!data)message.textContent=navigator.onLine===false?'Conecte-se à internet para verificar atualizações.':'Não foi possível verificar agora.';
    else if(data.platform==='play'&&String(data.latestVersion).startsWith('play-'))message.textContent='Nova versão encontrada na Google Play. Confira a janela de atualização.';
    else if(cmp(data.latestVersion,build.version)<=0)message.textContent=cmp(data.serverVersion,build.version)>0?'A versão web é mais recente. O novo instalador ainda não foi publicado. Sua instalação continua segura.':'Você já está usando a versão mais recente publicada do Abyssal.';
    else if(data.updatable===false)message.textContent='O pacote estável ainda não está disponível para atualização.';
    else if(!data.sha256)message.textContent='A nova versão ainda está sendo preparada. Tente novamente em instantes.';
    else message.textContent='Nova versão encontrada. Confira a janela de atualização.';
   }
   button.disabled=false;
  });
 }
 const schedule=()=>setTimeout(()=>check(false),900);
 let browserPoll=0;
 function startBrowserPolling(){
  if(browserPoll)return;
  browserPoll=setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine!==false){if(browserMode())checkBrowser(false);else if(native())check(false);}},15000);
 }

 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bindManualCheck();schedule();startBrowserPolling();},{once:true});else{bindManualCheck();schedule();startBrowserPolling();}
 root.addEventListener('online',()=>setTimeout(()=>check(false),1200));
 root.addEventListener('focus',()=>{if(navigator.onLine!==false){if(browserMode())checkBrowser(false);else if(native())check(false);}});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&navigator.onLine!==false){if(browserMode())checkBrowser(false);else if(native())check(false);}});
})(window);
