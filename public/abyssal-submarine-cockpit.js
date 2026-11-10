/* Dynamic full-screen submarine cockpit. Only paints while the lab is open. */
(function(){
 'use strict';
 const screen=document.getElementById('submarineWorkshop'),canvas=document.getElementById('abyssCockpitCanvas');
 if(!screen||!canvas)return;
 const c=canvas.getContext('2d');if(!c)return;
 let active=false,frame=0,lastPaint=0,width=0,height=0,dpr=1,accountGender='male';
 const TAU=Math.PI*2;
 function size(){
  const box=canvas.getBoundingClientRect();width=Math.max(320,box.width);height=Math.max(260,box.height);
  dpr=Math.min(1.7,Math.max(1,window.devicePixelRatio||1),Math.sqrt(2900000/(width*height)));
  const nx=Math.max(1,Math.round(width*dpr)),ny=Math.max(1,Math.round(height*dpr));
  if(canvas.width!==nx||canvas.height!==ny){canvas.width=nx;canvas.height=ny;}
 }
 function gender(){return window.AbyssalDiverGender==='female'||window.AbyssalOnline?.getAccount?.()?.diverGender==='female'||accountGender==='female'?'female':'male';}
 function fish(x,y,size,t,index){
  const sway=Math.sin(t*.0018+index*2.7);
  c.save();c.translate(x,y+sway*3);c.scale(size,size);
  const shade=index%3===0?'#183b4b':index%3===1?'#214759':'#29556a';
  c.fillStyle=shade;c.globalAlpha=.53;
  c.beginPath();c.moveTo(-25,0);c.bezierCurveTo(-8,-12,19,-12,31,0);
  c.bezierCurveTo(11,13,-12,13,-25,0);c.fill();
  c.beginPath();c.moveTo(-24,0);c.lineTo(-40,-12+Math.sin(t*.005+index)*5);
  c.lineTo(-39,10+Math.sin(t*.005+index)*5);c.closePath();c.fill();
  c.beginPath();c.moveTo(-5,-6);c.lineTo(5,-18);c.lineTo(13,-6);c.fill();
  c.restore();
 }
 function drawScene(t){
  size();
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
  const scale=Math.max(width/1440,height/900),ox=(width-1440*scale)/2,oy=(height-900*scale)/2;
  c.save();c.translate(ox,oy);c.scale(scale,scale);
  const wall=c.createLinearGradient(0,0,1440,900);wall.addColorStop(0,'#182b33');wall.addColorStop(.42,'#0c1c25');wall.addColorStop(1,'#08141c');
  c.fillStyle=wall;c.fillRect(0,0,1440,900);
  // Structural bridge ribs and corroded bronze reinforcement.
  for(const x of [60,190,1250,1380]){
   c.fillStyle='#263c43';c.fillRect(x-27,0,54,740);
   c.fillStyle='#a27c42';c.fillRect(x-24,0,3,740);c.fillRect(x+22,0,3,740);
   c.fillStyle='#132630';c.fillRect(x-10,0,20,740);
  }
  c.fillStyle='#273b41';c.fillRect(0,52,1440,39);
  c.fillStyle='#937548';c.fillRect(0,78,1440,5);
  // Panoramic porthole, shaped like a submarine bridge window.
  c.save();
  c.beginPath();c.moveTo(223,105);c.lineTo(1217,105);c.quadraticCurveTo(1275,110,1280,171);
  c.lineTo(1265,493);c.quadraticCurveTo(1261,528,1223,537);
  c.lineTo(219,537);c.quadraticCurveTo(180,532,174,493);
  c.lineTo(160,171);c.quadraticCurveTo(161,114,223,105);c.closePath();
  c.fillStyle='#04101c';c.fill();c.lineWidth=28;c.strokeStyle='#596663';c.stroke();
  c.lineWidth=7;c.strokeStyle='#b69755';c.stroke();
  c.save();c.clip();
  const sea=c.createLinearGradient(0,110,0,540);sea.addColorStop(0,'#15596d');sea.addColorStop(.34,'#0c3d54');sea.addColorStop(.78,'#092338');sea.addColorStop(1,'#071629');
  c.fillStyle=sea;c.fillRect(130,105,1180,440);
  // Distant kelp, moving fish and a shallow reef beyond the glass.
  for(let i=0;i<24;i++){
   const x=170+i*52,y=468+(i%4)*17,reach=70+(i%5)*22;
   c.strokeStyle=i%2?'rgba(34,104,101,.34)':'rgba(25,84,92,.37)';c.lineWidth=5+(i%3);
   c.beginPath();c.moveTo(x,y+66);c.bezierCurveTo(x-20,y-reach*.2,x+Math.sin(t*.0005+i)*16,y-reach*.75,x+Math.sin(t*.0007+i)*15,y-reach);c.stroke();
  }
  for(let i=0;i<13;i++){
   const speed=9+i%4*4,move=(t*.001*speed+i*142)%1250;
   fish(120+move,178+(i*61)%265,.5+i%4*.28,t,i);
  }
  for(let i=0;i<45;i++){
   const x=170+(i*71.71)%1110,y=150+(i*43.9)%330;
   c.fillStyle='rgba(156,218,217,'+(0.08+(Math.sin(t*.0012+i)*.07)) +')';
   c.beginPath();c.arc(x,y,1+(i%3)*.5,0,TAU);c.fill();
  }
  const glow=c.createLinearGradient(0,115,0,530);glow.addColorStop(0,'rgba(113,225,228,.17)');glow.addColorStop(1,'rgba(0,10,30,.25)');
  c.fillStyle=glow;c.fillRect(150,105,1150,440);c.restore();
  // Interior window frame grids and vertical supports.
  for(const x of [435,1005]){
   c.fillStyle='#263b40';c.fillRect(x-15,103,30,434);c.fillStyle='#92744c';c.fillRect(x-11,110,3,422);
  }
  c.lineWidth=11;c.strokeStyle='#1a3035';c.stroke();c.restore();
  // Overhead signals and metal ceiling rails.
  c.fillStyle='#b08c50';for(let i=0;i<7;i++){c.fillRect(364+i*110,91,44,3);c.fillStyle='#263d45';c.fillRect(381+i*110,91,16,11);c.fillStyle='#b08c50';}
  // Forward console geometry.
  const front=c.createLinearGradient(0,500,0,900);front.addColorStop(0,'#314a50');front.addColorStop(.3,'#18313a');front.addColorStop(1,'#081922');
  c.fillStyle=front;c.beginPath();c.moveTo(92,545);c.lineTo(1348,545);c.lineTo(1440,727);c.lineTo(1440,900);c.lineTo(0,900);c.lineTo(0,727);c.closePath();c.fill();
  c.strokeStyle='#987947';c.lineWidth=9;c.beginPath();c.moveTo(92,555);c.lineTo(1348,555);c.stroke();
  // Analogue controls, recessed panels, animated LEDs.
  for(const x of [310,1080]){
   c.save();c.translate(x,600);c.fillStyle='#0b2830';c.strokeStyle='#557077';c.lineWidth=4;c.beginPath();c.roundRect(-123,-33,246,119,11);c.fill();c.stroke();
   for(let i=0;i<7;i++){
    c.fillStyle=(i%3===0)?'#b99757':'#5bafb1';c.globalAlpha=.45+.25*Math.sin(t*.002+i);c.beginPath();c.arc(-91+i*30,12+(i%2)*16,5,0,TAU);c.fill();
   }
   c.restore();
  }
  // Headrest, seated diver from behind; hair length follows profile selection.
  c.save();c.translate(720,640);
  c.fillStyle='#030d14';c.strokeStyle='#455961';c.lineWidth=9;
  c.beginPath();c.roundRect(-83,5,166,255,29);c.fill();c.stroke();
  c.fillStyle='#1b3039';c.beginPath();c.roundRect(-71,12,142,220,26);c.fill();
  c.fillStyle='#20343b';c.beginPath();c.ellipse(0,166,84,116,0,0,TAU);c.fill();
  // Shoulder armor, sleeves and forearms on the forward console.
  c.fillStyle='#283d48';c.beginPath();c.moveTo(-91,108);c.quadraticCurveTo(-122,149,-128,202);
  c.lineTo(-92,217);c.lineTo(-56,152);c.lineTo(55,152);c.lineTo(94,220);c.lineTo(125,207);
  c.quadraticCurveTo(112,146,89,108);c.closePath();c.fill();
  c.strokeStyle='#638b98';c.lineWidth=5;c.beginPath();c.moveTo(-98,151);c.lineTo(-117,204);c.moveTo(98,151);c.lineTo(116,206);c.stroke();
  c.fillStyle='#0a1822';c.beginPath();c.roundRect(-64,48,128,111,31);c.fill();
  c.fillStyle='#334f5d';c.beginPath();c.roundRect(-56,52,112,91,24);c.fill();
  // Neck / bare hair silhouette. No helmet in seated laboratory.
  c.fillStyle='#927568';c.beginPath();c.ellipse(0,40,30,37,0,0,TAU);c.fill();
  c.fillStyle='#090d13';
  if(gender()==='female'){
   c.beginPath();c.moveTo(-46,7);c.bezierCurveTo(-65,22,-70,75,-68,118);
   c.quadraticCurveTo(-39,133,-35,110);c.quadraticCurveTo(-12,132,0,117);
   c.quadraticCurveTo(19,136,38,113);c.quadraticCurveTo(72,140,69,101);
   c.bezierCurveTo(71,41,55,1,18,-10);c.quadraticCurveTo(-24,-22,-46,7);c.fill();
   c.strokeStyle='#1a2228';c.lineWidth=2;
   for(let i=0;i<9;i++){
    const x=(i-4)*11;c.beginPath();c.moveTo(x,-8);c.bezierCurveTo(x-8,33,x+14,81,x+Math.sin(i*3)*7,119);c.stroke();
   }
  }else{
   c.beginPath();c.ellipse(0,12,48,52,0,0,TAU);c.fill();
   c.fillStyle='#151920';c.beginPath();c.ellipse(0,-7,44,33,0,Math.PI,TAU);c.fill();
   for(let i=0;i<6;i++){c.strokeStyle='#222c33';c.lineWidth=2;c.beginPath();c.moveTo(-38+i*14,0);c.lineTo(-34+i*14,28);c.stroke();}
  }
  c.restore();
  // Forward holographic console edges remain visible behind the interactive HTML buttons.
  c.strokeStyle='rgba(127,181,181,.4)';c.lineWidth=3;
  c.beginPath();c.moveTo(40,785);c.lineTo(290,746);c.moveTo(1150,746);c.lineTo(1400,785);c.stroke();
  c.restore();
 }
 function tick(t){if(!active||screen.hidden)return;frame=requestAnimationFrame(tick);if(t-lastPaint<33)return;lastPaint=t;drawScene(t);}
 function open(){if(screen.hidden)return;active=true;lastPaint=0;cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);}
 function close(){active=false;cancelAnimationFrame(frame);frame=0;}
 window.addEventListener('abyssal-account-data',e=>{accountGender=e.detail?.diverGender==='female'?'female':'male';});
 window.addEventListener('resize',()=>{if(active)size();});
 window.AbyssalSubmarineCockpit=Object.freeze({open,close});
})();
