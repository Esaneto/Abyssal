(function(root){
 'use strict';
 const isAndroid=()=>root.Capacitor?.getPlatform?.()==='android';
 if(!isAndroid())return;
 const bridge=()=>root.Capacitor?.Plugins?.AbyssalAdMob;
 let active=false;
 function refreshPrivacy(status){
  const button=document.getElementById('adPrivacyOptionsBtn');
  if(button)button.hidden=!status?.privacyRequired;
 }
 function prepare(){
  if(!bridge()?.initialize||navigator.onLine===false)return;
  bridge().initialize().then(refreshPrivacy).catch(()=>{});
 }
 root.adBreak=function(options={}){
  const finish=status=>options.adBreakDone?.({breakStatus:status});
  if(options.type!=='reward'||active||!bridge()?.showRewarded||navigator.onLine===false){finish('notReady');return;}
  let started=false;
  const show=async()=>{
   if(started||active)return;started=true;active=true;
   let result=null;
   try{options.beforeAd?.();result=await bridge().showRewarded({placement:String(options.name||'')});}
   catch(error){console.warn('[AdMob]',error?.message||error);}
   finally{active=false;options.afterAd?.();}
   if(result?.earned&&!result.testMode){options.adViewed?.();finish('viewed');}
   else if(result?.testMode){console.info('[AdMob] Test ad completed; no production game reward.');finish('testAd');}
   else if(result){options.adDismissed?.();finish('dismissed');}
   else finish('notReady');
  };
  if(typeof options.beforeReward==='function')options.beforeReward(show);else finish('notReady');
 };
 function bind(){
  const button=document.getElementById('adPrivacyOptionsBtn');
  button?.addEventListener('click',()=>bridge()?.showPrivacyOptions?.().then(refreshPrivacy).catch(console.warn));
  prepare();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
 root.addEventListener('online',prepare);
})(window);
