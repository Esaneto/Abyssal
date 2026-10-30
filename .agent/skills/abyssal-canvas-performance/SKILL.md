---
name: abyssal-canvas-performance
description: Diagnose and optimize Abyssal Canvas rendering, particle effects, menu animation and frame-time spikes.
---

# Canvas Performance Skill

## Profile before changing
Capture a repeatable scenario and record frame time, active enemies, projectiles, effects, particles and boss count. Separate CPU simulation from rendering and network update costs.

## Guidelines
- Reuse arrays and buffers in frame loops; prefer squared-distance comparisons where exact distance is unnecessary.
- Reuse spatial indexes for nearby collision candidates.
- Bound particle bursts, effect lifetimes and glow layers.
- Cache static geometry and avoid repeated layout reads or DOM writes inside the game loop.
- Reduce shadows, particle count and canvas resolution on low-power/mobile modes.
- Avoid arbitrary timeouts as a substitute for deterministic simulation.
- Keep a visual comparison and measure frame time before claiming a win.

## Validation
Stress test several bosses and many projectiles, test low-power mode and mobile layout, and compare median plus p95 frame times.
