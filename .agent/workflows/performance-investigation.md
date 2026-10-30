---
name: performance-investigation
description: Reproducible process for diagnosing Abyssal stutter and frame drops.
---

# Performance Investigation Workflow

1. Record device/browser, solo or online mode, time until slowdown and visible entity counts.
2. Reproduce with a fixed scenario: normal combat, level-up, one boss, multiple bosses, and high projectile density.
3. Separate update/simulation, Canvas draw, particle/effect, network and DOM costs.
4. Inspect allocation-heavy loops and redundant global scans before rewriting systems.
5. Change one bottleneck at a time and retain a baseline.
6. Run correctness tests plus stress scenarios on desktop and mobile.
7. Compare median and p95 frame times, frame drops and peak entity counts.
8. Document improvements and any visual/quality tradeoffs.
