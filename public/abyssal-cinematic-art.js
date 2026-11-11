/* Abyssal cinematic lighting pass: original, asset-free 2.5D artwork.
 * Same lighting language in the panoramic cabin and the streamed Open Sea.
 * Every operation is viewport-bounded, and the full pass is optional.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalCinematicArt=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const grad=(c,x,y,x2,y2,stops)=>{
  const g=c.createLinearGradient(x,y,x2,y2);
  for(const stop of stops)g.addColorStop(stop[0],stop[1]);
  return g;
 };
 const polygon=(c,points,fill,stroke,width)=>{
  c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));
  c.closePath();c.fillStyle=fill;c.fill();
  if(stroke){c.lineWidth=width||1;c.strokeStyle=stroke;c.stroke();}
 };
 // Drawn behind the existing reef fauna and forward rocky shelves.
 function cabinBackdrop(c,t){
  c.save();
  const air=c.createLinearGradient(0,102,0,580);
  air.addColorStop(0,'rgba(34,195,227,.12)');
  air.addColorStop(.45,'rgba(17,104,149,.08)');
  air.addColorStop(1,'rgba(4,22,43,.37)');
  c.fillStyle=air;c.fillRect(40,105,1360,475);
  const light=c.createRadialGradient(965,107,15,945,155,580);
  light.addColorStop(0,'rgba(119,255,250,.38)');
  light.addColorStop(.35,'rgba(62,217,243,.14)');
  light.addColorStop(1,'rgba(20,95,147,0)');
  c.fillStyle=light;c.fillRect(120,105,1200,460);
  // Large overhead natural arch, fractured basalt facets and cool rim lighting.
  c.fillStyle='#081c2c';
  polygon(c,[[0,105],[1440,105],[1376,156],[1260,151],[1175,126],[1038,154],[926,148],
    [836,212],[769,187],[708,226],[623,181],[538,170],[450,210],[370,163],[258,184],
    [157,161],[60,179],[0,205]],grad(c,0,100,710,225,[[0,'#061725'],[.48,'#0b2c42'],[1,'#071b2e']]));
  polygon(c,[[400,164],[535,169],[617,181],[703,223],[773,186],[839,213],[926,147],
   [835,150],[755,121],[609,144]],'rgba(20,72,92,.54)');
  c.strokeStyle='rgba(60,166,178,.19)';c.lineWidth=2.2;c.beginPath();
  c.moveTo(373,165);c.lineTo(447,211);c.lineTo(536,171);c.lineTo(621,182);
  c.lineTo(703,225);c.lineTo(773,187);c.lineTo(839,212);c.stroke();
  // Volumetric shafts are screen-composited and tapered with depth.
  c.globalCompositeOperation='screen';
  for(let i=0;i<9;i++){
   const x=680+i*64+Math.sin(t*.00019+i)*9;
   const beam=grad(c,x,112,x+100,560,[[0,'rgba(190,252,247,.13)'],[.48,'rgba(78,211,236,.055)'],[1,'rgba(24,146,183,0)']]);
   polygon(c,[[x,107],[x+13,107],[x+115,548],[x+33,548]],beam);
  }
  c.globalCompositeOperation='source-over';
  // Distinct deep ocean windows through canyon arches, no flat skyline.
  c.globalAlpha=.3;
  for(let i=0;i<4;i++){
   const ox=220+i*315,oy=485+(i%2)*15;
   c.strokeStyle='#052b41';c.lineWidth=46;c.lineCap='round';
   c.beginPath();c.moveTo(ox-114,oy+44);c.bezierCurveTo(ox-72,oy-100,ox+65,oy-107,ox+120,oy+44);c.stroke();
   c.strokeStyle='rgba(80,181,198,.26)';c.lineWidth=3;
   c.beginPath();c.moveTo(ox-100,oy+1);c.bezierCurveTo(ox-65,oy-100,ox+61,oy-99,ox+101,oy+1);c.stroke();
  }
  c.globalAlpha=1;c.restore();
 }
 function crystal(c,x,y,s,t){
  c.save();c.translate(x,y);c.scale(s,s);
  c.shadowColor='#44e9ef';c.shadowBlur=16;
  const glow=c.createRadialGradient(0,0,2,0,0,68);
  glow.addColorStop(0,'rgba(61,236,244,.26)');
  glow.addColorStop(1,'rgba(33,176,206,0)');
  c.fillStyle=glow;c.fillRect(-70,-70,140,140);
  c.shadowBlur=0;
  const shards=[[-39,24,-27,-15,-13,18],[-15,25,-8,-52,8,23],
   [8,24,32,-34,35,24],[29,25,48,-14,51,26]];
  for(let i=0;i<shards.length;i++){
   const a=shards[i],shine=.7+.2*Math.sin(t*.001+i);
   polygon(c,[[a[0],a[1]],[a[1],a[3]],[a[2],a[5]]], 
    grad(c,-25,-48,42,25,[[0,'rgba(196,255,250,'+shine+')'],[.34,'rgba(56,224,247,.88)'],[1,'rgba(18,91,141,.78)']]),
    'rgba(153,253,246,.82)',1.5);
  }
  c.restore();
 }
 function cabinForeground(c,t){
  c.save();
  // Sunlight reaches the sandy shelf before it disappears in blue haze.
  const sand=grad(c,0,474,0,573,[[0,'rgba(22,110,125,.01)'],[.51,'rgba(47,172,182,.14)'],[1,'rgba(50,161,169,.26)']]);
  c.fillStyle=sand;c.fillRect(260,468,950,107);
  for(let i=0;i<20;i++){
   const x=290+i*49,y=529+(i%4)*9;
   c.strokeStyle=i%4===0?'rgba(141,244,234,.22)':'rgba(97,203,212,.12)';
   c.lineWidth=1.3;c.beginPath();c.moveTo(x-35,y+4);
   c.quadraticCurveTo(x+Math.sin(t*.0002+i)*5,y-4,x+42,y+3);c.stroke();
  }
  crystal(c,447,496,.68,t);
  crystal(c,1160,520,.34,t+1100);
  for(let i=0;i<16;i++){
   const x=115+i*83,y=420+(i*51)%117;
   const alpha=.14+((i*3)%7)*.04;
   c.fillStyle='rgba(165,244,235,'+alpha+')';
   c.beginPath();c.arc(x+Math.sin(t*.0003+i)*2,y,1.2+i%3*.4,0,TAU);c.fill();
  }
  c.restore();
 }
 function cabinInterior(c,t){
  c.save();
  // The workstation's HTML keys remain above the canvas; these are scenic
  // diegetic instruments, not duplicate controls.
  const podium=grad(c,0,615,0,835,[[0,'rgba(6,28,43,.1)'],[.6,'rgba(0,12,24,.32)'],[1,'rgba(2,11,21,.53)']]);
  c.fillStyle=podium;c.fillRect(0,650,1440,205);
  for(const [x,y,w,h] of [[345,649,174,72],[1140,690,178,78]]){
   c.fillStyle='#051824';c.strokeStyle='rgba(87,210,226,.52)';c.lineWidth=3;
   c.beginPath();c.roundRect(x,y,w,h,11);c.fill();c.stroke();
   const scan=grad(c,x,y,x+w,y+h,[[0,'rgba(37,166,185,.31)'],[.5,'rgba(5,57,78,.47)'],[1,'rgba(10,27,45,.66)']]);
   c.fillStyle=scan;c.fillRect(x+8,y+8,w-16,h-16);
   c.strokeStyle='rgba(89,231,243,.45)';c.lineWidth=1;
   for(let i=1;i<5;i++){c.beginPath();c.moveTo(x+10,y+12+i*9);c.lineTo(x+w-10,y+12+i*9);c.stroke();}
   c.save();c.translate(x+w*.52,y+h*.54);
   c.strokeStyle='rgba(140,255,249,.72)';c.lineWidth=2;c.beginPath();
   c.arc(0,0,Math.min(w*.28,h*.34),0,TAU);c.stroke();
   c.rotate(t*.0004);c.beginPath();c.moveTo(0,0);c.lineTo(28,0);c.stroke();c.restore();
  }
  // Physically motivated warm control-lamp reflections on black metal.
  for(let i=0;i<8;i++){
   const x=296+i*121,y=692+(i%2)*16;
   c.fillStyle=i%3===0?'#f6c579':'#4ed9e0';c.shadowColor=c.fillStyle;c.shadowBlur=9;
   c.beginPath();c.arc(x,y,2.4,0,TAU);c.fill();
  }
  c.shadowBlur=0;
  c.restore();
 }

 // Camera-facing reef ledges, cinematic ocean fauna and a real animated
 // playable-diver renderer. All effects stay behind the command deck.
 function cabinLiveWorld(c,t,diverRenderer,gender,photographic=false){
  c.save();
  if(!photographic){
  // Sculpted multi-plane rock platforms with separate top, side and shadow.
  const ledges=[
   {x:44,y:460,w:292,h:120,flip:1},
   {x:1080,y:435,w:353,h:165,flip:-1},
   {x:325,y:530,w:225,h:90,flip:1},
   {x:1077,y:546,w:265,h:91,flip:-1}
  ];
  for(let n=0;n<ledges.length;n++){
   const a=ledges[n];
   c.save();c.translate(a.x,a.y);c.scale(a.flip,1);
   const stone=grad(c,-a.w*.8,-a.h,a.w*.15,a.h,[
    [0,'#235f76'],[.27,'#1b4965'],[.57,'#10334e'],[1,'#061929']]);
   polygon(c,[[-a.w*.74,0],[-a.w*.63,-a.h*.34],[-a.w*.25,-a.h*.48],
    [0,-a.h*.42],[a.w*.27,-a.h*.27],[a.w*.15,0],[a.w*.09,a.h*.54],
    [-a.w*.18,a.h*.56],[-a.w*.48,a.h*.30]],stone,'rgba(80,177,193,.28)',1.4);
   polygon(c,[[-a.w*.74,0],[-a.w*.63,-a.h*.34],[-a.w*.25,-a.h*.48],
    [0,-a.h*.42],[-a.w*.19,-a.h*.02]],grad(c,0,-a.h*.55,0,a.h*.2,
    [[0,'#276e82'],[1,'#0d334d']]),'rgba(100,209,215,.2)',1.4);
   polygon(c,[[0,-a.h*.42],[a.w*.27,-a.h*.27],[a.w*.15,0],
    [a.w*.09,a.h*.54],[-a.w*.05,a.h*.2]],'#0a263d');
   c.strokeStyle='rgba(109,212,218,.34)';c.lineWidth=2;
   c.beginPath();c.moveTo(-a.w*.65,-a.h*.32);c.lineTo(-a.w*.26,-a.h*.46);
   c.lineTo(0,-a.h*.41);c.lineTo(a.w*.23,-a.h*.27);c.stroke();
   // Faceted geological cracks and narrow reflective striations.
   for(let k=0;k<8;k++){
    const px=-a.w*.56+k*a.w*.095,py=-a.h*.16+(k%3)*a.h*.08;
    c.strokeStyle=k%3?'rgba(3,15,29,.38)':'rgba(109,194,204,.16)';
    c.lineWidth=1.5;c.beginPath();c.moveTo(px,py);c.lineTo(px+8,py+9);
    c.lineTo(px+5,py+20);c.stroke();
   }
   c.restore();
  }
  // Living luminous reef with waving individual stems, rather than flat sprites.
  for(let group=0;group<11;group++){
   const side=group%2?1:-1;
   const x=side<0?70+group*23:1225+(group%4)*48;
   const y=group%3===0?432+group*4:492+(group%4)*11;
   const h=43+(group*31)%89;
   c.save();c.translate(x,y);c.lineCap='round';
   const hue=group%4===0?'rgba(244,119,175,.76)':group%4===1?'rgba(79,207,193,.69)':group%4===2?'rgba(187,157,242,.73)':'rgba(143,196,91,.65)';
   for(let branch=-2;branch<=2;branch++){
    const sx=branch*7,dx=branch*15+Math.sin(t*.0006+group+branch)*4;
    c.strokeStyle=hue;c.lineWidth=branch===0?3.6:2.3;
    c.beginPath();c.moveTo(sx,0);c.bezierCurveTo(sx+dx*.4,-h*.2,dx*.85,-h*.72,dx,-h);c.stroke();
    c.beginPath();c.moveTo(dx*.62,-h*.57);c.lineTo(dx*.62+branch*5+8,-h*.78);c.stroke();
   }
   c.restore();
  }
  // Diver/light are distinct from the seated pilot: an outside crew member.
  const swimX=720+Math.sin(t*.00023)*44;
  const swimY=332+Math.sin(t*.0017)*7;
  const heading=Math.sin(t*.00022)*.035;
  c.save();
  c.globalCompositeOperation='screen';
  const cone=grad(c,swimX+27,swimY,swimX+275,swimY+30,[
   [0,'rgba(222,251,249,.35)'],[.5,'rgba(116,226,241,.12)'],[1,'rgba(61,166,206,0)']]);
  polygon(c,[[swimX+31,swimY-6],[swimX+38,swimY+7],
   [swimX+280,swimY+86],[swimX+260,swimY-63]],cone);
  c.restore();
  // Playable diver art is reused, with the same gender, hair, fins and tool.
  diverRenderer?.draw?.(c,swimX,swimY,23,heading,heading,t,{gender,moving:true,helmetLamp:true});
  for(let i=0;i<15;i++){
   const drift=(t*.018+i*37)%180;
   const x=swimX-19+Math.sin(i*3.22+drift*.03)*11;
   const y=swimY-18-drift;
   if(y<114)continue;
   c.strokeStyle='rgba(181,243,247,'+(.15+.43*(1-drift/180)).toFixed(3)+')';
   c.lineWidth=1.25;c.beginPath();c.arc(x,y,1.1+i%3*1.1,0,TAU);c.stroke();
  }
  }
  // Subtle animated optical glitter in the water and glass.
  for(let i=0;i<18;i++){
   const x=86+(i*97)%1255,y=180+(i*43)%340;
   const shine=.12+.13*(.5+.5*Math.sin(t*.001+i*1.79));
   c.fillStyle='rgba(190,255,247,'+shine.toFixed(3)+')';
   c.beginPath();c.arc(x,y,.8+i%3*.46,0,TAU);c.fill();
  }
  c.restore();
 }
 function seaAtmosphere(c,v,t,lowPower,geo){
  if(!geo)return;
  const left=Number(v.left)||0,top=Math.max(0,Number(v.top)||0);
  const w=Math.max(10,Number(v.width)||1200),h=Math.max(10,Number(v.height)||700);
  const depth=geo.metersAt(top);
  if(depth>680)return;
  c.save();
  const strength=clamp((440-depth)/440,0,1);
  if(strength>.001){
   const glow=c.createRadialGradient(left+w*.58,Math.max(0,top),10,left+w*.58,top+h*.3,w*.8);
   glow.addColorStop(0,'rgba(88,234,239,'+(.12*strength).toFixed(3)+')');
   glow.addColorStop(.48,'rgba(21,154,191,'+(.075*strength).toFixed(3)+')');
   glow.addColorStop(1,'rgba(5,35,73,0)');
   c.fillStyle=glow;c.fillRect(left,top,w,h);
  }
  if(!lowPower&&depth<250){
   c.globalCompositeOperation='screen';
   const count=7;
   for(let i=0;i<count;i++){
    const x=left+w*(i+.24)/count+Math.sin(t*.00013+i)*14;
    const y=Math.max(0,top);
    const beam=grad(c,x,y,x+90,top+h,[[0,'rgba(147,245,250,.09)'],[.55,'rgba(73,199,231,.028)'],[1,'rgba(20,116,174,0)']]);
    polygon(c,[[x-16,y],[x+17,y],[x+96,top+h],[x+23,top+h]],beam);
   }
  }
  c.restore();
 }
 function seaHighlights(c,v,t,lowPower,geo){
  if(!geo||lowPower)return;
  const left=Number(v.left)||0,top=Math.max(0,Number(v.top)||0);
  const w=Math.max(10,Number(v.width)||1200),h=Math.max(10,Number(v.height)||700);
  const depth=geo.metersAt(top);
  if(depth>280)return;
  c.save();c.lineWidth=1.3;c.lineCap='round';
  // Localized caustic reflection on visible collision-backed seabed only.
  const spacing=185,first=Math.floor(left/spacing)*spacing;
  for(let x=first;x<left+w+spacing;x+=spacing){
   if(x<0||x>geo.WIDTH)continue;
   const floor=geo.floorAt(x);
   if(floor<top||floor>top+h+20)continue;
   const shimmer=Math.sin(t*.0009+x*.012);
   c.strokeStyle='rgba(148,247,233,'+(.11+.055*shimmer).toFixed(3)+')';
   c.beginPath();c.moveTo(x-53,floor+5);
   c.quadraticCurveTo(x-10+shimmer*7,floor-7,x+56,floor+4);c.stroke();
   c.beginPath();c.moveTo(x-32,floor+13);c.quadraticCurveTo(x+12,floor+7,x+72,floor+16);c.stroke();
  }
  c.restore();
 }
 return Object.freeze({cabinBackdrop,cabinForeground,cabinInterior,cabinLiveWorld,seaAtmosphere,seaHighlights});
});