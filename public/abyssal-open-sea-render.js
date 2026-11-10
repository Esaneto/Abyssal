/* Side-view ocean renderer: reads the same solid geometry as the server.
 * Replaces the previous repeated elliptical habitat decals and floating stones.
 * All drawing is culled to camera bounds; no world-sized textures or arrays.
 */
(function(root,factory){
 const geo=typeof module==='object'&&module.exports?require('./abyssal-ocean-geography.js'):root.AbyssalOceanGeography;
 const api=factory(geo);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalOpenSeaRender=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(geo){
 'use strict';
 const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function seeded(a,b){const n=Math.sin(a*127.1+b*311.7)*43758.5453123;return n-Math.floor(n);}
 function kelp(ctx,x,y,length,time,phase){
  ctx.save();ctx.translate(x,y);ctx.lineCap='round';
  const sway=Math.sin(time*.00055+phase)*Math.min(30,length*.21);
  ctx.strokeStyle='rgba(11,86,88,.85)';ctx.lineWidth=7;
  ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-22,-length*.32,20+sway,-length*.64,sway,-length);ctx.stroke();
  for(let i=1;i<=4;i++){
   const h=i/5*length,side=i%2?-1:1;
   ctx.strokeStyle=i%2?'rgba(55,146,129,.80)':'rgba(19,117,112,.78)';
   ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(sway*(h/length),-h);ctx.quadraticCurveTo(side*35,-h-19,side*58+sway*.65,-h-45);ctx.stroke();
  }
  // Broad blades make the coastal algae resemble plants, not bare wireframes.
  for(let i=1;i<=4;i++){
   const q=i/5,xx=sway*q,yy=-q*length,side=i%2===0?1:-1;
   ctx.fillStyle=i%2?'rgba(54,144,115,.62)':'rgba(91,171,123,.56)';
   ctx.beginPath();ctx.ellipse(xx+side*35,yy-34,21,5.5,side*.34,0,TAU);ctx.fill();
   ctx.beginPath();ctx.ellipse(xx+side*18,yy-22,15,4.5,side*.6,0,TAU);ctx.fill();
  }
  ctx.restore();
 }
 function coral(ctx,x,y,scale,phase){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';
  const colors=['#507b86','#746c83','#94716e','#4c8078','#626e84','#805d72'],color=colors[Math.floor(phase*colors.length)];
  ctx.strokeStyle=color;ctx.lineWidth=5;
  for(let branch=0;branch<5;branch++){
   const spread=(branch-2)*10,twist=Math.sin(phase*11+branch)*9;
   ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(spread*.7,-21,spread+twist,-55);ctx.stroke();
   ctx.beginPath();ctx.moveTo(spread*.53,-31);ctx.lineTo(spread+twist+11,-43);ctx.stroke();
   ctx.fillStyle=color;ctx.beginPath();ctx.arc(spread+twist,-55,2.7,0,TAU);ctx.fill();
  }
  ctx.restore();
 }
 function drawWater(ctx,left,top,right,bottom,time,lowPower){
  // Absolute-depth gradient avoids abrupt steps as the camera dives.
  const gradient=ctx.createLinearGradient(0,top,0,bottom);
  for(let k=0;k<=12;k++){
   const depth=geo.metersAt(top+(bottom-top)*k/12),p=clamp(depth/2200,0,1);
   const smooth=p*p*(3-2*p),twilight=clamp(depth/530,0,1);
   const red=Math.round(8-7*smooth),green=Math.round(105*(1-twilight)+27*twilight-22*smooth);
   const blue=Math.round(148*(1-twilight)+57*twilight-34*smooth);
   gradient.addColorStop(k/12,'rgb('+red+','+Math.max(5,green)+','+Math.max(14,blue)+')');
  }
  ctx.fillStyle=gradient;ctx.fillRect(left,top,right-left,bottom-top);
  // The distant cyan opening is anchored in world space. No screen-sized repeating wallpaper.
  if(geo.metersAt(top)<400){
   for(const sourceX of [1800,6700,12200,18400,22600]){
   if(sourceX+geo.HEIGHT*.4<left||sourceX-geo.HEIGHT*.4>right)continue;
   const sourceY=-geo.HEIGHT*.016;
   // Smaller turquoise openings interrupt broad dark reef silhouettes.
   const opening=ctx.createRadialGradient(sourceX,210,40,sourceX,210,1250);
   opening.addColorStop(0,'rgba(58,225,255,.30)');
   opening.addColorStop(.42,'rgba(15,143,199,.13)');
   opening.addColorStop(1,'rgba(0,30,65,0)');
   ctx.fillStyle=opening;ctx.fillRect(left,top,right-left,bottom-top);
   const glow=ctx.createRadialGradient(sourceX,sourceY,60,sourceX,sourceY,geo.HEIGHT*.12);
   glow.addColorStop(0,'rgba(58,219,252,.49)');
   glow.addColorStop(.22,'rgba(20,165,231,.20)');
   glow.addColorStop(1,'rgba(6,70,136,0)');
   ctx.fillStyle=glow;ctx.fillRect(left,top,right-left,bottom-top);
   if(!lowPower){
    for(let i=-8;i<=8;i++){
     const start=sourceX+i*330,reach=geo.HEIGHT*.10;
     if(start+reach*.55<left||start-reach*.55>right)continue;
     const wobble=Math.sin(time*.000085+i*.61)*37;
     ctx.fillStyle='rgba(112,227,248,'+(0.028+seeded(i,31)*.032)+')';
     ctx.beginPath();ctx.moveTo(start+wobble,-90);ctx.lineTo(start+85+wobble,-90);
     ctx.lineTo(start+reach*.51+wobble,reach);ctx.lineTo(start+reach*.22+wobble,reach);
     ctx.closePath();ctx.fill();
    }
   }
   }
  }
  // Surface caustics fade before deep water and never form a repeated grid.
  if(geo.metersAt(top)<240){
   const begin=Math.max(0,Math.floor(left/750)),end=Math.ceil(right/750);
   for(let i=begin;i<=end;i++){
    const x=i*750+seeded(i,3)*160,limit=clamp((200-geo.metersAt(top))/150,0,1);
    ctx.fillStyle='rgba(120,206,203,'+(.028*limit)+')';
    ctx.beginPath();ctx.moveTo(x,-20);ctx.lineTo(x+170,-20);ctx.lineTo(x+600,Math.min(bottom,geo.HEIGHT*200/2200));ctx.lineTo(x+450,Math.min(bottom,2000));ctx.closePath();ctx.fill();
   }
  }
  if(lowPower)return;
  // Sparse marine snow: camera-culled, increasingly visible in the dark water column.
  const bx0=Math.floor(left/250),bx1=Math.ceil(right/250),by0=Math.floor(top/260),by1=Math.ceil(bottom/260);
  for(let bx=bx0;bx<=bx1;bx++)for(let by=by0;by<=by1;by++){
   if(seeded(bx,by)<.65)continue;
   const x=bx*250+seeded(bx+12,by)*200,y=by*260+seeded(bx,by+23)*210;
   ctx.fillStyle='rgba(152,213,209,'+(.045+geo.lightAt(y)*.095)+')';
   ctx.beginPath();ctx.arc(x,y,.8+seeded(bx+4,by+8)*1.4,0,TAU);ctx.fill();
  }
 }

 // Distant formations are deliberately desaturated and non-solid. Brightly edged
 // near-field rocks still use the exact collision geometry from OceanGeography.
 function drawProvinceBackdrop(ctx,left,top,right,bottom,time,lowPower){
  const tileX=1120,tileY=1250,cols=[Math.floor(left/tileX)-1,Math.ceil(right/tileX)+1];
  const rows=[Math.floor(top/tileY)-1,Math.ceil(bottom/tileY)+1];
  for(let bx=cols[0];bx<=cols[1];bx++)for(let by=rows[0];by<=rows[1];by++){
   if(bx<0||by<0)continue;
   const seed=seeded(bx*29+23,by*11+9);
   if(seed<.34)continue;
   const x=bx*tileX+tileX*(.28+seeded(bx,by+27)*.47);
   const y=by*tileY+tileY*(.25+seeded(bx+19,by)*.46);
   if(x<0||x>geo.WIDTH||y>geo.HEIGHT)continue;
   const biome=geo.visualBiomeAt?.(x,y)?.id||'coastal';
   const scale=biome==='cinematic'?1.16:biome==='geological'?.88:.70;
   const w=(185+seed*155)*scale,h=(245+seeded(bx+13,by+8)*290)*scale;
   ctx.save();ctx.globalAlpha=lowPower?.15:.22;
   ctx.fillStyle=biome==='geological'?'#0c1c2b':biome==='cinematic'?'#073e54':'#135465';
   ctx.beginPath();ctx.moveTo(x-w,y+h*.53);
   ctx.lineTo(x-w*.68,y-h*.45);ctx.lineTo(x-w*.26,y-h*.73);
   ctx.lineTo(x+w*.10,y-h*.58);ctx.lineTo(x+w*.57,y-h*.75);
   ctx.lineTo(x+w*.91,y+h*.49);ctx.closePath();ctx.fill();
   if(!lowPower&&biome==='cinematic'&&seed>.56){
    // The arch is background-only and visibly distant, never a fake collision gate.
    ctx.globalAlpha=.17;ctx.fillStyle='#12708a';ctx.beginPath();
    ctx.moveTo(x-w*.92,y-h*.05);ctx.quadraticCurveTo(x-w*.20,y-h*.73,x+w*.66,y-h*.23);
    ctx.lineTo(x+w*.7,y-h*.05);ctx.quadraticCurveTo(x,y-h*.50,x-w*.92,y+h*.05);
    ctx.closePath();ctx.fill();
   }
   ctx.restore();
  }
 }
 // Province lighting: coastal sun shafts, cinematic cyan corridors and tiny
 // abyssal mineral glints. Nothing uses a world-sized texture.
 function drawProvinceLight(ctx,left,top,right,bottom,time,lowPower){
  const centerY=(top+bottom)*.5,centerX=(left+right)*.5;
  const biome=geo.visualBiomeAt?.(centerX,centerY)?.id||'coastal';
  if(biome==='cinematic'&&geo.metersAt(top)<950){
   const pitch=780;
   for(let i=Math.floor(left/pitch)-1;i<=Math.ceil(right/pitch)+1;i++){
    if(seeded(i,48)<.38)continue;
    const x=i*pitch+seeded(i,61)*270;
    const y=geo.metersAt(top)<150?0:Math.max(0,top-100);
    const reach=Math.min(1250,bottom-y),swing=Math.sin(time*.00019+i*1.7)*24;
    ctx.fillStyle='rgba(62,197,235,'+(lowPower?.023:.057)+')';
    ctx.beginPath();ctx.moveTo(x-35+swing,y);ctx.lineTo(x+25+swing,y);
    ctx.lineTo(x+250+swing,y+reach);ctx.lineTo(x+70+swing,y+reach);ctx.closePath();ctx.fill();
   }
  }else if(biome==='geological'&&!lowPower){
   const cell=410;
   for(let bx=Math.floor(left/cell);bx<=Math.ceil(right/cell);bx++)
    for(let by=Math.floor(top/cell);by<=Math.ceil(bottom/cell);by++){
     const seed=seeded(bx*7+17,by*13+9);
     if(seed<.78)continue;
     const x=bx*cell+seed*cell*.65,y=by*cell+seeded(bx+4,by+6)*cell*.77;
     if(geo.isSolid(x,y,25))continue;
     ctx.fillStyle='rgba(112,212,198,'+(.06+seed*.045)+')';
     ctx.beginPath();ctx.arc(x+Math.sin(time*.00028+bx)*5,y,1.1+seed,0,TAU);ctx.fill();
    }
  }
 }

 function drawDepthHaze(ctx,left,top,right,bottom){
  const depthTop=geo.metersAt(top),depthBottom=geo.metersAt(bottom);
  if(depthBottom<140)return;
  const veil=ctx.createLinearGradient(0,top,0,bottom);
  const attenuation=d=>clamp((d-140)/1450,0,.34);
  veil.addColorStop(0,'rgba(1,9,23,'+attenuation(depthTop).toFixed(3)+')');
  veil.addColorStop(1,'rgba(1,7,19,'+attenuation(depthBottom).toFixed(3)+')');
  ctx.fillStyle=veil;ctx.fillRect(left,top,right-left,bottom-top);
 }
 function drawSediment(ctx,left,top,right,bottom,time,lowPower){
  const spacing=lowPower?165:110;
  for(let i=Math.floor(left/spacing);i<=Math.ceil(right/spacing);i++){
   const x=i*spacing+seeded(i,11)*spacing*.6,y=geo.floorAt(x);
   if(y<top-20||y>bottom+20)continue;
   const rough=seeded(i,51);
   ctx.save();ctx.strokeStyle='rgba(116,149,150,'+(.07+rough*.12)+')';ctx.lineWidth=1.5;
   for(let j=0;j<3;j++){const dx=(j-1)*19;ctx.beginPath();ctx.moveTo(x+dx-12,y+3+j*3);ctx.quadraticCurveTo(x+dx,y-4+j*3,x+dx+13,y+2+j*3);ctx.stroke();}
   if(!lowPower&&geo.metersAt(y)>400&&rough>.65){
    ctx.fillStyle='rgba(112,161,153,.22)';ctx.beginPath();ctx.ellipse(x+11,y-4,8+rough*8,2.2,0,0,TAU);ctx.fill();
   }
   ctx.restore();
  }
 }
 function drawFloor(ctx,left,right,bottom){
  const start=Math.max(0,left-140),stop=Math.min(geo.WIDTH,right+140);
  const step=58;
  const gradient=ctx.createLinearGradient(0,Math.min(geo.floorAt(start),geo.floorAt(stop))-220,0,bottom+600);
  gradient.addColorStop(0,'#253f4b');gradient.addColorStop(.21,'#142936');gradient.addColorStop(.8,'#07101c');gradient.addColorStop(1,'#020711');
  ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(start,bottom+250);
  for(let x=start;x<=stop;x+=step)ctx.lineTo(x,geo.floorAt(x));
  ctx.lineTo(stop,geo.floorAt(stop));ctx.lineTo(stop,bottom+250);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(96,149,151,.13)';ctx.lineWidth=3;
  ctx.beginPath();for(let x=start,i=0;x<=stop+step;x+=step,i++){const px=Math.min(stop,x),y=geo.floorAt(px);if(!i)ctx.moveTo(px,y);else ctx.lineTo(px,y);}ctx.stroke();
  // A secondary geological contour suggests stratification without per-pixel noise.
  ctx.strokeStyle='rgba(89,120,130,.1)';ctx.lineWidth=5;ctx.beginPath();
  for(let x=start,i=0;x<=stop+step;x+=step,i++){const px=Math.min(stop,x),y=geo.floorAt(px)+80+Math.sin(px*.007)*18;if(!i)ctx.moveTo(px,y);else ctx.lineTo(px,y);}ctx.stroke();
 }
 function drawFloorDetails(ctx,left,top,right,bottom,lowPower){
  const pitch=lowPower?190:125,start=Math.max(0,Math.floor(left/pitch)-1),end=Math.ceil(right/pitch)+1;
  for(let i=start;i<=end;i++){
   const x=i*pitch,y=geo.floorAt(x),depth=geo.metersAt(y);
   if(y<top-80||y>bottom+45)continue;
   const r=seeded(i,97),w=45+r*75;
   ctx.fillStyle=depth>1200?'rgba(84,104,113,.20)':'rgba(79,127,133,.20)';
   ctx.beginPath();ctx.moveTo(x-w,y+11);ctx.lineTo(x-w*.34,y-7-r*6);
   ctx.lineTo(x+w*.32,y-5+r*7);ctx.lineTo(x+w,y+13);
   ctx.lineTo(x+w*.24,y+26);ctx.closePath();ctx.fill();
   ctx.strokeStyle='rgba(96,155,160,.20)';ctx.lineWidth=1.5;
   ctx.beginPath();ctx.moveTo(x-w*.31,y-7);ctx.lineTo(x+w*.3,y-4);ctx.stroke();
   if(!lowPower&&r>.75){
    ctx.fillStyle='rgba(135,153,136,.24)';
    for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(x+(k-1)*13,y-4,2.2+k*.5,0,TAU);ctx.fill();}
   }
  }
 }
 function drawRocks(ctx,left,top,right,bottom,lowPower=false){
  for(const rock of geo.ROCKS){
   if(rock.x+rock.rx+95<left||rock.x-rock.rx-95>right||rock.y+rock.ry+95<top||rock.y-rock.ry-95>bottom)continue;
   const lit=geo.lightAt(rock.y-rock.ry),seed=rock.x*.00031+rock.y*.00017;
   const gradient=ctx.createLinearGradient(rock.x-rock.rx,rock.y-rock.ry,rock.x+rock.rx,rock.y+rock.ry);
   gradient.addColorStop(0,lit>.12?'#3e595c':'#273b42');
   gradient.addColorStop(.38,lit>.12?'#263d42':'#172a32');
   gradient.addColorStop(.83,'#0b1c26');gradient.addColorStop(1,'#050d17');
   ctx.beginPath();
   for(let k=0;k<=80;k++){
    const a=k/80*TAU,point=geo.rockSurfaceAt(rock,a);
    if(k===0)ctx.moveTo(point.x,point.y);else ctx.lineTo(point.x,point.y);
   }
   ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
   ctx.strokeStyle='rgba(125,149,148,'+(.08+lit*.10)+')';ctx.lineWidth=1.6;ctx.stroke();
   ctx.save();ctx.clip();
   // Each rock has irregular shaded planes clipped inside the actual physics outline.
   const region=geo.visualBiomeAt?.(rock.x,rock.y-rock.ry*.42)?.id||'coastal';
   const hues=region==='geological'?
    ['rgba(69,104,111,.28)','rgba(13,32,43,.55)','rgba(63,77,82,.30)','rgba(5,19,30,.42)']:
    region==='cinematic'?
    ['rgba(51,111,132,.27)','rgba(9,37,56,.52)','rgba(65,136,144,.16)','rgba(7,29,46,.34)']:
    ['rgba(70,122,127,.29)','rgba(12,44,56,.46)','rgba(102,142,136,.21)','rgba(5,25,39,.41)'];
   const faces=Math.min(lowPower?12:30,Math.max(8,Math.ceil(rock.ry/115)));
   for(let j=0;j<faces;j++){
    const px=rock.x+(seeded(rock.x*.017+j,rock.y*.001)-.5)*rock.rx*1.7;
    const py=rock.y+(seeded(rock.y*.013+j,rock.x*.004)-.5)*rock.ry*1.76;
    const wx=rock.rx*(.20+seeded(j,rock.x*.01)*.30);
    const wy=Math.min(300,rock.ry*(.13+seeded(j,rock.y*.01)*.21));
    ctx.fillStyle=hues[j%hues.length];ctx.beginPath();
    ctx.moveTo(px-wx,py-wy*.23);ctx.lineTo(px-wx*.16,py-wy);
    ctx.lineTo(px+wx*.84,py-wy*.32);ctx.lineTo(px+wx,py+wy*.55);
    ctx.lineTo(px-wx*.34,py+wy);ctx.closePath();ctx.fill();
    if(!lowPower&&j%3===0){
     ctx.strokeStyle='rgba(116,158,162,.14)';ctx.lineWidth=1.5;
     ctx.beginPath();ctx.moveTo(px-wx,py-wy*.23);ctx.lineTo(px-wx*.16,py-wy);
     ctx.lineTo(px+wx*.84,py-wy*.32);ctx.stroke();
    }
   }
   // Bright upper geological lip; no glowing ellipse around the entire stone.
   ctx.strokeStyle=region==='geological'?'rgba(117,166,165,.37)':'rgba(77,179,199,.41)';
   ctx.lineWidth=lowPower?2.5:3.8;ctx.beginPath();
   for(let k=0;k<=30;k++){
    const pt=geo.rockSurfaceAt(rock,Math.PI+k/30*Math.PI);
    if(!k)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);
   }ctx.stroke();
   // Broken joints and diagonally stratified rock, no perfect elliptical rings.
   const layers=rock.type==='spire'?7:rock.type==='boulder'?3:5;
   for(let k=0;k<layers;k++){
    const v=(k+1)/(layers+1),y=rock.y-rock.ry+v*rock.ry*2;
    const wave=Math.sin(seed*7+k*1.81)*rock.ry*.06;
    ctx.strokeStyle=k%2?'rgba(96,128,132,.12)':'rgba(3,12,20,.23)';
    ctx.lineWidth=2+k%3;ctx.beginPath();
    ctx.moveTo(rock.x-rock.rx-35,y+wave);
    ctx.bezierCurveTo(rock.x-rock.rx*.37,y-18,rock.x+rock.rx*.32,y+24,rock.x+rock.rx+25,y+wave);
    ctx.stroke();
   }
   for(let k=0;k<7;k++){
    const x=rock.x+(seeded(rock.x,k+9)-.5)*rock.rx*1.7;
    const y=rock.y+(seeded(rock.y,k+2)-.5)*rock.ry*1.5;
    ctx.strokeStyle='rgba(4,12,19,.22)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x-20,y-25);ctx.lineTo(x+4,y+10);ctx.lineTo(x+13,y+27);ctx.stroke();
   }
   const visual=geo.visualBiomeAt?.(rock.x,rock.y-rock.ry*.4)?.id||'coastal';
   if(visual==='geological'){
    for(let j=0;j<5;j++){
     const yy=rock.y-rock.ry*.65+j*rock.ry*.29;
     ctx.strokeStyle=j%2?'rgba(95,160,149,.21)':'rgba(201,155,98,.18)';ctx.lineWidth=3+j%2;
     ctx.beginPath();ctx.moveTo(rock.x-rock.rx*.79,yy);ctx.lineTo(rock.x-rock.rx*.30,yy+13);
     ctx.lineTo(rock.x+rock.rx*.19,yy-21);ctx.lineTo(rock.x+rock.rx*.73,yy+8);ctx.stroke();
    }
   }else if(visual==='cinematic'){
    ctx.strokeStyle='rgba(53,175,190,.16)';ctx.lineWidth=3.5;ctx.beginPath();
    ctx.moveTo(rock.x-rock.rx*.8,rock.y-rock.ry*.6);
    ctx.quadraticCurveTo(rock.x,rock.y-rock.ry*.76,rock.x+rock.rx*.7,rock.y-rock.ry*.48);ctx.stroke();
   }
   ctx.restore();
  }
 }
 function drawCaves(ctx,left,top,right,bottom){
  const entries=geo.CAVES.map(c=>c.nodes).concat([...geo.ARCH_TUNNELS,...(geo.BRANCH_TUNNELS||[])].map(t=>[{x:t.ax,y:t.ay,r:t.r},{x:t.bx,y:t.by,r:t.r}]));
  for(const nodes of entries){
   const x0=Math.min(...nodes.map(n=>n.x)),x1=Math.max(...nodes.map(n=>n.x)),y0=Math.min(...nodes.map(n=>n.y)),y1=Math.max(...nodes.map(n=>n.y));
   if(x1+320<left||x0-320>right||y1+320<top||y0-320>bottom)continue;
   ctx.save();
   // Organic water voids: shape sampled from the same radius that governs cave
   // collision. Their irregular edges are passable, not fake painted walls.
   for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1],b=nodes[i],r=Math.min(a.r,b.r),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    const nx=-dy/len,ny=dx/len,centerY=(a.y+b.y)*.5,light=geo.lightAt(centerY);
    const water=ctx.createLinearGradient(0,centerY-r,0,centerY+r);
    water.addColorStop(0,'rgba(3,31,47,'+(.75-light*.12)+')');
    water.addColorStop(.5,'rgba(3,23,39,.92)');water.addColorStop(1,'rgba(2,16,29,.96)');
    ctx.fillStyle=water;ctx.beginPath();
    const count=22;
    for(let j=0;j<=count;j++){
     const t=j/count,rad=geo.caveRadiusAt(a,b,t,r),x=a.x+dx*t+nx*rad,y=a.y+dy*t+ny*rad;
     if(!j)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    for(let j=count;j>=0;j--){
     const t=j/count,rad=geo.caveRadiusAt(a,b,t,r),x=a.x+dx*t-nx*rad,y=a.y+dy*t-ny*rad;
     ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(66,90,99,.12)';ctx.lineWidth=5;ctx.stroke();
    // The capsule's rounded ends are drawn with fractured arcs, not a perfect oval.
    for(const center of [a,b]){
     ctx.fillStyle=water;ctx.beginPath();
     for(let j=0;j<=48;j++){
      const theta=j/48*TAU,rad=r*(.91+.04*Math.sin(theta*5+center.x*.001)+.03*Math.cos(theta*9+center.y*.001));
      const x=center.x+Math.cos(theta)*rad,y=center.y+Math.sin(theta)*rad;
      if(!j)ctx.moveTo(x,y);else ctx.lineTo(x,y);
     }
     ctx.closePath();ctx.fill();
    }
   }
   ctx.restore();
  }
 }
 function tubeSponges(ctx,x,y,scale,seed){
  const tones=['#907985','#9f808a','#99828b','#b39493'];
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';
  for(let j=0;j<6;j++){
   const xx=(j-2.5)*17,hh=25+seeded(j,seed)*54,rr=4+seeded(seed,j+6)*5;
   ctx.strokeStyle=tones[(j+Math.floor(seed*4))%tones.length];ctx.lineWidth=rr*2.0;
   ctx.beginPath();ctx.moveTo(xx*.43,0);ctx.quadraticCurveTo(xx-8,-hh*.61,xx,-hh);ctx.stroke();
   ctx.strokeStyle='rgba(8,21,37,.86)';ctx.lineWidth=rr*.95;ctx.beginPath();ctx.ellipse(xx,-hh,rr,2.2,0,0,TAU);ctx.stroke();
   ctx.strokeStyle='rgba(244,194,194,.22)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(xx-rr,-hh+4);ctx.lineTo(xx-rr+3,-hh*.42);ctx.stroke();
  }
  ctx.restore();
 }
 function seaFan(ctx,x,y,scale,seed){
  // Irregular branching gorgonia, not a repeated triangular comb.
  const colors=['#486b80','#686b86','#4b8790','#7a607c'];
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';
  const color=colors[Math.min(3,Math.floor(seed*4))];
  for(let arm=0;arm<8;arm++){
   const a=-Math.PI*.93+arm*.255+(seed-.5)*.10;
   const bend=Math.sin(seed*17+arm*1.71)*12;
   const reach=55+seeded(arm+5,seed*29)*35;
   const tx=Math.cos(a)*reach+bend,ty=-12-Math.abs(Math.sin(a))*reach;
   ctx.strokeStyle=color;ctx.lineWidth=2.4+seeded(arm,seed*17)*1.7;
   ctx.beginPath();ctx.moveTo(0,0);
   ctx.bezierCurveTo(tx*.12-7,ty*.28,tx*.67+bend*.3,ty*.72,tx,ty);ctx.stroke();
   ctx.lineWidth=1.1;
   for(let j=1;j<=3;j++){
    const q=j/4,px=tx*q+bend*.15*Math.sin(Math.PI*q),py=ty*q;
    const side=(arm+j)%2?1:-1,spread=7+seeded(j,arm+seed)*10;
    ctx.beginPath();ctx.moveTo(px,py);
    ctx.quadraticCurveTo(px+side*spread*.4,py-5,px+side*spread,py-11-seeded(arm,j)*6);ctx.stroke();
   }
  }
  ctx.restore();
 }
 function glowAnemone(ctx,x,y,scale,seed,lowPower){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  const color=seed>.5?'#56e1f8':'#a78bff';
  ctx.strokeStyle=color;ctx.lineWidth=2.8;ctx.lineCap='round';
  if(!lowPower){ctx.shadowColor=color;ctx.shadowBlur=12;}
  for(let i=0;i<14;i++){
   const a=(i/14)*TAU,reach=15+seeded(i,seed)*25;
   ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(Math.cos(a+.2)*reach*.5,-8+Math.sin(a)*reach*.5,Math.cos(a)*reach,Math.sin(a)*reach*.42-13);ctx.stroke();
  }ctx.restore();
 }
 function drawCinematicPolyps(ctx,x,y,seed,lowPower){
  ctx.save();ctx.translate(x,y);ctx.lineCap='round';
  const n=lowPower?3:6;
  for(let i=0;i<n;i++){
   const px=(i-(n-1)/2)*13,h=18+seeded(i,seed*31)*34;
   ctx.strokeStyle=i%2?'rgba(110,202,199,.72)':'rgba(185,158,111,.62)';ctx.lineWidth=2.5;
   ctx.beginPath();ctx.moveTo(px,0);ctx.quadraticCurveTo(px+8,-h*.58,px-5,-h);ctx.stroke();
   ctx.fillStyle=i%2?'rgba(123,225,230,.82)':'rgba(217,191,125,.74)';
   ctx.beginPath();ctx.ellipse(px-5,-h,4.5,2.7,-.15,0,TAU);ctx.fill();
  }ctx.restore();
 }
 function drawRockMineralVein(ctx,x,y,seed,lowPower){
  ctx.save();ctx.translate(x,y);ctx.lineJoin='round';
  ctx.strokeStyle='rgba(65,128,133,.42)';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(-26,3);ctx.lineTo(-11,-7);ctx.lineTo(0,-3);ctx.lineTo(9,-17);ctx.lineTo(26,-11);ctx.stroke();
  for(let i=0;i<(lowPower?2:4);i++){
   const px=-21+i*13,py=-2-(i%2)*8,size=3.2+seeded(i,seed)*4;
   ctx.fillStyle=i%3===0?'rgba(190,153,101,.67)':'rgba(67,158,166,.56)';
   ctx.beginPath();ctx.moveTo(px-size,py);ctx.lineTo(px,py-size*1.4);ctx.lineTo(px+size*.86,py-size*.2);
   ctx.lineTo(px+size*.2,py+size*.54);ctx.closePath();ctx.fill();
  }ctx.restore();
 }
 function rockGarden(ctx,x,y,type,seed,time,lowPower,visualId='coastal'){
  if(visualId==='geological'){
   if(seed>.27)drawRockMineralVein(ctx,x,y,seed,lowPower);
   if(type==='abyss'&&seed>.78&&!lowPower)glowAnemone(ctx,x,y,.38+seed*.22,seed,lowPower);
   return;
  }
  if(visualId==='cinematic'&&seed>.38){
   drawCinematicPolyps(ctx,x,y,seed,lowPower);
   if(seed>.62)return;
  }
  if(type==='kelp'){if(geo.metersAt(y)<210)kelp(ctx,x,y,120+seed*180,time,seed*TAU);return;}
  if(type==='reef'&&geo.metersAt(y)<215){
   if(seed<.31)tubeSponges(ctx,x,y,.62+seed,seed);
   else if(seed<.70)seaFan(ctx,x,y,.57+seed*.7,seed);
   else coral(ctx,x,y,.7+seed*.7,seed);
   }else if(type==='rocks'||type==='canyon'){
   if(geo.metersAt(y)<420&&seed>.46)tubeSponges(ctx,x,y,.50+seed*.52,seed);
   else if(geo.metersAt(y)<230&&seed<.25&&!lowPower)seaFan(ctx,x,y,.38+seed*.45,seed);
   // Deepwater corals and filter-feeding sponges do not need photosynthesis.
   else if(!lowPower&&geo.metersAt(y)>230&&geo.metersAt(y)<1700&&seed>.78){ctx.save();ctx.globalAlpha=.39;seaFan(ctx,x,y,.38+seed*.35,seed);ctx.restore();}
  }else if(type==='abyss'&&!lowPower&&seed>.62){
   glowAnemone(ctx,x,y,.42+seed*.38,seed,lowPower);
  }
 }
 function danglingPlants(ctx,x,y,length,time,seed){
  ctx.save();ctx.lineCap='round';
  const motion=Math.sin(time*.00047+seed)*Math.min(18,length*.19);
  ctx.strokeStyle='rgba(6,31,40,.83)';ctx.lineWidth=4+seeded(seed,3)*5;
  ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+12,y+length*.30,x-16+motion,y+length*.66,x+motion,y+length);ctx.stroke();
  ctx.restore();
 }
  function drawAmbientHabitat(ctx,left,top,right,bottom,time,lowPower){
  const cell=lowPower?420:300,bx0=Math.floor(left/cell)-1,bx1=Math.ceil(right/cell)+1,by0=Math.floor(top/cell)-1,by1=Math.ceil(bottom/cell)+1;
  for(let bx=bx0;bx<=bx1;bx++)for(let by=by0;by<=by1;by++){
   const seed=seeded(bx*13+7,by*17+3);if(seed<.34)continue;
   const x=bx*cell+seeded(bx+31,by)*cell*.82,y=by*cell+seeded(bx,by+41)*cell*.78;
   if(x<0||x>geo.WIDTH||y<80||y>geo.HEIGHT-80||geo.isSolid(x,y,28))continue;
   const floor=geo.floorAt(x),nearFloor=floor-y<260;
   ctx.save();ctx.translate(x,y);
   if(nearFloor){
    const r=8+seed*16;ctx.fillStyle='rgba(42,68,72,.65)';ctx.beginPath();ctx.ellipse(0,0,r*1.7,r*.72,seed*2.4,0,TAU);ctx.fill();
    if(seed>.57)rockGarden(ctx,0,3,geo.classify(x,y),seed,time,lowPower,geo.visualBiomeAt?.(x,y)?.id);
   }else if(seed>.78&&!lowPower){
    // Sparse suspended organic silhouettes make mid-water feel inhabited without fake UI sprites.
    ctx.fillStyle='rgba(98,147,144,.12)';ctx.beginPath();ctx.ellipse(0,0,2.3+seed*2,1.1,seed*3,0,TAU);ctx.fill();
   }
   ctx.restore();
  }
 }
 function drawBiomes(ctx,left,top,right,bottom,time,lowPower){
  // Vegetation grows only on geological supports, never as floating random icons.
  const step=lowPower?240:180;
  const start=Math.max(0,Math.floor(left/step)-1),end=Math.min(Math.ceil(geo.WIDTH/step),Math.ceil(right/step)+1);
  for(let i=start;i<=end;i++){
   const x=i*step+seeded(i,1)*48,y=geo.floorAt(x)-5;
   if(y<top-320||y>bottom+40)continue;
   const rand=seeded(i,7),type=geo.classify(x,y-110);
   if(rand>(geo.visualBiomeAt?.(x,y)?.id==='coastal'?.19:.42)){
    ctx.save();ctx.translate(x,y);
    const size=.78+rand*.65;ctx.scale(size,size);
    rockGarden(ctx,0,0,type,rand,time,lowPower,geo.visualBiomeAt?.(x,y)?.id);
    ctx.restore();
   }
  }
  for(const rock of geo.ROCKS){
   if(rock.x+rock.rx+140<left||rock.x-rock.rx-140>right||rock.y+rock.ry+220<top||rock.y-rock.ry-290>bottom)continue;
   const province=geo.visualBiomeAt?.(rock.x,rock.y-rock.ry*.45)?.id||'coastal';
   const n=lowPower?3:province==='coastal'?12:province==='cinematic'?9:7;
   for(let i=0;i<n;i++){
    const q=(i+.5)/n*1.72-.86,place=geo.rockSurfaceAt(rock,-Math.acos(q),0);
    const x=place.x,y=place.y,seed=seeded(rock.x,i+19);
    if(seed>(province==='coastal'?.16:.35)){
     // Botanical roots are projected onto the exact same rock contour as collisions.
     ctx.save();ctx.translate(x,y);
     const plantSize=.65+seeded(i,rock.x*.03)*.75;
     ctx.scale(plantSize,plantSize);
     rockGarden(ctx,0,0,geo.classify(x,y-10),seed,time,lowPower,province);
     if(!lowPower&&province==='coastal'&&i%3===1)seaFan(ctx,19,0,.42+seed*.35,seed);
     ctx.restore();
    }
    if(rock.type==='overhang'||rock.type!=='spire'&&i%2===0&&!lowPower){
     const underside=geo.rockSurfaceAt(rock,Math.acos(q),0).y;
     if(rock.type==='overhang'&&seed>.12&&geo.metersAt(underside)<450){
      // Multiple asymmetric biological silhouettes, not identical hanging brushes.
      const form=seeded(rock.x+i*7,29);
      ctx.save();ctx.translate(x,underside+3);ctx.scale(1,-1);
      if(form<.26)kelp(ctx,0,0,105+seed*155,time,seed*TAU);
      else if(form<.51)tubeSponges(ctx,0,0,.46+seed*.62,seed);
      else if(form<.79)seaFan(ctx,0,0,.42+seed*.72,seed);
      else coral(ctx,0,0,.62+seed*.58,seed);
      ctx.restore();
     }
     if(!lowPower&&i%2===0&&geo.metersAt(underside)<400)danglingPlants(ctx,x,underside,55+seed*185,time,seed+i);
    }
   }
  }
 }
 // Drifting Sargassum-style rafts: surface vegetation in every ocean province.
 // Only patches close to the camera are drawn; none remain at abyssal depth.
 function drawSurfaceVegetation(ctx,left,top,right,bottom,time,lowPower){
  if(top>135||bottom<12)return;
  const spacing=540;
  for(let i=Math.floor(left/spacing)-1;i<=Math.ceil(right/spacing)+1;i++){
   const seed=seeded(i,87);
   if(seed<.35)continue;
   const x=i*spacing+seeded(i,91)*spacing*.75;
   const y=22+seeded(i,83)*19;
   const stretch=34+seeded(i,93)*47;
   const sway=Math.sin(time*.00035+i*2.17)*5;
   ctx.save();ctx.translate(x+sway,y);ctx.lineCap='round';
   ctx.strokeStyle='rgba(26,101,83,.76)';ctx.lineWidth=3.2;
   ctx.beginPath();ctx.moveTo(-stretch,0);
   ctx.bezierCurveTo(-stretch*.48,8,stretch*.27,-6,stretch,3);ctx.stroke();
   const leaves=lowPower?3:8;
   for(let k=0;k<leaves;k++){
    const u=leaves===1?0:k/(leaves-1),xx=(u*2-1)*stretch;
    const yy=2+Math.sin(u*6+i)*3,side=k%2===0?1:-1;
    const len=10+seeded(i,k+19)*19;
    ctx.strokeStyle=k%3?'rgba(56,142,106,.83)':'rgba(87,160,111,.83)';
    ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(xx,yy);
    ctx.quadraticCurveTo(xx+side*len*.55,yy+len*.52,xx+side*len*.4,yy+len);ctx.stroke();
    ctx.fillStyle='rgba(90,155,96,.56)';ctx.beginPath();
    ctx.ellipse(xx+side*len*.5,yy+len*.7,5,2.5,side*.4,0,TAU);ctx.fill();
   }
   ctx.restore();
  }
 }
 function drawSky(ctx,left,top,right,time){
  if(top>=0)return;
  const sky=ctx.createLinearGradient(0,top,0,0);
  sky.addColorStop(0,'#183a53');sky.addColorStop(1,'#7797a6');
  ctx.fillStyle=sky;ctx.fillRect(left,top,right-left,-top);
  if(top< -15){const horizon=ctx.createLinearGradient(0,-28,0,3);horizon.addColorStop(0,'rgba(152,193,197,0)');horizon.addColorStop(1,'rgba(184,221,222,.30)');ctx.fillStyle=horizon;ctx.fillRect(left,-28,right-left,28);}
 }
 function draw(ctx,viewport={},time=0,lowPower=false){
  if(!ctx||!geo)return;
  const left=clamp(Number(viewport.left)||0,0,geo.WIDTH),rawTop=Number(viewport.top)||0;
  const top=clamp(rawTop,0,geo.HEIGHT);
  const right=clamp(left+Math.max(10,Number(viewport.width)||1200),0,geo.WIDTH);
  const bottom=clamp(rawTop+Math.max(10,Number(viewport.height)||700),0,geo.HEIGHT);
  if(right<=left)return;
  if(rawTop<0){ctx.save();drawSky(ctx,left,rawTop,right,time);ctx.restore();}
  if(bottom<=top)return;
  ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
  drawWater(ctx,left,top,right,bottom,time,lowPower);
  drawProvinceBackdrop(ctx,left,top,right,bottom,time,lowPower);
  drawProvinceLight(ctx,left,top,right,bottom,time,lowPower);
  drawSurfaceVegetation(ctx,left,top,right,bottom,time,lowPower);
  if(top<130){ctx.save();ctx.strokeStyle='rgba(159,238,255,.69)';ctx.lineWidth=2.4;ctx.beginPath();for(let x=Math.floor(left/28)*28,j=0;x<=right+28;x+=28,j++){const yy=18+Math.sin(x*.006+time*.0007)*3.8+Math.sin(x*.017-time*.0011)*1.6;if(j===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();ctx.fillStyle='rgba(188,244,255,.88)';ctx.font='700 15px sans-serif';ctx.fillText('SUPERFÍCIE · 0 m',left+24,48);ctx.restore();}
  drawFloor(ctx,left,right,bottom);
  drawFloorDetails(ctx,left,top,right,bottom,lowPower);
  drawRocks(ctx,left,top,right,bottom,lowPower);
  drawCaves(ctx,left,top,right,bottom);
  drawSediment(ctx,left,top,right,bottom,time,lowPower);
  drawAmbientHabitat(ctx,left,top,right,bottom,time,lowPower);
  drawBiomes(ctx,left,top,right,bottom,time,lowPower);
  drawDepthHaze(ctx,left,top,right,bottom);
  ctx.restore();
 }
 return Object.freeze({draw});
});