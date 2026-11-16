(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else api.mount(root);
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const INVITE='https://discord.gg/BMz8Xgc9mE';
 const TERMS='2026-11-03-v2';
 function eligible(profile){return !!profile&&profile.termsVersion===TERMS&&['teen','adult'].includes(profile.band);}
 function mount(w){
  const d=w.document,button=d.getElementById('discordCommunityBtn'),dialog=d.getElementById('discordCommunityDialog');
  if(!button||!dialog||button.dataset.bound)return;
  button.dataset.bound='true';
  const cancel=d.getElementById('discordCommunityCancel'),confirm=d.getElementById('discordCommunityConfirm'),status=d.getElementById('discordCommunityStatus');
  function allowed(){try{return eligible(JSON.parse(w.localStorage.getItem('abyssalAgeProfile')||'null'));}catch{return false;}}
  function refresh(){button.hidden=!allowed();if(!allowed()&&dialog.open)dialog.close();}
  button.addEventListener('click',()=>{if(!allowed()||d.body.classList.contains('game-active'))return;status.textContent='';if(!dialog.open)dialog.showModal();});
  cancel.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(!button.hidden)button.focus({preventScroll:true});});
  confirm.addEventListener('click',async()=>{
   if(!allowed()||d.body.classList.contains('game-active')){dialog.close();return;}
   if(w.navigator.onLine===false){status.textContent='Sem internet. Conecte-se para acessar a comunidade.';return;}
   confirm.disabled=true;
   try{
    const native=w.Capacitor?.getPlatform?.()==='android'?w.Capacitor?.Plugins?.AbyssalCommunity:null;
    if(native?.openDiscord){await native.openDiscord();}
    else {const link=d.createElement('a');link.href=INVITE;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';d.body.appendChild(link);link.click();link.remove();}
    dialog.close();
   }catch(_){status.textContent='Não foi possível abrir o Discord. Tente novamente.';}
   finally{confirm.disabled=false;}
  });
  d.getElementById('ageTermsContinue')?.addEventListener('click',()=>queueMicrotask(refresh));
  w.addEventListener('storage',refresh);
  w.addEventListener('pageshow',refresh);
  refresh();
 }
 return {INVITE,eligible,mount};
});
