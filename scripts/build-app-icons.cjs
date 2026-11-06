'use strict';

/**
 * Generates platform-native icons from the single, versioned Abyssal SVG.
 * Requires sharp@0.34.4 (installed by the Android and Windows CI jobs).
 *
 * Android: legacy mdpi..xxxhdpi icons + round variants + adaptive foreground
 *          and adaptive-icon XML, with a dark safe-zone background.
 * Windows: real multi-resolution PNG-in-ICO file for Electron / NSIS.
 *
 * Usage: node scripts/build-app-icons.cjs --android
 *        node scripts/build-app-icons.cjs --desktop
 */
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');

const root=path.resolve(__dirname,'..');
const svgPath=path.join(root,'public','abyssal-icon.svg');
const source=fs.readFileSync(svgPath,'utf8');
if(!source.includes('id="icon-background"')||!source.includes('id="abyssalIconTitle"')){
  throw new Error('Abyssal icon master must contain a background group and an accessible title.');
}
const sourceBytes=Buffer.from(source);
const foregroundSource=source.replace(/<g id="icon-background">[\s\S]*?<\/g>/,'');
if(foregroundSource===source)throw new Error('Could not extract transparent anchor and tentacle artwork.');

function write(file,bytes){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,bytes);
  console.log('[icon]',path.relative(root,file));
}
async function png(source,size){
  return sharp(Buffer.from(source)).resize(size,size,{fit:'fill'}).png().toBuffer();
}
function icoFromPngs(pngImages){
  // Windows ICO header + entries. PNG-in-ICO is natively supported by Windows
  // Vista and newer, and preserves the icon's alpha at each provided size.
  const count=pngImages.length;
  const head=Buffer.alloc(6+count*16);
  head.writeUInt16LE(0,0);
  head.writeUInt16LE(1,2);
  head.writeUInt16LE(count,4);
  let offset=head.length;
  pngImages.forEach(({size,bytes},i)=>{
    const pos=6+i*16;
    head[pos]=size===256?0:size;
    head[pos+1]=size===256?0:size;
    head[pos+2]=0;head[pos+3]=0;
    head.writeUInt16LE(1,pos+4);
    head.writeUInt16LE(32,pos+6);
    head.writeUInt32LE(bytes.length,pos+8);
    head.writeUInt32LE(offset,pos+12);
    offset+=bytes.length;
  });
  return Buffer.concat([head,...pngImages.map(item=>item.bytes)]);
}
async function buildWindows(){
  const sizes=[16,24,32,48,64,128,256];
  const icons=[];
  for(const size of sizes)icons.push({size,bytes:await png(sourceBytes,size)});
  const target=path.join(root,'desktop','build','icon.ico');
  write(target,icoFromPngs(icons));
  // Icon validity checks: correct ICO magic and 7 embedded PNG image headers.
  const data=fs.readFileSync(target);
  if(data.readUInt16LE(2)!==1||data.readUInt16LE(4)!==sizes.length){
    throw new Error('Generated Windows icon is invalid.');
  }
}
async function buildAndroid(){
  const res=path.join(root,'android','app','src','main','res');
  if(!fs.existsSync(path.join(root,'android','app','src','main','AndroidManifest.xml'))){
    throw new Error('Generate the Capacitor Android project before creating its launcher icons.');
  }
  const densities={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
  const markBytes=await sharp(Buffer.from(foregroundSource)).resize(240,240,{fit:'fill'}).png().toBuffer();
  const adaptive=await sharp({create:{
    width:432,height:432,channels:4,background:{r:0,g:0,b:0,alpha:0}
  }}).composite([{input:markBytes,left:96,top:96}]).png().toBuffer();

  for(const [density,launcherSize] of Object.entries(densities)){
    const dir=path.join(res,'mipmap-'+density);
    write(path.join(dir,'ic_launcher.png'),await png(sourceBytes,launcherSize));
    const roundMask=Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="'+launcherSize+
      '" height="'+launcherSize+'"><circle cx="'+launcherSize/2+'" cy="'+launcherSize/2+
      '" r="'+launcherSize/2+'" fill="white"/></svg>'
    );
    const round=await sharp(await png(sourceBytes,launcherSize))
      .composite([{input:roundMask,blend:'dest-in'}]).png().toBuffer();
    write(path.join(dir,'ic_launcher_round.png'),round);
    write(path.join(dir,'ic_launcher_foreground.png'),
      await sharp(adaptive).resize(Math.round(launcherSize*2.25),Math.round(launcherSize*2.25)).png().toBuffer());
  }
  const valuesDir=path.join(res,'values');
  write(path.join(valuesDir,'abyssal_icon_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="abyssal_icon_background">#061522</color></resources>\n');
  const xml='<?xml version="1.0" encoding="utf-8"?>\n'+
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'+
    '  <background android:drawable="@color/abyssal_icon_background" />\n'+
    '  <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'+
    '</adaptive-icon>\n';
  for(const name of ['ic_launcher.xml','ic_launcher_round.xml']){
    write(path.join(res,'mipmap-anydpi-v26',name),xml);
  }

  const manifestPath=path.join(root,'android','app','src','main','AndroidManifest.xml');
  let manifest=fs.readFileSync(manifestPath,'utf8');
  manifest=manifest.replace(/<application\b([^>]*)>/,(_match,attrs)=>{
    const iconAttrs=['icon','roundIcon'];
    for(const attr of iconAttrs){
      const replacement='android:'+attr+'="@mipmap/ic_launcher'+(attr==='roundIcon'?'_round':'')+'"';
      const regexp=new RegExp('android:'+attr+'="[^"]*"');
      attrs=regexp.test(attrs)?attrs.replace(regexp,replacement):attrs+' '+replacement;
    }
    return '<application'+attrs+'>';
  });
  write(manifestPath,manifest);
  // This script runs after cap add and before cap sync. The generated APK/AAB
  // therefore includes the icon in Android resources rather than only in WebView.
}
(async()=>{
  const android=process.argv.includes('--android');
  const desktop=process.argv.includes('--desktop');
  if(!android&&!desktop)throw new Error('Use --android and/or --desktop.');
  if(android)await buildAndroid();
  if(desktop)await buildWindows();
})().catch(e=>{console.error('[icon] generation failed:',e);process.exitCode=1;});
