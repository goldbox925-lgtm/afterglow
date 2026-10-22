/* =====================================================================
   Interface — minimal, cinematic, auto-hiding.
   Every control here is wired to real behaviour; nothing is decorative.
   ===================================================================== */
window.AG = window.AG || {};

AG.UI = (function () {
  const U = AG.U, C = AG.CONFIG;
  const $ = (id) => document.getElementById(id);
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
      else b.addEventListener('click', () => handlers.seek(ch.start + 0.01));
      chips.appendChild(b);
    });
    // timeline markers
    const track = $('track');
    C.chapters.filter((c) => c.start !== undefined && c.start > 0).forEach((c) => {
      const m = document.createElement('div'); m.className = 'marker'; m.style.left = (c.start / C.filmLength * 100) + '%'; track.appendChild(m);
    });
    const fl = document.createElement('div'); fl.className = 'marker window';
    fl.dataset.kind = 'threshold';
    fl.style.left = (C.firstLight.windowStart / C.filmLength * 100) + '%';
    fl.style.width = ((C.firstLight.firstLightDefault - C.firstLight.windowStart) / C.filmLength * 100) + '%';
    fl.title = 'Interactive threshold: the first light'; track.appendChild(fl);
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
    U.on('chapter', ({ chapter }) => { const late = AG.Timeline.time > chapter.start + 5; showCard(chapter, late); });
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
    const shouldHide = forceHidden || (idle > 3.5 && !helpOpen && AG.Timeline.playing);
    if (shouldHide !== hidden) { hidden = shouldHide; document.body.classList.toggle('ui-hidden', hidden); }
    $('progress').style.width = (t / C.filmLength * 100) + '%';
    $('timeText').textContent = U.fmtTime(t) + ' / ' + U.fmtTime(C.filmLength);
    if (S.hint !== lastHint) { lastHint = S.hint; $('hint').textContent = S.hint; $('hint').classList.toggle('show', !!S.hint); }
    $('meterFill').style.width = (AG.Mic.level * 100).toFixed(0) + '%';
    $('holdRing').classList.toggle('show', input.holding);
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
