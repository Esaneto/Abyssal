(function(){
 'use strict';
 window.drawMarineSpecies=function(c,s,x,y,r,angle,t){
  c.save();c.translate(x,y);c.rotate(angle||0);c.scale(r,r);c.shadowBlur=0;
  c.lineWidth=.055;c.strokeStyle='#aec4c8';c.fillStyle=s.color;
  const v=s.variant,phase=t*.002+v;
  const ellipse=(x,y,rx,ry)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();c.stroke();};
  const line=(points)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
  const polygon=(points)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.stroke();};
  const length=1.05+v*.045,width=.42+(v%3)*.07;
  switch(s.family){
   case 'shark':case 'fish':
    polygon([[-length*.7,0],[-length- .5,-.55],[-length-.32,0],[-length-.5,.55]]);
    polygon([[-.2,0],[-.45,-.86],[.25,-.2]]);polygon([[0,.15],[-.4,.8],[.6,.25]]);
    ellipse(.15,0,length,width);for(let i=0;i<3;i++)line([[.45-i*.12,-.23],[.4-i*.12,.23]]);break;
   case 'ray':
    line([[-.2,0],[-1.5,Math.sin(phase)*.15],[-2.2,.2]]);
    polygon([[1,0],[-.1,-1.3],[-.8,-.5],[-.65,0],[-.8,.5],[-.1,1.3]]);ellipse(.1,0,.65,.3);break;
   case 'eel':
    c.lineWidth=.3; c.strokeStyle=s.color;c.beginPath();c.moveTo(.9,0);c.bezierCurveTo(-.2,-.7,-1,.7,-1.8,Math.sin(phase)*.3);c.stroke();c.lineWidth=.055;ellipse(.7,0,.45,.26);break;
   case 'octopus':case 'squid':case 'jelly':
    for(let i=0;i<8;i++){const y=(i-3.5)*.12;c.beginPath();c.moveTo(-.3,y);c.bezierCurveTo(-1,y*2,-1.4,y*2+Math.sin(phase+i)*.25,-1.8,y*2.5);c.stroke();}
    if(s.family==='squid'){polygon([[1.3,0],[.3,-.55],[-.5,-.25],[-.5,.25],[.3,.55]]);}else ellipse(.3,0,s.family==='jelly'?.55:.7,.65);break;
   case 'crustacean':
    for(let i=0;i<5;i++){const x=.6-i*.3;line([[x,0],[x-.2,-.7],[x-.4,-.95]]);line([[x,0],[x-.2,.7],[x-.4,.95]]);}
    ellipse(0,0,.95,.48);for(let i=0;i<4;i++)line([[-.5+i*.25,-.4],[-.5+i*.25,.4]]);line([[.8,-.15],[1.7,-.65]]);line([[.8,.15],[1.7,.65]]);break;
   case 'benthic':
    if(v>=3&&v<=5){const points=[];for(let i=0;i<10;i++){const a=i*Math.PI/5,rr=i%2?.35:1.15;points.push([Math.cos(a)*rr,Math.sin(a)*rr]);}polygon(points);}else {ellipse(0,0,1,.45);for(let i=0;i<12;i++){const a=i*Math.PI/6;line([[Math.cos(a)*.9,Math.sin(a)*.4],[Math.cos(a)*1.15,Math.sin(a)*.7]]);}}break;
   default:
    ellipse(0,0,.8,.7);c.beginPath();for(let i=0;i<70;i++){const a=i*.15,rr=.05+i*.008;const x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();line([[.6,.3],[1.3,.2],[1.5,.4]]);
  }
  // Local markings distinguish species without full-body bloom or white glare.
  c.fillStyle='rgba(225,224,198,.45)';for(let i=0;i<3+v;i++){const a=i*2.4;c.beginPath();c.arc(Math.cos(a)*.55,Math.sin(a)*.24,.025+(v%3)*.012,0,Math.PI*2);c.fill();}
  if(s.family!=='benthic'&&s.family!=='jelly'){c.fillStyle='#07121a';ellipse(.65,-.15,.075,.07);}
  c.restore();
 };
})();
