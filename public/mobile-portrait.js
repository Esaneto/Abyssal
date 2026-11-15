(function(root){
 'use strict';
 let handheld=false,scrollTimer=0;
 const textField='input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=file]):not([type=color]),textarea,[contenteditable]:not([contenteditable=false])';
 const editing=()=>Boolean(document.activeElement?.matches?.(textField)&&!document.activeElement.disabled&&!document.activeElement.readOnly);
 function physicalLandscape(){
 // Use the available viewport for layout, except while a keyboard is editing.
 if(!editing()&&root.innerWidth>0&&root.innerHeight>0)return root.innerWidth>root.innerHeight;
 const type=root.screen?.orientation?.type;
 if(typeof type==='string'&&/^(portrait|landscape)-/.test(type))return type.startsWith('landscape');
 if(typeof root.orientation==='number')return Math.abs(root.orientation)%180===90;
 const w=Number(root.screen?.width),h=Number(root.screen?.height);
 if(w>0&&h>0&&w!==h)return w>h;
 return !editing()&&root.innerWidth>root.innerHeight;
 }
 const ua=String(navigator.userAgent||'');
 function detectHandheld(){
   // Capacitor can use a customized desktop-like UA; native Android must
   // still receive the handheld layout on phones and tablets.
   if(root.Capacitor?.getPlatform?.()==='android')return true;
   if(/Android|iPhone|iPod|Mobile/i.test(ua))return true;
   if(/iPad/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))return true;
   const touch=Number(navigator.maxTouchPoints)||0;
   const coarse=root.matchMedia?.('(pointer:coarse)')?.matches===true;
   return touch>0&&coarse&&Math.min(root.screen?.width||root.innerWidth,root.screen?.height||root.innerHeight)<=600;
 }
 async function releaseOrientationLock(){
   if(!handheld)return false;
   try{
     if(root.screen?.orientation?.unlock){root.screen.orientation.unlock();return true;}
   }catch(_){}
   return false;
 }
 function apply(){
   handheld=detectHandheld();
   if(!handheld){document.documentElement.classList.remove('abyssal-mobile-landscape','abyssal-handheld','abyssal-handheld-landscape','abyssal-mobile-editing');return;}
   document.documentElement.classList.add('abyssal-handheld');
   const landscape=physicalLandscape();
   const active=editing(),html=document.documentElement;
   html.classList.toggle('abyssal-mobile-editing',active);
   clearTimeout(scrollTimer);
   if(active){
     const height=Math.max(1,Math.min(root.innerHeight,root.visualViewport?.height||root.innerHeight));
     html.style.setProperty('--abyssal-edit-height',height+'px');
     scrollTimer=setTimeout(()=>{const field=document.activeElement;if(!editing())return;const rect=field.getBoundingClientRect();const vv=root.visualViewport;const top=vv?.offsetTop||0,bottom=top+(vv?.height||root.innerHeight);if(rect.bottom>bottom-12||rect.top<top+8)field.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});},80);
   }else html.style.removeProperty('--abyssal-edit-height');
   html.classList.remove('abyssal-mobile-landscape');
   html.classList.toggle('abyssal-handheld-landscape',landscape);
   const width=Math.max(1,Math.round(root.innerWidth)),height=Math.max(1,Math.round(active?Math.min(root.innerHeight,root.visualViewport?.height||root.innerHeight):root.innerHeight));
   html.style.setProperty('--abyssal-viewport-w',width+'px');html.style.setProperty('--abyssal-viewport-h',height+'px');
   if(!active&&(root.scrollX||root.scrollY))root.scrollTo?.(0,0);
   root.AbyssalHudLayout?.refresh?.();
   root.AbyssalMobileOrientation={handheld:true,portrait:!landscape,blocked:false,lock:releaseOrientationLock};
 }
 function init(){handheld=detectHandheld();apply();releaseOrientationLock();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 root.addEventListener('resize',apply,{passive:true});
 root.visualViewport?.addEventListener('resize',apply,{passive:true});
 root.screen?.orientation?.addEventListener?.('change',apply);
 document.addEventListener('focusin',apply);
 document.addEventListener('focusout',()=>setTimeout(apply,0));
 root.addEventListener('orientationchange',()=>{apply();for(const delay of [80,250,500])setTimeout(apply,delay);releaseOrientationLock();},{passive:true});
 document.addEventListener('fullscreenchange',()=>releaseOrientationLock());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){apply();releaseOrientationLock();}});
})(window);
