/* =====================================================================
   Interface — minimal, cinematic, auto-hiding.
   Every control here is wired to real behaviour; nothing is decorative.
   ===================================================================== */
window.AG = window.AG || {};

AG.UI = (function () {
  const U = AG.U, C = AG.CONFIG;
  const $ = (id) => document.getElementById(id);
  let pendingCard = null;
  let idle = 0, hidden = false, forceHidden = false, cardTimer = null, lastHint = '';

  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    replay: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm16.6 3 2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4z"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1a7 7 0 0 0 6-6.9z"/></svg>',
    regen: '<svg viewBox="0 0 24 24"><path d="M3 21V9l4-3v15zm6 0V3h6v18zm8 0V8l4 2v11z"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5v2H6v3zm11-5h5v5h-2V6h-3zM6 15v3h3v2H4v-5zm12 3v-3h2v5h-5v-2z"/></svg>',
    help: '<svg viewBox="0 0 24 24"><path d="M11 18h2v-2h-2zm1-16a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0c0 2-3 1.8-3 5h2c0-2.3 3-2.5 3-5a4 4 0 0 0-4-4z"/></svg>'
  };

  function init(handlers) {
    $('btnPlay').innerHTML = ICON.play;
    $('btnReplay').innerHTML = ICON.replay;
    $('btnSound').innerHTML = ICON.soundOn;
    $('btnVoice').innerHTML = ICON.mic;
    $('btnRegen').innerHTML = ICON.regen;
    $('btnFull').innerHTML = ICON.full;
    $('btnHelp').innerHTML = ICON.help;

    // chapter chips
    const chips = $('chapters');
    C.chapters.forEach((ch) => {
      const b = document.createElement('button');
      b.className = 'chip' + (ch.implemented ? '' : ch.coda ? ' coda' : ' planned');
      b.textContent = ch.num;
      b.title = ch.implemented ? `${ch.num} — ${ch.title}: ${ch.subtitle}` : ch.coda ? `${ch.num} — ${ch.title} (coda / end card — full chapter planned)` : `${ch.num} — ${ch.title} (planned for a later milestone)`;
      b.dataset.id = ch.id;
      if (ch.start === undefined) b.disabled = true;
      else b.addEventListener('click', () => handlers.seek(ch.start)); // exactly on a gate: it waits for you
      chips.appendChild(b);
    });
    // timeline markers
    const track = $('track');
    C.chapters.filter((c) => c.start !== undefined && c.start > 0).forEach((c) => {
      const m = document.createElement('div'); m.className = 'marker'; m.style.left = (c.start / C.filmLength * 100) + '%'; track.appendChild(m);
    });
    C.gates.forEach((g) => {
      const m = document.createElement('div'); m.className = 'marker gate';
      m.style.left = (g.t / C.filmLength * 100) + '%'; m.title = 'Interactive: ' + g.title; track.appendChild(m);
    });
    // stage feedback: ripples where the viewer clicks
    U.on('tap', (e) => {
      const r = document.createElement('span');
      r.className = e.restored ? 'hit' : e.near ? 'near' : '';
      r.style.left = e.x + 'px'; r.style.top = e.y + 'px';
      $('ripples').appendChild(r); setTimeout(() => r.remove(), 1500);
    });
    U.on('pulseFound', () => toast('The pulse answers.'));
    U.on('restoreDone', () => toast('The city remembers how to shine.'));
    const seekFromEvent = (e) => { const r = track.getBoundingClientRect(); handlers.seek(U.clamp((e.clientX - r.left) / r.width, 0, 1) * C.filmLength); };
    let scrub = false;
    track.addEventListener('pointerdown', (e) => { scrub = true; track.setPointerCapture(e.pointerId); seekFromEvent(e); });
    track.addEventListener('pointermove', (e) => { if (scrub) seekFromEvent(e); });
    track.addEventListener('pointerup', () => { scrub = false; });

    // camera modes
    const sel = $('camMode');
    AG.Camera.MODES.forEach((m) => { const o = document.createElement('option'); o.value = m.id; o.textContent = m.label; sel.appendChild(o); });
    sel.addEventListener('change', () => handlers.camera(sel.value));
    U.on('cameraMode', (m) => { sel.value = m; });

    $('btnPlay').addEventListener('click', handlers.toggle);
    $('btnReplay').addEventListener('click', handlers.replay);
    $('btnSound').addEventListener('click', handlers.sound);
    $('btnVoice').addEventListener('click', handlers.voice);
    $('btnRegen').addEventListener('click', handlers.regen);
    $('btnFull').addEventListener('click', handlers.fullscreen);
    $('btnHelp').addEventListener('click', () => toggleHelp());
    $('helpClose').addEventListener('click', () => toggleHelp(false));
    $('endReplay').addEventListener('click', handlers.replay);
    $('sens').addEventListener('input', (e) => { AG.Mic.sensitivity = parseFloat(e.target.value); $('sensVal').textContent = AG.Mic.sensitivity.toFixed(1) + '×'; });
    $('quality').addEventListener('change', (e) => handlers.quality(e.target.value));
    $('vol').addEventListener('input', (e) => { AG.Audio.setVolume(parseFloat(e.target.value)); if (AG.Audio.muted && parseFloat(e.target.value) > 0) AG.Audio.setMuted(false); });
    // character asset report (Help panel): the offline audit of the files you supplied + what the browser verified
    const renderAssets = () => {
      const rows = AG.CharacterAssets.report().map((r) => {
        const bad = /CHECKERBOARD|DUPLICATE/.test(r.audit);
        const st = r.status === 'ok' ? 'ok' : r.status;
        return `<div class="arow ${bad ? 'warn' : ''}"><b>${r.id}</b><span>${r.name}</span><span class="st ${st}">${st}</span><span class="au">${r.audit}${r.status !== 'ok' && r.message ? ' · ' + r.message : ''}</span></div>`;
      });
      $('assetReport').innerHTML = rows.join('');
    };
    renderAssets();
    U.on('characterAsset', renderAssets);

    U.on('playstate', (pl) => { $('btnPlay').innerHTML = pl ? ICON.pause : ICON.play; $('btnPlay').title = pl ? 'Pause (Space)' : 'Play (Space)'; document.body.classList.toggle('paused', !pl); });
    U.on('muted', (m) => { $('btnSound').innerHTML = m ? ICON.soundOff : ICON.soundOn; $('btnSound').classList.toggle('off', m); });
    U.on('mic', (M) => {
      const b = $('btnVoice');
      b.classList.toggle('on', M.state === 'on');
      b.classList.toggle('warn', ['denied', 'unavailable', 'insecure'].includes(M.state));
      $('voicePanel').classList.toggle('show', M.state === 'on');
      $('micStatus').textContent = M.state === 'off' ? 'voice off' : M.state === 'on' ? 'voice on' : M.state === 'requesting' ? 'asking…' : 'voice unavailable';
      $('micStatus').className = 'pill ' + M.state;
      if (M.message && M.state !== 'on') toast(M.message);
      if (M.state === 'on') toast('Voice Mode on — the city hears loudness, brightness and duration. Nothing is recorded.');
    });
    // chapter cards: label at once; the big card waits for a calm moment (config `cardAt`, or none)
    U.on('chapter', ({ chapter }) => {
      showCard(chapter, true);
      pendingCard = chapter.card === false ? null : chapter;
      if (pendingCard && AG.Timeline.time > (chapter.cardAt !== undefined ? chapter.cardAt : chapter.start) + 4) pendingCard = null;
    });
    U.on('ended', () => { document.body.classList.add('ended'); setTimeout(() => { if (document.body.classList.contains('ended')) $('endCard').classList.add('show'); }, 1800); });
    U.on('seek', () => { $('endCard').classList.remove('show'); document.body.classList.remove('ended'); });
    U.on('replay', () => { $('endCard').classList.remove('show'); document.body.classList.remove('ended'); });
    U.on('quality', (q) => { $('tierNow').textContent = q; });
    U.on('audioMode', (m) => { $('audioMode').textContent = m === 'mp3' ? 'soundtrack: MP3' : 'soundtrack: generative score'; });

    const wake = () => { idle = 0; };
    window.addEventListener('pointermove', wake); window.addEventListener('keydown', wake); window.addEventListener('pointerdown', wake);
  }

  function showCard(ch, labelOnly) {
    const card = $('chapterCard');
    if (!ch || ch.coda) { card.classList.remove('show'); return; }
    if (labelOnly) { $('chapterLabel').textContent = ch.num + ' · ' + ch.title; document.querySelectorAll('#chapters .chip').forEach((b) => b.classList.toggle('active', b.dataset.id === ch.id)); card.classList.remove('show'); return; }
    $('cardNum').textContent = 'CHAPTER ' + ch.num;
    $('cardTitle').textContent = ch.title;
    $('cardSub').textContent = ch.subtitle;
    $('chapterLabel').textContent = ch.num + ' · ' + ch.title;
    document.querySelectorAll('#chapters .chip').forEach((b) => b.classList.toggle('active', b.dataset.id === ch.id));
    card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
    clearTimeout(cardTimer); cardTimer = setTimeout(() => card.classList.remove('show'), 6500);
  }

  function toggleHelp(force) {
    const h = $('help');
    const show = force === undefined ? !h.classList.contains('show') : force;
    h.classList.toggle('show', show);
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
  }

  function update(dt, t, S, input) {
    idle += dt;
    const helpOpen = $('help').classList.contains('show');
    const shouldHide = forceHidden || (idle > 3.5 && !helpOpen && AG.Timeline.playing && !AG.Interact.stage);
    if (shouldHide !== hidden) { hidden = shouldHide; document.body.classList.toggle('ui-hidden', hidden); }
    $('progress').style.width = (t / C.filmLength * 100) + '%';
    $('timeText').textContent = U.fmtTime(t) + ' / ' + U.fmtTime(C.filmLength);
    if (S.hint !== lastHint) { lastHint = S.hint; $('hint').textContent = S.hint; $('hint').classList.toggle('show', !!S.hint); }
    $('meterFill').style.width = (AG.Mic.level * 100).toFixed(0) + '%';
    if (pendingCard && t >= (pendingCard.cardAt !== undefined ? pendingCard.cardAt : pendingCard.start) && AG.Timeline.playing) { showCard(pendingCard, false); pendingCard = null; }
    // ---- interactive stages ----
    const IA = AG.Interact, stg = IA.stage;
    document.body.classList.toggle('stage-find', stg === 'find');
    document.body.classList.toggle('stage-restore', stg === 'restore');
    const panel = $('stagePanel');
    if (stg) {
      const g = AG.gateById(stg);
      if (panel.dataset.stage !== stg) {
        panel.dataset.stage = stg;
        $('stageTitle').textContent = g.title; $('stageText').textContent = g.text;
      }
      if (stg === 'restore') {
        const n = IA.restored, cols = C.interact.spotColours;
        const html = Array.from({ length: IA.needed }, (_, i) => `<i class="${i < n ? 'on' : ''}" style="color:rgb(${cols.at(i % cols.length).map((c) => Math.round(c * 255)).join(',')})"></i>`).join('');
        if ($('stageCount').innerHTML !== html) $('stageCount').innerHTML = html;
      } else if ($('stageCount').innerHTML) $('stageCount').innerHTML = '';
    } else panel.dataset.stage = '';
    panel.classList.toggle('show', !!stg && AG.Timeline.playing);
    // after a few seconds the panel shrinks to a small pill so it never hides the city
    panel.classList.toggle('compact', !!stg && AG.Timeline.holdTime > 6);
    // hints: a ring around the pulse (or a dark tower), an arrow when it is off screen
    let ring = null, arrow = null;
    if (stg === 'find' && IA.beaconScreen && IA.hintLevel >= 2) {
      const b = IA.beaconScreen;
      if (b.on && b.visible) ring = b;
      else if (!b.on) arrow = b;
    } else if (stg === 'find' && !IA.beaconScreen && IA.hintLevel >= 2 && IA.beacon) {
      arrow = { behind: true };
    }
    if (stg === 'restore' && IA.hintTarget) ring = IA.hintTarget;
    const hr = $('hintRing');
    hr.classList.toggle('show', !!ring);
    if (ring) { hr.style.left = ring.x + 'px'; hr.style.top = ring.y + 'px'; }
    const ha = $('hintArrow');
    ha.classList.toggle('show', !!arrow);
    if (arrow) {
      // point from the screen centre toward the pulse (behind the camera → along the shorter turn)
      const W = window.innerWidth, H = window.innerHeight;
      let dx, dy;
      if (arrow.behind) { const cam = AG.Camera.state, b = U.v3.sub(IA.beacon.pos, cam.pos); dx = U.v3.dot(b, cam.right || [1, 0, 0]) >= 0 ? 1 : -1; dy = 0; }
      else { dx = arrow.nx; dy = -arrow.ny; }
      const a = Math.atan2(dy, dx), m = 46;
      const k = Math.min((W / 2 - m) / Math.max(Math.abs(Math.cos(a)), 1e-3), (H / 2 - m) / Math.max(Math.abs(Math.sin(a)), 1e-3));
      ha.style.left = (W / 2 + Math.cos(a) * k) + 'px'; ha.style.top = (H / 2 + Math.sin(a) * k) + 'px';
      ha.style.transform = `rotate(${a}rad)`;
    }
    // press-and-hold charge ring (restore)
    const hold = $('holdRing');
    if (IA.charge && stg === 'restore') {
      hold.classList.add('show', 'charge');
      hold.style.left = IA.charge.x + 'px'; hold.style.top = IA.charge.y + 'px';
      hold.style.transform = `scale(${0.4 + 0.6 * IA.charge.k})`;
    } else { hold.classList.remove('show', 'charge'); hold.style.left = ''; hold.style.top = ''; hold.style.transform = ''; }
    const tr = $('titleReveal');
    const showT = S.title > 0.02;
    if (showT !== tr.classList.contains('show')) tr.classList.toggle('show', showT);
  }

  return {
    init, update, toast, toggleHelp, showCard,
    toggleHidden() { forceHidden = !forceHidden; },
    setSeed(s) { $('seedVal').textContent = s; },
    setLoading(msg, ready) { $('loadMsg').textContent = msg; $('btnEnter').disabled = !ready; },
    hideIntro() { $('intro').classList.add('gone'); document.body.classList.add('entered'); }
  };
})();
