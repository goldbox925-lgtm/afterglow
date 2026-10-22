/* =====================================================================
   Flight — her path through the city in Chapter 05.
   ---------------------------------------------------------------------
   The path is a Catmull-Rom spline built FROM THE GENERATED CITY: she
   dives off her rooftop into the street in front of her building, banks
   into the flight avenue (the wide avenue nearest config.city.flightAvenueX),
   races between the towers, then climbs through the luminous cloud and
   out above the skyline into the sunrise.

   Position is a pure function of film time: distance = ∫ speed(t) dt
   (config.flightSpeed), looked up from a table — seeking is exact.
   The path is validated against every building's bounding box; any
   sample that would pass through a tower is lifted above it.
   The same boxes give the chase camera depth-aware collision.
   ===================================================================== */
window.AG = window.AG || {};

AG.Flight = (function () {
  const U = AG.U, V = U.v3;
  const F = { ready: false };
  let samples = [], lengths = [], total = 0;
  let distTable = null, T0 = 41.2, T1 = 63.2, DT = 0.01;
  let boxes = [];

  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [0, 1, 2].map((i) => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
  }

  function insideBox(p, b, m) { return p[0] > b.x0 - m && p[0] < b.x1 + m && p[2] > b.z0 - m && p[2] < b.z1 + m && p[1] < b.top + m && p[1] > -1; }

  function build(info) {
    boxes = info.boxes || [];
    T0 = AG.CONFIG.beats.afterglow.launch; T1 = AG.CONFIG.beats.afterglow.end;
    const H0 = info.hero.H0, fx = info.flightX, sz = info.frontStreetZ;
    const sg = Math.sign(fx) || -1;
    const P = [
      [0.6, H0 + 3.4, -22.6],
      [0.5, H0 - 6, sz + 2],
      [fx * 0.05, 60, sz],
      [fx * 0.35, 42, sz],
      [fx * 0.72, 40, sz],
      [fx - 6 * sg, 40, sz - 8],
      [fx, 41, sz - 55],
      [fx, 42, sz - 140],
      [fx, 44, sz - 220],
      [fx, 110, sz - 285],
      [fx, 250, sz - 325],
      [fx, 390, sz - 375],
      [fx - 12 * sg, 510, sz - 445],
      [fx - 80 * sg, 600, sz - 560],
      [fx - 220 * sg, 650, sz - 760],
      [fx - 450 * sg, 680, sz - 1100],
      [fx - 700 * sg, 700, sz - 1450]
    ];
    // dense samples along the spline
    samples = [];
    const pts = [P[0]].concat(P, [P.at(-1)]);
    for (let i = 1; i < pts.length - 2; i++) {
      for (let k = 0; k < 40; k++) samples.push(catmull(pts.at(i - 1), pts.at(i), pts.at(i + 1), pts.at(i + 2), k / 40));
    }
    samples.push(P.at(-1));
    // validate against buildings: lift anything that would cut through a tower
    let lifted = 0;
    samples = samples.map((s) => {
      for (const b of boxes) if (!b.hero && insideBox(s, b, 3)) { lifted++; return [s[0], b.top + 8, s[2]]; }
      return s;
    });
    if (lifted) console.warn('[AFTERGLOW] flight path lifted over buildings at', lifted, 'samples');
    // smooth after lifting (3 passes) to avoid steps
    for (let pass = 0; pass < 3 && lifted; pass++) samples = samples.map((s, i) => i === 0 || i === samples.length - 1 ? s : V.scale(V.add(V.add(samples.at(i - 1), s), samples.at(i + 1)), 1 / 3));
    lengths = [0];
    for (let i = 1; i < samples.length; i++) lengths.push(lengths.at(i - 1) + V.len(V.sub(samples.at(i), samples.at(i - 1))));
    total = lengths.at(-1);
    // distance-from-time table
    const keys = AG.CONFIG.flightSpeed;
    const speedAt = (t) => {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i], k = U.smooth(a[0], b[0], t);
        return U.lerp(a[1], b[1], k);
      }
      return keys.at(-1)[1];
    };
    F.speedAt = speedAt;
    const n = Math.ceil((T1 - T0) / DT) + 1;
    distTable = new Float32Array(n);
    let d = 0;
    for (let i = 1; i < n; i++) { const t = T0 + i * DT; d += speedAt(t - DT * 0.5) * DT; distTable[i] = d; }
    F.cloud = { center: V.add(posAtDist(distAt(AG.AF(82.0))), [0, 12, 0]), radii: [165, 80, 165] };
    F.length = total;
    F.ready = true;
    F.start = P[0];
  }

  function distAt(t) {
    if (!distTable) return 0;
    if (t <= T0) return 0;
    const f = (t - T0) / DT, i = Math.floor(f);
    if (i >= distTable.length - 1) return distTable.at(-1) + (t - T1) * F.speedAt(T1);
    return U.lerp(distTable[i], distTable[i + 1], f - i);
  }

  function indexAt(d) {
    d = U.clamp(d, 0, total);
    let lo = 0, hi = lengths.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lengths[m] <= d) lo = m; else hi = m; }
    return { i: lo, k: (d - lengths[lo]) / Math.max(1e-6, lengths[hi] - lengths[lo]) };
  }
  function posAtDist(d) {
    if (d > total) { const e = samples.at(-1), dir = V.norm(V.sub(e, samples.at(-2))); return V.add(e, V.scale(dir, d - total)); }
    const { i, k } = indexAt(d);
    return V.lerp(samples.at(i), samples.at(Math.min(i + 1, samples.length - 1)), k);
  }
  function fwdAtDist(d) {
    const a = posAtDist(d - 3), b = posAtDist(d + 3);
    return V.norm(V.sub(b, a));
  }

  /* Full flight state at film time t (+ the viewer's steering offset). */
  let clearCache = { d: -1, lat: 0 };
  function state(t) {
    const d = distAt(t);
    let pos = posAtDist(d);
    const fwd = fwdAtDist(Math.max(d, 3));
    const ahead = fwdAtDist(Math.max(d, 3) + 14);
    const right = V.norm(V.cross(fwd, [0, 1, 0]));
    const up = V.norm(V.cross(right, fwd));
    // steering: sideways and up/down inside the avenue, never into a tower
    const IA = AG.Interact, st = IA ? IA.steer : [0, 0];
    let off = [0, 0, 0], latS = 0;
    if (IA && IA.steerActive > 0.001) {
      if (Math.abs(clearCache.d - d) > 2) clearCache = { d, lat: U.clamp(clearance(pos) - 5, 0, 16) };
      latS = st[0] * clearCache.lat;
      const vert = U.clamp(-st[1] * 7, -Math.max(0, pos[1] - 12), 7);
      off = V.add(V.scale(right, latS), [0, vert, 0]);
      pos = V.add(pos, off);
    }
    // bank into turns, and into the viewer's steering
    const turn = V.dot(V.sub(ahead, fwd), right);
    const bank = U.clamp(-turn * 2.4 - st[0] * 0.22 * (IA ? IA.steerActive : 0), -0.4, 0.4);
    const sp = F.speedAt ? F.speedAt(t) : 0;
    return { d, pos, fwd, right, up, bank, speed: sp, speedN: U.clamp(sp / 70, 0, 1), off };
  }

  /* Fraction (0..1) along segment a→b before it enters a building (1 = clear). */
  function segmentClear(a, b, margin) {
    let best = 1;
    const dir = V.sub(b, a);
    for (const bx of boxes) {
      const mn = [bx.x0 - margin, -10, bx.z0 - margin], mx = [bx.x1 + margin, bx.top + margin, bx.z1 + margin];
      let t0 = 0, t1 = 1, ok = true;
      for (let i = 0; i < 3 && ok; i++) {
        if (Math.abs(dir[i]) < 1e-9) { if (a[i] < mn[i] || a[i] > mx[i]) ok = false; }
        else {
          let ta = (mn[i] - a[i]) / dir[i], tb = (mx[i] - a[i]) / dir[i];
          if (ta > tb) { const s = ta; ta = tb; tb = s; }
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) ok = false;
        }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }

  /* Horizontal distance from p to the nearest building side (for camera limits). */
  function clearance(p) {
    let best = 1e9;
    for (const b of boxes) {
      if (p[1] > b.top) continue;
      const dx = Math.max(b.x0 - p[0], 0, p[0] - b.x1), dz = Math.max(b.z0 - p[2], 0, p[2] - b.z1);
      const dd = Math.hypot(dx, dz);
      if (dd < best) best = dd;
    }
    return best;
  }

  return Object.assign(F, { build, distAt, posAtDist, state, segmentClear, clearance });
})();
