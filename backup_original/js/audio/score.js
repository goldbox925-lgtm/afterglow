/* =====================================================================
   Generative score — the fallback soundtrack (90 s)
   ---------------------------------------------------------------------
   Plays whenever assets/audio/soundtrack.mp3 is absent. Every note is a
   deterministic function of film time on a beat grid that puts a
   downbeat exactly on the climax (71 s), so pause / seek / replay
   reproduce the same music in sync with the picture.

   01 NUMBNESS     drone, rain, a few hesitant piano notes (D minor)
   02 FRACTURE     the drone turns dissonant; impacts (audio.js) + glitches
   03 AWAKENING    one bell at the first light, then a slow rising melody
   04 RECLAIMING   warm pads (Dmaj9 → Bm7 → Gmaj7 → Asus), plucks, a heartbeat
   05 AFTERGLOW    riser → DROP at 71 s: pulse, arps, shimmer · riser →
                   cloud crash at 81 s · sunrise chord at 85 s · title bell
   ===================================================================== */
window.AG = window.AG || {};

AG.Score = (function () {
  const U = AG.U, B = AG.CONFIG.beats;
  const BPM = 72, BEAT = 60 / BPM, BAR = BEAT * 4, STEP = BEAT / 4;
  // The score is authored on a 90 s "music time" (climax 71 s, cloud 81 s);
  // musicTime() maps film time onto it and loops a passage while a gate waits.
  const CLIMAX = 71, CLOUD = 81, TITLE = 86.3;
  const ORIGIN = CLIMAX - Math.floor(CLIMAX / STEP) * STEP; // grid passes through the climax
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let ctx, out, rev, delay, droneG, droneF, tense, padG, padF, shimmerG;
  const pad = [];
  let scheduledTo = 0;

  const PROG = [[50, 54, 57, 64], [47, 50, 54, 57], [43, 50, 54, 59], [45, 52, 57, 59]]; // Dmaj9 Bm7 Gmaj7 Asus2
  const FINAL = [38, 50, 54, 57, 64, 66];
  const MINOR = [62, 65, 67, 69, 72, 74];
  const MAJOR = [62, 64, 66, 69, 71, 74, 76, 78, 81];

  function chordAt(t) {
    if (t >= 85) return FINAL.slice(1, 5);
    const barsPer = t >= 71 ? 1 : 2;
    const i = Math.floor(Math.max(0, t - 48) / (BAR * barsPer)) % PROG.length;
    return PROG.at(i);
  }

  function osc(type, f, dest, g) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const gg = ctx.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(dest); o.start(); return o; }

  function init(c, bus, reverbIn) {
    ctx = c; out = ctx.createGain(); out.gain.value = 0.8; out.connect(bus);
    rev = reverbIn;
    delay = ctx.createDelay(2); delay.delayTime.value = BEAT * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2600;
    delay.connect(dl); dl.connect(fb); fb.connect(delay);
    const dOut = ctx.createGain(); dOut.gain.value = 0.32; dl.connect(dOut); dOut.connect(out);
    // drone (+ a tritone that only sounds during the fracture)
    droneF = ctx.createBiquadFilter(); droneF.type = 'lowpass'; droneF.frequency.value = 220; droneF.Q.value = 2;
    droneG = ctx.createGain(); droneG.gain.value = 0; droneF.connect(droneG); droneG.connect(out); droneG.connect(rev);
    osc('sawtooth', mtof(38), droneF, 0.5).detune.value = -6;
    osc('sawtooth', mtof(38), droneF, 0.5).detune.value = 5;
    osc('sawtooth', mtof(45), droneF, 0.4);
    osc('sine', mtof(26), droneF, 0.8);
    tense = ctx.createGain(); tense.gain.value = 0; tense.connect(droneF);
    osc('sawtooth', mtof(44), tense, 0.6); osc('square', mtof(51), tense, 0.25);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05; const lg = ctx.createGain(); lg.gain.value = 90; lfo.connect(lg); lg.connect(droneF.frequency); lfo.start();
    // pad
    padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 500; padF.Q.value = 0.6;
    padG = ctx.createGain(); padG.gain.value = 0; padF.connect(padG); padG.connect(out); padG.connect(rev);
    for (let v = 0; v < 4; v++) pad.push([osc('triangle', 220, padF, 0.6), osc('sawtooth', 220, padF, 0.3)]);
    pad.forEach((pr) => { pr[0].detune.value = -7; pr[1].detune.value = 7; });
    // shimmer (afterglow): high octaves
    shimmerG = ctx.createGain(); shimmerG.gain.value = 0; shimmerG.connect(rev); shimmerG.connect(out);
    [86, 93, 98].forEach((m, i) => { const o = osc('sine', mtof(m), shimmerG, 0.3 - i * 0.07); o.detune.value = i * 3; });
  }

  function resync(t) { scheduledTo = t; }

  /* film time → music time. 0–3 numbness · 3–15 → the fracture (15–27) ·
     15–21 → the first light (32–38) · 21+ → reclaiming & flight (+26.8 s).
     While a gate waits: loop a searching passage (find) or the rising
     melody (restore), so the music lives while the story holds. */
  const LOOPS = { find: [6, 14], restore: [38, 46] };
  function musicTime(t, hold, holdT) {
    if (hold) { const L = LOOPS[hold.id] || [6, 14]; return L[0] + (holdT % (L[1] - L[0])); }
    if (t < 3) return t;
    if (t < 15) return t + 12;
    if (t < 21) return t + 17;
    return t + 26.8;
  }
  function set(param, v, tc) { param.setTargetAtTime(v, ctx.currentTime, tc); }

  function update(t, dt, S) {
    if (!ctx) return;
    // jumps (loop wrap, section change, seek): restart scheduling here, never back-fill
    if (t < scheduledTo - 0.5 || t > scheduledTo + 1.0) scheduledTo = t - 0.02;
    const frac = t >= 15 && t < 32;
    let dg = t < 15 ? 0.05 * U.smooth(0.5, 4, t) : frac ? 0.07 : t < 48 ? U.lerp(0.06, 0.03, U.smooth(32, 46, t)) : t < 65 ? 0.022 : 0.012;
    if (t > 86) dg *= 1 - U.smooth(86, 90, t);
    set(droneG.gain, dg, 0.8);
    set(tense.gain, frac ? 0.5 + 0.5 * S.impact : 0, 0.3);
    set(droneF.frequency, frac ? 340 + 600 * S.impact : 160 + 220 * S.restore, 0.4);
    let pg = t < 36 ? 0 : t < 48 ? 0.035 * U.smooth(36, 44, t) : t < 65 ? U.lerp(0.04, 0.075, U.smooth(48, 60, t)) : 0.1;
    if (t > 87) pg *= 1 - U.smooth(87, 90, t);
    set(padG.gain, pg, 1.2);
    set(padF.frequency, 350 + 2600 * Math.pow(S.restore, 1.3) + (t > 71 ? 1500 : 0), 1.5);
    const ch = t < 48 ? [50, 54, 57, 64] : chordAt(t);
    pad.forEach((pr, i) => pr.forEach((o) => set(o.frequency, mtof(ch.at(i)), 0.5)));
    set(shimmerG.gain, t >= 71 ? 0.014 * (1 - U.smooth(87, 90, t)) : 0, 1.2);

    const ahead = t + 0.3;
    let i = Math.ceil((scheduledTo - ORIGIN) / STEP - 1e-6);
    if (ahead - scheduledTo > 2) i = Math.ceil((t - 0.02 - ORIGIN) / STEP);
    for (; ORIGIN + i * STEP < ahead; i++) {
      const te = ORIGIN + i * STEP;
      if (te < t - 0.05) continue;
      events(i, te, ctx.currentTime + (te - t), S);
    }
    // one-shots: risers, crashes, the sunrise chord, the title bell
    [[65.5, (w) => riser(5.5, w)], [CLIMAX, (w) => crash(0.9, w)], [78.4, (w) => riser(2.6, w)], [CLOUD, (w) => { crash(0.8, w); whoosh(w); }],
     [85, (w) => chordBells(FINAL, 0.06, 8, w)], [TITLE, (w) => chordBells([74, 81, 86], 0.05, 7, w)]]
      .forEach(([tt, fn]) => { if (tt >= scheduledTo && tt < ahead && tt >= t - 0.05) fn(ctx.currentTime + Math.max(0, tt - t)); });
    scheduledTo = ahead;
  }

  function events(i, te, when, S) {
    const sub = ((i % 4) + 4) % 4, beat = Math.floor(i / 4);
    const h = U.hash(i * 1.618), h2 = U.hash(i * 2.414 + 7);
    // piano / melody
    if (sub % 2 === 0) {
      let p = 0, note = null;
      if (te < 15) { p = 0.05 * U.smooth(3, 7, te); note = MINOR.at(Math.floor(h2 * MINOR.length)); }
      else if (te >= 33 && te < 48) { p = sub === 0 && beat % 2 === 0 ? 0.9 : 0; note = MAJOR.at(Math.min(MAJOR.length - 1, Math.floor((te - 33) / 2.2) % 9)); }
      else if (te >= 48 && te < 65) { p = 0.24; const c = chordAt(te); note = c.at(Math.floor(h2 * 4)) + 12 * (h2 > 0.5 ? 1 : 2); }
      else if (te >= 65 && te < 86) { p = te < 71 ? 0.12 : 0.3; const c = chordAt(te); note = c.at(Math.floor(h2 * 4)) + 24; }
      if (note && h < p) piano(mtof(Math.min(note, 90)), when, 0.06 + 0.05 * U.hash(i * 3.7));
    }
    // plucked arpeggio
    if (te > 52 && te < 86 && sub % 2 === 0) {
      const dens = te < 65 ? 0.45 : te < 71 ? 0.25 : 0.95;
      if (U.hash(i * 5.3) < dens) { const c = chordAt(te), idx = Math.floor(i / 2) % 4; pluck(mtof(c.at(idx) + 12 + (te >= 71 ? 12 * (idx % 2) : 0)), when, te >= 71 ? 0.05 : 0.04, idx % 2 ? 0.45 : -0.45); }
    }
    // heartbeat (reclaiming) → driving pulse after the drop
    if (sub === 0) {
      if (te >= 54 && te < 65) { const g = U.smooth(54, 58, te) * 0.45; kick(when, g); kick(when + BEAT * 0.28, g * 0.5); }
      if (te >= CLIMAX && te < 85) kick(when, 0.8);
    }
    if (te >= CLIMAX && te < 84.6 && (sub === 2 || U.hash(i * 9.1) < 0.35)) hat(when, sub === 2 ? 0.03 : 0.012);
  }

  function piano(f, when, v) {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(out); g.connect(rev); g.connect(delay);
    [[1, 1], [2.0, 0.32], [3.01, 0.12], [4.2, 0.04]].forEach(([m, a]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
      const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(when); o.stop(when + 4.5);
    });
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(v, when + 0.006);
    g.gain.exponentialRampToValueAtTime(v * 0.3, when + 0.6); g.gain.exponentialRampToValueAtTime(0.0003, when + 4.2);
  }
  function pluck(f, when, v, panv) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass';
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner(); p.pan.value = panv;
    o.connect(fl); fl.connect(g); g.connect(p); p.connect(out); g.connect(delay);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(v, when + 0.004); g.gain.exponentialRampToValueAtTime(0.0003, when + 0.7);
    fl.frequency.setValueAtTime(3400, when); fl.frequency.exponentialRampToValueAtTime(500, when + 0.5);
    o.start(when); o.stop(when + 0.8);
  }
  function kick(when, v) {
    if (v <= 0.001) return;
    const o = ctx.createOscillator(); o.type = 'sine';
    const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(out);
    o.frequency.setValueAtTime(115, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.13);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(v, when + 0.005); g.gain.exponentialRampToValueAtTime(0.0003, when + 0.42);
    o.start(when); o.stop(when + 0.45);
  }
  function hat(when, v) {
    const n = ctx.createBufferSource(); n.buffer = AG.Audio.noise.white;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const g = ctx.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(out);
    g.gain.setValueAtTime(v, when); g.gain.exponentialRampToValueAtTime(0.0002, when + 0.06);
    n.start(when, Math.random() * 3); n.stop(when + 0.08);
  }
  function riser(dur, when) {
    const n = ctx.createBufferSource(); n.buffer = AG.Audio.noise.white;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    const g = ctx.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(out); g.connect(rev);
    f.frequency.setValueAtTime(300, when); f.frequency.exponentialRampToValueAtTime(7000, when + dur);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.16, when + dur);
    g.gain.setValueAtTime(0.0001, when + dur + 0.02);
    n.start(when); n.stop(when + dur + 0.05);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const og = ctx.createGain(); og.gain.value = 0; o.connect(og); og.connect(rev);
    o.frequency.setValueAtTime(mtof(50), when); o.frequency.exponentialRampToValueAtTime(mtof(74), when + dur);
    og.gain.setValueAtTime(0.0001, when); og.gain.exponentialRampToValueAtTime(0.03, when + dur);
    og.gain.setValueAtTime(0.0001, when + dur + 0.02);
    o.start(when); o.stop(when + dur + 0.05);
  }
  function crash(v, when) {
    const n = ctx.createBufferSource(); n.buffer = AG.Audio.noise.white;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(out); g.connect(rev);
    g.gain.setValueAtTime(0.22 * v, when); g.gain.exponentialRampToValueAtTime(0.0005, when + 3.5);
    n.start(when, Math.random()); n.stop(when + 3.6);
    kick(when, 0.95 * v);
    const o = ctx.createOscillator(); o.type = 'sine'; const og = ctx.createGain(); og.gain.value = 0; o.connect(og); og.connect(out);
    o.frequency.setValueAtTime(55, when); o.frequency.exponentialRampToValueAtTime(30, when + 2);
    og.gain.setValueAtTime(0.5 * v, when); og.gain.exponentialRampToValueAtTime(0.0005, when + 2.4);
    o.start(when); o.stop(when + 2.5);
  }
  function whoosh(when) {
    const n = ctx.createBufferSource(); n.buffer = AG.Audio.noise.pink;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(out); g.connect(rev);
    f.frequency.setValueAtTime(5000, when); f.frequency.exponentialRampToValueAtTime(400, when + 3);
    g.gain.setValueAtTime(0.25, when); g.gain.exponentialRampToValueAtTime(0.0005, when + 3.2);
    n.start(when); n.stop(when + 3.3);
  }
  function chordBells(notes, v, decay, when) {
    notes.forEach((m, i) => {
      const f = mtof(m + 12);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(out); g.connect(rev);
      const st = when + i * 0.07;
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(v, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0004, st + decay);
      o.start(st); o.stop(st + decay + 0.1);
    });
  }

  return { init, update, resync, musicTime };
})();
