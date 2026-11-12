/* Unified energy wallet: offline device state or account-scoped pending operations. */
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
  try{state=sanitize(JSON.parse(store?.getItem(KEY)||'null'));if(!store?.getItem('abyssalSessionToken')){const old=store?.getItem('abyssalCoins');if(old!==null&&old!==undefined){state.energy+=Math.floor(Math.max(0,Number(old)||0)/10);store?.setItem(KEY,JSON.stringify(state));store?.removeItem('abyssalCoins');}}}catch(_){}
  let accountKey='',serverBalance=0,pending=[],busy=false;
  const queueKey=()=> 'abyssalEnergyQueue:'+accountKey;
  function persistQueue(){try{store?.setItem(queueKey(),JSON.stringify(pending));}catch(_){}}
  function recalc(){state.energy=Math.max(0,serverBalance+pending.reduce((sum,op)=>sum+op.delta,0));}
  function sync(){if(!accountKey||busy||!pending.length||!globalThis.AbyssalOnline?.isAuthenticated?.())return;busy=true;const key=accountKey;globalThis.AbyssalOnline.syncEnergyOperations(pending.slice(0,100),result=>{busy=false;if(!result?.ok||accountKey!==key)return;const ids=new Set(result.accepted||[]);pending=pending.filter(op=>!ids.has(op.id));serverBalance=Number(result.energy)||0;persistQueue();recalc();save();if(ids.size)sync();});}
  function setAccount(key,balance){key=String(key||'').trim().toLowerCase();if(key!==accountKey){accountKey=key;try{pending=key?JSON.parse(store?.getItem(queueKey())||'[]'):[];}catch{pending=[];}}if(key){serverBalance=Math.max(0,Math.floor(Number(balance)||0));recalc();save();sync();}}
  function operation(delta,source){if(accountKey){pending.push({id:globalThis.crypto?.randomUUID?.()||('energy-'+Date.now()+'-'+Math.random().toString(36).slice(2)),delta,source,at:Date.now()});persistQueue();recalc();sync();}else state.energy=Math.max(0,state.energy+delta);return save();}
  function save(){try{if(!accountKey)store?.setItem(KEY,JSON.stringify(state));else {store?.setItem('abyssalAccountEnergy',String(state.energy));store?.setItem(KEY,JSON.stringify({...sanitize(JSON.parse(store?.getItem(KEY)||'null')),lamp:state.lamp}));}}catch(_){}return {...state};}
  function get(){return {...state};}
  function credit(amount,source='solo-orb'){const n=Math.floor(Number(amount));if(!Number.isFinite(n)||n<=0)return get();return operation(n,source);}
  function debit(amount){const n=Math.max(0,Math.floor(Number(amount)||0));if(!n)return {ok:true,spent:0,...get()};const spent=Math.min(state.energy,n);operation(-spent,'research');return {ok:spent===n,spent,...get()};}
  function upgradeLamp(){const next=state.lamp+1,cost=COSTS[next];if(!cost)return {ok:false,reason:'max',...get()};
   if(state.energy<cost)return {ok:false,reason:'energy',...get()};
   debit(cost);state.lamp=next;return {ok:true,...save()};
  }
  return Object.freeze({get,credit,debit,upgradeLamp,setAccount,sync,costFor:level=>COSTS[level]||0});
 }
 return Object.freeze({...create(storage),create,KEY,COSTS});
});