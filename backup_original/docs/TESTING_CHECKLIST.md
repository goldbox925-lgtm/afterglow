# Testing checklist — Chrome on macOS

Open the deployed URL (or `http://localhost:8000`) in normal Chrome with DevTools → Console open.

## Load
- [ ] Title screen, then **Enter Experience** becomes clickable within a few seconds.
- [ ] Console: no red errors. One `404` for `assets/audio/soundtrack.mp3` is expected only if you
      haven't added a soundtrack. A yellow `character pose …` warning means that image failed
      its transparency check and a silhouette is showing.
- [ ] **Help (?) → Character assets:** all ten poses listed, each with status `ok` (B, C, E, F, G come
      from `keyed/`, and D notes it is staged with J).
- [ ] Network tab: all `assets/character/…` files load with 200 from your Pages URL.

## The opening (0–15 s)
- [ ] 0–3 s: one low side-angle shot of her lying on the wet roof; a soft shadow under her; no
      rectangle around her; never seen from above.
- [ ] ~3 s: lightning; she pushes up. ~4.5 s: cut to her sitting, hugging her knees. ~5.8 s: cut
      behind her, looking at the city.
- [ ] 7–15 s: the camera pulls up and away over the dark, broken city. No more lying.

## Find the pulse (stops at 15 s)
- [ ] The story stops; a "Find the pulse" panel appears and shrinks to a small pill after ~6 s.
- [ ] Drag, arrows or wheel turn and zoom the view. A pulsing window exists somewhere off to the side.
- [ ] Clicking elsewhere shows a small ripple and a soft tick; clicking near it shows a pink ripple.
- [ ] Waiting: brighter pulse → an arrow at the screen edge (~16 s) → the view drifts toward it
      (~28 s) → a light shaft above it (~45 s).
- [ ] Clicking the window: a shockwave of light through the surrounding towers, a deep chord, and
      the story continues.

## Bring the city back (stops at 21 s)
- [ ] Clicking a dark tower lights its area in a colour (amber, magenta, cyan, violet, gold), with a
      rising note; the panel's dots fill in.
- [ ] Clicking an area already lit, or the sky, does not count.
- [ ] Pressing and holding on a tower for ~1 s also restores it (a ring grows under the cursor).
- [ ] After 8 s without a restore, a ring marks a dark tower.
- [ ] After five: a chord, the story continues, and the rest of the city follows; your colours stay.

## Reclaiming & flight (21–63 s)
- [ ] STILL HERE sign; she stands, rises and levitates with an aura.
- [ ] Flight: a hint says to steer. Moving the mouse or holding arrows / WASD moves her sideways and
      up/down; she banks; she never enters a tower; the camera never clips through one.
- [ ] Cloud, sunrise, AFTERGLOW title, end card.

## Controls & seeking
- [ ] Chapter chips: 03 and 04 stop at their stage; 05 arrives with the city restored.
- [ ] Seeking back before a stage re-arms it (the restored areas disappear); Replay resets everything.
- [ ] Space, mute, volume, fullscreen, camera menu and N (new city: a new pulse location) all work.

## Voice (HTTPS or localhost)
- [ ] Mic button → permission prompt only now. Allow: meter moves; a hum brightens and speeds the
      light; a clap during Fracture adds glitching.
- [ ] Block: a message appears and the film keeps playing.

## Performance
- [ ] Expect the *balanced* tier at ~50–60 fps; if choppy, Help → Quality → Low.
