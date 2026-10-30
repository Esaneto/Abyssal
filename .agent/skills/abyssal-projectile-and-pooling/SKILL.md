---
name: abyssal-projectile-and-pooling
description: Add or tune shooter projectiles, spread shots, chain effects, collision checks and pooling in Abyssal.
---

# Projectile & Pooling Skill

## Before editing
Inspect `fire()`, the projectile update loop in `public/game.js`, enemy collision-grid construction, render paths, `world-simulation.js`, online shot events and relevant tests.

## Practical rules
- Define each projectile's damage, velocity, lifetime, radius, color and special behavior in one clear data shape.
- Reuse the existing projectile array and collision grid. Avoid a full scan of every enemy for every projectile when the grid is available.
- Bound pierce, bounce and chain counts; maintain per-projectile hit IDs to prevent duplicate damage.
- For spread fire, normalize total damage per trigger and decide whether each side shot is a full or fractional hit. Avoid accidental multiplicative DPS.
- If online, send all intended shots through the established transport and ensure the server validates damage.
- Recycle objects only if lifecycle/reset semantics can be tested; never reuse a projectile while a reference remains active.

## Validation
Test target acquisition, misses, expiry, boundary cleanup, multiple targets, bosses, level scaling, online synchronization and maximum projectile count.
