# AFTERGLOW — A City Made of Feelings

*When the city feels what you feel.*

A 90-second interactive music video rendered live in the browser with **p5.js 1.11.11 (WEBGL 2)**
and the **Web Audio API**. A procedurally generated cyberpunk megacity collapses and recovers with a
young woman's heartbreak, and ends with her flying through the city into the sunrise.

Static site: no build step, no backend, no API keys. Runs on GitHub Pages.

---

## Run it locally

```bash
cd afterglow
python3 -m http.server 8000        # or: npx serve .   or VS Code "Live Server"
# open http://localhost:8000 in Chrome
```

Use a local server rather than double-clicking `index.html`: browsers block image loading for
WebGL textures from `file://`, and Voice Mode needs `http://localhost` or HTTPS.

**Optional soundtrack:** put an original track at `assets/audio/soundtrack.mp3`. Without it, a
generative score plays (one harmless `404` for that file appears in the console).

## Deploy to GitHub Pages

1. Create a public repository and upload the **contents** of this folder so `index.html` is at the
   root (keep the hidden `.nojekyll` file).
2. **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.**
3. After 1–2 minutes open `https://<you>.github.io/<repo>/` and run `docs/TESTING_CHECKLIST.md`.

All paths are relative, p5.js is bundled in `lib/`, shaders are JS strings (no `fetch`), and Pages
serves HTTPS, so Voice Mode works there.

---

## The film (90 s)

| Time | Chapter | She | The city | Sound |
|---|---|---|---|---|
| 0–15 | **01 Numbness** | lies curled up, breathing (A) | dark, slow rain | rain, distant hum |
| 15–32 | **02 Fracture** | flinches on each impact; pushes up (A → I) | five impacts: lights die in waves, towers split, fragments fly, lightning | deep impacts, glitches, thunder |
| 32–48 | **03 Awakening** | sits up, then kneels looking up (I → B → C) | one light, then a pulse through the streets | first melodic tones |
| 48–65 | **04 Reclaiming Self** | sits facing the skyline, stands, lifts off, levitates (H → J → D* → E) | towers reassemble with gold seams; the fallen sign reads STILL HERE | warm harmony, heartbeat |
| 65–90 | **05 Afterglow** | flies between towers (G, side pass F), climbs into the cloud | luminous pink/violet/cyan cloud, sunrise, AFTERGLOW title | climax at 71 s, cloud swell at 81 s, sunrise chord |

\* D is staged with J rising off the roof, because the supplied D file is a copy of C (see below).

Pose changes never stretch an image to fake joint motion: they happen as glowing cross-dissolves,
behind camera cuts, or under light flashes. Code adds breathing, flinches, floating, banking, the
aura, a speed-dependent light trail, sparkles, streaks and the cloud.

The story always progresses on its own. Voice or mouse input only enhances it.

---

## Controls

| Input | Action |
|---|---|
| **Enter Experience** | starts sound and film (browser autoplay rules) |
| `Space` / ▶ | play / pause · `R` / ↺ replay · `←` `→` seek 5 s |
| `1`–`5` / chapter chips | jump to a chapter |
| Timeline | click or drag to seek |
| `M` / speaker · slider | mute · volume |
| `V` / mic | Voice Mode (optional; asks permission only when switched on) |
| `C` / menu | camera mode · `N` new city · `F` fullscreen · `H` hide UI · `Q` quality · `?` help |
| Mouse move / drag / wheel | parallax / orbit / zoom (limited in close-ups and narrow flythroughs) |
| Hold the mouse still or `L` | “send light”: the no-microphone version of a sustained sound |

**Voice mapping** (loudness, brightness and duration only; no emotion detection, nothing recorded):
loud bursts → extra instability and glitching (strongest in Fracture) · a steady hum → light spreads
faster in Awakening and Reclaiming, and can bring the first light a little early · pitch → colour of
the returning light · silence → softer rain and slower breathing.

---

## Character assets — IMPORTANT

The ten poses live in `assets/character/`. The browser checks each image it loads and lists the
result under **Help → Character assets**. Audit of the supplied files
(`python3 tools/audit_character_assets.py`):

| Pose | File | Status |
|---|---|---|
| A | `A_lying.png` | ✅ real transparency |
| I | `I_pushing_up.png` | ✅ real transparency · low resolution (820×647), soft in close-ups |
| H | `H_sitting_back.png` | ✅ real transparency · low resolution (660×657) |
| J | `J_standing_back.png` | ✅ real transparency · low resolution (503×680) |
| B | `B_sitting.png` | ⚠️ **baked-in checkerboard**: no real transparency |
| C | `C_kneeling.png` | ⚠️ **baked-in checkerboard** |
| D | `D_liftoff.png` | ⚠️ **byte-identical copy of `C_kneeling.png`** (and a checkerboard) |
| E | `E_levitating.png` | ⚠️ **baked-in checkerboard** |
| F | `F_flying_side.png` | ⚠️ **baked-in checkerboard** |
| G | `G_flying_back.png` | ⚠️ **baked-in checkerboard** |

The checkerboard files are **reported, never treated as transparent.** So the film still works, it
uses provisional cut-outs in `assets/character/keyed/`, made with `tools/key_checkerboard.py`. The
tool keys on the checker's texture rather than its colour, so her platinum hair stays intact. Faint
checker residue can remain inside the soft glow around her, visible in close-ups. The original files
are kept untouched.

**To fix properly:** re-export B, C, E, F, G with real alpha, plus a real D (back view, feet leaving
the ground). Drop them into `assets/character/` under the same names and set each pose's `src` back
to that name in `assets/character/manifest.js`. No other code changes are needed. Full specification:
`docs/CHARACTER_ASSETS.md`.

---

## Implemented

- Procedural city (unchanged): ~1,150 buildings in 5 styles, damage and fragments, neon atlas,
  holograms, traffic, rain, fog, bloom and colour grade; any seed via `#seed=`.
- Image-based character on textured planes, replacing the procedural mannequin:
  - transparency kept, with depth-correct placement on the roof and a contact shadow
  - lit by the scene and the fog
  - plane orientation per pose, with camera angles restricted so the flat image is never seen edge-on
  - browser-side transparency/checkerboard check, and a silhouette fallback for missing images
- Five-chapter, 90-second timeline with matching sound design; MP3 or generative score.
- Flight: a spline built from the generated city, checked against every building's bounding box.
  Speed is integrated from a profile, so seeking is exact. The chase camera is protected from
  clipping through towers, and mouse offsets are limited in narrow gaps.
- Speed-dependent light trail, sparkles, screen streaks, luminous particle cloud, sunrise, title reveal.
- Play/pause, replay, seek, chapter chips, mute and volume, fullscreen, camera modes, new city,
  adaptive quality, optional voice. Every chapter renders correctly after a direct seek.

## Limitations / known issues

- Six character files have baked checkerboards (above); the provisional cut-outs are not as clean as
  real alpha. D is missing.
- I, H and J are low resolution and look soft in close-ups.
- The character is a set of still images: no hair or fabric animation beyond code-driven float, sway
  and light. Optional frame sequences are described in `docs/CHARACTER_ASSETS.md` (not yet wired).
- Tested in headless Chrome without a GPU, which covers loading, controls, every chapter and the
  denied-microphone path. **Real-GPU frame rate, the audio mix, and a real microphone still need
  checking in Chrome on your Mac** (`docs/TESTING_CHECKLIST.md`).

p5.js © the Processing Foundation, LGPL-2.1 (bundled in `lib/`). All geometry, sound and music are
generated in code; character artwork supplied by the project author.
