'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),path=require('node:path'),os=require('node:os');
const repo='Esaneto/Abyssal',stable='downloads-2';
function gh(args,opts={}){return cp.execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...opts});}
function readPrevious(name,dir){try{gh(['release','download',stable,'--repo',repo,'--pattern',name,'--dir',dir,'--clobber']);return JSON.parse(fs.readFileSync(path.join(dir,name),'utf8').replace(/^\uFEFF/,''));}catch(e){const msg=String(e.stderr||e.message);if(/no assets match|no asset found|release not found|HTTP 404/i.test(msg))return null;throw e;}}
function cmp(a,b){const x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);return (x[0]-y[0])||(x[1]-y[1])||(x[2]-y[2])||0;}
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function publishStable({file,name,metadata,previous,dir}){
 if(previous&&cmp(previous.version,metadata.version)>=0){console.log('Stable version already equal or newer:',previous.version);return false;}
 const tag='native-'+metadata.platform+'-v'+metadata.version+'-r'+process.env.GITHUB_RUN_NUMBER+'-a'+(process.env.GITHUB_RUN_ATTEMPT||'1');
 const metaName=name==='Abyssal-Android.apk'?'Abyssal-Android-build.json':'Abyssal-Windows-build.json';
 metadata.url='https://github.com/'+repo+'/releases/download/'+tag+'/'+name;
 const out=path.join(dir,metaName);fs.writeFileSync(out,JSON.stringify(metadata)+'\n');
 const binary=path.join(dir,name);if(path.resolve(file)!==path.resolve(binary))fs.copyFileSync(file,binary);
 // Publish an immutable versioned package first; only then advance the public pointer.
 try{gh(['release','view',tag,'--repo',repo]);}catch(e){if(!/release not found|HTTP 404/i.test(String(e.stderr||e.message)))throw e;gh(['release','create',tag,'--repo',repo,'--target',process.env.GITHUB_SHA,'--title','Abyssal '+metadata.platform+' '+metadata.version,'--notes','Validated native installer.','--prerelease']);}
 gh(['release','upload',tag,binary,out,'--repo',repo,'--clobber']);
 // Verify the immutable asset's digest before exposing it to update clients.
 const check=fs.mkdtempSync(path.join(os.tmpdir(),'abyssal-check-'));try{gh(['release','download',tag,'--repo',repo,'--pattern',name,'--dir',check]);if(sha(path.join(check,name))!==metadata.sha256)throw Error('published binary digest mismatch');}finally{fs.rmSync(check,{recursive:true,force:true});}
 gh(['release','upload',stable,binary,'--repo',repo,'--clobber']);
 gh(['release','upload',stable,out,'--repo',repo,'--clobber']);
 console.log('Stable published',metadata.platform,metadata.version,metadata.url);return true;
}
module.exports={gh,readPrevious,cmp,sha,publishStable,repo,stable};
