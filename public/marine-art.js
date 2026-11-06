(function(root){
'use strict';
// New species keep the shaded, sculptural palette of the original large predators.
// The expanded species use a separate illustrator. Paint a compact alpha sprite
// first so its neon is cast only from the OUTER silhouette, never from anatomy
// details (eyes, teeth, seams). Quantized frames avoid repainting every entity at 60 Hz.
const marineSpriteCache=new Map();
function neonForSpecies(color){
 const m=/^#([0-9a-f]{6})$/i.exec(String(color||''));
 if(!m)return '#77efff';
 const rgb=[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)/255);
 const lo=Math.min(...rgb),hi=Math.max(...rgb),delta=hi-lo;
 let hue=0;
 if(delta>0){
  if(hi===rgb[0])hue=((rgb[1]-rgb[2])/delta)%6;
  else if(hi===rgb[1])hue=(rgb[2]-rgb[0])/delta+2;
  else hue=(rgb[0]-rgb[1])/delta+4;
 }
 return 'hsl('+Math.round((hue*60+360)%360)+' 95% 66%)';
}
function draw(c,x,y,r,angle,s,t,hit){
 if(!s||!Number.isFinite(r)||r<=0||typeof document==='undefined')return drawDetails(c,x,y,r,angle,s,t,hit);
 const radius=Math.round(r*2)/2;
 const key=String(s.id||s.family||'marine')+'|'+radius+'|'+(s.morph||1)+'|'+(hit?1:0);
 const frame=Math.floor((Number(t)||0)/115);
 let entry=marineSpriteCache.get(key);
 if(!entry){
  const margin=Math.ceil(Math.max(18,r*.9));
  const cx=Math.ceil(r*5+margin),cy=Math.ceil(r*3+margin);
  const canvas=document.createElement('canvas');
  canvas.width=cx*2;canvas.height=cy*2;
  entry={canvas,context:canvas.getContext('2d'),cx,cy,frame:-1};
  if(!entry.context)return drawDetails(c,x,y,r,angle,s,t,hit);
  marineSpriteCache.set(key,entry);
  if(marineSpriteCache.size>64)marineSpriteCache.delete(marineSpriteCache.keys().next().value);
 }
 if(entry.frame!==frame){
  entry.context.clearRect(0,0,entry.canvas.width,entry.canvas.height);
  drawDetails(entry.context,entry.cx,entry.cy,r,0,s,t,hit);
  entry.frame=frame;
 }
 c.save();
 c.translate(x,y);c.rotate(Number.isFinite(angle)?angle:0);
 c.shadowColor=neonForSpecies(s.color);
 c.shadowBlur=Math.max(7,Math.min(24,r*.72));
 c.drawImage(entry.canvas,-entry.cx,-entry.cy);
 c.restore();
}
function drawDetails(c,x,y,r,angle,s,t,hit){
 c.save();c.translate(x,y);c.rotate(angle||0);c.scale(r,r);
 const variant=s.morph||1,phase=t*.003,ink='#06131e',light='#bededc';
 const g=c.createRadialGradient(-.15,-.42,.02,.1,.1,1.35);g.addColorStop(0,hit?'#fff':light);g.addColorStop(.15,s.color);g.addColorStop(.52,s.color);g.addColorStop(.78,'#193641');g.addColorStop(1,ink);
 const path=(fn,fill=g,line='#8bb8bf',width=.025)=>{c.beginPath();fn();if(fill){c.fillStyle=fill;c.fill();}if(line){c.strokeStyle=line;c.lineWidth=width;c.stroke();}};
 const oval=(x,y,rx,ry,rot=0,fill=g)=>path(()=>c.ellipse(x,y,rx,ry,rot,0,Math.PI*2),fill);
 const stroke=(fn,color=s.color,width=.035)=>path(fn,null,color,width);
 const eye=(x,y,size=.065)=>{oval(x,y,size,size,0,'#d6f4d9');oval(x+.02,y,size*.48,size*.68,0,'#02090d');};
 const fin=(points)=>path(()=>{points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();});
 const feeler=(x,y,length,side)=>stroke(()=>{c.moveTo(x,y);c.bezierCurveTo(x-length*.35,y+side*.2,x-length*.7,y+side*.6+Math.sin(phase)*.15,x-length,y+side*.3)},'#8abbb9',.025);
 const tentacles=(count,length,web=false)=>{
  for(let i=0;i<count;i++){const side=(i-(count-1)/2)/(count/2),wave=Math.sin(phase+i*.8)*.22;
   const endX=-length*(.65+.3*Math.sin(i*1.7)**2),endY=side*(.7+Math.sin(i*2)*.45);
   const curve=()=>{c.moveTo(-.25,side*.34);c.bezierCurveTo(-length*.35,side*.7,-length*.8,side*1.6+wave,endX,endY);c.quadraticCurveTo(endX+.15,endY-side*.3,endX+.38,endY-side*.23);};
   if(web)fin([[0,side*.4],[-length*.5,side*.7+wave],[-length*.35,side*.4]]);
   stroke(curve,'#102934',.18);stroke(curve,s.color,.11);
   stroke(curve,'#8dafb0',.025);
   for(let j=0;j<3;j++)oval(-.4-j*.2,side*(.4+j*.15),.028,.022,0,'#b8d5cd');
  }
 };
 const id=s.id;
 // Each original expansion species has its own construction; never recurse into
 // Kraken, Devourer, manta or crocodile artwork with a different color.
 if(id==='eagleray'){
  feeler(-.6,0,3.2,1);
  path(()=>{c.moveTo(1.2,0);c.quadraticCurveTo(.9,-.25,.35,-.3);c.lineTo(-.35,-1.7);c.quadraticCurveTo(-.9,-1.2,-.75,-.25);c.lineTo(-1,0);c.lineTo(-.75,.25);c.quadraticCurveTo(-.9,1.2,-.35,1.7);c.lineTo(.35,.3);c.quadraticCurveTo(.9,.25,1.2,0);});
  for(let i=0;i<28;i++){const side=i%2?1:-1;oval(-.25-(i%4)*.12,side*(.3+(i%7)*.15),.025,.035,0,'#ccddd0');}eye(.65,-.12,.045);eye(.65,.12,.045);
 }else if(id==='ribbonmoray'){

   // RIBBON MORAY: an extremely thin, travelling S-body with a high sail crest,
   // elongated blue-tipped jaws and open fangs, never the generic eel silhouette.
   const sway=Math.sin(phase*.9)*.29;
   path(()=>{c.moveTo(1.45,-.17);c.bezierCurveTo(.65,-.35,-.22,-.8,-.92,-.38);c.bezierCurveTo(-1.82,.19,-2.35,-.59+sway,-3.52,-.37+sway);c.lineTo(-3.83,-.05+sway);c.lineTo(-3.48,.10+sway);c.bezierCurveTo(-2.4,.64+sway,-1.7,.66,-.92,.14);c.bezierCurveTo(-.28,-.24,.65,.16,1.45,.17);c.closePath();},g,'#aab9ed',.045);
   path(()=>{c.moveTo(.93,-.20);c.bezierCurveTo(.4,-.52,-.12,-.86,-.55,-.72);c.lineTo(-1.02,-1.03);c.lineTo(-1.27,-.46);c.bezierCurveTo(-1.9,-.14,-2.5,-.78+sway,-3.52,-.37+sway);c.bezierCurveTo(-2.35,-.68+sway,-1.8,.01,-.9,-.31);c.bezierCurveTo(-.25,-.79,.55,-.4,.93,-.20);c.closePath();},'#7560b6','#c6a4f9',.028);
   stroke(()=>{c.moveTo(-3.5,-.31+sway);c.bezierCurveTo(-2.35,-.49+sway,-1.7,.44,-.9,-.18);c.bezierCurveTo(-.1,-.59,.55,-.15,1.22,-.10)},'#d9c4a4',.075);
   for(let i=0;i<13;i++){const x=-2.7+i*.21,y=-.17+Math.sin(i*.62+phase*.25)*.15;oval(x,y,.045,.027,-.25,i%3===0?'#96c9ff':'#5e82d2');}
   // Separate ribbon-shaped upper/lower jaw and hooked tooth line.
   path(()=>{c.moveTo(1.02,-.16);c.lineTo(1.75,-.12);c.lineTo(1.57,-.035);c.lineTo(1.07,-.01);c.closePath();},'#506b9b','#d5e7f8',.028);
   path(()=>{c.moveTo(1.05,.035);c.lineTo(1.76,.14);c.lineTo(1.58,.21);c.lineTo(1.02,.15);c.closePath();},'#33466c','#8ba8df',.027);
   for(let i=0;i<5;i++)fin([[1.22+i*.085,-.04],[1.27+i*.085,.045],[1.32+i*.085,-.035]]);
   oval(1.05,-.14,.078,.065,0,'#071523');oval(1.075,-.15,.023,.025,0,'#b1f8ff');
  }else if(id==='dumbo'){

   // DUMBO: a rounded umbrella mantle, two independently flapping ear fins,
   // eight SHORT downward trailing arms and huge high-set eyes.
   for(let arm=0;arm<8;arm++){
    const side=(arm-3.5)/3.5,w=Math.sin(phase*.7+arm*.82)*.13;
    stroke(()=>{c.moveTo(-.11,side*.32);c.bezierCurveTo(-.42,side*.49,-.68+w,side*.72,-.95-(arm%3)*.1,side*.88+w);},'#15283d',.125);
    stroke(()=>{c.moveTo(-.11,side*.32);c.bezierCurveTo(-.42,side*.49,-.68+w,side*.72,-.95-(arm%3)*.1,side*.88+w);},'#a5add5',.076);
    oval(-.54,side*.66,.027,.022,0,'#c9d7ff');
   }
   const flap=Math.sin(phase*1.16)*.17;
   for(const side of [-1,1]){
    path(()=>{c.moveTo(.16,side*.28);c.bezierCurveTo(-.14,side*(.65+flap),-.04,side*(1.45+flap),.45,side*(1.56+flap));c.bezierCurveTo(1.14,side*(1.42+flap),1.21,side*(.66+flap),.67,side*.40);c.closePath();},'#7184bd','#cbd6f7',.055);
    stroke(()=>{c.moveTo(.30,side*.43);c.quadraticCurveTo(.49,side*(1.1+flap),.76,side*(1.3+flap));},'#e0d5ff',.045);
   }
   oval(.46,0,.87,.83,0,g);
   path(()=>{c.moveTo(-.17,-.33);c.bezierCurveTo(.06,-.82,1.19,-.74,1.25,-.12);c.quadraticCurveTo(1.31,.55,.65,.8);c.quadraticCurveTo(.79,.14,-.17,-.33);},'rgba(204,224,247,.18)',null);
   for(const side of [-1,1]){oval(.96,side*.25,.153,.156,0,'#061321');oval(1.012,side*.265,.062,.062,0,'#ccf5ff');}
   for(let i=0;i<7;i++)oval(.36+Math.cos(i*2.4)*.55,Math.sin(i*2.4)*.38,.038,.025,0,'#a3d6ed');
  }else if(id==='blanket'){

   // BLANKET OCTOPUS: very broad translucent draping webs, scalloped curtains
   // and eight delicate free tips; neither squid nor Kraken arms.
   const wave=Math.sin(phase*.55)*.23;
   for(const side of [-1,1]){
    c.globalAlpha=.8;
    path(()=>{c.moveTo(.59,side*.13);c.bezierCurveTo(.03,side*.76,-.68,side*(1.65+wave),-1.32,side*(1.91+wave));c.bezierCurveTo(-1.73,side*(1.44+wave),-2.09,side*(2.23+wave),-2.52,side*(1.71+wave));c.bezierCurveTo(-2.88,side*(1.16+wave),-3.21,side*(1.52+wave),-3.54,side*(.88+wave));c.bezierCurveTo(-2.08,side*.4,-.66,side*.22,.59,side*.13);c.closePath();},'#47245e','#b98ac9',.04);
    c.globalAlpha=1;
    for(let j=0;j<5;j++){
     const dy=side*(.22+j*.28);
     stroke(()=>{c.moveTo(.25,side*.15);c.bezierCurveTo(-.92,side*(.35+j*.16),-2.17,dy+wave*.7,-3.43+j*.12,dy+side*.19+wave);},j%2?'#8f69a9':'#c297d4',.038);
    }
    for(let j=0;j<4;j++){const y=side*(.22+j*.24);stroke(()=>{c.moveTo(-2.7,y);c.quadraticCurveTo(-3.18,y+side*.12,-3.69+j*.08,y+side*.38+wave);},'#c09bd2',.028);}
   }
   oval(.55,0,.58,.36,0,g);oval(.89,-.15,.11,.09,0,'#e8dfff');oval(.93,-.15,.05,.062,0,'#090a1b');
   for(let i=0;i<6;i++)oval(.35-(i%3)*.22,(i%2?1:-1)*(.1+(i%3)*.095),.048,.025,0,'#d6b4e9');
  }else if(id==='atolla'){

   // ATOLLA: a RADIAL saw-tooth bell and a single long defensive antenna.
   // Crimson warning rings pulse from an otherwise circular body.
   const pulse=.96+.07*Math.sin(phase*1.5),cx=.23;
   stroke(()=>{c.moveTo(-.45,0);c.bezierCurveTo(-1.2,-.23,-2.38,.6,-3.62,-.33+Math.sin(phase)*.22);},'#511021',.19);
   stroke(()=>{c.moveTo(-.45,0);c.bezierCurveTo(-1.2,-.23,-2.38,.6,-3.62,-.33+Math.sin(phase)*.22);},'#ff5276',.087);
   for(let arm=0;arm<10;arm++){const a=arm*Math.PI*2/10;
    stroke(()=>{c.moveTo(cx+Math.cos(a)*.63,Math.sin(a)*.63);c.quadraticCurveTo(cx+Math.cos(a)*1.18,Math.sin(a)*1.15,cx+Math.cos(a)*1.55,Math.sin(a)*1.48);},'#9e344f',.035);
   }
   path(()=>{for(let j=0;j<48;j++){const a=j*Math.PI/24,rad=(j%3===0?1.08:.86)*pulse;const px=cx+Math.cos(a)*rad,py=Math.sin(a)*rad;j?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();},'#68132b','#ff6587',.05);
   oval(cx,0,.73*pulse,.73*pulse,0,'#9c2445');
   for(let j=0;j<16;j++){const a=j*Math.PI/8;stroke(()=>{c.moveTo(cx+Math.cos(a)*.19,Math.sin(a)*.19);c.lineTo(cx+Math.cos(a)*.76,Math.sin(a)*.76)},'#ff8aa4',.055);}
   oval(cx,0,.30,.30,0,'#2b081d');oval(cx,0,.14,.14,0,'#ffcad5');
   c.globalAlpha=.6+.24*Math.sin(phase*1.8)**2;
   stroke(()=>c.arc(cx,0,.61,0,Math.PI*2),'#ffa0bd',.06);c.globalAlpha=1;
  }else if(id==='phantomjelly'){

   // GIANT PHANTOM: a huge transparent vault, long hanging oral arms and
   // veiled filaments, unlike the small radial Atolla crown.
   const drift=Math.sin(phase*.65)*.21;
   for(let arm=0;arm<5;arm++){
    const y=(arm-2)*.27;
    c.globalAlpha=.27+(arm%2)*.15;
    path(()=>{c.moveTo(.18,y-.13);c.bezierCurveTo(-.83,y-.28,-1.9,y+.31+drift,-3.93+arm*.11,y-.21+drift);c.quadraticCurveTo(-4.24+arm*.11,y+.23+drift,-3.88+arm*.11,y+.36+drift);c.bezierCurveTo(-1.86,y+.58,-.74,y+.22,.18,y+.12);c.closePath();},'#b0b0ef','#d5d5ff',.025);
    c.globalAlpha=1;
    stroke(()=>{c.moveTo(.18,y);c.bezierCurveTo(-1.16,y+.1,-2.3,y+.12+drift,-4.16+arm*.08,y+.13+drift);},'#c5c6fc',.024);
   }
   for(let a=0;a<10;a++){const side=(a-4.5)*.12;
    stroke(()=>{c.moveTo(-.17,side);c.bezierCurveTo(-1.3,side*.8,-2.6,side+.12+drift,-3.4,side-.08+drift);},'#a9b6ff',.019);
   }
   c.globalAlpha=.54;
   path(()=>{c.moveTo(-.13,-1.02);c.bezierCurveTo(.53,-1.46,1.71,-1.0,1.73,0);c.bezierCurveTo(1.70,1.05,.53,1.44,-.13,1.02);c.quadraticCurveTo(.48,0,-.13,-1.02);c.closePath();},'#7389bd','#dfebff',.046);
   c.globalAlpha=1;
   oval(.82,0,.27,.53,0,'rgba(204,228,255,.32)');
   for(const side of [-1,1]){stroke(()=>{c.moveTo(.06,side*.8);c.quadraticCurveTo(.72,side*1.03,1.11,side*.63);},'#d4ebff',.048);}
   for(let j=0;j<7;j++)oval(.65+Math.cos(j*2.1)*.35,Math.sin(j*2.1)*.53,.032,.025,0,'#e2efff');
  }else if(id==='yeticrab'){
  for(const side of [-1,1]){for(let i=0;i<4;i++)stroke(()=>{c.moveTo(-.15-i*.16,side*.35);c.lineTo(-.4-i*.25,side*.85);c.lineTo(-.05-i*.3,side*1.25)},'#97b0ad',.08);
   stroke(()=>{c.moveTo(.1,side*.3);c.lineTo(.6,side*.8);c.lineTo(1.35,side*.75)},'#a8b8ae',.22);oval(1.4,side*.75,.4,.2);
   for(let i=0;i<18;i++)stroke(()=>{const x=.45+i*.065;c.moveTo(x,side*.75);c.lineTo(x-.06,side*(.98+.09*Math.sin(i*3)))},'#dce1cf',.025);
  }oval(-.2,0,.7,.5);eye(.35,-.2,.04);eye(.35,.2,.04);
 }else if(id==='nautilus'){

   // NAUTILUS: chambered mineral spiral shell, hood and many fine forward
   // sensory cirri (not a generic oval snail).
   for(let arm=0;arm<16;arm++){
    const y=(arm-7.5)*.061,flow=Math.sin(phase*.8+arm*.75)*.12;
    stroke(()=>{c.moveTo(.44,y);c.bezierCurveTo(.91,y*1.8,1.54,y*2.2+flow,2.17+(arm%3)*.15,y*2.7+flow);},'#273d53',.073);
    stroke(()=>{c.moveTo(.44,y);c.bezierCurveTo(.91,y*1.8,1.54,y*2.2+flow,2.17+(arm%3)*.15,y*2.7+flow);},arm%2?'#b9d5cd':'#e2d0a6',.031);
   }
   path(()=>{c.moveTo(.38,-.75);c.bezierCurveTo(-.34,-1.45,-1.48,-.95,-1.52,-.01);c.bezierCurveTo(-1.49,.96,-.4,1.45,.35,.71);c.quadraticCurveTo(-.03,0,.38,-.75);c.closePath();},g,'#d0dfd6',.068);
   for(let j=0;j<19;j++){
    const a=(j-9)*.17,px=-.65+Math.cos(a)*.73,py=Math.sin(a)*.89;
    stroke(()=>{c.moveTo(px,py);c.quadraticCurveTo(-.5+Math.cos(a+.2)*.91,Math.sin(a+.2)*1.05,-.65+Math.cos(a+.32)*1.0,Math.sin(a+.32)*1.02);},j%2?'#5c7381':'#aec4bc',.044);
   }
   stroke(()=>{for(let j=0;j<100;j++){const a=j*.15,rad=j*.0087,px=-.62+Math.cos(a)*rad,py=Math.sin(a)*rad;j?c.lineTo(px,py):c.moveTo(px,py);}},'#f1d3a1',.10);
   path(()=>{c.moveTo(.24,-.43);c.lineTo(.81,-.25);c.quadraticCurveTo(1.06,0,.79,.26);c.lineTo(.24,.42);c.closePath();},'#577e88','#cfe0d5',.04);
   oval(.83,-.2,.094,.083,0,'#06121b');oval(.855,-.22,.031,.029,0,'#d3faff');
  }else if(id==='gharial'){

   // GHARIAL: very long needle-thin crocodilian rostrum with terminal nasal
   // knob, interlocking needle teeth, dorsal scutes, paddle limbs and long tail.
   const twitch=Math.sin(phase*.48)*.15;
   path(()=>{c.moveTo(-1.7,-.14);c.bezierCurveTo(-2.3,-.26,-2.72,-.37+twitch,-3.25,-.12+twitch);c.lineTo(-3.67,.07+twitch);c.lineTo(-3.19,.19+twitch);c.bezierCurveTo(-2.5,.51,-2.18,.34,-1.66,.18);c.closePath();},'#3d6067','#709a9b',.04);
   for(const side of [-1,1]){
    fin([[-.43,side*.28],[-.95,side*.76],[-1.27,side*.63],[-.88,side*.23]]);
    fin([[.57,side*.21],[.21,side*.71],[-.07,side*.63],[.11,side*.17]]);
    for(let i=0;i<3;i++)stroke(()=>{const x=-.98+i*.07;c.moveTo(x,side*.62);c.lineTo(x+.18,side*(.7+i*.07));},'#b6d2b8',.035);
   }
   path(()=>{c.moveTo(.79,-.28);c.bezierCurveTo(-.22,-.52,-1.30,-.51,-1.77,-.22);c.bezierCurveTo(-2.04,.13,-1.38,.47,-.47,.45);c.quadraticCurveTo(.59,.37,.81,.23);c.closePath();},g,'#a0b5a7',.042);
   for(let i=0;i<10;i++){const x=-1.43+i*.22;fin([[x,-.36],[x+.1,-.46-(i%3)*.055],[x+.18,-.34]]);}
   path(()=>{c.moveTo(.67,-.12);c.lineTo(2.73,-.074);c.quadraticCurveTo(2.99,-.02,2.77,.055);c.lineTo(.68,.14);c.closePath();},'#5a7e85','#c7d6cb',.033);
   path(()=>{c.moveTo(.70,.13);c.lineTo(2.69,.061);c.lineTo(2.53,.18);c.lineTo(.77,.25);c.closePath();},'#294753','#8aafb0',.025);
   oval(2.72,-.045,.14,.085,0,'#243c43');
   for(let i=0;i<16;i++){
    const tx=.91+i*.108;
    stroke(()=>{c.moveTo(tx,-.055);c.lineTo(tx+.025,.025)},'#f4e9d6',.028);
    stroke(()=>{c.moveTo(tx,.11);c.lineTo(tx+.027,.039)},'#e3ded1',.022);
   }
   for(const side of [-1,1]){oval(.64,side*.23,.112,.089,0,'#10232a');oval(.69,side*.242,.041,.04,0,'#bcffd5');}
  }else if(s.family==='shark'||s.family==='fish'){
  const shark=s.family==='shark',long=id==='frilled'||id==='blackdragon';
  if(id==='frilled'||id==='blackdragon'){feeler(-.8,0,1.8,1);}else fin([[-1,0],[-1.8,-.75],[-1.5,.03],[-1.8,.55]]);
  if(shark&&id!=='frilled')fin([[-.1,-.25],[-.45,id==='greenland'?-.65:-1],[.35,-.3]]);fin([[.25,.2],[-.35,shark?.65:.42],[.5,.34]]);
  oval(0,0,long?1.48:1.1,id==='hatchetfish'?.75:id==='greenland'?.55:long?.26:.43);
  if(id==='goblin')fin([[.65,-.22],[1.65,-.2],[1.03,.03]]);
  if(id==='hatchetfish')fin([[-.3,.3],[.1,1.0],[.7,.2]]);
  stroke(()=>{c.moveTo(.55,.18);c.quadraticCurveTo(1.1,.38,1.03,.04)},ink,.065);
  if(id==='viperfish'||id==='blackdragon'||id==='frilled')for(let i=0;i<7;i++)fin([[.5+i*.08,.14],[.53+i*.08,.39],[.56+i*.08,.14]]);
  for(let i=0;i<(shark?5:3);i++)stroke(()=>{c.moveTo(.05-i*.12,-.21);c.quadraticCurveTo(-.05-i*.12,0,.05-i*.12,.21)},'#132833',.035);
  if(id==='greenland')for(let i=0;i<22;i++)oval(-.7+(i%7)*.22,Math.sin(i*2.39)*.35,.025,.018,0,'#55756b');
  if(id==='blackdragon'){feeler(.7,.15,.8,1);oval(-.1,.45,.05,.05,0,'#ebd79c');}
  eye(.65,-.12,id==='greenland'?.04:.07);if(!shark)for(let i=0;i<8;i++)oval(-.8+i*.18,.25,.024,.024,0,'#9cefe7');
 }else if(s.family==='ray'){
  if(id==='guitarfish'){fin([[-.5,0],[-2.4,-.2],[-2.7,-.65],[-2.6,.4],[-2.2,.16]]);oval(-1,0,.95,.23);}else feeler(-.3,0,3,1);const width=variant===1?1.65:variant===2?1.2:.75;
  if(id==='stingray'){oval(0,0,.85,.96);fin([[.7,-.3],[1.15,0],[.7,.3]]);}else path(()=>{c.moveTo(1,0);c.bezierCurveTo(.5,-.35,-.25,-width,-.8,-width);c.quadraticCurveTo(-.3,-.4,-.65,0);c.quadraticCurveTo(-.3,.4,-.8,width);c.bezierCurveTo(-.25,width,.5,.35,1,0);c.closePath();});oval(.3,0,.7,.25);eye(.63,-.15,.045);eye(.63,.15,.045);
  for(const side of [-1,1])for(let i=0;i<5;i++)stroke(()=>{c.moveTo(.2,side*.2);c.lineTo(-.65+i*.17,side*(width-.1-i*.12));},'#6495a1',.018);
  }else if(id==='seasnake'){
  // Sea snakes have a small reptilian head and a flattened paddle tail.
  path(()=>{c.moveTo(1.15,-.12);c.bezierCurveTo(.1,-.3,-.4,-.8,-1.2,-.25);c.bezierCurveTo(-2,.3,-2,-.3,-2.5,-.1);c.bezierCurveTo(-2.1,.7,-1.9,.7,-1,.1);c.bezierCurveTo(-.4,-.35,.2,.25,1.15,.12);c.quadraticCurveTo(1.4,0,1.15,-.12);});
  oval(-2.5,-.06,.45,.26,.4);for(let i=0;i<8;i++)stroke(()=>{const x=-.8+i*.25;c.moveTo(x,-.15);c.lineTo(x+.06,.08)},'#b8ba95',.09);eye(1.13,-.065,.035);
 }else if(s.family==='eel'){
  const wave=Math.sin(phase)*.18;
  path(()=>{c.moveTo(1,-.24);c.bezierCurveTo(-.5,-.7,-1.3,.6,-2.8,wave);c.bezierCurveTo(-1.6,1.1,-.6,-.05,1,.25);c.quadraticCurveTo(1.4,0,1,-.24);});
  if(id==='zebramoray'||id==='seasnake')for(let i=0;i<12;i++)stroke(()=>{const x=-2+i*.23;c.moveTo(x,-.12);c.lineTo(x+.12,.25)},'#c0c6b5',.06);
  if(id==='sawtootheel')for(let i=0;i<10;i++)fin([[-1.6+i*.22,-.08],[-1.7+i*.22,-.3],[-1.5+i*.22,-.08]]);
  if(id==='dogtootheel')for(let i=0;i<4;i++)fin([[.8+i*.09,.1],[.85+i*.09,.28],[.9+i*.09,.1]]);
  eye(.91,-.1);stroke(()=>{c.moveTo(.8,.12);c.lineTo(1.25,.05)},ink,.04);
 }else if(s.family==='octopus'||s.family==='squid'){
  const squid=s.family==='squid';if(id==='bigfin'){for(let i=0;i<10;i++){const side=(i-4.5)*.17;stroke(()=>{c.moveTo(0,side*.25);c.lineTo(-.7,side);c.lineTo(-3.6-Math.sin(i)*.2,side+.1*Math.sin(phase+i))},'#9bb5b5',.027);}}else tentacles(8,id==='whiplash'?1.3:id==='bluering'?1.25:id==='mimic'?2.8:2.2,id==='mimic');
  if(squid){fin([[.3,0],[.8,-.9],[1.45,0]]);fin([[.3,0],[.8,.9],[1.45,0]]);oval(.72,0,1,.37);}else if(id==='glassoctopus'){c.globalAlpha=.45;oval(.72,0,1.05,.36);c.globalAlpha=1;oval(.64,0,.38,.095,0,'#647f96');}else if(id==='mimic'){oval(.5,0,.72,.32);for(let i=0;i<5;i++)stroke(()=>{c.moveTo(.1+i*.18,-.28);c.lineTo(.15+i*.18,.28)},'#c0bb9c',.07);}else oval(.38,0,.53,.48);
  eye(.15,-.25,.085);eye(.15,.25,.085);
  if(id==='bluering'||id==='jewelsquid')for(let i=0;i<18;i++){const a=i*2.399,rr=.1+(i%4)*.12;stroke(()=>c.arc(.5+Math.cos(a)*rr,Math.sin(a)*rr,.065,0,7),'#73e8ff',.035);}
  
  if(id==='whiplash')for(const side of [-1,1])feeler(-.2,side*.3,4,side);
 }else if(s.family==='jelly'){
  if(id!=='combjelly')tentacles(variant===3?12:8,variant===3?3.5:2.2);
  if(id==='siphonophore')oval(.35,-.55,.72,.33);
  path(()=>{c.moveTo(-.2,-.7);c.bezierCurveTo(1.5,-1.0,1.5,1.0,-.2,.7);c.quadraticCurveTo(.1,0,-.2,-.7);});
  for(let i=0;i<7;i++){let y=(i-3)*.16;stroke(()=>{c.moveTo(-.2,y);c.quadraticCurveTo(.8,y*.6,.85,0)},'#9bd4e0',.018);}
  if(id==='combjelly')for(let i=0;i<14;i++)oval(.1+i*.045,Math.sin(i*.7)*.45,.035,.025,0,['#78deff','#d8b3ff','#71efc8'][i%3]);
 }else if(s.family==='crustacean'){
  for(const side of [-1,1])for(let i=0;i<5;i++)stroke(()=>{c.moveTo(.3-i*.2,side*.25);c.lineTo(-.1-i*.27,side*(id==='spidercrab'?1.3:.8));c.lineTo(.3-i*.4,side*(id==='spidercrab'?1.8:1.1))},'#7c9a9c',.07);
  for(const side of [-1,1]){const size=id==='pistolshrimp'&&side===1?.7:.4;stroke(()=>{c.moveTo(.4,side*.3);c.lineTo(.9,side*.85)},s.color,.15);oval(1.1,side*.85,size,.25,side*.4);stroke(()=>{c.moveTo(1.1,side*.85);c.lineTo(1.6,side*.8)},ink,.04);}
  if(id!=='spidercrab'){for(let i=0;i<5;i++)oval(-.6-i*.24,Math.sin(phase+i)*.035,.27,.32-i*.035);fin([[-1.6,0],[-2,-.3],[-1.95,.3]]);feeler(.7,-.2,1.4,-1);}
  oval(0,0,id==='spidercrab'?.65:.75,.55);for(let i=0;i<5;i++)stroke(()=>{c.moveTo(-.7+i*.2,-.4);c.quadraticCurveTo(-.5+i*.2,0,-.7+i*.2,.4)},'#9cbbb5',.03);
  eye(.55,-.25);eye(.55,.25);
 }else if(id==='leatherback'||id==='hawksbill'){
  for(const side of [-1,1]){fin([[.4,side*.3],[.1,side*1.3],[-.5,side*.65]]);fin([[-.5,side*.3],[-1.2,side*.8],[-.8,side*.2]]);}
  oval(.95,0,.4,.25);if(id==='hawksbill')fin([[1.1,-.12],[1.55,.02],[1.1,.16]]);oval(-.1,0,id==='leatherback'?1.18:.84,id==='leatherback'?.6:.72);if(id==='hawksbill')for(let i=0;i<7;i++){const a=i*2.4;oval(-.1+Math.cos(a)*.5,Math.sin(a)*.35,.21,.16,a,'#36625a');}for(let i=-2;i<=2;i++)stroke(()=>{c.moveTo(-.9,i*.17);c.quadraticCurveTo(0,i*.27,.6,i*.15)},'#a1b6a5',.03);eye(1.1,-.12,.045);
 }else if(s.family==='mollusc'){
  if(id==='bluedragon'){for(const side of [-1,1])for(let i=0;i<8;i++)fin([[.6-i*.2,0],[.3-i*.2,side*(.5+Math.sin(i)*.2)],[.5-i*.2,side*.1]]);oval(0,0,1,.18);}
  else{oval(.2,.25,1,.3);if(id==='whelk'){fin([[-.3,.3],[-1.5,-.65],[.5,-.5]]);for(let i=0;i<4;i++)oval(-.85+i*.26,-.35+i*.06,.23+i*.05,.3+i*.06);}else oval(-.2,-.1,.8,.75);stroke(()=>{for(let i=0;i<90;i++){const a=i*.17,rr=i/120;const x=-.2+Math.cos(a)*rr,y=-.1+Math.sin(a)*rr;i?c.lineTo(x,y):c.moveTo(x,y);}},'#b7c3af',.055);for(const side of [-1,1])stroke(()=>{c.moveTo(.8,side*.15);c.lineTo(1.2,side*.4)},'#a9ccc4',.045);}
 }else{
  // Benthic radial crowns, articulated arms, and soft-bodied sea cucumbers.
  if(id==='seapig'){for(let i=0;i<6;i++)for(const side of [-1,1])oval(-.65+i*.25,side*.4,.1,.24,side*.4);oval(0,0,1,.43);}
  else{for(let i=0;i<(id==='basketstar'?5:10);i++){const a=i*Math.PI*2/(id==='basketstar'?5:10);stroke(()=>{c.moveTo(0,0);c.quadraticCurveTo(Math.cos(a+.3)*.7,Math.sin(a+.3)*.7,Math.cos(a)*1.5,Math.sin(a)*1.5)},s.color,.06);if(id==='basketstar')for(const side of [-1,1])for(let j=1;j<4;j++){const d=j*.38;stroke(()=>{c.moveTo(Math.cos(a)*d,Math.sin(a)*d);c.quadraticCurveTo(Math.cos(a+side*.5)*(d+.3),Math.sin(a+side*.5)*(d+.3),Math.cos(a+side*.75)*(d+.5),Math.sin(a+side*.75)*(d+.5))},s.color,.04);}
 for(let j=1;j<6;j++){const d=j*.23;stroke(()=>{c.moveTo(Math.cos(a)*d,Math.sin(a)*d);c.lineTo(Math.cos(a)*d+Math.cos(a+.8)*.24,Math.sin(a)*d+Math.sin(a+.8)*.24)},'#9acdc3',.022);}}oval(0,0,.25,.25);}
 }
 c.restore();
}
function wake(c,p,s,t){
 if(s?.renderer!=='marine')return;
 c.save();c.translate(p.x,p.y);c.rotate(p.angle||0);c.strokeStyle=neonForSpecies(s.color);c.lineWidth=Math.max(.7,p.r*.045);
 // Ribbons stay behind the animal. More visible adaptations, readable anatomy.
 for(let j=0;j<3;j++){c.globalAlpha=.12+j*.05;c.beginPath();for(let i=0;i<18;i++){const q=i/17,x=-p.r*(1.5+q*3),y=Math.sin(q*7+t*.004+j)*p.r*(.2+j*.18);i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
 c.restore();
}
root.AbyssalMarineArt={draw,wake};
})(globalThis);
