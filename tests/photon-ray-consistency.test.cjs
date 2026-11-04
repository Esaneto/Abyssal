'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const ray=require('../public/photon-ray-config');

test('Photon Ray uses a single shared immutable visual configuration',()=>{
 assert.equal(ray.color,'#ff8df4');
 assert.equal(ray.pulseInterval,.25);
 assert.ok(ray.remoteHold>ray.pulseInterval,'remote visual survives a normal pulse gap');
 assert.ok(ray.widths[1]<ray.widths[2]&&ray.widths[2]<ray.widths[3]);
 assert.ok(Object.isFrozen(ray));
 assert.ok(Object.isFrozen(ray.widths));
 const html=read('public/index.html');
 assert.ok(html.indexOf('photon-ray-config.js')<html.indexOf('game.js'),'load shared config before game');
 assert.match(read('public/game.js'),/const PHOTON_RAY_VISUAL=window\.AbyssalPhotonRay/);
 assert.match(read('server.js'),/const PhotonRay = require\('\.\/public\/photon-ray-config'\)/);
});

test('Photon Ray remote pulses reuse a single effect per connection and do not echo own shots',()=>{
 const game=read('public/game.js'),online=read('public/online.js');
 assert.match(game,/remoteBeamKey===beamKey/);
 assert.match(game,/existing\.life=PHOTON_RAY_VISUAL\.remoteHold/);
 assert.match(game,/localPhotonBeam/);
 assert.match(online,/data\.fromId!==socket\?\.id/);
 assert.match(read('server.js'),/if\(shot\.special==='photonRay'\)io\.to\(channelFor\(room\)\)\.emit\('shared-shot',shot\)/);
});

test('Cooperative ray endpoints are validated and reconstructed, not enlarged by client',()=>{
 const server=read('server.js'),game=read('public/game.js');
 assert.match(game,/beamEndX:target\.x\/W,beamEndY:target\.y\/H/);
 assert.match(server,/Math\.hypot\(\(endX-x\)\*WORLD_WIDTH,\(endY-y\)\*WORLD_HEIGHT\)<=range\+8\/WORLD_ZOOM/);
 assert.match(game,/remoteEndValid\?d\.beamEndX\*W/);
 assert.match(server,/shot\.beamLevel=Math\.max\(1,Math\.min\(PhotonRay\.maxLevel/);
});

test('Remote ray anchors use interpolated peer and enemy positions every render step',()=>{
 const game=read('public/game.js'),online=read('public/online.js'),server=read('server.js');
 assert.match(online,/function getPlayerById\(id\)/);
 assert.match(game,/beam\.remoteBeamKey/);
 assert.match(game,/getPlayerById\?\.\(beam\.remoteBeamKey\)/);
 assert.match(game,/onlineEnemyById\.get\(beam\.remoteTargetId\)/);
 assert.match(game,/Math\.exp\(-dt\*18\)/);
 assert.match(server,/shot\.beamTargetId=targetId/);
});

test('Pulse ability keeps immediate local feedback and reverts on explicit server rejection',()=>{
 const game=read('public/game.js'),online=read('public/online.js'),server=read('server.js');
 assert.match(game,/const sent=window\.AbyssalOnline\?\.sendActiveAbility\?\.\('pulse',result=>/);
 assert.match(game,/pulseCaster\.pulseCooldown=0/);
 assert.match(server,/socket\.on\('active-ability',\(payload,acknowledge\)=>/);
 assert.match(server,/ack\(false,'cooldown'\)/);
 assert.match(online,/socket\.timeout\(3000\)\.emit\('active-ability'/);
});

test('Network diagnostics record acknowledged local motion RTT without trusting wall-clock differences',()=>{
 const game=read('public/game.js'),online=read('public/online.js');
 assert.match(online,/sentAt:now/);
 assert.match(online,/performance\.now\(\)-predicted\.sentAt/);
 assert.match(online,/motionJitterMs/);
 assert.match(game,/network:window\.AbyssalOnline\?\.positionDiagnostics\?\.\(\)/);
});

test('Server enforces Photon Ray pulse rate, hit range and a capped damage budget',()=>{
 const server=read('server.js');
 assert.match(server,/player\.photonDamageReadyAt=now\+190/);
 assert.match(server,/requestedDamage=Math\.min\(requestedDamage,45\)/);
 assert.match(server,/shooter\.photonShotReadyAt=now\+190/);
 assert.match(server,/return reject\('photon-out-of-range'\)/);
});

test('PvP photon rays clip both body and core before drawing, without nested line-of-sight stepping',()=>{
 const game=read('public/game.js');
 assert.match(game,/let photonX2=fx\.x2,photonY2=fx\.y2/);
 assert.match(game,/for\(let step=0;step<9;step\+\+\)/);
 assert.match(game,/ctx\.lineTo\(photonX2,photonY2\);ctx\.stroke\(\)/);
 assert.doesNotMatch(game,/for\(let rs=1;rs<=steps;rs\+\+\)/);
});
