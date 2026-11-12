/* Persistent, device-local Solo energy. Never uploaded as online money. */
(function(root,factory){
 const api=factory(typeof localStorage==='undefined'?null:localStorage);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalSoloProgress=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(storage){
 'use strict';
 const KEY='abyssalSoloEnergyV1',COSTS=Object.freeze({2:80,3:180});
 const sanitize=s=>({energy:Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(Number(s?.energy)||0))),lamp:Math.max(1,Math.min(3,Math.floor(Number(s?.lamp)||1)))});
 function create(store){
  let state=sanitize(null);
  try{state=sanitize(JSON.parse(store?.getItem(KEY)||'null'));}catch(_){}
  function save(){try{store?.setItem(KEY,JSON.stringify(state));}catch(_){}return {...state};}
  function get(){return {...state};}
  function credit(amount){const n=Math.floor(Number(amount));if(!Number.isFinite(n)||n<=0)return get();state.energy=Math.min(Number.MAX_SAFE_INTEGER,state.energy+n);return save();}
  function debit(amount){const n=Math.max(0,Math.floor(Number(amount)||0));if(!n)return {ok:true,spent:0,...get()};const spent=Math.min(state.energy,n);state.energy-=spent;return {ok:spent===n,spent,...save()};}
  function upgradeLamp(){const next=state.lamp+1,cost=COSTS[next];if(!cost)return {ok:false,reason:'max',...get()};
   if(state.energy<cost)return {ok:false,reason:'energy',...get()};
   state.energy-=cost;state.lamp=next;return {ok:true,...save()};
  }
  return Object.freeze({get,credit,debit,upgradeLamp,costFor:level=>COSTS[level]||0});
 }
 return Object.freeze({...create(storage),create,KEY,COSTS});
});