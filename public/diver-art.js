/* Abyssal default high-pressure diver. Anatomical human: articulated legs,
 * long flippers, restrained navy/black armour, and a white aimed rifle.
 * Rendering and segmented collision use the same local coordinate system.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalDiverArt=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2,DRAW_SCALE=.60,BARREL_TIP_X=69,GUN_OFFSET_Y=12;
 const genderOf=value=>value==='female'?'female':'male';
 function muzzle(x,y,r,aim){
  const distance=(Number(r)||13)*DRAW_SCALE*BARREL_TIP_X/14;
  const angle=Number(aim)||0;
  const below=(Number(r)||13)*DRAW_SCALE*GUN_OFFSET_Y/14;
  return {x:(Number(x)||0)+Math.cos(angle)*distance-Math.sin(angle)*below,y:(Number(y)||0)+Math.sin(angle)*distance+Math.cos(angle)*below};
 }
 function draw(c,x,y,r,heading,aim,t=0,options={}){
  if(!c||!(r>0))return;
  const female=genderOf(options.gender)==='female',a=Number(heading)||0;
  const swimming=options.moving!==false;
  const phase=(Number(t)||0)*.008;
  const cycle=swimming?Math.sin(phase):0;
  c.save();c.translate(x,y);c.rotate(a);c.scale(r*DRAW_SCALE/14,r*DRAW_SCALE/14);
  c.lineJoin='round';c.lineCap='round';
  const line=(ax,ay,bx,by,color,width)=>{c.beginPath();c.strokeStyle=color;c.lineWidth=width;c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();};
  const limb=(start,end,thickness,base,glow)=>{
   line(start[0],start[1],end[0],end[1],'#060e19',thickness+3);
   line(start[0],start[1],end[0],end[1],base,thickness);
   line(start[0],start[1]-1,end[0],end[1]-1,glow,1);
  };
  // Two HUMAN upper legs and calves, independently kicking. Only the flipper
  // blade starts at the ankle; no anatomical fish tail or dorsal body fins.
  for(const side of [-1,1]){
   // Flutter kick starts in the hips. Opposite legs move in anti-phase;
   // knees flex lightly, ankles follow with a delayed hydrodynamic wave.
   const beat=swimming?Math.sin(phase+(side===1?0:Math.PI)):0;
   const follow=swimming?Math.sin(phase-.62+(side===1?0:Math.PI)):0;
   const hip=[-16,side*5.5];
   const knee=[-34,side*(7.5+beat*4.5)];
   const ankle=[-53,side*(8+follow*8)];
   limb(hip,knee,7.8,'#202a38','#40617a');
   c.fillStyle='#030c14';c.strokeStyle='#6d899d';c.lineWidth=1;
   c.beginPath();c.arc(knee[0],knee[1],3.4,0,TAU);c.fill();c.stroke();
   limb(knee,ankle,6,'#162532','#2b5b75');
   const finSwing=swimming?Math.sin(phase-1.05+(side===1?0:Math.PI))*5:0;
   c.fillStyle='#101b29';c.strokeStyle='#79b9ce';c.lineWidth=1.4;
   c.beginPath();c.moveTo(ankle[0]+1,ankle[1]-3*side);
   c.quadraticCurveTo(-64,ankle[1]-5*side,-77,ankle[1]+finSwing-7*side);
   c.quadraticCurveTo(-82,ankle[1]+finSwing,-78,ankle[1]+finSwing+7*side);
   c.quadraticCurveTo(-65,ankle[1]+5*side,ankle[0],ankle[1]+3*side);
   c.closePath();c.fill();c.stroke();
   line(-57,ankle[1],-76,ankle[1]+finSwing,'rgba(168,206,217,.56)',.8);
  }
  // Armoured oxygen pack is behind the shoulders, not a second silhouette.
  c.fillStyle='#0c151e';c.strokeStyle='#7e9da9';c.lineWidth=1.5;
  c.beginPath();c.roundRect(-13,-20,32,12,5);c.fill();c.stroke();
  c.fillStyle='#394653';c.beginPath();c.roundRect(-8,-19,24,10,4);c.fill();
  c.fillStyle='#0b253b';c.fillRect(5,-18,6,8);
  line(-4,-18,-4,-8,'#a7c3ca',1.8);
  line(12,-18,12,-8,'#a7c3ca',1.8);
  // Black/graphite diving suit with deep abyss-blue armour and small cyan nodes.
  const suit=c.createLinearGradient(-20,-10,24,11);
  suit.addColorStop(0,'#040c16');suit.addColorStop(.33,'#1c2834');
  suit.addColorStop(.59,'#123251');suit.addColorStop(.86,'#1b2a37');suit.addColorStop(1,'#080f1b');
  c.fillStyle=suit;c.strokeStyle='#5b8796';c.lineWidth=1.6;
  c.beginPath();c.moveTo(-19,-7);c.bezierCurveTo(-7,-13,12,-13,20,-7);
  c.quadraticCurveTo(27,-1,20,9);c.bezierCurveTo(5,15,-9,12,-19,7);
  c.quadraticCurveTo(-23,-1,-19,-7);c.closePath();c.fill();c.stroke();
  c.fillStyle='#09141e';c.beginPath();c.roundRect(-11,-4,21,8,3);c.fill();
  line(-17,7,15,8,'#63879a',.9);
  c.shadowColor='#18a8c8';c.shadowBlur=4;c.fillStyle='#5cd7e7';
  for(const [px,py] of [[-8,-8],[11,10],[19,-8]]){c.beginPath();c.arc(px,py,1.6,0,TAU);c.fill();}
  c.shadowBlur=0;
  // Forward-leaning helmet and collar. The visor looks along the direction of travel.
  // A dark open crown makes flowing black hair legible without enlarging the head.
  c.save();c.translate(25,-2);c.rotate(.13);
  c.fillStyle='#111925';c.strokeStyle='#8aadb9';c.lineWidth=1.7;
  c.beginPath();c.ellipse(2,0,14.5,12.1,0,0,TAU);c.fill();c.stroke();
  c.fillStyle='#142b3a';c.strokeStyle='#bfdbe0';c.lineWidth=.85;
  c.beginPath();c.ellipse(8.2,-.6,8.7,8.2,0,0,TAU);c.fill();c.stroke();
  c.fillStyle='#789eaa';c.beginPath();c.arc(12.6,-2.1,1.7,0,TAU);c.fill();
  c.strokeStyle='rgba(232,252,255,.92)';c.beginPath();c.arc(7,-.8,8,-.85,.95);c.stroke();
  // A narrow pressure collar ends below the hairline, keeping the human face readable.
  c.fillStyle='#04080c';c.beginPath();c.moveTo(-10,-7);c.quadraticCurveTo(-3,-16,7,-13);
  c.quadraticCurveTo(10,-10,11,-9);c.quadraticCurveTo(3,-11,-3,-7);
  c.quadraticCurveTo(-8,-5,-10,-7);c.closePath();c.fill();
  c.restore();
  // Loose hair in both versions, never a ponytail. Each lock has separate
  // water-driven curvature. Female locks extend farther; male locks are short.
  c.save();c.strokeStyle='#05070b';c.lineCap='round';
  // Underwater hair consists of many independent flowing strands.
  const hairLength=female?60:20; // 3:1 length ratio
  const locks=female?46:34;
  // Layered, flowing silhouette makes the hair fuller without tying it back.
  const sweep=female?50:18;
  c.fillStyle='rgba(3,7,12,.83)';c.beginPath();c.moveTo(17,-10);
  c.bezierCurveTo(9,-27,15-sweep*.7,-26,18-sweep,-14);
  c.quadraticCurveTo(20-sweep,-4,25,-8);c.closePath();c.fill();
  for(let i=0;i<locks;i++){
   const f=i/(locks-1),rootX=16.5+f*11,rootY=-10.5-Math.sin(f*Math.PI)*8+Math.sin(i*2.29)*1.8;
   const phase=(Number(t)||0)*.0014+i*.61,flow=Math.sin(phase)*(.8+f*2.5)+Math.cos(phase*.73)*1.1;
   const tipX=rootX-hairLength+Math.sin(i*1.73)*1.9;
   const tipY=rootY-Math.sin(f*7.5)*3.5+flow+(female?-5:0);
   c.strokeStyle=i%5===0?'#303540':i%3===0?'#11151e':'#05080e';
   c.lineWidth=.72+(i%5)*.16;
   c.beginPath();c.moveTo(rootX,rootY);
   c.bezierCurveTo(rootX-hairLength*.24,rootY-10+flow*.4,
    tipX+hairLength*.35,tipY+Math.sin(phase+.9)*(female?6:2.5),tipX,tipY);
   c.stroke();
  }
  c.fillStyle='#040608';c.beginPath();c.moveTo(16,-8);c.quadraticCurveTo(17,-16,26,-15);
  c.quadraticCurveTo(33,-13,32,-8);c.quadraticCurveTo(29,-11,25,-8);
  c.quadraticCurveTo(23,-6,20,-7);c.closePath();c.fill();
  // A short irregular fringe crosses the upper visor for both genders.
  for(let i=0;i<4;i++){
   const tx=25+i*2.8;
   line(tx,-12,tx+1.3,-8+(i%2)*1.4,'#080a0e',1.35);
  }
  c.restore();
  // Held equipment owns the arms. Non-weapon tools use a compact two-hand grip
  // so the rifle pose can never leak underneath a pickaxe or container.
  const held=String(options.heldItem||'abyssWeapon');
  c.save();c.rotate((Number(aim)||0)-a);
  if(held!=='abyssWeapon'){
   c.translate(0,5);
   if(held==='abyssPickaxe')c.rotate((Number(options.swing)||0)*.17);
   limb([5,-7],[17,-10],4.8,'#182634','#617b87');
   limb([17,-10],[27,-2],4.2,'#152b3a','#688391');
   limb([4,7],[16,11],5.2,'#192733','#698797');
   limb([16,11],[27,3],4.5,'#162c3b','#5d8191');
   c.translate(27,0);
   if(held==='abyssPickaxe'){
    c.rotate(-.28+(Number(options.swing)||0)*.45);c.strokeStyle='#754a2d';c.lineWidth=5;c.beginPath();c.moveTo(-8,0);c.lineTo(28,0);c.stroke();
    c.strokeStyle='#c7d3d7';c.lineWidth=4;c.beginPath();c.moveTo(20,-13);c.quadraticCurveTo(31,-15,39,-6);c.stroke();
    c.strokeStyle='#6f858d';c.lineWidth=2;c.beginPath();c.moveTo(20,-13);c.lineTo(17,-6);c.stroke();
   }else if(['emptyCylinder','gasCylinder','oilCylinder'].includes(held)){
    const progress=Math.max(0,Math.min(1,Number(options.fillProgress)||0));
    const kind=String(options.fillType||'');
    const gas=held==='gasCylinder'||held==='emptyCylinder'&&kind==='gasSeep';
    const oil=held==='oilCylinder'||held==='emptyCylinder'&&kind==='oilSeep';
    c.rotate(.08);c.fillStyle='#243842';c.strokeStyle='#bfccb9';c.lineWidth=1.8;
    c.beginPath();c.roundRect(-4,-17,18,34,5);c.fill();c.stroke();
    const level=held==='emptyCylinder'?progress:1;
    if(level>0){c.fillStyle=gas?'#55bc7b':oil?'#17181e':'#6f93a4';c.fillRect(-1,12-25*level,12,25*level);}
    c.strokeStyle='#d4b77b';c.lineWidth=2;c.strokeRect(-4,-17,18,34);
    c.fillStyle='#cbd8d2';c.fillRect(1,-23,8,6);
    if(gas&&level>0){c.fillStyle='#9fecc1';c.beginPath();c.arc(5,8-15*level,2.1,0,TAU);c.fill();}
   }else if(held==='offshoreCable'){
    c.strokeStyle='#d5b46c';c.lineWidth=5;c.beginPath();c.arc(8,0,12,0,TAU);c.stroke();c.strokeStyle='#769baa';c.lineWidth=4;c.beginPath();c.arc(8,0,6,0,TAU);c.stroke();
    c.strokeStyle='#d6b87e';c.lineWidth=3;c.beginPath();c.moveTo(19,5);c.quadraticCurveTo(27,4,31,12);c.stroke();
   }else{
    c.fillStyle='#617f83';c.strokeStyle='#c0c8aa';c.lineWidth=1.5;
    c.beginPath();c.moveTo(-8,3);c.lineTo(-1,-9);c.lineTo(18,-4);c.lineTo(20,7);c.lineTo(5,12);c.closePath();c.fill();c.stroke();
   }
   c.restore();c.restore();return;
  }
  c.translate(0,GUN_OFFSET_Y); // Rifle stays below the torso at every aim angle.
  limb([6,-7],[15,-16],4.8,'#182634','#617b87');
  limb([15,-16],[31,-7],4.1,'#152b3a','#688391');
  limb([4,8],[15,17],5.5,'#192733','#698797');
  limb([15,17],[27,9],4.7,'#162c3b','#5d8191');
  // White futuristic AK-profile rifle: ventilated receiver, pronounced stock,
  // curved magazine, trigger guard, optic and a long distinguishable barrel.
  // The muzzle glow and hit origin use BARREL_TIP_X, exactly the same coordinate.
  c.shadowColor='rgba(213,248,255,.48)';c.shadowBlur=5.5;
  c.fillStyle='#d8e4ed';c.strokeStyle='#faffff';c.lineWidth=1.25;
  c.beginPath();c.moveTo(18,-5);c.lineTo(35,-7);c.lineTo(42,-5);
  c.lineTo(48,-4);c.lineTo(49,4);c.lineTo(38,5);
  c.lineTo(32,8);c.lineTo(19,8);c.lineTo(16,4);c.closePath();c.fill();c.stroke();
  c.shadowBlur=0;
  // Angular stock behind the receiver.
  c.strokeStyle='#dcebf4';c.lineWidth=2.3;c.beginPath();c.moveTo(18,-4);
  c.lineTo(10,-9);c.lineTo(3,-8);c.lineTo(3,-3);c.lineTo(10,1);
  c.lineTo(3,5);c.lineTo(4,10);c.lineTo(10,10);c.lineTo(19,6);c.stroke();
  // Dark inset receiver and luminous upper rail.
  c.fillStyle='#223342';c.beginPath();c.roundRect(23,-3,19,8,1.8);c.fill();
  c.fillStyle='#f7fdff';c.fillRect(27,-7.5,14,1.7);
  c.fillStyle='#132635';c.beginPath();c.roundRect(33,-11,9,3.8,1);c.fill();
  c.fillStyle='#c5f7ff';c.fillRect(35,-11.3,5,1);
  // Curved detachable magazine clearly below the body.
  c.fillStyle='#122635';c.strokeStyle='#effcff';c.lineWidth=.95;
  c.beginPath();c.moveTo(30,7);c.quadraticCurveTo(28,13,34,18);
  c.lineTo(40,17);c.quadraticCurveTo(35,12,36,7);c.closePath();c.fill();c.stroke();
  // Pistol grip points down; trigger guard remains visible.
  c.fillStyle='#1e303e';c.beginPath();c.moveTo(20,7);c.lineTo(25,7);
  c.lineTo(25,14);c.lineTo(21,16);c.closePath();c.fill();
  c.strokeStyle='rgba(248,255,255,.8)';c.lineWidth=.85;
  c.beginPath();c.arc(28,8,5.1,Math.PI*.11,Math.PI*.95);c.stroke();
  // Hand guard and clearly extended barrel to x=69.
  c.fillStyle='#e6eef4';c.strokeStyle='#ffffff';c.lineWidth=1.2;
  c.beginPath();c.moveTo(46,-4);c.lineTo(57,-3);c.lineTo(57,3);c.lineTo(46,4);c.closePath();c.fill();c.stroke();
  c.fillStyle='#243444';c.fillRect(57,-1.65,9,3.3);
  c.fillStyle='#effaff';c.fillRect(66,-2.4,BARREL_TIP_X-66,4.8);
  c.strokeStyle='rgba(255,255,255,.92)';c.lineWidth=.75;
  c.beginPath();c.moveTo(47,-3.3);c.lineTo(66,-3.3);c.stroke();
  c.fillStyle='#f4ffff';c.shadowColor='#d5fcff';c.shadowBlur=4;
  c.beginPath();c.arc(BARREL_TIP_X,0,1.4,0,TAU);c.fill();c.shadowBlur=0;
  // Gloves settle on two separate contact points, never doubling the arm.
  c.fillStyle='#0b1f2c';c.strokeStyle='#98d3dc';c.lineWidth=.75;
  c.beginPath();c.ellipse(31,-6,3.3,2.2,-.15,0,TAU);c.fill();c.stroke();
  c.beginPath();c.ellipse(24,8,3.1,2.5,.12,0,TAU);c.fill();c.stroke();
  c.restore();c.restore();
 }
 return Object.freeze({draw,muzzle,genderOf,DRAW_SCALE,BARREL_TIP_X,GUN_OFFSET_Y});
});