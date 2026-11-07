'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Marine=require('../public/marine-art.js');
const Skins=require('../public/abyssal-curated-skins.js').items;
const Map=require('../public/abyssal-map.js');
const Hazards=require('../public/abyssal-rift-hardcore.js');
const fs=require('node:fs');
const path=require('node:path');

function paintRecorder(){
 const counts={fills:0,strokes:0,curves:0,lines:0,gradients:0};
 const gradient=()=>{counts.gradients++;return {addColorStop(){}};};
 const c={save(){},restore(){},translate(){},rotate(){},scale(){},beginPath(){},closePath(){},
  fill(){counts.fills++;},stroke(){counts.strokes++;},moveTo(){},lineTo(){counts.lines++;},
  quadraticCurveTo(){counts.curves++;},bezierCurveTo(){counts.curves++;},ellipse(){counts.curves++;},
  arc(){counts.curves++;},rect(){},fillRect(){counts.fills++;},strokeRect(){counts.strokes++;},
  createLinearGradient:gradient,createRadialGradient:gradient};
 return {c,counts};
}
test('all curated species render several swimming frames without detached-path runtime errors',()=>{
 assert.equal(Skins.length,42,'all expanded species should be included');
 for(const skin of Skins){
  for(const time of [0,1050,3900]){
   const {c,counts}=paintRecorder();
   assert.doesNotThrow(()=>Marine.draw(c,145,110,28,0,skin,time,false),
    skin.name+' @ '+time+'ms');
   assert.ok(counts.fills>=4,skin.name+' has no continuous filled body');
   assert.ok(counts.curves+counts.lines>=8,skin.name+' has no articulated geometry');
  }
 }
});
test('arm roots use a continuous muscular ribbon and do not rely on disconnected constant-width strokes',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../public/marine-art.js'),'utf8');
 assert.match(src,/Continuous eight-arm oral crown/);
 assert.match(src,/const points=Array\.from\(\{length:21\}/);
 assert.match(src,/for\(let j=points\.length-1;j>=0;j--\)/);
 assert.match(src,/Pear-shaped|pear-shaped/);
 assert.match(src,/Hatchetfish|hatchetfish/);
 assert.match(src,/Shoulder and hip sockets/);
 assert.match(src,/BIO_ACCENTS=Object\.freeze/);
});
test('all nine Fossa trap families paint without exceptions in warm and active phases',()=>{
 const layout=Map.createLayout(72433,7),hazards=Hazards.build(layout,7);
 for(const type of Object.keys(Hazards.TYPES)){
  const h=hazards.find(item=>item.type===type);
  assert.ok(h,'missing visual for '+type);
  const onset=h.period-h.active-h.warning-h.offset;
  for(const [label,seconds] of [['warning',onset+h.warning*.8],['active',onset+h.warning+h.active*.45]]){
   const {c,counts}=paintRecorder();
   assert.doesNotThrow(()=>Hazards.draw(c,[h],seconds),type+' '+label);
   assert.ok(counts.fills+counts.strokes>=3,'blank visual for '+type+' '+label);
  }
 }
});
test('visual anatomy edits retain authoritative trap geometry and attack timing contracts',()=>{
 assert.equal(Hazards.TYPES.tentacle.warning,3.2);
 assert.equal(Hazards.TYPES.tentacle.active,9.4);
 const layout=Map.createLayout(72433,7),trap=Hazards.build(layout,7).find(h=>h.type==='tentacle');
 assert.ok(trap);
 const t=trap.period-trap.active-trap.warning-trap.offset+trap.warning*.7;
 assert.equal(Hazards.hit(trap,trap.x,trap.y,0,Hazards.state(trap,t)),false);
 const active=trap.period-trap.active-trap.offset+trap.active*.33;
 const phase=Hazards.state(trap,active);
 assert.equal(phase.phase,'active');
 const path=Hazards.tentaclePath(trap,phase);
 assert.equal(path.length,33);
});