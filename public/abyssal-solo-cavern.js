/* Solo cavern: original procedural distant scenery + physical foreground rocks.
   Background silhouettes are visual; foreground rocks block divers, pets and shots. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalSoloCavern=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function buildRocks(w,h){
  const scale=Math.min(w,h);
  const features=[
   [.09,.22,.060,.039,-.39],[.23,.77,.074,.029,.23],[.36,.45,.032,.074,-.18],
   [.66,.28,.035,.065,.24],[.79,.73,.082,.033,-.31],[.93,.41,.037,.064,.14],
   [.08,.56,.042,.054,-.47],[.54,.82,.079,.025,.16],[.33,.92,.060,.025,.12],
   [.63,.92,.063,.026,-.12],[.21,.17,.042,.029,.34],[.86,.15,.055,.028,-.25],
   [.45,.64,.064,.019,-.31],[.73,.51,.021,.058,.27]
  ];
  return features.map(([fx,fy,a,b,angle],index)=>{
   const rx=scale*a,ry=scale*b,vertices=[];
   for(let k=0;k<11;k++){
    const phi=TAU*k/11,grain=.89+.09*Math.sin(index*7+k*11)+.04*Math.sin(k*19+index*2);
    vertices.push([Math.cos(phi)*rx*grain,Math.sin(phi)*ry*grain]);
   }
   return {x:w*fx,y:h*fy,rx,ry,r:Math.max(rx,ry),angle,vertices,
    shade:.14+index%5*.115,seed:900+index,edge:'cavern',cavernSolid:true,visualOnly:false};
  });
 }
 function isBlocked(rocks,x,y,padding=0){
  for(const rock of rocks||[]){
   if(!rock.cavernSolid||rock.visualOnly)continue;
   const dx=x-rock.x,dy=y-rock.y,reach=rock.r+padding;
   if(Math.abs(dx)>reach||Math.abs(dy)>reach)continue;
   const angle=-(rock.angle||0),ca=Math.cos(angle),sa=Math.sin(angle);
   const a=(dx*ca-dy*sa)/(rock.rx+padding),b=(dx*sa+dy*ca)/(rock.ry+padding);
   if(a*a+b*b<1)return true;
  }
  return false;
 }
 function resolve(rocks,fromX,fromY,toX,toY,padding=0){
  const distance=Math.hypot(toX-fromX,toY-fromY);
  const steps=clamp(Math.ceil(distance/Math.max(5,padding*.75)),1,20);
  let x=fromX,y=fromY,blocked=false;
  for(let i=1;i<=steps;i++){
   const tx=fromX+(toX-fromX)*i/steps,ty=fromY+(toY-fromY)*i/steps;
   if(!isBlocked(rocks,tx,ty,padding)){x=tx;y=ty;continue;}
   blocked=true;
   if(!isBlocked(rocks,tx,y,padding))x=tx;
   else if(!isBlocked(rocks,x,ty,padding))y=ty;
  }
  return {x,y,blocked};
 }
 function segmentBlocked(rocks,x1,y1,x2,y2,padding=0){
  const steps=clamp(Math.ceil(Math.hypot(x2-x1,y2-y1)/14),1,120);
  for(let i=0;i<=steps;i++){
   const f=i/steps;
   if(isBlocked(rocks,x1+(x2-x1)*f,y1+(y2-y1)*f,padding))return true;
  }
  return false;
 }
 function paint(c,view,t,lowPower=false){
  const {left,top,width,height}=view,right=left+width,bottom=top+height;
  c.save();
  const haze=c.createRadialGradient(left+width*.52,top+height*.43,0,left+width*.52,top+height*.43,width*.82);
  haze.addColorStop(0,'rgba(28,178,191,.40)');haze.addColorStop(.33,'rgba(10,109,131,.25)');
  haze.addColorStop(.75,'rgba(2,16,31,.2)');haze.addColorStop(1,'rgba(0,3,9,.33)');
  c.fillStyle=haze;c.fillRect(left,top,width,height);
  // Three far depth planes, with eroded edges rather than flat polygon strips.
  for(let layer=0;layer<3;layer++)for(const upper of [true,false]){
   const base=upper?top+height*(.085+layer*.065):bottom-height*(.065+layer*.065);
   c.beginPath();c.moveTo(left-20,upper?top-80:bottom+80);
   for(let k=0;k<=40;k++){
    const x=left+(width*k/40);
    const jag=Math.sin(x*(.004/(1+layer*.5))+t*.00005+layer)*height*.043+
     Math.sin(x*.013+layer*1.4)*height*.019;
    c.lineTo(x,base+(upper?jag:-jag));
   }
   c.lineTo(right+20,upper?top-80:bottom+80);c.closePath();
   c.fillStyle=['rgba(4,44,55,.24)','rgba(2,25,36,.38)','rgba(0,11,20,.60)'][layer];c.fill();
  }
  // Jagged far arches give the illuminated center an organic cavern silhouette.
  for(let k=0;k<4;k++){
   const x=left+width*(k*.29+.13),y=top+height*(.16+k%2*.11),floor=bottom-height*(.17+k%3*.05);
   c.beginPath();c.moveTo(x-width*.12,y);c.bezierCurveTo(x,y+height*.19,x+width*.06,floor-height*.18,x+width*.18,floor);
   c.lineTo(x+width*.23,floor+height*.06);
   c.bezierCurveTo(x+width*.08,floor-height*.23,x-width*.01,y+height*.19,x-width*.16,y);
   c.closePath();c.fillStyle='rgba(3,22,33,.25)';c.fill();
  }
  if(!lowPower)for(let k=0;k<7;k++){
   const x=left+width*(k+.4)/7+Math.sin(t*.00017+k)*width*.025;
   c.beginPath();c.moveTo(x-width*.013,top);c.lineTo(x+width*.022,top);
   c.lineTo(x+width*.092,bottom);c.lineTo(x+width*.014,bottom);c.closePath();
   c.fillStyle='rgba(94,208,219,.025)';c.fill();
  }
  // Swaying shadow vegetation in the two foreground corners.
  for(let side=0;side<2;side++)for(let k=0;k<18;k++){
   const x=left+width*(side?.60+k*.024:k*.024),endY=bottom-height*(.09+(k%5)*.025);
   c.lineWidth=Math.max(1.1,width*.0019);c.strokeStyle='rgba(0,11,19,.67)';c.lineCap='round';
   c.beginPath();c.moveTo(x,bottom+6);c.quadraticCurveTo(x+Math.sin(t*.001+k)*width*.008,endY+height*.07,
    x+Math.sin(t*.001+k)*width*.012,endY);c.stroke();
  }
  c.restore();
 }
 return Object.freeze({buildRocks,isBlocked,resolve,segmentBlocked,paint});
});
