(function(){
'use strict';

// CANONICAL MARINE SKIN RENDERER
// Visual contract:
// 1) anatomy/silhouette identifies the species;
// 2) dark organic/mineral material identifies the Abyssal universe;
// 3) accent color is secondary bioluminescence, never a flat recolor;
// 4) every family must remain readable at shop-preview scale and gameplay scale.
window.drawMarineSpecies=function(c,s,x,y,r,angle,t){
 const v=Math.max(0,Math.min(9,Number(s.variant)||0)),family=String(s.family||'fish'),art=s.art||{},accent=art.tone||s.color||'#70e9df',phase=t*.002+v*.71;
 const palette=art.palette||{base:accent,shadow:'#031019',rim:'#dffff8',glow:accent,accent,eye:'#ffffff'};
 c.save();c.translate(x,y);c.rotate(Number(angle)||0);c.scale(r,r);c.lineCap='round';c.lineJoin='round';

 const hexRgb=value=>{
  const m=String(value||'').trim().match(/^#([0-9a-f]{6})$/i);
  if(!m)return [112,233,223];
  const n=parseInt(m[1],16);return [(n>>16)&255,(n>>8)&255,n&255];
 };
 const rgb=hexRgb(accent);
 const tone=(alpha=.5,boost=0)=>`rgba(${Math.min(255,rgb[0]+boost)},${Math.min(255,rgb[1]+boost)},${Math.min(255,rgb[2]+boost)},${alpha})`;
 // Signature-skin color language: deep shadow, saturated body, contrasting accent and luminous rim.
 // The gradient belongs to the creature volume, never to a generic vignette around the card.
 const bodyGrad=(shadow=palette.shadow,base=palette.base,highlight=palette.accent)=>{
  const g=c.createLinearGradient(-1.35,-.72,1.2,.64);
  g.addColorStop(0,shadow);g.addColorStop(.28,base);g.addColorStop(.56,highlight);g.addColorStop(.76,base);g.addColorStop(1,shadow);return g;
 };
 const glassGrad=()=>{
  const g=c.createRadialGradient(-.12,-.16,.04,.02,0,.94);
  g.addColorStop(0,palette.rim);g.addColorStop(.18,palette.glow);g.addColorStop(.55,palette.base);g.addColorStop(1,palette.shadow);return g;
 };
 const path=(pts,close=true)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));if(close)c.closePath();};
 // Two-stage contour language: dark separator for color masses, then a thinner luminous rim.
 const separator='rgba(1,7,12,.9)';
 const contour=(edge,w=.045)=>{if(!edge)return;c.save();c.shadowBlur=0;c.strokeStyle=separator;c.lineWidth=Math.max(w*2.05,.072);c.stroke();c.strokeStyle=edge;c.lineWidth=w;c.stroke();c.restore();};
 const fillPath=(pts,paint=bodyGrad(),edge=palette.rim,w=.045)=>{c.save();path(pts);c.fillStyle=paint;c.fill();contour(edge,w);c.restore();};
 const ellipse=(ex,ey,rx,ry,rot=0,paint=bodyGrad(),edge=palette.rim,w=.045)=>{c.save();c.beginPath();c.ellipse(ex,ey,rx,ry,rot,0,Math.PI*2);c.fillStyle=paint;c.fill();contour(edge,w);c.restore();};
 const stroke=(pts,w=.045,col='rgba(170,234,230,.62)',glow=0)=>{c.save();path(pts,false);if(w>=.035){c.strokeStyle=separator;c.lineWidth=w*1.85;c.shadowBlur=0;c.stroke();}c.strokeStyle=col;c.lineWidth=w;if(glow){c.shadowBlur=glow;c.shadowColor=col;}c.stroke();c.restore();};
 const bezier=(start,c1,c2,end,w=.05,col=accent,glow=0)=>{c.save();c.beginPath();c.moveTo(start[0],start[1]);c.bezierCurveTo(c1[0],c1[1],c2[0],c2[1],end[0],end[1]);if(w>=.035){c.strokeStyle=separator;c.lineWidth=w*1.85;c.shadowBlur=0;c.stroke();}c.strokeStyle=col;c.lineWidth=w;if(glow){c.shadowBlur=glow;c.shadowColor=col;}c.stroke();c.restore();};
 const eye=(ex,ey,size=.075,iris=palette.eye)=>{c.save();c.fillStyle='#02070b';c.beginPath();c.ellipse(ex,ey,size*1.3,size,0,0,Math.PI*2);c.fill();c.fillStyle=iris;c.shadowBlur=.16;c.shadowColor=iris;c.beginPath();c.arc(ex+size*.18,ey-size*.08,size*.42,0,Math.PI*2);c.fill();c.restore();};
 const mouth=(x0,y0,rx,ry,teeth=0)=>{c.save();c.fillStyle='#010409';c.strokeStyle='rgba(223,237,229,.42)';c.lineWidth=.03;c.beginPath();c.ellipse(x0,y0,rx,ry,0,0,Math.PI*2);c.fill();c.stroke();if(teeth){c.fillStyle='#eef3e7';for(let i=0;i<teeth;i++){const a=(i/(teeth-1)-.5)*Math.PI*.82,tx=x0+Math.cos(a)*rx*.84,ty=y0+Math.sin(a)*ry*.72;c.beginPath();c.moveTo(tx,ty);c.lineTo(tx-.035,ty+(i%2?.09:-.09));c.lineTo(tx+.035,ty+(i%2?.09:-.09));c.closePath();c.fill();}}c.restore();};
 const fin=(pts,alpha=.92)=>fillPath(pts,bodyGrad(palette.shadow,palette.base,palette.accent),palette.rim,.035);
 const pore=(px,py,sz=.022,col=palette.glow)=>{c.save();c.fillStyle=col;c.shadowBlur=.12;c.shadowColor=col;c.globalCompositeOperation='lighter';c.beginPath();c.arc(px,py,sz,0,Math.PI*2);c.fill();c.restore();};
 const pores=(count=5,y=.12,start=-.48,end=.48)=>{for(let i=0;i<count;i++)pore(start+(end-start)*(i/Math.max(1,count-1)),y+(i%2?.035:-.035),.018+(i%3)*.004);};
 const scars=(count=2)=>{for(let i=0;i<count;i++){const sx=-.5+i*.28;stroke([[sx,-.22],[sx+.09,-.04],[sx+.17,.18]],.021,'rgba(220,238,231,.2)');}};
 const ribs=(count=5,start=-.45,step=.18)=>{for(let i=0;i<count;i++)stroke([[start+i*step,-.28],[start+i*step+.04,.28]],.022,'rgba(222,241,235,.2)');};
 const spike=(x0,y0,len=.35,dir=-1)=>fillPath([[x0-.08,y0],[x0,y0+dir*len],[x0+.09,y0]],bodyGrad(palette.shadow,palette.base,palette.rim),palette.rim,.025);
 const tailFork=(x0,scale=1)=>{fin([[x0,0],[x0-.52*scale,-.46*scale],[x0-.34*scale,-.04],[x0-.55*scale,.42*scale]]);};
 const shadow=()=>{c.save();c.globalAlpha=.14;c.fillStyle=accent;c.beginPath();c.ellipse(-.05,.7,.72,.12,0,0,Math.PI*2);c.fill();c.restore();};
 const materialPass=(density=1)=>{
   c.save();c.globalCompositeOperation='lighter';for(let i=0;i<3+density+(v%3);i++){const px=-.5+i*(1.05/(2+density+v%3)),py=(i%2?.14:-.16)+(v%2)*.03;pore(px,py,.014+(i%2)*.006,i%3===0?palette.accent:palette.glow);}c.restore();
   // Generic scratches were visually incoherent. Surface lines now follow body volume instead.
   c.save();c.globalAlpha=.28;c.strokeStyle=palette.rim;c.lineWidth=.018;c.beginPath();c.ellipse(.05,-.03,.46,.24,-.18,Math.PI*.1,Math.PI*.92);c.stroke();c.restore();
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
   c.save();c.fillStyle=glassGrad();c.beginPath();c.moveTo(bell,.08);c.bezierCurveTo(bell*.9,-height,-bell*.72,-height,-bell,.08);c.quadraticCurveTo(0,.42,bell,.08);c.fill();contour('rgba(198,239,238,.58)',.04);c.restore();
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


 const signatureMassPass=()=>{
  // Signature Abyssal principle: expression and mass come before decorative markings.
  // These profiles deliberately exaggerate anatomy so silhouettes stay distinct at card size.
  const face=(x0,y0,rx,ry,eyeSize=.075,mx=null,my=.1,mrx=.18,mry=.07,teethCount=0,rot=0)=>{
   ellipse(x0,y0,rx,ry,rot,bodyGrad(palette.shadow,palette.base,palette.accent),palette.rim,.052);
   eye(x0+rx*.42,y0-ry*.34,eyeSize,palette.eye);
   if(mx!==false)mouth(mx==null?x0+rx*.72:mx,y0+my,mrx,mry,teethCount);
  };
  const glowCore=(x0,y0,rx,ry,col=palette.glow)=>{
   c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.62;c.fillStyle=col;c.shadowBlur=.22;c.shadowColor=col;c.beginPath();c.ellipse(x0,y0,rx,ry,0,0,Math.PI*2);c.fill();c.restore();
  };
  const crown=(count,centerX,baseY,width,height)=>{
   for(let i=0;i<count;i++){const q=count===1?0:i/(count-1),xx=centerX+(q-.5)*width;spike(xx,baseY,height*(.72+(i%3)*.16),-1);}
  };
  if(family==='shark'){
   const profiles=[
    [.92,-.02,.38,.26,.07,.19,.075,3],[.82,-.01,.46,.34,.075,.25,.09,4],[.7,0,.66,.46,.07,.38,.19,0],[.72,.02,.58,.42,.065,.46,.3,0],[1.02,-.02,.32,.2,.06,.16,.06,4],
    [.84,-.02,.38,.25,.065,.2,.075,3],[.94,.01,.42,.27,.065,.32,.12,6],[.94,0,.31,.22,.075,.21,.085,6],[.72,-.02,.38,.3,.12,.18,.07,3],[.6,0,.62,.44,.055,.26,.08,2]
   ][v];
   face(profiles[0],profiles[1],profiles[2],profiles[3],profiles[4],null,.09,profiles[5],profiles[6],profiles[7]);
   if(v===0){fin([[-.15,-.34],[-.02,-1.02],[.2,-.34]]);fin([[-.18,.28],[-.75,.72],[.3,.32]]);}
   if(v===1){crown(4,-.15,-.37,.7,.26);for(let i=0;i<5;i++)stroke([[-.48+i*.18,-.36],[-.34+i*.18,.34]],.06,palette.accent,.12);}
   if(v===2){glowCore(.18,0,.34,.22,palette.glow);for(let i=0;i<14;i++)pore(-.55+(i%7)*.18,-.28+Math.floor(i/7)*.46,.025,palette.rim);}
   if(v===3){for(let i=0;i<6;i++)stroke([[.3-i*.08,-.35],[.24-i*.08,.34]],.04,palette.rim,.08);}
   if(v===4){fin([[-.18,-.3],[-.02,-1.08],[.19,-.3]]);stroke([[.55,0],[1.68,0]],.045,palette.glow,.16);}
   if(v===5){fillPath([[-.92,-.02],[-1.55,-.4],[-2.25,-1.5],[-1.56,-.12],[-2.05,.5]],bodyGrad(palette.shadow,palette.base,palette.accent),palette.rim,.04);}
   if(v===6){fillPath([[.88,-.12],[1.95,-.04],[1.98,.08],[.88,.12]],bodyGrad(palette.shadow,palette.base,palette.accent),palette.rim,.04);glowCore(.85,.02,.18,.11,palette.accent);}
   if(v===7){crown(6,-.25,-.25,1.15,.24);stroke([[-1.0,0],[-2.05,.15]],.15,palette.base,.04);}
   if(v===8){for(let i=0;i<10;i++)pore(-.45+i*.11,.27,.03,i%2?palette.glow:palette.accent);glowCore(.62,-.13,.12,.1,palette.eye);}
   if(v===9){ribs(6,-.5,.18);fin([[-.08,.31],[-.5,.72],[.48,.35]]);}
  }else if(family==='ray'){
   const rx=[.32,.3,.28,.28,.32,.3,.38,.34,.28,.3][v],ry=[.22,.2,.18,.2,.24,.22,.2,.22,.2,.22][v];
   face(.45,0,rx,ry,.055,false,.08,.16,.06,0);
   if(v<=1){for(const sy of [-1,1])fin([[.18,sy*.12],[-.15,sy*(1.38-v*.12)],[.78,sy*.42]]);for(const sy of [-1,1])stroke([[.72,sy*.08],[1.18,sy*.26]],.045,palette.glow,.12);}
   if(v===2){for(let i=0;i<16;i++)pore(-.52+(i%4)*.28,-.48+Math.floor(i/4)*.31,.025,palette.rim);}
   if(v===3){fillPath([[.62,-.06],[1.5,0],[.62,.08]],bodyGrad(),palette.rim,.04);}
   if(v===4){for(const sy of [-1,1])fin([[.1,sy*.12],[-.45,sy*1.18],[.7,sy*.55]]);}
   if(v===5){crown(7,-.18,-.3,.95,.22);}
   if(v===6){fillPath([[-1.35,0],[-.45,-.27],[.36,-.36],[1.25,0],[.36,.36],[-.45,.27]],bodyGrad(),palette.rim,.05);}
   if(v===7){glowCore(.02,0,.48,.38,palette.accent);for(let i=0;i<8;i++){const a=i*Math.PI/4;pore(Math.cos(a)*.58,Math.sin(a)*.46,.03,palette.glow);}}
   if(v===8){for(let i=0;i<6;i++)stroke([[.28-i*.07,-.28],[.2-i*.07,.28]],.035,palette.accent,.08);}
   if(v===9){glowCore(.15,0,.44,.26,palette.glow);}
  }else if(family==='eel'){
   const headRx=[.42,.44,.38,.5,.26,.55,.62,.46,.36,.58][v],headRy=[.24,.25,.2,.3,.14,.31,.38,.26,.19,.34][v],eyeS=[.055,.06,.075,.085,.035,.05,.065,.055,.05,.065][v];
   face(.72,0,headRx,headRy,eyeS,null,.08,.2+(v===6?.22:0),.08+(v===6?.15:0),v===3?8:(v===6?0:4));
   if(v===0)for(let i=0;i<7;i++)stroke([[-1.2+i*.25,-.22],[-1.12+i*.25,.22]],.05,palette.rim,.08);
   if(v===1)for(let i=0;i<11;i++)pore(-1.2+(i%6)*.3,-.14+Math.floor(i/6)*.25,.025,palette.accent);
   if(v===2){crown(6,-.4,-.24,1.25,.3);stroke([[-1.4,0],[-2.2,.2]],.1,palette.base);}
   if(v===3){crown(5,.16,-.28,.75,.34);glowCore(.7,.02,.16,.12,palette.accent);}
   if(v===4){for(let i=0;i<5;i++)pore(-.45+i*.28,.08,.018,palette.glow);}
   if(v===5){ribs(6,-.8,.28);fin([[-.3,.22],[-.72,.62],[.25,.3]]);}
   if(v===6){glowCore(.88,.08,.34,.26,palette.accent);stroke([[.34,-.02],[1.35,-.02]],.035,palette.rim,.12);}
   if(v===7){fillPath([[.94,-.08],[1.62,0],[.94,.08]],bodyGrad(),palette.rim,.035);crown(5,1.18,-.06,.36,.13);}
   if(v===8){fillPath([[.9,-.06],[1.65,0],[.9,.06]],bodyGrad(),palette.rim,.03);}
   if(v===9){glowCore(.9,.06,.28,.2,palette.glow);for(let i=0;i<5;i++)pore(-.35+i*.25,.14,.022,palette.accent);}
  }else if(family==='squid'){
   const coreX=[.28,.25,.2,.23,.18,.2,.18,.1,.25,.2][v],coreRx=[.34,.32,.42,.36,.4,.34,.34,.28,.46,.5][v],coreRy=[.28,.3,.4,.36,.44,.32,.35,.28,.46,.52][v];
   ellipse(coreX,0,coreRx,coreRy,0,glassGrad(),palette.rim,.055);eye(coreX+coreRx*.38,-coreRy*.22,v===5?.1:.07,palette.eye);
   if(v===0){fin([[.18,-.34],[-.25,-.88],[.58,-.36]]);fin([[.18,.34],[-.25,.88],[.58,.36]]);}
   if(v===1){for(let i=0;i<10;i++)pore(-.22+(i%5)*.18,-.22+Math.floor(i/5)*.44,.026,palette.glow);}
   if(v===2){crown(5,-.05,-.48,.8,.28);scars(2);}
   if(v===3){fin([[.2,-.34],[-.34,-1.05],[.7,-.4]]);fin([[.2,.34],[-.34,1.05],[.7,.4]]);}
   if(v===4){glowCore(.12,0,.24,.34,palette.glow);}
   if(v===5){glowCore(.32,-.12,.12,.1,palette.eye);glowCore(.34,.17,.06,.05,palette.accent);}
   if(v===6){for(const sy of [-1,1])fin([[-.15,sy*.18],[-.88,sy*.95],[.4,sy*.48]]);}
   if(v===7){for(const sy of [-1,1])stroke([[-.35,sy*.12],[-2.45,sy*.78]],.055,palette.accent,.1);}
   if(v===8){crown(6,-.12,-.5,.9,.32);}
   if(v===9){crown(7,-.12,-.52,1.0,.36);for(let i=0;i<6;i++)pore(-.6+i*.2,.28,.026,palette.accent);}
  }else if(family==='octopus'){
   const mr=[.56,.52,.48,.58,.46,.54,.5,.5,.54,.72][v],my=[.54,.48,.46,.58,.7,.66,.54,.6,.5,.66][v];
   ellipse(.2,-.08,mr,my,0,glassGrad(),palette.rim,.06);eye(.4,-.26,v===3?.08:.065,palette.eye);eye(.4,.12,v===8?.04:.055,palette.accent);
   mouth(.47,.03,.15,.08,v===9?5:0);
   if(v===0)for(let i=0;i<6;i++)pore(-.1+i*.13,-.35+(i%2)*.13,.018,palette.glow);
   if(v===1)for(let i=0;i<6;i++)stroke([[-.18+i*.12,-.45],[-.05+i*.1,.45]],.035,palette.accent,.08);
   if(v===2){fillPath([[-.45,.34],[.1,.66],[.72,.34],[.58,.72],[-.3,.72]],bodyGrad(),palette.rim,.04);}
   if(v===3)for(let i=0;i<8;i++){const a=i*Math.PI/4;c.save();c.strokeStyle=i%2?palette.glow:palette.accent;c.lineWidth=.04;c.shadowBlur=.12;c.shadowColor=c.strokeStyle;c.beginPath();c.arc(.18+Math.cos(a)*.3,-.05+Math.sin(a)*.28,.07,0,Math.PI*2);c.stroke();c.restore();}
   if(v===4)for(const sy of [-1,1])fin([[.05,sy*.28],[-.55,sy*1.22],[.55,sy*.58]]);
   if(v===5){glowCore(.15,-.08,.3,.4,palette.glow);ribs(5,-.18,.1);}
   if(v===6||v===7)for(const sy of [-1,1])fin([[.25,sy*.35],[-.18,sy*1.05],[.62,sy*.58]]);
   if(v===8)stroke([[-.1,-.05],[-1.85,-.58]],.08,palette.accent,.12);
   if(v===9){crown(5,-.12,-.58,.85,.25);scars(3);}
  }else if(family==='jelly'){
   glowCore(0,-.12,.38+.035*v,.28+.025*(v%4),v%2?palette.accent:palette.glow);
   if(v===0)for(const p of [[-.18,-.16],[.18,-.16],[-.18,.1],[.18,.1]])glowCore(p[0],p[1],.1,.07,palette.rim);
   if(v===1)for(let i=0;i<8;i++){const a=i*Math.PI/4;stroke([[0,-.08],[Math.cos(a)*.58,Math.sin(a)*.42]],.04,palette.accent,.08);}
   if(v===2)glowCore(.02,-.14,.2,.18,'#fff06d');
   if(v===3)crown(12,0,-.34,1.25,.25);
   if(v===4){c.save();c.globalAlpha=.28;c.strokeStyle=palette.rim;c.lineWidth=.035;c.beginPath();c.ellipse(0,-.08,.65,.5,0,0,Math.PI*2);c.stroke();c.restore();}
   if(v===5){c.save();c.strokeStyle=palette.accent;c.lineWidth=.06;c.beginPath();c.ellipse(0,-.08,.48,.34,0,0,Math.PI*2);c.stroke();c.restore();}
   if(v===6)fillPath([[-.45,.05],[0,-.82],[.45,.05]],glassGrad(),palette.rim,.05);
   if(v===7)glowCore(0,-.08,.6,.62,palette.glow);
   if(v===8)for(let i=0;i<8;i++){const a=i*Math.PI/4;stroke([[0,.02],[Math.cos(a)*.78,Math.sin(a)*.55]],.05,palette.glow,.12);}
   if(v===9){c.save();c.strokeStyle=palette.rim;c.lineWidth=.06;c.beginPath();c.ellipse(0,-.12,.55,.66,0,Math.PI,Math.PI*2);c.stroke();c.restore();}
  }else if(family==='crustacean'){
   const rr=[.72,.75,.65,.7,.66,.62,.64,.86,.64,.68][v],ry=[.4,.42,.34,.36,.4,.46,.4,.52,.36,.4][v];
   ellipse(.02,0,rr,ry,0,bodyGrad(),palette.rim,.055);eye(.48,-.22,.06,palette.eye);eye(.48,.18,.05,palette.accent);
   if(v===0)crown(7,-.1,-.38,1.0,.22);
   if(v===1){for(const sy of [-1,1])fillPath([[.55,sy*.18],[1.22,sy*.6],[.95,sy*.02]],bodyGrad(),palette.rim,.05);}
   if(v===2)for(const sy of [-1,1])stroke([[.55,sy*.12],[1.85,sy*.68]],.035,palette.glow,.1);
   if(v===3)fillPath([[.55,.12],[1.38,.72],[1.02,.02]],bodyGrad(),palette.rim,.06);
   if(v===4)for(const sy of [-1,1])fillPath([[.5,sy*.15],[1.35,sy*.55],[.9,sy*.02]],bodyGrad(palette.shadow,palette.accent,palette.rim),palette.rim,.055);
   if(v===5)for(let i=0;i<5;i++){const xx=.35-i*.2;for(const sy of [-1,1])stroke([[xx,sy*.22],[xx-.42,sy*1.35]],.055,palette.accent,.06);}
   if(v===6)for(let i=0;i<8;i++)stroke([[-.45+i*.13,-.35],[-.5+i*.13,-.7]],.025,palette.rim,.05);
   if(v===7){ribs(8,-.62,.17);for(const sy of [-1,1])for(let i=0;i<4;i++)stroke([[-.35+i*.2,sy*.3],[-.5+i*.2,sy*.82]],.045,palette.accent);}
   if(v===8)crown(5,-.15,-.32,.7,.2);
   if(v===9)for(let i=0;i<7;i++)pore(-.5+i*.17,.23,.024,palette.glow);
  }else if(family==='fish'){
   const frx=[.48,.6,.5,.44,.42,.5,.52,.62,.58,.44][v],fry=[.32,.62,.4,.34,.5,.3,.34,.4,.4,.28][v],fx=[.45,.2,.38,.42,.25,.55,.62,.55,.38,.42][v];
   face(fx,0,frx,fry,v===1?.08:.065,null,.08,.2+(v===6||v===7?.12:0),.08+(v===6||v===7?.08:0),v===6?8:(v===7?10:3));
   if(v===0)crown(11,-.15,-.38,1.2,.38);
   if(v===1){for(const sy of [-1,1])fin([[-.18,sy*.3],[-.75,sy*.92],[.38,sy*.56]]);}
   if(v===2){c.save();c.strokeStyle=palette.accent;c.lineWidth=.07;c.beginPath();c.arc(.42,-.18,.3,Math.PI,Math.PI*2);c.stroke();c.restore();}
   if(v===3)for(let i=0;i<6;i++){const a=i*.7;glowCore(-.2+i*.16,Math.sin(a)*.2,.06,.045,i%2?palette.glow:palette.accent);}
   if(v===4){fillPath([[-.62,0],[-.3,-.78],[.62,-.5],[.86,0],[.52,.72],[-.28,.84]],bodyGrad(),palette.rim,.055);}
   if(v===5){for(let i=0;i<8;i++)pore(-.55+i*.17,.18,.024,palette.glow);crown(4,.05,-.27,.65,.18);}
   if(v===6)crown(5,.2,-.3,.62,.24);
   if(v===7){crown(4,.15,-.34,.55,.2);glowCore(.62,.03,.14,.1,palette.accent);}
   if(v===8){c.save();c.globalAlpha=.4;c.strokeStyle=palette.rim;c.lineWidth=.035;c.beginPath();c.ellipse(.05,0,.82,.48,0,0,Math.PI*2);c.stroke();c.restore();}
   if(v===9){for(const xx of [-.25,.12,.45])stroke([[xx,.16],[xx-.18+(xx>.2?.35:0),1.42]],.05,palette.glow,.08);}
  }else if(family==='benthic'){
   glowCore(0,0,.28+.04*(v%4),.24+.03*((v+1)%3),v%2?palette.glow:palette.accent);
   if(v<=2){for(let i=0;i<6;i++)stroke([[-.55+i*.2,.25],[-.6+i*.2,.72]],.045,palette.rim,.06);if(v===0)for(let i=0;i<10;i++)pore(-.5+(i%5)*.25,-.18+Math.floor(i/5)*.34,.025,palette.accent);}
   if(v===3||v===4){for(let i=0;i<(v===3?10:5);i++){const a=i*Math.PI*2/(v===3?10:5);stroke([[0,0],[Math.cos(a)*1.28,Math.sin(a)*1.02]],.055,palette.accent,.08);}}
   if(v===5)crown(12,0,-.34,1.15,.28);
   if(v===6||v===7){for(let i=0;i<(v===6?18:10);i++){const a=i*Math.PI*2/(v===6?18:10);stroke([[Math.cos(a)*.3,Math.sin(a)*.25],[Math.cos(a)*(v===6?1.35:1.05),Math.sin(a)*(v===6?1.0:.78)]],v===6?.03:.07,palette.rim,.08);}}
   if(v===8)for(let i=0;i<12;i++){const a=i*Math.PI/6;stroke([[0,0],[Math.cos(a)*1.15,Math.sin(a)*.95]],.04,palette.glow,.08);}
   if(v===9)for(let i=0;i<6;i++)stroke([[-.7,-.45+i*.18],[.45,-.68+i*.18]],.045,palette.rim,.06);
  }else if(family==='mollusc'){
   const coreRx=[.56,.52,.48,.5,.38,.44,.4,.42,.58,.7][v],coreRy=[.52,.48,.36,.4,.28,.34,.32,.3,.42,.46][v];
   ellipse(.08,0,coreRx,coreRy,0,glassGrad(),palette.rim,.055);eye(.38,-.16,.055,palette.eye);
   if(v<=1){c.save();c.strokeStyle=palette.accent;c.lineWidth=.045;c.beginPath();for(let i=0;i<60;i++){const a=i*.2,rr=.03+i*.008;c.lineTo(.08+Math.cos(a)*rr,Math.sin(a)*rr);}c.stroke();c.restore();}
   if(v===2){ribs(7,-.4,.14);for(const sy of [-1,1])fin([[.15,sy*.22],[-.15,sy*.72],[.58,sy*.3]]);}
   if(v===3){for(let i=0;i<7;i++)pore(-.36+i*.13,i%2?.18:-.18,.026,i%2?palette.glow:palette.accent);}
   if(v===4){stroke([[.34,-.15],[.48,-.68]],.055,palette.rim,.06);stroke([[.54,-.15],[.68,-.68]],.055,palette.rim,.06);}
   if(v===5)for(const sy of [-1,1])for(let i=0;i<3;i++)stroke([[-.05-i*.18,sy*.12],[-.5-i*.2,sy*(.55+i*.12)]],.05,palette.glow,.08);
   if(v===6||v===7)for(const sy of [-1,1])fin([[.08,sy*.12],[-.45,sy*.65],[.55,sy*.35]]);
   if(v===8){ribs(8,-.52,.15);for(let i=0;i<6;i++)pore(-.4+i*.16,.24,.022,palette.accent);}
   if(v===9){ribs(8,-.55,.16);for(const sy of [-1,1])for(let i=0;i<4;i++)stroke([[-.5+i*.22,sy*.3],[-.62+i*.22,sy*.62]],.035,palette.rim,.05);}
  }
 };

 const rarityPass=()=>{
  const rank={common:0,uncommon:1,rare:2,epic:3,legendary:4,mythic:5}[String(s.rarity||'common')]||0;
  if(rank<3)return;
  const paid=Boolean(s.paid),strength=(rank-2)+(paid?1:0);
  c.save();c.globalCompositeOperation='lighter';
  c.globalAlpha=.18+strength*.07;c.strokeStyle=palette.glow;c.lineWidth=.025+.007*strength;c.shadowBlur=.12+.04*strength;c.shadowColor=palette.glow;
  c.beginPath();c.ellipse(-.03,0,.92+strength*.08,.62+strength*.055,t*.00018,0,Math.PI*2);c.stroke();
  const nodes=2+strength*2;for(let i=0;i<nodes;i++){const a=t*.00045+i*Math.PI*2/nodes,rr=.88+strength*.08;c.fillStyle=i%2?palette.accent:palette.rim;c.beginPath();c.arc(Math.cos(a)*rr,Math.sin(a)*rr*.68,.018+.005*strength,0,Math.PI*2);c.fill();}
  if(paid){c.globalAlpha=.3;c.strokeStyle=palette.rim;c.lineWidth=.018;c.beginPath();c.ellipse(.12,-.05,.34+.04*strength,.22+.03*strength,-.28,0,Math.PI*2);c.stroke();}
  c.restore();
 };
 const signatureArt=()=>{
  const k=String(art.key||'');
  const line=(pts,w=.025,a=.72)=>stroke(pts,w,a>.8?palette.rim:palette.accent,.12);
  const dot=(x0,y0,sz=.022,a=.82)=>pore(x0,y0,sz,a>.88?palette.rim:palette.glow);
  const arc=(x0,y0,rx,ry,start,end,w=.028,a=.7)=>{c.save();c.globalAlpha=Math.max(.45,a);c.strokeStyle=a>.82?palette.rim:palette.accent;c.lineWidth=w;c.shadowBlur=.14;c.shadowColor=palette.glow;c.beginPath();c.ellipse(x0,y0,rx,ry,0,start,end);c.stroke();c.restore();};
  switch(k){
   // Sharks
   case 'blue-sickle': line([[-.7,-.08],[.05,-.2],[.72,-.08]],.035);break;
   case 'tiger-bars': for(let i=0;i<6;i++)line([[-.55+i*.2,-.34],[-.45+i*.2,.34]],.045,.6);break;
   case 'whale-checker': for(let i=0;i<18;i++)dot(-.62+(i%6)*.22,-.28+Math.floor(i/6)*.28,.018,.72);break;
   case 'basking-gape': arc(.98,.02,.38,.28,0,Math.PI*2,.05,.85);break;
   case 'mako-spear': line([[.42,-.04],[1.32,0]],.055,.9);break;
   case 'thresher-whip': for(let i=0;i<5;i++)dot(-1.0-i*.18,-.12-i*.15,.018,.7);break;
   case 'goblin-rostrum': line([[.62,-.04],[1.7,-.02]],.04,.85);break;
   case 'frilled-serpent': for(let i=0;i<6;i++)arc(.35-i*.12,0,.08,.22,-1.1,1.1,.025,.65);break;
   case 'lantern-photophore': for(let i=0;i<9;i++)dot(-.5+i*.12,.24,.024,.95);break;
   case 'greenland-heavy': scars(3);arc(-.05,.04,.72,.3,.15,2.85,.03,.38);break;
   // Rays
   case 'manta-cephalic': arc(.86,-.08,.28,.18,-1.4,.5,.04,.86);arc(.86,.08,.28,.18,-.5,1.4,.04,.86);break;
   case 'reef-manta': for(let i=0;i<5;i++)dot(-.4+i*.18,.12,.022,.7);break;
   case 'spotted-eagle': for(let i=0;i<15;i++)dot(-.55+(i%5)*.26,-.34+Math.floor(i/5)*.34,.018,.76);break;
   case 'eagle-snout': line([[.55,0],[1.25,0]],.045,.86);break;
   case 'butterfly-disc': arc(.02,0,.9,.64,Math.PI*.15,Math.PI*.85,.04,.64);break;
   case 'thornback-spines': for(let i=0;i<7;i++)spike(-.58+i*.18,-.3,.18+(i%2)*.05,-1);break;
   case 'guitarfish-hybrid': line([[-.92,0],[.85,0]],.03,.56);break;
   case 'round-disc': for(let i=0;i<8;i++){const a=i*Math.PI/4;dot(Math.cos(a)*.48,Math.sin(a)*.36,.02,.66);}break;
   case 'sixgill-deep': for(let i=0;i<6;i++)line([[.4-i*.08,-.26],[.35-i*.08,.26]],.024,.62);break;
   case 'arctic-pale': arc(0,0,.72,.48,0,Math.PI*2,.025,.42);break;
   // Eels
   case 'zebra-bars': for(let i=0;i<8;i++)line([[-1.25+i*.24,-.2],[-1.18+i*.24,.2]],.04,.7);break;
   case 'leopard-spots': for(let i=0;i<10;i++)dot(-1.05+(i%5)*.32,-.12+Math.floor(i/5)*.25,.025,.7);break;
   case 'ribbon-crests': for(let i=0;i<5;i++)spike(-.7+i*.24,-.22,.2+(i%2)*.12,-1);break;
   case 'dragon-jaw': arc(.82,.03,.36,.18,-.3,.8,.055,.92);break;
   case 'garden-thread': for(let i=0;i<4;i++)dot(-.45+i*.27,.07,.016,.72);break;
   case 'conger-heavy': ribs(5,-.8,.28);break;
   case 'pelican-gape': arc(.92,.05,.48,.33,0,Math.PI*2,.05,.95);break;
   case 'saw-rostrum': for(let i=0;i<6;i++)spike(.98+i*.09,-.04,.1,-1);break;
   case 'snipe-snout': line([[.78,0],[1.5,0]],.04,.9);break;
   case 'gulper-mouth': arc(.98,.06,.34,.23,0,Math.PI*2,.05,.88);break;
   // Squid
   case 'reef-arrow': line([[-.25,0],[1.1,0]],.028,.62);break;
   case 'luminous-stars': for(let i=0;i<9;i++)dot(-.32+(i%3)*.3,-.25+Math.floor(i/3)*.25,.025,.95);break;
   case 'humboldt-heavy': scars(2);for(let i=0;i<5;i++)dot(-.38+i*.18,.23,.02,.75);break;
   case 'diamond-fin': line([[.05,-.58],[.45,0],[.05,.58]],.04,.72);break;
   case 'cockatoo-glass': arc(.12,0,.65,.48,0,Math.PI*2,.025,.55);break;
   case 'strawberry-eyes': dot(.42,-.18,.07,.98);dot(.42,.16,.035,.8);break;
   case 'vampire-cloak': arc(-.15,0,.74,.66,-1.15,1.15,.06,.82);break;
   case 'longarm-spider': for(let side of [-1,1])line([[-.25,side*.15],[-1.45,side*.62],[-2.15,side*.78]],.026,.72);break;
   case 'giant-lance': line([[-.45,0],[1.35,0]],.035,.8);break;
   case 'colossal-hooks': for(let i=0;i<5;i++)arc(-1.0-i*.12,.18+i*.04,.07,.06,-1.2,.8,.025,.85);break;
   // Octopus
   case 'common-bulb': for(let i=0;i<5;i++)dot(-.22+i*.13,-.3+(i%2)*.15,.018,.58);break;
   case 'mimic-stripes': for(let i=0;i<6;i++)arc(.08,0,.22+i*.08,.18+i*.055,-.8,.8,.022,.66);break;
   case 'coconut-shell': arc(.2,.18,.5,.32,.05,Math.PI-.05,.05,.7);break;
   case 'blue-rings': for(let i=0;i<8;i++){const a=i*Math.PI/4;arc(.25+Math.cos(a)*.28,Math.sin(a)*.24,.055,.045,0,Math.PI*2,.025,.98);}break;
   case 'blanket-web': arc(-.1,0,.86,.68,-1.2,1.2,.055,.78);break;
   case 'glass-core': arc(.28,0,.38,.5,0,Math.PI*2,.025,.55);dot(.2,-.05,.065,.82);break;
   case 'dumbo-ears': arc(.18,-.44,.32,.28,-1.5,.3,.045,.74);arc(.18,.44,.32,.28,-.3,1.5,.045,.74);break;
   case 'grimpoteuthis-bell': for(let i=0;i<5;i++)line([[-.25+i*.12,-.55],[-.18+i*.11,.55]],.02,.5);break;
   case 'sevenarm-asymmetry': line([[-.3,-.08],[-1.75,-.58]],.07,.82);break;
   case 'pacific-giant': scars(3);for(let i=0;i<6;i++)dot(-.25+i*.12,.28,.022,.64);break;
   // Jellyfish
   case 'moon-fourcore': for(const p of [[-.2,-.18],[.2,-.18],[-.2,.12],[.2,.12]])arc(p[0],p[1],.14,.1,0,Math.PI*2,.03,.72);break;
   case 'compass-radial': for(let i=0;i<8;i++){const a=i*Math.PI/4;line([[0,0],[Math.cos(a)*.65,Math.sin(a)*.5]],.03,.7);}break;
   case 'friedegg-yolk': dot(.05,-.12,.16,.9);break;
   case 'lionmane-crown': for(let i=0;i<10;i++){const a=i*Math.PI/5;spike(Math.cos(a)*.54,Math.sin(a)*.34,.22,i<5?-1:1);}break;
   case 'crystal-glass': arc(0,0,.62,.5,0,Math.PI*2,.025,.46);break;
   case 'atolla-redring': arc(0,-.05,.48,.34,0,Math.PI*2,.055,.88);break;
   case 'periphylla-cone': line([[-.42,.02],[0,-.72],[.42,.02]],.04,.78);break;
   case 'phantom-giant': arc(0,0,.72,.72,0,Math.PI*2,.035,.38);break;
   case 'fireworks-branches': for(let i=0;i<8;i++){const a=i*Math.PI/4;line([[0,.05],[Math.cos(a)*.74,Math.sin(a)*.5]],.035,.82);}break;
   case 'hood-cap': arc(0,-.08,.55,.62,Math.PI,Math.PI*2,.055,.82);break;
   // Crustaceans
   case 'spiny-lobster': for(let i=0;i<6;i++)spike(-.5+i*.18,-.34,.18,-1);break;
   case 'american-claws': arc(.78,-.28,.32,.2,-1.2,.8,.07,.78);arc(.78,.28,.32,.2,-.8,1.2,.07,.78);break;
   case 'cleaner-antennae': for(let side of [-1,1])line([[.55,side*.12],[1.7,side*.62]],.022,.8);break;
   case 'pistol-claw': arc(.9,.24,.4,.28,-1,.7,.1,.88);break;
   case 'mantis-hammer': line([[.62,-.16],[1.25,-.5]],.09,.9);line([[.62,.16],[1.25,.5]],.09,.9);break;
   case 'spider-legs': for(let i=0;i<4;i++)line([[-.1+i*.22,.1],[-.55+i*.15,1.0]],.03,.64);break;
   case 'yeti-fur': for(let i=0;i<8;i++)line([[-.55+i*.15,-.35],[-.62+i*.15,-.65]],.018,.5);break;
   case 'isopod-plates': ribs(8,-.7,.19);break;
   case 'hadal-amphipod': for(let i=0;i<5;i++)spike(-.45+i*.19,-.3,.18,-1);break;
   case 'vent-shrimp': for(let i=0;i<6;i++)dot(-.45+i*.17,.2,.022,.76);break;
   // Fish
   case 'lion-spines': for(let i=0;i<10;i++)spike(-.5+i*.12,-.32,.32+(i%3)*.1,-1);break;
   case 'sun-disc': arc(0,0,.62,.62,0,Math.PI*2,.045,.65);break;
   case 'napoleon-brow': arc(.58,-.22,.32,.22,Math.PI,Math.PI*2,.055,.78);break;
   case 'mandarin-pattern': for(let i=0;i<5;i++)arc(-.35+i*.2,0,.18,.22,0,Math.PI*2,.025,.68);break;
   case 'hatchet-blade': line([[-.45,-.55],[.45,.48]],.04,.75);break;
   case 'dragon-black': for(let i=0;i<7;i++)dot(-.65+i*.2,.15,.018,.88);break;
   case 'viper-fangs': for(let i=0;i<5;i++)line([[.55+i*.07,-.1],[.58+i*.07,.16]],.03,.86);break;
   case 'fangtooth-head': for(let i=0;i<7;i++)line([[.5+i*.055,-.14],[.54+i*.055,.18]],.035,.9);break;
   case 'snailfish-soft': arc(.05,0,.68,.42,0,Math.PI*2,.025,.46);break;
   case 'tripod-stilts': line([[.1,.18],[-.08,1.38]],.04,.8);line([[.45,.18],[.72,1.38]],.04,.8);line([[-.25,.12],[-.55,1.28]],.04,.8);break;
   // Benthic
   case 'leopard-cucumber': for(let i=0;i<10;i++)dot(-.7+(i%5)*.32,-.18+Math.floor(i/5)*.34,.024,.7);break;
   case 'sea-pig-legs': for(let i=0;i<6;i++)line([[-.55+i*.2,.28],[-.6+i*.2,.7]],.05,.72);break;
   case 'swimming-holothurian': arc(0,0,.82,.4,0,Math.PI*2,.03,.54);break;
   case 'basket-arms': for(let i=0;i<10;i++){const a=i*Math.PI/5;line([[0,0],[Math.cos(a)*1.05,Math.sin(a)*.88]],.03,.68);}break;
   case 'brittle-star': for(let i=0;i<5;i++){const a=i*Math.PI*2/5;line([[0,0],[Math.cos(a)*1.15,Math.sin(a)*.95]],.055,.76);}break;
   case 'crown-star': for(let i=0;i<12;i++){const a=i*Math.PI/6;spike(Math.cos(a)*.52,Math.sin(a)*.42,.28,i<6?-1:1);}break;
   case 'diadema-spines': for(let i=0;i<18;i++){const a=i*Math.PI/9;line([[Math.cos(a)*.45,Math.sin(a)*.35],[Math.cos(a)*1.25,Math.sin(a)*.95]],.025,.66);}break;
   case 'pencil-urchin': for(let i=0;i<10;i++){const a=i*Math.PI/5;line([[Math.cos(a)*.4,Math.sin(a)*.32],[Math.cos(a)*1.02,Math.sin(a)*.78]],.07,.72);}break;
   case 'crinoid-feather': for(let i=0;i<9;i++){const a=-1.2+i*.3;line([[0,.05],[Math.cos(a)*1.0,Math.sin(a)*.95]],.035,.7);}break;
   case 'harp-sponge': for(let i=0;i<6;i++)line([[-.65,-.45+i*.18],[.3,-.65+i*.18]],.03,.72);break;
   // Molluscs
   case 'nautilus-spiral': {c.save();c.strokeStyle=tone(.78,20);c.lineWidth=.035;c.beginPath();for(let i=0;i<55;i++){const a=i*.2,rr=.03+i*.009;c.lineTo(.05+Math.cos(a)*rr,Math.sin(a)*rr);}c.stroke();c.restore();}break;
   case 'argonaut-shell': arc(.05,0,.58,.52,.2,Math.PI*1.8,.045,.72);break;
   case 'cuttle-ribbed': ribs(7,-.48,.16);break;
   case 'flamboyant-warning': for(let i=0;i<7;i++)dot(-.45+i*.15,i%2?.2:-.2,.028,.9);break;
   case 'sea-bunny-ears': line([[.35,-.2],[.48,-.68]],.05,.76);line([[.55,-.2],[.68,-.68]],.05,.76);break;
   case 'blue-dragon-wings': for(let side of [-1,1])for(let i=0;i<3;i++)line([[-.05-i*.18,side*.12],[-.45-i*.2,side*(.52+i*.12)]],.045,.78);break;
   case 'sea-angel-wings': arc(.15,-.22,.42,.28,-1.4,.5,.04,.72);arc(.15,.22,.42,.28,-.5,1.4,.04,.72);break;
   case 'sea-butterfly-wings': arc(.1,-.18,.52,.3,-1.5,.4,.035,.72);arc(.1,.18,.52,.3,-.4,1.5,.035,.72);break;
   case 'scalyfoot-armor': ribs(8,-.6,.17);for(let i=0;i<6;i++)dot(-.45+i*.16,.25,.022,.56);break;
   case 'giant-chiton-plates': ribs(8,-.58,.16);arc(0,0,.75,.42,0,Math.PI*2,.025,.48);break;
  }
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
 signatureMassPass();
 signatureArt();
 rarityPass();
 c.restore();
};
})();