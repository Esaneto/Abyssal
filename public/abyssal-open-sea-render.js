/* Side-view ocean renderer: reads the same solid geometry as the server.
 * Cinematic 2D illustration style — angular geometric rocks, volumetric
 * god-rays, varied colorful vegetation, atmospheric depth haze.
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
 // Small painterly atlas from the approved visual direction. It is loaded
 // only for high-quality rendering, never on the map generation path.
 let basaltTexture=null,basaltTextureRequested=false;
 function rockMaterialFor(lowPower){
  if(lowPower||typeof Image!=='function')return null;
  if(!basaltTextureRequested){
   basaltTextureRequested=true;basaltTexture=new Image();
   basaltTexture.decoding='async';basaltTexture.src='abyssal-basalt-material.webp';
  }
  return basaltTexture?.complete&&basaltTexture.naturalWidth>=960?basaltTexture:null;
 }
 function seeded(a,b){const n=Math.sin(a*127.1+b*311.7)*43758.5453123;return n-Math.floor(n);}
 // ─── Cinematic Color Palettes ────────────────────────────────────────
 const ROCK_PALETTE={
  coastal:{
   faces:['#2e6982','#194b66','#0d314c','#061b30'],
   rim:'rgba(115,224,238,.58)',edge:'rgba(69,182,212,.38)',
   strata:'rgba(69,160,185,.20)',joint:'rgba(3,15,30,.29)',
   highlight:'rgba(135,228,242,.49)',vein:'rgba(68,178,213,.24)'
  },
  cinematic:{
   faces:['#3e7a8a','#275468','#122e41','#071a2d'],
   rim:'rgba(90,210,225,.55)',edge:'rgba(75,195,215,.42)',
   strata:'rgba(75,177,191,.22)',joint:'rgba(5,20,35,.28)',
   highlight:'rgba(120,220,235,.50)',vein:'rgba(60,185,200,.25)'
  },
  geological:{
   faces:['#3a5969','#264352','#102737','#071622'],
   rim:'rgba(105,180,170,.45)',edge:'rgba(90,160,155,.32)',
   strata:'rgba(95,160,149,.20)',joint:'rgba(3,14,22,.26)',
   highlight:'rgba(125,200,190,.42)',vein:'rgba(80,155,145,.20)'
  }
 };
 const CORAL_COLORS={
  pink:['#a85878','#c46888','#8a4a6a','#d07898'],
  orange:['#c88060','#d49468','#b87050','#daa478'],
  teal:['#508878','#4a9888','#3a7868','#5aaa90'],
  purple:['#7a6090','#8868a0','#685080','#9878b0']
 };
 // ─── Kelp — thick stems with alternating leaf blades ─────────────────
 function kelp(ctx,x,y,length,time,phase){
  ctx.save();ctx.translate(x,y);ctx.lineCap='round';
  const sway=Math.sin(time*.00055+phase)*Math.min(30,length*.21);
  // Thick dark stem
  ctx.strokeStyle='rgba(8,62,58,.92)';ctx.lineWidth=9;
  ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-18,-length*.28,16+sway,-length*.58,sway,-length);ctx.stroke();
  // Lighter inner stem
  ctx.strokeStyle='rgba(26,105,88,.72)';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-18,-length*.28,16+sway,-length*.58,sway,-length);ctx.stroke();
  // Alternating leaf blades — broader, more organic
  for(let i=1;i<=5;i++){
   const h=i/6*length,side=i%2?-1:1;
   const stemX=sway*(h/length),stemY=-h;
   const leafLen=32+seeded(i,phase*7)*28;
   const leafWave=Math.sin(time*.00048+phase+i*.7)*6;
   // Leaf stem
   ctx.strokeStyle=i%2?'rgba(48,138,115,.82)':'rgba(28,110,95,.80)';
   ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(stemX,stemY);
   ctx.quadraticCurveTo(stemX+side*(leafLen*.5),stemY-12+leafWave,stemX+side*leafLen,stemY-22+leafWave);ctx.stroke();
   // Broad leaf blade
   ctx.fillStyle=i%2?'rgba(50,140,110,.58)':'rgba(80,165,120,.52)';
   ctx.beginPath();
   ctx.moveTo(stemX+side*(leafLen*.3),stemY-8+leafWave);
   ctx.quadraticCurveTo(stemX+side*(leafLen*.7),stemY-28+leafWave,stemX+side*leafLen,stemY-22+leafWave);
   ctx.quadraticCurveTo(stemX+side*(leafLen*.8),stemY-6+leafWave,stemX+side*(leafLen*.4),stemY+2+leafWave);
   ctx.closePath();ctx.fill();
   // Second smaller leaf
   ctx.fillStyle=i%2?'rgba(66,148,108,.48)':'rgba(44,126,96,.44)';
   ctx.beginPath();ctx.ellipse(stemX+side*(leafLen*.45),stemY-16+leafWave,18,5.5,side*.5,0,TAU);ctx.fill();
  }
  // Tip frond
  ctx.fillStyle='rgba(58,148,105,.55)';
  ctx.beginPath();ctx.ellipse(sway,-length-8,7,16,0,0,TAU);ctx.fill();
  ctx.restore();
 }
 // ─── Coral — branching with pink/orange palette from reference ───────
 function coral(ctx,x,y,scale,phase){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';
  const family=phase<.25?CORAL_COLORS.pink:phase<.5?CORAL_COLORS.orange:phase<.75?CORAL_COLORS.teal:CORAL_COLORS.purple;
  const base=family[Math.floor(seeded(phase*17,3)*family.length)];
  const accent=family[(Math.floor(seeded(phase*17,3)*family.length)+1)%family.length];
  // Main branches
  ctx.strokeStyle=base;ctx.lineWidth=5.5;
  for(let branch=0;branch<6;branch++){
   const spread=(branch-2.5)*11,twist=Math.sin(phase*11+branch)*8;
   const height=42+seeded(branch,phase*13)*22;
   ctx.strokeStyle=branch%2?base:accent;ctx.lineWidth=5.5-branch*.4;
   ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(spread*.3,-height*.3,spread*.8+twist,-height*.65,spread+twist,-height);ctx.stroke();
   // Sub-branches
   for(let j=1;j<=2;j++){
    const q=j/3,bx=spread*q+twist*q,by=-height*q;
    const side=(branch+j)%2?1:-1;
    ctx.strokeStyle=accent;ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(bx,by);ctx.quadraticCurveTo(bx+side*14,by-8,bx+side*18+twist*.3,by-18-seeded(branch,j)*8);ctx.stroke();
    // Tip polyps
    ctx.fillStyle=accent;ctx.beginPath();ctx.arc(bx+side*18+twist*.3,by-18-seeded(branch,j)*8,2.8,0,TAU);ctx.fill();
   }
   // Main tip
   ctx.fillStyle=base;ctx.beginPath();ctx.arc(spread+twist,-height,3.5,0,TAU);ctx.fill();
  }
  // Base holdfast
  ctx.fillStyle='rgba(60,50,45,.72)';
  ctx.beginPath();ctx.ellipse(0,3,14,4,.1,0,TAU);ctx.fill();
  ctx.restore();
 }
 // ─── Seagrass cluster — bushy ground cover ──────────────────────────
 function seagrassCluster(ctx,x,y,scale,time,seed){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';
  const sway=Math.sin(time*.0005+seed*5)*4;
  const blades=7+Math.floor(seeded(seed,17)*6);
  for(let i=0;i<blades;i++){
   const spread=(i-blades/2)*5+seeded(i,seed)*4;
   const height=18+seeded(i,seed*7)*28;
   const wave=Math.sin(time*.00045+seed+i*.4)*3;
   ctx.strokeStyle=i%3===0?'rgba(42,105,80,.78)':'rgba(58,130,95,.72)';
   ctx.lineWidth=2.2+seeded(i,seed+3);
   ctx.beginPath();ctx.moveTo(spread*.3,0);
   ctx.quadraticCurveTo(spread+wave+sway,-height*.55,spread*1.3+wave+sway,-height);ctx.stroke();
  }
  ctx.restore();
 }
 // ─── Water — rich depth gradient + volumetric god-rays ──────────────
 function drawWater(ctx,left,top,right,bottom,time,lowPower){
  // Cinematic depth gradient
  const gradient=ctx.createLinearGradient(0,top,0,bottom);
  for(let k=0;k<=12;k++){
   const depth=geo.metersAt(top+(bottom-top)*k/12),p=clamp(depth/2200,0,1);
   const smooth=p*p*(3-2*p),twilight=clamp(depth/530,0,1);
   const red=Math.round(10-7*smooth);
   const green=Math.round(110*(1-twilight)+80*twilight-15*smooth);
   const blue=Math.round(155*(1-twilight)+140*twilight-20*smooth);
   gradient.addColorStop(k/12,'rgb('+red+','+Math.max(5,green)+','+Math.max(14,blue)+')');
  }
  ctx.fillStyle=gradient;ctx.fillRect(left,top,right-left,bottom-top);
  // Radial cyan glow sources — wider and softer
  if(geo.metersAt(top)<400){
   for(const sourceX of [1800,6700,12200,18400,22600]){
    if(sourceX+geo.HEIGHT*.4<left||sourceX-geo.HEIGHT*.4>right)continue;
    const sourceY=-geo.HEIGHT*.016;
    // Ambient ocean glow
    const opening=ctx.createRadialGradient(sourceX,210,50,sourceX,210,1400);
    opening.addColorStop(0,'rgba(50,210,240,.32)');
    opening.addColorStop(.35,'rgba(18,150,205,.15)');
    opening.addColorStop(1,'rgba(0,30,65,0)');
    ctx.fillStyle=opening;ctx.fillRect(left,top,right-left,bottom-top);
    const glow=ctx.createRadialGradient(sourceX,sourceY,80,sourceX,sourceY,geo.HEIGHT*.13);
    glow.addColorStop(0,'rgba(55,215,248,.52)');
    glow.addColorStop(.20,'rgba(25,170,235,.22)');
    glow.addColorStop(1,'rgba(6,70,136,0)');
    ctx.fillStyle=glow;ctx.fillRect(left,top,right-left,bottom-top);
    // ── Volumetric god-rays ── Wide, soft, animated
    const rayCount=lowPower?6:12;
    for(let i=-rayCount/2;i<=rayCount/2;i++){
     const start=sourceX+i*280,reach=geo.HEIGHT*.13;
     if(start+reach*.6<left||start-reach*.6>right)continue;
     const wobble=Math.sin(time*.00007+i*.53)*45;
     const width=65+seeded(Math.abs(i),31)*55;
     const spreadBot=reach*(.35+seeded(Math.abs(i)+5,19)*.25);
     const alpha=0.035+seeded(Math.abs(i),42)*.04;
     // Outer soft glow
     ctx.fillStyle='rgba(100,210,230,'+(.012+alpha*.3)+')';
     ctx.beginPath();ctx.moveTo(start-width*.6+wobble,-90);ctx.lineTo(start+width*.6+wobble,-90);
     ctx.lineTo(start+spreadBot*1.3+wobble,reach);ctx.lineTo(start-spreadBot*.3+wobble,reach);
     ctx.closePath();ctx.fill();
     // Inner bright core
     ctx.fillStyle='rgba(120,225,245,'+alpha+')';
     ctx.beginPath();ctx.moveTo(start-width*.25+wobble,-90);ctx.lineTo(start+width*.25+wobble,-90);
     ctx.lineTo(start+spreadBot*.7+wobble,reach);ctx.lineTo(start+spreadBot*.15+wobble,reach);
     ctx.closePath();ctx.fill();
    }
   }
  }
  // Surface caustics
  if(geo.metersAt(top)<240){
   const begin=Math.max(0,Math.floor(left/750)),end=Math.ceil(right/750);
   for(let i=begin;i<=end;i++){
    const x=i*750+seeded(i,3)*160,limit=clamp((200-geo.metersAt(top))/150,0,1);
    ctx.fillStyle='rgba(110,200,210,'+(.032*limit)+')';
    ctx.beginPath();ctx.moveTo(x,-20);ctx.lineTo(x+170,-20);ctx.lineTo(x+600,Math.min(bottom,geo.HEIGHT*200/2200));ctx.lineTo(x+450,Math.min(bottom,2000));ctx.closePath();ctx.fill();
   }
  }
  if(lowPower)return;
  // Ambient floating particles — subtle light motes
  const bx0=Math.floor(left/220),bx1=Math.ceil(right/220),by0=Math.floor(top/230),by1=Math.ceil(bottom/230);
  for(let bx=bx0;bx<=bx1;bx++)for(let by=by0;by<=by1;by++){
   if(seeded(bx,by)<.60)continue;
   const x=bx*220+seeded(bx+12,by)*180,y=by*230+seeded(bx,by+23)*190;
   const drift=Math.sin(time*.00018+bx*1.3)*3;
   const bob=Math.sin(time*.00025+by*.9)*2;
   const light=geo.lightAt(y);
   const alpha=.04+light*.11;
   ctx.fillStyle='rgba(155,218,215,'+alpha+')';
   ctx.beginPath();ctx.arc(x+drift,y+bob,.7+seeded(bx+4,by+8)*1.6,0,TAU);ctx.fill();
   // Occasional larger luminous mote
   if(seeded(bx+7,by+11)>.92){
    ctx.fillStyle='rgba(180,235,230,'+(.02+light*.06)+')';
    ctx.beginPath();ctx.arc(x+drift+8,y+bob-5,2+seeded(bx,by+5),0,TAU);ctx.fill();
   }
  }
 }

 // ─── Distant backdrop formations — atmospheric perspective ──────────
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
   ctx.save();ctx.globalAlpha=lowPower?.13:biome==='cinematic'?.32:biome==='coastal'?.26:.20;
   // Angular silhouette instead of rounded
   const shade=ctx.createLinearGradient(x-w,y-h,x+w,y+h*.5);
   shade.addColorStop(0,biome==='geological'?'#0f1f2e':biome==='cinematic'?'#0e4a62':'#145868');
   shade.addColorStop(1,biome==='geological'?'#060e18':biome==='cinematic'?'#071a2d':'#0a2a38');
   ctx.fillStyle=shade;
   ctx.beginPath();ctx.moveTo(x-w,y+h*.53);
   ctx.lineTo(x-w*.72,y-h*.38);ctx.lineTo(x-w*.45,y-h*.62);
   ctx.lineTo(x-w*.18,y-h*.78);ctx.lineTo(x+w*.15,y-h*.55);
   ctx.lineTo(x+w*.42,y-h*.72);ctx.lineTo(x+w*.68,y-h*.48);
   ctx.lineTo(x+w*.91,y+h*.49);ctx.closePath();ctx.fill();
   // Rim highlight on top edges
   if(!lowPower){
    ctx.strokeStyle=biome==='cinematic'?'rgba(80,195,210,.22)':'rgba(90,175,170,.18)';
    ctx.lineWidth=2;ctx.beginPath();
    ctx.moveTo(x-w*.72,y-h*.38);ctx.lineTo(x-w*.45,y-h*.62);
    ctx.lineTo(x-w*.18,y-h*.78);ctx.lineTo(x+w*.15,y-h*.55);
    ctx.lineTo(x+w*.42,y-h*.72);ctx.lineTo(x+w*.68,y-h*.48);ctx.stroke();
   }
   if(!lowPower&&biome==='cinematic'&&seed>.45){
    ctx.globalAlpha=.25;ctx.fillStyle='#0f4860';ctx.beginPath();
    ctx.moveTo(x-w*1.28,y+h*.55);ctx.lineTo(x-w*1.17,y-h*.15);
    ctx.bezierCurveTo(x-w*.95,y-h*1.13,x+w*.66,y-h*1.13,x+w*1.18,y-h*.14);
    ctx.lineTo(x+w*1.32,y+h*.55);ctx.lineTo(x+w*.89,y+h*.55);
    ctx.lineTo(x+w*.70,y-h*.10);
    ctx.bezierCurveTo(x+w*.25,y-h*.74,x-w*.45,y-h*.73,x-w*.69,y-h*.12);
    ctx.lineTo(x-w*.85,y+h*.55);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(85,200,210,.28)';ctx.lineWidth=2.5;ctx.beginPath();
    ctx.moveTo(x-w*1.17,y-h*.15);
    ctx.bezierCurveTo(x-w*.95,y-h*1.13,x+w*.66,y-h*1.13,x+w*1.18,y-h*.14);ctx.stroke();
    // School of silhouette fish swimming through arch aperture
    ctx.fillStyle='#061e2c';ctx.globalAlpha=.32;
    for(let f=0;f<8;f++){
     const fx=x-w*.22+f*14+Math.sin(time*.0007+f*1.3)*9;
     const fy=y-h*.24+Math.sin(f*1.1)*8;
     ctx.beginPath();ctx.ellipse(fx,fy,4,1.3,.08,0,TAU);ctx.fill();
     ctx.beginPath();ctx.moveTo(fx-3.5,fy);ctx.lineTo(fx-6.5,fy-2.2);ctx.lineTo(fx-6.5,fy+2.2);ctx.closePath();ctx.fill();
    }
   }else if(!lowPower&&biome==='coastal'&&seed>.48){
    ctx.globalAlpha=.47;ctx.fillStyle='#0c3755';ctx.beginPath();
    ctx.moveTo(x-w*1.15,y+h*.45);ctx.lineTo(x-w*.95,y-h*.10);
    ctx.bezierCurveTo(x-w*.75,y-h*.95,x+w*.55,y-h*.95,x+w*1.05,y-h*.08);
    ctx.lineTo(x+w*1.20,y+h*.45);ctx.lineTo(x+w*.78,y+h*.45);
    ctx.lineTo(x+w*.62,y-h*.06);
    ctx.bezierCurveTo(x+w*.20,y-h*.58,x-w*.38,y-h*.58,x-w*.58,y-h*.08);
    ctx.lineTo(x-w*.75,y+h*.45);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(110,229,237,.32)';ctx.lineWidth=2.2;ctx.beginPath();
    ctx.moveTo(x-w*.95,y-h*.10);
    ctx.bezierCurveTo(x-w*.75,y-h*.95,x+w*.55,y-h*.95,x+w*1.05,y-h*.08);ctx.stroke();
    // School of silhouette fish swimming through arch
    ctx.fillStyle='#082638';ctx.globalAlpha=.34;
    for(let f=0;f<7;f++){
     const fx=x-w*.18+f*12+Math.sin(time*.0008+f*1.4)*8;
     const fy=y-h*.18+Math.sin(f*1.2)*6;
     ctx.beginPath();ctx.ellipse(fx,fy,3.8,1.2,.05,0,TAU);ctx.fill();
     ctx.beginPath();ctx.moveTo(fx-3.2,fy);ctx.lineTo(fx-6,fy-2);ctx.lineTo(fx-6,fy+2);ctx.closePath();ctx.fill();
    }
   }else if(!lowPower&&biome==='geological'&&seed>.51){
    ctx.globalAlpha=.21;ctx.strokeStyle='rgba(100,195,180,.30)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x-w*.69,y+h*.32);
    ctx.lineTo(x-w*.32,y+h*.15);ctx.lineTo(x+w*.05,y+h*.19);
    ctx.lineTo(x+w*.35,y+h*.02);ctx.stroke();
   }
   ctx.restore();
  }
 }
 // ─── Biome vista walls — fractured cliff edges ─────────────────────
 // Fractured cliff edge instead of an uninterrupted vertical column
 function drawBiomeVista(ctx,left,top,right,bottom,time,lowPower){
  const tileX=730,tileY=670;
  // Painterly strata for distant rock, reusing the already-cached atlas.
  // Clipped to the painted vista and disabled on low-power devices.
  const distantMaterial=rockMaterialFor(lowPower);
  for(let ix=Math.floor(left/tileX)-1;ix<=Math.ceil(right/tileX)+1;ix++){
   for(let iy=Math.floor(top/tileY)-1;iy<=Math.ceil(bottom/tileY)+1;iy++){
    if(ix<0||iy<0)continue;
    const seed=seeded(ix*11+37,iy*19+5);
    if(seed<.27||(lowPower&&seed<.60))continue;
    const x=ix*tileX+210+seeded(ix+3,iy)*290;
    const y=iy*tileY+145+seeded(ix+19,iy+11)*330;
    if(y<50||y>geo.HEIGHT||x<0||x>geo.WIDTH)continue;
    const biome=geo.visualBiomeAt?.(x,y)?.id||'coastal';
    if(biome==='coastal')continue;
    const geological=biome==='geological';
    const w=(310+seed*230)*(geological?.86:1);
    const h=(190+seeded(ix,iy+17)*180)*(geological?1.14:1);
    // Limit atmospheric relief to a nearby distant ledge rather than
    // stretching decorative columns through the entire camera height.
    const foot=Math.max(y+h*.95,Math.min(geo.floorAt(x)+70,y+h*(1.65+seed*.32)));
    ctx.save();ctx.globalAlpha=lowPower?.19:geological?.37:.43;
    const shade=ctx.createLinearGradient(x,y-25,x,foot);
    if(geological){
     shade.addColorStop(0,'rgba(66,119,137,.95)');shade.addColorStop(.4,'rgba(31,80,98,.72)');shade.addColorStop(1,'rgba(7,26,38,0)');
    }else{
     shade.addColorStop(0,'rgba(56,139,164,.88)');shade.addColorStop(.42,'rgba(25,93,120,.63)');shade.addColorStop(1,'rgba(8,39,67,0)');
    }
    ctx.fillStyle=shade;ctx.strokeStyle=geological?'rgba(110,190,178,.48)':'rgba(95,205,218,.52)';
    ctx.lineWidth=2.5;ctx.beginPath();
    // More angular top edge
    ctx.moveTo(x-w*.58,y+15);ctx.lineTo(x-w*.46,y-14);
    ctx.lineTo(x-w*.28,y-28);ctx.lineTo(x-w*.08,y-36);
    ctx.lineTo(x+w*.14,y-24);ctx.lineTo(x+w*.32,y-31);
    ctx.lineTo(x+w*.55,y+7);
    ctx.lineTo(x+w*.44,y+h*.32);ctx.lineTo(x+w*.33,y+h*.67);
    ctx.lineTo(x+w*.39,y+h*.78);ctx.lineTo(x+w*.28,y+h*1.17);
    ctx.lineTo(x+w*.35,foot);ctx.lineTo(x-w*.34,foot+36);
    ctx.lineTo(x-w*.41,y+h*1.16);ctx.lineTo(x-w*.39,y+h*.67);
    ctx.lineTo(x-w*.54,y+h*.46);ctx.lineTo(x-w*.53,y+15);
    ctx.closePath();ctx.fill();ctx.stroke();
    if(distantMaterial){
     // The silhouette path remains active: no rectangular texture seams
     // and no additional solid world geometry or collision information.
     ctx.save();ctx.clip();
     ctx.globalAlpha=geological?.28:.36;
     ctx.globalCompositeOperation='soft-light';
     const tile=(ix+iy*7)&1;
     ctx.drawImage(distantMaterial,tile*480,0,480,320,
      x-w*.59,y-40,w*1.18,foot-y+76);
     ctx.restore();
    }
    // Interior face planes
    ctx.save();ctx.globalAlpha=.44;
    ctx.fillStyle=geological?'#133748':'#154a62';ctx.beginPath();
    ctx.moveTo(x-w*.08,y-36);ctx.lineTo(x+w*.14,y-24);
    ctx.lineTo(x+w*.05,y+h*.35);ctx.lineTo(x+w*.22,y+h*.65);
    ctx.lineTo(x+w*.13,foot);ctx.lineTo(x-w*.11,foot);
    ctx.lineTo(x-w*.25,y+h*.52);ctx.closePath();ctx.fill();
    ctx.restore();
    // A narrow sunlit bevel makes each cliff face read as a layered
    // rock plane instead of a flat vertical rectangle.
    if(!lowPower){
     ctx.save();ctx.globalAlpha=geological?.22:.29;
     const facet=ctx.createLinearGradient(x-w*.41,y,x+w*.32,foot);
     facet.addColorStop(0,'rgba(138,225,226,.31)');
     facet.addColorStop(.46,'rgba(53,128,161,.12)');
     facet.addColorStop(1,'rgba(4,25,46,0)');
     ctx.fillStyle=facet;ctx.beginPath();
     ctx.moveTo(x-w*.45,y+3);ctx.lineTo(x-w*.07,y-34);
     ctx.lineTo(x+w*.05,y+h*.33);ctx.lineTo(x-w*.24,y+h*.6);
     ctx.lineTo(x-w*.35,foot);ctx.closePath();ctx.fill();ctx.restore();
    }
    // Separate sandstone/basalt plates show up at gameplay camera scales
    ctx.save();ctx.globalAlpha=geological?.17:.22;
    for(let plate=0;plate<(lowPower?1:3);plate++){
     const shift=seeded(ix+plate*13,iy+9);
     const yy=y+h*(.17+plate*.38+shift*.09);
     const leftW=w*(.23+shift*.15);
     ctx.fillStyle=plate%2?(geological?'#436872':'#2a7488'):(geological?'#204a58':'#226478');
     ctx.beginPath();ctx.moveTo(x-leftW,yy);
     ctx.lineTo(x-w*.09,yy-11-shift*9);ctx.lineTo(x+w*.18,yy+6);
     ctx.lineTo(x+w*.13,yy+18);ctx.lineTo(x-w*.16,yy+27);
     ctx.closePath();ctx.fill();
    }
    ctx.restore();
    // Top edge rim highlight
    ctx.strokeStyle=geological?'rgba(115,195,185,.48)':'rgba(100,218,232,.52)';
    ctx.lineWidth=2.8;ctx.beginPath();ctx.moveTo(x-w*.46,y-14);
    ctx.lineTo(x-w*.28,y-28);ctx.lineTo(x-w*.08,y-36);
    ctx.lineTo(x+w*.14,y-24);ctx.lineTo(x+w*.32,y-31);ctx.stroke();
    // Strata lines
    ctx.strokeStyle=geological?'rgba(125,165,155,.18)':'rgba(70,172,185,.16)';
    ctx.lineWidth=1.8;ctx.beginPath();
    ctx.moveTo(x-w*.49,y+34);ctx.lineTo(x-w*.05,y+52);
    ctx.lineTo(x+w*.31,y+38);ctx.stroke();
    // Vegetation sprouts on ledges
    if(!lowPower){
     const sprouts=geological?3:5;
     for(let j=0;j<sprouts;j++){
      const xx=x+(j/(sprouts-1)-.5)*w*.73,yy=y-23+Math.sin(j*2.8+seed)*7;
      const ht=15+seeded(ix+j,iy+23)*26;
      ctx.strokeStyle=geological?'rgba(95,188,178,.65)':'rgba(90,196,168,.62)';
      ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(xx,yy);
      ctx.quadraticCurveTo(xx+7,yy-ht*.6,xx-4,yy-ht);ctx.stroke();
      ctx.fillStyle=geological?'rgba(115,195,180,.75)':'rgba(195,180,120,.70)';
      ctx.beginPath();ctx.ellipse(xx-4,yy-ht,4.2,2.5,0,0,TAU);ctx.fill();
     }
    }
    ctx.restore();
   }
  }
 }
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
    ctx.fillStyle='rgba(60,195,232,'+(lowPower?.023:.055)+')';
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
     ctx.fillStyle='rgba(105,208,195,'+(.06+seed*.05)+')';
     ctx.beginPath();ctx.arc(x+Math.sin(time*.00028+bx)*5,y,1.2+seed,0,TAU);ctx.fill();
    }
  }
 }

 // Deep geological water is nearly sunlight-free, but local bioluminescent
 // colonies reveal distant layers. Lights are camera-culled decorations only:
 // never introduce invisible geometry or change collision/navmesh.
 function drawGeologicalBacklight(ctx,left,top,right,bottom,time,lowPower){
  const tile=660;
  for(let tx=Math.floor(left/tile)-1;tx<=Math.ceil(right/tile)+1;tx++)
   for(let ty=Math.floor(top/tile)-1;ty<=Math.ceil(bottom/tile)+1;ty++){
    if(tx<0||ty<0)continue;
    const seed=seeded(tx*13+31,ty*17+5);
    if(seed<.40)continue;
    const x=tx*tile+seeded(tx+9,ty+4)*tile;
    const y=ty*tile+seeded(tx+5,ty+21)*tile;
    if(x<0||x>geo.WIDTH||y>geo.HEIGHT||
       geo.visualBiomeAt?.(x,y)?.id!=='geological')continue;
    const radius=lowPower?135:210+seed*110;
    const pulse=.80+.20*Math.sin(time*.00058+seed*TAU);
    const light=ctx.createRadialGradient(x,y,5,x,y,radius);
    light.addColorStop(0,'rgba(93,213,201,'+(.115*pulse).toFixed(3)+')');
    light.addColorStop(.29,'rgba(35,144,169,'+(.075*pulse).toFixed(3)+')');
    light.addColorStop(1,'rgba(9,63,100,0)');
    ctx.fillStyle=light;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
    if(lowPower)continue;
    // Tiny living colonies, deliberately not ore or collectible markers.
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<9;i++){
     const a=seeded(tx+i+7,ty+11)*TAU;
     const r=19+seeded(tx+19,ty+i)*radius*.46;
     const xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r*.57;
     ctx.fillStyle='rgba(145,229,213,'+(.13+.21*pulse).toFixed(3)+')';
     ctx.beginPath();ctx.arc(xx,yy,.7+seeded(tx+i,ty)*1.3,0,TAU);ctx.fill();
    }
    ctx.restore();
   }
 }
 // Sessile luminous colonies grow only on collision-backed basalt surfaces.
 // The bright buds give geological corridors readable depth without creating
 // fake platforms, occlusion, or interactive resource nodes.
 function drawDeepRockColonies(ctx,left,top,right,bottom,time,lowPower){
  if(lowPower)return;
  let visible=0;
  for(const rock of geo.ROCKS){
   if(visible>=14)break;
   if(rock.x+rock.rx<left-140||rock.x-rock.rx>right+140||
      rock.y+rock.ry<top-140||rock.y-rock.ry>bottom+140)continue;
   if(geo.visualBiomeAt?.(rock.x,rock.y)?.id!=='geological')continue;
   const seed=seeded(rock.x*.011+13,rock.y*.013+29);
   if(seed<.26)continue;
   for(let slot=0;slot<3&&visible<14;slot++){
    if(seeded(rock.x+slot*13,rock.y+7)<.37)continue;
    const angle=-2.45+slot*.83;
    const point=geo.rockSurfaceAt(rock,angle,3);
    if(point.x<left-90||point.x>right+90||
       point.y<top-90||point.y>bottom+90)continue;
    visible++;
    const cool=seeded(rock.y+slot*37,rock.x)<.72;
    const rgb=cool?'82,234,224':'174,154,244';
    const pulse=.86+.14*Math.sin(time*.001+seed*TAU+slot);
    const radius=72+seed*52;
    ctx.save();ctx.globalCompositeOperation='screen';
    const glow=ctx.createRadialGradient(point.x,point.y-10,2,point.x,point.y-10,radius);
    glow.addColorStop(0,'rgba('+rgb+','+(.29*pulse).toFixed(3)+')');
    glow.addColorStop(.36,'rgba('+rgb+','+(.115*pulse).toFixed(3)+')');
    glow.addColorStop(1,'rgba('+rgb+',0)');
    ctx.fillStyle=glow;
    ctx.fillRect(point.x-radius,point.y-radius-10,radius*2,radius*2);
    ctx.translate(point.x,point.y);
    for(let branch=0;branch<6;branch++){
     const spread=(branch-2.5)*9,reach=16+seeded(branch+7,rock.x+slot)*27;
     const tipX=spread+Math.sin(time*.00065+branch+seed*9)*4;
     const tipY=-reach;
     ctx.lineWidth=1.6+seeded(branch,rock.y)*1.1;
     ctx.strokeStyle='rgba('+rgb+','+(.34+.24*pulse).toFixed(3)+')';
     ctx.beginPath();ctx.moveTo(0,2);
     ctx.quadraticCurveTo(spread*.36,-reach*.57,tipX,tipY);ctx.stroke();
     ctx.fillStyle='rgba('+rgb+','+(.52+.40*pulse).toFixed(3)+')';
     ctx.beginPath();ctx.arc(tipX,tipY,2.3+seeded(branch,slot)*1.6,0,TAU);ctx.fill();
    }
    ctx.restore();
   }
  }
 }
 // ─── Depth haze — blue-tinted atmospheric fog ──────────────────────
 function drawDepthHaze(ctx,left,top,right,bottom){
  const depthTop=geo.metersAt(top),depthBottom=geo.metersAt(bottom);
  if(depthBottom<140)return;
  const veil=ctx.createLinearGradient(0,top,0,bottom);
  const attenuation=d=>clamp((d-140)/1450,0,.16);
  // Blue-tinted haze instead of pure darkness
  veil.addColorStop(0,'rgba(4,12,28,'+attenuation(depthTop).toFixed(3)+')');
  veil.addColorStop(1,'rgba(2,8,22,'+attenuation(depthBottom).toFixed(3)+')');
  ctx.fillStyle=veil;ctx.fillRect(left,top,right-left,bottom-top);
 }
 // ─── Crystal clusters — brighter cyan with specular highlights ─────
 function rockCrystals(ctx,x,y,seed,lowPower){
  ctx.save();ctx.translate(x,y);ctx.lineJoin='round';
  const count=lowPower?2:5;
  for(let i=0;i<count;i++){
   const xx=(i-Math.floor(count/2))*11,height=14+seeded(i+7,seed*21)*30;
   const width=5+seeded(i,seed)*3;
   // Crystal body
   ctx.fillStyle=i%3===0?'rgba(60,190,210,.72)':'rgba(75,215,230,.65)';
   ctx.strokeStyle=i%3===0?'rgba(140,235,245,.70)':'rgba(100,225,235,.62)';
   ctx.lineWidth=1.4;ctx.beginPath();
   ctx.moveTo(xx-width,5);ctx.lineTo(xx-width*.6,-height*.7);
   ctx.lineTo(xx,-height);ctx.lineTo(xx+width*.5,-height*.75);
   ctx.lineTo(xx+width,5);ctx.closePath();ctx.fill();ctx.stroke();
   // Specular highlight line
   ctx.strokeStyle='rgba(200,250,255,.45)';ctx.lineWidth=1.2;
   ctx.beginPath();ctx.moveTo(xx-width*.2,-height*.9);ctx.lineTo(xx-width*.1,3);ctx.stroke();
   // Light face
   ctx.fillStyle='rgba(130,240,250,.22)';ctx.beginPath();
   ctx.moveTo(xx-width*.6,-height*.7);ctx.lineTo(xx,-height);
   ctx.lineTo(xx-width*.1,3);ctx.lineTo(xx-width,5);ctx.closePath();ctx.fill();
  }
  // Base glow
  if(!lowPower){
   const glow=ctx.createRadialGradient(0,-10,2,0,0,25);
   glow.addColorStop(0,'rgba(80,220,240,.18)');glow.addColorStop(1,'rgba(80,220,240,0)');
   ctx.fillStyle=glow;ctx.fillRect(-30,-40,60,50);
  }
  ctx.restore();
 }
 function drawSediment(ctx,left,top,right,bottom,time,lowPower){
  const spacing=lowPower?165:110;
  for(let i=Math.floor(left/spacing);i<=Math.ceil(right/spacing);i++){
   const x=i*spacing+seeded(i,11)*spacing*.6,y=geo.floorAt(x);
   if(y<top-20||y>bottom+20)continue;
   const rough=seeded(i,51);
   ctx.save();ctx.strokeStyle='rgba(105,145,148,'+(.08+rough*.13)+')';ctx.lineWidth=1.5;
   for(let j=0;j<3;j++){const dx=(j-1)*19;ctx.beginPath();ctx.moveTo(x+dx-12,y+3+j*3);ctx.quadraticCurveTo(x+dx,y-4+j*3,x+dx+13,y+2+j*3);ctx.stroke();}
   // Small pebbles near floor
   if(!lowPower&&rough>.55){
    ctx.fillStyle='rgba(65,95,100,.32)';
    for(let k=0;k<3;k++){
     const px=x+(k-1)*14+seeded(i,k+31)*8,py=y+2+k*2;
     ctx.beginPath();ctx.ellipse(px,py,3+seeded(i,k)*3,1.8,.2,0,TAU);ctx.fill();
    }
   }
   if(!lowPower&&geo.metersAt(y)>400&&rough>.65){
    ctx.fillStyle='rgba(105,155,148,.20)';ctx.beginPath();ctx.ellipse(x+11,y-4,8+rough*8,2.2,0,0,TAU);ctx.fill();
   }
   ctx.restore();
  }
 }
 // ─── Floor — richer gradient with sediment texture ─────────────────
 function drawFloor(ctx,left,right,bottom){
  const start=Math.max(0,left-140),stop=Math.min(geo.WIDTH,right+140);
  const step=58;
  const floorDepth=geo.metersAt(geo.floorAt((start+stop)*.5));
  const coastal=floorDepth<245;
  const gradient=ctx.createLinearGradient(0,Math.min(geo.floorAt(start),geo.floorAt(stop))-220,0,bottom+600);
  if(coastal){
   gradient.addColorStop(0,'#276d82');gradient.addColorStop(.15,'#194e69');
   gradient.addColorStop(.35,'#10374f');gradient.addColorStop(.65,'#092338');
   gradient.addColorStop(1,'#04101f');
  }else{
   gradient.addColorStop(0,'#345666');gradient.addColorStop(.15,'#23414f');
   gradient.addColorStop(.35,'#142d3a');gradient.addColorStop(.65,'#0a1e2c');
   gradient.addColorStop(1,'#030d18');
  }
  ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(start,bottom+250);
  for(let x=start;x<=stop;x+=step)ctx.lineTo(x,geo.floorAt(x));
  ctx.lineTo(stop,geo.floorAt(stop));ctx.lineTo(stop,bottom+250);ctx.closePath();ctx.fill();
  // Sandy top contour
  ctx.strokeStyle='rgba(100,155,155,.16)';ctx.lineWidth=4;
  ctx.beginPath();for(let x=start,i=0;x<=stop+step;x+=step,i++){const px=Math.min(stop,x),y=geo.floorAt(px);if(!i)ctx.moveTo(px,y);else ctx.lineTo(px,y);}ctx.stroke();
  // Secondary geological contour
  ctx.strokeStyle='rgba(80,118,125,.12)';ctx.lineWidth=5;ctx.beginPath();
  for(let x=start,i=0;x<=stop+step;x+=step,i++){const px=Math.min(stop,x),y=geo.floorAt(px)+80+Math.sin(px*.007)*18;if(!i)ctx.moveTo(px,y);else ctx.lineTo(px,y);}ctx.stroke();
 }
 function drawFloorDetails(ctx,left,top,right,bottom,lowPower){
  const pitch=lowPower?190:125,start=Math.max(0,Math.floor(left/pitch)-1),end=Math.ceil(right/pitch)+1;
  for(let i=start;i<=end;i++){
   const x=i*pitch,y=geo.floorAt(x),depth=geo.metersAt(y);
   if(y<top-80||y>bottom+45)continue;
   const r=seeded(i,97),w=45+r*75;
   // Angular sediment patches
   ctx.fillStyle=depth>1200?'rgba(75,100,110,.22)':'rgba(72,122,128,.22)';
   ctx.beginPath();ctx.moveTo(x-w,y+11);
   ctx.lineTo(x-w*.42,y-5-r*5);ctx.lineTo(x-w*.08,y-8-r*4);
   ctx.lineTo(x+w*.38,y-3+r*6);ctx.lineTo(x+w,y+13);
   ctx.lineTo(x+w*.24,y+26);ctx.closePath();ctx.fill();
   // Shallow-water caustics reflect across real, collision-backed sediment.
   if(!lowPower&&depth<245&&r>.35){
    const wave=ctx.createLinearGradient(x-w,y-11,x+w,y+23);
    wave.addColorStop(0,'rgba(95,210,211,0)');
    wave.addColorStop(.45,'rgba(122,234,220,.22)');
    wave.addColorStop(1,'rgba(97,207,217,0)');
    ctx.strokeStyle=wave;ctx.lineWidth=1.6;
    ctx.beginPath();ctx.moveTo(x-w*.6,y+13);
    ctx.quadraticCurveTo(x-w*.10,y-6,x+w*.55,y+13);ctx.stroke();
   }
   // Highlight on top edge
   ctx.strokeStyle='rgba(90,150,155,.18)';ctx.lineWidth=1.5;
   ctx.beginPath();ctx.moveTo(x-w*.42,y-5);ctx.lineTo(x-w*.08,y-8-r*4);
   ctx.lineTo(x+w*.38,y-3);ctx.stroke();
   if(!lowPower&&r>.72){
    ctx.fillStyle='rgba(125,148,132,.22)';
    for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(x+(k-1)*13,y-4,2.4+k*.5,0,TAU);ctx.fill();}
   }
  }
 }
 // ─── ROCKS — Angular geometric faces with rim highlights ───────────
 function drawRocks(ctx,left,top,right,bottom,lowPower=false){
  const material=rockMaterialFor(lowPower);
  for(const rock of geo.ROCKS){
   if(rock.x+rock.rx+95<left||rock.x-rock.rx-95>right||rock.y+rock.ry+95<top||rock.y-rock.ry-95>bottom)continue;
   const lit=geo.lightAt(rock.y-rock.ry),seed=rock.x*.00031+rock.y*.00017;
   const province=geo.visualBiomeAt?.(rock.x,rock.y-rock.ry*.42)?.id||'coastal';
   const pal=ROCK_PALETTE[province]||ROCK_PALETTE.coastal;

   // ── Generate angular vertices ──
   const vertCount=lowPower?14:22;
   const verts=[];
   for(let k=0;k<vertCount;k++){
    // Quantize to create flat segments instead of smooth curves
    const baseAngle=k/vertCount*TAU;
    // Snap to create angular edges
    const snapAngle=Math.floor(baseAngle/(TAU/vertCount))*(TAU/vertCount)+TAU/(vertCount*2);
    const point=geo.rockSurfaceAt(rock,snapAngle);
    // Add angular perturbation for geometric feel
    const jitter=seeded(k+Math.floor(seed*100),rock.x*.01)*.04-.02;
    verts.push({
     x:point.x+(point.x-rock.x)*jitter,
     y:point.y+(point.y-rock.y)*jitter,
     angle:snapAngle
    });
   }

   // Extruded rear geology gives an actual directional depth cue to the
   // physical rock outline instead of painting a flat circle.
   const extrudeX=Math.min(28,rock.rx*.085),extrudeY=Math.min(33,rock.ry*.075);
   const sideShade=ctx.createLinearGradient(rock.x,rock.y,
    rock.x+extrudeX,rock.y+extrudeY);
   sideShade.addColorStop(0,'#0b2838');sideShade.addColorStop(1,'#041522');
   ctx.fillStyle=sideShade;ctx.beginPath();
   for(let k=0;k<verts.length;k++){
    const v=verts[k];if(!k)ctx.moveTo(v.x+extrudeX,v.y+extrudeY);
    else ctx.lineTo(v.x+extrudeX,v.y+extrudeY);
   }ctx.closePath();ctx.fill();
   ctx.strokeStyle='rgba(84,167,179,.18)';ctx.lineWidth=2;ctx.stroke();
   // ── Base fill with gradient ──
   const gradient=ctx.createLinearGradient(rock.x-rock.rx,rock.y-rock.ry,rock.x+rock.rx*.3,rock.y+rock.ry);
   gradient.addColorStop(0,lit>.12?pal.faces[0]:pal.faces[0]);
   gradient.addColorStop(.30,pal.faces[1]);
   gradient.addColorStop(.70,pal.faces[2]);
   gradient.addColorStop(1,pal.faces[3]);
   ctx.beginPath();
   for(let k=0;k<verts.length;k++){
    if(k===0)ctx.moveTo(verts[k].x,verts[k].y);else ctx.lineTo(verts[k].x,verts[k].y);
   }
   ctx.closePath();ctx.fillStyle=gradient;ctx.fill();

   // ── Outer edge stroke ──
   ctx.strokeStyle=pal.edge;ctx.lineWidth=2.4;ctx.stroke();

   ctx.save();ctx.clip();
   // Collision-backed rock polygons are the mask. The material adds a
   // painterly mineral/strata surface without placing fake solid obstacles.
   if(material){
    const texTile=Math.abs(Math.floor(seed*1709))%2;
    ctx.save();ctx.globalAlpha=province==='coastal'?.52:.38;
    ctx.globalCompositeOperation='soft-light';
    ctx.drawImage(material,texTile*480,0,480,320,
      rock.x-rock.rx,rock.y-rock.ry,rock.rx*2,rock.ry*2);
    ctx.restore();
   }
   // Localized natural rock illumination: highlights follow the actual
   // collision silhouette, while the core and bottom stay in shadow.
   const radial=ctx.createRadialGradient(
    rock.x-rock.rx*.35,rock.y-rock.ry*.65,rock.rx*.10,
    rock.x+rock.rx*.12,rock.y+rock.ry*.26,Math.max(rock.rx,rock.ry)*1.05);
   radial.addColorStop(0,province==='geological'?'rgba(111,167,166,.30)':
    province==='cinematic'?'rgba(80,197,217,.33)':'rgba(98,198,220,.31)');
   radial.addColorStop(.44,'rgba(62,126,139,.09)');
   radial.addColorStop(1,'rgba(2,10,23,.25)');
   ctx.fillStyle=radial;ctx.fillRect(rock.x-rock.rx-5,rock.y-rock.ry-5,
    rock.rx*2+10,rock.ry*2+10);

   // Collision-aligned faceted basalt relief. These strata live inside
   // the existing rock silhouette and cannot obstruct navigable passages.
   const reliefCount=lowPower?4:10;
   for(let facet=0;facet<reliefCount;facet++){
    const u=seeded(facet+rock.x*.019,rock.y*.011);
    const v=seeded(facet+rock.y*.023,rock.x*.031);
    const fx=rock.x+(u-.5)*rock.rx*1.68;
    const fy=rock.y+(v-.5)*rock.ry*1.46;
    const fw=rock.rx*(.08+seeded(facet,rock.x*.008)*.19);
    const fh=rock.ry*(.07+seeded(rock.y*.009,facet)*.15);
    const bright=fy<rock.y;
    const shade=ctx.createLinearGradient(fx-fw,fy-fh,fx+fw,fy+fh);
    shade.addColorStop(0,bright?'rgba(96,183,194,.37)':'rgba(29,83,105,.27)');
    shade.addColorStop(.47,bright?'rgba(40,115,143,.26)':'rgba(9,41,65,.29)');
    shade.addColorStop(1,'rgba(1,12,28,.41)');
    ctx.fillStyle=shade;ctx.beginPath();
    ctx.moveTo(fx-fw,fy-fh*.12);ctx.lineTo(fx-fw*.38,fy-fh);
    ctx.lineTo(fx+fw*.53,fy-fh*.65);ctx.lineTo(fx+fw,fy+fh*.21);
    ctx.lineTo(fx+fw*.04,fy+fh);ctx.lineTo(fx-fw*.72,fy+fh*.51);
    ctx.closePath();ctx.fill();
    if(!lowPower&&facet%2===0){
     ctx.strokeStyle=bright?'rgba(139,233,232,.34)':'rgba(92,165,190,.15)';
     ctx.lineWidth=1.25;ctx.beginPath();ctx.moveTo(fx-fw,fy-fh*.12);
     ctx.lineTo(fx-fw*.38,fy-fh);ctx.lineTo(fx+fw*.53,fy-fh*.65);ctx.stroke();
    }
   }
   const strataLines=lowPower?3:6;
   for(let plate=0;plate<strataLines;plate++){
    const q=(plate+.35)/(strataLines+.2);
    const y=rock.y-rock.ry+rock.ry*2*q;
    const noise=seeded(plate+11,rock.x*.027);
    const leftX=rock.x-rock.rx*(.84-noise*.18);
    const rightX=rock.x+rock.rx*(.39+noise*.30);
    ctx.fillStyle=plate%2===0?'rgba(2,23,39,.13)':'rgba(56,119,132,.08)';
    ctx.beginPath();ctx.moveTo(leftX,y+13);
    ctx.lineTo(rock.x-rock.rx*.14,y-17);
    ctx.lineTo(rightX,y+3);
    ctx.lineTo(rightX-rock.rx*.17,y+18);
    ctx.lineTo(leftX+rock.rx*.10,y+32);ctx.closePath();ctx.fill();
    ctx.strokeStyle=pal.strata;ctx.lineWidth=1.8;
    ctx.beginPath();ctx.moveTo(leftX,y+13);
    ctx.lineTo(rock.x-rock.rx*.14,y-17);
    ctx.lineTo(rightX,y+3);ctx.stroke();
   }

   // ── Geometric face planes — distinct shading per face ──
   const faces=Math.min(lowPower?12:30,Math.max(6,Math.ceil(rock.ry/100)));
   for(let j=0;j<faces;j++){
    const px=rock.x+(seeded(rock.x*.017+j,rock.y*.001)-.5)*rock.rx*1.6;
    const py=rock.y+(seeded(rock.y*.013+j,rock.x*.004)-.5)*rock.ry*1.7;
    const wx=rock.rx*(.18+seeded(j,rock.x*.01)*.28);
    const wy=Math.min(280,rock.ry*(.12+seeded(j,rock.y*.01)*.20));
    // Determine if top-facing or side-facing by position
    const relY=(py-rock.y)/rock.ry; // -1=top, +1=bottom
    const faceAlpha=relY<-.2?.38:.22; // Top faces are brighter
    const faceColor=relY<-.3?pal.faces[0]:relY<0?pal.faces[1]:relY<.4?pal.faces[2]:pal.faces[3];
    ctx.fillStyle=faceColor;ctx.globalAlpha=faceAlpha;
    // Angular polygon for face
    ctx.beginPath();
    ctx.moveTo(px-wx,py-wy*.15);
    ctx.lineTo(px-wx*.25,py-wy);
    ctx.lineTo(px+wx*.78,py-wy*.28);
    ctx.lineTo(px+wx,py+wy*.48);
    ctx.lineTo(px-wx*.28,py+wy);
    ctx.closePath();ctx.fill();
    // Face edge highlight
    if(!lowPower&&j%3===0){
     ctx.globalAlpha=.20;
     ctx.strokeStyle=pal.highlight;ctx.lineWidth=1.5;
     ctx.beginPath();ctx.moveTo(px-wx,py-wy*.15);
     ctx.lineTo(px-wx*.25,py-wy);ctx.lineTo(px+wx*.78,py-wy*.28);ctx.stroke();
    }
   }
   ctx.globalAlpha=1;

   // Grazing edge lighting gently follows the cliff curvature. No large blur
   // or dynamic texture is created outside the camera viewport.
   if(!lowPower){
    ctx.save();ctx.globalCompositeOperation='screen';
    ctx.strokeStyle=province==='geological'?'rgba(100,196,182,.14)':
     province==='cinematic'?'rgba(101,214,232,.22)':'rgba(169,227,204,.18)';
    ctx.lineWidth=8;ctx.beginPath();
    for(let k=0;k<=24;k++){const q=-1+k/12;
     const pt=geo.rockSurfaceAt(rock,-Math.acos(q));
     if(!k)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);
    }ctx.stroke();ctx.restore();
   }
   // ── Bright upper rim highlight ──
   ctx.strokeStyle=pal.rim;ctx.lineWidth=lowPower?2.8:4;ctx.beginPath();
   const rimSteps=lowPower?18:32;
   for(let k=0;k<=rimSteps;k++){
    const q=-1+(k/rimSteps)*2;
    const pt=geo.rockSurfaceAt(rock,-Math.acos(q));
    if(!k)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);
   }ctx.stroke();

   // ── Stratification lines — broken joints ──
   const layers=rock.type==='spire'?7:rock.type==='boulder'?3:5;
   for(let k=0;k<layers;k++){
    const v=(k+1)/(layers+1),y=rock.y-rock.ry+v*rock.ry*2;
    const wave=Math.sin(seed*7+k*1.81)*rock.ry*.06;
    ctx.strokeStyle=k%2?pal.strata:pal.joint;
    ctx.lineWidth=2+k%3;ctx.beginPath();
    ctx.moveTo(rock.x-rock.rx-35,y+wave);
    ctx.bezierCurveTo(rock.x-rock.rx*.37,y-18,rock.x+rock.rx*.32,y+24,rock.x+rock.rx+25,y+wave);
    ctx.stroke();
   }
   // Diagonal fracture lines
   for(let k=0;k<(lowPower?3:7);k++){
    const x=rock.x+(seeded(rock.x,k+9)-.5)*rock.rx*1.7;
    const y=rock.y+(seeded(rock.y,k+2)-.5)*rock.ry*1.5;
    ctx.strokeStyle=pal.joint;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x-20,y-25);ctx.lineTo(x+4,y+10);ctx.lineTo(x+13,y+27);ctx.stroke();
   }
   // ── Biome-specific detail ──
   const visual=geo.visualBiomeAt?.(rock.x,rock.y-rock.ry*.4)?.id||'coastal';
   if(visual==='geological'){
    for(let j=0;j<(lowPower?2:5);j++){
     const yy=rock.y-rock.ry*.65+j*rock.ry*.29;
     ctx.strokeStyle=j%2?'rgba(90,155,145,.22)':'rgba(190,148,95,.18)';ctx.lineWidth=3+j%2;
     ctx.beginPath();ctx.moveTo(rock.x-rock.rx*.79,yy);ctx.lineTo(rock.x-rock.rx*.30,yy+13);
     ctx.lineTo(rock.x+rock.rx*.19,yy-21);ctx.lineTo(rock.x+rock.rx*.73,yy+8);ctx.stroke();
    }
   }else if(visual==='cinematic'){
    ctx.strokeStyle='rgba(50,172,188,.18)';ctx.lineWidth=3.5;ctx.beginPath();
    ctx.moveTo(rock.x-rock.rx*.8,rock.y-rock.ry*.6);
    ctx.quadraticCurveTo(rock.x,rock.y-rock.ry*.76,rock.x+rock.rx*.7,rock.y-rock.ry*.48);ctx.stroke();
   }
   // Crystal insets & spires on rock ledges across depth provinces
   const crystalAllowed=visual==='geological'||(visual==='coastal'&&seeded(rock.x,19)>.32)||(visual==='cinematic'&&seeded(rock.x,23)>.30);
   if(crystalAllowed){
    for(let j=0;j<(lowPower?1:3);j++){
     const q=-.5+j*.52,pt=geo.rockSurfaceAt(rock,-Math.acos(q));
     if(pt.y>=top-80&&pt.y<=bottom+80&&seeded(j,rock.x)>.21)
      rockCrystals(ctx,pt.x,pt.y+7,seeded(j+2,rock.y),lowPower);
    }
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
   for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1],b=nodes[i],r=Math.min(a.r,b.r),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    const nx=-dy/len,ny=dx/len,centerY=(a.y+b.y)*.5,light=geo.lightAt(centerY);
    const water=ctx.createLinearGradient(0,centerY-r,0,centerY+r);
    water.addColorStop(0,'rgba(3,28,44,'+(.72-light*.12)+')');
    water.addColorStop(.5,'rgba(3,20,36,.90)');water.addColorStop(1,'rgba(2,14,26,.95)');
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
    // Cave edge highlight
    ctx.strokeStyle='rgba(55,85,95,.14)';ctx.lineWidth=5;ctx.stroke();
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
 // ─── Tube sponges — golden yellow & coral reference palette ─────────
 function tubeSponges(ctx,x,y,scale,seed){
  const tones=seed>.35?['#d97706','#f59e0b','#fbbf24','#fcd34d']:['#986878','#a87080','#a27580','#b88890'];
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';
  for(let j=0;j<6;j++){
   const xx=(j-2.5)*17,hh=25+seeded(j,seed)*54,rr=4+seeded(seed,j+6)*5;
   ctx.strokeStyle=tones[(j+Math.floor(seed*4))%tones.length];ctx.lineWidth=rr*2.0;
   ctx.beginPath();ctx.moveTo(xx*.43,0);ctx.quadraticCurveTo(xx-8,-hh*.61,xx,-hh);ctx.stroke();
   ctx.strokeStyle='rgba(8,18,32,.86)';ctx.lineWidth=rr*.95;ctx.beginPath();ctx.ellipse(xx,-hh,rr,2.2,0,0,TAU);ctx.stroke();
   ctx.strokeStyle='rgba(255,235,180,.32)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(xx-rr,-hh+4);ctx.lineTo(xx-rr+3,-hh*.42);ctx.stroke();
  }
  ctx.restore();
 }
 // ─── Bioluminescent bulb stalks (from reference lower-left) ─────────
 function bioluminescentBulbs(ctx,x,y,scale,seed,lowPower){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';
  const stalks=3+Math.floor(seeded(seed,11)*3);
  for(let i=0;i<stalks;i++){
   const sx=(i-(stalks-1)/2)*9+seeded(i,seed)*5;
   const h=20+seeded(i,seed*7)*24;
   const curve=(seeded(i,seed*13)-.5)*12;
   ctx.strokeStyle='rgba(10,32,44,.85)';ctx.lineWidth=1.8;
   ctx.beginPath();ctx.moveTo(sx*.4,0);
   ctx.quadraticCurveTo(sx+curve,-h*.5,sx+curve*1.4,-h);ctx.stroke();
   const bx=sx+curve*1.4,by=-h;
   if(!lowPower){
    const glow=ctx.createRadialGradient(bx,by,1,bx,by,8);
    glow.addColorStop(0,'rgba(80,240,250,.65)');
    glow.addColorStop(.4,'rgba(34,211,238,.28)');
    glow.addColorStop(1,'rgba(34,211,238,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(bx,by,8,0,TAU);ctx.fill();
   }
   ctx.fillStyle='#e0fcff';ctx.beginPath();ctx.arc(bx,by,2.6,0,TAU);ctx.fill();
   ctx.fillStyle='#38bdf8';ctx.beginPath();ctx.arc(bx,by,1.8,0,TAU);ctx.fill();
  }
  ctx.restore();
 }
 function seaFan(ctx,x,y,scale,seed){
  const colors=['#4a6880','#6a6888','#4a8890','#7a5878'];
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
  const color=seed>.5?'#52d8f0':'#a085f8';
  ctx.strokeStyle=color;ctx.lineWidth=2.8;ctx.lineCap='round';
  if(!lowPower){ctx.shadowColor=color;ctx.shadowBlur=14;}
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
   ctx.strokeStyle=i%2?'rgba(105,198,195,.72)':'rgba(180,155,108,.62)';ctx.lineWidth=2.5;
   ctx.beginPath();ctx.moveTo(px,0);ctx.quadraticCurveTo(px+8,-h*.58,px-5,-h);ctx.stroke();
   ctx.fillStyle=i%2?'rgba(118,220,225,.82)':'rgba(212,188,122,.74)';
   ctx.beginPath();ctx.ellipse(px-5,-h,4.5,2.7,-.15,0,TAU);ctx.fill();
  }ctx.restore();
 }
 function drawRockMineralVein(ctx,x,y,seed,lowPower){
  ctx.save();ctx.translate(x,y);ctx.lineJoin='round';
  ctx.strokeStyle='rgba(60,125,130,.42)';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(-26,3);ctx.lineTo(-11,-7);ctx.lineTo(0,-3);ctx.lineTo(9,-17);ctx.lineTo(26,-11);ctx.stroke();
  for(let i=0;i<(lowPower?2:4);i++){
   const px=-21+i*13,py=-2-(i%2)*8,size=3.2+seeded(i,seed)*4;
   ctx.fillStyle=i%3===0?'rgba(185,150,98,.67)':'rgba(62,155,162,.56)';
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
  if(type==='kelp'){if(geo.metersAt(y)<210)kelp(ctx,x,y,105+seed*140,time,seed*TAU);return;}
  if(type==='reef'&&geo.metersAt(y)<215){
   if(seed<.20)tubeSponges(ctx,x,y,.62+seed,seed);
   else if(seed<.42)seaFan(ctx,x,y,.57+seed*.7,seed);
   else if(seed<.64)coral(ctx,x,y,.7+seed*.7,seed);
   else if(seed<.82)seagrassCluster(ctx,x,y,.65+seed*.5,time,seed);
   else bioluminescentBulbs(ctx,x,y,.75+seed*.4,seed,lowPower);
  }else if(type==='rocks'||type==='canyon'){
   if(geo.metersAt(y)<420&&seed>.46)tubeSponges(ctx,x,y,.50+seed*.52,seed);
   else if(geo.metersAt(y)<230&&seed<.25&&!lowPower)seaFan(ctx,x,y,.38+seed*.45,seed);
   else if(!lowPower&&geo.metersAt(y)>230&&geo.metersAt(y)<1700&&seed>.78){ctx.save();ctx.globalAlpha=.39;seaFan(ctx,x,y,.38+seed*.35,seed);ctx.restore();}
  }else if(type==='abyss'&&!lowPower&&seed>.62){
   glowAnemone(ctx,x,y,.42+seed*.38,seed,lowPower);
  }
 }
 function danglingPlants(ctx,x,y,length,time,seed){
  ctx.save();ctx.lineCap='round';
  const motion=Math.sin(time*.00047+seed)*Math.min(18,length*.19);
  ctx.strokeStyle='rgba(6,28,38,.83)';ctx.lineWidth=4+seeded(seed,3)*5;
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
    const r=8+seed*16;ctx.fillStyle='rgba(38,65,70,.62)';ctx.beginPath();ctx.ellipse(0,0,r*1.7,r*.72,seed*2.4,0,TAU);ctx.fill();
    if(seed>.50)rockGarden(ctx,0,3,geo.classify(x,y),seed,time,lowPower,geo.visualBiomeAt?.(x,y)?.id);
   }else if(seed>.78&&!lowPower){
    ctx.fillStyle='rgba(92,142,140,.12)';ctx.beginPath();ctx.ellipse(0,0,2.3+seed*2,1.1,seed*3,0,TAU);ctx.fill();
   }
   ctx.restore();
  }
 }
 function drawBiomes(ctx,left,top,right,bottom,time,lowPower){
  const step=lowPower?240:180;
  const start=Math.max(0,Math.floor(left/step)-1),end=Math.min(Math.ceil(geo.WIDTH/step),Math.ceil(right/step)+1);
  for(let i=start;i<=end;i++){
   const x=i*step+seeded(i,1)*48,y=geo.floorAt(x)-5;
   if(y<top-320||y>bottom+40)continue;
   const rand=seeded(i,7),type=geo.classify(x,y-110);
   if(rand>(geo.visualBiomeAt?.(x,y)?.id==='coastal'?.15:.38)){
    ctx.save();ctx.translate(x,y);
    const size=.78+rand*.65;ctx.scale(size,size);
    rockGarden(ctx,0,0,type,rand,time,lowPower,geo.visualBiomeAt?.(x,y)?.id);
    ctx.restore();
   }
  }
  for(const rock of geo.ROCKS){
   if(rock.x+rock.rx+140<left||rock.x-rock.rx-140>right||rock.y+rock.ry+220<top||rock.y-rock.ry-290>bottom)continue;
   const province=geo.visualBiomeAt?.(rock.x,rock.y-rock.ry*.45)?.id||'coastal';
   const n=lowPower?3:province==='coastal'?9:province==='cinematic'?8:6;
   for(let i=0;i<n;i++){
    const q=(i+.5)/n*1.72-.86,place=geo.rockSurfaceAt(rock,-Math.acos(q),0);
    const x=place.x,y=place.y,seed=seeded(rock.x,i+19);
    if(seed>(province==='coastal'?.25:.38)){
     ctx.save();ctx.translate(x,y);
     const plantSize=.65+seeded(i,rock.x*.03)*.75;
     ctx.scale(plantSize,plantSize);
     rockGarden(ctx,0,0,geo.classify(x,y-10),seed,time,lowPower,province);
     if(!lowPower&&province==='coastal'&&i%4===1)seaFan(ctx,19,0,.33+seed*.27,seed);
     ctx.restore();
    }
    if(rock.type==='overhang'||rock.type!=='spire'&&i%2===0&&!lowPower){
     const underside=geo.rockSurfaceAt(rock,Math.acos(q),0).y;
     if(rock.type==='overhang'&&seed>.12&&geo.metersAt(underside)<450){
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
 // ─── Surface vegetation ────────────────────────────────────────────
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
   ctx.strokeStyle='rgba(24,98,80,.76)';ctx.lineWidth=3.2;
   ctx.beginPath();ctx.moveTo(-stretch,0);
   ctx.bezierCurveTo(-stretch*.48,8,stretch*.27,-6,stretch,3);ctx.stroke();
   const leaves=lowPower?3:8;
   for(let k=0;k<leaves;k++){
    const u=leaves===1?0:k/(leaves-1),xx=(u*2-1)*stretch;
    const yy=2+Math.sin(u*6+i)*3,side=k%2===0?1:-1;
    const len=10+seeded(i,k+19)*19;
    ctx.strokeStyle=k%3?'rgba(52,138,102,.83)':'rgba(82,158,108,.83)';
    ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(xx,yy);
    ctx.quadraticCurveTo(xx+side*len*.55,yy+len*.52,xx+side*len*.4,yy+len);ctx.stroke();
    ctx.fillStyle='rgba(85,150,92,.56)';ctx.beginPath();
    ctx.ellipse(xx+side*len*.5,yy+len*.7,5,2.5,side*.4,0,TAU);ctx.fill();
   }
   ctx.restore();
  }
 }
 function drawSky(ctx,left,top,right,time){
  if(top>=0)return;
  const sky=ctx.createLinearGradient(0,top,0,0);
  sky.addColorStop(0,'#152e45');sky.addColorStop(1,'#6a8a98');
  ctx.fillStyle=sky;ctx.fillRect(left,top,right-left,-top);
  if(top<-15){const horizon=ctx.createLinearGradient(0,-28,0,3);horizon.addColorStop(0,'rgba(145,188,192,0)');horizon.addColorStop(1,'rgba(178,218,220,.28)');ctx.fillStyle=horizon;ctx.fillRect(left,-28,right-left,28);}
 }
 // ─── Main entry point ──────────────────────────────────────────────
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
  globalThis.AbyssalCinematicArt?.seaAtmosphere?.(ctx,{left,top,width:right-left,height:bottom-top},time,lowPower,geo);
  drawProvinceBackdrop(ctx,left,top,right,bottom,time,lowPower);
  drawBiomeVista(ctx,left,top,right,bottom,time,lowPower);
  drawProvinceLight(ctx,left,top,right,bottom,time,lowPower);
  drawGeologicalBacklight(ctx,left,top,right,bottom,time,lowPower);
  drawSurfaceVegetation(ctx,left,top,right,bottom,time,lowPower);
  if(top<130){ctx.save();ctx.strokeStyle='rgba(155,235,252,.68)';ctx.lineWidth=2.4;ctx.beginPath();for(let x=Math.floor(left/28)*28,j=0;x<=right+28;x+=28,j++){const yy=18+Math.sin(x*.006+time*.0007)*3.8+Math.sin(x*.017-time*.0011)*1.6;if(j===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();ctx.fillStyle='rgba(185,242,252,.88)';ctx.font='700 15px sans-serif';ctx.fillText('SUPERFÍCIE · 0 m',left+24,48);ctx.restore();}
  drawFloor(ctx,left,right,bottom);
  drawFloorDetails(ctx,left,top,right,bottom,lowPower);
  drawRocks(ctx,left,top,right,bottom,lowPower);
  drawDeepRockColonies(ctx,left,top,right,bottom,time,lowPower);
  drawCaves(ctx,left,top,right,bottom);
  drawSediment(ctx,left,top,right,bottom,time,lowPower);
  drawAmbientHabitat(ctx,left,top,right,bottom,time,lowPower);
  drawBiomes(ctx,left,top,right,bottom,time,lowPower);
  globalThis.AbyssalCinematicArt?.seaHighlights?.(ctx,{left,top,width:right-left,height:bottom-top},time,lowPower,geo);
  drawDepthHaze(ctx,left,top,right,bottom);
  ctx.restore();
 }
 return Object.freeze({draw});
});
