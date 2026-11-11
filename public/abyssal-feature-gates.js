/* Abyssal launch focus: preserve unfinished modes, expose Solo only.
 * This is a UI/routing gate, not deletion of game systems or saved data.
 */
(function(){
 'use strict';
 const LOCKED=new Set(['sea','rift','online']);
 let timer=0;
 function notify(){
  let toast=document.getElementById('abyssalDevelopmentNotice');
  if(!toast){toast=document.createElement('div');toast.id='abyssalDevelopmentNotice';toast.className='abyss-development-notice';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.appendChild(toast);}
  toast.textContent='EM DESENVOLVIMENTO · No momento, jogue o Shooter Solo.';
  toast.classList.add('is-visible');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('is-visible'),3200);
  return false;
 }
 const api=Object.freeze({soloOnly:true,isLocked:kind=>LOCKED.has(kind),notify});
 window.AbyssalLaunchFocus=api;
 // Capture routes before older menu and room-browser handlers run.
 document.addEventListener('click',event=>{
  const target=event.target?.closest?.('#openSeaPortalBtn,#riftPortalBtn,#onlineBtn,#abyssDiveOnlineChoice,#abyssDescentPanel [data-mode],#submarineWorkshop [data-abyss-locked]');
  if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();notify();
 },true);
 for(const type of ['abyssal-start-open-sea','abyssal-start-rift-solo']){
  window.addEventListener(type,event=>{event.stopImmediatePropagation();notify();},true);
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
