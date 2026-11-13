(function(root){
 'use strict';
 let gate=null,handheld=false;
 const ua=String(navigator.userAgent||'');
 function detectHandheld(){
   if(/Android|iPhone|iPod|Mobile/i.test(ua))return true;
   if(/iPad/i.test(ua))return false;
   const touch=Number(navigator.maxTouchPoints)||0;
   const coarse=root.matchMedia?.('(pointer:coarse)')?.matches===true;
   return touch>0&&coarse&&Math.min(root.screen?.width||root.innerWidth,root.screen?.height||root.innerHeight)<=600;
 }
 function ensureGate(){
   if(gate)return gate;
   gate=document.createElement('section');gate.id='abyssalPortraitGate';gate.setAttribute('role','alert');gate.setAttribute('aria-live','assertive');
   gate.innerHTML='<div class="portrait-gate-card"><span class="portrait-gate-icon" aria-hidden="true">↻</span><h2>GIRE O CELULAR</h2><p>O Abyssal funciona somente no modo retrato no celular.</p></div>';
   document.body.appendChild(gate);return gate;
 }
 async function requestPortraitLock(){
   if(!handheld)return false;
   try{
     if(root.screen?.orientation?.lock){await root.screen.orientation.lock('portrait-primary');return true;}
   }catch(_){}
   return false;
 }
 function apply(){
   handheld=detectHandheld();
   if(!handheld){document.documentElement.classList.remove('abyssal-mobile-landscape');return;}
   ensureGate();
   const landscape=root.innerWidth>root.innerHeight;
   document.documentElement.classList.toggle('abyssal-mobile-landscape',landscape);
   gate.hidden=!landscape;
   root.AbyssalMobileOrientation={handheld:true,portrait:!landscape,blocked:landscape,lock:requestPortraitLock};
 }
 function init(){handheld=detectHandheld();apply();requestPortraitLock();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 root.addEventListener('resize',apply,{passive:true});
 root.addEventListener('orientationchange',()=>setTimeout(()=>{apply();requestPortraitLock();},80),{passive:true});
 document.addEventListener('fullscreenchange',()=>requestPortraitLock());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){apply();requestPortraitLock();}});
})(window);
