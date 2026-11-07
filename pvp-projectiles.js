'use strict';
// Swept, server-authoritative PvP projectiles: impacts occur as bullets travel.
// A bounded shared queue avoids one timer per bullet and keeps room CPU stable.
const MAX_PROJECTILES=240;
function enqueue(shots,shot){
 if(!Array.isArray(shots)||!shot||!(Number(shot.speed)>0)||!(Number(shot.remaining)>0))return false;
 if(shots.length>=MAX_PROJECTILES)shots.splice(0,shots.length-MAX_PROJECTILES+1);
 shots.push(shot);return true;
}
function advance(shots,players,now,rockAt,onImpact){
 if(!Array.isArray(shots)||!shots.length)return 0;
 let hits=0;
 for(let i=shots.length-1;i>=0;i--){
  const shot=shots[i];
  if(!players.some(p=>p.id===shot.ownerId&&p.alive!==false)){shots.splice(i,1);continue;}
  const dt=Math.min(.12,Math.max(0,(now-(Number(shot.lastAt)||now))/1000));
  shot.lastAt=now;
  if(now-(Number(shot.createdAt)||now)>8000||shot.remaining<=0||shot.lifetime<=0){shots.splice(i,1);continue;}
  if(dt<=0)continue;
  const distance=Math.min(shot.remaining,shot.speed*dt,shot.speed*shot.lifetime);
  const steps=Math.max(1,Math.ceil(distance/10));
  let stopped=false;
  for(let s=1;s<=steps;s++){
   const px=shot.x+shot.ux*distance*s/steps,py=shot.y+shot.uy*distance*s/steps;
   if(px<0||px>shot.worldWidth||py<0||py>shot.worldHeight||rockAt(px,py,4/shot.worldZoom)){stopped=true;break;}
   for(const target of players){
    if(target.id===shot.ownerId||target.alive===false)continue;
    const radius=Math.max(2,(Number(target.r)||13/shot.worldZoom)+(Number(shot.radius)||5/shot.worldZoom)-2/shot.worldZoom);
    const dx=Number(target.x)-px,dy=Number(target.y)-py;
    if(dx*dx+dy*dy>radius*radius)continue;
    onImpact(shot,target,{x:px,y:py},now);hits++;stopped=true;break;
   }
   if(stopped)break;
  }
  if(stopped){shots.splice(i,1);continue;}
  shot.x+=shot.ux*distance;shot.y+=shot.uy*distance;
  shot.remaining-=distance;shot.lifetime-=distance/Math.max(1,shot.speed);
  if(shot.remaining<=0||shot.lifetime<=0)shots.splice(i,1);
 }
 return hits;
}
module.exports={advance,enqueue,MAX_PROJECTILES};
