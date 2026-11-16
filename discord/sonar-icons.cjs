'use strict';
// Original procedural pixel-vector icons, 128x128 RGBA, no runtime dependencies.
const {deflateSync}=require('node:zlib');
const N=128;
const C={cyan:[46,231,249,255],blue:[22,112,164,255],navy:[7,29,49,255],white:[215,250,255,255],purple:[179,113,255,255],red:[255,63,100,255]};
function crc(b){let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),end=Buffer.alloc(4);len.writeUInt32BE(data.length);end.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([len,t,data,end]);}
function icon(name){
 const pixels=Buffer.alloc(N*N*4);
 function dot(x,y,c){x=Math.round(x);y=Math.round(y);if(x>=0&&x<N&&y>=0&&y<N)pixels.set(c,(y*N+x)*4);}
 function disk(x,y,r,c){for(let j=Math.floor(y-r);j<=y+r;j++)for(let i=Math.floor(x-r);i<=x+r;i++)if((i-x)**2+(j-y)**2<=r*r)dot(i,j,c);}
 function line(x,y,X,Y,c,w=4){const n=Math.max(1,Math.ceil(Math.hypot(X-x,Y-y)));for(let i=0;i<=n;i++)disk(x+(X-x)*i/n,y+(Y-y)*i/n,w/2,c);}
 function ring(x,y,r,c,w=4){for(let a=0;a<Math.PI*2;a+=.025)disk(x+r*Math.cos(a),y+r*Math.sin(a),w/2,c);}
 function poly(points,c){for(let y=0;y<N;y++)for(let x=0;x<N;x++){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [a,b]=points[i],[d,e]=points[j];if((b>y)!=(e>y)&&x<(d-a)*(y-b)/(e-b)+a)inside=!inside;}if(inside)dot(x,y,c);}}
 function shape(points,fill=C.navy,edge=C.cyan){poly(points,fill);for(let i=0;i<points.length;i++)line(...points[i],...points[(i+1)%points.length],edge,4);}
 function fish(x,y,s){shape([[x-s,y],[x,y-s*.45],[x+s*.6,y],[x,y+s*.45]],C.blue);shape([[x-s,y],[x-s*1.5,y-s*.5],[x-s*1.5,y+s*.5]],C.blue);disk(x+s*.18,y-2,2,C.white);}
 switch(name){
 case 'sonar':disk(64,64,49,C.navy);ring(64,64,48,C.cyan,5);ring(64,64,32,C.blue);ring(64,64,16,C.blue);line(64,64,97,29,C.cyan,5);disk(82,47,5,C.white);break;
 case 'submarino':shape([[18,56],[35,44],[90,44],[110,58],[110,77],[92,88],[34,88],[18,76]],C.navy);shape([[49,44],[49,30],[72,30],[78,44]],C.blue);line(60,30,60,20,C.cyan);line(60,20,75,20,C.cyan);for(let x of [45,65,85]){disk(x,65,8,C.blue);ring(x,65,8,C.cyan,3);}break;
 case 'mergulhador':disk(64,58,43,C.navy);ring(64,58,43,C.cyan,5);shape([[32,47],[96,47],[92,76],[76,84],[52,84],[36,76]],C.blue);line(64,48,64,79,C.cyan);shape([[42,92],[86,92],[97,109],[31,109]],C.navy);break;
 case 'tubarao':shape([[12,70],[42,49],[55,20],[66,50],[96,49],[116,63],[99,84],[59,89],[30,83]],C.blue);poly([[61,70],[113,63],[99,83],[73,85]],C.white);line(74,74,105,71,C.navy,3);disk(97,59,3,C.white);break;
 case 'abismo':disk(64,64,49,C.navy);for(let j=0;j<3;j++)for(let a=0;a<5.8;a+=.04){let r=48-a*6;disk(64+r*Math.cos(a+j*2.094),64+r*Math.sin(a+j*2.094),2.5,j===0?C.purple:C.cyan);}break;
 case 'orb':disk(64,64,45,C.navy);ring(64,64,42,C.blue,5);ring(64,64,33,C.cyan,4);disk(64,64,24,C.blue);disk(58,58,15,C.cyan);disk(54,53,6,C.white);break;
 case 'ressonancia':shape([[64,12],[100,64],[64,116],[28,64]],C.navy,C.purple);shape([[64,33],[80,64],[64,95],[48,64]],C.blue,C.cyan);line(15,64,113,64,C.purple,3);break;
 case 'cardume':fish(53,38,19);fish(85,67,21);fish(43,96,17);break;
 case 'colossal':disk(64,43,28,C.navy);ring(64,43,28,C.purple,4);for(let k=0;k<5;k++){let x=37+k*13;line(x,61,x-8,84,C.purple,6);line(x-8,84,x+4,105,C.cyan,5);}disk(54,42,4,C.red);disk(74,42,4,C.red);break;
 case 'gamemaster':line(64,24,64,109,C.red,7);line(34,27,34,60,C.red,6);line(94,27,94,60,C.red,6);line(34,60,64,75,C.red,6);line(94,60,64,75,C.red,6);for(let x of [34,64,94])poly([[x,13],[x-10,35],[x+10,35]],C.red);ring(64,90,14,C.white,3);break;
 case 'musica':line(51,83,51,30,C.cyan,8);line(51,30,95,20,C.cyan,7);line(95,20,95,72,C.cyan,8);line(51,44,95,34,C.blue,6);disk(38,86,15,C.cyan);disk(82,76,15,C.cyan);break;
 case 'guardiao':shape([[64,15],[105,34],[100,78],[64,111],[28,78],[23,34]],C.navy);line(41,64,57,80,C.cyan,7);line(57,80,88,46,C.cyan,7);break;
 default:throw Error('Unknown emoji '+name);
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(N,0);header.writeUInt32BE(N,4);header[8]=8;header[9]=6;
 const scan=Buffer.alloc(N*(1+N*4));for(let y=0;y<N;y++)pixels.copy(scan,y*(1+N*4)+1,y*N*4,(y+1)*N*4);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
module.exports={icon};
