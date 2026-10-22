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
    const fx = info.flightX, sz = info.frontStreetZ;
    const dt = AG.CONFIG.city.downtown;
    return [
      // 01 NUMBNESS — close on her, then the dead city
      { s: 0, e: 8.5, f: (k) => ({ pos: L(add(lie, [0.55, 0.32, 1.85]), add(lie, [0.35, 0.42, 2.25]), k), target: add(lie, [-0.05, 0.22, 0]), fov: 30, close: 1 }) },
      { s: 8.5, e: 15, f: (k) => ({ pos: L(add(lie, [0.4, 0.5, 2.4]), add(lie, [1.6, 3.1, 7.4]), k), target: L(add(lie, [0, 0.25, 0]), [-20, H - 30, -240], k), fov: 34 + 16 * k, close: 0.5 }) },
      // 02 FRACTURE — faster, wider, harder
      { s: 15, e: 19, cut: true, f: (k) => ({ pos: L([16, H + 16, -34], [34, H + 34, -78], k), target: [dt.x, 150, dt.z], fov: 56 }) },
      { s: 19, e: 23, cut: true, f: (k) => ({ pos: L([fx + 4, 26, sz - 60], [fx - 2, 34, sz - 250], k), target: [fx, 150, sz - 640], fov: 64, close: 0.3 }) },
      { s: 23, e: 27, cut: true, f: (k) => ({ pos: L(add(lie, [-0.6, 0.55, 2.0]), add(lie, [-0.3, 0.45, 1.7]), k), target: add(lie, [0.05, 0.25, 0]), fov: 32, close: 1 }) },
      { s: 27, e: 32, cut: true, f: (k, t) => { const a = 0.4 + (t - 27) * 0.13; return { pos: [dt.x + Math.sin(a) * 340, 250 - 30 * k, dt.z + Math.cos(a) * 340], target: [dt.x, 120, dt.z - 40], fov: 52 }; } },
      // 03 AWAKENING — one light, the pulse through the streets, back to her
      { s: 32, e: 37.2, cut: true, f: (k, t) => { const R = AG.Story.state.restore * 1650; const d = V.norm([-0.62, 0, -1]); const r = Math.max(40, R - 70); return { pos: [d[0] * r, 64, d[2] * r + sz], target: [d[0] * (r + 260), 18, d[2] * (r + 260) + sz], fov: 58 }; } },
      { s: 37.2, e: 43, cut: true, f: (k) => ({ pos: L(add(lie, [0.85, 0.85, 2.7]), add(lie, [0.6, 0.75, 2.35]), k), target: add(lie, [0, 0.42, 0]), fov: 32, close: 0.9 }) },
      { s: 43, e: 48, f: (k) => ({ pos: L(add(lie, [0.6, 0.75, 2.35]), add(lie, [-0.2, 0.55, 2.1]), k), target: L(add(lie, [0, 0.5, 0]), add(lie, [-0.3, 1.4, -3]), k), fov: 32 + 6 * k, close: 0.9 }) },
      // 04 RECLAIMING SELF — behind her, the city answering
      { s: 48, e: 55.4, cut: true, f: (k) => ({ pos: L(add(edge, [1.25, 1.35, 4.2]), add(edge, [2.1, 2.2, 5.6]), k), target: L([-40, H - 25, -380], [-60, H - 10, -420], k), fov: 44, close: 0.5 }) },
      { s: 55.4, e: 59.4, f: (k) => ({ pos: L(add(edge, [2.1, 2.2, 5.6]), add(edge, [1.0, 1.6, 4.6]), k), target: L([-60, H - 10, -420], add(edge, [0, 1.0, -6]), k), fov: 40 }) },
      { s: 59.4, e: 62.4, f: (k) => ({ pos: add(edge, [0.3, 0.55, 3.8 - 0.6 * k]), target: add(edge, [0, 1.6 + 1.4 * k, -6]), fov: 44, close: 0.4 }) },
      { s: 62.4, e: 68.1, cut: true, f: (k, t) => { const a = -0.28 + 0.5 * k; const c = [0.6, H + 2.4 + 1.6 * k, -21.4 - 2.0 * k]; return { pos: add(c, [Math.sin(a) * 6.5, 0.6 + 0.8 * k, -Math.cos(a) * 6.5]), target: c, fov: 40, close: 0.2 }; } },
      // 05 AFTERGLOW — the flight
      { s: 68.1, e: 74.6, cut: true, f: (k, t) => { const c = chase(t, U.lerp(3.4, 5.2, k), U.lerp(0.7, 1.1, k), 0, 20); c.flight = true; return c; } },
      { s: 74.6, e: 77.4, cut: true, f: (k, t) => { const fs = AG.Flight.state(t); const side = V.norm(V.cross(fs.fwd, [0, 1, 0])); return { pos: V.add(V.add(fs.pos, V.scale(side, 6.2)), V.scale(fs.fwd, 1.5 - 2 * k)), target: V.add(fs.pos, V.scale(fs.fwd, 2)), fov: 48, flight: true, side: true }; } },
      { s: 77.4, e: 81, cut: true, f: (k, t) => { const c = chase(t, 5.0, -0.5 + 0.4 * k, 0.7, 26); c.flight = true; return c; } },
      { s: 81, e: 85, f: (k, t) => { const c = chase(t, 6.0, 0.9, 0, 30); c.flight = true; return c; } },
      { s: 85, e: 95, f: (k, t) => { const anchor = AG.Flight.posAtDist(AG.Flight.distAt(86.4)); const fs85 = AG.Flight.state(86.4); const sun = V.norm([0.55, 0.05, -0.83]); const cam = V.add(V.add(anchor, V.scale(fs85.fwd, -6.5)), [0, 1.6 + 2.5 * k, 0]); const p = AG.Flight.state(t).pos; return { pos: cam, target: V.lerp(p, V.add(cam, V.scale(sun, 600)), 0.2 + 0.55 * k), fov: 50, flight: true }; } }
    ];
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
    if (m.mode === 'fixed') { const lim = (AG.CHARACTER_MANIFEST.poses[m.id].maxTurn || 22) * Math.PI / 180; yaw = U.clamp(yaw, -lim, lim); }
    el = U.clamp(el, -0.12, 0.52);
    return V.add(c, [Math.sin(yaw) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(yaw) * Math.cos(el) * r]);
  }

  function update(t, dt, rt, input) {
    if (!info) return out;
    const ch = AG.CharacterDirector.out;
    const desired = mode === 'film' ? filmPose(t) : freePose(t, rt);
    // mouse: drag orbit + wheel zoom; tightly limited in flight, more so in narrow canyons
    let yawLim = 0.9, pitLim = 0.6;
    if (desired.flight) {
      const cl = AG.Flight.clearance(desired.fs ? desired.fs.pos : desired.target);
      yawLim = cl < 14 ? 0.08 : cl < 30 ? 0.18 : 0.32; pitLim = yawLim * 0.7;
    }
    dragYaw = U.clamp(dragYaw + input.dragDX * 0.005, -yawLim, yawLim);
    dragPitch = U.clamp(dragPitch + input.dragDY * 0.003, -pitLim, pitLim);
    zoom = U.clamp(zoom * Math.exp(input.wheel * 0.0012), 0.5, 2.0);
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
    const rate = snap ? 1e6 : desired.flight ? 7 : 2.4;
    cur.pos = cur.pos.map((v, i) => U.damp(v, pos[i], rate, dt));
    cur.target = cur.target.map((v, i) => U.damp(v, target[i], desired.flight ? 12 : rate, dt));
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
    const pk = desired.flight ? 0.012 : 0.05;
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

  return { MODES, setInfo, setMode, cycle, update, matrices, snapNext, get mode() { return mode; }, state: out, resetShots() { SH = null; } };
})();
