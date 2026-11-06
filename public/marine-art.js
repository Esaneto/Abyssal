(function(root){
'use strict';
// New species keep the shaded, sculptural palette of the original large predators.
function draw(c,x,y,r,angle,s,t,hit){
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
  path(()=>{c.moveTo(1.2,-.12);c.bezierCurveTo(-.2,-.8,-1.6,.8,-3,.1);c.bezierCurveTo(-1.8,1.4,-.2,-.2,1.2,.18);c.closePath();});
  stroke(()=>{c.moveTo(-3,.1);c.bezierCurveTo(-1.6,.8,-.2,-.8,1,-.15)},'#d5c68b',.065);
  for(const side of [-1,1])fin([[1,side*.08],[1.45,side*.25],[1.28,0]]);eye(1,-.06,.045);
 }else if(id==='dumbo'){
  tentacles(8,1.1,true);oval(.45,0,.65,.6);
  for(const side of [-1,1]){oval(.45,side*.7,.45,.26,side*(.3+Math.sin(phase)*.2));stroke(()=>{c.moveTo(.1,side*.6);c.quadraticCurveTo(.55,side*.9,.8,side*.65)},'#b0bacd',.025);}eye(.05,-.3,.085);eye(.05,.3,.085);
 }else if(id==='blanket'){
  path(()=>{c.moveTo(.35,0);c.bezierCurveTo(-.2,-.7,-1.6,-1.7,-2.4,-1.2);c.quadraticCurveTo(-1.8,-.5,-2.7,0);c.quadraticCurveTo(-1.8,.5,-2.4,1.2);c.bezierCurveTo(-1.6,1.7,-.2,.7,.35,0);});
  for(let i=0;i<9;i++)stroke(()=>{const side=(i-4)/4;c.moveTo(.2,0);c.quadraticCurveTo(-1.1,side*.9,-2.4,side*1.2)},'#b58ba8',.03);oval(.5,0,.5,.3);eye(.2,-.18,.065);
 }else if(id==='atolla'){
  // Serrated crown bell with a single hypertrophied trailing tentacle.
  tentacles(10,1.7);path(()=>{for(let i=0;i<28;i++){const a=i*Math.PI/14,rr=i%2?.68:.85,x=.25+Math.cos(a)*rr,y=Math.sin(a)*rr;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();});oval(.25,0,.48,.48);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;oval(.25+Math.cos(a)*.55,Math.sin(a)*.55,.05,.04,0,'#dc8b8b');}feeler(-.4,.4,3.4,1);
 }else if(id==='phantomjelly'){
  for(let i=0;i<4;i++){const side=(i-1.5)*.35;path(()=>{c.moveTo(.1,side);c.bezierCurveTo(-.6,side+.4,-1.7,side-.4,-3,side+.2);c.lineTo(-2.9,side+.46);c.bezierCurveTo(-1.5,side-.08,-.6,side+.7,.1,side+.2);c.closePath();});}
  path(()=>{c.moveTo(0,-.85);c.bezierCurveTo(1.8,-.9,1.8,.9,0,.85);c.quadraticCurveTo(.35,0,0,-.85);});stroke(()=>{c.moveTo(.05,-.8);c.quadraticCurveTo(.5,0,.05,.8)},'#b5a5cb',.04);
 }else if(id==='yeticrab'){
  for(const side of [-1,1]){for(let i=0;i<4;i++)stroke(()=>{c.moveTo(-.15-i*.16,side*.35);c.lineTo(-.4-i*.25,side*.85);c.lineTo(-.05-i*.3,side*1.25)},'#97b0ad',.08);
   stroke(()=>{c.moveTo(.1,side*.3);c.lineTo(.6,side*.8);c.lineTo(1.35,side*.75)},'#a8b8ae',.22);oval(1.4,side*.75,.4,.2);
   for(let i=0;i<18;i++)stroke(()=>{const x=.45+i*.065;c.moveTo(x,side*.75);c.lineTo(x-.06,side*(.98+.09*Math.sin(i*3)))},'#dce1cf',.025);
  }oval(-.2,0,.7,.5);eye(.35,-.2,.04);eye(.35,.2,.04);
 }else if(id==='nautilus'){
  for(let i=0;i<12;i++)stroke(()=>{const a=(i-6)*.09;c.moveTo(.5,a*.5);c.quadraticCurveTo(1.4,a*2,1.9,a*2.5+Math.sin(phase+i)*.08)},'#b8c8b7',.04);
  oval(-.2,0,.9,.9);for(let i=0;i<18;i++){const a=i*Math.PI/9;stroke(()=>{c.moveTo(-.2+Math.cos(a)*.5,Math.sin(a)*.5);c.quadraticCurveTo(-.2+Math.cos(a+.15)*.7,Math.sin(a+.15)*.7,-.2+Math.cos(a+.25)*.87,Math.sin(a+.25)*.87)},'#465969',.06);}
  stroke(()=>{for(let i=0;i<100;i++){const a=i*.15,rr=i*.007;x=-.2+Math.cos(a)*rr;y=Math.sin(a)*rr;i?c.lineTo(x,y):c.moveTo(x,y);}},'#d4d5b9',.035);eye(.68,.14,.07);
 }else if(id==='gharial'){
  for(const side of [-1,1]){fin([[.1,side*.25],[.5,side*.75],[-.15,side*.6]]);fin([[-.7,side*.25],[-.9,side*.7],[-1.1,side*.45]]);}
  path(()=>{c.moveTo(.5,-.22);c.lineTo(1.9,-.075);c.quadraticCurveTo(2.2,0,1.9,.075);c.lineTo(.5,.22);c.bezierCurveTo(-.1,.65,-1,.25,-2.6,.1);c.bezierCurveTo(-1.3,-.1,-.3,-.55,.5,-.22);});
  for(let i=0;i<10;i++){fin([[-1.6+i*.2,-.07],[-1.5+i*.2,-.2],[-1.4+i*.2,-.07]]);if(i<8)stroke(()=>{c.moveTo(.7+i*.14,-.075);c.lineTo(.74+i*.14,.075)},'#c2c9b5',.025);}eye(.48,-.18,.06);eye(.48,.18,.06);
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
 c.save();c.translate(p.x,p.y);c.rotate(p.angle||0);c.strokeStyle=s.color;c.lineWidth=Math.max(.7,p.r*.045);
 // Ribbons stay behind the animal. More visible adaptations, readable anatomy.
 for(let j=0;j<3;j++){c.globalAlpha=.12+j*.05;c.beginPath();for(let i=0;i<18;i++){const q=i/17,x=-p.r*(1.5+q*3),y=Math.sin(q*7+t*.004+j)*p.r*(.2+j*.18);i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
 c.restore();
}
root.AbyssalMarineArt={draw,wake};
})(globalThis);
