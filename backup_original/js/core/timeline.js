/* =====================================================================
   Timeline — the film clock, the chapter state machine and the
   INTERACTIVE GATES.
   ---------------------------------------------------------------------
   Story, camera shots and score are functions of film time, so pause,
   seek and replay stay in sync by construction.

   Gates (config.gates): when film time reaches an unsolved gate it stops
   there and `holding` is set. While holding, `animTime` keeps advancing,
   so rain, traffic, flicker and the music loop stay alive while the story
   waits for the viewer. Solving the gate (AG.Interact) releases it.
   Seeking past a gate solves it automatically; seeking back before a
   solved gate re-arms it (AG.Interact.onSeek undoes its changes), so every
   chapter looks right after any seek.

   With an MP3 soundtrack the clock follows audio.currentTime except while
   holding (the audio loops the bars before the gate, see audio.js).
   ===================================================================== */
window.AG = window.AG || {};

AG.Timeline = (function () {
  const C = AG.CONFIG;
  const st = { time: 0, playing: false, ended: false, chapter: null, started: false, holding: null, holdTime: 0, holdTotal: 0 };

  function chapterAt(t) {
    const list = C.chapters.filter((c) => c.start !== undefined);
    for (let i = list.length - 1; i >= 0; i--) if (t >= list[i].start) return list[i];
    return list[0];
  }

  function solved(g) { return AG.Interact ? AG.Interact.isSolved(g.id) : true; }

  function update(dt) {
    if (st.playing) {
      if (st.holding) {
        st.holdTime += dt; st.holdTotal += dt;
      } else {
        const prev = st.time;
        const media = AG.Audio && AG.Audio.mediaTime ? AG.Audio.mediaTime() : null;
        let next = media !== null ? media - C.soundtrack.offset : prev + dt;
        for (const g of C.gates) {
          if (!solved(g) && prev <= g.t + 1e-4 && next >= g.t) {
            next = g.t; st.holding = g; st.holdTime = 0;
            AG.U.emit('gate', g);
            break;
          }
        }
        st.time = next;
        if (st.time >= C.filmLength) {
          st.time = C.filmLength;
          st.playing = false; st.ended = true;
          AG.U.emit('ended');
          AG.U.emit('playstate', false);
        }
      }
    }
    const ch = chapterAt(st.time);
    if (ch !== st.chapter) {
      const prev = st.chapter;
      st.chapter = ch;
      AG.U.emit('chapter', { chapter: ch, prev });
    }
  }

  /* called by AG.Interact when the viewer solves the current gate */
  function release(id) {
    if (!st.holding || st.holding.id !== id) return;
    const g = st.holding;
    st.holding = null;
    AG.U.emit('gateRelease', g);
  }

  function play() {
    if (st.ended) { seek(0); AG.U.emit('replay'); }
    st.playing = true; st.started = true;
    AG.U.emit('playstate', true);
  }
  function pause() { st.playing = false; AG.U.emit('playstate', false); }
  function toggle() { st.playing ? pause() : play(); }
  function seek(t) {
    st.time = AG.U.clamp(t, 0, C.filmLength - 0.05);
    st.ended = false;
    st.holding = null; st.holdTime = 0;
    AG.U.emit('seek', st.time);
    // landing exactly on an unsolved gate holds there at once
    for (const g of C.gates) if (!solved(g) && Math.abs(st.time - g.t) < 1e-3) { st.holding = g; AG.U.emit('gate', g); }
  }
  function replay() { seek(0); AG.U.emit('replay'); play(); }

  return {
    state: st, update, play, pause, toggle, seek, replay, release, chapterAt,
    get time() { return st.time; },
    get animTime() { return st.time + st.holdTotal; },
    get playing() { return st.playing; },
    get holding() { return st.holding; },
    get holdTime() { return st.holdTime; },
    get chapter() { return st.chapter; }
  };
})();
