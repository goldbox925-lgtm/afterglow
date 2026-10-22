# Manual testing checklist (real browser, v3)

Serve locally (`python3 -m http.server 8000`) or on GitHub Pages and open in Chrome.

**Start**
- [ ] The title screen shows, *Enter Experience* activates, and the console shows no red errors (apart from a possible `soundtrack.mp3` 404).
- [ ] Enter: she lies about 1 s, pushes up, sits; the camera pulls back behind her. Sound starts only after the click.

**01 Numbness**
- [ ] Heavy rain, torn facades (dark cavities, charred rims), smoke columns, cold blue-grey.
- [ ] Dragging looks around, the wheel zooms, arrows look around, and the page never scrolls.
- [ ] One far window pulses irregularly. Waiting brings hints at about 10 / 20 / 34 / 52 s.
- [ ] Clicking it triggers impact, lightning and a glitch → card "02 FRACTURE", a reverse angle, then back.

**02 Fracture**
- [ ] The fragile lights flicker and black out. A click while lit (or a hold with the charge ring) steadies one: zap, flare, a small wave of light.
- [ ] Any click on a highlighted fragile light steadies it; no timing or hold is required.
- [ ] After 4: card "03 AWAKENING". She is still seated; most towers are still broken.

**03 Awakening**
- [ ] Reachable dark buildings show as outlined circles.
- [ ] Clicking an outlined circle sends light automatically from the nearest restored building.
- [ ] After five clicks: card "04 RECLAIMING SELF" and the stand cinematic.
- [ ] In scene 04, dragging between two golden building points creates a permanent light path.
- [ ] Clicking one golden point and then another creates the same path.
- [ ] Duplicate and self-connections do not count; the five-dot progress indicator updates only for new links.
- [ ] After five links: card "05 AFTERGLOW" and the lift-off cinematic.
- [ ] Rain eases gradually, with no jumps.

**04 Reclaiming Self**
- [ ] She stands (H → J). Each connection wakes neighbours, neon and holograms return, and it drizzles.
- [ ] She does **not** fly by herself. At the threshold: the lift-off beat, then control.

**05 Afterglow**
- [ ] Mouse left/right of centre steers, ← → turn, ↓ descends; she banks into turns and avoids towers.
- [ ] Hold ↑: she stops and curls up (suffering, trembling, sinking), then kneels and looks up (resistance), then opens her arms (release) and levitates. She is always clearly visible, full body, and never swallowed by glow.
- [ ] The camera swings to face her, sinks below her, slowly orbits, then pulls back so the city falls away.
- [ ] Release ↑: she hovers. After 4 s she flies again. ↑ again resumes from levitation if release was reached.
- [ ] Only after about 30 s of held ↑: LIGHT (sunrise, title, end card). Nothing ends automatically.

**General**
- [ ] 1–5 jumps between states; going back resets. R replays. Space pauses and resumes the music without restarting it.
- [ ] Quality tiers switch (Q). FPS is acceptable on the target laptop.
- [ ] `backup_original/index.html` still runs the previous build for comparison.
