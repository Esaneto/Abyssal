/* Wildlife silhouettes for the Mar Aberto only.
 * Naturalistic body plans: no shared spherical monster geometry.
 * Rendering stays within the camera-culling already done in game.js.
 */
(function(root){
 'use strict';
 const TAU=Math.PI*2;
 // Palette is read directly from the Specimens shop catalog. Keeping the
 // drawing functions separate means each approved silhouette stays unchanged.
 const LEGACY_COLORS=Object.freeze({reefshark:'#507989',leviathan:'#607e8f',angler:'#76947b'});
 const paletteCache=new Map();
 function mix(hex,factor){
  const n=parseInt(hex.slice(1),16),c=[(n>>16)&255,(n>>8)&255,n&255];
  return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(factor>=0?v+(255-v)*factor:v*(1+factor)))).toString(16).padStart(2,'0')).join('');
 }
 function alpha(hex,opacity){
  const n=parseInt(hex.slice(1),16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+opacity+')';
 }
 function paletteFor(id){
  const catalog=root.AbyssalCuratedSkins?.byId?.[id]?.color;
  const legacy=root.AbyssalGameHooks?.skinForId?.(id)?.color;
  const hex= /^#[0-9a-fA-F]{6}$/.test(catalog)?catalog:
   /^#[0-9a-fA-F]{6}$/.test(legacy)?legacy:LEGACY_COLORS[id]||'#688395';
  const cached=paletteCache.get(id);
  if(cached?.primary.toLowerCase()===hex.toLowerCase())return cached;
  // Preserve each real Specimens catalog color, but lift midtones for the
  // vivid biological silhouettes seen through shallow blue water.
  const p=Object.freeze({primary:hex,mid:mix(hex,.06),dark:mix(hex,-.36),deep:mix(hex,-.62),
   light:mix(hex,.49),highlight:mix(hex,.78),soft:alpha(hex,.79),veil:alpha(hex,.48)});
  paletteCache.set(id,p);return p;
 }
 function path(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
 function curve(c,coords,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(coords[0],coords[1]);c.bezierCurveTo(...coords.slice(2));c.stroke();}
 function eye(c,x,y){c.fillStyle='#d9e1d9';c.beginPath();c.arc(x,y,2.3,0,TAU);c.fill();c.fillStyle='#061119';c.beginPath();c.arc(x+.5,y,.9,0,TAU);c.fill();}
 function fish(c,t,species,p){
  const shark=/shark|goblin|frilled|leviathan/.test(species),angler=species==='angler',flap=Math.sin(t*.006)*7;
  if(angler){
   path(c,[[-66,-9],[-44,-25],[3,-31],[32,-17],[48,-5],[53,26],[22,40],[-25,24]],p.mid);
   path(c,[[28,-7],[69,-17],[62,31],[17,28]],p.deep);eye(c,34,-12);
   for(let j=0;j<7;j++)path(c,[[23+j*6,-9+j*.4],[27+j*6,1+j*.7],[31+j*6,-9+j*.4]],'#e6dec7');
   path(c,[[-60,-8],[-94,-31+flap],[-85,20+flap]],p.dark);
   curve(c,[31,-25,39,-58,70,-66,79,-39],p.light,2.3);
   c.shadowColor='#8cebc7';c.shadowBlur=12;c.fillStyle='#a8f6d4';c.beginPath();c.arc(79,-39,6,0,TAU);c.fill();c.shadowBlur=0;return;
  }
  path(c,[[-78,0],[-110,-32-flap],[-106,28+flap],[-78,6]],p.dark);
  const body=c.createLinearGradient(0,-30,0,36);body.addColorStop(0,p.primary);body.addColorStop(.42,p.light);body.addColorStop(1,p.deep);
  c.fillStyle=body;c.beginPath();c.moveTo(-84,0);c.bezierCurveTo(-47,-29,12,-31,66,-8);c.quadraticCurveTo(95,-1,75,10);c.bezierCurveTo(25,40,-45,24,-84,0);c.fill();
  path(c,[[-34,-19],[-7,-62], [8,-18]],p.mid);
  path(c,[[9,18],[-13,40],[-28,21]],p.dark);
  path(c,[[58,11],[74,13],[59,19]],p.deep);eye(c,60,-12);
  // The gills, curved lateral line and translucent pectoral fins belong to a
  // recognizable fish anatomy rather than a generic polygon monster.
  path(c,[[-2,10],[22,29],[18,9]],alpha(p.light,.58));
  c.strokeStyle=alpha(p.highlight,.60);c.lineWidth=1.5;c.beginPath();
  c.moveTo(-69,-6);c.bezierCurveTo(-33,-16,12,-16,48,-10);c.stroke();
  for(let j=0;j<4;j++){
   c.strokeStyle=alpha(p.deep,.54);c.lineWidth=1.7;
   c.beginPath();c.moveTo(28+j*5,-11);c.quadraticCurveTo(19+j*5,0,28+j*5,10);c.stroke();
  }
  c.strokeStyle=alpha(p.highlight,.40);c.lineWidth=1;c.beginPath();
  c.moveTo(-49,13);c.bezierCurveTo(-16,23,24,21,52,11);c.stroke();
  c.strokeStyle=p.deep;c.lineWidth=1.4;c.beginPath();
  c.moveTo(68,5);c.quadraticCurveTo(80,8,85,2);c.stroke();
  if(species==='goblin'){path(c,[[77,-10],[116,-18],[83,-4]],p.highlight);}
  if(species==='frilled'){for(let j=0;j<5;j++)curve(c,[44-j*5,-17,43-j*5,-5,45-j*5,0,43-j*5,10],'#9f7777',1.2);}
  if(species==='blackdragon'||species==='viperfish'){for(let j=0;j<9;j++){c.fillStyle='#80d7d1';c.beginPath();c.arc(-58+j*14,14+Math.sin(j)*3,1.5,0,TAU);c.fill();}}
 }
 function eel(c,t,species,p){
  const sw=Math.sin(t*.004)*17,long=/whiplash|bigfin/.test(species);
  const length=long?170:130;
  c.strokeStyle=/blackdragon|viperfish/.test(species)?p.deep:p.dark;c.lineCap='round';
  c.lineWidth=15;c.beginPath();c.moveTo(70,0);c.bezierCurveTo(15,-18,-20,19+sw,-length,-sw*.4);c.stroke();
  c.strokeStyle=p.light;c.lineWidth=2;c.beginPath();c.moveTo(47,-8);c.bezierCurveTo(8,-25,-40,8+sw,-length+12,-sw*.4);c.stroke();
  path(c,[[46,-12],[76,-11],[88,5],[60,17],[46,7]],p.primary);eye(c,73,-7);
  path(c,[[65,9],[91,17],[86,3]],p.deep);
  if(species==='viperfish'||species==='blackdragon')for(let i=0;i<7;i++){
   path(c,[[65+i*2,8],[71+i*2,19],[75+i*2,8]],'#9bb2b1');
  }
 }
 function bigfinSquid(c,t,p){
  const flap=Math.sin(t*.0036)*12;
  // Bigfin squid: slender mantle, oversized paired fins and very long suspended arms.
  path(c,[[-26,-9],[-56,-34-flap],[-49,8],[-23,16]],p.dark);
  path(c,[[2,-10],[29,-37+flap],[32,7],[6,21]],p.primary);
  c.fillStyle=p.soft;c.beginPath();c.moveTo(-31,-12);
  c.bezierCurveTo(-9,-28,31,-23,43,-7);c.quadraticCurveTo(50,13,26,23);
  c.bezierCurveTo(0,29,-31,13,-31,-12);c.fill();
  eye(c,39,-4);
  for(let j=0;j<8;j++){
   const oy=(j-3.5)*4;
   curve(c,[32,oy,53,oy+6,70,oy+Math.sin(t*.002+j)*6,66,oy+45],p.light,1.8);
   curve(c,[66,oy+45,66,oy+80,86+Math.sin(t*.001+j)*15,oy+110,80+Math.sin(t*.002+j)*20,oy+142],alpha(p.light,.55),1.2);
  }
 }
 function ray(c,t,p){
  const wing=Math.sin(t*.0043)*13;
  path(c,[[-105,-4],[-155,-12],[-180,-14],[-155,-7],[-105,2]],p.dark);
  c.fillStyle=p.primary;c.beginPath();c.moveTo(75,1);c.bezierCurveTo(19,-38,-24,-86-wing,-75,-56-wing);
  c.quadraticCurveTo(-7,-1,-75,56+wing);c.bezierCurveTo(-18,70+wing,40,17,75,1);c.fill();
  c.strokeStyle=p.highlight;c.lineWidth=2.2;c.stroke();
  curve(c,[66,1,15,0,-42,0,-150,3],p.light,2.5);eye(c,51,-7);
  for(let k=0;k<14;k++){
   const q=k/13,rx=-52+q*92,ry=Math.sin(q*Math.PI)*28;
   c.fillStyle='rgba(195,245,255,.75)';c.beginPath();
   c.arc(rx,ry*.75,1.5,0,TAU);c.arc(rx,-ry*.75,1.5,0,TAU);
   c.arc(rx*.8,ry*.4,1.2,0,TAU);c.arc(rx*.8,-ry*.4,1.2,0,TAU);c.fill();
  }
 }
 function turtle(c,t,p){
  const flap=Math.sin(t*.0036)*20;
  path(c,[[-48,-20],[-94,-38-flap],[-75,-4],[-50,7]],p.dark);
  path(c,[[-41,14],[-92,39+flap],[-62,46],[-25,25]],p.dark);
  path(c,[[20,-18],[45,-64+flap],[65,-50+flap],[47,8]],p.mid);
  path(c,[[13,22],[47,50-flap],[66,44-flap],[28,10]],p.mid);
  c.fillStyle=p.primary;c.beginPath();c.ellipse(0,0,58,36,0,0,TAU);c.fill();
  c.strokeStyle=p.highlight;c.lineWidth=2.5;c.stroke();
  c.save();c.strokeStyle=alpha(p.highlight,.45);c.lineWidth=1.8;
  for(let i=0;i<3;i++){
   const cx=-24+i*24;
   c.beginPath();
   c.moveTo(cx-11,0);c.lineTo(cx-6,-13);c.lineTo(cx+6,-13);
   c.lineTo(cx+11,0);c.lineTo(cx+6,13);c.lineTo(cx-6,13);c.closePath();c.stroke();
   c.beginPath();c.moveTo(cx-6,-13);c.lineTo(cx-14,-28);
   c.moveTo(cx+6,-13);c.lineTo(cx+14,-28);
   c.moveTo(cx-6,13);c.lineTo(cx-14,28);
   c.moveTo(cx+6,13);c.lineTo(cx+14,28);c.stroke();
  }
  c.restore();
  c.fillStyle=p.mid;c.beginPath();c.ellipse(62,-2,20,14,0,0,TAU);c.fill();
  c.strokeStyle=alpha(p.highlight,.6);c.lineWidth=1.5;c.stroke();
  eye(c,70,-7);
 }
 function crab(c,t,spider=false,p){
  const step=Math.sin(t*.0028)*8;
  for(let side of [-1,1])for(let i=0;i<4;i++){
   const anchor=(i-1.5)*17;
   const len=spider?79:57;
   curve(c,[anchor,side*12,anchor-5,side*20,anchor-17+i*8,side*(len*.68+step),anchor-22+i*13,side*(len+step)],p.dark,spider?3:5);
  }
  path(c,[[-48,-12],[-26,-23],[25,-22],[52,-8],[43,22],[-38,19]],p.dark);
  path(c,[[-46,-7],[-27,-17],[22,-15],[42,-4],[32,8],[-32,10]],p.primary);
  for(let a of [-1,1]){c.fillStyle=p.mid;c.beginPath();c.arc(35,a*22,9,0,TAU);c.fill();}
  eye(c,34,-12);eye(c,34,1);
 }
 function nautilus(c,t,p){
  c.fillStyle=p.primary;c.beginPath();c.arc(-13,0,49,0,TAU);c.fill();
  c.strokeStyle=p.highlight;c.lineWidth=4;c.beginPath();
  for(let i=0;i<70;i++){const q=i/69*3.9*Math.PI,r=3+q*3.25,x=-13+r*Math.cos(q),y=r*Math.sin(q);
   if(!i)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();
  path(c,[[2,-26],[57,-16],[73,12],[19,27]],p.dark);eye(c,47,-10);
  for(let j=0;j<8;j++)curve(c,[58,j*3-10,78,Math.sin(t*.003+j)*7+j*3-12,92+j*2,j*4-20,106+j*4,j*4-12],p.light,1.5);
 }
 function octopus(c,t,p){
  c.fillStyle=p.primary;c.beginPath();c.ellipse(23,-16,36,43,.1,0,TAU);c.fill();
  for(let i=0;i<8;i++){
   const q=(i-3.5)/3.5,sw=Math.sin(t*.003+i)*13;
   curve(c,[13+q*12,15,6+q*34,51,sw+q*58,74,sw+q*42,96],i%2?p.light:p.dark,8-i*.45);
  }eye(c,39,-16);
 }
 function seaPig(c,t,p){
  c.fillStyle=p.primary;c.beginPath();c.moveTo(-74,-9);c.bezierCurveTo(-56,-34,48,-28,68,-3);c.quadraticCurveTo(52,35,-58,21);c.closePath();c.fill();
  for(let j=0;j<7;j++)curve(c,[-54+j*17,7,-51+j*16,30,-42+j*17,42+Math.sin(t*.003+j)*4,-37+j*17,45],p.light,3);
  for(let j=0;j<5;j++)curve(c,[53,0,68+j*3,-12,76+j*4,-4,90+j*4,-10],p.mid,2);
 }
 function jelly(c,t,siphon=false,p){
  if(siphon){
   curve(c,[-110,0,-55,Math.sin(t*.003)*9,30,-8,105,1],p.primary,3);
   for(let i=0;i<16;i++){const x=-99+i*13; c.fillStyle=i%2?alpha(p.light,.31):p.veil;c.beginPath();c.ellipse(x,Math.sin(i*.7+t*.002)*6,6,9,i*.4,0,TAU);c.fill();}
  }else{
   c.fillStyle=p.veil;c.beginPath();c.moveTo(-45,0);c.bezierCurveTo(-45,-68,55,-74,59,1);c.quadraticCurveTo(7,23,-45,0);c.fill();
   c.strokeStyle=alpha(p.highlight,.8);c.lineWidth=2;c.stroke();
   // Bell thickness and internal radial chambers create a luminous volume.
   c.strokeStyle=alpha(p.light,.45);c.lineWidth=2;c.beginPath();
   c.ellipse(7,-5,42,27,0,Math.PI*1.05,Math.PI*1.94);c.stroke();
   c.fillStyle=alpha(p.highlight,.23);
   for(let i=0;i<5;i++){c.beginPath();c.ellipse(-21+i*13,-9,4,15,i*.05,0,TAU);c.fill();}
   for(let j=0;j<11;j++)curve(c,[-36+j*9,8,-44+j*9,32,-38+j*9,55+Math.sin(t*.002+j)*9,-30+j*9,88],alpha(p.mid,.43),1.4);
  }
 }
 const known=new Set(['reefshark','goblin','frilled','leviathan','viperfish','blackdragon','zebramoray','whiplash','bigfin','butterflyray','eagleray','stingray','hawksbill','leatherback','spidercrab','yeticrab','nautilus','seapig','angler','siphonophore']);
 function draw(ctx,enemy,r,time){
  const kind=String(enemy?.specimenSkinId||'');
  if(!known.has(kind))return false;
  const p=paletteFor(kind);
  const size=Math.min(2.3,Math.max(.22,Number(r)||32)/57);
  const now=Number(time)||0,t=now+((Number(enemy.phase)||0)*570);
  // Smooth presentation angle only, keeping AI and server authority intact.
  const desired=Number(enemy.angle)||0,prev=Number(enemy.faunaDrawAngle),last=Number(enemy.faunaDrawAt);
  if(!Number.isFinite(prev)||!Number.isFinite(last)||now<last||now-last>600)enemy.faunaDrawAngle=desired;
  else {
   const delta=Math.atan2(Math.sin(desired-prev),Math.cos(desired-prev));
   const alpha=Math.min(1,1-Math.exp(-Math.min(65,Math.max(0,now-last))*.009));
   enemy.faunaDrawAngle=prev+delta*alpha;
  }
  enemy.faunaDrawAt=now;
  ctx.save();ctx.translate(enemy.x,enemy.y);
  ctx.rotate(enemy.faunaDrawAngle+Math.sin(t*.0017)*.012);
  ctx.scale(size,size);
  if(/shark|goblin|frilled|leviathan/.test(kind))fish(ctx,t,kind,p);
  else if(/zebramoray|whiplash|viperfish|blackdragon/.test(kind))eel(ctx,t,kind,p);
  else if(kind==='bigfin')bigfinSquid(ctx,t,p);
  else if(/ray/.test(kind))ray(ctx,t,p);
  else if(/hawksbill|leatherback/.test(kind))turtle(ctx,t,p);
  else if(/crab/.test(kind))crab(ctx,t,kind==='spidercrab',p);
  else if(kind==='nautilus')nautilus(ctx,t,p);
  else if(kind==='seapig')seaPig(ctx,t,p);
  else if(kind==='angler')fish(ctx,t,kind,p);
  else jelly(ctx,t,kind==='siphonophore',p);
  if(enemy.hit>0){ctx.globalAlpha=Math.min(.35,Number(enemy.hit)*.4);ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(0,0,65,32,0,0,TAU);ctx.fill();}
  ctx.restore();return true;
 }
 root.AbyssalFaunaAnatomy=Object.freeze({draw,paletteFor,supported:id=>known.has(String(id))});
})(typeof window==='object'?window:globalThis);
