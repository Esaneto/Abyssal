(function(root){
 'use strict';
 const isAndroid=()=>root.Capacitor?.getPlatform?.()==='android';
 if(!isAndroid())return;
 const bridge=()=>root.Capacitor?.Plugins?.AbyssalAdMob;
 let active=false,nativeStatus=null;
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function refreshPrivacy(status){
  const button=document.getElementById('adPrivacyOptionsBtn');
  if(button)button.hidden=!status?.privacyRequired;
 }
 function prepare(){
  if(!bridge()?.initialize||navigator.onLine===false)return;
  bridge().initialize().then(status=>{nativeStatus=status;refreshPrivacy(status);}).catch(()=>{});
 }
 root.adBreak=function(options={}){
  const finish=status=>options.adBreakDone?.({breakStatus:status});
  if(options.type!=='reward'||active||!bridge()?.showRewarded||navigator.onLine===false){finish('notReady');return;}
  let started=false;
  const show=async()=>{
   if(started||active)return;started=true;active=true;
   let result=null,ticket='',earned=false;
   const online=root.AbyssalOnline;
   try{
    const status=nativeStatus||await bridge().initialize();nativeStatus=status;
    if(!status?.configured)throw Error('ad-not-configured');
    if(!status.testMode){
     const issued=await online?.adMobRequest?.('admob-ticket',{placement:String(options.name||'')});
     if(!issued?.ok)throw Error(issued?.message||'reward-ticket-unavailable');
     ticket=issued.ticket;
    }
    options.beforeAd?.();result=await bridge().showRewarded({placement:String(options.name||''),ticket});
    earned=Boolean(result?.earned);
    if(earned&&!result.testMode){
     for(let attempt=0;attempt<30;attempt++){
      const checked=await online.adMobRequest('admob-status',{ticket});
      if(checked?.ok&&checked.verified){options.adViewed?.(ticket);finish('viewed');return;}
      await pause(1000);
     }
     finish('verificationPending');return;
    }
    if(result?.testMode){console.info('[AdMob] Test ad completed; no production game reward.');finish('testAd');return;}
    if(result)options.adDismissed?.();
    finish(result?'dismissed':'notReady');
   }catch(error){console.warn('[AdMob]',error?.message||error);finish('notReady');}
   finally{if(ticket&&!earned)online?.cancelAdMobTicket?.(ticket);active=false;options.afterAd?.();}

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
