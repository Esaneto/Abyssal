const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('../public/abyssal-curated-skins');
test('every expansion skin draws distinct geometry without reusing another skin ID',()=>{
 const box={};vm.runInNewContext(fs.readFileSync('public/marine-art.js','utf8'),box);const seen=new Map();
 for(const s of C.items){
  assert.equal(s.renderer,'marine');assert.equal(s.art,undefined);
  const commands=[];const ctx=new Proxy({},{get:(_,key)=>key==='createRadialGradient'?()=>({addColorStop(){}}):(...args)=>{if(!['fill','stroke','save','restore'].includes(key))commands.push([key,...args]);},set:()=>true});
  box.AbyssalMarineArt.draw(ctx,0,0,20,0,{...s,color:'#777777'},1000,0);
  const signature=JSON.stringify(commands);assert.ok(!seen.has(signature),`${s.id} repeats ${seen.get(signature)}`);seen.set(signature,s.id);
 }
 assert.equal(seen.size,42);
});
