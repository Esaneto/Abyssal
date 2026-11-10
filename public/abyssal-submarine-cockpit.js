/* Abyssal bridge cockpit. Original 2D canvas scene composed of glass,
 * marine fauna, steel instrumentation and an articulated seated diver.
 * The HTML command deck stays interactive on top of the drawn console.
 */
(function(){
 'use strict';
 const screen=document.getElementById('submarineWorkshop'),canvas=document.getElementById('abyssCockpitCanvas');
 if(!screen||!canvas)return;
 const c=canvas.getContext('2d');if(!c)return;
 const TAU=Math.PI*2;
 let active=false,frame=0,lastPaint=0,width=0,height=0,dpr=1,accountGender='male';
 function gender(){
  const direct=window.AbyssalDiverGender;
  if(direct==='male'||direct==='female')return direct;
  const saved=window.AbyssalOnline?.getAccount?.()?.diverGender||accountGender;
  return saved==='female'?'female':'male';
 }
 function size(){
  const b=canvas.getBoundingClientRect();width=Math.max(320,b.width);height=Math.max(260,b.height);
  dpr=Math.min(1.6,Math.max(1,window.devicePixelRatio||1),Math.sqrt(2300000/(width*height)));
  const w=Math.round(width*dpr),h=Math.round(height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 }
 function grad(x1,y1,x2,y2,stops){
  const g=c.createLinearGradient(x1,y1,x2,y2);
  for(const [p,color]of stops)g.addColorStop(p,color);return g;
 }
 function line(x1,y1,x2,y2,color,w=2){
  c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
 }
 function poly(points,color,stroke=null,w=1){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  c.closePath();c.fillStyle=color;c.fill();if(stroke){c.lineWidth=w;c.strokeStyle=stroke;c.stroke();}
 }
 function rr(x,y,w,h,r,fill,stroke=null,sw=1){
  c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=sw;c.stroke();}
 }
 function fish(x,y,scale,t,seed){
  c.save();c.translate(x,y+Math.sin(t*.0015+seed)*3);c.scale(scale,scale);
  c.fillStyle=seed%3===0?'#17445d':seed%2?'#1b6686':'#255c76';
  c.beginPath();c.moveTo(-20,0);c.bezierCurveTo(-8,-12,16,-11,25,0);
  c.bezierCurveTo(12,10,-9,12,-20,0);c.fill();
  const tail=Math.sin(t*.005+seed)*4;
  poly([[-19,0],[-34,-10+tail],[-34,10+tail]],c.fillStyle);
  poly([[-2,-5],[7,-13],[11,-4]],c.fillStyle);
  c.restore();
 }
 function coral(x,y,h,seed,t){
  c.save();c.translate(x,y);const tall=h;
  const colors=['#af589f','#e7834d','#3b9a92','#9c69a7'];
  c.strokeStyle=colors[seed%colors.length];c.lineCap='round';c.lineWidth=5;
  for(let j=0;j<5;j++){
   const side=(j-2)*10,dy=tall*(.65+(j%3)*.13);
   c.beginPath();c.moveTo(0,0);c.bezierCurveTo(side*.65,-dy*.3,side*1.6,-dy*.58,side*1.15,-dy);c.stroke();
   c.lineWidth=3;c.beginPath();c.moveTo(side*.9,-dy*.63);c.lineTo(side*.9+12,-dy*.79);c.stroke();
  }c.restore();
 }
 function ocean(t){
  // Ocean is clipped to the glass, with no stock illustration or remote assets.
  c.save();c.beginPath();c.moveTo(70,105);c.lineTo(1370,105);c.lineTo(1390,493);
  c.quadraticCurveTo(1370,555,1310,562);c.lineTo(124,562);
  c.quadraticCurveTo(53,555,50,490);c.closePath();c.clip();
  c.fillStyle=grad(0,100,0,575,[[0,'#68daf2'],[.18,'#268abf'],[.62,'#126390'],[1,'#092a52']]);
  c.fillRect(0,100,1440,480);
  // Underwater sun shafts terminate in gradually darkening water.
  for(let i=0;i<9;i++){
   const x=110+i*155+Math.sin(t*.00014+i)*6;
   poly([[x,105],[x+27,105],[x+220,575],[x+92,575]],'rgba(176,244,255,.042)');
  }
  for(let i=0;i<6;i++){
   const x=-80+i*315;
   c.fillStyle=i%2?'#0c5282':'#17618c';
   c.beginPath();c.moveTo(x,570);c.bezierCurveTo(x+60,475-i%2*25,x+140,492,x+205,412-i%3*28);
   c.quadraticCurveTo(x+270,465,x+365,570);c.closePath();c.fill();
  }
  // Bottom foreground rock terraces and reef, seen through the window.
  poly([[0,445],[100,405],[230,476],[325,461],[485,548],[600,550],[0,580]],'#10577b');
  poly([[880,555],[1010,497],[1110,463],[1258,489],[1440,404],[1440,585]],'#134e72');
  for(let i=0;i<25;i++){
   const x=i*61+(i%3)*14;
   const y=523+(i%4)*11;
   c.strokeStyle=i%2?'#286e70':'#246b8b';c.lineWidth=3;c.beginPath();
   c.moveTo(x,y+25);c.quadraticCurveTo(x-18,y-42,x+Math.sin(t*.0005+i)*16,y-79-(i%5)*13);c.stroke();
  }
  for(const [x,y,h,k] of [[45,470,82,0],[98,510,75,1],[195,527,64,2],[1000,536,70,0],[1165,523,95,1],[1360,477,85,3],[1274,541,61,2]])coral(x,y,h,k,t);
  // A large shadow sometimes passes outside the bridge. It cannot collide
  // or affect gameplay and is never mistaken for a registered specimen.
  const bossPhase=(t*.000085)%1;
  if(bossPhase>.56&&bossPhase<.93){
   const q=(bossPhase-.56)/.37,x=1470-q*1770,y=310+Math.sin(t*.0006)*24;
   c.save();c.translate(x,y);c.globalAlpha=Math.min(.3,Math.sin(q*Math.PI)*.32);
   c.fillStyle='#092d55';
   c.beginPath();c.ellipse(0,0,123,48,-.04,0,TAU);c.fill();
   poly([[-108,-3],[-180,-54],[-170,39]],'#092d55');
   poly([[-18,-21],[35,-92],[56,-18]],'#092d55');c.restore();
  }
  for(let i=0;i<18;i++){
   const x=((i*171+t*.008*(1+i%4*.4))%1550)-55;
   fish(x,176+(i*49)%258,.38+(i%4)*.18,t,i);
  }
  // Tiny bubble trails and depth haze.
  for(let i=0;i<39;i++){
   const x=70+(i*127)%1310,y=130+(i*79+(t*.017*(1+i%3)))%407;
   c.globalAlpha=.15+(i%4)*.07;c.strokeStyle='#cbfaff';c.lineWidth=1;
   c.beginPath();c.arc(x,y,1+(i%3)*1.3,0,TAU);c.stroke();
  }c.globalAlpha=1;
  const reflection=grad(0,95,0,570,[[0,'#d1ffff25'],[.4,'#aef1ff05'],[1,'#03112439']]);
  c.fillStyle=reflection;c.fillRect(0,105,1440,465);c.restore();
 }
 function windows(t){
  ocean(t);
  // Four rigid panoramic glass panes with massive load-bearing ribs.
  c.strokeStyle='#071925';c.lineWidth=25;c.beginPath();
  c.moveTo(61,107);c.lineTo(1373,107);c.lineTo(1384,522);
  c.lineTo(1314,567);c.lineTo(122,567);c.lineTo(58,519);c.closePath();c.stroke();
  c.strokeStyle='#7a8b9d';c.lineWidth=11;c.stroke();
  for(const x of [310,718,1124]){
   poly([[x-12,107],[x+21,107],[x+32,557],[x-22,562]],'#293b50','#90a6b2',4);
   line(x-4,119,x+5,535,'#a9c3ca69',2);
  }
  poly([[0,80],[1440,80],[1440,107],[0,107]],'#1b3043');
  rr(0,93,1440,8,2,'#496479');
  for(const x of [112,1245]){
   rr(x-8,112,15,405,6,'#344b60','#8ba2b0',2);
  }
  // Bottom sill physically extends into the control dashboard.
  poly([[36,550],[705,574],[1403,548],[1440,585],[1440,622],[0,622],[0,585]],'#273a51','#7895a6',4);
  line(110,558,1310,560,'#edb96c',5);
 }
 function ceiling(t){
  poly([[0,0],[1440,0],[1390,104],[50,104]],'#1d2b43');
  poly([[360,0],[1080,0],[1005,85],[435,85]],'#31425d','#627995',4);
  rr(495,13,450,64,13,'#132b3c','#607994',3);
  for(let row=0;row<3;row++)for(let col=0;col<17;col++){
   const on=(col+row+Math.floor(t*.001))%7!==0;
   rr(514+col*24,21+row*17,15,9,2,on?'#e7b765':'#485b73');
  }
  for(const x of [145,1120]){
   rr(x,57,180,8,4,'#eebb79');
   rr(x+19,74,140,3,1,'#8bdef1');
  }
  for(const x of [45,1365])rr(x,0,30,95,10,'#364d65','#8099a8',3);
 }
 function consoleBase(t){
  const deck=grad(0,540,0,900,[[0,'#60748a'],[.08,'#344f67'],[.45,'#162a3f'],[1,'#0c192d']]);
  poly([[0,610],[215,571],[1225,571],[1440,630],[1440,900],[0,900]],deck,'#8baac0',5);
  poly([[0,734],[220,673],[1208,673],[1440,752],[1440,900],[0,900]],'#1b2b47','#58738a',5);
  // Built-in mounts on either side of the HTML console.
  for(const [x,y] of [[175,641],[1250,642]]){
   rr(x-82,y-29,164,98,12,'#10283c','#648ea2',4);
   for(let a=0;a<2;a++)for(let b=0;b<4;b++){
    const pulse=.6+.35*Math.sin(t*.002+b+a*3);
    c.globalAlpha=pulse;rr(x-60+b*34,y-13+a*36,22,19,3,b%2?'#f2b66e':'#62d3ea');c.globalAlpha=1;
   }
  }
  // Side sonar instrument with a rotating scan line.
  c.save();c.translate(1285,756);
  c.fillStyle='#06283b';c.strokeStyle='#72cfe2';c.lineWidth=4;c.beginPath();c.arc(0,0,56,0,TAU);c.fill();c.stroke();
  for(let k=1;k<4;k++){c.strokeStyle='#52afc26e';c.lineWidth=1;c.beginPath();c.arc(0,0,k*13,0,TAU);c.stroke();}
  c.rotate(t*.00045);line(-48,0,48,0,'#9ef3f6',2);line(0,-48,0,48,'#9ef3f655',1);c.restore();
  // Pilot lever tracks below the transparent projected visor.
  for(const x of [120,170,1340]){
   rr(x-24,775,47,99,9,'#102233','#6b8693',4);
   line(x,846,x,806,'#c8d7e1',7);rr(x-15,796,30,24,7,'#e0a754','#ffda8a',2);
  }
  // Metal details and false-status lamps, without blocking interactive keys.
  for(let i=0;i<19;i++){
   const x=240+i*52;
   c.fillStyle=i%5===0?'#f5bb68':'#4bbdd1';c.globalAlpha=.55+(Math.sin(t*.002+i)*.2);
   c.beginPath();c.arc(x,662,3.2,0,TAU);c.fill();
  }c.globalAlpha=1;
  line(215,888,1210,888,'#5c7d91',5);
 }
 function chair(x,y,scale=1){
  c.save();c.translate(x,y);c.scale(scale,scale);
  rr(-122,-16,239,354,53,'#0e1b30','#71869e',9);
  rr(-103,9,203,288,40,'#1b2c44','#36485f',6);
  rr(-96,38,190,207,26,'#101c2e','#40536b',3);
  rr(-145,225,72,155,29,'#354861','#95a8bc',6);
  rr(71,225,72,155,29,'#354861','#95a8bc',6);
  line(-88,60,79,60,'#526d88',3);c.restore();
 }
 function diver(t,compact=false){
  const female=gender()==='female',x=compact?608:282,y=compact?410:428;
  c.save();c.translate(x,y);c.scale(compact?.77:1.02,compact?.77:1.02);
  c.lineJoin='round';c.lineCap='round';
  chair(-14,123,.98);
  // Thick external oxygen cylinder and its physical shoulder harness.
  rr(-130,176,57,174,23,'#102638','#96acbb',5);
  rr(-121,195,38,106,14,'#294760','#c9bd83',3);
  rr(-121,219,39,10,4,'#d9ae60');
  rr(-119,316,36,15,4,'#d9ae60');
  c.strokeStyle='#58d8ed';c.lineWidth=5;c.beginPath();c.moveTo(-101,175);c.bezierCurveTo(-105,97,-42,96,4,126);c.stroke();
  // Bent legs / lower suit. One leg extends toward the console; both remain connected to the hips.
  c.fillStyle='#162c40';c.strokeStyle='#607c95';c.lineWidth=4;
  c.beginPath();c.moveTo(-64,295);c.bezierCurveTo(0,270,67,273,97,306);c.lineTo(176,354);c.lineTo(139,387);
  c.lineTo(34,352);c.lineTo(-42,366);c.closePath();c.fill();c.stroke();
  c.beginPath();c.moveTo(-71,320);c.bezierCurveTo(-90,356,-47,401,14,405);c.lineTo(109,414);c.lineTo(123,387);
  c.lineTo(32,363);c.closePath();c.fill();c.stroke();
  // Integrated neoprene pressure suit, anatomically shaped torso/shoulders.
  const suit=grad(-95,110,130,322,[[0,'#050f1e'],[.4,'#183a5a'],[.68,'#0b1e35'],[1,'#263a53']]);
  c.fillStyle=suit;c.strokeStyle='#678da1';c.lineWidth=4;
  c.beginPath();c.moveTo(-37,110);c.quadraticCurveTo(-96,109,-116,189);
  c.lineTo(-77,294);c.quadraticCurveTo(-7,319,92,291);
  c.lineTo(115,169);c.quadraticCurveTo(107,119,47,106);
  c.closePath();c.fill();c.stroke();
  // Side armour, harness, hose couplings and cyan-light strips.
  poly([[-82,135],[-54,119],[-30,148],[-42,212],[-96,203]],'#283d55','#7494a4',3);
  poly([[41,117],[88,134],[106,196],[72,211],[48,154]],'#263d58','#84a5b3',3);
  line(-57,146,32,250,'#0a1729',16);line(-57,146,32,250,'#8f9fb0',3);
  rr(-13,215,29,25,7,'#123f54','#5fe5ef',3);
  for(let i=0;i<3;i++)rr(-67+i*28,284,16,5,2,'#e9ad5d');
  // Right arm on the control desk, articulated at shoulder, elbow and glove.
  c.strokeStyle='#091828';c.lineWidth=34;c.beginPath();c.moveTo(87,157);c.lineTo(124,222);c.lineTo(205,238);c.stroke();
  c.strokeStyle='#28465e';c.lineWidth=26;c.stroke();
  c.strokeStyle='#6e9cb2';c.lineWidth=3;c.beginPath();c.moveTo(95,171);c.lineTo(121,224);c.lineTo(196,235);c.stroke();
  rr(192,223,26,24,9,'#0d2033','#77b5cc',3);
  // Left forearm remains separate and visible, not a duplicate right arm.
  c.strokeStyle='#101b30';c.lineWidth=34;c.beginPath();c.moveTo(-95,180);c.lineTo(-111,260);c.lineTo(-53,281);c.stroke();
  c.strokeStyle='#345169';c.lineWidth=24;c.stroke();rr(-65,269,31,23,8,'#162c40','#6eb2c4',3);
  // Neck and rigid pressure collar support the face.
  rr(-17,89,51,57,18,'#a07056','#24374b',5);
  c.fillStyle='#1b354a';c.strokeStyle='#81b3c6';c.lineWidth=4;c.beginPath();c.ellipse(12,130,60,24,0,0,TAU);c.fill();c.stroke();
  // Flowing hair appears behind the entire head and across the collar.
  const sway=Math.sin(t*.0013)*6;
  c.fillStyle='#0c101a';c.strokeStyle='#333c51';c.lineWidth=3;
  c.beginPath();c.moveTo(-58,-39);c.bezierCurveTo(-89,-103,37,-133,77,-79);
  c.bezierCurveTo(101,-32,61,23,40,29);
  if(female){
   c.bezierCurveTo(40,106,12,161,-52,188+sway);
   c.bezierCurveTo(-37,134,-91,144,-99,80+sway);
   c.bezierCurveTo(-136,52,-101,-19,-58,-39);
  }else{
   c.bezierCurveTo(32,25,-45,45,-77,8);c.bezierCurveTo(-100,-17,-70,-29,-58,-39);
  }
  c.closePath();c.fill();c.stroke();
  // Visible 3/4 face, cheeks, eyes, nose and jaw, all on a single head.
  const skin=grad(-36,-60,85,101,[[0,'#c79174'],[.51,'#e9b090'],[1,'#9d6b5b']]);
  c.fillStyle=skin;c.strokeStyle='#5c4a49';c.lineWidth=3;
  c.beginPath();c.moveTo(-49,-46);c.bezierCurveTo(-36,-91,44,-96,76,-44);
  c.quadraticCurveTo(88,-3,94,17);c.quadraticCurveTo(113,27,88,43);
  c.quadraticCurveTo(74,95,23,103);c.quadraticCurveTo(-43,75,-51,15);c.closePath();c.fill();c.stroke();
  c.fillStyle='#bb876d';c.beginPath();c.ellipse(-47,25,14,19,-.25,0,TAU);c.fill();
  // Eyes in believable perspective.
  c.strokeStyle='#242a38';c.lineWidth=4;
  c.beginPath();c.moveTo(20,7);c.quadraticCurveTo(39,-2,54,8);c.stroke();
  c.beginPath();c.moveTo(67,10);c.quadraticCurveTo(80,5,84,14);c.stroke();
  c.fillStyle='#15283a';c.beginPath();c.ellipse(41,14,4.5,6,0,0,TAU);c.fill();
  c.beginPath();c.ellipse(78,18,3.2,4.2,0,0,TAU);c.fill();
  c.fillStyle='#f5e0c0';c.beginPath();c.arc(42,12,1.5,0,TAU);c.fill();
  c.strokeStyle='#905d56';c.lineWidth=2;
  c.beginPath();c.moveTo(80,20);c.quadraticCurveTo(92,39,84,40);c.stroke();
  c.strokeStyle='#743c45';c.lineWidth=3;c.beginPath();c.moveTo(47,65);c.quadraticCurveTo(66,72,81,62);c.stroke();
  // Diving mask stays attached above the brow, with a dark metal retention band.
  c.strokeStyle='#263d53';c.lineWidth=13;c.beginPath();c.moveTo(-56,-33);c.quadraticCurveTo(16,-71,81,-36);c.stroke();
  c.fillStyle='#142d44';c.strokeStyle='#9ad9eb';c.lineWidth=5;
  c.beginPath();c.moveTo(-33,-52);c.quadraticCurveTo(22,-75,70,-48);c.lineTo(63,-23);
  c.quadraticCurveTo(20,-31,-25,-23);c.closePath();c.fill();c.stroke();
  c.fillStyle=grad(-20,-67,67,-25,[[0,'#c3ffff'],[.5,'#2b94bf'],[1,'#163757']]);
  c.beginPath();c.moveTo(-24,-50);c.quadraticCurveTo(13,-65,60,-45);c.lineTo(54,-30);c.quadraticCurveTo(10,-37,-17,-30);c.closePath();c.fill();
  line(-16,-46,8,-55,'#efffff',4);
  rr(-57,-25,20,27,7,'#183a53','#86e2e3',3);
  c.fillStyle='#85f5f6';c.beginPath();c.arc(-47,-12,4,0,TAU);c.fill();
  // Hair on top: the same black loose style as the playable diver.
  c.fillStyle='#090e18';c.strokeStyle='#3c4554';c.lineWidth=2;
  c.beginPath();c.moveTo(-54,-46);c.bezierCurveTo(-71,-110,39,-113,76,-76);
  c.quadraticCurveTo(83,-55,71,-47);c.bezierCurveTo(32,-95,-23,-70,-54,-46);c.fill();c.stroke();
  const locks=female?12:7;
  for(let i=0;i<locks;i++){
   const rootX=-55+i*9.2,rootY=-73-Math.sin(i/locks*Math.PI)*23;
   const len=(female?58:17)+(i%4)*9,dir=i%2===0?-1:1;
   c.strokeStyle=i%4===0?'#4b5060':'#151d2a';c.lineWidth=2.4+(i%3)*.5;
   c.beginPath();c.moveTo(rootX,rootY);c.bezierCurveTo(rootX-25,rootY+12,rootX-45+dir*sway,rootY+len*.75,rootX-35+dir*sway,rootY+len);
   c.stroke();
  }
  // Helmet-side headlamp on the suit, not an unrelated sci-fi crown.
  rr(-58,-60,22,13,4,'#344e65','#d8be85',2);rr(-55,-58,12,8,3,'#d9f9e9');
  c.restore();
 }
 function scene(t){
  size();c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
  const compact=width<700,scale=Math.max(width/1440,height/900);
  const center=compact?705:720;
  c.save();c.translate(width/2-center*scale,(height-900*scale)/2);c.scale(scale,scale);
  c.fillStyle=grad(0,0,1440,900,[[0,'#1a3045'],[.55,'#0e2439'],[1,'#040e1d']]);c.fillRect(0,0,1440,900);
  ceiling(t);windows(t);consoleBase(t);
  // The chair & diver are part of the cockpit, not a pasted profile image.
  diver(t,compact);
  // The right co-pilot seat remains empty, as in a real command bridge.
  if(!compact)chair(1389,670,.62);
  c.restore();
 }
 function tick(t){
  if(!active||screen.hidden)return;
  frame=requestAnimationFrame(tick);
  if(t-lastPaint<34)return;lastPaint=t;
  scene(t);
 }
 function open(){if(screen.hidden)return;active=true;lastPaint=0;cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);}
 function close(){active=false;cancelAnimationFrame(frame);frame=0;}
 window.addEventListener('abyssal-account-data',e=>{accountGender=e.detail?.diverGender==='female'?'female':'male';});
 window.addEventListener('resize',()=>{if(active)size();});
 window.AbyssalSubmarineCockpit=Object.freeze({open,close});
})();