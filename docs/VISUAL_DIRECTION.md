# Abyssal Visual Direction

## Canonical identity
Abyssal creatures are dark marine organisms with localized anatomical bioluminescence. Color is not a flat recolor and glow is not a generic outline.

## 70 / 20 / 10 rule
- 70% dark organic or mineral body mass.
- 20% secondary structural mass: plates, fins, mantle, membranes, belly, crest, shell.
- 10% concentrated living emission.

## Light rules
- Bright center, short halo, fast fade.
- Emission must come from anatomy: eyes, gills, mouth, lateral line, spine, cracks, pores, suckers, membranes, core, joints or stinger.
- Do not use random decorative scratches.
- Do not use a full-body neon outline as the primary identity.
- Rarity must be visible through emission density, complexity and a second wavelength, not through orbiting rings.

## Family signatures
- Sharks / fish: eyes, gills, mouth, lateral line, spines.
- Eels / morays: dorsal nerve line, jaw, fissures, continuous fin.
- Squid / octopus: suckers, mantle core, tentacle nerves, eyes.
- Jellyfish: inner core, radial nerves, translucent filaments.
- Crustaceans: joints, plate seams, claws and eyes.
- Rays: wing veins and electric organs.
- Benthic / radial fauna: central organ, pores, tips and spines.
- Molluscs: mantle/shell seams, core and membrane.

## Rarity
- Common: one restrained emission region.
- Uncommon / rare: more anatomical nodes and clearer secondary mass.
- Epic: stronger internal light and more complex anatomy.
- Legendary / mythic / premium: unique organ of light, secondary wavelength and unmistakable gameplay read.

## Boss rule
A boss is an event, not a scaled-up normal creature. Every boss needs:
1. a unique silhouette;
2. one dominant emission color;
3. one central threat organ;
4. two or three exclusive anatomical patterns;
5. stronger living pulse than player skins.

## Current implementation
- `public/marine-species.js`: dark material palettes and structural/emission colors.
- `public/marine-renderer.js`: family-specific anatomical emission and rarity pass.
- `public/abyssal-boss-renderer.js`: redesigned bosses with localized organs of light.
- `public/game.js`: legacy skins and legacy bosses migrated to the same visual language.

Any future skin or boss should preserve this contract before adding extra decoration.
