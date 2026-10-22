/* =====================================================================
   Utilities: seeded randomness, easing, small vector/matrix helpers
   and a tiny event bus used to keep audio and visuals in sync.
   ===================================================================== */
window.AG = window.AG || {};

(function () {
  const U = {};

  /* ---------- Seeded RNG (mulberry32) -----------------------------------
     p5's random() is global; the city needs an isolated, reproducible
     stream so a seed always produces the same city. */
  U.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    const next = () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      range: (lo, hi) => lo + (hi - lo) * next(),
      int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      gauss: () => (next() + next() + next() - 1.5) / 1.5
    };
  };

  /* Stateless hash -> [0,1). Deterministic functions of time (score,
     glitches) use this so seeking / replay reproduce identical results. */
  U.hash = function (n) {
    let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  };
  U.hash2 = (a, b) => U.hash(a * 57.0 + b * 113.0);

  U.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (e0, e1, x) => { const t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  U.easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  U.easeOut = (t) => 1 - Math.pow(1 - t, 3);
  U.damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  U.fract = (x) => x - Math.floor(x);

  /* ---------- vec3 (plain arrays) ---------- */
  U.v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  };

  /* ---------- mat4 (column-major, WebGL convention) ----------
     We build our own view/projection rather than using p5's camera so
     every shader shares one right-handed, y-up world in metres and we
     can change near/far planes per pass. */
  U.mat4 = {
    perspective(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0
      ]);
    },
    lookAt(eye, target, up) {
      const v = U.v3;
      const z = v.norm(v.sub(eye, target));
      let x = v.cross(up, z);
      if (v.len(x) < 1e-5) x = [1, 0, 0];
      x = v.norm(x);
      const y = v.cross(z, x);
      return new Float32Array([
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        -v.dot(x, eye), -v.dot(y, eye), -v.dot(z, eye), 1
      ]);
    },
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
          o[c * 4 + r] = s;
        }
      return o;
    }
  };

  /* ---------- Event bus ---------- */
  const listeners = {};
  U.on = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); };
  U.emit = (name, data) => { (listeners[name] || []).forEach((fn) => { try { fn(data); } catch (e) { console.warn(e); } }); };

  U.fmtTime = (s) => {
    s = Math.max(0, s);
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + String(r).padStart(2, '0');
  };

  AG.U = U;
})();
