(function(){
 'use strict';
 // Canonical boss renderer for hostile colossal fauna.
 // Boss silhouettes must be recognizable without relying on color or UI decoration.
 window.drawAbyssalBoss=function(c,opts){
  const {kind,color='#6fe8e0',x=0,y=0,r=24,angle=0,t=0}=opts||{};
  c.save();c.translate(x,y);c.rotate(Number(angle)||0);c.scale(r,r);c.lineJoin='round';c.lineCap='round';
  const pulse=.5+.5*Math.sin(t*.004);
  const fill=(draw,base,edge='rgba(210,247,244,.58)',width=.045)=>{c.save();c.beginPath();draw();c.fillStyle=base;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=width;c.stroke();}c.restore();};
  const stroke=(draw,width=.045,edge='rgba(173,244,237,.7)',glow=0)=>{c.save();c.beginPath();draw();c.strokeStyle=edge;c.lineWidth=width;if(glow){c.shadowBlur=glow;c.shadowColor=edge;}c.stroke();c.restore();};
  const poly=(points,base,edge='rgba(210,247,244,.5)')=>fill(()=>{points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();},base,edge);
  const eye=(ex,ey,scale=.075,iris='#dff')=>{c.save();c.fillStyle='#01070d';c.beginPath();c.ellipse(ex,ey,scale*1.4,scale,0,0,Math.PI*2);c.fill();c.fillStyle=iris;c.shadowBlur=.18;c.shadowColor=iris;c.beginPath();c.arc(ex+scale*.2,ey-scale*.05,scale*.42,0,Math.PI*2);c.fill();c.restore();};
  const tooth=(x0,y0,dir=1,scale=.11)=>poly([[x0-scale*.45,y0],[x0+scale*.45,y0],[x0,y0+dir*scale]],'#edf4e7','rgba(255,255,255,.45)');
  const node=(nx,ny,size=.035,glow='#68f6ef')=>{c.save();c.fillStyle=glow;c.shadowBlur=.16;c.shadowColor=glow;c.beginPath();c.arc(nx,ny,size*(.8+.3*pulse),0,Math.PI*2);c.fill();c.restore();};
  const plateLine=(x1,y1,x2,y2)=>stroke(()=>{c.moveTo(x1,y1);c.lineTo(x2,y2);},.028,'rgba(205,232,226,.32)');
  const dark=(alpha=.92)=>`rgba(2,12,20,${alpha})`;

  if(kind==='boss'){
   // Colossal blue-ringed octopus: heavy mineral mantle, eight hooked arms, warning rings.
   for(let arm=0;arm<8;arm++){
    const a=Math.PI+((arm-3.5)/7)*Math.PI*.92,sy=(arm-3.5)*.12;
    stroke(()=>{c.moveTo(-.32,sy*.35);c.bezierCurveTo(-.85,sy*.55+Math.sin(t*.003+arm)*.12,-1.15,Math.sin(a)*.55,-1.65,Math.sin(a)*.95);},.12-(arm%2)*.012,'rgba(48,76,88,.95)');
    stroke(()=>{c.moveTo(-.33,sy*.35);c.bezierCurveTo(-.75,sy*.48,-1.05,Math.sin(a)*.5,-1.55,Math.sin(a)*.9);},.038,'rgba(77,220,240,.45)');
   }
   fill(()=>{c.moveTo(-.42,.18);c.bezierCurveTo(-.78,-.2,-.62,-1.05,-.08,-1.35);c.bezierCurveTo(.5,-1.18,.82,-.72,.75,-.18);c.bezierCurveTo(.72,.35,.35,.62,-.16,.6);c.bezierCurveTo(-.48,.57,-.62,.38,-.42,.18);},'rgba(26,46,59,.98)','rgba(122,230,240,.62)',.06);
   // mineral crown
   poly([[-.42,-.82],[-.18,-1.42],[.02,-.9],[.27,-1.5],[.42,-.78]],'rgba(20,31,43,.95)','rgba(117,226,239,.45)');
   for(let i=0;i<10;i++){const a=i*2.399,rr=.16+(i%3)*.16;c.save();c.strokeStyle='#2bcfff';c.lineWidth=.035;c.shadowBlur=.14;c.shadowColor='#1cb8ff';c.beginPath();c.arc(-.03+Math.cos(a)*rr,-.34+Math.sin(a)*rr*.72,.07+(i%2)*.015,0,Math.PI*2);c.stroke();c.restore();}
   eye(.18,-.2,.1,'#ffedf5');eye(.46,-.11,.07,'#ffbd6f');
   stroke(()=>{c.moveTo(.1,.16);c.bezierCurveTo(.22,.35,.46,.34,.58,.13);},.06,'#ff9aae',.12);
   for(let i=0;i<5;i++)tooth(.19+i*.075,.18,1,.07);
   node(-.42,-.15,.04,'#2bdcff');node(-.36,.1,.035,'#2bdcff');
  } else if(kind==='angler'){
   // Anglerfish: enormous skull, cavernous jaw, needle teeth, long illicium.
   poly([[-1.45,0],[-2.05,-.48],[-1.82,0],[-2.05,.44]],'rgba(24,37,46,.98)','rgba(156,117,68,.38)');
   fill(()=>{c.moveTo(-1.35,.05);c.bezierCurveTo(-1.1,-.72,-.45,-.95,.25,-.72);c.quadraticCurveTo(.75,-.56,1.12,-.12);c.quadraticCurveTo(.72,.13,.25,.2);c.bezierCurveTo(-.45,.42,-1.05,.35,-1.35,.05);},'rgba(28,34,39,.98)','rgba(232,177,97,.48)',.055);
   // armored forehead
   for(let i=0;i<5;i++)poly([[-.88+i*.25,-.55],[-.72+i*.25,-.86],[-.48+i*.25,-.58]],'rgba(49,55,58,.94)','rgba(208,155,84,.34)');
   fill(()=>{c.moveTo(.12,-.18);c.lineTo(1.15,-.28);c.lineTo(.74,.02);c.lineTo(1.18,.5);c.lineTo(.05,.35);c.closePath();},dark(.98),'rgba(255,202,116,.62)',.06);
   for(let i=0;i<9;i++){tooth(.17+i*.105,-.17,1,.12);tooth(.15+i*.105,.34,-1,.11);}
   eye(.32,-.48,.095,'#ffc96d');
   stroke(()=>{c.moveTo(-.16,-.65);c.bezierCurveTo(-.05,-1.22,.48,-1.52,.92,-1.28);},.055,'#a16e3b');
   node(.94,-1.27,.11,'#ffd06e');
   for(let i=0;i<7;i++)node(-.9+i*.22,.22,.026,'#ff9d54');
  } else if(kind==='maw'){
   // Pelican eel boss: enormous hinge jaw and black throat pouch.
   stroke(()=>{c.moveTo(-2.35,0);c.bezierCurveTo(-1.45,-.16,-.62,.18,.1,.02);},.34,'rgba(22,20,34,.98)');
   poly([[-2.15,0],[-2.55,-.38],[-2.42,0],[-2.55,.38]],'rgba(36,28,50,.98)','rgba(189,111,226,.38)');
   fill(()=>{c.ellipse(.28,.03,.78,.5,-.04,0,Math.PI*2);},'rgba(31,24,43,.98)','rgba(224,153,255,.55)',.05);
   // upper and lower jaws
   fill(()=>{c.moveTo(-.02,-.12);c.bezierCurveTo(.4,-.85,1.22,-.82,1.72,-.3);c.bezierCurveTo(1.15,-.38,.55,-.28,-.02,-.12);},'rgba(42,30,54,.98)','rgba(239,171,255,.65)',.055);
   fill(()=>{c.moveTo(-.02,.12);c.bezierCurveTo(.42,.9,1.2,.82,1.75,.3);c.bezierCurveTo(1.1,.38,.5,.28,-.02,.12);},'rgba(35,25,49,.98)','rgba(239,171,255,.58)',.055);
   fill(()=>{c.ellipse(.92,.03,.78,.48,0,0,Math.PI*2);},'#01050b','#8a4da4',.035);
   for(let i=0;i<10;i++){const xx=.16+i*.145;tooth(xx,-.16,1,.11);tooth(xx,.17,-1,.11);}
   eye(.16,-.34,.065,'#f5caff');
   for(let i=0;i<5;i++)node(-1.4+i*.34,.13,.026,'#d68cff');
  } else if(kind==='leviathan'){
   // Oarfish leviathan: very long ribbon body, segmented armor, scarlet dorsal crest.
   fill(()=>{c.moveTo(-3.25,.02);c.bezierCurveTo(-2.3,-.46,-1.3,-.2,-.35,-.34);c.bezierCurveTo(.25,-.42,.82,-.25,1.22,-.04);c.bezierCurveTo(.82,.28,.25,.35,-.48,.3);c.bezierCurveTo(-1.65,.25,-2.45,.48,-3.25,.02);},'rgba(22,47,54,.98)','rgba(126,243,226,.55)',.05);
   for(let i=0;i<13;i++){const xx=-2.55+i*.26;plateLine(xx,-.27,xx+.05,.27);if(i<11)poly([[xx,-.29],[xx+.07,-.72-(i%3)*.12],[xx+.18,-.28]],i%2?'rgba(102,24,38,.95)':'rgba(131,31,45,.95)','rgba(255,115,131,.42)');}
   poly([[-3.0,.02],[-3.55,-.38],[-3.34,.02],[-3.58,.38]],'rgba(19,44,52,.98)','rgba(112,231,219,.45)');
   fill(()=>{c.ellipse(.83,-.02,.43,.3,-.08,0,Math.PI*2);},'rgba(111,149,151,.92)','rgba(219,255,246,.62)',.04);
   eye(.97,-.13,.055,'#a5fff1');
   for(let i=0;i<9;i++)node(-2.1+i*.32,.12,.022,'#64f4e3');
  } else if(kind==='whiteSharkBoss'){
   // Colossal great white: exaggerated skull, serrated jaw, battle scars and luminous lateral organs.
   poly([[-1.45,0],[-2.2,-.82],[-1.9,-.08],[-2.28,.72]],'rgba(25,45,54,.98)','rgba(124,203,221,.4)');
   poly([[-.35,-.36],[-.03,-1.22],[.24,-.4]],'rgba(34,58,68,.98)','rgba(130,208,226,.42)');
   fill(()=>{c.moveTo(-1.65,.02);c.bezierCurveTo(-1.05,-.55,-.2,-.62,.78,-.32);c.lineTo(1.65,-.06);c.lineTo(.92,.2);c.bezierCurveTo(.08,.58,-1.05,.45,-1.65,.02);},'rgba(35,65,76,.98)','rgba(168,226,238,.62)',.055);
   fill(()=>{c.moveTo(-.45,.2);c.bezierCurveTo(.3,.48,1.42,.18,1.6,.02);c.bezierCurveTo(1.17,.52,.22,.62,-.62,.35);},'rgba(181,193,187,.92)','rgba(235,247,242,.5)',.035);
   fill(()=>{c.moveTo(.8,.02);c.quadraticCurveTo(1.45,.02,1.72,.0);c.quadraticCurveTo(1.42,.42,.72,.31);c.closePath();},'#071017','#adc9cc',.035);
   for(let i=0;i<8;i++)tooth(.92+i*.075,.09,1,.085);
   eye(.94,-.22,.075,'#ff4058');
   for(let i=0;i<5;i++)plateLine(-.9+i*.22,-.28,-.75+i*.22,.23);
   stroke(()=>{c.moveTo(-.78,-.18);c.lineTo(-.3,-.04);c.lineTo(.08,-.2);},.03,'rgba(211,238,240,.52)');
   for(let i=0;i<7;i++)node(-.7+i*.25,.1,.02,'#66e8ff');
  } else if(kind==='kraken'){
   // Trench kraken: spear mantle, two feeding tentacles much longer than the other arms.
   for(let arm=0;arm<8;arm++){const sy=(arm-3.5)*.1,far=arm===0||arm===7;stroke(()=>{c.moveTo(-.28,sy*.42);c.bezierCurveTo(-.9,sy*.8,-1.35,sy*1.5+(arm%2?.18:-.18),far?-2.85:-1.9,sy*2.1);},far?.08:.105,far?'rgba(111,75,177,.96)':'rgba(73,54,117,.98)');}
   fill(()=>{c.moveTo(-.45,.18);c.bezierCurveTo(-.72,-.18,-.48,-1.2,.12,-1.7);c.bezierCurveTo(.62,-1.25,.84,-.62,.68,-.05);c.quadraticCurveTo(.42,.5,-.2,.58);c.closePath();},'rgba(27,22,52,.98)','rgba(167,126,255,.6)',.055);
   poly([[-.22,-1.22],[.12,-1.92],[.34,-1.18]],'rgba(42,31,72,.98)','rgba(188,144,255,.5)');
   eye(.04,-.34,.1,'#d7c0ff');eye(.36,-.28,.085,'#ff4975');
   for(let i=0;i<8;i++)node(-.2+i*.11,.18,.025,i%2?'#a67cff':'#55f1e7');
   stroke(()=>{c.moveTo(-.1,.02);c.bezierCurveTo(.05,.22,.3,.24,.46,.02);},.05,'rgba(236,220,255,.8)');
  } else if(kind==='devourer'){
   // Colossal squid: massive mantle, hooked arms, dark beak and internal photophore scars.
   for(let arm=0;arm<10;arm++){const sy=(arm-4.5)*.105,far=arm===0||arm===9;stroke(()=>{c.moveTo(-.38,sy*.42);c.bezierCurveTo(-.9,sy*.7,-1.45,sy*1.2,far?-2.55:-1.82,sy*1.72+Math.sin(t*.003+arm)*.08);},far?.075:.11,'rgba(36,91,89,.98)');}
   fill(()=>{c.moveTo(-.52,.15);c.bezierCurveTo(-.8,-.3,-.55,-1.38,.12,-1.72);c.bezierCurveTo(.82,-1.38,1.05,-.55,.75,.02);c.bezierCurveTo(.55,.44,.08,.62,-.52,.15);},'rgba(17,48,48,.98)','rgba(96,233,216,.58)',.06);
   poly([[-.18,-1.16],[.15,-1.82],[.43,-1.08]],'rgba(24,64,64,.98)','rgba(92,225,211,.45)');
   fill(()=>{c.ellipse(.22,.1,.36,.26,0,0,Math.PI*2);},'#020709','rgba(84,205,193,.48)',.04);
   eye(.08,-.34,.09,'#8ffff0');eye(.42,-.28,.075,'#ff5d75');
   for(let i=0;i<11;i++)node(-.25+(i%4)*.22,-.78+Math.floor(i/4)*.34,.022,i%3?'#55f3df':'#ff657a');
   stroke(()=>{c.moveTo(-.22,-.82);c.lineTo(.4,.26);c.moveTo(-.08,-1.08);c.lineTo(.55,.02);},.028,'rgba(183,244,235,.3)');
  } else {
   fill(()=>{c.ellipse(0,0,1,.55,0,0,Math.PI*2);},dark(.96),'rgba(131,228,220,.55)');
   eye(.45,-.16,.08);
  }

  c.restore();
 };
})();