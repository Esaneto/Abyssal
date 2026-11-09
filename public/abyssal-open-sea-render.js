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
  ctx.strokeStyle='rgba(29,134,95,.75)';ctx.lineWidth=7;
  ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-22,-length*.32,20+sway,-length*.64,sway,-length);ctx.stroke();
  for(let i=1;i<=4;i++){
   const h=i/5*length,side=i%2?-1:1;
   ctx.strokeStyle=i%2?'rgba(57,176,112,.65)':'rgba(37,147,111,.66)';
   ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(sway*(h/length),-h);ctx.quadraticCurveTo(side*35,-h-19,side*58+sway*.65,-h-45);ctx.stroke();
  }
  ctx.restore();
 }
 function coral(ctx,x,y,scale,phase){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';
  const colors=['#527f77','#4a9b94','#bf8579','#7ba3a0'],color=colors[Math.floor(phase*colors.length)];
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
  gradient.addColorStop(0,'rgba(8,49,72,'+(1-light)*.44+')');
  gradient.addColorStop(1,'rgba(0,4,18,'+clamp(.24+(1-dark)*.70,.24,.9)+')');
  ctx.fillStyle=gradient;ctx.fillRect(left,top,right-left,bottom-top);
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
   g.addColorStop(0,'#395561');g.addColorStop(.32,'#223b48');g.addColorStop(.72,'#0d1f2e');g.addColorStop(1,'#06111d');
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
 function drawBiomes(ctx,left,top,right,bottom,time,lowPower){
  const start=Math.max(0,Math.floor(left/150)-1),end=Math.min(Math.ceil(geo.WIDTH/150),Math.ceil(right/150)+1);
  for(let i=start;i<=end;i++){
   const x=i*150+seeded(i,1)*70,y=geo.floorAt(x)-5;
   if(y<top-180||y>bottom+40)continue;
   const rand=seeded(i,7),type=geo.classify(x,y-110);
   if(type==='reef'&&rand>.20)coral(ctx,x,y,.65+rand*.95,rand);
   else if(type==='kelp'&&rand>.18)kelp(ctx,x,y,95+rand*155,time,rand*TAU);
   else if((type==='rocks'||type==='canyon')&&rand>.68){
    ctx.fillStyle='rgba(80,123,125,.5)';ctx.beginPath();ctx.ellipse(x,y-13,19+rand*18,14,0,0,TAU);ctx.fill();
   }else if(type==='abyss'&&rand>.75&&!lowPower){
    ctx.fillStyle='rgba(82,152,164,.28)';ctx.beginPath();ctx.arc(x,y-23,10,0,TAU);ctx.fill();
   }
  }
 }
 const WHALES=[
  {x:5100,y:1260,drift:1000,size:1.05},
  {x:11800,y:2400,drift:1500,size:1.3},
  {x:18500,y:1820,drift:1100,size:.88}
 ];
 function drawWhales(ctx,left,top,right,bottom,time){
  // Distant silhouettes are ambience, not spawned enemies or invisible collision.
  for(const w of WHALES){
   const center=w.x+Math.sin(time*.000065+w.y)*w.drift,y=w.y+Math.sin(time*.00021+w.x)*92;
   if(center+650<left||center-650>right||y+260<top||y-260>bottom)continue;
   ctx.save();ctx.translate(center,y);ctx.scale(350*w.size,125*w.size);
   ctx.globalAlpha=.19+geo.lightAt(y)*.15;ctx.fillStyle='#203e50';
   ctx.beginPath();ctx.moveTo(-1.0,0);ctx.bezierCurveTo(-.6,-.5,.35,-.44,.86,-.1);ctx.quadraticCurveTo(1.16,.05,.80,.22);
   ctx.bezierCurveTo(.1,.53,-.6,.35,-1.0,0);ctx.fill();
   ctx.beginPath();ctx.moveTo(-.91,0);ctx.lineTo(-1.45,-.38);ctx.lineTo(-1.35,.02);ctx.lineTo(-1.45,.4);ctx.closePath();ctx.fill();
   ctx.beginPath();ctx.moveTo(-.1,.16);ctx.lineTo(.28,.76);ctx.lineTo(.32,.22);ctx.closePath();ctx.fill();
   ctx.restore();
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
  drawWhales(ctx,left,top,right,bottom,time);
  drawFloor(ctx,left,right,bottom);
  drawRocks(ctx,left,top,right,bottom);
  drawCaves(ctx,left,top,right,bottom);
  drawBiomes(ctx,left,top,right,bottom,time,lowPower);
  ctx.restore();
 }
 return Object.freeze({draw});
});