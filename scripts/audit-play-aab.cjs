'use strict';
// Audit the FINAL signed AAB, not just the source manifest.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const aab=process.argv[2];if(!aab||!fs.existsSync(aab))throw Error('Usage: node scripts/audit-play-aab.cjs app-release.aab');
const exec=(cmd,args)=>cp.execFileSync(cmd,args,{maxBuffer:50*1024*1024});
const entries=exec('unzip',['-Z1',aab]).toString().trim().split(/\r?\n/);
const read=name=>exec('unzip',['-p',aab,name]);
function varint(b,i){let x=0n,s=0n;for(;i<b.length&&s<70n;s+=7n){const q=b[i++];x|=BigInt(q&127)<<s;if(q<128)return [x,i];}throw Error('Invalid protobuf varint');}
function fields(b){const out=[];let i=0;while(i<b.length){let t;[t,i]=varint(b,i);const f=Number(t>>3n),w=Number(t&7n);let v;if(w===0){[v,i]=varint(b,i);}else if(w===2){let n;[n,i]=varint(b,i);const end=i+Number(n);if(end>b.length)throw Error('Truncated protobuf');v=b.subarray(i,end);i=end;}else if(w===1||w===5){const n=w===1?8:4;v=b.subarray(i,i+n);i+=n;}else throw Error('Unsupported protobuf wire type '+w);out.push([f,w,v]);}return out;}
const string=(f,id)=>f.find(x=>x[0]===id&&x[1]===2)?.[2].toString()||'';
function decode(node){const raw=fields(node).find(x=>x[0]===1&&x[1]===2);if(!raw)return null;const f=fields(raw[2]),attrs={};for(const a of f.filter(x=>x[0]===4&&x[1]===2)){const af=fields(a[2]);attrs[string(af,2)]=string(af,3);}return {name:string(f,3),attrs,children:f.filter(x=>x[0]===5&&x[1]===2).map(x=>decode(x[2])).filter(Boolean)};}
const m=decode(read('base/manifest/AndroidManifest.xml')),pkg=require('../package.json');
assert.equal(m.name,'manifest');assert.equal(m.attrs.package,'com.esaneto.abyssal');assert.equal(m.attrs.versionName,pkg.version);
const sdk=m.children.find(n=>n.name==='uses-sdk');assert.equal(sdk.attrs.targetSdkVersion,'36');assert.ok(Number(sdk.attrs.minSdkVersion)>=24);
if(process.env.ABYSSAL_VERSION_CODE)assert.equal(m.attrs.versionCode,process.env.ABYSSAL_VERSION_CODE);
const permissions=m.children.filter(n=>n.name==='uses-permission').map(n=>n.attrs.name);
assert.ok(!permissions.includes('android.permission.REQUEST_INSTALL_PACKAGES'),'Play AAB must not request sideload permission');
const app=m.children.find(n=>n.name==='application');assert.equal(app.attrs.usesCleartextTraffic,'false');
const providers=app.children.filter(n=>n.name==='provider'&&n.attrs.authorities==='com.esaneto.abyssal.fileprovider');assert.equal(providers.length,1,'Duplicate updater FileProvider');
assert.equal(providers[0].attrs.exported,'false');
const activity=app.children.find(n=>n.name==='activity'&&n.attrs.name==='com.esaneto.abyssal.MainActivity');assert.equal(activity.attrs.screenOrientation,'portrait');assert.equal(activity.attrs.windowSoftInputMode,'adjustResize');
for(const f of ['index.html','game.js','online.js','client-build.js','abyssal-admob.js','update-manager.js','mobile-portrait.js','audio/effects/morte_jogador.ogg'])assert.ok(entries.includes('base/assets/public/'+f),'Missing offline asset '+f);
const config=JSON.parse(read('base/assets/capacitor.config.json'));assert.ok(!config.server?.url,'AAB must bundle its own game');
assert.ok(entries.some(n=>/^META-INF\/.*\.(RSA|DSA|EC)$/.test(n)),'Missing signature block');
const verification=exec('jarsigner',['-verify',aab]).toString();assert.match(verification,/jar verified/i);
const certificate=exec('keytool',['-printcert','-jarfile',aab]).toString();const sha256Cert=certificate.match(/SHA256:\s*([A-F0-9:]+)/i)?.[1];assert.ok(sha256Cert,'Cannot read upload certificate');
const report={package:m.attrs.package,version:m.attrs.versionName,versionCode:Number(m.attrs.versionCode),targetSdk:Number(sdk.attrs.targetSdkVersion),minSdk:Number(sdk.attrs.minSdkVersion),signed:true,certificateSha256:sha256Cert,sha256:crypto.createHash('sha256').update(fs.readFileSync(aab)).digest('hex'),permissions,updaterProviderCount:providers.length,nativeLibraries:entries.filter(n=>/^base\/lib\/.*\.so$/.test(n)).length};
console.log(JSON.stringify(report,null,2));
