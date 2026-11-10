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
  const darkness=clamp((safeDepth-75)/630,0,.94);
  return Object.freeze({depth:safeDepth,level:lv,darkness,range:310+lv*170,halfAngle:.30+lv*.055});
 }
 function draw(c,viewport={},player={},level=0,time=0,lowPower=false){
  if(!c||!geo||!Number.isFinite(player.x)||!Number.isFinite(player.y))return;
  const depth=geo.metersAt(player.y),lamp=parameters(depth,level);
  if(depth<60)return;
  const left=Number(viewport.left)||0,top=Number(viewport.top)||0;
  const w=Math.max(10,Number(viewport.width)||900),h=Math.max(10,Number(viewport.height)||600);
  const heading=Number.isFinite(player.bodyAngle)?player.bodyAngle:Number(player.angle)||0;
  const aim=Number.isFinite(player.weaponAngle)?player.weaponAngle:Number(player.angle)||0;
  const r=Number(player.r)||17,scale=r*.60/14;
  // Mounted beside the diver helmet, not attached to the rifle barrel.
  const hx=player.x+Math.cos(heading)*42*scale-Math.sin(heading)*(-9*scale);
  const hy=player.y+Math.sin(heading)*42*scale+Math.cos(heading)*(-9*scale);
  c.save();
  // Ambient attenuation, lifted near the diver so silhouettes remain readable.
  c.fillStyle='rgba(0,5,14,'+(lamp.darkness*.14).toFixed(3)+')';
  c.fillRect(left,top,w,h);
  const len=lamp.range,arc=lamp.halfAngle;
  if(depth>=110){
   const dark=.19*clamp((depth-110)/540,0,1);
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
   // Concentrated warm-white LED reflection and subtle plankton scattering.
   c.save();c.beginPath();c.moveTo(hx,hy);
   for(let i=0;i<=16;i++){const a=aim-arc+i/16*arc*2;c.lineTo(hx+Math.cos(a)*len,hy+Math.sin(a)*len);}
   c.closePath();c.clip();
   const beam=c.createRadialGradient(hx,hy,4,hx,hy,len);
   beam.addColorStop(0,'rgba(205,243,232,'+(.13+.045*lamp.level).toFixed(3)+')');
   beam.addColorStop(.57,'rgba(140,198,203,.045)');beam.addColorStop(1,'rgba(100,152,186,0)');
   c.fillStyle=beam;c.fillRect(hx-len,hy-len,len*2,len*2);c.restore();
  }
  // Small visible lamp lens on the helmet. Stable in the helmet/body reference frame.
  c.fillStyle='#dafaf0';c.shadowColor='#9cffee';c.shadowBlur=lowPower?0:7;
  c.beginPath();c.arc(hx,hy,Math.max(1.5,r*.1),0,Math.PI*2);c.fill();
  c.restore();
 }
 return Object.freeze({parameters,draw});
});
