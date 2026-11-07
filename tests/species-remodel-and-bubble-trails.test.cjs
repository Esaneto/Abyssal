'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const catalogue=require('../public/abyssal-curated-skins.js');
const ids=['ribbonmoray','dumbo','blanket','atolla','phantomjelly','nautilus','gharial'];
const originals={ribbonmoray:52000,dumbo:58000,blanket:64000,atolla:48000,phantomjelly:69000,nautilus:72000,gharial:80000};
const art=read('public/marine-art.js');
const game=read('public/game.js');
const server=read('server.js');

function drawCommands(skin,time){
 const box={};vm.runInNewContext(art,box);
 const commands=[];
 const c=new Proxy({},{
  get:(_,name)=>name==='createRadialGradient'
   ?()=>({addColorStop(){}})
   :(...args)=>{if(!['save','restore','fill','stroke','beginPath','closePath'].includes(name))commands.push([name,...args]);},
  set:()=>true
 });
 box.AbyssalMarineArt.draw(c,0,0,20,0,{...skin,color:'#777777'},time,0);
 return commands;
}
test('all seven species retain stable catalogue IDs prices and standardized profiles',()=>{
 const S=require('../public/skin-standard.js');
 for(const id of ids){const skin=catalogue.byId[id];assert.ok(skin,id+' is missing');assert.equal(skin.price,originals[id]);assert.equal(skin.paid,false);assert.equal(skin.renderer,'marine');assert.equal(S.profile(id).percent,10);assert.ok(S.activeSpec(id));}
 assert.equal(new Set(ids).size,7);
});
test('each requested species has a distinct detailed Canvas anatomy and animated silhouette',()=>{
 const seen=new Map();
 for(const id of ids){
  const skin=catalogue.byId[id];
  const commands=drawCommands(skin,1000);
  assert.ok(commands.length>=25,id+' lacks anatomical details: '+commands.length);
  const signature=JSON.stringify(commands);
  assert.ok(!seen.has(signature),id+' duplicates '+seen.get(signature));
  seen.set(signature,id);
  const movement=JSON.stringify(drawCommands(skin,2480));
  assert.notEqual(signature,movement,id+' lacks independent animation');
 }
 assert.equal(seen.size,7);
});

test('the individual silhouettes have recognizable diagnostic anatomy',()=>{
 const body=(id,next)=>{
  const start=art.indexOf("}else if(id==='"+id+"'){");
  const end=art.indexOf(next,start);
  assert.ok(start>0&&end>start,id+' has no unique renderer branch');
  return art.slice(start,end);
 };
 assert.match(body('ribbonmoray',"}else if(id==='dumbo'){"),/dorsal|crest|sail/i);
 assert.match(body('dumbo',"}else if(id==='blanket'){"),/flap|ear|SHORT/i);
 assert.match(body('blanket',"}else if(id==='atolla'){"),/membrane|curtain|web/i);
 assert.match(body('atolla',"}else if(id==='phantomjelly'){"),/RADIAL|saw-tooth/i);
 assert.match(body('phantomjelly',"}else if(id==='yeticrab'){"),/transparent|filament/i);
 assert.match(body('nautilus',"}else if(id==='gharial'){"),/spiral|chambered/i);
 assert.match(body('gharial',"}else if(s.family==='shark'||s.family==='fish'){"),/rostrum|teeth|scutes/i);
});

test('blue-ring boss keeps black ink art while playable relic uses standardized trail',()=>{
 const S=require('../public/skin-standard.js');
 assert.match(game,/function renderWakeBubble\(blob,dark\)/);assert.match(game,/for\(const ink of inkTrails\)renderWakeBubble\(ink,true\)/);
 assert.match(game,/dark\?'rgba\(2,3,9,\.97\)':/);assert.equal(S.profile('aberration').active,'trail');
 assert.doesNotMatch(server,/source:'blue-ring-ink'/);
});
test('standardized trail is finite and rate limited in PvP',()=>{
 assert.match(server,/life:3\.2,damageTimer:\.45,skinActive:true/);
 assert.match(server,/bubble\.skinActive\?1\.1:1\.6/);
 assert.match(server,/bubble\.skinActive\?600:BUBBLE_TRAIL_HIT_MS/);
 assert.match(game,/bubble\.skinActive \? \.60 : BUBBLE_TRAIL_HIT_SECONDS/);
 assert.doesNotMatch(game,/player\.sharkTrailTimer=BUBBLE_TRAIL_EMIT_SECONDS/);
});
