/* Review requests are voluntary. A static Play listing link is used for the
 * permanent CTA: Google's in-app review API may silently suppress dialog by quota. */
(function(root){
 'use strict';
 const APP='com.esaneto.abyssal',DELAY=5*60*1000,KEY='abyssal-review-prompt-v1';
 const $=id=>root.document.getElementById(id);
 const isNative=()=>root.Capacitor?.getPlatform?.()==='android';
 function read(){try{return JSON.parse(root.localStorage.getItem(KEY)||'{}')||{}}catch{return {}}}
 function save(next){try{root.localStorage.setItem(KEY,JSON.stringify(next))}catch(_){}}
 function shouldOffer(state,now=Date.now()){return !state.never&&!state.reviewed&&now-Number(state.lastShown||0)>=DELAY;}
 function mark(choice){const state=read(),now=Date.now();state.lastShown=now;if(choice==='never')state.never=true;if(choice==='rate')state.reviewed=true;save(state);}
 async function openStore(){
  try{
   const native=root.Capacitor?.Plugins?.AbyssalStore;
   if(isNative()&&native?.openListing){await native.openListing();return true;}
   const url='https://play.google.com/store/apps/details?id='+APP;
   const opened=root.open(url,'_blank','noopener,noreferrer');
   if(!opened)root.location.href=url;
   return true;
  }catch(_){try{root.location.href='https://play.google.com/store/apps/details?id='+APP;return true}catch{return false}}
 }
 function init(){
  const menu=$('menuScreen'),btn=$('playReviewBtn');if(!menu||!btn||btn.dataset.ready)return;
  btn.dataset.ready='true';
  btn.addEventListener('click',()=>{openStore()});
  const card=root.document.createElement('section');
  card.id='abyssalRateReminder';card.className='abyss-rate-reminder';card.hidden=true;
  card.setAttribute('role','group');card.setAttribute('aria-label','Convite opcional para avaliar Abyssal');
  card.innerHTML='<div class="abyss-rate-copy"><strong><span aria-hidden="true">★</span> Sua expedição merece uma avaliação?</strong><p>Ajude outros mergulhadores a conhecer o Abyssal. Sua participação é opcional.</p></div><div class="abyss-rate-actions"><button type="button" data-rate-choice="rate">Avaliar</button><button type="button" data-rate-choice="later">Avaliar mais tarde</button><button type="button" data-rate-choice="never">Não mostrar novamente</button></div>';
  const report=$('gameOverScreen')?.querySelector('.dive-report-card');
  const anchor=$('reviveWithAdBtn');if(report){if(anchor)report.insertBefore(card,anchor);else report.append(card);}
  card.addEventListener('click',async e=>{
   const choice=e.target.closest?.('[data-rate-choice]')?.dataset.rateChoice;
   if(!choice)return;
   card.hidden=true;mark(choice);
   if(choice==='rate')await openStore();
  });
  root.addEventListener('abyssal-run-ended',()=>{
   if(!card.isConnected||!shouldOffer(read()))return;
   // End of a real completed dive, not opening/closing menus or loading screens.
   const isPlaying=$('gameOverScreen')?.hidden===false;
   if(!isPlaying)return;
   mark('later');card.hidden=false;
  });
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={shouldOffer,DELAY};
 if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
})(typeof window!=='undefined'?window:globalThis);
