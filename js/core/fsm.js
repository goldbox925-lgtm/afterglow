/* =====================================================================
   FSM — the five emotional states.
   ---------------------------------------------------------------------
        NUMBNESS ──(find the flickering window)──► FRACTURE
        FRACTURE ──(click 4 highlighted lights)──► AWAKENING
        AWAKENING ──(wake 5 dark buildings)──────► RECLAIMING_SELF
        RECLAIMING_SELF ──(make 5 city links)────► AFTERGLOW
        AFTERGLOW: FREE_FLIGHT ⇄ ASCENSION (hold ↑)  ──(cross the light)──► finale

   States change ONLY through AG.FSM.advance(), which the interaction
   modules call when the viewer completes something meaningful. Time is
   never used to move the story: `stateTime` (seconds in the current
   state) and `animTime` (seconds since the start) exist only for local
   animation, camera easing and sound.

   A short scripted moment (the opening, the lift-off, the finale) sets
   `cinematic`; while it runs, camera and character are directed and
   input is ignored, then control is handed back.

   AG.Timeline is kept as a thin alias so older code that asks
   "is it playing?" keeps working.
   ===================================================================== */
window.AG = window.AG || {};

AG.FSM = (function () {
  const U = AG.U, C = AG.CONFIG;
  const ORDER = C.states.map((s) => s.id);
  const F = {
    state: 'NUMBNESS', mode: null, playing: false, started: false,
    stateTime: 0, animTime: 0, modeTime: 0,
    cinematic: null,        // { name, t, dur }
    finished: false
  };

  function index(id) { return ORDER.indexOf(id || F.state); }

  function setState(id, why) {
    const prev = F.state;
    if (prev === id) return;
    F.state = id; F.stateTime = 0;
    F.mode = id === 'AFTERGLOW' ? 'FREE_FLIGHT' : null; F.modeTime = 0;
    U.emit('state', { state: id, prev, why: why || 'user' });
  }

  /* called by the interaction modules when the viewer completes a state */
  function advance(from) {
    if (from && from !== F.state) return;
    const i = index();
    if (i < ORDER.length - 1) setState(ORDER[i + 1], 'user');
  }

  /* presentation / testing: jump to a state; earlier states complete with default choices */
  function jumpTo(id) {
    const target = index(id);
    if (target < 0) return;
    U.emit('jump', { from: F.state, to: id });
    F.finished = false;
    F.cinematic = null;
    if (target < index()) { U.emit('reset'); F.state = 'NUMBNESS'; F.stateTime = 0; F.mode = null; }
    while (index() < target) {
      U.emit('autoComplete', { state: F.state });
      setState(ORDER[index() + 1], 'jump');
    }
    U.emit('state', { state: F.state, prev: F.state, why: 'jump' });
  }

  function setMode(m) {
    if (F.state !== 'AFTERGLOW' || F.mode === m) return;
    F.mode = m; F.modeTime = 0;
    U.emit('mode', m);
  }

  function startCinematic(name, dur) { F.cinematic = { name, t: 0, dur }; U.emit('cinematic', name); }

  function update(dt) {
    if (!F.playing) return;
    F.animTime += dt; F.stateTime += dt; F.modeTime += dt;
    if (F.cinematic) {
      F.cinematic.t += dt;
      if (F.cinematic.t >= F.cinematic.dur) { const n = F.cinematic.name; F.cinematic = null; U.emit('cinematicEnd', n); }
    }
  }

  function play() { F.playing = true; F.started = true; U.emit('playstate', true); }
  function pause() { F.playing = false; U.emit('playstate', false); }
  function toggle() { F.playing ? pause() : play(); }
  function replay() {
    U.emit('reset');
    F.state = 'NUMBNESS'; F.mode = null; F.stateTime = 0; F.modeTime = 0; F.finished = false; F.cinematic = null;
    U.emit('state', { state: 'NUMBNESS', prev: null, why: 'replay' });
    U.emit('replay');
    play();
  }

  return Object.assign(F, { ORDER, index, advance, jumpTo, setMode, startCinematic, update, play, pause, toggle, replay,
    get inCinematic() { return !!F.cinematic; },
    cin(name) { return F.cinematic && F.cinematic.name === name ? F.cinematic : null; } });
})();

/* compatibility alias */
AG.Timeline = {
  get playing() { return AG.FSM.playing; },
  get time() { return AG.FSM.stateTime; },
  get animTime() { return AG.FSM.animTime; },
  play: () => AG.FSM.play(), pause: () => AG.FSM.pause(), toggle: () => AG.FSM.toggle()
};
