/* =====================================================================
   Character director — which image is on screen, where, and how.
   ---------------------------------------------------------------------
   The images are never stretched to fake joint motion. Pose changes are:
     · cross-dissolves through a glowing noise edge (light reshaping her),
     · hidden behind a camera cut, or
     · covered by a light flash.
   Motion is done in code: breathing (≤1.2 % vertical, anchored at the
   ground), flinches on fracture impacts, floating bob, the lift-off, the
   flight along AG.Flight, banking, aura and particle trail.
   ===================================================================== */
window.AG = window.AG || {};

AG.CharacterDirector = (function () {
  const U = AG.U, V = U.v3, C = AG.CONFIG;
  const D = { out: null };
  let spots = null;

  function setInfo(info) {
    const H0 = info.hero.H0;
    spots = {
      lie: [1.0, H0, -15.2],
      edge: [0.6, H0, -19.4],
      H0
    };
  }

  /* pose placement at time t (anchor point + motion) */
  function place(id, t, S) {
    const P = { id, anchorPos: null, mode: AG.CHARACTER_MANIFEST.poses[id].mode, normal: [0, 0, 1], breath: 0, bob: 0, aura: 0, shake: 0, roll: 0 };
    switch (id) {
      case 'A': case 'I': case 'B': case 'C':
        P.anchorPos = spots.lie.slice();
        P.breath = (id === 'A' ? 0.012 : 0.008) * S.breath;
        P.shake = S.impact * 0.02;
        P.aura = id === 'C' ? 0.25 * U.smooth(44, 47, t) : 0;
        break;
      case 'H':
        P.anchorPos = spots.edge.slice(); P.breath = 0.008 * S.breath; P.aura = 0.15; break;
      case 'J':
        P.anchorPos = spots.edge.slice(); P.breath = 0.006 * S.breath; P.aura = 0.3 * U.smooth(57, 59.5, t); break;
      case 'D': {
        const k = U.easeInOut(U.clamp((t - 59.4) / 3.2, 0, 1));
        P.anchorPos = V.add(spots.edge, [0, 0.95 * k, -1.2 * k]);
        P.bob = 0.03 * Math.sin(t * 1.7) * k; P.aura = 0.45 + 0.4 * k; break;
      }
      case 'E': {
        const k = U.easeInOut(U.clamp((t - 62.4) / 5.6, 0, 1));
        P.anchorPos = V.add([0.6, spots.H0 + 1.75, -20.6], [0, 1.7 * k, -2.0 * k]);
        P.bob = 0.06 * Math.sin(t * 1.3); P.aura = 0.85 + 0.15 * Math.sin(t * 2.1); break;
      }
      case 'F': case 'G': {
        const fs = AG.Flight.state(t);
        P.anchorPos = fs.pos; P.flight = fs; P.roll = fs.bank; P.aura = 1;
        P.bob = 0.04 * Math.sin(t * 2.3) * (1 - fs.speedN);
        break;
      }
    }
    return P;
  }

  /* Returns the images to draw now (1, or 2 during a dissolve). */
  function update(t, S) {
    if (!spots) return null;
    const track = C.poseTrack;
    let i = 0;
    for (let k = 0; k < track.length; k++) if (t >= track[k].t) i = k;
    const cur = track[i], prev = i > 0 ? track[i - 1] : null;
    const items = [];
    const fade = cur.fade || 0;
    const k = fade > 0 ? U.clamp((t - cur.t) / fade, 0, 1) : 1;
    if (prev && k < 1 && !cur.cut) {
      const a = place(prev.pose, t, S); a.alpha = 1; a.dissolve = U.smooth(0, 1, k); items.push(a);
      const b = place(cur.pose, t, S); b.alpha = 1; b.dissolve = 1 - U.smooth(0, 1, k); b.incoming = true; items.push(b);
    } else {
      const a = place(cur.pose, t, S); a.alpha = 1; a.dissolve = 0; items.push(a);
    }
    // a flash covers some changes (lift-off into flight, the pain of the last impact)
    const flash = cur.flash ? Math.exp(-Math.max(0, t - cur.t) * 3.5) * (t >= cur.t ? 1 : 0) : 0;
    const main = items.at(-1);
    const flying = main.id === 'F' || main.id === 'G';
    const fs = flying ? main.flight : null;
    D.out = {
      items, main, flash, flying,
      trail: flying ? U.smooth(68.6, 70.2, t) * (0.35 + 0.65 * fs.speedN) * (1 - U.smooth(87.5, 90, t)) : 0,
      sparkle: Math.max(main.id === 'E' || main.id === 'D' ? 0.9 : 0, flying ? 0.5 : 0, main.id === 'C' ? 0.2 * U.smooth(44, 47, t) : 0),
      speedN: fs ? fs.speedN : 0,
      vel: fs ? V.scale(fs.fwd, fs.speed) : [0, 0, 0]
    };
    return D.out;
  }

  /* Recent positions along the flight path for the light trail. */
  function trailPoints(t, n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const tk = t - k * 0.055;
      out.push(...(tk >= 68 ? AG.Flight.posAtDist(AG.Flight.distAt(tk)) : AG.Flight.start || [0, 0, 0]));
    }
    return out;
  }

  Object.assign(D, { setInfo, update, trailPoints });
  Object.defineProperty(D, 'spots', { get: () => spots });
  return D;
})();
