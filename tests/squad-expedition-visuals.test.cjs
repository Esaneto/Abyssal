'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'public/abyssal-squad-visuals.js'),'utf8');
function renderer(){const context={};vm.runInNewContext(source,context,{filename:'abyssal-squad-visuals.js'});return context.AbyssalSquadVisuals;}
function canvas(){const calls={};const gradient={addColorStop(offset,color){assert.equal(Number.isFinite(offset),true);assert.equal(typeof color,'string');}};return new Proxy({},{
 get(_obj,key){if(key==='createLinearGradient'||key==='createRadialGradient')return (...values)=>{assert.ok(values.every(Number.isFinite));return gradient;};if(typeof key==='string'&&key in calls)return calls[key];return (...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),key+' received non-finite argument');};},
 set(_obj,key,value){if(typeof value==='number')assert.ok(Number.isFinite(value),'non-finite style '+String(key));calls[key]=value;return true;}
});}
test('renders all nine expedition biomes using the existing coordinates',()=>{
 const v=renderer(),c=canvas();assert.equal(typeof v.paintBiome,'function');
 const zones=['origin','canyons','gardens','corals','black','kelp','crystals','hadal','vents'];
 zones.forEach((id,i)=>{const zone={id,x:i*200,y:i*100,w:2400,h:1500};v.paintBiome(c,zone,{x:zone.x,y:zone.y,w:1280,h:720},11);v.paintChartDetail(c,zone,5,8,220,130,11);});
});
test('rock collision geometry is only painted, never mutated',()=>{
 const v=renderer(),c=canvas(),poly=[[0,0],[55,3],[72,38],[10,41]],snapshot=JSON.stringify(poly);
 v.paintRock(c,{p:poly},'crystals',2);assert.equal(JSON.stringify(poly),snapshot);
});
test('caves, region flora, bosses, the diver and eight tentacle states have valid canvas commands',()=>{
 const v=renderer(),c=canvas(),cave={zone:'crystals',x:1000,y:600,r:220};
 v.paintCave(c,cave,12);
 for(const kind of ['glow','crystal','kelp','coral','vents','spires'])v.paintFeature(c,{zone:kind==='crystal'?'crystals':'gardens',x:200,y:300,size:13,alpha:.6,kind},12);
 for(const bossKind of ['kraken','devourer','whiteSharkBoss','maw','boss','angler'])v.paintBoss(c,{bossKind,zone:'corals',x:200,y:300,r:42},12);
 for(let i=0;i<8;i++)v.paintTrap(c,{x:500+i*30,y:400,index:i,radius:46},i%2?'active':'warning',12);
 v.paintDiver(c,{x:300,y:250,aim:1.2},12);
});
test('visual renderer is wired into actual playable expedition and chart scripts',()=>{
 const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 const play=fs.readFileSync(path.join(root,'public/abyssal-squad-playtest.js'),'utf8');
 const chart=fs.readFileSync(path.join(root,'public/abyssal-squad-map.js'),'utf8');
 assert.ok(html.indexOf('abyssal-squad-visuals.js')<html.indexOf('abyssal-squad-map.js'));
 for(const token of ['paintBiome','paintCave','paintFeature','paintRock','paintBoss','paintTrap','paintDiver'])assert.ok(play.includes('visuals.'+token),token+' missing from gameplay renderer');
 assert.ok(chart.includes('paintChartDetail'));
 assert.ok(play.includes('drawFinalBoss'),'original Pesadelo Roxo visual not retained');
});
