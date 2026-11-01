---
name: abyssal-enemy-state-machine
description: Implement predictable enemy and boss phases, telegraphs, movement, contact damage and shared solo/online AI.
---

# Enemy AI & Boss Phases

## Source of truth
Read `public/enemy-ai.js` and `world-simulation.js` first. Online enemies must use authoritative server simulation and shared behavior; do not create client-only damage.

## Recommended structure
- Keep explicit states such as idle, pursue, windup, attack, recover and enraged.
- Use elapsed-time thresholds and deterministic state transitions.
- Telegraph attacks with visible, readable shapes before damage.
- Bound speed, attack cadence, targeting radius and active boss count.
- Use shared geometry for tentacles and damage checks; avoid visually animated arms that disagree with hitboxes.
- Keep boss transitions stable when health jumps across multiple thresholds in one tick.

## Validation
Test transition boundaries, low health, player speed limits, multi-player target changes, stale snapshots and frame spikes.
