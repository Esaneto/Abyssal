/* ABYSSAL Expedition: live canvas artwork for the playable terrain.
 * All drawings are derived from the same world coordinates and collisions.
 * No opaque world-sized image; no gameplay/economy state is modified.
 */
(function(root){
'use strict';
const P={
 origin:['#092936','#56d4df','#1d6573'],
 canyons:['#071d32','#62c7f3','#234a67'],
 gardens:['#07352e','#5bfae3','#2e8e73'],
 corals:['#2c1530','#ff8ec0','#85355e'],
 black:['#101826','#92b1d1','#314156'],
 kelp:['#092c23','#88dfa6','#306e50'],
 crystals:['#1e103b','#cb77ff','#693b9d'],
 hadal:['#071728','#70adf8','#245588'],
 vents:['#2f181a','#ffab69','#934c38']
};
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=(a,b=0)=>{let n=(Math.imul((Math.floor(a)||0),374761393)+Math.imul(Math.floor(b)||0,668265263))|0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
const ring=(c,x,y,r)=>{c.beginPath();c.arc(x,y,Math.max(.2,r),0,TAU);};
function rgb(c,a){const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);return 'rgba('+r+','+g+','+b+','+a+')';}
function visible(p,v){return p.x+p.w>=v.x&&p.y+p.h>=v.y&&p.x<=v.x+v.w&&p.y<=v.y+v.h;}
function glow(c,x,y,r,color,alpha=.2){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgb(color,alpha));g.addColorStop(.42,rgb(color,alpha*.32));g.addColorStop(1,rgb(color,0));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
function rockPath(c,p){c.beginPath();p.forEach((v,i)=>i?c.lineTo(v[0],v[1]):c.moveTo(v[0],v[1]));c.closePath();}
function paintBiome(c,z,v,t){
 if(!visible(z,v))return;
 const [dark,lit,middle]=P[z.id]||P.origin;
 c.save();c.beginPath();c.rect(z.x,z.y,z.w,z.h);c.clip();
 const g=c.createLinearGradient(z.x,z.y,z.x,z.y+z.h);g.addColorStop(0,middle);g.addColorStop(.34,dark);g.addColorStop(1,'#03101c');c.fillStyle=g;c.fillRect(z.x,z.y,z.w,z.h);
 // Organic bathymetry and translucent illuminated geological strata.
 for(let i=0;i<5;i++){
  const y=z.y+z.h*(i+.8)/6,phase=hash(i,z.x)*9;
  c.beginPath();
  for(let k=0;k<=28;k++){const x=z.x+k*z.w/28,yy=y+Math.sin(k*.54+phase)*20+Math.sin(k*.19+i)*37;k?c.lineTo(x,yy):c.moveTo(x,yy);}
  c.strokeStyle=rgb(lit,.037+i*.007);c.lineWidth=2+i*.4;c.stroke();
 }
 // Sparse fixed caustic patterns, deliberately deterministic.
 for(let i=0;i<9;i++){
  const x=z.x+hash(i,z.x)*z.w,y=z.y+hash(i+9,z.y)*z.h;
  if(x<v.x-110||x>v.x+v.w+110||y<v.y-110||y>v.y+v.h+110)continue;
  glow(c,x,y,60+hash(i+4,z.y)*95,lit,.10);
 }
 // Light shafts enter the shallower biomes, not the deep hadal region.
 if(z.y<1600){
  for(let i=0;i<5;i++){
   const x=z.x+z.w*(i+.4)/5;
   c.beginPath();c.moveTo(x-44,z.y);c.lineTo(x+28,z.y);c.lineTo(x+146,z.y+z.h*.85);c.lineTo(x-112,z.y+z.h*.85);c.closePath();
   c.fillStyle=rgb(lit,.018+(1+Math.sin(t*.28+i))*.005);c.fill();
  }
 }
 c.restore();
}
function paintCave(c,cave,t){
 const col=(P[cave.zone]||P.origin)[1],r=cave.r;
 c.save();
 const pit=c.createRadialGradient(cave.x,cave.y,r*.06,cave.x,cave.y,r*.83);
 pit.addColorStop(0,cave.zone==='crystals'?'#1c0632':'#020811');
 pit.addColorStop(.68,cave.zone==='crystals'?'#170d31':'#020c18');
 pit.addColorStop(1,'#020b1400');c.fillStyle=pit;ring(c,cave.x,cave.y,r*.84);c.fill();
 c.strokeStyle=rgb(col,.21);c.lineWidth=4;
 ring(c,cave.x,cave.y,r*.73);c.stroke();
 for(let i=0;i<18;i++){
  const a=i*TAU/18,rr=r*(.64+hash(i,cave.x)*.08);
  const x=cave.x+Math.cos(a)*rr,y=cave.y+Math.sin(a)*rr;
  c.strokeStyle=rgb(col,.12+hash(i,cave.y)*.16);c.lineWidth=2;
  c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*(13+hash(i,8)*27),y+Math.sin(a)*(13+hash(i,9)*27));c.stroke();
 }
 glow(c,cave.x,cave.y,r*.48,col,.12+Math.sin(t*.9)*.025);
 c.restore();
}
function paintRock(c,o,zoneId,t){
 const [dark,lit,mid]=P[zoneId]||P.black,p=o.p;
 if(!p||p.length<3)return;
 let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
 for(const v of p){minx=Math.min(minx,v[0]);maxx=Math.max(maxx,v[0]);miny=Math.min(miny,v[1]);maxy=Math.max(maxy,v[1]);}
 const w=maxx-minx,h=maxy-miny;
 c.save();rockPath(c,p);const gradient=c.createLinearGradient(minx,miny,maxx,maxy);
 gradient.addColorStop(0,mid);gradient.addColorStop(.3,'#1b3441');gradient.addColorStop(.71,dark);gradient.addColorStop(1,'#030b13');c.fillStyle=gradient;c.fill();
 c.lineWidth=3;c.strokeStyle=rgb(lit,.48);c.stroke();c.lineWidth=1;c.strokeStyle='rgba(2,7,13,.72)';c.stroke();
 c.clip();const cx=(minx+maxx)/2,cy=(miny+maxy)/2;
 for(let k=0;k<4;k++){
  const x=minx+w*hash(k,Math.round(miny)),y=miny+h*hash(k+6,Math.round(minx));
  c.strokeStyle=k%2?rgb(lit,.16):'rgba(1,5,10,.53)';c.lineWidth=1.5+k%2;
  c.beginPath();c.moveTo(x,y);c.lineTo(x+w*(hash(k,7)-.5)*.35,y+h*.20);c.lineTo(x+w*(hash(k,11)-.5)*.4,y+h*.45);c.stroke();
 }
 c.restore();
}
function paintFeature(c,f,t){
 const [dark,lit]=P[f.zone]||P.origin,s=Math.max(5,Math.min(27,f.size*1.3));
 c.save();c.translate(f.x,f.y);c.globalAlpha=.45+f.alpha*.46;
 const wave=Math.sin(t*.65+f.x*.027)*s*.17;
 if(f.kind==='crystal'){
  c.shadowColor=lit;c.shadowBlur=16;c.fillStyle=rgb(lit,.38);c.strokeStyle=rgb(lit,.8);c.lineWidth=1.5;
  for(let i=0;i<3;i++){const x=(i-1)*s*.35,sz=s*(.7+hash(i,f.x)*.7);c.beginPath();c.moveTo(x-sz*.28,s*.45);c.lineTo(x-sz*.35,-sz*.1);c.lineTo(x,-sz);c.lineTo(x+sz*.28,-sz*.07);c.lineTo(x+sz*.26,s*.45);c.closePath();c.fill();c.stroke();}
 }else if(f.kind==='glow'){
  c.shadowColor=lit;c.shadowBlur=17;c.lineWidth=2;c.strokeStyle=lit;
  c.beginPath();c.moveTo(0,s*.8);c.quadraticCurveTo(wave,-s*.6,wave,-s);c.stroke();
  for(let i=-1;i<=1;i++){c.fillStyle=i===0?lit:rgb(lit,.75);c.beginPath();c.ellipse(wave+i*s*.28,-s+i*.25*s,s*(.26+(1-Math.abs(i))*.12),s*.16,i*.22,0,TAU);c.fill();}
 }else if(f.kind==='coral'){
  c.lineCap='round';c.strokeStyle=lit;c.lineWidth=2.8;
  c.beginPath();c.moveTo(0,s);c.quadraticCurveTo(wave,0,0,-s);c.moveTo(0,s*.2);c.lineTo(-s*.64,-s*.51);c.moveTo(-s*.34,-s*.16);c.lineTo(-s*.64,-s*.88);c.moveTo(0,-s*.18);c.lineTo(s*.64,-s*.75);c.moveTo(s*.35,-s*.49);c.lineTo(s*.5,-s);c.stroke();
 }else if(f.kind==='kelp'){
  c.strokeStyle=lit;c.lineCap='round';c.lineWidth=2.7;
  for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(i*s*.19,s);c.bezierCurveTo(-s*.42+i*s*.3,-s*.2,s*.28+wave,-s*.46,i*s*.25+wave,-s*(1.4+hash(i+2,f.x)*.6));c.stroke();}
 }else if(f.kind==='vents'){
  c.fillStyle='#3a3031';c.strokeStyle=lit;c.lineWidth=2;
  c.beginPath();c.moveTo(-s*.8,s);c.lineTo(-s*.4,-s*.24);c.lineTo(s*.3,-s*.3);c.lineTo(s*.85,s);c.closePath();c.fill();c.stroke();
  for(let i=-1;i<=1;i++){const dy=-s*(.5+(Math.sin(t*1.1+i+f.x)*.2));c.strokeStyle=rgb(lit,.22+(.08*i));c.beginPath();c.moveTo(i*s*.25,-s*.4);c.bezierCurveTo(i*s*.6,dy,i*s*.05,dy-s*.4,i*s*.3,-s*1.7);c.stroke();}
 }else{
  c.strokeStyle=rgb(lit,.56);c.lineWidth=2;c.beginPath();c.moveTo(-s*.56,s*.82);c.lineTo(-s*.16,-s*.62);c.lineTo(s*.18,-s*.99);c.lineTo(s*.38,-s*.31);c.lineTo(s*.65,s*.65);c.stroke();
 }
 c.restore();
}
function paintBoss(c,e,t){
 const [dark,lit]=P[e.zone]||P.black,r=e.r,kind=e.bossKind||'boss';
 c.save();c.translate(e.x,e.y);c.rotate(Math.sin(t*.9+e.x*.002)*.06);
 glow(c,0,0,r*2.5,lit,.19);
 c.shadowBlur=14;c.shadowColor=lit;c.fillStyle=dark;c.strokeStyle=lit;c.lineWidth=3;
 if(/kraken|devourer/i.test(kind)){
  for(let i=0;i<6;i++){const a=i*TAU/6;c.beginPath();c.moveTo(Math.cos(a)*r*.3,Math.sin(a)*r*.3);c.bezierCurveTo(Math.cos(a+.4)*r,Math.sin(a+.4)*r,Math.cos(a-.3)*r*1.6,Math.sin(a-.3)*r*1.6,Math.cos(a)*r*1.9,Math.sin(a)*r*1.9);c.stroke();}
  c.beginPath();c.ellipse(0,0,r*.65,r*.9,0,0,TAU);c.fill();c.stroke();
 }else if(/maw|whiteShark|leviathan/i.test(kind)){
  c.beginPath();c.moveTo(-r*.92,0);c.quadraticCurveTo(-r*.2,-r*.95,r*.85,-r*.26);c.lineTo(r*1.35,0);c.lineTo(r*.85,r*.28);c.quadraticCurveTo(-r*.2,r*.95,-r*.92,0);c.fill();c.stroke();
  c.beginPath();c.moveTo(-r*.6,0);c.lineTo(-r*1.3,-r*.56);c.lineTo(-r*1.28,r*.54);c.closePath();c.stroke();c.fill();
  c.beginPath();c.moveTo(-r*.1,-r*.47);c.lineTo(r*.12,-r*1.1);c.lineTo(r*.46,-r*.4);c.stroke();
 }else{
  c.beginPath();c.ellipse(0,0,r*.9,r*.72,Math.sin(t)*.06,0,TAU);c.fill();c.stroke();
  for(let i=0;i<7;i++){const a=i*TAU/7;c.beginPath();c.moveTo(Math.cos(a)*r*.6,Math.sin(a)*r*.6);c.lineTo(Math.cos(a)*r*1.18,Math.sin(a)*r*1.18);c.stroke();}
 }
 c.shadowBlur=0;c.fillStyle='#ddfaff';for(const v of [-.23,.26]){ring(c,r*v,-r*.14,Math.max(3,r*.09));c.fill();}
 c.restore();
}
function paintTrap(c,trap,state,t){
 c.save();c.translate(trap.x,trap.y);c.rotate(trap.index*TAU/8);
 const active=state==='active',warning=state==='warning',pulse=1+Math.sin(t*3+trap.index)*.12;
 glow(c,0,0,active?95:58,active?'#ed4b91':'#aa62dd',active?.38:warning?.24:.08);
 c.fillStyle='#10071e';c.strokeStyle=active?'#ff7abb':warning?'#dda1ff':'#5e3978';
 c.lineWidth=active?7:4;c.beginPath();c.moveTo(-12,12);c.bezierCurveTo(-39,-34,27,-35,12,-9);c.bezierCurveTo(-7,12,36,31,54*pulse,-21);c.stroke();
 c.fillStyle='#2c103e';ring(c,0,0,11);c.fill();c.stroke();
 if(warning||active){c.strokeStyle=rgb('#efb3fc',active?.75:.43);c.lineWidth=2;ring(c,0,0,trap.radius+(active?Math.sin(t*10)*4:0));c.stroke();}
 c.restore();
}
function paintDiver(c,p,t){
 // Use the actual animated Abyssal diver art when available.
 if(root.AbyssalDiverArt?.draw){try{root.AbyssalDiverArt.draw(c,p.x,p.y,15,p.aim||0,p.aim||0,t*1000,{gender:root.AbyssalDiverGender||'male',moving:true});return;}catch(_error){/* procedural fallback */}}
 c.save();c.translate(p.x,p.y);c.rotate(p.aim||0);
 c.shadowColor='#60e8e9';c.shadowBlur=12;
 c.strokeStyle='#72e7ee';c.fillStyle='#102c3c';c.lineWidth=2.2;
 c.beginPath();c.ellipse(0,0,16,8,0,0,TAU);c.fill();c.stroke();
 c.fillStyle='#a0d9de';c.fillRect(-6,-5,11,10);
 c.beginPath();c.moveTo(-13,0);c.lineTo(-27,-9+Math.sin(t*8)*4);c.lineTo(-25,9-Math.sin(t*8)*4);c.closePath();c.stroke();c.fillStyle='#387185';c.fill();
 c.fillStyle='#d6f9f9';c.beginPath();c.ellipse(10,-2,6,4,0,0,TAU);c.fill();
 c.strokeStyle='#c2faff';c.beginPath();c.moveTo(8,0);c.lineTo(26,0);c.stroke();
 c.restore();
}
function paintChartDetail(c,z,x,y,w,h,t){
 const [dark,lit]=P[z.id]||P.origin;if(w<10||h<10)return;
 c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
 // Draw miniature silhouettes tied to the actual biome, behind chart rocks and cave openings.
 for(let k=0;k<7;k++){
  const px=x+w*hash(k,z.x+9),py=y+h*(.1+.76*hash(k+17,z.y+7));
  const sz=clamp(Math.min(w,h)*(.06+hash(k+4,z.x)*.12),3,55);
  c.strokeStyle=rgb(lit,.2);c.fillStyle=rgb(lit,.08);c.lineWidth=clamp(w/175,.7,2);
  c.beginPath();
  if(z.id==='corals'||z.id==='kelp'||z.id==='gardens'){
   c.moveTo(px,py+sz);c.quadraticCurveTo(px-sz*.48,py,px,py-sz);
   c.moveTo(px,py);c.lineTo(px-sz*.7,py-sz*.55);c.moveTo(px,py-sz*.35);c.lineTo(px+sz*.65,py-sz*.83);
  }else{
   c.moveTo(px-sz*.64,py+sz);c.lineTo(px-sz*.23,py-sz*.67);c.lineTo(px,py-sz*1.27);c.lineTo(px+sz*.25,py-sz*.5);c.lineTo(px+sz*.63,py+sz);
  }c.stroke();
 }
 c.restore();
}
root.AbyssalSquadVisuals=Object.freeze({paintBiome,paintCave,paintRock,paintFeature,paintBoss,paintTrap,paintDiver,paintChartDetail});
})(typeof globalThis!=='undefined'?globalThis:this);
