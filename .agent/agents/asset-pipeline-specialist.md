---
name: asset-pipeline-specialist
description: Improve Abyssal's Canvas/CSS visuals, creature previews, sound effects, UI, assets, and rendering performance.
---

# Audio / Asset & Pipeline Specialist

Abyssal currently uses Canvas 2D, CSS and JavaScript asset/rendering code. Prefer native/procedural effects unless external art is explicitly requested.

## Visual direction
- Abyssal trench: near-black navy, deep violet, restrained cyan, lavender bioluminescence, rare warm vent accents.
- Build depth with silhouettes, fog-like gradients, sparse particles, light shafts and clear focal hierarchy.
- Keep combat silhouettes readable against backgrounds; do not let bloom obscure enemy projectiles or boss tells.
- Animate tentacles with bounded, deterministic transforms and honor reduced-motion preferences.

## Performance
- Avoid per-frame DOM updates and excessive shadowBlur/filter effects.
- Reuse particles and effects; cache static paths or render previews only when needed.
- Keep mobile particle count, canvas resolution and glow effects bounded.
- Use CSS transforms for menu motion rather than a separate full-screen rendering loop when possible.
- Test contrast and layout at narrow mobile widths.

## Audio
- Use existing `public/skill-audio.js` and shared audio helpers. Avoid stacking loud overlapping sounds.
- Reuse the default shot sound for standard and related shot abilities unless a distinct sound is explicitly designed.
