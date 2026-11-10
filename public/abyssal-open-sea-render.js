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
  ctx.restore();
 }
 function coral(ctx,x,y,scale,phase){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';
  const colors=['#76d2ee','#9280e2','#ec967e','#58c8b4','#6487cb','#a773b1'],color=colors[Math.floor(phase*colors.length)];
  ctx.strokeStyle=color;ctx.lineWidth=5;
  for(let branch=0;branch<5;branch++){
   const spread=(branch-2)*10,twist=Math.sin(phase*11+branch)*9;
   ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(spread*.7,-21,spread+twist,-55);ctx.stroke();
   ctx.beginPath();ctx.moveTo(spread*.53,-31);ctx.lineTo(spread+twist+11,-43);ctx.stroke();
  }
  ctx.restore();
 }
 function drawWater(ctx,left,top,right,bottom,time,lowPower){
  const gradient=ctx.createLinearGradient(0,top,0,bottom);
  const light=geo.lightAt(top),dark=geo.lightAt(bottom);
  gradient.addColorStop(0,'rgba(6,50,91,'+(0.21+(1-light)*.48)+')');
  gradient.addColorStop(1,'rgba(0,5,21,'+clamp(.21+(1-dark)*.77,.21,.98)+')');
  ctx.fillStyle=gradient;ctx.fillRect(left,top,right-left,bottom-top);
  // The distant cyan opening is anchored in world space. No screen-sized repeating wallpaper.
  if(top<geo.HEIGHT*.43){
   for(const sourceX of [1800,6700,12200,18400,22600]){
   if(sourceX+geo.HEIGHT*.4<left||sourceX-geo.HEIGHT*.4>right)continue;
   const sourceY=-geo.HEIGHT*.016;
   // Smaller turquoise openings interrupt broad dark reef silhouettes.
   const opening=ctx.createRadialGradient(sourceX,260,40,sourceX,260,1650);
   opening.addColorStop(0,'rgba(58,225,255,.30)');
   opening.addColorStop(.42,'rgba(15,143,199,.13)');
   opening.addColorStop(1,'rgba(0,30,65,0)');
   ctx.fillStyle=opening;ctx.fillRect(left,top,right-left,bottom-top);
   const glow=ctx.createRadialGradient(sourceX,sourceY,60,sourceX,sourceY,geo.HEIGHT*.37);
   glow.addColorStop(0,'rgba(58,219,252,.49)');
   glow.addColorStop(.22,'rgba(20,165,231,.20)');
   glow.addColorStop(1,'rgba(6,70,136,0)');
   ctx.fillStyle=glow;ctx.fillRect(left,top,right-left,bottom-top);
   if(!lowPower){
    for(let i=-8;i<=8;i++){
     const start=sourceX+i*330,reach=geo.HEIGHT*.36;
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
  if(top<2400){
   const begin=Math.max(0,Math.floor(left/750)),end=Math.ceil(right/750);
   for(let i=begin;i<=end;i++){
    const x=i*750+seeded(i,3)*160,limit=clamp((2450-top)/1400,0,1);
    ctx.fillStyle='rgba(120,206,203,'+(.028*limit)+')';
    ctx.beginPath();ctx.moveTo(x,-20);ctx.lineTo(x+170,-20);ctx.lineTo(x+600,Math.min(bottom,2000));ctx.lineTo(x+450,Math.min(bottom,2000));ctx.closePath();ctx.fill();
   }
  }
  if(lowPower)return;
  // Sparse suspended plankton: camera-culled, deterministic, no network traffic.
  const bx0=Math.floor(left/250),bx1=Math.ceil(right/250),by0=Math.floor(top/260),by1=Math.ceil(bottom/260);
  for(let bx=bx0;bx<=bx1;bx++)for(let by=by0;by<=by1;by++){
   if(seeded(bx,by)<.65)continue;
   const x=bx*250+seeded(bx+12,by)*200,y=by*260+seeded(bx,by+23)*210;
   ctx.fillStyle='rgba(152,213,209,'+(.05+geo.lightAt(y)*.11)+')';
   ctx.beginPath();ctx.arc(x,y,.8+seeded(bx+4,by+8)*1.4,0,TAU);ctx.fill();
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
  ctx.strokeStyle='rgba(96,149,151,.32)';ctx.lineWidth=5;
  ctx.beginPath();for(let x=start,i=0;x<=stop+step;x+=step,i++){const px=Math.min(stop,x),y=geo.floorAt(px);if(!i)ctx.moveTo(px,y);else ctx.lineTo(px,y);}ctx.stroke();
  // A secondary geological contour suggests stratification without per-pixel noise.
  ctx.strokeStyle='rgba(89,120,130,.1)';ctx.lineWidth=5;ctx.beginPath();
  for(let x=start,i=0;x<=stop+step;x+=step,i++){const px=Math.min(stop,x),y=geo.floorAt(px)+80+Math.sin(px*.007)*18;if(!i)ctx.moveTo(px,y);else ctx.lineTo(px,y);}ctx.stroke();
 }
 function drawRocks(ctx,left,top,right,bottom){
  for(const rock of geo.ROCKS){
   if(rock.x+rock.rx+90<left||rock.x-rock.rx-90>right||rock.y+rock.ry+90<top||rock.y-rock.ry-90>bottom)continue;
   const g=ctx.createLinearGradient(rock.x-rock.rx,rock.y-rock.ry,rock.x+rock.rx,rock.y+rock.ry);
   g.addColorStop(0,'#416878');g.addColorStop(.32,'#274253');g.addColorStop(.72,'#0a1d2d');g.addColorStop(1,'#030917');
   ctx.beginPath();
   for(let i=0;i<=44;i++){
    const a=i/44*TAU,rx=rock.rx*(.963+.027*Math.sin(6*a+rock.x)),ry=rock.ry*(.968+.026*Math.cos(7*a+rock.y));
    const x=rock.x+Math.cos(a)*rx,y=rock.y+Math.sin(a)*ry;
    if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
   ctx.closePath();ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='rgba(92,150,158,.26)';ctx.lineWidth=5;ctx.stroke();
   // Sedimentary striae follow the rock body, not arbitrary floating sprites.
   ctx.strokeStyle='rgba(114,174,176,.12)';ctx.lineWidth=3;
   for(let i=1;i<=3;i++){
    ctx.beginPath();ctx.ellipse(rock.x,rock.y+rock.ry*(i-2)*.22,rock.rx*.74,rock.ry*(.30+i*.075),0,Math.PI*.14,Math.PI*.86);ctx.stroke();
   }
  }
 }
 function drawCaves(ctx,left,top,right,bottom){
  const entries=geo.CAVES.map(c=>c.nodes).concat(geo.ARCH_TUNNELS.map(t=>[{x:t.ax,y:t.ay,r:t.r},{x:t.bx,y:t.by,r:t.r}]));
  for(const nodes of entries){
   const x0=Math.min(...nodes.map(n=>n.x)),x1=Math.max(...nodes.map(n=>n.x)),y0=Math.min(...nodes.map(n=>n.y)),y1=Math.max(...nodes.map(n=>n.y));
   if(x1+280<left||x0-280>right||y1+280<top||y0-280>bottom)continue;
   ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
   // Dark freshwater-looking cavern water reveals the excavated solid passages.
   for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1],b=nodes[i],r=Math.min(a.r,b.r);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
    ctx.strokeStyle='rgba(78,125,131,.27)';ctx.lineWidth=r*2+19;ctx.stroke();
    ctx.strokeStyle='#071624';ctx.lineWidth=r*2;ctx.stroke();
    ctx.strokeStyle='rgba(18,48,63,.8)';ctx.lineWidth=r*1.8;ctx.stroke();
   }
   ctx.restore();
  }
 }

 function tubeSponges(ctx,x,y,scale,seed){
  const tones=['#a37b9c','#bd8d9e','#b794a4','#d0a096'];
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
  const colors=['#597ddb','#865ed1','#43c8cb','#a85d9b'];
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
 function rockGarden(ctx,x,y,type,seed,time,lowPower){
  if(type==='kelp'){kelp(ctx,x,y,120+seed*180,time,seed*TAU);return;}
  if(type==='reef'){
   if(seed<.31)tubeSponges(ctx,x,y,.62+seed,seed);
   else if(seed<.70)seaFan(ctx,x,y,.57+seed*.7,seed);
   else coral(ctx,x,y,.7+seed*.7,seed);
  }else if(type==='rocks'||type==='canyon'){
   if(seed>.46)tubeSponges(ctx,x,y,.50+seed*.52,seed);
   else if(seed<.25&&!lowPower)seaFan(ctx,x,y,.38+seed*.45,seed);
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
  function drawBiomes(ctx,left,top,right,bottom,time,lowPower){
  // Vegetation grows only on geological supports, never as floating random icons.
  const step=lowPower?150:105;
  const start=Math.max(0,Math.floor(left/step)-1),end=Math.min(Math.ceil(geo.WIDTH/step),Math.ceil(right/step)+1);
  for(let i=start;i<=end;i++){
   const x=i*step+seeded(i,1)*48,y=geo.floorAt(x)-5;
   if(y<top-320||y>bottom+40)continue;
   const rand=seeded(i,7),type=geo.classify(x,y-110);
   if(rand>.13)rockGarden(ctx,x,y,type,rand,time,lowPower);
  }
  for(const rock of geo.ROCKS){
   if(rock.x+rock.rx+140<left||rock.x-rock.rx-140>right||rock.y+rock.ry+220<top||rock.y-rock.ry-290>bottom)continue;
   const n=lowPower?5:rock.type==='overhang'?20:12;
   for(let i=0;i<n;i++){
    const q=(i+.5)/n*1.72-.86,x=rock.x+q*rock.rx;
    const y=rock.y-rock.ry*Math.sqrt(Math.max(0,1-q*q)),seed=seeded(rock.x,i+19);
    if(seed>.16)rockGarden(ctx,x,y,rock.y<geo.HEIGHT*.53?'reef':'rocks',seed,time,lowPower);
    if(rock.type==='overhang'||rock.type!=='spire'&&i%2===0&&!lowPower){
     const underside=rock.y+rock.ry*Math.sqrt(Math.max(0,1-q*q));
     if(rock.type==='overhang'&&seed>.12){
      // Multiple asymmetric biological silhouettes, not identical hanging brushes.
      const form=seeded(rock.x+i*7,29);
      ctx.save();ctx.translate(x,underside+3);ctx.scale(1,-1);
      if(form<.26)kelp(ctx,0,0,105+seed*155,time,seed*TAU);
      else if(form<.51)tubeSponges(ctx,0,0,.46+seed*.62,seed);
      else if(form<.79)seaFan(ctx,0,0,.42+seed*.72,seed);
      else coral(ctx,0,0,.62+seed*.58,seed);
      ctx.restore();
     }
     if(!lowPower&&i%2===0)danglingPlants(ctx,x,underside,55+seed*185,time,seed+i);
    }
   }
  }
 }
 function draw(ctx,viewport={},time=0,lowPower=false){
  if(!ctx||!geo)return;
  const left=clamp(Number(viewport.left)||0,0,geo.WIDTH),top=clamp(Number(viewport.top)||0,0,geo.HEIGHT);
  const right=clamp(left+Math.max(10,Number(viewport.width)||1200),0,geo.WIDTH);
  const bottom=clamp(top+Math.max(10,Number(viewport.height)||700),0,geo.HEIGHT);
  if(right<=left||bottom<=top)return;
  ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
  drawWater(ctx,left,top,right,bottom,time,lowPower);
  drawFloor(ctx,left,right,bottom);
  drawRocks(ctx,left,top,right,bottom);
  drawCaves(ctx,left,top,right,bottom);
  drawBiomes(ctx,left,top,right,bottom,time,lowPower);
  ctx.restore();
 }
 return Object.freeze({draw});
});