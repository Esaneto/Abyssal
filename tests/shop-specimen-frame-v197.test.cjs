const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const game=read('public/game.js'),css=read('public/abyssal-deep-systems.css');
const start=game.indexOf('function shopPreviewTransform('),end=game.indexOf('function renderShopSpecimenFramed(',start);
const sandbox={};vm.runInNewContext(game.slice(start,end)+';this.fit=shopPreviewTransform;',sandbox);
test('shop frame centers asymmetric, long and tall anatomy without stretching or clipping',()=>{
 for(const [w,h] of [[314,142],[150,112],[500,194]])for(const fit of [{cx:220,cy:175,width:170,height:55},{cx:185,cy:234,width:53,height:190},{cx:192,cy:192,width:70,height:70}]){
  const f=sandbox.fit(fit,w,h);
  assert.ok(Math.abs(f.x+fit.cx*f.scale-w/2)<1e-9);
  assert.ok(Math.abs(f.y+fit.cy*f.scale-h/2)<1e-9);
  assert.ok(fit.width*f.scale<=w*.60+1e-9);assert.ok(fit.height*f.scale<=h*.70+1e-9);
 }
});
test('shop resets legacy canvas offsets and retains measured per-species bounds',()=>{
 assert.match(css,/specimen-vessel canvas:not\(\[hidden\]\)\{[^}]*inset:0!important/);
 assert.match(css,/specimen-vessel canvas\[hidden\]\{display:none!important\}/);
 assert.match(game,/shopSpecimenFraming\.set\(key,fit\)/);
 assert.match(game,/isSpecimenVessel&&kind==='player'&&skin\)\{renderShopSpecimenFramed/);
 assert.match(game,/shopMotionObserver/);
});
