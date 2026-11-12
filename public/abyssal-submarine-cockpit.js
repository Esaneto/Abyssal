/* ABYSSAL — original procedural command bridge, revision 2.
 * One camera and one material palette. The live HTML console is the actual
 * instrument panel; no reference screenshot, old cabin bitmap or cartoon
 * pilot is composited behind it. Canvas owns only scenery and hardware.
 */
(function(){
 'use strict';
 const screen=document.getElementById('submarineWorkshop');
 const canvas=document.getElementById('abyssCockpitCanvas');
 if(!screen||!canvas)return;
 const main=canvas.getContext('2d');if(!main)return;
 // Live overhead command panel. Keep gameplay settings on the device.
 const commands=screen.querySelector('.abyss-cockpit-top-actions'),settings=document.getElementById('cockpitCommandSettings');
 const store=(key,value)=>{try{localStorage.setItem(key,String(value));}catch(_){}};
 const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch(_){return fallback;}};
 const filters={normal:'none',soft:'saturate(.75)',mono:'grayscale(1)',warm:'sepia(.25)'};
 function applyFilter(value){const filter=filters[value]||'none';for(const id of ['game','abyssCockpitCanvas']){const element=document.getElementById(id);if(element)element.style.filter=filter;}}
 applyFilter(read('abyssalVisualFilter','normal'));
 let activeSetting='';
 function closeSettings(){activeSetting='';if(settings)settings.hidden=true;commands?.querySelectorAll('[data-cockpit-setting]').forEach(button=>button.setAttribute('aria-expanded','false'));}
 function field(label,options,value,change){const wrap=document.createElement('label'),select=document.createElement('select');wrap.append(document.createTextNode(label),select);for(const [id,name] of options){const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option);}select.value=value;select.addEventListener('change',()=>change(select.value));return wrap;}
 function slider(label,key,initial){const wrap=document.createElement('label'),caption=document.createElement('span'),input=document.createElement('input');input.type='range';input.min=0;input.max=100;input.value=read(key,initial);caption.textContent=label+' · '+input.value+'%';input.setAttribute('aria-label',label);input.addEventListener('input',()=>{store(key,input.value);caption.textContent=label+' · '+input.value+'%';window.dispatchEvent(new CustomEvent('abyssal-volume-change',{detail:{channel:key,value:Number(input.value)/100}}));});wrap.append(caption,input);return wrap;}
 commands?.addEventListener('click',event=>{
  const proxy=event.target.closest('[data-cockpit-proxy]');if(proxy){closeSettings();document.getElementById(proxy.dataset.cockpitProxy)?.click();return;}
  const button=event.target.closest('[data-cockpit-setting]');if(!button||!settings)return;
  const name=button.dataset.cockpitSetting;if(activeSetting===name){closeSettings();return;}closeSettings();activeSetting=name;button.setAttribute('aria-expanded','true');settings.replaceChildren();settings.hidden=false;
  if(name==='controls'){
   const optsPC=[['classic','Clique e segure para mover'],['wasd-aim','WASD + mouse']],optsMobile=[['classic','Toque e arraste'],['dual-stick','Joystick e disparo']];
   settings.append(field('Controles PC',optsPC,read('abyssalControlsPc','classic'),value=>document.querySelector('#controlsScreen [data-control-pc="'+value+'"]')?.click()),field('Controles mobile',optsMobile,read('abyssalControlsMobile','classic'),value=>document.querySelector('#controlsScreen [data-control-mobile="'+value+'"]')?.click()));
  }else if(name==='zoom'){
   settings.append(field('Zoom da câmera (solo)',[['1','Padrão'],['1.1','110%'],['1.25','125%']],read('abyssalCameraZoom','1'),value=>store('abyssalCameraZoom',value)));
   const note=document.createElement('small');note.textContent='No online, a visão permanece equilibrada pelo jogo.';settings.append(note);
  }else if(name==='volume'){
   settings.append(slider('Efeitos','abyssalSfxVolume','80'),slider('Música','abyssalMusicVolume','45'));
   const note=document.createElement('small');note.textContent='O áudio do jogo está desativado nesta versão; os ajustes ficam salvos.';settings.append(note);
  }else if(name==='filter'){
   settings.append(field('Filtro visual',[['normal','Original'],['soft','Suave'],['mono','Monocromático'],['warm','Quente']],read('abyssalVisualFilter','normal'),value=>{store('abyssalVisualFilter',value);applyFilter(value);}));
  }
 });
 document.addEventListener('pointerdown',event=>{if(activeSetting&&!commands?.contains(event.target))closeSettings();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&activeSetting)closeSettings();});

 let c=main,active=false,raf=0,lastPaint=0,width=0,height=0,dpr=1,frames=0;
 let background=null,foreground=null;
 const W=1440,H=900,TAU=Math.PI*2;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const rgb=(r,g,b,a=1)=>'rgba('+r+','+g+','+b+','+a+')';
 const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const gradient=(x1,y1,x2,y2,stops)=>{
  const g=c.createLinearGradient(x1,y1,x2,y2);
  for(const [p,col]of stops)g.addColorStop(p,col);return g;
 };
 const radial=(x,y,r,stops)=>{
  const g=c.createRadialGradient(x,y,0,x,y,r);
  for(const [p,col]of stops)g.addColorStop(p,col);return g;
 };
 function rect(x,y,w,h,r,fill,stroke=null,sw=1){
  c.beginPath();c.roundRect(x,y,w,h,r);
  if(fill){c.fillStyle=fill;c.fill();}
  if(stroke){c.lineWidth=sw;c.strokeStyle=stroke;c.stroke();}
 }
 function poly(points,fill,stroke=null,sw=1){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  if(fill){c.fillStyle=fill;c.fill();}
  if(stroke){c.lineWidth=sw;c.strokeStyle=stroke;c.stroke();}
 }
 function line(x1,y1,x2,y2,color,w=1){
  c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
 }
 function ellipse(x,y,rx,ry,fill,stroke=null,sw=1){
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);
  if(fill){c.fillStyle=fill;c.fill();}
  if(stroke){c.strokeStyle=stroke;c.lineWidth=sw;c.stroke();}
 }
 function metal(x1,y1,x2,y2){
  return gradient(x1,y1,x2,y2,[[0,'#677a84'],[.075,'#334a56'],[.23,'#202f3c'],
   [.49,'#101e29'],[.74,'#263a49'],[.92,'#111d27'],[1,'#091018']]);
 }
 function hardware(x,y,w,h,r=7){
  rect(x,y,w,h,r,'#07111a','#071017',2);
  rect(x+2,y+2,w-4,h-5,Math.max(1,r-2),metal(x,y,x,y+h),'#536471',1);
  line(x+7,y+3,x+w-7,y+3,'#93a7af55',1.4);
  line(x+7,y+h-5,x+w-7,y+h-5,'#02070a',1.7);
 }
 function bolt(x,y,r=5){
  ellipse(x,y,r+1,r+1,'#080f15','#788b92',.8);
  ellipse(x,y,r-1,r-1,gradient(x-r,y-r,x+r,y+r,[[0,'#81919b'],[.45,'#344751'],[1,'#0a161d']]));
  line(x-r*.47,y-r*.38,x+r*.48,y+r*.32,'#0b1821',1.5);
 }
 function lamp(x,y,w,h,amber=false){
  const color=amber?'#ffbc68':'#62e3e4';
  rect(x-3,y-3,w+6,h+6,Math.min(5,h),'#09131b','#4e6370',1);
  c.save();c.shadowColor=color;c.shadowBlur=amber?13:10;
  rect(x,y,w,h,2,gradient(x,y,x,y+h,[[0,amber?'#fff1c5':'#e4ffff'],[.4,color],[1,amber?'#d9792c':'#137589']]));
  c.restore();
 }
 function brush(x,y,w,h,seed,count=90){
  const rnd=random(seed);
  c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
  for(let i=0;i<count;i++){
   const xx=x+rnd()*w,yy=y+rnd()*h,l=8+rnd()*95;
   line(xx,yy,xx+l,yy,rgb(174,208,218,.016+rnd()*.035),.5+rnd()*.7);
  }c.restore();
 }
 function glassPath(){
  c.beginPath();c.moveTo(92,95);c.quadraticCurveTo(102,79,127,79);
  c.lineTo(1313,79);c.quadraticCurveTo(1338,79,1348,95);
  c.lineTo(1412,315);c.quadraticCurveTo(1420,338,1393,346);
  c.lineTo(47,346);c.quadraticCurveTo(20,338,28,315);c.closePath();
 }
 // Organic silhouettes: multiple rock planes recede into the blue haze.
 function exteriorReef(x,base,w,h,seed,near){
  const rnd=random(seed),points=[[x-w*.58,base]];
  for(let i=0;i<=12;i++){
   const q=i/12,xx=x-w*.58+q*w*1.16;
   const arch=Math.pow(Math.sin(q*Math.PI),.72);
   points.push([xx,base-h*arch*(.54+rnd()*.4)]);
  }
  points.push([x+w*.58,base+8]);
  c.save();poly(points,gradient(x,base-h,x,base+10,near?
   [[0,'#175269'],[.27,'#103b50'],[.68,'#0a293e'],[1,'#071927']]:
   [[0,'#25677c'],[.55,'#18475d'],[1,'#0c2d40']]));
  c.clip();
  for(let i=0;i<(near?46:23);i++){
   const px=x-w*.58+rnd()*w*1.16,py=base-rnd()*h,span=18+rnd()*w*.23;
   const dy=6+rnd()*26;
   poly([[px,py],[px+span*.54,py-dy],[px+span,py+dy*.4],[px+span*.78,py+dy*1.5],[px+span*.18,py+dy]],
    rgb(near?7:28,near?28:67,near?42:81,.22+rnd()*.22));
   line(px+span*.1,py+1,px+span*.55,py-dy+2,rgb(88,170,183,.08+rnd()*.12),1);
  }
  c.restore();
 }
 function waterBase(){
  c.save();glassPath();c.clip();
  c.fillStyle=gradient(0,78,0,350,[[0,'#1a768b'],[.24,'#12526b'],[.62,'#10364d'],[1,'#071b2c']]);c.fillRect(0,64,W,310);
  c.fillStyle=radial(850,73,580,[[0,'#63cfd657'],[.48,'#2f92ae25'],[1,'#08253900']]);c.fillRect(0,70,W,286);
  exteriorReef(145,350,540,210,51,false);exteriorReef(1270,354,490,246,39,false);
  exteriorReef(566,355,525,102,71,false);exteriorReef(1110,357,600,128,22,false);
  exteriorReef(-20,357,440,210,97,true);exteriorReef(1470,357,460,217,19,true);
  // Small darker shelves and thin ribbon kelp: do not compete with the menu.
  exteriorReef(265,353,360,72,14,true);exteriorReef(1170,351,365,96,61,true);
  const rng=random(917);
  for(let i=0;i<26;i++){
   const x=i<13?30+rng()*285:1130+rng()*280,y=350-rng()*20,h=24+rng()*72;
   c.strokeStyle=rgb(34,108,111,.22+rng()*.32);c.lineWidth=2+rng()*3;
   c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x-13,y-h*.35,x+15,y-h*.7,x-5,y-h);c.stroke();
  }
  c.restore();
 }
 function fish(x,y,s,t,phase,dir=1){
  c.save();c.translate(x,y+Math.sin(t*.0012+phase)*2.2);c.scale(s*dir,s);
  const flick=Math.sin(t*.007+phase)*4;
  const body=gradient(0,-10,0,10,[[0,'#0d2a3b'],[.48,'#174a5c'],[1,'#70a9a6']]);
  c.beginPath();c.moveTo(-17,-1);c.bezierCurveTo(-6,-11,15,-8,23,-.5);c.bezierCurveTo(13,7,-5,10,-17,1);c.closePath();c.fillStyle=body;c.fill();
  poly([[-16,0],[-32,-8+flick],[-27,0],[-32,8+flick]],'#1a4555');
  poly([[-8,-6],[2,-13],[7,-7]],'#123548');
  poly([[5,2],[-5,12],[-8,5]],'#244b58');
  ellipse(17,-1,1.45,1.45,'#a6d5c6');ellipse(17.2,-1,.7,.7,'#07151e');
  c.restore();
 }
 function manta(x,y,s,t){
  c.save();c.translate(x,y+Math.sin(t*.001)*6);c.scale(s,s);
  const flap=Math.sin(t*.0021)*9;
  c.beginPath();c.moveTo(-58,-11-flap);c.bezierCurveTo(-33,-11,-13,-22,0,-12);
  c.bezierCurveTo(15,-21,37,-11,58,-11+flap);c.quadraticCurveTo(35,22,0,19);
  c.quadraticCurveTo(-35,21,-58,-11-flap);c.closePath();
  c.fillStyle=gradient(0,-23,0,28,[[0,'#225e72'],[.6,'#153d54'],[1,'#0a2c41']]);c.fill();
  c.strokeStyle='#4c8d9b99';c.lineWidth=1.3;c.stroke();
  c.strokeStyle='#315e70';c.lineWidth=2;c.beginPath();c.moveTo(0,16);c.quadraticCurveTo(-1,46,-12,65);c.stroke();
  c.restore();
 }
 function reflectedWater(t){
  c.save();glassPath();c.clip();c.globalCompositeOperation='screen';
  for(let i=0;i<6;i++){
   const x=270+i*181+Math.sin(t*.00029+i*2)*16;
   poly([[x,80],[x+18,80],[x+145,351],[x+63,351]],gradient(x,80,x+90,350,
    [[0,'#b2effb1c'],[.35,'#6ed0e811'],[1,'#28758d00']]));
  }
  c.restore();
 }
 function livingOcean(t){
  c.save();glassPath();c.clip();
  const time=t*.001;
  for(let i=0;i<23;i++){
   const school=i<13?0:1,j=school?i-13:i;
   const speed=school?11:17;
   const x=((j*39+time*speed+(school?930:230))%1590)-80;
   const y=(school?175:119)+(j%5)*13+Math.sin(j*2.3)*10;
   c.globalAlpha=school?.54:.7;fish(x,y,(school?.48:.66)+(j%3)*.08,t,j,1);
  }
  c.globalAlpha=.76;manta(1480-((time*12+390)%1640),220,.73,t);c.globalAlpha=1;
  for(let i=0;i<47;i++){
   const x=(i*157+Math.sin(time*.7+i)*9)%1440;
   const y=87+((i*47-time*(2+i%4)+2600)%250);
   const a=.10+(i%6)*.025;
   ellipse(x,y,.55+(i%3)*.45,.55+(i%3)*.45,rgb(174,230,229,a));
  }
  c.restore();reflectedWater(t);
 }
 // One coherent hull, with pressure ribs, glass gaskets and integrated deck.
 function hull(){
  c.fillStyle=gradient(0,0,W,H,[[0,'#233746'],[.35,'#121f2b'],[.75,'#101d28'],[1,'#060d15']]);c.fillRect(0,0,W,H);
  waterBase();
 }
 function windowFrame(){
  c.save();glassPath();c.strokeStyle='#020a10';c.lineWidth=34;c.stroke();
  c.strokeStyle=gradient(0,79,0,350,[[0,'#899ba3'],[.12,'#3a4e5b'],[.46,'#182b38'],[.88,'#506b78'],[1,'#111d29']]);c.lineWidth=23;c.stroke();
  c.strokeStyle='#0c1d2a';c.lineWidth=10;c.stroke();
  c.strokeStyle='#447c89';c.lineWidth=2;c.stroke();
  // Deep structural ribs, bevelled inward instead of flat blue window frames.
  for(const [x,dx]of [[315,-62],[1125,62]]){
   poly([[x-20,80],[x+17,80],[x+dx+22,346],[x+dx-24,346]],metal(x-28,90,x+32,90),'#07121a',3);
   line(x-14,88,x+dx-17,340,'#839ca67b',2);
   line(x+15,88,x+dx+17,342,'#030a10',4);
  }
  // Crown slopes away from the viewer; ceiling fixtures illuminate actual metal.
  poly([[0,0],[W,0],[W,75],[1280,91],[160,91],[0,74]],metal(0,0,0,92),'#07111a',2);
  poly([[0,0],[355,0],[422,52],[373,79],[62,79]],gradient(0,0,0,80,[[0,'#3f515e'],[.65,'#182630'],[1,'#08151e']]),'#0a1119',3);
  poly([[W,0],[1085,0],[1018,52],[1067,79],[1378,79]],gradient(0,0,0,80,[[0,'#3f515e'],[.65,'#182630'],[1,'#08151e']]),'#0a1119',3);
  hardware(360,8,720,49,9);
  for(let r=0;r<2;r++)for(let i=0;i<24;i++)rect(380+i*29,18+r*15,17,7,1,(i+r)%5===0?'#c68d46':'#347f8e');
  lamp(174,62,138,4,true);lamp(1128,62,138,4,true);lamp(625,68,190,4,false);
  for(const x of [95,310,560,880,1130,1345])bolt(x,76,3.5);
  brush(0,0,W,74,152,105);
  c.restore();
 }
 function radar(x,y,w,h){
  hardware(x,y,w,h,11);
  rect(x+8,y+8,w-16,h-16,6,gradient(x,y,x,y+h,[[0,'#0d3849'],[1,'#061923']]),'#376f7b',1.5);
  const cx=x+w*.5,cy=y+h*.52,r=Math.min(w,h)*.33;
  c.save();c.beginPath();c.rect(x+10,y+10,w-20,h-20);c.clip();
  for(let i=1;i<=4;i++)ellipse(cx,cy,r*i/4,r*i/4,null,'#5bd6c335',1);
  for(let i=0;i<8;i++){const a=i*TAU/8;line(cx,cy,cx+Math.cos(a)*r,cy+Math.sin(a)*r,'#4b98a13d');}
  poly([[cx,cy],[cx+r*.66,cy-r*.75],[cx+r*.94,cy-r*.28]],'#69ead32b');
  line(cx,cy,cx+r*.66,cy-r*.75,'#90f2d8',1.6);
  for(const [a,b]of [[-.43,.28],[.22,-.55],[.58,.27]])ellipse(cx+a*r,cy+b*r,2.2,2.2,'#c6f9c6');
  c.fillStyle='#6fc5cc';c.font='600 8px monospace';c.fillText('SONAR / LOCAL',x+16,y+23);c.fillText('SIGNAL  86%',x+16,y+h-15);
  c.restore();
 }
 function readout(x,y,w,h,seed){
  hardware(x,y,w,h,7);rect(x+6,y+6,w-12,h-12,4,'#061822','#225361');
  const rnd=random(seed);
  for(let i=0;i<6;i++){
   const yy=y+16+i*(h-28)/6;
   rect(x+16,yy,w-32,3,1,'#203d46');
   rect(x+16,yy,(w-32)*(.25+rnd()*.68),3,1,i===4?'#c99650':'#3ea9ae');
  }
 }
 function deck(){
  // This continuous deck physically supports the DOM panel. It begins behind
  // the monitor and extends toward the camera, with two side stations.
  poly([[0,335],[207,315],[1233,315],[W,335],[W,900],[0,900]],
   metal(0,330,0,900),'#08111b',3);
  poly([[0,345],[201,328],[1239,328],[W,345],[W,610],[0,610]],
   gradient(0,340,0,615,[[0,'#4b6570'],[.06,'#263a49'],[.17,'#132532'],[.59,'#293f4d'],[1,'#0a1823']]),'#07131c',2);
  // Side surfaces angle inward to the single central instrument monitor.
  poly([[0,366],[190,347],[251,500],[214,737],[0,770]],metal(0,350,235,740),'#0a1822',3);
  poly([[W,366],[1250,347],[1189,500],[1226,737],[W,770]],metal(W,350,1205,740),'#0a1822',3);
  line(0,374,187,357,'#78949c77',2);line(W,374,1253,357,'#78949c77',2);
  line(0,600,210,560,'#070e16',5);line(W,600,1230,560,'#070e16',5);
  lamp(23,353,113,5,true);lamp(1304,353,113,5,true);
  radar(29,398,136,115);radar(1275,398,136,115);
  // Live HTML profile/community buttons occupy the two plates under the sonars.
  hardware(43,530,119,83,7);hardware(1278,530,119,83,7);
  for(const x of [48,1294]){
   hardware(x,629,91,72,7);
   for(let i=0;i<3;i++){
    const xx=x+13+i*24;
    rect(xx,642,13,43,3,'#050c13','#576974',1);
    rect(xx-2,648+i%2*11,17,11,3,gradient(0,645,0,675,[[0,'#d5c6a4'],[.4,'#ab7a3c'],[1,'#56371f']]),'#c29c6d',1);
   }
  }
  // Central lower fascia is one piece of the hull, not a second fake UI.
  poly([[237,670],[1203,670],[1300,900],[140,900]],gradient(0,670,0,900,[[0,'#233a49'],[.18,'#172b38'],[.35,'#0b1a25'],[.88,'#233947'],[1,'#07101a']]),'#08131b',4);
  line(245,678,1195,678,'#718b96aa',2);
  line(208,830,1232,830,'#050b12',5);
  lamp(523,861,145,5,true);lamp(772,861,145,5,true);
  for(const [x,y]of [[19,379],[190,388],[22,610],[204,721],[1421,379],[1250,388],[1418,610],[1236,721],[279,818],[1161,818]])bolt(x,y,4.5);
  brush(0,340,212,410,481,98);brush(1228,340,212,410,483,98);
 }
 // Only partial padded seats at the edges. No mismatched avatar is painted
 // over the command panel. The playable diver artwork is untouched.
 function chair(x,mirror){
  c.save();c.translate(x,0);c.scale(mirror,1);
  c.fillStyle='#030b12';c.beginPath();c.moveTo(-22,900);c.lineTo(-15,663);
  c.quadraticCurveTo(1,617,65,627);c.lineTo(151,645);c.quadraticCurveTo(184,656,187,705);
  c.lineTo(206,900);c.closePath();c.fill();
  c.beginPath();c.moveTo(-16,900);c.lineTo(-7,674);c.quadraticCurveTo(9,639,65,646);
  c.lineTo(145,663);c.quadraticCurveTo(170,671,174,715);c.lineTo(192,900);c.closePath();
  c.fillStyle=gradient(0,650,183,900,[[0,'#536777'],[.13,'#2c414e'],[.48,'#162630'],[.79,'#0a1823'],[1,'#2e414f']]);c.fill();c.strokeStyle='#60727c';c.lineWidth=2;c.stroke();
  c.beginPath();c.moveTo(6,900);c.lineTo(16,702);c.quadraticCurveTo(18,667,63,675);c.lineTo(127,687);
  c.quadraticCurveTo(145,691,149,730);c.lineTo(161,900);c.closePath();
  c.fillStyle=gradient(18,680,154,901,[[0,'#304652'],[.24,'#192c39'],[.64,'#0c1a25'],[1,'#122733']]);c.fill();c.strokeStyle='#08121c';c.lineWidth=3;c.stroke();
  line(22,708,137,729,'#5e758366',1.4);line(18,757,144,775,'#060e17',3);
  line(15,762,145,780,'#4b657040',1);line(11,820,152,835,'#071019',3);
  lamp(35,854,37,4,false);c.restore();
 }
 function foregroundArt(){
  windowFrame();deck();if(width>700){chair(0,1);chair(W,-1);}else{radar(105,90,360,65);radar(975,90,360,65);hardware(105,162,360,65,7);hardware(975,162,360,65,7);}
  // Edge vignette ties the glass and metal to the same lighting environment.
  c.fillStyle=radial(W*.5,H*.43,880,[[0,'#00000000'],[.65,'#00000000'],[1,'#02091270']]);c.fillRect(0,0,W,H);
 }
 function size(){
  const b=canvas.getBoundingClientRect();width=Math.max(320,b.width);height=Math.max(260,b.height);
  dpr=Math.min(1.5,Math.max(1,window.devicePixelRatio||1),Math.sqrt(2100000/(width*height)));
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  background=null;foreground=null;
 }
 function layer(draw){
  if(typeof document.createElement!=='function')return null;
  const surface=document.createElement('canvas');surface.width=canvas.width;surface.height=canvas.height;
  const context=surface.getContext('2d');if(!context)return null;
  const previous=c;c=context;
  try{c.setTransform(surface.width/W,0,0,surface.height/H,0,0);draw();}
  finally{c=previous;}
  return surface;
 }
 function build(){
  background=layer(hull);foreground=layer(foregroundArt);
 }
 function scene(t){
  c=main;c.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);c.clearRect(0,0,W,H);
  if(background)c.drawImage(background,0,0,W,H);else hull();
  livingOcean(t);
  if(foreground)c.drawImage(foreground,0,0,W,H);else foregroundArt();
  frames++;
 }
 function tick(t){
  if(!active||screen.hidden)return;
  raf=requestAnimationFrame(tick);
  if(t-lastPaint<40)return;lastPaint=t;scene(t);
 }
 function open(){
  if(screen.hidden)return;
  active=true;lastPaint=0;cancelAnimationFrame(raf);size();build();scene(0);raf=requestAnimationFrame(tick);
 }
 function close(){active=false;cancelAnimationFrame(raf);raf=0;background=null;foreground=null;}
 function visualStatus(){return {original:true,rendered:frames>0,liveOcean:true,bitmapBackdrop:false,frames,mode:width<700?'compact':'desktop',width:Math.round(width),height:Math.round(height)};}
 window.addEventListener('resize',()=>{if(active){size();build();scene(lastPaint||0);}});
 window.AbyssalSubmarineCockpit=Object.freeze({open,close,visualStatus});
})();