/* Optional Dark Fantasy atlas layer for Abyssal Solo/Online and equipped Ecos.
 * Safe by default: an explicitly enabled manifest AND valid atlases are required.
 * No AI, hitboxes, attack timing or damage changes.
 */
(function(root){
 'use strict';
 const previous=root.AbyssalAnimatedSprites;
 if(!previous)return;
 const ids=['drifter','stinger','brute','lurker','whiteShark','boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer','riftSmile'];
 const aliases=Object.freeze({violet:'drifter',abyssaleye:'stinger',deepwarden:'brute',reefshark:'whiteShark',aberration:'boss',riftSmileRelic:'riftSmile'});
 const states=new Map(),enabled=new Set();
 const widths={whiteShark:3.5,whiteSharkBoss:3.6,leviathan:4.0,kraken:4.4,boss:3.7,devourer:4.2,riftSmile:3.5,maw:3.7};
 const canonical=id=>{const name=String(id||'');return aliases[name]||name;};
 const manifestUrl='abyssal-horror/manifest.json';
 function loadImage(url){
  return new Promise(resolve=>{
   if(typeof root.Image!=='function'){resolve(null);return;}
   const img=new root.Image();img.decoding='async';
   img.onload=()=>resolve(img.naturalWidth===1680&&img.naturalHeight===1280?img:null);
   img.onerror=()=>resolve(null);img.src=url;
  });
 }
 async function preloadHorror(){
  if(typeof root.fetch!=='function')return;
  try{
   const response=await root.fetch(manifestUrl,{cache:'no-store'});
   if(!response.ok)return;
   const manifest=await response.json();
   if(manifest?.enabled!==true||manifest?.columns!==4||manifest?.rows!==4||manifest?.frameWidth!==420||manifest?.frameHeight!==320)return;
   const allowed=new Set(Array.isArray(manifest.creatures)?manifest.creatures:[]);
   await Promise.all(ids.filter(id=>allowed.has(id)).map(async id=>{
    const [swim,attack]=await Promise.all(['swim','attack'].map(s=>loadImage('abyssal-horror/'+id+'/'+s+'.webp')));
    if(swim&&attack){states.set(id,{swim,attack});enabled.add(id);}
   }));
  }catch(_){/* Offline and missing manifest keep the existing art. */}
 }
 function has(id){const key=canonical(id);return enabled.has(key)||previous.has(id);}
 function isBiting(state,clock){return previous.isBiting?.(state,clock)===true;}
 function drawAtOrigin(c,id,r,t,attack,hit=0,state=null){
  const key=canonical(id),art=states.get(key);
  if(!art)return previous.drawAtOrigin(c,id,r,t,attack,hit,state);
  if(!c||!(Number(r)>0))return false;
  const now=typeof root.performance?.now==='function'?root.performance.now():t;
  const p=previous.biteProgress?.(state,t,Boolean(attack),now);
  const biting=Boolean(attack)&&Number.isFinite(p)&&p>=0;
  const sheet=biting?art.attack:art.swim;
  const phase=biting?Math.min(14.999,Math.max(0,p*15)):((Math.max(0,Number(t)||0)/83.333333)%15);
  const first=Math.floor(phase),next=biting?Math.min(15,first+1):(first+1)%15,blend=phase-first;
  const width=(widths[key]||3.25)*r,height=width*320/420;
  const render=(frame,alpha)=>{
   if(alpha<=0)return;
   c.globalAlpha=alpha;
   c.drawImage(sheet,(frame%4)*420,Math.floor(frame/4)*320,420,320,-width/2,-height/2,width,height);
  };
  c.save();c.imageSmoothingEnabled=true;
  if('imageSmoothingQuality' in c)c.imageSmoothingQuality='high';
  if(Number(hit)>0){c.shadowColor='#ffffff';c.shadowBlur=Math.min(14,r*.3);}
  render(first,1-blend);
  if(blend>.005)render(next,blend);
  c.restore();return true;
 }
 function status(){return {...(previous.status?.()||{}),horrorReady:[...enabled],horrorAvailable:ids};}
 root.AbyssalAnimatedSprites=Object.freeze({...previous,has,isBiting,drawAtOrigin,status,preloadHorror});
 preloadHorror();
})(typeof globalThis!=='undefined'?globalThis:this);
