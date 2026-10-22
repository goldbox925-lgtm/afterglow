/* =====================================================================
   Interact — the viewer's part in the story.
   ---------------------------------------------------------------------
   1. FIND THE PULSE (gate at 15 s)
      One window in the dark city pulses. It is placed, per city, on a
      real tower facade that is visible from the viewing position but
      OFF the initial view, so the viewer has to look around. Clicking it
      sends a light shockwave through the surrounding towers and releases
      the story. Hints escalate if it isn't found: brighter pulse → an
      arrow at the screen edge → a gentle camera drift → a light shaft.
   2. BRING THE CITY BACK (gate at 21 s)
      Each click on a dark tower restores the area around it (windows,
      signs, fragments come home with seams) in one of five colours.
      Five restorations release the story. Pressing and holding on a
      tower, or holding a steady sound while pointing at it, works too.
   3. THE FLIGHT
      Mouse position (or arrow keys / WASD) steers her inside the
      avenue; the offset is limited by the distance to the buildings.

   Restorations are SPOTS: spheres with a growing radius and a colour,
   sent to the city and neon shaders. They persist for the rest of the
   film, so the viewer's choices stay visible, tinted in their colours,
   until replay. Seeking past a gate solves it with default choices;
   seeking back before a gate undoes that gate's spots.
   ===================================================================== */
window.AG = window.AG || {};

AG.Interact = (function () {
  const U = AG.U, V = U.v3, C = AG.CONFIG, IC = C.interact;
  const MAX_SPOTS = 8;
  const I = {
    stage: null, solved: { find: false, restore: false }, spots: [], beacon: null, vantage: null,
    restored: 0, needed: 5, hintLevel: 0, hintTarget: null, beaconScreen: null, steer: [0, 0], steerActive: 0
  };
  let info = null, defaults = [], lastRestoreAt = 0, holdOn = null, holdT = 0;
  const keys = {};
  I.keys = keys;
  const gateRestore = AG.gateById('restore');
  I.needed = gateRestore.needed || 5;

  /* ---------------- setup ---------------- */
  function build(inf) {
    info = inf;
    const lie = AG.CharacterDirector.spots.lie;
    I.vantage = V.add(lie, [3, 10, 27]);
    reset();
    chooseBeacon();
    chooseDefaults();
  }

  function layoutSeed() {
    let s = 0;
    for (const b of info.boxes) s = (s + b.top * 131.7 + b.cx * 7.1) % 1e9;
    return Math.floor(s) || 7;
  }

  function faceToward(b, from) {
    const sh = b.shaft, dx = from[0] - b.cx, dz = from[2] - b.cz;
    if (Math.abs(dx) / sh.w > Math.abs(dz) / sh.d) {
      const sx = Math.sign(dx) || 1;
      return { o: [b.cx + sx * sh.w / 2, 0, b.cz], n: [sx, 0, 0], t: [0, 0, sx], len: sh.d };
    }
    const sz = Math.sign(dz) || 1;
    return { o: [b.cx, 0, b.cz + sz * sh.d / 2], n: [0, 0, sz], t: [-sz, 0, 0], len: sh.w };
  }

  function visibleFrom(a, p, n) {
    return AG.Flight.segmentClear(a, V.add(p, V.scale(n, 2.2)), 0) > 0.999;
  }

  function chooseBeacon() {
    const R = U.rng(layoutSeed());
    const v = I.vantage;
    const tryPick = (angLo, angHi, dLo, dHi) => {
      let best = null, bestScore = 1e9;
      info.boxes.forEach((b, idx) => {
        if (!b.building || !b.shaft || b.shaft.y1 - b.shaft.y0 < 16) return;
        const dx = b.cx - v[0], dz = b.cz - v[2], dist = Math.hypot(dx, dz);
        if (dist < dLo || dist > dHi) return;
        const ang = Math.abs(Math.atan2(dx, -dz)) * 180 / Math.PI;
        if (ang < angLo || ang > angHi) return;
        const F = faceToward(b, v);
        const y = U.clamp(b.shaft.y0 + (b.shaft.y1 - b.shaft.y0) * R.range(0.45, 0.75), b.shaft.y0 + 6, b.shaft.y1 - 5);
        const lat = (F.len / 2 - 4) * R.range(-0.6, 0.6);
        const pos = V.add(V.add([F.o[0], y, F.o[2]], V.scale(F.t, lat)), V.scale(F.n, 0.22));
        if (!visibleFrom(v, pos, F.n)) return;
        const score = Math.abs(dist - 260) + R.next() * 80;
        if (score < bestScore) { bestScore = score; best = { pos, n: F.n, right: F.t, up: [0, 1, 0], idx, dist, yaw: Math.atan2(pos[0] - v[0], -(pos[2] - v[2])) }; }
      });
      return best;
    };
    I.beacon = tryPick(55, 125, 140, 460) || tryPick(35, 150, 100, 650) || tryPick(0, 180, 60, 900);
    if (!I.beacon) {
      const b = info.boxes.find((x) => x.building && x.shaft);
      const F = faceToward(b, v);
      I.beacon = { pos: V.add([F.o[0], b.shaft.y0 + 10, F.o[2]], V.scale(F.n, 0.22)), n: F.n, right: F.t, up: [0, 1, 0], idx: info.boxes.indexOf(b), dist: 0, yaw: 0 };
    }
  }

  function chooseDefaults() {
    const v = I.vantage;
    const cands = [];
    info.boxes.forEach((b, idx) => {
      if (!b.building || b.top < 40) return;
      const dx = b.cx - v[0], dz = b.cz - v[2], dist = Math.hypot(dx, dz);
      if (dist < 110 || dist > 520 || dz > -40) return;
      cands.push({ idx, ang: Math.atan2(dx, -dz), dist, b });
    });
    cands.sort((a, c) => a.ang - c.ang);
    // a spread of five across the view first, then every other candidate as a fallback
    defaults = [];
    for (let k = 0; k < I.needed && cands.length; k++) {
      const target = -0.75 + 1.5 * (k + 0.5) / I.needed;
      let best = null, bd = 1e9;
      for (const c of cands) { const d = Math.abs(c.ang - target) + Math.abs(c.dist - 260) / 600; if (d < bd && !defaults.includes(c)) { bd = d; best = c; } }
      if (best) defaults.push(best);
    }
    cands.slice().sort((a, c) => Math.abs(a.dist - 260) - Math.abs(c.dist - 260)).forEach((c) => { if (!defaults.includes(c)) defaults.push(c); });
  }

  /* ---------------- spots ---------------- */
  function addSpot(c, R, dur, col, gate, at, auto) {
    if (I.spots.length >= MAX_SPOTS) I.spots.shift();
    I.spots.push({ c, R, dur, col, gate, t0: auto ? -1e9 : at });
  }
  function spotRadius(s, at) { return s.R * U.easeOut(U.clamp((at - s.t0) / s.dur, 0, 1)); }
  function spotFront(s, at) {
    const k = (at - s.t0) / s.dur;
    if (k < 0 || k > 1.25) return 0;
    return Math.pow(1 - U.clamp(k / 1.25, 0, 1), 0.8);
  }
  function localAt(p, at) {
    let best = 0;
    for (const s of I.spots) {
      const r = spotRadius(s, at); if (r <= 0) continue;
      const dh = Math.hypot(p[0] - s.c[0], p[2] - s.c[2]), dv = (p[1] - s.c[1]) * 0.35;
      const d = Math.hypot(dh, dv);
      best = Math.max(best, 1 - U.smooth(r * 0.82, r, d));
    }
    return best;
  }
  /* uniform arrays for the shaders */
  const uS = new Float32Array(MAX_SPOTS * 4), uC = new Float32Array(MAX_SPOTS * 4);
  function uniforms(at) {
    uS.fill(0); uC.fill(0);
    I.spots.forEach((s, i) => {
      uS[i * 4] = s.c[0]; uS[i * 4 + 1] = s.c[1]; uS[i * 4 + 2] = s.c[2]; uS[i * 4 + 3] = spotRadius(s, at);
      uC[i * 4] = s.col[0]; uC[i * 4 + 1] = s.col[1]; uC[i * 4 + 2] = s.col[2]; uC[i * 4 + 3] = spotFront(s, at);
    });
    return { spots: uS, cols: uC };
  }

  /* ---------------- solving gates ---------------- */
  function solveFind(auto, at) {
    if (I.solved.find) return;
    I.solved.find = true;
    addSpot(I.beacon.pos.slice(), IC.pulseRadius, IC.pulseDur, [1.0, 0.78, 0.86], 'find', at, auto);
    if (!auto) U.emit('pulseFound', { pos: I.beacon.pos });
    lastRestoreAt = at;
    AG.Timeline.release('find');
  }
  function restoreAt(box, y, at, auto) {
    const col = IC.spotColours.at(I.restored % IC.spotColours.length);
    addSpot([box.cx, y, box.cz], IC.restoreRadius, IC.restoreDur, col, 'restore', at, auto);
    I.restored++;
    lastRestoreAt = at;
    if (!auto) U.emit('restoreHit', { n: I.restored, needed: I.needed, col });
  }
  function solveRestore(auto, at) {
    if (I.solved.restore) return;
    if (auto) {
      for (const d of defaults) {
        if (I.restored >= I.needed) break;
        if (localAt([d.b.cx, d.b.top * 0.5, d.b.cz], 1e9) > 0.5) continue;
        restoreAt(d.b, d.b.top * 0.5, at, true);
      }
    }
    I.solved.restore = true;
    if (!auto) U.emit('restoreDone');
    AG.Timeline.release('restore');
  }
  function unsolve(id) {
    I.solved[id] = false;
    I.spots = I.spots.filter((s) => s.gate !== id);
    if (id === 'restore') I.restored = 0;
  }
  function isSolved(id) { return !!I.solved[id]; }

  function onSeek(t) {
    for (const g of C.gates) {
      if (t > g.t + 0.05) { if (!I.solved[g.id]) (g.id === 'find' ? solveFind : solveRestore)(true, 0); }
      else if (I.solved[g.id]) unsolve(g.id);
    }
  }
  function reset() { I.solved = { find: false, restore: false }; I.spots = []; I.restored = 0; I.hintLevel = 0; I.hintTarget = null; I.steer = [0, 0]; }

  /* ---------------- camera geometry ---------------- */
  function basis(cam) {
    const dir = V.norm(V.sub(cam.target, cam.pos));
    const right = V.norm(V.cross(dir, [0, 1, 0]));
    const up = V.cross(right, dir);
    const th = Math.tan(cam.fov * Math.PI / 360), asp = window.innerWidth / window.innerHeight;
    return { dir, right, up, th, asp };
  }
  function project(p, cam) {
    const B = basis(cam), v = V.sub(p, cam.pos), z = V.dot(v, B.dir);
    if (z <= 0.1) return null;
    const x = V.dot(v, B.right) / (z * B.th * B.asp), y = V.dot(v, B.up) / (z * B.th);
    return { x: (x + 1) / 2 * window.innerWidth, y: (1 - y) / 2 * window.innerHeight, on: Math.abs(x) < 1 && Math.abs(y) < 1, nx: x, ny: y };
  }
  function ray(px, py, cam) {
    const B = basis(cam);
    const nx = px / window.innerWidth * 2 - 1, ny = 1 - py / window.innerHeight * 2;
    return V.norm(V.add(B.dir, V.add(V.scale(B.right, nx * B.th * B.asp), V.scale(B.up, ny * B.th))));
  }
  function pick(px, py, cam) {
    const o = cam.pos, d = ray(px, py, cam);
    let best = null, bt = 1e9;
    info.boxes.forEach((b, idx) => {
      if (!b.building) return;
      const mn = [b.x0, 0, b.z0], mx = [b.x1, b.top - 6, b.z1];
      let t0 = 0, t1 = 1e9;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return; continue; }
        let ta = (mn[i] - o[i]) / d[i], tb = (mx[i] - o[i]) / d[i];
        if (ta > tb) { const s = ta; ta = tb; tb = s; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) return;
      }
      if (t0 < bt) { bt = t0; best = { b, idx, point: V.add(o, V.scale(d, t0)) }; }
    });
    return best;
  }

  /* restore hint: the dark tower nearest the centre of the view that the camera can see */
  let hintClock = 0, hintBox = null;
  const hintPoint = (b) => [b.cx, Math.min(b.top * 0.55, b.top - 10), b.cz];
  function findHintBox(cam, at) {
    const list = [];
    for (const b of info.boxes) {
      if (!b.building || b.top < 35) continue;
      const p = hintPoint(b);
      const sp = project(p, cam); if (!sp || !sp.on) continue;
      if (localAt(p, at + 10) > 0.3) continue;
      list.push({ b, d: Math.hypot(sp.nx, sp.ny) });
    }
    list.sort((x, y) => x.d - y.d);
    for (const c of list.slice(0, 8)) {
      const b = c.b, dx = cam.pos[0] - b.cx, dz = cam.pos[2] - b.cz;
      const sc = Math.min((b.x1 - b.x0) / 2 / Math.max(Math.abs(dx), 1e-3), (b.z1 - b.z0) / 2 / Math.max(Math.abs(dz), 1e-3));
      const L = Math.hypot(dx, dz) || 1;
      const edge = [b.cx + dx * sc + dx / L * 1.5, hintPoint(b)[1], b.cz + dz * sc + dz / L * 1.5];
      if (AG.Flight.segmentClear(cam.pos, edge, 0) > 0.98) return b;
    }
    return null;
  }

  /* ---------------- per frame ---------------- */
  function update(dt, t, at, input, cam) {
    const hold = AG.Timeline.holding;
    I.stage = hold ? hold.id : null;
    const B = C.beats.afterglow;
    const flightOn = t >= B.launch + 1.2 && t < B.climb + 0.4;
    I.beaconScreen = null; I.hintTarget = null;

    if (I.stage === 'find' && I.beacon) {
      const ht = AG.Timeline.holdTime, H = IC.findHints;
      I.hintLevel = ht > H[3] ? 4 : ht > H[2] ? 3 : ht > H[1] ? 2 : ht > H[0] ? 1 : 0;
      const sp = project(I.beacon.pos, cam);
      const vis = sp && visibleFrom(cam.pos, I.beacon.pos, I.beacon.n);
      I.beaconScreen = sp ? Object.assign(sp, { visible: !!vis }) : null;
      const tryHit = (x, y) => {
        if (!sp || !vis) return false;
        return Math.hypot(x - sp.x, y - sp.y) < IC.clickTolerancePx * (1 + 0.25 * I.hintLevel);
      };
      if (input.click) {
        if (tryHit(input.click.x, input.click.y)) solveFind(false, at);
        else U.emit('tap', { x: input.click.x, y: input.click.y, near: sp && sp.on && Math.hypot(input.click.x - sp.x, input.click.y - sp.y) < 160 });
      }
      if (input.enter && sp && vis && Math.abs(sp.nx) < 0.3 && Math.abs(sp.ny) < 0.3) solveFind(false, at);
    } else if (I.stage === 'restore') {
      const hit = (x, y) => {
        const h = pick(x, y, cam);
        if (!h) { U.emit('tap', { x, y }); return; }
        if (localAt(h.point, at + 10) > 0.5) { U.emit('tap', { x, y, lit: true }); return; }
        restoreAt(h.b, U.clamp(h.point[1], 8, h.b.top - 8), at, false);
        U.emit('tap', { x, y, restored: true });
        if (I.restored >= I.needed) solveRestore(false, at);
      };
      if (input.click) hit(input.click.x, input.click.y);
      // press-and-hold on a tower, or a steady sound while pointing at it
      const pointing = input.px !== undefined;
      const charging = pointing && (input.holding || (input.micOn && input.sustain > 0.6));
      if (charging) {
        const h = pick(input.px, input.py, cam);
        if (h && localAt(h.point, at + 10) < 0.5) {
          if (holdOn === h.idx) holdT += dt; else { holdOn = h.idx; holdT = 0; }
          I.charge = { x: input.px, y: input.py, k: U.clamp(holdT / 1.1, 0, 1) };
          if (holdT > 1.1) { holdT = -10; hit(input.px, input.py); }
        } else { holdOn = null; holdT = 0; I.charge = null; }
      } else { holdOn = null; holdT = 0; I.charge = null; }
      // hint: a ring around a dark tower near the centre of the view (searched twice a second)
      if (at - lastRestoreAt > IC.restoreHintAfter && !I.solved.restore) {
        hintClock -= dt;
        if (hintClock <= 0 || (hintBox && localAt(hintPoint(hintBox), at + 10) > 0.3)) { hintClock = 0.5; hintBox = findHintBox(cam, at); }
        if (hintBox) { const sp = project(hintPoint(hintBox), cam); I.hintTarget = sp && sp.on ? sp : null; }
      } else hintBox = null;
    }

    // flight steering: mouse position or keys; limited by the space between the towers
    let tx = input.mx, ty = input.my;
    if (keys.left || keys.right || keys.up || keys.down) { tx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0); ty = (keys.down ? 1 : 0) - (keys.up ? 1 : 0); }
    I.steerActive = U.damp(I.steerActive, flightOn ? 1 : 0, 1.5, dt);
    I.steer[0] = U.damp(I.steer[0], tx * I.steerActive, 2.2, dt);
    I.steer[1] = U.damp(I.steer[1], ty * I.steerActive, 2.2, dt);
    I.flightOn = flightOn;
  }

  function setKey(k, down) {
    const m = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
    if (m[k]) { keys[m[k]] = down; return true; }
    return false;
  }

  return Object.assign(I, { build, update, uniforms, localAt, onSeek, reset, isSolved, solveFind, solveRestore, project, pick, setKey, MAX_SPOTS });
})();
