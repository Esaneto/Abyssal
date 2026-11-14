const test=require('node:test'),assert=require('node:assert/strict'),rig=require('../public/abyssal-diver-rig');
test('preview frames fit complete diver, weapon and active bubbles in any direction',()=>{
 for(const [w,h] of [[660,750],[320,220],[240,340]])for(const held of ['none','abyssWeapon','abyssPropulsor'])for(let i=0;i<16;i++){
  const a=i*Math.PI/8,powered=held==='abyssPropulsor',aim=a+.71,f=rig.previewFrame(w,h,a,aim,held,powered),s=f.r*.60/14;
  const bounds=[[-84,-33,43,32,a]];
  if(held==='abyssWeapon')bounds.push([-3,-2,72,32,aim]);
  if(powered)bounds.push([-116,-17,67,23,aim]);
  for(const [x0,y0,x1,y1,t] of bounds)for(const x of [x0,x1])for(const y of [y0,y1]){
   const px=f.x+s*(x*Math.cos(t)-y*Math.sin(t)),py=f.y+s*(x*Math.sin(t)+y*Math.cos(t));
   assert.ok(px>=0&&px<=w&&py>=0&&py<=h);
  }
 }
});
test('preview framing does not alter weapon anchors or articulated bones',()=>{assert.deepEqual(rig.rifleGrips,[[34,2],[22,11]]);const p=rig.leg(1,1,1);assert.ok(Math.abs(Math.hypot(p.knee[0]-p.hip[0],p.knee[1]-p.hip[1])-22)<1e-8);});
