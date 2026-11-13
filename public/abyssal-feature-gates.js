/* Abyssal launch focus: Mar Aberto e Fossas permanecem bloqueados; Solo e Mergulho Online estão liberados para teste.
 * This is a UI/routing gate, not deletion of game systems or saved data.
 */
(function(){
 'use strict';
 const LOCKED=new Set(['sea','rift']);
 // Frozen modes may run only inside the explicit Chromium CI harness.
 // A normal local browser or packaged application is NOT a test exception.
 const acceptanceLegacy=window.__ABYSSAL_CI_SMOKE__===true&&
  location.hostname==='127.0.0.1'&&
  ['sea','deep','boss'].includes(new URLSearchParams(location.search).get('stage'));
 let timer=0;
 function notify(){
  let toast=document.getElementById('abyssalDevelopmentNotice');
  if(!toast){toast=document.createElement('div');toast.id='abyssalDevelopmentNotice';toast.className='abyss-development-notice';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.appendChild(toast);}
  toast.textContent='EM DESENVOLVIMENTO · Apenas Mar Aberto e Fossas permanecem bloqueados. Mergulho Online está LIBERADO PARA TESTE.';
  toast.classList.add('is-visible');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('is-visible'),3200);
  return false;
 }
 const api=Object.freeze({soloOnly:false,isLocked:kind=>LOCKED.has(kind),notify});
 window.AbyssalLaunchFocus=api;
 // Capture routes before older menu and room-browser handlers run.
 document.addEventListener('click',event=>{
  const target=event.target?.closest?.('#openSeaPortalBtn,#riftPortalBtn,#abyssDescentPanel [data-mode],#submarineWorkshop [data-abyss-locked]');
  if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();notify();
 },true);
 for(const type of ['abyssal-start-open-sea','abyssal-start-rift-solo']){
  window.addEventListener(type,event=>{if(acceptanceLegacy)return;event.stopImmediatePropagation();notify();},true);
 }
 function mark(){
  for(const id of ['openSeaPortalBtn','riftPortalBtn']){
   const button=document.getElementById(id);if(!button)continue;
   button.classList.add('abyss-development-locked');
   button.setAttribute('aria-description','Em desenvolvimento. Disponível futuramente.');
   if(!button.querySelector('.abyss-development-tag')){
    const badge=document.createElement('span');badge.className='abyss-development-tag';badge.textContent='EM DESENVOLVIMENTO';button.appendChild(badge);
   }
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mark,{once:true});else mark();
})();
