/* Wildlife silhouettes for the Mar Aberto only.
 * Naturalistic body plans: no shared spherical monster geometry.
 * Rendering stays within the camera-culling already done in game.js.
 */
(function(root){
 'use strict';
 const TAU=Math.PI*2;
 function path(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
 function curve(c,coords,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(coords[0],coords[1]);c.bezierCurveTo(...coords.slice(2));c.stroke();}
 function eye(c,x,y){c.fillStyle='#d9e1d9';c.beginPath();c.arc(x,y,2.3,0,TAU);c.fill();c.fillStyle='#061119';c.beginPath();c.arc(x+.5,y,.9,0,TAU);c.fill();}
 function fish(c,t,species){
  const shark=/shark|goblin|frilled|leviathan/.test(species),angler=species==='angler',flap=Math.sin(t*.006)*7;
  if(angler){
   path(c,[[-66,-9],[-44,-25],[3,-31],[32,-17],[48,-5],[53,26],[22,40],[-25,24]],'#28313b');
   path(c,[[28,-7],[69,-17],[62,31],[17,28]],'#151b25');eye(c,34,-12);
   for(let j=0;j<7;j++)path(c,[[23+j*6,-9+j*.4],[27+j*6,1+j*.7],[31+j*6,-9+j*.4]],'#e6dec7');
   path(c,[[-60,-8],[-94,-31+flap],[-85,20+flap]],'#374951');
   curve(c,[31,-25,39,-58,70,-66,79,-39],'#7d8990',2.3);
   c.shadowColor='#8cebc7';c.shadowBlur=12;c.fillStyle='#a8f6d4';c.beginPath();c.arc(79,-39,6,0,TAU);c.fill();c.shadowBlur=0;return;
  }
  path(c,[[-78,0],[-110,-32-flap],[-106,28+flap],[-78,6]],shark?'#263f4b':'#2f4553');
  const body=c.createLinearGradient(0,-30,0,36);body.addColorStop(0,shark?'#48616c':'#46546a');body.addColorStop(1,'#1a2835');
  c.fillStyle=body;c.beginPath();c.moveTo(-84,0);c.bezierCurveTo(-47,-29,12,-31,66,-8);c.quadraticCurveTo(95,-1,75,10);c.bezierCurveTo(25,40,-45,24,-84,0);c.fill();
  path(c,[[-34,-19],[-7,-62], [8,-18]],'#3b5663');
  path(c,[[9,18],[-13,40],[-28,21]],'#354d59');
  path(c,[[58,11],[74,13],[59,19]],'#16232d');eye(c,60,-12);
  if(species==='goblin'){path(c,[[77,-10],[116,-18],[83,-4]],'#5e7074');}
  if(species==='frilled'){for(let j=0;j<5;j++)curve(c,[44-j*5,-17,43-j*5,-5,45-j*5,0,43-j*5,10],'#9f7777',1.2);}
  if(species==='blackdragon'||species==='viperfish'){for(let j=0;j<9;j++){c.fillStyle='#80d7d1';c.beginPath();c.arc(-58+j*14,14+Math.sin(j)*3,1.5,0,TAU);c.fill();}}
 }
 function eel(c,t,species){
  const sw=Math.sin(t*.004)*17,long=/whiplash|bigfin/.test(species);
  const length=long?170:130;
  c.strokeStyle=/blackdragon|viperfish/.test(species)?'#1b222d':'#405663';c.lineCap='round';
  c.lineWidth=15;c.beginPath();c.moveTo(70,0);c.bezierCurveTo(15,-18,-20,19+sw,-length,-sw*.4);c.stroke();
  c.strokeStyle='#839090';c.lineWidth=2;c.beginPath();c.moveTo(47,-8);c.bezierCurveTo(8,-25,-40,8+sw,-length+12,-sw*.4);c.stroke();
  path(c,[[46,-12],[76,-11],[88,5],[60,17],[46,7]],'#344755');eye(c,73,-7);
  path(c,[[65,9],[91,17],[86,3]],'#17262b');
  if(species==='viperfish'||species==='blackdragon')for(let i=0;i<7;i++){
   path(c,[[65+i*2,8],[71+i*2,19],[75+i*2,8]],'#9bb2b1');
  }
 }
 function ray(c,t){
  const wing=Math.sin(t*.0043)*13;
  path(c,[[-105,-4],[-155,-12],[-140,-2]],'#3b4e55');
  c.fillStyle='#465962';c.beginPath();c.moveTo(75,1);c.bezierCurveTo(19,-38,-24,-86-wing,-75,-56-wing);
  c.quadraticCurveTo(-7,-1,-75,56+wing);c.bezierCurveTo(-18,70+wing,40,17,75,1);c.fill();
  curve(c,[66,1,15,0,-42,0,-150,3],'#9bb7b5',2.5);eye(c,51,-7);
  c.strokeStyle='rgba(208,233,223,.20)';c.lineWidth=2;c.beginPath();c.moveTo(60,1);c.lineTo(-75,-54-wing);c.moveTo(60,1);c.lineTo(-75,54+wing);c.stroke();
 }
 function turtle(c,t){
  const flap=Math.sin(t*.0036)*20;
  path(c,[[-48,-20],[-94,-38-flap],[-75,-4],[-50,7]],'#43575a');
  path(c,[[-41,14],[-92,39+flap],[-62,46],[-25,25]],'#43575a');
  path(c,[[20,-18],[45,-64+flap],[65,-50+flap],[47,8]],'#5a6b69');
  path(c,[[13,22],[47,50-flap],[66,44-flap],[28,10]],'#5a6b69');
  c.fillStyle='#3d5650';c.beginPath();c.ellipse(0,0,58,36,0,0,TAU);c.fill();
  c.strokeStyle='#7a8a6b';c.lineWidth=3;c.stroke();
  for(let i=0;i<5;i++)curve(c,[Math.cos(i*TAU/5)*29,Math.sin(i*TAU/5)*18,5,-4,16,9,0,0],'rgba(162,175,129,.3)',2);
  c.fillStyle='#456365';c.beginPath();c.ellipse(62,-2,20,14,0,0,TAU);c.fill();eye(c,70,-7);
 }
 function crab(c,t,spider=false){
  const step=Math.sin(t*.0028)*8;
  for(let side of [-1,1])for(let i=0;i<4;i++){
   const anchor=(i-1.5)*17;
   const len=spider?79:57;
   curve(c,[anchor,side*12,anchor-5,side*20,anchor-17+i*8,side*(len*.68+step),anchor-22+i*13,side*(len+step)],'#58635c',spider?3:5);
  }
  path(c,[[-48,-12],[-26,-23],[25,-22],[52,-8],[43,22],[-38,19]],'#514a4b');
  path(c,[[-46,-7],[-27,-17],[22,-15],[42,-4],[32,8],[-32,10]],'#736665');
  for(let a of [-1,1]){c.fillStyle='#4b5d59';c.beginPath();c.arc(35,a*22,9,0,TAU);c.fill();}
  eye(c,34,-12);eye(c,34,1);
 }
 function nautilus(c,t){
  c.fillStyle='#876d62';c.beginPath();c.arc(-13,0,49,0,TAU);c.fill();
  c.strokeStyle='#dfc6a2';c.lineWidth=4;c.beginPath();
  for(let i=0;i<70;i++){const q=i/69*3.9*Math.PI,r=3+q*3.25,x=-13+r*Math.cos(q),y=r*Math.sin(q);
   if(!i)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();
  path(c,[[2,-26],[57,-16],[73,12],[19,27]],'#675350');eye(c,47,-10);
  for(let j=0;j<8;j++)curve(c,[58,j*3-10,78,Math.sin(t*.003+j)*7+j*3-12,92+j*2,j*4-20,106+j*4,j*4-12],'#9e8b78',1.5);
 }
 function octopus(c,t){
  c.fillStyle='#705f79';c.beginPath();c.ellipse(23,-16,36,43,.1,0,TAU);c.fill();
  for(let i=0;i<8;i++){
   const q=(i-3.5)/3.5,sw=Math.sin(t*.003+i)*13;
   curve(c,[13+q*12,15,6+q*34,51,sw+q*58,74,sw+q*42,96],i%2?'#7a6680':'#62576e',8-i*.45);
  }eye(c,39,-16);
 }
 function seaPig(c,t){
  c.fillStyle='#9a7d89';c.beginPath();c.moveTo(-74,-9);c.bezierCurveTo(-56,-34,48,-28,68,-3);c.quadraticCurveTo(52,35,-58,21);c.closePath();c.fill();
  for(let j=0;j<7;j++)curve(c,[-54+j*17,7,-51+j*16,30,-42+j*17,42+Math.sin(t*.003+j)*4,-37+j*17,45],'#c3a3aa',3);
  for(let j=0;j<5;j++)curve(c,[53,0,68+j*3,-12,76+j*4,-4,90+j*4,-10],'#a68d93',2);
 }
 function jelly(c,t,siphon=false){
  if(siphon){
   curve(c,[-110,0,-55,Math.sin(t*.003)*9,30,-8,105,1],'rgba(139,190,199,.8)',3);
   for(let i=0;i<16;i++){const x=-99+i*13; c.fillStyle=i%2?'rgba(135,183,199,.27)':'rgba(177,131,169,.38)';c.beginPath();c.ellipse(x,Math.sin(i*.7+t*.002)*6,6,9,i*.4,0,TAU);c.fill();}
  }else{
   c.fillStyle='rgba(151,137,189,.39)';c.beginPath();c.moveTo(-45,0);c.bezierCurveTo(-45,-68,55,-74,59,1);c.quadraticCurveTo(7,23,-45,0);c.fill();
   c.strokeStyle='rgba(187,190,226,.8)';c.lineWidth=2;c.stroke();
   for(let j=0;j<11;j++)curve(c,[-36+j*9,8,-44+j*9,32,-38+j*9,55+Math.sin(t*.002+j)*9,-30+j*9,88],'rgba(173,132,201,.36)',1.4);
  }
 }
 const known=new Set(['reefshark','goblin','frilled','leviathan','viperfish','blackdragon','zebramoray','whiplash','bigfin','butterflyray','eagleray','stingray','hawksbill','leatherback','spidercrab','yeticrab','nautilus','seapig','angler','siphonophore']);
 function draw(ctx,enemy,r,time){
  const kind=String(enemy?.specimenSkinId||'');
  if(!known.has(kind))return false;
  const s=Math.min(2.3,Math.max(.22,Number(r)||32)/57),t=Number(time)||0;
  ctx.save();ctx.translate(enemy.x,enemy.y);ctx.rotate(Number(enemy.angle)||0);ctx.scale(s,s);
  if(/shark|goblin|frilled|leviathan|viperfish|blackdragon/.test(kind))fish(ctx,t,kind);
  else if(/zebramoray|whiplash|bigfin/.test(kind))eel(ctx,t,kind);
  else if(/ray/.test(kind))ray(ctx,t);
  else if(/hawksbill|leatherback/.test(kind))turtle(ctx,t);
  else if(/crab/.test(kind))crab(ctx,t,kind==='spidercrab');
  else if(kind==='nautilus')nautilus(ctx,t);
  else if(kind==='seapig')seaPig(ctx,t);
  else if(kind==='angler')fish(ctx,t,kind);
  else jelly(ctx,t,kind==='siphonophore');
  if(enemy.hit>0){ctx.globalAlpha=Math.min(.35,Number(enemy.hit)*.4);ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(0,0,65,32,0,0,TAU);ctx.fill();}
  ctx.restore();return true;
 }
 root.AbyssalFaunaAnatomy=Object.freeze({draw,supported:id=>known.has(String(id))});
})(typeof window==='object'?window:globalThis);
