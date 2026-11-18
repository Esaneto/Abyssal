/* Abyssal login wardrobe. Cosmetic showcase only: never saves appearance
 * or unlocks inventory. Uses the same model/renderer as the playable diver.
 * Timed swaps continue even when Windows requests reduced motion.
 */
(function(){
 'use strict';
 const screen=document.getElementById('loginScreen');
 const canvas=document.getElementById('abyssLoginWardrobeCanvas');
 const base=window.AbyssalAvatarBase;
 const painter=window.AbyssalDiverArt;
 if(!screen||!canvas||!base?.slots||!painter?.draw)return;
 const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const changeInterval=1900,fadeDuration=360;
 const categories=['outfit','mask','visor','fins','hair','hairColor','eyewear','headgear','back'];
 const randomDifferent=(items,current)=>{
  const alternatives=items.filter(item=>item!==current);
  return alternatives.length?alternatives[Math.floor(Math.random()*alternatives.length)]:current;
 };
 function randomAppearance(old){
  const next={...old};
  for(const slot of categories)next[slot]=randomDifferent(base.slots[slot].map(item=>item.id),old[slot]);
  return base.normalize(next);
 }
 let current=base.normalize(base.DEFAULT),previous=current;
 let switchTimer=0,fadeFrame=0,transitionAt=0,cycles=0;
 const active=()=>screen.isConnected&&!screen.hidden&&!document.hidden;
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
  const scale=Math.min(w/153,h/194),r=scale*14/.60,y=h/2-17*scale;
  const draw=(appearance,alpha)=>{
   if(alpha<=0)return;
   ctx.save();ctx.globalAlpha=alpha;
   painter.draw(ctx,cx,y,r,-Math.PI/2,-Math.PI/2,0,{
    gender:'male',appearance,heldItem:'none',moving:false,reducedMotion:true,
    helmetLamp:true,viewYaw:0,light:{depth:0,intensity:.85,angle:-1.2}
   });
   ctx.restore();
  };
  // Reduced-motion changes outfits just as often, but without a fade.
  const blend=reducedMotion?.matches||!transitionAt?1:Math.min(1,Math.max(0,(now-transitionAt)/fadeDuration));
  if(blend<1)draw(previous,1-blend);
  draw(current,blend);
  canvas.dataset.previewRendered='true';
 }
 function fadeTick(now){
  fadeFrame=0;
  if(!active())return;
  paint(now);
  if(!reducedMotion?.matches&&now-transitionAt<fadeDuration)
   fadeFrame=requestAnimationFrame(fadeTick);
 }
 function stopFade(){
  if(fadeFrame)cancelAnimationFrame(fadeFrame);
  fadeFrame=0;
 }
 function swapAppearance(){
  if(!active())return;
  previous=current;
  current=randomAppearance(previous);
  transitionAt=performance.now();
  cycles++;
  canvas.dataset.previewCycles=String(cycles);
  canvas.dataset.previewOutfit=current.outfit;
  stopFade();
  // The switch timer is independent of animation frames. On desktop, a
  // reduced-motion preference must never freeze the avatar's cosmetics.
  if(reducedMotion?.matches)paint(transitionAt);
  else fadeFrame=requestAnimationFrame(fadeTick);
 }
 function pause(){
  if(switchTimer)clearInterval(switchTimer);
  switchTimer=0;
  stopFade();
 }
 function refresh(){
  if(!active()){pause();return;}
  if(!switchTimer){
   previous=current;transitionAt=0;
   paint(performance.now());
   switchTimer=setInterval(swapAppearance,changeInterval);
  }else paint(performance.now());
 }
 new MutationObserver(refresh).observe(screen,{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('visibilitychange',refresh);
 window.addEventListener('resize',refresh,{passive:true});
 reducedMotion?.addEventListener?.('change',()=>{stopFade();paint(performance.now());});
 refresh();
})();
