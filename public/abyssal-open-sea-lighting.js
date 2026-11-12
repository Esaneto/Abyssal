/* Open Sea helmet-mounted beam. Drawn after world sprites, in world coordinates.
 * Darkness comes from depth, not from mode-global screen filters.
 * Constant render cost, no global lighting textures or per-tile light simulation.
 */
(function(root,factory){
 const geo=typeof module==='object'&&module.exports?require('./abyssal-ocean-geography.js'):root.AbyssalOceanGeography;
 const api=factory(geo);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalOpenSeaLighting=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(geo){
 'use strict';
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 function parameters(depth=0,level=0){
  const safeDepth=clamp(Number(depth)||0,0,2200),lv=clamp(Math.floor(Number(level)||0),0,3);
  const darkness=clamp((safeDepth-75)/630,0,.97);
  return Object.freeze({depth:safeDepth,level:lv,darkness,range:310+lv*170,halfAngle:.30+lv*.055});
 }
 function draw(c,viewport={},player={},level=0,time=0,lowPower=false){
  if(!c||!geo||!Number.isFinite(player.x)||!Number.isFinite(player.y))return;
  const depth=geo.metersAt(player.y),lamp=parameters(depth,level);
  if(depth<15)return;
  const left=Number(viewport.left)||0,top=Number(viewport.top)||0;
  const w=Math.max(10,Number(viewport.width)||900),h=Math.max(10,Number(viewport.height)||600);
  const heading=Number.isFinite(player.bodyAngle)?player.bodyAngle:Number(player.angle)||0;
  const aim=Number.isFinite(player.bodyAngle)?player.bodyAngle:Number(player.angle)||0;
  const r=Number(player.r)||17,scale=r*.60/14;
  // Mounted beside the diver helmet, not attached to the rifle barrel.
  const hx=player.x+Math.cos(heading)*42*scale-Math.sin(heading)*(-9*scale);
  const hy=player.y+Math.sin(heading)*42*scale+Math.cos(heading)*(-9*scale);
  c.save();
  // Ambient attenuation, lifted near the diver so silhouettes remain readable.
  if(depth>=60){
   c.fillStyle='rgba(0,5,14,'+(lamp.darkness*.20).toFixed(3)+')';
   c.fillRect(left,top,w,h);
  }
  const len=lamp.range,arc=lamp.halfAngle;
  if(depth>=110){
   const dark=.28*clamp((depth-110)/540,0,1);
   // Even-odd clipping leaves a real illuminated sector in the darkness overlay.
   if(dark>.001){
    c.save();c.beginPath();c.rect(left,top,w,h);
    c.moveTo(hx,hy);
    const points=lowPower?12:28;
    for(let i=0;i<=points;i++){
     const a=aim-arc+2*arc*i/points;
     c.lineTo(hx+Math.cos(a)*len,hy+Math.sin(a)*len);
    }
    c.closePath();c.clip('evenodd');
    c.fillStyle='rgba(0,2,9,'+dark.toFixed(3)+')';c.fillRect(left,top,w,h);
    c.restore();
   }
  }
  // Concentrated crisp volumetric conical beam and subtle scattering
  c.save();c.beginPath();c.moveTo(hx,hy);
  const beamSegments=lowPower?16:32;
  for(let i=0;i<=beamSegments;i++){const a=aim-arc+i/beamSegments*arc*2;c.lineTo(hx+Math.cos(a)*len,hy+Math.sin(a)*len);}
  c.closePath();c.clip();
  const beam=c.createRadialGradient(hx,hy,3,hx,hy,len);
  const beamIntensity=depth<110?.24:(.30+.05*lamp.level);
  beam.addColorStop(0,'rgba(225,252,255,'+beamIntensity.toFixed(3)+')');
  beam.addColorStop(.32,'rgba(140,230,245,'+(beamIntensity*.62).toFixed(3)+')');
  beam.addColorStop(.68,'rgba(75,185,225,'+(beamIntensity*.22).toFixed(3)+')');
  beam.addColorStop(1,'rgba(30,120,180,0)');
  c.fillStyle=beam;c.fillRect(hx-len,hy-len,len*2,len*2);
  // Floating luminous motes caught in the beam
  if(!lowPower){
   for(let k=0;k<14;k++){
    const dist=30+((time*.014+k*37)%(len*.85));
    const spread=(Math.sin(k*1.9+time*.0012)*.72)*arc*(dist/len);
    const px=hx+Math.cos(aim+spread)*dist;
    const py=hy+Math.sin(aim+spread)*dist;
    const moteAlpha=(1-dist/len)*.55;
    c.fillStyle='rgba(215,252,255,'+moteAlpha.toFixed(2)+')';
    c.beginPath();c.arc(px,py,1+((k%3)*.4),0,Math.PI*2);c.fill();
   }
  }
  c.restore();

  // Glowing lamp lens on the helmet
  c.save();c.fillStyle='#ffffff';c.shadowColor='#7df9ff';c.shadowBlur=lowPower?3:12;
  c.beginPath();c.arc(hx,hy,Math.max(2,r*.13),0,Math.PI*2);c.fill();
  c.restore();
  c.restore();
 }
 return Object.freeze({parameters,draw});
});
