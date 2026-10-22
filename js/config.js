/* =====================================================================
   AFTERGLOW — configuration
   Everything a director would want to tweak lives here: the 90-second
   film timeline, chapter beats, flight timing, palette, quality tiers
   and asset paths. All paths are RELATIVE so the project works inside a
   GitHub Pages project sub-directory (https://user.github.io/repo/).
   ===================================================================== */
window.AG = window.AG || {};

AG.CONFIG = {
  version: '2.0.0',

  /* ---------- Soundtrack ------------------------------------------------
     Drop an original MP3 at this path. If it is missing (404) or fails to
     decode, the generative score in js/audio/score.js plays instead.
     `offset` = seconds into the MP3 that correspond to film time 0.
     Align your track's drop with beats.afterglow.climax (71 s) and its
     big swell with beats.afterglow.cloud (81 s).                       */
  soundtrack: {
    src: 'assets/audio/soundtrack.mp3',
    offset: 0,
    loadTimeoutMs: 5000
  },

  /* ---------- Film timeline (seconds) — five chapters, 90 s ----------- */
  chapters: [
    { id: 'numbness',   num: '01', title: 'NUMBNESS',        subtitle: 'The City That Stopped',  implemented: true, start: 0,  end: 15 },
    { id: 'fracture',   num: '02', title: 'FRACTURE',        subtitle: 'The Night Everything Broke', implemented: true, start: 15, end: 32 },
    { id: 'awakening',  num: '03', title: 'AWAKENING',       subtitle: 'The First Light',        implemented: true, start: 32, end: 48 },
    { id: 'reclaiming', num: '04', title: 'RECLAIMING SELF', subtitle: 'A City That Listens',    implemented: true, start: 48, end: 65 },
    { id: 'afterglow',  num: '05', title: 'AFTERGLOW',       subtitle: 'Becoming the Light',     implemented: true, start: 65, end: 90 }
  ],
  filmLength: 90,

  /* Interactive threshold before the first light. A sustained sound (or
     holding the mouse / L key) lights the first window early; otherwise it
     happens at `firstLightDefault`. The story never waits for input. */
  firstLight: { windowStart: 30.5, firstLightDefault: 33 },

  beats: {
    numbness:  { fadeIn: 3 },
    fracture:  { impacts: [15.0, 18.5, 22.0, 25.5, 28.5], lightning: [15.05, 22.05, 28.55], loveSignDies: 22 },
    awakening: { firstLight: 33 },
    reclaiming:{ rebuildStart: 50, rebuildEnd: 62, stillHere: 57, pulseIn: 54 },
    afterglow: { launch: 68, climax: 71, sideShot: [74.5, 77.5], climb: 78.5, cloud: 81, sunrise: 85, title: 86.3 }
  },

  /* ---------- Character pose track -------------------------------------
     t = when the pose becomes the main image. `fade` = cross-dissolve
     seconds; `cut` = hidden behind a camera cut; `flash` = covered by a
     light flash. See js/character/characterDirector.js.                */
  poseTrack: [
    { t: 0,    pose: 'A' },
    { t: 28.7, pose: 'I', fade: 0.5, flash: true },
    { t: 37.6, pose: 'B', fade: 1.4 },
    { t: 43.6, pose: 'C', fade: 1.4 },
    { t: 48.0, pose: 'H', cut: true },
    { t: 55.4, pose: 'J', fade: 1.2 },
    { t: 59.4, pose: 'D', fade: 0.9 },
    { t: 62.4, pose: 'E', fade: 1.0 },
    { t: 68.1, pose: 'G', fade: 0.5, flash: true },
    { t: 74.6, pose: 'F', fade: 0.35 },
    { t: 77.4, pose: 'G', fade: 0.35 }
  ],

  /* Flight speed profile (film time s, metres per second). Distance along
     the flight path is the integral of this curve, so seeking anywhere
     reproduces the same position. */
  flightSpeed: [[68, 0], [69.6, 9], [71.0, 58], [78.5, 62], [80.5, 74], [84, 66], [86, 38], [90, 26]],

  /* ---------- Palette --------------------------------------------------- */
  palette: {
    blue: [0.18, 0.55, 1.00], cyan: [0.15, 0.95, 1.00], magenta: [1.00, 0.16, 0.66],
    violet: [0.55, 0.25, 1.00], amber: [1.00, 0.62, 0.25], gold: [1.00, 0.78, 0.42]
  },

  /* ---------- City generation ------------------------------------------ */
  city: {
    blocks: 13, blockSize: 58, street: 16, avenueEvery: 4, avenueWidth: 30,
    heroHeight: 92,
    downtown: { x: -120, z: -620, radius: 520 },
    damageRate: 0.36,
    skylineRing: 220,
    flightAvenueX: -190      // the avenue nearest this x becomes her flight canyon
  },

  /* ---------- Quality tiers (auto-adaptive) ----------------------------- */
  quality: {
    tiers: {
      high:     { renderScale: 1.0,  maxDpr: 1.5, rain: 9000, bloomPasses: 2, lens: true,  particles: 1.0 },
      balanced: { renderScale: 1.0,  maxDpr: 1.0, rain: 6000, bloomPasses: 1, lens: true,  particles: 0.8 },
      low:      { renderScale: 0.72, maxDpr: 1.0, rain: 3000, bloomPasses: 1, lens: false, particles: 0.5 }
    },
    order: ['low', 'balanced', 'high'],
    initial: 'balanced',
    targetFps: 50,
    adaptive: true
  }
};
