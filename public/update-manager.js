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
 function modal(data){
  if(document.getElementById('abyssalUpdatePrompt'))return;
  const el=document.createElement('section');el.id='abyssalUpdatePrompt';el.className='abyssal-update-prompt';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  el.innerHTML='<div class="abyssal-update-card"><small>ATUALIZAÇÃO DISPONÍVEL</small><h2>ABYSSAL '+String(data.latestVersion||'')+'</h2><p class="abyssal-update-version">Versão instalada '+String(build.version||'')+' → '+String(data.latestVersion||'')+'</p><p>'+String(data.releaseNotes||'Nova versão disponível.')+'</p><div class="abyssal-update-actions"><button type="button" class="primary-btn" data-update-now>ATUALIZAR AGORA</button>'+(data.required?'':'<button type="button" class="secondary-btn" data-update-later>DEPOIS</button>')+'</div><p class="abyssal-update-help">'+(data.platform==='android'?'O Android pedirá sua confirmação para instalar o novo APK. Seu progresso permanece na conta.':'O instalador do Windows será aberto. Feche o jogo quando o instalador solicitar.')+'</p></div>';
  el.querySelector('[data-update-now]')?.addEventListener('click',()=>{
   try{root.open(data.url,'_blank','noopener');}catch(_){root.location.href=data.url;}
  });
  el.querySelector('[data-update-later]')?.addEventListener('click',()=>{
   try{sessionStorage.setItem('abyssalUpdateDeferred',String(data.latestVersion||''));}catch(_){}
   el.remove();
  });
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
   let deferred='';try{deferred=sessionStorage.getItem('abyssalUpdateDeferred')||'';}catch(_){}
   if(force||data.required||deferred!==String(data.latestVersion||''))modal(data);
   return data;
  }catch(error){console.warn('[Abyssal] Falha ao verificar atualização:',error?.message||error);return null;}
 }
 root.AbyssalUpdater={check,currentVersion:build.version,platform};
 const schedule=()=>setTimeout(()=>check(false),3500);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
 root.addEventListener('online',()=>setTimeout(()=>check(false),1200));
})(window);
