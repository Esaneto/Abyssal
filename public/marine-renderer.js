(function(){
 'use strict';

 // Canonical marine renderer.
 // IMPORTANT: species identity must come from anatomy first, not color.
 // If silhouettes collapse into a shared family template, that is a regression.
 window.drawMarineSpecies=function(c,s,x,y,r,angle,t){
  c.save();c.translate(x,y);c.rotate(angle||0);c.scale(r,r);c.shadowBlur=0;
  c.lineWidth=.055;c.strokeStyle='rgba(174,210,211,.62)';

  const v=Number(s.variant)||0,phase=t*.002+v;
  const bodyPaint=c.createLinearGradient(-1.4,-.75,1.4,.75);
  bodyPaint.addColorStop(0,'#02080e');
  bodyPaint.addColorStop(.28,'#0a1c25');
  bodyPaint.addColorStop(.55,s.color);
  bodyPaint.addColorStop(.78,'#10242c');
  bodyPaint.addColorStop(1,'#02070c');
  c.fillStyle=bodyPaint;
  const resolveFill=fill=>!fill||fill===s.color?bodyPaint:fill;
  const ellipse=(x,y,rx,ry,rot=0)=>{c.save();c.fillStyle=bodyPaint;c.beginPath();c.ellipse(x,y,rx,ry,rot,0,Math.PI*2);c.fill();c.stroke();c.restore();};
  const line=(points,width=null,color=null)=>{c.save();if(width!=null)c.lineWidth=width;if(color)c.strokeStyle=color;c.beginPath();points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.stroke();c.restore();};
  const polygon=(points,fill=null,stroke=null)=>{c.save();c.fillStyle=resolveFill(fill);if(stroke)c.strokeStyle=stroke;c.beginPath();points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.fill();c.stroke();c.restore();};
  const fill=(draw,paint=null,stroke=null,width=.055)=>{c.save();c.fillStyle=resolveFill(paint);if(stroke)c.strokeStyle=stroke;c.lineWidth=width;c.beginPath();draw();c.fill();if(stroke)c.stroke();c.restore();};
  const eye=(ex,ey,scale=.075)=>{c.save();c.fillStyle='#07121a';c.beginPath();c.ellipse(ex,ey,scale,scale*.9,0,0,Math.PI*2);c.fill();c.restore();};
  const gills=(x0,y0,count=4,spacing=.095,height=.22)=>{for(let i=0;i<count;i++)line([[x0-i*spacing,y0-height/2],[x0-i*spacing,y0+height/2]],.035,'rgba(224,242,240,.56)');};

  const drawShark=()=>{
   // 0 blue, 1 tiger, 2 whale, 3 basking, 4 mako,
   // 5 thresher, 6 goblin, 7 frilled, 8 lantern, 9 Greenland.
   if(v===2){
    // Whale shark: broad blunt head, huge filtering mouth, spotted heavy body.
    polygon([[-1.15,0],[-1.72,-.43],[-1.55,0],[-1.72,.43]],s.color);
    polygon([[-.2,-.34],[-.1,-.86],[.18,-.34]],s.color);
    polygon([[-.05,.26],[-.45,.72],[.42,.32]],s.color);
    ellipse(.05,0,1.22,.53);
    polygon([[.78,-.36],[1.28,-.3],[1.5,-.18],[1.5,.18],[1.28,.3],[.78,.36]],s.color);
    line([[1.43,-.14],[1.43,.14]],.09,'#d7ddd2');gills(.67,0,5,.09,.34);eye(.93,-.23,.06);
    c.save();c.fillStyle='rgba(226,231,201,.62)';for(let i=0;i<18;i++){const px=-.65+(i%6)*.27,py=-.3+Math.floor(i/6)*.3;c.beginPath();c.arc(px,py,.025+(i%3)*.006,0,Math.PI*2);c.fill();}c.restore();
    return;
   }
   if(v===3){
    // Basking shark: cavernous open mouth and very large gill slits.
    polygon([[-1.15,0],[-1.65,-.4],[-1.5,0],[-1.65,.4]],s.color);
    polygon([[-.18,-.3],[-.02,-.88],[.25,-.31]],s.color);
    ellipse(.0,0,1.18,.42);
    c.save();c.fillStyle='#061018';c.strokeStyle='#d5ded8';c.lineWidth=.055;c.beginPath();c.ellipse(1.03,0,.46,.34,0,0,Math.PI*2);c.fill();c.stroke();c.restore();
    gills(.53,0,6,.085,.48);eye(.7,-.24,.055);
    return;
   }
   if(v===4){
    // Shortfin mako: torpedo body, pointed snout, crescent tail.
    polygon([[-1.25,0],[-1.82,-.62],[-1.58,-.06],[-1.88,.54]],s.color);
    polygon([[-.18,-.28],[-.05,-.82],[.18,-.28]],s.color);
    polygon([[.05,.2],[-.32,.62],[.55,.27]],s.color);
    ellipse(.02,0,1.16,.34);
    polygon([[.74,-.23],[1.55,0],[.74,.23]],s.color);gills(.5,0,4,.085,.28);eye(.82,-.17,.052);
    return;
   }
   if(v===5){
    // Thresher: upper caudal lobe dominates total silhouette.
    ellipse(.12,0,1.05,.35);
    polygon([[.78,-.18],[1.42,0],[.78,.18]],s.color);
    polygon([[-.85,0],[-1.75,-1.28],[-1.35,-.12],[-1.62,.32]],s.color);
    polygon([[-.15,-.3],[0,-.8],[.22,-.31]],s.color);gills(.48,0,4,.09,.27);eye(.78,-.16,.055);
    return;
   }
   if(v===6){
    // Goblin: flattened blade-like rostrum and protrusible jaw.
    ellipse(-.02,0,1.02,.38);
    polygon([[-.92,0],[-1.48,-.38],[-1.32,0],[-1.48,.38]],s.color);
    polygon([[-.12,-.3],[.02,-.72],[.2,-.29]],s.color);
    polygon([[.64,-.18],[1.22,-.14],[1.78,-.05],[1.78,.05],[1.22,.14],[.64,.18]],s.color);
    c.save();c.fillStyle='#1b0a0c';c.beginPath();c.ellipse(1.02,.1,.32,.16,0,0,Math.PI*2);c.fill();c.restore();
    gills(.43,0,5,.075,.3);eye(.61,-.18,.048);return;
   }
   if(v===7){
    // Frilled shark: eel-like body with tiny fins and frilled gills.
    c.save();c.strokeStyle=s.color;c.lineWidth=.42;c.lineCap='round';c.beginPath();c.moveTo(1.2,0);c.bezierCurveTo(.45,-.16,-.4,.18,-1.75,Math.sin(phase)*.18);c.stroke();c.restore();
    ellipse(.95,0,.5,.24);polygon([[-1.65,0],[-1.95,-.25],[-1.88,.25]],s.color);
    for(let i=0;i<6;i++)line([[.53-i*.09,-.2],[.47-i*.09,.2]],.028,'rgba(226,239,230,.62)');
    eye(1.2,-.11,.045);return;
   }
   if(v===8){
    // Lantern shark: compact deep-sea profile, oversized eye, ventral photophores.
    ellipse(.05,0,.9,.34);polygon([[-.78,0],[-1.3,-.38],[-1.14,0],[-1.3,.38]],s.color);
    polygon([[-.15,-.28],[.02,-.68],[.22,-.27]],s.color);gills(.42,0,5,.065,.24);eye(.69,-.18,.09);
    c.save();c.fillStyle='rgba(135,255,230,.82)';for(let i=0;i<9;i++){c.beginPath();c.arc(-.45+i*.13,.25,.025,0,Math.PI*2);c.fill();}c.restore();return;
   }
   if(v===9){
    // Greenland shark: very thick, slow, blunt body and small fins.
    ellipse(-.03,0,1.2,.5);polygon([[-1.05,0],[-1.55,-.38],[-1.42,0],[-1.55,.38]],s.color);
    polygon([[-.25,-.38],[-.05,-.65],[.18,-.36]],s.color);polygon([[.2,.28],[-.18,.58],[.62,.34]],s.color);
    polygon([[.8,-.28],[1.35,-.12],[1.42,.12],[.8,.28]],s.color);gills(.45,0,5,.08,.34);eye(.82,-.2,.042);return;
   }
   // Blue and tiger sharks keep related family anatomy but not identical proportions.
   const tiger=v===1,length=tiger?1.08:1.2,width=tiger?.46:.34;
   polygon([[-length*.82,0],[-length- .55,-.5],[-length-.35,0],[-length-.55,.5]],s.color);
   polygon([[-.22,-width*.72],[-.08,-.9],[.22,-width*.72]],s.color);
   polygon([[.02,width*.45],[-.42,.72],[.58,width*.58]],s.color);
   ellipse(.05,0,length,width);polygon([[.76,-.2],[1.42,0],[.76,.2]],s.color);gills(.48,0,5,.08,.28);eye(.82,-.17,.055);
   if(tiger){for(let i=0;i<6;i++)line([[-.55+i*.2,-.34],[-.42+i*.2,.34]],.05,'rgba(52,73,72,.72)');}
  };

  const drawRay=()=>{
   // Distinguish manta-like, eagle-like, guitar-like and round rays by outline.
   if(v===6){ // guitarfish
    ellipse(.25,0,.9,.28);polygon([[-.55,0],[-1.75,-.24],[-1.95,0],[-1.75,.24]],s.color);polygon([[.65,-.18],[1.4,0],[.65,.18]],s.color);eye(.75,-.12,.05);return;
   }
   if(v===7){ // round ray
    ellipse(.05,0,1,.78);line([[-.7,0],[-1.5,.05],[-2,.14]],.07,s.color);eye(.38,-.2,.045);return;
   }
   const manta=v<=1;
   line([[-.25,0],[-1.55,Math.sin(phase)*.12],[-2.35,.14]],.075,s.color);
   if(manta)polygon([[1.15,0],[.05,-1.25],[-.85,-.45],[-.58,0],[-.85,.45],[.05,1.25]],s.color);
   else polygon([[1.05,0],[.1,-.92],[-.75,-.42],[-.58,0],[-.75,.42],[.1,.92]],s.color);
   ellipse(.12,0,.62,.26);if(v===2||v===3)polygon([[.55,-.16],[1.32,0],[.55,.16]],s.color);eye(.45,-.16,.045);
  };

  const drawEel=()=>{
   const pelican=v===6,wideMouth=v===9,garden=v===4;
   c.save();c.strokeStyle=s.color;c.lineWidth=garden?.16:.28;c.lineCap='round';c.beginPath();c.moveTo(.95,0);c.bezierCurveTo(.1,-.62,-.95,.62,-2,Math.sin(phase)*.25);c.stroke();c.restore();
   ellipse(.72,0,pelican?.5:.42,pelican?.25:.2);
   if(pelican||wideMouth){c.save();c.fillStyle='#071018';c.beginPath();c.ellipse(.95,.03,pelican?.48:.34,pelican?.34:.24,0,0,Math.PI*2);c.fill();c.restore();}
   if(v===2)line([[-.8,-.15],[-.3,-.48],[.2,-.18]],.08,'rgba(224,164,225,.78)');
   eye(.9,-.11,pelican?.05:.045);
  };

  const drawCephalopod=()=>{
   const squid=s.family==='squid',oct=s.family==='octopus';
   const arm=(sy,len,width=.055,curve=.2)=>{c.save();c.lineWidth=width;c.strokeStyle=s.color;c.beginPath();c.moveTo(-.28,sy*.35);c.bezierCurveTo(-.7,sy*.8,-1.15,sy*1.5+Math.sin(phase+sy*8)*curve,-len,sy*2.15);c.stroke();c.restore();};
   if(squid){
    // Every squid variant has a different mantle/fin/arm silhouette.
    const lengths=[1.55,1.7,1.85,1.62,1.48,1.72,1.35,2.25,2.05,1.9];
    for(let i=0;i<10;i++){const sy=(i-4.5)*.095,feeding=i===0||i===9;arm(sy,feeding?lengths[v]+.55:lengths[v],feeding?.04:.06,feeding?.1:.16);}
    if(v===0){polygon([[1.18,0],[.32,-.5],[-.42,-.24],[-.42,.24],[.32,.5]],s.color);polygon([[.2,-.32],[-.05,-.66],[.5,-.3]],s.color);polygon([[.2,.32],[-.05,.66],[.5,.3]],s.color);}
    else if(v===1){polygon([[1.08,0],[.36,-.42],[-.4,-.22],[-.4,.22],[.36,.42]],s.color);for(let i=0;i<7;i++)line([[-.1+i*.16,-.28],[-.1+i*.16,.28]],.025,'rgba(120,255,242,.55)');}
    else if(v===2){polygon([[1.3,0],[.2,-.64],[-.5,-.3],[-.5,.3],[.2,.64]],s.color);polygon([[.1,-.4],[-.28,-.88],[.55,-.36]],s.color);polygon([[.1,.4],[-.28,.88],[.55,.36]],s.color);}
    else if(v===3){polygon([[1.08,0],[.15,-.82],[-.42,-.22],[-.42,.22],[.15,.82]],s.color);polygon([[.36,-.38],[.72,-.88],[.76,-.2]],s.color);polygon([[.36,.38],[.72,.88],[.76,.2]],s.color);}
    else if(v===4){fill(()=>{c.moveTo(1.05,0);c.bezierCurveTo(.8,-.62,.2,-.88,-.38,-.5);c.quadraticCurveTo(-.62,0,-.38,.5);c.bezierCurveTo(.2,.88,.8,.62,1.05,0);},'rgba(154,174,167,.72)','rgba(220,245,238,.6)');polygon([[.35,-.5],[-.08,-.92],[.55,-.45]],s.color);polygon([[.35,.5],[-.08,.92],[.55,.45]],s.color);}
    else if(v===5){polygon([[1.02,0],[.28,-.48],[-.5,-.28],[-.5,.28],[.28,.48]],s.color);for(let i=0;i<6;i++){const px=-.22+i*.16;c.save();c.fillStyle='rgba(117,247,235,.62)';c.shadowBlur=.12;c.shadowColor='#69f6eb';c.beginPath();c.arc(px,i%2?.18:-.18,.026,0,Math.PI*2);c.fill();c.restore();}}
    else if(v===6){fill(()=>{c.moveTo(.88,0);c.bezierCurveTo(.7,-.46,.18,-.62,-.42,-.34);c.quadraticCurveTo(-.58,0,-.42,.34);c.bezierCurveTo(.18,.62,.7,.46,.88,0);},s.color,'rgba(220,232,230,.55)');polygon([[.14,-.36],[-.18,-.78],[.5,-.32]],s.color);polygon([[.14,.36],[-.18,.78],[.5,.32]],s.color);}
    else if(v===7){polygon([[.86,0],[.2,-.34],[-.55,-.18],[-.55,.18],[.2,.34]],s.color);for(let side of [-1,1])line([[-.25,side*.16],[-1.3,side*.55],[-2.1,side*.72]],.035,s.color);}
    else if(v===8){polygon([[1.42,0],[.35,-.72],[-.6,-.32],[-.6,.32],[.35,.72]],s.color);polygon([[.1,-.48],[-.35,-1.0],[.7,-.42]],s.color);polygon([[.1,.48],[-.35,1.0],[.7,.42]],s.color);}
    else {polygon([[1.25,0],[.42,-.86],[-.62,-.34],[-.62,.34],[.42,.86]],s.color);for(let i=0;i<4;i++)line([[-.25+i*.28,-.42],[-.18+i*.28,.42]],.035,'rgba(210,238,230,.4)');}
    eye(.46,-.16,v===9?.075:.055);
   } else {
    const arms=8;for(let i=0;i<arms;i++){const sy=(i-3.5)*.12,extra=v===4?i%2*.42:0;arm(sy,1.55+extra+(v===8?.25:0),v===5?.045:.075,.22);}
    if(v===0)ellipse(.3,0,.72,.62);
    else if(v===1){ellipse(.28,0,.62,.54);for(let i=0;i<5;i++)line([[-.1+i*.14,-.5],[.05+i*.12,.5]],.025,'rgba(230,244,232,.42)');}
    else if(v===2){ellipse(.32,0,.58,.5);polygon([[.4,-.42],[.8,-.76],[.55,-.26]],s.color);polygon([[.4,.42],[.8,.76],[.55,.26]],s.color);}
    else if(v===3){ellipse(.3,0,.66,.58);for(let i=0;i<8;i++){const a=i*Math.PI/4;c.save();c.strokeStyle='#43d9ff';c.lineWidth=.035;c.beginPath();c.arc(.3+Math.cos(a)*.26,Math.sin(a)*.24,.055,0,Math.PI*2);c.stroke();c.restore();}}
    else if(v===4){ellipse(.26,0,.48,.72);polygon([[.18,-.56],[-.26,-1.2],[-.06,-.4]],s.color);polygon([[.18,.56],[-.26,1.2],[-.06,.4]],s.color);}
    else if(v===5){c.save();c.globalAlpha=.72;ellipse(.3,0,.6,.74);c.restore();for(let i=0;i<6;i++)line([[-.15+i*.12,-.6],[-.05+i*.1,.6]],.02,'rgba(190,245,255,.5)');}
    else if(v===6||v===7){ellipse(.24,0,.5,.64);polygon([[.14,-.52],[-.28,-1.08],[-.02,-.38]],s.color);polygon([[.14,.52],[-.28,1.08],[-.02,.38]],s.color);}
    else if(v===8){ellipse(.28,0,.58,.5);for(let i=0;i<7;i++)arm((i-3)*.12,1.85+i*.04,.06,.16);}
    else {ellipse(.26,0,.78,.7);for(let i=0;i<6;i++)line([[-.5+i*.18,-.55],[-.45+i*.16,.55]],.035,'rgba(215,235,224,.34)');}
    eye(.46,-.17,.06);
   }
  };

  const drawJelly=()=>{
   const tall=v===7||v===9;
   c.save();c.fillStyle=s.color;c.beginPath();c.moveTo(.7,.08);c.bezierCurveTo(.65,-(tall?1.05:.7),-.55,-(tall?1.05:.7),-.72,.08);c.quadraticCurveTo(0,.42,.7,.08);c.fill();c.stroke();c.restore();
   const count=6+(v%4);for(let i=0;i<count;i++){const px=-.55+i*(1.1/(count-1));line([[px,.12],[px+Math.sin(phase+i)*.12,.7+(i%3)*.24],[px-.08,1.25+(i%2)*.3]],.035,s.color);}
  };

  const drawCrustacean=()=>{
   if(v===5){ // Japanese spider crab
    ellipse(0,0,.62,.42);for(let i=0;i<5;i++){const x=.45-i*.2;line([[x,0],[x-.35,-.85],[x-.75,-1.35]],.055,s.color);line([[x,0],[x-.35,.85],[x-.75,1.35]],.055,s.color);}return;
   }
   if(v===7){ // giant isopod
    ellipse(0,0,1.08,.55);for(let i=0;i<7;i++)line([[-.68+i*.22,-.5],[-.68+i*.22,.5]],.05,'rgba(220,236,226,.58)');for(let i=0;i<6;i++){const x=.55-i*.2;line([[x,.35],[x-.12,.85]],.05,s.color);line([[x,-.35],[x-.12,-.85]],.05,s.color);}eye(.72,-.18,.04);return;
   }
   ellipse(0,0,.9,.46);for(let i=0;i<5;i++){const x=.55-i*.28;line([[x,0],[x-.2,-.68],[x-.42,-.92]],.05,s.color);line([[x,0],[x-.2,.68],[x-.42,.92]],.05,s.color);}line([[.75,-.12],[1.45,-.55]],.07,s.color);line([[.75,.12],[1.45,.55]],.07,s.color);eye(.55,-.2,.045);
  };

  const drawFish=()=>{
   // Deep-sea fish variants emphasize their iconic anatomy.
   if(v===4){ // hatchetfish
    polygon([[-.85,0],[-.45,-.72],[.55,-.52],[.88,0],[.48,.65],[-.38,.78]],s.color);polygon([[-.76,0],[-1.25,-.4],[-1.08,.05],[-1.25,.4]],s.color);eye(.55,-.24,.08);return;
   }
   if(v===5){ // black dragonfish
    c.save();c.strokeStyle=s.color;c.lineWidth=.28;c.lineCap='round';c.beginPath();c.moveTo(.95,0);c.bezierCurveTo(.25,-.14,-.75,.1,-1.75,.02);c.stroke();c.restore();polygon([[.66,-.12],[1.35,0],[.66,.12]],s.color);eye(.72,-.09,.055);line([[.55,.08],[1.2,.34]],.03,'rgba(137,240,255,.75)');return;
   }
   if(v===6||v===7){ // viper/fangfish
    ellipse(.05,0,.92,.36);polygon([[-.78,0],[-1.25,-.35],[-1.1,0],[-1.25,.35]],s.color);c.save();c.fillStyle='#071018';c.beginPath();c.ellipse(.73,.08,.34,.24,0,0,Math.PI*2);c.fill();c.restore();for(let i=0;i<5;i++)line([[.55+i*.08,-.08],[.59+i*.08,.12]],.03,'#eef5e6');eye(.58,-.18,.06);return;
   }
   if(v===8){ // hadal snailfish
    ellipse(.02,0,.9,.48);polygon([[-.72,0],[-1.18,-.28],[-1.08,0],[-1.18,.28]],s.color);polygon([[-.2,-.38],[.1,-.62],[.35,-.35]],s.color);eye(.55,-.15,.045);return;
   }
   if(v===9){ // tripod fish
    ellipse(.22,0,.7,.25);polygon([[-.4,0],[-1.0,-.24],[-.86,0],[-1.0,.24]],s.color);line([[.15,.18],[-.1,1.35]],.035,s.color);line([[.45,.18],[.72,1.35]],.035,s.color);line([[-.25,.12],[-.55,1.25]],.035,s.color);eye(.55,-.11,.04);return;
   }
   ellipse(.08,0,1,.4);polygon([[-.85,0],[-1.4,-.42],[-1.2,0],[-1.4,.42]],s.color);polygon([[-.15,-.32],[.05,-.72],[.28,-.3]],s.color);eye(.68,-.18,.055);
  };

  const drawBenthic=()=>{
   if(v>=3&&v<=5){const points=[];for(let i=0;i<10;i++){const a=i*Math.PI/5,rr=i%2?.35:1.15+(v-3)*.08;points.push([Math.cos(a)*rr,Math.sin(a)*rr]);}polygon(points,s.color);return;}
   if(v>=6&&v<=7){ellipse(0,0,.72,.55);for(let i=0;i<14;i++){const a=i*Math.PI/7;line([[Math.cos(a)*.6,Math.sin(a)*.45],[Math.cos(a)*1.25,Math.sin(a)*.95]],.035,s.color);}return;}
   ellipse(0,0,1,.42);for(let i=0;i<8;i++){const a=i*Math.PI/4;line([[Math.cos(a)*.7,Math.sin(a)*.3],[Math.cos(a)*1.15,Math.sin(a)*.62]],.04,s.color);}
  };

  const drawMollusc=()=>{
   if(v<=1){ellipse(.05,0,.72,.62);c.save();c.strokeStyle='#e3d6af';c.lineWidth=.05;c.beginPath();for(let i=0;i<70;i++){const a=i*.18,rr=.04+i*.008;c.lineTo(.05+Math.cos(a)*rr,Math.sin(a)*rr);}c.stroke();c.restore();for(let i=0;i<8;i++){const yy=(i-3.5)*.08;line([[-.45,yy],[-1.0,yy*1.4],[-1.35,yy*1.7]],.035,s.color);}eye(.48,-.16,.045);return;}
   if(v===4||v===5||v===6||v===7){ellipse(.05,0,.62,.32);polygon([[-.45,0],[-1.15,-.28],[-.95,0],[-1.15,.28]],s.color);if(v===5)polygon([[.2,-.28],[.45,-.72],[.68,-.25]],s.color);eye(.4,-.12,.04);return;}
   ellipse(0,0,.82,.46);for(let i=0;i<5;i++)line([[-.45+i*.2,-.36],[-.45+i*.2,.36]],.04,'rgba(226,235,215,.5)');eye(.52,-.15,.04);
  };

  switch(s.family){
   case 'shark':drawShark();break;
   case 'ray':drawRay();break;
   case 'eel':drawEel();break;
   case 'octopus':case 'squid':drawCephalopod();break;
   case 'jelly':drawJelly();break;
   case 'crustacean':drawCrustacean();break;
   case 'fish':drawFish();break;
   case 'benthic':drawBenthic();break;
   case 'mollusc':drawMollusc();break;
   default:ellipse(0,0,.8,.55);eye(.45,-.15,.05);
  }

  // Abyssal material pass: mineral seams, photophores and scar-like asymmetry.
  // This is deliberately secondary to silhouette, but prevents flat recolor skins.
  c.save();
  c.globalCompositeOperation='lighter';
  c.fillStyle=v%2?'rgba(90,238,226,.55)':'rgba(216,118,178,.42)';
  c.shadowBlur=.16;c.shadowColor=c.fillStyle;
  const nodeCount=3+(v%4);
  for(let i=0;i<nodeCount;i++){const nx=-.55+i*(1.1/Math.max(1,nodeCount-1)),ny=(i%2?.18:-.18)+(v%3)*.025;c.beginPath();c.arc(nx,ny,.018+(i%2)*.007,0,Math.PI*2);c.fill();}
  c.restore();
  c.save();c.strokeStyle='rgba(220,238,230,.22)';c.lineWidth=.022;
  for(let i=0;i<2+(v%3);i++){c.beginPath();c.moveTo(-.45+i*.28,-.22);c.lineTo(-.34+i*.27,.22);c.stroke();}
  c.restore();

  c.restore();
 };
})();
