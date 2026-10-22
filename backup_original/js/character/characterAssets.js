/* =====================================================================
   Character assets — loading, verification, fallbacks.
   ---------------------------------------------------------------------
   Every pose image is loaded with p5.loadImage (relative path, so it works
   on GitHub Pages) and checked in the browser:
     · does it have real transparency?
     · does it look like a baked-in checkerboard (RGB pixels painted grey/
       white)? Such an image is REPORTED and NOT treated as transparent:
       the pose falls back to a stylised silhouette instead.
     · where is the subject? (alpha bounding box → correct scale & anchor)
   A small copy is made for distant shots so far-away planes don't shimmer
   (p5 1.x textures have no mipmaps).
   If a file is missing or broken, an elegant silhouette is drawn in code.
   ===================================================================== */
window.AG = window.AG || {};

AG.CharacterAssets = (function () {
  const C = { poses: {}, loaded: 0, total: 0, firstReady: false };
  let p = null;
  const CATEGORY = { A: 'lying', I: 'lying', B: 'sitting', C: 'sitting', H: 'sitting', J: 'standing', D: 'standing', E: 'standing', F: 'flying', G: 'flying' };

  function analyse(img) {
    const W = img.width, H = img.height;
    const s = Math.min(1, 256 / Math.max(W, H));
    const w = Math.max(8, Math.round(W * s)), h = Math.max(8, Math.round(H * s));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img.canvas || img.elt, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let transparent = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = d[(y * w + x) * 4 + 3];
      if (a < 250) transparent++;
      if (a > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const hasAlpha = transparent / (w * h) > 0.01;
    // checkerboard: opaque border made of near-neutral light pixels in two brightness clusters
    let border = 0, neutral = 0, light = 0, grey = 0;
    const visit = (x, y) => {
      const i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      border++;
      if (a < 245) return;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn <= 14 && mn >= 170) { neutral++; const l = (r + g + b) / 3; if (l > 240) light++; else grey++; }
    };
    for (let x = 0; x < w; x++) { visit(x, 0); visit(x, 1); visit(x, h - 1); visit(x, h - 2); }
    for (let y = 0; y < h; y++) { visit(0, y); visit(1, y); visit(w - 1, y); visit(w - 2, y); }
    const checker = !hasAlpha && neutral / border > 0.8 && light / Math.max(1, neutral) > 0.15 && grey / Math.max(1, neutral) > 0.15;
    const bbox = x1 >= 0 && hasAlpha
      ? { u0: x0 / w, v0: y0 / h, u1: (x1 + 1) / w, v1: (y1 + 1) / h }
      : { u0: 0, v0: 0, u1: 1, v1: 1 };
    return { hasAlpha, checker, bbox, W, H };
  }

  function smallCopy(img) {
    const s = Math.min(1, 384 / Math.max(img.width, img.height));
    const g = p.createGraphics(Math.max(4, Math.round(img.width * s)), Math.max(4, Math.round(img.height * s)));
    g.pixelDensity(1); g.clear();
    g.drawingContext.drawImage(img.canvas || img.elt, 0, 0, g.width, g.height);
    return g;
  }

  /* A stylised silhouette drawn in code: dark figure, neon rim. */
  function silhouette(cat) {
    const w = cat === 'lying' || cat === 'flying' ? 768 : 512, h = cat === 'lying' || cat === 'flying' ? 384 : 768;
    const g = p.createGraphics(w, h); g.pixelDensity(1); g.clear();
    const c = g.drawingContext;
    c.fillStyle = 'rgba(14,10,26,0.96)';
    c.shadowColor = 'rgba(255,60,170,0.9)'; c.shadowBlur = 18;
    const ell = (x, y, rx, ry, rot) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); c.fill(); };
    if (cat === 'lying') {
      ell(150, 300, 70, 52); ell(330, 300, 140, 62, 0.04); ell(520, 312, 120, 44, -0.15); ell(650, 330, 70, 30, 0.3);
      c.fillStyle = 'rgba(40,30,60,0.9)'; ell(110, 330, 120, 26, 0.05);
    } else if (cat === 'sitting') {
      ell(256, 230, 70, 80); ell(256, 430, 120, 150); ell(300, 600, 150, 120, -0.3); ell(256, 700, 200, 60);
    } else if (cat === 'standing') {
      ell(256, 120, 60, 72); ell(256, 300, 95, 150); ell(256, 470, 80, 130); ell(226, 640, 34, 110); ell(286, 640, 34, 110);
      c.fillStyle = 'rgba(40,30,60,0.8)'; ell(256, 260, 150, 200);
    } else {
      ell(640, 180, 60, 52); ell(470, 190, 170, 62, -0.05); ell(260, 200, 140, 40, 0.06); ell(110, 205, 80, 26, 0.1);
      c.fillStyle = 'rgba(60,30,80,0.6)'; ell(500, 150, 240, 40, -0.2);
    }
    return g;
  }

  function finalize(id, img, meta) {
    const P = C.poses[id];
    if (img) {
      const a = analyse(img);
      P.W = a.W; P.H = a.H;
      if (a.checker) { P.status = 'checkerboard'; P.message = 'Baked checkerboard detected — not used as transparency; showing a silhouette.'; }
      else if (!a.hasAlpha) { P.status = 'no-alpha'; P.message = 'No transparency — showing a silhouette.'; }
      else {
        P.status = 'ok'; P.tex = img; P.small = smallCopy(img); P.bbox = a.bbox;
        P.message = (Math.max(a.W, a.H) < 900 ? 'Low resolution — fine at a distance, soft in close-ups.' : 'OK');
      }
    } else { P.status = 'missing'; P.message = 'Could not load ' + meta.src + ' — showing a silhouette.'; }
    if (P.status !== 'ok') {
      P.tex = P.small = silhouette(CATEGORY[id]);
      P.bbox = { u0: 0.02, v0: 0.04, u1: 0.98, v1: 0.98 };
      P.fallback = true;
      console.warn('[AFTERGLOW] character pose ' + id + ' (' + meta.src + '): ' + P.message);
    }
    const bw = (P.bbox.u1 - P.bbox.u0) * P.tex.width, bh = (P.bbox.v1 - P.bbox.v0) * P.tex.height;
    P.aspect = bw / bh; // subject width / height
    P.ready = true;
    C.loaded++;
    AG.U.emit('characterAsset', { id, status: P.status });
  }

  function load(inst, firstId) {
    p = inst;
    const M = AG.CHARACTER_MANIFEST;
    const ids = Object.keys(M.poses);
    C.total = ids.length;
    // the opening pose first, the rest afterwards (they are needed later)
    const order = [firstId].concat(ids.filter((i) => i !== firstId));
    const loadOne = (id, done) => {
      const meta = M.poses[id];
      C.poses[id] = { id, meta, ready: false, status: 'loading' };
      p.loadImage(M.base + meta.src, (img) => {
        try { finalize(id, img, meta); } catch (e) { console.warn(e); finalize(id, null, meta); }
        done && done();
      }, () => { finalize(id, null, meta); done && done(); });
    };
    // the opening pose first; then everything else in parallel
    loadOne(firstId, () => {
      C.firstReady = true; AG.U.emit('characterFirstReady');
      order.slice(1).forEach((id) => loadOne(id));
    });
  }

  const temp = {};
  /* While a pose is still downloading, a silhouette stands in for it. */
  function get(id) {
    const P = C.poses[id];
    if (P && P.ready) return P;
    if (!p) return null;
    if (!temp[id]) {
      const t = silhouette(CATEGORY[id] || 'standing');
      temp[id] = { id, tex: t, small: t, bbox: { u0: 0.02, v0: 0.04, u1: 0.98, v1: 0.98 }, aspect: (t.width * 0.96) / (t.height * 0.94), meta: AG.CHARACTER_MANIFEST.poses[id], fallback: true, ready: true, status: 'loading' };
    }
    return temp[id];
  }

  function report() {
    const M = AG.CHARACTER_MANIFEST;
    return Object.keys(M.poses).map((id) => {
      const P = C.poses[id] || {}, m = M.poses[id];
      return { id, name: m.name, src: m.src, original: m.original, status: P.status || 'pending', message: P.message || '', audit: m.audit };
    });
  }

  return Object.assign(C, { load, get, report, analyse });
})();
