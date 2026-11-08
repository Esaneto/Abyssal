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
 const TAU=Math.PI*2,DRAW_SCALE=.60;
 const genderOf=value=>value==='female'?'female':'male';
 function muzzle(x,y,r,aim){
  const distance=(Number(r)||13)*DRAW_SCALE*46/14;
  const angle=Number(aim)||0;
  return {x:(Number(x)||0)+Math.cos(angle)*distance,y:(Number(y)||0)+Math.sin(angle)*distance};
 }
 function draw(c,x,y,r,heading,aim,t=0,options={}){
  if(!c||!(r>0))return;
  const female=genderOf(options.gender)==='female',a=Number(heading)||0;
  const cycle=options.moving===false?0:Math.sin((Number(t)||0)*.011);
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
   const lift=cycle*side*5,knee=[-31,side*8+lift],ankle=[-48,side*12+lift*1.35];
   limb([-16,side*5],knee,8,'#202a38','#40617a');
   c.fillStyle='#030c14';c.strokeStyle='#6d899d';c.lineWidth=1;
   c.beginPath();c.arc(knee[0],knee[1],4.3,0,TAU);c.fill();c.stroke();
   limb(knee,ankle,6.5,'#162532','#2b5b75');
   // Realistic long blade, dark grey with a narrow glint on the outer edge.
   c.fillStyle='#101b29';c.strokeStyle='#79b9ce';c.lineWidth=1.5;
   c.beginPath();c.moveTo(ankle[0]+2,ankle[1]-4*side);
   c.quadraticCurveTo(-59,ankle[1]-7*side,-76,ankle[1]-12*side);
   c.quadraticCurveTo(-82,ankle[1]-5*side,-77,ankle[1]+7*side);
   c.quadraticCurveTo(-61,ankle[1]+5*side,ankle[0],ankle[1]+3*side);
   c.closePath();c.fill();c.stroke();
   line(-53,ankle[1],-75,ankle[1]-3*side,'rgba(168,206,217,.56)',.8);
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
  // Partial helmet with sealed transparent visor: a deliberate opening above
  // the forehead allows the hair to flow without hiding the human silhouette.
  c.fillStyle='#0c1928';c.strokeStyle='#80aab7';c.lineWidth=1.9;
  c.beginPath();c.ellipse(27,-2,15,13,0,0,TAU);c.fill();c.stroke();
  c.fillStyle='#112739';c.beginPath();c.ellipse(32,-1,8.5,8.5,0,0,TAU);c.fill();
  c.fillStyle='#5e8492';c.beginPath();c.arc(35,-3,2,0,TAU);c.fill();
  c.strokeStyle='#c4e9ef';c.lineWidth=1;c.beginPath();c.arc(29,-1,10,-.75,1.15);c.stroke();
  // Hair is BLACK in both versions: short fringe or thick long curved strands.
  c.fillStyle='#030507';c.strokeStyle='#17212a';c.lineWidth=1.2;
  c.beginPath();c.moveTo(15,-8);c.quadraticCurveTo(21,-18,30,-14);
  c.quadraticCurveTo(33,-12,36,-8);c.quadraticCurveTo(31,-11,28,-8);
  c.quadraticCurveTo(25,-9,23,-6);c.quadraticCurveTo(19,-8,15,-8);c.closePath();c.fill();
  if(female){
   for(let i=0;i<8;i++){
    const offset=i*1.2,tail=-39-i*1.15,wave=cycle*(3+i*.33);
    c.beginPath();c.strokeStyle=i%3===0?'#1b2530':'#040608';c.lineWidth=2.1+(i%3)*.32;
    c.moveTo(18+offset*.15,-11);
    c.bezierCurveTo(3,-19-offset,-11,-22+offset+wave,tail,-27+offset*.4+wave);
    c.bezierCurveTo(tail-7,-30+offset*.5+wave,tail-12,-23+offset+wave,tail-21,-25+offset+wave);
    c.stroke();
   }
  }else{
   for(let i=0;i<4;i++)line(22+i*2,-12,25+i*1.4,-7,'#07090d',1.5);
  }
  // Both arms bend down to the weapon grip. Weapon pitch is independent from
  // swimming heading and attaches to the arms, not to the cursor/body.
  c.save();c.rotate((Number(aim)||0)-a);
  limb([10,6],[19,14],5.2,'#1d2b3a','#5c7888');
  limb([19,14],[29,8],4.7,'#132534','#537b8a');
  limb([8,-6],[20,4],4.9,'#1b293a','#587a89');
  // Recognisable WHITE sci-fi rifle: stock, pistol grip, trigger, body and barrel.
  c.fillStyle='#b7c3cf';c.strokeStyle='#f2ffff';c.lineWidth=1.5;
  c.beginPath();c.moveTo(17,1);c.lineTo(20,-4);c.lineTo(35,-5);c.lineTo(38,-2);
  c.lineTo(44,-2);c.lineTo(44,3);c.lineTo(35,3);c.lineTo(31,6);
  c.lineTo(23,6);c.lineTo(23,11);c.lineTo(19,12);c.lineTo(16,5);c.closePath();c.fill();c.stroke();
  c.fillStyle='#f4f7f8';c.fillRect(30,-3,12,4);
  c.fillStyle='#122431';c.fillRect(41,-1,5,3);
  c.fillStyle='#f6ffff';c.fillRect(44,-.5,3,2);
  line(25,-4,36,-4,'rgba(255,255,255,.95)',.9);
  c.fillStyle='#e5fcff';c.shadowColor='#d1faff';c.shadowBlur=5;
  c.beginPath();c.arc(46,0,1.5,0,TAU);c.fill();c.shadowBlur=0;
  c.restore();c.restore();
 }
 return Object.freeze({draw,muzzle,genderOf,DRAW_SCALE});
});