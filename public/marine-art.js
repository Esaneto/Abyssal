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
// Each species gets its own tissue highlights and bioluminescent accents.
function pigment(color,target,amount){
 const parse=hex=>/^#[0-9a-f]{6}$/i.test(String(hex))?[0,1,2].map(i=>parseInt(hex.slice(1+i*2,3+i*2),16)):null;
 const a=parse(color)||[93,140,151],b=parse(target)||[11,24,35],p=Math.max(0,Math.min(1,amount));
 return '#'+a.map((v,i)=>Math.round(v*(1-p)+b[i]*p).toString(16).padStart(2,'0')).join('');
}
const BIO_ACCENTS=Object.freeze({
 bluering:'#4ce8ff',jewelsquid:'#f2a9f7',atolla:'#ff5679',
 phantomjelly:'#c2c6ff',dumbo:'#a9baf8',blanket:'#b47bfa',
 ribbonmoray:'#a2a7ff',gharial:'#a0d68f',nautilus:'#f3d6a0',
 leatherback:'#a7e5d9',hawksbill:'#e6d29c',hatchetfish:'#d8ecf2',
 viperfish:'#b3f3da',blackdragon:'#b0ffdb',combjelly:'#a4ffec',
 bluedragon:'#64dfff',yeticrab:'#d6eee3'
});
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
 c.shadowColor=BIO_ACCENTS[s.id]||neonForSpecies(s.color);
 // Avoid neon on every anatomical seam: preserve actual body volume.
 c.shadowBlur=Math.max(4,Math.min(13,r*.32));
 c.drawImage(entry.canvas,-entry.cx,-entry.cy);
 c.restore();
}
function drawDetails(c,x,y,r,angle,s,t,hit){
 c.save();c.translate(x,y);c.rotate(angle||0);c.scale(r,r);
 const variant=s.morph||1,phase=(Number(t)||0)*.003;
 const ink=pigment(s.color,'#06131e',.85),light=pigment(s.color,'#f3fbef',.61);
 const swim=Math.sin(phase*2.0),strokeSway=Math.sin(phase*.83);
 const g=c.createRadialGradient(-.15,-.42,.02,.1,.1,1.35);
 g.addColorStop(0,hit?'#ffffff':light);
 g.addColorStop(.15,pigment(s.color,'#e3ece8',.26));
 g.addColorStop(.52,s.color);
 g.addColorStop(.79,pigment(s.color,'#0b1d2b',.57));
 g.addColorStop(1,ink);
 const path=(fn,fill=g,line='#8bb8bf',width=.025)=>{c.beginPath();fn();if(fill){c.fillStyle=fill;c.fill();}if(line){c.strokeStyle=line;c.lineWidth=width;c.stroke();}};
 const oval=(x,y,rx,ry,rot=0,fill=g)=>path(()=>c.ellipse(x,y,rx,ry,rot,0,Math.PI*2),fill);
 const stroke=(fn,color=s.color,width=.035)=>path(fn,null,color,width);
 const eye=(x,y,size=.065)=>{oval(x,y,size,size,0,'#d6f4d9');oval(x+.02,y,size*.48,size*.68,0,'#02090d');};
 const fin=(points)=>path(()=>{points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();});
 const feeler=(x,y,length,side)=>stroke(()=>{c.moveTo(x,y);c.bezierCurveTo(x-length*.35,y+side*.2,x-length*.7,y+side*.6+Math.sin(phase)*.15,x-length,y+side*.3)},'#8abbb9',.025);
 const tentacles=(count,length,web=false)=>{
  // Roots are buried in a single oral disk. Arms are continuously tapered
  // filled ribbons instead of independent thick strokes with exposed seams.
  if(web)for(const side of [-1,1]){
   c.globalAlpha=.20;
   path(()=>{c.moveTo(.10,side*.12);c.bezierCurveTo(-length*.30,side*.20,-length*.66,side*.78,-length*.94,side*(.91+.09*swim));
    c.bezierCurveTo(-length*.59,side*.65,-length*.16,side*.28,.10,side*.12);c.closePath();},s.color,null);
   c.globalAlpha=1;
  }
  const bezier=(a,b,d,e,q)=>{const u=1-q;return u*u*u*a+3*u*u*q*b+3*u*q*q*d+q*q*q*e;};
  for(let i=0;i<count;i++){
   const rank=Math.floor(i/2),side=i%2===0?-1:1;
   const spread=.17+rank*.145,tailWave=Math.sin(phase*1.45+rank*.72+side*.41)*.15;
   // Blue-ring octopus spreads its arms DOWNWARD, not as a squid-like
   // symmetrical rear fan. Roots remain in the same muscular oral crown.
   const downward=s.id==='bluering',lane=(i-3.5)/3.5;
   const base={x:-.025,y:side*(.12+rank*.065)};
   const ctrl1=downward?{x:-length*.10+lane*.20,y:.24+rank*.06}:{x:-length*.20,y:side*(spread+.08)};
   const ctrl2=downward?{x:-length*.28+lane*.36,y:.74+rank*.13+tailWave*.3}:{x:-length*.56,y:side*(spread+.38)+tailWave*.5};
   const tip=downward?{x:-length*.35+lane*.55+tailWave*.12,y:1.25+rank*.21+tailWave}
    :{x:-length*(.80+.045*Math.sin(phase+rank*.6)),y:side*(.46+rank*.22)+tailWave};
   const points=Array.from({length:21},(_,j)=>{
    const q=j/20,x=bezier(base.x,ctrl1.x,ctrl2.x,tip.x,q),y=bezier(base.y,ctrl1.y,ctrl2.y,tip.y,q);
    const tangentX=3*(1-q)*(1-q)*(ctrl1.x-base.x)+6*(1-q)*q*(ctrl2.x-ctrl1.x)+3*q*q*(tip.x-ctrl2.x);
    const tangentY=3*(1-q)*(1-q)*(ctrl1.y-base.y)+6*(1-q)*q*(ctrl2.y-ctrl1.y)+3*q*q*(tip.y-ctrl2.y);
    const norm=Math.hypot(tangentX,tangentY)||1,thick=(.14-rank*.011)*Math.pow(1-q,.80)+.009;
    return {x,y,nx:-tangentY/norm,ny:tangentX/norm,thick};
   });
   c.beginPath();
   points.forEach((p,j)=>j?c.lineTo(p.x+p.nx*p.thick,p.y+p.ny*p.thick):c.moveTo(p.x+p.nx*p.thick,p.y+p.ny*p.thick));
   for(let j=points.length-1;j>=0;j--){const p=points[j];c.lineTo(p.x-p.nx*p.thick,p.y-p.ny*p.thick);}
   c.closePath();
   c.fillStyle=i%2?pigment(s.color,'#152535',.43):pigment(s.color,'#adbfbc',.19);
   c.strokeStyle=pigment(s.color,'#d0eee6',.31);c.lineWidth=.022;c.fill();c.stroke();
   stroke(()=>{const p=points[0];c.moveTo(p.x,p.y);for(let j=1;j<points.length;j++){const p=points[j];c.lineTo(p.x,p.y);}},'rgba(223,238,236,.24)',.014);
   for(let j=4;j<18;j+=3){
    const p=points[j];
    for(const sign of [-1,1]){
     oval(p.x+p.nx*p.thick*.58*sign,p.y+p.ny*p.thick*.58*sign,
      Math.max(.010,p.thick*.23),Math.max(.009,p.thick*.20),0,'rgba(208,240,238,.80)');
    }
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
   // Blackwater gharial: broad armored thorax, separate webbed limbs, a
   // serpentine tail, and a long narrow toothed snout ending in a nasal bulb.
   const whip=Math.sin(phase*.72)*.24,limb=Math.sin(phase*1.25)*.13;
   path(()=>{c.moveTo(-1.18,-.25);
    c.bezierCurveTo(-1.94,-.42,-2.42,-.30+whip*.35,-3.17,-.19+whip);
    c.quadraticCurveTo(-3.78,-.18+whip,-4.02,-.08+whip);
    c.quadraticCurveTo(-3.64,.24+whip,-3.07,.22+whip);
    c.bezierCurveTo(-2.35,.40+whip*.45,-1.70,.39,-1.15,.27);
    c.closePath();},'#234a46','#83bca7',.055);
   for(const side of [-1,1]){
    for(const [ax,ay,reach,rank] of [[-.97,.36,1.00,0],[.32,.29,.92,1]]){
     const tip=ax-(rank?.35:.55),flap=side*(reach+limb*(rank?-.55:1));
     path(()=>{c.moveTo(ax,side*ay);c.quadraticCurveTo(ax-.30,side*(ay+.30),tip-.20,flap);
       c.lineTo(tip+.10,flap+side*.17);c.quadraticCurveTo(tip+.43,flap-side*.15,ax+.22,side*(ay*.58));
       c.closePath();},'#355f51','#b3d3b0',.048);
     for(let j=0;j<4;j++)stroke(()=>{const tx=tip-.19+j*.095;
       c.moveTo(tip+.02,flap-side*.07);c.lineTo(tx,flap+side*(.13+(j%2)*.035));},'#bdd4b6',.025);
    }
   }
   path(()=>{c.moveTo(-1.62,-.27);c.bezierCurveTo(-.86,-.64,.27,-.62,.87,-.34);
    c.quadraticCurveTo(1.13,0,.85,.32);
    c.bezierCurveTo(.13,.64,-.95,.57,-1.62,.29);
    c.quadraticCurveTo(-1.95,0,-1.62,-.27);c.closePath();},g,'#b5cab1',.057);
   // Paired dorsal armour plates, arranged along the body, not stray spikes.
   for(let row=0;row<3;row++)for(let i=0;i<11;i++){
    const x=-1.52+i*.20,y=(row-1)*.19;
    oval(x,y,.106,.074,0,(i+row)%3===0?'#638e7a':'#426e63');
    stroke(()=>{c.moveTo(x-.065,y-.018);c.lineTo(x+.046,y-.021);},'#bfcead',.014);
   }

   // Continuous dorsal ridge connects the tail, torso and narrow skull.
   stroke(()=>{c.moveTo(-3.64,whip*.84);c.bezierCurveTo(-2.30,whip*.34,-1.22,-.035,.17,-.025);
    c.quadraticCurveTo(.59,-.034,.96,-.02);},'rgba(164,204,161,.46)',.065);
   for(let j=0;j<12;j++){
    const xx=-2.82+j*.25,yy=Math.sin(j*2.2)*.13;
    path(()=>{c.moveTo(xx-.065,yy-.038);c.lineTo(xx+.015,yy-.084);
     c.lineTo(xx+.082,yy-.02);c.closePath();},'#335b50',null);
   }
   // Eyes sit above the cheeks before the long rostrum starts.
   for(const side of [-1,1]){
    oval(.78,side*.24,.175,.145,0,'#24433b');
    oval(.83,side*.252,.078,.078,0,'#e5cb77');
    oval(.85,side*.25,.028,.057,0,'#081414');
   }
   path(()=>{c.moveTo(.72,-.15);c.quadraticCurveTo(1.19,-.19,1.62,-.115);
    c.lineTo(2.95,-.085);c.quadraticCurveTo(3.13,-.05,3.02,.035);
    c.lineTo(.86,.08);c.closePath();},'#557f65','#c4dcb8',.046);
   path(()=>{c.moveTo(.89,.08);c.lineTo(2.98,.034);c.quadraticCurveTo(2.80,.19,2.52,.185);
    c.lineTo(1.22,.22);c.closePath();},'#2e5748','#91bc9d',.035);
   oval(3.015,-.005,.16,.115,0,'#305d50');
   for(let j=0;j<2;j++)oval(3.06,(j?1:-1)*.048,.037,.027,0,'#081d1d');
   for(let i=0;i<20;i++){
    const x=1.03+i*.097,y=-.058+(i%2)*.005;
    fin([[x-.035,y],[x+.024,y],[x+.005,y+.080]]);
    fin([[x-.04,.124],[x+.019,.123],[x-.002,.047]]);
   }
   stroke(()=>{c.moveTo(.99,.086);c.quadraticCurveTo(2.1,.092,2.95,.04);},'#cfddbe',.023);
  }else if(id==='hatchetfish'){
   // Hatchetfish, not a generic oval: deep ventral keel and narrow dorsal ridge.
   const beat=Math.sin(phase*1.3)*.10;
   path(()=>{c.moveTo(-1.36,.03+beat);c.lineTo(-1.75,-.32+beat);
    c.quadraticCurveTo(-1.58,.05+beat,-1.76,.38+beat);c.closePath();},'#546e81','#dce6e6',.032);
   path(()=>{c.moveTo(-1.36,-.10);c.bezierCurveTo(-.85,-.20,-.12,-.25,.61,-.24);
    c.quadraticCurveTo(1.23,-.14,1.38,0);c.quadraticCurveTo(1.12,.22,.68,.31);
    c.bezierCurveTo(.48,.84,-.22,1.25,-.93,.91);
    c.quadraticCurveTo(-1.34,.59,-1.36,-.10);c.closePath();},g,'#d9edf0',.056);
   path(()=>{c.moveTo(-.9,.34);c.quadraticCurveTo(-.18,1.08,.57,.34);
    c.quadraticCurveTo(.02,.59,-.9,.34);c.closePath();},'rgba(191,234,232,.28)',null);
   for(let j=0;j<10;j++){
    const px=-.87+j*.148,py=.40+Math.sin(j/10*Math.PI)*.33;
    oval(px,py,.042,.028,0,j%3?'#a9e7e5':'#f2f8d4');
   }
   oval(.93,-.10,.125,.13,0,'#081625');oval(.96,-.14,.040,.047,0,'#e5f5ff');
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
  if(id==='viperfish'){
   // Projecting upper and lower jaws with elongated needle fangs.
   path(()=>{c.moveTo(.83,.08);c.quadraticCurveTo(1.44,.36,1.87,.21);
    c.quadraticCurveTo(1.50,.42,.92,.27);c.closePath();},'#254957','#add7c9',.027);
   path(()=>{c.moveTo(.91,-.09);c.lineTo(1.72,-.20);
    c.quadraticCurveTo(1.87,-.16,1.69,-.04);c.lineTo(.89,.01);c.closePath();},'#47757c','#c9e1d4',.026);
   for(let j=0;j<7;j++){
    const x=1.01+j*.105;
    stroke(()=>{c.moveTo(x,-.07);c.lineTo(x+.032,.22);},'#f4ebd6',.025);
   }
   stroke(()=>{c.moveTo(-.35,-.15);c.bezierCurveTo(-.60,-.51,-.48,-.68,-.65,-.86);},'#8bd8cb',.031);
   oval(-.65,-.87,.085,.065,0,'#bdfff1');
  }
  if(id==='greenland')for(let j=0;j<16;j++){
   const px=-1.11+j*.14,yy=Math.sin(j*2.399)*thick*.48;
   oval(px,yy,.022,.018,0,'rgba(129,164,147,.54)');
  }
  if(id==='blackdragon'){
   stroke(()=>{c.moveTo(-.27,.16);c.bezierCurveTo(-.54,.33,-.85,.46,-1.03,.42+flap*.5);},'#d9eaa6',.038);
   for(let j=0;j<11;j++)oval(-1.08+j*.17,.18,.024,.024,0,'#9cece1');
   // Dorsal comb and chin barbel remain attached to the fish silhouette.
   for(let j=0;j<10;j++){
    const px=-1.43+j*.23;
    path(()=>{c.moveTo(px,-.18);c.lineTo(px-.09,-(.32+(j%3)*.05));
     c.lineTo(px+.085,-.19);c.closePath();},'#2d5761','#89c6c4',.012);
   }
   stroke(()=>{c.moveTo(1.10,.09);c.bezierCurveTo(1.25,.38,1.38,.54,1.41,.72+flap*.5);},'#7dc8be',.034);
   oval(1.41,.72+flap*.5,.078,.052,0,'#aeffe0');
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

  if(id==='sawtootheel'){
   // Sawteeth root in one spine, rather than projecting beyond an empty gap.
   stroke(()=>{c.moveTo(-2.65,tailWave-.05);c.bezierCurveTo(-1.78,-.40,-.56,-.43,.57,-.25);},
    '#bbd6ca',.028);
  }
  if(id==='dogtootheel'){
   path(()=>{c.moveTo(.78,.10);c.quadraticCurveTo(1.27,.31,1.46,.20);
    c.quadraticCurveTo(1.22,.38,.87,.22);c.closePath();},'#315868','#b8d5c7',.032);
   for(let i=0;i<4;i++)stroke(()=>{const x=1.01+i*.09;c.moveTo(x,-.05);c.lineTo(x+.015,.22);},'#eee6d9',.024);
  }
  if(id==='dogtootheel')for(let i=0;i<4;i++)fin([[.86+i*.075,.07],[.89+i*.075,.23],[.94+i*.075,.08]]);
  eye(.93,-.12,.066);eye(.93,.12,.066);
  stroke(()=>{c.moveTo(.90,.13);c.quadraticCurveTo(1.19,.22,1.25,.06);},ink,.042);
 }else if(s.family==='octopus'||s.family==='squid'){
  const squid=s.family==='squid';if(id==='bigfin'){
   // Magnapinna: ten appendages emerge from a short mantle, bend at an
   // unmistakable elbow, then hang as extremely fine trailing filaments.
   for(let i=0;i<10;i++){
    // Eight arms and two feeding tentacles form recognizable elbow bends.
    // Asymmetric lengths and separated thin tips avoid a single flat "fan".
    const side=i<5?-1:1,rank=i%5,drift=Math.sin(phase*.72+i*.7)*.16;
    const rootY=side*(.09+rank*.058),elbowX=-.38-rank*.07,elbowY=side*(.51+rank*.22);
    const tipX=-1.23-rank*.16+drift,tipY=side*(1.85+rank*.19)+drift*.40;
    const limb=()=>{c.moveTo(-.04,rootY);
     c.quadraticCurveTo(-.31,side*.22,elbowX,elbowY);
     c.lineTo(elbowX-.12,elbowY+side*.07);
     c.bezierCurveTo(elbowX-.45,side*(1.03+rank*.15),tipX+.27,tipY-side*.11,tipX,tipY);};
    stroke(limb,'#233b51',.063-rank*.003);
    stroke(limb,i%3===0?'#dbcaec':'#a5a8d3',.020);
    oval(tipX,tipY,.017,.024,0,'rgba(210,218,241,.66)');
   }
  }else tentacles(8,id==='whiplash'?1.3:id==='bluering'?1.65:id==='mimic'?2.8:2.2,id==='mimic');
  // Continuous eight-arm oral crown: every tentacle root is buried in flesh.
  path(()=>{c.moveTo(-.39,0);c.bezierCurveTo(-.38,-.45,.18,-.54,.47,-.34);
   c.quadraticCurveTo(.66,0,.47,.34);c.bezierCurveTo(.18,.54,-.38,.45,-.39,0);
   c.closePath();},pigment(s.color,'#182b3a',.46),pigment(s.color,'#bddee0',.23),.03);
  if(squid){
   for(const side of [-1,1])path(()=>{c.moveTo(.35,side*.17);
    c.quadraticCurveTo(.75,side*.49,1.32,side*.88);
    c.quadraticCurveTo(1.26,side*.40,.96,side*.20);c.closePath();
   },pigment(s.color,'#bfd8e0',.27),pigment(s.color,'#e5e4db',.35),.027);
   oval(.65,0,.94,.39);
  }else if(id==='glassoctopus'){
   c.globalAlpha=.45;oval(.64,0,1.05,.38);c.globalAlpha=1;oval(.64,0,.38,.095,0,'#647f96');
  }else if(id==='mimic'){
   oval(.48,0,.72,.37);for(let i=0;i<5;i++)stroke(()=>{c.moveTo(.1+i*.18,-.28);c.lineTo(.15+i*.18,.28)},'#c0bb9c',.07);
  }else{
   // Cephalopod mantle is a pear-shaped muscle with a joined neck.
   path(()=>{c.moveTo(-.18,-.19);c.bezierCurveTo(.07,-.48,.54,-.65,.86,-.40);
    c.bezierCurveTo(1.12,-.17,1.11,.19,.84,.40);
    c.bezierCurveTo(.52,.66,.07,.48,-.18,.19);
    c.quadraticCurveTo(-.35,0,-.18,-.19);c.closePath();},
    g,pigment(s.color,'#def3ea',.40),.041);
  }
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
   // Continuous stolon joins each zooid to the buoyant bell.
   stroke(()=>{c.moveTo(.76,-.35);c.bezierCurveTo(.15,-.48,-.52,-.28,-1.23,-.35);},'#a5deef',.087);
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
   const leather=id==='leatherback',flap=Math.sin(phase*1.38)*.22;
   // Four unmistakable sea-turtle flippers, two long front paddles and a
   // smaller aft pair, emerge from underneath one armored oval carapace.
   path(()=>{c.moveTo(-1.04,-.10);c.lineTo(-1.45,-.16);c.lineTo(-1.49,.06);
    c.lineTo(-1.06,.13);c.closePath();},'#50756a','#b0c9a8',.035);
   for(const side of [-1,1]){
     path(()=>{c.moveTo(-.65,side*.40);
       c.bezierCurveTo(-.97,side*.67,-1.10,side*(1.13-flap*.28),-1.44,side*(1.42-flap*.55));
       c.quadraticCurveTo(-.89,side*(1.38-flap*.35),-.39,side*.61);
       c.closePath();},'#42685b','#bed4b8',.05);
     path(()=>{c.moveTo(.39,side*.42);
       c.bezierCurveTo(.66,side*.77,.74,side*(1.37+flap),1.12,side*(1.91+flap));
       c.quadraticCurveTo(1.46,side*(1.18+flap*.6),.95,side*.33);
       c.closePath();},leather?'#4c746c':'#648b70','#d7e4be',.056);
     for(let j=0;j<3;j++)stroke(()=>{c.moveTo(.57+j*.12,side*.49);
       c.quadraticCurveTo(.74+j*.11,side*.89,.95+j*.08,side*(1.55+flap));},'#bbd7b4',.021);
   }
   // Round dome with a thick marginal rim. Hawksbill has individual scutes;
   // leatherback is distinguished by seven longitudinal leather ridges.
   path(()=>{c.moveTo(-1.28,0);c.bezierCurveTo(-1.22,-.94,.34,-.99,.77,-.51);
    c.quadraticCurveTo(.91,0,.77,.51);
    c.bezierCurveTo(.34,.99,-1.22,.94,-1.28,0);c.closePath();},
    leather?'#243e48':'#3c584e',leather?'#b2bed0':'#d0c69f',.095);
   if(leather){
    for(let i=-3;i<=3;i++){
     const y=i*.165;
     stroke(()=>{c.moveTo(-1.11,y*.57);
      c.bezierCurveTo(-.55,y*1.75,.22,y*1.55,.74,y*.62);},i%2?'#769a9f':'#a7c2be',.063);
    }
    for(let i=0;i<20;i++)oval(-.98+(i%7)*.235,((i*7)%11-5)*.12,.027,.027,0,'#c0d4c6');
   }else{
    for(let ring=0;ring<2;ring++)for(let k=0;k<7;k++){
     const x=-1.02+k*.245,y=(ring?1:-1)*(.25+.065*Math.sin(k*.83));
     fin([[x-.14,y],[x-.035,y-.16*(ring?1:-1)],[x+.15,y],[x+.035,y+.145*(ring?1:-1)]]);
     stroke(()=>{c.moveTo(x-.14,y);c.lineTo(x+.15,y)},'#d2bf8b',.018);
    }
    for(let k=0;k<8;k++)oval(-1.13+k*.22,.0,.042,.035,0,'#e7d3a2');
   }

   // Shoulder and hip sockets overlap the rim: all four paddles grow from the body.
   for(const side of [-1,1]){
    oval(.42,side*.42,.30,.18,side*.28,leather?'#42656b':'#6e8867');
    oval(-.74,side*.46,.23,.14,-side*.22,leather?'#385962':'#516f5e');
    stroke(()=>{c.moveTo(.55,side*.50);
     c.quadraticCurveTo(.79,side*.88,1.14,side*(1.65+flap));},
      leather?'rgba(171,220,219,.54)':'rgba(217,209,153,.58)',.033);
   }
   // Clearly separated neck, broad eye-bearing head and hooked beak.
   path(()=>{c.moveTo(.62,-.24);c.bezierCurveTo(1.05,-.35,1.55,-.35,1.76,-.18);
    c.quadraticCurveTo(1.93,0,1.75,.18);
    c.bezierCurveTo(1.48,.39,.96,.34,.62,.24);
    c.closePath();},'#799984','#c3d4ae',.048);
   if(!leather)fin([[1.64,-.12],[1.98,.02],[1.65,.16]]);
   else stroke(()=>{c.moveTo(1.75,-.04);c.quadraticCurveTo(1.86,.06,1.69,.15);},'#203e40',.038);
   for(const side of [-1,1]){
     oval(1.48,side*.19,.115,.086,0,'#142f30');
     oval(1.51,side*.21,.041,.036,0,'#e7e8ad');
   }
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
