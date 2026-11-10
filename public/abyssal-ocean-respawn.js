/* Individual open-sea specimen respawn cooldown, shared by solo and server.
 * A streamed creature may unload without dying; only confirmed deaths mark IDs.
 * Stable sector IDs prevent the same individual from instantly regenerating.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalOceanRespawn=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const RESPAWN_MS=5*60*1000;
 function createTracker(snapshot=null){
  const defeatedUntil=new Map();
  // JSON-persisted room snapshots keep per-individual deadlines across reconnects.
  const records=Array.isArray(snapshot?.entries)?snapshot.entries:[];
  for(const record of records.slice(0,10000)){
   if(!Array.isArray(record)||record.length!==2)continue;
   const id=String(record[0]??''),until=Number(record[1]);
   if(!id||id.length>128||!Number.isFinite(until)||until<0)continue;
   defeatedUntil.set(id,until);
  }
  return Object.freeze({
   mark(id,now=Date.now()){
    if(id===null||id===undefined||String(id)==='')return false;
    defeatedUntil.set(String(id),now+RESPAWN_MS);
    return true;
   },
   ready(id,now=Date.now()){
    const key=String(id),until=defeatedUntil.get(key);
    if(until===undefined)return true;
    if(now>=until){defeatedUntil.delete(key);return true;}
    return false;
   },
   remainingMs(id,now=Date.now()){return Math.max(0,(defeatedUntil.get(String(id))||0)-now);},
   prune(now=Date.now()){
    for(const [id,until] of defeatedUntil)if(now>=until)defeatedUntil.delete(id);
   },
   clear(){defeatedUntil.clear();},
   size(){return defeatedUntil.size;},
   toJSON(){return {entries:[...defeatedUntil]};}
  });
 }
 function restoreTracker(candidate){
  if(candidate&&typeof candidate.mark==='function'&&typeof candidate.ready==='function'&&typeof candidate.prune==='function')return candidate;
  return createTracker(candidate);
 }
 return Object.freeze({RESPAWN_MS,createTracker,restoreTracker});
});
