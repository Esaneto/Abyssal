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
 const key=String(s.id||s.family||'marine')+'|'+String(s.color)+'|'+radius+'|'+(s.morph||1)+'|'+(hit?1:0);
 // Refresh marine anatomy at ~15 FPS, with smooth motion from the game loop.
 const frame=Math.floor((Number(t)||0)/68);
 let entry=marineSpriteCache.get(key);
 if(!entry){
  const margin=Math.ceil(Math.max(18,r*.9));
  // Long ribbon bodies and tentacles reach roughly 4.2 radii behind the head.
  // Extra canvas padding prevents chopping the tail and its neon at the border.
  const cx=Math.ceil(r*5+margin),cy=Math.ceil(r*3+margin);
  const canvas=document.createElement('canvas');
  canvas.width=cx*2;canvas.height=cy*2;
  entry={canvas,context:canvas.getContext('2d'),cx,cy,frame:-1};
  if(!entry.context)return drawDetails(c,x,y,r,angle,s,t,hit);
  marineSpriteCache.set(key,entry);
  if(marineSpriteCache.size>32)marineSpriteCache.delete(marineSpriteCache.keys().next().value);
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
 const variant=s.morph||1,phase=(Number(t)||0)*.003,ink='#06131e',light='#bededc';
 const swim=Math.sin(phase*2.0),strokeSway=Math.sin(phase*.83);
 const g=c.createRadialGradient(-.15,-.42,.02,.1,.1,1.35);g.addColorStop(0,hit?'#fff':light);g.addColorStop(.15,s.color);g.addColorStop(.52,s.color);g.addColorStop(.78,'#193641');g.addColorStop(1,ink);
 const path=(fn,fill=g,line='#8bb8bf',width=.025)=>{c.beginPath();fn();if(fill){c.fillStyle=fill;c.fill();}if(line){c.strokeStyle=line;c.lineWidth=width;c.stroke();}};
 const oval=(x,y,rx,ry,rot=0,fill=g)=>path(()=>c.ellipse(x,y,rx,ry,rot,0,Math.PI*2),fill);
 const stroke=(fn,color=s.color,width=.035)=>path(fn,null,color,width);
 const eye=(x,y,size=.065)=>{oval(x,y,size,size,0,'#d6f4d9');oval(x+.02,y,size*.48,size*.68,0,'#02090d');};
 const fin=(points)=>path(()=>{points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();});
 const feeler=(x,y,length,side)=>stroke(()=>{c.moveTo(x,y);c.bezierCurveTo(x-length*.35,y+side*.2,x-length*.7,y+side*.6+Math.sin(phase)*.15,x-length,y+side*.3)},'#8abbb9',.025);
 const tentacles=(count,length,web=false)=>{
  // Mirror limb pairs around the swimming axis; all tips flow back naturally.
  if(web)for(const side of [-1,1]){
   c.globalAlpha=.23;
   path(()=>{c.moveTo(.04,side*.13);c.bezierCurveTo(-length*.33,side*.25,-length*.65,side*.75,-length*.96,side*(1+.10*swim));c.bezierCurveTo(-length*.48,side*.72,-length*.20,side*.30,.04,side*.13);c.closePath();},s.color,null);
   c.globalAlpha=1;
  }
  for(let i=0;i<count;i++){
   const rank=Math.floor(i/2),side=i%2===0?-1:1;
   const spread=.18+rank*.18,tailWave=Math.sin(phase*1.6+rank*.72+side*.4)*.13;
   const rootX=-.22,rootY=side*spread*.68;
   const endX=-length*(.83+.055*Math.sin(phase+rank*.6));
   const endY=side*(.46+rank*.29)+tailWave;
   const curve=()=>{c.moveTo(rootX,rootY);c.bezierCurveTo(-length*.28,side*(spread+.10),
      -length*.58,side*(spread+.34)+tailWave*.6,endX,endY);};
   stroke(curve,'#132c39',.17-rank*.008);
   stroke(curve,s.color,.10-rank*.004);
   stroke(curve,'rgba(196,233,223,.70)',.025);
   for(let j=0;j<3;j++){
    const q=(j+1)/5,x=-length*(.12+q*.47),y=side*(spread+q*.37)+tailWave*q;
    oval(x,y,.026,.020,0,'rgba(207,233,229,.76)');
   }
  }
 };
 const id=s.id;
 // Each original expansion species has its own construction; never recurse into
 // Kraken, Devourer, manta or crocodile artwork with a different color.
 if(id==='eagleray'){
  // Long ray tail remains on the centreline instead of curling into a stray appendage.
  stroke(()=>{c.moveTo(-.63,0);c.bezierCurveTo(-1.45,0,-2.55,strokeSway*.10,-3.45,strokeSway*.15);},'#203a4a',.091);
  stroke(()=>{c.moveTo(-.63,0);c.bezierCurveTo(-1.45,0,-2.55,strokeSway*.10,-3.45,strokeSway*.15);},'#a0c6cb',.03);
  const wing=Math.sin(phase*1.3)*.18;
  path(()=>{c.moveTo(1.2,0);c.quadraticCurveTo(.9,-.25,.35,-.3);c.lineTo(-.35,-1.7-wing);c.quadraticCurveTo(-.9,-1.2-wing*.6,-.75,-.25);c.lineTo(-1,0);c.lineTo(-.75,.25);c.quadraticCurveTo(-.9,1.2+wing*.6,-.35,1.7+wing);c.lineTo(.35,.3);c.quadraticCurveTo(.9,.25,1.2,0);});
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
  // One continuous tapered silhouette. The earlier oval + disconnected
  // triangles made some sharks look like round masses with unrelated fins.
  const shark=s.family==='shark',long=id==='frilled'||id==='blackdragon';
  const thick=id==='greenland'?.53:id==='hatchetfish'?.65:long?.25:shark?.43:.34;
  const tailLen=long?2.45:1.72;
  const bend=Math.sin(phase*1.48)*.16;
  const flap=Math.sin(phase*1.84)*.13;
  const tailY=bend*.74;
  // Caudal fin is attached to a tapered caudal peduncle.
  path(()=>{c.moveTo(-tailLen+.14,tailY);c.lineTo(-tailLen-.43,tailY-.43);
   c.quadraticCurveTo(-tailLen-.31,tailY,-tailLen-.43,tailY+.43);
   c.lineTo(-tailLen+.14,tailY);c.closePath();},'#365968','#97c3c3',.038);
  for(const side of [-1,1]){
   // Paired pectoral fins beat in opposite directions across the body.
   path(()=>{c.moveTo(.08,side*thick*.60);
    c.quadraticCurveTo(-.16,side*(thick+.14),-.65,side*(thick+.50+flap));
    c.quadraticCurveTo(-.57,side*(thick+.13),-.38,side*thick*.63);
    c.closePath();},'#315565','#91b8c1',.031);
  }
  path(()=>{c.moveTo(-tailLen+.06,tailY-.095);
   c.bezierCurveTo(-1.38,-thick*.64+bend*.2,-.12,-thick*1.22,.65,-thick*.77);
   c.quadraticCurveTo(1.04,-thick*.43,1.27,0);
   c.quadraticCurveTo(1.04,thick*.43,.65,thick*.77);
   c.bezierCurveTo(-.12,thick*1.22,-1.38,thick*.64+bend*.2,-tailLen+.06,tailY+.095);
   c.closePath();},g,'rgba(175,223,217,.79)',.046);
  stroke(()=>{c.moveTo(-tailLen+.16,tailY);c.bezierCurveTo(-1.18,bend*.14,-.25,.04,.55,.00);},'#a0d6c5',.025);
  // Paired gill slits and paired eyes suit the overhead camera.
  for(const side of [-1,1]){
   const yy=side*(thick*.43);
   eye(.73,yy*.60,id==='greenland'?.042:.057);
   for(let j=0;j<(shark?5:3);j++){
    const gx=.1-j*.105;
    stroke(()=>{c.moveTo(gx,yy*.55);c.quadraticCurveTo(gx-.08,yy*.93,gx-.045,yy*1.13);},'#183642',.031);
   }
  }
  if(id==='goblin'){
   path(()=>{c.moveTo(.85,-thick*.24);c.lineTo(1.71,-.07);
    c.lineTo(1.62,.06);c.lineTo(.85,thick*.24);c.closePath();},'#527a8a','#b1d3d9',.029);
  }
  if(id==='viperfish'||id==='blackdragon'||id==='frilled')for(let j=0;j<6;j++)for(const side of [-1,1]){
   const tx=.73+j*.068;
   stroke(()=>{c.moveTo(tx,side*.12);c.lineTo(tx+.03,side*.30);},'#f1e3d6',.029);
  }
  if(id==='hatchetfish'){
   stroke(()=>{c.moveTo(-.30,thick*.67);c.quadraticCurveTo(.16,thick*1.10,.55,thick*.55);},'#b0d6d8',.044);
  }
  if(id==='greenland')for(let j=0;j<16;j++){
   const px=-1.11+j*.14,yy=Math.sin(j*2.399)*thick*.48;
   oval(px,yy,.022,.018,0,'rgba(129,164,147,.54)');
  }
  if(id==='blackdragon'){
   stroke(()=>{c.moveTo(-.27,.16);c.bezierCurveTo(-.54,.33,-.85,.46,-1.03,.42+flap*.5);},'#d9eaa6',.038);
   for(let j=0;j<11;j++)oval(-1.08+j*.17,.18,.024,.024,0,'#9cece1');
  }
 }else if(s.family==='ray'){
  const width=variant===1?1.62:variant===2?1.25:.95;
  const flap=Math.sin(phase*1.55)*.16;
  const tailWave=Math.sin(phase*1.16)*.12;
  // Caudal filament is centered on the creature, with a gently swimming tip.
  stroke(()=>{c.moveTo(-.68,0);c.bezierCurveTo(-1.38,0,-2.21,tailWave*.5,-3.03,tailWave);},'#1a3b4b',.12);
  stroke(()=>{c.moveTo(-.68,0);c.bezierCurveTo(-1.38,0,-2.21,tailWave*.5,-3.03,tailWave);},'#a5c6bc',.038);
  if(id==='guitarfish'){
   path(()=>{c.moveTo(1.35,0);c.quadraticCurveTo(1.12,-.19,.38,-.32);
    c.quadraticCurveTo(-.34,-width*.86,-.72,-.31);
    c.quadraticCurveTo(-.95,0,-.72,.31);
    c.quadraticCurveTo(-.34,width*.86,.38,.32);
    c.quadraticCurveTo(1.12,.19,1.35,0);c.closePath();},g,'#9fbdba',.046);
  }else if(id==='stingray'){
   path(()=>{c.moveTo(1.06,0);c.bezierCurveTo(.70,-.52,-.19,-width*.86,-.78,0);
    c.bezierCurveTo(-.19,width*.86,.70,.52,1.06,0);c.closePath();},g,'#b1d4ca',.043);
  }else{
   // Both wings share the same shoulder and flex on each beat.
   path(()=>{c.moveTo(1.13,0);
    c.bezierCurveTo(.63,-.29,-.35,-width*(.98+flap),-.94,-width*(.79+flap));
    c.quadraticCurveTo(-.56,-.38,-.70,0);
    c.quadraticCurveTo(-.56,.38,-.94,width*(.79+flap));
    c.bezierCurveTo(-.35,width*(.98+flap),.63,.29,1.13,0);c.closePath();},g,'#96c6c1',.044);
  }
  // Thin dorsal midline rather than a detached bright oval.
  stroke(()=>{c.moveTo(-.70,0);c.quadraticCurveTo(.08,.04,1.03,0);},'#a7d2cf',.031);
  for(const side of [-1,1]){
   for(let i=0;i<5;i++){
    const xx=.28-i*.19;
    stroke(()=>{c.moveTo(.22,side*.12);c.quadraticCurveTo(xx,side*width*.42,-.76+i*.05,side*width*.7);},'rgba(134,194,192,.53)',.017);
   }
   eye(.68,side*.12,.049);
  }
 }else if(id==='seasnake'){
  // Flattened paddle remains attached to a serpentine, evenly tapered tail.
  const wave=Math.sin(phase*1.25)*.26;
  path(()=>{c.moveTo(1.22,-.13);c.bezierCurveTo(.43,-.32,-.35,-.42,-1.04,-.20);
   c.bezierCurveTo(-1.76,.06,-2.18,-.28+wave*.7,-2.62,wave);
   c.quadraticCurveTo(-2.08,.46+wave,-1.11,.12);
   c.bezierCurveTo(-.27,-.18,.46,.29,1.22,.13);c.closePath();},g,'#9cb6a7',.046);
  path(()=>{c.moveTo(-2.47,wave-.075);c.quadraticCurveTo(-2.98,wave-.45,-3.16,wave);
   c.quadraticCurveTo(-2.98,wave+.45,-2.47,wave+.075);c.closePath();},'#456d75','#a0cbc2',.036);
  for(let i=0;i<10;i++){
   const x=-1.74+i*.24;
   stroke(()=>{c.moveTo(x,-.17);c.lineTo(x+.06,.15);},'#b8c7a9',.064);
  }eye(.95,-.085,.043);eye(.95,.085,.043);
 }else if(s.family==='eel'){
  const tailWave=Math.sin(phase*1.4)*.34;
  // Ribbon-like taper; old wide second Bézier loop looked like an extra body mass.
  path(()=>{c.moveTo(1.18,-.22);
   c.bezierCurveTo(.46,-.35,-.40,-.48,-.96,-.27);
   c.bezierCurveTo(-1.66,.02,-2.12,-.29+tailWave*.5,-2.95,tailWave);
   c.quadraticCurveTo(-2.52,.12+tailWave,-2.10,.20+tailWave*.5);
   c.bezierCurveTo(-1.35,.41,-.67,.08,.06,.18);
   c.quadraticCurveTo(.95,.34,1.18,.22);c.closePath();},g,'#a6c9be',.044);
  stroke(()=>{c.moveTo(-2.75,tailWave);c.bezierCurveTo(-1.80,-.12+tailWave*.4,-.85,-.28,.45,-.15);},'rgba(196,237,216,.5)',.045);
  if(id==='zebramoray')for(let i=0;i<12;i++)stroke(()=>{const x=-2.1+i*.25;c.moveTo(x,-.19);c.lineTo(x+.14,.23)},'#c0c6b5',.057);
  if(id==='sawtootheel')for(let i=0;i<9;i++)fin([[-1.6+i*.23,-.22],[-1.69+i*.23,-.36],[-1.45+i*.23,-.22]]);
  if(id==='dogtootheel')for(let i=0;i<4;i++)fin([[.86+i*.075,.07],[.89+i*.075,.23],[.94+i*.075,.08]]);
  eye(.93,-.12,.066);eye(.93,.12,.066);
  stroke(()=>{c.moveTo(.90,.13);c.quadraticCurveTo(1.19,.22,1.25,.06);},ink,.042);
 }else if(s.family==='octopus'||s.family==='squid'){
  const squid=s.family==='squid';if(id==='bigfin'){
   // Magnapinna: ten appendages emerge from a short mantle, bend at an
   // unmistakable elbow, then hang as extremely fine trailing filaments.
   for(let i=0;i<10;i++){
    const side=(i-4.5)*.16,drift=Math.sin(phase*.72+i*.7)*.18;
    stroke(()=>{c.moveTo(-.04,side*.27);c.lineTo(-.67,side*.82);
     c.lineTo(-.76+side*.10,-.98+side*1.4);
     c.bezierCurveTo(-1.02,-1.64+side*1.2,-2.52+drift,-2.37+side*1.1,-3.68+drift,-2.77+side);},'#254051',.078);
    stroke(()=>{c.moveTo(-.04,side*.27);c.lineTo(-.67,side*.82);
     c.lineTo(-.76+side*.10,-.98+side*1.4);
     c.bezierCurveTo(-1.02,-1.64+side*1.2,-2.52+drift,-2.37+side*1.1,-3.68+drift,-2.77+side);},'#b6b1d7',.027);
   }
  }else tentacles(8,id==='whiplash'?1.3:id==='bluering'?1.25:id==='mimic'?2.8:2.2,id==='mimic');
  if(squid){fin([[.3,0],[.8,-.9],[1.45,0]]);fin([[.3,0],[.8,.9],[1.45,0]]);oval(.72,0,1,.37);}else if(id==='glassoctopus'){c.globalAlpha=.45;oval(.72,0,1.05,.36);c.globalAlpha=1;oval(.64,0,.38,.095,0,'#647f96');}else if(id==='mimic'){oval(.5,0,.72,.32);for(let i=0;i<5;i++)stroke(()=>{c.moveTo(.1+i*.18,-.28);c.lineTo(.15+i*.18,.28)},'#c0bb9c',.07);}else oval(.38,0,.53,.48);
  eye(.15,-.25,.085);eye(.15,.25,.085);
  if(id==='bluering'||id==='jewelsquid')for(let i=0;i<18;i++){const a=i*2.399,rr=.1+(i%4)*.12;stroke(()=>c.arc(.5+Math.cos(a)*rr,Math.sin(a)*rr,.065,0,7),'#73e8ff',.035);}
  
  if(id==='whiplash')for(const side of [-1,1])feeler(-.2,side*.3,4,side);
 }else if(id==='combjelly'){
  // Ctenophore, not a medusa: translucent egg-like body and eight beating
  // meridional comb rows. Rhythmic refraction is not an electrical halo.
  c.globalAlpha=.47;
  path(()=>{c.moveTo(-.83,0);c.bezierCurveTo(-.91,-.73,.18,-1.03,1.05,-.59);
   c.quadraticCurveTo(1.46,0,1.05,.59);
   c.bezierCurveTo(.18,1.03,-.91,.73,-.83,0);c.closePath();},'#6b9fa2','#c2e8e5',.05);
  c.globalAlpha=1;
  const colors=['#9fe9ff','#b8a9ff','#a2ffdb','#e0c2ff'];
  for(let row=0;row<8;row++){
   const a=row*Math.PI/4,fy=Math.sin(a),z=.2+.8*Math.abs(Math.cos(a));
   stroke(()=>{c.moveTo(-.49,fy*.23);c.quadraticCurveTo(.30,fy*z,.99,fy*.45);},colors[row%4],.026);
   for(let j=0;j<10;j++){
    const x=-.44+j*.144,y=fy*(.24+.18*Math.sin(j/10*Math.PI))*(.6+.4*z);
    oval(x,y,.028,.025+Math.sin(phase*2.9+j*.5+row)*.014,0,colors[(row+j)%4]);
   }
  }
  oval(.21,0,.36,.19,0,'rgba(208,242,238,.27)');
 }else if(s.family==='jelly'){
  if(id!=='combjelly')tentacles(variant===3?12:8,variant===3?3.5:2.2);
  if(id==='siphonophore'){
   // Siphonophore's buoyant zooids form a connected chain, not a spare ovoid.
   for(let j=0;j<5;j++){
    const xx=.15-j*.29,yy=-.35+Math.sin(phase+j)*.045;
    oval(xx,yy,.16-j*.014,.12-j*.01,0,'rgba(166,220,243,.35)');
    stroke(()=>{c.moveTo(xx-.11,yy);c.lineTo(xx-.28,yy+Math.sin(phase+j)*.04);},'#a2d7ee',.024);
   }
  }
  path(()=>{c.moveTo(-.2,-.7);c.bezierCurveTo(1.5,-1.0,1.5,1.0,-.2,.7);c.quadraticCurveTo(.1,0,-.2,-.7);});
  for(let i=0;i<7;i++){let y=(i-3)*.16;stroke(()=>{c.moveTo(-.2,y);c.quadraticCurveTo(.8,y*.6,.85,0)},'#9bd4e0',.018);}
  if(id==='combjelly')for(let i=0;i<14;i++)oval(.1+i*.045,Math.sin(i*.7)*.45,.035,.025,0,['#78deff','#d8b3ff','#71efc8'][i%3]);
 }else if(s.family==='crustacean'){
  const legStroke=Math.sin(phase*1.34)*.12,tailBeat=Math.sin(phase*1.7)*.14;
  for(const side of [-1,1]){
   for(let i=0;i<5;i++){
    const anchorX=.34-i*.29,rootY=side*.29;
    const step=legStroke*Math.sin(i+side*.8);
    stroke(()=>{c.moveTo(anchorX,rootY);
      c.lineTo(anchorX-.25,side*(.66+i*.07)+step);
      c.lineTo(anchorX+.04-i*.13,side*(id==='spidercrab'?1.55:1.13)+step);},'#719ba2',.077);
   }
  }
  if(id!=='spidercrab'){
   // Segmented abdomen is one piece, not five detached oval bulbs.
   path(()=>{c.moveTo(.36,-.28);
    c.bezierCurveTo(-.48,-.49,-1.11,-.40,-1.87,tailBeat-.13);
    c.lineTo(-2.1,tailBeat);
    c.lineTo(-1.87,tailBeat+.13);
    c.bezierCurveTo(-1.11,.41,-.48,.49,.36,.28);c.closePath();},
    '#395b67','#93b5b8',.041);
   for(let i=0;i<5;i++){
    const x=-1.51+i*.28,span=.23+.08*i/4;
    stroke(()=>{c.moveTo(x,-span);c.quadraticCurveTo(x-.08,0,x,span)},'#9db9bc',.032);
   }
   fin([[-1.88,tailBeat],[-2.20,tailBeat-.25],[-2.07,tailBeat],[-2.2,tailBeat+.25]]);
  }
  for(const side of [-1,1]){
   const size=id==='pistolshrimp'&&side===1?.63:.34;
   stroke(()=>{c.moveTo(.23,side*.30);c.lineTo(.68,side*(.66+legStroke));},s.color,.14);
   oval(.95,side*(.78+legStroke),size,.20,side*.24);
   stroke(()=>{c.moveTo(1.04,side*(.78+legStroke));c.lineTo(1.40,side*(.70+legStroke));},ink,.039);
  }
  path(()=>{c.moveTo(-.67,0);c.bezierCurveTo(-.65,-.62,.20,-.78,.83,-.36);
   c.quadraticCurveTo(1.11,0,.83,.36);
   c.bezierCurveTo(.20,.78,-.65,.62,-.67,0);c.closePath();},g,'#b1c5c2',.047);
  for(let i=0;i<5;i++)stroke(()=>{const x=-.45+i*.22;c.moveTo(x,-.37);c.quadraticCurveTo(x-.13,0,x,.37);},'#9fb8b7',.028);
  eye(.71,-.25,.058);eye(.71,.25,.058);
 }else if(id==='leatherback'||id==='hawksbill'){
  const flap=Math.sin(phase*1.27)*.21;
  for(const side of [-1,1]){
   fin([[.43,side*.26],[.03,side*(1.25+flap)],[-.56,side*.62]]);
   fin([[-.48,side*.30],[-1.15,side*(.78-flap*.42)],[-.86,side*.21]]);
  }
  // Head meets the domed shell without a second overlapping body blob.
  path(()=>{c.moveTo(-1.06,0);c.quadraticCurveTo(-.86,-.70,.08,-.76);
   c.quadraticCurveTo(.91,-.52,1.25,-.20);
   c.quadraticCurveTo(1.48,0,1.25,.20);
   c.quadraticCurveTo(.91,.52,.08,.76);
   c.quadraticCurveTo(-.86,.70,-1.06,0);c.closePath();},g,'#aac8ba',.049);
  if(id==='hawksbill')fin([[1.13,-.12],[1.47,0],[1.13,.12]]);
  for(let i=-3;i<=3;i++){
   const x=-.75+i*.23;
   stroke(()=>{c.moveTo(x,-.34);c.quadraticCurveTo(x+.07,0,x,.34)},'#8daea4',.035);
  }
  eye(1.11,-.16,.045);eye(1.11,.16,.045);
 }else if(s.family==='mollusc'){
  if(id==='bluedragon'){
   // Blue dragon nudibranch: bilateral cerata that fold with each swim stroke.
   for(const side of [-1,1])for(let i=0;i<8;i++){
    const xx=.74-i*.22,spread=.43+(i%3)*.14,beat=Math.sin(phase*1.45+i*.58)*.11;
    path(()=>{c.moveTo(xx,side*.06);c.quadraticCurveTo(xx-.18,side*(spread*.67+beat),
     xx-.32,side*(spread+beat));c.quadraticCurveTo(xx-.04,side*(spread*.38),xx,side*.06);c.closePath();},
      i%3?'#478ca8':'#89c7ce','#c2e9e6',.027);
   }
   path(()=>{c.moveTo(1.17,-.08);c.bezierCurveTo(.5,-.22,-.35,-.23,-1.3,-.08);
    c.lineTo(-1.48,0);c.lineTo(-1.3,.08);
    c.bezierCurveTo(-.35,.23,.5,.22,1.17,.08);c.closePath();},g,'#cee9df',.033);
  }else{
   // A single low crawling foot with a coherent conical or spiral shell on it.
   path(()=>{c.moveTo(1.12,.18);c.bezierCurveTo(.38,.06,-.35,.06,-1.18,.14);
    c.quadraticCurveTo(-1.47,.53,-.9,.58);
    c.quadraticCurveTo(.07,.71,1.15,.42);c.closePath();},'#365e62','#8facad',.039);
   if(id==='whelk'){
    path(()=>{c.moveTo(-1.19,.13);c.lineTo(-1.67,-.52);
     c.lineTo(-.66,-.75);c.quadraticCurveTo(.4,-1.02,.64,-.39);
     c.quadraticCurveTo(.51,.22,-.34,.31);c.closePath();},g,'#d9c9ab',.055);
   }else{
    path(()=>{c.moveTo(-1.08,.16);c.bezierCurveTo(-1.27,-.76,-.55,-1.06,.17,-.84);
     c.quadraticCurveTo(.93,-.60,.71,-.06);
     c.quadraticCurveTo(.27,.45,-.6,.46);c.closePath();},g,'#d5d7bc',.060);
   }
   stroke(()=>{for(let j=0;j<96;j++){
    const a=j*.155,radius=j*.0086;
    const px=-.30+Math.cos(a)*radius,py=-.25+Math.sin(a)*radius;
    if(j)c.lineTo(px,py);else c.moveTo(px,py);
   }},'#c6ccbd',.06);
   for(const side of [-1,1])stroke(()=>{c.moveTo(.91,side*.14);
    c.quadraticCurveTo(1.07,side*.24,1.23,side*(.34+.06*swim));},'#b0d6ca',.05);
  }
 }else{
  // Benthic radial crowns, articulated arms, and soft-bodied sea cucumbers.
  if(id==='seapig'){for(let i=0;i<6;i++)for(const side of [-1,1])oval(-.65+i*.25,side*.4,.1,.24,side*.4);oval(0,0,1,.43);}
  else{for(let i=0;i<(id==='basketstar'?5:10);i++){const a=i*Math.PI*2/(id==='basketstar'?5:10),wave=Math.sin(phase*.9+i*.57)*.16;stroke(()=>{c.moveTo(0,0);c.quadraticCurveTo(Math.cos(a+.3+wave)*.7,Math.sin(a+.3+wave)*.7,Math.cos(a+wave)*1.5,Math.sin(a+wave)*1.5)},s.color,.06);if(id==='basketstar')for(const side of [-1,1])for(let j=1;j<4;j++){const d=j*.38;stroke(()=>{c.moveTo(Math.cos(a)*d,Math.sin(a)*d);c.quadraticCurveTo(Math.cos(a+side*.5)*(d+.3),Math.sin(a+side*.5)*(d+.3),Math.cos(a+side*.75)*(d+.5),Math.sin(a+side*.75)*(d+.5))},s.color,.04);}
 for(let j=1;j<6;j++){const d=j*.23,sway=Math.sin(phase*1.1+i*.54+j)*.075;
 stroke(()=>{c.moveTo(Math.cos(a)*d,Math.sin(a)*d);
   c.lineTo(Math.cos(a)*d+Math.cos(a+.8+sway)*.24,Math.sin(a)*d+Math.sin(a+.8+sway)*.24)},'#9acdc3',.022);}}oval(0,0,.25,.25);}
 }
 c.restore();
}
function wake(c,p,s,t){
 if(s?.renderer!=='marine')return;
 c.save();c.translate(p.x,p.y);c.rotate(p.angle||0);c.strokeStyle=neonForSpecies(s.color);c.lineWidth=Math.max(.7,p.r*.045);
 // Ribbons stay behind the animal. More visible adaptations, readable anatomy.
 if(!p?.trail?.some?.(point=>Number(point.life)>.06)) {c.restore();return;}
 for(let j=0;j<3;j++){c.globalAlpha=.10+j*.045;c.beginPath();for(let i=0;i<18;i++){const q=i/17,x=-p.r*(1.5+q*3),y=Math.sin(q*7+t*.004+j)*p.r*(.2+j*.18);i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
 c.restore();
}
root.AbyssalMarineArt={draw,wake};
})(globalThis);
