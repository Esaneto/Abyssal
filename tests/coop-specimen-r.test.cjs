const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Standard = require('../public/skin-standard.js');
const source = fs.readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
const start=source.indexOf("socket.on('skin-ability'");
const end=source.indexOf("\n socket.on(",start+10);
const handler=source.slice(start,end);

test('all ten coop R abilities accept delayed client origin and broadcast authoritative specimen origin',()=>{
  assert.ok(start>=0 && end>start);
  for(const active of Standard.ACTIVE_KEYS){
    const skin=Object.values(Standard.profiles).find(p=>p.active===active).id;
    let now=100000, timers=[], events=[], hits=[], ack=null, fn;
    const player={id:'p1',skinId:skin,alive:true,specimenAlive:true,specimenX:1000,specimenY:1000,x:900,y:900};
    const enemy={id:1,x:1040,y:1000,r:10,hp:1000};
    const room={mode:'coop',players:new Map([[player.id,player]]),world:{enemies:[enemy]}};
    const socket={id:player.id,data:{joined:true},on:(event,callback)=>fn=callback};
    const deps={socket,socketRoom:()=>room,SkinStandard:Standard,Date:{now:()=>now},clamp:(n,lo,hi)=>Math.max(lo,Math.min(hi,n)),roomWorldWidth:()=>4800,roomWorldHeight:()=>3000,specimenPositionFor:()=>({x:player.specimenX,y:player.specimenY}),WORLD_ZOOM:.78,WorldSimulation:{classicCavernRocks:()=>[]},ClassicCavern:{segmentBlocked:()=>false},io:{to:()=>({emit:(event,data)=>events.push({event,data})})},channelFor:()=> 'room',processWorldDamage:(_s,id,amount,skill)=>{assert.equal(player.skinActiveServerResolving,true);hits.push({id,amount,skill});enemy.hp-=amount;return {ok:true};},setTimeout:(f,delay)=>timers.push({f,at:now+delay})};
    new Function(...Object.keys(deps),handler)(...Object.values(deps));
    fn({type:'standard-active',active,skin,x:.01,y:.01,angle:0},r=>ack=r);
    assert.equal(ack.ok,true,active);
    const event=events.find(e=>e.event==='peer-skin-ability');
    assert.ok(event,active);
    assert.ok(Math.abs(event.data.x-1000/4800)<1e-8,active);
    while(timers.length){timers.sort((a,b)=>a.at-b.at);const t=timers.shift();now=t.at;t.f();}
    const damage=hits.reduce((sum,h)=>sum+h.amount,0);
    const expected={cloud:70,push:60,shot:80,pulse:60,slowShot:60};
    if(active in expected)assert.equal(damage,expected[active],active);
    if(active==='dash')assert.ok(events.some(e=>e.event==='specimen-dash'));
    if(active==='shield')assert.ok(events.some(e=>e.event==='skin-shield-bubble'));
    if(active==='shot'||active==='slowShot')assert.ok(events.some(e=>e.event==='skin-shot-telegraph'));
    fn({type:'standard-active',active,skin,x:.01,y:.01,angle:0},r=>ack=r);
    assert.equal(ack.ok,false,active+' cooldown');
  }
});
