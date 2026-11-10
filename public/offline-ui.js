/* Local/installed Abyssal: solo and solo trenches remain playable without Wi-Fi. */
(function(){
  'use strict';
  var protocol=window.location.protocol;
  var localDesktop=protocol==='abyssal:'||protocol==='file:';
  var capacitor=Boolean(window.Capacitor && typeof window.Capacitor.isNativePlatform==='function' && window.Capacitor.isNativePlatform());
  var nativeAssets=localDesktop||capacitor||(protocol==='https:'&&window.location.hostname==='localhost');
  if(nativeAssets&&!window.ABYSSAL_SERVER_URL) window.ABYSSAL_SERVER_URL=window.ABYSSAL_SERVER_CONFIG?.nativeUrl||window.location.origin;

  var message;
  function update(){
    if(!message)return;
    var offline=navigator.onLine===false;
    message.hidden=!offline;
    document.documentElement.classList.toggle('abyssal-offline',offline);
    var onlineButton=document.getElementById('onlineBtn');
    if(onlineButton){
      onlineButton.disabled=offline;
      onlineButton.setAttribute('aria-label',offline?'Multiplayer indisponível sem conexão':'Mergulhar online');
      onlineButton.title=offline?'Conecte-se à internet para mergulhar online':'';
    }
    var retry=message.querySelector('button');
    if(retry)retry.hidden=true;
  }
  function installNotice(){
    var menu=document.getElementById('menuScreen');
    if(!menu || document.getElementById('offlineSoloNotice'))return;
    message=document.createElement('aside');
    message.id='offlineSoloNotice';
    message.className='abyssal-offline-notice';
    message.setAttribute('role','status');
    message.setAttribute('aria-live','polite');
    var label=document.createElement('span');
    label.textContent='SEM CONEXÃO · MERGULHO SOLO E FOSSAS ABISSAIS DISPONÍVEIS. MULTIPLAYER E CONTA EXIGEM INTERNET.';
    message.appendChild(label);
    menu.appendChild(message);
    update();
  }
  window.AbyssalOffline={
    localDesktop:localDesktop,
    nativeAssets:nativeAssets,
    canPlaySolo:function(){return true;},
    connected:function(){return navigator.onLine!==false;}
  };
  window.addEventListener('offline',update);
  window.addEventListener('online',update);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installNotice,{once:true});
  else installNotice();

  // Browser only: preinstall the full static game for a later offline visit.
  // Capacitor already bundles public/ inside the APK and Electron ships it with
  // its installer. Do not install a second service worker on either native shell.
  if(!nativeAssets && (protocol==='https:'||window.location.hostname==='localhost') &&
     'serviceWorker' in navigator){
    // A new release must replace a previously controlled page while in the
    // menu, but never interrupt a live Solo/Online/Fossas expedition.
    navigator.serviceWorker.addEventListener('controllerchange',function(){
      var menu=document.getElementById('menuScreen');
      if(!menu||menu.hidden||document.body.classList.contains('game-active'))return;
      try{
        var key='abyssal-sw-refresh-2026-11-09-v61';
        if(sessionStorage.getItem(key)==='1')return;
        sessionStorage.setItem(key,'1');
      }catch(_){return;}
      window.location.reload();
    });
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('/offline-sw.js',{scope:'/'})
        .then(function(reg){return reg.update();})
        .catch(function(error){console.warn('[Abyssal] Offline cache not installed:',error);});
    },{once:true});
  }
})();
