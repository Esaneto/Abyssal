'use strict';
// Server-authoritative, pooled cooperative experience. Never trust client-sent XP.
// 20% goes equally to active squad members; 80% rewards verified damage.
// No rounding up per member: the sum of shares cannot exceed the XP pool.
function splitXp(total,players,contributions={},teamFraction=.20){
 const amount=Math.max(0,Number(total)||0);
 const eligible=(Array.isArray(players)?players:[]).filter(p=>p&&p.id!=null&&p.alive!==false&&!p.tutorialActive&&!p.runStats?.settled);
 if(!amount||!eligible.length)return [];
 const weights=eligible.map(p=>Math.max(0,Number(contributions?.[String(p.id)])||0));
 const sum=weights.reduce((a,b)=>a+b,0);
 const team=eligible.length>1?Math.max(0,Math.min(1,teamFraction)):1;
 const pool=Math.round(amount*1000);
 const raw=eligible.map((p,i)=>{
  const contribution=sum?weights[i]/sum:1/eligible.length;
  return pool*(team/eligible.length+(1-team)*contribution);
 });
 const units=raw.map(Math.floor);
 let leftover=pool-units.reduce((a,b)=>a+b,0);
 // Largest-remainder allocation, breaking ties on verified damage then stable ID.
 const order=eligible.map((_,i)=>i).sort((a,b)=>
  (raw[b]-units[b])-(raw[a]-units[a])||weights[b]-weights[a]||String(eligible[a].id).localeCompare(String(eligible[b].id)));
 for(let j=0;j<leftover;j++)units[order[j%order.length]]++;
 return eligible.map((p,i)=>({id:String(p.id),value:units[i]/1000,damage:weights[i]})).filter(p=>p.value>0);
}
module.exports={splitXp};
