/* Shared FPSO production ledger and subsea-installation transaction model.
 * Offline solo and server-authenticated multiplayer follow identical rules.
 * It never trusts client-submitted reservoirs, credits, or elapsed time.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalOffshoreSystem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PLATFORM_X=520,PLATFORM_Y=95,MAX_LINKS=3,MAX_AGE_MS=24*60*60*1000;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(x))?Number(x):a));
 const integer=(v,cap)=>Math.floor(clamp(v,0,cap));
 function cleanWell(raw){
  if(!raw||!['oilSeep','gasSeep'].includes(raw.type))return null;
  const x=Number(raw.x),y=Number(raw.y),id=String(raw.id||'').slice(0,100);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>24000||y<0||y>21000||!id)return null;
  return {id,type:raw.type,x,y,connectedAt:clamp(raw.connectedAt||0,0,Number.MAX_SAFE_INTEGER)};
 }
 function normalize(raw={},now=Date.now()){
  const entries=[],ids=new Set();
  for(const link of Array.isArray(raw?.connections)?raw.connections.slice(0,MAX_LINKS):[]){
   const well=cleanWell(link);if(!well||ids.has(well.id))continue;ids.add(well.id);entries.push(well);
  }
  const source=raw?.installation,installation=source&&['laying','return'].includes(source.phase)?
   {phase:source.phase,startedAt:clamp(source.startedAt||now,0,now),...(source.phase==='return'&&cleanWell(source.target)?{target:cleanWell(source.target)}:{})}:null;
  return {oil:clamp(raw?.oil,0,1000000),gas:clamp(raw?.gas,0,1000000),
   lastAt:clamp(raw?.lastAt||now,0,now),connections:entries,installation};
 }
 function capacity(levels={}){return 500+Math.max(0,integer(levels?.subseaUmbilical,MAX_LINKS)-1)*250;}
 function rates(state={},levels={}){
  if(!Number(levels?.offshorePlatform)||!Number(levels?.subseaUmbilical))return {oil:0,gas:0};
  const links=(state?.connections||[]).slice(0,integer(levels.subseaUmbilical,MAX_LINKS));
  return {oil:links.filter(l=>l.type==='oilSeep').length*.025,gas:links.filter(l=>l.type==='gasSeep').length*.035};
 }
 function accrue(raw,levels={},now=Date.now()){
  const data=normalize(raw,now),seconds=clamp(now-data.lastAt,0,MAX_AGE_MS)/1000,production=rates(data,levels),max=capacity(levels);
  return {...data,oil:Math.min(max,data.oil+seconds*production.oil),
    gas:Math.min(max,data.gas+seconds*production.gas),lastAt:now};
 }
 function nearPlatform(p){return Boolean(p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))&&
   Math.hypot(Number(p.x)-PLATFORM_X,Number(p.y)-PLATFORM_Y)<=175);}
 function transition(raw,levels,action,player,well=null,now=Date.now()){
  if(!Number(levels?.offshoreSurvey)||!Number(levels?.offshorePlatform)||!Number(levels?.subseaUmbilical))
   return {ok:false,reason:'missing-research'};
  const data=accrue(raw,levels,now),limit=integer(levels.subseaUmbilical,MAX_LINKS);
  if(action==='start'){
   if(!nearPlatform(player))return {ok:false,reason:'platform-distance'};
   if(data.installation)return {ok:false,reason:'installation-already-in-progress'};
   if(data.connections.length>=limit)return {ok:false,reason:'no-free-pipelines'};
   return {ok:true,state:{...data,installation:{phase:'laying',startedAt:now}},phase:'laying'};
  }
  if(action==='connect'){
   if(data.installation?.phase!=='laying')return {ok:false,reason:'start-at-platform'};
   const target=cleanWell(well);if(!target)return {ok:false,reason:'invalid-reservoir'};
   if(!player||Math.hypot(Number(player.x)-target.x,Number(player.y)-target.y)>155)
    return {ok:false,reason:'well-distance'};
   if(data.connections.some(link=>link.id===target.id||(link.type===target.type&&Math.hypot(link.x-target.x,link.y-target.y)<85)))
    return {ok:false,reason:'well-already-linked'};
   return {ok:true,state:{...data,installation:{...data.installation,phase:'return',target}},phase:'return'};
  }
  if(action==='finish'){
   if(!nearPlatform(player))return {ok:false,reason:'platform-distance'};
   if(data.installation?.phase!=='return'||!data.installation.target)return {ok:false,reason:'connect-well-first'};
   if(data.connections.length>=limit)return {ok:false,reason:'no-free-pipelines'};
   const target=data.installation.target;
   if(data.connections.some(link=>link.id===target.id))return {ok:false,reason:'well-already-linked'};
   return {ok:true,state:{...data,connections:[...data.connections,{...target,connectedAt:now}],installation:null},phase:'producing'};
  }
  return {ok:false,reason:'invalid-action'};
 }
 return Object.freeze({PLATFORM_X,PLATFORM_Y,MAX_LINKS,capacity,rates,normalize,accrue,nearPlatform,transition});
});
