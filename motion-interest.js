'use strict';
// Networking priority only. Never use this filter for simulation, collisions or entity lifecycle.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const FAR_INTERVAL_MS=200;
const PRELOAD_MARGIN=420;
function playerInterest(p,width,height){
 const x=Number(p.x)||0,y=Number(p.y)||0,zoom=clamp(Number(p.worldZoom)||.78,.18,1.5);
 const vw=clamp(Number(p.viewportWidth)||1200,320,10000)/zoom,vh=clamp(Number(p.viewportHeight)||700,300,10000)/zoom;
 const left=clamp(x-vw/2,0,Math.max(0,width-vw)),top=clamp(y-vh/2,0,Math.max(0,height-vh));
 const range=clamp(Number(p.clientCombatRange)||294/.78,294/.78,2000/.78)+PRELOAD_MARGIN;
 return {x,y,left:left-PRELOAD_MARGIN,right:left+vw+PRELOAD_MARGIN,top:top-PRELOAD_MARGIN,bottom:top+vh+PRELOAD_MARGIN,range};
}
function selectMotionEnemies(enemies,players,options={}){
 const list=Array.isArray(enemies)?enemies:[],views=players.map(p=>playerInterest(p,options.width,options.height));
 if(options.includeFar||!views.length)return list;
 const bosses=options.bossKinds||new Set(),sub=options.submarine,subRange=Number(options.submarineRange)||0;
 return list.filter(e=>{
  if(bosses.has(e.kind))return true;
  const x=Number(e.x)||0,y=Number(e.y)||0,r=Math.max(0,Number(e.r)||0)*4;
  if(sub&&Number(sub.powerSeconds)>0&&(x-sub.x)**2+(y-sub.y)**2<=(subRange+r)**2)return true;
  for(const v of views){
   if(x+r>=v.left&&x-r<=v.right&&y+r>=v.top&&y-r<=v.bottom)return true;
   if((x-v.x)**2+(y-v.y)**2<=(v.range+r)**2)return true;
  }
  return false;
 });
}
module.exports={FAR_INTERVAL_MS,PRELOAD_MARGIN,playerInterest,selectMotionEnemies};
