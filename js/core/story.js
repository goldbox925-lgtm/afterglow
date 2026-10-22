/* =====================================================================
   Story — turns (film time + live input) into the city's state.
   ---------------------------------------------------------------------
   Five chapters, 90 seconds:
     01 NUMBNESS     0–15   dark, slow rain, she lies still
     02 FRACTURE    15–32   five impacts: lights die in waves, towers split
     03 AWAKENING   32–48   one light, then a pulse through the streets
     04 RECLAIMING  48–65   towers reassemble with gold seams; she rises
     05 AFTERGLOW   65–90   she flies; the cloud; the sunrise; the title

   Input (voice or mouse) ENHANCES the city; it never gates the story:
     · loud bursts       → extra instability + glitch (strongest in Fracture)
     · sustained sound   → light spreads faster (Awakening, Reclaiming),
                           and in the threshold before the first light it
                           brings that light a little early
     · pitch/brightness  → colour of the returning light
     · stillness         → rain softens, she breathes slower
   No emotion is inferred from the voice.
   ===================================================================== */
window.AG = window.AG || {};

AG.Story = (function () {
  const C = AG.CONFIG, U = AG.U, B = C.beats;
  const S = {};
  let firstLight = null, boost = 0, echo = 0, prevT = 0;
  let breathPhase = 0, calm = 0, userBurst = 0;
  let lastGlitch = -1, firstLightEmitted = false, stillHereEmitted = false;
  let tint = [1.0, 0.7, 0.45];
  let pulseEnv = 0;

  function reset(t) {
    t = t || 0;
    firstLight = t >= C.firstLight.firstLightDefault ? C.firstLight.firstLightDefault : null;
    firstLightEmitted = firstLight !== null;
    stillHereEmitted = t >= B.reclaiming.stillHere;
    boost = 0; echo = 0; prevT = t; lastGlitch = -1; userBurst = 0;
  }

  const lerp3 = (a, b, k) => [U.lerp(a[0], b[0], k), U.lerp(a[1], b[1], k), U.lerp(a[2], b[2], k)];
  const env = (x, a, d) => (x < 0 ? 0 : x < a ? x / a : Math.exp(-(x - a) / d));
  function lightningEnv(x) {
    if (x < 0 || x > 2.5) return 0;
    return Math.exp(-x * 10) + (x > 0.16 ? 0.7 * Math.exp(-(x - 0.16) * 6) : 0);
  }

  function chapterId(t) {
    if (t < 15) return 'numbness'; if (t < 32) return 'fracture'; if (t < 48) return 'awakening'; if (t < 65) return 'reclaiming'; return 'afterglow';
  }

  function compute(t, dt, playing, input, music) {
    const ch = chapterId(t), fdt = playing ? dt : 0;
    S.chapter = ch;
    const fl = C.firstLight, imp = B.fracture.impacts;

    /* ---------- impacts (Fracture) ---------- */
    let impact = 0, impactCount = 0;
    imp.forEach((ti) => { const e = env(t - ti, 0.04, 0.55); impact = Math.max(impact, e); if (t >= ti) impactCount++; });
    imp.forEach((ti) => { if (playing && prevT < ti && t >= ti) U.emit('impact', { t: ti, n: imp.indexOf(ti) }); });
    S.impact = impact;

    /* ---------- the first light (interactive threshold) ---------- */
    if (firstLight === null) {
      if (t >= fl.windowStart && t < fl.firstLightDefault && input.sustain > 0.55) firstLight = t;
      if (t >= fl.firstLightDefault) firstLight = fl.firstLightDefault;
    }
    if (firstLight !== null && !firstLightEmitted && t >= firstLight) {
      firstLightEmitted = true; U.emit('firstLight', { t, early: firstLight < fl.firstLightDefault });
    }
    const tf = firstLight === null ? 1e9 : firstLight;

    /* ---------- restoration: 0 until the first light, 1 by the flight ---------- */
    let base = 0;
    if (t >= tf) {
      const a = U.clamp((t - tf) / (48 - tf), 0, 1), b = U.clamp((t - 48) / 17, 0, 1), c = U.clamp((t - 65) / 6, 0, 1);
      base = 0.42 * Math.pow(U.smooth(0, 1, a), 1.3) + 0.46 * U.smooth(0, 1, b) + 0.12 * U.smooth(0, 1, c);
      base = Math.max(base, 0.02 * U.smooth(tf, tf + 1, t));
    }
    if (playing && (ch === 'awakening' || ch === 'reclaiming')) boost += fdt * 0.06 * input.sustain * (1 - base);
    boost -= fdt * 0.012; boost = U.clamp(boost, 0, 0.2);
    if (ch === 'numbness' || ch === 'fracture') boost = 0;
    S.restore = U.clamp(base + boost, 0, 1);

    /* fragments: whole at first, torn apart by the impacts, home again with gold seams */
    let rebuild;
    if (t < 15) rebuild = 1;
    else if (t < 32) rebuild = 1 - Math.min(1, impactCount / imp.length + 0.18 * impact) * U.smooth(14.9, 15.3, t);
    else if (t < B.reclaiming.rebuildStart) rebuild = 0;
    else rebuild = U.smooth(B.reclaiming.rebuildStart, B.reclaiming.rebuildEnd, t);
    rebuild = U.clamp(rebuild + (ch === 'reclaiming' ? boost * 0.6 : 0), 0, 1);
    S.rebuild = rebuild;
    S.seam = t < B.reclaiming.rebuildStart ? 0 : U.smooth(B.reclaiming.rebuildStart, B.reclaiming.rebuildEnd + 2, t);

    /* ---------- input interpretation ---------- */
    const lvl = input.level, burst = input.burst, quiet = input.silence;
    calm = U.damp(calm, quiet > 5 ? 1 : 0, 0.4, dt);
    userBurst = Math.max(burst, userBurst - dt * 1.5);
    echo = U.damp(echo, (ch === 'numbness' || ch === 'fracture') && input.sustain > 0.4 ? 1 : 0, 0.5, dt);
    S.echo = echo; S.calm = calm;
    S.tremor = (ch === 'fracture' ? 1.6 : 0.5) * lvl;

    /* ---------- environment ---------- */
    S.survivor = ch === 'numbness' ? 0.08 : ch === 'fracture' ? [0.08, 0.06, 0.04, 0.025, 0.012, 0.005].at(impactCount) : 0.004;
    S.traffic = t < 32 ? (t < 15 ? 0.012 : 0) : U.clamp(0.02 + 0.68 * U.smooth(0.25, 0.95, S.restore), 0, 1);
    let rain;
    if (t < 15) rain = U.lerp(0.55, 0.45, calm) + 0.1 * lvl;
    else if (t < 32) rain = 0.95;
    else if (t < 48) rain = U.lerp(0.95, 0.5, U.smooth(32, 46, t));
    else if (t < 65) rain = U.lerp(0.5, 0.3, U.smooth(48, 64, t));
    else rain = U.lerp(0.3, 0.0, U.smooth(76, 82, t));
    S.rain = U.clamp(rain, 0, 1);
    S.wind = 0.3 + 0.3 * Math.sin(t * 0.13) + (ch === 'fracture' ? 0.6 + impact : 0) + lvl * 0.4;
    S.instability = (ch === 'fracture' ? 0.08 + impact * 0.9 : 0.02) + userBurst * (ch === 'fracture' ? 0.6 : 0.3);

    /* lightning on three impacts */
    let flash = 0, fx = 0.3;
    B.fracture.lightning.forEach((te, i) => { const e = lightningEnv(t - te); if (e > flash) { flash = e; fx = [0.6, -0.9, 0.15].at(i % 3); } });
    B.fracture.lightning.forEach((te) => { if (playing && prevT < te && t >= te) U.emit('lightning', { t: te, x: fx }); });
    S.flash = flash; S.flashX = fx;

    /* glitch: impacts, sparse interference, loud input */
    const slot = Math.floor(t * 4);
    let g = 0;
    const pr = ch === 'fracture' ? 0.12 : ch === 'numbness' ? 0.02 : 0.004;
    if (U.hash(slot * 1.71) < pr) g = 0.25 + 0.4 * U.hash(slot * 3.3);
    g = Math.max(g, impact * 0.95, userBurst * 0.6);
    if (ch === 'afterglow') g *= 0.3;
    if (playing && g > 0.2 && slot !== lastGlitch) { lastGlitch = slot; U.emit('glitch', { amount: g }); }
    S.glitch = g;

    /* the city's heartbeat (music low band) once it returns */
    pulseEnv = Math.max(music ? music.low : 0, pulseEnv - dt * 3.5);
    S.pulse = U.smooth(B.reclaiming.pulseIn - 2, B.reclaiming.pulseIn + 4, t) * pulseEnv;
    S.bands = music ? [music.low, music.mid, music.high] : [0.2, 0.2, 0.2];

    /* ---------- the fallen sign beside her ---------- */
    let heroA = 0, letters = 4;
    const dies = B.fracture.loveSignDies;
    if (t < dies + 3) {
      const k = Math.floor(t * 9);
      heroA = (U.hash(k * 0.37) > (t > 15 ? 0.4 : 0.15) ? 1 : 0.15) * (0.85 + 0.15 * Math.sin(t * 37));
      letters = t < 15 ? 4 : t < 18.5 ? 3 : t < dies ? 2 : (U.hash(k) > 0.85 ? 1 : 0);
      if (t > dies) heroA *= U.hash(k * 1.3) > 0.75 ? 0.6 : 0;
      if (t < 2) heroA *= U.smooth(0.3, 2, t);
    }
    S.heroA = heroA; S.heroALetters = letters;
    let heroB = 0;
    const sh = B.reclaiming.stillHere;
    if (t > sh) { const x = t - sh; heroB = x > 2.5 ? 1 : (U.hash(Math.floor(t * 14)) > 0.5 - x * 0.2 ? Math.min(1, U.smooth(0, 2.5, x) + 0.3) : 0); heroB *= 0.92 + 0.08 * Math.sin(t * 3); }
    if (heroB > 0.5 && !stillHereEmitted && playing) { stillHereEmitted = true; U.emit('stillHere'); }
    S.heroB = heroB * (1 - U.smooth(70, 74, t));
    S.smallLight = t < 32 ? (U.hash(Math.floor(t * 6)) > 0.8 ? 0.4 : 0.05) : U.smooth(0.08, 0.2, S.restore);
    S.holoPower = U.smooth(0.3, 0.8, S.restore);
    S.beamPower = U.smooth(0.35, 0.85, S.restore);

    /* ---------- colour of the returning light (voice pitch) ---------- */
    let target = [1.0, 0.68, 0.42];
    if (input.active && input.level > 0.08) {
      const p = input.pitch;
      target = p < 0.5 ? lerp3([1.0, 0.4, 0.55], [1.0, 0.68, 0.42], p * 2) : lerp3([1.0, 0.68, 0.42], [0.35, 0.9, 1.0], (p - 0.5) * 2);
    }
    tint = lerp3(tint, target, 1 - Math.exp(-dt * 1.2));
    S.tint = tint;

    /* ---------- flight, cloud, sunrise ---------- */
    S.dawn = U.smooth(79, 88, t);
    S.sun = U.smooth(83.5, 87, t);
    S.cloudGlow = U.smooth(66, 74, t) * (1 - 0.85 * U.smooth(84.2, 86.8, t));
    S.title = U.smooth(B.afterglow.title, B.afterglow.title + 1.5, t);

    /* ---------- atmosphere & grade ---------- */
    const R = S.restore, dawn = S.dawn;
    const shock = impact * (ch === 'fracture' ? 1 : 0);
    S.fogDensity = U.lerp(0.0044, 0.0028, R) * (1 - dawn * 0.6);
    S.fogFalloff = 0.011;
    S.fogLow = lerp3(lerp3([0.06, 0.075, 0.11], [0.24, 0.1, 0.23], R * 0.9), [0.4, 0.22, 0.3], dawn * 0.6);
    S.fogHigh = lerp3(lerp3([0.08, 0.1, 0.145], [0.12, 0.1, 0.2], R), [0.26, 0.22, 0.36], dawn * 0.6);
    S.ambSky = lerp3(lerp3([0.17, 0.21, 0.31], [0.22, 0.2, 0.36], R), [0.55, 0.45, 0.55], dawn * 0.6);
    S.ambGround = lerp3(lerp3([0.04, 0.045, 0.07], [0.32, 0.1, 0.26], R), [0.45, 0.3, 0.32], dawn * 0.5);
    S.zenith = lerp3(lerp3([0.02, 0.026, 0.05], [0.03, 0.03, 0.08], R), [0.2, 0.28, 0.55], dawn * 0.85);
    S.horizon = lerp3(lerp3([0.1, 0.12, 0.17], [0.2, 0.1, 0.24], R), [0.85, 0.42, 0.42], dawn * 0.8);
    S.cityGlow = lerp3([0.035, 0.04, 0.065], [0.5, 0.12, 0.42], R);
    S.cloud = U.lerp(1.0, 0.65, R) * (1 - 0.7 * dawn);
    S.sat = U.lerp(0.42, 1.15, U.smooth(0, 0.8, R)) * (1 - 0.35 * shock);
    S.lift = lerp3([0.0, 0.008, 0.028], [0.012, 0.004, 0.018], R);
    S.gain = lerp3(lerp3([0.92, 0.97, 1.08], [1.06, 1.0, 0.96], R), [1.1, 1.0, 0.94], dawn);
    S.gain = lerp3(S.gain, [1.25, 0.95, 1.05], shock * 0.5);
    S.exposure = 1.22 + 0.08 * R + shock * 0.25 - 0.3 * S.sun;

    /* ---------- fades ---------- */
    let fade = 1 - U.smooth(0.2, B.numbness.fadeIn, t);
    if (firstLight === null && t > fl.windowStart) fade = Math.max(fade, 0.45 * U.smooth(fl.windowStart, fl.firstLightDefault, t));
    else if (t >= tf && t < tf + 3) fade = Math.max(fade, 0.45 * (1 - U.smooth(tf, tf + 2.5, t)));
    fade = Math.max(fade, 0.35 * U.smooth(88.6, 90, t));
    S.fade = fade;

    /* ---------- her body ---------- */
    const rate = ch === 'numbness' ? U.lerp(0.22, 0.16, calm) : ch === 'fracture' ? 0.32 : 0.2;
    breathPhase += fdt * rate * Math.PI * 2;
    S.breath = 0.5 + 0.5 * Math.sin(breathPhase);
    S.wet = U.lerp(1, 0.3, R);

    /* ---------- UI hint ---------- */
    S.hint = '';
    if (t >= fl.windowStart && t < fl.firstLightDefault && firstLight === null)
      S.hint = input.micOn ? 'the city is listening — hum, or hold the light' : 'hold the mouse (or L) to send a little light';
    else if ((ch === 'awakening' && t > tf + 2 && t < 44) || (ch === 'reclaiming' && t < 52)) S.hint = input.micOn ? 'a steady, gentle sound helps the light travel' : 'hold to help the light travel';

    S.firstLight = firstLight;
    S.inSilence = ch === 'numbness';
    S.inRecon = ch === 'awakening' || ch === 'reclaiming';
    S.coda = ch === 'afterglow';
    prevT = t;
    return S;
  }

  return { compute, reset, state: S };
})();
