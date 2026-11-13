const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('public/online.js','utf8');
function harness(){
 let time=100;const packets=[];const socket={connected:true,io:{engine:{transport:{writable:true}}},emit:(event,payload)=>packets.push({event,payload}),volatile:{emit:(event,payload)=>packets.push({event,payload})}};
 const box={socket,authenticated:true,currentRoom:{},latestPositionPayload:null,lastPositionAt:0,lastNetMetaAt:0,positionSequence:0,positionPacketsSent:0,pendingMotion:new Map(),performance:{now:()=>time},window:{AbyssalGameHooks:{getPlayerPosition:()=>({x:120,y:90,angle:1})}},buildPositionPayload:p=>p,buildNetMeta:()=>({})};vm.createContext(box);
 vm.runInContext(source.slice(source.indexOf('function flushPosition('),source.indexOf('function startPositionHeartbeat('))+source.slice(source.indexOf('function sendShot('),source.indexOf('function sendPhotonRayStop(')),box);
 return {box,packets,time:t=>time=t};
}
test('frame positions send immediately and remain capped at 30 Hz',()=>{
 const {box,packets,time}=harness();const motion=()=>packets.filter(p=>p.event==='player-motion-input');box.sendPosition({x:1,y:2});assert.equal(packets[0].event,'player-motion-input');
 for(let t=101;t<133;t++){time(t);box.sendPosition({x:t,y:2});}assert.equal(motion().length,1);
 time(134);box.sendPosition({x:134,y:2});assert.equal(motion().length,2);assert.equal(motion()[1].payload[1],134);
});
test('shot refreshes live origin before firing without waiting for an ack',()=>{
 const {box,packets}=harness();box.sendShot({volleyId:'v'});assert.deepEqual(packets.filter(p=>p.event!=='player-net-meta').map(p=>p.event),['player-motion-input','shared-shot']);assert.equal(packets[0].payload[1],120);
 box.sendShot({volleyId:'v'});assert.equal(packets.filter(p=>p.event==='player-motion-input').length,1);
});
test('backpressure discards stale transforms and later sends the freshest position',()=>{
 const {box,packets,time}=harness();box.socket.io.engine.transport.writable=false;box.sendPosition({x:1,y:1});assert.equal(packets.length,0);
 time(150);box.socket.io.engine.transport.writable=true;box.sendPosition({x:99,y:99});assert.equal(packets[0].payload[1],99);
 box.socket.connected=false;const before=packets.length;box.sendShot({});assert.equal(packets.length,before);
});

test('decoded peer transforms forward server timestamps to the motion buffer',()=>{
 const {readPlayerMotion,playerMotion}=require('../public/net-codec.js');const rows=readPlayerMotion(playerMotion([[7,100,200,1]],123456));
 const received=[],peer={id:'peer',netId:7};const context={playersByNetId:new Map([[7,'peer']]),players:new Map([['peer',peer]]),localPlayerId:'self',storePlayer:(p,t)=>received.push([p,t])};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function applyPlayerMotion('),source.indexOf('function getPlayers(')),context);context.applyPlayerMotion(rows);
 assert.equal(received.length,1);assert.equal(received[0][1],123456);assert.equal(received[0][0].y,200);
});
