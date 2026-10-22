/* =====================================================================
   Restoration — the city's persistent memory of what the viewer did.
   ---------------------------------------------------------------------
   THE FIELD. A 512×512 image covering the whole city from above (xz).
   Every light the viewer brings back is a SOURCE: a disc with a colour,
   a strength and a radius that grows over a few seconds. Sources are
   painted into the field with a per-channel "lighten" composite, so the
   field always holds the brightest light that ever reached each place.
   Shaders read it with one texture lookup:
       restoration L = max(r, g, b)        colour = rgb / L
   (every palette colour has a channel at 1.0, so the colour survives).
   L drives everything physical and visual per building: windows ignite,
   signs power on, facade holes close, fragments come home, seams glow.

   Nothing is ever regenerated: geometry stays, only the field changes,
   and only on frames where a source is still growing.

   WAVES. The 8 most recent growing sources are also sent as uniforms
   (centre, radius, colour, front) so a bright front can sweep across
   facades as the light travels.

   PROGRESS. The field is sampled at every building around her: overall
   progress = the size-weighted share of restored buildings. It also
   yields district activation (250 m cells) and window illumination.
   ===================================================================== */
window.AG = window.AG || {};

AG.Restoration = (function () {
  const U = AG.U, V = U.v3;
  const SIZE = 512;
  const R = {
    sources: [], progress: 0, districts: 0, districtsTotal: 0, buildingsLit: 0, buildingsTotal: 0,
    fieldBox: [0, 0, 1], image: null, version: 0
  };
  let p = null, info = null, ctx = null, cands = [], dirty = true, statsClock = 0, pixels = null;

  function init(inst, inf, centre) {
    p = inst; info = inf;
    const E = (info.extent || 1100) + 320;
    R.fieldBox = [-E, -E, 2 * E];
    if (!R.image) {
      R.image = p.createImage(SIZE, SIZE);
      ctx = R.image.drawingContext || R.image.canvas.getContext('2d');
    }
    // buildings that count toward progress: the city she looks at (front ±110°, ≤ 1 km)
    cands = [];
    info.boxes.forEach((b) => {
      if (!b.building || b.top < 22) return;
      const d = Math.hypot(b.cx - centre[0], b.cz - centre[2]);
      if (d > 1000) return;
      if (Math.abs(Math.atan2(b.cx - centre[0], -(b.cz - centre[2]))) > 1.92) return;   // the city in front of her
      cands.push({ x: b.cx, z: b.cz, w: Math.sqrt(b.top) * (1 + 0.5 * (d < 500)), cell: Math.floor((b.cx + 1200) / 250) + 100 * Math.floor((b.cz + 1200) / 250) });
    });
    R.buildingsTotal = cands.length;
    R.districtsTotal = new Set(cands.map((c) => c.cell)).size;
    reset();
  }

  function reset() { R.sources = []; dirty = true; R.progress = 0; R.districts = 0; R.buildingsLit = 0; redraw(0); stats(); }

  /* add a light source. strength < 1 = a limited restoration (Fracture). */
  function add(src) {
    const s = Object.assign({ R: 70, dur: 2.2, strength: 1, col: [1, 0.8, 0.6], y: 40, front: 1, kind: 'node' }, src);
    if (s.auto) s.t0 = -1e9;
    R.sources.push(s); dirty = true;
    return s;
  }
  const radius = (s, at) => s.R * U.easeOut(U.clamp((at - s.t0) / s.dur, 0, 1));
  const growing = (s, at) => at - s.t0 < s.dur;

  function toPx(x, z) { const [x0, z0, S] = R.fieldBox; return [(x - x0) / S * SIZE, (z - z0) / S * SIZE]; }

  function redraw(at) {
    if (!ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.globalCompositeOperation = 'lighten';
    const S = R.fieldBox[2];
    for (const s of R.sources) {
      const r = radius(s, at) / S * SIZE;
      if (r < 0.5) continue;
      const [u, v] = toPx(s.x, s.z);
      const c = s.col.map((k) => Math.round(Math.min(1, k * s.strength) * 255));
      const g = ctx.createRadialGradient(u, v, 0, u, v, r);
      g.addColorStop(0, `rgb(${c})`); g.addColorStop(0.7, `rgb(${c})`); g.addColorStop(1, 'rgb(0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(u, v, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (R.image.setModified) R.image.setModified(true);
    R.version++;
    pixels = null;
  }

  function sample(x, z) {
    if (!pixels) pixels = ctx.getImageData(0, 0, SIZE, SIZE).data;
    const [u, v] = toPx(x, z);
    const i = (Math.max(0, Math.min(SIZE - 1, Math.round(v))) * SIZE + Math.max(0, Math.min(SIZE - 1, Math.round(u)))) * 4;
    return Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) / 255;
  }
  function at(x, z) { return sample(x, z); }

  function stats() {
    let sum = 0, wsum = 0, lit = 0; const cells = new Set();
    for (const c of cands) {
      const L = sample(c.x, c.z);
      sum += Math.min(1, L * 1.1) * c.w; wsum += c.w;
      if (L > 0.5) { lit++; cells.add(c.cell); }
    }
    R.progress = wsum ? sum / wsum : 0;
    R.buildingsLit = lit; R.districts = cells.size;
  }

  function update(dt, animT) {
    const anim = R.sources.some((s) => growing(s, animT));
    if (anim || dirty) {
      redraw(animT); dirty = false;
      statsClock -= dt;
      if (statsClock <= 0 || !anim) { stats(); statsClock = 0.25; }
    }
  }

  /* uniforms: the field + the 8 most recent travelling fronts */
  const uS = new Float32Array(32), uC = new Float32Array(32);
  function uniforms(animT) {
    uS.fill(0); uC.fill(0);
    const live = R.sources.filter((s) => animT - s.t0 < s.dur * 1.3).slice(-8);
    live.forEach((s, i) => {
      const k = U.clamp((animT - s.t0) / (s.dur * 1.3), 0, 1);
      uS[i * 4] = s.x; uS[i * 4 + 1] = s.y; uS[i * 4 + 2] = s.z; uS[i * 4 + 3] = radius(s, animT);
      uC[i * 4] = s.col[0]; uC[i * 4 + 1] = s.col[1]; uC[i * 4 + 2] = s.col[2]; uC[i * 4 + 3] = Math.pow(1 - k, 0.8) * s.front * Math.min(1, s.strength * 1.4);
    });
    return { spots: uS, cols: uC, field: R.image, box: R.fieldBox };
  }

  return Object.assign(R, { init, reset, add, update, uniforms, at, radius, SIZE });
})();
