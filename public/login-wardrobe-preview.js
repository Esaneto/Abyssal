/* Live cosmetics showcase for the login panel. Uses the game's own wardrobe
 * model/painter, never persists preview changes or grants cosmetic ownership.
 */
(function(){
 'use strict';
 const screen=document.getElementById('loginScreen');
 const canvas=document.getElementById('abyssLoginWardrobeCanvas');
 const base=window.AbyssalAvatarBase;
 const painter=window.AbyssalDiverArt;
 if(!screen||!canvas||!base?.slots||!painter?.draw)return;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const interval=1900,fade=360;
 const categories=['outfit','mask','visor','fins','hair','hairColor','eyewear','headgear','back'];
 const randomDifferent=(ids,current)=>{
  if(ids.length<2)return ids[0]||current;
  let next=current;
  // Uniform selection excluding the current item, avoiding visually identical cycles.
  const alternatives=ids.filter(id=>id!==current);
  return alternatives[Math.floor(Math.random()*alternatives.length)]||current;
 };
 function randomAppearance(old){
  const next={...old};
  for(const slot of categories){
   const ids=base.slots[slot].map(item=>item.id);
   next[slot]=randomDifferent(ids,old[slot]);
  }
  return base.normalize(next);
 }
 let current=base.normalize(base.DEFAULT),previous=current,transitionAt=0;
 let frame=0,lastPaint=0,cyles=0;
 const active=()=>screen.isConnected&&!screen.hidden&&!document.hidden;
 function step(time){
  previous=current;
  current=randomAppearance(previous);
  transitionAt=time;
  cyles++;
  canvas.dataset.previewCycles=String(cyles);
  // Allows visual smoke tests to verify that the actual outfit changed.
  canvas.dataset.previewOutfit=current.outfit;
 }
 function paint(now){
  const rect=canvas.getBoundingClientRect();
  if(rect.width<4||rect.height<4)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const w=rect.width,h=rect.height,pw=Math.round(w*dpr),ph=Math.round(h*dpr);
  if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  const cx=w/2,cy=h*.78;
  ctx.save();ctx.fillStyle='rgba(7,195,212,.08)';
  ctx.beginPath();ctx.ellipse(cx,cy,Math.min(w*.39,150),Math.max(5,h*.045),0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(94,235,239,.72)';ctx.lineWidth=2;
  ctx.shadowColor='#34d7e1';ctx.shadowBlur=18;
  ctx.beginPath();ctx.ellipse(cx,cy,Math.min(w*.32,130),Math.max(5,h*.03),0,0,Math.PI*2);ctx.stroke();ctx.restore();
  const scale=Math.min(w/153,h/194),r=scale*14/.60;
  const y=h/2-17*scale;
  function draw(appearance,alpha){
   if(alpha<=0)return;
   ctx.save();ctx.globalAlpha=alpha;
   painter.draw(ctx,cx,y,r,-Math.PI/2,-Math.PI/2,0,{
    gender:'male',appearance,heldItem:'none',moving:false,reducedMotion:true,
    helmetLamp:true,viewYaw:0,light:{depth:0,intensity:.85,angle:-1.2}
   });
   ctx.restore();
  }
  const blend=reduced?.matches?1:Math.min(1,(now-transitionAt)/fade);
  if(blend<1)draw(previous,1-blend);
  draw(current,blend);
  canvas.dataset.previewRendered='true';
 }
 function tick(now){
  frame=0;
  if(!active())return;
  if(!transitionAt)transitionAt=now;
  if(!reduced?.matches && now-transitionAt>=interval)step(now);
  if(now-lastPaint>=45){lastPaint=now;paint(now);}
  if(!reduced?.matches)frame=requestAnimationFrame(tick);
 }
 function refresh(){
  if(frame)cancelAnimationFrame(frame);
  frame=0;
  if(!active())return;
  transitionAt=0;lastPaint=0;
  frame=requestAnimationFrame(tick);
 }
 new MutationObserver(refresh).observe(screen,{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('visibilitychange',refresh);
 window.addEventListener('resize',refresh,{passive:true});
 reduced?.addEventListener?.('change',refresh);
 refresh();
})();
