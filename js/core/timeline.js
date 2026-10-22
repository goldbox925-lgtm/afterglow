/* =====================================================================
   Timeline — the film clock and the chapter state machine.
   ---------------------------------------------------------------------
   One clock drives everything: camera shots, story state, score and
   environmental effects are all *functions of film time*, so pausing,
   seeking and replaying keep sound and image in sync by construction.
   When an MP3 soundtrack is present, the clock follows the audio
   element's currentTime (the music is the master); otherwise it runs on
   requestAnimationFrame deltas.
   ===================================================================== */
window.AG = window.AG || {};

AG.Timeline = (function () {
  const C = AG.CONFIG;
  const st = { time: 0, playing: false, ended: false, chapter: null, started: false };

  function chapterAt(t) {
    const list = C.chapters.filter((c) => c.start !== undefined);
    for (let i = list.length - 1; i >= 0; i--) if (t >= list[i].start) return list[i];
    return list[0];
  }

  function update(dt) {
    if (st.playing) {
      const media = AG.Audio && AG.Audio.mediaTime ? AG.Audio.mediaTime() : null;
      if (media !== null) st.time = media - C.soundtrack.offset;
      else st.time += dt;
      if (st.time >= C.filmLength) {
        st.time = C.filmLength;
        st.playing = false; st.ended = true;
        AG.U.emit('ended');
        AG.U.emit('playstate', false);
      }
    }
    const ch = chapterAt(st.time);
    if (ch !== st.chapter) {
      const prev = st.chapter;
      st.chapter = ch;
      AG.U.emit('chapter', { chapter: ch, prev });
    }
  }

  function play() {
    if (st.ended) seek(0);
    st.playing = true; st.started = true;
    AG.U.emit('playstate', true);
  }
  function pause() { st.playing = false; AG.U.emit('playstate', false); }
  function toggle() { st.playing ? pause() : play(); }
  function seek(t) {
    st.time = AG.U.clamp(t, 0, C.filmLength - 0.05);
    st.ended = false;
    AG.U.emit('seek', st.time);
  }
  function replay() { seek(0); AG.U.emit('replay'); play(); }

  return {
    state: st, update, play, pause, toggle, seek, replay, chapterAt,
    get time() { return st.time; },
    get playing() { return st.playing; },
    get chapter() { return st.chapter; }
  };
})();
