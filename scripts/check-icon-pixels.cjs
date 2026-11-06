'use strict';
// Inspect the launcher PNG extracted from the compiled APK, not a source file.
const sharp=require('sharp');
const fs=require('fs');
const iconPath=process.argv[2];
if(!iconPath||!fs.existsSync(iconPath))throw new Error('Expected extracted Android APK launcher PNG path');
sharp(iconPath).ensureAlpha().raw().toBuffer({resolveWithObject:true}).then(({data,info})=>{
 let violet=0,metallic=0,opaque=0;
 for(let i=0;i<data.length;i+=info.channels){
  const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
  if(a<96)continue;
  opaque++;
  if(r>75&&b>95&&r>g*1.22&&b>g*1.25)violet++;
  if(r>130&&g>135&&b>145&&Math.abs(r-g)<65)metallic++;
 }
 console.log('[Abyssal APK] native icon pixel verification:',{width:info.width,height:info.height,violet,metallic,opaque});
 if(info.width<48||violet<15||metallic<25||opaque<400)
  throw Error('APK icon is missing the metallic anchor or purple tentacles');
}).catch(error=>{console.error(error);process.exitCode=1;});
