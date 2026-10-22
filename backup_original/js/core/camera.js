/* =====================================================================
   Camera director
   ---------------------------------------------------------------------
   "Cinematic" mode follows a shot list keyed to film time; consecutive
   shots cross-blend (no accidental jumps) except where a hard CUT is
   intended (chapter changes, hiding a pose change). The result is eased
   by a damped follow.

   Image-based character rules (so the flat planes never show):
     · close to her rooftop poses the camera is held inside a viewing cone
       around the plane's normal (±maxTurn sideways, ≤ 30° from above),
       whatever the mouse does;
     · in flight the chase camera is depth-aware — it is pulled in front of
       any building between her and the lens — and mouse offsets shrink in
       narrow canyons.
   ===================================================================== */
window.AG = window.AG || {};

AG.Camera = (function () {
  const U = AG.U, V = U.v3;
  const MODES = [
    { id: 'film', label: 'Cinematic' },
    { id: 'orbit', label: 'Close on her' },
    { id: 'rooftop', label: 'Rooftop' },
    { id: 'wide', label: 'Wide city' },
    { id: 'aerial', label: 'Aerial flyover' },
    { id: 'street', label: 'Street level' }
  ];
  let mode = 'film', info = null, SH = null;
  const cur = { pos: [0, 200, 200], target: [0, 90, 0], fov: 45, close: 0 };
  let snap = true, dragYaw = 0, dragPitch = 0, zoom = 1, lastShot = -1;
  const out = {};

  function setInfo(i) { info = i; SH = null; snap = true; }
  function setMode(m) { mode = m; snap = false; AG.U.emit('cameraMode', m); }
  function cycle() { const i = MODES.findIndex((m) => m.id === mode); setMode(MODES[(i + 1) % MODES.length].id); }
  function snapNext() { snap = true; }

  /* ---------- the chase rig (Chapter 05) ---------- */
  function chase(t, back, height, side, lookAhead) {
    const fs = AG.Flight.state(t);
    const p = fs.pos;
    let want = V.add(V.add(V.sub(p, V.scale(fs.fwd, back)), V.scale(fs.up, height)), V.scale(fs.right, side || 0));
    const target = V.add(p, V.scale(fs.fwd, lookAhead || 18));
    return { pos: want, target, fov: 52 + 14 * fs.speedN, fs };
  }

  function shots() {
    const H = info.hero.H0, sp = AG.CharacterDirector.spots;
    const lie = sp.lie, edge = sp.edge;
    const add = V.add, L = (a, b, k) => V.lerp(a, b, U.easeInOut(U.clamp(k, 0, 1)));
    const AF = AG.AF;
    const Vt = AG.Interact.vantage;
    const city = [-40, H - 30, -420];
    const bez = (a, m, b, k) => V.add(V.add(V.scale(a, (1 - k) * (1 - k)), V.scale(m, 2 * k * (1 - k))), V.scale(b, k * k));
    const beacon = () => (AG.Interact.beacon ? AG.Interact.beacon.pos : city);
    return [
      // 01 NUMBNESS — 3 s, a low side angle at her height (never from above: she is a flat image)
      { s: 0, e: 3.1, f: (k) => ({ pos: L(add(lie, [0.32, 0.27, 2.75]), add(lie, [0.16, 0.28, 2.45]), k), target: add(lie, [-0.06, 0.17, 0]), fov: 32, close: 1 }) },
      // 02 FRACTURE — the lightning: she pushes up, the camera lifts with her
      { s: 3.1, e: 4.5, f: (k) => ({ pos: L(add(lie, [0.45, 0.42, 2.2]), add(lie, [0.75, 0.8, 2.5]), k), target: add(lie, [0, 0.3 + 0.15 * k, 0]), fov: 33, close: 1 }) },
      //    reverse angle (cut): sitting, hugging her knees; the camera is on the city side
      { s: 4.5, e: 5.8, cut: true, f: (k) => ({ pos: L(add(lie, [0.35, 0.62, -2.5]), add(lie, [0.25, 0.7, -2.2]), k), target: add(lie, [0, 0.45, 0]), fov: 34, close: 0.9 }) },
      //    behind her (cut): she looks at the city
      { s: 5.8, e: 7, cut: true, f: (k) => ({ pos: L(add(lie, [0.55, 0.95, 2.1]), add(lie, [0.5, 1.05, 2.4]), k), target: L(add(lie, [-0.3, 0.7, -6]), city, k), fov: 40, close: 0.6 }) },
      //    the reveal: up and away over the broken city, ending at the viewing position
      { s: 7, e: 15, f: (k) => { const e = U.easeInOut(U.clamp(k, 0, 1)); return { pos: bez(add(lie, [0.5, 1.05, 2.4]), add(lie, [-9, 7, 13]), Vt, e), target: city, fov: 40 + 14 * e, close: 0.6 * (1 - e) }; } },
      // 03 AWAKENING — the pulse found: watch the shockwave spread from it
      { s: 15, e: 21, glide: true, f: (k) => ({ pos: add(Vt, [0, 2 * k, 3 * k]), target: L(beacon(), V.lerp(beacon(), city, 0.5), k), fov: 40 + 14 * k }) },
      // 04 RECLAIMING SELF — the city answers; behind her; she stands, rises, levitates
      { s: 21, e: 25, glide: true, f: (k) => ({ pos: add(Vt, [0, 2 + 5 * k, 3 + 4 * k]), target: city, fov: 54 }) },
      { s: 25, e: 29.5, cut: true, f: (k) => ({ pos: L(add(lie, [0.6, 1.0, 2.5]), add(lie, [1.0, 1.5, 3.3]), k), target: L(city, [-60, H - 10, -420], k), fov: 44, close: 0.5 }) },
      { s: 29.5, e: 33, cut: true, f: (k) => ({ pos: L(add(edge, [1.25, 1.35, 4.2]), add(edge, [2.1, 2.2, 5.6]), k), target: L([-40, H - 25, -380], [-60, H - 10, -420], k), fov: 44, close: 0.5 }) },
      { s: 33, e: 36, f: (k) => ({ pos: add(edge, [0.3, 0.55, 3.8 - 0.6 * k]), target: add(edge, [0, 1.6 + 1.4 * k, -6]), fov: 44, close: 0.4 }) },
      { s: 36, e: AF(68.1), cut: true, f: (k, t) => { const c = [0.6, H + 2.4 + 1.6 * k, -21.4 - 2.0 * k]; const a = -0.28 + 0.5 * k; return { pos: add(c, [Math.sin(a) * 6.5, 0.6 + 0.8 * k, -Math.cos(a) * 6.5]), target: c, fov: 40, close: 0.2 }; } },
      // 05 AFTERGLOW — the flight (steered by the viewer)
      { s: AF(68.1), e: AF(74.6), cut: true, f: (k, t) => { const c = chase(t, U.lerp(3.4, 5.2, k), U.lerp(0.7, 1.1, k), 0, 20); c.flight = true; return c; } },
      { s: AF(74.6), e: AF(77.4), cut: true, f: (k, t) => { const fs = AG.Flight.state(t); const side = V.norm(V.cross(fs.fwd, [0, 1, 0])); return { pos: V.add(V.add(fs.pos, V.scale(side, 6.2)), V.scale(fs.fwd, 1.5 - 2 * k)), target: V.add(fs.pos, V.scale(fs.fwd, 2)), fov: 48, flight: true, side: true }; } },
      { s: AF(77.4), e: AF(81), cut: true, f: (k, t) => { const c = chase(t, 5.0, -0.5 + 0.4 * k, 0.7, 26); c.flight = true; return c; } },
      { s: AF(81), e: AF(85), f: (k, t) => { const c = chase(t, 6.0, 0.9, 0, 30); c.flight = true; return c; } },
      { s: AF(85), e: AF(95), f: (k, t) => { const anchor = AG.Flight.posAtDist(AG.Flight.distAt(AF(86.4))); const fs85 = AG.Flight.state(AF(86.4)); const sun = V.norm([0.55, 0.05, -0.83]); const cam = V.add(V.add(anchor, V.scale(fs85.fwd, -6.5)), [0, 1.6 + 2.5 * k, 0]); const p = AG.Flight.state(t).pos; return { pos: cam, target: V.lerp(p, V.add(cam, V.scale(sun, 600)), 0.2 + 0.55 * k), fov: 50, flight: true }; } }
    ];
  }

  /* ---------- EXPLORE: free look from the viewing position during a gate ---------- */
  const ex = { yaw: 0, pitch: -0.12, fov: 54, stage: null, still: 0 };
  function explorePose(dt, input) {
    const IA = AG.Interact, Vt = IA.vantage;
    if (ex.stage !== IA.stage) {
      // start from wherever the camera is looking now
      const d = V.norm(V.sub(cur.target, cur.pos));
      ex.yaw = Math.atan2(d[0], -d[2]); ex.pitch = U.clamp(Math.asin(U.clamp(d[1], -1, 1)), -0.45, 0.25); ex.fov = U.clamp(cur.fov, 30, 58);
      ex.stage = IA.stage; ex.still = 0;
    }
    const k = IA.keys || {};
    const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0), ky = (k.up ? 1 : 0) - (k.down ? 1 : 0);
    // drag = grab the world; arrows turn the view; wheel = zoom
    ex.yaw -= input.dragDX * 0.0035 * (ex.fov / 50); ex.pitch += input.dragDY * 0.0025 * (ex.fov / 50);
    ex.yaw += kx * 1.1 * dt; ex.pitch += ky * 0.6 * dt;
    ex.fov = U.clamp(ex.fov * Math.exp(input.wheel * 0.0009), 24, 62);
    ex.still = input.dragging || kx || ky ? 0 : ex.still + dt;
    // hint: after a while, a gentle drift toward the pulse
    if (IA.stage === 'find' && IA.hintLevel >= 3 && ex.still > 2.5 && IA.beacon) {
      const b = V.sub(IA.beacon.pos, Vt);
      const by = Math.atan2(b[0], -b[2]), bp = Math.atan2(b[1], Math.hypot(b[0], b[2]));
      const dy = Math.atan2(Math.sin(by - ex.yaw), Math.cos(by - ex.yaw));
      ex.yaw += dy * (1 - Math.exp(-0.45 * dt)); ex.pitch = U.damp(ex.pitch, bp, 0.45, dt);
    }
    ex.pitch = U.clamp(ex.pitch, -0.5, 0.3);
    const dir = [Math.sin(ex.yaw) * Math.cos(ex.pitch), Math.sin(ex.pitch), -Math.cos(ex.yaw) * Math.cos(ex.pitch)];
    return { pos: Vt.slice(), target: V.add(Vt, V.scale(dir, 120)), fov: ex.fov, explore: true };
  }

  function evalShot(sh, t) { return sh.f(U.clamp((t - sh.s) / (sh.e - sh.s), 0, 1.3), t); }

  function filmPose(t) {
    if (!SH) SH = shots();
    let i = SH.findIndex((s) => t >= s.s && t < s.e);
    if (i < 0) i = t < 0 ? 0 : SH.length - 1;
    let pose = evalShot(SH.at(i), t);
    const cutHere = SH.at(i).cut;
    if (i !== lastShot) { if (cutHere) snap = true; lastShot = i; }
    const blend = 2.5;
    // `glide`: after an interactive gate, continue from wherever the viewer was looking
    if (SH.at(i).glide) return Object.assign({}, pose, { glide: true });
    if (i > 0 && !cutHere && t < SH.at(i).s + blend) {
      const prev = evalShot(SH.at(i - 1), t);
      const k = U.easeInOut((t - SH.at(i).s) / blend);
      pose = Object.assign({}, pose, { pos: V.lerp(prev.pos, pose.pos, k), target: V.lerp(prev.target, pose.target, k), fov: U.lerp(prev.fov, pose.fov, k), close: U.lerp(prev.close || 0, pose.close || 0, k) });
    }
    return pose;
  }

  function freePose(t, rt) {
    const H = info.hero.H0, sp = AG.CharacterDirector.spots;
    const ch = AG.CharacterDirector.out;
    const flying = ch && ch.flying;
    switch (mode) {
      case 'orbit': {
        if (flying) { const c = chase(t, 7, 1.4, 0, 20); c.flight = true; return c; }
        const m = ch ? ch.main.anchorPos : sp.lie;
        const a = Math.sin(rt * 0.15) * 0.3;
        return { pos: V.add(m, [Math.sin(a) * 3.2, 1.1, Math.cos(a) * 3.2]), target: V.add(m, [0, 0.5, 0]), fov: 36, close: 0.8 };
      }
      case 'rooftop': return { pos: V.add(sp.edge, [1.6 + Math.sin(rt * 0.05) * 0.4, 2.2, 6.0]), target: [-25, H - 22, -320], fov: 46, close: 0.4 };
      case 'wide': return { pos: [95 + Math.sin(rt * 0.02) * 10, H + 62, 95], target: [-60, H - 45, -300], fov: 54 };
      case 'aerial': {
        const a = rt * 0.018, cx = -100, cz = -320, R = 520;
        return { pos: [cx + Math.cos(a) * R, 210 + Math.sin(a * 2.0) * 40, cz + Math.sin(a) * R], target: [cx + Math.cos(a + 0.25) * R * 0.55, 60, cz + Math.sin(a + 0.25) * R * 0.55], fov: 58 };
      }
      case 'street': {
        const x = info.flightX, z = ((rt * 5) % 900);
        return { pos: [x + 4, 2.2, info.frontStreetZ - 20 - z], target: [x - 6, 45, info.frontStreetZ - 80 - z], fov: 62, close: 0.3 };
      }
    }
    return filmPose(t);
  }

  /* keep the camera inside the safe viewing cone of a flat pose */
  function constrainToPose(pos, ch) {
    if (!ch || ch.flying) return pos;
    const m = ch.main;
    if (m.mode !== 'fixed' && m.mode !== 'cyl') return pos;
    const c = V.add(m.anchorPos, [0, 0.45, 0]);
    const off = V.sub(pos, c), r = V.len(off);
    if (r > 14) return pos;
    let yaw = Math.atan2(off[0], off[2]);
    let el = Math.asin(U.clamp(off[1] / r, -1, 1));
    if (m.mode === 'fixed') {
      const meta = AG.CHARACTER_MANIFEST.poses[m.id], lim = (meta.maxTurn || 22) * Math.PI / 180, face = meta.face || 0;
      let rel = Math.atan2(Math.sin(yaw - face), Math.cos(yaw - face));
      yaw = face + U.clamp(rel, -lim, lim);
    }
    el = U.clamp(el, -0.12, m.id === 'A' || m.id === 'I' ? 0.3 : 0.52);
    return V.add(c, [Math.sin(yaw) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(yaw) * Math.cos(el) * r]);
  }

  function update(t, dt, rt, input) {
    if (!info) return out;
    const ch = AG.CharacterDirector.out;
    const exploring = mode === 'film' && AG.Interact.stage && AG.Interact.vantage;
    if (!exploring) ex.stage = null;
    const desired = exploring ? explorePose(dt, input) : mode === 'film' ? filmPose(t) : freePose(t, rt);
    // mouse: drag orbit + wheel zoom; tightly limited in flight, more so in narrow canyons
    let yawLim = 0.9, pitLim = 0.6;
    if (desired.flight) {
      const cl = AG.Flight.clearance(desired.fs ? desired.fs.pos : desired.target);
      yawLim = cl < 14 ? 0.08 : cl < 30 ? 0.18 : 0.32; pitLim = yawLim * 0.7;
    }
    if (desired.explore) { dragYaw = U.damp(dragYaw, 0, 3, dt); dragPitch = U.damp(dragPitch, 0, 3, dt); }
    else dragYaw = U.clamp(dragYaw + input.dragDX * 0.005, -yawLim, yawLim);
    if (!desired.explore) {
      dragPitch = U.clamp(dragPitch + input.dragDY * 0.003, -pitLim, pitLim);
      zoom = U.clamp(zoom * Math.exp(input.wheel * 0.0012), 0.5, 2.0);
    }
    if ((mode === 'film' || desired.flight) && !input.dragging) { dragYaw = U.damp(dragYaw, 0, 0.35, dt); dragPitch = U.damp(dragPitch, 0, 0.35, dt); }
    if (mode === 'film') zoom = U.damp(zoom, 1, 0.25, dt);
    let off = V.sub(desired.pos, desired.target);
    const r = V.len(off);
    const yaw = Math.atan2(off[0], off[2]) + dragYaw;
    const el = U.clamp(Math.asin(U.clamp(off[1] / r, -1, 1)) + dragPitch, -1.2, 1.45);
    const rr = r * (mode === 'film' || desired.flight ? 1 : zoom);
    off = [Math.sin(yaw) * Math.cos(el) * rr, Math.sin(el) * rr, Math.cos(yaw) * Math.cos(el) * rr];
    let pos = V.add(desired.target, off);
    const target = desired.target.slice();
    pos = constrainToPose(pos, ch);
    // depth-aware chase: never put a building between her and the lens
    if (desired.flight && ch && ch.main.anchorPos) {
      const her = ch.main.anchorPos;
      const f = AG.Flight.segmentClear(her, pos, 1.5);
      if (f < 1) pos = V.lerp(her, pos, Math.max(0.25, f - 0.05));
    }
    const fov = desired.fov * (mode === 'film' ? zoom : 1);
    const rate = snap ? 1e6 : desired.flight ? 7 : desired.explore ? 5 : desired.glide ? 1.1 : 2.4;
    cur.pos = cur.pos.map((v, i) => U.damp(v, pos[i], rate, dt));
    cur.target = cur.target.map((v, i) => U.damp(v, target[i], desired.flight ? 12 : desired.explore ? 9 : rate, dt));
    cur.fov = U.damp(cur.fov, fov, snap ? 1e6 : 2, dt);
    cur.close = U.damp(cur.close, desired.close || 0, snap ? 1e6 : 1.5, dt);
    snap = false;
    // breathing handheld drift + impact shake + mouse parallax (reduced in flight)
    const S = AG.Story.state;
    const shake = (S.impact || 0) * 0.06;
    const hand = [Math.sin(rt * 0.37) * 0.02 + Math.sin(rt * 1.3) * 0.006 + Math.sin(rt * 47) * shake, Math.sin(rt * 0.29 + 1) * 0.015 + Math.cos(rt * 53) * shake, 0];
    const dirv = V.norm(V.sub(cur.target, cur.pos));
    const dist = V.len(V.sub(cur.target, cur.pos));
    const right = V.norm(V.cross(dirv, [0, 1, 0]));
    const up = V.cross(right, dirv);
    const pk = desired.flight ? 0.012 : desired.explore ? 0.008 : 0.05;
    const par = V.add(V.scale(right, input.mx * pk * dist), V.scale(up, -input.my * pk * 0.7 * dist));
    out.pos = V.add(cur.pos, V.scale(hand, Math.max(1, dist * 0.02)));
    out.target = V.add(cur.target, par);
    out.fov = cur.fov; out.close = cur.close; out.flight = !!desired.flight;
    out.right = right; out.up = up; out.dir = dirv;
    const her = ch && ch.main.anchorPos ? ch.main.anchorPos : AG.CharacterDirector.spots.lie;
    const dH = V.len(V.sub(out.pos, her));
    out.distHero = dH;
    // near/far depth split while we are up on her roof
    out.split = !out.flight && dH < 70 && Math.abs(out.pos[0]) < 45 && Math.abs(out.pos[2]) < 45 && out.pos[1] > info.hero.H0 - 4;
    out.nearSplit = out.flight && dH < 40;
    return out;
  }

  function matrices(aspect, near, far) {
    const proj = U.mat4.perspective(out.fov * Math.PI / 180, aspect, near, far);
    const view = U.mat4.lookAt(out.pos, out.target, [0, 1, 0]);
    return { proj, view };
  }

  return { MODES, setInfo, setMode, cycle, update, matrices, snapNext, get mode() { return mode; }, state: out, explore: ex, resetShots() { SH = null; } };
})();
