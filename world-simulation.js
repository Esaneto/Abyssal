'use strict';
const EnemyAI = require('./public/enemy-ai.js');
const SkinAbilities = require('./skin-abilities');
const ExpeditionRules = require('./public/abyssal-expedition-rules.js');
const AbyssalMap = require('./public/abyssal-map.js');
const RiftHardcore = require('./public/abyssal-rift-hardcore.js');
const { WORLD_WIDTH, WORLD_HEIGHT, WORLD_ZOOM, BOSS_KINDS } = EnemyAI;
const MAX_ENEMIES = 400;
const MAX_BOSSES = 4;
const MAX_COMMON_ENEMIES = MAX_ENEMIES - MAX_BOSSES;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function anglerInvisibleAt(nowMs=Date.now()){
  const phase=((Number(nowMs)||0)%26000+26000)%26000;
  return phase>=3000&&phase<13000;
}

function createWorldState(now = Date.now(), mode = 'classic') {
  return {
    mode: mode === 'rift' ? 'rift' : 'classic', riftEncountersSeeded: false, riftActivatedRooms: {},
    initialized: false, worldId: `${now}-${Math.random().toString(36).slice(2, 10)}`, snapshotSeq: 0, elapsed: 0, enemies: [], nextEnemyId: 0, orbs: [], nextOrbId: 0, xpOrbCollectedCount: 0,
    nextBossAt: 100 / 3.8, bossSpawnCount: 0, bossesDefeated: 0, lastBossKind: null,
    lastBossMaxHp: 0, lastBossDamage: 0, lastBossSpeed: 0, lastBossSpawnAt: 0,
    commonSpawnTimer: 0.45, lastTick: now, snapshotTimer: 0, reliableSnapshotTimer: 0,
    playerSnapshotTimer: 0, orbSnapshotTimer: 0, tickCount: 0, lastMovementAt: 0,
    movingEnemyCount: 0, movementRecoveryCount: 0, playerDamageCount: 0, playerDefeatCount: 0, stalePositionAttackSkips: 0,
    activeEventId: null, eventEndsAt: 0, eventSerial: 0,
    eliteRewardClaimedTier: -1, sideEncounterResolvedTier: -1, sideEncounterId: null, sideEncounterSerial: 0,
    mapSeed: AbyssalMap.seedValue(`${now}-${Math.random()}`), mapTier: 0
  };
}

function mapLayoutFor(world) {
  if (!world || world.mode !== 'rift') return null;
  const seed = Number(world.mapSeed) || AbyssalMap.seedValue(world.worldId || Date.now());
  const tier = Math.max(0, Math.floor(Number(world.mapTier) || 0));
  const key = seed + ':' + tier;
  if (world.__mapLayoutKey !== key || !world.__mapLayout) {
    Object.defineProperty(world, '__mapLayout', { value: AbyssalMap.createLayout(seed, tier), writable: true, configurable: true, enumerable: false });
    Object.defineProperty(world, '__mapLayoutKey', { value: key, writable: true, configurable: true, enumerable: false });
  }
  return world.__mapLayout;
}

function countBosses(world) { return world.enemies.filter(e => BOSS_KINDS.includes(e.kind)); }
function countBossCount(world) { let n = 0; for (const e of world.enemies) if (BOSS_KINDS.includes(e.kind)) n++; return n; }
function countCommons(world) { let count = 0; for (const enemy of world.enemies) if (!BOSS_KINDS.includes(enemy.kind)) count++; return count; }

function contactGeometry(enemy, target) {
  const enemyRadiusWorld = Math.max(1, Number(enemy?.r) || 10) / WORLD_ZOOM;
  // Player radius is stored in WORLD UNITS already (13 / WORLD_ZOOM).
  const playerRadiusWorld = Math.max(1, Number(target?.r) || (13 / WORLD_ZOOM));
  const paddingWorld = 8 / WORLD_ZOOM; // exactly the solo collision padding
  const dx = Number(target?.x) - Number(enemy?.x);
  const dy = Number(target?.y) - Number(enemy?.y);
  const geometry = {
    distance: Math.hypot(dx, dy),
    radius: enemyRadiusWorld + playerRadiusWorld + paddingWorld,
    enemyRadiusWorld, playerRadiusWorld, paddingWorld
  };
  if (enemy?.kind === 'kraken' && enemy.krakenSweepActive === true && EnemyAI.touchesKrakenTentacle?.(enemy, target, 1 / WORLD_ZOOM)) {
    return { ...geometry, distance: 0, tentacleContact: true };
  }
  return geometry;
}

function forceAdvanceEnemy(enemy, players, dt) {
  if (!enemy || !players.length || dt <= 0) return false;
  let target = null, nearest = Infinity;
  // tickWorld passes the pre-filtered targetable-player array; don't allocate a new
  // filtered array for every one of up to 400 enemies on every 50 ms server tick.
  for (const player of players) {
    const d = Math.hypot(Number(player.x) - Number(enemy.x), Number(player.y) - Number(enemy.y));
    if (Number.isFinite(d) && d < nearest) { nearest = d; target = player; }
  }
  if (!target) return false;
  const oldX = Number(enemy.x) || 0, oldY = Number(enemy.y) || 0;
  const baseSpeed = Math.max(20, Number(enemy.speed) || (EnemyAI.statsForKind(enemy.kind).speed / WORLD_ZOOM) || 35);
  const healthRatio = clamp((Number(enemy.hp) || 0) / Math.max(1, Number(enemy.maxHp) || Number(enemy.hp) || 1), 0, 1);
  const playerSpeed = Math.max(1, Number(target.moveSpeed) || 150 / WORLD_ZOOM);
  const ramp = clamp((1 - healthRatio) / 0.8, 0, 1);
  const speed = (BOSS_KINDS.includes(enemy.kind) ? Math.max(1, playerSpeed - 5) : baseSpeed) * 0.85;
  const stopDistance = Math.max(24, ((Number(enemy.r) || 10) + 13) / WORLD_ZOOM * 0.9);
  let x = oldX, y = oldY;
  if (nearest > stopDistance + 1) {
    const dx = Number(target.x) - oldX, dy = Number(target.y) - oldY;
    const step = Math.min(speed * dt, nearest - stopDistance);
    x += dx / (nearest || 1) * step; y += dy / (nearest || 1) * step;
  } else {
    const id = Math.abs(Math.floor(Number(enemy.id) || 1));
    const lane = id % 6;
    const radius = stopDistance * (0.78 + lane * 0.12);
    let angle = Math.atan2(oldY - Number(target.y), oldX - Number(target.x));
    if (!Number.isFinite(angle) || nearest < 0.001) angle = Number(enemy.orbitAngle) || ((id % 2) ? Math.PI : 0);
    const direction = Number(enemy.orbitDirection) || ((id % 2) ? 1 : -1);
    enemy.orbitDirection = direction;
    angle += direction * Math.max(0.025, Math.min(1.8, speed * 0.62 / Math.max(radius, 12))) * dt;
    enemy.orbitAngle = angle;
    const desiredX = Number(target.x) + Math.cos(angle) * radius;
    const desiredY = Number(target.y) + Math.sin(angle) * radius;
    const dx = desiredX - oldX, dy = desiredY - oldY, d = Math.hypot(dx, dy);
    const step = Math.min(d, speed * dt);
    if (d > 1e-8) { x += dx / d * step; y += dy / d * step; }
  }
  const margin = 8 / WORLD_ZOOM;
  x = clamp(x, margin, WORLD_WIDTH - margin); y = clamp(y, margin, WORLD_HEIGHT - margin);
  if (Math.hypot(x - oldX, y - oldY) < 0.05) {
    // Boundary-safe tangential nudge; never leave an active enemy frozen because its
    // desired orbit point happens to clamp back to its current coordinate.
    const id = Math.abs(Math.floor(Number(enemy.id) || 1));
    const dir = (id % 2) ? 1 : -1;
    const a = Math.atan2(oldY - Number(target.y), oldX - Number(target.x)) + dir * Math.PI / 2;
    const step = Math.max(0.3, Math.min(speed * dt, 5));
    x = clamp(oldX + Math.cos(a) * step, margin, WORLD_WIDTH - margin);
    y = clamp(oldY + Math.sin(a) * step, margin, WORLD_HEIGHT - margin);
  }
  enemy.x = x; enemy.y = y;
  enemy.vx = (x - oldX) / Math.max(dt, 0.001); enemy.vy = (y - oldY) / Math.max(dt, 0.001);
  return Math.hypot(x - oldX, y - oldY) >= 0.05;
}

function roomPopulation(world, roomId) {
  let count = 0;
  for (const enemy of world?.enemies || []) if (!BOSS_KINDS.includes(enemy.kind) && enemy.spawnRoomId === roomId) count++;
  return count;
}

function chooseDensitySpawnRoom(world, players, random = Math.random) {
  const layout = mapLayoutFor(world);
  if (!layout) return null;
  const upper = [], lower = [];
  for (const player of players || []) {
    const room = AbyssalMap.roomAt(layout, Number(player.x), Number(player.y));
    if (room && room.depth >= 7) lower.push(player); else upper.push(player);
  }
  const useLower = lower.length > 0 && (upper.length === 0 || random() < lower.length / Math.max(1, lower.length + upper.length));
  const allowedTypes = useLower ? new Set(['landing','boss']) : new Set(['common','event','hub']);
  const candidates = layout.rooms.filter(room => {
    if (!allowedTypes.has(room.type)) return false;
    const cap = ExpeditionRules.roomDensityCap(room, world.mapTier, world.roomPlayerCount || players?.length || 1);
    return cap > 0 && roomPopulation(world, room.id) < cap;
  });
  if (!candidates.length) return null;
  // Bias toward the same physical depth as the active group while keeping side chambers discoverable.
  const weighted = [];
  for (const room of candidates) {
    const population = roomPopulation(world, room.id);
    const cap = Math.max(1, ExpeditionRules.roomDensityCap(room, world.mapTier, world.roomPlayerCount || players?.length || 1));
    const openRatio = Math.max(.08, 1 - population / cap);
    const tickets = Math.max(1, Math.round(openRatio * (room.type === 'event' ? 3 : room.type === 'hub' ? 4 : 6)));
    for (let i = 0; i < tickets; i++) weighted.push(room);
  }
  return weighted[Math.floor(random() * weighted.length)]?.id || candidates[0].id;
}

function spawnEnemy(world, options = {}) {
  const { type = 'common', initial = false, random = Math.random } = options;
  if (!world || world.enemies.length >= MAX_ENEMIES) return null;
  const bosses = countBosses(world);
  if (type === 'boss' && bosses.length >= MAX_BOSSES) return null;
  if (type !== 'boss' && countCommons(world) >= MAX_COMMON_ENEMIES) return null;

  const layout = mapLayoutFor(world);
  let point = layout ? AbyssalMap.spawnPoint(layout, {
    type: type === 'boss' ? 'boss' : type,
    initial, random, bossesDefeated: world.bossesDefeated, roomId: options.roomId
  }) : EnemyAI.chooseSpawnPoint(random, initial ? world.nextEnemyId % 4 : null, WORLD_WIDTH, WORLD_HEIGHT);
  let ecologyRoom = layout?.rooms?.find(room => room.id === point.roomId) || null;

  let kind;
  if (options.kindOverride) {
    kind = options.kindOverride;
  } else if (type === 'boss') {
    kind = EnemyAI.chooseBossKind(bosses.map(e => e.kind), random, world.bossSpawnCount);
    if (!kind) return null;
  } else {
    kind = layout && ExpeditionRules.chooseCommonKindForRoom
      ? ExpeditionRules.chooseCommonKindForRoom(random, ecologyRoom, world.mapTier, world.activeEventId)
      : ExpeditionRules.chooseCommonKind(random, world.bossesDefeated, world.activeEventId);
    if (kind === 'whiteShark') {
      const whiteSharkCount = world.enemies.filter(e => e.kind === 'whiteShark').length;
      if (whiteSharkCount >= 10) kind = 'lurker';
    }
  }

  let stats = EnemyAI.statsForKind(kind);
  let eliteId = null;
  if (type !== 'boss' && !initial) {
    eliteId = layout ? null : ExpeditionRules.chooseElite(random, world.bossesDefeated, world.activeEventId, kind);
    if (options.forceElite && !eliteId) {
      const eliteIds = ['carapace','frenzy','spectral'];
      eliteId = eliteIds[Math.floor(random() * eliteIds.length)] || 'carapace';
    }
    if (eliteId) stats = ExpeditionRules.applyEliteStats(stats, eliteId);
  }
  if(type!=='boss'){
    const physicalScale=eliteId?1.18:1.07,speedScale=eliteId?1.08:1.03,hpScale=eliteId?1.12:1;
    stats={...stats,damage:Math.max(1,Math.round(Number(stats.damage||1)*physicalScale)),speed:Number(stats.speed||0)*speedScale,hp:Math.max(1,Math.round(Number(stats.hp||1)*hpScale))};
  }
  if (type === 'boss') {
    const completedCycles = Math.floor(Math.max(0, Number(world.bossesDefeated) || 0) / 7);
    stats.hp = Math.round(stats.hp * (1 + completedCycles * 0.20));
    world.lastBossMaxHp = stats.hp;
    world.lastBossSpawnAt = Date.now();
    world.lastBossDamage = stats.damage;
    world.lastBossSpeed = stats.speed;
    world.bossSpawnCount++;
    world.lastBossKind = kind;
  }

  // Random elite mutations belong to the optional elite chamber. Explicit room encounters
  // keep their elites inside that room so a side-branch trap cannot leak into the main path.
  if (layout && eliteId && !options.roomId && type !== 'elite') {
    point = AbyssalMap.spawnPoint(layout, { type: 'elite', random, bossesDefeated: world.bossesDefeated });
    ecologyRoom = layout?.rooms?.find(room => room.id === point.roomId) || ecologyRoom;
  }
  const rewardMultiplier = type === 'boss' ? 1 : (ExpeditionRules.roomRewardMultiplier?.(ecologyRoom, world.mapTier) || 1);
  stats.value = Math.max(1, Math.round((Number(stats.value) || 1) * rewardMultiplier));

  const id = ++world.nextEnemyId;
  const enemy = {
    id, kind, x: point.x, y: point.y, r: stats.r, hp: stats.hp, maxHp: stats.hp,
    speed: stats.speed / WORLD_ZOOM, damage: stats.damage, color: stats.color,
    value: stats.value, angle: random() * Math.PI * 2, phase: random() * Math.PI * 2,
    hit: 0, attackCd: 0.6, vx: 0, vy: 0, damageRevision: 0, threat: world.bossSpawnCount,
    suctionActive: false, suctionTimer: 0, suctionCooldown: kind === 'devourer' ? 20 : 0, suctionPulse: 0,
    spawnCorner: point.corner ?? null, spawnRoomId: point.roomId || null, spawnedAt: Date.now(), eliteId,
    krakenSweepTimer: kind === 'kraken' ? 3.5 : 0, krakenSweepActive: false, krakenTelegraph: 0, krakenSweepCycle: 0
  };
  if(kind===RiftHardcore.FINAL_KIND&&layout){const bossRoom=layout.rooms.find(room=>room.id==='boss');if(bossRoom){enemy.x=bossRoom.x;enemy.y=bossRoom.y;enemy.angle=0;}}
  world.enemies.push(enemy);
  return enemy;
}

function spawnXpOrb(world, enemy) {
  if (!world || !enemy) return null;
  world.orbs ||= [];
  world.nextOrbId = Math.max(0, Number(world.nextOrbId) || 0) + 1;
  const eventId = world.activeEventId && Number(world.eventEndsAt) > Number(world.elapsed) ? world.activeEventId : null;
  const sizeScale = clamp((Number(enemy.r) || 10) / 10, .65, 10);
  const value = Math.max(1, Math.round((Number(enemy.value) || 1) * ExpeditionRules.eventXpMultiplier(eventId) * (.65 + sizeScale * .55)));
  const orb = {
    id: world.nextOrbId, x: Number(enemy.x) || 0, y: Number(enemy.y) || 0,
    r: clamp(3.8 + Math.sqrt(value) * .9 + Math.sqrt(Math.max(1, Number(enemy.r) || 10)) * .9, 4.5, 30),
    value, phase: 0, life: 25, sourceEnemyId: enemy.id,
    sourceKind: enemy.kind
  };
  world.orbs.push(orb);
  if (world.orbs.length > 220) world.orbs.splice(0, world.orbs.length - 220);
  return orb;
}

function spawnRewardOrb(world, x, y, value, sourceKind='cave-reward', sourceEnemyId=null) {
  if (!world) return null;
  world.orbs ||= [];
  world.nextOrbId = Math.max(0, Number(world.nextOrbId) || 0) + 1;
  const amount = Math.max(1, Math.round(Number(value) || 1));
  const orb = {
    id: world.nextOrbId, x: Number(x) || 0, y: Number(y) || 0,
    r: EnemyAI.xpOrbRadius ? EnemyAI.xpOrbRadius(amount) : Math.min(15, 4 + Math.sqrt(amount)),
    value: amount, phase: 0, life: 32, sourceEnemyId, sourceKind
  };
  world.orbs.push(orb);
  if (world.orbs.length > 220) world.orbs.splice(0, world.orbs.length - 220);
  return orb;
}

function initializeWorld(world, now = Date.now(), random = Math.random) {
  if (world.initialized) return [];
  world.initialized = true;
  world.elapsed = 0; world.nextEnemyId = 0; world.nextBossAt = 100 / 3.8;
  world.bossSpawnCount = 0; world.bossesDefeated = 0; world.lastBossKind = null;
  world.lastBossMaxHp = 0; world.lastBossDamage = 0; world.lastBossSpeed = 0; world.lastBossSpawnAt = 0;
  world.enemies = []; world.orbs = []; world.nextOrbId = 0; world.xpOrbCollectedCount = 0; world.commonSpawnTimer = 0.8;
  world.activeEventId = null; world.eventEndsAt = 0; world.eventSerial = 0;
  world.eliteRewardClaimedTier = -1; world.sideEncounterResolvedTier = -1; world.sideEncounterId = null; world.sideEncounterSerial = 0;
  world.mapSeed = Number(world.mapSeed) || AbyssalMap.seedValue(`${now}-${Math.random()}`); world.mapTier = Math.max(0, Math.floor(Number(world.mapTier) || 0));
  world.lastTick = now; world.snapshotTimer = 0; world.reliableSnapshotTimer = 0; world.playerSnapshotTimer = 0; world.orbSnapshotTimer = 0;
  if (world.mode === 'rift') return seedRiftEncounters(world, random);
  return [spawnEnemy(world, { type: 'common', initial: true, random }), spawnEnemy(world, { type: 'common', initial: true, random }), spawnEnemy(world, { type: 'common', initial: true, random })].filter(Boolean);
}

function seedRiftEncounters(world, random = Math.random) {
  if (!world || world.mode !== 'rift' || world.riftEncountersSeeded) return [];
  world.riftEncountersSeeded = true;
  world.nextBossAt = Infinity;
  world.riftActivatedRooms = {};
  return [];
}

const RIFT_ROOM_POPULATIONS=Object.freeze({shoal:7,trench:8,lantern:9,junction:9,event:0,hub:10,landing:15,elite:5});
function activateRiftEncounters(world,players,random=Math.random){
  if(!world||world.mode!=='rift')return [];
  const layout=mapLayoutFor(world);if(!layout)return [];
  world.riftActivatedRooms ||= {};
  const spawned=[];
  for(const player of players||[]){
    const room=AbyssalMap.roomAt(layout,Number(player.x),Number(player.y));
    if(!room||room.id==='start'||world.riftActivatedRooms[room.id])continue;
    world.riftActivatedRooms[room.id]=true;
    if(room.id==='boss'){
      const boss=spawnEnemy(world,{type:'boss',kindOverride:BOSS_KINDS[Math.max(0,Number(world.mapTier)||0)%BOSS_KINDS.length],roomId:'boss',random});
      if(boss)spawned.push(boss);
      continue;
    }
    const count=RIFT_ROOM_POPULATIONS[room.id]||0;
    for(let i=0;i<count;i++){
      const enemy=spawnEnemy(world,{type:room.id==='elite'?'elite':'common',roomId:room.id,forceElite:room.id==='elite',random});
      if(enemy)spawned.push(enemy);
    }
  }
  return spawned;
}

const movementNavigationProxy={x:0,y:0,moveSpeed:150/WORLD_ZOOM,skinId:'default',alive:true};
const movementNavigationTargets=[movementNavigationProxy];

function bossAbilityHit(enemy,target,rawDamage,now,abilityId,{neurotoxinMs=0}={}){
 if(!enemy||!target||target.alive===false)return null;
 let blocked=false,damage=0;
 target.maxHp=Math.max(1,Number(target.maxHp)||100);
 if((Number(target.shieldCharges)||0)>0){
  target.shieldCharges=Math.max(0,Number(target.shieldCharges)-1);blocked=true;target.invulnerableUntil=now+350;
 }else if(now>=(Number(target.invulnerableUntil)||0)){
  const requested=Math.max(1,Number(rawDamage)||1)*(SkinAbilities.incomingDamageMultiplier(target.skinId)||1);
  const before=Math.max(0,Number(target.hp)||target.maxHp);
  damage=Math.min(before,requested);target.hp=Math.max(0,before-damage);target.invulnerableUntil=now+520;
  if(neurotoxinMs>0&&damage>0)target.neurotoxinUntil=now+neurotoxinMs;
  if(target.hp<=0)target.alive=false;
 }
 return {
  playerId:target.id,enemyId:enemy.id,enemyKind:enemy.kind,abilityId,
  enemyX:Number(enemy.x),enemyY:Number(enemy.y),enemyColor:enemy.color,
  damage,blocked,neurotoxinMs:damage>0?neurotoxinMs:0,
  hp:Math.max(0,Number(target.hp)||0),maxHp:target.maxHp,
  shieldCharges:clamp(Math.floor(Number(target.shieldCharges)||0),0,3),
  alive:target.alive!==false,invulnerabilityMs:Math.max(0,(Number(target.invulnerableUntil)||0)-now)
 };
}
function segmentDistance(px,py,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;if(l2<=1e-9)return Math.hypot(px-ax,py-ay);
 const q=clamp(((px-ax)*dx+(py-ay)*dy)/l2,0,1);return Math.hypot(px-(ax+dx*q),py-(ay+dy*q));
}

function tickWorld(world, players, now = Date.now(), random = Math.random) {
  const mapLayout = mapLayoutFor(world);
  const riftMode = world.mode === 'rift';
  const validPlayers = Array.isArray(players)
    ? players.filter(p => p && p.alive !== false && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
    : [];
  if (validPlayers.length === 0) {
    // No living participants means no world time, spawning, movement, or attacks.
    // The server stops its ticker as well; state is cleared when the last participant leaves.
    world.lastTick = now;
    world.movingEnemyCount = 0;
    return { active: false, dt: 0, movedEnemyCount: 0, spawnedEnemies: [], spawnedBosses: [], playerHits: [], playerHeals: [], defeatedPlayers: [], sendSnapshot: false, sendReliableSnapshot: false, sendPlayers: false };
  }

  const initialSpawns = initializeWorld(world, now, random);
  const spawnedEnemies = [...initialSpawns];
  if (riftMode && !world.riftEncountersSeeded) spawnedEnemies.push(...seedRiftEncounters(world, random));
  if (riftMode) spawnedEnemies.push(...activateRiftEncounters(world, validPlayers, random));
  const previousTick = Number(world.lastTick) || now;
  // The server runs this ticker independently of browser rendering. Clamp a single
  // catch-up step to avoid huge jumps after GC or brief event-loop contention.
  const dt = Math.max(0, Math.min(0.1, (now - previousTick) / 1000));
  world.lastTick = now;
  world.elapsed += dt;
  world.tickCount++;
  let eventEnded = null;
  if (world.activeEventId && Number(world.eventEndsAt) > 0 && world.elapsed >= Number(world.eventEndsAt)) {
    eventEnded = { id: world.activeEventId, serial: Number(world.eventSerial) || 0, endedAt: world.elapsed };
    world.activeEventId = null;
    world.eventEndsAt = 0;
  }

  // Server-authoritative passive regeneration: it continues even if a player's tab is hidden.
  const playerHeals = [];
  for (const p of validPlayers) {
    const regenLevel = clamp(Math.floor(Number(p.regenLevel) || 0), 0, 3);
    if (regenLevel <= 0 || Number(p.hp) >= Number(p.maxHp)) continue;
    p.regenAccumulator = (Number(p.regenAccumulator) || 0) + dt * regenLevel * 0.25;
    let healed = 0;
    while (p.regenAccumulator >= 1 && Number(p.hp) < Number(p.maxHp)) {
      p.regenAccumulator -= 1;
      p.hp = Math.min(Number(p.maxHp) || 100, (Number(p.hp) || 0) + 1);
      healed++;
    }
    if (healed > 0) playerHeals.push({
      playerId: p.id, hp: p.hp, maxHp: p.maxHp,
      shieldCharges: clamp(Math.floor(Number(p.shieldCharges) || 0), 0, 3),
      alive: p.alive !== false, healed,
      invulnerabilityMs: Math.max(0, (Number(p.invulnerableUntil) || 0) - now)
    });
  }

  const spawnedRewardOrbs = [];
  let sideEncounter = null;
  if (riftMode && Number(world.sideEncounterResolvedTier) !== Number(world.mapTier)) {
    const eventRoom = mapLayout?.rooms?.find(room => room.id === 'event');
    const entrant = eventRoom && validPlayers.find(player => AbyssalMap.roomAt(mapLayout, Number(player.x), Number(player.y))?.id === 'event');
    if (entrant) {
      const encounter = ExpeditionRules.sideEncounterFor?.(world.mapSeed, world.mapTier);
      if (encounter) {
        world.sideEncounterResolvedTier = Number(world.mapTier) || 0;
        world.sideEncounterId = encounter.id;
        world.sideEncounterSerial = (Number(world.sideEncounterSerial) || 0) + 1;
        sideEncounter = { id: encounter.id, type: encounter.type, name: encounter.name, subtitle: encounter.subtitle, risk: encounter.risk, reward: encounter.reward, accent: encounter.accent, serial: world.sideEncounterSerial, tier: world.mapTier };
        if (encounter.type === 'treasure') {
          const orb = spawnRewardOrb(world, eventRoom.x, eventRoom.y, 28 + Math.max(0, Number(world.mapTier) || 0) * 7, 'resonance-cache');
          if (orb) spawnedRewardOrbs.push(orb);
        } else {
          const count = Math.max(1, Math.min(9, Math.floor(Number(encounter.ambushCount) || 4)));
          for (let i = 0; i < count && world.enemies.length < MAX_ENEMIES; i++) {
            const ambusher = spawnEnemy(world, { type: 'common', roomId: 'event', forceElite: false, random });
            if (ambusher) spawnedEnemies.push(ambusher);
          }
        }
      }
    }
  }

  world.commonSpawnTimer -= dt;
  let commonCount = countCommons(world);
  if (!riftMode && commonCount === 0 && world.enemies.length < MAX_ENEMIES) {
    const spawned = spawnEnemy(world, { type: 'common', random });
    if (spawned) spawnedEnemies.push(spawned);
    commonCount = countCommons(world);
    world.commonSpawnTimer = 0.35;
  } else if (!riftMode && world.commonSpawnTimer <= 0) {
    if (commonCount < MAX_COMMON_ENEMIES && world.enemies.length < MAX_ENEMIES) {
      const spawned = spawnEnemy(world, { type: 'common', random });
      if (spawned) spawnedEnemies.push(spawned);
    }
    commonCount = countCommons(world);
    const spawnRamp = clamp(world.elapsed / 300, 0, 1);
    const spawnInterval = 0.52 * (1 - (2 / 3) * spawnRamp) * ExpeditionRules.eventSpawnIntervalMultiplier(world.activeEventId);
    world.commonSpawnTimer = commonCount < MAX_COMMON_ENEMIES ? Math.max(0.17, spawnInterval) : 0.12;
  }

  const spawnedBosses = [];
  // Progressão autoritativa do servidor: um chefe por ciclo e nunca outro enquanto estiver vivo.
  if (!riftMode && world.elapsed >= world.nextBossAt && countBossCount(world) === 0) {
    if (world.enemies.length < MAX_ENEMIES) {
      const boss = spawnEnemy(world, { type: 'boss', random });
      if (boss) {
        spawnedBosses.push(boss);
        spawnedEnemies.push(boss);
        world.nextBossAt = Infinity;
      } else world.nextBossAt = world.elapsed + 1;
    } else world.nextBossAt = world.elapsed + 1;
  }

  let movedEnemyCount = 0;
  const playerHits = [];
  const playerSuctionPulls = [];
  const bossAbilityHits = [];
  const bossAbilityEvents = [];
  const defeatedPlayers = [];
  const riftAims=[],environmentDamages=[],environmentKills=[];
  // The same procedural geometry is evaluated in solo and on the authoritative server.
  // Each hazard has a visible warning phase; damage can occur only in its active phase.
  if(riftMode&&mapLayout){
    for(const hazard of RiftHardcore.build(mapLayout,world.mapTier)){
      const phase=RiftHardcore.state(hazard,world.elapsed);
      if(hazard.type==='tentacle'&&phase.phase!=='idle'){
       const derived=RiftHardcore.hazardAtCycle(hazard,phase.cycle);
       if(!derived.aimed){
        const target=RiftHardcore.targetNearest(hazard,validPlayers,mapLayout);
        const aim=RiftHardcore.aimTentacle(hazard,phase.cycle,target?.x,target?.y);
        if(aim)riftAims.push(aim);
       }
      }
      if(phase.phase!=='active')continue;
      for(const target of validPlayers){
        if(target.tutorialActive||!RiftHardcore.hit(hazard,target.x,target.y,Number(target.r)||13/WORLD_ZOOM,phase))continue;
        target.riftHazardCooldowns ||= Object.create(null);
        // Continuous suction is independent from periodic damage.
        if((hazard.type==='vortex'||hazard.type==='lure')&&target.alive!==false){
          const dx=hazard.x-target.x,dy=hazard.y-target.y,length=Math.hypot(dx,dy)||1;
          const pull=Math.min(Math.max(0,length-7),(hazard.type==='vortex'?430:190)*dt);
          const moved=AbyssalMap.resolveMove(mapLayout,target.x,target.y,target.x+dx/length*pull,target.y+dy/length*pull,Number(target.r)||13/WORLD_ZOOM);
          const ox=moved.x-target.x,oy=moved.y-target.y;
          target.x=moved.x;target.y=moved.y;
          if(ox||oy)playerSuctionPulls.push({playerId:target.id,dx:ox,dy:oy,bossId:hazard.type+':'+hazard.id,strength:hazard.type==='vortex'?.95:.38});
        }
        if(now<(Number(target.riftHazardCooldowns[hazard.id])||0))continue;
        target.riftHazardCooldowns[hazard.id]=now+(hazard.type==='tentacle'?690:hazard.type==='fumarole'||hazard.type==='pressure'||hazard.type==='vortex'?1000:1250);
        const pseudo={id:'hazard:'+hazard.id,kind:'riftHazard',x:hazard.x,y:hazard.y,color:RiftHardcore.TYPES[hazard.type].color};
        const result=bossAbilityHit(pseudo,target,hazard.damage,now,'rift-'+hazard.type,{neurotoxinMs:hazard.type==='fumarole'?1150:0});
        if(result){bossAbilityHits.push(result);if(result.alive===false)defeatedPlayers.push(target);}
        
      }

      // Living foes also occupy the cave. Environmental hazards are neutral;
      // only Pesadelo Roxo is immune to his own tentacles.
      for(const enemy of world.enemies){
       if(enemy.hp<=0||(enemy.spawnedAt&&now-enemy.spawnedAt<3000)||(hazard.type==='tentacle'&&enemy.kind===RiftHardcore.FINAL_KIND))continue;
       const enemyRadius=Math.min(43,Math.max(6,(Number(enemy.r)||16)*.48));
       if(!RiftHardcore.hit(hazard,Number(enemy.x),Number(enemy.y),enemyRadius,phase))continue;
       enemy.riftHazardCooldowns ||= Object.create(null);
       if(now<(Number(enemy.riftHazardCooldowns[hazard.id])||0))continue;
       enemy.riftHazardCooldowns[hazard.id]=now+(hazard.type==='tentacle'?750:1100);
       const damage=Math.min(Number(enemy.hp)||0,Math.max(1,hazard.damage));
       if(!damage)continue;
       enemy.hp=Math.max(0,enemy.hp-damage);enemy.hit=.17;
       enemy.damageRevision=(Number(enemy.damageRevision)||0)+1;
       environmentDamages.push({id:enemy.id,hp:enemy.hp,maxHp:enemy.maxHp,damageRevision:enemy.damageRevision,
        damage,skillId:'rift-hazard-'+hazard.type,kind:enemy.kind,enemyX:enemy.x,enemyY:enemy.y,
        enemyColor:enemy.color,killed:enemy.hp<=0});
       if(enemy.hp<=0){
        const boss=BOSS_KINDS.includes(enemy.kind);
        if(boss){world.bossesDefeated=(Number(world.bossesDefeated)||0)+1;world.lastBossKind=enemy.kind;world.nextBossAt=Infinity;}
        const orb=spawnXpOrb(world,enemy);
        if(orb)spawnedRewardOrbs.push(orb);
        environmentKills.push({id:enemy.id,x:enemy.x,y:enemy.y,kind:enemy.kind,
          value:enemy.value,color:enemy.color,boss});
       }
      }
    }
    if(environmentKills.length){const removed=new Set(environmentKills.map(e=>String(e.id)));world.enemies=world.enemies.filter(e=>!removed.has(String(e.id)));}
  }
  // Reuse one movement result and one options object through the entire 400-enemy pass.
  const movementResult = {};
  const movementOptions = { minX: 8 / WORLD_ZOOM, maxX: WORLD_WIDTH - 8 / WORLD_ZOOM, minY: 8 / WORLD_ZOOM, maxY: (mapLayout?.height||WORLD_HEIGHT) - 8 / WORLD_ZOOM, stopDistance: 0 };
  const contactTarget = { x: 0, y: 0, r: 13 / WORLD_ZOOM };
  // Players choosing a skill are protected and removed from enemy target selection;
  // enemies continue pursuing the remaining active players in the room.
  const targetablePlayers = [];
  for (const p of validPlayers) if ((Number(p.skillSelectingUntil) || 0) <= now && !(p.skinId==='angler'&&anglerInvisibleAt(now))) targetablePlayers.push(p);
  for (const enemy of world.enemies) {
    if(riftMode&&enemy.spawnedAt&&now-enemy.spawnedAt<3000)continue;
    enemy.hit = Math.max(0, (enemy.hit || 0) - dt);
    enemy.attackCd = Math.max(0, (enemy.attackCd || 0) - dt);
    if(enemy.kind===RiftHardcore.FINAL_KIND){
       const contenders=targetablePlayers.filter(p=>AbyssalMap.roomAt(mapLayout,Number(p.x),Number(p.y))?.id==='boss');
       if(!enemy.riftNextAttackAt)enemy.riftNextAttackAt=now+1400;
       for(const target of contenders){
         if(Math.hypot(enemy.x-target.x,enemy.y-target.y)>enemy.r*.85+(Number(target.r)||13/WORLD_ZOOM))continue;
         enemy.nightmareHeadCooldowns ||= Object.create(null);
         if(now<(Number(enemy.nightmareHeadCooldowns[target.id])||0))continue;
         enemy.nightmareHeadCooldowns[target.id]=now+900;
         const collision=bossAbilityHit(enemy,target,50,now,'nightmare-head-contact');
         if(collision){bossAbilityHits.push(collision);if(collision.alive===false)defeatedPlayers.push(target);}
       }
       // Eight physical curved tentacle hazards anchored to the boss-room walls
       // replace the old floating linear boss marks. Only the head does 50 on touch.
       continue; // The final kraken is rooted; its head never chases or body-collides.
     }
     if (enemy.kind === 'kraken') {
      // Slow, readable boss sweep: 2.4 s telegraph, 2.8 s damaging sweep, 4.8 s recovery.
      enemy.krakenSweepTimer = Math.max(0, (Number(enemy.krakenSweepTimer) || 0) - dt);
      if (enemy.krakenSweepTimer <= 0) {
        enemy.krakenSweepCycle = ((Number(enemy.krakenSweepCycle) || 0) + dt);
        const cycle = enemy.krakenSweepCycle;
        enemy.krakenTelegraph = cycle < 2.4 ? clamp(cycle / 2.4, 0, 1) : 1;
        enemy.krakenSweepActive = cycle >= 2.4 && cycle < 5.2;
        // Deliberately slow, broad arm motion. Players see the arc before contact becomes dangerous.
        enemy.phase = cycle * 0.42;
        if (cycle >= 10) {
          enemy.krakenSweepCycle = 0;
          enemy.krakenSweepTimer = 0;
          enemy.krakenSweepActive = false;
          enemy.krakenTelegraph = 0;
        }
      }
    }
    if (enemy.kind === 'devourer') {
      enemy.suctionCooldown = Math.max(0, (Number(enemy.suctionCooldown) || 0) - dt);
      if (enemy.suctionActive) {
        enemy.suctionTimer = Math.max(0, (Number(enemy.suctionTimer) || 0) - dt);
        if (enemy.suctionTimer <= 0) enemy.suctionActive = false;
      } else if (enemy.suctionCooldown <= 0) {
        enemy.suctionActive = true;
        enemy.suctionTimer = 4;
        enemy.suctionCooldown = 20;
        enemy.suctionPulse = (Number(enemy.suctionPulse) || 0) + 1;
      }
    }
    // Angler ability is now camouflage; visibility is deterministic and handled by the renderer/target selection.
    if(enemy.kind==='boss'){
      enemy.inkTrailTimer=(Number(enemy.inkTrailTimer)||0)+dt;
      if(enemy.inkTrailTimer>=.275){
        enemy.inkTrailTimer=0;const radius=76/WORLD_ZOOM;
        const tx=enemy.x-Math.cos(Number(enemy.angle)||0)*(Number(enemy.r)||40)*.72;
        const ty=enemy.y-Math.sin(Number(enemy.angle)||0)*(Number(enemy.r)||40)*.72;
        bossAbilityEvents.push({bossId:enemy.id,kind:enemy.kind,abilityId:'ink-trail',x:tx,y:ty,angle:enemy.angle||0,radius,color:'#07101d'});
        for(const target of validPlayers){
          if(Math.hypot(Number(target.x)-tx,Number(target.y)-ty)>radius+(Number(target.r)||13/WORLD_ZOOM))continue;
          const hit=bossAbilityHit(enemy,target,2,now,'ink-trail');
          if(hit){bossAbilityHits.push(hit);if(hit.alive===false)defeatedPlayers.push(target);}
        }
      }
    }
    if(enemy.kind==='maw'){
      enemy.mawAbilityTimer=(Number(enemy.mawAbilityTimer)||0)+dt;
      if(enemy.mawAbilityTimer>=4.0){
        enemy.mawAbilityTimer=0;const radius=205/WORLD_ZOOM;
        bossAbilityEvents.push({bossId:enemy.id,kind:enemy.kind,abilityId:'gulper-chomp',x:enemy.x,y:enemy.y,angle:enemy.angle||0,radius,color:enemy.color});
        for(const target of validPlayers){if(Math.hypot(Number(target.x)-enemy.x,Number(target.y)-enemy.y)>radius)continue;const hit=bossAbilityHit(enemy,target,24,now,'gulper-chomp');if(hit){bossAbilityHits.push(hit);if(hit.alive===false)defeatedPlayers.push(target);}}
      }
    }
    if(enemy.kind==='leviathan'){
      enemy.pressureWaveTimer=(Number(enemy.pressureWaveTimer)||0)+dt;
      if(enemy.pressureWaveTimer>=4.8){
        enemy.pressureWaveTimer=0;const length=480/WORLD_ZOOM,width=72/WORLD_ZOOM,ang=Number(enemy.angle)||0,x2=enemy.x+Math.cos(ang)*length,y2=enemy.y+Math.sin(ang)*length;
        bossAbilityEvents.push({bossId:enemy.id,kind:enemy.kind,abilityId:'pressure-lance',x:enemy.x,y:enemy.y,angle:ang,radius:length,color:enemy.color});
        for(const target of validPlayers){if(segmentDistance(Number(target.x),Number(target.y),enemy.x,enemy.y,x2,y2)>width)continue;const hit=bossAbilityHit(enemy,target,22,now,'pressure-lance');if(hit){bossAbilityHits.push(hit);if(hit.alive===false)defeatedPlayers.push(target);}}
      }
    }
    if (enemy.kind === 'devourer' && enemy.suctionActive) {
      // The Devourer holds position while drawing every nearby creature and player
      // toward its mouth. Pull is authoritative online and mirrored by the solo client.
      enemy.vx = 0; enemy.vy = 0;
      for (const creature of world.enemies) {
        if (creature === enemy) continue;
        const pull = EnemyAI.suctionPullDelta(creature, enemy, dt);
        if (pull.dx || pull.dy) {
          const moved=riftMode?AbyssalMap.resolveMove(mapLayout,creature.x,creature.y,creature.x+pull.dx,creature.y+pull.dy,Math.max(8,(Number(creature.r)||10)/WORLD_ZOOM*.7)):{x:clamp(creature.x+pull.dx,0,WORLD_WIDTH),y:clamp(creature.y+pull.dy,0,WORLD_HEIGHT)};
          const actualDx=moved.x-creature.x,actualDy=moved.y-creature.y;
          creature.x=moved.x;creature.y=moved.y;
          creature.vx=actualDx/Math.max(dt,0.001);creature.vy=actualDy/Math.max(dt,0.001);
        }
      }
      for (const player of validPlayers) {
        const pull = EnemyAI.suctionPullDelta(player, enemy, dt);
        if (!pull.dx && !pull.dy) continue;
        const moved=riftMode?AbyssalMap.resolveMove(mapLayout,Number(player.x),Number(player.y),Number(player.x)+pull.dx,Number(player.y)+pull.dy,Math.max(10,Number(player.r)||13/WORLD_ZOOM)):{x:clamp(Number(player.x)+pull.dx,0,WORLD_WIDTH),y:clamp(Number(player.y)+pull.dy,0,WORLD_HEIGHT)};
        const actualDx=moved.x-Number(player.x),actualDy=moved.y-Number(player.y);
        player.x=moved.x;player.y=moved.y;
        playerSuctionPulls.push({ playerId: player.id, dx: actualDx, dy: actualDy, bossId: enemy.id, strength: pull.strength });
      }
      continue;
    }

    // Giro do Nilo: mesmo passo de impulso do modo solo, antes da IA normal.
    // Não muda o ângulo nem interrompe o movimento normal de perseguição.
    if (enemy.kbVx || enemy.kbVy) {
      const moved=riftMode?AbyssalMap.resolveMove(mapLayout,Number(enemy.x),Number(enemy.y),Number(enemy.x)+(Number(enemy.kbVx)||0)*dt,Number(enemy.y)+(Number(enemy.kbVy)||0)*dt,Math.max(8,(Number(enemy.r)||10)/WORLD_ZOOM*.72)):{x:clamp(Number(enemy.x)+(Number(enemy.kbVx)||0)*dt,0,WORLD_WIDTH),y:clamp(Number(enemy.y)+(Number(enemy.kbVy)||0)*dt,0,WORLD_HEIGHT),blocked:false};
      enemy.x=moved.x;enemy.y=moved.y;if(moved.blocked){enemy.kbVx*=.25;enemy.kbVy*=.25;}
      const decay = Math.exp(-dt * 6.5);
      enemy.kbVx = (Number(enemy.kbVx) || 0) * decay;
      enemy.kbVy = (Number(enemy.kbVy) || 0) * decay;
      if (Math.hypot(enemy.kbVx, enemy.kbVy) < 15) {
        enemy.kbVx = 0;
        enemy.kbVy = 0;
      }
    }

    if (enemy.paralyzedUntil && now < enemy.paralyzedUntil) {
      continue;
    }
    movementOptions.stopDistance = Math.max(1, ((Number(enemy.r) || 10) + 13 + 8) / WORLD_ZOOM * 0.96);
    let actualTarget=null,nearestTargetDistance=Infinity;
    for(const candidate of targetablePlayers){const d=Math.hypot(Number(candidate.x)-Number(enemy.x),Number(candidate.y)-Number(enemy.y));if(d<nearestTargetDistance){nearestTargetDistance=d;actualTarget=candidate;}}
    let movement;
    if (!riftMode) {
      movement = EnemyAI.moveTowardTarget(enemy, targetablePlayers, dt, movementOptions, movementResult);
      if (!movement.moved && actualTarget && dt > 0) {
        movement.moved = forceAdvanceEnemy(enemy, targetablePlayers, dt);
        if (movement.moved) world.movementRecoveryCount = (world.movementRecoveryCount || 0) + 1;
      }
      movement.target = actualTarget;
    } else {
    let movementTargets=targetablePlayers;
    if(actualTarget){
      const targetRoom=AbyssalMap.roomAt(mapLayout,actualTarget.x,actualTarget.y);
      {
      const nav=AbyssalMap.navigationTarget(mapLayout,enemy.x,enemy.y,actualTarget.x,actualTarget.y,{padding:Math.max(8,Math.min(38,(Number(enemy.r)||10)*.58)),includePortal:false});
      if(!nav.direct){
        movementNavigationProxy.x=nav.x;movementNavigationProxy.y=nav.y;movementNavigationProxy.moveSpeed=actualTarget.moveSpeed;movementNavigationProxy.skinId=actualTarget.skinId;movementNavigationProxy.alive=actualTarget.alive;
        movementTargets=movementNavigationTargets;
      }
      }
    }
    const beforeMoveX=Number(enemy.x),beforeMoveY=Number(enemy.y);
    movement = EnemyAI.moveTowardTarget(enemy, movementTargets, dt, movementOptions, movementResult);
    const resolvedMove=AbyssalMap.resolveMove(mapLayout,beforeMoveX,beforeMoveY,enemy.x,enemy.y,Math.max(8,Math.min(38,(Number(enemy.r)||10)*.58)));
    enemy.x=resolvedMove.x;enemy.y=resolvedMove.y;
    if(resolvedMove.blocked&&enemy.kind==='whiteShark'||resolvedMove.blocked&&enemy.kind==='whiteSharkBoss'){enemy.dashVx=null;enemy.dashVy=null;}
    movement.moved=Math.hypot(enemy.x-beforeMoveX,enemy.y-beforeMoveY)>.04;
    movement.target=actualTarget;
    if (!movement.moved && actualTarget && dt > 0) {
      const nav=AbyssalMap.navigationTarget(mapLayout,enemy.x,enemy.y,actualTarget.x,actualTarget.y,{padding:Math.max(8,Math.min(38,(Number(enemy.r)||10)*.58)),includePortal:false});
      if(nav&&Math.hypot(nav.x-enemy.x,nav.y-enemy.y)>1){
        const dx=nav.x-enemy.x,dy=nav.y-enemy.y,d=Math.hypot(dx,dy)||1,step=Math.min(Math.max(8,Number(enemy.speed)||30)*.5*dt,d);
        const fallback=AbyssalMap.resolveMove(mapLayout,enemy.x,enemy.y,enemy.x+dx/d*step,enemy.y+dy/d*step,Math.max(8,Math.min(38,(Number(enemy.r)||10)*.58)));
        enemy.x=fallback.x;enemy.y=fallback.y;movement.moved=Math.hypot(enemy.x-beforeMoveX,enemy.y-beforeMoveY)>.04;
        if(movement.moved)world.movementRecoveryCount=(world.movementRecoveryCount||0)+1;
      }
    }
    }
    if (movement.moved) movedEnemyCount++;

    // Contact attacks are resolved here on the server, never in requestAnimationFrame.
    // A minimized tab keeps taking damage at its last known position; a visible tab must
    // have a fresh heartbeat and uses a short velocity prediction to compensate for transit
    // time. This prevents hits against stale coordinates that no longer match the sprite.
    const target = movement.target;
    if (!target || target.alive === false || enemy.attackCd > 0) continue;
    const lastPositionAt = Number(target.lastPositionAt) || 0;
    const positionAge = lastPositionAt > 0 ? Math.max(0, now - lastPositionAt) : Infinity;
    const resumeGraceUntil = Number(target.positionResumeGraceUntil) || 0;
    if (target.clientHidden !== true && (lastPositionAt <= 0 || positionAge > 180 || resumeGraceUntil > now)) {
      world.stalePositionAttackSkips = (world.stalePositionAttackSkips || 0) + 1;
      continue;
    }
    const predictionSeconds = target.clientHidden === true ? 0 : Math.min(0.12, Math.max(0, positionAge) / 1000);
    let vx = Number(target.velocityX) || 0, vy = Number(target.velocityY) || 0;
    const velocity = Math.hypot(vx, vy);
    if (velocity > 320) { vx = vx / velocity * 320; vy = vy / velocity * 320; }
    let resolvedContactTarget = target;
    if (target.clientHidden !== true) {
      // Reuse a single lightweight contact target rather than spreading/copying the
      // complete player record for every enemy whose contact cooldown expires.
      contactTarget.x = Number(target.x) + vx * predictionSeconds;
      contactTarget.y = Number(target.y) + vy * predictionSeconds;
      contactTarget.r = Number(target.r) || (13 / WORLD_ZOOM);
      resolvedContactTarget = contactTarget;
    }
    const contact = contactGeometry(enemy, resolvedContactTarget);
    const contactDistance = contact.distance;
    const rawContactRadius = contact.radius;
    // Reduce the outer edge of the hitbox by the player movement predicted since the
    // latest sample plus a small jitter buffer. It can never report a hit outside the
    // visible body-to-body collision envelope after compensation.
    const predictedDrift = Math.hypot(vx, vy) * predictionSeconds;
    const contactSafetyMargin = target.clientHidden === true ? 0 : Math.min(28, 8 + predictedDrift);
    // Visible-player contact is deliberately stricter than the solo padding radius. The
    // client is locally predicting its own movement between position packets; this margin
    // compensates for the short sampling/network window so the sprite must actually be
    // overlapping/very close before the server applies damage. Hidden tabs still use the
    // full authoritative radius at their last known coordinate.
    const contactRadius = target.clientHidden === true ? rawContactRadius : Math.max(1, rawContactRadius - contactSafetyMargin);
    if (contactDistance > contactRadius) continue;

    // Contact attacks now expose a species identity without widening hitboxes.
    const contactProfile={
      drifter:{skillId:'bio-shock',power:1.08,cooldown:.95,neuro:650},
      stinger:{skillId:'venom-spine',power:1.16,cooldown:.64,neuro:1100},
      brute:{skillId:'crusher-claw',power:1.28,cooldown:1.05,neuro:0},
      lurker:{skillId:'gulper-bite',power:1.22,cooldown:.84,neuro:0}
    }[enemy.kind]||null;
    const attackInterval = BOSS_KINDS.includes(enemy.kind) ? 1.15 : (contactProfile?.cooldown ?? .92);
    enemy.attackCd = attackInterval;
    if ((Number(target.invulnerableUntil) || 0) > now) continue;

    let appliedDamage = 0, blocked = false, neurotoxinMs = 0;
    const shieldCharges = clamp(Math.floor(Number(target.shieldCharges) || 0), 0, 3);
    if (shieldCharges > 0) {
      target.shieldCharges = shieldCharges - 1;
      target.invulnerableUntil = now + (target.skinId === 'violet' ? 900 : 700);
      blocked = true;
    } else {
      const baseDamage = Math.max(1, Math.min(100, Number(enemy.damage) || 8));
      const contactPower = contactProfile?.power || (enemy.kind==='kraken'&&enemy.krakenSweepActive?1.25:enemy.kind==='whiteSharkBoss'?1.15:enemy.kind==='devourer'&&enemy.suctionActive?1.2:1);
      const requestedDamage = Math.max(1, Math.round(baseDamage * contactPower * SkinAbilities.incomingDamageMultiplier(target.skinId)));
      const hpBefore = Number.isFinite(Number(target.hp)) ? Number(target.hp) : (Number(target.maxHp) || 100);
      target.maxHp = Math.max(1, Number(target.maxHp) || 100);
      target.hp = Math.max(0, Math.min(target.maxHp, hpBefore) - requestedDamage);
      appliedDamage = Math.min(requestedDamage, Math.max(0, hpBefore));
      target.invulnerableUntil = now + (target.skinId === 'violet' ? 1000 : 800);
      const contactNeuro=Math.max(0,Number(contactProfile?.neuro)||0);
      if (contactNeuro > 0 && appliedDamage > 0) { target.neurotoxinUntil = now + contactNeuro; neurotoxinMs = contactNeuro; }

      if (target.hp <= 0) {
        target.alive = false;
        world.playerDefeatCount = (world.playerDefeatCount || 0) + 1;
        defeatedPlayers.push(target);
      }
    }
    world.playerDamageCount = (world.playerDamageCount || 0) + 1;
    playerHits.push({
      playerId: target.id, enemyId: enemy.id, enemyKind: enemy.kind,
      enemyX: Number(enemy.x), enemyY: Number(enemy.y), enemyColor: enemy.color,
      enemyRadius: contact.enemyRadiusWorld, playerX: Number(resolvedContactTarget.x), playerY: Number(resolvedContactTarget.y),
      contactDistance, contactRadius,
      positionAgeMs: Number.isFinite(positionAge) ? positionAge : null,
      rawContactRadius, contactSafetyMargin, targetWasHidden: target.clientHidden === true,
      damage: appliedDamage, blocked, neurotoxinMs, skillId:contactProfile?.skillId||'contact-bite', hp: Math.max(0, Number(target.hp) || 0),
      maxHp: Math.max(1, Number(target.maxHp) || 100),
      shieldCharges: clamp(Math.floor(Number(target.shieldCharges) || 0), 0, 3),
      alive: target.alive !== false,
      invulnerabilityMs: Math.max(0, (Number(target.invulnerableUntil) || 0) - now)
    });
  }

  // Shared XP orbs are server-owned world entities. All co-op clients receive the same
  // coordinates, lifetime and removal event; only the first player to touch an orb earns it.
  world.orbs ||= [];
  const xpCollected = [];
  const expiredOrbIds = new Set();
  const expiredOnlyOrbIds = [];
  for (const orb of world.orbs) {
    orb.phase = (Number(orb.phase) || 0) + dt * 3;
    orb.life = (Number(orb.life) || 0) - dt;
    if (orb.life <= 0) { expiredOrbIds.add(String(orb.id)); expiredOnlyOrbIds.push(String(orb.id)); continue; }

    // Same magnetic pickup idea as solo: the orb is pulled toward the nearest player
    // with magnet range. Its movement remains authoritative, so every client sees it alike.
    let magnetTarget = null, magnetDistance = Infinity, magnetRange = 0;
    for (const p of validPlayers) {
      const strength = clamp(Number(p.magnetStrength) || 1, 1, 4.5);
      const range = 140 * strength * SkinAbilities.magnetRangeMultiplier(p.skinId) * (p.skinId === 'devourer' && Number(p.devourerVacuumUntil) > now ? 4 : 1) / WORLD_ZOOM;
      const d = Math.hypot(Number(p.x) - orb.x, Number(p.y) - orb.y);
      if (d < range && d < magnetDistance) {
        magnetTarget = p; magnetDistance = d; magnetRange = range;
      }
    }
    if (magnetTarget && magnetDistance > 0.001) {
      const f = clamp((magnetRange - magnetDistance) / Math.max(1, magnetRange), 0, 1);
      // Keep pickup motion authoritative, but fast enough to visibly answer to the magnet skill.
      const pullSpeed = (36 + f * 150) * Math.sqrt(Math.max(1, Number(magnetTarget.magnetStrength) || 1)) / WORLD_ZOOM;
      const pull = Math.min(magnetDistance, dt * pullSpeed);
      orb.x += (Number(magnetTarget.x) - orb.x) / magnetDistance * pull;
      orb.y += (Number(magnetTarget.y) - orb.y) / magnetDistance * pull;
    }

    // If multiple players touch it in one server tick, choose the closest; a stable
    // ID tie-break makes simultaneous collection deterministic. The orb is removed once.
    const orbRadiusWorld = Math.max(1, Number(orb.r) || 4) / WORLD_ZOOM;
    let collector = null, collectorDistance = Infinity;
    for (const p of validPlayers) {
      const d = Math.hypot(Number(p.x) - orb.x, Number(p.y) - orb.y);
      const playerRadius = Math.max(1, Number(p.r) || (13 / WORLD_ZOOM));
      if (d <= playerRadius + orbRadiusWorld + 4 / WORLD_ZOOM &&
          (d < collectorDistance || (d === collectorDistance && String(p.id) < String(collector?.id || '\uffff')))) {
        collector = p; collectorDistance = d;
      }
    }
    if (collector) {
      expiredOrbIds.add(String(orb.id));
      world.xpOrbCollectedCount = (world.xpOrbCollectedCount || 0) + 1;
      const orbValue = Math.max(1, Math.round(Number(orb.value) || 1));
      const xpMultiplier = SkinAbilities.orbExperienceMultiplier(collector.skinId);
      xpCollected.push({ playerId: collector.id, orbId: orb.id, baseValue:orbValue, shared:riftMode, value: Math.max(1, Math.round(orbValue * xpMultiplier)), x: orb.x, y: orb.y, sourceKind: orb.sourceKind || null });
    }
  }
  if (expiredOrbIds.size) world.orbs = world.orbs.filter(orb => !expiredOrbIds.has(String(orb.id)));

  if (movedEnemyCount) world.lastMovementAt = now;
  world.movingEnemyCount = movedEnemyCount;
  world.snapshotTimer -= dt;
  world.reliableSnapshotTimer = (Number(world.reliableSnapshotTimer) || 0) - dt;
  world.playerSnapshotTimer -= dt;
  world.orbSnapshotTimer = (Number(world.orbSnapshotTimer) || 0) - dt;
  const sendSnapshot = world.snapshotTimer <= 0;
  const sendReliableSnapshot = world.reliableSnapshotTimer <= 0;
  const sendPlayers = world.playerSnapshotTimer <= 0;
  const sendOrbSnapshot = sendSnapshot && world.orbSnapshotTimer <= 0;
  if (sendSnapshot) world.snapshotTimer = 0.125;
  // Full-world recovery snapshots are expensive; lifecycle events and 8 Hz interpolated motion keep clients current.
  // Use a 30 s recovery interval instead of resending every enemy/orb every 5 s.
  if (sendReliableSnapshot) world.reliableSnapshotTimer = 30;
  if (sendPlayers) world.playerSnapshotTimer = 1;
  if (sendOrbSnapshot) world.orbSnapshotTimer = 0.25;
  return {
    active: true, dt, movedEnemyCount,
    spawnedEnemies,
    spawnedBosses: spawnedEnemies.filter(e => BOSS_KINDS.includes(e.kind)),
    playerHits, playerSuctionPulls, bossAbilityHits, bossAbilityEvents, riftAims,environmentDamages,environmentKills, playerHeals, defeatedPlayers, xpCollected, expiredOrbIds: expiredOnlyOrbIds, spawnedRewardOrbs, sideEncounter, eventEnded, sendSnapshot, sendReliableSnapshot, sendPlayers, sendOrbSnapshot,
    tickCount: world.tickCount, elapsed: world.elapsed, stalePositionAttackSkips: world.stalePositionAttackSkips || 0
  };
}

function currentDepthEvent(world) {
  if (!world || !world.activeEventId || !(Number(world.eventEndsAt) > Number(world.elapsed))) return null;
  const config = ExpeditionRules.eventConfig(world.activeEventId);
  if (!config) return null;
  return {
    id: config.id,
    name: config.name,
    subtitle: config.subtitle,
    accent: config.accent,
    serial: Number(world.eventSerial) || 0,
    startedAt: Math.max(0, Number(world.eventEndsAt) - Number(config.duration || 0)),
    endsAt: Number(world.eventEndsAt) || 0,
    remaining: Math.max(0, (Number(world.eventEndsAt) || 0) - (Number(world.elapsed) || 0))
  };
}

function startDepthEvent(world, random = Math.random) {
  if (!world) return null;
  const eventId = ExpeditionRules.chooseEvent(random, world.bossesDefeated);
  if (!eventId) return null;
  const config = ExpeditionRules.eventConfig(eventId);
  if (!config) return null;
  world.activeEventId = eventId;
  world.eventEndsAt = (Number(world.elapsed) || 0) + Math.max(1, Number(config.duration) || 1);
  world.eventSerial = (Number(world.eventSerial) || 0) + 1;
  return currentDepthEvent(world);
}

function resetWorldState(world, now = Date.now()) {
  const fresh = createWorldState(now, world?.mode);
  for (const key of Object.keys(world || {})) delete world[key];
  Object.assign(world || {}, fresh);
  return world;
}

module.exports = { MAX_ENEMIES, MAX_BOSSES, MAX_COMMON_ENEMIES, createWorldState, initializeWorld, seedRiftEncounters, activateRiftEncounters, spawnEnemy, spawnXpOrb, spawnRewardOrb, tickWorld, resetWorldState, countBosses, countCommons, forceAdvanceEnemy, contactGeometry, currentDepthEvent, startDepthEvent, mapLayoutFor, chooseDensitySpawnRoom };
