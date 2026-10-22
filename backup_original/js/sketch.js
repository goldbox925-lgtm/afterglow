/* =====================================================================
   AFTERGLOW — A City Made of Feelings
   sketch.js — p5.js (instance mode, WEBGL) glue: boot, frame loop,
   controls. The interesting work lives in the modules:
     core/     timeline (clock), story (state), camera (director)
     city/     geometry builder, sign atlas, procedural city
     character/ image-based character: assets, director (poses, flight)
     render/   passes & post-processing      shaders/  GLSL
     audio/    engine + ambience, generative score, voice mode
   ===================================================================== */
(function () {
  const U = AG.U, C = AG.CONFIG;
  let world = null, seed = 0;
  let rt = 0, entered = false, generating = false;
  let qualityMode = 'auto';
  const perf = { acc: 0, frames: 0, warm: 0, good: 0 };

  function seedFromURL() {
    const m = /seed=(\d+)/.exec(location.hash);
    return m ? parseInt(m[1], 10) : Math.floor(Math.random() * 1e6);
  }

  new p5((p) => {
    function generate(newSeed) {
      generating = true;
      seed = newSeed;
      try { history.replaceState(null, '', '#seed=' + seed); } catch (e) {}
      AG.UI.setSeed(seed);
      const t0 = performance.now();
      AG.SignAtlas.build(p);
      const w = AG.CityGenerator.generate(seed, p);
      AG.Renderer.setWorld(w);
      world = w;
      AG.CharacterDirector.setInfo(w.info);
      AG.Flight.build(w.info);
      AG.Interact.build(w.info);
      AG.Interact.onSeek(AG.Timeline.time);
      AG.Camera.setInfo(w.info);
      AG.Camera.resetShots();
      perf.warm = 0;
      generating = false;
      console.info('[AFTERGLOW] city seed', seed, JSON.stringify(w.info.stats), 'flight path', Math.round(AG.Flight.length), 'm; total', Math.round(performance.now() - t0), 'ms');
      window.__AG_READY = true;
    }

    p.setup = function () {
      p.setAttributes({ antialias: false, alpha: false, depth: true, version: 2 });
      p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
      p.setAttributes({ antialias: false, alpha: false, depth: true, version: 2 });
      p.frameRate(60);
      if (p.webglVersion !== 'webgl2') {
        AG.UI.setLoading('This experience needs WebGL 2 (current Chrome, Edge, Firefox or Safari 15+).', false);
        p.noLoop(); return;
      }
      AG.Renderer.init(p);
      AG.Input.bind(p.canvas);
      AG.UI.init(handlers);
      AG.UI.setLoading('Generating the city…', false);
      AG.CharacterAssets.load(p, 'A');
      // let the loading text paint before the heavy generation
      setTimeout(() => {
        try {
          generate(seedFromURL());
          AG.Timeline.seek(34); AG.Story.reset(34); AG.Camera.snapNext();   // a lit city behind the title
          const ready = () => AG.UI.setLoading('Headphones recommended · best in Chrome', true);
          if (AG.CharacterAssets.firstReady) ready();
          else { AG.UI.setLoading('Loading her…', false); AG.U.on('characterFirstReady', ready); setTimeout(ready, 8000); }
        } catch (e) {
          console.error(e);
          AG.UI.setLoading('Something went wrong while building the city: ' + e.message, false);
        }
      }, 60);
      wireEvents();
    };

    p.windowResized = function () {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
      AG.Renderer.resize();
      perf.warm = 0;
    };

    p.draw = function () {
      const dt = Math.min(p.deltaTime / 1000, 0.1) || 0.016;
      rt += dt;
      if (!world || generating) { p.background(0); return; }
      const ctx = AG.Audio.ctx;
      const input = AG.Input.update(dt, ctx ? ctx.sampleRate : 48000);
      AG.Timeline.update(dt);
      const t = AG.Timeline.time, playing = AG.Timeline.playing, at = AG.Timeline.animTime;
      if (entered && playing) AG.Interact.update(dt, t, at, input, AG.Camera.state);
      else if (!playing) { input.click = null; input.enter = false; }
      const music = playing ? AG.Audio.bands() : null;
      const S = AG.Story.compute(t, dt, playing, input, music, at);
      if (!entered) { S.fade = Math.max(S.fade, 0.35); }
      const CH = AG.CharacterDirector.update(t, S);
      const cam = AG.Camera.update(t, dt, rt, input);
      AG.Audio.update(S, t, dt, playing);
      AG.Renderer.freeze = U.damp(AG.Renderer.freeze, entered && !playing ? 1 : 0, 4, dt);
      AG.Renderer.letterbox = U.damp(AG.Renderer.letterbox, AG.Camera.mode === 'film' ? 1 : 0, 2, dt);
      // speed feel + the whiteout inside the luminous cloud
      AG.Renderer.speed = U.damp(AG.Renderer.speed || 0, cam.flight && CH ? CH.speedN * 0.9 : 0, 3, dt);
      let white = 0;
      if (AG.Flight.ready && S.cloudGlow > 0) {
        const c = AG.Flight.cloud, d = U.v3.sub(cam.pos, c.center);
        const q = Math.hypot(d[0] / c.radii[0], d[1] / c.radii[1], d[2] / c.radii[2]);
        white = U.smooth(1.05, 0.55, q) * 0.85 * S.cloudGlow;
      }
      AG.Renderer.white = U.damp(AG.Renderer.white || 0, white, 4, dt);
      AG.Renderer.render(S, cam, t, rt, CH, at);
      AG.UI.update(dt, t, S, input);
      adapt(dt);
      window.__AG_STATE = { t, fps: p.frameRate(), tier: AG.Renderer.getTier(), restore: S.restore, split: cam.split, pose: CH ? CH.items.map((i) => i.id).join('>') : '', flight: cam.flight,
        stage: AG.Interact.stage, restored: AG.Interact.restored, hint: AG.Interact.hintLevel, spots: AG.Interact.spots.length };
    };

    function adapt(dt) {
      perf.warm += dt;
      if (qualityMode !== 'auto' || perf.warm < 4) { perf.acc = perf.frames = 0; return; }
      perf.acc += dt; perf.frames++;
      if (perf.acc < 2.5) return;
      const fps = perf.frames / perf.acc;
      perf.acc = perf.frames = 0;
      const order = C.quality.order, cur = order.indexOf(AG.Renderer.getTier());
      if (fps < C.quality.targetFps - 8 && cur > 0) { AG.Renderer.setTier(order[cur - 1]); perf.warm = 0; perf.good = 0; }
      else if (fps > 58) { perf.good++; if (perf.good >= 3 && cur < order.indexOf('balanced')) { AG.Renderer.setTier(order[cur + 1]); perf.warm = 0; perf.good = 0; } }
      else perf.good = 0;
    }

    /* ---------------- controls ---------------- */
    const handlers = {
      toggle() { if (!entered) return; AG.Timeline.toggle(); },
      replay() { if (!entered) return; AG.Story.reset(0); AG.Camera.snapNext(); AG.Timeline.replay(); },
      seek(t) { if (!entered) return; AG.Timeline.seek(t); },
      sound() { AG.Audio.setMuted(!AG.Audio.muted); },
      voice() {
        if (!AG.Audio.ctx) { AG.UI.toast('Enter the experience first'); return; }
        if (AG.Mic.state === 'on') AG.Mic.stop(); else AG.Mic.start(AG.Audio.ctx);
      },
      regen() {
        if (generating) return;
        AG.UI.toast('Building a new city…');
        setTimeout(() => { generate(Math.floor(Math.random() * 1e6)); AG.Camera.snapNext(); AG.UI.toast('New city · seed ' + seed); }, 50);
      },
      fullscreen() {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => AG.UI.toast('Fullscreen was blocked by the browser'));
      },
      camera(m) { AG.Camera.setMode(m); },
      quality(q) { qualityMode = q; if (q !== 'auto') AG.Renderer.setTier(q); perf.warm = 0; }
    };
    AG.handlers = handlers;

    async function enter() {
      if (entered || !world) return;
      entered = true;
      AG.UI.hideIntro();
      try { await AG.Audio.init(); } catch (e) { console.warn('audio init failed', e); AG.UI.toast('Audio could not start — the film will play silently'); }
      AG.Story.reset(0);
      AG.Timeline.seek(0);
      AG.Camera.snapNext();
      AG.Timeline.play();
    }

    function wireEvents() {
      document.getElementById('btnEnter').addEventListener('click', enter);
      U.on('playstate', (pl) => { if (pl) AG.Audio.play(AG.Timeline.time); else AG.Audio.pause(); });
      // a seek solves the gates it passes (default choices) and re-arms those after it
      U.on('seek', (t) => { AG.Interact.onSeek(t); AG.Audio.seek(t); AG.Story.reset(t); AG.Camera.snapNext(); });
      document.addEventListener('visibilitychange', () => { if (document.hidden && AG.Timeline.playing) AG.Timeline.pause(); });
      // arrows / WASD: look around during a stage, steer during the flight (otherwise arrows seek)
      window.addEventListener('keyup', (e) => AG.Interact.setKey(e.key, false));
      window.addEventListener('blur', () => ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].forEach((k) => AG.Interact.setKey(k, false)));
      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
        if (!entered) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } return; }
        const k = e.key;
        if ((AG.Interact.stage || AG.Interact.flightOn) && AG.Interact.setKey(k, true)) { e.preventDefault(); return; }
        if (k === ' ') { e.preventDefault(); handlers.toggle(); }
        else if (k === 'r' || k === 'R') handlers.replay();
        else if (k === 'm' || k === 'M') handlers.sound();
        else if (k === 'v' || k === 'V') handlers.voice();
        else if (k === 'c' || k === 'C') AG.Camera.cycle();
        else if (k === 'n' || k === 'N') handlers.regen();
        else if (k === 'f' || k === 'F') handlers.fullscreen();
        else if (k === 'h' || k === 'H') AG.UI.toggleHidden();
        else if (k === '?' || k === '/') AG.UI.toggleHelp();
        else if (k === 'Escape') AG.UI.toggleHelp(false);
        else if (k >= '1' && k <= '5') handlers.seek(C.chapters.at(Number(k) - 1).start);
        else if (k === 'ArrowRight') handlers.seek(AG.Timeline.time + 5);
        else if (k === 'ArrowLeft') handlers.seek(AG.Timeline.time - 5);
        else if (k === 'q' || k === 'Q') {
          const opts = ['auto', 'low', 'balanced', 'high'];
          const nq = opts[(opts.indexOf(qualityMode) + 1) % opts.length];
          handlers.quality(nq); document.getElementById('quality').value = nq; AG.UI.toast('Quality: ' + nq);
        }
      });
    }
  }, document.getElementById('stage'));
})();
