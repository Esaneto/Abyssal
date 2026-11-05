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

test('Server computes safe beam endpoints for cursor-directed cooperative and PvP rays',()=>{
 const server=read('server.js'),game=read('public/game.js');
 assert.match(game,/vx:ux\*900\/GAME_WORLD_ZOOM\/W,vy:uy\*900\/GAME_WORLD_ZOOM\/H/);
 assert.match(server,/shot\.beamEndX=clamp\(ex\/WORLD_WIDTH,0,1\)/);
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

test('Photon Ray preserves stop events when the skill is unequipped',()=>{
 const game=read('public/game.js'),online=read('public/online.js'),server=read('server.js');
 assert.match(game,/player\.photonRayActive=true/);
 assert.match(game,/if\(onlineMode\)window\.AbyssalOnline\?\.sendPhotonRayStop\?\.\(\)/);
 assert.match(game,/abyssal-remote-photon-stop/);
 assert.match(online,/socket\.on\('photon-ray-stop'/);
 assert.match(online,/socket\.emit\('photon-ray-stop'\)/);
 assert.match(server,/socket\.on\('photon-ray-stop'/);
});

test('Server enforces Photon Ray pulse rate, hit range and a capped damage budget',()=>{
 const server=read('server.js');
 assert.match(server,/if\(!player\.photonServerResolving\)return reject\('photon-ray-server-only'\)/);
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

test('Ray collision detects any circular target crossed by the beam, including behind its aim point',()=>{
 const hit=ray.segmentCircleHit;
 assert.equal(hit(0,0,100,0,45,0,5),true,'target in middle of beam receives hit');
 assert.equal(hit(0,0,100,0,90,3,5),true,'target near end of beam receives hit');
 assert.equal(hit(0,0,100,0,50,20,5),false,'off-axis target is untouched');
 assert.equal(hit(0,0,100,0,120,0,5),false,'target beyond beam range is untouched');
 assert.equal(hit(0,0,0,0,0,0,5),true,'degenerate beam remains bounded');
 assert.equal(hit(0,0,100,0,50,0,0),true,'centerline hit works at zero radius');
});
test('Server is authoritative for multi-target PvE/PvP ray collision',()=>{
 const server=read('server.js'),game=read('public/game.js');
 assert.match(server,/for\(const enemy of \[\.\.\.\(room\.world\?\.enemies\|\|\[\]\)\]\)/);
 assert.match(server,/PhotonRay\.segmentCircleHit\(sx,sy,ex,ey/);
 assert.match(server,/processWorldDamage\(socket,Number\(enemy\.id\)/);
 assert.match(server,/for\(const target of room\.players\.values\(\)\)/);
 assert.match(server,/pvpRockAt\(sx\+ux\*distance,sy\+uy\*distance/);
 const rayBlock=game.slice(game.indexOf('if(upgrades.photonRay>0){'),game.indexOf('if(upgrades.nova>0)',game.indexOf('if(upgrades.photonRay>0){')));
 assert.match(rayBlock,/if\(!onlineMode\)\{/);
 assert.doesNotMatch(rayBlock,/if\(!isPvpMode\)\{dealEnemyDamage/);
});


test('PvE authoritative damage applies ricochet to Photon Ray and other resolved attacks', () => {
  const server = read('server.js');
  assert.match(server, /Number\(player\.ricochetLevel\)>0&&RICOCHET_SHOT_SKILLS\.has\(String\(skillId\|\|''\)\)/);
  assert.match(server, /processWorldDamage\(socket,Number\(next\.id\),Math\.max\(1,requestedDamage\*\.42\),'ricochet'/);
  assert.match(server, /if\(shot\.special==='photonRay'\)[\s\S]*processWorldDamage\(socket,Number\(enemy\.id\),Math\.min\(45/);
});
