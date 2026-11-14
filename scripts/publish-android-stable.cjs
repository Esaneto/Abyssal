'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {gh,readPrevious,cmp,sha,publishStable,repo,stable}=require('./native-stable-release.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'abyssal-publish-'));
try{
 const version=require('../package.json').version,file=path.resolve('Abyssal-Android.apk'),name=path.basename(file),sdk=path.join(process.env.ANDROID_HOME,'build-tools','36.0.0');
 const previous=readPrevious('Abyssal-Android-build.json',dir);
 if(previous&&cmp(previous.version,version)>=0){console.log('Stable version already equal or newer');process.exitCode=0;}
 else{
 const badging=cp.execFileSync(path.join(sdk,'aapt'),['dump','badging',file],{encoding:'utf8'});
 const versionCode=Number(/versionCode='(\d+)'/.exec(badging)?.[1]);
 if(!versionCode||!badging.includes("name='com.esaneto.abyssal'")||!badging.includes("versionName='"+version+"'")||!badging.includes('android.permission.REQUEST_INSTALL_PACKAGES'))throw Error('APK package/version/update permission invalid');
 const cert=apk=>{const out=cp.execFileSync(path.join(sdk,'apksigner'),['verify','--print-certs',apk],{encoding:'utf8'});const v=/Signer #1 certificate SHA-256 digest: ([a-fA-F0-9]+)/.exec(out)?.[1];if(!v)throw Error('missing APK certificate');return v.toLowerCase();};
 const signerSha256=cert(file);
 if(previous){
  if(previous.versionCode&&versionCode<=Number(previous.versionCode))throw Error('APK versionCode must increase');
  if(previous.signing==='release'){
   let oldCert=previous.signerSha256;
   if(!oldCert){gh(['release','download',stable,'--repo',repo,'--pattern',name,'--dir',dir]);oldCert=cert(path.join(dir,name));}
   if(oldCert!==signerSha256)throw Error('Permanent signing key changed; refusing to break installed updates');
  }
 }
 publishStable({file,name,metadata:{version,commit:process.env.GITHUB_SHA,sha256:sha(file),platform:'android',updatable:true,signing:'release',versionCode,signerSha256},previous,dir});
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
