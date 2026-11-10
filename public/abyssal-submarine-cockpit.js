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

 // Readable game-art silhouettes. Everything is vector Canvas, not a baked image.
 function manta(x,y,scale,t,phase){
  c.save();c.translate(x,y+Math.sin(t*.00075+phase)*13);c.scale(scale,scale);
  const wing=Math.sin(t*.002+phase)*9;
  c.fillStyle='#21516e';c.strokeStyle='#83d9e4';c.lineWidth=2.7;
  c.beginPath();c.moveTo(-12,-7);
  c.quadraticCurveTo(-41,-26-wing,-83,-29-wing);
  c.quadraticCurveTo(-46,18,0,24);
  c.quadraticCurveTo(49,18,84,-28+wing);
  c.quadraticCurveTo(39,-25+wing,12,-7);
  c.quadraticCurveTo(0,-20,-12,-7);c.closePath();c.fill();c.stroke();
  c.strokeStyle='#bde5e6';c.lineWidth=2;c.beginPath();c.moveTo(0,13);
  c.quadraticCurveTo(-5,45,-15,91);c.stroke();
  c.fillStyle='#94dfed';for(const xx of [-14,14]){c.beginPath();c.arc(xx,-5,2.5,0,TAU);c.fill();}
  c.restore();
 }
 function turtle(x,y,scale,t,seed){
  c.save();c.translate(x,y+Math.sin(t*.0009+seed)*8);c.rotate(Math.sin(t*.0003+seed)*.04);c.scale(scale,scale);
  c.fillStyle='#466e66';c.strokeStyle='#b7d6a1';c.lineWidth=3;
  const flap=Math.sin(t*.0019+seed)*12;
  poly([[-30,-12],[-64,-34-flap],[-78,-11-flap],[-41,7]],'#567d68','#b4d29e',2);
  poly([[20,-14],[59,-37+flap],[76,-10+flap],[36,6]],'#4f745f','#b4d29e',2);
  poly([[-27,14],[-52,28],[-46,37],[-6,20]],'#57735c','#aec99a',2);
  poly([[20,13],[49,29],[42,37],[7,21]],'#56745e','#aec99a',2);
  c.beginPath();c.ellipse(0,0,40,26,0,0,TAU);c.fill();c.stroke();
  c.strokeStyle='#90c6aa';c.lineWidth=1.8;
  for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(-20,i*10);c.lineTo(0,i*12+3);c.lineTo(23,i*9);c.stroke();}
  c.fillStyle='#789d85';c.beginPath();c.ellipse(47,0,15,11,0,0,TAU);c.fill();c.stroke();
  c.fillStyle='#061c24';c.beginPath();c.arc(54,-3,2.5,0,TAU);c.fill();
  c.restore();
 }
 function jelly(x,y,scale,t,phase){
  c.save();c.translate(x,y+Math.sin(t*.001+phase)*12);c.scale(scale,scale);
  c.fillStyle='rgba(109,158,204,.22)';c.strokeStyle='rgba(142,205,242,.82)';c.lineWidth=2.5;
  c.beginPath();c.moveTo(-25,0);c.bezierCurveTo(-24,-43,24,-43,26,0);c.quadraticCurveTo(0,12,-25,0);c.fill();c.stroke();
  for(let i=-2;i<=2;i++){
   const xx=i*8;c.strokeStyle=i%2?'rgba(131,217,226,.62)':'rgba(173,134,226,.62)';
   c.lineWidth=1.4;c.beginPath();c.moveTo(xx,2);
   c.bezierCurveTo(xx+Math.sin(t*.001+i)*9,20,xx-8,43,xx+Math.sin(t*.0007+phase+i)*10,64);c.stroke();
  }
  c.restore();
 }
 function panoramicDetails(t){
  // Gentle reflections across the glazing, not a fullscreen translucent UI card.
  c.save();c.globalAlpha=.14;
  for(const x of [136,478,918,1274]){
   c.fillStyle=grad(x,115,x+82,480,[[0,'#e1fbfa21'],[.42,'#8beef322'],[1,'#ffffff00']]);
   poly([[x,113],[x+18,113],[x+85,485],[x+42,485]],c.fillStyle);
  }
  c.restore();
  for(const x of [327,739,1140]){
   c.fillStyle='#081b2a';c.strokeStyle='#9fabb3';c.lineWidth=2;
   c.beginPath();c.arc(x,120,8,0,TAU);c.fill();c.stroke();
   c.fillStyle='#d9c9a8';c.beginPath();c.arc(x,120,2.3,0,TAU);c.fill();
  }
  // Bridge ambient light follows the outside caustics with a subtle delayed shimmer.
  const pulse=.11+.05*Math.sin(t*.0006);
  c.fillStyle='rgba(47,205,226,'+pulse+')';
  c.fillRect(60,541,1316,3);
 }

 function ocean(t){
  // Ocean is clipped to the glass, with no stock illustration or remote assets.
  c.save();c.beginPath();c.moveTo(70,105);c.lineTo(1370,105);c.lineTo(1390,493);
  c.quadraticCurveTo(1370,555,1310,562);c.lineTo(124,562);
  c.quadraticCurveTo(53,555,50,490);c.closePath();c.clip();
  c.fillStyle=grad(0,100,0,575,[[0,'#2788a8'],[.18,'#15729e'],[.62,'#0e4c72'],[1,'#081e3c']]);
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

  // Three staggered canyon layers beyond the submarine, with an illuminated
  // opening, irregular ridges and a distant natural rock arch.
  for(let layer=0;layer<3;layer++){
   const offset=layer*37,wave=Math.sin(t*.00006+layer)*9;
   c.save();c.globalAlpha=.40-layer*.08;
   c.fillStyle=['#123953','#15465b','#0e3149'][layer];
   for(let i=-1;i<7;i++){
    const x=i*295+offset+wave,y=545-layer*28;
    c.beginPath();c.moveTo(x-95,565);c.lineTo(x-72,y-34);
    c.lineTo(x-39,y-86-(i%3)*28);c.lineTo(x+8,y-97-(i%2)*25);
    c.lineTo(x+45,y-49);c.lineTo(x+79,565);c.closePath();c.fill();
   }
   c.restore();
  }
  c.strokeStyle='rgba(9,44,59,.60)';c.lineWidth=56;c.lineCap='round';
  c.beginPath();c.moveTo(794,566);c.bezierCurveTo(845,350,972,347,1100,559);c.stroke();
  c.strokeStyle='rgba(74,157,164,.12)';c.lineWidth=7;
  c.beginPath();c.moveTo(796,557);c.bezierCurveTo(839,372,961,365,1087,553);c.stroke();

  // Bottom foreground rock terraces and reef, seen through the window.
  poly([[0,445],[100,405],[230,476],[325,461],[485,548],[600,550],[0,580]],'#10577b');
  poly([[880,555],[1010,497],[1110,463],[1258,489],[1440,404],[1440,585]],'#134e72');
  for(let i=0;i<18;i++){
   const x=i*82+(i%3)*14;
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
  for(let i=0;i<9;i++){
   const x=((i*271+t*.012*(1+i%3*.25))%1640)-90;
   fish(x,181+(i*79)%244,.34+(i%3)*.11,t,i);
  }
  // Larger recognizable species swim singly or in small, spaced groups.
  manta(((t*.029+850)%1810)-170,280,.57,t,2);
  manta(((t*.029+690)%1810)-170,316,.37,t,3);
  turtle(1050+Math.sin(t*.00032)*52,243,.66,t,5);
  jelly(509+Math.sin(t*.00021)*28,324,.62,t,1);
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
  panoramicDetails(t);
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
  // Marine-grade overhead strip lighting and protective retaining rails.
  rr(443,84,558,7,3,'#0b2437','#64879c',2);
  rr(472,87,495,3,1,'rgba(105,213,227,.67)');
  for(const x of [120,1317]){
   rr(x-48,17,96,17,6,'#0c2538','#77909c',2);
   rr(x-30,22,60,6,3,'#ca9d58');
  }
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
  // Instrument panel plinth and live submarine operating indicators.
  rr(312,649,823,26,8,'#0c1e2c','#627b87',2);
  c.font='700 11px sans-serif';c.textAlign='left';
  for(const [x,label] of [[339,'SONAR ATIVO'],[553,'PRESSÃO ESTÁVEL'],[786,'SISTEMAS ONLINE']]){
   c.fillStyle='#72dcd5';c.beginPath();c.arc(x,662,3.7,0,TAU);c.fill();
   c.fillStyle='#94b9c4';c.fillText(label,x+12,665);
  }
  c.textAlign='start';
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
  // Rear-facing seated pilot in the playable diver's dark blue and cyan suit.
  const female=gender()==='female',x=compact?570:258,y=compact?421:453;
  c.save();c.translate(x,y);c.scale(compact?.69:.81,compact?.69:.81);
  c.lineJoin='round';c.lineCap='round';chair(0,104,.95);
  poly([[-72,260],[-95,315],[-48,370],[22,382],[40,356],[-14,326]],'#142d48','#66869e',4);
  poly([[15,264],[64,301],[132,338],[158,318],[99,278],[70,251]],'#172e49','#65869f',4);
  line(-86,142,-119,205,'#0b1d31',36);line(-119,205,-65,232,'#29465d',29);
  line(85,142,133,202,'#0b1d31',36);line(133,202,193,218,'#29465d',29);
  rr(-75,223,27,22,8,'#102238','#75e2e7',3);rr(185,208,27,22,8,'#102238','#75e2e7',3);
  c.fillStyle=grad(-110,105,108,310,[[0,'#091a2e'],[.5,'#234767'],[1,'#0e253c']]);
  c.strokeStyle='#77a7ba';c.lineWidth=5;c.beginPath();c.moveTo(-60,106);
  c.quadraticCurveTo(-112,119,-109,177);c.lineTo(-83,275);c.quadraticCurveTo(0,317,83,275);
  c.lineTo(109,177);c.quadraticCurveTo(111,119,60,106);c.closePath();c.fill();c.stroke();
  line(-94,164,-82,268,'#5acfe2',4);line(94,164,82,268,'#5acfe2',4);
  // Two distinct oxygen cylinders and safety harness mounted on the back.
  for(const tx of [-46,46]){
   rr(tx-24,140,48,138,19,'#102437','#94b0be',4);
   rr(tx-17,151,34,112,14,'#254962','#60c5d5',2);
   rr(tx-12,129,24,19,5,'#a6b6b6','#253d50',3);
   rr(tx-24,190,48,13,4,'#102034','#8edee5',3);
   rr(tx-23,252,46,12,4,'#c99e5a');
  }
  line(-94,156,94,249,'#071927',12);line(94,156,-94,249,'#071927',12);
  line(-90,156,90,249,'#72cbd9',3);line(90,156,-90,249,'#72cbd9',3);
  rr(-29,211,58,27,8,'#102d43','#65e3ef',3);
  // Reflective suit seam panels, pressure straps, and compact life-support status.
  for(const side of [-1,1]){
   c.strokeStyle='rgba(121,228,234,.57)';c.lineWidth=2.8;c.beginPath();
   c.moveTo(side*83,133);c.quadraticCurveTo(side*116,165,side*87,197);c.stroke();
   rr(side*64-10,247,20,13,4,'#10293d','#78bfcb',2);
  }
  rr(-18,220,36,12,4,'#172d40','#84d9e7',2);
  rr(-9,224,18,4,2,'#8be3c8');
  // Rear of helmet. Hair emerges beneath the lower rim, not through the shell.
  rr(-49,80,98,41,15,'#0e263a','#71aabf',5);
  c.fillStyle='#0d2238';c.strokeStyle='#81b5ca';c.lineWidth=5;c.beginPath();
  c.ellipse(0,7,74,83,0,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle=grad(-65,-45,65,45,[[0,'#1e4b65'],[.6,'#0d3049'],[1,'#183b53']]);
  c.beginPath();c.ellipse(0,9,61,70,0,0,Math.PI*2);c.fill();
  c.strokeStyle='#64deea';c.lineWidth=4;c.beginPath();c.arc(0,11,64,Math.PI*.19,Math.PI*.81);c.stroke();
  const sway=Math.sin(t*.0012)*5,locks=female?9:10;
  for(let j=0;j<locks;j++){
   const hx=-51+j*(female?12.6:11.3),hy=59+j%3*4;
   c.strokeStyle=j%3===0?'#343b4b':'#10121d';c.lineWidth=female?8+j%3:5;
   c.beginPath();c.moveTo(hx,hy);
   if(female)c.bezierCurveTo(hx-12+sway,104,hx+10+sway,137,hx+(j%2?12:-8)+sway,164+j%4*8);
   else c.quadraticCurveTo(hx+4,77+j%3*3,hx+5,87);
   c.stroke();
  }
  rr(-24,-82,48,17,6,'#173c54','#8ae6ee',3);rr(-13,-78,26,9,3,'#f4e9af');
  // Helmet ring and subtle breathing animation.
  c.strokeStyle='rgba(121,234,242,.58)';c.lineWidth=2.7;c.beginPath();
  c.arc(0,7,71,Math.PI*.83,Math.PI*1.13);c.stroke();
  for(let i=0;i<3;i++){
   const travel=(t*.014+i*22)%73;
   c.strokeStyle='rgba(159,228,232,'+(0.29-(travel/73)*.20)+')';c.lineWidth=1.2;
   c.beginPath();c.arc(83+Math.sin(i*2+travel*.12)*6,70-travel,2+i*.7,0,TAU);c.stroke();
  }
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
 function open(){if(screen.hidden)return;active=true;lastPaint=0;cancelAnimationFrame(frame);scene(0);frame=requestAnimationFrame(tick);}
 function close(){active=false;cancelAnimationFrame(frame);frame=0;}
 window.addEventListener('abyssal-account-data',e=>{accountGender=e.detail?.diverGender==='female'?'female':'male';});
 window.addEventListener('resize',()=>{if(active)size();});
 window.AbyssalSubmarineCockpit=Object.freeze({open,close});
})();