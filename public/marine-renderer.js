(function(){
'use strict';

// CANONICAL MARINE SKIN RENDERER
// Visual contract:
// 1) anatomy/silhouette identifies the species;
// 2) dark organic/mineral material identifies the Abyssal universe;
// 3) accent color is secondary bioluminescence, never a flat recolor;
// 4) every family must remain readable at shop-preview scale and gameplay scale.
window.drawMarineSpecies=function(c,s,x,y,r,angle,t){
 const v=Math.max(0,Math.min(9,Number(s.variant)||0)),family=String(s.family||'fish'),accent=s.color||'#70e9df',phase=t*.002+v*.71;
 c.save();c.translate(x,y);c.rotate(Number(angle)||0);c.scale(r,r);c.lineCap='round';c.lineJoin='round';

 const bodyGrad=(dark='#061019',mid='#17313a',light=accent)=>{
   const g=c.createLinearGradient(-1.6,-.9,1.45,.8);
   g.addColorStop(0,dark);g.addColorStop(.27,mid);g.addColorStop(.54,light);g.addColorStop(.72,mid);g.addColorStop(1,'#02070c');return g;
 };
 const glassGrad=()=>{const g=c.createRadialGradient(-.18,-.22,.02,.05,0,1.15);g.addColorStop(0,'rgba(225,255,255,.78)');g.addColorStop(.2,accent);g.addColorStop(.52,'rgba(39,94,111,.72)');g.addColorStop(1,'rgba(1,10,17,.94)');return g;};
 const path=(pts,close=true)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));if(close)c.closePath();};
 const fillPath=(pts,paint=bodyGrad(),edge='rgba(190,238,235,.52)',w=.045)=>{c.save();path(pts);c.fillStyle=paint;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=w;c.stroke();}c.restore();};
 const ellipse=(ex,ey,rx,ry,rot=0,paint=bodyGrad(),edge='rgba(190,238,235,.5)',w=.045)=>{c.save();c.beginPath();c.ellipse(ex,ey,rx,ry,rot,0,Math.PI*2);c.fillStyle=paint;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=w;c.stroke();}c.restore();};
 const stroke=(pts,w=.045,col='rgba(170,234,230,.62)',glow=0)=>{c.save();path(pts,false);c.strokeStyle=col;c.lineWidth=w;if(glow){c.shadowBlur=glow;c.shadowColor=col;}c.stroke();c.restore();};
 const bezier=(start,c1,c2,end,w=.05,col=accent,glow=0)=>{c.save();c.beginPath();c.moveTo(start[0],start[1]);c.bezierCurveTo(c1[0],c1[1],c2[0],c2[1],end[0],end[1]);c.strokeStyle=col;c.lineWidth=w;if(glow){c.shadowBlur=glow;c.shadowColor=col;}c.stroke();c.restore();};
 const eye=(ex,ey,size=.075,iris=accent)=>{c.save();c.fillStyle='#02070b';c.beginPath();c.ellipse(ex,ey,size*1.3,size,0,0,Math.PI*2);c.fill();c.fillStyle=iris;c.shadowBlur=.16;c.shadowColor=iris;c.beginPath();c.arc(ex+size*.18,ey-size*.08,size*.42,0,Math.PI*2);c.fill();c.restore();};
 const mouth=(x0,y0,rx,ry,teeth=0)=>{c.save();c.fillStyle='#010409';c.strokeStyle='rgba(223,237,229,.42)';c.lineWidth=.03;c.beginPath();c.ellipse(x0,y0,rx,ry,0,0,Math.PI*2);c.fill();c.stroke();if(teeth){c.fillStyle='#eef3e7';for(let i=0;i<teeth;i++){const a=(i/(teeth-1)-.5)*Math.PI*.82,tx=x0+Math.cos(a)*rx*.84,ty=y0+Math.sin(a)*ry*.72;c.beginPath();c.moveTo(tx,ty);c.lineTo(tx-.035,ty+(i%2?.09:-.09));c.lineTo(tx+.035,ty+(i%2?.09:-.09));c.closePath();c.fill();}}c.restore();};
 const fin=(pts,alpha=.92)=>fillPath(pts,bodyGrad('#030b11','rgba(20,47,56,'+alpha+')',accent),'rgba(178,226,224,.42)',.035);
 const pore=(px,py,sz=.022,col=accent)=>{c.save();c.fillStyle=col;c.shadowBlur=.12;c.shadowColor=col;c.globalCompositeOperation='lighter';c.beginPath();c.arc(px,py,sz,0,Math.PI*2);c.fill();c.restore();};
 const pores=(count=5,y=.12,start=-.48,end=.48)=>{for(let i=0;i<count;i++)pore(start+(end-start)*(i/Math.max(1,count-1)),y+(i%2?.035:-.035),.018+(i%3)*.004);};
 const scars=(count=2)=>{for(let i=0;i<count;i++){const sx=-.5+i*.28;stroke([[sx,-.22],[sx+.09,-.04],[sx+.17,.18]],.021,'rgba(220,238,231,.2)');}};
 const ribs=(count=5,start=-.45,step=.18)=>{for(let i=0;i<count;i++)stroke([[start+i*step,-.28],[start+i*step+.04,.28]],.022,'rgba(222,241,235,.2)');};
 const spike=(x0,y0,len=.35,dir=-1)=>fillPath([[x0-.08,y0],[x0,y0+dir*len],[x0+.09,y0]],bodyGrad('#050c12','#263943',accent),'rgba(180,225,220,.36)',.025);
 const tailFork=(x0,scale=1)=>{fin([[x0,0],[x0-.52*scale,-.46*scale],[x0-.34*scale,-.04],[x0-.55*scale,.42*scale]]);};
 const shadow=()=>{c.save();c.globalAlpha=.14;c.fillStyle=accent;c.beginPath();c.ellipse(-.05,.7,.72,.12,0,0,Math.PI*2);c.fill();c.restore();};
 const materialPass=(density=1)=>{
   c.save();c.globalCompositeOperation='lighter';for(let i=0;i<3+density+(v%3);i++){const px=-.5+i*(1.05/(2+density+v%3)),py=(i%2?.14:-.16)+(v%2)*.03;pore(px,py,.014+(i%2)*.006,i%3===0?'rgba(255,110,166,.6)':accent);}c.restore();
   scars(1+(v%3===0?1:0));
 };

 shadow();

 const drawShark=()=>{
   if(v===2){ // whale shark
     tailFork(-1.18,.95);fin([[-.22,-.36],[-.02,-.92],[.22,-.36]]);fin([[-.12,.28],[-.55,.72],[.44,.34]]);
     fillPath([[-1.2,0],[-.95,-.45],[-.1,-.58],[.92,-.38],[1.42,-.18],[1.5,.18],[.95,.38],[-.1,.58],[-.95,.45]]);
     mouth(1.34,0,.23,.2,0);eye(.95,-.25,.055);ribs(5,.55,-.09);
     c.save();c.fillStyle='rgba(220,238,215,.64)';for(let i=0;i<24;i++){const px=-.72+(i%8)*.21,py=-.31+Math.floor(i/8)*.31;c.beginPath();c.arc(px,py,.018+(i%3)*.004,0,Math.PI*2);c.fill();}c.restore();pores(5,.12,-.6,.45);return;
   }
   if(v===3){ // basking
     tailFork(-1.18,.9);fin([[-.2,-.35],[-.04,-.88],[.23,-.35]]);fillPath([[-1.18,0],[-.92,-.42],[-.1,-.52],[.7,-.36],[1.15,-.22],[1.35,.22],[.72,.36],[-.12,.52],[-.9,.42]]);
     mouth(1.08,.02,.46,.34,0);for(let i=0;i<6;i++)stroke([[.52-i*.08,-.28],[.46-i*.08,.3]],.032,'rgba(223,239,231,.45)');eye(.64,-.28,.05);materialPass(1);return;
   }
   if(v===4){ // mako
     tailFork(-1.28,1.05);fin([[-.18,-.3],[-.04,-.95],[.18,-.3]]);fin([[-.04,.22],[-.48,.67],[.48,.28]]);
     fillPath([[-1.3,0],[-.82,-.34],[.2,-.42],[1.58,0],[.2,.42],[-.82,.34]]);eye(.82,-.18,.052);mouth(1.02,.12,.25,.09,3);pores(4,.08,-.5,.45);return;
   }
   if(v===5){ // thresher
     fillPath([[-1.0,0],[-.76,-.36],[.08,-.43],[1.28,0],[.05,.43],[-.75,.36]]);
     fin([[-.18,-.32],[-.02,-.83],[.21,-.31]]);fillPath([[-.93,-.05],[-1.95,-1.32],[-1.48,-.16],[-1.9,.42]],bodyGrad('#020a10','#122a33',accent));eye(.75,-.18,.052);mouth(.98,.1,.22,.08,2);materialPass(1);return;
   }
   if(v===6){ // goblin
     tailFork(-1.05,.82);fillPath([[-1.1,0],[-.74,-.38],[.05,-.46],[.88,-.26],[1.78,-.08],[1.78,.08],[.9,.26],[.05,.46],[-.74,.38]]);
     fin([[-.15,-.33],[0,-.74],[.18,-.33]]);mouth(1.06,.16,.33,.16,6);eye(.6,-.19,.048,'#ff6f83');pores(5,.09,-.55,.3);return;
   }
   if(v===7){ // frilled
     bezier([1.05,0],[.25,-.36],[-.65,.38],[-1.9,Math.sin(phase)*.15],.34,bodyGrad());ellipse(.82,0,.48,.27,0,bodyGrad());fin([[-1.58,0],[-1.98,-.28],[-1.9,.28]]);
     for(let i=0;i<6;i++)stroke([[.42-i*.08,-.2],[.36-i*.08,.2]],.026,'rgba(232,238,223,.44)');eye(1.05,-.12,.045);mouth(1.18,.11,.2,.09,5);return;
   }
   if(v===8){ // lantern shark
     tailFork(-.9,.7);ellipse(.05,0,.92,.34);fin([[-.15,-.28],[.02,-.7],[.2,-.27]]);eye(.65,-.18,.095);for(let i=0;i<9;i++)pore(-.5+i*.12,.24,.024,'#72fff0');mouth(.72,.09,.18,.07,2);return;
   }
   if(v===9){ // greenland
     tailFork(-1.15,.72);ellipse(-.03,0,1.2,.52);fin([[-.26,-.38],[-.05,-.66],[.18,-.36]]);fin([[-.04,.31],[-.38,.58],[.51,.34]]);eye(.72,-.21,.042);mouth(.92,.13,.25,.08,2);ribs(5,.34,-.1);materialPass(2);return;
   }
   const tiger=v===1;tailFork(-1.18,.9);fillPath([[-1.2,0],[-.84,-.38],[.05,-.46],[1.35,0],[.05,.46],[-.84,.38]]);fin([[-.25,-.32],[-.08,-.88],[.16,-.31]]);fin([[-.04,.24],[-.48,.68],[.44,.29]]);eye(.76,-.18,.055);mouth(.97,.1,.25,.08,3);
   if(tiger)for(let i=0;i<6;i++)stroke([[-.55+i*.2,-.34],[-.42+i*.2,.34]],.045,'rgba(20,10,16,.68)');else pores(4,.1,-.48,.38);materialPass(1);
 };

 const drawRay=()=>{
   const manta=v<=1,eagle=v===2||v===3,guitar=v===6,round=v===7;
   if(guitar){fillPath([[-1.65,0],[-.65,-.22],[.1,-.36],[1.25,0],[.1,.36],[-.65,.22]]);tailFork(-1.65,.38);fin([[.1,-.22],[-.22,-.72],[.55,-.28]]);eye(.65,-.12,.05);pores(4,.12,-.2,.48);return;}
   if(round){ellipse(.05,0,1,.78);bezier([-.72,0],[-1.2,.03],[-1.7,.09],[-2.15,.16],.075,accent);eye(.35,-.2,.05);for(let i=0;i<6;i++)pore(-.45+i*.18,.2,.018);materialPass(1);return;}
   bezier([-.35,0],[-1.1,.03],[-1.8,.04],[-2.35,.13],.06,bodyGrad());
   if(manta)fillPath([[1.2,0],[.2,-1.18],[-.82,-.46],[-.58,0],[-.82,.46],[.2,1.18]]);
   else if(eagle)fillPath([[1.08,0],[.22,-.9],[-.78,-.38],[-.58,0],[-.78,.38],[.22,.9]]);
   else fillPath([[1.02,0],[.08,-.72],[-.75,-.34],[-.62,0],[-.75,.34],[.08,.72]]);
   ellipse(.15,0,.57,.24,0,bodyGrad('#030b12','#17333b',accent),'rgba(201,238,234,.46)',.035);eye(.46,-.16,.045);pores(5,.1,-.4,.42);
   if(v===4||v===5)for(let i=0;i<4;i++)spike(-.2+i*.28,-.28,.24,-1);materialPass(1);
 };

 const drawEel=()=>{
   // Species-specific eel heads are mandatory; never render a naked colored line.
   const bodyW=[.28,.3,.22,.32,.14,.38,.34,.3,.23,.36][v],len=[1.9,1.8,2.15,1.95,2.3,2.05,1.85,1.95,2.15,1.85][v];
   bezier([.75,0],[.0,-.42],[-.85,.42],[-len,Math.sin(phase)*.18],bodyW,bodyGrad());
   if(v===4){ellipse(.78,0,.32,.16);eye(.9,-.06,.035);pores(3,.05,.45,.78);return;} // garden eel
   if(v===6){ // pelican
     ellipse(.68,0,.52,.27);mouth(.93,.05,.48,.33,0);eye(.53,-.18,.05);fin([[-1.55,0],[-2.05,-.28],[-1.95,.28]]);for(let i=0;i<5;i++)pore(-.55+i*.28,.15,.022);return;
   }
   if(v===2){ // ribbon moray
     ellipse(.7,0,.42,.22);fillPath([[.43,-.15],[.7,-.52],[.86,-.13]],bodyGrad());mouth(.91,.08,.23,.1,4);eye(.74,-.12,.045);for(let i=0;i<5;i++)stroke([[-.55+i*.28,-.19],[-.42+i*.28,.19]],.028,'rgba(173,106,235,.5)');return;
   }
   if(v===3){ // dragon moray
     ellipse(.72,0,.48,.27);for(let i=0;i<4;i++)spike(.25+i*.18,-.22,.24+(i%2)*.08,-1);mouth(.98,.08,.27,.12,6);eye(.73,-.14,.055,'#ff5570');materialPass(2);return;
   }
   if(v===7){ // saw eel
     ellipse(.72,0,.44,.22);fillPath([[.92,-.08],[1.5,0],[.92,.08]],bodyGrad('#040a10','#283842',accent));for(let i=0;i<5;i++)spike(1.05+i*.09,-.04,.11,-1);eye(.72,-.12,.045);return;
   }
   if(v===8){ellipse(.74,0,.36,.18);fillPath([[.86,-.08],[1.48,0],[.86,.08]],bodyGrad());eye(.72,-.1,.04);pores(4,.08,.3,.72);return;}
   if(v===9){ellipse(.72,0,.5,.26);mouth(.98,.06,.34,.22,5);eye(.57,-.16,.05);for(let i=0;i<4;i++)pore(-.35+i*.24,.15,.02);return;}
   ellipse(.72,0,v===5?.5:.44,v===5?.28:.24);mouth(.95,.08,.25,.11,v===0?2:5);eye(.72,-.13,.05);if(v===0)for(let i=0;i<5;i++)stroke([[-.15+i*.18,-.21],[-.05+i*.17,.2]],.03,'rgba(236,235,219,.38)');if(v===1)for(let i=0;i<6;i++)pore(-.35+i*.17,.16,.018,'#f4c873');materialPass(1);
 };

 const arm=(sy,len,width=.055,col=bodyGrad())=>bezier([-.28,sy*.35],[-.75,sy*.8],[-1.25,sy*1.45+Math.sin(phase+sy*8)*.14],[-len,sy*2.05],width,col);
 const drawSquid=()=>{
   const lengths=[1.55,1.65,1.9,1.62,1.48,1.72,1.4,2.28,2.08,1.95];
   for(let i=0;i<10;i++){const sy=(i-4.5)*.095,feeding=i===0||i===9;arm(sy,feeding?lengths[v]+.55:lengths[v],feeding?.04:.062);}
   if(v===0)fillPath([[1.18,0],[.3,-.5],[-.42,-.24],[-.42,.24],[.3,.5]]);
   else if(v===1){fillPath([[1.08,0],[.36,-.42],[-.42,-.22],[-.42,.22],[.36,.42]],glassGrad());ribs(6,-.15,.15);}
   else if(v===2){fillPath([[1.3,0],[.2,-.64],[-.5,-.3],[-.5,.3],[.2,.64]]);fin([[.1,-.4],[-.28,-.9],[.55,-.36]]);fin([[.1,.4],[-.28,.9],[.55,.36]]);}
   else if(v===3){fillPath([[1.08,0],[.15,-.82],[-.42,-.22],[-.42,.22],[.15,.82]]);fin([[.36,-.38],[.72,-.88],[.76,-.2]]);fin([[.36,.38],[.72,.88],[.76,.2]]);}
   else if(v===4){fillPath([[1.05,0],[.62,-.58],[.12,-.72],[-.4,-.48],[-.55,0],[-.4,.48],[.12,.72],[.62,.58]],glassGrad());for(let i=0;i<5;i++)pore(-.2+i*.18,i%2?.18:-.18,.025);}
   else if(v===5){fillPath([[1.02,0],[.28,-.48],[-.5,-.28],[-.5,.28],[.28,.48]]);for(let i=0;i<7;i++)pore(-.26+i*.15,i%2?.18:-.18,.024,i%3?'#79fff0':'#ff7ca8');}
   else if(v===6){fillPath([[.92,0],[.5,-.4],[.08,-.5],[-.4,-.32],[-.5,0],[-.4,.32],[.08,.5],[.5,.4]],bodyGrad('#070914','#38214c',accent));fin([[.08,-.35],[-.24,-.8],[.48,-.3]]);fin([[.08,.35],[-.24,.8],[.48,.3]]);}
   else if(v===7){fillPath([[.86,0],[.2,-.34],[-.55,-.18],[-.55,.18],[.2,.34]]);for(let side of [-1,1])bezier([-.2,side*.16],[-.75,side*.32],[-1.4,side*.58],[-2.35,side*.72],.035,accent);}
   else if(v===8){fillPath([[1.42,0],[.35,-.72],[-.6,-.32],[-.6,.32],[.35,.72]]);fin([[.1,-.48],[-.35,-1.0],[.72,-.42]]);fin([[.1,.48],[-.35,1.0],[.72,.42]]);}
   else {fillPath([[1.25,0],[.42,-.86],[-.62,-.34],[-.62,.34],[.42,.86]],bodyGrad('#030b11','#21423f',accent));ribs(5,-.28,.22);}
   eye(.46,-.16,v>=8?.07:.055);materialPass(2);
 };
 const drawOctopus=()=>{
   const lens=[1.55,1.65,1.5,1.58,1.9,1.48,1.62,1.72,1.88,1.75];
   for(let i=0;i<8;i++){const sy=(i-3.5)*.12,extra=v===4?(i%2)*.45:0;arm(sy,lens[v]+extra+(v===8?i*.03:0),v===5?.045:.075);}
   if(v===0)ellipse(.3,0,.72,.62);
   else if(v===1){ellipse(.28,0,.62,.54);for(let i=0;i<5;i++)stroke([[-.1+i*.14,-.5],[.05+i*.12,.5]],.026,'rgba(230,244,232,.34)');}
   else if(v===2){ellipse(.32,0,.58,.5);fin([[.4,-.42],[.8,-.76],[.55,-.26]]);fin([[.4,.42],[.8,.76],[.55,.26]]);}
   else if(v===3){ellipse(.3,0,.66,.58);for(let i=0;i<8;i++){const a=i*Math.PI/4;c.save();c.strokeStyle='#43d9ff';c.lineWidth=.035;c.shadowBlur=.12;c.shadowColor='#43d9ff';c.beginPath();c.arc(.3+Math.cos(a)*.26,Math.sin(a)*.24,.055,0,Math.PI*2);c.stroke();c.restore();}}
   else if(v===4){ellipse(.26,0,.48,.72);fin([[.18,-.56],[-.26,-1.2],[-.06,-.4]]);fin([[.18,.56],[-.26,1.2],[-.06,.4]]);}
   else if(v===5){ellipse(.3,0,.6,.74,0,glassGrad());ribs(6,-.25,.11);}
   else if(v===6||v===7){ellipse(.24,0,.5,.64);fin([[.14,-.52],[-.28,-1.08],[-.02,-.38]]);fin([[.14,.52],[-.28,1.08],[-.02,.38]]);}
   else if(v===8){ellipse(.28,0,.58,.5);for(let i=0;i<5;i++)spike(-.15+i*.16,-.44,.2+(i%2)*.08,-1);}
   else {ellipse(.26,0,.78,.7);ribs(6,-.45,.18);}
   eye(.46,-.17,v===3?.065:.055);mouth(.52,.12,.14,.06,v===9?4:0);materialPass(2);
 };
 const drawJelly=()=>{
   const bell=[.78,.72,.7,.92,.68,.64,.76,1.05,.62,.98][v],height=[.62,.72,.56,.72,.74,.58,.76,1.08,.68,1.0][v];
   c.save();c.fillStyle=glassGrad();c.strokeStyle='rgba(198,239,238,.48)';c.lineWidth=.04;c.beginPath();c.moveTo(bell,.08);c.bezierCurveTo(bell*.9,-height,-bell*.72,-height,-bell,.08);c.quadraticCurveTo(0,.42,bell,.08);c.fill();c.stroke();c.restore();
   const count=6+(v%5);for(let i=0;i<count;i++){const px=-bell*.72+i*((bell*1.44)/(count-1));bezier([px,.12],[px+.08,.48],[px-.12,.82],[px+Math.sin(phase+i)*.08,1.15+(i%3)*.28],.028+(i%2)*.008,i%3===0?'#ff7ba5':accent);}
   if(v===3)for(let i=0;i<8;i++)spike(-.55+i*.16,-.18,.22,-1);if(v===5||v===6)pores(5,-.08,-.4,.4);if(v===8)for(let i=0;i<6;i++)pore(-.35+i*.14,-.16,.03,'#ff8d4e');materialPass(1);
 };
 const drawCrustacean=()=>{
   if(v===5){ellipse(0,0,.62,.42);for(let i=0;i<5;i++){const xx=.45-i*.2;stroke([[xx,0],[xx-.35,-.85],[xx-.78,-1.35]],.055,bodyGrad());stroke([[xx,0],[xx-.35,.85],[xx-.78,1.35]],.055,bodyGrad());}eye(.38,-.18,.045);materialPass(1);return;}
   if(v===7){ellipse(0,0,1.08,.55);ribs(8,-.68,.19);for(let i=0;i<6;i++){const xx=.55-i*.2;stroke([[xx,.35],[xx-.12,.82]],.05,bodyGrad());stroke([[xx,-.35],[xx-.12,-.82]],.05,bodyGrad());}eye(.72,-.18,.04);materialPass(2);return;}
   if(v===4){ // mantis shrimp
     ellipse(.08,0,.94,.34);ribs(6,-.4,.18);fillPath([[.65,-.22],[1.18,-.48],[.98,-.08]],bodyGrad());fillPath([[.65,.22],[1.18,.48],[.98,.08]],bodyGrad());eye(.75,-.28,.06,'#ffeb72');eye(.75,.28,.06,'#72fff1');tailFork(-.88,.55);materialPass(2);return;
   }
   if(v===3){ellipse(.05,0,.88,.34);stroke([[.55,-.15],[1.35,-.6]],.08,bodyGrad());stroke([[.55,.15],[1.35,.6]],.08,bodyGrad());eye(.58,-.22,.05,'#ff7b6e');tailFork(-.8,.45);materialPass(1);return;}
   if(v===6){ellipse(.02,0,.72,.4);for(let i=0;i<5;i++){const xx=.45-i*.22;stroke([[xx,.28],[xx-.18,.72]],.065,'rgba(218,234,226,.62)');stroke([[xx,-.28],[xx-.18,-.72]],.065,'rgba(218,234,226,.62)');}eye(.5,-.18,.045);for(let i=0;i<6;i++)pore(-.4+i*.16,.2,.02,'#d8fff3');return;}
   ellipse(0,0,.9,.46);for(let i=0;i<5;i++){const xx=.55-i*.28;stroke([[xx,0],[xx-.2,-.68],[xx-.42,-.92]],.05,bodyGrad());stroke([[xx,0],[xx-.2,.68],[xx-.42,.92]],.05,bodyGrad());}stroke([[.75,-.12],[1.45,-.55]],.07,bodyGrad());stroke([[.75,.12],[1.45,.55]],.07,bodyGrad());eye(.55,-.2,.045);if(v===8||v===9)pores(5,.18,-.35,.35);materialPass(1);
 };
 const drawFish=()=>{
   if(v===0){ellipse(.05,0,.88,.38);for(let i=0;i<8;i++)spike(-.45+i*.13,-.3,.35+(i%3)*.08,-1);tailFork(-.82,.55);eye(.6,-.18,.05);materialPass(2);return;}
   if(v===1){ellipse(.02,0,.76,.74);fin([[-.5,-.32],[-1.05,-.82],[-.72,-.18]]);fin([[-.5,.32],[-1.05,.82],[-.72,.18]]);eye(.4,-.22,.055);pores(5,.2,-.3,.35);return;}
   if(v===2){ellipse(.04,0,.95,.48);fillPath([[.62,-.25],[1.22,0],[.62,.25]]);fin([[-.18,-.36],[.0,-.9],[.25,-.34]]);eye(.62,-.2,.05);materialPass(1);return;}
   if(v===3){ellipse(.02,0,.78,.34);tailFork(-.72,.48);fin([[-.1,-.28],[.1,-.62],[.28,-.28]]);for(let i=0;i<7;i++)pore(-.4+i*.13,i%2?.16:-.16,.025,i%2?'#58ffe8':'#ff7baf');eye(.52,-.17,.05);return;}
   if(v===4){fillPath([[-.85,0],[-.45,-.72],[.55,-.52],[.88,0],[.48,.65],[-.38,.78]]);tailFork(-.75,.42);eye(.55,-.24,.08);pores(5,.25,-.3,.35);return;}
   if(v===5){bezier([.95,0],[.25,-.12],[-.75,.1],[-1.78,.02],.28,bodyGrad());fillPath([[.66,-.12],[1.35,0],[.66,.12]]);eye(.72,-.09,.055);for(let i=0;i<7;i++)pore(-.55+i*.18,.13,.02,'#72fff0');mouth(.94,.1,.2,.07,3);return;}
   if(v===6||v===7){ellipse(.05,0,.92,.36);tailFork(-.8,.45);mouth(.73,.08,.35,.24,7);eye(.58,-.18,v===7?.07:.06,'#ff6472');if(v===7)for(let i=0;i<4;i++)spike(-.2+i*.18,-.28,.24,-1);materialPass(2);return;}
   if(v===8){ellipse(.02,0,.9,.48,0,glassGrad());tailFork(-.72,.34);fin([[-.2,-.38],[.1,-.62],[.35,-.35]]);eye(.55,-.15,.045);pores(5,.18,-.3,.45);return;}
   ellipse(.22,0,.7,.25);tailFork(-.42,.32);stroke([[.15,.18],[-.1,1.35]],.035,bodyGrad());stroke([[.45,.18],[.72,1.35]],.035,bodyGrad());stroke([[-.25,.12],[-.55,1.25]],.035,bodyGrad());eye(.55,-.11,.04);materialPass(1);
 };
 const drawBenthic=()=>{
   if(v<=2){fillPath([[-1.0,0],[-.72,-.38],[.3,-.44],[1.0,-.2],[1.15,.15],[.25,.46],[-.72,.38]]);for(let i=0;i<6;i++)stroke([[-.5+i*.18,.22],[-.55+i*.18,.58]],.035,bodyGrad());if(v===1)for(let i=0;i<5;i++)pore(-.4+i*.2,-.18,.025,'#ff9a8c');materialPass(1);return;}
   if(v>=3&&v<=5){const pts=[];for(let i=0;i<20;i++){const a=i*Math.PI/10,rr=i%2?.38:1.15+(v-3)*.1;pts.push([Math.cos(a)*rr,Math.sin(a)*rr]);}fillPath(pts);if(v===5)for(let i=0;i<12;i++)pore(Math.cos(i*Math.PI/6)*.42,Math.sin(i*Math.PI/6)*.42,.025,'#ff8a70');return;}
   if(v>=6&&v<=7){ellipse(0,0,.72,.55);for(let i=0;i<14;i++){const a=i*Math.PI/7;stroke([[Math.cos(a)*.6,Math.sin(a)*.45],[Math.cos(a)*1.25,Math.sin(a)*.95]],.04,bodyGrad());}if(v===6)for(let i=0;i<8;i++)pore(Math.cos(i*Math.PI/4)*.35,Math.sin(i*Math.PI/4)*.25,.023,'#67fff0');return;}
   if(v===8){ellipse(0,0,.28,.26);for(let i=0;i<12;i++){const a=i*Math.PI/6;bezier([Math.cos(a)*.22,Math.sin(a)*.18],[Math.cos(a)*.55,Math.sin(a)*.42],[Math.cos(a)*.8,Math.sin(a)*.68],[Math.cos(a)*1.12,Math.sin(a)*.95],.035,bodyGrad());}return;}
   // harp sponge
   stroke([[-.72,.65],[-.72,-.65]],.08,bodyGrad());for(let i=0;i<6;i++){const yy=-.5+i*.2;stroke([[-.72,yy],[.35,yy-.3]],.045,bodyGrad());for(let k=0;k<4;k++)pore(-.4+k*.2,yy-.1-k*.03,.018,'#8ffff5');}
 };
 const drawMollusc=()=>{
   if(v<=1){ellipse(.05,0,.72,.62);c.save();c.strokeStyle='rgba(232,214,171,.55)';c.lineWidth=.05;c.beginPath();for(let i=0;i<70;i++){const a=i*.18,rr=.04+i*.008;c.lineTo(.05+Math.cos(a)*rr,Math.sin(a)*rr);}c.stroke();c.restore();for(let i=0;i<8;i++){const yy=(i-3.5)*.08;bezier([-.45,yy],[-.8,yy*1.4],[-1.1,yy*1.6],[-1.35,yy*1.7],.035,bodyGrad());}eye(.48,-.16,.045);materialPass(1);return;}
   if(v===2||v===3){fillPath([[1.0,0],[.35,-.45],[-.65,-.35],[-.9,0],[-.65,.35],[.35,.45]]);fin([[.18,-.28],[-.08,-.72],[.55,-.3]]);fin([[.18,.28],[-.08,.72],[.55,.3]]);eye(.45,-.16,.05);if(v===3)for(let i=0;i<6;i++)pore(-.35+i*.16,i%2?.18:-.18,.025,'#ff7f52');materialPass(2);return;}
   if(v===4){ellipse(.1,0,.5,.32);fin([[.3,-.25],[.52,-.52],[.65,-.18]]);fin([[.3,.25],[.52,.52],[.65,.18]]);for(let i=0;i<2;i++)spike(.42+i*.18,-.2,.22,-1);eye(.36,-.12,.04);return;}
   if(v===5){fillPath([[-.9,0],[-.35,-.28],[.15,-.48],[.8,-.18],[1.0,0],[.8,.18],[.15,.48],[-.35,.28]],glassGrad());for(let i=0;i<6;i++)spike(-.35+i*.22,i%2?.18:-.18,.18,i%2?1:-1);pores(4,.05,-.2,.5);return;}
   if(v===6||v===7){fillPath([[.75,0],[.15,-.38],[-.7,-.22],[-1.0,0],[-.7,.22],[.15,.38]],glassGrad());for(let i=0;i<5;i++)pore(-.4+i*.22,i%2?.16:-.16,.02);return;}
   if(v===8){ellipse(.05,0,.82,.46);for(let i=0;i<5;i++)ribs(1,-.45+i*.18,0);for(let i=0;i<7;i++)pore(-.55+i*.18,.22,.018,'#ff7d52');eye(.52,-.15,.04);return;}
   ellipse(0,0,.9,.5);ribs(7,-.55,.17);for(let side of [-1,1])for(let i=0;i<4;i++)stroke([[-.55+i*.25,side*.3],[-.65+i*.25,side*.62]],.03,bodyGrad());eye(.58,-.18,.04);materialPass(1);
 };

 switch(family){
   case 'shark':drawShark();break;
   case 'ray':drawRay();break;
   case 'eel':drawEel();break;
   case 'squid':drawSquid();break;
   case 'octopus':drawOctopus();break;
   case 'jelly':drawJelly();break;
   case 'crustacean':drawCrustacean();break;
   case 'fish':drawFish();break;
   case 'benthic':drawBenthic();break;
   case 'mollusc':drawMollusc();break;
   default:ellipse(0,0,.8,.5);eye(.45,-.15,.05);materialPass(1);
 }
 c.restore();
};
})();