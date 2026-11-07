'use strict';
// Real Chromium smoke: run an unmodified solo Fossas expedition at desktop and
// mobile viewports, capture frames, and fail on uncaught canvas/gameplay errors.
// No account, database or external servers are needed.
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');

const root=path.resolve(__dirname,'../public');
const output=path.resolve(__dirname,'../test-artifacts/browser-smoke');
const contentTypes={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
 '.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav'};
const injected=`<script>
(()=>{
 const errors=[],original=console.error;
 console.error=function(...parts){errors.push(parts.map(String).join(' '));return original.apply(this,parts)};
 window.addEventListener('error',event=>{if(event.message)errors.push(String(event.message))});
 window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
 const check=()=>{
  const canvas=document.getElementById('game'),active=document.body.classList.contains('game-active');
  document.body.dataset.smokeStatus=active&&canvas&&canvas.width>50&&canvas.height>50?'playing':'not-playing';
  document.body.dataset.smokeCanvas=(canvas?canvas.width+'x'+canvas.height:'missing');
  document.body.dataset.smokeError=errors.filter(e=>/Abyssal frame error|ReferenceError|TypeError|SyntaxError/i.test(e)).slice(0,2).join('|').slice(0,180);
 };
 setInterval(check,350);
 window.addEventListener('load',()=>{
   setTimeout(()=>{window.dispatchEvent(new CustomEvent('abyssal-start-rift-solo'));check()},950);
 });
})();
</script>`;
function handler(req,res){
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{return res.writeHead(400).end();}
 const smoke=pathname==='/__abyss_smoke__';
 const filepath=smoke?path.join(root,'index.html'):path.resolve(root,'.'+pathname);
 if(!filepath.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(filepath,(err,data)=>{
  if(err){res.writeHead(404);res.end('Not found');return;}
  const ext=smoke?'.html':path.extname(filepath);
  if(smoke)data=Buffer.from(data.toString('utf8').replace('</body>',injected+'</body>'));
  res.writeHead(200,{'Content-Type':contentTypes[ext]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 });
}
function browserBin(){
 for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
  const r=spawnSync('which',[name],{encoding:'utf8'});
  if(r.status===0)return r.stdout.trim();
 }
 return null;
}
async function run(browser,args){
 return await new Promise((resolve,reject)=>{
  const proc=spawn(browser,args,{stdio:['ignore','pipe','pipe'],env:{...process.env,HOME:os.homedir()}});
  let out='',err='',finished=false;
  const timeout=setTimeout(()=>{if(!finished){proc.kill('SIGKILL');reject(new Error('Browser timed out: '+args.join(' '))) }},55000);
  proc.stdout.on('data',chunk=>{out+=String(chunk);if(out.length>1500000)out=out.slice(-1500000)});
  proc.stderr.on('data',chunk=>{err+=String(chunk);if(err.length>10000)err=err.slice(-10000)});
  proc.once('error',error=>{finished=true;clearTimeout(timeout);reject(error)});
  proc.once('close',code=>{finished=true;clearTimeout(timeout);if(code!==0)reject(new Error('Chromium exit '+code+': '+err.slice(-2500)));else resolve(out)});
 });
}
async function main(){
 const browser=browserBin();assert.ok(browser,'Google Chrome or Chromium is required for real visual smoke tests');
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/__abyss_smoke__';
 try{
  for(const [label,width,height,ua] of [
   ['desktop',1280,720,null],
   ['mobile',390,844,'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36']]){
   const common=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars',
    '--no-first-run','--disable-background-networking','--autoplay-policy=no-user-gesture-required',
    '--window-size='+width+','+height,'--force-device-scale-factor=1','--virtual-time-budget=9000'];
   if(ua)common.push('--user-agent='+ua);
   const page=await run(browser,[...common,'--dump-dom',url]);
   const status=page.match(/data-smoke-status="([^"]+)"/)?.[1];
   const canvas=page.match(/data-smoke-canvas="([^"]+)"/)?.[1];
   const error=page.match(/data-smoke-error="([^"]*)"/)?.[1];
   assert.equal(status,'playing',label+' did not start gameplay, canvas='+canvas+', error='+error);
   assert.ok(!error,label+' triggered a runtime error: '+error);
   const screenshot=path.join(output,label+'.png');
   await run(browser,[...common,'--screenshot='+screenshot,url]);
   assert.ok(fs.statSync(screenshot).size>4500,label+' screenshot is blank or missing');
   console.log('[browser-smoke] '+label+' playing, canvas '+canvas+', screenshot '+fs.statSync(screenshot).size+' bytes');
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(err=>{console.error('[browser-smoke] '+err.stack);process.exitCode=1});
