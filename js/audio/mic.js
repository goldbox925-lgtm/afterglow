/* =====================================================================
   Voice Mode (optional microphone)
   ---------------------------------------------------------------------
   Permission is requested ONLY when the viewer turns Voice Mode on.
   The signal is analysed, never recorded or sent anywhere, and never
   routed to the speakers (no feedback).

   Features (all smoothed to avoid jitter):
     level    0..1  loudness above an adaptive noise floor (× sensitivity)
     pitch    0..1  spectral brightness (centroid, log-scaled 120 Hz–3 kHz)
     sustain  0..1  how long a steady, moderate sound has been held
     silence  sec   how long it has been quiet
     burst    0..1  sudden loud peaks
   These are acoustic descriptors — nothing here claims to detect emotion.
   ===================================================================== */
window.AG = window.AG || {};

AG.Mic = (function () {
  const U = AG.U;
  const M = {
    state: 'off', message: '', sensitivity: 1.0,
    level: 0, pitch: 0.5, sustain: 0, silence: 0, burst: 0, raw: 0
  };
  let stream = null, src = null, an = null, td = null, fd = null;
  let floor = -60, sustainT = 0, prevRaw = 0;

  async function start(ctx) {
    if (M.state === 'on' || M.state === 'requesting') return;
    if (!window.isSecureContext) { setState('insecure', 'Voice needs HTTPS or localhost'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setState('unavailable', 'This browser has no microphone API'); return; }
    setState('requesting', 'Waiting for permission…');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (ctx.state === 'suspended') await ctx.resume();
      src = ctx.createMediaStreamSource(stream);
      an = ctx.createAnalyser();
      an.fftSize = 2048; an.smoothingTimeConstant = 0.35;
      src.connect(an); // deliberately NOT connected to the destination
      td = new Float32Array(an.fftSize); fd = new Float32Array(an.frequencyBinCount);
      floor = -60; sustainT = 0;
      setState('on', 'Listening');
    } catch (e) {
      const name = e && e.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') setState('denied', 'Microphone blocked — the film continues; everything works with the mouse');
      else if (name === 'NotFoundError') setState('unavailable', 'No microphone found — everything works with the mouse');
      else setState('unavailable', 'Microphone unavailable');
    }
  }

  function stop() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (src) try { src.disconnect(); } catch (e) {}
    stream = src = an = null;
    M.level = M.sustain = M.burst = 0;
    setState('off', '');
  }

  function setState(s, msg) { M.state = s; M.message = msg; U.emit('mic', M); }

  function update(dt, sampleRate) {
    if (M.state !== 'on' || !an) { M.level = U.damp(M.level, 0, 6, dt); M.silence += dt; return; }
    an.getFloatTimeDomainData(td);
    let s = 0;
    for (let i = 0; i < td.length; i++) s += td[i] * td[i];
    const rms = Math.sqrt(s / td.length);
    const db = 20 * Math.log10(rms + 1e-9);
    // adaptive noise floor: falls fast, rises slowly
    if (db < floor) floor = U.damp(floor, db, 4, dt); else floor += dt * 1.2;
    floor = U.clamp(floor, -85, -30);
    const raw = U.clamp(((db - floor - 5) / 38) * M.sensitivity, 0, 1);
    M.raw = raw;
    M.level = raw > M.level ? U.damp(M.level, raw, 14, dt) : U.damp(M.level, raw, 3.5, dt);
    // spectral centroid
    if (M.level > 0.06) {
      an.getFloatFrequencyData(fd);
      const binHz = sampleRate / an.fftSize;
      let num = 0, den = 0;
      const i0 = Math.floor(80 / binHz), i1 = Math.min(fd.length - 1, Math.floor(5000 / binHz));
      for (let i = i0; i <= i1; i++) { const m = Math.pow(10, fd[i] / 20); num += m * i * binHz; den += m; }
      const c = den > 0 ? num / den : 500;
      const p = U.clamp(Math.log(c / 120) / Math.log(3000 / 120), 0, 1);
      M.pitch = U.damp(M.pitch, p, 2.5, dt);
    }
    // sustain: a steady, moderate sound held over time
    const steady = Math.abs(raw - prevRaw) < 0.12;
    if (M.level > 0.09 && M.level < 0.85 && steady) sustainT += dt; else sustainT = Math.max(0, sustainT - dt * 1.6);
    sustainT = Math.min(sustainT, 4);
    M.sustain = U.smooth(0.35, 1.8, sustainT);
    prevRaw = U.damp(prevRaw, raw, 8, dt);
    // silence & bursts
    if (M.level < 0.05) M.silence += dt; else M.silence = 0;
    if (raw > 0.72 && raw - prevRaw > 0.05) M.burst = Math.max(M.burst, raw);
    M.burst = Math.max(0, M.burst - dt * 1.4);
  }

  return Object.assign(M, { start, stop, update });
})();

/* =====================================================================
   Input — merges Voice Mode with mouse/keyboard so the experience is
   complete without a microphone. Holding the mouse still (or holding L)
   is a "sustained, gentle sound"; stillness is "silence".
   ===================================================================== */
AG.Input = (function () {
  const U = AG.U;
  const I = { level: 0, pitch: 0.5, sustain: 0, silence: 0, burst: 0, active: false, micOn: false,
    mx: 0, my: 0, dragDX: 0, dragDY: 0, wheel: 0, dragging: false, holding: false };
  let hold = 0, holdT = 0, idle = 0, down = false, moved = 0, keyHold = false;
  let rawMX = 0, rawMY = 0, ddx = 0, ddy = 0, wh = 0;
  let downT = 0, pendingClick = null, pendingEnter = false, pendingPress = null, pendingRelease = null;

  function bind(canvasEl) {
    window.addEventListener('pointermove', (e) => {
      rawMX = (e.clientX / window.innerWidth) * 2 - 1;
      rawMY = (e.clientY / window.innerHeight) * 2 - 1;
      I.px = e.clientX; I.py = e.clientY;
      if (down) { ddx += e.movementX || 0; ddy += e.movementY || 0; moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); }
      idle = 0;
    });
    canvasEl.addEventListener('pointerdown', (e) => { if (e.button === 0) { down = true; moved = 0; downT = performance.now(); I.px = e.clientX; I.py = e.clientY; pendingPress = { x: e.clientX, y: e.clientY }; } idle = 0; });
    // a CLICK = a short press that barely moved (a longer or moving press is a drag / hold)
    window.addEventListener('pointerup', (e) => {
      if (down && moved < 8 && performance.now() - downT < 550 && e.target === canvasEl) pendingClick = { x: e.clientX, y: e.clientY };
      if (down) pendingRelease = { x: e.clientX, y: e.clientY, moved };
      down = false;
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.repeat) pendingEnter = true; });
    canvasEl.addEventListener('wheel', (e) => { wh += e.deltaY; e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', (e) => { if ((e.key === 'l' || e.key === 'L') && !e.repeat) keyHold = true; });
    window.addEventListener('keyup', (e) => { if (e.key === 'l' || e.key === 'L') keyHold = false; });
    window.addEventListener('blur', () => { down = false; keyHold = false; });
  }

  function update(dt, sampleRate) {
    AG.Mic.update(dt, sampleRate || 48000);
    const holdingNow = keyHold || (down && moved < 10);
    I.holding = holdingNow;
    holdT = holdingNow ? holdT + dt : Math.max(0, holdT - dt * 2);
    hold = U.damp(hold, holdingNow ? 0.42 : 0, holdingNow ? 3 : 4, dt);
    idle += dt;
    const holdSustain = U.smooth(0.3, 1.5, holdT);
    const M = AG.Mic, micOn = M.state === 'on';
    I.micOn = micOn;
    I.level = Math.max(micOn ? M.level : 0, hold);
    I.sustain = Math.max(micOn ? M.sustain : 0, holdSustain);
    I.pitch = micOn && M.level > 0.08 ? M.pitch : U.damp(I.pitch, (rawMX + 1) / 2, 2, dt);
    I.burst = micOn ? M.burst : 0;
    I.silence = micOn ? Math.min(M.silence, holdingNow ? 0 : 999) : (holdingNow ? 0 : idle);
    I.active = micOn || holdingNow;
    I.mx = U.damp(I.mx, rawMX, 2.5, dt); I.my = U.damp(I.my, rawMY, 2.5, dt);
    I.dragDX = ddx; I.dragDY = ddy; I.wheel = wh; ddx = ddy = wh = 0;
    I.dragging = down && moved >= 10;
    I.click = pendingClick; pendingClick = null;
    I.pressed = pendingPress; pendingPress = null;
    I.released = pendingRelease; pendingRelease = null;
    I.down = down;
    I.enter = pendingEnter; pendingEnter = false;
    return I;
  }
  return Object.assign(I, { bind, update });
})();
