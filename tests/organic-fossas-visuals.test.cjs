'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const H=require('../public/abyssal-rift-hardcore');
const Map=require('../public/abyssal-map');
const curated=require('../public/abyssal-curated-skins').items;
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const layout=Map.createLayout('organic-traps-and-figure-test',7);
const hazards=H.build(layout,7);
function inPhase(h,progress){
 return h.period-h.offset-h.active+h.active*progress;
}
test('volcanic rocks originate against walls in mob chambers and narrow corridors',()=>{
 const rocks=hazards.filter(h=>h.type==='volcano');
 assert.ok(rocks.some(h=>h.roomId.startsWith('passage:')),'narrow path installations');
 assert.ok(rocks.some(h=>['shoal','hub','landing'].includes(h.roomId)),'mob room installations');
 for(const h of rocks){
  assert.ok(Number.isFinite(h.sourceX)&&Number.isFinite(h.sourceY),'attached vent origin');
  assert.ok(h.length>=120&&h.radius<=100);
  assert.equal(H.hit(h,h.x,h.y,0,H.state(h,inPhase(h,.52))),true);
  assert.equal(H.hit(h,h.x+Math.sin(h.angle)*200,h.y-Math.cos(h.angle)*200),false);
  const room=layout.rooms.find(r=>r.id===h.roomId);
  if(room){
   const boundary=Math.hypot((h.sourceX-room.x)/room.rx,(h.sourceY-room.y)/room.ry);
   assert.ok(boundary>.87&&boundary<1.01,'source must stay on wall: '+h.id);
  }else assert.ok(Map.isWalkable(layout,h.sourceX,h.sourceY),'corridor mount in cave');
 }
});
test('anemones are fixed to room walls and their poisonous cloud expands during active period',()=>{
 const plants=hazards.filter(h=>h.type==='fumarole');
 assert.ok(plants.length>0);
 for(const h of plants){
  assert.ok(Number.isFinite(h.sourceX));
  const early=H.state(h,inPhase(h,.04)),late=H.state(h,inPhase(h,.9));
  assert.equal(early.phase,'active');assert.equal(late.phase,'active');
  assert.ok(h.poisonRays.length>=29,'cloud envelope follows the cave');
  const middle=h.poisonRays[Math.floor(h.poisonRays.length/2)];
  const ox=h.poisonOriginX,oy=h.poisonOriginY;
  const d=middle.length*.69,pointX=ox+Math.cos(middle.angle)*d,pointY=oy+Math.sin(middle.angle)*d;
  assert.equal(H.hit(h,pointX,pointY,0,early),false);
  assert.equal(H.hit(h,pointX,pointY,0,late),true);
  assert.equal(Map.isWalkable(layout,ox+Math.cos(middle.angle)*(middle.length+35),oy+Math.sin(middle.angle)*(middle.length+35)),false,'cloud stops at a rock wall');
 }
});
test('deep vortex begins with bubble warning and grows its suction zone gradually',()=>{
 const v=hazards.find(h=>h.type==='vortex');assert.ok(v);
 const warn=H.state(v,v.period-v.offset-v.active-v.warning*.55);
 const early=H.state(v,inPhase(v,.02)),late=H.state(v,inPhase(v,.98));
 assert.equal(warn.phase,'warning');
 assert.equal(early.phase,'active');assert.equal(late.phase,'active');
 assert.ok(v.roomId.startsWith('passage:'),'vortex is never in a monster room');
 const testX=v.x-Math.sin(v.angle)*v.acrossRadius*.78,testY=v.y+Math.cos(v.angle)*v.acrossRadius*.78;
 assert.equal(H.hit(v,testX,testY,0,early),false);
 assert.equal(H.hit(v,testX,testY,0,late),true);
 assert.ok(v.acrossRadius>140,'large enough to stretch across the corridor');
});
test('tentacle locations are deterministic per attack cycle and never hit outside the warning shape',()=>{
 const tentacles=hazards.filter(h=>h.type==='tentacle');assert.ok(tentacles.length>0);
 for(const h of tentacles){
  const attack=H.state(h,inPhase(h,.23)),next=H.state(h,inPhase(h,.23)+h.period);
  assert.equal(attack.phase,'active');assert.equal(next.cycle,attack.cycle+1);
  const current=H.hazardAtCycle(h,attack.cycle);
  const p=current.sourceX+Math.cos(current.angle)*current.length*.2,q=current.sourceY+Math.sin(current.angle)*current.length*.2;
  assert.equal(H.hit(h,p,q,0,attack),true,'tentacle causes damage only at the impact');
  assert.equal(H.hit(h,p+900,q+900,0,attack),false);
  assert.equal(H.hit(h,p,q,0,H.state(h,inPhase(h,.75))),false,'tentacle retreat is no longer a strike');
 }
});
test('tutorial illustrations depict the actual hazard warning languages',()=>{
 const html=read('public/index.html'),guide=read('public/abyssal-tutorials.js'),css=read('public/abyssal-tutorials.css');
 assert.ok(html.indexOf('abyssal-tutorial-art.js')<html.indexOf('abyssal-tutorials.js'),'art loaded before guide');
 assert.match(guide,/abyssalGuideHazardGallery/);
 assert.match(guide,/guide-step-title/);
 assert.match(css,/abyssal-guide-gallery-item/);
 const before=globalThis.AbyssalTutorialArt;
 require('../public/abyssal-tutorial-art');
 const art=globalThis.AbyssalTutorialArt;
 for(const kind of ['volcano','poison','vortex','tentacle','checkpoint','final']){
  const svg=art.render(kind);assert.match(svg,/viewBox="0 0 144 98"/);assert.match(svg,/<svg/);assert.ok(svg.length>450);
 }
 assert.match(art.render('tentacle'),/#ff496b/);
 if(before!==undefined)globalThis.AbyssalTutorialArt=before;
});
test('all curated species paint a finite silhouette with family-specific detail, at two swimming frames',()=>{
 require('../public/marine-art.js');
 const painter=globalThis.AbyssalMarineArt;
 const methods=['save','restore','translate','rotate','scale','beginPath','moveTo','lineTo','bezierCurveTo',
  'quadraticCurveTo','closePath','stroke','fill','ellipse','arc','drawImage','clearRect','fillRect'];
 for(const skin of curated){
  for(const tick of [1000,1290]){
   let pathCalls=0;
   const ctx={globalAlpha:1,createRadialGradient(){return {addColorStop(){}}}};
   for(const method of methods)ctx[method]=(...args)=>{
    for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),skin.id+':'+method);
    if(['ellipse','bezierCurveTo','quadraticCurveTo'].includes(method))pathCalls++;
   };
   assert.doesNotThrow(()=>painter.draw(ctx,80,55,16,0,skin,tick,0),skin.id);
   assert.ok(pathCalls>=2,'missing anatomy for '+skin.id);
  }
 }
});


test('every hazard renders at rest, during its distinct warning and during attack without invalid Canvas geometry',()=>{
 const common=['save','restore','beginPath','closePath','translate','rotate','scale','moveTo','lineTo','arc','ellipse',
  'quadraticCurveTo','bezierCurveTo','stroke','fill','roundRect','setLineDash','fillRect','strokeRect'];
 for(const h of hazards){
  for(const [phase,at] of [['idle',h.period-h.offset-h.active-h.warning-2],['warning',h.period-h.offset-h.active-h.warning*.5],['active',inPhase(h,.5)]]){
   const paints=[];let shapes=0;
   const c={globalAlpha:1};
   for(const m of common)c[m]=(...args)=>{
    for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),h.id+':'+m);
    if(['stroke','fill'].includes(m))shapes++;
   };
   const gradient={addColorStop(a,b){assert.ok(Number.isFinite(a));assert.ok(typeof b==='string')}};
   c.createRadialGradient=(...args)=>{assert.ok(args.every(Number.isFinite));return gradient};
   c.createLinearGradient=(...args)=>{assert.ok(args.every(Number.isFinite));return gradient};
   for(const key of ['fillStyle','strokeStyle'])Object.defineProperty(c,key,{
    configurable:true,get(){return this['_'+key]},
    set(value){this['_'+key]=value;if(typeof value==='string')paints.push(value);}
   });
   assert.doesNotThrow(()=>H.draw(c,[h],at),h.id+':'+phase);
   assert.ok(shapes>=(phase==='idle'?0:2),'hazard must paint visible shapes when primed: '+h.id+':'+phase);
   if(h.type!=='tentacle'){
    assert.ok(!paints.some(col=>col.startsWith('rgba(255,34,60,')||col.startsWith('rgba(211,73,128,')),
     'non-tentacle cannot use the filled red attack telegraph: '+h.id);
   }else if(phase==='warning'){
    assert.ok(!paints.some(col=>col.startsWith('rgba(255,34,60,')),
     'the hole stays secret during the initial warning, without purple spawn icon');
   }
  }
 }
});

test('every non-vortex hazard is embedded at the actual navigable cavern boundary',()=>{
 const mounted=hazards.filter(h=>h.type!=='vortex'),vortices=hazards.filter(h=>h.type==='vortex');
 assert.ok(mounted.length>12,'wall threats found in several rooms');
 assert.ok(vortices.length>0&&vortices.every(h=>h.sourceX===undefined),'vortex remains a floor hazard');
 for(const h of mounted){
  assert.ok(['chamber','corridor'].includes(h.wallKind),h.id+' wall classification');
  assert.ok(Number.isFinite(h.sourceX)&&Number.isFinite(h.sourceY),h.id+' embedded wall position');
  const outX=h.sourceX-Math.cos(h.angle)*33,outY=h.sourceY-Math.sin(h.angle)*33;
  const inX=h.sourceX+Math.cos(h.angle)*35,inY=h.sourceY+Math.sin(h.angle)*35;
  assert.equal(Map.isWalkable(layout,outX,outY),false,h.id+' backed by real rock, not overlapping a corridor');
  assert.equal(Map.isWalkable(layout,inX,inY),true,h.id+' enters playable water');
  const phase=H.state(h,inPhase(h,h.type==='tentacle'?.23:h.type==='spikes'?.16:.5));
  if(h.type!=='fumarole'&&h.type!=='rockfall'&&h.type!=='lure'&&h.type!=='pressure'){
   const target=h.type==='tentacle'?H.hazardAtCycle(h,phase.cycle):h;
   const inside=H.hit(h,target.x,target.y,0,phase);
   assert.ok(inside,'hazard center must be within its own active geometry: '+h.id);
  }
 }
});
test('embedded vents do not overlap entrance checkpoints or exit vortices',()=>{
 for(const h of hazards.filter(h=>h.sourceX!==undefined)){
  for(const p of Object.values(layout.portals||{})){
   if(!p)continue;
   assert.ok(Math.hypot(h.sourceX-p.x,h.sourceY-p.y)>(Number(p.r)||0)+140,
    h.id+' overlaps a critical passage portal '+p.id);
  }
 }
});

test('spear tips cross the chamber quickly, then withdraw for the rest of their attack',()=>{
 const spikes=hazards.filter(h=>h.type==='spikes');assert.ok(spikes.length);
 for(const h of spikes){
  const early=H.state(h,inPhase(h,.015));
  const peak=H.state(h,inPhase(h,.15));
  const retreat=H.state(h,inPhase(h,.82));
  const tx=h.sourceX+Math.cos(h.angle)*h.length*.90;
  const ty=h.sourceY+Math.sin(h.angle)*h.length*.90;
  assert.equal(H.hit(h,tx,ty,0,early),false);
  assert.equal(H.hit(h,tx,ty,0,peak),true);
  assert.equal(H.hit(h,tx,ty,0,retreat),false);
  assert.ok(h.length>h.radius*3,'spines must span more than a decorative short patch');
 }
});
test('volcanoes reach the opposite wall and stop without passing through rock',()=>{
 const rocks=hazards.filter(h=>h.type==='volcano');assert.ok(rocks.length);
 for(const h of rocks){
  const d=h.length,a=h.angle;
  const beforeX=h.sourceX+Math.cos(a)*(d-23);
  const beforeY=h.sourceY+Math.sin(a)*(d-23);
  const afterX=h.sourceX+Math.cos(a)*(d+46);
  const afterY=h.sourceY+Math.sin(a)*(d+46);
  assert.ok(Map.isWalkable(layout,beforeX,beforeY),'flames reach navigable water near the opposite wall');
  // The raycast stops at the first obstruction, even if a second cavern opens after it.
  assert.ok(d>120,'jet travels much farther than the old decorative plume');
  assert.equal(H.hit(h,beforeX,beforeY,0,H.state(h,inPhase(h,.45))),true);
  assert.equal(H.hit(h,afterX,afterY,0,H.state(h,inPhase(h,.45))),false);
 }
});

test('the purple tentacle has a hidden wall opening, rapid impact, and prolonged recovery',()=>{
 const h=hazards.find(item=>item.type==='tentacle');assert.ok(h);
 const warning=H.state(h,h.period-h.offset-h.active-h.warning*.5);
 const strike=H.state(h,inPhase(h,.22));
 const recovery=H.state(h,inPhase(h,.80));
 assert.equal(H.extension(h,warning),0);
 assert.ok(H.extension(h,strike)>.99);
 assert.ok(H.extension(h,recovery)<.5);
 const cur=H.hazardAtCycle(h,strike.cycle);
 const x=cur.sourceX+Math.cos(cur.angle)*cur.length*.45,y=cur.sourceY+Math.sin(cur.angle)*cur.length*.45;
 assert.equal(H.hit(h,x,y,0,warning),false);
 assert.equal(H.hit(h,x,y,0,strike),true);
 assert.equal(H.hit(h,x,y,0,recovery),false);
});
test('nearly full-width corridor vortex occupies the route rather than a mob chamber',()=>{
 const vortex=hazards.filter(h=>h.type==='vortex');
 assert.ok(vortex.length>0);
 for(const v of vortex){
  assert.ok(v.roomId.startsWith('passage:'));
  assert.ok(v.acrossRadius/v.passageWidth>.95,'vortex spans from rock to rock');
  assert.ok(Map.isWalkable(layout,v.x,v.y));
 }
});
