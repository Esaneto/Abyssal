/* Abyssal diver default: original side-swimming, pressure-resistant cyan dive suit.
 * Shared renderer for gameplay, profile portrait and navigable menu.
 * Body orientation follows swimming velocity; only the mounted weapon tracks aim.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalDiverArt=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 function genderOf(v){return v==='female'?'female':'male';}
 function muzzle(x,y,r,aim){
  const d=(Number(r)||13)/14*46;
  return {x:(Number(x)||0)+Math.cos(Number(aim)||0)*d,y:(Number(y)||0)+Math.sin(Number(aim)||0)*d};
 }
 function draw(c,x,y,r,heading,aim,t=0,options={}){
  if(!c||!(r>0))return;
  const female=genderOf(options.gender)==='female';
  const swim=options.moving===false?0:Math.sin((Number(t)||0)*.011);
  const scale=r/14;
  c.save();c.translate(x,y);c.rotate(Number(heading)||0);c.scale(scale,scale);
  c.lineJoin='round';c.lineCap='round';
  // Rear fins: large, separate and animated like real long-blade freediving fins.
  for(const side of [-1,1]){
   const swing=swim*side*4;
   c.save();c.translate(-16,side*6);c.rotate((side*.10)+swim*.035);
   c.strokeStyle='#78f6ff';c.lineWidth=2.2;
   c.fillStyle='#082c57';c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-12,side*3,-21,side*5);c.lineTo(-25,side*(7+swing));c.lineTo(-10,side*10);c.closePath();c.fill();c.stroke();
   c.fillStyle='#0bc5f5';c.shadowBlur=8;c.shadowColor='#1bd9ff';
   c.beginPath();c.moveTo(-23,side*5);c.quadraticCurveTo(-34,side*(6+swing),-45,side*(11+swing));c.quadraticCurveTo(-51,side*(15+swing),-59,side*(12+swing));
   c.quadraticCurveTo(-55,side*(2+swing),-47,side*(1+swing));
   c.quadraticCurveTo(-37,side*(-1+swing),-24,side*2);c.closePath();c.fill();c.stroke();
   c.shadowBlur=0;c.strokeStyle='rgba(219,255,255,.75)';c.lineWidth=.7;
   c.beginPath();c.moveTo(-27,side*4);c.quadraticCurveTo(-40,side*(6+swing),-53,side*(10+swing));c.stroke();
   c.restore();
  }
  // Back-mounted compressed atmosphere capsule and armoured connectors.
  c.fillStyle='#091d3b';c.strokeStyle='#1be8ff';c.lineWidth=1.6;
  c.beginPath();c.roundRect(-14,-19,34,12,6);c.fill();c.stroke();
  const tank=c.createLinearGradient(-12,-17,14,-10);tank.addColorStop(0,'#073762');tank.addColorStop(.42,'#279cdb');tank.addColorStop(.8,'#8af6ff');tank.addColorStop(1,'#0b3b66');
  c.fillStyle=tank;c.beginPath();c.roundRect(-10,-18,28,10,4);c.fill();
  c.strokeStyle='#c6ffff';c.lineWidth=2;c.beginPath();c.moveTo(-5,-19);c.lineTo(-5,-8);c.moveTo(11,-19);c.lineTo(11,-8);c.stroke();
  // Hidrodynamic luminous body, same anatomical silhouette for both genders.
  const suit=c.createLinearGradient(-15,-10,24,12);suit.addColorStop(0,'#0c5794');suit.addColorStop(.30,'#0b94d9');suit.addColorStop(.58,'#21d9ff');suit.addColorStop(1,'#072b67');
  c.fillStyle=suit;c.strokeStyle='#9ffaff';c.lineWidth=1.5;
  c.shadowColor='rgba(13,202,255,.6)';c.shadowBlur=10;
  c.beginPath();c.moveTo(-18,-6);c.bezierCurveTo(-9,-13,9,-11,20,-6);c.quadraticCurveTo(28,0,20,7);
  c.bezierCurveTo(7,13,-8,11,-18,5);c.quadraticCurveTo(-22,-1,-18,-6);c.closePath();c.fill();c.stroke();c.shadowBlur=0;
  c.strokeStyle='#dbffff';c.lineWidth=.8;c.beginPath();c.moveTo(-10,-8);c.bezierCurveTo(0,-3,8,-5,16,-7);c.stroke();
  c.fillStyle='#07345c';c.strokeStyle='#6eeeff';c.lineWidth=1.2;
  c.beginPath();c.roundRect(-8,7,15,4,2);c.fill();c.stroke();
  // Oxygen tubes wrapping forward from cylinder into helmet.
  c.strokeStyle='rgba(168,245,255,.85)';c.lineWidth=1.45;
  c.beginPath();c.moveTo(13,-12);c.bezierCurveTo(26,-18,37,-12,34,0);c.stroke();
  // Cylindrical pressure helmet with high-contrast visor, always facing swim heading.
  const helm=c.createRadialGradient(25,-4,2,27,0,17);
  helm.addColorStop(0,'#3ddaff');helm.addColorStop(.42,'#067abf');helm.addColorStop(1,'#032a58');
  c.fillStyle=helm;c.strokeStyle='#a4fbff';c.lineWidth=2.1;c.shadowBlur=10;c.shadowColor='#28d7ff';
  c.beginPath();c.ellipse(26,-1,15,13,0,0,TAU);c.fill();c.stroke();c.shadowBlur=0;
  const glass=c.createLinearGradient(23,-10,42,9);glass.addColorStop(0,'#e7ffff');glass.addColorStop(.3,'#62eaff');glass.addColorStop(.72,'#086ca3');glass.addColorStop(1,'#021a3a');
  c.fillStyle=glass;c.beginPath();c.ellipse(32,-1,9,8,-.02,0,TAU);c.fill();
  c.strokeStyle='rgba(242,255,255,.9)';c.lineWidth=1.5;c.beginPath();c.arc(32,-2,7,Math.PI*1.12,Math.PI*1.55);c.stroke();
  c.fillStyle='#ffecaa';c.shadowColor='#ffe27c';c.shadowBlur=7;c.beginPath();c.arc(15,6,1.8,0,TAU);c.fill();c.shadowBlur=0;
  // Long hair is the only visual difference, loose strands flow aft in water.
  if(female){
   c.strokeStyle='#091944';c.lineWidth=6;c.beginPath();c.moveTo(15,-11);c.bezierCurveTo(6,-21,-6,-20,-24,-24+swim);c.stroke();
   const strands=['#79ebff','#1589d0','#40c6f8','#6cf6ff'];
   strands.forEach((color,i)=>{
    c.strokeStyle=color;c.lineWidth=i===0?2.4:1.7;c.shadowColor=color;c.shadowBlur=3;
    c.beginPath();c.moveTo(15-i*.7,-11-i*.4);
    c.bezierCurveTo(3,-17-i*2,-12,-25+i*2+swim*2,-25-i*4,-22+i*2+swim*3);
    c.bezierCurveTo(-35-i*4,-18+i*3,-38-i*4,-30+i*2,-47-i*3,-24+i*3+swim*4);c.stroke();
   });c.shadowBlur=0;
  }
  // Futuristic rifle aims independently; body never rotates toward mouse.
  c.save();c.rotate((Number(aim)||0)-(Number(heading)||0));
  c.strokeStyle='#64e6f6';c.fillStyle='#06365e';c.lineWidth=2;
  c.beginPath();c.moveTo(7,8);c.lineTo(17,8);c.lineTo(22,3);c.stroke();
  const weapon=c.createLinearGradient(18,-5,44,6);weapon.addColorStop(0,'#122544');weapon.addColorStop(.45,'#127cc7');weapon.addColorStop(1,'#75faff');
  c.fillStyle=weapon;c.strokeStyle='#b2ffff';c.lineWidth=1.5;c.shadowColor='#50efff';c.shadowBlur=8;
  c.beginPath();c.moveTo(14,-6);c.lineTo(34,-7);c.lineTo(41,-3);c.lineTo(41,3);c.lineTo(31,7);c.lineTo(14,6);c.closePath();c.fill();c.stroke();
  c.fillStyle='#061c35';c.fillRect(36,-3,10,6);
  c.fillStyle='#a5ffff';c.fillRect(40,-2,6,4);
  c.fillStyle='#d9fdff';c.shadowBlur=6;c.beginPath();c.arc(46,0,2.2,0,TAU);c.fill();c.shadowBlur=0;
  c.restore();
  c.restore();
 }
 return Object.freeze({draw,muzzle,genderOf});
});