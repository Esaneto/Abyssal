'use strict';
// Visual regression of the REAL Abyssal login markup and CSS in Chromium.
// Screenshot each viewport BEFORE asserting geometry for easy failure diagnosis.
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../public');
const output=path.resolve(__dirname,'../test-artifacts/browser-smoke');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp',
  '.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.json':'application/json'};
const probe=String.raw`<script>
(function(){
 const run=()=>{
  const root=document.getElementById('loginScreen');
  if(!root)return;
  root.hidden=false;
  if(new URLSearchParams(location.search).get('view')==='register'){
    document.getElementById('abyssRegisterFields').hidden=false;
    document.getElementById('abyssEntryTerms').hidden=false;
    document.getElementById('abyssEntryHeading').textContent='CRIAR CONTA';
    document.getElementById('loginSubmitBtn').textContent='CRIAR MINHA CONTA';
    document.getElementById('registerBtn').setAttribute('aria-selected','true');
    document.getElementById('loginModeSignIn').setAttribute('aria-selected','false');
  }
  {
   const shell=root.querySelector('.abyss-entry-shell');
   const panel=root.querySelector('.abyss-entry-panel');
   const brand=root.querySelector('.abyss-entry-brand strong');
   const candidates=['loginModeSignIn','registerBtn','loginSubmitBtn','loginGuestBtn','nicknameInput','passwordInput','emailInput','birthDateInput'].map(id=>document.getElementById(id)).filter(Boolean);
   const controls=candidates.filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden]'));
   const width=innerWidth;
   const within=(e)=>{const r=e.getBoundingClientRect();return r.left>=-2&&r.right<=width+2&&r.width>0;};
   const hitTargets=['loginModeSignIn','registerBtn','loginSubmitBtn','loginGuestBtn'].map(id=>document.getElementById(id)).filter(Boolean).every(e=>e.getBoundingClientRect().height>=42);
   const shellFits=within(shell)&&shell.getBoundingClientRect().top>=-2;
   const brandFits=within(brand);
   const fieldFits=controls.every(within);
   const noOverflow=root.scrollWidth<=root.clientWidth+2&&panel.scrollWidth<=panel.clientWidth+2;
   const okay=shellFits&&brandFits&&fieldFits&&noOverflow&&hitTargets;
   document.body.dataset.loginQaStatus=okay?'ok':'fail';
   document.body.dataset.loginQaMetrics=JSON.stringify({width,shellFits,brandFits,fieldFits,noOverflow,hitTargets,controls:controls.length});
  }
 };
 run();
})();
</script>`;
function handler(req,res){
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return res.writeHead(400).end();}
 const isLogin=pathname==='/__abyss_login__';
 const file=isLogin?path.join(root,'index.html'):path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(err,data)=>{
  if(err)return res.writeHead(404).end('Not found');
  if(isLogin){
    const document=String(data);
    const head=document.match(/<head>([\s\S]*?)<\/head>/i)?.[1]||'';
    const cleanHead=head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    const section=document.match(/<section id="loginScreen"[\s\S]*?<\/section>/i)?.[0];
    assert.ok(section,'Real login markup not found');
    data=Buffer.from('<!doctype html><html lang="pt-BR"><head>'+cleanHead+'</head><body><div id="app">'+section+'</div>'+probe+'</body></html>');
  }
  const ext=isLogin?'.html':path.extname(file);
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 });
}
function browser(){
 for(const candidate of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
  const result=spawnSync('which',[candidate],{encoding:'utf8'});
  if(result.status===0)return result.stdout.trim();
 }
 return null;
}
function chrome(bin,args){
 return new Promise((resolve,reject)=>{
  const proc=spawn(bin,args,{stdio:['ignore','pipe','pipe']});
  let out='',err='';
  const timeout=setTimeout(()=>{proc.kill('SIGKILL');reject(Error('Chromium timeout: '+args.join(' ')));},45000);
  proc.stdout.on('data',x=>{out+=String(x);});
  proc.stderr.on('data',x=>{err+=String(x);if(err.length>3000)err=err.slice(-3000);});
  proc.once('error',e=>{clearTimeout(timeout);reject(e);});
  proc.once('close',status=>{clearTimeout(timeout);status===0?resolve(out):reject(Error('Chromium exited '+status+': '+err));});
 });
}
async function main(){
 const bin=browser();
 assert.ok(bin,'Chromium is required for login visual smoke');
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/__abyss_login__';
  const cases=[['desktop',1280,720,'login'],['mobile',390,844,'login'],['compact-register',320,568,'register'],['landscape',844,390,'register']];
  for(const [name,w,h,mode] of cases){
   const profile=fs.mkdtempSync(path.join(os.tmpdir(),'abyssal-login-smoke-'));
   try{
    const flags=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run',
      '--hide-scrollbars','--window-size='+w+','+h,'--force-device-scale-factor=1',
      '--virtual-time-budget=1400','--user-data-dir='+profile];
    const target=url+'?view='+mode;
    const screenshot=path.join(output,'login-'+name+'.png');
    await chrome(bin,[...flags,'--screenshot='+screenshot,target]);
    assert.ok(fs.existsSync(screenshot)&&fs.statSync(screenshot).size>6000,'Login screenshot not captured: '+name);
    const dom=await chrome(bin,[...flags,'--dump-dom',target]);
    const status=dom.match(/data-login-qa-status="([^"]*)"/)?.[1];
    const metrics=dom.match(/data-login-qa-metrics="([^"]*)"/)?.[1]||'not available';
    assert.equal(status,'ok','Login overflow/targets failed ('+name+'): '+metrics);
    console.log('[login-ui] '+name+' '+metrics);
   }finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3});}
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
