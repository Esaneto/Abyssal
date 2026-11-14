'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
test('Android generator reuses Capacitor FileProvider and is idempotent',()=>{
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'abyssal-manifest-'));
 try{
  const dir=path.join(cwd,'android/app/src/main');fs.mkdirSync(dir,{recursive:true});
  const manifest=path.join(dir,'AndroidManifest.xml');
  fs.writeFileSync(manifest,`<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET" /><application><activity android:name=".MainActivity"></activity><provider android:name="androidx.core.content.FileProvider" android:authorities="\${applicationId}.fileprovider" android:exported="false" android:grantUriPermissions="true"><meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" /></provider></application></manifest>`);
  const script=path.resolve(__dirname,'../scripts/configure-android.cjs');
  for(let i=0;i<2;i++){
   cp.execFileSync(process.execPath,[script],{cwd});
   const xml=fs.readFileSync(manifest,'utf8');
   assert.equal((xml.match(/android:authorities="\$\{applicationId\}\.fileprovider"/g)||[]).length,1);
   assert.equal((xml.match(/android.permission.ACCESS_NETWORK_STATE/g)||[]).length,1);
   assert.match(xml,/@xml\/abyssal_update_paths/);
   assert.match(xml,/android:windowSoftInputMode="adjustResize"/);
   assert.match(fs.readFileSync(path.join(dir,'res/xml/abyssal_update_paths.xml'),'utf8'),/cache-path[^>]*path="updates\/"/);
  }
 }finally{fs.rmSync(cwd,{recursive:true,force:true});}
});
