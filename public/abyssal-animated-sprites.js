/* Abyssal sprite-strip renderer: purely visual, never alters gameplay state.
 * Source atlas: six 9x64px shark strips and one 4x128px blue octopus strip.
 * Creature physics, AI, stats, attacks and projectiles stay in their owners.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalAnimatedSprites=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const SPECIES=Object.freeze({
  reefshark:{moveRow:0,attackRow:1,count:9,cell:64,span:3.1},
  hammerhead:{moveRow:2,attackRow:3,count:9,cell:64,span:2.7},
  tigershark:{moveRow:4,attackRow:5,count:9,cell:64,span:3.2},
  abysscroc:{moveRow:0,attackRow:1,count:9,cell:64,span:3.3,palette:'red'},
  greenland:{moveRow:0,attackRow:1,count:9,cell:64,span:3.2,palette:'green'},
  aberration:{moveRow:6,attackRow:6,count:4,cell:128,span:10.5},
  whiteShark:{moveRow:0,attackRow:1,count:9,cell:64,span:3.1},
  whiteSharkBoss:{moveRow:0,attackRow:1,count:9,cell:64,span:3.1,palette:'boss'},
  boss:{moveRow:6,attackRow:6,count:4,cell:128,span:10.5}
 });
 const palettes=Object.create(null);
 let source=null,ready=false;
 const sourceName='abyssal-eco-sprites.png?v=2026.11.20.1';
 function recolorShark(mode){
  if(!source||typeof root.document==='undefined')return null;
  const canvas=root.document.createElement('canvas');canvas.width=576;canvas.height=128;
  const c=canvas.getContext('2d',{willReadFrequently:true});if(!c)return null;
  c.drawImage(source,0,0,576,128,0,0,576,128);
  const pixels=c.getImageData(0,0,576,128),p=pixels.data;
  for(let i=0;i<p.length;i+=4){
   if(p[i+3]===0)continue;
   const r=p[i],g=p[i+1],b=p[i+2];
   const light=.2126*r+.7152*g+.0722*b;
   if(light>175&&Math.max(r,g,b)-Math.min(r,g,b)<68){
    if(mode==='red'){p[i]=Math.min(255,light*1.02+10);p[i+1]=light*.83;p[i+2]=light*.80;}
    else if(mode==='green'){p[i]=light*.75;p[i+1]=Math.min(255,light*1.04+8);p[i+2]=light*.84;}
    else {p[i]=light*.70;p[i+1]=light*.91;p[i+2]=Math.min(255,light*1.04+15);}
   }else if(mode==='red'){
    p[i]=Math.min(255,light*.95+49);p[i+1]=Math.min(255,light*.43+10);p[i+2]=Math.min(255,light*.44+15);
   }else if(mode==='green'){
    p[i]=Math.min(255,light*.37+12);p[i+1]=Math.min(255,light*.91+30);p[i+2]=Math.min(255,light*.50+17);
   }else{
    p[i]=Math.min(255,light*.49+6);p[i+1]=Math.min(255,light*.77+26);p[i+2]=Math.min(255,light*.92+34);
   }
  }
  c.putImageData(pixels,0,0);return canvas;
 }
 function preload(){
  if(source||typeof root.Image!=='function')return;
  const image=new root.Image();
  source=image;
  image.decoding='async';
  image.onload=()=>{
   if(image.naturalWidth!==576||image.naturalHeight!==512){ready=false;return;}
   ready=true;
   for(const mode of ['red','green','boss'])palettes[mode]=recolorShark(mode);
  };
  image.onerror=()=>{ready=false;};
  image.src=sourceName;
 }
 function has(id){return Boolean(SPECIES[String(id||'')]);}
 function drawAtOrigin(c,id,r,t,attack,hit=0){
  const cfg=SPECIES[String(id||'')];
  if(!cfg||!ready||!c||!(Number(r)>0))return false;
  const sheet=cfg.palette?palettes[cfg.palette]:source;
  if(!sheet)return false;
  const isAttack=Boolean(attack),rate=cfg.count===4?175:(isAttack?54:110);
  const frame=(Math.floor(Math.max(0,Number(t)||0)/rate)%cfg.count+cfg.count)%cfg.count;
  const srcY=cfg.palette?(isAttack?64:0):((isAttack?cfg.attackRow:cfg.moveRow)*64);
  const side=cfg.span*r;
  c.save();
  c.imageSmoothingEnabled=false;
  if(Number(hit)>0){c.shadowColor='#ffffff';c.shadowBlur=Math.min(14,r*.35);}
  c.drawImage(sheet,frame*cfg.cell,srcY,cfg.cell,cfg.cell,-side*.5,-side*.5,side,side);
  c.restore();
  return true;
 }
 function status(){return {ready,atlas:sourceName,species:Object.keys(SPECIES),octopusBlue:true};}
 preload();
 return Object.freeze({SPECIES,has,drawAtOrigin,preload,status});
});
