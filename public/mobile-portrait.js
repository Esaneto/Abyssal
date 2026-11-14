(function(root){
 'use strict';
 let gate=null,handheld=false,scrollTimer=0;
 const textField='input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=file]):not([type=color]),textarea,[contenteditable]:not([contenteditable=false])';
 const editing=()=>Boolean(document.activeElement?.matches?.(textField)&&!document.activeElement.disabled&&!document.activeElement.readOnly);
 function physicalLandscape(){
 const type=root.screen?.orientation?.type;
 if(typeof type==='string'&&/^(portrait|landscape)-/.test(type))return type.startsWith('landscape');
 if(typeof root.orientation==='number')return Math.abs(root.orientation)%180===90;
 const w=Number(root.screen?.width),h=Number(root.screen?.height);
 if(w>0&&h>0&&w!==h)return w>h;
 return !editing()&&root.innerWidth>root.innerHeight;
 }
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
   const landscape=physicalLandscape();
   const active=!landscape&&editing(),html=document.documentElement;
   html.classList.toggle('abyssal-mobile-editing',active);
   clearTimeout(scrollTimer);
   if(active){
     const height=Math.max(1,Math.min(root.innerHeight,root.visualViewport?.height||root.innerHeight));
     html.style.setProperty('--abyssal-edit-height',height+'px');
     scrollTimer=setTimeout(()=>{const field=document.activeElement;if(!editing())return;const rect=field.getBoundingClientRect();const vv=root.visualViewport;const top=vv?.offsetTop||0,bottom=top+(vv?.height||root.innerHeight);if(rect.bottom>bottom-12||rect.top<top+8)field.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});},80);
   }else html.style.removeProperty('--abyssal-edit-height');
   document.documentElement.classList.toggle('abyssal-mobile-landscape',landscape);
   gate.hidden=!landscape;
   root.AbyssalMobileOrientation={handheld:true,portrait:!landscape,blocked:landscape,lock:requestPortraitLock};
 }
 function init(){handheld=detectHandheld();apply();requestPortraitLock();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 root.addEventListener('resize',apply,{passive:true});
 root.visualViewport?.addEventListener('resize',apply,{passive:true});
 root.screen?.orientation?.addEventListener?.('change',apply);
 document.addEventListener('focusin',apply);
 document.addEventListener('focusout',()=>setTimeout(apply,0));
 root.addEventListener('orientationchange',()=>setTimeout(()=>{apply();requestPortraitLock();},80),{passive:true});
 document.addEventListener('fullscreenchange',()=>requestPortraitLock());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){apply();requestPortraitLock();}});
})(window);
