# AFTERGLOW — A City Made of Feelings

*When the city feels what you feel.*

An interactive music video rendered live in the browser with **p5.js 1.11.11 (WEBGL 2)**
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

## The experience

About a minute of film, plus the time you take in the two interactive stages. Film time
**stops** at each stage until you act; rain, music and animation keep running.

| Film time | Chapter | What happens |
|---|---|---|
| 0–3 s | **01 Numbness** | She lies on the wet roof: one low side-angle shot (never from above), contact shadow. |
| 3–7 s | **02 Fracture** | Lightning: she pushes up (I). Cut to the reverse angle: sitting, hugging her knees (B). Cut behind her: she looks at the city (H). A rain gust and the flash cover the pose changes. |
| 7–15 s | 02 Fracture | The camera pulls away over the broken city to the viewing position. |
| **15 s** | **03 Awakening — FIND THE PULSE** | One window in the dark city is still alive. Look around (drag / arrows / wheel) and **click it**. It is placed per city, off the first view. Hints build up: a brighter pulse (8 s), an arrow at the screen edge (16 s), a gentle camera drift (28 s), a light shaft (45 s). Clicking it sends a light shockwave through the towers around it, with a musical answer. |
| **21 s** | **04 Reclaiming — BRING THE CITY BACK** | **Click five dark towers.** Each lights up in its own colour: windows ignite, signs power on, broken pieces come home with seams. Pressing and holding on a tower, or pointing and holding a steady sound, also works. After 8 s without a restore, a ring marks a dark tower. |
| 21–41 s | 04 Reclaiming | The rest of the city follows from your five; STILL HERE; she stands, rises and levitates. |
| 41–63 s | **05 Afterglow** | She flies between the towers, and **you steer**: mouse position, arrow keys or WASD, limited by the space to the nearest towers. Then the cloud, the sunrise and the title. |

Everything you restore stays lit, in your colours, until you replay. Seeking past a stage
completes it with default choices; seeking back before a stage re-arms it. Chapter buttons 03 and 04
land exactly on their stage.

The pose changes in the opening use editing, not image distortion: a flash, a rain gust and two
cuts between compatible poses. B is shown from the city side, a reverse angle, then H from behind,
so the cut reads as "she turned to face the city".

---

## Controls

| Input | Action |
|---|---|
| **Enter Experience** | starts sound and film (browser autoplay rules) |
| **Find the pulse** | drag, arrow keys or wheel to look around; **click** the pulsing window (or press Enter when it is near the centre) |
| **Bring it back** | **click** dark towers (5), or press and hold on one, or point at one and hold a steady sound (Voice Mode) or `L` |
| **The flight** | move the mouse, or use the arrow keys / WASD, to steer her |
| `Space` / ▶ | play / pause · `R` / ↺ replay · `←` `→` seek 5 s (outside the interactive parts) |
| `1`–`5` / chapter chips | jump to a chapter (03 and 04 stop at their stage) |
| Timeline | click or drag to seek; the pink diamonds mark the two stages |
| `M` / speaker · slider | mute · volume |
| `V` / mic | Voice Mode (optional; asks permission only when switched on) |
| `C` / menu | camera mode · `N` new city · `F` fullscreen · `H` hide UI · `Q` quality · `?` help |
| Mouse move / drag / wheel | parallax / orbit / zoom elsewhere (limited in close-ups and narrow flythroughs) |

**Voice mapping** (loudness, brightness and duration only; no emotion detection, nothing recorded):
loud bursts → extra instability and glitching (strongest in Fracture) · a steady sound while pointing
at a dark tower restores it, and speeds the light in Reclaiming · pitch → colour of the returning
light · silence → softer rain and slower breathing. Voice is optional: everything works with the mouse.

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

- The procedural city, renderer, character assets and audio from the previous build, unchanged in
  substance.
- **New opening:** 3 s lying shot from a low side angle, a two-layer contact shadow, poses sunk 2–3 cm
  into the roof; awake by 5.8 s and looking at the city by 7 s; a curved crane reveal from 7 to 15 s.
- **Interactive gates** in the timeline. Film time holds while an animation clock keeps rain,
  traffic, flicker and hints alive. The music loops a searching passage (find) or the rising melody
  (restore); an MP3 soundtrack loops the 8 s before the gate.
- **Find the pulse:**
  - the window is chosen per city on a real tower facade, visible from the viewing position and
    off the first view
  - picked by a real click (screen-space tolerance that widens with each hint) or Enter
  - four hint levels; shockwave, light, sound
- **Restore:**
  - real ray picking against building boxes
  - five coloured, persistent restoration areas: windows ignite room by room, signs power on,
    fragments come home with seams, in the shaders via up to 8 "spots"
  - counter dots; press-and-hold and voice alternatives; a hint ring
- **Steerable flight:** sideways and vertical offset from mouse or keys, limited by building
  clearance; she banks into your steering; the chase camera stays clear of towers.
- Every chapter works after a direct seek; replay resets all choices; a new city gets a new pulse.

## Limitations / known issues

- Six character files still have baked checkerboards; provisional cut-outs are used (see below). D is
  missing.
- Restorations persist for the current playthrough only (not saved between visits).
- The MP3 gate loop jumps back 8 s, and the jump is audible unless the track is written with a
  loopable bar before 15 s and 21 s. The generative score loops seamlessly.
- Tested in headless Chrome without a GPU (about 1 fps). Covered: the opening shots, both gates with
  real mouse clicks, keyboard steering, hints, seeking, replay, new city and the denied-microphone
  path. **Real-GPU frame rate, the audio mix and timing, a real microphone, and how easy the pulse is to
  find by eye still need checking in Chrome on your Mac.**

p5.js © the Processing Foundation, LGPL-2.1 (bundled in `lib/`). All geometry, sound and music are
generated in code; character artwork supplied by the project author.
