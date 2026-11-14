// Generate deterministic 24-bit NSIS artwork without external dependencies.
const fs=require('node:fs'),path=require('node:path');
function bmp(name,w,h){
 const stride=(w*3+3)&~3, b=Buffer.alloc(54+stride*h);
 b.write('BM');b.writeUInt32LE(b.length,2);b.writeUInt32LE(54,10);b.writeUInt32LE(40,14);b.writeInt32LE(w,18);b.writeInt32LE(h,22);b.writeUInt16LE(1,26);b.writeUInt16LE(24,28);b.writeUInt32LE(stride*h,34);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/w,v=y/h,dx=u-.5,dy=v-.45,d=Math.hypot(dx,dy);
  const sonar=Math.max(0,1-Math.abs(d-.28)*160)+Math.max(0,1-Math.abs(d-.39)*180)*.6;
  const glow=Math.exp(-d*d*13),line=(Math.abs(dx)<.003||Math.abs(dy)<.003)?0.4:0;
  const k=54+(h-1-y)*stride+x*3;
  b[k]=Math.min(255,20+55*glow+55*sonar+25*line);b[k+1]=Math.min(255,12+75*glow+85*sonar+35*line);b[k+2]=Math.min(255,5+12*glow+18*sonar);
 }
 fs.writeFileSync(path.join(__dirname,name),b);
}
bmp('installerHeader.bmp',150,57);bmp('installerSidebar.bmp',164,314);
