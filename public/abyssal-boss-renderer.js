(function(){
'use strict';

// Only the bosses that still need the new art pass live here.
// whiteSharkBoss, kraken and devourer intentionally keep their proven legacy visuals.
const REDESIGNED=new Set(['boss','angler','maw','leviathan']);
window.AbyssalRedesignedBossKinds=REDESIGNED;

window.drawAbyssalBoss=function(c,opts){
 const {kind,color='#70e9df',x=0,y=0,r=24,angle=0,t=0}=opts||{};
 if(!REDESIGNED.has(kind))return false;
 c.save();c.translate(x,y);c.rotate(Number(angle)||0);c.scale(r,r);c.lineCap='round';c.lineJoin='round';
 const pulse=.5+.5*Math.sin(t*.004);

 const grad=(a='#02070c',b='#152a35',accent=color)=>{
   const g=c.createLinearGradient(-1.8,-1,1.6,1);g.addColorStop(0,a);g.addColorStop(.28,b);g.addColorStop(.52,accent);g.addColorStop(.7,b);g.addColorStop(1,'#010409');return g;
 };
 const separator='rgba(1,6,12,.92)';
 const fill=(draw,paint=grad(),edge='rgba(205,245,241,.64)',w=.05,glow=0)=>{c.save();c.beginPath();draw();c.fillStyle=paint;if(glow){c.shadowBlur=glow;c.shadowColor=edge;}c.fill();if(edge){c.shadowBlur=0;c.strokeStyle=separator;c.lineWidth=Math.max(w*2.05,.075);c.stroke();c.strokeStyle=edge;c.lineWidth=w;if(glow){c.shadowBlur=glow*.55;c.shadowColor=edge;}c.stroke();}c.restore();};
 const poly=(pts,paint=grad(),edge='rgba(205,245,241,.5)',w=.045)=>fill(()=>{pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();},paint,edge,w);
 const stroke=(draw,w=.045,col='rgba(180,237,233,.72)',glow=0)=>{c.save();c.beginPath();draw();if(w>=.035){c.strokeStyle=separator;c.lineWidth=w*1.9;c.shadowBlur=0;c.stroke();}c.strokeStyle=col;c.lineWidth=w;if(glow){c.shadowBlur=glow;c.shadowColor=col;}c.stroke();c.restore();};
 const eye=(ex,ey,size=.085,iris=color)=>{c.save();c.fillStyle='#010409';c.beginPath();c.ellipse(ex,ey,size*1.35,size,0,0,Math.PI*2);c.fill();c.fillStyle=iris;c.shadowBlur=.18;c.shadowColor=iris;c.beginPath();c.arc(ex+size*.18,ey-size*.08,size*.42,0,Math.PI*2);c.fill();c.restore();};
 const node=(nx,ny,size=.03,col=color)=>{c.save();c.globalCompositeOperation='lighter';c.fillStyle=col;c.shadowBlur=.15;c.shadowColor=col;c.beginPath();c.arc(nx,ny,size*(.85+.18*pulse),0,Math.PI*2);c.fill();c.restore();};
 const mouth=(mx,my,rx,ry)=>{c.save();c.fillStyle='#010308';c.strokeStyle='rgba(230,242,235,.4)';c.lineWidth=.035;c.beginPath();c.ellipse(mx,my,rx,ry,0,0,Math.PI*2);c.fill();c.stroke();c.restore();};
 const tooth=(tx,ty,dir=1,sz=.1)=>poly([[tx-sz*.42,ty],[tx+sz*.42,ty],[tx,ty+dir*sz]],'#eef2e7','rgba(255,255,255,.32)',.018);
 const scar=(x1,y1,x2,y2)=>stroke(()=>{c.moveTo(x1,y1);c.lineTo((x1+x2)/2+.05,(y1+y2)/2-.03);c.lineTo(x2,y2);},.024,'rgba(222,237,231,.24)');
 const shadow=()=>{c.save();c.globalAlpha=.14;c.fillStyle=color;c.beginPath();c.ellipse(-.1,.9,1.05,.15,0,0,Math.PI*2);c.fill();c.restore();};
 shadow();

 if(kind==='boss'){
   // Blue-ringed colossal octopus. Compact mass first, warning rings second.
   for(let arm=0;arm<8;arm++){
     const sy=(arm-3.5)*.12,endX=-1.85-(arm%3)*.16,endY=sy*1.9+Math.sin(t*.0028+arm)*.12;
     stroke(()=>{c.moveTo(-.34,sy*.34);c.bezierCurveTo(-.78,sy*.65,-1.18,sy*1.2,endX,endY);},.13-(arm%2)*.012,grad('#02070b','#122630','#247f8c'));
     stroke(()=>{c.moveTo(-.38,sy*.32);c.bezierCurveTo(-.8,sy*.62,-1.2,sy*1.16,endX+.05,endY);},.026,'rgba(83,223,239,.46)');
   }
   fill(()=>{c.moveTo(-.56,.2);c.bezierCurveTo(-.82,-.2,-.66,-1.02,-.18,-1.34);c.bezierCurveTo(.38,-1.48,.92,-.82,.8,-.13);c.bezierCurveTo(.72,.48,.33,.72,-.2,.66);c.bezierCurveTo(-.56,.61,-.72,.42,-.56,.2);},grad('#02070c','#18303a','#2b7586'),'rgba(125,233,242,.58)',.06,7);
   poly([[-.42,-.86],[-.2,-1.4],[.02,-.96],[.28,-1.52],[.46,-.82]],grad('#02070c','#1d313b','#475a67'),'rgba(163,218,223,.32)',.035);
   // luminous warning rings embedded in tissue
   for(let i=0;i<10;i++){const a=i*2.399,rr=.16+(i%3)*.15;c.save();c.strokeStyle=i%3===0?'#ff4c7a':'#35d9ff';c.lineWidth=.04;c.shadowBlur=.16;c.shadowColor=c.strokeStyle;c.beginPath();c.arc(-.05+Math.cos(a)*rr,-.32+Math.sin(a)*rr*.7,.06+(i%2)*.012,0,Math.PI*2);c.stroke();c.restore();}
   eye(.15,-.18,.105,'#ffedf4');eye(.43,-.1,.068,'#ff725f');
   mouth(.31,.22,.24,.09);for(let i=0;i<5;i++)tooth(.16+i*.075,.2,1,.065);
   node(-.42,.12,.055,'#41e7ff');node(.3,-.55,.05,'#ff5d83');
   // Two dominant hunting arms and concentric warning organs give the boss a readable silhouette.
   for(const side of [-1,1])stroke(()=>{c.moveTo(-.12,side*.18);c.bezierCurveTo(-.55,side*.48,-1.35,side*.8,-2.35,side*1.08);},.16,'#213f49',.08);
   for(let i=0;i<5;i++){const a=-1.1+i*.55;stroke(()=>{c.moveTo(-.08,-.42);c.lineTo(-.08+Math.cos(a)*.72,-.42+Math.sin(a)*.52);},.032,i%2?'#ff4b7d':'#35e7ff',.16);}
   c.save();c.globalAlpha=.45;c.strokeStyle='#7ff7ff';c.lineWidth=.035;c.beginPath();c.ellipse(.05,-.25,.58,.42,0,0,Math.PI*2);c.stroke();c.restore();
 } else if(kind==='angler'){
   // Head-dominant anglerfish, like a living armored lantern.
   poly([[-1.25,.04],[-1.95,-.52],[-1.72,-.04],[-2.02,.42]],grad('#02070b','#17232b','#6a4a31'),'rgba(191,141,82,.3)',.035);
   fill(()=>{c.moveTo(-1.32,.02);c.bezierCurveTo(-1.08,-.82,-.36-0.08,-.88,.2,-.72);c.bezierCurveTo(.7,-.56,1.1,-.2,1.18,.02);c.quadraticCurveTo(.82,.22,.22,.32);c.bezierCurveTo(-.4,.5,-1.05,.38,-1.32,.02);},grad('#02070b','#242725','#8a5a31'),'rgba(244,191,116,.54)',.06,6);
   for(let i=0;i<5;i++)poly([[-.9+i*.24,-.54],[-.76+i*.24,-.9],[-.5+i*.24,-.57]],grad('#03080c','#2d3030','#765332'),'rgba(205,163,102,.3)',.028);
   fill(()=>{c.moveTo(.08,-.16);c.lineTo(1.18,-.27);c.lineTo(.72,.02);c.lineTo(1.23,.48);c.lineTo(.02,.34);c.closePath();},'#010409','rgba(255,210,130,.62)',.055,4);
   for(let i=0;i<9;i++){tooth(.16+i*.105,-.15,1,.115);tooth(.14+i*.105,.33,-1,.1);}
   eye(.34,-.47,.1,'#ffca67');
   stroke(()=>{c.moveTo(-.15,-.65);c.bezierCurveTo(-.03,-1.22,.46,-1.48,.92,-1.25);},.055,'rgba(122,88,50,.95)');
   node(.94,-1.24,.12,'#ffd36d');
   for(let i=0;i<6;i++)node(-.8+i*.24,.18,.03,i%2?'#29f2e5':'#ffcc74');
   stroke(()=>{c.moveTo(-.86,.28);c.bezierCurveTo(-.35,.48,.38,.42,.84,.18);},.04,'#ff5ba7',.16);
   node(.94,-1.24,.19,'#fff06a');node(.72,-.78,.06,'#35e7ff');
   // Gill fan and throat glow replace arbitrary surface scratches.
   for(let i=0;i<5;i++)stroke(()=>{c.moveTo(-.55+i*.13,-.28);c.lineTo(-.62+i*.13,.24);},.028,i%2?'#ff8d6a':'#43efd9',.09);
   fill(()=>{c.ellipse(.32,.12,.42,.2,-.08,0,Math.PI*2);},'rgba(255,86,132,.18)','#ff6e9b',.025,5);
 } else if(kind==='maw'){
   // Pelican eel. Long ribbon body + a jaw that is almost the whole head.
   stroke(()=>{c.moveTo(-2.45,.02);c.bezierCurveTo(-1.72,-.22,-.9,.2,-.08,.03);},.38,grad('#01040a','#151222','#50305d'));
   poly([[-2.2,.02],[-2.62,-.4],[-2.48,.02],[-2.65,.39]],grad('#01040a','#181526','#50305d'),'rgba(190,128,221,.3)',.03);
   fill(()=>{c.ellipse(.18,.04,.62,.46,-.03,0,Math.PI*2);},grad('#02050a','#1b1627','#6b3e73'),'rgba(222,157,250,.5)',.05);
   fill(()=>{c.moveTo(-.05,-.08);c.bezierCurveTo(.34,-.84,1.2,-.86,1.78,-.28);c.bezierCurveTo(1.25,-.36,.58,-.26,-.05,-.08);},grad('#02040a','#1b1324','#713f78'),'rgba(238,169,255,.58)',.055);
   fill(()=>{c.moveTo(-.04,.12);c.bezierCurveTo(.38,.9,1.25,.86,1.82,.29);c.bezierCurveTo(1.14,.4,.5,.28,-.04,.12);},grad('#010309','#171020','#603569'),'rgba(238,169,255,.55)',.055);
   mouth(.92,.03,.78,.45);
   for(let i=0;i<11;i++){tooth(.12+i*.14,-.12,1,.1);tooth(.12+i*.14,.16,-1,.09);}
   eye(.12,-.34,.078,'#8ffcff');for(let i=0;i<7;i++)node(-1.48+i*.26,.13,.028,i%2?'#69f5ff':'#ff68d8');
   stroke(()=>{c.ellipse(.92,.03,.9,.55,0,0,Math.PI*2);},.055,'#ff5fcf',.22);
   fill(()=>{c.ellipse(.52,.2,.7,.3,-.02,0,Math.PI*2);},'rgba(255,65,190,.16)','#ff77dc',.028,6);
   for(let i=0;i<6;i++)node(-1.42+i*.28,-.11,.028,i%2?'#7bf7ff':'#ff78dc');
 } else if(kind==='leviathan'){
   // Oarfish leviathan. The silhouette must read as a colossal ribbon, not a normal fish.
   fill(()=>{c.moveTo(-3.35,.02);c.bezierCurveTo(-2.52,-.52,-1.5,-.19,-.5,-.36);c.bezierCurveTo(.15,-.46,.82,-.27,1.3,-.03);c.bezierCurveTo(.82,.3,.15,.37,-.55,.31);c.bezierCurveTo(-1.72,.24,-2.55,.54,-3.35,.02);},grad('#01060a','#123039','#3e8587'),'rgba(134,241,230,.5)',.05,4);
   poly([[-3.05,.02],[-3.65,-.38],[-3.42,.02],[-3.7,.38]],grad('#02070b','#112a33','#32696f'),'rgba(104,222,214,.34)',.03);
   for(let i=0;i<13;i++){
     const xx=-2.65+i*.27;stroke(()=>{c.moveTo(xx,-.27);c.lineTo(xx+.045,.27);},.022,'rgba(219,238,231,.22)');
     if(i<11)poly([[xx,-.3],[xx+.08,-.72-(i%3)*.12],[xx+.18,-.29]],grad('#10070b','#4b1623','#9d2b3f'),'rgba(255,116,133,.34)',.025);
   }
   fill(()=>{c.ellipse(.82,-.03,.44,.3,-.08,0,Math.PI*2);},grad('#061115','#315359','#7ca7a3'),'rgba(226,255,247,.58)',.04);
   eye(.98,-.13,.055,'#9dfff1');
   for(let i=0;i<11;i++)node(-2.35+i*.3,.12,.027,i%3?'#64f4e3':'#ff4f72');
   stroke(()=>{c.moveTo(-2.9,-.18);c.bezierCurveTo(-1.9,-.5,-.6,-.46,.72,-.18);},.045,'#ff4269',.18);
   stroke(()=>{c.moveTo(-2.8,.2);c.bezierCurveTo(-1.8,.42,-.4,.38,.65,.16);},.04,'#6fffe9',.16);
   for(let i=0;i<8;i++){const xx=-2.55+i*.38;poly([[xx,.22],[xx-.08,.55],[xx+.18,.24]],grad('#071014','#16343a','#4bd5ca'),'rgba(123,255,239,.38)',.024);}
   node(.78,-.04,.065,'#fff5c7');
 }
 c.restore();return true;
};
})();