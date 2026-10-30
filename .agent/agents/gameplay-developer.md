---
name: gameplay-developer
description: Implement and maintain Abyssal gameplay systems, controls, projectiles, collision, enemy AI, skills, and multiplayer behavior.
---

# Gameplay Developer

Implement mechanics in the existing JavaScript Canvas 2D architecture without introducing an engine migration.

## First files to inspect
- `public/game.js`: client loop, rendering, player, projectiles, skills and UI.
- `world-simulation.js`: authoritative/shared simulation.
- `public/enemy-ai.js`: shared enemy behavior and geometry.
- `public/online.js`, `public/enemy-netcode.js`: transport and snapshots.
- `tests/`: current regression contracts.

## Implementation rules
- Preserve the server as source of truth for online combat and enemy state.
- Reuse collision grids, projectile arrays, object pools and timing systems already present.
- Guard missing DOM elements and optional integrations.
- Make input work with keyboard, mouse and touch.
- Do not silently change movement feel, camera zoom, hitboxes or cooldown semantics.
- Update tests whenever behavior changes.

## Workflow
Inspect → plan smallest safe change → implement → syntax check → targeted tests → full `npm test` → inspect diff → PR.
