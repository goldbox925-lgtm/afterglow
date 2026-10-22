/* =====================================================================
   Character asset manifest — one entry per pose (A–J).
   Loaded as a plain <script> so it works on GitHub Pages AND from file://.

   src       image actually rendered (relative to assets/character/)
   original  the source file you supplied (kept untouched in this folder)
   fit       'width' | 'height' — which side of the subject's alpha bounding
             box is scaled to `size` metres in the world
   anchor    'bottom' = boot soles / body rest on the ground point
             'center' = the subject's centre sits on the anchor point (flight)
   mode      'fixed'  plane stays in the world, may turn ≤ maxTurn° toward camera
             'cyl'    turns to face the camera around the vertical axis only
             'sphere' fully faces the camera (back-view flight, chase camera)
             'side'   plane contains the flight direction (side-view flight)
   audit     what tools/audit_character_assets.py found in the ORIGINAL file
             (the browser re-checks whatever `src` it actually loads)

   To use a corrected re-export: put it here under its original name and
   set `src` back to that file name. The browser will verify it has real
   transparency and report it in Help → Character assets.
   ===================================================================== */
window.AG = window.AG || {};
AG.CHARACTER_MANIFEST = {
  base: 'assets/character/',
  poses: {
    A: { name: 'Lying curled',        src: 'A_lying.png', sink: 0.03,                original: 'A_lying.png',        fit: 'width',  size: 1.70, anchor: 'bottom', mode: 'fixed', maxTurn: 22,
         audit: 'OK — real alpha, 1536×1024. Hair touches the left edge.' },
    I: { name: 'Pushing up',          src: 'I_pushing_up.png', sink: 0.02,           original: 'I_pushing_up.png',   fit: 'width',  size: 1.55, anchor: 'bottom', mode: 'fixed', maxTurn: 22,
         audit: 'OK — real alpha. Low resolution (820×647); avoid tight close-ups.' },
    B: { name: 'Sitting, hugging knees', src: 'keyed/B_sitting.webp', face: Math.PI, sink: 0.02, original: 'B_sitting.png',    fit: 'height', size: 1.02, anchor: 'bottom', mode: 'fixed', maxTurn: 22,
         audit: 'BAKED CHECKERBOARD — RGB file, no alpha. Using a provisional texture-keyed copy (tools/key_checkerboard.py); faint checker residue may remain inside the glow.' },
    C: { name: 'Kneeling, looking up', src: 'keyed/C_kneeling.webp', original: 'C_kneeling.png',    fit: 'height', size: 1.30, anchor: 'bottom', mode: 'fixed', maxTurn: 22,
         audit: 'BAKED CHECKERBOARD — RGB file, no alpha. Using a provisional texture-keyed copy (tools/key_checkerboard.py); faint checker residue may remain inside the glow.' },
    H: { name: 'Sitting, back view',  src: 'H_sitting_back.png', sink: 0.02,         original: 'H_sitting_back.png', fit: 'height', size: 0.98, anchor: 'bottom', mode: 'fixed', maxTurn: 22,
         audit: 'OK — real alpha. Low resolution (660×657); subject touches the left edge.' },
    J: { name: 'Standing, back view', src: 'J_standing_back.png',        original: 'J_standing_back.png', fit: 'height', size: 1.72, anchor: 'bottom', mode: 'cyl',
         audit: 'OK — real alpha. Low resolution (503×680); fabric touches the left edge.' },
    D: { name: 'Lift-off',            src: 'J_standing_back.png',        original: 'D_liftoff.png',      fit: 'height', size: 1.72, anchor: 'bottom', mode: 'cyl',
         audit: 'DUPLICATE — D_liftoff.png is byte-identical to C_kneeling.png (and also has a baked checkerboard). The lift-off is staged with J (standing, back view) rising off the roof.' },
    E: { name: 'Levitating, front',   src: 'keyed/E_levitating.webp', original: 'E_levitating.png', fit: 'height', size: 1.80, anchor: 'center', mode: 'cyl',
         audit: 'BAKED CHECKERBOARD — RGB file, no alpha. Using a provisional texture-keyed copy (tools/key_checkerboard.py); faint checker residue may remain inside the glow.' },
    F: { name: 'Flying, side view',   src: 'keyed/F_flying_side.webp', original: 'F_flying_side.png', fit: 'width', size: 2.2, anchor: 'center', mode: 'side',
         audit: 'BAKED CHECKERBOARD — RGB file, no alpha. Using a provisional texture-keyed copy (tools/key_checkerboard.py); faint checker residue may remain inside the glow.' },
    G: { name: 'Flying, back view',   src: 'keyed/G_flying_back.webp', original: 'G_flying_back.png', fit: 'height', size: 2.2, anchor: 'center', mode: 'sphere',
         audit: 'BAKED CHECKERBOARD — RGB file, no alpha. Using a provisional texture-keyed copy (tools/key_checkerboard.py); faint checker residue may remain inside the glow.' }
  }
};
