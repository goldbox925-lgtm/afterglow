# Character assets — specification

All files go in `assets/character/`. `assets/character/manifest.js` says which file each pose uses
(`src`), how big she is in the world (`size`, metres), how the image is anchored, and how the plane
may turn toward the camera.

## File requirements

- **PNG-32 with a real alpha channel.** Not an RGB image with a grey/white checkerboard painted
  behind her: the browser detects that, reports it in Help → Character assets, and refuses to treat
  it as transparent.
- Nothing baked around her: no background colour and no outer glow. The film draws her aura,
  sparkles and trail in code.
- Leave a margin of ~40 px; hair and fabric should not touch the edges.
- Same identity, outfit, boots and hair colour in every pose, with soft neutral-to-cool lighting so
  the scene can tint her.
- Anchor: standing, sitting and kneeling poses have boot soles on the bottom edge; the lying pose
  rests her body on the bottom edge; flight poses are centred.

| Pose | File | Content | Recommended size (px) |
|---|---|---|---|
| A | `A_lying.png` | lying curled on her side, head on her arm | 2400 × 1200 |
| I | `I_pushing_up.png` | pushing up on one arm | 2000 × 1400 |
| B | `B_sitting.png` | sitting, hugging her knees, head down | 1600 × 1800 |
| C | `C_kneeling.png` | kneeling, head tilted back, looking up | 1400 × 2000 |
| H | `H_sitting_back.png` | sitting, seen from behind, looking at the skyline | 1600 × 1800 |
| J | `J_standing_back.png` | standing at the roof edge, back view | 1000 × 2200 |
| D | `D_liftoff.png` | back view, feet just leaving the ground | 1100 × 2200 |
| E | `E_levitating.png` | facing camera, arms open, eyes closed, floating | 1600 × 2200 |
| F | `F_flying_side.png` | flying flat, side view (facing right) | 2400 × 1200 |
| G | `G_flying_back.png` | flying away from the camera, arms out | 1600 × 1800 |

## Current status of the supplied files

| Pose | Problem | What the film does now |
|---|---|---|
| B, C, E, F, G | baked-in checkerboard, no real alpha | uses provisional cut-outs from `keyed/` |
| D | byte-identical copy of C | stages lift-off with J rising off the roof |
| I, H, J | low resolution | used as-is; camera keeps them mid-distance |

## Replacing a file

1. Save the corrected PNG in `assets/character/` under the pose's name, e.g. `G_flying_back.png`.
2. In `manifest.js`, set that pose's `src` back to the file name, e.g. `src: 'G_flying_back.png'`.
   For D: `src: 'D_liftoff.png'`.
3. Reload. Help → Character assets should show **ok** for it.
4. Optional check before uploading: `python3 tools/audit_character_assets.py`.

## Provisional cut-outs (`tools/key_checkerboard.py`)

`python3 tools/key_checkerboard.py in.png out.webp --preview check.png`

A colour key fails on this character because her platinum hair is as neutral as the checkerboard.
This tool keys on the checker's **texture** instead:
1. It finds flat ~10 px tiles at the two measured grey levels, connected to the border.
2. It detects the pattern's 2D periodicity with quadrature filters, so enclosed gaps (between legs
   and fabric) are found too.
3. It predicts the tile phase a few tiles under the subject and subtracts it.
4. It un-mixes the glow against the average tile grey.

Residue can remain inside wide painted glows. Real alpha is always better.

## Optional: frame sequences (planned, not yet wired)

Short loops would bring hair and fabric to life in the longest shots:
`G_flying_back/0001–0012.png` (12 fps), `E_levitating/0001–0008.png`, `F_flying_side/0001–0008.png`,
each frame with the same canvas size and anchor as the still.
