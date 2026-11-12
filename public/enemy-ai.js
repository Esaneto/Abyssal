/* Shared Abyssal enemy rules used by solo rendering and the authoritative co-op server.
 * All movement coordinates are WORLD UNITS (4800 x 3000), never viewport pixels or normalized values.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AbyssalEnemyAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const WORLD_WIDTH = 4800;
  const WORLD_HEIGHT = 3000;
  const WORLD_ZOOM = 0.78;
  // Bosses ordered from the lowest base HP to the highest.
  const CLASSIC_BOSS_KINDS = Object.freeze(['boss', 'angler', 'maw', 'leviathan', 'whiteSharkBoss', 'kraken', 'devourer']);
  const BOSS_KINDS = Object.freeze([...CLASSIC_BOSS_KINDS, 'riftSmile']);
  const SHARK_VISION = Object.freeze({ range: 900 / WORLD_ZOOM, halfAngle: 0.275, memoryMs: 1100 });
  function angleDelta(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
  const isChargeAttack=enemy=>enemy?.kind==='whiteShark'||enemy?.kind==='whiteSharkBoss';
  function biteDistance(enemyRadius,playerRadius){return Math.max(1,Number(enemyRadius)||1)+Math.max(1,Number(playerRadius)||1)+24/WORLD_ZOOM;}
  function biteReach(enemyRadius,playerRadius){return biteDistance(enemyRadius,playerRadius)+10/WORLD_ZOOM;}

  function sharkVisionState(enemy,target,now=Date.now()){
    if(!enemy||!target)return {visible:false,distance:Infinity,delta:Math.PI,range:SHARK_VISION.range,halfAngle:SHARK_VISION.halfAngle};
    const dx=Number(target.x)-Number(enemy.x),dy=Number(target.y)-Number(enemy.y),distance=Math.hypot(dx,dy);
    const targetAngle=Math.atan2(dy,dx),heading=Number.isFinite(Number(enemy.angle))?Number(enemy.angle):targetAngle;
    const delta=Math.abs(angleDelta(targetAngle,heading));
    const visible=distance<=SHARK_VISION.range&&delta<=SHARK_VISION.halfAngle;
    if(visible){enemy.sharkAlertUntil=Number(now)+SHARK_VISION.memoryMs;enemy.sharkLastTargetAngle=targetAngle;}
    return {visible,distance,delta,range:SHARK_VISION.range,halfAngle:SHARK_VISION.halfAngle,targetAngle};
  }
  const ENEMY_STATS = Object.freeze({
    drifter: Object.freeze({ r: 10, hp: 22, speed: 51, damage: 8, color: '#ff769d', value: 1 }),
    stinger: Object.freeze({ r: 7, hp: 15, speed: 125, damage: 7, color: '#ffbc78', value: 2 }),
    brute: Object.freeze({ r: 16, hp: 65, speed: 30, damage: 15, color: '#bd88ff', value: 4 }),
    lurker: Object.freeze({ r: 20, hp: 115, speed: 45, damage: 19, color: '#6e8dff', value: 6 }),
    whiteShark: Object.freeze({ r: 24, hp: 2400, speed: 300, damage: 30, dashSpeed: 300, color: '#91c4ce', value: 24 }),
    boss: Object.freeze({ r: 40, hp: 5640, speed: 52, damage: 25, color: '#338cff', value: 55 }),
    angler: Object.freeze({ r: 35, hp: 6520, speed: 66, damage: 28, color: '#ffb45e', value: 65 }),
    maw: Object.freeze({ r: 45, hp: 7500, speed: 58, damage: 31, color: '#c16cff', value: 75 }),
    leviathan: Object.freeze({ r: 54, hp: 9400, speed: 44, damage: 34, color: '#4ce0d1', value: 90 }),
    whiteSharkBoss: Object.freeze({ r: 62, hp: 13200, speed: 400, damage: 47, dashSpeed: 400, color: '#68a8b8', value: 140 }),
    kraken: Object.freeze({ r: 80, hp: 18400, speed: 20, damage: 38, color: '#8b5cf6', value: 180 }),
    devourer: Object.freeze({ r: 78, hp: 30000, speed: 14, damage: 42, color: '#39d8c4', value: 260 }),
    riftSmile: Object.freeze({ r: 154, hp: 52000, speed: 0, damage: 0, color: '#b76cff', value: 700 })
  });

  // Radius in screen-logical pixels. Both solo and online convert it once into world units.
  // Higher XP values (especially bosses) create visibly larger resonance orbs.
  function xpOrbRadius(value) {
    const amount = Math.max(1, Number(value) || 1);
    return clamp(3.4 + Math.sqrt(amount) * 1.35, 4.5, 15.5);
  }

  function statsForKind(kind) {
    const stats = ENEMY_STATS[kind] || ENEMY_STATS.drifter;
    return { ...stats };
  }

  function chooseCommonKind(random = Math.random) {
    const roll = random();
    return roll < 0.45 ? 'drifter' : roll < 0.68 ? 'stinger' : roll < 0.85 ? 'brute' : roll < 0.94 ? 'lurker' : 'whiteShark';
  }

  function chooseBossKind(activeKinds = [], random = Math.random, spawnIndex = 0) {
    const active = new Set(activeKinds);
    if (active.size >= CLASSIC_BOSS_KINDS.length) return null;
    const start = Math.max(0, Math.floor(Number(spawnIndex) || 0)) % CLASSIC_BOSS_KINDS.length;
    for (let offset = 0; offset < CLASSIC_BOSS_KINDS.length; offset++) {
      const kind = CLASSIC_BOSS_KINDS[(start + offset) % CLASSIC_BOSS_KINDS.length];
      if (!active.has(kind)) return kind;
    }
    return null;
  }

  function chooseSpawnPoint(random = Math.random, cornerOverride = null, width = WORLD_WIDTH, height = WORLD_HEIGHT) {
    const corner = Number.isInteger(cornerOverride) ? ((cornerOverride % 4) + 4) % 4 : Math.floor(random() * 4);
    const insetX = 100 + random() * 190;
    const insetY = 90 + random() * 160;
    const left = corner === 0 || corner === 2;
    const top = corner === 0 || corner === 1;
    return {
      x: clamp(left ? insetX : width - insetX, 70 / WORLD_ZOOM, width - 70 / WORLD_ZOOM),
      y: clamp(top ? insetY : height - insetY, 70 / WORLD_ZOOM, height - 70 / WORLD_ZOOM),
      corner
    };
  }

  // Eight deterministic, animated arms shared by the renderer and collision code.
  // Coordinates are relative to the body's radius; the base is thick and each tip tapers.
  function krakenTentaclePose(index, phase = 0) {
    const i = ((Math.floor(Number(index) || 0) % 8) + 8) % 8;
    const angle = -Math.PI / 2 + i * (Math.PI * 2 / 8);
    const sway = Math.sin((Number(phase) || 0) * 0.88 + i * 1.73);
    const length = 4.35 + 0.42 * Math.sin((Number(phase) || 0) * 0.55 + i * 0.91);
    const sx = Math.cos(angle) * 0.44;
    const sy = 0.25 + Math.sin(angle) * 0.21;
    return {
      sx, sy,
      c1x: sx + Math.cos(angle - 0.42) * 0.92,
      c1y: sy + Math.sin(angle - 0.42) * 1.02,
      c2x: Math.cos(angle + sway * 0.28) * (length * 0.64),
      c2y: 0.25 + Math.sin(angle + sway * 0.28) * (length * 0.63),
      ex: Math.cos(angle + sway * 0.16) * length,
      ey: 0.20 + Math.sin(angle + sway * 0.16) * (length * 0.98)
    };
  }

  function pointSegmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 1e-9) return Math.hypot(px - ax, py - ay);
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  // Shared suction geometry for the solo client and authoritative co-op simulation.
  // The doubled field has a near-irresistible outer pull; quadratic falloff weakens it smoothly near the mouth.
  function suctionPullDelta(target, boss, dt, options = {}) {
    if (!target || !boss || !Number.isFinite(dt) || dt <= 0 || boss.suctionActive !== true) {
      return { dx: 0, dy: 0, strength: 0 };
    }
    const dx = Number(boss.x) - Number(target.x), dy = Number(boss.y) - Number(target.y);
    const distance = Math.hypot(dx, dy);
    const range = Math.max(1, Number(options.range) || 1240 / WORLD_ZOOM);
    const safeRadius = clamp(Number(options.safeRadius) || 155 / WORLD_ZOOM, 0, range - 1);
    if (!Number.isFinite(distance) || distance <= safeRadius || distance >= range) {
      return { dx: 0, dy: 0, strength: 0 };
    }
    const linearStrength = clamp((distance - safeRadius) / (range - safeRadius), 0, 1);
    const strength = linearStrength * linearStrength;
    const maxSpeed = Math.max(0, Number(options.maxSpeed) || 520 / WORLD_ZOOM);
    const step = Math.min(distance - safeRadius, maxSpeed * strength * dt);
    if (step <= 0) return { dx: 0, dy: 0, strength };
    return { dx: dx / distance * step, dy: dy / distance * step, strength };
  }

  /** True when a player overlaps an animated kraken arm, not only its central body. */
  function touchesKrakenTentacle(enemy, target, enemyRadiusScale = 1) {
    if (!enemy || enemy.kind !== 'kraken' || !target) return false;
    const radius = Math.max(1, Number(enemy.r) || 80) * Math.max(0.001, Number(enemyRadiusScale) || 1);
    const px = Number(target.x), py = Number(target.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
    const targetRadius = Math.max(1, Number(target.r) || 13 / WORLD_ZOOM);
    const margin = 8 / WORLD_ZOOM;
    const facing = Number(enemy.angle) || 0, cs = Math.cos(facing), sn = Math.sin(facing);
    const phase = Number(enemy.phase) || 0;
    for (let arm = 0; arm < 8; arm++) {
      const p = krakenTentaclePose(arm, phase);
      let prevX = Number(enemy.x) + (p.sx * cs - p.sy * sn) * radius;
      let prevY = Number(enemy.y) + (p.sx * sn + p.sy * cs) * radius;
      for (let step = 1; step <= 12; step++) {
        const t = step / 12, mt = 1 - t;
        const nx = mt*mt*mt*p.sx + 3*mt*mt*t*p.c1x + 3*mt*t*t*p.c2x + t*t*t*p.ex;
        const ny = mt*mt*mt*p.sy + 3*mt*mt*t*p.c1y + 3*mt*t*t*p.c2y + t*t*t*p.ey;
        const x = Number(enemy.x) + (nx * cs - ny * sn) * radius;
        const y = Number(enemy.y) + (nx * sn + ny * cs) * radius;
        const armRadius = radius * (0.125 * (1 - (t - 1 / 24)) + 0.035);
        if (pointSegmentDistance(px, py, prevX, prevY, x, y) <= targetRadius + armRadius + margin) return true;
        prevX = x; prevY = y;
      }
    }
    return false;
  }

  /** Move one enemy toward the nearest target. x, y, speed and target coordinates all use world units. */
  function moveTowardTarget(enemy, targets, dt, options = {}, reusableResult = null) {
    // A static final guardian whose movement is exclusively its tentacle attacks.
    if(enemy?.kind==='riftSmile'){const result=reusableResult||{};result.moved=false;result.target=null;result.distance=Infinity;result.dx=0;result.dy=0;return result;}
    // Hot path: the server and solo client pass one reusable result object per frame/tick.
    // External callers may omit it and receive a fresh object as before.
    const result = reusableResult || {};
    if (!enemy || !Array.isArray(targets) || !targets.length || !Number.isFinite(dt) || dt <= 0) {
      result.moved = false; result.target = null; result.distance = Infinity; result.dx = 0; result.dy = 0;
      return result;
    }
    let target = null, dx = 0, dy = 0, distance = Infinity;
    for (const candidate of targets) {
      const x = Number(candidate?.x), y = Number(candidate?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const cx = x - Number(enemy.x), cy = y - Number(enemy.y), d = Math.hypot(cx, cy);
      if (d < distance) { distance = d; dx = cx; dy = cy; target = candidate; }
    }
    if (!target || !Number.isFinite(distance)) {
      result.moved = false; result.target = null; result.distance = Infinity; result.dx = 0; result.dy = 0;
      return result;
    }

    // Paralisia de impacto (ex: Enguia Elétrica - 0.1s de interrupção motora)
    // O servidor usa timestamps Unix (Date.now), enquanto o cliente pode usar performance.now.
    // Use o mesmo relógio da marca de paralisia para evitar que ela se torne permanente.
    const paralysisUntil = Number(enemy.paralyzedUntil) || 0;
    const currentTime = paralysisUntil > 100000000000 ? Date.now() : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (paralysisUntil && currentTime < paralysisUntil) {
      result.moved = false; result.target = target; result.distance = distance; result.dx = 0; result.dy = 0;
      return result;
    }

    // Movimentação especial de investida para tubarões (whiteShark e whiteSharkBoss):
    // Move-se APENAS por investidas em linha reta que só param ao colidir com o fim do mapa.
    // Ao bater na parede, vira imediatamente na direção do jogador mais próximo e investe novamente.
    const isShark = isChargeAttack(enemy) && options.freeSwim !== true;
    if (isShark) {
      const minX = Number.isFinite(options.minX) ? options.minX : 0;
      const maxX = Number.isFinite(options.maxX) ? options.maxX : WORLD_WIDTH;
      const minY = Number.isFinite(options.minY) ? options.minY : 0;
      const maxY = Number.isFinite(options.maxY) ? options.maxY : WORLD_HEIGHT;
      const stats = ENEMY_STATS[enemy.kind] || ENEMY_STATS.whiteShark;
      const dashSpeed = stats.dashSpeed || 290;
      const vision=sharkVisionState(enemy,target,currentTime);
      if(options.sharkLineOfSight===false){vision.visible=false;enemy.sharkAlertUntil=0;}
      // Commit to a single straight pass beyond the prey; never home in during the strike.
      let hunting=Boolean(enemy.sharkChargeRemaining>0);
      if(!hunting&&vision.visible&&!(enemy.sharkRecoveryRemaining>0)){
        const aim=vision.targetAngle;
        enemy.sharkChargeRemaining=Math.max(220/WORLD_ZOOM,distance+Math.max(140/WORLD_ZOOM,(Number(enemy.r)||24)*3));
        enemy.dashVx=Math.cos(aim)*dashSpeed;enemy.dashVy=Math.sin(aim)*dashSpeed;enemy.sharkChargeHit=false;hunting=true;
      }
      if(hunting){
        enemy.sharkChargeRemaining=Math.max(0,enemy.sharkChargeRemaining-dashSpeed*dt);
        enemy.angle=Math.atan2(enemy.dashVy,enemy.dashVx);
        if(enemy.sharkChargeRemaining<=0)enemy.sharkRecoveryRemaining=1.5;
      }else{
        enemy.sharkRecoveryRemaining=Math.max(0,(Number(enemy.sharkRecoveryRemaining)||0)-dt);
        enemy.sharkScanPhase=(Number(enemy.sharkScanPhase)||0)+dt*.55;
        const previous=Number(enemy.angle)||0,steer=Number(options.sharkSteeringAngle),turn=Number.isFinite(steer)?Math.atan2(Math.sin(steer-previous),Math.cos(steer-previous)):0;
        const heading=Number.isFinite(steer)?previous+clamp(turn,-2.9*dt,2.9*dt):previous+Math.sin(enemy.sharkScanPhase+(Number(enemy.id)||0))*.42*dt;
        enemy.angle=heading;const cruise=dashSpeed*.42;
        enemy.dashVx=Math.cos(heading)*cruise;enemy.dashVy=Math.sin(heading)*cruise;
      }
      enemy.sharkCharging=hunting;
      let nx=(Number(enemy.x)||0)+(Number(enemy.dashVx)||0)*dt;
      let ny=(Number(enemy.y)||0)+(Number(enemy.dashVy)||0)*dt;
      const hitWall=nx<=minX+2||nx>=maxX-2||ny<=minY+2||ny>=maxY-2;
      if(hitWall){
        enemy.sharkChargeRemaining=0;enemy.sharkCharging=false;enemy.sharkRecoveryRemaining=1.2;hunting=false;
        const turn=(Number(enemy.angle)||0)+Math.PI*(.62+((Number(enemy.id)||1)%5)*.07);
        enemy.angle=turn;const speedNow=hunting?dashSpeed:dashSpeed*.42;
        enemy.dashVx=Math.cos(turn)*speedNow;enemy.dashVy=Math.sin(turn)*speedNow;
        nx=(Number(enemy.x)||0)+enemy.dashVx*dt;ny=(Number(enemy.y)||0)+enemy.dashVy*dt;
      }
      nx=clamp(nx,minX,maxX);ny=clamp(ny,minY,maxY);
      enemy.x=nx;enemy.y=ny;enemy.vx=enemy.dashVx;enemy.vy=enemy.dashVy;
      enemy.phase=(Number(enemy.phase)||0)+dt*6;enemy.sharkVisionVisible=vision.visible;
      result.moved=true;result.target=target;result.distance=distance;result.dx=dx;result.dy=dy;return result;
    }

    enemy.angle = Math.atan2(dy, dx);
    enemy.phase = (Number(enemy.phase) || 0) + dt * (enemy.kind === 'stinger' ? 7 : enemy.kind === 'kraken' ? 0.42 : 3);
    const baseSpeed = Math.max(0, Number(enemy.speed) || 0);
    let pursuitSpeed = baseSpeed;
    if (BOSS_KINDS.includes(enemy.kind)) {
      const maxHp = Math.max(1, Number(enemy.maxHp) || Number(enemy.hp) || 1);
      const healthRatio = clamp((Number(enemy.hp) || 0) / maxHp, 0, 1);
      const playerSpeed = Math.max(1, Number(target.moveSpeed) || 150 / WORLD_ZOOM);
      const slowSpeed = Math.min(baseSpeed, playerSpeed * 0.25);
      const fastSpeed = playerSpeed * 0.79;
      pursuitSpeed = slowSpeed + (fastSpeed - slowSpeed) * (1 - healthRatio);
      pursuitSpeed = Math.min(pursuitSpeed, playerSpeed * 0.79);
    }
    const reducedPursuitSpeed = pursuitSpeed * 0.85;
    const speed = reducedPursuitSpeed * ((Number(enemy.skinSlowedUntil)||0)>Date.now() ? 0.62 : 1);
    const stopDistance = Math.max(0, Number(options.stopDistance) || 0);
    const oldX = Number(enemy.x) || 0, oldY = Number(enemy.y) || 0;
    // When no contact/orbit radius was requested, exact overlap must remain stationary.
    // This also prevents zero-distance NaN/oscillation in the solo and server AI.
    if (distance < 0.001 && stopDistance <= 0) {
      enemy.vx = 0; enemy.vy = 0;
      result.moved = false; result.target = target; result.distance = distance; result.dx = 0; result.dy = 0;
      return result;
    }
    let x = oldX, y = oldY;
    if (speed > 0 && distance > stopDistance + 0.5) {
      const desiredVx = (dx / (distance || 1)) * speed;
      const desiredVy = (dy / (distance || 1)) * speed;
      // Exponential steering smooths direction changes and remains frame-rate independent.
      // This shared integrator is used by solo and authoritative online simulation.
      const response = 1 - Math.exp(-Math.min(dt, 0.1) * 8.6);
      let velocityX = (Number(enemy.vx) || 0) + (desiredVx - (Number(enemy.vx) || 0)) * response;
      let velocityY = (Number(enemy.vy) || 0) + (desiredVy - (Number(enemy.vy) || 0)) * response;
      const velocityMagnitude = Math.hypot(velocityX, velocityY);
      if (velocityMagnitude > speed && speed > 0) { velocityX *= speed / velocityMagnitude; velocityY *= speed / velocityMagnitude; }
      const stepX = velocityX * dt, stepY = velocityY * dt;
      const projected = Math.hypot(stepX, stepY);
      const step = Math.min(distance - stopDistance, projected);
      if (projected > 1e-8) { x += stepX / projected * step; y += stepY / projected * step; }
      enemy.vx = velocityX; enemy.vy = velocityY;
    } else if (speed > 0 && stopDistance > 0) {
      const id = Math.abs(Math.floor(Number(enemy.id) || 1));
      const lane = id % 6;
      const orbitRadius = stopDistance * (1 + lane * 0.025);
      let theta = Math.atan2(oldY - Number(target.y), oldX - Number(target.x));
      if (!Number.isFinite(theta) || distance < 0.001) theta = (Number(enemy.angle) || 0) + Math.PI;
      let direction = Number(enemy.orbitDirection);
      if (!direction) direction = (id % 2) ? 1 : -1;
      enemy.orbitDirection = direction;
      const angularSpeed = clamp((speed * 0.62) / Math.max(orbitRadius, 12), 0.35, 1.8);
      theta += direction * angularSpeed * dt;
      const desiredX = Number(target.x) + Math.cos(theta) * orbitRadius;
      const desiredY = Number(target.y) + Math.sin(theta) * orbitRadius;
      const ox = desiredX - oldX, oy = desiredY - oldY, od = Math.hypot(ox, oy);
      const orbitStep = Math.min(od, speed * dt);
      if (od > 1e-8) { x += ox / od * orbitStep; y += oy / od * orbitStep; }
      enemy.angle = Math.atan2(Number(target.y) - y, Number(target.x) - x);
    }
    const minX = Number.isFinite(options.minX) ? options.minX : 0;
    const maxX = Number.isFinite(options.maxX) ? options.maxX : WORLD_WIDTH;
    const minY = Number.isFinite(options.minY) ? options.minY : 0;
    const maxY = Number.isFinite(options.maxY) ? options.maxY : WORLD_HEIGHT;
    x = clamp(x, minX, maxX);
    y = clamp(y, minY, maxY);
    if (speed > 0 && Math.hypot(x - oldX, y - oldY) < 0.05) {
      const id = Math.abs(Math.floor(Number(enemy.id) || 1));
      const radial = Math.atan2(oldY - Number(target.y), oldX - Number(target.x));
      const direction = (id % 2) ? 1 : -1;
      const step = Math.max(0.25, Math.min(speed * dt, 5));
      const firstAngle = radial + direction * Math.PI / 2;
      const secondAngle = Math.atan2(dy, dx);
      let nx = clamp(oldX + Math.cos(firstAngle) * step, minX, maxX);
      let ny = clamp(oldY + Math.sin(firstAngle) * step, minY, maxY);
      if (Math.hypot(nx - oldX, ny - oldY) < 0.05) {
        nx = clamp(oldX + Math.cos(secondAngle) * step, minX, maxX);
        ny = clamp(oldY + Math.sin(secondAngle) * step, minY, maxY);
      }
      if (Math.hypot(nx - oldX, ny - oldY) >= 0.05) { x = nx; y = ny; }
    }
    enemy.x = x; enemy.y = y;
    enemy.vx = (x - oldX) / Math.max(dt, 0.001);
    enemy.vy = (y - oldY) / Math.max(dt, 0.001);
    result.moved = Math.abs(x - oldX) > 1e-8 || Math.abs(y - oldY) > 1e-8;
    result.target = target; result.distance = distance; result.dx = dx; result.dy = dy;
    return result;
  }
  function chooseBossesForSession(playerCount = 1) {
    const count = clamp(Math.floor(Number(playerCount) || 1), 1, 6);
    const bossCount = count <= 2 ? 1 : count <= 4 ? 2 : 3;
    const sortedBosses = [...BOSS_KINDS].sort((a, b) => (ENEMY_STATS[a]?.hp || 0) - (ENEMY_STATS[b]?.hp || 0));
    return sortedBosses.slice(0, bossCount);
  }

  function createWhiteShark() {
    return { ...ENEMY_STATS.whiteShark };
  }

  function createWhiteSharkBoss() {
    return { ...ENEMY_STATS.whiteSharkBoss };
  }

  return { WORLD_WIDTH, WORLD_HEIGHT, WORLD_ZOOM, BOSS_KINDS, ENEMY_STATS, SHARK_VISION, sharkVisionState, isChargeAttack, biteDistance, biteReach, statsForKind, xpOrbRadius, chooseCommonKind, chooseBossKind, chooseBossesForSession, createWhiteShark, createWhiteSharkBoss, chooseSpawnPoint, krakenTentaclePose, touchesKrakenTentacle, suctionPullDelta, moveTowardTarget };
});
