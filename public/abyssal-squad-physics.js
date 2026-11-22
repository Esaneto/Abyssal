/* ABYSSAL Expedition: pure terrain, collision and depth contract.
 * No mutations to the classic world or persistent player data.
 */
(function(root, factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AbyssalSquadPhysics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(n,b));
const DIFFICULTY=Object.freeze({
  canyons:{tier:1,bossKind:'boss',bossName:'Guardião do Cânion'},
  gardens:{tier:1,bossKind:'angler',bossName:'Pescador Luminoso'},
  corals:{tier:2,bossKind:'maw',bossName:'Mandíbula Coralina'},
  black:{tier:2,bossKind:'leviathan',bossName:'Leviatã dos Recifes'},
  kelp:{tier:3,bossKind:'whiteSharkBoss',bossName:'Tubarão Branco Ancião'},
  vents:{tier:3,bossKind:'kraken',bossName:'Kraken das Fumarolas'},
  crystals:{tier:4,bossKind:'riftSmile',bossName:'Pesadelo Roxo'},
  hadal:{tier:4,bossKind:'devourer',bossName:'Devorador Hadal'}
});
function pointInPolygon(points,x,y){let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
}
function segmentDistance2(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1];const t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return (x-a[0]-dx*t)**2+(y-a[1]-dy*t)**2;}
function polyHit(points,x,y,r=0){
 if(pointInPolygon(points,x,y))return true;
 if(!r)return false;
 for(let i=0,j=points.length-1;i<points.length;j=i++)if(segmentDistance2(x,y,points[i],points[j])<r*r)return true;
 return false;
}
const cache=new WeakMap();
function obstacles(world){
 let row=cache.get(world);if(row)return row;
 row=[];
 for(const rock of world.rocks||[]){
  if(!Array.isArray(rock.points))continue;
  // Decorative rocks must not close the navigable chamber or its single entrance.
  if(!rock.classic&&(world.caves||[]).some(c=>Math.hypot(rock.x-c.x,rock.y-c.y)<c.r*1.48+Math.max(rock.rx||0,rock.ry||0)))continue;
  const p=rock.points;row.push({p,minX:Math.min(...p.map(q=>q[0])),maxX:Math.max(...p.map(q=>q[0])),minY:Math.min(...p.map(q=>q[1])),maxY:Math.max(...p.map(q=>q[1]))});
 }
 for(const cave of world.caves||[])for(const p of cave.wallPolygons||[])row.push({p,minX:Math.min(...p.map(q=>q[0])),maxX:Math.max(...p.map(q=>q[0])),minY:Math.min(...p.map(q=>q[1])),maxY:Math.max(...p.map(q=>q[1]))});
 cache.set(world,row);return row;
}
function blocked(world,x,y,r=0){
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<r||y<r||x>world.width-r||y>world.height-r)return true;
 for(const o of obstacles(world)){if(x<o.minX-r||x>o.maxX+r||y<o.minY-r||y>o.maxY+r)continue;if(polyHit(o.p,x,y,r))return true;}
 return false;
}
function move(world,x,y,dx,dy,r=14){
 const d=Math.hypot(dx,dy),n=Math.max(1,Math.ceil(d/Math.max(5,r*.5)));
 const sx=dx/n,sy=dy/n;
 for(let i=0;i<n;i++){
  if(!blocked(world,x+sx,y+sy,r)){x+=sx;y+=sy;continue;}
  if(!blocked(world,x+sx,y,r))x+=sx;
  if(!blocked(world,x,y+sy,r))y+=sy;
 }
 return {x,y};
}
function visible(world,x1,y1,x2,y2){
 const dist=Math.hypot(x2-x1,y2-y1),n=Math.ceil(dist/24);
 for(let i=1;i<n;i++){const t=i/n;if(blocked(world,x1+(x2-x1)*t,y1+(y2-y1)*t,1))return false;}
 return true;
}
function zoneAt(world,x,y){return (world.zones||[]).find(z=>x>=z.x&&y>=z.y&&x<z.x+z.w&&y<z.y+z.h)||null;}
function createEncounters(world){return (world.caves||[]).map(c=>{
 const d=DIFFICULTY[c.zone];if(!d)return null;
 const traps=c.zone==='crystals'?Array.from({length:8},(_,i)=>{
  const angle=(i+.5)*Math.PI/4,r=c.r*.49;
  return {id:c.id+':tentacle:'+i,x:c.x+Math.cos(angle)*r,y:c.y+Math.sin(angle)*r,index:i,radius:46,kind:'tentacle'};
 }):[];
 return {id:c.id,zone:c.zone,tier:d.tier,bossKind:d.bossKind,bossName:d.bossName,x:c.x,y:c.y,r:Math.min(56,25+d.tier*6),hp:100+d.tier*100,traps};
 }).filter(Boolean);}
function trapState(trap,seconds){const p=(seconds+trap.index*1.33)%12;return p>=8.6&&p<10?'active':p>=7.2&&p<8.6?'warning':'idle';}
function safeEntry(world,cave,pad=24){
 const distance=cave.r*1.36,x=cave.x+Math.cos(cave.mouth)*distance,y=cave.y+Math.sin(cave.mouth)*distance;
 if(!blocked(world,x,y,pad))return {x,y};
 for(let j=1;j<18;j++){const d=distance+j*22;const xx=cave.x+Math.cos(cave.mouth)*d,yy=cave.y+Math.sin(cave.mouth)*d;if(!blocked(world,xx,yy,pad))return {x:xx,y:yy};}
 return null;
}
return {DIFFICULTY,blocked,move,visible,zoneAt,obstacles,createEncounters,trapState,safeEntry,pointInPolygon};
});