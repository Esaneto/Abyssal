(function(root){
 'use strict';
 const LOADING_CHUNKS=[
  'assets/branding/loading/0.b64','assets/branding/loading/1.b64','assets/branding/loading/2.b64',
  'assets/branding/loading/3.b64','assets/branding/loading/4.b64','assets/branding/loading/5.b64'
 ];
 const ICON_CHUNKS=[
  'assets/branding/icon/0.b64','assets/branding/icon/1.b64','assets/branding/icon/2.b64'
 ];
 let overlay=null,live=null,bar=null,ready=false,updateGate=false,hold=false,removed=false;
 function readChunks(paths){
  return Promise.all(paths.map(path=>fetch(path,{cache:'force-cache'}).then(r=>r.ok?r.text():Promise.reject(new Error('asset '+path)))))
    .then(parts=>parts.join('').trim());
 }
 function setArt(){
  const vectorArt='url("abyssal-ocean-cinema.svg?v=2026.11.13.loading-hq")';
  document.documentElement.style.setProperty('--abyssal-loading-art',vectorArt);
  const probe=new Image();
  probe.onerror=()=>{
   readChunks(LOADING_CHUNKS)
    .then(data=>document.documentElement.style.setProperty('--abyssal-loading-art','url("data:image/webp;base64,'+data+'")'))
    .catch(err=>console.warn('[Abyssal] Loading art unavailable:',err?.message||err));
  };
  probe.src='abyssal-ocean-cinema.svg?v=2026.11.13.loading-hq';
  readChunks(ICON_CHUNKS).then(data=>{
    const uri='data:image/webp;base64,'+data;
    root.ABYSSAL_BRAND_ICON_DATA_URI=uri;
    let icon=document.querySelector('link[rel="icon"][data-abyssal-brand]');
    if(!icon){icon=document.createElement('link');icon.rel='icon';icon.type='image/webp';icon.dataset.abyssalBrand='1';document.head.appendChild(icon);}
    icon.href=uri;
    let apple=document.querySelector('link[rel="apple-touch-icon"][data-abyssal-brand]');
    if(!apple){apple=document.createElement('link');apple.rel='apple-touch-icon';apple.dataset.abyssalBrand='1';document.head.appendChild(apple);}
    apple.href=uri;
  }).catch(err=>console.warn('[Abyssal] App icon art unavailable:',err?.message||err));
 }
 function ensure(){
  if(overlay||removed)return overlay;
  overlay=document.createElement('section');overlay.id='abyssalStartupLoading';overlay.setAttribute('aria-label','Carregando Abyssal');
  const brand=document.createElement('div');brand.className='abyssal-loading-brand';brand.innerHTML='<strong>ABYSSAL</strong><span>ECOS DAS PROFUNDEZAS</span>';overlay.appendChild(brand);
  live=document.createElement('div');live.className='abyssal-startup-live';live.dataset.state=navigator.onLine===false?'offline':'boot';
  live.innerHTML='<strong>'+(navigator.onLine===false?'MODO OFFLINE':'INICIANDO ABYSSAL')+'</strong><small>'+(navigator.onLine===false?'Carregando os arquivos locais. Solo e modos offline continuam disponíveis.':'Preparando arquivos locais e verificando atualizações…')+'</small><span class="abyssal-startup-progress"><i></i></span>';
  overlay.appendChild(live);document.body.appendChild(overlay);bar=live.querySelector('i');setArt();return overlay;
 }
 function progress(value){ensure();if(bar)bar.style.width=Math.max(4,Math.min(100,Number(value)||0))+'%';}
 function status(title,detail,state='boot',value){
  ensure();if(!live)return;
  live.dataset.state=state;
  const strong=live.querySelector('strong'),small=live.querySelector('small');
  if(strong&&title)strong.textContent=title;if(small&&detail)small.textContent=detail;
  if(value!=null)progress(value);
 }
 function maybeHide(){
  if(removed||hold||!ready||!updateGate)return;
  progress(100);status('ABYSSAL PRONTO',navigator.onLine===false?'Modo offline carregado.':'Arquivos locais prontos.','ready',100);
  setTimeout(()=>{if(!overlay||hold)return;overlay.classList.add('is-hidden');setTimeout(()=>{overlay?.remove();overlay=null;live=null;bar=null;removed=true;},320);},180);
 }
 function setReady(){ready=true;maybeHide();}
 function resolveUpdateGate(){updateGate=true;maybeHide();}
 function beginUpdate(version){
  hold=true;status('ATUALIZANDO ABYSSAL',version?'Preparando a versão '+version+'…':'Preparando atualização…','update',48);
 }
 function updateDownload(detail,value=64){hold=true;status('BAIXANDO ATUALIZAÇÃO',detail||'Baixando e verificando o pacote oficial…','update',value);}
 function updateInstall(detail,value=94){hold=true;status('INSTALANDO ATUALIZAÇÃO',detail||'Pacote validado. Preparando instalação…','update',value);}
 function releaseAfterUpdate(detail){
  hold=false;updateGate=true;status('ATUALIZAÇÃO ADIADA',detail||'Abrindo a versão instalada.','boot',92);maybeHide();
 }
 function updateError(detail){
  hold=false;updateGate=true;status('ATUALIZAÇÃO NÃO CONCLUÍDA',detail||'O jogo será aberto com a versão já instalada.','error',92);maybeHide();
 }
 root.AbyssalLoadingScreen={ensure,progress,status,setReady,resolveUpdateGate,beginUpdate,updateDownload,updateInstall,releaseAfterUpdate,updateError};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});else ensure();
 root.addEventListener('abyssal-startup-ready',setReady);
 root.addEventListener('offline',()=>status('MODO OFFLINE','Carregando os arquivos locais. Solo e modos offline continuam disponíveis.','offline',72));
 root.addEventListener('online',()=>{if(!hold)status('CONEXÃO RESTAURADA','Verificando se existe uma versão mais recente…','boot',56);});
 setTimeout(()=>{if(!updateGate&&navigator.onLine===false)resolveUpdateGate();},700);
})(window);
