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
 async function installNative(data,status,button){
  const original=button?.textContent||'ATUALIZAR AGORA';
  if(button){button.disabled=true;button.textContent='BAIXANDO ATUALIZAÇÃO…';}
  if(status)status.textContent='Baixando e verificando a atualização. Não feche o Abyssal.';
  try{
   let result;
   if(data.platform==='android'&&androidBridge()?.installApk){
    result=await androidBridge().installApk({url:data.url,sha256:data.sha256||'',version:data.latestVersion||''});
    if(result?.permissionRequired){
     if(status)status.textContent='Autorize o Abyssal a instalar atualizações e volte ao jogo. Depois toque em ATUALIZAR AGORA novamente.';
     return result;
    }
    if(status)status.textContent='Download concluído. Confirme a instalação na tela do Android.';
    return result;
   }
   if(data.platform==='windows'&&typeof windowsBridge()?.installUpdate==='function'){
    if(status)status.textContent='Baixando, validando e preparando o instalador do Windows…';
    result=await windowsBridge().installUpdate({url:data.url,sha256:data.sha256||'',version:data.latestVersion||''});
    if(status)status.textContent='Instalador aberto. O Abyssal será fechado para concluir a atualização.';
    return result;
   }
   if(status)status.textContent='Este build ainda não possui o atualizador interno. Abrindo o pacote oficial uma única vez…';
   try{root.open(data.url,'_blank','noopener');}catch(_){root.location.href=data.url;}
   return {ok:false,fallback:true};
  }catch(error){
   console.error('[Abyssal] Falha ao instalar atualização:',error);
   if(status)status.textContent='Não foi possível concluir a atualização. Verifique a conexão e tente novamente.';
   return {ok:false,error:String(error?.message||error||'update-failed')};
  }finally{
   if(button&&!button.isConnected)return;
   if(button){button.disabled=false;button.textContent=original;}
  }
 }
 function modal(data){
  const existing=document.getElementById('abyssalUpdatePrompt');
  if(existing){existing.remove();}
  const el=document.createElement('section');el.id='abyssalUpdatePrompt';el.className='abyssal-update-prompt';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  const card=document.createElement('div');card.className='abyssal-update-card';
  const kicker=document.createElement('small');kicker.textContent='ATUALIZAÇÃO DISPONÍVEL';
  const title=document.createElement('h2');title.textContent='ABYSSAL '+String(data.latestVersion||'');
  const version=document.createElement('p');version.className='abyssal-update-version';version.textContent='Versão instalada '+String(build.version||'')+' → '+String(data.latestVersion||'');
  const notes=document.createElement('p');notes.textContent=String(data.releaseNotes||'Nova versão disponível.');
  const actions=document.createElement('div');actions.className='abyssal-update-actions';
  const now=document.createElement('button');now.type='button';now.className='primary-btn';now.dataset.updateNow='';now.textContent='ATUALIZAR AGORA';actions.appendChild(now);
  if(!data.required){
   const later=document.createElement('button');later.type='button';later.className='secondary-btn';later.dataset.updateLater='';later.textContent='DEPOIS';actions.appendChild(later);
   later.addEventListener('click',()=>{try{sessionStorage.setItem('abyssalUpdateDeferred',String(data.latestVersion||''));}catch(_){}el.remove();});
  }
  const help=document.createElement('p');help.className='abyssal-update-help';help.textContent=data.platform==='android'
   ?'O Abyssal baixa o APK oficial dentro do aplicativo. O Android pedirá sua confirmação para instalar a atualização.'
   :'O Abyssal baixa e valida o instalador oficial dentro do aplicativo e o abre para concluir a atualização.';
  const status=document.createElement('p');status.className='abyssal-update-help';status.dataset.updateStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  card.append(kicker,title,version,notes,actions,help,status);el.appendChild(card);
  now.addEventListener('click',()=>installNative(data,status,now));
  document.body.appendChild(el);
 }
 async function check(force=false){
  if(!native()||navigator.onLine===false)return null;
  const p=platform();if(!p)return null;
  const base=server();if(!/^https:\/\//i.test(base))return null;
  try{
   const response=await fetch(base+'/api/client-update?platform='+encodeURIComponent(p)+'&currentVersion='+encodeURIComponent(build.version||''),{cache:'no-store',signal:AbortSignal.timeout(6000)});
   if(!response.ok)return null;
   const data=await response.json();if(!data?.ok||cmp(data.latestVersion,build.version)<=0)return data;
   if(data.metadataUrl){
    try{
     const publishedResponse=await fetch(data.metadataUrl+'?v='+encodeURIComponent(data.latestVersion),{cache:'no-store',signal:AbortSignal.timeout(6000)});
     if(!publishedResponse.ok)return data;
     const published=await publishedResponse.json();
     if(String(published.version||'')!==String(data.latestVersion||''))return data;
     if(data.platform==='android'&&published.updatable!==true)return data;
     if(!/^[a-f0-9]{64}$/i.test(String(published.sha256||'')))return data;
     data.sha256=String(published.sha256).toLowerCase();
    }catch(_){return data;}
   }else{return data;}
   let deferred='';try{deferred=sessionStorage.getItem('abyssalUpdateDeferred')||'';}catch(_){}
   if(force||data.required||deferred!==String(data.latestVersion||''))modal(data);
   return data;
  }catch(error){console.warn('[Abyssal] Falha ao verificar atualização:',error?.message||error);return null;}
 }
 root.AbyssalUpdater={check,currentVersion:build.version,platform,installNative};
 function bindManualCheck(){
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
    else if(cmp(data.latestVersion,build.version)<=0)message.textContent='Você já está usando a versão mais recente do Abyssal.';
    else if(!data.sha256)message.textContent='A nova versão ainda está sendo preparada. Tente novamente em instantes.';
    else message.textContent='Nova versão encontrada. Confira a janela de atualização.';
   }
   button.disabled=false;
  });
 }
 const schedule=()=>setTimeout(()=>check(false),3500);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bindManualCheck();schedule();},{once:true});else{bindManualCheck();schedule();}
 root.addEventListener('online',()=>setTimeout(()=>check(false),1200));
})(window);
