const test = require('node:test');
const assert = require('node:assert/strict');
const { createMotionWatchdog, reconcileSnapshot, renderedPosition, pushMotionSample } = require('../public/enemy-netcode.js');

function enemyFrame(positions) { return positions.map(([id, x, y]) => ({ id, x, y })); }

test('motion watchdog diagnoses static snapshots without enabling a second client simulation', () => {
  const watch = createMotionWatchdog({ stallAfter: 3, resumeAfter: 4, healthyRatio: 0.18, motionEpsilon: 0.35 });
  const frame = enemyFrame([[1, 100, 100], [2, 200, 200], [3, 300, 300], [4, 400, 400]]);
  watch.observe(frame); watch.observe(frame); const result = watch.observe(frame);
  assert.equal(result.stalledStreak, 3);
  assert.equal(result.moved, 0);
  assert.equal(result.predicting, false, 'server-authoritative mode never falls back to duplicate local movement');
});

test('watchdog reports a healthy server snapshot stream', () => {
  const watch = createMotionWatchdog({ motionEpsilon: .35, healthyRatio: .18, resumeAfter: 4, stallAfter: 3 });
  let frame = enemyFrame([[1, 100, 100], [2, 200, 200]]); watch.observe(frame);
  for (let i=0;i<4;i++) { frame=frame.map(e=>({...e,x:e.x+4})); watch.observe(frame); }
  assert.equal(watch.diagnostics.moved, 2);
  assert.equal(watch.diagnostics.ratio, 1);
  assert.equal(watch.predicting, false);
});

test('first snapshot seeds enemy exactly at authoritative server coordinates', () => {
  const first = reconcileSnapshot([], [{ id: 11, kind: 'drifter', x: 250, y: 300, r: 10, hp: 22, maxHp: 22 }], { radiusScale: 1 / .78, now: 10 });
  assert.equal(first.length, 1);
  assert.equal(first[0].x, 250); assert.equal(first[0].y, 300);
  assert.equal(first[0].interpTargetX, 250); assert.equal(first[0].interpTargetY, 300);
  assert.equal(first[0].interpDuration, 0);
  assert.equal(first[0].authoritativePosition, true);
});

test('new server coordinates are smoothly interpolated instead of being left at a divergent client prediction', () => {
  const first = reconcileSnapshot([], [{ id: 11, kind: 'drifter', x: 250, y: 300, r: 10, hp: 22, maxHp: 22 }], { radiusScale: 1 / .78, now: 10 });
  const second = reconcileSnapshot(first, [{ id: 11, kind: 'drifter', x: 450, y: 500, r: 10, hp: 8, maxHp: 22 }], { radiusScale: 1 / .78, now: 110, interpolationMs: 100 });
  assert.equal(second[0].x, 250); assert.equal(second[0].y, 300, 'interpolation starts from last displayed position');
  assert.equal(second[0].interpTargetX, 450); assert.equal(second[0].interpTargetY, 500);
  assert.equal(second[0].hp, 8);
  const responsive = renderedPosition(second[0], 166);
  assert.ok(responsive.x > 400 && responsive.y > 400, 'short interpolation closes most of the visual gap within one frame window');
  const arrived = renderedPosition(second[0], 232);
  assert.ok(arrived.x >= 450 && arrived.x <= 470);
  assert.ok(arrived.y >= 500 && arrived.y <= 520, 'bounded prediction follows the last server velocity after interpolation');
});

test('repeated snapshots converge to the latest authoritative position without a ghost hit position', () => {
  let state = reconcileSnapshot([], [{ id: 25, kind: 'drifter', x: 260, y: 320, r: 10, hp: 22, maxHp: 22 }], { now: 0 });
  state = reconcileSnapshot(state, [{ id: 25, kind: 'drifter', x: 360, y: 320, r: 10, hp: 22, maxHp: 22 }], { now: 100, interpolationMs: 100 });
  const midway = renderedPosition(state[0], 156);
  assert.ok(midway.x > 340 && midway.x < 360, 'short interpolation approaches the newest authoritative sample quickly');
  const next = reconcileSnapshot([{...state[0],x:midway.x,y:midway.y}], [{ id: 25, kind: 'drifter', x: 420, y: 320, r: 10, hp: 22, maxHp: 22 }], { now: 156, interpolationMs: 100 });
  assert.equal(next[0].interpFromX, midway.x);
  assert.equal(next[0].interpTargetX, 420);
  assert.ok(renderedPosition(next[0], 256).x >= 420 && renderedPosition(next[0], 256).x < 440);
});

test('a delayed older snapshot cannot restore HP after a confirmed server hit', () => {
  const damaged = [{ id: 81, kind: 'drifter', x: 420, y: 530, r: 10, hp: 12, maxHp: 22, damageRevision: 2, interpFromX: 420, interpFromY:530, interpTargetX:420,interpTargetY:530,interpAt:10,interpDuration:0 }];
  const delayed = reconcileSnapshot(damaged, [{ id: 81, kind: 'drifter', x: 250, y: 300, r: 10, hp: 22, maxHp: 22, damageRevision: 1 }], { radiusScale: 1 / .78, now: 20 });
  assert.equal(delayed[0].hp, 12);
  assert.equal(delayed[0].damageRevision, 2);
  const fresh = reconcileSnapshot(delayed, [{ id: 81, kind: 'drifter', x: 240, y: 290, r: 10, hp: 7, maxHp: 22, damageRevision: 3 }], { radiusScale: 1 / .78, now: 30 });
  assert.equal(fresh[0].hp, 7);
  assert.equal(fresh[0].damageRevision, 3);
});


test('critical attacker snapshot snaps the real entity to server coordinates before contact feedback', () => {
  const old = reconcileSnapshot([], [{ id: 7, kind: 'drifter', x: 100, y: 100, r: 10, hp: 22, maxHp: 22 }], { now: 0 });
  const hit = reconcileSnapshot(old, [{ id: 7, kind: 'drifter', x: 210, y: 215, r: 10, hp: 22, maxHp: 22 }], {
    now: 50, interpolationMs: 100, criticalIds: ['7']
  });
  assert.equal(hit[0].x, 210);
  assert.equal(hit[0].y, 215);
  assert.equal(hit[0].interpDuration, 0);
});

test('movement extrapolation bridges the reliable snapshot baseline without freezing sprites', () => {
  const state = reconcileSnapshot([], [{ id: 99, kind: 'drifter', x: 100, y: 100, r: 10, hp: 22, maxHp: 22, vx: 80, vy: 0 }], { now: 0 });
  const next = reconcileSnapshot(state, [{ id: 99, kind: 'drifter', x: 108, y: 100, r: 10, hp: 22, maxHp: 22, vx: 80, vy: 0 }], { now: 100, interpolationMs: 100 });
  const held = renderedPosition(next[0], 800);
  assert.ok(held.x > 108, 'enemy continues briefly along its last authoritative velocity');
  assert.equal(held.x, 117.6, 'extrapolation stays bounded during a delayed mobile packet window');
  assert.equal(require('../public/enemy-netcode.js').MAX_EXTRAPOLATION_MS, 120);
});


test('compact snapshots derive enemy velocity and keep motion through a high-latency gap', () => {
  let state = reconcileSnapshot([], [{ id: 100, kind: 'drifter', x: 100, y: 100, r: 10, hp: 22, maxHp: 22 }], { now: 0 });
  state = reconcileSnapshot(state, [{ id: 100, kind: 'drifter', x: 110, y: 100, r: 10, hp: 22, maxHp: 22 }], { now: 100, interpolationMs: 100 });
  assert.equal(state[0].vx, 100, 'velocity is estimated from consecutive server positions');
  assert.ok(renderedPosition(state[0], 600).x > 110, 'a delayed packet briefly continues the last authoritative motion');
  assert.ok(renderedPosition(state[0], 900).x <= 155, 'prediction remains bounded against stale server state');
});


test('adaptive enemy interpolation stays below one authoritative motion interval', () => {
  let state = reconcileSnapshot([], [{ id: 301, kind: 'drifter', x: 100, y: 100, r: 10, hp: 22, maxHp: 22 }], { now: 0, interpolationMs: 72 });
  state = reconcileSnapshot(state, [{ id: 301, kind: 'drifter', x: 120, y: 100, r: 10, hp: 22, maxHp: 22 }], { now: 125, interpolationMs: 72 });
  assert.ok(state[0].interpDuration <= 90);
  assert.ok(state[0].interpDuration < 125, 'visual interpolation must not deliberately lag a full 8 Hz packet interval');
});


test('timestamped motion buffer renders between authoritative samples instead of packet arrival edges', () => {
  const enemy={id:501,kind:'drifter',x:100,y:100,motionSamples:[]};
  pushMotionSample(enemy,{x:100,y:100,serverTime:1000,receivedAt:0});
  pushMotionSample(enemy,{x:110,y:100,serverTime:1050,receivedAt:58});
  pushMotionSample(enemy,{x:120,y:100,serverTime:1100,receivedAt:101});
  const buffered=renderedPosition(enemy,140);
  assert.ok(buffered.x>108&&buffered.x<120,'render point stays inside buffered authoritative history');
  assert.ok(enemy.motionBufferMs>=70&&enemy.motionBufferMs<=125);
});

test('jitter never rewinds the presentation clock on steady vertical motion',()=>{
 const enemy={id:1,x:100,y:100,motionSamples:[]};
 pushMotionSample(enemy,{x:100,y:100,serverTime:1000,receivedAt:0});
 pushMotionSample(enemy,{x:100,y:110,serverTime:1050,receivedAt:50});
 pushMotionSample(enemy,{x:100,y:120,serverTime:1100,receivedAt:100});
 const before=renderedPosition(enemy,160);
 pushMotionSample(enemy,{x:100,y:130,serverTime:1150,receivedAt:161});
 assert.ok(renderedPosition(enemy,161).y>=before.y);
 const recovered=reconcileSnapshot([enemy],[{id:1,x:100,y:140,r:10,hp:10}],{now:220,serverTime:1200});
 assert.equal(recovered[0].motionSamples.at(-1).serverTime,1200);
});


test('irregular packet arrivals do not repeatedly reverse the creature presentation clock',()=>{
 const e={id:88,x:100,y:100,motionSamples:[]};
 const arrivals=[0,50,145,155,201,300,310,350,450,460,500,550,600];
 let packet=0,previous=100;
 for(let now=0;now<=620;now+=5){while(packet<arrivals.length&&arrivals[packet]<=now){pushMotionSample(e,{x:100,y:100+packet*8,serverTime:1000+packet*50,receivedAt:arrivals[packet]});packet++;}const p=renderedPosition(e,now);assert.ok(p.y>=previous-1e-6,`rewind at ${now}: ${p.y} < ${previous}`);previous=p.y;}
 assert.ok(previous>150);
});

test('motion cadence preserves sub-tick remainder instead of skipping alternate packets',()=>{
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../world-simulation.js'),'utf8');
 const body=source.slice(source.indexOf('  world.snapshotTimer -= dt;'),source.indexOf('  // Full-world recovery snapshots'));
 const step=new Function('world','dt',body+';return sendSnapshot;');
 const world={snapshotTimer:0,reliableSnapshotTimer:30,playerSnapshotTimer:1};let count=0;
 for(let i=0;i<100;i++)if(step(world,.049))count++;
 assert.ok(count>=97&&count<=100,`expected about 98 packets, got ${count}`);
});

test('late stop packet corrects extrapolation without a visible position jump',()=>{
 const e={id:99,x:100,y:100,motionSamples:[]};
 pushMotionSample(e,{x:100,y:100,serverTime:1000,receivedAt:0});
 pushMotionSample(e,{x:100,y:110,serverTime:1050,receivedAt:50});
 const before=renderedPosition(e,250);assert.ok(before.y>110);
 pushMotionSample(e,{x:100,y:110,serverTime:1250,receivedAt:250});
 const at=renderedPosition(e,250);assert.ok(Math.abs(at.y-before.y)<.001,'packet boundary is continuous');
 const halfway=renderedPosition(e,300);assert.ok(halfway.y<at.y&&halfway.y>=110);
 const settled=renderedPosition(e,351);assert.ok(Math.abs(settled.y-110)<.001);
});
