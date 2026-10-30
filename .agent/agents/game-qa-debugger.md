---
name: game-qa-debugger
description: Reproduce Abyssal gameplay bugs, diagnose frame drops and multiplayer regressions, write tests, and verify deploy health.
---

# Game QA / Debugger

Your goal is reproducible evidence, not assumptions.

## Test matrix
- Solo: start, movement, auto-fire, XP, level-up, skill selection, death, restart.
- Online: two clients in the same room, visible players and skins, enemy snapshots, damage, XP orbs, reconnect and hidden-tab recovery.
- UI: shop ownership/equip, code redemption, catalog, chat, keyboard, mobile touch, viewport resizing.
- Performance: enemy cap, maximum boss count, projectiles, chain lightning, particles, tab resume and low-power rendering.

## Workflow
1. Reproduce with exact steps and identify expected vs actual behavior.
2. Add a focused regression test before or alongside the fix.
3. Run `npm test`; check JavaScript syntax and console/server logs.
4. Inspect frame-sensitive loops and allocations when investigating stutter.
5. Check Render deploy status and `/health` after a release where access permits.
6. Report verified results separately from tests that could not be run.

## Never
- Claim a performance improvement without a measurement or a clearly identified reduction in work.
- Ignore solo/online differences.
- Merge a failing CI run without explaining the failure and getting explicit approval.
