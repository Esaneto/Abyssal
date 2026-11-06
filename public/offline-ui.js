/* Local/installed Abyssal: solo and solo trenches remain playable without Wi-Fi. */
(function(){
  'use strict';
  var GAME_URL='https://abyssal-ej5j.onrender.com';
  var protocol=window.location.protocol;
  var localDesktop=protocol==='abyssal:'||protocol==='file:';
  var capacitor=Boolean(window.Capacitor && typeof window.Capacitor.isNativePlatform==='function' && window.Capacitor.isNativePlatform());
  var nativeAssets=localDesktop||capacitor||(protocol==='https:'&&window.location.hostname==='localhost');
  if(nativeAssets) window.ABYSSAL_SERVER_URL=GAME_URL;

  var message;
  function update(){
    if(!message)return;
    var offline=localDesktop||navigator.onLine===false;
    message.hidden=!offline;
    document.documentElement.classList.toggle('abyssal-offline',offline);
    var retry=message.querySelector('button');
    if(retry)retry.hidden=!localDesktop;
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
    if(localDesktop){
      var button=document.createElement('button');
      button.type='button';
      button.textContent='TENTAR CONECTAR';
      button.addEventListener('click',function(){
        window.location.assign(GAME_URL);
      });
      message.appendChild(button);
    }
    menu.appendChild(message);
    update();
  }
  window.AbyssalOffline={
    localDesktop:localDesktop,
    nativeAssets:nativeAssets,
    canPlaySolo:function(){return true;},
    connected:function(){return navigator.onLine!==false&&!localDesktop;}
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
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('/offline-sw.js',{scope:'/'})
        .catch(function(error){console.warn('[Abyssal] Offline cache not installed:',error);});
    },{once:true});
  }
})();
