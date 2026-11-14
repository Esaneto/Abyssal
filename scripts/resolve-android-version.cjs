'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {gh,readPrevious,repo,stable}=require('./native-stable-release.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'abyssal-prev-'));
try{
 let code=Math.max(1,Number(process.env.GITHUB_RUN_NUMBER)||1);
 const previous=readPrevious('Abyssal-Android-build.json',dir);
 if(previous){
  let old=Number(previous.versionCode)||0;
  if(!old){gh(['release','download',stable,'--repo',repo,'--pattern','Abyssal-Android.apk','--dir',dir]);const aapt=path.join(process.env.ANDROID_HOME,'build-tools','36.0.0','aapt');const badging=cp.execFileSync(aapt,['dump','badging',path.join(dir,'Abyssal-Android.apk')],{encoding:'utf8'});old=Number(/versionCode='(\d+)'/.exec(badging)?.[1]);if(!old)throw Error('Cannot determine previously published Android version code');}
  code=Math.max(code,old+1);
 }
 if(code>2100000000)throw Error('Android version code limit');
 fs.appendFileSync(process.env.GITHUB_ENV,'ABYSSAL_VERSION_CODE='+code+'\n');console.log('Android versionCode:',code);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
