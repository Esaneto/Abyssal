/* Abyssal login wardrobe: uses the SAME avatar model and painter as the in-game wardrobe.
 * Purely decorative preview. No changes to saved appearance, owned items or player account.
 */
(function(){
 'use strict';
 const screen=document.getElementById('loginScreen');
 const canvas=document.getElementById('abyssLoginWardrobeCanvas');
 const base=window.AbyssalAvatarBase;
 const painter=window.AbyssalDiverArt;
 if(!screen||!canvas||!base||!painter?.draw)return;
 const looks=[
  {outfit:'navy',mask:'standard',visor:'cyan',eyewear:'none',headgear:'none'},
  {outfit:'rust',mask:'sentinel',visor:'amber',eyewear:'tactical',headgear:'comms'},
  {outfit:'ice',mask:'resonant',visor:'violet',eyewear:'round',headgear:'temple'},
  {outfit:'olive',mask:'standard',visor:'cyan',eyewear:'square',headgear:'clip'}
 ].map(part=>base.normalize({...base.DEFAULT,...part}));
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 let frame=0,lastPaint=0,startedAt=0;
 const active=()=>screen.isConnected&&!screen.hidden&&!document.hidden;
 function paint(now){
  const rect=canvas.getBoundingClientRect();
  if(rect.width<4||rect.height<4)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const w=rect.width,h=rect.height,pw=Math.round(w*dpr),ph=Math.round(h*dpr);
  if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
  const c=canvas.getContext('2d');
  if(!c)return;
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const cx=w/2,cy=h*.78;
  c.save();
  c.fillStyle='rgba(7,195,212,.08)';
  c.beginPath();c.ellipse(cx,cy,Math.min(w*.39,150),Math.max(5,h*.045),0,0,Math.PI*2);c.fill();
  c.lineWidth=2;c.strokeStyle='rgba(94,235,239,.72)';
  c.shadowColor='#34d7e1';c.shadowBlur=18;
  c.beginPath();c.ellipse(cx,cy,Math.min(w*.32,130),Math.max(5,h*.03),0,0,Math.PI*2);c.stroke();c.restore();
  if(!startedAt)startedAt=now;
  const elapsed=reduced?.matches?0:now-startedAt;
  const index=Math.floor(elapsed/3200)%looks.length;
  const blend=reduced?.matches?1:Math.min(1,(elapsed%3200)/340);
  const scale=Math.min(w/153,h/194);
  const r=scale*14/.60;
  const y=h/2-17*scale;
  const draw=(appearance,alpha)=>{
   if(alpha<=0)return;
   c.save();c.globalAlpha=alpha;
   // This is the portrait pose and renderer used by avatar-wardrobe.js.
   painter.draw(c,cx,y,r,-Math.PI/2,-Math.PI/2,0,{
    gender:'male',appearance,heldItem:'none',moving:false,reducedMotion:true,
    helmetLamp:true,viewYaw:0,light:{depth:0,intensity:.85,angle:-1.2}
   });
   c.restore();
  };
  if(index>0||elapsed>=3200)draw(looks[(index+looks.length-1)%looks.length],1-blend);
  draw(looks[index],blend);
  canvas.dataset.previewRendered='true';
 }
 function tick(now){
  frame=0;
  if(!active())return;
  if(now-lastPaint>=45){lastPaint=now;paint(now);}
  if(!reduced?.matches)frame=requestAnimationFrame(tick);
 }
 function refresh(){
  if(frame){cancelAnimationFrame(frame);frame=0;}
  if(!active())return;
  lastPaint=0;
  frame=requestAnimationFrame(tick);
 }
 new MutationObserver(refresh).observe(screen,{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('visibilitychange',refresh);
 window.addEventListener('resize',refresh,{passive:true});
 reduced?.addEventListener?.('change',refresh);
 refresh();
})();
