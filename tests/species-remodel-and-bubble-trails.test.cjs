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
test('all seven species retain stable catalogue IDs, prices and abilities',()=>{
 for(const id of ids){
  const skin=catalogue.byId[id];
  assert.ok(skin,id+' is missing');
  assert.equal(skin.price,originals[id],id+' changed price');
  assert.equal(skin.paid,false,id+' changed purchasing mode');
  assert.equal(skin.renderer,'marine');
  assert.ok(skin.ability&&skin.bonuses);
 }
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

test('blue-ring octopus draws black glossy bubbles, unlike cyan shark bubbles',()=>{
 assert.match(game,/function renderWakeBubble\(blob,dark\)/);
 assert.match(game,/for\(const b of sharkWakeTrails\)renderWakeBubble\(b,false\)/);
 assert.match(game,/for\(const ink of inkTrails\)renderWakeBubble\(ink,true\)/);
 assert.match(game,/dark\?'rgba\(2,3,9,\.97\)':/);
 assert.match(game,/dark\?'#8f9eb5':'#a6f7ff'/);
 assert.match(game,/Bolhas abissais: ao nadar, deixa bolhas negras/);
 // Keep the preexisting packet event IDs for backwards-compatible multiplayer.
 assert.match(game,/type:'ink-trail',skin:'aberration'/);
 assert.match(server,/source:'blue-ring-ink'/);
});

test('shark and octopus hit cadence is capped at 300ms per target in PvP',()=>{
 assert.match(game,/BUBBLE_TRAIL_HIT_SECONDS=\.30,BUBBLE_TRAIL_HIT_MS=300,BUBBLE_TRAIL_EMIT_SECONDS=\.20/);
 assert.match(server,/BUBBLE_TRAIL_HIT_SECONDS=\.30,BUBBLE_TRAIL_HIT_MS=300,BUBBLE_TRAIL_EMIT_MS=200/);
 assert.match(game,/player\.sharkTrailTimer=BUBBLE_TRAIL_EMIT_SECONDS/);
 assert.match(game,/player\.inkTrailTimer=BUBBLE_TRAIL_EMIT_SECONDS/);
 assert.match(game,/bubble\.damageTimer = BUBBLE_TRAIL_HIT_SECONDS/);
 assert.match(game,/ink\.damageTimer=BUBBLE_TRAIL_HIT_SECONDS/);
 assert.match(server,/target\.lastBubbleDamageAt=hitAt/);
 assert.match(server,/target\.lastBlackBubbleDamageAt=hitAt/);
 assert.match(server,/target\.invulnerableUntil=hitAt\+90/);
 assert.match(server,/BUBBLE_TRAIL_EMIT_MS\*\.8/);
 assert.match(game,/e\.poisonTick = SKIN_TRAIL_CADENCE_SECONDS/);
 assert.match(game,/SKIN_TRAIL_CADENCE_SECONDS=\.75/);
});
