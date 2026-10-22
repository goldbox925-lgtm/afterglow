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

  /* ---------- Film timeline (seconds) ----------------------------------
     A short cinematic opening, then two INTERACTIVE GATES where the story
     waits for the viewer (rain, music and animation keep running), then the
     reclaiming and the steerable flight. Film time stops at a gate until it
     is solved; seeking past a gate solves it automatically.             */
  chapters: [
    { id: 'numbness',   num: '01', title: 'NUMBNESS',        subtitle: 'The City That Stopped',      implemented: true, start: 0,    end: 3, card: false },
    { id: 'fracture',   num: '02', title: 'FRACTURE',        subtitle: 'The Night Everything Broke', implemented: true, start: 3,    end: 15, cardAt: 7.5 },
    { id: 'awakening',  num: '03', title: 'AWAKENING',       subtitle: 'Find the Pulse',             implemented: true, start: 15,   end: 21, card: false },
    { id: 'reclaiming', num: '04', title: 'RECLAIMING SELF', subtitle: 'Bring the City Back',        implemented: true, start: 21,   end: 41.2, cardAt: 22.5 },
    { id: 'afterglow',  num: '05', title: 'AFTERGLOW',       subtitle: 'Becoming the Light',         implemented: true, start: 41.2, end: 63.2 }
  ],
  filmLength: 63.2,

  /* Interactive gates (film time). */
  gates: [
    { id: 'find',    t: 15, loop: 8, title: 'Find the pulse', text: 'Somewhere in the dark city, one light is still alive. Look around (drag) and click it.' },
    { id: 'restore', t: 21, loop: 8, title: 'Bring the city back', text: 'Click the dark towers to restore them.', needed: 5 }
  ],
  interact: {
    findHints: [8, 16, 28, 45],     // s in the gate: brighter pulse · edge arrow · camera drift · light shaft
    restoreHintAfter: 8,            // s without a restore → a ring marks a dark tower
    pulseRadius: 260, pulseDur: 3.6,
    restoreRadius: 72, restoreDur: 2.1,
    clickTolerancePx: 34,
    spotColours: [[1.0, 0.62, 0.3], [1.0, 0.28, 0.72], [0.3, 0.9, 1.0], [0.66, 0.4, 1.0], [1.0, 0.82, 0.45]]
  },

  beats: {
    numbness:  { fadeIn: 1.0 },
    fracture:  { impacts: [3.0, 9.6, 12.4], lightning: [3.02, 9.62, 12.42], loveSignDies: 9.6 },
    awakening: { firstLight: 15 },
    reclaiming:{ rebuildStart: 22, rebuildEnd: 33, stillHere: 27.5, pulseIn: 25 },
    afterglow: { launch: 41.2, climax: 44.2, sideShot: [47.7, 50.7], climb: 51.7, cloud: 54.2, sunrise: 58.2, title: 59.5, end: 63.2 }
  },

  /* ---------- Character pose track -------------------------------------
     t = when the pose becomes the main image. `fade` = cross-dissolve
     seconds; `cut` = hidden behind a camera cut; `flash` = covered by a
     light flash. Images are never stretched to fake joint motion.        */
  poseTrack: [
    { t: 0,    pose: 'A' },                              // lying, low side angle (3 s)
    { t: 3.1,  pose: 'I', fade: 0.35, flash: true },     // lightning: she pushes up
    { t: 4.5,  pose: 'B', cut: true },                   // reverse angle: sitting, hugging her knees
    { t: 5.8,  pose: 'H', cut: true },                   // behind her: looking at the city
    { t: 29.5, pose: 'J', cut: true },                   // she stands at the edge
    { t: 33.0, pose: 'D', fade: 0.9 },                   // lift-off
    { t: 36.0, pose: 'E', fade: 1.0 },                   // levitating
    { t: 41.3, pose: 'G', fade: 0.5, flash: true },      // flight
    { t: 47.8, pose: 'F', fade: 0.35 },
    { t: 50.6, pose: 'G', fade: 0.35 }
  ],

  /* Flight speed profile (film time s, metres per second). Distance along
     the flight path is the integral of this curve, so seeking anywhere
     reproduces the same position. */
  flightSpeed: [[41.2, 0], [42.8, 9], [44.2, 58], [51.7, 62], [53.7, 74], [57.2, 66], [59.2, 38], [63.2, 26]],

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

/* Times below the 05 AFTERGLOW launch were authored on the earlier 90 s
   timeline (launch at 68 s). AG.AF converts those authored values to the
   current timeline, so flight shots stay locked to the flight beats. */
AG.AF = (x) => x - 68 + AG.CONFIG.beats.afterglow.launch;
AG.gateById = (id) => AG.CONFIG.gates.find((g) => g.id === id);
